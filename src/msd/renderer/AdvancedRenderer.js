/**
 * Advanced Renderer - Clean implementation for MSD v1
 * Main orchestrator that delegates to specialized renderers
 */

import { TextOverlayRenderer } from './TextOverlayRenderer.js';
import { SparklineRenderer } from './SparklineRenderer.js';
import { LineOverlayRenderer } from './LineOverlayRenderer.js';
import { StatusGridRenderer } from './StatusGridRenderer.js';
import { RendererUtils } from './RendererUtils.js';

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
    this.textAttachmentPoints = new Map();
    this._lineDeps = new Map(); // targetOverlayId -> Set(lineOverlayId)
  }

  render(resolvedModel) {

    console.log('[MSD DEBUG] 🎨 AdvancedRenderer.render() ENTRY:', {
      timestamp: new Date().toISOString(),
      hasResolvedModel: !!resolvedModel,
      overlayCount: resolvedModel?.overlays?.length || 0,
      anchorCount: resolvedModel?.anchors ? Object.keys(resolvedModel.anchors).length : 0,
      hasViewBox: !!resolvedModel?.viewBox,
      mountElExists: !!this.mountEl,
      stackTrace: new Error().stack.split('\n').slice(1, 3).join('\n')
    });

    if (!resolvedModel) {
      console.error('[MSD DEBUG] ❌ AdvancedRenderer.render() - No resolved model provided');
      return { svgMarkup: '', overlayCount: 0 };
    }
    const { overlays = [], anchors = {}, viewBox } = resolvedModel;
    console.log(`[MSD DEBUG] 🎨 AdvancedRenderer processing:`, {
      overlayCount: overlays.length,
      overlayTypes: overlays.map(o => o.type),
      anchorCount: Object.keys(anchors).length,
      viewBox
    });
    this.overlayElements.clear();
    // Phase rendering requires live SVG early
    const svg = this.mountEl?.querySelector('svg');
    if (!svg) {
      console.error('[MSD DEBUG] ❌ AdvancedRenderer.render() - SVG element not found in container:', {
        mountEl: this.mountEl,
        mountElTagName: this.mountEl?.tagName,
        mountElChildren: this.mountEl?.children?.length || 0
      });
      return { svgMarkup: '', overlayCount: 0 };
    }

    console.log('[MSD DEBUG] ✅ SVG element found, proceeding with overlay rendering');

    // Prepare / clear overlay group
    const overlayGroup = this._ensureOverlayGroup(svg);
    overlayGroup.innerHTML = '';
    this.overlayElementCache.clear();

    // Precompute text attachment points (unchanged)
    this.textAttachmentPoints.clear();
    overlays.filter(o => o.type === 'text').forEach(tov => {
      const ap = TextOverlayRenderer.computeAttachmentPoints(tov, anchors, this.mountEl);
      if (ap) this.textAttachmentPoints.set(tov.id, ap);
    });
    this.lineRenderer.setTextAttachmentPoints(this.textAttachmentPoints);

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
        console.warn('[AdvancedRenderer] Phase1 failed for', ov.id, e);
      }
    });
    overlayGroup.innerHTML = svgMarkupAccum;
    this._cacheElementsFrom(overlayGroup);

    // Build dynamic anchors (overlay destinations)
    this._dynamicAnchors = { ...anchors };
    this._buildDynamicOverlayAnchors(overlays, this._dynamicAnchors);

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
                console.warn('[AdvancedRenderer] Overlay-destination route registration failed', ov.id, e);
              }
            }
          }
        }
        processedCount++;
      } catch (e) {
        console.warn('[AdvancedRenderer] Phase2 failed for', ov.id, e);
      }
    });

    console.log('[AdvancedRenderer] Injected elements (after phased render):', {
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

  _ensureOverlayGroup(svg) {
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
      const tap = this.textAttachmentPoints.get(dest);
      if (!tap || !tap.points) return;
      const side = (raw.attach_side || raw.attachSide || '').toLowerCase();
      const basePt = this._resolveOverlayAttachmentPoint(tap.points, side);
      if (!basePt) return;
      const gapPt = this._applyAttachGap(basePt, side, raw, tap.bbox);
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
          console.warn('[AdvancedRenderer] Route registration (initial) failed', line.id, e);
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
            console.warn('[AdvancedRenderer] Route registration (update) failed', line.id, e);
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

      this.lineRenderer.setTextAttachmentPoints(this.textAttachmentPoints);

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
            console.log('[AdvancedRenderer] Running safety stabilization pass');
            pass = 0;
            requestAnimationFrame(run);
          }
        }, 180);
        console.log('[AdvancedRenderer] Font stabilization complete', { passes: pass, changed: Array.from(changedTargets) });
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
          console.warn('[AdvancedRenderer] Deferred line refresh failed', ov.id, e);
        }
      });
      console.log('[AdvancedRenderer] Deferred line refresh pass complete');
    });
  }

  renderOverlay(overlay, anchors, viewBox) {
    if (!overlay || !overlay.type) {
      console.warn('[AdvancedRenderer] Invalid overlay - missing type:', overlay);
      return '';
    }

    // Ensure SVG container is available before rendering
    const svgContainer = this.mountEl;
    const svg = svgContainer?.querySelector('svg');

    if (!svg) {
      console.warn('[AdvancedRenderer] SVG element not found in container for overlay:', overlay.id);
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
          console.log('[AdvancedRenderer] 🔍 Passing title_overlay to TextOverlayRenderer:', {
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
        return this.lineRenderer.render(overlay, anchors, viewBox);
      case 'control':
        // ADDED: Control overlays are handled by MsdControlsRenderer, not SVG renderer
        console.log('[AdvancedRenderer] Control overlay detected, skipping SVG rendering:', overlay.id);
        return ''; // Return empty string - controls are rendered separately by MsdControlsRenderer
      case 'status_grid':
        return StatusGridRenderer.render(overlay, anchors, viewBox);
      default:
        console.warn(`[AdvancedRenderer] Unknown overlay type: ${overlay.type}`);
        return '';
    }
  }

    injectSvgContent(svgContent) {
    const svg = this.mountEl.querySelector('svg');
    if (!svg) {
      console.warn('[AdvancedRenderer] No SVG element found for overlay injection');
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
      console.log('[AdvancedRenderer] SVG content injected successfully');

      // Build element cache after injection
      this.overlayElementCache.clear();
      const overlayElements = overlayGroup.querySelectorAll('[data-overlay-id]');
      overlayElements.forEach(element => {
        const overlayId = element.getAttribute('data-overlay-id');
        if (overlayId) {
          this.overlayElementCache.set(overlayId, element);
          console.log(`[AdvancedRenderer] Cached element for overlay: ${overlayId}`);
        }
      });

      // Verify injection
      const sparklines = overlayGroup.querySelectorAll('[data-overlay-type="sparkline"]');
      const lines = overlayGroup.querySelectorAll('[data-overlay-type="line"]');
      const texts = overlayGroup.querySelectorAll('[data-overlay-type="text"]');

      console.log('[AdvancedRenderer] Injected elements:', {
        sparklines: sparklines.length,
        lines: lines.length,
        texts: texts.length,
        cached: this.overlayElementCache.size
      });

    } catch (error) {
      console.error('[AdvancedRenderer] Failed to inject SVG content:', error);
    }
  }

  // === DATA UPDATE METHODS ===

  /**
   * Update overlay data when data source changes
   * @param {string} overlayId - ID of the overlay to update
   * @param {Object} sourceData - Data from the data source
   */
  updateOverlayData(overlayId, sourceData) {
    console.log('[AdvancedRenderer] updateOverlayData called:', {
      overlayId,
      hasSourceData: !!sourceData,
      sourceDataKeys: sourceData ? Object.keys(sourceData) : 'none',
      hasBuffer: !!(sourceData?.buffer),
      bufferSize: sourceData?.buffer?.size?.() || 0,
      hasCachedElement: this.overlayElementCache.has(overlayId)
    });

    if (!sourceData) {
      console.warn('[AdvancedRenderer] updateOverlayData: Missing sourceData');
      return;
    }

    // Use cached element - no DOM searching needed with subscription system
    const overlayElement = this.overlayElementCache.get(overlayId);

    if (!overlayElement) {
      console.warn(`[AdvancedRenderer] Could not find cached overlay element: ${overlayId}. Element should be cached during render.`);
      return;
    }

    const overlay = this.lastRenderArgs?.overlays?.find(o => o.id === overlayId);
    if (!overlay) {
      console.warn(`[AdvancedRenderer] Could not find overlay config: ${overlayId}`);
      return;
    }

    // Delegate to type-specific renderer
    switch (overlay.type) {
      case 'sparkline':
        SparklineRenderer.updateSparklineData(overlayElement, overlay, sourceData);
        break;
      case 'text':
        console.log(`[AdvancedRenderer] Updating text overlay: ${overlayId}`);
        this.updateTextOverlay(overlayId, sourceData);
        break;
      case 'status_grid':
        console.log(`[AdvancedRenderer] Updating status grid overlay: ${overlayId}`);
        this.updateStatusGridWithTemplates(overlayId, sourceData);
        break;
      default:
        console.warn(`[AdvancedRenderer] Update not implemented for overlay type: ${overlay.type}`);
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
      console.log(`[AdvancedRenderer] No cached sparklines found for source: ${updateData.sourceId}`);
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
   * Clean up resources when renderer is destroyed
   */
  destroy() {
    this.overlayElements.clear();
    this.overlayElementCache.clear();
    this.lastRenderArgs = null;
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
          console.warn('[AdvancedRenderer] Dep line re-render failed', lineId, e);
        }
      });
      console.log('[AdvancedRenderer] Rerendered dependent lines after font stabilization', { count: toRerender.size });
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
      console.warn('[AdvancedRenderer] Re-render text overlay failed', overlay.id, e);
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
   * Update text overlay content dynamically without full re-render
   * @param {string} overlayId - ID of the text overlay to update
   * @param {Object} sourceData - New DataSource data
   */
  updateTextOverlay(overlayId, sourceData) {
    try {
      // Find the text element in the DOM
      const textElement = this.mountEl.querySelector(`[data-overlay-id="${overlayId}"] text`);
      if (!textElement) {
        console.warn(`[AdvancedRenderer] Text element not found for overlay: ${overlayId}`);
        return;
      }

      // Get the overlay configuration to resolve new content
      const resolvedModel = this.systemsManager?.rulesEngine?.getResolvedModel?.() ||
                           this.systemsManager?.getResolvedModel?.() ||
                           window.__msdDebug?.pipelineInstance?.getResolvedModel?.();

      const overlay = resolvedModel?.overlays?.find(o => o.id === overlayId);
      if (!overlay) {
        console.warn(`[AdvancedRenderer] Overlay configuration not found: ${overlayId}`);
        return;
      }

      // Import the TextOverlayRenderer for content resolution
      import('./TextOverlayRenderer.js').then(({ TextOverlayRenderer }) => {
        const renderer = new TextOverlayRenderer();

        // Resolve new text content using the same logic as initial rendering
        const newContent = renderer._resolveTextContent(overlay, overlay.finalStyle || {});

        if (newContent && newContent !== textElement.textContent) {
          console.log(`[AdvancedRenderer] Updating text overlay ${overlayId}: "${textElement.textContent}" → "${newContent}"`);

          // Update the text content
          textElement.textContent = TextOverlayRenderer.escapeXml(newContent);

          // Update any status indicators that might depend on the content
          this.updateTextDecorations(overlayId, newContent, overlay);

          console.log(`[AdvancedRenderer] ✅ Text overlay ${overlayId} updated successfully`);
        } else {
          console.log(`[AdvancedRenderer] Text overlay ${overlayId} content unchanged`);
        }
      }).catch(error => {
        console.error(`[AdvancedRenderer] Failed to update text overlay ${overlayId}:`, error);
      });

    } catch (error) {
      console.error(`[AdvancedRenderer] Error updating text overlay ${overlayId}:`, error);
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
      // Update status indicator position if needed (since text width may have changed)
      const statusIndicator = this.mountEl.querySelector(`[data-overlay-id="${overlayId}"] [data-decoration="status-indicator"]`);
      if (statusIndicator && overlay.finalStyle?.status_indicator) {
        // Recalculate status indicator position
        // This could be enhanced to recalculate based on new text metrics
        console.log(`[AdvancedRenderer] Status indicator position may need updating for ${overlayId}`);
      }
    } catch (error) {
      console.error(`[AdvancedRenderer] Error updating text decorations for ${overlayId}:`, error);
    }
  }

  /**
   * Update status grid cells with new data (similar to updateTextOverlay)
   * @param {string} overlayId - Status grid overlay ID
   * @param {Array} updatedCells - Updated cell configurations
   * @public
   */
  updateStatusGrid(overlayId, updatedCells) {
    console.log(`[AdvancedRenderer] Updating status grid ${overlayId} with ${updatedCells.length} cells`);

    // Find the status grid element in the DOM
    const gridElement = this.mountEl?.querySelector(`[data-overlay-id="${overlayId}"]`);
    if (!gridElement) {
      console.warn(`[AdvancedRenderer] Status grid element not found: ${overlayId}`);
      return;
    }

    // For now, log the update and add a simple visual indication
    console.log(`[AdvancedRenderer] Status grid ${overlayId} cells updated:`, updatedCells);

    // Add visual indication that the grid was updated
    const timestamp = new Date().toISOString();
    gridElement.setAttribute('data-last-update', timestamp);

    // Future: Implement proper cell-by-cell updates
    // This would involve updating individual cell elements within the grid
    // For now, we'll trigger a re-render of the entire overlay if needed

    console.log(`[AdvancedRenderer] ✅ Status grid ${overlayId} update placeholder completed`);
  }

  /**
   * Enhanced status grid update method with template processing
   * @param {string} overlayId - Status grid overlay ID
   * @param {Object} sourceData - New DataSource data
   * @public
   */
  updateStatusGridWithTemplates(overlayId, sourceData) {
    console.log(`[AdvancedRenderer] Updating status grid ${overlayId} with DataSource data`);

    try {
      // Get the overlay configuration to resolve new content
      const resolvedModel = this.systemsManager?.rulesEngine?.getResolvedModel?.() ||
                           this.systemsManager?.getResolvedModel?.() ||
                           window.__msdDebug?.pipelineInstance?.getResolvedModel?.();

      const overlay = resolvedModel?.overlays?.find(o => o.id === overlayId);
      if (!overlay) {
        console.warn(`[AdvancedRenderer] Status grid overlay configuration not found: ${overlayId}`);
        return;
      }

      // Import the StatusGridRenderer for content resolution
      import('./StatusGridRenderer.js').then(({ StatusGridRenderer }) => {
        const renderer = new StatusGridRenderer();

        // Get updated cells with processed template content
        const style = overlay.finalStyle || overlay.style || {};
        const updatedCells = renderer.updateCellsWithData(overlay, style, sourceData);

        console.log(`[AdvancedRenderer] Processing ${updatedCells.length} updated cells for grid ${overlayId}`);

        // Update each cell's content in the DOM
        updatedCells.forEach(cell => {
          const cellContentElement = this.mountEl?.querySelector(`[data-cell-content="${cell.id}"]`);

          if (cellContentElement && cell.content !== undefined) {
            const oldContent = cellContentElement.textContent?.trim();
            let newContent = cell.content;

            // Handle [object Object] issue - ensure content is always a string
            if (typeof newContent === 'object') {
              console.warn(`[AdvancedRenderer] Cell ${cell.id} has object content, converting to string`);
              newContent = newContent !== null ? String(newContent) : 'N/A';
            }

            // Ensure newContent is a string
            newContent = String(newContent);

            if (newContent !== oldContent) {
              console.log(`[AdvancedRenderer] Updating cell ${cell.id}: "${oldContent}" → "${newContent}"`);
              cellContentElement.textContent = newContent;
            }
          }
        });

        console.log(`[AdvancedRenderer] ✅ Status grid ${overlayId} updated successfully`);

      }).catch(error => {
        console.error(`[AdvancedRenderer] Failed to update status grid ${overlayId}:`, error);
      });

    } catch (error) {
      console.error(`[AdvancedRenderer] Error updating status grid ${overlayId}:`, error);
    }
  }

  /**
   * Enhanced template detection that supports multiple overlay types
   * @param {Object} overlay - Overlay configuration
   * @returns {boolean} True if overlay contains template content
   * @private
   */
  _hasTemplateContentEnhanced(overlay) {
    if (!overlay) return false;

    // Handle different overlay types
    switch (overlay.type) {
      case 'text':
        // Text overlays: check content property
        const textContent = overlay.content || overlay._raw?.content || overlay.raw?.content;
        return textContent && typeof textContent === 'string' && textContent.includes('{');

      case 'status_grid':
        // Status grids: check cells for template content
        const cellsConfig = overlay.cells || overlay._raw?.cells || overlay.raw?.cells;
        if (cellsConfig && Array.isArray(cellsConfig)) {
          return cellsConfig.some(cell =>
            (cell.content && typeof cell.content === 'string' && cell.content.includes('{')) ||
            (cell.label && typeof cell.label === 'string' && cell.label.includes('{'))
          );
        }
        return false;

      default:
        // Fallback: check common content properties
        const content = overlay.content || overlay._raw?.content || overlay.raw?.content;
        return content && typeof content === 'string' && content.includes('{');
    }
  }

  /**
   * Initialize enhanced template detection for status grids
   * Called during renderer initialization
   * @private
   */
  _initializeEnhancedTemplateDetection() {
    // Monkey-patch BaseOverlayUpdater to support status grid template detection
    const overlayUpdater = this.systemsManager?.overlayUpdater;

    if (overlayUpdater && overlayUpdater._hasTemplateContent) {
      console.log('[AdvancedRenderer] Enhancing BaseOverlayUpdater template detection for status grids');

      // Store original method
      const originalHasTemplateContent = overlayUpdater._hasTemplateContent.bind(overlayUpdater);

      // Replace with enhanced version
      overlayUpdater._hasTemplateContent = (overlay) => {
        // Use our enhanced detection method
        return this._hasTemplateContentEnhanced(overlay);
      };

      console.log('[AdvancedRenderer] ✅ Enhanced template detection activated');
    }
  }
}