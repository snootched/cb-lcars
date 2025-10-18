# MSD Theme System - Complete Reference

This document provides complete documentation for the MSD theme system, including token structure, resolution, and customization.

## Table of Contents

1. [Overview](#overview)
2. [Theme Structure](#theme-structure)
3. [Token Categories](#token-categories)
4. [Token Resolution](#token-resolution)
5. [Component Defaults](#component-defaults)
6. [Theme Selection](#theme-selection)
7. [Custom Themes](#custom-themes)
8. [ThemeManager API](#thememanager-api)
9. [Migration Guide](#migration-guide)

---

## Overview

The MSD theme system provides a unified approach to styling and defaults through a token-based architecture. Themes define all component defaults, color schemes, typography, and spacing in a hierarchical structure that supports token references and computed values.

### **Key Features:**
- ✅ **Token-based defaults** - All values defined in theme tokens
- ✅ **Token references** - Tokens can reference other tokens
- ✅ **Component scoping** - Dedicated defaults for each overlay type
- ✅ **Multiple themes** - Built-in themes + custom theme support
- ✅ **Hot-swappable** - Change entire look with one setting
- ✅ **Type-safe** - Schema validation for theme tokens

---

## Theme Structure

### Complete Theme Definition

```javascript
const theme = {
  // Theme metadata
  id: 'lcars-classic',
  name: 'LCARS Classic',
  description: 'Classic TNG-era LCARS styling',

  // Optional: Custom ApexCharts CSS
  cssFile: 'apexcharts-lcars-classic.css',

  // Theme tokens (all values)
  tokens: {
    // Base design tokens
    colors: { /* ... */ },
    typography: { /* ... */ },
    spacing: { /* ... */ },
    borders: { /* ... */ },
    effects: { /* ... */ },
    animations: { /* ... */ },

    // Component-specific defaults
    components: {
      text: { /* ... */ },
      statusGrid: { /* ... */ },
      sparkline: { /* ... */ },
      button: { /* ... */ },
      line: { /* ... */ },
      chart: { /* ... */ }
    }
  }
};
```

---

## Token Categories

### 1. Colors (`colors.*`)

Color palette definitions supporting CSS variables and token references:

```javascript
colors: {
  // Primary accent colors
  accent: {
    primary: 'var(--lcars-orange, #FF9900)',
    secondary: 'var(--lcars-blue, #9999FF)',
    tertiary: 'var(--lcars-purple, #CC99CC)',

    // Computed variants (using color manipulation)
    primaryDark: 'darken(colors.accent.primary, 0.2)',
    primaryLight: 'lighten(colors.accent.primary, 0.2)',
    primaryMuted: 'alpha(colors.accent.primary, 0.6)'
  },

  // Semantic status colors
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
    disabled: 'var(--lcars-dark-gray, #666666)',

    // Computed surface colors
    surface: 'alpha(colors.ui.foreground, 0.05)',
    surfaceHover: 'alpha(colors.ui.foreground, 0.1)'
  },

  // Chart-specific colors
  chart: {
    series: [
      'var(--lcars-orange, #FF9900)',
      'var(--lcars-blue, #9999FF)',
      'var(--lcars-yellow, #FFCC99)'
    ],
    grid: 'var(--lcars-gray, #999999)',
    axis: 'var(--lcars-white, #FFFFFF)'
  }
}
```

**Supported Color Functions:**
- `darken(color, amount)` - Darken color by percentage
- `lighten(color, amount)` - Lighten color by percentage
- `saturate(color, amount)` - Increase saturation
- `desaturate(color, amount)` - Decrease saturation
- `alpha(color, opacity)` - Set opacity
- `mix(color1, color2, weight)` - Mix two colors

### 2. Typography (`typography.*`)

Font and text styling tokens:

```javascript
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
}
```

### 3. Spacing (`spacing.*`)

Spacing scales and gaps:

```javascript
spacing: {
  // Numeric scale
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

  // Named gaps
  gap: {
    none: 0,
    xs: 1,
    sm: 2,
    base: 4,
    lg: 8,
    xl: 12
  }
}
```

### 4. Borders (`borders.*`)

Border widths, radii, and styles:

```javascript
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
}
```

### 5. Effects (`effects.*`)

Visual effects (opacity, shadows, blur, glow):

```javascript
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
    danger: '0 0 8px var(--lcars-red, #CC6666)'
  }
}
```

### 6. Animations (`animations.*`)

Animation timing and easing:

```javascript
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
}
```

---

## Token Resolution

### How Token References Work

Tokens can reference other tokens using dot notation:

```javascript
// Theme definition
{
  spacing: {
    gap: { base: 4 }
  },
  components: {
    statusGrid: {
      cellGap: 'spacing.gap.base'  // Token reference
    }
  }
}

// At runtime
ThemeManager.getDefault('statusGrid', 'cellGap', 2)
// 1. Looks up components.statusGrid.cellGap
// 2. Finds 'spacing.gap.base'
// 3. Resolves spacing.gap.base → 4
// 4. Returns 4
```

### Resolution Process

```
User requests value
        ↓
ThemeManager.getDefault('statusGrid', 'cellGap', fallback)
        ↓
1. Build full path: components.statusGrid.cellGap
        ↓
2. Look up in active theme tokens
        ↓
3. Value found: 'spacing.gap.base'
        ↓
4. Check if token reference (starts with known category)
        ↓
5. Recursively resolve: spacing.gap.base → 4
        ↓
6. Return resolved value: 4
```

### Computed Token Values

Some tokens use functions for computed values:

```javascript
{
  colors: {
    accent: {
      primary: 'var(--lcars-orange, #FF9900)',
      primaryDark: 'darken(colors.accent.primary, 0.2)',  // Computed
      primaryMuted: 'alpha(colors.accent.primary, 0.6)'   // Computed
    }
  }
}

// Resolution
ThemeManager.getDefault('colors', 'accent.primaryDark', '#000')
// → Resolves colors.accent.primary → '#FF9900'
// → Applies darken() function → '#CC7700'
// → Returns '#CC7700'
```

---

## Component Defaults

Each overlay type has dedicated component defaults in `components.*`:

### Text Component (`components.text.*`)

```javascript
components: {
  text: {
    // Core defaults
    defaultSize: 'typography.fontSize.base',     // Token ref
    defaultColor: 'colors.ui.foreground',         // Token ref
    defaultFamily: 'typography.fontFamily.primary', // Token ref
    defaultLineHeight: 'typography.lineHeight.normal',

    // Status indicators
    statusIndicator: {
      sizeRatio: 0.3,
      padding: 8,
      color: 'colors.status.success'
    },

    // Highlighting
    highlight: {
      padding: 2,
      opacity: 0.3
    },

    // Brackets (LCARS-style decorations)
    bracket: {
      width: 'borders.width.base',
      gap: 'spacing.gap.base',
      extension: 8,
      opacity: 'effects.opacity.base',
      radius: 'borders.radius.base'
    }
  }
}
```

### Status Grid Component (`components.statusGrid.*`)

```javascript
components: {
  statusGrid: {
    // Grid layout
    rows: 3,
    columns: 4,
    cellGap: 'spacing.gap.sm',
    cellOpacity: 'effects.opacity.base',

    // Colors
    defaultCellColor: 'colors.accent.primary',
    borderColor: 'colors.ui.border',
    labelColor: 'colors.ui.foreground',
    valueColor: 'colors.ui.foreground',
    statusOnColor: 'colors.status.success',
    statusOffColor: 'colors.status.unknown',

    // Typography
    fontSize: 'typography.fontSize.sm',
    labelFontSize: 'typography.fontSize.lg',
    valueFontSize: 'typography.fontSize.base',
    fontFamily: 'typography.fontFamily.primary',
    fontWeight: 'typography.fontWeight.normal',

    // Spacing
    textPadding: 'spacing.scale.4',
    textMargin: 'spacing.scale.1',

    // Layout
    textLayout: 'stacked',
    textAlignment: 'center',
    labelPosition: 'center-top',
    valuePosition: 'center-bottom'
  }
}
```

### Sparkline Component (`components.sparkline.*`)

```javascript
components: {
  sparkline: {
    // Core styles
    defaultColor: 'colors.accent.primary',
    defaultStrokeWidth: 'borders.width.base',
    opacity: 'effects.opacity.base',

    // Size
    size: {
      width: 200,
      height: 60
    },

    // Line styles
    lineCap: 'round',
    lineJoin: 'round',
    fillOpacity: 0.2,

    // Grid
    grid: {
      color: 'colors.chart.grid',
      opacity: 0.4,
      strokeWidth: 'borders.width.thin'
    },

    // Smoothing
    smoothing: {
      chaikinIterations: 2,
      bezierControlFactor: 0.5
    }
  }
}
```

---

## Theme Selection

### Default Theme

The system uses `lcars-classic` as the default theme if none is specified:

```yaml
# No theme specified - uses default
msd:
  overlays: [...]
```

### Explicit Theme Selection

```yaml
# Select specific theme
msd:
  theme: "lcars-ds9"
  overlays: [...]
```

### Available Built-in Themes

| Theme ID | Name | Description |
|----------|------|-------------|
| `lcars-classic` | LCARS Classic | TNG-era LCARS (default) |
| `lcars-ds9` | LCARS DS9 | Deep Space Nine variant |
| `lcars-voyager` | LCARS Voyager | Voyager styling |
| `lcars-high-contrast` | LCARS High Contrast | Accessibility-focused |

---

## Custom Themes

### Creating a Custom Theme

Create an external pack with theme definition:

```json
{
  "id": "my_themes",
  "version": "1.0.0",
  "themes": {
    "my-custom-theme": {
      "id": "my-custom-theme",
      "name": "My Custom Theme",
      "description": "Custom LCARS styling",
      "tokens": {
        "colors": {
          "accent": {
            "primary": "#00ff00",
            "secondary": "#0088ff"
          },
          "status": {
            "success": "#00ff00",
            "warning": "#ffaa00",
            "danger": "#ff0000"
          },
          "ui": {
            "foreground": "#ffffff",
            "background": "#000000"
          }
        },
        "typography": {
          "fontSize": {
            "base": 14,
            "lg": 18
          },
          "fontFamily": {
            "primary": "Helvetica, sans-serif"
          }
        },
        "spacing": {
          "gap": {
            "base": 6
          }
        },
        "components": {
          "statusGrid": {
            "cellGap": 'spacing.gap.base',
            "textPadding": 12,
            "rows": 4,
            "columns": 5
          },
          "text": {
            "defaultSize": 'typography.fontSize.base',
            "defaultColor": 'colors.ui.foreground'
          }
        }
      }
    }
  }
}
```

### Loading Custom Theme

```yaml
msd:
  theme: "my-custom-theme"
  use_packs:
    external:
      - url: "/local/my-themes.json"
  overlays: [...]
```

### Extending Existing Themes

You can create a theme that extends an existing theme (future feature):

```json
{
  "themes": {
    "my-extended-theme": {
      "extends": "lcars-classic",
      "tokens": {
        "colors": {
          "accent": {
            "primary": "#00ff00"  // Override just this
          }
        }
      }
    }
  }
}
```

---

## ThemeManager API

### JavaScript API

```javascript
// Get ThemeManager instance
const themeManager = window.cblcars.theme;

// Get active theme
const activeTheme = themeManager.getActiveTheme();
console.log(activeTheme.name); // "LCARS Classic"

// List all available themes
const themes = themeManager.listThemes();
console.log(themes); // ['lcars-classic', 'lcars-ds9', ...]

// Get component default
const value = themeManager.getDefault('statusGrid', 'cellGap', 2);
console.log(value); // 2 (from theme or fallback)

// Get all component defaults
const statusGridDefaults = themeManager.getComponentDefaults('statusGrid');
console.log(statusGridDefaults); // { rows: 3, columns: 4, ... }

// Check if initialized
const ready = themeManager.initialized;
console.log(ready); // true/false

// Get raw tokens
const tokens = themeManager.tokens;
console.log(tokens.colors.accent.primary); // 'var(--lcars-orange)'
```

### Renderer Integration

Renderers use the `_getDefault()` helper method:

```javascript
class StatusGridRenderer {
  _getDefault(path, fallback) {
    const themeManager = this._resolveThemeManager();

    if (!themeManager || !themeManager.initialized) {
      return fallback;
    }

    // Convert path: 'statusGrid.cellGap'
    // → components.statusGrid.cellGap
    const pathParts = path.split('.');
    const componentType = pathParts[0];
    const property = pathParts.slice(1).join('.');

    try {
      const value = themeManager.getDefault(componentType, property, fallback);
      return value !== null ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }
}
```

---

## Migration Guide

### From Old System (Profiles/Defaults Manager)

**Old way:**
```yaml
profiles:
  - id: my_defaults
    defaults:
      status_grid:
        text_padding: 12
        cell_radius: 8
```

**New way:**
```json
{
  "themes": {
    "my-theme": {
      "tokens": {
        "components": {
          "statusGrid": {
            "textPadding": 12,
            "cellRadius": 8
          }
        }
      }
    }
  }
}
```

### Key Differences

| Old System | New System |
|------------|------------|
| Multiple layers (profile, pack, theme, builtin) | Single layer (theme) |
| Snake_case paths (`status_grid.text_padding`) | camelCase paths (`statusGrid.textPadding`) |
| `DefaultsManager.resolve()` | `ThemeManager.getDefault()` |
| Pack profiles | Theme tokens |
| No token references | Full token reference support |

### Migration Steps

1. **Identify old defaults** in pack profiles
2. **Create theme tokens** with component defaults
3. **Convert snake_case** to camelCase
4. **Add token references** where appropriate
5. **Test with renderers** to verify values resolve correctly

---

## Best Practices

### 1. Use Token References

✅ **Good:**
```javascript
components: {
  statusGrid: {
    cellGap: 'spacing.gap.sm',         // Token reference
    textPadding: 'spacing.scale.4'     // Token reference
  }
}
```

❌ **Bad:**
```javascript
components: {
  statusGrid: {
    cellGap: 2,                         // Hardcoded
    textPadding: 8                      // Hardcoded
  }
}
```

### 2. Organize by Category

Keep base tokens separate from component tokens:

```javascript
{
  // Base tokens (reusable)
  colors: { ... },
  spacing: { ... },

  // Component tokens (specific)
  components: {
    statusGrid: { ... }
  }
}
```

### 3. Use Semantic Names

✅ **Good:**
```javascript
colors: {
  status: {
    success: 'var(--lcars-green)',
    warning: 'var(--lcars-yellow)'
  }
}
```

❌ **Bad:**
```javascript
colors: {
  green: '#00ff00',
  yellow: '#ffff00'
}
```

### 4. Provide CSS Variable Fallbacks

✅ **Good:**
```javascript
colors: {
  accent: {
    primary: 'var(--lcars-orange, #FF9900)'  // Has fallback
  }
}
```

❌ **Bad:**
```javascript
colors: {
  accent: {
    primary: 'var(--lcars-orange)'  // No fallback
  }
}
```

---

## Troubleshooting

### Theme Not Loading

```javascript
// Check if theme is registered
const themes = window.cblcars.theme.listThemes();
console.log('Available themes:', themes);

// Check if theme is active
const active = window.cblcars.theme.getActiveTheme();
console.log('Active theme:', active);
```

### Default Not Resolving

```javascript
// Check component default
const value = window.cblcars.theme.getDefault('statusGrid', 'cellGap', -1);
console.log('Resolved value:', value);

// If -1, check token structure
console.log('Tokens:', window.cblcars.theme.tokens.components.statusGrid);
```

### Token Reference Not Resolving

```javascript
// Check if token exists
console.log('Token path:', window.cblcars.theme.tokens.spacing.gap.sm);

// Check for typos in reference
// Correct: 'spacing.gap.sm'
// Wrong: 'spacing.gaps.sm', 'spacing.gap.small'
```

---

This comprehensive theme system provides the foundation for consistent, maintainable, and powerful styling across all MSD overlays! 🎨✨