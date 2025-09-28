/**
 * [StatusGridRenderer] Status grid renderer - grid-based multi-entity status visualization with LCARS theming
 * 🔲 Provides compact status displays perfect for cascade animations and multi-sensor monitoring
 */

import { OverlayUtils } from './OverlayUtils.js';
import { RendererUtils } from './RendererUtils.js';
import { DataSourceMixin } from './DataSourceMixin.js';
import { BracketRenderer } from './BracketRenderer.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class StatusGridRenderer {
  constructor() {
    // Note: Caches removed as they were not being used in practice
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
      return this._renderEnhancedStatusGrid(
        overlay, x, y, width, height, cells,
        gridStyle, animationAttributes
      );

    } catch (error) {
      cblcarsLog.error(`[StatusGridRenderer] ❌ Enhanced rendering failed for status grid ${overlay.id}:`, error);
      return this._renderFallbackStatusGrid(overlay, x, y, width, height);
    }
  }

  /**
   * Resolve comprehensive status grid styling from configuration
   * @private
   */
  _resolveStatusGridStyles(style, overlayId, overlay = null) {
    // Parse all standard styles using unified system
    const standardStyles = RendererUtils.parseAllStandardStyles(style);

    const gridStyle = {
      // Grid layout - Following documentation schema: rows/columns are in style
      rows: Number(style.rows || 3),
      columns: Number(style.columns || 4),
      cell_width: Number(style.cell_width || style.cellWidth || 0), // 0 = auto
      cell_height: Number(style.cell_height || style.cellHeight || 0), // 0 = auto
      cell_gap: Number(style.cell_gap || style.cellGap || 2),

      // Cell appearance (using standardized colors)
      cell_color: standardStyles.colors.primaryColor,
      cell_opacity: standardStyles.layout.opacity,
      cell_radius: Number(style.cell_radius || style.cellRadius || standardStyles.layout.borderRadius || 2),

      // Border (using standardized layout)
      cell_border: style.cell_border || style.cellBorder !== false,
      border_color: standardStyles.colors.borderColor,
      border_width: standardStyles.layout.borderWidth,

      // Text (using standardized text styles with proper fallbacks)
      show_labels: style.show_labels !== false,
      show_values: style.show_values || false, // Default to false per documentation
      label_color: standardStyles.text.labelColor || style.label_color || style.labelColor || 'var(--lcars-white)',
      value_color: standardStyles.text.valueColor || style.value_color || style.valueColor || 'var(--lcars-white)',
      font_size: standardStyles.text.fontSize || Number(style.font_size || style.fontSize || 10),
      font_family: standardStyles.text.fontFamily || style.font_family || style.fontFamily || 'var(--lcars-font-family, Antonio)',
      font_weight: standardStyles.text.fontWeight || style.font_weight || style.fontWeight || 'normal',

      // Line spacing and positioning controls
      label_font_size: Number(style.label_font_size || style.labelFontSize || standardStyles.text.fontSize || 10),
      value_font_size: Number(style.value_font_size || style.valueFontSize || (standardStyles.text.fontSize * 0.9) || 9),
      text_spacing: Number(style.text_spacing || style.textSpacing || 4), // Vertical spacing between label and value
      label_offset_y: Number(style.label_offset_y || style.labelOffsetY || -2), // Label vertical offset from center
      value_offset_y: Number(style.value_offset_y || style.valueOffsetY || 8), // Value vertical offset from center

      // Status coloring
      status_mode: (style.status_mode || style.statusMode || 'auto').toLowerCase(),
      status_ranges: this._parseStatusRanges(style.status_ranges || style.statusRanges),
      unknown_color: standardStyles.colors.disabledColor,

      // Grid features
      show_grid_lines: style.show_grid_lines || style.showGridLines || false,
      grid_line_color: style.grid_line_color || style.gridLineColor || standardStyles.colors.borderColor,
      grid_line_opacity: Number(style.grid_line_opacity || style.gridLineOpacity || 0.3),
      grid_line_width: Number(style.grid_line_width || style.gridLineWidth || 1), // Added missing grid line width control

      // Effects (using standardized effect parsing)
      gradient: standardStyles.gradient,
      pattern: standardStyles.pattern,
      glow: standardStyles.glow,
      shadow: standardStyles.shadow,
      blur: standardStyles.blur,

      // LCARS-specific features
      bracket_style: style.bracket_style || style.bracketStyle || false,
      bracket_color: style.bracket_color || style.bracketColor || standardStyles.colors.primaryColor,
      bracket_width: Number(style.bracket_width || style.bracketWidth || 2),
      bracket_gap: Number(style.bracket_gap || style.bracketGap || 4),
      bracket_extension: Number(style.bracket_extension || style.bracketExtension || 8),
      bracket_opacity: Number(style.bracket_opacity || style.bracketOpacity || 1),
      bracket_corners: style.bracket_corners || style.bracketCorners || 'both',
      bracket_sides: style.bracket_sides || style.bracketSides || 'both',
      // Enhanced bg-grid style bracket options
      bracket_physical_width: Number(style.bracket_physical_width || style.bracketPhysicalWidth || style.bracket_extension || 8),
      bracket_height: style.bracket_height || style.bracketHeight || '100%',
      bracket_radius: Number(style.bracket_radius || style.bracketRadius || 4),
      // LCARS container/border options
      border_top: Number(style.border_top || 0),
      border_left: Number(style.border_left || 0),
      border_right: Number(style.border_right || 0),
      border_bottom: Number(style.border_bottom || 0),
      border_color: style.border_color || null,
      border_radius: Number(style.border_radius || 8),
      inner_factor: Number(style.inner_factor || 2),
      hybrid_mode: style.hybrid_mode || false,
      status_indicator: style.status_indicator || style.statusIndicator || false,
      lcars_corners: style.lcars_corners || style.lcarsCorners || false,

      // Interaction (using standardized interaction styles)
      hover_enabled: standardStyles.interaction.hoverEnabled,
      hover_color: standardStyles.colors.hoverColor,
      hover_scale: standardStyles.interaction.hoverScale,

      // Animation (using standardized animation styles)
      animatable: standardStyles.animation.animatable,
      cascade_speed: standardStyles.animation.cascadeSpeed,
      cascade_direction: standardStyles.animation.cascadeDirection,
      reveal_animation: standardStyles.animation.revealAnimation,
      pulse_on_change: standardStyles.animation.pulseOnChange,

      // Performance options
      update_throttle: Number(style.update_throttle || style.updateThrottle || 100),

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

    return gridStyle;
  }  /**
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
    // Calculate cell dimensions
    const cellWidth = gridStyle.cell_width || (width / gridStyle.columns);
    const cellHeight = gridStyle.cell_height || (height / gridStyle.rows);
    const gap = gridStyle.cell_gap;

    // Start building the grid SVG
    let gridMarkup = `<g data-overlay-id="${overlay.id}"
                data-overlay-type="status_grid"
                data-grid-rows="${gridStyle.rows}"
                data-grid-columns="${gridStyle.columns}"
                data-grid-features="${gridStyle.features.join(',')}"
                data-animation-ready="${!!animationAttributes.hasAnimations}"
                data-cascade-direction="${gridStyle.cascade_direction}"
                transform="translate(${x}, ${y})">`;

    // Render grid background if enabled
    if (gridStyle.show_grid_lines) {
      gridMarkup += `<rect width="${width}" height="${height}"
                     fill="none" stroke="${gridStyle.grid_line_color}"
                     stroke-width="${gridStyle.grid_line_width}" opacity="${gridStyle.grid_line_opacity}"/>`;
    }

    // Render each cell
    cells.forEach(cell => {
      const cellX = cell.col * (cellWidth + gap);
      const cellY = cell.row * (cellHeight + gap);

      // Determine cell color based on status or cell-level override
      const cellColor = cell.cellOverrides?.color || this._determineCellColor(cell, gridStyle);

      // Determine cell corner radius (cell override, LCARS corners, or regular)
      let cellCornerRadius = cell.cellOverrides?.radius !== null ? cell.cellOverrides?.radius : gridStyle.cell_radius;

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
        else cellCornerRadius = Math.min(gridStyle.cell_radius, 2); // Interior cells get small radius
      }

      // Render cell rectangle
      gridMarkup += `<rect x="${cellX}" y="${cellY}"
                     width="${cellWidth - gap}" height="${cellHeight - gap}"
                     fill="${cellColor}"
                     stroke="${gridStyle.border_color}"
                     stroke-width="${gridStyle.border_width}"
                     rx="${cellCornerRadius}"
                     data-cell-id="${cell.id}"
                     data-cell-row="${cell.row}"
                     data-cell-col="${cell.col}"
                     data-lcars-corner="${gridStyle.lcars_corners && (cell.row === 0 || cell.row === gridStyle.rows - 1) && (cell.col === 0 || cell.col === gridStyle.columns - 1)}"/>`;

      // Render cell label if enabled
      if (gridStyle.show_labels && cell.label) {
        const labelX = cellX + (cellWidth - gap) / 2;
        const labelY = cellY + (cellHeight - gap) / 2 + gridStyle.label_offset_y;
        const labelFontSize = cell.cellOverrides?.font_size || gridStyle.label_font_size;

        gridMarkup += `<text x="${labelX}" y="${labelY}"
                       text-anchor="middle" dominant-baseline="middle"
                       fill="${gridStyle.label_color}"
                       font-size="${labelFontSize}"
                       font-family="${gridStyle.font_family}"
                       font-weight="${gridStyle.font_weight}"
                       data-cell-label="${cell.id}">
                       ${this._escapeXml(cell.label)}
                     </text>`;
      }

      // Render cell content/value if enabled
      if (gridStyle.show_values && cell.content) {
        const valueX = cellX + (cellWidth - gap) / 2;
        const valueY = cellY + (cellHeight - gap) / 2 + gridStyle.value_offset_y;

        gridMarkup += `<text x="${valueX}" y="${valueY}"
                       text-anchor="middle" dominant-baseline="middle"
                       fill="${gridStyle.value_color}"
                       font-size="${gridStyle.value_font_size}"
                       font-family="${gridStyle.font_family}"
                       font-weight="${gridStyle.font_weight}"
                       data-cell-content="${cell.id}">
                       ${this._escapeXml(cell.content || String(cell.data.value))}
                     </text>`;
      }
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
   * UNIFIED: Resolve cell content for both initial render and updates
   * Handles both standard DataSource templates and conditional expressions
   * @private
   * @param {string} cellContent - Raw cell content (may contain templates/conditionals)
   * @param {Object} [updateDataSourceData] - Fresh DataSource data (for updates)
   * @returns {string} Resolved content ready for rendering
   */
  _resolveUnifiedCellContent(cellContent, updateDataSourceData = null) {
    if (!cellContent || typeof cellContent !== 'string') {
      return cellContent || '';
    }

    // No templates - return as-is
    if (!cellContent.includes('{')) {
      return cellContent;
    }

    // Check if this is a conditional expression
    if (cellContent.includes('?') && cellContent.includes(':')) {
      return this._processConditionalWithDataSourceMixin(cellContent, updateDataSourceData);
    }

    // Standard DataSource template - use DataSourceMixin
    return DataSourceMixin.processEnhancedTemplateStringsWithFallback(cellContent, 'StatusGridRenderer');
  }

  // Cell configuration resolution with DataSource integration
  _resolveCellConfigurations(overlay, gridStyle) {
    const cells = [];

    // ENHANCED: Check multiple sources for cells configuration
    const cellsConfig = overlay.cells || overlay._raw?.cells || overlay.raw?.cells;

    // Use explicit cell definitions if provided
    if (cellsConfig && Array.isArray(cellsConfig)) {
      cellsConfig.forEach((cellConfig, index) => {

        // UNIFIED: Get raw content and resolve it
        const rawCellContent = this._getCellContentFromSources(cellConfig);
        const cellContent = this._resolveUnifiedCellContent(rawCellContent);

        const cell = {
          id: cellConfig.id || `cell-${index}`,
          row: cellConfig.position ? cellConfig.position[0] : Math.floor(index / gridStyle.columns),
          col: cellConfig.position ? cellConfig.position[1] : index % gridStyle.columns,
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
          // Cell-specific styling overrides (as documented)
          cellOverrides: {
            color: cellConfig.color || null, // Override cell color
            radius: cellConfig.radius !== undefined ? Number(cellConfig.radius) : null, // Override corner radius
            font_size: cellConfig.font_size !== undefined ? Number(cellConfig.font_size) : null // Override font size
          }
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
   * Resolve cell content with updated DataSource data (for dynamic updates)
   * @public - Used by BaseOverlayUpdater for real-time status grid updates
   * @param {Object} overlay - Overlay configuration
   * @param {Object} style - Style configuration
   * @param {Object} newDataSourceData - Updated DataSource data
   * @returns {Array} Updated cell configurations with new data
   */
  updateCellsWithData(overlay, style, newDataSourceData) {
    cblcarsLog.debug(`[StatusGridRenderer] Updating cells with new DataSource data for ${overlay.id}`);

    const gridStyle = this._resolveStatusGridStyles(style, overlay.id, overlay);
    const cells = this._resolveCellConfigurations(overlay, gridStyle);

    // Update cells that have template content
    const updatedCells = cells.map(cell => {
      // Get raw content using unified method
      const rawCellContent = this._getCellContentFromSources(cell);

      if (rawCellContent && typeof rawCellContent === 'string' && rawCellContent.includes('{')) {
        // UNIFIED: Use single method for all template processing with fresh data
        const processedContent = this._resolveUnifiedCellContent(rawCellContent, newDataSourceData);

        // Ensure we don't return [object Object]
        const safeContent = (typeof processedContent === 'object') ?
          JSON.stringify(processedContent) : String(processedContent);

        return {
          ...cell,
          label: processedContent === rawCellContent ? cell.label : safeContent, // Only update label if content changed
          content: safeContent,
          data: {
            ...cell.data,
            value: this._extractValueFromTemplate(safeContent, newDataSourceData),
            timestamp: Date.now()
          },
          lastUpdate: Date.now()
        };
      }

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
      cblcarsLog.debug(`[StatusGridRenderer] Conditional result: ${leftVal} ${operator} ${rightVal} = ${result} → "${finalValue}"`);
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
   * Update status grid overlay content dynamically using renderer delegation pattern
   * @param {Element} overlayElement - Cached DOM element for the overlay
   * @param {Object} overlay - Overlay configuration object
   * @param {Object} sourceData - New DataSource data
   * @returns {boolean} True if content was updated, false if unchanged
   * @static
   */
  static updateGridData(overlayElement, overlay, sourceData) {
    try {
      cblcarsLog.debug(`[StatusGridRenderer] Updating status grid ${overlay.id} with DataSource data`);

      // Create renderer instance for content resolution
      const renderer = new StatusGridRenderer();

      // Get updated cells with processed template content
      const style = overlay.finalStyle || overlay.style || {};
      const updatedCells = renderer.updateCellsWithData(overlay, style, sourceData);

      cblcarsLog.debug(`[StatusGridRenderer] Processing ${updatedCells.length} updated cells for grid ${overlay.id}`);

      let updatedCount = 0;

      // Update each cell's content in the DOM using the cached overlay element
      updatedCells.forEach(cell => {
        // Use the cached overlay element for scoped queries (much faster)
        const cellContentElement = overlayElement.querySelector(`[data-cell-content="${cell.id}"]`);

        if (cellContentElement && cell.content !== undefined) {
          const oldContent = cellContentElement.textContent?.trim();
          let newContent = cell.content;

          // Handle [object Object] issue - ensure content is always a string
          if (typeof newContent === 'object') {
            cblcarsLog.warn(`[StatusGridRenderer] Cell ${cell.id} has object content, converting to string`);
            newContent = newContent !== null ? String(newContent) : 'N/A';
          }

          // Ensure newContent is a string
          newContent = String(newContent);

          if (newContent !== oldContent) {
            cblcarsLog.debug(`[StatusGridRenderer] Updating cell ${cell.id}: "${oldContent}" → "${newContent}"`);
            cellContentElement.textContent = newContent;
            updatedCount++;
          }
        }
      });

      if (updatedCount > 0) {
        cblcarsLog.debug(`[StatusGridRenderer] ✅ Status grid ${overlay.id} updated successfully (${updatedCount} cells changed)`);
        return true;
      } else {
        cblcarsLog.debug(`[StatusGridRenderer] Status grid ${overlay.id} content unchanged`);
        return false;
      }

    } catch (error) {
      cblcarsLog.error(`[StatusGridRenderer] Error updating status grid ${overlay.id}:`, error);
      return false;
    }
  }
}

// Expose StatusGridRenderer to window for console debugging
if (typeof window !== 'undefined') {
  window.StatusGridRenderer = StatusGridRenderer;
}