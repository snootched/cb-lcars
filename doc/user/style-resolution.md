# 🎨 Style Resolution in CB-LCARS MSD

> **User Guide for Theme Tokens and Style Resolution**

## Overview

CB-LCARS MSD uses a powerful **multi-tier style resolution system** that automatically resolves styles from:

1. **Explicit values** in your overlay config
2. **Token references** from theme system
3. **Theme defaults** from active theme
4. **Preset values** from LCARS presets
5. **System fallbacks** as last resort

This guide explains how to use the style system effectively.

---

## Quick Start

### Basic Usage - Explicit Values

```yaml
overlays:
  - type: text
    text: "LCARS Interface"
    position: [100, 100]
    style:
      color: '#FF9900'      # Direct color value
      font_size: 24         # Direct size value
```

### Using Theme Tokens

```yaml
overlays:
  - type: text
    text: "LCARS Interface"
    position: [100, 100]
    style:
      color: 'colors.accent.primary'      # Token reference
      font_size: 'typography.fontSize.xl'  # Token reference
```

### Using LCARS Presets

```yaml
overlays:
  - type: button
    position: [100, 100]
    size: [200, 60]
    style:
      lcars_button_preset: 'lozenge'  # Applies preset styles
      color: '#00FF00'                # Overrides preset color
```

---

## Token Reference System

### Token Path Format

Tokens use **dot notation** to reference theme values:

```
category.subcategory.property
```

**Examples:**
- `colors.accent.primary` → Primary accent color
- `typography.fontSize.lg` → Large font size
- `spacing.scale.4` → Spacing scale level 4
- `borders.radius.base` → Base border radius
- `components.chart.backgroundColor` → Chart background color

### Available Token Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| `colors` | Color values | `colors.accent.primary`, `colors.ui.border` |
| `typography` | Font settings | `typography.fontFamily.primary`, `typography.fontSize.xl` |
| `spacing` | Spacing values | `spacing.scale.4`, `spacing.gap.base` |
| `borders` | Border properties | `borders.width.base`, `borders.radius.lg` |
| `effects` | Visual effects | `effects.opacity.muted`, `effects.glow.accent` |
| `animations` | Animation settings | `animations.duration.fast`, `animations.easing.ease` |
| `components` | Component defaults | `components.text.defaultColor`, `components.chart.backgroundColor` |

---

## Resolution Priority

The system follows this priority order (highest to lowest):

```
1. Explicit Value (in overlay config)
   ↓ (if not found)
2. Token Reference (resolved from theme)
   ↓ (if not found)
3. Theme Default (component-specific)
   ↓ (if not found)
4. Preset Value (if preset applied)
   ↓ (if not found)
5. System Fallback (hardcoded default)
```

### Example Resolution Chain

```yaml
overlays:
  - type: text
    style:
      color: 'colors.accent.primary'  # Token reference
```

**Resolution steps:**
1. ✅ No explicit value → check token
2. ✅ Resolve `colors.accent.primary` from theme → `'var(--lcars-orange, #FF9900)'`
3. ✅ Return resolved value

**If token doesn't exist:**
1. ❌ No explicit value
2. ❌ Token not found in theme
3. ✅ Check theme default for `components.text.defaultColor`
4. ✅ Return theme default or fallback

---

## Advanced Features

### Nested Token References

Tokens can reference other tokens:

```javascript
// In theme tokens:
{
  colors: {
    primary: '#FF9900',
    accent: {
      primary: 'colors.primary'  // ← References colors.primary
    }
  },
  components: {
    text: {
      defaultColor: 'colors.accent.primary'  // ← References colors.accent.primary
    }
  }
}
```

Resolution chain:
```
'components.text.defaultColor'
  → 'colors.accent.primary'
  → 'colors.primary'
  → '#FF9900'
```

### Computed Tokens

Theme tokens can use color manipulation functions:

```javascript
{
  colors: {
    primary: '#FF9900',
    primaryDark: 'darken(colors.primary, 0.2)',
    primaryLight: 'lighten(colors.primary, 0.2)',
    primaryMuted: 'alpha(colors.primary, 0.6)'
  }
}
```

**Available functions:**
- `darken(color, amount)` - Darken color by amount (0-1)
- `lighten(color, amount)` - Lighten color by amount (0-1)
- `alpha(color, opacity)` - Set opacity (0-1)
- `saturate(color, amount)` - Increase saturation
- `desaturate(color, amount)` - Decrease saturation
- `mix(color1, color2, weight)` - Mix two colors

### Component-Specific Defaults

Each component type has default tokens:

```javascript
// Text component defaults
{
  components: {
    text: {
      defaultColor: 'colors.ui.foreground',
      defaultSize: 'typography.fontSize.base',
      defaultFamily: 'typography.fontFamily.primary'
    }
  }
}
```

These are used automatically when no explicit value is provided.

---

## ApexCharts Integration

ApexCharts overlays support theme token resolution:

```yaml
overlays:
  - type: apexchart
    source: temperature
    position: [100, 100]
    size: [400, 200]
    style:
      # These resolve via tokens!
      background_color: 'components.chart.backgroundColor'
      stroke_color: 'components.chart.strokeColor'
      grid_color: 'components.chart.gridColor'
      colors: 'components.chart.defaultColors'
      stroke_width: 'components.chart.defaultStrokeWidth'
```

### Chart-Specific Tokens

```javascript
{
  components: {
    chart: {
      backgroundColor: 'var(--lcars-african-violet, #330033)',
      strokeColor: 'colors.chart.axis',
      gridColor: 'colors.chart.gridMuted',
      defaultColors: 'colors.chart.series',
      defaultStrokeWidth: 3
    }
  },
  colors: {
    chart: {
      series: [
        'var(--lcars-orange, #FF9900)',
        'var(--lcars-blue, #9999FF)',
        'var(--lcars-yellow, #FFCC99)'
      ],
      axis: 'var(--lcars-white, #FFFFFF)',
      grid: 'var(--lcars-gray, #999999)',
      gridMuted: 'alpha(colors.chart.grid, 0.3)'
    }
  }
}
```

### Raw ApexCharts Options

For advanced users, bypass friendly options:

```yaml
overlays:
  - type: apexchart
    source: temperature
    position: [100, 100]
    size: [400, 200]
    # Friendly options (resolved via tokens)
    style:
      background_color: 'components.chart.backgroundColor'

      # Raw ApexCharts options (override everything)
      chart_options:
        chart:
          background: 'linear-gradient(to bottom, #330033, #660066)'
        plotOptions:
          bar:
            borderRadius: 10
        annotations:
          yaxis:
            - y: 100
              label:
                text: 'Threshold'
```

---

## Debugging

### Check Resolved Values

```javascript
// Check what value was resolved
const result = window.cblcars.styleResolver.resolveProperty({
  property: 'backgroundColor',
  value: undefined,
  tokenPath: 'components.chart.backgroundColor',
  defaultValue: 'transparent'
});

console.log('Resolved:', result);
// {value: 'var(--lcars-african-violet, #330033)', source: 'token_system'}
```

### Check Theme Structure

```javascript
// See active theme with tokens
const theme = window.cblcars.theme.getActiveTheme();
console.log('Theme:', theme);
console.log('Chart tokens:', theme.components?.chart);
```

### Check Provenance

```javascript
// See how styles were resolved for an overlay
const provenance = window.__msdDebug.getProvenance('my-overlay');
console.log('Style resolutions:', provenance.style_resolution);
```

**Example output:**
```javascript
{
  style_resolution: {
    total: 8,
    by_source: {
      explicit: 2,
      token_system: 5,
      fallback: 1
    },
    properties: [
      {
        property: 'backgroundColor',
        source: 'token_system',
        value: 'var(--lcars-african-violet, #330033)'
      },
      {
        property: 'strokeColor',
        source: 'explicit',
        value: '#FF0000'
      }
    ]
  }
}
```

---

## Best Practices

### ✅ DO

- **Use tokens for themeable properties**: Colors, fonts, spacing
- **Use explicit values for unique styles**: Special effects, animations
- **Use presets for common patterns**: LCARS button shapes
- **Override presets when needed**: Customize specific properties
- **Test with different themes**: Ensure tokens resolve correctly

### ❌ DON'T

- **Hardcode LCARS colors**: Use tokens instead
- **Duplicate theme values**: Reference existing tokens
- **Override all preset values**: Defeats the purpose
- **Use invalid token paths**: Check theme structure first
- **Mix token systems**: Stick to one approach per overlay

---

## Examples

### Text Overlay with Tokens

```yaml
overlays:
  - type: text
    text: "System Status"
    position: [50, 50]
    style:
      color: 'colors.accent.primary'
      font_size: 'typography.fontSize.2xl'
      font_family: 'typography.fontFamily.primary'
      font_weight: 'typography.fontWeight.bold'
```

### Button with Preset and Override

```yaml
overlays:
  - type: button
    label: "ENGAGE"
    position: [100, 100]
    size: [200, 60]
    style:
      lcars_button_preset: 'lozenge'
      color: 'colors.status.success'  # Override preset color
```

### Chart with Full Token Integration

```yaml
overlays:
  - type: apexchart
    source: power_consumption
    position: [50, 200]
    size: [500, 200]
    chart_type: line
    style:
      background_color: 'components.chart.backgroundColor'
      stroke_color: 'components.chart.strokeColor'
      grid_color: 'components.chart.gridColor'
      colors: 'components.chart.defaultColors'
      stroke_width: 'components.chart.defaultStrokeWidth'
      show_grid: true
      show_legend: true
```

### Mixed Approach (Tokens + Explicit)

```yaml
overlays:
  - type: text
    text: "WARNING"
    position: [100, 100]
    style:
      color: 'colors.status.danger'    # Token
      font_size: 48                     # Explicit
      font_family: 'typography.fontFamily.primary'  # Token
      text_shadow: '0 0 10px #FF0000'  # Explicit
      glow: true                        # Explicit
```

---

## See Also

- [Theme System Architecture](../spec/theme-system.md)
- [Token Reference Guide](../reference/tokens.md)
- [LCARS Presets Guide](../user/presets.md)
- [Provenance System](../user/provenance.md)
- [ApexCharts Integration](../user/apexcharts.md)
