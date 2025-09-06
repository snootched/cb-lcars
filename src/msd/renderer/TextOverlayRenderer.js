/**
 * Text Overlay Renderer - Advanced text rendering with comprehensive styling support
 * Provides rich text styling features similar to LineOverlayRenderer
 */

import { PositionResolver } from './PositionResolver.js';
import { RendererUtils } from './RendererUtils.js';

export class TextOverlayRenderer {
  constructor() {
    // Pre-defined caches for performance optimization
    this.gradientCache = new Map();
    this.patternCache = new Map();
    this.filterCache = new Map();
  }

  /**
   * Render a text overlay with full styling support
   * @param {Object} overlay - Text overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @returns {string} Complete SVG markup for the styled text
   */
  static render(overlay, anchors, viewBox, svgContainer) {
    // Create instance for non-static methods
    const instance = new TextOverlayRenderer();
    instance.container = svgContainer; // Set the container for the instance
    instance.viewBox = viewBox; // Also store viewBox for reference
    return instance.renderText(overlay, anchors, viewBox);
  }

  /**
   * Instance method for comprehensive text rendering
   * @param {Object} overlay - Text overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @returns {string} Complete SVG markup for the styled text
   */
  renderText(overlay, anchors, viewBox) {
    const position = PositionResolver.resolvePosition(overlay.position, anchors);
    if (!position) {
      console.warn('[TextOverlayRenderer] Text overlay position could not be resolved:', overlay.id);
      return '';
    }
    const [x, y] = position;

    try {
      const style = overlay.finalStyle || overlay.style || {};
      const textStyle = this._resolveTextStyles(style, overlay.id);

      // NEW: adopt computed font when 'inherit' (prevents initial fallback mismatch)
      if (this.container && typeof window !== 'undefined') {
        try {
          const host = this.container;
          const cs = host ? getComputedStyle(host) : null;
            if (cs) {
              if (textStyle.fontFamily === 'inherit' && cs.fontFamily) {
                textStyle.fontFamily = cs.fontFamily;
              }
              // Update fontSize if defaulted / unreasonable
              if ((!style.font_size && !style.fontSize) && cs.fontSize) {
                const px = parseFloat(cs.fontSize);
                if (!isNaN(px) && px > 0) textStyle.fontSize = px;
              }
            }
        } catch (_) {}
      }

      const animationAttributes = this._prepareAnimationAttributes(overlay, style);
      const textContent = this._resolveTextContent(overlay, style);
      if (!textContent) {
        console.warn(`[TextOverlayRenderer] No text content for overlay ${overlay.id}`);
        return '';
      }
      textStyle._cachedContent = textContent;

      // NEW: single early measurement (width/height) used by decorations & emitted as attributes
      const measure = this._measureTextBlock(textContent, x, y, textStyle);

      const svgParts = [
        this._buildDefinitions(textStyle, overlay.id),
        this._buildMainText(textContent, x, y, textStyle, overlay.id, animationAttributes),
        this._buildTextDecorations(textContent, x, y, textStyle, overlay.id),
        this._buildEffects(textContent, x, y, textStyle, overlay.id)
      ].filter(Boolean);

      console.log(`[TextOverlayRenderer] Rendered enhanced text ${overlay.id} with ${textStyle.features.length} features`);

      return `<g data-overlay-id="${overlay.id}"
                  data-overlay-type="text"
                  data-text-features="${textStyle.features.join(',')}"
                  data-animation-ready="${!!animationAttributes.hasAnimations}"
                  data-text-width="${measure.width || 0}"
                  data-text-height="${measure.height || 0}"
                  data-font-family="${textStyle.fontFamily}"
                  data-font-size="${textStyle.fontSize}"
                  data-font-stabilized="0">
                ${svgParts.join('\n')}
              </g>`;
    } catch (error) {
      console.error(`[TextOverlayRenderer] Enhanced rendering failed for text ${overlay.id}:`, error);
      return this._renderFallbackText(overlay, x, y);
    }
  }

  /**
   * Resolve comprehensive text styling from configuration
   * @private
   * @param {Object} style - Final resolved style object
   * @param {string} overlayId - Overlay ID for unique identifiers
   * @returns {Object} Complete text style configuration
   */
  _resolveTextStyles(style, overlayId) {
    const textStyle = {
      // Core text properties
      color: style.color || style.fill || 'var(--lcars-orange)',
      fontSize: Number(style.font_size || style.fontSize || 16),
      fontFamily: style.font_family || style.fontFamily || 'inherit',
      fontWeight: style.font_weight || style.fontWeight || 'normal',
      fontStyle: style.font_style || style.fontStyle || 'normal',

      // Text positioning and alignment
      textAnchor: (style.text_anchor || style.textAnchor || 'start').toLowerCase(),
      dominantBaseline: (style.dominant_baseline || style.dominantBaseline || 'auto').toLowerCase(),
      alignmentBaseline: (style.alignment_baseline || style.alignmentBaseline || 'auto').toLowerCase(),

      // Advanced text styling
      letterSpacing: style.letter_spacing || style.letterSpacing || 'normal',
      wordSpacing: style.word_spacing || style.wordSpacing || 'normal',
      textDecoration: style.text_decoration || style.textDecoration || 'none',

      // Opacity and visibility
      opacity: Number(style.opacity || 1),
      visibility: style.visibility || 'visible',

      // Stroke properties for outlined text
      stroke: style.stroke || null,
      strokeWidth: Number(style.stroke_width || style.strokeWidth || 0),
      strokeOpacity: Number(style.stroke_opacity || style.strokeOpacity || 1),
      strokeLinecap: (style.stroke_linecap || style.strokeLinecap || 'butt').toLowerCase(),
      strokeLinejoin: (style.stroke_linejoin || style.strokeLinejoin || 'miter').toLowerCase(),
      strokeDasharray: style.stroke_dasharray || style.strokeDasharray || null,
      strokeDashoffset: Number(style.stroke_dashoffset || style.strokeDashoffset || 0),

      // Advanced fill properties
      gradient: this._parseGradientConfig(style.gradient),
      pattern: this._parsePatternConfig(style.pattern),

      // Effects
      glow: this._parseGlowConfig(style.glow),
      shadow: this._parseShadowConfig(style.shadow),
      blur: this._parseBlurConfig(style.blur),

      // Multi-line text support
      multiline: style.multiline || false,
      lineHeight: Number(style.line_height || style.lineHeight || 1.2),
      maxWidth: Number(style.max_width || style.maxWidth || 0),
      textWrapping: style.text_wrapping || style.textWrapping || 'none',

      // Animation states (for future anime.js integration)
      animatable: style.animatable !== false,
      pulseSpeed: Number(style.pulse_speed || 0),
      fadeSpeed: Number(style.fade_speed || 0),
      typewriterSpeed: Number(style.typewriter_speed || 0),

      // LCARS-specific features
      status_indicator: style.status_indicator || null,
      status_indicator_position: style.status_indicator_position || style.statusIndicatorPosition || 'left-center',
      bracket_style: style.bracket_style || null,
      highlight: style.highlight || false,

      // Track enabled features for optimization
      features: []
    };

    // Build feature list for conditional rendering
    if (textStyle.gradient) textStyle.features.push('gradient');
    if (textStyle.pattern) textStyle.features.push('pattern');
    if (textStyle.stroke && textStyle.strokeWidth > 0) textStyle.features.push('stroke');
    if (textStyle.glow) textStyle.features.push('glow');
    if (textStyle.shadow) textStyle.features.push('shadow');
    if (textStyle.blur) textStyle.features.push('blur');
    if (textStyle.multiline) textStyle.features.push('multiline');
    if (textStyle.pulseSpeed > 0) textStyle.features.push('pulse');
    if (textStyle.fadeSpeed > 0) textStyle.features.push('fade');
    if (textStyle.typewriterSpeed > 0) textStyle.features.push('typewriter');
    if (textStyle.status_indicator) textStyle.features.push('status');
    if (textStyle.bracket_style) textStyle.features.push('brackets');
    if (textStyle.highlight) textStyle.features.push('highlight');

    return textStyle;
  }

  /**
   * Resolve text content from various sources
   * @private
   */
  _resolveTextContent(overlay, style) {
    return style.value || overlay.text || overlay.content || '';
  }

  /**
   * Build SVG definitions for gradients, patterns, and effects
   * @private
   */
  _buildDefinitions(textStyle, overlayId) {
    const defs = [];

    // Gradients
    if (textStyle.gradient) {
      defs.push(this._createGradientDefinition(textStyle.gradient, overlayId));
    }

    // Patterns
    if (textStyle.pattern) {
      defs.push(this._createPatternDefinition(textStyle.pattern, overlayId));
    }

    // Effects (filters)
    if (textStyle.glow) {
      defs.push(this._createGlowFilter(textStyle.glow, overlayId));
    }

    if (textStyle.shadow) {
      defs.push(this._createShadowFilter(textStyle.shadow, overlayId));
    }

    if (textStyle.blur) {
      defs.push(this._createBlurFilter(textStyle.blur, overlayId));
    }

    if (defs.length === 0) {
      return '';
    }

    return `<defs>${defs.join('\n')}</defs>`;
  }

  /**
   * Build the main text element with all styling
   * @private
   */
  _buildMainText(textContent, x, y, textStyle, overlayId, animationAttributes) {
    if (textStyle.multiline) {
      return this._buildMultilineText(textContent, x, y, textStyle, overlayId, animationAttributes);
    }

    const attributes = [];

    // Position
    attributes.push(`x="${x}"`);
    attributes.push(`y="${y}"`);

    // Core text styling
    this._applyTextAttributes(attributes, textStyle, overlayId);

    // Animation attributes (for future anime.js integration)
    attributes.push(...animationAttributes.textAttributes);

    const escapedText = this.escapeXml(textContent);
    return `<text ${attributes.join(' ')}>${escapedText}</text>`;
  }

  /**
   * Build multiline text with proper line spacing
   * @private
   */
  _buildMultilineText(textContent, x, y, textStyle, overlayId, animationAttributes) {
    const lines = textContent.split('\n');
    const lineHeight = textStyle.fontSize * textStyle.lineHeight;
    const tspanElements = [];

    lines.forEach((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      const escapedLine = this.escapeXml(line);
      tspanElements.push(`<tspan x="${x}" dy="${dy}">${escapedLine}</tspan>`);
    });

    const attributes = [];

    // Position (y for first line)
    attributes.push(`y="${y}"`);

    // Core text styling
    this._applyTextAttributes(attributes, textStyle, overlayId);

    // Animation attributes
    attributes.push(...animationAttributes.textAttributes);

    return `<text ${attributes.join(' ')}>${tspanElements.join('')}</text>`;
  }

  /**
   * Apply common text attributes
   * @private
   */
  _applyTextAttributes(attributes, textStyle, overlayId) {
    // Fill styling
    if (textStyle.gradient) {
      attributes.push(`fill="url(#text-gradient-${overlayId})"`);
    } else if (textStyle.pattern) {
      attributes.push(`fill="url(#text-pattern-${overlayId})"`);
    } else {
      attributes.push(`fill="${textStyle.color}"`);
    }

    attributes.push(`fill-opacity="${textStyle.opacity}"`);

    // Font styling
    attributes.push(`font-size="${textStyle.fontSize}"`);
    if (textStyle.fontFamily !== 'inherit') {
      attributes.push(`font-family="${textStyle.fontFamily}"`);
    }
    if (textStyle.fontWeight !== 'normal') {
      attributes.push(`font-weight="${textStyle.fontWeight}"`);
    }
    if (textStyle.fontStyle !== 'normal') {
      attributes.push(`font-style="${textStyle.fontStyle}"`);
    }

    // Text alignment
    if (textStyle.textAnchor !== 'start') {
      attributes.push(`text-anchor="${textStyle.textAnchor}"`);
    }
    if (textStyle.dominantBaseline !== 'auto') {
      attributes.push(`dominant-baseline="${textStyle.dominantBaseline}"`);
    }
    if (textStyle.alignmentBaseline !== 'auto') {
      attributes.push(`alignment-baseline="${textStyle.alignmentBaseline}"`);
    }

    // Spacing
    if (textStyle.letterSpacing !== 'normal') {
      attributes.push(`letter-spacing="${textStyle.letterSpacing}"`);
    }
    if (textStyle.wordSpacing !== 'normal') {
      attributes.push(`word-spacing="${textStyle.wordSpacing}"`);
    }

    // Text decoration
    if (textStyle.textDecoration !== 'none') {
      attributes.push(`text-decoration="${textStyle.textDecoration}"`);
    }

    // Stroke properties
    if (textStyle.stroke && textStyle.strokeWidth > 0) {
      attributes.push(`stroke="${textStyle.stroke}"`);
      attributes.push(`stroke-width="${textStyle.strokeWidth}"`);
      attributes.push(`stroke-opacity="${textStyle.strokeOpacity}"`);
      attributes.push(`stroke-linecap="${textStyle.strokeLinecap}"`);
      attributes.push(`stroke-linejoin="${textStyle.strokeLinejoin}"`);

      if (textStyle.strokeDasharray) {
        attributes.push(`stroke-dasharray="${textStyle.strokeDasharray}"`);
        if (textStyle.strokeDashoffset !== 0) {
          attributes.push(`stroke-dashoffset="${textStyle.strokeDashoffset}"`);
        }
      }
    }

    // Visibility
    if (textStyle.visibility !== 'visible') {
      attributes.push(`visibility="${textStyle.visibility}"`);
    }

    // Effects
    const filters = [];
    if (textStyle.glow) filters.push(`url(#text-glow-${overlayId})`);
    if (textStyle.shadow) filters.push(`url(#text-shadow-${overlayId})`);
    if (textStyle.blur) filters.push(`url(#text-blur-${overlayId})`);
    if (filters.length > 0) {
      attributes.push(`filter="${filters.join(' ')}"`);
    }
  }

  /**
   * Build text decoration elements (brackets, highlights, etc.)
   * @private
   */
  _buildTextDecorations(textContent, x, y, textStyle, overlayId) {
    const decorations = [];

    // LCARS-style brackets
    if (textStyle.bracket_style) {
      decorations.push(this._buildBrackets(textContent, x, y, textStyle, overlayId));
    }

    // Highlight background
    if (textStyle.highlight) {
      decorations.push(this._buildHighlight(textContent, x, y, textStyle, overlayId));
    }

    // Status indicator
    if (textStyle.status_indicator) {
      decorations.push(this._buildStatusIndicator(x, y, textStyle, overlayId));
    }

    return decorations.filter(Boolean).join('\n');
  }

  /**
   * Build special effects elements
   * @private
   */
  _buildEffects(textContent, x, y, textStyle, overlayId) {
    const effects = [];

    // Future: Add text-specific animation elements
    if (textStyle.features.includes('typewriter')) {
      // Placeholder for typewriter animation elements
    }

    if (textStyle.features.includes('pulse')) {
      // Placeholder for pulse animation elements
    }

    if (textStyle.features.includes('fade')) {
      // Placeholder for fade animation elements
    }

    return effects.join('\n');
  }

  /**
   * Build LCARS-style brackets with precise measurements
   * @private
   * @param {string} textContent - Text content for measurement
   * @param {number} x - Text x position
   * @param {number} y - Text y position
   * @param {Object} textStyle - Resolved text style configuration
   * @param {string} overlayId - Overlay ID for unique identification
   * @returns {string} SVG markup for LCARS brackets
   */
  _buildBrackets(textContent, x, y, textStyle, overlayId) {
    // Use measurement-adjusted font (prevents width overestimation)
    const font = RendererUtils.buildMeasurementFontString(textStyle, this.container);
    let bbox;

    if (textStyle.multiline) {
      // For multiline text, get comprehensive measurements
      const multilineMetrics = RendererUtils.measureMultilineText(textContent, font, textStyle.lineHeight);
      // Create bbox-like object from multiline measurements
      let left = x;
      if (textStyle.textAnchor === 'middle') {
        left = x - multilineMetrics.width / 2;
      } else if (textStyle.textAnchor === 'end') {
        left = x - multilineMetrics.width;
      }

      let top = y - multilineMetrics.lineMetrics[0]?.ascent || 0;
      if (textStyle.dominantBaseline === 'middle') {
        top = y - multilineMetrics.height / 2;
      } else if (textStyle.dominantBaseline === 'hanging') {
        top = y;
      }

      bbox = {
        left,
        right: left + multilineMetrics.width,
        top,
        bottom: top + multilineMetrics.height,
        width: multilineMetrics.width,
        height: multilineMetrics.height
      };
    } else {
      // Single line text - use standard bounding box
      bbox = RendererUtils.getTextBoundingBox(
        textContent,
        x,
        y,
        font,
        textStyle.textAnchor,
        textStyle.dominantBaseline
      );
    }

    const bracketWidth = 8;
    const padding = 4;
    const extraHeight = 4; // Additional height for visual appeal

    const leftX = bbox.left - bracketWidth - padding;
    const rightX = bbox.right + padding;
    const topY = bbox.top - extraHeight;
    const bottomY = bbox.bottom + extraHeight;

    const bracketColor = textStyle.color;
    const strokeWidth = Math.max(1, textStyle.fontSize / 16);

    return `<g data-decoration="brackets">
              <path d="M ${leftX + bracketWidth} ${topY} L ${leftX} ${topY} L ${leftX} ${bottomY} L ${leftX + bracketWidth} ${bottomY}"
                    stroke="${bracketColor}" stroke-width="${strokeWidth}" fill="none"/>
              <path d="M ${rightX - bracketWidth} ${topY} L ${rightX} ${topY} L ${rightX} ${bottomY} L ${rightX - bracketWidth} ${bottomY}"
                    stroke="${bracketColor}" stroke-width="${strokeWidth}" fill="none"/>
            </g>`;
  }

  /**
   * Build highlight background with precise measurements and coordinate transformation
   * @private
   */
  _buildHighlight(textContent, x, y, textStyle, overlayId) {
    const font = RendererUtils.buildMeasurementFontString(textStyle, this.container);
    let bbox;

    if (textStyle.multiline) {
      // For multiline text, get comprehensive measurements with coordinate transformation
      const multilineMetrics = RendererUtils.measureMultilineText(
        textContent,
        font,
        textStyle.lineHeight,
        true,
        this.container // Pass container for coordinate transformation
      );

      // Create bbox-like object from multiline measurements
      let left = x;
      if (textStyle.textAnchor === 'middle') {
        left = x - multilineMetrics.width / 2;
      } else if (textStyle.textAnchor === 'end') {
        left = x - multilineMetrics.width;
      }

      let top = y - multilineMetrics.lineMetrics[0]?.ascent || 0;
      if (textStyle.dominantBaseline === 'middle') {
        top = y - multilineMetrics.height / 2;
      } else if (textStyle.dominantBaseline === 'hanging') {
        top = y;
      }

      bbox = {
        left,
        right: left + multilineMetrics.width,
        top,
        bottom: top + multilineMetrics.height,
        width: multilineMetrics.width,
        height: multilineMetrics.height
      };
    } else {
      // Single line text - use standard bounding box with coordinate transformation
      bbox = RendererUtils.getTextBoundingBox(
        textContent,
        x,
        y,
        font,
        textStyle.textAnchor,
        textStyle.dominantBaseline,
        this.container // Pass container for coordinate transformation
      );
    }

    // Get properly scaled padding
    const transformInfo = RendererUtils._getSvgTransformInfo(this.container);
    const padding = transformInfo ? transformInfo.pixelToViewBox(2) : 2;

    const highlightX = bbox.left - padding;
    const highlightY = bbox.top - padding;
    const highlightWidth = bbox.width + (padding * 2);
    const highlightHeight = bbox.height + (padding * 2);

    const highlightColor = typeof textStyle.highlight === 'string' ?
      textStyle.highlight : 'var(--lcars-blue-light)';
    const highlightOpacity = typeof textStyle.highlight_opacity === 'number' ?
      textStyle.highlight_opacity : 0.3;

    return `<rect x="${highlightX}" y="${highlightY}"
                  width="${highlightWidth}" height="${highlightHeight}"
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
  _buildStatusIndicator(x, y, textStyle, overlayId) {
    const indicatorSize = textStyle.fontSize * 0.4;
    const statusColor = typeof textStyle.status_indicator === 'string'
      ? textStyle.status_indicator
      : 'var(--lcars-green)';

    const position = textStyle.status_indicator_position || 'left-center';

    // Replace base font with measurement-adjusted font
    const textContent = textStyle._cachedContent || textStyle.value || '';
    const font = RendererUtils.buildMeasurementFontString(textStyle, this.container);

    // Get the SVG transform info for debugging and padding calculation
    const transformInfo = RendererUtils._getSvgTransformInfo(this.container);

    console.log(`[TextOverlayRenderer] Transform info for ${overlayId}:`, {
      transformInfo,
      containerTag: this.container?.tagName,
      hasSvg: !!this.container?.querySelector('svg')
    });

    let bbox;
    if (textStyle.multiline) {
      // For multiline text, get measurements and let RendererUtils handle coordinate transformation
      const multilineMetrics = RendererUtils.measureMultilineText(
        textContent,
        font,
        textStyle.lineHeight,
        true,
        this.container // Let RendererUtils handle the transformation
      );

      // Use the already-transformed measurements directly
      let left = x;
      if (textStyle.textAnchor === 'middle') {
        left = x - multilineMetrics.width / 2;
      } else if (textStyle.textAnchor === 'end') {
        left = x - multilineMetrics.width;
      }

      let top = y - (multilineMetrics.lineMetrics[0]?.ascent || 0);
      if (textStyle.dominantBaseline === 'middle') {
        top = y - multilineMetrics.height / 2;
      } else if (textStyle.dominantBaseline === 'hanging') {
        top = y;
      }

      bbox = {
        left,
        right: left + multilineMetrics.width,
        top,
        bottom: top + multilineMetrics.height,
        width: multilineMetrics.width,
        height: multilineMetrics.height,
        centerX: left + multilineMetrics.width / 2,
        centerY: top + multilineMetrics.height / 2
      };
    } else {
      // Single line text - get measurements and let RendererUtils handle coordinate transformation
      const textMetrics = RendererUtils.measureText(textContent, font, true, this.container);

      // Use the already-transformed measurements directly
      let left = x;
      if (textStyle.textAnchor === 'middle') {
        left = x - textMetrics.width / 2;
      } else if (textStyle.textAnchor === 'end') {
        left = x - textMetrics.width;
      }

      let top = y - textMetrics.ascent;
      if (textStyle.dominantBaseline === 'middle') {
        top = y - textMetrics.height / 2;
      } else if (textStyle.dominantBaseline === 'hanging') {
        top = y;
      }

      bbox = {
        left,
        right: left + textMetrics.width,
        top,
        bottom: top + textMetrics.height,
        width: textMetrics.width,
        height: textMetrics.height,
        centerX: left + textMetrics.width / 2,
        centerY: top + textMetrics.height / 2
      };
    }

    // Debug logging to trace coordinate issues
    console.log(`[TextOverlayRenderer] Status indicator debug for ${overlayId}:`, {
      textContent,
      x, y,
      textAnchor: textStyle.textAnchor,
      dominantBaseline: textStyle.dominantBaseline,
      position,
      bbox,
      fontSize: textStyle.fontSize,
      hasContainer: !!this.container,
      containerType: this.container?.tagName,
      transformInfo: transformInfo ? {
        scaleX: transformInfo.scaleX,
        scaleY: transformInfo.scaleY,
        viewBox: transformInfo.viewBox
      } : null
    });

    // Calculate indicator position based on actual text bounds (already in correct coordinate space)
    let indicatorX = x, indicatorY = y;

    // Use a consistent padding value - transform pixel padding to viewBox coordinates only once
    const pixelPadding = 8; // 8 pixel padding
    const padding = transformInfo ?
      transformInfo.pixelToViewBox(pixelPadding) :
      indicatorSize; // Fallback to indicator size if no transform info

    switch (position) {
      case 'top-left':
        indicatorX = bbox.left - padding;
        indicatorY = bbox.top - padding;
        break;
      case 'top-right':
        indicatorX = bbox.right + padding;
        indicatorY = bbox.top - padding;
        break;
      case 'bottom-left':
        indicatorX = bbox.left - padding;
        indicatorY = bbox.bottom + padding;
        break;
      case 'bottom-right':
        indicatorX = bbox.right + padding;
        indicatorY = bbox.bottom + padding;
        break;
      case 'top':
        indicatorX = bbox.centerX;
        indicatorY = bbox.top - padding;
        break;
      case 'bottom':
        indicatorX = bbox.centerX;
        indicatorY = bbox.bottom + padding;
        break;
      case 'left-center':
      case 'left':
        indicatorX = bbox.left - padding;
        indicatorY = bbox.centerY;
        break;
      case 'right-center':
      case 'right':
        indicatorX = bbox.right + padding;
        indicatorY = bbox.centerY;
        break;
      case 'center':
        indicatorX = bbox.centerX;
        indicatorY = bbox.centerY;
        break;
      default:
        // fallback to left-center
        indicatorX = bbox.left - padding;
        indicatorY = bbox.centerY;
    }

    console.log(`[TextOverlayRenderer] Status indicator final position for ${overlayId}:`, {
      indicatorX,
      indicatorY,
      padding,
      pixelPadding,
      transformInfo: transformInfo ? 'present' : 'missing'
    });

    return `<circle cx="${indicatorX}" cy="${indicatorY}" r="${indicatorSize}"
                    fill="${statusColor}"
                    data-decoration="status-indicator"/>`;
  }


  /**
   * Create gradient definition for text
   * @private
   */
  _createGradientDefinition(gradientConfig, overlayId) {
    const gradientId = `text-gradient-${overlayId}`;

    if (typeof gradientConfig === 'string') {
      // Simple two-color gradient
      const [color1, color2] = gradientConfig.split(',').map(c => c.trim());
      return `<linearGradient id="${gradientId}">
                <stop offset="0%" stop-color="${color1 || 'var(--lcars-orange)'}"/>
                <stop offset="100%" stop-color="${color2 || 'var(--lcars-red)'}"/>
              </linearGradient>`;
    }

    // Advanced gradient configuration
    const type = gradientConfig.type || 'linear';
    const stops = gradientConfig.stops || [
      { offset: '0%', color: 'var(--lcars-orange)' },
      { offset: '100%', color: 'var(--lcars-red)' }
    ];

    if (type === 'radial') {
      const cx = gradientConfig.cx || '50%';
      const cy = gradientConfig.cy || '50%';
      const r = gradientConfig.r || '50%';

      const stopElements = stops.map(stop =>
        `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`
      ).join('');

      return `<radialGradient id="${gradientId}" cx="${cx}" cy="${cy}" r="${r}">
                ${stopElements}
              </radialGradient>`;
    } else {
      const x1 = gradientConfig.x1 || '0%';
      const y1 = gradientConfig.y1 || '0%';
      const x2 = gradientConfig.x2 || '100%';
      const y2 = gradientConfig.y2 || '0%';

      const stopElements = stops.map(stop =>
        `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`
      ).join('');

      return `<linearGradient id="${gradientId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
                ${stopElements}
              </linearGradient>`;
    }
  }

  /**
   * Create pattern definition for text
   * @private
   */
  _createPatternDefinition(patternConfig, overlayId) {
    const patternId = `text-pattern-${overlayId}`;

    if (typeof patternConfig === 'string') {
      // Simple pattern types
      switch (patternConfig) {
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

    // Advanced pattern configuration
    const width = patternConfig.width || 10;
    const height = patternConfig.height || 10;
    const patternUnits = patternConfig.patternUnits || 'userSpaceOnUse';

    return `<pattern id="${patternId}" patternUnits="${patternUnits}" width="${width}" height="${height}">
              ${patternConfig.content || ''}
            </pattern>`;
  }

  /**
   * Create glow filter for text
   * @private
   */
  _createGlowFilter(glowConfig, overlayId) {
    const filterId = `text-glow-${overlayId}`;

    let color, blur, intensity;
    if (typeof glowConfig === 'string') {
      color = glowConfig;
      blur = 3;
      intensity = 1;
    } else {
      color = glowConfig.color || 'var(--lcars-orange)';
      blur = Number(glowConfig.blur || 3);
      intensity = Number(glowConfig.intensity || 1);
    }

    return `<filter id="${filterId}">
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
  _createShadowFilter(shadowConfig, overlayId) {
    const filterId = `text-shadow-${overlayId}`;

    let offsetX, offsetY, blur, color;
    if (typeof shadowConfig === 'string') {
      [offsetX, offsetY, blur, color] = shadowConfig.split(' ');
      offsetX = Number(offsetX) || 2;
      offsetY = Number(offsetY) || 2;
      blur = Number(blur) || 2;
      color = color || 'rgba(0,0,0,0.5)';
    } else {
      offsetX = Number(shadowConfig.offsetX || 2);
      offsetY = Number(shadowConfig.offsetY || 2);
      blur = Number(shadowConfig.blur || 2);
      color = shadowConfig.color || 'rgba(0,0,0,0.5)';
    }

    return `<filter id="${filterId}">
              <feDropShadow dx="${offsetX}" dy="${offsetY}" stdDeviation="${blur}" flood-color="${color}"/>
            </filter>`;
  }

  /**
   * Create blur filter for text
   * @private
   */
  _createBlurFilter(blurConfig, overlayId) {
    const filterId = `text-blur-${overlayId}`;
    const blur = typeof blurConfig === 'number' ? blurConfig : (Number(blurConfig) || 1);

    return `<filter id="${filterId}">
              <feGaussianBlur stdDeviation="${blur}"/>
            </filter>`;
  }

  /**
   * Parse gradient configuration
   * @private
   */
  _parseGradientConfig(gradientConfig) {
    if (!gradientConfig) return null;

    if (typeof gradientConfig === 'string') {
      return gradientConfig;
    }

    return {
      type: gradientConfig.type || 'linear',
      x1: gradientConfig.x1 || '0%',
      y1: gradientConfig.y1 || '0%',
      x2: gradientConfig.x2 || '100%',
      y2: gradientConfig.y2 || '0%',
      cx: gradientConfig.cx || '50%',
      cy: gradientConfig.cy || '50%',
      r: gradientConfig.r || '50%',
      stops: gradientConfig.stops || []
    };
  }

  /**
   * Parse pattern configuration
   * @private
   */
  _parsePatternConfig(patternConfig) {
    if (!patternConfig) return null;
    return patternConfig;
  }

  /**
   * Parse glow configuration
   * @private
   */
  _parseGlowConfig(glowConfig) {
    if (!glowConfig) return null;
    return glowConfig;
  }

  /**
   * Parse shadow configuration
   * @private
   */
  _parseShadowConfig(shadowConfig) {
    if (!shadowConfig) return null;
    return shadowConfig;
  }

  /**
   * Parse blur configuration
   * @private
   */
  _parseBlurConfig(blurConfig) {
    if (!blurConfig) return null;
    return blurConfig;
  }

  /**
   * Prepare animation attributes for future anime.js integration
   * @private
   */
  _prepareAnimationAttributes(overlay, style) {
    const animationAttributes = {
      textAttributes: [],
      hasAnimations: false
    };

    // Future: Add animation data attributes for anime.js
    if (style.pulse_speed || style.pulseSpeed) {
      animationAttributes.textAttributes.push(`data-pulse-speed="${style.pulse_speed || style.pulseSpeed}"`);
      animationAttributes.hasAnimations = true;
    }

    if (style.fade_speed || style.fadeSpeed) {
      animationAttributes.textAttributes.push(`data-fade-speed="${style.fade_speed || style.fadeSpeed}"`);
      animationAttributes.hasAnimations = true;
    }

    if (style.typewriter_speed || style.typewriterSpeed) {
      animationAttributes.textAttributes.push(`data-typewriter-speed="${style.typewriter_speed || style.typewriterSpeed}"`);
      animationAttributes.hasAnimations = true;
    }

    // Add data attributes for anime.js targeting
    if (animationAttributes.hasAnimations) {
      animationAttributes.textAttributes.push('data-animatable="true"');
    }

    return animationAttributes;
  }

  /**
   * Render a simple fallback text when enhanced rendering fails
   * @private
   */
  _renderFallbackText(overlay, x, y) {
    const style = overlay.finalStyle || overlay.style || {};
    const text = style.value || overlay.text || '';
    const color = style.color || 'var(--lcars-orange)';
    const fontSize = style.font_size || style.fontSize || 16;

    console.warn(`[TextOverlayRenderer] Using fallback rendering for text ${overlay.id}`);

    return `<g data-overlay-id="${overlay.id}" data-overlay-type="text" data-fallback="true">
              <text x="${x}" y="${y}"
                    fill="${color}"
                    font-size="${fontSize}"
                    text-anchor="start"
                    dominant-baseline="auto">
                ${this.escapeXml(text)}
              </text>
            </g>`;
  }

  /**
   * Update text styling dynamically (for future real-time updates)
   * @public
   */
  updateTextStyle(overlayId, newStyle) {
    // Future: Update existing text styles without full re-render
    console.log(`[TextOverlayRenderer] Style update requested for text ${overlayId}`);
  }

  /**
   * Get rendering capabilities and features supported
   * @public
   */
  getCapabilities() {
    return {
      multiline: true,
      gradients: true,
      patterns: true,
      effects: ['glow', 'shadow', 'blur'],
      decorations: ['brackets', 'highlight', 'status'],
      animations: ['pulse', 'fade', 'typewriter'], // Future implementation
      textWrapping: true,
      advancedTypography: true,
      strokeText: true,
      advanced: true
    };
  }

  /**
   * Escape XML special characters
   * @private
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
   * Instance method for XML escaping
   * @private
   */
  escapeXml(text) {
    return TextOverlayRenderer.escapeXml(text);
  }

  /**
   * Get attachment points for line connectors with proper coordinate transformation
   * @public
   */
  getAttachmentPoints(overlay, x, y) {
    const textContent = this._resolveTextContent(overlay, overlay.finalStyle || {});
    const textStyle = this._resolveTextStyles(overlay.finalStyle || {}, overlay.id);
    // Use adjusted font for consistent connector attachment
    const font = RendererUtils.buildMeasurementFontString(textStyle, this.container);

    return RendererUtils.getTextAttachmentPoints(
      textContent,
      x,
      y,
      font,
      textStyle.textAnchor,
      textStyle.dominantBaseline,
      this.container
    );
  }

  /**
   * Compute attachment points & bbox for a text overlay without rendering (used by line routing).
   * Returns null if position or content invalid.
   */
  static computeAttachmentPoints(overlay, anchors, container) {
    if (!overlay || overlay.type !== 'text') return null;
    const position = PositionResolver.resolvePosition(overlay.position, anchors);
    if (!position) return null;
    const [x, y] = position;
    const instance = new TextOverlayRenderer();
    const style = overlay.finalStyle || overlay.style || {};
    const textStyle = instance._resolveTextStyles(style, overlay.id);
    const textContent = instance._resolveTextContent(overlay, style);
    if (!textContent) return null;
    // Measurement font (correct inherited font + scaling)
    const font = RendererUtils.buildMeasurementFontString(textStyle, container);
    const bbox = RendererUtils.getTextBoundingBox(
      textContent,
      x,
      y,
      font,
      textStyle.textAnchor,
      textStyle.dominantBaseline,
      container
    );
    const points = RendererUtils.getTextAttachmentPoints(
      textContent,
      x,
      y,
      font,
      textStyle.textAnchor,
      textStyle.dominantBaseline,
      container
    );
    return {
      id: overlay.id,
      center: points.center,
      points,
      bbox,
      textStyle,
      x,
      y
    };
  }

  // NEW: consolidated measurement helper (mirrors bracket/highlight logic)
  _measureTextBlock(textContent, x, y, textStyle) {
    try {
      const font = RendererUtils.buildMeasurementFontString(textStyle, this.container);
      if (textStyle.multiline) {
        const mm = RendererUtils.measureMultilineText(
          textContent,
          font,
          textStyle.lineHeight,
          true,
          this.container
        );
        return {
          width: mm.width,
          height: mm.height
        };
      } else {
        const m = RendererUtils.measureText(textContent, font, true, this.container);
        return {
          width: m.width,
          height: m.height
        };
      }
    } catch (_) {
      return { width: 0, height: 0 };
    }
  }
}