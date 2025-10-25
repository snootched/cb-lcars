/**
 * @fileoverview ApexChart Overlay Schema
 *
 * Validation schema for ApexChart overlays.
 * Defines required fields and constraints specific to chart rendering.
 *
 * STANDARDIZATION: ApexCharts uses camelCase (library convention exception)
 * - ApexCharts properties mirror the ApexCharts.js library API
 * - Uses camelCase for chart-specific options (chartType, strokeWidth, etc.)
 * - Common CB-LCARS properties still use snake_case where applicable
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

    template: {
      type: 'string',
      optional: true,
      errorMessage: 'Template must be a string reference to a chart template'
    },

    style: {
      type: 'object',
      optional: true,
      properties: {
        // ============================================================================
        // CHART TYPE & DISPLAY
        // ============================================================================

        chart_type: {
          type: 'string',
          enum: ApexChartsAdapter.VALID_CHART_TYPES,
          optional: true,
          errorMessage: `Chart type must be one of: ${ApexChartsAdapter.VALID_CHART_TYPES.join(', ')}`
        },

        curve: {
          type: 'string',
          enum: ['smooth', 'straight', 'stepline', 'monotoneCubic'],
          optional: true,
          errorMessage: 'Curve must be one of: smooth, straight, stepline, monotoneCubic'
        },

        // ============================================================================
        // SERIES COLORS (Primary color control for data)
        // ============================================================================

        color: {
          type: 'string',
          format: 'color',
          optional: true,
          errorMessage: 'Color must be a valid color value (applies to all series)'
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

        // ============================================================================
        // STROKE/OUTLINE COLORS
        // ============================================================================

        stroke_color: {
          type: 'string',
          format: 'color',
          optional: true,
          errorMessage: 'Stroke color for lines/borders'
        },

        stroke_colors: {
          type: 'array',
          optional: true,
          items: {
            type: 'string',
            format: 'color'
          },
          errorMessage: 'Stroke colors must be an array of valid color values'
        },

        stroke_width: {
          type: 'number',
          min: 0,
          max: 20,
          optional: true,
          errorMessage: 'Stroke width must be between 0 and 20'
        },

        // ============================================================================
        // FILL COLORS (for area/bar charts)
        // ============================================================================

        fill_colors: {
          type: 'array',
          optional: true,
          items: {
            type: 'string',
            format: 'color'
          },
          errorMessage: 'Fill colors must be an array of valid color values'
        },

        fill_type: {
          type: 'string',
          enum: ['solid', 'gradient', 'pattern', 'image'],
          optional: true,
          errorMessage: 'Fill type must be one of: solid, gradient, pattern, image'
        },

        fill_opacity: {
          type: 'number',
          min: 0,
          max: 1,
          optional: true,
          errorMessage: 'Fill opacity must be between 0 and 1'
        },

        // ============================================================================
        // BACKGROUND & FOREGROUND
        // ============================================================================

        background_color: {
          type: 'string',
          format: 'color',
          optional: true,
          errorMessage: 'Background color for chart area'
        },

        foreground_color: {
          type: 'string',
          format: 'color',
          optional: true,
          errorMessage: 'Foreground/text color for chart'
        },

        // ============================================================================
        // GRID COLORS
        // ============================================================================

        grid_color: {
          type: 'string',
          format: 'color',
          optional: true,
          errorMessage: 'Grid line color'
        },

        grid_row_colors: {
          type: 'array',
          optional: true,
          items: {
            type: 'string',
            format: 'color'
          },
          errorMessage: 'Grid row colors for alternating rows'
        },

        grid_column_colors: {
          type: 'array',
          optional: true,
          items: {
            type: 'string',
            format: 'color'
          },
          errorMessage: 'Grid column colors for alternating columns'
        },

        show_grid: {
          type: 'boolean',
          optional: true
        },

        // ============================================================================
        // AXIS COLORS
        // ============================================================================

        axis_color: {
          type: 'string',
          format: 'color',
          optional: true,
          errorMessage: 'Unified color for all axis elements'
        },

        xaxis_color: {
          type: 'string',
          format: 'color',
          optional: true,
          errorMessage: 'X-axis label color'
        },

        xaxis_colors: {
          type: 'array',
          optional: true,
          items: {
            type: 'string',
            format: 'color'
          },
          errorMessage: 'X-axis label colors (one per label)'
        },

        yaxis_color: {
          type: 'string',
          format: 'color',
          optional: true,
          errorMessage: 'Y-axis label color'
        },

        yaxis_colors: {
          type: 'array',
          optional: true,
          items: {
            type: 'string',
            format: 'color'
          },
          errorMessage: 'Y-axis label colors (one per label)'
        },

        axis_border_color: {
          type: 'string',
          format: 'color',
          optional: true,
          errorMessage: 'Axis border line color'
        },

        axis_ticks_color: {
          type: 'string',
          format: 'color',
          optional: true,
          errorMessage: 'Axis tick mark color'
        },

        // ============================================================================
        // LEGEND COLORS
        // ============================================================================

        legend_color: {
          type: 'string',
          format: 'color',
          optional: true,
          errorMessage: 'Legend text color'
        },

        legend_colors: {
          type: 'array',
          optional: true,
          items: {
            type: 'string',
            format: 'color'
          },
          errorMessage: 'Legend text colors (one per series)'
        },

        show_legend: {
          type: 'boolean',
          optional: true
        },

        // ============================================================================
        // MARKER COLORS (data points)
        // ============================================================================

        marker_colors: {
          type: 'array',
          optional: true,
          items: {
            type: 'string',
            format: 'color'
          },
          errorMessage: 'Marker fill colors for data points'
        },

        marker_stroke_colors: {
          type: 'array',
          optional: true,
          items: {
            type: 'string',
            format: 'color'
          },
          errorMessage: 'Marker border/stroke colors for data points'
        },

        marker_stroke_width: {
          type: 'number',
          min: 0,
          max: 10,
          optional: true,
          errorMessage: 'Marker stroke width must be between 0 and 10'
        },

        // ============================================================================
        // DATA LABEL COLORS (value labels on chart)
        // ============================================================================

        data_label_colors: {
          type: 'array',
          optional: true,
          items: {
            type: 'string',
            format: 'color'
          },
          errorMessage: 'Data label colors for value text'
        },

        show_data_labels: {
          type: 'boolean',
          optional: true
        },

        // ============================================================================
        // THEME SETTINGS
        // ============================================================================

        theme_mode: {
          type: 'string',
          enum: ['dark', 'light'],
          optional: true,
          errorMessage: 'Theme mode must be "dark" or "light"'
        },

        theme_palette: {
          type: 'string',
          enum: ['palette1', 'palette2', 'palette3', 'palette4', 'palette5',
                 'palette6', 'palette7', 'palette8', 'palette9', 'palette10'],
          optional: true,
          errorMessage: 'Theme palette must be palette1-palette10'
        },

        monochrome: {
          type: 'object',
          optional: true,
          properties: {
            enabled: {
              type: 'boolean',
              optional: true
            },
            color: {
              type: 'string',
              format: 'color',
              optional: true
            },
            shade_to: {
              type: 'string',
              enum: ['light', 'dark'],
              optional: true
            },
            shade_intensity: {
              type: 'number',
              min: 0,
              max: 1,
              optional: true
            }
          }
        },

        // ============================================================================
        // DISPLAY OPTIONS
        // ============================================================================

        show_toolbar: {
          type: 'boolean',
          optional: true
        },

        show_tooltip: {
          type: 'boolean',
          optional: true
        },

        tooltip_theme: {
          type: 'string',
          enum: ['dark', 'light'],
          optional: true
        },

        // ============================================================================
        // DATA OPTIONS
        // ============================================================================

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

        // ============================================================================
        // ANIMATION
        // ============================================================================

        animation_preset: {
          type: 'string',
          optional: true,
          errorMessage: 'Animation preset name from pack registry'
        },

        // ============================================================================
        // ADVANCED: Raw ApexCharts options (escape hatch)
        // ============================================================================

        chart_options: {
          type: 'object',
          optional: true,
          errorMessage: 'Chart options must be a valid ApexCharts configuration object (overrides all other settings)'
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