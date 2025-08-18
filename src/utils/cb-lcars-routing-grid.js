/**
 * CB-LCARS Grid Routing (with Rect Channel + Proximity Integration)
 *
 * Provides:
 *  - Grid build + caching
 *  - A* orthogonal pathfinding (4‑dir)
 *  - Endpoint proximity validation (rejects far-off end)
 *  - Simple proximity penalty (3×3 neighbor blocked scan)
 *  - Channel corridor cost bias (rectangle channels; multiplier <1 lowers step cost)
 *  - Require mode: fail attempt if no preferred channel traversed
 *  - Occupancy accounting (unique raw path cells)
 *  - Cost breakdown placeholder (distance + bends now; proximity/channel fields reserved)
 *  - Structured failure reasons for fallback logic
 *
 * Deferred (future sets):
 *  - Two-elbow heuristic (pre-grid)
 *  - Rounded corner post-processing for grid paths
 *  - Spacing / parallel penalty & re-route
 *  - Polyline + radius channels
 *  - Channel capacity / aesthetic styling
 *  - Explicit proximityCost accumulation (currently folded into gCost)
 */

import { cblcarsLog } from './cb-lcars-logging.js';
import {
  fastHash,
  compressOrthogonal,
  scorePath,
  pathHash,
  quantizePoint
} from './cb-lcars-routing-core.js';
import { buildChannelMasks, channelsHit, incrementOccupancy } from './cb-lcars-routing-channels.js';

/** @typedef {{cols:number,rows:number,cellW:number,cellH:number,blocked:Uint8Array,signature:string,viewBox:[number,number,number,number]}} Grid */

const GRID_CACHE = new WeakMap(); // WeakMap<ShadowRoot|Element, Map<string, Grid>>

function getCache(root) {
  if (!root) return null;
  let map = GRID_CACHE.get(root);
  if (!map) {
    map = new Map();
    GRID_CACHE.set(root, map);
  }
  return map;
}

function inflate(r, c) {
  return { x: r.x - c, y: r.y - c, w: r.w + c * 2, h: r.h + c * 2 };
}

function gridSignature(viewBox, resolution, obstacles, clearance) {
  const resKey = Array.isArray(resolution) ? resolution.join('x') : String(resolution);
  const obsKey = (obstacles || [])
    .map(o => `${o.x.toFixed(1)},${o.y.toFixed(1)},${o.w.toFixed(1)},${o.h.toFixed(1)}`)
    .join('|');
  return fastHash(`vb:${viewBox.join(',')}|res:${resKey}|cl:${clearance}|obs:${obsKey}`);
}

/**
 * Build / fetch cached grid.
 * resolution:
 *   number => columns, rows scaled by aspect
 *   [cols, rows] => explicit
 */
export function buildGrid(root, opts) {
  const {
    viewBox = [0, 0, 100, 100],
    resolution = 56,
    obstacles = [],
    clearance = 0
  } = opts || {};
  const [minX, minY, vbW, vbH] = viewBox;

  let cols, rows;
  if (Array.isArray(resolution)) {
    cols = Math.max(4, Math.floor(resolution[0]));
    rows = Math.max(4, Math.floor(resolution[1]));
  } else {
    cols = Math.max(4, Math.floor(resolution));
    rows = Math.max(4, Math.round((vbH / vbW) * cols));
  }

  const sig = gridSignature(viewBox, [cols, rows], obstacles, clearance);
  const cache = getCache(root);
  if (cache && cache.has(sig)) return cache.get(sig);

  const blocked = new Uint8Array(cols * rows);
  const cellW = vbW / cols;
  const cellH = vbH / rows;
  const inflateC = Math.max(0, clearance);

  for (const o of obstacles) {
    if (!o) continue;
    const r = inflate(o, inflateC);
    const c0 = Math.max(0, Math.floor((r.x - minX) / cellW));
    const c1 = Math.min(cols - 1, Math.floor((r.x + r.w - minX) / cellW));
    const r0 = Math.max(0, Math.floor((r.y - minY) / cellH));
    const r1 = Math.min(rows - 1, Math.floor((r.y + r.h - minY) / cellH));
    for (let gy = r0; gy <= r1; gy++) {
      const rowOff = gy * cols;
      for (let gx = c0; gx <= c1; gx++) blocked[rowOff + gx] = 1;
    }
  }

  const grid = { cols, rows, cellW, cellH, blocked, signature: sig, viewBox };
  if (cache) cache.set(sig, grid);
  return grid;
}

function toCell(grid, pt) {
  const [minX, minY] = grid.viewBox;
  let gx = Math.floor((pt[0] - minX) / grid.cellW);
  let gy = Math.floor((pt[1] - minY) / grid.cellH);
  gx = Math.max(0, Math.min(grid.cols - 1, gx));
  gy = Math.max(0, Math.min(grid.rows - 1, gy));
  return [gx, gy];
}

function cellCenter(grid, gx, gy) {
  const [minX, minY] = grid.viewBox;
  return [minX + (gx + 0.5) * grid.cellW, minY + (gy + 0.5) * grid.cellH];
}

/**
 * A* 4-dir with:
 *  - tiny directional turn penalty (for path shape preference)
 *  - proximity penalty (3×3 scan)
 *  - channel multiplier (cost reduction)
 *
 * channelCtx: {
 *   masks: Record<channelId, Uint8Array>,
 *   preferred: Set<string>,
 *   mode: 'allow'|'prefer'|'require',
 *   weightsById: Record<string,number>
 * }
 */
export function aStar(grid, startPt, endPt, costParams = {}, limits = {}, channelCtx = null) {
  if (!grid) return { points: [], expansions: 0, success: false, reason: 'no_grid', open: 0, closed: 0 };
  const maxExp = Math.max(50, limits.maxExpansions || grid?.max_expansions || 6000);

  const [sx, sy] = toCell(grid, startPt);
  const [ex, ey] = toCell(grid, endPt);
  const startIdx = sy * grid.cols + sx;
  const endIdx = ey * grid.cols + ex;
  const { cols, rows, blocked } = grid;

  if (blocked[startIdx]) return { points: [], expansions: 0, success: false, reason: 'start_blocked', open: 0, closed: 0 };
  if (blocked[endIdx]) return { points: [], expansions: 0, success: false, reason: 'end_blocked', open: 0, closed: 0 };

  const gCost = new Float32Array(cols * rows);
  const fCost = new Float32Array(cols * rows);
  const came = new Int32Array(cols * rows);
  const dirFrom = new Int8Array(cols * rows);
  gCost.fill(Infinity); fCost.fill(Infinity); came.fill(-1); dirFrom.fill(-1);

  const openSet = new MinHeap();
  const IN_OPEN = new Uint8Array(cols * rows);
  const CLOSED = new Uint8Array(cols * rows);

  const h = (gx, gy) => Math.abs(gx - ex) + Math.abs(gy - ey);

  // Channel context (optional)
  const {
    masks = null,
    preferred = null,
    mode = 'allow',
    weightsById = null
  } = channelCtx || {};

  gCost[startIdx] = 0;
  fCost[startIdx] = h(sx, sy);
  openSet.push(startIdx, fCost[startIdx]);
  IN_OPEN[startIdx] = 1;

  const DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1]
  ];

  let expansions = 0;
  let openCount = 1;
  let closedCount = 0;

  // Step-level proximity (simple bool). We don't record proximityCost yet; reserved for future.
  const proximityWeight = Number.isFinite(costParams.proximity) ? costParams.proximity : 0;

  while (!openSet.empty()) {
    const current = openSet.pop();
    IN_OPEN[current] = 0;
    if (CLOSED[current]) continue;
    CLOSED[current] = 1;
    closedCount++;

    if (current === endIdx) {
      // reconstruct
      const cells = [];
      let cur = current;
      while (cur !== -1) { cells.push(cur); cur = came[cur]; }
      cells.reverse();
      const points = cells.map(ci => {
        const gy = Math.floor(ci / cols);
        const gx = ci % cols;
        return cellCenter(grid, gx, gy);
      });
      return { points, expansions, success: true, open: openCount, closed: closedCount };
    }

    expansions++;
    if (expansions > maxExp) {
      return { points: [], expansions, success: false, reason: 'expansion_cap', open: openCount, closed: closedCount };
    }

    const cy = Math.floor(current / cols);
    const cx = current % cols;
    const prevDir = dirFrom[current];

    for (let di = 0; di < 4; di++) {
      const nx = cx + DIRS[di][0];
      const ny = cy + DIRS[di][1];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (blocked[ni] || CLOSED[ni]) continue;

      // Base distance
      let stepCost = 1;
      // Tiny turn penalty for queue ordering (final bend cost computed later)
      if (prevDir !== -1 && prevDir !== di) stepCost += 0.001;

      // Proximity penalty (simple 3x3 neighbor scan)
      if (proximityWeight > 0) {
        let proxHit = false;
        for (let py = ny - 1; !proxHit && py <= ny + 1; py++) {
          if (py < 0 || py >= rows) continue;
            const rowOff2 = py * cols;
            for (let px = nx - 1; px <= nx + 1; px++) {
              if (px < 0 || px >= cols) continue;
              if (blocked[rowOff2 + px]) {
                proxHit = true;
                break;
              }
            }
        }
        if (proxHit) stepCost += proximityWeight;
      }

      // Channel multiplier (cost reducer) – choose smallest preferred channel weight
      if (masks && preferred && preferred.size) {
        let matched = false;
        let bestWeight = 1;
        for (const [id, arr] of Object.entries(masks)) {
          if (!preferred.has(id)) continue;
          if (arr[ni]) {
            matched = true;
            const w = weightsById?.[id] ?? 1;
            if (w < bestWeight) bestWeight = w;
          }
        }
        if (matched && bestWeight < 1) {
          stepCost *= bestWeight;
        }
      }

      const tentative = gCost[current] + stepCost;
      if (tentative < gCost[ni]) {
        came[ni] = current;
        gCost[ni] = tentative;
        fCost[ni] = tentative + h(nx, ny);
        dirFrom[ni] = di;
        if (!IN_OPEN[ni]) {
          openSet.push(ni, fCost[ni]);
          IN_OPEN[ni] = 1;
          openCount++;
        } else {
          openSet.decreaseKey(ni, fCost[ni]);
        }
      }
    }
  }
  return { points: [], expansions, success: false, reason: 'no_path', open: openCount, closed: closedCount };
}

function sqDist(a, b) { const dx = a[0] - b[0]; const dy = a[1] - b[1]; return dx * dx + dy * dy; }

/**
 * Grid routing wrapper.
 * Returns meta object:
 *  {
 *    failed, reason, mode, points, rawPoints, expansions, cost,
 *    pathHash, gridSignature, endDelta, resolution,
 *    hitChannels, routeChannelMode
 *  }
 */
export function routeViaGrid(ctx) {
  try {
    const {
      root,
      viewBox = [0,0,100,100],
      start,
      end,
      obstacles = [],
      resolution = 56,
      costParams = {},
      connectorId,
      clearance = 0,
      maxExpansions,
      channels = [],
      routeChannels = [],
      routeChannelMode = 'allow'
    } = ctx || {};
    if (!start || !end) return { failed: true, reason: 'missing_start_end' };

    const grid = buildGrid(root, { viewBox, resolution, obstacles, clearance });

    // Channel prep (rectangles only)
    const channelList = Array.isArray(channels) ? channels : [];
    const preferredSet = new Set((routeChannels || []).filter(Boolean));
    const masks = channelList.length ? buildChannelMasks(grid, channelList) : null;
    const weightsById = channelList.reduce((m, c) => { m[c.id] = c.weight || 1; return m; }, {});

    const res = aStar(
      grid,
      start,
      end,
      costParams,
      { maxExpansions },
      {
        masks,
        preferred: preferredSet,
        mode: routeChannelMode,
        weightsById
      }
    );

    if (!res.success) {
      cblcarsLog.debug('[routing.grid] A* failed', { connectorId, reason: res.reason, expansions: res.expansions, resolution });
      return {
        failed: true,
        reason: res.reason,
        resolution,
        expansions: res.expansions,
        open: res.open,
        closed: res.closed
      };
    }
    if (!res.points || res.points.length < 2) {
      return {
        failed: true,
        reason: 'too_short',
        resolution
      };
    }

    const rawLast = res.points[res.points.length - 1];
    const tol = Math.hypot(grid.cellW, grid.cellH) * 1.5;
    const endDelta = Math.sqrt(sqDist(rawLast, end));
    if (endDelta > tol) {
      return {
        failed: true,
        reason: 'endpoint_mismatch',
        endDelta,
        tol,
        resolution
      };
    }

    // Raw + compressed path
    const polyRaw = res.points;
    const poly = compressOrthogonal(polyRaw.map(p => quantizePoint(p, 0.5)));
    const cost = scorePath(poly, costParams);

    // Channel traversal
    let hitChannels = [];
    if (channelList.length && masks) {
      hitChannels = channelsHit(grid, polyRaw, masks);
      if (routeChannelMode === 'require' && preferredSet.size > 0) {
        const satisfied = hitChannels.some(id => preferredSet.has(id));
        if (!satisfied) {
          return {
            failed: true,
            reason: 'no_required_channel',
            resolution,
            expansions: res.expansions,
            open: res.open,
            closed: res.closed
          };
        }
      }
    }

    if (hitChannels.length) {
      incrementOccupancy(hitChannels, polyRaw.length);
    }

    // Reserve fields for future explicit accounting (proximityCost / channelFactorAvg)
    cost.proximityCost = cost.proximityCost ?? 0;
    cost.channelFactorAvg = cost.channelFactorAvg ?? 1;
    cost.total = cost.total; // (future: + proximityCost + channel adjustments)

    const hash = pathHash(poly);

    return {
      mode: 'grid',
      points: poly,
      rawPoints: polyRaw,
      expansions: res.expansions,
      open: res.open,
      closed: res.closed,
      cost,
      pathHash: hash,
      gridSignature: grid.signature,
      endDelta,
      resolution,
      hitChannels,
      routeChannelMode,
      failed: false,
      reason: 'ok'
    };
  } catch (e) {
    cblcarsLog.warn('[routing.grid] routeViaGrid error', e);
    return { failed: true, reason: 'exception' };
  }
}

/**
 * Optional debug overlay path (dashed path + raw points).
 * @param {ShadowRoot|Element} root
 * @param {{rawPoints:[number,number][]}} meta
 */
export function debugRenderGridPath(root, meta) {
  try {
    if (!root || !meta || !meta.rawPoints || !meta.rawPoints.length) return;
    if (!window.cblcars?._debugFlags?.connectors && !window.cblcars?._debugFlags?.geometry) return;
    const svg = root.querySelector?.('#msd_svg_overlays svg') || root.querySelector?.('#cblcars-msd-wrapper svg');
    if (!svg) return;

    const old = svg.querySelector('#cblcars-grid-debug');
    if (old) old.remove();

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.id = 'cblcars-grid-debug';
    g.setAttribute('opacity', '0.28');
    g.setAttribute('pointer-events', 'none');

    let d = '';
    meta.rawPoints.forEach((p, i) => { d += (i ? 'L' : 'M') + p[0] + ',' + p[1]; });
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', d);
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', '#ffaa00');
    pathEl.setAttribute('stroke-width', '2');
    pathEl.setAttribute('stroke-dasharray', '5,5');
    g.appendChild(pathEl);

    const ptsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    ptsGroup.innerHTML = meta.rawPoints
      .map(pt => `<circle cx="${pt[0]}" cy="${pt[1]}" r="2.5" fill="#ffaa00" />`)
      .join('');
    g.appendChild(ptsGroup);

    svg.appendChild(g);
  } catch (_) {}
}

/* ---------- MinHeap (A* open set) ---------- */
class MinHeap {
  constructor() {
    this.ids = [];
    this.keys = [];
    this.pos = new Map();
  }
  empty() { return this.ids.length === 0; }
  push(id, key) {
    this.ids.push(id);
    this.keys.push(key);
    this.pos.set(id, this.ids.length - 1);
    this._up(this.ids.length - 1);
  }
  pop() {
    if (!this.ids.length) return undefined;
    const id = this.ids[0];
    const lid = this.ids.pop();
    const lk = this.keys.pop();
    this.pos.delete(id);
    if (this.ids.length) {
      this.ids[0] = lid;
      this.keys[0] = lk;
      this.pos.set(lid, 0);
      this._down(0);
    }
    return id;
  }
  decreaseKey(id, newKey) {
    const i = this.pos.get(id);
    if (i == null) return;
    if (newKey >= this.keys[i]) return;
    this.keys[i] = newKey;
    this._up(i);
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this._swap(i, p);
      i = p;
    }
  }
  _down(i) {
    const n = this.ids.length;
    for (;;) {
      let l = i * 2 + 1;
      let r = l + 1;
      let m = i;
      if (l < n && this.keys[l] < this.keys[m]) m = l;
      if (r < n && this.keys[r] < this.keys[m]) m = r;
      if (m === i) break;
      this._swap(i, m);
      i = m;
    }
  }
  _swap(a, b) {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    this.pos.set(this.ids[a], a);
    this.pos.set(this.ids[b], b);
  }
}

function attachGlobal() {
  window.cblcars = window.cblcars || {};
  window.cblcars.routing = window.cblcars.routing || {};
  const ns = window.cblcars.routing;
  ns.grid = ns.grid || {};
  Object.assign(ns.grid, {
    buildGrid,
    aStar,
    routeViaGrid,
    debugRenderGridPath
  });
  if (!ns._gridUpgradedLogged) {
    cblcarsLog.info('[routing.grid] Grid router (channels + proximity) active');
    ns._gridUpgradedLogged = true;
  }
}
attachGlobal();