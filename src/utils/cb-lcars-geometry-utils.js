/**
 * CB-LCARS Geometry Utilities (CTM-based)
 * Centralized, cached coordinate transforms for MSD layers.
 *
 * Responsibilities:
 * - Find the reference SVG and viewBox
 * - Get screen CTM and its inverse (cached)
 * - Map between viewBox units and screen (CSS pixel) coordinates
 * - Produce host-relative CSS for control/overlay placement
 *
 * Usage:
 *  - import * as geo from './utils/cb-lcars-geometry-utils.js';
 *  - geo.mapViewBoxRectToHostCss(root, { x, y, w, h }) -> { left, top, width, height } (px strings)
 *
 * All functions are safe if CTM is temporarily unavailable (they return null/fallback).
 */

/** @typedef {[number,number,number,number]} ViewBox */

const CTM_CACHE = new WeakMap(); // WeakMap<SVGSVGElement, { ctm: DOMMatrix, inv: DOMMatrix, w: number, h: number }>

/**
 * Get the reference SVG used by MSD overlays.
 * Preference: overlays SVG, then base wrapper SVG.
 * @param {Element|ShadowRoot|Document} root
 * @returns {SVGSVGElement|null}
 */
export function getReferenceSvg(root) {
  return (
    root?.querySelector?.('#msd_svg_overlays svg') ||
    root?.querySelector?.('#cblcars-msd-wrapper svg') ||
    null
  );
}

/**
 * Get the SVG viewBox tuple [minX, minY, width, height].
 * @param {Element|ShadowRoot|Document} root
 * @param {SVGSVGElement} [svgEl]
 * @returns {ViewBox|null}
 */
export function getViewBox(root, svgEl = null) {
  const svg = svgEl || getReferenceSvg(root);
  if (!svg) return null;
  const vbAttr = svg.getAttribute('viewBox');
  if (!vbAttr) return null;
  const parts = vbAttr.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) return null;
  return /** @type {ViewBox} */ (parts);
}

/**
 * Get and cache the screen CTM and its inverse for a given SVG.
 * Cache invalidates when the element's bounding rect size changes.
 * @param {SVGSVGElement} svg
 * @returns {{ctm: DOMMatrix, inv: DOMMatrix}|null}
 */
export function getCtmPair(svg) {
  if (!svg?.getScreenCTM) return null;
  try {
    const r = svg.getBoundingClientRect?.();
    const cache = CTM_CACHE.get(svg);
    if (cache && r && cache.w === r.width && cache.h === r.height) {
      return { ctm: cache.ctm, inv: cache.inv };
    }
    const ctm = svg.getScreenCTM();
    if (!ctm || typeof ctm.inverse !== 'function') return null;
    const inv = ctm.inverse();
    if (r) CTM_CACHE.set(svg, { ctm, inv, w: r.width, h: r.height });
    return { ctm, inv };
  } catch (_) {
    return null;
  }
}

/**
 * Map a viewBox point to screen (CSS pixel) coordinates using CTM.
 * @param {SVGSVGElement} svg
 * @param {number} x
 * @param {number} y
 * @returns {{x:number,y:number}|null}
 */
export function viewBoxPointToScreen(svg, x, y) {
  const pair = getCtmPair(svg);
  if (!pair) return null;
  const { ctm } = pair;
  // DOMPoint → matrixTransform
  const p = window.DOMPoint ? new DOMPoint(x, y) : { x, y, matrixTransform: (m) => ({ x: x * m.a + m.e, y: y * m.d + m.f }) };
  const out = p.matrixTransform(ctm);
  return { x: out.x, y: out.y };
}

/**
 * Map a viewBox rect to screen (CSS pixel) rect using CTM.
 * @param {SVGSVGElement} svg
 * @param {{x:number,y:number,w:number,h:number}} vb
 * @returns {{left:number,top:number,width:number,height:number}|null}
 */
export function viewBoxRectToScreen(svg, vb) {
  const p0 = viewBoxPointToScreen(svg, vb.x, vb.y);
  const p1 = viewBoxPointToScreen(svg, vb.x + vb.w, vb.y + vb.h);
  if (!p0 || !p1) return null;
  const left = Math.min(p0.x, p1.x);
  const top = Math.min(p0.y, p1.y);
  const width = Math.abs(p1.x - p0.x);
  const height = Math.abs(p1.y - p0.y);
  return { left, top, width, height };
}

/**
 * Map a screen (CSS pixel) point to viewBox using inverse CTM.
 * @param {SVGSVGElement} svg
 * @param {number} sx
 * @param {number} sy
 * @returns {{x:number,y:number}|null}
 */
export function screenPointToViewBox(svg, sx, sy) {
  const pair = getCtmPair(svg);
  if (!pair) return null;
  const { inv } = pair;
  const p = window.DOMPoint ? new DOMPoint(sx, sy) : { x: sx, y: sy, matrixTransform: (m) => ({ x: sx * m.a + m.e, y: sy * m.d + m.f }) };
  const out = p.matrixTransform(inv);
  return { x: out.x, y: out.y };
}

/**
 * Map a screen (CSS pixel) rect (e.g., getBoundingClientRect) to viewBox rect via inverse CTM.
 * @param {SVGSVGElement} svg
 * @param {DOMRect} rect
 * @returns {{x:number,y:number,w:number,h:number}|null}
 */
export function screenRectToViewBox(svg, rect) {
  const p0 = screenPointToViewBox(svg, rect.left, rect.top);
  const p1 = screenPointToViewBox(svg, rect.right, rect.bottom);
  if (!p0 || !p1) return null;
  const x = Math.min(p0.x, p1.x);
  const y = Math.min(p0.y, p1.y);
  const w = Math.abs(p1.x - p0.x);
  const h = Math.abs(p1.y - p0.y);
  return { x, y, w, h };
}

/**
 * Get the content box rect (CSS pixels) we align the host to.
 * Tries #cblcars-msd-wrapper first, else fallback to the reference SVG’s bounding rect.
 * @param {Element|ShadowRoot} root
 * @returns {DOMRect|null}
 */
export function getContentRect(root) {
  const box = root?.querySelector?.('#cblcars-msd-wrapper');
  const r = box?.getBoundingClientRect?.();
  if (r && r.width > 0 && r.height > 0) return r;
  const svg = getReferenceSvg(root);
  const s = svg?.getBoundingClientRect?.();
  return s && s.width > 0 && s.height > 0 ? s : null;
}

/**
 * Map a viewBox rect into host-relative CSS pixel strings {left,top,width,height}.
 * hostRect defaults to the controls host (#cblcars-controls-layer) if present;
 * otherwise we subtract the contentRect’s top-left (wrapper/SVG).
 * @param {Element|ShadowRoot} root
 * @param {{x:number,y:number,w:number,h:number}} vb
 * @param {DOMRect|null} [hostRect]
 * @returns {{left:string,top:string,width:string,height:string}|null}
 */
export function mapViewBoxRectToHostCss(root, vb, hostRect = null) {
  const svg = getReferenceSvg(root);
  if (!svg) return null;
  const screenRect = viewBoxRectToScreen(svg, vb);
  if (!screenRect) return null;

  const hostEl = root.getElementById ? root.getElementById('cblcars-controls-layer') : null;
  const hRect = hostRect || hostEl?.getBoundingClientRect?.() || getContentRect(root);
  if (!hRect) return null;

  const left = screenRect.left - hRect.left;
  const top = screenRect.top - hRect.top;
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${screenRect.width}px`,
    height: `${screenRect.height}px`,
  };
}

/**
 * Convert a pixel gap (number in px) to viewBox units using CTM scale (X axis).
 * @param {Element|ShadowRoot} root
 * @param {number} px
 * @returns {number|null}
 */
export function pxGapToViewBox(root, px) {
  const svg = getReferenceSvg(root);
  if (!svg) return null;
  const pair = getCtmPair(svg);
  if (!pair || !pair.ctm) return null;
  const sx = pair.ctm.a || 1; // scaleX
  return px / sx;
}