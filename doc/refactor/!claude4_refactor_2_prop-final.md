The revised proposal **completely supersedes** the original analysis. The key strategic shift from "bridging" to "complete port" changes everything about implementation priorities and approach. You only need the converged proposal below.

# **CB-LCARS MSD v1 Complete Port Implementation Plan**
## **Strategic Migration from src/utils to src/msd Architecture**

**Date**: August 23, 2025
**Author**: CB-LCARS Development Team
**Status**: 🟢 **Ready for Implementation**
**Strategy**: **Complete Port** (not bridging) - Replace old `src/utils/` MSD code entirely

---

## **Executive Summary**

This implementation plan provides a **complete migration strategy** to port all MSD functionality from the legacy `src/utils/` architecture to the new `src/msd/` architecture. The goal is **feature parity with complete code replacement** - no dual system maintenance.

### **Key Strategic Decisions**

1. **Complete Port Strategy**: Replace old files entirely, don't bridge them
2. **Single API Namespace**: `window.cblcars.msd.api.*` controlled by feature flags
3. **Clean Cutover**: Remove `src/utils/` MSD files after migration complete
4. **Feature Parity Priority**: All existing functionality must work identically

### **Current Architecture Assessment**

**✅ Solid Foundation (New Architecture in `src/msd/`)**
- Pipeline: `initMsdPipeline()` and `processMsdConfig()`
- Rules Engine: Comprehensive replacement for `state_resolver`
- Router & Renderer: `RouterCore` and `AdvancedRenderer`
- YAML Schema: MSD_SCHEMA_V1_Ratified.yaml covers all features
- Debug API: `window.__msdDebug` infrastructure

**❌ Missing Critical Components (Need Complete Port)**
- **Real-time Data Subscriptions**: Port `cb-lcars-data.js` functionality
- **Debug Visualization**: Port `cb-lcars-debug-helpers.js` anchor/overlay markers
- **HUD System**: Port essential functionality from `cb-lcars-dev-hud-monolithic.js`
- **Introspection API**: Port `cb-lcars-introspection.js` overlay inspection
- **Controls Integration**: Port `cb-lcars-controls-helpers.js` HA card embedding

---

## **Phase 1: Core Data Layer & Real-time Updates (Weeks 1-2)**
### **Priority**: 🔴 **CRITICAL - Blocking sparklines/ribbons**

#### **Milestone 1.1: Complete DataSource Port**

```javascript name=src/msd/data/MsdDataSource.js
/**
 * Complete port of cb-lcars-data.js DataSource functionality
 * Provides real-time Home Assistant entity subscriptions with performance optimizations
 */
export class MsdDataSource {
  constructor(cfg, hass) {
    this.cfg = { ...cfg };
    this.hass = hass;

    // PORT: Complete buffer and timing logic from old DataSource
    let wsSec = 60;
    if (typeof cfg.windowSeconds === 'number' && isFinite(cfg.windowSeconds)) {
      wsSec = Math.max(1, cfg.windowSeconds);
    } else if (typeof cfg.windowSeconds === 'string') {
      const ms = parseTimeWindowMs(cfg.windowSeconds);
      if (Number.isFinite(ms)) wsSec = Math.max(1, Math.floor(ms / 1000));
    }
    const cap = Math.max(60, Math.floor(wsSec * 10));
    this.buffer = new RollingBuffer(cap);

    // PORT: Complete coalescing/throttling config
    const minEmitMs = Number.isFinite(cfg.minEmitMs) ? cfg.minEmitMs
      : Number.isFinite(cfg.sampleMs) ? cfg.sampleMs : 100;

    this.minEmitMs = Math.max(10, minEmitMs);
    this.coalesceMs = Number.isFinite(cfg.coalesceMs)
      ? Math.max(30, cfg.coalesceMs)
      : Math.max(30, Math.round(this.minEmitMs * 0.6));
    this.maxDelayMs = Number.isFinite(cfg.maxDelayMs)
      ? Math.max(this.minEmitMs, cfg.maxDelayMs)
      : Math.max(this.minEmitMs, this.coalesceMs * 4);

    this.subscribers = new Set();
    this.unsub = null;

    // PORT: Complete internal state from old implementation
    this._lastEmit = 0;
    this._pendingRaf = 0;
    this._pending = false;
    this._pendingFirstTs = 0;
    this._pendingCount = 0;
    this._stats = {
      emits: 0,
      coalesced: 0,
      skipsSame: 0,
      receive: 0,
      invalid: 0
    };
  }

  async start() {
    // PORT: History preload logic
    if (this.cfg.history?.preload) {
      try {
        await this._preloadHistory();
        if (this.buffer.last()) this._ensureSchedule();
      } catch (_) {}
    }
    await this._subscribeLive();
  }

  async _subscribeLive() {
    // EXACT PORT: Home Assistant subscription logic
    if (!this.hass?.connection?.subscribeEvents || !this.cfg.entity) return;
    const entityId = this.cfg.entity;
    this.unsub = await this.hass.connection.subscribeEvents((ev) => {
      const e = ev?.data?.new_state;
      if (!e || e.entity_id !== entityId) return;
      const ts = new Date(e.last_changed || e.last_updated || Date.now()).getTime();
      const raw = this.cfg.attribute ? e.attributes?.[this.cfg.attribute] : e.state;
      const val = this._toNumber(raw);
      this._onRawEventValue(ts, val);
    }, 'state_changed');
  }

  subscribe(cb) {
    this.subscribers.add(cb);
    // Immediate hydration
    const last = this.buffer.last();
    if (last) cb({ t: last.t, v: last.v, buffer: this.buffer });
    return () => this.subscribers.delete(cb);
  }

  // PORT: Complete performance optimization logic
  _onRawEventValue(ts, val) {
    if (val === null) {
      this._stats.invalid++;
      return;
    }
    this.buffer.push(ts, val);
    this._stats.receive++;

    const now = performance.now();
    if (!this._pending) {
      this._pending = true;
      this._pendingFirstTs = now;
      this._pendingCount = 1;
      this._ensureSchedule();
    } else {
      this._pendingCount++;
      const timeSinceFirst = now - this._pendingFirstTs;
      if (timeSinceFirst < this.coalesceMs) {
        this._stats.coalesced++;
      }
    }
  }

  // ... PORT: Complete _ensureSchedule, _frameCheck, _emit methods from old implementation
}
```

#### **Milestone 1.2: DataSourceManager**

```javascript name=src/msd/data/DataSourceManager.js
/**
 * Manages data source lifecycle for the new MSD pipeline
 * Replaces window.cblcars.data integration
 */
export class DataSourceManager {
  constructor(hass) {
    this.hass = hass;
    this.sources = new Map(); // Own data sources, not bridging to old system
    this.overlaySubscriptions = new Map();
  }

  async initializeFromConfig(dataSourceConfigs) {
    // Create all data sources from YAML config
    const promises = Object.entries(dataSourceConfigs || {}).map(async ([name, config]) => {
      return this.createDataSource(name, config);
    });

    await Promise.all(promises);
  }

  async createDataSource(name, config) {
    if (this.sources.has(name)) {
      return this.sources.get(name);
    }

    const source = new MsdDataSource(config, this.hass);
    this.sources.set(name, source);
    await source.start();
    return source;
  }

  subscribeOverlay(overlay, updateCallback) {
    const subscriptions = [];

    if (overlay.type === 'sparkline' && overlay.source) {
      const source = this.sources.get(overlay.source);
      if (source) {
        const unsubscribe = source.subscribe((data) => {
          updateCallback(overlay, { sourceData: data });
        });
        subscriptions.push(unsubscribe);
      }
    }

    if (overlay.type === 'ribbon' && overlay.sources) {
      for (const sourceName of overlay.sources) {
        const source = this.sources.get(sourceName);
        if (source) {
          const unsubscribe = source.subscribe((data) => {
            updateCallback(overlay, { sourceData: data, sourceName });
          });
          subscriptions.push(unsubscribe);
        }
      }
    }

    if (subscriptions.length > 0) {
      this.overlaySubscriptions.set(overlay.id, subscriptions);
    }
  }

  unsubscribeOverlay(overlayId) {
    const subscriptions = this.overlaySubscriptions.get(overlayId);
    if (subscriptions) {
      subscriptions.forEach(unsub => {
        try { unsub(); } catch (e) {}
      });
      this.overlaySubscriptions.delete(overlayId);
    }
  }

  destroy() {
    // Clean shutdown of all data sources
    for (const source of this.sources.values()) {
      source.stop();
    }
    for (const [overlayId] of this.overlaySubscriptions) {
      this.unsubscribeOverlay(overlayId);
    }
  }
}
```

#### **Milestone 1.3: Enhanced AdvancedRenderer with Real-time Data**

```javascript name=src/msd/renderer/AdvancedRenderer.js
// Enhanced version with data source integration
export class AdvancedRenderer {
  constructor(container, router, hass) {
    // ... existing constructor
    this.hass = hass;
    this.dataSourceManager = new DataSourceManager(hass);
    this.overlayElements = new Map();
  }

  async render(resolvedModel) {
    // Initialize data sources from config
    if (resolvedModel.dataSources) {
      await this.dataSourceManager.initializeFromConfig(resolvedModel.dataSources);
    }

    // Render all overlays
    for (const overlay of resolvedModel.overlays) {
      const element = this.renderOverlay(overlay);
      this.overlayElements.set(overlay.id, element);

      // Subscribe data-driven overlays to real-time updates
      if (this.isDataDrivenOverlay(overlay)) {
        this.dataSourceManager.subscribeOverlay(overlay, (overlay, data) => {
          this.updateOverlayData(overlay, data);
        });
      }
    }

    // NEW: Debug layer integration
    if (this.shouldRenderDebug()) {
      const debugRenderer = new MsdDebugRenderer(this.container, resolvedModel.viewBox);
      debugRenderer.render(resolvedModel, this.getDebugFlags());
    }
  }

  updateOverlayData(overlay, data) {
    const element = this.overlayElements.get(overlay.id);
    if (!element) return;

    if (overlay.type === 'sparkline') {
      this.updateSparklineData(element, overlay, data.sourceData);
    } else if (overlay.type === 'ribbon') {
      this.updateRibbonData(element, overlay, data.sourceData, data.sourceName);
    }
  }

  updateSparklineData(element, overlay, sourceData) {
    // PORT: Complete sparkline update logic from cb-lcars-overlay-helpers.js
    const { buffer } = sourceData;
    const msWindow = this.parseTimeWindow(overlay.windowSeconds);
    const slice = buffer.sliceSince ? buffer.sliceSince(msWindow) : buffer;

    // PORT: All existing performance optimizations
    const t = slice.t || [], v = slice.v || [];
    if (!t.length) return;

    const points = this.generateSparklinePoints(slice, overlay);
    const pathEl = element.querySelector('path');
    if (pathEl && points.length) {
      pathEl.setAttribute('d', this.pathFromPoints(points));

      // PORT: All sparkline features - markers, labels, smooth curves, area fill
      this.updateSparklineMarkers(element, points);
      this.updateSparklineLastLabel(element, points, overlay);

      // Reveal after geometry update
      if (pathEl.hasAttribute('data-cblcars-pending')) {
        pathEl.removeAttribute('data-cblcars-pending');
      }
      pathEl.style.visibility = '';
    }
  }

  isDataDrivenOverlay(overlay) {
    return overlay.type === 'sparkline' || overlay.type === 'ribbon';
  }

  shouldRenderDebug() {
    const flags = this.getDebugFlags();
    return flags && (flags.overlay || flags.connectors || flags.geometry);
  }

  getDebugFlags() {
    return window.cblcars?._debugFlags || {};
  }
}
```

---

## **Phase 2: Debug Infrastructure & Visualization (Weeks 2-3)**
### **Priority**: 🟡 **High - Essential for development workflow**

#### **Milestone 2.1: Complete Debug System Port**

```javascript name=src/msd/debug/MsdDebugRenderer.js
/**
 * Complete port of cb-lcars-debug-helpers.js functionality
 * Provides anchor markers, overlay bounding boxes, connector guidelines
 */
export class MsdDebugRenderer {
  constructor(container, viewBox) {
    this.container = container;
    this.viewBox = viewBox;
    this.debugLayer = null;
  }

  render(resolvedModel, debugFlags) {
    if (!this.shouldRender(debugFlags)) return;

    this.ensureDebugLayer();
    this.debugLayer.innerHTML = '';

    // PORT: Complete debug rendering from cb-lcars-debug-helpers.js
    if (debugFlags.overlay) {
      this.renderAnchorMarkers(resolvedModel.anchors);
      this.renderOverlayBoundingBoxes(resolvedModel.overlays);
      this.renderValidationBadge(resolvedModel);
    }

    if (debugFlags.connectors) {
      this.renderConnectorGuidelines(resolvedModel.overlays);
    }

    if (debugFlags.geometry) {
      this.runGeometrySelfTest();
    }
  }

  ensureDebugLayer() {
    if (this.debugLayer) return;

    const svg = this.container.querySelector('svg');
    if (!svg) return;

    this.debugLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.debugLayer.setAttribute('id', 'cblcars-debug-layer');
    this.debugLayer.style.pointerEvents = 'none';
    svg.appendChild(this.debugLayer);
  }

  renderAnchorMarkers(anchors) {
    // EXACT PORT: Green circles and labels for anchors
    const r = Math.max(2, Math.round(this.viewBox[3] * 0.007));
    let html = '';

    for (const [name, pt] of Object.entries(anchors || {})) {
      if (!Array.isArray(pt) || pt.length < 2) continue;

      // Green circle
      html += `<circle cx="${pt[0]}" cy="${pt[1]}" r="${r}"
               fill="#00ff0050" stroke="#00ff00" stroke-width="1"/>`;

      // Anchor label
      html += `<text x="${pt[0]+r+2}" y="${pt[1]}"
               font-size="${r*2}" fill="#00ff00" font-family="monospace">${name}</text>`;
    }

    this.debugLayer.innerHTML += html;
  }

  renderOverlayBoundingBoxes(overlays) {
    // EXACT PORT: Pale blue rectangles around overlay elements
    let html = '';

    for (const overlay of overlays) {
      const bbox = MsdIntrospection.getOverlayBBox(overlay.id, this.container);
      if (bbox && (bbox.w > 0 || bbox.h > 0)) {
        html += `<rect x="${bbox.x}" y="${bbox.y}" width="${bbox.w}" height="${bbox.h}"
                 fill="none" stroke="#00bfff" stroke-width="1" opacity="0.7"
                 stroke-dasharray="2,2"/>`;

        // Overlay ID label
        html += `<text x="${bbox.x}" y="${bbox.y-2}"
                 font-size="10" fill="#00bfff" font-family="monospace">${overlay.id}</text>`;
      }
    }

    this.debugLayer.innerHTML += html;
  }

  renderConnectorGuidelines(overlays) {
    // EXACT PORT: Magenta dashed lines and endpoint markers
    let html = '';

    const lineOverlays = overlays.filter(o => o.type === 'line');
    for (const overlay of lineOverlays) {
      if (overlay.attach_to) {
        // PORT: Complete connector debugging visualization
        const guideline = this.computeConnectorGuideline(overlay);
        if (guideline) {
          html += `<path d="${guideline.path}"
                   stroke="#ff00ff" stroke-width="1" opacity="0.8"
                   stroke-dasharray="3,2" fill="none"/>`;

          // Endpoint marker
          html += `<circle cx="${guideline.endpoint[0]}" cy="${guideline.endpoint[1]}"
                   r="3" fill="#ff00ff" opacity="0.8"/>`;
        }
      }
    }

    this.debugLayer.innerHTML += html;
  }

  shouldRender(debugFlags) {
    return debugFlags && (debugFlags.overlay || debugFlags.connectors || debugFlags.geometry);
  }
}
```

#### **Milestone 2.2: Complete Introspection System Port**

```javascript name=src/msd/introspection/MsdIntrospection.js
/**
 * Complete port of cb-lcars-introspection.js functionality
 * Provides overlay inspection, highlighting, and geometry utilities
 */
export class MsdIntrospection {
  static getOverlaysSvg(root) {
    return root?.querySelector?.('#msd_svg_overlays svg') ||
           root?.querySelector?.('#cblcars-msd-wrapper svg') || null;
  }

  static listOverlays(root) {
    // EXACT PORT: Complete overlay listing from cb-lcars-introspection.js
    const out = [];
    const svg = this.getOverlaysSvg(root);
    if (!svg) return out;

    // Get resolved model from new pipeline
    const resolvedModel = root.__msdResolvedModel || {};
    const overlaysById = new Map((resolvedModel.overlays || []).map(o => [o.id, o]));

    let nodes = Array.from(svg.querySelectorAll('[id][data-cblcars-root="true"]'));
    if (!nodes.length) {
      nodes = Array.from(svg.querySelectorAll('[id]'))
        .filter(n => n.id && n.id !== 'cblcars-debug-layer' && n.id !== 'cblcars-highlight-layer');
    }

    for (const n of nodes) {
      const id = n.id;
      const overlay = overlaysById.get(id);
      const bbox = this.getOverlayBBox(id, root);

      out.push({
        id,
        type: overlay?.type || n.getAttribute('data-cblcars-type') || n.tagName.toLowerCase(),
        bbox,
        hasErrors: false, // TODO: Integration with validation system
        hasWarnings: false
      });
    }

    return out;
  }

  static getOverlayBBox(id, root) {
    // EXACT PORT: Complete bbox calculation with all fallbacks
    if (!id || !root) return null;

    // 1) Try SVG element getBBox
    let el = root.getElementById?.(id);
    if (el) {
      const isSvg = !!el.namespaceURI && String(el.namespaceURI).includes('svg');
      if (isSvg && typeof el.getBBox === 'function') {
        try {
          const gbb = el.getBBox();
          if (gbb && Number.isFinite(gbb.width) && Number.isFinite(gbb.height) && (gbb.width > 0 || gbb.height > 0)) {
            return { x: gbb.x, y: gbb.y, w: gbb.width, h: gbb.height };
          }
        } catch (_) {}
      } else {
        // HTML control overlay: map via inverse CTM
        const svg = MsdGeometry.getReferenceSvg(root);
        const pxRect = el.getBoundingClientRect?.();
        if (svg && pxRect && pxRect.width > 0 && pxRect.height > 0) {
          const vbRect = MsdGeometry.screenRectToViewBox(svg, pxRect);
          if (vbRect) return vbRect;
        }
      }
    }

    // 2) Ribbon fallback: backdrop element
    const backdrop = root.getElementById?.(`${id}_backdrop`);
    if (backdrop && typeof backdrop.getBBox === 'function') {
      try {
        const bb2 = backdrop.getBBox();
        if (bb2 && (bb2.width > 0 || bb2.height > 0)) {
          return { x: bb2.x, y: bb2.y, w: bb2.width, h: bb2.height };
        }
      } catch (_) {}
    }

    // 3) Config fallback: compute from overlay position + size
    const resolvedModel = root.__msdResolvedModel || {};
    const overlay = resolvedModel.overlays?.find(o => o.id === id);
    if (overlay && overlay.position && overlay.size) {
      const anchors = resolvedModel.anchors || {};
      const vb = resolvedModel.viewBox || [0, 0, 100, 100];
      const pos = this.resolvePointFromConfig(overlay.position, anchors, vb);
      const sz = this.resolveSizeFromConfig(overlay.size, vb);
      if (pos && sz) {
        return { x: pos[0], y: pos[1], w: sz.w, h: sz.h };
      }
    }

    return null;
  }

  static highlight(ids, opts = {}) {
    // EXACT PORT: Visual overlay highlighting system
    const list = Array.isArray(ids) ? ids : [ids];
    const root = opts.root || document;

    const svg = MsdGeometry.getReferenceSvg(root);
    if (!svg) return;

    const vb = MsdGeometry.getViewBox(root, svg) || [0, 0, 100, 100];
    const color = opts.color || '#ffcc00';
    const strokeWidth = Number.isFinite(opts.strokeWidth) ? opts.strokeWidth : Math.max(1.5, Math.round(vb[3] * 0.004));
    const duration = Math.max(250, opts.duration || 1500);

    // Ensure highlight layer
    let g = svg.querySelector('#cblcars-highlight-layer');
    if (!g) {
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', 'cblcars-highlight-layer');
      g.style.pointerEvents = 'none';
      svg.appendChild(g);
    }

    let html = '';
    for (const id of list) {
      const bb = this.getOverlayBBox(id, root);
      if (bb) {
        html += `<rect x="${bb.x}" y="${bb.y}" width="${bb.w}" height="${bb.h}"
                 fill="none" stroke="${color}" stroke-width="${strokeWidth}" opacity="0.9"/>`;
      }
    }

    g.innerHTML = html;

    // Auto-clear after duration
    setTimeout(() => {
      if (g.parentNode) g.innerHTML = '';
    }, duration);
  }

  // PORT: Helper methods for point/size resolution
  static resolvePointFromConfig(position, anchors = {}, viewBox = [0, 0, 400, 200]) {
    const [minX, minY, vw, vh] = viewBox;
    if (!position) return null;
    if (typeof position === 'string' && anchors[position]) return anchors[position];
    if (Array.isArray(position) && position.length === 2) {
      const r = (v, axis) =>
        typeof v === 'string' && v.trim().endsWith('%')
          ? axis === 'x'
            ? minX + (parseFloat(v) / 100) * vw
            : minY + (parseFloat(v) / 100) * vh
          : Number(v);
      const x = r(position[0], 'x');
      const y = r(position[1], 'y');
      if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
    }
    return null;
  }

  static resolveSizeFromConfig(size, viewBox = [0, 0, 400, 200]) {
    if (!Array.isArray(size) || size.length !== 2) return null;
    const [, , vw, vh] = viewBox;
    const toDim = (val, max) =>
      typeof val === 'string' && val.trim().endsWith('%') ? (parseFloat(val) / 100) * max : Number(val);
    const w = toDim(size[0], vw);
    const h = toDim(size[1], vh);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
    return { w, h };
  }
}
```

---

## **Phase 3: HUD System Port (Week 3)**
### **Priority**: 🟡 **High - Development workflow essential**

#### **Milestone 3.1: Essential HUD Manager**

```javascript name=src/msd/hud/MsdHudManager.js
/**
 * Essential HUD functionality ported from cb-lcars-dev-hud-monolithic.js
 * Focus on core development features: performance, validation, routing
 */
export class MsdHudManager {
  constructor() {
    this.state = {
      visible: false,
      collapsed: false,
      position: null,
      interval: 3000
    };
    this.refreshTimer = null;
    this.lastSnapshot = null;
    this.panels = new Map();

    // Performance state
    this.perfCounters = new Map();
    this.perfTimers = new Map();
  }

  show() {
    this.state.visible = true;
    this.loadPersistedState();
    this.ensureMounted();
    this.startRefreshLoop();

    // Immediate refresh
    this.refresh();
  }

  hide() {
    this.state.visible = false;
    this.stopRefreshLoop();
    const mount = this.getMount();
    if (mount) mount.style.display = 'none';
  }

  toggle() {
    this.state.visible ? this.hide() : this.show();
  }

  refresh() {
    const snapshot = this.buildSnapshot();
    if (snapshot) {
      this.lastSnapshot = snapshot;
      this.renderPanels(snapshot);
    }
  }

  buildSnapshot() {
    // PORT: Essential snapshot building from old HUD
    const pipelineInstance = window.__msdDebug?.pipelineInstance;
    if (!pipelineInstance) return null;

    const resolvedModel = pipelineInstance.getResolvedModel?.();

    return {
      timestamp: Date.now(),
      timestampIso: new Date().toISOString(),

      // Performance data
      performance: {
        timers: this.captureTimerData(),
        counters: this.captureCounterData()
      },

      // Routing data
      routing: this.captureRoutingData(resolvedModel),

      // Validation data
      validation: this.captureValidationData(),

      // Pipeline state
      pipeline: {
        overlayCount: resolvedModel?.overlays?.length || 0,
        anchorCount: Object.keys(resolvedModel?.anchors || {}).length,
        ruleCount: resolvedModel?.rules?.length || 0
      }
    };
  }

  captureTimerData() {
    // PORT: Performance timer collection
    const timers = {};
    try {
      const perfData = window.__msdDebug?.getPerf?.() || {};
      if (perfData.timers) {
        Object.entries(perfData.timers).forEach(([key, data]) => {
          timers[key] = {
            count: data.count || 0,
            total: data.total || 0,
            avg: data.count > 0 ? (data.total / data.count) : 0,
            last: data.last || 0,
            max: data.max || 0
          };
        });
      }
    } catch (_) {}
    return timers;
  }

  captureCounterData() {
    // PORT: Performance counter collection
    const counters = {};
    try {
      const perfData = window.__msdDebug?.getPerf?.() || {};
      if (perfData.counters) {
        Object.entries(perfData.counters).forEach(([key, value]) => {
          counters[key] = Number(value) || 0;
        });
      }
    } catch (_) {}
    return counters;
  }

  captureRoutingData(resolvedModel) {
    // PORT: Basic routing inspection
    const routes = [];
    try {
      const lineOverlays = resolvedModel?.overlays?.filter(o => o.type === 'line') || [];
      for (const overlay of lineOverlays.slice(0, 10)) { // Limit to prevent UI bloat
        const routeInfo = window.__msdDebug?.routing?.inspect?.(overlay.id);
        if (routeInfo) {
          routes.push({
            id: overlay.id,
            strategy: routeInfo.meta?.strategy || 'unknown',
            cost: routeInfo.meta?.cost || 0,
            success: routeInfo.meta?.success !== false
          });
        }
      }
    } catch (_) {}
    return { routes, count: routes.length };
  }

  captureValidationData() {
    // PORT: Validation issue collection
    const issues = [];
    try {
      const validation = window.__msdDebug?.validation?.issues?.() || [];
      validation.forEach(issue => {
        issues.push({
          severity: issue.severity || 'error',
          message: issue.message || String(issue),
          code: issue.code || null
        });
      });
    } catch (_) {}
    return { issues, count: issues.length };
  }

  renderPanels(snapshot) {
    const mount = this.getMount();
    if (!mount) return;

    // Simple HTML generation (no framework)
    let html = this.buildHeaderHtml(snapshot);
    html += this.buildPerformancePanelHtml(snapshot.performance);
    html += this.buildRoutingPanelHtml(snapshot.routing);
    html += this.buildValidationPanelHtml(snapshot.validation);

    mount.innerHTML = html;
  }

  buildHeaderHtml(snapshot) {
    return `
      <div class="msd-hud-header">
        <span class="msd-hud-title">MSD v1 HUD</span>
        <span class="msd-hud-timestamp">${new Date(snapshot.timestamp).toLocaleTimeString()}</span>
        <button onclick="window.__msdDebug?.hud?.hide?.()">×</button>
      </div>
    `;
  }

  buildPerformancePanelHtml(performance) {
    let html = '<div class="msd-hud-panel"><h3>Performance</h3>';

    // Timers
    const timers = Object.entries(performance.timers).slice(0, 8);
    if (timers.length > 0) {
      html += '<div class="msd-hud-section"><h4>Timers</h4>';
      timers.forEach(([key, data]) => {
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">${key}</span>
          <span class="msd-hud-metric-value">${data.avg.toFixed(2)}ms avg</span>
        </div>`;
      });
      html += '</div>';
    }

    // Counters
    const counters = Object.entries(performance.counters).slice(0, 8);
    if (counters.length > 0) {
      html += '<div class="msd-hud-section"><h4>Counters</h4>';
      counters.forEach(([key, value]) => {
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">${key}</span>
          <span class="msd-hud-metric-value">${value}</span>
        </div>`;
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  // ... Additional panel rendering methods

  startRefreshLoop() {
    this.stopRefreshLoop();
    this.refreshTimer = setInterval(() => {
      if (this.state.visible) {
        this.refresh();
      }
    }, this.state.interval);
  }

  stopRefreshLoop() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  getMount() {
    return document.querySelector('#msd-hud-root') || this.createMount();
  }

  createMount() {
    // Create HUD mount point with basic styling
    const mount = document.createElement('div');
    mount.id = 'msd-hud-root';
    mount.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 2147480000;
      background: rgba(20, 0, 40, 0.95); border: 1px solid #ff00ff;
      border-radius: 8px; color: #ffffff; font-family: monospace;
      font-size: 11px; min-width: 280px; max-width: 400px;
    `;
    document.body.appendChild(mount);
    return mount;
  }
}
```

---

## **Phase 4: Controls Integration & API Finalization (Week 4)**
### **Priority**: 🟡 **High - Control overlays and API cleanup**

#### **Milestone 4.1: Controls System Port**

```javascript name=src/msd/controls/MsdControlsRenderer.js
/**
 * Complete port of cb-lcars-controls-helpers.js functionality
 * Handles Home Assistant card embedding with precise CTM positioning
 */
export class MsdControlsRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    this.controlElements = new Map();
    this.controlsContainer = null;
  }

  async renderControls(controlOverlays, resolvedModel) {
    if (!controlOverlays.length) return;

    this.ensureControlsContainer();

    // PORT: Complete controls rendering logic
    for (const overlay of controlOverlays) {
      await this.renderControlOverlay(overlay, resolvedModel);
    }

    // Store args for relayout capability
    this.storeLastRenderArgs(controlOverlays, resolvedModel);
  }

  async renderControlOverlay(overlay, resolvedModel) {
    // PORT: Complete HA card embedding from cb-lcars-controls-helpers.js
    const controlElement = await this.createControlElement(overlay);

    if (controlElement) {
      this.positionControlElement(controlElement, overlay, resolvedModel);
      this.controlElements.set(overlay.id, controlElement);
    }
  }

  async createControlElement(overlay) {
    // PORT: HA card creation logic
    if (!overlay.card) return null;

    try {
      const cardElement = document.createElement(overlay.card.type);
      if (overlay.card.config && cardElement.setConfig) {
        cardElement.setConfig(overlay.card.config);
      }

      // Set hass context
      if (this.renderer.hass && cardElement.hass !== undefined) {
        cardElement.hass = this.renderer.hass;
      }

      return cardElement;
    } catch (error) {
      console.warn(`[MSD Controls] Failed to create card ${overlay.card.type}:`, error);
      return null;
    }
  }

  positionControlElement(element, overlay, resolvedModel) {
    // PORT: CTM-based positioning from old controls system
    const position = this.resolvePosition(overlay.position, resolvedModel);
    const size = this.resolveSize(overlay.size, resolvedModel);

    if (position && size) {
      // Convert viewBox coordinates to CSS pixels using CTM
      const css = this.mapViewBoxRectToHostCss(
        { x: position[0], y: position[1], w: size.w, h: size.h },
        resolvedModel
      );

      if (css) {
        element.style.position = 'absolute';
        element.style.left = css.left;
        element.style.top = css.top;
        element.style.width = css.width;
        element.style.height = css.height;
        element.style.zIndex = overlay.z_index || 1000;
      }
    }

    this.controlsContainer.appendChild(element);
  }

  mapViewBoxRectToHostCss(vbRect, resolvedModel) {
    // PORT: CTM transformation logic
    try {
      const svg = this.renderer.container.querySelector('svg');
      if (!svg) return null;

      const ctm = svg.getScreenCTM();
      if (!ctm) return null;

      // Transform viewBox coordinates to screen coordinates
      const topLeft = svg.createSVGPoint();
      topLeft.x = vbRect.x;
      topLeft.y = vbRect.y;
      const screenTopLeft = topLeft.matrixTransform(ctm);

      const bottomRight = svg.createSVGPoint();
      bottomRight.x = vbRect.x + vbRect.w;
      bottomRight.y = vbRect.y + vbRect.h;
      const screenBottomRight = bottomRight.matrixTransform(ctm);

      return {
        left: `${screenTopLeft.x}px`,
        top: `${screenTopLeft.y}px`,
        width: `${screenBottomRight.x - screenTopLeft.x}px`,
        height: `${screenBottomRight.y - screenTopLeft.y}px`
      };
    } catch (error) {
      console.warn('[MSD Controls] CTM transformation failed:', error);
      return null;
    }
  }

  ensureControlsContainer() {
    if (this.controlsContainer) return;

    this.controlsContainer = document.createElement('div');
    this.controlsContainer.id = 'msd-controls-container';
    this.controlsContainer.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none; z-index: 1000;
    `;

    // Enable pointer events on children
    this.controlsContainer.addEventListener('pointerdown', (e) => {
      e.target.style.pointerEvents = 'auto';
    });

    this.renderer.container.appendChild(this.controlsContainer);
  }

  // PORT: Relayout capability for dynamic updates
  relayout() {
    if (this.lastRenderArgs) {
      this.renderControls(this.lastRenderArgs.overlays, this.lastRenderArgs.resolvedModel);
    }
  }

  storeLastRenderArgs(overlays, resolvedModel) {
    this.lastRenderArgs = { overlays, resolvedModel };
  }

  destroy() {
    for (const [id, element] of this.controlElements) {
      element.remove();
    }
    this.controlElements.clear();

    if (this.controlsContainer) {
      this.controlsContainer.remove();
      this.controlsContainer = null;
    }
  }
}
```

#### **Milestone 4.2: Unified API Structure**

```javascript name=src/msd/api/MsdApi.js
/**
 * Unified API structure for window.cblcars.msd.api
 * Feature flag controlled - replaces old introspection API when enabled
 */
export class MsdApi {
  static attach() {
    if (!isMsdV1Enabled()) return;

    if (typeof window !== 'undefined') {
      window.cblcars = window.cblcars || {};

      // COMPLETE TAKEOVER of msd namespace when V1 enabled
      window.cblcars.msd = {
        // New structured API
        api: {
          overlays: {
            list: (root) => MsdIntrospection.listOverlays(root || document),
            highlight: (ids, opts) => MsdIntrospection.highlight(ids, opts),
            getBBox: (id, root) => MsdIntrospection.getOverlayBBox(id, root || document),
            update: (id, data) => this.updateOverlay(id, data)
          },

          anchors: {
            list: () => Object.keys(window.__msdDebug?.pipelineInstance?.cardModel?.anchors || {}),
            get: (id) => window.__msdDebug?.pipelineInstance?.cardModel?.anchors?.[id],
            set: (id, x, y) => window.__msdDebug?.pipelineInstance?.setAnchor?.(id, [x, y]),
            dump: () => ({ ...window.__msdDebug?.pipelineInstance?.cardModel?.anchors })
          },

          debug: {
            showAnchors: () => this.setDebugFlag('overlay', true),
            showOverlays: () => this.setDebugFlag('overlay', true),
            showConnectors: () => this.setDebugFlag('connectors', true),
            showGeometry: () => this.setDebugFlag('geometry', true),
            clear: () => this.clearDebugFlags()
          },

          performance: {
            dump: () => window.__msdDebug?.getPerf?.() || {},
            counters: () => window.__msdDebug?.getPerf?.()?.counters || {},
            timers: () => window.__msdDebug?.getPerf?.()?.timers || {}
          },

          pipeline: {
            getResolvedModel: () => window.__msdDebug?.pipelineInstance?.getResolvedModel?.(),
            reRender: () => window.__msdDebug?.pipelineInstance?.reRender?.(),
            validate: () => window.__msdDebug?.validation?.issues?.() || []
          }
        },

        // Backward compatibility aliases (temporary - remove after migration)
        listOverlays: (root) => MsdIntrospection.listOverlays(root),
        listAnchors: (root) => MsdIntrospection.listAnchors(root),
        getOverlayBBox: (id, root) => MsdIntrospection.getOverlayBBox(id, root),
        highlight: (ids, opts) => MsdIntrospection.highlight(ids, opts)
      };
    }
  }

  static updateOverlay(id, data) {
    // Future: Dynamic overlay updates
    console.warn('[MSD API] Dynamic overlay updates not yet implemented');
  }

  static setDebugFlag(flag, value) {
    if (window.cblcars?.debug?.setFlags) {
      window.cblcars.debug.setFlags({ [flag]: value });
    }
  }

  static clearDebugFlags() {
    if (window.cblcars?.debug?.setFlags) {
      window.cblcars.debug.setFlags({
        overlay: false,
        connectors: false,
        geometry: false
      });
    }
  }
}
```

---

## **Integration Points & File Migration**

### **Files to Create (Complete Port)**
```
NEW FILES (src/msd/):

Core Data Layer:
- src/msd/data/DataSourceManager.js
- src/msd/data/MsdDataSource.js
- src/msd/data/RollingBuffer.js (utility)

Debug Infrastructure:
- src/msd/debug/MsdDebugRenderer.js
- src/msd/introspection/MsdIntrospection.js
- src/msd/geometry/MsdGeometry.js (utilities)

HUD System:
- src/msd/hud/MsdHudManager.js
- src/msd/hud/panels/PerformancePanel.js
- src/msd/hud/panels/RoutingPanel.js
- src/msd/hud/panels/ValidationPanel.js

Controls Integration:
- src/msd/controls/MsdControlsRenderer.js

API Structure:
- src/msd/api/MsdApi.js
```

### **Files to Remove (After Cutover)**
```
OLD FILES (src/utils/) - Remove after migration:

- src/utils/cb-lcars-data.js → REPLACED by MsdDataSource + DataSourceManager
- src/utils/cb-lcars-overlay-helpers.js → REPLACED by enhanced AdvancedRenderer
- src/utils/cb-lcars-debug-helpers.js → REPLACED by MsdDebugRenderer
- src/utils/cb-lcars-introspection.js → REPLACED by MsdIntrospection
- src/utils/cb-lcars-dev-hud-monolithic.js → REPLACED by MsdHudManager
- src/utils/cb-lcars-controls-helpers.js → REPLACED by MsdControlsRenderer
```

### **Files to Keep (Non-MSD utilities)**
```
KEEP (General utilities):
- src/utils/cb-lcars-geometry-utils.js
- src/utils/cb-lcars-logging.js
- src/utils/cb-lcars-style-helpers.js
- src/utils/cb-lcars-animation-*.js
```

---

## **Feature Flag Controlled Cutover**

### **Phase 1: Parallel Development**
```javascript
// src/msd/index.js - Feature flag controls system selection
const MSD_V1_ENABLE = window.CBLCARS_MSD_V1_ENABLE ||
                     localStorage.getItem('CBLCARS_MSD_V1_ENABLE') === 'true';

if (MSD_V1_ENABLE) {
  // NEW: Complete src/msd/ implementation
  await initMsdPipeline(userMsdConfig, mountEl);
  MsdApi.attach(); // Takes over window.cblcars.msd namespace
} else {
  // OLD: Existing src/utils/ implementation continues
}
```

### **Phase 2: Default Flip**
```javascript
// When feature parity achieved
const MSD_V1_DEFAULT = true;

if (MSD_V1_DEFAULT && !window.CBLCARS_MSD_V1_DISABLE) {
  // NEW is default
  await initMsdPipeline(userMsdConfig, mountEl);
  MsdApi.attach();
} else {
  // OLD (opt-in only with warning)
  console.warn('[CB-LCARS] Using legacy MSD implementation - will be removed');
}
```

### **Phase 3: Complete Removal**
```javascript
// Remove all old code - only new implementation
await initMsdPipeline(userMsdConfig, mountEl);
MsdApi.attach();
```

---

## **Success Criteria & Validation**

### **Functional Parity Checklist**
- [ ] **All 6 overlay types render correctly**: text, line, sparkline, ribbon, free, control
- [ ] **Real-time data subscriptions work**: Sparklines update from HA entities with same performance
- [ ] **Debug visualization functional**: Anchor markers, overlay bounding boxes, connector guidelines
- [ ] **Controls layer integrated**: HA card embedding with pixel-perfect CTM positioning
- [ ] **HUD provides development workflow**: Performance monitoring, routing inspection, validation display
- [ ] **API compatibility maintained**: All existing `window.cblcars.msd.*` calls work
- [ ] **Performance parity**: 60fps with 100+ overlays, memory usage equivalent

### **Migration Validation Tests**
1. **Load existing YAML configurations** - no changes required
2. **Compare rendering pixel-perfect** - screenshot diff testing
3. **Performance benchmarks** - same or better FPS and memory
4. **API compatibility** - all existing console commands work
5. **Debug workflow** - development features match old system

---

## **Implementation Timeline**

### **Week 1: Core Data & Rendering**
- **Days 1-2**: MsdDataSource complete port with all performance optimizations
- **Days 3-4**: DataSourceManager and AdvancedRenderer integration
- **Days 5-7**: Sparkline real-time updates working with ribbon basics

### **Week 2: Debug Infrastructure**
- **Days 1-3**: MsdDebugRenderer complete port (anchors, overlays, connectors)
- **Days 4-5**: MsdIntrospection complete port with all bbox fallbacks
- **Days 6-7**: Integration with AdvancedRenderer, debug flags working

### **Week 3: HUD & Performance**
- **Days 1-4**: MsdHudManager essential functionality (performance, validation)
- **Days 5-7**: Routing inspection, snapshot system, refresh loops

### **Week 4: Controls & Finalization**
- **Days 1-3**: MsdControlsRenderer complete port with CTM positioning
- **Days 4-5**: MsdApi unified structure, namespace takeover
- **Days 6-7**: Feature parity validation, cutover preparation

---

This implementation plan provides a **complete migration strategy** that replaces all legacy MSD functionality with a clean, maintainable architecture in `src/msd/`. The feature flag system allows safe parallel development and controlled cutover, while maintaining full backward compatibility during the transition.