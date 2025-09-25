/**
 * Status Grid Renderer - Grid-based multi-entity status visualization with LCARS theming
 * Provides compact status displays perfect for cascade animations and multi-sensor monitoring
 */

import { PositionResolver } from './PositionResolver.js';
import { RendererUtils } from './RendererUtils.js';
import { DataSourceMixin } from './DataSourceMixin.js';
import { BracketRenderer } from './BracketRenderer.js';

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
      const gridStyle = this._resolveStatusGridStyles(style, overlay.id, overlay);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      // Get cell configurations
      const cells = this._resolveCellConfigurations(overlay, gridStyle);
      console.debug(`[StatusGridRenderer] Rendering ${cells.length} cells for grid ${overlay.id}`);

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
      cell_radius: standardStyles.layout.borderRadius || 2,

      // Border (using standardized layout)
      cell_border: style.cell_border || style.cellBorder !== false,
      border_color: standardStyles.colors.borderColor,
      border_width: standardStyles.layout.borderWidth,

      // Text (using standardized text styles)
      show_labels: style.show_labels !== false,
      show_values: style.show_values || false,
      label_color: standardStyles.text.labelColor,
      value_color: standardStyles.text.valueColor,
      font_size: standardStyles.text.fontSize,
      font_family: standardStyles.text.fontFamily,
      font_weight: standardStyles.text.fontWeight,

      // Status coloring
      status_mode: (style.status_mode || style.statusMode || 'auto').toLowerCase(),
      status_ranges: this._parseStatusRanges(style.status_ranges || style.statusRanges),
      unknown_color: standardStyles.colors.disabledColor,

      // Grid features
      show_grid_lines: style.show_grid_lines || style.showGridLines || false,
      grid_line_color: style.grid_line_color || style.gridLineColor || standardStyles.colors.borderColor,
      grid_line_opacity: Number(style.grid_line_opacity || style.gridLineOpacity || 0.3),

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
                     stroke-width="1" opacity="${gridStyle.grid_line_opacity}"/>`;
    }

    // Render each cell
    cells.forEach(cell => {
      const cellX = cell.col * (cellWidth + gap);
      const cellY = cell.row * (cellHeight + gap);

      // Determine cell color based on status
      const cellColor = this._determineCellColor(cell, gridStyle);

      // Render cell rectangle
      gridMarkup += `<rect x="${cellX}" y="${cellY}"
                     width="${cellWidth - gap}" height="${cellHeight - gap}"
                     fill="${cellColor}"
                     stroke="${gridStyle.border_color}"
                     stroke-width="${gridStyle.border_width}"
                     rx="${gridStyle.cell_radius}"
                     data-cell-id="${cell.id}"
                     data-cell-row="${cell.row}"
                     data-cell-col="${cell.col}"/>`;

      // Render cell label if enabled
      if (gridStyle.show_labels && cell.label) {
        const labelX = cellX + (cellWidth - gap) / 2;
        const labelY = cellY + (cellHeight - gap) / 2 - (gridStyle.font_size / 4);

        gridMarkup += `<text x="${labelX}" y="${labelY}"
                       text-anchor="middle" dominant-baseline="middle"
                       fill="${gridStyle.label_color}"
                       font-size="${gridStyle.font_size * 0.7}"
                       font-family="${gridStyle.font_family}"
                       data-cell-label="${cell.id}">
                       ${this._escapeXml(cell.label)}
                     </text>`;
      }

      // Render cell content/value if enabled
      if (gridStyle.show_values && cell.content) {
        const valueX = cellX + (cellWidth - gap) / 2;
        const valueY = cellY + (cellHeight - gap) / 2 + (gridStyle.font_size / 4);

        gridMarkup += `<text x="${valueX}" y="${valueY}"
                       text-anchor="middle" dominant-baseline="middle"
                       fill="${gridStyle.value_color}"
                       font-size="${gridStyle.font_size * 0.6}"
                       font-family="${gridStyle.font_family}"
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

    console.debug(`[StatusGridRenderer] Building brackets for ${overlayId}: style=${gridStyle.bracket_style}`);

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

    console.debug(`[StatusGridRenderer] Bracket config:`, bracketConfig);

    return BracketRenderer.render(width, height, bracketConfig, overlayId);
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

    console.debug(`[StatusGridRenderer] Processing unified content: "${cellContent}"`);

    // Check if this is a conditional expression
    if (cellContent.includes('?') && cellContent.includes(':')) {
      console.debug(`[StatusGridRenderer] Processing conditional expression`);
      return this._processConditionalWithDataSourceMixin(cellContent, updateDataSourceData);
    }

    // Standard DataSource template - use DataSourceMixin
    console.debug(`[StatusGridRenderer] Processing standard DataSource template`);
    return DataSourceMixin.processEnhancedTemplateStringsWithFallback(cellContent, 'StatusGridRenderer');
  }

  // Cell configuration resolution with DataSource integration
  _resolveCellConfigurations(overlay, gridStyle) {
    const cells = [];

    // ENHANCED: Check multiple sources for cells configuration
    const cellsConfig = overlay.cells || overlay._raw?.cells || overlay.raw?.cells;

    console.debug(`[StatusGridRenderer] Resolving cells for ${overlay.id}:`, {
      hasCells: !!(cellsConfig && Array.isArray(cellsConfig)),
      cellCount: cellsConfig?.length || 0,
      cellsData: cellsConfig,
      checkedSources: {
        'overlay.cells': !!overlay.cells,
        'overlay._raw?.cells': !!(overlay._raw?.cells),
        'overlay.raw?.cells': !!(overlay.raw?.cells)
      }
    });

    // Use explicit cell definitions if provided
    if (cellsConfig && Array.isArray(cellsConfig)) {
      cellsConfig.forEach((cellConfig, index) => {
        console.debug(`[StatusGridRenderer] Processing cell ${index}:`, cellConfig);

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
          _originalContent: rawCellContent !== cellContent ? rawCellContent : null
        };

        console.debug(`[StatusGridRenderer] Created cell:`, cell);
        cells.push(cell);
      });
    } else {
      console.debug(`[StatusGridRenderer] No explicit cells found, generating ${gridStyle.rows}x${gridStyle.columns} grid`);

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

    console.debug(`[StatusGridRenderer] Final cells array:`, cells);
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
    console.debug(`[StatusGridRenderer] Updating cells with new DataSource data for ${overlay.id}`);

    const gridStyle = this._resolveStatusGridStyles(style, overlay.id, overlay);
    const cells = this._resolveCellConfigurations(overlay, gridStyle);

    // Update cells that have template content
    const updatedCells = cells.map(cell => {
      // Get raw content using unified method
      const rawCellContent = this._getCellContentFromSources(cell);

      if (rawCellContent && typeof rawCellContent === 'string' && rawCellContent.includes('{')) {
        console.debug(`[StatusGridRenderer] Processing template for cell ${cell.id}: "${rawCellContent}"`);

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
      console.debug(`[StatusGridRenderer] Extracted conditional expression: "${expression}"`);

      // Parse the conditional: "path operator value ? trueValue : falseValue"
      const conditionMatch = expression.match(/^(.+?)\s*([><=!]+)\s*(.+?)\s*\?\s*'(.+?)'\s*:\s*'(.+?)'$/);
      if (!conditionMatch) {
        console.warn(`[StatusGridRenderer] Could not parse conditional: ${expression}`);
        return conditionalTemplate;
      }

      const [, leftPath, operator, rightValue, trueValue, falseValue] = conditionMatch;
      console.debug(`[StatusGridRenderer] Parsed conditional: "${leftPath.trim()}" ${operator} ${rightValue} ? "${trueValue}" : "${falseValue}"`);

      // Create a simple template with just the DataSource reference
      const dataSourceTemplate = `{${leftPath.trim()}}`;
      console.debug(`[StatusGridRenderer] Resolving DataSource template: "${dataSourceTemplate}"`);

      let resolvedValue;

      // If we have update data, try to extract the value directly first
      if (updateDataSourceData) {
        console.debug(`[StatusGridRenderer] Using provided update data:`, updateDataSourceData);
        resolvedValue = this._extractValueFromUpdateData(leftPath.trim(), updateDataSourceData);
        console.debug(`[StatusGridRenderer] Extracted from update data: "${resolvedValue}"`);
      }

      // If we couldn't extract from update data, fall back to DataSourceMixin
      if (resolvedValue === null || resolvedValue === undefined) {
        resolvedValue = DataSourceMixin.processEnhancedTemplateStringsWithFallback(dataSourceTemplate, 'StatusGridRenderer');
        console.debug(`[StatusGridRenderer] DataSourceMixin resolved: "${dataSourceTemplate}" → "${resolvedValue}"`);
      }

      // If DataSourceMixin couldn't resolve it, return original
      if (resolvedValue === dataSourceTemplate) {
        console.debug(`[StatusGridRenderer] DataSource not resolved, returning original template`);
        return conditionalTemplate;
      }

      // Parse the resolved value and apply conditional logic
      const leftVal = parseFloat(resolvedValue);
      const rightVal = parseFloat(rightValue.trim());

      if (isNaN(leftVal) || isNaN(rightVal)) {
        console.warn(`[StatusGridRenderer] Could not parse numeric values: left="${resolvedValue}" (${leftVal}), right="${rightValue.trim()}" (${rightVal})`);
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
          console.warn(`[StatusGridRenderer] Unknown operator: ${operator}`);
          return conditionalTemplate;
      }

      const finalValue = result ? trueValue : falseValue;
      console.debug(`[StatusGridRenderer] Conditional result: ${leftVal} ${operator} ${rightVal} = ${result} → "${finalValue}"`);
      return finalValue;

    } catch (error) {
      console.error(`[StatusGridRenderer] Error processing conditional with DataSourceMixin:`, error);
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
        console.debug(`[StatusGridRenderer] Path "${part}" not found in update data, falling back to DataSourceMixin`);
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
    const position = PositionResolver.resolvePosition(overlay.position, anchors);
    const size = overlay.size || [200, 150];

    if (!position || !size || !Array.isArray(size) || size.length < 2) {
      console.debug(`[StatusGridRenderer] Cannot compute attachment points for ${overlay.id}: missing position or size`);
      return null;
    }

    const [x, y] = position;
    const [width, height] = size;

    // Calculate bounding box
    const left = x;
    const right = x + width;
    const top = y;
    const bottom = y + height;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    const attachmentPoints = {
      id: overlay.id,
      center: [centerX, centerY],
      bbox: {
        left,
        right,
        top,
        bottom,
        width,
        height,
        x,
        y
      },
      points: {
        center: [centerX, centerY],
        top: [centerX, top],
        bottom: [centerX, bottom],
        left: [left, centerY],
        right: [right, centerY],
        topLeft: [left, top],
        topRight: [right, top],
        bottomLeft: [left, bottom],
        bottomRight: [right, bottom],
        // Aliases for common naming conventions
        'top-left': [left, top],
        'top-right': [right, top],
        'bottom-left': [left, bottom],
        'bottom-right': [right, bottom]
      }
    };

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
      console.debug(`[StatusGridRenderer] Updating status grid ${overlay.id} with DataSource data`);

      // Create renderer instance for content resolution
      const renderer = new StatusGridRenderer();

      // Get updated cells with processed template content
      const style = overlay.finalStyle || overlay.style || {};
      const updatedCells = renderer.updateCellsWithData(overlay, style, sourceData);

      console.debug(`[StatusGridRenderer] Processing ${updatedCells.length} updated cells for grid ${overlay.id}`);

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
            console.warn(`[StatusGridRenderer] Cell ${cell.id} has object content, converting to string`);
            newContent = newContent !== null ? String(newContent) : 'N/A';
          }

          // Ensure newContent is a string
          newContent = String(newContent);

          if (newContent !== oldContent) {
            console.debug(`[StatusGridRenderer] Updating cell ${cell.id}: "${oldContent}" → "${newContent}"`);
            cellContentElement.textContent = newContent;
            updatedCount++;
          }
        }
      });

      if (updatedCount > 0) {
        console.debug(`[StatusGridRenderer] ✅ Status grid ${overlay.id} updated successfully (${updatedCount} cells changed)`);
        return true;
      } else {
        console.debug(`[StatusGridRenderer] Status grid ${overlay.id} content unchanged`);
        return false;
      }

    } catch (error) {
      console.error(`[StatusGridRenderer] Error updating status grid ${overlay.id}:`, error);
      return false;
    }
  }
}

// Expose StatusGridRenderer to window for console debugging
if (typeof window !== 'undefined') {
  window.StatusGridRenderer = StatusGridRenderer;
}