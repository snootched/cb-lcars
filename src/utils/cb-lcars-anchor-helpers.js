// Extract anchor points from SVG content

export function findSvgAnchors(svgContent) {
  const anchors = {};
  // <circle id="anchor" cx="" cy="">
  const circleRegex = /<circle[^>]*id="([^"]+)"[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*>/g;
  let m;
  while ((m = circleRegex.exec(svgContent)) !== null) {
    anchors[m[1]] = [parseFloat(m[2]), parseFloat(m[3])];
  }
  // <text id="anchor" x="" y="">
  const textRegex = /<text[^>]*id="([^"]+)"[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*>/g;
  while ((m = textRegex.exec(svgContent)) !== null) {
    anchors[m[1]] = [parseFloat(m[2]), parseFloat(m[3])];
  }
  // <g id="anchor">
  const groupRegex = /<g[^>]*id="([^"]+)"[^>]*>/g;
  while ((m = groupRegex.exec(svgContent)) !== null) {
    anchors[m[1]] = null; // Optionally: calculate centroid if needed
  }
  return anchors;
}