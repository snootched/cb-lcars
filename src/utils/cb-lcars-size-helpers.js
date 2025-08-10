/**
 * Resolve [w, h] where entries can be numbers or percentage strings ('25%').
 * Returns absolute values in viewBox units.
 * @param {Array<string|number>} size
 * @param {number[]} viewBox [minX, minY, width, height]
 * @returns {{w:number,h:number}|null}
 */
export function resolveSize(size, viewBox) {
  if (!Array.isArray(size) || size.length !== 2) return null;
  const [, , vw, vh] = viewBox || [0, 0, 400, 200];
  const toDim = (val, max) => {
    if (typeof val === 'string' && val.trim().endsWith('%')) {
      const pct = parseFloat(val) / 100;
      return pct * max;
    }
    const n = Number(val);
    return isFinite(n) ? n : NaN;
  };
  const w = toDim(size[0], vw);
  const h = toDim(size[1], vh);
  if (!isFinite(w) || !isFinite(h)) return null;
  return { w, h };
}