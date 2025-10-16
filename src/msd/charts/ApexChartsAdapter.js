/**
 * [ApexChartsAdapter] Lightweight translator between MSD DataSource and ApexCharts
 * 📊 Handles format conversion without modifying DataSource architecture
 *
 * Responsibilities:
 * - Convert RollingBuffer format to ApexCharts series format
 * - Support dot notation for enhanced DataSource paths
 * - Map MSD style config to ApexCharts options
 * - Handle multi-series aggregation
 *
 * @module ApexChartsAdapter
 * @requires cblcars-logging
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ApexChartsAdapter {
  /**
   * Convert MSD DataSource to ApexCharts series format
   * @param {string} sourceRef - DataSource reference (supports dot notation)
   * @param {Object} dataSourceManager - MSD DataSourceManager instance
   * @param {Object} config - Overlay configuration
   * @param {string} [config.name] - Series name override
   * @param {string} [config.time_window] - Time window filter (e.g., "12h")
   * @param {number} [config.max_points=500] - Maximum data points
   * @returns {Array} ApexCharts series array
   */
  static convertToSeries(sourceRef, dataSourceManager, config = {}) {
    try {
      // Parse dot notation (e.g., "temp.transformations.celsius")
      const { dataSource, dataPath } = this._resolveDataSourcePath(sourceRef, dataSourceManager);

      if (!dataSource) {
        cblcarsLog.warn(`[ApexChartsAdapter] DataSource not found: ${sourceRef}`);
        return [];
      }

      // Get historical data with error boundary
      let data;
      try {
        if (dataPath) {
          data = this._getEnhancedData(dataSource, dataPath, config);
        } else {
          data = this._getRawData(dataSource, config);
        }
      } catch (dataError) {
        cblcarsLog.error(`[ApexChartsAdapter] Error getting data for ${sourceRef}:`, dataError);
        return [];
      }

      if (!data || data.length === 0) {
        cblcarsLog.warn(`[ApexChartsAdapter] No data available for: ${sourceRef}`);
        return [];
      }

      // Convert to ApexCharts format
      const seriesName = config.name || this._extractSeriesName(sourceRef);

      return [{
        name: seriesName,
        data: data.map(point => ({
          x: point.timestamp || point.t,
          y: point.value || point.v
        }))
      }];

    } catch (error) {
      cblcarsLog.error(`[ApexChartsAdapter] Critical error in convertToSeries for ${sourceRef}:`, error);
      return [];
    }
  }

  /**
   * Convert multiple DataSources to multi-series format
   * @param {Array<string>|string} sourceRefs - Array of DataSource references or single reference
   * @param {Object} dataSourceManager - MSD DataSourceManager instance
   * @param {Object} config - Overlay configuration
   * @param {Object} [config.seriesNames] - Map of sourceRef to series name
   * @returns {Array} ApexCharts multi-series array
   */
  static convertToMultiSeries(sourceRefs, dataSourceManager, config = {}) {
    if (!Array.isArray(sourceRefs)) {
      return this.convertToSeries(sourceRefs, dataSourceManager, config);
    }

    const allSeries = [];

    sourceRefs.forEach(sourceRef => {
      const series = this.convertToSeries(sourceRef, dataSourceManager, {
        ...config,
        name: config.seriesNames?.[sourceRef] || this._extractSeriesName(sourceRef)
      });

      allSeries.push(...series);
    });

    return allSeries;
  }

  /**
   * Generate ApexCharts options from MSD overlay style config
   * @param {Object} style - MSD overlay style configuration
   * @param {Array<number>} size - [width, height] dimensions
   * @param {Object} context - Additional context (viewBox, etc.)
   * @returns {Object} ApexCharts options object
   */
  static generateOptions(style, size, context = {}) {
    try {
      // Validate inputs
      if (!Array.isArray(size) || size.length < 2) {
        cblcarsLog.warn(`[ApexChartsAdapter] Invalid size provided:`, size);
        size = [300, 150]; // Fallback
      }

      const [width, height] = size;
      const chartType = style.chart_type || style.type || 'line';

      // Validate chart type
      const validTypes = ['line', 'area', 'bar', 'scatter', 'candlestick', 'heatmap', 'radar'];
      if (!validTypes.includes(chartType)) {
        cblcarsLog.warn(`[ApexChartsAdapter] Invalid chart type: ${chartType}, defaulting to 'line'`);
      }

      // Generate base options from MSD style config
      const baseOptions = {
        chart: {
          type: chartType,
          height: height,
          width: width,
          background: 'transparent',
          foreColor: style.color || 'var(--lcars-orange)',

          // ADDED: Ensure chart stays within bounds
          parentHeightOffset: 0,

          // Animations
          animations: {
            enabled: style.animatable !== false,
            speed: style.animation_speed || 800,
            animateGradually: {
              enabled: true,
              delay: 150
            },
            dynamicAnimation: {
              enabled: true,
              speed: 350
            }
          },

          // Toolbar
          toolbar: {
            show: style.show_toolbar || false,
            tools: {
              download: false,
              selection: style.enable_selection || false,
              zoom: style.enable_zoom || false,
              zoomin: false,
              zoomout: false,
              pan: style.enable_pan || false,
              reset: false
            }
          },

          // Zoom
          zoom: {
            enabled: style.enable_zoom || false,
            type: 'x',
            autoScaleYaxis: true
          },

          // Selection
          selection: {
            enabled: style.enable_selection || false
          }
        },

        // Stroke styling
        stroke: {
          curve: this._mapSmoothingMode(style.smoothing_mode),
          width: style.width || style.stroke_width || 2,
          colors: [style.color || 'var(--lcars-orange)'],
          lineCap: style.line_cap || 'round',
          dashArray: style.dash_array || 0
        },

        // Fill (area charts)
        fill: {
          type: style.fill_gradient ? 'gradient' : 'solid',
          opacity: style.fill_opacity || 0.2,
          colors: [style.fill || style.color || 'var(--lcars-orange)'],
          gradient: style.fill_gradient ? this._mapGradient(style.fill_gradient) : undefined
        },

        // Data labels
        dataLabels: {
          enabled: style.show_values || false,
          formatter: style.value_format ?
            (val) => this._formatValue(val, style.value_format) : undefined
        },

        // Markers (data points)
        markers: {
          size: style.show_points ? (style.point_size || 3) : 0,
          colors: [style.point_color || style.color || 'var(--lcars-orange)'],
          strokeWidth: 0,
          hover: {
            size: style.show_points ? (style.point_size || 3) + 2 : 0
          }
        },

        // Grid
        grid: {
          show: style.grid_lines || style.show_grid || false,
          borderColor: style.grid_color || 'var(--lcars-gray)',
          strokeDashArray: 4,
          position: 'back',
          xaxis: {
            lines: {
              show: style.grid_vertical !== false
            }
          },
          yaxis: {
            lines: {
              show: style.grid_horizontal !== false
            }
          },
          row: {
            colors: undefined,
            opacity: style.grid_opacity || 0.4
          },
          column: {
            colors: undefined,
            opacity: style.grid_opacity || 0.4
          }
        },

        // X-Axis (time)
        xaxis: {
          type: 'datetime',
          labels: {
            show: style.show_labels !== false,
            style: {
              colors: style.label_color || 'var(--lcars-white)',
              fontSize: style.label_font_size || '10px',
              fontFamily: style.label_font_family || 'var(--lcars-font-family, Antonio)'
            },
            datetimeUTC: false
          },
          axisBorder: {
            show: style.show_axis !== false,
            color: style.axis_color || 'var(--lcars-gray)'
          },
          axisTicks: {
            show: style.show_axis !== false,
            color: style.axis_color || 'var(--lcars-gray)'
          },
          // Time window
          min: style.time_window ? Date.now() - this._parseTimeWindow(style.time_window) : undefined,
          max: Date.now()
        },

        // Y-Axis (values)
        yaxis: {
          show: style.show_axis !== false,
          min: style.min_value,
          max: style.max_value,
          labels: {
            show: style.show_labels !== false,
            style: {
              colors: style.label_color || 'var(--lcars-white)',
              fontSize: style.label_font_size || '10px',
              fontFamily: style.label_font_family || 'var(--lcars-font-family, Antonio)'
            },
            formatter: style.value_format ?
              (val) => this._formatValue(val, style.value_format) : undefined
          },
          axisBorder: {
            show: style.show_axis !== false,
            color: style.axis_color || 'var(--lcars-gray)'
          },
          axisTicks: {
            show: style.show_axis !== false,
            color: style.axis_color || 'var(--lcars-gray)'
          }
        },

        // Tooltip
        tooltip: {
          enabled: style.show_tooltip !== false,
          theme: 'dark',
          x: {
            format: style.tooltip_time_format || 'HH:mm:ss'
          },
          y: {
            formatter: style.value_format ?
              (val) => this._formatValue(val, style.value_format) : undefined
          },
          style: {
            fontSize: '12px',
            fontFamily: 'var(--lcars-font-family, Antonio)'
          }
        },

        // Annotations (thresholds)
        annotations: this._buildAnnotations(style),

        // Theme
        theme: {
          mode: 'dark',
          palette: 'palette1',
          monochrome: {
            enabled: false
          }
        },

        // Legend
        legend: {
          show: style.show_legend || false,
          position: style.legend_position || 'top',
          horizontalAlign: 'left',
          fontSize: style.legend_font_size || '12px',
          fontFamily: 'var(--lcars-font-family, Antonio)',
          labels: {
            colors: style.legend_color || 'var(--lcars-white)'
          },
          // ADDED: Ensure legend stays within chart bounds
          floating: false,
          offsetX: 0,
          offsetY: 0
        }
      };

      // ADDED: Support for direct ApexCharts options via chart_options
      // This allows users to override or extend any ApexCharts option
      if (style.chart_options && typeof style.chart_options === 'object') {
        cblcarsLog.debug('[ApexChartsAdapter] Applying direct chart_options override/extension');

        // Deep merge chart_options into baseOptions
        const mergedOptions = this._deepMerge(baseOptions, style.chart_options);

        return mergedOptions;
      }

      return baseOptions;

    } catch (error) {
      cblcarsLog.error(`[ApexChartsAdapter] Error generating options:`, error);
      // Return minimal valid options as fallback
      return {
        chart: {
          type: 'line',
          height: 150,
          width: 300,
          background: 'transparent'
        },
        series: []
      };
    }
  }

  /**
   * Deep merge two objects (for chart_options override)
   * @private
   * @param {Object} target - Target object
   * @param {Object} source - Source object to merge
   * @returns {Object} Merged object
   */
  static _deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          // Recursively merge nested objects
          result[key] = this._deepMerge(target[key] || {}, source[key]);
        } else {
          // Direct assignment for primitives and arrays
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Resolve DataSource path with dot notation support
   * @private
   * @param {string} sourceRef - DataSource reference string
   * @param {Object} dataSourceManager - MSD DataSourceManager instance
   * @returns {Object} {dataSource, dataPath}
   */
  static _resolveDataSourcePath(sourceRef, dataSourceManager) {
    if (!sourceRef || typeof sourceRef !== 'string') {
      return { dataSource: null, dataPath: null };
    }

    // Check for dot notation (e.g., "temp.transformations.celsius")
    if (sourceRef.includes('.')) {
      const parts = sourceRef.split('.');
      const sourceId = parts[0];
      const dataPath = parts.slice(1).join('.');

      const dataSource = dataSourceManager.getSource(sourceId);
      return { dataSource, dataPath };
    }

    // Simple source reference
    const dataSource = dataSourceManager.getSource(sourceRef);
    return { dataSource, dataPath: null };
  }

  /**
   * Get raw DataSource buffer data
   * @private
   * @param {Object} dataSource - MsdDataSource instance
   * @param {Object} config - Configuration options
   * @returns {Array<Object>} Array of {timestamp, value} objects
   */
  static _getRawData(dataSource, config) {
    const currentData = dataSource.getCurrentData();
    if (!currentData?.buffer) return [];

    const bufferData = currentData.buffer.getAll();
    if (!Array.isArray(bufferData) || bufferData.length === 0) return [];

    // Apply time window filter if specified
    let filteredData = bufferData;
    if (config.time_window) {
      const timeWindowMs = this._parseTimeWindow(config.time_window);
      const cutoffTime = Date.now() - timeWindowMs;
      filteredData = bufferData.filter(point => point.t >= cutoffTime);
    }

    // Apply max points limit if specified
    if (config.max_points && filteredData.length > config.max_points) {
      const step = Math.floor(filteredData.length / config.max_points);
      const decimated = [];
      for (let i = 0; i < filteredData.length; i += step) {
        decimated.push(filteredData[i]);
      }
      // Always include last point
      if (decimated[decimated.length - 1] !== filteredData[filteredData.length - 1]) {
        decimated.push(filteredData[filteredData.length - 1]);
      }
      filteredData = decimated;
    }

    return filteredData.map(point => ({
      timestamp: point.t,
      value: point.v
    }));
  }

  /**
   * Get enhanced DataSource data (transformation/aggregation)
   * @private
   * @param {Object} dataSource - MsdDataSource instance
   * @param {string} dataPath - Dot notation path (e.g., "transformations.celsius")
   * @param {Object} config - Configuration options
   * @returns {Array<Object>} Array of {timestamp, value} objects
   */
  static _getEnhancedData(dataSource, dataPath, config) {
    // For transformations, get transformed history buffer
    if (dataPath.startsWith('transformations.')) {
      const transformKey = dataPath.replace('transformations.', '');

      try {
        const history = dataSource.getTransformedHistory(transformKey, config.max_points || 500);

        if (!history || history.length === 0) {
          cblcarsLog.warn(`[ApexChartsAdapter] No transformed history for ${dataPath}`);
          return [];
        }

        // Apply time window filter if specified
        let filteredHistory = history;
        if (config.time_window) {
          const timeWindowMs = this._parseTimeWindow(config.time_window);
          const cutoffTime = Date.now() - timeWindowMs;
          filteredHistory = history.filter(point => {
            const ts = point.timestamp || point.t;
            return ts >= cutoffTime;
          });
        }

        return filteredHistory.map(point => ({
          timestamp: point.timestamp || point.t,
          value: point.value || point.v
        }));
      } catch (error) {
        cblcarsLog.error(`[ApexChartsAdapter] Error getting transformed history:`, error);
        return [];
      }
    }

    // For aggregations, create synthetic time series from current values
    if (dataPath.startsWith('aggregations.')) {
      // Aggregations are typically single values, not time series
      // We'll create a synthetic "current value" point
      const currentData = dataSource.getCurrentData();
      const aggParts = dataPath.replace('aggregations.', '').split('.');

      let value = currentData.aggregations;
      for (const part of aggParts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          value = null;
          break;
        }
      }

      if (value === null || value === undefined) {
        return [];
      }

      // Return single point (ApexCharts will handle it)
      return [{
        timestamp: Date.now(),
        value: typeof value === 'number' ? value : 0
      }];
    }

    return [];
  }

  /**
   * Map MSD smoothing mode to ApexCharts curve type
   * @private
   * @param {string} smoothingMode - MSD smoothing mode
   * @returns {string} ApexCharts curve type
   */
  static _mapSmoothingMode(smoothingMode) {
    const mapping = {
      'none': 'straight',
      'linear': 'straight',
      'constrained': 'smooth',
      'bezier': 'smooth',
      'spline': 'smooth',
      'chaikin': 'smooth',
      'stepped': 'stepline'
    };

    return mapping[smoothingMode] || 'straight';
  }

  /**
   * Map MSD gradient config to ApexCharts gradient format
   * @private
   * @param {Object} gradient - MSD gradient configuration
   * @returns {Object} ApexCharts gradient object
   */
  static _mapGradient(gradient) {
    if (!gradient) return undefined;

    return {
      shade: 'dark',
      type: gradient.type === 'radial' ? 'vertical' : 'vertical',
      shadeIntensity: 0.5,
      gradientToColors: gradient.stops ?
        gradient.stops.map(stop => stop.color) :
        undefined,
      inverseColors: false,
      opacityFrom: gradient.stops?.[0]?.opacity || 0.8,
      opacityTo: gradient.stops?.[gradient.stops.length - 1]?.opacity || 0.1,
      stops: gradient.stops ?
        gradient.stops.map(stop => parseInt(stop.offset)) :
        [0, 100]
    };
  }

  /**
   * Build annotations (threshold lines) from style config
   * @private
   * @param {Object} style - MSD style configuration
   * @returns {Object} ApexCharts annotations object
   */
  static _buildAnnotations(style) {
    const annotations = {
      yaxis: [],
      xaxis: [],
      points: []
    };

    // Zero line
    if (style.zero_line) {
      annotations.yaxis.push({
        y: 0,
        borderColor: style.zero_line_color || 'var(--lcars-gray)',
        strokeDashArray: 2,
        opacity: 0.5,
        label: {
          text: 'Zero',
          style: {
            color: '#fff',
            background: style.zero_line_color || 'var(--lcars-gray)'
          }
        }
      });
    }

    // Threshold lines
    if (style.thresholds && Array.isArray(style.thresholds)) {
      style.thresholds.forEach(threshold => {
        annotations.yaxis.push({
          y: threshold.value,
          borderColor: threshold.color || 'var(--lcars-red)',
          strokeDashArray: threshold.dash ? 4 : 0,
          opacity: threshold.opacity || 0.7,
          borderWidth: threshold.width || 2,
          label: threshold.label ? {
            text: threshold.label,
            style: {
              color: '#fff',
              background: threshold.color || 'var(--lcars-red)',
              fontSize: '10px',
              fontFamily: 'var(--lcars-font-family, Antonio)'
            },
            position: 'right',
            offsetX: 0,
            offsetY: -5
          } : undefined
        });
      });
    }

    return annotations;
  }

  /**
   * Parse time window string to milliseconds
   * @private
   * @param {string|number} timeWindow - Time window specification
   * @returns {number} Time window in milliseconds
   */
  static _parseTimeWindow(timeWindow) {
    if (typeof timeWindow === 'number') return timeWindow;
    if (!timeWindow || typeof timeWindow !== 'string') return 0;

    const match = timeWindow.match(/^(\d+(?:\.\d+)?)\s*([smhd])$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * (multipliers[match[2].toLowerCase()] || 0);
  }

  /**
   * Format value for display
   * @private
   * @param {number} value - Numeric value
   * @param {string|Function} format - Format specification
   * @returns {string} Formatted value
   */
  static _formatValue(value, format) {
    if (typeof format === 'function') {
      return format(value);
    }

    if (typeof format === 'string') {
      // Simple template replacement
      return format.replace('{value}', value.toFixed(1));
    }

    return value.toFixed(1);
  }

  /**
   * Extract series name from source reference
   * @private
   * @param {string} sourceRef - DataSource reference
   * @returns {string} Human-readable series name
   */
  static _extractSeriesName(sourceRef) {
    if (!sourceRef) return 'Series';

    // For dot notation, use the last part as name
    if (sourceRef.includes('.')) {
      const parts = sourceRef.split('.');
      return parts[parts.length - 1]
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    }

    return sourceRef
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}