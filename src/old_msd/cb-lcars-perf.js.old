/**
 * CB-LCARS Perf Counters
 * Lightweight, always-available counters with optional timing.
 * Usage:
 *   perf.count('sparkline.refresh');
 *   const end = perf.timeStart('sparkline.refresh.exec'); ... end();  // adds duration
 *   perf.dump();  // returns plain object of stats
 *
 * Exposed at window.cblcars.perf.*
 */

const _store = {
  counters: Object.create(null) // key -> { count, totalMs, lastMs, maxMs, avgMs }
};

/**
 * Increment a simple counter (no timing).
 * @param {string} key
 */
export function count(key) {
  if (!key) return;
  let c = _store.counters[key];
  if (!c) {
    c = _store.counters[key] = { count: 0, totalMs: 0, lastMs: 0, maxMs: 0, avgMs: 0 };
  }
  c.count += 1;
}

/**
 * Start a timer; returns an end() function that records elapsed ms.
 * @param {string} key
 * @returns {() => number} end function returning elapsed ms
 */
export function timeStart(key) {
  const t0 = performance.now();
  return function end() {
    const dt = performance.now() - t0;
    let c = _store.counters[key];
    if (!c) {
      c = _store.counters[key] = { count: 0, totalMs: 0, lastMs: 0, maxMs: 0, avgMs: 0 };
    }
    c.count += 1;
    c.totalMs += dt;
    c.lastMs = dt;
    if (dt > c.maxMs) c.maxMs = dt;
    c.avgMs = c.totalMs / c.count;
    return dt;
  };
}

/**
 * Get current stats snapshot (plain cloned object).
 */
export function dump() {
  const out = {};
  for (const [k, v] of Object.entries(_store.counters)) {
    out[k] = { ...v };
  }
  return out;
}

/**
 * Reset all counters or a single key.
 * @param {string=} key
 */
export function reset(key) {
  if (key) {
    delete _store.counters[key];
  } else {
    for (const k of Object.keys(_store.counters)) delete _store.counters[k];
  }
}

/**
 * Attach to global namespace (idempotent).
 */
export function attachGlobal() {
  window.cblcars = window.cblcars || {};
  window.cblcars.perf = window.cblcars.perf || {};
  window.cblcars.perf.count = count;
  window.cblcars.perf.timeStart = timeStart;
  window.cblcars.perf.dump = dump;
  window.cblcars.perf.reset = reset;
}

attachGlobal();