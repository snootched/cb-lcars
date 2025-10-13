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
    const pathPoints = [];
    const areaPoints = [];

    data.forEach((value, index) => {
      if (typeof value !== 'number' || isNaN(value)) return;

      const px = scaling.indexToX(index);
      const py = scaling.valueToY(value);

      if (pathPoints.length === 0) {
        pathPoints.push(`M ${px} ${py}`);
        if (style.fill || style.areaFill) {
          areaPoints.push(`M ${px} ${scaling.height + scaling.padding}`);
          areaPoints.push(`L ${px} ${py}`);
        }
      } else {
        pathPoints.push(`L ${px} ${py}`);
        if (style.fill || style.areaFill) {
          areaPoints.push(`L ${px} ${py}`);
        }
      }
    });

    // Close area path
    if (areaPoints.length > 0) {
      const lastX = scaling.indexToX(data.length - 1);
      areaPoints.push(`L ${lastX} ${scaling.height + scaling.padding}`);
      areaPoints.push('Z');
    }

    const parts = [];

    // Grid lines (if enabled) - render BEFORE path so they're underneath
    if (style.grid_lines) {
      parts.push(this._buildGridLines(scaling, style));
    }

    // Area fill (if enabled)
    if (areaPoints.length > 0) {
      const areaPath = areaPoints.join(' ');
      const fillColor = style.areaFill || style.fill || 'rgba(255, 165, 0, 0.2)';
      const fillOpacity = style.areaOpacity || style.fillOpacity || 0.2;

      if (style.gradient) {
        parts.push(`<path d="${areaPath}" fill="url(#sparkline-gradient-${style._overlayId || 'default'})" fill-opacity="${fillOpacity}" data-sparkline-area="true"/>`);
      } else {
        parts.push(`<path d="${areaPath}" fill="${fillColor}" fill-opacity="${fillOpacity}" data-sparkline-area="true"/>`);
      }
    }

    // Line stroke
    const linePath = pathPoints.join(' ');
    const strokeColor = style.color || style.stroke || 'var(--lcars-orange)';
    const strokeWidth = style.strokeWidth || style.lineWidth || 2;
    const strokeOpacity = style.strokeOpacity || style.opacity || 1;

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

    return parts.join('\n');
  }

  /**
   * Build threshold lines
   * @private
   */
  static _buildThresholdLines(scaling, style) {
    const thresholds = [];

    if (style.threshold !== undefined && style.threshold !== null) {
      const thresholdValue = Number(style.threshold);
      const y = scaling.valueToY(thresholdValue);
      const color = style.thresholdColor || 'rgba(255, 0, 0, 0.5)';
      const strokeWidth = style.thresholdWidth || 1;
      const strokeStyle = style.thresholdStyle || 'dashed';
      const dashArray = strokeStyle === 'dashed' ? '4,4' :
                       strokeStyle === 'dotted' ? '1,3' : 'none';

      thresholds.push(`<line x1="${scaling.padding}"
                            y1="${y}"
                            x2="${scaling.width + scaling.padding}"
                            y2="${y}"
                            stroke="${color}"
                            stroke-width="${strokeWidth}"
                            stroke-dasharray="${dashArray}"
                            data-threshold="${thresholdValue}"/>`);
    }

    return thresholds.join('\n');
  }

  /**
   * Build decorations (data points, labels, etc.)
   * @private
   */
  static _buildDecorations(scaling, style) {
    const decorations = [];

    // Add data point circles if enabled
    if (style.showPoints || style.showDataPoints) {
      // TODO: Implement data point circles
    }

    // Add value labels if enabled
    if (style.showLabels || style.showValues) {
      // TODO: Implement value labels
    }

    return decorations.join('\n');
  }

  /**
   * Build SVG definitions (gradients, etc.)
   * @private
   */
  static _buildDefinitions(style, overlayId) {
    const defs = [];

    if (style.gradient) {
      defs.push(this._createGradientDef(style.gradient, overlayId));
    }

    return defs.length > 0 ? `<defs>${defs.join('\n')}</defs>` : '';
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
}
