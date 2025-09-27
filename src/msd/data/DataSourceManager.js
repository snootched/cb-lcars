import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * [DataSourceManager] Data source manager - manages multiple data sources and overlay subscriptions
 * 📊 Provides multi-source lifecycle management, overlay subscription system, and EntityRuntime API compatibility
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

    cblcarsLog.debug(`[DataSourceManager] 🚀 Initializing ${Object.keys(dataSourceConfigs || {}).length} data sources`);

    // Create all data sources from config
    const promises = Object.entries(dataSourceConfigs || {}).map(async ([name, config]) => {
      try {
        const source = await this.createDataSource(name, config);
        this._stats.sourcesCreated++;
        return source;
      } catch (error) {
        cblcarsLog.warn(`[DataSourceManager] ⚠️ Failed to create source ${name}:`, error);
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
    cblcarsLog.debug(`[DataSourceManager] ✅ Initialization complete: ${successful} successful, ${failed} failed`);

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
      cblcarsLog.warn(`[DataSourceManager] ⚠️ Failed to start source ${name}:`, error);
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

    cblcarsLog.debug(`[DataSourceManager] ⏳ Waiting for history preloading...`);

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
        cblcarsLog.debug(`[DataSourceManager] History loading progress: ${readySources}/${totalSources} sources ready`);
      }

      if (allReady || totalSources === 0) {
        cblcarsLog.debug(`[DataSourceManager] ✅ History preloading complete in ${Date.now() - startTime}ms`);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }

  // NEW: EntityRuntime compatibility methods
  getEntity(entityId) {
    // Handle dot notation for datasource references
    if (entityId.includes('.')) {
      const [sourceId, ...pathParts] = entityId.split('.');
      const source = this.sources.get(sourceId);

      if (source) {
        const currentData = source.getCurrentData();
        const path = pathParts.join('.');

        // Handle transformation paths
        if (path.startsWith('transformations.')) {
          return this._resolveDataPath(currentData, path, source, 'transformations');
        }

        // Handle aggregation paths
        if (path.startsWith('aggregations.')) {
          return this._resolveDataPath(currentData, path, source, 'aggregations');
        }

        // Default: return raw datasource data
        return {
          state: currentData.v?.toString() || 'unavailable',
          attributes: {
            timestamp: currentData.t,
            source_type: 'datasource',
            entity_id: sourceId,
            ...currentData.stats
          },
          // Provide methods for overlay access
          getHistoricalData: (count) => {
            try {
              return source.buffer.getRecent(count || 100);
            } catch (error) {
              cblcarsLog.warn(`[DataSourceManager] Error getting historical data for ${sourceId}:`, error);
              return [];
            }
          },
          getTransformedHistory: (transformKey, count) => {
            try {
              return source.getTransformedHistory(transformKey, count || 100);
            } catch (error) {
              cblcarsLog.warn(`[DataSourceManager] ⚠️ Error getting transformed history for ${sourceId}.${transformKey}:`, error);
              return [];
            }
          }
        };
      }
    }

    // Check if it's a simple datasource reference
    const source = this.sources.get(entityId);
    if (source) {
      const currentData = source.getCurrentData();
      const entityResult = {
        state: currentData.v?.toString() || 'unavailable',
        attributes: {
          timestamp: currentData.t,
          source_type: 'datasource',
          entity_id: entityId
        },
        getHistoricalData: (count) => {
          try {
            return source.buffer.getRecent(count || 100);
          } catch (error) {
            cblcarsLog.warn(`[DataSourceManager] ⚠️ Error getting historical data for ${entityId}:`, error);
            return [];
          }
        },
        getTransformedHistory: (transformKey, count) => {
          try {
            return source.getTransformedHistory(transformKey, count || 100);
          } catch (error) {
            cblcarsLog.warn(`[DataSourceManager] ⚠️ Error getting transformed history for ${entityId}.${transformKey}:`, error);
            return [];
          }
        },
        // NEW: Add subscription capability for real-time updates
        subscribe: (callback) => {
          return source.subscribe(callback);
        }
      };

      return entityResult;
    }

    // Check entity index for basic entity sources
    const entitySource = this.entityIndex.get(entityId);
    if (entitySource) {
      const currentData = entitySource.getCurrentData();
      return {
        state: currentData.v?.toString() || 'unavailable',
        attributes: {
          timestamp: currentData.t,
          source_type: 'entity_datasource'
        }
      };
    }

    // Final fallback to HASS states
    if (this.hass?.states?.[entityId]) {
      return this.hass.states[entityId];
    }

    return null;
  }

  /**
   * Resolve nested data paths for transformations and aggregations
   * @private
   * @param {Object} currentData - Current data from datasource
   * @param {string} path - Full dot notation path
   * @param {Object} source - Source object for historical data access
   * @param {string} dataType - 'transformations' or 'aggregations'
   * @returns {Object|null} Resolved entity-like object
   */
  _resolveDataPath(currentData, path, source, dataType) {
    const pathParts = path.split('.');
    let current = currentData;

    // Navigate through the path
    for (const part of pathParts) {
      if (current && typeof current === 'object' && current.hasOwnProperty(part)) {
        current = current[part];
      } else {
        return null;
      }
    }

    // If we found a value, create entity-like object
    if (current !== undefined && current !== null) {
      const entityResult = {
        state: current.toString(),
        attributes: {
          data_path: path,
          data_type: dataType,
          source_id: source.entity || 'unknown'
        },
        // NEW: Add subscription capability for dot notation entities
        subscribe: (callback) => {
          // Subscribe to the underlying source and filter for our specific transformation/aggregation
          return source.subscribe((data) => {
            const pathParts = path.split('.');
            let current = data;

            for (const part of pathParts) {
              if (current && typeof current === 'object' && current.hasOwnProperty(part)) {
                current = current[part];
              } else {
                current = null;
                break;
              }
            }

            if (current !== undefined && current !== null) {
              // Create entity-like data for the callback
              callback({
                state: current.toString(),
                attributes: {
                  data_path: path,
                  data_type: dataType,
                  source_id: source.entity || 'unknown'
                }
              });
            }
          });
        }
      };

      // For transformations, provide historical data access
      if (dataType === 'transformations') {
        const transformKey = pathParts[1]; // e.g., "celsius" from "transformations.celsius"
        entityResult.getHistoricalData = (count) => {
          try {
            return source.getTransformedHistory(transformKey, count || 100);
          } catch (error) {
            cblcarsLog.warn(`[DataSourceManager] ⚠️ Error getting transformed history for ${transformKey}:`, error);
            return [];
          }
        };
      }

      return entityResult;
    }    return null;
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
        cblcarsLog.warn('[DataSourceManager] ⚠️ Global entity listener error:', error);
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
      cblcarsLog.warn('[DataSourceManager] ⚠️ subscribeOverlay: No source specified for overlay', overlay.id);
      return;
    }

    const source = this.sources.get(overlay.source);
    if (!source) {
      cblcarsLog.warn('[DataSourceManager] ⚠️ subscribeOverlay: Source not found:', overlay.source);
      return;
    }

    cblcarsLog.debug(`[DataSourceManager] 🔗 Setting up subscription for ${overlay.id} to ${overlay.source}`);

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

      // Reduced debug logging for callback data

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
      cblcarsLog.debug(`[DataSourceManager] 🔄 Providing immediate data for ${overlay.id}`);

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

    cblcarsLog.debug(`[DataSourceManager] ✅ Subscribed ${overlay.type} overlay ${overlay.id} to source ${overlay.source} (${source.subscribers?.size || 0} total subscribers)`);

    return unsubscribe;
  }

  unsubscribeOverlay(overlayId) {
    const subscriptions = this.overlaySubscriptions.get(overlayId);
    if (subscriptions) {
      subscriptions.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          cblcarsLog.warn(`[DataSourceManager] ⚠️ Error unsubscribing overlay ${overlayId}:`, error);
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

  /**
   * Enhanced debugging method for transformation and aggregation inspection
   * @returns {Object} Comprehensive debug information
   */
  getDebugInfo() {
    const debugInfo = {
      sources: this.sources.size,
      entityIndex: this.entityIndex.size,
      enhanced_sources: [],
      dot_notation_test: {}
    };

    // Get debug info from all sources
    this.sources.forEach((source, id) => {
      if (typeof source.getDebugInfo === 'function') {
        debugInfo.enhanced_sources.push({
          id,
          ...source.getDebugInfo()
        });
      }
    });

    // Test dot notation access for enhanced sources
    this.sources.forEach((source, id) => {
      const currentData = source.getCurrentData();
      if (currentData.transformations && Object.keys(currentData.transformations).length > 0) {
        Object.keys(currentData.transformations).forEach(transformKey => {
          const dotPath = `${id}.transformations.${transformKey}`;
          const resolved = this.getEntity(dotPath);
          debugInfo.dot_notation_test[dotPath] = resolved ? resolved.state : 'null';
        });
      }

      if (currentData.aggregations && Object.keys(currentData.aggregations).length > 0) {
        Object.keys(currentData.aggregations).forEach(aggKey => {
          const dotPath = `${id}.aggregations.${aggKey}`;
          const resolved = this.getEntity(dotPath);
          debugInfo.dot_notation_test[dotPath] = resolved ? resolved.state : 'null';
        });
      }
    });

    return debugInfo;
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
        cblcarsLog.warn(`[DataSourceManager] ⚠️ Error stopping source ${name}:`, error);
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
