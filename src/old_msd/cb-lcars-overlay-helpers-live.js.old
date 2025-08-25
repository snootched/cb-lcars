/**
 * Utilities to bind live data to overlay elements.
 */
export function bindRealtimeToElement({ element, bind = [], buffer, utils }) {
  // Each bind entry: { prop: 'fill'|'opacity'|'stroke-width'|'translateY'|..., map_range?, round?, unit? }
  // For performance, we set simple attributes/styles directly via utils.set.
  return (event) => {
    const value = event?.v;
    if (value === undefined) return;
    const setObj = {};
    for (const b of bind) {
      let v = value;
      if (b.map_range && window.cblcars?.anim?.utils?.mapRange) {
        const { input_range, output_range } = b.map_range;
        const mapper = window.cblcars.anim.utils.mapRange(input_range[0], input_range[1], output_range[0], output_range[1]);
        v = mapper(value);
        if (typeof b.round === 'number') v = Number(v.toFixed(b.round));
      }
      if (b.unit && typeof v === 'number') v = `${v}${b.unit}`;
      // Common targets: attribute vs style
      if (b.prop in element.style) {
        setObj[b.prop] = v;
      } else {
        // SVG attribute, map common aliases
        const attr = b.prop.replace(/_/g, '-');
        setObj[attr] = v;
      }
    }
    try {
      if (utils?.set) {
        utils.set(element, setObj);
      } else {
        // Fallback
        for (const [k, v] of Object.entries(setObj)) {
          if (k in element.style) element.style[k] = v;
          else element.setAttribute(k, v);
        }
      }
    } catch (_) {}
  };
}