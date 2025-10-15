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

      // 4. MSD RESPONSIBILITY: Fetch data from DataSource
      const data = this._resolveSparklineData(overlay, style, sparklineStyle);

      if (!data || !Array.isArray(data) || data.length === 0) {
        cblcarsLog.warn(`[SparklineOverlayRenderer] No data for sparkline ${overlay.id}`);
        return this._renderFallbackSparkline(overlay, position, size);
      }

      // 5. DELEGATE: Pure rendering to core SparklineRenderer
      const renderResult = CoreSparklineRenderer.render(
        { data, position, size },
        { ...sparklineStyle, _overlayId: overlay.id },
        { viewBox, container: this.container, overlayId: overlay.id }
      );

      if (!renderResult || !renderResult.markup) {
        cblcarsLog.warn(`[SparklineOverlayRenderer] Core renderer returned empty markup for ${overlay.id}`);
        return this._renderFallbackSparkline(overlay, position, size);
      }

      // 6. MSD RESPONSIBILITY: Wrap in overlay group with metadata
      const metadata = renderResult.metadata || {};
      const dataSourceRef = overlay.source || overlay.data_source || overlay._raw?.source || overlay._raw?.data_source || style.source || style.data_source;

      return `<g data-overlay-id="${overlay.id}"
                  data-overlay-type="sparkline"
                  data-source="${dataSourceRef || ''}"
                  data-point-count="${metadata.dataPointCount || 0}"
                  style="pointer-events: none;">
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
    const standardStyles = RendererUtils.parseAllStandardStyles(style);

    return {
      // Core properties
      color: standardStyles.colors?.primary || style.color || this._resolveDefault('sparkline.color', scalingContext, defaults, 'var(--lcars-orange)'),
      stroke: style.stroke || null,
      width: Number(style.width || style.stroke_width || this._resolveDefault('sparkline.stroke_width', scalingContext, defaults, 2)),
      opacity: Number(style.opacity || this._resolveDefault('sparkline.opacity', scalingContext, defaults, 1)),

      // Fill properties
      fill: style.fill || style.area_fill || 'none',
      fill_opacity: Number(style.fill_opacity || style.area_opacity || 0.2),
      fill_gradient: style.fill_gradient || null,

      // Data bounds
      min_value: style.min !== undefined ? Number(style.min) : (style.min_value !== undefined ? Number(style.min_value) : null),
      max_value: style.max !== undefined ? Number(style.max) : (style.max_value !== undefined ? Number(style.max_value) : null),
      auto_scale: style.auto_scale !== false,

      // Gradient & thresholds
      gradient: standardStyles.gradient || style.gradient || null,
      thresholds: style.thresholds || null,

      // Path generation
      smoothing_mode: (style.smoothing_mode || 'none').toLowerCase(),
      interpolation: (style.interpolation || 'linear').toLowerCase(),
      path_precision: Number(style.path_precision || this._resolveDefault('sparkline.path_precision', scalingContext, defaults, 2)),
      padding: Number(style.padding || this._resolveDefault('sparkline.padding', scalingContext, defaults, 0)),

      // Display options
      show_points: !!(style.show_points),
      point_size: Number(style.point_size || this._resolveDefault('sparkline.point_size', scalingContext, defaults, 3)),
      point_color: style.point_color || null,
      show_last_value: !!(style.show_last_value),
      value_format: style.value_format || null,

      // Grid lines
      grid_lines: !!(style.grid_lines),
      grid_color: style.grid_color || this._resolveDefault('sparkline.grid.color', scalingContext, defaults, 'var(--lcars-gray)'),
      grid_opacity: Number(style.grid_opacity || this._resolveDefault('sparkline.grid.opacity', scalingContext, defaults, 0.4)),
      grid_stroke_width: Number(style.grid_stroke_width || this._resolveDefault('sparkline.grid.stroke_width', scalingContext, defaults, 1)),
      grid_horizontal_count: Number(style.grid_horizontal_count || this._resolveDefault('sparkline.grid.horizontal_count', scalingContext, defaults, 3)),
      grid_vertical_count: Number(style.grid_vertical_count || this._resolveDefault('sparkline.grid.vertical_count', scalingContext, defaults, 5)),

      // Zero line
      zero_line: !!(style.zero_line),
      zero_line_color: style.zero_line_color || this._resolveDefault('sparkline.zero_line.color', scalingContext, defaults, 'var(--lcars-gray)'),

      // Bracket properties
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

      // Status & animation
      status_indicator: style.status_indicator || false,
      scan_line: style.scan_line || false,
      animatable: standardStyles.animation?.animatable || false,
      tracer_speed: Number(style.tracer_speed || 0),
      pulse_speed: Number(style.pulse_speed || 0),

      // Performance
      decimation: Number(style.decimation || 0),
      max_points: Number(style.max_points || this._resolveDefault('sparkline.decimation_threshold', scalingContext, defaults, 1000)),
      maxPoints: Number(style.max_points || 0),
      timeWindow: style.time_window || null,

      // Visibility
      visible: standardStyles.layout?.visible !== false
    };
  }

  /**
   * Resolve sparkline data from DataSource
   * @private
   */
  _resolveSparklineData(overlay, style, sparklineStyle) {
    const dataSourceRef =
      overlay.source ||
      overlay.data_source ||
      overlay.dataSource ||
      overlay._raw?.source ||
      overlay._raw?.data_source ||
      overlay._raw?.dataSource ||
      style.source ||
      style.data_source ||
      style.dataSource ||
      overlay.data ||
      overlay._raw?.data;

    if (!dataSourceRef) {
      cblcarsLog.warn(`[SparklineOverlayRenderer] No data_source specified for sparkline ${overlay.id}`);
      return null;
    }

    if (Array.isArray(dataSourceRef)) {
      return dataSourceRef.map(v => {
        const num = Number(v);
        return isNaN(num) ? null : num;
      }).filter(v => v !== null);
    }

    const dataSourceManager = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
    if (!dataSourceManager) return null;

    const dataSource = dataSourceManager.getSource(dataSourceRef);
    if (!dataSource) return null;

    const currentData = dataSource.getCurrentData();
    if (!currentData?.buffer) return null;

    const bufferData = currentData.buffer.getAll();
    if (!bufferData || !Array.isArray(bufferData) || bufferData.length === 0) return null;

    let numericData = bufferData.map(entry => ({
      value: this._parseNumericValue(entry.v),
      timestamp: entry.t
    })).filter(item => item.value !== null);

    if (numericData.length === 0) return null;

    // Apply time window filter
    if (sparklineStyle.timeWindow) {
      const timeWindowMs = this._parseTimeWindowMs(sparklineStyle.timeWindow);
      if (timeWindowMs > 0) {
        const cutoffTime = Date.now() - timeWindowMs;
        numericData = numericData.filter(item => item.timestamp >= cutoffTime);
      }
    }

    // Apply max points limit
    if (sparklineStyle.maxPoints > 0 && numericData.length > sparklineStyle.maxPoints) {
      const step = Math.floor(numericData.length / sparklineStyle.maxPoints);
      const decimated = [];
      for (let i = 0; i < numericData.length; i += step) {
        decimated.push(numericData[i]);
      }
      if (decimated[decimated.length - 1] !== numericData[numericData.length - 1]) {
        decimated.push(numericData[numericData.length - 1]);
      }
      numericData = decimated;
    }

    return numericData.map(item => item.value);
  }

  _parseTimeWindowMs(timeWindow) {
    if (typeof timeWindow === 'number') return timeWindow;
    if (!timeWindow || typeof timeWindow !== 'string') return 0;

    const match = timeWindow.match(/^(\d+(?:\.\d+)?)\s*([smhd])$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * (multipliers[match[2].toLowerCase()] || 0);
  }

  _parseNumericValue(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return isNaN(value) ? null : value;

    if (typeof value === 'string') {
      const cleaned = value.replace(/[°℃℉%]/g, '').replace(/[,\s]/g, '').trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    }

    if (typeof value === 'object' && value !== null) {
      for (const prop of ['value', 'state', 'y', 'data', 'number']) {
        if (prop in value) return this._parseNumericValue(value[prop]);
      }
    }

    return null;
  }

  _getDefaultsManager() {
    return (typeof window !== 'undefined' && window.cblcars?.defaults) || null;
  }

  _getScalingContext(fallbackViewBox = null) {
    const viewBox = this.viewBox || fallbackViewBox || [0, 0, 400, 200];
    return { viewBox, containerElement: this.container };
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
      const pathElement = overlayElement.querySelector('[data-sparkline-line="true"]');
      if (!pathElement) return false;

      const instance = new SparklineOverlayRenderer();

      // CRITICAL FIX: Resolve style before calling _resolveSparklineData
      const style = overlay.finalStyle || overlay.style || {};
      const sparklineStyle = instance._resolveSparklineStyles(style, overlay.id);

      // Pass sparklineStyle as the third parameter
      const data = instance._resolveSparklineData(overlay, style, sparklineStyle);

      if (!data || data.length === 0) return false;

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