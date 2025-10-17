/**
 * @fileoverview ThemeTokenResolver - Token resolution system for MSD theming
 *
 * Resolves token paths (e.g., 'colors.accent.primary') to actual values.
 * Handles:
 * - Nested token references
 * - Computed tokens (color manipulation)
 * - Responsive tokens (viewBox-dependent)
 * - Component-scoped resolution
 * - Resolution caching for performance
 *
 * @module msd/themes/ThemeTokenResolver
 */

import { ColorUtils } from './ColorUtils.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * ThemeTokenResolver - Resolves design tokens to values
 */
export class ThemeTokenResolver {
  /**
   * Create token resolver
   *
   * @param {Object} tokens - Theme token object
   * @param {Element} [rootElement=null] - Root element for CSS variable access
   */
  constructor(tokens, rootElement = null) {
    this.tokens = tokens || {};
    this.rootElement = rootElement || (typeof document !== 'undefined' ? document.documentElement : null);

    // Resolution caches for performance
    this.resolutionCache = new Map();  // path -> resolved value
    this.computedCache = new Map();    // computed expression -> result

    // Track circular reference detection
    this.resolutionStack = [];
  }

  /**
   * Resolve token with caching
   *
   * @param {string} path - Token path (e.g., 'colors.accent.primary')
   * @param {*} fallback - Fallback value if token not found
   * @param {Object} [context={}] - Resolution context (viewBox, etc.)
   * @returns {*} Resolved value
   *
   * @example
   * resolver.resolve('colors.accent.primary', '#FF9900')
   * // Returns: 'var(--lcars-orange, #FF9900)'
   *
   * resolver.resolve('colors.accent.primaryDark', '#CC6600')
   * // Returns: 'color-mix(in srgb, var(--lcars-orange) 80%, black 20%)'
   *
   * resolver.resolve('typography.fontSize.base', 14, { viewBox: [0,0,300,200] })
   * // Returns: 12 (small variant for small viewBox)
   */
  resolve(path, fallback = null, context = {}) {
    // Handle null/undefined paths
    if (!path) return fallback;

    // Handle direct values (not token references)
    if (this._isDirectValue(path)) {
      return path;
    }

    // Check cache for non-context-dependent paths
    const hasContext = context && Object.keys(context).length > 0;
    if (!hasContext) {
      const cacheKey = `${path}:${fallback}`;
      if (this.resolutionCache.has(cacheKey)) {
        return this.resolutionCache.get(cacheKey);
      }
    }

    // Resolve token path
    const result = this._resolveTokenPath(path, fallback, context);

    // Cache result (if no context dependencies)
    if (!hasContext) {
      this.resolutionCache.set(`${path}:${fallback}`, result);
    }

    return result;
  }

  /**
   * Create component-scoped resolver
   *
   * Automatically prefixes token paths with component namespace.
   *
   * @param {string} componentName - Component name (e.g., 'text', 'statusGrid')
   * @returns {Function} Scoped resolve function
   *
   * @example
   * const resolveToken = resolver.forComponent('text');
   * resolveToken('defaultColor', '#FFFFFF')
   * // Resolves: 'components.text.defaultColor'
   */
  forComponent(componentName) {
    return (path, fallback = null, context = {}) => {
      // If path doesn't start with component name, prefix it
      if (!path.startsWith(`components.${componentName}.`) &&
          !path.startsWith('colors.') &&
          !path.startsWith('typography.') &&
          !path.startsWith('spacing.') &&
          !path.startsWith('borders.') &&
          !path.startsWith('effects.') &&
          !path.startsWith('animations.')) {
        path = `components.${componentName}.${path}`;
      }

      return this.resolve(path, fallback, context);
    };
  }

  /**
   * Clear resolution cache (call on theme change)
   */
  clearCache() {
    this.resolutionCache.clear();
    this.computedCache.clear();
    cblcarsLog.debug('[ThemeTokenResolver] Cache cleared');
  }

  /**
   * Resolve token path to value
   *
   * @private
   * @param {string} path - Token path
   * @param {*} fallback - Fallback value
   * @param {Object} context - Resolution context
   * @returns {*} Resolved value
   */
  _resolveTokenPath(path, fallback, context) {
    // Detect circular references
    if (this.resolutionStack.includes(path)) {
      cblcarsLog.warn('[ThemeTokenResolver] Circular reference detected:', path);
      return fallback;
    }

    this.resolutionStack.push(path);

    try {
      // Get value from tokens
      const value = this._getNestedValue(this.tokens, path);

      if (value === undefined || value === null) {
        return fallback;
      }

      // Handle different value types
      const resolved = this._resolveValue(value, context);

      return resolved !== undefined ? resolved : fallback;

    } finally {
      // Remove from stack
      this.resolutionStack.pop();
    }
  }

  /**
   * Resolve a value (handles references, computed tokens, responsive tokens)
   *
   * @private
   * @param {*} value - Value to resolve
   * @param {Object} context - Resolution context
   * @returns {*} Resolved value
   */
  _resolveValue(value, context) {
    // Handle primitive values
    if (typeof value !== 'string') {
      // Handle responsive token objects
      if (typeof value === 'object' && !Array.isArray(value) && context.viewBox) {
        return this._resolveResponsiveToken(value, context);
      }
      return value;
    }

    // Handle token references (e.g., 'colors.accent.primary')
    if (this._isTokenReference(value)) {
      return this.resolve(value, value, context);
    }

    // Handle computed tokens (e.g., 'darken(colors.accent.primary, 0.2)')
    if (this._isComputedToken(value)) {
      return this._resolveComputedToken(value, context);
    }

    // Handle CSS variables (pass through)
    if (value.includes('var(')) {
      return value;
    }

    // Return as-is
    return value;
  }

  /**
   * Get nested value from object by path
   *
   * @private
   * @param {Object} obj - Object to traverse
   * @param {string} path - Dot-separated path
   * @returns {*} Value or undefined
   */
  _getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Check if value is a direct value (not a token reference)
   *
   * @private
   * @param {*} value - Value to check
   * @returns {boolean} True if direct value
   */
  _isDirectValue(value) {
    if (typeof value !== 'string') return true;

    // CSS variables are direct values
    if (value.includes('var(')) return true;

    // Hex colors are direct values
    if (value.startsWith('#')) return true;

    // RGB/RGBA colors are direct values
    if (value.startsWith('rgb')) return true;

    // Numbers as strings are direct values
    if (!isNaN(value)) return true;

    return false;
  }

  /**
   * Check if value is a token reference
   *
   * @private
   * @param {string} value - Value to check
   * @returns {boolean} True if token reference
   */
  _isTokenReference(value) {
    // Token references look like: 'colors.accent.primary'
    // Must have dots and start with known token category
    const tokenCategories = ['colors', 'typography', 'spacing', 'borders', 'effects', 'animations', 'components'];
    return tokenCategories.some(category => value.startsWith(`${category}.`));
  }

  /**
   * Check if value is a computed token
   *
   * @private
   * @param {string} value - Value to check
   * @returns {boolean} True if computed token
   */
  _isComputedToken(value) {
    // Computed tokens look like: 'darken(colors.accent.primary, 0.2)'
    const computedFunctions = ['darken', 'lighten', 'alpha', 'saturate', 'desaturate', 'mix'];
    return computedFunctions.some(fn => value.startsWith(`${fn}(`));
  }

  /**
   * Resolve computed token (color manipulation)
   *
   * @private
   * @param {string} expression - Computed expression
   * @param {Object} context - Resolution context
   * @returns {string} Resolved color
   */
  _resolveComputedToken(expression, context) {
    // Check computed cache
    if (this.computedCache.has(expression)) {
      return this.computedCache.get(expression);
    }

    try {
      // Parse expression: functionName(arg1, arg2, ...)
      const match = expression.match(/^(\w+)\((.+)\)$/);
      if (!match) {
        cblcarsLog.warn('[ThemeTokenResolver] Invalid computed token:', expression);
        return expression;
      }

      const [, functionName, argsStr] = match;

      // Parse arguments (handle nested parentheses for token references)
      const args = this._parseComputedArgs(argsStr);

      // Resolve each argument
      const resolvedArgs = args.map(arg => {
        // If argument is a token reference, resolve it
        if (this._isTokenReference(arg)) {
          return this.resolve(arg, arg, context);
        }
        // If argument is a number string, parse it
        if (!isNaN(arg)) {
          return parseFloat(arg);
        }
        return arg;
      });

      // Execute color manipulation function
      let result;
      switch (functionName) {
        case 'darken':
          result = ColorUtils.darken(resolvedArgs[0], resolvedArgs[1]);
          break;
        case 'lighten':
          result = ColorUtils.lighten(resolvedArgs[0], resolvedArgs[1]);
          break;
        case 'alpha':
          result = ColorUtils.alpha(resolvedArgs[0], resolvedArgs[1]);
          break;
        case 'saturate':
          result = ColorUtils.saturate(resolvedArgs[0], resolvedArgs[1]);
          break;
        case 'desaturate':
          result = ColorUtils.desaturate(resolvedArgs[0], resolvedArgs[1]);
          break;
        case 'mix':
          result = ColorUtils.mix(resolvedArgs[0], resolvedArgs[1], resolvedArgs[2]);
          break;
        default:
          cblcarsLog.warn('[ThemeTokenResolver] Unknown computed function:', functionName);
          return expression;
      }

      // Cache result
      this.computedCache.set(expression, result);

      return result;

    } catch (error) {
      cblcarsLog.error('[ThemeTokenResolver] Error resolving computed token:', expression, error);
      return expression;
    }
  }

  /**
   * Parse computed token arguments
   *
   * @private
   * @param {string} argsStr - Arguments string
   * @returns {Array<string>} Parsed arguments
   */
  _parseComputedArgs(argsStr) {
    const args = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];

      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current) {
      args.push(current.trim());
    }

    return args;
  }

  /**
   * Resolve responsive token (viewBox-dependent)
   *
   * Responsive tokens are objects with size breakpoints:
   * {
   *   small: 12,
   *   medium: 14,
   *   large: 16
   * }
   *
   * @private
   * @param {Object} tokenValue - Responsive token object
   * @param {Object} context - Resolution context with viewBox
   * @returns {*} Resolved value for current viewBox
   */
  _resolveResponsiveToken(tokenValue, context) {
    if (!context.viewBox) {
      // No viewBox context, return medium variant or first available
      return tokenValue.medium || tokenValue.base || Object.values(tokenValue)[0];
    }

    const [, , width] = context.viewBox;

    // Determine size category based on viewBox width
    let sizeCategory;
    if (width < 400) {
      sizeCategory = 'small';
    } else if (width < 800) {
      sizeCategory = 'medium';
    } else {
      sizeCategory = 'large';
    }

    // Return appropriate variant with fallback chain
    return tokenValue[sizeCategory] ||
           tokenValue.medium ||
           tokenValue.base ||
           Object.values(tokenValue)[0];
  }
}

/**
 * Global token resolver instance
 * Initialized by MSD system on startup
 */
export let themeTokenResolver = null;

/**
 * Initialize global token resolver
 *
 * @param {Object} tokens - Theme tokens
 * @param {Element} [rootElement=null] - Root element for CSS variables
 */
export function initializeTokenResolver(tokens, rootElement = null) {
  themeTokenResolver = new ThemeTokenResolver(tokens, rootElement);
  cblcarsLog.debug('[ThemeTokenResolver] Initialized with tokens:', Object.keys(tokens));
}

/**
 * Get global token resolver
 *
 * @returns {ThemeTokenResolver} Global resolver instance
 * @throws {Error} If resolver not initialized
 */
export function getTokenResolver() {
  if (!themeTokenResolver) {
    throw new Error('ThemeTokenResolver not initialized. Call initializeTokenResolver() first.');
  }
  return themeTokenResolver;
}
