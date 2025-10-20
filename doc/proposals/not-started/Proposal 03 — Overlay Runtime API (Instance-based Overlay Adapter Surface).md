# Proposal 03 — Overlay Runtime API (Instance-based Overlay Adapter Surface)

Version: 1.0.0  
Date: 2025-10-20  
Author: CB-LCARS MSD Team (drafted by @snootched via Copilot Space)

Status: Proposed — Not Started

---

Table of contents
- Summary
- Motivation (why we need an instance overlay API)
- Goals and non-goals
- Design principles & constraints (shadowRoot, anime.js v4, streaming-first)
- The Overlay API (surface and responsibilities)
  - Lifecycle methods
  - Data contracts and return shapes
  - Event / subscription and cleanup model
  - Attachment point contract
  - Provenance & diagnostics surface
  - Capabilities descriptor
- Integration points (AdvancedRenderer, BaseRenderer, BaseOverlayUpdater, SystemsManager, DataSourceManager, RulesEngine)
- Animations & anime.js v4 (scope/timeline guidance)
- Migration rationale — benefits of incremental migration
- High-level migration plan (phases, milestones)
  - Phase A: Add OverlayBase and static shim
  - Phase B: Migrate low-risk renderers (Text, Button)
  - Phase C: Migrate complex renderers (Line, StatusGrid, ApexCharts)
  - Phase D: New D3/canvas overlays (Sankey, Topology, Heatmap)
  - Phase E: Polish, performance, docs, Packs
- Acceptance criteria
- Risks & mitigations
- Estimated effort
- Appendix: short examples and notes

---

Summary

Introduce a formal, instance-based Overlay Runtime API (OverlayBase) that standardizes lifecycle, rendering, incremental updates, attachment point computation and cleanup for MSD overlays. The API is lightweight and intentionally backwards-compatible via a static shim so existing static renderers continue to function while new and migrated overlays can use instance state (D3 simulations, canvas contexts, anime.js timelines, subscriptions) safely and correctly inside Home Assistant shadowRoots.

This proposal explains what the API is, why we should adopt it, and provides a high-level, low-risk migration plan.

---

Motivation

Current renderer ecosystem in src/msd already has strong primitives:
- BaseRenderer (theme/token helpers, provenance),
- AdvancedRenderer orchestration,
- Several overlay renderers (TextOverlayRenderer, ButtonOverlayRenderer, LineOverlayRenderer, StatusGridRenderer, ApexChartsOverlayRenderer),
- Updater layer (BaseOverlayUpdater) and SystemsManager.

However, more advanced overlays we want to add (Sankey, force-directed topology, gradient heatmap, radar scanner, waveforms) require persistent instance state:
- ongoing D3 force simulations,
- canvas contexts and pixel buffers,
- animation timelines (anime.js v4 Scopes/Timelines),
- incremental streaming subscriptions and unsubscribes.

Static-only renderers make it awkward to manage lifecycle, store simulation state, or clean up timers and animation scopes inside a shadowRoot. An instance-based overlay API solves these problems while preserving existing static flows via a compatibility shim.

---

Goals and non-goals

Goals
- Provide a stable instance lifecycle for overlays: initialize, render, update, computeAttachmentPoints, destroy.
- Keep backwards compatibility: existing static renderers continue to operate unchanged while migration is gradual.
- Make advanced overlays (D3, canvas, anime) manageable and safe within shadowRoot constraints.
- Integrate with BaseRenderer (tokens, theme, provenance) and the pipeline (mountEl, systemsManager).
- Provide a small standard event/subscription pattern for cleanup.

Non-goals
- Immediate simultaneous rewrite of all renderers.
- Forcing all overlays to switch; migration must be incremental.
- Creating a heavyweight framework—API must be minimal and pragmatic.

---

Design principles & constraints

- Respect shadowRoot boundaries: overlays must render into the mount element provided by the pipeline (AdvancedRenderer.mountEl). No document-level queries for overlay internals.
- Use anime.js v4 only (Scopes, Timelines). Provide centralized helper wrappers on window.cblcars.anim to create scoped timelines that target elements inside shadowRoot.
- Prefer lazy/dynamic imports for heavy libs (d3-sankey, d3-force) to keep initial bundle size small.
- Keep the API tiny and aligned with existing BaseRenderer: reuse style resolution, token resolution, and provenance helpers.
- Provide an incremental migration path: static renderers continue to work; AdvancedRenderer should detect instance-capable overlays and call the new API when present.
- Overlays must clean up subscriptions and animation scopes on destroy to avoid leaks.

---

The Overlay API — surface and responsibilities

A single overlay adapter surface that all overlays should implement. Minimal methods and expected shapes are below. (Names are suggestions; final method names may be tuned.)

Lifecycle methods (instance)
- async initialize(mountEl, systemsManager)
  - Called once when overlay instance is first used.
  - Receives mountEl (shadowRoot mount or same container AdvancedRenderer provides) and systemsManager for DataSourceManager, RulesEngine, etc.
  - Should create canvas, D3 contexts, and anime timelines here.
  - May register subscriptions and call this._registerSubscription(unsubscribeFn) for cleanup.

- render(overlay, anchors, viewBox, svgContainer, cardInstance = null)
  - Called to produce initial markup for this overlay using provided resolved overlay config.
  - Must return an object:
    - { markup: string, actionInfo?: object, overlayId?: string, metadata?: object, provenance?: object }
  - Markup should render within provided svgContainer mount (or be suitable for insertion into AdvancedRenderer overlay group).
  - Should use instance state (D3 simulation, canvas) as needed.

- update(overlayElement, overlay, sourceData = null)
  - Called when DataSource or HA entity updates and overlay should perform minimal DOM changes.
  - overlayElement is the cached DOM group returned by AdvancedRenderer.
  - sourceData is optional DataSourceManager change payload.
  - Should return boolean true if DOM changed.

- computeAttachmentPoints(overlay, anchors, container, viewBox = null)
  - Compute and return attachment points for lines/anchors. Return shape:
    - { id, center: [x,y], points: { left, right, top, bottom, topLeft, ... }, bbox: {left,top,right,bottom,width,height} }
  - Text overlay already has such an implementation; other overlays should provide accurate geometry for line anchoring.

- destroy()
  - Cleanup everything: canvas contexts, D3 simulations, anime timelines, subscriptions.
  - Called when overlay removed or pipeline destroyed.

Static shim
- static async renderStatic(overlay, anchors, viewBox, svgContainer, cardInstance = null, mountEl = null, systemsManager = null)
  - Convenience: create an instance internally, call initialize, call render, attach provenance if missing and return result.
  - This keeps AdvancedRenderer's current static call pattern working while enabling instance usage going forward.

Event / subscription and cleanup model
- Overlays may register subscriptions with DataSourceManager or timers. Provide helper on overlay instances:
  - this._registerSubscription(unsubscribeFn) — AdvancedRenderer / base class will call all to clean up on destroy.
- For anime.js timelines and D3 internals, overlays should register cleanup functions.

Attachment point contract
- computeAttachmentPoints must return consistent coordinates in viewBox units consistent with AdvancedRenderer's expectations. This allows robust overlay-to-overlay connections using LineOverlayRenderer and RouterCore.

Provenance & diagnostics
- Overlays should use BaseRenderer._getRendererProvenance to produce structured provenance metadata (style sources, defaults used, features, render time). The instance overlay should add any instance-specific data (e.g., D3 nodes count, canvas size, animation timeline active).

Capabilities descriptor
- Provide a small getCapabilities() object to advertise features (attachment points, animations, incremental updates, streaming data). Eg:
  - { actions: true, attachmentPoints: true, animations: true, dynamicUpdate: true }

---

Integration points

- AdvancedRenderer
  - Detects if overlayClass has static renderStatic or if overlayClass.prototype.render exists and calls accordingly.
  - Continue phased rendering approach (early text phase → other overlays) but prefer instance render when available.
  - Should not search document; pass mountEl / svgContainer to overlays.

- BaseRenderer
  - OverlayBase extends BaseRenderer to reuse token/theme helpers, provenance, and style resolution.

- BaseOverlayUpdater
  - Will continue to call renderer update paths. If renderer exposes update(overlayElement,...), BaseOverlayUpdater should prefer that for lightweight updates.

- SystemsManager / DataSourceManager / RulesEngine
  - Overlay instances use systemsManager to subscribe to DataSourceManager for streaming updates (instances must register unsubcribers).
  - RulesEngine remains canonical for conditional logic and inter-overlay communication. Overlays can emit events into RulesEngine (via systemsManager) which will in turn produce overlay patches.

- Animation helpers
  - Provide window.cblcars.anim helpers for creating scoped timelines and basic LCARS animation patterns (scanner sweep, pulsing, flow).

---

Animations & anime.js v4 guidance

- Always use anime.js v4 syntax. Do not use v3 patterns like 'targets' inside options object. Instead call anime({ targets, ... }) with targets as an explicit parameter if the wrapper expects it.
- Use anime.Scope and anime.timeline for per-overlay timelines. Create scope in initialize(), store on instance, and call scope.add()/scope.pause()/scope.seek() as needed.
- Provide helper factory on window.cblcars.anim:
  - createScopedTimeline({ mountEl }) → returns timeline bound to mountEl shadowRoot and with cleanup helper.
- Overlays must register scope cleanup in destroy().
- All animation configuration should be driven by overlay.style or overlay.finalStyle and be tokenized so themes control speeds/colors.

---

Why migrate — benefits

- Instance state: D3 simulations, canvas contexts and animations require instance lifetimes. Migration unlocks Sankey, topology, heatmaps, radar scanner, waveforms.
- Resource management: Timers, animation timelines and subscriptions can be registered and reliably cleaned up, avoiding memory leaks and duplicated listeners across re-renders.
- Better incremental update: update() allows us to update only parts of the DOM (text nodes, chart series) without rebuilding whole overlays, improving performance on low-power devices and mobile.
- Cleaner animations: using per-instance anime scopes avoids conflicts and supports shadowRoot-friendly animation targets.
- Reuse and testing: standardizing lifecycle simplifies testing and makes new overlay development consistent.

---

High-level migration plan (incremental, low-risk)

Principles:
- Small, reversible steps.
- Keep existing behavior unchanged until a renderer is migrated and validated.
- Provide automated tests and visual checks per phase.

Phase A — foundation (1 week)
- Add OverlayBase class in src/msd/overlays/OverlayBase.js (thin adapter that extends BaseRenderer, implements lifecycle helpers, subscription registry, static renderStatic shim).
- Update AdvancedRenderer to prefer overlayClass.renderStatic(...) if available. Keep fallback to current static renderers to preserve behavior.
- Add small developer docs in doc/developer/overlay-api.md describing API and examples.
- Add a short migration example showing TextOverlayRenderer usage (no code migration yet) in docs.

Phase B — migrate low-risk overlays (1–2 weeks)
- Migrate TextOverlayRenderer to extend OverlayBase and implement instance render + static renderStatic shim.
- Migrate ButtonOverlayRenderer similarly; ensure updateButtonData hooks into instance.update.
- Validate: lots of visuals; ensure AdvancedRenderer uses new path and actions attach correctly.

Phase C — migrate interactive renderers (2–3 weeks)
- Migrate LineOverlayRenderer to instance model so it can cache routing caches, markers, and animation scopes. Replace module-level caches with instance properties where appropriate.
- Migrate StatusGridRenderer and make its cell ButtonRenderer calls compatible with instance ButtonRenderer update path.
- Add tests for attachment points changes, deferred line refresh and font stabilization passes.

Phase D — new complex overlays (4–8 weeks, parallel)
- Implement instance-based D3 adapters:
  - SankeyOverlay (d3-sankey) as instance with D3 render simulation & animation timeline.
  - TopologyOverlay (d3-force) with simulation lifecycle controls (start/stop/tick).
  - HeatmapGradientOverlay (canvas) managing pixel buffer and interpolation; provide off-thread option via WebWorker if needed later.
  - RadarScannerOverlay (SVG + anime.js scope).
- Each overlay to use dynamic import for d3 modules to keep bundle small.
- Provide Packs examples (energy-pack, network-pack).

Phase E — polish, docs, packs, performance (2–3 weeks)
- Update BaseOverlayUpdater and other pipeline items to use new overlay instance features for incremental updates.
- Add overlay dev docs, example YAMLs, testing harness, and visual regression tests (screenshots).
- Release and monitor.

Total rough timeline: 10–16 weeks if carried in parallel across multiple engineers. With a single engineer more like 12–20 weeks.

---

Acceptance criteria

- OverlayBase present in repo and AdvancedRenderer calls renderStatic when available without breaking existing renderers.
- At least two renderers migrated to instance model (Text + Button) with identical visual output and functional parity.
- Instance lifecycle allows proper cleanup of animation scopes and subscriptions (no leaks after repeated mount/unmount).
- D3/canvas overlay prototypes run inside shadowRoot without document queries and use anime.js v4 scopes.
- BaseOverlayUpdater uses renderer.update(...) where available to perform minimal DOM updates.
- Documentation added (developer overlay API doc, examples).

---

Risks & mitigations

Risk: Breaking existing renderers or actions attachment.
- Mitigation: Keep static shim; AdvancedRenderer fallback; migrate renderers one-by-one and test.

Risk: Increased complexity for contributors.
- Mitigation: keep API small and documented; provide examples and template overlays.

Risk: Bundle size increases (d3).
- Mitigation: dynamic import of d3 submodules only when overlay used.

Risk: Misuse of document queries causing shadowRoot issues.
- Mitigation: strict guidance in docs: always render into provided mountEl/container; use anime scope helpers.

---

Estimated effort

- Phase A (foundation): 2–4 days
- Phase B (text/button migration): 1–2 weeks
- Phase C (line/grid): 2–3 weeks
- Phase D (D3 overlays): 4–8 weeks (parallelizable)
- Phase E (docs/tests/packs): 1–2 weeks

These estimates assume one developer; can be shortened if work is parallelized.

---

Appendix: short YAML and usage notes

YAML (high-level overlay declaring a Sankey overlay that will use the new instance overlay)
```yaml
overlays:
  - id: energy_flow
    type: sankey        # SankeyOverlay (instance)
    position: [60, 120]
    size: [700, 320]
    nodes:
      - id: solar; label: "Solar"; entity: sensor.solar_power
      - id: battery; label: "Battery"; entity: sensor.battery_power
    flows:
      - from: solar; to: battery; value: sensor.solar_to_battery
    style:
      node_color: colors.accent.primary
      animate: true
```

Notes:
- AdvancedRenderer will pass mountEl + systemsManager; overlay instance will create D3 simulation and lifecycle.
- Animations driven by style keys will be configured in overlay.style and passed into overlay.initialize/render so instance can wire a scoped anime.timeline using window.cblcars.anim helpers.

---

Conclusion

A compact instance-based Overlay Runtime API solves multiple pressing challenges: correct lifecycle and resource management for advanced visualizations, safe animation within shadowRoot using anime.js v4 scopes, improved incremental updates for better performance on constrained devices, and a clear migration path that preserves current behaviour. The migration plan minimizes risk and keeps development momentum while enabling the high-value Sankey, topology, and gradient heatmap overlays you want for LCARS.

If you approve, next steps I can take:
- Add the OverlayBase.js scaffold to the repository and a short developer doc.
- Produce the small AdvancedRenderer patch to prefer renderStatic when present (non-breaking).
- Draft the PR to migrate TextOverlayRenderer to the instance API as the first migration example.

Which of the three next steps would you like me to do first?














```javascript
/**
 * OverlayBase - standardized overlay lifecycle & adapter surface
 *
 * Purpose:
 * - Provide a single, stable lifecycle and API that all overlay renderers
 *   implement/extend. This formalizes the implicit contract already used
 *   by AdvancedRenderer, BaseOverlayUpdater, and individual overlay renderers.
 * - Keep it lightweight and non-breaking: existing renderers can be migrated
 *   incrementally. The file intentionally builds on BaseRenderer so we keep
 *   existing theme / style / provenance helpers.
 *
 * Usage:
 * - New overlay renderers should extend OverlayBase and implement:
 *     - async initialize(mountEl, systemsManager)
 *     - render(overlay, anchors, viewBox, svgContainer, cardInstance)
 *     - update(overlayElement, overlay, sourceData)
 *     - computeAttachmentPoints(overlay, anchors, container, viewBox)
 *     - destroy()
 *
 * - AdvancedRenderer should prefer calling instance.render(...) via the
 *   static shim below (OverlayBase.renderStatic) to preserve backwards compatibility.
 *
 * Notes:
 * - This file is intended as the canonical overlay adapter surface. It does
 *   not force a rewrite of existing renderers; instead it provides a stable
 *   base to simplify future work (D3 adapters, canvas overlays, animations).
 *
 * @author CB-LCARS MSD Team
 * @copyright 2025
 */

import BaseRenderer from '../renderer/BaseRenderer.js';
import { cblcarsLog } from '../utils/cb-lcars-logging.js';

/**
 * OverlayBase
 * @extends BaseRenderer
 */
export class OverlayBase extends BaseRenderer {
  constructor() {
    super();
    this.rendererName = 'OverlayBase';

    // Systems-bound things (injected on initialize)
    this.mountEl = null; // DOM mount element provided by pipeline (shadowRoot etc)
    this.systemsManager = null; // reference for DataSourceManager, RulesEngine, etc.

    // Default container/viewBox context - set by AdvancedRenderer as needed
    this.container = null;
    this.viewBox = null;

    // Internal subscriptions / handles for cleanup
    this._subscriptions = [];
    this._initialized = false;
  }

  /**
   * Initialize overlay instance with mount element and systems manager.
   * Optional to implement by subclass; default stores references.
   *
   * @param {Element} mountEl - DOM element where overlay should render (shadowRoot mount)
   * @param {Object} systemsManager - Systems manager (dataSourceManager, rulesEngine, etc)
   * @returns {Promise<void>}
   */
  async initialize(mountEl, systemsManager) {
    this._resetTracking();
    this._startRenderTiming();

    this.mountEl = mountEl || null;
    this.systemsManager = systemsManager || (mountEl && mountEl.systemsManager) || null;

    // Default container resolution - subclasses can override
    this.container = this._resolveContainerElement();
    this._initialized = true;

    this._logDebug('Initialized overlay base', { mountEl: !!mountEl, hasSystems: !!this.systemsManager });
  }

  /**
   * Instance render method - MUST be overridden by subclass.
   *
   * Subclass should return:
   *  { markup: string, actionInfo?: object, overlayId?: string, metadata?: object, provenance?: object }
   *
   * AdvancedRenderer will wrap returned result and attach group attributes.
   *
   * @abstract
   * @param {Object} overlay - overlay config (resolved)
   * @param {Object} anchors - computed anchors map
   * @param {Array<number>} viewBox - [x, y, w, h]
   * @param {Element} svgContainer - element used for measuring and insertion
   * @param {Object|null} cardInstance - optional card instance for action processing
   * @returns {Object}
   */
  render(overlay, anchors, viewBox, svgContainer, cardInstance = null) {
    throw new Error(`${this.rendererName}.render() not implemented by subclass`);
  }

  /**
   * Static compatibility shim. AdvancedRenderer and other callers can call
   * OverlayClass.renderStatic(...) which will create a per-call instance,
   * call initialize if needed, and call instance.render(...), then augment
   * the result with provenance using BaseRenderer helpers.
   *
   * This pattern preserves the current "static render" usage while allowing
   * instance state in overlays.
   *
   * @param {Object} overlay - overlay config
   * @param {Object} anchors
   * @param {Array<number>} viewBox
   * @param {Element} svgContainer
   * @param {Object|null} cardInstance
   * @param {Element|null} mountEl
   * @param {Object|null} systemsManager
   * @returns {Promise<Object>}
   */
  static async renderStatic(overlay, anchors, viewBox, svgContainer, cardInstance = null, mountEl = null, systemsManager = null) {
    // 'this' is the subclass constructor
    const inst = new this();
    try {
      await inst.initialize(mountEl, systemsManager);
    } catch (e) {
      cblcarsLog.warn(`[OverlayBase] initialize() failed for ${overlay?.id || '<unknown>'}:`, e);
      // proceed - some overlays may not need initialize
    }

    // Ensure instance has container/viewBox so BaseRenderer helpers work
    inst.container = svgContainer || inst.container;
    inst.viewBox = viewBox || inst.viewBox;

    // Call render; catch errors and return fallback structure
    try {
      const result = await inst.render(overlay, anchors, viewBox, svgContainer, cardInstance) || {};
      // Attach provenance if not provided by subclass
      if (result && !result.provenance) {
        result.provenance = inst._getRendererProvenance(overlay?.id || '<unknown>', {
          overlay_type: overlay?.type || '<unknown>'
        });
      }
      return result;
    } catch (error) {
      cblcarsLog.error(`[OverlayBase] render() threw for ${overlay?.id || '<unknown>'}:`, error);
      return {
        markup: '',
        actionInfo: null,
        overlayId: overlay?.id,
        provenance: inst._getRendererProvenance(overlay?.id || '<unknown>', {
          overlay_type: overlay?.type || '<unknown>',
          error: String(error)
        })
      };
    }
  }

  /**
   * Update overlay DOM when DataSource or HA entity changes.
   * Subclasses should override to perform minimal DOM updates.
   *
   * @param {Element} overlayElement - cached DOM group for overlay
   * @param {Object} overlay - overlay config
   * @param {Object|null} sourceData - DataSource payload if available
   * @returns {boolean} true if DOM was mutated
   */
  update(overlayElement, overlay, sourceData = null) {
    // Default: no-op. Subclasses override.
    return false;
  }

  /**
   * Compute attachment points for overlay used by line overlays.
   * Subclasses can override with precise computations (text overlay already does).
   *
   * Return shape:
   * { id, center: [x,y], points: { left: [x,y], right:..., top:..., bottom:..., topLeft:..., ... }, bbox: {left, top, right, bottom, width, height} }
   *
   * @param {Object} overlay
   * @param {Object} anchors
   * @param {Element} container
   * @param {Array|null} viewBox
   * @returns {Object|null}
   */
  computeAttachmentPoints(overlay, anchors, container, viewBox = null) {
    // Default: resolve center from overlay.position (use OverlayUtils in callers)
    try {
      // Basic center position fallback
      if (!overlay || !overlay.position) return null;
      const pos = overlay.position;
      // pos may be [x,y] absolute already computed by AdvancedRenderer; return it
      if (Array.isArray(pos) && pos.length === 2) {
        const cx = pos[0], cy = pos[1];
        return {
          id: overlay.id,
          center: [cx, cy],
          points: { center: [cx, cy] },
          bbox: { left: cx, top: cy, right: cx, bottom: cy, width: 0, height: 0 }
        };
      }
      return null;
    } catch (e) {
      this._logWarn('computeAttachmentPoints fallback failed', e);
      return null;
    }
  }

  /**
   * Destroy and cleanup subscriptions created by the overlay.
   * Subclasses should call super.destroy() at end to clear subscriptions.
   */
  destroy() {
    // Unsubscribe any registered subscriptions
    try {
      this._subscriptions.forEach(fn => {
        try { fn(); } catch (_) {}
      });
    } catch (e) {}
    this._subscriptions = [];
    this._initialized = false;
    this._logDebug('Destroyed overlay instance');
  }

  /**
   * Helper: register a subscription/unsubscribe function for cleanup
   * @param {Function} unsubscribeFn
   */
  _registerSubscription(unsubscribeFn) {
    if (typeof unsubscribeFn === 'function') this._subscriptions.push(unsubscribeFn);
  }

  /**
   * Helper: provide a simple default capabilities descriptor.
   * Override in subclasses that support special features.
   *
   * @returns {Object}
   */
  getCapabilities() {
    return {
      actions: true,
      attachmentPoints: true,
      animations: true,
      dynamicUpdate: true
    };
  }
}

export default OverlayBase;
```
