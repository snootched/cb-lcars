/**
 * @fileoverview Theme System Initialization
 *
 * Initializes the token resolver with theme tokens from loaded packs.
 * Should be called during MSD pipeline startup after packs are loaded.
 *
 * @module msd/themes/initializeThemeSystem
 */

import { initializeTokenResolver } from './ThemeTokenResolver.js';
import { lcarsClassicTokens } from './tokens/lcarsClassicTokens.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Initialize theme system with pack themes
 *
 * @param {Array<Object>} packs - Loaded MSD packs
 * @param {Object} config - MSD configuration
 * @param {Element} [rootElement=null] - Root element for CSS variable access
 * @returns {Object} Initialization result { success, theme, error }
 */
export function initializeThemeSystem(packs, config = {}, rootElement = null) {
  try {
    cblcarsLog.debug('[ThemeSystem] Initializing theme system...', {
      packCount: packs.length,
      requestedTheme: config.theme
    });

    // Find pack with themes
    const packWithThemes = packs.find(pack => pack.themes && Object.keys(pack.themes).length > 0);

    if (!packWithThemes) {
      cblcarsLog.warn('[ThemeSystem] No pack with themes found, using fallback');
      return initializeFallbackTheme(rootElement);
    }

    // Determine which theme to use
    const requestedTheme = config.theme || packWithThemes.defaultTheme || 'lcars-classic';
    const theme = packWithThemes.themes[requestedTheme];

    if (!theme) {
      cblcarsLog.warn('[ThemeSystem] Requested theme not found:', requestedTheme);
      // Try default theme
      const defaultTheme = packWithThemes.themes[packWithThemes.defaultTheme];
      if (defaultTheme) {
        return initializeThemeFromPack(defaultTheme, packWithThemes.defaultTheme, rootElement);
      }
      return initializeFallbackTheme(rootElement);
    }

    return initializeThemeFromPack(theme, requestedTheme, rootElement);

  } catch (error) {
    cblcarsLog.error('[ThemeSystem] Failed to initialize theme system:', error);
    return {
      success: false,
      theme: null,
      error: error.message
    };
  }
}

/**
 * Initialize theme from pack theme definition
 *
 * @private
 * @param {Object} theme - Theme definition from pack
 * @param {string} themeId - Theme identifier
 * @param {Element} rootElement - Root element
 * @returns {Object} Initialization result
 */
function initializeThemeFromPack(theme, themeId, rootElement) {
  try {
    if (!theme.tokens) {
      cblcarsLog.warn('[ThemeSystem] Theme has no tokens:', themeId);
      return initializeFallbackTheme(rootElement);
    }

    // Initialize token resolver with theme tokens
    initializeTokenResolver(theme.tokens, rootElement);

    // Load theme CSS file if specified
    if (theme.cssFile) {
      loadThemeCssFile(theme.cssFile, themeId);
    }

    cblcarsLog.info('[ThemeSystem] ✅ Theme system initialized:', {
      theme: themeId,
      name: theme.name,
      tokenCount: countTokens(theme.tokens),
      hasCssFile: !!theme.cssFile
    });

    return {
      success: true,
      theme: {
        id: themeId,
        name: theme.name,
        description: theme.description,
        tokens: theme.tokens
      },
      error: null
    };

  } catch (error) {
    cblcarsLog.error('[ThemeSystem] Failed to initialize theme:', themeId, error);
    return {
      success: false,
      theme: null,
      error: error.message
    };
  }
}

/**
 * Initialize fallback theme (LCARS Classic)
 *
 * @private
 * @param {Element} rootElement - Root element
 * @returns {Object} Initialization result
 */
function initializeFallbackTheme(rootElement) {
  try {
    cblcarsLog.info('[ThemeSystem] Using fallback theme: LCARS Classic');

    initializeTokenResolver(lcarsClassicTokens, rootElement);

    return {
      success: true,
      theme: {
        id: 'lcars-classic',
        name: 'LCARS Classic (Fallback)',
        description: 'Default LCARS Classic theme',
        tokens: lcarsClassicTokens
      },
      error: null
    };

  } catch (error) {
    cblcarsLog.error('[ThemeSystem] Failed to initialize fallback theme:', error);
    return {
      success: false,
      theme: null,
      error: error.message
    };
  }
}

/**
 * Load theme CSS file for ApexCharts styling
 *
 * @private
 * @param {string} cssFile - CSS filename
 * @param {string} themeId - Theme identifier
 */
function loadThemeCssFile(cssFile, themeId) {
  try {
    // Check if CSS file already loaded
    const existingLink = document.querySelector(`link[data-theme-id="${themeId}"]`);
    if (existingLink) {
      cblcarsLog.debug('[ThemeSystem] Theme CSS already loaded:', themeId);
      return;
    }

    // Create link element
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/local/cb-lcars/themes/${cssFile}`;
    link.setAttribute('data-theme-id', themeId);

    // Add to document head
    document.head.appendChild(link);

    cblcarsLog.debug('[ThemeSystem] Loaded theme CSS:', cssFile);

  } catch (error) {
    cblcarsLog.warn('[ThemeSystem] Failed to load theme CSS:', cssFile, error);
  }
}

/**
 * Count tokens in token object (for logging)
 *
 * @private
 * @param {Object} tokens - Token object
 * @returns {number} Total token count
 */
function countTokens(tokens) {
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
 * Switch to a different theme at runtime
 *
 * @param {Array<Object>} packs - Loaded MSD packs
 * @param {string} newThemeId - New theme identifier
 * @param {Element} [rootElement=null] - Root element
 * @returns {Object} Switch result { success, theme, error }
 */
export function switchTheme(packs, newThemeId, rootElement = null) {
  try {
    cblcarsLog.info('[ThemeSystem] Switching theme to:', newThemeId);

    // Find pack with the requested theme
    let theme = null;
    let packWithTheme = null;

    for (const pack of packs) {
      if (pack.themes && pack.themes[newThemeId]) {
        theme = pack.themes[newThemeId];
        packWithTheme = pack;
        break;
      }
    }

    if (!theme) {
      throw new Error(`Theme not found: ${newThemeId}`);
    }

    // Re-initialize token resolver with new theme
    const result = initializeThemeFromPack(theme, newThemeId, rootElement);

    if (result.success) {
      cblcarsLog.info('[ThemeSystem] ✅ Theme switched successfully:', newThemeId);
    }

    return result;

  } catch (error) {
    cblcarsLog.error('[ThemeSystem] Failed to switch theme:', error);
    return {
      success: false,
      theme: null,
      error: error.message
    };
  }
}

/**
 * Get currently active theme info
 *
 * @returns {Object|null} Active theme info or null
 */
export function getActiveTheme() {
  // Token resolver stores reference to active tokens
  const resolver = window.themeTokenResolver;
  if (!resolver) {
    return null;
  }

  // Extract theme info from tokens (tokens should have metadata)
  return {
    hasResolver: true,
    tokenCount: countTokens(resolver.tokens),
    cacheSize: resolver.resolutionCache.size
  };
}
