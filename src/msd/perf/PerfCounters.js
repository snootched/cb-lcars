const counters = Object.create(null);
export function perfInc(key, delta = 1) {
  counters[key] = (counters[key] || 0) + delta;
}
export function perfSet(key, val) {
  counters[key] = val;
}
export function perfGetAll() {
  return { ...counters };
}
export function perfTime(key, fn) {
  const t0 = performance.now();
  const res = fn();
  const done = () => {
    const dt = performance.now() - t0;
    perfInc(key + '.samples', 1);
    perfInc(key + '.totalMs', dt);
    perfSet(key + '.lastMs', dt);
  };
  if (res && typeof res.then === 'function') {
    return res.then(r => { done(); return r; });
  }
  done();
  return res;
}
