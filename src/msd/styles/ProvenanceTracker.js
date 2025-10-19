/**
 * @fileoverview Provenance Tracker for Style Resolver Service
 *
 * Tracks style resolution provenance for debugging and analysis.
 * Integrates with Phase 5.2B provenance system.
 *
 * @module msd/styles/ProvenanceTracker
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Provenance Tracker for style resolution tracking
 *
 * Tracks the resolution path for each style property to enable
 * debugging and analysis of style sources.
 *
 * @class ProvenanceTracker
 */
export class ProvenanceTracker {
  constructor() {
    // Provenance storage by overlay ID
    this.provenance = new Map();

    // Token usage tracking
    this.tokenUsage = new Map();

    // Statistics
    this.stats = {
      tracked: 0,
      overlays: 0
    };
  }

  /**
   * Track a style resolution
   *
   * @param {Object} resolution - Resolution details
   * @returns {Object} Provenance entry
   */
  track(resolution) {
    this.stats.tracked++;

    const {
      property,
      explicitValue,
      tokenPath,
      tokenResolved,
      themeDefault,
      resolvedValue,
      source,
      componentType,
      context,
      resolutionTime,
      timestamp
    } = resolution;

    const provenance = {
      property,
      explicitValue,
      tokenPath,
      tokenResolved,
      themeDefault,
      resolvedValue,
      source,
      componentType,
      resolutionTime,
      timestamp
    };

    // Store by overlay ID if available
    if (context.overlayId) {
      if (!this.provenance.has(context.overlayId)) {
        this.provenance.set(context.overlayId, {
          overlayId: context.overlayId,
          overlayType: context.overlayType,
          properties: {}
        });
        this.stats.overlays++;
      }

      const overlayProv = this.provenance.get(context.overlayId);
      overlayProv.properties[property] = provenance;

      // Track token usage
      if (tokenResolved) {
        this._trackTokenUsage(tokenResolved, context.overlayId, property);
      }
    }

    return provenance;
  }

  /**
   * Get provenance for an overlay
   *
   * @param {string} overlayId - Overlay ID
   * @returns {Object|null} Provenance data
   */
  getProvenance(overlayId) {
    return this.provenance.get(overlayId) || null;
  }

  /**
   * Find properties using a specific token
   *
   * @param {string} tokenPath - Token path
   * @returns {Array} Array of { overlayId, property } objects
   */
  findPropertiesUsingToken(tokenPath) {
    const usage = this.tokenUsage.get(tokenPath);
    if (!usage) return [];

    const results = [];
    usage.forEach((properties, overlayId) => {
      properties.forEach(property => {
        results.push({ overlayId, property });
      });
    });

    return results;
  }

  /**
   * Get all tracked overlays
   *
   * @returns {Array<string>} Array of overlay IDs
   */
  getTrackedOverlays() {
    return Array.from(this.provenance.keys());
  }

  /**
   * Clear provenance data
   *
   * @param {string} overlayId - Specific overlay to clear (optional)
   */
  clear(overlayId = null) {
    if (overlayId) {
      this.provenance.delete(overlayId);

      // Clear token usage for this overlay
      this.tokenUsage.forEach((overlays, token) => {
        overlays.delete(overlayId);
        if (overlays.size === 0) {
          this.tokenUsage.delete(token);
        }
      });
    } else {
      this.provenance.clear();
      this.tokenUsage.clear();
      this.stats.overlays = 0;
    }
  }

  /**
   * Get provenance statistics
   *
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      tracked: this.stats.tracked,
      overlays: this.stats.overlays,
      tokensUsed: this.tokenUsage.size
    };
  }

  /**
   * Track token usage
   * @private
   */
  _trackTokenUsage(tokenPath, overlayId, property) {
    if (!this.tokenUsage.has(tokenPath)) {
      this.tokenUsage.set(tokenPath, new Map());
    }

    const overlays = this.tokenUsage.get(tokenPath);

    if (!overlays.has(overlayId)) {
      overlays.set(overlayId, new Set());
    }

    overlays.get(overlayId).add(property);
  }
}

export default ProvenanceTracker;