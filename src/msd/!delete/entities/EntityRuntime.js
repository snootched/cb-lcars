import { perfInc, perfSet } from '../perf/PerfCounters.js';

export class EntityRuntime {
  constructor(onFlush) {
    this._entities = new Map();          // entity_id -> { state, attributes }
    this._pending = new Set();           // changed ids awaiting flush
    this._scheduled = false;
    this._onFlush = onFlush;
  }

  getEntity(id) {
    return this._entities.get(id) || null;
  }

  listIds() {
    return Array.from(this._entities.keys());
  }

  ingestHassStates(hassStates) {
    if (!hassStates) return;
    for (const [id, ent] of Object.entries(hassStates)) {
      const prev = this._entities.get(id);
      if (!prev || prev.state !== ent.state || !shallowAttrEqual(prev.attributes, ent.attributes)) {
        this._entities.set(id, { state: ent.state, attributes: ent.attributes || {} });
        this._pending.add(id);
        perfInc('entities.changed.count', 1);
      }
    }
    if (this._pending.size && !this._scheduled) {
      this._scheduled = true;
      Promise.resolve().then(() => this._flush());
    }
  }

  _flush() {
    if (!this._pending.size) { this._scheduled = false; return; }
    const batch = Array.from(this._pending);
    this._pending.clear();
    this._scheduled = false;
    perfInc('entities.batch.flush.count', 1);
    perfSet('entities.batch.size.last', batch.length);
    try {
      this._onFlush && this._onFlush(batch);
    } catch (e) {
      // swallow to avoid cascading failures
      // (optional: add issues collection later)
      console.warn('[MSD v1] EntityRuntime flush error', e);
    }
  }

  stats() {
    return {
      total: this._entities.size,
      pending: this._pending.size
    };
  }
}

function shallowAttrEqual(a = {}, b = {}) {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}
