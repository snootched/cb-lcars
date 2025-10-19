/**
 * @fileoverview Token Validator - Validates token references
 *
 * Validates that token references:
 * - Exist in the theme
 * - Resolve to valid values
 * - Don't have circular references
 * - Use correct token path format
 *
 * Integrates with:
 * - ThemeManager for token lookup
 * - ThemeTokenResolver for resolution testing
 *
 * @module msd/validation/TokenValidator
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Token Validator
 *
 * Validates token references in overlay configurations.
 */
export class TokenValidator {
  /**
   * Create a TokenValidator
   *
   * @param {Object} themeManager - ThemeManager instance
   */
  constructor(themeManager) {
    this.themeManager = themeManager;
    this.tokenResolver = themeManager?.getResolver?.() || null;

    // Valid token categories
    this.tokenCategories = [
      'colors',
      'typography',
      'spacing',
      'borders',
      'effects',
      'animations',
      'components'
    ];

    cblcarsLog.debug('[TokenValidator] Initialized');
  }

  /**
   * Validate token references in an overlay
   *
   * @param {Object} overlay - Overlay configuration
   * @param {Object} context - Validation context
   * @returns {Object} Validation result with errors and warnings
   *
   * @example
   * const result = tokenValidator.validate({
   *   id: 'my-text',
   *   type: 'text',
   *   style: {
   *     color: 'colors.accent.primary',
   *     font_size: 'typography.fontSize.lg'
   *   }
   * });
   */
  validate(overlay, context = {}) {
    const result = {
      errors: [],
      warnings: []
    };

    if (!this.themeManager || !this.tokenResolver) {
      // ThemeManager not available - skip token validation
      return result;
    }

    // Find all token references in overlay
    const tokenRefs = this._findTokenReferences(overlay);

    // Validate each token reference
    tokenRefs.forEach(ref => {
      this._validateTokenReference(ref, result, context);
    });

    return result;
  }

  /**
   * Find all token references in overlay configuration
   *
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {string} [path=''] - Current path in object tree
   * @returns {Array<Object>} Array of token references with paths
   */
  _findTokenReferences(overlay, path = '') {
    const refs = [];

    if (!overlay || typeof overlay !== 'object') {
      return refs;
    }

    Object.entries(overlay).forEach(([key, value]) => {
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === 'string' && this._isTokenReference(value)) {
        refs.push({
          path: currentPath,
          tokenPath: value,
          field: key
        });
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively search objects (but not arrays)
        refs.push(...this._findTokenReferences(value, currentPath));
      }
    });

    return refs;
  }

  /**
   * Check if a value is a token reference
   *
   * @private
   * @param {string} value - Value to check
   * @returns {boolean} True if token reference
   */
  _isTokenReference(value) {
    if (typeof value !== 'string') return false;

    // Token references start with a known category
    return this.tokenCategories.some(category =>
      value.startsWith(`${category}.`)
    );
  }

  /**
   * Validate a single token reference
   *
   * @private
   * @param {Object} ref - Token reference object
   * @param {Object} result - Validation result to populate
   * @param {Object} context - Validation context
   */
  _validateTokenReference(ref, result, context) {
    const { path, tokenPath, field } = ref;

    // 1. Validate token path format
    if (!this._validateTokenPathFormat(tokenPath)) {
      result.errors.push({
        field: path,
        type: 'invalid_token_path',
        message: `Invalid token path format: "${tokenPath}"`,
        value: tokenPath,
        severity: 'error',
        suggestion: 'Token paths should be in format: category.subcategory.property (e.g., "colors.accent.primary")'
      });
      return;
    }

    // 2. Check if token exists in theme
    const tokenExists = this._checkTokenExists(tokenPath);

    if (!tokenExists) {
      const suggestion = this._suggestSimilarToken(tokenPath);

      result.errors.push({
        field: path,
        type: 'token_not_found',
        message: `Token "${tokenPath}" not found in theme`,
        value: tokenPath,
        severity: 'error',
        suggestion: suggestion ? `Did you mean "${suggestion}"?` : 'Check your theme configuration',
        helpUrl: 'https://docs.cb-lcars.com/theming/tokens'
      });
      return;
    }

    // 3. Try to resolve token
    try {
      const resolved = this.tokenResolver.resolve(tokenPath, null, context);

      if (!resolved || !resolved.resolved) {
        result.warnings.push({
          field: path,
          type: 'token_resolution_failed',
          message: `Token "${tokenPath}" exists but failed to resolve`,
          value: tokenPath,
          severity: 'warning',
          suggestion: 'Check for circular references or invalid token values'
        });
        return;
      }

      // 4. Warn if resolved value is still a token reference (might indicate circular ref)
      if (typeof resolved.value === 'string' && this._isTokenReference(resolved.value)) {
        result.warnings.push({
          field: path,
          type: 'token_circular_reference',
          message: `Token "${tokenPath}" may have circular reference`,
          value: tokenPath,
          resolvedTo: resolved.value,
          severity: 'warning'
        });
      }

    } catch (error) {
      result.errors.push({
        field: path,
        type: 'token_resolution_error',
        message: `Error resolving token "${tokenPath}": ${error.message}`,
        value: tokenPath,
        severity: 'error'
      });
    }
  }

  /**
   * Validate token path format
   *
   * @private
   * @param {string} tokenPath - Token path to validate
   * @returns {boolean} True if format is valid
   */
  _validateTokenPathFormat(tokenPath) {
    if (!tokenPath || typeof tokenPath !== 'string') {
      return false;
    }

    // Token path must have at least 2 parts (category.property)
    const parts = tokenPath.split('.');
    if (parts.length < 2) {
      return false;
    }

    // First part must be a valid category
    const category = parts[0];
    if (!this.tokenCategories.includes(category)) {
      return false;
    }

    // All parts must be valid identifiers (alphanumeric, underscore, hyphen)
    const validIdentifier = /^[a-zA-Z0-9_-]+$/;
    if (!parts.every(part => validIdentifier.test(part))) {
      return false;
    }

    return true;
  }

  /**
   * Check if token exists in theme
   *
   * @private
   * @param {string} tokenPath - Token path
   * @returns {boolean} True if token exists
   */
  _checkTokenExists(tokenPath) {
    try {
      const theme = this.themeManager.getActiveTheme();
      if (!theme) return false;

      // Navigate token path
      const parts = tokenPath.split('.');
      let current = theme;

      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return false;
        }
      }

      return current !== undefined && current !== null;

    } catch (error) {
      cblcarsLog.debug('[TokenValidator] Error checking token existence:', error);
      return false;
    }
  }

  /**
   * Suggest similar token paths
   *
   * @private
   * @param {string} tokenPath - Invalid token path
   * @returns {string|null} Suggested token path or null
   */
  _suggestSimilarToken(tokenPath) {
    try {
      const theme = this.themeManager.getActiveTheme();
      if (!theme) return null;

      const parts = tokenPath.split('.');
      const category = parts[0];

      // If category doesn't exist, suggest similar category
      if (!this.tokenCategories.includes(category)) {
        const similarCategory = this._findSimilarString(category, this.tokenCategories);
        if (similarCategory) {
          const newPath = [similarCategory, ...parts.slice(1)].join('.');
          return newPath;
        }
        return null;
      }

      // Try to find similar path in the same category
      const availablePaths = this._getAllTokenPaths(theme[category], category);
      const similar = this._findSimilarString(tokenPath, availablePaths);

      return similar;

    } catch (error) {
      cblcarsLog.debug('[TokenValidator] Error suggesting similar token:', error);
      return null;
    }
  }

  /**
   * Get all token paths in an object
   *
   * @private
   * @param {Object} obj - Object to traverse
   * @param {string} prefix - Path prefix
   * @returns {Array<string>} Array of token paths
   */
  _getAllTokenPaths(obj, prefix = '') {
    const paths = [];

    if (!obj || typeof obj !== 'object') {
      return paths;
    }

    Object.entries(obj).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        paths.push(...this._getAllTokenPaths(value, path));
      } else {
        paths.push(path);
      }
    });

    return paths;
  }

  /**
   * Find similar string using simple similarity metric
   *
   * @private
   * @param {string} input - Input string
   * @param {Array<string>} candidates - Candidate strings
   * @returns {string|null} Most similar string or null
   */
  _findSimilarString(input, candidates) {
    if (!input || !candidates || candidates.length === 0) {
      return null;
    }

    const inputLower = input.toLowerCase();

    // Check for exact case-insensitive match
    const exactMatch = candidates.find(c => c.toLowerCase() === inputLower);
    if (exactMatch) return exactMatch;

    // Check for partial match
    const partialMatches = candidates.filter(c =>
      c.toLowerCase().includes(inputLower) ||
      inputLower.includes(c.toLowerCase())
    );

    if (partialMatches.length > 0) {
      // Return the shortest partial match
      return partialMatches.reduce((shortest, current) =>
        current.length < shortest.length ? current : shortest
      );
    }

    // Check for similar start
    const similarStart = candidates.find(c =>
      c.toLowerCase().startsWith(inputLower.substring(0, Math.min(3, inputLower.length)))
    );

    return similarStart || null;
  }

  /**
   * Get validation statistics
   *
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      hasThemeManager: !!this.themeManager,
      hasTokenResolver: !!this.tokenResolver,
      tokenCategories: this.tokenCategories.length
    };
  }
}

export default TokenValidator;