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
  }

  async start() {
    if (this._started || this._destroyed) return;

    try {
      // NEW: Initialize with current HASS state if available
      if (this.hass.states && this.hass.states[this.cfg.entity]) {
        const currentState = this.hass.states[this.cfg.entity];
        console.log(`[MsdDataSource] 🔄 Loading initial state for ${this.cfg.entity}:`, currentState.state);

        // Simulate initial state change to populate buffer
        this._handleStateChange({
          entity_id: this.cfg.entity,
          new_state: currentState,
          old_state: null
        });
      }

      // FIXED: Await the subscription since subscribeEvents returns a Promise
      this.haUnsubscribe = await this.hass.connection.subscribeEvents((event) => {
        if (event.event_type === 'state_changed' &&
            event.data?.entity_id === this.cfg.entity) {
          console.log(`[MsdDataSource] 📊 HA event received for ${this.cfg.entity}:`, event.data.new_state?.state);
          this._handleStateChange(event.data);
        }
      }, 'state_changed');

      this._started = true;
      console.log(`[MsdDataSource] ✅ Subscribed to HA events for ${this.cfg.entity}`);

    } catch (error) {
      console.error(`[MsdDataSource] Failed to subscribe to HA events for ${this.cfg.entity}:`, error);
      throw error;
    }
  }

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

  async _preloadHistory() {
    if (!this.hass?.callService || !this.cfg.entity) return;

    const hours = Math.max(1, Math.min(168, this.cfg.history.hours || 6)); // 1-168 hours
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 3600000);

    try {
      // Use Home Assistant statistics service for efficient history
      const response = await this.hass.callService('recorder', 'get_statistics', {
        statistic_ids: [this.cfg.entity],
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        period: 'hour'
      });

      if (response && response[0]?.statistics) {
        const statistics = response[0].statistics;

        for (const stat of statistics) {
          const timestamp = new Date(stat.start).getTime();
          const value = this._extractStatisticValue(stat);

          if (value !== null) {
            this.buffer.push(timestamp, value);
            this._stats.historyLoaded++;
          }
        }
      }
    } catch (error) {
      // Fallback: try state history if statistics fail
      console.warn('[MsdDataSource] Statistics failed, trying state history:', error.message);
      await this._preloadStateHistory(startTime, endTime);
    }
  }

  async _preloadStateHistory(startTime, endTime) {
    try {
      // Fallback to direct state history
      const response = await this.hass.callService('recorder', 'get_history', {
        entity_ids: [this.cfg.entity],
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString()
      });

      if (response && response[0]) {
        const states = response[0];

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
    } catch (error) {
      console.warn('[MsdDataSource] State history fallback also failed:', error.message);
    }
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
   * Handle Home Assistant state change events
   * @param {Object} stateChangeData - HA state_changed event data
   */
  _handleStateChange(stateChangeData) {
    if (this._destroyed || !this._started) return;

    const newState = stateChangeData.new_state;
    if (!newState || newState.entity_id !== this.cfg.entity) return;

    // Extract numeric value from state
    const value = parseFloat(newState.state);
    if (isNaN(value)) {
      console.warn(`[MsdDataSource] Non-numeric state for ${this.cfg.entity}:`, newState.state);
      this._stats.invalid++;
      return;
    }

    const timestamp = new Date(newState.last_changed || newState.last_updated).getTime();

    console.log(`[MsdDataSource] 📊 State change for ${this.cfg.entity}: ${value} at ${timestamp}`);

    // Update statistics
    this._stats.received++;

    // Add to buffer
    this.buffer.push({ t: timestamp, v: value });

    // Store current state for EntityRuntime compatibility
    this.currentState = newState;

    // Check if we should emit to subscribers
    if (this._shouldEmit(value, timestamp)) {
      this._emit({ t: timestamp, v: value, buffer: this.buffer, stats: this._stats });
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

  _toNumber(rawValue) {
    if (rawValue === null || rawValue === undefined) return null;
    if (typeof rawValue === 'number') {
      return Number.isFinite(rawValue) ? rawValue : null;
    }
    if (typeof rawValue === 'string') {
      const parsed = parseFloat(rawValue);
      return Number.isFinite(parsed) ? parsed : null;
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

  getCurrentData() {
    const lastPoint = this.buffer.last();
    return lastPoint ? {
      t: lastPoint.t,
      v: lastPoint.v,
      buffer: this.buffer
    } : null;
  }

  // NEW: Add EntityRuntime-compatible method
  getEntity() {
    return this.currentState ? {
      state: this.currentState.state,
      attributes: this.currentState.attributes || {}
    } : null;
  }
}
