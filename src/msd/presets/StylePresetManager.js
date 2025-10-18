import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * StylePresetManager - Handles style_presets from loaded packs
 *
 * This is separate from ThemeManage.
 * StylePresets are named style bundles that can be applied to overlays.
 *
 * Usage:
 *   stylePresetManager.getPreset('status_grid', 'lozenge')
 *   // Returns: { cell_radius: 12, text_padding: 10, ... }
 */
export class StylePresetManager {
  constructor() {
    this.loadedPacks = [];
    this.presetCache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize with pack data
   * @param {Array} packs - Array of pack objects
   */
  async initialize(packs) {
    cblcarsLog.debug('[StylePresetManager] 🎨 Initializing with packs:', packs.map(p => p.id));

    this.loadedPacks = packs || [];
    this.presetCache.clear();
    this.initialized = true;

    // Build cache for faster lookups
    this._buildPresetCache();

    cblcarsLog.debug('[StylePresetManager] ✅ Initialized with preset cache:', {
      packCount: this.loadedPacks.length,
      cacheSize: this.presetCache.size,
      availableTypes: this._getAvailableOverlayTypes()
    });
  }

  /**
   * Get a style preset for a specific overlay type
   * @param {string} overlayType - Type of overlay (e.g., 'status_grid', 'sparkline')
   * @param {string} presetName - Name of the preset (e.g., 'lozenge', 'bullet')
   * @returns {Object|null} Preset configuration or null if not found
   */
  getPreset(overlayType, presetName) {
    if (!this.initialized) {
      cblcarsLog.warn('[StylePresetManager] ⚠️ Not initialized - call initialize() first');
      return null;
    }

    const cacheKey = `${overlayType}.${presetName}`;

    // Check cache first
    if (this.presetCache.has(cacheKey)) {
      const cached = this.presetCache.get(cacheKey);
      cblcarsLog.debug(`[StylePresetManager] ✅ Found preset ${presetName} for ${overlayType} (cached from pack: ${cached.packId})`);
      return cached.preset;
    }

    // Not in cache - search through packs
    for (const pack of this.loadedPacks) {
      if (pack.style_presets && pack.style_presets[overlayType] && pack.style_presets[overlayType][presetName]) {
        const preset = pack.style_presets[overlayType][presetName];

        // Cache the result
        this.presetCache.set(cacheKey, { preset, packId: pack.id });

        cblcarsLog.debug(`[StylePresetManager] ✅ Found preset ${presetName} for ${overlayType} in pack ${pack.id}`);
        return preset;
      }
    }

    cblcarsLog.debug(`[StylePresetManager] ❌ Preset ${presetName} not found for ${overlayType}`);
    return null;
  }

  /**
   * Get all available presets for an overlay type
   * @param {string} overlayType - Type of overlay
   * @returns {Array} Array of preset names
   */
  getAvailablePresets(overlayType) {
    const presets = new Set();

    for (const pack of this.loadedPacks) {
      if (pack.style_presets && pack.style_presets[overlayType]) {
        Object.keys(pack.style_presets[overlayType]).forEach(name => presets.add(name));
      }
    }

    return Array.from(presets);
  }

  /**
   * Get all available overlay types that have presets
   * @returns {Array} Array of overlay type names
   */
  getAvailableOverlayTypes() {
    return this._getAvailableOverlayTypes();
  }

  /**
   * Check if a specific preset exists
   * @param {string} overlayType - Type of overlay
   * @param {string} presetName - Name of the preset
   * @returns {boolean} True if preset exists
   */
  hasPreset(overlayType, presetName) {
    return this.getPreset(overlayType, presetName) !== null;
  }

  /**
   * Get debug information about loaded presets
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    const info = {
      initialized: this.initialized,
      packCount: this.loadedPacks.length,
      cacheSize: this.presetCache.size,
      packDetails: [],
      presetsByType: {}
    };

    // Pack details
    info.packDetails = this.loadedPacks.map(pack => ({
      id: pack.id,
      version: pack.version,
      hasStylePresets: !!pack.style_presets,
      overlayTypes: pack.style_presets ? Object.keys(pack.style_presets) : []
    }));

    // Presets by type
    for (const overlayType of this._getAvailableOverlayTypes()) {
      info.presetsByType[overlayType] = this.getAvailablePresets(overlayType);
    }

    return info;
  }

  /**
   * Clear all cached presets (useful for hot-reloading)
   */
  clearCache() {
    this.presetCache.clear();
    cblcarsLog.debug('[StylePresetManager] 🧹 Preset cache cleared');
  }

  /**
   * Reinitialize with new pack data (useful for hot-reloading)
   * @param {Array} packs - New pack data
   */
  async reinitialize(packs) {
    cblcarsLog.debug('[StylePresetManager] 🔄 Reinitializing with new pack data');
    this.clearCache();
    await this.initialize(packs);
  }

  // Private methods

  /**
   * Build preset cache for faster lookups
   * @private
   */
  _buildPresetCache() {
    for (const pack of this.loadedPacks) {
      if (!pack.style_presets) continue;

      for (const [overlayType, presets] of Object.entries(pack.style_presets)) {
        for (const [presetName, preset] of Object.entries(presets)) {
          const cacheKey = `${overlayType}.${presetName}`;

          // Store with pack info for debugging
          this.presetCache.set(cacheKey, {
            preset,
            packId: pack.id,
            overlayType,
            presetName
          });
        }
      }
    }
  }

  /**
   * Get all available overlay types that have presets
   * @private
   * @returns {Array} Array of overlay type names
   */
  _getAvailableOverlayTypes() {
    const types = new Set();

    for (const pack of this.loadedPacks) {
      if (pack.style_presets) {
        Object.keys(pack.style_presets).forEach(type => types.add(type));
      }
    }

    return Array.from(types);
  }
}

// Make StylePresetManager globally accessible for debugging
if (typeof window !== 'undefined') {
  window.StylePresetManager = StylePresetManager;
}