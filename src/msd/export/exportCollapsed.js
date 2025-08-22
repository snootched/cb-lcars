import { stableStringify } from '../util/stableStringify.js';

function stripMeta(item) {
  if (!item || typeof item !== 'object') return item;
  const { __meta, ...rest } = item;
  return rest;
}

export function exportCollapsed(merged) {
  const raw = merged.__raw_msd || {};
  // User-origin items only (origin_pack === 'user')
  function userItems(col) {
    return (merged[col] || [])
      .filter(i => i.__meta?.origin_pack === 'user' && !i.__meta.removed)
      .map(stripMeta);
  }
  const out = {
    msd: {
      version: raw.version || 1,
      base_svg: raw.base_svg,
      view_box: raw.view_box,
      use_packs: raw.use_packs,
      anchors: raw.anchors,
      palettes: raw.palettes,
      remove: raw.remove,
      profiles: userItems('profiles'),
      animations: userItems('animations'),
      timelines: userItems('timelines'),
      overlays: userItems('overlays'),
      rules: userItems('rules'),
      routing: raw.routing,
      active_profiles: raw.active_profiles,
      hud: raw.hud
    }
  };
  // Prune empty/null keys
  Object.keys(out.msd).forEach(k => {
    if (out.msd[k] == null) delete out.msd[k];
    else if (Array.isArray(out.msd[k]) && !out.msd[k].length) delete out.msd[k];
    else if (typeof out.msd[k] === 'object' && !Array.isArray(out.msd[k]) && !Object.keys(out.msd[k]).length) delete out.msd[k];
  });
  return out;
}

export function exportCollapsedJson(merged, pretty = true) {
  return pretty ? JSON.stringify(exportCollapsed(merged), null, 2) : stableStringify(exportCollapsed(merged));
}
