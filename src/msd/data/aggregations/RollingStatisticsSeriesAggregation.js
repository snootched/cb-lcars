import { AggregationProcessor } from './AggregationProcessor.js';
import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';

/**
 * Rolling Statistics Series Aggregation
 *
 * Stores time-series history of rolling statistics calculations for charting.
 * Perfect for ApexCharts rangeArea, boxPlot, and candlestick charts.
 *
 * Unlike rolling_statistics (which returns a single current value), this stores
 * historical calculations as [[timestamp, [stat1, stat2, ...]], ...] array.
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
export class RollingStatisticsSeriesAggregation extends AggregationProcessor {
  constructor(config) {
    super('rolling_statistics_series', config);

    // Time window for each calculation
    this.window = this._parseTimeWindow(config.window || '1h');

    // How often to calculate and store results
    this.interval = this._parseTimeWindow(config.interval || '1h');

    // Statistics to calculate
    this.stats = config.stats || ['min', 'max'];

    // Maximum number of time-series points to store
    this.maxPoints = Math.max(1, Math.min(1000, config.max_points || 100));

    // Validate stats array
    if (!Array.isArray(this.stats) || this.stats.length === 0) {
      throw new Error('rolling_statistics_series requires "stats" array with at least one statistic');
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

    // Rolling window of raw values for calculating stats
    this._values = [];

    // Time-series of calculated results
    // Format: [[timestamp, [stat1, stat2, ...]], ...]
    this._series = [];

    // Track when we last calculated
    this._lastCalculationTime = 0;

    // Track total calculations for stats
    this._calculationCount = 0;

    cblcarsLog.debug(
      `[RollingStatisticsSeries] Initialized "${this.key}": stats=[${this.stats.join(', ')}], ` +
      `window=${this.window}ms (${this._formatDuration(this.window)}), ` +
      `interval=${this.interval}ms (${this._formatDuration(this.interval)}), ` +
      `maxPoints=${this.maxPoints}, format=${this.outputFormat}`
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

    // Calculate and store if interval has passed
    if (this._shouldCalculate(timestamp)) {
      this._calculateAndStore(timestamp);
      this._lastCalculationTime = timestamp;
    }
  }

  /**
   * Check if we should calculate based on interval
   * @private
   */
  _shouldCalculate(timestamp) {
    // Always calculate on first data point
    if (this._lastCalculationTime === 0) {
      return true;
    }

    // Calculate if interval has passed
    return (timestamp - this._lastCalculationTime) >= this.interval;
  }

  /**
   * Calculate statistics and store in time-series
   * @private
   */
  _calculateAndStore(timestamp) {
    if (this._values.length === 0) {
      // Store null values if no data
      const nullResults = this.outputFormat === 'array'
        ? new Array(this.stats.length).fill(null)
        : this._createEmptyObject();

      this._series.push([timestamp, nullResults]);
      this._enforceMaxPoints();
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
    let formattedResults;
    if (this.outputFormat === 'array') {
      formattedResults = this.stats.map(stat => results[stat]);
    } else {
      formattedResults = results;
    }

    // Store as [timestamp, results] entry
    this._series.push([timestamp, formattedResults]);

    // Enforce max_points limit (circular buffer behavior)
    this._enforceMaxPoints();

    this._calculationCount++;
    this._stats.calculations = this._calculationCount;
  }

  /**
   * Enforce maxPoints limit on series array
   * @private
   */
  _enforceMaxPoints() {
    while (this._series.length > this.maxPoints) {
      this._series.shift();
    }
  }

  /**
   * Get current time-series data
   * @returns {Array} Array of [timestamp, [stat1, stat2, ...]] entries
   */
  getValue() {
    return this._series;
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
   * Format duration for logging
   * @private
   */
  _formatDuration(ms) {
    if (ms < 60000) return `${ms / 1000}s`;
    if (ms < 3600000) return `${ms / 60000}m`;
    if (ms < 86400000) return `${ms / 3600000}h`;
    return `${ms / 86400000}d`;
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
      interval: this.interval,
      stats: this.stats,
      outputFormat: this.outputFormat,
      maxPoints: this.maxPoints,
      currentSamples: this._values.length,
      seriesLength: this._series.length,
      calculations: this._calculationCount,
      // Time span covered by series
      timeSpan: this._series.length > 0
        ? this._series[this._series.length - 1][0] - this._series[0][0]
        : 0
    };
  }
}
