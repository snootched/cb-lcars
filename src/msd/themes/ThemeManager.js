/**
 * @fileoverview ThemeManager - Central theme system management
 *
 * Replaces DefaultsManager and ProfileResolver with unified theme-based defaults.
 * All component defaults come from active theme's component tokens.
 *
 * Features:
 * - Load themes from packs
 * - Activate/switch themes at runtime
 * - Provide component defaults via token resolution
 * - Replace DefaultsManager.getDefault() API
 * - Replace ProfileResolver style layering
 *
 * @module msd/themes/ThemeManager
 */

import { ThemeTokenResolver, initializeTokenResolver, getTokenResolver } from './ThemeTokenResolver.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Built-in filter presets for base SVG
 * These provide common filter combinations for visual hierarchy
 */
export const BUILTIN_FILTER_PRESETS = {
  // No filters - clear/remove all filtering
  none: {},

  // Subtle backdrop - overlays visible but not overpowering
  dimmed: {
    opacity: 0.5,
    brightness: 0.8
  },

  // Very subtle - gentle de-emphasis
  subtle: {
    opacity: 0.6,
    blur: '1px',
    grayscale: 0.2
  },

  // Heavy dimming - makes overlays really pop
  backdrop: {
    opacity: 0.3,
    blur: '3px',
    brightness: 0.6
  },

  // Washed out look
  faded: {
    opacity: 0.4,
    grayscale: 0.5,
    contrast: 0.7
  },

  // Alert mode - bright with red tint
  'red-alert': {
    opacity: 1.0,
    brightness: 1.2,
    hue_rotate: 10
  },

  // Full grayscale for minimal distraction
  monochrome: {
    opacity: 0.6,
    grayscale: 1.0,
    contrast: 0.8
  }
};

/**
 * ThemeManager - Central theme system coordinator
 *
 * Manages theme loading, activation, and provides unified access to component defaults.
 * Replaces the deprecated DefaultsManager and ProfileResolver systems.
 */
export class ThemeManager {
  constructor() {
    /** @type {Map<string, Object>} Theme ID -> Theme object */
    this.themes = new Map();

    /** @type {string|null} Active theme ID */
    this.activeThemeId = null;

    /** @type {Object|null} Active theme object */
    this.activeTheme = null;

    /** @type {ThemeTokenResolver|null} Token resolver instance */
    this.resolver = null;

    /** @type {boolean} Initialization state */
    this.initialized = false;
  }

  /**
   * Initialize theme system from packs
   *
   * @param {Array<Object>} packs - Loaded pack objects
   * @param {string} [requestedThemeId='lcars-classic'] - Theme ID to activate
   * @param {Element} [rootElement=null] - Root element for CSS variables
   * @returns {Promise<void>}
   */
  async initialize(packs, requestedThemeId = 'lcars-classic', rootElement = null) {
    cblcarsLog.debug('[ThemeManager] 🎨 Initializing theme system');

    // Load all themes from packs
    this.themes.clear();
    packs.forEach(pack => {
      if (pack.themes && typeof pack.themes === 'object') {
        Object.entries(pack.themes).forEach(([themeId, theme]) => {
          this.themes.set(themeId, {
            ...theme,
            packId: pack.id
          });
          cblcarsLog.debug(`[ThemeManager] Loaded theme: ${themeId} from pack: ${pack.id}`);
        });
      }
    });

    if (this.themes.size === 0) {
      cblcarsLog.warn('[ThemeManager] No themes found in packs - using fallback');
    }

    // Find default theme from packs
    const packWithDefault = packs.find(pack => pack.defaultTheme);
    const fallbackThemeId = packWithDefault?.defaultTheme || 'lcars-classic';

    // Activate requested theme (or fallback)
    const themeToActivate = requestedThemeId || fallbackThemeId;
    await this.activateTheme(themeToActivate, rootElement);

    this.initialized = true;

    cblcarsLog.info('[ThemeManager] ✅ Theme system initialized:', {
      themeCount: this.themes.size,
      activeTheme: this.activeThemeId,
      availableThemes: Array.from(this.themes.keys())
    });
  }

  /**
   * Activate a specific theme
   *
   * @param {string} themeId - Theme ID to activate
   * @param {Element} [rootElement=null] - Root element for CSS variables
   * @returns {Promise<void>}
   * @throws {Error} If theme not found or has no tokens
   */
  async activateTheme(themeId, rootElement = null) {
    const theme = this.themes.get(themeId);

    if (!theme) {
      cblcarsLog.error('[ThemeManager] Theme not found:', themeId);
      throw new Error(`Theme not found: ${themeId}`);
    }

    if (!theme.tokens) {
      cblcarsLog.error('[ThemeManager] Theme has no tokens:', themeId);
      throw new Error(`Theme has no tokens: ${themeId}`);
    }

    // Initialize token resolver with theme tokens
    initializeTokenResolver(theme.tokens, rootElement);
    this.resolver = getTokenResolver();

    // Clear resolver cache on theme change
    if (this.activeThemeId && this.activeThemeId !== themeId) {
      this.resolver.clearCache();
    }

    // Load theme CSS file if specified
    if (theme.cssFile) {
      this._loadThemeCss(theme.cssFile, themeId);
    }

    this.activeThemeId = themeId;
    this.activeTheme = theme;

    cblcarsLog.info('[ThemeManager] ✅ Theme activated:', {
      id: themeId,
      name: theme.name,
      description: theme.description,
      tokenCount: this._countTokens(theme.tokens)
    });
  }

  /**
   * Get default value for a component property
   *
   * **Replaces:** DefaultsManager.getDefault()
   *
   * @param {string} componentType - Component type (e.g., 'text', 'statusGrid')
   * @param {string} property - Property name (e.g., 'defaultSize', 'defaultColor')
   * @param {*} [fallback=null] - Fallback value if token not found
   * @param {Object} [context={}] - Resolution context (viewBox, etc.)
   * @returns {*} Resolved value
   *
   * @example
   * // Get text component default font size
   * const fontSize = themeManager.getDefault('text', 'defaultSize');
   * // Returns: 14 (from theme's components.text.defaultSize token)
   *
   * @example
   * // Get status grid default cell color
   * const cellColor = themeManager.getDefault('statusGrid', 'defaultCellColor');
   * // Returns: 'var(--lcars-orange, #FF9900)' (resolved from token path)
   */
  getDefault(componentType, property, fallback = null, context = {}) {
    if (!this.resolver) {
      cblcarsLog.warn('[ThemeManager] No resolver available - theme not initialized');
      return fallback;
    }

    const tokenPath = `components.${componentType}.${property}`;
    return this.resolver.resolve(tokenPath, fallback, context);
  }

  /**
   * Get component-scoped resolver function
   *
   * Returns a function that automatically prefixes token paths with component name.
   *
   * @param {string} componentType - Component type (e.g., 'text', 'statusGrid')
   * @returns {Function} Scoped resolver function (property, fallback, context) => value
   * @throws {Error} If ThemeManager not initialized
   *
   * @example
   * const resolveToken = themeManager.forComponent('text');
   * const fontSize = resolveToken('defaultSize');
   * const color = resolveToken('defaultColor', '#FFFFFF');
   */
  forComponent(componentType) {
    if (!this.resolver) {
      throw new Error('ThemeManager not initialized - call initialize() first');
    }

    return this.resolver.forComponent(componentType);
  }

  /**
   * Get token resolver for direct token path resolution
   *
   * For advanced usage where you need direct access to the token resolver.
   *
   * @returns {ThemeTokenResolver} Token resolver instance
   * @throws {Error} If ThemeManager not initialized
   *
   * @example
   * const resolver = themeManager.getResolver();
   * const color = resolver.resolve('colors.accent.primary');
   */
  getResolver() {
    if (!this.resolver) {
      throw new Error('ThemeManager not initialized - call initialize() first');
    }
    return this.resolver;
  }

  /**
   * Get active theme information
   *
   * @returns {Object|null} Active theme info or null if not initialized
   *
   * @example
   * const theme = themeManager.getActiveTheme();
   * console.log(theme.name); // "LCARS Classic"
   * console.log(theme.tokens.components.chart); // {strokeColor: '...', ...}
   */
  getActiveTheme() {
    if (!this.activeTheme) {
      return null;
    }

    return {
      id: this.activeThemeId,
      name: this.activeTheme.name,
      description: this.activeTheme.description,
      packId: this.activeTheme.packId,
      tokens: this.activeTheme.tokens,  // ✅ NEW: Include actual tokens
      // ✅ NEW: Also include flattened token structure for direct access
      ...this.activeTheme.tokens  // This spreads colors, typography, components, etc. to top level
    };
  }

  /**
   * List all available theme IDs
   *
   * @returns {Array<string>} Array of theme IDs
   *
   * @example
   * const themes = themeManager.listThemes();
   * // Returns: ['lcars-classic', 'lcars-ds9', 'lcars-voyager']
   */
  listThemes() {
    return Array.from(this.themes.keys());
  }

  /**
   * Get detailed theme information
   *
   * @param {string} themeId - Theme ID
   * @returns {Object|null} Theme details or null if not found
   *
   * @example
   * const themeInfo = themeManager.getTheme('lcars-classic');
   * console.log(themeInfo.name); // "LCARS Classic"
   * console.log(themeInfo.packId); // "builtin_themes"
   */
  getTheme(themeId) {
    const theme = this.themes.get(themeId);
    return theme ? {
      id: themeId,
      name: theme.name,
      description: theme.description,
      packId: theme.packId,
      hasCssFile: !!theme.cssFile
    } : null;
  }

  /**
   * Load theme CSS file into document
   *
   * @private
   * @param {string} cssFile - CSS filename
   * @param {string} themeId - Theme identifier
   */
  _loadThemeCss(cssFile, themeId) {
    try {
      // Check if already loaded
      const existingLink = document.querySelector(`link[data-theme-id="${themeId}"]`);
      if (existingLink) {
        cblcarsLog.debug('[ThemeManager] Theme CSS already loaded:', themeId);
        return;
      }

      // Create link element
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `/local/cb-lcars/themes/${cssFile}`;
      link.setAttribute('data-theme-id', themeId);

      document.head.appendChild(link);

      cblcarsLog.debug('[ThemeManager] Loaded theme CSS:', cssFile);
    } catch (error) {
      cblcarsLog.warn('[ThemeManager] Failed to load theme CSS:', cssFile, error);
    }
  }

  /**
   * Count total tokens in theme
   *
   * @private
   * @param {Object} tokens - Token object
   * @returns {number} Total token count
   */
  _countTokens(tokens) {
    let count = 0;

    function countRecursive(obj) {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          countRecursive(obj[key]);
        } else {
          count++;
        }
      }
    }

    countRecursive(tokens);
    return count;
  }

  /**
   * Get debug information
   *
   * @returns {Object} Debug info including themes, active theme, and cache stats
   */
  getDebugInfo() {
    return {
      initialized: this.initialized,
      activeTheme: this.getActiveTheme(),
      availableThemes: this.listThemes().map(id => this.getTheme(id)),
      resolverCacheSize: this.resolver?.resolutionCache?.size || 0,
      themeCount: this.themes.size
    };
  }

  /**
   * Clear all caches
   *
   * Useful for development/hot-reload scenarios.
   */
  clearCache() {
    if (this.resolver) {
      this.resolver.clearCache();
      cblcarsLog.debug('[ThemeManager] Resolver cache cleared');
    }
  }

  /**
   * Get a filter preset by name
   *
   * Checks both built-in presets and theme-defined presets.
   * Theme presets override built-in presets with the same name.
   *
   * @param {string} presetName - Name of the filter preset
   * @returns {Object|null} Filter object or null if not found
   *
   * @example
   * const filters = themeManager.getFilterPreset('dimmed');
   * // Returns: { opacity: 0.5, brightness: 0.8 }
   */
  getFilterPreset(presetName) {
    // Check theme-defined presets first (allows themes to override built-ins)
    if (this.activeTheme?.filter_presets?.[presetName]) {
      return this.activeTheme.filter_presets[presetName];
    }

    // Fall back to built-in presets
    return BUILTIN_FILTER_PRESETS[presetName] || null;
  }

  /**
   * List all available filter preset names
   *
   * @returns {Array<string>} Array of preset names
   *
   * @example
   * const presets = themeManager.listFilterPresets();
   * // Returns: ['dimmed', 'subtle', 'backdrop', 'faded', 'red-alert', 'monochrome', ...]
   */
  listFilterPresets() {
    const builtinPresets = Object.keys(BUILTIN_FILTER_PRESETS);
    const themePresets = this.activeTheme?.filter_presets
      ? Object.keys(this.activeTheme.filter_presets)
      : [];

    // Combine and deduplicate (theme presets take precedence)
    return [...new Set([...builtinPresets, ...themePresets])];
  }

  /**
   * Destroy theme manager and clean up resources
   */
  destroy() {
    this.themes.clear();
    this.activeThemeId = null;
    this.activeTheme = null;
    this.resolver = null;
    this.initialized = false;

    cblcarsLog.debug('[ThemeManager] Destroyed');
  }
}

// Make globally accessible for debugging
if (typeof window !== 'undefined') {
  window.ThemeManager = ThemeManager;
}