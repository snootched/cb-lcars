import { parseTimeWindowMs } from './cb-lcars-time-utils.js';

/**
 * CB-LCARS Data Bus: shared live/history data sources for overlays and charts.
 * - One bus per window (global), but card subscriptions are tracked per-card so we can clean up.
 * - Uses HA WebSocket events for live updates, and REST/WS for history preload.
 */
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

export class DataSource {
  constructor(cfg, hass) {
    this.cfg = cfg;
    this.hass = hass;

    // windowSeconds: number (sec) or string with units -> seconds
    let wsSec = 60;
    if (typeof cfg.windowSeconds === 'number' && isFinite(cfg.windowSeconds)) {
      wsSec = Math.max(1, cfg.windowSeconds);
    } else if (typeof cfg.windowSeconds === 'string') {
      const ms = parseTimeWindowMs(cfg.windowSeconds);
      if (Number.isFinite(ms)) wsSec = Math.max(1, Math.floor(ms / 1000));
    }

    const cap = Math.max(60, Math.floor(wsSec * 10));
    this.buffer = new RollingBuffer(cap);
    this.subscribers = new Set();
    this.unsub = null;
    this._lastEmit = 0;
    this.sampleMs = Math.max(50, cfg.sampleMs ?? 100);
    this._pendingNotify = false;
    this._raf = null;
  }
  async start() {
    if (this.cfg.history?.preload) {
      try {
        await this._preloadHistory();
        // Force one immediate notify after preload so new subscribers render real data
        if (this.buffer.last()) this._enqueueNotify();
      } catch (_) {}
    }
    await this._subscribeLive();
  }
  stop() {
    try { this.unsub && this.unsub(); } catch (_) {}
    this.unsub = null;
    this.subscribers.clear();
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._pendingNotify = false;
  }
  subscribe(cb) {
    this.subscribers.add(cb);
    const last = this.buffer.last();
    if (last) cb({ t: last.t, v: last.v, buffer: this.buffer });
    return () => this.subscribers.delete(cb);
  }
  _enqueueNotify() {
    if (this._pendingNotify) return;
    this._pendingNotify = true;
    this._raf = requestAnimationFrame(() => {
      this._pendingNotify = false;
      const now = performance.now();
      if (now - this._lastEmit < this.sampleMs) return;
      this._lastEmit = now;
      for (const cb of this.subscribers) {
        try { cb({ t: Date.now(), v: this.buffer.last()?.v, buffer: this.buffer }); } catch (_) {}
      }
    });
  }
  async _preloadHistory() {
    const hours = this.cfg.history?.hours ?? 24;
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600 * 1000);
    if (this.hass?.callApi) {
      const path = `history/period/${start.toISOString()}?filter_entity_id=${this.cfg.entity}&end_time=${end.toISOString()}&minimal_response`;
      const hist = await this.hass.callApi('GET', path);
      const series = Array.isArray(hist) && Array.isArray(hist[0]) ? hist[0] : [];
      for (const point of series) {
        const ts = new Date(point.last_changed || point.last_updated || end).getTime();
        const raw = this.cfg.attribute ? point.attributes?.[this.cfg.attribute] : point.state;
        const val = this._toNumber(raw);
        if (val !== null) this.buffer.push(ts, val);
      }
      // Guarantee one notification so first paint reflects history
      if (this.buffer.last()) this._enqueueNotify();
    }
  }
  async _subscribeLive() {
    if (!this.hass?.connection?.subscribeEvents) return;
    const entityId = this.cfg.entity;
    this.unsub = await this.hass.connection.subscribeEvents((ev) => {
      const e = ev?.data?.new_state;
      if (!e || e.entity_id !== entityId) return;
      const ts = new Date(e.last_changed || e.last_updated || Date.now()).getTime();
      const raw = this.cfg.attribute ? e.attributes?.[this.cfg.attribute] : e.state;
      const val = this._toNumber(raw);
      if (val === null) return;
      this.buffer.push(ts, val);
      this._enqueueNotify();
    }, 'state_changed');
  }
  _toNumber(raw) {
    if (raw === undefined || raw === null) return 0;
    const n = Number(raw);
    if (!isNaN(n)) return n;
    if (raw === 'on' || raw === true) return 1;
    if (raw === 'off' || raw === false) return 0;
    return null;
  }
}

export class DataBus {
  constructor() {
    this._sources = new Map();
  }
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
}