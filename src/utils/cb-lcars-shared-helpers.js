/**
 * Resolves animation targets given a selector, element, object, or array of these.
 * @param {string|object|Element|Array} targets - Selector, element, object, or array.
 * @param {Element|ShadowRoot|Document} root - The root to search within.
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
