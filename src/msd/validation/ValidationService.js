/**
 * @fileoverview Centralized Validation Service for MSD Overlays
 *
 * Provides unified validation across all MSD components with:
 * - Schema-based structural validation
 * - Token reference validation
 * - Data source validation
 * - Value type/range validation
 * - User-friendly error messages with suggestions
 *
 * Integrates with:
 * - ThemeManager for token validation
 * - DataSourceManager for data source validation
 * - validateMerged for post-merge validation
 * - ModelBuilder for pre-render validation
 *
 * @module msd/validation/ValidationService
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { SchemaRegistry } from './SchemaRegistry.js';
import { OverlayValidator } from './OverlayValidator.js';
import { TokenValidator } from './TokenValidator.js';
import { DataSourceValidator } from './DataSourceValidator.js';
import { ErrorFormatter } from './ErrorFormatter.js';

/**
 * Core Validation Service
 *
 * Centralizes all validation logic with intelligent orchestration,
 * theme integration, and comprehensive debugging support.
 */
export class ValidationService {
  /**
   * Create a ValidationService instance
   *
   * @param {Object} config - Service configuration
   * @param {boolean} [config.strict=false] - Treat warnings as errors
   * @param {boolean} [config.stopOnError=false] - Stop at first error
   * @param {boolean} [config.validateTokens=true] - Validate token references
   * @param {boolean} [config.validateDataSources=true] - Validate data sources
   * @param {boolean} [config.debug=false] - Enable debug logging
   */
  constructor(config = {}) {
    this.config = {
      strict: false,
      stopOnError: false,
      validateTokens: true,
      validateDataSources: true,
      debug: false,
      ...config
    };

    // Initialize sub-components
    this.schemaRegistry = new SchemaRegistry();
    this.overlayValidator = new OverlayValidator(this.schemaRegistry);
    this.tokenValidator = null;  // Set when ThemeManager available
    this.dataSourceValidator = null;  // Set when DataSourceManager available
    this.errorFormatter = new ErrorFormatter();
    this.themeManager = null;

    // Statistics
    this.stats = {
      validated: 0,
      errors: 0,
      warnings: 0,
      skipped: 0,
      tokenValidations: 0,
      dataSourceValidations: 0
    };

    // Validation cache
    this.validationCache = new Map();
    this.cacheEnabled = true;

    cblcarsLog.debug('[ValidationService] Initialized', this.config);
  }

  /**
   * Validate a single overlay
   *
   * @param {Object} overlay - Overlay configuration
   * @param {Object} context - Validation context
   * @param {Array} [context.viewBox] - SVG viewBox [x, y, width, height]
   * @param {Object} [context.anchors] - Available anchors
   * @param {Object} [context.overlays] - All overlays (for reference validation)
   * @returns {Object} Validation result
   *
   * @example
   * const result = validationService.validateOverlay({
   *   id: 'my-text',
   *   type: 'text',
   *   text: 'Hello',
   *   position: [100, 100]
   * }, { viewBox: [0, 0, 800, 600] });
   *
   * if (!result.valid) {
   *   console.error(result.errors);
   * }
   */
  validateOverlay(overlay, context = {}) {
    this.stats.validated++;

    // Check cache
    const cacheKey = this._generateCacheKey(overlay, context);
    if (this.cacheEnabled && this.validationCache.has(cacheKey)) {
      const cached = this.validationCache.get(cacheKey);
      cblcarsLog.debug('[ValidationService] Cache hit:', overlay.id);
      return cached;
    }

    const result = {
      valid: true,
      errors: [],
      warnings: [],
      overlayId: overlay.id,
      overlayType: overlay.type
    };

    // Validation guard
    if (!overlay || typeof overlay !== 'object') {
      result.errors.push({
        field: 'overlay',
        type: 'invalid_type',
        message: 'Overlay must be an object',
        severity: 'error'
      });
      result.valid = false;
      this.stats.errors++;
      return result;
    }

    // ✅ ENHANCED: Add DataSourceManager to context if available
    const enhancedContext = {
      ...context,
      dataSourceManager: context.dataSourceManager ||
                        window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager
    };

    // 1. Structural validation (schema-based)
    try {
      const structuralValidation = this.overlayValidator.validate(overlay, enhancedContext);
      result.errors.push(...structuralValidation.errors);
      result.warnings.push(...structuralValidation.warnings);
    } catch (error) {
      cblcarsLog.error('[ValidationService] Structural validation failed:', error);
      result.errors.push({
        field: 'overlay',
        type: 'validation_error',
        message: `Validation error: ${error.message}`,
        severity: 'error'
      });
    }

    // 2. Token validation (if enabled and available)
    if (this.config.validateTokens && this.tokenValidator) {
      try {
        const tokenValidation = this.tokenValidator.validate(overlay, context);
        result.errors.push(...tokenValidation.errors);
        result.warnings.push(...tokenValidation.warnings);
        this.stats.tokenValidations++;
      } catch (error) {
        if (this.config.debug) {
          cblcarsLog.debug('[ValidationService] Token validation failed:', error);
        }
      }
    }

    // 3. Data source validation (if enabled and available)
    if (this.config.validateDataSources && this.dataSourceValidator) {
      try {
        const dsValidation = this.dataSourceValidator.validate(overlay, context);
        result.errors.push(...dsValidation.errors);
        result.warnings.push(...dsValidation.warnings);
        this.stats.dataSourceValidations++;
      } catch (error) {
        if (this.config.debug) {
          cblcarsLog.debug('[ValidationService] DataSource validation failed:', error);
        }
      }
    }

    // Determine validity
    result.valid = result.errors.length === 0 &&
                   (!this.config.strict || result.warnings.length === 0);

    // Update stats
    if (!result.valid) this.stats.errors++;
    if (result.warnings.length > 0) this.stats.warnings++;

    // Cache result
    if (this.cacheEnabled) {
      this.validationCache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Validate all overlays
   *
   * @param {Array} overlays - Array of overlay configurations
   * @param {Object} context - Validation context
   * @returns {Object} Validation summary
   *
   * @example
   * const validation = validationService.validateAll(overlays, {
   *   viewBox: [0, 0, 800, 600],
   *   anchors: { center: [400, 300] }
   * });
   *
   * if (!validation.valid) {
   *   console.log(validationService.formatErrors(validation));
   * }
   */
  validateAll(overlays, context = {}) {
    const results = [];
    let hasErrors = false;

    // Enhance context with overlay list (for reference validation)
    const enhancedContext = {
      ...context,
      overlays: overlays
    };

    for (const overlay of overlays) {
      const result = this.validateOverlay(overlay, enhancedContext);
      results.push(result);

      if (!result.valid) {
        hasErrors = true;
        if (this.config.stopOnError) {
          cblcarsLog.debug('[ValidationService] Stopping on first error');
          break;
        }
      }
    }

    return {
      valid: !hasErrors,
      results,
      summary: {
        total: overlays.length,
        valid: results.filter(r => r.valid).length,
        invalid: results.filter(r => !r.valid).length,
        errors: results.reduce((sum, r) => sum + r.errors.length, 0),
        warnings: results.reduce((sum, r) => sum + r.warnings.length, 0)
      }
    };
  }

  /**
   * Format validation errors for display
   *
   * @param {Object} validationResult - Result from validateOverlay/validateAll
   * @returns {string} Formatted error message
   *
   * @example
   * const result = validationService.validateOverlay(overlay);
   * if (!result.valid) {
   *   console.error(validationService.formatErrors(result));
   * }
   */
  formatErrors(validationResult) {
    return this.errorFormatter.format(validationResult);
  }

  /**
   * Set ThemeManager for token validation
   *
   * @param {Object} themeManager - ThemeManager instance
   */
  setThemeManager(themeManager) {
    this.themeManager = themeManager;
    this.tokenValidator = new TokenValidator(themeManager);

    // ✅ NEW: Pass ThemeManager to ValueValidator
    if (this.overlayValidator && this.overlayValidator.valueValidator) {
      this.overlayValidator.valueValidator.setThemeManager(themeManager);
    }

    cblcarsLog.debug('[ValidationService] ThemeManager connected for token validation');
  }

  /**
   * Set DataSourceManager for data source validation
   *
   * @param {Object} dataSourceManager - DataSourceManager instance
   */
  setDataSourceManager(dataSourceManager) {
    this.dataSourceValidator = new DataSourceValidator(dataSourceManager);
    cblcarsLog.debug('[ValidationService] DataSourceManager connected for data source validation');
  }

  /**
   * Get validation statistics
   *
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.validationCache.size,
      cacheEnabled: this.cacheEnabled
    };
  }

  /**
   * Clear validation cache and stats
   *
   * @param {boolean} [clearStats=false] - Also clear statistics
   */
  clear(clearStats = false) {
    this.validationCache.clear();

    if (clearStats) {
      this.stats = {
        validated: 0,
        errors: 0,
        warnings: 0,
        skipped: 0,
        tokenValidations: 0,
        dataSourceValidations: 0
      };
    }

    cblcarsLog.debug('[ValidationService] Cache cleared', { clearStats });
  }

  /**
   * Enable or disable validation caching
   *
   * @param {boolean} enabled - Enable caching
   */
  setCaching(enabled) {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.validationCache.clear();
    }
    cblcarsLog.debug('[ValidationService] Caching:', enabled);
  }

  /**
   * Generate cache key for overlay validation
   *
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Object} context - Validation context
   * @returns {string} Cache key
   */
  _generateCacheKey(overlay, context) {
    // Simple cache key based on overlay ID and type
    // Could be enhanced to include context hash if needed
    return `${overlay.id || 'unknown'}:${overlay.type || 'unknown'}`;
  }

  /**
   * Get debug information
   *
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      config: this.config,
      stats: this.getStats(),
      hasTokenValidator: !!this.tokenValidator,
      hasDataSourceValidator: !!this.dataSourceValidator,
      schemaCount: this.schemaRegistry.getSchemaCount(),
      registeredTypes: this.schemaRegistry.getRegisteredTypes()
    };
  }
}

// Make globally accessible for debugging
if (typeof window !== 'undefined') {
  window.cblcars = window.cblcars || {};
  window.cblcars.debug = window.cblcars.debug || {};
  window.cblcars.debug.msd = window.cblcars.debug.msd || {};

  // ✅ PHASE 4: Move to _internal namespace
  if (!window.cblcars.debug.msd.pipelineInstance) {
    window.cblcars.debug.msd.pipelineInstance = {};
  }
  if (!window.cblcars.debug.msd.pipelineInstance._internal) {
    window.cblcars.debug.msd.pipelineInstance._internal = {};
  }

  window.cblcars.debug.msd.pipelineInstance._internal.ValidationService = ValidationService;

  // ✅ PHASE 4: Deprecated - use pipelineInstance._internal.ValidationService
  window.cblcars.debug.msd.ValidationService = ValidationService;
}

export default ValidationService;