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

    // Container and viewBox will be set by subclasses or render methods
    this.container = null;
    this.viewBox = null;

    // ✅ NEW: Provenance tracking
    this._defaultsAccessed = [];
    this._renderStartTime = null;
    this._featuresUsed = new Set();
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
      const pipelineInstance = window.__msdDebug?.pipelineInstance;
      if (pipelineInstance?.systemsManager?.themeManager) {
        return pipelineInstance.systemsManager.themeManager;
      }

      // 3. Direct pipeline access
      if (pipelineInstance?.themeManager) {
        return pipelineInstance.themeManager;
      }

      // 4. Systems manager global reference
      const systemsManager = window.__msdDebug?.systemsManager;
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
   * Collects all tracking data (defaults accessed, features used, render time)
   * and returns a provenance object suitable for storage in __provenance.renderers.
   *
   * ✅ NEW: Provenance generation method
   *
   * @protected
   * @param {string} overlayId - Overlay ID
   * @param {Object} additionalData - Additional renderer-specific data
   * @returns {Object} Renderer provenance object
   */
  _getRendererProvenance(overlayId, additionalData = {}) {
    return {
      renderer: this.rendererName,
      extends_base: true,
      theme_manager_resolved: !!this.themeManager,
      theme_manager_source: this._getThemeManagerSource(),
      defaults_accessed: this._defaultsAccessed,
      features_used: Array.from(this._featuresUsed),
      rendering_time_ms: this._getRenderDuration(),
      timestamp: Date.now(),
      ...additionalData
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

      const pipelineInstance = window.__msdDebug?.pipelineInstance;
      if (pipelineInstance?.systemsManager?.themeManager === this.themeManager) {
        return 'pipelineInstance.systemsManager.themeManager';
      }

      if (pipelineInstance?.themeManager === this.themeManager) {
        return 'pipelineInstance.themeManager';
      }

      const systemsManager = window.__msdDebug?.systemsManager;
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
   * Resolve style property using token system with fallback to defaults
   *
   * Handles token references and provides consistent fallback behavior.
   * If styleValue is set, uses it (resolving tokens if needed).
   * Otherwise resolves from token system or returns fallback.
   *
   * @protected
   * @param {*} styleValue - Value from style configuration
   * @param {string} tokenPath - Token path for resolution (e.g., 'colors.accent.primary')
   * @param {Function|null} resolveToken - Token resolver function
   * @param {*} fallback - Final fallback value
   * @param {Object} context - Scaling context for resolution
   * @returns {*} Resolved property value
   *
   * @example
   * const color = this._resolveStyleProperty(
   *   style.color,
   *   'colors.accent.primary',
   *   resolveToken,
   *   '#FF9900',
   *   context
   * );
   */
  _resolveStyleProperty(styleValue, tokenPath, resolveToken, fallback, context) {
    // If style value is explicitly set, use it
    if (styleValue !== undefined && styleValue !== null) {
      // Check if it's a token reference
      if (resolveToken && typeof styleValue === 'string' && this._isTokenReference(styleValue)) {
        // ✅ Track token resolution
        this._trackFeature('token_resolution');
        return resolveToken(styleValue, fallback, context);
      }
      return styleValue;
    }

    // Otherwise resolve from token system
    if (resolveToken) {
      // ✅ Track token resolution
      this._trackFeature('token_resolution');
      return resolveToken(tokenPath, fallback, context);
    }

    // Final fallback
    return fallback;
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
      const renderer = window.__msdDebug?.pipelineInstance?.systemsManager?.renderer;
      if (renderer?.mountEl) {
        this._logDebug('Resolved container from pipeline renderer');
        return renderer.mountEl;
      }

      // Method 2: From card instance shadow root
      const cardInstance = window.__msdDebug?.pipelineInstance?.cardInstance ||
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