# MSD Actions System

The MSD (Master Systems Display) includes a comprehensive actions system that allows you to make your overlays interactive. You can attach Home Assistant actions to any overlay element, making your displays not just informational but fully functional control interfaces.

## Features

- **Universal Compatibility**: Works with all overlay types (status grids, sparklines, gauges, etc.)
- **Full Action Support**: All Home Assistant action types (toggle, more-info, call-service, navigate, url, etc.)
- **Button-Card Bridge**: Uses custom-button-card's proven action system for full compatibility
- **Template Support**: Actions support templates, confirmations, and sounds via button-card
- **Multi-Level Actions**: Both overlay-level and element-specific actions
- **Non-Blocking**: Actions don't cause MSD re-renders or visual glitches

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

### Supported Action Types

All Home Assistant action types are supported:

#### Toggle Action
```yaml
tap_action:
  action: toggle
  entity: light.example
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
    entity_id: light.example
    brightness: 180
    color_name: blue
```

#### Navigation
```yaml
tap_action:
  action: navigate
  navigation_path: /lovelace/lights
```

#### URL Actions
```yaml
tap_action:
  action: url
  url_path: https://example.com
  new_tab: true
```

## Advanced Usage

### Status Grid Cell-Level Actions

Status grids support per-cell actions for granular control. Actions are defined directly on each cell configuration for intuitive organization:

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

## Future Enhancements

- **Gesture Support**: Swipe actions for mobile interfaces
- **Conditional Actions**: Actions that change based on state
- **Action Sequences**: Multi-step action workflows
- **Visual Feedback**: Enhanced visual responses to actions