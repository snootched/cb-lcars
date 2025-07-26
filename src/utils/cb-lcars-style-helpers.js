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

// Style resolver: merges defaults, preset, customPreset, callout, stateOverrides
export function resolveCalloutStyles({defaults, preset, customPreset, callout, stateOverrides}) {
  // Deep merge each sub-object (text, line, etc.) individually
  const result = {};
  const keys = new Set([
    ...Object.keys(defaults || {}),
    ...Object.keys(preset || {}),
    ...Object.keys(customPreset || {}),
    ...Object.keys(callout || {}),
    ...Object.keys(stateOverrides || {})
  ]);
  keys.forEach(key => {
    result[key] = deepMerge(
      {},
      defaults?.[key],
      preset?.[key],
      customPreset?.[key],
      callout?.[key],
      stateOverrides?.[key]
    );
  });
  return result;
}

// Split style vs. SVG attribute
const SVG_ATTRS = [
  'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'fill', 'fill-opacity', 'filter', 'marker-end', 'marker-start', 'marker-mid',
  'font-size', 'font-family', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline'
];

// Helper: map config keys to SVG attribute names
function mapKeyToSvgAttr(key, context = '') {
  // Common mappings
  const keyMap = {
    font_size: 'font-size',
    font_family: 'font-family',
    font_weight: 'font-weight',
    font_style: 'font-style',
    align: 'text-anchor',
    stroke_dasharray: 'stroke-dasharray',
    stroke_linecap: 'stroke-linecap',
    stroke_linejoin: 'stroke-linejoin',
    corner_radius: 'rx', // for rects, not used here
    color: context === 'text' ? 'fill' : 'stroke',
    // Always map width to stroke-width except for text context
    width: context === 'text' ? undefined : 'stroke-width',
    opacity: 'opacity'
    // Add more as needed
  };
  if (keyMap[key]) return keyMap[key];
  // Convert camelCase or underscore to kebab-case
  return key.replace(/_/g, '-').replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

export function splitAttrsAndStyle(obj, context = '') {
  const attrs = {};
  const style = {};
  if (!obj || typeof obj !== "object") return {attrs, style};
  for (const [k, v] of Object.entries(obj)) {
    const svgKey = mapKeyToSvgAttr(k, context);
    if (SVG_ATTRS.includes(svgKey) || svgKey.startsWith('data-')) {
      // Special handling for color object
      if (k === 'color' && typeof v === 'object' && v !== null) {
        attrs[svgKey] = v.default ?? Object.values(v)[0];
      } else {
        attrs[svgKey] = v;
      }
    } else if (
      k === "opacity" ||
      k === "display" ||
      k === "visibility" ||
      k === "pointer-events"
    ) {
      style[svgKey] = v;
    } else if (typeof v === "string" || typeof v === "number") {
      attrs[svgKey] = v;
    }
  }
  return { attrs, style };
}