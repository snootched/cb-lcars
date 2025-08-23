import { perfTime, perfCount } from '../util/performance.js';
import { computeObjectHash } from '../util/hashing.js';

/**
 * Routing cache with intelligent invalidation
 * Optimizes path computation for repeated anchor/overlay configurations
 */
export class RoutingCache {
  constructor() {
    this.cache = new Map(); // cacheKey -> { path, metadata }
    this.dependencies = new Map(); // cacheKey -> Set of dependency identifiers
    this.anchorsVersion = 0;
    this.overlaysVersion = 0;
    this.routingConfigVersion = 0;

    // Performance tracking
    this.perfStats = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      computations: 0,
      cacheSize: 0
    };
  }

  /**
   * Get cached path or compute new one
   */
  getPath(request, computeFn) {
    return perfTime('routing.cache.get', () => {
      const cacheKey = this.buildCacheKey(request);

      // Check cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);

        // Verify dependencies still valid
        if (this.isDependencyValid(cacheKey, cached)) {
          this.perfStats.hits++;
          perfCount('routing.cache.hits', 1);
          return cached.path;
        } else {
          // Remove invalid entry
          this.cache.delete(cacheKey);
          this.dependencies.delete(cacheKey);
        }
      }

      // Cache miss - compute new path
      this.perfStats.misses++;
      perfCount('routing.cache.misses', 1);

      const path = computeFn();

      // Cache the result with dependencies
      this.cacheResult(cacheKey, path, request);

      this.perfStats.computations++;
      return path;
    });
  }

  /**
   * Build cache key from routing request
   */
  buildCacheKey(request) {
    const keyData = {
      from: this.normalizePoint(request.from),
      to: this.normalizePoint(request.to),
      mode: request.mode || 'manhattan',
      config: {
        clearance: request.clearance,
        grid_resolution: request.grid_resolution,
        cost_defaults: request.cost_defaults
      },
      // Include version numbers to auto-invalidate
      anchorsVersion: this.anchorsVersion,
      routingConfigVersion: this.routingConfigVersion
    };

    return computeObjectHash(keyData);
  }

  /**
   * Normalize point reference for consistent caching
   */
  normalizePoint(point) {
    if (Array.isArray(point)) {
      return point.map(coord => typeof coord === 'number' ? Math.round(coord * 1000) / 1000 : coord);
    }
    return point; // Anchor ID
  }

  /**
   * Cache computed result with dependency tracking
   */
  cacheResult(cacheKey, path, request) {
    const cached = {
      path,
      timestamp: Date.now(),
      request,
      versions: {
        anchors: this.anchorsVersion,
        overlays: this.overlaysVersion,
        routing: this.routingConfigVersion
      }
    };

    this.cache.set(cacheKey, cached);

    // Track dependencies
    const deps = new Set();

    // Add anchor dependencies
    if (typeof request.from === 'string') deps.add(`anchor:${request.from}`);
    if (typeof request.to === 'string') deps.add(`anchor:${request.to}`);

    // Add routing config dependency
    deps.add('routing:config');

    this.dependencies.set(cacheKey, deps);

    this.perfStats.cacheSize = this.cache.size;
    perfCount('routing.cache.stored', 1);
  }

  /**
   * Check if cached entry dependencies are still valid
   */
  isDependencyValid(cacheKey, cached) {
    // Check version numbers
    if (cached.versions.anchors !== this.anchorsVersion) return false;
    if (cached.versions.routing !== this.routingConfigVersion) return false;

    // Additional dependency checks could go here
    return true;
  }

  /**
   * Invalidate cache entries based on change type
   */
  invalidate(changeType, details = {}) {
    perfTime('routing.cache.invalidate', () => {
      let invalidatedCount = 0;

      switch (changeType) {
        case 'anchors':
          this.anchorsVersion++;
          invalidatedCount = this.invalidateByDependency('anchor:', details.anchorIds);
          break;

        case 'routing_config':
          this.routingConfigVersion++;
          invalidatedCount = this.invalidateByDependency('routing:config');
          break;

        case 'overlays':
          this.overlaysVersion++;
          // Overlays don't directly affect routing paths, but may affect clearance
          break;

        case 'all':
          this.cache.clear();
          this.dependencies.clear();
          this.anchorsVersion++;
          this.overlaysVersion++;
          this.routingConfigVersion++;
          invalidatedCount = this.perfStats.cacheSize;
          break;
      }

      this.perfStats.invalidations += invalidatedCount;
      this.perfStats.cacheSize = this.cache.size;

      perfCount('routing.cache.invalidated', invalidatedCount);
    });
  }

  /**
   * Invalidate entries by dependency pattern
   */
  invalidateByDependency(pattern, specificIds = null) {
    let invalidatedCount = 0;

    for (const [cacheKey, deps] of this.dependencies) {
      let shouldInvalidate = false;

      if (specificIds && Array.isArray(specificIds)) {
        // Check specific IDs
        specificIds.forEach(id => {
          if (deps.has(`${pattern}${id}`)) {
            shouldInvalidate = true;
          }
        });
      } else {
        // Check pattern match
        for (const dep of deps) {
          if (dep.startsWith(pattern)) {
            shouldInvalidate = true;
            break;
          }
        }
      }

      if (shouldInvalidate) {
        this.cache.delete(cacheKey);
        this.dependencies.delete(cacheKey);
        invalidatedCount++;
      }
    }

    return invalidatedCount;
  }

  /**
   * Precompute common routes for better performance
   */
  precomputeCommonRoutes(commonRequests, computeFn) {
    perfTime('routing.cache.precompute', () => {
      commonRequests.forEach(request => {
        if (!this.cache.has(this.buildCacheKey(request))) {
          this.getPath(request, () => computeFn(request));
        }
      });

      perfCount('routing.cache.precomputed', commonRequests.length);
    });
  }

  /**
   * Clean up old cache entries
   */
  cleanup(maxAge = 300000) { // 5 minutes default
    perfTime('routing.cache.cleanup', () => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [cacheKey, cached] of this.cache) {
        if (now - cached.timestamp > maxAge) {
          this.cache.delete(cacheKey);
          this.dependencies.delete(cacheKey);
          cleanedCount++;
        }
      }

      this.perfStats.cacheSize = this.cache.size;
      perfCount('routing.cache.cleaned', cleanedCount);
    });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.perfStats.hits + this.perfStats.misses;

    return {
      ...this.perfStats,
      hitRate: totalRequests > 0 ? this.perfStats.hits / totalRequests : 0,
      avgDependenciesPerEntry: this.dependencies.size > 0 ?
        Array.from(this.dependencies.values()).reduce((sum, deps) => sum + deps.size, 0) / this.dependencies.size : 0,
      versions: {
        anchors: this.anchorsVersion,
        overlays: this.overlaysVersion,
        routing: this.routingConfigVersion
      }
    };
  }

  /**
   * Export cache contents for debugging
   */
  exportCache(options = {}) {
    const exported = {
      stats: this.getStats(),
      timestamp: Date.now()
    };

    if (options.includeEntries) {
      exported.entries = {};

      for (const [cacheKey, cached] of this.cache) {
        exported.entries[cacheKey] = {
          request: cached.request,
          timestamp: cached.timestamp,
          pathLength: cached.path?.length || 0,
          dependencies: Array.from(this.dependencies.get(cacheKey) || [])
        };
      }
    }

    if (options.includeDependencies) {
      exported.dependencies = Object.fromEntries(
        Array.from(this.dependencies).map(([key, deps]) => [key, Array.from(deps)])
      );
    }

    return options.format === 'json' ?
      JSON.stringify(exported, null, 2) :
      exported;
  }

  /**
   * Clear all cache and reset statistics
   */
  clear() {
    this.cache.clear();
    this.dependencies.clear();
    this.anchorsVersion = 0;
    this.overlaysVersion = 0;
    this.routingConfigVersion = 0;

    this.perfStats = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      computations: 0,
      cacheSize: 0
    };

    perfCount('routing.cache.cleared', 1);
  }
}

// Global routing cache instance
const globalRoutingCache = new RoutingCache();

// Debug exposure
const debugNamespace = (typeof window !== 'undefined') ? window : global;
if (debugNamespace) {
  debugNamespace.__msdRoutingCache = {
    cache: globalRoutingCache,
    getStats: () => globalRoutingCache.getStats(),
    exportCache: (options) => globalRoutingCache.exportCache(options),
    invalidate: (changeType, details) => globalRoutingCache.invalidate(changeType, details),
    clear: () => globalRoutingCache.clear()
  };
}

export { globalRoutingCache };
