# MSD Theme Token Reference Card

Quick reference for all available theme tokens in the MSD system.

## 📋 Quick Navigation

- [Colors](#colors-tokens) - Color palette
- [Typography](#typography-tokens) - Font settings
- [Spacing](#spacing-tokens) - Gaps and padding
- [Borders](#borders-tokens) - Widths and radii
- [Effects](#effects-tokens) - Visual effects
- [Animations](#animations-tokens) - Timing and easing
- [Components](#components-tokens) - Component defaults

---

## Colors Tokens

### `colors.accent.*`
Primary accent colors for UI elements.

| Token | Type | Example | Description |
|-------|------|---------|-------------|
| `colors.accent.primary` | color | `#FF9900` | Main accent color |
| `colors.accent.secondary` | color | `#9999FF` | Secondary accent |
| `colors.accent.tertiary` | color | `#CC99CC` | Tertiary accent |

**Computed variants:**
- `colors.accent.primaryDark` - Darkened primary
- `colors.accent.primaryLight` - Lightened primary
- `colors.accent.primaryMuted` - Transparent primary

---

### `colors.status.*`
Semantic status colors.

| Token | Type | Default | Use Case |
|-------|------|---------|----------|
| `colors.status.success` | color | `#99CC99` | Success states |
| `colors.status.warning` | color | `#FF9900` | Warning states |
| `colors.status.danger` | color | `#CC6666` | Error/danger states |
| `colors.status.info` | color | `#9999FF` | Information |
| `colors.status.unknown` | color | `#999999` | Unknown/unavailable |

---

### `colors.ui.*`
Core UI element colors.

| Token | Type | Default | Description |
|-------|------|---------|-------------|
| `colors.ui.foreground` | color | `#FFFFFF` | Text/foreground |
| `colors.ui.background` | color | `#000000` | Background fill |
| `colors.ui.border` | color | `#999999` | Border color |
| `colors.ui.disabled` | color | `#666666` | Disabled state |
| `colors.ui.surface` | color | computed | Surface overlay |
| `colors.ui.surfaceHover` | color | computed | Hover surface |

---

### `colors.chart.*`
Chart-specific colors.

| Token | Type | Default | Description |
|-------|------|---------|-------------|
| `colors.chart.series` | array | `[...]` | Series color array |
| `colors.chart.grid` | color | `#999999` | Grid lines |
| `colors.chart.axis` | color | `#FFFFFF` | Axis lines/text |

---

## Typography Tokens

### `typography.fontSize.*`
Font size scale.

| Token | Type | Pixels | Use Case |
|-------|------|--------|----------|
| `typography.fontSize.xs` | number | 10 | Extra small text |
| `typography.fontSize.sm` | number | 12 | Small text |
| `typography.fontSize.base` | number | 16 | Base text size |
| `typography.fontSize.lg` | number | 18 | Large text |
| `typography.fontSize.xl` | number | 24 | Extra large |
| `typography.fontSize.2xl` | number | 32 | Display text |

**Responsive base sizes:**
```javascript
typography.fontSize.base: {
  small: 12,
  medium: 14,
  large: 16
}
```

---

### `typography.fontFamily.*`
Font family definitions.

| Token | Type | Default |
|-------|------|---------|
| `typography.fontFamily.primary` | string | `Antonio, Helvetica Neue, sans-serif` |
| `typography.fontFamily.monospace` | string | `Courier New, monospace` |

---

### `typography.fontWeight.*`
Font weight values.

| Token | Value |
|-------|-------|
| `typography.fontWeight.normal` | `normal` |
| `typography.fontWeight.bold` | `bold` |

---

### `typography.lineHeight.*`
Line height multipliers.

| Token | Value | Use Case |
|-------|-------|----------|
| `typography.lineHeight.tight` | 1.0 | Compact text |
| `typography.lineHeight.normal` | 1.2 | Default text |
| `typography.lineHeight.relaxed` | 1.5 | Spacious text |

---

### `typography.letterSpacing.*`
Letter spacing values.

| Token | Value |
|-------|-------|
| `typography.letterSpacing.tight` | `-0.05em` |
| `typography.letterSpacing.normal` | `0` |
| `typography.letterSpacing.wide` | `0.05em` |
| `typography.letterSpacing.wider` | `0.1em` |

---

## Spacing Tokens

### `spacing.scale.*`
Numeric spacing scale (pixels).

| Token | Pixels | Use Case |
|-------|--------|----------|
| `spacing.scale.0` | 0 | No spacing |
| `spacing.scale.1` | 2 | Tiny gap |
| `spacing.scale.2` | 4 | Small gap |
| `spacing.scale.3` | 6 | Medium-small |
| `spacing.scale.4` | 8 | Base spacing |
| `spacing.scale.6` | 12 | Medium |
| `spacing.scale.8` | 16 | Large |
| `spacing.scale.12` | 24 | Extra large |
| `spacing.scale.16` | 32 | Huge |

---

### `spacing.gap.*`
Named gap sizes.

| Token | Pixels | Use Case |
|-------|--------|----------|
| `spacing.gap.none` | 0 | No gap |
| `spacing.gap.xs` | 1 | Extra small |
| `spacing.gap.sm` | 2 | Small gap |
| `spacing.gap.base` | 4 | Base gap |
| `spacing.gap.lg` | 8 | Large gap |
| `spacing.gap.xl` | 12 | Extra large |

---

## Borders Tokens

### `borders.width.*`
Border thickness values.

| Token | Pixels | Use Case |
|-------|--------|----------|
| `borders.width.none` | 0 | No border |
| `borders.width.thin` | 1 | Thin border |
| `borders.width.base` | 2 | Standard border |
| `borders.width.thick` | 3 | Thick border |

---

### `borders.radius.*`
Corner radius values.

| Token | Pixels | Use Case |
|-------|--------|----------|
| `borders.radius.none` | 0 | Square corners |
| `borders.radius.sm` | 2 | Subtle rounding |
| `borders.radius.base` | 4 | Standard rounding |
| `borders.radius.lg` | 8 | Large rounding |
| `borders.radius.xl` | 12 | Extra large |
| `borders.radius.full` | 9999 | Pill shape |

---

### `borders.style.*`
Border style values.

| Token | CSS Value |
|-------|-----------|
| `borders.style.solid` | `solid` |
| `borders.style.dashed` | `dashed` |
| `borders.style.dotted` | `dotted` |

---

## Effects Tokens

### `effects.opacity.*`
Opacity values (0-1).

| Token | Value | Use Case |
|-------|-------|----------|
| `effects.opacity.disabled` | 0.4 | Disabled elements |
| `effects.opacity.muted` | 0.6 | Muted/secondary |
| `effects.opacity.base` | 1.0 | Full opacity |

---

### `effects.shadow.*`
Drop shadow definitions.

| Token | CSS Value |
|-------|-----------|
| `effects.shadow.sm` | `0 1px 2px rgba(0,0,0,0.2)` |
| `effects.shadow.base` | `0 2px 4px rgba(0,0,0,0.3)` |
| `effects.shadow.lg` | `0 4px 8px rgba(0,0,0,0.4)` |

---

### `effects.blur.*`
Blur radius values.

| Token | Pixels |
|-------|--------|
| `effects.blur.sm` | 2 |
| `effects.blur.base` | 4 |
| `effects.blur.lg` | 8 |

---

### `effects.glow.*`
Glow effect definitions.

| Token | CSS Value |
|-------|-----------|
| `effects.glow.accent` | `0 0 8px var(--lcars-orange)` |
| `effects.glow.accentStrong` | `0 0 16px var(--lcars-orange)` |
| `effects.glow.danger` | `0 0 8px var(--lcars-red)` |
| `effects.glow.success` | `0 0 8px var(--lcars-green)` |

---

## Animations Tokens

### `animations.duration.*`
Animation duration (milliseconds).

| Token | MS | Use Case |
|-------|-----|----------|
| `animations.duration.instant` | 0 | No animation |
| `animations.duration.fast` | 200 | Quick transition |
| `animations.duration.base` | 350 | Standard animation |
| `animations.duration.slow` | 500 | Slow transition |
| `animations.duration.slower` | 800 | Very slow |
| `animations.duration.slowest` | 1200 | Cinematic |

---

### `animations.easing.*`
Easing function values.

| Token | CSS Value |
|-------|-----------|
| `animations.easing.linear` | `linear` |
| `animations.easing.ease` | `ease` |
| `animations.easing.easeIn` | `ease-in` |
| `animations.easing.easeOut` | `ease-out` |
| `animations.easing.easeInOut` | `ease-in-out` |

---

## Components Tokens

### Text Component (`components.text.*`)

| Token | Type | Default | Description |
|-------|------|---------|-------------|
| `components.text.defaultSize` | ref | `typography.fontSize.base` | Default font size |
| `components.text.defaultColor` | ref | `colors.ui.foreground` | Default text color |
| `components.text.defaultFamily` | ref | `typography.fontFamily.primary` | Default font |
| `components.text.defaultLineHeight` | ref | `typography.lineHeight.normal` | Line height |

**Nested structures:**

```javascript
components.text.statusIndicator: {
  sizeRatio: 0.3,
  padding: 8,
  color: 'colors.status.success'
}

components.text.bracket: {
  width: 'borders.width.base',
  gap: 'spacing.gap.base',
  extension: 8,
  radius: 'borders.radius.base'
}
```

---

### Status Grid Component (`components.statusGrid.*`)

**Layout:**
| Token | Type | Default |
|-------|------|---------|
| `components.statusGrid.rows` | number | 3 |
| `components.statusGrid.columns` | number | 4 |
| `components.statusGrid.cellGap` | ref | `spacing.gap.sm` |
| `components.statusGrid.textPadding` | ref | `spacing.scale.4` |

**Colors:**
| Token | Type | Default |
|-------|------|---------|
| `components.statusGrid.defaultCellColor` | ref | `colors.accent.primary` |
| `components.statusGrid.borderColor` | ref | `colors.ui.border` |
| `components.statusGrid.labelColor` | ref | `colors.ui.foreground` |
| `components.statusGrid.statusOnColor` | ref | `colors.status.success` |

**Typography:**
| Token | Type | Default |
|-------|------|---------|
| `components.statusGrid.fontSize` | ref | `typography.fontSize.sm` |
| `components.statusGrid.fontFamily` | ref | `typography.fontFamily.primary` |
| `components.statusGrid.fontWeight` | ref | `typography.fontWeight.normal` |

---

### Sparkline Component (`components.sparkline.*`)

| Token | Type | Default | Description |
|-------|------|---------|-------------|
| `components.sparkline.defaultColor` | ref | `colors.accent.primary` | Line color |
| `components.sparkline.defaultStrokeWidth` | ref | `borders.width.base` | Line width |
| `components.sparkline.opacity` | ref | `effects.opacity.base` | Line opacity |

**Size:**
```javascript
components.sparkline.size: {
  width: 200,
  height: 60
}
```

**Grid:**
```javascript
components.sparkline.grid: {
  color: 'colors.chart.grid',
  opacity: 0.4,
  strokeWidth: 'borders.width.thin'
}

---

```
### Line Component (`components.line.*`)

| Token | Type | Default | Description |
|-------|------|---------|-------------|
| `components.line.defaultColor` | ref | `colors.accent.secondary` | Default line color |
| `components.line.defaultWidth` | ref | `borders.width.base` | Default stroke width |
| `components.line.defaultOpacity` | ref | `effects.opacity.base` | Default opacity |

**Stroke Styling:**
| Token | Type | Default |
|-------|------|---------|
| `components.line.defaultLineCap` | string | `round` |
| `components.line.defaultLineJoin` | string | `round` |
| `components.line.defaultMiterLimit` | number | 4 |

**Markers:**
```javascript
components.line.marker: {
  defaultSize: 'medium',
  defaultColor: 'inherit',
  arrowSize: 8,
  dotSize: 6,
  diamondSize: 8
}
```

**Effects:**
```javascript
components.line.glow: {
  size: 'effects.blur.sm',
  opacity: 0.6,
  color: 'currentColor'
}

components.line.shadow: {
  offset: [2, 2],
  blur: 'effects.blur.sm',
  color: 'rgba(0,0,0,0.3)'
}
```

---

## Token Usage Examples

### Using Token References

```json
{
  "tokens": {
    "spacing": {
      "gap": {
        "base": 4
      }
    },
    "components": {
      "statusGrid": {
        "cellGap": "spacing.gap.base"  // References token above
      }
    }
  }
}
```

### Direct Values

```json
{
  "tokens": {
    "components": {
      "text": {
        "defaultSize": 16  // Direct value
      }
    }
  }
}
```

### Computed Colors

```json
{
  "tokens": {
    "colors": {
      "accent": {
        "primary": "#FF9900",
        "primaryDark": "darken(colors.accent.primary, 0.2)"  // Computed
      }
    }
  }
}
```

---

## Color Functions Reference

| Function | Syntax | Example | Description |
|----------|--------|---------|-------------|
| `darken` | `darken(color, amount)` | `darken(colors.accent.primary, 0.2)` | Darken by 20% |
| `lighten` | `lighten(color, amount)` | `lighten(colors.accent.primary, 0.3)` | Lighten by 30% |
| `saturate` | `saturate(color, amount)` | `saturate(colors.accent.primary, 0.2)` | Increase saturation |
| `desaturate` | `desaturate(color, amount)` | `desaturate(colors.accent.primary, 0.2)` | Decrease saturation |
| `alpha` | `alpha(color, opacity)` | `alpha(colors.accent.primary, 0.5)` | Set opacity (0-1) |
| `mix` | `mix(color1, color2, weight)` | `mix(#FF0000, #0000FF, 0.5)` | Mix two colors |

---

## Component Property Names

| Component | Property Format | Example |
|-----------|----------------|---------|
| All | camelCase | `defaultSize`, `cellGap` |
| ❌ NOT | snake_case | ~~`default_size`~~, ~~`cell_gap`~~ |

**Correct:**
```json
{
  "components": {
    "statusGrid": {
      "cellGap": 4,
      "textPadding": 8
    }
  }
}
```

**Wrong:**
```json
{
  "components": {
    "status_grid": {
      "cell_gap": 4,
      "text_padding": 8
    }
  }
}
```

---

## Quick Copy Templates

### Minimal Theme

```json
{
  "themes": {
    "my-theme": {
      "id": "my-theme",
      "name": "My Theme",
      "tokens": {
        "colors": {
          "accent": { "primary": "#FF9900" }
        },
        "components": {
          "statusGrid": {
            "cellGap": 4
          }
        }
      }
    }
  }
}
```

### Complete Theme Skeleton

```json
{
  "themes": {
    "my-theme": {
      "id": "my-theme",
      "name": "My Theme",
      "tokens": {
        "colors": {
          "accent": {},
          "status": {},
          "ui": {}
        },
        "typography": {
          "fontSize": {},
          "fontFamily": {}
        },
        "spacing": {
          "scale": {},
          "gap": {}
        },
        "borders": {
          "width": {},
          "radius": {}
        },
        "components": {
          "text": {},
          "statusGrid": {},
          "sparkline": {}
        }
      }
    }
  }
}
```

---

## Tips & Tricks

### ✅ Best Practices

1. **Use token references** instead of hardcoded values
2. **Start with base tokens** (colors, spacing) then add components
3. **Test with real overlays** not just in isolation
4. **Keep a changelog** in your theme metadata
5. **Use semantic names** (success, warning) not specific colors

### ⚡ Quick Commands

```javascript
// Get current theme
window.cblcars.theme.getActiveTheme()

// List all themes
window.cblcars.theme.listThemes()

// Get component default
window.cblcars.theme.getDefault('statusGrid', 'cellGap', 0)

// Check token value
window.cblcars.theme.tokens.colors.accent.primary
```

---

## Need Help?

- 📚 **Theme Creation Tutorial** - Step-by-step guide
- 📖 **Theme System Reference** - Complete technical docs
- 💬 **Home Assistant Forums** - Community support

---

*This reference card covers MSD Theme System v1.0*

*Last updated: 2025-10-18* 🖖