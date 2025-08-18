/**
 * CB-LCARS Routing Channels / Buses (Rectangles Only - Phase B)
 *
 * Features (Phase B):
 *  - Parse rectangle channel definitions from global config (msd.routing.channels)
 *  - Build per-grid channel masks (Uint8Array per channel; 1 = cell inside corridor)
 *  - Simple occupancy counting (# of unique path cells through each channel)
 *  - Debug inspection helpers
 *
 * Deferred:
 *  - Polyline + radius corridors
 *  - Corridor layering / styling
 *  - Bus taper / glow aesthetics
 *  - Advanced channel preference heuristics
 */

import { cblcarsLog } from '../utils/cb-lcars-logging.js';

const _global = {
  // occupancy[channelId] = cumulative cell count across accepted paths
  occupancy: {},
  // last built masks keyed by grid.signature + channelSignature
  maskCache: new WeakMap(), // WeakMap<Grid, { key:string, masks: Record<id,Uint8Array> }>
};

/**
 * Normalize & filter channels (rect only).
 * @param {Array<object>} raw
 * @returns {Array<{id:string,rect:[number,number,number,number],weight:number,layer:number}>}
 */
export function parseChannels(raw = []) {
  return (Array.isArray(raw) ? raw : [])
    .filter(c => c && c.id && Array.isArray(c.rect) && c.rect.length === 4)
    .map(c => ({
      id: String(c.id),
      rect: [Number(c.rect[0]), Number(c.rect[1]), Number(c.rect[2]), Number(c.rect[3])],
      weight: Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 1,
      layer: Number.isFinite(c.layer) ? c.layer : 0
    }))
    .filter(c => c.rect.every(n => Number.isFinite(n)));
}

/**
 * Initialize occupancy map for a given channel list (idempotent additive).
 * @param {Array<{id:string}>} channels
 */
export function initOccupancy(channels) {
  for (const c of channels) {
    if (!_global.occupancy[c.id]) _global.occupancy[c.id] = 0;
  }
  return _global.occupancy;
}

/**
 * Build (or reuse) channel masks for a grid.
 * Each mask: Uint8Array length = cols*rows; 1 where cell center inside rect.
 * @param {Grid} grid
 * @param {Array<object>} channels
 * @returns {Record<string,Uint8Array>}
 */
export function buildChannelMasks(grid, channels) {
  if (!grid || !channels || !channels.length) return {};
  const key = channels.map(c => `${c.id}:${c.rect.join(',')}`).join('|');
  let cacheEntry = _global.maskCache.get(grid);
  if (cacheEntry && cacheEntry.key === key) return cacheEntry.masks;

  const masks = {};
  for (const ch of channels) {
    const arr = new Uint8Array(grid.cols * grid.rows);
    const [rx, ry, rw, rh] = ch.rect;
    for (let gy = 0; gy < grid.rows; gy++) {
      const rowOff = gy * grid.cols;
      const cy = grid.viewBox[1] + (gy + 0.5) * grid.cellH;
      if (cy < ry || cy > ry + rh) continue;
      for (let gx = 0; gx < grid.cols; gx++) {
        const cx = grid.viewBox[0] + (gx + 0.5) * grid.cellW;
        if (cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh) {
          arr[rowOff + gx] = 1;
        }
      }
    }
    masks[ch.id] = arr;
  }
  _global.maskCache.set(grid, { key, masks });
  return masks;
}

/**
 * Determine channels hit by path (list of cell centers) using masks.
 * @param {Grid} grid
 * @param {Array<[number,number]>} points (cell-center points)
 * @param {Record<string,Uint8Array>} masks
 * @returns {string[]} channel ids used
 */
export function channelsHit(grid, points, masks) {
  if (!grid || !points || !points.length) return [];
  const used = new Set();
  if (!masks) return [];
  for (const [x, y] of points) {
    const gx = Math.max(0, Math.min(grid.cols - 1, Math.floor((x - grid.viewBox[0]) / grid.cellW)));
    const gy = Math.max(0, Math.min(grid.rows - 1, Math.floor((y - grid.viewBox[1]) / grid.cellH)));
    const idx = gy * grid.cols + gx;
    for (const [id, arr] of Object.entries(masks)) {
      if (arr[idx]) used.add(id);
    }
  }
  return Array.from(used);
}

/**
 * Increment occupancy counts for channels used by a path.
 * @param {string[]} channelIds
 * @param {number} weightCells number of unique cells (approx path length in cells)
 */
export function incrementOccupancy(channelIds, weightCells) {
  for (const id of channelIds) {
    if (_global.occupancy[id] == null) _global.occupancy[id] = 0;
    _global.occupancy[id] += weightCells;
  }
}

/**
 * Public API for inspection.
 */
export function getOccupancy() {
  return { ..._global.occupancy };
}

/**
 * Debug helper stub (future: draw translucent rectangles).
 * @param {ShadowRoot} root
 * @param {Array<object>} channels
 */
export function debugRenderChannels(root, channels) {
  if (!root || !channels || !channels.length) return;

  const flags = window.cblcars?._debugFlags || {};
  // STRICT: only render when channels flag explicitly true
  if (!flags.channels) {
    // If previously rendered, remove layer
    try {
      const svg = root.querySelector?.('#msd_svg_overlays svg') || root.querySelector?.('#cblcars-msd-wrapper svg');
      const old = svg?.querySelector('#cblcars-channels-debug');
      if (old) old.remove();
    } catch(_) {}
    return;
  }

  const svg = root.querySelector?.('#msd_svg_overlays svg') || root.querySelector?.('svg');
  if (!svg) return;
  let layer = svg.querySelector('#cblcars-channels-debug');
  if (layer) layer.remove();
  layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  layer.id = 'cblcars-channels-debug';
  layer.setAttribute('opacity', '0.18');
  layer.setAttribute('pointer-events', 'none');

  const palette = ['var(--lcars-blue)','var(--lcars-teal)','var(--lcars-purple)','var(--lcars-orange)','var(--lcars-pink)'];
  layer.innerHTML = channels.map((c,i) => {
    const [x, y, w, h] = c.rect;

    const color = palette[i % palette.length];
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" stroke="none">
       <title>${c.id}</title></rect>`;
  }).join('');
  svg.appendChild(layer);
}


/**
 * Ensure channel debug render if flags active & channels present.
 * Safe to call frequently; will rebuild layer each time.
 * @param {ShadowRoot} root
 */
export function ensureChannelDebug(root) {
  try {

    const flags = window.cblcars?._debugFlags || {};
    if (!flags.channels) {
      // Clean up if layer exists and flag turned off
      const svg = root.querySelector?.('#msd_svg_overlays svg') || root.querySelector?.('#cblcars-msd-wrapper svg');
      const old = svg?.querySelector('#cblcars-channels-debug');
      if (old) old.remove();
      return;
    }

    const parsed = window.cblcars?.routing?._parsedChannels;
    if (!parsed || !parsed.length) return;
    debugRenderChannels(root, parsed);
  } catch (_) {}
}


function attachGlobal() {
  window.cblcars = window.cblcars || {};
  window.cblcars.routing = window.cblcars.routing || {};
  const ns = window.cblcars.routing;
  if (!ns.channels || !ns.channels.buildChannelMasks) {
    ns.channels = {
      parseChannels,
      initOccupancy,
      buildChannelMasks,
      channelsHit,
      incrementOccupancy,
      getOccupancy,
      debugRenderChannels,
      ensureChannelDebug
    };
    cblcarsLog.info('[routing.channels] Rectangle channel module active');
  }
}
attachGlobal();