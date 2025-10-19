/**
 * @fileoverview Preset Manager for Style Resolver Service
 *
 * Manages style presets for overlay components.
 * Supports:
 * - Preset loading from configuration
 * - Preset inheritance
 * - Preset merging
 * - Preset validation
 *
 * @module msd/styles/PresetManager
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Preset Manager for style preset management
 *
 * Loads and manages style presets for different component types.
 *
 * @class PresetManager
 */
export class PresetManager {
  /**
   * Create a PresetManager instance
   *
   * @param {Object} presets - Preset configuration
   */
  constructor(presets = {}) {
    // Preset storage by component type
    this.presets = {
      text: {},
      button: {},
      line: {},
      status_grid: {},
      apexchart: {},
      ...presets
    };

    // Preset access count for statistics
    this.accessCount = {};

    this._loadPresets(presets);
  }

  /**
   * Get a preset by name and component type
   *
   * @param {string} presetName - Preset name
   * @param {string} componentType - Component type
   * @returns {Object|null} Preset styles or null if not found
   *
   * @example
   * const preset = presetManager.getPreset('lozenge', 'text');
   */
  getPreset(presetName, componentType) {
    if (!this.presets[componentType]) {
      cblcarsLog.warn('[PresetManager] Unknown component type:', componentType);
      return null;
    }

    const preset = this.presets[componentType][presetName];

    if (preset) {
      // Track access
      const key = `${componentType}:${presetName}`;
      this.accessCount[key] = (this.accessCount[key] || 0) + 1;

      // Handle preset inheritance
      if (preset.extends) {
        return this._mergePresets(preset, componentType);
      }

      return { ...preset };
    }

    return null;
  }

  /**
   * Add a preset
   *
   * @param {string} componentType - Component type
   * @param {string} presetName - Preset name
   * @param {Object} presetStyles - Preset style definition
   */
  addPreset(componentType, presetName, presetStyles) {
    if (!this.presets[componentType]) {
      this.presets[componentType] = {};
    }

    this.presets[componentType][presetName] = presetStyles;
    cblcarsLog.debug('[PresetManager] Added preset:', componentType, presetName);
  }

  /**
   * Check if a preset exists
   *
   * @param {string} presetName - Preset name
   * @param {string} componentType - Component type
   * @returns {boolean} True if preset exists
   */
  hasPreset(presetName, componentType) {
    return !!(this.presets[componentType] && this.presets[componentType][presetName]);
  }

  /**
   * Get all presets for a component type
   *
   * @param {string} componentType - Component type
   * @returns {Object} All presets for the component type
   */
  getPresetsForType(componentType) {
    return { ...(this.presets[componentType] || {}) };
  }

  /**
   * Get preset statistics
   *
   * @returns {Object} Preset statistics
   */
  getStats() {
    const stats = {
      totalPresets: 0,
      byType: {},
      mostUsed: []
    };

    // Count presets by type
    Object.keys(this.presets).forEach(type => {
      const count = Object.keys(this.presets[type]).length;
      stats.totalPresets += count;
      stats.byType[type] = count;
    });

    // Get most used presets
    const sorted = Object.entries(this.accessCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => {
        const [type, name] = key.split(':');
        return { type, name, accessCount: count };
      });

    stats.mostUsed = sorted;

    return stats;
  }

  /**
   * Load presets from configuration
   * @private
   */
  _loadPresets(presets) {
    // Load default presets
    this._loadDefaultPresets();

    // Merge with provided presets
    Object.keys(presets).forEach(componentType => {
      if (!this.presets[componentType]) {
        this.presets[componentType] = {};
      }

      Object.keys(presets[componentType]).forEach(presetName => {
        this.presets[componentType][presetName] = presets[componentType][presetName];
      });
    });

    cblcarsLog.debug('[PresetManager] Presets loaded');
  }

  /**
   * Load default LCARS presets
   * @private
   */
  _loadDefaultPresets() {
    // Text presets
    this.presets.text = {
      lozenge: {
        lcars_shape: 'lozenge',
        lcars_shape_fill: 'colors.ui.background',
        lcars_shape_stroke: 'colors.ui.border',
        lcars_shape_stroke_width: 2,
        color: 'colors.text.primary'
      },
      rounded: {
        lcars_shape: 'rounded',
        lcars_shape_fill: 'colors.ui.background',
        lcars_shape_stroke: 'colors.ui.border',
        lcars_shape_stroke_width: 2,
        color: 'colors.text.primary'
      },
      plain: {
        color: 'colors.text.primary',
        fontSize: 16
      }
    };

    // Button presets
    this.presets.button = {
      lozenge: {
        lcars_shape: 'lozenge',
        fill: 'colors.accent.primary',
        stroke: 'colors.accent.border',
        stroke_width: 2,
        color: 'colors.text.primary'
      },
      rounded: {
        lcars_shape: 'rounded',
        fill: 'colors.accent.primary',
        stroke: 'colors.accent.border',
        stroke_width: 2,
        color: 'colors.text.primary'
      }
    };
  }

  /**
   * Merge presets with inheritance
   * @private
   */
  _mergePresets(preset, componentType) {
    const result = { ...preset };

    // Remove extends property from result
    const extendsName = result.extends;
    delete result.extends;

    if (!extendsName) return result;

    // Get base preset
    const basePreset = this.presets[componentType][extendsName];
    if (!basePreset) {
      cblcarsLog.warn('[PresetManager] Base preset not found:', extendsName);
      return result;
    }

    // Recursively merge if base also extends
    const baseResolved = basePreset.extends
      ? this._mergePresets(basePreset, componentType)
      : { ...basePreset };

    // Merge: current preset overrides base
    return {
      ...baseResolved,
      ...result
    };
  }
}

export default PresetManager;