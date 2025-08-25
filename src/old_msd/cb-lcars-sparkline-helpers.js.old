/**
 * Utilities to render sparkline paths from a RollingBuffer.
 * History is preloaded by the DataBus when history.preload: true is set on the source.
 */

/**
 * Get a time-window slice from buffer.
 * @param {{t:number[], v:number[]}} buffer
 * @param {number} msWindow
 */
export function sliceWindow(buffer, msWindow) {
  const cutoff = Date.now() - msWindow;
  const t = buffer.t;
  const v = buffer.v;
  let i = 0;
  while (i < t.length && t[i] < cutoff) i++;
  return { t: t.slice(i), v: v.slice(i) };
}

/**
 * Compute y-range (min/max) either from config or from data with padding.
 * @param {number[]} values
 * @param {[number,number]|undefined} cfgRange
 * @param {number} padFraction
 */
export function computeYRange(values, cfgRange, padFraction = 0.1) {
  if (cfgRange && cfgRange.length === 2 && isFinite(cfgRange[0]) && isFinite(cfgRange[1])) {
    return { min: Number(cfgRange[0]), max: Number(cfgRange[1]) };
  }
  if (!values || values.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05);
    return { min: min - pad, max: max + pad };
  }
  const pad = (max - min) * padFraction;
  return { min: min - pad, max: max + pad };
}

/**
 * Map timestamps/values to points in a rect.
 * @param {number[]} ts
 * @param {number[]} vs
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @param {number} msWindow
 * @param {{min:number,max:number}} yr
 */
export function mapToRect(ts, vs, rect, msWindow, yr) {
  const now = Date.now();
  const out = [];
  const xMap = (t) => {
    const dt = now - t;
    const frac = Math.max(0, Math.min(1, 1 - dt / msWindow));
    return rect.x + frac * rect.w;
  };
  const yMap = (v) => {
    const clamped = Math.max(yr.min, Math.min(yr.max, v));
    const frac = (clamped - yr.min) / (yr.max - yr.min || 1);
    return rect.y + (1 - frac) * rect.h; // SVG y grows down; higher value => smaller y
  };
  for (let i = 0; i < ts.length; i++) {
    out.push([xMap(ts[i]), yMap(vs[i])]);
  }
  return out;
}

/**
 * Map values to points with evenly spaced X across the rect (index mode).
 * @param {number[]} vs
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @param {{min:number,max:number}} yr
 * @returns {Array<[number,number]>}
 */
export function mapToRectIndex(vs, rect, yr) {
  const n = vs?.length || 0;
  if (n === 0) return [];
  const xAt = (i) => {
    if (n === 1) return rect.x + rect.w;
    return rect.x + (i / (n - 1)) * rect.w;
  };
  const yMap = (v) => {
    const clamped = Math.max(yr.min, Math.min(yr.max, v));
    const frac = (clamped - yr.min) / (yr.max - yr.min || 1);
    return rect.y + (1 - frac) * rect.h;
  };
  const out = [];
  for (let i = 0; i < n; i++) out.push([xAt(i), yMap(vs[i])]);
  return out;
}

/**
 * Build a simple polyline path "M x,y L x,y ..."
 * @param {Array<[number,number]>} pts
 */
export function pathFromPoints(pts) {
  if (!pts || pts.length === 0) return '';
  if (pts.length === 1) {
    const [x, y] = pts[0];
    return `M${x},${y} L${x},${y}`;
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L${pts[i][0]},${pts[i][1]}`;
  }
  return d;
}

/**
 * Build a closed area path beneath the line down to rect baseline.
 * @param {Array<[number,number]>} pts
 * @param {{x:number,y:number,w:number,h:number}} rect
 */
export function areaPathFromPoints(pts, rect) {
  if (!pts || pts.length === 0) return '';
  const baselineY = rect.y + rect.h;
  let d = `M${pts[0][0]},${baselineY}`;
  for (let i = 0; i < pts.length; i++) {
    d += ` L${pts[i][0]},${pts[i][1]}`;
  }
  d += ` L${pts[pts.length - 1][0]},${baselineY} Z`;
  return d;
}