/**
 * @fileoverview ChartTemplateRegistry - Registry for reusable chart templates
 *
 * Manages chart templates loaded from packs, supporting template inheritance
 * and composition for DRY chart configurations.
 *
 * Features:
 * - Template registration from packs
 * - Template inheritance via 'extends' property
 * - Deep merge of template + overlay configurations
 * - Token reference support (resolved later by ApexChartsAdapter)
 *
 * @module msd/templates/ChartTemplateRegistry
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Registry for chart templates
 */
export class ChartTemplateRegistry {
  /**
   * Create ChartTemplateRegistry
   */
  constructor() {
    /** @type {Map<string, Object>} Template ID -> Template config */
    this.templates = new Map();

    /** @type {Map<string, Set<string>>} Pack ID -> Set of template IDs */
    this.packTemplates = new Map();
  }

  /**
   * Register a single chart template
   *
   * @param {string} id - Template identifier
   * @param {Object} config - Template configuration
   * @param {string} [packId='builtin'] - Pack identifier
   */
  register(id, config, packId = 'builtin') {
    this.templates.set(id, {
      ...config,
      _packId: packId,
      _templateId: id
    });

    // Track pack templates
    if (!this.packTemplates.has(packId)) {
      this.packTemplates.set(packId, new Set());
    }
    this.packTemplates.get(packId).add(id);

    cblcarsLog.debug(`[ChartTemplateRegistry] Registered template: ${id} (pack: ${packId})`);
  }

  /**
   * Register templates from a pack
   *
   * @param {string} packId - Pack identifier
   * @param {Object} chartTemplates - Chart templates object
   */
  registerFromPack(packId, chartTemplates) {
    if (!chartTemplates || typeof chartTemplates !== 'object') {
      cblcarsLog.warn(`[ChartTemplateRegistry] Invalid chartTemplates for pack: ${packId}`);
      return;
    }

    let count = 0;
    Object.entries(chartTemplates).forEach(([id, config]) => {
      this.register(id, config, packId);
      count++;
    });

    cblcarsLog.debug(`[ChartTemplateRegistry] Registered templates from pack: ${packId}`);
  }

  /**
   * Get template by ID with inheritance resolution
   *
   * @param {string} id - Template identifier
   * @returns {Object|null} Resolved template config (or null if not found)
   */
  get(id) {
    if (!this.templates.has(id)) {
      cblcarsLog.warn(`[ChartTemplateRegistry] Template not found: ${id}`);
      return null;
    }

    const template = this.templates.get(id);

    // Handle template inheritance via 'extends'
    if (template.extends) {
      const parent = this.get(template.extends);
      if (parent) {
        return this._mergeTemplates(parent, template);
      } else {
        cblcarsLog.warn(`[ChartTemplateRegistry] Parent template not found: ${template.extends}`);
        return template; // Return child without parent merge
      }
    }

    return template;
  }

  /**
   * Merge parent and child templates (child overrides parent)
   *
   * @private
   * @param {Object} parent - Parent template
   * @param {Object} child - Child template
   * @returns {Object} Merged template
   */
  _mergeTemplates(parent, child) {
    return {
      ...parent,
      ...child,
      style: this._deepMerge(parent.style || {}, child.style || {})
    };
  }

  /**
   * Apply template to overlay configuration
   *
   * Merges template into overlay, with overlay properties taking precedence.
   *
   * @param {Object} overlay - Overlay configuration
   * @returns {Object} Overlay with template applied
   */
  applyTemplate(overlay) {
    if (!overlay.template) {
      return overlay; // No template to apply
    }

    const template = this.get(overlay.template);
    if (!template) {
      cblcarsLog.warn(`[ChartTemplateRegistry] Template not found: ${overlay.template}`);
      return overlay; // Return unchanged
    }

    // Deep merge: template < overlay (overlay wins)
    const merged = {
      ...template,
      ...overlay,
      style: this._deepMerge(template.style || {}, overlay.style || {})
    };

    // Remove template metadata from merged result
    delete merged._packId;
    delete merged._templateId;
    delete merged.extends;

    cblcarsLog.debug(`[ChartTemplateRegistry] Applied template: ${overlay.template} to overlay: ${overlay.id}`);

    return merged;
  }

  /**
   * Deep merge objects (for style and chart_options)
   *
   * @private
   * @param {Object} target - Target object
   * @param {Object} source - Source object (takes precedence)
   * @returns {Object} Merged object
   */
  _deepMerge(target, source) {
    if (!this._isObject(target) || !this._isObject(source)) {
      return source;
    }

    const output = { ...target };

    Object.keys(source).forEach(key => {
      if (this._isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = this._deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });

    return output;
  }

  /**
   * Check if value is a plain object
   *
   * @private
   * @param {*} item - Value to check
   * @returns {boolean} True if plain object
   */
  _isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * List all available templates
   *
   * @param {string} [packId] - Optional pack filter
   * @returns {Array<Object>} Array of template info objects
   */
  listTemplates(packId = null) {
    const result = [];

    this.templates.forEach((config, id) => {
      if (!packId || config._packId === packId) {
        result.push({
          id: id,
          packId: config._packId,
          extends: config.extends || null,
          chartType: config.style?.chart_type || 'unknown'
        });
      }
    });

    return result;
  }

  /**
   * Clear all templates (for testing)
   */
  clear() {
    this.templates.clear();
    this.packTemplates.clear();
    cblcarsLog.debug('[ChartTemplateRegistry] Cleared all templates');
  }
}

// Global singleton instance
export const chartTemplateRegistry = new ChartTemplateRegistry();

// NEW: Make registry globally accessible for debugging
if (typeof window !== 'undefined') {
  // Safely create nested namespace structure
  window.cblcars = window.cblcars || {};
  window.cblcars.debug = window.cblcars.debug || {};
  window.cblcars.debug.msd = window.cblcars.debug.msd || {};

  // ✅ PHASE 4: Move to _internal namespace
  if (!window.cblcars.debug.msd.pipelineInstance) {
    window.cblcars.debug.msd.pipelineInstance = {};
  }
  if (!window.cblcars.debug.msd.pipelineInstance._internal) {
    window.cblcars.debug.msd.pipelineInstance._internal = {};
  }

  window.cblcars.debug.msd.pipelineInstance._internal.chartTemplateRegistry = chartTemplateRegistry;

  // ✅ PHASE 4: Deprecated - use pipelineInstance._internal.chartTemplateRegistry
  window.cblcars.debug.msd.chartTemplateRegistry = chartTemplateRegistry;

  // Add helper methods to window for easier console access
  window.cblcars.debug.msd.templates = {
    list: (packId) => chartTemplateRegistry.listTemplates(packId),
    get: (id) => chartTemplateRegistry.get(id),
    apply: (overlay) => chartTemplateRegistry.applyTemplate(overlay)
  };
}

