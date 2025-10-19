/**
 * @fileoverview Cache Manager for Style Resolver Service
 *
 * Provides intelligent caching with:
 * - Multiple cache namespaces (property, overlay, preset)
 * - LRU eviction strategy
 * - Cache statistics
 * - Partial cache invalidation
 *
 * @module msd/styles/CacheManager
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Cache Manager for style resolution caching
 *
 * Manages separate caches for different resolution types with
 * intelligent eviction and invalidation strategies.
 *
 * @class CacheManager
 */
export class CacheManager {
  /**
   * Create a CacheManager instance
   *
   * @param {Object} config - Cache configuration
   * @param {number} config.maxCacheSize - Maximum entries per cache (default: 1000)
   * @param {boolean} config.cacheEnabled - Enable/disable caching (default: true)
   */
  constructor(config = {}) {
    this.config = {
      maxCacheSize: 1000,
      cacheEnabled: true,
      ...config
    };

    // Separate caches for different types
    this.caches = {
      property: new Map(),    // Individual property resolutions
      overlay: new Map(),     // Complete overlay style resolutions
      preset: new Map()       // Preset definitions
    };

    // Access tracking for LRU eviction
    this.accessOrder = {
      property: [],
      overlay: [],
      preset: []
    };

    // Statistics
    this.stats = {
      property: { hits: 0, misses: 0, evictions: 0 },
      overlay: { hits: 0, misses: 0, evictions: 0 },
      preset: { hits: 0, misses: 0, evictions: 0 }
    };
  }

  /**
   * Get a cached value
   *
   * @param {string} type - Cache type ('property', 'overlay', 'preset')
   * @param {string} key - Cache key
   * @returns {*} Cached value or null if not found
   */
  get(type, key) {
    if (!this.config.cacheEnabled) return null;

    const cache = this.caches[type];
    if (!cache) {
      cblcarsLog.warn('[CacheManager] Unknown cache type:', type);
      return null;
    }

    if (cache.has(key)) {
      this.stats[type].hits++;
      this._recordAccess(type, key);
      return cache.get(key);
    }

    this.stats[type].misses++;
    return null;
  }

  /**
   * Set a cached value
   *
   * @param {string} type - Cache type
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(type, key, value) {
    if (!this.config.cacheEnabled) return;

    const cache = this.caches[type];
    if (!cache) {
      cblcarsLog.warn('[CacheManager] Unknown cache type:', type);
      return;
    }

    // Check if we need to evict
    if (cache.size >= this.config.maxCacheSize && !cache.has(key)) {
      this._evictLRU(type);
    }

    cache.set(key, value);
    this._recordAccess(type, key);
  }

  /**
   * Clear cache
   *
   * @param {string} type - Cache type to clear (optional, clears all if not specified)
   * @param {string} id - Specific ID to clear (optional)
   */
  clear(type = null, id = null) {
    if (type === null) {
      // Clear all caches
      Object.keys(this.caches).forEach(t => {
        this.caches[t].clear();
        this.accessOrder[t] = [];
      });
      cblcarsLog.debug('[CacheManager] All caches cleared');
    } else if (id === null) {
      // Clear entire cache type
      if (this.caches[type]) {
        this.caches[type].clear();
        this.accessOrder[type] = [];
        cblcarsLog.debug(`[CacheManager] Cache cleared: ${type}`);
      }
    } else {
      // Clear specific entry
      if (this.caches[type]) {
        // For specific ID, clear all keys that contain the ID
        const keysToDelete = [];
        for (const key of this.caches[type].keys()) {
          if (key.includes(id)) {
            keysToDelete.push(key);
          }
        }

        keysToDelete.forEach(key => {
          this.caches[type].delete(key);
          this._removeFromAccessOrder(type, key);
        });

        if (keysToDelete.length > 0) {
          cblcarsLog.debug(`[CacheManager] Cleared ${keysToDelete.length} entries for ${type}:${id}`);
        }
      }
    }
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache statistics
   */
  getStats() {
    const stats = {};

    Object.keys(this.caches).forEach(type => {
      const cache = this.caches[type];
      const typeStats = this.stats[type];
      const total = typeStats.hits + typeStats.misses;

      stats[type] = {
        count: cache.size,
        hits: typeStats.hits,
        misses: typeStats.misses,
        evictions: typeStats.evictions,
        hitRate: total > 0 ? ((typeStats.hits / total) * 100).toFixed(1) + '%' : '0%'
      };
    });

    return stats;
  }

  /**
   * Record cache access for LRU tracking
   * @private
   */
  _recordAccess(type, key) {
    const order = this.accessOrder[type];

    // Remove if already in order
    const index = order.indexOf(key);
    if (index > -1) {
      order.splice(index, 1);
    }

    // Add to end (most recently used)
    order.push(key);
  }

  /**
   * Remove key from access order
   * @private
   */
  _removeFromAccessOrder(type, key) {
    const order = this.accessOrder[type];
    const index = order.indexOf(key);
    if (index > -1) {
      order.splice(index, 1);
    }
  }

  /**
   * Evict least recently used entry
   * @private
   */
  _evictLRU(type) {
    const order = this.accessOrder[type];
    const cache = this.caches[type];

    if (order.length === 0) return;

    // Get least recently used key (first in array)
    const lruKey = order.shift();
    cache.delete(lruKey);
    this.stats[type].evictions++;

    cblcarsLog.debug(`[CacheManager] LRU eviction: ${type}:${lruKey}`);
  }
}

export default CacheManager;