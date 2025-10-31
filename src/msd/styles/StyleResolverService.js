/**
 * @fileoverview Style Resolver Service - Centralized style resolution system
 *
 * Provides unified style resolution across all MSD components with:
 * - Token resolution from theme system
 * - Intelligent caching for performance
 * - Provenance tracking for debugging
 * - Preset application support
 * - Theme change notification
 *
 * Integrates with:
 * - ThemeManager for token resolution
 * - BaseRenderer for automatic resolution
 * - Phase 5.2B provenance system for debugging
 * - RulesEngine for dynamic style updates
 *
 * @module msd/styles/StyleResolverService
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { CacheManager } from './CacheManager.js';
import { TokenResolver } from './TokenResolver.js';
import { PresetManager } from './PresetManager.js';
import { StyleValidator } from './StyleValidator.js';
import { ProvenanceTracker } from './ProvenanceTracker.js';

/**
 * Core Style Resolver Service
 *
 * Centralizes all style resolution logic with intelligent caching,
 * theme integration, and comprehensive debugging support.
 *
 * @class StyleResolverService
 */
export class StyleResolverService {
  /**
   * Create a StyleResolverService instance
   *
   * @param {Object} themeManager - ThemeManager instance for token resolution
   * @param {Object} config - Service configuration
   * @param {Object} config.presets - Style presets configuration
   * @param {boolean} config.cacheEnabled - Enable/disable caching (default: true)
   * @param {number} config.maxCacheSize - Maximum cache entries (default: 1000)
   * @param {boolean} config.debug - Enable debug logging (default: false)
   */
  constructor(themeManager, config = {}) {
    this.themeManager = themeManager;
    this.config = {
      cacheEnabled: true,
      maxCacheSize: 1000,
      debug: false,
      ...config
    };

    // Initialize sub-components
    this.cache = new CacheManager(this.config);
    this.tokenResolver = new TokenResolver(themeManager);
    this.presetManager = new PresetManager(config.presets || {});
    this.validator = new StyleValidator();
    this.provenanceTracker = new ProvenanceTracker();

    // Theme change callbacks
    this.themeChangeCallbacks = new Set();

    // Statistics
    this.stats = {
      resolutions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      tokenResolutions: 0,
      presetApplications: 0
    };

    // Service initialization
    this.initialized = false;
    this._init();

    cblcarsLog.debug('[StyleResolverService] ✅ Initialized');
  }

  /**
   * Initialize the service
   * @private
   */
  _init() {
    // Register for theme changes if ThemeManager supports it
    if (this.themeManager && typeof this.themeManager.subscribeToThemeChanges === 'function') {
      this.themeManager.subscribeToThemeChanges((themeName, theme) => {
        this._handleThemeChange(themeName, theme);
      });
    }

    this.initialized = true;
  }

  /**
   * Resolve a single style property
   *
   * Main entry point for style resolution. Follows priority chain:
   * 1. Explicit value from config
   * 2. Token reference resolution
   * 3. Theme default
   * 4. Component default
   * 5. System fallback
   *
   * @param {Object} options - Resolution options
   * @param {string} options.property - Property name (e.g., 'color')
   * @param {*} options.value - Explicit value from overlay config
   * @param {string} options.tokenPath - Token path to resolve (e.g., 'colors.primary')
   * @param {*} options.defaultValue - Final fallback value
   * @param {Object} options.context - Resolution context
   * @param {string} options.componentType - Component type for defaults (e.g., 'text')
   * @returns {Object} Resolution result { value, source, provenance }
   *
   * @example
   * const result = styleResolver.resolveProperty({
   *   property: 'color',
   *   value: overlay.style?.color,
   *   tokenPath: 'colors.primary',
   *   defaultValue: '#FF9900',
   *   context: { overlayId: 'my-text', overlayType: 'text' }
   * });
   */
  resolveProperty(options) {
    const {
      property,
      value,
      tokenPath,
      defaultValue,
      context = {},
      componentType = null
    } = options;

    this.stats.resolutions++;

    const startTime = performance.now();
    const cacheKey = this._generateCacheKey(property, value, tokenPath, context);

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.cache.get('property', cacheKey);
      if (cached) {
        this.stats.cacheHits++;

        if (this.config.debug) {
          cblcarsLog.debug('[StyleResolverService] Cache hit:', property, cached.value);
        }

        return {
          ...cached,
          fromCache: true
        };
      }
      this.stats.cacheMisses++;
    }

    // Resolution chain
    const resolution = {
      property,
      explicitValue: value,
      tokenPath,
      defaultValue,
      componentType,
      resolvedValue: null,
      source: null,
      timestamp: Date.now()
    };

    // Priority 1: Explicit value
    if (value !== undefined && value !== null) {
      // Check if it's a token reference
      if (typeof value === 'string' && this._isTokenReference(value)) {
        const tokenResult = this.tokenResolver.resolve(value, defaultValue, context);
        resolution.resolvedValue = tokenResult.value;
        resolution.source = 'token_from_style';
        resolution.tokenResolved = tokenResult.path;
        this.stats.tokenResolutions++;
      } else {
        resolution.resolvedValue = value;
        resolution.source = 'explicit';
      }
    }
    // Priority 2: Token path resolution
    else if (tokenPath) {
      const tokenResult = this.tokenResolver.resolve(tokenPath, null, context);
      if (tokenResult.value !== null) {
        resolution.resolvedValue = tokenResult.value;
        resolution.source = 'token_system';
        resolution.tokenResolved = tokenResult.path;
        this.stats.tokenResolutions++;
      }
    }

    // Priority 3: Theme default (if no resolution yet)
    if (resolution.resolvedValue === null && componentType && this.themeManager) {
      try {
        const themeDefault = this.themeManager.getDefault(componentType, property, null);
        if (themeDefault !== null) {
          resolution.resolvedValue = themeDefault;
          resolution.source = 'theme_default';
        }
      } catch (error) {
        if (this.config.debug) {
          cblcarsLog.debug('[StyleResolverService] Theme default lookup failed:', error);
        }
      }
    }

    // Priority 4: Final fallback
    if (resolution.resolvedValue === null) {
      resolution.resolvedValue = defaultValue;
      resolution.source = 'fallback';
    }

    // Validate resolved value
    const validation = this.validator.validate(property, resolution.resolvedValue, context);
    resolution.valid = validation.valid;
    resolution.warnings = validation.warnings;

    // Build provenance
    const provenance = this.provenanceTracker.track({
      property,
      explicitValue: value,
      tokenPath,
      tokenResolved: resolution.tokenResolved,
      themeDefault: resolution.source === 'theme_default' ? resolution.resolvedValue : null,
      resolvedValue: resolution.resolvedValue,
      source: resolution.source,
      componentType,
      context,
      resolutionTime: performance.now() - startTime,
      timestamp: resolution.timestamp
    });

    const result = {
      value: resolution.resolvedValue,
      source: resolution.source,
      valid: resolution.valid,
      warnings: resolution.warnings,
      provenance,
      fromCache: false
    };

    // Cache the result
    if (this.config.cacheEnabled) {
      this.cache.set('property', cacheKey, result);
    }

    if (this.config.debug) {
      cblcarsLog.debug('[StyleResolverService] Resolved:', property, '→', result.value, `(${result.source})`);
    }

    return result;
  }

  /**
   * Resolve all styles for an overlay
   *
   * @param {Object} overlay - Overlay configuration
   * @param {Object} context - Resolution context
   * @returns {Object} { resolvedStyles, provenance }
   *
   * @example
   * const result = styleResolver.resolveOverlayStyles(overlay, {
   *   overlayId: overlay.id,
   *   overlayType: overlay.type,
   *   viewBox: [0, 0, 400, 200]
   * });
   */
  resolveOverlayStyles(overlay, context = {}) {
    const startTime = performance.now();
    const cacheKey = this._generateOverlayCacheKey(overlay, context);

    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.cache.get('overlay', cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return {
          ...cached,
          fromCache: true
        };
      }
      this.stats.cacheMisses++;
    }

    const resolvedStyles = {};
    const provenance = {};
    const style = overlay.finalStyle || overlay.style || {};
    const componentType = overlay.type;

    // Get style schema for this component type
    const schema = this._getStyleSchema(componentType);

    // Resolve each property in the schema
    Object.entries(schema).forEach(([property, config]) => {
      const result = this.resolveProperty({
        property,
        value: style[property],
        tokenPath: config.tokenPath,
        defaultValue: config.default,
        context: {
          ...context,
          overlayId: overlay.id,
          overlayType: overlay.type
        },
        componentType
      });

      resolvedStyles[property] = result.value;
      provenance[property] = result.provenance;
    });

    const result = {
      resolvedStyles,
      provenance,
      resolutionTime: performance.now() - startTime,
      timestamp: Date.now(),
      fromCache: false
    };

    // Cache the result
    if (this.config.cacheEnabled) {
      this.cache.set('overlay', cacheKey, result);
    }

    return result;
  }

  /**
   * Resolve styles with preset application
   *
   * @param {Object} overlay - Overlay configuration
   * @param {Object} context - Resolution context
   * @returns {Object} { resolvedStyles, provenance }
   *
   * @example
   * const result = styleResolver.resolveWithPreset(overlay, context);
   */
  resolveWithPreset(overlay, context = {}) {
    const style = overlay.finalStyle || overlay.style || {};

    // Check for preset
    const presetName = this._getPresetName(overlay);
    if (!presetName) {
      // No preset, use normal resolution
      return this.resolveOverlayStyles(overlay, context);
    }

    this.stats.presetApplications++;

    // Load preset
    const preset = this.presetManager.getPreset(presetName, overlay.type);
    if (!preset) {
      cblcarsLog.warn('[StyleResolverService] Preset not found:', presetName);
      return this.resolveOverlayStyles(overlay, context);
    }

    // Merge preset with explicit styles (explicit overrides preset)
    const mergedStyle = {
      ...preset,
      ...style
    };

    // Create modified overlay with merged styles
    const overlayWithPreset = {
      ...overlay,
      style: mergedStyle,
      finalStyle: mergedStyle
    };

    // Resolve with merged styles
    const result = this.resolveOverlayStyles(overlayWithPreset, context);

    // Add preset info to provenance
    result.presetApplied = presetName;
    result.presetProperties = Object.keys(preset);

    return result;
  }

  /**
   * Invalidate cache
   *
   * @param {string} scope - 'all', 'overlay', 'token', 'preset', 'property'
   * @param {string} id - Specific ID to invalidate (optional)
   *
   * @example
   * // Invalidate all cache
   * styleResolver.invalidateCache('all');
   *
   * // Invalidate specific overlay
   * styleResolver.invalidateCache('overlay', 'my-text');
   *
   * // Invalidate token cache
   * styleResolver.invalidateCache('token', 'colors.primary');
   */
  invalidateCache(scope = 'all', id = null) {
    if (scope === 'all') {
      this.cache.clear();
      this.tokenResolver.clearCache();
      cblcarsLog.debug('[StyleResolverService] All caches cleared');
    } else if (scope === 'token') {
      if (id) {
        this.tokenResolver.clearToken(id);
      } else {
        this.tokenResolver.clearCache();
      }
      // Also clear property cache since tokens affect properties
      this.cache.clear('property');
    } else {
      this.cache.clear(scope, id);
    }
  }

  /**
   * Get resolution provenance for debugging
   *
   * @param {string} overlayId - Overlay ID
   * @returns {Object|null} Provenance data
   *
   * @example
   * const provenance = styleResolver.getProvenance('my-overlay');
   */
  getProvenance(overlayId) {
    return this.provenanceTracker.getProvenance(overlayId);
  }

  /**
   * Find properties using a specific token
   *
   * @param {string} tokenPath - Token path to search for
   * @returns {Array} Array of { overlayId, property } objects
   */
  findPropertiesUsingToken(tokenPath) {
    return this.provenanceTracker.findPropertiesUsingToken(tokenPath);
  }

  /**
   * Subscribe to theme changes
   *
   * @param {Function} callback - Callback function (themeName, theme) => void
   * @returns {Function} Unsubscribe function
   *
   * @example
   * const unsubscribe = styleResolver.onThemeChange((themeName, theme) => {
   *   console.log('Theme changed:', themeName);
   * });
   * // Later: unsubscribe();
   */
  onThemeChange(callback) {
    this.themeChangeCallbacks.add(callback);
    return () => this.themeChangeCallbacks.delete(callback);
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache and resolution statistics
   */
  getCacheStats() {
    return {
      service: {
        resolutions: this.stats.resolutions,
        cacheHits: this.stats.cacheHits,
        cacheMisses: this.stats.cacheMisses,
        hitRate: this.stats.resolutions > 0
          ? ((this.stats.cacheHits / this.stats.resolutions) * 100).toFixed(1) + '%'
          : '0%',
        tokenResolutions: this.stats.tokenResolutions,
        presetApplications: this.stats.presetApplications
      },
      cache: this.cache.getStats(),
      tokens: this.tokenResolver.getStats()
    };
  }

  /**
   * Handle theme change notification
   * @private
   */
  _handleThemeChange(themeName, theme) {
    cblcarsLog.info('[StyleResolverService] Theme changed:', themeName);

    // Invalidate all caches
    this.invalidateCache('all');

    // Notify subscribers
    this.themeChangeCallbacks.forEach(callback => {
      try {
        callback(themeName, theme);
      } catch (error) {
        cblcarsLog.error('[StyleResolverService] Theme change callback error:', error);
      }
    });
  }

  /**
   * Check if a value is a token reference
   * @private
   */
  _isTokenReference(value) {
    if (typeof value !== 'string') return false;
    const tokenCategories = ['colors', 'typography', 'spacing', 'borders', 'effects', 'animations', 'components'];
    return tokenCategories.some(category => value.startsWith(`${category}.`));
  }

  /**
   * Generate cache key for property resolution
   * @private
   */
  _generateCacheKey(property, value, tokenPath, context) {
    // Include theme version in cache key
    const themeVersion = this.themeManager?.getThemeVersion?.() || 'default';
    return `${property}:${value}:${tokenPath}:${context.overlayType}:${themeVersion}`;
  }

  /**
   * Generate cache key for overlay resolution
   * @private
   */
  _generateOverlayCacheKey(overlay, context) {
    const themeVersion = this.themeManager?.getThemeVersion?.() || 'default';
    const styleHash = this._hashObject(overlay.style);
    return `${overlay.id}:${overlay.type}:${styleHash}:${themeVersion}`;
  }

  /**
   * Simple hash function for objects
   * @private
   */
  _hashObject(obj) {
    if (!obj) return 'null';
    return JSON.stringify(obj).split('').reduce((hash, char) => {
      return ((hash << 5) - hash) + char.charCodeAt(0) | 0;
    }, 0).toString(36);
  }

  /**
   * Get preset name from overlay configuration
   * @private
   */
  _getPresetName(overlay) {
    const style = overlay.finalStyle || overlay.style || {};

    // Check various preset property names
    return style.lcars_text_preset ||
           style.lcars_button_preset ||
           style.lcars_preset ||
           style.preset;
  }

  /**
   * Get style schema for component type
   * @private
   */
  _getStyleSchema(componentType) {
    // This will be expanded with actual schemas
    // For now, return empty schema
    return {};
  }
}

// Export for use in pipeline
export default StyleResolverService;