/**
 * [SparklineRenderer] Core sparkline rendering - pure SVG chart generation
 * 📊 Handles sparkline path generation, styling, and effects WITHOUT MSD system dependencies
 *
 * Responsibilities:
 * - SVG path generation from data points
 * - Chart scaling and coordinate transformation
 * - Gradient fills and threshold lines
 * - Area fills and stroke styling
 * - Chart measurement and bounds calculation
 *
 * Does NOT handle:
 * - DataSource integration
 * - Action attachment
 * - MSD positioning/anchors
 * - Animation coordination
 */

import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';
import { BracketRenderer } from '../BracketRenderer.js';

export class SparklineRenderer {
  /**
   * Render sparkline SVG markup from data points
   * @param {Object} config - Sparkline configuration
   *   @param {Array} config.data - Array of numeric data points
   *   @param {Array} config.position - [x, y] position
   *   @param {Array} config.size - [width, height] dimensions
   * @param {Object} style - Resolved sparkline styling
   * @param {Object} context - Rendering context
   *   @param {Array} context.viewBox - SVG viewBox for scaling
   *   @param {Element} context.container - Container element for measurements
   *   @param {string} context.overlayId - Unique ID for definitions
   * @returns {Object} {markup, metadata}
   */
  static render(config, style, context = {}) {
    const { data, position, size } = config;
    const { viewBox, container, overlayId = 'sparkline' } = context;

    if (!data || !Array.isArray(data) || data.length === 0) {
      cblcarsLog.warn('[SparklineRenderer] Missing or empty data array');
      return { markup: '', metadata: null };
    }

    if (!position || !size) {
      cblcarsLog.warn('[SparklineRenderer] Missing position or size');
      return { markup: '', metadata: null };
    }

    const [x, y] = position;
    const [width, height] = size;

    try {
      // Calculate data bounds and scaling
      const dataBounds = this._calculateDataBounds(data, style);
      const scalingInfo = this._calculateScaling(data, width, height, dataBounds, style);

      // Build SVG components
      const defs = this._buildDefinitions(style, overlayId);
      const path = this._buildSparklinePath(data, scalingInfo, style);
      const thresholds = this._buildThresholdLines(scalingInfo, style);
      const decorations = this._buildDecorations(scalingInfo, style);

      // Build metadata for attachment points
      const metadata = this._buildMetadata(x, y, width, height, dataBounds, data);

      // Wrap in group with transform
      const markup = `<g transform="translate(${x}, ${y})">
        ${defs}
        ${path}
        ${thresholds}
        ${decorations}
      </g>`;

      return { markup, metadata };

    } catch (error) {
      cblcarsLog.error(`[SparklineRenderer] Rendering failed:`, error);
      return this._renderFallback(x, y, width, height, style);
    }
  }

  /**
   * Build SVG definitions for gradients, patterns, and effects
   * @private
   */
  static _buildDefinitions(style, overlayId) {
    const defs = [];

    if (style.gradient) {
      defs.push(this._createGradientDef(style.gradient, overlayId));
    }

    if (style.fill_gradient) {
      defs.push(this._createGradientDef(style.fill_gradient, `${overlayId}-area`));
    }

    return defs.length > 0 ? `<defs>${defs.join('\n')}</defs>` : '';
  }

  /**
   * Calculate data bounds (min, max, range)
   * @private
   */
  static _calculateDataBounds(data, style) {
    const numericData = data.filter(v => typeof v === 'number' && !isNaN(v));

    if (numericData.length === 0) {
      return { min: 0, max: 100, range: 100 };
    }

    let min = Math.min(...numericData);
    let max = Math.max(...numericData);

    // Apply custom min/max if specified
    if (style.min !== undefined && style.min !== null) min = Number(style.min);
    if (style.max !== undefined && style.max !== null) max = Number(style.max);

    // Ensure we have a valid range
    const range = max - min || 1;

    return { min, max, range };
  }

  /**
   * Calculate scaling information for data points
   * @private
   */
  static _calculateScaling(data, width, height, dataBounds, style) {
    const { min, max, range } = dataBounds;
    const padding = style.padding || 0;

    const chartWidth = width - (padding * 2);
    const chartHeight = height - (padding * 2);
    const stepX = chartWidth / (data.length - 1 || 1);

    return {
      width: chartWidth,
      height: chartHeight,
      stepX,
      padding,
      min,
      max,
      range,
      // Helper to convert data value to Y coordinate
      valueToY: (value) => {
        const normalizedValue = (value - min) / range;
        return chartHeight - (normalizedValue * chartHeight) + padding;
      },
      // Helper to convert index to X coordinate
      indexToX: (index) => {
        return (index * stepX) + padding;
      }
    };
  }

  /**
   * Build sparkline path (line and optional area fill)
   * @private
   */
  static _buildSparklinePath(data, scaling, style) {
    const parts = [];

    // Grid lines (if enabled) - render BEFORE path so they're underneath
    if (style.grid_lines) {
      parts.push(this._buildGridLines(scaling, style));
    }

    // Zero line (if enabled and applicable)
    if (style.zero_line) {
      parts.push(this._buildZeroLine(scaling, style));
    }

    // Generate path points with smoothing
    const pathPoints = this._generatePathPoints(data, scaling, style);

    if (!pathPoints || pathPoints.length === 0) {
      return parts.join('\n');
    }

    // Area fill (if enabled)
    if (style.fill !== 'none' || style.fill_gradient) {
      const areaPath = this._buildAreaPath(pathPoints, scaling, style);
      if (areaPath) parts.push(areaPath);
    }

    // Line stroke
    const linePath = pathPoints.join(' ');
    const strokeColor = style.color || style.stroke || 'var(--lcars-orange)';
    const strokeWidth = style.width || style.strokeWidth || 2;
    const strokeOpacity = style.opacity || 1;

    parts.push(`<path d="${linePath}"
                     fill="none"
                     stroke="${strokeColor}"
                     stroke-width="${strokeWidth}"
                     stroke-opacity="${strokeOpacity}"
                     stroke-linecap="round"
                     stroke-linejoin="round"
                     data-sparkline-line="true"/>`);

    // Data points (if enabled) - render AFTER path so they're on top
    if (style.show_points) {
      parts.push(this._buildDataPoints(data, scaling, style));
    }

    // Value label (if enabled)
    if (style.show_last_value && data.length > 0) {
      parts.push(this._buildValueLabel(data, scaling, style));
    }

    // Brackets (if enabled)
    if (style.bracket_style) {
      parts.push(this._buildBrackets(scaling, style));
    }

    return parts.join('\n');
  }

  /**
   * Generate path points with optional smoothing
   * @private
   */
  static _generatePathPoints(data, scaling, style) {
    const points = [];

    // Generate base points
    data.forEach((value, index) => {
      if (typeof value !== 'number' || isNaN(value)) return;

      const px = scaling.indexToX(index);
      const py = scaling.valueToY(value);

      points.push({ x: px, y: py, value, index });
    });

    if (points.length < 2) return [`M 0 ${scaling.height / 2} L ${scaling.width} ${scaling.height / 2}`];

    // Apply smoothing based on mode
    const smoothingMode = (style.smoothing_mode || 'none').toLowerCase();

    switch (smoothingMode) {
      case 'constrained':
        return this._createConstrainedPath(points, style);
      case 'chaikin':
        return this._createChaikinPath(points, style);
      case 'bezier':
        return this._createBezierPath(points, style);
      case 'spline':
        return this._createSplinePath(points, style);
      case 'stepped':
        return this._createSteppedPath(points, style);
      default:
        return this._createLinearPath(points, style);
    }
  }

  /**
   * Create linear path (default)
   * @private
   */
  static _createLinearPath(points, style) {
    const precision = style.path_precision || 2;
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

    return pathSegments;
  }

  /**
   * Create stepped path
   * @private
   */
  static _createSteppedPath(points, style) {
    const precision = style.path_precision || 2;
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

    return pathSegments;
  }

  /**
   * Create constrained smooth path (passes through all points)
   * @private
   */
  static _createConstrainedPath(points, style) {
    const precision = style.path_precision || 2;
    const pathSegments = [];

    pathSegments.push(`M ${points[0].x.toFixed(precision)} ${points[0].y.toFixed(precision)}`);

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];

      let cp1x, cp1y, cp2x, cp2y;

      if (i === 0) {
        const next2 = points[i + 2] || next;
        cp1x = current.x + (next.x - current.x) * 0.3;
        cp1y = current.y + (next.y - current.y) * 0.2;
        cp2x = next.x - (next2.x - current.x) * 0.2;
        cp2y = next.y - (next2.y - current.y) * 0.1;
      } else if (i === points.length - 2) {
        const prev = points[i - 1];
        cp1x = current.x + (next.x - prev.x) * 0.2;
        cp1y = current.y + (next.y - prev.y) * 0.1;
        cp2x = next.x - (next.x - current.x) * 0.3;
        cp2y = next.y - (next.y - current.y) * 0.2;
      } else {
        const prev = points[i - 1];
        const next2 = points[i + 2];

        cp1x = current.x + (next.x - prev.x) * 0.25;
        cp1y = current.y + (next.y - prev.y) * 0.15;
        cp2x = next.x - (next2.x - current.x) * 0.25;
        cp2y = next.y - (next2.y - current.y) * 0.15;
      }

      pathSegments.push(`C ${cp1x.toFixed(precision)} ${cp1y.toFixed(precision)} ${cp2x.toFixed(precision)} ${cp2y.toFixed(precision)} ${next.x.toFixed(precision)} ${next.y.toFixed(precision)}`);
    }

    return pathSegments;
  }

  /**
   * Create Chaikin smoothed path
   * @private
   */
  static _createChaikinPath(points, style) {
    const precision = style.path_precision || 2;
    const iterations = 2;
    let smoothedPoints = [...points];

    for (let iteration = 0; iteration < iterations; iteration++) {
      const newPoints = [];

      for (let i = 0; i < smoothedPoints.length - 1; i++) {
        const p1 = smoothedPoints[i];
        const p2 = smoothedPoints[i + 1];

        newPoints.push({
          x: p1.x * 0.75 + p2.x * 0.25,
          y: p1.y * 0.75 + p2.y * 0.25
        });

        newPoints.push({
          x: p1.x * 0.25 + p2.x * 0.75,
          y: p1.y * 0.25 + p2.y * 0.75
        });
      }

      smoothedPoints = newPoints;
    }

    return this._createLinearPath(smoothedPoints, style);
  }

  /**
   * Create Bezier curved path
   * @private
   */
  static _createBezierPath(points, style) {
    const precision = style.path_precision || 2;
    const pathSegments = [`M ${points[0].x.toFixed(precision)} ${points[0].y.toFixed(precision)}`];

    for (let i = 1; i < points.length - 1; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];

      const cp1x = p0.x + (p1.x - p0.x) * 0.5;
      const cp1y = p0.y + (p1.y - p0.y) * 0.5;

      pathSegments.push(`Q ${cp1x.toFixed(precision)} ${cp1y.toFixed(precision)} ${p1.x.toFixed(precision)} ${p1.y.toFixed(precision)}`);
    }

    const lastPoint = points[points.length - 1];
    pathSegments.push(`L ${lastPoint.x.toFixed(precision)} ${lastPoint.y.toFixed(precision)}`);

    return pathSegments;
  }

  /**
   * Create spline path (Catmull-Rom)
   * @private
   */
  static _createSplinePath(points, style) {
    if (points.length < 4) return this._createBezierPath(points, style);

    const precision = style.path_precision || 2;
    const segments = 10;
    const splinePoints = [points[0]];

    for (let i = 1; i < points.length - 2; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2];

      for (let t = 0; t <= segments; t++) {
        const u = t / segments;
        const u2 = u * u;
        const u3 = u2 * u;

        const f1 = -0.5 * u3 + u2 - 0.5 * u;
        const f2 = 1.5 * u3 - 2.5 * u2 + 1;
        const f3 = -1.5 * u3 + 2 * u2 + 0.5 * u;
        const f4 = 0.5 * u3 - 0.5 * u2;

        const x = f1 * p0.x + f2 * p1.x + f3 * p2.x + f4 * p3.x;
        const y = f1 * p0.y + f2 * p1.y + f3 * p2.y + f4 * p3.y;

        splinePoints.push({ x, y });
      }
    }

    splinePoints.push(points[points.length - 1]);

    return this._createLinearPath(splinePoints, style);
  }

  /**
   * Build area fill path
   * @private
   */
  static _buildAreaPath(pathPoints, scaling, style) {
    const areaSegments = [...pathPoints];
    const lastPoint = pathPoints[pathPoints.length - 1].split(' ');
    const lastX = lastPoint[lastPoint.length - 2];

    areaSegments.push(`L ${lastX} ${scaling.height + scaling.padding}`);
    areaSegments.push(`L ${scaling.padding} ${scaling.height + scaling.padding}`);
    areaSegments.push('Z');

    const areaPath = areaSegments.join(' ');
    const fillColor = style.fill_gradient ? `url(#sparkline-area-gradient-${style._overlayId || 'default'})` :
                      (style.fill || 'rgba(255, 165, 0, 0.2)');
    const fillOpacity = style.fill_opacity || 0.2;

    return `<path d="${areaPath}" fill="${fillColor}" fill-opacity="${fillOpacity}" data-sparkline-area="true"/>`;
  }

  /**
   * Build zero line
   * @private
   */
  static _buildZeroLine(scaling, style) {
    if (scaling.min > 0 || scaling.max < 0) return '';

    const zeroY = scaling.valueToY(0);
    const color = style.zero_line_color || 'var(--lcars-gray)';

    return `<line x1="${scaling.padding}" y1="${zeroY}"
                  x2="${scaling.width + scaling.padding}" y2="${zeroY}"
                  stroke="${color}"
                  stroke-width="1"
                  opacity="0.5"
                  stroke-dasharray="2,2"
                  data-feature="zero-line"/>`;
  }

  /**
   * Build value label
   * @private
   */
  static _buildValueLabel(data, scaling, style) {
    const lastValue = data[data.length - 1];
    if (typeof lastValue !== 'number' || isNaN(lastValue)) return '';

    const formattedValue = this._formatValue(lastValue, style);
    const fontSize = Math.min(scaling.width * 0.1, scaling.height / 3, 12);
    const labelX = scaling.width + scaling.padding + 4;
    const labelY = scaling.valueToY(lastValue);

    return `<text x="${labelX}" y="${labelY}"
                  fill="${style.color || 'var(--lcars-orange)'}"
                  font-size="${fontSize}"
                  text-anchor="start"
                  dominant-baseline="middle"
                  font-family="var(--lcars-font-family, Antonio)"
                  data-feature="value-label">
              ${formattedValue}
            </text>`;
  }

  /**
   * Format value for display
   * @private
   */
  static _formatValue(value, style) {
    if (style.value_format && typeof style.value_format === 'function') {
      return style.value_format(value);
    }
    if (style.value_format && typeof style.value_format === 'string') {
      return style.value_format.replace('{value}', value.toFixed(1));
    }
    return value.toFixed(1);
  }

  /**
   * Build brackets using BracketRenderer
   * @private
   */
  static _buildBrackets(scaling, style) {
    const width = scaling.width + (scaling.padding * 2);
    const height = scaling.height + (scaling.padding * 2);

    const bracketConfig = {
      enabled: true,
      style: typeof style.bracket_style === 'string' ? style.bracket_style : 'lcars',
      color: style.bracket_color || style.border_color || style.color,
      width: style.bracket_width || 2,
      gap: style.bracket_gap || 6,
      extension: style.bracket_extension || 8,
      opacity: style.bracket_opacity || 1,
      corners: style.bracket_corners || 'both',
      sides: style.bracket_sides || 'both',
      bracket_width: style.bracket_physical_width || style.bracket_extension || 8,
      bracket_height: style.bracket_height || '100%',
      bracket_radius: style.bracket_radius || 4,
      border_top: style.border_top || 0,
      border_left: style.border_left || 0,
      border_right: style.border_right || 0,
      border_bottom: style.border_bottom || 0,
      border_color: style.border_color || style.bracket_color || style.color,
      border_radius: style.border_radius || 8,
      inner_factor: style.inner_factor || 2,
      hybrid_mode: style.hybrid_mode || false
    };

    return BracketRenderer.render(width, height, bracketConfig, style._overlayId || 'sparkline');
  }

  /**
   * Render fallback sparkline
   * @private
   */
  static _renderFallback(x, y, width, height, style) {
    const color = style.color || 'var(--lcars-gray)';

    return {
      markup: `<g transform="translate(${x}, ${y})">
                 <rect width="${width}" height="${height}"
                       fill="none" stroke="${color}" stroke-width="2" rx="4"/>
                 <text x="${width / 2}" y="${height / 2}" text-anchor="middle"
                       fill="${color}" font-size="12" dominant-baseline="middle">
                   No Data
                 </text>
               </g>`,
      metadata: null
    };
  }

  /**
   * Build grid lines
   * @private
   */
  static _buildGridLines(scaling, style) {
    const lines = [];

    const gridColor = style.grid_color || 'var(--lcars-gray)';
    const gridOpacity = style.grid_opacity || 0.4;
    const gridStrokeWidth = style.grid_stroke_width || 1;
    const gridHorizontalCount = style.grid_horizontal_count || 3;
    const gridVerticalCount = style.grid_vertical_count || 5;

    // Horizontal grid lines
    for (let i = 1; i < gridHorizontalCount; i++) {
      const y = (scaling.height / gridHorizontalCount) * i + scaling.padding;
      lines.push(`<line x1="${scaling.padding}" y1="${y}"
                       x2="${scaling.width + scaling.padding}" y2="${y}"
                       stroke="${gridColor}"
                       stroke-width="${gridStrokeWidth}"
                       opacity="${gridOpacity}"/>`);
    }

    // Vertical grid lines
    for (let i = 1; i < gridVerticalCount; i++) {
      const x = (scaling.width / gridVerticalCount) * i + scaling.padding;
      lines.push(`<line x1="${x}" y1="${scaling.padding}"
                       x2="${x}" y2="${scaling.height + scaling.padding}"
                       stroke="${gridColor}"
                       stroke-width="${gridStrokeWidth}"
                       opacity="${gridOpacity}"/>`);
    }

    return `<g data-grid-lines="true">${lines.join('\n')}</g>`;
  }

  /**
   * Build data point markers
   * @private
   */
  static _buildDataPoints(data, scaling, style) {
    const points = [];

    const pointColor = style.point_color || style.color || 'var(--lcars-orange)';
    const pointSize = style.point_size || 3;
    const strokeOpacity = style.strokeOpacity || style.opacity || 1;

    data.forEach((value, index) => {
      if (typeof value !== 'number' || isNaN(value)) return;

      const px = scaling.indexToX(index);
      const py = scaling.valueToY(value);

      points.push(`<circle cx="${px}" cy="${py}" r="${pointSize}"
                          fill="${pointColor}"
                          opacity="${strokeOpacity}"
                          data-value="${value}"
                          data-index="${index}"/>`);
    });

    return `<g data-data-points="true">${points.join('\n')}</g>`;
  }

  /**
   * Build threshold lines
   * @private
   */
  static _buildThresholdLines(scaling, style) {
    const lines = [];

    const thresholdColor = style.threshold_color || 'var(--lcars-red)';
    const thresholdWidth = style.threshold_width || 2;
    const thresholdOpacity = style.threshold_opacity || 1;

    // Upper threshold
    if (style.threshold_max !== undefined && style.threshold_max !== null) {
      const y = scaling.valueToY(style.threshold_max);
      lines.push(`<line x1="${scaling.padding}" y1="${y}"
                       x2="${scaling.width + scaling.padding}" y2="${y}"
                       stroke="${thresholdColor}"
                       stroke-width="${thresholdWidth}"
                       opacity="${thresholdOpacity}"
                       data-feature="threshold-max"/>`);
    }

    // Lower threshold
    if (style.threshold_min !== undefined && style.threshold_min !== null) {
      const y = scaling.valueToY(style.threshold_min);
      lines.push(`<line x1="${scaling.padding}" y1="${y}"
                       x2="${scaling.width + scaling.padding}" y2="${y}"
                       stroke="${thresholdColor}"
                       stroke-width="${thresholdWidth}"
                       opacity="${thresholdOpacity}"
                       data-feature="threshold-min"/>`);
    }

    return `<g data-threshold-lines="true">${lines.join('\n')}</g>`;
  }

  /**
   * Build decorations (data points, labels, etc.)
   * @private
   */
  static _buildDecorations(scaling, style) {
    // Empty for now - decorations are built inline in _buildSparklinePath
    return '';
  }

  /**
   * Build metadata for attachment points
   * @private
   */
  static _buildMetadata(x, y, width, height, dataBounds, data) {
    return {
      bounds: {
        left: x,
        right: x + width,
        top: y,
        bottom: y + height,
        width,
        height,
        centerX: x + width / 2,
        centerY: y + height / 2
      },
      dataBounds,
      dataPointCount: data.length,
      attachmentPoints: {
        center: [x + width / 2, y + height / 2],
        left: [x, y + height / 2],
        right: [x + width, y + height / 2],
        top: [x + width / 2, y],
        bottom: [x + width / 2, y + height],
        topLeft: [x, y],
        topRight: [x + width, y],
        bottomLeft: [x, y + height],
        bottomRight: [x + width, y + height]
      }
    };
  }

  /**
   * Create gradient definition
   * @private
   */
  static _createGradientDef(gradientConfig, overlayId) {
    const gradientId = `sparkline-gradient-${overlayId}`;

    if (typeof gradientConfig === 'string') {
      const [color1, color2] = gradientConfig.split(',').map(c => c.trim());
      return `<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="${color1 || 'var(--lcars-orange)'}" stop-opacity="0.8"/>
                <stop offset="100%" stop-color="${color2 || 'var(--lcars-red)'}" stop-opacity="0.1"/>
              </linearGradient>`;
    }

    // Advanced gradient configuration
    const type = gradientConfig.type || 'linear';
    const stops = gradientConfig.stops || [
      { offset: '0%', color: 'var(--lcars-orange)', opacity: 0.8 },
      { offset: '100%', color: 'var(--lcars-red)', opacity: 0.1 }
    ];

    if (type === 'radial') {
      const cx = gradientConfig.cx || '50%';
      const cy = gradientConfig.cy || '50%';
      const r = gradientConfig.r || '50%';
      const stopElements = stops.map(stop =>
        `<stop offset="${stop.offset}" stop-color="${stop.color}" stop-opacity="${stop.opacity || 1}"/>`
      ).join('');
      return `<radialGradient id="${gradientId}" cx="${cx}" cy="${cy}" r="${r}">${stopElements}</radialGradient>`;
    }

    const x1 = gradientConfig.x1 || '0%';
    const y1 = gradientConfig.y1 || '0%';
    const x2 = gradientConfig.x2 || '0%';
    const y2 = gradientConfig.y2 || '100%';
    const stopElements = stops.map(stop =>
      `<stop offset="${stop.offset}" stop-color="${stop.color}" stop-opacity="${stop.opacity || 1}"/>`
    ).join('');
    return `<linearGradient id="${gradientId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopElements}</linearGradient>`;
  }
}
