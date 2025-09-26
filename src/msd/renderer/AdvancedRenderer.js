/**
 * Advanced Renderer - Clean implementation for MSD v1
 * Main orchestrator that delegates to specialized renderers
 */


import { RendererUtils } from './RendererUtils.js';
import { PositionResolver } from './PositionResolver.js';

import { LineOverlayRenderer } from './LineOverlayRenderer.js';
import { TextOverlayRenderer } from './TextOverlayRenderer.js';
import { SparklineRenderer } from './SparklineRenderer.js';
import { StatusGridRenderer } from './StatusGridRenderer.js';
import { HistoryBarRenderer } from './HistoryBarRenderer.js';
import { MsdControlsRenderer } from '../controls/MsdControlsRenderer.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class AdvancedRenderer {
  constructor(mountEl, routerCore, systemsManager = null) {
    this.mountEl = mountEl;
    this.routerCore = routerCore;
    this.systemsManager = systemsManager; // ADDED: Store reference to systems manager
    this.overlayElements = new Map();
    this.lastRenderArgs = null;
    this.lineRenderer = new LineOverlayRenderer(routerCore);

    // Track overlay elements for efficient updates
    this.overlayElementCache = new Map(); // overlayId -> DOM element
    this.overlayAttachmentPoints = new Map(); // UNIFIED: All overlay attachment points
    this.textAttachmentPoints = new Map(); // DEPRECATED: Keep for backward compatibility
    this._lineDeps = new Map(); // targetOverlayId -> Set(lineOverlayId)
  }

  render(resolvedModel) {

    cblcarsLog.debug('[AdvancedRenderer] 🎨 AdvancedRenderer.render() ENTRY:', {
      timestamp: new Date().toISOString(),
      hasResolvedModel: !!resolvedModel,
      overlayCount: resolvedModel?.overlays?.length || 0,
      anchorCount: resolvedModel?.anchors ? Object.keys(resolvedModel.anchors).length : 0,
      hasViewBox: !!resolvedModel?.viewBox,
      mountElExists: !!this.mountEl,
      stackTrace: new Error().stack.split('\n').slice(1, 3).join('\n')
    });

    if (!resolvedModel) {
      cblcarsLog.info('[AdvancedRenderer] ❌ AdvancedRenderer.render() - No resolved model provided');
      return { svgMarkup: '', overlayCount: 0 };
    }
    const { overlays = [], anchors = {}, viewBox } = resolvedModel;
    cblcarsLog.debug(`[AdvancedRenderer] 🎨 AdvancedRenderer processing:`, {
      overlayCount: overlays.length,
      overlayTypes: overlays.map(o => o.type),
      anchorCount: Object.keys(anchors).length,
      viewBox
    });
    this.overlayElements.clear();
    // Phase rendering requires live SVG early
    const svg = this.mountEl?.querySelector('svg');
    if (!svg) {
      cblcarsLog.info('[AdvancedRenderer] ❌ AdvancedRenderer.render() - SVG element not found in container:', {
        mountEl: this.mountEl,
        mountElTagName: this.mountEl?.tagName,
        mountElChildren: this.mountEl?.children?.length || 0
      });
      return { svgMarkup: '', overlayCount: 0 };
    }

    cblcarsLog.debug('[AdvancedRenderer] ✅ SVG element found, proceeding with overlay rendering');

    // Prepare / clear overlay group
    const overlayGroup = this._ensureOverlayGroup(svg);
    overlayGroup.innerHTML = '';
    this.overlayElementCache.clear();

    // Precompute attachment points for all overlay types (after initial render)
    this.overlayAttachmentPoints.clear();
    this.textAttachmentPoints.clear(); // Keep for backward compatibility

    overlays.forEach(ov => {
      const attachmentPoints = this.computeAttachmentPointsForType(ov, anchors, this.mountEl);
      if (attachmentPoints) {
        this.overlayAttachmentPoints.set(ov.id, attachmentPoints);

        // BACKWARD COMPATIBILITY: Also populate textAttachmentPoints for text overlays
        if (ov.type === 'text') {
          this.textAttachmentPoints.set(ov.id, attachmentPoints);
        }
      }
    });

    this.lineRenderer.setOverlayAttachmentPoints(this.overlayAttachmentPoints);

    // Phase 1: render overlays that others may depend on (text, sparkline)
    const earlyTypes = new Set(['text', 'sparkline']);
    let svgMarkupAccum = '';
    let processedCount = 0;
    overlays.filter(o => earlyTypes.has(o.type)).forEach(ov => {
      try {
        const html = this.renderOverlay(ov, anchors, viewBox);
        if (html) {
          svgMarkupAccum += html;
        }
        processedCount++;
      } catch (e) {
        cblcarsLog.info('[AdvancedRenderer] Phase1 failed for', ov.id, e);
      }
    });
    overlayGroup.innerHTML = svgMarkupAccum;
    this._cacheElementsFrom(overlayGroup);

    // Build dynamic anchors (overlay destinations)
    this._dynamicAnchors = { ...anchors };
    this._buildDynamicOverlayAnchors(overlays, this._dynamicAnchors);

    // Build virtual anchors from ALL overlay attachment points for line anchoring
    this._buildVirtualAnchorsFromAllOverlays(overlays, this._dynamicAnchors);

    // Phase 2: render line overlays (now DOM for targets exists)
    overlays.filter(o => !earlyTypes.has(o.type)).forEach(ov => {
      try {
        const html = this.renderOverlay(ov, this._dynamicAnchors, viewBox); // pass dynamic anchors
        if (html) {
          overlayGroup.insertAdjacentHTML('beforeend', html);
          svgMarkupAccum += html;
          const el = overlayGroup.querySelector(`[data-overlay-id="${ov.id}"]`);
          if (el) this.overlayElementCache.set(ov.id, el);
          const raw = ov._raw || ov.raw || {};
          const targetId = raw.attach_to || raw.attachTo;
          if (targetId) {
            if (!this._lineDeps.has(targetId)) this._lineDeps.set(targetId, new Set());
            this._lineDeps.get(targetId).add(ov.id);

            // NEW: ensure RouterCore sees a route for overlay-destination line (HUD listing)
            if (this.routerCore && raw.anchor && this._dynamicAnchors[raw.anchor] && this._dynamicAnchors[targetId]) {
              try {
                const req = this.routerCore.buildRouteRequest(
                  ov,
                  this._dynamicAnchors[raw.anchor],
                  this._dynamicAnchors[targetId]
                );
                this.routerCore.computePath(req);
              } catch (e) {
                cblcarsLog.info('[AdvancedRenderer] Overlay-destination route registration failed', ov.id, e);
              }
            }
          }
        }
        processedCount++;
      } catch (e) {
        cblcarsLog.info('[AdvancedRenderer] Phase2 failed for', ov.id, e);
      }
    });

    cblcarsLog.debug('[AdvancedRenderer] Injected elements (after phased render):', {
      total: this.overlayElementCache.size,
      text: overlayGroup.querySelectorAll('[data-overlay-type="text"]').length,
      lines: overlayGroup.querySelectorAll('[data-overlay-type="line"]').length,
      sparklines: overlayGroup.querySelectorAll('[data-overlay-type="sparkline"]').length
    });

    // NEW: schedule deferred line refresh to fix first-load orientation/position
    this._scheduleDeferredLineRefresh(overlays, this._dynamicAnchors, viewBox);

    // NEW: schedule font stabilization pass (re-measure after real fonts load)
    this._scheduleFontStabilization(overlays, this._dynamicAnchors, viewBox);

    this.lastRenderArgs = { resolvedModel, overlays, svg };
    return {
      svgMarkup: svgMarkupAccum,
      overlayCount: processedCount,
      errors: overlays.length - processedCount
    };
  }

  /**
   * Compute attachment points for any overlay type
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Available anchors
   * @param {Element} container - Container element for measurements
   * @returns {Object|null} Attachment points object or null if not computable
   */
  computeAttachmentPointsForType(overlay, anchors, container) {
    if (!overlay || !overlay.type || !overlay.id) {
      return null;
    }

    try {
      switch (overlay.type) {
        case 'text':
          return this._computeTextAttachmentPoints(overlay, anchors, container);
        case 'sparkline':
          return this._computeSparklineAttachmentPoints(overlay, anchors, container);
        case 'history_bar':
          return this._computeHistoryBarAttachmentPoints(overlay, anchors, container);
        case 'status_grid':
          return this._computeStatusGridAttachmentPoints(overlay, anchors, container);
        case 'control':
          return this._computeControlAttachmentPoints(overlay, anchors, container);
        case 'line':
          // Lines don't have attachment points (they attach to others, not vice versa)
          return null;
        default:
          cblcarsLog.warn(`[AdvancedRenderer] Unknown overlay type for attachment points: ${overlay.type}`);
          return null;
      }
    } catch (error) {
      cblcarsLog.warn(`[AdvancedRenderer] Failed to compute attachment points for ${overlay.id}:`, error);
      return null;
    }
  }

  // Individual attachment point computation methods for each overlay type

  _computeTextAttachmentPoints(overlay, anchors, container) {
    // Use existing TextOverlayRenderer method
    return TextOverlayRenderer.computeAttachmentPoints(overlay, anchors, container);
  }

  _computeSparklineAttachmentPoints(overlay, anchors, container) {
    return SparklineRenderer.computeAttachmentPoints(overlay, anchors, container);
  }

  _computeHistoryBarAttachmentPoints(overlay, anchors, container) {
    return HistoryBarRenderer.computeAttachmentPoints(overlay, anchors, container);
  }

  _computeStatusGridAttachmentPoints(overlay, anchors, container) {
    return StatusGridRenderer.computeAttachmentPoints(overlay, anchors, container);
  }

  _computeControlAttachmentPoints(overlay, anchors, container) {
    return MsdControlsRenderer.computeAttachmentPoints(overlay, anchors, container);
  }

  /**
   * Compute basic attachment points for non-text overlays using position/size
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Available anchors
   * @param {string} type - Overlay type for logging
   * @returns {Object|null} Attachment points object
   */
  _computeBasicAttachmentPoints(overlay, anchors, type) {
    const position = PositionResolver.resolvePosition(overlay.position, anchors);
    const size = overlay.size;

    if (!position || !size || !Array.isArray(size) || size.length < 2) {
      cblcarsLog.debug(`[AdvancedRenderer] Cannot compute attachment points for ${type} ${overlay.id}: missing position or size`);
      return null;
    }

    const [x, y] = position;
    const [width, height] = size;

    // Calculate bounding box
    const left = x;
    const right = x + width;
    const top = y;
    const bottom = y + height;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    const attachmentPoints = {
      id: overlay.id,
      center: [centerX, centerY],
      bbox: {
        left,
        right,
        top,
        bottom,
        width,
        height,
        x,
        y
      },
      points: {
        center: [centerX, centerY],
        top: [centerX, top],
        bottom: [centerX, bottom],
        left: [left, centerY],
        right: [right, centerY],
        topLeft: [left, top],
        topRight: [right, top],
        bottomLeft: [left, bottom],
        bottomRight: [right, bottom],
        // Aliases for common naming conventions
        'top-left': [left, top],
        'top-right': [right, top],
        'bottom-left': [left, bottom],
        'bottom-right': [right, bottom]
      }
    };

    cblcarsLog.debug(`[AdvancedRenderer] Created attachment points for ${type} ${overlay.id}:`, {
      center: attachmentPoints.center,
      bbox: attachmentPoints.bbox,
      availablePoints: Object.keys(attachmentPoints.points)
    });

    return attachmentPoints;
  }  _ensureOverlayGroup(svg) {
    let group = svg.querySelector('#msd-overlay-container');
    if (!group) {
      group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('id', 'msd-overlay-container');
      svg.appendChild(group);
    }
    return group;
  }

  _cacheElementsFrom(group) {
    const nodes = group.querySelectorAll('[data-overlay-id]');
    nodes.forEach(el => {
      const id = el.getAttribute('data-overlay-id');
      if (id) this.overlayElementCache.set(id, el);
    });
  }

  // NEW: build virtual anchors for lines that attach to overlays
  _buildDynamicOverlayAnchors(overlays, anchorMap) {
    overlays.filter(o => o.type === 'line').forEach(line => {
      const raw = line._raw || line.raw || {};
      const dest = raw.attach_to || raw.attachTo;
      if (!dest) return;
      // Use unified attachment points (includes all overlay types)
      const attachmentPointData = this.overlayAttachmentPoints.get(dest);
      if (!attachmentPointData || !attachmentPointData.points) return;
      const side = (raw.attach_side || raw.attachSide || '').toLowerCase();
      const basePt = this._resolveOverlayAttachmentPoint(attachmentPointData.points, side);
      if (!basePt) return;
      const gapPt = this._applyAttachGap(basePt, side, raw, attachmentPointData.bbox);
      anchorMap[dest] = gapPt;
      // Register in routerCore so HUD sees it as an anchor
      if (this.routerCore && this.routerCore.anchors) {
        this.routerCore.anchors[dest] = gapPt;
        try {
          this.routerCore.invalidate(line.id);
          const srcAnchor = anchorMap[raw.anchor] || this.routerCore.anchors[raw.anchor];
          if (srcAnchor) {
            const req = this.routerCore.buildRouteRequest(line, srcAnchor, gapPt);
            this.routerCore.computePath(req);
          }
        } catch(e) {
          cblcarsLog.info('[AdvancedRenderer] Route registration (initial) failed', line.id, e);
        }
      }
      // Track dependency
      if (!this._lineDeps.has(dest)) this._lineDeps.set(dest, new Set());
      this._lineDeps.get(dest).add(line.id);
    });
  }

  // NEW: update dynamic anchors for changed text overlays
  _updateDynamicAnchorsForOverlays(changedIds, overlays, anchorMap) {
    if (!changedIds.size) return;
    changedIds.forEach(id => {
      const tap = this.textAttachmentPoints.get(id);
      if (!tap || !tap.points) return;
      const dep = this._lineDeps.get(id);
      if (!dep) return;
      dep.forEach(lineId => {
        const line = overlays.find(o => o.id === lineId);
        if (!line) return;
        const raw = line._raw || line.raw || {};
        const side = (raw.attach_side || raw.attachSide || '').toLowerCase();
        const basePt = this._resolveOverlayAttachmentPoint(tap.points, side);
        if (!basePt) return;
        const gapPt = this._applyAttachGap(basePt, side, raw, tap.bbox);
        anchorMap[id] = gapPt;
        if (this.routerCore && this.routerCore.anchors) {
          this.routerCore.anchors[id] = gapPt;
          try {
            this.routerCore.invalidate(line.id);
            const srcAnchor = anchorMap[raw.anchor] || this.routerCore.anchors[raw.anchor];
            if (srcAnchor) {
              const req = this.routerCore.buildRouteRequest(line, srcAnchor, gapPt);
              this.routerCore.computePath(req);
            }
          } catch(e) {
            cblcarsLog.info('[AdvancedRenderer] Route registration (update) failed', line.id, e);
          }
        }
      });
    });
  }

  // NEW: apply attach_gap offsets
  _applyAttachGap(point, side, raw, bbox) {
    const gap = Number(raw.attach_gap || raw.attachGap || 0);
    const gapX = Number(raw.attach_gap_x || raw.attachGapX || gap || 0);
    const gapY = Number(raw.attach_gap_y || raw.attachGapY || gap || 0);
    if (!(gapX || gapY)) return point;
    const [x, y] = point;
    let dx = 0, dy = 0;
    switch (side) {
      case 'left': dx = -gapX; break;
      case 'right': dx = gapX; break;
      case 'top': dy = -gapY; break;
      case 'bottom': dy = gapY; break;
      case 'top-left': dx = -gapX; dy = -gapY; break;
      case 'top-right': dx = gapX; dy = -gapY; break;
      case 'bottom-left': dx = -gapX; dy = gapY; break;
      case 'bottom-right': dx = gapX; dy = gapY; break;
      default: break;
    }
    // Optional: ensure gap extends outward (based on bbox) if bbox provided
    if (bbox) {
      if (side.includes('left') && x > bbox.left) dx = -Math.abs(dx);
      if (side.includes('right') && x < bbox.right) dx = Math.abs(dx);
      if (side.includes('top') && y > bbox.top) dy = -Math.abs(dy);
      if (side.includes('bottom') && y < bbox.bottom) dy = Math.abs(dy);
    }
    return [x + dx, y + dy];
  }

  // NEW: resolve which attachment point to use based on side keyword
  _resolveOverlayAttachmentPoint(points, side) {
    if (!points) return null;
    switch (side) {
      case 'left': return points.left || points.leftPadded || points.center;
      case 'right': return points.right || points.rightPadded || points.center;
      case 'top': return points.top || points.topPadded || points.center;
      case 'bottom': return points.bottom || points.bottomPadded || points.center;
      case 'top-left': return points.topLeft || points.left || points.top || points.center;
      case 'top-right': return points.topRight || points.right || points.top || points.center;
      case 'bottom-left': return points.bottomLeft || points.left || points.bottom || points.center;
      case 'bottom-right': return points.bottomRight || points.right || points.bottom || points.center;
      case 'center':
      default:
        return points.center;
    }
  }

  // UPDATED: font stabilization pass using actual DOM glyph metrics (multi-pass) with better async handling
  _scheduleFontStabilization(overlays, anchorsRef, viewBox) {
    if (!overlays.some(o => o.type === 'text')) return;
    const MAX_PASSES = 10;
    const EXTRA_PASSES = 5; // safety extra passes after fonts load
    const TOL = 0.01;
    let pass = 0;
    const run = () => {
      const changedTargets = new Set();
      let anyUnstable = false;
      overlays.filter(o=>o.type==='text').forEach(ov => {
        const group = this.overlayElementCache.get(ov.id);
        if (!group) return;
        const bb = RendererUtils.getDomTextBBox(group);
        if (!bb) { anyUnstable = true; return; }
        const recordedW = parseFloat(group.getAttribute('data-text-width')||'0')||0;
        const recordedH = parseFloat(group.getAttribute('data-text-height')||'0')||0;
        const diffW = Math.abs(bb.width - recordedW);
        const diffH = Math.abs(bb.height - recordedH);
        const needsRerender = (diffW > TOL) || (diffH > TOL);

        if (needsRerender) {
          const newGroup = this._reRenderSingleTextOverlay(ov, anchorsRef, viewBox);
          if (newGroup) {
            const bb2 = RendererUtils.getDomTextBBox(newGroup);
            if (bb2) {
              newGroup.setAttribute('data-text-width', String(bb2.width));
              newGroup.setAttribute('data-text-height', String(bb2.height));
              this._updateStatusIndicatorPosition(newGroup, bb2);
            }
            changedTargets.add(ov.id);
            anyUnstable = true;
          }
        } else {
          if (diffW > 0 || diffH > 0) {
            group.setAttribute('data-text-width', String(bb.width));
            group.setAttribute('data-text-height', String(bb.height));
            changedTargets.add(ov.id);
          }
          if (group.getAttribute('data-font-stabilized') !== '1') {
            group.setAttribute('data-font-stabilized','1');
          }
          this._updateTextAttachmentPointsFromDom(ov, group, bb);
          // NEW: always update status indicator position even without re-render
          this._updateStatusIndicatorPosition(group, bb);
        }
      });

      this.lineRenderer.setOverlayAttachmentPoints(this.overlayAttachmentPoints);

      if (changedTargets.size) {
        this._updateDynamicAnchorsForOverlays(changedTargets, overlays, this._dynamicAnchors);
        this._rerenderDependentLines(changedTargets, overlays, this._dynamicAnchors, viewBox);
      }

      pass++;
      const morePassesAllowed = pass < (MAX_PASSES + EXTRA_PASSES);
      if ((changedTargets.size || anyUnstable) && morePassesAllowed) {
        requestAnimationFrame(run);
      } else {
        if (changedTargets.size) {
          this._scheduleDeferredLineRefresh(overlays, this._dynamicAnchors, viewBox);
        }
        // Final safety delayed pass in case font finished loading just after loop
        setTimeout(() => {
          const remaining = overlays.filter(o=>o.type==='text')
            .some(o => {
              const g = this.overlayElementCache.get(o.id);
              return g && g.getAttribute('data-font-stabilized') !== '1';
            });
          if (remaining) {
            cblcarsLog.debug('[AdvancedRenderer] Running safety stabilization pass');
            pass = 0;
            requestAnimationFrame(run);
          }
        }, 180);
        cblcarsLog.debug('[AdvancedRenderer] Font stabilization complete', { passes: pass, changed: Array.from(changedTargets) });
      }
    };

    // Wait for font faces if still loading
    const fontAPI = document.fonts;
    if (fontAPI && fontAPI.status !== 'loaded') {
      fontAPI.ready.then(() => requestAnimationFrame(run)).catch(() => requestAnimationFrame(run));
    } else {
      requestAnimationFrame(run);
    }
  }

  // UPDATED signature usages for dynamic anchors
  _scheduleDeferredLineRefresh(overlays, anchorsRef, viewBox) {
    if (typeof requestAnimationFrame !== 'function') return;
    const lineOverlays = overlays.filter(o =>
      o.type === 'line' &&
      ((o._raw || o.raw || {}).attach_side || (o._raw || o.raw || {}).attach_to)
    );
    if (!lineOverlays.length) return;
    requestAnimationFrame(() => {
      lineOverlays.forEach(ov => {
        const existingEl = this.overlayElementCache.get(ov.id);
        if (!existingEl) return;
        try {
          const newMarkup = this.lineRenderer.render(ov, anchorsRef, viewBox);
          if (!newMarkup) return;
          // Parse markup into element
          const temp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          temp.innerHTML = newMarkup.trim();
          const newEl = temp.firstElementChild;
          if (!newEl) return;
            existingEl.replaceWith(newEl);
          this.overlayElementCache.set(ov.id, newEl);
        } catch (e) {
          cblcarsLog.info('[AdvancedRenderer] Deferred line refresh failed', ov.id, e);
        }
      });
      cblcarsLog.debug('[AdvancedRenderer] Deferred line refresh pass complete');
    });
  }

  renderOverlay(overlay, anchors, viewBox) {
    if (!overlay || !overlay.type) {
      cblcarsLog.info('[AdvancedRenderer] Invalid overlay - missing type:', overlay);
      return '';
    }

    // Ensure SVG container is available before rendering
    const svgContainer = this.mountEl;
    const svg = svgContainer?.querySelector('svg');

    if (!svg) {
      cblcarsLog.info('[AdvancedRenderer] SVG element not found in container for overlay:', overlay.id);
    }

    // ADDED: Ensure SVG doesn't interfere with control events
    if (svg) {
      svg.style.pointerEvents = 'auto';
      svg.style.zIndex = '0'; // Keep SVG in background
    }

    switch (overlay.type) {
      case 'text':
        // DEBUG: Check what overlay object is being passed to TextOverlayRenderer
        if (overlay.id === 'title_overlay') {
          cblcarsLog.debug('[AdvancedRenderer] 🔍 Passing title_overlay to TextOverlayRenderer:', {
            id: overlay.id,
            color: overlay.style?.color,
            status_indicator: overlay.style?.status_indicator,
            finalStyleColor: overlay.finalStyle?.color,
            finalStyleStatusIndicator: overlay.finalStyle?.status_indicator
          });
        }

        // Update (in case dynamic overlays later): recompute & refresh map
        const ap = TextOverlayRenderer.computeAttachmentPoints(overlay, anchors, svgContainer);
        if (ap) this.textAttachmentPoints.set(overlay.id, ap);
        return TextOverlayRenderer.render(overlay, anchors, viewBox, svgContainer);
      case 'sparkline':
        return SparklineRenderer.render(overlay, anchors, viewBox);
      case 'line':
        // Lines need complete anchor set (static + virtual) for overlay-to-overlay connections
        const completeAnchors = this._getCompleteAnchors(anchors, overlay.type);
        return this.lineRenderer.render(overlay, completeAnchors, viewBox);
      case 'control':
        // ADDED: Control overlays are handled by MsdControlsRenderer, not SVG renderer
        cblcarsLog.debug('[AdvancedRenderer] Control overlay detected, skipping SVG rendering:', overlay.id);
        return ''; // Return empty string - controls are rendered separately by MsdControlsRenderer
      case 'status_grid':
        return StatusGridRenderer.render(overlay, anchors, viewBox, svgContainer);
      case 'history_bar':
        return HistoryBarRenderer.render(overlay, anchors, viewBox, svgContainer);
      default:
        cblcarsLog.warn(`[AdvancedRenderer] Unknown overlay type: ${overlay.type}`);
        return '';
    }
  }

    injectSvgContent(svgContent) {
    const svg = this.mountEl.querySelector('svg');
    if (!svg) {
      cblcarsLog.info('[AdvancedRenderer] No SVG element found for overlay injection');
      return;
    }

    let overlayGroup = svg.querySelector('#msd-overlay-container');
    if (!overlayGroup) {
      overlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      overlayGroup.setAttribute('id', 'msd-overlay-container');
      svg.appendChild(overlayGroup);
    } else {
      overlayGroup.innerHTML = '';
    }

    try {
      overlayGroup.innerHTML = svgContent;
      cblcarsLog.debug('[AdvancedRenderer] SVG content injected successfully');

      // Build element cache after injection
      this.overlayElementCache.clear();
      const overlayElements = overlayGroup.querySelectorAll('[data-overlay-id]');
      overlayElements.forEach(element => {
        const overlayId = element.getAttribute('data-overlay-id');
        if (overlayId) {
          this.overlayElementCache.set(overlayId, element);
          cblcarsLog.debug(`[AdvancedRenderer] Cached element for overlay: ${overlayId}`);
        }
      });

      // Verify injection
      const sparklines = overlayGroup.querySelectorAll('[data-overlay-type="sparkline"]');
      const lines = overlayGroup.querySelectorAll('[data-overlay-type="line"]');
      const texts = overlayGroup.querySelectorAll('[data-overlay-type="text"]');

      cblcarsLog.debug('[AdvancedRenderer] Injected elements:', {
        sparklines: sparklines.length,
        lines: lines.length,
        texts: texts.length,
        cached: this.overlayElementCache.size
      });

    } catch (error) {
      cblcarsLog.info('[AdvancedRenderer] Failed to inject SVG content:', error);
    }
  }

  // === DATA UPDATE METHODS ===

  /**
   * Update overlay data when data source changes
   * @param {string} overlayId - ID of the overlay to update
   * @param {Object} sourceData - Data from the data source
   */
  updateOverlayData(overlayId, sourceData) {
    cblcarsLog.debug('[AdvancedRenderer] updateOverlayData called:', {
      overlayId,
      hasSourceData: !!sourceData,
      sourceDataKeys: sourceData ? Object.keys(sourceData) : 'none',
      hasBuffer: !!(sourceData?.buffer),
      bufferSize: sourceData?.buffer?.size?.() || 0,
      hasCachedElement: this.overlayElementCache.has(overlayId)
    });

    if (!sourceData) {
      cblcarsLog.info('[AdvancedRenderer] updateOverlayData: Missing sourceData');
      return;
    }

    // Use cached element - no DOM searching needed with subscription system
    const overlayElement = this.overlayElementCache.get(overlayId);

    if (!overlayElement) {
      cblcarsLog.info(`[AdvancedRenderer] Could not find cached overlay element: ${overlayId}. Element should be cached during render.`);
      return;
    }

    const overlay = this.lastRenderArgs?.overlays?.find(o => o.id === overlayId);
    if (!overlay) {
      cblcarsLog.info(`[AdvancedRenderer] Could not find overlay config: ${overlayId}`);
      return;
    }

    // Delegate to type-specific renderer
    switch (overlay.type) {
      case 'sparkline':
        SparklineRenderer.updateSparklineData(overlayElement, overlay, sourceData);
        break;
      case 'text':
        cblcarsLog.debug(`[AdvancedRenderer] Updating text overlay: ${overlayId}`);
        // Use unified delegation pattern - delegate to TextOverlayRenderer
        const textUpdated = TextOverlayRenderer.updateTextData(overlayElement, overlay, sourceData);
        if (textUpdated) {
          // Update any status indicators that might depend on the content
          this.updateTextDecorations(overlayId, 'updated', overlay);
        }
        break;
      case 'status_grid':
        cblcarsLog.debug(`[AdvancedRenderer] Updating status grid overlay: ${overlayId}`);
        // Use unified delegation pattern - delegate to StatusGridRenderer
        StatusGridRenderer.updateGridData(overlayElement, overlay, sourceData);
        break;
      case 'history_bar':
        cblcarsLog.debug(`[AdvancedRenderer] Updating history_bar overlay: ${overlayId}`);
        const historyBarUpdated = HistoryBarRenderer.updateHistoryBarData(overlayElement, overlay, sourceData);
        if (historyBarUpdated) {
          // Update any status indicators that might depend on the content
          this.updateTextDecorations(overlayId, 'updated', overlay);
        }
        break;
      default:
        cblcarsLog.info(`[AdvancedRenderer] Update not implemented for overlay type: ${overlay.type}`);
    }
  }

  handleDataSourceUpdate(updateData) {
    if (!this.mountEl) return;

    // Find sparklines using cached elements instead of DOM search
    const cachedElements = Array.from(this.overlayElementCache.values());
    const sparklines = cachedElements.filter(el =>
      el.getAttribute('data-source') === updateData.sourceId
    );

    if (sparklines.length === 0) {
      cblcarsLog.debug(`[AdvancedRenderer] No cached sparklines found for source: ${updateData.sourceId}`);
      return;
    }

    sparklines.forEach(sparklineElement => {
      const overlay = this.lastRenderArgs.overlays?.find(o =>
        o.id === sparklineElement.getAttribute('data-overlay-id')
      );
      if (!overlay) return;

      // Use SparklineRenderer's update method
      SparklineRenderer.updateSparklineData(sparklineElement, overlay, updateData.data);
    });
  }

  /**
   * Get resolved model from various sources
   * @private
   * @returns {Object|null} Resolved model or null if not found
   */
  _getResolvedModel() {
    return this.systemsManager?.rulesEngine?.getResolvedModel?.() ||
           this.systemsManager?.getResolvedModel?.() ||
           window.__msdDebug?.pipelineInstance?.getResolvedModel?.() ||
           null;
  }

  /**
   * Clean up resources when renderer is destroyed
   */
  destroy() {
    // Clear all caches and references
    this.overlayElements.clear();
    this.overlayElementCache.clear();
    this.overlayAttachmentPoints.clear();
    this.textAttachmentPoints.clear();
    this._lineDeps.clear();

    // Clear stored references
    this.lastRenderArgs = null;
    this._dynamicAnchors = null;

    // Clean up renderer references
    if (this.lineRenderer) {
      this.lineRenderer.destroy?.();
      this.lineRenderer = null;
    }

    cblcarsLog.debug('[AdvancedRenderer] Cleanup completed');
  }

  _updateTextAttachmentPointsFromDom(overlay, groupEl, bb) {
    if (!overlay || !groupEl || !bb) return;
    const ap = {
      id: overlay.id,
      center: [bb.centerX, bb.centerY],
      bbox: {
        left: bb.left, right: bb.right, top: bb.top, bottom: bb.bottom,
        width: bb.width, height: bb.height
      },
      points: {
        center: [bb.centerX, bb.centerY],
        top: [bb.centerX, bb.top],
        bottom: [bb.centerX, bb.bottom],
        left: [bb.left, bb.centerY],
        right: [bb.right, bb.centerY],
        topLeft: [bb.left, bb.top],
        topRight: [bb.right, bb.top],
        bottomLeft: [bb.left, bb.bottom],
        bottomRight: [bb.right, bb.bottom]
      }
    };
    this.textAttachmentPoints.set(overlay.id, ap);
  }

  _rerenderDependentLines(changedSet, overlays, anchorsRef, viewBox) {
    if (!changedSet || !changedSet.size) return;
    const toRerender = new Set();
    changedSet.forEach(tid => {
      const dep = this._lineDeps.get(tid);
      if (dep) dep.forEach(id => toRerender.add(id));
    });
    if (!toRerender.size) return;
    requestAnimationFrame(() => {
      toRerender.forEach(lineId => {
        const overlay = overlays.find(o => o.id === lineId);
        if (!overlay) return;
        const existingEl = this.overlayElementCache.get(lineId);
        if (!existingEl) return;
        try {
          const newMarkup = this.lineRenderer.render(overlay, anchorsRef, viewBox);
          if (!newMarkup) return;
          const temp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          temp.innerHTML = newMarkup.trim();
          const newEl = temp.firstElementChild;
          if (!newEl) return;
          existingEl.replaceWith(newEl);
          this.overlayElementCache.set(lineId, newEl);
        } catch(e) {
          cblcarsLog.info('[AdvancedRenderer] Dep line re-render failed', lineId, e);
        }
      });
      cblcarsLog.debug('[AdvancedRenderer] Rerendered dependent lines after font stabilization', { count: toRerender.size });
    });
  }

  _reRenderSingleTextOverlay(overlay, anchorsRef, viewBox) {
    try {
      const oldGroup = this.overlayElementCache.get(overlay.id);
      if (!oldGroup) return null;
      const markup = TextOverlayRenderer.render(overlay, anchorsRef, viewBox, this.mountEl);
      if (!markup) return null;
      const temp = document.createElementNS('http://www.w3.org/2000/svg','g');
      temp.innerHTML = markup.trim();
      const newGroup = temp.firstElementChild;
      if (!newGroup) return null;
      oldGroup.replaceWith(newGroup);
      this.overlayElementCache.set(overlay.id, newGroup);
      // Update DOM-based attachment points immediately
      const bb = RendererUtils.getDomTextBBox(newGroup);
      if (bb) this._updateTextAttachmentPointsFromDom(overlay, newGroup, bb);
      return newGroup;
    } catch(e) {
      cblcarsLog.info('[AdvancedRenderer] Re-render text overlay failed', overlay.id, e);
      return null;
    }
  }

  _updateStatusIndicatorPosition(groupEl, textBBox) {
    try {
      if (!groupEl) return;
      const circle = groupEl.querySelector('circle[data-decoration="status-indicator"]');
      if (!circle) return;
      // Read required data
      const pos = circle.getAttribute('data-status-pos') || 'left-center';
      const fontSize = Number(groupEl.getAttribute('data-font-size') || 16);
      const indicatorSize = fontSize * 0.4;
      // Padding calculation (mirror TextOverlayRenderer)
      const transformInfo = RendererUtils._getSvgTransformInfo(this.mountEl);
      const pixelPadding = 8;
      const padding = transformInfo ? transformInfo.pixelToViewBox(pixelPadding) : indicatorSize;

      const bbox = textBBox; // has left/right/top/bottom/centerX/centerY
      let cx = bbox.centerX, cy = bbox.centerY;
      switch (pos) {
        case 'top-left':     cx = bbox.left - padding;  cy = bbox.top - padding; break;
        case 'top-right':    cx = bbox.right + padding; cy = bbox.top - padding; break;
        case 'bottom-left':  cx = bbox.left - padding;  cy = bbox.bottom + padding; break;
        case 'bottom-right': cx = bbox.right + padding; cy = bbox.bottom + padding; break;
        case 'top':          cx = bbox.centerX;         cy = bbox.top - padding; break;
        case 'bottom':       cx = bbox.centerX;         cy = bbox.bottom + padding; break;
        case 'left':
        case 'left-center':  cx = bbox.left - padding;  cy = bbox.centerY; break;
        case 'right':
        case 'right-center': cx = bbox.right + padding; cy = bbox.centerY; break;
        case 'center':       cx = bbox.centerX;         cy = bbox.centerY; break;
        default:             cx = bbox.left - padding;  cy = bbox.centerY;
      }
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', indicatorSize);
    } catch(_) {
      // silent
    }
  }

  /**
   * Update text decorations (status indicators, etc.) when content changes
   * @param {string} overlayId - ID of the text overlay
   * @param {string} newContent - New text content
   * @param {Object} overlay - Overlay configuration
   */
  updateTextDecorations(overlayId, newContent, overlay) {
    try {
      // Use cached overlay element instead of DOM query
      const overlayGroup = this.overlayElementCache.get(overlayId);
      if (!overlayGroup) {
        cblcarsLog.info(`[AdvancedRenderer] Cached overlay element not found for decorations: ${overlayId}`);
        return;
      }

      // Update status indicator position if needed (since text width may have changed)
      const statusIndicator = overlayGroup.querySelector('[data-decoration="status-indicator"]');
      if (statusIndicator && overlay.finalStyle?.status_indicator) {
        // Recalculate status indicator position
        // This could be enhanced to recalculate based on new text metrics
        cblcarsLog.debug(`[AdvancedRenderer] Status indicator position may need updating for ${overlayId}`);
      }
    } catch (error) {
      cblcarsLog.info(`[AdvancedRenderer] Error updating text decorations for ${overlayId}:`, error);
    }
  }

  /**
   * Update status grid cells with new data (legacy method - keeping for compatibility)
   * @deprecated Use StatusGridRenderer.updateGridData() instead
   * @param {string} overlayId - Status grid overlay ID
   * @param {Array} updatedCells - Updated cell configurations
   * @public
   */
  updateStatusGrid(overlayId, updatedCells) {
    cblcarsLog.debug(`[AdvancedRenderer] DEPRECATED: updateStatusGrid() called. Use StatusGridRenderer.updateGridData() instead.`);
    cblcarsLog.debug(`[AdvancedRenderer] Updating status grid ${overlayId} with ${updatedCells.length} cells`);

    // Use cached overlay element instead of DOM query
    const gridElement = this.overlayElementCache.get(overlayId);
    if (!gridElement) {
      cblcarsLog.info(`[AdvancedRenderer] Cached status grid element not found: ${overlayId}`);
      return;
    }

    // For now, log the update and add a simple visual indication
    cblcarsLog.debug(`[AdvancedRenderer] Status grid ${overlayId} cells updated:`, updatedCells);

    // Add visual indication that the grid was updated
    const timestamp = new Date().toISOString();
    gridElement.setAttribute('data-last-update', timestamp);

    cblcarsLog.debug(`[AdvancedRenderer] ✅ Status grid ${overlayId} update placeholder completed`);
  }

  /**
   * Enhanced status grid update method with template processing
   * @deprecated Use StatusGridRenderer.updateGridData() instead
   * @param {string} overlayId - Status grid overlay ID
   * @param {Object} sourceData - New DataSource data
   * @public
   */
  updateStatusGridWithTemplates(overlayId, sourceData) {
    cblcarsLog.debug(`[AdvancedRenderer] DEPRECATED: updateStatusGridWithTemplates() called. Use StatusGridRenderer.updateGridData() instead.`);

    // For compatibility, delegate to the new unified method
    const overlayElement = this.overlayElementCache.get(overlayId);
    if (!overlayElement) {
      cblcarsLog.info(`[AdvancedRenderer] Cached overlay element not found: ${overlayId}`);
      return;
    }

    const overlay = this.lastRenderArgs?.overlays?.find(o => o.id === overlayId);
    if (!overlay) {
      cblcarsLog.info(`[AdvancedRenderer] Could not find overlay config: ${overlayId}`);
      return;
    }

    // Delegate to the new unified method
    StatusGridRenderer.updateGridData(overlayElement, overlay, sourceData);
  }

  /**
   * Build virtual anchors from ALL overlay attachment points (not just attach_to targets)
   * This allows lines to use ANY overlay as an anchor point
   * @private
   */
  _buildVirtualAnchorsFromAllOverlays(overlays, anchorMap) {
    overlays.forEach(overlay => {
      if (overlay.type === 'line') return; // Lines don't create virtual anchors

      const attachmentPoints = this.overlayAttachmentPoints.get(overlay.id);
      if (!attachmentPoints || !attachmentPoints.points) return;

      // Create virtual anchors for each attachment point of this overlay
      Object.entries(attachmentPoints.points).forEach(([side, point]) => {
        const virtualAnchorId = `${overlay.id}.${side}`;
        anchorMap[virtualAnchorId] = point;
      });

      // Also create a default virtual anchor using the center point
      anchorMap[overlay.id] = attachmentPoints.center;

      cblcarsLog.debug(`[AdvancedRenderer] Created virtual anchors for overlay ${overlay.id}:`, {
        center: attachmentPoints.center,
        points: Object.keys(attachmentPoints.points).length
      });
    });
  }

  /**
   * Get complete anchor set for rendering (static + virtual)
   * @param {Object} staticAnchors - Original anchors from configuration
   * @param {string} overlayType - Type of overlay being rendered
   * @returns {Object} Complete anchor set
   * @private
   */
  _getCompleteAnchors(staticAnchors, overlayType) {
    // Line overlays need access to virtual anchors for overlay-to-overlay connections
    if (overlayType === 'line') {
      return { ...staticAnchors, ...this._dynamicAnchors };
    }
    return staticAnchors;
  }

  /**
   * Debug overlay property processing to identify where anchor_side/attach_side are lost
   * @private
   */
  _debugOverlayProcessing(overlayId, originalOverlay, processedOverlay) {
    if (originalOverlay.type === 'line') {
      cblcarsLog.debug(`[AdvancedRenderer] Overlay processing debug for line ${overlayId}:`, {
        original: {
          anchor_side: originalOverlay.anchor_side,
          attach_side: originalOverlay.attach_side,
          anchor_gap: originalOverlay.anchor_gap,
          attach_gap: originalOverlay.attach_gap
        },
        processed: {
          anchor_side: processedOverlay.anchor_side,
          attach_side: processedOverlay.attach_side,
          anchor_gap: processedOverlay.anchor_gap,
          attach_gap: processedOverlay.attach_gap
        },
        raw: {
          anchor_side: processedOverlay._raw?.anchor_side,
          attach_side: processedOverlay._raw?.attach_side,
          anchor_gap: processedOverlay._raw?.anchor_gap,
          attach_gap: processedOverlay._raw?.attach_gap
        }
      });
    }
  }
}