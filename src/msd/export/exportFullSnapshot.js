import { stableStringify } from '../util/stableStringify.js';

function stripMeta(item, includeMeta) {
  if (includeMeta) return item;
  if (!item || typeof item !== 'object') return item;
  const { __meta, ...rest } = item;
  return rest;
}

export function exportFullSnapshot(merged, opts = {}) {
  const include_meta = !!opts.include_meta;
  function all(col) {
    return (merged[col] || [])
      .filter(i => !i.__meta?.removed)
      .map(i => stripMeta(i, include_meta));
  }
  return {
    msd: {
      version: (merged.__raw_msd && merged.__raw_msd.version) || 1,
      base_svg: merged.__raw_msd?.base_svg,
      view_box: merged.__raw_msd?.view_box,
      use_packs: merged.__raw_msd?.use_packs,
      anchors: merged.__raw_msd?.anchors,
      palettes: merged.palettes,
      remove: merged.__raw_msd?.remove,
      profiles: all('profiles'),
      animations: all('animations'),
      timelines: all('timelines'),
      overlays: all('overlays'),
      rules: all('rules'),
      routing: merged.routing,
      active_profiles: merged.active_profiles,
      hud: merged.hud,
      __provenance: include_meta ? merged.__provenance : undefined,
      __issues: include_meta ? merged.__issues : undefined
    }
  };
}

export function exportFullSnapshotJson(merged, opts = {}, pretty = true) {
  return pretty ? JSON.stringify(exportFullSnapshot(merged, opts), null, 2) : stableStringify(exportFullSnapshot(merged, opts));
}
