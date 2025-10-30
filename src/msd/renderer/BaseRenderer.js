/**
 * @fileoverview Base Renderer Class for MSD Overlays
 *
 * Provides common functionality for all overlay renderers:
 * - ThemeManager integration and resolution
 * - Default value resolution with token support
 * - Scaling context management
 * - Consistent logging patterns
 * - Provenance tracking for debugging
 *
 * All overlay-specific renderers should extend this base class.
 *
 * @module msd/renderer/BaseRenderer
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Base class for all MSD overlay renderers
 *
 * Provides shared functionality for theme management, default resolution,
 * and common rendering utilities with built-in provenance tracking.
 *
 * Subclasses should set this.rendererName in their constructor for proper logging.
 *
 * @abstract
 * @class BaseRenderer
 */
export class BaseRenderer {
  /**
   * Create a base renderer instance
   *
   * Subclasses should call super() and set this.rendererName for logging.
   *
   * @constructor
   * @example
   * class MyRenderer extends BaseRenderer {
   *   constructor() {
   *     super();
   *     this.rendererName = 'MyRenderer'; // Set for logging
   *   }
   * }
   */
  constructor() {
    // Renderer name for logging (must be set by subclass)
    // This ensures minification doesn't break logging
    this.rendererName = 'BaseRenderer';

    // Initialize ThemeManager reference
    this.themeManager = this._resolveThemeManager();

    // ✅ NEW: Phase 6 - Get StyleResolverService
    this.styleResolver = this._resolveStyleResolver();

    // Container and viewBox will be set by subclasses or render methods
    this.container = null;
    this.viewBox = null;

    // ✅ NEW: Provenance tracking
    this._defaultsAccessed = [];
    this._renderStartTime = null;
    this._featuresUsed = new Set();
    this._styleResolutions = [];

    if (this.styleResolver) {
      cblcarsLog.debug(`[${this.rendererName}] ✅ StyleResolverService available`);
    } else {
      cblcarsLog.debug(`[${this.rendererName}] ⚠️ StyleResolverService not available, using fallback`);
    }
  }

  /**
   * Resolve ThemeManager from various sources
   *
   * Checks multiple locations for ThemeManager instance:
   * 1. Global CB-LCARS namespace (window.cblcars.theme)
   * 2. Pipeline instance via systemsManager
   * 3. Direct pipeline access
   * 4. Systems manager global reference
   *
   * @private
   * @returns {Object|null} ThemeManager instance or null if not found
   */
  _resolveThemeManager() {
    // 1. Global CB-LCARS namespace (preferred)
    if (typeof window !== 'undefined' && window.cblcars?.theme) {
      return window.cblcars.theme;
    }

    // 2. Pipeline instance via systemsManager
    if (typeof window !== 'undefined') {
      const pipelineInstance = window.cblcars.debug.msd?.pipelineInstance;
      if (pipelineInstance?.systemsManager?.themeManager) {
        return pipelineInstance.systemsManager.themeManager;
      }

      // 3. Direct pipeline access
      if (pipelineInstance?.themeManager) {
        return pipelineInstance.themeManager;
      }

      // 4. Systems manager global reference
      const systemsManager = window.cblcars.debug.msd?.systemsManager;
      if (systemsManager?.themeManager) {
        return systemsManager.themeManager;
      }
    }

    this._logDebug('⚠️ No theme manager found');
    return null;
  }

  /**
   * Get default value from ThemeManager with proper fallback chain
   *
   * Resolves component-specific default values from the active theme.
   * Converts dot-notation paths to ThemeManager format and resolves
   * token references automatically.
   *
   * ✅ ENHANCED: Now tracks default access for provenance
   *
   * @protected
   * @param {string} path - Dot-notation path (e.g., 'statusGrid.textPadding')
   * @param {*} fallback - Fallback value if theme default not found
   * @returns {*} Resolved default value or fallback
   *
   * @example
   * // Get status grid text padding with fallback
   * const padding = this._getDefault('statusGrid.textPadding', 8);
   *
   * @example
   * // Get text default color
   * const color = this._getDefault('text.defaultColor', '#FFFFFF');
   */
  _getDefault(path, fallback = null) {
    const themeManager = this._resolveThemeManager();

    if (!themeManager || !themeManager.initialized) {
      // ✅ Track fallback usage
      this._trackDefaultAccess(path, fallback, 'fallback', 'no_theme_manager');
      return fallback;
    }

    // Convert path from 'componentType.property' to ThemeManager format
    // ThemeManager expects: getDefault(componentType, property, fallback)
    const pathParts = path.split('.');
    const componentType = pathParts[0];
    const property = pathParts.slice(1).join('.');

    try {
      const value = themeManager.getDefault(componentType, property, fallback);
      const finalValue = value !== null ? value : fallback;

      // ✅ Track the access with source
      const source = value !== null ? 'theme' : 'fallback';
      const reason = value !== null ? 'resolved' : 'not_in_theme';
      this._trackDefaultAccess(path, finalValue, source, reason);

      return finalValue;
    } catch (error) {
      this._logWarn(`Error resolving theme default for ${path}:`, error);
      // ✅ Track error case
      this._trackDefaultAccess(path, fallback, 'fallback', 'error');
      return fallback;
    }
  }

  /**
   * Track default value access for provenance
   *
   * Records each time a default value is accessed, including the path,
   * resolved value, source, and reason. This data is used to populate
   * the renderer provenance in __provenance.renderers.
   *
   * ✅ NEW: Provenance tracking method
   *
   * @private
   * @param {string} path - Default value path
   * @param {*} value - Resolved value
   * @param {string} source - Source of value (theme, fallback, error)
   * @param {string} reason - Reason for source (resolved, not_in_theme, no_theme_manager, error)
   */
  _trackDefaultAccess(path, value, source, reason) {
    this._defaultsAccessed.push({
      path,
      value,
      source,
      reason,
      timestamp: Date.now()
    });
  }

  /**
   * Track feature usage for provenance
   *
   * Records renderer features used during rendering (e.g., 'preset',
   * 'theme_defaults', 'token_resolution', 'brackets', 'glow', etc.)
   *
   * ✅ NEW: Feature tracking method
   *
   * @protected
   * @param {string} feature - Feature name
   */
  _trackFeature(feature) {
    this._featuresUsed.add(feature);
  }

  /**
   * Start render timing for performance tracking
   *
   * Call at the beginning of a render method to track rendering time.
   *
   * ✅ NEW: Performance tracking method
   *
   * @protected
   */
  _startRenderTiming() {
    this._renderStartTime = performance.now();
  }

  /**
   * Get render duration in milliseconds
   *
   * Returns the time elapsed since _startRenderTiming() was called.
   *
   * ✅ NEW: Performance tracking method
   *
   * @protected
   * @returns {number} Render duration in milliseconds
   */
  _getRenderDuration() {
    if (!this._renderStartTime) return 0;
    return performance.now() - this._renderStartTime;
  }

  /**
   * Get renderer provenance for an overlay
   *
   * Collects all tracking data (defaults accessed, features used, render time,
   * style resolutions) and returns a provenance object suitable for storage
   * in __provenance.renderers.
   *
   * ✅ ENHANCED: Now includes style resolution summary (Phase 5.2B)
   *
   * @protected
   * @param {string} overlayId - Overlay ID
   * @param {Object} additionalData - Additional renderer-specific data
   * @returns {Object} Renderer provenance object
   */
  _getRendererProvenance(overlayId, additionalData = {}) {
    // ✅ NEW: Summarize style resolutions by source
    const styleResolutionSummary = this._summarizeStyleResolutions();

    return {
      renderer: this.rendererName,
      extends_base: true,
      overlay_id: overlayId,
      theme_manager_resolved: !!this.themeManager,
      theme_manager_source: this._getThemeManagerSource(),
      defaults_accessed: this._defaultsAccessed,
      features_used: Array.from(this._featuresUsed),
      style_resolution: styleResolutionSummary, // ✅ NEW: Style resolution data
      rendering_time_ms: this._getRenderDuration(),
      timestamp: Date.now(),
      ...additionalData
    };
  }

  /**
   * Summarize style resolutions by source
   *
   * Aggregates style resolution data for provenance reporting.
   * Groups resolutions by source type and provides detailed property list.
   *
   * ✅ NEW: Phase 5.2B - Style resolution summary
   *
   * @private
   * @returns {Object} Style resolution summary
   */
  _summarizeStyleResolutions() {
    if (!this._styleResolutions || this._styleResolutions.length === 0) {
      return {
        total: 0,
        by_source: {},
        properties: []
      };
    }

    const bySource = {};
    const properties = [];

    this._styleResolutions.forEach(resolution => {
      // Count by source
      if (!bySource[resolution.source]) {
        bySource[resolution.source] = 0;
      }
      bySource[resolution.source]++;

      // Track property details
      properties.push({
        property: resolution.property,
        source: resolution.source,
        value: resolution.value,
        token: resolution.tokenUsed || null
      });
    });

    return {
      total: this._styleResolutions.length,
      by_source: bySource,
      properties: properties
    };
  }

  /**
   * Get ThemeManager source for provenance
   *
   * Determines where the ThemeManager instance came from for debugging.
   *
   * ✅ NEW: Source tracking method
   *
   * @private
   * @returns {string|null} Source name
   */
  _getThemeManagerSource() {
    if (!this.themeManager) return null;

    if (typeof window !== 'undefined') {
      if (window.cblcars?.theme === this.themeManager) {
        return 'window.cblcars.theme';
      }

      const pipelineInstance = window.cblcars.debug.msd?.pipelineInstance;
      if (pipelineInstance?.systemsManager?.themeManager === this.themeManager) {
        return 'pipelineInstance.systemsManager.themeManager';
      }

      if (pipelineInstance?.themeManager === this.themeManager) {
        return 'pipelineInstance.themeManager';
      }

      const systemsManager = window.cblcars.debug.msd?.systemsManager;
      if (systemsManager?.themeManager === this.themeManager) {
        return 'systemsManager.themeManager';
      }
    }

    return 'unknown';
  }

  /**
   * Reset provenance tracking for new render
   *
   * Clears all tracking data to prepare for a new render operation.
   * Should be called at the start of each render.
   *
   * ✅ NEW: Tracking reset method
   *
   * @protected
   */
  _resetTracking() {
    this._defaultsAccessed = [];
    this._featuresUsed = new Set();
    this._renderStartTime = null;
    this._styleResolutions = [];
  }

  /**
   * Get ThemeManager instance (wrapper for _resolveThemeManager)
   *
   * @protected
   * @returns {Object|null} ThemeManager instance
   */
  _getThemeManager() {
    return this._resolveThemeManager();
  }

  /**
   * Resolve StyleResolverService from various sources
   * ✅ NEW: Phase 6 - StyleResolverService resolution
   *
   * @protected
   * @returns {Object|null} StyleResolverService instance or null
   */
  _resolveStyleResolver() {
    // Priority 1: Global CB-LCARS namespace (preferred)
    if (typeof window !== 'undefined' && window.cblcars?.styleResolver) {
      return window.cblcars.styleResolver;
    }

    // Priority 2: Pipeline instance via systemsManager
    if (typeof window !== 'undefined') {
      const pipelineInstance = window.cblcars.debug.msd?.pipelineInstance;
      if (pipelineInstance?.systemsManager?.styleResolver) {
        return pipelineInstance.systemsManager.styleResolver;
      }

      // Priority 3: Direct pipeline access
      if (pipelineInstance?.styleResolver) {
        return pipelineInstance.styleResolver;
      }

      // Priority 4: SystemsManager global reference
      const systemsManager = window.__msdSystemsManager || window.cblcars.debug.msd?.systemsManager;
      if (systemsManager?.styleResolver) {
        return systemsManager.styleResolver;
      }
    }

    // No StyleResolver available - will use fallback resolution
    return null;
  }

  /**
   * Get scaling context for responsive calculations
   *
   * Provides viewBox and container element for scaling calculations.
   * Falls back to reasonable defaults if not available.
   *
   * @protected
   * @param {Array|null} fallbackViewBox - Fallback viewBox if not available [x, y, width, height]
   * @returns {Object} Scaling context with viewBox and containerElement
   *
   * @example
   * const context = this._getScalingContext([0, 0, 400, 200]);
   * // Returns: { viewBox: [0, 0, 400, 200], containerElement: <element> }
   */
  _getScalingContext(fallbackViewBox = null) {
    const viewBox = this.viewBox || fallbackViewBox || [0, 0, 400, 200];
    return {
      viewBox: viewBox,
      containerElement: this.container
    };
  }

  /**
   * Resolve a style property with full resolution chain
   * ✅ ENHANCED: Phase 6 - Now uses StyleResolverService when available
   *
   * Resolution chain:
   * 1. StyleResolverService (if available) - Phase 6
   * 2. Explicit value from config
   * 3. Token resolution via ThemeTokenResolver
   * 4. Theme default
   * 5. Fallback value
   *
   * @protected
   * @param {*} explicitValue - Explicit value from overlay config
   * @param {string} tokenPath - Token path for resolution (e.g., 'colors.primary')
   * @param {Function} resolveToken - Token resolver function (legacy)
   * @param {*} fallback - Fallback value if all else fails
   * @param {Object} context - Resolution context (viewBox, overlayId, etc.)
   * @returns {*} Resolved value
   */
  _resolveStyleProperty(explicitValue, tokenPath, resolveToken, fallback, context = {}) {
    // ✅ NEW: Phase 6 - Use StyleResolverService if available
    if (this.styleResolver) {
      try {
        const result = this.styleResolver.resolveProperty({
          property: tokenPath ? tokenPath.split('.').pop() : 'unknown',
          value: explicitValue,
          tokenPath: tokenPath,
          defaultValue: fallback,
          context: {
            ...context,
            componentType: this.rendererName.replace('Renderer', '').toLowerCase()
          }
        });

        // Track for provenance (Phase 5.2B)
        this._trackStyleResolution(tokenPath, {
          source: result.source,
          value: result.value,
          provenance: result.provenance
        });

        return result.value;

      } catch (error) {
        cblcarsLog.warn(`[${this.rendererName}] StyleResolver error, using fallback:`, error);
        // Fall through to manual resolution
      }
    }

    // ✅ FALLBACK: Manual resolution (legacy behavior)
    // Priority 1: Explicit value
    if (explicitValue !== undefined && explicitValue !== null) {
      // Check if it's a token reference string
      if (typeof explicitValue === 'string' && this._isTokenReference(explicitValue)) {
        const tokenResolved = this._resolveTokenManually(explicitValue, fallback, context);
        this._trackStyleResolution(tokenPath, {
          source: 'token_from_style',
          value: tokenResolved,
          token: explicitValue
        });
        return tokenResolved;
      }

      // Use explicit value
      this._trackStyleResolution(tokenPath, {
        source: 'explicit',
        value: explicitValue
      });
      return explicitValue;
    }

    // Priority 2: Token path resolution
    if (tokenPath) {
      // Try ThemeTokenResolver first
      if (resolveToken && typeof resolveToken === 'function') {
        try {
          const tokenValue = resolveToken(tokenPath, null, context);
          if (tokenValue !== null && tokenValue !== undefined) {
            this._trackStyleResolution(tokenPath, {
              source: 'token_system',
              value: tokenValue,
              token: tokenPath
            });
            return tokenValue;
          }
        } catch (error) {
          cblcarsLog.debug(`[${this.rendererName}] Token resolution failed for ${tokenPath}:`, error);
        }
      }

      // Try manual token resolution
      const manualResolved = this._resolveTokenManually(tokenPath, null, context);
      if (manualResolved !== null) {
        this._trackStyleResolution(tokenPath, {
          source: 'token_system',
          value: manualResolved,
          token: tokenPath
        });
        return manualResolved;
      }
    }

    // Priority 3: Theme default (via ThemeManager)
    if (this.themeManager && tokenPath) {
      try {
        const parts = tokenPath.split('.');
        if (parts.length >= 2) {
          const componentType = parts[0]; // e.g., 'text', 'line'
          const property = parts.slice(1).join('.'); // e.g., 'defaultColor'

          const themeDefault = this.themeManager.getDefault(componentType, property, null);
          if (themeDefault !== null && themeDefault !== undefined) {
            this._trackStyleResolution(tokenPath, {
              source: 'theme',
              value: themeDefault
            });
            return themeDefault;
          }
        }
      } catch (error) {
        cblcarsLog.debug(`[${this.rendererName}] Theme default lookup failed:`, error);
      }
    }

    // Priority 4: Fallback
    this._trackStyleResolution(tokenPath, {
      source: 'fallback',
      value: fallback
    });
    return fallback;
  }

  /**
   * Check if a value is a token reference
   * ✅ NEW: Phase 6 - Token reference detection
   *
   * @private
   * @param {*} value - Value to check
   * @returns {boolean} True if value is a token reference
   */
  _isTokenReference(value) {
    if (typeof value !== 'string') return false;
    const tokenCategories = ['colors', 'typography', 'spacing', 'borders', 'effects', 'animations', 'components'];
    return tokenCategories.some(category => value.startsWith(`${category}.`));
  }

  /**
   * Manually resolve a token (fallback when StyleResolver not available)
   * ✅ NEW: Phase 6 - Manual token resolution fallback
   *
   * @private
   * @param {string} tokenPath - Token path to resolve
   * @param {*} fallback - Fallback value
   * @param {Object} context - Resolution context
   * @returns {*} Resolved value or fallback
   */
  _resolveTokenManually(tokenPath, fallback, context) {
    if (!this.themeManager) return fallback;

    try {
      // Simple path navigation through theme
      const theme = this.themeManager.getActiveTheme?.() || this.themeManager.activeTheme;
      if (!theme) return fallback;

      const parts = tokenPath.split('.');
      let value = theme;

      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          return fallback;
        }
      }

      // Handle function values (context-aware tokens)
      if (typeof value === 'function') {
        return value(context);
      }

      return value !== null && value !== undefined ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  /**
   * Track style resolution for provenance
   *
   * Records each style property resolution including the source
   * (explicit, token, fallback) and the actual value used.
   *
   * ✅ NEW: Phase 5.2B - Style resolution tracking
   *
   * @private
   * @param {string} property - Property name being resolved
   * @param {Object} resolution - Resolution tracking object
   */
  _trackStyleResolution(property, resolution) {
    if (!this._styleResolutions) {
      this._styleResolutions = [];
    }

    this._styleResolutions.push({
      property,
      source: resolution.source,
      value: resolution.resolved,
      tokenPath: resolution.tokenPath,
      tokenUsed: resolution.tokenUsed,
      explicitValue: resolution.styleValue,
      fallback: resolution.fallback,
      timestamp: performance.now()
    });
  }

  /**
   * Check if a value is a token reference
   *
   * Token references start with known token category names:
   * colors, typography, spacing, borders, effects, animations, components
   *
   * @protected
   * @param {*} value - Value to check
   * @returns {boolean} True if value is a token reference
   *
   * @example
   * this._isTokenReference('colors.accent.primary'); // true
   * this._isTokenReference('#FF9900'); // false
   * this._isTokenReference(16); // false
   */
  _isTokenReference(value) {
    if (typeof value !== 'string') return false;
    const tokenCategories = ['colors', 'typography', 'spacing', 'borders', 'effects', 'animations', 'components'];
    return tokenCategories.some(category => value.startsWith(`${category}.`));
  }

  /**
   * Log debug message with renderer name prefix
   *
   * Uses rendererName property set by subclass to ensure
   * minification doesn't break logging.
   *
   * @protected
   * @param {string} message - Log message
   * @param {...*} args - Additional arguments to log
   */
  _logDebug(message, ...args) {
    cblcarsLog.debug(`[${this.rendererName}] ${message}`, ...args);
  }

  /**
   * Log warning message with renderer name prefix
   *
   * Uses rendererName property set by subclass to ensure
   * minification doesn't break logging.
   *
   * @protected
   * @param {string} message - Warning message
   * @param {...*} args - Additional arguments to log
   */
  _logWarn(message, ...args) {
    cblcarsLog.warn(`[${this.rendererName}] ${message}`, ...args);
  }

  /**
   * Log error message with renderer name prefix
   *
   * Uses rendererName property set by subclass to ensure
   * minification doesn't break logging.
   *
   * @protected
   * @param {string} message - Error message
   * @param {...*} args - Additional arguments to log
   */
  _logError(message, ...args) {
    cblcarsLog.error(`[${this.rendererName}] ${message}`, ...args);
  }

  /**
   * Resolve container element from various sources
   *
   * Attempts to find a valid container element for rendering:
   * 1. Pipeline renderer mount element
   * 2. Card instance shadow root
   * 3. Document query for overlay container
   *
   * @protected
   * @returns {Element|null} Container element or null if not found
   */
  _resolveContainerElement() {
    // Method 1: From pipeline renderer (most reliable)
    if (typeof window !== 'undefined') {
      const renderer = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.renderer;
      if (renderer?.mountEl) {
        this._logDebug('Resolved container from pipeline renderer');
        return renderer.mountEl;
      }

      // Method 2: From card instance shadow root
      const cardInstance = window.cblcars.debug.msd?.pipelineInstance?.cardInstance ||
                           window._msdCardInstance ||
                           window.cb_lcars_card_instance;

      if (cardInstance?.shadowRoot) {
        this._logDebug('Resolved container from card instance shadow root');
        return cardInstance.shadowRoot;
      }

      // Method 3: Try to find overlay container in document
      const overlayContainer = document.querySelector('#msd-overlay-container');
      if (overlayContainer) {
        this._logDebug('Resolved container from document query');
        return overlayContainer;
      }
    }

    this._logWarn('Could not resolve container element from any source');
    return null;
  }

  /**
   * Abstract render method - must be implemented by subclasses
   *
   * @abstract
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Element} svgContainer - Container element
   * @param {Object} cardInstance - Card instance for actions
   * @returns {Object} Render result with markup and metadata
   * @throws {Error} If not implemented by subclass
   */
  static render(overlay, anchors, viewBox, svgContainer, cardInstance = null) {
    throw new Error(`${this.name}.render() must be implemented by subclass`);
  }
}

// Export for use by renderer subclasses
export default BaseRenderer;