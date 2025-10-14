/**
 * [AdvancedRenderer] Advanced renderer - clean implementation for MSD v1
 * 🎨 Main orchestrator that delegates to specialized renderers
 */


import { RendererUtils } from './RendererUtils.js';
import { OverlayUtils } from './OverlayUtils.js';

import { LineOverlayRenderer } from './LineOverlayRenderer.js';
import { TextOverlayRenderer } from './TextOverlayRenderer.js';
import { SparklineOverlayRenderer } from './SparklineOverlayRenderer.js'; // RENAMED
import { StatusGridRenderer } from './StatusGridRenderer.js';
import { ButtonOverlayRenderer } from './ButtonOverlayRenderer.js';
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
    if (!resolvedModel) {
      cblcarsLog.warn('[AdvancedRenderer] ⚠️ No resolved model provided');
      return { svgMarkup: '', overlayCount: 0 };
    }
    const { overlays = [], anchors = {}, viewBox } = resolvedModel;

    cblcarsLog.debug(`[AdvancedRenderer] 🎨 Rendering ${overlays.length} overlays, ${Object.keys(anchors).length} anchors`);
    this.overlayElements.clear();
    // Phase rendering requires live SVG early
    const svg = this.mountEl?.querySelector('svg');
    if (!svg) {
      cblcarsLog.warn('[AdvancedRenderer] ❌ SVG element not found in container');
      return { svgMarkup: '', overlayCount: 0 };
    }

    // Prepare / clear overlay group
    const overlayGroup = this._ensureOverlayGroup(svg);
    overlayGroup.innerHTML = '';
    this.overlayElementCache.clear();

    // Precompute attachment points for all overlay types (after initial render)
    this.overlayAttachmentPoints.clear();
    this.textAttachmentPoints.clear(); // Keep for backward compatibility

    // CRITICAL FIX: Only compute attachment points if we have the resolved model with proper viewBox
    // Otherwise, defer until the model is available
    if (viewBox && Array.isArray(viewBox) && viewBox.length === 4) {
      overlays.forEach(ov => {
        const attachmentPoints = this.computeAttachmentPointsForType(ov, anchors, this.mountEl, viewBox);
        if (attachmentPoints) {
          this.overlayAttachmentPoints.set(ov.id, attachmentPoints);

          // BACKWARD COMPATIBILITY: Also populate textAttachmentPoints for text overlays
          if (ov.type === 'text') {
            this.textAttachmentPoints.set(ov.id, attachmentPoints);
          }
        }
      });
    } else {
      cblcarsLog.warn('[AdvancedRenderer] Invalid or missing viewBox - deferring attachment point computation:', viewBox);
      // We'll compute attachment points during the main render when viewBox is available
    }

    this.lineRenderer.setOverlayAttachmentPoints(this.overlayAttachmentPoints);

    // Phase 1: render overlays that others may depend on (text, sparkline)
    const earlyTypes = new Set(['text', 'sparkline']);
    let svgMarkupAccum = '';
    let processedCount = 0;

    // CHANGED: Collect action info during rendering
    const actionQueue = [];

    overlays.filter(o => earlyTypes.has(o.type)).forEach(ov => {
      try {
        const result = this.renderOverlay(ov, anchors, viewBox);

        cblcarsLog.debug(`[AdvancedRenderer] 📊 Phase 1 overlay ${ov.id} result:`, {
          resultType: typeof result,
          isObject: result && typeof result === 'object',
          hasMarkup: result?.markup,
          hasActionInfo: result?.actionInfo,
          overlayId: result?.overlayId
        });

        // CHANGED: Handle new return structure
        if (typeof result === 'string') {
          // Backward compatibility - old renderers return strings
          svgMarkupAccum += result;
        } else if (result && result.markup) {
          // New structure - extract markup and action info
          svgMarkupAccum += result.markup;

          if (result.actionInfo) {
            cblcarsLog.debug(`[AdvancedRenderer] 📝 Queuing action for ${result.overlayId}`);
            actionQueue.push({
              overlayId: result.overlayId,
              actionInfo: result.actionInfo
            });
          }
        }

        processedCount++;
      } catch (e) {
        cblcarsLog.warn(`[AdvancedRenderer] ⚠️ Phase1 render failed for overlay ${ov.id}:`, e);
      }
    });

    cblcarsLog.debug(`[AdvancedRenderer] 📋 Phase 1 action queue:`, {
      queueSize: actionQueue.length,
      overlayIds: actionQueue.map(a => a.overlayId)
    });

    // Inject Phase 1 DOM
    overlayGroup.innerHTML = svgMarkupAccum;

    // AT THIS POINT, DOM IS UPDATED - Elements exist in this.mountEl

    // ADDED: Attach actions immediately after DOM injection
    cblcarsLog.debug(`[AdvancedRenderer] 🎯 Attaching ${actionQueue.length} actions after Phase 1 DOM injection`);

    actionQueue.forEach(({ overlayId, actionInfo }) => {
      const element = this.mountEl.querySelector(`[data-overlay-id="${overlayId}"]`);

      cblcarsLog.debug(`[AdvancedRenderer] 🔍 Looking for element ${overlayId}:`, {
        found: !!element,
        alreadyAttached: element?.hasAttribute('data-actions-attached')
      });

      if (element) {
        try {
          ActionHelpers.attachActions(
            element,
            actionInfo.overlay,
            actionInfo.config,
            actionInfo.cardInstance
          );
          element.setAttribute('data-actions-attached', 'true');
          cblcarsLog.debug(`[AdvancedRenderer] ✅ Attached actions to ${overlayId}`);
        } catch (error) {
          cblcarsLog.error(`[AdvancedRenderer] ❌ Failed to attach actions to ${overlayId}:`, error);
        }
      } else {
        cblcarsLog.warn(`[AdvancedRenderer] ⚠️ Element not found for overlay ${overlayId}`);
      }
    });

    this._cacheElementsFrom(overlayGroup);

    // Build dynamic anchors (overlay destinations)
    this._dynamicAnchors = { ...anchors };
    this._buildDynamicOverlayAnchors(overlays, this._dynamicAnchors);

    // Build virtual anchors from ALL overlay attachment points for line anchoring
    this._buildVirtualAnchorsFromAllOverlays(overlays, this._dynamicAnchors);

    // Phase 2: render line overlays (now DOM for targets exists)
    overlays.filter(o => !earlyTypes.has(o.type)).forEach(ov => {
      try {
        const result = this.renderOverlay(ov, this._dynamicAnchors, viewBox);

        let markup = '';
        if (typeof result === 'string') {
          markup = result;
        } else if (result && result.markup) {
          markup = result.markup;

          // Collect Phase 2 actions
          if (result.actionInfo) {
            cblcarsLog.debug(`[AdvancedRenderer] 📝 Queuing Phase 2 action for ${result.overlayId}`);
            actionQueue.push({
              overlayId: result.overlayId,
              actionInfo: result.actionInfo
            });
          }
        }

        if (markup) {
          overlayGroup.insertAdjacentHTML('beforeend', markup);
          svgMarkupAccum += markup;
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
                cblcarsLog.debug('[AdvancedRenderer] 🔗 Route registration failed for overlay', ov.id, e);
              }
            }
          }
        }
        processedCount++;
      } catch (e) {
        cblcarsLog.warn(`[AdvancedRenderer] ⚠️ Phase2 render failed for overlay ${ov.id}:`, e);
      }
    });

    // ADDED: Attach Phase 2 actions (buttons, status grids, etc.)
    cblcarsLog.debug(`[AdvancedRenderer] 🎯 Attaching Phase 2 actions (queue size: ${actionQueue.length})`);

    actionQueue.forEach(({ overlayId, actionInfo }) => {
      const element = this.mountEl.querySelector(`[data-overlay-id="${overlayId}"]`);
      if (element && !element.hasAttribute('data-actions-attached')) {
        try {
          ActionHelpers.attachActions(
            element,
            actionInfo.overlay,
            actionInfo.config,
            actionInfo.cardInstance
          );
          element.setAttribute('data-actions-attached', 'true');
          cblcarsLog.debug(`[AdvancedRenderer] ✅ Attached actions to ${overlayId} (Phase 2)`);
        } catch (error) {
          cblcarsLog.error(`[AdvancedRenderer] ❌ Failed to attach actions to ${overlayId}:`, error);
        }
      }
    });

    cblcarsLog.debug('[AdvancedRenderer] Injected elements (after phased render):', {
      total: this.overlayElementCache.size,
      text: overlayGroup.querySelectorAll('[data-overlay-type="text"]').length,
      lines: overlayGroup.querySelectorAll('[data-overlay-type="line"]').length,
      sparklines: overlayGroup.querySelectorAll('[data-overlay-type="sparkline"]').length,
      status_grid: overlayGroup.querySelectorAll('[data-overlay-type="status_grid"]').length,
      history_bars: overlayGroup.querySelectorAll('[data-overlay-type="history_bar"]').length,
      controls: overlayGroup.querySelectorAll('[data-overlay-type="control"]').length
    });

    // NEW: schedule deferred line refresh to fix first-load orientation/position
    this._scheduleDeferredLineRefresh(overlays, this._dynamicAnchors, viewBox);

    // NEW: schedule font stabilization pass (re-measure after real fonts load)
    this._scheduleFontStabilization(overlays, this._dynamicAnchors, viewBox);

    // REMOVED: _scheduleActionProcessing() call - no longer needed

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
   * @param {Array} viewBox - ViewBox dimensions for proper scaling
   * @returns {Object|null} Attachment points object or null if not computable
   */
  computeAttachmentPointsForType(overlay, anchors, container, viewBox = null) {
    if (!overlay || !overlay.type || !overlay.id) {
      return null;
    }

    // Use provided viewBox or try to get from resolved model
    let effectiveViewBox = viewBox;
    if (!effectiveViewBox) {
      const resolvedModel = this._getResolvedModel();
      effectiveViewBox = resolvedModel?.viewBox || [0, 0, 400, 200];
    }

    try {
      switch (overlay.type) {
        case 'text':
          return this._computeTextAttachmentPoints(overlay, anchors, container, effectiveViewBox);
        case 'sparkline':
          return this._computeSparklineAttachmentPoints(overlay, anchors, container, effectiveViewBox);
        case 'history_bar':
          return this._computeHistoryBarAttachmentPoints(overlay, anchors, container, effectiveViewBox);
        case 'status_grid':
          return this._computeStatusGridAttachmentPoints(overlay, anchors, container, effectiveViewBox);
        case 'control':
          return this._computeControlAttachmentPoints(overlay, anchors, container, effectiveViewBox);
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
  }  // Individual attachment point computation methods for each overlay type

  _computeTextAttachmentPoints(overlay, anchors, container, viewBox) {
    // Use existing TextOverlayRenderer method with viewBox
    return TextOverlayRenderer.computeAttachmentPoints(overlay, anchors, container, viewBox);
  }

  _computeSparklineAttachmentPoints(overlay, anchors, container, viewBox) {
    return SparklineOverlayRenderer.computeAttachmentPoints(overlay, anchors, container);
  }

  _computeHistoryBarAttachmentPoints(overlay, anchors, container, viewBox) {
    return HistoryBarRenderer.computeAttachmentPoints(overlay, anchors, container);
  }

  _computeStatusGridAttachmentPoints(overlay, anchors, container, viewBox) {
    return StatusGridRenderer.computeAttachmentPoints(overlay, anchors, container);
  }

  _computeControlAttachmentPoints(overlay, anchors, container, viewBox) {
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
    const attachmentPoints = OverlayUtils.computeAttachmentPoints(overlay, anchors);

    if (!attachmentPoints) {
      cblcarsLog.debug(`[AdvancedRenderer] Cannot compute attachment points for ${type} ${overlay.id}: missing position or size`);
      return null;
    }

    // Add aliases for common naming conventions
    attachmentPoints.points['top-left'] = attachmentPoints.points.topLeft;
    attachmentPoints.points['top-right'] = attachmentPoints.points.topRight;
    attachmentPoints.points['bottom-left'] = attachmentPoints.points.bottomLeft;
    attachmentPoints.points['bottom-right'] = attachmentPoints.points.bottomRight;

    cblcarsLog.debug(`[AdvancedRenderer] 🔗 Created attachment points for ${type} ${overlay.id}`);

    return attachmentPoints;
  }  _ensureOverlayGroup(svg) {
    let group = svg.querySelector('#msd-overlay-container');
    if (!group) {
      group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('id', 'msd-overlay-container');
      // CRITICAL: Use 'all' to ensure ALL events can reach child elements
      group.style.pointerEvents = 'all';
      svg.appendChild(group);
    } else {
      // CRITICAL: Ensure existing container also has proper pointer events
      group.style.pointerEvents = 'all';
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
    let globalStabilizationNeeded = true; // Track if we need comprehensive updates

    const run = () => {
      const changedTargets = new Set();
      let anyUnstable = false;
      let anyFontChanges = false;

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

              // ARCHITECTURAL FIX: Update attachment points after font stabilization
              this._updateTextAttachmentPointsAfterStabilization(ov, newGroup, bb2, viewBox);
            }
            changedTargets.add(ov.id);
            anyUnstable = true;
            anyFontChanges = true;
          }
        } else {
          if (diffW > 0 || diffH > 0) {
            group.setAttribute('data-text-width', String(bb.width));
            group.setAttribute('data-text-height', String(bb.height));
            changedTargets.add(ov.id);
            anyFontChanges = true;
          }
          if (group.getAttribute('data-font-stabilized') !== '1') {
            group.setAttribute('data-font-stabilized','1');
            anyFontChanges = true;
          }
          this._updateTextAttachmentPointsFromDom(ov, group, bb);
          // NEW: also update attachment points after stabilization (even without re-render)
          this._updateTextAttachmentPointsAfterStabilization(ov, group, bb, viewBox);
          // NEW: always update status indicator position even without re-render
          this._updateStatusIndicatorPosition(group, bb);
        }
      });

      // CRITICAL: Update line renderer with new attachment points
      this.lineRenderer.setOverlayAttachmentPoints(this.overlayAttachmentPoints);

      // ENHANCED: Force comprehensive update after font stabilization
      if (anyFontChanges || changedTargets.size) {
        // Update dynamic anchors for changed text overlays
        this._updateDynamicAnchorsForOverlays(changedTargets, overlays, this._dynamicAnchors);

        // Re-render ALL dependent lines, not just immediate dependencies
        this._rerenderAllDependentOverlays(overlays, this._dynamicAnchors, viewBox);

        // CRITICAL: Also update virtual anchors since attachment points changed
        this._rebuildVirtualAnchorsFromChangedOverlays(changedTargets, overlays, this._dynamicAnchors);
      }

      pass++;
      const morePassesAllowed = pass < (MAX_PASSES + EXTRA_PASSES);
      if ((changedTargets.size || anyUnstable) && morePassesAllowed) {
        requestAnimationFrame(run);
      } else {
        // FINAL COMPREHENSIVE UPDATE: Force one last update to catch any remaining issues
        if (globalStabilizationNeeded) {
          globalStabilizationNeeded = false;
          this._performFinalStabilizationUpdate(overlays, this._dynamicAnchors, viewBox);
        }

        cblcarsLog.debug('[AdvancedRenderer] Font stabilization complete', {
          passes: pass,
          changed: Array.from(changedTargets),
          hadFontChanges: anyFontChanges
        });

        // Final safety delayed pass in case font finished loading just after loop
        setTimeout(() => {
          const remaining = overlays.filter(o=>o.type==='text')
            .some(o => {
              const g = this.overlayElementCache.get(o.id);
              return g && g.getAttribute('data-font-stabilized') !== '1';
            });
          if (remaining) {
            cblcarsLog.debug('[AdvancedRenderer] 🔤 Running safety stabilization pass');
            pass = 0;
            globalStabilizationNeeded = true;
            requestAnimationFrame(run);
          }
        }, 180);
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

  /**
   * Render individual overlay using appropriate renderer
   * @private
   */
  renderOverlay(overlay, anchors, viewBox, svgContainer) {
    try {
      cblcarsLog.debug(`[AdvancedRenderer] 🎨 Rendering overlay: ${overlay.type} (${overlay.id})`);

      switch (overlay.type) {
        case 'text':
          // Update (in case dynamic overlays later): recompute & refresh map
          const ap = TextOverlayRenderer.computeAttachmentPoints(overlay, anchors, svgContainer);
          if (ap) this.textAttachmentPoints.set(overlay.id, ap);

          // Get card instance for action support
          const textCardInstance = this.systemsManager ? StatusGridRenderer._resolveCardInstance() : null;

          cblcarsLog.debug(`[AdvancedRenderer] 🔤 Calling TextOverlayRenderer.render for ${overlay.id}`, {
            hasCardInstance: !!textCardInstance,
            hasActions: !!(overlay.tap_action || overlay.hold_action || overlay.double_tap_action)
          });

          // CHANGED: Now returns { markup, actionInfo, overlayId }
          const textResult = TextOverlayRenderer.render(overlay, anchors, viewBox, this.mountEl, textCardInstance);

          cblcarsLog.debug(`[AdvancedRenderer] 🔤 TextOverlayRenderer.render result:`, {
            hasMarkup: !!textResult?.markup,
            hasActionInfo: !!textResult?.actionInfo,
            overlayId: textResult?.overlayId
          });

          // Return the result structure (backward compatible with string check in render())
          return textResult;

        case 'sparkline':
          return SparklineOverlayRenderer.render(overlay, anchors, viewBox);
        case 'line':
          // Lines need complete anchor set (static + virtual) for overlay-to-overlay connections
          const completeAnchors = this._getCompleteAnchors(anchors, overlay.type);
          return this.lineRenderer.render(overlay, completeAnchors, viewBox);
        case 'control':
          // ADDED: Control overlays are handled by MsdControlsRenderer, not SVG renderer
          cblcarsLog.debug('[AdvancedRenderer] 🎮 Control overlay detected, skipping SVG rendering:', overlay.id);
          return ''; // Return empty string - controls are rendered separately by MsdControlsRenderer
        case 'status_grid':
          return StatusGridRenderer.render(overlay, anchors, viewBox, svgContainer);
        case 'button':
          return ButtonOverlayRenderer.render(overlay, anchors, viewBox, svgContainer);
        case 'history_bar':
          return HistoryBarRenderer.render(overlay, anchors, viewBox, svgContainer);
        default:
          cblcarsLog.warn(`[AdvancedRenderer] ⚠️ Unknown overlay type: ${overlay.type}`);
          return '';
      }
    } catch (error) {
      cblcarsLog.error(`[AdvancedRenderer] ❌ Error rendering overlay ${overlay.id}:`, error);
      return this.renderFallbackOverlay(overlay);
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
        SparklineOverlayRenderer.updateSparklineData(overlayElement, overlay, sourceData);
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
        // FIXED: Use the correct static method name
        const gridUpdated = StatusGridRenderer.updateGridData(overlayElement, overlay, sourceData);
        if (gridUpdated) {
          // Update any status indicators that might depend on the content
          this.updateTextDecorations(overlayId, 'updated', overlay);
        }
        return gridUpdated;
      case 'history_bar':
        cblcarsLog.debug(`[AdvancedRenderer] Updating history_bar overlay: ${overlayId}`);
        const historyBarUpdated = HistoryBarRenderer.updateHistoryBarData(overlayElement, overlay, sourceData);
        if (historyBarUpdated) {
          // Update any status indicators that might depend on the content
          this.updateTextDecorations(overlayId, 'updated', overlay);
        }
        break;
      case 'button':
        cblcarsLog.debug(`[AdvancedRenderer] Updating button overlay: ${overlayId}`);
        const updated = ButtonOverlayRenderer.updateButtonData(overlayElement, overlay, sourceData);
        if (updated) {
          // Handle any post-update logic if needed
          cblcarsLog.debug(`[AdvancedRenderer] ✅ Button overlay ${overlayId} updated successfully`);
        }
        return updated;
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

      SparklineOverlayRenderer.updateSparklineData(sparklineElement, overlay, updateData.data);
    });
  }

  /**
   * Get resolved model from various sources
   * @private
   * @returns {Object|null} Resolved model or null if not found
   */
  _getResolvedModel() {
    return this.systemsManager?.rulesEngine?.getResolvedModel?.() ||
           this.systemManager?.rulesEngine?.getResolvedModel?.() ||
           this.routerCore?.getResolvedModel?.() ||
           null;
  }

  /**
   * Re-render all overlays dependent on a given set of source overlays
   * @param {Array} allOverlays - Complete list of overlays
   * @param {Set} sourceOverlayIds - Set of source overlay IDs that changed
   * @param {Array} viewBox - Current viewBox for rendering
   */
  _rerenderAllDependentOverlays(allOverlays, sourceOverlayIds, viewBox) {
    const visited = new Set();
    const queue = Array.from(sourceOverlayIds);

    while (queue.length) {
      const overlayId = queue.shift();
      if (visited.has(overlayId)) continue;
      visited.add(overlayId);

      const overlay = allOverlays.find(o => o.id === overlayId);
      if (!overlay) continue;

      // Re-render the overlay
      try {
        this.renderOverlay(overlay, this._dynamicAnchors, viewBox);
        cblcarsLog.debug(`[AdvancedRenderer] Re-rendered dependent overlay: ${overlayId}`);
      } catch (e) {
        cblcarsLog.warn(`[AdvancedRenderer] ⚠️ Re-render failed for overlay ${overlayId}:`, e);
      }

      // Queue up dependencies for re-rendering
      const deps = this._lineDeps.get(overlayId);
      if (deps) {
        deps.forEach(depId => {
          if (!visited.has(depId)) {
            queue.push(depId);
          }
        });
      }
    }
  }

  /**
   * Rebuild virtual anchors from changed overlays (after font stabilization)
   * @param {Set} changedOverlayIds - Set of overlay IDs that have changed
   * @param {Array} allOverlays - Complete list of overlays
   * @param {Object} anchorsMap - Current map of dynamic anchors
   */
  _rebuildVirtualAnchorsFromChangedOverlays(changedOverlayIds, allOverlays, anchorsMap) {
    changedOverlayIds.forEach(id => {
      const overlay = allOverlays.find(o => o.id === id);
      if (!overlay) return;
      const raw = overlay._raw || overlay.raw || {};
      const dest = raw.attach_to || raw.attachTo;
      if (!dest) return;

      // Use unified attachment points (includes all overlay types)
      const attachmentPointData = this.overlayAttachmentPoints.get(dest);
      if (!attachmentPointData || !attachmentPointData.points) return;
      const side = (raw.attach_side || raw.attachSide || '').toLowerCase();
      const basePt = this._resolveOverlayAttachmentPoint(attachmentPointData.points, side);
      if (!basePt) return;
      const gapPt = this._applyAttachGap(basePt, side, raw, attachmentPointData.bbox);
      anchorsMap[dest] = gapPt;
    });
  }

  /**
   * Perform final stabilization update (comprehensive pass)
   * @param {Array} allOverlays - Complete list of overlays
   * @param {Object} anchorsRef - Current reference for anchors
   * @param {Array} viewBox - Current viewBox for rendering
   */
  _performFinalStabilizationUpdate(allOverlays, anchorsRef, viewBox) {
    // Final pass: re-measure all text overlays and update dependent lines
    allOverlays.filter(o => o.type === 'text').forEach(ov => {
      const group = this.overlayElementCache.get(ov.id);
      if (!group) return;
      const bb = RendererUtils.getDomTextBBox(group);
      if (!bb) return;

      group.setAttribute('data-text-width', String(bb.width));
      group.setAttribute('data-text-height', String(bb.height));

      // Update attachment points and status indicators
      this._updateTextAttachmentPointsFromDom(ov, group, bb);
      this._updateStatusIndicatorPosition(group, bb);
    });

    // CRITICAL: Update line renderer with final attachment points
    this.lineRenderer.setOverlayAttachmentPoints(this.overlayAttachmentPoints);

    // Re-render all overlays to apply final updates
    this._rerenderAllDependentOverlays(allOverlays, Object.keys(this._lineDeps), viewBox);
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

      cblcarsLog.debug(`[AdvancedRenderer] 🔗 Created virtual anchors for overlay ${overlay.id}`);
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

  /**
   * Render fallback overlay for error cases
   * @private
   */
  renderFallbackOverlay(overlay) {
    const position = overlay.position || [50, 50];
    const size = overlay.size || [100, 40];
    const [x, y] = position;
    const [width, height] = size;
    const color = 'var(--lcars-gray)';

    cblcarsLog.warn(`[AdvancedRenderer] ⚠️ Using fallback rendering for overlay ${overlay.id}`);

    return `<g data-overlay-id="${overlay.id}" data-overlay-type="${overlay.type}" data-fallback="true">
              <g transform="translate(${x}, ${y})">
                <rect width="${width}" height="${height}"
                      fill="none" stroke="${color}" stroke-width="2" rx="4"/>
                <text x="${width / 2}" y="${height / 2}" text-anchor="middle"
                      fill="${color}" font-size="12" dominant-baseline="middle"
                      font-family="var(--lcars-font-family, Antonio)">
                  ${overlay.type} Error
                </text>
              </g>
            </g>`;
  }
}