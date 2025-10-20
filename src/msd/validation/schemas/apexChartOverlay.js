/**
 * @fileoverview ApexChart Overlay Schema
 *
 * Validation schema for ApexChart overlays.
 * Defines required fields and constraints specific to chart rendering.
 *
 * @module msd/validation/schemas/apexChartOverlay
 */

import { ApexChartsAdapter } from '../../charts/ApexChartsAdapter.js';
import { ChartDataValidator } from '../ChartDataValidator.js';

/**
 * ApexChart overlay validation schema
 */
export const apexChartOverlaySchema = {
  type: 'apexchart',
  extends: 'common',

  required: ['position', 'size'],

  properties: {
    // ✅ ENHANCED: Accept string OR array for backward compatibility
    source: {
      type: ['string', 'array'],
      optional: true,
      items: {  // Only applies when type is array
        type: 'string'
      },
      errorMessage: 'Source must be a string or array of data source references'
    },

    // ✅ ENHANCED: Accept string OR array for backward compatibility
    data_source: {
      type: ['string', 'array'],
      optional: true,
      items: {  // Only applies when type is array
        type: 'string'
      },
      errorMessage: 'Data source must be a string or array of data source references'
    },

    // ✅ ENHANCED: Accept array OR string for backward compatibility
    sources: {
      type: ['array', 'string'],
      optional: true,
      items: {  // Only applies when type is array
        type: 'string'
      },
      errorMessage: 'Sources must be an array or string of data source references'
    },

    chart_type: {
      type: 'string',
      enum: ApexChartsAdapter.VALID_CHART_TYPES,
      optional: true,
      errorMessage: `Chart type must be one of: ${ApexChartsAdapter.VALID_CHART_TYPES.join(', ')}`
    },

    template: {
      type: 'string',
      optional: true,
      errorMessage: 'Template must be a string reference to a chart template'
    },

    style: {
      type: 'object',
      optional: true,
      properties: {
        background_color: {
          type: 'string',
          format: 'color',
          optional: true
        },

        stroke_color: {
          type: 'string',
          format: 'color',
          optional: true
        },

        stroke_width: {
          type: 'number',
          min: 0,
          max: 20,
          optional: true,
          errorMessage: 'Stroke width must be between 0 and 20'
        },

        grid_color: {
          type: 'string',
          format: 'color',
          optional: true
        },

        show_grid: {
          type: 'boolean',
          optional: true
        },

        show_legend: {
          type: 'boolean',
          optional: true
        },

        show_toolbar: {
          type: 'boolean',
          optional: true
        },

        show_tooltip: {
          type: 'boolean',
          optional: true
        },

        colors: {
          type: 'array',
          optional: true,
          items: {
            type: 'string',
            format: 'color'
          },
          errorMessage: 'Colors must be an array of valid color values'
        },

        time_window: {
          type: 'string',
          optional: true,
          pattern: /^\d+[smhd]$/,
          errorMessage: 'Time window must be in format: number + unit (e.g., "24h", "30m", "7d")'
        },

        max_points: {
          type: 'number',
          min: 10,
          max: 10000,
          optional: true,
          errorMessage: 'Max points must be between 10 and 10000'
        },

        animation_preset: {
          type: 'string',
          optional: true
        },

        chart_options: {
          type: 'object',
          optional: true,
          errorMessage: 'Chart options must be a valid ApexCharts configuration object'
        }
      }
    }
  },

  validators: [
    // Validate data source requirement
    (overlay, context) => {
      const hasSource = overlay.source || overlay.data_source || overlay.sources;

      if (!hasSource) {
        return {
          valid: false,
          errors: [{
            field: 'source',
            type: 'required_field',
            message: 'ApexChart overlay requires a data source',
            severity: 'error',
            suggestion: 'Add a "source", "data_source", or "sources" field'
          }]
        };
      }

      return { valid: true };
    },

    // Validate conflicting source fields
    (overlay, context) => {
      const sourceFields = [];
      if (overlay.source) sourceFields.push('source');
      if (overlay.data_source) sourceFields.push('data_source');
      if (overlay.sources) sourceFields.push('sources');

      if (sourceFields.length > 1) {
        return {
          valid: false,
          warnings: [{
            field: 'source',
            type: 'conflicting_fields',
            message: `Multiple data source fields defined: ${sourceFields.join(', ')}`,
            severity: 'warning',
            suggestion: 'Use only one of: source, data_source, or sources'
          }]
        };
      }

      return { valid: true };
    },

    // Validate chart_options structure if present
    (overlay, context) => {
      if (!overlay.style || !overlay.style.chart_options) {
        return { valid: true };
      }

      const chartOptions = overlay.style.chart_options;
      const warnings = [];

      // Warn about dimension overrides
      if (chartOptions.chart && (chartOptions.chart.width || chartOptions.chart.height)) {
        warnings.push({
          field: 'style.chart_options.chart',
          type: 'dimension_override',
          message: 'Chart dimensions in chart_options will override overlay size',
          severity: 'warning',
          suggestion: 'Remove width/height from chart_options to use overlay size'
        });
      }

      return warnings.length > 0 ? { valid: true, warnings } : { valid: true };
    },

    // Chart data format validation
    (overlay, context) => {
      return ChartDataValidator.validate(overlay, context);
    }
  ]
};

export default apexChartOverlaySchema;