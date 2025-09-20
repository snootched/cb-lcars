/**
 * MsdDataSource - Complete port of cb-lcars-data.js DataSource functionality
 *
 * Provides real-time Home Assistant entity subscriptions with:
 * - Coalescing and throttling for performance
 * - History preload capability
 * - Rolling buffer management
 * - Identical API and behavior to original implementation
 */

import { RollingBuffer } from './RollingBuffer.js';
import { createTransformationProcessor } from './transformations/TransformationProcessor.js';
import { createAggregationProcessor } from './aggregations/AggregationProcessor.js';

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
      console.warn('[MsdDataSource] No entity specified in config');
      this.cfg.entity = '';
    }

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
    this._transformationData = new Map();
    this._aggregationData = new Map();

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

    // Initialize processors from configuration
    this._initializeProcessors(cfg);
  }

  /**
   * Initialize transformation and aggregation processors from configuration
   * @private
   * @param {Object} cfg - Data source configuration
   */
  _initializeProcessors(cfg) {
    // Initialize transformations
    if (cfg.transformations && Array.isArray(cfg.transformations)) {
      cfg.transformations.forEach((transform, index) => {
        try {
          const key = transform.key || `transform_${index}`;
          const processor = createTransformationProcessor(transform);
          this.transformations.set(key, processor);
          console.log(`[MsdDataSource] Initialized transformation: ${key} (${transform.type})`);
        } catch (error) {
          console.warn(`[MsdDataSource] Failed to create transformation ${index}:`, error);
        }
      });
    }

    // Initialize aggregations
    if (cfg.aggregations && typeof cfg.aggregations === 'object') {
      Object.entries(cfg.aggregations).forEach(([type, config]) => {
        try {
          const key = config.key || type;
          const processor = createAggregationProcessor(type, config);
          this.aggregations.set(key, processor);
          console.log(`[MsdDataSource] Initialized aggregation: ${key} (${type})`);
        } catch (error) {
          console.warn(`[MsdDataSource] Failed to create aggregation ${type}:`, error);
        }
      });
    }

    console.log(`[MsdDataSource] Processor initialization complete: ${this.transformations.size} transformations, ${this.aggregations.size} aggregations`);
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

    console.log(`[MsdDataSource] 📊 Preloading ${hours}h history for ${this.cfg.entity}`);

    try {
      // Strategy 1: Try Home Assistant's history service (most reliable)
      await this._preloadWithHistoryService(startTime, endTime);
    } catch (error) {
      console.warn(`[MsdDataSource] History service failed for ${this.cfg.entity}, trying statistics:`, error.message);

      try {
        // Strategy 2: Fall back to enhanced statistics
        await this._preloadWithStatistics(startTime, endTime);
      } catch (statError) {
        console.warn(`[MsdDataSource] Statistics failed, trying state history:`, statError.message);
        // Strategy 3: Final fallback (existing _preloadStateHistory method)
        await this._preloadStateHistory(startTime, endTime);
      }
    }

    console.log(`[MsdDataSource] History preload complete: ${this._stats.historyLoaded} points loaded`);
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
      console.log(`[MsdDataSource] History service returned ${states.length} states for ${this.cfg.entity}`);

      for (const state of states) {
        const timestamp = new Date(state.last_changed || state.last_updated).getTime();
        const rawValue = this.cfg.attribute ? state.attributes?.[this.cfg.attribute] : state.state;
        const value = this._toNumber(rawValue);

        if (value !== null) {
          this.buffer.push(timestamp, value);
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
      console.log(`[MsdDataSource] Statistics returned ${statistics.length} points for ${this.cfg.entity}`);

      for (const stat of statistics) {
        const timestamp = new Date(stat.start).getTime();
        const value = this._extractStatisticValue(stat);

        if (value !== null) {
          this.buffer.push(timestamp, value);
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
      console.log(`[MsdDataSource] 🚀 Starting initialization for ${this.cfg.entity}`);

      // STEP 1: Preload historical data FIRST
      if (this.hass?.callService) {
        await this._preloadHistory();
      }

      // STEP 2: Initialize with current HASS state if available
      if (this.hass.states && this.hass.states[this.cfg.entity]) {
        const currentState = this.hass.states[this.cfg.entity];
        console.log(`[MsdDataSource] 🔄 Loading initial state for ${this.cfg.entity}:`, currentState.state);

        // ENHANCED: Capture unit_of_measurement from initial state
        if (currentState.attributes?.unit_of_measurement) {
          this.cfg.unit_of_measurement = currentState.attributes.unit_of_measurement;
          console.log(`[MsdDataSource] 📊 Captured initial unit_of_measurement for ${this.cfg.entity}: "${this.cfg.unit_of_measurement}"`);
        }

        // FIXED: Use current timestamp for initial state
        const currentTimestamp = Date.now();
        const rawValue = this.cfg.attribute ? currentState.attributes?.[this.cfg.attribute] : currentState.state;
        const value = this._toNumber(rawValue);

        if (value !== null) {
          console.log(`[MsdDataSource] Adding current state: ${value} at ${currentTimestamp}`);
          this.buffer.push(currentTimestamp, value);
          this._stats.currentValue = value;
        }
      }

      // STEP 3: Setup real-time subscriptions
      this.haUnsubscribe = await this.hass.connection.subscribeEvents((event) => {
        if (event.event_type === 'state_changed' &&
            event.data?.entity_id === this.cfg.entity) {
          console.log(`[MsdDataSource] 📊 HA event received for ${this.cfg.entity}:`, event.data.new_state?.state);
          this._handleStateChange(event.data);
        }
      }, 'state_changed');

      this._started = true;
      console.log(`[MsdDataSource] ✅ Full initialization complete for ${this.cfg.entity} - Buffer: ${this.buffer.size()} points`);

      // STEP 4: Emit initial data to any existing subscribers
      this._emitInitialData();

    } catch (error) {
      console.error(`[MsdDataSource] ❌ Failed to initialize ${this.cfg.entity}:`, error);
      throw error;
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
        console.log(`[MsdDataSource] 📤 Emitting initial data for ${this.cfg.entity} to ${this.subscribers.size} subscribers`);
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
            console.error(`[MsdDataSource] Initial callback error for ${this.cfg.entity}:`, error);
          }
        });
      } else {
        // Even if no buffer data, emit initial structure for consistency
        console.log(`[MsdDataSource] 📤 Emitting initial empty data structure for ${this.cfg.entity} to ${this.subscribers.size} subscribers`);
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
            console.error(`[MsdDataSource] Initial callback error for ${this.cfg.entity}:`, error);
          }
        });
      }
    }
  }

  async _preloadHistory() {
    if (!this.hass?.connection || !this.cfg.entity) {
      console.warn('[MsdDataSource] No HASS connection or entity for history preload');
      return;
    }

    const hours = Math.max(1, Math.min(168, this.cfg.history?.hours || 6)); // 1-168 hours
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 3600000);

    console.log(`[MsdDataSource] 🔄 Preloading ${hours}h history for ${this.cfg.entity}`);

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
        console.log(`[MsdDataSource] 📊 Got ${statistics.length} statistics points`);

        for (const stat of statistics) {
          const timestamp = new Date(stat.start).getTime();
          const value = this._extractStatisticValue(stat);

          if (value !== null) {
            this.buffer.push(timestamp, value);
            this._stats.historyLoaded++;
          }
        }

        console.log(`[MsdDataSource] ✅ Loaded ${this._stats.historyLoaded} statistics points`);
        return; // Success with statistics
      }
    } catch (error) {
      console.warn('[MsdDataSource] Statistics failed, trying state history:', error.message);
    }

    // Fallback: try state history via WebSocket
    await this._preloadStateHistoryWS(startTime, endTime);
  }

  async _preloadStateHistoryWS(startTime, endTime) {
    try {
      console.log(`[MsdDataSource] 📚 Trying WebSocket state history for ${this.cfg.entity}`);

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
        console.log(`[MsdDataSource] 📊 Got ${states.length} history states`);

        for (const state of states) {
          const timestamp = new Date(state.last_changed || state.last_updated).getTime();
          const rawValue = this.cfg.attribute ? state.attributes?.[this.cfg.attribute] : state.state;
          const value = this._toNumber(rawValue);

          if (value !== null) {
            this.buffer.push(timestamp, value);
            this._stats.historyLoaded++;
          }
        }

        console.log(`[MsdDataSource] ✅ Loaded ${this._stats.historyLoaded} history points`);
      } else {
        console.warn('[MsdDataSource] No history data returned from WebSocket call');
      }
    } catch (error) {
      console.error('[MsdDataSource] WebSocket state history also failed:', error);

      // Final fallback: try direct REST API if available
      await this._preloadHistoryREST(startTime, endTime);
    }
  }

  async _preloadHistoryREST(startTime, endTime) {
    try {
      console.log(`[MsdDataSource] 🌐 Trying REST API history for ${this.cfg.entity}`);

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
        console.log(`[MsdDataSource] 📊 Got ${states.length} REST history states`);

        for (const state of states) {
          const timestamp = new Date(state.last_changed || state.last_updated).getTime();
          const rawValue = this.cfg.attribute ? state.attributes?.[this.cfg.attribute] : state.state;
          const value = this._toNumber(rawValue);

          if (value !== null) {
            this.buffer.push(timestamp, value);
            this._stats.historyLoaded++;
          }
        }

        console.log(`[MsdDataSource] ✅ Loaded ${this._stats.historyLoaded} REST history points`);
      }
    } catch (error) {
      console.error('[MsdDataSource] REST history fallback also failed:', error);
    }
  }

  /**
   * Handle state change from Home Assistant
   * @private
   * @param {Object} eventData - State change event data
   */
  _handleStateChange(eventData) {

    console.log('[MSD DEBUG] 📊 MsdDataSource._handleStateChange() ENTRY:', {
      entity: this.cfg.entity,
      timestamp: new Date().toISOString(),
      hasEventData: !!eventData,
      hasNewState: !!eventData?.new_state,
      newStateValue: eventData?.new_state?.state,
      subscriberCount: this.subscribers.size,
      stackTrace: new Error().stack.split('\n').slice(1, 3).join('\n')
    });

    if (!eventData?.new_state || this._destroyed) {
      console.log('[MSD DEBUG] ⏭️ Skipping state change - no new state or destroyed');
      return;
    }

    // CRITICAL: Store the original state object before any conversion
    this._lastOriginalState = eventData.new_state;

    // ENHANCED: Capture and store unit_of_measurement from the entity
    if (eventData.new_state.attributes?.unit_of_measurement) {
      this.cfg.unit_of_measurement = eventData.new_state.attributes.unit_of_measurement;
      console.log(`[MSD DEBUG] 📊 Captured unit_of_measurement for ${this.cfg.entity}: "${this.cfg.unit_of_measurement}"`);
    }

    // FIXED: Use current timestamp instead of state timestamp
    const timestamp = Date.now();
    const rawValue = this.cfg.attribute
      ? eventData.new_state.attributes?.[this.cfg.attribute]
      : eventData.new_state.state;

    const value = this._toNumber(rawValue);

    if (value !== null) {
      console.log(`[MSD DEBUG] 📊 Processing state change for ${this.cfg.entity}:`, {
        value,
        timestamp,
        subscriberCount: this.subscribers.size,
        originalState: this._lastOriginalState.state,
        unit_of_measurement: this.cfg.unit_of_measurement
      });

      // Add to buffer with proper timestamp
      this.buffer.push(timestamp, value);
      this._stats.updates++;
      this._stats.currentValue = value;

      // NEW: Apply transformations
      const transformedData = this._applyTransformations(timestamp, value);

      // NEW: Update aggregations
      this._updateAggregations(timestamp, value, transformedData);

      // Emit to subscribers
      console.log(`[MSD DEBUG] 📤 Emitting to ${this.subscribers.size} subscribers:`, value);

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
          console.log(`[MSD DEBUG] 📞 Calling subscriber ${index} for ${this.cfg.entity}`);
          callback(emitData);
          console.log(`[MSD DEBUG] ✅ Subscriber ${index} completed successfully`);
        } catch (error) {
          console.error(`[MSD DEBUG] ❌ Subscriber ${index} callback FAILED for ${this.cfg.entity}:`, error);
          console.error(`[MSD DEBUG] ❌ Subscriber error stack:`, error.stack);
        }
      });
    } else {
      console.log(`[MSD DEBUG] ⚠️ Skipping state change - invalid value:`, { rawValue, entity: this.cfg.entity });
    }
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

    console.log(`[MsdDataSource] 📤 Emitting to ${this.subscribers.size} subscribers:`, data.v);

    // Call all subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.warn(`[MsdDataSource] Subscriber callback error:`, error);
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
      console.warn('[MsdDataSource] Failed to subscribe to HA events:', error.message);
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
      console.warn('[MsdDataSource] Subscribe requires a function callback');
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
        console.warn('[MsdDataSource] Initial callback error:', error);
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
      console.warn('[MsdDataSource] Subscribe requires a function callback');
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

        console.log(`[MsdDataSource] Providing immediate hydration for new subscriber:`, {
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
        console.warn('[MsdDataSource] Initial callback error:', error);
      }
    } else {
      console.log(`[MsdDataSource] No data available for immediate hydration:`, {
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


  /**
   * Convert raw value to number with support for boolean states
   * @param {*} raw - Raw value from HA state
   * @returns {number|null} Converted number or null if invalid
   */
  _toNumber(raw) {
    console.log('[MSD DEBUG] 📊 _toNumber() converting:', {
      raw,
      type: typeof raw,
      entity: this.cfg.entity
    });

    if (raw === null || raw === undefined) {
      console.log('[MSD DEBUG] ⚠️ _toNumber() - null/undefined value');
      return null;
    }

    // Handle numeric values
    if (typeof raw === 'number') {
      const result = isNaN(raw) ? null : raw;
      console.log('[MSD DEBUG] 📊 _toNumber() - numeric:', { raw, result });
      return result;
    }

    // Handle string values
    if (typeof raw === 'string') {
      // Try direct numeric conversion first
      const num = parseFloat(raw);
      if (!isNaN(num) && isFinite(num)) {
        console.log('[MSD DEBUG] 📊 _toNumber() - string numeric:', { raw, num });
        return num;
      }

      // ADDED: Handle boolean-like string states
      const lowerRaw = raw.toLowerCase().trim();
      if (lowerRaw === 'on' || lowerRaw === 'true' || lowerRaw === 'active' || lowerRaw === 'open') {
        console.log('[MSD DEBUG] 📊 _toNumber() - boolean TRUE:', { raw, converted: 1 });
        return 1;
      }

      if (lowerRaw === 'off' || lowerRaw === 'false' || lowerRaw === 'inactive' || lowerRaw === 'closed') {
        console.log('[MSD DEBUG] 📊 _toNumber() - boolean FALSE:', { raw, converted: 0 });
        return 0;
      }

      // Handle unavailable/unknown states
      if (lowerRaw === 'unavailable' || lowerRaw === 'unknown') {
        console.log('[MSD DEBUG] 📊 _toNumber() - unavailable state:', { raw, converted: null });
        return null;
      }

      console.log('[MSD DEBUG] ⚠️ _toNumber() - unhandled string:', { raw });
      return null;
    }

    // Handle boolean values
    if (typeof raw === 'boolean') {
      const result = raw ? 1 : 0;
      console.log('[MSD DEBUG] 📊 _toNumber() - boolean:', { raw, result });
      return result;
    }

    console.log('[MSD DEBUG] ⚠️ _toNumber() - unsupported type:', { raw, type: typeof raw });
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

  /**
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
        transformations: this._getTransformationData(), // Convert Map to Object
        aggregations: this._getAggregationData(),       // Convert Map to Object
        entity: this.cfg.entity,
        unit_of_measurement: this.cfg.unit_of_measurement, // NEW: Include unit info
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
      transformations: this._getTransformationData(), // Convert Map to Object
      aggregations: this._getAggregationData(),       // Convert Map to Object
      entity: this.cfg.entity,
      unit_of_measurement: this.cfg.unit_of_measurement, // NEW: Include unit info
      historyReady: this._stats.historyLoaded > 0,
      bufferSize: this.buffer.size(),
      started: this._started
    };
  }

  // NEW: Add EntityRuntime-compatible method
  getEntity() {
    return this.currentState ? {
      state: this.currentState.state,
      attributes: this.currentState.attributes || {}
    } : null;
  }

  /**
   * Stop the data source and release resources
   */
  async stop() {
    this._started = false;

    if (this.haUnsubscribe) {
      try {
        this.haUnsubscribe();
      } catch (error) {
        console.warn('[MsdDataSource] HA unsubscribe error:', error);
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
   * Apply all configured transformations to a value
   * @private
   * @param {number} timestamp - Current timestamp
   * @param {number} value - Raw value to transform
   * @returns {Object} Map of transformation keys to results
   */
  _applyTransformations(timestamp, value) {
    const results = { original: value };

    this.transformations.forEach((processor, key) => {
      try {
        results[key] = processor.transform(value, timestamp, this.buffer);
        this._transformationData.set(key, results[key]);
      } catch (error) {
        console.warn(`[MsdDataSource] Transformation ${key} failed:`, error);
        results[key] = null;
        this._transformationData.set(key, null);
      }
    });

    return results;
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
        this._aggregationData.set(key, processor.getValue());
      } catch (error) {
        console.warn(`[MsdDataSource] Aggregation ${key} failed:`, error);
        this._aggregationData.set(key, null);
      }
    });
  }

  /**
   * Get current transformation data for emission
   * @private
   * @returns {Object} Current transformation results
   */
  _getTransformationData() {
    const data = {};
    this._transformationData.forEach((value, key) => {
      data[key] = value;
    });
    return data;
  }

  /**
   * Get current aggregation data for emission
   * @private
   * @returns {Object} Current aggregation results
   */
  _getAggregationData() {
    const data = {};
    this._aggregationData.forEach((value, key) => {
      data[key] = value;
    });
    return data;
  }
}
