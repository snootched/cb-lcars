/**
 * CB-LCARS Render Scheduler (Phase P2)
 * Micro-batching of high-frequency operations into a single rAF flush per frame.
 *
 * queue(type, fn):
 *   Queues a function under a type label. Each type executes at most once per frame
 *   (all queued callbacks for that type run in insertion order).
 *
 * Features:
 *  - Dedup: the same function reference added twice in the same frame is ignored.
 *  - Perf counters (if perf module present): scheduler.flush(.exec), scheduler.types.<type>
 *  - Safe: exceptions in one task do not stop other tasks.
 *
 * Use for: sparkline refreshes after first paint, connector layout, future diff layouts.
 * DO NOT use for critical first-pass DOM stamping (baseline path, initial controls mount).
 */

const queues = new Map(); // Map<string, Set<Function>>
let scheduled = false;

function perfCount(key) {
  try { window.cblcars?.perf?.count && window.cblcars.perf.count(key); } catch (_) {}
}
function perfTimeStart(key) {
  try { return window.cblcars?.perf?.timeStart ? window.cblcars.perf.timeStart(key) : null; } catch { return null; }
}

/**
 * Enqueue a callback for next animation frame.
 * @param {string} type
 * @param {Function} fn
 */
export function queue(type, fn) {
  if (!type || typeof fn !== 'function') return;
  let set = queues.get(type);
  if (!set) {
    set = new Set();
    queues.set(type, set);
  }
  set.add(fn);
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(flush);
  }
}

function flush() {
  scheduled = false;
  const endFrame = perfTimeStart('scheduler.flush.exec');
  for (const [type, set] of queues) {
    if (!set.size) continue;
    perfCount(`scheduler.types.${type}`);
    // Copy to avoid mutation during iteration
    const tasks = Array.from(set);
    set.clear();
    for (const fn of tasks) {
      try { fn(); } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[scheduler] task error', type, e);
      }
    }
  }
  perfCount('scheduler.flush');
  endFrame && endFrame();
}

/**
 * Clear all queued tasks (mainly for teardown/testing).
 */
export function clearAll() {
  queues.clear();
  scheduled = false;
}

// Expose globally for diagnostics
export function attachGlobal() {
  window.cblcars = window.cblcars || {};
  window.cblcars.scheduler = {
    queue,
    clearAll,
    _queues: queues
  };
}

attachGlobal();