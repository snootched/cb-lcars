/**
 * MSD Control Overlays – host real Lovelace cards above the SVG overlay layer.
 *
 * - Controls host mounts inside #cblcars-msd-wrapper.
 * - Host is pointer-events:none so it never blocks the SVG; each control box is pointer-events:auto.
 * - Debounced ResizeObserver reflows controls on wrapper size changes.
 * - Robust child card creation (core hui-* and custom: tags).
 */

/**
 * Resolve a position into absolute viewBox units.
 * Accepts anchor name or [x, y] with numbers or percentage strings ('78%').
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
 * Map a position/size in viewBox units to pixel CSS for a given hostRect.
 */
function mapToPixels(pos, size, viewBox, hostRect) {
  const [minX, minY, vw, vh] = Array.isArray(viewBox) ? viewBox : [0, 0, 400, 200];
  const [x, y] = pos || [0, 0];
  const [w, h] = size || [0, 0];
  const left = ((x - minX) / vw) * hostRect.width;
  const top = ((y - minY) / vh) * hostRect.height;
  const width = (w / vw) * hostRect.width;
  const height = (h / vh) * hostRect.height;
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${Math.max(0, width)}px`,
    height: `${Math.max(0, height)}px`,
  };
}

/**
 * Locate the responsive wrapper that contains the base SVG.
 */
function findMsdWrapper(root, hostParentSelector) {
  if (hostParentSelector) {
    const el = root.querySelector(hostParentSelector);
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
 * Map a Lovelace card config.type to a concrete custom element tag.
 * Core: "button" -> "hui-button-card". Custom: "custom:<tag>" -> "<tag>".
 */
function typeToTag(type = '') {
  if (!type || typeof type !== 'string') return '';
  const t = type.trim();
  if (t.startsWith('custom:')) return t.slice(7);
  return `hui-${t}-card`;
}

/**
 * Create or update a child Lovelace card inside the container.
 * Prefers loadCardHelpers().createCardElement(), with a fallback to direct element creation.
 */
async function ensureChildCard(container, cardConfig, hass) {
  if (!container || !cardConfig || !cardConfig.type) return null;

  const targetType = String(cardConfig.type);
  const current = container.firstElementChild;

  // Reuse existing if same logical type
  if (current && current.__cblcars_card_type === targetType) {
    try {
      if (typeof current.setConfig === 'function') current.setConfig(cardConfig);
    } catch (_) {
      // Rebuild on setConfig failure
    }
    current.hass = hass;
    return current;
  }

  // Try helpers path
  let el = null;
  try {
    const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : null;
    if (helpers?.createCardElement) {
      el = await helpers.createCardElement(cardConfig);
    }
  } catch (_) {
    // fall through to manual
  }

  // Fallback: map type→tag and create directly
  if (!el) {
    const tag = typeToTag(targetType);
    try {
      if (customElements?.whenDefined) {
        try {
          await customElements.whenDefined(tag);
        } catch (_) {}
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

  // Mark and wire hass
  el.__cblcars_card_type = targetType;
  el.hass = hass;

  // Fill container
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
 * Render/update the controls layer inside the wrapper.
 * - Host: pointer-events:none (click‑through), only control boxes are interactive.
 * - Persistent, debounced ResizeObserver reflows on wrapper resize.
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
}) {
  if (!root) return;

  // 1) Locate the wrapper (wait if needed)
  let wrapper = findMsdWrapper(root, hostParentSelector);
  if (!wrapper) {
    const mo = new MutationObserver(() => {
      wrapper = findMsdWrapper(root, hostParentSelector);
      if (wrapper) {
        try {
          mo.disconnect();
        } catch (_) {}
        requestAnimationFrame(() => {
          renderMsdControls({ overlays, viewBox, anchors, root, hass, hostId, baseZ, hostParentSelector });
        });
      }
    });
    mo.observe(root, { childList: true, subtree: true });
    return;
  }

  // 2) Create/attach the host inside the wrapper (click‑through)
  let host = root.getElementById(hostId);
  if (!host || host.parentElement !== wrapper) {
    host?.parentElement?.removeChild(host);
    host = document.createElement('div');
    host.id = hostId;
    Object.assign(host.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none', // critical: allow SVG below to receive clicks where no control exists
      zIndex: String(baseZ),
      boxSizing: 'border-box',
    });
    wrapper.appendChild(host);
  }

  // 3) Persistent, debounced ResizeObserver on wrapper
  if (!wrapper.__cblcars_controls_ro) {
    const ro = new ResizeObserver(() => {
      if (wrapper.__cblcars_controls_sched) return;
      wrapper.__cblcars_controls_sched = true;
      requestAnimationFrame(() => {
        wrapper.__cblcars_controls_sched = false;
        renderMsdControls({ overlays, viewBox, anchors, root, hass, hostId, baseZ, hostParentSelector });
      });
    });
    ro.observe(wrapper);
    wrapper.__cblcars_controls_ro = ro;
  }

  // 4) Measure wrapper and layout controls
  const rect = wrapper.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return;

  // 5) Reconcile control containers
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

    // Only control boxes are interactive
    Object.assign(c.style, {
      position: 'absolute',
      pointerEvents: 'auto', // critical: re-enable events on control area
      zIndex: String(Number.isFinite(ov.z_index) ? ov.z_index : baseZ),
      display: 'block',
      overflow: 'visible',
      boxSizing: 'border-box',
    });

    // Resolve position/size
    const posAbs = resolvePointLike(ov.position, anchors, viewBox);
    const sizeAbs = resolveSizeLike(ov.size, viewBox);
    if (posAbs && sizeAbs) {
      const px = mapToPixels(posAbs, [sizeAbs.w, sizeAbs.h], viewBox, rect);
      c.style.left = px.left;
      c.style.top = px.top;
      c.style.width = px.width;
      c.style.height = px.height;
    } else {
      // eslint-disable-next-line no-console
      console.warn('[MSD controls] Invalid position/size:', ov.id, ov.position, ov.size);
    }

    await ensureChildCard(c, ov.card, hass);
  }

  // 6) Cleanup removed controls
  for (const node of Array.from(host.children)) {
    if (node instanceof HTMLElement && node.id && !wantedIds.has(node.id)) node.remove();
  }
}