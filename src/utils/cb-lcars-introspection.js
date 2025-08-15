/**
 * CB-LCARS MSD Introspection helpers
 * Exposed via window.cblcars.msd.*
 */
import * as geo from './cb-lcars-geometry-utils.js';

/**
 * Get the base overlays SVG in this card root, if any.
 * @param {Element|ShadowRoot} root
 * @returns {SVGSVGElement|null}
 */
function getOverlaysSvg(root) {
  return root?.querySelector?.('#msd_svg_overlays svg') || root?.querySelector?.('#cblcars-msd-wrapper svg') || null;
}

/**
 * Resolve a position into absolute viewBox units from config shape.
 * Accepts anchor name or [x, y] (numbers or percentages as strings).
 * @param {string|Array} position
 * @param {Record<string,[number,number]>} anchors
 * @param {[number,number,number,number]} viewBox
 */
function resolvePointFromConfig(position, anchors = {}, viewBox = [0, 0, 400, 200]) {
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

/**
 * Resolve [w,h] into absolute viewBox units from config shape.
 * @param {Array} size
 * @param {[number,number,number,number]} viewBox
 */
function resolveSizeFromConfig(size, viewBox = [0, 0, 400, 200]) {
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
 * Compute an overlay element's bbox in viewBox units.
 * Works for stamped SVG overlays and HTML control overlays.
 * Ribbon note: if the group <g> is empty, will try the sibling "_backdrop" rect.
 * Final fallback: compute from overlay config (position+size) when available.
 * @param {string} id
 * @param {Element|ShadowRoot} root
 * @returns {{x:number,y:number,w:number,h:number}|null}
 */
export function getOverlayBBox(id, root) {
  if (!id || !root) return null;

  // 1) Try element with the id directly
  let el = root.getElementById?.(id);
  let bb = null;

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
      const svg = geo.getReferenceSvg(root);
      const pxRect = el.getBoundingClientRect?.();
      if (svg && pxRect && pxRect.width > 0 && pxRect.height > 0) {
        const vbRect = geo.screenRectToViewBox(svg, pxRect);
        if (vbRect) return vbRect;
      }
    }
  }

  // 2) Ribbon fallback: look for the backdrop sibling rect
  const backdrop = root.getElementById?.(`${id}_backdrop`);
  if (backdrop && typeof backdrop.getBBox === 'function') {
    try {
      const bb2 = backdrop.getBBox();
      if (bb2 && (bb2.width > 0 || bb2.height > 0)) {
        return { x: bb2.x, y: bb2.y, w: bb2.width, h: bb2.height };
      }
    } catch (_) {}
  }

  // 3) Config fallback: compute from overlay config (position + size)
  const cfg = root.__cblcars_overlayConfigsById?.[id];
  if (cfg && cfg.position && cfg.size) {
    const anchors = root.__cblcars_anchors || {};
    const vb = geo.getViewBox(root, geo.getReferenceSvg(root)) || [0, 0, 100, 100];
    const pos = resolvePointFromConfig(cfg.position, anchors, vb);
    const sz = resolveSizeFromConfig(cfg.size, vb);
    if (pos && sz) {
      return { x: pos[0], y: pos[1], w: sz.w, h: sz.h };
    }
  }

  return bb;
}

/**
 * List primary overlays stamped in this card.
 * Uses root.__cblcars_overlayConfigsById when available for type; falls back to DOM data.
 * @param {Element|ShadowRoot} root
 * @returns {Array<{id:string,type:string,bbox:{x:number,y:number,w:number,h:number}|null,hasErrors?:boolean,hasWarnings?:boolean}>}
 */
export function listOverlays(root) {
  const out = [];
  const svg = getOverlaysSvg(root);
  if (!svg) return out;

  const cfg = root.__cblcars_overlayConfigsById || {};
  const valById = root.__cblcars_validationById || {};

  // Primary nodes carry data-cblcars-root="true" when available
  let nodes = Array.from(svg.querySelectorAll('[id][data-cblcars-root="true"]'));
  if (!nodes.length) {
    nodes = Array.from(svg.querySelectorAll('[id]'))
      .filter(n => n.id && n.id !== 'cblcars-debug-layer' && n.id !== 'cblcars-overlay-errors');
  }

  for (const n of nodes) {
    const id = n.id;
    const type = (cfg[id]?.type) || n.getAttribute('data-cblcars-type') || n.tagName.toLowerCase();
    const bbox = getOverlayBBox(id, root);
    const vd = valById[id] || { errors: [], warnings: [] };
    out.push({
      id,
      type: String(type),
      bbox,
      hasErrors: Array.isArray(vd.errors) && vd.errors.length > 0,
      hasWarnings: Array.isArray(vd.warnings) && vd.warnings.length > 0
    });
  }
  return out;
}

/**
 * List known anchors for this card.
 * Prefers root.__cblcars_anchors (set by template).
 * @param {Element|ShadowRoot} root
 * @returns {Array<{id:string,x:number,y:number}>}
 */
export function listAnchors(root) {
  const a = root.__cblcars_anchors || {};
  return Object.entries(a).map(([id, pt]) => ({ id, x: pt[0], y: pt[1] }));
}

/**
 * Ephemeral highlight: draws bbox rectangles around given ids and auto-clears.
 * Accepts opts.root to work inside Shadow DOM.
 * @param {string|string[]} ids
 * @param {{root?:Element|ShadowRoot,color?:string,strokeWidth?:number,duration?:number}} opts
 */
export function highlight(ids, opts = {}) {
  const list = Array.isArray(ids) ? ids : [ids];
  const root = opts.root || document;

  const svg = geo.getReferenceSvg(root);
  if (!svg) return;

  const vb = geo.getViewBox(root, svg) || [0, 0, 100, 100];
  const color = opts.color || '#ffcc00';
  const strokeWidth = Number.isFinite(opts.strokeWidth) ? opts.strokeWidth : Math.max(1.5, Math.round(vb[3] * 0.004));
  const duration = Math.max(250, opts.duration || 1500);

  // Ensure a highlight layer (separate from debug layer so re-renders don't clear it)
  let g = svg.querySelector('#cblcars-highlight-layer');
  if (!g) {
    g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'cblcars-highlight-layer');
    g.style.pointerEvents = 'none';
    svg.appendChild(g);
  }

  let html = '';
  for (const id of list) {
    let bb = getOverlayBBox(id, root);

    // Ribbon fallback: if group bbox is empty, try backdrop explicitly
    if ((!bb || (!bb.w && !bb.h)) && root.getElementById?.(`${id}_backdrop`)) {
      const el = root.getElementById(`${id}_backdrop`);
      if (el && typeof el.getBBox === 'function') {
        try {
          const rb = el.getBBox();
          if (rb && (rb.width > 0 || rb.height > 0)) {
            bb = { x: rb.x, y: rb.y, w: rb.width, h: rb.height };
          }
        } catch (_) {}
      }
    }

    if (!bb || bb.w <= 0 || bb.h <= 0) continue;
    html += `<rect x="${bb.x}" y="${bb.y}" width="${bb.w}" height="${bb.h}"
      fill="none" stroke="${color}" stroke-width="${strokeWidth}" opacity="0.95">
      <title>${id}</title>
    </rect>`;
  }
  if (!html) return;

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('data-layer', 'highlight');
  group.innerHTML = html;
  g.appendChild(group);

  // Auto clear this batch
  setTimeout(() => {
    try { group.remove(); } catch (_) {}
  }, duration);
}