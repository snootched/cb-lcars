import { perfInc } from '../perf/PerfCounters.js';
import { stableStringify } from '../util/stableStringify.js';

/**
 * Router adapter:
 * - Attempts legacy advanced routing via window.cblcars.connectors / helpers if available.
 * - Falls back to straight line path.
 * - Caches per overlay id + endpoints + mode signature.
 */
export class Router {
  constructor(routingConfig, anchors, viewBox) {
    this.routingConfig = routingConfig || {};
    this.anchors = anchors || {};
    this.viewBox = viewBox || [0,0,400,200];
    this.cache = new Map(); // overlayId -> { key, d, meta }
  }

  updateEnv({ routingConfig, anchors, viewBox }) {
    if (routingConfig) this.routingConfig = routingConfig;
    if (anchors) this.anchors = anchors;
    if (viewBox) this.viewBox = viewBox;
    // Intentionally keep cache (anchors rarely shift); caller may clear if needed.
  }

  computePath(overlay, a1, a2) {
    const raw = overlay._raw || overlay.raw || {};
    const modeFull = raw.route_mode_full || raw.route_mode || raw.route || 'auto';
    const avoid = raw.avoid || [];
    const channels = raw.route_channels || [];
    const channelMode = raw.route_channel_mode || raw.channel_mode;
    const attachSide = raw.attach_side;
    const keyObj = {
      a1, a2,
      modeFull,
      avoid: avoid.slice().sort(),
      channels: channels.slice().sort(),
      channelMode,
      attachSide,
      width: overlay.finalStyle?.width,
      corner: overlay.finalStyle?.corner_radius
    };
    const key = stableStringify(keyObj);
    const cached = this.cache.get(overlay.id);
    if (cached && cached.key === key) {
      perfInc('connectors.route.cache.hit', 1);
      return cached;
    }
    perfInc('connectors.route.cache.miss', 1);

    // Try legacy advanced routing if available
    let d = `M${a1[0]},${a1[1]} L${a2[0]},${a2[1]}`;
    let meta = { strategy: 'fallback-line' };
    try {
      const legacy = typeof window !== 'undefined' ? (window.cblcars?.connectors) : null;
      // Heuristic: prefer a legacy API if present (adjust names if actual differ)
      const api = legacy && (legacy.computeOverlayRoute || legacy.computeRoute || legacy.route);
      if (api) {
        const res = api({
          id: overlay.id,
            a1,
            a2,
            overlay,
            anchors: this.anchors,
            viewBox: this.viewBox,
            routing: this.routingConfig,
            raw
        });
        if (res && typeof res === 'object') {
          if (res.d) {
            d = res.d;
            meta = { strategy: res.strategy || 'legacy', bends: res.bends, cost: res.cost };
          } else if (res.path) {
            d = res.path;
            meta = { strategy: res.strategy || 'legacy' };
          }
        } else if (typeof res === 'string') {
          d = res;
          meta = { strategy: 'legacy-string' };
        }
      } else {
        // Attempt grid/manhattan helper fallback if exposed
        const manhattan = legacy?.manhattanRoute;
        if (manhattan) {
          const m = manhattan(a1, a2, raw, this.routingConfig);
          if (m && m.d) {
            d = m.d;
            meta = { strategy: 'legacy-manhattan' };
          }
        }
      }
      if (meta.strategy.startsWith('fallback')) perfInc('connectors.route.fallback', 1);
    } catch {
      perfInc('connectors.route.fallback', 1);
      d = `M${a1[0]},${a1[1]} L${a2[0]},${a2[1]}`;
      meta = { strategy: 'error-fallback' };
    }

    const record = { key, d, meta };
    this.cache.set(overlay.id, record);
    return record;
  }

  invalidate(id) {
    if (id === '*') this.cache.clear();
    else this.cache.delete(id);
  }

  stats() {
    return {
      cacheSize: this.cache.size,
      routingMode: this.routingConfig?.default_mode
    };
  }
}
