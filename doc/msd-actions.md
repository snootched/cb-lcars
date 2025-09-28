# MSD Action System Documentation

## Overview

The MSD (Multi-State Display) system includes a comprehensive action system that allows interactive overlays. Users can tap, hold, and double-tap on overlays to trigger Home Assistant actions, making your displays not just informational but fully functional control interfaces.

## Supported Overlay Types

### ✅ Status Grid Overlays
- **Overlay-level actions** - Apply to entire grid
- **Cell-level actions** - Apply to individual cells
- **Mixed actions** - Some cells have actions, others use overlay defaults

### ✅ Text Overlays
- **Overlay-level actions** - Apply to entire text element
- **All action types** - tap, hold, double-tap

### 🔄 Future Support
- **Sparkline Overlays** - Planned for future releases
- **Bar Chart Overlays** - Planned for future releases
- **History Bar Overlays** - Planned for future releases

## Action System Features

### Button-Card Integration
All actions use Home Assistant's proven button-card action system for:
- **Full compatibility** with all Home Assistant action types
- **Template support** in action configurations
- **Sound effects** (on overlay-level actions)
- **Confirmation dialogs** when configured
- **Fresh entity data** in more-info dialogs

### Event Handling
- **Unified timing** - Consistent 500ms hold threshold across all overlays
- **Double-tap detection** - 300ms window for double-tap actions
- **Event coordination** - Cell actions block overlay actions in status grids
- **Proper event bubbling** - Actions don't interfere with other UI elements

### Performance
- **DOM observation** - Automatic action attachment when overlays are rendered
- **Shadow DOM support** - Works correctly in card shadow roots
- **Fallback mechanisms** - Multiple methods to ensure actions are attached
- **Clean event handling** - No memory leaks or duplicate listeners

## Basic Usage

### Simple Overlay Actions

Make an entire overlay clickable by adding actions at the overlay level:

```yaml
overlays:
  - type: status_grid
    id: system_status
    position: [100, 100]
    size: [200, 150]
    # Simple overlay-level actions
    tap_action:
      action: toggle
      entity: light.office
    hold_action:
      action: more-info
      entity: light.office
    double_tap_action:
      action: call-service
      service: light.turn_on
      service_data:
        entity_id: light.office
        brightness: 255
    style:
      rows: 3
      columns: 4
```

## Status Grid Actions

### Overlay-Level Actions
Apply to the entire status grid:

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

    cells:
      - id: cpu_cell
        label: "CPU"
        content: "45%"
      - id: memory_cell
        label: "Memory"
        content: "78%"
```

### Cell-Level Actions (Preferred Method)
Define actions directly on individual cells:

```yaml
overlays:
  - type: status_grid
    id: device_grid
    position: [100, 100]
    size: [300, 200]

    cells:
      - id: light_cell
        label: "Living Room"
        content: "ON"
        # Cell-specific actions
        tap_action:
          action: toggle
          entity: light.living_room
        hold_action:
          action: more-info
          entity: light.living_room

      - id: fan_cell
        label: "Ceiling Fan"
        content: "OFF"
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
        label: "Temperature"
        content: "23°C"
        # No actions - this cell is display-only
```

### Legacy Cell Actions (Still Supported)
The older `style.actions.cells` format still works but is deprecated:

```yaml
overlays:
  - type: status_grid
    id: legacy_grid
    position: [100, 100]
    size: [300, 200]

    style:
      actions:
        cells:
          - cell_id: light_cell
            tap_action:
              action: toggle
              entity: light.living_room

    cells:
      - id: light_cell
        label: "Living Room"
        content: "ON"
```

## Text Overlay Actions

Text overlays support all action types on the entire text element:

### Basic Example
```yaml
overlays:
  - type: text
    id: temperature_display
    position: [50, 100]
    text: "Living Room: 23°C"

    tap_action:
      action: more-info
      entity: sensor.living_room_temperature
    hold_action:
      action: toggle
      entity: switch.living_room_fan
    double_tap_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.living_room
        temperature: 22
```

### Advanced Example with Templates
```yaml
overlays:
  - type: text
    id: dynamic_status
    position: [50, 100]
    text: "{sensor.living_room_temperature.value}°C"
    data_source: sensor.living_room_temperature

    tap_action:
      action: more-info
      entity: sensor.living_room_temperature
    hold_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.living_room
        # Template in action - uses current temperature + 1
        temperature: "{{ states('sensor.living_room_temperature') | float + 1 }}"
```

## Advanced Usage

### Status Grid Cell-Level Actions

Status grids support per-cell actions for granular control. Actions are defined directly on each cell configuration for intuitive organization.

**📖 For complete Status Grid documentation including advanced features, DataSource integration, Rules Engine integration, and comprehensive examples, see:**

**👉 [Status Grid Complete Documentation](./status_grid_overlay_complete_documentation.md)**

### Basic Cell-Level Action Examples

```yaml
overlays:
  - type: status_grid
    id: detailed_controls
    position: [50, 50]
    size: [300, 200]
    style:
      rows: 2
      columns: 3
    cells:
      - id: "cell-0-0"
        position: [0, 0]
        label: "Living Room"
        content: "{light.living_room > 0 ? 'ON' : 'OFF'}"
        # Actions directly on the cell - clean and intuitive!
        tap_action:
          action: toggle
          entity: light.living_room
        hold_action:
          action: more-info
          entity: light.living_room
      - id: "cell-0-1"
        position: [0, 1]
        label: "Kitchen"
        content: "{light.kitchen > 0 ? 'ON' : 'OFF'}"
        tap_action:
          action: toggle
          entity: light.kitchen
      - id: "cell-1-0"
        position: [1, 0]
        label: "Thermostat"
        content: "{climate.house}°F"
        tap_action:
          action: call-service
          service: climate.set_temperature
          service_data:
            entity_id: climate.house
            temperature: 72
        hold_action:
          action: more-info
          entity: climate.house
```

#### Legacy Format (Still Supported)

For backward compatibility, the old format with actions in the style block still works:

```yaml
# Legacy format (still works but not recommended)
overlays:
  - type: status_grid
    style:
      actions:
        cells:
          - cell_id: "cell-0-0"
            tap_action: { action: toggle, entity: light.living_room }
    cells:
      - id: "cell-0-0"
        # Cell config separate from actions
```

### Template Support

Actions support templates just like button-card:

```yaml
tap_action:
  action: call-service
  service: "{{ 'light.turn_on' if states('light.office') == 'off' else 'light.turn_off' }}"
  service_data:
    entity_id: light.office
    brightness: "{{ 255 if now().hour < 22 else 128 }}"
```

### Confirmation Dialogs

Add confirmations for important actions:

```yaml
tap_action:
  action: call-service
  service: switch.turn_off
  service_data:
    entity_id: switch.main_power
  confirmation:
    text: "Are you sure you want to turn off main power?"
```

### Sound Effects

Play sounds when actions are triggered:

```yaml
tap_action:
  action: toggle
  entity: light.office
  haptic: light
  sound: /local/sounds/beep.wav
```

## Implementation Details

### Action Processing Flow

1. **Click Event** → ActionHelpers receives the click
2. **Bridge Execution** → Creates temporary button-card config
3. **Button-Card Processing** → Full template evaluation, confirmations, sounds
4. **Home Assistant Action** → Executes the final action
5. **MSD Protection** → Prevents card re-renders during action execution

### Button-Card Compatibility

The action system uses a bridge pattern to leverage custom-button-card's mature action processing:

- **Full Template Support**: All button-card template features work
- **Confirmation Dialogs**: Native HA confirmation system
- **Sound Effects**: Audio feedback support
- **Haptic Feedback**: Vibration on mobile devices
- **State Evaluation**: Complex conditional logic in actions

### Performance

- **Non-Blocking**: Actions don't trigger MSD re-renders
- **Efficient**: Uses non-reactive config injection
- **Fast**: Direct HASS calls as fallback
- **Cached**: DOM elements are cached for quick updates

## Examples

### Smart Home Control Grid

```yaml
overlays:
  - type: status_grid
    id: smart_home_controls
    position: [100, 100]
    size: [400, 300]
    style:
      rows: 3
      columns: 4
      cell_color: "var(--lcars-blue)"
      show_labels: true
      show_values: true
    cells:
      # Lights row
      - position: [0, 0]
        label: "Living Room"
        content: "{light.living_room.brightness}%"
        color: "{{ 'var(--lcars-orange)' if is_state('light.living_room', 'on') else 'var(--lcars-gray)' }}"
        tap_action: { action: toggle, entity: light.living_room }
        hold_action: { action: more-info, entity: light.living_room }
      - position: [0, 1]
        label: "Kitchen"
        content: "{light.kitchen.brightness}%"
        tap_action: { action: toggle, entity: light.kitchen }
      - position: [0, 2]
        label: "Bedroom"
        content: "{light.bedroom.brightness}%"
        tap_action: { action: toggle, entity: light.bedroom }
      - position: [0, 3]
        label: "Office"
        content: "{light.office.brightness}%"
        tap_action: { action: toggle, entity: light.office }

      # Climate row
      - position: [1, 0]
        label: "Thermostat"
        content: "{climate.house}°F"
        tap_action: { action: more-info, entity: climate.house }
        double_tap_action:
          action: call-service
          service: climate.set_temperature
          service_data:
            entity_id: climate.house
            temperature: "{{ 72 if states('climate.house')|float < 72 else 68 }}"
      - position: [1, 1]
        label: "Humidity"
        content: "{sensor.humidity}%"
        tap_action: { action: more-info, entity: sensor.humidity }

      # Security row
      - position: [2, 0]
        label: "Alarm"
        content: "{alarm_control_panel.house}"
        tap_action: { action: more-info, entity: alarm_control_panel.house }
      - position: [2, 1]
        label: "Door Lock"
        content: "{lock.front_door == 'locked' ? 'LOCKED' : 'UNLOCKED'}"
        tap_action: { action: call-service, service: lock.toggle, service_data: { entity_id: lock.front_door } }    # Overlay-level action for main lighting toggle
    tap_action:
      action: call-service
      service: light.toggle
      service_data:
        entity_id:
          - light.living_room
          - light.kitchen
          - light.bedroom
          - light.office

    # Per-cell actions are now defined directly on each cell
```

### Media Control Interface

```yaml
overlays:
  - type: status_grid
    id: media_controls
    position: [50, 400]
    size: [300, 150]
    style:
      rows: 2
      columns: 3
      bracket_style: true
      bracket_color: "var(--lcars-orange)"
    cells:
      - position: [0, 0]
        label: "◀◀"
        content: "PREV"
      - position: [0, 1]
        label: "▶/⏸"
        content: "PLAY"
      - position: [0, 2]
        label: "▶▶"
        content: "NEXT"
      - position: [1, 0]
        label: "🔇"
        content: "MUTE"
      - position: [1, 1]
        label: "VOL"
        content: "{media_player.living_room.attributes.volume_level * 100}%"
      - position: [1, 2]
        label: "PWR"
        content: "POWER"

    style:
      actions:
        cells:
          - cell_id: "cell-0-0"
            tap_action:
              action: call-service
              service: media_player.media_previous_track
              service_data:
                entity_id: media_player.living_room
          - cell_id: "cell-0-1"
            tap_action:
              action: call-service
              service: media_player.media_play_pause
              service_data:
                entity_id: media_player.living_room
          - cell_id: "cell-0-2"
            tap_action:
              action: call-service
              service: media_player.media_next_track
              service_data:
                entity_id: media_player.living_room
          - cell_id: "cell-1-1"
            tap_action:
              action: more-info
              entity: media_player.living_room
```

## Troubleshooting

### Actions Not Working

1. **Check ActionHelpers availability**: Ensure ActionHelpers is imported
2. **Verify card instance**: Actions need access to the button-card instance
3. **Check console logs**: Look for action-related debug messages
4. **Test simple actions first**: Start with basic toggle actions

### Performance Issues

1. **Check for re-renders**: Actions should not trigger MSD card re-renders
2. **Verify element caching**: DOM elements should be cached for updates
3. **Monitor action frequency**: Avoid rapid-fire action triggers

### Template Errors

1. **Use button-card syntax**: Templates follow button-card conventions
2. **Test templates separately**: Verify templates work in regular button-card first
3. **Check entity availability**: Ensure referenced entities exist

## Troubleshooting

### Actions Not Working
1. **Check console logs** for action attachment messages
2. **Verify card instance** is available for action processing
3. **Ensure proper YAML syntax** in action definitions
4. **Test with simple actions** first (like `toggle` or `more-info`)

### Debug Console Commands
```javascript
// Check action system status
window._debugStatusGridActions();

// Manually process pending actions
window._processStatusGridActions();

// Check ActionHelpers availability
console.log('ActionHelpers available:', !!window.ActionHelpers);
```

### Common Issues
- **Missing entity IDs** - Ensure entities exist in Home Assistant
- **Invalid service calls** - Check service and service_data syntax
- **Template errors** - Verify template syntax in action configurations
- **Card instance missing** - Some actions require the card to be fully loaded

## Best Practices

### Performance
- **Use cell-level actions** instead of legacy `style.actions.cells` format
- **Minimize complex templates** in action configurations
- **Test actions** with simple configurations first

### User Experience
- **Provide visual feedback** - Use cursor: pointer styling (automatic)
- **Use intuitive actions** - tap for primary action, hold for secondary
- **Consider accessibility** - Provide alternative access methods for complex actions

### Maintainability
- **Consistent action patterns** across similar overlays
- **Clear entity references** - use descriptive entity IDs
- **Document complex actions** in YAML comments

## Migration Guide

### From Legacy Cell Actions
**Old format (deprecated):**
```yaml
style:
  actions:
    cells:
      - cell_id: my_cell
        tap_action:
          action: toggle
          entity: light.example
```

**New format (preferred):**
```yaml
cells:
  - id: my_cell
    label: "My Cell"
    tap_action:
      action: toggle
      entity: light.example
```

### Benefits of New Format
- **Cleaner configuration** - actions defined with cell data
- **Better performance** - more efficient action attachment
- **Enhanced debugging** - clearer error messages and logging
- **Future-proof** - supports upcoming features like conditional actions

## Future Enhancements

- **Gesture Support**: Swipe actions for mobile interfaces
- **Conditional Actions**: Actions that change based on state
- **Action Sequences**: Multi-step action workflows
- **Visual Feedback**: Enhanced visual responses to actions