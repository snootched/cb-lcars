/**
 * [TextRenderer] Core text rendering - pure SVG generation
 * 🎨 Handles text SVG creation, styling, and effects WITHOUT MSD system dependencies
 *
 * Responsibilities:
 * - SVG text element generation
 * - Font rendering and sizing
 * - Text styling (gradients, patterns, effects)
 * - Multi-line text layout
 * - Text measurement and bounding boxes
 * - Decorations (brackets, highlights, status indicators)
 *
 * Does NOT handle:
 * - DataSource integration
 * - Action attachment
 * - MSD positioning/anchors
 * - Animation coordination
 */

import { RendererUtils } from '../RendererUtils.js';
import { BracketRenderer } from '../BracketRenderer.js';
import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';

export class TextRenderer {
  /**
   * Render text SVG markup with comprehensive styling
   * @param {Object} config - Text configuration
   *   @param {string} config.content - Text content to render
   *   @param {Array} config.position - [x, y] position
   *   @param {Object} config.size - Optional {width, height} for wrapping
   * @param {Object} style - Resolved text styling
   * @param {Object} context - Rendering context
   *   @param {Array} context.viewBox - SVG viewBox for scaling
   *   @param {Element} context.container - Container element for measurements
   *   @param {string} context.overlayId - Unique ID for definitions
   *   @param {Object} context.defaults - Default values for fallbacks
   * @returns {Object} {markup, metadata}
   */
  static render(config, style, context = {}) {
    const { content, position } = config;
    const { viewBox, container, overlayId = 'text', defaults = {} } = context;

    if (!content || !position) {
      cblcarsLog.warn('[TextRenderer] Missing content or position');
      return { markup: '', metadata: null };
    }

    const [x, y] = position;

    try {
      // Build SVG components
      const defs = this._buildDefinitions(style, overlayId, defaults);
      const text = this._buildMainText(content, x, y, style, overlayId, container);
      const decorations = this._buildDecorations(content, x, y, style, overlayId, container, defaults);

      // Measure final text for metadata
      const metadata = this._buildMetadata(content, x, y, style, container);

      const markup = [defs, text, decorations].filter(Boolean).join('\n');

      return { markup, metadata };

    } catch (error) {
      cblcarsLog.error(`[TextRenderer] Rendering failed:`, error);
      return this._renderFallback(content, x, y, style);
    }
  }

  /**
   * Build the main text element with all styling
   * @private
   */
  static _buildMainText(textContent, x, y, textStyle, overlayId, container) {
    if (textStyle.multiline) {
      return this._buildMultilineText(textContent, x, y, textStyle, overlayId, container);
    }

    const attributes = this._buildTextAttributes(x, y, textStyle, overlayId);
    const escapedContent = this._escapeXml(textContent);

    return `<text ${attributes.join(' ')}>${escapedContent}</text>`;
  }

  /**
   * Build multiline text with proper line spacing
   * @private
   */
  static _buildMultilineText(textContent, x, y, textStyle, overlayId, container) {
    const lines = textContent.split('\n');
    const fontSizeValue = parseFloat(textStyle.fontSize) || 16;
    const lineHeight = fontSizeValue * (textStyle.lineHeight || 1.2);
    const tspanElements = [];

    lines.forEach((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      const escapedLine = this._escapeXml(line);
      tspanElements.push(`<tspan x="${x}" dy="${dy}">${escapedLine}</tspan>`);
    });

    const attributes = this._buildTextAttributes(null, y, textStyle, overlayId);

    return `<text ${attributes.join(' ')}>${tspanElements}</text>`;
  }

  /**
   * Apply common text attributes
   * @private
   */
  static _buildTextAttributes(x, y, style, overlayId) {
    const attributes = [];

    // Position
    if (x !== null) attributes.push(`x="${x}"`);
    if (y !== null) attributes.push(`y="${y}"`);

    // Fill styling
    if (style.gradient) {
      attributes.push(`fill="url(#text-gradient-${overlayId})"`);
    } else if (style.pattern) {
      attributes.push(`fill="url(#text-pattern-${overlayId})"`);
    } else {
      attributes.push(`fill="${style.color || 'var(--lcars-orange)'}"`);
    }

    attributes.push(`fill-opacity="${style.opacity || 1}"`);

    // Font styling
    attributes.push(`font-size="${style.fontSize || '16px'}"`);
    if (style.fontFamily && style.fontFamily !== 'inherit') {
      attributes.push(`font-family="${style.fontFamily}"`);
    }
    if (style.fontWeight && style.fontWeight !== 'normal') {
      attributes.push(`font-weight="${style.fontWeight}"`);
    }
    if (style.fontStyle && style.fontStyle !== 'normal') {
      attributes.push(`font-style="${style.fontStyle}"`);
    }

    // Text alignment
    if (style.textAnchor && style.textAnchor !== 'start') {
      attributes.push(`text-anchor="${style.textAnchor}"`);
    }
    if (style.dominantBaseline && style.dominantBaseline !== 'auto') {
      attributes.push(`dominant-baseline="${style.dominantBaseline}"`);
    }

    // Spacing
    if (style.letterSpacing && style.letterSpacing !== 'normal') {
      attributes.push(`letter-spacing="${style.letterSpacing}"`);
    }

    // Stroke (outlined text)
    if (style.stroke && style.strokeWidth > 0) {
      attributes.push(`stroke="${style.stroke}"`);
      attributes.push(`stroke-width="${style.strokeWidth}"`);
      attributes.push(`stroke-opacity="${style.strokeOpacity || 1}"`);
    }

    // Effects (filters)
    const filters = [];
    if (style.glow) filters.push(`url(#text-glow-${overlayId})`);
    if (style.shadow) filters.push(`url(#text-shadow-${overlayId})`);
    if (style.blur) filters.push(`url(#text-blur-${overlayId})`);
    if (filters.length > 0) {
      attributes.push(`filter="${filters.join(' ')}"`);
    }

    // Inherit pointer events from parent
    attributes.push(`style="pointer-events: inherit; cursor: inherit; user-select: none;"`);

    return attributes;
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
    if (style.pattern) {
      defs.push(this._createPatternDef(style.pattern, overlayId));
    }
    if (style.glow) {
      defs.push(this._createGlowFilter(style.glow, overlayId));
    }
    if (style.shadow) {
      defs.push(this._createShadowFilter(style.shadow, overlayId));
    }
    if (style.blur) {
      defs.push(this._createBlurFilter(style.blur, overlayId));
    }

    return defs.length > 0 ? `<defs>${defs.join('\n')}</defs>` : '';
  }

  /**
   * Build special effects elements
   * @private
   */
  static _buildDecorations(content, x, y, style, overlayId, container, defaults = {}) {
    const decorations = [];

    if (style.bracket_style) {
      decorations.push(this._buildBrackets(content, x, y, style, overlayId, container));
    }
    if (style.highlight) {
      decorations.push(this._buildHighlight(content, x, y, style, overlayId, container, defaults));
    }
    if (style.status_indicator) {
      decorations.push(this._buildStatusIndicator(content, x, y, style, overlayId, container, defaults));
    }

    return decorations.filter(Boolean).join('\n');
  }

  /**
   * Build LCARS-style brackets using the generalized BracketRenderer
   * @private
   * @param {string} textContent - Text content for measurement
   * @param {number} x - Text x position
   * @param {number} y - Text y position
   * @param {Object} textStyle - Resolved text style configuration
   * @param {string} overlayId - Overlay ID for unique identification
   * @returns {string} SVG markup for LCARS brackets
   */
  static _buildBrackets(textContent, x, y, textStyle, overlayId, container) {
    const bbox = this._getTextBBox(content, x, y, style, container);

    const bracketConfig = {
      enabled: true,
      style: style.bracket_style,
      color: style.bracket_color || style.color,
      width: style.bracket_width,
      gap: style.bracket_gap,
      extension: style.bracket_extension,
      opacity: style.bracket_opacity,
      corners: style.bracket_corners,
      sides: style.bracket_sides,
      bracket_width: style.bracket_physical_width,
      bracket_height: style.bracket_height,
      bracket_radius: style.bracket_radius,
      border_top: style.border_top,
      border_left: style.border_left,
      border_right: style.border_right,
      border_bottom: style.border_bottom,
      border_color: style.border_color,
      border_radius: style.border_radius,
      inner_factor: style.inner_factor,
      hybrid_mode: style.hybrid_mode
    };

    return BracketRenderer.render(bbox.width, bbox.height, bracketConfig, overlayId);
  }

  /**
   * Build highlight background with precise measurements and coordinate transformation
   * @private
   */
  static _buildHighlight(content, x, y, style, overlayId, container, defaults = {}) {
    const bbox = this._getTextBBox(content, x, y, style, container);
    const padding = defaults.highlight_padding || 2;

    const highlightColor = typeof style.highlight === 'string' ?
      style.highlight : 'var(--lcars-blue-light)';
    const highlightOpacity = style.highlight_opacity || defaults.highlight_opacity || 0.3;

    return `<rect x="${bbox.left - padding}" y="${bbox.top - padding}"
                  width="${bbox.width + padding * 2}" height="${bbox.height + padding * 2}"
                  fill="${highlightColor}" fill-opacity="${highlightOpacity}"
                  data-decoration="highlight"/>`;
  }

  /**
   * Build status indicator with precise positioning and proper coordinate transformation
   * @private
   * @param {number} x - Text x position
   * @param {number} y - Text y position
   * @param {Object} textStyle - Resolved text style configuration
   * @param {string} overlayId - Overlay ID for unique identification
   * @returns {string} SVG markup for status indicator
   */
  static _buildStatusIndicator(content, x, y, style, overlayId, container, defaults = {}) {
    const bbox = this._getTextBBox(content, x, y, style, container);
    const fontSize = parseFloat(style.fontSize) || 16;
    const indicatorSize = style.status_indicator_size !== null && style.status_indicator_size !== undefined ?
      style.status_indicator_size :
      (fontSize * (defaults.status_indicator_size_ratio || 0.3));

    const position = style.status_indicator_position || 'left-center';
    const statusColor = typeof style.status_indicator === 'string' ?
      style.status_indicator :
      (defaults.status_indicator_color || 'var(--lcars-green)');

    // Calculate position based on bbox
    let cx = bbox.centerX, cy = bbox.centerY;
    const padding = style.status_indicator_padding !== null && style.status_indicator_padding !== undefined ?
      style.status_indicator_padding :
      (defaults.status_indicator_padding || indicatorSize);

    switch (position) {
      case 'left':
      case 'left-center':
        cx = bbox.left - padding - indicatorSize;
        cy = bbox.centerY;
        break;
      case 'right':
      case 'right-center':
        cx = bbox.right + padding + indicatorSize;
        cy = bbox.centerY;
        break;
      case 'top':
        cx = bbox.centerX;
        cy = bbox.top - padding - indicatorSize;
        break;
      case 'bottom':
        cx = bbox.centerX;
        cy = bbox.bottom + padding + indicatorSize;
        break;
      case 'top-left':
        cx = bbox.left - padding - indicatorSize;
        cy = bbox.top - padding - indicatorSize;
        break;
      case 'top-right':
        cx = bbox.right + padding + indicatorSize;
        cy = bbox.top - padding - indicatorSize;
        break;
      case 'bottom-left':
        cx = bbox.left - padding - indicatorSize;
        cy = bbox.bottom + padding + indicatorSize;
        break;
      case 'bottom-right':
        cx = bbox.right + padding + indicatorSize;
        cy = bbox.bottom + padding + indicatorSize;
        break;
      case 'center':
        cx = bbox.centerX;
        cy = bbox.centerY;
        break;
    }

    return `<circle cx="${cx}" cy="${cy}" r="${indicatorSize}"
                    fill="${statusColor}"
                    data-status-pos="${position}"
                    data-decoration="status-indicator"/>`;
  }

  /**
   * Build metadata object with text measurements and style information
   * Includes status indicator adjustments for attachment points AND bbox
   * @private
   */
  static _buildMetadata(content, x, y, style, container) {
    let bbox = this._getTextBBox(content, x, y, style, container);

    // DEBUG: Log status_indicator info and original bbox
    cblcarsLog.trace(`[TextRenderer._buildMetadata] status_indicator=${style.status_indicator}, position=${style.status_indicator_position}, size=${style.status_indicator_size}, padding=${style.status_indicator_padding}`);
    cblcarsLog.trace(`[TextRenderer._buildMetadata] ORIGINAL bbox: left=${bbox.left}, right=${bbox.right}, width=${bbox.width}`);

    // Default attachment points based on text bbox
    const attachmentPoints = {
      center: [bbox.centerX, bbox.centerY],
      left: [bbox.left, bbox.centerY],
      right: [bbox.right, bbox.centerY],
      top: [bbox.centerX, bbox.top],
      bottom: [bbox.centerX, bbox.bottom],
      topLeft: [bbox.left, bbox.top],
      topRight: [bbox.right, bbox.top],
      bottomLeft: [bbox.left, bbox.bottom],
      bottomRight: [bbox.right, bbox.bottom]
    };

    // ✅ FIXED: Adjust attachment points AND bbox if status indicator is present
    if (style.status_indicator) {
      const fontSize = parseFloat(style.fontSize) || 16;
      const indicatorSize = style.status_indicator_size !== null && style.status_indicator_size !== undefined ?
        style.status_indicator_size :
        (fontSize * 0.3); // Default ratio

      const position = style.status_indicator_position || 'left-center';
      const padding = style.status_indicator_padding !== null && style.status_indicator_padding !== undefined ?
        style.status_indicator_padding :
        indicatorSize;

      // Adjust attachment points based on status indicator position
      switch (position) {
        case 'left':
        case 'left-center':
          const leftCx = bbox.left - padding - indicatorSize * 2; // Center - radius to get left edge
          attachmentPoints.left = [leftCx, bbox.centerY];
          attachmentPoints.topLeft = [leftCx, bbox.top];
          attachmentPoints.bottomLeft = [leftCx, bbox.bottom];
          break;
        case 'right':
        case 'right-center':
          const rightCx = bbox.right + padding + indicatorSize * 2; // Center + radius to get right edge
          attachmentPoints.right = [rightCx, bbox.centerY];
          attachmentPoints.topRight = [rightCx, bbox.top];
          attachmentPoints.bottomRight = [rightCx, bbox.bottom];
          break;
        case 'top':
          const topCy = bbox.top - padding - indicatorSize * 2; // Center - radius to get top edge
          attachmentPoints.top = [bbox.centerX, topCy];
          attachmentPoints.topLeft = [bbox.left, topCy];
          attachmentPoints.topRight = [bbox.right, topCy];
          break;
        case 'bottom':
          const bottomCy = bbox.bottom + padding + indicatorSize * 2; // Center + radius to get bottom edge
          attachmentPoints.bottom = [bbox.centerX, bottomCy];
          attachmentPoints.bottomLeft = [bbox.left, bottomCy];
          attachmentPoints.bottomRight = [bbox.right, bottomCy];
          break;
        case 'top-left':
          const topLeftCx = bbox.left - padding - indicatorSize * 2;
          const topLeftCy = bbox.top - padding - indicatorSize * 2;
          attachmentPoints.topLeft = [topLeftCx, topLeftCy];
          break;
        case 'top-right':
          const topRightCx = bbox.right + padding + indicatorSize * 2;
          const topRightCy = bbox.top - padding - indicatorSize * 2;
          attachmentPoints.topRight = [topRightCx, topRightCy];
          break;
        case 'bottom-left':
          const bottomLeftCx = bbox.left - padding - indicatorSize * 2;
          const bottomLeftCy = bbox.bottom + padding + indicatorSize * 2;
          attachmentPoints.bottomLeft = [bottomLeftCx, bottomLeftCy];
          break;
        case 'bottom-right':
          const bottomRightCx = bbox.right + padding + indicatorSize * 2;
          const bottomRightCy = bbox.bottom + padding + indicatorSize * 2;
          attachmentPoints.bottomRight = [bottomRightCx, bottomRightCy];
          break;
      }

      // ✅ NEW: Expand bbox to include status indicator
      // This ensures the bbox covers the entire visual element including the status indicator
      const totalIndicatorSpace = padding + indicatorSize * 2; // indicator diameter
      switch (position) {
        case 'left':
        case 'left-center':
          bbox = {
            ...bbox,
            left: bbox.left - totalIndicatorSpace,
            width: bbox.width + totalIndicatorSpace,
            centerX: bbox.left - totalIndicatorSpace / 2 + (bbox.width + totalIndicatorSpace) / 2
          };
          break;
        case 'right':
        case 'right-center':
          bbox = {
            ...bbox,
            right: bbox.right + totalIndicatorSpace,
            width: bbox.width + totalIndicatorSpace,
            centerX: bbox.left + (bbox.width + totalIndicatorSpace) / 2
          };
          break;
        case 'top':
          bbox = {
            ...bbox,
            top: bbox.top - totalIndicatorSpace,
            height: bbox.height + totalIndicatorSpace,
            centerY: bbox.top - totalIndicatorSpace / 2 + (bbox.height + totalIndicatorSpace) / 2
          };
          break;
        case 'bottom':
          bbox = {
            ...bbox,
            bottom: bbox.bottom + totalIndicatorSpace,
            height: bbox.height + totalIndicatorSpace,
            centerY: bbox.top + (bbox.height + totalIndicatorSpace) / 2
          };
          break;
        case 'top-left':
          bbox = {
            ...bbox,
            left: bbox.left - totalIndicatorSpace,
            top: bbox.top - totalIndicatorSpace,
            width: bbox.width + totalIndicatorSpace,
            height: bbox.height + totalIndicatorSpace,
            centerX: bbox.left - totalIndicatorSpace / 2 + (bbox.width + totalIndicatorSpace) / 2,
            centerY: bbox.top - totalIndicatorSpace / 2 + (bbox.height + totalIndicatorSpace) / 2
          };
          break;
        case 'top-right':
          bbox = {
            ...bbox,
            right: bbox.right + totalIndicatorSpace,
            top: bbox.top - totalIndicatorSpace,
            width: bbox.width + totalIndicatorSpace,
            height: bbox.height + totalIndicatorSpace,
            centerX: bbox.left + (bbox.width + totalIndicatorSpace) / 2,
            centerY: bbox.top - totalIndicatorSpace / 2 + (bbox.height + totalIndicatorSpace) / 2
          };
          break;
        case 'bottom-left':
          bbox = {
            ...bbox,
            left: bbox.left - totalIndicatorSpace,
            bottom: bbox.bottom + totalIndicatorSpace,
            width: bbox.width + totalIndicatorSpace,
            height: bbox.height + totalIndicatorSpace,
            centerX: bbox.left - totalIndicatorSpace / 2 + (bbox.width + totalIndicatorSpace) / 2,
            centerY: bbox.top + (bbox.height + totalIndicatorSpace) / 2
          };
          break;
        case 'bottom-right':
          bbox = {
            ...bbox,
            right: bbox.right + totalIndicatorSpace,
            bottom: bbox.bottom + totalIndicatorSpace,
            width: bbox.width + totalIndicatorSpace,
            height: bbox.height + totalIndicatorSpace,
            centerX: bbox.left + (bbox.width + totalIndicatorSpace) / 2,
            centerY: bbox.top + (bbox.height + totalIndicatorSpace) / 2
          };
          break;
      }

      // DEBUG: Log bbox after expansion
      cblcarsLog.trace(`[TextRenderer._buildMetadata] EXPANDED bbox: left=${bbox.left}, right=${bbox.right}, width=${bbox.width}, totalIndicatorSpace=${padding + indicatorSize * 2}`);
    }

    return {
      bounds: bbox,
      fontSize: parseFloat(style.fontSize) || 16,
      fontFamily: style.fontFamily,
      attachmentPoints
    };
  }

  /**
   * Get text bounding box with proper measurements
   * @private
   */
  static _getTextBBox(content, x, y, style, container) {
    const measurementStyle = {
      ...style,
      fontSize: parseFloat(style.fontSize) || 16
    };
    const font = RendererUtils.buildMeasurementFontString(measurementStyle, container);

    if (style.multiline) {
      const metrics = RendererUtils.measureMultilineText(content, font, style.lineHeight || 1.2, true, container);

      let left = x;
      if (style.textAnchor === 'middle') left = x - metrics.width / 2;
      else if (style.textAnchor === 'end') left = x - metrics.width;

      let top = y - (metrics.lineMetrics[0]?.ascent || 0);
      if (style.dominantBaseline === 'middle' || style.dominantBaseline === 'central') {
        top = y - metrics.height / 2;
      } else if (style.dominantBaseline === 'hanging') {
        top = y;
      }

      return {
        left,
        right: left + metrics.width,
        top,
        bottom: top + metrics.height,
        width: metrics.width,
        height: metrics.height,
        centerX: left + metrics.width / 2,
        centerY: top + metrics.height / 2
      };
    }

    return RendererUtils.getTextBoundingBox(
      content,
      x,
      y,
      font,
      style.textAnchor || 'start',
      style.dominantBaseline || 'auto',
      container
    );
  }

  /**
   * Create gradient definition for text
   * @private
   */
  static _createGradientDef(config, overlayId) {
    const gradientId = `text-gradient-${overlayId}`;

    if (typeof config === 'string') {
      const [color1, color2] = config.split(',').map(c => c.trim());
      return `<linearGradient id="${gradientId}">
                <stop offset="0%" stop-color="${color1 || 'var(--lcars-orange)'}"/>
                <stop offset="100%" stop-color="${color2 || 'var(--lcars-red)'}"/>
              </linearGradient>`;
    }

    // Advanced gradient configuration
    const type = config.type || 'linear';
    const stops = config.stops || [
      { offset: '0%', color: 'var(--lcars-orange)' },
      { offset: '100%', color: 'var(--lcars-red)' }
    ];

    if (type === 'radial') {
      const cx = config.cx || '50%';
      const cy = config.cy || '50%';
      const r = config.r || '50%';
      const stopElements = stops.map(stop =>
        `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`
      ).join('');
      return `<radialGradient id="${gradientId}" cx="${cx}" cy="${cy}" r="${r}">${stopElements}</radialGradient>`;
    }

    const x1 = config.x1 || '0%';
    const y1 = config.y1 || '0%';
    const x2 = config.x2 || '100%';
    const y2 = config.y2 || '0%';
    const stopElements = stops.map(stop =>
      `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`
    ).join('');
    return `<linearGradient id="${gradientId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopElements}</linearGradient>`;
  }

  /**
   * Create pattern definition for text
   * @private
   */
  static _createPatternDef(config, overlayId) {
    const patternId = `text-pattern-${overlayId}`;

    if (typeof config === 'string') {
      switch (config) {
        case 'dots':
          return `<pattern id="${patternId}" patternUnits="userSpaceOnUse" width="8" height="8">
                    <circle cx="4" cy="4" r="1" fill="currentColor"/>
                  </pattern>`;
        case 'lines':
          return `<pattern id="${patternId}" patternUnits="userSpaceOnUse" width="4" height="4">
                    <path d="M 0,4 l 4,-4 M -1,1 l 2,-2 M 3,5 l 2,-2" stroke="currentColor" stroke-width="1"/>
                  </pattern>`;
        default:
          return '';
      }
    }

    const width = config.width || 10;
    const height = config.height || 10;
    const patternUnits = config.patternUnits || 'userSpaceOnUse';
    return `<pattern id="${patternId}" patternUnits="${patternUnits}" width="${width}" height="${height}">${config.content || ''}</pattern>`;
  }

  /**
   * Create glow filter for text
   * @private
   */
  static _createGlowFilter(config, overlayId) {
    const color = typeof config === 'string' ? config : config.color || 'var(--lcars-orange)';
    const blur = typeof config === 'object' ? config.blur || 3 : 3;
    const intensity = typeof config === 'object' ? config.intensity || 1 : 1;

    return `<filter id="text-glow-${overlayId}">
              <feGaussianBlur stdDeviation="${blur}" result="blur"/>
              <feFlood flood-color="${color}" flood-opacity="${intensity}" result="color"/>
              <feComposite in="color" in2="blur" operator="in" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>`;
  }

  /**
   * Create shadow filter for text
   * @private
   */
  static _createShadowFilter(config, overlayId) {
    let offsetX = 2, offsetY = 2, blur = 2, color = 'rgba(0,0,0,0.5)';

    if (typeof config === 'string') {
      [offsetX, offsetY, blur, color] = config.split(' ');
    } else {
      offsetX = config.offsetX || 2;
      offsetY = config.offsetY || 2;
      blur = config.blur || 2;
      color = config.color || 'rgba(0,0,0,0.5)';
    }

    return `<filter id="text-shadow-${overlayId}">
              <feDropShadow dx="${offsetX}" dy="${offsetY}" stdDeviation="${blur}" flood-color="${color}"/>
            </filter>`;
  }

  /**
   * Create blur filter for text
   * @private
   */
  static _createBlurFilter(config, overlayId) {
    const blur = typeof config === 'number' ? config : 1;
    return `<filter id="text-blur-${overlayId}">
              <feGaussianBlur stdDeviation="${blur}"/>
            </filter>`;
  }

  /**
   * Escape XML special characters
   * @private
   */
  static _escapeXml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Render a simple fallback text when enhanced rendering fails
   * @private
   */
  static _renderFallback(content, x, y, style) {
    const escapedContent = this._escapeXml(content);
    const color = style.color || 'var(--lcars-orange)';
    const fontSize = style.fontSize || '16px';

    return {
      markup: `<text x="${x}" y="${y}" fill="${color}" font-size="${fontSize}">${escapedContent}</text>`,
      metadata: null
    };
  }
}