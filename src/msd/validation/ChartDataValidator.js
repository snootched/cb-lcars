/**
 * @fileoverview Chart Data Validator - Validates ApexCharts data format compatibility
 *
 * Validates that chart types receive compatible data formats from DataSources:
 * - Single value series (line, area, bar, etc.)
 * - Range series (rangeArea, rangeBar)
 * - OHLC series (candlestick, boxPlot)
 * - Special formats (pie, donut, heatmap, etc.)
 *
 * Based on ApexCharts documentation:
 * https://apexcharts.com/docs/series/
 * https://apexcharts.com/docs/parsing-data/
 *
 * @module msd/validation/ChartDataValidator
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Chart Data Validator
 *
 * Validates ApexCharts overlay data format compatibility
 */
export class ChartDataValidator {
  /**
   * ApexCharts data format requirements by chart type
   *
   * @static
   * @type {Object}
   */
  static CHART_DATA_FORMATS = {
    // Single-value timeseries (most common)
    line: {
      dataFormat: 'timeseries',
      valueType: 'single',
      seriesStructure: '{ x: timestamp, y: number }',
      description: 'Single numeric value per timestamp',
      example: '[{ x: 1640000000, y: 25.3 }, { x: 1640003600, y: 26.1 }]'
    },
    area: {
      dataFormat: 'timeseries',
      valueType: 'single',
      seriesStructure: '{ x: timestamp, y: number }',
      description: 'Single numeric value per timestamp',
      example: '[{ x: 1640000000, y: 25.3 }, { x: 1640003600, y: 26.1 }]'
    },
    bar: {
      dataFormat: 'timeseries',
      valueType: 'single',
      seriesStructure: '{ x: timestamp, y: number }',
      description: 'Single numeric value per timestamp',
      example: '[{ x: 1640000000, y: 25.3 }, { x: 1640003600, y: 26.1 }]'
    },
    column: {
      dataFormat: 'timeseries',
      valueType: 'single',
      seriesStructure: '{ x: timestamp, y: number }',
      description: 'Single numeric value per timestamp',
      example: '[{ x: 1640000000, y: 25.3 }, { x: 1640003600, y: 26.1 }]'
    },
    scatter: {
      dataFormat: 'timeseries',
      valueType: 'single',
      seriesStructure: '{ x: timestamp, y: number }',
      description: 'Single numeric value per timestamp',
      example: '[{ x: 1640000000, y: 25.3 }, { x: 1640003600, y: 26.1 }]'
    },

    // Range-based timeseries (needs [min, max])
    rangeArea: {
      dataFormat: 'timeseries',
      valueType: 'range',
      seriesStructure: '{ x: timestamp, y: [min, max] }',
      description: 'Range (min/max) values per timestamp',
      example: '[{ x: 1640000000, y: [22.0, 28.0] }, { x: 1640003600, y: [23.5, 27.5] }]',
      requiredFields: ['min', 'max'],
      transformationHint: 'Use rolling_statistics transformation with stats: [min, max]'
    },
    rangeBar: {
      dataFormat: 'timeseries',
      valueType: 'range',
      seriesStructure: '{ x: category, y: [start, end] }',
      description: 'Range (start/end) values per category',
      example: '[{ x: "Task 1", y: [1640000000, 1640003600] }]',
      requiredFields: ['start', 'end'],
      transformationHint: 'Use custom transformation to create [start, end] arrays'
    },

    // OHLC data (candlestick, boxplot)
    candlestick: {
      dataFormat: 'timeseries',
      valueType: 'ohlc',
      seriesStructure: '{ x: timestamp, y: [open, high, low, close] }',
      description: 'OHLC (Open, High, Low, Close) values',
      example: '[{ x: 1640000000, y: [100, 105, 98, 103] }]',
      requiredFields: ['open', 'high', 'low', 'close'],
      transformationHint: 'Use rolling_statistics transformation with stats: [open, high, low, close]'
    },
    boxPlot: {
      dataFormat: 'timeseries',
      valueType: 'distribution',
      seriesStructure: '{ x: timestamp, y: [min, q1, median, q3, max] }',
      description: 'Statistical distribution (min, q1, median, q3, max)',
      example: '[{ x: 1640000000, y: [18, 22, 25, 28, 32] }]',
      requiredFields: ['min', 'q1', 'median', 'q3', 'max'],
      transformationHint: 'Use rolling_statistics transformation with stats: [min, q1, median, q3, max]'
    },

    // Simple numeric arrays (no timestamps)
    pie: {
      dataFormat: 'simple',
      valueType: 'single',
      seriesStructure: '[number, number, ...]',
      description: 'Simple array of numeric values',
      example: '[44, 55, 41, 17, 15]',
      supportsTimeseries: false,
      transformationHint: 'Use aggregation transformation to get single values'
    },
    donut: {
      dataFormat: 'simple',
      valueType: 'single',
      seriesStructure: '[number, number, ...]',
      description: 'Simple array of numeric values',
      example: '[44, 55, 41, 17, 15]',
      supportsTimeseries: false,
      transformationHint: 'Use aggregation transformation to get single values'
    },
    radialBar: {
      dataFormat: 'simple',
      valueType: 'single',
      seriesStructure: '[number, number, ...]',
      description: 'Simple array of numeric values (often percentages)',
      example: '[76, 67, 89]',
      supportsTimeseries: false,
      transformationHint: 'Use scale transformation to convert to percentage'
    },

    // Special formats
    radar: {
      dataFormat: 'categorical',
      valueType: 'single',
      seriesStructure: '[number, number, ...]',
      description: 'Values for each category/axis',
      example: '[80, 50, 70, 90, 60, 85]',
      supportsTimeseries: false
    },
    polarArea: {
      dataFormat: 'categorical',
      valueType: 'single',
      seriesStructure: '[number, number, ...]',
      description: 'Values for each polar segment',
      example: '[14, 23, 21, 17, 15, 10, 12, 17]',
      supportsTimeseries: false
    },
    heatmap: {
      dataFormat: 'matrix',
      valueType: 'single',
      seriesStructure: '{ x: category, y: number }',
      description: 'Matrix of values (category x value)',
      example: '[{ x: "Mon", y: 22 }, { x: "Tue", y: 31 }]'
    },
    treemap: {
      dataFormat: 'hierarchical',
      valueType: 'single',
      seriesStructure: '{ x: category, y: number }',
      description: 'Hierarchical values with categories',
      example: '[{ x: "A", y: 100 }, { x: "B", y: 200 }]'
    }
  };

  /**
   * Validate chart overlay data format compatibility
   *
   * @param {Object} overlay - ApexChart overlay configuration
   * @param {Object} context - Validation context
   * @param {Object} context.dataSourceManager - DataSourceManager instance
   * @returns {Object} Validation result with errors and warnings
   */
  static validate(overlay, context = {}) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Only validate apexchart overlays
    if (overlay.type !== 'apexchart') {
      return result;
    }

    // Get chart type from style or overlay
    const style = overlay.finalStyle || overlay.style || {};
    const chartType = style.chart_type || style.type || 'line';

    // Validate chart type exists
    if (!this.CHART_DATA_FORMATS[chartType]) {
      result.warnings.push({
        field: 'chart_type',
        type: 'unknown_chart_type',
        message: `Chart type '${chartType}' is not recognized or may have special data requirements`,
        value: chartType,
        severity: 'warning',
        suggestion: `Supported chart types: ${Object.keys(this.CHART_DATA_FORMATS).join(', ')}`
      });
      return result;
    }

    const formatSpec = this.CHART_DATA_FORMATS[chartType];

    // Check if data source is specified
    const sourceRef = overlay.source || overlay.data_source || overlay.sources;
    if (!sourceRef) {
      result.errors.push({
        field: 'source',
        type: 'missing_data_source',
        message: `Chart overlay '${overlay.id}' is missing a data source`,
        severity: 'error',
        suggestion: 'Add a "source" field referencing a configured data source'
      });
      result.valid = false;
      return result;
    }

    // Validate data format compatibility
    const dataFormatValidation = this._validateDataFormat(
      overlay.id,
      chartType,
      formatSpec,
      sourceRef,
      context
    );

    result.errors.push(...dataFormatValidation.errors);
    result.warnings.push(...dataFormatValidation.warnings);

    if (dataFormatValidation.errors.length > 0) {
      result.valid = false;
    }

    return result;
  }

  /**
   * Validate data format for chart type
   *
   * @private
   * @param {string} overlayId - Overlay ID
   * @param {string} chartType - Chart type
   * @param {Object} formatSpec - Format specification
   * @param {string|Array} sourceRef - Data source reference(s)
   * @param {Object} context - Validation context
   * @returns {Object} Validation result
   */
  static _validateDataFormat(overlayId, chartType, formatSpec, sourceRef, context) {
    const result = {
      errors: [],
      warnings: []
    };

    const isMultiSource = Array.isArray(sourceRef);
    const sources = isMultiSource ? sourceRef : [sourceRef];

    // Check if we have DataSourceManager in context
    if (!context.dataSourceManager) {
      result.warnings.push({
        field: 'data_format',
        type: 'cannot_validate_format',
        message: `Cannot validate data format for chart '${overlayId}' - DataSourceManager not available`,
        severity: 'warning',
        suggestion: 'Data format will be validated at runtime'
      });
      return result;
    }

    // Validate each source
    sources.forEach((source, index) => {
      const sourceValidation = this._validateSourceFormat(
        overlayId,
        chartType,
        formatSpec,
        source,
        context.dataSourceManager,
        index
      );

      result.errors.push(...sourceValidation.errors);
      result.warnings.push(...sourceValidation.warnings);
    });

    return result;
  }

  /**
   * Validate individual data source format
   *
   * @private
   * @param {string} overlayId - Overlay ID
   * @param {string} chartType - Chart type
   * @param {Object} formatSpec - Format specification
   * @param {string} sourceRef - Data source reference
   * @param {Object} dataSourceManager - DataSourceManager instance
   * @param {number} sourceIndex - Source index for multi-source
   * @returns {Object} Validation result
   */
  static _validateSourceFormat(overlayId, chartType, formatSpec, sourceRef, dataSourceManager, sourceIndex) {
    const result = {
      errors: [],
      warnings: []
    };

    // Parse dot notation (e.g., "temp.transformations.celsius")
    const { dataSource, dataPath } = this._resolveDataSourcePath(sourceRef, dataSourceManager);

    if (!dataSource) {
      result.errors.push({
        field: 'source',
        type: 'data_source_not_found',
        message: `Data source '${sourceRef}' not found for chart '${overlayId}'`,
        value: sourceRef,
        severity: 'error',
        suggestion: 'Ensure the data source is defined in your configuration'
      });
      return result;
    }

    // Check if source provides required data format
    if (formatSpec.valueType === 'range') {
      // Range charts need [min, max] arrays
      if (!this._sourceOutputsRangeData(dataSource, dataPath)) {
        result.errors.push({
          field: 'source',
          type: 'incompatible_data_format',
          message: `Chart type '${chartType}' requires range data [min, max], but source '${sourceRef}' provides single values`,
          chartType: chartType,
          requiredFormat: formatSpec.seriesStructure,
          actualFormat: '{ x: timestamp, y: number }',
          severity: 'error',
          suggestion: formatSpec.transformationHint || 'Add a transformation that outputs range data',
          example: formatSpec.example,
          helpUrl: 'https://apexcharts.com/docs/series/'
        });
      }
    } else if (formatSpec.valueType === 'ohlc') {
      // OHLC charts need [open, high, low, close]
      if (!this._sourceOutputsOHLCData(dataSource, dataPath)) {
        result.errors.push({
          field: 'source',
          type: 'incompatible_data_format',
          message: `Chart type '${chartType}' requires OHLC data, but source '${sourceRef}' provides single values`,
          chartType: chartType,
          requiredFormat: formatSpec.seriesStructure,
          requiredFields: formatSpec.requiredFields,
          severity: 'error',
          suggestion: formatSpec.transformationHint || 'Add a rolling_statistics transformation with OHLC stats',
          example: formatSpec.example
        });
      }
    } else if (formatSpec.valueType === 'distribution') {
      // Box plot needs [min, q1, median, q3, max]
      if (!this._sourceOutputsDistributionData(dataSource, dataPath)) {
        result.errors.push({
          field: 'source',
          type: 'incompatible_data_format',
          message: `Chart type '${chartType}' requires distribution data, but source '${sourceRef}' provides single values`,
          chartType: chartType,
          requiredFormat: formatSpec.seriesStructure,
          requiredFields: formatSpec.requiredFields,
          severity: 'error',
          suggestion: formatSpec.transformationHint || 'Add a rolling_statistics transformation with distribution stats',
          example: formatSpec.example
        });
      }
    }

    // Warn if using timeseries data with non-timeseries chart
    if (formatSpec.supportsTimeseries === false && this._sourceOutputsTimeseriesData(dataSource, dataPath)) {
      result.warnings.push({
        field: 'source',
        type: 'timeseries_not_supported',
        message: `Chart type '${chartType}' expects simple numeric arrays, but source '${sourceRef}' provides timeseries data`,
        chartType: chartType,
        severity: 'warning',
        suggestion: formatSpec.transformationHint || 'Use an aggregation to extract simple values, or change chart type',
        note: 'Chart may still render by using the latest value from each series'
      });
    }

    return result;
  }

  /**
   * Resolve data source path with dot notation support
   *
   * @private
   * @param {string} sourceRef - Data source reference
   * @param {Object} dataSourceManager - DataSourceManager instance
   * @returns {Object} { dataSource, dataPath }
   */
  static _resolveDataSourcePath(sourceRef, dataSourceManager) {
    if (!sourceRef || typeof sourceRef !== 'string') {
      return { dataSource: null, dataPath: null };
    }

    // Check for dot notation (e.g., "temp.transformations.celsius")
    if (sourceRef.includes('.')) {
      const parts = sourceRef.split('.');
      const sourceId = parts[0];
      const dataPath = parts.slice(1).join('.');

      const dataSource = dataSourceManager.getSource(sourceId);
      return { dataSource, dataPath };
    }

    // Simple source reference
    const dataSource = dataSourceManager.getSource(sourceRef);
    return { dataSource, dataPath: null };
  }

  /**
   * Check if source outputs range data [min, max]
   *
   * @private
   * @param {Object} dataSource - Data source instance
   * @param {string|null} dataPath - Data path (e.g., "transformations.range")
   * @returns {boolean} True if source outputs range data
   */
  static _sourceOutputsRangeData(dataSource, dataPath) {
    if (!dataPath) {
      // Raw data source - check if it has range transformation
      // This is a heuristic - we look for transformations that output arrays
      return false; // Raw data sources don't output range data
    }

    // Check if transformation outputs range data
    if (dataPath.startsWith('transformations.')) {
      const transformKey = dataPath.replace('transformations.', '');
      const transformation = dataSource.transformations?.get(transformKey);

      if (!transformation) {
        return false;
      }

      // Check transformation type
      const transformType = transformation.config?.type;

      // rolling_statistics with min/max outputs range data
      if (transformType === 'rolling_statistics') {
        const stats = transformation.config?.stats || [];
        return stats.includes('min') && stats.includes('max');
      }

      // Custom transformations might output arrays
      if (transformType === 'expression' || transformType === 'custom') {
        // Can't determine statically - assume user knows what they're doing
        return true;
      }

      return false;
    }

    return false;
  }

  /**
   * Check if source outputs OHLC data [open, high, low, close]
   *
   * @private
   * @param {Object} dataSource - Data source instance
   * @param {string|null} dataPath - Data path
   * @returns {boolean} True if source outputs OHLC data
   */
  static _sourceOutputsOHLCData(dataSource, dataPath) {
    if (!dataPath || !dataPath.startsWith('transformations.')) {
      return false;
    }

    const transformKey = dataPath.replace('transformations.', '');
    const transformation = dataSource.transformations?.get(transformKey);

    if (!transformation) {
      return false;
    }

    // rolling_statistics with OHLC stats
    if (transformation.config?.type === 'rolling_statistics') {
      const stats = transformation.config?.stats || [];
      return stats.includes('open') &&
             stats.includes('high') &&
             stats.includes('low') &&
             stats.includes('close');
    }

    return false;
  }

  /**
   * Check if source outputs distribution data [min, q1, median, q3, max]
   *
   * @private
   * @param {Object} dataSource - Data source instance
   * @param {string|null} dataPath - Data path
   * @returns {boolean} True if source outputs distribution data
   */
  static _sourceOutputsDistributionData(dataSource, dataPath) {
    if (!dataPath || !dataPath.startsWith('transformations.')) {
      return false;
    }

    const transformKey = dataPath.replace('transformations.', '');
    const transformation = dataSource.transformations?.get(transformKey);

    if (!transformation) {
      return false;
    }

    // rolling_statistics with distribution stats
    if (transformation.config?.type === 'rolling_statistics') {
      const stats = transformation.config?.stats || [];
      return stats.includes('min') &&
             stats.includes('q1') &&
             stats.includes('median') &&
             stats.includes('q3') &&
             stats.includes('max');
    }

    return false;
  }

  /**
   * Check if source outputs timeseries data
   *
   * @private
   * @param {Object} dataSource - Data source instance
   * @param {string|null} dataPath - Data path
   * @returns {boolean} True if source outputs timeseries data
   */
  static _sourceOutputsTimeseriesData(dataSource, dataPath) {
    // All DataSources with buffers are timeseries by default
    return dataSource.buffer && dataSource.buffer.size() > 0;
  }

  /**
   * Get format specification for chart type
   *
   * @static
   * @param {string} chartType - Chart type
   * @returns {Object|null} Format specification or null
   */
  static getFormatSpec(chartType) {
    return this.CHART_DATA_FORMATS[chartType] || null;
  }

  /**
   * Get all supported chart types
   *
   * @static
   * @returns {Array<string>} Array of supported chart types
   */
  static getSupportedChartTypes() {
    return Object.keys(this.CHART_DATA_FORMATS);
  }
}

export default ChartDataValidator;