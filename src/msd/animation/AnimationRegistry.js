import { perfTime, perfTimeAsync, perfCount } from '../util/performance.js';
import { computeObjectHash } from '../util/hashing.js';

/**
 * Animation Registry for efficient animation reuse
 * Provides semantic comparison and intelligent caching
 */
export class AnimationRegistry {
  constructor() {
    this.cache = new Map(); // hash -> instance
    this.instanceToHash = new WeakMap(); // instance -> hash
    this.usageStats = new Map(); // hash -> { count, lastUsed }
    this.maxCacheSize = 500;
    this.cleanupThreshold = 600;

    // Performance tracking
    this.perfStats = {
      cacheHits: 0,
      cacheMisses: 0,
      instancesCreated: 0,
      instancesReused: 0,
      cleanupRuns: 0
    };
  }

  /**
   * Get or create animation instance with intelligent reuse
   */
  getOrCreateInstance(definition, targets) {
    return perfTime('animation.getInstance', () => {
      const hash = this.computeInstanceHash(definition);

      // Check cache first
      if (this.cache.has(hash)) {
        const cached = this.cache.get(hash);

        // Verify targets compatibility
        if (this.targetsCompatible(cached.targets, targets)) {
          this.recordCacheHit(hash);
          perfCount('animation.instance.reuse', 1);
          this.perfStats.instancesReused++;

          return this.reuseInstance(cached, targets);
        } else {
          // Targets incompatible, remove from cache
          this.cache.delete(hash);
          this.perfStats.cacheMisses++;
        }
      }

      // Create new instance
      const instance = this.createAnimationInstance(definition, targets);

      // Cache the instance
      this.cacheInstance(hash, instance, definition);

      perfCount('animation.instance.new', 1);
      this.perfStats.instancesCreated++;
      this.perfStats.cacheMisses++;

      return instance;
    });
  }

  /**
   * Compute semantic hash for animation definition
   */
  computeInstanceHash(definition) {
    // Extract only semantic properties (exclude DOM references)
    const semantic = {
      preset: definition.preset,
      params: this.normalizeParams(definition.params),
      duration: this.normalizeNumber(definition.duration),
      easing: definition.easing,
      loop: definition.loop,
      alternate: definition.alternate,
      delay: this.normalizeNumber(definition.delay),
      // Exclude: targets, callbacks, DOM-specific properties
    };

    // Handle animation_ref and overrides
    if (definition.animation_ref) {
      semantic.animation_ref = definition.animation_ref;
      if (definition.override) {
        semantic.override = this.normalizeParams(definition.override.params);
      }
    }

    return computeObjectHash(semantic);
  }

  /**
   * Normalize a single number to prevent precision churn
   */
  normalizeNumber(value) {
    if (typeof value === 'number') {
      return Math.round(value * 1000) / 1000;
    }
    return value;
  }

  /**
   * Normalize parameters to reduce hash churn from floating point precision
   */
  normalizeParams(params) {
    if (!params || typeof params !== 'object') return params;

    const normalized = {};
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === 'number') {
        // Round to 3 decimal places to prevent hash churn
        normalized[key] = Math.round(value * 1000) / 1000;
      } else if (Array.isArray(value)) {
        normalized[key] = value.map(v =>
          typeof v === 'number' ? Math.round(v * 1000) / 1000 : v
        );
      } else if (typeof value === 'object' && value !== null) {
        normalized[key] = this.normalizeParams(value);
      } else {
        normalized[key] = value;
      }
    });

    return normalized;
  }

  /**
   * Check if animation targets are compatible for reuse
   */
  targetsCompatible(cachedTargets, newTargets) {
    if (!cachedTargets || !newTargets) return false;

    // Convert to arrays for comparison
    const cached = Array.isArray(cachedTargets) ? cachedTargets : [cachedTargets];
    const newOnes = Array.isArray(newTargets) ? newTargets : [newTargets];

    if (cached.length !== newOnes.length) return false;

    // For DOM elements, compare by id or selector
    for (let i = 0; i < cached.length; i++) {
      const cachedTarget = cached[i];
      const newTarget = newOnes[i];

      // String selectors must match exactly
      if (typeof cachedTarget === 'string' && typeof newTarget === 'string') {
        if (cachedTarget !== newTarget) return false;
        continue;
      }

      // DOM elements - compare by id or position in DOM
      if (cachedTarget?.id && newTarget?.id) {
        if (cachedTarget.id !== newTarget.id) return false;
        continue;
      }

      // If we can't determine compatibility, assume incompatible
      return false;
    }

    return true;
  }

  /**
   * Create new animation instance using the runtime animation system
   */
  createAnimationInstance(definition, targets) {
    try {
      // Use the global animation system if available
      if (typeof window !== 'undefined' && window.cblcars?.anim?.create) {
        return window.cblcars.anim.create(definition, targets);
      }

      // Fallback mock for testing
      return {
        definition: { ...definition },
        targets: Array.isArray(targets) ? [...targets] : [targets],
        id: `anim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        play: () => {},
        pause: () => {},
        stop: () => {},
        restart: () => {}
      };
    } catch (error) {
      console.warn('[AnimationRegistry] Failed to create animation instance:', error);
      return null;
    }
  }

  /**
   * Reuse existing animation instance with new targets
   */
  reuseInstance(cachedInstance, newTargets) {
    try {
      // If the animation system supports retargeting, use it
      if (cachedInstance.retarget && typeof cachedInstance.retarget === 'function') {
        return cachedInstance.retarget(newTargets);
      }

      // Otherwise, create a shallow copy with new targets
      return {
        ...cachedInstance,
        targets: Array.isArray(newTargets) ? [...newTargets] : [newTargets],
        id: `${cachedInstance.id}_reused_${Date.now()}`
      };
    } catch (error) {
      console.warn('[AnimationRegistry] Failed to reuse animation instance:', error);
      return this.createAnimationInstance(cachedInstance.definition, newTargets);
    }
  }

  /**
   * Cache animation instance with metadata
   */
  cacheInstance(hash, instance, definition) {
    // Store in cache
    this.cache.set(hash, {
      instance,
      definition,
      targets: instance.targets,
      createdAt: Date.now(),
      hash
    });

    // Track usage
    this.usageStats.set(hash, {
      count: 1,
      lastUsed: Date.now(),
      hash
    });

    // Map instance back to hash for debugging
    this.instanceToHash.set(instance, hash);

    // Clean cache if needed AFTER adding the new item
    if (this.cache.size > this.maxCacheSize) {
      this.cleanupCache();
    }
  }

  /**
   * Record cache hit and update usage statistics
   */
  recordCacheHit(hash) {
    const usage = this.usageStats.get(hash);
    if (usage) {
      usage.count++;
      usage.lastUsed = Date.now();
    }

    this.perfStats.cacheHits++;
  }

  /**
   * Clean up least recently used cache entries
   */
  cleanupCache() {
    perfTime('animation.cache.cleanup', () => {
      const entries = Array.from(this.usageStats.entries());

      // Sort by last used time (oldest first)
      entries.sort(([, a], [, b]) => a.lastUsed - b.lastUsed);

      // Remove oldest entries until we're under max size
      const toRemove = entries.slice(0, entries.length - this.maxCacheSize);

      toRemove.forEach(([hash]) => {
        this.cache.delete(hash);
        this.usageStats.delete(hash);
      });

      this.perfStats.cleanupRuns++;
      perfCount('animation.cache.cleanup', toRemove.length);
    });
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const stats = { ...this.perfStats };

    stats.cacheSize = this.cache.size;
    stats.hitRate = stats.cacheHits / (stats.cacheHits + stats.cacheMisses) || 0;
    stats.reuseRate = stats.instancesReused / (stats.instancesReused + stats.instancesCreated) || 0;

    return stats;
  }

  /**
   * Get cache contents for debugging
   */
  getCacheContents() {
    const contents = {};

    this.cache.forEach((cached, hash) => {
      const usage = this.usageStats.get(hash);
      contents[hash] = {
        definition: cached.definition,
        createdAt: cached.createdAt,
        usage: usage ? { count: usage.count, lastUsed: usage.lastUsed } : null
      };
    });

    return contents;
  }

  /**
   * Clear cache and reset statistics
   */
  clear() {
    this.cache.clear();
    this.usageStats.clear();
    this.perfStats = {
      cacheHits: 0,
      cacheMisses: 0,
      instancesCreated: 0,
      instancesReused: 0,
      cleanupRuns: 0
    };

    perfCount('animation.cache.cleared', 1);
  }

  /**
   * Export cache statistics for analysis
   */
  exportStats(options = {}) {
    const stats = this.getStats();

    if (options.includeCache) {
      stats.cacheContents = this.getCacheContents();
    }

    if (options.format === 'csv') {
      return this.exportToCsv(stats);
    }

    return JSON.stringify(stats, null, 2);
  }

  exportToCsv(stats) {
    const rows = [
      'metric,value',
      `cacheHits,${stats.cacheHits}`,
      `cacheMisses,${stats.cacheMisses}`,
      `instancesCreated,${stats.instancesCreated}`,
      `instancesReused,${stats.instancesReused}`,
      `cacheSize,${stats.cacheSize}`,
      `hitRate,${stats.hitRate.toFixed(3)}`,
      `reuseRate,${stats.reuseRate.toFixed(3)}`,
      `cleanupRuns,${stats.cleanupRuns}`
    ];

    return rows.join('\n');
  }
}

// Create global registry instance
const globalAnimationRegistry = new AnimationRegistry();

// Debug exposure
const debugNamespace = (typeof window !== 'undefined') ? window : global;
if (debugNamespace) {
  debugNamespace.__msdAnimRegistry = {
    registry: globalAnimationRegistry,
    getStats: () => globalAnimationRegistry.getStats(),
    getCacheContents: () => globalAnimationRegistry.getCacheContents(),
    clear: () => globalAnimationRegistry.clear(),
    export: (options) => globalAnimationRegistry.exportStats(options)
  };
}

export { globalAnimationRegistry };
