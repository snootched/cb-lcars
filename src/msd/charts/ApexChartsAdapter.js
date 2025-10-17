/**
 * [ApexChartsAdapter] Lightweight translator between MSD DataSource and ApexCharts
 * 📊 Handles format conversion without modifying DataSource architecture
 *
 * Responsibilities:
 * - Convert RollingBuffer format to ApexCharts series format
 * - Support dot notation for enhanced DataSource paths
 * - Map MSD style config to ApexCharts options
 * - Handle multi-series aggregation
 * - Provide exact pixel dimensions for HTML overlay rendering
 *
 * Integration:
 * - Works with ApexChartsOverlayRenderer for HTML div overlay approach
 * - Integrates with MSD DataSourceManager for real-time data
 * - Supports time windowing and data decimation
 *
 * @module ApexChartsAdapter
 * @requires cblcars-logging
 */

import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ApexChartsAdapter {
  /**
   * Convert MSD DataSource to ApexCharts series format
   * @param {string} sourceRef - DataSource reference (supports dot notation like "temp.transformations.celsius")
   * @param {Object} dataSourceManager - MSD DataSourceManager instance
   * @param {Object} config - Configuration options
   * @param {string} [config.name] - Series name override
   * @param {string} [config.time_window] - Time window filter (e.g., "12h", "24h")
   * @param {number} [config.max_points=500] - Maximum data points (decimation threshold)
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
   * @param {Object} config - Configuration options
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
   * @param {Array<number>} size - [width, height] dimensions in EXACT PIXELS (not viewBox units)
   * @param {Object} context - Additional context (unused, kept for API consistency)
   * @returns {Object} ApexCharts options object
   */
  static generateOptions(style, size, context = {}) {
    // ✅ ADDED: Create component-scoped token resolver
    const resolveToken = themeTokenResolver ? themeTokenResolver.forComponent('chart') : null;

    // ✅ ENHANCED: Resolve chart colors (can be array or single color)
    let colors = style.colors || style.color;

    // If no colors specified, get from tokens
    if (!colors && resolveToken) {
      colors = resolveToken('defaultColors', null, context);
    }

    // If single color, convert to array
    if (typeof colors === 'string') {
      colors = [colors];
    }

    // Resolve each color in array via token system
    if (Array.isArray(colors)) {
      colors = colors.map(color => {
        if (typeof color === 'string' && this._isTokenReference(color)) {
          return resolveToken ? resolveToken(color, color, context) : color;
        }
        return color;
      });
    }

    // ✅ ENHANCED: Resolve stroke width via tokens
    const strokeWidth = this._resolveTokenValue(
      style.stroke_width,
      'defaultStrokeWidth',
      resolveToken,
      2,
      context
    );

    // ✅ ENHANCED: Resolve grid color via tokens
    const gridColor = this._resolveTokenValue(
      style.grid_color,
      'gridColor',
      resolveToken,
      'var(--lcars-gray, #999999)',
      context
    );

    // ✅ ENHANCED: Resolve axis colors via tokens
    const axisColor = resolveToken ?
      resolveToken('colors.chart.axis', 'var(--lcars-white, #FFFFFF)', context) :
      'var(--lcars-white, #FFFFFF)';

    // ✅ ENHANCED: Resolve legend colors via tokens
    const legendColor = resolveToken ?
      resolveToken('colors.ui.foreground', 'var(--lcars-white, #FFFFFF)', context) :
      'var(--lcars-white, #FFFFFF)';

    // ✅ ENHANCED: Get font family from typography tokens
    const fontFamily = resolveToken ?
      resolveToken('typography.fontFamily.primary', 'Antonio, Helvetica Neue, sans-serif', context) :
      'Antonio, Helvetica Neue, sans-serif';

    // Build base ApexCharts options
    const baseOptions = {
      chart: {
        type: style.chart_type || 'line',
        width: size[0],
        height: size[1],
        animations: {
          enabled: style.animations_enabled !== false,
          speed: 800,
          animateGradually: {
            enabled: true,
            delay: 150
          }
        },
        toolbar: {
          show: style.show_toolbar || false
        },
        background: 'transparent',
        fontFamily: fontFamily
      },

      colors: colors,

      stroke: {
        width: strokeWidth,
        curve: style.curve || 'smooth'
      },

      grid: {
        borderColor: gridColor,
        strokeDashArray: 4,
        opacity: 0.3
      },

      xaxis: {
        labels: {
          style: {
            colors: axisColor,
            fontSize: '10px',
            fontFamily: fontFamily
          }
        }
      },

      yaxis: {
        labels: {
          style: {
            colors: axisColor,
            fontSize: '10px',
            fontFamily: fontFamily
          }
        }
      },

      legend: {
        fontSize: '12px',
        fontFamily: fontFamily,
        labels: {
          colors: legendColor
        }
      },

      tooltip: {
        theme: 'dark',
        style: {
          fontSize: '12px',
          fontFamily: fontFamily
        }
      }
    };

    // Apply chart_options overrides (highest precedence)
    if (style.chart_options) {
      return this._deepMerge(baseOptions, style.chart_options);
    }

    cblcarsLog.debug('[ApexChartsAdapter] Generated options with tokens:', {
      colors: colors?.length || 0,
      strokeWidth,
      gridColor,
      fontFamily
    });

    return baseOptions;
  }

  /**
   * Resolve a token value with fallback
   * @private
   */
  static _resolveTokenValue(styleValue, tokenPath, resolveToken, fallback, context) {
    if (styleValue !== undefined && styleValue !== null) {
      if (resolveToken && typeof styleValue === 'string' && this._isTokenReference(styleValue)) {
        return resolveToken(styleValue, fallback, context);
      }
      return styleValue;
    }

    if (resolveToken) {
      return resolveToken(tokenPath, fallback, context);
    }

    return fallback;
  }

  /**
   * Check if value is a token reference
   * @private
   */
  static _isTokenReference(value) {
    if (typeof value !== 'string') return false;
    const tokenCategories = ['colors', 'typography', 'spacing', 'borders', 'effects', 'animations', 'components'];
    return tokenCategories.some(category => value.startsWith(`${category}.`));
  }

  /**
   * Deep merge objects (for chart_options override)
   * @private
   */
  static _deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
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

    // Apply max points limit if specified (data decimation)
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
   * @param {string|number} timeWindow - Time window specification (e.g., "12h", "24h", "30m")
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