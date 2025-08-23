import { perfTime, perfCount } from '../util/performance.js';

/**
 * Centralized value_map resolver for dynamic style properties
 * Handles entity state mapping to CSS values with caching
 */
export class ValueMapResolver {
  constructor() {
    this.cache = new Map(); // entity+mapping -> cached result
    this.cacheTimestamps = new Map(); // entity -> last update time
    this.cacheTtl = 100; // Cache TTL in ms

    // Performance tracking
    this.perfStats = {
      resolutions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      entityMisses: 0
    };
  }

  /**
   * Resolve all value_map references in overlay styles
   */
  resolveOverlayValueMaps(overlays, entityResolver) {
    return perfTime('valuemap.resolve.overlays', () => {
      const resolved = overlays.map(overlay => {
        const resolvedOverlay = { ...overlay };

        if (overlay.style) {
          resolvedOverlay.style = this.resolveStyleValueMaps(overlay.style, entityResolver);
        }

        return resolvedOverlay;
      });

      perfCount('valuemap.overlays.processed', overlays.length);
      return resolved;
    });
  }

  /**
   * Resolve value_map references in a style object
   */
  resolveStyleValueMaps(style, entityResolver) {
    const resolved = {};

    Object.entries(style).forEach(([property, value]) => {
      if (this.hasValueMap(value)) {
        resolved[property] = this.resolveValueMap(value, entityResolver);
        this.perfStats.resolutions++;
        perfCount('valuemap.resolutions', 1);
      } else {
        resolved[property] = value;
      }
    });

    return resolved;
  }

  /**
   * Check if a value contains a value_map definition
   */
  hasValueMap(value) {
    return value &&
           typeof value === 'object' &&
           value.value_map &&
           typeof value.value_map === 'object';
  }

  /**
   * Resolve a single value_map definition
   */
  resolveValueMap(valueMapDef, entityResolver) {
    return perfTime('valuemap.resolve.single', () => {
      const { value_map } = valueMapDef;
      const { entity, attribute, input, output, clamp = false, round, default: defaultValue } = value_map;

      // Build cache key
      const cacheKey = this.buildCacheKey(entity, value_map);

      // Check cache first
      const cached = this.getCachedResult(entity, cacheKey);
      if (cached !== null) {
        this.perfStats.cacheHits++;
        perfCount('valuemap.cache.hits', 1);
        return cached;
      }

      // Get entity value
      const entityObj = entityResolver(entity);
      if (!entityObj) {
        this.perfStats.entityMisses++;
        perfCount('valuemap.entity.missing', 1);
        return this.handleMissingEntity(valueMapDef, defaultValue);
      }

      // Extract value from entity
      const rawValue = this.extractEntityValue(entityObj, attribute);
      if (rawValue === null || rawValue === undefined) {
        return this.handleMissingValue(valueMapDef, defaultValue);
      }

      // Convert to number for mapping
      const numericValue = this.parseNumericValue(rawValue);
      if (isNaN(numericValue)) {
        return this.handleInvalidValue(valueMapDef, defaultValue, rawValue);
      }

      // Perform range mapping
      const mappedValue = this.mapRange(numericValue, input, output, clamp, round);

      // Cache the result
      this.setCachedResult(entity, cacheKey, mappedValue);

      this.perfStats.cacheMisses++;
      perfCount('valuemap.cache.misses', 1);

      return mappedValue;
    });
  }

  /**
   * Extract value from entity object
   */
  extractEntityValue(entity, attribute) {
    if (!attribute) {
      return entity.state;
    }

    // Handle dot notation for nested attributes
    const parts = attribute.split('.');
    let current = entity;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * Parse string/number to numeric value
   */
  parseNumericValue(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Handle common numeric formats
      const cleaned = value.replace(/[^\d.-]/g, ''); // Remove non-numeric chars except . and -
      return parseFloat(cleaned);
    }
    return NaN;
  }

  /**
   * Map value from input range to output range
   */
  mapRange(value, inputRange, outputRange, clamp = false, round) {
    const [inMin, inMax] = inputRange;
    const [outMin, outMax] = outputRange;

    // Handle edge cases
    if (inMin === inMax) {
      return outMin;
    }

    // Clamp input value if requested
    let mappedInput = value;
    if (clamp) {
      mappedInput = Math.max(inMin, Math.min(inMax, value));
    }

    // Linear interpolation
    const ratio = (mappedInput - inMin) / (inMax - inMin);
    let result = outMin + ratio * (outMax - outMin);

    // Apply rounding if specified
    if (typeof round === 'number') {
      const factor = Math.pow(10, round);
      result = Math.round(result * factor) / factor;
    }

    return result;
  }

  /**
   * Build cache key for value_map result
   */
  buildCacheKey(entity, valueMap) {
    const keyParts = [
      entity,
      valueMap.attribute || 'state',
      JSON.stringify(valueMap.input),
      JSON.stringify(valueMap.output),
      valueMap.clamp || false,
      valueMap.round || 'none'
    ];

    return keyParts.join('|');
  }

  /**
   * Get cached result if still valid
   */
  getCachedResult(entity, cacheKey) {
    const now = Date.now();
    const entityTimestamp = this.cacheTimestamps.get(entity) || 0;

    // Check if cache is still valid
    if (now - entityTimestamp < this.cacheTtl && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    return null;
  }

  /**
   * Cache resolved result
   */
  setCachedResult(entity, cacheKey, result) {
    this.cache.set(cacheKey, result);
    this.cacheTimestamps.set(entity, Date.now());
  }

  /**
   * Handle missing entity
   */
  handleMissingEntity(valueMapDef, defaultValue) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }

    // Return first output value as fallback
    if (valueMapDef.value_map?.output && Array.isArray(valueMapDef.value_map.output)) {
      return valueMapDef.value_map.output[0];
    }

    return 0;
  }

  /**
   * Handle missing attribute value
   */
  handleMissingValue(valueMapDef, defaultValue) {
    return this.handleMissingEntity(valueMapDef, defaultValue);
  }

  /**
   * Handle invalid (non-numeric) value
   */
  handleInvalidValue(valueMapDef, defaultValue, rawValue) {
    console.warn(`[ValueMapResolver] Invalid numeric value for entity: ${rawValue}`);
    return this.handleMissingEntity(valueMapDef, defaultValue);
  }

  /**
   * Invalidate cache for specific entity
   */
  invalidateEntity(entityId) {
    const now = Date.now();

    // Remove all cached results for this entity
    for (const [cacheKey, _] of this.cache) {
      if (cacheKey.startsWith(`${entityId}|`)) {
        this.cache.delete(cacheKey);
      }
    }

    // Update timestamp to invalidate future lookups
    this.cacheTimestamps.set(entityId, now + this.cacheTtl + 1);

    perfCount('valuemap.cache.invalidated', 1);
  }

  /**
   * Clear all cached results
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();

    perfCount('valuemap.cache.cleared', 1);
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      ...this.perfStats,
      cacheSize: this.cache.size,
      hitRate: this.perfStats.cacheHits / (this.perfStats.cacheHits + this.perfStats.cacheMisses) || 0,
      entityCacheCount: this.cacheTimestamps.size
    };
  }

  /**
   * Export resolver statistics for debugging
   */
  exportStats(options = {}) {
    const stats = this.getStats();

    if (options.includeCache) {
      stats.cacheContents = Object.fromEntries(this.cache);
      stats.cacheTimestamps = Object.fromEntries(this.cacheTimestamps);
    }

    return options.format === 'json' ?
      JSON.stringify(stats, null, 2) :
      stats;
  }
}

// Global resolver instance
const globalValueMapResolver = new ValueMapResolver();

// Debug exposure
const debugNamespace = (typeof window !== 'undefined') ? window : global;
if (debugNamespace) {
  debugNamespace.__msdValueMap = {
    resolver: globalValueMapResolver,
    getStats: () => globalValueMapResolver.getStats(),
    clearCache: () => globalValueMapResolver.clearCache(),
    invalidateEntity: (entityId) => globalValueMapResolver.invalidateEntity(entityId),
    export: (options) => globalValueMapResolver.exportStats(options)
  };
}

export { globalValueMapResolver };
