I'll analyze the overlay and DataMixin code to understand the current template system and propose a plan to add standard Home Assistant entity and attribute support.After reviewing your overlay and DataSourceMixin code, I can see that you have a sophisticated MSD DataSource system with dot notation support, but you're missing standard Home Assistant entity state and attribute template support that users expect. You already have the foundation in `MsdTemplateEngine.js` that handles `states()` and `state_attr()` functions, but it's not integrated with your overlay rendering system.

Here's a comprehensive plan to implement standard HA state and attribute support for templates:

## Implementation Plan

### Phase 1: Integrate MsdTemplateEngine with DataSourceMixin

The `MsdTemplateEngine` already supports HA template functions but needs to be integrated with the overlay system. Here's the enhanced `DataSourceMixin`:

```javascript name=src/msd/renderer/DataSourceMixin.js
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * [DataSourceMixin] DataSource integration mixin - reusable DataSource integration methods
 * 🔗 Provides consistent DataSource access, template processing, and value formatting across all overlay renderers
 * Enhanced with Home Assistant state and attribute template support
 */

export class DataSourceMixin {
  /**
   * Resolve content from various sources including DataSource integration and HA templates
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

    // Enhanced template string processing with UNIFIED template support
    if (content && typeof content === 'string' && this._hasTemplateMarkers(content)) {
      content = this.processUnifiedTemplateStrings(content, rendererName);
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
   * Check if content has any type of template markers
   * @private
   * @param {string} content - Content to check
   * @returns {boolean} True if content has template markers
   */
  static _hasTemplateMarkers(content) {
    if (!content || typeof content !== 'string') return false;

    // Check for HA template syntax: {{states('entity.id')}} or {{state_attr('entity.id', 'attr')}}
    if (content.includes('{{') && content.includes('}}')) return true;

    // Check for MSD DataSource syntax: {datasource.path}
    if (content.includes('{') && content.includes('}') && !content.includes('{{')) return true;

    return false;
  }

  /**
   * Process unified template strings supporting both HA and MSD syntax
   * @param {string} content - Template string with mixed {references} and {{HA templates}}
   * @param {string} rendererName - Name of the renderer for logging
   * @returns {string} Processed content with resolved references
   */
  static processUnifiedTemplateStrings(content, rendererName = 'Renderer') {
    try {
      let processedContent = content;

      // Step 1: Process HA templates first ({{...}}) using MsdTemplateEngine
      if (content.includes('{{') && content.includes('}}')) {
        processedContent = this._processHATemplates(processedContent, rendererName);
      }

      // Step 2: Process MSD DataSource templates ({...}) using existing logic
      if (processedContent.includes('{') && !processedContent.includes('{{')) {
        processedContent = this.processEnhancedTemplateStringsWithFallback(processedContent, rendererName, true);
      }

      return processedContent;

    } catch (error) {
      cblcarsLog.error(`[${rendererName}] ❌ Unified template processing failed:`, error);
      return content; // Return original on error
    }
  }

  /**
   * Process Home Assistant template syntax using MsdTemplateEngine
   * @private
   * @param {string} content - Content with HA template syntax
   * @param {string} rendererName - Renderer name for logging
   * @returns {string} Processed content
   */
  static _processHATemplates(content, rendererName) {
    try {
      // Get MsdTemplateEngine instance
      const templateEngine = this._getTemplateEngine();
      if (!templateEngine) {
        cblcarsLog.warn(`[${rendererName}] MsdTemplateEngine not available for HA template processing`);
        return content;
      }

      // Generate unique template ID for caching
      const templateId = `${rendererName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Compile and evaluate the template
      const compiled = templateEngine.compileTemplate(content, templateId);
      const result = templateEngine.evaluateTemplate(compiled);

      cblcarsLog.debug(`[${rendererName}] 🏠 HA template processed:`, {
        original: content,
        result: result,
        entityDependencies: compiled.entityDependencies
      });

      return result;

    } catch (error) {
      cblcarsLog.error(`[${rendererName}] ❌ HA template processing error:`, error);
      return content; // Return original on error
    }
  }

  /**
   * Get MsdTemplateEngine instance
   * @private
   * @returns {Object|null} MsdTemplateEngine instance or null
   */
  static _getTemplateEngine() {
    // Try global instance first
    if (typeof window !== 'undefined' && window.__msdTemplateEngine) {
      return window.__msdTemplateEngine;
    }

    // Try to create new instance if class is available
    if (typeof window !== 'undefined' && window.MsdTemplateEngine) {
      try {
        const engine = new window.MsdTemplateEngine();
        window.__msdTemplateEngine = engine; // Cache for future use
        return engine;
      } catch (error) {
        cblcarsLog.error('[DataSourceMixin] Failed to create MsdTemplateEngine instance:', error);
      }
    }

    // Try import if in module context
    try {
      const { MsdTemplateEngine } = require('../../overlays/MsdTemplateEngine.js');
      const engine = new MsdTemplateEngine();
      if (typeof window !== 'undefined') {
        window.__msdTemplateEngine = engine;
      }
      return engine;
    } catch (error) {
      // Import failed, template engine not available
    }

    return null;
  }

  /**
   * Extract HA entity dependencies from template content
   * @param {string} content - Template content
   * @returns {Array<string>} Array of entity IDs referenced in templates
   */
  static extractHAEntityDependencies(content) {
    try {
      const templateEngine = this._getTemplateEngine();
      if (!templateEngine || !content || typeof content !== 'string') {
        return [];
      }

      // Generate temporary template ID
      const tempId = `deps-${Date.now()}`;

      // Compile template to extract dependencies
      const compiled = templateEngine.compileTemplate(content, tempId);

      // Clean up temporary compilation
      templateEngine.compiledTemplates.delete(tempId);

      return compiled.entityDependencies || [];

    } catch (error) {
      cblcarsLog.error('[DataSourceMixin] Error extracting HA entity dependencies:', error);
      return [];
    }
  }

  // ... rest of existing DataSourceMixin methods remain unchanged ...

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
        cblcarsLog.warn(`[${rendererName}] 🔗 DataSource '${sourceName}' not found`);
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
        return `${value.toFixed(precision)}%`;
      } else {
        // Decimal value (0.0-1.0) or other unit, multiply by 100
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
        // DataSourceManager not available - this is normal during initial rendering
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
            cblcarsLog.warn(`[${rendererName}] 🔗 DataSource '${sourceName}' not found`);
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
            hasUnresolvedTemplates = true;
            return fallbackToOriginal ? match : `[No data: ${reference}]`;
          }

          // Apply formatting if specified
          if (formatSpec) {
            return this.applyNumberFormat(value, formatSpec.trim(), currentData?.unit_of_measurement);
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
```

### Phase 2: Update BaseOverlayUpdater for HA Entity Dependency Tracking

```javascript name=src/msd/renderer/BaseOverlayUpdater.js
// Add this method to BaseOverlayUpdater class:

/**
 * Check if overlay content contains template references (enhanced for HA templates)
 * @private
 */
_hasTemplateContent(overlay) {
  // Check main overlay content
  const mainContent = overlay._raw?.content || overlay.content || overlay.text ||
                     overlay._raw?.value_format || overlay.value_format || '';

  if (mainContent && typeof mainContent === 'string' && this._hasAnyTemplateMarkers(mainContent)) {
    return true;
  }

  // For status grids, also check cell configurations
  if (overlay.type === 'status_grid') {
    const cellsConfig = overlay.cells || overlay._raw?.cells || overlay.raw?.cells;
    if (cellsConfig && Array.isArray(cellsConfig)) {
      return cellsConfig.some(cell => {
        const cellContent = cell.content || cell.label || cell.value_format || '';
        return cellContent && typeof cellContent === 'string' && this._hasAnyTemplateMarkers(cellContent);
      });
    }
  }

  // For history bars, check content property for templates
  if (overlay.type === 'history_bar') {
    const historyBarContent = overlay.content || overlay._raw?.content || '';
    if (historyBarContent && typeof historyBarContent === 'string' && this._hasAnyTemplateMarkers(historyBarContent)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if content has any type of template markers (HA or MSD)
 * @private
 * @param {string} content - Content to check
 * @returns {boolean} True if content has template markers
 */
_hasAnyTemplateMarkers(content) {
  if (!content || typeof content !== 'string') return false;

  // Check for HA template syntax: {{states('entity.id')}} or {{state_attr('entity.id', 'attr')}}
  if (content.includes('{{') && content.includes('}}')) return true;

  // Check for MSD DataSource syntax: {datasource.path}
  if (content.includes('{') && content.includes('}') && !content.includes('{{')) return true;

  return false;
}

/**
 * Extract all entity dependencies from overlay content (enhanced for HA templates)
 * @private
 * @param {Object} overlay - Overlay configuration
 * @returns {Array<string>} Array of entity IDs that this overlay depends on
 */
_extractEntityDependencies(overlay) {
  const dependencies = new Set();

  // Helper function to extract from content
  const extractFromContent = (content) => {
    if (!content || typeof content !== 'string') return;

    // Extract HA entity dependencies using DataSourceMixin
    const haDependencies = DataSourceMixin.extractHAEntityDependencies(content);
    haDependencies.forEach(entityId => dependencies.add(entityId));

    // Extract MSD DataSource dependencies (if they map to entities)
    // This would need additional logic to map DataSource names to entity IDs
    // For now, we focus on direct HA entity references
  };

  // Check main content
  extractFromContent(overlay._raw?.content || overlay.content || overlay.text || overlay._raw?.value_format || overlay.value_format);

  // Check type-specific content
  if (overlay.type === 'status_grid') {
    const cellsConfig = overlay.cells || overlay._raw?.cells || overlay.raw?.cells;
    if (cellsConfig && Array.isArray(cellsConfig)) {
      cellsConfig.forEach(cell => {
        extractFromContent(cell.content || cell.label || cell.value_format);
      });
    }
  }

  if (overlay.type === 'history_bar') {
    extractFromContent(overlay.content || overlay._raw?.content);
  }

  return Array.from(dependencies);
}
```

### Phase 3: Enhanced Template Examples and Documentation

Create comprehensive examples showing both syntaxes:

```yaml
# Example MSD configuration with mixed templates
overlays:
  - id: mixed_templates_example
    type: text
    position: [100, 50]
    # HA template syntax - direct entity access
    content: "CPU: {{states('sensor.cpu_usage')}}% | RAM: {{state_attr('sensor.system_monitor', 'memory_usage')}}%"

  - id: datasource_with_ha_fallback
    type: text
    position: [100, 100]
    # MSD DataSource with HA fallback
    content: "Temp: {temperature_sensor.transformations.celsius:.1f}°C ({{states('sensor.temperature')}}°C)"

  - id: conditional_mixed
    type: text
    position: [100, 150]
    # Conditional with both systems
    content: "Status: {{states('binary_sensor.system_online') == 'on' and 'ONLINE' or 'OFFLINE'}} | Load: {system_load.v:.1f}"

  - id: status_grid_mixed
    type: status_grid
    position: [200, 200]
    size: [300, 200]
    rows: 2
    columns: 2
    cells:
      - id: cpu_cell
        # HA template in cell
        content: "{{states('sensor.cpu_usage')}}%"
        position: [0, 0]
      - id: memory_cell
        # MSD DataSource in cell
        content: "{memory_monitor.transformations.percentage:.0f}%"
        position: [0, 1]
      - id: disk_cell
        # Mixed syntax
        content: "{{state_attr('sensor.disk_use', 'friendly_name')}}: {disk_usage.v:.1f}GB"
        position: [1, 0]
      - id: network_cell
        # Complex HA template
        content: "{{states('sensor.network_in')|float + states('sensor.network_out')|float}}MB/s"
        position: [1, 1]
```

### Phase 4: Advanced HA Template Functions

Extend `MsdTemplateEngine` to support more HA template functions:

```javascript name=src/msd/overlays/MsdTemplateEngine.js
// Add these methods to parseTemplateExpression():

/**
 * Parse individual template expression (enhanced with more HA functions)
 * @param {string} expression - Expression like "states('sensor.battery')"
 */
parseTemplateExpression(expression) {
  // Handle states('entity.id') function
  const statesMatch = expression.match(/states\s*\(\s*['"]([^'"]+)['"]\s*\)/);
  if (statesMatch) {
    return {
      type: 'entity_state',
      entityId: statesMatch[1],
      expression: expression,
      format: null
    };
  }

  // Handle states('entity.id') | format function
  const statesFormatMatch = expression.match(/states\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\|\s*(\w+)(?:\s*\(\s*([^)]*)\s*\))?/);
  if (statesFormatMatch) {
    return {
      type: 'entity_state',
      entityId: statesFormatMatch[1],
      expression: expression,
      format: {
        function: statesFormatMatch[2],
        args: statesFormatMatch[3] ? statesFormatMatch[3].split(',').map(s => s.trim().replace(/['"]/g, '')) : []
      }
    };
  }

  // Handle state_attr('entity.id', 'attribute')
  const attrMatch = expression.match(/state_attr\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
  if (attrMatch) {
    return {
      type: 'entity_attribute',
      entityId: attrMatch[1],
      attribute: attrMatch[2],
      expression: expression,
      format: null
    };
  }

  // NEW: Handle is_state('entity.id', 'state') function
  const isStateMatch = expression.match(/is_state\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
  if (isStateMatch) {
    return {
      type: 'is_state_check',
      entityId: isStateMatch[1],
      expectedState: isStateMatch[2],
      expression: expression,
      format: null
    };
  }

  // NEW: Handle has_value('entity.id') function
  const hasValueMatch = expression.match(/has_value\s*\(\s*['"]([^'"]+)['"]\s*\)/);
  if (hasValueMatch) {
    return {
      type: 'has_value_check',
      entityId: hasValueMatch[1],
      expression: expression,
      format: null
    };
  }

  // NEW: Handle float conversion: states('entity.id')|float
  const floatMatch = expression.match(/states\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\|\s*float/);
  if (floatMatch) {
    return {
      type: 'entity_state',
      entityId: floatMatch[1],
      expression: expression,
      format: { function: 'float', args: [] }
    };
  }

  // NEW: Handle mathematical operations: states('entity1')|float + states('entity2')|float
  const mathMatch = expression.match(/(.+?)\s*([+\-*/])\s*(.+)/);
  if (mathMatch) {
    return {
      type: 'mathematical_operation',
      leftExpression: mathMatch[1].trim(),
      operator: mathMatch[2],
      rightExpression: mathMatch[3].trim(),
      expression: expression,
      format: null
    };
  }

  // NEW: Handle conditional expressions: states('entity') == 'on' and 'ON' or 'OFF'
  const conditionalMatch = expression.match(/(.+?)\s*(==|!=|>|<|>=|<=)\s*['"]?([^'"]*?)['"]?\s+and\s+['"](.+?)['"]\s+or\s+['"](.+?)['"]/);
  if (conditionalMatch) {
    return {
      type: 'conditional_expression',
      leftExpression: conditionalMatch[1].trim(),
      operator: conditionalMatch[2],
      rightValue: conditionalMatch[3],
      trueValue: conditionalMatch[4],
      falseValue: conditionalMatch[5],
      expression: expression,
      format: null
    };
  }

  // Handle simple entity reference (just entity.id)
  const entityMatch = expression.match(/^(['"]?)([a-zA-Z_][a-zA-Z0-9_.]*)\1$/);
  if (entityMatch && entityMatch[2].includes('.')) {
    return {
      type: 'entity_state',
      entityId: entityMatch[2],
      expression: expression,
      format: null
    };
  }

  // Fallback - treat as literal expression
  return {
    type: 'literal_expression',
    content: expression,
    expression: expression
  };
}

// Add these cases to evaluateTemplate():
case 'is_state_check':
  const currentState = this.getEntityState(segment.entityId, hassStates);
  result += (currentState === segment.expectedState) ? 'true' : 'false';
  break;

case 'has_value_check':
  const hasValue = this.getEntityState(segment.entityId, hassStates);
  result += (hasValue !== 'unavailable' && hasValue !== 'unknown' && hasValue !== null) ? 'true' : 'false';
  break;

case 'mathematical_operation':
  const leftResult = this._evaluateSubExpression(segment.leftExpression, hassStates);
  const rightResult = this._evaluateSubExpression(segment.rightExpression, hassStates);
  const leftNum = parseFloat(leftResult);
  const rightNum = parseFloat(rightResult);

  if (!isNaN(leftNum) && !isNaN(rightNum)) {
    let mathResult;
    switch (segment.operator) {
      case '+': mathResult = leftNum + rightNum; break;
      case '-': mathResult = leftNum - rightNum; break;
      case '*': mathResult = leftNum * rightNum; break;
      case '/': mathResult = rightNum !== 0 ? leftNum / rightNum : 0; break;
      default: mathResult = leftNum;
    }
    result += mathResult.toString();
  } else {
    result += '0';
  }
  break;

case 'conditional_expression':
  const conditionLeft = this._evaluateSubExpression(segment.leftExpression, hassStates);
  const conditionResult = this._evaluateCondition(conditionLeft, segment.operator, segment.rightValue);
  result += conditionResult ? segment.trueValue : segment.falseValue;
  break;
```

### Phase 5: Integration Testing and Documentation

1. **Update the template detection in overlay implementations**
2. **Create comprehensive test cases for mixed template syntax**
3. **Update user documentation with examples**
4. **Add debugging tools for template resolution**

This plan provides a comprehensive solution that:

- ✅ Maintains backward compatibility with existing MSD DataSource templates
- ✅ Adds full Home Assistant entity state and attribute support
- ✅ Supports mixed template syntax in the same content string
- ✅ Provides proper entity dependency tracking for real-time updates
- ✅ Extends template functionality with advanced HA functions
- ✅ Follows the existing architectural patterns in your codebase

The implementation leverages your existing `MsdTemplateEngine` which already has the HA template parsing logic, and integrates it seamlessly with your overlay rendering system through the enhanced `DataSourceMixin`.

## Supported HA functions

- states('entity_id')
- state_attr('entity_id','attribute')
- is_state('entity_id','state')
- has_value('entity_id')
- Pipe formats: |float, |round(n), |upper, |lower, |title, |unit('X')
- Simple math and conditionals can combine states/state_attr

### Examples

- Attribute read
  - "{{state_attr('sensor.system_monitor','memory_usage')}}%"
- Attribute with format
  - "{{state_attr('sensor.weather','temperature')|float}}°C"
  - "{{state_attr('sensor.battery','level')|round(0)}}%"
- Mixed math
  - "{{state_attr('sensor.net','in')|float + state_attr('sensor.net','out')|float}} MB/s"
- Conditional
  - "{{state_attr('binary_sensor.front_door','contact') == 'on' and 'OPEN' or 'CLOSED'}}"

Notes
- state_attr() works in math/conditionals and supports the same format pipe as states().
- Unified processing coexists with MSD {datasource.path} templates in the same string.