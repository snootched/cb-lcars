/**
 * [SparklineRenderer] Sparkline renderer - advanced sparkline rendering with comprehensive styling support
 * ⚡ Provides rich sparkline styling features with path smoothing, effects, and real-time updates
 */

import { OverlayUtils } from './OverlayUtils.js';
import { RendererUtils } from './RendererUtils.js';
import { DataSourceMixin } from './DataSourceMixin.js';
import { BracketRenderer } from './BracketRenderer.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class SparklineRenderer {
  constructor() {
    // Note: Caches removed as they were not being used in practice
  }

  /**
   * Render a sparkline overlay with comprehensive styling support
   * @param {Object} overlay - Sparkline overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @returns {string} Complete SVG markup for the styled sparkline
   */
  static render(overlay, anchors, viewBox) {
    // Create instance for non-static methods
    const instance = new SparklineRenderer();
    return instance.renderSparkline(overlay, anchors, viewBox);
  }

  /**
   * Instance method for comprehensive sparkline rendering
   * @param {Object} overlay - Sparkline overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @returns {string} Complete SVG markup for the styled sparkline
   */
  renderSparkline(overlay, anchors, viewBox) {

    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) {
      cblcarsLog.warn('[SparklineRenderer] ⚠️ Sparkline overlay position could not be resolved:', overlay.id);
      return '';
    }

    const [x, y] = position;
    const size = overlay.size || [200, 60];
    const [width, height] = size;

    try {
      // Use unified DataSource access through DataSourceMixin
      const dataResult = this._getHistoricalDataForSparkline(overlay.source);

      // Extract comprehensive styling
      const style = overlay.finalStyle || overlay.style || {};
      const sparklineStyle = this._resolveSparklineStyles(style, overlay.id);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      cblcarsLog.debug(`[SparklineRenderer] ⚡ Data result for ${overlay.id}: ${dataResult.status} (${dataResult.data?.length || 0} points)`);

      if (dataResult.status === 'OK' && dataResult.data && dataResult.data.length >= 2) {
        // Render real sparkline with advanced features
        return this._renderEnhancedSparkline(
          overlay, x, y, width, height, dataResult.data,
          sparklineStyle, animationAttributes
        );
      } else {
        // Render enhanced status indicator
        return this._renderEnhancedStatusIndicator(
          overlay, x, y, width, height, dataResult,
          sparklineStyle, animationAttributes
        );
      }
    } catch (error) {
      cblcarsLog.error(`[SparklineRenderer] ❌ Enhanced rendering failed for sparkline ${overlay.id}:`, error);
      return this._renderFallbackSparkline(overlay, x, y, width, height);
    }
  }

  /**
   * Instance method to get historical data using unified DataSource patterns
   * @private
   */
  _getHistoricalDataForSparkline(dataSourceRef) {
    return SparklineRenderer.getHistoricalDataForSparkline(dataSourceRef);
  }

  /**
   * Resolve comprehensive sparkline styling from configuration
   * @private
   * @param {Object} style - Final resolved style object
   * @param {string} overlayId - Overlay ID for unique identifiers
   * @returns {Object} Complete sparkline style configuration
   */
  _resolveSparklineStyles(style, overlayId) {
    const sparklineStyle = {
      // Core line properties
      color: style.color || style.stroke || 'var(--lcars-yellow)',
      width: Number(style.width || style.stroke_width || style.strokeWidth || 2),
      opacity: Number(style.opacity || 1),

      // Advanced stroke styling
      lineCap: (style.line_cap || style.lineCap || style.strokeLinecap || 'round').toLowerCase(),
      lineJoin: (style.line_join || style.lineJoin || style.strokeLinejoin || 'round').toLowerCase(),
      miterLimit: Number(style.miter_limit || style.miterLimit || 4),

      // Dash patterns
      dashArray: style.dash_array || style.dashArray || style.strokeDasharray || null,
      dashOffset: Number(style.dash_offset || style.dashOffset || style.strokeDashoffset || 0),

      // Path generation options
      smoothing_mode: (style.smoothing_mode || style.smoothingMode || 'none').toLowerCase(),
      interpolation: (style.interpolation || 'linear').toLowerCase(),
      path_precision: Number(style.path_precision || style.pathPrecision || 2),

      // Area fill properties
      fill: style.fill || 'none',
      fillOpacity: Number(style.fill_opacity || style.fillOpacity || 0.2),
      fillGradient: this._parseGradientConfig(style.fill_gradient || style.fillGradient),

      // Advanced styling
      gradient: this._parseGradientConfig(style.gradient),
      pattern: this._parsePatternConfig(style.pattern),

      // Data visualization features
      show_points: style.show_points || style.showPoints || false,
      point_size: Number(style.point_size || style.pointSize || 3),
      point_color: style.point_color || style.pointColor || null,
      show_last_value: style.show_last_value || style.showLastValue || false,
      value_format: style.value_format || style.valueFormat || null,

      // Threshold and reference lines
      thresholds: this._parseThresholds(style.thresholds),
      zero_line: style.zero_line || style.zeroLine || false,
      zero_line_color: style.zero_line_color || style.zeroLineColor || 'var(--lcars-gray)',

      // Value range control
      min_value: style.min_value !== undefined ? Number(style.min_value) : null,
      max_value: style.max_value !== undefined ? Number(style.max_value) : null,
      auto_scale: style.auto_scale !== false,

      // Effects
      glow: this._parseGlowConfig(style.glow),
      shadow: this._parseShadowConfig(style.shadow),
      blur: this._parseBlurConfig(style.blur),

      // LCARS-specific features
      bracket_style: style.bracket_style || style.bracketStyle || false,
      bracket_width: Number(style.bracket_width || style.bracketWidth || 2), // Configurable bracket stroke width
      bracket_color: style.bracket_color || style.bracketColor || null, // Separate bracket color
      bracket_gap: Number(style.bracket_gap || style.bracketGap || 6), // Distance from sparkline
      bracket_extension: Number(style.bracket_extension || style.bracketExtension || 8), // Length of bracket arms
      bracket_opacity: Number(style.bracket_opacity || style.bracketOpacity || 1), // Bracket transparency
      bracket_corners: style.bracket_corners || style.bracketCorners || 'both', // Corner display
      bracket_sides: style.bracket_sides || style.bracketSides || 'both', // Side display
      // Enhanced bg-grid style bracket options
      bracket_physical_width: Number(style.bracket_physical_width || style.bracketPhysicalWidth || style.bracket_extension || 8),
      bracket_height: style.bracket_height || style.bracketHeight || '100%',
      bracket_radius: Number(style.bracket_radius || style.bracketRadius || 4),
      // LCARS container/border options
      border_top: Number(style.border_top || 0),
      border_left: Number(style.border_left || 0),
      border_right: Number(style.border_right || 0),
      border_bottom: Number(style.border_bottom || 0),
      border_color: style.border_color || null,
      border_radius: Number(style.border_radius || 8),
      inner_factor: Number(style.inner_factor || 2),
      hybrid_mode: style.hybrid_mode || false,

      status_indicator: style.status_indicator || style.statusIndicator || false,
      scan_line: style.scan_line || style.scanLine || false,

      grid_lines: style.grid_lines || style.gridLines || false,
      grid_color: style.grid_color || style.gridColor || 'var(--lcars-gray)',
      grid_opacity: Number(style.grid_opacity || style.gridOpacity || 0.4), // Increased default opacity
      grid_stroke_width: Number(style.grid_stroke_width || style.gridStrokeWidth || 1), // Configurable grid stroke width
      grid_horizontal_count: Number(style.grid_horizontal_count || style.gridHorizontalCount || 3),
      grid_vertical_count: Number(style.grid_vertical_count || style.gridVerticalCount || 5),

      // Animation states (for future anime.js integration)
      animatable: style.animatable !== false,
      tracer_speed: Number(style.tracer_speed || style.tracerSpeed || 0),
      pulse_speed: Number(style.pulse_speed || style.pulseSpeed || 0),

      // Performance options
      decimation: Number(style.decimation || 0), // 0 = no decimation
      max_points: Number(style.max_points || style.maxPoints || 1000),

      // Track enabled features for optimization
      features: []
    };

    // Build feature list for conditional rendering
    if (sparklineStyle.gradient) sparklineStyle.features.push('gradient');
    if (sparklineStyle.pattern) sparklineStyle.features.push('pattern');
    if (sparklineStyle.fill !== 'none') sparklineStyle.features.push('area-fill');
    if (sparklineStyle.fillGradient) sparklineStyle.features.push('area-gradient');
    if (sparklineStyle.show_points) sparklineStyle.features.push('data-points');
    if (sparklineStyle.thresholds && sparklineStyle.thresholds.length > 0) sparklineStyle.features.push('thresholds');
    if (sparklineStyle.zero_line) sparklineStyle.features.push('zero-line');
    if (sparklineStyle.glow) sparklineStyle.features.push('glow');
    if (sparklineStyle.shadow) sparklineStyle.features.push('shadow');
    if (sparklineStyle.blur) sparklineStyle.features.push('blur');
    if (sparklineStyle.bracket_style) sparklineStyle.features.push('brackets');
    if (sparklineStyle.status_indicator) sparklineStyle.features.push('status');
    if (sparklineStyle.scan_line) sparklineStyle.features.push('scan-line');
    if (sparklineStyle.grid_lines) sparklineStyle.features.push('grid');
    if (sparklineStyle.show_last_value) sparklineStyle.features.push('value-label');
    if (sparklineStyle.smoothing_mode !== 'none') sparklineStyle.features.push('smoothing');
    if (sparklineStyle.tracer_speed > 0) sparklineStyle.features.push('tracer');
    if (sparklineStyle.pulse_speed > 0) sparklineStyle.features.push('pulse');

    return sparklineStyle;
  }

  /**
   * Render enhanced sparkline with all features
   * @private
   */
  _renderEnhancedSparkline(overlay, x, y, width, height, data, sparklineStyle, animationAttributes) {
    const svgParts = [
      this._buildDefinitions(sparklineStyle, overlay.id),
      this._buildSparklineBackground(width, height, sparklineStyle, overlay.id),
      this._buildGridLines(width, height, sparklineStyle, overlay.id),
      this._buildThresholdLines(data, width, height, sparklineStyle, overlay.id),
      this._buildZeroLine(data, width, height, sparklineStyle, overlay.id),
      this._buildAreaFill(data, width, height, sparklineStyle, overlay.id),
      this._buildMainSparklinePath(data, width, height, sparklineStyle, overlay.id, animationAttributes),
      this._buildDataPoints(data, width, height, sparklineStyle, overlay.id),
      this._buildValueLabel(data, width, height, sparklineStyle, overlay.id),
      this._buildBrackets(width, height, sparklineStyle, overlay.id),
      this._buildStatusIndicator(width, height, sparklineStyle, overlay.id),
      this._buildScanLine(width, height, sparklineStyle, overlay.id)
    ].filter(Boolean);

    cblcarsLog.debug(`[SparklineRenderer] ⚡ Rendered enhanced sparkline ${overlay.id} with ${sparklineStyle.features.length} features`);

    return `<g data-overlay-id="${overlay.id}"
                data-overlay-type="sparkline"
                data-source="${overlay.source}"
                data-sparkline-features="${sparklineStyle.features.join(',')}"
                data-animation-ready="${!!animationAttributes.hasAnimations}"
                transform="translate(${x}, ${y})">
              ${svgParts.join('\n')}
            </g>`;
  }

  /**
   * Build SVG definitions for gradients, patterns, and effects
   * @private
   */
  _buildDefinitions(sparklineStyle, overlayId) {
    const defs = [];

    // Line gradients
    if (sparklineStyle.gradient) {
      defs.push(RendererUtils.createGradientDefinition(sparklineStyle.gradient, `sparkline-gradient-${overlayId}`));
    }

    // Area fill gradients
    if (sparklineStyle.fillGradient) {
      defs.push(RendererUtils.createGradientDefinition(sparklineStyle.fillGradient, `sparkline-area-gradient-${overlayId}`));
    }

    // Patterns
    if (sparklineStyle.pattern) {
      defs.push(RendererUtils.createPatternDefinition(sparklineStyle.pattern, `sparkline-pattern-${overlayId}`));
    }

    // Effects (filters)
    if (sparklineStyle.glow) {
      defs.push(RendererUtils.createGlowFilter(sparklineStyle.glow, `sparkline-glow-${overlayId}`));
    }

    if (sparklineStyle.shadow) {
      defs.push(RendererUtils.createShadowFilter(sparklineStyle.shadow, `sparkline-shadow-${overlayId}`));
    }

    if (sparklineStyle.blur) {
      defs.push(RendererUtils.createBlurFilter(sparklineStyle.blur, `sparkline-blur-${overlayId}`));
    }

    return defs.length > 0 ? `<defs>${defs.join('\n')}</defs>` : '';
  }

  /**
   * Build background rectangle for contrast
   * @private
   */
  _buildSparklineBackground(width, height, sparklineStyle, overlayId) {
    // Only render background if explicitly configured
    return '';
  }

  /**
   * Build grid lines for technical appearance
   * @private
   */
  _buildGridLines(width, height, sparklineStyle, overlayId) {
    if (!sparklineStyle.grid_lines) return '';

    const lines = [];

    // Horizontal grid lines
    for (let i = 1; i < sparklineStyle.grid_horizontal_count; i++) {
      const y = (height / sparklineStyle.grid_horizontal_count) * i;
      lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}"
                        stroke="${sparklineStyle.grid_color}"
                        stroke-width="${sparklineStyle.grid_stroke_width}"
                        opacity="${sparklineStyle.grid_opacity}"/>`);
    }

    // Vertical grid lines
    for (let i = 1; i < sparklineStyle.grid_vertical_count; i++) {
      const x = (width / sparklineStyle.grid_vertical_count) * i;
      lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}"
                        stroke="${sparklineStyle.grid_color}"
                        stroke-width="${sparklineStyle.grid_stroke_width}"
                        opacity="${sparklineStyle.grid_opacity}"/>`);
    }

    return `<g data-feature="grid-lines">${lines.join('\n')}</g>`;
  }

  /**
   * Build threshold reference lines
   * @private
   */
  _buildThresholdLines(data, width, height, sparklineStyle, overlayId) {
    if (!sparklineStyle.thresholds || sparklineStyle.thresholds.length === 0) return '';

    const values = data.map(d => d.value);
    const minValue = sparklineStyle.min_value !== null ? sparklineStyle.min_value : Math.min(...values);
    const maxValue = sparklineStyle.max_value !== null ? sparklineStyle.max_value : Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    const thresholdLines = sparklineStyle.thresholds.map(threshold => {
      const y = height - ((threshold.value - minValue) / valueRange) * height;
      const color = threshold.color || 'var(--lcars-orange)';
      const strokeWidth = threshold.width || 1;
      const opacity = threshold.opacity || 0.7;
      const dashArray = threshold.dash ? '4,2' : null;

      return `<line x1="0" y1="${y}" x2="${width}" y2="${y}"
                    stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}"
                    ${dashArray ? `stroke-dasharray="${dashArray}"` : ''}
                    data-threshold="${threshold.value}"/>`;
    });

    return `<g data-feature="threshold-lines">${thresholdLines.join('\n')}</g>`;
  }

  /**
   * Build zero baseline reference
   * @private
   */
  _buildZeroLine(data, width, height, sparklineStyle, overlayId) {
    if (!sparklineStyle.zero_line) return '';

    const values = data.map(d => d.value);
    const minValue = sparklineStyle.min_value !== null ? sparklineStyle.min_value : Math.min(...values);
    const maxValue = sparklineStyle.max_value !== null ? sparklineStyle.max_value : Math.max(...values);

    // Only show zero line if zero is within the data range
    if (minValue > 0 || maxValue < 0) return '';

    const valueRange = maxValue - minValue || 1;
    const zeroY = height - ((0 - minValue) / valueRange) * height;

    return `<line x1="0" y1="${zeroY}" x2="${width}" y2="${zeroY}"
                  stroke="${sparklineStyle.zero_line_color}" stroke-width="1" opacity="0.5"
                  stroke-dasharray="2,2"
                  data-feature="zero-line"/>`;
  }

  /**
   * Build area fill under sparkline
   * @private
   */
  _buildAreaFill(data, width, height, sparklineStyle, overlayId) {
    if (sparklineStyle.fill === 'none' && !sparklineStyle.fillGradient) return '';

    const processedData = this._processDataForRendering(data, sparklineStyle);
    const pathData = this._createSparklinePath(processedData, { width, height }, sparklineStyle);

    // Create area path by adding bottom edge
    const areaPath = pathData + ` L ${width} ${height} L 0 ${height} Z`;

    let fillColor = sparklineStyle.fill;
    if (sparklineStyle.fillGradient) {
      fillColor = `url(#sparkline-area-gradient-${overlayId})`;
    } else if (fillColor === 'none') {
      fillColor = sparklineStyle.color;
    }

    return `<path d="${areaPath}"
                  fill="${fillColor}"
                  fill-opacity="${sparklineStyle.fillOpacity}"
                  data-feature="area-fill"/>`;
  }

  /**
   * Build the main sparkline path with advanced styling
   * @private
   */
  _buildMainSparklinePath(data, width, height, sparklineStyle, overlayId, animationAttributes) {
    const processedData = this._processDataForRendering(data, sparklineStyle);
    const pathData = this._createSparklinePath(processedData, { width, height }, sparklineStyle);

    const attributes = [];

    // Core path
    attributes.push(`d="${pathData}"`);
    attributes.push(`fill="none"`);

    // Stroke styling
    if (sparklineStyle.gradient) {
      attributes.push(`stroke="url(#sparkline-gradient-${overlayId})"`);
    } else if (sparklineStyle.pattern) {
      attributes.push(`stroke="url(#sparkline-pattern-${overlayId})"`);
    } else {
      attributes.push(`stroke="${sparklineStyle.color}"`);
    }

    attributes.push(`stroke-width="${sparklineStyle.width}"`);
    attributes.push(`stroke-opacity="${sparklineStyle.opacity}"`);
    attributes.push(`stroke-linecap="${sparklineStyle.lineCap}"`);
    attributes.push(`stroke-linejoin="${sparklineStyle.lineJoin}"`);
    attributes.push(`vector-effect="non-scaling-stroke"`);

    if (sparklineStyle.lineJoin === 'miter' && sparklineStyle.miterLimit !== 4) {
      attributes.push(`stroke-miterlimit="${sparklineStyle.miterLimit}"`);
    }

    if (sparklineStyle.dashArray) {
      attributes.push(`stroke-dasharray="${sparklineStyle.dashArray}"`);
      if (sparklineStyle.dashOffset !== 0) {
        attributes.push(`stroke-dashoffset="${sparklineStyle.dashOffset}"`);
      }
    }

    // Effects
    const filters = [];
    if (sparklineStyle.glow) filters.push(`url(#sparkline-glow-${overlayId})`);
    if (sparklineStyle.shadow) filters.push(`url(#sparkline-shadow-${overlayId})`);
    if (sparklineStyle.blur) filters.push(`url(#sparkline-blur-${overlayId})`);
    if (filters.length > 0) {
      attributes.push(`filter="${filters.join(' ')}"`);
    }

    // Animation attributes
    attributes.push(...animationAttributes.pathAttributes);

    return `<path ${attributes.join(' ')} data-feature="main-path"/>`;
  }

  /**
   * Build data point markers
   * @private
   */
  _buildDataPoints(data, width, height, sparklineStyle, overlayId) {
    if (!sparklineStyle.show_points) return '';

    const processedData = this._processDataForRendering(data, sparklineStyle);
    const points = this._calculateDataPointPositions(processedData, { width, height }, sparklineStyle);

    const pointColor = sparklineStyle.point_color || sparklineStyle.color;
    const pointSize = sparklineStyle.point_size;

    const pointElements = points.map((point, index) => {
      return `<circle cx="${point.x.toFixed(sparklineStyle.path_precision)}"
                      cy="${point.y.toFixed(sparklineStyle.path_precision)}"
                      r="${pointSize}"
                      fill="${pointColor}"
                      opacity="${sparklineStyle.opacity}"
                      data-value="${point.value}"
                      data-timestamp="${point.timestamp}"/>`;
    });

    return `<g data-feature="data-points">${pointElements.join('\n')}</g>`;
  }

  /**
   * Build last value label
   * @private
   */
  _buildValueLabel(data, width, height, sparklineStyle, overlayId) {
    if (!sparklineStyle.show_last_value || data.length === 0) return '';

    const lastValue = data[data.length - 1].value;
    const formattedValue = sparklineStyle.value_format ?
      this._formatValue(lastValue, sparklineStyle.value_format) :
      lastValue.toFixed(1);

    const fontSize = Math.min(width / 10, height / 3, 12);
    const labelX = width + 4;
    const labelY = height / 2;

    return `<text x="${labelX}" y="${labelY}"
                  fill="${sparklineStyle.color}"
                  font-size="${fontSize}"
                  text-anchor="start"
                  dominant-baseline="middle"
                  font-family="var(--lcars-font-family, Antonio)"
                  data-feature="value-label">
              ${formattedValue}
            </text>`;
  }

  /**
   * Build LCARS-style brackets using the generalized BracketRenderer
   * @private
   */
  _buildBrackets(width, height, sparklineStyle, overlayId) {
    if (!sparklineStyle.bracket_style) return '';

    // Convert sparkline style properties to BracketRenderer format
    const bracketConfig = {
      enabled: true,
      style: typeof sparklineStyle.bracket_style === 'string' ? sparklineStyle.bracket_style : 'lcars',
      color: sparklineStyle.bracket_color || sparklineStyle.color,
      width: sparklineStyle.bracket_width,
      gap: sparklineStyle.bracket_gap,
      extension: sparklineStyle.bracket_extension,
      opacity: sparklineStyle.bracket_opacity,
      corners: sparklineStyle.bracket_corners,
      sides: sparklineStyle.bracket_sides,
      // Enhanced bg-grid style options
      bracket_width: sparklineStyle.bracket_physical_width,
      bracket_height: sparklineStyle.bracket_height,
      bracket_radius: sparklineStyle.bracket_radius,
      // LCARS container options
      border_top: sparklineStyle.border_top,
      border_left: sparklineStyle.border_left,
      border_right: sparklineStyle.border_right,
      border_bottom: sparklineStyle.border_bottom,
      border_color: sparklineStyle.border_color || sparklineStyle.bracket_color || sparklineStyle.color,
      border_radius: sparklineStyle.border_radius,
      inner_factor: sparklineStyle.inner_factor,
      hybrid_mode: sparklineStyle.hybrid_mode
    };

    return BracketRenderer.render(width, height, bracketConfig, overlayId);
  }

  /**
   * Build status indicator
   * @private
   */
  _buildStatusIndicator(width, height, sparklineStyle, overlayId) {
    if (!sparklineStyle.status_indicator) return '';

    const indicatorSize = 4;
    const indicatorColor = typeof sparklineStyle.status_indicator === 'string' ?
      sparklineStyle.status_indicator : 'var(--lcars-green)';

    return `<circle cx="${-indicatorSize - 4}" cy="${height / 2}" r="${indicatorSize}"
                    fill="${indicatorColor}"
                    data-feature="status-indicator"/>`;
  }

  /**
   * Build scan line animation element
   * @private
   */
  _buildScanLine(width, height, sparklineStyle, overlayId) {
    if (!sparklineStyle.scan_line) return '';

    return `<line x1="0" y1="0" x2="0" y2="${height}"
                  stroke="${sparklineStyle.color}" stroke-width="1" opacity="0.8"
                  data-feature="scan-line"
                  data-scan-speed="${sparklineStyle.tracer_speed || 2}">
              <animate attributeName="x1" values="0;${width};0" dur="3s" repeatCount="indefinite"/>
              <animate attributeName="x2" values="0;${width};0" dur="3s" repeatCount="indefinite"/>
            </line>`;
  }

  /**
   * Create enhanced sparkline path with smoothing options
   * @private
   */
  _createSparklinePath(data, bounds, sparklineStyle) {
    if (!data || data.length < 2) {
      return `M 0 ${bounds.height / 2} L ${bounds.width} ${bounds.height / 2}`;
    }

    const { width, height } = bounds;
    const points = this._calculateDataPointPositions(data, bounds, sparklineStyle);

    // Apply smoothing based on mode with proper width normalization
    let path;
    switch (sparklineStyle.smoothing_mode) {
      case 'chaikin':
        path = this._createChaikinPath(points, sparklineStyle.path_precision, width);
        break;
      case 'constrained':
        path = this._createConstrainedSmoothPath(points, sparklineStyle.path_precision, width);
        break;
      case 'bezier':
        path = this._createBezierPath(points, sparklineStyle.path_precision, width);
        break;
      case 'spline':
        path = this._createSplinePath(points, sparklineStyle.path_precision, width);
        break;
      case 'stepped':
        path = this._createSteppedPath(points, sparklineStyle.path_precision);
        break;
      default:
        path = this._createLinearPath(points, sparklineStyle.path_precision);
        break;
    }

    return path;
  }

  /**
   * Calculate data point positions with scaling
   * @private
   */
  _calculateDataPointPositions(data, bounds, sparklineStyle) {
    const { width, height } = bounds;

    // Find value range
    const values = data.map(d => d.value);
    let minValue = sparklineStyle.min_value !== null ? sparklineStyle.min_value : Math.min(...values);
    let maxValue = sparklineStyle.max_value !== null ? sparklineStyle.max_value : Math.max(...values);

    // Handle edge cases
    if (minValue === maxValue) {
      minValue -= 0.5;
      maxValue += 0.5;
    }

    const valueRange = maxValue - minValue;

    return data.map((point, index) => ({
      x: (index / (data.length - 1)) * width,
      y: height - ((point.value - minValue) / valueRange) * height,
      value: point.value,
      timestamp: point.timestamp
    }));
  }

  /**
   * Create linear path (default)
   * @private
   */
  _createLinearPath(points, precision) {
    const pathSegments = [];

    points.forEach((point, index) => {
      const x = point.x.toFixed(precision);
      const y = point.y.toFixed(precision);

      if (index === 0) {
        pathSegments.push(`M ${x} ${y}`);
      } else {
        pathSegments.push(`L ${x} ${y}`);
      }
    });

    return pathSegments.join(' ');
  }

  /**
   * Create stepped path
   * @private
   */
  _createSteppedPath(points, precision) {
    const pathSegments = [];

    points.forEach((point, index) => {
      const x = point.x.toFixed(precision);
      const y = point.y.toFixed(precision);

      if (index === 0) {
        pathSegments.push(`M ${x} ${y}`);
      } else {
        const prevY = points[index - 1].y.toFixed(precision);
        pathSegments.push(`L ${x} ${prevY}`);
        pathSegments.push(`L ${x} ${y}`);
      }
    });

    return pathSegments.join(' ');
  }

  /**
   * Create Chaikin smoothed path with width normalization
   * @private
   */
  _createChaikinPath(points, precision, targetWidth) {
    if (points.length < 3) return this._createLinearPath(points, precision);

    // Chaikin subdivision algorithm
    let smoothedPoints = [...points];

    // Apply Chaikin subdivision iterations
    for (let iteration = 0; iteration < 2; iteration++) {
      const newPoints = [];

      for (let i = 0; i < smoothedPoints.length - 1; i++) {
        const p1 = smoothedPoints[i];
        const p2 = smoothedPoints[i + 1];

        // Quarter point
        newPoints.push({
          x: p1.x * 0.75 + p2.x * 0.25,
          y: p1.y * 0.75 + p2.y * 0.25
        });

        // Three-quarter point
        newPoints.push({
          x: p1.x * 0.25 + p2.x * 0.75,
          y: p1.y * 0.25 + p2.y * 0.75
        });
      }

      smoothedPoints = newPoints;
    }

    // Normalize X coordinates to span full width
    if (smoothedPoints.length > 1) {
      const minX = Math.min(...smoothedPoints.map(p => p.x));
      const maxX = Math.max(...smoothedPoints.map(p => p.x));
      const currentWidth = maxX - minX;

      if (currentWidth > 0) {
        smoothedPoints = smoothedPoints.map(point => ({
          x: ((point.x - minX) / currentWidth) * targetWidth,
          y: point.y
        }));
      }
    }

    return this._createLinearPath(smoothedPoints, precision);
  }

  /**
   * Create Bezier curved path with width normalization
   * @private
   */
  _createBezierPath(points, precision, targetWidth) {
    if (points.length < 3) return this._createLinearPath(points, precision);

    const pathSegments = [`M ${points[0].x.toFixed(precision)} ${points[0].y.toFixed(precision)}`];

    for (let i = 1; i < points.length - 1; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];

      // Control points for smooth curve
      const cp1x = p0.x + (p1.x - p0.x) * 0.5;
      const cp1y = p0.y + (p1.y - p0.y) * 0.5;
      const cp2x = p1.x - (p2.x - p1.x) * 0.5;
      const cp2y = p1.y - (p2.y - p1.y) * 0.5;

      pathSegments.push(`Q ${cp1x.toFixed(precision)} ${cp1y.toFixed(precision)} ${p1.x.toFixed(precision)} ${p1.y.toFixed(precision)}`);
    }

    // Final point
    const lastPoint = points[points.length - 1];
    pathSegments.push(`L ${lastPoint.x.toFixed(precision)} ${lastPoint.y.toFixed(precision)}`);

    return pathSegments.join(' ');
  }

  /**
   * Create spline path with width normalization
   * @private
   */
  _createSplinePath(points, precision, targetWidth) {
    if (points.length < 4) return this._createBezierPath(points, precision, targetWidth);

    // Generate spline points
    const splinePoints = [];

    // Start with first point
    splinePoints.push(points[0]);

    // Generate intermediate spline points
    for (let i = 1; i < points.length - 2; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2];

      // Catmull-Rom spline - generate multiple points along the curve
      const segments = 10; // Number of segments between each pair of points
      for (let t = 0; t <= segments; t++) {
        const u = t / segments;
        const u2 = u * u;
        const u3 = u2 * u;

        // Catmull-Rom basis functions
        const f1 = -0.5 * u3 + u2 - 0.5 * u;
        const f2 = 1.5 * u3 - 2.5 * u2 + 1;
        const f3 = -1.5 * u3 + 2 * u2 + 0.5 * u;
        const f4 = 0.5 * u3 - 0.5 * u2;

        const x = f1 * p0.x + f2 * p1.x + f3 * p2.x + f4 * p3.x;
        const y = f1 * p0.y + f2 * p1.y + f3 * p2.y + f4 * p3.y;

        splinePoints.push({ x, y });
      }
    }

    // Add final point
    splinePoints.push(points[points.length - 1]);

    // Normalize X coordinates to span full width
    if (splinePoints.length > 1) {
      const minX = Math.min(...splinePoints.map(p => p.x));
      const maxX = Math.max(...splinePoints.map(p => p.x));
      const currentWidth = maxX - minX;

      if (currentWidth > 0) {
        splinePoints.forEach(point => {
          point.x = ((point.x - minX) / currentWidth) * targetWidth;
        });
      }
    }

    return this._createLinearPath(splinePoints, precision);
  }

  /**
   * Create constrained smooth path that passes through all data points
   * @private
   */
  _createConstrainedSmoothPath(points, precision, targetWidth) {
    if (points.length < 3) return this._createLinearPath(points, precision);

    const pathSegments = [];

    // Start at first point
    pathSegments.push(`M ${points[0].x.toFixed(precision)} ${points[0].y.toFixed(precision)}`);

    // Create smooth curves between each pair of points
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];

      // Calculate control points for smooth curve
      let cp1x, cp1y, cp2x, cp2y;

      if (i === 0) {
        // First segment - use next point for direction
        const next2 = points[i + 2] || next;
        cp1x = current.x + (next.x - current.x) * 0.3;
        cp1y = current.y + (next.y - current.y) * 0.2;
        cp2x = next.x - (next2.x - current.x) * 0.2;
        cp2y = next.y - (next2.y - current.y) * 0.1;
      } else if (i === points.length - 2) {
        // Last segment - use previous point for direction
        const prev = points[i - 1];
        cp1x = current.x + (next.x - prev.x) * 0.2;
        cp1y = current.y + (next.y - prev.y) * 0.1;
        cp2x = next.x - (next.x - current.x) * 0.3;
        cp2y = next.y - (next.y - current.y) * 0.2;
      } else {
        // Middle segments - use surrounding points for smooth direction
        const prev = points[i - 1];
        const next2 = points[i + 2];

        const prevSlope = {
          x: next.x - prev.x,
          y: next.y - prev.y
        };
        const nextSlope = {
          x: next2.x - current.x,
          y: next2.y - current.y
        };

        // Smooth the transition
        cp1x = current.x + prevSlope.x * 0.25;
        cp1y = current.y + prevSlope.y * 0.15;
        cp2x = next.x - nextSlope.x * 0.25;
        cp2y = next.y - nextSlope.y * 0.15;
      }

      // Clamp control points to reasonable bounds
      cp1x = Math.max(current.x, Math.min(next.x, cp1x));
      cp2x = Math.max(current.x, Math.min(next.x, cp2x));

      pathSegments.push(`C ${cp1x.toFixed(precision)} ${cp1y.toFixed(precision)} ${cp2x.toFixed(precision)} ${cp2y.toFixed(precision)} ${next.x.toFixed(precision)} ${next.y.toFixed(precision)}`);
    }

    return pathSegments.join(' ');
  }

  /**
   * Process data for rendering (decimation, filtering)
   * @private
   */
  _processDataForRendering(data, sparklineStyle) {
    let processedData = [...data];

    // Apply decimation if needed
    if (sparklineStyle.decimation > 0 && processedData.length > sparklineStyle.decimation) {
      const step = Math.floor(processedData.length / sparklineStyle.decimation);
      processedData = processedData.filter((_, index) => index % step === 0);

      // Always include the last point
      if (processedData[processedData.length - 1] !== data[data.length - 1]) {
        processedData.push(data[data.length - 1]);
      }
    }

    // Apply max_points limit
    if (sparklineStyle.max_points > 0 && processedData.length > sparklineStyle.max_points) {
      const step = Math.floor(processedData.length / sparklineStyle.max_points);
      processedData = processedData.filter((_, index) => index % step === 0);

      // Always include the last point
      if (processedData[processedData.length - 1] !== data[data.length - 1]) {
        processedData.push(data[data.length - 1]);
      }
    }

    return processedData;
  }

  /**
   * Render enhanced status indicator
   * @private
   */
  _renderEnhancedStatusIndicator(overlay, x, y, width, height, dataResult, sparklineStyle, animationAttributes) {
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

    const indicatorColor = statusColors[dataResult.status] || sparklineStyle.color;
    const indicatorText = statusMessages[dataResult.status] || 'UNKNOWN';
    const fontSize = Math.min(width / 8, height / 3, 14);

    // Enhanced status with LCARS styling
    const loadingStates = ['MANAGER_NOT_AVAILABLE', 'INSUFFICIENT_DATA'];
    const isLoading = loadingStates.includes(dataResult.status);

    const animationProps = isLoading ? `
      <animate attributeName="opacity" values="0.3;1.0;0.3" dur="1s" repeatCount="indefinite"/>
    ` : `
      <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite"/>
    `;

    const svgParts = [
      this._buildDefinitions(sparklineStyle, overlay.id),
      sparklineStyle.bracket_style ? this._buildBrackets(width, height, { ...sparklineStyle, color: indicatorColor }, overlay.id) : '',
      `<rect width="${width}" height="${height}"
             fill="none" stroke="${indicatorColor}" stroke-width="2"
             stroke-dasharray="${isLoading ? '4,2' : '8,4'}" opacity="0.6">
        ${animationProps}
       </rect>`,
      `<text x="${width / 2}" y="${height / 2}"
             fill="${indicatorColor}" text-anchor="middle" dominant-baseline="middle"
             font-family="var(--lcars-font-family, Antonio)"
             font-size="${fontSize}" font-weight="bold">
        ${indicatorText}
       </text>`,
      width > 120 ? `<text x="${width / 2}" y="${height / 2 + fontSize + 4}"
                           fill="${indicatorColor}" text-anchor="middle" dominant-baseline="middle"
                           font-family="var(--lcars-font-family, Antonio)"
                           font-size="${Math.max(8, fontSize * 0.6)}" opacity="0.7">
                      ${overlay.source || 'NO SOURCE ID'}
                     </text>` : ''
    ].filter(Boolean);

    return `<g data-overlay-id="${overlay.id}"
                data-overlay-type="sparkline"
                data-source="${overlay.source || 'unknown'}"
                data-status="${dataResult.status}"
                data-animation-ready="${!!animationAttributes.hasAnimations}"
                transform="translate(${x}, ${y})">
              ${svgParts.join('\n')}
            </g>`;
  }

  /**
   * Parse various configuration formats
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
   * Format value for display
   * @private
   */
  _formatValue(value, format) {
    if (typeof format === 'function') {
      return format(value);
    }

    if (typeof format === 'string') {
      return format.replace('{value}', value.toFixed(1));
    }

    return value.toFixed(1);
  }

  /**
   * Prepare animation attributes for future anime.js integration
   * @private
   */
  _prepareAnimationAttributes(overlay, style) {
    const animationAttributes = {
      pathAttributes: [],
      hasAnimations: false
    };

    // Animation hooks for future implementation
    if (style.animatable !== false) {
      animationAttributes.pathAttributes.push(`data-animatable="true"`);
    }

    if (style.tracer_speed > 0) {
      animationAttributes.pathAttributes.push(`data-tracer-speed="${style.tracer_speed}"`);
      animationAttributes.hasAnimations = true;
    }

    if (style.pulse_speed > 0) {
      animationAttributes.pathAttributes.push(`data-pulse-speed="${style.pulse_speed}"`);
      animationAttributes.hasAnimations = true;
    }

    return animationAttributes;
  }

  /**
   * Render simple fallback sparkline
   * @private
   */
  _renderFallbackSparkline(overlay, x, y, width, height) {
    const style = overlay.finalStyle || overlay.style || {};
    const color = style.color || 'var(--lcars-yellow)';
    const strokeWidth = style.width || 2;

    cblcarsLog.warn(`[SparklineRenderer] ⚠️ Using fallback rendering for sparkline ${overlay.id}`);

    return `<g data-overlay-id="${overlay.id}" data-overlay-type="sparkline" data-fallback="true">
              <g transform="translate(${x}, ${y})">
                <path d="M 0 ${height / 2} L ${width} ${height / 2}"
                      fill="none" stroke="${color}" stroke-width="${strokeWidth}"
                      vector-effect="non-scaling-stroke"/>
              </g>
            </g>`;
  }

  // === EXISTING DATA SOURCE METHODS (PRESERVED FROM ORIGINAL) ===

  /**
   * Get historical data with multiple fallback strategies and DataSource enhancement support
   * @param {string} dataSourceRef - Data source reference (source_name or source_name.data_key)
   * @returns {Object} {data: Array|null, status: string, message: string, metadata: Object}
   */
  static getHistoricalDataForSparkline(dataSourceRef) {
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
      const { sourceName, dataKey, isTransformation, isAggregation } = SparklineRenderer.parseDataSourceReference(dataSourceRef);

      const dataSourceManager = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (dataSourceManager) {
        const dataSource = dataSourceManager.getSource(sourceName);

        if (dataSource) {
          const currentData = dataSource.getCurrentData();

          // NEW: Support for enhanced data access
          if (dataKey && (isTransformation || isAggregation)) {
            return SparklineRenderer.getEnhancedDataSourceData(currentData, dataKey, isTransformation, isAggregation, sourceName);
          }

          // Original buffer-based data access
          if (currentData?.buffer) {
            const bufferData = currentData.buffer.getAll();


            if (bufferData && bufferData.length >= 2) {
              const historicalData = bufferData.map(point => ({
                timestamp: point.t,
                value: point.v
              }));

              cblcarsLog.debug(`[SparklineRenderer] ✅ Found ${historicalData.length} data points for '${sourceName}'`);
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
            } else if (bufferData && bufferData.length === 1) {
              cblcarsLog.debug(`[SparklineRenderer] ⚠️ Only 1 data point available for '${sourceName}'`);
              return {
                data: null,
                status: 'INSUFFICIENT_DATA',
                message: 'Only 1 data point available (need 2+ for sparkline)',
                metadata: { sourceName, dataType: 'raw' }
              };
            } else {
              cblcarsLog.debug(`[SparklineRenderer] ⚠️ Buffer exists but is empty for '${sourceName}'`);
              return {
                data: null,
                status: 'EMPTY_BUFFER',
                message: 'Buffer exists but contains no data',
                metadata: { sourceName, dataType: 'raw' }
              };
            }
          }

          cblcarsLog.debug(`[SparklineRenderer] ⚠️ Data source '${sourceName}' found but no buffer`);
          return {
            data: null,
            status: 'NO_BUFFER',
            message: 'Data source found but no buffer available',
            metadata: { sourceName }
          };
        }

        const availableSources = Array.from(dataSourceManager.sources.keys());
        cblcarsLog.warn(`[SparklineRenderer] ❌ Source '${sourceName}' not found in DataSourceManager`);
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
      cblcarsLog.error(`[SparklineRenderer] Error getting data for '${dataSourceRef}':`, error);
      return {
        data: null,
        status: 'ERROR',
        message: `Error occurred: ${error.message}`,
        metadata: { error: error.message }
      };
    }
  }

  /**
   * Update sparkline data dynamically when data source changes with enhanced synchronization
   * @param {Element} sparklineElement - The sparkline SVG element
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - New data from the data source
   */
  static updateSparklineData(sparklineElement, overlay, sourceData) {
    cblcarsLog.debug(`[SparklineRenderer] updateSparklineData called for ${overlay.id}:`, {
      hasBuffer: !!(sourceData?.buffer),
      bufferSize: sourceData?.buffer?.size?.() || 0,
      currentStatus: sparklineElement.getAttribute('data-status'),
      elementFound: !!sparklineElement,
      currentValue: sourceData?.v
    });

    if (!sparklineElement || !overlay || !sourceData) {
      cblcarsLog.warn('[SparklineRenderer] updateSparklineData: Missing required parameters');
      return;
    }

    // Create instance for update operations
    const instance = new SparklineRenderer();
    instance._updateSparklineElementSynchronized(sparklineElement, overlay, sourceData);
  }

  /**
   * Enhanced synchronized update method that ensures markers and lines stay in sync
   * @private
   */
  _updateSparklineElementSynchronized(sparklineElement, overlay, sourceData) {
    const currentStatus = sparklineElement.getAttribute('data-status');
    const isStatusIndicator = currentStatus !== null;

    // If status indicator and data is now available, upgrade
    if (isStatusIndicator && (sourceData.buffer || sourceData.historicalData)) {
      this._upgradeStatusIndicatorToSparkline(sparklineElement, overlay, sourceData);
      return;
    }

    // Extract current historical data
    const historicalData = this._extractHistoricalData(sourceData);

    if (historicalData.length < 2) {
      cblcarsLog.warn(`[SparklineRenderer] Insufficient data for sparkline ${overlay.id}: ${historicalData.length} points`);
      sparklineElement.setAttribute('data-status', historicalData.length === 0 ? 'NO_DATA' : 'INSUFFICIENT_DATA');
      return;
    }

    try {
      // Extract dimensions from overlay config
      const bounds = {
        width: overlay.size?.[0] || 200,
        height: overlay.size?.[1] || 60
      };

      // Re-resolve styles for consistency
      const style = overlay.finalStyle || overlay.style || {};
      const sparklineStyle = this._resolveSparklineStyles(style, overlay.id);

      // SYNCHRONIZED UPDATE: Update both path and markers together
      this._updateSparklinePathAndMarkers(sparklineElement, historicalData, bounds, sparklineStyle, overlay.id);

      // Update other features that might depend on data
      this._updateSparklineFeatures(sparklineElement, historicalData, bounds, sparklineStyle, overlay.id);

      // Update status attributes
      sparklineElement.removeAttribute('data-status');
      sparklineElement.setAttribute('data-last-update', Date.now());

      cblcarsLog.debug(`[SparklineRenderer] ✅ Synchronized update for sparkline ${overlay.id} with ${historicalData.length} points`);

    } catch (error) {
      cblcarsLog.error(`[SparklineRenderer] Error in synchronized update for ${overlay.id}:`, error);
      sparklineElement.setAttribute('data-status', 'ERROR');
    }
  }

  /**
   * Update both path and markers simultaneously to ensure synchronization
   * @private
   */
  _updateSparklinePathAndMarkers(sparklineElement, historicalData, bounds, sparklineStyle, overlayId) {
    // Generate processed data once
    const processedData = this._processDataForRendering(historicalData, sparklineStyle);

    // Update main path
    const pathElement = sparklineElement.querySelector('path[data-feature="main-path"]');
    if (pathElement) {
      const newPathData = this._createSparklinePath(processedData, bounds, sparklineStyle);
      pathElement.setAttribute('d', newPathData);
    }

    // Update data points markers if they exist
    const dataPointsGroup = sparklineElement.querySelector('g[data-feature="data-points"]');
    if (dataPointsGroup && sparklineStyle.show_points) {
      const points = this._calculateDataPointPositions(processedData, bounds, sparklineStyle);
      const pointElements = dataPointsGroup.querySelectorAll('circle');

      // Get styling for consistency with initial render
      const pointColor = sparklineStyle.point_color || sparklineStyle.color;
      const pointSize = sparklineStyle.point_size;

      // Update existing points or create new ones
      points.forEach((point, index) => {
        let pointElement = pointElements[index];
        if (!pointElement) {
          pointElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dataPointsGroup.appendChild(pointElement);
        }

        // Update position
        pointElement.setAttribute('cx', point.x.toFixed(sparklineStyle.path_precision));
        pointElement.setAttribute('cy', point.y.toFixed(sparklineStyle.path_precision));
        pointElement.setAttribute('r', pointSize);

        // Update styling (this was missing!)
        pointElement.setAttribute('fill', pointColor);
        pointElement.setAttribute('opacity', sparklineStyle.opacity);

        // Update data attributes
        pointElement.setAttribute('data-value', point.value);
        pointElement.setAttribute('data-timestamp', point.timestamp);
      });

      // Remove excess point elements
      for (let i = points.length; i < pointElements.length; i++) {
        pointElements[i].remove();
      }
    }

    // Update area fill if it exists
    const areaElement = sparklineElement.querySelector('path[data-feature="area-fill"]');
    if (areaElement && (sparklineStyle.fill !== 'none' || sparklineStyle.fillGradient)) {
      const pathData = this._createSparklinePath(processedData, bounds, sparklineStyle);
      const areaPath = pathData + ` L ${bounds.width} ${bounds.height} L 0 ${bounds.height} Z`;
      areaElement.setAttribute('d', areaPath);
    }
  }

  /**
   * Update other sparkline features that might depend on data
   * @private
   */
  _updateSparklineFeatures(sparklineElement, historicalData, bounds, sparklineStyle, overlayId) {
    // Update value label if it exists
    const valueLabelElement = sparklineElement.querySelector('text[data-feature="value-label"]');
    if (valueLabelElement && sparklineStyle.show_last_value && historicalData.length > 0) {
      const lastValue = historicalData[historicalData.length - 1].value;
      const formattedValue = sparklineStyle.value_format ?
        this._formatValue(lastValue, sparklineStyle.value_format) :
        lastValue.toFixed(1);
      valueLabelElement.textContent = formattedValue;
    }

    // Update threshold lines if data range changed significantly
    const thresholdGroup = sparklineElement.querySelector('g[data-feature="threshold-lines"]');
    if (thresholdGroup && sparklineStyle.thresholds && sparklineStyle.thresholds.length > 0) {
      // Recalculate threshold positions based on new data range
      const values = historicalData.map(d => d.value);
      const minValue = sparklineStyle.min_value !== null ? sparklineStyle.min_value : Math.min(...values);
      const maxValue = sparklineStyle.max_value !== null ? sparklineStyle.max_value : Math.max(...values);
      const valueRange = maxValue - minValue || 1;

      sparklineStyle.thresholds.forEach((threshold, index) => {
        const thresholdLine = thresholdGroup.children[index];
        if (thresholdLine) {
          const y = bounds.height - ((threshold.value - minValue) / valueRange) * bounds.height;
          thresholdLine.setAttribute('y1', y);
          thresholdLine.setAttribute('y2', y);
        }
      });
    }

    // Update zero line if it exists and data range changed
    const zeroLineElement = sparklineElement.querySelector('line[data-feature="zero-line"]');
    if (zeroLineElement && sparklineStyle.zero_line) {
      const values = historicalData.map(d => d.value);
      const minValue = sparklineStyle.min_value !== null ? sparklineStyle.min_value : Math.min(...values);
      const maxValue = sparklineStyle.max_value !== null ? sparklineStyle.max_value : Math.max(...values);

      if (minValue <= 0 && maxValue >= 0) {
        const valueRange = maxValue - minValue || 1;
        const zeroY = bounds.height - ((0 - minValue) / valueRange) * bounds.height;
        zeroLineElement.setAttribute('y1', zeroY);
        zeroLineElement.setAttribute('y2', zeroY);
        zeroLineElement.style.display = '';
      } else {
        zeroLineElement.style.display = 'none';
      }
    }
  }

  /**
   * Extract historical data from various source data formats
   * @private
   */
  _upgradeStatusIndicatorToSparkline(sparklineElement, overlay, sourceData) {
    const historicalData = this._extractHistoricalData(sourceData);

    if (historicalData.length > 1) {
      const size = overlay.size || [200, 60];
      const [width, height] = size;
      const style = overlay.finalStyle || overlay.style || {};
      const sparklineStyle = this._resolveSparklineStyles(style, overlay.id);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      // Generate complete enhanced sparkline with ALL features
      const svgParts = [
        this._buildDefinitions(sparklineStyle, overlay.id),
        this._buildSparklineBackground(width, height, sparklineStyle, overlay.id),
        this._buildGridLines(width, height, sparklineStyle, overlay.id),
        this._buildThresholdLines(historicalData, width, height, sparklineStyle, overlay.id),
        this._buildZeroLine(historicalData, width, height, sparklineStyle, overlay.id),
        this._buildAreaFill(historicalData, width, height, sparklineStyle, overlay.id),
        this._buildMainSparklinePath(historicalData, width, height, sparklineStyle, overlay.id, animationAttributes),
        this._buildDataPoints(historicalData, width, height, sparklineStyle, overlay.id),
        this._buildValueLabel(historicalData, width, height, sparklineStyle, overlay.id),
        this._buildBrackets(width, height, sparklineStyle, overlay.id),
        this._buildStatusIndicator(width, height, sparklineStyle, overlay.id),
        this._buildScanLine(width, height, sparklineStyle, overlay.id)
      ].filter(Boolean);

      // Replace entire innerHTML with complete sparkline content
      sparklineElement.innerHTML = svgParts.join('\n');

      sparklineElement.removeAttribute('data-status');
      sparklineElement.setAttribute('data-last-update', Date.now());
      sparklineElement.setAttribute('data-sparkline-features', sparklineStyle.features.join(','));

      cblcarsLog.debug(`[SparklineRenderer] ✅ Upgraded status indicator ${overlay.id} to full sparkline with ${sparklineStyle.features.length} features and ${historicalData.length} data points`);
    } else {
      sparklineElement.setAttribute('data-status', historicalData.length === 0 ? 'NO_DATA' : 'INSUFFICIENT_DATA');
    }
  }

  /**
   * Extract historical data from various source data formats
   * @private
   */
  _extractHistoricalData(sourceData) {
    let historicalData = [];

    // Method 1: Use buffer data directly
    if (sourceData.buffer && typeof sourceData.buffer.getAll === 'function') {
      const bufferData = sourceData.buffer.getAll();
      historicalData = bufferData.map(point => ({
        timestamp: point.t,
        value: point.v
      }));
      cblcarsLog.debug('[SparklineRenderer] Using buffer data:', historicalData.length, 'points');
    }
    // Method 2: Use pre-formatted historical data
    else if (sourceData.historicalData && Array.isArray(sourceData.historicalData)) {
      historicalData = sourceData.historicalData;
      cblcarsLog.debug('[SparklineRenderer] Using pre-formatted historical data:', historicalData.length, 'points');
    }

    return historicalData;
  }

  /**
   * Compute attachment points for sparkline overlay
   * @param {Object} overlay - Sparkline overlay configuration
   * @param {Object} anchors - Available anchors
   * @param {Element} container - Container element for measurements
   * @returns {Object|null} Attachment points object
   * @static
   */
  static computeAttachmentPoints(overlay, anchors, container) {
    // Set default size for SparklineRenderer
    if (!overlay.size) overlay.size = [200, 60];

    const attachmentPoints = OverlayUtils.computeAttachmentPoints(overlay, anchors);

    if (!attachmentPoints) {
      cblcarsLog.debug(`[SparklineRenderer] Cannot compute attachment points for ${overlay.id}: missing position or size`);
      return null;
    }

    // Add aliases for common naming conventions
    attachmentPoints.points['top-left'] = attachmentPoints.points.topLeft;
    attachmentPoints.points['top-right'] = attachmentPoints.points.topRight;
    attachmentPoints.points['bottom-left'] = attachmentPoints.points.bottomLeft;
    attachmentPoints.points['bottom-right'] = attachmentPoints.points.bottomRight;

    return attachmentPoints;
  }

  /**
   * Get rendering capabilities and features supported
   * @public
   */
  getCapabilities() {
    return {
      pathSmoothing: ['none', 'constrained', 'chaikin', 'bezier', 'spline', 'stepped'],
      dataVisualization: ['points', 'thresholds', 'zero-line', 'value-labels'],
      styling: ['gradients', 'patterns', 'area-fill', 'dash-patterns'],
      effects: ['glow', 'shadow', 'blur'],
      lcarsFeatures: ['brackets', 'status-indicator', 'scan-line', 'grid-lines'],
      animations: ['tracer', 'pulse'], // Future implementation
      performance: ['decimation', 'max-points', 'viewport-optimization'],
      advanced: true
    };
  }

  // === DEBUG METHODS (PRESERVED FROM ORIGINAL) ===

  /**
   * Parse DataSource reference to support enhanced data access
   * @param {string} dataSourceRef - Reference like 'source_name' or 'source_name.transformations.key'
   * @returns {Object} Parsed reference details
   */
  static parseDataSourceReference(dataSourceRef) {
    const parts = dataSourceRef.split('.');
    const sourceName = parts[0];

    if (parts.length === 1) {
      // Simple source reference
      return {
        sourceName,
        dataKey: null,
        isTransformation: false,
        isAggregation: false
      };
    }

    if (parts.length >= 3) {
      // Enhanced reference: source.transformations.key or source.aggregations.key
      const dataType = parts[1];
      const dataKey = parts.slice(2).join('.');

      return {
        sourceName,
        dataKey,
        isTransformation: dataType === 'transformations',
        isAggregation: dataType === 'aggregations'
      };
    }

    // Fallback for malformed references
    return {
      sourceName,
      dataKey: null,
      isTransformation: false,
      isAggregation: false
    };
  }

  /**
   * Get enhanced DataSource data (transformations/aggregations) for sparklines
   * @param {Object} currentData - Current data from DataSource
   * @param {string} dataKey - Key for transformation or aggregation
   * @param {boolean} isTransformation - Whether accessing transformation data
   * @param {boolean} isAggregation - Whether accessing aggregation data
   * @param {string} sourceName - Source name for logging
   * @returns {Object} Data result for sparkline rendering
   */
  static getEnhancedDataSourceData(currentData, dataKey, isTransformation, isAggregation, sourceName) {
    try {
      let enhancedValue = null;
      let dataType = 'unknown';

      if (isTransformation && currentData.transformations) {
        enhancedValue = currentData.transformations[dataKey];
        dataType = 'transformation';
        cblcarsLog.debug(`[SparklineRenderer] 🔄 Accessing transformation '${dataKey}':`, enhancedValue);
      } else if (isAggregation && currentData.aggregations) {
        const aggregationData = currentData.aggregations[dataKey];
        dataType = 'aggregation';

        // Handle different aggregation result types
        if (typeof aggregationData === 'object' && aggregationData !== null) {
          // Complex aggregation (e.g., min/max/avg object, trend object)
          if (aggregationData.avg !== undefined) {
            enhancedValue = aggregationData.avg;
          } else if (aggregationData.value !== undefined) {
            enhancedValue = aggregationData.value;
          } else if (aggregationData.slope !== undefined) {
            enhancedValue = aggregationData.slope;
          } else {
            // Use the whole object - sparkline might handle it
            enhancedValue = aggregationData;
          }
        } else {
          // Simple aggregation value
          enhancedValue = aggregationData;
        }

        cblcarsLog.debug(`[SparklineRenderer] 📊 Accessing aggregation '${dataKey}':`, aggregationData, '-> value:', enhancedValue);
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

      // For single values, we no longer generate synthetic data
      // If there's no historical data, sparkline will show status indicator
      return {
        data: null,
        status: 'ENHANCED_DATA_NOT_HISTORIC',
        message: `${dataType} '${dataKey}' is a single value, no historical data available`,
        metadata: { sourceName, dataKey, dataType, value: enhancedValue }
      };

      // For complex objects, try to extract meaningful data
      if (typeof enhancedValue === 'object') {
        // Complex objects are not supported for sparkline historical data
        return {
          data: null,
          status: 'ENHANCED_OBJECT_NOT_SUPPORTED',
          message: `${dataType} '${dataKey}' is a complex object, no historical data available`,
          metadata: { sourceName, dataKey, dataType, objectKeys: Object.keys(enhancedValue) }
        };
      }

      // Fallback for non-numeric data
      return {
        data: null,
        status: 'ENHANCED_DATA_NOT_NUMERIC',
        message: `${dataType} '${dataKey}' is not numeric: ${typeof enhancedValue}`,
        metadata: { sourceName, dataKey, dataType, value: enhancedValue }
      };

    } catch (error) {
      cblcarsLog.error(`[SparklineRenderer] Error accessing enhanced data:`, error);
      return {
        data: null,
        status: 'ENHANCED_DATA_ERROR',
        message: `Error accessing ${isTransformation ? 'transformation' : 'aggregation'} '${dataKey}': ${error.message}`,
        metadata: { sourceName, dataKey, error: error.message }
      };
    }
  }

  /*
  static debugSparklineUpdates() {
    cblcarsLog.debug('🔍 Enhanced Sparkline Update Debug Report');
    const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
    if (dsm) {
      const stats = dsm.getStats();
      cblcarsLog.debug('DataSourceManager stats:', stats);
    } else {
      cblcarsLog.warn('DataSourceManager not accessible via debug interface');
    }
  }

  static debugDataSource(dataSourceName) {
    cblcarsLog.debug(`🔍 Enhanced Debugging data source: ${dataSourceName}`);
    const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
    if (!dsm) {
      cblcarsLog.error('❌ DataSourceManager not available');
      return;
    }

    const source = dsm.getSource(dataSourceName);
    if (!source) {
      cblcarsLog.error(`❌ Source '${dataSourceName}' not found`);
      cblcarsLog.debug('Available sources:', Array.from(dsm.sources.keys()));
      return;
    }

    return { source };
  }
  */
}

// Expose SparklineRenderer to window for console debugging
//if (typeof window !== 'undefined') {
//  window.SparklineRenderer = SparklineRenderer;
//}