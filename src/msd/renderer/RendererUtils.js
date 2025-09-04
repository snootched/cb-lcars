/**
 * Shared Renderer Utilities - Common functionality for all renderers
 * Provides reusable components for gradients, patterns, filters, and effects
 */

export class RendererUtils {


  /**
   * Text measurement utilities using HTML Canvas
   * Static methods for precise text dimension calculations
   */

  /**
   * Get or create cached canvas context for text measurements
   * @private
   * @returns {CanvasRenderingContext2D}
   */
  static _getTextMeasureContext() {
    if (!window.cblcars) window.cblcars = {};

    if (!window.cblcars._textMeasureCanvas) {
      window.cblcars._textMeasureCanvas = document.createElement("canvas");
      window.cblcars._textMeasureContext = window.cblcars._textMeasureCanvas.getContext("2d");
      window.cblcars._textMeasureCache = new Map();
    }

    return window.cblcars._textMeasureContext;
  }

  /**
   * Get the SVG container and its current transformation matrix
   * @param {Element} containerElement - The SVG container element
   * @returns {Object|null} Object with svg element and transformation info
   */
  static _getSvgTransformInfo(containerElement) {
    try {
      const svg = containerElement?.querySelector('svg');
      if (!svg) return null;

      // Get the viewBox and current dimensions
      const viewBox = svg.viewBox.baseVal;
      const rect = svg.getBoundingClientRect();

      // Calculate scale factors
      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;

      return {
        svg,
        viewBox: [viewBox.x, viewBox.y, viewBox.width, viewBox.height],
        screenRect: { width: rect.width, height: rect.height },
        scaleX,
        scaleY,
        // For pixel-to-viewbox conversion
        pixelToViewBox: (pixelSize) => pixelSize * Math.max(scaleX, scaleY)
      };
    } catch (error) {
      console.warn('[RendererUtils] Failed to get SVG transform info:', error);
      return null;
    }
  }

  /**
   * Measure text dimensions using canvas context
   * @param {string} text - Text to measure
   * @param {string} font - CSS font string (e.g., "bold 16px Arial")
   * @param {boolean} useCache - Whether to use cached measurements
   * @param {Element} containerElement - SVG container for coordinate transformation
   * @returns {{width: number, height: number, ascent: number, descent: number}}
   */
  static measureText(text, font = "16px Arial", useCache = true, containerElement = null) {
    if (!text) return { width: 0, height: 0, ascent: 0, descent: 0 };

    const cacheKey = `${text}::${font}`;
    const cache = window.cblcars?._textMeasureCache;

    if (useCache && cache && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);

      // Apply coordinate transformation if container provided
      if (containerElement) {
        return this._transformTextMetrics(cached, containerElement);
      }

      return cached;
    }

    const ctx = this._getTextMeasureContext();
    ctx.font = font;
    const metrics = ctx.measureText(text);

    const result = {
      width: metrics.width,
      height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
      ascent: metrics.actualBoundingBoxAscent,
      descent: metrics.actualBoundingBoxDescent,
      actualLeft: metrics.actualBoundingBoxLeft || 0,
      actualRight: metrics.actualBoundingBoxRight || metrics.width,
      // Store original pixel values for transformation
      _pixelWidth: metrics.width,
      _pixelHeight: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
      _pixelAscent: metrics.actualBoundingBoxAscent,
      _pixelDescent: metrics.actualBoundingBoxDescent
    };

    if (useCache && cache) {
      cache.set(cacheKey, result);
    }

    // Apply coordinate transformation if container provided
    if (containerElement) {
      return this._transformTextMetrics(result, containerElement);
    }

    return result;
  }

  /**
   * Transform text metrics from pixel space to viewBox coordinate space
   * @private
   * @param {Object} metrics - Original pixel-based metrics
   * @param {Element} containerElement - SVG container for transformation
   * @returns {Object} Transformed metrics in viewBox coordinates
   */
  static _transformTextMetrics(metrics, containerElement) {
    const transformInfo = this._getSvgTransformInfo(containerElement);
    if (!transformInfo) {
      // No transformation available - return original metrics
      console.warn('[RendererUtils] No transform info available, using pixel metrics');
      return metrics;
    }

    const { pixelToViewBox } = transformInfo;

    const transformed = {
      ...metrics,
      width: pixelToViewBox(metrics._pixelWidth || metrics.width),
      height: pixelToViewBox(metrics._pixelHeight || metrics.height),
      ascent: pixelToViewBox(metrics._pixelAscent || metrics.ascent),
      descent: pixelToViewBox(metrics._pixelDescent || metrics.descent),
      actualLeft: pixelToViewBox(metrics.actualLeft),
      actualRight: pixelToViewBox(metrics.actualRight)
    };

    console.log('[RendererUtils] Transformed text metrics:', {
      original: {
        width: metrics.width,
        height: metrics.height
      },
      transformed: {
        width: transformed.width,
        height: transformed.height
      },
      scaleInfo: {
        scaleX: transformInfo.scaleX,
        scaleY: transformInfo.scaleY
      }
    });

    return transformed;
  }

  /**
   * Measure multiline text with proper line spacing and coordinate transformation
   * @param {string} text - Multiline text (with \n separators)
   * @param {string} font - CSS font string
   * @param {number} lineHeight - Line height multiplier (default 1.2)
   * @param {boolean} useCache - Whether to use cached measurements
   * @param {Element} containerElement - SVG container for coordinate transformation
   * @returns {{width: number, height: number, lines: Array, lineMetrics: Array}}
   */
  static measureMultilineText(text, font = "16px Arial", lineHeight = 1.2, useCache = true, containerElement = null) {
    if (!text) return { width: 0, height: 0, lines: [], lineMetrics: [] };

    const lines = text.split('\n');
    const lineMetrics = lines.map(line => this.measureText(line, font, useCache, containerElement));

    const maxWidth = Math.max(...lineMetrics.map(m => m.width));
    const fontSize = this._parseFontSize(font);

    // Apply transformation to fontSize if container provided
    let adjustedFontSize = fontSize;
    let adjustedLineHeight = lineHeight;

    if (containerElement) {
      const transformInfo = this._getSvgTransformInfo(containerElement);
      if (transformInfo) {
        adjustedFontSize = transformInfo.pixelToViewBox(fontSize);
        // Line height is a multiplier, so we need to apply it to the transformed font size
        adjustedLineHeight = lineHeight;
      }
    }

    const totalHeight = lines.length > 1
      ? lineMetrics[0].ascent + ((lines.length - 1) * adjustedFontSize * adjustedLineHeight) + lineMetrics[lineMetrics.length - 1].descent
      : lineMetrics[0]?.height || 0;

    return {
      width: maxWidth,
      height: totalHeight,
      lines,
      lineMetrics,
      // Store transform info for debugging
      _transformApplied: !!containerElement,
      _adjustedFontSize: adjustedFontSize
    };
  }

  /**
   * Calculate text bounding box at specific position with proper coordinate transformation
   * @param {string} text - Text content
   * @param {number} x - X position in viewBox coordinates
   * @param {number} y - Y position in viewBox coordinates
   * @param {string} font - CSS font string
   * @param {string} textAnchor - SVG text-anchor value ('start', 'middle', 'end')
   * @param {string} dominantBaseline - SVG dominant-baseline value
   * @param {Element} containerElement - SVG container for coordinate transformation
   * @returns {{left: number, right: number, top: number, bottom: number, width: number, height: number}}
   */
  static getTextBoundingBox(text, x, y, font = "16px Arial", textAnchor = 'start', dominantBaseline = 'auto', containerElement = null) {
    const metrics = this.measureText(text, font, true, containerElement);

    // Adjust for text anchor (x, y are already in viewBox coordinates)
    let left = x;
    if (textAnchor === 'middle') {
      left = x - metrics.width / 2;
    } else if (textAnchor === 'end') {
      left = x - metrics.width;
    }

    // Adjust for baseline (y is already in viewBox coordinates)
    let top = y - metrics.ascent;
    if (dominantBaseline === 'middle') {
      top = y - metrics.height / 2;
    } else if (dominantBaseline === 'hanging') {
      top = y;
    }

    const bbox = {
      left,
      right: left + metrics.width,
      top,
      bottom: top + metrics.height,
      width: metrics.width,
      height: metrics.height,
      centerX: left + metrics.width / 2,
      centerY: top + metrics.height / 2
    };

    console.log('[RendererUtils] Text bounding box calculation:', {
      text: text.substring(0, 20) + (text.length > 20 ? '...' : ''),
      inputPosition: { x, y },
      textAnchor,
      dominantBaseline,
      metrics: {
        width: metrics.width,
        height: metrics.height,
        ascent: metrics.ascent,
        descent: metrics.descent
      },
      bbox,
      hasContainer: !!containerElement
    });

    return bbox;
  }

  /**
   * Get attachment points for connecting lines to text with proper coordinate transformation
   * @param {string} text - Text content
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} font - CSS font string
   * @param {string} textAnchor - SVG text-anchor value
   * @param {string} dominantBaseline - SVG dominant-baseline value
   * @param {Element} containerElement - SVG container for coordinate transformation
   * @returns {Object} Object with attachment points (top, bottom, left, right, etc.)
   */
  static getTextAttachmentPoints(text, x, y, font = "16px Arial", textAnchor = 'start', dominantBaseline = 'auto', containerElement = null) {
    const bbox = this.getTextBoundingBox(text, x, y, font, textAnchor, dominantBaseline, containerElement);

    // Calculate padding in viewBox coordinates - don't double-transform
    const transformInfo = this._getSvgTransformInfo(containerElement);
    const basePadding = 4; // Base padding value
    const padding = transformInfo ? transformInfo.pixelToViewBox(basePadding) : basePadding;

    return {
      // Cardinal directions
      top: [bbox.centerX, bbox.top],
      bottom: [bbox.centerX, bbox.bottom],
      left: [bbox.left, bbox.centerY],
      right: [bbox.right, bbox.centerY],
      center: [bbox.centerX, bbox.centerY],

      // Corners
      topLeft: [bbox.left, bbox.top],
      topRight: [bbox.right, bbox.top],
      bottomLeft: [bbox.left, bbox.bottom],
      bottomRight: [bbox.right, bbox.bottom],

      // With padding for visual clearance (properly scaled)
      topPadded: [bbox.centerX, bbox.top - padding],
      bottomPadded: [bbox.centerX, bbox.bottom + padding],
      leftPadded: [bbox.left - padding, bbox.centerY],
      rightPadded: [bbox.right + padding, bbox.centerY]
    };
  }

  /**
   * Parse font size from CSS font string
   * @private
   * @param {string} font - CSS font string
   * @returns {number} Font size in pixels
   */
  static _parseFontSize(font) {
    const match = font.match(/(\d+(?:\.\d+)?)px/);
    return match ? parseFloat(match[1]) : 16;
  }

  /**
   * Build CSS font string from text style object
   * @param {Object} textStyle - Text style configuration
   * @returns {string} CSS font string
   */
  static buildFontString(textStyle) {
    const parts = [];

    if (textStyle.fontStyle && textStyle.fontStyle !== 'normal') {
      parts.push(textStyle.fontStyle);
    }
    if (textStyle.fontWeight && textStyle.fontWeight !== 'normal') {
      parts.push(textStyle.fontWeight);
    }

    parts.push(`${textStyle.fontSize}px`);

    if (textStyle.fontFamily && textStyle.fontFamily !== 'inherit') {
      parts.push(textStyle.fontFamily);
    } else {
      parts.push('Arial, sans-serif');
    }

    return parts.join(' ');
  }

  /**
   * Clear text measurement cache
   */
  static clearTextMeasureCache() {
    if (window.cblcars?._textMeasureCache) {
      window.cblcars._textMeasureCache.clear();
    }
  }

  /**
   * Get text measurement cache statistics
   */
  static getTextMeasureCacheStats() {
    const cache = window.cblcars?._textMeasureCache;
    return {
      size: cache?.size || 0,
      keys: cache ? Array.from(cache.keys()) : []
    };
  }

  /**
   * Parse gradient configuration from various formats
   * @param {string|object} gradientConfig - Gradient configuration
   * @returns {object|null} Parsed gradient configuration
   */
  static parseGradientConfig(gradientConfig) {
    if (!gradientConfig) return null;

    if (typeof gradientConfig === 'string') {
      // Handle simple formats: "red,blue" or "red-to-blue"
      if (gradientConfig.includes(',')) {
        const colors = gradientConfig.split(',').map(c => c.trim());
        return {
          type: 'linear',
          direction: 'horizontal',
          stops: colors.map((color, index) => ({
            offset: `${(index / (colors.length - 1)) * 100}%`,
            color: color
          }))
        };
      } else if (gradientConfig.includes('-to-')) {
        const [color1, color2] = gradientConfig.split('-to-').map(c => c.trim());
        return {
          type: 'linear',
          direction: 'horizontal',
          stops: [
            { offset: '0%', color: color1 },
            { offset: '100%', color: color2 }
          ]
        };
      }
      return null;
    }

    if (typeof gradientConfig === 'object') {
      return {
        type: gradientConfig.type || 'linear',
        direction: gradientConfig.direction || 'horizontal',
        x1: gradientConfig.x1 || '0%',
        y1: gradientConfig.y1 || '0%',
        x2: gradientConfig.x2 || '100%',
        y2: gradientConfig.y2 || '0%',
        cx: gradientConfig.cx || '50%',
        cy: gradientConfig.cy || '50%',
        r: gradientConfig.r || '50%',
        stops: gradientConfig.stops || [
          { offset: '0%', color: gradientConfig.from || 'var(--lcars-orange)' },
          { offset: '100%', color: gradientConfig.to || 'var(--lcars-red)' }
        ]
      };
    }

    return null;
  }

  /**
   * Parse pattern configuration from various formats
   * @param {string|object} patternConfig - Pattern configuration
   * @returns {object|null} Parsed pattern configuration
   */
  static parsePatternConfig(patternConfig) {
    if (!patternConfig) return null;

    if (typeof patternConfig === 'string') {
      // Predefined patterns
      const presets = {
        dots: { type: 'dots', size: 8, color: 'currentColor', opacity: 0.5 },
        lines: { type: 'lines', size: 4, color: 'currentColor', opacity: 0.5 },
        diagonal: { type: 'diagonal', size: 8, color: 'currentColor', opacity: 0.5 },
        grid: { type: 'grid', size: 10, color: 'currentColor', opacity: 0.3 }
      };
      return presets[patternConfig] || null;
    }

    if (typeof patternConfig === 'object') {
      return {
        type: patternConfig.type || 'dots',
        size: Number(patternConfig.size || 8),
        color: patternConfig.color || 'currentColor',
        opacity: Number(patternConfig.opacity || 0.5),
        content: patternConfig.content || null
      };
    }

    return null;
  }

  /**
   * Parse glow effect configuration
   * @param {string|object|boolean} glowConfig - Glow configuration
   * @returns {object|null} Parsed glow configuration
   */
  static parseGlowConfig(glowConfig) {
    if (!glowConfig) return null;

    if (glowConfig === true) {
      return { color: 'currentColor', size: 4, opacity: 0.6 };
    }

    if (typeof glowConfig === 'string') {
      return { color: glowConfig, size: 4, opacity: 0.6 };
    }

    if (typeof glowConfig === 'object') {
      return {
        color: glowConfig.color || 'currentColor',
        size: Number(glowConfig.size || 4),
        opacity: Number(glowConfig.opacity || 0.6),
        intensity: Number(glowConfig.intensity || 1)
      };
    }

    return null;
  }

  /**
   * Parse shadow effect configuration
   * @param {string|object|boolean} shadowConfig - Shadow configuration
   * @returns {object|null} Parsed shadow configuration
   */
  static parseShadowConfig(shadowConfig) {
    if (!shadowConfig) return null;

    if (shadowConfig === true) {
      return { color: 'rgba(0,0,0,0.3)', offsetX: 2, offsetY: 2, blur: 3 };
    }

    if (typeof shadowConfig === 'string') {
      // Parse "2 2 3 rgba(0,0,0,0.3)" format
      const parts = shadowConfig.split(' ');
      return {
        offsetX: Number(parts[0]) || 2,
        offsetY: Number(parts[1]) || 2,
        blur: Number(parts[2]) || 3,
        color: parts[3] || 'rgba(0,0,0,0.3)'
      };
    }

    if (typeof shadowConfig === 'object') {
      return {
        color: shadowConfig.color || 'rgba(0,0,0,0.3)',
        offsetX: Number(shadowConfig.offsetX || shadowConfig.offset?.[0] || 2),
        offsetY: Number(shadowConfig.offsetY || shadowConfig.offset?.[1] || 2),
        blur: Number(shadowConfig.blur || 3)
      };
    }

    return null;
  }

  /**
   * Parse blur effect configuration
   * @param {number|string|object} blurConfig - Blur configuration
   * @returns {object|null} Parsed blur configuration
   */
  static parseBlurConfig(blurConfig) {
    if (!blurConfig) return null;

    if (typeof blurConfig === 'number') {
      return { amount: blurConfig };
    }

    if (typeof blurConfig === 'string') {
      return { amount: Number(blurConfig) || 1 };
    }

    if (typeof blurConfig === 'object') {
      return { amount: Number(blurConfig.amount || blurConfig.blur || 1) };
    }

    return null;
  }

  /**
   * Create gradient definition SVG
   * @param {object} gradient - Parsed gradient configuration
   * @param {string} id - Unique ID for the gradient
   * @returns {string} SVG gradient definition
   */
  static createGradientDefinition(gradient, id) {
    if (gradient.type === 'radial') {
      const stops = gradient.stops.map(stop =>
        `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`
      ).join('');

      return `<radialGradient id="${id}" cx="${gradient.cx}" cy="${gradient.cy}" r="${gradient.r}">
                ${stops}
              </radialGradient>`;
    } else {
      // Linear gradient
      const coords = this.getLinearGradientCoords(gradient.direction, gradient);
      const stops = gradient.stops.map(stop =>
        `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`
      ).join('');

      return `<linearGradient id="${id}" ${coords}>
                ${stops}
              </linearGradient>`;
    }
  }

  /**
   * Get linear gradient coordinates based on direction
   * @param {string} direction - Gradient direction
   * @param {object} gradient - Gradient configuration (for custom coordinates)
   * @returns {string} SVG coordinate attributes
   */
  static getLinearGradientCoords(direction, gradient = {}) {
    // Use custom coordinates if provided
    if (gradient.x1 !== undefined) {
      return `x1="${gradient.x1}" y1="${gradient.y1}" x2="${gradient.x2}" y2="${gradient.y2}"`;
    }

    // Predefined directions
    const directions = {
      horizontal: 'x1="0%" y1="0%" x2="100%" y2="0%"',
      vertical: 'x1="0%" y1="0%" x2="0%" y2="100%"',
      diagonal: 'x1="0%" y1="0%" x2="100%" y2="100%"',
      'diagonal-reverse': 'x1="100%" y1="0%" x2="0%" y2="100%"',
      'to-right': 'x1="0%" y1="0%" x2="100%" y2="0%"',
      'to-left': 'x1="100%" y1="0%" x2="0%" y2="0%"',
      'to-bottom': 'x1="0%" y1="0%" x2="0%" y2="100%"',
      'to-top': 'x1="0%" y1="100%" x2="0%" y2="0%"'
    };

    return directions[direction] || directions.horizontal;
  }

  /**
   * Create pattern definition SVG
   * @param {object} pattern - Parsed pattern configuration
   * @param {string} id - Unique ID for the pattern
   * @returns {string} SVG pattern definition
   */
  static createPatternDefinition(pattern, id) {
    const size = pattern.size;
    const color = pattern.color;
    const opacity = pattern.opacity;

    let patternContent = '';

    switch (pattern.type) {
      case 'dots':
        patternContent = `<circle cx="${size/2}" cy="${size/2}" r="1"
                                  fill="${color}" opacity="${opacity}"/>`;
        break;

      case 'lines':
        patternContent = `<path d="M 0,${size} l ${size},-${size} M -1,1 l 2,-2 M ${size-1},${size+1} l 2,-2"
                                stroke="${color}" stroke-width="1" opacity="${opacity}"/>`;
        break;

      case 'diagonal':
        patternContent = `<path d="M0,${size} L${size},0"
                                stroke="${color}" stroke-width="1" opacity="${opacity}"/>`;
        break;

      case 'grid':
        patternContent = `
          <path d="M0,0 L0,${size}" stroke="${color}" stroke-width="0.5" opacity="${opacity}"/>
          <path d="M0,0 L${size},0" stroke="${color}" stroke-width="0.5" opacity="${opacity}"/>
        `;
        break;

      case 'custom':
        patternContent = pattern.content || '';
        break;

      default:
        // Default to dots
        patternContent = `<circle cx="${size/2}" cy="${size/2}" r="1"
                                  fill="${color}" opacity="${opacity}"/>`;
    }

    return `<pattern id="${id}" x="0" y="0" width="${size}" height="${size}"
                     patternUnits="userSpaceOnUse">
              ${patternContent}
            </pattern>`;
  }

  /**
   * Create glow filter SVG
   * @param {object} glow - Parsed glow configuration
   * @param {string} id - Unique ID for the filter
   * @returns {string} SVG filter definition
   */
  static createGlowFilter(glow, id) {
    const size = glow.size || 4;
    const color = glow.color || 'currentColor';
    const intensity = glow.intensity || 1;

    // Enhanced filter for better glow effect
    return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="${size}" result="coloredBlur"/>
              <feFlood flood-color="${color}" flood-opacity="${intensity}"/>
              <feComposite in="flood" in2="coloredBlur" operator="in" result="glowColor"/>
              <feMerge>
                <feMergeNode in="glowColor"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>`;
  }

  /**
   * Create shadow filter SVG
   * @param {object} shadow - Parsed shadow configuration
   * @param {string} id - Unique ID for the filter
   * @returns {string} SVG filter definition
   */
  static createShadowFilter(shadow, id) {
    const offsetX = shadow.offsetX || 2;
    const offsetY = shadow.offsetY || 2;
    const blur = shadow.blur || 3;
    const color = shadow.color || 'rgba(0,0,0,0.3)';

    return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="${offsetX}" dy="${offsetY}"
                           stdDeviation="${blur}"
                           flood-color="${color}"/>
            </filter>`;
  }

  /**
   * Create blur filter SVG
   * @param {object} blur - Parsed blur configuration
   * @param {string} id - Unique ID for the filter
   * @returns {string} SVG filter definition
   */
  static createBlurFilter(blur, id) {
    const amount = blur.amount || 1;

    return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="${amount}"/>
            </filter>`;
  }

  /**
   * Create LCARS-style bracket path
   * @param {number} width - Bracket width
   * @param {number} height - Bracket height
   * @param {string} side - 'left' or 'right'
   * @param {object} options - Styling options
   * @returns {string} SVG path for bracket
   */
  static createLcarsBracket(width, height, side = 'left', options = {}) {
    const bracketWidth = options.bracketWidth || 8;
    const cornerRadius = options.cornerRadius || 2;
    const strokeWidth = options.strokeWidth || 2;
    const color = options.color || 'var(--lcars-orange)';

    let pathData = '';

    if (side === 'left') {
      pathData = `M ${width} 0 L ${cornerRadius} 0
                  Q 0 0 0 ${cornerRadius}
                  L 0 ${height - cornerRadius}
                  Q 0 ${height} ${cornerRadius} ${height}
                  L ${width} ${height}`;
    } else {
      pathData = `M 0 0 L ${width - cornerRadius} 0
                  Q ${width} 0 ${width} ${cornerRadius}
                  L ${width} ${height - cornerRadius}
                  Q ${width} ${height} ${width - cornerRadius} ${height}
                  L 0 ${height}`;
    }

    return `<path d="${pathData}"
                  stroke="${color}"
                  stroke-width="${strokeWidth}"
                  fill="none"/>`;
  }

  /**
   * Create marker definition for arrows, dots, etc.
   * @param {object} marker - Marker configuration
   * @param {string} id - Unique ID for the marker
   * @returns {string} SVG marker definition
   */
  static createMarkerDefinition(marker, id) {
    const size = this.getMarkerSize(marker.size || 'medium');
    const color = marker.color === 'inherit' ? 'currentColor' : marker.color;

    let markerContent = '';
    let viewBox = `0 0 ${size} ${size}`;
    let refX = size / 2;
    let refY = size / 2;

    switch (marker.type) {
      case 'arrow':
        viewBox = '0 0 10 10';
        refX = 8;
        refY = 5;
        markerContent = `<path d="M2,2 L8,5 L2,8 z" fill="${color}"/>`;
        break;

      case 'dot':
      case 'circle':
        markerContent = `<circle cx="${size/2}" cy="${size/2}" r="${size/4}" fill="${color}"/>`;
        break;

      case 'diamond':
        markerContent = `<path d="M${size/2},2 L${size-2},${size/2} L${size/2},${size-2} L2,${size/2} z" fill="${color}"/>`;
        break;

      case 'square':
        markerContent = `<rect x="2" y="2" width="${size-4}" height="${size-4}" fill="${color}"/>`;
        break;

      case 'triangle':
        markerContent = `<path d="M${size/2},2 L${size-2},${size-2} L2,${size-2} z" fill="${color}"/>`;
        break;

      default:
        markerContent = `<circle cx="${size/2}" cy="${size/2}" r="${size/4}" fill="${color}"/>`;
    }

    return `<marker id="${id}"
                    viewBox="${viewBox}"
                    refX="${refX}" refY="${refY}"
                    markerWidth="${size}" markerHeight="${size}"
                    markerUnits="strokeWidth"
                    orient="${marker.rotate !== false ? 'auto' : '0'}">
              ${markerContent}
            </marker>`;
  }

  /**
   * Get numeric marker size from size descriptor
   * @param {string|number} size - Size descriptor
   * @returns {number} Numeric size
   */
  static getMarkerSize(size) {
    if (typeof size === 'number') return size;

    const sizes = {
      small: 6,
      medium: 8,
      large: 12,
      xlarge: 16
    };

    return sizes[size] || 8;
  }

  /**
   * Escape XML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  static escapeXml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Generate unique ID for elements
   * @param {string} prefix - Prefix for the ID
   * @param {string} suffix - Suffix for the ID
   * @returns {string} Unique ID
   */
  static generateId(prefix = 'element', suffix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}-${timestamp}-${random}${suffix ? '-' + suffix : ''}`;
  }

  /**
   * Parse CSS color values and convert to various formats
   * @param {string} color - CSS color value
   * @returns {object} Color information
   */
  static parseColor(color) {
    // Create a temporary element to leverage browser's color parsing
    const tempElement = document.createElement('div');
    tempElement.style.color = color;
    document.body.appendChild(tempElement);

    const computedColor = getComputedStyle(tempElement).color;
    document.body.removeChild(tempElement);

    // Parse RGB values
    const rgbMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);

      return {
        rgb: [r, g, b],
        hex: this.rgbToHex(r, g, b),
        hsl: this.rgbToHsl(r, g, b),
        original: color,
        computed: computedColor
      };
    }

    return {
      original: color,
      computed: computedColor
    };
  }

  /**
   * Convert RGB to HEX
   * @private
   */
  static rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /**
   * Convert RGB to HSL
   * @private
   */
  static rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }

  /**
   * Calculate optimal text contrast color
   * @param {string} backgroundColor - Background color
   * @returns {string} Optimal text color (black or white)
   */
  static getContrastColor(backgroundColor) {
    const color = this.parseColor(backgroundColor);
    if (!color.rgb) return '#ffffff';

    const [r, g, b] = color.rgb;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  /**
   * Interpolate between two colors
   * @param {string} color1 - Start color
   * @param {string} color2 - End color
   * @param {number} factor - Interpolation factor (0-1)
   * @returns {string} Interpolated color
   */
  static interpolateColor(color1, color2, factor) {
    const c1 = this.parseColor(color1);
    const c2 = this.parseColor(color2);

    if (!c1.rgb || !c2.rgb) return color1;

    const r = Math.round(c1.rgb[0] + (c2.rgb[0] - c1.rgb[0]) * factor);
    const g = Math.round(c1.rgb[1] + (c2.rgb[1] - c1.rgb[1]) * factor);
    const b = Math.round(c1.rgb[2] + (c2.rgb[2] - c1.rgb[2]) * factor);

    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Create animation-ready attributes for future anime.js integration
   * @param {object} animationConfig - Animation configuration
   * @returns {array} Array of attribute strings
   */
  static createAnimationAttributes(animationConfig = {}) {
    const attributes = [];

    if (animationConfig.animatable !== false) {
      attributes.push('data-animatable="true"');
    }

    Object.keys(animationConfig).forEach(key => {
      if (key.endsWith('_speed') || key.endsWith('Speed')) {
        const value = animationConfig[key];
        if (value > 0) {
          const dataKey = key.replace(/([A-Z])/g, '-$1').toLowerCase().replace('_', '-');
          attributes.push(`data-${dataKey}="${value}"`);
        }
      }
    });

    if (animationConfig.animation_ref || animationConfig.animationRef) {
      const ref = animationConfig.animation_ref || animationConfig.animationRef;
      attributes.push(`data-animation-ref="${ref}"`);
    }

    return attributes;
  }

  /**
   * Validate and sanitize style values
   * @param {object} styles - Style object to validate
   * @returns {object} Sanitized styles
   */
  static sanitizeStyles(styles) {
    const sanitized = {};

    // Define allowed properties and their validation functions
    const validators = {
      color: (value) => this.isValidColor(value),
      opacity: (value) => this.isValidOpacity(value),
      width: (value) => this.isValidNumber(value),
      height: (value) => this.isValidNumber(value),
      stroke: (value) => this.isValidColor(value),
      fill: (value) => this.isValidColor(value) || value === 'none',
      fontSize: (value) => this.isValidNumber(value),
      fontFamily: (value) => this.isValidString(value)
    };

    Object.keys(styles).forEach(key => {
      const validator = validators[key] || validators[this.camelToKebab(key)];
      if (validator && validator(styles[key])) {
        sanitized[key] = styles[key];
      }
    });

    return sanitized;
  }

  /**
   * Check if value is a valid color
   * @private
   */
  static isValidColor(value) {
    if (typeof value !== 'string') return false;
    return /^(#[0-9a-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|var\(--|\w+)/.test(value.toLowerCase());
  }

  /**
   * Check if value is a valid opacity
   * @private
   */
  static isValidOpacity(value) {
    const num = Number(value);
    return !isNaN(num) && num >= 0 && num <= 1;
  }

  /**
   * Check if value is a valid number
   * @private
   */
  static isValidNumber(value) {
    return !isNaN(Number(value)) && isFinite(Number(value));
  }

  /**
   * Check if value is a valid string
   * @private
   */
  static isValidString(value) {
    return typeof value === 'string' && value.length > 0;
  }

  /**
   * Convert camelCase to kebab-case
   * @private
   */
  static camelToKebab(str) {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
  }
}