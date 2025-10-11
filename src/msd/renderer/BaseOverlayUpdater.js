import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { DataSourceMixin } from './DataSourceMixin.js';
import { TemplateEntityExtractor } from '../templates/TemplateEntityExtractor.js';

/**
 * [BaseOverlayUpdater] Base overlay update system - unified interface for dynamic overlay updates
 * 🔄 Provides consistent template processing and DataSource integration across all overlay types
 */

export class BaseOverlayUpdater {
  constructor(systemsManager) {
    this.systemsManager = systemsManager;
    this.overlayUpdaters = new Map();

    // Register overlay-specific updaters
    this._registerUpdaters();
  }

  /**
   * Register overlay-specific update handlers
   * @private
   */
  _registerUpdaters() {
    // Text overlay updater with template processing
    this.overlayUpdaters.set('text', {
      needsUpdate: (overlay, sourceData) => this._textNeedsUpdate(overlay, sourceData),
      update: (overlayId, overlay, sourceData) => this._updateTextOverlay(overlayId, overlay, sourceData),
      hasTemplates: (overlay) => this._hasTemplateContent(overlay)
    });

    // Status grid updater (future implementation)
    this.overlayUpdaters.set('status_grid', {
      needsUpdate: (overlay, sourceData) => this._statusGridNeedsUpdate(overlay, sourceData),
      update: (overlayId, overlay, sourceData) => this._updateStatusGrid(overlayId, overlay, sourceData),
      hasTemplates: (overlay) => this._hasTemplateContent(overlay)
    });

    // Sparkline updater with enhanced synchronization
    this.overlayUpdaters.set('sparkline', {
      needsUpdate: (overlay, sourceData) => true, // Always update sparklines for data synchronization
      update: (overlayId, overlay, sourceData) => this._updateSparkline(overlayId, overlay, sourceData),
      hasTemplates: () => false // Sparklines don't use templates
    });

    // History bar updater with data visualization
    this.overlayUpdaters.set('history_bar', {
      needsUpdate: (overlay, sourceData) => this._historyBarNeedsUpdate(overlay, sourceData),
      update: (overlayId, overlay, sourceData) => this._updateHistoryBar(overlayId, overlay, sourceData),
      hasTemplates: (overlay) => this._hasTemplateContent(overlay) || this._historyBarNeedsDataUpdates(overlay)
    });

    // Button overlay updater
    this.overlayUpdaters.set('button', {
      needsUpdate: (overlay, sourceData) => this._hasTemplateContent(overlay),
      update: (overlayId, overlay, sourceData) => this._updateButtonOverlay(overlayId, overlay, sourceData),
      hasTemplates: (overlay) => this._hasTemplateContent(overlay)
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
   * @param {Array} changedIds - Entity IDs that changed
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

        // ENHANCED: Try to provide DataSource data when applicable (DS path)
        const dsId = this._findDataSourceForEntity(changedIds[0]);
        if (dsId) {
          const ds = this.systemsManager.dataSourceManager.getSource(dsId);
          currentData = ds?.getCurrentData?.() || null;

          // DIAGNOSTIC: Log the data we're about to use for the update
          cblcarsLog.debug(`[BaseOverlayUpdater] 📊 DataSource ${dsId} data for overlay ${overlay.id}:`, {
            hasCurrentData: !!currentData,
            entityState: currentData?.entity?.state,
            entityId: currentData?.entity?.entity_id,
            timestamp: currentData?.timestamp,
            changedEntity: changedIds[0]
          });
        } else {
          cblcarsLog.debug(`[BaseOverlayUpdater] ⚠️ No DataSource found for entity ${changedIds[0]}`);
        }

        cblcarsLog.debug(`[BaseOverlayUpdater] 🔄 Updating ${overlay.type} overlay ${overlay.id} (dsChanged=${dsChanged}, haChanged=${haChanged})`);

        // DIAGNOSTIC: Log overlay content before update
        const overlayContent = overlay._raw?.content || overlay.content || overlay.text || '';
        cblcarsLog.debug(`[BaseOverlayUpdater] 📝 Overlay ${overlay.id} content before update: "${overlayContent}"`);

        updater.update(overlay.id, overlay, currentData);
      }
    });
  }

  /**
   * Check if overlay references any of the changed DataSources
   * @private
   */
  _overlayReferencesChangedDataSources(overlay, changedIds) {
    // Check main overlay content for templates
    const mainContent = overlay._raw?.content || overlay.content || overlay.text || '';

    let hasReference = false;

    // Check main content for template references
    if (mainContent && this._contentReferencesChangedDataSources(mainContent, changedIds)) {
      hasReference = true;
    }

    // For history bars, also check if the source directly matches a changed DataSource
    if (overlay.type === 'history_bar' && overlay.source) {
      const sourceMatches = this._dataSourceMatchesChangedEntities(overlay.source, changedIds);
      if (sourceMatches) {
        hasReference = true;
      }
    }

    // For status grids, check EACH CELL INDIVIDUALLY - FIXED: Don't use global reference check
    if (overlay.type === 'status_grid') {
      const cellsConfig = overlay.cells || overlay._raw?.cells || overlay.raw?.cells;
      if (cellsConfig && Array.isArray(cellsConfig)) {
        // Check each cell individually rather than using OR logic
        cellsConfig.forEach(cell => {
          const cellContent = cell.content || cell.label || cell.value_format || '';
          const cellReferencesChanged = this._contentReferencesChangedDataSources(cellContent, changedIds);

          if (cellReferencesChanged) {
            hasReference = true;
          }
        });
      }
    }

    return hasReference;
  }

  /**
   * Check if overlay references any of the changed entities (using TemplateEntityExtractor)
   * @private
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
   * Check if overlay content contains template references (enhanced with TemplateEntityExtractor)
   * @private
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
  }

  /**
   * Detect any template markers (MSD {} or HA {{}})
   * @private
   */
  _hasAnyTemplateMarkers(content) {
    if (!content || typeof content !== 'string') return false;
    if (content.includes('{{') && content.includes('}}')) return true;
    if (content.includes('{')) return true;
    return false;
  }

  /**
   * Check if content string references any of the changed DataSources
   * @private
   */
  _contentReferencesChangedDataSources(content, changedIds) {
    if (!content || typeof content !== 'string') return false;

    // Extract all entity references from the content
    const templateRegex = /\{([^}]+)\}/g;
    let match;
    const referencedEntities = new Set();

    while ((match = templateRegex.exec(content)) !== null) {
      const expression = match[1].trim();

      // Extract entity names from the expression (handle both simple refs and expressions)
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

    // Now check if any of the referenced entities match the changed data sources
    for (const entityName of referencedEntities) {
      // Check if this entity name directly matches a changed DataSource
      if (this.systemsManager.dataSourceManager) {
        const dataSource = this.systemsManager.dataSourceManager.getSource(entityName);
        if (dataSource && changedIds.includes(dataSource.cfg?.entity)) {
          cblcarsLog.debug(`[BaseOverlayUpdater] 🔗 Content references changed DataSource: ${entityName}`);
          return true;
        }

        // ENHANCED: Check for dot notation references (e.g., temperature_enhanced.transformations.celsius)
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
   */
  _dataSourceMatchesChangedEntities(dataSourceId, changedIds) {
    if (!dataSourceId || !this.systemsManager.dataSourceManager) return false;

    const dataSource = this.systemsManager.dataSourceManager.getSource(dataSourceId);
    if (!dataSource) return false;

    const entityId = dataSource.cfg?.entity;
    if (!entityId) return false;

    return changedIds.includes(entityId);
  }  /**
   * Text overlay specific update logic
   * @private
   */
  _updateTextOverlay(overlayId, overlay, sourceData) {
    // DIAGNOSTIC: Log what data we're passing to the renderer
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
   */
  _updateStatusGrid(overlayId, overlay, sourceData) {
    cblcarsLog.debug(`[BaseOverlayUpdater] 📊 Updating status grid ${overlayId} with template processing`);

    // ENHANCED: Ensure renderer has updated HASS context before processing
    const updatedHass = this.systemsManager.getCurrentHass();
    if (updatedHass && this.systemsManager.renderer) {
      // Update the renderer's HASS context before processing templates
      if (this.systemsManager.renderer.setHass) {
        this.systemsManager.renderer.setHass(updatedHass);
        cblcarsLog.debug(`[BaseOverlayUpdater] 📊 Updated renderer HASS context for status grid ${overlayId}`);
      }
    }

    // FIXED: Use direct import instead of dynamic import for StatusGridRenderer
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
   * Sparkline update logic with enhanced synchronization
   * @private
   */
  _updateSparkline(overlayId, overlay, sourceData) {
    if (this.systemsManager.renderer && this.systemsManager.renderer.updateSparklineData) {
      // Use the enhanced sparkline update method that handles synchronization
      this.systemsManager.renderer.updateSparklineData(overlayId, sourceData);
    } else if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
      this.systemsManager.renderer.updateOverlayData(overlayId, sourceData);
    } else {
      cblcarsLog.warn(`[BaseOverlayUpdater] ⚠️ No renderer method available for sparkline overlay ${overlayId}`);
    }
  }

  /**
   * History bar update logic with data visualization
   * @private
   */
  _updateHistoryBar(overlayId, overlay, sourceData) {
    if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
      this.systemsManager.renderer.updateOverlayData(overlayId, sourceData);
    } else {
      cblcarsLog.warn(`[BaseOverlayUpdater] ⚠️ No renderer method available for history_bar overlay ${overlayId}`);
    }
  }

  /**
   * Update button overlay with new DataSource data
   * @private
   */
  _updateButtonOverlay(overlayId, overlay, sourceData) {
    if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
      this.systemsManager.renderer.updateOverlayData(overlayId, sourceData);
    } else {
      cblcarsLog.warn(`[BaseOverlayUpdater] No renderer method available for button overlay ${overlayId}`);
    }
  }

  /**
   * Generic overlay update logic
   * @private
   */
  _updateGenericOverlay(overlayId, overlay, sourceData) {
    cblcarsLog.debug(`[BaseOverlayUpdater] Generic update for ${overlay.type} overlay ${overlayId}`);
    // Could implement generic template processing here
  }

  /**
   * Helper methods
   * @private
   */
  _textNeedsUpdate(overlay, sourceData) {
    return this._hasTemplateContent(overlay);
  }

  _statusGridNeedsUpdate(overlay, sourceData) {
    return this._hasTemplateContent(overlay);
  }

  _historyBarNeedsUpdate(overlay, sourceData) {
    // History bars need updates if they have templates OR if they visualize data from the changed source
    return this._hasTemplateContent(overlay) || this._historyBarUsesDataSource(overlay, sourceData);
  }

  _historyBarNeedsDataUpdates(overlay) {
    // History bars always need updates for data visualization, even without templates
    return !!overlay.source;
  }

  _historyBarUsesDataSource(overlay, sourceData) {
    // Check if the history bar's source matches the changed data source
    if (!overlay.source || !sourceData?.entity) return false;

    // Find the DataSource that corresponds to this entity
    if (this.systemsManager.dataSourceManager) {
      for (const [sourceId, source] of this.systemsManager.dataSourceManager.sources || new Map()) {
        if (source.cfg && source.cfg.entity === sourceData.entity && overlay.source === sourceId) {
          return true;
        }
      }
    }

    return false;
  }

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

// TODO: Replace the specific text overlay update logic in SystemsManager
// with this generalized BaseOverlayUpdater