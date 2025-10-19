/**
 * @fileoverview Base Renderer Class for MSD Overlays
 *
 * Provides common functionality for all overlay renderers:
 * - ThemeManager integration and resolution
 * - Default value resolution with token support
 * - Scaling context management
 * - Consistent logging patterns
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
 * and common rendering utilities.
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
      return fallback;
    }

    // Convert path from 'componentType.property' to ThemeManager format
    // ThemeManager expects: getDefault(componentType, property, fallback)
    const pathParts = path.split('.');
    const componentType = pathParts[0];
    const property = pathParts.slice(1).join('.');

    try {
      const value = themeManager.getDefault(componentType, property, fallback);
      return value !== null ? value : fallback;
    } catch (error) {
      this._logWarn(`Error resolving theme default for ${path}:`, error);
      return fallback;
    }
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
        return resolveToken(styleValue, fallback, context);
      }
      return styleValue;
    }

    // Otherwise resolve from token system
    if (resolveToken) {
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