/**
 * Enhanced Sparkline Renderer - Advanced sparkline rendering with comprehensive styling support
 * Provides rich sparkline styling features similar to LineOverlayRenderer and TextOverlayRenderer
 */

import { PositionResolver } from './PositionResolver.js';
import { RendererUtils } from './RendererUtils.js';

export class SparklineRenderer {
  constructor() {
    // Pre-defined caches for performance optimization
    this.gradientCache = new Map();
    this.patternCache = new Map();
    this.filterCache = new Map();
    this.pathCache = new Map();
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

    const position = PositionResolver.resolvePosition(overlay.position, anchors);
    if (!position) {
      console.warn('[SparklineRenderer] Sparkline overlay position could not be resolved:', overlay.id);
      return '';
    }

    const [x, y] = position;
    const size = overlay.size || [200, 60];
    const [width, height] = size;

    try {
      // Get data from source
      const dataResult = SparklineRenderer.getHistoricalDataForSparkline(overlay.source);
      // Extract comprehensive styling
      const style = overlay.finalStyle || overlay.style || {};
      const sparklineStyle = this._resolveSparklineStyles(style, overlay.id);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      console.log(`[SparklineRenderer] Data result for ${overlay.id}:`, dataResult.status, dataResult.data?.length);

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
      console.error(`[SparklineRenderer] Enhanced rendering failed for sparkline ${overlay.id}:`, error);
      return this._renderFallbackSparkline(overlay, x, y, width, height);
    }
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
      status_indicator: style.status_indicator || style.statusIndicator || false,
      scan_line: style.scan_line || style.scanLine || false,
      grid_lines: style.grid_lines || style.gridLines || false,

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

    console.log(`[SparklineRenderer] Rendered enhanced sparkline ${overlay.id} with ${sparklineStyle.features.length} features`);

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

    const gridColor = 'var(--lcars-gray)';
    const gridOpacity = 0.2;
    const horizontalLines = 3;
    const verticalLines = 5;

    const lines = [];

    // Horizontal grid lines
    for (let i = 1; i < horizontalLines; i++) {
      const y = (height / horizontalLines) * i;
      lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}"
                        stroke="${gridColor}" stroke-width="0.5" opacity="${gridOpacity}"/>`);
    }

    // Vertical grid lines
    for (let i = 1; i < verticalLines; i++) {
      const x = (width / verticalLines) * i;
      lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}"
                        stroke="${gridColor}" stroke-width="0.5" opacity="${gridOpacity}"/>`);
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
                  font-family="var(--lcars-font-family, monospace)"
                  data-feature="value-label">
              ${formattedValue}
            </text>`;
  }

  /**
   * Build LCARS-style brackets
   * @private
   */
  _buildBrackets(width, height, sparklineStyle, overlayId) {
    if (!sparklineStyle.bracket_style) return '';

    const bracketWidth = 6;
    const bracketHeight = height;
    const color = sparklineStyle.color;
    const strokeWidth = Math.max(1, sparklineStyle.width * 0.5);

    return `<g data-feature="brackets">
              <path d="M ${-bracketWidth - 2} 0 L ${-2} 0 L ${-2} ${bracketHeight} L ${-bracketWidth - 2} ${bracketHeight}"
                    stroke="${color}" stroke-width="${strokeWidth}" fill="none"/>
              <path d="M ${width + 2} 0 L ${width + bracketWidth + 2} 0 L ${width + bracketWidth + 2} ${bracketHeight} L ${width + 2} ${bracketHeight}"
                    stroke="${color}" stroke-width="${strokeWidth}" fill="none"/>
            </g>`;
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

    // Apply smoothing based on mode
    switch (sparklineStyle.smoothing_mode) {
      case 'chaikin':
        return this._createChaikinPath(points, sparklineStyle.path_precision);
      case 'bezier':
        return this._createBezierPath(points, sparklineStyle.path_precision);
      case 'spline':
        return this._createSplinePath(points, sparklineStyle.path_precision);
      case 'stepped':
        return this._createSteppedPath(points, sparklineStyle.path_precision);
      default:
        return this._createLinearPath(points, sparklineStyle.path_precision);
    }
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
   * Create Chaikin smoothed path
   * @private
   */
  _createChaikinPath(points, precision) {
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

    return this._createLinearPath(smoothedPoints, precision);
  }

  /**
   * Create Bezier curved path
   * @private
   */
  _createBezierPath(points, precision) {
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
   * Create spline path
   * @private
   */
  _createSplinePath(points, precision) {
    if (points.length < 4) return this._createBezierPath(points, precision);

    const pathSegments = [`M ${points[0].x.toFixed(precision)} ${points[0].y.toFixed(precision)}`];

    for (let i = 1; i < points.length - 2; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2];

      // Catmull-Rom spline control points
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      pathSegments.push(`C ${cp1x.toFixed(precision)} ${cp1y.toFixed(precision)} ${cp2x.toFixed(precision)} ${cp2y.toFixed(precision)} ${p2.x.toFixed(precision)} ${p2.y.toFixed(precision)}`);
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
             font-family="var(--lcars-font-family, monospace)"
             font-size="${fontSize}" font-weight="bold">
        ${indicatorText}
       </text>`,
      width > 120 ? `<text x="${width / 2}" y="${height / 2 + fontSize + 4}"
                           fill="${indicatorColor}" text-anchor="middle" dominant-baseline="middle"
                           font-family="var(--lcars-font-family, monospace)"
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

    console.warn(`[SparklineRenderer] Using fallback rendering for sparkline ${overlay.id}`);

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
   * Get historical data with multiple fallback strategies
   * @param {string} dataSourceName - Name of the data source
   * @returns {Object} {data: Array|null, status: string, message: string}
   */
  static getHistoricalDataForSparkline(dataSourceName) {
    if (!dataSourceName) {
      return {
        data: null,
        status: 'NO_SOURCE',
        message: 'No data source specified'
      };
    }

    try {
      // Try the real DataSourceManager through the pipeline
      const dataSourceManager = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

      if (dataSourceManager) {
        console.log(`[SparklineRenderer] 🔍 Checking DataSourceManager for '${dataSourceName}'`);

        // Use exact source name only
        const dataSource = dataSourceManager.getSource(dataSourceName);

        if (dataSource) {
          const currentData = dataSource.getCurrentData();
          console.log(`[SparklineRenderer] Source data for '${dataSourceName}':`, {
            bufferSize: currentData?.bufferSize || 0,
            historyReady: currentData?.historyReady,
            started: currentData?.started,
            historyLoaded: currentData?.stats?.historyLoaded || 0
          });

          if (currentData?.buffer) {
            const bufferData = currentData.buffer.getAll();
            console.log(`[SparklineRenderer] Raw buffer data for '${dataSourceName}':`, bufferData);

            if (bufferData && bufferData.length >= 2) {
              const historicalData = bufferData.map(point => ({
                timestamp: point.t,
                value: point.v
              }));

              console.log(`[SparklineRenderer] ✅ Found ${historicalData.length} data points for '${dataSourceName}'`);
              return {
                data: historicalData,
                status: 'OK',
                message: `${historicalData.length} data points`
              };
            } else if (bufferData && bufferData.length === 1) {
              console.log(`[SparklineRenderer] ⚠️ Only 1 data point available for '${dataSourceName}'`);
              return {
                data: null,
                status: 'INSUFFICIENT_DATA',
                message: 'Only 1 data point available (need 2+ for sparkline)'
              };
            } else {
              console.log(`[SparklineRenderer] ⚠️ Buffer exists but is empty for '${dataSourceName}'`);
              return {
                data: null,
                status: 'EMPTY_BUFFER',
                message: 'Buffer exists but contains no data'
              };
            }
          }

          // Data source exists but no buffer data
          console.log(`[SparklineRenderer] ⚠️ Data source '${dataSourceName}' found but no buffer`);
          return {
            data: null,
            status: 'NO_BUFFER',
            message: 'Data source found but no buffer available'
          };
        }

        // Data source not found in manager
        const availableSources = Array.from(dataSourceManager.sources.keys());
        console.warn(`[SparklineRenderer] ❌ Source '${dataSourceName}' not found in DataSourceManager`);
        return {
          data: null,
          status: 'SOURCE_NOT_FOUND',
          message: `Source '${dataSourceName}' not found. Available: ${availableSources.join(', ')}`
        };
      }

      // DataSourceManager not available
      return {
        data: null,
        status: 'MANAGER_NOT_AVAILABLE',
        message: 'DataSourceManager not available'
      };

    } catch (error) {
      console.error(`[SparklineRenderer] Error getting data for '${dataSourceName}':`, error);
      return {
        data: null,
        status: 'ERROR',
        message: `Error occurred: ${error.message}`
      };
    }
  }

  /**
   * Update sparkline data dynamically when data source changes
   * @param {Element} sparklineElement - The sparkline SVG element
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - New data from the data source
   */
  static updateSparklineData(sparklineElement, overlay, sourceData) {
    console.log(`[SparklineRenderer] updateSparklineData called for ${overlay.id}:`, {
      hasBuffer: !!(sourceData?.buffer),
      bufferSize: sourceData?.buffer?.size?.() || 0,
      currentStatus: sparklineElement.getAttribute('data-status'),
      elementFound: !!sparklineElement,
      currentValue: sourceData?.v
    });

    if (!sparklineElement || !overlay || !sourceData) {
      console.warn('[SparklineRenderer] updateSparklineData: Missing required parameters');
      return;
    }

    // Create instance for update operations
    const instance = new SparklineRenderer();
    instance._updateSparklineElement(sparklineElement, overlay, sourceData);
  }


  /**
   * Instance method to update sparkline element
   * @private
   */
  _updateSparklineElement(sparklineElement, overlay, sourceData) {
    // Check if this is a status indicator that needs to be upgraded to a real sparkline
    const currentStatus = sparklineElement.getAttribute('data-status');
    const isStatusIndicator = currentStatus !== null;

    if (isStatusIndicator && (sourceData.buffer || sourceData.historicalData)) {
      console.log(`[SparklineRenderer] Upgrading status indicator ${overlay.id} to real sparkline`);
      this._upgradeStatusIndicatorToSparkline(sparklineElement, overlay, sourceData);
      return;
    }

    // ENHANCED: Find the path element with better legacy compatibility
    let pathElement = sparklineElement.querySelector('path[data-feature="main-path"]');
    if (!pathElement) {
      // Fall back to any path element for backward compatibility
      pathElement = sparklineElement.querySelector('path');

      // LEGACY COMPATIBILITY: Add the data-feature attribute to legacy paths
      if (pathElement && !pathElement.getAttribute('data-feature')) {
        console.log(`[SparklineRenderer] Adding data-feature="main-path" to legacy path for ${overlay.id}`);
        pathElement.setAttribute('data-feature', 'main-path');
      }
    }

    if (!pathElement) {
      console.warn(`[SparklineRenderer] No path element found for ${overlay.id} - might still be a status indicator or need full re-render`);

      // Try to re-render the entire sparkline if we have data
      const historicalData = this._extractHistoricalData(sourceData);
      if (historicalData.length > 1) {
        console.log(`[SparklineRenderer] Attempting full re-render of ${overlay.id}`);
        this._upgradeStatusIndicatorToSparkline(sparklineElement, overlay, sourceData);
      }
      return;
    }

    try {
      // Extract dimensions from overlay config
      const bounds = {
        width: overlay.size?.[0] || 200,
        height: overlay.size?.[1] || 60
      };

      // Convert source data to sparkline format
      const historicalData = this._extractHistoricalData(sourceData);

      if (historicalData.length > 1) {
        // Re-resolve styles for consistency
        const style = overlay.finalStyle || overlay.style || {};
        const sparklineStyle = this._resolveSparklineStyles(style, overlay.id);

        // Generate new path
        const processedData = this._processDataForRendering(historicalData, sparklineStyle);
        const newPathData = this._createSparklinePath(processedData, bounds, sparklineStyle);

        pathElement.setAttribute('d', newPathData);

        // Update status attributes
        sparklineElement.removeAttribute('data-status');
        sparklineElement.setAttribute('data-last-update', Date.now());

        console.log(`[SparklineRenderer] ✅ Updated sparkline ${overlay.id} with ${historicalData.length} points`);
      } else {
        console.warn(`[SparklineRenderer] Insufficient data for sparkline ${overlay.id}: ${historicalData.length} points`);
        sparklineElement.setAttribute('data-status', historicalData.length === 0 ? 'NO_DATA' : 'INSUFFICIENT_DATA');
      }

    } catch (error) {
      console.error(`[SparklineRenderer] Error updating sparkline ${overlay.id}:`, error);
      sparklineElement.setAttribute('data-status', 'ERROR');
    }
  }




  /**
   * Instance method to update sparkline element
   * @private
   */
  _updateSparklineElement2(sparklineElement, overlay, sourceData) {
    // Check if this is a status indicator that needs to be upgraded to a real sparkline
    const currentStatus = sparklineElement.getAttribute('data-status');
    const isStatusIndicator = currentStatus !== null;

    if (isStatusIndicator && (sourceData.buffer || sourceData.historicalData)) {
      console.log(`[SparklineRenderer] Upgrading status indicator ${overlay.id} to real sparkline`);
      this._upgradeStatusIndicatorToSparkline(sparklineElement, overlay, sourceData);
      return;
    }

    // Find the path element to update - try enhanced version first, then fall back to old version
    let pathElement = sparklineElement.querySelector('path[data-feature="main-path"]');
    if (!pathElement) {
      // Fall back to any path element for backward compatibility
      pathElement = sparklineElement.querySelector('path');
    }

    if (!pathElement) {
      console.warn(`[SparklineRenderer] No path element found for ${overlay.id} - might still be a status indicator or need full re-render`);

      // Try to re-render the entire sparkline if we have data
      const historicalData = this._extractHistoricalData(sourceData);
      if (historicalData.length > 1) {
        console.log(`[SparklineRenderer] Attempting full re-render of ${overlay.id}`);
        this._upgradeStatusIndicatorToSparkline(sparklineElement, overlay, sourceData);
      }
      return;
    }

    try {
      // Extract dimensions from overlay config
      const bounds = {
        width: overlay.size?.[0] || 200,
        height: overlay.size?.[1] || 60
      };

      // Convert source data to sparkline format
      const historicalData = this._extractHistoricalData(sourceData);

      if (historicalData.length > 1) {
        // Re-resolve styles for consistency
        const style = overlay.finalStyle || overlay.style || {};
        const sparklineStyle = this._resolveSparklineStyles(style, overlay.id);

        // Generate new path
        const processedData = this._processDataForRendering(historicalData, sparklineStyle);
        const newPathData = this._createSparklinePath(processedData, bounds, sparklineStyle);

        pathElement.setAttribute('d', newPathData);

        // Update status attributes
        sparklineElement.removeAttribute('data-status');
        sparklineElement.setAttribute('data-last-update', Date.now());

        console.log(`[SparklineRenderer] ✅ Updated sparkline ${overlay.id} with ${historicalData.length} points`);
      } else {
        console.warn(`[SparklineRenderer] Insufficient data for sparkline ${overlay.id}: ${historicalData.length} points`);
        sparklineElement.setAttribute('data-status', historicalData.length === 0 ? 'NO_DATA' : 'INSUFFICIENT_DATA');
      }

    } catch (error) {
      console.error(`[SparklineRenderer] Error updating sparkline ${overlay.id}:`, error);
      sparklineElement.setAttribute('data-status', 'ERROR');
    }
  }

  /**
   * Upgrade a status indicator to a real sparkline
   * @private
   */
  _upgradeStatusIndicatorToSparkline(sparklineElement, overlay, sourceData) {
    console.log(`[SparklineRenderer] Upgrading status indicator ${overlay.id} to real sparkline`);

    // Get historical data
    const historicalData = this._extractHistoricalData(sourceData);

    if (historicalData.length > 1) {
      // Re-render the entire sparkline with new data
      const position = [0, 0]; // Relative to existing transform
      const size = overlay.size || [200, 60];
      const [width, height] = size;

      // Re-resolve styles
      const style = overlay.finalStyle || overlay.style || {};
      const sparklineStyle = this._resolveSparklineStyles(style, overlay.id);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      // Generate new content
      const newContent = this._renderEnhancedSparkline(
        overlay, 0, 0, width, height, historicalData,
        sparklineStyle, animationAttributes
      );

      // Replace the inner content (preserve the outer g element and its attributes)
      const transformGroup = sparklineElement.querySelector('g[transform]');
      if (transformGroup) {
        // Extract the inner content from the new render
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newContent;
        const newTransformGroup = tempDiv.querySelector('g[transform]');

        if (newTransformGroup) {
          transformGroup.innerHTML = newTransformGroup.innerHTML;
        }
      }

      // Update element attributes
      sparklineElement.removeAttribute('data-status');
      sparklineElement.setAttribute('data-last-update', Date.now());
      sparklineElement.setAttribute('data-sparkline-features', sparklineStyle.features.join(','));

      console.log(`[SparklineRenderer] ✅ Upgraded status indicator ${overlay.id} to sparkline with ${historicalData.length} data points`);
    } else {
      console.warn(`[SparklineRenderer] Cannot upgrade ${overlay.id} - insufficient data: ${historicalData.length} points`);
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
      console.log('[SparklineRenderer] Using buffer data:', historicalData.length, 'points');
    }
    // Method 2: Use pre-formatted historical data
    else if (sourceData.historicalData && Array.isArray(sourceData.historicalData)) {
      historicalData = sourceData.historicalData;
      console.log('[SparklineRenderer] Using pre-formatted historical data:', historicalData.length, 'points');
    }
    // Method 3: Generate from single current value (fallback for testing)
    else if (sourceData.v !== undefined && sourceData.t !== undefined) {
      console.log('[SparklineRenderer] Generating demo data from current value:', sourceData.v);
      const now = Date.now();
      for (let i = 0; i < 20; i++) {
        historicalData.push({
          timestamp: now - (19 - i) * 60000,
          value: sourceData.v + (Math.random() - 0.5) * (sourceData.v * 0.1)
        });
      }
    }

    return historicalData;
  }

  /**
   * Get rendering capabilities and features supported
   * @public
   */
  getCapabilities() {
    return {
      pathSmoothing: ['none', 'chaikin', 'bezier', 'spline', 'stepped'],
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

  static debugSparklineUpdates() {
    console.log('🔍 Enhanced Sparkline Update Debug Report');
    console.log('==========================================');

    const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
    if (dsm) {
      const stats = dsm.getStats();
      console.log('DataSourceManager stats:', stats);
    } else {
      console.warn('DataSourceManager not accessible via debug interface');
    }
  }

  static debugDataSource(dataSourceName) {
    console.log(`🔍 Enhanced Debugging data source: ${dataSourceName}`);
    console.log('====================================================');

    const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
    if (!dsm) {
      console.error('❌ DataSourceManager not available');
      return;
    }

    const source = dsm.getSource(dataSourceName);
    if (!source) {
      console.error(`❌ Source '${dataSourceName}' not found`);
      console.log('Available sources:', Array.from(dsm.sources.keys()));
      return;
    }

    // Detailed analysis as before...
    return { source };
  }
}

// Expose SparklineRenderer to window for console debugging
if (typeof window !== 'undefined') {
  window.SparklineRenderer = SparklineRenderer;
}