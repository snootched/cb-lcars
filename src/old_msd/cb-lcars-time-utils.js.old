/**
 * Time utilities for parsing user-friendly window strings.
 * Supports:
 *  - number (seconds) -> ms
 *  - strings with suffix: 'ms' | 's' | 'm' | 'h' | 'd'
 * Examples: 300, '300s', '10m', '24h', '2d'
 */

/**
 * Parse a time window into milliseconds.
 * @param {number|string|null|undefined} v
 * @returns {number|null} milliseconds or null if invalid
 */
export function parseTimeWindowMs(v) {
  if (v == null) return null;
  if (typeof v === 'number' && isFinite(v)) return Math.max(0, v) * 1000;

  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    const m = s.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const unit = m[2];
    const factor =
      unit === 'ms' ? 1 :
      unit === 's'  ? 1000 :
      unit === 'm'  ? 60000 :
      unit === 'h'  ? 3600000 : 86400000;
    return n * factor;
  }

  return null;
}