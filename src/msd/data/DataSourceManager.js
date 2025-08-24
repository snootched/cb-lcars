/**
 * DataSourceManager - Manages multiple data sources and overlay subscriptions
 *
 * Features:
 * - Multi-source lifecycle management
 * - Overlay subscription system
 * - Clean shutdown and resource management
 * - Performance monitoring and statistics
 */

import { MsdDataSource } from './MsdDataSource.js';

export class DataSourceManager {
  constructor(hass) {
    this.hass = hass;
    this.sources = new Map();
    this.overlaySubscriptions = new Map();

    // Performance statistics
    this._stats = {
      sourcesCreated: 0,
      subscriptionsActive: 0,
      dataUpdates: 0,
      errors: 0
    };

    // Lifecycle state
    this._destroyed = false;
  }

  async initializeFromConfig(dataSourceConfigs) {
    if (this._destroyed) {
      throw new Error('DataSourceManager has been destroyed');
    }

    // Create all data sources from config
    const promises = Object.entries(dataSourceConfigs || {}).map(async ([name, config]) => {
      try {
        const source = await this.createDataSource(name, config);
        this._stats.sourcesCreated++;
        return source;
      } catch (error) {
        console.warn(`[DataSourceManager] Failed to create source ${name}:`, error);
        this._stats.errors++;
        throw error;
      }
    });

    await Promise.all(promises);

    return this.sources.size;
  }

  async createDataSource(name, config) {
    if (this.sources.has(name)) {
      return this.sources.get(name);
    }

    const source = new MsdDataSource(config, this.hass);
    this.sources.set(name, source);

    try {
      await source.start();
    } catch (error) {
      console.warn(`[DataSourceManager] Failed to start source ${name}:`, error);
      this.sources.delete(name);
      this._stats.errors++;
      throw error;
    }

    return source;
  }

  subscribeOverlay(overlay, updateCallback) {
    if (this._destroyed) {
      console.warn('[DataSourceManager] Cannot subscribe after destruction');
      return;
    }

    const subscriptions = [];

    // Handle sparkline overlays
    if (overlay.type === 'sparkline' && overlay.source) {
      const source = this.sources.get(overlay.source);
      if (source) {
        const unsubscribe = source.subscribe((data) => {
          try {
            this._stats.dataUpdates++;
            updateCallback(overlay, { sourceData: data });
          } catch (error) {
            console.warn(`[DataSourceManager] Callback error for overlay ${overlay.id}:`, error);
            this._stats.errors++;
          }
        });
        subscriptions.push(unsubscribe);
      } else {
        console.warn(`[DataSourceManager] Source ${overlay.source} not found for overlay ${overlay.id}`);
      }
    }

    // Handle ribbon overlays
    if (overlay.type === 'ribbon' && overlay.sources) {
      for (const sourceName of overlay.sources) {
        const source = this.sources.get(sourceName);
        if (source) {
          const unsubscribe = source.subscribe((data) => {
            try {
              this._stats.dataUpdates++;
              updateCallback(overlay, { sourceData: data, sourceName });
            } catch (error) {
              console.warn(`[DataSourceManager] Callback error for overlay ${overlay.id}:`, error);
              this._stats.errors++;
            }
          });
          subscriptions.push(unsubscribe);
        } else {
          console.warn(`[DataSourceManager] Source ${sourceName} not found for ribbon overlay ${overlay.id}`);
        }
      }
    }

    // Handle multi-entity overlays
    if (overlay.type === 'multi' && overlay.entities) {
      for (const entityConfig of overlay.entities) {
        if (entityConfig.source) {
          const source = this.sources.get(entityConfig.source);
          if (source) {
            const unsubscribe = source.subscribe((data) => {
              try {
                this._stats.dataUpdates++;
                updateCallback(overlay, { sourceData: data, sourceName: entityConfig.source, entityConfig });
              } catch (error) {
                console.warn(`[DataSourceManager] Callback error for overlay ${overlay.id}:`, error);
                this._stats.errors++;
              }
            });
            subscriptions.push(unsubscribe);
          }
        }
      }
    }

    if (subscriptions.length > 0) {
      this.overlaySubscriptions.set(overlay.id, subscriptions);
      this._stats.subscriptionsActive++;
    }

    return subscriptions.length;
  }

  unsubscribeOverlay(overlayId) {
    const subscriptions = this.overlaySubscriptions.get(overlayId);
    if (subscriptions) {
      subscriptions.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn(`[DataSourceManager] Error unsubscribing overlay ${overlayId}:`, error);
          this._stats.errors++;
        }
      });
      this.overlaySubscriptions.delete(overlayId);
      this._stats.subscriptionsActive--;
    }
  }

  getSource(name) {
    return this.sources.get(name);
  }

  getAllSources() {
    return Array.from(this.sources.values());
  }

  getStats() {
    const sourceStats = {};
    for (const [name, source] of this.sources) {
      sourceStats[name] = source.getStats ? source.getStats() : { error: 'No stats available' };
    }

    return {
      manager: this._stats,
      sources: sourceStats,
      summary: {
        totalSources: this.sources.size,
        activeSubscriptions: this.overlaySubscriptions.size,
        destroyed: this._destroyed
      }
    };
  }

  async destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    // Unsubscribe all overlays
    for (const overlayId of this.overlaySubscriptions.keys()) {
      this.unsubscribeOverlay(overlayId);
    }

    // Stop all data sources
    const stopPromises = [];
    for (const [name, source] of this.sources) {
      try {
        if (source.stop) {
          stopPromises.push(source.stop());
        } else if (source.destroy) {
          stopPromises.push(source.destroy());
        }
      } catch (error) {
        console.warn(`[DataSourceManager] Error stopping source ${name}:`, error);
      }
    }

    await Promise.all(stopPromises);

    this.sources.clear();
    this.overlaySubscriptions.clear();
  }

  // Debug and introspection methods
  debugDump() {
    return {
      sources: Array.from(this.sources.keys()),
      subscriptions: Array.from(this.overlaySubscriptions.keys()),
      stats: this.getStats()
    };
  }
}
