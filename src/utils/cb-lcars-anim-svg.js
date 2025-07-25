//OLD FILE


/**
 * Find anchor points in an SVG string.
 * Supports <circle> and <text> with id attributes.
 * Returns: { anchorId: [x, y], ... }
 */
export function findSvgAnchors(svgContent) {
  const anchors = {};
  // Circles
  const circleRegex = /<circle[^>]*\sid="([^"]+)"[^>]*\scx="([^"]+)"[^>]*\scy="([^"]+)"[^>]*>/g;
  let m;
  while ((m = circleRegex.exec(svgContent)) !== null) {
    anchors[m[1]] = [parseFloat(m[2]), parseFloat(m[3])];
  }
  // Texts
  const textRegex = /<text[^>]*\sid="([^"]+)"[^>]*\sx="([^"]+)"[^>]*\sy="([^"]+)"[^>]*>/g;
  while ((m = textRegex.exec(svgContent)) !== null) {
    anchors[m[1]] = [parseFloat(m[2]), parseFloat(m[3])];
  }
  return anchors;
}

/**
 * Draw a glowing SVG line (with optional arrowhead).
 * Returns SVG string.
 */
export function renderMsdGlowLine({
  id, x1, y1, x2, y2,
  stroke_color = '#ff9900',
  stroke_width = 4,
  glow_color = '#ff9900',
  glow_blur = 4,
  arrow_end = false
}) {
  const marker = arrow_end ? 'marker-end="url(#arrowhead)"' : '';
  return `
    <defs>
      <filter id="glow-${id}" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="${glow_blur}" flood-color="${glow_color}" />
      </filter>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="${stroke_color}" />
      </marker>
    </defs>
    <line id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
      stroke="${stroke_color}" stroke-width="${stroke_width}"
      filter="url(#glow-${id})" ${marker} />
  `;
}

/**
 * Draw a scanning SVG line (dashed, animated).
 * Returns SVG string.
 */
export function renderMsdScanningLine({
  id, x1, y1, x2, y2,
  stroke_color = '#00ffff',
  stroke_width = 4,
  dasharray = '10,5',
  arrow_end = false
}) {
  const marker = arrow_end ? 'marker-end="url(#arrowhead)"' : '';
  return `
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="${stroke_color}" />
      </marker>
    </defs>
    <line id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
      stroke="${stroke_color}" stroke-width="${stroke_width}"
      stroke-dasharray="${dasharray}" ${marker} />
  `;
}
