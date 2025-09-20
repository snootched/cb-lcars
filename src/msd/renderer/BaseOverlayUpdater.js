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

    // Sparkline updater (existing logic)
    this.overlayUpdaters.set('sparkline', {
      needsUpdate: (overlay, sourceData) => true, // Always update sparklines
      update: (overlayId, overlay, sourceData) => this._updateSparkline(overlayId, overlay, sourceData),
      hasTemplates: () => false // Sparklines don't use templates
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
    console.log('[BaseOverlayUpdater] Checking overlays for DataSource changes:', changedIds);

    const resolvedModel = this.systemsManager.modelBuilder?.getResolvedModel?.();
    if (!resolvedModel?.overlays) {
      return;
    }

    // Check each overlay type
    resolvedModel.overlays.forEach(overlay => {
      const updater = this.overlayUpdaters.get(overlay.type) || this.overlayUpdaters.get('default');

      if (updater.hasTemplates(overlay)) {
        const needsUpdate = this._overlayReferencesChangedDataSources(overlay, changedIds);

        if (needsUpdate) {
          const updatedDataSourceId = this._findDataSourceForEntity(changedIds[0]);
          if (updatedDataSourceId) {
            const dataSource = this.systemsManager.dataSourceManager.getSource(updatedDataSourceId);
            if (dataSource) {
              const currentData = dataSource.getCurrentData();

              console.log(`[BaseOverlayUpdater] Updating ${overlay.type} overlay ${overlay.id}`);
              updater.update(overlay.id, overlay, currentData);
            }
          }
        }
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

    return false;
  }

  /**
   * Check if overlay references any of the changed DataSources
   * @private
   */
  _overlayReferencesChangedDataSources(overlay, changedIds) {
    // Check main overlay content
    const mainContent = overlay._raw?.content || overlay.content || overlay.text || '';

    let hasReference = false;

    // Check main content
    if (mainContent && this._contentReferencesChangedDataSources(mainContent, changedIds)) {
      hasReference = true;
    }

    // For status grids, also check cell configurations - ENHANCED to check multiple sources
    if (overlay.type === 'status_grid') {
      const cellsConfig = overlay.cells || overlay._raw?.cells || overlay.raw?.cells;
      if (cellsConfig && Array.isArray(cellsConfig)) {
        hasReference = hasReference || cellsConfig.some(cell => {
          const cellContent = cell.content || cell.label || cell.value_format || '';
          return this._contentReferencesChangedDataSources(cellContent, changedIds);
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

    return changedIds.some(entityId => {
      if (this.systemsManager.dataSourceManager) {
        for (const [sourceId, source] of this.systemsManager.dataSourceManager.sources || new Map()) {
          if (source.cfg && source.cfg.entity === entityId && content.includes(sourceId)) {
            return true;
          }
        }
      }
      return false;
    });
  }  /**
   * Text overlay specific update logic
   * @private
   */
  _updateTextOverlay(overlayId, overlay, sourceData) {
    if (this.systemsManager.renderer && this.systemsManager.renderer.updateTextOverlay) {
      this.systemsManager.renderer.updateTextOverlay(overlayId, sourceData);
    }
  }

  /**
   * Status grid update logic with template processing
   * @private
   */
  _updateStatusGrid(overlayId, overlay, sourceData) {
    console.log(`[BaseOverlayUpdater] Updating status grid ${overlayId} with template processing`);

    // Import StatusGridRenderer for template processing
    import('./StatusGridRenderer.js').then(({ StatusGridRenderer }) => {
      const renderer = new StatusGridRenderer();

      // Process cell templates with new DataSource data
      const updatedCells = renderer.updateCellsWithData(overlay, overlay.finalStyle || {}, sourceData);

      console.log(`[BaseOverlayUpdater] Processed ${updatedCells.length} cells for status grid ${overlayId}`);

      // Update the status grid in the renderer
      if (this.systemsManager.renderer && this.systemsManager.renderer.updateStatusGridWithTemplates) {
        this.systemsManager.renderer.updateStatusGridWithTemplates(overlayId, sourceData);
      } else if (this.systemsManager.renderer && this.systemsManager.renderer.updateStatusGrid) {
        this.systemsManager.renderer.updateStatusGrid(overlayId, updatedCells);
      } else {
        console.log(`[BaseOverlayUpdater] Status grid update method not yet implemented in AdvancedRenderer`);
        // For now, trigger a general overlay update
        if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
          this.systemsManager.renderer.updateOverlayData(overlayId, sourceData);
        }
      }
    }).catch(error => {
      console.error(`[BaseOverlayUpdater] Failed to import StatusGridRenderer:`, error);
    });
  }

  /**
   * Sparkline update logic
   * @private
   */
  _updateSparkline(overlayId, overlay, sourceData) {
    if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
      this.systemsManager.renderer.updateOverlayData(overlayId, sourceData);
    }
  }

  /**
   * Generic overlay update logic
   * @private
   */
  _updateGenericOverlay(overlayId, overlay, sourceData) {
    console.log(`[BaseOverlayUpdater] Generic update for ${overlay.type} overlay ${overlayId}`);
    // Could implement generic template processing here
  }

  /**
   * Enhanced overlay update with initial data handling for Status Grid
   * @private
   * @param {Object} overlay - Overlay to update
   * @param {Object} data - Data from DataSource
   */
  static _updateOverlayWithData(overlay, data) {
    const currentTimestamp = Date.now();

    // ENHANCED: Handle initial data differently than ongoing updates
    const isInitialData = data.historyReady && (!overlay.lastUpdate || overlay.lastUpdate === 0);

    if (isInitialData) {
      console.log(`[BaseOverlayUpdater] 🚀 Processing INITIAL data for ${overlay.type} overlay ${overlay.id}`);
    }

    // ENHANCED: Update based on overlay type with initial data consideration
    if (overlay.type === 'text') {
      TextOverlayRenderer.updateTextOverlay(overlay, data.entity, data.v, currentTimestamp, data.unit_of_measurement);
      console.log(`[BaseOverlayUpdater] ✅ Updated TEXT overlay ${overlay.id} with value: ${data.v}`);

    } else if (overlay.type === 'status_grid') {
      // For Status Grid, ensure initial data triggers proper rendering
      StatusGridRenderer.updateCellsWithData(overlay, data);

      if (isInitialData) {
        console.log(`[BaseOverlayUpdater] 🎯 STATUS GRID ${overlay.id} received initial data - forcing re-render if needed`);
        // Trigger a re-render to ensure templates are processed with new data
        overlay._needsRerender = true;
      }

      console.log(`[BaseOverlayUpdater] ✅ Updated STATUS GRID overlay ${overlay.id} with data from entity: ${data.entity}`);

    } else if (overlay.type === 'sparkline') {
      SparklineRenderer.updateSparklineData(overlay, data);
      console.log(`[BaseOverlayUpdater] ✅ Updated SPARKLINE overlay ${overlay.id} with buffer data`);

    } else {
      // Fallback for other overlay types
      overlay.data = data;
      overlay.lastUpdate = currentTimestamp;
      console.log(`[BaseOverlayUpdater] ✅ Updated ${overlay.type} overlay ${overlay.id} with generic data`);
    }

    // Set lastUpdate timestamp
    overlay.lastUpdate = currentTimestamp;
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