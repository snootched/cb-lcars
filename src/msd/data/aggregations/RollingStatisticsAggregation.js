import { AggregationProcessor } from './AggregationProcessor.js';
import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';

/**
 * Rolling Statistics Aggregation
 *
 * Calculates multiple statistics over a rolling time window and outputs
 * them as arrays for multi-value chart types (rangeArea, boxPlot, candlestick).
 *
 * Supported statistics:
 * - min, max: Range values
 * - mean, median: Central tendency
 * - q1, q3: Quartiles for box plots
 * - std_dev, variance: Spread measures
 * - open, close: First/last values for candlestick
 * - high, low: Extremes (aliases for min/max)
 *
 * @extends AggregationProcessor
 */
export class RollingStatisticsAggregation extends AggregationProcessor {
  constructor(config) {
    // ✅ FIX: Pass type as first argument to parent constructor
    super('rolling_statistics', config);

    // Remove duplicate type assignment (already set by parent)
    this.window = this._parseTimeWindow(config.window || '1h');
    this.stats = config.stats || ['min', 'max']; // Default to range

    // Validate stats array
    if (!Array.isArray(this.stats) || this.stats.length === 0) {
      throw new Error('rolling_statistics requires "stats" array with at least one statistic');
    }

    // Validate stat names
    const validStats = ['min', 'max', 'mean', 'median', 'q1', 'q3',
                        'std_dev', 'variance', 'open', 'close', 'high', 'low'];
    const invalidStats = this.stats.filter(s => !validStats.includes(s));
    if (invalidStats.length > 0) {
      throw new Error(`Invalid statistics: ${invalidStats.join(', ')}. Valid: ${validStats.join(', ')}`);
    }

    // Output format: 'array' (default) or 'object'
    this.outputFormat = config.output_format || config.outputFormat || 'array';

    // Rolling window of values
    this._values = [];

    // Result (array or object)
    this._result = null;

    cblcarsLog.debug(
      `[RollingStatistics] Initialized "${this.key}": stats=[${this.stats.join(', ')}], ` +
      `window=${this.window}ms, format=${this.outputFormat}`
    );
  }

  /**
   * Update aggregation with new value
   * @param {number} timestamp - Current timestamp
   * @param {number} value - New value
   * @param {Object} transformedData - Transformed values (for input_source support)
   */
  update(timestamp, value, transformedData = {}) {
    if (!this.enabled || !Number.isFinite(value)) return;

    // Handle input_source (chaining from transformations)
    let inputValue = value;
    if (this.config.input_source && transformedData[this.config.input_source] !== undefined) {
      inputValue = transformedData[this.config.input_source];
      if (!Number.isFinite(inputValue)) return;
    }

    // Add to rolling window
    this._values.push({
      timestamp,
      value: inputValue
    });

    // Remove old values outside window
    const cutoff = timestamp - this.window;
    this._values = this._values.filter(v => v.timestamp >= cutoff);

    // Recalculate statistics
    this._calculate();
  }

  /**
   * Calculate statistics from current window
   * @private
   */
  _calculate() {
    if (this._values.length === 0) {
      this._result = this.outputFormat === 'array'
        ? new Array(this.stats.length).fill(null)
        : this._createEmptyObject();
      return;
    }

    // Extract numeric values sorted for percentile calculations
    const values = this._values.map(v => v.value).sort((a, b) => a - b);
    const n = values.length;

    // Calculate each requested statistic
    const results = {};

    this.stats.forEach(stat => {
      switch (stat) {
        case 'min':
        case 'low':
          results[stat] = values[0];
          break;

        case 'max':
        case 'high':
          results[stat] = values[n - 1];
          break;

        case 'mean':
          results[stat] = this._calculateMean(values);
          break;

        case 'median':
          results[stat] = this._calculatePercentile(values, 0.5);
          break;

        case 'q1':
          results[stat] = this._calculatePercentile(values, 0.25);
          break;

        case 'q3':
          results[stat] = this._calculatePercentile(values, 0.75);
          break;

        case 'std_dev':
          results[stat] = this._calculateStdDev(values);
          break;

        case 'variance':
          results[stat] = this._calculateVariance(values);
          break;

        case 'open':
          // First value in window (chronologically)
          results[stat] = this._values[0].value;
          break;

        case 'close':
          // Last value in window (chronologically)
          results[stat] = this._values[this._values.length - 1].value;
          break;

        default:
          results[stat] = null;
      }
    });

    // Format output
    if (this.outputFormat === 'array') {
      this._result = this.stats.map(stat => results[stat]);
    } else {
      this._result = results;
    }

    this._stats.calculations++;
  }

  /**
   * Get current aggregation result
   * @returns {Array|Object|null} Array of statistics or object with named values
   */
  getValue() {
    return this._result;
  }

  /**
   * Calculate mean of values
   * @private
   */
  _calculateMean(values) {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate percentile using linear interpolation
   * @private
   */
  _calculatePercentile(sortedValues, percentile) {
    const index = (sortedValues.length - 1) * percentile;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Calculate variance
   * @private
   */
  _calculateVariance(values) {
    const mean = this._calculateMean(values);
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  /**
   * Calculate standard deviation
   * @private
   */
  _calculateStdDev(values) {
    return Math.sqrt(this._calculateVariance(values));
  }

  /**
   * Create empty result object with null values
   * @private
   */
  _createEmptyObject() {
    const obj = {};
    this.stats.forEach(stat => {
      obj[stat] = null;
    });
    return obj;
  }

  /**
   * Parse time window string to milliseconds
   * @private
   */
  _parseTimeWindow(windowStr) {
    if (typeof windowStr === 'number') return windowStr;

    const match = windowStr.match(/^(\d+(?:\.\d+)?)\s*(s|sec|m|min|h|hr|d|day)s?$/i);
    if (!match) {
      throw new Error(`Invalid time window format: ${windowStr}`);
    }

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
        throw new Error(`Unknown time unit: ${unit}`);
    }
  }

  /**
   * Get statistics about aggregation
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this._stats,
      type: this.type,
      window: this.window,
      stats: this.stats,
      outputFormat: this.outputFormat,
      currentSamples: this._values.length
    };
  }
}