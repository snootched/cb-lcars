/**
 * MSD Control Overlays – host Lovelace cards above SVG layer (CTM mapped).
 * P1 + P2 (perf instrumentation + scheduler batching)
 */
import * as geo from './cb-lcars-geometry-utils.js';
import * as scheduler from './cb-lcars-scheduler.js'; // P2

/**
 * Resolve position into viewBox units (anchor name or [x,y] with % allowed).
 */
function resolvePointLike(point, anchors = {}, viewBox = [0, 0, 400, 200]) {
  const [minX, minY, vw, vh] = viewBox;
  if (!point) return null;
  if (typeof point === 'string' && anchors && anchors[point]) return anchors[point];
  if (Array.isArray(point) && point.length === 2) {
    const r = (v, axis) =>
      typeof v === 'string' && v.trim().endsWith('%')
        ? axis === 'x'
          ? minX + (parseFloat(v) / 100) * vw
          : minY + (parseFloat(v) / 100) * vh
        : Number(v);
    const x = r(point[0], 'x');
    const y = r(point[1], 'y');
    if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
  }
  return null;
}

/**
 * Resolve size [w,h] into viewBox units (numbers or % strings).
 */
function resolveSizeLike(size, viewBox = [0, 0, 400, 200]) {
  if (!Array.isArray(size) || size.length !== 2) return null;
  const [, , vw, vh] = viewBox;
  const toDim = (val, max) =>
    typeof val === 'string' && val.trim().endsWith('%')
      ? (parseFloat(val) / 100) * max
      : Number(val);
  const w = toDim(size[0], vw);
  const h = toDim(size[1], vh);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { w, h };
}

function findMsdWrapper(root, selector) {
  if (selector) {
    const el = root.querySelector?.(selector);
    if (el) return el;
  }
  let wrapper = root.querySelector?.('#cblcars-msd-wrapper');
  if (wrapper) return wrapper;

  const fieldContainer = root.getElementById?.('msd_svg_base');
  if (fieldContainer && fieldContainer.firstElementChild) return fieldContainer.firstElementChild;
  if (fieldContainer) return fieldContainer;
  return null;
}

function typeToTag(type = '') {
  if (!type || typeof type !== 'string') return '';
  const t = type.trim();
  if (t.startsWith('custom:')) return t.slice(7);
  return `hui-${t}-card`;
}

async function ensureChildCard(container, cardConfig, hass) {
  if (!container || !cardConfig || !cardConfig.type) return null;

  const targetType = String(cardConfig.type);
  const current = container.firstElementChild;

  if (current && current.__cblcars_card_type === targetType) {
    try {
      if (typeof current.setConfig === 'function') current.setConfig(cardConfig);
    } catch (_) {}
    current.hass = hass;
    return current;
  }

  let el = null;
  try {
    const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : null;
    if (helpers?.createCardElement) {
      el = await helpers.createCardElement(cardConfig);
    }
  } catch (_) {}

  if (!el) {
    const tag = typeToTag(targetType);
    try {
      if (customElements?.whenDefined) {
        try { await customElements.whenDefined(tag); } catch (_) {}
      }
      el = document.createElement(tag);
      if (typeof el.setConfig === 'function') el.setConfig(cardConfig);
    } catch {
      const err = document.createElement('ha-alert');
      err.setAttribute('alert-type', 'error');
      err.setAttribute('title', 'MSD Control Overlay');
      Object.assign(err.style, { display: 'block', width: '100%', height: '100%' });
      err.textContent = `Failed to create card "${targetType}". Ensure resources are loaded.`;
      container.innerHTML = '';
      container.appendChild(err);
      return err;
    }
  }

  el.__cblcars_card_type = targetType;
  el.hass = hass;

  try {
    el.style.display = 'block';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.pointerEvents = 'auto';
    el.style.boxSizing = 'border-box';
  } catch (_) {}
  container.innerHTML = '';
  container.appendChild(el);
  return el;
}

/**
 * Render / update controls layer
 */
export async function renderMsdControls({
  overlays = [],
  viewBox,
  anchors = {},
  root,
  hass,
  hostId = 'cblcars-controls-layer',
  baseZ = 30,
  hostParentSelector = '#cblcars-msd-wrapper',
  measureSelector = '#cblcars-msd-wrapper',
}) {
  const dbgPerf = window.cblcars?.debug?.perf;
  const dbgEnd = dbgPerf?.start ? dbgPerf.start('controls.render') : null;
  const endPerf = window.cblcars?.perf?.timeStart ? window.cblcars.perf.timeStart('controls.render.exec') : null;
  if (!root) { endPerf && endPerf(); return; }

  // 1) Mount parent
  let mountParent = findMsdWrapper(root, hostParentSelector);
  if (!mountParent) {
    const mo = new MutationObserver(() => {
      mountParent = findMsdWrapper(root, hostParentSelector);
      if (mountParent) {
        try { mo.disconnect(); } catch(_) {}
        requestAnimationFrame(() => {
          renderMsdControls({ overlays, viewBox, anchors, root, hass, hostId, baseZ, hostParentSelector, measureSelector });
        });
      }
    });
    mo.observe(root, { childList: true, subtree: true });
    endPerf && endPerf();
    return;
  }

  // 2) Ensure host
  let host = root.getElementById?.(hostId);
  if (!host || host.parentElement !== mountParent) {
    host?.parentElement?.removeChild(host);
    host = document.createElement('div');
    host.id = hostId;
    Object.assign(host.style, {
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: String(baseZ),
      boxSizing: 'border-box'
    });
    mountParent.appendChild(host);
  }

  // 3) Measure
  const measureEl = findMsdWrapper(root, measureSelector) || mountParent;
  if (!measureEl) {
    const mo2 = new MutationObserver(() => {
      const candidate = findMsdWrapper(root, measureSelector);
      if (candidate) {
        try { mo2.disconnect(); } catch(_) {}
        requestAnimationFrame(() => {
          renderMsdControls({ overlays, viewBox, anchors, root, hass, hostId, baseZ, hostParentSelector, measureSelector });
        });
      }
    });
    mo2.observe(root, { childList: true, subtree: true });
    endPerf && endPerf();
    return;
  }

  const m = measureEl.getBoundingClientRect?.();
  const p = mountParent.getBoundingClientRect?.();
  if (!m || !p || m.width === 0 || m.height === 0) { endPerf && endPerf(); return; }

  // 4) Host sizing
  const same = measureEl === mountParent;
  const dx = same ? 0 : (m.left - p.left);
  const dy = same ? 0 : (m.top - p.top);
  const w = m.width;
  const h = m.height;
  if (!host.__cblcars_host_metrics ||
      host.__cblcars_host_metrics.dx !== dx ||
      host.__cblcars_host_metrics.dy !== dy ||
      host.__cblcars_host_metrics.w !== w ||
      host.__cblcars_host_metrics.h !== h) {
    host.style.left = `${dx}px`;
    host.style.top  = `${dy}px`;
    host.style.width  = `${w}px`;
    host.style.height = `${h}px`;
    host.__cblcars_host_metrics = { dx, dy, w, h };
  }

  // 5) Resize observer
  if (!measureEl.__cblcars_controls_ro) {
    const ro = new ResizeObserver(() => {
      if (measureEl.__cblcars_controls_sched) return;
      measureEl.__cblcars_controls_sched = true;
      requestAnimationFrame(() => {
        measureEl.__cblcars_controls_sched = false;
        renderMsdControls({ overlays, viewBox, anchors, root, hass, hostId, baseZ, hostParentSelector, measureSelector });
      });
    });
    ro.observe(measureEl);
    measureEl.__cblcars_controls_ro = ro;
  }

  // 6) Lay out controls
  const wantedIds = new Set();
  const hostRect = host.getBoundingClientRect?.();
  for (const ov of overlays) {
    if (!ov || ov.type !== 'control' || !ov.id || !Array.isArray(ov.size) || !ov.card) continue;
    wantedIds.add(ov.id);

    let c = root.getElementById?.(ov.id);
    if (!c) {
      c = document.createElement('div');
      c.id = ov.id;
      host.appendChild(c);
    } else if (c.parentElement !== host) {
      c.parentElement?.removeChild(c);
      host.appendChild(c);
    }

    Object.assign(c.style, {
      position: 'absolute',
      pointerEvents: 'auto',
      zIndex: String(Number.isFinite(ov.z_index) ? ov.z_index : baseZ),
      display: 'block',
      overflow: 'visible',
      boxSizing: 'border-box',
      margin: '0',
      padding: '0'
    });

    const posAbs = resolvePointLike(ov.position, anchors, viewBox);
    const sizeAbs = resolveSizeLike(ov.size, viewBox);
    if (posAbs && sizeAbs) {
      const vbRect = { x: posAbs[0], y: posAbs[1], w: sizeAbs.w, h: sizeAbs.h };
      const css = geo.mapViewBoxRectToHostCss(root, vbRect, hostRect);
      if (css) {
        c.style.left = css.left;
        c.style.top = css.top;
        c.style.width = css.width;
        c.style.height = css.height;
      } else {
        // ratio fallback
        const left = ((vbRect.x - viewBox[0]) / viewBox[2]) * m.width;
        const top = ((vbRect.y - viewBox[1]) / viewBox[3]) * m.height;
        const width = (vbRect.w / viewBox[2]) * m.width;
        const height = (vbRect.h / viewBox[3]) * m.height;
        c.style.left = `${left}px`;
        c.style.top = `${top}px`;
        c.style.width = `${width}px`;
        c.style.height = `${height}px`;
      }
    } else {
      console.warn('[MSD controls] Invalid position/size:', ov.id, ov.position, ov.size);
    }

    await ensureChildCard(c, ov.card, hass);
  }

  // 7) Cleanup removed
  for (const node of Array.from(host.children)) {
    if (node instanceof HTMLElement && node.id && !wantedIds.has(node.id)) node.remove();
  }

  // 8) Batch connector layout (P2)
  try {
    scheduler.queue('connectors', () => {
      window.cblcars?.overlayHelpers?.layoutPendingConnectors?.(root, viewBox);
    });
    window.cblcars?.perf?.count && window.cblcars.perf.count('connectors.layout.sched');
  } catch (_) {}

  window.cblcars?.perf?.count && window.cblcars.perf.count('controls.render');
  endPerf && endPerf();
  if (dbgEnd) window.cblcars.debug.perf.end('controls.render');
}