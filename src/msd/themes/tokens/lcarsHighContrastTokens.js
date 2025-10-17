/**
 * @fileoverview LCARS High Contrast Theme Tokens
 *
 * Accessibility-focused high contrast theme.
 * Maximum color differentiation for visibility.
 *
 * @module msd/themes/tokens/lcarsHighContrastTokens
 */

export const lcarsHighContrastTokens = {
  colors: {
    accent: {
      primary: 'var(--lcars-white, #FFFFFF)',
      secondary: 'var(--lcars-yellow, #FFFF00)',
      tertiary: 'var(--lcars-cyan, #00FFFF)',

      primaryDark: 'darken(colors.accent.primary, 0.3)',
      primaryLight: 'lighten(colors.accent.primary, 0)',  // Already white
      primaryMuted: 'alpha(colors.accent.primary, 0.8)',

      secondaryDark: 'darken(colors.accent.secondary, 0.3)',
      secondaryLight: 'lighten(colors.accent.secondary, 0.1)'
    },

    status: {
      info: 'var(--lcars-cyan, #00FFFF)',
      success: 'var(--lcars-bright-green, #00FF00)',
      warning: 'var(--lcars-bright-yellow, #FFFF00)',
      danger: 'var(--lcars-bright-red, #FF0000)',
      unknown: 'var(--lcars-white, #FFFFFF)',

      alert1: 'var(--lcars-bright-yellow, #FFFF00)',
      alert2: 'colors.status.warning',
      alert3: 'lighten(colors.status.danger, 0.2)',
      alert4: 'saturate(colors.status.danger, 1.0)'
    },

    ui: {
      background: 'var(--lcars-black, #000000)',
      foreground: 'var(--lcars-white, #FFFFFF)',
      border: 'var(--lcars-white, #FFFFFF)',
      disabled: 'var(--lcars-gray, #888888)',

      surface: 'alpha(colors.ui.foreground, 0.1)',
      surfaceHover: 'alpha(colors.ui.foreground, 0.2)',
      surfaceActive: 'alpha(colors.ui.foreground, 0.3)'
    },

    chart: {
      series: [
        'var(--lcars-white, #FFFFFF)',
        'var(--lcars-yellow, #FFFF00)',
        'var(--lcars-cyan, #00FFFF)',
        'var(--lcars-magenta, #FF00FF)',
        'var(--lcars-bright-green, #00FF00)',
        'var(--lcars-bright-red, #FF0000)'
      ],
      grid: 'var(--lcars-white, #FFFFFF)',
      axis: 'var(--lcars-white, #FFFFFF)',
      gridMuted: 'alpha(colors.chart.grid, 0.5)'
    },

    alert: {
      base: 'var(--lcars-bright-red, #FF0000)',
      critical: 'saturate(lighten(colors.alert.base, 0.2), 1.0)',
      warning: 'var(--lcars-bright-yellow, #FFFF00)',
      caution: 'var(--lcars-bright-orange, #FF8800)'
    }
  },

  typography: {
    fontFamily: {
      primary: 'var(--lcars-font-family, Antonio, Helvetica Neue, sans-serif)',
      monospace: 'var(--lcars-font-monospace, Courier New, monospace)'
    },

    fontSize: {
      xs: 12,
      sm: 14,
      base: {
        small: 14,
        medium: 16,
        large: 18
      },
      lg: 18,
      xl: 22,
      '2xl': 28,
      '3xl': 36
    },

    fontWeight: {
      normal: 'bold',  // Force bold for better readability
      bold: 'bold'
    },

    lineHeight: {
      tight: 1.2,
      normal: 1.4,
      relaxed: 1.6
    },

    letterSpacing: {
      tight: '0',
      normal: '0.02em',
      wide: '0.08em',
      wider: '0.12em'
    }
  },

  spacing: {
    scale: {
      '0': 0,
      '1': 3,
      '2': 6,
      '3': 9,
      '4': 12,
      '5': 15,
      '6': 18,
      '8': 24,
      '10': 30,
      '12': 36,
      '16': 48
    },

    gap: {
      none: 0,
      xs: 2,
      sm: 4,
      base: 6,
      lg: 10,
      xl: 16
    }
  },

  borders: {
    width: {
      none: 0,
      thin: 2,
      base: 3,
      thick: 5
    },

    radius: {
      none: 0,
      sm: 4,
      base: 8,
      lg: 12,
      xl: 16,
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
      disabled: 0.5,
      muted: 0.75,
      base: 1.0
    },

    shadow: {
      sm: '0 2px 4px rgba(255,255,255,0.3)',
      base: '0 4px 8px rgba(255,255,255,0.4)',
      lg: '0 8px 16px rgba(255,255,255,0.5)'
    },

    blur: {
      sm: 0,  // No blur for accessibility
      base: 0,
      lg: 0
    },

    glow: {
      accent: '0 0 12px var(--lcars-white, #FFFFFF)',
      accentStrong: '0 0 24px var(--lcars-white, #FFFFFF)',
      danger: '0 0 12px var(--lcars-bright-red, #FF0000)',
      success: '0 0 12px var(--lcars-bright-green, #00FF00)'
    }
  },

  animations: {
    duration: {
      instant: 0,
      fast: 150,
      base: 250,
      slow: 400,
      slower: 600,
      slowest: 900
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
      defaultGap: 'spacing.gap.base',
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
      defaultWidth: 'borders.width.thick'
    },

    sparkline: {
      defaultColor: 'colors.accent.primary',
      defaultStrokeWidth: 'borders.width.thick'
    }
  }
};
