import { perfTime, perfCount } from '../util/performance.js';

/**
 * Profile system for layered style resolution
 * Handles active_profiles precedence and profile-specific overrides
 */
export class ProfileResolver {
  constructor() {
    this.profileIndex = new Map(); // profileId -> profile data
    this.activeProfiles = [];
    this.styleCache = new Map(); // overlayId -> cached merged style
    this.lastActiveProfiles = null; // For cache invalidation

    // Performance tracking
    this.perfStats = {
      profileLoads: 0,
      styleMerges: 0,
      cacheHits: 0,
      cacheMisses: 0,
      invalidations: 0
    };
  }

  /**
   * Load profiles into the resolver index
   */
  loadProfiles(profiles) {
    perfTime('profile.load', () => {
      this.profileIndex.clear();

      profiles.forEach(profile => {
        if (profile.id) {
          this.profileIndex.set(profile.id, profile);
          this.perfStats.profileLoads++;
        }
      });

      perfCount('profile.loaded', profiles.length);
    });
  }

  /**
   * Set active profiles and invalidate cache if changed
   */
  setActiveProfiles(activeProfiles) {
    const newActiveProfiles = Array.isArray(activeProfiles) ? activeProfiles : [];

    // Check if profiles changed
    const changed = JSON.stringify(this.activeProfiles) !== JSON.stringify(newActiveProfiles);

    if (changed) {
      this.activeProfiles = [...newActiveProfiles];
      this.invalidateStyleCache();
      perfCount('profile.active.changed', 1);
    }
  }

  /**
   * Resolve styles for all overlays with profile layering
   */
  resolveOverlayStyles(overlays) {
    return perfTime('profile.resolve.overlays', () => {
      const resolved = overlays.map(overlay => {
        const resolvedOverlay = { ...overlay };

        // Get merged style with profile layers
        resolvedOverlay.style = this.resolveOverlayStyle(overlay);

        return resolvedOverlay;
      });

      perfCount('profile.overlays.processed', overlays.length);
      return resolved;
    });
  }

  /**
   * Resolve style for a single overlay with profile layering
   */
  resolveOverlayStyle(overlay) {
    return perfTime('profile.resolve.single', () => {
      // Check cache first
      const cacheKey = this.buildStyleCacheKey(overlay);

      if (this.styleCache.has(cacheKey)) {
        this.perfStats.cacheHits++;
        perfCount('profile.cache.hits', 1);
        return this.styleCache.get(cacheKey);
      }

      // Build style layers
      const styleLayers = this.buildStyleLayers(overlay);

      // Merge layers with precedence
      const mergedStyle = this.mergeStyleLayers(styleLayers);

      // Cache the result
      this.styleCache.set(cacheKey, mergedStyle);
      this.perfStats.cacheMisses++;
      this.perfStats.styleMerges++;
      perfCount('profile.cache.misses', 1);

      return mergedStyle;
    });
  }

  /**
   * Build ordered style layers for an overlay
   */
  buildStyleLayers(overlay) {
    const layers = [];

    // Layer 1: Base overlay style (lowest precedence)
    if (overlay.style) {
      layers.push({
        source: 'overlay',
        sourceId: overlay.id,
        style: overlay.style,
        precedence: 100
      });
    }

    // Layer 2-N: Active profile styles (in order, later = higher precedence)
    this.activeProfiles.forEach((profileId, index) => {
      const profile = this.profileIndex.get(profileId);

      if (profile) {
        // Check for overlay-specific style in profile
        const overlayStyle = this.getProfileOverlayStyle(profile, overlay.id, overlay.type);

        if (overlayStyle) {
          layers.push({
            source: 'profile',
            sourceId: profileId,
            style: overlayStyle,
            precedence: 200 + index // Later profiles have higher precedence
          });
        }
      }
    });

    // Sort by precedence (lower numbers first, higher numbers override)
    return layers.sort((a, b) => a.precedence - b.precedence);
  }

  /**
   * Get profile style for a specific overlay
   */
  getProfileOverlayStyle(profile, overlayId, overlayType) {
    // Check for direct overlay ID match
    if (profile.overlays && profile.overlays[overlayId]) {
      return profile.overlays[overlayId];
    }

    // Check for type-based defaults
    if (profile.defaults && profile.defaults[overlayType]) {
      return profile.defaults[overlayType];
    }

    return null;
  }

  /**
   * Merge style layers with proper precedence
   */
  mergeStyleLayers(layers) {
    const merged = {};
    const provenance = {}; // Track which profile/source set each property

    layers.forEach(layer => {
      Object.entries(layer.style).forEach(([property, value]) => {
        // Later layers override earlier ones
        merged[property] = value;
        provenance[property] = {
          source: layer.source,
          sourceId: layer.sourceId,
          precedence: layer.precedence
        };
      });
    });

    // Attach provenance for debugging (non-enumerable)
    Object.defineProperty(merged, '__styleProvenance', {
      value: provenance,
      enumerable: false,
      writable: false
    });

    return merged;
  }

  /**
   * Build cache key for overlay style
   */
  buildStyleCacheKey(overlay) {
    const keyParts = [
      overlay.id,
      overlay.type || 'unknown',
      this.getOverlayStyleHash(overlay.style),
      this.activeProfiles.join(',')
    ];

    return keyParts.join('|');
  }

  /**
   * Get simple hash of overlay style for cache key
   */
  getOverlayStyleHash(style) {
    if (!style || typeof style !== 'object') return 'empty';

    // Simple hash based on stringified style
    return JSON.stringify(style).length.toString(36);
  }

  /**
   * Invalidate style cache
   */
  invalidateStyleCache() {
    this.styleCache.clear();
    this.perfStats.invalidations++;
    perfCount('profile.cache.invalidated', 1);
  }

  /**
   * Get profile by ID
   */
  getProfile(profileId) {
    return this.profileIndex.get(profileId);
  }

  /**
   * Get all active profiles
   */
  getActiveProfiles() {
    return [...this.activeProfiles];
  }

  /**
   * Get available profile IDs
   */
  getAvailableProfiles() {
    return Array.from(this.profileIndex.keys());
  }

  /**
   * Check if a profile is active
   */
  isProfileActive(profileId) {
    return this.activeProfiles.includes(profileId);
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      ...this.perfStats,
      profileCount: this.profileIndex.size,
      activeProfileCount: this.activeProfiles.length,
      cacheSize: this.styleCache.size,
      hitRate: this.perfStats.cacheHits / (this.perfStats.cacheHits + this.perfStats.cacheMisses) || 0
    };
  }

  /**
   * Get detailed profile information for debugging
   */
  getDebugInfo() {
    const info = {
      availableProfiles: {},
      activeProfiles: this.activeProfiles,
      cacheSize: this.styleCache.size,
      stats: this.getStats()
    };

    // Add profile details
    this.profileIndex.forEach((profile, profileId) => {
      info.availableProfiles[profileId] = {
        hasDefaults: !!(profile.defaults && Object.keys(profile.defaults).length > 0),
        hasOverlays: !!(profile.overlays && Object.keys(profile.overlays).length > 0),
        defaultTypes: profile.defaults ? Object.keys(profile.defaults) : [],
        overlayIds: profile.overlays ? Object.keys(profile.overlays) : []
      };
    });

    return info;
  }

  /**
   * Export resolver statistics for debugging
   */
  exportStats(options = {}) {
    const stats = this.getStats();

    if (options.includeDebug) {
      stats.debug = this.getDebugInfo();
    }

    return options.format === 'json' ?
      JSON.stringify(stats, null, 2) :
      stats;
  }
}

// Global resolver instance
const globalProfileResolver = new ProfileResolver();

// Debug exposure
const debugNamespace = (typeof window !== 'undefined') ? window : global;
if (debugNamespace) {
  debugNamespace.__msdProfile = {
    resolver: globalProfileResolver,
    getStats: () => globalProfileResolver.getStats(),
    getDebugInfo: () => globalProfileResolver.getDebugInfo(),
    getActiveProfiles: () => globalProfileResolver.getActiveProfiles(),
    getAvailableProfiles: () => globalProfileResolver.getAvailableProfiles(),
    export: (options) => globalProfileResolver.exportStats(options)
  };
}

export { globalProfileResolver };
