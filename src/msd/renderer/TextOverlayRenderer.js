/**
 * Text Overlay Renderer - Advanced text rendering with comprehensive styling support
 * Provides rich text styling features similar to LineOverlayRenderer
 */

import { PositionResolver } from './PositionResolver.js';

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
  static render(overlay, anchors, viewBox) {
    // Create instance for non-static methods
    const instance = new TextOverlayRenderer();
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
      // Extract comprehensive styling
      const style = overlay.finalStyle || overlay.style || {};
      const textStyle = this._resolveTextStyles(style, overlay.id);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      // Get text content
      const textContent = this._resolveTextContent(overlay, style);
      if (!textContent) {
        console.warn(`[TextOverlayRenderer] No text content for overlay ${overlay.id}`);
        return '';
      }

      // Build SVG group with all features
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
                  data-animation-ready="${!!animationAttributes.hasAnimations}">
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
   * Build LCARS-style brackets around text
   * @private
   */
  _buildBrackets(textContent, x, y, textStyle, overlayId) {
    // Estimate text width (rough approximation)
    const textWidth = textContent.length * textStyle.fontSize * 0.6;
    const bracketHeight = textStyle.fontSize * 1.2;
    const bracketWidth = 8;

    const leftX = x - bracketWidth - 4;
    const rightX = x + textWidth + 4;
    const topY = y - bracketHeight * 0.8;
    const bottomY = y + bracketHeight * 0.2;

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
   * Build highlight background
   * @private
   */
  _buildHighlight(textContent, x, y, textStyle, overlayId) {
    const textWidth = textContent.length * textStyle.fontSize * 0.6;
    const highlightHeight = textStyle.fontSize * 1.1;

    let highlightX = x;
    if (textStyle.textAnchor === 'middle') {
      highlightX -= textWidth / 2;
    } else if (textStyle.textAnchor === 'end') {
      highlightX -= textWidth;
    }

    const highlightY = y - textStyle.fontSize * 0.8;
    const highlightColor = typeof textStyle.highlight === 'string' ?
      textStyle.highlight : 'rgba(255, 255, 0, 0.3)';

    return `<rect x="${highlightX - 2}" y="${highlightY}"
                  width="${textWidth + 4}" height="${highlightHeight}"
                  fill="${highlightColor}" rx="2"
                  data-decoration="highlight"/>`;
  }

  /**
   * Build status indicator
   * @private
   */
  _buildStatusIndicator(x, y, textStyle, overlayId) {
    const indicatorSize = textStyle.fontSize * 0.4;
    const statusColor = typeof textStyle.status_indicator === 'string'
      ? textStyle.status_indicator
      : 'var(--lcars-green)';

    // New: support configurable position
    const position = textStyle.status_indicator_position || 'left-center';

    // Estimate text width and height (for positioning)
    const textWidth = (textStyle.maxWidth && textStyle.maxWidth > 0)
      ? textStyle.maxWidth
      : (textStyle.multiline
          ? Math.max(...(textStyle.value || '').split('\n').map(line => line.length)) * textStyle.fontSize * 0.6
          : (textStyle.value || '').length * textStyle.fontSize * 0.6);
    const textHeight = textStyle.fontSize * (textStyle.multiline ? (textStyle.value || '').split('\n').length : 1) * textStyle.lineHeight;

    // Calculate indicator position based on option
    let indicatorX = x, indicatorY = y;
    switch (position) {
      case 'top-left':
        indicatorX = x - textWidth / 2 - indicatorSize;
        indicatorY = y - textHeight / 2 - indicatorSize;
        break;
      case 'top-right':
        indicatorX = x + textWidth / 2 + indicatorSize;
        indicatorY = y - textHeight / 2 - indicatorSize;
        break;
      case 'bottom-left':
        indicatorX = x - textWidth / 2 - indicatorSize;
        indicatorY = y + textHeight / 2 + indicatorSize;
        break;
      case 'bottom-right':
        indicatorX = x + textWidth / 2 + indicatorSize;
        indicatorY = y + textHeight / 2 + indicatorSize;
        break;
      case 'top':
        indicatorX = x;
        indicatorY = y - textHeight / 2 - indicatorSize;
        break;
      case 'bottom':
        indicatorX = x;
        indicatorY = y + textHeight / 2 + indicatorSize;
        break;
      case 'left-center':
      case 'left':
        indicatorX = x - textWidth / 2 - indicatorSize;
        indicatorY = y;
        break;
      case 'right-center':
      case 'right':
        indicatorX = x + textWidth / 2 + indicatorSize;
        indicatorY = y;
        break;
      case 'center':
        indicatorX = x;
        indicatorY = y;
        break;
      default:
        // fallback to left-center
        indicatorX = x - indicatorSize - 8;
        indicatorY = y;
    }

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
}