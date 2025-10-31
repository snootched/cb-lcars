# ApexCharts Integration Strategy - DataSource Architecture Analysis

Based on your feedback, let me provide a deeper analysis of the DataSource adapter layer and architecture options.

---

## 1. DataSource Architecture Decision

### Option A: Keep Current DataSource, Add Thin Adapter (RECOMMENDED)

**Architecture:**
```
MsdDataSource (unchanged)
    ↓ (your existing enhanced data)
ApexChartsAdapter (thin translation layer)
    ↓ (ApexCharts-compatible format)
ApexChartsOverlayRenderer
    ↓ (render chart)
SVG Container
```

**Pros:**
- ✅ **Zero breaking changes** to existing DataSource infrastructure
- ✅ **Chained transformations** remain fully functional
- ✅ **Aggregations** continue working as-is
- ✅ **Dot notation** access preserved (`source.transformations.celsius`)
- ✅ **Rules engine** integration unchanged
- ✅ **Future-proof**: Other overlay types can use native DataSource
- ✅ **Separation of concerns**: DataSource is data management, adapter is format translation

**Cons:**
- ⚠️ Small translation overhead (negligible performance impact)
- ⚠️ One extra layer to understand (but well-isolated)

---

### Option B: Modify DataSource for ApexCharts Native Format

**Architecture:**
```
MsdDataSource (modified to output ApexCharts format)
    ↓ (ApexCharts-compatible data)
ApexChartsOverlayRenderer
    ↓ (render chart)
SVG Container
```

**Pros:**
- ✅ Direct data flow, no adapter needed
- ✅ Potentially cleaner for ApexCharts-only usage

**Cons:**
- ❌ **Breaks existing overlay types** (Sparkline, HistoryBar would need updates)
- ❌ **Couples DataSource to ApexCharts** (tight coupling = bad architecture)
- ❌ **Limits flexibility** for future charting libraries
- ❌ **Complicates DataSource code** (it becomes format-aware)
- ❌ **Chained transformations** harder to implement generically
- ❌ **Rules engine** would need ApexCharts-specific logic

---

## 2. ApexCharts Data Format Requirements

### 2.1 What ApexCharts Expects

ApexCharts has **flexible data input formats**:

#### Format 1: Simple Array (for category charts)
```javascript
series: [{
  name: 'Temperature',
  data: [30, 40, 35, 50, 49, 60, 70]
}]
```

#### Format 2: Timestamp + Value (for time-series)
```javascript
series: [{
  name: 'Temperature',
  data: [
    { x: 1634567890000, y: 30 },
    { x: 1634567900000, y: 40 },
    { x: 1634567910000, y: 35 }
  ]
}]
```

#### Format 3: Multi-dimensional (for advanced charts)
```javascript
series: [{
  name: 'Temperature',
  data: [
    { x: new Date('2023-01-01'), y: 30, z: 10 },
    { x: new Date('2023-01-02'), y: 40, z: 20 }
  ]
}]
```

### 2.2 Your Current DataSource Format

```javascript
// RollingBuffer.getAll() returns:
[
  { t: 1634567890000, v: 30 },
  { t: 1634567900000, v: 40 },
  { t: 1634567910000, v: 35 }
]

// DataSource.getCurrentData() returns:
{
  t: 1634567910000,
  v: 35,
  buffer: RollingBuffer,
  transformations: {
    celsius: 25.5,
    smoothed: 24.8
  },
  aggregations: {
    avg_5m: 26.1,
    trend: { direction: 'increasing', strength: 0.5 }
  },
  stats: { ... },
  entity: 'sensor.temperature'
}
```

**Analysis**: Your format is **almost identical** to ApexCharts Format 2. The adapter just needs to rename `t` → `x` and `v` → `y`.

---

## 3. Recommended Adapter Layer Design

### 3.1 Thin Adapter Implementation

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
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ApexChartsAdapter {
  /**
   * Convert MSD DataSource to ApexCharts series format
   * @param {string} sourceRef - DataSource reference (supports dot notation)
   * @param {Object} dataSourceManager - MSD DataSourceManager instance
   * @param {Object} config - Overlay configuration
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
   * @param {Array<string>} sourceRefs - Array of DataSource references
   * @param {Object} dataSourceManager - MSD DataSourceManager instance
   * @param {Object} config - Overlay configuration
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
   * @param {Array} size - [width, height] dimensions
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
            show: style.grid_vertical || true
          }
        },
        yaxis: {
          lines: {
            show: style.grid_horizontal || true
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

        return history.map(point => ({
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

## 4. Overlay Renderer Integration

```javascript
/**
 * [ApexChartsOverlayRenderer] Render ApexCharts in MSD overlay layer
 * 📊 Handles MSD-specific concerns: positioning, DataSource, actions
 */

import { OverlayUtils } from './OverlayUtils.js';
import { ApexChartsAdapter } from '../charts/ApexChartsAdapter.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ApexChartsOverlayRenderer {
  constructor() {
    this.charts = new Map(); // Track chart instances for cleanup
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
    const instance = new ApexChartsOverlayRenderer();
    return instance.renderApexChart(overlay, anchors, viewBox, svgContainer, cardInstance);
  }

  renderApexChart(overlay, anchors, viewBox, svgContainer, cardInstance) {
    // 1. Resolve position from anchors
    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) {
      cblcarsLog.warn(`[ApexChartsOverlayRenderer] Position could not be resolved: ${overlay.id}`);
      return '';
    }

    const [x, y] = position;
    const size = overlay.size || [300, 150];
    const [width, height] = size;

    try {
      // 2. Get DataSourceManager
      const dataSourceManager = cardInstance?._config?.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager ||
                                window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (!dataSourceManager) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] DataSourceManager not available`);
        return this._renderFallback(overlay, position, size);
      }

      // 3. Convert DataSource to ApexCharts series
      const sourceRef = overlay.source || overlay.data_source;
      const series = ApexChartsAdapter.convertToSeries(sourceRef, dataSourceManager, {
        time_window: overlay.style?.time_window,
        max_points: overlay.style?.max_points || 500,
        name: overlay.style?.name
      });

      if (!series || series.length === 0) {
        cblcarsLog.warn(`[ApexChartsOverlayRenderer] No data for chart ${overlay.id}`);
        return this._renderFallback(overlay, position, size);
      }

      // 4. Generate ApexCharts options
      const style = overlay.finalStyle || overlay.style || {};
      const options = ApexChartsAdapter.generateOptions(style, size, { viewBox });

      // 5. Create HTML container ID
      const chartContainerId = `apex-chart-${overlay.id}`;

      // 6. Schedule chart creation after DOM insertion
      this._scheduleChartCreation(chartContainerId, series, options, overlay, dataSourceManager);

      // 7. Return foreignObject wrapper
      return `<foreignObject x="${x}" y="${y}" width="${width}" height="${height}"
                              data-overlay-id="${overlay.id}"
                              data-overlay-type="apexchart"
                              data-source="${sourceRef || ''}">
                <div xmlns="http://www.w3.org/1999/xhtml"
                     id="${chartContainerId}"
                     style="width: ${width}px; height: ${height}px; background: transparent;">
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
   */
  _scheduleChartCreation(containerId, series, options, overlay, dataSourceManager) {
    // Wait for foreignObject to be inserted into DOM
    setTimeout(() => {
      const container = document.getElementById(containerId);

      if (!container) {
        cblcarsLog.warn(`[ApexChartsOverlayRenderer] Container not found: ${containerId}`);
        return;
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
    }, 100); // Small delay to ensure DOM is ready
  }

  /**
   * Subscribe to DataSource updates for real-time chart updates
   * @private
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
        // Convert new data to series format
        const newSeries = ApexChartsAdapter.convertToSeries(sourceRef, dataSourceManager, {
          time_window: overlay.style?.time_window,
          max_points: overlay.style?.max_points || 500,
          name: overlay.style?.name
        });

        if (newSeries && newSeries.length > 0) {
          // Update chart with animation
          chart.updateSeries(newSeries, true);
        }
      } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Update failed for ${overlay.id}:`, error);
      }
    });

    // Store unsubscribe function for cleanup
    if (!this.subscriptions) this.subscriptions = new Map();
    this.subscriptions.set(overlay.id, unsubscribe);
  }

  /**
   * Cleanup chart instance
   * @param {string} overlayId - Overlay ID to cleanup
   */
  static cleanup(overlayId) {
    const instance = ApexChartsOverlayRenderer._getInstance();

    // Destroy chart
    const chart = instance.charts.get(overlayId);
    if (chart) {
      chart.destroy();
      instance.charts.delete(overlayId);
    }

    // Unsubscribe from DataSource
    const unsubscribe = instance.subscriptions?.get(overlayId);
    if (unsubscribe) {
      unsubscribe();
      instance.subscriptions.delete(overlayId);
    }
  }

  /**
   * Render fallback when chart fails
   * @private
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

  // Singleton pattern for instance tracking
  static _instance = null;
  static _getInstance() {
    if (!ApexChartsOverlayRenderer._instance) {
      ApexChartsOverlayRenderer._instance = new ApexChartsOverlayRenderer();
    }
    return ApexChartsOverlayRenderer._instance;
  }
}
```

---

## 5. Usage Example

### YAML Configuration

````yaml
data_sources:
  temperature_enhanced:
    type: entity
    entity: sensor.outdoor_temperature
    transformations:
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"
    aggregations:
      moving_average:
        window: "5m"
        key: "avg_5m"

overlays:
  # ApexCharts line chart (replaces Sparkline)
  - id: temp_chart
    type: apexchart
    source: temperature_enhanced.transformations.celsius
    position: [50, 100]
    size: [300, 150]
    style:
      chart_type: "line"
      color: "var(--lcars-blue)"
      stroke_width: 3
      smoothing_mode: "smooth"

      # Time window
      time_window: "12h"
      max_points: 500

      # Grid & axis
      show_grid: true
      show_axis: true
      show_labels: true

      # Thresholds
      thresholds:
        - value: 25
          color: "var(--lcars-orange)"
          dash: true
          label: "Warning"
        - value: 35
          color: "var(--lcars-red)"
          width: 2
          label: "Critical"

      # Interactivity
      enable_zoom: true
      enable_pan: true
      show_tooltip: true

  # ApexCharts area chart (replaces HistoryBar)
  - id: power_chart
    type: apexchart
    source: power_meter.transformations.kilowatts
    position: [50, 270]
    size: [300, 100]
    style:
      chart_type: "area"
      color: "var(--lcars-yellow)"
      fill_opacity: 0.3
      stroke_width: 2

      time_window: "24h"
      show_grid: true
      zero_line: true
````

---

## 6. Architecture Summary

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      MSD Overlay Layer                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│            ApexChartsOverlayRenderer                         │
│  • Position resolution                                       │
│  • Size management                                           │
│  • Lifecycle coordination                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              ApexChartsAdapter (THIN LAYER)                  │
│  • Format conversion: {t, v} → {x, y}                       │
│  • Dot notation parsing                                      │
│  • Style → Options mapping                                   │
│  • Multi-series aggregation                                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│          MsdDataSource (UNCHANGED)                           │
│  • Buffer management                                         │
│  • Transformations (chainable!)                             │
│  • Aggregations                                              │
│  • Real-time subscriptions                                   │
│  • Rules engine integration                                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│             Home Assistant Entity                            │
└─────────────────────────────────────────────────────────────┘
```

### Key Benefits of This Architecture

1. ✅ **Zero Breaking Changes** - Existing DataSource code untouched
2. ✅ **Chained Transformations** - Fully preserved and functional
3. ✅ **Thin Adapter** - ~300 lines of translation code
4. ✅ **Separation of Concerns** - Each layer has clear responsibility
5. ✅ **Future-Proof** - Can swap charting libraries without touching DataSource
6. ✅ **Testable** - Adapter can be unit tested independently

---

## 7. Recommendation

**STRONGLY RECOMMEND: Option A - Keep Current DataSource + Thin Adapter**

**Why:**
1. Your DataSource architecture is **excellent** - well-designed, tested, documented
2. Chained transformations are **powerful** - don't sacrifice this capability
3. The adapter layer is **minimal** (~300 lines) and **well-isolated**
4. Future flexibility to use other charting libraries or custom overlays
5. No breaking changes = happy users, smooth migration

**Migration Path:**
1. **Week 1**: Implement `ApexChartsAdapter` (format conversion only)
2. **Week 2**: Implement `ApexChartsOverlayRenderer` (chart creation)
3. **Week 3**: Test with existing DataSources, verify real-time updates
4. **Week 4**: Documentation and examples
5. **Week 5+**: Deprecate Sparkline/HistoryBar, provide migration guide

---

## Next Steps

Would you like me to:
1. **Create the full `ApexChartsAdapter.js` file** (ready to paste)?
2. **Create the full `ApexChartsOverlayRenderer.js` file** (ready to paste)?
3. **Provide integration instructions** for your existing `OverlayManager`?
4. **Create example YAML configurations** showing migration from Sparkline/HistoryBar to ApexCharts?

Let me know which you'd like first, and I'll provide production-ready code!