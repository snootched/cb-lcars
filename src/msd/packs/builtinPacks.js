// Minimal builtin packs registry. Extend as more builtin packs are added.
const CORE_PACK = {
  animations: [],
  rules: [],
  profiles: [],
  overlays: [],
  timelines: [],
  palettes: {},
  anchors: {},
  routing: {}
};

/**
 * Retrieve a builtin pack by id.
 * @param {string} id
 * @returns {object|null}
 */
export function getBuiltinPack(id) {
  if (id === 'core') return CORE_PACK;
  return null;
}
