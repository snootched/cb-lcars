/**
 * [SparklineOverlayRenderer] Sparkline overlay renderer - MSD integration layer
 * 📊 Handles MSD-specific concerns: positioning, DataSource, actions, lifecycle
 *
 * Responsibilities:
 * - Position resolution from anchors
 * - DataSource integration and data fetching
 * - Action attachment coordination
 * - Style resolution with defaults
 * - Delegates pure rendering to core/SparklineRenderer
 */

import { DataSourceMixin } from './DataSourceMixin.js';
import { OverlayUtils } from './OverlayUtils.js';
import { RendererUtils } from './RendererUtils.js';
import { ActionHelpers } from './ActionHelpers.js';
import { SparklineRenderer as CoreSparklineRenderer } from './core/SparklineRenderer.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class SparklineOverlayRenderer {
  constructor() {
    // Reserved for instance methods
  }

  /**
   * Render a sparkline overlay with MSD integration
   * @param {Object} overlay - Sparkline overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Element} svgContainer - Container element
   * @param {Object} cardInstance - Reference to custom-button-card instance
   * @returns {string} Complete SVG markup
   */
  static render(overlay, anchors, viewBox, svgContainer = null, cardInstance = null) {
    // Create instance for non-static methods
    const instance = new SparklineOverlayRenderer();
    instance.container = svgContainer;
    instance.viewBox = viewBox;

    return instance.renderSparkline(overlay, anchors, viewBox, cardInstance);
  }

  /**
   * Instance method for comprehensive sparkline rendering with MSD integration
   */
  renderSparkline(overlay, anchors, viewBox, cardInstance = null) {
    // 1. MSD RESPONSIBILITY: Resolve position from anchors
    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) {
      cblcarsLog.warn('[SparklineOverlayRenderer] ⚠️ Sparkline overlay position could not be resolved:', overlay.id);
      return '';
    }

    // 2. MSD RESPONSIBILITY: Resolve size
    const size = overlay.size || [100, 40];

    try {
      const style = overlay.finalStyle || overlay.style || {};

      // 3. MSD RESPONSIBILITY: Resolve styles with defaults system
      const sparklineStyle = this._resolveSparklineStyles(style, overlay.id, viewBox);

      // DEBUG: Log overlay structure to help diagnose data source issues
      cblcarsLog.debug(`[SparklineOverlayRenderer] Rendering sparkline ${overlay.id}:`, {
        hasDataSource: !!(overlay.data_source || overlay.dataSource || overlay.source),
        hasRawDataSource: !!(overlay._raw?.data_source || overlay._raw?.dataSource || overlay._raw?.source),
        hasStyleDataSource: !!(style.data_source || style.dataSource || style.source),
        hasStaticData: !!(overlay.data || overlay._raw?.data),
        overlayKeys: Object.keys(overlay),
        rawKeys: overlay._raw ? Object.keys(overlay._raw) : [],
        styleKeys: Object.keys(style),
        // CRITICAL: Show actual values
        sourceValue: overlay.source || overlay._raw?.source || style.source,
        dataSourceValue: overlay.data_source || overlay._raw?.data_source || style.data_source
      });

      // 4. MSD RESPONSIBILITY: Fetch data from DataSource
      const data = this._resolveSparklineData(overlay, style);

      if (!data || !Array.isArray(data) || data.length === 0) {
        cblcarsLog.warn(`[SparklineOverlayRenderer] ⚠️ No data for sparkline ${overlay.id}`, {
          dataSourceAttempted: overlay.source || overlay.data_source,
          rawDataSourceAttempted: overlay._raw?.source || overlay._raw?.data_source
        });
        return this._renderFallbackSparkline(overlay, position, size);
      }

      cblcarsLog.debug(`[SparklineOverlayRenderer] Rendering sparkline ${overlay.id} with ${data.length} points`);

      // 5. DELEGATE: Pure rendering to core SparklineRenderer
      const renderResult = CoreSparklineRenderer.render(
        {
          data,
          position,
          size
        },
        { ...sparklineStyle, _overlayId: overlay.id },
        {
          viewBox,
          container: this.container,
          overlayId: overlay.id
        }
      );

      if (!renderResult || !renderResult.markup) {
        cblcarsLog.warn(`[SparklineOverlayRenderer] Core renderer returned empty markup for ${overlay.id}`);
        return this._renderFallbackSparkline(overlay, position, size);
      }

      // 6. MSD RESPONSIBILITY: Handle actions
      const hasActions = !!(overlay.tap_action || overlay.hold_action || overlay.double_tap_action);

      if (hasActions && cardInstance) {
        const actionInfo = ActionHelpers.processOverlayActions(overlay, sparklineStyle, cardInstance);
        if (actionInfo) {
          // Schedule action attachment after DOM insertion
          setTimeout(() => {
            let sparklineElement = null;
            const card = window.cb_lcars_card_instance;
            if (card && card.shadowRoot) {
              sparklineElement = card.shadowRoot.querySelector(`[data-overlay-id="${overlay.id}"]`);
            }
            if (!sparklineElement) {
              sparklineElement = document.querySelector(`[data-overlay-id="${overlay.id}"]`);
            }

            if (sparklineElement) {
              cblcarsLog.debug(`[SparklineOverlayRenderer] 🎯 Attaching actions to sparkline ${overlay.id}`);
              ActionHelpers.attachActions(sparklineElement, actionInfo.overlay, actionInfo.config, actionInfo.cardInstance);
            }
          }, 100);
        }
      }

      // 7. MSD RESPONSIBILITY: Wrap in overlay group with metadata
      const metadata = renderResult.metadata || {};
      // CRITICAL: Store the data source reference for updates
      const dataSourceRef = overlay.source || overlay.data_source || overlay._raw?.source || overlay._raw?.data_source || style.source || style.data_source;

      cblcarsLog.debug(`[SparklineOverlayRenderer] 📊 Rendered sparkline ${overlay.id} via core renderer`);

      return `<g data-overlay-id="${overlay.id}"
                  data-overlay-type="sparkline"
                  data-source="${dataSourceRef || ''}"
                  data-point-count="${metadata.dataPointCount || 0}"
                  style="pointer-events: ${hasActions ? 'visiblePainted' : 'none'}; cursor: ${hasActions ? 'pointer' : 'default'};">
                ${renderResult.markup}
              </g>`;

    } catch (error) {
      cblcarsLog.error(`[SparklineOverlayRenderer] ❌ Rendering failed for sparkline ${overlay.id}:`, error);
      return this._renderFallbackSparkline(overlay, position, size);
    }
  }

  /**
   * Resolve sparkline styling with defaults
   * @private
   */
  _resolveSparklineStyles(style, overlayId, fallbackViewBox = null) {
    const defaults = this._getDefaultsManager();
    const scalingContext = this._getScalingContext(fallbackViewBox);

    // Parse standard styles
    const standardStyles = RendererUtils.parseAllStandardStyles(style);

    return {
      // Core sparkline properties
      color: standardStyles.colors?.primary || style.color || this._resolveDefault('sparkline.color', scalingContext, defaults, 'var(--lcars-orange)'),
      stroke: style.stroke || null,
      strokeWidth: Number(style.stroke_width || style.strokeWidth || style.line_width || this._resolveDefault('sparkline.stroke_width', scalingContext, defaults, 2)),
      strokeOpacity: Number(style.stroke_opacity || style.strokeOpacity || 1),

      // Fill/area properties
      fill: style.fill || style.area_fill || null,
      areaFill: style.area_fill || style.areaFill || null,
      areaOpacity: Number(style.area_opacity || style.areaOpacity || style.fill_opacity || 0.2),
      fillOpacity: Number(style.fill_opacity || style.fillOpacity || 0.2),

      // Data bounds
      min: style.min !== undefined ? Number(style.min) : null,
      max: style.max !== undefined ? Number(style.max) : null,

      // Gradient
      gradient: standardStyles.gradient || style.gradient || null,

      // Threshold lines
      threshold: style.threshold !== undefined ? Number(style.threshold) : null,
      thresholdColor: style.threshold_color || style.thresholdColor || 'rgba(255, 0, 0, 0.5)',
      thresholdWidth: Number(style.threshold_width || style.thresholdWidth || 1),
      thresholdStyle: style.threshold_style || style.thresholdStyle || 'dashed',

      // Padding
      padding: Number(style.padding || this._resolveDefault('sparkline.padding', scalingContext, defaults, 0)),

      // Display options
      showPoints: style.show_points || style.showPoints || false,
      showDataPoints: style.show_data_points || style.showDataPoints || false,
      showLabels: style.show_labels || style.showLabels || false,
      showValues: style.show_values || style.showValues || false,

      // Animation
      animatable: standardStyles.animation?.animatable || false,

      // Opacity/visibility
      opacity: standardStyles.layout?.opacity || 1,
      visible: standardStyles.layout?.visible !== false
    };
  }

  /**
   * Resolve sparkline data from DataSource
   * @private
   */
  _resolveSparklineData(overlay, style) {
    // Check multiple possible locations for data_source reference
    const dataSourceRef =
      overlay.source ||  // PRIMARY: Check 'source' property first (matches original)
      overlay.data_source ||
      overlay.dataSource ||
      overlay._raw?.source ||
      overlay._raw?.data_source ||
      overlay._raw?.dataSource ||
      style.source ||
      style.data_source ||
      style.dataSource ||
      // Also check for data property directly (might contain static data)
      overlay.data ||
      overlay._raw?.data;

    if (!dataSourceRef) {
      cblcarsLog.warn(`[SparklineOverlayRenderer] No data_source specified for sparkline ${overlay.id}`);
      return null;
    }

    // If data is already an array, use it directly (static data)
    if (Array.isArray(dataSourceRef)) {
      cblcarsLog.debug(`[SparklineOverlayRenderer] Using static data array for sparkline ${overlay.id}:`, dataSourceRef.length, 'points');
      return dataSourceRef.map(v => {
        const num = Number(v);
        return isNaN(num) ? null : num;
      }).filter(v => v !== null);
    }

    // CRITICAL FIX: Use the original method from the monolithic renderer
    // Access DataSource via window.__msdDebug (matches original)
    const dataSourceManager = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

    if (!dataSourceManager) {
      cblcarsLog.debug(`[SparklineOverlayRenderer] DataSource manager not available yet`);
      return null;
    }

    const dataSource = dataSourceManager.getSource(dataSourceRef);
    if (!dataSource) {
      cblcarsLog.debug(`[SparklineOverlayRenderer] DataSource not found: ${dataSourceRef}`);
      return null;
    }

    // CRITICAL: Get current data which contains the buffer
    const currentData = dataSource.getCurrentData();

    if (!currentData?.buffer) {
      cblcarsLog.debug(`[SparklineOverlayRenderer] No buffer available for ${dataSourceRef}`);
      return null;
    }

    // CRITICAL: Call buffer.getAll() to get the historical data points
    const bufferData = currentData.buffer.getAll();

    if (!bufferData || !Array.isArray(bufferData) || bufferData.length === 0) {
      cblcarsLog.debug(`[SparklineOverlayRenderer] Empty buffer for ${dataSourceRef}`, {
        hasBuffer: !!currentData.buffer,
        bufferDataLength: bufferData?.length || 0
      });
      return null;
    }

    cblcarsLog.debug(`[SparklineOverlayRenderer] Got ${bufferData.length} points from buffer for ${overlay.id}`);

    // Convert buffer entries to numeric array
    // Buffer entries are objects with { t: timestamp, v: value }
    const numericData = bufferData.map(entry => {
      const value = entry.v; // Buffer uses 'v' for value
      return this._parseNumericValue(value);
    }).filter(v => v !== null);

    if (numericData.length === 0) {
      cblcarsLog.debug(`[SparklineOverlayRenderer] No valid numeric data points for ${overlay.id}`, {
        bufferLength: bufferData.length,
        sampleEntry: bufferData[0]
      });
      return null;
    }

    cblcarsLog.debug(`[SparklineOverlayRenderer] Successfully parsed ${numericData.length} history points for ${overlay.id}`);

    return numericData;
  }

  /**
   * Parse a value to a number, handling various formats
   * @private
   * @param {*} value - Value to parse
   * @returns {number|null} Parsed number or null if not parseable
   */
  _parseNumericValue(value) {
    if (value === null || value === undefined) return null;

    // Already a number
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }

    // String that might contain a number
    if (typeof value === 'string') {
      // Remove common units and formatting
      const cleaned = value
        .replace(/[°℃℉%]/g, '') // Remove degree symbols, percent
        .replace(/[,\s]/g, '')   // Remove commas, whitespace
        .trim();

      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    }

    // Object with numeric properties
    if (typeof value === 'object' && value !== null) {
      // Try common property names
      for (const prop of ['value', 'state', 'y', 'data', 'number']) {
        if (prop in value) {
          return this._parseNumericValue(value[prop]);
        }
      }
    }

    return null;
  }

  /**
   * Get a default value with fallback
   * @private
   */
  _getDefault(path, fallback = null, context = {}) {
    const defaults = this._getDefaultsManager();
    if (defaults) {
      return defaults.resolve(path, context) || fallback;
    }
    return fallback;
  }

  _getDefaultsManager() {
    return (typeof window !== 'undefined' && window.cblcars?.defaults) || null;
  }

  _getScalingContext(fallbackViewBox = null) {
    const viewBox = this.viewBox || fallbackViewBox || [0, 0, 400, 200];
    return {
      viewBox: viewBox,
      containerElement: this.container
    };
  }

  _resolveDefault(path, context, defaults, fallback) {
    if (defaults) {
      const resolved = defaults.resolve(path, context);
      return resolved !== null ? resolved : fallback;
    }
    return fallback;
  }

  _renderFallbackSparkline(overlay, position, size) {
    const [x, y] = position;
    const [width, height] = size;
    const color = 'var(--lcars-gray)';

    return `<g data-overlay-id="${overlay.id}" data-overlay-type="sparkline" data-fallback="true">
              <g transform="translate(${x}, ${y})">
                <rect width="${width}" height="${height}"
                      fill="none" stroke="${color}" stroke-width="2" rx="4"/>
                <text x="${width / 2}" y="${height / 2}" text-anchor="middle"
                      fill="${color}" font-size="12" dominant-baseline="middle">
                  Loading...
                </text>
              </g>
            </g>`;
  }

  /**
   * Update sparkline data dynamically
   * @static
   */
  static updateSparklineData(overlayElement, overlay, sourceData) {
    try {
      // Find path element
      const pathElement = overlayElement.querySelector('[data-sparkline-line="true"]');
      if (!pathElement) {
        cblcarsLog.warn(`[SparklineOverlayRenderer] Path element not found for sparkline: ${overlay.id}`);
        return false;
      }

      // Re-render with new data
      const instance = new SparklineOverlayRenderer();
      const data = instance._resolveSparklineData(overlay, overlay.finalStyle || {});

      if (!data || data.length === 0) {
        return false;
      }

      // TODO: Update path without full re-render (optimization)
      cblcarsLog.debug(`[SparklineOverlayRenderer] Sparkline ${overlay.id} data updated`);
      return true;

    } catch (error) {
      cblcarsLog.error(`[SparklineOverlayRenderer] ❌ Error updating sparkline ${overlay.id}:`, error);
      return false;
    }
  }

  /**
   * Compute attachment points for sparkline
   * @static
   */
  static computeAttachmentPoints(overlay, anchors, container, viewBox = null) {
    if (!overlay || overlay.type !== 'sparkline') return null;

    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) return null;

    const size = overlay.size || [100, 40];
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
}

export default SparklineOverlayRenderer;