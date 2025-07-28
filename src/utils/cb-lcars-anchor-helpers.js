// Extract anchor points from SVG content

export function findSvgAnchors(svgContent) {
  const anchors = {};
  // Improved <circle> extraction: match cx/cy in any order
  const circleRegex = /<circle[^>]*id="([^"]+)"[^>]*>/g;
  let m;
  while ((m = circleRegex.exec(svgContent)) !== null) {
    const id = m[1];
    const tag = m[0];
    const cxMatch = tag.match(/\scx="([^"]+)"/);
    const cyMatch = tag.match(/\scy="([^"]+)"/);
    if (cxMatch && cyMatch) {
      anchors[id] = [parseFloat(cxMatch[1]), parseFloat(cyMatch[1])];
    }
  }

  // Improved <text> extraction: match x/y in any order
  const textRegex = /<text[^>]*id="([^"]+)"[^>]*>/g;
  while ((m = textRegex.exec(svgContent)) !== null) {
    const id = m[1];
    // Extract x and y attributes from the tag
    const tag = m[0];
    const xMatch = tag.match(/\sx="([^"]+)"/);
    const yMatch = tag.match(/\sy="([^"]+)"/);
    if (xMatch && yMatch) {
      anchors[id] = [parseFloat(xMatch[1]), parseFloat(yMatch[1])];
    }
  }
  // <g id="anchor">
  const groupRegex = /<g[^>]*id="([^"]+)"[^>]*>/g;
  while ((m = groupRegex.exec(svgContent)) !== null) {
    anchors[m[1]] = null; // Optionally: calculate centroid if needed
  }
  return anchors;
}

export function getSvgContent(base_svg) {
  let svgKey = null;
  if (base_svg && base_svg.startsWith('builtin:')) {
    svgKey = base_svg.replace('builtin:', '');
  } else if (base_svg && base_svg.startsWith('/local/')) {
    svgKey = base_svg.split('/').pop().replace('.svg','');
  }
  return svgKey && window.cblcars?.msd?.svg_templates?.[svgKey];
}

export function getSvgViewBox(svgContent) {
  const match = svgContent && svgContent.match(/viewBox="([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)\s+([0-9.\-]+)"/);
  if (match) {
    return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4])];
  }
  return [0, 0, 400, 200];
}

export function getSvgAspectRatio(viewBox) {
  return viewBox[2] && viewBox[3] ? (viewBox[2] / viewBox[3]) : 2;
}


