import { computeChecksum } from '../util/checksum.js';

const BUILTIN_SVGS = {
  'ncc-1701-a-blue': `
<svg id="ncc-1701-a-blue" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
  <circle id="cpu" cx="120" cy="80" r="6" />
  <circle id="mem" cx="260" cy="80" r="6" />
  <text id="label_a" x="400" y="40">A</text>
  <g id="placeholder_anchor"></g>
</svg>`
};

// Cache by source string checksum.
const cache = new Map();

export async function loadSvg(baseSvg, issues) {
  if (!baseSvg || !baseSvg.source) return null;
  const src = baseSvg.source;
  if (src.startsWith('builtin:')) {
    const key = src.slice('builtin:'.length);
    const raw = BUILTIN_SVGS[key];
    if (!raw) {
      issues.warnings.push({ code: 'svg.not_found', message: `Builtin SVG ${key} not found` });
      return null;
    }
    const hash = computeChecksum(raw);
    cache.set(hash, raw);
    return { raw, hash, origin: src };
  }
  // TODO: external /local/ or url handling (Phase later).
  issues.warnings.push({ code: 'svg.source.unsupported', message: `SVG source scheme unsupported in Phase A: ${src}` });
  return null;
}

export function extractViewBox(raw) {
  const m = raw.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (!m) return null;
  const parts = m[1].trim().split(/\s+/).map(Number);
  if (parts.length === 4 && parts.every(n => Number.isFinite(n))) return parts;
  return null;
}

export function extractAnchors(raw) {
  const anchors = {};
  // circle
  raw.replace(/<circle\b[^>]*id="([^"]+)"[^>]*>/gim, (_m, id) => {
    const cx = attrNum(_m, 'cx');
    const cy = attrNum(_m, 'cy');
    if (cx != null && cy != null) anchors[id] = [cx, cy];
    return '';
  });
  // text
  raw.replace(/<text\b[^>]*id="([^"]+)"[^>]*>/gim, (_m, id) => {
    const x = attrNum(_m, 'x');
    const y = attrNum(_m, 'y');
    if (x != null && y != null) anchors[id] = [x, y];
    return '';
  });
  // g placeholders
  raw.replace(/<g\b[^>]*id="([^"]+)"[^>]*>/gim, (_m, id) => {
    if (!anchors[id]) anchors[id] = null;
    return '';
  });
  return anchors;
}

function attrNum(tag, name) {
  const m = tag.match(new RegExp(name + '="([^"]+)"', 'i'));
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}
