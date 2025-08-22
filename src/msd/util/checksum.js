const META_KEYS = new Set([
  'origin_pack','origin_version','checksum','overridden',
  'override_layer','diverged_from_checksum','__meta'
]);

function stableSortKeys(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stableSortKeys);
  const out = {};
  Object.keys(obj).sort().forEach(k => {
    if (META_KEYS.has(k)) return;
    out[k] = stableSortKeys(obj[k]);
  });
  return out;
}

export function stableCoreString(obj) {
  return JSON.stringify(stableSortKeys(obj));
}

export function computeChecksum(obj) {
  const str = stableCoreString(obj);
  let h = 0x811c9dc5;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = (h >>> 0) * 0x01000193;
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8);
}
