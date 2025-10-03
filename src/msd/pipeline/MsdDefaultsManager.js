/**
 * MSD Defaults Manager - Phase 1 Implementation
 * Handles layered    // Attachment point calculation defaults
    this.set('builtin', 'text.attachment.status_size_ratio', 0.3); // Status indicator size ratio for attachment calculations (matches main ratio)efaults with optional viewBox-aware scaling for specific values
 * that require scaling (like padding), while keeping most values simple for compatibility.
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
    // Text defaults - using simple values for better compatibility
    this.set('builtin', 'text.font_size', 14); // Simple numeric value, no auto-scaling
    this.set('builtin', 'text.font_family', 'var(--lcars-font-family, Antonio)');
    this.set('builtin', 'text.line_height', 1.2);
    this.set('builtin', 'text.color', 'var(--lcars-white, #ffffff)');
    this.set('builtin', 'text.fallback_font_size', 16); // Fallback when font size cannot be determined

    // Text decoration defaults
    this.set('builtin', 'text.status_indicator.size_ratio', 0.3); // Ratio of font size for status indicator
    this.set('builtin', 'text.status_indicator.padding', 8); // Pixels between text edge and indicator edge
    this.set('builtin', 'text.status_indicator.color', 'var(--lcars-green, #00ff00)'); // Default status indicator color
    this.set('builtin', 'text.highlight.padding', 2); // Pixels of padding around text for highlight
    this.set('builtin', 'text.highlight.opacity', 0.3); // Default highlight opacity

    // Text bracket defaults
    this.set('builtin', 'text.bracket.width', 2); // Default bracket stroke width
    this.set('builtin', 'text.bracket.gap', 4); // Default gap between text and bracket
    this.set('builtin', 'text.bracket.extension', 8); // Default bracket extension beyond text
    this.set('builtin', 'text.bracket.opacity', 1); // Default bracket opacity
    this.set('builtin', 'text.bracket.physical_width', 8); // Default physical bracket width
    this.set('builtin', 'text.bracket.height', '70%'); // Default bracket height as percentage
    this.set('builtin', 'text.bracket.radius', 4); // Default bracket corner radius
    this.set('builtin', 'text.bracket.border_radius', 8); // Default border radius for containers
    this.set('builtin', 'text.bracket.inner_factor', 2); // Default inner factor for hybrid mode

    // Text effect defaults
    this.set('builtin', 'text.effects.glow.blur', 3); // Default glow blur radius
    this.set('builtin', 'text.effects.glow.intensity', 1); // Default glow intensity
    this.set('builtin', 'text.effects.shadow.offset_x', 2); // Default shadow X offset
    this.set('builtin', 'text.effects.shadow.offset_y', 2); // Default shadow Y offset
    this.set('builtin', 'text.effects.shadow.blur', 2); // Default shadow blur
    this.set('builtin', 'text.effects.shadow.color', 'rgba(0,0,0,0.5)'); // Default shadow color

    // Text pattern defaults
    this.set('builtin', 'text.pattern.dots.size', 8); // Default dots pattern size
    this.set('builtin', 'text.pattern.lines.size', 4); // Default lines pattern size
    this.set('builtin', 'text.pattern.default.width', 10); // Default pattern width
    this.set('builtin', 'text.pattern.default.height', 10); // Default pattern height

    // Attachment point calculation defaults
    this.set('builtin', 'text.attachment.status_size_ratio', 0.3); // Status indicator size ratio for attachment calculations

    // Overlay defaults - keep scalable objects for padding that needs viewBox scaling
    this.set('builtin', 'overlay.padding', {
      value: 8,
      scale: 'viewbox',
      unit: 'px'
    });

    // Sparkline defaults
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

    return null;
  }

  /**
   * Process a value with scaling, unit conversion, and CSS variable resolution
   * @private
   */
  _processValue(value, context, path) {
    // Handle CSS custom properties (var(--name))
    if (typeof value === 'string' && value.includes('var(')) {
      return this._resolveCssVariable(value);
    }

    // Handle scalable values (objects with value, scale, unit)
    if (value && typeof value === 'object' && 'value' in value) {
      return this._scaleAndConvertValue(value, context, path);
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
      // Silent fallback for CSS variable resolution
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
      // Note: Unknown layer
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