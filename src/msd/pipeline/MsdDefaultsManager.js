/**
 * MSD Defaults Manager - Phase 1 Implementation
 * Handles layered defaults with optional viewBox-aware scaling for specific values
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

    // Note: Built-in defaults are now loaded from the 'core' pack via loadFromPacks()
    // This allows all defaults to be centralized in pack definitions
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
   * Load defaults from pack profiles with optional profile selection
   * @param {Array} packs - Array of pack objects to process
   * @param {string|Object} activeProfile - Profile selection strategy
   */
  loadFromPacks(packs, activeProfile = null) {
    if (!Array.isArray(packs)) return;

    packs.forEach(pack => {
      if (pack && pack.profiles && Array.isArray(pack.profiles)) {
        // Determine which profiles to load based on activeProfile setting
        const profilesToLoad = this._selectProfiles(pack.profiles, activeProfile, pack.id);

        profilesToLoad.forEach(profile => {
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
   * Select which profiles to load based on active profile configuration
   * @private
   * @param {Array} profiles - Available profiles in the pack
   * @param {string|Object} activeProfile - Profile selection strategy
   * @param {string} packId - Pack identifier
   * @returns {Array} Profiles to load
   */
  _selectProfiles(profiles, activeProfile, packId) {
    // If no active profile specified, load all profiles (current behavior)
    if (!activeProfile) {
      return profiles;
    }

    // String profile name - load that specific profile from all packs
    if (typeof activeProfile === 'string') {
      const matchedProfile = profiles.find(p => p.id === activeProfile);
      return matchedProfile ? [matchedProfile] : profiles; // Fallback to all if not found
    }

    // Object with per-pack profile selection
    if (typeof activeProfile === 'object' && activeProfile[packId]) {
      const requestedProfileId = activeProfile[packId];
      const matchedProfile = profiles.find(p => p.id === requestedProfileId);
      return matchedProfile ? [matchedProfile] : profiles; // Fallback to all if not found
    }

    // Default: load all profiles
    return profiles;
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

    // Determine target layer based on pack ID
    const targetLayer = packId === 'core' ? 'builtin' : 'pack';

    for (const [path, value] of Object.entries(flatDefaults)) {
      this.set(targetLayer, path, value);
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
  }

  /**
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