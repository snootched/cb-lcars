import * as svgHelpers from './cb-lcars-svg-helpers.js';
import { resolveOverlayStyles, splitAttrsAndStyle, resolveAllDynamicValues, resolveStatePreset } from './cb-lcars-style-helpers.js';
import { cblcarsLog } from './cb-lcars-logging.js';
import { sliceWindow, computeYRange, mapToRect, pathFromPoints, areaPathFromPoints, mapToRectIndex } from './cb-lcars-sparkline-helpers.js';
import { resolveSize } from './cb-lcars-size-helpers.js';
import { parseTimeWindowMs } from './cb-lcars-time-utils.js';


/**
 * Return the SVG element used to compute CTM for the overlay layer.
 */
function getReferenceSvg(root) {
  return (
    root.querySelector?.('#msd_svg_overlays svg') ||
    root.querySelector?.('#cblcars-msd-wrapper svg') ||
    null
  );
}

/**
 * Convert a viewport DOMRect (CSS pixels) into viewBox units using the SVG's screen CTM.
 * Falls back to ratio mapping if CTM is unavailable.
 * @param {DOMRect} pxRect
 * @param {SVGSVGElement} svgEl
 * @param {number[]} viewBox [minX,minY,vw,vh]
 */
function rectPxToViewBoxViaCTM(pxRect, svgEl, viewBox = [0,0,100,100]) {
  if (!svgEl || !svgEl.getScreenCTM) return null;

  let ctm;
  try { ctm = svgEl.getScreenCTM(); } catch (_) { ctm = null; }
  if (!ctm || typeof ctm.inverse !== 'function') return null;

  const inv = ctm.inverse();

  const makePoint = (x, y) => {
    if (window.DOMPoint) return new DOMPoint(x, y).matrixTransform(inv);
    if (svgEl.createSVGPoint) {
      const p = svgEl.createSVGPoint(); p.x = x; p.y = y;
      return p.matrixTransform(inv);
    }
    return null;
  };

  // Map corners from screen → user (viewBox) units
  const tl = makePoint(pxRect.left,  pxRect.top);
  const br = makePoint(pxRect.right, pxRect.bottom);
  if (!tl || !br) return null;

  const x = Math.min(tl.x, br.x);
  const y = Math.min(tl.y, br.y);
  const w = Math.abs(br.x - tl.x);
  const h = Math.abs(br.y - tl.y);

  return { x, y, w, h };
}


// ViewBox helpers
function getVbDims(viewBox = [0,0,100,100]) {
  const [minX, minY, w, h] = Array.isArray(viewBox) ? viewBox : [0,0,100,100];
  return { minX, minY, vw: w, vh: h };
}
function pxRectToVbRect(pxRect, hostRect, viewBox) {
  const { minX, minY, vw, vh } = getVbDims(viewBox);
  const sx = vw / (hostRect?.width || 1);
  const sy = vh / (hostRect?.height || 1);
  return {
    x: minX + (pxRect.left - hostRect.left) * sx,
    y: minY + (pxRect.top - hostRect.top) * sy,
    w: pxRect.width * sx,
    h: pxRect.height * sy
  };
}
function isSvgNode(el) {
  return !!el && typeof el.namespaceURI === 'string' && el.namespaceURI.includes('svg');
}
function getOverlaySvg(root) {
  return root.querySelector?.('#msd_svg_overlays svg') || root.querySelector?.('#cblcars-msd-wrapper svg') || null;
}

/**
 * Resolve a target element's bounding box into viewBox units.
 * Supports:
 *  - SVG overlay nodes (getBBox -> already in user/viewBox units)
 *  - HTML controls (map viewport rect via SVG CTM inverse)
 * Falls back to hostRect ratio mapping only when CTM is unavailable.
 */
function resolveTargetBoxInViewBox(targetId, root, viewBox) {
  const el = root.getElementById?.(targetId);
  if (!el) return null;

  // SVG node: native viewBox units
  const isSvgNode = !!el.namespaceURI && String(el.namespaceURI).includes('svg');
  if (isSvgNode && typeof el.getBBox === 'function') {
    try {
      const bb = el.getBBox();
      return { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
    } catch (_) {}
  }

  // HTML control: map via CTM
  const svg = getReferenceSvg(root);
  const pxRect = el.getBoundingClientRect?.();
  if (svg && pxRect && pxRect.width > 0 && pxRect.height > 0) {
    const vbRect = rectPxToViewBoxViaCTM(pxRect, svg, viewBox);
    if (vbRect) return vbRect;
  }

  // Fallback (ratio) – only if CTM path failed
  const host = root.getElementById?.('cblcars-controls-layer');
  const hostRect = host?.getBoundingClientRect?.();
  if (hostRect && pxRect && hostRect.width > 0 && hostRect.height > 0) {
    const [minX, minY, vw, vh] = viewBox || [0,0,100,100];
    return {
      x: minX + ((pxRect.left - hostRect.left) / hostRect.width) * vw,
      y: minY + ((pxRect.top  - hostRect.top)  / hostRect.height) * vh,
      w: (pxRect.width  / hostRect.width) * vw,
      h: (pxRect.height / hostRect.height) * vh
    };
  }

  return null;
}

/**
 * Compute a connector endpoint on a target box with side and gap.
 * side: 'auto'|'left'|'right'|'top'|'bottom'
 * align: 'center' (future: 'toward-anchor')
 * gap: number (viewBox units) or string with 'px' (converted via CTM when available)
 */
function endpointOnBox(anchor, box, { side = 'auto', align = 'center', gap = 12 } = {}) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;

  let pick = side;
  if (pick === 'auto') {
    const dx = anchor[0] - cx;
    const dy = anchor[1] - cy;
    pick = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'top' : 'bottom');
  }

  let x = cx;
  let y = cy;
  if (pick === 'left')  { x = box.x - gap; y = align === 'center' ? cy : y; }
  if (pick === 'right') { x = box.x + box.w + gap; y = align === 'center' ? cy : y; }
  if (pick === 'top')   { y = box.y - gap; x = align === 'center' ? cx : x; }
  if (pick === 'bottom'){ y = box.y + box.h + gap; x = align === 'center' ? cx : x; }
  return [x, y];
}

/**
 * Re-layout any deferred connectors (paths with data-cblcars-attach-to=...) after DOM/controls settle.
 * Uses CTM to resolve HTML control boxes into viewBox units, so endpoints line up exactly.
 */
export function layoutPendingConnectors(root, viewBox = [0,0,100,100]) {
  try {
    const svg = getReferenceSvg(root);
    const paths = Array.from(root.querySelectorAll('path[data-cblcars-attach-to]'));
    if (!paths.length) return;

    for (const p of paths) {
      const targetId = p.getAttribute('data-cblcars-attach-to');
      const sx = parseFloat(p.getAttribute('data-cblcars-start-x'));
      const sy = parseFloat(p.getAttribute('data-cblcars-start-y'));
      if (!targetId || !isFinite(sx) || !isFinite(sy)) continue;

      const side = (p.getAttribute('data-cblcars-side') || 'auto').toLowerCase();
      const align = (p.getAttribute('data-cblcars-align') || 'center').toLowerCase();

      // gap: accept number (viewBox units) or '12px'
      let gapRaw = p.getAttribute('data-cblcars-gap') || '12';
      let gap = parseFloat(gapRaw);
      if (String(gapRaw).trim().endsWith('px') && svg?.getScreenCTM) {
        // Convert px gap to viewBox units via CTM scale
        const ctm = svg.getScreenCTM();
        if (ctm && ctm.a) gap = gap / ctm.a;
      }
      if (!isFinite(gap)) gap = 12;

      const box = resolveTargetBoxInViewBox(targetId, root, viewBox);
      if (!box) continue;

      const end = endpointOnBox([sx, sy], box, { side, align, gap });

      const radius = Math.max(0, parseFloat(p.getAttribute('data-cblcars-radius')) || 12);
      const cornerStyle = (p.getAttribute('data-cblcars-corner-style') || 'round').toLowerCase();

      // Build right-angle with corner
      const d = generateRightAnglePath([sx, sy], end, { radius, cornerStyle });
      p.setAttribute('d', d);
    }
  } catch (e) {
    cblcarsLog.warn('[layoutPendingConnectors] failed', e);
  }
}

/**
 * Error overlay manager (unchanged)
 */
class SvgOverlayErrorManager {
  constructor() {
    this.errors = [];
    this.containerId = 'cblcars-overlay-errors';
    this.viewBox = [0, 0, 400, 200];
    this.root = null;
  }
  setRoot(root) { this.root = root; }
  clear() { this.errors = []; this.render(); }
  push(msg) { if (!this.errors.includes(msg)) { this.errors.push(msg); this.render(); } }
  render() {
    const searchRoot = this.root || document;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = searchRoot.querySelector(`#${this.containerId}`);
        if (!container) return;
        if (this.errors.length === 0) { container.innerHTML = ''; return; }
        const [, , , vh] = this.viewBox;
        const fontSize = Math.max(8, Math.min(48, Math.round(vh * 0.12)));
        const errorText = `<text x="${this.viewBox[0] + 10}" y="${this.viewBox[1] + fontSize}" fill="red" font-size="${fontSize}" font-family="monospace" opacity="0.8">
            ${this.errors.map((msg, i) => `<tspan x="${this.viewBox[0] + 10}" dy="${i === 0 ? 0 : '1.2em'}">${msg}</tspan>`).join('')}
        </text>`;
        container.innerHTML = errorText;
      });
    });
  }
  setViewBox(vb) { if (Array.isArray(vb) && vb.length === 4) this.viewBox = vb; }
}
export const svgOverlayManager = new SvgOverlayErrorManager();

/**
 * Template evaluation and path helpers (unchanged)
 */
const TextMeasurer = (() => {
  let canvas; let context;
  function getInstance() { if (!canvas) { canvas = document.createElement('canvas'); context = canvas.getContext('2d'); } return context; }
  return {
    measure: (text, { fontSize = '16px', fontFamily = 'sans-serif', fontWeight = 'normal' } = {}) => {
      const ctx = getInstance(); ctx.font = `${fontWeight} ${fontSize} ${fontFamily}`; return ctx.measureText(text).width;
    },
  };
})();
function evaluateTemplate(template, context = {}) {
  if (typeof template !== 'string' || !template.startsWith('[[[')) return template;
  try { const code = template.substring(3, template.length - 3); const func = new Function(...Object.keys(context), `return ${code}`); return func(...Object.values(context)); }
  catch (e) { cblcarsLog.error('[evaluateTemplate] Error evaluating template:', { template, context, error: e }); return 'TEMPLATE_ERROR'; }
}
function generateRightAnglePath(start, end, { radius = 12, cornerStyle = 'round' } = {}) {
  const [x0, y0] = start; const [x2, y2] = end; const [x1, y1] = [x2, y0];
  if ((x0 === x1 && x1 === x2) || (y0 === y1 && y1 === y2) || cornerStyle === 'sharp' || cornerStyle === 'square') {
    return `M${x0},${y0} L${x1},${y1} L${x2},${y2}`;
  }
  const dx1 = x1 - x0; const dy2 = y2 - y1;
  const r = Math.min(radius, Math.abs(dx1) / 2, Math.abs(dy2) / 2);
  const p1 = [x1 - r * Math.sign(dx1), y1];
  const p2 = [x1, y1 + r * Math.sign(dy2)];
  if (cornerStyle === 'bevel' || cornerStyle === 'miter') return `M${x0},${y0} L${p1[0]},${p1[1]} L${p2[0]},${p2[1]} L${x2},${y2}`;
  const sweep = (dx1 > 0) === (dy2 > 0) ? 1 : 0;
  return `M${x0},${y0} L${p1[0]},${p1[1]} A${r},${r} 0 0 ${sweep} ${p2[0]},${p2[1]} L${x2},${y2}`;
}
function sanitizePoints(points) {
  if (!Array.isArray(points)) return [];
  const out = []; let lastX; let lastY; let haveLast = false;
  for (const p of points) { if (!p || p.length < 2) continue; const x = Number(p[0]); const y = Number(p[1]); if (!Number.isFinite(x) || !Number.isFinite(y)) continue; if (haveLast && x === lastX && y === lastY) continue; out.push([x, y]); lastX = x; lastY = y; haveLast = true; }
  return out;
}
function generateSmoothPath(pts, { tension = 0.5 } = {}) {
  let points = sanitizePoints(pts); if (points.length < 2) { try { return pathFromPoints(points); } catch (_) { return ''; } }
  const k = Math.max(0, Math.min(1, Number(tension))); const handle = (1 - k) * 0.5;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]; const p1 = points[i]; const p2 = points[i + 1] || p1; const p3 = points[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * handle; const c1y = p1[1] + (p2[1] - p0[1]) * handle;
    const c2x = p2[0] - (p3[0] - p1[0]) * handle; const c2y = p2[1] - (p3[1] - p1[1]) * handle;
    if (!Number.isFinite(c1x) || !Number.isFinite(c1y) || !Number.isFinite(c2x) || !Number.isFinite(c2y) || !Number.isFinite(p2[0]) || !Number.isFinite(p2[1])) {
      d += ` L${p2[0]},${p2[1]}`;
    } else {
      d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
  }
  return d;
}
function generateMonotonePath(pts) {
  const points = sanitizePoints(pts); const n = points.length; if (n < 2) return pathFromPoints(points);
  const xs = points.map(p => p[0]); const ys = points.map(p => p[1]); const dx = Array(n - 1); const dy = Array(n - 1); const m = Array(n - 1);
  for (let i = 0; i < n - 1; i++) { dx[i] = xs[i + 1] - xs[i]; dy[i] = ys[i + 1] - ys[i]; m[i] = dy[i] / (dx[i] || 1e-9); }
  const t = Array(n); t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) { t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2; }
  for (let i = 0; i < n - 1; i++) { const a = t[i] / m[i]; const b = t[i + 1] / m[i]; const s = a * a + b * b; if (s > 9) { const tau = 3 / Math.sqrt(s); t[i] = tau * a * m[i]; t[i + 1] = tau * b * m[i]; } }
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const x0 = xs[i], y0 = ys[i]; const x1 = xs[i + 1], y1 = ys[i + 1]; const h = x1 - x0 || 1e-9;
    const c1x = x0 + h / 3; const c1y = y0 + (t[i] * h) / 3; const c2x = x1 - h / 3; const c2y = y1 - (t[i + 1] * h) / 3;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${x1},${y1}`;
  }
  return d;
}
function resolvePoint(point, { anchors, viewBox }) {
  anchors = anchors || {}; if (!point) return null;
  if (typeof point === 'string' && anchors && typeof anchors === 'object' && anchors[point]) return anchors[point];
  if (Array.isArray(point) && point.length === 2) {
    const [minX, minY, width, height] = viewBox;
    const resolve = (val, axis) => (typeof val === 'string' && val.endsWith('%') ? (axis === 'x' ? minX + (parseFloat(val) / 100) * width : minY + (parseFloat(val) / 100) * height) : parseFloat(val));
    const x = resolve(point[0], 'x'); const y = resolve(point[1], 'y'); if (!isNaN(x) && !isNaN(y)) return [x, y];
  }
  return null;
}
function generateWaypointsFromSteps(anchor, steps, context) {
  let pos = resolvePoint(anchor, context); if (!pos) return []; const points = [pos.slice()];
  for (const step of steps) {
    if (step.direction === 'horizontal' && step.to_x !== undefined) { pos = [parseFloat(step.to_x), pos[1]]; }
    else if (step.direction === 'vertical' && step.to_y !== undefined) { pos = [pos[0], parseFloat(step.to_y)]; }
    points.push(pos.slice());
  }
  return points;
}
function generateMultiSegmentPath(points, { cornerStyle = 'round', cornerRadius = 12 } = {}) {
  if (points.length < 2) return '';
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = points[i - 1]; const [x1, y1] = points[i]; const [x2, y2] = points[i + 1];
    const isRightAngle = (x0 === x1 && y1 === y2) || (y0 === y1 && x1 === x2);
    if (!isRightAngle || cornerStyle === 'sharp' || cornerStyle === 'square') { d += ` L${x1},${y1}`; continue; }
    const dx1 = x1 - x0; const dy1 = y1 - y0; const dx2 = x2 - x1; const dy2 = y2 - y1;
    const r = Math.min(cornerRadius, Math.abs(dx1 || dy1) / 2, Math.abs(dx2 || dy2) / 2);
    const p1 = [x1 - Math.sign(dx1) * r, y1 - Math.sign(dy1) * r];
    const p2 = [x1 + Math.sign(dx2) * r, y1 + Math.sign(dy2) * r];
    d += ` L${p1[0]},${p1[1]}`;
    if (cornerStyle === 'round') {
      const sweep = ((dx1 > 0 && dy2 > 0) || (dx1 < 0 && dy2 < 0) || (dy1 > 0 && dx2 < 0) || (dy1 < 0 && dx2 > 0)) ? 1 : 0;
      d += ` A${r},${r} 0 0 ${sweep} ${p2[0]},${p2[1]}`;
    } else {
      d += ` L${p2[0]},${p2[1]}`;
    }
  }
  d += ` L${points[points.length - 1][0]},${points[points.length - 1][1]}`;
  return d;
}

/**
 * Bind actions to a stamped overlay element by id (tap/hold/double/url/navigate/call-service).
 * IMPORTANT: We stop propagation on pointer/click events so the base button-card
 *            does not handle them. We still dispatch 'hass-more-info' which bubbles.
 */
export function bindOverlayActions({ root = document, id, actions = {}, hass, entity }) {
  if (!id || !root) return;
  const el = root.querySelector?.(`#${id}`);
  if (!el) return;

  const key = JSON.stringify(actions);
  if (el.__cblcars_actions_key === key) return;
  if (el.__cblcars_unbind_actions) {
    try { el.__cblcars_unbind_actions(); } catch (_) {}
  }

  try {
    el.style.pointerEvents = 'auto';
    const hasTap = actions.tap_action && actions.tap_action.action && actions.tap_action.action !== 'none';
    el.style.cursor = hasTap ? 'pointer' : (el.style.cursor || 'auto');
  } catch (_) {}

  const a = {
    tap: actions.tap_action || null,
    hold: actions.hold_action || null,
    dbl: actions.double_tap_action || null,
  };

  const exec = async (act) => {
    if (!act || !act.action || act.action === 'none') return;
    const ent = act.entity || entity;
    const service = act.service || (act.service_domain && act.service_name ? `${act.service_domain}.${act.service_name}` : null);

    switch (act.action) {
      case 'more-info': {
        if (!ent) return;
        // This event should bubble; do not stop it.
        const ev = new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId: ent } });
        el.dispatchEvent(ev);
        break;
      }
      case 'toggle': {
        if (!ent || !hass?.callService) return;
        await hass.callService('homeassistant', 'toggle', { entity_id: ent });
        break;
      }
      case 'call-service': {
        if (!service || !hass?.callService) return;
        const [domain, name] = service.split('.');
        const data = act.service_data || {};
        await hass.callService(domain, name, data);
        break;
      }
      case 'navigate': {
        const path = act.navigation_path || act.path || '/';
        try { history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }
        catch (_) { location.assign(path); }
        break;
      }
      case 'url': {
        const url = act.url_path || act.url;
        if (!url) return;
        const tgt = act.new_tab === true ? '_blank' : (act.new_tab === false ? '_self' : '_blank');
        window.open(url, tgt, 'noopener,noreferrer');
        break;
      }
      default:
        break;
    }
  };

  // Stop helper: kill further handling by the base button-card
  const stopAll = (e, prevent = false) => {
    try { e.stopImmediatePropagation?.(); } catch (_) {}
    try { e.stopPropagation?.(); } catch (_) {}
    if (prevent) {
      try { e.preventDefault?.(); } catch (_) {}
    }
  };

  // Hold detection
  let holdTo = null;
  let held = false;
  const holdMs = Math.max(300, Number(a.hold?.hold_time) || 500);

  const onPointerDown = (e) => {
    stopAll(e); // intercept before base card
    held = false;
    if (!a.hold) return;
    clearTimeout(holdTo);
    holdTo = setTimeout(async () => {
      held = true;
      await exec(a.hold);
    }, holdMs);
  };
  const onPointerUp = (e) => {
    stopAll(e);
    clearTimeout(holdTo);
  };
  const onClick = async (e) => {
    stopAll(e);
    if (held) { held = false; return; }
    await exec(a.tap);
  };
  const onDblClick = async (e) => {
    stopAll(e);
    await exec(a.dbl);
  };
  const onContextMenu = (e) => {
    stopAll(e, true);
  };

  // Also guard touch events for Safari/iOS
  const onTouchStart = (e) => {
    stopAll(e);
    onPointerDown(e);
  };
  const onTouchEnd = (e) => {
    stopAll(e);
    onPointerUp(e);
  };

  // Use capture so we intercept as early as possible on the target
  el.addEventListener('pointerdown', onPointerDown, { passive: false, capture: true });
  el.addEventListener('pointerup', onPointerUp, { passive: false, capture: true });
  el.addEventListener('click', onClick, { passive: false, capture: true });
  el.addEventListener('dblclick', onDblClick, { passive: false, capture: true });
  el.addEventListener('contextmenu', onContextMenu, { passive: false, capture: true });
  el.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
  el.addEventListener('touchend', onTouchEnd, { passive: false, capture: true });

  el.__cblcars_actions_key = key;
  el.__cblcars_unbind_actions = () => {
    el.removeEventListener('pointerdown', onPointerDown, { capture: true });
    el.removeEventListener('pointerup', onPointerUp, { capture: true });
    el.removeEventListener('click', onClick, { capture: true });
    el.removeEventListener('dblclick', onDblClick, { capture: true });
    el.removeEventListener('contextmenu', onContextMenu, { capture: true });
    el.removeEventListener('touchstart', onTouchStart, { capture: true });
    el.removeEventListener('touchend', onTouchEnd, { capture: true });
  };
}


/**
 * Stamps MSD overlays into an SVG string and returns queued animations to run after DOM insert.
 * Patched: supports "smart attach_to" for lines where attach_to can be an element id
 * (SVG overlay id or HTML control id). In that case, the path 'd' is deferred and
 * a placeholder <path> is stamped with data-cblcars-* attributes for a later
 * layout pass (layoutPendingConnectors) to compute and set the actual 'd'
 * based on the target element's bounding box, with optional side/align/gap.
 *
 * @param {object} args
 * @param {Array} args.overlays
 * @param {object} args.anchors
 * @param {object} args.styleLayers
 * @param {object} args.hass
 * @param {Element|ShadowRoot} [args.root=document]
 * @param {number[]} [args.viewBox=[0,0,400,200]]
 * @param {object} [args.timelines={}]
 * @param {Array} [args.animations=[]]
 * @param {object} [args.dataSources={}]
 * @returns {{ svgMarkup: string, animationsToRun: Array }}
 */
export function renderMsdOverlay({
  overlays,
  anchors,
  styleLayers,
  hass,
  root = document,
  viewBox = [0, 0, 400, 200],
  timelines = {},
  animations = [],
  dataSources = {},
}) {
  let svgElements = [];
  let animationsToRun = [];
  const presets = styleLayers || {};
  const defaultPreset = presets.default || {};

  if (!anchors || typeof anchors !== 'object') {
    cblcarsLog.warn('[renderMsdOverlay] anchors is missing or not an object. Overlays may not render correctly.', { anchors });
    anchors = {};
  }
  if (!Array.isArray(overlays)) {
    cblcarsLog.warn('[renderMsdOverlay] overlays is not a valid array, skipping.');
    return { svgMarkup: '', animationsToRun: [] };
  }

  // Collect timeline targets to avoid duplicating preset animations
  const timelineTargets = new Set();
  if (timelines && typeof timelines === 'object') {
    Object.values(timelines).forEach((tl) => {
      if (Array.isArray(tl.steps)) {
        tl.steps.forEach((step) => {
          const t = step.targets;
          const add = (sel) => {
            if (typeof sel === 'string' && sel.startsWith('#')) timelineTargets.add(sel.slice(1));
          };
          if (!t) return;
          Array.isArray(t) ? t.forEach(add) : add(t);
        });
      }
    });
  }

  svgOverlayManager.setRoot(root);
  svgOverlayManager.clear();
  svgOverlayManager.setViewBox(viewBox);

  overlays.forEach((overlay, idx) => {
    if (!overlay) return;

    const elementId = overlay.id;
    const overlayPreset = (overlay.preset && presets[overlay.preset]) ? presets[overlay.preset] : {};
    const overlayCopy = { ...overlay }; delete overlayCopy.preset; delete overlayCopy.state_resolver;

    // Resolve state overrides and merge
    let stateOverridesRaw = resolveStatePreset(overlay, presets, hass);
    let stateOverrides = stateOverridesRaw && typeof stateOverridesRaw === 'object' ? { ...stateOverridesRaw } : {};
    if (overlay.type && stateOverrides && typeof stateOverrides === 'object') {
      const typeKey = overlay.type;
      if (stateOverrides[typeKey] && typeof stateOverrides[typeKey] === 'object') {
        stateOverrides = { ...stateOverrides, ...stateOverrides[typeKey] };
        delete stateOverrides[typeKey];
      }
    }

    const type = overlay.type;
    const defaultTypePreset = (defaultPreset && defaultPreset[type]) ? defaultPreset[type] : {};
    const overlayTypePreset = (overlayPreset && overlayPreset[type]) ? overlayPreset[type] : {};

    let computed = resolveOverlayStyles({
      defaults: defaultTypePreset,
      preset: overlayTypePreset,
      customPreset: {},
      overlay: overlayCopy,
      stateOverrides,
      dataSources: {},
    });
    computed = resolveAllDynamicValues(computed, hass);

    const entity = overlay.entity && hass.states[overlay.entity] ? hass.states[overlay.entity] : null;
    const templateContext = { entity, hass, overlay, computed };

    if (computed.visible !== undefined) {
      const isVisible = evaluateTemplate(computed.visible, templateContext);
      if (isVisible === false) return;
    }

    const pointContext = { anchors, viewBox };
    const isText = computed.type === 'text';
    const isLine = computed.type === 'line';
    const isSparkline = computed.type === 'sparkline';
    const isRibbon = computed.type === 'ribbon';
    const isFree = computed.type === 'free';

    // SPARKLINE (unchanged logic)
    if (isSparkline) {
      const srcName = computed.source;
      if (!srcName) { svgOverlayManager.push(`Sparkline "${computed.id || `spark_${idx}`}" requires "source".`); return; }

      const posPt = resolvePoint(computed.position, pointContext);
      const sizeAbs = resolveSize(computed.size, viewBox);
      if (!posPt || !sizeAbs) { svgOverlayManager.push(`Sparkline "${computed.id || `spark_${idx}`}" requires position and size.`); return; }
      const rect = { x: Number(posPt[0]), y: Number(posPt[1]), w: Number(sizeAbs.w), h: Number(sizeAbs.h) };

      const elementId = computed.id || `spark_${idx}`;
      const stroke = computed.color || computed.stroke || 'var(--lcars-yellow)';
      const strokeWidth = computed.width || computed['stroke-width'] || 2;
      const areaFill = computed.area_fill || null;

      let msWindow = parseTimeWindowMs(computed.windowSeconds);
      if (!Number.isFinite(msWindow)) {
        const ws = typeof computed.windowSeconds === 'number' ? computed.windowSeconds : 3600;
        msWindow = ws * 1000;
      }
      msWindow = Math.max(1000, msWindow);

      const yRangeCfg = Array.isArray(computed.y_range) ? computed.y_range : null;

      const xMode = computed.x_mode === 'index' ? 'index' : 'time';
      const extendToEdges = computed.extend_to_edges === true || computed.extend_to_edges === 'both';
      const extendLeft = extendToEdges || computed.extend_to_edges === 'left';
      const extendRight = extendToEdges || computed.extend_to_edges === 'right';
      const ignoreZeroForScale = computed.ignore_zero_for_scale === true;
      const stairStep = computed.stair_step === true;
      const smooth = computed.smooth === true;
      const smoothTension = Number.isFinite(computed.smooth_tension) ? Math.max(0, Math.min(1, computed.smooth_tension)) : 0.5;

      // Grid (non-interactive)
      const gridCfg = computed.grid && typeof computed.grid === 'object' ? computed.grid : null;
      if (gridCfg) {
        const gx = Math.max(0, Number(gridCfg.x ?? 0));
        const gy = Math.max(0, Number(gridCfg.y ?? 0));
        const gStroke = gridCfg.color || 'rgba(255,255,255,0.12)';
        const gOpacity = gridCfg.opacity ?? 0.5;
        const gWidth = gridCfg.width ?? 1;
        let grid = `<g id="${elementId}_grid" opacity="${gOpacity}" stroke="${gStroke}" stroke-width="${gWidth}" style="pointer-events:none;">`;
        if (gx > 0) {
          const dx = rect.w / gx;
          for (let i = 1; i < gx; i++) {
            const x = rect.x + i * dx;
            grid += `<line x1="${x}" y1="${rect.y}" x2="${x}" y2="${rect.y + rect.h}" />`;
          }
        }
        if (gy > 0) {
          const dy = rect.h / gy;
          for (let i = 1; i < gy; i++) {
            const y = rect.y + i * dy;
            grid += `<line x1="${rect.x}" y1="${y}" x2="${rect.x + rect.w}" y2="${y}" />`;
          }
        }
        grid += `</g>`;
        svgElements.push(grid);
      }

      // Base paths (non-interactive)
      const strokeAttr = `stroke="${stroke}"`;
      svgElements.push(`<path id="${elementId}" fill="none" ${strokeAttr} stroke-width="${strokeWidth}" d="" style="pointer-events:none;" />`);
      if (areaFill) svgElements.push(`<path id="${elementId}_area" fill="${areaFill}" stroke="none" d="" style="pointer-events:none;" />`);
      svgElements.push(`<g id="${elementId}_markers" style="pointer-events:none;"></g>`);

      const labelCfg = computed.label_last && typeof computed.label_last === 'object' ? computed.label_last : null;
      if (labelCfg) {
        const labelFill = labelCfg.fill || stroke;
        const labelFontSize = labelCfg.font_size || 14;
        svgElements.push(
          `<text id="${elementId}_label" x="${rect.x}" y="${rect.y}" fill="${labelFill}" font-size="${labelFontSize}" font-family="Antonio" dominant-baseline="central" style="pointer-events:none;"></text>`
        );
      }

      const tracerCfg = (computed.tracer && typeof computed.tracer === 'object') ? computed.tracer : null;
      const tracerR = tracerCfg?.r ?? 0;
      const tracerFill = tracerCfg?.fill || stroke;
      if (tracerCfg && tracerR > 0) {
        svgElements.push(`<circle id="${elementId}_tracer" cx="${rect.x + rect.w}" cy="${rect.y + rect.h / 2}" r="${tracerR}" fill="${tracerFill}" style="pointer-events:none;"></circle>`);
        if (tracerCfg.animation && tracerCfg.animation.type) {
          animationsToRun.push({ ...tracerCfg.animation, targets: `#${elementId}_tracer`, root });
        }
      }

      if (computed.animation && computed.animation.type && !timelineTargets.has(elementId)) {
        animationsToRun.push({ ...computed.animation, targets: `#${elementId}`, root });
      }

      // Data wire-up (unchanged; done after DOM insert by subscribers)
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          try {
            if (window.cblcars?.data?.ensureSources && dataSources && Object.keys(dataSources).length) {
              await window.cblcars.data.ensureSources(dataSources, hass);
            }
            const src = window.cblcars?.data?.getSource?.(srcName);
            const rootEl = root;
            const pathEl = rootEl?.querySelector?.(`#${elementId}`);
            const areaEl = areaFill ? rootEl?.querySelector?.(`#${elementId}_area`) : null;
            const labelEl = labelCfg ? rootEl?.querySelector?.(`#${elementId}_label`) : null;
            const tracerEl = tracerCfg && tracerR > 0 ? rootEl?.querySelector?.(`#${elementId}_tracer`) : null;
            const markersEl = rootEl?.querySelector?.(`#${elementId}_markers`) || null;
            if (!src || !pathEl) return;

            // Helper to hide/unhide sparkline parts while pending
            const setPendingVisibility = (pending) => {
              try {
                if (pending) {
                  pathEl.setAttribute('data-cblcars-pending', 'true');
                  pathEl.style.visibility = 'hidden';
                  if (areaEl) areaEl.style.visibility = 'hidden';
                  if (labelEl) labelEl.style.visibility = 'hidden';
                  if (markersEl) markersEl.style.visibility = 'hidden';
                  if (tracerEl) tracerEl.style.visibility = 'hidden';
                } else {
                  pathEl.removeAttribute('data-cblcars-pending');
                  pathEl.style.visibility = '';
                  if (areaEl) areaEl.style.visibility = '';
                  if (labelEl) labelEl.style.visibility = '';
                  if (markersEl) markersEl.style.visibility = '';
                  if (tracerEl) tracerEl.style.visibility = '';
                }
              } catch (_) {}
            };

            const toStairPoints = (pts) => {
              if (!pts || pts.length < 2) return pts || [];
              const out = [];
              for (let i = 0; i < pts.length - 1; i++) {
                const [x1, y1] = pts[i];
                const [x2] = pts[i + 1];
                out.push([x1, y1], [x2, y1]);
              }
              out.push(pts[pts.length - 1]);
              return out;
            };

            const areaPathFromSmooth = (lineD, firstPt, lastPt, rect) => {
              if (!lineD || !firstPt || !lastPt) return '';
              const baselineY = rect.y + rect.h;
              const body = lineD.startsWith('M') ? lineD.slice(1) : lineD;
              return `M${firstPt[0]},${baselineY} L${firstPt[0]},${firstPt[1]} ${body} L${lastPt[0]},${baselineY} Z`;
            };

            const refresh = () => {
              const slice = src.buffer.sliceSince ? src.buffer.sliceSince(msWindow) : sliceWindow(src.buffer, msWindow);
              const t = slice.t || [];
              const v = slice.v || [];

              if (!t.length) {
                const y0 = rect.y + rect.h;
                pathEl.setAttribute('d', `M${rect.x},${y0} L${rect.x + rect.w},${y0}`);
                setPendingVisibility(true);
                if (areaEl) areaEl.setAttribute('d', '');
                if (labelEl) labelEl.textContent = '';
                if (markersEl) markersEl.innerHTML = '';
                if (tracerEl) {
                  tracerEl.setAttribute('cx', String(rect.x + rect.w));
                  tracerEl.setAttribute('cy', String(rect.y + rect.h / 2));
                }
                return;
              }

              const vScale = ignoreZeroForScale ? v.filter((n) => n !== 0) : v;
              const yr = computeYRange(vScale.length ? vScale : v, yRangeCfg);

              let pts = xMode === 'index' ? mapToRectIndex(v, rect, yr) : mapToRect(t, v, rect, msWindow, yr);

              if (stairStep) pts = toStairPoints(pts);

              if (pts.length) {
                const firstY = pts[0][1];
                const lastY = pts[pts.length - 1][1];
                if (extendLeft && pts[0][0] > rect.x) pts.unshift([rect.x, firstY]);
                if (extendRight && pts[pts.length - 1][0] < rect.x + rect.w) pts.push([rect.x + rect.w, lastY]);
              }

              pts = sanitizePoints(pts);
              if (!pts.length) {
                const y0 = rect.y + rect.h;
                pathEl.setAttribute('d', `M${rect.x},${y0} L${rect.x + rect.w},${y0}`);
                setPendingVisibility(true);
                if (areaEl) areaEl.setAttribute('d', '');
                if (labelEl) labelEl.textContent = '';
                if (markersEl) markersEl.innerHTML = '';
                if (tracerEl) {
                  tracerEl.setAttribute('cx', String(rect.x + rect.w));
                  tracerEl.setAttribute('cy', String(rect.y + rect.h / 2));
                }
                return;
              }

              // We have real points → unhide
              setPendingVisibility(false);

              if (smooth && pts.length > 1) {
                const dSmooth = generateSmoothPath(pts, { tension: smoothTension });
                pathEl.setAttribute('d', dSmooth);
                if (areaEl) {
                  const firstPt = pts[0];
                  const lastPt = pts[pts.length - 1];
                  areaEl.setAttribute('d', areaPathFromSmooth(dSmooth, firstPt, lastPt, rect));
                }
              } else {
                const d = pathFromPoints(pts);
                pathEl.setAttribute('d', d);
                if (areaEl) areaEl.setAttribute('d', areaPathFromPoints(pts, rect));
              }

              if (markersEl) {
                const markerRadius = Number(computed.markers?.r ?? 0);
                const markerFill = computed.markers?.fill || stroke;
                const markersMax = Number.isFinite(computed.markers?.max) ? Math.max(1, computed.markers.max) : 200;
                if (markerRadius > 0) {
                  const limit = Math.min(pts.length, markersMax);
                  let circles = '';
                  for (let i = Math.max(0, pts.length - limit); i < pts.length; i++) {
                    const [cx, cy] = pts[i];
                    circles += `<circle cx="${cx}" cy="${cy}" r="${markerRadius}" fill="${markerFill}" />`;
                  }
                  markersEl.innerHTML = circles;
                } else {
                  markersEl.innerHTML = '';
                }
              }

              if (labelEl) {
                const decimals = Number.isFinite(labelCfg.decimals) ? labelCfg.decimals : 1;
                const format = labelCfg.format || null;
                const offset = Array.isArray(labelCfg.offset) ? labelCfg.offset : [8, -8];
                const lastVal = v[v.length - 1];
                const lastPt = pts[pts.length - 1];
                const formatted = format ? String(format).replace('{v}', Number(lastVal).toFixed(decimals)) : Number(lastVal).toFixed(decimals);
                labelEl.textContent = formatted;
                labelEl.setAttribute('x', String(lastPt[0] + (offset[0] ?? 0)));
                labelEl.setAttribute('y', String(lastPt[1] + (offset[1] ?? 0)));
              }

              if (tracerEl) {
                const lastPt = pts[pts.length - 1];
                tracerEl.setAttribute('cx', String(lastPt[0]));
                tracerEl.setAttribute('cy', String(lastPt[1]));
              }
            };

            refresh();
            if (pathEl.__cblcars_unsub_spark) { try { pathEl.__cblcars_unsub_spark(); } catch (_) {} }
            pathEl.__cblcars_unsub_spark = src.subscribe(() => refresh());
            setTimeout(refresh, 0);
            setTimeout(refresh, 100);
          } catch (_) {}
        });
      });

      return;
    }

    // RIBBON (unchanged logic)
    if (isRibbon) {
      const posPt = resolvePoint(computed.position, pointContext);
      const sizeAbs = resolveSize(computed.size, viewBox);
      if (!posPt || !sizeAbs) { svgOverlayManager.push(`Ribbon "${computed.id || `ribbon_${idx}`}" requires position and size.`); return; }
      const rect = { x: Number(posPt[0]), y: Number(posPt[1]), w: Number(sizeAbs.w), h: Number(sizeAbs.h) };
      const elementId = computed.id || `ribbon_${idx}`;

      const sourcesArr = Array.isArray(computed.sources) && computed.sources.length ? computed.sources : (computed.source ? [computed.source] : []);
      if (sourcesArr.length === 0) { svgOverlayManager.push(`Ribbon "${elementId}" requires "source" or "sources".`); return; }

      let msWindow = parseTimeWindowMs(computed.windowSeconds);
      if (!Number.isFinite(msWindow)) { const ws = typeof computed.windowSeconds === 'number' ? computed.windowSeconds : 3600; msWindow = ws * 1000; }
      msWindow = Math.max(1000, msWindow);

      const onColor = computed.on_color || 'var(--lcars-yellow)';
      const offColor = computed.off_color || null;
      const opacity = computed.opacity ?? 1;
      const rx = Number.isFinite(computed.rx) ? Number(computed.rx) : 0;
      const ry = Number.isFinite(computed.ry) ? Number(computed.ry) : rx;
      const threshold = Number.isFinite(computed.threshold) ? Number(computed.threshold) : 1;
      const laneGap = Math.max(0, Number(computed.lane_gap ?? 2));

      if (offColor) {
        svgElements.push(`<rect id="${elementId}_backdrop" x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="${offColor}" opacity="${opacity}" rx="${rx}" ry="${ry}" style="pointer-events:none;" />`);
      }
      svgElements.push(`<g id="${elementId}" opacity="${opacity}" style="pointer-events:none;"></g>`);

      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          try {
            if (window.cblcars?.data?.ensureSources && dataSources && Object.keys(dataSources).length) {
              await window.cblcars.data.ensureSources(dataSources, hass);
            }
            const rootEl = root;
            const groupEl = rootEl?.querySelector?.(`#${elementId}`);
            if (!groupEl) return;

            const laneCount = sourcesArr.length;
            const laneHeight = laneCount > 0 ? (rect.h - laneGap * (laneCount - 1)) / laneCount : rect.h;

            const mapTimeToX = (ts, rect, windowMs) => {
              const now = Date.now();
              const dt = now - ts;
              const frac = Math.max(0, Math.min(1, 1 - dt / windowMs));
              return rect.x + frac * rect.w;
            };
            const buildOnSegments = (tArr, vArr, windowMs, th) => {
              const segs = []; let inSeg = false; let startTs = null;
              for (let i = 0; i < tArr.length; i++) {
                const on = Number(vArr[i]) >= th;
                if (on && !inSeg) { inSeg = true; startTs = tArr[i]; }
                else if (!on && inSeg) { inSeg = false; segs.push([startTs, tArr[i]]); }
              }
              if (inSeg) segs.push([startTs, tArr[tArr.length - 1]]);
              return segs;
            };

            const refresh = () => {
              let html = '';
              for (let lane = 0; lane < laneCount; lane++) {
                const srcName = sourcesArr[lane];
                const src = window.cblcars?.data?.getSource?.(srcName);
                if (!src) continue;

                const slice = src.buffer.sliceSince ? src.buffer.sliceSince(msWindow) : sliceWindow(src.buffer, msWindow);
                const t = slice.t || [];
                const v = slice.v || [];
                if (!t.length) continue;

                const segs = buildOnSegments(t, v, msWindow, threshold);
                const yTop = rect.y + lane * (laneHeight + laneGap);
                for (const [ts0, ts1] of segs) {
                  const x0 = mapTimeToX(ts0, rect, msWindow);
                  const x1 = mapTimeToX(ts1, rect, msWindow);
                  const w = Math.max(0, x1 - x0);
                  if (w <= 0) continue;
                  html += `<rect x="${x0}" y="${yTop}" width="${w}" height="${laneHeight}" fill="${onColor}" rx="${rx}" ry="${ry}" />`;
                }
              }
              groupEl.innerHTML = html;
            };

            refresh();
            const unsubs = [];
            for (const srcName of sourcesArr) {
              const src = window.cblcars?.data?.getSource?.(srcName);
              if (src) unsubs.push(src.subscribe(() => refresh()));
            }
            if (groupEl.__cblcars_unsub_ribbon) {
              try { groupEl.__cblcars_unsub_ribbon.forEach((fn) => fn && fn()); } catch (_) {}
            }
            groupEl.__cblcars_unsub_ribbon = unsubs;

            setTimeout(refresh, 0);
            setTimeout(refresh, 100);
          } catch (_) {}
        });
      });

      return;
    }

    // TEXT
    if (isText) {
      const posPt = resolvePoint(computed.position, pointContext);
      if (!posPt) { svgOverlayManager.push(`Text overlay "${elementId || `text_${idx}`}" has invalid position.`); return; }
      const xOff = Number(computed.x_offset ?? 0);
      const yOff = Number(computed.y_offset ?? 0);
      const x = posPt[0] + xOff;
      const y = posPt[1] + yOff;

      const textValue = evaluateTemplate(computed.value, templateContext) ?? '';
      const { attrs, style } = splitAttrsAndStyle(computed, 'text');
      attrs['dominant-baseline'] = attrs['dominant-baseline'] || 'middle';
      if (!attrs['text-anchor'] && computed.align) attrs['text-anchor'] = computed.align;

      const hasActions = !!(overlay.tap_action || overlay.hold_action || overlay.double_tap_action || overlay.actions);
      style['pointer-events'] = hasActions ? 'auto' : 'none';
      if (hasActions) style['cursor'] = 'pointer';

      svgElements.push(svgHelpers.drawText({ x, y, text: textValue, id: elementId, attrs, style }));

      if (computed.animation && computed.animation.type && !timelineTargets.has(elementId)) {
        animationsToRun.push({ ...computed.animation, targets: `#${elementId}`, root });
      }
      return;
    }

    // LINE (patched to support attach_to as element id with deferred path)
    if (isLine) {
      const thisId = elementId || `line_${idx}`;
      let d = '';
      const cornerStyle = (computed.corner_style || 'round').toLowerCase();
      const cornerRadius = Number.isFinite(computed.corner_radius) ? Number(computed.corner_radius) : 12;

      if (Array.isArray(computed.points) && computed.points.length >= 2) {
        const pts = computed.points.map((p) => resolvePoint(p, pointContext)).filter(Boolean);
        if (pts.length >= 2) d = generateMultiSegmentPath(pts, { cornerStyle, cornerRadius });
      } else if (Array.isArray(computed.steps) && computed.steps.length > 0) {
        const pts = generateWaypointsFromSteps(computed.anchor ?? overlay.anchor, computed.steps, pointContext);
        if (pts.length >= 2) d = generateMultiSegmentPath(pts, { cornerStyle, cornerRadius });
      } else {
        // Start: must be resolvable
        const start = resolvePoint(computed.anchor ?? overlay.anchor, pointContext);

        // End: try to resolve as coordinate/anchor first
        let end = resolvePoint(computed.attach_to ?? overlay.attach_to, pointContext);

        // If not resolved, and attach_to is a non-empty string, treat as element id (SVG/Control)
        const attachRaw = computed.attach_to ?? overlay.attach_to;
        const attachIsElementId =
          !end &&
          typeof attachRaw === 'string' &&
          attachRaw.trim().length > 0;

        if (!start) {
          svgOverlayManager.push(`Line overlay "${thisId}" requires valid "anchor".`);
          return;
        }

        if (end) {
          // Standard elbow path (anchor/point → anchor/point)
          d = generateRightAnglePath(start, end, { radius: cornerRadius, cornerStyle });
        } else if (attachIsElementId) {
          // Defer: stamp placeholder and tag for post-layout connector computation
          d = ''; // computed later by layoutPendingConnectors

          // Build attributes/style as usual
          const { attrs, style } = splitAttrsAndStyle(computed, 'line');
          attrs.fill = 'none';
          if (!attrs.stroke && computed.color) attrs.stroke = computed.color;
          if (!attrs['stroke-width'] && computed.width) attrs['stroke-width'] = computed.width;

          const hasActions = !!(overlay.tap_action || overlay.hold_action || overlay.double_tap_action || overlay.actions);
          style['pointer-events'] = hasActions ? 'auto' : 'none';
          if (hasActions) style['cursor'] = 'pointer';

          // Connector metadata for later layout
          attrs['data-cblcars-attach-to'] = String(attachRaw);
          attrs['data-cblcars-start-x'] = String(start[0]);
          attrs['data-cblcars-start-y'] = String(start[1]);
          if (computed.attach_side) attrs['data-cblcars-side'] = String(computed.attach_side);
          if (computed.attach_align) attrs['data-cblcars-align'] = String(computed.attach_align);
          if (computed.attach_gap !== undefined) attrs['data-cblcars-gap'] = String(computed.attach_gap);
          attrs['data-cblcars-radius'] = String(cornerRadius);
          attrs['data-cblcars-corner-style'] = cornerStyle;

          // Stamp the placeholder path
          svgElements.push(svgHelpers.drawPath({ d, id: thisId, attrs, style }));

          // Queue animation if any (note: CSS 'march' is fine with late 'd' updates)
          if (computed.animation && computed.animation.type && !timelineTargets.has(thisId)) {
            animationsToRun.push({ ...computed.animation, targets: `#${thisId}`, root });
          }
          return;
        } else {
          svgOverlayManager.push(`Line overlay "${thisId}" requires valid "attach_to".`);
          return;
        }
      }

      if (!d) { svgOverlayManager.push(`Line overlay "${thisId}" failed to compute path.`); return; }

      const { attrs, style } = splitAttrsAndStyle(computed, 'line');
      attrs.fill = 'none';
      if (!attrs.stroke && computed.color) attrs.stroke = computed.color;
      if (!attrs['stroke-width'] && computed.width) attrs['stroke-width'] = computed.width;

      const hasActions = !!(overlay.tap_action || overlay.hold_action || overlay.double_tap_action || overlay.actions);
      style['pointer-events'] = hasActions ? 'auto' : 'none';
      if (hasActions) style['cursor'] = 'pointer';

      svgElements.push(svgHelpers.drawPath({ d, id: thisId, attrs, style }));

      if (computed.animation && computed.animation.type && !timelineTargets.has(thisId)) {
        animationsToRun.push({ ...computed.animation, targets: `#${thisId}`, root });
      }
      return;
    }

    // FREE (no SVG stamp; handled in animations)
    if (isFree) {
      if (computed.animation && computed.animation.type && computed.targets && !timelineTargets.has(elementId)) {
        animationsToRun.push({ ...computed.animation, targets: computed.targets, root, id: elementId });
      }
      return;
    }
  });

  // Error group container
  svgElements.push(`<g id="${svgOverlayManager.containerId}"></g>`);

  // Root SVG MUST allow pointer events; interactive children opt-in with pointer-events:auto, others set to none.
  const svgMarkup = `<svg viewBox="${viewBox.join(' ')}" width="100%" height="100%" style="pointer-events:auto;">${svgElements.join('')}</svg>`;

  // Standalone animations (unchanged core)
  if (Array.isArray(animations)) {
    animations.forEach((anim) => {
      let animCfg = { ...anim };
      if (!animCfg.type && animCfg.animation && animCfg.animation.type) {
        animCfg = { ...animCfg.animation, targets: animCfg.targets ?? animCfg.animation.targets, id: animCfg.id ?? animCfg.animation.id };
      }
      try { const overrides = resolveStatePreset(animCfg, presets, hass); if (overrides && typeof overrides === 'object') Object.assign(animCfg, overrides); } catch (e) {}
      animCfg = resolveAllDynamicValues(animCfg, hass);

      let targetsArr = [];
      if (animCfg.targets) targetsArr = Array.isArray(animCfg.targets) ? animCfg.targets : [animCfg.targets];
      else if (animCfg.id) targetsArr = [`#${animCfg.id}`];

      const filteredTargets = targetsArr.filter((sel) => {
        if (typeof sel === 'string' && sel.startsWith('#')) return !timelineTargets.has(sel.slice(1));
        return true;
      });
      if (filteredTargets.length > 0) {
        const finalTargets = filteredTargets.length === 1 ? filteredTargets[0] : filteredTargets;
        animationsToRun.push({ ...animCfg, targets: finalTargets, root });
      }
    });
  }

  return { svgMarkup, animationsToRun };
}