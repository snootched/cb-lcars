import { parseTimeWindowMs } from './cb-lcars-time-utils.js';

/**
 * Phase: DataBus Coalescing Upgrade
 *
 * Adds burst collapse / coalescing & richer perf counters while retaining backward compatibility.
 *
 * New per-source config fields:
 *   - sampleMs (existing): minimum ms between emits (alias -> minEmitMs)
 *   - minEmitMs (optional explicit): same meaning; overrides sampleMs if provided
 *   - coalesceMs: soft window for collapsing rapid successive updates (default: 0.6 * minEmitMs, min 30)
 *   - maxDelayMs: hard cap latency since first pending update before forced emit (default: 4 * coalesceMs, but not less than minEmitMs)
 *   - emitOnSameValue: boolean (default false) – if false, identical value repeats inside coalesce windows won’t trigger emits
 *
 * Perf counters added:
 *   databus.receive                (every raw HA event accepted)
 *   databus.receive.invalid        (events that produced null value)
 *   databus.coalesce               (raw updates folded into a pending emit)
 *   databus.emit                   (already existed – count of emits)
 *   databus.emit.exec              (timed emit)
 *   databus.emit.flush             (flush cycles that performed an emit)
 *   databus.emit.subscribers       (# subscriber callbacks invoked across emits)
 *   databus.emit.skippedSame       (skipped because unchanged + emitOnSameValue=false)
 *
 * Public runtime additions:
 *   window.cblcars.data.getSourceStats(name)
 *   window.cblcars.data.listSources()
 *   window.cblcars.data.flushAll()
 *   source.flush()  // force immediate emit if pending
 *
 * Implementation summary:
 *  - Raw state changes always update rolling buffer immediately.
 *  - A pending emit is scheduled (rAF loop). We track:
 *      _pendingFirstTs: timestamp of first pending post-lastEmit
 *      _pendingCount: number of coalesced updates
 *  - Each animation frame we decide whether to emit:
 *      if (now - _lastEmit >= minEmitMs) OR (now - _pendingFirstTs >= maxDelayMs) -> emit
 *      else keep waiting (rAF).
 *  - On each deferred additional update inside coalesce window: increment databus.coalesce
 *  - If the new value equals last emitted value & emitOnSameValue=false, we mark potential skip (still may need flush later if stale)
 *    So a flush check re-evaluates difference before emitting.
 */

/* ---------------------------------- RollingBuffer ---------------------------------- */
export class RollingBuffer {
  constructor(capacity = 600) {
    this.capacity = capacity;
    this.t = [];
    this.v = [];
  }
  push(ts, val) {
    this.t.push(ts);
    this.v.push(val);
    if (this.t.length > this.capacity) {
      this.t.shift(); this.v.shift();
    }
  }
  last() {
    const i = this.v.length - 1;
    return i >= 0 ? { t: this.t[i], v: this.v[i] } : null;
  }
  sliceSince(msAgo) {
    const cutoff = Date.now() - msAgo;
    let i = 0;
    while (i < this.t.length && this.t[i] < cutoff) i++;
    return { t: this.t.slice(i), v: this.v.slice(i) };
  }
}

/* ---------------------------------- Perf helpers ---------------------------------- */
function perfCount(key) {
  try { window.cblcars?.perf?.count && window.cblcars.perf.count(key); } catch (_) {}
}
function perfTimeStart(key) {
  try { return window.cblcars?.perf?.timeStart ? window.cblcars.perf.timeStart(key) : null; } catch { return null; }
}

/* ---------------------------------- DataSource ---------------------------------- */
export class DataSource {
  /**
   * @param {object} cfg
   * @param {object} hass
   */
  constructor(cfg, hass) {
    this.cfg = { ...cfg };
    this.hass = hass;

    // Derive window capacity based on windowSeconds (keep earlier semantics)
    let wsSec = 60;
    if (typeof cfg.windowSeconds === 'number' && isFinite(cfg.windowSeconds)) {
      wsSec = Math.max(1, cfg.windowSeconds);
    } else if (typeof cfg.windowSeconds === 'string') {
      const ms = parseTimeWindowMs(cfg.windowSeconds);
      if (Number.isFinite(ms)) wsSec = Math.max(1, Math.floor(ms / 1000));
    }
    const cap = Math.max(60, Math.floor(wsSec * 10)); // ~10 samples/sec fallback
    this.buffer = new RollingBuffer(cap);

    // Subscribers
    this.subscribers = new Set();
    this.unsub = null;

    // Timing / coalescing state
    this._lastEmit = 0;
    this._pendingRaf = 0;
    this._pending = false;
    this._pendingFirstTs = 0;
    this._pendingCount = 0;
    this._pendingSameValCandidate = false;

    // Perf related counts (quick snapshot accessible)
    this._stats = {
      emits: 0,
      coalesced: 0,
      skipsSame: 0,
      receive: 0,
      invalid: 0
    };

    // Coalescing config
    // Backward compatibility: sampleMs still supported
    const minEmitMs = Number.isFinite(cfg.minEmitMs) ? cfg.minEmitMs
      : Number.isFinite(cfg.sampleMs) ? cfg.sampleMs : 100;

    this.minEmitMs = Math.max(10, minEmitMs);
    this.coalesceMs = Number.isFinite(cfg.coalesceMs)
      ? Math.max(30, cfg.coalesceMs)
      : Math.max(30, Math.round(this.minEmitMs * 0.6));
    this.maxDelayMs = Number.isFinite(cfg.maxDelayMs)
      ? Math.max(this.minEmitMs, cfg.maxDelayMs)
      : Math.max(this.minEmitMs, this.coalesceMs * 4);

    this.emitOnSameValue = cfg.emitOnSameValue === true; // default false

    // Internal caches
    this._lastEmittedVal = undefined;

    // Flags
    this._destroyed = false;
  }

  async start() {
    // Optional history preload
    if (this.cfg.history?.preload) {
      try {
        await this._preloadHistory();
        if (this.buffer.last()) this._ensureSchedule(); // after preload, schedule first emit
      } catch (_) {}
    }
    await this._subscribeLive();
  }

  stop() {
    this._destroyed = true;
    try { this.unsub && this.unsub(); } catch (_) {}
    this.unsub = null;
    this.subscribers.clear();
    if (this._pendingRaf) cancelAnimationFrame(this._pendingRaf);
    this._pendingRaf = 0;
    this._pending = false;
  }

  subscribe(cb) {
    this.subscribers.add(cb);
    // Push current last value immediately (initial hydration)
    const last = this.buffer.last();
    if (last) cb({ t: last.t, v: last.v, buffer: this.buffer });
    return () => this.subscribers.delete(cb);
  }

  /**
   * Force immediate emission if there is pending data and timing constraints allow (or override).
   * @param {boolean} forceIgnoreIntervals If true, bypass interval rules and emit now.
   */
  flush(forceIgnoreIntervals = false) {
    if (this._destroyed) return;
    if (!this.buffer.last()) return;
    if (!this._pending && !forceIgnoreIntervals) return;

    const now = performance.now();
    if (!forceIgnoreIntervals) {
      // Enforce minEmitMs unless forced
      if (now - this._lastEmit < this.minEmitMs) return;
    }
    this._emit(now, true);
  }

  getStats() {
    return {
      ...this._stats,
      minEmitMs: this.minEmitMs,
      coalesceMs: this.coalesceMs,
      maxDelayMs: this.maxDelayMs,
      emitOnSameValue: this.emitOnSameValue,
      pending: this._pending,
      pendingCount: this._pendingCount,
      lastEmitMsAgo: performance.now() - this._lastEmit
    };
  }

  /* --------------------------- Internal event handling --------------------------- */

  _onRawEventValue(ts, val) {
    if (val === null) {
      this._stats.invalid++;
      perfCount('databus.receive.invalid');
      return;
    }
    this.buffer.push(ts, val);
    this._stats.receive++;
    perfCount('databus.receive');

    // Decide coalescing
    const now = performance.now();
    if (!this._pending) {
      // First pending event
      this._pending = true;
      this._pendingFirstTs = now;
      this._pendingCount = 1;
      this._pendingSameValCandidate = false;
      this._ensureSchedule();
    } else {
      this._pendingCount++;
      const timeSinceFirst = now - this._pendingFirstTs;
      if (timeSinceFirst < this.coalesceMs) {
        // Still inside coalesce window
        this._stats.coalesced++;
        perfCount('databus.coalesce');
      }
      // Mark if candidate for skip (unchanged value)
      if (!this.emitOnSameValue) {
        const last = this.buffer.last();
        if (last && this._lastEmittedVal === last.v) {
          this._pendingSameValCandidate = true;
        }
      }
      // Already scheduled; no need to reschedule (loop frame will pick up)
    }
  }

  _ensureSchedule() {
    if (this._pendingRaf) return;
    const loop = () => {
      this._pendingRaf = 0;
      this._frameCheck();
      if (this._pending && !this._pendingRaf && !this._destroyed) {
        // If still pending after decision, schedule next frame
        this._pendingRaf = requestAnimationFrame(loop);
      }
    };
    this._pendingRaf = requestAnimationFrame(loop);
  }

  _frameCheck() {
    if (this._destroyed || !this._pending) return;
    const now = performance.now();
    const sinceLast = now - this._lastEmit;
    const sinceFirstPending = now - this._pendingFirstTs;

    const mustEmit = sinceLast >= this.minEmitMs || sinceFirstPending >= this.maxDelayMs;

    if (mustEmit) {
      this._emit(now, false);
    }
  }

  _emit(now, force) {
    const lastEntry = this.buffer.last();
    if (!lastEntry) {
      this._pending = false;
      return;
    }

    // Same-value short-circuit
    if (!this.emitOnSameValue && !force) {
      if (this._pendingSameValCandidate && this._lastEmittedVal === lastEntry.v) {
        this._stats.skipsSame++;
        perfCount('databus.emit.skippedSame');
        // Reset pending state anyway (since we consider the burst resolved)
        this._pending = false;
        this._pendingCount = 0;
        this._pendingSameValCandidate = false;
        // Update last emit time (we consumed the window) to avoid infinite skip loops
        this._lastEmit = now;
        return;
      }
    }

    const endPerf = perfTimeStart('databus.emit.exec');
    perfCount('databus.emit.flush'); // flush cycle that actually emits
    perfCount('databus.emit');

    // Notify all subscribers
    const payload = { t: lastEntry.t, v: lastEntry.v, buffer: this.buffer };
    let subCount = 0;
    for (const cb of this.subscribers) {
      try { cb(payload); } catch (_) {}
      subCount++;
    }
    if (subCount) {
      // track number of subscriber calls
      for (let i = 0; i < subCount; i++) perfCount('databus.emit.subscribers');
    }

    endPerf && endPerf();
    this._lastEmit = now;
    this._lastEmittedVal = lastEntry.v;
    this._pending = false;
    this._pendingCount = 0;
    this._pendingSameValCandidate = false;
    this._stats.emits++;
  }

  /* ------------------------------ History preload ------------------------------- */
  async _preloadHistory() {
    const hours = this.cfg.history?.hours ?? 24;
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600 * 1000);
    if (this.hass?.callApi && this.cfg.entity) {
      try {
        const path = `history/period/${start.toISOString()}?filter_entity_id=${this.cfg.entity}&end_time=${end.toISOString()}&minimal_response`;
        const hist = await this.hass.callApi('GET', path);
        const series = Array.isArray(hist) && Array.isArray(hist[0]) ? hist[0] : [];
        for (const point of series) {
          const ts = new Date(point.last_changed || point.last_updated || end).getTime();
            const raw = this.cfg.attribute ? point.attributes?.[this.cfg.attribute] : point.state;
          const val = this._toNumber(raw);
          if (val !== null) {
            this.buffer.push(ts, val);
          }
        }
      } catch (_) {}
    }
  }

  /* ------------------------------ Live subscription ------------------------------ */
  async _subscribeLive() {
    if (!this.hass?.connection?.subscribeEvents || !this.cfg.entity) return;
    const entityId = this.cfg.entity;
    this.unsub = await this.hass.connection.subscribeEvents((ev) => {
      const e = ev?.data?.new_state;
      if (!e || e.entity_id !== entityId) return;
      const ts = new Date(e.last_changed || e.last_updated || Date.now()).getTime();
      const raw = this.cfg.attribute ? e.attributes?.[this.cfg.attribute] : e.state;
      const val = this._toNumber(raw);
      this._onRawEventValue(ts, val);
    }, 'state_changed');
  }

  _toNumber(raw) {
    if (raw === undefined || raw === null) return null;
    const n = Number(raw);
    if (!isNaN(n)) return n;
    if (raw === 'on' || raw === true) return 1;
    if (raw === 'off' || raw === false) return 0;
    return null;
  }
}

/* ---------------------------------- DataBus ---------------------------------- */
export class DataBus {
  constructor() {
    this._sources = new Map();
  }

  /**
   * Register (or reuse) a source.
   * @param {string} name
   * @param {object} cfg
   * @param {object} hass
   * @returns {Promise<DataSource>}
   */
  async registerSource(name, cfg, hass) {
    if (this._sources.has(name)) return this._sources.get(name);
    const src = new DataSource(cfg, hass);
    this._sources.set(name, src);
    await src.start();
    return src;
  }

  getSource(name) {
    return this._sources.get(name) || null;
  }

  async ensureSources(sourceMap = {}, hass) {
    const entries = Object.entries(sourceMap || {});
    await Promise.all(entries.map(([name, cfg]) => this.registerSource(name, cfg, hass)));
  }

  stopAll() {
    for (const s of this._sources.values()) s.stop();
    this._sources.clear();
  }

  listSources() {
    return Array.from(this._sources.keys());
  }

  getSourceStats(name) {
    const s = this._sources.get(name);
    return s ? s.getStats() : null;
  }

  flushAll(forceIgnoreIntervals = false) {
    for (const s of this._sources.values()) {
      try { s.flush(forceIgnoreIntervals); } catch (_) {}
    }
  }
}

/* ---------------------------------- Global attach ---------------------------------- */
(function attachGlobal() {
  window.cblcars = window.cblcars || {};
  if (!window.cblcars.data || !(window.cblcars.data instanceof DataBus)) {
    window.cblcars.data = new DataBus();
  } else {
    // Extend existing instance with new methods if upgrading
    const db = window.cblcars.data;
    if (typeof db.listSources !== 'function') {
      db.listSources = DataBus.prototype.listSources;
    }
    if (typeof db.getSourceStats !== 'function') {
      db.getSourceStats = DataBus.prototype.getSourceStats;
    }
    if (typeof db.flushAll !== 'function') {
      db.flushAll = DataBus.prototype.flushAll;
    }
  }
})();