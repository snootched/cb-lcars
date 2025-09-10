// Lightweight HUD Event Bus
export class HudEventBus {
  constructor() {
    this._listeners = new Map(); // event -> Set<fn>
  }
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }
  once(event, fn) {
    const off = this.on(event, (p) => { off(); fn(p); });
  }
  off(event, fn) {
    this._listeners.get(event)?.delete(fn);
  }
  emit(event, payload) {
    const list = this._listeners.get(event);
    if (list) {
      list.forEach(fn => {
        try { fn(payload); } catch (e) { /* swallow */ }
      });
    }
    // Wildcard listeners
    const any = this._listeners.get('*');
    if (any) {
      any.forEach(fn => {
        try { fn({ event, payload }); } catch (_) {}
      });
    }
  }
  clear() {
    this._listeners.clear();
  }
}
