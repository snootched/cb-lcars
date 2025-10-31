/**
 * AttachmentPointManager.js
 * Centralized management of overlay attachment points and anchors
 *
 * Consolidates:
 * - overlayAttachmentPoints (Map)
 * - textAttachmentPoints (Map)
 * - _dynamicAnchors (Object)
 *
 * Into a single, consistent API with clear semantics.
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * AttachmentPointManager
 *
 * Manages attachment point data for all overlays with a single source of truth.
 * Provides consistent API for reading/writing attachment points and anchors.
 *
 * Terminology:
 * - Attachment Points: Full data structure with bbox, center, and 8-direction points
 * - Anchor: Single [x, y] coordinate for a specific side (derived from attachment points)
 */
export class AttachmentPointManager {
  constructor() {
    /**
     * Primary storage for attachment point data
     * Key: overlay ID
     * Value: {
     *   id: string,
     *   center: [x, y],
     *   bbox: { left, right, top, bottom, width, height },
     *   points: {
     *     center: [x, y],
     *     top: [x, y],
     *     bottom: [x, y],
     *     left: [x, y],
     *     right: [x, y],
     *     topLeft: [x, y],
     *     topRight: [x, y],
     *     bottomLeft: [x, y],
     *     bottomRight: [x, y]
     *   }
     * }
     */
    this._attachmentPoints = new Map();

    /**
     * Virtual anchor storage for line attachment
     * Key: anchor ID (e.g., "title_overlay.right" or static anchor name)
     * Value: [x, y] coordinate
     */
    this._anchors = new Map();

    cblcarsLog.debug('[AttachmentPointManager] Initialized');
  }

  /**
   * Set attachment points for an overlay
   * @param {string} overlayId - Overlay ID
   * @param {Object} attachmentData - Attachment point data structure
   */
  setAttachmentPoints(overlayId, attachmentData) {
    if (!overlayId || !attachmentData) {
      cblcarsLog.warn('[AttachmentPointManager] Invalid setAttachmentPoints call', { overlayId, attachmentData });
      return;
    }

    this._attachmentPoints.set(overlayId, attachmentData);

    // Also create virtual anchors for each side
    // BUT: don't overwrite explicitly-set anchors (e.g., gap-adjusted ones from _buildDynamicOverlayAnchors)
    if (attachmentData.points) {
      Object.entries(attachmentData.points).forEach(([side, point]) => {
        const virtualAnchorId = `${overlayId}.${side}`;

        // Only set if not already explicitly set (preserves gap-adjusted anchors)
        if (!this._anchors.has(virtualAnchorId)) {
          cblcarsLog.trace(`[AttachmentPointManager] 📝 Setting base anchor ${virtualAnchorId}: [${point}]`);
          this._anchors.set(virtualAnchorId, point);
        } else {
          cblcarsLog.trace(`[AttachmentPointManager] ⏭️  Skipping ${virtualAnchorId} (already exists with gap)`);
        }
      });

      // Default anchor is the center (safe to always update)
      this._anchors.set(overlayId, attachmentData.center);
    }

    cblcarsLog.debug(`[AttachmentPointManager] Set attachment points for ${overlayId}`, {
      hasBbox: !!attachmentData.bbox,
      hasPoints: !!attachmentData.points,
      center: attachmentData.center
    });
  }

  /**
   * Get attachment points for an overlay
   * @param {string} overlayId - Overlay ID
   * @returns {Object|null} Attachment point data or null if not found
   */
  getAttachmentPoints(overlayId) {
    return this._attachmentPoints.get(overlayId) || null;
  }

  /**
   * Check if attachment points exist for an overlay
   * @param {string} overlayId - Overlay ID
   * @returns {boolean}
   */
  hasAttachmentPoints(overlayId) {
    return this._attachmentPoints.has(overlayId);
  }

  /**
   * Get a specific attachment point side for an overlay
   * @param {string} overlayId - Overlay ID
   * @param {string} side - Side name (center, top, bottom, left, right, topLeft, topRight, bottomLeft, bottomRight)
   * @returns {Array|null} [x, y] coordinate or null if not found
   */
  getAttachmentPoint(overlayId, side = 'center') {
    const data = this._attachmentPoints.get(overlayId);
    if (!data || !data.points) return null;
    return data.points[side] || null;
  }

  /**
   * Set a virtual anchor (for line attachment)
   * @param {string} anchorId - Anchor ID (e.g., "title_overlay.right" or static anchor)
   * @param {Array} coordinate - [x, y] coordinate
   */
  setAnchor(anchorId, coordinate) {
    if (!anchorId || !Array.isArray(coordinate) || coordinate.length !== 2) {
      cblcarsLog.warn('[AttachmentPointManager] Invalid setAnchor call', { anchorId, coordinate });
      return;
    }

    const existing = this._anchors.get(anchorId);
    if (existing && anchorId.includes('title_overlay.right')) {
      // Log stack trace for title_overlay.right overwrites
      cblcarsLog.trace(`[AttachmentPointManager] ⚠️  Overwriting anchor ${anchorId}: [${existing}] → [${coordinate}]`);
    } else if (existing) {
      cblcarsLog.trace(`[AttachmentPointManager] ⚠️  Overwriting anchor ${anchorId}: [${existing}] → [${coordinate}]`);
    }

    this._anchors.set(anchorId, coordinate);
  }

  /**
   * Get a virtual anchor coordinate
   * @param {string} anchorId - Anchor ID
   * @returns {Array|null} [x, y] coordinate or null if not found
   */
  getAnchor(anchorId) {
    return this._anchors.get(anchorId) || null;
  }

  /**
   * Check if anchor exists
   * @param {string} anchorId - Anchor ID
   * @returns {boolean}
   */
  hasAnchor(anchorId) {
    return this._anchors.has(anchorId);
  }

  /**
   * Get all anchors as an object (for compatibility with RouterCore)
   * @returns {Object} Object with anchor IDs as keys, [x, y] as values
   */
  getAllAnchorsAsObject() {
    const obj = {};
    this._anchors.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  /**
   * Set multiple anchors from an object (for compatibility with static anchors)
   * @param {Object} anchorsObject - Object with anchor IDs as keys, [x, y] as values
   */
  setAnchorsFromObject(anchorsObject) {
    if (!anchorsObject || typeof anchorsObject !== 'object') {
      cblcarsLog.warn('[AttachmentPointManager] Invalid setAnchorsFromObject call', anchorsObject);
      return;
    }

    Object.entries(anchorsObject).forEach(([id, coord]) => {
      if (Array.isArray(coord) && coord.length === 2) {
        this._anchors.set(id, coord);
      }
    });
  }

  /**
   * Remove attachment points for an overlay
   * @param {string} overlayId - Overlay ID
   */
  removeAttachmentPoints(overlayId) {
    this._attachmentPoints.delete(overlayId);

    // Also remove associated virtual anchors
    const toRemove = [];
    this._anchors.forEach((_, key) => {
      if (key === overlayId || key.startsWith(`${overlayId}.`)) {
        toRemove.push(key);
      }
    });
    toRemove.forEach(key => this._anchors.delete(key));

    cblcarsLog.trace(`[AttachmentPointManager] Removed attachment points for ${overlayId}`);
  }

  /**
   * Clear all attachment points and anchors
   */
  clear() {
    this._attachmentPoints.clear();
    this._anchors.clear();
    cblcarsLog.debug('[AttachmentPointManager] Cleared all attachment points and anchors');
  }

  /**
   * Get statistics for debugging
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      attachmentPointCount: this._attachmentPoints.size,
      anchorCount: this._anchors.size,
      overlayIds: Array.from(this._attachmentPoints.keys())
    };
  }

  /**
   * Debug dump of all data
   * @returns {Object} All data for debugging
   */
  debugDump() {
    const attachmentPoints = {};
    this._attachmentPoints.forEach((value, key) => {
      attachmentPoints[key] = value;
    });

    const anchors = {};
    this._anchors.forEach((value, key) => {
      anchors[key] = value;
    });

    return {
      attachmentPoints,
      anchors,
      stats: this.getStats()
    };
  }
}
