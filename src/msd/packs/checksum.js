// Stable stringify (sorted object keys, deterministic arrays) + short SHA-256 hex (first 10)
export async function computeChecksum(obj){
  const json = stableStringify(obj);
  const enc = new TextEncoder().encode(json);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  const hex = [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  return hex.slice(0,10);
}

// Synchronous stable stringify (lifts keys in lexical order)
export function stableStringify(value){
  return JSON.stringify(value, replacer);
  function replacer(_k,v){
    if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
    const out = {};
    Object.keys(v).sort().forEach(k=>{ out[k]=v[k]; });
    return out;
  }
}
