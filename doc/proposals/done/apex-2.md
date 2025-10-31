---

# ApexCharts Integration - Complete Code Files

## File 1: `src/msd/charts/ApexChartsAdapter.js`

```javascript
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
    // Parse dot notation (e.g., "temp.transformations.celsius")
    const { dataSource, dataPath } = this._resolveDataSourcePath(sourceRef, dataSourceManager);

    if (!dataSource) {
      cblcarsLog.warn(`[ApexChartsAdapter] DataSource not found: ${sourceRef}`);
      return [];
    }

    // Get historical data
    let data;
    if (dataPath) {
      // Enhanced DataSource path (transformation/aggregation)
      data = this._getEnhancedData(dataSource, dataPath, config);
    } else {
      // Raw DataSource buffer
      data = this._getRawData(dataSource, config);
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
        x: point.timestamp || point.t,  // ApexCharts uses 'x' for time
        y: point.value || point.v        // ApexCharts uses 'y' for value
      }))
    }];
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
    const [width, height] = size;
    const chartType = style.chart_type || style.type || 'line';

    return {
      chart: {
        type: chartType,
        height: height,
        width: width,
        background: 'transparent',
        foreColor: style.color || 'var(--lcars-orange)',

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
        }
      }
    };
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
```

---

## File 2: `src/msd/renderer/ApexChartsOverlayRenderer.js`

```javascript
/**
 * [ApexChartsOverlayRenderer] Render ApexCharts in MSD overlay layer
 * 📊 Handles MSD-specific concerns: positioning, DataSource, actions, lifecycle
 *
 * Responsibilities:
 * - Position resolution from anchors
 * - DataSource integration and real-time subscriptions
 * - Chart lifecycle management (creation, updates, cleanup)
 * - foreignObject wrapper for HTML/SVG integration
 *
 * @module ApexChartsOverlayRenderer
 * @requires ApexChartsAdapter
 * @requires OverlayUtils
 * @requires cblcars-logging
 */

import { OverlayUtils } from './OverlayUtils.js';
import { ApexChartsAdapter } from '../charts/ApexChartsAdapter.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

// Import ApexCharts library
// NOTE: Ensure ApexCharts is installed via npm: npm install apexcharts
import ApexCharts from 'apexcharts';

export class ApexChartsOverlayRenderer {
  constructor() {
    this.charts = new Map(); // Track chart instances for cleanup
    this.subscriptions = new Map(); // Track DataSource subscriptions
  }

  /**
   * Render ApexCharts overlay
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Element} svgContainer - Container element
   * @param {Object} cardInstance - Reference to custom-button-card instance
   * @returns {string} Complete SVG markup (foreignObject wrapper)
   */
  static render(overlay, anchors, viewBox, svgContainer, cardInstance) {
    const instance = ApexChartsOverlayRenderer._getInstance();
    return instance.renderApexChart(overlay, anchors, viewBox, svgContainer, cardInstance);
  }

  /**
   * Instance method for comprehensive ApexCharts rendering with MSD integration
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Element} svgContainer - Container element
   * @param {Object} cardInstance - Reference to custom-button-card instance
   * @returns {string} Complete SVG markup
   */
  renderApexChart(overlay, anchors, viewBox, svgContainer, cardInstance) {
    // 1. MSD RESPONSIBILITY: Resolve position from anchors
    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) {
      cblcarsLog.warn(`[ApexChartsOverlayRenderer] Position could not be resolved: ${overlay.id}`);
      return '';
    }

    const [x, y] = position;
    const size = overlay.size || [300, 150];
    const [width, height] = size;

    try {
      // 2. MSD RESPONSIBILITY: Get DataSourceManager
      const dataSourceManager = cardInstance?._config?.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager ||
                                window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (!dataSourceManager) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] DataSourceManager not available`);
        return this._renderFallback(overlay, position, size);
      }

      // 3. MSD RESPONSIBILITY: Convert DataSource to ApexCharts series
      const sourceRef = overlay.source || overlay.data_source;
      const style = overlay.finalStyle || overlay.style || {};

      const series = ApexChartsAdapter.convertToSeries(sourceRef, dataSourceManager, {
        time_window: style.time_window,
        max_points: style.max_points || 500,
        name: style.name
      });

      if (!series || series.length === 0) {
        cblcarsLog.warn(`[ApexChartsOverlayRenderer] No data for chart ${overlay.id}`);
        return this._renderFallback(overlay, position, size);
      }

      // 4. MSD RESPONSIBILITY: Generate ApexCharts options
      const options = ApexChartsAdapter.generateOptions(style, size, { viewBox });

      // 5. Create HTML container ID
      const chartContainerId = `apex-chart-${overlay.id}`;

      // 6. Schedule chart creation after DOM insertion
      this._scheduleChartCreation(
        chartContainerId,
        series,
        options,
        overlay,
        dataSourceManager,
        svgContainer
      );

      // 7. Return foreignObject wrapper
      return `<foreignObject x="${x}" y="${y}" width="${width}" height="${height}"
                              data-overlay-id="${overlay.id}"
                              data-overlay-type="apexchart"
                              data-source="${sourceRef || ''}">
                <div xmlns="http://www.w3.org/1999/xhtml"
                     id="${chartContainerId}"
                     style="width: ${width}px; height: ${height}px; background: transparent;">
                  <!-- ApexCharts will render here -->
                </div>
              </foreignObject>`;

    } catch (error) {
      cblcarsLog.error(`[ApexChartsOverlayRenderer] Rendering failed for ${overlay.id}:`, error);
      return this._renderFallback(overlay, position, size);
    }
  }

  /**
   * Schedule chart creation after DOM is ready
   * @private
   * @param {string} containerId - HTML container ID
   * @param {Array} series - ApexCharts series data
   * @param {Object} options - ApexCharts options
   * @param {Object} overlay - Overlay configuration
   * @param {Object} dataSourceManager - MSD DataSourceManager instance
   * @param {Element} svgContainer - SVG container element
   */
  _scheduleChartCreation(containerId, series, options, overlay, dataSourceManager, svgContainer) {
    // Wait for foreignObject to be inserted into DOM
    // We use a short delay and also check for element availability
    const maxRetries = 20;
    let retries = 0;

    const attemptCreation = () => {
      // Try to find container in shadowRoot or document
      let container = null;

      if (svgContainer) {
        // Search within shadow root
        const root = svgContainer.getRootNode();
        container = root.getElementById ? root.getElementById(containerId) : null;
      }

      if (!container) {
        // Fallback to document search
        container = document.getElementById(containerId);
      }

      if (!container) {
        retries++;
        if (retries < maxRetries) {
          setTimeout(attemptCreation, 50);
          return;
        } else {
          cblcarsLog.warn(`[ApexChartsOverlayRenderer] Container not found after ${maxRetries} retries: ${containerId}`);
          return;
        }
      }

      try {
        // Create ApexCharts instance
        const chart = new ApexCharts(container, {
          ...options,
          series
        });

        chart.render();

        // Store chart instance for updates/cleanup
        this.charts.set(overlay.id, chart);

        // Subscribe to DataSource updates
        const sourceRef = overlay.source || overlay.data_source;
        this._subscribeToDataSource(sourceRef, dataSourceManager, chart, overlay);

        cblcarsLog.debug(`[ApexChartsOverlayRenderer] Chart created: ${overlay.id}`);

      } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Chart creation failed: ${overlay.id}`, error);
      }
    };

    // Start attempting to create chart
    setTimeout(attemptCreation, 100);
  }

  /**
   * Subscribe to DataSource updates for real-time chart updates
   * @private
   * @param {string} sourceRef - DataSource reference
   * @param {Object} dataSourceManager - MSD DataSourceManager instance
   * @param {Object} chart - ApexCharts instance
   * @param {Object} overlay - Overlay configuration
   */
  _subscribeToDataSource(sourceRef, dataSourceManager, chart, overlay) {
    if (!sourceRef) return;

    // Parse source reference
    const { dataSource } = ApexChartsAdapter._resolveDataSourcePath(sourceRef, dataSourceManager);

    if (!dataSource) {
      cblcarsLog.warn(`[ApexChartsOverlayRenderer] DataSource not found: ${sourceRef}`);
      return;
    }

    // Subscribe to updates
    const unsubscribe = dataSource.subscribe((newData) => {
      try {
        const style = overlay.finalStyle || overlay.style || {};

        // Convert new data to series format
        const newSeries = ApexChartsAdapter.convertToSeries(sourceRef, dataSourceManager, {
          time_window: style.time_window,
          max_points: style.max_points || 500,
          name: style.name
        });

        if (newSeries && newSeries.length > 0) {
          // Update chart with animation
          chart.updateSeries(newSeries, true);

          cblcarsLog.debug(`[ApexChartsOverlayRenderer] Chart updated: ${overlay.id}`);
        }
      } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Update failed for ${overlay.id}:`, error);
      }
    });

    // Store unsubscribe function for cleanup
    this.subscriptions.set(overlay.id, unsubscribe);
  }

  /**
   * Cleanup chart instance and subscriptions
   * @static
   * @param {string} overlayId - Overlay ID to cleanup
   */
  static cleanup(overlayId) {
    const instance = ApexChartsOverlayRenderer._getInstance();

    // Destroy chart
    const chart = instance.charts.get(overlayId);
    if (chart) {
      try {
        chart.destroy();
        instance.charts.delete(overlayId);
        cblcarsLog.debug(`[ApexChartsOverlayRenderer] Chart destroyed: ${overlayId}`);
      } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Error destroying chart ${overlayId}:`, error);
      }
    }

    // Unsubscribe from DataSource
    const unsubscribe = instance.subscriptions.get(overlayId);
    if (unsubscribe) {
      try {
        unsubscribe();
        instance.subscriptions.delete(overlayId);
      } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Error unsubscribing ${overlayId}:`, error);
      }
    }
  }

  /**
   * Cleanup all charts (called when card is removed)
   * @static
   */
  static cleanupAll() {
    const instance = ApexChartsOverlayRenderer._getInstance();

    // Destroy all charts
    instance.charts.forEach((chart, overlayId) => {
      try {
        chart.destroy();
      } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Error destroying chart ${overlayId}:`, error);
      }
    });
    instance.charts.clear();

    // Unsubscribe all
    instance.subscriptions.forEach((unsubscribe, overlayId) => {
      try {
        unsubscribe();
      } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Error unsubscribing ${overlayId}:`, error);
      }
    });
    instance.subscriptions.clear();
  }

  /**
   * Render fallback when chart fails
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Array} position - [x, y] position
   * @param {Array} size - [width, height] dimensions
   * @returns {string} Fallback SVG markup
   */
  _renderFallback(overlay, position, size) {
    const [x, y] = position;
    const [width, height] = size;
    const color = 'var(--lcars-gray)';

    return `<g data-overlay-id="${overlay.id}"
               data-overlay-type="apexchart"
               data-fallback="true">
              <rect x="${x}" y="${y}" width="${width}" height="${height}"
                    fill="none" stroke="${color}" stroke-width="2" rx="4"/>
              <text x="${x + width / 2}" y="${y + height / 2}"
                    text-anchor="middle" fill="${color}"
                    font-size="12" dominant-baseline="middle">
                Chart Loading...
              </text>
            </g>`;
  }

  /**
   * Compute attachment points for ApexCharts overlay
   * @static
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Element} container - Container element
   * @param {Array} viewBox - SVG viewBox dimensions
   * @returns {Object|null} Attachment points object
   */
  static computeAttachmentPoints(overlay, anchors, container, viewBox = null) {
    if (!overlay || overlay.type !== 'apexchart') return null;

    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) return null;

    const size = overlay.size || [300, 150];
    const [x, y] = position;
    const [width, height] = size;

    return {
      id: overlay.id,
      center: [x + width / 2, y + height / 2],
      bbox: {
        left: x,
        right: x + width,
        top: y,
        bottom: y + height,
        width,
        height,
        centerX: x + width / 2,
        centerY: y + height / 2
      },
      points: {
        center: [x + width / 2, y + height / 2],
        left: [x, y + height / 2],
        right: [x + width, y + height / 2],
        top: [x + width / 2, y],
        bottom: [x + width / 2, y + height],
        topLeft: [x, y],
        topRight: [x + width, y],
        bottomLeft: [x, y + height],
        bottomRight: [x + width, y + height]
      },
      x,
      y
    };
  }

  /**
   * Singleton pattern for instance tracking
   * @private
   * @static
   * @returns {ApexChartsOverlayRenderer} Singleton instance
   */
  static _instance = null;
  static _getInstance() {
    if (!ApexChartsOverlayRenderer._instance) {
      ApexChartsOverlayRenderer._instance = new ApexChartsOverlayRenderer();
    }
    return ApexChartsOverlayRenderer._instance;
  }
}

export default ApexChartsOverlayRenderer;
```

---

## Integration Instructions for Coding Agent

### Step 1: Install ApexCharts Dependency

```bash
npm install apexcharts
```

### Step 2: Create Directory Structure

```bash
mkdir -p src/msd/charts
```

### Step 3: Place Files

1. **Place `ApexChartsAdapter.js`** in `src/msd/charts/ApexChartsAdapter.js`
2. **Place `ApexChartsOverlayRenderer.js`** in `src/msd/renderer/ApexChartsOverlayRenderer.js`

### Step 4: Register Overlay Type in OverlayManager

**File**: `src/msd/renderer/OverlayManager.js`

**Find the overlay type registry** (likely in constructor or as a static property):

```javascript
// BEFORE (existing code)
this.renderers = {
  line: LineOverlayRenderer,
  text: TextOverlayRenderer,
  sparkline: SparklineOverlayRenderer,
  history_bar: HistoryBarOverlayRenderer,
  // ... other overlay types
};
```

**Add ApexCharts renderer**:

```javascript
// AFTER (add apexchart)
import { ApexChartsOverlayRenderer } from './ApexChartsOverlayRenderer.js';

this.renderers = {
  line: LineOverlayRenderer,
  text: TextOverlayRenderer,
  sparkline: SparklineOverlayRenderer,
  history_bar: HistoryBarOverlayRenderer,
  apexchart: ApexChartsOverlayRenderer,  // NEW: ApexCharts overlay
  // ... other overlay types
};
```

### Step 5: Add Cleanup Support in OverlayManager

**File**: `src/msd/renderer/OverlayManager.js`

**Find the cleanup/destroy method**:

```javascript
// Find existing destroy or cleanup method
destroy() {
  // Existing cleanup code...

  // NEW: Add ApexCharts cleanup
  if (ApexChartsOverlayRenderer) {
    ApexChartsOverlayRenderer.cleanupAll();
  }
}
```

### Step 6: Update Exports in Renderer Index

**File**: `src/msd/renderer/index.js` (if it exists)

```javascript
export { ApexChartsOverlayRenderer } from './ApexChartsOverlayRenderer.js';
```

### Step 7: Add Deprecation Warnings for Sparkline/HistoryBar

**File**: `src/msd/renderer/SparklineOverlayRenderer.js`

**Add at the top of the `render` method**:

```javascript
static render(overlay, anchors, viewBox, svgContainer, cardInstance) {
  // NEW: Deprecation warning
  cblcarsLog.warn(`[SparklineOverlayRenderer] ⚠️ DEPRECATED: Sparkline overlay is deprecated. Please use 'apexchart' overlay type with chart_type: 'line'. See documentation for migration guide.`);

  // ... existing code
}
```

**File**: `src/msd/renderer/HistoryBarOverlayRenderer.js`

**Add at the top of the `render` method**:

```javascript
static render(overlay, anchors, viewBox, svgContainer, cardInstance) {
  // NEW: Deprecation warning
  cblcarsLog.warn(`[HistoryBarOverlayRenderer] ⚠️ DEPRECATED: HistoryBar overlay is deprecated. Please use 'apexchart' overlay type with chart_type: 'area' or 'bar'. See documentation for migration guide.`);

  // ... existing code
}
```

### Step 8: Test Configuration

Create a test MSD configuration to verify integration:

```yaml
type: custom:cb-lcars-msd
msd:
  data_sources:
    temperature_sensor:
      type: entity
      entity: sensor.outdoor_temperature
      transformations:
        - type: unit_conversion
          from: "°F"
          to: "°C"
          key: "celsius"

  overlays:
    # NEW: ApexCharts overlay
    - id: temp_apex_chart
      type: apexchart
      source: temperature_sensor.transformations.celsius
      position: [50, 100]
      size: [300, 150]
      style:
        chart_type: "line"
        color: "var(--lcars-blue)"
        stroke_width: 3
        smoothing_mode: "smooth"
        time_window: "12h"
        show_grid: true
        show_axis: true
        thresholds:
          - value: 25
            color: "var(--lcars-orange)"
            label: "Warning"
```

### Step 9: Verification Checklist

✅ ApexCharts npm package installed
✅ `ApexChartsAdapter.js` placed in `src/msd/charts/`
✅ `ApexChartsOverlayRenderer.js` placed in `src/msd/renderer/`
✅ Overlay type registered in `OverlayManager.js`
✅ Cleanup method added to `OverlayManager.js`
✅ Deprecation warnings added to Sparkline/HistoryBar renderers
✅ Test configuration created
✅ No console errors on page load
✅ Chart renders in MSD overlay layer
✅ Real-time updates work when DataSource changes

### Step 10: Documentation Updates (Separate Task)

- Update `/doc/user/` with ApexCharts overlay examples
- Create migration guide for Sparkline → ApexCharts
- Create migration guide for HistoryBar → ApexCharts
- Mark Sparkline/HistoryBar as deprecated in docs

---

## Summary

You now have:

1. ✅ **Complete `ApexChartsAdapter.js`** - Data format conversion layer
2. ✅ **Complete `ApexChartsOverlayRenderer.js`** - MSD overlay renderer
3. ✅ **Integration instructions** - Step-by-step guide for coding agent
4. ✅ **Test configuration** - YAML example to verify functionality
5. ✅ **Verification checklist** - Ensure all steps completed

**Architecture Benefits:**
- ✅ Zero breaking changes to DataSource system
- ✅ Chained transformations fully supported
- ✅ Dot notation access preserved
- ✅ Thin adapter layer (~300 lines)
- ✅ Real-time subscription system intact
- ✅ Clean separation of concerns

**Next Steps:**
1. Provide these files to your coding agent
2. Agent follows integration instructions
3. Test with provided YAML configuration
4. Document usage in `/doc/user/`
5. Deprecate Sparkline/HistoryBar in future release

---

Copilot is powered by AI, so mistakes are possible. Leave a comment via the 👍 👎 to share your feedback and help improve the experience.