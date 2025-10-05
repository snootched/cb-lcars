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
    this.set('builtin', 'sparkline.size.width', 200); // Default sparkline width
    this.set('builtin', 'sparkline.size.height', 60); // Default sparkline height
    this.set('builtin', 'sparkline.opacity', 1); // Default sparkline opacity
    this.set('builtin', 'sparkline.line_cap', 'round'); // Default line cap style
    this.set('builtin', 'sparkline.line_join', 'round'); // Default line join style
    this.set('builtin', 'sparkline.miter_limit', 4); // Default miter limit
    this.set('builtin', 'sparkline.path_precision', 2); // Default path precision for coordinates
    this.set('builtin', 'sparkline.fill_opacity', 0.2); // Default area fill opacity
    this.set('builtin', 'sparkline.point_size', 3); // Default data point marker size
    this.set('builtin', 'sparkline.decimation_threshold', 1000); // Default max points before decimation

    // Grid defaults for sparklines
    this.set('builtin', 'sparkline.grid.color', 'var(--lcars-gray, #666666)');
    this.set('builtin', 'sparkline.grid.opacity', 0.4);
    this.set('builtin', 'sparkline.grid.stroke_width', 1);
    this.set('builtin', 'sparkline.grid.horizontal_count', 3);
    this.set('builtin', 'sparkline.grid.vertical_count', 5);

    // Threshold line defaults
    this.set('builtin', 'sparkline.threshold.color', 'var(--lcars-orange, #ff9900)');
    this.set('builtin', 'sparkline.threshold.width', 1);
    this.set('builtin', 'sparkline.threshold.opacity', 0.7);

    // Zero line defaults
    this.set('builtin', 'sparkline.zero_line.color', 'var(--lcars-gray, #666666)');
    this.set('builtin', 'sparkline.zero_line.width', 1);
    this.set('builtin', 'sparkline.zero_line.opacity', 0.5);

    // Bracket defaults for sparklines
    this.set('builtin', 'sparkline.bracket.width', 2);
    this.set('builtin', 'sparkline.bracket.gap', 6);
    this.set('builtin', 'sparkline.bracket.extension', 8);
    this.set('builtin', 'sparkline.bracket.opacity', 1);
    this.set('builtin', 'sparkline.bracket.physical_width', 8);
    this.set('builtin', 'sparkline.bracket.radius', 4);
    this.set('builtin', 'sparkline.bracket.border_radius', 8);
    this.set('builtin', 'sparkline.bracket.inner_factor', 2);

    // Status indicator defaults
    this.set('builtin', 'sparkline.status_indicator.size', 4);
    this.set('builtin', 'sparkline.status_indicator.offset', 4);
    this.set('builtin', 'sparkline.status_indicator.color', 'var(--lcars-green, #00ff00)');

    // Animation defaults
    this.set('builtin', 'sparkline.scan_line.duration', 3); // Scan line animation duration in seconds
    this.set('builtin', 'sparkline.scan_line.width', 1);
    this.set('builtin', 'sparkline.scan_line.opacity', 0.8);

    // Chaikin smoothing defaults
    this.set('builtin', 'sparkline.smoothing.chaikin_iterations', 2);
    this.set('builtin', 'sparkline.smoothing.bezier_control_factor', 0.5);
    this.set('builtin', 'sparkline.smoothing.constrained_control_factor', 0.25);
    this.set('builtin', 'sparkline.smoothing.spline_segments', 10); // Segments between spline points

    // Value label defaults
    this.set('builtin', 'sparkline.value_label.offset_x', 4);
    this.set('builtin', 'sparkline.value_label.font_size_ratio', 0.1); // Ratio of width for font size
    this.set('builtin', 'sparkline.value_label.max_font_size', 12);
    this.set('builtin', 'sparkline.value_label.font_family', 'var(--lcars-font-family, Antonio)');

    // Enhanced status colors for different states
    this.set('builtin', 'sparkline.status.no_source.color', 'var(--lcars-red, #ff0000)');
    this.set('builtin', 'sparkline.status.loading.color', 'var(--lcars-blue, #0088ff)');
    this.set('builtin', 'sparkline.status.not_found.color', 'var(--lcars-orange, #ff9900)');
    this.set('builtin', 'sparkline.status.error.color', 'var(--lcars-red, #ff0000)');
    this.set('builtin', 'sparkline.status.font_size_ratio', 0.125); // Font size ratio for status text
    this.set('builtin', 'sparkline.status.min_width_for_source', 120); // Minimum width to show source name
    this.set('builtin', 'sparkline.status.stroke_width', 2);
    this.set('builtin', 'sparkline.status.opacity', 0.6);

    // Status Grid defaults
    // Core Grid Properties
    this.set('builtin', 'status_grid.rows', 3); // Number of rows
    this.set('builtin', 'status_grid.columns', 4); // Number of columns
    this.set('builtin', 'status_grid.cell_gap', 2); // Gap between cells
    this.set('builtin', 'status_grid.cell_color', 'var(--lcars-blue, #0088ff)'); // Default cell color
    this.set('builtin', 'status_grid.cell_opacity', 1.0); // Cell opacity
    this.set('builtin', 'status_grid.cell_radius', 2); // Corner radius

    // Border & Layout
    this.set('builtin', 'status_grid.border_color', 'var(--lcars-gray, #666666)'); // Border color
    this.set('builtin', 'status_grid.border_width', 1); // Border width
    this.set('builtin', 'status_grid.unknown_color', 'var(--lcars-gray, #666666)'); // Color for unknown states

    // Text Styling (Supports Scaling)
    this.set('builtin', 'status_grid.font_size', 12); // Base font size
    this.set('builtin', 'status_grid.label_font_size', {
      value: 18,
      scale: 'none', // Default to no scaling unless explicitly set
      unit: 'px'
    }); // Label font size - supports scaling
    this.set('builtin', 'status_grid.value_font_size', {
      value: 16,
      scale: 'none', // Default to no scaling unless explicitly set
      unit: 'px'
    }); // Value font size - supports scaling
    this.set('builtin', 'status_grid.font_family', 'var(--lcars-font-family, Antonio)'); // Font family
    this.set('builtin', 'status_grid.font_weight', 'normal'); // Font weight
    this.set('builtin', 'status_grid.label_color', 'var(--lcars-white, #ffffff)'); // Label text color
    this.set('builtin', 'status_grid.value_color', 'var(--lcars-white, #ffffff)'); // Value text color

    // Text Layout & Positioning
    this.set('builtin', 'status_grid.text_layout', 'stacked'); // Layout mode
    this.set('builtin', 'status_grid.text_alignment', 'center'); // Vertical alignment
    this.set('builtin', 'status_grid.text_justify', 'center'); // Horizontal justification
    this.set('builtin', 'status_grid.label_position', 'center-top'); // Label position
    this.set('builtin', 'status_grid.value_position', 'center-bottom'); // Value position
    this.set('builtin', 'status_grid.text_padding', {
      value: 8,
      scale: 'none', // Default to no scaling unless explicitly set
      unit: 'px'
    }); // Padding from cell edges - supports scaling
    this.set('builtin', 'status_grid.text_margin', 2); // Margin between text elements
    this.set('builtin', 'status_grid.max_text_width', '90%'); // Maximum text width
    this.set('builtin', 'status_grid.text_overflow', 'ellipsis'); // Overflow handling

    // Status Detection
    this.set('builtin', 'status_grid.status_mode', 'auto'); // Status detection mode

    // Grid Features
    this.set('builtin', 'status_grid.grid_line_color', 'var(--lcars-gray, #666666)'); // Grid line color
    this.set('builtin', 'status_grid.grid_line_opacity', 0.3); // Grid line opacity
    this.set('builtin', 'status_grid.grid_line_width', 1); // Grid line width

    // LCARS Features
    this.set('builtin', 'status_grid.bracket_color', null); // Bracket color (null = use primary color)
    this.set('builtin', 'status_grid.bracket_width', 2); // Bracket stroke width
    this.set('builtin', 'status_grid.bracket_gap', 4); // Distance from grid
    this.set('builtin', 'status_grid.bracket_extension', 8); // Bracket arm length
    this.set('builtin', 'status_grid.bracket_opacity', 1); // Bracket opacity
    this.set('builtin', 'status_grid.bracket_corners', 'both'); // Which corners
    this.set('builtin', 'status_grid.bracket_sides', 'both'); // Which sides
    this.set('builtin', 'status_grid.bracket_physical_width', 8); // Physical bracket width
    this.set('builtin', 'status_grid.bracket_height', '100%'); // Bracket height
    this.set('builtin', 'status_grid.bracket_radius', 4); // Bracket corner radius
    this.set('builtin', 'status_grid.border_radius', 8); // Container border radius
    this.set('builtin', 'status_grid.inner_factor', 2); // Inner spacing factor

    // Interaction
    this.set('builtin', 'status_grid.hover_color', 'var(--lcars-yellow, #ffcc00)'); // Hover color
    this.set('builtin', 'status_grid.hover_scale', 1.05); // Hover scale factor

    // Animation
    this.set('builtin', 'status_grid.cascade_speed', 0); // Cascade animation speed
    this.set('builtin', 'status_grid.cascade_direction', 'row'); // Cascade direction
    this.set('builtin', 'status_grid.reveal_animation', false); // Initial reveal animation
    this.set('builtin', 'status_grid.pulse_on_change', false); // Pulse on data change

    // Performance
    this.set('builtin', 'status_grid.update_throttle', 100); // Update throttling in ms
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
   * Load defaults from pack profiles
   * @param {Array} packs - Array of pack objects to process
   */
  loadFromPacks(packs) {
    if (!Array.isArray(packs)) return;

    packs.forEach(pack => {
      if (pack && pack.profiles && Array.isArray(pack.profiles)) {
        pack.profiles.forEach(profile => {
          if (profile.defaults) {
            this._processPackDefaults(profile.defaults, pack.id);
          }
        });
      }
    });

    // Clear caches after loading pack defaults
    this.clearCaches();
  }

  /**
   * Process defaults from a pack profile
   * @private
   * @param {Object} defaults - Defaults object from pack profile
   * @param {string} packId - Pack identifier for debugging
   */
  _processPackDefaults(defaults, packId) {
    // Flatten the defaults object into dot-notation paths
    const flatDefaults = this._flattenDefaults(defaults);

    for (const [path, value] of Object.entries(flatDefaults)) {
      this.set('pack', path, value);
    }
  }

  /**
   * Flatten nested defaults object into dot-notation paths
   * @private
   * @param {Object} obj - Object to flatten
   * @param {string} prefix - Current path prefix
   * @returns {Object} Flattened object with dot-notation keys
   */
  _flattenDefaults(obj, prefix = '') {
    const flattened = {};

    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value) && !('value' in value)) {
        // Nested object - recurse
        Object.assign(flattened, this._flattenDefaults(value, path));
      } else {
        // Leaf value - store it
        flattened[path] = value;
      }
    }

    return flattened;
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
   * Debug command: Display all defaults in console tables
   * Shows layered priority (user → pack → theme → builtin)
   * Usage: window.cblcars.defaults.debug()
   */
  debug() {
    console.log('[MsdDefaultsManager] 🎛️ CB-LCARS MSD Defaults Manager - Debug Starting...');

    try {
      console.group('[MsdDefaultsManager] 🎛️ CB-LCARS MSD Defaults Manager');

      // Show layer priority explanation
      console.log('[MsdDefaultsManager] 📋 Layer Priority: user → pack → theme → builtin (higher priority overrides lower)');
      console.log('');

      // Show each layer with counts
      const layerOrder = ['user', 'pack', 'theme', 'builtin'];
      let totalDefaults = 0;

      layerOrder.forEach(layerName => {
        const layer = this.layers.get(layerName);
        const entries = Array.from(layer.entries());
        const count = entries.length;
        totalDefaults += count;

        console.group(`[MsdDefaultsManager] ${this._getLayerIcon(layerName)} ${layerName.toUpperCase()} Layer (${count} defaults)`);

        if (count > 0) {
          // Convert to table-friendly format
          const tableData = entries.map(([path, value]) => ({
            'Path': path,
            'Value': this._formatValueForTable(value),
            'Type': this._getValueType(value)
          }));

          console.table(tableData);
        } else {
          console.log('[MsdDefaultsManager] (empty)');
        }

        console.groupEnd();
      });

      // Show cache statistics
      console.group('[MsdDefaultsManager] 📊 Cache Statistics');
      console.table({
        'Scale Cache': { 'Entries': this.scaleCache.size, 'Status': this.scaleCache.size > 0 ? '✅ Active' : '⚪ Empty' },
        'Unit Cache': { 'Entries': this.unitCache.size, 'Status': this.unitCache.size > 0 ? '✅ Active' : '⚪ Empty' }
      });
      console.groupEnd();

      // Show resolution examples
      console.group('[MsdDefaultsManager] 🔍 Resolution Examples');
      const examples = [
        'text.font_size',
        'text.status_indicator.color',
        'text.bracket.width',
        'sparkline.color'
      ];

      const exampleData = examples.map(path => {
        const resolved = this.resolve(path);
        return {
          'Path': path,
          'Resolved Value': resolved || '(not found)',
          'Source Layer': this._findSourceLayer(path) || '(none)'
        };
      });

      console.table(exampleData);
      console.groupEnd();

      // Summary
      console.log(`[MsdDefaultsManager] 📈 Summary: ${totalDefaults} total defaults across ${layerOrder.length} layers`);
      console.log('[MsdDefaultsManager] 💡 Tip: Use window.cblcars.defaults.resolve("path") to test resolution');

      console.groupEnd();

    } catch (error) {
      console.error('[MsdDefaultsManager] 🚨 Debug method failed:', error);
      console.groupEnd();
    }
  }  /**
   * Helper: Get icon for layer type
   * @private
   */
  _getLayerIcon(layerName) {
    const icons = {
      'user': '👤',
      'pack': '📦',
      'theme': '🎨',
      'builtin': '⚙️'
    };
    return icons[layerName] || '❓';
  }

  /**
   * Helper: Format value for table display
   * @private
   */
  _formatValueForTable(value) {
    if (typeof value === 'object' && value !== null) {
      if ('value' in value) {
        // Scalable object
        const { value: val, scale = 'none', unit = 'px' } = value;
        return `${val}${unit} (${scale})`;
      } else {
        // Other object
        return JSON.stringify(value);
      }
    } else if (typeof value === 'string' && value.length > 50) {
      // Truncate long strings
      return value.substring(0, 47) + '...';
    } else {
      return String(value);
    }
  }

  /**
   * Helper: Get value type for table display
   * @private
   */
  _getValueType(value) {
    if (typeof value === 'object' && value !== null && 'value' in value) {
      return 'Scalable';
    } else if (typeof value === 'string' && value.includes('var(')) {
      return 'CSS Variable';
    } else if (typeof value === 'string') {
      return 'String';
    } else if (typeof value === 'number') {
      return 'Number';
    } else if (Array.isArray(value)) {
      return 'Array';
    } else {
      return typeof value;
    }
  }

  /**
   * Helper: Find which layer provides a value
   * @private
   */
  _findSourceLayer(path) {
    for (const layer of ['user', 'pack', 'theme', 'builtin']) {
      if (this.layers.get(layer).has(path)) {
        return layer;
      }
    }
    return null;
  }
}

// Export default for convenience
export default MsdDefaultsManager;