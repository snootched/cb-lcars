# Status Grid Overlay - Quick Reference

## 📚 Complete Documentation
For comprehensive status grid documentation including advanced features, DataSource integration, Rules Engine integration, interactive actions, and configuration schema, see:

**👉 [Status Grid Complete Documentation](./status_grid_overlay_complete_documentation.md)**

## Quick Start

### Basic Status Grid
```yaml
overlays:
  - type: status_grid
    id: my_grid
    position: [100, 50]
    size: [200, 150]
    style:
      rows: 3
      columns: 4
```

### Interactive Status Grid with Actions
```yaml
overlays:
  - type: status_grid
    id: device_controls
    position: [100, 50]
    size: [300, 200]

    # Grid-level action (fallback)
    tap_action:
      action: navigate
      navigation_path: /lovelace/devices

    cells:
      - id: light_cell
        position: [0, 0]
        label: "Living Room"
        content: "ON"
        # Cell-specific actions (preferred)
        tap_action:
          action: toggle
          entity: light.living_room
        hold_action:
          action: more-info
          entity: light.living_room

      - id: fan_cell
        position: [0, 1]
        label: "Fan"
        content: "OFF"
        tap_action:
          action: toggle
          entity: fan.ceiling_fan

    style:
      rows: 1
      columns: 2
      show_labels: true
      cell_color: "var(--lcars-blue)"
```

### DataSource Integration
```yaml
overlays:
  - type: status_grid
    id: sensor_grid
    position: [100, 50]
    size: [240, 120]

    cells:
      - position: [0, 0]
        source: temperature.living_room
        label: "Living Room"
        content: "{temperature.living_room:.1f}°C"
        tap_action:
          action: more-info
          entity: sensor.living_room_temperature

      - position: [0, 1]
        source: temperature.kitchen
        label: "Kitchen"
        content: "{temperature.kitchen:.1f}°C"

    style:
      rows: 1
      columns: 2
      show_labels: true
      show_values: true
```

### LCARS Styling
```yaml
overlays:
  - type: status_grid
    id: lcars_grid
    position: [100, 50]
    size: [200, 150]

    style:
      rows: 3
      columns: 4
      # LCARS features
      lcars_corners: true
      bracket_style: true
      bracket_color: "var(--lcars-orange)"
      status_indicator: "var(--lcars-green)"
      # Animation
      cascade_speed: 1.5
      cascade_direction: "row"
      reveal_animation: true
```

## Key Features Reference

### Action Types
- **tap_action** - Click/tap action
- **hold_action** - Long press action
- **double_tap_action** - Double-tap action

### Action Levels
- **Overlay-level** - Apply to entire grid
- **Cell-level** - Apply to individual cells (preferred)
- **Mixed** - Cell actions override overlay actions

### DataSource Integration
- **Individual cells** - `source: datasource_name`
- **Template strings** - `content: "{source:.1f}°C"`
- **Auto-generation** - `sources: [array_of_sources]`

### LCARS Features
- **lcars_corners** - LCARS-style cut corners
- **bracket_style** - LCARS brackets around grid
- **cascade animations** - Perfect for anime.js
- **status_indicator** - Status indicator dot
- **radius normalization** - HA theme integration

### Status Detection
- **auto** - Automatic status detection
- **ranges** - Custom status ranges
- **per-cell colors** - Cell-level color overrides

## Common Patterns

### Smart Home Control Grid
```yaml
cells:
  - position: [0, 0]
    label: "Lights"
    content: "ON"
    tap_action: { action: toggle, entity: light.living_room }
    hold_action: { action: more-info, entity: light.living_room }
```

### System Monitoring Grid
```yaml
cells:
  - position: [0, 0]
    source: system.cpu
    label: "CPU"
    content: "{system.cpu:.0f}%"
    tap_action: { action: navigate, navigation_path: /lovelace/system }
```

### Mixed Action Grid
```yaml
# Overlay default
tap_action: { action: navigate, navigation_path: /lovelace/overview }

cells:
  - position: [0, 0]
    label: "Controllable"
    # Has specific action - overrides overlay default
    tap_action: { action: toggle, entity: light.kitchen }

  - position: [0, 1]
    label: "Display Only"
    # No action - uses overlay default
```

For complete documentation including all configuration options, advanced examples, and troubleshooting, see the [complete documentation](./status_grid_overlay_complete_documentation.md).