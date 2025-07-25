// --- SVG Helpers ---

export function drawLine({ x1, y1, x2, y2, id, attrs = {}, style = {} }) {
  const attrsStr = attrsToString(attrs);
  const styleStr = styleToString(style);
  return `<line id="${id || ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${attrsStr}${styleStr} />`;
}

export function drawPolyline({ points, id, attrs = {}, style = {} }) {
  const pts = points.map(pt => pt.join(',')).join(' ');
  const attrsStr = attrsToString(attrs);
  const styleStr = styleToString(style);
  return `<polyline id="${id || ''}" points="${pts}"${attrsStr}${styleStr} />`;
}

export function drawPath({ d, id, attrs = {}, style = {} }) {
  const attrsStr = attrsToString(attrs);
  const styleStr = styleToString(style);
  return `<path id="${id || ''}" d="${d}"${attrsStr}${styleStr} />`;
}

export function drawText({ x, y, text, id, attrs = {}, style = {} }) {
  const attrsStr = attrsToString(attrs);
  const styleStr = styleToString(style);
  return `<text id="${id || ''}" x="${x}" y="${y}"${attrsStr}${styleStr}>${text}</text>`;
}

// --- Utility helpers ---

export function attrsToString(attrs) {
  if (!attrs || typeof attrs !== "object") return '';
  return Object.entries(attrs)
    .map(([k, v]) => ` ${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}="${v}"`)
    .join('');
}

export function styleToString(style) {
  if (!style || typeof style !== "object") return "";
  const s = Object.entries(style)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`)
    .join(';');
  return s ? ` style="${s}"` : '';
}