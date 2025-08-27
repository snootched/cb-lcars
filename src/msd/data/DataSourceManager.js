/**
 * DataSourceManager - Manages multiple data sources and overlay subscriptions
 *
 * Features:
 * - Multi-source lifecycle management
 * - Overlay subscription system
 * - Clean shutdown and resource management
 * - Performance monitoring and statistics
 * - EntityRuntime API compatibility for rules engine
 */

import { MsdDataSource } from './MsdDataSource.js';

export class DataSourceManager {
  constructor(hass) {
    this.hass = hass;
    this.sources = new Map();
    this.overlaySubscriptions = new Map();

    // NEW: Entity runtime compatibility
    this.entityIndex = new Map(); // entityId -> dataSource
    this.globalEntityChangeListeners = new Set();

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

    // NEW: Index by entity for global lookups
    if (config.entity) {
      this.entityIndex.set(config.entity, source);

      // Forward entity changes to global listeners
      source.subscribe((data) => {
        this._notifyGlobalEntityChangeListeners([config.entity]);
      });
    }

    try {
      await source.start();

      // NEW: Preload initial state from HASS if available
      if (config.entity && this.hass.states && this.hass.states[config.entity]) {
        const hassState = this.hass.states[config.entity];

        // Simulate initial state change to populate the data source
        source._handleStateChange({
          entity_id: config.entity,
          new_state: hassState,
          old_state: null
        });
      }

    } catch (error) {
      console.warn(`[DataSourceManager] Failed to start source ${name}:`, error);
      this.sources.delete(name);
      this.entityIndex.delete(config.entity);
      this._stats.errors++;
      throw error;
    }

    return source;
  }

  // NEW: EntityRuntime compatibility methods
  getEntity(entityId) {
    const source = this.entityIndex.get(entityId);
    if (!source) {
      // Fallback: try to get from HASS states directly
      if (this.hass.states && this.hass.states[entityId]) {
        const hassState = this.hass.states[entityId];
        return {
          state: hassState.state,
          attributes: hassState.attributes || {}
        };
      }
      return null;
    }

    // Try to get current data from data source
    const currentData = source.getCurrentData();
    if (currentData) {
      return {
        state: currentData.v.toString(),
        attributes: {}
      };
    }

    // Fallback to HASS states
    if (this.hass.states && this.hass.states[entityId]) {
      const hassState = this.hass.states[entityId];
      return {
        state: hassState.state,
        attributes: hassState.attributes || {}
      };
    }

    return null;
  }

  listIds() {
    return Array.from(this.entityIndex.keys());
  }

  // NEW: Add global entity change listener for rules engine
  addEntityChangeListener(callback) {
    this.globalEntityChangeListeners.add(callback);
    return () => this.globalEntityChangeListeners.delete(callback);
  }

  _notifyGlobalEntityChangeListeners(changedEntityIds) {
    if (this.globalEntityChangeListeners.size === 0) return;

    this.globalEntityChangeListeners.forEach(callback => {
      try {
        callback(changedEntityIds);
      } catch (error) {
        console.warn('[DataSourceManager] Global entity listener error:', error);
      }
    });
  }

  /**
   * Subscribe an overlay to data source updates
   * @param {Object} overlay - Overlay configuration with source property
   * @param {Function} callback - Callback function for updates
   */
  subscribeOverlay(overlay, callback) {
    if (!overlay.source) {
      console.warn('[DataSourceManager] subscribeOverlay: No source specified for overlay', overlay.id);
      return;
    }

    const source = this.sources.get(overlay.source);
    if (!source) {
      console.warn('[DataSourceManager] subscribeOverlay: Source not found:', overlay.source);
      return;
    }

    // Subscribe to the data source
    const unsubscribe = source.subscribe((data) => {
      // Call the callback with overlay and update data
      callback(overlay, { sourceData: data });
    });

    console.log(`[DataSourceManager] ✅ Subscribed overlay ${overlay.id} to source ${overlay.source} (${source.subscribers?.size || 0} total subscribers)`);

    return unsubscribe;
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
        entityCount: this.entityIndex.size,
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
    this.entityIndex.clear();
    this.globalEntityChangeListeners.clear();
  }

  // Debug and introspection methods
  debugDump() {
    return {
      sources: Array.from(this.sources.keys()),
      subscriptions: Array.from(this.overlaySubscriptions.keys()),
      entities: Array.from(this.entityIndex.keys()),
      stats: this.getStats()
    };
  }
}
