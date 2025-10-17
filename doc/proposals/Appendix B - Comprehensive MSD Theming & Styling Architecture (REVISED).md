# MSD ApexCharts Enhancement Proposal - Appendix B (REVISED)

**Version:** 1.1.0  
**Date:** 2025-01-16  
**Status:** Proposed - Appendix (REVISED)  
**Author:** CB-LCARS MSD Team

---

## Appendix B: Comprehensive MSD Theming & Styling Architecture

This appendix addresses the need for a unified, cohesive theming system across the entire MSD ecosystem, enabling pack-based styling for all overlay types and visual elements.

---

## B.1 Current State Analysis

### B.1.1 Existing Styling Mechanisms

**Current styling is fragmented across multiple systems:**

| System | Scope | Format | Location | Status |
|--------|-------|--------|----------|--------|
| **CSS Custom Properties** | Global colors | CSS vars | Root element | ✅ Active |
| **HA-LCARS Theme Variables** | HA theme colors | CSS vars | `--lcars-*` | ✅ Active (external) |
| **CB-LCARS Legacy Colors** | Legacy color system | CSS vars | `--cb-lcars-*` | ✅ Active (legacy) |
| **Pack Palettes** | Color tokens | JS objects | `packs/loadBuiltinPacks.js` | ❌ **UNUSED - REMOVE** |
| **DefaultsManager** | Component defaults | Structured objects | `pipeline/MsdDefaultsManager.js` | ✅ Active |
| **StylePresetManager** | Component style bundles | JS objects | `presets/StylePresetManager.js` | ✅ Active (status grids) |
| **ApexCharts Themes** | Chart-specific | JS config + CSS | Proposed in Appendix A | 🚧 Proposed |
| **Inline Style Config** | Per-overlay | YAML properties | User configs | ✅ Active |

### B.1.2 HA-LCARS Theme Variables

**Available from HA-LCARS theme (`--lcars-*`):**

```css
/* HA-LCARS theme provides these CSS variables */
--lcars-orange: #FF9900;
--lcars-blue: #9999FF;
--lcars-purple: #CC99CC;
--lcars-yellow: #FFCC99;
--lcars-red: #CC6666;
--lcars-green: #99CC99;
--lcars-gray: #999999;
--lcars-white: #FFFFFF;
--lcars-black: #000000;
--lcars-dark-gray: #666666;

/* Additional HA-LCARS variables */
--lcars-cyan: #00FFFF;
--lcars-magenta: #FF00FF;
--lcars-gold: #FFD700;
/* ... potentially more */
```

### B.1.3 CB-LCARS Legacy Color System

**CB-LCARS provides fallback color loading:**

```javascript
// Legacy CB-LCARS color initialization
// Loads colors as CSS variables if not already defined by theme

const cbLcarsColors = {
  'orange': '#FF9900',
  'blue': '#9999FF',
  'purple': '#CC99CC',
  // ... etc
};

// Applied as --cb-lcars-* or --lcars-* if missing
```

### B.1.4 Problems Identified

#### Problem 1: Inconsistent Color Application

**Observation:** Colors are defined in multiple places with no single source of truth.

```javascript
// Pack palette (UNUSED - to be REMOVED)
palettes: {
  default: {
    accent1: 'var(--lcars-orange)',
    accent2: 'var(--lcars-yellow)',
    danger: 'var(--lcars-red)',
    info: 'var(--lcars-cyan)'
  }
}

// Meanwhile, overlays use direct CSS variables
style: {
  color: 'var(--lcars-orange)'  // Direct reference
}

// And ApexCharts has its own color system
chartTheme: {
  colors: ['#FF9900', '#9999FF', ...]  // Hardcoded hex values
}
```

**Issue:** Changing the "primary accent" color requires updates in 3+ places.

#### Problem 2: No Typography System

**Observation:** Font sizes and families are scattered.

```javascript
// Text overlays
font_size: 14  // Numeric value

// Status grids
label_font_size: { value: 18, scale: 'none', unit: 'px' }  // Object format

// ApexCharts
legend: { fontSize: '12px' }  // String with unit

// Button overlays
// Uses inherited styles with no explicit control
```

**Issue:** No unified typography scale or font family management.

#### Problem 3: Spacing and Layout Inconsistency

**Observation:** Padding, margins, gaps use different measurement systems.

```javascript
// Some use viewBox-relative
padding: { value: 8, scale: 'viewbox', unit: 'px' }

// Some use direct pixels
cell_gap: 2  // Direct numeric

// Some use strings
margin: '10px'  // String with unit
```

**Issue:** Difficult to maintain consistent spacing across overlay types.

#### Problem 4: Pack Palettes Are Dead Code

**Observation:** Pack palettes exist but aren't referenced by components.

```javascript
// Palette is defined
palettes: {
  cb_lcars_buttons: {
    primary: 'var(--lcars-blue)',
    secondary: 'var(--lcars-orange)',
    // ...
  }
}

// But overlays don't reference it
style: {
  color: 'var(--lcars-orange)'  // Should use palette.secondary
}
```

**Issue:** Palettes are unused abstraction layer. **Decision: REMOVE palettes entirely.**

#### Problem 5: No Theme Inheritance

**Observation:** Each overlay resolves its own styling independently.

```javascript
// Text overlay
TextOverlayRenderer.render(overlay, ...)  // Resolves color independently

// Status grid
StatusGridRenderer.render(overlay, ...)  // Resolves color independently

// ApexCharts
ApexChartsAdapter.generateOptions(...)  // Resolves color independently
```

**Issue:** No shared theme context flows through renderers.

### B.1.5 User Pain Points

**Current User Experience:**

```yaml
# User wants to change from orange to purple accent
# Must update in multiple places:

# 1. CSS variables (if they exist)
# 2. Every overlay that hardcodes color
# 3. Chart themes
# 4. Style presets

overlays:
  - id: text1
    style:
      color: 'var(--lcars-orange)'  # Hard to find all instances
  
  - id: chart1
    style:
      color: 'var(--lcars-orange)'  # Repeated
  
  - id: grid1
    style:
      cell_color: 'var(--lcars-orange)'  # Different property name
```

**Desired User Experience:**

```yaml
# User changes accent color in ONE place (pack or theme)
# All overlays automatically reflect the change

pack: my-purple-theme  # That's it!

overlays:
  - id: text1
    # color automatically uses theme.accent
  
  - id: chart1
    # color automatically uses theme.accent
  
  - id: grid1
    # cell_color automatically uses theme.accent
```

---

## B.2 Proposed Architecture: Unified Token System

### B.2.1 Design Principles

1. **Single Source of Truth**: One place to define each design token
2. **CSS Variable First**: Tokens reference CSS variables (not hardcoded hex)
3. **HA-LCARS Theme Compatible**: Leverage existing `--lcars-*` variables
4. **Semantic Naming**: Colors have meaning (accent, danger, info) not just names
5. **Cascade Hierarchy**: Theme → Pack → Overlay (with proper inheritance)
6. **Type Consistency**: All overlays use same token system
7. **Pack-First**: Themes are primarily distributed via packs

### B.2.2 Token-Based Design System (REVISED)

**Concept:** Replace fragmented styling with unified token system that references CSS variables.

#### Enhanced Token Structure with CSS Variable References

```javascript
// src/msd/themes/tokens/defaultTokens.js

/**
 * Default Design Token System for MSD
 * All tokens reference CSS variables for theme compatibility
 * Supports HA-LCARS theme (--lcars-*) and CB-LCARS legacy (--cb-lcars-*)
 */
export const defaultTokens = {
  // ===== COLORS =====
  colors: {
    // Semantic colors (used by most components)
    accent: {
      primary: 'var(--lcars-orange, #FF9900)',
      secondary: 'var(--lcars-blue, #9999FF)',
      tertiary: 'var(--lcars-purple, #CC99CC)'
    },
    
    // Status colors
    status: {
      info: 'var(--lcars-blue, #9999FF)',
      success: 'var(--lcars-green, #99CC99)',
      warning: 'var(--lcars-orange, #FF9900)',
      danger: 'var(--lcars-red, #CC6666)',
      unknown: 'var(--lcars-gray, #999999)'
    },
    
    // UI element colors
    ui: {
      background: 'var(--lcars-black, #000000)',
      foreground: 'var(--lcars-white, #FFFFFF)',
      border: 'var(--lcars-gray, #999999)',
      disabled: 'var(--lcars-dark-gray, #666666)'
    },
    
    // Chart-specific colors (multi-series)
    chart: {
      series: [
        'var(--lcars-orange, #FF9900)',
        'var(--lcars-blue, #9999FF)',
        'var(--lcars-yellow, #FFCC99)',
        'var(--lcars-purple, #CC99CC)',
        'var(--lcars-green, #99CC99)',
        'var(--lcars-red, #CC6666)'
      ],
      grid: 'var(--lcars-gray, #999999)',
      axis: 'var(--lcars-white, #FFFFFF)'
    }
  },
  
  // ===== TYPOGRAPHY =====
  typography: {
    // Font families
    fontFamily: {
      primary: 'var(--lcars-font-family, Antonio, Helvetica Neue, sans-serif)',
      monospace: 'var(--lcars-font-monospace, Courier New, monospace)'
    },
    
    // Font size scale (consistent sizing)
    fontSize: {
      xs: 10,
      sm: 12,
      base: 14,
      lg: 16,
      xl: 18,
      '2xl': 24,
      '3xl': 32,
      '4xl': 48
    },
    
    // Font weights
    fontWeight: {
      normal: 'normal',
      bold: 'bold'
    },
    
    // Line heights
    lineHeight: {
      tight: 1.0,
      normal: 1.2,
      relaxed: 1.5
    },
    
    // Letter spacing
    letterSpacing: {
      tight: '-0.05em',
      normal: '0',
      wide: '0.05em',
      wider: '0.1em'
    }
  },
  
  // ===== SPACING =====
  spacing: {
    // Spacing scale (viewBox-relative base values)
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
    
    // Gap sizes
    gap: {
      none: 0,
      xs: 1,
      sm: 2,
      base: 4,
      lg: 8,
      xl: 12
    }
  },
  
  // ===== BORDERS =====
  borders: {
    width: {
      none: 0,
      thin: 1,
      base: 2,
      thick: 3,
      heavy: 4
    },
    
    radius: {
      none: 0,
      sm: 2,
      base: 4,
      lg: 8,
      xl: 12,
      '2xl': 16,
      full: 9999
    },
    
    style: {
      solid: 'solid',
      dashed: 'dashed',
      dotted: 'dotted'
    }
  },
  
  // ===== EFFECTS =====
  effects: {
    opacity: {
      disabled: 0.4,
      muted: 0.6,
      base: 1.0
    },
    
    shadow: {
      sm: '0 1px 2px rgba(0,0,0,0.2)',
      base: '0 2px 4px rgba(0,0,0,0.3)',
      lg: '0 4px 8px rgba(0,0,0,0.4)',
      xl: '0 8px 16px rgba(0,0,0,0.5)'
    },
    
    blur: {
      sm: 2,
      base: 4,
      lg: 8,
      xl: 16
    },
    
    glow: {
      accent: '0 0 8px var(--lcars-orange, #FF9900)',
      danger: '0 0 8px var(--lcars-red, #CC6666)',
      success: '0 0 8px var(--lcars-green, #99CC99)'
    }
  },
  
  // ===== ANIMATIONS =====
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
  
  // ===== COMPONENT-SPECIFIC =====
  components: {
    text: {
      defaultColor: 'colors.ui.foreground',
      defaultSize: 'typography.fontSize.base',
      defaultFamily: 'typography.fontFamily.primary'
    },
    
    statusGrid: {
      defaultCellColor: 'colors.accent.primary',
      defaultGap: 'spacing.gap.sm',
      defaultRadius: 'borders.radius.base'
    },
    
    button: {
      defaultColor: 'colors.accent.primary',
      defaultRadius: 'borders.radius.lg'
    },
    
    chart: {
      defaultColors: 'colors.chart.series',
      defaultStrokeWidth: 'borders.width.thick',
      gridColor: 'colors.chart.grid'
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
```

### B.2.3 Token Resolution System (ENHANCED)

**ThemeTokenResolver** - Central token resolution with CSS variable support:

```javascript
// src/msd/themes/ThemeTokenResolver.js

/**
 * ThemeTokenResolver - Resolves design tokens with CSS variable support
 * Provides consistent token access across all MSD components
 * 
 * Features:
 * - CSS variable references (var(--lcars-orange))
 * - Token path resolution (colors.accent.primary)
 * - Computed tokens (darken, lighten, alpha)
 * - Responsive tokens (viewBox-aware)
 * - Fallback chains
 */
export class ThemeTokenResolver {
  constructor(tokens) {
    this.tokens = tokens || {};
    this.computedCache = new Map();
  }

  /**
   * Resolve a token path to its value
   * Supports:
   * - Token references: 'colors.accent.primary'
   * - CSS variables: 'var(--lcars-orange)'
   * - Direct values: '#FF0000'
   * - Computed functions: 'darken(colors.accent.primary, 0.2)'
   * 
   * @param {string} path - Token path or value
   * @param {*} fallback - Fallback value if token not found
   * @param {Object} context - Optional context (viewBoxWidth, etc.)
   * @returns {*} Resolved token value
   */
  resolve(path, fallback = null, context = {}) {
    if (!path) return fallback;

    // CASE 1: Direct CSS variable reference
    // Example: 'var(--lcars-orange)' or 'var(--lcars-orange, #FF9900)'
    if (this._isCssVariable(path)) {
      return this._resolveCssVariable(path, fallback);
    }

    // CASE 2: Computed token function
    // Example: 'darken(colors.accent.primary, 0.2)'
    if (this._isComputedToken(path)) {
      return this._resolveComputedToken(path, context);
    }

    // CASE 3: Direct color value
    // Example: '#FF0000' or 'rgb(255, 0, 0)'
    if (this._isDirectColor(path)) {
      return path;
    }

    // CASE 4: Direct numeric value
    // Example: 14 or '14'
    if (this._isNumeric(path)) {
      return typeof path === 'number' ? path : parseFloat(path);
    }

    // CASE 5: Token path reference
    // Example: 'colors.accent.primary'
    if (this._isTokenReference(path)) {
      return this._resolveTokenPath(path, fallback, context);
    }

    // CASE 6: Unknown format - return as-is with fallback
    return fallback !== null ? fallback : path;
  }

  /**
   * Resolve token path by navigating token tree
   * @private
   */
  _resolveTokenPath(path, fallback, context) {
    const parts = path.split('.');
    let value = this.tokens;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return fallback;
      }
    }

    // Handle responsive tokens (viewBox-aware)
    if (this._isResponsiveToken(value) && context.viewBoxWidth) {
      value = this._resolveResponsiveValue(value, context.viewBoxWidth);
    }

    // If value is another token reference, resolve recursively
    if (typeof value === 'string' && this._isTokenReference(value)) {
      return this.resolve(value, fallback, context);
    }

    return value !== undefined ? value : fallback;
  }

  /**
   * Check if string is a CSS variable reference
   * @private
   */
  _isCssVariable(value) {
    return typeof value === 'string' && value.includes('var(');
  }

  /**
   * Resolve CSS variable (already in correct format)
   * CSS variables are resolved by the browser, so return as-is
   * @private
   */
  _resolveCssVariable(value, fallback) {
    // CSS variables are in format: var(--name) or var(--name, fallback)
    // They are resolved by browser at runtime, so return as-is
    return value;
  }

  /**
   * Check if value is a computed token function
   * @private
   */
  _isComputedToken(value) {
    return typeof value === 'string' && (
      value.startsWith('darken(') ||
      value.startsWith('lighten(') ||
      value.startsWith('alpha(') ||
      value.startsWith('saturate(') ||
      value.startsWith('desaturate(')
    );
  }

  /**
   * Resolve computed token function
   * @private
   */
  _resolveComputedToken(expr, context) {
    // Check cache first
    const cacheKey = `${expr}|${JSON.stringify(context)}`;
    if (this.computedCache.has(cacheKey)) {
      return this.computedCache.get(cacheKey);
    }

    // Parse computed function
    const match = expr.match(/^(\w+)\(([^,]+),\s*([^)]+)\)$/);
    if (!match) {
      cblcarsLog.warn('[ThemeTokenResolver] Invalid computed token:', expr);
      return expr;
    }

    const [, func, baseToken, amount] = match;
    const baseColor = this.resolve(baseToken.trim(), null, context);
    const factor = parseFloat(amount.trim());

    if (!baseColor) {
      cblcarsLog.warn('[ThemeTokenResolver] Cannot resolve base token for computed:', baseToken);
      return expr;
    }

    let result;
    switch (func) {
      case 'darken':
        result = this._darkenColor(baseColor, factor);
        break;
      case 'lighten':
        result = this._lightenColor(baseColor, factor);
        break;
      case 'alpha':
        result = this._setAlpha(baseColor, factor);
        break;
      case 'saturate':
        result = this._saturateColor(baseColor, factor);
        break;
      case 'desaturate':
        result = this._desaturateColor(baseColor, factor);
        break;
      default:
        result = expr;
    }

    // Cache result
    this.computedCache.set(cacheKey, result);
    return result;
  }

  /**
   * Darken a color by a factor (0.0 - 1.0)
   * @private
   */
  _darkenColor(color, factor) {
    // For CSS variables, wrap in calc() for runtime computation
    if (this._isCssVariable(color)) {
      // Return a CSS color-mix function for runtime computation
      const percentage = Math.round(factor * 100);
      return `color-mix(in srgb, ${color} ${100 - percentage}%, black ${percentage}%)`;
    }

    // For direct hex/rgb values, compute now
    const rgb = this._parseColor(color);
    if (!rgb) return color;

    return this._rgbToHex(
      Math.round(rgb.r * (1 - factor)),
      Math.round(rgb.g * (1 - factor)),
      Math.round(rgb.b * (1 - factor))
    );
  }

  /**
   * Lighten a color by a factor (0.0 - 1.0)
   * @private
   */
  _lightenColor(color, factor) {
    // For CSS variables, wrap in calc() for runtime computation
    if (this._isCssVariable(color)) {
      const percentage = Math.round(factor * 100);
      return `color-mix(in srgb, ${color} ${100 - percentage}%, white ${percentage}%)`;
    }

    // For direct hex/rgb values, compute now
    const rgb = this._parseColor(color);
    if (!rgb) return color;

    return this._rgbToHex(
      Math.round(rgb.r + (255 - rgb.r) * factor),
      Math.round(rgb.g + (255 - rgb.g) * factor),
      Math.round(rgb.b + (255 - rgb.b) * factor)
    );
  }

  /**
   * Set alpha channel of a color
   * @private
   */
  _setAlpha(color, alpha) {
    // For CSS variables, use rgba() or color-mix
    if (this._isCssVariable(color)) {
      return `color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`;
    }

    // For direct hex/rgb values, compute now
    const rgb = this._parseColor(color);
    if (!rgb) return color;

    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  /**
   * Saturate color (increase saturation)
   * @private
   */
  _saturateColor(color, factor) {
    // For CSS variables, this is complex - may need browser-side computation
    // For now, return as-is with warning
    if (this._isCssVariable(color)) {
      cblcarsLog.warn('[ThemeTokenResolver] saturate() with CSS variables requires browser-side computation');
      return color;
    }

    // Convert to HSL, adjust saturation, convert back
    const hsl = this._rgbToHsl(this._parseColor(color));
    hsl.s = Math.min(1, hsl.s + factor);
    return this._hslToRgbHex(hsl);
  }

  /**
   * Desaturate color (decrease saturation)
   * @private
   */
  _desaturateColor(color, factor) {
    if (this._isCssVariable(color)) {
      cblcarsLog.warn('[ThemeTokenResolver] desaturate() with CSS variables requires browser-side computation');
      return color;
    }

    const hsl = this._rgbToHsl(this._parseColor(color));
    hsl.s = Math.max(0, hsl.s - factor);
    return this._hslToRgbHex(hsl);
  }

  /**
   * Parse color string to RGB object
   * @private
   */
  _parseColor(color) {
    if (!color) return null;

    // Hex format: #RRGGBB or #RGB
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16)
        };
      } else if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16)
        };
      }
    }

    // RGB format: rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3])
      };
    }

    return null;
  }

  /**
   * Convert RGB to hex string
   * @private
   */
  _rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  /**
   * Convert RGB to HSL
   * @private
   */
  _rgbToHsl({ r, g, b }) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h, s, l };
  }

  /**
   * Convert HSL to RGB hex
   * @private
   */
  _hslToRgbHex({ h, s, l }) {
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return this._rgbToHex(
      Math.round(r * 255),
      Math.round(g * 255),
      Math.round(b * 255)
    );
  }

  /**
   * Check if value is a direct color
   * @private
   */
  _isDirectColor(value) {
    return typeof value === 'string' && (
      value.startsWith('#') ||
      value.startsWith('rgb(') ||
      value.startsWith('rgba(') ||
      value.startsWith('hsl(') ||
      value.startsWith('hsla(')
    );
  }

  /**
   * Check if value is numeric
   * @private
   */
  _isNumeric(value) {
    if (typeof value === 'number') return true;
    if (typeof value === 'string') {
      return !isNaN(parseFloat(value)) && isFinite(value);
    }
    return false;
  }

  /**
   * Check if string is a token reference
   * @private
   */
  _isTokenReference(value) {
    return typeof value === 'string' && (
      value.startsWith('colors.') ||
      value.startsWith('typography.') ||
      value.startsWith('spacing.') ||
      value.startsWith('borders.') ||
      value.startsWith('effects.') ||
      value.startsWith('animations.') ||
      value.startsWith('components.')
    );
  }

  /**
   * Check if token value is responsive (object with breakpoints)
   * @private
   */
  _isResponsiveToken(value) {
    return value && typeof value === 'object' && (
      'small' in value || 'medium' in value || 'large' in value
    );
  }

  /**
   * Resolve responsive token based on viewBox width
   * @private
   */
  _resolveResponsiveValue(value, viewBoxWidth) {
    if (viewBoxWidth < 400 && 'small' in value) {
      return value.small;
    } else if (viewBoxWidth < 800 && 'medium' in value) {
      return value.medium;
    } else if ('large' in value) {
      return value.large;
    }

    // Fallback to first available value
    return value.small || value.medium || value.large;
  }

  /**
   * Resolve multiple token paths
   * @param {Object} paths - Object with keys and token paths
   * @param {Object} context - Optional context
   * @returns {Object} Resolved values
   */
  resolveMany(paths, context = {}) {
    const resolved = {};
    for (const [key, path] of Object.entries(paths)) {
      resolved[key] = this.resolve(path, null, context);
    }
    return resolved;
  }

  /**
   * Get all tokens for a component type
   * @param {string} componentType - Component type (e.g., 'text', 'chart')
   * @param {Object} context - Optional context
   * @returns {Object} Resolved component tokens
   */
  getComponentTokens(componentType, context = {}) {
    const componentPath = `components.${componentType}`;
    const componentTokens = this.resolve(componentPath, {}, context);

    // Resolve all nested token references
    const resolved = {};
    for (const [key, value] of Object.entries(componentTokens)) {
      resolved[key] = this.resolve(value, null, context);
    }

    return resolved;
  }

  /**
   * Create a scoped resolver for a component
   * @param {string} componentType - Component type
   * @returns {Function} Scoped resolve function
   */
  forComponent(componentType) {
    return (tokenPath, fallback = null, context = {}) => {
      // Try component-specific token first
      const componentToken = this.resolve(`components.${componentType}.${tokenPath}`, null, context);
      if (componentToken !== null) {
        return componentToken;
      }

      // Fall back to global token
      return this.resolve(tokenPath, fallback, context);
    };
  }

  /**
   * Clear computed token cache
   */
  clearCache() {
    this.computedCache.clear();
  }
}

// Singleton instance (will be initialized with theme tokens)
export let themeTokenResolver = null;

/**
 * Initialize the global token resolver with theme tokens
 * @param {Object} tokens - Theme token definitions
 */
export function initializeTokenResolver(tokens) {
  themeTokenResolver = new ThemeTokenResolver(tokens);
  
  // Make available globally for debugging
  if (typeof window !== 'undefined') {
    window.cblcars = window.cblcars || {};
    window.cblcars.theme = window.cblcars.theme || {};
    window.cblcars.theme.resolver = themeTokenResolver;
  }
  
  return themeTokenResolver;
}
```

### B.2.4 Enhanced Theme Object (REVISED)

**Complete theme definition with CSS variable references:**

```javascript
// src/msd/themes/tokens/lcarsClassicTokens.js

/**
 * LCARS Classic Theme Tokens
 * TNG-era styling with CSS variable references
 */
export const lcarsClassicTokens = {
  colors: {
    accent: {
      primary: 'var(--lcars-orange, #FF9900)',
      secondary: 'var(--lcars-blue, #9999FF)',
      tertiary: 'var(--lcars-purple, #CC99CC)',
      
      // Computed variants
      primaryDark: 'darken(colors.accent.primary, 0.2)',
      primaryLight: 'lighten(colors.accent.primary, 0.2)',
      primaryMuted: 'alpha(colors.accent.primary, 0.6)'
    },
    
    status: {
      info: 'var(--lcars-blue, #9999FF)',
      success: 'var(--lcars-green, #99CC99)',
      warning: 'var(--lcars-orange, #FF9900)',
      danger: 'var(--lcars-red, #CC6666)',
      unknown: 'var(--lcars-gray, #999999)',
      
      // Alert intensity variants (computed)
      alert1: 'var(--lcars-yellow, #FFCC99)',    // Low priority
      alert2: 'colors.status.warning',            // Medium priority
      alert3: 'darken(colors.status.danger, 0.1)', // High priority - darker red
      alert4: 'saturate(colors.status.danger, 0.3)' // Critical - saturated red
    },
    
    ui: {
      background: 'var(--lcars-black, #000000)',
      foreground: 'var(--lcars-white, #FFFFFF)',
      border: 'var(--lcars-gray, #999999)',
      disabled: 'var(--lcars-dark-gray, #666666)',
      
      // Surface colors (computed)
      surface: 'alpha(colors.ui.foreground, 0.05)',
      surfaceHover: 'alpha(colors.ui.foreground, 0.1)',
      surfaceActive: 'alpha(colors.ui.foreground, 0.15)'
    },
    
    chart: {
      series: [
        'var(--lcars-orange, #FF9900)',
        'var(--lcars-blue, #9999FF)',
        'var(--lcars-yellow, #FFCC99)',
        'var(--lcars-purple, #CC99CC)',
        'var(--lcars-green, #99CC99)',
        'var(--lcars-red, #CC6666)'
      ],
      grid: 'var(--lcars-gray, #999999)',
      axis: 'var(--lcars-white, #FFFFFF)',
      gridMuted: 'alpha(colors.chart.grid, 0.3)'
    }
  },
  
  typography: {
    fontFamily: {
      primary: 'var(--lcars-font-family, Antonio, Helvetica Neue, sans-serif)',
      monospace: 'var(--lcars-font-monospace, Courier New, monospace)'
    },
    
    // Responsive font sizes (viewBox-aware)
    fontSize: {
      xs: 10,
      sm: 12,
      base: {
        small: 12,   // viewBox width < 400
        medium: 14,  // viewBox width 400-800
        large: 16    // viewBox width > 800
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
      '10': 20
    },
    
    gap: {
      none: 0,
      xs: 1,
      sm: 2,
      base: 4,
      lg: 8
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
      xl: 12
    }
  },
  
  effects: {
    opacity: {
      disabled: 0.4,
      muted: 0.6,
      base: 1.0
    },
    
    shadow: {
      accent: '0 0 8px var(--lcars-orange, #FF9900)',
      danger: '0 0 8px var(--lcars-red, #CC6666)'
    },
    
    glow: {
      accent: '0 0 8px var(--lcars-orange, #FF9900)',
      accentStrong: '0 0 16px var(--lcars-orange, #FF9900)',
      danger: '0 0 8px var(--lcars-red, #CC6666)'
    }
  },
  
  animations: {
    duration: {
      fast: 200,
      base: 350,
      slow: 500
    },
    
    easing: {
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
      
      // Status-specific colors
      statusOnColor: 'colors.status.success',
      statusOffColor: 'colors.status.unknown',
      statusUnavailableColor: 'colors.status.danger'
    },
    
    chart: {
      defaultColors: 'colors.chart.series',
      defaultStrokeWidth: 'borders.width.thick',
      gridColor: 'colors.chart.gridMuted'
    }
  }
};
```

### B.2.5 Pack Structure with Token System (REVISED)

**Remove palettes, add token-based themes:**

```javascript
// src/msd/packs/loadBuiltinPacks.js (REVISED)

import { lcarsClassicTokens } from '../themes/tokens/lcarsClassicTokens.js';
import { lcarsDs9Tokens } from '../themes/tokens/lcarsDs9Tokens.js';
import { lcarsVoyagerTokens } from '../themes/tokens/lcarsVoyagerTokens.js';
import { lcarsHighContrastTokens } from '../themes/tokens/lcarsHighContrastTokens.js';

const builtinPack = {
  id: 'builtin',
  version: '1.0.0',
  
  // Existing properties
  profiles: [ /* ... */ ],
  overlays: [ /* ... */ ],
  anchors: { /* ... */ },
  routing: { /* ... */ },
  
  // Chart templates (from Appendix A)
  chartTemplates: { /* ... */ },
  
  // Animation presets (from Appendix A)
  chartAnimationPresets: { /* ... */ },
  
  // NEW: Token-based themes (with CSS variable references)
  themes: {
    'lcars-classic': {
      id: 'lcars-classic',
      name: 'LCARS Classic',
      description: 'Classic TNG-era LCARS styling',
      tokens: lcarsClassicTokens,
      cssFile: 'apexcharts-lcars-classic.css'
    },
    
    'lcars-ds9': {
      id: 'lcars-ds9',
      name: 'LCARS DS9',
      description: 'Deep Space Nine LCARS variant',
      tokens: lcarsDs9Tokens,
      cssFile: 'apexcharts-lcars-ds9.css'
    },
    
    'lcars-voyager': {
      id: 'lcars-voyager',
      name: 'LCARS Voyager',
      description: 'Voyager LCARS styling',
      tokens: lcarsVoyagerTokens,
      cssFile: 'apexcharts-lcars-voyager.css'
    },
    
    'lcars-high-contrast': {
      id: 'lcars-high-contrast',
      name: 'LCARS High Contrast',
      description: 'Accessibility-focused high contrast theme',
      tokens: lcarsHighContrastTokens,
      cssFile: 'apexcharts-lcars-high-contrast.css'
    }
  },
  
  // Default theme
  defaultTheme: 'lcars-classic',
  
  // ❌ REMOVED: palettes (unused, dead code)
  // palettes: { ... }  // DELETE THIS
};

export function loadBuiltinPacks(requested = ['core', 'cb_lcars_buttons']) {
  // ... (existing implementation)
}
```

---

## B.3 Advanced Features (ENHANCED)

### B.3.1 Responsive Tokens (ViewBox-Aware)

**Concept:** Tokens that adapt to viewBox size for optimal readability.

#### Use Case 1: Font Size Scaling

```javascript
// Token definition with responsive breakpoints
fontSize: {
  base: {
    small: 12,   // viewBox width < 400
    medium: 14,  // viewBox width 400-800
    large: 16    // viewBox width > 800
  },
  title: {
    small: 18,
    medium: 24,
    large: 32
  }
}

// Resolution with viewBox context
const resolveToken = themeTokenResolver.forComponent('text');
const fontSize = resolveToken(
  'typography.fontSize.base',
  14,
  { viewBoxWidth: 600 }  // Context provided by renderer
);
// Returns 14 (medium breakpoint)
```

#### Use Case 2: Spacing Adaptation

```javascript
// Responsive spacing for different viewBox sizes
spacing: {
  cellGap: {
    small: 1,   // Tight spacing for small viewBox
    medium: 2,  // Normal spacing
    large: 4    // Generous spacing for large viewBox
  }
}
```

#### Integration with Existing ViewBox Scaling

**Connection to MsdDefaultsManager:**

The responsive token system complements the existing viewBox scaling in `MsdDefaultsManager`. Here's how they work together:

```javascript
// MsdDefaultsManager handles physical measurement scaling
// (e.g., converting 8px padding to viewBox-relative value)

const resolvedPadding = defaultsManager.resolve(
  'text.padding',
  { viewBox: [0, 0, 400, 300] }
);
// Returns viewBox-scaled physical measurement

// ThemeTokenResolver handles semantic token scaling
// (e.g., choosing appropriate font size for viewBox width)

const resolvedFontSize = themeTokenResolver.resolve(
  'typography.fontSize.base',
  14,
  { viewBoxWidth: 400 }
);
// Returns semantically appropriate size (small/medium/large)
```

**Key Distinction:**
- **DefaultsManager**: Scales physical measurements (padding, margins) to viewBox coordinates
- **ThemeTokenResolver**: Selects semantic values (font sizes, colors) based on viewBox size

**Combined Example:**

```javascript
// In TextOverlayRenderer

// Get viewBox-scaled padding (physical measurement)
const padding = defaultsManager.resolve(
  'text.padding',
  { viewBox: resolvedModel.viewBox }
);

// Get responsive font size (semantic value)
const fontSize = themeTokenResolver.resolve(
  'typography.fontSize.base',
  14,
  { viewBoxWidth: resolvedModel.viewBox[2] }
);

// Both work together for optimal rendering
```

### B.3.2 Computed Tokens (ENHANCED)

**Concept:** Tokens derived from other tokens using color manipulation functions.

#### Color Manipulation Functions

```javascript
// Available computed functions:
'darken(colors.accent.primary, 0.2)'      // Darken by 20%
'lighten(colors.accent.primary, 0.3)'     // Lighten by 30%
'alpha(colors.accent.primary, 0.5)'       // Set alpha to 50%
'saturate(colors.accent.primary, 0.2)'    // Increase saturation
'desaturate(colors.accent.primary, 0.1)'  // Decrease saturation
```

#### Use Case 1: Alert Intensity Levels

**Problem:** Need progressive visual intensity for alert levels.

**Solution:** Computed tokens for alert variants:

```javascript
status: {
  danger: 'var(--lcars-red, #CC6666)',
  
  // Alert levels (computed from danger)
  alert1: 'var(--lcars-yellow, #FFCC99)',           // Low - different base color
  alert2: 'colors.status.warning',                   // Medium - warning color
  alert3: 'darken(colors.status.danger, 0.1)',      // High - darker danger
  alert4: 'saturate(colors.status.danger, 0.3)'     // Critical - saturated danger
}
```

**YAML Usage:**

```yaml
overlays:
  - id: alert_indicator
    type: text
    content: "{{ alert_level }}"
    style:
      # Color changes based on alert level
      color: "colors.status.alert{{ alert_level }}"
```

**Result:** Automatic color progression as alert level increases.

#### Use Case 2: Hover States

**Problem:** Need subtle hover effects without defining separate colors.

**Solution:** Computed hover variants:

```javascript
ui: {
  background: 'var(--lcars-black, #000000)',
  foreground: 'var(--lcars-white, #FFFFFF)',
  
  // Computed hover states
  surface: 'alpha(colors.ui.foreground, 0.05)',       // 5% white overlay
  surfaceHover: 'alpha(colors.ui.foreground, 0.1)',   // 10% white overlay
  surfaceActive: 'alpha(colors.ui.foreground, 0.15)'  // 15% white overlay
}
```

**CSS Usage:**

```css
.status-grid-cell {
  background: /* resolved from colors.ui.surface */;
}

.status-grid-cell:hover {
  background: /* resolved from colors.ui.surfaceHover */;
}
```

#### Use Case 3: Chart Series Variants

**Problem:** Need muted versions of chart colors for inactive series.

**Solution:** Computed opacity variants:

```javascript
chart: {
  series: [
    'var(--lcars-orange, #FF9900)',
    'var(--lcars-blue, #9999FF)',
    // ...
  ],
  
  // Computed muted variants for inactive series
  seriesMuted: [
    'alpha(colors.chart.series[0], 0.3)',
    'alpha(colors.chart.series[1], 0.3)',
    // ...
  ]
}
```

#### Use Case 4: Status Indicator Glow

**Problem:** Need glowing effects that match status colors.

**Solution:** Computed glow colors:

```javascript
effects: {
  glow: {
    accent: '0 0 8px var(--lcars-orange, #FF9900)',
    accentStrong: '0 0 16px var(--lcars-orange, #FF9900)',
    
    // Computed glows for any status color
    statusGlow: (statusColor) => `0 0 8px ${statusColor}`
  }
}
```

**Usage in Renderer:**

```javascript
// Generate glow effect from status color
const statusColor = resolveToken('colors.status.danger');
const glowEffect = `0 0 8px ${statusColor}`;

// Or use computed token
const glowEffect = resolveToken('effects.glow.danger');
```

#### Use Case 5: Disabled State Colors

**Problem:** Need consistent disabled appearance across all components.

**Solution:** Computed disabled variants:

```javascript
components: {
  button: {
    defaultColor: 'colors.accent.primary',
    disabledColor: 'desaturate(colors.accent.primary, 0.5)',  // Grayed out
    disabledOpacity: 'effects.opacity.disabled'
  },
  
  text: {
    defaultColor: 'colors.ui.foreground',
    disabledColor: 'alpha(colors.ui.foreground, 0.4)'  // Semi-transparent
  }
}
```

#### Computed Token Performance

**Caching Strategy:**

```javascript
// ThemeTokenResolver caches computed results
this.computedCache = new Map();

// Cache key includes expression + context
const cacheKey = `${expr}|${JSON.stringify(context)}`;

// Check cache before computing
if (this.computedCache.has(cacheKey)) {
  return this.computedCache.get(cacheKey);
}

// Compute and cache
const result = this._computeColorFunction(expr);
this.computedCache.set(cacheKey, result);
return result;
```

**CSS Variable Handling:**

For CSS variables in computed tokens, use modern CSS functions:

```javascript
// For CSS variables, use color-mix() for runtime computation
'darken(var(--lcars-orange), 0.2)'

// Resolves to:
'color-mix(in srgb, var(--lcars-orange) 80%, black 20%)'

// Browser computes at runtime, supporting theme changes
```

### B.3.3 Theme Variants (Future Enhancement)

**Concept:** Light/dark variants of same theme (deferred to future work).

---

## B.4 Component Token Integration (REVISED)

### B.4.1 Text Overlay Example

```javascript
// src/msd/renderer/TextOverlayRenderer.js (enhanced)

import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';

export class TextOverlayRenderer {
  static render(overlay, anchors, viewBox, container, cardInstance) {
    const style = overlay.finalStyle || overlay.style || {};
    
    // Create component-scoped resolver
    const resolveToken = themeTokenResolver.forComponent('text');
    
    // Resolve color with CSS variable support
    const color = resolveToken(
      style.color || 'defaultColor',
      'var(--lcars-white, #FFFFFF)'  // Final fallback with CSS variable
    );
    // Result: 'var(--lcars-orange, #FF9900)' or computed value
    
    // Resolve responsive font size with viewBox context
    const fontSize = resolveToken(
      style.font_size || 'defaultSize',
      14,
      { viewBoxWidth: viewBox[2] }  // Pass viewBox width for responsive tokens
    );
    // Result: 12, 14, or 16 depending on viewBox width
    
    // Resolve font family (CSS variable)
    const fontFamily = resolveToken(
      style.font_family || 'defaultFamily',
      'Antonio'
    );
    // Result: 'var(--lcars-font-family, Antonio, Helvetica Neue, sans-serif)'
    
    // ... render with resolved tokens
    
    const markup = `
      <text 
        fill="${color}"
        font-size="${fontSize}"
        font-family="${fontFamily}"
        ...
      >
        ${content}
      </text>
    `;
    
    return { markup, actionInfo, overlayId };
  }
}
```

### B.4.2 Status Grid Example with Alert States

```javascript
// src/msd/renderer/StatusGridRenderer.js (enhanced)

import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';

export class StatusGridRenderer {
  static render(overlay, anchors, viewBox, container) {
    const style = overlay.finalStyle || overlay.style || {};
    
    // Create component-scoped resolver
    const resolveToken = themeTokenResolver.forComponent('statusGrid');
    
    // Resolve design tokens (all reference CSS variables)
    const cellColor = resolveToken(
      style.cell_color || 'defaultCellColor',
      'var(--lcars-blue, #9999FF)'
    );
    
    const cellGap = resolveToken(
      style.cell_gap || 'defaultGap',
      2,
      { viewBoxWidth: viewBox[2] }  // Responsive gap
    );
    
    const cellRadius = resolveToken(
      style.cell_radius || 'defaultRadius',
      4
    );
    
    // Resolve status colors (CSS variables + computed variants)
    const statusColors = {
      on: resolveToken('statusOnColor', 'var(--lcars-green, #99CC99)'),
      off: resolveToken('statusOffColor', 'var(--lcars-gray, #999999)'),
      unavailable: resolveToken('statusUnavailableColor', 'var(--lcars-red, #CC6666)'),
      
      // Alert levels (computed)
      alert1: resolveToken('colors.status.alert1', 'var(--lcars-yellow, #FFCC99)'),
      alert2: resolveToken('colors.status.alert2', 'var(--lcars-orange, #FF9900)'),
      alert3: resolveToken('colors.status.alert3'),  // Computed darker red
      alert4: resolveToken('colors.status.alert4')   // Computed saturated red
    };
    
    // ... render with resolved tokens
  }
}
```

### B.4.3 ApexCharts Example

```javascript
// src/msd/charts/ApexChartsAdapter.js (enhanced)

import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';

export class ApexChartsAdapter {
  static generateOptions(style, size, context = {}) {
    // Create component-scoped resolver
    const resolveToken = themeTokenResolver.forComponent('chart');
    
    // Resolve chart colors (array of CSS variables)
    const colors = resolveToken(
      style.colors || 'defaultColors',
      [
        'var(--lcars-orange, #FF9900)',
        'var(--lcars-blue, #9999FF)',
        'var(--lcars-yellow, #FFCC99)'
      ]
    );
    // Result: ['var(--lcars-orange, #FF9900)', 'var(--lcars-blue, #9999FF)', ...]
    
    // Resolve stroke width
    const strokeWidth = resolveToken(
      style.stroke_width || 'defaultStrokeWidth',
      2
    );
    
    // Resolve grid color (muted with computed alpha)
    const gridColor = resolveToken(
      'gridColor',
      'var(--lcars-gray, #999999)'
    );
    // Result: 'alpha(var(--lcars-gray, #999999), 0.3)' → processed to CSS
    
    // Build options with resolved tokens
    const baseOptions = {
      colors: colors,
      stroke: {
        width: strokeWidth
      },
      grid: {
        borderColor: gridColor
      },
      // ...
    };
    
    return baseOptions;
  }
}
```

---

## B.5 Backwards Compatibility Strategy (REVISED)

### B.5.1 Palette Removal Plan

**Phase 1: Deprecation Notice**

```javascript
// src/msd/packs/PackManager.js (enhancement)

loadPack(pack) {
  // Warn about deprecated palettes
  if (pack.palettes) {
    cblcarsLog.warn(
      `[PackManager] Pack "${pack.id}" uses deprecated "palettes". ` +
      `Please migrate to "themes" with token system. ` +
      `Palettes will be removed in v2.0.`
    );
  }
  
  // ... rest of pack loading
}
```

**Phase 2: Automatic Migration Helper**

```javascript
// src/msd/themes/PaletteMigrator.js

/**
 * Migrate old palette format to new token format
 * Provides automatic migration path for users
 */
export class PaletteMigrator {
  /**
   * Convert old palette to token definitions
   */
  static migrateToTokens(oldPalette) {
    const tokens = {
      colors: {
        accent: {},
        status: {},
        ui: {}
      }
    };

    // Map old palette keys to new token paths
    const mapping = {
      'accent1': 'colors.accent.primary',
      'accent2': 'colors.accent.secondary',
      'danger': 'colors.status.danger',
      'info': 'colors.status.info',
      'success': 'colors.status.success',
      'warning': 'colors.status.warning'
    };

    for (const [oldKey, newPath] of Object.entries(mapping)) {
      if (oldPalette[oldKey]) {
        this._setTokenPath(tokens, newPath, oldPalette[oldKey]);
      }
    }

    return tokens;
  }

  static _setTokenPath(obj, path, value) {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Generate migration guide for user
   */
  static generateMigrationGuide(oldPalette) {
    const migrated = this.migrateToTokens(oldPalette);
    
    return {
      old: oldPalette,
      new: migrated,
      instructions: `
        Replace "palettes" with "themes" in your pack:
        
        OLD:
        palettes:
          my_palette:
            accent1: 'var(--lcars-orange)'
            danger: 'var(--lcars-red)'
        
        NEW:
        themes:
          my_theme:
            tokens:
              colors:
                accent:
                  primary: 'var(--lcars-orange)'
                status:
                  danger: 'var(--lcars-red)'
      `
    };
  }
}
```

**Phase 3: Complete Removal (v2.0)**

```javascript
// Remove palette support entirely
// Update all documentation to use tokens
// Remove PaletteMigrator (migration complete)
```

### B.5.2 CSS Variable Compatibility

**Existing configs continue to work:**

```yaml
# OLD: Direct CSS variable (still works)
overlays:
  - id: text1
    style:
      color: 'var(--lcars-orange)'  # ✅ Still works

# NEW: Token reference (recommended)
overlays:
  - id: text2
    style:
      color: 'colors.accent.primary'  # ✅ Better - uses theme
```

**ThemeTokenResolver handles both:**

```javascript
resolve(path, fallback) {
  // CSS variable → pass through
  if (path.includes('var(')) {
    return path;
  }
  
  // Token reference → resolve
  if (path.startsWith('colors.')) {
    return this._resolveTokenPath(path);
  }
  
  // Direct value → return as-is
  return path;
}
```

---

## B.6 Implementation Plan (REVISED)

### B.6.1 Phase 1: Foundation (Week 1)

**Deliverables:**