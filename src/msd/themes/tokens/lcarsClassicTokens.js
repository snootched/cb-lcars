/**
 * @fileoverview LCARS Classic Theme Tokens
 *
 * TNG-era LCARS styling with CSS variable references.
 * All color values reference --lcars-* CSS variables from HA-LCARS theme.
 *
 * @module msd/themes/tokens/lcarsClassicTokens
 */

export const lcarsClassicTokens = {
  colors: {
    accent: {
      primary: 'var(--lcars-orange, #FF9900)',
      secondary: 'var(--lcars-blue, #9999FF)',
      tertiary: 'var(--lcars-purple, #CC99CC)',

      // Computed variants (color manipulation only)
      primaryDark: 'darken(colors.accent.primary, 0.2)',
      primaryLight: 'lighten(colors.accent.primary, 0.2)',
      primaryMuted: 'alpha(colors.accent.primary, 0.6)',

      secondaryDark: 'darken(colors.accent.secondary, 0.2)',
      secondaryLight: 'lighten(colors.accent.secondary, 0.2)'
    },

    status: {
      info: 'var(--lcars-blue, #9999FF)',
      success: 'var(--lcars-green, #99CC99)',
      warning: 'var(--lcars-orange, #FF9900)',
      danger: 'var(--lcars-red, #CC6666)',
      unknown: 'var(--lcars-gray, #999999)',

      // Alert intensity levels (computed)
      alert1: 'var(--lcars-yellow, #FFCC99)',
      alert2: 'colors.status.warning',
      alert3: 'darken(colors.status.danger, 0.1)',
      alert4: 'saturate(colors.status.danger, 0.3)'
    },

    ui: {
      background: 'var(--lcars-black, #000000)',
      foreground: 'var(--lcars-white, #FFFFFF)',
      border: 'var(--lcars-gray, #999999)',
      disabled: 'var(--lcars-dark-gray, #666666)',

      // Computed surface colors
      surface: 'alpha(colors.ui.foreground, 0.05)',
      surfaceHover: 'alpha(colors.ui.foreground, 0.1)',
      surfaceActive: 'alpha(colors.ui.foreground, 0.15)'
    },

    chart: {
      // Series colors (primary data visualization colors)
      series: [
        'var(--lcars-orange, #FF9900)',
        'var(--lcars-blue, #9999FF)',
        'var(--lcars-yellow, #FFCC99)',
        'var(--lcars-purple, #CC99CC)',
        'var(--lcars-green, #99CC99)',
        'var(--lcars-red, #CC6666)'
      ],

      // Grid styling
      grid: 'var(--lcars-gray, #999999)',
      gridMuted: 'alpha(colors.chart.grid, 0.3)',
      gridRow: ['alpha(colors.chart.grid, 0.05)', 'transparent'],
      gridColumn: ['alpha(colors.chart.grid, 0.05)', 'transparent'],

      // Axis styling
      axis: 'var(--lcars-white, #FFFFFF)',
      axisBorder: 'var(--lcars-gray, #999999)',
      axisTicks: 'alpha(var(--lcars-gray, #999999), 0.6)',

      // Stroke (line/border colors)
      stroke: 'var(--lcars-white, #FFFFFF)',
      strokeMuted: 'alpha(colors.chart.stroke, 0.8)',

      // Fill colors (for area/bar charts)
      fillColors: 'colors.chart.series',  // Defaults to series colors
      fillOpacity: 0.7,

      // Background and foreground
      background: 'transparent',
      foreground: 'var(--lcars-white, #FFFFFF)',

      // Legend styling
      legend: 'var(--lcars-white, #FFFFFF)',
      legendMuted: 'alpha(colors.chart.legend, 0.8)',

      // Marker (data point) colors
      marker: 'colors.chart.series',  // Defaults to series colors
      markerStroke: 'var(--lcars-white, #FFFFFF)',
      markerStrokeWidth: 2,

      // Data label colors
      dataLabel: 'var(--lcars-white, #FFFFFF)',
      dataLabelBackground: 'alpha(var(--lcars-black, #000000), 0.8)',

      // Tooltip styling
      tooltipTheme: 'dark',
      tooltipBackground: 'var(--lcars-black, #000000)',
      tooltipForeground: 'var(--lcars-white, #FFFFFF)',

      // Theme settings
      themeMode: 'dark',
      themePalette: null,  // null = use custom colors above

      // Monochrome settings (when enabled)
      monochromeColor: 'var(--lcars-orange, #FF9900)',
      monochromeShadeTo: 'dark',
      monochromeIntensity: 0.65
    },

    alert: {
      base: 'var(--lcars-red, #CC6666)',

      // Computed alert variants
      critical: 'saturate(lighten(colors.alert.base, 0.1), 0.3)',
      warning: 'mix(colors.alert.base, colors.status.warning, 0.6)',
      caution: 'desaturate(darken(colors.alert.base, 0.1), 0.2)'
    }
  },

  typography: {
    fontFamily: {
      primary: 'var(--lcars-font-family, Antonio, Helvetica Neue, sans-serif)',
      monospace: 'var(--lcars-font-monospace, Courier New, monospace)'
    },

    fontSize: {
      xs: 10,
      sm: 12,
      base: {
        small: 12,
        medium: 14,
        large: 16
      },
      lg: 16,
      xl: 18,
      '2xl': 24,
      '3xl': 32
    },

    fontWeight: {
      normal: 'normal',
      bold: 'bold'
    },

    lineHeight: {
      tight: 1.0,
      normal: 1.2,
      relaxed: 1.5
    },

    letterSpacing: {
      tight: '-0.05em',
      normal: '0',
      wide: '0.05em',
      wider: '0.1em'
    }
  },

  spacing: {
    scale: {
      '0': 0,
      '1': 2,
      '2': 4,
      '3': 6,
      '4': 8,
      '5': 10,
      '6': 12,
      '8': 16,
      '10': 20,
      '12': 24,
      '16': 32
    },

    gap: {
      none: 0,
      xs: 1,
      sm: 2,
      base: 4,
      lg: 8,
      xl: 12
    }
  },

  borders: {
    width: {
      none: 0,
      thin: 1,
      base: 2,
      thick: 3
    },

    radius: {
      none: 0,
      sm: 2,
      base: 4,
      lg: 8,
      xl: 12,
      full: 9999
    },

    style: {
      solid: 'solid',
      dashed: 'dashed',
      dotted: 'dotted'
    }
  },

  effects: {
    opacity: {
      disabled: 0.4,
      muted: 0.6,
      base: 1.0
    },

    shadow: {
      sm: '0 1px 2px rgba(0,0,0,0.2)',
      base: '0 2px 4px rgba(0,0,0,0.3)',
      lg: '0 4px 8px rgba(0,0,0,0.4)'
    },

    blur: {
      sm: 2,
      base: 4,
      lg: 8
    },

    glow: {
      accent: '0 0 8px var(--lcars-orange, #FF9900)',
      accentStrong: '0 0 16px var(--lcars-orange, #FF9900)',
      danger: '0 0 8px var(--lcars-red, #CC6666)',
      success: '0 0 8px var(--lcars-green, #99CC99)'
    }
  },

  animations: {
    duration: {
      instant: 0,
      fast: 200,
      base: 350,
      slow: 500,
      slower: 800,
      slowest: 1200
    },

    easing: {
      linear: 'linear',
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out'
    }
  },

  components: {
    line: {
      // Core line properties
      defaultColor: 'colors.accent.secondary',     // Token reference → blue
      defaultWidth: 'borders.width.base',           // Token reference → 2
      defaultOpacity: 'effects.opacity.base',       // Token reference → 1.0

      // Stroke styling
      defaultLineCap: 'round',
      defaultLineJoin: 'round',
      defaultMiterLimit: 4,

      // Markers
      marker: {
        defaultSize: 'medium',
        defaultColor: 'inherit',
        arrowSize: 8,
        dotSize: 6,
        diamondSize: 8
      },

      // Effects
      glow: {
        size: 'effects.blur.sm',                    // Token reference → 2
        opacity: 0.6,
        color: 'currentColor'
      },

      shadow: {
        offset: [2, 2],
        blur: 'effects.blur.sm',                    // Token reference → 2
        color: 'rgba(0,0,0,0.3)'
      },

      // Patterns
      pattern: {
        size: 8,
        opacity: 0.5
      }
    },

    text: {
      defaultSize: 'typography.fontSize.base',
      defaultColor: 'colors.ui.foreground',
      defaultFamily: 'typography.fontFamily.primary',
      defaultLineHeight: 'typography.lineHeight.normal',

      // Text decoration defaults (from old core_defaults profile)
      statusIndicator: {
        sizeRatio: 0.3,
        padding: 8,
        color: 'colors.status.success'
      },

      highlight: {
        padding: 2,
        opacity: 0.3
      },

      bracket: {
        width: 'borders.width.base',
        gap: 'spacing.gap.base',
        extension: 8,
        opacity: 'effects.opacity.base',
        physicalWidth: 8,
        height: '70%',
        radius: 'borders.radius.base',
        borderRadius: 'borders.radius.lg',
        innerFactor: 2
      },

      effects: {
        glow: {
          blur: 'effects.blur.sm',
          intensity: 1
        },
        shadow: {
          offsetX: 2,
          offsetY: 2,
          blur: 'effects.blur.sm',
          color: 'rgba(0,0,0,0.5)'
        }
      }
    },

    statusGrid: {
      defaultCellColor: 'colors.accent.primary',
      defaultGap: 'spacing.gap.sm',
      defaultRadius: 'borders.radius.base',

      // From old core_defaults profile
      rows: 3,
      columns: 4,
      cellGap: 'spacing.gap.sm',
      cellOpacity: 'effects.opacity.base',
      borderColor: 'colors.ui.border',
      borderWidth: 'borders.width.thin',
      unknownColor: 'colors.status.unknown',

      fontSize: 'typography.fontSize.sm',
      labelFontSize: 'typography.fontSize.lg',
      valueFontSize: 'typography.fontSize.base',
      fontFamily: 'typography.fontFamily.primary',
      fontWeight: 'typography.fontWeight.normal',
      labelColor: 'colors.ui.foreground',
      valueColor: 'colors.ui.foreground',

      textLayout: 'stacked',
      textAlignment: 'center',
      textJustify: 'center',
      labelPosition: 'center-top',
      valuePosition: 'center-bottom',
      textPadding: 'spacing.scale.4',
      textMargin: 'spacing.scale.1',
      maxTextWidth: '90%',
      textOverflow: 'ellipsis',

      // Status colors
      statusOnColor: 'colors.status.success',
      statusOffColor: 'colors.status.unknown',
      statusUnavailableColor: 'colors.status.danger',

      // LCARS features
      bracketColor: null,
      bracketWidth: 'borders.width.base',
      bracketGap: 'spacing.gap.base',
      bracketExtension: 8,
      bracketOpacity: 'effects.opacity.base',

      // Interaction
      hoverColor: 'colors.accent.secondary',
      hoverScale: 1.05,

      // Animation
      cascadeSpeed: 0,
      cascadeDirection: 'row',
      revealAnimation: false,
      pulseOnChange: false,

      // Performance
      updateThrottle: 100
    },

    overlay: {
      defaultPadding: 'spacing.scale.4'
    },

    button: {
      defaultColor: 'colors.accent.primary',
      defaultRadius: 'borders.radius.lg'
    },

    chart: {
      // ============================================================================
      // SERIES COLORS (Primary data visualization)
      // ============================================================================
      defaultColors: 'colors.chart.series',
      defaultColor: 'colors.accent.primary',  // Single-series fallback

      // ============================================================================
      // STROKE/OUTLINE
      // ============================================================================
      defaultStrokeColor: 'colors.chart.stroke',
      defaultStrokeColors: null,  // null = use defaultStrokeColor
      defaultStrokeWidth: 'borders.width.thick',
      curve: 'smooth',

      // ============================================================================
      // FILL (for area/bar charts)
      // ============================================================================
      defaultFillColors: 'colors.chart.fillColors',
      defaultFillType: 'solid',
      defaultFillOpacity: 'colors.chart.fillOpacity',

      // ============================================================================
      // BACKGROUND & FOREGROUND
      // ============================================================================
      backgroundColor: 'colors.chart.background',
      foregroundColor: 'colors.chart.foreground',

      // ============================================================================
      // GRID
      // ============================================================================
      gridColor: 'colors.chart.gridMuted',
      gridRowColors: 'colors.chart.gridRow',
      gridColumnColors: 'colors.chart.gridColumn',
      showGrid: true,

      // ============================================================================
      // AXIS
      // ============================================================================
      axisColor: 'colors.chart.axis',
      xaxisColor: null,  // null = use axisColor
      yaxisColor: null,  // null = use axisColor
      axisBorderColor: 'colors.chart.axisBorder',
      axisTicksColor: 'colors.chart.axisTicks',

      // ============================================================================
      // LEGEND
      // ============================================================================
      legendColor: 'colors.chart.legend',
      legendColors: null,  // null = use legendColor for all
      showLegend: false,   // LCARS style: minimal legends

      // ============================================================================
      // MARKERS (data points)
      // ============================================================================
      markerColors: 'colors.chart.marker',
      markerStrokeColors: 'colors.chart.markerStroke',
      markerStrokeWidth: 'colors.chart.markerStrokeWidth',

      // ============================================================================
      // DATA LABELS (value text on chart)
      // ============================================================================
      dataLabelColors: 'colors.chart.dataLabel',
      showDataLabels: false,  // LCARS style: show in tooltip instead

      // ============================================================================
      // THEME
      // ============================================================================
      themeMode: 'colors.chart.themeMode',
      themePalette: 'colors.chart.themePalette',

      // Monochrome settings
      monochromeEnabled: false,
      monochromeColor: 'colors.chart.monochromeColor',
      monochromeShadeTo: 'colors.chart.monochromeShadeTo',
      monochromeIntensity: 'colors.chart.monochromeIntensity',

      // ============================================================================
      // DISPLAY OPTIONS
      // ============================================================================
      showToolbar: false,  // LCARS style: minimal UI
      showTooltip: true,
      tooltipTheme: 'colors.chart.tooltipTheme',

      // ============================================================================
      // FONT/TYPOGRAPHY
      // ============================================================================
      fontFamily: 'typography.fontFamily.primary',
      fontSize: 'typography.fontSize.sm',
      fontWeight: 'typography.fontWeight.normal'
    }
  }
};
