/**
 * MSD Defaults Manager - Phase 1 Implementation
 * Handles layered defaults with viewBox-aware scaling for consistent visual appearance
 * across different SVG coordinate systems.
 *
 * @version 1.0.0
 * @author CB-LCARS MSD Team
 */

export class MsdDefaultsManager {
  constructor() {
    // Layered defaults storage: builtin → theme → pack → user
    this.layers = new Map([
      ['builtin', new Map()],
      ['theme', new Map()],
      ['pack', new Map()],
      ['user', new Map()]
    ]);

    // Performance caches
    this.scaleCache = new Map();
    this.unitCache = new Map();

    // Initialize built-in defaults
    this._registerBuiltinDefaults();
  }

  /**
   * Register system built-in defaults
   * @private
   */
  _registerBuiltinDefaults() {
    // Text defaults
    this.set('builtin', 'text.font_size', {
      value: 14,
      scale: 'viewbox',
      unit: 'px'
    });

    this.set('builtin', 'text.font_family', 'var(--lcars-font-family, Antonio)');

    this.set('builtin', 'text.line_height', {
      value: 1.2,
      scale: 'none',
      unit: 'em'
    });

    this.set('builtin', 'text.color', 'var(--lcars-white, #ffffff)');

    // Overlay defaults
    this.set('builtin', 'overlay.padding', {
      value: 8,
      scale: 'viewbox',
      unit: 'px'
    });

    // Sparkline defaults (for future expansion)
    this.set('builtin', 'sparkline.stroke_width', {
      value: 2,
      scale: 'viewbox',
      unit: 'px'
    });

    this.set('builtin', 'sparkline.color', 'var(--lcars-yellow, #ffcc00)');
  }

  /**
   * Resolve a default value with optional scaling context
   * @param {string} path - Dot-notation path to the default (e.g., 'text.font_size')
   * @param {Object} context - Scaling context
   * @param {Array} context.viewBox - [x, y, width, height] of SVG viewBox
   * @param {Element} context.containerElement - SVG container element
   * @param {string} context.scaleMode - Override scale mode ('none', 'viewbox', 'viewport', 'adaptive')
   * @param {string} context.preferredUnit - Preferred output unit
   * @returns {any} Resolved and scaled value
   */
  resolve(path, context = {}) {
    // Check layers in priority order: user > pack > theme > builtin
    for (const layer of ['user', 'pack', 'theme', 'builtin']) {
      const value = this.layers.get(layer).get(path);
      if (value !== undefined) {
        return this._processValue(value, context, path);
      }
    }

    console.warn(`MSD Defaults: No default found for path '${path}'`);
    return null;
  }

  /**
   * Process a value with scaling, unit conversion, and CSS variable resolution
   * @private
   */
  _processValue(value, context, path) {
    console.log(`[MsdDefaultsManager] Processing value for ${path}:`, {
      value,
      context,
      hasViewBox: !!context.viewBox,
      viewBoxValue: context.viewBox
    });

    // Handle CSS custom properties (var(--name))
    if (typeof value === 'string' && value.includes('var(')) {
      return this._resolveCssVariable(value);
    }

    // Handle scalable values (objects with value, scale, unit)
    if (value && typeof value === 'object' && 'value' in value) {
      const result = this._scaleAndConvertValue(value, context, path);
      console.log(`[MsdDefaultsManager] Scaled result for ${path}:`, result);
      return result;
    }

    // Return simple values as-is
    return value;
  }

  /**
   * Resolve CSS custom property
   * @private
   */
  _resolveCssVariable(value) {
    try {
      const cssVar = value.match(/var\(([^,)]+)(?:,([^)]+))?\)/);
      if (cssVar) {
        const [, varName, fallback] = cssVar;
        const resolved = getComputedStyle(document.documentElement)
          .getPropertyValue(varName).trim();
        return resolved || fallback || value;
      }
    } catch (e) {
      console.warn('MSD Defaults: Failed to resolve CSS variable:', value, e);
    }
    return value;
  }

  /**
   * Apply scaling and unit conversion to a value configuration
   * @private
   */
  _scaleAndConvertValue(config, context, path) {
    const { value, scale = 'none', unit = 'px' } = config;
    const scaleMode = context.scaleMode || scale;
    const preferredUnit = context.preferredUnit || unit;

    // Apply scaling
    let scaledValue = this._applyScaling(value, scaleMode, context);

    // Convert units if needed
    if (unit !== preferredUnit) {
      scaledValue = this._convertUnits(scaledValue, unit, preferredUnit, context);
    }

    // Format output with unit
    return this._formatValueWithUnit(scaledValue, preferredUnit);
  }

  /**
   * Apply scaling based on mode
   * @private
   */
  _applyScaling(value, scaleMode, context) {
    switch (scaleMode) {
      case 'viewbox':
        return this._applyViewBoxScaling(value, context);
      case 'viewport':
        return this._applyViewportScaling(value, context);
      case 'adaptive':
        return this._applyAdaptiveScaling(value, context);
      case 'none':
      default:
        return value;
    }
  }

  /**
   * Apply viewBox-relative scaling for visual consistency across different SVG sizes
   * @private
   */
  _applyViewBoxScaling(value, context) {
    if (!context.viewBox || !Array.isArray(context.viewBox) || context.viewBox.length < 4) {
      return value;
    }

    const scaleFactor = this._computeViewBoxScaleFactor(context.viewBox);

    if (Array.isArray(value)) {
      return value.map(v => typeof v === 'number' ? v * scaleFactor : v);
    } else if (typeof value === 'number') {
      return value * scaleFactor;
    }

    return value;
  }

  /**
   * Apply viewport-relative scaling (placeholder for now)
   * @private
   */
  _applyViewportScaling(value, context) {
    // For Phase 1, just return the value - viewport scaling is more complex
    // and requires DOM measurement
    return value;
  }

  /**
   * Apply adaptive scaling (smart choice between viewbox and viewport)
   * @private
   */
  _applyAdaptiveScaling(value, context) {
    // For Phase 1, default to viewBox scaling
    // Future: implement smart detection based on aspect ratios
    return this._applyViewBoxScaling(value, context);
  }

  /**
   * Compute scale factor from viewBox relative to a reference size
   * @private
   */
  _computeViewBoxScaleFactor(viewBox) {
    const cacheKey = `${viewBox.join(',')}`;
    if (this.scaleCache.has(cacheKey)) {
      return this.scaleCache.get(cacheKey);
    }

    const [, , width, height] = viewBox;

    // Reference viewBox - this is our "standard" size for 1.0x scaling
    const referenceWidth = 400;
    const referenceHeight = 300;

    // Compute scale factor - use the smaller of width/height scaling
    // to ensure content fits within the viewBox
    const scaleX = width / referenceWidth;
    const scaleY = height / referenceHeight;
    const scaleFactor = Math.min(scaleX, scaleY);

    this.scaleCache.set(cacheKey, scaleFactor);
    return scaleFactor;
  }

  /**
   * Convert between different CSS units (simplified for Phase 1)
   * @private
   */
  _convertUnits(value, fromUnit, toUnit, context) {
    if (fromUnit === toUnit) return value;

    // For Phase 1, only handle basic px <-> em conversions
    const baseFontSize = 16; // Standard browser default

    if (fromUnit === 'px' && toUnit === 'em') {
      return value / baseFontSize;
    } else if (fromUnit === 'em' && toUnit === 'px') {
      return value * baseFontSize;
    }

    // Return unchanged for unsupported conversions
    return value;
  }

  /**
   * Format value with appropriate unit suffix
   * @private
   */
  _formatValueWithUnit(value, unit) {
    if (Array.isArray(value)) {
      return value.map(v => typeof v === 'number' ? `${v}${unit}` : v);
    } else if (typeof value === 'number') {
      return `${value}${unit}`;
    }

    return value;
  }

  /**
   * Set a default value in a specific layer
   * @param {string} layer - Layer name ('builtin', 'theme', 'pack', 'user')
   * @param {string} path - Dot-notation path
   * @param {any} value - Default value (string or {value, scale, unit} object)
   */
  set(layer, path, value) {
    const layerMap = this.layers.get(layer);
    if (layerMap) {
      layerMap.set(path, value);
      // Clear caches when values change
      this.scaleCache.clear();
      this.unitCache.clear();
    } else {
      console.warn(`MSD Defaults: Unknown layer '${layer}'`);
    }
  }

  /**
   * Get a raw default value without processing (for debugging)
   * @param {string} layer - Layer name
   * @param {string} path - Dot-notation path
   * @returns {any} Raw value
   */
  getRaw(layer, path) {
    return this.layers.get(layer)?.get(path);
  }

  /**
   * Convenience method for resolving font sizes
   * @param {string} path - Path to font size default
   * @param {Object} context - Scaling context
   * @returns {string} Font size with unit (e.g., "16px")
   */
  resolveFontSize(path = 'text.font_size', context = {}) {
    return this.resolve(path, { ...context, preferredUnit: 'px' });
  }

  /**
   * Clear all caches (call when context changes significantly)
   */
  clearCaches() {
    this.scaleCache.clear();
    this.unitCache.clear();
  }

  /**
   * Get introspection data for debugging
   * @returns {Object} Current state of the defaults manager
   */
  getIntrospectionData() {
    const layerData = {};
    for (const [layerName, layer] of this.layers) {
      layerData[layerName] = Object.fromEntries(layer);
    }

    return {
      layers: layerData,
      cacheStats: {
        scaleCache: this.scaleCache.size,
        unitCache: this.unitCache.size
      }
    };
  }

  /**
   * Static method to create and initialize a global instance
   * @returns {MsdDefaultsManager} Initialized defaults manager
   */
  static createGlobalInstance() {
    const manager = new MsdDefaultsManager();

    // Attach to global CB-LCARS namespace (consistent with existing conventions)
    if (typeof window !== 'undefined') {
      window.cblcars = window.cblcars || {};
      window.cblcars.defaults = manager;
    }

    return manager;
  }
}

// Export default for convenience
export default MsdDefaultsManager;