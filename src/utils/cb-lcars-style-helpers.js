// Deep merge as before
export function deepMerge(target, ...sources) {
  for (const src of sources) {
    if (typeof src !== 'object' || src === null) continue;
    for (const key in src) {
      if (
        src[key] && typeof src[key] === 'object' &&
        !Array.isArray(src[key])
      ) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], src[key]);
      } else {
        target[key] = src[key];
      }
    }
  }
  return target;
}

// Style resolver: merges defaults, preset, callout, state, etc.
export function resolveCalloutStyles({defaults, preset, customPreset, callout, stateOverrides}) {
  return deepMerge({}, defaults, preset, customPreset, callout, stateOverrides);
}

// Split style vs. SVG attribute
const SVG_ATTRS = [
  'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'fill', 'fill-opacity', 'filter', 'marker-end', 'marker-start', 'marker-mid',
  'font-size', 'font-family', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline'
];

export function splitAttrsAndStyle(obj) {
  const attrs = {};
  const style = {};
  if (!obj || typeof obj !== "object") return {attrs, style};
  for (const [k, v] of Object.entries(obj)) {
    if (SVG_ATTRS.includes(k) || k.startsWith('data-')) {
      attrs[k] = v;
    } else if (
      k === "opacity" ||
      k === "display" ||
      k === "visibility" ||
      k === "pointer-events"
    ) {
      style[k] = v;
    } else if (typeof v === "string" || typeof v === "number") {
      // fallback: treat as attribute for SVG, unless it's a custom prop (expand SVG_ATTRS if needed)
      attrs[k] = v;
    }
  }
  return { attrs, style };
}