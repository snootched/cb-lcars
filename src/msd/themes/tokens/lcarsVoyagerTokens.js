/**
 * @fileoverview LCARS Voyager Theme Tokens
 *
 * Voyager era LCARS styling - brighter colors, higher contrast.
 * Emphasizes gold/yellow tones.
 *
 * @module msd/themes/tokens/lcarsVoyagerTokens
 */

export const lcarsVoyagerTokens = {
  colors: {
    accent: {
      primary: 'var(--lcars-gold, #FFAA00)',
      secondary: 'var(--lcars-blue, #0099FF)',
      tertiary: 'var(--lcars-cyan, #00CCFF)',

      primaryDark: 'darken(colors.accent.primary, 0.25)',
      primaryLight: 'lighten(colors.accent.primary, 0.15)',
      primaryMuted: 'alpha(colors.accent.primary, 0.65)',

      secondaryDark: 'darken(colors.accent.secondary, 0.2)',
      secondaryLight: 'lighten(colors.accent.secondary, 0.2)'
    },

    status: {
      info: 'var(--lcars-blue, #0099FF)',
      success: 'var(--lcars-green, #00CC88)',
      warning: 'var(--lcars-gold, #FFAA00)',
      danger: 'var(--lcars-red, #FF3366)',
      unknown: 'var(--lcars-gray, #AAAAAA)',

      alert1: 'var(--lcars-yellow, #FFDD00)',
      alert2: 'colors.status.warning',
      alert3: 'darken(colors.status.danger, 0.1)',
      alert4: 'saturate(colors.status.danger, 0.5)'
    },

    ui: {
      background: 'var(--lcars-black, #000000)',
      foreground: 'var(--lcars-white, #FFFFFF)',
      border: 'var(--lcars-gray, #AAAAAA)',
      disabled: 'var(--lcars-dark-gray, #777777)',

      surface: 'alpha(colors.ui.foreground, 0.06)',
      surfaceHover: 'alpha(colors.ui.foreground, 0.12)',
      surfaceActive: 'alpha(colors.ui.foreground, 0.18)'
    },

    chart: {
      series: [
        'var(--lcars-gold, #FFAA00)',
        'var(--lcars-blue, #0099FF)',
        'var(--lcars-cyan, #00CCFF)',
        'var(--lcars-green, #00CC88)',
        'var(--lcars-purple, #CC66FF)',
        'var(--lcars-red, #FF3366)'
      ],
      grid: 'var(--lcars-gray, #AAAAAA)',
      axis: 'var(--lcars-white, #FFFFFF)',
      gridMuted: 'alpha(colors.chart.grid, 0.35)'
    },

    alert: {
      base: 'var(--lcars-red, #FF3366)',
      critical: 'saturate(lighten(colors.alert.base, 0.1), 0.5)',
      warning: 'mix(colors.alert.base, colors.status.warning, 0.7)',
      caution: 'desaturate(darken(colors.alert.base, 0.1), 0.25)'
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
        small: 13,
        medium: 15,
        large: 17
      },
      lg: 17,
      xl: 20,
      '2xl': 26,
      '3xl': 34
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
      thick: 4
    },

    radius: {
      none: 0,
      sm: 3,
      base: 6,
      lg: 10,
      xl: 14,
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
      disabled: 0.45,
      muted: 0.65,
      base: 1.0
    },

    shadow: {
      sm: '0 1px 3px rgba(0,0,0,0.25)',
      base: '0 2px 6px rgba(0,0,0,0.35)',
      lg: '0 4px 12px rgba(0,0,0,0.45)'
    },

    blur: {
      sm: 2,
      base: 4,
      lg: 8
    },

    glow: {
      accent: '0 0 10px var(--lcars-gold, #FFAA00)',
      accentStrong: '0 0 20px var(--lcars-gold, #FFAA00)',
      danger: '0 0 10px var(--lcars-red, #FF3366)',
      success: '0 0 10px var(--lcars-green, #00CC88)'
    }
  },

  animations: {
    duration: {
      instant: 0,
      fast: 180,
      base: 320,
      slow: 480,
      slower: 750,
      slowest: 1100
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
    text: {
      defaultColor: 'colors.ui.foreground',
      defaultSize: 'typography.fontSize.base',
      defaultFamily: 'typography.fontFamily.primary'
    },

    statusGrid: {
      defaultCellColor: 'colors.accent.primary',
      defaultGap: 'spacing.gap.sm',
      defaultRadius: 'borders.radius.base',

      statusOnColor: 'colors.status.success',
      statusOffColor: 'colors.status.unknown',
      statusUnavailableColor: 'colors.status.danger'
    },

    button: {
      defaultColor: 'colors.accent.primary',
      defaultRadius: 'borders.radius.lg'
    },

    chart: {
      defaultColors: 'colors.chart.series',
      defaultStrokeWidth: 'borders.width.thick',
      gridColor: 'colors.chart.gridMuted'
    },

    line: {
      defaultColor: 'colors.accent.secondary',
      defaultWidth: 'borders.width.base'
    },

    sparkline: {
      defaultColor: 'colors.accent.primary',
      defaultStrokeWidth: 'borders.width.base'
    }
  }
};
