/**
 * CB-LCARS Routing Core (Scaffolding)
 *
 * Responsibilities (future):
 *  - Global routing config management (msd.variables.routing)
 *  - Obstacle collection & hashing
 *  - Path signature building & hashing
 *  - Cost model utilities
 *  - Path compression, quantization, hashing
 *  - Dispatch to specific strategy (manhattan, heuristic, grid)
 *  - Debug + perf counters integration
 *
 * Non-breaking scaffolding: all heavy logic is TODO; current router remains default.
 */

import { cblcarsLog } from '../utils/cb-lcars-logging.js';
import * as geo from '../utils/cb-lcars-geometry-utils.js';

/** @typedef {[number,number]} Point */
/** @typedef {{x:number,y:number,w:number,h:number}} Rect */

const ROUTING_NS_VERSION = 1;

/* ------------------------------------------------------------------
 * Global config & state
 * ------------------------------------------------------------------ */
const _state = {
  globalConfig: {
    default_mode: 'manhattan', // 'manhattan' | 'grid' | 'smart'
    clearance: 8,
    grid_resolution: 56,
    max_expansions: 6000,
    cost_defaults: {
      distance: 1,
      bend: 12,
      proximity: 4,
      channel: 0.6,
      spacing: 8
    },
    fallback: {
      max_cost_multiple: 4.0,
      enable_two_elbow: false
    },
    channels: [],
    obstacles: [],
    aesthetics: {
      arc_corners: false,
      arc_radius_min: 12,
      taper_buses: false,
      glow_buses: false
    }
  },
  obstacleCache: new WeakMap(), // WeakMap<root, { signature:string, list:Rect[] }>
  gridCache: new WeakMap(),     // Provided for grid module usage
  channelCache: new WeakMap(),  // Provided for channels module
};

/**
 * Set (merge) global routing config.
 * @param {object} cfg
 */
export function setGlobalConfig(cfg = {}) {
  if (!cfg || typeof cfg !== 'object') return;
  _state.globalConfig = deepMerge({}, _state.globalConfig, cfg);
  cblcarsLog.info('[routing.core] Global routing config applied', _state.globalConfig);
}

/**
 * Get merged global routing config.
 */
export function getGlobalConfig() {
  return _state.globalConfig;
}

/* ------------------------------------------------------------------
 * Utilities
 * ------------------------------------------------------------------ */

/**
 * Simple deep merge (non-array objects)
 * @param {object} target
 * @param  {...object} sources
 * @returns {object}
 */
export function deepMerge(target, ...sources) {
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  for (const src of sources) {
    if (!isObj(src)) continue;
    for (const k of Object.keys(src)) {
      if (isObj(src[k])) {
        if (!isObj(target[k])) target[k] = {};
        deepMerge(target[k], src[k]);
      } else {
        target[k] = src[k];
      }
    }
  }
  return target;
}

/**
 * Quantize a point for stable hashing.
 * @param {Point} pt
 * @param {number} q
 */
export function quantizePoint(pt, q = 0.25) {
  if (!pt) return pt;
  return [Math.round(pt[0] / q) * q, Math.round(pt[1] / q) * q];
}

/**
 * Hash helper (simple xor / shift).
 * @param {string} str
 * @returns {string}
 */
export function fastHash(str) {
  let h = 0, i = 0;
  while (i < str.length) {
    h = (h << 5) - h + str.charCodeAt(i++) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Build obstacle signature from list of rects.
 * @param {Rect[]} rects
 */
export function obstacleSignature(rects) {
  if (!Array.isArray(rects)) return 'none';
  return fastHash(rects.map(r => `${round(r.x)},${round(r.y)},${round(r.w)},${round(r.h)}`).join('|'));
}

function round(v) { return Math.round(v * 100) / 100; }

/**
 * Collect obstacles (stub).
 * Future: global obstacles + per-connector avoid list + channel occupancy expansions.
 * @param {ShadowRoot|Element} root
 * @param {string[]} ids
 * @param {number} clearance
 * @returns {{rects:Rect[], signature:string}}
 */
export function collectObstacles(root, ids = [], clearance = 0) {
  // NOTE: Current implementation JUST looks up same elements by id and inflates.
  const rects = [];
  const svg = geo.getReferenceSvg(root);
  for (const id of ids) {
    const el = root.getElementById?.(id);
    if (!el) continue;
    try {
      if (typeof el.getBBox === 'function') {
        const bb = el.getBBox();
        rects.push({
          x: bb.x - clearance,
            y: bb.y - clearance,
          w: bb.width + clearance * 2,
          h: bb.height + clearance * 2
        });
      }
    } catch (_) {}
  }
  const sig = obstacleSignature(rects);
  return { rects, signature: sig };
}

/**
 * Compress a raw grid path (list of Points) to turn-only polyline.
 * @param {Point[]} pts
 * @returns {Point[]}
 */
export function compressOrthogonal(pts) {
  if (!Array.isArray(pts) || pts.length < 3) return pts || [];
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = out[out.length - 1];
    const [bx, by] = pts[i];
    const [cx, cy] = pts[i + 1];
    const collinear = (ax === bx && bx === cx) || (ay === by && by === cy);
    if (!collinear) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Build path cost breakdown (placeholder)
 * Future: distance, bends, proximity, channels, spacing penalties.
 * @param {Point[]} pts
 * @param {object} costWeights
 */
export function scorePath(pts, costWeights) {
  const { distance = 1, bend = 12 } = costWeights || {};
  if (!pts || pts.length < 2) {
    return { total: 0, distanceCost: 0, bendCost: 0, bends: 0 };
  }
  let dist = 0;
  let bends = 0;
  let lastDir = null;
  for (let i = 1; i < pts.length; i++) {
    const dx = Math.abs(pts[i][0] - pts[i - 1][0]);
    const dy = Math.abs(pts[i][1] - pts[i - 1][1]);
    dist += dx + dy;
    const dir = dx > 0 ? 'h' : (dy > 0 ? 'v' : lastDir);
    if (lastDir && dir && dir !== lastDir) bends++;
    lastDir = dir;
  }
  const distanceCost = dist * distance;
  const bendCost = bends * bend;
  return {
    total: distanceCost + bendCost,
    distanceCost,
    bendCost,
    bends
  };
}

/**
 * Build stable path hash.
 * @param {Point[]} pts
 */
export function pathHash(pts) {
  return fastHash((pts || []).map(p => `${round(p[0])},${round(p[1])}`).join(';'));
}

/**
 * Strategy selection (placeholder for future SMART mode).
 * @param {string} explicitMode
 * @param {string} globalDefault
 * @returns {'manhattan'|'grid'}
 */
export function selectMode(explicitMode, globalDefault) {
  if (explicitMode === 'grid') return 'grid';
  if (explicitMode === 'manhattan' || explicitMode === 'xy' || explicitMode === 'yx') return 'manhattan';
  if (explicitMode === 'smart') {
    // TODO: Implement heuristics: try Manhattan then grid if blocked.
    return 'manhattan';
  }
  // Fallback to global default
  if (globalDefault === 'grid') return 'grid';
  return 'manhattan';
}

/**
 * Public debug inspection (populated later by grid / channels).
 * @param {string} connectorId
 */
export function inspect(connectorId) {
  const reg = window.cblcars?.routing?._registry || {};
  return reg[connectorId] || null;
}

/**
 * Register a computed routing result (so debug.inspect can return metadata).
 * @param {string} id
 * @param {object} meta
 */
export function registerResult(id, meta) {
  window.cblcars = window.cblcars || {};
  window.cblcars.routing = window.cblcars.routing || {};
  window.cblcars.routing._registry = window.cblcars.routing._registry || {};
  window.cblcars.routing._registry[id] = meta;
}

/* ------------------------------------------------------------------
 * Init global namespace
 * ------------------------------------------------------------------ */
function attachGlobal() {
  window.cblcars = window.cblcars || {};
  window.cblcars.routing = window.cblcars.routing || {};
  const ns = window.cblcars.routing;
  if (!ns._coreVersion) {
    Object.assign(ns, {
      _coreVersion: ROUTING_NS_VERSION,
      setGlobalConfig,
      getGlobalConfig,
      collectObstacles,
      compressOrthogonal,
      quantizePoint,
      scorePath,
      pathHash,
      selectMode,
      inspect,
      registerResult
    });
    cblcarsLog.info('[routing.core] Attached namespace v' + ROUTING_NS_VERSION);
  }
}
attachGlobal();