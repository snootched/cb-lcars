# MSD Unified Styling System - Complete Reference

This document defines the standardized styling system used across all MSD overlay types to ensure consistency and maintainability.

---

## Table of Contents

1. [Overview](#overview)
2. [MSD Defaults System](#msd-defaults-system)
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

## MSD Defaults System

The MSD defaults system provides automatic scaling and consistent styling through profile-based configuration. This system ensures that text and other elements scale properly with different viewBox dimensions while maintaining design consistency.

### **How It Works**
- **Profiles** define scalable defaults using object notation
- **ViewBox scaling** automatically adjusts sizes based on SVG dimensions
- **Inheritance** allows overlays to inherit or override profile defaults
- **Flexible overrides** support both scaled and fixed values

### **Profile Configuration**
```yaml
profiles:
  - id: responsive_design
    defaults:
      text:
        # Scalable font size (recommended)
        font_size:
          value: 14                 # Base size in pixels
          scale: "viewbox"          # Scale with SVG viewBox
          unit: "px"                # Unit specification
        color: "var(--lcars-orange)" # Default text color
        font_family: "Orbitron"    # Default font family

      line:
        color: "var(--lcars-blue)"  # Default line color
        width: 2                    # Default line width

active_profiles: ["responsive_design"]  # Apply this profile
```

### **Scaling Modes**
- **`viewbox`**: Scale based on SVG viewBox dimensions (recommended)
- **`container`**: Scale based on container size
- **`none`**: No automatic scaling

### **Value Formats**

#### **Scalable Values** (Object Format)
```yaml
font_size:
  value: 16                         # Base value
  scale: "viewbox"                  # Scaling mode
  unit: "px"                        # Output unit
```

#### **Fixed Values** (Simple Format)
```yaml
font_size: 16                       # No scaling applied
```

### **Override Behavior**
```yaml
overlays:
  - type: text
    id: inherits_scaling
    text: "Inherits profile scaling"
    # Uses profile's scalable font_size

  - type: text
    id: custom_scaling
    text: "Custom scaling"
    style:
      font_size:                    # Override with different scaling
        value: 20
        scale: "viewbox"
        unit: "px"

  - type: text
    id: fixed_size
    text: "Fixed size"
    style:
      font_size: 18                 # Override with fixed size
```

### **ViewBox Scaling Example**
With a profile default of `{value: 14, scale: "viewbox"}`:
- **ViewBox [0, 0, 400, 300]**: Font renders at ~14px
- **ViewBox [0, 0, 800, 600]**: Font renders at ~28px (2× scaling)
- **ViewBox [0, 0, 1920, 1200]**: Font renders at ~56px (4× scaling)

### **Benefits**
- **🎯 Consistent scaling** across all overlay types
- **📱 Responsive design** that adapts to different screen sizes
- **🎨 Design flexibility** with easy override options
- **⚡ Performance** through intelligent caching
- **🔧 Maintainability** with centralized defaults

---

## Text Styling

### **Core Text Properties**
```yaml
style:
  # Font properties
  font_size: 14                   # Font size in pixels (simple, no scaling)
  font_family: "Orbitron"         # Font family name
  font_weight: "bold"             # normal, bold, lighter, bolder, 100-900
  font_style: "normal"            # normal, italic, oblique

  # Scalable font size (recommended for responsive design)
  font_size:                      # Object format enables viewBox scaling
    value: 14                     # Base size value
    scale: "viewbox"              # Scaling mode: viewbox, container, none
    unit: "px"                    # Unit: px, em, rem

  # Text alignment
  text_align: "center"            # left, center, right, start, end
  vertical_align: "middle"        # top, middle, bottom, baseline

  # Text spacing
  line_height: 1.4                # Line height multiplier
  letter_spacing: "0.1em"         # Letter spacing (CSS units)
```

### **Font Scaling with MSD Defaults System**
The MSD defaults system provides automatic font scaling based on SVG viewBox dimensions:

```yaml
# Profile-based scaling (recommended)
profiles:
  - id: responsive
    defaults:
      text:
        font_size:                # Scalable default
          value: 14               # Base size
          scale: "viewbox"        # Scale with viewBox
          unit: "px"

overlays:
  - type: text
    id: auto_scaled_text
    text: "Scales automatically!"
    # Inherits scalable font_size from profile

  - type: text
    id: custom_scaled_text
    text: "Custom scaling"
    style:
      font_size:                  # Override with custom scaling
        value: 20
        scale: "viewbox"
        unit: "px"

  - type: text
    id: fixed_size_text
    text: "Fixed size"
    style:
      font_size: 16               # Simple number = no scaling
```

### **Text Colors**
```yaml
style:
  # Primary text colors
  text_color: "var(--lcars-white)"     # Main text color
  label_color: "var(--lcars-cyan)"     # Label text color
  value_color: "var(--lcars-yellow)"   # Value text color

  # Alternative naming (fallback support)
  color: "var(--lcars-white)"          # Falls back to text_color
  textColor: "var(--lcars-white)"      # camelCase alternative
```

### **Text Effects**
```yaml
style:
  # Text shadow
  text_shadow:
    offset_x: 2                   # Horizontal shadow offset
    offset_y: 2                   # Vertical shadow offset
    blur: 3                       # Shadow blur radius
    color: "rgba(0,0,0,0.5)"      # Shadow color

  # Text stroke/outline
  text_stroke:
    width: 1                      # Stroke width
    color: "var(--lcars-gray)"    # Stroke color
    opacity: 0.8                  # Stroke opacity
```

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