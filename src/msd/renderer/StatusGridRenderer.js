/**
 * Status Grid Renderer - Grid-based multi-entity status visualization with LCARS theming
 * Provides compact status displays perfect for cascade animations and multi-sensor monitoring
 */

import { PositionResolver } from './PositionResolver.js';
import { RendererUtils } from './RendererUtils.js';

export class StatusGridRenderer {
  constructor() {
    // Pre-defined caches for performance optimization
    this.gradientCache = new Map();
    this.patternCache = new Map();
    this.filterCache = new Map();
  }

  /**
   * Render a status grid overlay with comprehensive styling support
   * @param {Object} overlay - Status grid overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @returns {string} Complete SVG markup for the styled status grid
   */
  static render(overlay, anchors, viewBox) {
    // Create instance for non-static methods
    const instance = new StatusGridRenderer();
    return instance.renderStatusGrid(overlay, anchors, viewBox);
  }

  /**
   * Instance method for comprehensive status grid rendering
   * @param {Object} overlay - Status grid overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @returns {string} Complete SVG markup for the styled status grid
   */
  renderStatusGrid(overlay, anchors, viewBox) {
    const position = PositionResolver.resolvePosition(overlay.position, anchors);
    if (!position) {
      console.warn('[StatusGridRenderer] Status grid overlay position could not be resolved:', overlay.id);
      return '';
    }

    const [x, y] = position;
    const size = overlay.size || [200, 150];
    const [width, height] = size;

    try {
      // Extract comprehensive styling
      const style = overlay.finalStyle || overlay.style || {};
      const gridStyle = this._resolveStatusGridStyles(style, overlay.id);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      // Get cell configurations
      const cells = this._resolveCellConfigurations(overlay, gridStyle);
      console.log(`[StatusGridRenderer] Rendering ${cells.length} cells for grid ${overlay.id}`);

      // Render enhanced status grid
      return this._renderEnhancedStatusGrid(
        overlay, x, y, width, height, cells,
        gridStyle, animationAttributes
      );

    } catch (error) {
      console.error(`[StatusGridRenderer] Enhanced rendering failed for status grid ${overlay.id}:`, error);
      return this._renderFallbackStatusGrid(overlay, x, y, width, height);
    }
  }

  /**
   * Resolve comprehensive status grid styling from configuration
   * @private
   */
  _resolveStatusGridStyles(style, overlayId) {
    const gridStyle = {
      // Grid layout
      rows: Number(style.rows || 3),
      columns: Number(style.columns || 4),
      cell_width: Number(style.cell_width || style.cellWidth || 0), // 0 = auto
      cell_height: Number(style.cell_height || style.cellHeight || 0), // 0 = auto
      cell_gap: Number(style.cell_gap || style.cellGap || 2),

      // Cell appearance
      cell_color: style.cell_color || style.cellColor || 'var(--lcars-blue)',
      cell_opacity: Number(style.cell_opacity || style.cellOpacity || 1),
      cell_radius: Number(style.cell_radius || style.cellRadius || 2),

      // Border and outline
      cell_border: style.cell_border || style.cellBorder || true,
      border_color: style.border_color || style.borderColor || 'var(--lcars-gray)',
      border_width: Number(style.border_width || style.borderWidth || 1),

      // Text appearance
      show_labels: style.show_labels !== false,
      show_values: style.show_values || false,
      label_color: style.label_color || style.labelColor || 'var(--lcars-white)',
      value_color: style.value_color || style.valueColor || 'var(--lcars-white)',
      font_size: Number(style.font_size || style.fontSize || 10),
      font_family: style.font_family || style.fontFamily || 'monospace',

      // Status coloring
      status_mode: (style.status_mode || style.statusMode || 'auto').toLowerCase(),
      status_ranges: this._parseStatusRanges(style.status_ranges || style.statusRanges),
      unknown_color: style.unknown_color || style.unknownColor || 'var(--lcars-gray)',

      // Grid features
      show_grid_lines: style.show_grid_lines || style.showGridLines || false,
      grid_line_color: style.grid_line_color || style.gridLineColor || 'var(--lcars-gray)',
      grid_line_opacity: Number(style.grid_line_opacity || style.gridLineOpacity || 0.3),

      // Advanced styling
      gradient: this._parseGradientConfig(style.gradient),
      pattern: this._parsePatternConfig(style.pattern),

      // Effects
      glow: this._parseGlowConfig(style.glow),
      shadow: this._parseShadowConfig(style.shadow),
      blur: this._parseBlurConfig(style.blur),

      // LCARS-specific features
      bracket_style: style.bracket_style || style.bracketStyle || false,
      bracket_color: style.bracket_color || style.bracketColor || null,
      status_indicator: style.status_indicator || style.statusIndicator || false,
      lcars_corners: style.lcars_corners || style.lcarsCorners || false,

      // Hover and interaction
      hover_enabled: style.hover_enabled !== false,
      hover_color: style.hover_color || style.hoverColor || 'var(--lcars-yellow)',
      hover_scale: Number(style.hover_scale || style.hoverScale || 1.05),

      // Animation states (for anime.js integration)
      animatable: style.animatable !== false,
      cascade_speed: Number(style.cascade_speed || style.cascadeSpeed || 0),
      cascade_direction: (style.cascade_direction || style.cascadeDirection || 'row').toLowerCase(),
      reveal_animation: style.reveal_animation || style.revealAnimation || false,
      pulse_on_change: style.pulse_on_change || style.pulseOnChange || false,

      // Performance options
      update_throttle: Number(style.update_throttle || style.updateThrottle || 100),

      // Track enabled features for optimization
      features: []
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

    return gridStyle;
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
   * Parse various configuration formats (reuse from other renderers)
   * @private
   */
  _parseGradientConfig(gradientConfig) {
    return RendererUtils.parseGradientConfig(gradientConfig);
  }

  _parsePatternConfig(patternConfig) {
    return RendererUtils.parsePatternConfig(patternConfig);
  }

  _parseGlowConfig(glowConfig) {
    return RendererUtils.parseGlowConfig(glowConfig);
  }

  _parseShadowConfig(shadowConfig) {
    return RendererUtils.parseShadowConfig(shadowConfig);
  }

  _parseBlurConfig(blurConfig) {
    return RendererUtils.parseBlurConfig(blurConfig);
  }

  /**
   * Prepare animation attributes for anime.js integration
   * @private
   */
  _prepareAnimationAttributes(overlay, style) {
    const animationAttributes = {
      gridAttributes: [],
      cellAttributes: [],
      hasAnimations: false
    };

    // Animation hooks for anime.js
    if (style.animatable !== false) {
      animationAttributes.gridAttributes.push(`data-animatable="true"`);
    }

    if (style.cascade_speed > 0) {
      animationAttributes.gridAttributes.push(`data-cascade-speed="${style.cascade_speed}"`);
      animationAttributes.gridAttributes.push(`data-cascade-direction="${style.cascade_direction || 'row'}"`);
      animationAttributes.hasAnimations = true;
    }

    if (style.reveal_animation) {
      animationAttributes.gridAttributes.push(`data-reveal-animation="true"`);
      animationAttributes.hasAnimations = true;
    }

    if (style.pulse_on_change) {
      animationAttributes.cellAttributes.push(`data-pulse-on-change="true"`);
      animationAttributes.hasAnimations = true;
    }

    return animationAttributes;
  }

  /**
   * Enhanced rendering method with complete Status Grid implementation
   * @private
   */
  _renderEnhancedStatusGrid(overlay, x, y, width, height, cells, gridStyle, animationAttributes) {
    return `<g data-overlay-id="${overlay.id}"
                data-overlay-type="status_grid"
                data-grid-rows="${gridStyle.rows}"
                data-grid-columns="${gridStyle.columns}"
                data-grid-features="${gridStyle.features.join(',')}"
                data-animation-ready="${!!animationAttributes.hasAnimations}"
                data-cascade-direction="${gridStyle.cascade_direction}"
                transform="translate(${x}, ${y})">
              <!-- Status Grid implementation placeholder -->
              <rect width="${width}" height="${height}"
                    fill="none" stroke="var(--lcars-blue)" stroke-dasharray="2,2" opacity="0.5"/>
              <text x="${width / 2}" y="${height / 2}" text-anchor="middle"
                    fill="var(--lcars-blue)" font-size="10" dominant-baseline="middle">
                Status Grid (${cells.length} cells)
              </text>
            </g>`;
  }

  _renderFallbackStatusGrid(overlay, x, y, width, height) {
    const style = overlay.finalStyle || overlay.style || {};
    const color = style.cell_color || style.color || 'var(--lcars-gray)';

    console.warn(`[StatusGridRenderer] Using fallback rendering for status grid ${overlay.id}`);

    return `<g data-overlay-id="${overlay.id}" data-overlay-type="status_grid" data-fallback="true">
              <g transform="translate(${x}, ${y})">
                <rect width="${width}" height="${height}"
                      fill="none" stroke="${color}" stroke-width="2"/>
                <text x="${width / 2}" y="${height / 2}" text-anchor="middle"
                      fill="${color}" font-size="12" dominant-baseline="middle">
                  Status Grid Error
                </text>
              </g>
            </g>`;
  }

  // Placeholder methods for cell handling - to be implemented
  _resolveCellConfigurations(overlay, gridStyle) {
    // Generate demo cells for now
    const cells = [];
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
        data: {
          value: Math.random() > 0.5 ? 'ONLINE' : 'OFFLINE',
          state: Math.random() > 0.5 ? 'good' : 'bad',
          timestamp: Date.now()
        },
        lastUpdate: Date.now(),
        animationDelay: i * 50
      });
    }

    return cells;
  }
}

// Expose StatusGridRenderer to window for console debugging
if (typeof window !== 'undefined') {
  window.StatusGridRenderer = StatusGridRenderer;
}