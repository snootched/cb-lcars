import { stableStringify } from '../util/stableStringify.js';

export function diffItem(merged, collection, id) {
  const chain = merged.__provenance?.[collection]?.[id];
  if (!chain) return { id, collection, chain: [], final: null, removed: false };
  const items = (merged[collection] || []).filter(i => i.id === id);
  const final = items.length ? items[items.length - 1] : null;
  return {
    id,
    collection,
    chain,
    removed: chain.some(c => c.removed),
    final_summary: final ? summarize(final) : null,
    chain_summaries: chain.map(s => ({
      layer: s.layer_id,
      overridden: s.overridden,
      removed: s.removed,
      checksum: s.checksum,
      diff: s.diff
    }))
  };
}

function summarize(item) {
  if (!item) return null;
  const copy = { ...item };
  delete copy.__meta;
  return JSON.parse(stableStringify(copy));
}
