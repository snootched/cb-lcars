# Status Grid Overlay Configuration Guide

> **Multi-cell status visualization with individual control**
> Create sophisticated status grids with per-cell data binding, interactive actions, and LCARS styling.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Core Configuration](#core-configuration)
4. [Grid Layout](#grid-layout)
5. [Cell Configuration](#cell-configuration)
6. [DataSource Integration](#datasource-integration)
7. [Interactive Actions](#interactive-actions)
8. [Status Detection](#status-detection)
9. [Text Positioning](#text-positioning)
10. [Styling](#styling)
11. [LCARS Features](#lcars-features)
12. [Animation](#animation)
13. [Complete Property Reference](#complete-property-reference)
14. [Real-World Examples](#real-world-examples)
15. [Troubleshooting](#troubleshooting)

---

## Overview

The **Status Grid Overlay** provides multi-cell status visualization with individual cell control, perfect for monitoring multiple sensors, devices, or system metrics in a compact grid format.

✅ **Multi-entity monitoring** - Track multiple data sources in one grid
✅ **Per-cell control** - Individual styling, actions, and data binding
✅ **Flexible layouts** - Configurable rows, columns, and proportional sizing
✅ **Interactive actions** - Tap, hold, double-tap actions per cell or grid
✅ **DataSource integration** - Real-time updates with template strings
✅ **Status detection** - Automatic color coding based on state or ranges
✅ **LCARS styling** - Brackets, corners, status indicators
✅ **Cascade animations** - Perfect for anime.js integration
✅ **Responsive scaling** - MSD Defaults integration for consistent sizing

### When to Use Status Grids

- **Multi-sensor monitoring** - Temperature, humidity, pressure across rooms
- **System dashboards** - CPU, memory, disk, network metrics
- **Device control panels** - Multiple lights, switches, fans in one grid
- **Status overviews** - Quick glance at multiple binary sensors
- **Process monitoring** - Pipeline steps, workflow stages
- **Network status** - Multiple connection states or device availability

---

## Quick Start

### Minimal Configuration

The absolute minimum needed for a status grid:

```yaml
overlays:
  - id: basic_grid
    type: status_grid
    position: [100, 100]
    size: [200, 150]
    style:
      rows: 3
      columns: 4
```

**Result:** A 3×4 grid with 12 empty cells.

### With Data Sources

Connect cells to live data:

```yaml
data_sources:
  living_room_temp:
    type: entity
    entity: sensor.living_room_temperature

  kitchen_temp:
    type: entity
    entity: sensor.kitchen_temperature

overlays:
  - id: temp_grid
    type: status_grid
    position: [100, 100]
    size: [240, 120]

    cells:
      - position: [0, 0]
        source: living_room_temp
        label: "Living Room"
        content: "{living_room_temp:.1f}°F"

      - position: [0, 1]
        source: kitchen_temp
        label: "Kitchen"
        content: "{kitchen_temp:.1f}°F"

    style:
      rows: 1
      columns: 2
      cell_gap: 4
      show_labels: true
      cell_color: var(--lcars-blue)
```

**Result:** Two cells showing live temperature data.

### With Interactive Actions

Make cells clickable:

```yaml
overlays:
  - id: control_grid
    type: status_grid
    position: [100, 100]
    size: [240, 80]

    cells:
      - position: [0, 0]
        label: "Living Room"
        content: "ON"
        tap_action:
          action: toggle
          entity: light.living_room

      - position: [0, 1]
        label: "Kitchen"
        content: "OFF"
        tap_action:
          action: toggle
          entity: light.kitchen

    style:
      rows: 1
      columns: 2
      show_labels: true
```

**Result:** Two cells that toggle lights on tap.

---

## Core Configuration

### Required Properties

Every status grid overlay must have these properties:

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `id` | string | Unique identifier | `"status_grid1"` |
| `type` | string | Must be `"status_grid"` | `"status_grid"` |
| `position` | array | [x, y] coordinates | `[100, 100]` |

### Core Optional Properties

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `size` | array | [width, height] in pixels | `[200, 150]` |
| `cells` | array | Cell definitions | `[]` |
| `sources` | array | Auto-generate cells from sources | `[]` |

### Basic Example

```yaml
overlays:
  - id: my_grid
    type: status_grid
    position: [100, 100]
    size: [300, 200]

    cells:
      - position: [0, 0]
        label: "Cell 1"
      - position: [0, 1]
        label: "Cell 2"
      - position: [1, 0]
        label: "Cell 3"
      - position: [1, 1]
        label: "Cell 4"

    style:
      rows: 2
      columns: 2
      cell_gap: 3
      cell_color: var(--lcars-blue)
```

---

## Grid Layout

Control the grid structure with rows, columns, gaps, and proportional sizing.

### Basic Grid Structure

```yaml
style:
  rows: 3                    # Number of rows
  columns: 4                 # Number of columns
  cell_gap: 2                # Gap between cells (pixels)
```

**Cell count:** Automatically calculated as `rows × columns` (3 × 4 = 12 cells).

### Cell Sizing

#### Automatic Sizing (Default)
```yaml
style:
  rows: 2
  columns: 3
  # Cells automatically sized to fill grid evenly
```

#### Fixed Cell Size
```yaml
style:
  rows: 2
  columns: 3
  cell_width: 60            # Fixed width per cell
  cell_height: 40           # Fixed height per cell
```

### Proportional Sizing

Create grids with varying row heights or column widths:

#### Proportional Rows
```yaml
style:
  rows: 3
  columns: 2
  row_sizes: [1, 2, 1]      # Middle row is 2x taller
```

**Result:**
- Row 0: 25% of height (ratio 1)
- Row 1: 50% of height (ratio 2)
- Row 2: 25% of height (ratio 1)

#### Proportional Columns
```yaml
style:
  rows: 2
  columns: 3
  column_sizes: [2, 1, 1]   # First column is 2x wider
```

**Result:**
- Column 0: 50% of width (ratio 2)
- Column 1: 25% of width (ratio 1)
- Column 2: 25% of width (ratio 1)

#### Mixed Units
```yaml
style:
  rows: 3
  row_heights: ["30%", 50, "20%"]  # Mix percentages and pixels

  columns: 3
  column_widths: [100, "40%", "auto"]  # Mix pixels, percentages, auto
```

### Grid Lines

Add visual grid lines between cells:

```yaml
style:
  show_grid_lines: true
  grid_line_color: var(--lcars-gray)
  grid_line_opacity: 0.3
  grid_line_width: 1
```

### Layout Examples

#### Uniform Grid
```yaml
style:
  rows: 3
  columns: 4
  cell_gap: 2
  # All cells same size
```

#### Header Row
```yaml
style:
  rows: 4
  columns: 3
  row_sizes: [2, 1, 1, 1]   # First row is header (2x height)
  cell_gap: 3
```

#### Sidebar Layout
```yaml
style:
  rows: 3
  columns: 3
  column_sizes: [2, 1, 1]   # First column is sidebar (2x width)
  cell_gap: 2
```

---

## Cell Configuration

Define individual cells with data, labels, styling, and actions.

### Cell Position

Cells are positioned using `[row, column]` coordinates (zero-indexed):

```yaml
cells:
  - position: [0, 0]        # Top-left cell
  - position: [0, 1]        # Top-center cell
  - position: [0, 2]        # Top-right cell
  - position: [1, 0]        # Middle-left cell
```

### Cell Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `id` | string | Cell identifier | `"temp_cell"` |
| `position` | array | [row, col] position | `[0, 0]` |
| `source` | string | DataSource reference | `"temperature"` |
| `label` | string | Cell label text | `"Living Room"` |
| `content` | string | Template string | `"{temp:.1f}°F"` |
| `value` | any | Static value | `42` |
| `color` | string | Override cell color | `"var(--lcars-red)"` |
| `radius` | number | Override corner radius | `5` |
| `font_size` | number | Override font size | `12` |

### Cell Examples

#### Simple Label
```yaml
cells:
  - position: [0, 0]
    label: "CPU"
```

#### With Static Value
```yaml
cells:
  - position: [0, 0]
    label: "Status"
    value: "ONLINE"
```

#### With DataSource
```yaml
cells:
  - position: [0, 0]
    source: temperature
    label: "Temp"
    content: "{temperature:.1f}°C"
```

#### With Custom Styling
```yaml
cells:
  - position: [0, 0]
    label: "Warning"
    value: "HIGH"
    color: var(--lcars-red)      # Red background
    radius: 0                    # Square corners
    font_size: 14                # Larger text
```

### Auto-Generated Cells

Generate cells automatically from a list of sources:

```yaml
overlays:
  - id: auto_grid
    type: status_grid
    position: [100, 100]
    size: [280, 140]

    # Auto-generate from sources
    sources:
      - temperature.living_room
      - temperature.kitchen
      - temperature.bedroom
      - humidity.living_room
      - humidity.kitchen
      - humidity.bedroom

    style:
      rows: 2
      columns: 3
      show_labels: true
```

**Result:** 6 cells automatically created, one per source.

---

## DataSource Integration

Connect cells to live data with template strings and transformations.

### Basic DataSource Binding

```yaml
data_sources:
  cpu_usage:
    type: entity
    entity: sensor.cpu_usage

overlays:
  - id: system_grid
    type: status_grid
    position: [100, 100]
    size: [200, 100]

    cells:
      - position: [0, 0]
        source: cpu_usage           # Reference DataSource
        label: "CPU"
        content: "{cpu_usage:.0f}%"  # Format with template
```

### Template Strings

Use template strings in `content` for formatted output:

```yaml
# Number formatting
content: "{temperature:.1f}°C"       # One decimal: "23.4°C"
content: "{power:.2f} kW"            # Two decimals: "1.23 kW"
content: "{count:.0f}"               # No decimals: "42"

# String values
content: "{status}"                  # Direct value: "ON"
content: "Status: {status}"          # With prefix: "Status: ON"

# Conditional display
content: >
  {temperature > 25 ? 'HOT' : 'OK'}  # Conditional: "HOT" or "OK"
```

### Transformation Access

Access transformed data:

```yaml
data_sources:
  power_meter:
    type: entity
    entity: sensor.power_watts
    transformations:
      - type: unit_conversion
        conversion: "watts_to_kilowatts"
        key: "kilowatts"

overlays:
  - id: power_grid
    type: status_grid
    position: [100, 100]
    size: [150, 80]

    cells:
      - position: [0, 0]
        source: power_meter.transformations.kilowatts
        label: "Power"
        content: "{power_meter.transformations.kilowatts:.2f} kW"
```

### Aggregation Access

Use aggregated values:

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.temperature
    aggregations:
      - type: average
        window: 3600
        key: "avg_1h"

      - type: max
        window: 3600
        key: "max_1h"

overlays:
  - id: stats_grid
    type: status_grid
    position: [100, 100]
    size: [200, 100]

    cells:
      - position: [0, 0]
        source: temperature.aggregations.avg_1h
        label: "Avg (1h)"
        content: "{temperature.aggregations.avg_1h:.1f}°C"

      - position: [0, 1]
        source: temperature.aggregations.max_1h
        label: "Max (1h)"
        content: "{temperature.aggregations.max_1h:.1f}°C"
```

### Multiple Data Sources

Combine data from multiple sources:

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
  - id: weather_grid
    type: status_grid
    position: [100, 100]
    size: [240, 80]

    cells:
      - position: [0, 0]
        source: temp
        label: "Temp"
        content: "{temp:.1f}°C"

      - position: [0, 1]
        source: humidity
        label: "Humidity"
        content: "{humidity:.0f}%"

      - position: [0, 2]
        source: pressure
        label: "Pressure"
        content: "{pressure:.0f} hPa"

    style:
      rows: 1
      columns: 3
```

---

## Interactive Actions

Make status grids interactive with Home Assistant actions.

### Action Types

Status grids support three action triggers:
- **`tap_action`** - Single tap/click
- **`hold_action`** - Long press
- **`double_tap_action`** - Double tap/click

### Grid-Level Actions

Apply actions to the entire grid:

```yaml
overlays:
  - id: system_grid
    type: status_grid
    position: [100, 100]
    size: [300, 200]

    # Grid-level actions (fallback)
    tap_action:
      action: navigate
      navigation_path: /lovelace/system

    hold_action:
      action: more-info
      entity: binary_sensor.system_status

    cells:
      - position: [0, 0]
        label: "CPU"
      - position: [0, 1]
        label: "Memory"
```

### Cell-Level Actions (Recommended)

Define actions per cell for granular control:

```yaml
overlays:
  - id: control_grid
    type: status_grid
    position: [100, 100]
    size: [300, 150]

    cells:
      # Light control
      - position: [0, 0]
        label: "Living Room"
        content: "ON"
        tap_action:
          action: toggle
          entity: light.living_room
        hold_action:
          action: more-info
          entity: light.living_room

      # Fan control
      - position: [0, 1]
        label: "Ceiling Fan"
        content: "OFF"
        tap_action:
          action: toggle
          entity: fan.ceiling_fan
        double_tap_action:
          action: call-service
          service: fan.set_speed
          service_data:
            entity_id: fan.ceiling_fan
            speed: high

      # Thermostat
      - position: [1, 0]
        label: "Thermostat"
        content: "72°F"
        tap_action:
          action: more-info
          entity: climate.house
        hold_action:
          action: call-service
          service: climate.set_temperature
          service_data:
            entity_id: climate.house
            temperature: 68

    style:
      rows: 2
      columns: 2
```

### Available Action Types

| Action | Description | Common Use |
|--------|-------------|------------|
| `toggle` | Toggle entity on/off | Lights, switches |
| `more-info` | Show entity details | Any entity |
| `call-service` | Call HA service | Custom actions |
| `navigate` | Navigate to path | Dashboards |
| `url` | Open URL | External links |
| `fire-dom-event` | Custom events | Advanced |

### Action Examples

#### Toggle Action
```yaml
tap_action:
  action: toggle
  entity: light.living_room
```

#### More Info Dialog
```yaml
tap_action:
  action: more-info
  entity: sensor.temperature
```

#### Call Service
```yaml
tap_action:
  action: call-service
  service: light.turn_on
  service_data:
    entity_id: light.living_room
    brightness: 255
    color_name: blue
```

#### Navigate to Dashboard
```yaml
tap_action:
  action: navigate
  navigation_path: /lovelace/devices
```

#### Open URL
```yaml
tap_action:
  action: url
  url_path: https://example.com
```

### Action Priority

When both grid-level and cell-level actions are defined:
1. **Cell actions take priority** over grid actions
2. **Cell actions prevent event bubbling** to grid level
3. **Cells without actions** inherit grid-level actions

```yaml
overlays:
  - id: mixed_grid
    type: status_grid
    position: [100, 100]
    size: [200, 100]

    # Default action for all cells
    tap_action:
      action: navigate
      navigation_path: /lovelace/status

    cells:
      # This cell has its own action (overrides grid default)
      - position: [0, 0]
        label: "Light"
        tap_action:
          action: toggle
          entity: light.living_room

      # This cell uses the grid default action
      - position: [0, 1]
        label: "Info"
```

---

## Status Detection

Automatically color cells based on state or numeric ranges.

### Status Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `auto` | Automatic state detection | Binary sensors, switches |
| `ranges` | Numeric range mapping | Temperature, percentage |
| `custom` | Custom state mapping | Complex logic |

### Auto Mode

Automatically detects common states:

```yaml
style:
  status_mode: auto

  # Colors for detected states
  # ON states → green
  # OFF states → gray
  # Warning states → yellow
  # Error states → red
```

**Auto-detected states:**
- `on`, `true`, `active`, `open`, `running` → Green
- `off`, `false`, `inactive`, `closed`, `stopped` → Gray
- `warning`, `alert`, `caution` → Yellow
- `error`, `critical`, `failed` → Red
- `unknown`, `unavailable` → Configured `unknown_color`

### Range Mode

Define numeric ranges with colors:

```yaml
style:
  status_mode: ranges
  status_ranges:
    # Good range (0-60)
    - min: 0
      max: 60
      state: "good"
      color: var(--lcars-green)

    # Warning range (60-80)
    - min: 60
      max: 80
      state: "warning"
      color: var(--lcars-yellow)

    # Critical range (80-100)
    - min: 80
      max: 100
      state: "critical"
      color: var(--lcars-red)
```

### Custom State Mapping

Map specific values to colors:

```yaml
style:
  status_mode: custom
  status_ranges:
    - value: "online"
      color: var(--lcars-green)
      label: "ONLINE"

    - value: "offline"
      color: var(--lcars-red)
      label: "OFFLINE"

    - value: "connecting"
      color: var(--lcars-yellow)
      label: "CONNECTING"
```

### Complete Status Example

```yaml
data_sources:
  cpu_usage:
    type: entity
    entity: sensor.cpu_usage

  memory_usage:
    type: entity
    entity: sensor.memory_usage

overlays:
  - id: system_monitor
    type: status_grid
    position: [100, 100]
    size: [240, 120]

    cells:
      - position: [0, 0]
        source: cpu_usage
        label: "CPU"
        content: "{cpu_usage:.0f}%"

      - position: [0, 1]
        source: memory_usage
        label: "Memory"
        content: "{memory_usage:.0f}%"

    style:
      rows: 1
      columns: 2

      # Status detection with ranges
      status_mode: ranges
      status_ranges:
        - min: 0
          max: 60
          color: var(--lcars-green)

        - min: 60
          max: 80
          color: var(--lcars-yellow)

        - min: 80
          max: 100
          color: var(--lcars-red)

      unknown_color: var(--lcars-gray)
```

---

## Text Positioning

Control label and value positioning within cells.

### Text Layout Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `stacked` | Label above value | Default, most common |
| `side-by-side` | Label and value horizontal | Compact display |
| `label-only` | Only show label | Simple status |
| `value-only` | Only show value | Numeric grids |
| `custom` | Custom positioning | Advanced layouts |

### Basic Text Display

```yaml
style:
  show_labels: true             # Show cell labels
  show_values: true             # Show cell values
  text_layout: stacked          # Stack label above value
```

### Predefined Positions

```yaml
style:
  label_position: top-left      # Label in top-left
  value_position: bottom-right  # Value in bottom-right
```

**Available positions:**
- `top-left`, `top-center`, `top-right`
- `center-left`, `center`, `center-right`
- `bottom-left`, `bottom-center`, `bottom-right`

### Custom Positioning

Precise control with percentages:

```yaml
style:
  label_position:
    x: "20%"                    # 20% from left
    y: "30%"                    # 30% from top

  value_position:
    x: "80%"                    # 80% from left
    y: "70%"                    # 70% from top
```

### Text Alignment

```yaml
style:
  text_alignment: center        # Vertical: top, center, bottom
  text_justify: center          # Horizontal: left, center, right
```

### Text Spacing

```yaml
style:
  text_padding: 8               # Padding from cell edges
  text_margin: 2                # Margin between label/value
  text_spacing: 4               # Vertical spacing
```

### Font Sizing

```yaml
style:
  font_size: 12                 # Global font size
  label_font_size: 14           # Label-specific size
  value_font_size: 10           # Value-specific size
  font_family: Antonio          # Font family
  font_weight: normal           # Font weight
```

### Text Overflow

```yaml
style:
  text_wrap: false              # Enable wrapping
  max_text_width: "90%"         # Maximum width
  text_overflow: ellipsis       # ellipsis, clip, none
```

### Complete Text Example

```yaml
overlays:
  - id: formatted_grid
    type: status_grid
    position: [100, 100]
    size: [300, 200]

    cells:
      - position: [0, 0]
        label: "Temperature"
        content: "72.5°F"

    style:
      rows: 1
      columns: 1

      # Text display
      show_labels: true
      show_values: true
      text_layout: stacked

      # Positioning
      label_position: top-center
      value_position: bottom-center
      text_alignment: center
      text_justify: center

      # Spacing
      text_padding: 10
      text_margin: 4

      # Fonts
      label_font_size: 14
      value_font_size: 18
      font_family: Antonio
      label_color: var(--lcars-white)
      value_color: var(--lcars-blue)

      # Overflow
      text_overflow: ellipsis
      max_text_width: "85%"
```

---

## Styling

Comprehensive styling options for cells, borders, and appearance.

### Cell Colors

```yaml
style:
  cell_color: var(--lcars-blue)    # Default cell color
  cell_opacity: 1.0                # Transparency (0-1)
```

**LCARS color variables:**
- `var(--lcars-blue)`, `var(--lcars-orange)`, `var(--lcars-red)`
- `var(--lcars-yellow)`, `var(--lcars-green)`, `var(--lcars-purple)`
- `var(--lcars-white)`, `var(--lcars-gray)`, `var(--lcars-black)`

### Cell Corners

```yaml
style:
  cell_radius: 3                # Corner radius (pixels)
  normalize_radius: true        # Auto-adjust for consistency
  match_ha_radius: true         # Match Home Assistant card radius
```

### Cell Borders

```yaml
style:
  cell_border: true             # Show borders
  border_color: var(--lcars-gray)
  border_width: 1               # Border thickness
```

### Hover Effects

```yaml
style:
  hover_enabled: true           # Enable hover effects
  hover_color: var(--lcars-yellow)
  hover_scale: 1.05             # Scale factor on hover
```

### Gradients

Add gradient backgrounds to cells:

```yaml
style:
  gradient:
    type: linear
    direction: to bottom
    stops:
      - offset: 0%
        color: var(--lcars-orange)
      - offset: 100%
        color: var(--lcars-red)
```

### Effects

```yaml
style:
  # Glow effect
  glow:
    color: var(--lcars-blue)
    size: 10
    opacity: 0.5

  # Shadow effect
  shadow:
    x: 2
    y: 2
    blur: 4
    color: "rgba(0,0,0,0.5)"
```

### Per-Cell Styling

Override grid styling for individual cells:

```yaml
cells:
  - position: [0, 0]
    label: "Warning"
    color: var(--lcars-red)       # Override cell color
    radius: 0                     # Override radius (square)
    font_size: 16                 # Override font size
```

### Cell-Level Tags

**NEW:** Tag cells for bulk targeting in rules, enabling sophisticated department-based or priority-based updates.

```yaml
cells:
  - position: [0, 0]
    label: "Warp Core"
    tags: ["critical", "propulsion", "engineering"]  # ✨ Cell tags

  - position: [0, 1]
    label: "Life Support"
    tags: ["critical", "environment"]  # ✨ Different tags

  - position: [1, 0]
    label: "Sensors"
    tags: ["secondary", "tactical"]  # ✨ Non-critical system
```

**Targeting Cells by Tags in Rules:**

```yaml
rules:
  # Target single tag
  - when: {entity: input_select.alert, state: "yellow_alert"}
    apply:
      overlays:
        - id: my_grid
          cell_target:
            tag: "critical"  # ✨ Match cells with "critical" tag
          style:
            color: "var(--lcars-yellow)"

  # Target multiple tags (OR logic - default)
  - when: {entity: input_select.alert, state: "engineering_alert"}
    apply:
      overlays:
        - id: my_grid
          cell_target:
            tags: ["engineering", "propulsion"]  # ✨ Match ANY tag
          style:
            color: "var(--lcars-orange)"

  # Target multiple tags (AND logic)
  - when: {entity: input_select.alert, state: "warp_failure"}
    apply:
      overlays:
        - id: my_grid
          cell_target:
            tags: ["critical", "propulsion"]  # ✨ Match BOTH tags
            match_all: true  # ✨ AND logic
          style:
            color: "var(--lcars-red)"
```

**Common Tag Patterns:**
- **By Criticality:** `critical`, `secondary`, `informational`
- **By Department:** `engineering`, `tactical`, `medical`, `communications`
- **By Function:** `propulsion`, `defense`, `weapons`, `environment`

**See:** [Bulk Overlay Selectors Guide](../bulk-overlay-selectors.md) for complete cell tag documentation and examples.

---

## LCARS Features

Add authentic LCARS styling elements.

### LCARS Corners

Classic LCARS corner cut-offs:

```yaml
style:
  lcars_corners: true           # Enable LCARS corners
```

### Bracket Style

Add decorative LCARS brackets:

```yaml
style:
  bracket_style: true           # Enable brackets
  bracket_color: var(--lcars-orange)
  bracket_width: 2              # Stroke width
  bracket_gap: 4                # Distance from grid
  bracket_extension: 8          # Arm length
  bracket_opacity: 1.0
  bracket_corners: both         # both, top, bottom
  bracket_sides: both           # both, left, right
```

### Status Indicator

Add status indicator dots:

```yaml
style:
  status_indicator: var(--lcars-green)   # Indicator color
  # or position-specific
  status_indicator: top-left             # Position
```

### LCARS Presets

Use predefined LCARS button styles:

```yaml
style:
  lcars_text_preset: lozenge    # lozenge, bullet, corner, badge
```

**Preset styles:**
- `lozenge` - Pill-shaped with centered text
- `bullet` - Compact with side icon
- `corner` - Corner-cut design
- `badge` - Small indicator badge

### Complete LCARS Example

```yaml
overlays:
  - id: lcars_grid
    type: status_grid
    position: [100, 100]
    size: [300, 200]

    cells:
      - position: [0, 0]
        label: "MAIN POWER"
        value: "ONLINE"
      - position: [0, 1]
        label: "BACKUP"
        value: "STANDBY"
      - position: [1, 0]
        label: "SHIELDS"
        value: "ACTIVE"
      - position: [1, 1]
        label: "WEAPONS"
        value: "ARMED"

    style:
      rows: 2
      columns: 2
      cell_gap: 4

      # LCARS features
      lcars_corners: true
      bracket_style: true
      bracket_color: var(--lcars-orange)
      status_indicator: var(--lcars-green)

      # Styling
      cell_color: var(--lcars-blue)
      cell_radius: 0
      border_width: 2
      border_color: var(--lcars-white)

      # Text
      font_family: Antonio
      label_font_size: 14
      label_color: var(--lcars-white)
      text_layout: stacked
```

---

## Animation

Animate status grids with cascade effects perfect for anime.js.

### Animation Properties

```yaml
style:
  animatable: true              # Enable animations
  cascade_speed: 1.5            # Speed multiplier
  cascade_direction: row        # row, column, diagonal
  reveal_animation: true        # Initial reveal
  pulse_on_change: true         # Pulse on data update
```

### Cascade Directions

| Direction | Description | Animation Flow |
|-----------|-------------|----------------|
| `row` | Left to right, row by row | → → → |
| `column` | Top to bottom, column by column | ↓ ↓ ↓ |
| `diagonal` | Top-left to bottom-right | ↘ ↘ ↘ |
| `reverse-row` | Right to left, row by row | ← ← ← |
| `reverse-column` | Bottom to top, column by column | ↑ ↑ ↑ |

### Reveal Animation

Animate grid appearance on load:

```yaml
style:
  reveal_animation: true
  cascade_speed: 1.0
  cascade_direction: row
```

### Pulse on Change

Pulse cells when data changes:

```yaml
style:
  pulse_on_change: true
```

### Animation with anime.js

Status grids are designed for anime.js integration:

```javascript
// Get grid cells
const cells = document.querySelectorAll('[data-overlay-id="my_grid"] [data-feature="cell"]');

// Cascade animation
anime({
  targets: cells,
  opacity: [0, 1],
  translateY: [-20, 0],
  delay: anime.stagger(100, {start: 0}),  // 100ms between cells
  duration: 500,
  easing: 'easeOutQuad'
});

// Pulse animation on data change
anime({
  targets: cells,
  scale: [1, 1.1, 1],
  duration: 300,
  easing: 'easeInOutQuad'
});
```

### Complete Animation Example

```yaml
overlays:
  - id: animated_grid
    type: status_grid
    position: [100, 100]
    size: [300, 200]

    cells:
      - position: [0, 0]
        label: "Cell 1"
      - position: [0, 1]
        label: "Cell 2"
      - position: [0, 2]
        label: "Cell 3"
      - position: [1, 0]
        label: "Cell 4"
      - position: [1, 1]
        label: "Cell 5"
      - position: [1, 2]
        label: "Cell 6"

    style:
      rows: 2
      columns: 3

      # Animation settings
      animatable: true
      cascade_speed: 1.5
      cascade_direction: row
      reveal_animation: true
      pulse_on_change: true

      # Styling
      cell_color: var(--lcars-blue)
      cell_gap: 3
```

---

## Complete Property Reference

### Status Grid Overlay Schema

```yaml
overlays:
  - id: string                    # Required: Unique identifier
    type: status_grid             # Required: Must be "status_grid"
    position: [number, number]    # Required: [x, y] coordinates
    size: [number, number]        # Optional: [width, height] (default: [200, 150])

    # Cell Configuration (choose one)
    cells: array                  # Explicit cell definitions
    sources: array                # Auto-generate from sources

    # Actions (optional)
    tap_action: object            # Grid-level tap action
    hold_action: object           # Grid-level hold action
    double_tap_action: object     # Grid-level double-tap action

    style:                        # Styling configuration
      # Grid Layout
      rows: number                # Number of rows (default: 3)
      columns: number             # Number of columns (default: 4)
      cell_gap: number            # Gap between cells (default: 2)
      cell_width: number          # Fixed cell width (default: 0 = auto)
      cell_height: number         # Fixed cell height (default: 0 = auto)

      # Proportional Sizing
      row_sizes: [number, ...]    # Row height ratios
      column_sizes: [number, ...] # Column width ratios
      row_heights: [string|number, ...] # Row heights
      column_widths: [string|number, ...] # Column widths

      # Cell Appearance
      cell_color: string          # Cell color (default: "var(--lcars-blue)")
      cell_opacity: number        # Opacity 0-1 (default: 1.0)
      cell_radius: number         # Corner radius (default: 2)
      normalize_radius: boolean   # Auto-adjust radius (default: true)
      match_ha_radius: boolean    # Match HA card radius (default: true)

      # Cell Borders
      cell_border: boolean        # Show borders (default: true)
      border_color: string        # Border color (default: "var(--lcars-gray)")
      border_width: number        # Border width (default: 1)

      # Text Display
      show_labels: boolean        # Show labels (default: true)
      show_values: boolean        # Show values (default: false)
      label_color: string         # Label color (default: "var(--lcars-white)")
      value_color: string         # Value color (default: "var(--lcars-white)")
      font_size: number           # Global font size (default: 12)
      font_family: string         # Font family (default: "Antonio")
      font_weight: string         # Font weight (default: "normal")

      # Text Sizing
      label_font_size: number|object # Label font size
      value_font_size: number|object # Value font size

      # Text Positioning
      text_layout: string         # Layout mode (default: "stacked")
      label_position: string|object # Label position
      value_position: string|object # Value position
      text_alignment: string      # Vertical alignment (default: "center")
      text_justify: string        # Horizontal justification (default: "center")

      # Text Spacing
      text_padding: number        # Padding from edges (default: 8)
      text_margin: number         # Margin between elements (default: 2)
      text_spacing: number        # Vertical spacing

      # Text Overflow
      text_wrap: boolean          # Enable wrapping (default: false)
      max_text_width: string      # Maximum width (default: "90%")
      text_overflow: string       # Overflow handling (default: "ellipsis")

      # Status Detection
      status_mode: string         # Detection mode (default: "auto")
      status_ranges: array        # Range definitions
      unknown_color: string       # Unknown state color (default: "var(--lcars-gray)")

      # Grid Lines
      show_grid_lines: boolean    # Show grid lines (default: false)
      grid_line_color: string     # Grid line color (default: "var(--lcars-gray)")
      grid_line_opacity: number   # Grid line opacity (default: 0.3)
      grid_line_width: number     # Grid line width (default: 1)

      # Effects
      gradient: object            # Gradient definition
      glow: object                # Glow effect
      shadow: object              # Shadow effect

      # LCARS Features
      lcars_corners: boolean      # LCARS corners (default: false)
      bracket_style: boolean      # Brackets (default: false)
      bracket_color: string       # Bracket color
      bracket_width: number       # Bracket stroke width (default: 2)
      bracket_gap: number         # Bracket gap (default: 4)
      bracket_extension: number   # Bracket arm length (default: 8)
      bracket_opacity: number     # Bracket opacity (default: 1)
      bracket_corners: string     # Bracket corners (default: "both")
      bracket_sides: string       # Bracket sides (default: "both")
      status_indicator: string|boolean # Status indicator
      lcars_text_preset: string   # LCARS preset style

      # Interaction
      hover_enabled: boolean      # Hover effects (default: true)
      hover_color: string         # Hover color (default: "var(--lcars-yellow)")
      hover_scale: number         # Hover scale (default: 1.05)

      # Animation
      animatable: boolean         # Enable animations (default: true)
      cascade_speed: number       # Cascade speed (default: 0)
      cascade_direction: string   # Cascade direction (default: "row")
      reveal_animation: boolean   # Reveal animation (default: false)
      pulse_on_change: boolean    # Pulse on change (default: false)

      # Performance
      update_throttle: number     # Update throttling ms (default: 100)
```

### Cell Definition Schema

```yaml
cells:
  - id: string                    # Optional: Cell identifier
    position: [number, number]    # Required: [row, column] position
    source: string                # Optional: DataSource reference
    label: string                 # Optional: Label text
    content: string               # Optional: Template string
    value: any                    # Optional: Static value
    tags: [string, ...]           # ✨ NEW: Tags for bulk rule targeting

    # Cell-specific actions (override grid actions)
    tap_action: object            # Cell tap action
    hold_action: object           # Cell hold action
    double_tap_action: object     # Cell double-tap action

    # Cell-specific styling (override grid styling)
    color: string                 # Override cell color
    radius: number                # Override corner radius
    font_size: number             # Override font size
```

### Status Range Schema

```yaml
status_ranges:
  - min: number                   # Minimum value (numeric ranges)
    max: number                   # Maximum value (numeric ranges)
    value: string                 # Exact value match (string matching)
    state: string                 # State name
    color: string                 # Color for this range/state
    label: string                 # Optional display label
```

---

## Real-World Examples

### Example 1: Temperature Monitoring

```yaml
data_sources:
  living_temp:
    type: entity
    entity: sensor.living_room_temperature

  kitchen_temp:
    type: entity
    entity: sensor.kitchen_temperature

  bedroom_temp:
    type: entity
    entity: sensor.bedroom_temperature

  bathroom_temp:
    type: entity
    entity: sensor.bathroom_temperature

overlays:
  - id: temp_monitor
    type: status_grid
    position: [50, 50]
    size: [280, 140]

    cells:
      - position: [0, 0]
        source: living_temp
        label: "Living Room"
        content: "{living_temp:.1f}°F"

      - position: [0, 1]
        source: kitchen_temp
        label: "Kitchen"
        content: "{kitchen_temp:.1f}°F"

      - position: [1, 0]
        source: bedroom_temp
        label: "Bedroom"
        content: "{bedroom_temp:.1f}°F"

      - position: [1, 1]
        source: bathroom_temp
        label: "Bathroom"
        content: "{bathroom_temp:.1f}°F"

    style:
      rows: 2
      columns: 2
      cell_gap: 4

      # Status detection
      status_mode: ranges
      status_ranges:
        - min: 0
          max: 65
          color: var(--lcars-blue)
        - min: 65
          max: 75
          color: var(--lcars-green)
        - min: 75
          max: 100
          color: var(--lcars-red)

      # Display
      show_labels: true
      show_values: true
      text_layout: stacked

      # Styling
      cell_radius: 3
      border_width: 1
      bracket_style: true
      bracket_color: var(--lcars-orange)
```

### Example 2: Device Control Grid

```yaml
data_sources:
  living_light:
    type: entity
    entity: light.living_room

  kitchen_light:
    type: entity
    entity: light.kitchen

  bedroom_light:
    type: entity
    entity: light.bedroom

  ceiling_fan:
    type: entity
    entity: fan.ceiling_fan

overlays:
  - id: device_control
    type: status_grid
    position: [100, 100]
    size: [280, 140]

    cells:
      # Living room light
      - position: [0, 0]
        source: living_light
        label: "Living Room"
        content: "{living_light == 'on' ? 'ON' : 'OFF'}"
        tap_action:
          action: toggle
          entity: light.living_room
        hold_action:
          action: more-info
          entity: light.living_room

      # Kitchen light
      - position: [0, 1]
        source: kitchen_light
        label: "Kitchen"
        content: "{kitchen_light == 'on' ? 'ON' : 'OFF'}"
        tap_action:
          action: toggle
          entity: light.kitchen
        hold_action:
          action: more-info
          entity: light.kitchen

      # Bedroom light
      - position: [1, 0]
        source: bedroom_light
        label: "Bedroom"
        content: "{bedroom_light == 'on' ? 'ON' : 'OFF'}"
        tap_action:
          action: toggle
          entity: light.bedroom
        hold_action:
          action: more-info
          entity: light.bedroom

      # Ceiling fan
      - position: [1, 1]
        source: ceiling_fan
        label: "Ceiling Fan"
        content: "{ceiling_fan == 'on' ? 'ON' : 'OFF'}"
        tap_action:
          action: toggle
          entity: fan.ceiling_fan
        double_tap_action:
          action: call-service
          service: fan.set_speed
          service_data:
            entity_id: fan.ceiling_fan
            speed: high

    style:
      rows: 2
      columns: 2
      cell_gap: 3

      # Status colors (auto mode)
      status_mode: auto

      # Interactive
      hover_enabled: true
      hover_color: var(--lcars-yellow)

      # Styling
      cell_color: var(--lcars-blue)
      lcars_corners: true
      show_labels: true
```

### Example 3: System Monitoring Dashboard

```yaml
data_sources:
  cpu:
    type: entity
    entity: sensor.cpu_usage

  memory:
    type: entity
    entity: sensor.memory_usage

  disk:
    type: entity
    entity: sensor.disk_usage

  network:
    type: entity
    entity: sensor.network_throughput
    transformations:
      - type: unit_conversion
        conversion: "bytes_to_mbps"
        key: "mbps"

  uptime:
    type: entity
    entity: sensor.system_uptime

  temperature:
    type: entity
    entity: sensor.cpu_temperature

overlays:
  - id: system_dashboard
    type: status_grid
    position: [50, 50]
    size: [320, 200]

    cells:
      # Row 1: Main metrics
      - position: [0, 0]
        source: cpu
        label: "CPU"
        content: "{cpu:.0f}%"

      - position: [0, 1]
        source: memory
        label: "Memory"
        content: "{memory:.0f}%"

      - position: [0, 2]
        source: disk
        label: "Disk"
        content: "{disk:.0f}%"

      # Row 2: Network and temperature
      - position: [1, 0]
        source: network.transformations.mbps
        label: "Network"
        content: "{network.transformations.mbps:.1f} Mbps"

      - position: [1, 1]
        source: temperature
        label: "CPU Temp"
        content: "{temperature:.0f}°C"

      - position: [1, 2]
        source: uptime
        label: "Uptime"
        content: "{uptime}"

    style:
      rows: 2
      columns: 3
      cell_gap: 3

      # Status detection
      status_mode: ranges
      status_ranges:
        - min: 0
          max: 60
          color: var(--lcars-green)
        - min: 60
          max: 80
          color: var(--lcars-yellow)
        - min: 80
          max: 100
          color: var(--lcars-red)

      # Display
      show_labels: true
      show_values: true
      text_layout: stacked
      label_font_size: 12
      value_font_size: 16

      # LCARS styling
      lcars_corners: true
      bracket_style: true
      bracket_color: var(--lcars-orange)
      status_indicator: var(--lcars-green)

      # Animation
      reveal_animation: true
      cascade_speed: 1.0
      cascade_direction: row
```

### Example 4: Network Topology Status

```yaml
data_sources:
  router:
    type: entity
    entity: binary_sensor.router_online

  switch:
    type: entity
    entity: binary_sensor.switch_online

  nas:
    type: entity
    entity: binary_sensor.nas_online

  pc:
    type: entity
    entity: binary_sensor.pc_online

  printer:
    type: entity
    entity: binary_sensor.printer_online

  iot_hub:
    type: entity
    entity: binary_sensor.iot_hub_online

overlays:
  - id: network_status
    type: status_grid
    position: [100, 100]
    size: [280, 180]

    # Default action - navigate to network dashboard
    tap_action:
      action: navigate
      navigation_path: /lovelace/network

    cells:
      # Row 1: Core infrastructure
      - position: [0, 0]
        source: router
        label: "ROUTER"
        content: "{router == 'on' ? 'ONLINE' : 'OFFLINE'}"
        tap_action:
          action: more-info
          entity: binary_sensor.router_online

      - position: [0, 1]
        source: switch
        label: "SWITCH"
        content: "{switch == 'on' ? 'ONLINE' : 'OFFLINE'}"
        tap_action:
          action: more-info
          entity: binary_sensor.switch_online

      # Row 2: Storage and compute
      - position: [1, 0]
        source: nas
        label: "NAS"
        content: "{nas == 'on' ? 'ONLINE' : 'OFFLINE'}"
        tap_action:
          action: more-info
          entity: binary_sensor.nas_online

      - position: [1, 1]
        source: pc
        label: "PC"
        content: "{pc == 'on' ? 'ONLINE' : 'OFFLINE'}"
        tap_action:
          action: more-info
          entity: binary_sensor.pc_online

      # Row 3: Peripherals
      - position: [2, 0]
        source: printer
        label: "PRINTER"
        content: "{printer == 'on' ? 'ONLINE' : 'OFFLINE'}"

      - position: [2, 1]
        source: iot_hub
        label: "IOT HUB"
        content: "{iot_hub == 'on' ? 'ONLINE' : 'OFFLINE'}"

    style:
      rows: 3
      columns: 2
      cell_gap: 4

      # Status colors (auto mode)
      status_mode: auto

      # Display
      show_labels: true
      show_values: true
      text_layout: stacked
      font_family: Antonio
      label_font_size: 11
      value_font_size: 13

      # LCARS styling
      cell_color: var(--lcars-blue)
      lcars_corners: true
      bracket_style: true
      bracket_color: var(--lcars-orange)
      cell_radius: 0

      # Animation
      pulse_on_change: true
```

---

## Troubleshooting

### Grid Not Showing

**Symptoms:** Status grid doesn't appear on dashboard

**Solutions:**
1. ✅ Verify `type: status_grid` is set correctly
2. ✅ Check `position` and `size` are within viewbox
3. ✅ Ensure `rows` and `columns` are defined
4. ✅ Check browser console for rendering errors

```javascript
// Debug grid existence
const grid = document.querySelector('[data-overlay-id="my_grid"]');
console.log('Grid element:', grid);
console.log('Grid position:', grid?.getAttribute('transform'));
```

### Cells Not Displaying Data

**Symptoms:** Cells show "NO_DATA" or are empty

**Solutions:**
1. ✅ Verify DataSource names in `source` properties
2. ✅ Check DataSources are started: `window.cblcars.debug.msd.pipelineInstance.systemsManager.dataSourceManager.listSources()`
3. ✅ Ensure cell `position` syntax is correct: `[row, col]`
4. ✅ Test template strings in console

```javascript
// Debug cell data
const dsm = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;
const source = dsm.getSource('temperature');
console.log('Source data:', source?.getCurrentData());
```

### Actions Not Working

**Symptoms:** Clicking cells doesn't trigger actions

**Solutions:**
1. ✅ Verify action syntax is correct
2. ✅ Check entity IDs exist in Home Assistant
3. ✅ Ensure card instance is available
4. ✅ Test with simple toggle action first

```javascript
// Check action attachment
const grid = document.querySelector('[data-overlay-id="my_grid"]');
const cells = grid.querySelectorAll('[data-actions-attached="true"]');
console.log('Cells with actions:', cells.length);
```

### Status Colors Not Changing

**Symptoms:** All cells same color regardless of state

**Solutions:**
1. ✅ Check `status_mode` is set correctly
2. ✅ Verify `status_ranges` configuration
3. ✅ Test with `status_mode: auto` first
4. ✅ Check CSS variable availability

```javascript
// Debug status detection
const cell = document.querySelector('[data-cell-id="my_cell"]');
console.log('Cell state:', cell?.getAttribute('data-cell-state'));
console.log('Cell color:', cell?.style.fill);
```

### Grid Layout Issues

**Symptoms:** Cells overlapping or misaligned

**Solutions:**
1. ✅ Verify `rows` × `columns` matches cell count
2. ✅ Check `cell_gap` isn't too large
3. ✅ Test with fixed `cell_width` and `cell_height`
4. ✅ Ensure `size` is large enough for content

```javascript
// Debug layout calculations
const grid = document.querySelector('[data-overlay-id="my_grid"]');
console.log('Grid config:', {
  rows: grid.getAttribute('data-rows'),
  columns: grid.getAttribute('data-columns'),
  gap: grid.getAttribute('data-cell-gap')
});
```

### Animation Not Working

**Symptoms:** Cascade animations don't play

**Solutions:**
1. ✅ Verify `animatable: true` is set
2. ✅ Check `cascade_speed` > 0
3. ✅ Ensure anime.js is loaded
4. ✅ Test animation with simple fade

```javascript
// Check animation setup
const grid = document.querySelector('[data-overlay-id="my_grid"]');
console.log('Animation ready:', grid?.getAttribute('data-animation-ready'));
console.log('Cascade direction:', grid?.getAttribute('data-cascade-direction'));
```

### Text Not Visible

**Symptoms:** Labels or values don't show

**Solutions:**
1. ✅ Check `show_labels` or `show_values` are true
2. ✅ Verify `label_color` and `value_color` contrast with `cell_color`
3. ✅ Ensure `font_size` isn't too small
4. ✅ Check text isn't positioned outside cell bounds

```javascript
// Debug text visibility
const cell = document.querySelector('[data-cell-id="my_cell"]');
const label = cell.querySelector('text');
console.log('Label:', {
  text: label?.textContent,
  fill: label?.getAttribute('fill'),
  fontSize: label?.getAttribute('font-size'),
  x: label?.getAttribute('x'),
  y: label?.getAttribute('y')
});
```

### Debug Commands

#### Inspect Status Grid
```javascript
// Get all status grids
const grids = document.querySelectorAll('[data-overlay-type="status_grid"]');
console.log('Found status grids:', grids.length);

// Check specific grid
const grid = document.querySelector('[data-overlay-id="my_grid"]');
console.log('Grid details:', {
  id: grid.getAttribute('data-overlay-id'),
  rows: grid.getAttribute('data-rows'),
  columns: grid.getAttribute('data-columns'),
  cellCount: grid.querySelectorAll('[data-feature="cell"]').length
});
```

#### Check Cell Configuration
```javascript
// Get all cells in grid
const cells = document.querySelectorAll('[data-overlay-id="my_grid"] [data-feature="cell"]');
cells.forEach(cell => {
  console.log(`Cell ${cell.getAttribute('data-cell-id')}:`, {
    position: cell.getAttribute('data-cell-position'),
    source: cell.getAttribute('data-cell-source'),
    state: cell.getAttribute('data-cell-state'),
    hasActions: cell.getAttribute('data-has-cell-actions')
  });
});
```

#### Test DataSource Updates
```javascript
// Manual update test
const dsm = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;
const source = dsm.getSource('temperature');

// Update data manually
source.updateData(75.5);

// Check if grid updates
setTimeout(() => {
  const cell = document.querySelector('[data-cell-source="temperature"]');
  console.log('Cell updated value:', cell?.textContent);
}, 100);
```

---

## 📚 Related Documentation

- **[Text Overlay](text-overlay.md)** - Label status grid cells
- **[Button Overlay](button-overlay.md)** - Alternative single-cell controls
- **[Line Overlay](line-overlay.md)** - Connect grid cells with lines
- **[DataSource System](../datasources.md)** - Configure data sources
- **[DataSource Transformations](../datasource-transformations.md)** - Transform cell data
- **[Actions Guide](../../guides/actions.md)** - Interactive action configuration
- **[LCARS Styling](../../guides/lcars-styling.md)** - LCARS design patterns

---

**Last Updated:** October 26, 2025
**Version:** 2025.10.1-fuk.42-69
