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

      // DEBUG: Log what we're passing to core renderer
      cblcarsLog.debug(`[SparklineOverlayRenderer] 🔍 Passing to core renderer:`, {
        dataLength: data.length,
        position,
        size,
        styleKeys: Object.keys(sparklineStyle),
        show_points: sparklineStyle.show_points,
        grid_lines: sparklineStyle.grid_lines,
        smoothing_mode: sparklineStyle.smoothing_mode
      });

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

      // DEBUG: Log what core renderer returned
      cblcarsLog.debug(`[SparklineOverlayRenderer] 🔍 Core renderer returned:`, {
        hasMarkup: !!renderResult?.markup,
        markupLength: renderResult?.markup?.length || 0,
        hasMetadata: !!renderResult?.metadata,
        markupPreview: renderResult?.markup?.substring(0, 200)
      });

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

    // SIMPLIFIED: Only use snake_case to match core renderer
    const sparklineStyle = {
      // Core sparkline properties - snake_case only
      color: standardStyles.colors?.primary || style.color || this._resolveDefault('sparkline.color', scalingContext, defaults, 'var(--lcars-orange)'),
      stroke: style.stroke || null,
      width: Number(style.width || style.stroke_width || this._resolveDefault('sparkline.stroke_width', scalingContext, defaults, 2)),
      opacity: Number(style.opacity || this._resolveDefault('sparkline.opacity', scalingContext, defaults, 1)),

      // Fill/area properties
      fill: style.fill || style.area_fill || 'none',
      fill_opacity: Number(style.fill_opacity || style.area_opacity || 0.2),
      fill_gradient: style.fill_gradient || null,

      // Data bounds
      min_value: style.min !== undefined ? Number(style.min) : (style.min_value !== undefined ? Number(style.min_value) : null),
      max_value: style.max !== undefined ? Number(style.max) : (style.max_value !== undefined ? Number(style.max_value) : null),
      auto_scale: style.auto_scale !== false,

      // Gradient
      gradient: standardStyles.gradient || style.gradient || null,

      // Threshold lines
      thresholds: style.thresholds || null,

      // Path generation options
      smoothing_mode: (style.smoothing_mode || 'none').toLowerCase(),
      interpolation: (style.interpolation || 'linear').toLowerCase(),
      path_precision: Number(style.path_precision || this._resolveDefault('sparkline.path_precision', scalingContext, defaults, 2)),

      // Padding
      padding: Number(style.padding || this._resolveDefault('sparkline.padding', scalingContext, defaults, 0)),

      // Display options - snake_case
      show_points: !!(style.show_points),
      point_size: Number(style.point_size || this._resolveDefault('sparkline.point_size', scalingContext, defaults, 3)),
      point_color: style.point_color || null,
      show_last_value: !!(style.show_last_value),
      value_format: style.value_format || null,

      // Grid lines - snake_case
      grid_lines: !!(style.grid_lines),
      grid_color: style.grid_color || this._resolveDefault('sparkline.grid.color', scalingContext, defaults, 'var(--lcars-gray)'),
      grid_opacity: Number(style.grid_opacity || this._resolveDefault('sparkline.grid.opacity', scalingContext, defaults, 0.4)),
      grid_stroke_width: Number(style.grid_stroke_width || this._resolveDefault('sparkline.grid.stroke_width', scalingContext, defaults, 1)),
      grid_horizontal_count: Number(style.grid_horizontal_count || this._resolveDefault('sparkline.grid.horizontal_count', scalingContext, defaults, 3)),
      grid_vertical_count: Number(style.grid_vertical_count || this._resolveDefault('sparkline.grid.vertical_count', scalingContext, defaults, 5)),

      // Zero line
      zero_line: !!(style.zero_line),
      zero_line_color: style.zero_line_color || this._resolveDefault('sparkline.zero_line.color', scalingContext, defaults, 'var(--lcars-gray)'),

      // Bracket/border properties - snake_case
      bracket_style: style.bracket_style || null,
      bracket_width: Number(style.bracket_width || this._resolveDefault('sparkline.bracket.width', scalingContext, defaults, 2)),
      bracket_color: style.border_color || style.bracket_color || null,
      bracket_gap: Number(style.bracket_gap || this._resolveDefault('sparkline.bracket.gap', scalingContext, defaults, 6)),
      bracket_extension: Number(style.bracket_extension || this._resolveDefault('sparkline.bracket.extension', scalingContext, defaults, 8)),
      bracket_opacity: Number(style.bracket_opacity || this._resolveDefault('sparkline.bracket.opacity', scalingContext, defaults, 1)),
      bracket_corners: style.bracket_corners || 'both',
      bracket_sides: style.bracket_sides || 'both',
      bracket_physical_width: Number(style.bracket_physical_width || style.bracket_extension || this._resolveDefault('sparkline.bracket.physical_width', scalingContext, defaults, 8)),
      bracket_height: style.bracket_height || '100%',
      bracket_radius: Number(style.bracket_radius || this._resolveDefault('sparkline.bracket.radius', scalingContext, defaults, 4)),
      border_top: Number(style.border_top || 0),
      border_left: Number(style.border_left || 0),
      border_right: Number(style.border_right || 0),
      border_bottom: Number(style.border_bottom || 0),
      border_color: style.border_color || null,
      border_radius: Number(style.border_radius || this._resolveDefault('sparkline.bracket.border_radius', scalingContext, defaults, 8)),
      inner_factor: Number(style.inner_factor || this._resolveDefault('sparkline.bracket.inner_factor', scalingContext, defaults, 2)),
      hybrid_mode: style.hybrid_mode || false,

      // Status and scan line
      status_indicator: style.status_indicator || false,
      scan_line: style.scan_line || false,

      // Animation
      animatable: standardStyles.animation?.animatable || false,
      tracer_speed: Number(style.tracer_speed || 0),
      pulse_speed: Number(style.pulse_speed || 0),

      // Performance options
      decimation: Number(style.decimation || 0),
      max_points: Number(style.max_points || this._resolveDefault('sparkline.decimation_threshold', scalingContext, defaults, 1000)),

      // Data limiting options (NEW)
      maxPoints: Number(style.max_points || 0),
      timeWindow: style.time_window || null,

      // Opacity/visibility
      visible: standardStyles.layout?.visible !== false
    };

    // DEBUG: Log the resolved style to see what core renderer receives
    cblcarsLog.debug(`[SparklineOverlayRenderer] 🎨 Resolved sparkline style for ${overlayId}:`, {
      show_points: sparklineStyle.show_points,
      point_size: sparklineStyle.point_size,
      grid_lines: sparklineStyle.grid_lines,
      grid_color: sparklineStyle.grid_color,
      smoothing_mode: sparklineStyle.smoothing_mode,
      width: sparklineStyle.width,
      color: sparklineStyle.color,
      bracket_style: sparklineStyle.bracket_style,
      allKeys: Object.keys(sparklineStyle)
    });

    return sparklineStyle;
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
    let numericData = bufferData.map(entry => {
      const value = entry.v;
      return {
        value: this._parseNumericValue(value),
        timestamp: entry.t
      };
    }).filter(item => item.value !== null);

    if (numericData.length === 0) {
      cblcarsLog.debug(`[SparklineOverlayRenderer] No valid numeric data points for ${overlay.id}`);
      return null;
    }

    // NEW: Apply time window filter if specified
    const sparklineStyle = this._resolveSparklineStyles(style, overlay.id);
    if (sparklineStyle.timeWindow) {
      const timeWindowMs = this._parseTimeWindow(sparklineStyle.timeWindow);
      if (timeWindowMs > 0) {
        const cutoffTime = Date.now() - timeWindowMs;
        const originalLength = numericData.length;
        numericData = numericData.filter(item => item.timestamp >= cutoffTime);
        cblcarsLog.debug(`[SparklineOverlayRenderer] Time window filter: ${originalLength} -> ${numericData.length} points`);
      }
    }

    // NEW: Apply max points limit if specified
    if (sparklineStyle.maxPoints > 0 && numericData.length > sparklineStyle.maxPoints) {
      // Use intelligent decimation - keep first, last, and evenly spaced points
      const step = Math.floor(numericData.length / sparklineStyle.maxPoints);
      const decimated = [];
      for (let i = 0; i < numericData.length; i += step) {
        decimated.push(numericData[i]);
      }
      // Always include the last point
      if (decimated[decimated.length - 1] !== numericData[numericData.length - 1]) {
        decimated.push(numericData[numericData.length - 1]);
      }
      cblcarsLog.debug(`[SparklineOverlayRenderer] Max points limit: ${numericData.length} -> ${decimated.length} points`);
      numericData = decimated;
    }

    // Extract just the values for the core renderer
    const values = numericData.map(item => item.value);

    cblcarsLog.debug(`[SparklineOverlayRenderer] Successfully parsed ${values.length} history points for ${overlay.id}`);

    return values;
  }

  /**
   * Parse time window string to milliseconds
   * @private
   * @param {string} timeWindow - Time window like "1h", "30m", "24h"
   * @returns {number} Milliseconds
   */
  _parseTimeWindow(timeWindow) {
    if (typeof timeWindow === 'number') return timeWindow;
    if (!timeWindow || typeof timeWindow !== 'string') return 0;

    const match = timeWindow.match(/^(\d+(?:\.\d+)?)\s*([smhd])$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };

    return value * (multipliers[unit] || 0);
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