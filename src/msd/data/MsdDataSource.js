import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * [MsdDataSource] Data source implementation - provides real-time Home Assistant entity subscriptions
 * 📈 Features coalescing/throttling, history preload, rolling buffer management, and transformation processing
 */

import { RollingBuffer } from './RollingBuffer.js';
import { createTransformationProcessor } from './transformations/TransformationProcessor.js';
import { createAggregationProcessor } from './aggregations/index.js';

// Node.js polyfills for test environment
const isNode = typeof window === 'undefined';
const requestAnimationFrame = isNode
  ? (callback) => setTimeout(callback, 16) // 60fps approximation
  : window.requestAnimationFrame;
const cancelAnimationFrame = isNode
  ? (id) => clearTimeout(id)
  : window.cancelAnimationFrame;

export class MsdDataSource {
  constructor(cfg, hass) {
    this.cfg = { ...cfg };
    this.hass = hass;

    // Validate essential config
    if (!this.cfg.entity) {
      cblcarsLog.debug('[MsdDataSource] ⚠️ No entity specified in config');
      this.cfg.entity = '';
    }

    // This allows expressions to access entity attributes
    this._lastOriginalState = null;

    // PORT: Complete buffer sizing logic from original
    let wsSec = 60; // Default window
    if (typeof cfg.windowSeconds === 'number' && isFinite(cfg.windowSeconds)) {
      wsSec = Math.max(1, cfg.windowSeconds);
    } else if (typeof cfg.windowSeconds === 'string') {
      const ms = this._parseTimeWindowMs(cfg.windowSeconds);
      if (Number.isFinite(ms)) {
        wsSec = Math.max(1, Math.floor(ms / 1000));
      }
    }

    // Buffer capacity: aim for ~10 points per second for the window
    const capacity = Math.max(60, Math.floor(wsSec * 10));
    this.buffer = new RollingBuffer(capacity);

    // PORT: Complete timing configuration from original - MADE MORE AGGRESSIVE
    const minEmitMs = Number.isFinite(cfg.minEmitMs) ? cfg.minEmitMs
      : Number.isFinite(cfg.sampleMs) ? cfg.sampleMs : 100;

    this.minEmitMs = Math.max(10, minEmitMs);

    // MORE AGGRESSIVE coalescing by default
    this.coalesceMs = Number.isFinite(cfg.coalesceMs)
      ? Math.max(20, cfg.coalesceMs)  // Reduced from 30 to 20
      : Math.max(20, Math.round(this.minEmitMs * 0.4));  // Reduced from 0.6 to 0.4

    this.maxDelayMs = Number.isFinite(cfg.maxDelayMs)
      ? Math.max(this.minEmitMs, cfg.maxDelayMs)
      : Math.max(this.minEmitMs, this.coalesceMs * 3);  // Reduced from 4 to 3

    this.emitOnSameValue = cfg.emitOnSameValue !== false; // Default true

    // Subscription management
    this.subscribers = new Set();
    this.haUnsubscribe = null;

    // NEW: Transformation and aggregation processors
    this.transformations = new Map();
    this.aggregations = new Map();
    this.transformedBuffers = new Map();

    // NEW: Cache transformation execution order
    this._transformationOrder = null;
    this._transformationOrderValid = false;

    // PORT: Complete internal timing state from original
    this._lastEmitTime = 0;
    this._lastEmittedValue = null;
    this._pendingRaf = 0;
    this._pending = false;
    this._pendingFirstTs = 0;
    this._pendingCount = 0;

    // Performance statistics
    this._stats = {
      emits: 0,
      coalesced: 0,
      skipsSameValue: 0,
      received: 0,
      invalid: 0,
      historyLoaded: 0
    };

    // Lifecycle state
    this._started = false;
    this._destroyed = false;

    // ✅ NEW: Periodic update timer for time-based aggregations
    this._periodicUpdateInterval = null;
    this._periodicUpdateEnabled = false;

    // ✅ NEW: Entity metadata storage
    this.metadata = {
      unit_of_measurement: null,
      device_class: null,
      friendly_name: null,
      area: null,
      device_id: null,
      entity_id: this.cfg.entity,
      state_class: null,
      icon: null,
      last_changed: null,
      last_updated: null
    };

    // ✅ NEW: Apply config-level metadata overrides if provided
    if (cfg.metadata) {
      this._applyMetadataOverrides(cfg.metadata);
    }

    // Initialize processors from configuration (including profiles)
    this._initializeProcessors(cfg);
  }

  /**
   * Initialize transformation and aggregation processors from configuration
   * @private
   * @param {Object} cfg - Data source configuration
   */
  _initializeProcessors(cfg) {
    // NEW: Load transformation profiles first
    const profiles = this._loadTransformationProfiles(cfg);

    // Initialize transformations
    if (cfg.transformations && Array.isArray(cfg.transformations)) {
      cfg.transformations.forEach((transformConfig, index) => {
        try {
          const key = transformConfig.key || `transform_${index}`;

          // NEW: Check if this is a profile reference
          const expandedConfig = transformConfig.profile
            ? this._expandProfile(transformConfig.profile, profiles, transformConfig)
            : transformConfig;

          const processor = createTransformationProcessor({
            ...expandedConfig,
            hass: this.hass // Pass hass for multi-entity expressions
          });

          this.transformations.set(key, processor);

          // Create buffer for transformed historical data
          // FIXED: Use same capacity calculation as main buffer
          const wsSec = this._getWindowSeconds();
          const capacity = Math.max(60, Math.floor(wsSec * 10));
          this.transformedBuffers.set(key, new RollingBuffer(capacity));

          cblcarsLog.trace(`[MsdDataSource] ✓ Initialized transformation: ${key} (${expandedConfig.type})`);
        } catch (error) {
          cblcarsLog.error(`[MsdDataSource] ❌ Failed to initialize transformation ${transformConfig.type}:`, error);
        }
      });
    }

    if (cfg.aggregations) {
      // Validate aggregations is an array
      if (!Array.isArray(cfg.aggregations)) {
        cblcarsLog.error(
          `[MsdDataSource] ❌ Aggregations must be an array for ${this.cfg.entity}.\n` +
          `  Found: ${typeof cfg.aggregations}\n` +
          `  Use: aggregations: [{ type: "min_max", key: "daily_stats" }]`
        );
        return; // Skip aggregations initialization
      }

      cfg.aggregations.forEach((config, index) => {
        try {
          // Validate required fields
          if (!config.type) {
            cblcarsLog.error(
              `[MsdDataSource] ❌ Aggregation at index ${index} missing required "type" property`
            );
            return;
          }

          if (!config.key) {
            cblcarsLog.error(
              `[MsdDataSource] ❌ Aggregation at index ${index} missing required "key" property`
            );
            return;
          }

          // Create aggregation processor
          const processor = createAggregationProcessor(config.type, config);
          this.aggregations.set(config.key, processor);

          cblcarsLog.debug(
            `[MsdDataSource] ✓ Initialized aggregation: ${config.key} (${config.type})`
          );
        } catch (error) {
          cblcarsLog.error(
            `[MsdDataSource] ❌ Failed to initialize aggregation ${config.type}:`,
            error
          );
        }
      });
    }

    // NEW: Validate transformation chains after initialization
    this._validateTransformationChains();

    cblcarsLog.trace(
      `[MsdDataSource] Processor initialization complete: ` +
      `${this.transformations.size} transformations, ${this.aggregations.size} aggregations`
    );
  }

  /**
   * NEW: Load transformation profiles from config
   * @private
   * @param {Object} cfg - Configuration
   * @returns {Object} Map of profile names to transformation arrays
   */
  _loadTransformationProfiles(cfg) {
    const profiles = {};

    // Global profiles (could be loaded from separate config file)
    profiles.temperature_comfort = [
      { type: 'unit_conversion', conversion: 'f_to_c', key: 'celsius' },
      { type: 'scale', input_source: 'celsius', input_range: [-10, 35], output_range: [0, 100], key: 'comfort' }
    ];

    profiles.power_analysis = [
      { type: 'unit_conversion', conversion: 'w_to_kw', key: 'kw' },
      { type: 'smooth', input_source: 'kw', method: 'median', window_size: 5, key: 'kw_clean' },
      { type: 'statistical', input_source: 'kw_clean', method: 'z_score', window_size: 100, key: 'anomaly' }
    ];

    profiles.signal_processing = [
      { type: 'smooth', method: 'median', window_size: 3, key: 'outliers_removed' },
      { type: 'smooth', input_source: 'outliers_removed', method: 'moving_average', window_size: 5, key: 'noise_reduced' },
      { type: 'smooth', input_source: 'noise_reduced', method: 'exponential', alpha: 0.1, key: 'trend' }
    ];

    // Merge with config-specific profiles
    if (cfg.transformation_profiles) {
      Object.assign(profiles, cfg.transformation_profiles);
    }

    return profiles;
  }

  /**
   * NEW: Expand a profile reference into actual transformations
   * @private
   * @param {string} profileName - Profile name
   * @param {Object} profiles - Available profiles
   * @param {Object} overrides - Configuration overrides
   * @returns {Object} Expanded transformation config
   */
  _expandProfile(profileName, profiles, overrides = {}) {
    const profile = profiles[profileName];
    if (!profile) {
      throw new Error(`Unknown transformation profile: ${profileName}`);
    }

    // For single transform from profile, merge with overrides
    if (Array.isArray(profile)) {
      throw new Error(`Profile '${profileName}' is an array - use transformations: { profile: '${profileName}' } at array level`);
    }

    return { ...profile, ...overrides };
  }

  /**
   * NEW: Get window seconds for capacity calculation
   * @private
   * @returns {number} Window in seconds
   */
  _getWindowSeconds() {
    let wsSec = 60; // Default window
    if (typeof this.cfg.windowSeconds === 'number' && isFinite(this.cfg.windowSeconds)) {
      wsSec = Math.max(1, this.cfg.windowSeconds);
    } else if (typeof this.cfg.windowSeconds === 'string') {
      const ms = this._parseTimeWindowMs(this.cfg.windowSeconds);
      if (Number.isFinite(ms)) {
        wsSec = Math.max(1, Math.floor(ms / 1000));
      }
    }
    return wsSec;
  }

  /**
   * NEW: Validate transformation chains for common errors
   * @private
   */
  _validateTransformationChains() {
    const errors = [];

    this.transformations.forEach((processor, key) => {
      const inputSource = processor.config.input_source;

      if (inputSource) {
        // Check source exists
        if (!this.transformations.has(inputSource)) {
          errors.push(`Transform '${key}' references non-existent source '${inputSource}'`);
        }

        // Check for self-reference
        if (inputSource === key) {
          errors.push(`Transform '${key}' cannot reference itself`);
        }
      }
    });

    if (errors.length > 0) {
      const errorMsg = `Transform chain validation failed:\n  ${errors.join('\n  ')}`;
      cblcarsLog.error(`[MsdDataSource] ❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * NEW: Determine execution order for transformations based on dependencies
   * Uses topological sort (Kahn's algorithm) to handle chained transformations
   * @private
   * @returns {Array<string>} Ordered array of transformation keys
   */
  _determineTransformationOrder() {
    // Return cached order if valid
    if (this._transformationOrderValid && this._transformationOrder) {
      return this._transformationOrder;
    }

    const keys = Array.from(this.transformations.keys());

    // Quick path: no transformations
    if (keys.length === 0) {
      this._transformationOrder = [];
      this._transformationOrderValid = true;
      return [];
    }

    // Quick path: check if any transform uses input_source
    const hasChaining = Array.from(this.transformations.values())
      .some(p => p.config.input_source);

    if (!hasChaining) {
      // No chaining - return original order (parallel processing)
      this._transformationOrder = keys;
      this._transformationOrderValid = true;
      return keys;
    }

    // Build dependency graph
    const graph = new Map();
    const inDegree = new Map();

    keys.forEach(key => {
      graph.set(key, []);
      inDegree.set(key, 0);
    });

    keys.forEach(key => {
      const processor = this.transformations.get(key);
      const inputSource = processor.config.input_source;

      if (inputSource) {
        // Add edge: inputSource -> key
        if (graph.has(inputSource)) {
          graph.get(inputSource).push(key);
          inDegree.set(key, inDegree.get(key) + 1);
        }
      }
    });

    // Topological sort using Kahn's algorithm
    const queue = [];
    const result = [];

    // Start with nodes that have no dependencies
    inDegree.forEach((degree, key) => {
      if (degree === 0) {
        queue.push(key);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift();
      result.push(current);

      // Reduce in-degree for dependent nodes
      graph.get(current).forEach(dependent => {
        inDegree.set(dependent, inDegree.get(dependent) - 1);
        if (inDegree.get(dependent) === 0) {
          queue.push(dependent);
        }
      });
    }

    // Detect cycles
    if (result.length !== keys.length) {
      const remaining = keys.filter(k => !result.includes(k));
      const involved = remaining.map(k => {
        const src = this.transformations.get(k).config.input_source;
        return `${k} → ${src}`;
      }).join(', ');

      cblcarsLog.error(
        `[MsdDataSource] ❌ Circular dependency detected in transformations: ${involved}\n` +
        `  Falling back to config order (chaining will not work correctly)`
      );

      // Return original order as fallback
      this._transformationOrder = keys;
      this._transformationOrderValid = true;
      return keys;
    }

    // Cache and return
    this._transformationOrder = result;
    this._transformationOrderValid = true;

    cblcarsLog.trace(`[MsdDataSource] Transformation execution order: ${result.join(' → ')}`);

    return result;
  }

  /**
   * ENHANCED: Preload historical data with multiple fallback strategies
   * @private
   */
  async _preloadHistory() {
    if (!this.hass?.callService || !this.cfg.entity) return;

    // Check if history is enabled in config
    const historyConfig = this.cfg.history || {};
    if (historyConfig.enabled === false) return;

    const hours = Math.max(1, Math.min(168, historyConfig.hours || 6));
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 3600000);

    cblcarsLog.debug(`[MsdDataSource] 📊 Preloading ${hours}h history for ${this.cfg.entity}`);

    try {
      // Strategy 1: Try Home Assistant's history service (most reliable)
      await this._preloadWithHistoryService(startTime, endTime);
    } catch (error) {
      cblcarsLog.warn(`[MsdDataSource] History service failed for ${this.cfg.entity}, trying statistics:`, error.message);

      try {
        // Strategy 2: Fall back to enhanced statistics
        await this._preloadWithStatistics(startTime, endTime);
      } catch (statError) {
        cblcarsLog.warn(`[MsdDataSource] Statistics failed, trying state history:`, statError.message);
        // Strategy 3: Final fallback (existing _preloadStateHistory method)
        await this._preloadStateHistory(startTime, endTime);
      }
    }

    cblcarsLog.debug(`[MsdDataSource] History preload complete: ${this._stats.historyLoaded} points loaded`);
  }

  /**
   * NEW: Primary history loading using HA history service
   * @private
   * @param {Date} startTime - Start time for history query
   * @param {Date} endTime - End time for history query
   */
  async _preloadWithHistoryService(startTime, endTime) {
    const response = await this.hass.callService('history', 'get_history', {
      entity_ids: [this.cfg.entity],
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString()
    });

    if (response && response[0]) {
      const states = response[0];
      cblcarsLog.trace(`[MsdDataSource] History service returned states for ${this.cfg.entity}`);

      for (const state of states) {
        const timestamp = new Date(state.last_changed || state.last_updated).getTime();

        // ✅ ENHANCED: Support nested attribute paths
        let rawValue;
        if (this.cfg.attribute_path) {
          rawValue = this._extractNestedAttribute(state.attributes, this.cfg.attribute_path);
        } else if (this.cfg.attribute) {
          rawValue = state.attributes?.[this.cfg.attribute];
        } else {
          rawValue = state.state;
        }

        const value = this._toNumber(rawValue);

        if (value !== null) {
          this.buffer.push(timestamp, value);
          this._updateAggregations(timestamp, value, {});
          this._stats.historyLoaded++;
        }
      }
    }
  }

  /**
   * ENHANCED: Statistics-based history loading with finer granularity
   * @private
   * @param {Date} startTime - Start time for history query
   * @param {Date} endTime - End time for history query
   */
  async _preloadWithStatistics(startTime, endTime) {
    // Use 5-minute periods for more granular data
    const response = await this.hass.callService('recorder', 'get_statistics', {
      statistic_ids: [this.cfg.entity],
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      period: '5minute'  // Changed from 'hour' to '5minute'
    });

    if (response && response[0]?.statistics) {
      const statistics = response[0].statistics;
      cblcarsLog.trace(`[MsdDataSource] Statistics returned points for ${this.cfg.entity}`);

      for (const stat of statistics) {
        const timestamp = new Date(stat.start).getTime();
        const value = this._extractStatisticValue(stat);

        if (value !== null) {
          this.buffer.push(timestamp, value);
          this._updateAggregations(timestamp, value, {});
          this._stats.historyLoaded++;
        }
      }
    }
  }

  /**
   * Start the data source with proper initialization sequence
   * @returns {Promise} Resolves when fully initialized
   */
  async start() {
    if (this._started || this._destroyed) return;

    try {
      cblcarsLog.trace(`[MsdDataSource] 🚀 Starting initialization for ${this.cfg.entity}`);

      // STEP 1: Preload historical data FIRST
      if (this.hass?.callService) {
        await this._preloadHistory();
      }

      // STEP 2: Initialize with current HASS state if available
      if (this.hass.states && this.hass.states[this.cfg.entity]) {
        const currentState = this.hass.states[this.cfg.entity];

        // ✅ NEW: Extract metadata from initial state
        this._extractMetadata(currentState);

        cblcarsLog.trace(`[MsdDataSource] 🔄 Loading initial state for ${this.cfg.entity}:`, currentState.state);

                // ENHANCED: Capture unit_of_measurement from initial state
        if (currentState.attributes?.unit_of_measurement) {
          this.cfg.unit_of_measurement = currentState.attributes.unit_of_measurement;
          cblcarsLog.trace(`[MsdDataSource] 📊 Captured initial unit_of_measurement for ${this.cfg.entity}: "${this.cfg.unit_of_measurement}"`);
        }

        // FIXED: Use current timestamp for initial state
        const currentTimestamp = Date.now();
        const rawValue = this.cfg.attribute ? currentState.attributes?.[this.cfg.attribute] : currentState.state;
        const value = this._toNumber(rawValue);

        if (value !== null) {
          cblcarsLog.trace(`[MsdDataSource] Adding current state: ${value} at ${currentTimestamp}`);
          this.buffer.push(currentTimestamp, value);
          this._stats.currentValue = value;
        }
      }

      // STEP 3: Setup real-time subscriptions
      this.haUnsubscribe = await this.hass.connection.subscribeEvents((event) => {
        if (event.event_type === 'state_changed' &&
            event.data?.entity_id === this.cfg.entity) {
          cblcarsLog.trace(`[MsdDataSource] 📊 HA event received for ${this.cfg.entity}:`, event.data.new_state?.state);
          this._handleStateChange(event.data);
        }
      }, 'state_changed');

      this._started = true;
      cblcarsLog.trace(`[MsdDataSource] ✅ Full initialization complete for ${this.cfg.entity} - Buffer: ${this.buffer.size()} points`);

      // STEP 4: Process historical data through transformations
      this._processHistoricalTransformations();

      // STEP 5: Emit initial data to any existing subscribers
      this._emitInitialData();

      // ✅ NEW: STEP 6: Start periodic updates for time-based aggregations
      this._startPeriodicUpdates();

    } catch (error) {
      cblcarsLog.error(`[MsdDataSource] ❌ Failed to initialize ${this.cfg.entity}:`, error);
      throw error;
    }
  }

  /**
   * Start periodic updates for time-based aggregations
   * @private
   */
  _startPeriodicUpdates() {
    // Check if we have time-based aggregations
    const hasTimeBased = Array.from(this.aggregations.values()).some(agg =>
      agg.type === 'duration' ||
      agg.type === 'session_stats' ||
      agg.config.requires_periodic_update
    );

    if (!hasTimeBased) {
      return; // No time-based aggregations, don't start timer
    }

    // Determine update interval (default 1 second for smooth time display)
    const updateInterval = this.cfg.periodic_update_interval || 1000;

    cblcarsLog.debug(
      `[MsdDataSource] 🕐 Starting periodic updates for ${this.cfg.entity} ` +
      `(interval: ${updateInterval}ms)`
    );

    this._periodicUpdateEnabled = true;
    this._periodicUpdateInterval = setInterval(() => {
      if (!this._periodicUpdateEnabled || this._destroyed) {
        this._stopPeriodicUpdates();
        return;
      }

      // Recalculate time-based aggregations
      const timestamp = Date.now();
      const lastValue = this.buffer.last()?.v;

      if (lastValue !== null && lastValue !== undefined) {
        // Update aggregations with current timestamp
        // This allows duration aggregations to recalculate elapsed time
        this.aggregations.forEach((processor, key) => {
          if (processor.type === 'duration' || processor.type === 'session_stats') {
            try {
              // Force recalculation without adding a new value
              processor._calculate();
            } catch (error) {
              cblcarsLog.warn(`[MsdDataSource] Periodic aggregation update failed for ${key}:`, error);
            }
          }
        });

        // Emit updated data to subscribers
        const emitData = {
          t: timestamp,
          v: lastValue,
          buffer: this.buffer,
          stats: { ...this._stats },
          transformations: this._getTransformationData(),
          aggregations: this._getAggregationData(),
          entity: this.cfg.entity,
          unit_of_measurement: this.cfg.unit_of_measurement,
          historyReady: this._stats.historyLoaded > 0,
          isPeriodicUpdate: true  // Flag to indicate this is a periodic update
        };

        this.subscribers.forEach((callback) => {
          try {
            callback(emitData);
          } catch (error) {
            cblcarsLog.error(`[MsdDataSource] Periodic update callback failed:`, error);
          }
        });
      }
    }, updateInterval);
  }

  /**
   * Stop periodic updates
   * @private
   */
  _stopPeriodicUpdates() {
    if (this._periodicUpdateInterval) {
      clearInterval(this._periodicUpdateInterval);
      this._periodicUpdateInterval = null;
      this._periodicUpdateEnabled = false;
      cblcarsLog.debug(`[MsdDataSource] 🕐 Stopped periodic updates for ${this.cfg.entity}`);
    }
  }

  /**
   * NEW: Emit initial data to subscribers after full initialization
   * @private
   */
  _emitInitialData() {
    if (this.subscribers.size > 0) {
      const lastPoint = this.buffer.last();
      if (lastPoint) {
        cblcarsLog.trace(`[MsdDataSource] 📤 Emitting initial data for ${this.cfg.entity} to ${this.subscribers.size} subscribers`);
        const emitData = {
          t: lastPoint.t,
          v: lastPoint.v,
          buffer: this.buffer,
          stats: { ...this._stats },
          transformations: this._getTransformationData(), // Convert Map to Object
          aggregations: this._getAggregationData(),       // Convert Map to Object
          entity: this.cfg.entity,
          unit_of_measurement: this.cfg.unit_of_measurement,
          historyReady: this._stats.historyLoaded > 0,
          isInitialEmission: true // NEW: Flag to indicate this is initial data
        };

        this.subscribers.forEach(callback => {
          try {
            callback(emitData);
          } catch (error) {
            cblcarsLog.error(`[MsdDataSource] Initial callback error for ${this.cfg.entity}:`, error);
          }
        });
      } else {
        // Even if no buffer data, emit initial structure for consistency
        cblcarsLog.trace(`[MsdDataSource] 📤 Emitting initial empty data structure for ${this.cfg.entity} to ${this.subscribers.size} subscribers`);
        const emitData = {
          t: null,
          v: null,
          buffer: this.buffer,
          stats: { ...this._stats },
          transformations: this._getTransformationData(),
          aggregations: this._getAggregationData(),
          entity: this.cfg.entity,
          unit_of_measurement: this.cfg.unit_of_measurement,
          historyReady: this._stats.historyLoaded > 0,
          isInitialEmission: true
        };

        this.subscribers.forEach(callback => {
          try {
            callback(emitData);
          } catch (error) {
            cblcarsLog.error(`[MsdDataSource] Initial callback error for ${this.cfg.entity}:`, error);
          }
        });
      }
    }
  }

  async _preloadHistory() {
    if (!this.hass?.connection || !this.cfg.entity) {
      cblcarsLog.warn('[MsdDataSource] ⚠️ No HASS connection or entity for history preload');
      return;
    }

    const hours = Math.max(1, Math.min(168, this.cfg.history?.hours || 6)); // 1-168 hours
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 3600000);

    cblcarsLog.trace(`[MsdDataSource] 🔄 Preloading history for ${this.cfg.entity}`);

    try {
      // Use modern WebSocket call for statistics (preferred)
      const statisticsData = await this.hass.connection.sendMessagePromise({
        type: 'recorder/statistics_during_period',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        statistic_ids: [this.cfg.entity],
        period: 'hour'
      });

      if (statisticsData && statisticsData[this.cfg.entity]) {
        const statistics = statisticsData[this.cfg.entity];
        cblcarsLog.trace(`[MsdDataSource] 📊 Got statistics points`,statistics);

        for (const stat of statistics) {
          const timestamp = new Date(stat.start).getTime();
          const value = this._extractStatisticValue(stat);

          if (value !== null) {
            this.buffer.push(timestamp, value);
            this._updateAggregations(timestamp, value, {});
            this._stats.historyLoaded++;
          }
        }

        cblcarsLog.trace(`[MsdDataSource] ✅ Loaded statistics points`);
        return; // Success with statistics
      }
    } catch (error) {
      cblcarsLog.warn('[MsdDataSource] ⚠️ Statistics failed, trying state history:', error.message);
    }

    // Fallback: try state history via WebSocket
    await this._preloadStateHistoryWS(startTime, endTime);
  }

  async _preloadStateHistoryWS(startTime, endTime) {
    try {
      cblcarsLog.trace(`[MsdDataSource] 📚 Trying WebSocket state history for ${this.cfg.entity}`);

      // Use modern WebSocket call for history
      const historyData = await this.hass.connection.sendMessagePromise({
        type: 'history/history_during_period',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        entity_ids: [this.cfg.entity],
        minimal_response: true,
        no_attributes: true
      });

      if (historyData && historyData[0]) {
        const states = historyData[0];
        cblcarsLog.trace(`[MsdDataSource] 📊 Got history states`);

        for (const state of states) {
          const timestamp = new Date(state.last_changed || state.last_updated).getTime();

          // ✅ ENHANCED: Support nested attribute paths
          let rawValue;
          if (this.cfg.attribute_path) {
            rawValue = this._extractNestedAttribute(state.attributes, this.cfg.attribute_path);
          } else if (this.cfg.attribute) {
            rawValue = state.attributes?.[this.cfg.attribute];
          } else {
            rawValue = state.state;
          }

          const value = this._toNumber(rawValue);

          if (value !== null) {
            this.buffer.push(timestamp, value);
            this._updateAggregations(timestamp, value, {});
            this._stats.historyLoaded++;
          }
        }

        cblcarsLog.trace(`[MsdDataSource] ✅ Loaded history points`);
      } else {
        // Debug only: Entity may not have history yet (new entity, HA just started, or history not enabled)
        cblcarsLog.trace('[MsdDataSource] No history data returned from WebSocket call (may be unavailable)');
      }
    } catch (error) {
      cblcarsLog.error('[MsdDataSource] ❌ WebSocket state history also failed:', error);

      // Final fallback: try direct REST API if available
      await this._preloadHistoryREST(startTime, endTime);
    }
  }

  async _preloadHistoryREST(startTime, endTime) {
    try {
      cblcarsLog.debug(`[MsdDataSource] 🌐 Trying REST API history for ${this.cfg.entity}`);

      const startParam = startTime.toISOString();
      const url = `/api/history/period/${startParam}?filter_entity_id=${this.cfg.entity}&minimal_response&no_attributes`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.hass.auth?.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const historyData = await response.json();

      if (historyData && historyData[0]) {
        const states = historyData[0];
        cblcarsLog.trace(`[MsdDataSource] 📊 Got history states`);

        for (const state of states) {
          const timestamp = new Date(state.last_changed || state.last_updated).getTime();

          // ✅ ENHANCED: Support nested attribute paths
          let rawValue;
          if (this.cfg.attribute_path) {
            rawValue = this._extractNestedAttribute(state.attributes, this.cfg.attribute_path);
          } else if (this.cfg.attribute) {
            rawValue = state.attributes?.[this.cfg.attribute];
          } else {
            rawValue = state.state;
          }

          const value = this._toNumber(rawValue);

          if (value !== null) {
            this.buffer.push(timestamp, value);
            this._updateAggregations(timestamp, value, {});
            this._stats.historyLoaded++;
          }
        }

        cblcarsLog.trace(`[MsdDataSource] ✅ Loaded history points`);
      }
    } catch (error) {
      cblcarsLog.error('[MsdDataSource] ❌ REST history fallback also failed:', error);
    }
  }

  /**
   * Apply user-specified metadata overrides from configuration
   * @private
   * @param {Object} metadataConfig - User-provided metadata object
   */
  _applyMetadataOverrides(metadataConfig) {
    if (!metadataConfig || typeof metadataConfig !== 'object') return;

    // Track which properties have been explicitly set by user
    this._metadataOverrides = {};

    // Apply overrides for supported properties
    const supportedProperties = [
      'unit_of_measurement',
      'device_class',
      'friendly_name',
      'state_class',
      'icon',
      'area',
      'device_id'
    ];

    supportedProperties.forEach(prop => {
      if (metadataConfig.hasOwnProperty(prop)) {
        this.metadata[prop] = metadataConfig[prop];
        this._metadataOverrides[prop] = true; // Mark as user-overridden

        if (this.cfg.debug) {
          cblcarsLog.trace(`[MsdDataSource] 🔧 Config override for ${this.cfg.entity || 'computed'}.metadata.${prop}: "${metadataConfig[prop]}"`);
        }
      }
    });
  }

  /**
   * Extract and store entity metadata from Home Assistant state
   * @private
   * @param {Object} entityState - Home Assistant entity state object
   */
  _extractMetadata(entityState) {
    if (!entityState) return;

    const attributes = entityState.attributes || {};

    // Core metadata - only extract if not overridden by config
    if (!this._metadataOverrides?.unit_of_measurement) {
      this.metadata.unit_of_measurement = attributes.unit_of_measurement || null;
    }
    if (!this._metadataOverrides?.device_class) {
      this.metadata.device_class = attributes.device_class || null;
    }
    if (!this._metadataOverrides?.friendly_name) {
      this.metadata.friendly_name = attributes.friendly_name || entityState.entity_id;
    }
    if (!this._metadataOverrides?.state_class) {
      this.metadata.state_class = attributes.state_class || null;
    }
    if (!this._metadataOverrides?.icon) {
      this.metadata.icon = attributes.icon || null;
    }

    // Timestamps - always update from entity
    this.metadata.last_changed = entityState.last_changed;
    this.metadata.last_updated = entityState.last_updated;

    // Device and area information (if available and not overridden)
    if (!this._metadataOverrides?.device_id && attributes.device_id) {
      this.metadata.device_id = attributes.device_id;
    }

    // Try to get area from device registry (if not overridden)
    if (!this._metadataOverrides?.area && this.hass?.entities?.[this.cfg.entity]) {
      const entityInfo = this.hass.entities[this.cfg.entity];
      this.metadata.area = entityInfo.area_id || null;
    }

    // Log captured metadata
    if (this.cfg.debug) {
      cblcarsLog.debug(`[MsdDataSource] 📊 Captured metadata for ${this.cfg.entity}:`, {
        unit: this.metadata.unit_of_measurement,
        device_class: this.metadata.device_class,
        friendly_name: this.metadata.friendly_name,
        overridden: Object.keys(this._metadataOverrides || {})
      });
    }
  }

  /**
   * NEW: Get window seconds for capacity calculation
   * @private
   * @returns {number} Window in seconds
   */
  _getWindowSeconds() {
    let wsSec = 60; // Default window
    if (typeof this.cfg.windowSeconds === 'number' && isFinite(this.cfg.windowSeconds)) {
      wsSec = Math.max(1, this.cfg.windowSeconds);
    } else if (typeof this.cfg.windowSeconds === 'string') {
      const ms = this._parseTimeWindowMs(this.cfg.windowSeconds);
      if (Number.isFinite(ms)) {
        wsSec = Math.max(1, Math.floor(ms / 1000));
      }
    }
    return wsSec;
  }

  /**
   * NEW: Validate transformation chains for common errors
   * @private
   */
  _validateTransformationChains() {
    const errors = [];

    this.transformations.forEach((processor, key) => {
      const inputSource = processor.config.input_source;

      if (inputSource) {
        // Check source exists
        if (!this.transformations.has(inputSource)) {
          errors.push(`Transform '${key}' references non-existent source '${inputSource}'`);
        }

        // Check for self-reference
        if (inputSource === key) {
          errors.push(`Transform '${key}' cannot reference itself`);
        }
      }
    });

    if (errors.length > 0) {
      const errorMsg = `Transform chain validation failed:\n  ${errors.join('\n  ')}`;
      cblcarsLog.error(`[MsdDataSource] ❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * NEW: Determine execution order for transformations based on dependencies
   * Uses topological sort (Kahn's algorithm) to handle chained transformations
   * @private
   * @returns {Array<string>} Ordered array of transformation keys
   */
  _determineTransformationOrder() {
    // Return cached order if valid
    if (this._transformationOrderValid && this._transformationOrder) {
      return this._transformationOrder;
    }

    const keys = Array.from(this.transformations.keys());

    // Quick path: no transformations
    if (keys.length === 0) {
      this._transformationOrder = [];
      this._transformationOrderValid = true;
      return [];
    }

    // Quick path: check if any transform uses input_source
    const hasChaining = Array.from(this.transformations.values())
      .some(p => p.config.input_source);

    if (!hasChaining) {
      // No chaining - return original order (parallel processing)
      this._transformationOrder = keys;
      this._transformationOrderValid = true;
      return keys;
    }

    // Build dependency graph
    const graph = new Map();
    const inDegree = new Map();

    keys.forEach(key => {
      graph.set(key, []);
      inDegree.set(key, 0);
    });

    keys.forEach(key => {
      const processor = this.transformations.get(key);
      const inputSource = processor.config.input_source;

      if (inputSource) {
        // Add edge: inputSource -> key
        if (graph.has(inputSource)) {
          graph.get(inputSource).push(key);
          inDegree.set(key, inDegree.get(key) + 1);
        }
      }
    });

    // Topological sort using Kahn's algorithm
    const queue = [];
    const result = [];

    // Start with nodes that have no dependencies
    inDegree.forEach((degree, key) => {
      if (degree === 0) {
        queue.push(key);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift();
      result.push(current);

      // Reduce in-degree for dependent nodes
      graph.get(current).forEach(dependent => {
        inDegree.set(dependent, inDegree.get(dependent) - 1);
        if (inDegree.get(dependent) === 0) {
          queue.push(dependent);
        }
      });
    }

    // Detect cycles
    if (result.length !== keys.length) {
      const remaining = keys.filter(k => !result.includes(k));
      const involved = remaining.map(k => {
        const src = this.transformations.get(k).config.input_source;
        return `${k} → ${src}`;
      }).join(', ');

      cblcarsLog.error(
        `[MsdDataSource] ❌ Circular dependency detected in transformations: ${involved}\n` +
        `  Falling back to config order (chaining will not work correctly)`
      );

      // Return original order as fallback
      this._transformationOrder = keys;
      this._transformationOrderValid = true;
      return keys;
    }

    // Cache and return
    this._transformationOrder = result;
    this._transformationOrderValid = true;

    cblcarsLog.trace(`[MsdDataSource] Transformation execution order: ${result.join(' → ')}`);

    return result;
  }

  /**
   * ENHANCED: Preload historical data with multiple fallback strategies
   * @private
   */
  async _preloadHistory() {
    if (!this.hass?.callService || !this.cfg.entity) return;

    // Check if history is enabled in config
    const historyConfig = this.cfg.history || {};
    if (historyConfig.enabled === false) return;

    const hours = Math.max(1, Math.min(168, historyConfig.hours || 6));
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 3600000);

    cblcarsLog.debug(`[MsdDataSource] 📊 Preloading ${hours}h history for ${this.cfg.entity}`);

    try {
      // Strategy 1: Try Home Assistant's history service (most reliable)
      await this._preloadWithHistoryService(startTime, endTime);
    } catch (error) {
      cblcarsLog.warn(`[MsdDataSource] History service failed for ${this.cfg.entity}, trying statistics:`, error.message);

      try {
        // Strategy 2: Fall back to enhanced statistics
        await this._preloadWithStatistics(startTime, endTime);
      } catch (statError) {
        cblcarsLog.warn(`[MsdDataSource] Statistics failed, trying state history:`, statError.message);
        // Strategy 3: Final fallback (existing _preloadStateHistory method)
        await this._preloadStateHistory(startTime, endTime);
      }
    }

    cblcarsLog.debug(`[MsdDataSource] History preload complete: ${this._stats.historyLoaded} points loaded`);
  }

  /**
   * NEW: Primary history loading using HA history service
   * @private
   * @param {Date} startTime - Start time for history query
   * @param {Date} endTime - End time for history query
   */
  async _preloadWithHistoryService(startTime, endTime) {
    const response = await this.hass.callService('history', 'get_history', {
      entity_ids: [this.cfg.entity],
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString()
    });

    if (response && response[0]) {
      const states = response[0];
      cblcarsLog.trace(`[MsdDataSource] History service returned states for ${this.cfg.entity}`);

      for (const state of states) {
        const timestamp = new Date(state.last_changed || state.last_updated).getTime();

        // ✅ ENHANCED: Support nested attribute paths
        let rawValue;
        if (this.cfg.attribute_path) {
          rawValue = this._extractNestedAttribute(state.attributes, this.cfg.attribute_path);
        } else if (this.cfg.attribute) {
          rawValue = state.attributes?.[this.cfg.attribute];
        } else {
          rawValue = state.state;
        }

        const value = this._toNumber(rawValue);

        if (value !== null) {
          this.buffer.push(timestamp, value);
          this._updateAggregations(timestamp, value, {});
          this._stats.historyLoaded++;
        }
      }
    }
  }

  /**
   * ENHANCED: Statistics-based history loading with finer granularity
   * @private
   * @param {Date} startTime - Start time for history query
   * @param {Date} endTime - End time for history query
   */
  async _preloadWithStatistics(startTime, endTime) {
    // Use 5-minute periods for more granular data
    const response = await this.hass.callService('recorder', 'get_statistics', {
      statistic_ids: [this.cfg.entity],
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      period: '5minute'  // Changed from 'hour' to '5minute'
    });

    if (response && response[0]?.statistics) {
      const statistics = response[0].statistics;
      cblcarsLog.trace(`[MsdDataSource] Statistics returned points for ${this.cfg.entity}`);

      for (const stat of statistics) {
        const timestamp = new Date(stat.start).getTime();
        const value = this._extractStatisticValue(stat);

        if (value !== null) {
          this.buffer.push(timestamp, value);
          this._updateAggregations(timestamp, value, {});
          this._stats.historyLoaded++;
        }
      }
    }
  }

  /**
   * Start the data source with proper initialization sequence
   * @returns {Promise} Resolves when fully initialized
   */
  async start() {
    if (this._started || this._destroyed) return;

    try {
      cblcarsLog.trace(`[MsdDataSource] 🚀 Starting initialization for ${this.cfg.entity}`);

      // STEP 1: Preload historical data FIRST
      if (this.hass?.callService) {
        await this._preloadHistory();
      }

      // STEP 2: Initialize with current HASS state if available
      if (this.hass.states && this.hass.states[this.cfg.entity]) {
        const currentState = this.hass.states[this.cfg.entity];

        // ✅ NEW: Extract metadata from initial state
        this._extractMetadata(currentState);

        cblcarsLog.trace(`[MsdDataSource] 🔄 Loading initial state for ${this.cfg.entity}:`, currentState.state);

      // ENHANCED: Capture unit_of_measurement from initial state
      if (currentState.attributes?.unit_of_measurement) {
        this.cfg.unit_of_measurement = currentState.attributes.unit_of_measurement;
        cblcarsLog.trace(`[MsdDataSource] 📊 Captured initial unit_of_measurement for ${this.cfg.entity}: "${this.cfg.unit_of_measurement}"`);
      }

      // FIXED: Use current timestamp for initial state
      const currentTimestamp = Date.now();
      const rawValue = this.cfg.attribute ? currentState.attributes?.[this.cfg.attribute] : currentState.state;
      const value = this._toNumber(rawValue);

      if (value !== null) {
        cblcarsLog.trace(`[MsdDataSource] Adding current state: ${value} at ${currentTimestamp}`);
        this.buffer.push(currentTimestamp, value);
        this._stats.currentValue = value;
      }
    }

      // STEP 3: Setup real-time subscriptions
      this.haUnsubscribe = await this.hass.connection.subscribeEvents((event) => {
        if (event.event_type === 'state_changed' &&
            event.data?.entity_id === this.cfg.entity) {
          cblcarsLog.trace(`[MsdDataSource] 📊 HA event received for ${this.cfg.entity}:`, event.data.new_state?.state);
          this._handleStateChange(event.data);
        }
      }, 'state_changed');

      this._started = true;
      cblcarsLog.trace(`[MsdDataSource] ✅ Full initialization complete for ${this.cfg.entity} - Buffer: ${this.buffer.size()} points`);

      // STEP 4: Process historical data through transformations
      this._processHistoricalTransformations();

      // STEP 5: Emit initial data to any existing subscribers
      this._emitInitialData();

      // ✅ NEW: STEP 6: Start periodic updates for time-based aggregations
      this._startPeriodicUpdates();

    } catch (error) {
      cblcarsLog.error(`[MsdDataSource] ❌ Failed to initialize ${this.cfg.entity}:`, error);
      throw error;
    }
  }

  /**
   * Start periodic updates for time-based aggregations
   * @private
   */
  _startPeriodicUpdates() {
    // Check if we have time-based aggregations
    const hasTimeBased = Array.from(this.aggregations.values()).some(agg =>
      agg.type === 'duration' ||
      agg.type === 'session_stats' ||
      agg.config.requires_periodic_update
    );

    if (!hasTimeBased) {
      return; // No time-based aggregations, don't start timer
    }

    // Determine update interval (default 1 second for smooth time display)
    const updateInterval = this.cfg.periodic_update_interval || 1000;

    cblcarsLog.debug(
      `[MsdDataSource] 🕐 Starting periodic updates for ${this.cfg.entity} ` +
      `(interval: ${updateInterval}ms)`
    );

    this._periodicUpdateEnabled = true;
    this._periodicUpdateInterval = setInterval(() => {
      if (!this._periodicUpdateEnabled || this._destroyed) {
        this._stopPeriodicUpdates();
        return;
      }

      // Recalculate time-based aggregations
      const timestamp = Date.now();
      const lastValue = this.buffer.last()?.v;

      if (lastValue !== null && lastValue !== undefined) {
        // Update aggregations with current timestamp
        // This allows duration aggregations to recalculate elapsed time
        this.aggregations.forEach((processor, key) => {
          if (processor.type === 'duration' || processor.type === 'session_stats') {
            try {
              // Force recalculation without adding a new value
              processor._calculate();
            } catch (error) {
              cblcarsLog.warn(`[MsdDataSource] Periodic aggregation update failed for ${key}:`, error);
            }
          }
        });

        // Emit updated data to subscribers
        const emitData = {
          t: timestamp,
          v: lastValue,
          buffer: this.buffer,
          stats: { ...this._stats },
          transformations: this._getTransformationData(),
          aggregations: this._getAggregationData(),
          entity: this.cfg.entity,
          unit_of_measurement: this.cfg.unit_of_measurement,
          historyReady: this._stats.historyLoaded > 0,
          isPeriodicUpdate: true  // Flag to indicate this is a periodic update
        };

        this.subscribers.forEach((callback) => {
          try {
            callback(emitData);
          } catch (error) {
            cblcarsLog.error(`[MsdDataSource] Periodic update callback failed:`, error);
          }
        });
      }
    }, updateInterval);
  }

  /**
   * Stop periodic updates
   * @private
   */
  _stopPeriodicUpdates() {
    if (this._periodicUpdateInterval) {
      clearInterval(this._periodicUpdateInterval);
      this._periodicUpdateInterval = null;
      this._periodicUpdateEnabled = false;
      cblcarsLog.debug(`[MsdDataSource] 🕐 Stopped periodic updates for ${this.cfg.entity}`);
    }
  }

  /**
   * NEW: Emit initial data to subscribers after full initialization
   * @private
   */
  _emitInitialData() {
    if (this.subscribers.size > 0) {
      const lastPoint = this.buffer.last();
      if (lastPoint) {
        cblcarsLog.trace(`[MsdDataSource] 📤 Emitting initial data for ${this.cfg.entity} to ${this.subscribers.size} subscribers`);
        const emitData = {
          t: lastPoint.t,
          v: lastPoint.v,
          buffer: this.buffer,
          stats: { ...this._stats },
          transformations: this._getTransformationData(), // Convert Map to Object
          aggregations: this._getAggregationData(),       // Convert Map to Object
          entity: this.cfg.entity,
          unit_of_measurement: this.cfg.unit_of_measurement,
          historyReady: this._stats.historyLoaded > 0,
          isInitialEmission: true // NEW: Flag to indicate this is initial data
        };

        this.subscribers.forEach(callback => {
          try {
            callback(emitData);
          } catch (error) {
            cblcarsLog.error(`[MsdDataSource] Initial callback error for ${this.cfg.entity}:`, error);
          }
        });
      } else {
        // Even if no buffer data, emit initial structure for consistency
        cblcarsLog.trace(`[MsdDataSource] 📤 Emitting initial empty data structure for ${this.cfg.entity} to ${this.subscribers.size} subscribers`);
        const emitData = {
          t: null,
          v: null,
          buffer: this.buffer,
          stats: { ...this._stats },
          transformations: this._getTransformationData(),
          aggregations: this._getAggregationData(),
          entity: this.cfg.entity,
          unit_of_measurement: this.cfg.unit_of_measurement,
          historyReady: this._stats.historyLoaded > 0,
          isInitialEmission: true
        };

        this.subscribers.forEach(callback => {
          try {
            callback(emitData);
          } catch (error) {
            cblcarsLog.error(`[MsdDataSource] Initial callback error for ${this.cfg.entity}:`, error);
          }
        });
      }
    }
  }

  async _preloadHistory() {
    if (!this.hass?.connection || !this.cfg.entity) {
      cblcarsLog.warn('[MsdDataSource] ⚠️ No HASS connection or entity for history preload');
      return;
    }

    const hours = Math.max(1, Math.min(168, this.cfg.history?.hours || 6)); // 1-168 hours
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 3600000);

    cblcarsLog.trace(`[MsdDataSource] 🔄 Preloading history for ${this.cfg.entity}`);

    try {
      // Use modern WebSocket call for statistics (preferred)
      const statisticsData = await this.hass.connection.sendMessagePromise({
        type: 'recorder/statistics_during_period',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        statistic_ids: [this.cfg.entity],
        period: 'hour'
      });

      if (statisticsData && statisticsData[this.cfg.entity]) {
        const statistics = statisticsData[this.cfg.entity];
        cblcarsLog.trace(`[MsdDataSource] 📊 Got statistics points`,statistics);

        for (const stat of statistics) {
          const timestamp = new Date(stat.start).getTime();
          const value = this._extractStatisticValue(stat);

          if (value !== null) {
            this.buffer.push(timestamp, value);
            this._updateAggregations(timestamp, value, {});
            this._stats.historyLoaded++;
          }
        }

        cblcarsLog.trace(`[MsdDataSource] ✅ Loaded statistics points`);
        return; // Success with statistics
      }
    } catch (error) {
      cblcarsLog.warn('[MsdDataSource] ⚠️ Statistics failed, trying state history:', error.message);
    }

    // Fallback: try state history via WebSocket
    await this._preloadStateHistoryWS(startTime, endTime);
  }

  async _preloadStateHistoryWS(startTime, endTime) {
    try {
      cblcarsLog.trace(`[MsdDataSource] 📚 Trying WebSocket state history for ${this.cfg.entity}`);

      // Use modern WebSocket call for history
      const historyData = await this.hass.connection.sendMessagePromise({
        type: 'history/history_during_period',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        entity_ids: [this.cfg.entity],
        minimal_response: true,
        no_attributes: true
      });

      if (historyData && historyData[0]) {
        const states = historyData[0];
        cblcarsLog.trace(`[MsdDataSource] 📊 Got history states`);

        for (const state of states) {
          const timestamp = new Date(state.last_changed || state.last_updated).getTime();

          // ✅ ENHANCED: Support nested attribute paths
          let rawValue;
          if (this.cfg.attribute_path) {
            rawValue = this._extractNestedAttribute(state.attributes, this.cfg.attribute_path);
          } else if (this.cfg.attribute) {
            rawValue = state.attributes?.[this.cfg.attribute];
          } else {
            rawValue = state.state;
          }

          const value = this._toNumber(rawValue);

          if (value !== null) {
            this.buffer.push(timestamp, value);
            this._updateAggregations(timestamp, value, {});
            this._stats.historyLoaded++;
          }
        }

        cblcarsLog.trace(`[MsdDataSource] ✅ Loaded history points`);
      } else {
        // Debug only: Entity may not have history yet (new entity, HA just started, or history not enabled)
        cblcarsLog.trace('[MsdDataSource] No history data returned from WebSocket call (may be unavailable)');
      }
    } catch (error) {
      cblcarsLog.error('[MsdDataSource] ❌ WebSocket state history also failed:', error);

      // Final fallback: try direct REST API if available
      await this._preloadHistoryREST(startTime, endTime);
    }
  }

  async _preloadHistoryREST(startTime, endTime) {
    try {
      cblcarsLog.debug(`[MsdDataSource] 🌐 Trying REST API history for ${this.cfg.entity}`);

      const startParam = startTime.toISOString();
      const url = `/api/history/period/${startParam}?filter_entity_id=${this.cfg.entity}&minimal_response&no_attributes`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.hass.auth?.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const historyData = await response.json();

      if (historyData && historyData[0]) {
        const states = historyData[0];
        cblcarsLog.trace(`[MsdDataSource] 📊 Got history states`);

        for (const state of states) {
          const timestamp = new Date(state.last_changed || state.last_updated).getTime();

          // ✅ ENHANCED: Support nested attribute paths
          let rawValue;
          if (this.cfg.attribute_path) {
            rawValue = this._extractNestedAttribute(state.attributes, this.cfg.attribute_path);
          } else if (this.cfg.attribute) {
            rawValue = state.attributes?.[this.cfg.attribute];
          } else {
            rawValue = state.state;
          }

          const value = this._toNumber(rawValue);

          if (value !== null) {
            this.buffer.push(timestamp, value);
            this._updateAggregations(timestamp, value, {});
            this._stats.historyLoaded++;
          }
        }

        cblcarsLog.trace(`[MsdDataSource] ✅ Loaded history points`);
      }
    } catch (error) {
      cblcarsLog.error('[MsdDataSource] ❌ REST history fallback also failed:', error);
    }
  }

  /**
   * Handle state change from Home Assistant
   * @private
   * @param {Object} eventData - State change event data
   */
    // Enhanced _handleStateChange method
  _handleStateChange(eventData) {

    if (!eventData?.new_state || this._destroyed) {
      return;
    }

    // Safety check: ensure buffer exists and has required methods
    if (!this.buffer || typeof this.buffer.push !== 'function') {
      cblcarsLog.error('[MsdDataSource] ❌ Buffer not properly initialized for', this.cfg.entity);
      return;
    }

    // ✅ NEW: Update metadata on state changes (before storing original state)
    this._extractMetadata(eventData.new_state);

    // Store the original state object before any conversion
    this._lastOriginalState = eventData.new_state;

    // ENHANCED: Capture and store unit_of_measurement from the entity
    if (eventData.new_state.attributes?.unit_of_measurement) {
      this.cfg.unit_of_measurement = eventData.new_state.attributes.unit_of_measurement;
    }

    // FIXED: Use current timestamp instead of state timestamp
    const timestamp = Date.now();

    let rawValue;

    if (this.cfg.attribute_path) {
      // New nested path syntax
      rawValue = this._extractNestedAttribute(
        eventData.new_state.attributes,
        this.cfg.attribute_path
      );

      if (rawValue === null && this.cfg.debug) {
        cblcarsLog.debug(
          `[MsdDataSource] ${this.cfg.entity}: Nested attribute path "${this.cfg.attribute_path}" returned null`
        );
      }
    } else if (this.cfg.attribute) {
      // Legacy single attribute access
      rawValue = eventData.new_state.attributes?.[this.cfg.attribute];
    } else {
      // Entity state
      rawValue = eventData.new_state.state;
    }

    const value = this._toNumber(rawValue);

    if (value !== null) {
    // Store in raw buffer
    this.buffer.push(timestamp, value);

    // Apply transformations and cache history
    const transformedData = this._applyTransformations(timestamp, value);

    // Update aggregations
    this._updateAggregations(timestamp, value, transformedData);

    // Update statistics
    this._stats.updates++;
    this._stats.lastUpdate = timestamp;

      // Emit to subscribers
      cblcarsLog.trace(`[MsdDataSource] 📤 Emitting to subscribers:`, value);

      const emitData = {
        t: timestamp,
        v: value,
        buffer: this.buffer,
        stats: { ...this._stats },
        transformations: this._getTransformationData(), // NEW
        aggregations: this._getAggregationData(),       // NEW
        entity: this.cfg.entity,
        unit_of_measurement: this.cfg.unit_of_measurement, // NEW: Include unit info
        historyReady: this._stats.historyLoaded > 0
      };

      this.subscribers.forEach((callback, index) => {
        try {
          callback(emitData);
        } catch (error) {
          cblcarsLog.error(`[MsdDataSource] ❌ Subscriber ${index} callback FAILED for ${this.cfg.entity}:`, error);
        }
      });
    } else {
      cblcarsLog.debug(`[MsdDataSource] ⚠️ Skipping state change - invalid value:`, { rawValue, entity: this.cfg.entity });
    }
  }

  /**
   * Update all configured aggregations with new data
   * @private
   * @param {number} timestamp - Current timestamp
   * @param {number} value - Raw value
   * @param {Object} transformedData - Transformed values from this update
   */
  _updateAggregations(timestamp, value, transformedData) {
    this.aggregations.forEach((processor, key) => {
      try {
        processor.update(timestamp, value, transformedData);
      } catch (error) {
        cblcarsLog.warn(`[MsdDataSource] Aggregation ${key} failed:`, error);
      }
    });
  }

  /**
   * Get current aggregation data
   * @private
   * @returns {Object} Current aggregation results
   */
  _getAggregationData() {
    const results = {};
    this.aggregations.forEach((processor, key) => {
      try {
        results[key] = processor.getValue();
      } catch (error) {
        cblcarsLog.warn(`[MsdDataSource] Failed to get aggregation value for ${key}:`, error);
        results[key] = null;
      }
    });
    return results;
  }

  /**
   * Get current transformation data
   * @private
   * @returns {Object} Current transformation results
   */
  _getTransformationData() {
    const results = {};

    // Get the latest raw value to transform
    const latestPoint = this.buffer.last();
    if (!latestPoint) {
      // No data available - return empty results
      this.transformations.forEach((processor, key) => {
        results[key] = null;
      });
      return results;
    }

    // Apply transformations to the latest value
    this.transformations.forEach((processor, key) => {
      try {
        // Use proper timestamp and value from buffer point
        const timestamp = latestPoint.timestamp || latestPoint.t;
        const value = latestPoint.value || latestPoint.v;

        if (Number.isFinite(value) && Number.isFinite(timestamp)) {
          // For chained transforms, we need to process in order
          const executionOrder = this._determineTransformationOrder();
          const tempResults = {};

          executionOrder.forEach((execKey) => {
            const execProcessor = this.transformations.get(execKey);
            const inputSource = execProcessor.config.input_source;
            const inputValue = inputSource ? tempResults[inputSource] : value;

            if (Number.isFinite(inputValue)) {
              // For expression processors, provide access to previous transforms
              if (execProcessor.constructor.name === 'ExpressionProcessor') {
                execProcessor.transformedData = { ...tempResults };
              }

              tempResults[execKey] = execProcessor.transform(inputValue, timestamp, this.buffer);
            } else {
              tempResults[execKey] = null;
            }

            // If this is the key we're looking for, store it
            if (execKey === key) {
              results[key] = tempResults[execKey];
            }
          });
        } else {
          cblcarsLog.debug(`[MsdDataSource] Invalid data for transformation ${key}:`, { value, timestamp });
          results[key] = null;
        }
      } catch (error) {
        cblcarsLog.warn(`[MsdDataSource] Failed to get current transformation ${key}:`, error);
        results[key] = null;
      }
    });

    return results;
  }

  /**
   * Enhanced debug method to show transformation and aggregation data
   * @returns {Object} Debug information including transformations and aggregations
   */
  getDebugInfo() {
    const currentData = this.getCurrentData();

    return {
      entity: this.cfg.entity,
      currentValue: currentData.v,
      timestamp: currentData.t ? new Date(currentData.t).toISOString() : null,
      bufferSize: this.buffer.size(),
      transformations: {
        count: this.transformations.size,
        data: currentData.transformations,
        processors: Array.from(this.transformations.keys())
      },
      aggregations: {
        count: this.aggregations.size,
        data: currentData.aggregations,
        processors: Array.from(this.aggregations.keys())
      },
      stats: currentData.stats
    };
  }

  /**
   * Check if we should emit data to subscribers based on timing and value rules
   */
  _shouldEmit(value, timestamp) {
    const now = Date.now();

    // Respect minimum emit interval
    if (this._lastEmitTime && (timestamp - this._lastEmitTime) < this.minEmitMs) {
      this._stats.coalesced++;
      return false;
    }

    // Skip if value hasn't changed (if configured)
    if (!this.emitOnSameValue && value === this._lastEmittedValue) {
      this._stats.skipsSameValue++;
      return false;
    }

    return true;
  }

  /**
   * Emit data to all subscribers
   */
  _emit(data) {
    const now = Date.now();
    this._lastEmitTime = now;
    this._lastEmittedValue = data.v;
    this._stats.emits++;

    cblcarsLog.trace(`[MsdDataSource] 📤 Emitting to subscribers:`, data.v);

    // Call all subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        cblcarsLog.warn(`[MsdDataSource] ⚠️ Subscriber callback error:`, error);
      }
    });
  }

  async _subscribeLive() {
    if (!this.hass?.connection?.subscribeEvents || !this.cfg.entity) return;

    const entityId = this.cfg.entity;

    try {
      this.haUnsubscribe = await this.hass.connection.subscribeEvents((event) => {
        const newState = event?.data?.new_state;
        if (!newState || newState.entity_id !== entityId) return;

        const timestamp = new Date(newState.last_changed || newState.last_updated || Date.now()).getTime();
        const rawValue = this.cfg.attribute ? newState.attributes?.[this.cfg.attribute] : newState.state;
        const value = this._toNumber(rawValue);

        this._onRawEventValue(timestamp, value);
      }, 'state_changed');

    } catch (error) {
      cblcarsLog.warn('[MsdDataSource] ⚠️ Failed to subscribe to HA events:', error.message);
    }
  }

  _onRawEventValue(timestamp, value) {
    if (value === null) {
      this._stats.invalid++;
      return;
    }

    // ENHANCED: Check for rapid-fire identical values and skip some
    const now = isNode ? Date.now() : performance.now();

    // Store in buffer - buffer now handles its own coalescing
    this.buffer.push(timestamp, value);
    this._stats.received++;

    // FIXED: More aggressive coalescing logic for stress scenarios
    if (!this._pending) {
      this._pending = true;
      this._pendingFirstTs = now;
      this._pendingCount = 1;

      // For stress tests: delay first emission slightly to allow coalescing
      if (this._stats.received > 10) {
        // High-frequency scenario - be more patient
        setTimeout(() => this._ensureScheduleEmit(), 5);
      } else {
        // Normal scenario - immediate response for first subscription
        if (this.subscribers.size > 0 && this._stats.emits === 0) {
          this._emit();
        } else {
          this._ensureScheduleEmit();
        }
      }
    } else {
      this._pendingCount++;
      const timeSinceFirst = now - this._pendingFirstTs;

      if (timeSinceFirst >= this.coalesceMs) {
        // Coalescing window expired - emit and start new window
        this._emit();

        // Start fresh coalescing window
        this._pending = true;
        this._pendingFirstTs = now;
        this._pendingCount = 1;
        this._ensureScheduleEmit();
      } else {
        // Still within coalescing window - increment coalesced counter
        this._stats.coalesced++;
      }
    }
  }

  _ensureScheduleEmit() {
    if (this._pendingRaf) return; // Already scheduled

    this._pendingRaf = requestAnimationFrame(() => {
      this._pendingRaf = 0;
      this._frameEmitCheck();
    });
  }

  _frameEmitCheck() {
    if (!this._pending || this._destroyed) return;

    const now = isNode ? Date.now() : performance.now();
    const timeSinceLastEmit = now - this._lastEmitTime;
    const timeSincePendingStart = now - this._pendingFirstTs;

    // Should we emit now?
    let shouldEmit = false;

    // Check minimum emit interval
    if (timeSinceLastEmit >= this.minEmitMs) {
      // Minimum time passed - check coalescing window
      if (timeSincePendingStart >= this.coalesceMs) {
        shouldEmit = true;
      }
    }

    // Max delay override - always emit if we've been pending too long
    if (timeSincePendingStart >= this.maxDelayMs) {
      shouldEmit = true;
    }

    if (shouldEmit) {
      this._emit();
    } else {
      // IMPROVED: More precise next check timing
      const untilMinEmit = Math.max(0, this.minEmitMs - timeSinceLastEmit);
      const untilCoalesce = Math.max(0, this.coalesceMs - timeSincePendingStart);
      const untilMaxDelay = Math.max(0, this.maxDelayMs - timeSincePendingStart);

      const nextCheck = Math.min(
        untilMinEmit || Infinity,
        untilCoalesce || Infinity,
        untilMaxDelay || Infinity
      );

      if (nextCheck < Infinity && nextCheck > 0) {
        setTimeout(() => {
          this._ensureScheduleEmit();
        }, Math.max(1, Math.min(50, nextCheck)));
      }
    }
  }

  /* OLD
  subscribe(callback) {
    if (typeof callback !== 'function') {
      cblcarsLog.warn('[MsdDataSource] Subscribe requires a function callback');
      return () => {};
    }

    this.subscribers.add(callback);

    // Immediate hydration with current data
    const lastPoint = this.buffer.last();
    if (lastPoint) {
      try {
        callback({
          t: lastPoint.t,
          v: lastPoint.v,
          buffer: this.buffer,
          stats: this._stats
        });
      } catch (error) {
        cblcarsLog.warn('[MsdDataSource] Initial callback error:', error);
      }
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }
  */


  subscribe(callback) {
    if (typeof callback !== 'function') {
      cblcarsLog.warn('[MsdDataSource] Subscribe requires a function callback');
      return () => {};
    }

    this.subscribers.add(callback);

    // Enhanced immediate hydration with current data
    const lastPoint = this.buffer.last();
    if (lastPoint) {
      try {
        const currentData = {
          t: lastPoint.t,
          v: lastPoint.v,
          buffer: this.buffer,
          stats: { ...this._stats },
          transformations: this._getTransformationData(), // Convert Map to Object
          aggregations: this._getAggregationData(),       // Convert Map to Object
          entity: this.cfg.entity,
          historyReady: this._stats.historyLoaded > 0
        };

        cblcarsLog.debug(`[MsdDataSource] Providing immediate hydration for new subscriber:`, {
          entity: this.cfg.entity,
          value: lastPoint.v,
          bufferSize: this.buffer.size(),
          timestamp: new Date(lastPoint.t).toISOString()
        });

        // Use setTimeout to avoid blocking the subscription
        setTimeout(() => {
          callback(currentData);
        }, 0);

      } catch (error) {
        cblcarsLog.warn('[MsdDataSource] Initial callback error:', error);
      }
    } else {
      cblcarsLog.trace(`[MsdDataSource] No data available for immediate hydration:`, {
        entity: this.cfg.entity,
        bufferSize: this.buffer.size(),
        started: this._started
      });
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // ENHANCED: Subscribe with metadata support
  subscribeWithMetadata(callback, metadata = {}) {
    if (typeof callback !== 'function') {
      cblcarsLog.warn('[MsdDataSource] Subscribe requires a function callback');
      return () => {};
    }

    // Store metadata on the callback function
    callback._subscriberMetadata = {
      overlayId: metadata.overlayId || 'unknown',
      overlayType: metadata.overlayType || 'unknown',
      component: metadata.component || 'unknown',
      subscribedAt: Date.now()
    };

    return this.subscribe(callback);
  }


  /**
   * Convert raw value to number with support for boolean states and enum mapping
   *
   * Handles:
   * - Numeric values and strings
   * - Boolean states (on/off, true/false, etc.)
   * - Enum mapping for categorical states (heating, cooling, etc.)
   * - Unavailable/unknown states
   *
   * @private
   * @param {*} raw - Raw value from HA state
   * @returns {number|null} Converted number or null if invalid
   */
  _toNumber(raw) {
    if (raw === null || raw === undefined) {
      return null;
    }

    // Handle numeric values
    if (typeof raw === 'number') {
      return isNaN(raw) ? null : raw;
    }

    // Handle string values
    if (typeof raw === 'string') {
      // ✅ ENHANCED DEBUG: Log what we're checking
      if (this.cfg.debug || this.cfg.enum_mapping_debug) {
        cblcarsLog.debug(
          `[MsdDataSource] ${this.cfg.entity}: _toNumber called with string: "${raw}"\n` +
          `  Has enum_mapping: ${!!this.cfg.enum_mapping}\n` +
          `  Enum mapping keys: ${this.cfg.enum_mapping ? Object.keys(this.cfg.enum_mapping).join(', ') : 'none'}`
        );
      }

      // Check enum_mapping first (before any other conversion)
      if (this.cfg.enum_mapping && typeof this.cfg.enum_mapping === 'object') {
        // ✅ ENHANCED DEBUG: Show the lookup attempt
        if (this.cfg.debug || this.cfg.enum_mapping_debug) {
          cblcarsLog.debug(
            `[MsdDataSource] ${this.cfg.entity}: Looking up "${raw}" in enum_mapping\n` +
            `  Found: ${this.cfg.enum_mapping[raw] !== undefined}\n` +
            `  Value: ${this.cfg.enum_mapping[raw]}`
          );
        }

        if (this.cfg.enum_mapping[raw] !== undefined) {
          const mappedValue = this.cfg.enum_mapping[raw];

          // Validate mapped value is numeric

          if (typeof mappedValue === 'number' && isFinite(mappedValue)) {
            cblcarsLog.debug(
              `[MsdDataSource] ${this.cfg.entity}: ✅ Enum mapping "${raw}" → ${mappedValue}`
            );
            return mappedValue;
          } else {
            cblcarsLog.warn(
              `[MsdDataSource] ${this.cfg.entity}: ❌ Invalid enum mapping value for "${raw}": ${mappedValue} (must be a number)`
            );
          }
        }
      }

      // Try direct numeric conversion
      const num = parseFloat(raw);
      if (!isNaN(num) && isFinite(num)) {
        return num;
      }

      // Handle boolean-like strings
      const lowerRaw = raw.toLowerCase().trim();
      if (lowerRaw === 'on' || lowerRaw === 'true' || lowerRaw === 'active' || lowerRaw === 'open') {
        if (this.cfg.debug || this.cfg.enum_mapping_debug) {
          cblcarsLog.debug(`[MsdDataSource] ${this.cfg.entity}: Boolean mapping "${raw}" → 1`);
        }
        return 1;
      }

      if (lowerRaw === 'off' || lowerRaw === 'false' || lowerRaw === 'inactive' || lowerRaw === 'closed') {
        if (this.cfg.debug || this.cfg.enum_mapping_debug) {
          cblcarsLog.debug(`[MsdDataSource] ${this.cfg.entity}: Boolean mapping "${raw}" → 0`);
        }
        return 0;
      }

      // Handle unavailable/unknown states
      if (lowerRaw === 'unavailable' || lowerRaw === 'unknown') {
        return null;
      }

      // Log unhandled strings
      if (this.cfg.debug || this.cfg.enum_mapping_debug) {
        cblcarsLog.warn(
          `[MsdDataSource] ${this.cfg.entity}: ⚠️ Unhandled string value: "${raw}" ` +
          `(consider adding to enum_mapping)`
        );
      }

      return null;
    }

    // Handle boolean values
    if (typeof raw === 'boolean') {
      return raw ? 1 : 0;
    }

    return null;
  }

  _parseTimeWindowMs(windowStr) {
    if (typeof windowStr !== 'string') return NaN;

    const match = windowStr.match(/^(\d+(?:\.\d+)?)\s*(s|sec|m|min|h|hr|d|day)s?$/i);
    if (!match) return NaN;

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 's':
      case 'sec':
        return value * 1000;
      case 'm':
      case 'min':
        return value * 60 * 1000;
      case 'h':
      case 'hr':
        return value * 60 * 60 * 1000;
      case 'd':
      case 'day':
        return value * 24 * 60 * 60 * 1000;
      default:
        return NaN;
    }
  }

  // Debug and introspection methods
  getStats() {
    return {
      ...this._stats,
      config: {
        entity: this.cfg.entity,
        windowSeconds: this.cfg.windowSeconds,
        minEmitMs: this.minEmitMs,
        coalesceMs: this.coalesceMs,
        maxDelayMs: this.maxDelayMs
      },
      buffer: this.buffer.getStats(),
      subscribers: this.subscribers.size,
      state: {
        started: this._started,
        pending: this._pending,
        destroyed: this._destroyed
      }
    };
  }

  // ENHANCED: Basic subscriber information with overlay metadata
  getSubscriberInfo() {
    return Array.from(this.subscribers).map((callback, index) => {
      // Check if callback has stored metadata
      const metadata = callback._subscriberMetadata;

      if (metadata) {
        return {
          id: metadata.overlayId,
          name: `${metadata.overlayType}_${metadata.overlayId}`,
          type: metadata.overlayType,
          component: metadata.component,
          subscribedAt: metadata.subscribedAt,
          index: index
        };
      }

      // Fallback to basic detection for callbacks without metadata
      const name = callback.name || 'anonymous';
      const isWrapped = callback.toString().includes('overlay') || callback.toString().includes('callback');

      return {
        id: `subscriber_${index}`,
        name: name === 'anonymous' && isWrapped ? 'overlay_callback' : name,
        type: 'function',
        component: 'unknown',
        index: index
      };
    });
  }  /**
   * Get current data with enhanced metadata
   * @returns {Object|null} Current data object or null
   */
  getCurrentData() {
    const lastPoint = this.buffer.last();
    if (!lastPoint) {
      // Return minimal data structure even if no data points exist
      return {
        t: null,
        v: null,
        buffer: this.buffer,
        stats: { ...this._stats },
        transformations: this._getTransformationData(),
        aggregations: this._getAggregationData(),
        entity: this.cfg.entity,
        metadata: { ...this.metadata },  // ✅ NEW: Include metadata
        historyReady: this._stats.historyLoaded > 0,
        bufferSize: 0,
        started: this._started
      };
    }

    return {
      t: lastPoint.t,
      v: lastPoint.v,
      buffer: this.buffer,
      stats: { ...this._stats },
      transformations: this._getTransformationData(),
      aggregations: this._getAggregationData(),
      entity: this.cfg.entity,
      metadata: { ...this.metadata },  // ✅ NEW: Include metadata
      historyReady: this._stats.historyLoaded > 0,
      bufferSize: this.buffer.size(),
      started: this._started
    };
  }

  /**
   * Get entity metadata
   * @returns {Object} Entity metadata object
   */
  getMetadata() {
    return { ...this.metadata };
  }

  /**
   * Get formatted value with unit
   * @param {number} value - Value to format
   * @param {number} precision - Decimal places
   * @returns {string} Formatted value with unit
   */
  getFormattedValue(value, precision = 1) {
    if (!Number.isFinite(value)) return 'N/A';

    const formatted = value.toFixed(precision);
    return this.metadata.unit_of_measurement
      ? `${formatted}${this.metadata.unit_of_measurement}`
      : formatted;
  }

  /**
   * Get display name (friendly_name or entity_id)
   * @returns {string} Display name
   */
  getDisplayName() {
    return this.metadata.friendly_name || this.cfg.entity;
  }

  /**
   * Stop the data source and release resources
   */
  async stop() {
    this._started = false;

    // ✅ NEW: Stop periodic updates
    this._stopPeriodicUpdates();

    if (this.haUnsubscribe) {
      try {
        this.haUnsubscribe();
      } catch (error) {
        cblcarsLog.warn('[MsdDataSource] ⚠️ HA unsubscribe error:', error);
      }
      this.haUnsubscribe = null;
    }

    if (this._pendingRaf) {
      cancelAnimationFrame(this._pendingRaf);
      this._pendingRaf = 0;
    }

    this._pending = false;
  }

  destroy() {
    this._destroyed = true;
    this._stopPeriodicUpdates();
    this.stop();
    this.subscribers.clear();
    this.buffer.clear();
  }

  _extractStatisticValue(stat) {
    // Priority order for statistic values
    if (Number.isFinite(stat.mean)) return stat.mean;
    if (Number.isFinite(stat.state)) return stat.state;
    if (Number.isFinite(stat.sum)) return stat.sum;
    if (Number.isFinite(stat.max)) return stat.max;
    if (Number.isFinite(stat.min)) return stat.min;
    return null;
  }


  /**
   * Extract nested attribute value using dot notation and array indices
   *
   * Supports:
   * - Dot notation: "forecast.temperature"
   * - Array indices: "forecast.0.temperature" or "forecast[0].temperature"
   * - Mixed: "device.config[0].settings.enabled"
   *
   * @private
   * @param {Object} attributes - Entity attributes object
   * @param {string} path - Attribute path (e.g., "forecast.0.temperature")
   * @returns {*} Extracted value or null if not found
   */
  _extractNestedAttribute(attributes, path) {
    if (!attributes || !path) {
      return null;
    }

    try {
      // Normalize path: convert brackets to dots
      // "forecast[0].temperature" → "forecast.0.temperature"
      const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');

      // Split into path segments
      const segments = normalizedPath.split('.');

      // Traverse the object
      let current = attributes;

      for (const segment of segments) {
        if (current === null || current === undefined) {
          if (this.cfg.debug) {
            cblcarsLog.debug(
              `[MsdDataSource] ${this.cfg.entity}: Nested path traversal stopped at null/undefined for segment: ${segment}`
            );
          }
          return null;
        }

        // Check if segment is an array index
        const arrayIndex = parseInt(segment);
        if (!isNaN(arrayIndex)) {
          // Array access
          if (!Array.isArray(current)) {
            if (this.cfg.debug) {
              cblcarsLog.debug(
                `[MsdDataSource] ${this.cfg.entity}: Expected array at segment ${segment}, got ${typeof current}`
              );
            }
            return null;
          }

          if (arrayIndex < 0 || arrayIndex >= current.length) {
            if (this.cfg.debug) {
              cblcarsLog.debug(
                `[MsdDataSource] ${this.cfg.entity}: Array index ${arrayIndex} out of bounds (length: ${current.length})`
              );
            }
            return null;
          }

          current = current[arrayIndex];
        } else {
          // Object property access
          if (typeof current !== 'object') {
            if (this.cfg.debug) {
              cblcarsLog.debug(
                `[MsdDataSource] ${this.cfg.entity}: Expected object at segment ${segment}, got ${typeof current}`
              );
            }
            return null;
          }

          if (!(segment in current)) {
            if (this.cfg.debug) {
              cblcarsLog.debug(
                `[MsdDataSource] ${this.cfg.entity}: Property "${segment}" not found in object. Available: ${Object.keys(current).join(', ')}`
              );
            }
            return null;
          }

          current = current[segment];
        }
      }

      if (this.cfg.debug) {
        cblcarsLog.debug(
          `[MsdDataSource] ${this.cfg.entity}: Successfully extracted nested attribute "${path}": ${current}`
        );
      }

      return current;

    } catch (error) {
      cblcarsLog.warn(
        `[MsdDataSource] ${this.cfg.entity}: Error extracting nested attribute "${path}":`,
        error.message
      );
      return null;
    }
  }


  /**
   * Get recent points from the main buffer (compatibility method)
   * @param {number} count - Number of recent points to return
   * @returns {Array} Array of recent data points
   */
  getRecent(count = 100) {
    try {
      return this.buffer.getRecent(count) || [];
    } catch (error) {
      cblcarsLog.warn('[MsdDataSource] getRecent error:', error);
      return [];
    }
  }

  /**
   * Get transformed historical data for overlays (ensure this method exists)
   * @param {string} transformKey - Key of the transformation
   * @param {number} count - Number of recent points to get
   * @returns {Array} Historical transformed data
   */
  getTransformedHistory(transformKey, count = 100) {
    const buffer = this.transformedBuffers.get(transformKey);
    if (!buffer || buffer.size() === 0) {
      return [];
    }

    // Use the correct RollingBuffer method
    try {
      // Try getRecent method first
      if (typeof buffer.getRecent === 'function') {
        return buffer.getRecent(count);
      }
      // Fallback to manual extraction
      else {
        const points = [];
        const maxCount = Math.min(count, buffer.size());
        for (let i = 0; i < maxCount; i++) {
          const point = buffer.last(); // This won't work well, but it's a fallback
          if (point) {
            points.push(point);
          }
        }
        return points;
      }
    } catch (error) {
      cblcarsLog.error(`[MsdDataSource] Error getting transformed history for ${transformKey}:`, error);
      return [];
    }
  }

  /**
   * NEW: Get transformation execution graph for debugging
   * @returns {Object} Dependency graph with execution order
   */
  getTransformationGraph() {
    const graph = {};

    this.transformations.forEach((processor, key) => {
      graph[key] = {
        type: processor.constructor.name,
        inputSource: processor.config.input_source || null,
        dependents: [],
        supportsHistorical: processor.supportsHistoricalReprocessing
      };
    });

    // Fill in dependents
    Object.entries(graph).forEach(([key, node]) => {
      if (node.inputSource && graph[node.inputSource]) {
        graph[node.inputSource].dependents.push(key);
      }
    });

    return {
      graph,
      executionOrder: this._determineTransformationOrder(),
      hasChaining: Array.from(this.transformations.values())
        .some(p => p.config.input_source)
    };
  }

  /**
   * Apply all configured transformations to a value
   * ENHANCED: Supports both parallel (default) and sequential (chained) processing
   * @private
   * @param {number} timestamp - Current timestamp
   * @param {number} value - Raw value to transform
   * @returns {Object} Map of transformation keys to results
   */
  _applyTransformations(timestamp, value) {
    const results = {};

    // Get execution order (cached after first call)
    const executionOrder = this._determineTransformationOrder();

    executionOrder.forEach((key) => {
      const processor = this.transformations.get(key);

      try {

        // This allows ExpressionProcessor to access entity attributes
        processor.dataSource = this;

        // Determine input value: chained source or raw value
        const inputSource = processor.config.input_source;
        const inputValue = inputSource
          ? results[inputSource]   // Chain from previous transform
          : value;                 // Use raw value (default)

        // Validate chained input exists
        if (inputSource && results[inputSource] === undefined) {
          const available = Object.keys(results).join(', ') || 'none yet';
          const notYetProcessed = executionOrder
            .filter(k => !results.hasOwnProperty(k))
            .join(', ');

          cblcarsLog.warn(
            `[MsdDataSource] ⚠️ Transform '${key}' references '${inputSource}' which is not available yet.\n` +
            `  Available: [${available}]\n` +
            `  Not yet processed: [${notYetProcessed}]\n` +
            `  Hint: Check if '${inputSource}' has a valid key and appears before '${key}'.`
          );
          results[key] = null;
          return;
        }

        // Validate input is numeric
        if (!Number.isFinite(inputValue)) {
          if (inputSource) {
            cblcarsLog.debug(
              `[MsdDataSource] Transform '${key}' skipped - ` +
              `input from '${inputSource}' is non-numeric: ${inputValue}`
            );
          }
          results[key] = null;
          return;
        }

        // NEW: For expression processors, provide access to all previous transforms
        if (processor.constructor.name === 'ExpressionProcessor') {
          processor.transformedData = { ...results }; // Pass all current results
        }

        // Execute transformation
        const transformedValue = processor.transform(inputValue, timestamp, this.buffer);
        results[key] = transformedValue;

        // Debug logging if enabled
        if (processor.config.debug) {
          cblcarsLog.debug(
            `[MsdDataSource] 🔍 Transform '${key}': ` +
            `${inputValue.toFixed(2)} → ${transformedValue !== null ? transformedValue.toFixed(2) : 'null'}`
          );
        }

        // Cache transformed historical data if valid
        if (transformedValue !== null && Number.isFinite(transformedValue)) {
          const buffer = this.transformedBuffers.get(key);
          if (buffer) {
            buffer.push(timestamp, transformedValue);
          }
        }

      } catch (error) {
        cblcarsLog.warn(`[MsdDataSource] ⚠️ Transformation '${key}' failed:`, error.message);
        results[key] = null;
      }
    });

    return results;
  }

  /**
   * Process historical data through transformations to populate transform buffers
   * ENHANCED: Respects transformation execution order for chained transforms
   * @private
   */
  _processHistoricalTransformations() {
    if (this.transformations.size === 0) {
      return;
    }

    cblcarsLog.debug(
      `[MsdDataSource] 🔄 Processing historical data through ${this.transformations.size} transformations...`
    );

    try {
      const historicalPoints = this.buffer.getRecent(this.buffer.size());

      if (historicalPoints.length === 0) {
        cblcarsLog.debug(`[MsdDataSource] No historical data to process for transformations`);
        return;
      }

      // Get correct execution order for chained transforms
      const executionOrder = this._determineTransformationOrder();

      // Track start time for performance monitoring
      const startTime = performance.now();

      // Process each historical point in chronological order
      historicalPoints.reverse().forEach((point) => {
        const transformResults = {};

        // Execute transforms in dependency order
        executionOrder.forEach((key) => {
          const processor = this.transformations.get(key);

          try {
            // Skip if transform doesn't support historical reprocessing
            if (!processor.supportsHistoricalReprocessing) {
              transformResults[key] = null;
              return;
            }

            // Determine input: chained source or raw value
            const inputSource = processor.config.input_source;
            const inputValue = inputSource
              ? transformResults[inputSource]
              : point.value;

            if (inputValue === null || !Number.isFinite(inputValue)) {
              transformResults[key] = null;
              return;
            }

            // For expression processors, provide access to previous transforms
            if (processor.constructor.name === 'ExpressionProcessor') {
              processor.transformedData = { ...transformResults };
            }

            const transformedValue = processor.transform(
              inputValue,
              point.timestamp,
              this.buffer
            );

            transformResults[key] = transformedValue;

            // Store in buffer
            if (transformedValue !== null && Number.isFinite(transformedValue)) {
              const buffer = this.transformedBuffers.get(key);
              if (buffer) {
                buffer.push(point.timestamp, transformedValue);
              }
            }
          } catch (error) {
            cblcarsLog.warn(
              `[MsdDataSource] Failed to process historical point through transformation ${key}:`,
              error.message
            );
            transformResults[key] = null;
          }
        });
      });

      const duration = performance.now() - startTime;

      // Performance warning for slow processing
      if (duration > 100) {
        cblcarsLog.warn(
          `[MsdDataSource] ⚠️ Historical chain processing took ${duration.toFixed(1)}ms ` +
          `(${historicalPoints.length} points × ${this.transformations.size} transforms)`
        );
      }

      // Log results
      this.transformedBuffers.forEach((buffer, key) => {
        cblcarsLog.debug(
          `[MsdDataSource] ✅ Populated '${key}' buffer with ${buffer.size()} historical points`
        );
      });

    } catch (error) {
      cblcarsLog.error(`[MsdDataSource] Error processing historical transformations:`, error);
    }
  }
}
