# Status Grid Overlay - Complete Documentation & Schema

This document provides comprehensive documentation for the MSD Status Grid overlay system, including configuration options, styling features, DataSource integration, Defaults Manager integration, and multi-entity status visualization capabilities.

<!-- See also: HA template reference -->
> See also: Home Assistant templates in CB-LCARS → [HA Template Syntax Reference](./home_assistant_templates.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Basic Configuration](#basic-configuration)
3. [MSD Defaults System Integration](#msd-defaults-system-integration)
4. [DataSource Integration](#datasource-integration)
5. [Grid Layout & Styling](#grid-layout--styling)
6. [Status Detection & Color Coding](#status-detection--color-coding)
7. [Animation & Cascade Effects](#animation--cascade-effects)
8. [LCARS Features](#lcars-features)
9. [Configuration Schema](#configuration-schema)
10. [Troubleshooting](#troubleshooting)
11. [Examples](#examples)

---

## Overview

The MSD Status Grid overlay provides sophisticated multi-entity status visualization capabilities in a compact grid format:

- **Multi-entity monitoring** with configurable grid layouts (rows × columns)
- **Real-time DataSource integration** with individual cell data binding
- **MSD Defaults Manager integration** for centralized configuration and responsive scaling
- **Intelligent status detection** with automatic state mapping and custom ranges
- **Interactive actions** with overlay-level and cell-level Home Assistant actions
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

    # Interactive Actions (optional)
    tap_action:                    # Action on tap/click
      action: navigate
      navigation_path: /lovelace/system
    hold_action:                   # Action on hold/long press
      action: more-info
      entity: binary_sensor.system_health
    double_tap_action:             # Action on double-tap
      action: call-service
      service: homeassistant.restart
```

---

## MSD Defaults System Integration

The Status Grid overlay is fully integrated with the MSD Defaults Manager for centralized configuration management, responsive scaling, and consistent theming across all status grids.

### Centralized Configuration

All default values are managed through the defaults system with layer-based overrides:

```yaml
# Global defaults (lowest priority)
defaults:
  status_grid:
    rows: 3
    columns: 4
    cell_gap: 2
    cell_color: "var(--lcars-blue)"
    label_font_size:
      value: 18
      scale: "viewbox"
      unit: "px"
    text_padding: 8

# Theme-level overrides
themes:
  - id: tactical
    defaults:
      status_grid:
        cell_color: "var(--lcars-red)"
        bracket_style: true
        lcars_corners: true

# User-level overrides (highest priority)
profiles:
  - id: my_setup
    defaults:
      status_grid:
        cascade_speed: 1.5
        reveal_animation: true
```

### Available Default Paths

#### Core Grid Properties
- `status_grid.rows` - Number of rows (default: 3)
- `status_grid.columns` - Number of columns (default: 4)
- `status_grid.cell_gap` - Gap between cells (default: 2)
- `status_grid.cell_color` - Default cell color (default: 'var(--lcars-blue)')
- `status_grid.cell_opacity` - Cell opacity (default: 1.0)
- `status_grid.cell_radius` - Corner radius (default: 2)

#### Border & Layout
- `status_grid.border_color` - Border color (default: 'var(--lcars-gray)')
- `status_grid.border_width` - Border width (default: 1)
- `status_grid.unknown_color` - Color for unknown states (default: 'var(--lcars-gray)')

#### Text Styling (Supports Scaling)
- `status_grid.font_size` - Base font size (default: 12)
- `status_grid.label_font_size` - Label font size (default: 18, supports scaling)
- `status_grid.value_font_size` - Value font size (default: 16, supports scaling)
- `status_grid.font_family` - Font family (default: 'var(--lcars-font-family, Antonio)')
- `status_grid.font_weight` - Font weight (default: 'normal')
- `status_grid.label_color` - Label text color (default: 'var(--lcars-white)')
- `status_grid.value_color` - Value text color (default: 'var(--lcars-white)')

#### Text Layout & Positioning
- `status_grid.text_layout` - Layout mode (default: 'stacked')
- `status_grid.text_alignment` - Vertical alignment (default: 'center')
- `status_grid.text_justify` - Horizontal justification (default: 'center')
- `status_grid.label_position` - Label position (default: 'center-top')
- `status_grid.value_position` - Value position (default: 'center-bottom')
- `status_grid.text_padding` - Padding from cell edges (default: 8)
- `status_grid.text_margin` - Margin between text elements (default: 2)
- `status_grid.max_text_width` - Maximum text width (default: '90%')
- `status_grid.text_overflow` - Overflow handling (default: 'ellipsis')

#### Status Detection
- `status_grid.status_mode` - Status detection mode (default: 'auto')

#### Grid Features
- `status_grid.grid_line_color` - Grid line color (default: 'var(--lcars-gray)')
- `status_grid.grid_line_opacity` - Grid line opacity (default: 0.3)
- `status_grid.grid_line_width` - Grid line width (default: 1)

#### LCARS Features
- `status_grid.bracket_color` - Bracket color (default: null)
- `status_grid.bracket_width` - Bracket stroke width (default: 2)
- `status_grid.bracket_gap` - Distance from grid (default: 4)
- `status_grid.bracket_extension` - Bracket arm length (default: 8)
- `status_grid.bracket_opacity` - Bracket opacity (default: 1)
- `status_grid.bracket_corners` - Which corners (default: 'both')
- `status_grid.bracket_sides` - Which sides (default: 'both')
- `status_grid.bracket_physical_width` - Physical bracket width (default: 8)
- `status_grid.bracket_height` - Bracket height (default: '100%')
- `status_grid.bracket_radius` - Bracket corner radius (default: 4)
- `status_grid.border_radius` - Container border radius (default: 8)
- `status_grid.inner_factor` - Inner spacing factor (default: 2)

#### Interaction
- `status_grid.hover_color` - Hover color (default: 'var(--lcars-yellow)')
- `status_grid.hover_scale` - Hover scale factor (default: 1.05)

#### Animation
- `status_grid.cascade_speed` - Cascade animation speed (default: 0)
- `status_grid.cascade_direction` - Cascade direction (default: 'row')
- `status_grid.reveal_animation` - Initial reveal animation (default: false)
- `status_grid.pulse_on_change` - Pulse on data change (default: false)

#### Performance
- `status_grid.update_throttle` - Update throttling in ms (default: 100)

### Responsive Scaling with ViewBox

Status grids support responsive scaling for consistent appearance across different screen sizes:

```yaml
profiles:
  - id: responsive
    defaults:
      status_grid:
        # Font sizes with viewbox scaling
        label_font_size:
          value: 18
          scale: "viewbox"
          unit: "px"
        value_font_size:
          value: 16
          scale: "viewbox"
          unit: "px"

        # Consistent padding that scales
        text_padding:
          value: 8
          scale: "viewbox"
          unit: "px"

overlays:
  - type: status_grid
    id: responsive_grid
    position: [50, 50]
    size: [300, 200]
    # Inherits all responsive scaling from profile
```

### Runtime Configuration

Override defaults programmatically:

```javascript
// Set user-level defaults
window.cblcars.defaults.set('user', 'status_grid.cell_color', '#00ffff');
window.cblcars.defaults.set('user', 'status_grid.cascade_speed', 2.0);

// Set theme-level defaults
window.cblcars.defaults.set('theme', 'status_grid.bracket_style', true);
window.cblcars.defaults.set('theme', 'status_grid.lcars_corners', true);

// View current resolved defaults
const resolvedDefaults = window.cblcars.defaults.resolve('status_grid');
console.log('Current status grid defaults:', resolvedDefaults);

// Debug all layers
window.cblcars.defaults.debug();
```

### Layer Priority (Highest to Lowest)

1. **Overlay-specific style** - Individual overlay configuration
2. **User layer** - User preferences and customizations
3. **Pack layer** - Card pack specific settings
4. **Theme layer** - Theme-specific styling
5. **Global layer** - System defaults

### Migration from Static Defaults

When upgrading existing configurations, static values are automatically preserved:

```yaml
# Before (static)
overlays:
  - type: status_grid
    style:
      cell_color: "var(--lcars-red)"
      font_size: 16

# After (can use defaults with scaling)
profiles:
  - id: my_theme
    defaults:
      status_grid:
        cell_color: "var(--lcars-red)"
        font_size:
          value: 16
          scale: "viewbox"
          unit: "px"

overlays:
  - type: status_grid
    # Inherits from defaults, scales responsively
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

## Interactive Actions

Status Grid overlays support comprehensive Home Assistant actions at both overlay and cell levels, making your grids fully interactive control interfaces. The action system uses immediate attachment for reliable interaction.

### Overlay-Level Actions
Apply actions to the entire status grid:

```yaml
overlays:
  - type: status_grid
    id: system_status
    position: [100, 100]
    size: [300, 200]

    # Actions apply to entire grid
    tap_action:
      action: navigate
      navigation_path: /lovelace/system
    hold_action:
      action: more-info
      entity: binary_sensor.system_health
    double_tap_action:
      action: call-service
      service: homeassistant.restart
      confirmation:
        text: "Are you sure you want to restart Home Assistant?"

    cells:
      - id: cpu_cell
        position: [0, 0]
        label: "CPU"
        content: "45%"
      - id: memory_cell
        position: [0, 1]
        label: "Memory"
        content: "78%"
```

### Cell-Level Actions (Preferred Method)
Define actions directly on individual cells for granular control. **This is the recommended approach** for most use cases:

```yaml
overlays:
  - type: status_grid
    id: device_grid
    position: [100, 100]
    size: [300, 200]

    cells:
      - id: light_cell
        position: [0, 0]
        label: "Living Room"
        content: "ON"
        source: light.living_room
        # Cell-specific actions (recommended)
        tap_action:
          action: toggle
          entity: light.living_room
        hold_action:
          action: more-info
          entity: light.living_room

      - id: fan_cell
        position: [0, 1]
        label: "Ceiling Fan"
        content: "OFF"
        source: fan.ceiling_fan
        # Different actions for this cell
        tap_action:
          action: toggle
          entity: fan.ceiling_fan
        double_tap_action:
          action: call-service
          service: fan.set_speed
          service_data:
            entity_id: fan.ceiling_fan
            speed: high

      - id: temp_cell
        position: [0, 2]
        label: "Temperature"
        content: "23°C"
        source: sensor.temperature
        # No actions - this cell is display-only

    style:
      rows: 1
      columns: 3
```

### Action System Architecture

The status grid uses an **immediate action attachment system** that provides reliable interaction:

#### How Actions Work
1. **Immediate Attachment**: Actions are attached immediately after DOM insertion using multiple timing strategies
2. **Element Coverage**: All cell elements (background rect, text labels, values) become clickable
3. **Event Coordination**: Cell actions use capture phase, overlay actions use bubble phase to prevent conflicts
4. **Bridge Pattern**: Uses custom-button-card's proven action system for full Home Assistant compatibility

#### Action Priority
- **Cell actions always override overlay actions** when both are present
- **Multiple elements per cell** all respond to the same cell actions
- **Event bubbling is prevented** to avoid action conflicts

### Mixed Actions
Combine overlay and cell actions - cell actions take priority:

```yaml
overlays:
  - type: status_grid
    id: mixed_grid
    position: [100, 100]
    size: [300, 200]

    # Default action for cells without specific actions
    tap_action:
      action: navigate
      navigation_path: /lovelace/devices

    cells:
      - id: controllable_light
        position: [0, 0]
        label: "Kitchen Light"
        content: "ON"
        # This cell has its own action (overrides overlay default)
        tap_action:
          action: toggle
          entity: light.kitchen

      - id: display_only_sensor
        position: [0, 1]
        label: "Temperature"
        content: "23°C"
        # This cell will use the overlay default action

    style:
      rows: 1
      columns: 2
```

### Template Actions
Actions support templates for dynamic behavior:

```yaml
cells:
  - id: climate_cell
    position: [0, 0]
    label: "Thermostat"
    content: "{climate.house}°F"
    tap_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.house
        # Template: Increase temp by 2 degrees
        temperature: "{{ states('climate.house') | float + 2 }}"
    hold_action:
      action: call-service
      service: "{{ 'climate.turn_on' if states('climate.house') == 'off' else 'climate.turn_off' }}"
      service_data:
        entity_id: climate.house
```

### Action Types Reference

All standard Home Assistant action types are supported:

- **`toggle`** - Toggle entity state
- **`more-info`** - Show entity more-info dialog
- **`call-service`** - Call any Home Assistant service
- **`navigate`** - Navigate to dashboard path
- **`url`** - Open URL (internal or external)
- **`fire-dom-event`** - Fire custom DOM events

### Action Best Practices

#### Performance
- **Use cell-level actions** instead of legacy `style.actions.cells` format
- **Minimize complex templates** in action configurations
- **Test actions** with simple configurations first

#### User Experience
- **Provide visual feedback** - Actions automatically add pointer cursor and proper event handling
- **Use intuitive actions** - tap for primary action, hold for secondary
- **Consider accessibility** - All cell elements are clickable, including text

#### Maintainability
- **Consistent action patterns** across similar cells
- **Clear entity references** - use descriptive entity IDs
- **Document complex actions** in YAML comments

### Troubleshooting Actions

#### Common Issues

**Actions Not Working**
- Verify the card instance is available during rendering
- Check browser console for action attachment logs
- Ensure proper YAML syntax for action definitions

**Conflicting Actions**
- Cell actions always override overlay actions by design
- Check for multiple action definitions on the same cell
- Verify event handling isn't being prevented by other scripts

#### Debug Actions
```javascript
// Check action attachment status
const grid = document.querySelector('[data-overlay-id="my_grid"]');
const cellsWithActions = grid.querySelectorAll('[data-actions-attached="true"]');
console.log('Cells with actions:', cellsWithActions.length);

// Check specific cell action setup
const cell = grid.querySelector('[data-cell-id="light_cell"]');
console.log('Cell action data:', {
  hasActions: cell.getAttribute('data-has-cell-actions'),
  actionsAttached: cell.getAttribute('data-actions-attached'),
  pointerEvents: cell.style.pointerEvents,
  cursor: cell.style.cursor
});
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

    # Interactive Actions (optional)
    tap_action: object            # Action on tap/click
    hold_action: object           # Action on hold/long press
    double_tap_action: object     # Action on double-tap

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

      # Enhanced Text Positioning System
      label_font_size: number     # Label font size (default: font_size)
      value_font_size: number     # Value font size (default: font_size * 0.9)

      # LCARS Preset Styles (recreate CB-LCARS button card layouts)
      lcars_text_preset: string   # Preset style: lozenge, bullet, corner, badge (default: null)

      # Flexible Positioning (predefined or custom objects)
      label_position: string|object # Label position: 'top-left', 'center', {x: '20%', y: '30%'} (default: 'center-top')
      value_position: string|object # Value position: 'bottom-right', 'center', {x: '80%', y: '70%'} (default: 'center-bottom')

      # Layout Control
      text_layout: string         # Layout mode: stacked, side-by-side, label-only, value-only, custom (default: 'stacked')
      text_alignment: string      # Vertical alignment: top, center, bottom (default: 'center')
      text_justify: string        # Horizontal justification: left, center, right (default: 'center')

      # Spacing & Padding (Smart Corner-Aware System)
      text_padding: number        # Base padding from cell edges (default: 6, auto-adjusted for corner radius)
      text_margin: number         # Margin between text elements (default: 2)

      # Legacy positioning (auto-calculated for collision prevention)
      text_spacing: number        # Vertical spacing between label/value (smart default)
      label_offset_y: number      # Label vertical offset from center (smart default)
      value_offset_y: number      # Value vertical offset from center (smart default)

      # Advanced Text Features
      text_wrap: boolean          # Enable text wrapping (default: false)
      max_text_width: string      # Maximum text width: '90%', '120px' (default: '90%')
      text_overflow: string       # Overflow handling: ellipsis, clip, none (default: 'ellipsis')

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

    # Interactive Actions (optional - cell-level actions override overlay-level)
    tap_action: object            # Cell-specific tap action
    hold_action: object           # Cell-specific hold action
    double_tap_action: object     # Cell-specific double-tap action

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
          color: "var(--lcars-green)"
        - value: "offline"
          color: "var(--lcars-red)"
        - value: "degraded"
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
      - position: [0, 0]
        source: ship_systems.warp_core
        label: "WARP"
        content: "ONLINE"

      - position: [0, 1]
        source: ship_systems.shields
        label: "SHIELDS"
        content: "85%"

      - position: [0, 2]
        source: ship_systems.weapons
        label: "WEAPONS"
        content: "ARMED"

      - position: [0, 3]
        source: ship_systems.life_support
        label: "LIFE"
        content: "NOMINAL"

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
      cell_gap: 2

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
      status_indicator: "var(--lcars-green)"

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
      pulse_on_change: true
```

### Example 7: CB-LCARS Preset Styles Showcase
```yaml
data_sources:
  ship_systems:
    type: entity
    entity: sensor.ship_systems

overlays:
  # Lozenge style grid - classic LCARS look
  - id: lozenge_style_grid
    type: status_grid
    position: [50, 50]
    size: [200, 150]

    cells:
      - position: [0, 0]
        source: ship_systems.warp_core
        label: "WARP"
        content: "ONLINE"

      - position: [0, 1]
        source: ship_systems.shields
        label: "SHIELDS"
        content: "85%"

      - position: [1, 0]
        source: ship_systems.weapons
        label: "WEAPONS"
        content: "ARMED"

      - position: [1, 1]
        source: ship_systems.life_support
        label: "LIFE"
        content: "NOMINAL"

    style:
      rows: 2
      columns: 2

      # Lozenge preset: label top-left, value bottom-right
      lcars_text_preset: "lozenge"
      text_padding: 8

      show_labels: true
      show_values: true
      font_size: 12
      cell_color: "var(--lcars-blue)"
      lcars_corners: true

  # Bullet style grid - side-by-side text
  - id: bullet_style_grid
    type: status_grid
    position: [300, 50]
    size: [200, 150]

    cells:
      - position: [0, 0]
        label: "TEMP"
        content: "23°C"

      - position: [0, 1]
        label: "PRESS"
        content: "1013"

    style:
      rows: 1
      columns: 2

      # Bullet preset: label left, value right
      lcars_text_preset: "bullet"
      text_padding: 6

      show_labels: true
      show_values: true
      font_size: 10
      cell_color: "var(--lcars-orange)"

  # Corner style grid - both text elements in corner
  - id: corner_style_grid
    type: status_grid
    position: [50, 250]
    size: [200, 100]

    cells:
      - position: [0, 0]
        label: "STATUS"
        content: "OK"

      - position: [0, 1]
        label: "POWER"
        content: "100%"

    style:
      rows: 1
      columns: 2

      # Corner preset: both in south-east corner, stacked
      lcars_text_preset: "corner"
      text_padding: 4
      text_margin: 2

      show_labels: true
      show_values: true
      font_size: 9
      cell_color: "var(--lcars-red)"

  # Custom positioning - recreate specific button card layout
  - id: custom_positioning_grid
    type: status_grid
    position: [300, 250]
    size: [180, 120]

    cells:
      - position: [0, 0]
        label: "REACTOR"
        content: "STABLE"

      - position: [0, 1]
        label: "COOLANT"
        content: "FLOWING"

    style:
      rows: 1
      columns: 2

      # Custom positioning: label north-west, value south-east
      label_position: "north-west"
      value_position: "south-east"
      text_padding: 6

      show_labels: true
      show_values: true
      font_size: 11
      label_color: "var(--lcars-cyan)"
      value_color: "var(--lcars-white)"
      cell_color: "var(--lcars-blue-dark)"
```

### Example 8: Advanced Custom Positioning
```yaml
overlays:
  - id: percentage_positioning_grid
    type: status_grid
    position: [50, 400]
    size: [300, 120]

    cells:
      - position: [0, 0]
        label: "SYSTEM"
        content: "ACTIVE"

      - position: [0, 1]
        label: "MODE"
        content: "AUTO"

      - position: [0, 2]
        label: "STATUS"
        content: "GREEN"

    style:
      rows: 1
      columns: 3

      # Percentage-based custom positioning
      label_position:
        x: "20%"                      # 20% from left edge
        y: "30%"                      # 30% from top edge
        anchor: "start"               # text anchor
        baseline: "hanging"           # text baseline

      value_position:
        x: "80%"                      # 80% from left edge
        y: "70%"                      # 70% from top edge
        anchor: "end"                 # Right-aligned text
        baseline: "baseline"          # Bottom-aligned text

      text_padding: 4
      show_labels: true
      show_values: true
      font_size: 14
      label_color: "var(--lcars-cyan)"
      value_color: "var(--lcars-white)"
      cell_color: "var(--lcars-blue-dark)"
```

### Example 9: Environmental Sensor Matrix
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