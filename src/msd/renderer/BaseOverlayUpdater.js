/**
 * Base Overlay Update System - Unified interface for dynamic overlay updates
 * Provides consistent template processing and DataSource integration across all overlay types
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
    console.debug('[BaseOverlayUpdater] Checking overlays for DataSource changes:', changedIds);

    const resolvedModel = this.systemsManager.modelBuilder?.getResolvedModel?.();
    if (!resolvedModel?.overlays) {
      console.warn('[BaseOverlayUpdater] No resolved model or overlays found');
      return;
    }

    console.debug(`[BaseOverlayUpdater] Found ${resolvedModel.overlays.length} overlays to check`);

    // Check each overlay type
    resolvedModel.overlays.forEach(overlay => {
      const updater = this.overlayUpdaters.get(overlay.type) || this.overlayUpdaters.get('default');

      console.debug(`[BaseOverlayUpdater] Checking overlay ${overlay.id} (type: ${overlay.type}):`, {
        hasTemplates: updater.hasTemplates(overlay),
        source: overlay.source,
        content: overlay.content
      });

      if (updater.hasTemplates(overlay)) {
        const needsUpdate = this._overlayReferencesChangedDataSources(overlay, changedIds);

        console.debug(`[BaseOverlayUpdater] Overlay ${overlay.id} references changed data:`, needsUpdate);

        if (needsUpdate) {
          const updatedDataSourceId = this._findDataSourceForEntity(changedIds[0]);
          if (updatedDataSourceId) {
            const dataSource = this.systemsManager.dataSourceManager.getSource(updatedDataSourceId);
            if (dataSource) {
              const currentData = dataSource.getCurrentData();

              console.debug(`[BaseOverlayUpdater] Updating ${overlay.type} overlay ${overlay.id}`);
              updater.update(overlay.id, overlay, currentData);
            } else {
              console.warn(`[BaseOverlayUpdater] DataSource ${updatedDataSourceId} not found`);
            }
          } else {
            console.warn(`[BaseOverlayUpdater] No DataSource found for entity ${changedIds[0]}`);
          }
        }
      } else {
        console.debug(`[BaseOverlayUpdater] Overlay ${overlay.id} has no templates - skipping`);
      }
    });
  }

  /**
   * Check if overlay content contains template references
   * @private
   */
  _hasTemplateContent(overlay) {
    // Check main overlay content
    const mainContent = overlay._raw?.content || overlay.content || overlay.text ||
                       overlay._raw?.value_format || overlay.value_format || '';

    if (mainContent && typeof mainContent === 'string' && mainContent.includes('{')) {
      return true;
    }

    // For status grids, also check cell configurations - ENHANCED to check multiple sources
    if (overlay.type === 'status_grid') {
      const cellsConfig = overlay.cells || overlay._raw?.cells || overlay.raw?.cells;
      if (cellsConfig && Array.isArray(cellsConfig)) {
        return cellsConfig.some(cell => {
          const cellContent = cell.content || cell.label || cell.value_format || '';
          return cellContent && typeof cellContent === 'string' && cellContent.includes('{');
        });
      }
    }

    // For history bars, check content property for templates
    if (overlay.type === 'history_bar') {
      const historyBarContent = overlay.content || overlay._raw?.content || '';
      if (historyBarContent && typeof historyBarContent === 'string' && historyBarContent.includes('{')) {
        return true;
      }
    }

    return false;
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
      console.debug(`[BaseOverlayUpdater] History bar ${overlay.id} source ${overlay.source} matches changed entities:`, sourceMatches);
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

          console.debug(`[BaseOverlayUpdater] Status grid ${overlay.id} cell "${cell.id || cell.label}" content="${cellContent}" references changed data:`, cellReferencesChanged);

          if (cellReferencesChanged) {
            console.debug(`[BaseOverlayUpdater] Status grid ${overlay.id} cell ${cell.id || cell.label} references changed data:`, cellContent);
            hasReference = true;
          }
        });
      }
    }

    return hasReference;
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
          console.debug(`[BaseOverlayUpdater] Content references changed DataSource: ${entityName} (entity: ${dataSource.cfg?.entity})`);
          return true;
        }

        // ENHANCED: Check for dot notation references (e.g., temperature_enhanced.transformations.celsius)
        if (entityName.includes('.')) {
          const baseSourceName = entityName.split('.')[0];
          const baseDataSource = this.systemsManager.dataSourceManager.getSource(baseSourceName);
          if (baseDataSource && changedIds.includes(baseDataSource.cfg?.entity)) {
            console.debug(`[BaseOverlayUpdater] Content references changed DataSource via dot notation: ${entityName} -> ${baseSourceName} (entity: ${baseDataSource.cfg?.entity})`);
            return true;
          }
        }
      }
    }

    console.debug(`[BaseOverlayUpdater] Content does not reference any changed DataSources. Referenced: [${Array.from(referencedEntities).join(', ')}], Changed: [${changedIds.join(', ')}]`);
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
    if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
      this.systemsManager.renderer.updateOverlayData(overlayId, sourceData);
    } else if (this.systemsManager.renderer && this.systemsManager.renderer.updateTextOverlay) {
      // Legacy fallback for backward compatibility
      this.systemsManager.renderer.updateTextOverlay(overlayId, sourceData);
    } else {
      console.warn(`[BaseOverlayUpdater] No renderer method available for text overlay ${overlayId}`);
    }
  }

  /**
   * Status grid update logic with template processing
   * @private
   */
    /**
   * Status grid update logic with template processing
   * @private
   */
  _updateStatusGrid(overlayId, overlay, sourceData) {
    console.debug(`[BaseOverlayUpdater] Updating status grid ${overlayId} with template processing`);

    // Import StatusGridRenderer for template processing
    import('./StatusGridRenderer.js').then(({ StatusGridRenderer }) => {
      const renderer = new StatusGridRenderer();

      // Process cell templates with new DataSource data
      const updatedCells = renderer.updateCellsWithData(overlay, overlay.finalStyle || {}, sourceData);

      console.debug(`[BaseOverlayUpdater] Processed ${updatedCells.length} cells for status grid ${overlayId}`);

      // SIMPLIFIED: Let the external renderer handle the actual DOM update
      // We've done our job of processing the data - the external system will handle rendering
      if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
        this.systemsManager.renderer.updateOverlayData(overlayId, sourceData);
      } else {
        console.debug(`[BaseOverlayUpdater] No external renderer available - data processed but not rendered`);
      }
    }).catch(error => {
      console.error(`[BaseOverlayUpdater] Failed to import StatusGridRenderer:`, error);
    });
  }

  /**
   * Sparkline update logic with enhanced synchronization
   * @private
   */
  _updateSparkline(overlayId, overlay, sourceData) {
    console.debug(`[BaseOverlayUpdater] Updating sparkline ${overlayId} with enhanced synchronization`);

    if (this.systemsManager.renderer && this.systemsManager.renderer.updateSparklineData) {
      // Use the enhanced sparkline update method that handles synchronization
      this.systemsManager.renderer.updateSparklineData(overlayId, sourceData);
    } else if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
      this.systemsManager.renderer.updateOverlayData(overlayId, sourceData);
    }
  }

  /**
   * History bar update logic with data visualization
   * @private
   */
  _updateHistoryBar(overlayId, overlay, sourceData) {
    console.debug(`[BaseOverlayUpdater] _updateHistoryBar called for ${overlayId}:`, {
      hasRenderer: !!this.systemsManager.renderer,
      hasUpdateOverlayData: !!(this.systemsManager.renderer?.updateOverlayData),
      sourceDataKeys: sourceData ? Object.keys(sourceData) : 'none',
      overlaySource: overlay.source
    });

    if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
      console.debug(`[BaseOverlayUpdater] Calling updateOverlayData for history_bar overlay ${overlayId}`);
      this.systemsManager.renderer.updateOverlayData(overlayId, sourceData);
    } else {
      console.warn(`[BaseOverlayUpdater] No renderer method available for history_bar overlay ${overlayId}`);
    }
  }

  /**
   * Generic overlay update logic
   * @private
   */
  _updateGenericOverlay(overlayId, overlay, sourceData) {
    console.debug(`[BaseOverlayUpdater] Generic update for ${overlay.type} overlay ${overlayId}`);
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