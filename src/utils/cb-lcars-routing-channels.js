/**
 * CB-LCARS Routing Channels / Buses (Scaffolding)
 *
 * Future:
 *  - Channel definition parsing (rect / polyline+radius)
 *  - Corridor membership tests
 *  - Channel occupancy tracking
 *  - Cost multipliers when inside preferred channels
 *  - Debug rendering of channel corridors
 */

import { cblcarsLog } from '../utils/cb-lcars-logging.js';

/**
 * Parse channels from global config (stub – returns normalized objects).
 * @param {Array<object>} raw
 * @returns {Array<object>}
 */
export function parseChannels(raw = []) {
  return (Array.isArray(raw) ? raw : [])
    .map(ch => ({
      id: ch.id,
      rect: Array.isArray(ch.rect) ? ch.rect.slice() : null,
      polyline: Array.isArray(ch.polyline) ? ch.polyline.map(p => p.slice()) : null,
      radius: Number.isFinite(ch.radius) ? ch.radius : 0,
      weight: Number.isFinite(ch.weight) ? ch.weight : 1,
      layer: ch.layer || 0,
      _raw: ch
    }))
    .filter(c => c.id);
}

/**
 * Compute occupancy (stub) – in future increment counts when a connector path uses channel cells.
 * @param {Array<object>} channelList
 */
export function initOccupancy(channelList) {
  const occ = {};
  channelList.forEach(c => { occ[c.id] = 0; });
  return occ;
}

/**
 * Mark channel usage (stub).
 * @param {object} occ
 * @param {string[]} channelIds
 */
export function incrementOccupancy(occ, channelIds = []) {
  channelIds.forEach(id => {
    if (occ[id] != null) occ[id] += 1;
  });
}

/**
 * Determine channels used by a path (stub). Future: geometric inclusion test.
 * @param {Array<[number,number]>} points
 * @param {Array<object>} channelList
 * @returns {string[]} channel ids
 */
export function inferChannelsForPath(points, channelList) {
  void points;
  return channelList.slice(0, 1).map(c => c.id); // Placeholder: first channel only if exists
}

/**
 * Debug render channels (stub).
 * @param {ShadowRoot} root
 * @param {Array<object>} channelList
 */
export function debugRenderChannels(root, channelList) {
  void root;
  void channelList;
  // TODO: Add semi-transparent overlay rectangles / polylines.
}

function attachGlobal() {
  window.cblcars = window.cblcars || {};
  window.cblcars.routing = window.cblcars.routing || {};
  const ns = window.cblcars.routing;
  if (!ns.channels) {
    ns.channels = {
      parseChannels,
      initOccupancy,
      incrementOccupancy,
      inferChannelsForPath,
      debugRenderChannels
    };
    cblcarsLog.info('[routing.channels] Attached channels module (scaffold)');
  }
}
attachGlobal();