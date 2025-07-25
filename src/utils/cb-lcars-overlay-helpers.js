import { drawLine, drawPolyline, drawText } from './cb-lcars-svg-helpers.js';
import { resolveCalloutStyles, splitAttrsAndStyle } from './cb-lcars-style-helpers.js';

export function buildCalloutOverlay({callout, anchors, styleLayers}) {
  const merged = resolveCalloutStyles(styleLayers);

  const anchorPos = typeof callout.anchor === "string" && anchors[callout.anchor]
    ? anchors[callout.anchor]
    : Array.isArray(callout.anchor) ? callout.anchor : null;
  const textPos = typeof callout.text?.position === "string" && anchors[callout.text.position]
    ? anchors[callout.text.position]
    : Array.isArray(callout.text?.position) ? callout.text.position : null;

  let lineSvg = '';
  if (merged.line?.points?.length > 1) {
    const {attrs, style} = splitAttrsAndStyle(merged.line);
    lineSvg = drawPolyline({
      points: merged.line.points,
      id: callout.line?.id,
      attrs,
      style,
    });
  } else if (textPos && anchorPos) {
    const {attrs, style} = splitAttrsAndStyle(merged.line);
    lineSvg = drawLine({
      x1: textPos[0], y1: textPos[1],
      x2: anchorPos[0], y2: anchorPos[1],
      id: callout.line?.id,
      attrs,
      style,
    });
  }

  let textSvg = '';
  if (textPos && merged.text) {
    const {attrs, style} = splitAttrsAndStyle(merged.text);
    textSvg = drawText({
      x: textPos[0], y: textPos[1],
      text: merged.text.value,
      id: callout.text?.id,
      attrs,
      style,
    });
  }
  return lineSvg + textSvg;
}


/**
 * Resolves animation targets given a selector, element, object, or array of these.
 * @param {string|object|Element|Array} targets - Selector, element, object, or array.
 * @param {Element|ShadowRoot|Document} context - The root to search within.
 * @returns {Element[]} Array of found elements (may be empty).
 */
export function resolveAnimationTargets(targets, root = document) {
  const out = [];
  const searchRoot = root.shadowRoot || root || document;
  (Array.isArray(targets) ? targets : [targets]).forEach(t => {
    if (typeof t === 'string') {
      out.push(...searchRoot.querySelectorAll(t));
    } else if (t instanceof Element) {
      out.push(t);
    }
  });
  return out;
}