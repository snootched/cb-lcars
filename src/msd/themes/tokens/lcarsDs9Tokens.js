/**
 * @fileoverview LCARS DS9 Theme Tokens
 *
 * Deep Space Nine era LCARS styling - darker, more muted colors.
 * Emphasizes blues and purples over orange.
 *
 * @module msd/themes/tokens/lcarsDs9Tokens
 */

export const lcarsDs9Tokens = {
  colors: {
    accent: {
      primary: 'var(--lcars-blue, #6688CC)',
      secondary: 'var(--lcars-purple, #9966CC)',
      tertiary: 'var(--lcars-teal, #6699CC)',

      primaryDark: 'darken(colors.accent.primary, 0.25)',
      primaryLight: 'lighten(colors.accent.primary, 0.15)',
      primaryMuted: 'alpha(colors.accent.primary, 0.7)',

      secondaryDark: 'darken(colors.accent.secondary, 0.2)',
      secondaryLight: 'lighten(colors.accent.secondary, 0.2)'
    },

    status: {
      info: 'var(--lcars-blue, #6688CC)',
      success: 'var(--lcars-green, #88AA88)',
      warning: 'var(--lcars-amber, #CC9966)',
      danger: 'var(--lcars-red, #AA6666)',
      unknown: 'var(--lcars-gray, #888888)',

      alert1: 'var(--lcars-amber, #CC9966)',
      alert2: 'colors.status.warning',
      alert3: 'darken(colors.status.danger, 0.15)',
      alert4: 'saturate(colors.status.danger, 0.4)'
    },

    ui: {
      background: 'var(--lcars-black, #000000)',
      foreground: 'var(--lcars-white, #CCCCCC)',
      border: 'var(--lcars-gray, #666666)',
      disabled: 'var(--lcars-dark-gray, #444444)',

      surface: 'alpha(colors.ui.foreground, 0.08)',
      surfaceHover: 'alpha(colors.ui.foreground, 0.12)',
      surfaceActive: 'alpha(colors.ui.foreground, 0.18)'
    },

    chart: {
      series: [
        'var(--lcars-blue, #6688CC)',
        'var(--lcars-purple, #9966CC)',
        'var(--lcars-teal, #6699CC)',
        'var(--lcars-amber, #CC9966)',
        'var(--lcars-green, #88AA88)',
        'var(--lcars-red, #AA6666)'
      ],
      grid: 'var(--lcars-gray, #666666)',
      axis: 'var(--lcars-white, #CCCCCC)',
      gridMuted: 'alpha(colors.chart.grid, 0.4)'
    },

    alert: {
      base: 'var(--lcars-red, #AA6666)',
      critical: 'saturate(lighten(colors.alert.base, 0.15), 0.4)',
      warning: 'mix(colors.alert.base, colors.status.warning, 0.5)',
      caution: 'desaturate(darken(colors.alert.base, 0.15), 0.3)'
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
      disabled: 0.35,
      muted: 0.65,
      base: 1.0
    },

    shadow: {
      sm: '0 1px 2px rgba(0,0,0,0.3)',
      base: '0 2px 4px rgba(0,0,0,0.4)',
      lg: '0 4px 8px rgba(0,0,0,0.5)'
    },

    blur: {
      sm: 2,
      base: 4,
      lg: 8
    },

    glow: {
      accent: '0 0 8px var(--lcars-blue, #6688CC)',
      accentStrong: '0 0 16px var(--lcars-blue, #6688CC)',
      danger: '0 0 8px var(--lcars-red, #AA6666)',
      success: '0 0 8px var(--lcars-green, #88AA88)'
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
