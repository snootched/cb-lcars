# MSD Unified Styling System - Complete Reference

This document defines the standardized styling system used across all MSD overlay types to ensure consistency and maintainability.

---

## Table of Contents

1. [Overview](#overview)
2. [MSD Theme System](#msd-theme-system)
3. [Text Styling](#text-styling)
4. [Color System](#color-system)
5. [Layout & Spacing](#layout--spacing)
6. [Interaction Styles](#interaction-styles)
7. [Animation Properties](#animation-properties)
8. [Effect Systems](#effect-systems)
9. [Property Mapping](#property-mapping)
10. [Usage Examples](#usage-examples)

---

## Overview

The MSD Unified Styling System provides consistent property naming and behavior across all overlay types:

- **✅ Consistent property names** - Same properties work across all overlays
- **✅ Fallback chains** - Multiple naming conventions supported for compatibility
- **✅ Type safety** - Automatic type conversion and validation
- **✅ DRY principles** - Shared parsing and application utilities
- **✅ Future-proof** - Easy to extend with new overlay types

### **Supported Overlay Types:**
- ✅ **Text Overlay** - Rich text display with dynamic content
- ✅ **Status Grid Overlay** - Multi-entity grid visualization
- ✅ **History Bar Overlay** - Temporal data bar charts
- 🔄 **Progress Bar Overlay** - Linear progress visualization (planned)
- 🔄 **Gauge Overlay** - Circular/semi-circular meters (planned)

---

## MSD Theme System

The MSD theme system provides automatic scaling, consistent styling, and centralized defaults through a unified token-based approach. This system ensures that overlays scale properly and maintain visual consistency across different themes.

### **How It Works**
- **Themes** define all component defaults using token-based notation
- **Token resolution** automatically resolves references (e.g., `'colors.accent.primary'`)
- **Component scoping** provides dedicated defaults for each overlay type
- **Flexible overrides** support both themed and explicit values

### **Theme Selection**
```yaml
msd:
  theme: "lcars-classic"          # Select active theme
  use_packs:
    builtin: ['cb_lcars_buttons']

overlays:
  - type: text
    id: themed_text
    text: "Uses theme defaults"
    # Inherits font_size from theme's components.text.defaultSize

  - type: text
    id: custom_text
    text: "Custom styling"
    style:
      font_size: 20               # Override theme default
```

### **Available Themes**
Built-in themes from the `builtin_themes` pack:
- **`lcars-classic`** - Classic TNG-era LCARS styling (default)
- **`lcars-ds9`** - Deep Space Nine LCARS variant
- **`lcars-voyager`** - Voyager LCARS styling
- **`lcars-high-contrast`** - Accessibility-focused high contrast theme

### **Theme Token Structure**

Themes are defined using a hierarchical token system:

```javascript
lcarsClassicTokens = {
  // Base design tokens
  colors: {
    accent: { primary: 'var(--lcars-orange)' },
    status: { success: 'var(--lcars-green)' }
  },
  typography: {
    fontSize: { base: 16, lg: 18 },
    fontFamily: { primary: 'Antonio' }
  },
  spacing: {
    scale: { '4': 8, '8': 16 },
    gap: { base: 4, sm: 2 }
  },
  borders: {
    width: { base: 2 },
    radius: { base: 4 }
  },

  // Component-specific defaults
  components: {
    text: {
      defaultSize: 'typography.fontSize.base',   // Token reference
      defaultColor: 'colors.ui.foreground',       // Token reference
      bracket: {
        width: 'borders.width.base',
        gap: 'spacing.gap.base',
        extension: 8
      }
    },
    statusGrid: {
      rows: 3,
      columns: 4,
      cellGap: 'spacing.gap.sm',                 // Token reference
      textPadding: 'spacing.scale.4',            // Token reference
      statusOnColor: 'colors.status.success'
    }
  }
}
```

### **Token Categories**

**Base Tokens** (design primitives):
- `colors.*` - Color palette (accent, status, ui, chart, alert)
- `typography.*` - Font settings (fontSize, fontFamily, fontWeight, lineHeight)
- `spacing.*` - Spacing scales and gaps
- `borders.*` - Border widths, radii, and styles
- `effects.*` - Opacity, shadows, blurs, glows
- `animations.*` - Duration and easing functions

**Component Tokens** (`components.*`):
- `text.*` - Text overlay defaults
- `statusGrid.*` - Status grid defaults
- `sparkline.*` - Sparkline overlay defaults
- `button.*` - Button overlay defaults
- `line.*` - Line overlay defaults
- `chart.*` - Chart overlay defaults

### **Token Resolution**

Tokens can reference other tokens using dot notation:

```javascript
// Theme definition
{
  spacing: {
    scale: { '4': 8 }
  },
  components: {
    statusGrid: {
      textPadding: 'spacing.scale.4'  // References spacing token
    }
  }
}

// At runtime
ThemeManager.getDefault('statusGrid', 'textPadding', 8)
// → Looks up components.statusGrid.textPadding
// → Finds 'spacing.scale.4'
// → Resolves to 8
// → Returns 8
```

### **Using Themes in Overlays**

```yaml
overlays:
  # Inherits all theme defaults
  - type: status_grid
    id: themed_grid
    cells: [...]
    # Uses theme's components.statusGrid defaults

  # Partial override
  - type: status_grid
    id: custom_grid
    style:
      cell_gap: 4                # Override theme default
      # Other values use theme defaults
    cells: [...]

  # Complete custom styling
  - type: status_grid
    id: fully_custom
    style:
      rows: 5
      columns: 6
      cell_gap: 8
      text_padding: 16
      # All values explicitly set
    cells: [...]
```

### **Priority Order**
When resolving values:
1. **User explicit values** (highest) - Direct `style.property` values
2. **Style presets** - Values from `lcars_button_preset`
3. **Theme defaults** - Values from active theme's `components.*` tokens
4. **Hardcoded fallbacks** (lowest) - Last resort values in code

### **Creating Custom Themes**

You can create custom themes in external packs:

```json
{
  "id": "my_themes",
  "themes": {
    "my-custom-theme": {
      "id": "my-custom-theme",
      "name": "My Custom Theme",
      "description": "Custom LCARS styling",
      "tokens": {
        "colors": {
          "accent": { "primary": "#00ff00" }
        },
        "typography": {
          "fontSize": { "base": 14 }
        },
        "components": {
          "statusGrid": {
            "cellGap": 4,
            "textPadding": 12
          }
        }
      }
    }
  }
}
```

Load and activate:
```yaml
msd:
  theme: "my-custom-theme"
  use_packs:
    external:
      - url: "/local/my-themes.json"
```

### **Benefits**
- **🎯 Consistent theming** across all overlay types
- **🎨 Easy theme switching** - change entire look with one setting
- **📱 Responsive design** through token-based scaling
- **🔧 Maintainability** with centralized theme definitions
- **⚡ Performance** through intelligent caching and resolution
- **✨ Powerful** - token references enable computed values
---

## Color System

### **Primary Colors**
```yaml
style:
  # Core colors
  color: "var(--lcars-blue)"           # Primary element color
  primary_color: "var(--lcars-blue)"   # Explicit primary color
  background_color: "transparent"      # Background fill color
  border_color: "var(--lcars-gray)"    # Border/outline color
```

### **Interactive State Colors**
```yaml
style:
  # User interaction states
  hover_color: "var(--lcars-yellow)"   # Hover state color
  active_color: "var(--lcars-cyan)"    # Active/pressed state color
  focus_color: "var(--lcars-white)"    # Focus state color
  disabled_color: "var(--lcars-gray)"  # Disabled state color
```

### **Status Colors**
```yaml
style:
  # Semantic status colors
  success_color: "var(--lcars-green)"  # Success/good state
  warning_color: "var(--lcars-yellow)" # Warning/caution state
  error_color: "var(--lcars-red)"      # Error/bad state
  info_color: "var(--lcars-cyan)"      # Information state
```

### **Property Naming Support**
The system supports multiple naming conventions:
```yaml
# All equivalent - use your preferred style
color: "var(--lcars-blue)"
primary_color: "var(--lcars-blue)"
primaryColor: "var(--lcars-blue)"      # camelCase
```

---

## Layout & Spacing

### **Border Properties**
```yaml
style:
  # Border configuration
  border_width: 2                 # Border thickness in pixels
  border_radius: 4                # Corner radius in pixels
  border_style: "solid"           # solid, dashed, dotted, etc.
  border_color: "var(--lcars-gray)" # Border color
```

### **Spacing (Padding & Margin)**
```yaml
style:
  # Simple numeric padding (all sides)
  padding: 8                      # 8px padding on all sides

  # Object-based padding (detailed control)
  padding:
    top: 8
    right: 12
    bottom: 8
    left: 12

  # Shorthand object padding
  padding:
    vertical: 8                   # top and bottom
    horizontal: 12                # left and right

  # Margin follows same format as padding
  margin: 4
  margin:
    top: 4
    right: 8
    bottom: 4
    left: 8
```

### **Size Constraints**
```yaml
style:
  # Size limits
  min_width: 100                  # Minimum width in pixels
  max_width: 500                  # Maximum width in pixels
  min_height: 50                  # Minimum height in pixels
  max_height: 300                 # Maximum height in pixels
```

### **Visibility**
```yaml
style:
  # Visibility control
  opacity: 0.8                    # Element opacity (0-1)
  visible: true                   # Show/hide element
```

---

## Interaction Styles

### **Hover Effects**
```yaml
style:
  # Hover configuration
  hover_enabled: true             # Enable hover effects
  hover_color: "var(--lcars-yellow)" # Color on hover
  hover_scale: 1.05               # Scale factor on hover
  hover_opacity: 1.0              # Opacity on hover
  hover_transition: "all 0.2s ease" # CSS transition
```

### **Click/Touch Effects**
```yaml
style:
  # Click interaction
  clickable: true                 # Enable click/touch
  active_scale: 0.95              # Scale when pressed
  cursor: "pointer"               # CSS cursor style
```

### **Focus Effects**
```yaml
style:
  # Focus states
  focus_enabled: true             # Enable focus styles
  focus_outline: true             # Show focus outline
  focus_color: "var(--lcars-white)" # Focus indicator color
```

---

## Animation Properties

### **Animation Enablement**
```yaml
style:
  # Animation control
  animatable: true                # Enable anime.js targeting
```

### **CSS Transitions**
```yaml
style:
  # Transition properties
  transition: "all 0.3s ease"     # CSS transition shorthand
  transition_delay: "0.1s"        # Transition delay
  transition_duration: "0.5s"     # Transition duration
  transition_timing_function: "ease-in-out" # Timing function
```

### **CSS Animations**
```yaml
style:
  # Animation properties
  animation_duration: "2s"        # Animation duration
  animation_timing_function: "ease" # Timing function
  animation_delay: "0.5s"         # Animation delay
  animation_iteration_count: "infinite" # Repeat count
  animation_direction: "alternate" # normal, reverse, alternate, alternate-reverse
  animation_fill_mode: "both"     # none, forwards, backwards, both
```

### **Custom Animation Properties**
```yaml
style:
  # MSD-specific animations
  cascade_speed: 1.5              # Cascade animation speed multiplier
  cascade_direction: "diagonal"   # row, column, diagonal, reverse-*
  reveal_animation: true          # Initial reveal effect
  pulse_on_change: true           # Pulse when data changes
```

---

## Effect Systems

### **Glow Effects**
```yaml
style:
  glow:
    color: "var(--lcars-blue)"     # Glow color
    blur: 5                        # Glow blur radius
    intensity: 0.8                 # Glow intensity (0-1)
```

### **Shadow Effects**
```yaml
style:
  shadow:
    offset_x: 3                    # Horizontal shadow offset
    offset_y: 3                    # Vertical shadow offset
    blur: 6                        # Shadow blur radius
    color: "rgba(0,0,0,0.4)"       # Shadow color
```

### **Blur Effects**
```yaml
style:
  blur:
    radius: 2                      # Blur radius
    type: "gaussian"               # Blur type
```

### **Gradient Effects**
```yaml
style:
  gradient:
    type: "linear"                 # linear, radial
    direction: "vertical"          # For linear: horizontal, vertical, diagonal
    stops:
      - { offset: "0%", color: "var(--lcars-blue)" }
      - { offset: "50%", color: "var(--lcars-cyan)" }
      - { offset: "100%", color: "var(--lcars-white)" }
```

### **Pattern Effects**
```yaml
style:
  pattern:
    type: "stripes"                # Pattern type
    color: "var(--lcars-gray)"     # Pattern color
    spacing: 4                     # Pattern spacing
    opacity: 0.3                   # Pattern opacity
```

---

## Property Mapping

### **Naming Convention Support**
The system accepts multiple naming conventions for the same property:

| **Standard Name** | **Alternative Names** | **Type** | **Default** |
|-------------------|----------------------|----------|-------------|
| `font_size` | `fontSize` | number | 12 |
| `font_family` | `fontFamily` | string | "monospace" |
| `text_color` | `textColor`, `color` | string | "var(--lcars-white)" |
| `border_width` | `borderWidth` | number | 1 |
| `border_radius` | `borderRadius` | number | 0 |
| `hover_enabled` | `hoverEnabled` | boolean | true |
| `cascade_speed` | `cascadeSpeed` | number | 0 |

### **Type Conversion**
- **Numbers**: Automatic conversion with `Number()`
- **Booleans**: `false` only for explicit `false`, `!== false` for everything else
- **Colors**: String values passed through unchanged
- **Objects**: Deep parsing for complex properties like `padding`, `gradient`

---

## Usage Examples

### **Example 1: Consistent Text Styling Across Overlays**
```yaml
overlays:
  # Text overlay with unified styling
  - id: temperature_display
    type: text
    content: "Temperature: {temperature} °C"
    style: &text_style
      font_size: 16
      font_family: "Orbitron"
      text_color: "var(--lcars-cyan)"
      hover_color: "var(--lcars-yellow)"
      glow:
        color: "var(--lcars-blue)"
        blur: 3
        intensity: 0.6

  # Status grid with identical styling
  - id: sensor_grid
    type: status_grid
    style:
      <<: *text_style              # YAML anchor reuse
      rows: 2
      columns: 3

  # History bar with identical styling
  - id: temp_history
    type: history_bar
    style:
      <<: *text_style              # Same text styling
      time_window: "24h"
```

### **Example 2: Comprehensive Styling with All Features**
```yaml
overlays:
  - id: fully_styled_overlay
    type: status_grid
    style:
      # Text styling
      font_size: 14
      font_family: "Orbitron, monospace"
      font_weight: "bold"
      text_color: "var(--lcars-white)"
      label_color: "var(--lcars-cyan)"

      # Colors
      color: "var(--lcars-blue)"
      border_color: "var(--lcars-gray)"
      hover_color: "var(--lcars-yellow)"

      # Layout
      border_width: 2
      border_radius: 4
      padding: 8
      opacity: 0.9

      # Interaction
      hover_enabled: true
      hover_scale: 1.1
      cursor: "pointer"

      # Animation
      animatable: true
      cascade_speed: 1.5
      cascade_direction: "diagonal"
      reveal_animation: true

      # Effects
      glow:
        color: "var(--lcars-blue)"
        blur: 4
        intensity: 0.7

      shadow:
        offset_x: 2
        offset_y: 2
        blur: 4
        color: "rgba(0,0,0,0.3)"

      gradient:
        type: "linear"
        direction: "vertical"
        stops:
          - { offset: "0%", color: "var(--lcars-blue)" }
          - { offset: "100%", color: "var(--lcars-cyan)" }
```

### **Example 3: Multiple Naming Convention Support**
```yaml
overlays:
  - id: naming_flexibility
    type: text
    style:
      # Snake_case (recommended)
      font_size: 16
      text_color: "var(--lcars-white)"
      border_radius: 4

      # camelCase (also supported)
      fontSize: 16                 # Same as font_size
      textColor: "var(--lcars-white)" # Same as text_color
      borderRadius: 4              # Same as border_radius

      # Mixed (works fine)
      font_family: "Orbitron"      # snake_case
      hoverColor: "var(--lcars-yellow)" # camelCase
```

---

## Implementation Notes

### **For Overlay Developers:**
1. **Use `RendererUtils.parseAllStandardStyles(style)`** to get all parsed styles
2. **Access parsed styles** via the returned object structure
3. **Apply styles** using the helper utilities in RendererUtils
4. **Always support both naming conventions** for user flexibility

### **For Configuration Authors:**
1. **Use consistent naming** across all your overlays for maintainability
2. **Leverage YAML anchors** to reuse common styling configurations
3. **Test with different naming conventions** to ensure compatibility
4. **Reference the fallback chains** if migrating from older configurations

This unified styling system ensures that all MSD overlays provide a consistent, powerful, and flexible styling experience! 🎨✨