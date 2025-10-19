/**
 * @fileoverview Line Overlay Renderer - Advanced line rendering with comprehensive styling support
 *
 * Leverages RouterCore's sophisticated path computation and adds rich visual features:
 * - Multiple routing strategies (direct, smart, channel, arc)
 * - Advanced styling (gradients, patterns, markers, effects)
 * - Overlay-to-overlay attachment with gap support
 * - Theme token integration via BaseRenderer
 * - Animation hooks for anime.js integration
 *
 * ✅ ENHANCED: Now includes provenance tracking (Phase 5.2A)
 *
 * @module msd/renderer/LineOverlayRenderer
 */

import { BaseRenderer } from './BaseRenderer.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { OverlayUtils } from './OverlayUtils.js';
import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';

/**
 * Line overlay renderer with advanced styling and routing capabilities
 *
 * @class LineOverlayRenderer
 * @extends BaseRenderer
 */
export class LineOverlayRenderer extends BaseRenderer {
  /**
   * Create a line overlay renderer instance
   *
   * @constructor
   * @param {Object} routerCore - RouterCore instance for path computation
   */
  constructor(routerCore) {
    super(); // Call BaseRenderer constructor
    this.rendererName = 'LineOverlayRenderer'; // Set name for logging

    this.routerCore = routerCore;

    // Pre-defined marker templates for performance
    this.markerCache = new Map();
    this.gradientCache = new Map();
    this.patternCache = new Map();

    this.textAttachmentPoints = new Map();
  }

  /**
   * Set overlay attachment points for overlay-to-overlay line connections
   *
   * @param {Map} overlayAttachmentPoints - Map of overlay ID to attachment point data
   */
  setOverlayAttachmentPoints(overlayAttachmentPoints) {
    this.overlayAttachmentPoints = overlayAttachmentPoints;
    // Keep backward compatibility
    this.textAttachmentPoints = overlayAttachmentPoints;

    this._logDebug('📏 Updated with unified attachment points:',
      overlayAttachmentPoints ? overlayAttachmentPoints.size : 0, 'overlay(s)');
  }

  /**
   * Render a line overlay with full styling support
   *
   * ✅ ENHANCED: Now includes provenance tracking
   *
   * @param {Object} overlay - Line overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions for routing
   * @param {Array} viewBox - SVG viewBox dimensions [x, y, width, height]
   * @returns {Object} Render result with markup and provenance
   */
  render(overlay, anchors, viewBox) {
    if (!this.routerCore) {
      this._logError('❌ RouterCore not available for line rendering');
      return {
        markup: '',
        provenance: null
      };
    }

    // ✅ NEW: Start tracking
    this._resetTracking();
    this._startRenderTiming();

    // Set viewBox for BaseRenderer helpers
    this.viewBox = viewBox;

    // ✅ Track routing strategy
    if (overlay.routing_strategy) {
      this._trackFeature(`routing_${overlay.routing_strategy}`);
    }

    // Resolve anchor position with overlay attachment support
    let anchor = this._resolveAnchor(overlay, anchors);
    let anchor2 = this._resolveAttachTo(overlay, anchors);

    // Validate anchor is properly resolved
    if (!anchor || !Array.isArray(anchor) || anchor.length !== 2) {
      this._logError(`❌ Invalid anchor for ${overlay.id}:`, { anchor });
      return {
        markup: '',
        provenance: this._getRendererProvenance(overlay.id, {
          overlay_type: 'line',
          error: 'invalid_anchor'
        })
      };
    }

    try {
      // Get the computed path from RouterCore
      const routeRequest = this.routerCore.buildRouteRequest(overlay, anchor, anchor2);
      const pathResult = this.routerCore.computePath(routeRequest);

      if (!pathResult?.d) {
        this._logWarn(`⚠️ No path computed for line ${overlay.id}`);
        return {
          markup: '',
          provenance: this._getRendererProvenance(overlay.id, {
            overlay_type: 'line',
            error: 'no_path_computed'
          })
        };
      }

      // Extract comprehensive styling with token integration
      const style = overlay.finalStyle || overlay.style || {};
      const lineStyle = this._resolveLineStyles(style, overlay.id, viewBox);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      // ✅ Track line features
      lineStyle.features.forEach(feature => this._trackFeature(feature));

      // Build SVG group with all features
      const svgParts = [
        this._buildDefinitions(lineStyle, overlay.id),
        this._buildMainPath(pathResult.d, lineStyle, overlay.id, animationAttributes),
        this._buildMarkers(pathResult, lineStyle, overlay.id),
        this._buildEffects(pathResult, lineStyle, overlay.id)
      ].filter(Boolean);

      this._logDebug(`📏 Rendered enhanced line ${overlay.id} with ${lineStyle.features.length} features`);

      const markup = `<g data-overlay-id="${overlay.id}"
                  data-overlay-type="line"
                  data-routing-strategy="${pathResult.meta?.strategy || 'unknown'}"
                  data-animation-ready="${!!animationAttributes.hasAnimations}">
                ${svgParts.join('\n')}
              </g>`;

      return {
        markup,
        provenance: this._getRendererProvenance(overlay.id, {
          overlay_type: 'line',
          routing_strategy: pathResult.meta?.strategy || 'unknown',
          path_length: pathResult.d.length,
          features_count: lineStyle.features.length,
          has_animations: animationAttributes.hasAnimations
        })
      };

    } catch (error) {
      this._logError(`❌ Enhanced rendering failed for line ${overlay.id}:`, error);

      const fallback = this._renderFallbackLine(overlay, anchor, anchor2);
      return {
        markup: fallback,
        provenance: this._getRendererProvenance(overlay.id, {
          overlay_type: 'line',
          fallback_used: true,
          error: error.message
        })
      };
    }
  }

  /**
   * Resolve anchor position with overlay attachment support
   *
   * ✅ NEW: Tracks overlay attachment feature
   *
   * @private
   */
  _resolveAnchor(overlay, anchors) {
    // Check if anchor refers to an overlay
    if (typeof overlay.anchor === 'string' && this.overlayAttachmentPoints?.has(overlay.anchor)) {
      const sourceAttachmentPoints = this.overlayAttachmentPoints.get(overlay.anchor);
      if (sourceAttachmentPoints?.points) {
        this._trackFeature('overlay_attachment');
        const anchorSide = overlay.anchor_side || 'center';
        const sourcePoint = this._resolveAttachmentPoint(sourceAttachmentPoints.points, anchorSide);

        if (sourcePoint) {
          const anchorGap = overlay.anchor_gap || 0;
          if (anchorGap > 0) {
            this._trackFeature('anchor_gap');
          }
          return this._applyGapToAttachmentPoint(sourcePoint, anchorSide, anchorGap, sourceAttachmentPoints.bbox);
        }
      }
    }

    // Standard anchor resolution
    return OverlayUtils.resolvePosition(overlay.anchor, anchors);
  }

  /**
   * Resolve attach_to position with overlay attachment support
   *
   * ✅ NEW: Tracks overlay attachment feature
   *
   * @private
   */
  _resolveAttachTo(overlay, anchors) {
    if (!overlay.attach_to) return null;

    // Check for overlay attachment points
    if (this.overlayAttachmentPoints?.has(overlay.attach_to)) {
      const targetAttachmentPoints = this.overlayAttachmentPoints.get(overlay.attach_to);
      if (targetAttachmentPoints?.points) {
        this._trackFeature('overlay_attachment');
        const attachSide = overlay.attach_side || 'center';
        const targetPoint = this._resolveAttachmentPoint(targetAttachmentPoints.points, attachSide);

        if (targetPoint) {
          const attachGap = overlay.attach_gap || 0;
          if (attachGap > 0) {
            this._trackFeature('attach_gap');
          }
          return this._applyGapToAttachmentPoint(targetPoint, attachSide, attachGap, targetAttachmentPoints.bbox);
        }
      }
    }

    // Fallback to static anchor
    return OverlayUtils.resolvePosition(overlay.attach_to, anchors);
  }

  /**
   * Resolve comprehensive line styling from configuration
   *
   * Integrates token system for theme-aware styling and resolves all
   * line properties from style configuration with proper fallbacks.
   *
   * @private
   * @param {Object} style - Final resolved style object
   * @param {string} overlayId - Overlay ID for unique identifiers
   * @param {Array} viewBox - ViewBox for context
   * @returns {Object} Complete line style configuration
   */
  _resolveLineStyles(style, overlayId, viewBox) {
    // Create component-scoped token resolver
    const resolveToken = themeTokenResolver ? themeTokenResolver.forComponent('line') : null;
    const scalingContext = this._getScalingContext(viewBox);

    // Resolve all line properties via tokens and BaseRenderer helpers
    const lineStyle = {
      // Core stroke properties with token integration
      color: this._resolveStyleProperty(
        style.color || style.stroke,
        'defaultColor',
        resolveToken,
        this._getDefault('line.defaultColor', 'var(--lcars-orange)'),
        scalingContext
      ),

      width: Number(this._resolveStyleProperty(
        style.width || style.stroke_width || style.strokeWidth,
        'defaultWidth',
        resolveToken,
        this._getDefault('line.defaultWidth', 2),
        scalingContext
      )),

      opacity: Number(this._resolveStyleProperty(
        style.opacity,
        'effects.opacity.base',
        resolveToken,
        this._getDefault('line.defaultOpacity', 1),
        scalingContext
      )),

      // Advanced stroke styling (no tokens needed - direct values)
      lineCap: (style.line_cap || style.lineCap || style.strokeLinecap || 'round').toLowerCase(),
      lineJoin: (style.line_join || style.lineJoin || style.strokeLinejoin || 'round').toLowerCase(),
      miterLimit: Number(style.miter_limit || style.miterLimit || 4),

      // Dash patterns (no tokens needed)
      dashArray: style.dash_array || style.dashArray || style.strokeDasharray || null,
      dashOffset: Number(style.dash_offset || style.dashOffset || style.strokeDashoffset || 0),

      // Fill properties (for thick lines or special effects)
      fill: style.fill || 'none',
      fillOpacity: Number(style.fill_opacity || style.fillOpacity || 1),

      // Gradient and pattern support (parsed separately - no tokens needed)
      gradient: this._parseGradientConfig(style.gradient),
      pattern: this._parsePatternConfig(style.pattern),

      // Markers (arrowheads, dots, etc.) - parsed separately
      markerStart: this._parseMarkerConfig(style.marker_start || style.markerStart),
      markerMid: this._parseMarkerConfig(style.marker_mid || style.markerMid),
      markerEnd: this._parseMarkerConfig(style.marker_end || style.markerEnd),

      // Effects (parsed separately - no tokens needed)
      glow: this._parseGlowConfig(style.glow),
      shadow: this._parseShadowConfig(style.shadow),

      // Animation states (no tokens needed)
      animatable: style.animatable !== false,
      pulseSpeed: Number(style.pulse_speed || 0),
      flowSpeed: Number(style.flow_speed || 0),

      // LCARS-specific features (no tokens needed)
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

  // ... [REST OF THE FILE REMAINS UNCHANGED - All other methods stay exactly the same]
  // ... [Include all remaining methods from your original file]

  /**
   * Parse gradient configuration
   *
   * @private
   * @param {Object|string} gradientConfig - Gradient configuration
   * @returns {Object|null} Parsed gradient config
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
   *
   * @private
   * @param {Object|string} patternConfig - Pattern configuration
   * @returns {Object|null} Parsed pattern config
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
   *
   * @private
   * @param {Object|string} markerConfig - Marker configuration
   * @returns {Object|null} Parsed marker config
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
   *
   * @private
   * @param {Object|boolean} glowConfig - Glow configuration
   * @returns {Object|null} Parsed glow config
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
   *
   * @private
   * @param {Object|boolean} shadowConfig - Shadow configuration
   * @returns {Object|null} Parsed shadow config
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
   *
   * @private
   * @param {Array} segmentConfig - Segment colors array
   * @returns {Array|null} Parsed segment colors
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
   *
   * @private
   * @param {Object} lineStyle - Resolved line style
   * @param {string} overlayId - Overlay ID for unique identifiers
   * @returns {string} SVG <defs> markup
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
   *
   * @private
   * @param {Object} gradient - Gradient configuration
   * @param {string} overlayId - Overlay ID
   * @returns {string} SVG gradient definition
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
   *
   * @private
   * @param {string} direction - Gradient direction
   * @returns {string} SVG gradient coordinates
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
   *
   * @private
   * @param {Object} pattern - Pattern configuration
   * @param {string} overlayId - Overlay ID
   * @returns {string} SVG pattern definition
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
   *
   * @private
   * @param {Object} marker - Marker configuration
   * @param {string} overlayId - Overlay ID
   * @param {string} markerType - Marker type (markerStart, markerMid, markerEnd)
   * @returns {string} SVG marker definition
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
   *
   * @private
   * @param {string|number} size - Size descriptor
   * @returns {number} Numeric size
   */
  _getMarkerSize(size) {
    const sizes = { small: 6, medium: 8, large: 12, xlarge: 16 };
    return sizes[size] || Number(size) || 8;
  }

  /**
   * Create glow filter definition
   *
   * @private
   * @param {Object} glow - Glow configuration
   * @param {string} overlayId - Overlay ID
   * @returns {string} SVG filter definition
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
   *
   * @private
   * @param {Object} shadow - Shadow configuration
   * @param {string} overlayId - Overlay ID
   * @returns {string} SVG filter definition
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
   *
   * @private
   * @param {string} pathData - SVG path data
   * @param {Object} lineStyle - Resolved line style
   * @param {string} overlayId - Overlay ID
   * @param {Object} animationAttributes - Animation attributes
   * @returns {string} SVG path element
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
   *
   * @private
   * @param {Object} pathResult - Path computation result
   * @param {Object} lineStyle - Resolved line style
   * @param {string} overlayId - Overlay ID
   * @returns {string} Additional marker markup (empty for now)
   */
  _buildMarkers(pathResult, lineStyle, overlayId) {
    // Future: Add custom markers along path at specific positions
    return '';
  }

  /**
   * Build special effects elements
   *
   * @private
   * @param {Object} pathResult - Path computation result
   * @param {Object} lineStyle - Resolved line style
   * @param {string} overlayId - Overlay ID
   * @returns {string} Effects markup
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
   *
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Object} style - Style configuration
   * @returns {Object} Animation attributes
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
   *
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Array} anchor - Start position [x, y]
   * @param {Array} anchor2 - End position [x, y]
   * @returns {string} Fallback SVG markup
   */
  _renderFallbackLine(overlay, anchor, anchor2) {
    const [x1, y1] = anchor;
    const [x2, y2] = anchor2;
    const style = overlay.finalStyle || overlay.style || {};
    const color = style.color || 'var(--lcars-orange)';
    const width = style.width || 2;

    this._logWarn(`⚠️ Using fallback rendering for line ${overlay.id}`);

    return `<g data-overlay-id="${overlay.id}" data-overlay-type="line" data-fallback="true">
              <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                    stroke="${color}" stroke-width="${width}"
                    stroke-linecap="round" fill="none"/>
            </g>`;
  }

  /**
   * Update line styling dynamically (for future real-time updates)
   *
   * @public
   * @param {string} overlayId - Overlay ID
   * @param {Object} newStyle - New style configuration
   */
  updateLineStyle(overlayId, newStyle) {
    // Future: Update existing line styles without full re-render
    this._logDebug(`Style update requested for line ${overlayId}`);
  }

  /**
   * Get rendering capabilities and features supported
   *
   * @public
   * @returns {Object} Capabilities object
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

  /**
   * Choose attachment point on target text overlay bbox, honoring attach_side or auto
   *
   * Legacy method for backward compatibility with text overlay attachments.
   * Applies configurable gap (attach_gap | gap | line_gap) in outward normal direction.
   *
   * @private
   * @param {Array} origin - Origin position [x, y]
   * @param {Object} attachMeta - Attachment metadata
   * @param {Object} overlay - Overlay configuration
   * @returns {Array} Attachment point [x, y]
   */
  _computeTextAttachPoint(origin, attachMeta, overlay) {
    if (!origin || !attachMeta) return attachMeta?.center;

    const raw = overlay._raw || overlay.raw || overlay;
    const sidePref = (raw.attach_side || raw.attachSide || 'auto').toLowerCase();
    const gapRaw = raw.attach_gap ?? raw.attachment_gap ?? raw.line_gap ?? raw.gap;
    const gap = Number(gapRaw ?? 4);
    const { bbox, points } = attachMeta;
    const center = points.center;
    let side = sidePref;

    if (side === 'auto') {
      const dx = origin[0] - center[0];
      const dy = origin[1] - center[1];
      if (Math.abs(dx) >= Math.abs(dy)) {
        side = dx <= 0 ? 'left' : 'right';
      } else {
        side = dy <= 0 ? 'top' : 'bottom';
      }
    }

    let basePoint;
    let outward = [0,0];
    switch (side) {
      case 'left':
      case 'left-center':
        basePoint = [bbox.left, center[1]];
        outward = [-1,0];
        break;
      case 'right':
      case 'right-center':
        basePoint = [bbox.right, center[1]];
        outward = [1,0];
        break;
      case 'top':
      case 'top-center':
        basePoint = [center[0], bbox.top];
        outward = [0,-1];
        break;
      case 'bottom':
      case 'bottom-center':
        basePoint = [center[0], bbox.bottom];
        outward = [0,1];
        break;
      default:
        basePoint = [bbox.left, center[1]];
        outward = [-1,0];
    }

    // Apply gap outward
    const attachPoint = [
      basePoint[0] + outward[0] * gap,
      basePoint[1] + outward[1] * gap
    ];

    // Store meta for potential debug / future features
    overlay._attachComputed = {
      targetOverlay: attachMeta.id,
      sideChosen: side,
      gap,
      basePoint,
      attachPoint
    };

    return attachPoint;
  }

  /**
   * Resolve attachment point from attachment points object
   *
   * Handles various naming conventions and aliases for attachment sides.
   *
   * @private
   * @param {Object} points - Attachment points object
   * @param {string} side - Side to resolve (center, top, left, etc.)
   * @returns {Array|null} [x, y] coordinates or null
   */
  _resolveAttachmentPoint(points, side) {
    if (!points || typeof points !== 'object') {
      this._logWarn(`No attachment points provided for side '${side}'`);
      return null;
    }

    // Try exact side match first
    if (points[side]) {
      this._logDebug(`Found exact match for side '${side}':`, points[side]);
      return points[side];
    }

    // Try common aliases
    const aliases = {
      'center': 'center',
      'top': 'top',
      'bottom': 'bottom',
      'left': 'left',
      'right': 'right',
      // Vertical-Horizontal pattern (top-*, bottom-*)
      'top-left': 'topLeft',
      'top-right': 'topRight',
      'bottom-left': 'bottomLeft',
      'bottom-right': 'bottomRight',
      'topLeft': 'topLeft',
      'topRight': 'topRight',
      'bottomLeft': 'bottomLeft',
      'bottomRight': 'bottomRight',
      // Horizontal-Vertical pattern (left-*, right-*)
      'left-top': 'topLeft',
      'left-bottom': 'bottomLeft',
      'right-top': 'topRight',
      'right-bottom': 'bottomRight',
      'leftTop': 'topLeft',
      'leftBottom': 'bottomLeft',
      'rightTop': 'topRight',
      'rightBottom': 'bottomRight'
    };

    const resolvedSide = aliases[side] || side;
    if (points[resolvedSide]) {
      this._logDebug(`Found alias match '${side}' -> '${resolvedSide}':`, points[resolvedSide]);
      return points[resolvedSide];
    }

    // Fallback to center if available
    if (points.center) {
      this._logWarn(`Could not resolve side '${side}', using center:`, points.center);
      return points.center;
    }

    // Last resort: return first available point
    const firstPoint = Object.values(points)[0];
    if (firstPoint && Array.isArray(firstPoint)) {
      this._logWarn(`Could not resolve side '${side}', using first available point:`, firstPoint);
      return firstPoint;
    }

    this._logError(`❌ No attachment points available for side '${side}'`);
    return null;
  }

  /**
   * Apply gap offset to attachment point
   *
   * Applies gap offset in the appropriate direction based on the attachment side.
   * For corner attachments, applies gap in the PRIMARY direction only (first part of compound name).
   *
   * @private
   * @param {Array} point - [x, y] attachment point
   * @param {string} side - Side the point is on
   * @param {number} gap - Gap distance
   * @param {Object} bbox - Bounding box of target overlay
   * @returns {Array} [x, y] gap-adjusted point
   */
  _applyGapToAttachmentPoint(point, side, gap, bbox) {
    if (!point || !Array.isArray(point) || gap === 0) {
      return point;
    }

    const [x, y] = point;
    let offsetX = 0;
    let offsetY = 0;

    // Apply gap offset based on attachment side
    switch (side.toLowerCase()) {
      case 'top':
        offsetY = -gap;
        break;
      case 'bottom':
        offsetY = gap;
        break;
      case 'left':
        offsetX = -gap;
        break;
      case 'right':
        offsetX = gap;
        break;
      // Corner attachments: Apply gap in PRIMARY direction only (first part of compound name)
      // Vertical-Horizontal pattern (top-*, bottom-*)
      case 'topleft':
      case 'top-left':
        offsetY = -gap;  // Primary: top → gap goes up
        break;
      case 'topright':
      case 'top-right':
        offsetY = -gap;  // Primary: top → gap goes up
        break;
      case 'bottomleft':
      case 'bottom-left':
        offsetY = gap;   // Primary: bottom → gap goes down
        break;
      case 'bottomright':
      case 'bottom-right':
        offsetY = gap;   // Primary: bottom → gap goes down
        break;
      // Horizontal-Vertical pattern (left-*, right-*)
      case 'lefttop':
      case 'left-top':
        offsetX = -gap;  // Primary: left → gap goes left
        break;
      case 'leftbottom':
      case 'left-bottom':
        offsetX = -gap;  // Primary: left → gap goes left
        break;
      case 'righttop':
      case 'right-top':
        offsetX = gap;   // Primary: right → gap goes right
        break;
      case 'rightbottom':
      case 'right-bottom':
        offsetX = gap;   // Primary: right → gap goes right
        break;
      case 'center':
      default:
        // For center, don't apply gap (or could apply in direction of closest edge)
        break;
    }

    return [x + offsetX, y + offsetY];
  }
}

// Export for use by rendering system
export default LineOverlayRenderer;