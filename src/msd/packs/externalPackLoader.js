import yamlLib from 'js-yaml';

const _cache = new Map(); // url -> { checksum, parsed, ts }

const MAX_BYTES = 250 * 1024;

export async function loadExternalPack(url, fetchImpl = fetch) {
  if (_cache.has(url)) return _cache.get(url).parsed;
  let txt;
  try {
    const res = await fetchImpl(url, { cache: 'no-cache' });
    const blob = await res.blob();
    if (blob.size > MAX_BYTES) {
      console.warn('[MSD v1] external pack too large', url, blob.size);
      return null;
    }
    txt = await blob.text();
  } catch (e) {
    console.warn('[MSD v1] external pack fetch failed', url, e);
    return null;
  }
  let parsed;
  try {
    parsed = yamlLib.load(txt);
  } catch (e) {
    console.warn('[MSD v1] external pack parse failed', url, e);
    return null;
  }
  _cache.set(url, { parsed, ts: Date.now() });
  return parsed;
}

export function clearExternalPackCache(url) {
  if (url) _cache.delete(url); else _cache.clear();
}

export function listExternalPackCache() {
  return Array.from(_cache.keys());
}
