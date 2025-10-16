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

    // ADDED: Log positioning for debugging
    cblcarsLog.debug(`[ApexChartsOverlayRenderer] Chart positioning for ${overlay.id}:`, {
      resolvedPosition: position,
      configuredPosition: overlay.position,
      size: size,
      x, y, width, height
    });

    try {
      // 2. MSD RESPONSIBILITY: Get DataSourceManager
      const dataSourceManager = cardInstance?._config?.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager ||
                                window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (!dataSourceManager) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] DataSourceManager not available`);
        return this._renderFallback(overlay, position, size);
      }

      // 3. MSD RESPONSIBILITY: Convert DataSource to ApexCharts series
      // ENHANCED: Support both single source and array of sources
      const sourceRef = overlay.source || overlay.data_source || overlay.sources;
      const style = overlay.finalStyle || overlay.style || {};

      // ADDED: Detect multi-series configuration
      const isMultiSeries = Array.isArray(sourceRef);

      let series;
      if (isMultiSeries) {
        // Multi-series: Use convertToMultiSeries
        cblcarsLog.debug(`[ApexChartsOverlayRenderer] Multi-series chart with ${sourceRef.length} sources`);

        series = ApexChartsAdapter.convertToMultiSeries(sourceRef, dataSourceManager, {
          time_window: style.time_window,
          max_points: style.max_points || 500,
          seriesNames: style.series_names || style.seriesNames // Custom names for each series
        });
      } else {
        // Single series: Use existing method
        series = ApexChartsAdapter.convertToSeries(sourceRef, dataSourceManager, {
          time_window: style.time_window,
          max_points: style.max_points || 500,
          name: style.name
        });
      }

      if (!series || series.length === 0) {
        cblcarsLog.warn(`[ApexChartsOverlayRenderer] No data for chart ${overlay.id}`);
        return this._renderFallback(overlay, position, size);
      }

      cblcarsLog.debug(`[ApexChartsOverlayRenderer] Generated ${series.length} series for ${overlay.id}`);

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

      // 7. Return foreignObject wrapper with PROPER positioning
      // CRITICAL: The foreignObject must be positioned in viewBox coordinates
      return `<foreignObject x="${x}" y="${y}" width="${width}" height="${height}"
                              data-overlay-id="${overlay.id}"
                              data-overlay-type="apexchart"
                              data-source="${sourceRef || ''}"
                              style="overflow: visible;">
                <div xmlns="http://www.w3.org/1999/xhtml"
                     id="${chartContainerId}"
                     style="width: 100%; height: 100%; position: relative; overflow: visible;">
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
   */
  _scheduleChartCreation(containerId, series, options, overlay, dataSourceManager, svgContainer) {
    const startTime = performance.now();
    const maxRetries = 20;
    let retries = 0;

    const attemptCreation = () => {
      let container = null;

      cblcarsLog.debug(`[ApexChartsOverlayRenderer] Attempt ${retries + 1}: Searching for container:`, {
        containerId,
        overlayId: overlay.id,
        hasSvgContainer: !!svgContainer,
        svgContainerType: svgContainer?.tagName
      });

      // Strategy 1: Search in provided svgContainer
      if (svgContainer) {
        // Get the SVG element
        const svg = svgContainer.tagName === 'svg' ?
          svgContainer :
          svgContainer.querySelector('svg');

        if (svg) {
          cblcarsLog.debug(`[ApexChartsOverlayRenderer] Found SVG in container`);

          // Find the foreignObject we created
          const foreignObject = svg.querySelector(`foreignObject[data-overlay-id="${overlay.id}"]`);

          if (foreignObject) {
            cblcarsLog.debug(`[ApexChartsOverlayRenderer] Found foreignObject for ${overlay.id}`);

            // Search for our container div inside the foreignObject
            container = foreignObject.querySelector(`#${containerId}`);

            if (container) {
              cblcarsLog.debug(`[ApexChartsOverlayRenderer] ✅ Found container in foreignObject`);
            } else {
              cblcarsLog.debug(`[ApexChartsOverlayRenderer] foreignObject found but div not present yet`);
            }
          } else {
            cblcarsLog.debug(`[ApexChartsOverlayRenderer] foreignObject not found yet`);
          }
        } else {
          cblcarsLog.debug(`[ApexChartsOverlayRenderer] No SVG found in container`);
        }
      }

      // Strategy 2: Try renderer's mount element (from systemsManager)
      if (!container) {
        const systemsManager = window.__msdDebug?.pipelineInstance?.systemsManager;
        const mountEl = systemsManager?.renderer?.mountEl;

        if (mountEl) {
          cblcarsLog.debug(`[ApexChartsOverlayRenderer] Trying mountEl from systemsManager`);
          const svg = mountEl.querySelector('svg');

          if (svg) {
            const foreignObject = svg.querySelector(`foreignObject[data-overlay-id="${overlay.id}"]`);
            if (foreignObject) {
              container = foreignObject.querySelector(`#${containerId}`);

              if (container) {
                cblcarsLog.debug(`[ApexChartsOverlayRenderer] ✅ Found container via systemsManager.mountEl`);
              }
            }
          }
        }
      }

      // Strategy 3: Global document search as last resort
      if (!container && typeof document !== 'undefined') {
        cblcarsLog.debug(`[ApexChartsOverlayRenderer] Falling back to document.querySelector`);
        container = document.querySelector(`#${containerId}`);

        if (container) {
          cblcarsLog.debug(`[ApexChartsOverlayRenderer] ⚠️ Found container via document (not ideal)`);
        }
      }

      if (!container) {
        retries++;
        if (retries < maxRetries) {
          setTimeout(attemptCreation, 50);
          return;
        } else {
          cblcarsLog.error(`[ApexChartsOverlayRenderer] Container not found after ${maxRetries} retries`, {
            containerId,
            overlayId: overlay.id,
            svgContainerProvided: !!svgContainer,
            svgContainerType: svgContainer?.tagName,
            hasMountEl: !!window.__msdDebug?.pipelineInstance?.systemsManager?.renderer?.mountEl,
            foreignObjectExists: !!svgContainer?.querySelector?.(`foreignObject[data-overlay-id="${overlay.id}"]`)
          });
          return;
        }
      }

      try {
        // Create ApexCharts instance
        const chartCreateStart = performance.now();

        const chart = new ApexCharts(container, {
          ...options,
          series
        });

        chart.render().then(() => {
          const totalTime = performance.now() - startTime;
          const renderTime = performance.now() - chartCreateStart;

          cblcarsLog.debug(`[ApexChartsOverlayRenderer] ⚡ Chart created: ${overlay.id}`, {
            totalTime: `${totalTime.toFixed(2)}ms`,
            renderTime: `${renderTime.toFixed(2)}ms`,
            retries,
            dataPoints: series[0]?.data?.length || 0,
            containerLocation: 'shadow DOM foreignObject'
          });

          // Store chart instance for updates/cleanup
          this.charts.set(overlay.id, chart);

          // Subscribe to DataSource updates
          const sourceRef = overlay.source || overlay.data_source;
          this._subscribeToDataSource(sourceRef, dataSourceManager, chart, overlay);
        });

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
    // ENHANCED: Handle both single and multiple sources
    const sources = Array.isArray(sourceRef) ? sourceRef : [sourceRef];
    const unsubscribers = [];

    sources.forEach((source, index) => {
      if (!source) return;

      // Parse source reference
      const { dataSource } = ApexChartsAdapter._resolveDataSourcePath(source, dataSourceManager);

      if (!dataSource) {
        cblcarsLog.warn(`[ApexChartsOverlayRenderer] DataSource not found: ${source}`);
        return;
      }

      // Subscribe to updates
      const unsubscribe = dataSource.subscribe((newData) => {
        try {
          const style = overlay.finalStyle || overlay.style || {};

          // Convert ALL sources to series format (not just the one that changed)
          const newSeries = Array.isArray(sourceRef) ?
            ApexChartsAdapter.convertToMultiSeries(sourceRef, dataSourceManager, {
              time_window: style.time_window,
              max_points: style.max_points || 500,
              seriesNames: style.series_names || style.seriesNames
            }) :
            ApexChartsAdapter.convertToSeries(sourceRef, dataSourceManager, {
              time_window: style.time_window,
              max_points: style.max_points || 500,
              name: style.name
            });

          if (newSeries && newSeries.length > 0) {
            // Update chart with animation
            chart.updateSeries(newSeries, true);

            cblcarsLog.debug(`[ApexChartsOverlayRenderer] Chart updated: ${overlay.id} (${newSeries.length} series)`);
          }
        } catch (error) {
          cblcarsLog.error(`[ApexChartsOverlayRenderer] Update failed for ${overlay.id}:`, error);
        }
      });

      unsubscribers.push(unsubscribe);
    });

    // Store ALL unsubscribe functions
    this.subscriptions.set(overlay.id, () => {
      unsubscribers.forEach(unsub => unsub());
    });
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
   * Validate overlay configuration before rendering
   * @static
   * @param {Object} overlay - Overlay configuration
   * @returns {Array<string>} Array of validation errors (empty if valid)
   */
  static validateConfig(overlay) {
    const errors = [];

    if (!overlay.source && !overlay.data_source) {
      errors.push('Missing required field: source or data_source');
    }

    if (!overlay.size || !Array.isArray(overlay.size) || overlay.size.length !== 2) {
      errors.push('Invalid size: must be [width, height]');
    }

    if (!overlay.position || !Array.isArray(overlay.position) || overlay.position.length !== 2) {
      errors.push('Invalid position: must be [x, y]');
    }

    const style = overlay.finalStyle || overlay.style || {};
    if (style.chart_type) {
      const validTypes = ['line', 'area', 'bar', 'scatter', 'candlestick', 'heatmap', 'radar'];
      if (!validTypes.includes(style.chart_type)) {
        errors.push(`Invalid chart_type: ${style.chart_type}. Valid types: ${validTypes.join(', ')}`);
      }
    }

    return errors;
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