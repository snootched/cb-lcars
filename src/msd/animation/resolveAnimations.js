import { deepMerge } from '../util/deepMerge.js';

/**
 * Build desired animation instances.
 * @param {Array} overlays resolved overlays (with _raw for original)
 * @param {Object} animationIndex id -> animation def
 * @param {Array} ruleAnimations from rulesEngine (ref, override, priority)
 */
// NOTE Wave 1: preset resolution deferred to AnimationRegistry (builders in presets.js)
export function resolveDesiredAnimations(overlays, animationIndex, ruleAnimations) {
  const desired = [];
  const ruleOverridesGrouped = groupRuleAnimOverrides(ruleAnimations);

  // Overlay-level animations
  for (const ov of overlays) {
    const raw = ov._raw || ov.raw || {};
    if (!raw.animation_ref) continue;
    const base = animationIndex.get(raw.animation_ref);
    if (!base) continue;
    // Build merged params
    let params = {};
    if (base.params) params = deepMerge(params, base.params);
    if (raw.animation_override?.params) params = deepMerge(params, raw.animation_override.params);

    // Apply highest-priority rule override first (only first per ref used per overlay)
    const ruleList = ruleOverridesGrouped.get(raw.animation_ref);
    if (ruleList && ruleList.length) {
      // Already sorted by priority desc
      for (const r of ruleList) {
        if (r.override?.params) params = deepMerge(params, r.override.params);
        break; // only top-level override for now
      }
    }

    desired.push({
      key: `overlay:${ov.id}:${raw.animation_ref}`,
      preset: base.preset,
      params,
      targets: [`#${ov.id}`],
      ref: raw.animation_ref,
      overlayId: ov.id
    });
  }

  // Standalone animations (defs with explicit targets)
  for (const [id, def] of animationIndex.entries()) {
    if (!def.targets) continue;
    desired.push({
      key: `standalone:${id}`,
      preset: def.preset,
      params: def.params || {},
      targets: Array.isArray(def.targets) ? def.targets.slice() : [def.targets],
      ref: id
    });
  }

  return desired;
}

function groupRuleAnimOverrides(ruleAnims) {
  const map = new Map();
  (ruleAnims || []).forEach(a => {
    if (!a.ref) return;
    if (!map.has(a.ref)) map.set(a.ref, []);
    map.get(a.ref).push(a);
  });
  // Sort each list by priority desc
  map.forEach(list => list.sort((a, b) => (b.priority || 0) - (a.priority || 0)));
  return map;
}
