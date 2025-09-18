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
    const content = overlay._raw?.content || overlay.content || overlay.text ||
                   overlay._raw?.value_format || overlay.value_format || '';
    return content && typeof content === 'string' && content.includes('{');
  }

  /**
   * Check if overlay references any of the changed DataSources
   * @private
   */
  _overlayReferencesChangedDataSources(overlay, changedIds) {
    const content = overlay._raw?.content || overlay.content || overlay.text || '';

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
  }

  /**
   * Text overlay specific update logic
   * @private
   */
  _updateTextOverlay(overlayId, overlay, sourceData) {
    if (this.systemsManager.renderer && this.systemsManager.renderer.updateTextOverlay) {
      this.systemsManager.renderer.updateTextOverlay(overlayId, sourceData);
    }
  }

  /**
   * Status grid update logic (future implementation)
   * @private
   */
  _updateStatusGrid(overlayId, overlay, sourceData) {
    // TODO: Implement status grid template processing
    console.log(`[BaseOverlayUpdater] Status grid update not yet implemented: ${overlayId}`);
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