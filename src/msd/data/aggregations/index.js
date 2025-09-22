/**
 * AggregationProcessor - Index and factory for aggregation processors
 *
 * This module provides the factory function to create aggregation processors
 * and exports all aggregation types for easy importing.
 */

import {
  MovingAverageAggregation,
  MinMaxAggregation,
  RateOfChangeAggregation,
  SessionStatsAggregation,
  RecentTrendAggregation,
  DurationAggregation
} from './AggregationProcessor.js';

/**
 * Create an aggregation processor from configuration
 * @param {string} type - Type of aggregation processor
 * @param {Object} config - Configuration object
 * @returns {Object} Configured aggregation processor instance
 */
export function createAggregationProcessor(type, config) {
  if (!type || !config) {
    throw new Error('Aggregation type and config are required');
  }

  switch (type) {
    case 'moving_average':
      return new MovingAverageAggregation(config);

    case 'min_max':
    case 'daily_stats':
    case 'stats':
      return new MinMaxAggregation(config);

    case 'rate_of_change':
    case 'rate':
      return new RateOfChangeAggregation(config);

    case 'session_stats':
    case 'session':
      return new SessionStatsAggregation(config);

    case 'recent_trend':
    case 'trend':
      return new RecentTrendAggregation(config);

    case 'duration':
      return new DurationAggregation(config);

    default:
      throw new Error(`Unknown aggregation type: ${type}. Available types: moving_average, min_max, rate_of_change, session_stats, recent_trend, duration`);
  }
}

// Export aggregation classes for direct use
export {
  MovingAverageAggregation,
  MinMaxAggregation,
  RateOfChangeAggregation,
  SessionStatsAggregation,
  RecentTrendAggregation,
  DurationAggregation
};