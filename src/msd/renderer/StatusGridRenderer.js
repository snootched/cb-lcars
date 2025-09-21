/**
 * Status Grid Renderer - Grid-based multi-entity status visualization with LCARS theming
 * Provides compact status displays perfect for cascade animations and multi-sensor monitoring
 */

import { PositionResolver } from './PositionResolver.js';
import { RendererUtils } from './RendererUtils.js';
import { DataSourceMixin } from './DataSourceMixin.js';

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
      const gridStyle = this._resolveStatusGridStyles(style, overlay.id, overlay);
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
   * Resolve cell content from various sources including DataSource integration
   * @private
   */
  _resolveCellContent(cell, style) {
    // ENHANCED: Handle conditional expressions locally before delegating to DataSourceMixin
    const cellContent = cell.content || cell._raw?.content || cell.label || '';

    console.log(`[StatusGridRenderer] Resolving content for cell:`, {
      cellId: cell.id || 'unknown',
      hasContent: !!cell.content,
      hasRawContent: !!cell._raw?.content,
      hasLabel: !!cell.label,
      content: cellContent,
      rawContent: cell._raw?.content,
      label: cell.label
    });

    // Check if this is a conditional expression before delegating to DataSourceMixin
    if (cellContent && typeof cellContent === 'string' && cellContent.includes('?') && cellContent.includes(':')) {
      console.log(`[StatusGridRenderer] Detected conditional expression, handling locally: "${cellContent}"`);
      return cellContent; // Return as-is, will be processed by our _processTemplateWithData
    }

    // Use DataSourceMixin's unified content resolution with template processing for simple templates
    const resolvedContent = DataSourceMixin.resolveContent(cell, style, 'StatusGridRenderer');

    console.log(`[StatusGridRenderer] Resolved content: "${resolvedContent}" for cell ${cell.id || 'unknown'}`);

    return resolvedContent;
  }

  // Cell configuration resolution with DataSource integration
  _resolveCellConfigurations(overlay, gridStyle) {
    const cells = [];

    // ENHANCED: Check multiple sources for cells configuration
    const cellsConfig = overlay.cells || overlay._raw?.cells || overlay.raw?.cells;

    console.log(`[StatusGridRenderer] Resolving cells for ${overlay.id}:`, {
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
        console.log(`[StatusGridRenderer] Processing cell ${index}:`, cellConfig);

        // UNIFIED: Use standardized content resolution following Text Overlay pattern
        const cellContent = this._resolveCellContent(cellConfig, gridStyle);

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
          _raw: cellConfig._raw || cellConfig
        };

        // ENHANCED: Apply template processing for initial render if needed
        const processedCell = this._resolveCellContentForInitialRender(cell, gridStyle);

        console.log(`[StatusGridRenderer] Created cell:`, processedCell);
        cells.push(processedCell);
      });
    } else {
      console.log(`[StatusGridRenderer] No explicit cells found, generating ${gridStyle.rows}x${gridStyle.columns} grid`);

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

    console.log(`[StatusGridRenderer] Final cells array:`, cells);
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
    console.log(`[StatusGridRenderer] Updating cells with new DataSource data for ${overlay.id}`);

    const gridStyle = this._resolveStatusGridStyles(style, overlay.id, overlay);
    const cells = this._resolveCellConfigurations(overlay, gridStyle);

    // Update cells that have template content
    const updatedCells = cells.map(cell => {
      const cellContent = cell._raw?.content || cell._raw?.label || cell.label || '';

        if (cellContent && typeof cellContent === 'string' && cellContent.includes('{')) {
        console.log(`[StatusGridRenderer] Processing template for cell ${cell.id}: "${cellContent}"`);

        // ENHANCED: Get the correct DataSource for this specific cell
        const cellDataSource = this._getDataSourceForCell(cellContent, newDataSourceData);
        const processedContent = this._processTemplateWithData(cellContent, cellDataSource);          // Ensure we don't return [object Object]
          const safeContent = (typeof processedContent === 'object') ?
            JSON.stringify(processedContent) : String(processedContent);

          return {
            ...cell,
            label: processedContent === cellContent ? cell.label : safeContent, // Only update label if content changed
            content: safeContent,
            data: {
              ...cell.data,
              value: this._extractValueFromTemplate(safeContent, newDataSourceData),
              timestamp: Date.now()
            },
            lastUpdate: Date.now()
          };
        }      return cell;
    });

    return updatedCells;
  }

  /**
   * Get the appropriate DataSource data for a specific cell template
   * @private
   * @param {string} cellContent - Cell template content
   * @param {Object} changedDataSourceData - The DataSource data that changed
   * @returns {Object} Appropriate DataSource data for this cell
   */
  _getDataSourceForCell(cellContent, changedDataSourceData) {
    // Extract DataSource reference from template (e.g., "test_cpu_temp" from "{test_cpu_temp:.1%}")
    const templateMatch = cellContent.match(/\{([^}]+)\}/);
    if (!templateMatch) return changedDataSourceData;

    const reference = templateMatch[1];
    // Split by colon first to handle format specs, then by dot to get DataSource name
    const [pathPart] = reference.split(':');
    const dataSourceName = pathPart.split('.')[0]; // Get first part before dot

    console.log(`[StatusGridRenderer] Cell needs DataSource: ${dataSourceName}`);

    // If this cell references the changed DataSource, use the provided data
    if (changedDataSourceData && dataSourceName === 'temperature_enhanced') {
      return changedDataSourceData;
    }

    // Otherwise, try to get the correct DataSource from the manager
    if (typeof window !== 'undefined' && window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager) {
      const dataSourceManager = window.__msdDebug.pipelineInstance.systemsManager.dataSourceManager;
      const source = dataSourceManager.getSource(dataSourceName);

      if (source) {
        const sourceData = source.getCurrentData();
        console.log(`[StatusGridRenderer] Found DataSource ${dataSourceName}: value=${sourceData?.v}, unit="${sourceData?.unit_of_measurement || 'none'}"`);
        return sourceData;
      } else {
        console.warn(`[StatusGridRenderer] DataSource ${dataSourceName} not found`);
      }
    }

    // Fallback: return the changed data (might not work for this cell)
    return changedDataSourceData;
  }  /**
   * Process template strings with specific DataSource data (using unified DataSourceMixin)
   * @private
   * @param {string} templateString - Template string with placeholders
   * @param {Object} dataSourceData - DataSource data to use for resolution
   * @returns {string} Processed template string
   */
  _processTemplateWithData(templateString, dataSourceData) {
    console.log(`[StatusGridRenderer] Processing template: "${templateString}"`);
    console.log(`[StatusGridRenderer] With DataSource data:`, dataSourceData);

    return templateString.replace(/\{([^}]+)\}/g, (match, reference) => {
      console.log(`[StatusGridRenderer] Processing reference: "${reference}"`);

      // Handle conditional expressions (e.g., "value > 70 ? 'HOT' : 'OK'")
      if (reference.includes('?') && reference.includes(':')) {
        return this._processConditionalExpression(reference, dataSourceData);
      }

      // Parse the reference (e.g., "temperature_enhanced.transformations.celsius:.1f")
      const [fullPath, formatSpec] = reference.split(':');
      const pathParts = fullPath.split('.');

      console.log(`[StatusGridRenderer] Path parts:`, pathParts);
      console.log(`[StatusGridRenderer] Format spec:`, formatSpec);

      // Navigate the data structure
      let value = dataSourceData;

      // For simple DataSources (like test_cpu_temp), use the raw value directly
      if (pathParts.length === 1) {
        // Simple DataSource reference like {test_cpu_temp}
        value = dataSourceData?.v || dataSourceData?.value || dataSourceData;
      } else {
        // Complex path like {temperature_enhanced.transformations.celsius}
        for (let i = 1; i < pathParts.length; i++) { // Skip the first part (source name)
          const part = pathParts[i];

          if (value && typeof value === 'object' && part in value) {
            value = value[part];
          } else {
            console.warn(`[StatusGridRenderer] Path navigation failed at "${part}" in path "${fullPath}"`);
            console.log(`[StatusGridRenderer] Current value:`, value);
            console.log(`[StatusGridRenderer] Available keys:`, value && typeof value === 'object' ? Object.keys(value) : 'none');

            // ENHANCED FALLBACK: Try multiple strategies for transformations
            if (part === 'transformations' && dataSourceData?.transformations) {
              console.log(`[StatusGridRenderer] Using transformations object directly:`, dataSourceData.transformations);
              value = dataSourceData.transformations;
            } else if (part === 'celsius' && dataSourceData?.transformations?.celsius !== undefined) {
              console.log(`[StatusGridRenderer] Using transformations.celsius directly:`, dataSourceData.transformations.celsius);
              value = dataSourceData.transformations.celsius;
              break;
            } else {
              console.warn(`[StatusGridRenderer] Path not found: ${fullPath}, returning original template`);
              console.log(`[StatusGridRenderer] Debug - DataSource structure:`, {
                hasTransformations: !!dataSourceData?.transformations,
                transformationsKeys: dataSourceData?.transformations ? Object.keys(dataSourceData.transformations) : [],
                rawValue: dataSourceData?.v,
                fullDataSource: dataSourceData
              });
              return match; // Return original template if path doesn't exist
            }
          }
        }
      }

      console.log(`[StatusGridRenderer] Resolved value:`, value);

      // Apply formatting if specified - USE UNIFIED DataSourceMixin formatting
      if (formatSpec && value !== undefined && value !== null) {
        console.log(`[StatusGridRenderer] Using DataSourceMixin.applyNumberFormat for unit-aware formatting`);
        const formattedValue = DataSourceMixin.applyNumberFormat(value, formatSpec, dataSourceData?.unit_of_measurement);
        console.log(`[StatusGridRenderer] Formatted value: "${formattedValue}"`);
        return formattedValue;
      }

      return String(value);
    });
  }

  /**
   * Process conditional expressions like "temperature > 70 ? 'HOT' : 'OK'"
   * @private
   */
  _processConditionalExpression(expression, dataSourceData) {
    try {
      // Simple regex to parse conditional: "path operator value ? trueValue : falseValue"
      const conditionMatch = expression.match(/^(.+?)\s*([><=!]+)\s*(.+?)\s*\?\s*'(.+?)'\s*:\s*'(.+?)'$/);

      if (!conditionMatch) {
        console.warn(`[StatusGridRenderer] Could not parse conditional: ${expression}`);
        return expression;
      }

      const [, leftPath, operator, rightValue, trueValue, falseValue] = conditionMatch;

      console.log(`[StatusGridRenderer] Parsing conditional - path: "${leftPath.trim()}", operator: "${operator}", value: "${rightValue}"`);

      // Get the left side value from data
      const pathParts = leftPath.trim().split('.');
      let leftVal = dataSourceData;

      console.log(`[StatusGridRenderer] DataSource data for conditional:`, dataSourceData);
      console.log(`[StatusGridRenderer] Path parts for conditional:`, pathParts);

      // FIXED: Handle different path structures properly
      if (pathParts.length === 1) {
        // Simple path like "temperature"
        leftVal = dataSourceData?.v || dataSourceData?.value || dataSourceData;
      } else {
        // Complex path like "temperature_enhanced.transformations.celsius"
        // Start from the dataSourceData and navigate
        for (let i = 1; i < pathParts.length; i++) { // Skip the first part (source name)
          const part = pathParts[i];

          if (leftVal && typeof leftVal === 'object' && part in leftVal) {
            leftVal = leftVal[part];
            console.log(`[StatusGridRenderer] Found "${part}" in data, continuing with:`, leftVal);
          } else {
            console.warn(`[StatusGridRenderer] Conditional path not found: ${leftPath}, part "${part}" not found in:`, leftVal);

            // ENHANCED FALLBACK: Try multiple strategies
            if (part === 'transformations' && dataSourceData?.transformations) {
              console.log(`[StatusGridRenderer] Using transformations object directly:`, dataSourceData.transformations);
              leftVal = dataSourceData.transformations;
            } else if (part === 'celsius' && leftVal?.celsius !== undefined) {
              console.log(`[StatusGridRenderer] Found celsius in current object:`, leftVal.celsius);
              leftVal = leftVal.celsius;
            } else if (i === pathParts.length - 1 && part === 'celsius' && dataSourceData?.transformations?.celsius !== undefined) {
              // Special case: directly access celsius from transformations
              console.log(`[StatusGridRenderer] Using transformations.celsius directly:`, dataSourceData.transformations.celsius);
              leftVal = dataSourceData.transformations.celsius;
            } else {
              // Final fallback: use raw value for temperature comparisons
              console.log(`[StatusGridRenderer] Using raw value as fallback for conditional:`, dataSourceData.v);
              console.log(`[StatusGridRenderer] Debug - Conditional DataSource structure:`, {
                hasTransformations: !!dataSourceData?.transformations,
                transformationsKeys: dataSourceData?.transformations ? Object.keys(dataSourceData.transformations) : [],
                transformationsContent: dataSourceData?.transformations,
                rawValue: dataSourceData?.v,
                targetPart: part
              });
              leftVal = dataSourceData.v;
              break;
            }
          }
        }
      }

      console.log(`[StatusGridRenderer] Resolved conditional left value:`, leftVal);

      // Parse right side value
      const rightVal = parseFloat(rightValue.trim()) || 0;

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
          return expression;
      }

      const finalValue = result ? trueValue : falseValue;
      console.log(`[StatusGridRenderer] Conditional result: ${leftVal} ${operator} ${rightVal} = ${result} → "${finalValue}"`);
      return finalValue;

    } catch (error) {
      console.error(`[StatusGridRenderer] Error in conditional expression:`, error);
      return expression;
    }
  }

  /**
   * Resolve cell content with template processing for initial render
   * @private
   * @param {Object} cell - Cell configuration
   * @param {Object} style - Style configuration
   * @returns {Object} Cell with processed content if templates are present
   */
  _resolveCellContentForInitialRender(cell, style) {
    const cellContent = cell._raw?.content || cell._raw?.label || cell.label || cell.content || '';

    // If content contains templates, check if it's a conditional expression first
    if (cellContent && typeof cellContent === 'string' && cellContent.includes('{')) {
      console.log(`[StatusGridRenderer] Processing template for initial render in cell ${cell.id}: "${cellContent}"`);

      // ENHANCED: Handle conditional expressions locally during initial render
      if (cellContent.includes('?') && cellContent.includes(':')) {
        console.log(`[StatusGridRenderer] Conditional expression detected during initial render, will process during updates`);
        return {
          ...cell,
          content: cellContent, // Keep original for processing during updates
          _originalContent: cellContent,
          _isConditional: true
        };
      }

      // Use unified template processing for simple templates only
      const processedContent = DataSourceMixin.processTemplateForInitialRender(cellContent, 'StatusGridRenderer');

      if (processedContent !== cellContent) {
        console.log(`[StatusGridRenderer] Template resolved for ${cell.id}: "${cellContent}" → "${processedContent}"`);
        return {
          ...cell,
          content: processedContent,
          _originalContent: cellContent // Store original for future updates
        };
      } else {
        console.log(`[StatusGridRenderer] Template not resolved for ${cell.id}, will update when DataSources become available`);
      }
    }

    return cell;
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
   * Process template for initial render (similar to TextOverlayRenderer approach)
   * @private
   * @param {string} cellContent - Cell template content
   * @param {Object} gridStyle - Grid style configuration
   * @returns {string} Processed content or original if not resolvable
   */
  _processInitialTemplate(cellContent, gridStyle) {
    try {
      // Try to get DataSource data for initial processing
      const cellDataSource = this._getDataSourceForInitialRender(cellContent);

      if (cellDataSource && cellDataSource.v !== null && cellDataSource.v !== undefined) {
        const processedContent = this._processTemplateWithData(cellContent, cellDataSource);
        return processedContent;
      }

      return cellContent; // Return original if DataSource not available
    } catch (error) {
      console.warn(`[StatusGridRenderer] Error processing initial template:`, error);
      return cellContent;
    }
  }
}

// Expose StatusGridRenderer to window for console debugging
if (typeof window !== 'undefined') {
  window.StatusGridRenderer = StatusGridRenderer;
}