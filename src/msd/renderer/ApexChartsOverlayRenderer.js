/**
 * [ApexChartsOverlayRenderer] Render ApexCharts as positioned HTML overlays on MSD
 * 📊 Uses absolute positioning over the MSD SVG instead of foreignObject
 *
 * Architecture:
 * - Charts render in separate HTML div layer above MSD SVG
 * - Position calculated from MSD viewBox coordinates → screen pixels
 * - Maintains MSD integration (DataSources, attachment points, styling)
 * - Syncs position on viewport changes (resize, pan, zoom)
 * - Handles shadowRoot boundaries and Home Assistant header offset
 *
 * Key Features:
 * - Real-time DataSource subscriptions for live updates
 * - Proper coordinate conversion accounting for SVG viewBox scaling
 * - Viewport synchronization for responsive layouts
 * - Tooltip support with correct positioning
 * - Debug helpers for troubleshooting
 *
 * @module ApexChartsOverlayRenderer
 * @requires ApexChartsAdapter
 * @requires OverlayUtils
 * @requires cblcars-logging
 * @requires ApexCharts
 */

import { OverlayUtils } from './OverlayUtils.js';
import { ApexChartsAdapter } from '../charts/ApexChartsAdapter.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import ApexCharts from 'apexcharts';

export class ApexChartsOverlayRenderer {
  constructor() {
    this.charts = new Map(); // Track chart instances for cleanup
    this.subscriptions = new Map(); // Track DataSource subscriptions
    this.overlayDivs = new Map(); // Track overlay div elements
    this.resizeObserver = null; // Single ResizeObserver for all charts
  }

  /**
   * Render ApexCharts overlay (returns empty SVG markup - actual rendering happens in DOM)
   * This returns a placeholder rect in the SVG for attachment point computation,
   * while the actual chart renders in an HTML div overlay
   * @static
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions [x, y, width, height]
   * @param {Element} svgContainer - SVG container element
   * @param {Object} cardInstance - Reference to custom-button-card instance
   * @returns {string} Empty SVG group markup for attachment point tracking
   */
  static render(overlay, anchors, viewBox, svgContainer, cardInstance) {
    const instance = ApexChartsOverlayRenderer._getInstance();

    // CRITICAL FIX: Check if chart already exists - UPDATE instead of CREATE
    const existingChart = instance.charts.get(overlay.id);
    const existingDiv = instance.overlayDivs.get(overlay.id);

    if (existingChart && existingDiv) {
      cblcarsLog.debug(`[ApexChartsOverlayRenderer] 🔄 Chart ${overlay.id} already exists - updating instead of creating`);

      // Update existing chart with new style/data from rules
      const dataSourceManager = cardInstance?._config?.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager ||
                                window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (dataSourceManager) {
        // Use the static updateChartStyle method
        ApexChartsOverlayRenderer.updateChartStyle(overlay.id, overlay, dataSourceManager);
      }

      // Return the same placeholder (chart div already exists in DOM)
      const position = OverlayUtils.resolvePosition(overlay.position, anchors);
      if (!position) return '';

      const [x, y] = position;
      const size = overlay.size || [300, 150];
      const [width, height] = size;

      return `<g data-overlay-id="${overlay.id}"
                 data-overlay-type="apexchart"
                 data-overlay-layer="html"
                 class="msd-apexchart-placeholder">
                <rect x="${x}" y="${y}"
                      width="${width}" height="${height}"
                      fill="none" stroke="none"
                      pointer-events="none"
                      opacity="0"/>
              </g>`;
    }

    // NEW CHART: Schedule creation
    cblcarsLog.debug(`[ApexChartsOverlayRenderer] 📊 Creating NEW chart for ${overlay.id}`);
    instance._scheduleChartCreation(overlay, anchors, viewBox, svgContainer, cardInstance);

    // Return empty SVG group (just for MSD overlay system to track)
    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) return '';

    const [x, y] = position;
    const size = overlay.size || [300, 150];
    const [width, height] = size;

    // Invisible rect for attachment point computation
    return `<g data-overlay-id="${overlay.id}"
               data-overlay-type="apexchart"
               data-overlay-layer="html"
               class="msd-apexchart-placeholder">
              <rect x="${x}" y="${y}"
                    width="${width}" height="${height}"
                    fill="none" stroke="none"
                    pointer-events="none"
                    opacity="0"/>
            </g>`;
  }

  /**
   * Schedule chart creation in HTML overlay div
   * Uses retry logic to wait for DOM to be ready
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Element} svgContainer - SVG container element
   * @param {Object} cardInstance - Reference to custom-button-card instance
   */
  _scheduleChartCreation(overlay, anchors, viewBox, svgContainer, cardInstance) {
    const maxRetries = 20;
    let retries = 0;

    const attemptCreation = () => {
      // ADDED: Double-check that chart doesn't already exist before creating
      if (this.charts.has(overlay.id)) {
        cblcarsLog.warn(`[ApexChartsOverlayRenderer] ⚠️ Chart ${overlay.id} already exists, aborting duplicate creation`);
        return;
      }

      // Find SVG element
      const svg = svgContainer?.tagName === 'svg' ?
        svgContainer :
        svgContainer?.querySelector('svg');

      if (!svg) {
        retries++;
        if (retries < maxRetries) {
          setTimeout(attemptCreation, 50);
          return;
        }
        cblcarsLog.error(`[ApexChartsOverlayRenderer] SVG not found after ${maxRetries} retries`);
        return;
      }

      // Get DataSourceManager
      const dataSourceManager = cardInstance?._config?.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager ||
                                window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (!dataSourceManager) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] DataSourceManager not available`);
        return;
      }

      // Resolve position from anchors
      const position = OverlayUtils.resolvePosition(overlay.position, anchors);
      if (!position) {
        cblcarsLog.warn(`[ApexChartsOverlayRenderer] Position could not be resolved: ${overlay.id}`);
        return;
      }

      const [vbX, vbY] = position;
      const size = overlay.size || [300, 150];
      const [vbWidth, vbHeight] = size;

      try {
        // Convert DataSource to series
        const sourceRef = overlay.source || overlay.data_source || overlay.sources;
        const style = overlay.finalStyle || overlay.style || {};
        const isMultiSeries = Array.isArray(sourceRef);

        let series;
        if (isMultiSeries) {
          series = ApexChartsAdapter.convertToMultiSeries(sourceRef, dataSourceManager, {
            time_window: style.time_window,
            max_points: style.max_points || 500,
            seriesNames: style.series_names || style.seriesNames
          });
        } else {
          series = ApexChartsAdapter.convertToSeries(sourceRef, dataSourceManager, {
            time_window: style.time_window,
            max_points: style.max_points || 500,
            name: style.name
          });
        }

        if (!series || series.length === 0) {
          cblcarsLog.warn(`[ApexChartsOverlayRenderer] No data for chart ${overlay.id}`);
          return;
        }

        // Calculate screen position from viewBox coordinates
        const screenCoords = this._viewBoxToScreen(svg, viewBox, vbX, vbY, vbWidth, vbHeight);

        // Create overlay div
        const overlayDiv = this._createOverlayDiv(overlay.id, screenCoords, svg);

        if (!overlayDiv) {
          cblcarsLog.error(`[ApexChartsOverlayRenderer] Failed to create overlay div for ${overlay.id}`);
          return;
        }

        // Generate ApexCharts options with EXACT screen pixel dimensions
        const options = ApexChartsAdapter.generateOptions(
          style,
          [Math.round(screenCoords.width), Math.round(screenCoords.height)],
          {}
        );

        // Create chart in overlay div
        const chart = new ApexCharts(overlayDiv, {
          ...options,
          series
        });

        chart.render().then(() => {
          cblcarsLog.debug(`[ApexChartsOverlayRenderer] ✅ Chart created: ${overlay.id}`);

          // Store references
          this.charts.set(overlay.id, chart);
          this.overlayDivs.set(overlay.id, {
            div: overlayDiv,
            svg: svg,
            viewBox: viewBox,
            vbCoords: { x: vbX, y: vbY, width: vbWidth, height: vbHeight }
          });

          // Setup viewport sync
          this._setupViewportSync(overlay.id);

          // Register for debugging
          this._registerChartForDebugging(overlay.id, chart, overlayDiv, svg);

          // Subscribe to DataSource updates
          this._subscribeToDataSource(sourceRef, dataSourceManager, chart, overlay);
        });

      } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Chart creation failed: ${overlay.id}`, error);
      }
    };

    // Start creation attempt
    setTimeout(attemptCreation, 100);
  }

  /**
   * Convert viewBox coordinates to screen coordinates relative to overlay container
   * CRITICAL: Subtracts SVG offset (e.g., Home Assistant header) to correct positioning
   * @private
   * @param {SVGElement} svg - SVG element
   * @param {Array} viewBox - ViewBox [x, y, width, height]
   * @param {number} vbX - ViewBox X coordinate
   * @param {number} vbY - ViewBox Y coordinate
   * @param {number} vbWidth - ViewBox width
   * @param {number} vbHeight - ViewBox height
   * @returns {Object} Screen coordinates {left, top, width, height}
   */
  _viewBoxToScreen(svg, viewBox, vbX, vbY, vbWidth, vbHeight) {
    const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = viewBox ||
      [0, 0, svg.viewBox.baseVal.width, svg.viewBox.baseVal.height];

    const svgRect = svg.getBoundingClientRect();

    // Calculate scale factors
    const scaleX = svgRect.width / viewBoxWidth;
    const scaleY = svgRect.height / viewBoxHeight;

    // Position within the viewBox, scaled to screen pixels
    const viewBoxOffsetX = (vbX - viewBoxX) * scaleX;
    const viewBoxOffsetY = (vbY - viewBoxY) * scaleY;

    // Get SVG's offset from viewport (e.g., Home Assistant header offset)
    const svgOffsetTop = svgRect.top;

    // Subtract the header offset since overlay container is positioned relative to parent
    // The overlay container is at (0,0) within the parent, but the SVG itself may be
    // offset from the viewport (e.g., by the HA header bar at 48px)
    const relativeLeft = viewBoxOffsetX;
    const relativeTop = viewBoxOffsetY - svgOffsetTop;
    const screenWidth = vbWidth * scaleX;
    const screenHeight = vbHeight * scaleY;

    return {
      left: relativeLeft,
      top: relativeTop,
      width: screenWidth,
      height: screenHeight
    };
  }

  /**
   * Create overlay div element
   * @private
   * @param {string} overlayId - Overlay ID
   * @param {Object} screenCoords - Screen coordinates {left, top, width, height}
   * @param {SVGElement} svg - SVG element reference
   * @returns {HTMLElement} Created div element
   */
  _createOverlayDiv(overlayId, screenCoords, svg) {
    const svgParent = svg.parentElement;

    if (!svgParent) {
      cblcarsLog.error(`[ApexChartsOverlayRenderer] No parent found for SVG`);
      return null;
    }

    // Ensure the SVG parent has position: relative
    const parentStyle = window.getComputedStyle(svgParent);
    if (parentStyle.position === 'static') {
      svgParent.style.position = 'relative';
    }

    // Find or create overlay container
    let overlayContainer = svgParent.querySelector('.msd-apexchart-overlay-container');

    if (!overlayContainer) {
      overlayContainer = document.createElement('div');
      overlayContainer.className = 'msd-apexchart-overlay-container';
      overlayContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 100;
        overflow: visible;
      `;
      svgParent.appendChild(overlayContainer);
    }

    // Create chart div
    const chartDiv = document.createElement('div');
    chartDiv.id = `apex-chart-overlay-${overlayId}`;
    chartDiv.className = 'msd-apexchart-overlay';
    chartDiv.style.cssText = `
      position: absolute;
      left: ${screenCoords.left}px;
      top: ${screenCoords.top}px;
      width: ${screenCoords.width}px;
      height: ${screenCoords.height}px;
      pointer-events: auto;
      z-index: 101;
      overflow: hidden;
    `;

    overlayContainer.appendChild(chartDiv);

    return chartDiv;
  }

  /**
   * Setup viewport synchronization (resize, pan, zoom)
   * @private
   * @param {string} overlayId - Overlay ID
   */
  _setupViewportSync(overlayId) {
    const overlayInfo = this.overlayDivs.get(overlayId);
    if (!overlayInfo) return;

    const { svg } = overlayInfo;

    // Create resize observer if it doesn't exist
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.overlayDivs.forEach((info, id) => {
          this._updateOverlayPosition(id);
        });
      });
    }

    // Observe the SVG for size changes
    this.resizeObserver.observe(svg);

    // Also listen for window resize
    const resizeHandler = () => this._updateOverlayPosition(overlayId);
    window.addEventListener('resize', resizeHandler);

    if (!this._resizeHandlers) this._resizeHandlers = new Map();
    this._resizeHandlers.set(overlayId, resizeHandler);
  }

  /**
   * Update overlay div position based on current SVG viewport
   * @private
   * @param {string} overlayId - Overlay ID
   */
  _updateOverlayPosition(overlayId) {
    const overlayInfo = this.overlayDivs.get(overlayId);
    if (!overlayInfo) return;

    const { div, svg, viewBox, vbCoords } = overlayInfo;

    // Recalculate screen coordinates
    const screenCoords = this._viewBoxToScreen(
      svg,
      viewBox,
      vbCoords.x,
      vbCoords.y,
      vbCoords.width,
      vbCoords.height
    );

    // Update div position and size
    div.style.left = `${screenCoords.left}px`;
    div.style.top = `${screenCoords.top}px`;
    div.style.width = `${screenCoords.width}px`;
    div.style.height = `${screenCoords.height}px`;

    // Also update the chart dimensions
    const chart = this.charts.get(overlayId);
    if (chart) {
      chart.updateOptions({
        chart: {
          width: Math.round(screenCoords.width),
          height: Math.round(screenCoords.height)
        }
      }, false, false);
    }
  }

  /**
   * Subscribe to DataSource updates for real-time chart updates
   * @private
   * @param {string|Array<string>} sourceRef - DataSource reference(s)
   * @param {Object} dataSourceManager - MSD DataSourceManager instance
   * @param {Object} chart - ApexCharts instance
   * @param {Object} overlay - Overlay configuration
   */
  _subscribeToDataSource(sourceRef, dataSourceManager, chart, overlay) {
    const sources = Array.isArray(sourceRef) ? sourceRef : [sourceRef];
    const unsubscribers = [];

    sources.forEach((source) => {
      if (!source) return;

      const { dataSource } = ApexChartsAdapter._resolveDataSourcePath(source, dataSourceManager);

      if (!dataSource) {
        cblcarsLog.warn(`[ApexChartsOverlayRenderer] DataSource not found: ${source}`);
        return;
      }

      const unsubscribe = dataSource.subscribe(() => {
        try {
          const style = overlay.finalStyle || overlay.style || {};

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
            chart.updateSeries(newSeries, true);
          }
        } catch (error) {
          cblcarsLog.error(`[ApexChartsOverlayRenderer] Update failed for ${overlay.id}:`, error);
        }
      });

      unsubscribers.push(unsubscribe);
    });

    this.subscriptions.set(overlay.id, () => {
      unsubscribers.forEach(unsub => unsub());
    });
  }

  /**
   * Register chart for debugging
   * @private
   * @param {string} overlayId - Overlay ID
   * @param {Object} chart - ApexCharts instance
   * @param {HTMLElement} div - Overlay div element
   * @param {SVGElement} svg - SVG element
   */
  _registerChartForDebugging(overlayId, chart, div, svg) {
    if (typeof window === 'undefined') return;

    window.__msdDebug = window.__msdDebug || {};
    window.__msdDebug.apexCharts = window.__msdDebug.apexCharts || {};

    const instance = this;

    window.__msdDebug.apexCharts[overlayId] = {
      chart: chart,
      overlayDiv: div,
      svg: svg,
      overlayId: overlayId,
      getDimensions: () => {
        const overlayInfo = instance.overlayDivs.get(overlayId);
        return {
          viewBoxCoords: overlayInfo?.vbCoords,
          screenCoords: {
            left: parseFloat(div.style.left),
            top: parseFloat(div.style.top),
            width: parseFloat(div.style.width),
            height: parseFloat(div.style.height),
            rect: div.getBoundingClientRect()
          },
          apexInternal: {
            svgWidth: chart.w.globals.svgWidth,
            svgHeight: chart.w.globals.svgHeight,
            gridWidth: chart.w.globals.gridWidth,
            gridHeight: chart.w.globals.gridHeight
          },
          parentInfo: {
            tag: div.parentElement?.tagName,
            class: div.parentElement?.className,
            position: div.parentElement ? window.getComputedStyle(div.parentElement).position : null
          }
        };
      }
    };
  }

  /**
   * Compute attachment points for MSD overlay system
   * Returns viewBox coordinate points for connecting lines/overlays
   * @static
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Element} container - Container element (unused for HTML overlays)
   * @param {Array} viewBox - SVG viewBox [x, y, width, height]
   * @returns {Object|null} Attachment points in viewBox coordinates
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
      } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Error destroying chart ${overlayId}:`, error);
      }
    }

    // Remove overlay div
    const overlayInfo = instance.overlayDivs.get(overlayId);
    if (overlayInfo) {
      try {
        overlayInfo.div.remove();
        instance.overlayDivs.delete(overlayId);
      } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Error removing overlay div ${overlayId}:`, error);
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

    // Remove resize handler
    if (instance._resizeHandlers) {
      const handler = instance._resizeHandlers.get(overlayId);
      if (handler) {
        window.removeEventListener('resize', handler);
        instance._resizeHandlers.delete(overlayId);
      }
    }

    // Cleanup debug registry
    if (window.__msdDebug?.apexCharts?.[overlayId]) {
      delete window.__msdDebug.apexCharts[overlayId];
    }
  }

  /**
   * Cleanup all charts (called when card is removed)
   * @static
   */
  static cleanupAll() {
    const instance = ApexChartsOverlayRenderer._getInstance();

    const overlayIds = Array.from(instance.charts.keys());
    overlayIds.forEach(id => ApexChartsOverlayRenderer.cleanup(id));

    if (instance.resizeObserver) {
      instance.resizeObserver.disconnect();
      instance.resizeObserver = null;
    }

    document.querySelectorAll('.msd-apexchart-overlay-container').forEach(el => el.remove());
  }

  /**
   * Update chart with new style configuration (called by rules engine)
   * This method is called when rules engine applies overlay patches
   * FIXED: Use separate update methods for options and series to ensure updates work consistently
   * @static
   * @param {string} overlayId - Overlay ID
   * @param {Object} overlay - Updated overlay configuration with finalStyle
   * @param {Object} dataSourceManager - DataSourceManager instance
   */
  static updateChartStyle(overlayId, overlay, dataSourceManager) {
    const instance = ApexChartsOverlayRenderer._getInstance();
    const chart = instance.charts.get(overlayId);

    if (!chart) {
        cblcarsLog.warn(`[ApexChartsOverlayRenderer] Chart instance not found for update: ${overlayId}`);
        return;
    }

    try {
        const style = overlay.finalStyle || overlay.style || {};
        const sourceRef = overlay.source || overlay.data_source || overlay.sources;

        // Get overlay dimensions - use actual screen size from div if available
        const overlayInfo = instance.overlayDivs.get(overlayId);
        let size = overlay.size || [300, 150];

        // If we have the actual div, use its current screen size
        if (overlayInfo && overlayInfo.div) {
        const divRect = overlayInfo.div.getBoundingClientRect();
        size = [Math.round(divRect.width), Math.round(divRect.height)];
        }

        cblcarsLog.debug(`[ApexChartsOverlayRenderer] Updating chart ${overlayId} with style:`, {
        size,
        styleKeys: Object.keys(style),
        hasColor: !!style.color,
        hasStrokeWidth: !!style.stroke_width,
        hasGridSettings: !!(style.show_grid || style.grid_lines)
        });

        // Get current data in series format
        const isMultiSeries = Array.isArray(sourceRef);
        const series = isMultiSeries ?
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

        // Generate new options from updated style
        const updatedOptions = ApexChartsAdapter.generateOptions(style, size, {});

        // CRITICAL FIX: ApexCharts has issues when you update options and series simultaneously
        // We need to update them separately and force a redraw

        // Step 1: Update the options (WITHOUT series)
        const optionsOnly = { ...updatedOptions };
        delete optionsOnly.series; // Remove series from options object

        chart.updateOptions(optionsOnly, false, false); // Don't redraw yet

        // Step 2: Update the series separately with animation
        chart.updateSeries(series, true); // Animate the series update

        cblcarsLog.debug(`[ApexChartsOverlayRenderer] ✅ Chart style updated: ${overlayId}`, {
        optionsUpdated: Object.keys(optionsOnly).length,
        seriesCount: series.length,
        seriesDataPoints: series[0]?.data?.length,
        optionsOnly
        });

    } catch (error) {
        cblcarsLog.error(`[ApexChartsOverlayRenderer] Failed to update chart style for ${overlayId}:`, error);
    }
    }

  /**
   * Validate overlay configuration before rendering
   * @static
   * @param {Object} overlay - Overlay configuration
   * @returns {Array<string>} Array of error messages (empty if valid)
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

    return errors;
  }

  // Singleton pattern
  static _instance = null;

  static _getInstance() {
    if (!ApexChartsOverlayRenderer._instance) {
      ApexChartsOverlayRenderer._instance = new ApexChartsOverlayRenderer();
    }
    return ApexChartsOverlayRenderer._instance;
  }

  /**
   * Setup global debug helpers
   * Provides console commands for debugging charts:
   * - msdCharts.list() - List all charts
   * - msdCharts.dimensions(id) - Get dimension info
   * - msdCharts.findDiv(id) - Locate chart div
   * @static
   */
  static setupGlobalHelpers() {
    if (typeof window === 'undefined') return;

    window.msdCharts = window.msdCharts || {};

    window.msdCharts.dimensions = (overlayId) => {
      const chartDebug = window.__msdDebug?.apexCharts?.[overlayId];
      if (!chartDebug) {
        console.error(`❌ Chart not found: ${overlayId}`);
        return null;
      }

      const dims = chartDebug.getDimensions();
      console.log('📊 Chart Dimensions for', overlayId, ':', dims);
      return dims;
    };

    window.msdCharts.list = () => {
      const charts = window.__msdDebug?.apexCharts || {};
      const chartIds = Object.keys(charts);
      console.log('📊 Available ApexCharts overlays:', chartIds);
      return chartIds;
    };

    window.msdCharts.findDiv = (overlayId) => {
      const div = document.querySelector(`#apex-chart-overlay-${overlayId}`);
      if (div) {
        console.log('✅ Found div:', div);
        console.log('Parent:', div.parentElement);
        console.log('Computed style:', window.getComputedStyle(div));
        console.log('Bounding rect:', div.getBoundingClientRect());
      } else {
        console.error('❌ Div not found');
      }
      return div;
    };

    console.log('✅ MSD Charts diagnostic tools loaded (HTML overlay mode)');
  }
}

// Auto-setup global helpers
if (typeof window !== 'undefined') {
  ApexChartsOverlayRenderer.setupGlobalHelpers();
}

export default ApexChartsOverlayRenderer;