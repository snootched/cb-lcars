export function isPlain(o) {
  return o && typeof o === 'object' && !Array.isArray(o);
}
export function deepMerge(target, source) {
  if (!isPlain(source)) return source;
  if (!isPlain(target)) target = {};
  for (const k of Object.keys(source)) {
    const sv = source[k];
    const tv = target[k];
    if (isPlain(sv) && isPlain(tv)) {
      target[k] = deepMerge(tv, sv);
    } else {
      // Arrays & scalars replace (per spec).
      target[k] = sv;
    }
  }
  return target;
}
