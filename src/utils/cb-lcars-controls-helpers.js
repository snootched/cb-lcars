/**
 * MSD Control Overlays – host real Lovelace cards above the SVG overlay layer.
 * (existing header unchanged)
 */

/**
 * Resolve a position into absolute viewBox units.
 * (unchanged)
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
 * Resolve [w, h] into absolute viewBox units. Entries may be numbers or percentage strings.
 * (unchanged)
 */
function resolveSizeLike(size, viewBox = [0, 0, 400, 200]) {
  if (!Array.isArray(size) || size.length !== 2) return null;
  const [, , vw, vh] = viewBox;
  const toDim = (val, max) =>
    typeof val === 'string' && val.trim().endsWith('%') ? (parseFloat(val) / 100) * max : Number(val);
  const w = toDim(size[0], vw);
  const h = toDim(size[1], vh);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { w, h };
}

/**
 * Fallback: simple ratio mapping (kept as a backup).
 */
function mapToPixelsRatio(pos, size, viewBox, rect) {
  const [minX, minY, vw, vh] = Array.isArray(viewBox) ? viewBox : [0, 0, 400, 200];
  const [x, y] = pos || [0, 0];
  const [w, h] = size || [0, 0];
  const left = ((x - minX) / vw) * rect.width;
  const top = ((y - minY) / vh) * rect.height;
  const width = (w / vw) * rect.width;
  const height = (h / vh) * rect.height;
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${Math.max(0, width)}px`,
    height: `${Math.max(0, height)}px`,
  };
}

/**
 * Locate the wrapper or fallback containers.
 * (unchanged)
 */
function findMsdWrapper(root, selector) {
  if (selector) {
    const el = root.querySelector(selector);
    if (el) return el;
  }
  let wrapper = root.querySelector('#cblcars-msd-wrapper');
  if (wrapper) return wrapper;

  const fieldContainer = root.getElementById?.('msd_svg_base');
  if (fieldContainer && fieldContainer.firstElementChild) return fieldContainer.firstElementChild;
  if (fieldContainer) return fieldContainer;

  return null;
}

/**
 * Best reference SVG to compute CTM from (overlays SVG first, then base).
 */
function getReferenceSvg(root) {
  return (
    root.querySelector?.('#msd_svg_overlays svg') ||
    root.querySelector?.('#cblcars-msd-wrapper svg') ||
    null
  );
}

/**
 * Map a position/size in viewBox units to CSS pixels using the SVG's screen CTM.
 * Falls back to ratio mapping if CTM not available.
 * Returns { left, top, width, height } as CSS pixel strings relative to hostRect.
 */
function mapToPixelsViaCTM(pos, size, viewBox, svgEl, hostRect) {
  if (!svgEl || !svgEl.getScreenCTM || !hostRect) return mapToPixelsRatio(pos, size, viewBox, hostRect);

  const [x, y] = pos || [0, 0];
  const [w, h] = size || [0, 0];

  let ctm;
  try { ctm = svgEl.getScreenCTM(); } catch (_) { ctm = null; }
  if (!ctm) return mapToPixelsRatio(pos, size, viewBox, hostRect);

  // Use DOMPoint if available; otherwise createSVGPoint
  const makePoint = (px, py) => {
    if (window.DOMPoint) {
      const p = new DOMPoint(px, py);
      return p.matrixTransform ? p.matrixTransform(ctm) : p;
    }
    if (svgEl.createSVGPoint) {
      const p = svgEl.createSVGPoint();
      p.x = px; p.y = py;
      return p.matrixTransform(ctm);
    }
    return null;
  };

  const p0 = makePoint(x, y);
  const p1 = makePoint(x + w, y + h);
  if (!p0 || !p1) return mapToPixelsRatio(pos, size, viewBox, hostRect);

  const left = p0.x - hostRect.left;
  const top = p0.y - hostRect.top;
  const width = p1.x - p0.x;
  const height = p1.y - p0.y;

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${Math.max(0, width)}px`,
    height: `${Math.max(0, height)}px`,
  };
}

/**
 * Map a Lovelace card config.type to a concrete custom element tag.
 * (unchanged)
 */
function typeToTag(type = '') {
  if (!type || typeof type !== 'string') return '';
  const t = type.trim();
  if (t.startsWith('custom:')) return t.slice(7);
  return `hui-${t}-card`;
}

/**
 * Create or update a child Lovelace card inside the container.
 * (unchanged)
 */
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
    } catch (e) {
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
 * Render/update the controls layer.
 * (UPDATED: no rounding, CTM mapping)
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
  if (!root) return;

  // 1) Mount parent (z-order/pointer-events container)
  let mountParent = findMsdWrapper(root, hostParentSelector);
  if (!mountParent) {
    const mo = new MutationObserver(() => {
      mountParent = findMsdWrapper(root, hostParentSelector);
      if (mountParent) {
        try { mo.disconnect(); } catch (_) {}
        requestAnimationFrame(() => {
          renderMsdControls({ overlays, viewBox, anchors, root, hass, hostId, baseZ, hostParentSelector, measureSelector });
        });
      }
    });
    mo.observe(root, { childList: true, subtree: true });
    return;
  }

  // 2) Ensure host under mount parent
  let host = root.getElementById(hostId);
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

  // 3) Measure the aspect-locked wrapper box
  const measureEl = findMsdWrapper(root, measureSelector) || mountParent;
  if (!measureEl) {
    const mo2 = new MutationObserver(() => {
      const candidate = findMsdWrapper(root, measureSelector);
      if (candidate) {
        try { mo2.disconnect(); } catch (_) {}
        requestAnimationFrame(() => {
          renderMsdControls({ overlays, viewBox, anchors, root, hass, hostId, baseZ, hostParentSelector, measureSelector });
        });
      }
    });
    mo2.observe(root, { childList: true, subtree: true });
    return;
  }

  const m = measureEl.getBoundingClientRect?.();
  const p = mountParent.getBoundingClientRect?.();
  if (!m || !p || m.width === 0 || m.height === 0) return;

  // 4) Size and position the host to match the wrapper box (no rounding)
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
    host.style.top = `${dy}px`;
    host.style.width = `${w}px`;
    host.style.height = `${h}px`;
    host.__cblcars_host_metrics = { dx, dy, w, h };
  }

  // 5) Observe the measure element (wrapper) for size changes → relayout controls
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

  // 6) Use the reference SVG's CTM for pixel mapping
  const refSvg = getReferenceSvg(root);
  const hr = host.getBoundingClientRect?.();
  if (!hr || hr.width === 0 || hr.height === 0) return;

  // 7) Lay out controls within the sized host
  const wantedIds = new Set();
  for (const ov of overlays) {
    if (!ov || ov.type !== 'control' || !ov.id || !Array.isArray(ov.size) || !ov.card) continue;
    wantedIds.add(ov.id);

    let c = root.getElementById(ov.id);
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
    });

    const posAbs = resolvePointLike(ov.position, anchors, viewBox);
    const sizeAbs = resolveSizeLike(ov.size, viewBox);
    if (posAbs && sizeAbs) {
      const px = refSvg
        ? mapToPixelsViaCTM(posAbs, [sizeAbs.w, sizeAbs.h], viewBox, refSvg, hr)
        : mapToPixelsRatio(posAbs, [sizeAbs.w, sizeAbs.h], viewBox, hr);

      c.style.left = px.left;
      c.style.top = px.top;
      c.style.width = px.width;
      c.style.height = px.height;
    } else {
      console.warn('[MSD controls] Invalid position/size:', ov.id, ov.position, ov.size);
    }

    await ensureChildCard(c, ov.card, hass);
  }

  // Cleanup removed controls
  for (const node of Array.from(host.children)) {
    if (node instanceof HTMLElement && node.id && !wantedIds.has(node.id)) node.remove();
  }

  // NEW: After controls move/resize, re-layout any pending connectors
  try {
    if (window.cblcars?.overlayHelpers?.layoutPendingConnectors) {
      window.cblcars.overlayHelpers.layoutPendingConnectors(root, viewBox);
    }
  } catch (_) {}

}