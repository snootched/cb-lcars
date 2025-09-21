/**
 * History Bar Renderer - Advanced temporal bar chart visualization with comprehensive styling support
 * Provides rich historical data visualization features with LCARS theming
 */

import { PositionResolver } from './PositionResolver.js';
import { RendererUtils } from './RendererUtils.js';

export class HistoryBarRenderer {
  constructor() {
    // Pre-defined caches for performance optimization
    this.gradientCache = new Map();
    this.patternCache = new Map();
    this.filterCache = new Map();
  }

  /**
   * Render a history bar overlay with comprehensive styling support
   * @param {Object} overlay - History bar overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Element} svgContainer - Container element for measurements
   * @returns {string} Complete SVG markup for the styled history bar
   */
  static render(overlay, anchors, viewBox, svgContainer) {
    // Create instance for non-static methods
    const instance = new HistoryBarRenderer();
    instance.container = svgContainer;
    instance.viewBox = viewBox;

    // CRITICAL: Pass systemsManager if available for DataSource access
    instance.systemsManager = svgContainer?.systemsManager || window.__msdSystemsManager;

    return instance.renderHistoryBar(overlay, anchors, viewBox);
  }

  /**
   * Instance method for comprehensive history bar rendering
   * @param {Object} overlay - History bar overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @returns {string} Complete SVG markup for the styled history bar
   */
  renderHistoryBar(overlay, anchors, viewBox) {
    const position = PositionResolver.resolvePosition(overlay.position, anchors);
    if (!position) {
      console.warn('[HistoryBarRenderer] History bar overlay position could not be resolved:', overlay.id);
      return '';
    }

    const [x, y] = position;
    const size = overlay.size || [300, 80];
    const [width, height] = size;

    try {
      const style = overlay.finalStyle || overlay.style || {};

      // Handle template processing for initial render if content exists
      let processedContent = null;
      if (overlay.content) {
        processedContent = this._processTemplatesForInitialRender(overlay, style);
      }

      // Get data from source
      const dataResult = HistoryBarRenderer.getHistoricalDataForHistoryBar(overlay.source);
      // Extract comprehensive styling
      const historyBarStyle = this._resolveHistoryBarStyles(style, overlay.id);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      console.log(`[HistoryBarRenderer] Data result for ${overlay.id}:`, dataResult.status, dataResult.data?.length);

      if (dataResult.status === 'OK' && dataResult.data && dataResult.data.length >= 1) {
        // Render real history bar with advanced features
        return this._renderEnhancedHistoryBar(
          overlay, x, y, width, height, dataResult.data,
          historyBarStyle, animationAttributes, processedContent
        );
      } else {
        // Render enhanced status indicator
        return this._renderEnhancedStatusIndicator(
          overlay, x, y, width, height, dataResult,
          historyBarStyle, animationAttributes, processedContent
        );
      }
    } catch (error) {
      console.error(`[HistoryBarRenderer] Enhanced rendering failed for history bar ${overlay.id}:`, error);
      return this._renderFallbackHistoryBar(overlay, x, y, width, height);
    }
  }

  /**
   * Resolve comprehensive history bar styling from configuration
   * @private
   * @param {Object} style - Final resolved style object
   * @param {string} overlayId - Overlay ID for unique identifiers
   * @returns {Object} Complete history bar style configuration
   */
  _resolveHistoryBarStyles(style, overlayId) {
    const historyBarStyle = {
      // Core bar properties
      orientation: (style.orientation || 'horizontal').toLowerCase(),
      time_window: style.time_window || style.timeWindow || '24h',
      bucket_size: style.bucket_size || style.bucketSize || '30m', // Changed from 'auto' to 30 minutes for better real-time resolution

      // Bar appearance
      bar_color: style.bar_color || style.barColor || style.color || 'var(--lcars-blue)',
      bar_opacity: Number(style.bar_opacity || style.barOpacity || style.opacity || 1),
      bar_gap: Number(style.bar_gap || style.barGap || 1),
      bar_radius: Number(style.bar_radius || style.barRadius || 0),

      // Value-based coloring
      color_ranges: this._parseColorRanges(style.color_ranges || style.colorRanges),
      use_gradient: style.use_gradient || style.useGradient || false,

      // Axis and labels
      show_axis: style.show_axis !== false,
      show_labels: style.show_labels !== false,
      show_values: style.show_values || false,
      axis_color: style.axis_color || style.axisColor || 'var(--lcars-gray)',
      label_color: style.label_color || style.labelColor || 'var(--lcars-white)',
      label_font_size: Number(style.label_font_size || style.labelFontSize || 10),

      // Grid and reference lines
      show_grid: style.show_grid || style.showGrid || false,
      grid_color: style.grid_color || style.gridColor || 'var(--lcars-gray)',
      grid_opacity: Number(style.grid_opacity || style.gridOpacity || 0.3),

      // Thresholds and reference lines
      thresholds: this._parseThresholds(style.thresholds),
      zero_line: style.zero_line || style.zeroLine || false,

      // Aggregation mode
      aggregation_mode: (style.aggregation_mode || style.aggregationMode || 'average').toLowerCase(),

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

      // Hover and interaction
      hover_enabled: style.hover_enabled !== false,
      hover_color: style.hover_color || style.hoverColor || 'var(--lcars-yellow)',

      // Animation states (for future anime.js integration)
      animatable: style.animatable !== false,
      cascade_speed: Number(style.cascade_speed || style.cascadeSpeed || 0),
      reveal_animation: style.reveal_animation || style.revealAnimation || false,

      // Performance options
      max_bars: Number(style.max_bars || style.maxBars || 100),

      // Track enabled features for optimization
      features: []
    };

    // Build feature list for conditional rendering
    if (historyBarStyle.gradient) historyBarStyle.features.push('gradient');
    if (historyBarStyle.pattern) historyBarStyle.features.push('pattern');
    if (historyBarStyle.color_ranges && historyBarStyle.color_ranges.length > 0) historyBarStyle.features.push('color-ranges');
    if (historyBarStyle.glow) historyBarStyle.features.push('glow');
    if (historyBarStyle.shadow) historyBarStyle.features.push('shadow');
    if (historyBarStyle.blur) historyBarStyle.features.push('blur');
    if (historyBarStyle.thresholds && historyBarStyle.thresholds.length > 0) historyBarStyle.features.push('thresholds');
    if (historyBarStyle.show_grid) historyBarStyle.features.push('grid');
    if (historyBarStyle.show_axis) historyBarStyle.features.push('axis');
    if (historyBarStyle.show_labels) historyBarStyle.features.push('labels');
    if (historyBarStyle.show_values) historyBarStyle.features.push('values');
    if (historyBarStyle.bracket_style) historyBarStyle.features.push('brackets');
    if (historyBarStyle.status_indicator) historyBarStyle.features.push('status');
    if (historyBarStyle.hover_enabled) historyBarStyle.features.push('hover');
    if (historyBarStyle.cascade_speed > 0) historyBarStyle.features.push('cascade');
    if (historyBarStyle.reveal_animation) historyBarStyle.features.push('reveal');

    return historyBarStyle;
  }

  /**
   * Parse color ranges configuration
   * @private
   */
  _parseColorRanges(colorRanges) {
    if (!colorRanges || !Array.isArray(colorRanges)) return [];

    return colorRanges.map(range => ({
      min: Number(range.min || 0),
      max: Number(range.max || 100),
      color: range.color || 'var(--lcars-blue)',
      label: range.label || null
    }));
  }

  /**
   * Parse threshold configuration
   * @private
   */
  _parseThresholds(thresholds) {
    if (!thresholds || !Array.isArray(thresholds)) return [];

    return thresholds.map(threshold => ({
      value: Number(threshold.value || threshold),
      color: threshold.color || 'var(--lcars-orange)',
      width: Number(threshold.width || 1),
      opacity: Number(threshold.opacity || 0.7),
      dash: threshold.dash || false,
      label: threshold.label || null
    }));
  }

  /**
   * Get historical data with multiple fallback strategies
   * @param {string} dataSourceRef - Data source reference
   * @returns {Object} {data: Array|null, status: string, message: string, metadata: Object}
   */
  static getHistoricalDataForHistoryBar(dataSourceRef) {
    if (!dataSourceRef) {
      return {
        data: null,
        status: 'NO_SOURCE',
        message: 'No data source specified',
        metadata: {}
      };
    }

    try {
      // Parse data source reference for enhanced data access
      const { sourceName, dataKey, isTransformation, isAggregation } = HistoryBarRenderer.parseDataSourceReference(dataSourceRef);

      const dataSourceManager = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (dataSourceManager) {
        console.log(`[HistoryBarRenderer] 🔍 Checking DataSourceManager for '${sourceName}' with data key: '${dataKey}'`);

        const dataSource = dataSourceManager.getSource(sourceName);

        if (dataSource) {
          const currentData = dataSource.getCurrentData();
          console.log(`[HistoryBarRenderer] Source data for '${sourceName}':`, {
            bufferSize: currentData?.bufferSize || 0,
            historyReady: currentData?.historyReady,
            started: currentData?.started,
            historyLoaded: currentData?.stats?.historyLoaded || 0,
            hasTransformations: Object.keys(currentData?.transformations || {}).length,
            hasAggregations: Object.keys(currentData?.aggregations || {}).length,
            requestedDataKey: dataKey
          });

          // NEW: Support for enhanced data access (reuse from SparklineRenderer)
          if (dataKey && (isTransformation || isAggregation)) {
            return HistoryBarRenderer.getEnhancedDataSourceData(currentData, dataKey, isTransformation, isAggregation, sourceName);
          }

          // Original buffer-based data access
          if (currentData?.buffer) {
            const bufferData = currentData.buffer.getAll();
            console.log(`[HistoryBarRenderer] Raw buffer data for '${sourceName}':`, bufferData);

            if (bufferData && bufferData.length >= 1) {
              const historicalData = bufferData.map(point => ({
                timestamp: point.t,
                value: point.v
              }));

              console.log(`[HistoryBarRenderer] ✅ Found ${historicalData.length} data points for '${sourceName}'`);
              return {
                data: historicalData,
                status: 'OK',
                message: `${historicalData.length} data points`,
                metadata: {
                  sourceName,
                  dataType: 'raw',
                  transformations: currentData.transformations,
                  aggregations: currentData.aggregations
                }
              };
            } else {
              console.log(`[HistoryBarRenderer] ⚠️ Buffer exists but is empty for '${sourceName}'`);
              return {
                data: null,
                status: 'EMPTY_BUFFER',
                message: 'Buffer exists but contains no data',
                metadata: { sourceName, dataType: 'raw' }
              };
            }
          }

          console.log(`[HistoryBarRenderer] ⚠️ Data source '${sourceName}' found but no buffer`);
          return {
            data: null,
            status: 'NO_BUFFER',
            message: 'Data source found but no buffer available',
            metadata: { sourceName }
          };
        }

        const availableSources = Array.from(dataSourceManager.sources.keys());
        console.warn(`[HistoryBarRenderer] ❌ Source '${sourceName}' not found in DataSourceManager`);
        return {
          data: null,
          status: 'SOURCE_NOT_FOUND',
          message: `Source '${sourceName}' not found. Available: ${availableSources.join(', ')}`,
          metadata: { requestedSource: sourceName, availableSources }
        };
      }

      return {
        data: null,
        status: 'MANAGER_NOT_AVAILABLE',
        message: 'DataSourceManager not available',
        metadata: {}
      };

    } catch (error) {
      console.error(`[HistoryBarRenderer] Error getting data for '${dataSourceRef}':`, error);
      return {
        data: null,
        status: 'ERROR',
        message: `Error occurred: ${error.message}`,
        metadata: { error: error.message }
      };
    }
  }

  /**
   * Parse DataSource reference to support enhanced data access (reuse from SparklineRenderer)
   * @param {string} dataSourceRef - Reference like 'source_name' or 'source_name.transformations.key'
   * @returns {Object} Parsed reference details
   */
  static parseDataSourceReference(dataSourceRef) {
    const parts = dataSourceRef.split('.');
    const sourceName = parts[0];

    if (parts.length === 1) {
      return { sourceName, dataKey: null, isTransformation: false, isAggregation: false };
    }

    if (parts.length >= 3) {
      const dataType = parts[1];
      const dataKey = parts.slice(2).join('.');
      return {
        sourceName,
        dataKey,
        isTransformation: dataType === 'transformations',
        isAggregation: dataType === 'aggregations'
      };
    }

    return { sourceName, dataKey: null, isTransformation: false, isAggregation: false };
  }

  /**
   * Get enhanced DataSource data (reuse from SparklineRenderer)
   * @param {Object} currentData - Current data from DataSource
   * @param {string} dataKey - Key for transformation or aggregation
   * @param {boolean} isTransformation - Whether accessing transformation data
   * @param {boolean} isAggregation - Whether accessing aggregation data
   * @param {string} sourceName - Source name for logging
   * @returns {Object} Data result for history bar rendering
   */
  static getEnhancedDataSourceData(currentData, dataKey, isTransformation, isAggregation, sourceName) {
    try {
      let enhancedValue = null;
      let dataType = 'unknown';

      if (isTransformation && currentData.transformations) {
        enhancedValue = currentData.transformations[dataKey];
        dataType = 'transformation';
      } else if (isAggregation && currentData.aggregations) {
        const aggregationData = currentData.aggregations[dataKey];
        dataType = 'aggregation';

        if (typeof aggregationData === 'object' && aggregationData !== null) {
          if (aggregationData.avg !== undefined) {
            enhancedValue = aggregationData.avg;
          } else if (aggregationData.value !== undefined) {
            enhancedValue = aggregationData.value;
          } else {
            enhancedValue = aggregationData;
          }
        } else {
          enhancedValue = aggregationData;
        }
      }

      if (enhancedValue === null || enhancedValue === undefined) {
        return {
          data: null,
          status: 'ENHANCED_DATA_NOT_FOUND',
          message: `${dataType} '${dataKey}' not found or has no data`,
          metadata: {
            sourceName,
            dataKey,
            dataType,
            availableTransformations: Object.keys(currentData.transformations || {}),
            availableAggregations: Object.keys(currentData.aggregations || {})
          }
        };
      }

      // For single values, generate synthetic historical data
      if (typeof enhancedValue === 'number') {
        return HistoryBarRenderer.generateSyntheticHistoricalData(enhancedValue, currentData, sourceName, dataKey, dataType);
      }

      return {
        data: null,
        status: 'ENHANCED_DATA_NOT_NUMERIC',
        message: `${dataType} '${dataKey}' is not numeric: ${typeof enhancedValue}`,
        metadata: { sourceName, dataKey, dataType, value: enhancedValue }
      };

    } catch (error) {
      console.error(`[HistoryBarRenderer] Error accessing enhanced data:`, error);
      return {
        data: null,
        status: 'ENHANCED_DATA_ERROR',
        message: `Error accessing ${isTransformation ? 'transformation' : 'aggregation'} '${dataKey}': ${error.message}`,
        metadata: { sourceName, dataKey, error: error.message }
      };
    }
  }

  /**
   * Generate synthetic historical data for single enhanced values
   * @param {number} currentValue - Current transformed/aggregated value
   * @param {Object} currentData - Full DataSource data
   * @param {string} sourceName - Source name
   * @param {string} dataKey - Data key
   * @param {string} dataType - Type of data (transformation/aggregation)
   * @returns {Object} Data result with synthetic history
   */
  static generateSyntheticHistoricalData(currentValue, currentData, sourceName, dataKey, dataType) {
    const historicalData = [];
    const now = Date.now();

    // Use buffer data if available for better synthetic generation
    if (currentData.buffer) {
      const bufferData = currentData.buffer.getAll();

      if (bufferData.length > 1) {
        bufferData.forEach(point => {
          let syntheticValue = currentValue;

          if (dataType === 'transformation') {
            const ratio = currentData.v ? currentValue / currentData.v : 1;
            syntheticValue = point.v * ratio;
          } else if (dataType === 'aggregation') {
            syntheticValue = currentValue + (Math.random() - 0.5) * (currentValue * 0.1);
          }

          historicalData.push({
            timestamp: point.t,
            value: syntheticValue
          });
        });

        console.log(`[HistoryBarRenderer] ✅ Generated ${historicalData.length} synthetic ${dataType} points for '${dataKey}'`);
        return {
          data: historicalData,
          status: 'OK_SYNTHETIC',
          message: `${historicalData.length} synthetic ${dataType} points`,
          metadata: {
            sourceName,
            dataKey,
            dataType,
            synthetic: true,
            currentValue,
            basedOnRawData: true
          }
        };
      }
    }

    // Fallback: Generate simple synthetic data
    for (let i = 23; i >= 0; i--) {
      const timestamp = now - i * 3600000; // 1-hour intervals for 24 hours
      const variance = (Math.random() - 0.5) * (currentValue * 0.1);
      historicalData.push({
        timestamp,
        value: currentValue + variance
      });
    }

    console.log(`[HistoryBarRenderer] ⚠️ Generated ${historicalData.length} fallback synthetic ${dataType} points for '${dataKey}'`);
    return {
      data: historicalData,
      status: 'OK_SYNTHETIC_FALLBACK',
      message: `${historicalData.length} fallback synthetic ${dataType} points`,
      metadata: {
        sourceName,
        dataKey,
        dataType,
        synthetic: true,
        currentValue,
        basedOnRawData: false
      }
    };
  }

  // Additional methods for rendering will be implemented in next part...

  /**
   * Parse various configuration formats (reuse RendererUtils methods)
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
   * Prepare animation attributes for future anime.js integration
   * @private
   */
  _prepareAnimationAttributes(overlay, style) {
    const animationAttributes = {
      barAttributes: [],
      hasAnimations: false
    };

    // Animation hooks for future implementation
    if (style.animatable !== false) {
      animationAttributes.barAttributes.push(`data-animatable="true"`);
    }

    if (style.cascade_speed > 0) {
      animationAttributes.barAttributes.push(`data-cascade-speed="${style.cascade_speed}"`);
      animationAttributes.hasAnimations = true;
    }

    if (style.reveal_animation) {
      animationAttributes.barAttributes.push(`data-reveal-animation="true"`);
      animationAttributes.hasAnimations = true;
    }

    return animationAttributes;
  }

  /**
   * Process templates during initial render
   * @private
   */
  _processTemplatesForInitialRender(overlay, style) {
    const content = overlay.content || style.content || '';

    if (!this._hasTemplates(content)) return content;

    // Try multiple approaches to get DataSource data
    let sourceData = null;

    // 1. Explicit dataSource
    if (overlay.dataSource && this.systemsManager) {
      sourceData = this.systemsManager.getDataSourceData?.(overlay.dataSource);
    }

    // 2. Global data context
    if (!sourceData) {
      sourceData = window.__msdDataContext || overlay._dataContext;
    }

    // 3. All data sources
    if (!sourceData && this.systemsManager) {
      sourceData = this.systemsManager.getAllDataSourceData?.();
    }

    // 4. DataSourceMixin fallback
    if (!sourceData && typeof DataSourceMixin !== 'undefined' && DataSourceMixin?.getAllData) {
      sourceData = DataSourceMixin.getAllData();
    }

    // Process templates if data available
    if (sourceData) {
      return this._processTemplates(content, sourceData);
    } else {
      console.warn(`[HistoryBarRenderer] No DataSource data for template processing: ${overlay.id}`);
      return content;
    }
  }

  /**
   * Template processing logic
   * @private
   */
  _processTemplates(content, sourceData) {
    if (!sourceData || typeof content !== 'string' || !content.includes('{')) {
      return content;
    }

    return content.replace(/\{([^}]+)\}/g, (match, template) => {
      try {
        // Split template into field path and format
        const [fieldPath, format] = template.split(':');

        // Navigate nested object paths
        const value = fieldPath.split('.').reduce((obj, key) => obj?.[key], sourceData);

        if (value !== undefined && value !== null) {
          // Apply format if specified
          if (format) {
            if (format.includes('f')) {
              const decimals = format.match(/\.(\d+)f/)?.[1];
              if (decimals !== undefined) {
                return Number(value).toFixed(parseInt(decimals));
              }
            } else if (format === '%') {
              return `${value}%`;
            }
          }
          return String(value);
        }

        return match; // Return original if field not found
      } catch (e) {
        console.warn(`[HistoryBarRenderer] Template processing failed:`, e);
        return match;
      }
    });
  }

  /**
   * Check if content has template placeholders
   * @private
   */
  _hasTemplates(content) {
    return content && typeof content === 'string' && content.includes('{');
  }

  // Placeholder methods for the rendering pipeline - will be implemented in next part
  _renderEnhancedHistoryBar(overlay, x, y, width, height, data, historyBarStyle, animationAttributes, processedContent) {
    const svgParts = [
      this._buildDefinitions(historyBarStyle, overlay.id),
      this._buildHistoryBarBackground(width, height, historyBarStyle, overlay.id),
      this._buildGridLines(width, height, historyBarStyle, overlay.id),
      this._buildAxis(width, height, historyBarStyle, overlay.id),
      this._buildThresholdLines(data, width, height, historyBarStyle, overlay.id),
      this._buildHistoryBars(data, width, height, historyBarStyle, overlay.id, animationAttributes),
      this._buildLabels(data, width, height, historyBarStyle, overlay.id),
      this._buildBrackets(width, height, historyBarStyle, overlay.id),
      this._buildStatusIndicator(width, height, historyBarStyle, overlay.id)
    ].filter(Boolean);

    console.log(`[HistoryBarRenderer] Rendered enhanced history bar ${overlay.id} with ${historyBarStyle.features.length} features`);

    return `<g data-overlay-id="${overlay.id}"
                data-overlay-type="history_bar"
                data-source="${overlay.source}"
                data-history-bar-features="${historyBarStyle.features.join(',')}"
                data-animation-ready="${!!animationAttributes.hasAnimations}"
                transform="translate(${x}, ${y})">
              ${svgParts.join('\n')}
            </g>`;
  }

  /**
   * Build SVG definitions for gradients, patterns, and effects
   * @private
   */
  _buildDefinitions(historyBarStyle, overlayId) {
    const defs = [];

    // Bar gradients
    if (historyBarStyle.gradient) {
      defs.push(RendererUtils.createGradientDefinition(historyBarStyle.gradient, `history-bar-gradient-${overlayId}`));
    }

    // Patterns
    if (historyBarStyle.pattern) {
      defs.push(RendererUtils.createPatternDefinition(historyBarStyle.pattern, `history-bar-pattern-${overlayId}`));
    }

    // Effects (filters)
    if (historyBarStyle.glow) {
      defs.push(RendererUtils.createGlowFilter(historyBarStyle.glow, `history-bar-glow-${overlayId}`));
    }

    if (historyBarStyle.shadow) {
      defs.push(RendererUtils.createShadowFilter(historyBarStyle.shadow, `history-bar-shadow-${overlayId}`));
    }

    if (historyBarStyle.blur) {
      defs.push(RendererUtils.createBlurFilter(historyBarStyle.blur, `history-bar-blur-${overlayId}`));
    }

    return defs.length > 0 ? `<defs>${defs.join('\n')}</defs>` : '';
  }

  /**
   * Build background rectangle for contrast
   * @private
   */
  _buildHistoryBarBackground(width, height, historyBarStyle, overlayId) {
    // Only render background if explicitly configured
    return '';
  }

  /**
   * Build grid lines for technical appearance
   * @private
   */
  _buildGridLines(width, height, historyBarStyle, overlayId) {
    if (!historyBarStyle.show_grid) return '';

    const lines = [];
    const gridCount = historyBarStyle.orientation === 'horizontal' ? 5 : 4;

    if (historyBarStyle.orientation === 'horizontal') {
      // Horizontal bars - vertical grid lines
      for (let i = 1; i < gridCount; i++) {
        const x = (width / gridCount) * i;
        lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}"
                          stroke="${historyBarStyle.grid_color}"
                          stroke-width="1"
                          opacity="${historyBarStyle.grid_opacity}"/>`);
      }
    } else {
      // Vertical bars - horizontal grid lines
      for (let i = 1; i < gridCount; i++) {
        const y = (height / gridCount) * i;
        lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}"
                          stroke="${historyBarStyle.grid_color}"
                          stroke-width="1"
                          opacity="${historyBarStyle.grid_opacity}"/>`);
      }
    }

    return `<g data-feature="grid-lines">${lines.join('\n')}</g>`;
  }

  /**
   * Build axis lines
   * @private
   */
  _buildAxis(width, height, historyBarStyle, overlayId) {
    if (!historyBarStyle.show_axis) return '';

    const lines = [];

    if (historyBarStyle.orientation === 'horizontal') {
      // Bottom axis line
      lines.push(`<line x1="0" y1="${height}" x2="${width}" y2="${height}"
                        stroke="${historyBarStyle.axis_color}" stroke-width="1"/>`);
    } else {
      // Left axis line
      lines.push(`<line x1="0" y1="0" x2="0" y2="${height}"
                        stroke="${historyBarStyle.axis_color}" stroke-width="1"/>`);
    }

    return `<g data-feature="axis">${lines.join('\n')}</g>`;
  }

  /**
   * Build threshold reference lines
   * @private
   */
  _buildThresholdLines(data, width, height, historyBarStyle, overlayId) {
    if (!historyBarStyle.thresholds || historyBarStyle.thresholds.length === 0) return '';

    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    const thresholdLines = historyBarStyle.thresholds.map(threshold => {
      let line;

      if (historyBarStyle.orientation === 'horizontal') {
        const y = height - ((threshold.value - minValue) / valueRange) * height;
        line = `<line x1="0" y1="${y}" x2="${width}" y2="${y}"`;
      } else {
        const x = ((threshold.value - minValue) / valueRange) * width;
        line = `<line x1="${x}" y1="0" x2="${x}" y2="${height}"`;
      }

      const strokeDash = threshold.dash ? 'stroke-dasharray="4,2"' : '';

      return `${line} stroke="${threshold.color}" stroke-width="${threshold.width}"
                     opacity="${threshold.opacity}" ${strokeDash}
                     data-threshold="${threshold.value}"/>`;
    });

    return `<g data-feature="threshold-lines">${thresholdLines.join('\n')}</g>`;
  }

  /**
   * Build the main history bars
   * @private
   */
  _buildHistoryBars(data, width, height, historyBarStyle, overlayId, animationAttributes) {
    const processedData = this._processDataForRendering(data, historyBarStyle);
    const timeWindow = this._parseTimeWindow(historyBarStyle.time_window);
    const buckets = this._createTimeBuckets(processedData, timeWindow, historyBarStyle.bucket_size);

    // Calculate max value for proper scaling
    const maxValue = this._getMaxValueForNormalization(historyBarStyle, buckets);

    console.log(`[HistoryBarRenderer] Building ${buckets.length} bars with max value: ${maxValue}`);

    const bars = buckets.map((bucket, index) => {
      const value = this._aggregateBucketValue(bucket, historyBarStyle.aggregation_mode);
      const barColor = this._getBarColor(value, historyBarStyle);

      let barGeometry;
      if (historyBarStyle.orientation === 'horizontal') {
        barGeometry = this._createHorizontalBar(bucket, value, index, buckets.length, width, height, historyBarStyle, maxValue);
      } else {
        barGeometry = this._createVerticalBar(bucket, value, index, buckets.length, width, height, historyBarStyle, maxValue);
      }

      const attributes = [];
      attributes.push(`fill="${barColor}"`);
      attributes.push(`opacity="${historyBarStyle.bar_opacity}"`);

      // Effects
      const filters = [];
      if (historyBarStyle.glow) filters.push(`url(#history-bar-glow-${overlayId})`);
      if (historyBarStyle.shadow) filters.push(`url(#history-bar-shadow-${overlayId})`);
      if (historyBarStyle.blur) filters.push(`url(#history-bar-blur-${overlayId})`);
      if (filters.length > 0) {
        attributes.push(`filter="${filters.join(' ')}"`);
      }

      // Animation attributes
      attributes.push(...animationAttributes.barAttributes);
      attributes.push(`data-bar-index="${index}"`);
      attributes.push(`data-bar-value="${value}"`);
      attributes.push(`data-bar-timestamp="${bucket.timestamp}"`);

      // Hover support
      if (historyBarStyle.hover_enabled) {
        attributes.push(`data-hover-color="${historyBarStyle.hover_color}"`);
        attributes.push(`class="history-bar-hoverable"`);
      }

      return `<rect ${barGeometry} ${attributes.join(' ')} data-feature="bar"/>`;
    });

    return `<g data-feature="history-bars">${bars.join('\n')}</g>`;
  }

  /**
   * Create horizontal bar geometry
   * @private
   */
  _createHorizontalBar(bucket, value, index, totalBars, width, height, historyBarStyle, maxValue) {
    const barWidth = (width / totalBars) - historyBarStyle.bar_gap;
    const barX = (index * width / totalBars) + (historyBarStyle.bar_gap / 2);

    // Normalize value to bar height using provided maxValue
    const normalizedValue = Math.max(0, Math.min(1, value / maxValue));
    const barHeight = normalizedValue * height;
    const barY = height - barHeight;

    const rx = historyBarStyle.bar_radius;
    const ry = historyBarStyle.bar_radius;

    // Log only first and last bars to avoid spam
    if (index === 0 || index === totalBars - 1) {
      console.log(`[HistoryBarRenderer] Bar ${index}: value=${value}, maxValue=${maxValue}, normalized=${normalizedValue.toFixed(3)}, height=${barHeight.toFixed(1)}`);
    }

    return `x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="${rx}" ry="${ry}"`;
  }

  /**
   * Create vertical bar geometry
   * @private
   */
  _createVerticalBar(bucket, value, index, totalBars, width, height, historyBarStyle, maxValue) {
    const barHeight = (height / totalBars) - historyBarStyle.bar_gap;
    const barY = index * height / totalBars + (historyBarStyle.bar_gap / 2);

    // Normalize value to bar width using provided maxValue
    const normalizedValue = Math.max(0, Math.min(1, value / maxValue));
    const barWidth = normalizedValue * width;
    const barX = 0;

    const rx = historyBarStyle.bar_radius;
    const ry = historyBarStyle.bar_radius;

    return `x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="${rx}" ry="${ry}"`;
  }

  /**
   * Get bar color based on value and color ranges
   * @private
   */
  _getBarColor(value, historyBarStyle) {
    // Check color ranges first
    if (historyBarStyle.color_ranges && historyBarStyle.color_ranges.length > 0) {
      for (const range of historyBarStyle.color_ranges) {
        if (value >= range.min && value <= range.max) {
          return range.color;
        }
      }
    }

    // Fallback to default color
    return historyBarStyle.bar_color;
  }

  /**
   * Build value labels
   * @private
   */
  _buildLabels(data, width, height, historyBarStyle, overlayId) {
    if (!historyBarStyle.show_labels && !historyBarStyle.show_values) return '';

    const labels = [];
    const fontSize = historyBarStyle.label_font_size;
    const color = historyBarStyle.label_color;

    // Time labels (simplified)
    if (historyBarStyle.show_labels) {
      const labelCount = Math.min(5, Math.floor(width / 60)); // Reasonable label spacing
      for (let i = 0; i < labelCount; i++) {
        const x = (i / (labelCount - 1)) * width;
        const y = height + fontSize + 4;
        const timeLabel = this._formatTimeLabel(Date.now() - (labelCount - 1 - i) * 3600000); // Hour labels

        labels.push(`<text x="${x}" y="${y}" fill="${color}" font-size="${fontSize}"
                           text-anchor="middle" data-label-type="time">${timeLabel}</text>`);
      }
    }

    return labels.length > 0 ? `<g data-feature="labels">${labels.join('\n')}</g>` : '';
  }

  /**
   * Build LCARS-style brackets
   * @private
   */
  _buildBrackets(width, height, historyBarStyle, overlayId) {
    if (!historyBarStyle.bracket_style) return '';

    const bracketColor = historyBarStyle.bracket_color || historyBarStyle.bar_color;
    const strokeWidth = 2;
    const gap = 4;

    const leftBracket = `M ${-gap - 8} 0 L ${-gap - 8} ${height} M ${-gap - 8} 0 L ${-gap} 0 M ${-gap - 8} ${height} L ${-gap} ${height}`;
    const rightBracket = `M ${width + gap} 0 L ${width + gap + 8} 0 M ${width + gap + 8} 0 L ${width + gap + 8} ${height} M ${width + gap} ${height} L ${width + gap + 8} ${height}`;

    return `<g data-feature="brackets">
              <path d="${leftBracket}" stroke="${bracketColor}" stroke-width="${strokeWidth}" fill="none"/>
              <path d="${rightBracket}" stroke="${bracketColor}" stroke-width="${strokeWidth}" fill="none"/>
            </g>`;
  }

  /**
   * Build status indicator
   * @private
   */
  _buildStatusIndicator(width, height, historyBarStyle, overlayId) {
    if (!historyBarStyle.status_indicator) return '';

    const indicatorSize = 4;
    const indicatorColor = typeof historyBarStyle.status_indicator === 'string' ?
      historyBarStyle.status_indicator : 'var(--lcars-green)';

    return `<circle cx="${-indicatorSize - 8}" cy="${height / 2}" r="${indicatorSize}"
                    fill="${indicatorColor}"
                    data-feature="status-indicator"/>`;
  }

  /**
   * Process data for rendering (time bucketing and aggregation)
   * @private
   */
  _processDataForRendering(data, historyBarStyle) {
    // Limit data points if needed
    if (historyBarStyle.max_bars > 0 && data.length > historyBarStyle.max_bars) {
      const step = Math.floor(data.length / historyBarStyle.max_bars);
      return data.filter((_, index) => index % step === 0);
    }

    return data;
  }

  /**
   * Parse time window string to milliseconds
   * @private
   */
  _parseTimeWindow(timeWindow) {
    const units = {
      's': 1000,
      'm': 60000,
      'h': 3600000,
      'd': 86400000
    };

    const match = timeWindow.match(/^(\d+)([smhd])$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      return value * units[unit];
    }

    return 86400000; // Default to 24 hours
  }

  /**
   * Create time buckets for data aggregation
   * @private
   */
  _createTimeBuckets(data, timeWindow, bucketSize) {
    if (bucketSize === 'auto') {
      // Auto-determine bucket size based on data density
      const dataSpan = data.length > 1 ?
        data[data.length - 1].timestamp - data[0].timestamp :
        timeWindow;
      bucketSize = Math.max(timeWindow / 24, dataSpan / 50); // Max 50 buckets
    } else {
      bucketSize = this._parseTimeWindow(bucketSize);
    }

    const buckets = [];
    // Use the latest data timestamp as "now" to ensure current data is included
    const latestDataTime = data.length > 0 ? Math.max(...data.map(p => p.timestamp)) : Date.now();
    const now = Math.max(latestDataTime, Date.now()); // Ensure we don't go backwards in time
    const startTime = now - timeWindow;

    console.log(`[HistoryBarRenderer] Creating time buckets: timeWindow=${timeWindow}ms, bucketSize=${bucketSize}ms, data points=${data.length}`);
    console.log(`[HistoryBarRenderer] Data timestamps range: ${Math.min(...data.map(p => p.timestamp))} - ${Math.max(...data.map(p => p.timestamp))}`);
    console.log(`[HistoryBarRenderer] Bucket time range: ${startTime} - ${now} (now adjusted to include latest data)`);

    for (let time = startTime; time < now; time += bucketSize) {
      const bucketData = data.filter(point =>
        point.timestamp >= time && point.timestamp < time + bucketSize
      );

      const bucket = {
        timestamp: time,
        endTimestamp: time + bucketSize,
        data: bucketData,
        count: bucketData.length
      };

      // Log bucket details for debugging
      if (bucketData.length > 0) {
        const values = bucketData.map(p => p.value);
        const times = bucketData.map(p => p.timestamp);
        console.log(`[HistoryBarRenderer] Bucket ${Math.floor((time - startTime) / bucketSize)}: ${bucketData.length} points, values: [${values.join(', ')}], times: [${times.join(', ')}]`);
      }

      buckets.push(bucket);
    }

    // CRITICAL: Add one more bucket to catch any data points at the exact "now" timestamp
    const finalBucketData = data.filter(point => point.timestamp >= now);
    if (finalBucketData.length > 0) {
      console.log(`[HistoryBarRenderer] Adding final bucket for ${finalBucketData.length} points at/after timestamp ${now}`);
      buckets.push({
        timestamp: now,
        endTimestamp: now + bucketSize,
        data: finalBucketData,
        count: finalBucketData.length
      });
    }

    // Log bucket summary
    const nonEmptyBuckets = buckets.filter(b => b.count > 0);
    console.log(`[HistoryBarRenderer] Created ${buckets.length} buckets, ${nonEmptyBuckets.length} with data`);

    return buckets;
  }

  /**
   * Aggregate values within a bucket
   * @private
   */
  _aggregateBucketValue(bucket, aggregationMode) {
    if (bucket.data.length === 0) return 0;

    const values = bucket.data.map(d => d.value);

    switch (aggregationMode) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'max':
        return Math.max(...values);
      case 'min':
        return Math.min(...values);
      case 'count':
        return values.length;
      case 'latest':
        // Use the most recent value in the bucket (highest timestamp)
        const sortedByTime = bucket.data.sort((a, b) => b.timestamp - a.timestamp);
        return sortedByTime[0].value;
      case 'average':
      default:
        // For real-time updates, if we have multiple points in the same bucket,
        // use the latest value instead of average to avoid mixing old and new values
        if (bucket.data.length > 1) {
          const sortedByTime = bucket.data.sort((a, b) => b.timestamp - a.timestamp);
          console.log(`[HistoryBarRenderer] Bucket has ${bucket.data.length} points, using latest: ${sortedByTime[0].value} (was going to average: ${values.reduce((a, b) => a + b, 0) / values.length})`);
          return sortedByTime[0].value;
        }
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
  }

  /**
   * Get maximum value for normalization
   * @private
   */
  _getMaxValueForNormalization(historyBarStyle, buckets = null) {
    // Use color ranges max if available
    if (historyBarStyle.color_ranges && historyBarStyle.color_ranges.length > 0) {
      const colorMax = Math.max(...historyBarStyle.color_ranges.map(r => r.max));
      console.log(`[HistoryBarRenderer] Using color ranges max: ${colorMax}`);
      return colorMax;
    }

    // If we have bucket data, use the actual max value for auto-scaling
    if (buckets && buckets.length > 0) {
      const values = buckets.map(bucket => this._aggregateBucketValue(bucket, historyBarStyle.aggregation_mode));
      const nonZeroValues = values.filter(v => v > 0);

      if (nonZeroValues.length === 0) {
        console.log(`[HistoryBarRenderer] All bucket values are zero, using default max: 100`);
        return 100;
      }

      const dataMax = Math.max(...nonZeroValues);
      const dataMin = Math.min(...nonZeroValues);

      console.log(`[HistoryBarRenderer] Bucket data range: ${dataMin} - ${dataMax} (from ${values.length} buckets, ${nonZeroValues.length} non-zero)`);

      // Use a reasonable max that gives good visual scaling
      if (dataMax <= 0) return 100; // Fallback for all-zero data

      // Round up to next nice number for better scaling
      const magnitude = Math.pow(10, Math.floor(Math.log10(dataMax)));
      const normalized = dataMax / magnitude;
      let niceMax;

      if (normalized <= 1) niceMax = magnitude;
      else if (normalized <= 2) niceMax = 2 * magnitude;
      else if (normalized <= 5) niceMax = 5 * magnitude;
      else niceMax = 10 * magnitude;

      console.log(`[HistoryBarRenderer] Using auto-scaled max: ${niceMax} (from data max: ${dataMax})`);
      return niceMax;
    }

    // Default normalization value for percentages or when no data
    console.log(`[HistoryBarRenderer] Using default max: 100`);
    return 100;
  }  /**
   * Format time label for display
   * @private
   */
  _formatTimeLabel(timestamp) {
    const date = new Date(timestamp);
    return date.getHours().toString().padStart(2, '0') + ':00';
  }

  _renderEnhancedStatusIndicator(overlay, x, y, width, height, dataResult, historyBarStyle, animationAttributes, processedContent) {
    const statusColors = {
      'NO_SOURCE': 'var(--lcars-red)',
      'MANAGER_NOT_AVAILABLE': 'var(--lcars-blue)',
      'SOURCE_NOT_FOUND': 'var(--lcars-orange)',
      'NO_BUFFER': 'var(--lcars-orange)',
      'EMPTY_BUFFER': 'var(--lcars-blue)',
      'INSUFFICIENT_DATA': 'var(--lcars-blue)',
      'ERROR': 'var(--lcars-red)'
    };

    const statusMessages = {
      'NO_SOURCE': 'NO SOURCE',
      'MANAGER_NOT_AVAILABLE': 'LOADING',
      'SOURCE_NOT_FOUND': 'NOT FOUND',
      'NO_BUFFER': 'NO BUFFER',
      'EMPTY_BUFFER': 'NO DATA',
      'INSUFFICIENT_DATA': 'LOADING',
      'ERROR': 'ERROR'
    };

    const indicatorColor = statusColors[dataResult.status] || historyBarStyle.bar_color;
    const indicatorText = statusMessages[dataResult.status] || 'UNKNOWN';
    const fontSize = Math.min(width / 10, height / 3, 14);

    const loadingStates = ['MANAGER_NOT_AVAILABLE', 'INSUFFICIENT_DATA'];
    const isLoading = loadingStates.includes(dataResult.status);

    const animationProps = isLoading ? `
      <animate attributeName="opacity" values="0.3;1.0;0.3" dur="1s" repeatCount="indefinite"/>
    ` : `
      <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite"/>
    `;

    const svgParts = [
      this._buildDefinitions(historyBarStyle, overlay.id),
      historyBarStyle.bracket_style ? this._buildBrackets(width, height, { ...historyBarStyle, bar_color: indicatorColor }, overlay.id) : '',
      `<rect width="${width}" height="${height}"
             fill="none" stroke="${indicatorColor}" stroke-width="2"
             stroke-dasharray="${isLoading ? '4,2' : '8,4'}" opacity="0.6">
        ${animationProps}
       </rect>`,
      `<text x="${width / 2}" y="${height / 2}"
             fill="${indicatorColor}" text-anchor="middle" dominant-baseline="middle"
             font-family="var(--lcars-font-family, monospace)"
             font-size="${fontSize}" font-weight="bold">
        ${indicatorText}
       </text>`,
      width > 120 ? `<text x="${width / 2}" y="${height / 2 + fontSize + 4}"
                           fill="${indicatorColor}" text-anchor="middle" dominant-baseline="middle"
                           font-family="var(--lcars-font-family, monospace)"
                           font-size="${Math.max(8, fontSize * 0.6)}" opacity="0.7">
                      ${overlay.source || 'NO SOURCE ID'}
                     </text>` : ''
    ].filter(Boolean);

    return `<g data-overlay-id="${overlay.id}"
                data-overlay-type="history_bar"
                data-source="${overlay.source || 'unknown'}"
                data-status="${dataResult.status}"
                data-animation-ready="${!!animationAttributes.hasAnimations}"
                transform="translate(${x}, ${y})">
              ${svgParts.join('\n')}
            </g>`;
  }

  _renderFallbackHistoryBar(overlay, x, y, width, height) {
    const style = overlay.finalStyle || overlay.style || {};
    const color = style.bar_color || style.color || 'var(--lcars-gray)';

    console.warn(`[HistoryBarRenderer] Using fallback rendering for history bar ${overlay.id}`);

    return `<g data-overlay-id="${overlay.id}" data-overlay-type="history_bar" data-fallback="true">
              <g transform="translate(${x}, ${y})">
                <rect width="${width}" height="${height}"
                      fill="none" stroke="${color}" stroke-width="2"/>
                <text x="${width / 2}" y="${height / 2}" text-anchor="middle"
                      fill="${color}" font-size="12" dominant-baseline="middle">
                  History Bar Error
                </text>
              </g>
            </g>`;
  }

  /**
   * Update history bar data dynamically when data source changes (static method for delegation pattern)
   * @param {Element} historyBarElement - The history bar SVG element
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - New data from the data source
   * @returns {boolean} True if content was updated, false if unchanged
   * @static
   */
  static updateHistoryBarData(historyBarElement, overlay, sourceData) {
    try {
      console.log(`[HistoryBarRenderer] updateHistoryBarData called for ${overlay.id}:`, {
        hasBuffer: !!(sourceData?.buffer),
        bufferSize: sourceData?.buffer?.size?.() || 0,
        currentStatus: historyBarElement.getAttribute('data-status'),
        elementFound: !!historyBarElement,
        currentValue: sourceData?.v
      });

      if (!historyBarElement || !overlay || !sourceData) {
        console.warn('[HistoryBarRenderer] updateHistoryBarData: Missing required parameters');
        return false;
      }

      // Create instance for update operations
      const instance = new HistoryBarRenderer();
      return instance._updateHistoryBarElement(historyBarElement, overlay, sourceData);
    } catch (error) {
      console.error(`[HistoryBarRenderer] Error updating history bar ${overlay.id}:`, error);
      return false;
    }
  }

  /**
   * Instance method to update history bar element
   * @private
   */
  _updateHistoryBarElement(historyBarElement, overlay, sourceData) {
    const currentStatus = historyBarElement.getAttribute('data-status');
    const isStatusIndicator = currentStatus !== null;

    // If status indicator and data is now available, upgrade
    if (isStatusIndicator && (sourceData.buffer || sourceData.historicalData)) {
      return this._upgradeStatusIndicatorToHistoryBar(historyBarElement, overlay, sourceData);
    }

    // Convert source data to history bar format
    const historicalData = this._extractHistoricalData(sourceData);

    if (historicalData.length === 0) {
      console.warn(`[HistoryBarRenderer] No data for history bar ${overlay.id}`);
      historyBarElement.setAttribute('data-status', 'NO_DATA');
      return false;
    }

    try {
      // Extract dimensions from overlay config
      const bounds = {
        width: overlay.size?.[0] || 300,
        height: overlay.size?.[1] || 80
      };

      // Re-resolve styles for consistency
      const style = overlay.finalStyle || overlay.style || {};
      const historyBarStyle = this._resolveHistoryBarStyles(style, overlay.id);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      // CRITICAL: Instead of just updating bars, regenerate the entire visualization
      // because the max value may have changed with new data
      console.log(`[HistoryBarRenderer] Regenerating entire history bar ${overlay.id} due to data change`);

      const svgParts = [
        this._buildDefinitions(historyBarStyle, overlay.id),
        this._buildHistoryBarBackground(bounds.width, bounds.height, historyBarStyle, overlay.id),
        this._buildGridLines(bounds.width, bounds.height, historyBarStyle, overlay.id),
        this._buildAxis(bounds.width, bounds.height, historyBarStyle, overlay.id),
        this._buildThresholdLines(historicalData, bounds.width, bounds.height, historyBarStyle, overlay.id),
        this._buildHistoryBars(historicalData, bounds.width, bounds.height, historyBarStyle, overlay.id, animationAttributes),
        this._buildLabels(historicalData, bounds.width, bounds.height, historyBarStyle, overlay.id),
        this._buildBrackets(bounds.width, bounds.height, historyBarStyle, overlay.id),
        this._buildStatusIndicator(bounds.width, bounds.height, historyBarStyle, overlay.id)
      ].filter(Boolean);

      // Replace entire innerHTML with updated history bar content
      historyBarElement.innerHTML = svgParts.join('\n');

      // Update status attributes
      historyBarElement.removeAttribute('data-status');
      historyBarElement.setAttribute('data-last-update', Date.now());
      historyBarElement.setAttribute('data-history-bar-features', historyBarStyle.features.join(','));

      console.log(`[HistoryBarRenderer] ✅ Completely regenerated history bar ${overlay.id} with ${historicalData.length} points`);
      return true;

    } catch (error) {
      console.error(`[HistoryBarRenderer] Error updating history bar ${overlay.id}:`, error);
      historyBarElement.setAttribute('data-status', 'ERROR');
      return false;
    }
  }

  /**
   * Upgrade a status indicator to a real history bar
   * @private
   */
  _upgradeStatusIndicatorToHistoryBar(historyBarElement, overlay, sourceData) {
    const historicalData = this._extractHistoricalData(sourceData);

    if (historicalData.length > 0) {
      const size = overlay.size || [300, 80];
      const [width, height] = size;
      const style = overlay.finalStyle || overlay.style || {};
      const historyBarStyle = this._resolveHistoryBarStyles(style, overlay.id);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      // Generate complete enhanced history bar with ALL features
      const svgParts = [
        this._buildDefinitions(historyBarStyle, overlay.id),
        this._buildHistoryBarBackground(width, height, historyBarStyle, overlay.id),
        this._buildGridLines(width, height, historyBarStyle, overlay.id),
        this._buildAxis(width, height, historyBarStyle, overlay.id),
        this._buildThresholdLines(historicalData, width, height, historyBarStyle, overlay.id),
        this._buildHistoryBars(historicalData, width, height, historyBarStyle, overlay.id, animationAttributes),
        this._buildLabels(historicalData, width, height, historyBarStyle, overlay.id),
        this._buildBrackets(width, height, historyBarStyle, overlay.id),
        this._buildStatusIndicator(width, height, historyBarStyle, overlay.id)
      ].filter(Boolean);

      // Replace entire innerHTML with complete history bar content
      historyBarElement.innerHTML = svgParts.join('\n');

      historyBarElement.removeAttribute('data-status');
      historyBarElement.setAttribute('data-last-update', Date.now());
      historyBarElement.setAttribute('data-history-bar-features', historyBarStyle.features.join(','));

      console.log(`[HistoryBarRenderer] ✅ Upgraded status indicator ${overlay.id} to full history bar with ${historyBarStyle.features.length} features and ${historicalData.length} data points`);
      return true;
    } else {
      historyBarElement.setAttribute('data-status', historicalData.length === 0 ? 'NO_DATA' : 'INSUFFICIENT_DATA');
      return false;
    }
  }

  /**
   * Extract historical data from various source data formats
   * @private
   */
  _extractHistoricalData(sourceData) {
    let historicalData = [];

    console.log(`[HistoryBarRenderer] Extracting historical data:`, {
      hasBuffer: !!(sourceData?.buffer),
      bufferSize: sourceData?.buffer?.size?.() || 0,
      currentValue: sourceData?.v,
      currentTimestamp: sourceData?.t
    });

    // Method 1: Use buffer data directly
    if (sourceData.buffer && typeof sourceData.buffer.getAll === 'function') {
      const bufferData = sourceData.buffer.getAll();
      historicalData = bufferData.map(point => ({
        timestamp: point.t,
        value: point.v
      }));

      // CRITICAL: Always add current value as the latest point to ensure real-time updates
      if (sourceData.v !== undefined && sourceData.t !== undefined) {
        const latestBufferTime = bufferData.length > 0 ? Math.max(...bufferData.map(p => p.t)) : 0;

        console.log(`[HistoryBarRenderer] Current: t=${sourceData.t}, v=${sourceData.v}, Latest buffer: t=${latestBufferTime}`);

        // Always add current value, even if it's the same timestamp (update existing or add new)
        const existingIndex = historicalData.findIndex(p => p.timestamp === sourceData.t);
        if (existingIndex >= 0) {
          // Update existing point
          console.log(`[HistoryBarRenderer] Updating existing point at timestamp ${sourceData.t}: ${historicalData[existingIndex].value} → ${sourceData.v}`);
          historicalData[existingIndex].value = sourceData.v;
        } else {
          // Add new point
          console.log(`[HistoryBarRenderer] Adding new current value ${sourceData.v} at ${sourceData.t} to historical data`);
          historicalData.push({
            timestamp: sourceData.t,
            value: sourceData.v
          });
        }

        // Sort by timestamp to maintain order
        historicalData.sort((a, b) => a.timestamp - b.timestamp);
      }

      const values = historicalData.map(p => p.value);
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      const latestPoint = historicalData[historicalData.length - 1];
      const oldestPoint = historicalData[0];
      console.log(`[HistoryBarRenderer] Using buffer data: ${historicalData.length} points, range: ${minValue} - ${maxValue}`);
      console.log(`[HistoryBarRenderer] Data points span: ${oldestPoint.timestamp} (${new Date(oldestPoint.timestamp).toISOString()}) to ${latestPoint.timestamp} (${new Date(latestPoint.timestamp).toISOString()})`);
      console.log(`[HistoryBarRenderer] Latest point value: ${latestPoint.value}`);
    }
    // Method 2: Use pre-formatted historical data
    else if (sourceData.historicalData && Array.isArray(sourceData.historicalData)) {
      historicalData = sourceData.historicalData;
      console.log('[HistoryBarRenderer] Using pre-formatted historical data:', historicalData.length, 'points');
    }
    // Method 3: Generate from single current value (fallback for testing)
    else if (sourceData.v !== undefined && sourceData.t !== undefined) {
      console.log('[HistoryBarRenderer] Generating demo data from current value:', sourceData.v);
      const now = Date.now();
      for (let i = 0; i < 24; i++) {
        historicalData.push({
          timestamp: now - (23 - i) * 3600000, // 24 hours of hourly data
          value: sourceData.v + (Math.random() - 0.5) * (sourceData.v * 0.2)
        });
      }
    }

    return historicalData;
  }

  /**
   * Get rendering capabilities and features supported
   * @public
   */
  getCapabilities() {
    return {
      orientations: ['horizontal', 'vertical'],
      aggregationModes: ['average', 'sum', 'max', 'min', 'count'],
      timeWindows: ['1h', '6h', '24h', '7d', '30d'],
      colorRanges: true,
      thresholds: true,
      effects: ['glow', 'shadow', 'blur'],
      lcarsFeatures: ['brackets', 'status-indicator', 'grid-lines'],
      animations: ['cascade', 'reveal'], // Future implementation
      hover: true,
      advanced: true
    };
  }

  // === DEBUG METHODS ===

  static debugHistoryBarUpdates() {
    console.log('🔍 Enhanced History Bar Update Debug Report');
    console.log('============================================');

    const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
    if (dsm) {
      const stats = dsm.getStats();
      console.log('DataSourceManager stats:', stats);
    } else {
      console.warn('DataSourceManager not accessible via debug interface');
    }
  }

  static debugDataSource(dataSourceName) {
    console.log(`🔍 Enhanced Debugging data source: ${dataSourceName}`);
    console.log('====================================================');

    const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
    if (!dsm) {
      console.error('❌ DataSourceManager not available');
      return;
    }

    const source = dsm.getSource(dataSourceName);
    if (!source) {
      console.error(`❌ Source '${dataSourceName}' not found`);
      console.log('Available sources:', Array.from(dsm.sources.keys()));
      return;
    }

    return { source };
  }
}

// Expose HistoryBarRenderer to window for console debugging
if (typeof window !== 'undefined') {
  window.HistoryBarRenderer = HistoryBarRenderer;
}