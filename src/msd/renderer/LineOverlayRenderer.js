/**
 * Line Overlay Renderer - Advanced line rendering with comprehensive styling support
 * Leverages RouterCore's sophisticated path computation and adds rich visual features
 */

import { PositionResolver } from './PositionResolver.js';

export class LineOverlayRenderer {
  constructor(routerCore) {
    this.routerCore = routerCore;

    // Pre-defined marker templates for performance
    this.markerCache = new Map();
    this.gradientCache = new Map();
    this.patternCache = new Map();
  }

  /**
   * Render a line overlay with full styling support
   * @param {Object} overlay - Line overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions for routing
   * @param {Array} viewBox - SVG viewBox dimensions
   * @returns {string} Complete SVG markup for the styled line
   */
  render(overlay, anchors, viewBox) {
    if (!this.routerCore) {
      console.error('[LineOverlayRenderer] RouterCore not available for line rendering');
      return '';
    }

    const anchor1 = PositionResolver.resolvePosition(overlay.anchor, anchors);
    const anchor2 = PositionResolver.resolvePosition(overlay.attach_to, anchors);

    if (!anchor1 || !anchor2) {
      console.warn(`[LineOverlayRenderer] Line ${overlay.id} missing anchor points`);
      return '';
    }

    try {
      // Get the computed path from RouterCore (includes all smart routing)
      const routeRequest = this.routerCore.buildRouteRequest(overlay, anchor1, anchor2);
      const pathResult = this.routerCore.computePath(routeRequest);

      if (!pathResult?.d) {
        console.warn(`[LineOverlayRenderer] No path computed for line ${overlay.id}`);
        return '';
      }

      // Extract comprehensive styling
      const style = overlay.finalStyle || overlay.style || {};
      const lineStyle = this._resolveLineStyles(style, overlay.id);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      // Build SVG group with all features
      const svgParts = [
        this._buildDefinitions(lineStyle, overlay.id),
        this._buildMainPath(pathResult.d, lineStyle, overlay.id, animationAttributes),
        this._buildMarkers(pathResult, lineStyle, overlay.id),
        this._buildEffects(pathResult, lineStyle, overlay.id)
      ].filter(Boolean);

      console.log(`[LineOverlayRenderer] Rendered enhanced line ${overlay.id} with ${lineStyle.features.length} features`);

      return `<g data-overlay-id="${overlay.id}"
                  data-overlay-type="line"
                  data-routing-strategy="${pathResult.meta?.strategy || 'unknown'}"
                  data-animation-ready="${!!animationAttributes.hasAnimations}">
                ${svgParts.join('\n')}
              </g>`;

    } catch (error) {
      console.error(`[LineOverlayRenderer] Enhanced rendering failed for line ${overlay.id}:`, error);
      return this._renderFallbackLine(overlay, anchor1, anchor2);
    }
  }

  /**
   * Resolve comprehensive line styling from configuration
   * @private
   * @param {Object} style - Final resolved style object
   * @param {string} overlayId - Overlay ID for unique identifiers
   * @returns {Object} Complete line style configuration
   */
  _resolveLineStyles(style, overlayId) {
    const lineStyle = {
      // Core stroke properties
      color: style.color || style.stroke || 'var(--lcars-orange)',
      width: Number(style.width || style.stroke_width || style.strokeWidth || 2),
      opacity: Number(style.opacity || 1),

      // Advanced stroke styling
      lineCap: (style.line_cap || style.lineCap || style.strokeLinecap || 'round').toLowerCase(),
      lineJoin: (style.line_join || style.lineJoin || style.strokeLinejoin || 'round').toLowerCase(),
      miterLimit: Number(style.miter_limit || style.miterLimit || 4),

      // Dash patterns
      dashArray: style.dash_array || style.dashArray || style.strokeDasharray || null,
      dashOffset: Number(style.dash_offset || style.dashOffset || style.strokeDashoffset || 0),

      // Fill properties (for thick lines or special effects)
      fill: style.fill || 'none',
      fillOpacity: Number(style.fill_opacity || style.fillOpacity || 1),

      // Gradient and pattern support
      gradient: this._parseGradientConfig(style.gradient),
      pattern: this._parsePatternConfig(style.pattern),

      // Markers (arrowheads, dots, etc.)
      markerStart: this._parseMarkerConfig(style.marker_start || style.markerStart),
      markerMid: this._parseMarkerConfig(style.marker_mid || style.markerMid),
      markerEnd: this._parseMarkerConfig(style.marker_end || style.markerEnd),

      // Effects
      glow: this._parseGlowConfig(style.glow),
      shadow: this._parseShadowConfig(style.shadow),

      // Animation states (for future anime.js integration)
      animatable: style.animatable !== false,
      pulseSpeed: Number(style.pulse_speed || 0),
      flowSpeed: Number(style.flow_speed || 0),

      // LCARS-specific features
      segment_colors: this._parseSegmentColors(style.segment_colors),
      status_indicator: style.status_indicator || null,

      // Track enabled features for optimization
      features: []
    };

    // Build feature list for conditional rendering
    if (lineStyle.gradient) lineStyle.features.push('gradient');
    if (lineStyle.pattern) lineStyle.features.push('pattern');
    if (lineStyle.markerStart || lineStyle.markerMid || lineStyle.markerEnd) lineStyle.features.push('markers');
    if (lineStyle.glow) lineStyle.features.push('glow');
    if (lineStyle.shadow) lineStyle.features.push('shadow');
    if (lineStyle.segment_colors) lineStyle.features.push('segments');
    if (lineStyle.pulseSpeed > 0) lineStyle.features.push('pulse');
    if (lineStyle.flowSpeed > 0) lineStyle.features.push('flow');

    return lineStyle;
  }

  /**
   * Parse gradient configuration
   * @private
   */
  _parseGradientConfig(gradientConfig) {
    if (!gradientConfig) return null;

    if (typeof gradientConfig === 'string') {
      // Simple gradient: "red-to-blue" or "#ff0000-to-#0000ff"
      const match = gradientConfig.match(/^(.+?)-to-(.+)$/);
      if (match) {
        return {
          type: 'linear',
          direction: 'horizontal',
          stops: [
            { offset: '0%', color: match[1].trim() },
            { offset: '100%', color: match[2].trim() }
          ]
        };
      }
      return null;
    }

    if (typeof gradientConfig === 'object') {
      return {
        type: gradientConfig.type || 'linear',
        direction: gradientConfig.direction || 'horizontal',
        stops: gradientConfig.stops || [
          { offset: '0%', color: gradientConfig.from || '#ff6600' },
          { offset: '100%', color: gradientConfig.to || '#ffcc00' }
        ]
      };
    }

    return null;
  }

  /**
   * Parse pattern configuration
   * @private
   */
  _parsePatternConfig(patternConfig) {
    if (!patternConfig) return null;

    if (typeof patternConfig === 'string') {
      // Predefined patterns: "dots", "diagonal", "grid"
      return { type: patternConfig, size: 8, color: 'currentColor' };
    }

    if (typeof patternConfig === 'object') {
      return {
        type: patternConfig.type || 'dots',
        size: Number(patternConfig.size || 8),
        color: patternConfig.color || 'currentColor',
        opacity: Number(patternConfig.opacity || 0.5)
      };
    }

    return null;
  }

  /**
   * Parse marker configuration (arrows, dots, etc.)
   * @private
   */
  _parseMarkerConfig(markerConfig) {
    if (!markerConfig) return null;

    if (typeof markerConfig === 'string') {
      // Predefined markers: "arrow", "dot", "diamond"
      return { type: markerConfig, size: 'medium', color: 'inherit' };
    }

    if (typeof markerConfig === 'object') {
      return {
        type: markerConfig.type || 'arrow',
        size: markerConfig.size || 'medium',
        color: markerConfig.color || 'inherit',
        rotate: markerConfig.rotate !== false
      };
    }

    return null;
  }

  /**
   * Parse glow effect configuration
   * @private
   */
  _parseGlowConfig(glowConfig) {
    if (!glowConfig) return null;

    if (glowConfig === true) {
      return { color: 'currentColor', size: 4, opacity: 0.6 };
    }

    if (typeof glowConfig === 'object') {
      return {
        color: glowConfig.color || 'currentColor',
        size: Number(glowConfig.size || 4),
        opacity: Number(glowConfig.opacity || 0.6)
      };
    }

    return null;
  }

  /**
   * Parse shadow effect configuration
   * @private
   */
  _parseShadowConfig(shadowConfig) {
    if (!shadowConfig) return null;

    if (shadowConfig === true) {
      return { color: 'rgba(0,0,0,0.3)', offset: [2, 2], blur: 3 };
    }

    if (typeof shadowConfig === 'object') {
      return {
        color: shadowConfig.color || 'rgba(0,0,0,0.3)',
        offset: shadowConfig.offset || [2, 2],
        blur: Number(shadowConfig.blur || 3)
      };
    }

    return null;
  }

  /**
   * Parse segment colors configuration
   * @private
   */
  _parseSegmentColors(segmentConfig) {
    if (!segmentConfig || !Array.isArray(segmentConfig)) return null;

    return segmentConfig.map(segment => ({
      color: segment.color || 'var(--lcars-orange)',
      start: Number(segment.start || 0),
      end: Number(segment.end || 1)
    }));
  }

  /**
   * Build SVG definitions for gradients, patterns, markers, and effects
   * @private
   */
  _buildDefinitions(lineStyle, overlayId) {
    const defs = [];

    // Gradients
    if (lineStyle.gradient) {
      defs.push(this._createGradientDefinition(lineStyle.gradient, overlayId));
    }

    // Patterns
    if (lineStyle.pattern) {
      defs.push(this._createPatternDefinition(lineStyle.pattern, overlayId));
    }

    // Markers
    ['markerStart', 'markerMid', 'markerEnd'].forEach(markerType => {
      if (lineStyle[markerType]) {
        defs.push(this._createMarkerDefinition(lineStyle[markerType], overlayId, markerType));
      }
    });

    // Effects (filters)
    if (lineStyle.glow) {
      defs.push(this._createGlowFilter(lineStyle.glow, overlayId));
    }

    if (lineStyle.shadow) {
      defs.push(this._createShadowFilter(lineStyle.shadow, overlayId));
    }

    return defs.length > 0 ? `<defs>${defs.join('\n')}</defs>` : '';
  }

  /**
   * Create gradient definition
   * @private
   */
  _createGradientDefinition(gradient, overlayId) {
    const gradientId = `line-gradient-${overlayId}`;

    if (gradient.type === 'radial') {
      const stops = gradient.stops.map(stop =>
        `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`
      ).join('');

      return `<radialGradient id="${gradientId}">${stops}</radialGradient>`;
    } else {
      // Linear gradient
      const coords = this._getLinearGradientCoords(gradient.direction);
      const stops = gradient.stops.map(stop =>
        `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`
      ).join('');

      return `<linearGradient id="${gradientId}" ${coords}>${stops}</linearGradient>`;
    }
  }

  /**
   * Get linear gradient coordinates based on direction
   * @private
   */
  _getLinearGradientCoords(direction) {
    const directions = {
      horizontal: 'x1="0%" y1="0%" x2="100%" y2="0%"',
      vertical: 'x1="0%" y1="0%" x2="0%" y2="100%"',
      diagonal: 'x1="0%" y1="0%" x2="100%" y2="100%"',
      'diagonal-reverse': 'x1="100%" y1="0%" x2="0%" y2="100%"'
    };
    return directions[direction] || directions.horizontal;
  }

  /**
   * Create pattern definition
   * @private
   */
  _createPatternDefinition(pattern, overlayId) {
    const patternId = `line-pattern-${overlayId}`;
    const size = pattern.size;

    let patternContent = '';

    switch (pattern.type) {
      case 'dots':
        patternContent = `<circle cx="${size/2}" cy="${size/2}" r="1" fill="${pattern.color}" opacity="${pattern.opacity}"/>`;
        break;
      case 'diagonal':
        patternContent = `<path d="M0,${size} L${size},0" stroke="${pattern.color}" stroke-width="1" opacity="${pattern.opacity}"/>`;
        break;
      case 'grid':
        patternContent = `
          <path d="M0,0 L0,${size}" stroke="${pattern.color}" stroke-width="0.5" opacity="${pattern.opacity}"/>
          <path d="M0,0 L${size},0" stroke="${pattern.color}" stroke-width="0.5" opacity="${pattern.opacity}"/>
        `;
        break;
    }

    return `<pattern id="${patternId}" x="0" y="0" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
              ${patternContent}
            </pattern>`;
  }

  /**
   * Create marker definition (arrows, dots, etc.)
   * @private
   */
  _createMarkerDefinition(marker, overlayId, markerType) {
    const markerId = `line-marker-${overlayId}-${markerType}`;
    const size = this._getMarkerSize(marker.size);

    let markerContent = '';
    let viewBox = `0 0 ${size} ${size}`;
    let refX = size / 2;
    let refY = size / 2;

    switch (marker.type) {
      case 'arrow':
        viewBox = '0 0 10 10';
        refX = 8;
        refY = 5;
        markerContent = `<path d="M2,2 L8,5 L2,8 z" fill="${marker.color === 'inherit' ? 'currentColor' : marker.color}"/>`;
        break;
      case 'dot':
        markerContent = `<circle cx="${size/2}" cy="${size/2}" r="${size/4}" fill="${marker.color === 'inherit' ? 'currentColor' : marker.color}"/>`;
        break;
      case 'diamond':
        markerContent = `<path d="M${size/2},2 L${size-2},${size/2} L${size/2},${size-2} L2,${size/2} z" fill="${marker.color === 'inherit' ? 'currentColor' : marker.color}"/>`;
        break;
      case 'square':
        markerContent = `<rect x="2" y="2" width="${size-4}" height="${size-4}" fill="${marker.color === 'inherit' ? 'currentColor' : marker.color}"/>`;
        break;
    }

    return `<marker id="${markerId}"
                    viewBox="${viewBox}"
                    refX="${refX}" refY="${refY}"
                    markerWidth="${size}" markerHeight="${size}"
                    markerUnits="strokeWidth"
                    orient="${marker.rotate ? 'auto' : '0'}">
              ${markerContent}
            </marker>`;
  }

  /**
   * Get numeric marker size from size descriptor
   * @private
   */
  _getMarkerSize(size) {
    const sizes = { small: 6, medium: 8, large: 12, xlarge: 16 };
    return sizes[size] || Number(size) || 8;
  }

  /**
   * Create glow filter definition
   * @private
   */
  _createGlowFilter(glow, overlayId) {
    const filterId = `line-glow-${overlayId}`;

    return `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="${glow.size}" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>`;
  }

  /**
   * Create drop shadow filter definition
   * @private
   */
  _createShadowFilter(shadow, overlayId) {
    const filterId = `line-shadow-${overlayId}`;
    const [dx, dy] = shadow.offset;

    return `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="${dx}" dy="${dy}"
                           stdDeviation="${shadow.blur}"
                           flood-color="${shadow.color}"/>
            </filter>`;
  }

  /**
   * Build the main path element with all styling
   * @private
   */
  _buildMainPath(pathData, lineStyle, overlayId, animationAttributes) {
    const attributes = [];

    // Core path and styling
    attributes.push(`d="${pathData}"`);
    attributes.push(`fill="${lineStyle.fill}"`);
    attributes.push(`fill-opacity="${lineStyle.fillOpacity}"`);

    // Stroke styling
    if (lineStyle.gradient) {
      attributes.push(`stroke="url(#line-gradient-${overlayId})"`);
    } else if (lineStyle.pattern) {
      attributes.push(`stroke="url(#line-pattern-${overlayId})"`);
    } else {
      attributes.push(`stroke="${lineStyle.color}"`);
    }

    attributes.push(`stroke-width="${lineStyle.width}"`);
    attributes.push(`stroke-opacity="${lineStyle.opacity}"`);
    attributes.push(`stroke-linecap="${lineStyle.lineCap}"`);
    attributes.push(`stroke-linejoin="${lineStyle.lineJoin}"`);

    if (lineStyle.lineJoin === 'miter' && lineStyle.miterLimit !== 4) {
      attributes.push(`stroke-miterlimit="${lineStyle.miterLimit}"`);
    }

    if (lineStyle.dashArray) {
      attributes.push(`stroke-dasharray="${lineStyle.dashArray}"`);
      if (lineStyle.dashOffset !== 0) {
        attributes.push(`stroke-dashoffset="${lineStyle.dashOffset}"`);
      }
    }

    // Markers
    if (lineStyle.markerStart) {
      attributes.push(`marker-start="url(#line-marker-${overlayId}-markerStart)"`);
    }
    if (lineStyle.markerMid) {
      attributes.push(`marker-mid="url(#line-marker-${overlayId}-markerMid)"`);
    }
    if (lineStyle.markerEnd) {
      attributes.push(`marker-end="url(#line-marker-${overlayId}-markerEnd)"`);
    }

    // Effects
    const filters = [];
    if (lineStyle.glow) filters.push(`url(#line-glow-${overlayId})`);
    if (lineStyle.shadow) filters.push(`url(#line-shadow-${overlayId})`);
    if (filters.length > 0) {
      attributes.push(`filter="${filters.join(' ')}"`);
    }

    // Animation attributes (for future anime.js integration)
    attributes.push(...animationAttributes.pathAttributes);

    return `<path ${attributes.join(' ')}/>`;
  }

  /**
   * Build additional marker elements (beyond standard markers)
   * @private
   */
  _buildMarkers(pathResult, lineStyle, overlayId) {
    // Future: Add custom markers along path at specific positions
    return '';
  }

  /**
   * Build special effects elements
   * @private
   */
  _buildEffects(pathResult, lineStyle, overlayId) {
    const effects = [];

    // Future: Add flowing particles, pulse effects, etc.
    if (lineStyle.features.includes('flow')) {
      // Placeholder for flow animation elements
    }

    if (lineStyle.features.includes('pulse')) {
      // Placeholder for pulse animation elements
    }

    return effects.join('\n');
  }

  /**
   * Prepare animation attributes for future anime.js integration
   * @private
   */
  _prepareAnimationAttributes(overlay, style) {
    const animationAttributes = {
      hasAnimations: false,
      pathAttributes: [],
      groupAttributes: []
    };

    // Animation hooks for future implementation
    if (style.animatable !== false) {
      animationAttributes.pathAttributes.push(`data-animatable="true"`);
    }

    if (style.pulse_speed > 0) {
      animationAttributes.pathAttributes.push(`data-pulse-speed="${style.pulse_speed}"`);
      animationAttributes.hasAnimations = true;
    }

    if (style.flow_speed > 0) {
      animationAttributes.pathAttributes.push(`data-flow-speed="${style.flow_speed}"`);
      animationAttributes.hasAnimations = true;
    }

    // Add animation reference if specified
    if (overlay._raw?.animation_ref) {
      animationAttributes.groupAttributes.push(`data-animation-ref="${overlay._raw.animation_ref}"`);
      animationAttributes.hasAnimations = true;
    }

    return animationAttributes;
  }

  /**
   * Render a simple fallback line when enhanced rendering fails
   * @private
   */
  _renderFallbackLine(overlay, anchor1, anchor2) {
    const [x1, y1] = anchor1;
    const [x2, y2] = anchor2;
    const style = overlay.finalStyle || overlay.style || {};
    const color = style.color || 'var(--lcars-orange)';
    const width = style.width || 2;

    console.warn(`[LineOverlayRenderer] Using fallback rendering for line ${overlay.id}`);

    return `<g data-overlay-id="${overlay.id}" data-overlay-type="line" data-fallback="true">
              <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                    stroke="${color}" stroke-width="${width}"
                    stroke-linecap="round" fill="none"/>
            </g>`;
  }

  /**
   * Update line styling dynamically (for future real-time updates)
   * @public
   */
  updateLineStyle(overlayId, newStyle) {
    // Future: Update existing line styles without full re-render
    console.log(`[LineOverlayRenderer] Style update requested for line ${overlayId}`);
  }

  /**
   * Get rendering capabilities and features supported
   * @public
   */
  getCapabilities() {
    return {
      routing: true,
      gradients: true,
      patterns: true,
      markers: ['arrow', 'dot', 'diamond', 'square'],
      effects: ['glow', 'shadow'],
      animations: ['pulse', 'flow'], // Future implementation
      segmentColors: true,
      dashPatterns: true,
      advanced: true
    };
  }
}