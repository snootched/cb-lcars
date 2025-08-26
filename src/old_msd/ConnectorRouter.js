// DEPRECATED (Wave 2) – replaced by routing/Router.js adapter.
// Retained temporarily to avoid breaking any lingering imports.
export function computeLineKey(id, a1, a2) {
  return id + ':' + a1[0] + ',' + a1[1] + '->' + a2[0] + ',' + a2[1];
}
export function routeLine(a1, a2) {
  return { d: `M${a1[0]},${a1[1]} L${a2[0]},${a2[1]}` };
}

