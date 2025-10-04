/**
 * [StatusGridRenderer] Status grid renderer - grid-based multi-entity status visualization with LCARS theming
 * 🔲 Provides compact status displays perfect for cascade animations and multi-sensor monitoring
 */

import { OverlayUtils } from './OverlayUtils.js';
import { RendererUtils } from './RendererUtils.js';
import { DataSourceMixin } from './DataSourceMixin.js';
import { BracketRenderer } from './BracketRenderer.js';
import { ActionHelpers } from './ActionHelpers.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';



export class StatusGridRenderer {
  constructor() {
    // Note: Caches removed as they were not being used in practice

    // Get defaults manager from global namespace
    this.defaults = (typeof window !== 'undefined') ? window.cblcars?.defaults : null;
  }

  /**
   * Get a default value with fallback and scaling context
   * @private
   */
  _getDefault(path, fallback = null, context = {}) {
    if (this.defaults) {
      return this.defaults.resolve(path, context) || fallback;
    }
    return fallback;
  }

  /**
   * Get scaling context for defaults resolution
   * @private
   */
  _getScalingContext(viewBox = null) {
    return {
      viewBox: viewBox || [0, 0, 400, 300], // Default viewBox if not provided
      scaleMode: 'viewbox', // Use viewBox scaling for responsive values
      preferredUnit: 'px'
    };
  }

  /**
   * Render a status grid overlay with comprehensive styling support
   * @param {Object} overlay - Status grid overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Object} cardInstance - Reference to custom-button-card instance for action handling
   * @returns {string} Complete SVG markup for the styled status grid (backwards compatible)
   */
  static render(overlay, anchors, viewBox, cardInstance = null) {
    const result = StatusGridRenderer.renderWithActions(overlay, anchors, viewBox, cardInstance);

    // Store action info for post-DOM-insertion processing
    if (result.needsActionAttachment) {
      StatusGridRenderer._storeActionInfo(overlay.id, result.actions);

      // Add fallback - try to process actions after a short delay
      setTimeout(() => {
        StatusGridRenderer._tryManualActionProcessing(overlay.id);
      }, 100);
    }

    return result.markup; // Return just markup for backwards compatibility
  }

  /**
   * Render status grid with action metadata (enhanced version)
   * @param {Object} overlay - Status grid overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Object} cardInstance - Reference to custom-button-card instance for action handling
   * @returns {Object} Object with markup, actions, and metadata
   * @static
   */
  static renderWithActions(overlay, anchors, viewBox, cardInstance = null) {
    // Create instance for non-static methods
    const instance = new StatusGridRenderer();
    return instance.renderStatusGrid(overlay, anchors, viewBox, cardInstance);
  }

  /**
   * Instance method for comprehensive status grid rendering
   * @param {Object} overlay - Status grid overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Object} cardInstance - Reference to custom-button-card instance for action handling
   * @returns {string} Complete SVG markup for the styled status grid
   */
  renderStatusGrid(overlay, anchors, viewBox, cardInstance = null) {
    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) {
      cblcarsLog.warn('[StatusGridRenderer] ⚠️ Status grid overlay position could not be resolved:', overlay.id);
      return '';
    }

    const [x, y] = position;
    const size = overlay.size || [200, 150];
    const [width, height] = size;

    try {
      // Extract comprehensive styling
      const style = overlay.finalStyle || overlay.style || {};
      const gridStyle = this._resolveStatusGridStyles(style, overlay.id, overlay);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      // Get cell configurations
      const cells = this._resolveCellConfigurations(overlay, gridStyle);
      cblcarsLog.debug(`[StatusGridRenderer] 🔲 Rendering ${cells.length} cells for grid ${overlay.id}`);

      // Render enhanced status grid
      const gridMarkup = this._renderEnhancedStatusGrid(
        overlay, x, y, width, height, cells,
        gridStyle, animationAttributes
      );

      // Process actions if available
      const actionInfo = this._processStatusGridActions(overlay, gridStyle, cardInstance);

      // Add cells to action info for cell-level action processing
      if (actionInfo) {
        actionInfo.cells = cells;
      }

      // Return both markup and action metadata for post-processing
      return {
        markup: gridMarkup,
        actions: actionInfo,
        needsActionAttachment: !!actionInfo
      };

    } catch (error) {
      cblcarsLog.error(`[StatusGridRenderer] ❌ Enhanced rendering failed for status grid ${overlay.id}:`, error);
      return {
        markup: this._renderFallbackStatusGrid(overlay, x, y, width, height),
        actions: null,
        needsActionAttachment: false
      };
    }
  }

  /**
   * Resolve comprehensive status grid styling from configuration
   * @private
   */
  _resolveStatusGridStyles(style, overlayId, overlay = null, viewBox = null) {
    // Parse all standard styles using unified system
    const standardStyles = RendererUtils.parseAllStandardStyles(style);

    // Get scaling context for responsive defaults
    const scalingContext = this._getScalingContext(viewBox);

    const gridStyle = {
      // Grid layout - Following documentation schema: rows/columns are in style
      rows: Number(style.rows || this._getDefault('status_grid.rows', 3)),
      columns: Number(style.columns || this._getDefault('status_grid.columns', 4)),
      cell_width: Number(style.cell_width || style.cellWidth || 0), // 0 = auto
      cell_height: Number(style.cell_height || style.cellHeight || 0), // 0 = auto
      cell_gap: Number(style.cell_gap || style.cellGap || this._getDefault('status_grid.cell_gap', 2)),

      // Proportional sizing configuration
      row_sizes: style.row_sizes || style.rowSizes || null,
      column_sizes: style.column_sizes || style.columnSizes || null,
      row_heights: style.row_heights || style.rowHeights || null,
      column_widths: style.column_widths || style.columnWidths || null,

      // Cell appearance (using standardized colors with defaults fallbacks)
      cell_color: standardStyles.colors.primaryColor || this._getDefault('status_grid.cell_color', 'var(--lcars-blue)'),
      cell_opacity: standardStyles.layout.opacity || this._getDefault('status_grid.cell_opacity', 1.0),
      cell_radius: Number(style.cell_radius || style.cellRadius || standardStyles.layout.borderRadius || this._getDefault('status_grid.cell_radius', 2)),
      normalize_radius: style.normalize_radius !== false && style.normalizeRadius !== false, // Default true unless explicitly set to false
      match_ha_radius: style.match_ha_radius !== false && style.matchHaRadius !== false, // Default true unless explicitly set to false

      // Border (using standardized layout with defaults)
      cell_border: style.cell_border || style.cellBorder !== false,
      border_color: standardStyles.colors.borderColor || this._getDefault('status_grid.border_color', 'var(--lcars-gray)'),
      border_width: standardStyles.layout.borderWidth || this._getDefault('status_grid.border_width', 1),

      // Text (using standardized text styles with proper fallbacks and defaults)
      show_labels: style.show_labels !== false,
      show_values: style.show_values || false, // Default to false per documentation
      label_color: standardStyles.text.labelColor || style.label_color || style.labelColor || this._getDefault('status_grid.label_color', 'var(--lcars-white)'),
      value_color: standardStyles.text.valueColor || style.value_color || style.valueColor || this._getDefault('status_grid.value_color', 'var(--lcars-white)'),
      font_size: Number(style.font_size || style.fontSize) || Math.max(standardStyles.text.fontSize || this._getDefault('status_grid.font_size', 12), 18),
      font_family: standardStyles.text.fontFamily || style.font_family || style.fontFamily || this._getDefault('status_grid.font_family', 'var(--lcars-font-family, Antonio)'),
      font_weight: standardStyles.text.fontWeight || style.font_weight || style.fontWeight || this._getDefault('status_grid.font_weight', 'normal'),

      // Enhanced text sizing with scaling support
      label_font_size: this._resolveScalableValue(style.label_font_size || style.labelFontSize, 'status_grid.label_font_size', 18, scalingContext),
      value_font_size: this._resolveScalableValue(style.value_font_size || style.valueFontSize, 'status_grid.value_font_size', 16, scalingContext),

      // PHASE 1: Smart font-relative defaults (fixes collision issues)
      // Calculate intelligent defaults based on actual font sizes to prevent overlap
      _baseFontSize: standardStyles.text.fontSize || Number(style.font_size || style.fontSize || this._getDefault('status_grid.font_size', 18)),
      _labelFontSize: this._parseNumericValue(this._resolveScalableValue(style.label_font_size || style.labelFontSize, 'status_grid.label_font_size', 18, scalingContext)),
      _valueFontSize: this._parseNumericValue(this._resolveScalableValue(style.value_font_size || style.valueFontSize, 'status_grid.value_font_size', 16, scalingContext)),

      // PHASE 2: Enhanced positioning system - allows CB-LCARS button card recreation
      text_layout: style.text_layout || style.textLayout || this._getDefault('status_grid.text_layout', 'stacked'), // stacked, side-by-side, label-only, value-only, custom
      text_alignment: style.text_alignment || style.textAlignment || this._getDefault('status_grid.text_alignment', 'center'), // center, top, bottom, custom
      text_justify: style.text_justify || style.textJustify || this._getDefault('status_grid.text_justify', 'center'), // left, center, right

      // Flexible positioning - supports both predefined and custom positions
      label_position: style.label_position || style.labelPosition || this._getDefault('status_grid.label_position', 'center-top'), // Predefined or custom object
      value_position: style.value_position || style.valuePosition || this._getDefault('status_grid.value_position', 'center-bottom'), // Predefined or custom object

      // Legacy positioning (backward compatible but calculated intelligently)
      text_spacing: this._calculateSmartTextSpacing(style), // Intelligent spacing calculation
      label_offset_y: this._calculateSmartLabelOffset(style), // Smart label positioning
      value_offset_y: this._calculateSmartValueOffset(style), // Smart value positioning

      // PHASE 3: Advanced layout options with scaling support
      text_padding: this._resolveScalableValue(style.text_padding || style.textPadding, 'status_grid.text_padding', 8, scalingContext),
      text_margin: Number(style.text_margin || style.textMargin || this._getDefault('status_grid.text_margin', 2)), // Margin between text elements
      text_wrap: style.text_wrap || style.textWrap || false, // Enable text wrapping
      max_text_width: style.max_text_width || style.maxTextWidth || this._getDefault('status_grid.max_text_width', '90%'), // Max width as percentage
      text_overflow: style.text_overflow || style.textOverflow || this._getDefault('status_grid.text_overflow', 'ellipsis'), // ellipsis, clip, none

      // CB-LCARS specific positioning presets
      lcars_text_preset: style.lcars_text_preset || style.lcarsTextPreset || null, // lozenge, bullet, corner, etc.

      // Status coloring
      status_mode: (style.status_mode || style.statusMode || this._getDefault('status_grid.status_mode', 'auto')).toLowerCase(),
      status_ranges: this._parseStatusRanges(style.status_ranges || style.statusRanges),
      unknown_color: standardStyles.colors.disabledColor || this._getDefault('status_grid.unknown_color', 'var(--lcars-gray)'),

      // Grid features
      show_grid_lines: style.show_grid_lines || style.showGridLines || false,
      grid_line_color: style.grid_line_color || style.gridLineColor || standardStyles.colors.borderColor || this._getDefault('status_grid.grid_line_color', 'var(--lcars-gray)'),
      grid_line_opacity: Number(style.grid_line_opacity || style.gridLineOpacity || this._getDefault('status_grid.grid_line_opacity', 0.3)),
      grid_line_width: Number(style.grid_line_width || style.gridLineWidth || this._getDefault('status_grid.grid_line_width', 1)), // Added missing grid line width control

      // Effects (using standardized effect parsing)
      gradient: standardStyles.gradient,
      pattern: standardStyles.pattern,
      glow: standardStyles.glow,
      shadow: standardStyles.shadow,
      blur: standardStyles.blur,

      // LCARS-specific features with defaults
      bracket_style: style.bracket_style || style.bracketStyle || false,
      bracket_color: style.bracket_color || style.bracketColor || standardStyles.colors.primaryColor || this._getDefault('status_grid.bracket_color', null),
      bracket_width: Number(style.bracket_width || style.bracketWidth || this._getDefault('status_grid.bracket_width', 2)),
      bracket_gap: Number(style.bracket_gap || style.bracketGap || this._getDefault('status_grid.bracket_gap', 4)),
      bracket_extension: Number(style.bracket_extension || style.bracketExtension || this._getDefault('status_grid.bracket_extension', 8)),
      bracket_opacity: Number(style.bracket_opacity || style.bracketOpacity || this._getDefault('status_grid.bracket_opacity', 1)),
      bracket_corners: style.bracket_corners || style.bracketCorners || this._getDefault('status_grid.bracket_corners', 'both'),
      bracket_sides: style.bracket_sides || style.bracketSides || this._getDefault('status_grid.bracket_sides', 'both'),
      // Enhanced bg-grid style bracket options
      bracket_physical_width: Number(style.bracket_physical_width || style.bracketPhysicalWidth || style.bracket_extension || this._getDefault('status_grid.bracket_physical_width', 8)),
      bracket_height: style.bracket_height || style.bracketHeight || this._getDefault('status_grid.bracket_height', '100%'),
      bracket_radius: Number(style.bracket_radius || style.bracketRadius || this._getDefault('status_grid.bracket_radius', 4)),
      // LCARS container/border options
      border_top: Number(style.border_top || 0),
      border_left: Number(style.border_left || 0),
      border_right: Number(style.border_right || 0),
      border_bottom: Number(style.border_bottom || 0),
      border_color: style.border_color || null,
      border_radius: Number(style.border_radius || this._getDefault('status_grid.border_radius', 8)),
      inner_factor: Number(style.inner_factor || this._getDefault('status_grid.inner_factor', 2)),
      hybrid_mode: style.hybrid_mode || false,
      status_indicator: style.status_indicator || style.statusIndicator || false,
      lcars_corners: style.lcars_corners || style.lcarsCorners || false,

      // Interaction (using standardized interaction styles)
      hover_enabled: standardStyles.interaction.hoverEnabled,
      hover_color: standardStyles.colors.hoverColor || this._getDefault('status_grid.hover_color', 'var(--lcars-yellow)'),
      hover_scale: standardStyles.interaction.hoverScale || this._getDefault('status_grid.hover_scale', 1.05),

      // Animation (using standardized animation styles)
      animatable: standardStyles.animation.animatable,
      cascade_speed: standardStyles.animation.cascadeSpeed || this._getDefault('status_grid.cascade_speed', 0),
      cascade_direction: standardStyles.animation.cascadeDirection || this._getDefault('status_grid.cascade_direction', 'row'),
      reveal_animation: standardStyles.animation.revealAnimation || this._getDefault('status_grid.reveal_animation', false),
      pulse_on_change: standardStyles.animation.pulseOnChange || this._getDefault('status_grid.pulse_on_change', false),

      // Actions (NEW - Tier 2 Enhanced Actions)
      actions: style.actions || null,               // Enhanced multi-target actions block

      // Performance options
      update_throttle: Number(style.update_throttle || style.updateThrottle || this._getDefault('status_grid.update_throttle', 100)),

      // Track enabled features for optimization
      features: [],

      // Store parsed standard styles for reference
      standardStyles
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

    return gridStyle;
  }  /**
   * Calculate intelligent text spacing based on font sizes (Phase 1: Collision Fix)
   * @private
   * @param {Object} style - Style configuration
   * @returns {number} Calculated text spacing in pixels
   */
  _calculateSmartTextSpacing(style) {
    // If explicitly set, use that value
    if (style.text_spacing !== undefined || style.textSpacing !== undefined) {
      return Number(style.text_spacing || style.textSpacing);
    }

    // Calculate based on font sizes
    const labelFontSize = Number(style.label_font_size || style.labelFontSize || style.font_size || style.fontSize || 18);
    const valueFontSize = Number(style.value_font_size || style.valueFontSize || (labelFontSize * 0.9));

    // Use the larger font size as basis for spacing (prevents overlap)
    const maxFontSize = Math.max(labelFontSize, valueFontSize);

    // Intelligent spacing: 30% of the larger font size, minimum 4px
    return Math.max(4, Math.round(maxFontSize * 0.3));
  }

  /**
   * Calculate intelligent label positioning based on font size (Phase 1: Collision Fix)
   * @private
   * @param {Object} style - Style configuration
   * @returns {number} Calculated label offset in pixels
   */
  _calculateSmartLabelOffset(style) {
    // If explicitly set, use that value
    if (style.label_offset_y !== undefined || style.labelOffsetY !== undefined) {
      return Number(style.label_offset_y || style.labelOffsetY);
    }

    const labelFontSize = Number(style.label_font_size || style.labelFontSize || style.font_size || style.fontSize || 18);
    const spacing = this._calculateSmartTextSpacing(style);

    // Position label above center by half spacing + 20% of font size
    return -(spacing * 0.5 + labelFontSize * 0.2);
  }

  /**
   * Calculate intelligent value positioning based on font size (Phase 1: Collision Fix)
   * @private
   * @param {Object} style - Style configuration
   * @returns {number} Calculated value offset in pixels
   */
  _calculateSmartValueOffset(style) {
    // If explicitly set, use that value
    if (style.value_offset_y !== undefined || style.valueOffsetY !== undefined) {
      return Number(style.value_offset_y || style.valueOffsetY);
    }

    const valueFontSize = Number(style.value_font_size || style.valueFontSize ||
                                (style.font_size || style.fontSize || 18) * 0.9);
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

    // Handle LCARS presets first
    if (gridStyle.lcars_text_preset) {
      return this._calculateLCARSPresetPosition(gridStyle.lcars_text_preset, cellX, cellY, cellWidth, cellHeight, gridStyle, textType);
    }

    // Custom position object (Phase 2)
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

    // Predefined position strings (Phase 2)
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
    // For rounded corners, we need extra padding to avoid text cutoff
    // The corner radius creates a "dead zone" where text shouldn't be placed

    // Calculate the "safe zone" distance from corner
    // This is roughly 70% of the radius (trigonometric approximation)
    const cornerClearance = cornerRadius * 0.7;

    // Add extra padding for font clearance (about 20% of font size)
    const fontClearance = fontSize * 0.2;

    // Use the larger of: base padding, corner clearance, or minimum for font
    return Math.max(basePadding, cornerClearance + fontClearance, fontSize * 0.3);
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
          // FIXED: Better responsive positioning for bottom-right value
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
    if (typeof value === 'number') {
      return value;
    }

    const stringValue = String(value);

    if (stringValue.includes('%')) {
      const percentage = parseFloat(stringValue.replace('%', ''));
      return (dimension * percentage) / 100;
    }

    if (stringValue.includes('px')) {
      return parseFloat(stringValue.replace('px', ''));
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
   * Enhanced rendering method with complete Status Grid implementation
   * @private
   */
  _renderEnhancedStatusGrid(overlay, x, y, width, height, cells, gridStyle, animationAttributes) {
    // Calculate cell dimensions with proportional sizing support
    const { cellWidths, cellHeights } = this._calculateProportionalCellDimensions(width, height, gridStyle);
    const gap = gridStyle.cell_gap;

    // Check if overlay has actions (actions should now be preserved in main overlay by ModelBuilder)
    const hasActions = !!(overlay.tap_action || overlay.hold_action || overlay.double_tap_action || gridStyle.actions);

    // Start building the grid SVG
    let gridMarkup = `<g data-overlay-id="${overlay.id}"
                data-overlay-type="status_grid"
                data-grid-rows="${gridStyle.rows}"
                data-grid-columns="${gridStyle.columns}"
                data-grid-features="${gridStyle.features.join(',')}"
                data-animation-ready="${!!animationAttributes.hasAnimations}"
                data-cascade-direction="${gridStyle.cascade_direction}"
                style="pointer-events: ${hasActions ? 'visiblePainted' : 'none'}; cursor: ${hasActions ? 'pointer' : 'default'};"
                transform="translate(${x}, ${y})">`;

    // Render grid background if enabled
    if (gridStyle.show_grid_lines) {
      gridMarkup += `<rect width="${width}" height="${height}"
                     fill="none" stroke="${gridStyle.grid_line_color}"
                     stroke-width="${gridStyle.grid_line_width}" opacity="${gridStyle.grid_line_opacity}"/>`;
    }

    // Render each cell
    cells.forEach(cell => {
      // Calculate cell position using proportional sizing
      const cellX = this._calculateCellX(cell.col, cellWidths, gap);
      const cellY = this._calculateCellY(cell.row, cellHeights, gap);
      const cellWidth = cellWidths[cell.col];
      const cellHeight = cellHeights[cell.row];

      // Determine cell color based on status or cell-level override
      const cellColor = cell.cellOverrides?.color || this._determineCellColor(cell, gridStyle);

      // Determine cell corner radius (cell override, LCARS corners, or regular)
      let cellCornerRadius = cell.cellOverrides?.radius !== null ? cell.cellOverrides?.radius : gridStyle.cell_radius;

      // Apply radius normalization for consistent visual appearance across different cell sizes
      if (gridStyle.normalize_radius && cell.cellOverrides?.radius === null) {
        cellCornerRadius = this._calculateNormalizedRadius(cellWidth, cellHeight, gridStyle.cell_radius, gridStyle.match_ha_radius);
      }

      // Apply LCARS corners if enabled and no cell-level radius override
      if (gridStyle.lcars_corners && cell.cellOverrides?.radius === null) {
        const isTopRow = cell.row === 0;
        const isBottomRow = cell.row === gridStyle.rows - 1;
        const isLeftCol = cell.col === 0;
        const isRightCol = cell.col === gridStyle.columns - 1;

        // LCARS corners only on outer edges
        if (isTopRow && isLeftCol) cellCornerRadius = 0; // Top-left corner cut
        else if (isTopRow && isRightCol) cellCornerRadius = 0; // Top-right corner cut
        else if (isBottomRow && isLeftCol) cellCornerRadius = 0; // Bottom-left corner cut
        else if (isBottomRow && isRightCol) cellCornerRadius = 0; // Bottom-right corner cut
        else {
          // For interior cells, use normalized radius if enabled, otherwise small radius
          cellCornerRadius = gridStyle.normalize_radius ?
            this._calculateNormalizedRadius(cellWidth, cellHeight, 2, gridStyle.match_ha_radius) :
            Math.min(gridStyle.cell_radius, 2);
        }
      }

      // Debug: Check if this cell has specific actions
      const cellHasActions = !!(cell.actions && (cell.actions.tap_action || cell.actions.hold_action || cell.actions.double_tap_action));

      cblcarsLog.debug(`[StatusGridRenderer] 🔲 Rendering cell ${cell.id}:`, {
        cellHasActions: cellHasActions,
        cellActions: cell.actions,
        position: [cellX, cellY],
        size: [cellWidth, cellHeight]
      });

      // ENHANCED: Wrap cell and its content in a group for unified action handling
      gridMarkup += `<g data-cell-id="${cell.id}"
                        data-cell-row="${cell.row}"
                        data-cell-col="${cell.col}"
                        data-has-cell-actions="${cellHasActions}"
                        style="pointer-events: ${hasActions || cellHasActions ? 'visiblePainted' : 'none'}; cursor: ${hasActions || cellHasActions ? 'pointer' : 'default'};">`;

      // Render cell rectangle (simplified - group handles the actions)
      gridMarkup += `<rect x="${cellX}" y="${cellY}"
                     width="${cellWidth}" height="${cellHeight}"
                     fill="${cellColor}"
                     stroke="${gridStyle.border_color}"
                     stroke-width="${gridStyle.border_width}"
                     rx="${cellCornerRadius}"
                     data-lcars-corner="${gridStyle.lcars_corners && (cell.row === 0 || cell.row === gridStyle.rows - 1) && (cell.col === 0 || cell.col === gridStyle.columns - 1)}"
                     style="pointer-events: inherit;"
                     />`;

      // Render cell label if enabled using enhanced positioning
      if (gridStyle.show_labels && cell.label) {
        const labelFontSize = cell.cellOverrides?.font_size || gridStyle.label_font_size;

        // Use enhanced positioning system or legacy fallback
        let labelPosition;
        if (gridStyle.lcars_text_preset || (gridStyle.label_position && gridStyle.label_position !== 'center-top')) {
          // Enhanced positioning system
          labelPosition = this._calculateEnhancedTextPosition(
            gridStyle.label_position, cellX, cellY, cellWidth, cellHeight, gridStyle, 'label'
          );
        } else {
          // Legacy positioning for backward compatibility
          labelPosition = {
            x: cellX + cellWidth / 2,
            y: cellY + cellHeight / 2 + gridStyle.label_offset_y,
            anchor: 'middle',
            baseline: 'middle'
          };
        }

        gridMarkup += `<text x="${labelPosition.x}" y="${labelPosition.y}"
                       text-anchor="${labelPosition.anchor}" dominant-baseline="${labelPosition.baseline}"
                       fill="${gridStyle.label_color}"
                       font-size="${labelFontSize}"
                       font-family="${gridStyle.font_family}"
                       font-weight="${gridStyle.font_weight}"
                       style="pointer-events: inherit; user-select: none; cursor: inherit;"
                       data-cell-label="${cell.id}">
                       ${this._escapeXml(cell.label)}
                     </text>`;
      }

      // Render cell content/value if enabled using enhanced positioning
      if (gridStyle.show_values && cell.content) {
        // Use enhanced positioning system or legacy fallback
        let valuePosition;
        if (gridStyle.lcars_text_preset || (gridStyle.value_position && gridStyle.value_position !== 'center-bottom')) {
          // Enhanced positioning system
          valuePosition = this._calculateEnhancedTextPosition(
            gridStyle.value_position, cellX, cellY, cellWidth, cellHeight, gridStyle, 'value'
          );
        } else {
          // Legacy positioning for backward compatibility
          valuePosition = {
            x: cellX + cellWidth / 2,
            y: cellY + cellHeight / 2 + gridStyle.value_offset_y,
            anchor: 'middle',
            baseline: 'middle'
          };
        }

        gridMarkup += `<text x="${valuePosition.x}" y="${valuePosition.y}"
                       text-anchor="${valuePosition.anchor}" dominant-baseline="${valuePosition.baseline}"
                       fill="${gridStyle.value_color}"
                       font-size="${gridStyle.value_font_size}"
                       font-family="${gridStyle.font_family}"
                       font-weight="${gridStyle.font_weight}"
                       style="pointer-events: inherit; user-select: none; cursor: inherit;"
                       data-cell-content="${cell.id}">
                       ${this._escapeXml(cell.content || String(cell.data.value))}
                     </text>`;
      }

      // Close the cell group after all cell content is added
      gridMarkup += `</g>`;
    });

    gridMarkup += '</g>';

    // Add brackets around the entire grid if enabled
    if (gridStyle.bracket_style) {
      const bracketSvg = this._buildBrackets(width, height, gridStyle, overlay.id);
      if (bracketSvg) {
        gridMarkup = gridMarkup.slice(0, -4) + bracketSvg + '</g>'; // Insert before closing </g>
      }
    }

    // Make text elements clickable as part of their parent cells
    gridMarkup = StatusGridRenderer._makeTextElementsClickable(gridMarkup, cells);

    return gridMarkup;
  }

  /**
   * Close cell group in grid markup
   * @param {string} gridMarkup - Current grid markup
   * @returns {string} Markup with cell group closed
   * @private
   * @static
   */
  static _closeCellGroup(gridMarkup) {
    return gridMarkup + `</g>`;
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
   * Calculate proportional cell dimensions based on grid configuration
   * @private
   */
  _calculateProportionalCellDimensions(totalWidth, totalHeight, gridStyle) {
    const rows = gridStyle.rows;
    const columns = gridStyle.columns;
    const gap = gridStyle.cell_gap;

    // Calculate available space after gaps (ensure non-negative)
    const gapWidth = gap * Math.max(0, columns - 1);
    const gapHeight = gap * Math.max(0, rows - 1);
    const availableWidth = Math.max(0, totalWidth - gapWidth);
    const availableHeight = Math.max(0, totalHeight - gapHeight);

    // Debug space calculations
    cblcarsLog.debug(`[StatusGridRenderer] Space calculation:`, {
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
    if (!sizing || !Array.isArray(sizing)) {
      // Equal sizing - divide space equally
      const size = totalSpace / count;
      return Array(count).fill(size);
    }

    // Validate array length matches expected count
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
            cblcarsLog.debug(`[StatusGridRenderer] Using HA card radius: ${radius}px from ${variable}`);
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
   * Escape XML special characters
   * @private
   */
  _escapeXml(text) {
    if (typeof text !== 'string') return String(text);
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  /**
   * Process action configuration for status grid
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Object} gridStyle - Resolved grid styling
   * @param {Object} cardInstance - Card instance for action handling
   * @returns {Object|null} Action configuration for ActionHelpers
   */
  _processStatusGridActions(overlay, gridStyle, cardInstance) {
    // Try to get card instance from various sources
    if (!cardInstance) {
      cardInstance = ActionHelpers.resolveCardInstance();
    }

    // Use the generic ActionHelpers method for consistency
    return ActionHelpers.processOverlayActions(overlay, gridStyle, cardInstance);
  }

  _renderFallbackStatusGrid(overlay, x, y, width, height) {
    const style = overlay.finalStyle || overlay.style || {};
    const color = style.cell_color || style.color || 'var(--lcars-gray)';

    cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Using fallback rendering for status grid ${overlay.id}`);

    return `<g data-overlay-id="${overlay.id}" data-overlay-type="status_grid" data-fallback="true">
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
   * Resolve a scalable value (either from style or defaults)
   * @private
   */
  _resolveScalableValue(styleValue, defaultPath, fallbackValue, scalingContext) {
    // If explicitly provided in style, use it directly
    if (styleValue !== undefined && styleValue !== null) {
      return this._parseNumericValue(styleValue);
    }

    // Try to get from defaults with scaling context
    const defaultValue = this._getDefault(defaultPath, null, scalingContext);
    if (defaultValue !== null) {
      return this._parseNumericValue(defaultValue);
    }

    // Final fallback
    return fallbackValue;
  }

  /**
   * Parse numeric value from various formats (string with unit, object with value, plain number)
   * @private
   */
  _parseNumericValue(value) {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      // Remove 'px' suffix if present
      const numericValue = parseFloat(value.replace('px', ''));
      return isNaN(numericValue) ? 0 : numericValue;
    }

    if (typeof value === 'object' && value !== null && 'value' in value) {
      return this._parseNumericValue(value.value);
    }

    return 0;
  }

  /**
   * Clean up action system resources
   * @static
   */
  static cleanup() {
    // Disconnect observer
    if (window._msdStatusGridObserver) {
      window._msdStatusGridObserver.disconnect();
      delete window._msdStatusGridObserver;
    }

    // Clear pending actions
    if (window._msdStatusGridActions) {
      window._msdStatusGridActions.clear();
      delete window._msdStatusGridActions;
    }

    cblcarsLog.debug(`[StatusGridRenderer] Action system cleaned up`);
  }

  /**
   * Try manual action processing for a specific overlay
   * @private
   * @static
   */
  static _tryManualActionProcessing(overlayId) {
    if (!window._msdStatusGridActions?.has(overlayId)) {
      return;
    }

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
      const actionInfo = window._msdStatusGridActions.get(overlayId);
      cblcarsLog.debug(`[StatusGridRenderer] 🎯 Manual action processing for ${overlayId}`);
      StatusGridRenderer.attachStatusGridActions(gridElement, actionInfo);
      window._msdStatusGridActions.delete(overlayId);
    } else {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Could not find status grid element for manual action processing: ${overlayId}`);
    }
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
   * Store action information for later processing
   * @private
   * @static
   */
  static _storeActionInfo(overlayId, actionInfo) {
    if (!window._msdStatusGridActions) {
      window._msdStatusGridActions = new Map();
    }

    window._msdStatusGridActions.set(overlayId, actionInfo);
    cblcarsLog.debug(`[StatusGridRenderer] 📦 Stored action info for ${overlayId}`);

    // Set up observer if not already active
    if (!window._msdStatusGridObserver) {
      StatusGridRenderer._setupActionObserver();
    }
  }

  /**
   * Set up DOM observer for automatic action attachment
   * @private
   * @static
   */
  static _setupActionObserver() {
    if (typeof MutationObserver === 'undefined') {
      cblcarsLog.warn('[StatusGridRenderer] ⚠️ MutationObserver not available');
      return;
    }

    window._msdStatusGridObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const statusGrids = node.querySelectorAll ?
              node.querySelectorAll('[data-overlay-type="status_grid"]') : [];

            statusGrids.forEach((grid) => {
              const overlayId = grid.getAttribute('data-overlay-id');
              if (overlayId && window._msdStatusGridActions?.has(overlayId)) {
                const actionInfo = window._msdStatusGridActions.get(overlayId);
                StatusGridRenderer.attachStatusGridActions(grid, actionInfo);
                window._msdStatusGridActions.delete(overlayId);
              }
            });
          }
        });
      });
    });

    // Observe changes to document body
    window._msdStatusGridObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    cblcarsLog.debug('[StatusGridRenderer] 👀 Action observer set up');
  }

  /**
   * Attach actions to a status grid element
   * @static
   */
  static attachStatusGridActions(gridElement, actionInfo) {
    if (!gridElement || !actionInfo) {
      return;
    }

    cblcarsLog.debug(`[StatusGridRenderer] 🎯 Attaching actions to status grid:`, actionInfo);

    // Use ActionHelpers to attach actions
    if (window.ActionHelpers && window.ActionHelpers.attachOverlayActions) {
      window.ActionHelpers.attachOverlayActions(gridElement, actionInfo);
    } else {
      cblcarsLog.warn('[StatusGridRenderer] ⚠️ ActionHelpers not available for action attachment');
    }
  }

  /**
   * Process all pending actions manually
   * @static
   */
  static processAllPendingActions() {
    if (!window._msdStatusGridActions || window._msdStatusGridActions.size === 0) {
      cblcarsLog.debug('[StatusGridRenderer] No pending actions to process');
      return;
    }

    const pendingIds = Array.from(window._msdStatusGridActions.keys());
    cblcarsLog.debug(`[StatusGridRenderer] 🔄 Processing ${pendingIds.length} pending actions`);

    pendingIds.forEach(overlayId => {
      StatusGridRenderer._tryManualActionProcessing(overlayId);
    });
  }

  /**
   * Resolve cell configurations from overlay definition
   * @private
   */
  _resolveCellConfigurations(overlay, gridStyle) {
    const cells = [];
    const totalCells = gridStyle.rows * gridStyle.columns;

    // If overlay has explicit cells configuration, use that
    if (overlay.cells && Array.isArray(overlay.cells)) {
      overlay.cells.forEach((cell, index) => {
        if (index < totalCells) {
          const row = Math.floor(index / gridStyle.columns);
          const col = index % gridStyle.columns;

          cells.push({
            id: cell.id || `cell_${row}_${col}`,
            row,
            col,
            position: [row, col],
            label: cell.label || cell.name || '',
            content: cell.content || cell.value || '',
            data: {
              value: cell.value || cell.data?.value || '',
              state: cell.state || cell.data?.state || 'unknown'
            },
            cellOverrides: {
              color: cell.color || null,
              radius: cell.radius || null,
              font_size: cell.font_size || null
            },
            actions: cell.actions || null
          });
        }
      });
    } else {
      // Generate default cells
      for (let row = 0; row < gridStyle.rows; row++) {
        for (let col = 0; col < gridStyle.columns; col++) {
          cells.push({
            id: `cell_${row}_${col}`,
            row,
            col,
            position: [row, col],
            label: `${row},${col}`,
            content: '',
            data: {
              value: '',
              state: 'unknown'
            },
            cellOverrides: {
              color: null,
              radius: null,
              font_size: null
            },
            actions: null
          });
        }
      }
    }

    return cells;
  }
}

// Expose StatusGridRenderer to window for console debugging
if (typeof window !== 'undefined') {
  window.StatusGridRenderer = StatusGridRenderer;

  // Add debug helpers for action system
  window._debugStatusGridActions = () => StatusGridRenderer.getActionDebugInfo();
  window._processStatusGridActions = () => StatusGridRenderer.processAllPendingActions();
}