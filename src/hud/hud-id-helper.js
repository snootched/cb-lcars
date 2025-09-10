// Utility to ensure a stable id/name on a form control.
const used = new Set();

export function ensureHudId(el, parts) {
  if (!el) return;
  if (el.id && el.name) return;
  const base = 'hud-' + parts.filter(Boolean).join('-').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  let candidate = base;
  let i = 1;
  while (used.has(candidate)) candidate = `${base}-${i++}`;
  used.add(candidate);
  if (!el.id) el.id = candidate;
  if (!el.name) el.name = candidate;
  return candidate;
}
