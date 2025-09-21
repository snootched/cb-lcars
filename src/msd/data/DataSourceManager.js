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

  /**
   * Initialize data sources from configuration with history preloading
   * @param {Object} dataSourceConfigs - Configuration for data sources
   * @returns {Promise<number>} Number of sources created
   */
  async initializeFromConfig(dataSourceConfigs) {
    if (this._destroyed) {
      throw new Error('DataSourceManager has been destroyed');
    }

    console.log(`[DataSourceManager] 🚀 Initializing ${Object.keys(dataSourceConfigs || {}).length} data sources`);

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

    // NEW: Wait for history preloading to complete
    if (this.sources.size > 0) {
      await this._waitForHistoryPreloading();
    }

    const successful = this.sources.size;
    const failed = Object.keys(dataSourceConfigs || {}).length - successful;
    console.log(`[DataSourceManager] ✅ Initialization complete: ${successful} successful, ${failed} failed`);

    return successful;
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

  /**
   * NEW: Wait for all sources to complete their history loading
   * @private
   * @param {number} maxWaitMs - Maximum wait time in milliseconds
   */
  async _waitForHistoryPreloading(maxWaitMs = 10000) {
    const startTime = Date.now();
    const checkInterval = 100;

    console.log(`[DataSourceManager] ⏳ Waiting for history preloading...`);

    while (Date.now() - startTime < maxWaitMs) {
      let allReady = true;
      let totalSources = 0;
      let readySources = 0;

      for (const [name, source] of this.sources) {
        totalSources++;
        const stats = source.getStats();
        if (stats.historyLoaded > 0 || !source.cfg.history?.enabled) {
          readySources++;
        } else {
          allReady = false;
        }
      }

      if (readySources > 0) {
        console.log(`[DataSourceManager] History loading progress: ${readySources}/${totalSources} sources ready`);
      }

      if (allReady || totalSources === 0) {
        console.log(`[DataSourceManager] ✅ History preloading complete in ${Date.now() - startTime}ms`);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }

  // NEW: EntityRuntime compatibility methods
  getEntity(entityId) {
    // NEW: Support dot notation for datasource aggregations/transformations
    if (entityId.includes('.')) {
      const [sourceId, ...pathParts] = entityId.split('.');
      const source = this.sources.get(sourceId);

      if (source) {
        const currentData = source.getCurrentData();
        if (!currentData) return null;

        // Handle dot notation paths
        if (pathParts.length >= 2) {
          const dataType = pathParts[0]; // 'aggregations' or 'transformations'
          const dataKey = pathParts.slice(1).join('.'); // Support nested keys

          if (dataType === 'transformations' && currentData.transformations) {
            const value = currentData.transformations[dataKey];
            if (value !== undefined && value !== null) {
              return {
                state: String(value), // Convert to string properly
                attributes: {
                  data_path: entityId,
                  source_type: 'datasource_transformation',
                  raw_value: value
                }
              };
            }
          } else if (dataType === 'aggregations' && currentData.aggregations) {
            const aggData = currentData.aggregations[dataKey];

            // Handle aggregation objects with multiple properties
            if (typeof aggData === 'object' && aggData !== null) {
              // Return the most relevant value from aggregation
              let value = aggData.avg ?? aggData.value ?? aggData.last ?? aggData.current;
              if (value !== undefined && value !== null) {
                return {
                  state: String(value),
                  attributes: {
                    data_path: entityId,
                    source_type: 'datasource_aggregation',
                    raw_value: value,
                    aggregation_data: aggData
                  }
                };
              }
            } else if (aggData !== undefined && aggData !== null) {
              return {
                state: String(aggData),
                attributes: {
                  data_path: entityId,
                  source_type: 'datasource_aggregation',
                  raw_value: aggData
                }
              };
            }
          }
        }

        // Default to current value if no specific path found
        return {
          state: currentData.v?.toString() || 'unavailable',
          attributes: {
            timestamp: currentData.t,
            source_type: 'datasource',
            ...currentData.stats
          }
        };
      }
    }

    // Check entity index for direct entity mappings
    const source = this.entityIndex.get(entityId);
    if (source) {
      const currentData = source.getCurrentData();
      if (currentData) {
        return {
          state: currentData.v?.toString() || 'unavailable',
          attributes: {
            timestamp: currentData.t,
            source_type: 'datasource'
          }
        };
      }
    }

    // Fallback to HASS states directly
    if (this.hass.states && this.hass.states[entityId]) {
      const hassState = this.hass.states[entityId];
      return {
        state: hassState.state,
        attributes: hassState.attributes || {}
      };
    }

    return null;
  }

  /**
   * Resolve dot notation paths in aggregation/transformation data
   * @private
   * @param {Object} data - Data object to traverse
   * @param {string} path - Dot notation path
   * @returns {Object|null} Entity-like object or null
   */
  _resolveDataPath(data, path) {
    if (!data || typeof data !== 'object') return null;

    const pathParts = path.split('.');
    let current = data;

    // Skip first part if it's the category (aggregations/transformations)
    const startIndex = (pathParts[0] === 'aggregations' || pathParts[0] === 'transformations') ? 1 : 0;

    for (let i = startIndex; i < pathParts.length; i++) {
      if (current && typeof current === 'object') {
        current = current[pathParts[i]];
      } else {
        return null;
      }
    }

    // If we found a value, wrap it in entity-like format
    if (current !== undefined && current !== null) {
      return {
        state: current.toString(),
        attributes: {
          data_path: path,
          source_type: 'datasource_processed'
        }
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
   * Enhanced for sparkline real-time updates
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

    console.log(`[DataSourceManager] 🔗 Setting up subscription for ${overlay.id} to ${overlay.source}`);

    // Subscribe to the data source with enhanced data for sparklines
    const unsubscribe = source.subscribeWithMetadata?.((data) => {
      // Enhanced callback data for sparklines
      const enhancedData = {
        ...data,
        sourceId: overlay.source,
        overlayId: overlay.id,
        overlayType: overlay.type,
        // Include buffer reference for sparklines
        buffer: overlay.type === 'sparkline' ? data.buffer : undefined,
        // Include historical data if available
        historicalData: overlay.type === 'sparkline' && data.buffer ?
          data.buffer.getAll().map(point => ({ timestamp: point.t, value: point.v })) : undefined
      };

      // DEBUG: Log what we're about to send
      console.log(`[DataSourceManager] 📤 Calling callback for ${overlay.id}:`, {
        hasBuffer: !!enhancedData.buffer,
        bufferSize: enhancedData.buffer?.size?.() || 0,
        hasHistoricalData: !!enhancedData.historicalData,
        historicalDataLength: enhancedData.historicalData?.length || 0,
        currentValue: enhancedData.v
      });

      // Call the callback with overlay and enhanced update data
      callback(overlay, enhancedData);
    }, {
      // ADDED: Pass overlay metadata to the subscription
      overlayId: overlay.id,
      overlayType: overlay.type,
      component: 'OverlayManager'
    }) || source.subscribe((data) => {
      // Fallback if subscribeWithMetadata not available
      const enhancedData = {
        ...data,
        sourceId: overlay.source,
        overlayId: overlay.id,
        overlayType: overlay.type,
        buffer: overlay.type === 'sparkline' ? data.buffer : undefined,
        historicalData: overlay.type === 'sparkline' && data.buffer ?
          data.buffer.getAll().map(point => ({ timestamp: point.t, value: point.v })) : undefined
      };

      callback(overlay, enhancedData);
    });

    // CRITICAL: Provide immediate callback if data already exists
    // This fixes the timing issue where overlays subscribe after data is ready
    const currentData = source.getCurrentData();
    if (currentData && (currentData.buffer?.size?.() > 0 || currentData.v !== undefined)) {
      console.log(`[DataSourceManager] 🔄 Providing immediate data for ${overlay.id}`);

      const immediateData = {
        ...currentData,
        sourceId: overlay.source,
        overlayId: overlay.id,
        overlayType: overlay.type,
        buffer: overlay.type === 'sparkline' ? currentData.buffer : undefined,
        historicalData: overlay.type === 'sparkline' && currentData.buffer ?
          currentData.buffer.getAll().map(point => ({ timestamp: point.t, value: point.v })) : undefined
      };

      // Use setTimeout to avoid blocking the subscription setup
      setTimeout(() => {
        callback(overlay, immediateData);
      }, 0);
    }



    // Store the unsubscribe function
    if (!this.overlaySubscriptions.has(overlay.id)) {
      this.overlaySubscriptions.set(overlay.id, []);
    }
    this.overlaySubscriptions.get(overlay.id).push(unsubscribe);
    this._stats.subscriptionsActive++;

    console.log(`[DataSourceManager] ✅ Subscribed ${overlay.type} overlay ${overlay.id} to source ${overlay.source} (${source.subscribers?.size || 0} total subscribers)`);

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

  /**
   * Get a specific data source by ID
   * @param {string} id - Data source ID
   * @returns {MsdDataSource|null} The data source or null if not found
   */
  getDataSource(id) {
    return this._dataSources.get(id) || null;
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

  // ADDED: Basic subscriber information methods
  getSourceSubscribers(sourceName) {
    const source = this.sources.get(sourceName);
    return source?.getSubscriberInfo?.() || [];
  }

  getAllSubscribers() {
    const result = {};
    this.sources.forEach((source, name) => {
      result[name] = source.getSubscriberInfo?.() || [];
    });
    return result;
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
