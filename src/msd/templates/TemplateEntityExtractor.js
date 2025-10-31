import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Utility for extracting entity references from MSD and Home Assistant templates
 * Supports both MSD {entity_id} and HA {{states('entity_id')}} template formats
 */
export class TemplateEntityExtractor {
  // JavaScript keywords to exclude from entity detection
  static JS_KEYWORDS = new Set([
    'true', 'false', 'null', 'undefined', 'this', 'new', 'function', 'return',
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'var', 'let', 'const', 'class', 'extends', 'import', 'export', 'default'
  ]);

  /**
   * Extract all entity references from template content
   * @param {string} content - Template content to parse
   * @returns {Set<string>} Set of entity IDs found in templates
   */
  static extractEntityReferences(content) {
    if (!content || typeof content !== 'string') {
      return new Set();
    }

    const entities = new Set();

    try {
      // Extract from MSD templates: {entity_id}
      this._extractEntitiesFromExpression(content).forEach(entity => entities.add(entity));

      // Extract from HA templates: {{states('entity_id')}}
      this._extractEntitiesFromHATemplate(content).forEach(entity => entities.add(entity));

      cblcarsLog.trace('[TemplateEntityExtractor] Extracted entities from content:', Array.from(entities));
    } catch (error) {
      cblcarsLog.error('[TemplateEntityExtractor] Error extracting entities:', error);
    }

    return entities;
  }

  /**
   * Extract entity references from an overlay configuration
   * @param {Object} overlay - Overlay configuration object
   * @returns {Set<string>} Set of entity IDs found in overlay templates
   */
  static extractFromOverlay(overlay) {
    if (!overlay || typeof overlay !== 'object') {
      return new Set();
    }

    const entities = new Set();
    const templateProperties = ['content', 'text', 'value_format', 'label'];

    try {
      // Extract from standard template properties
      templateProperties.forEach(prop => {
        if (overlay[prop]) {
          this.extractEntityReferences(overlay[prop]).forEach(entity => entities.add(entity));
        }
      });

      // Extract from status grid cells
      if (overlay.type === 'status_grid' && overlay.cells) {
        overlay.cells.forEach(cell => {
          templateProperties.forEach(prop => {
            if (cell[prop]) {
              this.extractEntityReferences(cell[prop]).forEach(entity => entities.add(entity));
            }
          });
        });
      }

      cblcarsLog.trace(`[TemplateEntityExtractor] Extracted entities from overlay ${overlay.id}:`, Array.from(entities));
    } catch (error) {
      cblcarsLog.error(`[TemplateEntityExtractor] Error extracting entities from overlay ${overlay.id}:`, error);
    }

    return entities;
  }

  /**
   * Extract entities from MSD expression templates: {entity_id}
   * @param {string} expression - Expression to parse
   * @returns {Set<string>} Set of entity IDs
   * @private
   */
  static _extractEntitiesFromExpression(expression) {
    const entities = new Set();

    try {
      // Match MSD template format: {something}
      const msdMatches = expression.match(/\{([^}]+)\}/g);
      if (msdMatches) {
        msdMatches.forEach(match => {
          const content = match.slice(1, -1).trim(); // Remove { }

          // Skip DataSource references
          if (this._isDataSourceReference(content)) {
            return;
          }

          // Check if it looks like an entity ID
          if (this._looksLikeEntityId(content)) {
            entities.add(content);
          }
        });
      }
    } catch (error) {
      cblcarsLog.error('[TemplateEntityExtractor] Error in _extractEntitiesFromExpression:', error);
    }

    return entities;
  }

  /**
   * Extract entities from Home Assistant template format: {{states('entity_id')}}
   * @param {string} template - HA template to parse
   * @returns {Set<string>} Set of entity IDs
   * @private
   */
  static _extractEntitiesFromHATemplate(template) {
    const entities = new Set();

    try {
      // Match HA template functions that reference entities
      const patterns = [
        /states\(['"]([^'"]+)['"]\)/g,           // states('entity_id')
        /state_attr\(['"]([^'"]+)['"],\s*['"][^'"]+['"]\)/g, // state_attr('entity_id', 'attr')
        /is_state\(['"]([^'"]+)['"],\s*['"][^'"]*['"]\)/g,   // is_state('entity_id', 'state')
        /has_value\(['"]([^'"]+)['"]\)/g,        // has_value('entity_id')
        /is_state_attr\(['"]([^'"]+)['"],\s*['"][^'"]+['"],\s*['"][^'"]*['"]\)/g // is_state_attr('entity_id', 'attr', 'value')
      ];

      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(template)) !== null) {
          const entityId = match[1];
          if (this._looksLikeEntityId(entityId)) {
            entities.add(entityId);
          }
        }
      });
    } catch (error) {
      cblcarsLog.error('[TemplateEntityExtractor] Error in _extractEntitiesFromHATemplate:', error);
    }

    return entities;
  }

  /**
   * Check if an expression references a DataSource
   * @param {string} expression - Expression to check
   * @returns {boolean} True if this is a DataSource reference
   * @private
   */
  static _isDataSourceReference(expression) {
    return expression.includes('.transformations.') ||
           expression.includes('.aggregations.') ||
           expression.includes('dataSource.');
  }

  /**
   * Check if a string looks like a valid entity ID
   * @param {string} str - String to validate
   * @returns {boolean} True if it looks like an entity ID
   * @private
   */
  static _looksLikeEntityId(str) {
    if (!str || typeof str !== 'string') {
      return false;
    }

    // Skip JavaScript keywords
    if (this.JS_KEYWORDS.has(str.toLowerCase())) {
      return false;
    }

    // Entity ID pattern: domain.entity_name (can contain underscores, numbers)
    const entityPattern = /^[a-z][a-z0-9_]*\.[a-z0-9_]+$/i;
    return entityPattern.test(str);
  }
}
