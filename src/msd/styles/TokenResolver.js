/**
 * @fileoverview Token Resolver for Style Resolver Service
 *
 * Resolves token references to actual values from theme system.
 * Supports:
 * - Simple tokens (colors.primary)
 * - Nested tokens (colors.ui.primary)
 * - Token references in tokens
 * - Context-aware resolution
 * - Token caching
 *
 * @module msd/styles/TokenResolver
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Token Resolver for theme token resolution
 *
 * Resolves token paths to actual values with caching and
 * support for nested token references.
 *
 * @class TokenResolver
 */
export class TokenResolver {
  /**
   * Create a TokenResolver instance
   *
   * @param {Object} themeManager - ThemeManager instance
   */
  constructor(themeManager) {
    this.themeManager = themeManager;

    // Token resolution cache
    this.cache = new Map();

    // Statistics
    this.stats = {
      resolutions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      failures: 0
    };

    // Maximum recursion depth for nested tokens
    this.maxRecursionDepth = 10;
  }

  /**
   * Resolve a token path to its value
   *
   * @param {string} tokenPath - Token path (e.g., 'colors.primary')
   * @param {*} fallback - Fallback value if resolution fails
   * @param {Object} context - Resolution context (viewBox, etc.)
   * @returns {Object} { value, path, resolved }
   *
   * @example
   * const result = tokenResolver.resolve('colors.primary', '#FF9900', context);
   * // { value: '#FF9900', path: 'colors.primary', resolved: true }
   */
  resolve(tokenPath, fallback = null, context = {}) {
    this.stats.resolutions++;

    // Check cache first
    const cacheKey = this._generateCacheKey(tokenPath, context);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    this.stats.cacheMisses++;

    // Resolve token
    const result = this._resolveToken(tokenPath, fallback, context, 0);

    // Cache the result
    this.cache.set(cacheKey, result);

    return result;
  }

  /**
   * Resolve token with recursion depth tracking
   * @private
   */
  _resolveToken(tokenPath, fallback, context, depth) {
    // Check recursion depth
    if (depth >= this.maxRecursionDepth) {
      cblcarsLog.warn('[TokenResolver] Max recursion depth reached for:', tokenPath);
      this.stats.failures++;
      return {
        value: fallback,
        path: tokenPath,
        resolved: false,
        error: 'max_recursion_depth'
      };
    }

    if (!tokenPath || typeof tokenPath !== 'string') {
      return {
        value: fallback,
        path: tokenPath,
        resolved: false,
        error: 'invalid_token_path'
      };
    }

    // Parse token path
    const parts = tokenPath.split('.');
    if (parts.length === 0) {
      return {
        value: fallback,
        path: tokenPath,
        resolved: false,
        error: 'empty_token_path'
      };
    }

    try {
      // Get theme
      const theme = this._getTheme();
      if (!theme) {
        this.stats.failures++;
        return {
          value: fallback,
          path: tokenPath,
          resolved: false,
          error: 'no_theme'
        };
      }

      // Navigate token path
      let value = theme;
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          // Path not found
          this.stats.failures++;
          return {
            value: fallback,
            path: tokenPath,
            resolved: false,
            error: 'path_not_found'
          };
        }
      }

      // Check if value is a function (context-aware token)
      if (typeof value === 'function') {
        try {
          value = value(context);
        } catch (error) {
          cblcarsLog.warn('[TokenResolver] Context function error:', tokenPath, error);
          this.stats.failures++;
          return {
            value: fallback,
            path: tokenPath,
            resolved: false,
            error: 'function_execution_error'
          };
        }
      }

      // Check if value is another token reference
      if (typeof value === 'string' && this._isTokenReference(value)) {
        // Recursively resolve nested token
        const nestedResult = this._resolveToken(value, fallback, context, depth + 1);
        return {
          value: nestedResult.value,
          path: tokenPath,
          resolved: nestedResult.resolved,
          nestedToken: value,
          nestedResolved: nestedResult.resolved
        };
      }

      // Successfully resolved
      return {
        value: value !== null && value !== undefined ? value : fallback,
        path: tokenPath,
        resolved: true
      };

    } catch (error) {
      cblcarsLog.warn('[TokenResolver] Resolution error:', tokenPath, error);
      this.stats.failures++;
      return {
        value: fallback,
        path: tokenPath,
        resolved: false,
        error: error.message
      };
    }
  }

  /**
   * Clear token cache
   *
   * @param {string} tokenPath - Specific token to clear (optional)
   */
  clearCache(tokenPath = null) {
    if (tokenPath) {
      // Clear specific token and any keys containing it
      const keysToDelete = [];
      for (const key of this.cache.keys()) {
        if (key.includes(tokenPath)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      // Clear all
      this.cache.clear();
    }
  }

  /**
   * Clear a specific token from cache
   *
   * @param {string} tokenPath - Token path to clear
   */
  clearToken(tokenPath) {
    this.clearCache(tokenPath);
  }

  /**
   * Get resolver statistics
   *
   * @returns {Object} Statistics
   */
  getStats() {
    const total = this.stats.resolutions;
    return {
      resolutions: total,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      failures: this.stats.failures,
      cacheSize: this.cache.size,
      hitRate: total > 0 ? ((this.stats.cacheHits / total) * 100).toFixed(1) + '%' : '0%',
      failureRate: total > 0 ? ((this.stats.failures / total) * 100).toFixed(1) + '%' : '0%'
    };
  }

  /**
   * Get theme from ThemeManager
   * @private
   */
  _getTheme() {
    if (!this.themeManager) return null;

    try {
      // Try to get active theme
      if (typeof this.themeManager.getActiveTheme === 'function') {
        return this.themeManager.getActiveTheme();
      }

      // Fallback: try to access theme property directly
      if (this.themeManager.activeTheme) {
        return this.themeManager.activeTheme;
      }

      // Fallback: try to access themes
      if (this.themeManager.themes) {
        const activeThemeName = this.themeManager.activeThemeName ||
                               this.themeManager.currentTheme ||
                               'default';
        return this.themeManager.themes[activeThemeName];
      }

      return null;
    } catch (error) {
      cblcarsLog.warn('[TokenResolver] Error getting theme:', error);
      return null;
    }
  }

  /**
   * Check if a value is a token reference
   * @private
   */
  _isTokenReference(value) {
    if (typeof value !== 'string') return false;
    const tokenCategories = ['colors', 'typography', 'spacing', 'borders', 'effects', 'animations', 'components'];
    return tokenCategories.some(category => value.startsWith(`${category}.`));
  }

  /**
   * Generate cache key for token resolution
   * @private
   */
  _generateCacheKey(tokenPath, context) {
    // Include context hash in key for context-aware tokens
    const contextHash = context.viewBox ? JSON.stringify(context.viewBox) : 'default';
    return `${tokenPath}:${contextHash}`;
  }
}

export default TokenResolver;