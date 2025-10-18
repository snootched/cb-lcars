import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * PackRegistry - Provides direct access to pack components (overlays, palettes, animations, etc.)
 *
 * This is separate from DefaultsManager and StylePresetManager.
 * Use this for accessing complete pack components that aren't defaults or style presets.
 *
 * Usage:
 *   packRegistry.getPalette('cb_lcars_buttons', 'default')
 *   packRegistry.getOverlays('core')
 *   packRegistry.getAnimations('lcars_fx')
 */
export class PackRegistry {
  constructor() {
    this.loadedPacks = [];
    this.packsById = new Map();
    this.initialized = false;
  }

  /**
   * Initialize with pack data
   * @param {Array} packs - Array of pack objects
   */
  async initialize(packs) {
    cblcarsLog.debug('[PackRegistry] 📦 Initializing with packs:', packs.map(p => p.id));

    this.loadedPacks = packs || [];
    this.packsById.clear();

    // Build pack lookup map
    for (const pack of this.loadedPacks) {
      this.packsById.set(pack.id, pack);
    }

    this.initialized = true;

    cblcarsLog.debug('[PackRegistry] ✅ Initialized pack registry:', {
      packCount: this.loadedPacks.length,
      packIds: Array.from(this.packsById.keys())
    });
  }

  /**
   * Get a pack by ID
   * @param {string} packId - Pack identifier
   * @returns {Object|null} Pack object or null if not found
   */
  getPack(packId) {
    if (!this.initialized) {
      cblcarsLog.warn('[PackRegistry] ⚠️ Not initialized - call initialize() first');
      return null;
    }

    return this.packsById.get(packId) || null;
  }

  /**
   * Get all loaded packs
   * @returns {Array} Array of pack objects
   */
  getAllPacks() {
    return [...this.loadedPacks];
  }

  /**
   * Get overlays from a specific pack
   * @param {string} packId - Pack identifier
   * @returns {Array} Array of overlay objects
   */
  getOverlays(packId) {
    const pack = this.getPack(packId);
    return pack?.overlays || [];
  }

  /**
   * Get all overlays from all packs
   * @returns {Array} Array of all overlay objects with pack info
   */
  getAllOverlays() {
    const allOverlays = [];

    for (const pack of this.loadedPacks) {
      if (pack.overlays && Array.isArray(pack.overlays)) {
        pack.overlays.forEach(overlay => {
          allOverlays.push({
            ...overlay,
            _packId: pack.id,
            _packVersion: pack.version
          });
        });
      }
    }

    return allOverlays;
  }

  /**
   * Get a specific palette from a pack
   * @param {string} packId - Pack identifier
   * @param {string} paletteName - Palette name
   * @returns {Object|null} Palette object or null if not found
   */
  getPalette(packId, paletteName) {
    const pack = this.getPack(packId);
    return pack?.palettes?.[paletteName] || null;
  }

  /**
   * Get all palettes from all packs
   * @returns {Object} Object with pack.palette structure
   */
  getAllPalettes() {
    const allPalettes = {};

    for (const pack of this.loadedPacks) {
      if (pack.palettes && typeof pack.palettes === 'object') {
        allPalettes[pack.id] = pack.palettes;
      }
    }

    return allPalettes;
  }

  /**
   * Get animations from a specific pack
   * @param {string} packId - Pack identifier
   * @returns {Array} Array of animation objects
   */
  getAnimations(packId) {
    const pack = this.getPack(packId);
    return pack?.animations || [];
  }

  /**
   * Get all animations from all packs
   * @returns {Array} Array of all animation objects with pack info
   */
  getAllAnimations() {
    const allAnimations = [];

    for (const pack of this.loadedPacks) {
      if (pack.animations && Array.isArray(pack.animations)) {
        pack.animations.forEach(animation => {
          allAnimations.push({
            ...animation,
            _packId: pack.id,
            _packVersion: pack.version
          });
        });
      }
    }

    return allAnimations;
  }

  /**
   * Get rules from a specific pack
   * @param {string} packId - Pack identifier
   * @returns {Array} Array of rule objects
   */
  getRules(packId) {
    const pack = this.getPack(packId);
    return pack?.rules || [];
  }

  /**
   * Get all rules from all packs
   * @returns {Array} Array of all rule objects with pack info
   */
  getAllRules() {
    const allRules = [];

    for (const pack of this.loadedPacks) {
      if (pack.rules && Array.isArray(pack.rules)) {
        pack.rules.forEach(rule => {
          allRules.push({
            ...rule,
            _packId: pack.id,
            _packVersion: pack.version
          });
        });
      }
    }

    return allRules;
  }

  /**
   * Get anchors from a specific pack
   * @param {string} packId - Pack identifier
   * @returns {Object} Anchors object
   */
  getAnchors(packId) {
    const pack = this.getPack(packId);
    return pack?.anchors || {};
  }

  /**
   * Get all anchors from all packs
   * @returns {Object} Merged anchors object
   */
  getAllAnchors() {
    const allAnchors = {};

    for (const pack of this.loadedPacks) {
      if (pack.anchors && typeof pack.anchors === 'object') {
        Object.assign(allAnchors, pack.anchors);
      }
    }

    return allAnchors;
  }

  /**
   * Get routing configuration from a specific pack
   * @param {string} packId - Pack identifier
   * @returns {Object} Routing configuration
   */
  getRouting(packId) {
    const pack = this.getPack(packId);
    return pack?.routing || {};
  }

  /**
   * Get all routing configurations from all packs
   * @returns {Object} Merged routing configuration
   */
  getAllRouting() {
    const allRouting = {};

    for (const pack of this.loadedPacks) {
      if (pack.routing && typeof pack.routing === 'object') {
        Object.assign(allRouting, pack.routing);
      }
    }

    return allRouting;
  }

  /**
   * Get chart templates from a specific pack
   * @param {string} packId - Pack identifier
   * @returns {Object} Chart templates object
   */
  getChartTemplates(packId) {
    const pack = this.getPack(packId);
    return pack?.chartTemplates || {};
  }

  /**
   * Get all chart templates from all packs
   * @returns {Object} Object with pack.template structure
   */
  getAllChartTemplates() {
    const allTemplates = {};

    for (const pack of this.loadedPacks) {
      if (pack.chartTemplates && typeof pack.chartTemplates === 'object') {
        allTemplates[pack.id] = pack.chartTemplates;
      }
    }

    return allTemplates;
  }

  /**
   * Get chart animation presets from a specific pack
   * @param {string} packId - Pack identifier
   * @returns {Object} Animation presets object
   */
  getChartAnimationPresets(packId) {
    const pack = this.getPack(packId);
    return pack?.chartAnimationPresets || {};
  }

  /**
   * Get all chart animation presets from all packs
   * @returns {Object} Object with pack.preset structure
   */
  getAllChartAnimationPresets() {
    const allPresets = {};

    for (const pack of this.loadedPacks) {
      if (pack.chartAnimationPresets && typeof pack.chartAnimationPresets === 'object') {
        allPresets[pack.id] = pack.chartAnimationPresets;
      }
    }

    return allPresets;
  }

  /**
   * Search for items across all packs
   * @param {string} type - Type to search for ('overlays', 'animations', 'rules', etc.)
   * @param {Function} predicate - Function to test each item
   * @returns {Array} Array of matching items with pack info
   */
  search(type, predicate) {
    const results = [];

    for (const pack of this.loadedPacks) {
      const items = pack[type];
      if (Array.isArray(items)) {
        items.forEach(item => {
          if (predicate(item)) {
            results.push({
              ...item,
              _packId: pack.id,
              _packVersion: pack.version
            });
          }
        });
      }
    }

    return results;
  }

  /**
   * Get debug information about loaded packs
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    const info = {
      initialized: this.initialized,
      packCount: this.loadedPacks.length,
      packDetails: []
    };

    info.packDetails = this.loadedPacks.map(pack => ({
      id: pack.id,
      version: pack.version,
      overlayCount: pack.overlays?.length || 0,
      animationCount: pack.animations?.length || 0,
      ruleCount: pack.rules?.length || 0,
      paletteCount: Object.keys(pack.palettes || {}).length,
      anchorCount: Object.keys(pack.anchors || {}).length,
      hasRouting: !!(pack.routing && Object.keys(pack.routing).length),
      chartTemplateCount: Object.keys(pack.chartTemplates || {}).length,
      animationPresetCount: Object.keys(pack.chartAnimationPresets || {}).length
    }));

    return info;
  }

  /**
   * Check if a pack is loaded
   * @param {string} packId - Pack identifier
   * @returns {boolean} True if pack is loaded
   */
  hasPackId(packId) {
    return this.packsById.has(packId);
  }

  /**
   * Get list of loaded pack IDs
   * @returns {Array} Array of pack IDs
   */
  getPackIds() {
    return Array.from(this.packsById.keys());
  }
}

// Make PackRegistry globally accessible for debugging
if (typeof window !== 'undefined') {
  window.PackRegistry = PackRegistry;
}