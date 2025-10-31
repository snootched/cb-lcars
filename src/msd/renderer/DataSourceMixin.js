import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { MsdTemplateEngine } from '../templates/MsdTemplateEngine.js';
import { TemplateProcessor } from '../utils/TemplateProcessor.js';

/**
 * [DataSourceMixin] DataSource integration mixin - reusable DataSource integration methods
 * 🔗 Provides consistent DataSource access, template processing, and value formatting across all overlay renderers
 *
 * Uses TemplateProcessor for unified template detection and parsing (Phase 2)
 */

export class DataSourceMixin {
  /**
   * Resolve content from various sources including DataSource integration
   * @param {Object} source - Source object (overlay, cell, etc.)
   * @param {Object} style - Style configuration
   * @param {string} rendererName - Name of the renderer for logging
   * @returns {string} Resolved content
   */
  static resolveContent(source, style, rendererName = 'Renderer') {
    let content = style.value || source.text || source.content || source.label || '';

    // Check raw configuration if content not found in standard properties
    if (!content && source._raw?.content) {
      content = source._raw.content;
    }
    if (!content && source._raw?.text) {
      content = source._raw.text;
    }
    if (!content && source._raw?.label) {
      content = source._raw.label;
    }

    // Check for data_source reference in raw if not found in main source
    if (!source.data_source && source._raw?.data_source) {
      source.data_source = source._raw.data_source;
    }

    // Enhanced template string processing for DataSource references (only if content has templates)
    // PHASE 2: Use TemplateProcessor for unified template detection
    if (content && typeof content === 'string' && TemplateProcessor.hasTemplates(content)) {
      content = this.processEnhancedTemplateStrings(content, rendererName);
      return content;
    }

    // If we have basic content, return it
    if (content) {
      return content;
    }

    // Direct DataSource integration for dynamic content (only as fallback when no basic content)
    if (source.data_source || style.data_source) {
      const dataSourceContent = this.resolveDataSourceContent(source.data_source || style.data_source, style, rendererName);
      if (dataSourceContent !== null) {
        return dataSourceContent;
      }
    }

    return content; // Return whatever we found (might be empty string)
  }

  /**
   * Resolve content directly from DataSource references
   * @param {string} dataSourceRef - DataSource reference string
   * @param {Object} style - Style configuration for formatting
   * @param {string} rendererName - Name of the renderer for logging
   * @returns {string|null} Resolved content or null if unavailable
   */
  static resolveDataSourceContent(dataSourceRef, style, rendererName = 'Renderer') {
    try {
      const dataSourceManager = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;
      if (!dataSourceManager) {
        // DataSourceManager not available - this is normal during initial rendering
        return null;
      }

      // Parse DataSource reference (support dot notation)
      const { sourceName, dataKey, isTransformation, isAggregation } = this.parseDataSourceReference(dataSourceRef);
      const dataSource = dataSourceManager.getSource(sourceName);

      if (!dataSource) {
        // Not necessarily an error - data sources may be optional or not initialized yet
        cblcarsLog.debug(`[${rendererName}] DataSource '${sourceName}' not found`);
        return `[Source: ${sourceName} not found]`;
      }

      const currentData = dataSource.getCurrentData();
      let value = currentData?.v;

      // Access enhanced data if specified
      if (dataKey && isTransformation && currentData?.transformations) {
        value = currentData.transformations[dataKey];
      } else if (dataKey && isAggregation && currentData?.aggregations) {
        const aggData = currentData.aggregations[dataKey];
        // Handle complex aggregation objects
        if (typeof aggData === 'object' && aggData !== null) {
          if (aggData.avg !== undefined) value = aggData.avg;
          else if (aggData.value !== undefined) value = aggData.value;
          else if (aggData.last !== undefined) value = aggData.last;
          else value = JSON.stringify(aggData);
        } else {
          value = aggData;
        }
      }

      // Format the value
      if (value !== null && value !== undefined) {
        return this.formatDataSourceValue(value, style, currentData);
      }

      return `[${dataSourceRef}: no data]`;

    } catch (error) {
      cblcarsLog.error(`[${rendererName}] ❌ Error resolving DataSource content:`, error);
      return `[DataSource Error: ${error.message}]`;
    }
  }

  /**
   * Parse DataSource reference to support dot notation
   * @param {string} dataSourceRef - Reference like 'source_name' or 'source_name.transformations.key'
   * @returns {Object} Parsed reference details
   */
  static parseDataSourceReference(dataSourceRef) {
    const parts = dataSourceRef.split('.');
    const sourceName = parts[0];

    if (parts.length === 1) {
      return { sourceName, dataKey: null, isTransformation: false, isAggregation: false };
    }

    if (parts.length >= 3) {
      const dataType = parts[1];
      const dataKey = parts.slice(2).join('.');
      return {
        sourceName,
        dataKey,
        isTransformation: dataType === 'transformations',
        isAggregation: dataType === 'aggregations'
      };
    }

    return { sourceName, dataKey: null, isTransformation: false, isAggregation: false };
  }

  /**
   * Format DataSource values with optional formatting
   * @param {any} value - Value to format
   * @param {Object} style - Style configuration containing format options
   * @param {Object} [dataSourceData] - Full DataSource data for unit context
   * @returns {string} Formatted value
   */
  static formatDataSourceValue(value, style, dataSourceData = null) {
    const format = style.value_format || style.format;

    if (typeof format === 'function') {
      return format(value);
    }

    if (typeof format === 'string') {
      if (format.includes('{value')) {
        return format.replace(/\{value(?::([^}]+))?\}/g, (match, formatSpec) => {
          if (formatSpec) {
            return this.applyNumberFormat(value, formatSpec, dataSourceData?.unit_of_measurement);
          }
          return String(value);
        });
      }
      return format.replace('{value}', String(value));
    }

    // Default formatting based on value type
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return String(value);
      } else {
        return value.toFixed(1);
      }
    }

    return String(value);
  }

  /**
   * Apply number formatting with optional unit from metadata
   * @param {number} value - Value to format
   * @param {string} formatSpec - Format specification
   * @param {Object} metadata - DataSource metadata (optional)
   * @returns {string} Formatted value with unit if available
   */
  static applyNumberFormat(value, formatSpec, metadata = null) {
    if (typeof value !== 'number') return String(value);

    let formattedValue;

    // Parse format specifications like ".1f", ".2%", "d", etc.
    if (formatSpec.endsWith('%')) {
      const precision = parseInt(formatSpec.slice(1, -1)) || 0;

      // Check if metadata indicates already a percentage
      if (metadata?.unit_of_measurement === '%') {
        formattedValue = value.toFixed(precision);
      } else {
        formattedValue = (value * 100).toFixed(precision);
      }
      return `${formattedValue}%`;
    }

    if (formatSpec.endsWith('f')) {
      const precision = parseInt(formatSpec.slice(1, -1)) || 1;
      formattedValue = value.toFixed(precision);
    } else if (formatSpec === 'd') {
      formattedValue = Math.round(value).toString();
    } else {
      formattedValue = String(value);
    }

    // ✅ NEW: Append unit from metadata if available
    if (metadata?.unit_of_measurement) {
      return `${formattedValue}${metadata.unit_of_measurement}`;
    }

    return formattedValue;
  }

  /**
   * Enhanced template string processing with DataSource support
   * @param {string} content - Template string with {references}
   * @param {string} rendererName - Name of the renderer for logging
   * @returns {string} Processed content with resolved references
   */
  static processEnhancedTemplateStrings(content, rendererName = 'Renderer') {
    // Use the new unified method with fallback to original content for backwards compatibility
    return this.processEnhancedTemplateStringsWithFallback(content, rendererName, true);
  }

  /**
   * Process template for initial render with unified strategy
   * @param {string} content - Template string with {references}
   * @param {string} rendererName - Name of the renderer for logging
   * @returns {string} Processed content, gracefully handling unavailable DataSources
   */
  static processTemplateForInitialRender(content, rendererName = 'Renderer') {
    if (!content || typeof content !== 'string' || !this._hasTemplateMarkers(content)) {
      return content;
    }
    // Use unified processing for both HA and MSD templates
    const processed = this.processUnifiedTemplateStrings(content, rendererName);
    return processed;
  }

  /**
   * Enhanced template string processing with better fallback handling
   * @param {string} content - Template string with {references}
   * @param {string} rendererName - Name of the renderer for logging
   * @param {boolean} fallbackToOriginal - Whether to return original content if DataSources unavailable
   * @returns {string} Processed content with resolved references
   */
  static processEnhancedTemplateStringsWithFallback(content, rendererName = 'Renderer', fallbackToOriginal = true) {
    try {
      const dataSourceManager = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;
      if (!dataSourceManager) {
        return fallbackToOriginal ? content : null;
      }

      let hasUnresolvedTemplates = false;
      const processedContent = content.replace(/\{([^}]+)\}/g, (match, reference) => {
        try {
          const [dataSourceRef, formatSpec] = reference.split(':');
          const cleanRef = dataSourceRef.trim();

          const { sourceName, dataKey, isTransformation, isAggregation } = this.parseDataSourceReference(cleanRef);
          const dataSource = dataSourceManager.getSource(sourceName);

          if (!dataSource) {
            // Not necessarily an error - data sources may be optional or not initialized yet
            cblcarsLog.debug(`[${rendererName}] DataSource '${sourceName}' not found`);
            hasUnresolvedTemplates = true;
            return fallbackToOriginal ? match : `[Source: ${sourceName} not found]`;
          }

          const currentData = dataSource.getCurrentData();
          let value = currentData?.v;

          // Access enhanced data
          if (dataKey && isTransformation && currentData?.transformations) {
            value = currentData.transformations[dataKey];
          } else if (dataKey && isAggregation && currentData?.aggregations) {
            // ✅ FIXED: Handle nested aggregation paths properly
            // Split dataKey to handle paths like "heating_time.current"
            const pathParts = dataKey.split('.');
            const aggKey = pathParts[0]; // "heating_time"
            const aggData = currentData.aggregations[aggKey];

            if (aggData === null || aggData === undefined) {
              cblcarsLog.warn(`[${rendererName}] 🔗 Aggregation '${aggKey}' not found in ${sourceName}`);
              hasUnresolvedTemplates = true;
              return fallbackToOriginal ? match : `[No data: ${reference}]`;
            }

            // If there are nested keys (e.g., "current" in "heating_time.current")
            if (pathParts.length > 1) {
              const nestedPath = pathParts.slice(1).join('.');
              value = this.getNestedValue(aggData, nestedPath);
            } else {
              // No nested path - handle the aggregation object
              if (typeof aggData === 'object' && aggData !== null) {
                // Try common aggregation result properties
                if (aggData.avg !== undefined) value = aggData.avg;
                else if (aggData.value !== undefined) value = aggData.value;
                else if (aggData.last !== undefined) value = aggData.last;
                else if (aggData.current !== undefined) value = aggData.current;
                else if (aggData.direction !== undefined) value = aggData.direction;
                else value = JSON.stringify(aggData);
              } else {
                value = aggData;
              }
            }
          }

          if (value === null || value === undefined) {
            cblcarsLog.warn(`[${rendererName}] 🔗 Template value not found: ${reference}`);
            hasUnresolvedTemplates = true;
            return fallbackToOriginal ? match : `[No data: ${reference}]`;
          }

          // Apply formatting if specified
          if (formatSpec) {
            return this.applyNumberFormat(
              value,
              formatSpec.trim(),
              currentData?.metadata  // ✅ NEW: Pass metadata
            );
          }

          return String(value);

        } catch (error) {
          cblcarsLog.error(`[${rendererName}] ❌ Template processing error for '${reference}':`, error);
          hasUnresolvedTemplates = true;
          return fallbackToOriginal ? match : `[Error: ${reference}]`;
        }
      });

      // Log whether templates were successfully resolved
      if (!hasUnresolvedTemplates && processedContent !== content) {
        cblcarsLog.debug(`[${rendererName}] 🔗 Successfully resolved all templates`);
      }

      return processedContent;

    } catch (error) {
      cblcarsLog.error(`[${rendererName}] ❌ Enhanced template processing failed:`, error);
      return fallbackToOriginal ? content : null;
    }
  }

  /**
   * Process unified template strings supporting both HA and MSD syntax
   * @param {string} content - Template string with mixed {references} and {{HA templates}}
   * @param {string} rendererName - Name of the renderer for logging
   * @returns {string} Processed content with resolved references
   */
  static processUnifiedTemplateStrings(content, rendererName = 'Renderer') {
    try {
      const cacheKey = `${rendererName}-${content}`;
      let processedContent = content;

      // Step 1: Process HA templates first ({{...}}) using MsdTemplateEngine
      if (processedContent.includes('{{') && processedContent.includes('}}')) {
        processedContent = this._processHATemplates(processedContent, rendererName, cacheKey);
      }

      // Step 2: Mask any remaining HA blocks so MSD parser won't touch them
      const { text: maskedText, map } = this._maskHATemplates(processedContent);

      // Step 3: Process MSD DataSource templates ({...}) only on masked text
      let afterMsd = maskedText;
      if (afterMsd.includes('{') && !afterMsd.includes('{{')) {
        afterMsd = this.processEnhancedTemplateStringsWithFallback(afterMsd, rendererName, true);
      }

      // Step 4: Restore HA blocks exactly as they were
      processedContent = this._unmaskHATemplates(afterMsd, map);

      return processedContent;

    } catch (error) {
      cblcarsLog.error(`[${rendererName}] ❌ Unified template processing failed:`, error);
      return content;
    }
  }

  /**
   * Process Home Assistant template syntax using MsdTemplateEngine
   * Skips evaluation (and logs) if hass states are not available yet.
   * @private
   */
  static _processHATemplates(content, rendererName, cacheKey) {
    try {
      const templateEngine = this._getTemplateEngine();
      if (!templateEngine) return content;

      // EARLY EXIT: avoid warnings if HASS not yet ready
      const hassStates = templateEngine.getHassStates?.() || null;
      if (!hassStates) {
        return content;
      }

      // Use cache key for better performance
      const templateId = cacheKey || `${rendererName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Compile and evaluate the template
      const compiled = templateEngine.compileTemplate(content, templateId);
      const result = templateEngine.evaluateTemplate(compiled, hassStates);

      cblcarsLog.debug(`[${rendererName}] 🏠 HA template processed:`, {
        original: content,
        result: result,
        entityDependencies: compiled.entityDependencies
      });

      return result;

    } catch (error) {
      cblcarsLog.error(`[${rendererName}] ❌ HA template processing error:`, error);
      return content;
    }
  }

  /**
   * Get MsdTemplateEngine instance with improved initialization
   * @private
   * @returns {Object|null} MsdTemplateEngine instance or null
   */
  static _getTemplateEngine() {
    if (typeof window !== 'undefined' && window.__msdTemplateEngine) {
      return window.__msdTemplateEngine;
    }
    try {
      const engine = new MsdTemplateEngine();
      if (typeof window !== 'undefined') {
        window.__msdTemplateEngine = engine;
      }
      return engine;
    } catch (error) {
      cblcarsLog.error('[DataSourceMixin] Failed to create MsdTemplateEngine instance:', error);
      return null;
    }
  }

  /**
   * Extract all template dependencies (both MSD DataSources and HA entities)
   * PHASE 2: Unified dependency extraction using TemplateProcessor
   *
   * @param {string} content - Content with templates
   * @returns {Array<string>} Array of entity/DataSource IDs
   *
   * @example
   * getTemplateDependencies('{cpu_temp} is {{states("sensor.temp")}}')
   * // Returns: ['cpu_temp', 'sensor.temp']
   */
  static getTemplateDependencies(content) {
    return TemplateProcessor.extractEntityDependencies(content);
  }

  /**
   * Extract HA entity dependencies from template content
   * @deprecated Use getTemplateDependencies() for unified extraction
   */
  static extractHAEntityDependencies(content) {
    try {
      if (!content || typeof content !== 'string' || !(content.includes('{{') && content.includes('}}'))) {
        return [];
      }
      const engine = this._getTemplateEngine();
      if (!engine) return [];
      const tempId = `deps-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const compiled = engine.compileTemplate(content, tempId);
      const deps = Array.isArray(compiled?.entityDependencies) ? compiled.entityDependencies : [];
      try { engine.compiledTemplates?.delete?.(tempId); } catch (_) {}
      return deps;
    } catch (err) {
      cblcarsLog.error('[DataSourceMixin] Error extracting HA entity dependencies:', err);
      return [];
    }
  }

  /**
   * Detect if content contains either MSD or HA template markers
   * PHASE 2: Delegated to TemplateProcessor for unified detection
   * @private
   */
  static _hasTemplateMarkers(content) {
    return TemplateProcessor.hasTemplates(content);
  }

  /**
   * Mask all HA {{...}} blocks to placeholders so MSD parser won't touch them.
   * @private
   */
  static _maskHATemplates(str) {
    if (typeof str !== 'string' || !str.includes('{{')) {
      return { text: str, map: [] };
    }
    const map = [];
    let idx = 0;
    const text = str.replace(/\{\{[\s\S]*?\}\}/g, (m) => {
      const token = `__HA_BLOCK_${idx++}__`;
      map.push({ token, value: m });
      return token;
    });
    return { text, map };
  }

  /**
   * Restore masked HA placeholders back to their original {{...}} content.
   * @private
   */
  static _unmaskHATemplates(str, map) {
    if (!Array.isArray(map) || map.length === 0 || typeof str !== 'string') return str;
    let out = str;
    for (const { token, value } of map) {
      out = out.split(token).join(value);
    }
    return out;
  }

  /**
   * Get nested value from object using dot notation
   * @param {Object} obj - Object to traverse
   * @param {string} path - Dot-separated path
   * @returns {any} Nested value or undefined
   */
  static getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Check if DataSourceManager is available
   * @returns {Object|null} DataSourceManager instance or null
   */
  static getDataSourceManager() {
    return window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager || null;
  }

  /**
   * Get available DataSource names
   * @returns {Array<string>} Array of DataSource names
   */
  static getAvailableDataSources() {
    const dsm = this.getDataSourceManager();
    return dsm ? Array.from(dsm.sources.keys()) : [];
  }
}

// Export for use in renderers
export default DataSourceMixin;