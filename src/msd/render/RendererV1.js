import { perfTime, perfInc } from '../perf/PerfCounters.js';

// Helper: always return an object so raw.position access is safe
function safeRaw(ov) {
  if (!ov) return {};
  return ov._raw || ov.raw || {};
}

export class RendererV1 {
  constructor(rootEl, router) {
    this.rootEl = rootEl;
    this.router = router; // NEW
    this._mounted = false;
    this._overlayEls = new Map();
    this._lineCache = new Map();
    this._debugLoggedOnce = false;
    this._lastRenderedLineIds = [];
    this._renderAnchorsLoggedOnce = false;
    this._adoptedExternalViewBox = false;
    this._mountHost = null;          // resolved element that owns size (wrapper or host)
    this._pendingReparent = true;    // until we confirm final wrapper
    this._mountObserver = null;
    this._aspectFromExternal = null;
    this._showLineLabels = false; // debug toggle
  }

  _tryResolveMountHost() {
    if (this._mountHost && !this._pendingReparent) return;
    let host = this.rootEl;

    // If shadow root → prefer #cblcars-msd-wrapper inside it, else its host element
    if (host && host.nodeType === 11) {
      const wrapper = host.getElementById && host.getElementById('cblcars-msd-wrapper');
      if (wrapper) {
        host = wrapper;
        this._pendingReparent = false;
      } else {
        host = host.host || host; // fall back to host element
      }
    }

    // If host not an element yet (unlikely), abort
    if (!host || host.nodeType !== 1) return;

    // Observe for wrapper arrival if still pending
    if (this._pendingReparent && !this._mountObserver && this.rootEl?.getRootNode) {
      try {
        const sr = this.rootEl.getRootNode();
        if (sr && sr.nodeType === 11) {
          this._mountObserver = new MutationObserver(() => {
            const wrapper = sr.getElementById('cblcars-msd-wrapper');
            if (wrapper) {
              this._pendingReparent = false;
              if (this.container && this.container.parentNode !== wrapper) {
                wrapper.appendChild(this.container);
                console.info('[MSD v1] Reparented v1 container into base wrapper');
                this._ensureSizing(wrapper);
              }
              this._mountObserver.disconnect();
              this._mountObserver = null;
            }
          });
          this._mountObserver.observe(sr, { childList: true, subtree: true });
        }
      } catch {}
    }

    this._mountHost = host;
    this._ensureSizing(host);
  }

  _ensureSizing(host) {
    if (!host || host.nodeType !== 1) return;
    try {
      if (host.style && !host.style.position) host.style.position = 'relative';
      // If host has zero height but known viewBox/aspect, derive a height.
      const vb = this._externalViewBoxOverride || this._lastViewBox || [0,0,400,200];
      const aspect = vb[2] / (vb[3] || 1);
      const rect = host.getBoundingClientRect();
      if (rect.height === 0 && rect.width > 0) {
        // Set explicit height based on width/aspect (inverse because width/height = aspect)
        const h = Math.round(rect.width / aspect);
        host.style.minHeight = h + 'px';
        if (this.container) this.container.style.minHeight = '100%';
        if (this.svg) {
          this.svg.style.width = '100%';
          this.svg.style.height = '100%';
        }
        console.info('[MSD v1] Applied fallback height', h, 'px for host (aspect', aspect.toFixed(3), ')');
      }
    } catch {}
  }

  render(resolvedModel) {
    return perfTime('render.diff', () => {
      this._lastViewBox = resolvedModel.viewBox;
      this._tryResolveMountHost();

      // Attempt external viewBox adoption (only once, but now also set aspect hint)
      if (!this._adoptedExternalViewBox && resolvedModel.viewBox && resolvedModel.viewBox[2] === 400 && resolvedModel.viewBox[3] === 200) {
        try {
          const baseSvg = (this.rootEl.getRootNode ? this.rootEl.getRootNode() : document)
            ?.querySelector('#cblcars-msd-wrapper svg');
          const vbAttr = baseSvg && baseSvg.getAttribute('viewBox');
          if (vbAttr) {
            const parts = vbAttr.split(/\s+/).map(Number);
            if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
              this._externalViewBoxOverride = parts;
              this._adoptedExternalViewBox = true;
              this._aspectFromExternal = parts[2] / (parts[3] || 1);
              console.info('[MSD v1] Adopted external base SVG viewBox', parts.join(' '));
            }
          }
        } catch {}
      }

      if (!this._mounted) {
        const host = this._mountHost || document.body;
        // Root container
        const c = document.createElement('div');
        c.className = 'msd-v1-root';
        c.style.position = 'absolute';
        c.style.inset = '0';
        c.style.width = '100%';
        c.style.height = '100%';
        c.style.pointerEvents = 'none';
        host.appendChild(c);
        this.container = c;

        // SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'msd-v1-svg');
        svg.setAttribute('viewBox', (this._externalViewBoxOverride || resolvedModel.viewBox).join(' '));
        svg.style.position = 'absolute';
        svg.style.top = 0;
        svg.style.left = 0;
        svg.style.width = '100%';
        svg.style.height = '100%';
        this.svg = svg;
        this.container.appendChild(svg);

        // HTML overlay layer
        const layer = document.createElement('div');
        layer.className = 'msd-v1-layer';
        layer.style.position = 'relative';
        this.layer = layer;
        this.container.appendChild(layer);

        this._mounted = true;

        // Defer sizing fix to next frame
        requestAnimationFrame(() => this._ensureSizing(host));
      } else {
        // ViewBox update
        if (this.svg) {
          const vbArr = this._externalViewBoxOverride || resolvedModel.viewBox;
          if (vbArr) {
            const vb = vbArr.join(' ');
            if (this.svg.getAttribute('viewBox') !== vb) this.svg.setAttribute('viewBox', vb);
          }
        }
        if (this._pendingReparent) this._tryResolveMountHost();
      }

      const nextIds = new Set(resolvedModel.overlays.map(o => o.id));
      // Remove stale overlays (HTML + any line path)
      for (const [id, el] of Array.from(this._overlayEls.entries())) {
        if (!nextIds.has(id)) {
          el.remove();
          this._overlayEls.delete(id);
          // remove line path if existed
          const pathEl = this.svg.querySelector(`path[data-ov="${id}"]`);
          if (pathEl) pathEl.remove();
        }
      }

      // Diff / render overlays
      let updatedOverlays = 0;
      const renderedLineIds = []; // ensure declared before loop
      for (const ov of resolvedModel.overlays) {
        if (!ov || !ov.id) continue;
        // Skip creating HTML label boxes for line overlays unless debug flag on
        if (ov.type === 'line' && !this._showLineLabels) {
          try { this._renderLineOverlay(ov, resolvedModel, renderedLineIds); } catch(e){ console.warn('[MSD v1] line render error', ov.id, e); }
          continue;
        }
        try {
          const raw = safeRaw(ov); // ALWAYS defined object
          let el = this._overlayEls.get(ov.id);
          if (!el) {
            el = document.createElement('div');
            el.className = 'msd-overlay';
            el.dataset.id = ov.id;
            el.dataset.type = ov.type || '';
            el.style.position = 'absolute';
            this.layer.appendChild(el);
            this._overlayEls.set(ov.id, el);
          }

            if (ov.type === 'text') {
              const val = ov.finalStyle?.value;
              if (val != null && el.textContent !== String(val)) el.textContent = String(val);
            } else if (!el.firstChild) {
              el.textContent = ov.id;
              el.style.fontSize = '10px';
              el.style.opacity = '0.5';
            }

          if (ov.finalStyle?.color) el.style.color = ov.finalStyle.color;
          if (ov.finalStyle?.font_size) el.style.fontSize = ov.finalStyle.font_size + 'px';

          // SAFE position read
          if (Array.isArray(raw.position) && raw.position.length === 2) {
            const [x, y] = raw.position;
            if (Number.isFinite(x) && Number.isFinite(y)) {
              el.style.transform = `translate(${x}px, ${y}px)`;
            }
          }

          if (ov.animation_hash) el.dataset.anim = ov.animation_hash; else delete el.dataset.anim;

          if (ov.type === 'line') {
            this._renderLineOverlay(ov, resolvedModel, renderedLineIds);
          }
        } catch (err) {
          console.warn('[MSD v1] overlay render error', ov?.id, err);
        }
      }
      this._lastRenderedLineIds = renderedLineIds;
      // ADDED: render summary + path count each pass (first 2 passes verbose)
      if ((this._renderPassCount || 0) < 2) {
        const pathCount = this.svg ? this.svg.querySelectorAll('path[data-layer="v1"]').length : 0;
        console.info('[MSD v1] render pass', (this._renderPassCount||0)+1, 'lineOverlays=', renderedLineIds.length, 'pathsNow=', pathCount);
      }
      this._renderPassCount = (this._renderPassCount || 0) + 1;
      if (!this._debugLoggedOnce && typeof window !== 'undefined') {
        this._debugLoggedOnce = true;
        if (window.__msdDebug) {
          window.__msdDebug.dumpV1Overlays = () => ({
            overlayIds: resolvedModel.overlays.map(o => o.id),
            lineOverlays: resolvedModel.overlays.filter(o => o.type === 'line').map(o => o.id),
            renderedPaths: renderedLineIds.slice(),
            svgPathCount: this.svg ? this.svg.querySelectorAll('path[data-layer="v1"]').length : 0
          });
        }
        console.info('[MSD v1] RendererV1 initialized. line overlays=', renderedLineIds.length);
      }
      if (window.__msdDebug) window.__msdDebug.lastRenderModel = resolvedModel;
    });
  }

  _renderLineOverlay(ov, resolvedModel, collector) {
    const raw = safeRaw(ov);
    // collector: optional array to push rendered overlay ids
    if (!this.svg) return;
    const a1Id = raw.anchor;
    const a2Ref = raw.attach_to;
    if (!a1Id || !a2Ref) {
      console.warn('[MSD v1] line overlay missing anchor/attach_to', ov.id, { a1Id, a2Ref });
      return;
    }
    let a1 = resolvedModel.anchors[a1Id];
    let a2 = resolvedModel.anchors[a2Ref];
    // Coerce malformed anchor entries
    if (Array.isArray(a1)) a1 = [Number(a1[0]), Number(a1[1])];
    if (Array.isArray(a2)) a2 = [Number(a2[0]), Number(a2[1])];
    if ((!Array.isArray(a2) || a2.some(v=>!Number.isFinite(v))) && this._overlayEls.has(a2Ref)) {
      // fallback to overlay position transform
      const el = this._overlayEls.get(a2Ref);
      if (el) {
        const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform || '');
        const x = m ? Number(m[1]) : 0;
        const y = m ? Number(m[2]) : 0;
        a2 = [x, y];
      }
    }
    // ADDED: detailed per-line debug (first pass only)
    if (!this._lineDebugLogged) {
      console.debug('[MSD v1] line debug', ov.id, { a1Id, a2Ref, a1, a2 });
    }
    if (!Array.isArray(a1) || a1.length!==2 || a1.some(v=>!Number.isFinite(v)) ||
        !Array.isArray(a2) || a2.length!==2 || a2.some(v=>!Number.isFinite(v))) {
      console.warn('[MSD v1] line overlay endpoints unresolved', ov.id, { a1, a2, a1Id, a2Ref });
      return;
    }

    const routerCore = this.router;
    let routeRes;
    if (routerCore && typeof routerCore.buildRouteRequest === 'function') {
      const req = routerCore.buildRouteRequest(ov, a1, a2);
      try {
        routeRes = routerCore.computePath(req);
      } catch (e) {
        console.warn('[MSD v1] router error, falling back line', ov.id, e);
      }
    }
    if (!routeRes) {
      routeRes = { d: `M${a1[0]},${a1[1]} L${a2[0]},${a2[1]}`, meta: { strategy: 'fallback-line' }, pts:[a1,a2] };
    }

    let pathEl = this.svg.querySelector(`path#msd-${ov.id}`);
    if (!pathEl) {
      pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.id = `msd-${ov.id}`;
      pathEl.setAttribute('data-ov', ov.id);
      pathEl.setAttribute('data-layer', 'v1');
      pathEl.setAttribute('fill', 'none');
      this.svg.appendChild(pathEl);
      // ADDED creation log
      console.debug('[MSD v1] created path element for', ov.id);
    }

    let width = ov.finalStyle?.width;
    if (!Number.isFinite(width)) width = Number(raw.width);
    if (!Number.isFinite(width) || width <= 0) width = 1;

    pathEl.setAttribute('d', routeRes.d);
    const strokeColor = ov.finalStyle?.color || raw.stroke || 'var(--lcars-orange)';
    pathEl.setAttribute('stroke', strokeColor);
    pathEl.setAttribute('stroke-width', width);
    pathEl.setAttribute('vector-effect', 'non-scaling-stroke');
    pathEl.setAttribute('stroke-linecap', 'round');
    pathEl.setAttribute('stroke-linejoin', 'round');
    if (routeRes.meta?.strategy) pathEl.dataset.strategy = routeRes.meta.strategy;
    if (routeRes.meta?.cost != null) pathEl.dataset.cost = String(routeRes.meta.cost);
    if (routeRes.meta?.cache_hit != null) pathEl.dataset.cache = routeRes.meta.cache_hit ? '1':'0';
    pathEl.dataset.width = String(width);

    collector && collector.push(ov.id);
    perfInc('connectors.layout.recomputed', 1);

    // DEBUG endpoint markers (runtime toggle)
    try {
      const dbg = window.__msdDebug;
      if (dbg?.lines?.markersEnabled) {
        if (!this._markerLayer) {
          this._markerLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          this._markerLayer.setAttribute('data-layer', 'v1-markers');
          this.svg.appendChild(this._markerLayer);
        }
        const mkId = `mk-${ov.id}`;
        let g = this._markerLayer.querySelector(`g[data-mk="${mkId}"]`);
        if (!g) {
          g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('data-mk', mkId);
          this._markerLayer.appendChild(g);
          const c1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          const c2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          c1.setAttribute('r', 8);
            c2.setAttribute('r', 6);
          c1.setAttribute('fill', 'none');
          c1.setAttribute('stroke', strokeColor || '#fff');
          c1.setAttribute('stroke-width', '1.5');
          c2.setAttribute('fill', strokeColor || '#fff');
          c1.dataset.pt = 'a1';
          c2.dataset.pt = 'a2';
          g.appendChild(c1);
          g.appendChild(c2);
        }
        const [ax, ay] = a1;
        const [bx, by] = a2;
        const c1 = g.querySelector('circle[data-pt="a1"]');
        const c2 = g.querySelector('circle[data-pt="a2"]');
        c1.setAttribute('cx', ax);
        c1.setAttribute('cy', ay);
        c2.setAttribute('cx', bx);
        c2.setAttribute('cy', by);
      }
    } catch {}
    this._lineDebugLogged = true;
  }
}

// Helper: produce simple orthogonal path (2 segments) unless already aligned
function buildBasicManhattanPath(a1, a2, mode='xy') {
  const [x1,y1] = a1;
  const [x2,y2] = a2;
  if (!Number.isFinite(x1+y1+x2+y2)) return null;
  if (x1 === x2 || y1 === y2) return `M${x1},${y1} L${x2},${y2}`;
  if (mode === 'yx') {
    return `M${x1},${y1} V${y2} H${x2}`;
  }
  // default xy
  return `M${x1},${y1} H${x2} V${y2}`;
}

// ADDED: global debug helper if window + svg available later
if (typeof window !== 'undefined') {
  window.__msdDebug = window.__msdDebug || {};
  if (!window.__msdDebug.dumpV1Paths) {
    window.__msdDebug.dumpV1Paths = () => {
      const svgs = Array.from(document.querySelectorAll('svg.msd-v1-svg'));
      const paths = [];
      svgs.forEach(s => {
        paths.push(...Array.from(s.querySelectorAll('path[data-layer="v1"]')).map(p => ({
          id: p.id,
          ov: p.getAttribute('data-ov'),
          d: p.getAttribute('d'),
          strategy: p.dataset.strategy,
          width: p.getAttribute('stroke-width')
        })));
      });
      return paths;
    };
  }
  if (!window.__msdDebug.lines) {
    window.__msdDebug.lines = {
      markersEnabled: false,
      showMarkers(flag = true) {
        this.markersEnabled = !!flag;
        console.info('[MSD v1] line endpoint markers', this.markersEnabled ? 'ENABLED' : 'DISABLED');
      }
    };
  }
  // NEW: toggle overlay HTML labels for lines
  window.__msdDebug.lines.showLabels = (flag = true) => {
    const pi = window.__msdDebug.pipelineInstance;
    if (pi?.renderer) {
      pi.renderer._showLineLabels = !!flag;
      pi.renderer.render(pi.getResolvedModel());
      console.info('[MSD v1] line HTML labels', flag ? 'ENABLED' : 'DISABLED');
    }
  };
}

