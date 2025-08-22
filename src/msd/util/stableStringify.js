export function stableStringify(value) {
  const seen = new WeakSet();
  function walk(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (seen.has(v)) return '"[Circular]"';
    seen.add(v);
    if (Array.isArray(v)) return '[' + v.map(walk).join(',') + ']';
    const keys = Object.keys(v).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + walk(v[k])).join(',') + '}';
  }
  return walk(value);
}
