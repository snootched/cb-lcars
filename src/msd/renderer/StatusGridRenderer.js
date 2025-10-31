/**
 * [StatusGridRenderer] Grid of independent button cells - CB-LCARS button card recreation in grid format
 * 🔲 Each cell can have full CB-LCARS styling with inheritance from grid defaults
 */

import { BaseRenderer } from './BaseRenderer.js';
import { OverlayUtils } from './OverlayUtils.js';
import { RendererUtils } from './RendererUtils.js';
import { DataSourceMixin } from './DataSourceMixin.js';
import { BracketRenderer } from './BracketRenderer.js';
import { ActionHelpers } from './ActionHelpers.js';
import { ButtonRenderer } from './core/ButtonRenderer.js'; // Add ButtonRenderer import
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';
import { TemplateProcessor } from '../utils/TemplateProcessor.js';



export class StatusGridRenderer extends BaseRenderer {
  constructor() {
    super();
    this.rendererName = 'StatusGridRenderer';

    // Connect to theme manager from global context
    this.themeManager = this._resolveThemeManager();
  }

  /**
   * Resolve style preset manager from various sources
   * @private
   * @returns {Object|null} Style preset manager instance
   */
  _resolveStylePresetManager() {
    // 1. Pipeline instance (preferred)
    const pipelineInstance = window.cblcars.debug.msd?.pipelineInstance;
    if (pipelineInstance?.systemsManager?.stylePresetManager) {
      cblcarsLog.debug('[StatusGridRenderer] ✅ Connected to theme manager via pipeline systemsManager');
      return pipelineInstance.systemsManager.stylePresetManager;
    }

    // 2. Systems manager global reference
    const systemsManager = window.cblcars.debug.msd?.systemsManager;
    if (systemsManager?.stylePresetManager) {
      cblcarsLog.debug('[StatusGridRenderer] ✅ Connected to theme manager via global systemsManager');
      return systemsManager.stylePresetManager;
    }

    cblcarsLog.debug('[StatusGridRenderer] ⚠️ No style preset manager found');
    return null;
  }

  // ============================================================================
  // 🎯 UNIFIED STYLE RESOLUTION SYSTEM - Token Resolution at Every Layer
  // ============================================================================

  /**
   * Unified entry point for complete status grid style resolution with token support at every layer
   *
   * This is the cornerstone of the refactored StatusGridRenderer architecture. It implements
   * proper style cascade with token resolution at each layer, ensuring that:
   * 1. Tokens are resolved at EVERY layer (not just at the end)
   * 2. Presets don't overwrite token-resolved values
   * 3. Priority is properly tracked
   * 4. Input objects are never mutated (immutable operations)
   *
   * Style Cascade Priority (Highest to Lowest):
   * - Layer 5: Cell.Specific (cell.style properties & direct cell properties)
   * - Layer 4: Cell.Preset (cell.lcars_button_preset)
   * - Layer 3: Overlay.Specific (overlay.style properties)
   * - Layer 2: Overlay.Preset (overlay.lcars_button_preset)
   * - Layer 1: Theme Defaults (ThemeManager values)
   *
   * Example Usage:
   * ```javascript
   * // Overlay-level resolution (no cell)
   * const overlayStyle = this._resolveCompleteStatusGridStyle(overlay, null, viewBox);
   *
   * // Cell-level resolution (includes all layers)
   * const cellStyle = this._resolveCompleteStatusGridStyle(overlay, cellConfig, viewBox);
   * ```
   *
   * Key Features:
   * - Token resolution at every layer via ThemeTokenResolver
   * - Smart merge logic with priority tracking
   * - Immutable operations (no mutation of input objects)
   * - Preset token support (presets can reference theme tokens)
   * - Comprehensive logging for debugging
   *
   * @private
   * @param {Object} overlay - Overlay configuration with styles and presets
   * @param {Object|null} cellConfig - Optional cell-specific configuration. If null, returns overlay-level style only.
   * @param {Array|null} viewBox - SVG viewBox [x, y, width, height] for responsive token resolution
   * @returns {Object} Complete resolved style with priority tracking metadata
   *
   * @example
   * // Grid with tokenized styles
   * overlay.style = {
   *   cell_color: 'colors.accent.primary',  // Token reference
   *   cell_radius: 8
   * };
   * const resolved = this._resolveCompleteStatusGridStyle(overlay, null, [0,0,800,600]);
   * // resolved.cell_color = 'var(--lcars-orange, #FF9900)'
   *
   * @example
   * // Cell overrides grid tokens
   * cellConfig.style = {
   *   cell_color: 'colors.status.critical'  // Cell token overrides grid token
   * };
   * const cellResolved = this._resolveCompleteStatusGridStyle(overlay, cellConfig, viewBox);
   * // cellResolved.cell_color = 'var(--lcars-red-alert, #CC0000)'
   */
  _resolveCompleteStatusGridStyle(overlay, cellConfig = null, viewBox = null) {
    cblcarsLog.trace('[StatusGridRenderer] 🎯 Starting unified style resolution', {
      overlayId: overlay?.id,
      cellId: cellConfig?.id,
      hasOverlayPreset: !!overlay?.style?.lcars_button_preset,
      hasCellPreset: !!cellConfig?.lcars_button_preset
    });

    // Store viewBox for token resolution
    this.viewBox = viewBox;

    // Initialize priority tracker
    const priorityTracker = {
      layers: new Set(),
      explicit: new Map(),  // property -> layer that set it explicitly
      computed: new Map()   // ADDED: property -> layer that computed it
    };

    // Layer 1: Theme Defaults (lowest priority)
    let resolvedStyle = this._getMSDDefaultsLayer(priorityTracker);

    // Layer 2: Overlay Preset (with token resolution)
    resolvedStyle = this._resolveOverlayPresetLayer(overlay, resolvedStyle, priorityTracker);

    // Layer 3: Overlay Styles (with token resolution)
    resolvedStyle = this._resolveOverlayStyleLayer(overlay, resolvedStyle, priorityTracker);

    // If no cell config, return overlay-level style
    if (!cellConfig) {
      resolvedStyle._priorityTracker = priorityTracker;
      cblcarsLog.trace('[StatusGridRenderer] ✅ Overlay-level style resolved', {
        layers: Array.from(priorityTracker.layers),
        explicitProperties: priorityTracker.explicit.size
      });
      return resolvedStyle;
    }

    // Layer 4: Cell Preset (with token resolution)
    resolvedStyle = this._resolveCellPresetLayer(cellConfig, resolvedStyle, priorityTracker);

    // Layer 5: Cell Styles (highest priority, with token resolution)
    resolvedStyle = this._resolveCellStyleLayer(cellConfig, resolvedStyle, priorityTracker);

    resolvedStyle._priorityTracker = priorityTracker;

    cblcarsLog.trace('[StatusGridRenderer] ✅ Complete cell style resolved', {
      cellId: cellConfig?.id,
      layers: Array.from(priorityTracker.layers),
      explicitProperties: priorityTracker.explicit.size
    });

    return resolvedStyle;
  }

  /**
   * Layer 1: Get MSD defaults from ThemeManager (lowest priority)
   *
   * This layer provides the foundational default values for all properties.
   * These defaults are resolved from the ThemeManager which may include
   * pack-provided defaults, theme defaults, or hard-coded fallbacks.
   *
   * All properties set at this layer are marked as 'computed' in the priority
   * tracker since they are derived values, not explicitly set by the user.
   *
   * @private
   * @param {Object} priorityTracker - Priority tracking object with layers, explicit, and computed maps
   * @returns {Object} Default style properties for status grid
   *
   * @example
   * const defaults = this._getMSDDefaultsLayer(tracker);
   * // defaults.cell_color = 'var(--lcars-blue)'
   * // defaults.cell_radius = 2
   * // tracker.computed.get('cell_color') = 'theme_defaults'
   */
  _getMSDDefaultsLayer(priorityTracker) {
    priorityTracker.layers.add('theme_defaults');

    const defaults = {
      // Grid layout defaults
      rows: this._getDefault('status_grid.rows', 3),
      columns: this._getDefault('status_grid.columns', 4),
      cell_gap: this._getDefault('status_grid.cell_gap', 2),
      cell_width: 0,  // 0 = auto
      cell_height: 0, // 0 = auto

      // Cell appearance defaults
      cell_color: this._getDefault('status_grid.cell_color', 'var(--lcars-blue)'),
      cell_opacity: this._getDefault('status_grid.cell_opacity', 1.0),
      cell_radius: this._getDefault('status_grid.cell_radius', 2),
      normalize_radius: true,
      match_ha_radius: true,

      // Border defaults
      cell_border: true,
      border_color: this._getDefault('status_grid.border_color', 'var(--lcars-gray)'),
      border_width: this._getDefault('status_grid.border_width', 1),

      // Text defaults
      show_labels: true,
      show_values: false,
      label_color: this._getDefault('status_grid.label_color', 'var(--lcars-white)'),
      value_color: this._getDefault('status_grid.value_color', 'var(--lcars-white)'),
      font_size: this._getDefault('status_grid.font_size', 18),
      font_family: this._getDefault('status_grid.font_family', 'var(--lcars-font-family, Antonio)'),
      font_weight: this._getDefault('status_grid.font_weight', 'normal'),
      label_font_size: this._getDefault('status_grid.label_font_size', 18),
      value_font_size: this._getDefault('status_grid.value_font_size', 16),

      // Positioning defaults
      text_padding: this._getDefault('status_grid.text_padding', 8),
      text_margin: this._getDefault('status_grid.text_margin', 2),
      label_position: 'center-top',
      value_position: 'center-bottom',

      // Feature defaults
      status_mode: 'auto',
      show_grid_lines: false
    };

    // Track all defaults as computed
    Object.keys(defaults).forEach(key => {
      priorityTracker.computed.set(key, 'theme_defaults');
    });

    cblcarsLog.trace('[StatusGridRenderer] 📦 Layer loaded', {
      propertyCount: Object.keys(defaults).length
    });

    return defaults;
  }

  /**
   * Layer 2: Resolve overlay preset with token resolution
   *
   * Applies overlay-level CB-LCARS button preset (e.g., 'lozenge', 'bullet', 'picard-filled').
   * The preset is loaded from StylePresetManager and all values undergo token resolution
   * before being applied to the base style.
   *
   * Key behaviors:
   * - Preset values are resolved for tokens BEFORE merging
   * - Only applies if no explicit value was set in higher priority layers
   * - All applied properties are marked as 'computed' (from preset)
   * - Creates new style object (immutable)
   *
   * @private
   * @param {Object} overlay - Overlay configuration with potential lcars_button_preset
   * @param {Object} baseStyle - Style from Layer 1 (Theme Defaults)
   * @param {Object} priorityTracker - Priority tracking object
   * @returns {Object} New merged style object with preset properties applied
   *
   * @example
   * // Preset can contain token references
   * overlay.style.lcars_button_preset = 'lozenge';
   * // Preset defines: { cell_color: 'colors.accent.tertiary', cell_radius: 12 }
   * const result = this._resolveOverlayPresetLayer(overlay, baseStyle, tracker);
   * // result.cell_color = 'var(--lcars-gold, #FFAA00)' (token resolved)
   */
  _resolveOverlayPresetLayer(overlay, baseStyle, priorityTracker) {
    const presetName = overlay?.style?.lcars_button_preset || overlay?.lcars_button_preset;

    if (!presetName) {
      cblcarsLog.trace('[StatusGridRenderer] ⏭️ Layer 2: No overlay preset');
      return { ...baseStyle };
    }

    priorityTracker.layers.add('overlay_preset');

    // Load preset from StylePresetManager
    const presetStyles = this._loadPresetFromStylePresetManager('status_grid', presetName);

    if (!presetStyles) {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Overlay preset '${presetName}' not found`);
      return { ...baseStyle };
    }

    cblcarsLog.trace('[StatusGridRenderer] 🎨 Layer 2: Applying overlay preset', {
      presetName,
      propertyCount: Object.keys(presetStyles).length
    });

    // Create new style object (immutable)
    const mergedStyle = { ...baseStyle };

    // Apply preset properties with token resolution
    Object.entries(presetStyles).forEach(([property, value]) => {
      // Resolve tokens in preset values
      const resolvedValue = this._resolveTokenValue(value, property);

      // Only apply if not already explicitly set
      if (!priorityTracker.explicit.has(property)) {
        mergedStyle[property] = resolvedValue;
        priorityTracker.computed.set(property, 'overlay_preset');

        cblcarsLog.trace(`[StatusGridRenderer] ✓ Preset set ${property}:`, {
          raw: value,
          resolved: resolvedValue,
          wasToken: value !== resolvedValue
        });
      }
    });

    return mergedStyle;
  }

  /**
   * Layer 3: Resolve overlay-specific styles with token resolution
   *
   * Applies user-specified styles from overlay.style and direct overlay properties.
   * This layer has higher priority than overlay presets and will override them.
   * All values undergo token resolution before being applied.
   *
   * Key behaviors:
   * - Processes overlay.style properties AND direct overlay properties (rows, columns)
   * - Resolves tokens in all property values
   * - Overrides both MSD defaults and overlay preset values
   * - Marks all applied properties as 'explicit' (user-specified)
   * - Creates new style object (immutable)
   *
   * @private
   * @param {Object} overlay - Overlay configuration with style object
   * @param {Object} baseStyle - Style from Layers 1-2 (Defaults + Overlay Preset)
   * @param {Object} priorityTracker - Priority tracking object
   * @returns {Object} New merged style object with overlay-specific properties
   *
   * @example
   * // User specifies tokenized color that overrides preset
   * overlay.style = {
   *   cell_color: 'colors.custom.myBlue',  // Overrides preset
   *   cell_radius: 16                        // Overrides preset
   * };
   * const result = this._resolveOverlayStyleLayer(overlay, baseStyle, tracker);
   * // result.cell_color = '#4488CC' (token resolved + override)
   * // tracker.explicit.get('cell_color') = 'overlay_style'
   */
  _resolveOverlayStyleLayer(overlay, baseStyle, priorityTracker) {
    priorityTracker.layers.add('overlay_style');

    const overlayStyle = overlay?.style || {};

    cblcarsLog.trace('[StatusGridRenderer] 🎨 Layer 3: Applying overlay styles', {
      propertyCount: Object.keys(overlayStyle).length,
      hasOverlayLevelPatch: overlay?._hasOverlayLevelPatch
    });

    // Create new style object (immutable)
    const mergedStyle = { ...baseStyle };

    // Also check direct overlay properties (rows, columns)
    const directProps = ['rows', 'columns'];
    directProps.forEach(prop => {
      if (overlay?.[prop] !== undefined) {
        const resolvedValue = this._resolveTokenValue(overlay[prop], prop);
        mergedStyle[prop] = resolvedValue;
        priorityTracker.explicit.set(prop, 'overlay_direct');

        cblcarsLog.trace(`[StatusGridRenderer] ✓ Overlay direct ${prop}:`, {
          raw: overlay[prop],
          resolved: resolvedValue
        });
      }
    });

    // Apply overlay.style properties with token resolution
    // CHANGED: Skip applying overlay-level patches that should only affect specific cells
    Object.entries(overlayStyle).forEach(([property, value]) => {
      if (value !== undefined && value !== null) {
        // ADDED: Check if this overlay has cell-specific patches
        // If so, don't cascade overlay-level styles to cells
        if (overlay._cellPatches && !overlay._hasOverlayLevelPatch) {
          // This overlay has cell-specific patches, so we're more selective
          // Only apply non-cell-specific properties at overlay level
          const cellSpecificProps = ['cell_color', 'cell_radius', 'cell_opacity', 'bracket_color', 'lcars_button_preset', 'text_layout'];
          if (cellSpecificProps.includes(property)) {
            // Removed excessive per-property debug logging
            return;
          }
        }

        // Resolve tokens
        const resolvedValue = this._resolveTokenValue(value, property);

        // Override previous layers (overlay.style > overlay.preset)
        mergedStyle[property] = resolvedValue;
        priorityTracker.explicit.set(property, 'overlay_style');

        // Removed excessive per-property debug logging (was logging 675 CSS properties!)
      }
    });

    return mergedStyle;
  }

  /**
   * Layer 4: Resolve cell preset with token resolution
   *
   * Applies cell-specific CB-LCARS button preset. This allows individual cells to have
   * different visual styles than the grid default. The preset is loaded from
   * StylePresetManager and all values undergo token resolution.
   *
   * Key behaviors:
   * - Only applies if cellConfig specifies lcars_button_preset
   * - Preset values are resolved for tokens BEFORE merging
   * - Overrides overlay preset but respects explicit overlay.style values
   * - All applied properties are marked as 'computed' (from cell preset)
   * - Creates new style object (immutable)
   *
   * Priority behavior:
   * - Overrides: Theme Defaults, Overlay Preset
   * - Can be overridden by: Overlay.Specific (explicit), Cell.Specific
   *
   * @private
   * @param {Object} cellConfig - Cell configuration with potential lcars_button_preset
   * @param {Object} baseStyle - Style from Layers 1-3 (Defaults + Overlay Preset + Overlay Style)
   * @param {Object} priorityTracker - Priority tracking object
   * @returns {Object} New merged style object with cell preset properties
   *
   * @example
   * // Cell has different preset than grid
   * cellConfig.lcars_button_preset = 'bullet';  // Grid has 'lozenge'
   * // Preset defines: { cell_color: 'colors.accent.secondary', label_position: 'left' }
   * const result = this._resolveCellPresetLayer(cellConfig, baseStyle, tracker);
   * // result.cell_color = 'var(--lcars-blue-alert, #5599FF)' (cell preset wins)
   */
  _resolveCellPresetLayer(cellConfig, baseStyle, priorityTracker) {
    const presetName = cellConfig?.lcars_button_preset || cellConfig?.style?.lcars_button_preset;

    if (!presetName) {
      cblcarsLog.trace('[StatusGridRenderer] ⏭️ Layer 4: No cell preset');
      return { ...baseStyle };
    }

    priorityTracker.layers.add('cell_preset');

    // Load preset from StylePresetManager
    const presetStyles = this._loadPresetFromStylePresetManager('status_grid', presetName);

    if (!presetStyles) {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Cell preset '${presetName}' not found`);
      return { ...baseStyle };
    }

    cblcarsLog.trace('[StatusGridRenderer] 🎨 Layer 4: Applying cell preset', {
      cellId: cellConfig?.id,
      presetName,
      propertyCount: Object.keys(presetStyles).length
    });

    // Create new style object (immutable)
    const mergedStyle = { ...baseStyle };

    // Apply preset properties with token resolution
    Object.entries(presetStyles).forEach(([property, value]) => {
      // Resolve tokens in preset values
      const resolvedValue = this._resolveTokenValue(value, property);

      // Cell preset overrides overlay styles (but respects explicit overlay settings)
      const currentPriority = priorityTracker.explicit.get(property);
      const shouldOverride = !currentPriority || currentPriority === 'overlay_preset';

      if (shouldOverride) {
        mergedStyle[property] = resolvedValue;
        priorityTracker.computed.set(property, 'cell_preset');

        // Removed excessive per-property debug logging
      }
    });

    return mergedStyle;
  }

  /**
   * Layer 5: Resolve cell-specific styles with token resolution (HIGHEST PRIORITY)
   *
   * Applies user-specified cell styles from cell.style and direct cell properties.
   * This is the final layer with the highest priority - it overrides everything.
   * All values undergo token resolution before being applied.
   *
   * Two sources of cell-specific values:
   * 1. cell.style object properties
   * 2. Direct cell properties (e.g., cell.color, cell.border_width)
   *
   * Key behaviors:
   * - Processes both cell.style properties AND direct cell properties
   * - Resolves tokens in all property values
   * - Overrides ALL previous layers (highest priority)
   * - Marks all applied properties as 'explicit' (cell_style or cell_direct)
   * - Creates new style object (immutable)
   *
   * @private
   * @param {Object} cellConfig - Cell configuration with style object and/or direct properties
   * @param {Object} baseStyle - Style from Layers 1-4 (Defaults + Presets + Overlay Styles)
   * @param {Object} priorityTracker - Priority tracking object
   * @returns {Object} Final merged style object with cell-specific properties (highest priority)
   *
   * @example
   * // Cell overrides everything with tokenized value
   * cellConfig.style = {
   *   cell_color: 'colors.status.active',  // Overrides all presets & overlay
   * };
   * cellConfig.border_width = 3;  // Direct property, same priority
   * const result = this._resolveCellStyleLayer(cellConfig, baseStyle, tracker);
   * // result.cell_color = 'var(--lcars-green, #00FF00)' (cell wins over everything)
   * // result.border_width = 3 (direct property)
   * // tracker.explicit.get('cell_color') = 'cell_style'
   * // tracker.explicit.get('border_width') = 'cell_direct'
   */
  _resolveCellStyleLayer(cellConfig, baseStyle, priorityTracker) {
    priorityTracker.layers.add('cell_style');

    const cellStyle = cellConfig?.style || {};

    // Create new style object (immutable)
    const mergedStyle = { ...baseStyle };

    // Apply rule patches first (these have highest priority)
    if (cellConfig._rulePatch) {
      Object.entries(cellConfig._rulePatch).forEach(([property, value]) => {
        if (value !== undefined && value !== null) {
          // Resolve tokens
          const resolvedValue = this._resolveTokenValue(value, property);

          // Rule patches override everything
          mergedStyle[property] = resolvedValue;
          priorityTracker.explicit.set(property, 'rule_patch');
        }
      });
    }

    // Apply cell.style properties with token resolution (highest priority after rules)
    Object.entries(cellStyle).forEach(([property, value]) => {
      if (value !== undefined && value !== null) {
        // Skip if already set by rule patch
        if (priorityTracker.explicit.get(property) === 'rule_patch') {
          return;
        }

        // Resolve tokens
        const resolvedValue = this._resolveTokenValue(value, property);

        // Cell.style has highest priority
        mergedStyle[property] = resolvedValue;
        priorityTracker.explicit.set(property, 'cell_style');
      }
    });

    // Apply direct cell properties (same priority as cell.style)
    Object.entries(cellConfig).forEach(([property, value]) => {
      if (value !== undefined && value !== null &&
          property !== 'style' &&
          property !== 'id' &&
          property !== 'position' &&
          property !== 'content' &&
          property !== 'label' &&
          property !== '_rulePatch') {
        // Skip if already set by rule patch
        if (priorityTracker.explicit.get(property) === 'rule_patch') {
          return;
        }

        // Resolve tokens
        const resolvedValue = this._resolveTokenValue(value, property);

        // Direct properties override cell.style
        mergedStyle[property] = resolvedValue;
        priorityTracker.explicit.set(property, 'cell_direct');
      }
    });

    return mergedStyle;
  }

  /**
   * Resolve a single token value with context
   *
   * This is the token resolution workhorse used by all layer methods.
   * It checks if a value is a token reference and resolves it via ThemeTokenResolver
   * with appropriate context (viewBox, property name, component scope).
   *
   * Token categories supported:
   * - colors.* (color palette tokens)
   * - typography.* (font, size, weight tokens)
   * - spacing.* (padding, margin, gap tokens)
   * - borders.* (width, radius tokens)
   * - effects.* (shadow, glow, blur tokens)
   * - animations.* (duration, easing tokens)
   * - components.* (component-specific tokens)
   *
   * Supports computed tokens:
   * - darken(color, 20%)
   * - lighten(color, 30%)
   * - alpha(color, 0.5)
   * - scale(value, 1.5)
   *
   * Supports responsive tokens:
   * - colors.accent.primary@small (viewBox-based variants)
   *
   * @private
   * @param {*} value - Value that may be a token reference (e.g., 'colors.accent.primary')
   * @param {string} property - Property name for debugging context
   * @returns {*} Resolved value (non-token values pass through unchanged)
   *
   * @example
   * const resolved = this._resolveTokenValue('colors.accent.primary', 'cell_color');
   * // Returns: 'var(--lcars-orange, #FF9900)'
   *
   * @example
   * const computed = this._resolveTokenValue('darken(colors.accent.primary, 20%)', 'border_color');
   * // Returns: 'color-mix(in srgb, var(--lcars-orange) 80%, black 20%)'
   *
   * @example
   * const passthrough = this._resolveTokenValue('#FF0000', 'cell_color');
   * // Returns: '#FF0000' (not a token, passes through)
   */
  _resolveTokenValue(value, property) {
    // Non-string values pass through
    if (typeof value !== 'string') {
      return value;
    }

    // Check if it's a token reference
    if (!this._isTokenReference(value)) {
      return value;
    }

    // Resolve via ThemeTokenResolver
    if (!themeTokenResolver) {
      cblcarsLog.debug(`[StatusGridRenderer] ⚠️ No token resolver available for ${property}`);
      return value;
    }

    // Create component-scoped resolver
    const resolveToken = themeTokenResolver.forComponent('statusGrid');

    // Resolve with viewBox context for responsive tokens
    const resolved = resolveToken(value, value, {
      viewBox: this.viewBox,
      property: property
    });

    return resolved;
  }

  // ============================================================================
  // INCREMENTAL UPDATE CAPABILITY (Phase 1)
  // ============================================================================

  /**
   * Check if this renderer supports incremental updates
   * @static
   * @returns {boolean} True - StatusGrid supports incremental updates
   */
  static supportsIncrementalUpdate() {
    return true;
  }

  /**
   * Perform incremental update on existing status grid
   * Updates cell styles and content without rebuilding entire grid DOM
   * @static
   * @param {Object} overlay - Overlay configuration with rule patches applied
   * @param {SVGElement} gridElement - Existing grid DOM element
   * @param {Object} context - Update context {dataSourceManager, systemsManager, hass}
   * @returns {boolean} True if update succeeded
   */
  static updateIncremental(overlay, gridElement, context) {
    cblcarsLog.debug(`[StatusGridRenderer] 🎨 INCREMENTAL UPDATE: ${overlay.id}`);

    try {
      // Use existing updateGridData method (already handles rule patches!)
      const updated = StatusGridRenderer.updateGridData(
        overlay,
        gridElement,
        context.dataSourceManager
      );

      if (updated) {
        cblcarsLog.debug(`[StatusGridRenderer] ✅ INCREMENTAL UPDATE SUCCESS: ${overlay.id} (smooth transitions preserved)`);
      } else {
        cblcarsLog.trace(`[StatusGridRenderer] ℹ️ INCREMENTAL UPDATE NO-OP: ${overlay.id} (no changes detected)`);
      }

      return updated;
    } catch (error) {
      cblcarsLog.error(`[StatusGridRenderer] ❌ INCREMENTAL UPDATE FAILED: ${overlay.id}`, error);
      return false; // Trigger fallback to full re-render
    }
  }

  // ============================================================================
  // RENDER METHODS
  // ============================================================================

  /**
   * Render a status grid overlay with comprehensive styling support
   * @param {Object} overlay - Status grid overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Object} cardInstance - Reference to custom-button-card instance for action handling
   * @returns {Object} Complete result object with markup, actionInfo, and overlayId
   */
  static render(overlay, anchors, viewBox, cardInstance = null) {
    // Return full result object for AdvancedRenderer to process actions
    return StatusGridRenderer.renderWithActions(overlay, anchors, viewBox, cardInstance);
  }

  /**
   * Render status grid with action metadata
   * @param {Object} overlay - Status grid overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Object} cardInstance - Reference to custom-button-card instance for action handling
   * @returns {Object} Object with markup, actionInfo, and overlayId
   * @static
   */
  static renderWithActions(overlay, anchors, viewBox, cardInstance = null) {
    // Create instance for non-static methods
    const instance = new StatusGridRenderer();

    // ✅ NEW: Start tracking
    instance._resetTracking();
    instance._startRenderTiming();

    const result = instance.renderStatusGrid(overlay, anchors, viewBox, cardInstance);

    // ✅ NEW: Add provenance to result
    if (result && result.markup) {
      result.provenance = instance._getRendererProvenance(overlay.id, {
        overlay_type: 'status_grid',
        cell_count: overlay.cells?.length || 0,
        preset_used: overlay.style?.lcars_button_preset || null
      });
    }

    // Return the result structure for AdvancedRenderer
    return result;
  }

  /**
   * Attach actions immediately using the same pattern as ButtonOverlay
   * @private
   * @static
   */
  static _attachActionsImmediately(overlayId, actionInfo) {
    // Try to find the grid element using the same search pattern as working overlays
    let gridElement = null;

    // Method 1: Use renderer mount element (same as ButtonOverlay)
    const renderer = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.renderer;
    if (renderer && renderer.mountEl) {
      const overlayGroup = renderer.mountEl.querySelector('#msd-overlay-container');
      if (overlayGroup) {
        gridElement = overlayGroup.querySelector(`[data-overlay-id="${overlayId}"]`);
      }
    }

    // Method 2: Card shadow DOM fallback
    if (!gridElement) {
      const card = window.cb_lcars_card_instance;
      if (card && card.shadowRoot) {
        gridElement = card.shadowRoot.querySelector(`[data-overlay-id="${overlayId}"]`);
      }
    }

    // Method 3: Document search (last resort)
    if (!gridElement) {
      gridElement = document.querySelector(`[data-overlay-id="${overlayId}"]`);
    }

    if (gridElement && actionInfo) {
      cblcarsLog.trace(`[StatusGridRenderer] 🎯 IMMEDIATE action attachment for ${overlayId}`);

      // CRITICAL: Use the proven ActionHelpers pattern
      if (actionInfo.cells && Array.isArray(actionInfo.cells)) {
        // Process each cell's actions individually using the same pattern as working buttons
        actionInfo.cells.forEach(cell => {
          if (cell.actions && (cell.actions.tap_action || cell.actions.hold_action || cell.actions.double_tap_action)) {
            // Find ALL elements for this cell (rect, text, etc.) - same as working pattern
            const cellElements = gridElement.querySelectorAll(`[data-cell-id="${cell.id}"]`);

            cellElements.forEach(cellElement => {
              // Use ActionHelpers individual cell attachment (proven to work)
              StatusGridRenderer._attachSingleCellActions(cellElement, cell.actions, actionInfo.cardInstance, cell.id);
            });
          }
        });
      }

      cblcarsLog.trace(`[StatusGridRenderer] ✅ Immediate action attachment completed for ${overlayId}`);
    } else {
      cblcarsLog.debug(`[StatusGridRenderer] ⚠️ Could not find grid element for immediate attachment: ${overlayId}`);
      // Store for later as fallback
      StatusGridRenderer._storeActionInfo(overlayId, actionInfo);
    }
  }

  /**
   * Attach actions to a single cell element using the proven ActionHelpers pattern
   * @private
   * @static
   */
  static _attachSingleCellActions(cellElement, actions, cardInstance, cellId) {
    if (!cellElement || !actions || !cardInstance) {
      cblcarsLog.warn(`[StatusGridRenderer] Missing parameters for single cell action attachment: ${cellId}`);
      return;
    }

    cblcarsLog.trace(`[StatusGridRenderer] 🔗 Attaching actions to single cell element ${cellId}:`, {
      elementType: cellElement.tagName,
      hasActions: !!actions,
      hasTapAction: !!actions.tap_action,
      hasCardInstance: !!cardInstance
    });

    // CRITICAL: Set pointer events and cursor (same as working buttons)
    cellElement.style.pointerEvents = 'visiblePainted';
    cellElement.style.cursor = 'pointer';

    // CRITICAL: Use the same event attachment pattern as working ActionHelpers
    if (actions.tap_action) {
      const actionHandler = (event) => {
        cblcarsLog.trace(`[StatusGridRenderer] 🎯 Cell tap action triggered for ${cellId}:`, actions.tap_action);

        // Prevent event bubbling
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Execute action via ActionHelpers bridge (same as working buttons)
        if (window.ActionHelpers && typeof window.ActionHelpers.executeActionViaButtonCardBridge === 'function') {
          window.ActionHelpers.executeActionViaButtonCardBridge(actions.tap_action, cardInstance, 'tap');
        } else {
          // Fallback to direct execution
          StatusGridRenderer._executeActionDirect(actions.tap_action, cardInstance);
        }

        return false;
      };

      // Add multiple event listeners for reliability (same as working pattern)
      cellElement.addEventListener('click', actionHandler, { capture: true, passive: false });
      cellElement.addEventListener('click', actionHandler, { capture: false, passive: false });
      cellElement.addEventListener('touchend', actionHandler, { capture: true, passive: false });
    }

    // Add hold action handler if present
    if (actions.hold_action) {
      StatusGridRenderer._attachHoldAction(cellElement, actions.hold_action, cardInstance);
    }

    // Add double-tap action handler if present
    if (actions.double_tap_action) {
      StatusGridRenderer._attachDoubleTapAction(cellElement, actions.double_tap_action, cardInstance);
    }

    // Mark as successfully attached
    cellElement.setAttribute('data-actions-attached', 'true');
    cellElement.setAttribute('data-action-attachment-time', Date.now().toString());

    cblcarsLog.trace(`[StatusGridRenderer] ✅ Single cell action attachment completed for ${cellId}`);
  }

  /**
   * Execute action directly as fallback
   * @private
   * @static
   */
  static _executeActionDirect(action, cardInstance) {
    try {
      if (cardInstance && typeof cardInstance._handleAction === 'function') {
        cardInstance._handleAction(action);
      } else if (cardInstance && typeof cardInstance.handleAction === 'function') {
        cardInstance.handleAction(action);
      } else {
        cblcarsLog.warn(`[StatusGridRenderer] No action handler available on card instance`);
      }
    } catch (error) {
      cblcarsLog.error(`[StatusGridRenderer] Error executing action directly:`, error);
    }
  }

  /**
   * Attach hold action using proven pattern
   * @private
   * @static
   */
  static _attachHoldAction(element, holdAction, cardInstance) {
    let holdTimer = null;
    let isHolding = false;

    const startHold = (event) => {
      isHolding = true;
      holdTimer = setTimeout(() => {
        if (isHolding) {
          event.preventDefault();
          event.stopPropagation();

          cblcarsLog.trace(`[StatusGridRenderer] ✋ Hold action triggered:`, holdAction);

          if (window.ActionHelpers && typeof window.ActionHelpers.executeActionViaButtonCardBridge === 'function') {
            window.ActionHelpers.executeActionViaButtonCardBridge(holdAction, cardInstance, 'hold');
          } else {
            StatusGridRenderer._executeActionDirect(holdAction, cardInstance);
          }
        }
      }, 500);
    };

    const endHold = () => {
      isHolding = false;
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    };

    element.addEventListener('mousedown', startHold);
    element.addEventListener('mouseup', endHold);
    element.addEventListener('mouseleave', endHold);
    element.addEventListener('touchstart', startHold);
    element.addEventListener('touchend', endHold);
    element.addEventListener('touchcancel', endHold);
  }

  /**
   * Attach double-tap action using proven pattern
   * @private
   * @static
   */
  static _attachDoubleTapAction(element, doubleTapAction, cardInstance) {
    let lastTap = 0;

    element.addEventListener('click', (event) => {
      const now = Date.now();
      const timeDiff = now - lastTap;

      if (timeDiff < 300 && lastTap > 0) {
        // Double-tap detected
        event.preventDefault();
        event.stopPropagation();

        cblcarsLog.trace(`[StatusGridRenderer] 🖱️🖱️ Double-tap action triggered:`, doubleTapAction);

        if (window.ActionHelpers && typeof window.ActionHelpers.executeActionViaButtonCardBridge === 'function') {
          window.ActionHelpers.executeActionViaButtonCardBridge(doubleTapAction, cardInstance, 'double_tap');
        } else {
          StatusGridRenderer._executeActionDirect(doubleTapAction, cardInstance);
        }

        lastTap = 0; // Reset to prevent triple-tap
      } else {
        lastTap = now;
      }
    });
  }

  /**
   * Instance method for comprehensive status grid rendering
   * @param {Object} overlay - Status grid overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Object} cardInstance - Reference to custom-button-card instance for action handling
   * @returns {Object} {markup, actionInfo, overlayId}
   */
  renderStatusGrid(overlay, anchors, viewBox, cardInstance = null) {
    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) {
      cblcarsLog.warn('[StatusGridRenderer] ⚠️ Status grid overlay position could not be resolved:', overlay.id);
      return { markup: '', actionInfo: null, overlayId: overlay.id };
    }

    const [x, y] = position;
    const size = overlay.size || [200, 150];
    const [width, height] = size;

    try {
      // Simple style approach: use overlay.style directly
      const style = overlay.style || {};
      const gridStyle = this._resolveStatusGridStyles(style, overlay.id, overlay);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      // Get cell configurations
      const cells = this._resolveCellConfigurations(overlay, gridStyle);
      cblcarsLog.trace(`[StatusGridRenderer] 🔲 Rendering cells for grid ${overlay.id}`);

      // Render status grid
      const gridMarkup = this._renderEnhancedStatusGrid(
        overlay, x, y, width, height, cells,
        gridStyle, animationAttributes
      );

      // CHANGED: Process actions using the new pattern
      const actionInfo = this._processStatusGridActions(overlay, cells, gridStyle, cardInstance);

      // Return new structure
      return {
        markup: gridMarkup,
        actionInfo: actionInfo,
        overlayId: overlay.id
      };

    } catch (error) {
      cblcarsLog.error(`[StatusGridRenderer] ❌ Rendering failed for status grid ${overlay.id}:`, error);
      return {
        markup: this._renderFallbackStatusGrid(overlay, x, y, width, height),
        actionInfo: null,
        overlayId: overlay.id
      };
    }
  }

  /**
   * Resolve comprehensive status grid styling from configuration
   * Now uses the unified style resolution system with token support at every layer
   * @private
   */
  _resolveStatusGridStyles(style, overlayId, overlay = null) {
    cblcarsLog.trace('[StatusGridRenderer] 🔄 Resolving grid styles using unified system', {
      overlayId,
      hasStyle: !!style,
      hasOverlay: !!overlay
    });

    // Use the new unified resolution system for overlay-level styles
    const resolvedStyle = this._resolveCompleteStatusGridStyle(overlay, null, this.viewBox);

    // Preserve the original overlay style for cascading to cells
    const originalOverlayStyle = overlay?.style || {};
    const overlayStyle = overlay?.style || style || {};

    // Parse all standard styles using unified system for effects
    const standardStyles = RendererUtils.parseAllStandardStyles(overlayStyle);

    // Build comprehensive grid style object
    const gridStyle = {
      // Core properties from unified resolution
      ...resolvedStyle,

      // Proportional sizing configuration
      row_sizes: overlayStyle.row_sizes || null,
      column_sizes: overlayStyle.column_sizes || null,
      row_heights: overlayStyle.row_heights || null,
      column_widths: overlayStyle.column_widths || null,

      // Calculated positioning helpers
      text_spacing: this._calculateSmartTextSpacing(resolvedStyle),
      label_offset_y: this._calculateSmartLabelOffset(resolvedStyle),
      value_offset_y: this._calculateSmartValueOffset(resolvedStyle),

      // Advanced layout options
      text_wrap: resolvedStyle.text_wrap || false,
      max_text_width: resolvedStyle.max_text_width || '90%',
      text_overflow: resolvedStyle.text_overflow || 'ellipsis',
      text_layout: resolvedStyle.text_layout || 'stacked',
      text_alignment: resolvedStyle.text_alignment || 'center',
      text_justify: resolvedStyle.text_justify || 'center',

      // Status configuration
      status_ranges: this._parseStatusRanges(resolvedStyle.status_ranges),
      unknown_color: standardStyles.colors?.disabledColor,

      // Effects from standard styles
      gradient: standardStyles.gradient,
      pattern: standardStyles.pattern,
      glow: standardStyles.glow,
      shadow: standardStyles.shadow,
      blur: standardStyles.blur,

      // LCARS-specific features
      bracket_style: overlayStyle.bracket_style || false,
      bracket_color: overlayStyle.bracket_color || standardStyles.colors?.primaryColor,
      bracket_width: Number(overlayStyle.bracket_width || 2),
      bracket_gap: Number(overlayStyle.bracket_gap || 4),
      bracket_extension: Number(overlayStyle.bracket_extension || 8),
      bracket_opacity: Number(overlayStyle.bracket_opacity || 1),
      bracket_corners: overlayStyle.bracket_corners || 'both',
      bracket_sides: overlayStyle.bracket_sides || 'both',
      bracket_physical_width: Number(overlayStyle.bracket_physical_width || overlayStyle.bracket_extension || 8),
      bracket_height: overlayStyle.bracket_height || '100%',
      bracket_radius: Number(overlayStyle.bracket_radius || 4),

      // LCARS container/border options
      border_top: Number(overlayStyle.border_top || 0),
      border_left: Number(overlayStyle.border_left || 0),
      border_right: Number(overlayStyle.border_right || 0),
      border_bottom: Number(overlayStyle.border_bottom || 0),
      border_radius: Number(overlayStyle.border_radius || 8),
      inner_factor: Number(overlayStyle.inner_factor || 2),
      hybrid_mode: overlayStyle.hybrid_mode || false,
      status_indicator: overlayStyle.status_indicator || false,
      lcars_corners: overlayStyle.lcars_corners || false,

      // Interaction
      hover_enabled: standardStyles.interaction?.hoverEnabled,
      hover_color: standardStyles.colors?.hoverColor || resolvedStyle.hover_color,
      hover_scale: standardStyles.interaction?.hoverScale,

      // Animation
      animatable: standardStyles.animation?.animatable,
      cascade_speed: standardStyles.animation?.cascadeSpeed,
      cascade_direction: standardStyles.animation?.cascadeDirection,
      reveal_animation: standardStyles.animation?.revealAnimation,
      pulse_on_change: standardStyles.animation?.pulseOnChange,

      // Actions
      actions: overlayStyle.actions || null,

      // Performance
      update_throttle: Number(overlayStyle.update_throttle || 100),

      // Track enabled features
      features: [],

      // Store references
      standardStyles,
      rawOverlayStyle: originalOverlayStyle,
      overlayStyle: overlayStyle
    };

    // Build feature list for conditional rendering
    if (gridStyle.gradient) gridStyle.features.push('gradient');
    if (gridStyle.pattern) gridStyle.features.push('pattern');
    if (gridStyle.status_ranges && gridStyle.status_ranges.length > 0) gridStyle.features.push('status-ranges');
    if (gridStyle.glow) gridStyle.features.push('glow');
    if (gridStyle.shadow) gridStyle.features.push('shadow');
    if (gridStyle.blur) gridStyle.features.push('blur');
    if (gridStyle.show_grid_lines) gridStyle.features.push('grid-lines');
    if (gridStyle.show_labels) gridStyle.features.push('labels');
    if (gridStyle.show_values) gridStyle.features.push('values');
    if (gridStyle.bracket_style) gridStyle.features.push('brackets');
    if (gridStyle.status_indicator) gridStyle.features.push('status');
    if (gridStyle.lcars_corners) gridStyle.features.push('lcars-corners');
    if (gridStyle.hover_enabled) gridStyle.features.push('hover');
    if (gridStyle.cascade_speed > 0) gridStyle.features.push('cascade');
    if (gridStyle.reveal_animation) gridStyle.features.push('reveal');
    if (gridStyle.pulse_on_change) gridStyle.features.push('pulse');
    if (gridStyle.actions) gridStyle.features.push('actions');
    if (gridStyle.lcars_button_preset) gridStyle.features.push('cb-button-preset');

    cblcarsLog.trace(`[StatusGridRenderer] 📊 Final gridStyle via unified system:`, {
      rows: gridStyle.rows,
      columns: gridStyle.columns,
      lcars_button_preset: gridStyle.lcars_button_preset,
      priorityLayers: resolvedStyle._priorityTracker ? Array.from(resolvedStyle._priorityTracker.layers) : [],
      explicitProperties: resolvedStyle._priorityTracker ? resolvedStyle._priorityTracker.explicit.size : 0,
      totalExpectedCells: gridStyle.rows * gridStyle.columns
    });

    return gridStyle;
  }

  /**
   * Check if a value is a token reference
   * @private
   * @param {string} value - Value to check
   * @returns {boolean} True if value is a token reference
   */
  _isTokenReference(value) {
    if (typeof value !== 'string') return false;
    const tokenCategories = ['colors', 'typography', 'spacing', 'borders', 'effects', 'animations', 'components'];
    return tokenCategories.some(category => value.startsWith(`${category}.`));
  }

  /**
   * Resolve all token references in style object
   * This runs BEFORE _resolveStatusGridStyles to ensure tokens are resolved early
   * @private
   * @param {Object} style - Style configuration with potential token references
   * @param {Object} overlay - Overlay configuration for context
   * @returns {Object} Style with all tokens resolved to actual values
   */
  _resolveTokensInStyle(style, overlay) {
    // Create component-scoped token resolver
    const resolveToken = themeTokenResolver ? themeTokenResolver.forComponent('statusGrid') : null;

    if (!resolveToken) {
      return style; // No token system, return unchanged
    }

    // Helper to resolve a single property
    const resolveProperty = (value) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'string' && this._isTokenReference(value)) {
          const resolved = resolveToken(value, value, { viewBox: this.viewBox });
          return resolved;
        }
      }
      return value;
    };

    // Resolve all style properties
    return {
      ...style,
      cell_color: resolveProperty(style.cell_color),
      cell_gap: resolveProperty(style.cell_gap),
      cell_radius: resolveProperty(style.cell_radius),
      cell_opacity: resolveProperty(style.cell_opacity),
      border_color: resolveProperty(style.border_color),
      border_width: resolveProperty(style.border_width),
      status_on_color: resolveProperty(style.status_on_color),
      status_off_color: resolveProperty(style.status_off_color),
      status_unavailable_color: resolveProperty(style.status_unavailable_color),
      status_unknown_color: resolveProperty(style.status_unknown_color),
      font_family: resolveProperty(style.font_family),
      font_size: resolveProperty(style.font_size),
      label_font_size: resolveProperty(style.label_font_size),
      value_font_size: resolveProperty(style.value_font_size),
      label_color: resolveProperty(style.label_color),
      value_color: resolveProperty(style.value_color),
      text_padding: resolveProperty(style.text_padding),
      hover_color: resolveProperty(style.hover_color)
    };
  }


  /**
   * Apply CB-LCARS button preset using StylePresetManager
   * @private
   * @param {Object} gridStyle - Grid style object to modify
   * @param {string} presetName - Name of the button preset
   * @param {Object} originalStyle - Original user style for checking explicit values
   */
  _applyButtonPreset(gridStyle, presetName, originalStyle = {}) {
    cblcarsLog.trace(`[StatusGridRenderer] 🎨 Applying CB-LCARS button preset: ${presetName}`);
    cblcarsLog.trace(`[StatusGridRenderer] �� Original style before preset:`, originalStyle);

    // Load preset from StylePresetManager
    const presetStyles = this._loadPresetFromStylePresetManager('status_grid', presetName);

    if (!presetStyles) {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Button preset '${presetName}' not found in StylePresetManager`);
      return;
    }

    cblcarsLog.debug(`[StatusGridRenderer] 📦 Loaded preset styles for '${presetName}':`, presetStyles);

    // Apply preset properties with user override protection
    this._applyPresetStyles(gridStyle, presetStyles, originalStyle);

    cblcarsLog.trace(`[StatusGridRenderer] ✅ Applied preset with ${Object.keys(presetStyles).length} properties`);
  }

  /**
   * Apply preset styles with user override protection
   * @private
   */
  _applyPresetStyles(gridStyle, presetStyles, originalStyle = {}) {
    Object.entries(presetStyles).forEach(([property, value]) => {
      // Only set value if user didn't explicitly provide it
      if (originalStyle[property] === undefined) {
        gridStyle[property] = value;
        cblcarsLog.trace(`[StatusGridRenderer] 📝 Preset set ${property}: ${value}`);
      } else {
        cblcarsLog.trace(`[StatusGridRenderer] 🚫 User explicit value for ${property}, skipping preset`);
      }
    });

    cblcarsLog.trace(`[StatusGridRenderer] ✅ Applied preset with user override protection`);
  }

  /**
   * Load preset from StylePresetManager
   * @private
   * @param {string} overlayType - Type of overlay (e.g., 'status_grid')
   * @param {string} presetName - Name of the preset
   * @returns {Object|null} Preset configuration or null if not found
   */
  _loadPresetFromStylePresetManager(overlayType, presetName) {
    const stylePresetManager = this._resolveStylePresetManager();

    if (stylePresetManager) {
      cblcarsLog.trace(`[StatusGridRenderer] 🔍 StylePresetManager found, checking for preset ${presetName}:`, {
        initialized: stylePresetManager.initialized,
        packCount: stylePresetManager.loadedPacks?.length,
        cacheSize: stylePresetManager.presetCache?.size
      });

      const preset = stylePresetManager.getPreset(overlayType, presetName);
      if (preset) {
        cblcarsLog.trace(`[StatusGridRenderer] ✅ Found preset via StylePresetManager`);
        return preset;
      } else {
        cblcarsLog.trace(`[StatusGridRenderer] ❌ StylePresetManager returned null for ${overlayType}.${presetName}`);
      }
    } else {
      cblcarsLog.trace(`[StatusGridRenderer] ❌ No StylePresetManager available`);
    }

    return null;
  }

  /**
   * Resolve individual cell styling with proper cascade hierarchy using unified system
   * Order: Theme Defaults → Overlay.Preset → Overlay.Specific → Cell.Preset → Cell.Specific
   * Now uses the unified token resolution system at every layer
   * @private
   * @param {Object} cellConfig - Individual cell configuration
   * @param {Object} gridStyle - Grid-level default styles (already includes overlay-level resolution)
   * @param {number} cellWidth - Calculated cell width
   * @param {number} cellHeight - Calculated cell height
   * @returns {Object} Complete cell styling with proper inheritance and token resolution
   */
  _resolveCellStyle(cellConfig, gridStyle, cellWidth, cellHeight) {
    // Create a minimal overlay object for the unified system
    // It will inherit from gridStyle which already has overlay-level resolution
    const overlayForCell = {
      id: gridStyle.overlayId || 'grid',
      style: gridStyle.rawOverlayStyle || {},
      lcars_button_preset: gridStyle.lcars_button_preset
    };

    // Use unified system to resolve complete cell style with all 5 layers
    const resolvedCellStyle = this._resolveCompleteStatusGridStyle(
      overlayForCell,
      cellConfig,
      this.viewBox
    );

    // Map resolved properties to cell style format
    const finalCellStyle = {
      // Visual properties
      color: resolvedCellStyle.cell_color,
      border_color: resolvedCellStyle.border_color,
      border_width: resolvedCellStyle.border_width,
      border_radius: resolvedCellStyle.cell_radius,
      opacity: resolvedCellStyle.cell_opacity,

      // Text styling
      label_color: resolvedCellStyle.label_color,
      value_color: resolvedCellStyle.value_color,
      font_size: resolvedCellStyle.font_size,
      font_family: resolvedCellStyle.font_family,
      font_weight: resolvedCellStyle.font_weight,
      label_font_size: resolvedCellStyle.label_font_size,
      value_font_size: resolvedCellStyle.value_font_size,

      // Positioning
      label_position: resolvedCellStyle.label_position,
      value_position: resolvedCellStyle.value_position,
      text_padding: resolvedCellStyle.text_padding,
      text_margin: resolvedCellStyle.text_margin,

      // CB-LCARS features
      lcars_button_preset: resolvedCellStyle.lcars_button_preset,
      lcars_text_preset: resolvedCellStyle.lcars_text_preset,
      bracket_style: resolvedCellStyle.bracket_style,
      bracket_color: resolvedCellStyle.bracket_color,

      // Control visibility
      show_labels: resolvedCellStyle.show_labels,
      show_values: resolvedCellStyle.show_values,

      // Store priority tracker for debugging
      _priorityTracker: resolvedCellStyle._priorityTracker
    };

    // Apply special cell radius resolution (respects normalization settings)
    finalCellStyle.border_radius = this._resolveCellRadius(cellConfig, gridStyle, cellWidth, cellHeight);

    // Parse through RendererUtils for full CB-LCARS support on final merged style
    const mergedConfigForRendererUtils = {
      ...gridStyle.rawOverlayStyle,
      ...(cellConfig.style || {}),
      ...cellConfig
    };
    const cellStandardStyles = RendererUtils.parseAllStandardStyles(mergedConfigForRendererUtils);

    // Override with any advanced features from RendererUtils
    finalCellStyle.gradient = cellStandardStyles.gradient;
    finalCellStyle.pattern = cellStandardStyles.pattern;
    finalCellStyle.glow = cellStandardStyles.glow;
    finalCellStyle.shadow = cellStandardStyles.shadow;
    finalCellStyle.blur = cellStandardStyles.blur;

    // Store for reference
    finalCellStyle.standardStyles = cellStandardStyles;
    finalCellStyle.mergedConfig = mergedConfigForRendererUtils;

    return finalCellStyle;
  }

  /**
   * Apply overlay.specific styles (step 2 of cascade)
   * @private
   */
  _applyOverlaySpecificStyles(baseStyle, overlayStyle) {
    const overlaySpecificStyle = { ...baseStyle };

    // Apply overlay.style properties that override overlay.preset
    Object.entries(overlayStyle).forEach(([property, value]) => {
      if (value !== undefined && value !== null) {
        // Map overlay properties to cell style properties
        switch (property) {
          case 'cell_color':
            overlaySpecificStyle.color = value;
            break;
          case 'cell_radius':
            overlaySpecificStyle.border_radius = value;
            break;
          case 'cell_opacity':
            overlaySpecificStyle.opacity = value;
            break;
          case 'border_color':
            overlaySpecificStyle.border_color = value;
            break;
          case 'border_width':
            overlaySpecificStyle.border_width = value;
            break;
          default:
            // Direct property mapping
            if (overlaySpecificStyle.hasOwnProperty(property)) {
              overlaySpecificStyle[property] = value;
            }
            break;
        }
      }
    });

    return overlaySpecificStyle;
  }

  /**
   * Apply cell.preset styles (step 3 of cascade)
   * @private
   */
  _applyCellPresetStyles(overlaySpecificStyle, cellConfig) {
    const cellPresetStyle = { ...overlaySpecificStyle };

    // Check if cell has its own preset
    const cellPresetName = cellConfig.lcars_button_preset || cellConfig.style?.lcars_button_preset;

    if (cellPresetName) {
      cblcarsLog.debug(`[StatusGridRenderer] 🎨 Applying cell preset "${cellPresetName}" to cell ${cellConfig.id || 'unknown'}`);

      const presetStyles = this._loadPresetFromStylePresetManager('status_grid', cellPresetName);

      if (presetStyles) {
        // Apply cell preset styles (overrides overlay.specific)
        Object.entries(presetStyles).forEach(([property, value]) => {
          if (value !== undefined && value !== null) {
            // Map preset properties to cell style properties
            switch (property) {
              case 'cell_color':
                cellPresetStyle.color = value;
                break;
              case 'cell_radius':
                cellPresetStyle.border_radius = value;
                break;
              case 'cell_opacity':
                cellPresetStyle.opacity = value;
                break;
              default:
                // Direct property mapping
                if (cellPresetStyle.hasOwnProperty(property)) {
                  cellPresetStyle[property] = value;
                }
                break;
            }
          }
        });

        cblcarsLog.debug(`[StatusGridRenderer] ✅ Applied cell preset ${cellPresetName} with ${Object.keys(presetStyles).length} properties`);
      }
    }

    return cellPresetStyle;
  }

  /**
   * Apply cell.specific styles (step 4 of cascade - highest priority)
   * @private
   */
  _applyCellSpecificStyles(cellPresetStyle, cellConfig, cellStyle) {
    const finalCellStyle = { ...cellPresetStyle };

    // Apply cell.style properties (override cell.preset)
    Object.entries(cellStyle).forEach(([property, value]) => {
      if (value !== undefined && value !== null) {
        // FIXED: Direct property mapping without transformation
        finalCellStyle[property] = value;
      }
    });

    // Apply cell direct properties (highest priority - override everything)
    Object.entries(cellConfig).forEach(([property, value]) => {
      if (value !== undefined && value !== null && property !== 'style' && property !== 'id') {
        // FIXED: Direct property mapping for all border properties
        finalCellStyle[property] = value;
      }
    });

    return finalCellStyle;
  }

  /**
   * Resolve cell border radius with inheritance and normalization
   * @private
   */
  _resolveCellRadius(cellConfig, gridStyle, cellWidth, cellHeight) {
    // Cell-specific radius takes precedence
    let radius = cellConfig.border_radius !== undefined ?
      Number(cellConfig.border_radius) : gridStyle.cell_radius;

    // Apply normalization if enabled at grid level
    if (gridStyle.normalize_radius && cellConfig.border_radius === undefined) {
      radius = this._calculateNormalizedRadius(cellWidth, cellHeight, radius, gridStyle.match_ha_radius);
    }

    return radius;
  }  /**
   * Calculate intelligent text spacing based on font sizes
   * @private
   * @param {Object} style - Style configuration
   * @returns {number} Calculated text spacing in pixels
   */
  _calculateSmartTextSpacing(style) {
    // If explicitly set, use that value
    if (style.text_spacing !== undefined) {
      return Number(style.text_spacing);
    }

    // Calculate based on font sizes
    const labelFontSize = Number(style.label_font_size || style.font_size || 18);
    const valueFontSize = Number(style.value_font_size || (labelFontSize * 0.9));

    // Use the larger font size as basis for spacing (prevents overlap)
    const maxFontSize = Math.max(labelFontSize, valueFontSize);

    // Intelligent spacing: 30% of the larger font size, minimum 4px
    return Math.max(4, Math.round(maxFontSize * 0.3));
  }

  /**
   * Calculate intelligent label positioning based on font size
   * @private
   * @param {Object} style - Style configuration
   * @returns {number} Calculated label offset in pixels
   */
  _calculateSmartLabelOffset(style) {
    // If explicitly set, use that value
    if (style.label_offset_y !== undefined) {
      return Number(style.label_offset_y);
    }

    const labelFontSize = Number(style.label_font_size || style.font_size || 18);
    const spacing = this._calculateSmartTextSpacing(style);

    // Position label above center by half spacing + 20% of font size
    return -(spacing * 0.5 + labelFontSize * 0.2);
  }

  /**
   * Calculate intelligent value positioning based on font size
   * @private
   * @param {Object} style - Style configuration
   * @returns {number} Calculated value offset in pixels
   */
  _calculateSmartValueOffset(style) {
    // If explicitly set, use that value
    if (style.value_offset_y !== undefined) {
      return Number(style.value_offset_y);
    }

    const valueFontSize = Number(style.value_font_size || (style.font_size || 18) * 0.9);
    const spacing = this._calculateSmartTextSpacing(style);

    // Position value below center by half spacing + 40% of font size
    return spacing * 0.5 + valueFontSize * 0.4;
  }

  /**
   * Parse status ranges configuration
   * @private
   */
  _parseStatusRanges(statusRanges) {
    if (!statusRanges || !Array.isArray(statusRanges)) return [];

    return statusRanges.map(range => ({
      min: Number(range.min ?? -Infinity),
      max: Number(range.max ?? Infinity),
      color: range.color || 'var(--lcars-blue)',
      label: range.label || null,
      // Support string matching too
      value: range.value || null,
      state: range.state || null
    }));
  }

  /**
   * Calculate text position based on enhanced positioning system
   * @private
   * @param {string|Object} position - Position specification ('center-top', 'bottom-left', or {x: '20%', y: '80%'})
   * @param {number} cellX - Cell X coordinate
   * @param {number} cellY - Cell Y coordinate
   * @param {number} cellWidth - Cell width
   * @param {number} cellHeight - Cell height
   * @param {Object} gridStyle - Grid styling configuration
   * @param {string} textType - 'label' or 'value' for context-aware positioning
   * @returns {Object} {x, y, anchor, baseline} positioning information
   */
  _calculateEnhancedTextPosition(position, cellX, cellY, cellWidth, cellHeight, gridStyle, textType = 'label') {
    const basePadding = gridStyle.text_padding || 8; // Increased default

    // Get effective cell radius and calculate smart padding
    const cornerRadius = this._getEffectiveCellRadius(gridStyle, cellWidth, cellHeight);
    const fontSize = textType === 'label' ? (gridStyle.label_font_size || 18) : (gridStyle.value_font_size || 16);
    const padding = this._calculateSmartPadding(basePadding, cornerRadius, fontSize);

    // Check if position is explicitly set (not from preset)
    const isExplicitPosition = position && (
      typeof position === 'object' ||
      (typeof position === 'string' && !['left', 'right', 'center'].includes(position))
    );

    // Handle LCARS presets ONLY if position is not explicitly set
    if (gridStyle.lcars_text_preset && !isExplicitPosition) {
      return this._calculateLCARSPresetPosition(gridStyle.lcars_text_preset, cellX, cellY, cellWidth, cellHeight, gridStyle, textType);
    }

    // Custom position object
    if (typeof position === 'object' && position !== null) {
      const x = this._parsePositionValue(position.x || '50%', cellWidth, cellX);
      const y = this._parsePositionValue(position.y || '50%', cellHeight, cellY);
      return {
        x: x + cellX,
        y: y + cellY,
        anchor: position.anchor || 'middle',
        baseline: position.baseline || 'middle'
      };
    }

    // Predefined position strings
    const positionMap = {
      // Center positions
      'center': { x: '50%', y: '50%', anchor: 'middle', baseline: 'middle' },
      'center-top': { x: '50%', y: padding + 'px', anchor: 'middle', baseline: 'hanging' },
      'center-bottom': { x: '50%', y: (cellHeight - padding) + 'px', anchor: 'middle', baseline: 'baseline' },

      // Corner positions (perfect for LCARS lozenge/bullet styles)
      'top-left': { x: padding + 'px', y: padding + 'px', anchor: 'start', baseline: 'hanging' },
      'top-right': { x: (cellWidth - padding) + 'px', y: padding + 'px', anchor: 'end', baseline: 'hanging' },
      'bottom-left': { x: padding + 'px', y: (cellHeight - padding) + 'px', anchor: 'start', baseline: 'baseline' },
      'bottom-right': { x: (cellWidth - padding) + 'px', y: (cellHeight - padding) + 'px', anchor: 'end', baseline: 'baseline' },

      // Edge centers
      'left': { x: padding + 'px', y: '50%', anchor: 'start', baseline: 'middle' },
      'right': { x: (cellWidth - padding) + 'px', y: '50%', anchor: 'end', baseline: 'middle' },
      'top': { x: '50%', y: padding + 'px', anchor: 'middle', baseline: 'hanging' },
      'bottom': { x: '50%', y: (cellHeight - padding) + 'px', anchor: 'middle', baseline: 'baseline' },

      // CB-LCARS specific positions for button card compatibility
      'south-east': { x: (cellWidth - padding) + 'px', y: (cellHeight - padding) + 'px', anchor: 'end', baseline: 'baseline' },
      'north-west': { x: padding + 'px', y: padding + 'px', anchor: 'start', baseline: 'hanging' },
      'south-west': { x: padding + 'px', y: (cellHeight - padding) + 'px', anchor: 'start', baseline: 'baseline' },
      'north-east': { x: (cellWidth - padding) + 'px', y: padding + 'px', anchor: 'end', baseline: 'hanging' },
    };

    const positionSpec = positionMap[position] || positionMap['center'];

    return {
      x: cellX + this._parsePositionValue(positionSpec.x, cellWidth, 0),
      y: cellY + this._parsePositionValue(positionSpec.y, cellHeight, 0),
      anchor: positionSpec.anchor,
      baseline: positionSpec.baseline
    };
  }

  /**
   * Get the effective corner radius that will be applied to a cell
   * @private
   * @param {Object} gridStyle - Grid styling configuration
   * @param {number} cellWidth - Cell width
   * @param {number} cellHeight - Cell height
   * @returns {number} Effective corner radius in pixels
   */
  _getEffectiveCellRadius(gridStyle, cellWidth, cellHeight) {
    let radius = gridStyle.cell_radius;

    // Apply radius normalization if enabled
    if (gridStyle.normalize_radius) {
      radius = this._calculateNormalizedRadius(cellWidth, cellHeight, radius, gridStyle.match_ha_radius);
    }

    return radius;
  }

  /**
   * Calculate intelligent padding that respects corner radius to prevent text cutoff
   * @private
   * @param {number} basePadding - Base padding value
   * @param {number} cornerRadius - Corner radius of the cell
   * @param {number} fontSize - Font size for text clearance
   * @returns {number} Adjusted padding value
   */
  _calculateSmartPadding(basePadding, cornerRadius, fontSize = 18) {
    // Ensure all inputs are valid numbers
    basePadding = Number(basePadding) || 8;
    cornerRadius = Number(cornerRadius) || 0;
    fontSize = Number(fontSize) || 18;

    // For rounded corners, we need extra padding to avoid text cutoff
    // The corner radius creates a "dead zone" where text shouldn't be placed

    // Calculate the "safe zone" distance from corner
    // This is roughly 70% of the radius (trigonometric approximation)
    const cornerClearance = cornerRadius * 0.7;

    // Add extra padding for font clearance (about 20% of font size)
    const fontClearance = fontSize * 0.2;

    // Use the larger of: base padding, corner clearance, or minimum for font
    const result = Math.max(basePadding, cornerClearance + fontClearance, fontSize * 0.3);

    // Ensure result is a valid number
    return isNaN(result) ? basePadding : result;
  }

  /**
   * Calculate LCARS preset positions (lozenge, bullet, etc.)
   * @private
   * @param {string} preset - LCARS preset name
   * @param {number} cellX - Cell X coordinate
   * @param {number} cellY - Cell Y coordinate
   * @param {number} cellWidth - Cell width
   * @param {number} cellHeight - Cell height
   * @param {Object} gridStyle - Grid styling configuration
   * @param {string} textType - 'label' or 'value'
   * @returns {Object} Position information
   */
  _calculateLCARSPresetPosition(preset, cellX, cellY, cellWidth, cellHeight, gridStyle, textType) {
    const basePadding = gridStyle.text_padding || 8; // Increased default to match main default
    const margin = gridStyle.text_margin || 2;

    // Get the actual corner radius that will be applied to this cell
    const cornerRadius = this._getEffectiveCellRadius(gridStyle, cellWidth, cellHeight);

    // Calculate smart padding that respects corner radius
    const fontSize = textType === 'label' ? (gridStyle.label_font_size || 18) : (gridStyle.value_font_size || 16);
    const smartPadding = this._calculateSmartPadding(basePadding, cornerRadius, fontSize);

    switch (preset) {
      case 'lozenge':
        // Lozenge style: label top-left, value bottom-right
        if (textType === 'label') {
          return {
            x: cellX + smartPadding,
            y: cellY + smartPadding + fontSize * 0.8,
            anchor: 'start',
            baseline: 'hanging'
          };
        } else {
          // Better responsive positioning for bottom-right value
          // Use proportional positioning instead of edge-based for better balance
          const proportionalY = cellY + cellHeight * 0.85; // 85% down from top, not edge-based
          return {
            x: cellX + cellWidth - smartPadding,
            y: proportionalY,
            anchor: 'end',
            baseline: 'baseline'
          };
        }

      case 'bullet':
        // Bullet style: label left, value right (side by side)
        if (textType === 'label') {
          return {
            x: cellX + smartPadding,
            y: cellY + cellHeight / 2,
            anchor: 'start',
            baseline: 'middle'
          };
        } else {
          return {
            x: cellX + cellWidth - smartPadding,
            y: cellY + cellHeight / 2,
            anchor: 'end',
            baseline: 'middle'
          };
        }

      case 'corner':
        // Corner style: both in south-east corner, stacked
        const cornerX = cellX + cellWidth - smartPadding;

        if (textType === 'label') {
          return {
            x: cornerX,
            y: cellY + cellHeight - smartPadding - fontSize - margin,
            anchor: 'end',
            baseline: 'baseline'
          };
        } else {
          return {
            x: cornerX,
            y: cellY + cellHeight - smartPadding,
            anchor: 'end',
            baseline: 'baseline'
          };
        }

      case 'badge':
        // Badge style: label top-center, value center
        if (textType === 'label') {
          return {
            x: cellX + cellWidth / 2,
            y: cellY + smartPadding + fontSize * 0.8,
            anchor: 'middle',
            baseline: 'hanging'
          };
        } else {
          return {
            x: cellX + cellWidth / 2,
            y: cellY + cellHeight / 2,
            anchor: 'middle',
            baseline: 'middle'
          };
        }

      default:
        // Fallback to center positioning
        return {
          x: cellX + cellWidth / 2,
          y: cellY + cellHeight / 2,
          anchor: 'middle',
          baseline: 'middle'
        };
    }
  }

  /**
   * Parse position value (percentage, pixel, or relative)
   * @private
   * @param {string|number} value - Position value ('50%', '10px', or number)
   * @param {number} dimension - Container dimension (width or height)
   * @param {number} offset - Base offset
   * @returns {number} Calculated position in pixels
   */
  _parsePositionValue(value, dimension, offset = 0) {
    // Ensure dimension is a valid number
    dimension = Number(dimension) || 100;

    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }

    const stringValue = String(value);

    if (stringValue.includes('%')) {
      const percentage = parseFloat(stringValue.replace('%', ''));
      const result = (dimension * percentage) / 100;
      return isNaN(result) ? 0 : result;
    }

    if (stringValue.includes('px')) {
      const result = parseFloat(stringValue.replace('px', ''));
      return isNaN(result) ? 0 : result;
    }

    // Try to parse as number
    const numValue = parseFloat(stringValue);
    return isNaN(numValue) ? 0 : numValue;
  }

  /**
   * Prepare animation attributes for anime.js integration
   * @private
   */
  _prepareAnimationAttributes(overlay, style) {
    const animationStyles = RendererUtils.parseStandardAnimationStyles(style);

    const animationAttributes = {
      gridAttributes: [],
      cellAttributes: [],
      hasAnimations: false
    };

    // Use standardized animation data attributes
    const animationDataAttrs = RendererUtils.createAnimationDataAttributes(animationStyles);
    if (animationDataAttrs) {
      animationAttributes.gridAttributes.push(animationDataAttrs);
      animationAttributes.hasAnimations = true;
    }

    return animationAttributes;
  }

  /**
   * Complete Status Grid rendering with all features
   * @private
   */
  _renderEnhancedStatusGrid(overlay, x, y, width, height, cells, gridStyle, animationAttributes) {
    // Calculate cell dimensions with proportional sizing support
    const { cellWidths, cellHeights } = this._calculateProportionalCellDimensions(width, height, gridStyle);
    const gap = gridStyle.cell_gap;

    // Check if overlay has actions (actions should now be preserved in main overlay by ModelBuilder)
    const hasActions = !!(overlay.tap_action || overlay.hold_action || overlay.double_tap_action || gridStyle.actions);

    // CRITICAL: Check if ANY cell has actions to determine grid container cursor
    const hasCellActions = cells.some(cell =>
      cell.actions && (cell.actions.tap_action || cell.actions.hold_action || cell.actions.double_tap_action)
    );

    // FIXED: Grid container should use 'visiblePainted' and 'pointer' cursor when cells have actions
    const gridPointerEvents = hasCellActions ? 'visiblePainted' : 'all';
    const gridCursor = hasCellActions ? 'pointer' : 'default';

    let gridMarkup = `<g id="${overlay.id}"
                data-overlay-id="${overlay.id}"
                data-overlay-type="status_grid"
                data-grid-rows="${gridStyle.rows}"
                data-grid-columns="${gridStyle.columns}"
                data-grid-features="${gridStyle.features.join(',')}"
                data-animation-ready="${!!animationAttributes.hasAnimations}"
                data-cascade-direction="${gridStyle.cascade_direction}"
                data-has-cell-actions="${hasCellActions}"
                style="pointer-events: ${gridPointerEvents}; cursor: ${gridCursor};"
                transform="translate(${x}, ${y})">`;

    cblcarsLog.trace(`[StatusGridRenderer] 🏗️ Building grid SVG with ${gridStyle.rows}x${gridStyle.columns} layout using ButtonRenderer`, {
      hasCellActions,
      gridPointerEvents,
      gridCursor
    });

    // Render grid background if enabled
    if (gridStyle.show_grid_lines) {
      gridMarkup += `<rect width="${width}" height="${height}"
                     fill="none" stroke="${gridStyle.grid_line_color}"
                     stroke-width="${gridStyle.grid_line_width}" opacity="${gridStyle.grid_line_opacity}"
                     style="pointer-events: none;"/>`;
    }

    // Render each cell using ButtonRenderer
    cells.forEach(cell => {
      // Calculate cell position using proportional sizing
      const cellX = this._calculateCellX(cell.col, cellWidths, gap);
      const cellY = this._calculateCellY(cell.row, cellHeights, gap);
      const cellWidth = cellWidths[cell.col];
      const cellHeight = cellHeights[cell.row];

      // Resolve complete cell styling with inheritance from grid defaults
      const cellStyle = this._resolveCellStyle(cell.config, gridStyle, cellWidth, cellHeight);

      // Debug: Check if this cell has specific actions
      const cellHasActions = !!(cell.actions && (cell.actions.tap_action || cell.actions.hold_action || cell.actions.double_tap_action));

      cblcarsLog.trace(`[StatusGridRenderer] 🔲 Rendering cell ${cell.id} using ButtonRenderer:`, {
        cellHasActions: cellHasActions,
        cellActions: cell.actions,
        position: [cellX, cellY],
        size: [cellWidth, cellHeight]
      });

      // Render cell using ButtonRenderer for consistency
      gridMarkup += this._renderGridCellWithButtonRenderer(
        cell, cellX, cellY, cellWidth, cellHeight, cellStyle, gridStyle, hasActions, cellHasActions
      );
    });

    gridMarkup += '</g>';

    // Add brackets around the entire grid if enabled
    if (gridStyle.bracket_style) {
      const bracketSvg = this._buildBrackets(width, height, gridStyle, overlay.id);
      if (bracketSvg) {
        gridMarkup = gridMarkup.slice(0, -4) + bracketSvg + '</g>'; // Insert before closing </g>
      }
    }

    return gridMarkup;
  }

  /**
   * Render grid cell using ButtonRenderer for consistency and enhanced features
   * @private
   */
  _renderGridCellWithButtonRenderer(cell, cellX, cellY, cellWidth, cellHeight, cellStyle, gridStyle, hasActions, cellHasActions) {
    // DEBUG: Log what we're actually passing to ButtonRenderer
    if (cell.id === 'bed_light_cell') {
      cblcarsLog.trace(`[StatusGridRenderer] 🔍 DEBUG style cascade:`, {
        cellConfig: cell.config,
        resolvedCellStyle: cellStyle,
        hasIndividualBorders: !!(cellStyle.border_top || cellStyle.border_right || cellStyle.border_bottom || cellStyle.border_left),
        hasIndividualRadius: !!(cellStyle.border_radius_top_left !== undefined || cellStyle.border_radius_top_right !== undefined),
        borderTop: cellStyle.border_top,
        borderRadiusTopLeft: cellStyle.border_radius_top_left,
        cellHasActions: cellHasActions
      });
    }

    // CRITICAL: Ensure the cellStyle includes action information for ButtonRenderer
    if (cellHasActions) {
      cellStyle.actions = true; // Signal to ButtonRenderer that this button has actions
      if (!cellStyle.standardStyles) {
        cellStyle.standardStyles = {};
      }
      if (!cellStyle.standardStyles.interaction) {
        cellStyle.standardStyles.interaction = {};
      }
      cellStyle.standardStyles.interaction.hasActions = true;
    }

    // Prepare button configuration for ButtonRenderer
    const buttonConfig = {
      id: cell.id,
      row: cell.row,
      col: cell.col,
      label: cell.label,
      content: cell.content,
      tap_action: cell.actions?.tap_action || null,
      hold_action: cell.actions?.hold_action || null,
      double_tap_action: cell.actions?.double_tap_action || null,
      // Store raw content for updates
      _raw: cell._raw || cell.config,
      _originalContent: cell._originalContent
    };

    // CRITICAL: Log action configuration for debugging
    if (cellHasActions) {
      cblcarsLog.trace(`[StatusGridRenderer] 🎯 Cell has actions:`, {
        tap_action: buttonConfig.tap_action,
        hold_action: buttonConfig.hold_action,
        double_tap_action: buttonConfig.double_tap_action,
        cellStyleHasActions: cellStyle.actions,
        interactionHasActions: cellStyle.standardStyles?.interaction?.hasActions
      });
    }

    // CRITICAL: Use the SAME action processing path as standalone buttons
    // Pass cardInstance to ButtonRenderer so it can use the same action processing
    const result = ButtonRenderer.render(
      buttonConfig,
      cellStyle,
      { width: cellWidth, height: cellHeight },
      { x: cellX, y: cellY },
      {
        cellId: cell.id,
        gridContext: true, // Important: this is a grid cell context
        cardInstance: this._resolveCardInstance(),
        hasActions: cellHasActions // Pass action flag to ButtonRenderer
      }
    );

    return result.markup;
  }

  /**
   * Resolve card instance for action handling
   * @private
   */
  _resolveCardInstance() {
    // Try various methods to get the card instance
    if (window.cblcars.debug.msd?.pipelineInstance?.cardInstance) {
      return window.cblcars.debug.msd.pipelineInstance.cardInstance;
    }

    if (window._msdCardInstance) {
      return window._msdCardInstance;
    }

    if (window.cb_lcars_card_instance) {
      return window.cb_lcars_card_instance;
    }

    return null;
  }

  /**
   * Resolve card instance for action handling from global context
   * @private
   * @static
   */
  static _resolveCardInstance() {
    // Try various methods to get the card instance

    // Method 1: From MSD pipeline if available
    if (window.cblcars.debug.msd?.pipelineInstance?.cardInstance) {
      return window.cblcars.debug.msd.pipelineInstance.cardInstance;
    }

    // Method 2: From global MSD context
    if (window._msdCardInstance) {
      return window._msdCardInstance;
    }

    // Method 3: From CB-LCARS global context
    if (window.cb_lcars_card_instance) {
      return window.cb_lcars_card_instance;
    }

    cblcarsLog.debug(`[StatusGridRenderer] Could not resolve card instance from global context`);
    return null;
  }

  /**
   * Set the global card instance for action handling
   * @param {Object} cardInstance - The custom-button-card instance
   * @static
   */
  static setCardInstance(cardInstance) {
    window._msdCardInstance = cardInstance;
    cblcarsLog.debug(`[StatusGridRenderer] Card instance set for action handling`);
  }

  // Cell configuration resolution with DataSource integration
  _resolveCellConfigurations(overlay, gridStyle) {
    const cells = [];

    // Check multiple sources for cells configuration
    const cellsConfig = overlay.cells || overlay._raw?.cells || overlay.raw?.cells;

    cblcarsLog.trace(`[StatusGridRenderer] 🔍 Resolving cells for ${gridStyle.rows}x${gridStyle.columns} grid:`, {
      gridDimensions: `${gridStyle.rows}x${gridStyle.columns}`,
      totalExpectedCells: gridStyle.rows * gridStyle.columns,
      explicitCellsProvided: cellsConfig ? cellsConfig.length : 0,
      cellsConfigSource: cellsConfig ? 'explicit' : 'generated'
    });

    // Use explicit cell definitions if provided
    if (cellsConfig && Array.isArray(cellsConfig)) {
      cblcarsLog.trace(`[StatusGridRenderer] 🔍 Processing explicit cells for ${gridStyle.rows}x${gridStyle.columns} grid`);

      cellsConfig.forEach((cellConfig, index) => {
        // Calculate position based on grid dimensions, not array index
        const totalCells = gridStyle.rows * gridStyle.columns;

        // Get raw content and resolve it
        const rawCellContent = this._getCellContentFromSources(cellConfig);
        const cellContent = this._resolveCellContent(rawCellContent);

        // Debug: Log cell config parsing
        const cellActions = {
          tap_action: cellConfig.tap_action || null,
          hold_action: cellConfig.hold_action || null,
          double_tap_action: cellConfig.double_tap_action || null
        };

        // Calculate row/col position based on grid dimensions
        let row, col;
        if (cellConfig.position && Array.isArray(cellConfig.position) && cellConfig.position.length === 2) {
          // Explicit position provided
          row = cellConfig.position[0];
          col = cellConfig.position[1];
        } else {
          // Calculate position based on index and grid dimensions
          if (index < totalCells) {
            row = Math.floor(index / gridStyle.columns);
            col = index % gridStyle.columns;
          } else {
            // Cell index exceeds grid capacity - skip or wrap
            cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Cell ${index} exceeds ${gridStyle.rows}x${gridStyle.columns} grid capacity, skipping`);
            return; // Skip this cell
          }
        }

        cblcarsLog.trace(`[StatusGridRenderer] 🔍 Parsing cell ${cellConfig.id || `cell-${index}`}:`, {
          index,
          calculatedPosition: [row, col],
          explicitPosition: cellConfig.position,
          cellConfig: cellConfig,
          extractedActions: cellActions,
          hasTapAction: !!cellConfig.tap_action,
          hasHoldAction: !!cellConfig.hold_action
        });

        const cell = {
          id: cellConfig.id || `cell-${index}`,
          row: row,
          col: col,
          index,
          source: cellConfig.source || cellConfig.data_source,
          label: cellConfig.label || `Cell ${index + 1}`,
          content: cellContent, // Use unified content resolution
          data: {
            value: cellConfig.value || cellContent || null,
            state: cellConfig.state || 'unknown',
            timestamp: Date.now()
          },
          lastUpdate: Date.now(),
          animationDelay: index * (gridStyle.cascade_speed || 50),
          _raw: cellConfig._raw || cellConfig,
          // Store original content for updates
          _originalContent: rawCellContent !== cellContent ? rawCellContent : null,

          // Store full cell configuration for styling inheritance
          config: cellConfig,

          // Cell actions
          actions: cellActions
        };

        cells.push(cell);
      });
    } else {
      cblcarsLog.debug(`[StatusGridRenderer] No explicit cells found, generating ${gridStyle.rows}x${gridStyle.columns} grid`);

      // Generate grid cells based on rows/columns
      const totalCells = gridStyle.rows * gridStyle.columns;
      for (let i = 0; i < totalCells; i++) {
        const row = Math.floor(i / gridStyle.columns);
        const col = i % gridStyle.columns;

        cells.push({
          id: `cell-${row}-${col}`,
          row,
          col,
          index: i,
          source: null,
          label: `${String.fromCharCode(65 + row)}${col + 1}`,
          content: null,
          data: {
            value: Math.random() > 0.5 ? 'ONLINE' : 'OFFLINE',
            state: Math.random() > 0.5 ? 'good' : 'bad',
            timestamp: Date.now()
          },
          lastUpdate: Date.now(),
          animationDelay: i * (gridStyle.cascade_speed || 50)
        });
      }
    }

    return cells;
  }

  /**
   * Get raw cell content from various sources with consistent priority
   * @private
   * @param {Object} cell - Cell configuration object
   * @returns {string} Raw content (may contain templates/conditionals)
   */
  _getCellContentFromSources(cell) {
    // Unified content source priority:
    // 1. _originalContent (for updates)
    // 2. _raw.content (preferred source)
    // 3. _raw.label (fallback)
    // 4. content (direct)
    // 5. label (final fallback)
    return cell._originalContent ||
           cell._raw?.content ||
           cell._raw?.label ||
           cell.content ||
           cell.label ||
           '';
  }

  /**
   * Resolve cell content for both initial render and updates
   * Handles both standard DataSource templates and conditional expressions
   * @private
   * @param {string} cellContent - Raw cell content (may contain templates/conditionals)
   * @param {Object} [updateDataSourceData] - Fresh DataSource data (for updates)
   * @returns {string} Resolved content ready for rendering
   */
  _resolveCellContent(cellContent, updateDataSourceData = null) {
    if (!cellContent || typeof cellContent !== 'string') {
      return cellContent || '';
    }

    // Quick exit if no template markers at all
    if (!TemplateProcessor.hasTemplates(cellContent)) {
      return cellContent;
    }

    const hasMSD = TemplateProcessor.hasMSDTemplates(cellContent);

    // MSD-style inline conditional support stays (only for { ... ? ... : ... } style)
    if (cellContent.includes('?') && cellContent.includes(':') && hasMSD) {
      cblcarsLog.debug(`[StatusGridRenderer] Using conditional path for: ${cellContent}`);
      return this._processConditionalWithDataSourceMixin(cellContent, updateDataSourceData);
    }

    // CRITICAL FIX: If updateDataSourceData is a DataSourceManager, use its hass states
    // This ensures we resolve templates with the SAME state that RulesEngine just used
    if (updateDataSourceData && typeof updateDataSourceData.getEntity === 'function') {
      cblcarsLog.debug(`[StatusGridRenderer] 🎯 Using DataSourceManager path for: ${cellContent}`);
      // We have a DataSourceManager - use it to resolve HA templates with current state
      return this._resolveWithDataSourceManager(cellContent, updateDataSourceData);
    }

    // Fallback: Unified processing (handles both HA {{}} and MSD {})
    cblcarsLog.trace(`[StatusGridRenderer] ⚠️ Using fallback DataSourceMixin path for: ${cellContent}`);
    return DataSourceMixin.processUnifiedTemplateStrings(cellContent, 'StatusGridRenderer');
  }

  /**
   * Resolve templates using DataSourceManager's current HASS state
   * @private
   */
  _resolveWithDataSourceManager(cellContent, dataSourceManager) {
    // Extract entity IDs from templates like {{states('light.tv')}}
    const entityMatches = cellContent.match(/states\(['"]([^'"]+)['"]\)/g);

    if (!entityMatches) {
      // No states() calls, fall back to standard processing
      return DataSourceMixin.processUnifiedTemplateStrings(cellContent, 'StatusGridRenderer');
    }

    let resolved = cellContent;
    entityMatches.forEach(match => {
      const entityId = match.match(/states\(['"]([^'"]+)['"]\)/)[1];

      // CRITICAL: Get the ORIGINAL HASS state, not processed DataSource value
      // DataSource may have enum mappings (on->1, off->0) but templates need original state
      const hassState = dataSourceManager.hass?.states?.[entityId];

      if (hassState && hassState.state) {
        // Replace the template with the actual state value
        const templatePattern = `{{\\s*states\\(['"]${entityId}['"]\\)\\s*}}`;
        resolved = resolved.replace(new RegExp(templatePattern, 'g'), hassState.state);

        cblcarsLog.trace(`[StatusGridRenderer] 🔄 Resolved template:`, {
          entityId,
          state: hassState.state,
          pattern: templatePattern
        });
      }
    });

    return resolved;
  }

  /**
   * Process conditional expression by extracting DataSource references and using DataSourceMixin
   * @private
   * @param {string} conditionalTemplate - Template with conditional expression
   * @param {Object} [updateDataSourceData] - Updated DataSource data to use (for updates)
   * @returns {string} Resolved conditional or original template
   */
  _processConditionalWithDataSourceMixin(conditionalTemplate, updateDataSourceData = null) {
    try {
      // Extract the conditional expression from the template
      const templateMatch = conditionalTemplate.match(/\{([^}]+)\}/);
      if (!templateMatch) return conditionalTemplate;

      const expression = templateMatch[1];

      // Parse the conditional: "path operator value ? trueValue : falseValue"
      const conditionMatch = expression.match(/^(.+?)\s*([><=!]+)\s*(.+?)\s*\?\s*'(.+?)'\s*:\s*'(.+?)'$/);
      if (!conditionMatch) {
        cblcarsLog.warn(`[StatusGridRenderer] Could not parse conditional: ${expression}`);
        return conditionalTemplate;
      }

      const [, leftPath, operator, rightValue, trueValue, falseValue] = conditionMatch;

      // Create a simple template with just the DataSource reference
      const dataSourceTemplate = `{${leftPath.trim()}}`;

      let resolvedValue;

      // If we have update data, try to extract the value directly first
      if (updateDataSourceData) {
        resolvedValue = this._extractValueFromUpdateData(leftPath.trim(), updateDataSourceData);
      }

      // If we couldn't extract from update data, fall back to DataSourceMixin
      if (resolvedValue === null || resolvedValue === undefined) {
        resolvedValue = DataSourceMixin.processEnhancedTemplateStringsWithFallback(dataSourceTemplate, 'StatusGridRenderer');
      }

      // If DataSourceMixin couldn't resolve it, return original
      if (resolvedValue === dataSourceTemplate) {
        return conditionalTemplate;
      }

      // Parse the resolved value and apply conditional logic
      const leftVal = parseFloat(resolvedValue);
      const rightVal = parseFloat(rightValue.trim());

      if (isNaN(leftVal) || isNaN(rightVal)) {
        cblcarsLog.warn(`[StatusGridRenderer] Could not parse numeric values: left="${resolvedValue}" (${leftVal}), right="${rightValue.trim()}" (${rightVal})`);
        return conditionalTemplate;
      }

      // Evaluate condition
      let result = false;
      switch (operator.trim()) {
        case '>': result = leftVal > rightVal; break;
        case '<': result = leftVal < rightVal; break;
        case '>=': result = leftVal >= rightVal; break;
        case '<=': result = leftVal <= rightVal; break;
        case '==': result = leftVal == rightVal; break;
        case '!=': result = leftVal != rightVal; break;
        default:
          cblcarsLog.warn(`[StatusGridRenderer] Unknown operator: ${operator}`);
          return conditionalTemplate;
      }

      const finalValue = result ? trueValue : falseValue;
      cblcarsLog.trace(`[StatusGridRenderer] Conditional result: ${leftVal} ${operator} ${rightVal} = ${result} → "${finalValue}"`);
      return finalValue;

    } catch (error) {
      cblcarsLog.error(`[StatusGridRenderer] Error processing conditional with DataSourceMixin:`, error);
      return conditionalTemplate;
    }
  }

  /**
   * Extract value from update DataSource data based on path
   * @private
   * @param {string} path - DataSource path (e.g., "temperature_enhanced.transformations.celsius")
   * @param {Object} updateData - Updated DataSource data
   * @returns {*} Extracted value or null if not found
   */
  _extractValueFromUpdateData(path, updateData) {
    const pathParts = path.split('.');

    // For simple paths, use the raw value
    if (pathParts.length === 1) {
      return updateData?.v || updateData?.value || null;
    }

    // For complex paths like "temperature_enhanced.transformations.celsius"
    let value = updateData;

    // Skip the first part (source name) and navigate the rest
    for (let i = 1; i < pathParts.length; i++) {
      const part = pathParts[i];

      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        cblcarsLog.debug(`[StatusGridRenderer] Path "${part}" not found in update data, falling back to DataSourceMixin`);
        return null;
      }
    }

    return value;
  }

  _renderFallbackStatusGrid(overlay, x, y, width, height) {
    const style = overlay.finalStyle || overlay.style || {};
    const color = style.cell_color || style.color || 'var(--lcars-gray)';

    cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Using fallback rendering for status grid ${overlay.id}`);

    return `<g id="${overlay.id}" data-overlay-id="${overlay.id}" data-overlay-type="status_grid" data-fallback="true">
              <g transform="translate(${x}, ${y})">
                <rect width="${width}" height="${height}"
                      fill="none" stroke="${color}" stroke-width="2"/>
                <text x="${width / 2}" y="${height / 2}" text-anchor="middle"
                      fill="${color}" font-size="12" dominant-baseline="middle"
                      font-family="var(--lcars-font-family, Antonio)">
                  Status Grid Error
                </text>
              </g>
            </g>`;
  }

  /**
   * Compute attachment points for status grid overlay
   * @param {Object} overlay - Status grid overlay configuration
   * @param {Object} anchors - Available anchors
   * @param {Element} container - Container element for measurements
   * @returns {Object|null} Attachment points object
   * @static
   */
  static computeAttachmentPoints(overlay, anchors, container) {
    const attachmentPoints = OverlayUtils.computeAttachmentPoints(overlay, anchors);

    if (!attachmentPoints) {
      cblcarsLog.debug(`[StatusGridRenderer] Cannot compute attachment points for ${overlay.id}: missing position or size`);
      return null;
    }

    // TODO: Future enhancement - add individual grid cell attachment points
    // This would allow attaching lines to specific cells: grid.cell_0_0, grid.cell_1_2, etc.

    return attachmentPoints;
  }

  /**
   * Process all pending actions for status grids
   * @static
   */
  static processAllPendingActions() {
    if (!window._msdStatusGridActions) {
      cblcarsLog.debug(`[StatusGridRenderer] No pending actions to process`);
      return;
    }

    cblcarsLog.debug(`[StatusGridRenderer] Processing pending actions for status grids:`, Array.from(window._msdStatusGridActions.keys()));

    // Iterate over all pending actions
    window._msdStatusGridActions.forEach((actionInfo, overlayId) => {
      // Try to find the status grid element in card shadow DOM
      let gridElement = null;

      const card = window.cb_lcars_card_instance;
      if (card && card.shadowRoot) {
        gridElement = card.shadowRoot.querySelector(`[data-overlay-id="${overlayId}"]`);
      }

      // Fallback to document search
      if (!gridElement) {
        gridElement = document.querySelector(`[data-overlay-id="${overlayId}"]`);
      }

      if (gridElement) {
        cblcarsLog.trace(`[StatusGridRenderer] 🎯 Processing pending actions for ${overlayId}`);
        StatusGridRenderer.attachStatusGridActions(gridElement, actionInfo);
      } else {
        cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Could not find status grid element for pending action processing: ${overlayId}`);
      }
    });

    // Clear the action map after processing
    window._msdStatusGridActions.clear();
    cblcarsLog.debug(`[StatusGridRenderer] Cleared pending actions map`);
  }

  /**
   * Attach actions to a status grid overlay element
   * @param {Element} gridElement - The grid element to attach actions to
   * @param {Object} actionInfo - The action information object
   * @static
   */
  static attachStatusGridActions(gridElement, actionInfo) {
    if (!gridElement || !actionInfo) {
      cblcarsLog.warn(`[StatusGridRenderer] Invalid arguments for attachStatusGridActions`);
      return;
    }

    cblcarsLog.debug(`[StatusGridRenderer] 🎯 Attaching actions to grid ${gridElement.getAttribute('data-overlay-id')}:`, {
      hasActionInfo: !!actionInfo,
      hasCells: !!(actionInfo.cells),
      cellCount: actionInfo.cells?.length || 0,
      hasCardInstance: !!actionInfo.cardInstance
    });

    // Use proven ActionHelpers pattern
    if (actionInfo.cells && Array.isArray(actionInfo.cells)) {
      cblcarsLog.debug(`[StatusGridRenderer] Using ActionHelpers.attachCellActionsFromConfigs for ${actionInfo.cells.length} cells`);

      // Use the proven ActionHelpers method that works for other overlays
      window.ActionHelpers.attachCellActionsFromConfigs(gridElement, actionInfo.cells, actionInfo.cardInstance);

      cblcarsLog.debug(`[StatusGridRenderer] ✅ Completed ActionHelpers cell action attachment`);
    } else {
      cblcarsLog.warn(`[StatusGridRenderer] No cells array found in actionInfo for grid action attachment`);
    }

    // Handle overlay-level actions if present
    if (actionInfo.hasOverlayActions && actionInfo.overlay) {
      cblcarsLog.debug(`[StatusGridRenderer] Processing overlay-level actions`);

      const overlayActionConfig = window.ActionHelpers.processOverlayActions(
        actionInfo.overlay,
        actionInfo.gridStyle || {},
        actionInfo.cardInstance
      );

      if (overlayActionConfig) {
        window.ActionHelpers.attachActions(
          gridElement,
          actionInfo.overlay,
          overlayActionConfig.config,
          actionInfo.cardInstance
        );
        cblcarsLog.debug(`[StatusGridRenderer] ✅ Attached overlay-level actions`);
      }
    }

    cblcarsLog.debug(`[StatusGridRenderer] ✅ Completed action attachment for grid ${gridElement.getAttribute('data-overlay-id')}`);
  }

  /**
   * Store action info for later attachment after DOM insertion
   * @private
   * @static
   */
  static _storeActionInfo(overlayId, actionInfo) {
    if (!window._msdStatusGridActions) {
      window._msdStatusGridActions = new Map();
      cblcarsLog.debug(`[StatusGridRenderer] 📦 Initialized action storage map`);
    }

    if (!actionInfo) {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Attempted to store null action info for ${overlayId}`);
      return;
    }

    window._msdStatusGridActions.set(overlayId, actionInfo);
    cblcarsLog.debug(`[StatusGridRenderer] 📦 STORED action info for overlay ${overlayId}:`, {
      hasCells: !!(actionInfo?.cells),
      cellCount: actionInfo?.cells?.length || 0,
      hasCardInstance: !!actionInfo?.cardInstance,
      hasOverlayActions: actionInfo?.hasOverlayActions,
      hasCellActions: actionInfo?.hasCellActions,
      storageMapSize: window._msdStatusGridActions.size
    });
  }

  /**
   * Try manual action processing for a specific overlay
   * @private
   * @static
   */
  static _tryManualActionProcessing(overlayId) {
    if (!window._msdStatusGridActions?.has(overlayId)) {
      cblcarsLog.debug(`[StatusGridRenderer] No stored actions for ${overlayId}`);
      return;
    }

    const actionInfo = window._msdStatusGridActions.get(overlayId);

    // ENHANCED: Try renderer-based search first (more reliable)
    let gridElement = null;

    // Method 1: Use the known renderer mount element
    const renderer = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.renderer;
    if (renderer && renderer.mountEl) {
      const overlayGroup = renderer.mountEl.querySelector('#msd-overlay-container');
      if (overlayGroup) {
        gridElement = overlayGroup.querySelector(`[data-overlay-id="${overlayId}"]`);
        if (gridElement) {
          cblcarsLog.debug(`[StatusGridRenderer] 🎯 Found grid element via renderer mount for ${overlayId}`);
        }
      }
    }

    // Method 2: Card shadow DOM (fallback)
    if (!gridElement) {
      const card = window.cb_lcars_card_instance;
      if (card && card.shadowRoot) {
        gridElement = card.shadowRoot.querySelector(`[data-overlay-id="${overlayId}"]`);
        if (gridElement) {
          cblcarsLog.debug(`[StatusGridRenderer] 🎯 Found grid element in card shadow DOM for ${overlayId}`);
        }
      }
    }

    // Method 3: Document search (last resort)
    if (!gridElement) {
      gridElement = document.querySelector(`[data-overlay-id="${overlayId}"]`);
      if (gridElement) {
        cblcarsLog.debug(`[StatusGridRenderer] 🎯 Found grid element in document for ${overlayId}`);
      }
    }

    if (gridElement) {
      cblcarsLog.debug(`[StatusGridRenderer] 🎯 Found grid element for ${overlayId}, attaching actions`);

      // ENHANCED: Add debugging to track the attachment process
      const beforeAttachment = gridElement.querySelectorAll('[data-has-cell-actions="true"]').length;

      StatusGridRenderer.attachStatusGridActions(gridElement, actionInfo);

      const afterAttachment = gridElement.querySelectorAll('[data-actions-attached="true"]').length;

      cblcarsLog.debug(`[StatusGridRenderer] Action attachment summary for ${overlayId}:`, {
        cellsWithActionsMarkup: beforeAttachment,
        cellsWithActionsAttached: afterAttachment,
        success: afterAttachment > 0
      });

      // Remove from pending actions after successful attachment
      window._msdStatusGridActions.delete(overlayId);
    } else {
      cblcarsLog.debug(`[StatusGridRenderer] ⚠️ Grid element not found for ${overlayId}, will retry later`);
    }
  }

  /**
   * Fallback method to attach basic cell actions when ActionHelpers is not available
   * @private
   * @static
   */
  static _attachBasicCellActions(cellElement, actions, cardInstance) {
    cblcarsLog.warn(`[StatusGridRenderer] Using fallback action attachment - ActionHelpers should be available`);

    // FIXED: Use ActionHelpers if available, otherwise fallback
    if (window.ActionHelpers && typeof window.ActionHelpers.attachCellActions === 'function') {
      window.ActionHelpers.attachCellActions(cellElement, actions, cardInstance);
      return;
    }

    // Original fallback code only if ActionHelpers is not available
    if (!cellElement || !actions) return;

    // Add click handler for tap_action
    if (actions.tap_action) {
      cellElement.addEventListener('click', (event) => {
        event.stopPropagation();
        cblcarsLog.debug(`[StatusGridRenderer] 🖱️ Cell tap action triggered:`, actions.tap_action);

        if (cardInstance && typeof cardInstance._handleAction === 'function') {
          cardInstance._handleAction(actions.tap_action);
        } else {
          cblcarsLog.warn(`[StatusGridRenderer] No card instance available for action handling`);
        }
      });
    }

    // Add hold handler for hold_action
    if (actions.hold_action) {
      let holdTimer = null;

      cellElement.addEventListener('mousedown', (event) => {
        holdTimer = setTimeout(() => {
          event.stopPropagation();
          cblcarsLog.debug(`[StatusGridRenderer] ✋ Cell hold action triggered:`, actions.hold_action);

          if (cardInstance && typeof cardInstance._handleAction === 'function') {
            cardInstance._handleAction(actions.hold_action);
          }
        }, 500); // 500ms hold threshold
      });

      cellElement.addEventListener('mouseup', () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      });

      cellElement.addEventListener('mouseleave', () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      });
    }

    // Add double-click handler for double_tap_action
    if (actions.double_tap_action) {
      cellElement.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        cblcarsLog.debug(`[StatusGridRenderer] 🖱️🖱️ Cell double-tap action triggered:`, actions.double_tap_action);

        if (cardInstance && typeof cardInstance._handleAction === 'function') {
          cardInstance._handleAction(actions.double_tap_action);
        }
      });
    }

    cblcarsLog.debug(`[StatusGridRenderer] ✅ Attached basic fallback actions to cell`);
  }

  /**
   * Get debug information about the action system
   * @static
   */
  static getActionDebugInfo() {
    return {
      observerActive: !!window._msdStatusGridObserver,
      pendingActions: window._msdStatusGridActions ? Array.from(window._msdStatusGridActions.keys()) : [],
      cardInstanceAvailable: !!StatusGridRenderer._resolveCardInstance(),
      actionHelpersAvailable: !!window.ActionHelpers
    };
  }

  /**
   * Make text elements within cells clickable and part of their parent cell for actions
   * @param {string} gridMarkup - The grid markup to process
   * @param {Array} cells - Array of cell configurations
   * @returns {string} Updated markup with clickable text elements
   * @private
   * @static
   */
  static _makeTextElementsClickable(gridMarkup, cells) {
    // Replace pointer-events: none with pointer-events: visiblePainted for text elements
    // and add necessary data attributes
    return gridMarkup.replace(
      /(<text[^>]*data-cell-part="([^"]*)"[^>]*style="[^"]*pointer-events:\s*none[^"]*")([^>]*>)/g,
      (match, beforeStyle, cellId, afterStyle) => {
        // Find the cell configuration
        const cell = cells.find(c => c.id === cellId);
        const cellHasActions = !!(cell && cell.actions && (cell.actions.tap_action || cell.actions.hold_action || cell.actions.double_tap_action));

        // Replace the style and add data attributes
        const newStyle = beforeStyle.replace('pointer-events: none', 'pointer-events: visiblePainted; cursor: pointer');
        return `${newStyle} data-cell-id="${cellId}" data-has-cell-actions="${cellHasActions}"${afterStyle}`;
      }
    );
  }

  /**
   * Calculate proportional cell dimensions based on grid configuration
   * @private
   */
  _calculateProportionalCellDimensions(totalWidth, totalHeight, gridStyle) {
    const rows = gridStyle.rows;
    const columns = gridStyle.columns;
    const gap = gridStyle.cell_gap;

    cblcarsLog.trace(`[StatusGridRenderer] 📐 Grid dimensions: ${rows}x${columns}, total: ${totalWidth}x${totalHeight}, gap: ${gap}`);

    // Calculate available space after gaps (ensure non-negative)
    const gapWidth = gap * Math.max(0, columns - 1);
    const gapHeight = gap * Math.max(0, rows - 1);
    const availableWidth = Math.max(0, totalWidth - gapWidth);
    const availableHeight = Math.max(0, totalHeight - gapHeight);

    // Debug space calculations
    cblcarsLog.trace(`[StatusGridRenderer] Space calculation:`, {
      totalWidth,
      totalHeight,
      gap,
      gapWidth,
      gapHeight,
      availableWidth,
      availableHeight,
      rows,
      columns
    });

    // Get sizing configuration - prioritize specific keys over fallbacks
    const columnSizing = gridStyle.column_sizes || gridStyle.column_widths;
    const rowSizing = gridStyle.row_sizes || gridStyle.row_heights;

    // Calculate cell widths
    const cellWidths = this._calculateDimensions(availableWidth, columns, columnSizing);

    // Calculate cell heights
    const cellHeights = this._calculateDimensions(availableHeight, rows, rowSizing);

    // Debug logging for proportional sizing
    if (columnSizing) {
      cblcarsLog.debug(`[StatusGridRenderer] Using column sizing:`, columnSizing, '→ widths:', cellWidths);
    }
    if (rowSizing) {
      cblcarsLog.debug(`[StatusGridRenderer] Using row sizing:`, rowSizing, '→ heights:', cellHeights);
    }

    cblcarsLog.trace(`[StatusGridRenderer] ✅ Final cell dimensions: widths=${cellWidths}, heights=${cellHeights}`);

    // Validate calculated dimensions
    const hasNegativeWidths = cellWidths.some(w => w <= 0);
    const hasNegativeHeights = cellHeights.some(h => h <= 0);

    if (hasNegativeWidths || hasNegativeHeights) {
      cblcarsLog.error(`[StatusGridRenderer] ❌ Calculated negative dimensions:`, {
        cellWidths,
        cellHeights,
        availableWidth,
        availableHeight,
        gap,
        columnSizing,
        rowSizing
      });

      // Fallback to equal sizing
      const fallbackWidth = Math.max(1, availableWidth / columns);
      const fallbackHeight = Math.max(1, availableHeight / rows);

      return {
        cellWidths: Array(columns).fill(fallbackWidth),
        cellHeights: Array(rows).fill(fallbackHeight)
      };
    }

    return { cellWidths, cellHeights };
  }

  /**
   * Calculate dimensions for rows or columns based on sizing configuration
   * @private
   */
  _calculateDimensions(totalSpace, count, sizing) {
    cblcarsLog.trace(`[StatusGridRenderer] 📐 Calculating dimensions: totalSpace=${totalSpace}, count=${count}, sizing=`, sizing);

    if (!sizing || !Array.isArray(sizing)) {
      // Equal sizing - divide space equally
      const size = totalSpace / count;
      cblcarsLog.trace(`[StatusGridRenderer] ✅ Using equal sizing: ${size} per cell`);
      return Array(count).fill(size);
    }

    // RUNTIME NORMALIZATION: Validate array length matches expected count
    // Schema validation ensures 'sizing' is an array if present, but doesn't
    // enforce length constraints (which depend on runtime grid dimensions).
    // Fall back to equal sizing rather than failing the render.
    if (sizing.length !== count) {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Sizing array length (${sizing.length}) doesn't match expected count (${count}). Using equal sizing.`);
      const size = totalSpace / count;
      return Array(count).fill(size);
    }

    // Check if sizing uses percentages
    if (sizing.some(s => typeof s === 'string' && s.includes('%'))) {
      const result = sizing.map((s, index) => {
        if (typeof s === 'string' && s.includes('%')) {
          const percentage = parseFloat(s.replace('%', ''));
          return (totalSpace * percentage) / 100;
        }
        // Handle mixed percentage/number arrays
        return parseFloat(s) || 0;
      });

      // Validate percentages don't exceed 100%
      const totalPercentage = sizing.reduce((sum, s) => {
        if (typeof s === 'string' && s.includes('%')) {
          return sum + parseFloat(s.replace('%', ''));
        }
        return sum;
      }, 0);

      if (totalPercentage > 100) {
        cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Total percentages (${totalPercentage}%) exceed 100%. Normalizing.`);
        return result.map(val => (val / totalPercentage) * totalSpace);
      }

      return result;
    }

    // Convert all values to numbers for proportional calculation
    const numericValues = sizing.map(s => parseFloat(s) || 0);
    const totalValue = numericValues.reduce((sum, val) => sum + val, 0);

    // Check if we should treat as pixels or ratios
    // If values sum to significantly more than available space, treat as pixels and scale down
    if (totalValue > totalSpace * 1.2) {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Total pixel values (${totalValue}px) exceed available space (${totalSpace}px). Scaling down.`);
      const scale = totalSpace / totalValue;
      return numericValues.map(val => val * scale);
    }

    // Otherwise treat as proportional ratios (most common case for [2, 1] etc.)
    if (totalValue === 0) {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ All ratio values are zero or invalid. Using equal sizing.`);
      const size = totalSpace / count;
      return Array(count).fill(size);
    }

    // Convert ratios to actual pixel dimensions
    const result = numericValues.map(ratio => {
      const normalizedRatio = ratio / totalValue;
      return totalSpace * normalizedRatio;
    });

    cblcarsLog.debug(`[StatusGridRenderer] Calculated proportional dimensions:`, {
      input: sizing,
      numericValues,
      totalValue,
      totalSpace,
      result
    });

    return result;
  }

  /**
   * Calculate cumulative X position for a column
   * @private
   */
  _calculateCellX(colIndex, cellWidths, gap) {
    let x = 0;
    for (let i = 0; i < colIndex; i++) {
      x += cellWidths[i] + gap;
    }
    return x;
  }

  /**
   * Calculate cumulative Y position for a row
   * @private
   */
  _calculateCellY(rowIndex, cellHeights, gap) {
    let y = 0;
    for (let i = 0; i < rowIndex; i++) {
      y += cellHeights[i] + gap;
    }
    return y;
  }

  /**
   * Calculate normalized radius for consistent visual appearance across different cell sizes
   * Uses HA theme variables as baseline and intelligent clamping for LCARS aesthetic
   * @private
   * @param {number} cellWidth - Width of the cell
   * @param {number} cellHeight - Height of the cell
   * @param {number} baseRadius - Base radius value from configuration
   * @param {boolean} matchHaRadius - Whether to clamp minimum radius to HA's card radius
   * @returns {number} Normalized radius value
   */
  _calculateNormalizedRadius(cellWidth, cellHeight, baseRadius, matchHaRadius = false) {
    // Use the smaller dimension to maintain proportional rounding
    const cellMinDimension = Math.min(cellWidth, cellHeight);

    // Get HA's card border radius as reference (typically 12px in most themes)
    // This ensures our cells look consistent with the overall HA card design
    const haCardRadius = this._getHACardRadius();

    // If matchHaRadius is true, use HA's card radius directly for all cells
    if (matchHaRadius) {
      // Use HA's card radius directly for perfect visual consistency
      const result = Math.round(haCardRadius);

      return result;
    }

    // Otherwise, use proportional scaling with intelligent clamping
    const intelligentMinRadius = Math.max(
      haCardRadius * 0.5,        // At least half of HA's card radius
      cellMinDimension * 0.08,   // Or 8% of cell dimension (less aggressive than 15%)
      4                          // But never less than 4px for visual consistency
    );

    // Define maximum to prevent over-rounding
    const maxRadius = Math.min(
      cellMinDimension * 0.20,   // Max 20% of cell dimension
      haCardRadius * 1.5         // Or 1.5x HA's card radius
    );

    // Calculate proportional radius based on cell size
    // Use a reference size that makes sense for typical card layouts
    const referenceSize = haCardRadius * 4; // ~48px for typical 12px card radius
    const scaleFactor = cellMinDimension / referenceSize;
    let normalizedRadius = baseRadius * scaleFactor;

    // Apply intelligent clamping
    normalizedRadius = Math.max(normalizedRadius, intelligentMinRadius);
    normalizedRadius = Math.min(normalizedRadius, maxRadius);

    const result = Math.round(normalizedRadius);

    return result;
  }

  /**
   * Get Home Assistant's card border radius from CSS variables
   * Falls back to sensible default if not available
   * @private
   * @returns {number} HA card border radius in pixels
   */
  _getHACardRadius() {
    // Try to get HA's card border radius from CSS variables
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const rootStyles = window.getComputedStyle(document.documentElement);

      // Try various HA CSS variables that might contain card radius
      const haVariables = [
        '--ha-card-border-radius',
        '--card-border-radius',
        '--border-radius',
        '--mdc-shape-small'
      ];

      for (const variable of haVariables) {
        const value = rootStyles.getPropertyValue(variable).trim();
        if (value && value.includes('px')) {
          const radius = parseFloat(value.replace('px', ''));
          if (!isNaN(radius) && radius > 0) {
            //cblcarsLog.debug(`[StatusGridRenderer] Using HA card radius: ${radius}px from ${variable}`);
            return radius;
          }
        }
      }
    }

    // Fallback to typical HA default
    const fallbackRadius = 12;
    cblcarsLog.debug(`[StatusGridRenderer] Using fallback card radius: ${fallbackRadius}px`);
    return fallbackRadius;
  }

  /**
   * Determine cell color based on status and configuration
   * @private
   */
  _determineCellColor(cell, gridStyle) {
    // Check status ranges first
    if (gridStyle.status_ranges && gridStyle.status_ranges.length > 0) {
      const value = typeof cell.data.value === 'number' ? cell.data.value : parseFloat(cell.data.value);

      if (!isNaN(value)) {
        for (const range of gridStyle.status_ranges) {
          if (value >= range.min && value <= range.max) {
            return range.color;
          }
        }
      }

      // Check string/state matching
      for (const range of gridStyle.status_ranges) {
        if (range.value && cell.data.value === range.value) {
          return range.color;
        }
        if (range.state && cell.data.state === range.state) {
          return range.color;
        }
      }
    }

    // Fallback to default cell color
    return gridStyle.cell_color;
  }

  /**
   * Update status grid overlay data when DataSource changes
   *
   * ✅ ENHANCED: Now handles both content AND style updates for cells
   *
   * @param {Element} gridElement - DOM element for the status grid
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - New DataSource data
   * @returns {boolean} True if content was updated
   * @static
   */
  static updateGridData(gridElement, overlay, contextOrPatch) {
    try {
      // Support both old API (patch object) and new API (context object)
      const isContext = contextOrPatch && (contextOrPatch.patch || contextOrPatch.dataSourceManager);
      const sourceData = isContext ? contextOrPatch.patch : contextOrPatch;
      const dataSourceManager = isContext ? contextOrPatch.dataSourceManager : null;

      cblcarsLog.debug(`[StatusGridRenderer] 📦 Context extraction:`, {
        hasContext: !!contextOrPatch,
        isContext,
        hasDataSourceManager: !!dataSourceManager,
        dataSourceManagerType: dataSourceManager ? dataSourceManager.constructor.name : 'none',
        contextKeys: contextOrPatch ? Object.keys(contextOrPatch) : []
      });

      // Log the actual sourceData structure to understand what we're getting
      const sourceDataKeys = sourceData ? Object.keys(sourceData) : [];
      cblcarsLog.debug(`[StatusGridRenderer] 📦 PATCH STRUCTURE ANALYSIS:`, {
        hasSourceData: !!sourceData,
        allKeys: sourceDataKeys,
        // Try all possible key names
        id: sourceData?.id,
        type: sourceData?.type,
        overlayId: sourceData?.overlayId,
        cellTarget: sourceData?.cellTarget,
        cell_target: sourceData?.cell_target,
        cell: sourceData?.cell,
        patch: sourceData?.patch,
        // Show full object (for expanded view in console)
        fullPatch: sourceData
      });

      // Check if sourceData is a rule patch (has cellTarget property)
      // Try both camelCase and snake_case variants
      const isRulePatch = sourceData && typeof sourceData === 'object' &&
                         ('cellTarget' in sourceData || 'cell_target' in sourceData || 'cell' in sourceData);

      // Extract cellTarget, supporting both camelCase and snake_case
      const cellTarget = sourceData?.cellTarget || sourceData?.cell_target;

      // Extract cellId from cellTarget, supporting both camelCase and snake_case
      const targetCellId = cellTarget?.cellId || cellTarget?.cell_id;

      // Extract the style patch - could be in 'patch' or 'style' property
      const stylePatch = sourceData?.patch || sourceData?.style;

      // If it's a rule patch, temporarily store it on the overlay for style resolution
      let patchedOverlay = overlay;
      if (isRulePatch && targetCellId) {
        // Apply patch to the overlay by modifying the cell config
        patchedOverlay = {
          ...overlay,
          cells: overlay.cells?.map(cell => {
            if (cell.id === targetCellId) {
              return {
                ...cell,
                _rulePatch: stylePatch, // Store patch for style resolution
                style: {
                  ...cell.style,
                  ...stylePatch // Merge patch into cell style
                }
              };
            }
            return cell;
          })
        };
      }

      cblcarsLog.debug(`[StatusGridRenderer] 📥 updateGridData() called for ${overlay.id}`, {
        hasRulePatches: isRulePatch,
        cellsWithPatches: isRulePatch && targetCellId ? 1 : 0,
        patchedCellId: targetCellId || undefined
      });

      // Create instance for non-static methods
      const instance = new StatusGridRenderer();

      // Get updated cells with new data (for content changes)
      const style = patchedOverlay.finalStyle || patchedOverlay.style || {};

      // CRITICAL: Pass dataSourceManager so templates can access current HASS state
      // For incremental updates, we need to re-evaluate cell content using the SAME
      // hass state that the RulesEngine just used to evaluate the rules
      const cellsWithContentChanges = instance.updateCellsWithData(patchedOverlay, style, dataSourceManager);

      // CRITICAL FIX: Need to check ALL cells for style changes, not just cells with content changes!
      // Get all cells from overlay for style checking
      const gridStyle = instance._resolveStatusGridStyles(style, patchedOverlay.id, patchedOverlay);
      const allCells = instance._resolveCellConfigurations(patchedOverlay, gridStyle);

      let hasUpdates = false;
      let contentUpdates = 0;
      let styleUpdates = 0;

      // Update all cells (check both content AND style)
      allCells.forEach(cell => {
        const cellElement = gridElement.querySelector(`[data-button-id="${cell.id}"]`);
        if (cellElement) {
          // 1. Update content if this cell had content changes
          const cellWithContentChange = cellsWithContentChanges?.find(c => c.id === cell.id);
          if (cellWithContentChange) {
            const buttonConfig = {
              id: cellWithContentChange.id,
              label: cellWithContentChange.label,
              content: cellWithContentChange.content,
              texts: cellWithContentChange.texts  // Include texts array if present
              // NOTE: Don't pass _raw or _originalContent! They would cause ButtonRenderer
              // to re-resolve the template from scratch instead of using our already-resolved content.
              // We've already resolved the content with current HASS state in updateCellsWithData.
            };

            const updated = ButtonRenderer.updateButtonData(cellElement, buttonConfig, sourceData);
            if (updated) {
              hasUpdates = true;
              contentUpdates++;
            }
          }

          // 2. ALWAYS check for style changes (not just content-changed cells!)
          const styleUpdated = instance._updateCellStyle(cellElement, cell, patchedOverlay);
          if (styleUpdated) {
            hasUpdates = true;
            styleUpdates++;
          }
        }
      });

      if (hasUpdates) {
        // Update grid timestamp
        const timestamp = new Date().toISOString();
        gridElement.setAttribute('data-last-update', timestamp);
        cblcarsLog.debug(`[StatusGridRenderer] ✅ Updated ${allCells.length} cells in grid ${overlay.id}:`, {
          contentUpdates,
          styleUpdates,
          totalCells: allCells.length
        });
      } else {
        cblcarsLog.debug(`[StatusGridRenderer] ℹ️ No updates needed for ${overlay.id}:`, {
          totalCells: allCells.length,
          cellsChecked: allCells.length,
          hasRulePatches: isRulePatch,
          cellsWithPatches: isRulePatch && sourceData.cellTarget ? 1 : 0
        });
      }

      return hasUpdates;

    } catch (error) {
      cblcarsLog.error(`[StatusGridRenderer] Error updating grid data for ${overlay.id}:`, error);
      return false;
    }
  }

  /**
   * Update cell button style (for rules engine style patches)
   * @private
   * @param {SVGElement} cellElement - Cell button DOM element
   * @param {Object} cell - Cell configuration
   * @param {Object} overlay - Full overlay configuration (may contain rules patches)
   * @returns {boolean} True if style was updated
   */
  _updateCellStyle(cellElement, cell, overlay) {
    try {
      // Find cell config from overlay (may have rules patches applied)
      const cellConfig = overlay.cells?.find(c => c.id === cell.id);
      if (!cellConfig) {
        return false;
      }

      // Resolve grid and cell styles (includes rules patches)
      const gridStyle = this._resolveStatusGridStyles(overlay.style, overlay.id, overlay);

      // Get cell size from element or defaults
      const bbox = cellElement.getBBox?.() || { width: gridStyle.cell_width || 100, height: gridStyle.cell_height || 100 };
      const cellWidth = bbox.width;
      const cellHeight = bbox.height;

      // Use the unified style resolution system (same as render)
      const cellStyle = this._resolveCellStyle(cellConfig, gridStyle, cellWidth, cellHeight);

      // Update via ButtonRenderer
      const updated = ButtonRenderer.updateButtonStyle(cellElement, cellStyle, {
        width: cellWidth,
        height: cellHeight
      });

      return updated;
    } catch (error) {
      cblcarsLog.error(`[StatusGridRenderer] Error updating cell style for ${cell.id}:`, error);
      return false;
    }
  }

  /**
   * Resolve cell content with updated DataSource data (for dynamic updates)
   * @public - Used by BaseOverlayUpdater for real-time status grid updates
   * @param {Object} overlay - Overlay configuration
   * @param {Object} style - Style configuration
   * @param {Object} newDataSourceData - Updated DataSource data
   * @returns {Array} Updated cell configurations with new data
   */
  updateCellsWithData(overlay, style, newDataSourceData) {
    cblcarsLog.trace(`[StatusGridRenderer] Updating cells with new DataSource data for ${overlay.id}`, {
      hasDataSourceData: !!newDataSourceData,
      isDataSourceManager: newDataSourceData && typeof newDataSourceData.getHassState === 'function',
      dataType: newDataSourceData ? newDataSourceData.constructor.name : 'none'
    });

    const gridStyle = this._resolveStatusGridStyles(style, overlay.id, overlay);
    const cells = this._resolveCellConfigurations(overlay, gridStyle);

    // Update cells that have template content
    const updatedCells = cells.map(cell => {
      // Get raw content using unified method
      const rawCellContent = this._getCellContentFromSources(cell);

      if (TemplateProcessor.hasTemplates(rawCellContent)) {
        // Use single method for all template processing with fresh data
        const processedContent = this._resolveCellContent(rawCellContent, newDataSourceData);

        // Ensure we don't return [object Object]
        const safeContent = (typeof processedContent === 'object') ? JSON.stringify(processedContent) : String(processedContent);

        cblcarsLog.debug(`[StatusGridRenderer] 📝 Cell content resolution for ${cell.id}:`, {
          rawCellContent,
          processedContent,
          safeContent,
          oldLabel: cell.label,
          contentChanged: processedContent !== rawCellContent
        });

        // Update both legacy fields AND texts array for compatibility
        const updatedCell = {
          ...cell,
          label: processedContent === rawCellContent ? cell.label : safeContent,
          content: safeContent,
          data: {
            ...cell.data,
            value: this._extractValueFromTemplate(safeContent, newDataSourceData),
            timestamp: Date.now()
          },
          lastUpdate: Date.now()
        };

        // CRITICAL: If cell uses texts array, update the value text in it
        if (cell.texts && Array.isArray(cell.texts)) {
          updatedCell.texts = cell.texts.map(text => {
            // Update the text with textType: 'value' (the dynamic content)
            if (text.textType === 'value') {
              return {
                ...text,
                text: safeContent
              };
            }
            return text;
          });
        }

        return updatedCell;
      }
    // If the processed content is purely numeric, return it
      return cell;
    });

    return updatedCells;
  }

  /**
   * Extract numeric value from processed template for status calculations
   * @private
   */
  _extractValueFromTemplate(processedContent, dataSourceData) {
    // If the processed content is purely numeric, return it
    const numericValue = parseFloat(processedContent);
    if (!isNaN(numericValue)) {
      return numericValue;
    }

    // Otherwise try to extract the raw value from dataSourceData
    if (dataSourceData && typeof dataSourceData.v === 'number') {
      return dataSourceData.v;
    }

    // Fallback to processed content as string
    return processedContent;
  }

  /**
   * Process action configuration for status grid
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Array} cells - Array of cell configurations WITH actions already attached
   * @param {Object} gridStyle - Resolved grid styling
   * @param {Object} cardInstance - Card instance for action handling
   * @returns {Object|null} Action configuration for ActionHelpers
   */
  _processStatusGridActions(overlay, cells, gridStyle, cardInstance) {
    // Get card instance if not provided
    if (!cardInstance) {
      cardInstance = this._resolveCardInstance();
    }

    // CRITICAL: Filter cells that actually have actions defined
    const cellsWithActions = cells.filter(cell => {
      const hasActions = cell.actions && (
        cell.actions.tap_action ||
        cell.actions.hold_action ||
        cell.actions.double_tap_action
      );

      if (hasActions) {
        cblcarsLog.debug(`[StatusGridRenderer] ✅ Cell ${cell.id} has actions:`, {
          tap: !!cell.actions.tap_action,
          hold: !!cell.actions.hold_action,
          double_tap: !!cell.actions.double_tap_action,
          actions: cell.actions
        });
      }

      return hasActions;
    });

    // Check for overlay-level actions
    const hasOverlayActions = !!(overlay.tap_action || overlay.hold_action || overlay.double_tap_action);

    cblcarsLog.debug(`[StatusGridRenderer] 🔍 Processing status grid actions for ${overlay.id}:`, {
      totalCells: cells.length,
      cellsWithActions: cellsWithActions.length,
      hasOverlayActions,
      hasCardInstance: !!cardInstance,
      cellIds: cellsWithActions.map(c => c.id),
      sampleCell: cellsWithActions[0] ? {
        id: cellsWithActions[0].id,
        actions: cellsWithActions[0].actions
      } : null
    });

    // If no actions at all, return null
    if (cellsWithActions.length === 0 && !hasOverlayActions) {
      cblcarsLog.debug(`[StatusGridRenderer] No actions found for ${overlay.id}`);
      return null;
    }

    if (!cardInstance) {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Status grid ${overlay.id} has actions but no cardInstance available`);
      return null;
    }

    // CRITICAL: Build enhanced action config with FULL cell objects
    // The cells array must contain complete cell data including actions
    const actionInfo = {
      config: {
        enhanced: {
          cells: cellsWithActions.map(cell => ({
            cell_id: cell.id,
            tap_action: cell.actions?.tap_action,
            hold_action: cell.actions?.hold_action,
            double_tap_action: cell.actions?.double_tap_action
          })),
          default_tap: overlay.tap_action,
          default_hold: overlay.hold_action,
          default_double_tap: overlay.double_tap_action
        }
      },
      overlay: overlay,
      cardInstance: cardInstance,
      // CRITICAL: Pass full cell objects with complete actions
      // This is what AdvancedRenderer will use for attachment
      cells: cellsWithActions
    };

    cblcarsLog.debug(`[StatusGridRenderer] 🎯 Created enhanced action info for ${overlay.id}:`, {
      cellActionCount: cellsWithActions.length,
      hasDefaultActions: hasOverlayActions,
      configCells: actionInfo.config.enhanced.cells.length,
      dataCells: actionInfo.cells.length,
      firstCellDetailed: actionInfo.cells[0] ? {
        id: actionInfo.cells[0].id,
        hasActionsObject: !!actionInfo.cells[0].actions,
        hasTapAction: !!actionInfo.cells[0].actions?.tap_action,
        tapActionValue: actionInfo.cells[0].actions?.tap_action
      } : null
    });

    return actionInfo;
  }

  /**
   * Build LCARS-style brackets using the generalized BracketRenderer
   * @private
   */
  _buildBrackets(width, height, gridStyle, overlayId) {
    if (!gridStyle.bracket_style) {
      return '';
    }

    // Convert grid style properties to BracketRenderer format
    const bracketConfig = {
      enabled: true,
      style: typeof gridStyle.bracket_style === 'string' ? gridStyle.bracket_style : 'lcars',
      color: gridStyle.bracket_color,
      width: gridStyle.bracket_width,
      gap: gridStyle.bracket_gap,
      extension: gridStyle.bracket_extension,
      opacity: gridStyle.bracket_opacity,
      corners: gridStyle.bracket_corners,
      sides: gridStyle.bracket_sides,
      // Enhanced bg-grid style options
      bracket_width: gridStyle.bracket_physical_width,
      bracket_height: gridStyle.bracket_height,
      bracket_radius: gridStyle.bracket_radius,
      // LCARS container options
      border_top: gridStyle.border_top,
      border_left: gridStyle.border_left,
      border_right: gridStyle.border_right,
      border_bottom: gridStyle.border_bottom,
      border_color: gridStyle.border_color || gridStyle.bracket_color,
      border_radius: gridStyle.border_radius,
      inner_factor: gridStyle.inner_factor,
      hybrid_mode: gridStyle.hybrid_mode
    };

    return BracketRenderer.render(width, height, bracketConfig, overlayId);
  }

  // ============================================================================
  // 🔄 INCREMENTAL UPDATE SUPPORT
  // ============================================================================

  /**
   * Check if this renderer supports incremental updates
   * @static
   * @returns {boolean} True if incremental updates are supported
   */
  static supportsIncrementalUpdate() {
    return true;
  }

  /**
   * Perform incremental update on an existing rendered overlay
   * Called by SystemsManager when rules produce patches
   *
   * @static
   * @param {Object} overlay - Updated overlay config (with patches already applied)
   * @param {HTMLElement} overlayElement - Existing DOM element to update
   * @param {Object} context - Update context with dataSourceManager, systemsManager, hass, patch
   * @returns {boolean} True if update succeeded, false to trigger full re-render
   */
  static updateIncremental(overlay, overlayElement, context) {
    cblcarsLog.debug(`[StatusGridRenderer] 🎨 INCREMENTAL UPDATE: ${overlay.id}`);

    try {
      // Call static updateGridData method which handles DOM updates
      // Pass the full context so updateGridData can access dataSourceManager
      const success = StatusGridRenderer.updateGridData(overlayElement, overlay, context);

      if (success) {
        cblcarsLog.debug(`[StatusGridRenderer] ✅ INCREMENTAL UPDATE SUCCESS: ${overlay.id}`);
      } else {
        cblcarsLog.trace(`[StatusGridRenderer] ℹ️ INCREMENTAL UPDATE NO-OP: ${overlay.id} (no changes detected)`);
      }

      return success;
    } catch (error) {
      cblcarsLog.error(`[StatusGridRenderer] ❌ INCREMENTAL UPDATE ERROR: ${overlay.id}`, error);
      return false;
    }
  }

}
