# Status Grid Overlay - Complete Documentation & Schema

This document provides comprehensive documentation for the MSD Status Grid overlay system, including configuration options, styling features, DataSource integration, and multi-entity status visualization capabilities.

---

## Table of Contents

1. [Overview](#overview)
2. [Basic Configuration](#basic-configuration)
3. [DataSource Integration](#datasource-integration)
4. [Grid Layout & Styling](#grid-layout--styling)
5. [Status Detection & Color Coding](#status-detection--color-coding)
6. [Animation & Cascade Effects](#animation--cascade-effects)
7. [LCARS Features](#lcars-features)
8. [Configuration Schema](#configuration-schema)
9. [Troubleshooting](#troubleshooting)
10. [Examples](#examples)

---

## Overview

The MSD Status Grid overlay provides sophisticated multi-entity status visualization capabilities in a compact grid format:

- **Multi-entity monitoring** with configurable grid layouts (rows × columns)
- **Real-time DataSource integration** with individual cell data binding
- **Intelligent status detection** with automatic state mapping and custom ranges
- **LCARS cascade animations** with directional control perfect for anime.js
- **Comprehensive styling** with per-cell customization and global themes
- **Interactive features** with hover effects and real-time updates
- **Performance optimized** for large grids with efficient rendering

---

## Basic Configuration

### Minimal Status Grid
```yaml
overlays:
  - id: simple_grid
    type: status_grid
    position: [100, 50]
    size: [200, 150]
    style:
      rows: 3
      columns: 4
```

### Complete Basic Configuration
```yaml
overlays:
  - id: detailed_status_grid
    type: status_grid
    position: [100, 50]            # [x, y] position
    size: [240, 180]               # [width, height] dimensions

    style:
      # Grid layout
      rows: 3                      # Number of rows
      columns: 4                   # Number of columns
      cell_gap: 2                  # Gap between cells (pixels)

      # Cell appearance
      cell_color: "var(--lcars-blue)" # Default cell color
      cell_opacity: 1.0            # Cell opacity (0-1)
      cell_radius: 3               # Corner radius for cells
      cell_border: true            # Show cell borders
      border_color: "var(--lcars-gray)" # Border color
      border_width: 1              # Border width

      # Text display
      show_labels: true            # Show cell labels
      show_values: false           # Show cell values
      label_color: "var(--lcars-white)" # Label text color
      value_color: "var(--lcars-white)" # Value text color
      font_size: 10                # Font size for text
      font_family: "monospace"     # Font family

      # Status detection
      status_mode: "auto"          # auto, ranges, custom
      unknown_color: "var(--lcars-gray)" # Color for unknown states
```

---

## DataSource Integration

### Individual Cell DataSource Binding
```yaml
overlays:
  - id: sensor_status_grid
    type: status_grid
    position: [50, 50]
    size: [300, 200]

    # Method 1: Explicit cell definitions with DataSources
    cells:
      - id: living_room_temp
        position: [0, 0]           # [row, col]
        source: temperature.living_room
        label: "LR Temp"
        content: "{temperature.living_room:.1f}°C"  # Template string support

      - id: kitchen_temp
        position: [0, 1]
        source: temperature.kitchen
        label: "Kitchen"
        content: "{temperature.kitchen.transformations.celsius:.1f}°C"

      - id: bedroom_temp
        position: [0, 2]
        source: temperature.bedroom
        label: "Bedroom"

      - id: system_status
        position: [1, 0]
        data_source: system.status  # Direct DataSource reference
        label: "System"

    style:
      rows: 2
      columns: 3
```

### Auto-Generated Grid from DataSource Array
```yaml
overlays:
  - id: auto_sensor_grid
    type: status_grid
    position: [50, 50]
    size: [280, 140]

    # Method 2: Auto-generate from source list
    sources:
      - temperature.living_room
      - temperature.kitchen
      - temperature.bedroom
      - humidity.living_room
      - humidity.kitchen
      - humidity.bedroom
      - system.cpu_usage
      - system.memory_usage

    style:
      rows: 2
      columns: 4
      show_labels: true
      show_values: true
```

### Enhanced DataSource References
Support for enhanced DataSource access with transformations and aggregations:

```yaml
overlays:
  - id: enhanced_data_grid
    type: status_grid
    position: [100, 100]
    size: [200, 150]

    cells:
      - position: [0, 0]
        source: power_meter.transformations.kilowatts
        label: "Power"
        content: "{power_meter.transformations.kilowatts:.2f} kW"  # Template string with formatting

      - position: [0, 1]
        source: temperature.aggregations.avg_1h
        label: "Temp Avg"
        content: "{temperature.aggregations.avg_1h:.1f}°C"

      - position: [1, 0]
        source: network.transformations.mbps
        label: "Network"
        content: "{network.transformations.mbps:.0f} Mbps"

      - position: [1, 1]
        source: cpu.aggregations.max_5m
        label: "CPU Peak"
        content: "{cpu.aggregations.max_5m:.0f}%"
```

---

## Grid Layout & Styling

### Grid Dimensions & Spacing
```yaml
style:
  # Grid structure
  rows: 4                         # Number of rows
  columns: 6                      # Number of columns
  cell_width: 0                   # Auto-calculate width (0 = auto)
  cell_height: 0                  # Auto-calculate height (0 = auto)
  cell_gap: 3                     # Gap between cells

  # Manual cell sizing (overrides auto-calculation)
  cell_width: 40                  # Fixed cell width
  cell_height: 30                 # Fixed cell height

  # Proportional sizing - Powerful CSS Grid alternative with intelligent detection
  row_sizes: [1, 2, 1]           # Relative row heights (ratios)
  column_sizes: [1, 3, 2, 1]     # Relative column widths (ratios)

  # Alternative naming (same functionality)
  row_heights: [1, 2, 1]         # Relative row heights (ratios)
  column_widths: [1, 3, 2, 1]    # Relative column widths (ratios)

  # Percentage-based sizing (auto-detected by % suffix)
  row_heights: ["25%", "50%", "25%"]      # Percentage heights
  column_widths: ["15%", "45%", "30%", "10%"] # Percentage widths

  # Pixel-based sizing (auto-detected when values exceed available space)
  row_heights: [30, 60, 30]       # Fixed pixel heights (scaled if needed)
  column_widths: [40, 120, 80, 40] # Fixed pixel widths (scaled if needed)

  # Mixed sizing (advanced)
  column_widths: ["20%", 120, 2, "10%"] # Mix percentages, pixels, and ratios
```

### Cell Appearance
```yaml
style:
  # Basic cell styling
  cell_color: "var(--lcars-blue)" # Default cell fill color
  cell_opacity: 0.9               # Cell transparency
  cell_radius: 4                  # Corner radius

  # Advanced radius normalization (NEW)
  normalize_radius: true          # Auto-adjust radius for consistent visual appearance (default: true)
  match_ha_radius: true           # Use HA's card radius for all cells (default: true)

  # Cell borders
  cell_border: true               # Enable borders
  border_color: "var(--lcars-gray)" # Border color
  border_width: 2                 # Border thickness

  # LCARS corner styling
  lcars_corners: true             # Enable LCARS-style cut corners
```

### Text & Labels
```yaml
style:
  # Label display
  show_labels: true               # Show cell labels
  label_color: "var(--lcars-white)" # Label text color
  label_font_size: 11             # Label font size (individual control)
  font_size: 11                   # Global font size (fallback)
  font_family: "var(--lcars-font-family, Antonio)" # Font family with CSS variable support

  # Value display
  show_values: true               # Show cell values
  value_color: "var(--lcars-cyan)" # Value text color
  value_font_size: 9              # Value font size (individual control)

  # Text positioning and spacing
  text_spacing: 4                 # Vertical spacing between label and value
  label_offset_y: -2              # Label vertical offset from cell center
  value_offset_y: 8               # Value vertical offset from cell center
```

### Grid Lines & Background
```yaml
style:
  # Optional grid lines
  show_grid_lines: true           # Show lines between cells
  grid_line_color: "var(--lcars-gray)" # Grid line color
  grid_line_opacity: 0.4          # Grid line transparency
  grid_line_width: 1              # Grid line thickness (pixels)
```

---

## Radius Normalization & HA Integration

### Visual Consistency Across Cell Sizes
The Status Grid includes intelligent radius normalization to ensure consistent visual appearance across proportionally-sized cells, perfect for the clean LCARS aesthetic.

#### Default Behavior (Recommended)
```yaml
style:
  # These are the new defaults (automatic unless explicitly disabled)
  normalize_radius: true          # Enable smart radius calculation
  match_ha_radius: true           # Use Home Assistant's card radius

  # With proportional sizing
  column_sizes: [2, 1, 1]         # Different sized cells
  row_sizes: [1, 2]               # Different sized rows

  # Result: ALL cells get identical corner radius matching your HA theme!
```

#### How It Works
1. **🏠 HA Theme Detection**: Automatically detects your Home Assistant theme's card border radius from CSS variables (`--ha-card-border-radius`, `--card-border-radius`, etc.)
2. **📐 Consistent Application**: When `match_ha_radius: true`, ALL cells use the exact same radius regardless of size
3. **✨ Perfect Integration**: Status Grid cells visually match other HA cards and MSD controls

#### Configuration Options

**Option 1: Full HA Integration (Default)**
```yaml
style:
  normalize_radius: true          # Default: true
  match_ha_radius: true           # Default: true
  # Result: All cells use HA's card radius (e.g., 34px for Mushroom theme)
```

**Option 2: Proportional Scaling**
```yaml
style:
  normalize_radius: true
  match_ha_radius: false          # Use proportional scaling instead
  # Result: Radius scales with cell size but maintains visual consistency
```

**Option 3: Explicit Radius (Overrides Everything)**
```yaml
style:
  cell_radius: 8                  # All cells get exactly 8px radius
  # normalize_radius settings are ignored when explicit radius is set
```

**Option 4: Disable Normalization**
```yaml
style:
  normalize_radius: false         # Disable all smart radius features
  cell_radius: 4                  # Uses fixed radius without any scaling
```

#### Visual Comparison

**Before Normalization (inconsistent appearance):**
- Small cell (48px height): 7px radius → looks very square
- Large cell (144px height): 22px radius → looks very rounded
- **Problem**: Different visual "roundness" across cells

**After HA Matching (consistent appearance):**
- Small cell (48px height): 34px radius → matches HA cards perfectly
- Large cell (144px height): 34px radius → matches HA cards perfectly
- **Result**: Identical visual appearance across all cells and HA interface

#### CSS Variables Detected
The system automatically detects these HA theme variables in order:
- `--ha-card-border-radius` (most common)
- `--card-border-radius`
- `--border-radius`
- `--mdc-shape-small`

Fallback: 12px if no variables found

#### Per-Cell Overrides
Cell-level radius overrides still work and bypass all normalization:

```yaml
cells:
  - position: [0, 0]
    source: critical_system
    label: "CRITICAL"
    radius: 0                     # Square corners for urgency (overrides all defaults)

  - position: [0, 1]
    source: normal_system
    label: "NORMAL"
    # Uses normalized radius (HA matching or proportional)
```

---

## Status Detection & Color Coding

### Automatic Status Detection
The grid automatically detects common status patterns:

```yaml
style:
  status_mode: "auto"             # Enable automatic detection

  # Auto-detected patterns:
  # Values: "online/offline", "on/off", "active/inactive", "true/false"
  # Numbers: negative = bad, 0-100 = good, >100 = warning
  # Booleans: true = good, false = bad
```

### Custom Status Ranges
```yaml
style:
  status_mode: "ranges"           # Use custom status ranges
  status_ranges:
    # String value matching
    - value: "online"
      state: "good"
      color: "var(--lcars-green)"

    - value: "offline"
      state: "bad"
      color: "var(--lcars-red)"

    - value: "maintenance"
      state: "warning"
      color: "var(--lcars-yellow)"

    # Numeric range matching
    - min: 0
      max: 30
      state: "good"
      color: "var(--lcars-green)"
      label: "Normal"

    - min: 30
      max: 70
      state: "warning"
      color: "var(--lcars-yellow)"
      label: "Elevated"

    - min: 70
      max: 100
      state: "bad"
      color: "var(--lcars-red)"
      label: "Critical"
```

### Per-Cell Color Overrides
```yaml
cells:
  - position: [0, 0]
    source: critical_system
    label: "Critical"
    color: "var(--lcars-red)"      # Override cell-specific color

  - position: [0, 1]
    source: normal_system
    label: "Normal"
    # Uses status range or auto-detection
```

---

## Animation & Cascade Effects

### LCARS Cascade Animation
Perfect for the classic LCARS cascade effect:

```yaml
style:
  # Animation configuration
  animatable: true                # Enable anime.js targeting
  cascade_speed: 1.5              # Animation speed multiplier
  cascade_direction: "row"        # Animation direction
  reveal_animation: true          # Initial reveal animation
  pulse_on_change: true           # Pulse when data changes
```

### Cascade Directions
```yaml
style:
  cascade_direction: "row"        # Left to right, row by row (default)
  cascade_direction: "column"     # Top to bottom, column by column
  cascade_direction: "diagonal"   # Diagonal cascade effect
  cascade_direction: "reverse-row" # Right to left, row by row
  cascade_direction: "reverse-column" # Bottom to top, column by column
```

### Animation Delay Calculation
Each cell gets automatic animation delay based on position:
- **Row cascade**: `delay = row × 50ms / speed`
- **Column cascade**: `delay = column × 50ms / speed`
- **Diagonal cascade**: `delay = (row + column) × 50ms / speed`

### Real-time Pulse Animation
```yaml
style:
  pulse_on_change: true           # Pulse when cell data changes

  # Cells automatically get:
  # - data-cell-changed="true" attribute when value changes
  # - Perfect for anime.js pulse animations
  # - Auto-removes after 1 second
```

---

## Rules Engine Integration

### Cell-Level Rule Targeting
The Status Grid integrates with the MSD Rules Engine for dynamic cell-level styling and content updates based on conditions.

```yaml
rules:
  # Target specific cell by position
  - id: reactor_critical
    when:
      entity: reactor_temp
      above: 90
    apply:
      overlays:
        - id: ship_systems_grid
          cell_target:
            position: [0, 0]     # Target reactor cell at row 0, col 0
          style:
            color: "var(--lcars-red)"
            radius: 0            # Square corners for urgency
            font_size: 14        # Larger font
          content: "⚠️ CRITICAL" # Override cell content

  # Target by cell ID
  - id: shields_low
    when:
      entity: shields.strength
      below: 25
    apply:
      overlays:
        - id: bridge_grid
          cell_target:
            cell_id: "shields_cell"
          style:
            color: "var(--lcars-yellow)"
          label: "LOW SHIELDS"

  # Target entire row or column
  - id: weapons_armed
    when:
      entity: weapons.status
      equals: "armed"
    apply:
      overlays:
        - id: tactical_grid
          cell_target:
            row: 1               # Target all cells in row 1
          style:
            color: "var(--lcars-orange)"
```

### Rule Targeting Options
```yaml
cell_target:
  # Target by cell ID
  cell_id: "reactor_cell"        # Target specific cell by ID

  # Target by position
  position: [0, 1]               # Target cell at [row, column]

  # Target by row/column
  row: 2                         # Target entire row (all columns)
  col: 1                         # Target entire column (all rows)
```

### Dynamic Content Override
```yaml
rules:
  - id: system_status_override
    when:
      entity: system.emergency_mode
      equals: true
    apply:
      overlays:
        - id: status_grid
          cell_target:
            position: [0, 0]
          content: "EMERGENCY"     # Override cell content
          label: "ALERT"           # Override cell label
          visible: true            # Show/hide cell
```

### Priority and Stop Semantics
Rules targeting the same Status Grid cells follow priority order and stop semantics:

```yaml
rules:
  # High priority emergency rule
  - id: critical_alert
    priority: 1000
    stop: true                   # Stops lower priority rules
    when:
      entity: emergency_status
      equals: "critical"
    apply:
      overlays:
        - id: main_grid
          cell_target:
            position: [0, 0]
          style:
            color: "var(--lcars-red)"
          content: "CRITICAL"

  # Lower priority rule (may be stopped)
  - id: warning_alert
    priority: 500
    when:
      entity: warning_status
      equals: "warning"
    apply:
      overlays:
        - id: main_grid
          cell_target:
            position: [0, 0]     # Same cell
          style:
            color: "var(--lcars-yellow)"
          content: "WARNING"
```

---

## LCARS Features

### LCARS-Style Brackets
```yaml
style:
  bracket_style: true             # Enable LCARS brackets around grid
  bracket_color: "var(--lcars-orange)" # Custom bracket color
```

### Status Indicator
```yaml
style:
  status_indicator: true          # Enable status indicator dot
  status_indicator: "var(--lcars-green)" # Custom indicator color
```

### LCARS Corner Cuts
```yaml
style:
  lcars_corners: true             # Enable characteristic LCARS corners

  # Automatically applies different corner cuts based on position:
  # - Top-left cell: cut top-left corner
  # - Top-right cells: cut top-right corner
  # - Bottom-left cells: cut bottom-left corner
  # - Interior cells: standard rounded corners
```

### Effects & Styling
```yaml
style:
  # Visual effects
  glow:
    color: "var(--lcars-blue)"     # Glow color
    blur: 3                        # Glow radius
    intensity: 0.6                 # Glow intensity

  shadow:
    offset_x: 2                    # Shadow horizontal offset
    offset_y: 2                    # Shadow vertical offset
    blur: 4                        # Shadow blur
    color: "rgba(0,0,0,0.4)"       # Shadow color

  # Gradient fills
  gradient:
    type: "linear"
    direction: "vertical"
    stops:
      - { offset: "0%", color: "var(--lcars-blue)" }
      - { offset: "100%", color: "var(--lcars-cyan)" }
```

---

## Configuration Schema

### Status Grid Overlay Schema
```yaml
overlays:
  - id: string                    # Required: Unique overlay identifier
    type: status_grid             # Required: Must be "status_grid"
    position: [number, number]    # Required: [x, y] coordinates
    size: [number, number]        # Optional: [width, height] (default: [200, 150])

    # Cell Configuration (choose one method)
    cells: array                  # Method 1: Explicit cell definitions
    sources: array                # Method 2: Auto-generate from source list

    style:                        # Optional: Styling configuration
      # Grid Layout
      rows: number                # Number of rows (default: 3)
      columns: number             # Number of columns (default: 4)
      cell_width: number          # Cell width (default: 0 = auto)
      cell_height: number         # Cell height (default: 0 = auto)
      cell_gap: number            # Gap between cells (default: 2)

      # Proportional Sizing
      row_sizes: [number, ...]    # Relative row heights (ratios)
      column_sizes: [number, ...] # Relative column widths (ratios)
      row_heights: [string|number, ...] # Row heights (%, px, or ratios)
      column_widths: [string|number, ...] # Column widths (%, px, or ratios)

      # Cell Appearance
      cell_color: string          # Default cell color (default: "var(--lcars-blue)")
      cell_opacity: number        # Cell opacity (default: 1.0)
      cell_radius: number         # Corner radius (default: 2)

      # Radius Normalization (NEW)
      normalize_radius: boolean   # Auto-adjust radius for consistent appearance (default: true)
      match_ha_radius: boolean    # Use HA's card radius for all cells (default: true)

      # Cell Borders
      cell_border: boolean        # Show borders (default: true)
      border_color: string        # Border color (default: "var(--lcars-gray)")
      border_width: number        # Border width (default: 1)

      # Text Display
      show_labels: boolean        # Show cell labels (default: true)
      show_values: boolean        # Show cell values (default: false)
      label_color: string         # Label color (default: "var(--lcars-white)")
      value_color: string         # Value color (default: "var(--lcars-white)")
      font_size: number           # Global font size (default: 10)
      font_family: string         # Font family (default: "var(--lcars-font-family, Antonio)")

      # Individual Text Sizing & Positioning
      label_font_size: number     # Label font size (default: font_size)
      value_font_size: number     # Value font size (default: font_size * 0.9)
      text_spacing: number        # Vertical spacing between label/value (default: 4)
      label_offset_y: number      # Label vertical offset from center (default: -2)
      value_offset_y: number      # Value vertical offset from center (default: 8)

      # Status Detection
      status_mode: string         # auto|ranges|custom (default: "auto")
      status_ranges: array        # Custom status range definitions
      unknown_color: string       # Color for unknown states (default: "var(--lcars-gray)")

      # Grid Features
      show_grid_lines: boolean    # Show grid lines (default: false)
      grid_line_color: string     # Grid line color (default: "var(--lcars-gray)")
      grid_line_opacity: number   # Grid line opacity (default: 0.3)
      grid_line_width: number     # Grid line thickness (default: 1)

      # Effects
      gradient: object            # Gradient definition
      pattern: object             # Pattern definition
      glow: object                # Glow effect
      shadow: object              # Shadow effect
      blur: object                # Blur effect

      # LCARS Features
      bracket_style: boolean      # Enable brackets (default: false)
      bracket_color: string       # Bracket color
      status_indicator: boolean|string # Status indicator
      lcars_corners: boolean      # Enable LCARS corners (default: false)

      # Interaction
      hover_enabled: boolean      # Enable hover effects (default: true)
      hover_color: string         # Hover color (default: "var(--lcars-yellow)")
      hover_scale: number         # Hover scale factor (default: 1.05)

      # Animation (Perfect for anime.js)
      animatable: boolean         # Enable animations (default: true)
      cascade_speed: number       # Cascade speed multiplier (default: 0)
      cascade_direction: string   # Cascade direction (default: "row")
      reveal_animation: boolean   # Initial reveal (default: false)
      pulse_on_change: boolean    # Pulse on data change (default: false)

      # Performance
      update_throttle: number     # Update throttling (default: 100ms)
```

### Cell Definition Schema
```yaml
cells:
  - id: string                    # Optional: Unique cell identifier
    position: [number, number]    # Required: [row, column] position
    source: string                # Optional: DataSource reference
    label: string                 # Optional: Cell label text
    content: string               # Optional: Template string content (e.g., "{source:.1f}°C")
    value: any                    # Optional: Static cell value

    # Cell-specific styling overrides (override global grid styles)
    color: string                 # Override cell color (e.g., "var(--lcars-red)")
    radius: number                # Override corner radius (e.g., 0 for square, 5 for rounded)
    font_size: number             # Override font size for both label and value (e.g., 8)
```

### Status Range Definition
```yaml
status_ranges:
  - min: number                   # Minimum value (for numeric ranges)
    max: number                   # Maximum value (for numeric ranges)
    value: string                 # Exact value match (for string matching)
    state: string                 # State name (good, bad, warning, etc.)
    color: string                 # Color for this range/state
    label: string                 # Optional label for this range
```

---

## Troubleshooting

### Common Issues

#### 1. Cells Not Displaying Data
**Symptoms**: Grid shows but cells are empty or show "NO_DATA"
**Solutions**:
- Verify DataSource names in cell configurations
- Check that DataSources are started and have data
- Test individual DataSource access in console
- Ensure proper cell position syntax: `[row, col]`
- **Note**: Content may need to be in `_raw.content` due to overlay processing pipeline

```javascript
// Debug cell data resolution
const grid = document.querySelector('[data-overlay-id="my_grid"]');
const cells = grid.querySelectorAll('[data-feature="cell"]');
cells.forEach(cell => {
  console.log(`Cell ${cell.getAttribute('data-cell-id')}:`, {
    source: cell.getAttribute('data-cell-source'),
    state: cell.getAttribute('data-cell-state'),
    value: cell.getAttribute('data-cell-value')
  });
});
```

#### 2. Status Colors Not Working
**Symptoms**: All cells show same color regardless of status
**Solutions**:
- Check status_ranges configuration syntax
- Verify state detection logic with debug console
- Test with simplified status_mode: "auto" first
- Check CSS variable availability

#### 3. Animation Not Working
**Symptoms**: Cascade animations not triggering
**Solutions**:
- Ensure `animatable: true` is set
- Check that anime.js is loaded and animation registry is active
- Verify cascade_speed > 0 for cascade animations
- Test with data attributes in browser dev tools

#### 4. Grid Layout Issues
**Symptoms**: Cells overlapping or wrong positions
**Solutions**:
- Check rows/columns math matches cell count
- Verify cell_gap and size calculations
- Test with fixed cell_width/cell_height values
- Check for CSS transforms affecting positioning

#### 5. DataSource Updates Not Reflecting
**Symptoms**: Grid not updating when data changes
**Solutions**:
- Check that DataSource change notifications are working
- Verify update throttling isn't too aggressive
- Test manual updates with debug methods
- Check browser console for update errors

### Debug Commands

#### Basic Status Grid Inspection
```javascript
// Get status grids
const statusGrids = document.querySelectorAll('[data-overlay-type="status_grid"]');
console.log('Found status grids:', statusGrids.length);

// Debug grid details
window.StatusGridRenderer.debugStatusGridUpdates();
```

#### Individual Cell Analysis
```javascript
// Debug specific cell
window.StatusGridRenderer.debugStatusGridCell('my_grid', 'cell-0-1');

// Check cell status detection
const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
const source = dsm.getSource('temperature.living_room');
console.log('Source data:', source.getCurrentData());
```

#### Animation Testing
```javascript
// Test cascade animation setup
const grid = document.querySelector('[data-overlay-id="my_grid"]');
console.log('Animation ready:', grid.getAttribute('data-animation-ready'));
console.log('Cascade direction:', grid.getAttribute('data-cascade-direction'));

// Check cell animation delays
const cells = grid.querySelectorAll('[data-feature="cell"]');
cells.forEach(cell => {
  console.log(`Cell ${cell.getAttribute('data-cell-id')} delay:`,
             cell.getAttribute('data-animation-delay'));
});
```

---

## Examples

### Example 1: Basic Room Status Grid
```yaml
data_sources:
  living_room:
    type: entity
    entity: sensor.living_room_temp

  kitchen:
    type: entity
    entity: sensor.kitchen_temp

  bedroom:
    type: entity
    entity: sensor.bedroom_temp

overlays:
  - id: room_status_grid
    type: status_grid
    position: [50, 50]
    size: [240, 120]

    cells:
      - position: [0, 0]
        source: living_room
        label: "Living Room"

      - position: [0, 1]
        source: kitchen
        label: "Kitchen"

      - position: [0, 2]
        source: bedroom
        label: "Bedroom"

    style:
      rows: 1
      columns: 3
      cell_gap: 4
      show_labels: true
      show_values: true
      cell_color: "var(--lcars-blue)"
      bracket_style: true
      status_indicator: "var(--lcars-green)"
```

### Example 2: System Monitoring Dashboard
```yaml
data_sources:
  system_stats:
    type: entity
    entity: sensor.system_monitor
    transformations:
      - type: expression
        expression: "value.cpu"
        key: "cpu"
      - type: expression
        expression: "value.memory"
        key: "memory"
      - type: expression
        expression: "value.disk"
        key: "disk"
      - type: expression
        expression: "value.network"
        key: "network"

overlays:
  - id: system_monitoring_grid
    type: status_grid
    position: [100, 100]
    size: [280, 140]

    cells:
      - position: [0, 0]
        source: system_stats.transformations.cpu
        label: "CPU"

      - position: [0, 1]
        source: system_stats.transformations.memory
        label: "Memory"

      - position: [1, 0]
        source: system_stats.transformations.disk
        label: "Disk"

      - position: [1, 1]
        source: system_stats.transformations.network
        label: "Network"

    style:
      rows: 2
      columns: 2
      cell_gap: 3

      # Custom status ranges for system metrics
      status_ranges:
        - min: 0
          max: 60
          state: "good"
          color: "var(--lcars-green)"

        - min: 60
          max: 80
          state: "warning"
          color: "var(--lcars-yellow)"

        - min: 80
          max: 100
          state: "critical"
          color: "var(--lcars-red)"

      show_labels: true
      show_values: true
      bracket_style: true
      lcars_corners: true

      # Effects
      glow:
        color: "var(--lcars-blue)"
        blur: 2
        intensity: 0.5
```

### Example 3: LCARS Cascade Animation Grid
```yaml
data_sources:
  sensor_array:
    type: entity
    entity: sensor.multi_sensor_array

overlays:
  - id: cascade_animation_grid
    type: status_grid
    position: [50, 200]
    size: [320, 160]

    # Auto-generate 4x8 grid
    sources:
      - sensor_array.sensors.s1
      - sensor_array.sensors.s2
      - sensor_array.sensors.s3
      - sensor_array.sensors.s4
      - sensor_array.sensors.s5
      - sensor_array.sensors.s6
      - sensor_array.sensors.s7
      - sensor_array.sensors.s8
      - sensor_array.sensors.s9
      - sensor_array.sensors.s10
      - sensor_array.sensors.s11
      - sensor_array.sensors.s12
      - sensor_array.sensors.s13
      - sensor_array.sensors.s14
      - sensor_array.sensors.s15
      - sensor_array.sensors.s16
      - sensor_array.sensors.s17
      - sensor_array.sensors.s18
      - sensor_array.sensors.s19
      - sensor_array.sensors.s20
      - sensor_array.sensors.s21
      - sensor_array.sensors.s22
      - sensor_array.sensors.s23
      - sensor_array.sensors.s24
      - sensor_array.sensors.s25
      - sensor_array.sensors.s26
      - sensor_array.sensors.s27
      - sensor_array.sensors.s28
      - sensor_array.sensors.s29
      - sensor_array.sensors.s30
      - sensor_array.sensors.s31
      - sensor_array.sensors.s32

    style:
      rows: 4
      columns: 8
      cell_gap: 1

      # Perfect for LCARS cascade animation
      animatable: true
      cascade_speed: 2.0           # Fast cascade
      cascade_direction: "diagonal" # Classic diagonal effect
      reveal_animation: true
      pulse_on_change: true

      # LCARS styling
      lcars_corners: true
      bracket_style: true
      bracket_color: "var(--lcars-orange)"
      status_indicator: "var(--lcars-green)"

      # Compact display
      show_labels: false
      show_values: false
      cell_radius: 1

      # Status color coding
      status_ranges:
        - value: "online"
          color: "var(--lcars-green)"
        - value: "offline"
          color: "var(--lcars-red)"
        - value: "warning"
          color: "var(--lcars-yellow)"
        - value: "maintenance"
          color: "var(--lcars-blue)"

      # Visual effects
      glow:
        color: "var(--lcars-blue)"
        blur: 3
        intensity: 0.8
```

### Example 4: Network Status Grid with Hover
```yaml
data_sources:
  network_devices:
    type: entity
    entity: sensor.network_status

overlays:
  - id: network_device_grid
    type: status_grid
    position: [400, 50]
    size: [180, 240]

    cells:
      - position: [0, 0]
        source: network_devices.router
        label: "Router"

      - position: [0, 1]
        source: network_devices.switch
        label: "Switch"

      - position: [1, 0]
        source: network_devices.ap1
        label: "AP-1"

      - position: [1, 1]
        source: network_devices.ap2
        label: "AP-2"

      - position: [2, 0]
        source: network_devices.firewall
        label: "Firewall"

      - position: [2, 1]
        source: network_devices.modem
        label: "Modem"

    style:
      rows: 3
      columns: 2
      cell_gap: 4

      # Enhanced hover effects
      hover_enabled: true
      hover_color: "var(--lcars-yellow)"
      hover_scale: 1.1

      # String-based status detection
      status_ranges:
        - value: "online"
          state: "good"
          color: "var(--lcars-green)"

        - value: "offline"
          state: "bad"
          color: "var(--lcars-red)"

        - value: "degraded"
          state: "warning"
          color: "var(--lcars-orange)"

      show_labels: true
      show_values: true
      font_size: 9

      # Grid lines for technical appearance
      show_grid_lines: true
      grid_line_opacity: 0.3

      bracket_style: true
      status_indicator: true
```

### Example 5: Advanced Text Positioning & Cell Overrides
```yaml
data_sources:
  priority_systems:
    type: entity
    entity: sensor.priority_systems

overlays:
  - id: advanced_positioning_grid
    type: status_grid
    position: [50, 400]
    size: [300, 150]

    cells:
      # Critical system with custom styling
      - position: [0, 0]
        source: priority_systems.critical_reactor
        label: "REACTOR"
        content: "{priority_systems.critical_reactor:.0f}%"
        color: "var(--lcars-red)"     # Cell-level color override
        radius: 0                     # Square corners for critical system
        font_size: 12                 # Larger font for critical system

      # Warning system with custom radius
      - position: [0, 1]
        source: priority_systems.life_support
        label: "LIFE SUP"
        content: "{priority_systems.life_support:.0f}%"
        radius: 8                     # More rounded for life support

      # Normal system with default styling
      - position: [0, 2]
        source: priority_systems.navigation
        label: "NAV"
        content: "{priority_systems.navigation:.0f}%"

      # Status indicator with custom color
      - position: [1, 0]
        source: priority_systems.shields
        label: "SHIELDS"
        content: "{priority_systems.shields:.0f}%"
        color: "var(--lcars-blue)"

    style:
      rows: 2
      columns: 3
      cell_gap: 4

      # Advanced text positioning
      show_labels: true
      show_values: true
      label_font_size: 10           # Labels at 10px
      value_font_size: 14           # Values larger at 14px
      label_offset_y: -8            # Labels higher up
      value_offset_y: 6             # Values lower down
      text_spacing: 6               # More spacing between text elements

      # Grid styling
      show_grid_lines: true
      grid_line_width: 2            # Thick grid lines
      grid_line_color: "var(--lcars-orange)"
      grid_line_opacity: 0.5

      # LCARS features
      lcars_corners: true           # LCARS corners (overridden by cell-level radius)
      bracket_style: true
      bracket_color: "var(--lcars-orange)"

      # Font family with CSS variable
      font_family: "var(--lcars-font-family, Antonio)"
```

### Example 6: Proportional Grid Layout
```yaml
data_sources:
  ship_systems:
    type: entity
    entity: sensor.ship_systems

overlays:
  - id: command_console_grid
    type: status_grid
    position: [50, 50]
    size: [400, 300]

    cells:
      # Main display (spans multiple proportional units)
      - position: [0, 0]
        source: ship_systems.main_display
        label: "MAIN DISPLAY"

      - position: [0, 1]
        source: ship_systems.tactical
        label: "TACTICAL"

      - position: [0, 2]
        source: ship_systems.navigation
        label: "NAV"

      # Critical systems row
      - position: [1, 0]
        source: ship_systems.reactor
        label: "REACTOR"
        color: "var(--lcars-red)"

      - position: [1, 1]
        source: ship_systems.life_support
        label: "LIFE SUPPORT"

      - position: [1, 2]
        source: ship_systems.shields
        label: "SHIELDS"

      # Status indicators (smaller row)
      - position: [2, 0]
        source: ship_systems.comms
        label: "COMMS"

      - position: [2, 1]
        source: ship_systems.sensors
        label: "SENSORS"

      - position: [2, 2]
        source: ship_systems.weapons
        label: "WEAPONS"

    style:
      rows: 3
      columns: 3

      # Proportional sizing - creates unequal layouts
      row_sizes: [3, 2, 1]        # Main display row is 3x, critical systems 2x, status 1x
      column_sizes: [2, 1, 1]     # Left column is 2x wider than others

      # Alternative percentage approach
      # row_heights: ["50%", "33%", "17%"]     # Explicit percentages
      # column_widths: ["50%", "25%", "25%"]   # Explicit percentages

      cell_gap: 4

      # LCARS styling
      lcars_corners: true
      bracket_style: true
      bracket_color: "var(--lcars-orange)"

      show_labels: true
      show_values: false
      font_size: 10

      # Status ranges
      status_ranges:
        - value: "online"
          color: "var(--lcars-green)"
        - value: "offline"
          color: "var(--lcars-red)"
        - value: "maintenance"
          color: "var(--lcars-yellow)"

      # Animation
      cascade_speed: 1.5
      cascade_direction: "row"
      reveal_animation: true
```

### Example 7: Environmental Sensor Matrix
```yaml
data_sources:
  environmental:
    type: entity
    entity: sensor.environmental_matrix
    transformations:
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"
    aggregations:
      session_stats:
        key: "session"

overlays:
  - id: environmental_matrix
    type: status_grid
    position: [50, 300]
    size: [400, 200]

    # Large grid with mixed DataSource types
    cells:
      # Temperature sensors (row 0)
      - { position: [0, 0], source: "environmental.zone1.temp", label: "Z1T" }
      - { position: [0, 1], source: "environmental.zone2.temp", label: "Z2T" }
      - { position: [0, 2], source: "environmental.zone3.temp", label: "Z3T" }
      - { position: [0, 3], source: "environmental.zone4.temp", label: "Z4T" }

      # Humidity sensors (row 1)
      - { position: [1, 0], source: "environmental.zone1.humidity", label: "Z1H" }
      - { position: [1, 1], source: "environmental.zone2.humidity", label: "Z2H" }
      - { position: [1, 2], source: "environmental.zone3.humidity", label: "Z3H" }
      - { position: [1, 3], source: "environmental.zone4.humidity", label: "Z4H" }

      # Air quality sensors (row 2)
      - { position: [2, 0], source: "environmental.zone1.aqi", label: "Z1A" }
      - { position: [2, 1], source: "environmental.zone2.aqi", label: "Z2A" }
      - { position: [2, 2], source: "environmental.zone3.aqi", label: "Z3A" }
      - { position: [2, 3], source: "environmental.zone4.aqi", label: "Z4A" }

    style:
      rows: 3
      columns: 4
      cell_gap: 2

      # Multi-range status system
      status_ranges:
        # Temperature ranges (15-30°C optimal)
        - { min: 15, max: 25, color: "var(--lcars-green)", label: "Temp OK" }
        - { min: 10, max: 15, color: "var(--lcars-blue)", label: "Cool" }
        - { min: 25, max: 30, color: "var(--lcars-yellow)", label: "Warm" }
        - { min: 0, max: 10, color: "var(--lcars-cyan)", label: "Cold" }
        - { min: 30, max: 50, color: "var(--lcars-red)", label: "Hot" }

        # Humidity ranges (30-60% optimal)
        - { min: 30, max: 60, color: "var(--lcars-green)", label: "Humidity OK" }
        - { min: 60, max: 80, color: "var(--lcars-yellow)", label: "Humid" }
        - { min: 0, max: 30, color: "var(--lcars-orange)", label: "Dry" }

        # AQI ranges (0-50 good, 51-100 moderate, etc.)
        - { min: 0, max: 50, color: "var(--lcars-green)", label: "Good Air" }
        - { min: 51, max: 100, color: "var(--lcars-yellow)", label: "Moderate" }
        - { min: 101, max: 150, color: "var(--lcars-orange)", label: "Unhealthy" }
        - { min: 151, max: 500, color: "var(--lcars-red)", label: "Hazardous" }

      show_labels: true
      show_values: true
      font_size: 8
      font_family: "monospace"

      # Full LCARS treatment
      lcars_corners: true
      bracket_style: true
      bracket_color: "var(--lcars-cyan)"
      status_indicator: "var(--lcars-green)"
      show_grid_lines: true

      # Cascade reveal animation
      cascade_speed: 1.0
      cascade_direction: "row"
      reveal_animation: true
      pulse_on_change: true

      # Subtle effects
      shadow:
        offset_x: 1
        offset_y: 1
        blur: 2
        color: "rgba(0,0,0,0.3)"
```

---

This completes the comprehensive Status Grid overlay documentation covering all features, configuration options, DataSource integration, and animation capabilities. The system provides powerful multi-entity status visualization with excellent support for LCARS cascade animations through anime.js integration!