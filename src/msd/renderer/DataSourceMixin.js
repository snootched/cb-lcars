/**
 * DataSource Integration Mixin - Reusable DataSource integration methods
 * Provides consistent DataSource access, template processing, and value formatting
 * across all overlay renderers.
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
    if (content && typeof content === 'string' && content.includes('{')) {
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
      const dataSourceManager = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
      if (!dataSourceManager) {
        // DataSourceManager not available - this is normal during initial rendering
        return null;
      }

      // Parse DataSource reference (support dot notation)
      const { sourceName, dataKey, isTransformation, isAggregation } = this.parseDataSourceReference(dataSourceRef);
      const dataSource = dataSourceManager.getSource(sourceName);

      if (!dataSource) {
        console.warn(`[${rendererName}] DataSource '${sourceName}' not found`);
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
      console.error(`[${rendererName}] Error resolving DataSource content:`, error);
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
   * Apply number formatting specifications with unit-aware intelligence
   * @param {number} value - Numeric value to format
   * @param {string} formatSpec - Format specification like ".1f", ".2%", "d"
   * @param {string} [unitOfMeasurement] - Original entity's unit_of_measurement for intelligent formatting
   * @returns {string} Formatted value
   */
  static applyNumberFormat(value, formatSpec, unitOfMeasurement) {
    if (typeof value !== 'number') return String(value);

    // Parse format specifications like ".1f", ".2%", "d", etc.
    if (formatSpec.endsWith('%')) {
      const precision = parseInt(formatSpec.slice(1, -1)) || 0;

      // UNIT-AWARE: Check if the source entity already has % units
      if (unitOfMeasurement === '%') {
        // Already a percentage (0-100), don't multiply by 100
        console.log(`[DataSourceMixin] Unit-aware formatting: ${value} with unit="${unitOfMeasurement}" → ${value.toFixed(precision)}% (no conversion)`);
        return `${value.toFixed(precision)}%`;
      } else {
        // Decimal value (0.0-1.0) or other unit, multiply by 100
        console.log(`[DataSourceMixin] Unit-aware formatting: ${value} with unit="${unitOfMeasurement || 'none'}" → ${(value * 100).toFixed(precision)}% (×100 conversion)`);
        return `${(value * 100).toFixed(precision)}%`;
      }
    }

    if (formatSpec.endsWith('f')) {
      const precision = parseInt(formatSpec.slice(1, -1)) || 1;
      return value.toFixed(precision);
    }

    if (formatSpec === 'd') {
      return Math.round(value).toString();
    }

    // Fallback
    return String(value);
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
    if (!content || typeof content !== 'string' || !content.includes('{')) {
      return content;
    }

    console.log(`[${rendererName}] Processing template for initial render: "${content}"`);

    // Try to process templates, but gracefully fall back to original content
    const processed = this.processEnhancedTemplateStringsWithFallback(content, rendererName, true);

    // If processing didn't change the content, DataSources might not be ready
    if (processed === content) {
      console.log(`[${rendererName}] Templates not resolved during initial render, will update when DataSources become available`);
    }

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
      const dataSourceManager = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
      if (!dataSourceManager) {
        // DataSourceManager not available - this is normal during initial rendering
        console.log(`[${rendererName}] DataSourceManager not available, ${fallbackToOriginal ? 'returning original content' : 'returning null'}`);
        return fallbackToOriginal ? content : null;
      }

      // Enhanced template pattern to capture DataSource references and formatting
      let hasUnresolvedTemplates = false;
      const processedContent = content.replace(/\{([^}]+)\}/g, (match, reference) => {
        try {
          // Parse reference and optional formatting: {source.transformations.key:.2f}
          const [dataSourceRef, formatSpec] = reference.split(':');
          const cleanRef = dataSourceRef.trim();

          const { sourceName, dataKey, isTransformation, isAggregation } = this.parseDataSourceReference(cleanRef);
          const dataSource = dataSourceManager.getSource(sourceName);

          if (!dataSource) {
            console.warn(`[${rendererName}] DataSource '${sourceName}' not found`);
            hasUnresolvedTemplates = true;
            return fallbackToOriginal ? match : `[Source: ${sourceName} not found]`;
          }

          const currentData = dataSource.getCurrentData();
          let value = currentData?.v;

          // Access enhanced data
          if (dataKey && isTransformation && currentData?.transformations) {
            value = currentData.transformations[dataKey];
          } else if (dataKey && isAggregation && currentData?.aggregations) {
            const aggData = currentData.aggregations[dataKey];
            if (typeof aggData === 'object' && aggData !== null) {
              // Handle nested object access
              const nestedKeys = dataKey.split('.');
              if (nestedKeys.length > 1) {
                const baseKey = nestedKeys[0];
                const nestedKey = nestedKeys.slice(1).join('.');
                const baseData = currentData.aggregations[baseKey];
                if (baseData && typeof baseData === 'object') {
                  value = this.getNestedValue(baseData, nestedKey);
                }
              } else {
                // Standard aggregation object handling
                if (aggData.avg !== undefined) value = aggData.avg;
                else if (aggData.value !== undefined) value = aggData.value;
                else if (aggData.last !== undefined) value = aggData.last;
                else if (aggData.direction !== undefined) value = aggData.direction;
                else value = JSON.stringify(aggData);
              }
            } else {
              value = aggData;
            }
          }

          if (value === null || value === undefined) {
            console.warn(`[${rendererName}] No value found for reference '${reference}'`);
            hasUnresolvedTemplates = true;
            return fallbackToOriginal ? match : `[No data: ${reference}]`;
          }

          // Apply formatting if specified
          if (formatSpec) {
            return this.applyNumberFormat(value, formatSpec.trim(), currentData?.unit_of_measurement);
          }

          return String(value);

        } catch (error) {
          console.error(`[${rendererName}] Template processing error for '${reference}':`, error);
          hasUnresolvedTemplates = true;
          return fallbackToOriginal ? match : `[Error: ${reference}]`;
        }
      });

      // Log whether templates were successfully resolved
      if (!hasUnresolvedTemplates && processedContent !== content) {
        console.log(`[${rendererName}] Successfully resolved all templates in: "${content}" → "${processedContent}"`);
      }

      return processedContent;

    } catch (error) {
      console.error(`[${rendererName}] Enhanced template processing failed:`, error);
      return fallbackToOriginal ? content : null;
    }
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
    return window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager || null;
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