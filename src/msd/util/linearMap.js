export function linearMap(val, inMin, inMax, outMin, outMax, clamp) {
  if (inMax === inMin) return outMin;
  let t = (val - inMin) / (inMax - inMin);
  if (clamp) {
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  return outMin + t * (outMax - outMin);
}
