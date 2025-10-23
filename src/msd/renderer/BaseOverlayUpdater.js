/**
 * [BaseOverlayUpdater] Base overlay update system - unified interface for dynamic overlay updates
 * 🔄 Provides consistent template processing and DataSource integration across all overlay types
 *
 * @module BaseOverlayUpdater
 * @requires cblcars-logging
 * @requires DataSourceMixin
 * @requires TemplateEntityExtractor
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { DataSourceMixin } from './DataSourceMixin.js';
import { TemplateEntityExtractor } from '../templates/TemplateEntityExtractor.js';
import { TemplateProcessor } from '../utils/TemplateProcessor.js';

export class BaseOverlayUpdater {
  /**
   * Create a new BaseOverlayUpdater instance
   * @param {Object} systemsManager - Reference to SystemsManager for accessing subsystems
   */
  constructor(systemsManager) {
    this.systemsManager = systemsManager;
    this.overlayUpdaters = new Map();

    // Register overlay-specific updaters
    this._registerUpdaters();
  }

  /**
   * Register overlay-specific update handlers
   * Each updater provides:
   * - needsUpdate: function to determine if overlay needs updating
   * - update: function to perform the update
   * - hasTemplates: function to check if overlay uses templates
   * @private
   */
  _registerUpdaters() {
    // Text overlay updater with template processing
    this.overlayUpdaters.set('text', {
      needsUpdate: (overlay, sourceData) => this._textNeedsUpdate(overlay, sourceData),
      update: (overlayId, overlay, sourceData) => this._updateTextOverlay(overlayId, overlay, sourceData),
      hasTemplates: (overlay) => this._hasTemplateContent(overlay)
    });

    // Status grid updater
    this.overlayUpdaters.set('status_grid', {
      needsUpdate: (overlay, sourceData) => this._statusGridNeedsUpdate(overlay, sourceData),
      update: (overlayId, overlay, sourceData) => this._updateStatusGrid(overlayId, overlay, sourceData),
      hasTemplates: (overlay) => this._hasTemplateContent(overlay)
    });

    // Button overlay updater
    this.overlayUpdaters.set('button', {
      needsUpdate: (overlay, sourceData) => this._hasTemplateContent(overlay),
      update: (overlayId, overlay, sourceData) => this._updateButtonOverlay(overlayId, overlay, sourceData),
      hasTemplates: (overlay) => this._hasTemplateContent(overlay)
    });

    // ApexCharts updater for rule-driven style changes
    this.overlayUpdaters.set('apexchart', {
      needsUpdate: (overlay, sourceData) => this._apexChartNeedsUpdate(overlay, sourceData),
      update: (overlayId, overlay, sourceData) => this._updateApexChart(overlayId, overlay, sourceData),
      hasTemplates: (overlay) => this._apexChartHasTemplates(overlay)
    });

    // Generic updater for future overlay types
    this.overlayUpdaters.set('default', {
      needsUpdate: (overlay, sourceData) => this._hasTemplateContent(overlay),
      update: (overlayId, overlay, sourceData) => this._updateGenericOverlay(overlayId, overlay, sourceData),
      hasTemplates: (overlay) => this._hasTemplateContent(overlay)
    });
  }

  /**
   * Main entry point for updating overlays when DataSource changes
   * @param {Array<string>} changedIds - Entity IDs that changed
   * @public
   */
  updateOverlaysForDataSourceChanges(changedIds) {
    cblcarsLog.debug(`[BaseOverlayUpdater] 🔄 Checking overlays for DataSource/HA changes: ${changedIds.join(', ')}`);

    const resolvedModel = this.systemsManager.modelBuilder?.getResolvedModel?.();
    if (!resolvedModel?.overlays) {
      cblcarsLog.warn('[BaseOverlayUpdater] ⚠️ No resolved model or overlays found');
      return;
    }

    resolvedModel.overlays.forEach(overlay => {
      const updater = this.overlayUpdaters.get(overlay.type) || this.overlayUpdaters.get('default');
      if (!updater.hasTemplates(overlay)) return;

      // Detect if this overlay references changed DataSources OR HA entities
      const dsChanged = this._overlayReferencesChangedDataSources(overlay, changedIds);
      const haChanged = this._overlayReferencesChangedEntities(overlay, changedIds);

      if (dsChanged || haChanged) {
        let currentData = null;

        // ENHANCED: Try to provide DataSource data when applicable
        const dsId = this._findDataSourceForEntity(changedIds[0]);
        if (dsId) {
          const ds = this.systemsManager.dataSourceManager.getSource(dsId);
          currentData = ds?.getCurrentData?.() || null;

          cblcarsLog.debug(`[BaseOverlayUpdater] 📊 DataSource ${dsId} data for overlay ${overlay.id}:`, {
            hasCurrentData: !!currentData,
            entityState: currentData?.entity?.state,
            entityId: currentData?.entity?.entity_id,
            timestamp: currentData?.timestamp,
            changedEntity: changedIds[0]
          });
        }

        cblcarsLog.debug(`[BaseOverlayUpdater] 🔄 Updating ${overlay.type} overlay ${overlay.id} (dsChanged=${dsChanged}, haChanged=${haChanged})`);

        updater.update(overlay.id, overlay, currentData);
      }
    });
  }

  /**
   * Check if overlay references any of the changed DataSources
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Array<string>} changedIds - Array of changed entity IDs
   * @returns {boolean} True if overlay references changed DataSource
   */
  _overlayReferencesChangedDataSources(overlay, changedIds) {
    const mainContent = overlay._raw?.content || overlay.content || overlay.text || '';
    let hasReference = false;

    // Check main content for template references
    if (mainContent && this._contentReferencesChangedDataSources(mainContent, changedIds)) {
      hasReference = true;
    }

    // For history bars, check if source directly matches a changed DataSource
    if (overlay.type === 'history_bar' && overlay.source) {
      const sourceMatches = this._dataSourceMatchesChangedEntities(overlay.source, changedIds);
      if (sourceMatches) {
        hasReference = true;
      }
    }

    // For status grids, check EACH CELL INDIVIDUALLY
    if (overlay.type === 'status_grid') {
      const cellsConfig = overlay.cells || overlay._raw?.cells || overlay.raw?.cells;
      if (cellsConfig && Array.isArray(cellsConfig)) {
        cellsConfig.forEach(cell => {
          const cellContent = cell.content || cell.label || cell.value_format || '';
          const cellReferencesChanged = this._contentReferencesChangedDataSources(cellContent, changedIds);

          if (cellReferencesChanged) {
            hasReference = true;
          }
        });
      }
    }

    // For ApexCharts, check if source matches changed DataSource
    if (overlay.type === 'apexchart') {
      const sourceRef = overlay.source || overlay.data_source || overlay.sources;
      const sources = Array.isArray(sourceRef) ? sourceRef : [sourceRef];

      sources.forEach(source => {
        if (this._dataSourceMatchesChangedEntities(source, changedIds)) {
          hasReference = true;
        }
      });
    }

    return hasReference;
  }

  /**
   * Check if overlay references any of the changed entities (using TemplateEntityExtractor)
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Array<string>} changedIds - Array of changed entity IDs
   * @returns {boolean} True if overlay references changed entity
   */
  _overlayReferencesChangedEntities(overlay, changedIds) {
    try {
      // Use TemplateEntityExtractor to get all entity references in this overlay
      const overlayEntities = TemplateEntityExtractor.extractFromOverlay(overlay);

      // Check if any overlay entities match changed entities
      for (const overlayEntity of overlayEntities) {
        if (changedIds.includes(overlayEntity)) {
          cblcarsLog.debug(`[BaseOverlayUpdater] 🎯 Overlay ${overlay.id} references changed entity: ${overlayEntity}`);
          return true;
        }
      }

      return false;
    } catch (error) {
      cblcarsLog.error(`[BaseOverlayUpdater] Error checking entity references for overlay ${overlay.id}:`, error);
      return false;
    }
  }

  /**
   * Check if overlay content contains template references
   * @private
   * @param {Object} overlay - Overlay configuration
   * @returns {boolean} True if overlay uses templates
   */
  _hasTemplateContent(overlay) {
    try {
      // Use TemplateEntityExtractor to detect any entity references
      const entities = TemplateEntityExtractor.extractFromOverlay(overlay);
      return entities.size > 0;
    } catch (error) {
      cblcarsLog.error(`[BaseOverlayUpdater] Error checking template content for overlay ${overlay.id}:`, error);

      // Fallback to original detection method
      const mainContent = overlay._raw?.content || overlay.content || overlay.text ||
                          overlay._raw?.value_format || overlay.value_format || '';
      if (mainContent && typeof mainContent === 'string' && this._hasAnyTemplateMarkers(mainContent)) {
        return true;
      }

      // For status grids, check cell configurations
      if (overlay.type === 'status_grid') {
        const cellsConfig = overlay.cells || overlay._raw?.cells || overlay.raw?.cells;
        if (cellsConfig && Array.isArray(cellsConfig)) {
          return cellsConfig.some(cell => {
            const cellContent = cell.content || cell.label || cell.value_format || '';
            return cellContent && typeof cellContent === 'string' && this._hasAnyTemplateMarkers(cellContent);
          });
        }
      }
      return false;
    }
  }

  /**
   * Detect any template markers (MSD {} or HA {{}})
   * @private
   * @param {string} content - Content string to check
   * @returns {boolean} True if content contains template markers
   *
   * PHASE 2: Delegated to TemplateProcessor for unified detection
   */
  _hasAnyTemplateMarkers(content) {
    return TemplateProcessor.hasTemplates(content);
  }

  /**
   * Check if content string references any of the changed DataSources
   * @private
   * @param {string} content - Content string to check
   * @param {Array<string>} changedIds - Array of changed entity IDs
   * @returns {boolean} True if content references changed DataSource
   */
  _contentReferencesChangedDataSources(content, changedIds) {
    if (!content || typeof content !== 'string') return false;

    // Extract all entity references from the content
    const templateRegex = /\{([^}]+)\}/g;
    let match;
    const referencedEntities = new Set();

    while ((match = templateRegex.exec(content)) !== null) {
      const expression = match[1].trim();

      // Extract entity names from the expression
      const entityRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\b/g;
      let entityMatch;

      while ((entityMatch = entityRegex.exec(expression)) !== null) {
        const entityName = entityMatch[1];

        // Skip JavaScript keywords
        if (!['true', 'false', 'null', 'undefined', 'if', 'else', 'return', 'var', 'let', 'const'].includes(entityName)) {
          referencedEntities.add(entityName);
        }
      }
    }

    // Check if referenced entities match changed data sources
    for (const entityName of referencedEntities) {
      // Check if entity name directly matches a changed DataSource
      if (this.systemsManager.dataSourceManager) {
        const dataSource = this.systemsManager.dataSourceManager.getSource(entityName);
        if (dataSource && changedIds.includes(dataSource.cfg?.entity)) {
          cblcarsLog.debug(`[BaseOverlayUpdater] 🔗 Content references changed DataSource: ${entityName}`);
          return true;
        }

        // Check for dot notation references (e.g., temperature_enhanced.transformations.celsius)
        if (entityName.includes('.')) {
          const baseSourceName = entityName.split('.')[0];
          const baseDataSource = this.systemsManager.dataSourceManager.getSource(baseSourceName);
          if (baseDataSource && changedIds.includes(baseDataSource.cfg?.entity)) {
            cblcarsLog.debug(`[BaseOverlayUpdater] 🔗 Content references changed DataSource via dot notation: ${entityName} -> ${baseSourceName}`);
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check if a DataSource ID matches any of the changed entities
   * @private
   * @param {string} dataSourceId - DataSource identifier
   * @param {Array<string>} changedIds - Array of changed entity IDs
   * @returns {boolean} True if DataSource matches changed entity
   */
  _dataSourceMatchesChangedEntities(dataSourceId, changedIds) {
    if (!dataSourceId || !this.systemsManager.dataSourceManager) return false;

    const dataSource = this.systemsManager.dataSourceManager.getSource(dataSourceId);
    if (!dataSource) return false;

    const entityId = dataSource.cfg?.entity;
    if (!entityId) return false;

    return changedIds.includes(entityId);
  }

  /**
   * Text overlay specific update logic
   * @private
   * @param {string} overlayId - Overlay identifier
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - Updated source data
   */
  _updateTextOverlay(overlayId, overlay, sourceData) {
    cblcarsLog.debug(`[BaseOverlayUpdater] 📝 Updating text overlay ${overlayId} with data:`, {
      hasSourceData: !!sourceData,
      entityState: sourceData?.entity?.state,
      entityId: sourceData?.entity?.entity_id,
      timestamp: sourceData?.timestamp,
      hasRenderer: !!this.systemsManager.renderer,
      hasUpdateMethod: !!this.systemsManager.renderer?.updateOverlayData
    });

    if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
      this.systemsManager.renderer.updateOverlayData(overlayId, sourceData);
    } else if (this.systemsManager.renderer && this.systemsManager.renderer.updateTextOverlay) {
      // Legacy fallback for backward compatibility
      this.systemsManager.renderer.updateTextOverlay(overlayId, sourceData);
    } else {
      cblcarsLog.warn(`[BaseOverlayUpdater] ⚠️ No renderer method available for text overlay ${overlayId}`);
    }
  }

  /**
   * Status grid update logic with template processing
   * @private
   * @param {string} overlayId - Overlay identifier
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - Updated source data
   */
  _updateStatusGrid(overlayId, overlay, sourceData) {
    cblcarsLog.debug(`[BaseOverlayUpdater] 📊 Updating status grid ${overlayId} with template processing`);

    // Ensure renderer has updated HASS context before processing (Phase 1 new method)
    const updatedHass = this.systemsManager.getHassV2();
    if (updatedHass && this.systemsManager.renderer) {
      if (this.systemsManager.renderer.setHass) {
        this.systemsManager.renderer.setHass(updatedHass);
        cblcarsLog.debug(`[BaseOverlayUpdater] 📊 Updated renderer HASS context for status grid ${overlayId}`);
      }
    }

    try {
      // Get the cached overlay element
      const gridElement = this.systemsManager.renderer?.overlayElementCache?.get(overlayId);

      if (gridElement && overlay) {
        // Use the static updateGridData method
        const { StatusGridRenderer } = require('./StatusGridRenderer.js');
        const updated = StatusGridRenderer.updateGridData(gridElement, overlay, sourceData);

        if (updated) {
          cblcarsLog.debug(`[BaseOverlayUpdater] 📊 Successfully updated status grid ${overlayId}`);
        }
      } else {
        // Fallback to renderer's updateOverlayData method
        if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
          const enhancedSourceData = {
            ...sourceData,
            hass: updatedHass,
            overlay: overlay
          };
          this.systemsManager.renderer.updateOverlayData(overlayId, enhancedSourceData);
          cblcarsLog.debug(`[BaseOverlayUpdater] 📊 Used fallback renderer update for ${overlayId}`);
        }
      }
    } catch (error) {
      cblcarsLog.error(`[BaseOverlayUpdater] ❌ Failed to update status grid ${overlayId}:`, error);

      // Final fallback to renderer
      if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
        this.systemsManager.renderer.updateOverlayData(overlayId, sourceData);
      }
    }
  }

  /**
   * Update button overlay with new DataSource data
   * @private
   * @param {string} overlayId - Overlay identifier
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - Updated source data
   */
  _updateButtonOverlay(overlayId, overlay, sourceData) {
    if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
      this.systemsManager.renderer.updateOverlayData(overlayId, sourceData);
    } else {
      cblcarsLog.warn(`[BaseOverlayUpdater] No renderer method available for button overlay ${overlayId}`);
    }
  }

  /**
   * ApexChart update logic - handles both data and style changes from rules
   * @private
   * @param {string} overlayId - Overlay identifier
   * @param {Object} overlay - Overlay configuration with finalStyle from rules
   * @param {Object} sourceData - Updated source data
   */
  _updateApexChart(overlayId, overlay, sourceData) {
    cblcarsLog.debug(`[BaseOverlayUpdater] 📊 Updating ApexChart ${overlayId}`);

    // CRITICAL FIX: Import the renderer class
    const { ApexChartsOverlayRenderer } = require('./ApexChartsOverlayRenderer.js');

    // Get the singleton instance
    const instance = ApexChartsOverlayRenderer._getInstance();

    // Check if chart exists
    const chart = instance.charts.get(overlayId);

    if (!chart) {
      cblcarsLog.warn(`[BaseOverlayUpdater] ⚠️ ApexChart instance not found: ${overlayId}`);
      return;
    }

    try {
      const style = overlay.finalStyle || overlay.style || {};
      const sourceRef = overlay.source || overlay.data_source || overlay.sources;

      // Get updated series data
      const dataSourceManager = this.systemsManager.dataSourceManager;
      if (!dataSourceManager) {
        cblcarsLog.warn(`[BaseOverlayUpdater] ⚠️ No DataSourceManager for ApexChart update`);
        return;
      }

      // Import adapter for series conversion
      const { ApexChartsAdapter } = require('../charts/ApexChartsAdapter.js');

      // Convert data to series format
      const isMultiSeries = Array.isArray(sourceRef);
      const newSeries = isMultiSeries ?
        ApexChartsAdapter.convertToMultiSeries(sourceRef, dataSourceManager, {
          time_window: style.time_window,
          max_points: style.max_points || 500,
          seriesNames: style.series_names || style.seriesNames
        }) :
        ApexChartsAdapter.convertToSeries(sourceRef, dataSourceManager, {
          time_window: style.time_window,
          max_points: style.max_points || 500,
          name: style.name
        });

      // Get overlay dimensions for style updates
      const overlayInfo = instance.overlayDivs.get(overlayId);
      const size = overlay.size || [300, 150];

      // Calculate screen coordinates if we have overlay info
      let screenSize = size;
      if (overlayInfo && overlayInfo.div) {
        const divRect = overlayInfo.div.getBoundingClientRect();
        screenSize = [Math.round(divRect.width), Math.round(divRect.height)];
      }

      // Generate updated options from current style
      const updatedOptions = ApexChartsAdapter.generateOptions(
        style,
        screenSize,
        {}
      );

      // CRITICAL FIX: Use separate update calls to prevent re-creation
      // Step 1: Update options without series
      const optionsOnly = { ...updatedOptions };
      delete optionsOnly.series; // Remove series to update separately

      chart.updateOptions(optionsOnly, false, false); // Don't redraw yet

      // Step 2: Update series with animation
      chart.updateSeries(newSeries, true); // Animate the update

      cblcarsLog.debug(`[BaseOverlayUpdater] ✅ ApexChart ${overlayId} updated with new data and styles`);

    } catch (error) {
      cblcarsLog.error(`[BaseOverlayUpdater] ❌ Failed to update ApexChart ${overlayId}:`, error);
    }
  }
  /**
   * Generic overlay update logic
   * @private
   * @param {string} overlayId - Overlay identifier
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - Updated source data
   */
  _updateGenericOverlay(overlayId, overlay, sourceData) {
    cblcarsLog.debug(`[BaseOverlayUpdater] Generic update for ${overlay.type} overlay ${overlayId}`);
    // Could implement generic template processing here
  }

  /**
   * Helper methods for determining update needs
   */

  /**
   * Check if text overlay needs update
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - Source data
   * @returns {boolean} True if update needed
   */
  _textNeedsUpdate(overlay, sourceData) {
    return this._hasTemplateContent(overlay);
  }

  /**
   * Check if status grid needs update
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - Source data
   * @returns {boolean} True if update needed
   */
  _statusGridNeedsUpdate(overlay, sourceData) {
    return this._hasTemplateContent(overlay);
  }

  /**
   * Check if ApexChart needs update
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - Source data
   * @returns {boolean} True if update needed
   */
  _apexChartNeedsUpdate(overlay, sourceData) {
    // ApexCharts need updates when:
    // 1. Their DataSource changes (data updates)
    // 2. Their style changes (rule-driven patches)
    return true; // Always check for updates
  }

  /**
   * Check if ApexChart uses templates in its configuration
   * @private
   * @param {Object} overlay - Overlay configuration
   * @returns {boolean} True if templates used
   */
  _apexChartHasTemplates(overlay) {
    // Check if overlay has any template references in style properties
    const style = overlay.finalStyle || overlay.style || {};

    // Check common style properties that might contain templates
    const templateProps = [
      'name',
      'tooltip_time_format',
      'value_format',
      'series_names'
    ];

    for (const prop of templateProps) {
      if (style[prop] && typeof style[prop] === 'string' && this._hasAnyTemplateMarkers(style[prop])) {
        return true;
      }
    }

    // Check if series names contain templates
    if (style.series_names && typeof style.series_names === 'object') {
      for (const name of Object.values(style.series_names)) {
        if (typeof name === 'string' && this._hasAnyTemplateMarkers(name)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Find DataSource ID for given entity ID
   * @private
   * @param {string} entityId - Entity identifier
   * @returns {string|null} DataSource ID or null if not found
   */
  _findDataSourceForEntity(entityId) {
    if (this.systemsManager.dataSourceManager) {
      for (const [sourceId, source] of this.systemsManager.dataSourceManager.sources || new Map()) {
        if (source.cfg && source.cfg.entity === entityId) {
          return sourceId;
        }
      }
    }
    return null;
  }
}