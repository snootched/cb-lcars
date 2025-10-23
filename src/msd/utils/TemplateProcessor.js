import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * [TemplateProcessor] Unified template processing system
 *
 * Consolidates all template processing logic from:
 * - DataSourceMixin (MSD templates: {data_source.key:format})
 * - OverlayUtils (legacy simple templates)
 * - Scattered inline template detection
 *
 * Provides:
 * - Template detection and validation
 * - Reference extraction (for subscriptions)
 * - Entity dependency tracking
 * - Format specification parsing
 * - Template caching
 *
 * Does NOT handle:
 * - HA template evaluation ({{...}}) - delegated to MsdTemplateEngine
 * - Action context templates - handled by ActionHelpers
 *
 * @module TemplateProcessor
 */
export class TemplateProcessor {
  /**
   * Template syntax constants
   */
  static TEMPLATE_PATTERNS = {
    // MSD DataSource templates: {data_source}, {data_source.key}, {data_source:format}
    MSD: /\{([^}]+)\}/g,

    // Home Assistant templates: {{states('entity.id')}}
    HA: /\{\{([^}]+)\}\}/g,

    // Format specification: {data_source:.2f} or {data_source:int}
    FORMAT_SPEC: /^(.+?):(.+)$/
  };

  /**
   * Template detection markers
   */
  static MARKERS = {
    MSD_START: '{',
    MSD_END: '}',
    HA_START: '{{',
    HA_END: '}}'
  };

  /**
   * Template cache for performance
   * @private
   */
  static _cache = new Map();

  /**
   * Cache statistics
   * @private
   */
  static _stats = {
    cacheHits: 0,
    cacheMisses: 0,
    templatesProcessed: 0,
    lastReset: Date.now()
  };

  /**
   * Check if content contains any template markers
   *
   * @param {string} content - Content to check
   * @returns {boolean} True if content has templates
   *
   * @example
   * TemplateProcessor.hasTemplates('{sensor.temp}')  // true
   * TemplateProcessor.hasTemplates('{{states("sensor.temp")}}')  // true
   * TemplateProcessor.hasTemplates('Plain text')  // false
   */
  static hasTemplates(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }

    return content.includes(this.MARKERS.MSD_START) ||
           content.includes(this.MARKERS.HA_START);
  }

  /**
   * Check if content has MSD templates specifically
   *
   * @param {string} content - Content to check
   * @returns {boolean} True if has MSD templates ({...})
   */
  static hasMSDTemplates(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }

    // Has { but not {{ (to avoid false positive on HA templates)
    return content.includes(this.MARKERS.MSD_START) &&
           !content.includes(this.MARKERS.HA_START);
  }

  /**
   * Check if content has HA templates specifically
   *
   * @param {string} content - Content to check
   * @returns {boolean} True if has HA templates ({{...}})
   */
  static hasHATemplates(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }

    return content.includes(this.MARKERS.HA_START);
  }

  /**
   * Extract all template references from content
   *
   * Returns array of reference objects with:
   * - type: 'msd' | 'ha'
   * - reference: full reference string
   * - dataSource: DataSource name (for MSD)
   * - path: dot-notation path (for MSD)
   * - format: format specification (for MSD)
   *
   * @param {string} content - Content to parse
   * @returns {Array<Object>} Array of reference objects
   *
   * @example
   * TemplateProcessor.extractReferences('{cpu_temp.v:.1f}')
   * // Returns: [{
   * //   type: 'msd',
   * //   reference: 'cpu_temp.v:.1f',
   * //   dataSource: 'cpu_temp',
   * //   path: 'v',
   * //   format: '.1f'
   * // }]
   */
  static extractReferences(content) {
    if (!content || typeof content !== 'string') {
      return [];
    }

    const references = [];

    // Extract MSD references
    const msdMatches = content.matchAll(this.TEMPLATE_PATTERNS.MSD);
    for (const match of msdMatches) {
      const fullRef = match[1].trim();

      // Skip if this is actually part of an HA template
      if (match[0].startsWith('{{')) {
        continue;
      }

      const parsed = this._parseMSDReference(fullRef);
      references.push({
        type: 'msd',
        reference: fullRef,
        ...parsed
      });
    }

    // Extract HA references (basic detection - full parsing done by MsdTemplateEngine)
    const haMatches = content.matchAll(this.TEMPLATE_PATTERNS.HA);
    for (const match of haMatches) {
      const expression = match[1].trim();

      references.push({
        type: 'ha',
        reference: expression,
        expression: expression
      });
    }

    return references;
  }

  /**
   * Parse MSD template reference into components
   *
   * @private
   * @param {string} reference - Reference string (e.g., 'cpu_temp.v:.1f')
   * @returns {Object} Parsed components
   */
  static _parseMSDReference(reference) {
    // Split format specification if present
    const formatMatch = reference.match(this.TEMPLATE_PATTERNS.FORMAT_SPEC);

    let dataSourcePath = reference;
    let format = null;

    if (formatMatch) {
      dataSourcePath = formatMatch[1].trim();
      format = formatMatch[2].trim();
    }

    // Parse DataSource path
    const parts = dataSourcePath.split('.');
    const dataSource = parts[0];
    const path = parts.length > 1 ? parts.slice(1).join('.') : null;

    // Detect transformation/aggregation
    let pathType = 'value'; // default
    if (path) {
      if (path.startsWith('transformations.') || parts[1] === 'transformations') {
        pathType = 'transformation';
      } else if (path.startsWith('aggregations.') || parts[1] === 'aggregations') {
        pathType = 'aggregation';
      }
    }

    return {
      dataSource,
      path,
      pathType,
      format
    };
  }

  /**
   * Extract entity dependencies from content
   *
   * For MSD templates: returns DataSource names
   * For HA templates: delegates to MsdTemplateEngine
   *
   * @param {string} content - Content to analyze
   * @returns {Array<string>} Array of entity/DataSource IDs
   *
   * @example
   * TemplateProcessor.extractEntityDependencies('{cpu_temp} and {memory}')
   * // Returns: ['cpu_temp', 'memory']
   */
  static extractEntityDependencies(content) {
    if (!content || typeof content !== 'string') {
      return [];
    }

    const dependencies = new Set();
    const references = this.extractReferences(content);

    for (const ref of references) {
      if (ref.type === 'msd' && ref.dataSource) {
        dependencies.add(ref.dataSource);
      } else if (ref.type === 'ha') {
        // Delegate HA dependency extraction to MsdTemplateEngine
        const haEntities = this._extractHAEntities(ref.expression);
        haEntities.forEach(e => dependencies.add(e));
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Extract entity IDs from HA template expression
   *
   * @private
   * @param {string} expression - HA template expression
   * @returns {Array<string>} Entity IDs
   */
  static _extractHAEntities(expression) {
    const entities = [];

    // Match states('entity.id') function
    const statesMatches = expression.matchAll(/states\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    for (const match of statesMatches) {
      entities.push(match[1]);
    }

    // Match state_attr('entity.id', 'attr') function
    const attrMatches = expression.matchAll(/state_attr\s*\(\s*['"]([^'"]+)['"]\s*,/g);
    for (const match of attrMatches) {
      entities.push(match[1]);
    }

    return entities;
  }

  /**
   * Validate template syntax
   *
   * @param {string} content - Content to validate
   * @returns {Object} Validation result { valid: boolean, errors: Array }
   */
  static validate(content) {
    const result = {
      valid: true,
      errors: []
    };

    if (!content || typeof content !== 'string') {
      return result; // Empty content is valid
    }

    // Check for unmatched braces
    const msdOpen = (content.match(/\{/g) || []).length;
    const msdClose = (content.match(/\}/g) || []).length;
    const haOpen = (content.match(/\{\{/g) || []).length;
    const haClose = (content.match(/\}\}/g) || []).length;

    if (msdOpen !== msdClose) {
      result.valid = false;
      result.errors.push(`Unmatched braces: ${msdOpen} opening '{' vs ${msdClose} closing '}'`);
    }

    if (haOpen !== haClose) {
      result.valid = false;
      result.errors.push(`Unmatched HA template braces: ${haOpen} opening '{{' vs ${haClose} closing '}}'`);
    }

    // Check for nested templates (not supported)
    if (content.includes('{{') && content.includes('{')) {
      const hasNested = /\{\{[^}]*\{[^}]*\}\}/.test(content) ||
                       /\{[^}]*\{\{[^}]*\}/.test(content);
      if (hasNested) {
        result.valid = false;
        result.errors.push('Nested templates are not supported');
      }
    }

    return result;
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache stats
   */
  static getCacheStats() {
    return {
      ...this._stats,
      cacheSize: this._cache.size,
      hitRate: this._stats.cacheHits / (this._stats.cacheHits + this._stats.cacheMisses) || 0
    };
  }

  /**
   * Clear template cache
   */
  static clearCache() {
    this._cache.clear();
    this._stats = {
      cacheHits: 0,
      cacheMisses: 0,
      templatesProcessed: 0,
      lastReset: Date.now()
    };
    cblcarsLog.debug('[TemplateProcessor] Cache cleared');
  }

  /**
   * Enable debug logging for template processing
   *
   * @param {boolean} enabled - Enable or disable debug mode
   */
  static setDebugMode(enabled) {
    this._debugMode = enabled;
    if (enabled) {
      cblcarsLog.info('[TemplateProcessor] Debug mode enabled');
    }
  }
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  window.__templateProcessor = TemplateProcessor;
}
