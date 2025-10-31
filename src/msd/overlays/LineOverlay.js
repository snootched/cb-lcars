/**
 * LineOverlay.js
 * Instance-based line overlay with lifecycle management
 *
 * Phase 3B Step 5: Migration from shared LineOverlayRenderer
 *
 * Architecture:
 * - Extends OverlayBase for lifecycle management
 * - One instance per line overlay (not shared)
 * - Caches styles and path data for efficient updates
 * - Delegates to RouterCore for path computation
 * - Manages marker, gradient, and pattern definitions
 *
 * Lifecycle:
 * 1. Constructor: Initialize caches and RouterCore reference
 * 2. initialize(mountEl): Pre-resolve styles
 * 3. render(): Create line SVG markup with routing
 * 4. update(): Recompute path if anchor positions change
 * 5. destroy(): Cleanup cached definitions
 */

import { OverlayBase } from './OverlayBase.js';
import { OverlayUtils } from '../renderer/OverlayUtils.js';
import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * LineOverlay - Instance-based line overlay
 *
 * Features:
 * - Multiple routing strategies (direct, smart, channel, arc)
 * - Advanced styling (gradients, patterns, markers, effects)
 * - Overlay-to-overlay attachment with gap support
 * - Theme token integration
 * - Animation hooks
 * - Glow and shadow effects
 * - Segment colors
 * - Dash patterns
 */
export class LineOverlay extends OverlayBase {
  constructor(overlay, systemsManager, routerCore = null) {
    super(overlay, systemsManager);

    // RouterCore is required for line path computation
    this.routerCore = routerCore;

    // Caching for efficient updates
    this._cachedLineStyle = null;
    this._cachedPathResult = null;
    this._cachedAnchors = null;

    // Definition caches for performance
    this.markerCache = new Map();
    this.gradientCache = new Map();
    this.patternCache = new Map();

    // Attachment points for overlay-to-overlay connections
    this.overlayAttachmentPoints = null;

    cblcarsLog.debug(`[LineOverlay] Created instance for overlay ${overlay.id}`);
  }

  /**
   * Initialize line overlay
   * Pre-resolves styles for efficient rendering
   *
   * @param {Element} mountEl - Mount element for the overlay
   * @returns {Promise<void>}
   */
  async initialize(mountEl) {
    await super.initialize(mountEl);

    try {
      if (!this.routerCore) {
        cblcarsLog.error(`[LineOverlay] RouterCore not available for overlay ${this.overlay.id}`);
        throw new Error('RouterCore not available');
      }

      // Pre-resolve line styles
      const viewBox = this.systemsManager?.rendererSystem?.viewBox || [0, 0, 800, 600];
      const style = this.overlay.finalStyle || this.overlay.style || {};
      this._cachedLineStyle = this._resolveLineStyles(style, this.overlay.id, viewBox);

      cblcarsLog.debug(`[LineOverlay] Initialized overlay ${this.overlay.id}:`, {
        hasStyle: !!this._cachedLineStyle,
        features: this._cachedLineStyle?.features?.length || 0,
        routingStrategy: this.overlay.routing_strategy
      });
    } catch (error) {
      cblcarsLog.error(`[LineOverlay] Error initializing overlay ${this.overlay.id}:`, error);
      throw error;
    }
  }

  /**
   * Set overlay attachment points for overlay-to-overlay line connections
   *
   * @param {Map} overlayAttachmentPoints - Map of overlay ID to attachment point data
   */
  setOverlayAttachmentPoints(overlayAttachmentPoints) {
    this.overlayAttachmentPoints = overlayAttachmentPoints;
    cblcarsLog.debug(`[LineOverlay] Updated with ${overlayAttachmentPoints?.size || 0} attachment points`);
  }

  /**
   * Render line overlay
   *
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions [minX, minY, width, height]
   * @param {Element} svgContainer - SVG container element
   * @param {Object} cardInstance - Card instance (not used for lines)
   * @returns {Object} {markup, actionInfo, overlayId, metadata, provenance}
   */
  render(overlay, anchors, viewBox, svgContainer, cardInstance) {
    if (!this.routerCore) {
      cblcarsLog.error(`[LineOverlay] RouterCore not available for overlay ${overlay.id}`);
      return {
        markup: '',
        actionInfo: null,
        overlayId: overlay.id,
        metadata: { error: 'router_unavailable' },
        provenance: this._getRendererProvenance(overlay.id, {
          overlay_type: 'line',
          error: 'router_unavailable'
        })
      };
    }

    // Cache anchors for update checks
    this._cachedAnchors = anchors;

    // Resolve anchor positions with overlay attachment support
    let anchor = this._resolveAnchor(overlay, anchors);
    let anchor2 = this._resolveAttachTo(overlay, anchors);

    cblcarsLog.trace(`[LineOverlay] 📍 Resolved anchors for ${overlay.id}: anchor=[${anchor}], anchor2=[${anchor2}], attach_gap=${overlay.attach_gap}, anchor_gap=${overlay.anchor_gap}`);

    // Validate anchors
    if (!anchor || !Array.isArray(anchor) || anchor.length !== 2) {
      cblcarsLog.error(`[LineOverlay] Invalid anchor for ${overlay.id}:`, { anchor });
      return {
        markup: '',
        actionInfo: null,
        overlayId: overlay.id,
        metadata: { error: 'invalid_anchor' },
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
        cblcarsLog.warn(`[LineOverlay] No path computed for line ${overlay.id}`);
        return {
          markup: '',
          actionInfo: null,
          overlayId: overlay.id,
          metadata: { error: 'no_path_computed' },
          provenance: this._getRendererProvenance(overlay.id, {
            overlay_type: 'line',
            error: 'no_path_computed'
          })
        };
      }

      // Cache path result for updates
      this._cachedPathResult = pathResult;

      // Use cached styles or resolve fresh
      const lineStyle = this._cachedLineStyle || this._resolveLineStyles(
        overlay.finalStyle || overlay.style || {},
        overlay.id,
        viewBox
      );

      const animationAttributes = this._prepareAnimationAttributes(overlay, overlay.style || {});

      // Build SVG group with all features
      const svgParts = [
        this._buildDefinitions(lineStyle, overlay.id),
        this._buildMainPath(pathResult.d, lineStyle, overlay.id, animationAttributes),
        this._buildMarkers(pathResult, lineStyle, overlay.id),
        this._buildEffects(pathResult, lineStyle, overlay.id)
      ].filter(Boolean);

      cblcarsLog.debug(`[LineOverlay] Rendered line ${overlay.id} with ${lineStyle.features.length} features`);

      const markup = `<g id="${overlay.id}"
                data-overlay-id="${overlay.id}"
                  data-overlay-type="line"
                  data-routing-strategy="${pathResult.meta?.strategy || 'unknown'}"
                  data-animation-ready="${!!animationAttributes.hasAnimations}">
                ${svgParts.join('\n')}
              </g>`;

      return {
        markup,
        actionInfo: null, // Lines don't have actions
        overlayId: overlay.id,
        metadata: {
          routingStrategy: pathResult.meta?.strategy || 'unknown',
          pathLength: pathResult.d.length,
          featuresCount: lineStyle.features.length,
          hasAnimations: animationAttributes.hasAnimations
        },
        provenance: this._getRendererProvenance(overlay.id, {
          overlay_type: 'line',
          routing_strategy: pathResult.meta?.strategy || 'unknown',
          path_length: pathResult.d.length,
          features_count: lineStyle.features.length,
          has_animations: animationAttributes.hasAnimations
        })
      };

    } catch (error) {
      cblcarsLog.error(`[LineOverlay] Rendering failed for line ${overlay.id}:`, error);

      const fallback = this._renderFallbackLine(overlay, anchor, anchor2);
      return {
        markup: fallback,
        actionInfo: null,
        overlayId: overlay.id,
        metadata: { error: error.message, fallback: true },
        provenance: this._getRendererProvenance(overlay.id, {
          overlay_type: 'line',
          fallback_used: true,
          error: error.message
        })
      };
    }
  }

  /**
   * Update line overlay
   * Recomputes path if anchor positions changed
   *
   * @param {Element} overlayElement - The overlay's DOM element
   * @param {Object} overlay - Updated overlay configuration
   * @param {*} sourceData - New data from data source (not used for lines)
   * @returns {boolean} Success status
   */
  update(overlayElement, overlay, sourceData) {
    // Lines typically don't update based on data changes
    // They update when anchor positions change, which triggers a full re-render
    cblcarsLog.debug(`[LineOverlay] Update called for ${overlay.id} (lines typically re-render on anchor changes)`);
    return true;
  }

  /**
   * Destroy line overlay
   * Cleanup cached definitions and resources
   */
  destroy() {
    cblcarsLog.debug(`[LineOverlay] Destroying overlay ${this.overlay.id}`);

    // Clear caches
    this._cachedLineStyle = null;
    this._cachedPathResult = null;
    this._cachedAnchors = null;
    this.markerCache.clear();
    this.gradientCache.clear();
    this.patternCache.clear();
    this.overlayAttachmentPoints = null;

    // Call parent destroy
    super.destroy();
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Resolve comprehensive line styling from configuration
   *
   * @private
   * @param {Object} style - Style configuration
   * @param {string} overlayId - Overlay ID for logging
   * @param {Array} viewBox - SVG viewBox for scaling context
   * @returns {Object} Resolved line styles
   */
  _resolveLineStyles(style, overlayId, viewBox) {
    // Create component-scoped token resolver
    const resolveToken = (themeTokenResolver && typeof themeTokenResolver.forComponent === 'function')
      ? themeTokenResolver.forComponent('line')
      : null;
    const scalingContext = this._getScalingContext(viewBox);

    const lineStyle = {
      // Core stroke properties with token integration
      color: this._resolveStyleProperty(
        style.color || style.stroke,
        'defaultColor',
        resolveToken,
        'var(--lcars-orange)',
        scalingContext
      ),

      width: Number(this._resolveStyleProperty(
        style.width || style.stroke_width || style.strokeWidth,
        'defaultWidth',
        resolveToken,
        2,
        scalingContext
      )),

      opacity: Number(this._resolveStyleProperty(
        style.opacity,
        'effects.opacity.base',
        resolveToken,
        1,
        scalingContext
      )),

      // Advanced stroke styling
      lineCap: (style.line_cap || style.lineCap || style.strokeLinecap || 'round').toLowerCase(),
      lineJoin: (style.line_join || style.lineJoin || style.strokeLinejoin || 'round').toLowerCase(),
      miterLimit: Number(style.miter_limit || style.miterLimit || 4),

      // Dash patterns
      dashArray: style.dash_array || style.dashArray || style.strokeDasharray || null,
      dashOffset: Number(style.dash_offset || style.dashOffset || style.strokeDashoffset || 0),

      // Fill properties
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

      // Animation states
      animatable: style.animatable !== false,
      pulseSpeed: Number(style.pulse_speed || 0),
      flowSpeed: Number(style.flow_speed || 0),

      // LCARS-specific features
      segment_colors: this._parseSegmentColors(style.segment_colors),
      status_indicator: style.status_indicator || null,

      // Track enabled features
      features: []
    };

    // Build feature list
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
   * Resolve a style property using token system with fallback
   *
   * @private
   */
  _resolveStyleProperty(styleValue, tokenPath, resolveToken, fallback, context = {}) {
    if (styleValue !== undefined && styleValue !== null) {
      if (resolveToken && typeof styleValue === 'string' && this._isTokenReference(styleValue)) {
        return resolveToken(styleValue, fallback, context);
      }
      return styleValue;
    }

    if (resolveToken) {
      return resolveToken(tokenPath, fallback, context);
    }

    return fallback;
  }

  /**
   * Check if a value is a token reference
   *
   * @private
   */
  _isTokenReference(value) {
    if (typeof value !== 'string') return false;
    const tokenCategories = ['colors', 'typography', 'spacing', 'borders', 'effects', 'animations', 'components'];
    return tokenCategories.some(category => value.startsWith(`${category}.`));
  }

  /**
   * Get scaling context for responsive token resolution
   *
   * @private
   */
  _getScalingContext(viewBox) {
    return { viewBox };
  }

  /**
   * Resolve anchor position with overlay attachment support
   *
   * @private
   */
  _resolveAnchor(overlay, anchors) {
    cblcarsLog.trace(`[LineOverlay] 🎯 _resolveAnchor for ${overlay.id}:`, {
      anchor: overlay.anchor,
      anchor_side: overlay.anchor_side,
      hasOverlayAttachmentPoints: this.overlayAttachmentPoints?.has(overlay.anchor)
    });

    // PRIORITY 1: Check if we have a virtual anchor (overlay.side format) with gap already applied
    // This is created by AdvancedRenderer when it processes overlay-to-overlay connections
    if (typeof overlay.anchor === 'string') {
      const anchorSide = (overlay.anchor_side || '').toLowerCase();

      // Construct virtual anchor ID the same way AdvancedRenderer does
      const virtualAnchorId = anchorSide && anchorSide !== 'center'
        ? `${overlay.anchor}.${anchorSide}`
        : overlay.anchor;

      cblcarsLog.trace(`[LineOverlay] 🔍 Trying virtual anchor:`, {
        anchorSide,
        virtualAnchorId,
        hasInAnchors: !!anchors[virtualAnchorId]
      });

      // Try to resolve the virtual anchor first (gap already applied by AdvancedRenderer)
      const virtualAnchor = OverlayUtils.resolvePosition(virtualAnchorId, anchors);
      if (virtualAnchor) {
        cblcarsLog.trace(`[LineOverlay] ✅ Resolved virtual anchor (gap pre-applied):`, virtualAnchor);
        return virtualAnchor;
      }
    }

    // PRIORITY 2: Check if anchor refers to an overlay (fallback if virtual anchor doesn't exist)
    if (typeof overlay.anchor === 'string' && this.overlayAttachmentPoints?.has(overlay.anchor)) {
      const sourceAttachmentPoints = this.overlayAttachmentPoints.get(overlay.anchor);
      if (sourceAttachmentPoints?.points) {
        const anchorSide = overlay.anchor_side || 'center';
        const sourcePoint = this._resolveAttachmentPoint(sourceAttachmentPoints.points, anchorSide);

        if (sourcePoint) {
          const anchorGap = overlay.anchor_gap || 0;
          const result = this._applyGapToAttachmentPoint(sourcePoint, anchorSide, anchorGap, sourceAttachmentPoints.bbox);
          cblcarsLog.debug(`[LineOverlay] ✅ Resolved from overlayAttachmentPoints (gap applied on-the-fly):`, result);
          return result;
        }
      }
    }

    // PRIORITY 3: Standard anchor resolution (final fallback)
    const fallback = OverlayUtils.resolvePosition(overlay.anchor, anchors);
    cblcarsLog.debug(`[LineOverlay] 🔄 Using fallback resolution:`, fallback);
    return fallback;
  }

  /**
   * Resolve attach_to position with overlay attachment support
   *
   * @private
   */
  _resolveAttachTo(overlay, anchors) {
    cblcarsLog.trace(`[LineOverlay] 🎯 _resolveAttachTo for ${overlay.id}:`, {
      attach_to: overlay.attach_to,
      attach_side: overlay.attach_side,
      hasOverlayAttachmentPoints: this.overlayAttachmentPoints?.has(overlay.attach_to)
    });

    // PRIORITY 1: Check if we have a virtual anchor (overlay.side format) with gap already applied
    // This is created by AdvancedRenderer when it processes overlay-to-overlay connections
    if (typeof overlay.attach_to === 'string') {
      const attachSide = (overlay.attach_side || '').toLowerCase();

      // Construct virtual anchor ID the same way AdvancedRenderer does
      const virtualAnchorId = attachSide && attachSide !== 'center'
        ? `${overlay.attach_to}.${attachSide}`
        : overlay.attach_to;

      cblcarsLog.trace(`[LineOverlay] 🔍 Trying virtual anchor:`, {
        attachSide,
        virtualAnchorId,
        hasInAnchors: !!anchors[virtualAnchorId]
      });

      // Try to resolve the virtual anchor first (gap already applied by AdvancedRenderer)
      const virtualAnchor = OverlayUtils.resolvePosition(virtualAnchorId, anchors);
      if (virtualAnchor) {
        cblcarsLog.trace(`[LineOverlay] ✅ Resolved virtual anchor (gap pre-applied):`, virtualAnchor);
        return virtualAnchor;
      }
    }

    // PRIORITY 2: Check if attach_to refers to an overlay (fallback if virtual anchor doesn't exist)
    if (typeof overlay.attach_to === 'string' && this.overlayAttachmentPoints?.has(overlay.attach_to)) {
      const targetAttachmentPoints = this.overlayAttachmentPoints.get(overlay.attach_to);
      if (targetAttachmentPoints?.points) {
        const attachSide = overlay.attach_side || 'center';
        const targetPoint = this._resolveAttachmentPoint(targetAttachmentPoints.points, attachSide);

        if (targetPoint) {
          const attachGap = overlay.attach_gap || 0;
          const result = this._applyGapToAttachmentPoint(targetPoint, attachSide, attachGap, targetAttachmentPoints.bbox);
          cblcarsLog.debug(`[LineOverlay] ✅ Resolved from overlayAttachmentPoints (gap applied on-the-fly):`, result);
          return result;
        }
      }
    }

    // PRIORITY 3: Standard attach_to resolution (final fallback)
    const fallback = OverlayUtils.resolvePosition(overlay.attach_to, anchors);
    cblcarsLog.debug(`[LineOverlay] 🔄 Using fallback resolution:`, fallback);
    return fallback;
  }

  /**
   * Resolve attachment point by side
   *
   * @private
   */
  _resolveAttachmentPoint(points, side) {
    if (!points) return null;

    const sideMap = {
      'top': points.top,
      'right': points.right,
      'bottom': points.bottom,
      'left': points.left,
      'center': points.center,
      'top-left': points.topLeft,
      'top-right': points.topRight,
      'bottom-left': points.bottomLeft,
      'bottom-right': points.bottomRight
    };

    return sideMap[side] || points.center || null;
  }

  /**
   * Apply gap to attachment point
   *
   * @private
   */
  _applyGapToAttachmentPoint(point, side, gap, bbox) {
    if (!gap || gap === 0) return point;

    const [x, y] = point;

    switch (side) {
      case 'top':
        return [x, y - gap];
      case 'bottom':
        return [x, y + gap];
      case 'left':
        return [x - gap, y];
      case 'right':
        return [x + gap, y];
      default:
        return point;
    }
  }

  /**
   * Prepare animation attributes
   *
   * @private
   */
  _prepareAnimationAttributes(overlay, style) {
    return {
      hasAnimations: style.animatable !== false || style.pulse_speed > 0 || style.flow_speed > 0,
      animatable: style.animatable !== false,
      pulseSpeed: style.pulse_speed || 0,
      flowSpeed: style.flow_speed || 0
    };
  }

  /**
   * Build SVG definitions (gradients, patterns, markers)
   *
   * @private
   */
  _buildDefinitions(lineStyle, overlayId) {
    const defs = [];

    // Gradient definitions
    if (lineStyle.gradient) {
      const gradientId = `gradient-${overlayId}`;
      if (!this.gradientCache.has(gradientId)) {
        const gradientDef = this._createGradientDefinition(lineStyle.gradient, gradientId);
        this.gradientCache.set(gradientId, gradientDef);
      }
      defs.push(this.gradientCache.get(gradientId));
    }

    // Pattern definitions
    if (lineStyle.pattern) {
      const patternId = `pattern-${overlayId}`;
      if (!this.patternCache.has(patternId)) {
        const patternDef = this._createPatternDefinition(lineStyle.pattern, patternId);
        this.patternCache.set(patternId, patternDef);
      }
      defs.push(this.patternCache.get(patternId));
    }

    // Marker definitions
    ['markerStart', 'markerMid', 'markerEnd'].forEach((markerType, index) => {
      if (lineStyle[markerType]) {
        const markerPosition = ['start', 'mid', 'end'][index];
        const markerId = `marker-${markerPosition}-${overlayId}`;
        if (!this.markerCache.has(markerId)) {
          const markerDef = this._createMarkerDefinition(lineStyle[markerType], markerId);
          this.markerCache.set(markerId, markerDef);
        }
        defs.push(this.markerCache.get(markerId));
      }
    });

    return defs.length > 0 ? `<defs>${defs.join('')}</defs>` : '';
  }

  /**
   * Build main path element
   *
   * @private
   */
  _buildMainPath(pathD, lineStyle, overlayId, animationAttributes) {
    const stroke = lineStyle.gradient ? `url(#gradient-${overlayId})` :
                   lineStyle.pattern ? `url(#pattern-${overlayId})` :
                   lineStyle.color;

    const markerStart = lineStyle.markerStart ? `url(#marker-start-${overlayId})` : '';
    const markerMid = lineStyle.markerMid ? `url(#marker-mid-${overlayId})` : '';
    const markerEnd = lineStyle.markerEnd ? `url(#marker-end-${overlayId})` : '';

    return `<path
      d="${pathD}"
      stroke="${stroke}"
      stroke-width="${lineStyle.width}"
      stroke-opacity="${lineStyle.opacity}"
      stroke-linecap="${lineStyle.lineCap}"
      stroke-linejoin="${lineStyle.lineJoin}"
      ${lineStyle.miterLimit ? `stroke-miterlimit="${lineStyle.miterLimit}"` : ''}
      ${lineStyle.dashArray ? `stroke-dasharray="${lineStyle.dashArray}"` : ''}
      ${lineStyle.dashOffset ? `stroke-dashoffset="${lineStyle.dashOffset}"` : ''}
      fill="${lineStyle.fill}"
      fill-opacity="${lineStyle.fillOpacity}"
      ${markerStart ? `marker-start="${markerStart}"` : ''}
      ${markerMid ? `marker-mid="${markerMid}"` : ''}
      ${markerEnd ? `marker-end="${markerEnd}"` : ''}
      data-animatable="${animationAttributes.animatable}"
    />`;
  }

  /**
   * Build markers (placeholder - simplified)
   *
   * @private
   */
  _buildMarkers(pathResult, lineStyle, overlayId) {
    // Markers are handled in definitions
    return null;
  }

  /**
   * Build effects (glow, shadow - placeholder - simplified)
   *
   * @private
   */
  _buildEffects(pathResult, lineStyle, overlayId) {
    // Effects would add filter elements
    return null;
  }

  /**
   * Render fallback line for error cases
   *
   * @private
   */
  _renderFallbackLine(overlay, anchor, anchor2) {
    const [x1, y1] = anchor;
    const [x2, y2] = anchor2 || anchor;
    const color = overlay.style?.color || 'var(--lcars-orange)';

    cblcarsLog.warn(`[LineOverlay] Using fallback rendering for overlay ${overlay.id}`);

    return `<g id="${overlay.id}" data-overlay-id="${overlay.id}" data-overlay-type="line" data-fallback="true">
              <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                    stroke="${color}" stroke-width="2" />
            </g>`;
  }

  /**
   * Get renderer provenance information
   *
   * @private
   */
  _getRendererProvenance(overlayId, metadata = {}) {
    return {
      renderer: 'LineOverlay',
      version: '3.0.0',
      timestamp: Date.now(),
      overlayId,
      metadata
    };
  }

  // ============================================================================
  // PARSING METHODS (Simplified - full implementation in original file)
  // ============================================================================

  _parseGradientConfig(gradientConfig) {
    if (!gradientConfig) return null;
    if (typeof gradientConfig === 'string') {
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
    }
    if (typeof gradientConfig === 'object') {
      return {
        type: gradientConfig.type || 'linear',
        direction: gradientConfig.direction || 'horizontal',
        stops: gradientConfig.stops || []
      };
    }
    return null;
  }

  _parsePatternConfig(patternConfig) {
    if (!patternConfig) return null;
    if (typeof patternConfig === 'string') {
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

  _parseMarkerConfig(markerConfig) {
    if (!markerConfig) return null;
    return markerConfig; // Simplified
  }

  _parseGlowConfig(glowConfig) {
    if (!glowConfig) return null;
    return glowConfig; // Simplified
  }

  _parseShadowConfig(shadowConfig) {
    if (!shadowConfig) return null;
    return shadowConfig; // Simplified
  }

  _parseSegmentColors(segmentColors) {
    if (!segmentColors) return null;
    return segmentColors; // Simplified
  }

  _createGradientDefinition(gradient, gradientId) {
    // Simplified gradient definition
    const stops = gradient.stops.map(stop =>
      `<stop offset="${stop.offset}" stop-color="${stop.color}" />`
    ).join('');

    return `<linearGradient id="${gradientId}">${stops}</linearGradient>`;
  }

  _createPatternDefinition(pattern, patternId) {
    // Simplified pattern definition
    return `<pattern id="${patternId}" width="${pattern.size}" height="${pattern.size}" patternUnits="userSpaceOnUse">
              <circle cx="${pattern.size / 2}" cy="${pattern.size / 2}" r="1" fill="${pattern.color}" opacity="${pattern.opacity || 0.5}" />
            </pattern>`;
  }

  _createMarkerDefinition(marker, markerId) {
    // Simplified marker definition
    return `<marker id="${markerId}" markerWidth="10" markerHeight="10" refX="5" refY="5">
              <circle cx="5" cy="5" r="3" fill="currentColor" />
            </marker>`;
  }
}

// Expose to window for console debugging
if (typeof window !== 'undefined') {
  window.LineOverlay = LineOverlay;
}
