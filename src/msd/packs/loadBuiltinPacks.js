import { lcarsClassicTokens } from '../themes/tokens/lcarsClassicTokens.js';
import { lcarsDs9Tokens } from '../themes/tokens/lcarsDs9Tokens.js';
import { lcarsVoyagerTokens } from '../themes/tokens/lcarsVoyagerTokens.js';
import { lcarsHighContrastTokens } from '../themes/tokens/lcarsHighContrastTokens.js';

// Core builtin pack - Contains all system defaults
const CORE_PACK = {
  id: 'core',
  version: '1.0.0',
  animations: [],
  timelines: [],
  rules: [],
  overlays: [],
  anchors: {},
  routing: {}
};

// New sample builtin pack (Phase A) – expand later with real defaults.
const LCARS_FX_PACK = {
  id: 'lcars_fx',
  version: '1.0.0',
  animations: [
    {
      id: 'pulse_soft',
      preset: 'pulse',
      params: { duration: 1800, loop: true, alternate: true, max_scale: 1.07 }
    }
  ],
  timelines: [],
  rules: [],
  overlays: [],
  anchors: {},
  routing: {}
};

// CB-LCARS Button Styles Pack (Phase 2) - Complete button presets for status grids
const CB_LCARS_BUTTONS_PACK = {
  id: 'cb_lcars_buttons',
  version: '1.0.0',
  description: 'CB-LCARS button styles for status grids - recreates custom-button-card appearances',
  animations: [],
  timelines: [],
  rules: [],
  // OVERLAYS: Complete overlay definitions (not style templates)
  overlays: [],
  // STYLE PRESETS: Named style bundles that can be applied to any overlay type
  style_presets: {
    status_grid: {
      lozenge: {
        // Layout & Positioning (lcars_text_preset takes precedence)
        text_layout: 'diagonal',           // ⚠️ Parsed but not used yet
        label_position: 'top-left',        // ✅ Works (fallback if no lcars_text_preset)
        value_position: 'bottom-right',    // ✅ Works (fallback if no lcars_text_preset)
        lcars_text_preset: 'lozenge',      // ✅ Works (overrides positions above)

        // Cell Appearance
        cell_radius: 34,                   // ✅ Works
        cell_color: 'var(--lcars-card-button)',    // ✅ Works
        cell_gap: 8,                       // ✅ Works
        normalize_radius: false,            // ✅ Works
        lcars_corners: false,              // ✅ Works

        // Text Styling
        text_padding: 14,                  // ✅ Works (smart padding)
        text_margin: 3,                    // ✅ Works
        label_font_size: 18,               // ✅ Works
        value_font_size: 18,               // ✅ Works
        label_color: 'black',              // ✅ Works
        value_color: 'black',              // ✅ Works
        font_family: 'Antonio',            // ✅ Works
        font_weight: 'bold',               // ✅ Works

        // Visibility
        show_labels: true,                 // ✅ Works
        show_values: true,                 // ✅ Works

        // Border & Effects
        border_width: 0,                   // ✅ Works
        border_color: 'var(--lcars-gray)', // ✅ Works
        cell_opacity: 0.9                 // ✅ Works
      },
      bullet: {
        text_layout: 'side-by-side',
        label_position: 'left',
        value_position: 'right',
        cell_radius: 38,
        text_padding: 8,
        normalize_radius: true,
        show_labels: true,
        show_values: true,
        lcars_text_preset: 'bullet'
      },
      'picard-filled': {
        text_layout: 'stacked',
        label_position: 'south-east',
        value_position: 'south-east',
        cell_radius: 0,
        text_padding: 12,
        lcars_corners: true,
        normalize_radius: false,
        show_labels: true,
        show_values: true,
        lcars_text_preset: 'corner'
      },
      badge: {
        text_layout: 'stacked',
        label_position: 'center-top',
        value_position: 'center',
        cell_radius: 16,
        text_padding: 8,
        normalize_radius: true,
        show_labels: true,
        show_values: true,
        lcars_text_preset: 'badge'
      },
      compact: {
        text_layout: 'stacked',
        label_position: 'center-top',
        value_position: 'center-bottom',
        cell_radius: 4,
        text_padding: 6,
        text_margin: 1,
        cell_gap: 1,
        label_font_size: 14,
        value_font_size: 12,
        show_labels: true,
        show_values: true
      }
    }
  },

  anchors: {},
  routing: {}
};

// ✅ ADD: Builtin pack with themes (this is what was missing!)
const BUILTIN_THEMES_PACK = {
  id: 'builtin_themes',
  version: '1.0.0',

  // Token-based themes
  themes: {
    'lcars-classic': {
      id: 'lcars-classic',
      name: 'LCARS Classic',
      description: 'Classic TNG-era LCARS styling',
      tokens: lcarsClassicTokens
      // cssFile: 'apexcharts-lcars-classic.css' // TODO: Create ApexCharts CSS overrides
    },

    'lcars-ds9': {
      id: 'lcars-ds9',
      name: 'LCARS DS9',
      description: 'Deep Space Nine LCARS variant',
      tokens: lcarsDs9Tokens
      // cssFile: 'apexcharts-lcars-ds9.css' // TODO: Create ApexCharts CSS overrides
    },

    'lcars-voyager': {
      id: 'lcars-voyager',
      name: 'LCARS Voyager',
      description: 'Voyager LCARS styling',
      tokens: lcarsVoyagerTokens
      // cssFile: 'apexcharts-lcars-voyager.css' // TODO: Create ApexCharts CSS overrides
    },

    'lcars-high-contrast': {
      id: 'lcars-high-contrast',
      name: 'LCARS High Contrast',
      description: 'Accessibility-focused high contrast theme',
      tokens: lcarsHighContrastTokens
      // cssFile: 'apexcharts-lcars-high-contrast.css' // TODO: Create ApexCharts CSS overrides
    }
  },

  // Default theme
  defaultTheme: 'lcars-classic',

  /**
   * Chart Animation Presets
   *
   * Pre-configured animation profiles for ApexCharts.
   * Uses native ApexCharts animation system (no Anime.js integration yet).
   */
  chartAnimationPresets: {
    /**
     * LCARS Standard - Smooth and professional
     * Use: Default for most charts
     */
    lcars_standard: {
      enabled: true,
      easing: 'easeinout',
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

    /**
     * LCARS Dramatic - Cinematic entrance
     * Use: Important reveals, status changes, alerts
     */
    lcars_dramatic: {
      enabled: true,
      easing: 'easeout',
      speed: 1200,
      animateGradually: {
        enabled: true,
        delay: 200
      },
      dynamicAnimation: {
        enabled: true,
        speed: 500
      }
    },

    /**
     * LCARS Minimal - Quick and responsive
     * Use: Secondary displays, less critical data
     */
    lcars_minimal: {
      enabled: true,
      easing: 'easein',
      speed: 400,
      animateGradually: {
        enabled: false
      },
      dynamicAnimation: {
        enabled: true,
        speed: 200
      }
    },

    /**
     * LCARS Realtime - Optimized for high-frequency updates
     * Use: Live sensor feeds, network traffic, system monitors
     */
    lcars_realtime: {
      enabled: false,  // No entrance animation
      easing: 'linear',
      speed: 0,
      animateGradually: {
        enabled: false
      },
      dynamicAnimation: {
        enabled: true,
        speed: 100  // Very fast data updates
      }
    },

    /**
     * LCARS Alert - Attention-grabbing
     * Use: Critical alerts, warnings, emergency displays
     */
    lcars_alert: {
      enabled: true,
      easing: 'easeout',
      speed: 600,
      animateGradually: {
        enabled: true,
        delay: 100
      },
      dynamicAnimation: {
        enabled: true,
        speed: 250
      }
    },

    /**
     * None - Disable all animations
     * Use: Performance-critical situations, accessibility needs
     */
    none: {
      enabled: false,
      easing: 'linear',
      speed: 0,
      animateGradually: {
        enabled: false
      },
      dynamicAnimation: {
        enabled: false
      }
    }
  },

  /**
   * Chart Templates
   *
   * Reusable chart configurations that can be referenced in overlay configs.
   * Templates support:
   * - Token references (resolved by ApexChartsAdapter)
   * - Inheritance via 'extends' property
   * - Override by user overlay configuration
   */
  chartTemplates: {
    // ============================================
    // BASIC TEMPLATES (Most Common - 6 templates)
    // ============================================

    /**
     * Sensor Monitor - Line chart for sensor data
     * Use: Temperature, pressure, humidity, any time-series sensor
     */
    sensor_monitor: {
      style: {
        chart_type: 'line',
        stroke_width: 3,
        smoothing_mode: 'smooth',
        show_grid: true,
        show_tooltip: true,
        time_window: '1h',
        max_points: 500,
        chart_options: {
          stroke: {
            curve: 'smooth',
            width: 3,
            lineCap: 'round',
            colors: ['colors.accent.primary']
          },
          markers: {
            size: 0,
            hover: { size: 5 }
          },
          grid: {
            borderColor: 'colors.ui.border',
            strokeDashArray: 4,
            opacity: 0.3
          },
          tooltip: {
            enabled: true,
            shared: true,
            intersect: false
          },
          dataLabels: {
            enabled: false
          }
        }
      }
    },

    /**
     * Power Monitor - Area chart for power/resource tracking
     * Use: Power consumption, resource usage, bandwidth
     */
    power_monitor: {
      style: {
        chart_type: 'area',
        stroke_width: 2,
        fill_opacity: 0.3,
        show_grid: true,
        show_tooltip: true,
        zero_line: true,
        time_window: '24h',
        max_points: 600,
        chart_options: {
          stroke: {
            curve: 'smooth',
            width: 2,
            colors: ['colors.status.warning']
          },
          fill: {
            type: 'gradient',
            gradient: {
              shade: 'dark',
              shadeIntensity: 0.4,
              opacityFrom: 0.5,
              opacityTo: 0.1,
              stops: [0, 100]
            }
          },
          dataLabels: {
            enabled: false
          },
          grid: {
            borderColor: 'colors.ui.border',
            strokeDashArray: 4,
            opacity: 0.3
          }
        }
      }
    },

    /**
     * Comparison Bar - Horizontal bar chart for comparisons
     * Use: System status, resource allocation, team performance
     */
    comparison_bar: {
      style: {
        chart_type: 'bar',
        show_labels: true,
        show_grid: true,
        chart_options: {
          plotOptions: {
            bar: {
              horizontal: true,
              borderRadius: 4,
              barHeight: '70%',
              distributed: false
            }
          },
          dataLabels: {
            enabled: true,
            style: {
              fontSize: 'typography.fontSize.sm',
              fontFamily: 'typography.fontFamily.primary',
              colors: ['colors.ui.foreground']
            }
          },
          grid: {
            borderColor: 'colors.ui.border',
            strokeDashArray: 4,
            opacity: 0.3,
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: false } }
          }
        }
      }
    },

    /**
     * Distribution Donut - Donut chart for part-to-whole relationships
     * Use: Power distribution, resource allocation, crew assignments
     */
    distribution_donut: {
      style: {
        chart_type: 'donut',
        show_legend: true,
        legend_position: 'bottom',
        chart_options: {
          plotOptions: {
            pie: {
              donut: {
                size: '70%',
                labels: {
                  show: true,
                  name: {
                    show: true,
                    fontSize: 'typography.fontSize.base',
                    fontFamily: 'typography.fontFamily.primary',
                    color: 'colors.ui.foreground'
                  },
                  value: {
                    show: true,
                    fontSize: 'typography.fontSize.2xl',
                    fontFamily: 'typography.fontFamily.primary',
                    color: 'colors.accent.primary'
                  },
                  total: {
                    show: true,
                    label: 'TOTAL',
                    fontSize: 'typography.fontSize.base',
                    fontFamily: 'typography.fontFamily.primary',
                    color: 'colors.ui.foreground'
                  }
                }
              }
            }
          },
          legend: {
            position: 'bottom',
            fontSize: 'typography.fontSize.sm',
            fontFamily: 'typography.fontFamily.primary',
            labels: {
              colors: 'colors.ui.foreground'
            }
          },
          dataLabels: {
            enabled: false
          }
        }
      }
    },

    /**
     * Radar Analysis - Radar chart for multi-dimensional comparisons
     * Use: System diagnostics, performance metrics, crew evaluations
     */
    radar_analysis: {
      style: {
        chart_type: 'radar',
        show_legend: true,
        legend_position: 'bottom',
        chart_options: {
          plotOptions: {
            radar: {
              size: 140,
              polygons: {
                strokeWidth: 1,
                strokeColors: 'colors.ui.border',
                fill: {
                  colors: ['transparent']
                }
              }
            }
          },
          markers: {
            size: 4,
            hover: { size: 6 }
          },
          stroke: {
            width: 2,
            colors: ['colors.accent.primary', 'colors.accent.secondary']
          },
          fill: {
            opacity: 0.2
          },
          legend: {
            position: 'bottom',
            fontSize: 'typography.fontSize.sm',
            fontFamily: 'typography.fontFamily.primary',
            labels: {
              colors: 'colors.ui.foreground'
            }
          }
        }
      }
    },

    /**
     * Schedule Heatmap - Heatmap for time-based data
     * Use: Duty schedules, maintenance logs, activity patterns
     */
    schedule_heatmap: {
      style: {
        chart_type: 'heatmap',
        show_labels: false,
        chart_options: {
          plotOptions: {
            heatmap: {
              shadeIntensity: 0.5,
              colorScale: {
                ranges: [
                  { from: 0, to: 25, name: 'Low', color: 'colors.chart.series1' },
                  { from: 25, to: 50, name: 'Medium', color: 'colors.status.success' },
                  { from: 50, to: 75, name: 'High', color: 'colors.status.warning' },
                  { from: 75, to: 100, name: 'Critical', color: 'colors.status.danger' }
                ]
              }
            }
          },
          dataLabels: {
            enabled: false
          },
          stroke: {
            width: 1,
            colors: ['colors.ui.background']
          }
        }
      }
    },

    // ============================================
    // NEW CHART TYPE TEMPLATES (Phase 1 - 6 templates)
    // ============================================

    /**
     * Gauge Radial - RadialBar for gauge-style displays
     * Use: Shield strength, warp core power, system completion %
     */
    gauge_radial: {
      style: {
        chart_type: 'radialBar',
        value_format: 'percent',
        gauge_start_angle: -90,
        gauge_end_angle: 90,
        show_labels: true,
        chart_options: {
          plotOptions: {
            radialBar: {
              hollow: {
                size: '65%',
                background: 'transparent'
              },
              track: {
                background: 'colors.ui.disabled',
                strokeWidth: '100%',
                opacity: 0.3
              },
              dataLabels: {
                name: {
                  show: true,
                  fontSize: 'typography.fontSize.base',
                  fontFamily: 'typography.fontFamily.primary',
                  color: 'colors.ui.foreground',
                  offsetY: -10
                },
                value: {
                  show: true,
                  fontSize: 'typography.fontSize.2xl',
                  fontFamily: 'typography.fontFamily.primary',
                  color: 'colors.accent.primary',
                  offsetY: 5
                }
              }
            }
          }
        }
      }
    },

    /**
     * Timeline Range - RangeBar for schedules and timelines
     * Use: Maintenance schedules, mission timelines, duty rosters
     */
    timeline_range: {
      style: {
        chart_type: 'rangeBar',
        group_rows: true,
        show_labels: true,
        chart_options: {
          plotOptions: {
            bar: {
              horizontal: true,
              barHeight: '80%',
              rangeBarGroupRows: true
            }
          },
          xaxis: {
            type: 'datetime',
            labels: {
              datetimeUTC: false,
              format: 'HH:mm',
              style: {
                colors: 'colors.ui.foreground',
                fontSize: 'typography.fontSize.xs',
                fontFamily: 'typography.fontFamily.primary'
              }
            },
            yaxis: {
              labels: {
                style: {
                  colors: 'colors.ui.foreground',
                  fontSize: 'typography.fontSize.xs',
                  fontFamily: 'typography.fontFamily.primary'
                }
              }
            },
            legend: {
              position: 'top',
              fontSize: 'typography.fontSize.sm',
              fontFamily: 'typography.fontFamily.primary',
              labels: {
                colors: 'colors.ui.foreground'
              }
            }
          }
        }
      }
    },

    /**
     * Sensor Polar - PolarArea for directional data
     * Use: Sensor arrays, tactical displays, directional shields
     */
    sensor_polar: {
      style: {
        chart_type: 'polarArea',
        show_legend: true,
        legend_position: 'bottom',
        chart_options: {
          stroke: {
            width: 2,
            colors: ['colors.ui.background']
          },
          fill: {
            opacity: 0.8
          },
          legend: {
            position: 'bottom',
            fontSize: 'typography.fontSize.sm',
            fontFamily: 'typography.fontFamily.primary',
            labels: {
              colors: 'colors.ui.foreground'
            }
          },
          plotOptions: {
            polarArea: {
              rings: {
                strokeWidth: 1,
                strokeColor: 'colors.ui.border'
              },
              spokes: {
                strokeWidth: 1,
                connectorColors: 'colors.ui.border'
              }
            }
          }
        }
      }
    },

    /**
     * Status Treemap - Treemap for hierarchical data
     * Use: System resource allocation, crew hierarchy, file systems
     */
    status_treemap: {
      style: {
        chart_type: 'treemap',
        show_labels: true,
        chart_options: {
          plotOptions: {
            treemap: {
              enableShades: true,
              shadeIntensity: 0.5,
              distributed: true,
              colorScale: {
                ranges: [
                  { from: 0, to: 25, color: 'colors.chart.series1' },
                  { from: 25, to: 50, color: 'colors.status.success' },
                  { from: 50, to: 75, color: 'colors.status.warning' },
                  { from: 75, to: 100, color: 'colors.status.danger' }
                ]
              }
            }
          },
          dataLabels: {
            enabled: true,
            style: {
              fontSize: 'typography.fontSize.sm',
              fontFamily: 'typography.fontFamily.primary',
              fontWeight: 'bold',
              colors: ['colors.ui.foreground']
            },
            offsetY: -4
          }
        }
      }
    },

    /**
     * Range Confidence - RangeArea for confidence intervals
     * Use: Acceptable operating ranges, prediction intervals, tolerances
     */
    range_confidence: {
      style: {
        chart_type: 'rangeArea',
        fill_opacity: 0.2,
        show_legend: true,
        legend_position: 'top',
        time_window: '24h',
        chart_options: {
          stroke: {
            curve: 'straight',
            width: [0, 2, 2, 0],
            colors: [
              'transparent',
              'colors.accent.primary',
              'colors.accent.primary',
              'transparent'
            ]
          },
          fill: {
            type: 'solid',
            opacity: 0.2
          },
          markers: { size: 0 },
          legend: {
            position: 'top',
            fontSize: 'typography.fontSize.sm',
            fontFamily: 'typography.fontFamily.primary',
            labels: {
              colors: 'colors.ui.foreground'
            }
          }
        }
      }
    },

    /**
     * Correlation Scatter - Scatter plot for correlation analysis
     * Use: Sensor correlations, performance analysis, diagnostics
     */
    correlation_scatter: {
      style: {
        chart_type: 'scatter',
        marker_size: 6,
        show_grid: true,
        show_legend: true,
        legend_position: 'top',
        chart_options: {
          markers: {
            size: 6,
            strokeWidth: 0,
            hover: { sizeOffset: 3 }
          },
          grid: {
            borderColor: 'colors.ui.border',
            strokeDashArray: 4,
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: true } }
          },
          dataLabels: { enabled: false },
          legend: {
            position: 'top',
            fontSize: 'typography.fontSize.sm',
            fontFamily: 'typography.fontFamily.primary',
            labels: {
              colors: 'colors.ui.foreground'
            }
          }
        }
      }
    },

    // ============================================
    // ADVANCED TEMPLATES (With Inheritance - 3 templates)
    // ============================================

    /**
     * Threshold Monitor - Extends sensor_monitor with alert thresholds
     * Use: Critical sensors that need visual threshold indicators
     */
    threshold_monitor: {
      extends: 'sensor_monitor',
      style: {
        chart_options: {
          annotations: {
            yaxis: [
              {
                y: 80,
                borderColor: 'colors.status.danger',
                strokeDashArray: 4,
                label: {
                  text: 'CRITICAL',
                  style: {
                    color: '#fff',
                    background: 'colors.status.danger',
                    fontSize: 'typography.fontSize.xs',
                    fontFamily: 'typography.fontFamily.primary'
                  },
                  position: 'right'
                }
              },
              {
                y: 60,
                borderColor: 'colors.status.warning',
                strokeDashArray: 4,
                label: {
                  text: 'WARNING',
                  style: {
                    color: '#000',
                    background: 'colors.status.warning',
                    fontSize: 'typography.fontSize.xs',
                    fontFamily: 'typography.fontFamily.primary'
                  },
                  position: 'right'
                }
              }
            ]
          }
        }
      }
    },

    /**
     * Multi Metric - Multiple series with different rendering
     * Use: Comparing different metrics with optimal visualization per metric
     */
    multi_metric: {
      extends: 'sensor_monitor',
      style: {
        show_legend: true,
        legend_position: 'top',
        chart_options: {
          stroke: {
            curve: 'smooth',
            width: [3, 2, 2]
          },
          fill: {
            type: ['solid', 'gradient', 'gradient'],
            opacity: [1, 0.2, 0.2]
          }
        }
      }
    },

    /**
     * Realtime Sparkline - Minimal line chart for realtime data
     * Use: Live sensor feeds, network traffic, system monitors
     */
    realtime_sparkline: {
      extends: 'sensor_monitor',
      style: {
        time_window: '5m',
        max_points: 100,
        chart_options: {
          chart: {
            sparkline: {
              enabled: true
            }
          },
          stroke: {
            width: 2,
            curve: 'smooth'
          },
          tooltip: {
            fixed: {
              enabled: false
            },
            x: { show: false },
            y: {
              title: {
                formatter: () => ''
              }
            }
          }
        }
      }
    }
  }
};

const BUILTIN_REGISTRY = {
  core: CORE_PACK,
  lcars_fx: LCARS_FX_PACK,
  cb_lcars_buttons: CB_LCARS_BUTTONS_PACK,
  builtin_themes: BUILTIN_THEMES_PACK  // ✅ ADD: Register the themes pack
};

// Remove getBuiltinPack() function entirely - it's not needed anymore
// All packs are now in BUILTIN_REGISTRY

export function loadBuiltinPacks(requested = ['core', 'cb_lcars_buttons']) {
  // ✅ CRITICAL FIX: Always load builtin_themes pack for theme system
  const packsToLoad = [...new Set([...requested, 'builtin_themes'])];

  return packsToLoad.map(id => BUILTIN_REGISTRY[id]).filter(Boolean);
}

// Make loadBuiltinPacks globally accessible for preset loading
if (typeof window !== 'undefined') {
  window.loadBuiltinPacksModule = { loadBuiltinPacks };
}
