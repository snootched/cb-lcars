/**
 * [AdvancedRenderer] Advanced renderer - clean implementation for MSD v1
 * 🎨 Main orchestrator that delegates to specialized renderers
 */


import { RendererUtils } from './RendererUtils.js';
import { OverlayUtils } from './OverlayUtils.js';
import { AttachmentPointManager } from './AttachmentPointManager.js';

import { StatusGridRenderer } from './StatusGridRenderer.js';
import { ApexChartsOverlayRenderer } from './ApexChartsOverlayRenderer.js';
import { MsdControlsRenderer } from '../controls/MsdControlsRenderer.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { ActionHelpers } from './ActionHelpers.js';
import { TemplateProcessor } from '../utils/TemplateProcessor.js';

// Phase 3: Instance-based overlay architecture (COMPLETE)
import { OverlayBase } from '../overlays/OverlayBase.js';
import { TextOverlay } from '../overlays/TextOverlay.js';
import { ButtonOverlay } from '../overlays/ButtonOverlay.js';
import { LineOverlay } from '../overlays/LineOverlay.js';
import { ApexChartsOverlay } from '../overlays/ApexChartsOverlay.js';
import { StatusGridOverlay } from '../overlays/StatusGridOverlay.js';

export class AdvancedRenderer {
  constructor(mountEl, routerCore, systemsManager = null) {
    this.mountEl = mountEl;
    this.routerCore = routerCore;
    this.systemsManager = systemsManager;
    this.overlayElements = new Map();
    this.lastRenderArgs = null;

    // Centralized attachment point management
    this.attachmentManager = new AttachmentPointManager();

    // Track overlay elements for efficient updates
    this.overlayElementCache = new Map(); // overlayId -> DOM element
    this._lineDeps = new Map(); // targetOverlayId -> Set(lineOverlayId)

    // Phase 3: Cache for instance-based overlay renderers
    // Maps overlay.id -> OverlayBase instance
    this.overlayRenderers = new Map();

    this._performance = {
      renderStart: null,
      renderEnd: null,
      stages: {
        preparation: 0,
        overlayRendering: 0,
        domInjection: 0,
        actionAttachment: 0
      },
      overlayTimings: new Map(),
      totalRenderTime: 0,
      overlayCount: 0,
      lastRenderTimestamp: null
    };

  }

  /**
   * Render the complete MSD with all overlays
   * ✅ ENHANCED: Phase 5.3 - Now includes detailed performance tracking
   *
   * @param {Object} resolvedModel - Complete model with overlays and anchors
   * @returns {Object} {svgMarkup, overlayCount, errors, provenance}
   */
  render(resolvedModel) {
    // ✅ NEW: Start overall performance tracking (Phase 5.3)
    this._performance.renderStart = performance.now();
    this._performance.overlayTimings.clear();
    this._performance.overlayCount = 0;

    if (!resolvedModel) {
      cblcarsLog.warn('[AdvancedRenderer] ⚠️ No resolved model provided');
      return { svgMarkup: '', overlayCount: 0 };
    }

    const { overlays = [], anchors = {}, viewBox } = resolvedModel;

    // Store static anchors for use throughout render
    this._staticAnchors = anchors;

    cblcarsLog.debug(`[AdvancedRenderer] 🎨 Rendering ${overlays.length} overlays, ${Object.keys(anchors).length} anchors`);

    // ✅ NEW: Stage 1 - Preparation (Phase 5.3)
    const prepStart = performance.now();

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

    // Phase 3: Line overlay attachment points are set per-instance during render
    // (removed global lineRenderer.setOverlayAttachmentPoints call)

    this._performance.stages.preparation = performance.now() - prepStart;

    // ✅ NEW: Stage 2 - Overlay Rendering (Phase 5.3)
    const renderStart = performance.now();

    // Initialize provenance collection
    const provenance = {
      renderer: 'AdvancedRenderer',
      overlays: {},
      render_summary: {
        total_overlays: overlays.length,
        by_type: {},
        by_renderer: {}
      }
    };

    // Phase 1: render overlays that others may depend on (text)
    const earlyTypes = new Set(['text']);
    let svgMarkupAccum = '';
    let processedCount = 0;

    // CHANGED: Separate action queues for each phase
    const phase1ActionQueue = [];

    overlays.filter(o => earlyTypes.has(o.type)).forEach(ov => {
      try {
        // ✅ NEW: Track per-overlay timing (Phase 5.3)
        const overlayStart = performance.now();

        const result = this.renderOverlay(ov, anchors, viewBox);

        cblcarsLog.trace(`[AdvancedRenderer] 📊 Phase 1 overlay result:`, {
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
            cblcarsLog.debug(`[AdvancedRenderer] 📝 Queuing Phase 1 action for ${result.overlayId}`);
            phase1ActionQueue.push({
              overlayId: result.overlayId,
              actionInfo: result.actionInfo
            });
          }

          // ✅ NEW: Collect provenance if available (Phase 5.3)
          if (result.provenance) {
            provenance.overlays[ov.id] = result.provenance;

            // Track by type
            const overlayType = result.provenance.overlay_type || ov.type;
            if (!provenance.render_summary.by_type[overlayType]) {
              provenance.render_summary.by_type[overlayType] = 0;
            }
            provenance.render_summary.by_type[overlayType]++;

            // Track by renderer
            const renderer = result.provenance.renderer;
            if (!provenance.render_summary.by_renderer[renderer]) {
              provenance.render_summary.by_renderer[renderer] = {
                count: 0,
                total_time_ms: 0
              };
            }
            provenance.render_summary.by_renderer[renderer].count++;
            provenance.render_summary.by_renderer[renderer].total_time_ms +=
              result.provenance.rendering_time_ms || 0;
          }
        }

        // ✅ NEW: Record overlay timing (Phase 5.3)
        const overlayDuration = performance.now() - overlayStart;
        this._performance.overlayTimings.set(ov.id, {
          type: ov.type,
          duration: overlayDuration
        });
        this._performance.overlayCount++;

        processedCount++;
      } catch (e) {
        cblcarsLog.warn(`[AdvancedRenderer] ⚠️ Phase1 render failed for overlay ${ov.id}:`, e);

        // ✅ NEW: Track failed overlay (Phase 5.3)
        provenance.overlays[ov.id] = {
          renderer: 'AdvancedRenderer',
          overlay_id: ov.id,
          error: e.message,
          timestamp: Date.now()
        };
      }
    });

    cblcarsLog.trace(`[AdvancedRenderer] 📋 Phase 1 action queue:`, {
      queueSize: phase1ActionQueue.length,
      overlayIds: phase1ActionQueue.map(a => a.overlayId)
    });

    // Inject Phase 1 DOM
    overlayGroup.innerHTML = svgMarkupAccum;

    // ADDED: Attach Phase 1 actions immediately after Phase 1 DOM injection
    cblcarsLog.trace(`[AdvancedRenderer] 🎯 Attaching Phase 1 actions`);

    phase1ActionQueue.forEach(({ overlayId, actionInfo }) => {
      const element = this.mountEl.querySelector(`[data-overlay-id="${overlayId}"]`);

      cblcarsLog.debug(`[AdvancedRenderer] 🔍 Looking for Phase 1 element ${overlayId}:`, {
        found: !!element,
        alreadyAttached: element?.hasAttribute('data-actions-attached')
      });

      if (element) {
        try {
          // Get animationManager from systemsManager to support animation triggers
          const animationManager = this.systemsManager?.animationManager;

          ActionHelpers.attachActions(
            element,
            actionInfo.overlay,
            actionInfo.config,
            actionInfo.cardInstance,
            { animationManager }
          );
          element.setAttribute('data-actions-attached', 'true');
          cblcarsLog.debug(`[AdvancedRenderer] ✅ Attached Phase 1 actions to ${overlayId}`);
        } catch (error) {
          cblcarsLog.error(`[AdvancedRenderer] ❌ Failed to attach Phase 1 actions to ${overlayId}:`, error);
        }
      } else {
        cblcarsLog.warn(`[AdvancedRenderer] ⚠️ Phase 1 element not found for overlay ${overlayId}`);
      }
    });

    this._cacheElementsFrom(overlayGroup);

    // CRITICAL: Populate attachment points from Phase 1 overlays BEFORE Phase 2
    // This ensures line overlays have correct attachment points on initial render
    this._populateInitialAttachmentPoints(overlays, anchors);

    // Build virtual anchors from Phase 1 overlays (text) for line anchoring
    // These are base anchors without gaps - lines will overwrite with gap-applied versions
    this._buildVirtualAnchorsFromAllOverlays(overlays);

    // Build dynamic anchors (overlay destinations) with gap applied
    // This OVERWRITES the base anchors from _buildVirtualAnchorsFromAllOverlays with gap-applied versions
    this.attachmentManager.setAnchorsFromObject(anchors);
    this._buildDynamicOverlayAnchors(overlays);

    // ADDED: Separate action queue for Phase 2
    const phase2ActionQueue = [];

    // Phase 2a: render non-line overlays (buttons, status_grids, etc.) that lines may attach to
    overlays.filter(o => !earlyTypes.has(o.type) && o.type !== 'line').forEach(ov => {
      try {
        // ✅ NEW: Track per-overlay timing (Phase 5.3)
        const overlayStart = performance.now();

        const result = this.renderOverlay(ov, this._staticAnchors, viewBox);

        cblcarsLog.debug(`[AdvancedRenderer] 📊 Phase 2a overlay ${ov.id} result:`, {
          resultType: typeof result,
          isObject: result && typeof result === 'object',
          hasMarkup: result?.markup,
          hasActionInfo: result?.actionInfo,
          overlayId: result?.overlayId
        });

        let markup = null;

        if (typeof result === 'string') {
          markup = result;
        } else if (result && result.markup) {
          markup = result.markup;

          if (result.actionInfo) {
            cblcarsLog.debug(`[AdvancedRenderer] 📝 Queuing Phase 2a action for ${result.overlayId}`);
            phase2ActionQueue.push({
              overlayId: result.overlayId,
              actionInfo: result.actionInfo,
              overlay: ov,
              cardInstance: this.systemsManager ? this._resolveCardInstance() : null
            });
          }

          // NEW: Store renderer provenance
          if (result.provenance) {
            this._storeRendererProvenance(ov.id, result.provenance);
            const renderer = result.provenance.renderer;
            if (!provenance.render_summary.by_renderer[renderer]) {
              provenance.render_summary.by_renderer[renderer] = {
                count: 0,
                total_time_ms: 0
              };
            }
            provenance.render_summary.by_renderer[renderer].count++;
            provenance.render_summary.by_renderer[renderer].total_time_ms +=
              result.provenance.rendering_time_ms || 0;
          }
        }

        if (markup) {
          overlayGroup.insertAdjacentHTML('beforeend', markup);
          svgMarkupAccum += markup;
          const el = overlayGroup.querySelector(`[data-overlay-id="${ov.id}"]`);
          if (el) this.overlayElementCache.set(ov.id, el);
        }

        // ✅ NEW: Record overlay timing (Phase 5.3)
        const overlayDuration = performance.now() - overlayStart;
        this._performance.overlayTimings.set(ov.id, {
          type: ov.type,
          duration: overlayDuration
        });
        this._performance.overlayCount++;

        processedCount++;
      } catch (e) {
        cblcarsLog.warn(`[AdvancedRenderer] ⚠️ Phase2a render failed for overlay ${ov.id}:`, e);
      }
    });

    // Cache Phase 2a elements and populate attachment points for buttons/etc
    this._cacheElementsFrom(overlayGroup);
    this._populateInitialAttachmentPoints(overlays, anchors);

    // Rebuild virtual anchors now that we have Phase 2a overlays (buttons, status_grids, etc.)
    // IMPORTANT: This must run BEFORE _buildDynamicOverlayAnchors so that
    // gap-applied anchors don't get overwritten by non-gap anchors
    this._buildVirtualAnchorsFromAllOverlays(overlays);

    // CRITICAL: Rebuild dynamic overlay anchors now that Phase 2a overlays have attachment points
    // This runs AFTER _buildVirtualAnchorsFromAllOverlays so gaps are preserved
    this._buildDynamicOverlayAnchors(overlays);

    // Phase 2b: render line overlays (now ALL targets exist with attachment points)
    overlays.filter(o => o.type === 'line').forEach(ov => {
      try {
        // ✅ NEW: Track per-overlay timing (Phase 5.3)
        const overlayStart = performance.now();

        const result = this.renderOverlay(ov, this._staticAnchors, viewBox);

        cblcarsLog.debug(`[AdvancedRenderer] 📊 Phase 2b overlay ${ov.id} result:`, {
          resultType: typeof result,
          isObject: result && typeof result === 'object',
          hasMarkup: result?.markup,
          hasActionInfo: result?.actionInfo,
          overlayId: result?.overlayId
        });

        let markup = '';
        if (typeof result === 'string') {
          markup = result;
        } else if (result && result.markup) {
          markup = result.markup;

          // CHANGED: Collect Phase 2 actions in separate queue
          if (result.actionInfo) {
            cblcarsLog.debug(`[AdvancedRenderer] 📝 Queuing Phase 2b action for ${result.overlayId}`);
            phase2ActionQueue.push({
              overlayId: result.overlayId,
              actionInfo: result.actionInfo,
              overlay: ov,
              cardInstance: this.systemsManager ? this._resolveCardInstance() : null
            });
          }

          // ✅ NEW: Collect provenance if available (Phase 5.3)
          if (result.provenance) {
            provenance.overlays[ov.id] = result.provenance;

            // Track by type
            const overlayType = result.provenance.overlay_type || ov.type;
            if (!provenance.render_summary.by_type[overlayType]) {
              provenance.render_summary.by_type[overlayType] = 0;
            }
            provenance.render_summary.by_type[overlayType]++;

            // Track by renderer
            const renderer = result.provenance.renderer;
            if (!provenance.render_summary.by_renderer[renderer]) {
              provenance.render_summary.by_renderer[renderer] = {
                count: 0,
                total_time_ms: 0
              };
            }
            provenance.render_summary.by_renderer[renderer].count++;
            provenance.render_summary.by_renderer[renderer].total_time_ms +=
              result.provenance.rendering_time_ms || 0;
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
            if (this.routerCore && raw.anchor) {
              const anchorPt = this.attachmentManager.getAnchor(raw.anchor);

              // Build virtual anchor ID for destination overlay
              const attachSide = raw.attach_side || raw.attachSide || 'center';
              const virtualAnchorId = attachSide === 'center' ? targetId : `${targetId}.${attachSide}`;
              const targetPt = this.attachmentManager.getAnchor(virtualAnchorId);

              if (anchorPt && targetPt) {
                try {
                  const req = this.routerCore.buildRouteRequest(ov, anchorPt, targetPt);
                  this.routerCore.computePath(req);
                } catch (e) {
                  cblcarsLog.debug('[AdvancedRenderer] 🔗 Route registration failed for overlay', ov.id, e);
                }
              }
            }
          }
        }

        // ✅ NEW: Record overlay timing (Phase 5.3)
        const overlayDuration = performance.now() - overlayStart;
        this._performance.overlayTimings.set(ov.id, {
          type: ov.type,
          duration: overlayDuration
        });
        this._performance.overlayCount++;

        processedCount++;
      } catch (e) {
        cblcarsLog.warn(`[AdvancedRenderer] ⚠️ Phase2b render failed for overlay ${ov.id}:`, e);

        // ✅ NEW: Track failed overlay (Phase 5.3)
        provenance.overlays[ov.id] = {
          renderer: 'AdvancedRenderer',
          overlay_id: ov.id,
          error: e.message,
          timestamp: Date.now()
        };
      }
    });

    this._performance.stages.overlayRendering = performance.now() - renderStart;

    // ✅ NEW: Stage 3 - DOM Injection (Phase 5.3)
    const domStart = performance.now();

    // ADDED: Attach Phase 2 actions (buttons, status grids, etc.) AFTER Phase 2 DOM injection
    cblcarsLog.debug(`[AdvancedRenderer] 🎯 Attaching ${phase2ActionQueue.length} Phase 2 actions`);

    phase2ActionQueue.forEach(({ overlayId, actionInfo, overlay, cardInstance }) => {
      const element = this.mountEl.querySelector(`[data-overlay-id="${overlayId}"]`);

      cblcarsLog.debug(`[AdvancedRenderer] 🔍 Looking for Phase 2 element ${overlayId}:`, {
        found: !!element,
        alreadyAttached: element?.hasAttribute('data-actions-attached'),
        hasActionInfo: !!actionInfo,
        isEnhanced: !!actionInfo?.config?.enhanced
      });

      if (element && !element.hasAttribute('data-actions-attached')) {
        try {
          // Get animationManager from systemsManager to support animation triggers
          const animationManager = this.systemsManager?.animationManager;

          // CHANGED: Handle different action config types
          if (actionInfo.config.simple) {
            // Simple overlay-level actions (text, buttons)
            ActionHelpers.attachActions(
              element,
              overlay,
              actionInfo.config,
              cardInstance,
              { animationManager }
            );
          } else if (actionInfo.config.enhanced) {
            // Enhanced cell-level actions (status grids)
            cblcarsLog.debug(`[AdvancedRenderer] 🔲 Attaching enhanced cell actions for ${overlayId}`);

            // Attach cell-specific actions using ActionHelpers
            if (actionInfo.cells && actionInfo.cells.length > 0) {
              ActionHelpers.attachCellActionsFromConfigs(
                element,
                actionInfo.cells,
                cardInstance
              );
            }

            // Attach overlay-level fallback actions if present
            if (actionInfo.config.enhanced.default_tap ||
                actionInfo.config.enhanced.default_hold ||
                actionInfo.config.enhanced.default_double_tap) {

              const fallbackConfig = {
                simple: {
                  tap_action: actionInfo.config.enhanced.default_tap,
                  hold_action: actionInfo.config.enhanced.default_hold,
                  double_tap_action: actionInfo.config.enhanced.default_double_tap
                }
              };

              ActionHelpers.attachActions(
                element,
                overlay,
                fallbackConfig,
                cardInstance,
                { animationManager }
              );
            }
          }

          element.setAttribute('data-actions-attached', 'true');
          cblcarsLog.debug(`[AdvancedRenderer] ✅ Attached Phase 2 actions to ${overlayId}`);
        } catch (error) {
          cblcarsLog.error(`[AdvancedRenderer] ❌ Failed to attach Phase 2 actions to ${overlayId}:`, error);
        }
      } else if (!element) {
        cblcarsLog.warn(`[AdvancedRenderer] ⚠️ Phase 2 element not found for overlay ${overlayId}`);
      }
    });

    this._performance.stages.domInjection = performance.now() - domStart;

    cblcarsLog.debug('[AdvancedRenderer] Injected elements (after phased render):', {
      total: this.overlayElementCache.size,
      text: overlayGroup.querySelectorAll('[data-overlay-type="text"]').length,
      lines: overlayGroup.querySelectorAll('[data-overlay-type="line"]').length,
      status_grid: overlayGroup.querySelectorAll('[data-overlay-type="status_grid"]').length,
      history_bars: overlayGroup.querySelectorAll('[data-overlay-type="history_bar"]').length,
      controls: overlayGroup.querySelectorAll('[data-overlay-type="control"]').length
    });

    // ✅ NEW: Stage 4 - Action Attachment (already done inline, track time)
    // Action attachment time is tracked inline above during Phase 1 and Phase 2

    // NEW: schedule deferred line refresh to fix first-load orientation/position
    this._scheduleDeferredLineRefresh(overlays, this._staticAnchors, viewBox);

    // NEW: schedule font stabilization pass (re-measure after real fonts load)
    this._scheduleFontStabilization(overlays, this._staticAnchors, viewBox);

    this.lastRenderArgs = { resolvedModel, overlays, svg };

    // ✅ NEW: Calculate total and store final metrics (Phase 5.3)
    this._performance.renderEnd = performance.now();
    this._performance.totalRenderTime = this._performance.renderEnd - this._performance.renderStart;
    this._performance.lastRenderTimestamp = Date.now();

    // ✅ NEW: Add performance summary to provenance (Phase 5.3)
    provenance.performance = this._getPerformanceSummary();

    // ✅ NEW: Log performance summary (Phase 5.3)
    cblcarsLog.debug('[AdvancedRenderer] Render complete', {
      overlays: overlays.length,
      processed: processedCount,
      errors: overlays.length - processedCount,
      totalTime: this._performance.totalRenderTime.toFixed(2) + 'ms',
      stages: {
        preparation: this._performance.stages.preparation.toFixed(2) + 'ms',
        rendering: this._performance.stages.overlayRendering.toFixed(2) + 'ms',
        domInjection: this._performance.stages.domInjection.toFixed(2) + 'ms'
      }
    });

    // ✅ NEW: Store provenance in config (Phase 5.3)
    const config = window.cblcars.debug.msd?.pipelineInstance?.config;
    if (config && config.__provenance) {
      config.__provenance.advanced_renderer = provenance;
    }

    return {
      svgMarkup: svgMarkupAccum,
      overlayCount: processedCount,
      errors: overlays.length - processedCount,
      provenance  // ✅ NEW: Return provenance data (Phase 5.3)
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
        case 'status_grid':
          return this._computeStatusGridAttachmentPoints(overlay, anchors, container, effectiveViewBox);
        case 'control':
          return this._computeControlAttachmentPoints(overlay, anchors, container, effectiveViewBox);
        case 'line':
          // Lines don't have attachment points (they attach to others, not vice versa)
          return null;
        case 'apexchart':
          return ApexChartsOverlayRenderer.computeAttachmentPoints(overlay, anchors, container, viewBox);
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
    // Use TextOverlay instance if available, otherwise create temporary instance
    let textOverlay = this.overlayRenderers.get(overlay.id);
    if (!textOverlay || !(textOverlay instanceof TextOverlay)) {
      textOverlay = new TextOverlay(overlay, this.systemsManager);
    }
    return textOverlay.computeAttachmentPoints(overlay, anchors, container);
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

  // Build virtual anchors for lines that attach to overlays
  _buildDynamicOverlayAnchors(overlays) {
    overlays.filter(o => o.type === 'line').forEach(line => {
      const raw = line._raw || line.raw || {};
      const dest = raw.attach_to || raw.attachTo;
      if (!dest) return;

      // Read from attachment manager
      const attachmentPointData = this.attachmentManager.getAttachmentPoints(dest);
      if (!attachmentPointData || !attachmentPointData.points) {
        // Some overlays don't need attachment points (e.g., anchors, controls)
        cblcarsLog.debug(`[AdvancedRenderer] No attachment points found for ${dest}`);
        return;
      }

      // Get line anchor for auto-side determination
      // Check if anchor refers to an overlay (has attachment points)
      let lineAnchor = null;
      const sourceAttachmentPoints = this.attachmentManager.getAttachmentPoints(raw.anchor);

      cblcarsLog.debug(`[AdvancedRenderer] 🔍 Source anchor resolution for ${line.id}:`);
      cblcarsLog.debug(`  raw.anchor: "${raw.anchor}"`);
      cblcarsLog.debug(`  hasSourceAttachmentPoints: ${!!sourceAttachmentPoints}`);

      if (sourceAttachmentPoints?.points) {
        // Anchor is an overlay - resolve the appropriate side
        const anchorSide = (raw.anchor_side || raw.anchorSide || '').toLowerCase();

        cblcarsLog.debug(`  anchorSide config: "${anchorSide}"`);
        cblcarsLog.debug(`  destination center: [${attachmentPointData.points.center.join(', ')}]`);

        const { point: sourcePt, side: sourceEffectiveSide } = this._resolveOverlayAttachmentPoint(
          sourceAttachmentPoints.points,
          anchorSide,
          attachmentPointData.points.center  // Use destination center to auto-determine source side
        );

        cblcarsLog.debug(`  resolved sourcePt: [${sourcePt ? sourcePt.join(', ') : 'null'}]`);
        cblcarsLog.debug(`  resolved sourceEffectiveSide: "${sourceEffectiveSide}"`);

        lineAnchor = sourcePt;

        // Store the source virtual anchor if it's not center
        if (sourcePt && sourceEffectiveSide && sourceEffectiveSide !== 'center') {
          const sourceVirtualAnchorId = `${raw.anchor}.${sourceEffectiveSide}`;
          const sourceGapPt = this._applyAttachGap(sourcePt, sourceEffectiveSide,
            { anchor_gap: raw.anchor_gap || raw.anchorGap }, sourceAttachmentPoints.bbox);
          this.attachmentManager.setAnchor(sourceVirtualAnchorId, sourceGapPt);
          if (this.routerCore?.anchors) {
            this.routerCore.anchors[sourceVirtualAnchorId] = sourceGapPt;
          }
          lineAnchor = sourceGapPt;  // Use the gap-adjusted point

          // CRITICAL: Write back auto-determined side to overlay config so LineOverlay can use it
          raw.anchor_side = sourceEffectiveSide;
          line.anchor_side = sourceEffectiveSide;  // Also write to top-level object
          cblcarsLog.debug(`[AdvancedRenderer] 💾 Wrote back anchor_side to overlay config:`, {
            overlayId: line.id,
            anchor_side: sourceEffectiveSide
          });
        }
      } else {
        // Standard anchor lookup
        lineAnchor = this.attachmentManager.getAnchor(raw.anchor) ||
                    this._staticAnchors[raw.anchor] ||
                    null;
      }

      const configSide = (raw.attach_side || raw.attachSide || '').toLowerCase();

      cblcarsLog.debug(`[AdvancedRenderer] 🔗 Building anchor for line ${line.id}:`);
      cblcarsLog.debug(`  dest: ${dest}`);
      cblcarsLog.debug(`  configSide: "${configSide}" (empty=${!configSide})`);
      cblcarsLog.debug(`  lineAnchor: [${lineAnchor ? lineAnchor.join(', ') : 'null'}]`);
      cblcarsLog.debug(`  availablePoints: ${Object.keys(attachmentPointData.points).join(', ')}`);
      cblcarsLog.debug(`  center: [${attachmentPointData.points.center.join(', ')}]`);
      cblcarsLog.debug(`  right: [${attachmentPointData.points.right.join(', ')}]`);
      cblcarsLog.debug(`  left: [${attachmentPointData.points.left.join(', ')}]`);

      const { point: basePt, side: effectiveSide } = this._resolveOverlayAttachmentPoint(
        attachmentPointData.points,
        configSide,
        lineAnchor
      );

      cblcarsLog.debug(`[AdvancedRenderer] 🎯 Resolved attachment point:`);
      cblcarsLog.debug(`  effectiveSide: "${effectiveSide}"`);
      cblcarsLog.debug(`  basePt: [${basePt ? basePt.join(', ') : 'null'}]`);
      cblcarsLog.debug(`  configSide was: "${configSide}"`);      if (!basePt) {
        cblcarsLog.warn(`[AdvancedRenderer] ⚠️ No base point resolved for ${line.id}`);
        return;
      }
      const gapPt = this._applyAttachGap(basePt, effectiveSide, raw, attachmentPointData.bbox);

      // Construct the proper virtual anchor ID based on effective side (which may be auto-determined)
      const virtualAnchorId = effectiveSide && effectiveSide !== 'center' ? `${dest}.${effectiveSide}` : dest;

      cblcarsLog.debug(`[AdvancedRenderer] 💾 Storing virtual anchor:`);
      cblcarsLog.debug(`  virtualAnchorId: "${virtualAnchorId}"`);
      cblcarsLog.debug(`  gapPt: [${gapPt.join(', ')}]`);
      cblcarsLog.debug(`  effectiveSide: "${effectiveSide}"`);

      // Store in attachment manager
      this.attachmentManager.setAnchor(virtualAnchorId, gapPt);

      // CRITICAL: Write back auto-determined side to overlay config so LineOverlay can use it
      if (effectiveSide && effectiveSide !== 'center' && !configSide) {
        raw.attach_side = effectiveSide;
        line.attach_side = effectiveSide;  // Also write to top-level object
        cblcarsLog.debug(`[AdvancedRenderer] 💾 Wrote back attach_side to overlay config:`, {
          overlayId: line.id,
          attach_side: effectiveSide
        });
      }

      // Register in routerCore so HUD sees it as an anchor
      if (this.routerCore && this.routerCore.anchors) {
        this.routerCore.anchors[virtualAnchorId] = gapPt;
        try {
          this.routerCore.invalidate(line.id);
          const srcAnchor = this.attachmentManager.getAnchor(raw.anchor) || this.routerCore.anchors[raw.anchor];
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
      const tap = this.attachmentManager.getAttachmentPoints(id);
      if (!tap || !tap.points) return;

      // Log what attachment points we're reading for title_overlay
      if (id === 'title_overlay') {
        cblcarsLog.trace(`[AdvancedRenderer] 🔍 _updateDynamicAnchorsForOverlays reading title_overlay attachment points:`, {
          right: tap.points.right,
          bboxRight: tap.bbox?.right,
          bboxWidth: tap.bbox?.width
        });
      }

      const dep = this._lineDeps.get(id);
      if (!dep) return;
      dep.forEach(lineId => {
        const line = overlays.find(o => o.id === lineId);
        if (!line) return;
        const raw = line._raw || line.raw || {};

        // Get line anchor for auto-side determination
        const lineAnchor = anchorMap[raw.anchor] ||
                          this.attachmentManager.getAnchor(raw.anchor) ||
                          this.routerCore?.anchors[raw.anchor] ||
                          null;

        const configSide = (raw.attach_side || raw.attachSide || '').toLowerCase();
        const { point: basePt, side: effectiveSide } = this._resolveOverlayAttachmentPoint(
          tap.points,
          configSide,
          lineAnchor
        );
        if (!basePt) return;
        const gapPt = this._applyAttachGap(basePt, effectiveSide, raw, tap.bbox);

        // Construct the proper virtual anchor ID based on effective side (which may be auto-determined)
        const virtualAnchorId = effectiveSide && effectiveSide !== 'center' ? `${id}.${effectiveSide}` : id;

        // Log for title_overlay
        if (id === 'title_overlay' && effectiveSide === 'right') {
          cblcarsLog.trace(`[AdvancedRenderer] 🔍 _updateDynamicAnchorsForOverlays setting title_overlay.right:`, {
            basePt,
            gapPt,
            gap: raw.attach_gap
          });
        }

        // Update in attachment manager
        this.attachmentManager.setAnchor(virtualAnchorId, gapPt);

        anchorMap[virtualAnchorId] = gapPt;
        if (this.routerCore && this.routerCore.anchors) {
          this.routerCore.anchors[virtualAnchorId] = gapPt;
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
    const gap = Number(raw.attach_gap || raw.attachGap || raw.anchor_gap || raw.anchorGap || 0);
    const gapX = Number(raw.attach_gap_x || raw.attachGapX || raw.anchor_gap_x || raw.anchorGapX || gap || 0);
    const gapY = Number(raw.attach_gap_y || raw.attachGapY || raw.anchor_gap_y || raw.anchorGapY || gap || 0);

    cblcarsLog.trace(`[AdvancedRenderer] 🔧 _applyAttachGap:`, {
      point,
      side,
      gap,
      gapX,
      gapY,
      rawGaps: {
        attach_gap: raw.attach_gap,
        anchor_gap: raw.anchor_gap
      }
    });

    if (!(gapX || gapY)) {
      cblcarsLog.debug(`[AdvancedRenderer] ⏭️ No gap to apply, returning original point`);
      return point;
    }

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

    const result = [x + dx, y + dy];
    cblcarsLog.trace(`[AdvancedRenderer] ✅ Applied gap: [${point}] + [${dx}, ${dy}] = [${result}]`);
    return result;
  }

  // NEW: resolve which attachment point to use based on side keyword
  // If side is not specified (empty), auto-determine best side based on line anchor position
  // Returns: { point: [x, y], side: 'left'|'right'|'top'|'bottom'|etc }
  _resolveOverlayAttachmentPoint(points, side, lineAnchor = null) {
    if (!points) return { point: null, side: null };

    let effectiveSide = side;

    // Auto-determine side if not specified
    if (!side || side === '') {
      cblcarsLog.debug('[AdvancedRenderer] 🔍 Auto-determination check:', {
        hasLineAnchor: !!lineAnchor,
        lineAnchor,
        hasCenter: !!points?.center,
        center: points?.center
      });

      if (lineAnchor && points.center) {
        // Calculate which side of the overlay is closest to the line anchor
        const [lineX, lineY] = lineAnchor;
        const [centerX, centerY] = points.center;

        const dx = lineX - centerX;
        const dy = lineY - centerY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // Determine primary direction (horizontal or vertical)
        if (absDx > absDy) {
          // Horizontal: left or right
          effectiveSide = dx < 0 ? 'left' : 'right';
        } else {
          // Vertical: top or bottom
          effectiveSide = dy < 0 ? 'top' : 'bottom';
        }

        cblcarsLog.debug('[AdvancedRenderer] ✅ Auto-determined attach_side:', effectiveSide, {
          lineAnchor,
          center: points.center,
          dx,
          dy
        });
      } else {
        // Fallback to center if no line anchor provided
        effectiveSide = 'center';
      }
    }

    let point;
    switch (effectiveSide) {
      case 'left': point = points.left || points.leftPadded || points.center; break;
      case 'right': point = points.right || points.rightPadded || points.center; break;
      case 'top': point = points.top || points.topPadded || points.center; break;
      case 'bottom': point = points.bottom || points.bottomPadded || points.center; break;
      case 'top-left': point = points.topLeft || points.left || points.top || points.center; break;
      case 'top-right': point = points.topRight || points.right || points.top || points.center; break;
      case 'bottom-left': point = points.bottomLeft || points.left || points.bottom || points.center; break;
      case 'bottom-right': point = points.bottomRight || points.right || points.bottom || points.center; break;
      case 'center':
      default:
        point = points.center;
        effectiveSide = 'center';
    }

    return { point, side: effectiveSide };
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
        // For font stabilization, always measure from DOM (not stored bbox)
        // because fonts may have loaded and changed the text dimensions
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
            // After re-render, also measure from DOM (new render may have different font metrics)
            const bb2 = RendererUtils.getDomTextBBox(newGroup);
            if (bb2) {
              newGroup.setAttribute('data-text-width', String(bb2.width));
              newGroup.setAttribute('data-text-height', String(bb2.height));
              // Pass DOM-measured text bbox so it can be expanded
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

          // CRITICAL: If overlay has status indicator, add to changedTargets since attachment points changed
          const hasStatusIndicator = group.querySelector('[data-decoration="status-indicator"]');
          if (hasStatusIndicator) {
            changedTargets.add(ov.id);
          }
        }
      });

      // Phase 3: Line overlay attachment points are set per-instance during render
      // (line overlays call setOverlayAttachmentPoints on their own instances)

      // ENHANCED: Force comprehensive update after font stabilization
      if (anyFontChanges || changedTargets.size) {
        // Update dynamic anchors for changed text overlays
        this._updateDynamicAnchorsForOverlays(changedTargets, overlays, this._staticAnchors);

        // Re-render ALL dependent lines, not just immediate dependencies
        this._rerenderAllDependentOverlays(overlays, changedTargets, viewBox);

        // CRITICAL: Also update virtual anchors since attachment points changed
        this._rebuildVirtualAnchorsFromChangedOverlays(changedTargets, overlays, this._staticAnchors);
      }

      pass++;
      const morePassesAllowed = pass < (MAX_PASSES + EXTRA_PASSES);
      if ((changedTargets.size || anyUnstable) && morePassesAllowed) {
        requestAnimationFrame(run);
      } else {
        // FINAL COMPREHENSIVE UPDATE: Force one last update to catch any remaining issues
        if (globalStabilizationNeeded) {
          globalStabilizationNeeded = false;
          this._performFinalStabilizationUpdate(overlays, this._staticAnchors, viewBox);
        }

        // NOTE: Line overlays are already updated during font stabilization via _rerenderAllDependentOverlays()
        // No additional refresh needed here

        cblcarsLog.debug('[AdvancedRenderer] Font stabilization complete', {
          passes: pass,
          changed: Array.from(changedTargets),
          hadFontChanges: anyFontChanges
        });

        // Final safety delayed pass in case font finished loading just after loop
        // Increased timeout to give more time for fonts to apply
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
        }, 300); // Increased from 180ms to 300ms
      }
    };

    // Wait for font faces if still loading
    const fontAPI = document.fonts;
    if (fontAPI && fontAPI.status !== 'loaded') {
      // Wait for fonts to load, then give extra time for them to be applied
      fontAPI.ready
        .then(() => {
          cblcarsLog.debug('[AdvancedRenderer] Fonts loaded, waiting for render...');
          // Double RAF to ensure fonts are applied before measuring
          requestAnimationFrame(() => {
            requestAnimationFrame(run);
          });
        })
        .catch(() => {
          cblcarsLog.warn('[AdvancedRenderer] Font loading failed, proceeding anyway');
          requestAnimationFrame(run);
        });
    } else {
      // Fonts already loaded, but still give one RAF for safety
      requestAnimationFrame(() => {
        requestAnimationFrame(run);
      });
    }
  }

  _scheduleDeferredLineRefresh(overlays, anchorsRef, viewBox) {
    // Phase 3: Deferred line refresh is now handled during font stabilization
    // via _rerenderAllDependentOverlays() which properly updates lines
    // This method kept for backwards compatibility but does nothing
    cblcarsLog.debug('[AdvancedRenderer] Deferred line refresh scheduled (handled during font stabilization)');
  }

  /**
   * Get or create a renderer for an overlay
   *
   * Phase 3 COMPLETE: All overlay types now use instance-based architecture
   * - TextOverlay, ButtonOverlay, LineOverlay: Full migration
   * - ApexChartsOverlay, StatusGridOverlay: Wrapper pattern
   *
   * @private
   * @param {Object} overlay - Overlay configuration
   * @returns {OverlayBase|null} Renderer instance or null if no renderer available
   */
  _getRendererForOverlay(overlay) {
    // Check if we already have a renderer cached
    if (this.overlayRenderers.has(overlay.id)) {
      return this.overlayRenderers.get(overlay.id);
    }

    // Check if the overlay itself is already an instance-based renderer
    // (This will be the case when overlays are migrated to extend OverlayBase)
    if (overlay instanceof OverlayBase) {
      this.overlayRenderers.set(overlay.id, overlay);
      return overlay;
    }

    // Phase 3: Create instance-based renderers for all overlay types

    // Text overlays use TextOverlay class
    if (overlay.type === 'text') {
      const textOverlay = new TextOverlay(overlay, this.systemsManager);
      this.overlayRenderers.set(overlay.id, textOverlay);
      return textOverlay;
    }

    // Button overlays use ButtonOverlay class
    if (overlay.type === 'button') {
      const buttonOverlay = new ButtonOverlay(overlay, this.systemsManager);
      this.overlayRenderers.set(overlay.id, buttonOverlay);
      return buttonOverlay;
    }

    // Line overlays use LineOverlay class
    if (overlay.type === 'line') {
      const lineOverlay = new LineOverlay(overlay, this.systemsManager, this.routerCore);
      this.overlayRenderers.set(overlay.id, lineOverlay);
      return lineOverlay;
    }

    // ApexCharts overlays use ApexChartsOverlay class (wrapper pattern)
    if (overlay.type === 'apexchart') {
      const apexChartsOverlay = new ApexChartsOverlay(overlay, this.systemsManager);
      this.overlayRenderers.set(overlay.id, apexChartsOverlay);
      return apexChartsOverlay;
    }

    // Status grid overlays use StatusGridOverlay class (wrapper pattern)
    if (overlay.type === 'status_grid') {
      const statusGridOverlay = new StatusGridOverlay(overlay, this.systemsManager);
      this.overlayRenderers.set(overlay.id, statusGridOverlay);
      return statusGridOverlay;
    }

    // Control overlays are handled separately by MsdControlsRenderer
    if (overlay.type === 'control') {
      return null;
    }

    // Unknown overlay type
    cblcarsLog.warn(`[AdvancedRenderer] ⚠️ No renderer available for overlay type: ${overlay.type}`);
    return null;
  }

  /**
   * Selectively re-render specific overlays (incremental update fallback)
   * This method re-renders only the specified overlays without touching others
   *
   * @param {Array} overlaysToReRender - Array of overlay configs to re-render
   * @param {Object} resolvedModel - Complete model with all overlays, anchors, and viewBox
   * @returns {boolean} True if all overlays were successfully re-rendered
   */
  reRenderOverlays(overlaysToReRender, resolvedModel) {
    cblcarsLog.debug(`[AdvancedRenderer] 🔄 Selectively re-rendering overlay(s)`);

    if (!resolvedModel || !overlaysToReRender || overlaysToReRender.length === 0) {
      cblcarsLog.warn('[AdvancedRenderer] ⚠️ Invalid parameters for selective re-render');
      return false;
    }

    const { anchors = {}, viewBox, overlays: allOverlays } = resolvedModel;
    const svg = this.mountEl?.querySelector('svg');

    if (!svg) {
      cblcarsLog.error('[AdvancedRenderer] ❌ SVG element not found - cannot selective re-render');
      return false;
    }

    const overlayGroup = svg.querySelector('#msd-overlay-container');
    if (!overlayGroup) {
      cblcarsLog.error('[AdvancedRenderer] ❌ Overlay container not found - cannot selective re-render');
      return false;
    }

    let allSucceeded = true;
    const reRenderedIds = new Set();

    overlaysToReRender.forEach(overlay => {
      try {
        cblcarsLog.debug(`[AdvancedRenderer] 🎨 Re-rendering overlay: ${overlay.id}`);

        // Find and remove existing overlay element
        const existingElement = overlayGroup.querySelector(`[data-overlay-id="${overlay.id}"]`);
        if (existingElement) {
          existingElement.remove();
          cblcarsLog.debug(`[AdvancedRenderer] 🗑️ Removed existing overlay element: ${overlay.id}`);
        }

        // Re-render the overlay
        const result = this.renderOverlay(overlay, anchors, viewBox, svg);

        if (result && result.markup) {
          // Parse SVG markup correctly using DOMParser (not innerHTML which uses HTML parser)
          // HTML parser doesn't handle self-closing SVG tags correctly
          // Wrap in SVG element since DOMParser expects a complete document
          const parser = new DOMParser();
          const wrappedMarkup = `<svg xmlns="http://www.w3.org/2000/svg">${result.markup}</svg>`;
          const svgDoc = parser.parseFromString(wrappedMarkup, 'image/svg+xml');

          // Check for parsing errors
          const parserError = svgDoc.querySelector('parsererror');
          if (parserError) {
            cblcarsLog.error(`[AdvancedRenderer] ❌ SVG parsing error for ${overlay.id}:`, parserError.textContent);
            allSucceeded = false;
            return;
          }

          // Get the rendered element (first child of the svg element)
          const svgElement = svgDoc.documentElement;
          const newElement = svgElement.firstElementChild;
          if (newElement) {
            // Import node into current document
            const importedElement = document.importNode(newElement, true);
            overlayGroup.appendChild(importedElement);
            reRenderedIds.add(overlay.id);
            cblcarsLog.trace(`[AdvancedRenderer] ✅ Re-rendered overlay: ${overlay.id}`);

            // Re-attach actions if present
            if (result.actionInfo && !newElement.hasAttribute('data-actions-attached')) {
              try {
                // Get animationManager from systemsManager to support animation triggers
                const animationManager = this.systemsManager?.animationManager;

                ActionHelpers.attachActions(
                  newElement,
                  overlay,
                  result.actionInfo.config,
                  this.routerCore,
                  { animationManager }
                );
                newElement.setAttribute('data-actions-attached', 'true');
                cblcarsLog.debug(`[AdvancedRenderer] 🎯 Re-attached actions for: ${overlay.id}`);
              } catch (actionError) {
                cblcarsLog.warn(`[AdvancedRenderer] ⚠️ Failed to re-attach actions for ${overlay.id}:`, actionError);
              }
            }
          } else {
            cblcarsLog.warn(`[AdvancedRenderer] ⚠️ No element created for overlay: ${overlay.id}`);
            allSucceeded = false;
          }
        } else {
          cblcarsLog.warn(`[AdvancedRenderer] ⚠️ No markup returned for overlay: ${overlay.id}`);
          allSucceeded = false;
        }
      } catch (error) {
        cblcarsLog.error(`[AdvancedRenderer] ❌ Failed to re-render overlay ${overlay.id}:`, error);
        allSucceeded = false;
      }
    });

    // ✅ NEW: Update dynamic anchors and re-render dependent lines
    if (reRenderedIds.size > 0 && allOverlays && this._staticAnchors) {
      cblcarsLog.debug(`[AdvancedRenderer] 🔗 Updating dynamic anchors for ${reRenderedIds.size} re-rendered overlay(s)`);

      // Update dynamic anchors for re-rendered overlays
      this._updateDynamicAnchorsForOverlays(reRenderedIds, allOverlays, this._staticAnchors);

      // Re-render dependent line overlays
      cblcarsLog.debug(`[AdvancedRenderer] 📍 Re-rendering dependent line overlays`);
      this._rerenderAllDependentOverlays(allOverlays, Array.from(reRenderedIds), viewBox);
    }

    if (allSucceeded) {
      cblcarsLog.info(`[AdvancedRenderer] ✅ Successfully re-rendered all ${overlaysToReRender.length} overlay(s)`);
    } else {
      cblcarsLog.warn(`[AdvancedRenderer] ⚠️ Some overlays failed to re-render`);
    }

    return allSucceeded;
  }


  /**
   * Render individual overlay using appropriate renderer
   *
   * ✅ ENHANCED: Phase 3A+ - Now supports both instance-based (OverlayBase) and static renderers
   * ✅ ENHANCED: Now collects and stores renderer provenance for debugging
   *
   * @private
   */
  renderOverlay(overlay, anchors, viewBox, svgContainer) {
    try {
      cblcarsLog.trace(`[AdvancedRenderer] 🎨 Rendering overlay: ${overlay.type} (${overlay.id})`);

      let result;

      // Phase 3A+: Try to get instance-based renderer first
      const renderer = this._getRendererForOverlay(overlay);

      if (renderer instanceof OverlayBase) {
        // Instance-based overlay - all overlays now use this pattern
        cblcarsLog.trace(`[AdvancedRenderer] 🎯 Using instance-based renderer for ${overlay.id}`);

        // Handle special cases for different overlay types

        if (overlay.type === 'text') {
          // Render first, then extract attachment points from metadata
          result = renderer.render(overlay, anchors, viewBox, svgContainer);

          // Extract and cache attachment points from render result
          if (result && result.metadata && result.metadata.attachmentPoints) {
            // Format for LineOverlay: needs {points: {...}, bbox: {...}}
            const formattedAttachmentPoints = {
              id: overlay.id,
              points: result.metadata.attachmentPoints,
              bbox: result.metadata.bbox,
              center: result.metadata.attachmentPoints.center
            };

            // Cache in attachment manager
            this.attachmentManager.setAttachmentPoints(overlay.id, formattedAttachmentPoints);
          }
        } else if (overlay.type === 'line') {
          // Lines need complete anchor set (static + virtual) for overlay-to-overlay connections
          const completeAnchors = this._getCompleteAnchors(anchors, overlay.type);

          result = renderer.render(overlay, completeAnchors, viewBox, svgContainer);
        } else if (overlay.type === 'apexchart') {
          // ApexCharts needs the effective container and card instance
          const apexCardInstance = this.systemsManager ? this._resolveCardInstance() : null;
          const effectiveSvgContainer = svgContainer || this.mountEl;

          result = renderer.render(overlay, anchors, viewBox, effectiveSvgContainer, apexCardInstance);
        } else {
          // Standard render for most overlay types (button, status_grid, etc.)
          result = renderer.render(overlay, anchors, viewBox, svgContainer);
        }

      } else {
        // No renderer available - expected for control overlays (embedded HA cards)
        const isControl = overlay.type === 'control';
        if (isControl) {
          cblcarsLog.debug(`[AdvancedRenderer] Control overlay ${overlay.id} has no renderer (uses embedded HA card)`);
        } else {
          cblcarsLog.warn(`[AdvancedRenderer] ⚠️ No renderer instance for overlay ${overlay.id} (type: ${overlay.type})`);
        }
        return '';
      }

      // ✅ NEW: Store renderer provenance after successful render
      if (result && typeof result === 'object' && result.provenance) {
        this._storeRendererProvenance(overlay.id, result.provenance);
      } else if (result && typeof result === 'string' && result !== '') {
        // For renderers that just return string markup (legacy pattern)
        // We still want to track that the overlay was rendered, but without detailed provenance
        this._storeBasicRendererProvenance(overlay.id, overlay.type);
      }

      return result;

    } catch (error) {
      cblcarsLog.error(`[AdvancedRenderer] ❌ Error rendering overlay ${overlay.id}:`, error);

      // ✅ NEW: Track failed render
      this._storeFailedRendererProvenance(overlay.id, overlay.type, error);

      return this.renderFallbackOverlay(overlay);
    }
  }

  /**
   * Store renderer provenance in config
   *
   * ✅ NEW: Provenance storage method
   *
   * @private
   * @param {string} overlayId - Overlay ID
   * @param {Object} provenance - Renderer provenance data
   */
  _storeRendererProvenance(overlayId, provenance) {
    // Get config from pipeline
    const config = window.cblcars.debug.msd?.pipelineInstance?.config;
    if (!config || !config.__provenance) {
      return;
    }

    // Ensure renderers object exists
    if (!config.__provenance.renderers) {
      config.__provenance.renderers = {};
    }

    // Store provenance
    config.__provenance.renderers[overlayId] = provenance;

    cblcarsLog.trace(`[AdvancedRenderer] 📊 Stored renderer provenance for ${overlayId}`, provenance);
  }

  /**
   * Store basic renderer provenance for legacy renderers that only return strings
   *
   * ✅ NEW: Basic provenance tracking for legacy renderers
   *
   * @private
   * @param {string} overlayId - Overlay ID
   * @param {string} overlayType - Overlay type
   */
  _storeBasicRendererProvenance(overlayId, overlayType) {
    const config = window.cblcars.debug.msd?.pipelineInstance?.config;
    if (!config || !config.__provenance) {
      return;
    }

    // Ensure renderers object exists
    if (!config.__provenance.renderers) {
      config.__provenance.renderers = {};
    }

    // Store basic provenance
    config.__provenance.renderers[overlayId] = {
      renderer: `${overlayType}_renderer`,
      extends_base: false, // Unknown for legacy renderers
      theme_manager_resolved: false, // Unknown for legacy renderers
      rendering_time_ms: 0,
      timestamp: Date.now(),
      legacy_renderer: true,
      note: 'Renderer returned string markup only (no provenance data)'
    };

    cblcarsLog.debug(`[AdvancedRenderer] 📊 Stored basic provenance for legacy renderer: ${overlayId}`);
  }

  /**
   * Store failed render provenance
   *
   * ✅ NEW: Track rendering failures for debugging
   *
   * @private
   * @param {string} overlayId - Overlay ID
   * @param {string} overlayType - Overlay type
   * @param {Error} error - Error that occurred
   */
  _storeFailedRendererProvenance(overlayId, overlayType, error) {
    const config = window.cblcars.debug.msd?.pipelineInstance?.config;
    if (!config || !config.__provenance) {
      return;
    }

    // Ensure renderers object exists
    if (!config.__provenance.renderers) {
      config.__provenance.renderers = {};
    }

    // Store failure provenance
    config.__provenance.renderers[overlayId] = {
      renderer: `${overlayType}_renderer`,
      extends_base: false,
      theme_manager_resolved: false,
      rendering_failed: true,
      error_message: error.message,
      error_stack: error.stack,
      timestamp: Date.now()
    };

    cblcarsLog.debug(`[AdvancedRenderer] 📊 Stored failed render provenance for ${overlayId}:`, error.message);
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
      const lines = overlayGroup.querySelectorAll('[data-overlay-type="line"]');
      const texts = overlayGroup.querySelectorAll('[data-overlay-type="text"]');

      cblcarsLog.debug('[AdvancedRenderer] Injected elements:', {
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
   * Update overlay with new DataSource data
   * ENHANCED: Now handles text overlays with template processing
   * @param {string} overlayId - Overlay ID
   * @param {Object} sourceData - DataSource data
   */
  updateOverlayData(overlayId, sourceData) {
    try {
      cblcarsLog.debug(`[AdvancedRenderer] 📊 Updating overlay ${overlayId} with DataSource data`, {
        hasData: !!sourceData,
        value: sourceData?.v,
        isPeriodicUpdate: sourceData?.isPeriodicUpdate,
        hasAggregations: !!sourceData?.aggregations
      });

      // Get the overlay element from cache, with fallback to DOM query
      let overlayElement = this.overlayElementCache?.get(overlayId);

      // CRITICAL FIX: Cache can be stale after font stabilization re-renders
      // If cached element is disconnected, query DOM directly
      if (!overlayElement || !overlayElement.isConnected) {
        const overlayGroup = this.mountEl.querySelector('#msd-overlay-container');
        if (overlayGroup) {
          overlayElement = overlayGroup.querySelector(`[data-overlay-id="${overlayId}"]`);

          // Update cache with fresh element
          if (overlayElement && overlayElement.isConnected) {
            this.overlayElementCache.set(overlayId, overlayElement);
            cblcarsLog.debug(`[AdvancedRenderer] 🔄 Refreshed stale cache entry for ${overlayId}`);
          }
        }
      }

      if (!overlayElement) {
        cblcarsLog.warn(`[AdvancedRenderer] Overlay element not found for: ${overlayId}`);
        return;
      }

      // Get the overlay configuration
      const overlay = this._findOverlayById(overlayId);
      if (!overlay) {
        cblcarsLog.warn(`[AdvancedRenderer] Overlay configuration not found: ${overlayId}`);
        return;
      }

      // Phase 3: Use instance-based update method if available
      const renderer = this.overlayRenderers.get(overlayId);
      if (renderer && renderer.update) {
        // Instance-based overlay - use its update method
        renderer.update(overlayElement, overlay, sourceData);
        return;
      }

      // Fallback for any overlays without instance renderers (shouldn't happen with Phase 3 complete)
      cblcarsLog.warn(`[AdvancedRenderer] No instance renderer found for overlay ${overlayId}, using legacy update`);

      // Handle different overlay types
      switch (overlay.type) {
        case 'text':
          this._updateTextOverlayContent(overlayElement, overlay, sourceData);
          break;

        case 'status_grid':
          StatusGridRenderer.updateGridData(overlayElement, overlay, sourceData);
          break;

        case 'apexchart':
          // ApexCharts already have their own subscription mechanism
          break;

        default:
          cblcarsLog.debug(`[AdvancedRenderer] No update handler for overlay type: ${overlay.type}`);
      }

    } catch (error) {
      cblcarsLog.error(`[AdvancedRenderer] Error updating overlay ${overlayId}:`, error);
    }
  }


  /**
   * Update text overlay content with new data
   * @private
   * @param {Element} overlayElement - Overlay DOM element
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - DataSource data
   */
  _updateTextOverlayContent(overlayElement, overlay, sourceData) {
    try {
      // Find the text element
      const textElement = overlayElement.querySelector('text');
      if (!textElement) {
        cblcarsLog.warn(`[AdvancedRenderer] Text element not found in overlay`);
        return;
      }

      // Get the template string
      const template = overlay.text || overlay.content || overlay._raw?.text || overlay._raw?.content || '';

      // Process the template with current DataSource data
      const processedContent = this._processTextTemplate(template);

      // Update the text content if changed
      if (processedContent && processedContent !== textElement.textContent) {
        textElement.textContent = processedContent;

        cblcarsLog.debug(`[AdvancedRenderer] ✅ Updated text overlay content: ${overlay.id}`, {
          oldContent: textElement.textContent.substring(0, 50),
          newContent: processedContent.substring(0, 50)
        });
      }

    } catch (error) {
      cblcarsLog.error(`[AdvancedRenderer] Error updating text overlay content:`, error);
    }
  }

  /**
   * Process text template with DataSource data
   * @private
   * @param {string} template - Template string
   * @returns {string} Processed content
   */
  _processTextTemplate(template) {
    if (!TemplateProcessor.hasTemplates(template)) {
      return template;
    }

    // Get DataSourceManager
    const dataSourceManager = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;
    if (!dataSourceManager) {
      cblcarsLog.debug(`[AdvancedRenderer] DataSourceManager not available`);
      return template;
    }
    // Process template
    return template.replace(/\{([^}]+)\}/g, (match, reference) => {
      try {
        const [dataSourceRef, formatSpec] = reference.split(':');
        const cleanRef = dataSourceRef.trim();

        // Parse the reference: "hvac_complete.aggregations.heating_time.current"
        const parts = cleanRef.split('.');
        const sourceName = parts[0];

        // Get the data source
        const dataSource = dataSourceManager.getSource(sourceName);
        if (!dataSource) {
          cblcarsLog.debug(`[AdvancedRenderer] DataSource not found: ${sourceName}`);
          return match;
        }

        // Get current data
        const currentData = dataSource.getCurrentData();
        let value = currentData?.v;

        // Navigate the path
        if (parts.length > 1) {
          if (parts[1] === 'transformations' && parts[2]) {
            // Access transformation: hvac_complete.transformations.is_heating
            value = currentData?.transformations?.[parts[2]];
          } else if (parts[1] === 'aggregations' && parts.length > 2) {
            // Access aggregation with nested path: hvac_complete.aggregations.heating_time.current
            const aggPath = parts.slice(2).join('.');
            value = this._getNestedValue(currentData?.aggregations, aggPath);
          } else if (parts[1] === 'v') {
            // Direct value access: hvac_complete.v
            value = currentData?.v;
          }
        }

        if (value === null || value === undefined) {
          cblcarsLog.debug(`[AdvancedRenderer] Value not found for: ${cleanRef}`);
          return match;
        }

        // Apply formatting
        if (formatSpec && typeof value === 'number') {
          return this._formatNumber(value, formatSpec.trim());
        }

        return String(value);

      } catch (error) {
        cblcarsLog.warn(`[AdvancedRenderer] Template processing error:`, error);
        return match;
      }
    });
  }

  /**
   * Get nested value from object using dot notation
   * @private
   * @param {Object} obj - Object to traverse
   * @param {string} path - Dot-separated path
   * @returns {*} Nested value
   */
  _getNestedValue(obj, path) {
    if (!obj || !path) return undefined;

    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
  }

  /**
   * Format number with format specification
   * @private
   * @param {number} value - Number to format
   * @param {string} formatSpec - Format specification (.1f, .2f, etc.)
   * @returns {string} Formatted number
   */
  _formatNumber(value, formatSpec) {
    if (formatSpec.endsWith('f')) {
      const precision = parseInt(formatSpec.slice(1, -1)) || 1;
      return value.toFixed(precision);
    }
    if (formatSpec === 'd') {
      return Math.round(value).toString();
    }
    return String(value);
  }

  /**
   * Find overlay by ID in current model
   * @private
   * @param {string} overlayId - Overlay ID
   * @returns {Object|null} Overlay configuration
   */
  _findOverlayById(overlayId) {
    // Try to get from last render args first
    if (this.lastRenderArgs?.overlays) {
      const overlay = this.lastRenderArgs.overlays.find(o => o.id === overlayId);
      if (overlay) return overlay;
    }

    // Try to get from current render model
    if (this._currentRenderModel?.resolvedModel?.overlays) {
      return this._currentRenderModel.resolvedModel.overlays.find(o => o.id === overlayId);
    }

    // Try systems manager
    const resolvedModel = this.systemsManager?.getResolvedModel?.();
    if (resolvedModel?.overlays) {
      return resolvedModel.overlays.find(o => o.id === overlayId);
    }

    return null;
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
    const svg = this.mountEl?.querySelector('svg');
    const overlayGroup = svg?.querySelector('#msd-overlay-container');

    if (!svg || !overlayGroup) {
      cblcarsLog.warn('[AdvancedRenderer] ⚠️ Cannot re-render dependent overlays - missing SVG or overlay container');
      return;
    }

    while (queue.length) {
      const overlayId = queue.shift();
      if (visited.has(overlayId)) continue;
      visited.add(overlayId);

      const overlay = allOverlays.find(o => o.id === overlayId);
      if (!overlay) continue;

      // Re-render the overlay (generate new markup)
      try {
        // ✅ CRITICAL: For line overlays, update overlayAttachmentPoints map on instance first
        if (overlay.type === 'line') {
          const renderer = this._getRendererForOverlay(overlay);
          if (renderer) {
            cblcarsLog.trace(`[AdvancedRenderer] 🔗 Re-rendering line overlay with updated attachment points: ${overlayId}`);
          }
        }

        const result = this.renderOverlay(overlay, this._staticAnchors, viewBox, svg);

        if (result && result.markup) {
          // Remove old element
          const existingElement = overlayGroup.querySelector(`[data-overlay-id="${overlayId}"]`);
          if (existingElement) {
            existingElement.remove();
          }

          // Parse and insert new markup
          const parser = new DOMParser();
          const wrappedMarkup = `<svg xmlns="http://www.w3.org/2000/svg">${result.markup}</svg>`;
          const svgDoc = parser.parseFromString(wrappedMarkup, 'image/svg+xml');

          const parserError = svgDoc.querySelector('parsererror');
          if (parserError) {
            cblcarsLog.error(`[AdvancedRenderer] ❌ SVG parsing error for ${overlayId}:`, parserError.textContent);
            continue;
          }

          const svgElement = svgDoc.documentElement;
          const newElement = svgElement.firstElementChild;
          if (newElement) {
            const importedElement = document.importNode(newElement, true);
            overlayGroup.appendChild(importedElement);
            cblcarsLog.trace(`[AdvancedRenderer] ✅ Re-rendered dependent overlay: ${overlayId}`);
          }
        }
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
      const attachmentPointData = this.attachmentManager.getAttachmentPoints(dest);
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

      // Always measure from DOM to get current text dimensions
      // _updateStatusIndicatorPosition will expand this bbox to include indicator
      const bb = RendererUtils.getDomTextBBox(group);
      if (!bb) return;

      group.setAttribute('data-text-width', String(bb.width));
      group.setAttribute('data-text-height', String(bb.height));

      // Update attachment points and status indicators
      // Pass DOM text bbox - it will be expanded inside these functions
      this._updateTextAttachmentPointsFromDom(ov, group, bb);
      this._updateStatusIndicatorPosition(group, bb);
    });

    // Phase 3: Line overlay attachment points are set per-instance during render
    // (line overlays call setOverlayAttachmentPoints on their own instances)

    // Re-render all overlays to apply final updates
    this._rerenderAllDependentOverlays(allOverlays, Object.keys(this._lineDeps), viewBox);
  }

  /**
   * Build virtual anchors from ALL overlay attachment points (not just attach_to targets)
   * This allows lines to use ANY overlay as an anchor point
   * @private
   */
  _buildVirtualAnchorsFromAllOverlays(overlays) {
    overlays.forEach(overlay => {
      if (overlay.type === 'line') return; // Lines don't create virtual anchors

      // Read from attachment manager
      const attachmentPoints = this.attachmentManager.getAttachmentPoints(overlay.id);
      if (!attachmentPoints || !attachmentPoints.points) return;

      // Create virtual anchors for each attachment point of this overlay
      // BUT: Don't overwrite gap-adjusted anchors from _buildDynamicOverlayAnchors
      const createdAnchors = [];
      Object.entries(attachmentPoints.points).forEach(([side, point]) => {
        const virtualAnchorId = `${overlay.id}.${side}`;

        // Only set if not already set (preserves gap-adjusted anchors)
        if (!this.attachmentManager.hasAnchor(virtualAnchorId)) {
          this.attachmentManager.setAnchor(virtualAnchorId, point);
          createdAnchors.push({ id: virtualAnchorId, point });
        }
      });

      // Also create a default virtual anchor using the center point (safe to always update)
      this.attachmentManager.setAnchor(overlay.id, attachmentPoints.center);
      createdAnchors.push({ id: overlay.id, point: attachmentPoints.center });

      if (createdAnchors.length > 0) {
        cblcarsLog.trace(`[AdvancedRenderer] 🔗 Created virtual anchors for overlay ${overlay.id}:`, createdAnchors);
      }
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
      return { ...staticAnchors, ...this.attachmentManager.getAllAnchorsAsObject() };
    }
    return staticAnchors;
  }

  _updateTextAttachmentPointsFromDom(overlay, groupEl, bb) {
    if (!overlay || !groupEl || !bb) return;

    // Validate bbox - skip if invalid (text not rendered yet or during font load)
    if (bb.width <= 0 || bb.height <= 0) {
      cblcarsLog.trace(`[AdvancedRenderer] ⏭️ Skipping attachment point update for ${overlay.id} - invalid bbox:`, bb);
      return;
    }

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
    this.attachmentManager.setAttachmentPoints(overlay.id, ap);
  }

  /**
   * Populate initial attachment points from Phase 1 overlays
   * This reads the expanded bbox from DOM elements and populates overlayAttachmentPoints
   * BEFORE Phase 2 renders, ensuring lines have correct attachment points on initial render
   * @private
   */
  /**
   * Populate attachment points for Phase 1 overlays before Phase 2 rendering
   * This ensures line overlays have correct attachment points on initial render
   * @private
   */
  _populateInitialAttachmentPoints(overlays, anchors) {
    // Process all overlays that can be attachment targets (everything except lines)
    overlays.filter(o => o.type !== 'line').forEach(overlay => {
      const groupEl = this.overlayElementCache.get(overlay.id);
      if (!groupEl) return;

      // Try to read expanded bbox from DOM attribute (if status indicator present)
      const expandedBboxAttr = groupEl.getAttribute('data-expanded-bbox');
      let bbox;

      if (expandedBboxAttr) {
        try {
          bbox = JSON.parse(expandedBboxAttr);
          cblcarsLog.trace(`[AdvancedRenderer] 📍 Read expanded bbox from DOM for ${overlay.id}:`, bbox);
        } catch (e) {
          cblcarsLog.warn(`[AdvancedRenderer] Failed to parse expanded bbox for ${overlay.id}`, e);
        }
      }

      // Fallback to measuring from DOM if no expanded bbox
      if (!bbox) {
        // For text overlays, use specialized text bbox function
        if (overlay.type === 'text') {
          bbox = RendererUtils.getDomTextBBox(groupEl);
        } else {
          // For all other overlays, use generic SVG getBBox()
          try {
            const bb = groupEl.getBBox();
            bbox = {
              width: bb.width,
              height: bb.height,
              left: bb.x,
              top: bb.y,
              right: bb.x + bb.width,
              bottom: bb.y + bb.height,
              centerX: bb.x + bb.width / 2,
              centerY: bb.y + bb.height / 2
            };
            cblcarsLog.debug(`[AdvancedRenderer] 📍 Measured bbox from DOM for ${overlay.id}:`, bbox);
          } catch (e) {
            cblcarsLog.warn(`[AdvancedRenderer] Failed to measure bbox for ${overlay.id}`, e);
            return;
          }
        }
      }

      if (!bbox) return;

      // Create attachment point data
      const attachmentPoints = {
        id: overlay.id,
        center: [bbox.centerX, bbox.centerY],
        bbox: {
          left: bbox.left,
          right: bbox.right,
          top: bbox.top,
          bottom: bbox.bottom,
          width: bbox.width,
          height: bbox.height
        },
        points: {
          center: [bbox.centerX, bbox.centerY],
          top: [bbox.centerX, bbox.top],
          bottom: [bbox.centerX, bbox.bottom],
          left: [bbox.left, bbox.centerY],
          right: [bbox.right, bbox.centerY],
          topLeft: [bbox.left, bbox.top],
          topRight: [bbox.right, bbox.top],
          bottomLeft: [bbox.left, bbox.bottom],
          bottomRight: [bbox.right, bbox.bottom]
        }
      };

      // Store in attachment manager (single source of truth)
      this.attachmentManager.setAttachmentPoints(overlay.id, attachmentPoints);

      cblcarsLog.trace(`[AdvancedRenderer] ✅ Populated initial attachment points for ${overlay.id}`, {
        right: bbox.right,
        expandedRight: bbox.right,
        hasExpandedBbox: !!expandedBboxAttr
      });
    });

    // Process other Phase 1 overlay types (buttons, status_grids, etc.)
    overlays.filter(o => o.type !== 'text' && o.type !== 'line').forEach(overlay => {
      const groupEl = this.overlayElementCache.get(overlay.id);
      if (!groupEl) return;

      // Use overlay configuration for accurate positioning
      // Resolve position using anchors if necessary
      const position = OverlayUtils.resolvePosition(overlay.position, anchors);
      if (!position || !overlay.size) return;

      const [x, y] = position;
      const [width, height] = overlay.size;

      const bbox = {
        left: x,
        right: x + width,
        top: y,
        bottom: y + height,
        width: width,
        height: height,
        centerX: x + width / 2,
        centerY: y + height / 2
      };

      // Create attachment point data
      const attachmentPoints = {
        id: overlay.id,
        center: [bbox.centerX, bbox.centerY],
        bbox: {
          left: bbox.left,
          right: bbox.right,
          top: bbox.top,
          bottom: bbox.bottom,
          width: bbox.width,
          height: bbox.height
        },
        points: {
          center: [bbox.centerX, bbox.centerY],
          top: [bbox.centerX, bbox.top],
          bottom: [bbox.centerX, bbox.bottom],
          left: [bbox.left, bbox.centerY],
          right: [bbox.right, bbox.centerY],
          topLeft: [bbox.left, bbox.top],
          topRight: [bbox.right, bbox.top],
          bottomLeft: [bbox.left, bbox.bottom],
          bottomRight: [bbox.right, bbox.bottom]
        }
      };

      // Store in attachment manager (single source of truth)
      this.attachmentManager.setAttachmentPoints(overlay.id, attachmentPoints);

      cblcarsLog.trace(`[AdvancedRenderer] ✅ Populated initial attachment points for ${overlay.id} (${overlay.type})`, {
        bbox: bbox,
        center: [bbox.centerX, bbox.centerY]
      });
    });
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

  /**
   * Re-render a single text overlay (used during font stabilization)
   * Phase 3: Updated to use TextOverlay instance
   * @private
   */
  _reRenderSingleTextOverlay(overlay, anchorsRef, viewBox) {
    try {
      const oldGroup = this.overlayElementCache.get(overlay.id);
      if (!oldGroup) return null;

      // CRITICAL: Check if old element had actions attached
      const hadActions = oldGroup.hasAttribute('data-actions-attached');

      // Get card instance for action support (same as initial render)
      const textCardInstance = this._resolveCardInstance();

      // Get or create TextOverlay instance
      let textOverlay = this.overlayRenderers.get(overlay.id);
      if (!textOverlay || !(textOverlay instanceof TextOverlay)) {
        textOverlay = new TextOverlay(overlay, this.systemsManager);
        this.overlayRenderers.set(overlay.id, textOverlay);
      }

      // Re-render the text overlay using instance
      const result = textOverlay.render(overlay, anchorsRef, viewBox, this.mountEl, textCardInstance);

      // Handle both string (old format) and object (new format) returns
      let markup, actionInfo;
      if (typeof result === 'string') {
        markup = result;
      } else if (result && typeof result === 'object' && result.markup) {
        markup = result.markup;
        actionInfo = result.actionInfo; // ADDED: Extract actionInfo from result
      } else {
        cblcarsLog.warn(`[AdvancedRenderer] Invalid render result for ${overlay.id}`);
        return null;
      }

      if (!markup || typeof markup !== 'string') {
        cblcarsLog.warn(`[AdvancedRenderer] No valid markup for ${overlay.id}`);
        return null;
      }

      // Create new element from markup
      const temp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      temp.innerHTML = markup.trim();
      const newGroup = temp.firstElementChild;
      if (!newGroup) return null;

      // Replace old element
      oldGroup.replaceWith(newGroup);
      this.overlayElementCache.set(overlay.id, newGroup);

      // CRITICAL FIX: Re-attach actions if they were attached before
      if (hadActions && actionInfo) {
        try {
          cblcarsLog.debug(`[AdvancedRenderer] 🔄 Re-attaching actions after font stabilization for ${overlay.id}`);

          // Get animationManager from systemsManager to support animation triggers
          const animationManager = this.systemsManager?.animationManager;

          ActionHelpers.attachActions(
            newGroup,
            actionInfo.overlay,
            actionInfo.config,
            actionInfo.cardInstance,
            { animationManager }
          );
          newGroup.setAttribute('data-actions-attached', 'true');
          cblcarsLog.debug(`[AdvancedRenderer] ✅ Actions re-attached to ${overlay.id}`);
        } catch (error) {
          cblcarsLog.error(`[AdvancedRenderer] ❌ Failed to re-attach actions to ${overlay.id}:`, error);
        }
      }

      // Update DOM-based attachment points immediately
      const bb = RendererUtils.getDomTextBBox(newGroup);
      if (bb) this._updateTextAttachmentPointsFromDom(overlay, newGroup, bb);

      return newGroup;
    } catch(e) {
      cblcarsLog.info('[AdvancedRenderer] Re-render text overlay failed', overlay.id, e);
      return null;
    }
  }

  /**
   * Resolve card instance for action handling
   * @private
   */
  _resolveCardInstance() {
    // Try SystemsManager first
    if (this.systemsManager?.cardInstance) {
      return this.systemsManager.cardInstance;
    }

    // Try pipeline instance
    if (window.cblcars.debug.msd?.pipelineInstance?.cardInstance) {
      return window.cblcars.debug.msd.pipelineInstance.cardInstance;
    }

    // Try global references
    if (window._msdCardInstance) {
      return window._msdCardInstance;
    }

    if (window.cb_lcars_card_instance) {
      return window.cb_lcars_card_instance;
    }

    return null;
  }

  /**
   * Update status indicator position based on text bounding box
   * AND update attachment points to include indicator space
   * @private
   */
  _updateStatusIndicatorPosition(groupEl, textBBox) {
    try {
      if (!groupEl) return;

      // Validate textBBox - skip if invalid (text not rendered yet)
      if (!textBBox || textBBox.width <= 0 || textBBox.height <= 0) {
        cblcarsLog.trace('[AdvancedRenderer] ⏭️ Skipping status indicator update - invalid textBBox:', textBBox);
        return;
      }

      const circle = groupEl.querySelector('circle[data-decoration="status-indicator"]');
      if (!circle) return;

      const pos = circle.getAttribute('data-status-pos') || 'left-center';
      const fontSizeAttr = groupEl.getAttribute('data-font-size');

      this._safeSetCircleRadius(circle, fontSizeAttr, 0.3);

      const fontSize = parseFloat(fontSizeAttr) || 16;

      // Read overlay configuration for custom padding
      const transformInfo = RendererUtils._getSvgTransformInfo(this.mountEl);
      const pixelPadding = 8;
      const padding = transformInfo ? transformInfo.pixelToViewBox(pixelPadding) : fontSize * 0.3;
      const indicatorRadius = fontSize * 0.3;

      // Distance from text edge to circle CENTER
      const centerDistance = padding + indicatorRadius;

      // Distance from text edge to far edge of circle (for bbox expansion)
      const totalDistance = padding + (indicatorRadius * 2);

      const bbox = textBBox;
      let cx = bbox.centerX, cy = bbox.centerY;

      // Position circle CENTER at centerDistance from text edge
      switch (pos) {
        case 'top-left':     cx = bbox.left - centerDistance;  cy = bbox.top - centerDistance; break;
        case 'top-right':    cx = bbox.right + centerDistance; cy = bbox.top - centerDistance; break;
        case 'bottom-left':  cx = bbox.left - centerDistance;  cy = bbox.bottom + centerDistance; break;
        case 'bottom-right': cx = bbox.right + centerDistance; cy = bbox.bottom + centerDistance; break;
        case 'top':          cx = bbox.centerX;                cy = bbox.top - centerDistance; break;
        case 'bottom':       cx = bbox.centerX;                cy = bbox.bottom + centerDistance; break;
        case 'left':
        case 'left-center':  cx = bbox.left - centerDistance;  cy = bbox.centerY; break;
        case 'right':
        case 'right-center': cx = bbox.right + centerDistance; cy = bbox.centerY; break;
        case 'center':       cx = bbox.centerX;                cy = bbox.centerY; break;
        default:             cx = bbox.left - centerDistance;  cy = bbox.centerY;
      }
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);

      // CRITICAL FIX: Update attachment points immediately after positioning
      const overlayId = groupEl.getAttribute('data-overlay-id');
      if (overlayId && this.lastRenderArgs?.overlays) {
        const overlay = this.lastRenderArgs.overlays.find(o => o.id === overlayId);
        if (overlay) {
          let expandedBbox = { ...textBBox };

          // Expand bbox by totalDistance (to far edge of circle)
          switch (pos) {
            case 'left':
            case 'left-center':
              expandedBbox.left = Math.min(expandedBbox.left, textBBox.left - totalDistance);
              break;
            case 'right':
            case 'right-center':
              expandedBbox.right = Math.max(expandedBbox.right, textBBox.right + totalDistance);
              break;
            case 'top':
              expandedBbox.top = Math.min(expandedBbox.top, textBBox.top - totalDistance);
              break;
            case 'bottom':
              expandedBbox.bottom = Math.max(expandedBbox.bottom, textBBox.bottom + totalDistance);
              break;
            case 'top-left':
              expandedBbox.left = Math.min(expandedBbox.left, textBBox.left - totalDistance);
              expandedBbox.top = Math.min(expandedBbox.top, textBBox.top - totalDistance);
              break;
            case 'top-right':
              expandedBbox.right = Math.max(expandedBbox.right, textBBox.right + totalDistance);
              expandedBbox.top = Math.min(expandedBbox.top, textBBox.top - totalDistance);
              break;
            case 'bottom-left':
              expandedBbox.left = Math.min(expandedBbox.left, textBBox.left - totalDistance);
              expandedBbox.bottom = Math.max(expandedBbox.bottom, textBBox.bottom + totalDistance);
              break;
            case 'bottom-right':
              expandedBbox.right = Math.max(expandedBbox.right, textBBox.right + totalDistance);
              expandedBbox.bottom = Math.max(expandedBbox.bottom, textBBox.bottom + totalDistance);
              break;
          }

          // Recalculate dimensions
          expandedBbox.width = expandedBbox.right - expandedBbox.left;
          expandedBbox.height = expandedBbox.bottom - expandedBbox.top;
          expandedBbox.centerX = expandedBbox.left + expandedBbox.width / 2;
          expandedBbox.centerY = expandedBbox.top + expandedBbox.height / 2;

          // Update attachment points with expanded bbox
          const updatedAttachmentPoints = {
            id: overlay.id,
            center: [expandedBbox.centerX, expandedBbox.centerY],
            bbox: expandedBbox,
            points: {
              center: [expandedBbox.centerX, expandedBbox.centerY],
              top: [expandedBbox.centerX, expandedBbox.top],
              bottom: [expandedBbox.centerX, expandedBbox.bottom],
              left: [expandedBbox.left, expandedBbox.centerY],
              right: [expandedBbox.right, expandedBbox.centerY],
              topLeft: [expandedBbox.left, expandedBbox.top],
              topRight: [expandedBbox.right, expandedBbox.top],
              bottomLeft: [expandedBbox.left, expandedBbox.bottom],
              bottomRight: [expandedBbox.right, expandedBbox.bottom]
            }
          };

          // Store in attachment manager (single source of truth)
          this.attachmentManager.setAttachmentPoints(overlay.id, updatedAttachmentPoints);

          // Update stored expanded bbox on the DOM element for future reads
          groupEl.setAttribute('data-expanded-bbox', JSON.stringify(expandedBbox));

          // Phase 3: Line overlay attachment points are set per-instance during render
          // (line overlays call setOverlayAttachmentPoints on their own instances)

          // Phase 3: Update dependent line overlays using their instance renderers
          if (this._lineDeps && this._lineDeps.has(overlayId)) {
            const dependentLines = this._lineDeps.get(overlayId);
            dependentLines.forEach(lineId => {
              const lineOverlay = this.lastRenderArgs.overlays.find(o => o.id === lineId);
              const lineElement = this.overlayElementCache.get(lineId);
              const renderer = this.overlayRenderers.get(lineId);

              if (lineOverlay && lineElement && renderer && typeof renderer.update === 'function') {
                try {
                  renderer.update(lineElement, lineOverlay, this._sourceData);
                } catch (e) {
                  cblcarsLog.warn(`[AdvancedRenderer] Failed to update line ${lineId}:`, e);
                }
              }
            });
          }

          cblcarsLog.debug(`[AdvancedRenderer] ✅ Updated attachment points and lines for ${overlayId}`, {
            textRight: textBBox.right,
            expandedRight: expandedBbox.right,
            circleCenter: cx,
            totalDistance
          });
        }
      }

    } catch(err) {
      cblcarsLog.warn('[AdvancedRenderer] Error in _updateStatusIndicatorPosition:', err);
    }
  }

  /**
   * Safe method to set circle radius, preventing NaN errors
   * @private
   */
  _safeSetCircleRadius(circleElement, fontSize, multiplier = 0.3) {
    const parsedSize = parseFloat(fontSize);
    if (!isNaN(parsedSize) && parsedSize > 0) {
      const radius = parsedSize * multiplier;
      circleElement.setAttribute('r', radius);
    } else {
      cblcarsLog.warn(`[AdvancedRenderer] Invalid fontSize for circle radius: "${fontSize}", using fallback`);
      circleElement.setAttribute('r', '6'); // Safe fallback radius
    }
  }

  /**
   * ARCHITECTURAL FIX: Update attachment points after font stabilization using actual DOM measurements
   * @private
   */
  _updateTextAttachmentPointsAfterStabilization(overlay, groupEl, textBbox, viewBox) {
    if (!overlay || !groupEl || !textBbox) return;

    // Validate textBbox - skip if invalid (text not rendered yet or during font load)
    if (textBbox.width <= 0 || textBbox.height <= 0) {
      cblcarsLog.trace(`[AdvancedRenderer] ⏭️ Skipping attachment point update after stabilization for ${overlay.id} - invalid textBbox:`, textBbox);
      return;
    }

    try {
      // Create expanded bbox that includes decorations (status indicator, etc.)
      let expandedBbox = {
        left: textBbox.left,
        right: textBbox.right,
        top: textBbox.top,
        bottom: textBbox.bottom,
        width: textBbox.width,
        height: textBbox.height,
        centerX: textBbox.centerX,
        centerY: textBbox.centerY
      };

      // Check for status indicator and expand bbox
      const statusIndicator = groupEl.querySelector('[data-decoration="status-indicator"]');
      if (statusIndicator) {
        const fontSizeAttr = groupEl.getAttribute('data-font-size');
        const fontSize = parseFloat(fontSizeAttr) || 16;

        // Read actual configuration from overlay style
        const overlayStyle = overlay.finalStyle || overlay.style || {};
        const configuredSize = overlayStyle.status_indicator_size;
        const configuredPadding = overlayStyle.status_indicator_padding;

        const indicatorSize = configuredSize !== null && configuredSize !== undefined ?
          configuredSize : fontSize * 0.3;

        // Get proper padding calculation
        const transformInfo = RendererUtils._getSvgTransformInfo(this.mountEl);
        const pixelPadding = configuredPadding !== null && configuredPadding !== undefined ?
          configuredPadding : 8;
        const padding = transformInfo ? transformInfo.pixelToViewBox(pixelPadding) : indicatorSize;

        const position = statusIndicator.getAttribute('data-status-pos') || 'left-center';

        // Expand bbox based on indicator position
        const totalSpace = padding + (indicatorSize * 2);
        switch (position) {
          case 'left':
          case 'left-center':
            expandedBbox.left = Math.min(expandedBbox.left, textBbox.left - totalSpace);
            break;
          case 'right':
          case 'right-center':
            expandedBbox.right = Math.max(expandedBbox.right, textBbox.right + totalSpace);
            break;
          case 'top':
            expandedBbox.top = Math.min(expandedBbox.top, textBbox.top - totalSpace);
            break;
          case 'bottom':
            expandedBbox.bottom = Math.max(expandedBbox.bottom, textBbox.bottom + totalSpace);
            break;
          case 'top-left':
            expandedBbox.left = Math.min(expandedBbox.left, textBbox.left - totalSpace);
            expandedBbox.top = Math.min(expandedBbox.top, textBbox.top - totalSpace);
            break;
          case 'top-right':
            expandedBbox.right = Math.max(expandedBbox.right, textBbox.right + totalSpace);
            expandedBbox.top = Math.min(expandedBbox.top, textBbox.top - totalSpace);
            break;
          case 'bottom-left':
            expandedBbox.left = Math.min(expandedBbox.left, textBbox.left - totalSpace);
            expandedBbox.bottom = Math.max(expandedBbox.bottom, textBbox.bottom + totalSpace);
            break;
          case 'bottom-right':
            expandedBbox.right = Math.max(expandedBbox.right, textBbox.right + totalSpace);
            expandedBbox.bottom = Math.max(expandedBbox.bottom, textBbox.bottom + totalSpace);
            break;
        }

        // Recalculate dimensions
        expandedBbox.width = expandedBbox.right - expandedBbox.left;
        expandedBbox.height = expandedBbox.bottom - expandedBbox.top;
        expandedBbox.centerX = expandedBbox.left + expandedBbox.width / 2;
        expandedBbox.centerY = expandedBbox.top + expandedBbox.height / 2;
      }

      // Create updated attachment points using the expanded bbox
      const updatedAttachmentPoints = {
        id: overlay.id,
        center: [expandedBbox.centerX, expandedBbox.centerY],
        bbox: expandedBbox,
        points: {
          center: [expandedBbox.centerX, expandedBbox.centerY],
          top: [expandedBbox.centerX, expandedBbox.top],
          bottom: [expandedBbox.centerX, expandedBbox.bottom],
          left: [expandedBbox.left, expandedBbox.centerY],
          right: [expandedBbox.right, expandedBbox.centerY],
          topLeft: [expandedBbox.left, expandedBbox.top],
          topRight: [expandedBbox.right, expandedBbox.top],
          bottomLeft: [expandedBbox.left, expandedBbox.bottom],
          bottomRight: [expandedBbox.right, expandedBbox.bottom]
        }
      };

      // Store in attachment manager (single source of truth)
      this.attachmentManager.setAttachmentPoints(overlay.id, updatedAttachmentPoints);

      // Phase 3: Line overlay attachment points are set per-instance during render
      // (line overlays call setOverlayAttachmentPoints on their own instances)

      // Phase 3: Line overlays handle their own routing cache invalidation
      // No need to manually invalidate global routing cache

    } catch (error) {
      cblcarsLog.warn(`[AdvancedRenderer] Error updating attachment points after stabilization for ${overlay.id}:`, error);
    }
  }



  /**
   * ✅ NEW: Phase 5.3 - Get performance summary for current render
   * @private
   * @returns {Object} Performance summary
   */
  _getPerformanceSummary() {
    const overlayTimingsArray = Array.from(this._performance.overlayTimings.entries())
      .map(([id, data]) => ({
        overlay_id: id,
        type: data.type,
        duration_ms: data.duration
      }))
      .sort((a, b) => b.duration_ms - a.duration_ms);

    return {
      total_render_time_ms: this._performance.totalRenderTime,
      overlay_count: this._performance.overlayCount,
      average_per_overlay_ms: this._performance.overlayCount > 0
        ? this._performance.totalRenderTime / this._performance.overlayCount
        : 0,
      stages: {
        preparation_ms: this._performance.stages.preparation,
        overlay_rendering_ms: this._performance.stages.overlayRendering,
        dom_injection_ms: this._performance.stages.domInjection,
        action_attachment_ms: this._performance.stages.actionAttachment
      },
      overlay_timings: overlayTimingsArray,
      slowest_overlays: overlayTimingsArray.slice(0, 5),
      timestamp: this._performance.lastRenderTimestamp
    };
  }

  /**
   * ✅ NEW: Phase 5.3 - Get performance data for a specific overlay
   * @param {string} overlayId - Overlay ID
   * @returns {Object|null} Performance data for the overlay
   */
  getOverlayPerformance(overlayId) {
    const timing = this._performance.overlayTimings.get(overlayId);
    if (!timing) return null;

    return {
      overlay_id: overlayId,
      type: timing.type,
      duration_ms: timing.duration,
      percentage_of_total: (timing.duration / this._performance.totalRenderTime * 100).toFixed(1)
    };
  }

  /**
   * ✅ NEW: Phase 5.3 - Get slowest overlays
   * @param {number} count - Number of slowest overlays to return
   * @returns {Array} Array of slowest overlay performance data
   */
  getSlowestOverlays(count = 5) {
    return Array.from(this._performance.overlayTimings.entries())
      .map(([id, data]) => ({
        overlay_id: id,
        type: data.type,
        duration_ms: data.duration,
        percentage_of_total: (data.duration / this._performance.totalRenderTime * 100).toFixed(1)
      }))
      .sort((a, b) => b.duration_ms - a.duration_ms)
      .slice(0, count);
  }

  /**
   * ✅ NEW: Phase 5.3 - Get performance by overlay type
   * @returns {Object} Performance data grouped by overlay type
   */
  getPerformanceByType() {
    const byType = {};

    this._performance.overlayTimings.forEach((data, id) => {
      const type = data.type;
      if (!byType[type]) {
        byType[type] = {
          count: 0,
          total_ms: 0,
          average_ms: 0,
          overlays: []
        };
      }

      byType[type].count++;
      byType[type].total_ms += data.duration;
      byType[type].overlays.push({
        id,
        duration_ms: data.duration
      });
    });

    // Calculate averages
    Object.keys(byType).forEach(type => {
      byType[type].average_ms = byType[type].total_ms / byType[type].count;
    });

    return byType;
  }

  /**
   * ✅ NEW: Phase 5.3 - Check if any overlays exceed performance thresholds
   * @returns {Object} Performance warnings
   */
  getPerformanceWarnings() {
    const warnings = [];
    const SLOW_OVERLAY_THRESHOLD = 50; // ms
    const SLOW_TOTAL_THRESHOLD = 200; // ms

    // Check total render time
    if (this._performance.totalRenderTime > SLOW_TOTAL_THRESHOLD) {
      warnings.push({
        type: 'slow_total_render',
        severity: 'warning',
        message: `Total render time (${this._performance.totalRenderTime.toFixed(2)}ms) exceeds threshold (${SLOW_TOTAL_THRESHOLD}ms)`,
        value: this._performance.totalRenderTime,
        threshold: SLOW_TOTAL_THRESHOLD
      });
    }

    // Check individual overlays
    this._performance.overlayTimings.forEach((data, id) => {
      if (data.duration > SLOW_OVERLAY_THRESHOLD) {
        warnings.push({
          type: 'slow_overlay',
          severity: 'warning',
          message: `Overlay '${id}' (${data.type}) took ${data.duration.toFixed(2)}ms to render`,
          overlay_id: id,
          overlay_type: data.type,
          value: data.duration,
          threshold: SLOW_OVERLAY_THRESHOLD
        });
      }
    });

    return {
      has_warnings: warnings.length > 0,
      count: warnings.length,
      warnings: warnings.sort((a, b) => (b.value || 0) - (a.value || 0))
    };
  }

}