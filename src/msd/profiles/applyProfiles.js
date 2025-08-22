import { deepMerge } from '../util/deepMerge.js';

export function buildProfileIndex(profiles) {
  const byId = new Map();
  (profiles || []).forEach(p => byId.set(p.id, p));
  return byId;
}

/**
 * Assemble base style for an overlay:
 * order: (activeProfiles in order) defaults[type] deep merged -> overlay.style (overrides)
 * Returns { style, sources } where sources records provenance order for HUD future use.
 */
export function assembleOverlayBaseStyle(overlay, activeProfiles, profileIndex) {
  const sources = [];
  let styleAccum = {};
  (activeProfiles || []).forEach(pid => {
    const prof = profileIndex.get(pid);
    if (!prof || !prof.defaults) return;
    const typeDefaults = prof.defaults[overlay.type];
    if (typeDefaults) {
      styleAccum = deepMerge(styleAccum, typeDefaults);
      sources.push({ kind: 'profile', id: pid });
    }
  });
  if (overlay.style) {
    styleAccum = deepMerge(styleAccum, overlay.style);
    sources.push({ kind: 'overlay', id: overlay.id });
  }
  return { style: styleAccum, sources };
}
