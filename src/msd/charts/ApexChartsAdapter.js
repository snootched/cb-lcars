/**
 * [ApexChartsAdapter] Lightweight translator between MSD DataSource and ApexCharts
 * 📊 Handles format conversion without modifying DataSource architecture
 *
 * Responsibilities:
 * - Convert RollingBuffer format to ApexCharts series format
 * - Support dot notation for enhanced DataSource paths
 * - Map MSD style config to ApexCharts options
 * - Handle multi-series aggregation
 * - Provide exact pixel dimensions for HTML overlay rendering
 *
 * Integration:
 * - Works with ApexChartsOverlayRenderer for HTML div overlay approach
 * - Integrates with MSD DataSourceManager for real-time data
 * - Supports time windowing and data decimation
 *
 * @module ApexChartsAdapter
 * @requires cblcars-logging
 */

import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ApexChartsAdapter {
  /**
   * Valid ApexCharts chart types supported by MSD
   * @constant {string[]}
   */
  static VALID_CHART_TYPES = [
    // Existing types (7)
    'line',
    'area',
    'bar',
    'pie',
    'donut',
    'radar',
    'heatmap',

    // NEW: Additional chart types (8)
    'radialBar',    // Gauges, completion indicators
    'rangeBar',     // Timelines, schedules
    'polarArea',    // Directional data
    'treemap',      // Hierarchical data
    'rangeArea',    // Data ranges/confidence intervals
    'scatter',      // Correlation plots
    'candlestick',  // OHLC data
    'boxPlot'       // Statistical distributions
  ];

  /**
   * Convert MSD DataSource to ApexCharts series format
   * @param {string} sourceRef - DataSource reference (supports dot notation like "temp.transformations.celsius")
   * @param {Object} dataSourceManager - MSD DataSourceManager instance
   * @param {Object} config - Configuration options
   * @returns {Array} ApexCharts series array
   */
  static convertToSeries(sourceRef, dataSourceManager, config = {}) {
    try {
      // Parse dot notation (e.g., "temp.transformations.celsius")
      const { dataSource, dataPath } = this._resolveDataSourcePath(sourceRef, dataSourceManager);

      if (!dataSource) {
        cblcarsLog.warn(`[ApexChartsAdapter] DataSource not found: ${sourceRef}`);
        return [];
      }

      // Get historical data with error boundary
      let data;
      try {
        if (dataPath) {
          data = this._getEnhancedData(dataSource, dataPath, config);
        } else {
          data = this._getRawData(dataSource, config);
        }
      } catch (dataError) {
        cblcarsLog.error(`[ApexChartsAdapter] Error getting data for ${sourceRef}:`, dataError);
        return [];
      }

      if (!data || data.length === 0) {
        cblcarsLog.warn(`[ApexChartsAdapter] No data available for: ${sourceRef}`);
        return [];
      }

      // Convert to ApexCharts format
      const seriesName = config.name || this._extractSeriesName(sourceRef);

      // ✅ NEW: Detect if data contains multi-value arrays (from rolling_statistics)
      // Check first data point to determine if values are arrays
      const hasArrayValues = data.length > 0 && Array.isArray(data[0].value || data[0].v);

      if (hasArrayValues) {
        // ✅ NEW: Handle multi-value array data for rangeArea, candlestick, boxPlot
        const validData = data
          .filter(point => {
            const x = point.timestamp || point.t;
            const y = point.value || point.v;

            // For array values, validate x and that y is an array
            const isValid = (
              x !== undefined &&
              x !== null &&
              !isNaN(Number(x)) &&
              Array.isArray(y) &&
              y.length > 0 &&
              y.every(val => val !== null && val !== undefined && !isNaN(Number(val)) && isFinite(val))
            );

            if (!isValid && config.debug) {
              cblcarsLog.debug(`[ApexChartsAdapter] Filtered invalid multi-value point:`, { x, y, point });
            }

            return isValid;
          })
          .map(point => ({
            x: point.timestamp || point.t,
            y: point.value || point.v  // Keep as array for ApexCharts
          }));

        // ✅ NEW: Log info about multi-value data processing
        if (validData.length > 0 && config.debug) {
          const sampleY = validData[0].y;
          cblcarsLog.debug(`[ApexChartsAdapter] Processing multi-value data for ${seriesName}:`, {
            points: validData.length,
            valuesPerPoint: sampleY.length,
            sample: sampleY
          });
        }

        // ✅ FIXED: Log warning if data was filtered
        if (validData.length < data.length) {
          cblcarsLog.warn(`[ApexChartsAdapter] Filtered ${data.length - validData.length} invalid multi-value points from ${sourceRef}`, {
            original: data.length,
            valid: validData.length
          });
        }

        // ✅ FIXED: Return empty series if no valid data
        if (validData.length === 0) {
          cblcarsLog.warn(`[ApexChartsAdapter] No valid multi-value data points for series ${seriesName} (${sourceRef})`);
          return [{
            name: seriesName,
            data: []
          }];
        }

        return [{
          name: seriesName,
          data: validData
        }];
      }

      // ✅ EXISTING: Handle single-value data (original code path)
      const validData = data
        .filter(point => {
          const x = point.timestamp || point.t;
          const y = point.value || point.v;

          // Strict validation: both x and y must be valid numbers
          const isValid = (
            x !== undefined &&
            x !== null &&
            !isNaN(Number(x)) &&
            y !== undefined &&
            y !== null &&
            !isNaN(Number(y)) &&
            isFinite(y)  // Reject Infinity and -Infinity
          );

          if (!isValid && config.debug) {
            cblcarsLog.debug(`[ApexChartsAdapter] Filtered invalid point:`, { x, y, point });
          }

          return isValid;
        })
        .map(point => ({
          x: point.timestamp || point.t,
          y: point.value || point.v
        }));

      // ✅ FIXED: Log warning if data was filtered
      if (validData.length < data.length) {
        cblcarsLog.warn(`[ApexChartsAdapter] Filtered ${data.length - validData.length} invalid points from ${sourceRef}`, {
          original: data.length,
          valid: validData.length
        });
      }

      // ✅ FIXED: Return empty series if no valid data (prevents ApexCharts errors)
      if (validData.length === 0) {
        cblcarsLog.warn(`[ApexChartsAdapter] No valid data points for series ${seriesName} (${sourceRef})`);
        return [{
          name: seriesName,
          data: []  // Empty array is safe for ApexCharts
        }];
      }

      return [{
        name: seriesName,
        data: validData
      }];

    } catch (error) {
      cblcarsLog.error(`[ApexChartsAdapter] Critical error in convertToSeries for ${sourceRef}:`, error);
      return [];
    }
  }

  /**
   * Convert multiple DataSources to multi-series format
   * @param {Array<string>|string} sourceRefs - Array of DataSource references or single reference
   * @param {Object} dataSourceManager - MSD DataSourceManager instance
   * @param {Object} config - Configuration options
   * @param {Object} [config.seriesNames] - Map of sourceRef to series name
   * @returns {Array} ApexCharts multi-series array
   */
  static convertToMultiSeries(sourceRefs, dataSourceManager, config = {}) {
    if (!Array.isArray(sourceRefs)) {
      return this.convertToSeries(sourceRefs, dataSourceManager, config);
    }

    const allSeries = [];

    sourceRefs.forEach(sourceRef => {
      const series = this.convertToSeries(sourceRef, dataSourceManager, {
        ...config,
        name: config.seriesNames?.[sourceRef] || this._extractSeriesName(sourceRef)
      });

      // ✅ FIXED: Only add series with valid data
      if (series && series.length > 0) {
        // Validate each series has at least some data or is intentionally empty
        const validSeries = series.filter(s => {
          if (!s.data || !Array.isArray(s.data)) {
            cblcarsLog.warn(`[ApexChartsAdapter] Series ${s.name} has invalid data structure`);
            return false;
          }
          return true;  // Keep series even if empty (ApexCharts can handle empty arrays)
        });

        allSeries.push(...validSeries);
      }
    });

    // ✅ FIXED: Ensure at least one series exists (even if empty)
    if (allSeries.length === 0) {
      cblcarsLog.warn(`[ApexChartsAdapter] No valid series data from sources:`, sourceRefs);
      // Return single empty series to prevent ApexCharts initialization errors
      return [{
        name: 'No Data',
        data: []
      }];
    }

    return allSeries;
  }

  /**
   * Generate ApexCharts options from MSD style config
   *
   * ✅ COMPLETE REWRITE (2025-10-24): Full ApexCharts color API support
   * - Supports ALL ApexCharts color properties (series, stroke, fill, markers, etc.)
   * - Resolves CSS variables to actual colors (ApexCharts is canvas-based)
   * - Uses theme tokens for defaults
   * - Maintains backward compatibility with existing configs
   *
   * @param {Object} style - MSD overlay style configuration
   * @param {Array} size - Chart size [width, height]
   * @param {Object} context - Additional context
   * @returns {Object} ApexCharts options
   */
  static generateOptions(style, size, context = {}) {
    // ============================================================================
    // SETUP
    // ============================================================================

    let chartType = style.chart_type || style.type || 'line';

    // Validate chart type
    if (!this.VALID_CHART_TYPES.includes(chartType)) {
      cblcarsLog.warn(`[ApexChartsAdapter] Invalid chart type: ${chartType}, defaulting to 'line'`);
      chartType = 'line';
    }

    // Create component-scoped token resolver
    const resolveToken = themeTokenResolver ? themeTokenResolver.forComponent('chart') : null;

    // Helper: resolve token + CSS variable in one step
    const resolveColor = (styleValue, tokenPath, fallback) => {
      const tokenResolved = this._resolveTokenValue(styleValue, tokenPath, resolveToken, fallback, context);
      return this._resolveCssVariable(tokenResolved);
    };

    // Helper: resolve array of colors
    const resolveColorArray = (styleValue, tokenPath, fallback) => {
      let value = this._resolveTokenValue(styleValue, tokenPath, resolveToken, fallback, context);
      if (typeof value === 'string') {
        value = [value];  // Convert single color to array
      }
      return this._resolveCssVariable(value);
    };

    // ============================================================================
    // SERIES COLORS (Primary data visualization)
    // ============================================================================

    let colors = style.colors || (style.color ? [style.color] : null);
    colors = resolveColorArray(colors, 'defaultColors', null);

    // ============================================================================
    // STROKE/OUTLINE COLORS
    // ============================================================================

    let strokeColors = style.stroke_colors;
    if (!strokeColors && style.stroke_color) {
      strokeColors = [style.stroke_color];
    }
    strokeColors = resolveColorArray(strokeColors, 'defaultStrokeColors', null);

    const strokeWidth = this._resolveTokenValue(
      style.stroke_width,
      'defaultStrokeWidth',
      resolveToken,
      2,
      context
    );

    const curve = style.curve ||
      (resolveToken ? resolveToken('curve', 'smooth', context) : 'smooth');

    // ============================================================================
    // FILL COLORS (for area/bar charts)
    // ============================================================================

    const fillColors = resolveColorArray(style.fill_colors, 'defaultFillColors', null);
    const fillType = style.fill_type ||
      (resolveToken ? resolveToken('defaultFillType', 'solid', context) : 'solid');
    const fillOpacity = style.fill_opacity !== undefined ?
      style.fill_opacity :
      (resolveToken ? resolveToken('defaultFillOpacity', 0.7, context) : 0.7);

    // ============================================================================
    // BACKGROUND & FOREGROUND
    // ============================================================================

    const backgroundColor = resolveColor(
      style.background_color,
      'backgroundColor',
      'transparent'
    );

    const foregroundColor = resolveColor(
      style.foreground_color,
      'foregroundColor',
      'var(--lcars-white, #FFFFFF)'
    );

    // ============================================================================
    // GRID COLORS
    // ============================================================================

    const gridColor = resolveColor(
      style.grid_color,
      'gridColor',
      'var(--lcars-gray, #999999)'
    );

    const gridRowColors = resolveColorArray(
      style.grid_row_colors,
      'gridRowColors',
      null
    );

    const gridColumnColors = resolveColorArray(
      style.grid_column_colors,
      'gridColumnColors',
      null
    );

    const showGrid = style.show_grid !== undefined ?
      style.show_grid :
      (resolveToken ? resolveToken('showGrid', true, context) : true);

    // ============================================================================
    // AXIS COLORS
    // ============================================================================

    // Unified axis color (fallback for both axes)
    const unifiedAxisColor = resolveColor(
      style.axis_color,
      'axisColor',
      foregroundColor
    );

    // X-axis specific
    const xaxisColor = style.xaxis_color ?
      resolveColor(style.xaxis_color, 'xaxisColor', unifiedAxisColor) :
      unifiedAxisColor;

    const xaxisColors = resolveColorArray(
      style.xaxis_colors,
      'xaxisColors',
      null
    );

    // Y-axis specific
    const yaxisColor = style.yaxis_color ?
      resolveColor(style.yaxis_color, 'yaxisColor', unifiedAxisColor) :
      unifiedAxisColor;

    const yaxisColors = resolveColorArray(
      style.yaxis_colors,
      'yaxisColors',
      null
    );

    // Axis border and ticks
    const axisBorderColor = resolveColor(
      style.axis_border_color,
      'axisBorderColor',
      gridColor
    );

    const axisTicksColor = resolveColor(
      style.axis_ticks_color,
      'axisTicksColor',
      gridColor
    );

    // ============================================================================
    // LEGEND COLORS
    // ============================================================================

    const legendColor = resolveColor(
      style.legend_color,
      'legendColor',
      foregroundColor
    );

    const legendColors = resolveColorArray(
      style.legend_colors,
      'legendColors',
      null
    );

    const showLegend = style.show_legend !== undefined ?
      style.show_legend :
      (resolveToken ? resolveToken('showLegend', false, context) : false);

    // ============================================================================
    // MARKER COLORS (data points)
    // ============================================================================

    const markerColors = resolveColorArray(
      style.marker_colors,
      'markerColors',
      colors  // Default to series colors
    );

    const markerStrokeColors = resolveColorArray(
      style.marker_stroke_colors,
      'markerStrokeColors',
      foregroundColor
    );

    const markerStrokeWidth = style.marker_stroke_width !== undefined ?
      style.marker_stroke_width :
      (resolveToken ? resolveToken('markerStrokeWidth', 2, context) : 2);

    // ============================================================================
    // DATA LABEL COLORS
    // ============================================================================

    const dataLabelColors = resolveColorArray(
      style.data_label_colors,
      'dataLabelColors',
      foregroundColor
    );

    const showDataLabels = style.show_data_labels !== undefined ?
      style.show_data_labels :
      (resolveToken ? resolveToken('showDataLabels', false, context) : false);

    // ============================================================================
    // THEME SETTINGS
    // ============================================================================

    const themeMode = style.theme_mode ||
      (resolveToken ? resolveToken('themeMode', 'dark', context) : 'dark');

    const themePalette = style.theme_palette ||
      (resolveToken ? resolveToken('themePalette', null, context) : null);

    // Monochrome settings
    const monochrome = style.monochrome || {};
    const monochromeEnabled = monochrome.enabled !== undefined ? monochrome.enabled :
      (resolveToken ? resolveToken('monochromeEnabled', false, context) : false);
    const monochromeColor = monochrome.color ?
      resolveColor(monochrome.color, 'monochromeColor', colors?.[0]) :
      (resolveToken ? resolveColor(null, 'monochromeColor', colors?.[0]) : colors?.[0]);
    const monochromeShadeTo = monochrome.shade_to ||
      (resolveToken ? resolveToken('monochromeShadeTo', 'dark', context) : 'dark');
    const monochromeIntensity = monochrome.shade_intensity !== undefined ? monochrome.shade_intensity :
      (resolveToken ? resolveToken('monochromeIntensity', 0.65, context) : 0.65);

    // ============================================================================
    // TYPOGRAPHY
    // ============================================================================

    const fontFamily = resolveToken ?
      resolveToken('fontFamily', 'Antonio, Helvetica Neue, sans-serif', context) :
      'Antonio, Helvetica Neue, sans-serif';

    const fontSize = resolveToken ?
      resolveToken('fontSize', 12, context) :
      12;

    // ============================================================================
    // DISPLAY OPTIONS
    // ============================================================================

    const showToolbar = style.show_toolbar !== undefined ?
      style.show_toolbar :
      (resolveToken ? resolveToken('showToolbar', false, context) : false);

    const showTooltip = style.show_tooltip !== undefined ?
      style.show_tooltip :
      (resolveToken ? resolveToken('showTooltip', true, context) : true);

    const tooltipTheme = style.tooltip_theme ||
      (resolveToken ? resolveToken('tooltipTheme', 'dark', context) : 'dark');

    // ============================================================================
    // BUILD APEXCHARTS OPTIONS
    // ============================================================================

    const baseOptions = {
      chart: {
        type: chartType,
        width: size[0],
        height: size[1],
        animations: {
          enabled: true,
          speed: 800,
          animateGradually: {
            enabled: true,
            delay: 150
          },
          dynamicAnimation: {
            enabled: true,
            speed: 350
          }
        },
        toolbar: {
          show: showToolbar
        },
        background: backgroundColor,
        foreColor: foregroundColor,
        fontFamily: fontFamily
      },

      // Series colors
      colors: colors,

      // Stroke (lines/borders)
      stroke: {
        width: strokeWidth,
        curve: curve,
        colors: strokeColors
      },

      // Fill (area/bar charts)
      fill: {
        colors: fillColors,
        type: fillType,
        opacity: fillOpacity
      },

      // Grid
      grid: {
        show: showGrid,
        borderColor: gridColor,
        strokeDashArray: 4,
        opacity: 0.3,
        ...(gridRowColors && { row: { colors: gridRowColors } }),
        ...(gridColumnColors && { column: { colors: gridColumnColors } })
      },

      // X-axis
      xaxis: {
        labels: {
          style: {
            colors: xaxisColors || xaxisColor,
            fontSize: `${fontSize}px`,
            fontFamily: fontFamily
          }
        },
        axisBorder: {
          color: axisBorderColor
        },
        axisTicks: {
          color: axisTicksColor
        }
      },

      // Y-axis
      yaxis: {
        labels: {
          style: {
            colors: yaxisColors || yaxisColor,
            fontSize: `${fontSize}px`,
            fontFamily: fontFamily
          }
        },
        axisBorder: {
          color: axisBorderColor
        },
        axisTicks: {
          color: axisTicksColor
        }
      },

      // Legend
      legend: {
        show: showLegend,
        fontSize: `${fontSize + 2}px`,
        fontFamily: fontFamily,
        labels: {
          colors: legendColors || legendColor
        }
      },

      // Markers (data points)
      markers: {
        colors: markerColors,
        strokeColors: markerStrokeColors,
        strokeWidth: markerStrokeWidth
      },

      // Data labels
      dataLabels: {
        enabled: showDataLabels,
        style: {
          colors: dataLabelColors,
          fontSize: `${fontSize}px`,
          fontFamily: fontFamily
        }
      },

      // Tooltip
      tooltip: {
        enabled: showTooltip,
        theme: tooltipTheme,
        style: {
          fontSize: `${fontSize}px`,
          fontFamily: fontFamily
        }
      },

      // Theme
      theme: {
        mode: themeMode,
        palette: themePalette,
        ...(monochromeEnabled && {
          monochrome: {
            enabled: true,
            color: monochromeColor,
            shadeTo: monochromeShadeTo,
            shadeIntensity: monochromeIntensity
          }
        })
      }
    };

    // ============================================================================
    // APPLY TYPE-SPECIFIC DEFAULTS
    // ============================================================================

    const typeDefaults = this._getChartTypeDefaults(chartType, style);
    const optionsWithTypeDefaults = this._deepMerge(baseOptions, typeDefaults);

    // ============================================================================
    // APPLY ANIMATION PRESET
    // ============================================================================

    if (style.animation_preset) {
      const animationPreset = this._getAnimationPreset(style.animation_preset);
      if (animationPreset) {
        optionsWithTypeDefaults.chart.animations = {
          ...optionsWithTypeDefaults.chart.animations,
          ...animationPreset
        };
        cblcarsLog.debug(`[ApexChartsAdapter] Applied animation preset: ${style.animation_preset}`);
      }
    }

    // ============================================================================
    // LOG WHAT WE GENERATED
    // ============================================================================

    cblcarsLog.debug('[ApexChartsAdapter] Generated ApexCharts options:', {
      chartType,
      seriesColors: colors?.length || 0,
      strokeColors: strokeColors?.length || 0,
      fillColors: fillColors?.length || 0,
      markerColors: markerColors?.length || 0,
      backgroundColor,
      foregroundColor,
      gridColor,
      themeMode,
      themePalette,
      monochromeEnabled,
      cssVariablesResolved: true
    });

    // ============================================================================
    // APPLY CHART_OPTIONS OVERRIDES (Highest precedence)
    // ============================================================================

    let finalOptions = optionsWithTypeDefaults;

    if (style.chart_options) {
      finalOptions = this._deepMerge(optionsWithTypeDefaults, style.chart_options);
      cblcarsLog.debug('[ApexChartsAdapter] Applied chart_options overrides');
    }

    // ============================================================================
    // FINAL CSS VARIABLE RESOLUTION PASS
    // ============================================================================
    // Recursively resolve ANY remaining CSS variables in the entire options tree
    // This catches:
    // - Variables from theme defaults
    // - Variables from style.chart_options overrides
    // - Variables that slipped through earlier resolution
    //
    // CRITICAL: ApexCharts is canvas-based and doesn't understand CSS variables
    cblcarsLog.debug('[ApexChartsAdapter] 🔍 Starting final CSS variable resolution pass');
    finalOptions = this._resolveAllCssVariables(finalOptions);
    cblcarsLog.debug('[ApexChartsAdapter] ✅ Final CSS variable resolution complete');

    return finalOptions;
  }

  /**
   * Get animation preset from pack registry
   * @private
   * @param {string} presetName - Animation preset name
   * @returns {Object|null} Animation configuration or null
   */
  static _getAnimationPreset(presetName) {
    try {
      // Access pack registry via global debug object
      const packRegistry = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.packRegistry;

      if (!packRegistry) {
        cblcarsLog.warn('[ApexChartsAdapter] PackRegistry not available for animation presets');
        return null;
      }

      // Check all packs for animation presets
      const packs = packRegistry.getAllPacks();
      for (const pack of packs) {
        if (pack.chartAnimationPresets && pack.chartAnimationPresets[presetName]) {
          cblcarsLog.debug(`[ApexChartsAdapter] Found animation preset '${presetName}' in pack: ${pack.id}`);
          return pack.chartAnimationPresets[presetName];
        }
      }

      cblcarsLog.warn(`[ApexChartsAdapter] Animation preset not found: ${presetName}`);
      return null;

    } catch (error) {
      cblcarsLog.error('[ApexChartsAdapter] Error loading animation preset:', error);
      return null;
    }
  }

  /**
   * Get LCARS-optimized defaults for specific chart type
   * @private
   * @param {string} chartType - Chart type
   * @param {Object} style - MSD style configuration
   * @returns {Object} ApexCharts options specific to chart type
   */
  static _getChartTypeDefaults(chartType, style) {
    const resolveToken = (tokenPath, fallback) => {
      try {
        return themeTokenResolver?.resolve(tokenPath) || fallback;
      } catch {
        return fallback;
      }
    };

    switch (chartType) {
      case 'radialBar':
        return {
          plotOptions: {
            radialBar: {
              hollow: {
                size: '65%',
                background: 'transparent'
              },
              track: {
                background: resolveToken('colors.ui.disabled', 'var(--lcars-gray, #999999)'),
                strokeWidth: '100%',
                opacity: 0.3
              },
              dataLabels: {
                name: {
                  show: true,
                  fontSize: resolveToken('typography.fontSize.sm', '12px'),
                  fontFamily: resolveToken('typography.fontFamily.primary', 'Antonio, Helvetica Neue, sans-serif'),
                  color: resolveToken('colors.ui.foreground', 'var(--lcars-white, #FFFFFF)'),
                  offsetY: -10
                },
                value: {
                  show: true,
                  fontSize: resolveToken('typography.fontSize.2xl', '24px'),
                  fontFamily: resolveToken('typography.fontFamily.primary', 'Antonio, Helvetica Neue, sans-serif'),
                  color: resolveToken('colors.accent.primary', 'var(--lcars-orange, #FF9900)'),
                  offsetY: 5,
                  formatter: (val) => {
                    return style.value_format === 'percent' ? `${Math.round(val)}%` : val;
                  }
                },
                total: {
                  show: true,
                  label: 'TOTAL',
                  fontSize: resolveToken('typography.fontSize.sm', '12px'),
                  fontFamily: resolveToken('typography.fontFamily.primary', 'Antonio, Helvetica Neue, sans-serif'),
                  color: resolveToken('colors.ui.foreground', 'var(--lcars-white, #FFFFFF)'),
                  formatter: (w) => {
                    const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                    return style.value_format === 'percent' ? `${Math.round(total)}%` : total;
                  }
                }
              },
              startAngle: style.gauge_start_angle || -90,
              endAngle: style.gauge_end_angle || 90
            }
          }
        };

      case 'rangeBar':
        return {
          plotOptions: {
            bar: {
              horizontal: true,
              barHeight: '70%',
              rangeBarOverlap: false,
              rangeBarGroupRows: style.group_rows !== false
            }
          },
          xaxis: {
            type: 'datetime',
            labels: {
              datetimeUTC: false,
              style: {
                colors: resolveToken('colors.ui.foreground', 'var(--lcars-white, #FFFFFF)'),
                fontSize: resolveToken('typography.fontSize.xs', '10px'),
                fontFamily: resolveToken('typography.fontFamily.primary', 'Antonio, Helvetica Neue, sans-serif')
              }
            }
          },
          yaxis: {
            labels: {
              style: {
                colors: resolveToken('colors.ui.foreground', 'var(--lcars-white, #FFFFFF)'),
                fontSize: resolveToken('typography.fontSize.xs', '10px'),
                fontFamily: resolveToken('typography.fontFamily.primary', 'Antonio, Helvetica Neue, sans-serif')
              }
            }
          },
          dataLabels: {
            enabled: style.show_labels !== false,
            style: {
              fontSize: resolveToken('typography.fontSize.xs', '10px'),
              fontFamily: resolveToken('typography.fontFamily.primary', 'Antonio, Helvetica Neue, sans-serif')
            }
          }
        };

      case 'polarArea':
        return {
          plotOptions: {
            polarArea: {
              rings: {
                strokeWidth: 1,
                strokeColor: resolveToken('colors.ui.border', 'var(--lcars-gray, #999999)')
              },
              spokes: {
                strokeWidth: 1,
                connectorColors: resolveToken('colors.ui.border', 'var(--lcars-gray, #999999)')
              }
            }
          },
          stroke: {
            width: 2,
            colors: [resolveToken('colors.ui.background', 'var(--lcars-black, #000000)')]
          },
          fill: {
            opacity: 0.8
          },
          legend: {
            position: style.legend_position || 'bottom',
            fontSize: resolveToken('typography.fontSize.sm', '12px'),
            fontFamily: resolveToken('typography.fontFamily.primary', 'Antonio, Helvetica Neue, sans-serif'),
            labels: {
              colors: resolveToken('colors.ui.foreground', 'var(--lcars-white, #FFFFFF)')
            }
          }
        };

      case 'treemap':
        return {
          plotOptions: {
            treemap: {
              enableShades: true,
              shadeIntensity: 0.5,
              distributed: true,
              colorScale: {
                ranges: [
                  {
                    from: 0,
                    to: 25,
                    color: resolveToken('colors.chart.series1', 'var(--lcars-blue, #9999FF)')
                  },
                  {
                    from: 25,
                    to: 50,
                    color: resolveToken('colors.status.success', 'var(--lcars-green, #99CC99)')
                  },
                  {
                    from: 50,
                    to: 75,
                    color: resolveToken('colors.status.warning', 'var(--lcars-orange, #FF9900)')
                  },
                  {
                    from: 75,
                    to: 100,
                    color: resolveToken('colors.status.danger', 'var(--lcars-red, #CC6666)')
                  }
                ]
              }
            }
          },
          dataLabels: {
            enabled: true,
            style: {
              fontSize: resolveToken('typography.fontSize.sm', '12px'),
              fontFamily: resolveToken('typography.fontFamily.primary', 'Antonio, Helvetica Neue, sans-serif'),
              fontWeight: 'bold'
            },
            offsetY: -4
          }
        };

      case 'rangeArea':
        return {
          stroke: {
            curve: 'straight',
            width: [0, 2, 2, 0], // Outer lines invisible, inner lines visible
            colors: [
              'transparent',
              resolveToken('colors.accent.primary', 'var(--lcars-orange, #FF9900)'),
              resolveToken('colors.accent.primary', 'var(--lcars-orange, #FF9900)'),
              'transparent'
            ]
          },
          fill: {
            type: 'solid',
            opacity: 0.2
          },
          markers: {
            size: 0
          },
          legend: {
            show: true,
            position: style.legend_position || 'top',
            fontSize: resolveToken('typography.fontSize.sm', '12px'),
            fontFamily: resolveToken('typography.fontFamily.primary', 'Antonio, Helvetica Neue, sans-serif'),
            labels: {
              colors: resolveToken('colors.ui.foreground', 'var(--lcars-white, #FFFFFF)')
            }
          }
        };

      case 'scatter':
        return {
          markers: {
            size: style.marker_size || 6,
            strokeWidth: 0,
            hover: {
              sizeOffset: 3
            }
          },
          grid: {
            borderColor: resolveToken('colors.ui.border', 'var(--lcars-gray, #999999)'),
            strokeDashArray: 4,
            xaxis: {
              lines: { show: style.show_grid !== false }
            },
            yaxis: {
              lines: { show: style.show_grid !== false }
            }
          },
          dataLabels: {
            enabled: false // Usually too cluttered for scatter
          },
          legend: {
            position: style.legend_position || 'top',
            fontSize: resolveToken('typography.fontSize.sm', '12px'),
            fontFamily: resolveToken('typography.fontFamily.primary', 'Antonio, Helvetica Neue, sans-serif'),
            labels: {
              colors: resolveToken('colors.ui.foreground', 'var(--lcars-white, #FFFFFF)')
            }
          }
        };

      case 'candlestick':
        return {
          plotOptions: {
            candlestick: {
              colors: {
                upward: resolveToken('colors.status.success', 'var(--lcars-green, #99CC99)'),
                downward: resolveToken('colors.status.danger', 'var(--lcars-red, #CC6666)')
              },
              wick: {
                useFillColor: true
              }
            }
          },
          xaxis: {
            type: 'datetime',
            labels: {
              datetimeUTC: false,
              style: {
                colors: resolveToken('colors.ui.foreground', 'var(--lcars-white, #FFFFFF)'),
                fontSize: resolveToken('typography.fontSize.xs', '10px'),
                fontFamily: resolveToken('typography.fontFamily.primary', 'Antonio, Helvetica Neue, sans-serif')
              }
            }
          }
        };

      case 'boxPlot':
        return {
          plotOptions: {
            boxPlot: {
              colors: {
                upper: style.color || resolveToken('colors.accent.primary', 'var(--lcars-blue, #9999FF)'),
                lower: style.color || resolveToken('colors.accent.primary', 'var(--lcars-blue, #9999FF)')
              }
            }
          },
          stroke: {
            width: 2,
            colors: [resolveToken('colors.ui.foreground', 'var(--lcars-white, #FFFFFF)')]
          }
        };

      default:
        return {};
    }
  }

  /**
   * Deep merge two objects (helper method)
   * Recursively merges source into target, with source taking precedence
   * @private
   * @param {Object} target - Target object
   * @param {Object} source - Source object (takes precedence)
   * @returns {Object} Merged object
   */
  static _deepMerge(target, source) {
    if (!this._isObject(target) || !this._isObject(source)) {
      return source;
    }

    const output = { ...target };

    Object.keys(source).forEach(key => {
      if (this._isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = this._deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });

    return output;
  }

  /**
   * Check if value is a plain object
   * @private
   * @param {*} item - Value to check
   * @returns {boolean} True if plain object
   */
  static _isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Resolve a token value with fallback
   * @private
   */
  static _resolveTokenValue(styleValue, tokenPath, resolveToken, fallback, context) {
    if (styleValue !== undefined && styleValue !== null) {
      if (resolveToken && typeof styleValue === 'string' && this._isTokenReference(styleValue)) {
        return resolveToken(styleValue, fallback, context);
      }
      return styleValue;
    }

    if (resolveToken) {
      return resolveToken(tokenPath, fallback, context);
    }

    return fallback;
  }

  /**
   * Check if value is a token reference
   * @private
   */
  static _isTokenReference(value) {
    if (typeof value !== 'string') return false;
    const tokenCategories = ['colors', 'typography', 'spacing', 'borders', 'effects', 'animations', 'components'];
    return tokenCategories.some(category => value.startsWith(`${category}.`));
  }

  /**
   * Resolve CSS variable to computed value
   *
   * ApexCharts is a CANVAS library and doesn't understand CSS variables.
   * We must resolve them to actual hex/rgb values before passing to ApexCharts.
   *
   * @private
   * @param {string|Array} colorValue - Color value or array of color values
   * @returns {string|Array} Resolved color value(s)
   */
  static _resolveCssVariable(colorValue) {
    // Handle arrays recursively
    if (Array.isArray(colorValue)) {
      return colorValue.map(c => this._resolveCssVariable(c));
    }

    // Non-string or falsy values pass through
    if (!colorValue || typeof colorValue !== 'string') {
      return colorValue;
    }

    // Check if it's a CSS variable
    if (colorValue.startsWith('var(')) {
      try {
        // Extract variable name from var(--variable-name, fallback)
        const match = colorValue.match(/var\((--[^,)]+)(?:,\s*([^)]+))?\)/);
        if (!match) return colorValue;

        const varName = match[1];
        const fallback = match[2] ? match[2].trim() : null;

        // Get computed style from document root
        const root = document.documentElement;
        const computed = getComputedStyle(root).getPropertyValue(varName).trim();

        if (computed) {
          cblcarsLog.trace(`[ApexChartsAdapter] ✅ Resolved CSS variable: ${colorValue} → ${computed}`);
          return computed;
        }

        // No computed value, try fallback
        if (fallback) {
          // Fallback might also be a CSS variable, recurse
          if (fallback.startsWith('var(')) {
            return this._resolveCssVariable(fallback);
          }
          cblcarsLog.trace(`[ApexChartsAdapter] ⚠️ Using fallback: ${colorValue} → ${fallback}`);
          return fallback;
        }

        cblcarsLog.warn(`[ApexChartsAdapter] ❌ Failed to resolve CSS variable: ${colorValue} (no computed value or fallback)`);
        return colorValue;  // Return original if can't resolve

      } catch (error) {
        cblcarsLog.error(`[ApexChartsAdapter] ❌ Error resolving CSS variable: ${colorValue}`, error);
        return colorValue;
      }
    }

    // Not a CSS variable, return as-is
    return colorValue;
  }

  /**
   * Recursively resolve ALL CSS variables in an object tree
   * This is the FINAL pass that ensures ApexCharts never receives CSS variables
   *
   * @private
   * @param {any} obj - Object to process (can be object, array, string, etc.)
   * @returns {any} Object with all CSS variables resolved
   */
  static _resolveAllCssVariables(obj) {
    // Handle null/undefined
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle arrays - recursively process each element
    if (Array.isArray(obj)) {
      return obj.map(item => this._resolveAllCssVariables(item));
    }

    // Handle objects - recursively process each property
    if (typeof obj === 'object') {
      const resolved = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this._resolveAllCssVariables(value);
      }
      return resolved;
    }

    // Handle strings - resolve if CSS variable
    if (typeof obj === 'string') {
      const original = obj;
      const resolved = this._resolveCssVariable(obj);
      if (original !== resolved) {
        cblcarsLog.debug(`[ApexChartsAdapter] 🎨 Resolved CSS variable: ${original} → ${resolved}`);
      }
      return resolved;
    }

    // All other types pass through unchanged
    return obj;
  }

  /**
   * Resolve DataSource path with dot notation support
   * @private
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
 * Get raw DataSource buffer data with strict validation
 * @private
 */
static _getRawData(dataSource, config) {
  const currentData = dataSource.getCurrentData();
  if (!currentData?.buffer) return [];

  const bufferData = currentData.buffer.getAll();
  if (!Array.isArray(bufferData) || bufferData.length === 0) return [];

  // Apply time window filter if specified
  let filteredData = bufferData;
  if (config.time_window) {
    const timeWindowMs = this._parseTimeWindow(config.time_window);
    const cutoffTime = Date.now() - timeWindowMs;
    filteredData = bufferData.filter(point => {
      const timestamp = point?.t;
      return timestamp && timestamp >= cutoffTime;
    });
  }

  // Apply max points limit if specified (data decimation)
  if (config.max_points && filteredData.length > config.max_points) {
    const step = Math.floor(filteredData.length / config.max_points);
    const decimated = [];
    for (let i = 0; i < filteredData.length; i += step) {
      decimated.push(filteredData[i]);
    }
    // Always include last point
    if (decimated[decimated.length - 1] !== filteredData[filteredData.length - 1]) {
      decimated.push(filteredData[filteredData.length - 1]);
    }
    filteredData = decimated;
  }

  // ✅ CRITICAL: Filter out invalid points BEFORE conversion
  return filteredData
    .filter(point => {
      if (!point) return false;
      const t = point.t;
      const v = point.v;
      return (
        t !== undefined &&
        t !== null &&
        !isNaN(Number(t)) &&
        v !== undefined &&
        v !== null &&
        !isNaN(Number(v)) &&
        isFinite(v)
      );
    })
    .map(point => ({
      timestamp: point.t,
      value: point.v
    }));
}

  /**
   * Get enhanced DataSource data (transformation/aggregation)
   * @private
   */
  static _getEnhancedData(dataSource, dataPath, config) {
    // For transformations, get transformed history buffer
    if (dataPath.startsWith('transformations.')) {
      const transformKey = dataPath.replace('transformations.', '');

      try {
        const history = dataSource.getTransformedHistory(transformKey, config.max_points || 500);

        if (!history || history.length === 0) {
          cblcarsLog.warn(`[ApexChartsAdapter] No transformed history for ${dataPath}`);
          return [];
        }

        // Apply time window filter if specified
        let filteredHistory = history;
        if (config.time_window) {
          const timeWindowMs = this._parseTimeWindow(config.time_window);
          const cutoffTime = Date.now() - timeWindowMs;
          filteredHistory = history.filter(point => {
            const ts = point.timestamp || point.t;
            return ts >= cutoffTime;
          });
        }

        return filteredHistory.map(point => ({
          timestamp: point.timestamp || point.t,
          value: point.value || point.v
        }));
      } catch (error) {
        cblcarsLog.error(`[ApexChartsAdapter] Error getting transformed history:`, error);
        return [];
      }
    }

    // For aggregations, create synthetic time series from current values
    if (dataPath.startsWith('aggregations.')) {
      const currentData = dataSource.getCurrentData();
      const aggParts = dataPath.replace('aggregations.', '').split('.');

      let value = currentData.aggregations;
      for (const part of aggParts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          value = null;
          break;
        }
      }

      if (value === null || value === undefined) {
        return [];
      }

      // ✅ NEW: Handle array values from rolling_statistics aggregations
      // rolling_statistics can output arrays like [min, max] or [open, high, low, close]
      if (Array.isArray(value)) {
        return [{
          timestamp: Date.now(),
          value: value  // Keep as array for multi-value charts
        }];
      }

      // ✅ EXISTING: Handle single numeric values
      return [{
        timestamp: Date.now(),
        value: typeof value === 'number' ? value : 0
      }];
    }

    return [];
  }

  /**
   * Map MSD smoothing mode to ApexCharts curve type
   * @private
   * @param {string} smoothingMode - MSD smoothing mode
   * @returns {string} ApexCharts curve type
   */
  static _mapSmoothingMode(smoothingMode) {
    const mapping = {
      'none': 'straight',
      'linear': 'straight',
      'constrained': 'smooth',
      'bezier': 'smooth',
      'spline': 'smooth',
      'chaikin': 'smooth',
      'stepped': 'stepline'
    };

    return mapping[smoothingMode] || 'straight';
  }

  /**
   * Map MSD gradient config to ApexCharts gradient format
   * @private
   * @param {Object} gradient - MSD gradient configuration
   * @returns {Object} ApexCharts gradient object
   */
  static _mapGradient(gradient) {
    if (!gradient) return undefined;

    return {
      shade: 'dark',
      type: gradient.type === 'radial' ? 'vertical' : 'vertical',
      shadeIntensity: 0.5,
      gradientToColors: gradient.stops ?
        gradient.stops.map(stop => stop.color) :
        undefined,
      inverseColors: false,
      opacityFrom: gradient.stops?.[0]?.opacity || 0.8,
      opacityTo: gradient.stops?.[gradient.stops.length - 1]?.opacity || 0.1,
      stops: gradient.stops ?
        gradient.stops.map(stop => parseInt(stop.offset)) :
        [0, 100]
    };
  }

  /**
   * Build annotations (threshold lines) from style config
   * @private
   * @param {Object} style - MSD style configuration
   * @returns {Object} ApexCharts annotations object
   */
  static _buildAnnotations(style) {
    const annotations = {
      yaxis: [],
      xaxis: [],
      points: []
    };

    // Zero line
    if (style.zero_line) {
      annotations.yaxis.push({
        y: 0,
        borderColor: style.zero_line_color || 'var(--lcars-gray)',
        strokeDashArray: 2,
        opacity: 0.5,
        label: {
          text: 'Zero',
          style: {
            color: '#fff',
            background: style.zero_line_color || 'var(--lcars-gray)'
          }
        }
      });
    }

    // Threshold lines
    if (style.thresholds && Array.isArray(style.thresholds)) {
      style.thresholds.forEach(threshold => {
        annotations.yaxis.push({
          y: threshold.value,
          borderColor: threshold.color || 'var(--lcars-red)',
          strokeDashArray: threshold.dash ? 4 : 0,
          opacity: threshold.opacity || 0.7,
          borderWidth: threshold.width || 2,
          label: threshold.label ? {
            text: threshold.label,
            style: {
              color: '#fff',
              background: threshold.color || 'var(--lcars-red)',
              fontSize: '10px',
              fontFamily: 'var(--lcars-font-family, Antonio)'
            },
            position: 'right',
            offsetX: 0,
            offsetY: -5
          } : undefined
        });
      });
    }

    return annotations;
  }

  /**
   * Parse time window string to milliseconds
   * @private
   * @param {string|number} timeWindow - Time window specification (e.g., "12h", "24h", "30m")
   * @returns {number} Time window in milliseconds
   */
  static _parseTimeWindow(timeWindow) {
    if (typeof timeWindow === 'number') return timeWindow;
    if (!timeWindow || typeof timeWindow !== 'string') return 0;

    const match = timeWindow.match(/^(\d+(?:\.\d+)?)\s*([smhd])$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * (multipliers[match[2].toLowerCase()] || 0);
  }

  /**
   * Format value for display
   * @private
   * @param {number} value - Numeric value
   * @param {string|Function} format - Format specification
   * @returns {string} Formatted value
   */
  static _formatValue(value, format) {
    if (typeof format === 'function') {
      return format(value);
    }

    if (typeof format === 'string') {
      // Simple template replacement
      return format.replace('{value}', value.toFixed(1));
    }

    return value.toFixed(1);
  }

  /**
   * Extract series name from source reference
   * @private
   * @param {string} sourceRef - DataSource reference
   * @returns {string} Human-readable series name
   */
  static _extractSeriesName(sourceRef) {
    if (!sourceRef) return 'Series';

    // For dot notation, use the last part as name
    if (sourceRef.includes('.')) {
      const parts = sourceRef.split('.');
      return parts[parts.length - 1]
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    }

    return sourceRef
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}