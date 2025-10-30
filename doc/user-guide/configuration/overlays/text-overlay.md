# Text Overlay Configuration Guide

> **Dynamic, styled text rendering with real-time updates**
> Display sensor data, status information, labels, and interactive text elements with comprehensive styling options.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Core Configuration](#core-configuration)
4. [DataSource Integration](#datasource-integration)
5. [Typography & Styling](#typography--styling)
6. [Multi-line Text](#multi-line-text)
7. [Interactive Actions](#interactive-actions)
8. [Effects & Decorations](#effects--decorations)
9. [Complete Property Reference](#complete-property-reference)
10. [Real-World Examples](#real-world-examples)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The **Text Overlay** is one of the most versatile overlays in CB-LCARS, providing sophisticated text rendering with:

✅ **Dynamic content** - Real-time updates from Home Assistant entities and datasources
✅ **Rich typography** - Comprehensive font control with automatic scaling
✅ **Template integration** - Access datasource transformations and aggregations
✅ **Visual effects** - Gradients, glows, shadows, and patterns
✅ **LCARS decorations** - Status indicators, brackets, and highlights
✅ **Multi-line support** - Automatic line spacing and text wrapping
✅ **Interactive actions** - Full Home Assistant action support (tap, hold, double-tap)
✅ **Font stabilization** - Automatic text measurement for proper alignment

### When to Use Text Overlays

- **Status displays** - Show sensor values, system states, timestamps
- **Labels** - Identify sections, rooms, or control groups
- **Data dashboards** - Multi-line information panels with formatted values
- **Interactive controls** - Clickable text that triggers actions
- **Decorative text** - Styled headers, titles, and LCARS-themed labels

---

## Quick Start

### Minimal Configuration

The absolute minimum needed for a text overlay:

```yaml
overlays:
  - id: simple_text
    type: text
    position: [100, 50]
    content: "Hello World"
```

**Result:** Basic text at position (100, 50) with default styling.

### With DataSource

Display a sensor value with formatting:

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.living_room_temperature

overlays:
  - id: temp_display
    type: text
    position: [100, 50]
    content: "Temperature: {temperature:.1f}°C"
    style:
      color: var(--lcars-orange)
      font_size: 18
```

**Result:** Text showing "Temperature: 23.5°C" that updates in real-time.

### Interactive Text

Add tap actions for interactivity:

```yaml
overlays:
  - id: clickable_temp
    type: text
    position: [100, 50]
    content: "Living Room: 23°C"
    tap_action:
      action: more-info
      entity: sensor.living_room_temperature
    style:
      color: var(--lcars-blue)
```

**Result:** Clickable text that opens the entity's more-info dialog.

---

## Core Configuration

### Required Properties

Every text overlay must have these three properties:

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `id` | string | Unique identifier | `"temp_label"` |
| `type` | string | Must be `"text"` | `"text"` |
| `position` | [x, y] | Top-left corner coordinates | `[100, 50]` |

### Content Sources

You have **three ways** to specify text content:

#### 1. Static Content

```yaml
content: "Static Text"
# OR
text: "Static Text"
```

Use for labels and fixed text that never changes.

#### 2. Template Strings (Recommended)

```yaml
content: "Temp: {datasource_name:.1f}°C"
```

Access datasource values with formatting:
- `{datasource_name}` - Raw value
- `{datasource_name:.1f}` - 1 decimal place
- `{datasource_name.transformations.celsius:.1f}` - Access transformations
- `{datasource_name.aggregations.avg_5m.value:.2f}` - Access aggregations

#### 3. DataSource Reference (Legacy)

```yaml
data_source: datasource_name
style:
  value_format: "{value:.1f}°C"
```

**Note:** This method is older and less flexible. Template strings are recommended.

### Basic Example

```yaml
overlays:
  - id: status_label
    type: text
    position: [100, 50]
    content: "System Status"
    style:
      color: var(--lcars-orange)
      font_size: 16
      font_family: "Orbitron, monospace"
```

---

## DataSource Integration

Text overlays have **deep integration** with the datasource system, allowing real-time display of sensor data with transformations and aggregations.

### Direct Value Access

Display a datasource's raw value:

```yaml
data_sources:
  outdoor_temp:
    type: entity
    entity: sensor.outdoor_temperature

overlays:
  - id: temp_value
    type: text
    position: [100, 50]
    content: "{outdoor_temp:.1f}°C"
    style:
      font_size: 24
      color: var(--lcars-orange)
```

### Transformation Access

Access transformed values using dot notation:

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.outdoor_temperature_f
    transformations:
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"

overlays:
  - id: temp_display
    type: text
    position: [100, 50]
    content: |
      Raw: {temperature:.1f}°F
      Celsius: {temperature.transformations.celsius:.1f}°C
      Smoothed: {temperature.transformations.smoothed:.1f}°C
    style:
      multiline: true
      font_size: 14
```

### Aggregation Access

Display aggregated statistics:

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.temperature
    aggregations:
      moving_average:
        window: "5m"
        key: "avg_5m"
      min_max:
        window: "1h"
        key: "hourly"

overlays:
  - id: temp_stats
    type: text
    position: [100, 50]
    content: |
      Current: {temperature:.1f}°C
      5min Avg: {temperature.aggregations.avg_5m.value:.1f}°C
      Hour Min: {temperature.aggregations.hourly.min:.1f}°C
      Hour Max: {temperature.aggregations.hourly.max:.1f}°C
    style:
      multiline: true
      line_height: 1.5
```

### Computed Source Access

Use computed sources for calculations:

```yaml
data_sources:
  heat_index:
    type: computed
    inputs:
      - sensor.temperature
      - sensor.humidity
    expression: >
      0.5 * (inputs[0] + 61.0 +
      ((inputs[0] - 68.0) * 1.2) +
      (inputs[1] * 0.094))

overlays:
  - id: heat_index_display
    type: text
    position: [100, 50]
    content: "Heat Index: {heat_index:.1f}°F"
    style:
      font_size: 16
      color: var(--lcars-red)
```

### Multi-Source Templates

Combine multiple datasources in one text overlay:

```yaml
data_sources:
  temp:
    type: entity
    entity: sensor.temperature
  humidity:
    type: entity
    entity: sensor.humidity
  pressure:
    type: entity
    entity: sensor.pressure

overlays:
  - id: weather_panel
    type: text
    position: [100, 50]
    content: |
      🌡️ Temperature: {temp:.1f}°C
      💧 Humidity: {humidity:.0f}%
      ⛅ Pressure: {pressure:.0f} hPa
    style:
      multiline: true
      font_size: 14
      color: var(--lcars-white)
```

### Formatting Options

Template strings support Python-style formatting:

| Format | Description | Example Input | Example Output |
|--------|-------------|---------------|----------------|
| `{value}` | Raw value | `23.456` | `23.456` |
| `{value:.0f}` | No decimals | `23.456` | `23` |
| `{value:.1f}` | 1 decimal | `23.456` | `23.5` |
| `{value:.2f}` | 2 decimals | `23.456` | `23.46` |
| `{value:+.1f}` | Show sign | `23.456` | `+23.5` |
| `{value:d}` | Integer | `23.456` | `23` |

---

## Typography & Styling

Text overlays provide comprehensive typography control with automatic font scaling.

### Font Properties

#### Basic Font Configuration

```yaml
style:
  font_family: "Orbitron, monospace"   # Font stack with fallbacks
  font_size: 18                        # Fixed size in pixels
  font_weight: bold                    # Weight: normal, bold, 100-900
  font_style: italic                   # Style: normal, italic, oblique
  color: var(--lcars-orange)           # Text color (CSS color value)
```

#### Scalable Font Sizing

For responsive text that scales with your viewport:

```yaml
style:
  font_size:
    value: 16              # Base size at reference viewBox
    scale: viewbox         # Scale with viewBox dimensions
    unit: px               # Output unit (px, em, rem)
```

**When to use:**
- ✅ Use **scalable sizing** for responsive dashboards
- ✅ Use **fixed sizing** for precise pixel-perfect layouts

#### Font Scaling with Profiles

The recommended approach for consistent scaling across your dashboard:

```yaml
# Define in profiles for automatic inheritance
profiles:
  - id: responsive
    defaults:
      text:
        font_size:
          value: 14
          scale: viewbox
          unit: px

overlays:
  - type: text
    id: auto_scaled
    position: [100, 50]
    content: "This scales automatically"
    # Inherits scalable font_size from profile

  - type: text
    id: custom_scaled
    position: [100, 80]
    content: "Custom scaling"
    style:
      font_size:
        value: 20
        scale: viewbox
        unit: px

  - type: text
    id: fixed_size
    position: [100, 110]
    content: "Fixed size"
    style:
      font_size: 16    # Simple number = no scaling
```

### Text Alignment

Control horizontal and vertical alignment:

```yaml
style:
  # Horizontal alignment
  text_anchor: middle        # start, middle, end

  # Vertical alignment
  dominant_baseline: middle  # auto, middle, hanging, central
```

**Common combinations:**

| Use Case | text_anchor | dominant_baseline |
|----------|-------------|-------------------|
| Top-left | `start` | `hanging` |
| Top-center | `middle` | `hanging` |
| Center | `middle` | `middle` |
| Bottom-right | `end` | `auto` |

### Advanced Typography

```yaml
style:
  letter_spacing: 0.1em      # Spacing between letters
  word_spacing: 0.2em        # Spacing between words
  text_decoration: underline # none, underline, overline, line-through
  opacity: 0.9               # Overall text opacity (0-1)
```

### Colors & Fills

#### Solid Colors

```yaml
style:
  color: var(--lcars-orange)    # Use LCARS theme colors
  # OR
  color: "#FF9900"              # Hex color
  # OR
  color: "rgb(255, 153, 0)"     # RGB
  # OR
  color: "rgba(255, 153, 0, 0.8)" # RGBA with transparency
```

#### Gradient Fills

Create gradient text effects:

```yaml
style:
  gradient:
    type: linear
    direction: horizontal     # horizontal, vertical, diagonal
    stops:
      - offset: "0%"
        color: var(--lcars-orange)
      - offset: "100%"
        color: var(--lcars-red)
```

**Radial gradients:**

```yaml
style:
  gradient:
    type: radial
    cx: "50%"      # Center x
    cy: "50%"      # Center y
    r: "50%"       # Radius
    stops:
      - offset: "0%"
        color: var(--lcars-yellow)
      - offset: "100%"
        color: var(--lcars-orange)
```

### Text Stroke

Add outlines to text:

```yaml
style:
  stroke: var(--lcars-blue)    # Stroke color
  stroke_width: 1              # Stroke thickness
  stroke_opacity: 0.8          # Stroke transparency
  stroke_linecap: round        # round, square, butt
  stroke_linejoin: round       # round, miter, bevel
```

**Dashed stroke:**

```yaml
style:
  stroke: var(--lcars-orange)
  stroke_width: 2
  stroke_dasharray: "4,2"      # 4px dash, 2px gap
```

---

## Multi-line Text

Text overlays support multi-line content with automatic line spacing and layout.

### Enabling Multi-line

```yaml
style:
  multiline: true       # Required for multi-line support
  line_height: 1.4      # Line height multiplier (default: 1.2)
  max_width: 300        # Optional maximum width
```

### Multi-line Content Syntax

Use YAML's pipe notation for multi-line text:

```yaml
content: |
  First line
  Second line
  Third line
```

### Complete Multi-line Example

```yaml
data_sources:
  system_status:
    type: entity
    entity: sensor.system_monitor

overlays:
  - id: status_panel
    type: text
    position: [100, 50]
    content: |
      System Status Dashboard

      CPU: {system_status.cpu:.1f}%
      Memory: {system_status.memory:.1f}%
      Disk: {system_status.disk:.1f}%

      Uptime: {system_status.uptime}
      Last Update: {system_status.last_update}
    style:
      multiline: true
      line_height: 1.5
      font_size: 14
      color: var(--lcars-white)
      font_family: "Courier New, monospace"
```

### Line Height Examples

```yaml
# Compact spacing
style:
  multiline: true
  line_height: 1.2

# Normal spacing (default)
style:
  multiline: true
  line_height: 1.4

# Spacious layout
style:
  multiline: true
  line_height: 1.8
```

---

## Interactive Actions

Text overlays support **full Home Assistant actions**, making your text elements clickable and functional.

### Action Types

Text overlays support three interaction types:

| Action Type | Trigger | Common Uses |
|-------------|---------|-------------|
| `tap_action` | Single click/tap | Primary action (toggle, navigate, more-info) |
| `hold_action` | Long press | Secondary action (settings, context menu) |
| `double_tap_action` | Double click/tap | Tertiary action (advanced controls) |

### Simple Actions

#### Toggle Entity

```yaml
overlays:
  - id: light_label
    type: text
    position: [100, 50]
    content: "Living Room Lights"
    tap_action:
      action: toggle
      entity: light.living_room
    style:
      color: var(--lcars-blue)
```

#### Show More Info

```yaml
overlays:
  - id: temp_display
    type: text
    position: [100, 50]
    content: "Temperature: {temperature:.1f}°C"
    tap_action:
      action: more-info
      entity: sensor.temperature
```

### Navigation Actions

```yaml
overlays:
  - id: room_label
    type: text
    position: [100, 50]
    content: "Living Room →"
    tap_action:
      action: navigate
      navigation_path: /lovelace/living-room
    style:
      color: var(--lcars-orange)
```

### Service Calls

Call any Home Assistant service:

```yaml
overlays:
  - id: climate_control
    type: text
    position: [100, 50]
    content: "Set Temperature"
    tap_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.living_room
        temperature: 22
    hold_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.living_room
        temperature: 18
```

### Multiple Actions

Combine tap, hold, and double-tap:

```yaml
overlays:
  - id: multi_action_text
    type: text
    position: [100, 50]
    content: "Living Room: {temperature:.1f}°C"

    # Tap: Show more info
    tap_action:
      action: more-info
      entity: sensor.living_room_temperature

    # Hold: Toggle fan
    hold_action:
      action: toggle
      entity: switch.living_room_fan

    # Double-tap: Adjust temperature
    double_tap_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.living_room
        temperature: 22
```

### URL Actions

Open external or internal URLs:

```yaml
overlays:
  - id: link_text
    type: text
    position: [100, 50]
    content: "Documentation →"
    tap_action:
      action: url
      url_path: https://github.com/snootched/cb-lcars
      new_tab: true   # Open in new tab
```

### Template Actions

Use Home Assistant templates in actions:

```yaml
overlays:
  - id: dynamic_action
    type: text
    position: [100, 50]
    content: "Current: {temperature:.1f}°C"
    tap_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.living_room
        # Template: Set to current temp + 1
        temperature: "{{ states('sensor.living_room_temperature') | float + 1 }}"
```

### Action Best Practices

✅ **DO:**
- Use intuitive action mappings (tap = primary, hold = secondary)
- Provide visual feedback (actions automatically add pointer cursor)
- Test on both desktop and mobile devices
- Use entity references for better performance

❌ **DON'T:**
- Don't use complex templates in actions (keep them simple)
- Don't forget to test hold actions on touch devices
- Don't hide important actions behind double-tap (harder to discover)

---

## Effects & Decorations

Add visual effects and LCARS-themed decorations to enhance your text overlays.

### Glow Effect

Create glowing text:

```yaml
style:
  color: var(--lcars-yellow)
  glow:
    color: var(--lcars-yellow)
    blur: 4               # Glow radius
    intensity: 0.8        # Glow strength (0-1)
```

**Multiple glow layers:**

```yaml
style:
  glow:
    - color: var(--lcars-yellow)
      blur: 2
      intensity: 1.0
    - color: var(--lcars-orange)
      blur: 8
      intensity: 0.5
```

### Drop Shadow

Add shadows for depth:

```yaml
style:
  shadow:
    offset_x: 2           # Horizontal offset
    offset_y: 2           # Vertical offset
    blur: 3               # Shadow blur
    color: "rgba(0,0,0,0.5)" # Shadow color
```

### Blur Effect

Blur text for backgrounds or effects:

```yaml
style:
  blur: 1.5              # Blur radius
  opacity: 0.5           # Often combined with blur
```

### Status Indicator

Add a circular status dot next to text:

```yaml
style:
  status_indicator: var(--lcars-green)     # Enable with color
  status_indicator_position: left-center   # Positioning
  status_indicator_size: 8                 # Size in pixels (optional)
  status_indicator_padding: 12             # Gap from text (optional)
```

**Available positions:**
- `top-left`, `top`, `top-right`
- `left-center`, `center`, `right-center`
- `bottom-left`, `bottom`, `bottom-right`

**Status indicator examples:**

```yaml
# Default automatic sizing (30% of font size)
style:
  status_indicator: var(--lcars-green)
  status_indicator_position: right-center

# Small, close indicator
style:
  status_indicator: var(--lcars-yellow)
  status_indicator_size: 4
  status_indicator_padding: 4
  status_indicator_position: top-right

# Large, distant indicator
style:
  status_indicator: var(--lcars-red)
  status_indicator_size: 15
  status_indicator_padding: 20
  status_indicator_position: left-center
```

### LCARS Brackets

Add decorative LCARS-style brackets:

```yaml
style:
  bracket_style: true
  bracket_color: var(--lcars-orange)    # Optional custom color
```

### Highlight Background

Add a highlight behind text:

```yaml
style:
  highlight: var(--lcars-blue-light)
  highlight_opacity: 0.3
```

### Combined Effects Example

```yaml
overlays:
  - id: fancy_text
    type: text
    position: [100, 50]
    content: "⚠️ ALERT STATUS"
    style:
      font_size: 24
      font_weight: bold
      color: var(--lcars-red)

      # Glow effect
      glow:
        color: var(--lcars-red)
        blur: 6
        intensity: 0.9

      # Drop shadow
      shadow:
        offset_x: 2
        offset_y: 2
        blur: 4
        color: "rgba(0,0,0,0.7)"

      # Status indicator
      status_indicator: var(--lcars-red)
      status_indicator_position: left-center
      status_indicator_size: 10

      # Highlight background
      highlight: var(--lcars-red)
      highlight_opacity: 0.2
```

---

## Complete Property Reference

### Text Overlay Schema

```yaml
overlays:
  - id: string                    # Required: Unique identifier
    type: text                    # Required: Must be "text"
    position: [x, y]              # Required: [x, y] coordinates

    # Content Sources (choose one)
    content: string               # Static or template string
    text: string                  # Alternative to content
    data_source: string           # DataSource reference (legacy)

    # Interactive Actions
    tap_action: object            # Action on tap/click
    hold_action: object           # Action on hold/long press
    double_tap_action: object     # Action on double-tap

    style:                        # Optional styling
      # Core Typography
      color: string               # Text color (default: var(--lcars-orange))
      font_size: number|object    # Font size (default: 16)
      font_family: string         # Font family (default: inherit)
      font_weight: string|number  # Font weight (default: normal)
      font_style: string          # Font style (default: normal)

      # Text Layout
      text_anchor: string         # start|middle|end (default: start)
      dominant_baseline: string   # Vertical alignment (default: auto)
      alignment_baseline: string  # Alternative baseline (default: auto)
      letter_spacing: string|num  # Letter spacing (default: normal)
      word_spacing: string|num    # Word spacing (default: normal)
      text_decoration: string     # Decoration (default: none)

      # Multi-line Support
      multiline: boolean          # Enable multi-line (default: false)
      line_height: number         # Line height multiplier (default: 1.2)
      max_width: number           # Maximum width (default: 0)

      # Appearance
      opacity: number             # Overall opacity (default: 1.0)
      visibility: string          # Visibility (default: visible)

      # Advanced Fills
      gradient: object            # Gradient definition
      pattern: object|string      # Pattern definition

      # Stroke Properties
      stroke: string              # Stroke color
      stroke_width: number        # Stroke width (default: 0)
      stroke_opacity: number      # Stroke opacity (default: 1.0)
      stroke_linecap: string      # Stroke line cap (default: butt)
      stroke_linejoin: string     # Stroke line join (default: miter)
      stroke_dasharray: string    # Stroke dash pattern
      stroke_dashoffset: number   # Stroke dash offset (default: 0)

      # Effects
      glow: object|string         # Glow effect
      shadow: object|string       # Shadow effect
      blur: number|object         # Blur effect

      # LCARS Decorations
      bracket_style: boolean|str  # Enable brackets (default: false)
      bracket_color: string       # Bracket color
      status_indicator: bool|str  # Status indicator (default: null)
      status_indicator_position: string # Status position (default: left-center)
      status_indicator_size: num  # Status size in px (default: 30% of font)
      status_indicator_padding: num # Gap from text edge in px (default: 8)
      highlight: boolean|string   # Highlight background (default: false)
      highlight_opacity: number   # Highlight opacity (default: 0.3)

      # Legacy/Alternative Properties
      value: string               # Alternative to content
      value_format: string        # Format template for datasource values
      format: string              # Alternative to value_format
```

### Font Size Object Format

```yaml
font_size: 16                     # Simple numeric (no scaling)

# OR

font_size:                        # Object format (enables scaling)
  value: 16                       # Base size value
  scale: viewbox                  # Scaling mode: viewbox, container, none
  unit: px                        # Output unit: px, em, rem
```

### Gradient Definition

```yaml
gradient:
  type: linear                    # linear or radial
  direction: horizontal           # horizontal, vertical, diagonal
  stops:
    - offset: "0%"
      color: var(--lcars-orange)
    - offset: "50%"
      color: var(--lcars-yellow)
    - offset: "100%"
      color: var(--lcars-red)
```

### Effect Definitions

```yaml
# Glow
glow:
  color: var(--lcars-yellow)
  blur: 4
  intensity: 0.8

# Shadow
shadow:
  offset_x: 2
  offset_y: 2
  blur: 3
  color: "rgba(0,0,0,0.5)"
```

---

## Real-World Examples

### Example 1: Temperature Monitor

```yaml
data_sources:
  living_temp:
    type: entity
    entity: sensor.living_room_temperature
    windowSeconds: 3600
    transformations:
      - type: smooth
        method: exponential
        alpha: 0.3
        key: smoothed
    aggregations:
      moving_average:
        window: "5m"
        key: avg_5m
      min_max:
        window: "1h"
        key: hourly

overlays:
  - id: temp_panel
    type: text
    position: [100, 50]
    content: |
      🌡️ Living Room Temperature

      Current: {living_temp.transformations.smoothed:.1f}°C
      5min Avg: {living_temp.aggregations.avg_5m.value:.1f}°C

      Hourly Range
      Min: {living_temp.aggregations.hourly.min:.1f}°C
      Max: {living_temp.aggregations.hourly.max:.1f}°C

    tap_action:
      action: more-info
      entity: sensor.living_room_temperature

    style:
      multiline: true
      line_height: 1.5
      font_size: 14
      font_family: "Orbitron, monospace"
      color: var(--lcars-white)

      # Status indicator
      status_indicator: var(--lcars-green)
      status_indicator_position: left-center
```

### Example 2: Power Dashboard

```yaml
data_sources:
  house_power:
    type: entity
    entity: sensor.house_power_watts
    transformations:
      - type: unit_conversion
        conversion: w_to_kw
        key: kilowatts
    aggregations:
      moving_average:
        window: "15m"
        key: avg_15m
      session_stats:
        key: session

overlays:
  - id: power_display
    type: text
    position: [500, 100]
    content: |
      ⚡ Power Monitor

      Current: {house_power.transformations.kilowatts:.2f} kW
      15min Avg: {house_power.aggregations.avg_15m.value:.2f} kW
      Peak: {house_power.aggregations.session.max:.2f} kW

    tap_action:
      action: navigate
      navigation_path: /lovelace/energy

    style:
      multiline: true
      line_height: 1.6
      font_size: 16
      color: var(--lcars-orange)

      glow:
        color: var(--lcars-orange)
        blur: 4
        intensity: 0.6
```

### Example 3: Status Grid Labels

```yaml
overlays:
  # Section header
  - id: section_header
    type: text
    position: [100, 50]
    content: "🏠 ROOM CONTROLS"
    style:
      font_size: 20
      font_weight: bold
      color: var(--lcars-orange)
      bracket_style: true

  # Interactive room labels
  - id: living_room_label
    type: text
    position: [100, 100]
    content: "Living Room"
    tap_action:
      action: navigate
      navigation_path: /lovelace/living-room
    style:
      font_size: 16
      color: var(--lcars-blue)
      status_indicator: var(--lcars-green)
      status_indicator_position: left-center

  - id: bedroom_label
    type: text
    position: [100, 130]
    content: "Bedroom"
    tap_action:
      action: navigate
      navigation_path: /lovelace/bedroom
    style:
      font_size: 16
      color: var(--lcars-blue)
      status_indicator: var(--lcars-yellow)
      status_indicator_position: left-center

  - id: kitchen_label
    type: text
    position: [100, 160]
    content: "Kitchen"
    tap_action:
      action: navigate
      navigation_path: /lovelace/kitchen
    style:
      font_size: 16
      color: var(--lcars-blue)
      status_indicator: var(--lcars-green)
      status_indicator_position: left-center
```

### Example 4: Multi-Sensor Dashboard

```yaml
data_sources:
  temp:
    type: entity
    entity: sensor.temperature
  humidity:
    type: entity
    entity: sensor.humidity
  pressure:
    type: entity
    entity: sensor.pressure
    transformations:
      - type: unit_conversion
        conversion: hpa_to_inhg
        key: inches
  air_quality:
    type: entity
    entity: sensor.air_quality_pm25

overlays:
  - id: environmental_dashboard
    type: text
    position: [900, 100]
    content: |
      🌤️ Environmental Monitor

      Temperature: {temp:.1f}°C
      Humidity: {humidity:.0f}%
      Pressure: {pressure.transformations.inches:.2f} inHg
      Air Quality: {air_quality:.0f} µg/m³

      Last Update: {{ relative_time(states.sensor.temperature.last_changed) }}

    tap_action:
      action: navigate
      navigation_path: /lovelace/environment

    style:
      multiline: true
      line_height: 1.5
      font_size: 14
      font_family: "Courier New, monospace"
      color: var(--lcars-white)

      highlight: var(--lcars-blue)
      highlight_opacity: 0.2

      status_indicator: var(--lcars-green)
      status_indicator_position: top-left
```

---

## Troubleshooting

### DataSource Template Not Working

**Symptoms:** Template strings showing as literal text like `{temperature:.1f}°C`

**Solutions:**
1. ✅ Verify datasource name matches your configuration
2. ✅ Check template syntax: `{source_name.transformations.key:.1f}`
3. ✅ Ensure datasource is initialized and has data
4. ✅ Test datasource access in console:

```javascript
const dsm = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;
console.log('Source data:', dsm.getSource('temperature')?.getCurrentData());
```

### Formatting Not Applied

**Symptoms:** Numbers showing with wrong decimal places or no formatting

**Solutions:**
1. ✅ Check format specification syntax: `{value:.2f}` (note the colon)
2. ✅ Verify datasource returns numeric values
3. ✅ Test with simple format first: `{value}`
4. ✅ Check console for template processing errors

### Multi-line Text Not Working

**Symptoms:** Multi-line text displaying as single line or incorrectly spaced

**Solutions:**
1. ✅ Enable `multiline: true` in style
2. ✅ Use pipe notation `|` for multi-line content in YAML
3. ✅ Adjust `line_height` for proper spacing (try 1.4 or 1.5)
4. ✅ Check for text overflow with `max_width`

### Effects Not Visible

**Symptoms:** Glow, shadow, or other effects not appearing

**Solutions:**
1. ✅ Verify effect configuration syntax matches documentation
2. ✅ Check CSS variable availability (`var(--lcars-*)`)
3. ✅ Test with static colors first (e.g., `"#FF9900"`)
4. ✅ Ensure SVG filter support in browser
5. ✅ Check z-index/stacking order with other overlays

### Status Indicators Misaligned

**Symptoms:** Status indicator dots in wrong position relative to text

**Solutions:**
1. ✅ Verify `status_indicator_position` spelling and values
2. ✅ Adjust `status_indicator_padding` for distance from text
3. ✅ Try different `text_anchor` settings
4. ✅ Check font stabilization has completed

### Actions Not Working

**Symptoms:** Text clicks/taps don't trigger actions

**Solutions:**
1. ✅ Check console for action attachment messages
2. ✅ Verify entity exists in Home Assistant
3. ✅ Test with simple actions first (`toggle` or `more-info`)
4. ✅ Ensure proper YAML indentation in action definitions
5. ✅ Test on both desktop and mobile

### Debug Commands

#### Inspect Text Overlays

```javascript
// Find all text overlays
const textOverlays = document.querySelectorAll('[data-overlay-type="text"]');
console.log('Found text overlays:', textOverlays.length);

// Check specific overlay details
textOverlays.forEach(el => {
  console.log(`Text ${el.getAttribute('data-overlay-id')}:`, {
    content: el.textContent,
    width: el.getAttribute('data-text-width'),
    height: el.getAttribute('data-text-height'),
    fontFamily: el.getAttribute('data-font-family'),
    fontSize: el.getAttribute('data-font-size')
  });
});
```

#### Test DataSource Access

```javascript
// Access DataSource Manager
const dsm = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;

// List all sources
console.log('Available sources:', dsm.listSources());

// Inspect specific source
const source = dsm.getSource('temperature');
console.log('Source data:', {
  value: source.getCurrentData(),
  transformations: source.getAllTransformations(),
  aggregations: source.getAllAggregations()
});
```

#### Test Template Processing

```javascript
// Manual template test
const testContent = "Temp: {temperature.transformations.celsius:.1f}°C";
console.log('Template:', testContent);

// Check if DataSource exists
const dsm = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;
console.log('DataSource exists:', dsm.getSource('temperature') !== null);
```

---

## 📚 Related Documentation

- **[DataSources Configuration Guide](../datasources.md)** - Learn about datasource system
- **[Transformation Reference](../datasource-transformations.md)** - 50+ unit conversions
- **[Aggregation Reference](../datasource-aggregations.md)** - Statistical aggregations
- **[DataSource Examples](../../examples/datasource-examples.md)** - Complete real-world examples
- **[Button Overlay](button-overlay.md)** - Interactive button configuration
- **[Line Overlay](line-overlay.md)** - Connecting overlays with lines
- **[ApexCharts Overlay](apexcharts-overlay.md)** - Advanced charting

---

**Last Updated:** October 26, 2025
**Version:** 2025.10.1-fuk.42-69
