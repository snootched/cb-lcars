/**
 * AggregationProcessor - Base class for data aggregations
 *
 * Features:
 * - Runtime-only aggregations (no persistence)
 * - Time-windowed calculations
 * - Memory-efficient for MSD page lifecycles
 * - Configurable reset behavior
 */

export class AggregationProcessor {
  constructor(type, config) {
    this.type = type;
    this.config = { ...config };
    this.key = config.key || type;
    this.enabled = config.enabled !== false;

    // Parse time window if specified
    this.windowMs = this._parseTimeWindow(config.window);
    this.maxAge = this.windowMs || (24 * 60 * 60 * 1000); // Default 24h max

    // Internal state
    this._values = [];
    this._lastUpdate = 0;
    this._result = null;

    // Performance tracking
    this._stats = {
      updates: 0,
      calculations: 0,
      resets: 0
    };
  }

  /**
   * Update aggregation with new value
   * @param {number} timestamp - Current timestamp
   * @param {number} value - New value to aggregate
   * @param {Object} transformedData - Any transformed values from the same update
   */
  update(timestamp, value, transformedData = {}) {
    if (!this.enabled || !Number.isFinite(value)) return;

    // Clean old values first
    this._cleanOldValues(timestamp);

    // Add new value
    this._values.push({ timestamp, value, transformed: transformedData });
    this._lastUpdate = timestamp;
    this._stats.updates++;

    // Recalculate result
    this._calculate();
  }

  /**
   * Get current aggregation result
   * @returns {any} Current aggregated value
   */
  getValue() {
    return this._result;
  }

  /**
   * Get aggregation statistics and metadata
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this._stats,
      type: this.type,
      key: this.key,
      enabled: this.enabled,
      valueCount: this._values.length,
      windowMs: this.windowMs,
      lastUpdate: this._lastUpdate,
      currentResult: this._result
    };
  }

  /**
   * Reset aggregation state
   */
  reset() {
    this._values = [];
    this._result = null;
    this._stats.resets++;
  }

  /**
   * Clean values older than the window
   * @private
   * @param {number} currentTimestamp - Current timestamp
   */
  _cleanOldValues(currentTimestamp) {
    if (!this.windowMs) return; // No window limit

    const cutoffTime = currentTimestamp - this.windowMs;
    const originalLength = this._values.length;

    this._values = this._values.filter(item => item.timestamp >= cutoffTime);

    if (this._values.length !== originalLength) {
      this._stats.cleanedValues = (this._stats.cleanedValues || 0) +
        (originalLength - this._values.length);
    }
  }

  /**
   * Parse time window string to milliseconds
   * @private
   * @param {string|number} window - Time window specification
   * @returns {number|null} Window in milliseconds or null if unlimited
   */
  _parseTimeWindow(window) {
    if (typeof window === 'number') return window;
    if (typeof window !== 'string') return null;

    const match = window.match(/^(\d+(?:\.\d+)?)\s*(s|sec|m|min|h|hr|d|day)s?$/i);
    if (!match) return null;

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
        return null;
    }
  }

  /**
   * Override this method in subclasses to implement aggregation logic
   * @protected
   */
  _calculate() {
    throw new Error('_calculate must be implemented by subclasses');
  }
}

/**
 * Moving Average Aggregation
 * Calculates average over a time window or fixed number of samples
 */
export class MovingAverageAggregation extends AggregationProcessor {
  constructor(config) {
    super('moving_average', config);
    this.maxSamples = config.max_samples || config.maxSamples;
  }

  _calculate() {
    if (this._values.length === 0) {
      this._result = null;
      return;
    }

    // Limit by sample count if specified
    let values = this._values;
    if (this.maxSamples && values.length > this.maxSamples) {
      values = values.slice(-this.maxSamples);
    }

    const sum = values.reduce((acc, item) => acc + item.value, 0);
    this._result = sum / values.length;
    this._stats.calculations++;
  }
}

/**
 * Min/Max Aggregation
 * Tracks minimum and maximum values
 */
export class MinMaxAggregation extends AggregationProcessor {
  constructor(config) {
    super('min_max', config);
    this.trackMin = config.min !== false;
    this.trackMax = config.max !== false;
    this.trackAvg = config.avg === true;
  }

  _calculate() {
    if (this._values.length === 0) {
      this._result = null;
      return;
    }

    const values = this._values.map(item => item.value);
    const result = {};

    if (this.trackMin) {
      result.min = Math.min(...values);
    }

    if (this.trackMax) {
      result.max = Math.max(...values);
    }

    if (this.trackAvg) {
      const sum = values.reduce((acc, val) => acc + val, 0);
      result.avg = sum / values.length;
    }

    result.count = values.length;
    this._result = result;
    this._stats.calculations++;
  }
}

/**
 * Rate of Change Aggregation
 * Calculates rate of change between values
 */
export class RateOfChangeAggregation extends AggregationProcessor {
  constructor(config) {
    super('rate_of_change', config);
    this.unit = config.unit || 'per_second'; // per_second, per_minute, per_hour
    this.smoothing = config.smoothing || false;
  }

  _calculate() {
    if (this._values.length < 2) {
      this._result = null;
      return;
    }

    const recent = this._values.slice(-2);
    const [prev, curr] = recent;

    const timeDiff = (curr.timestamp - prev.timestamp) / 1000; // Convert to seconds
    if (timeDiff <= 0) {
      this._result = 0;
      return;
    }

    const valueDiff = curr.value - prev.value;
    let rate = valueDiff / timeDiff;

    // Convert to requested unit
    switch (this.unit) {
      case 'per_minute':
        rate *= 60;
        break;
      case 'per_hour':
        rate *= 3600;
        break;
      // per_second is default, no conversion needed
    }

    this._result = rate;
    this._stats.calculations++;
  }
}

/**
 * Session Statistics Aggregation
 * Tracks statistics since page load/reset
 */
export class SessionStatsAggregation extends AggregationProcessor {
  constructor(config) {
    super('session_stats', config);
    this._firstValue = null;
    this._sessionStart = Date.now();
  }

  _calculate() {
    if (this._values.length === 0) {
      this._result = null;
      return;
    }

    const values = this._values.map(item => item.value);
    const timestamps = this._values.map(item => item.timestamp);

    if (this._firstValue === null) {
      this._firstValue = values[0];
    }

    const result = {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
      first: this._firstValue,
      last: values[values.length - 1],
      sessionDuration: (Date.now() - this._sessionStart) / 1000, // seconds
      dataSpan: (timestamps[timestamps.length - 1] - timestamps[0]) / 1000 // seconds
    };

    this._result = result;
    this._stats.calculations++;
  }
}

/**
 * Recent Trend Aggregation
 * Analyzes recent trend direction
 */
export class RecentTrendAggregation extends AggregationProcessor {
  constructor(config) {
    super('recent_trend', config);
    this.samples = config.samples || 5;
    this.threshold = config.threshold || 0.01; // Minimum change to consider significant
  }

  _calculate() {
    if (this._values.length < 2) {
      this._result = { direction: 'unknown', strength: 0 };
      return;
    }

    // Get recent samples
    const recentValues = this._values.slice(-this.samples);
    if (recentValues.length < 2) {
      this._result = { direction: 'unknown', strength: 0 };
      return;
    }

    // Simple linear regression
    const n = recentValues.length;
    const sumX = recentValues.reduce((sum, _, i) => sum + i, 0);
    const sumY = recentValues.reduce((sum, item) => sum + item.value, 0);
    const sumXY = recentValues.reduce((sum, item, i) => sum + i * item.value, 0);
    const sumXX = recentValues.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    let direction = 'stable';
    if (Math.abs(slope) > this.threshold) {
      direction = slope > 0 ? 'increasing' : 'decreasing';
    }

    this._result = {
      direction,
      strength: Math.abs(slope),
      slope
    };

    this._stats.calculations++;
  }
}

/**
 * Create aggregation processor from configuration
 * @param {string} type - Aggregation type
 * @param {Object} config - Aggregation configuration
 * @returns {AggregationProcessor} Configured processor instance
 */
export function createAggregationProcessor(type, config) {
  switch (type) {
    case 'moving_average':
      return new MovingAverageAggregation(config);

    case 'min_max':
    case 'daily_stats':
      return new MinMaxAggregation(config);

    case 'rate_of_change':
      return new RateOfChangeAggregation(config);

    case 'session_stats':
      return new SessionStatsAggregation(config);

    case 'recent_trend':
      return new RecentTrendAggregation(config);

    default:
      throw new Error(`Unknown aggregation type: ${type}`);
  }
}