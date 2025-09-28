# Text Overlay - Quick Reference

## 📚 Complete Documentation
For comprehensive text overlay documentation including advanced features, DataSource integration, styling options, and configuration schema, see:

**👉 [Text Overlay Complete Documentation](./text_overlay_complete_documentation.md)**

## Quick Start

### Basic Text Overlay
```yaml
overlays:
  - type: text
    id: my_text
    position: [100, 50]
    text: "Hello World"
```

## Interactive Text Overlays

Text overlays support full Home Assistant actions for creating interactive labels and controls:

### Simple Actions
```yaml
overlays:
  - type: text
    id: temperature_display
    position: [50, 100]
    text: "Living Room: 23°C"

    # Tap to show more info
    tap_action:
      action: more-info
      entity: sensor.living_room_temperature

    # Hold to toggle fan
    hold_action:
      action: toggle
      entity: switch.living_room_fan

    # Double-tap to adjust temperature
    double_tap_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.living_room
        temperature: 22
```

### Navigation Actions
```yaml
overlays:
  - type: text
    id: room_label
    position: [50, 100]
    text: "Living Room"

    tap_action:
      action: navigate
      navigation_path: /lovelace/living-room

    hold_action:
      action: url
      url_path: https://home-assistant.io
      new_tab: true
```

## Data Source Integration with Actions

Combine dynamic data with interactive actions:

```yaml
overlays:
  - type: text
    id: climate_control
    position: [50, 100]
    data_source: sensor.thermostat_temperature
    value_format: "Current: {value}°C"

    # Action references same entity as data source
    tap_action:
      action: more-info
      entity: climate.thermostat

    hold_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.thermostat
        temperature: 21
```

## Advanced Features

### Template Actions
```yaml
overlays:
  - type: text
    id: dynamic_control
    position: [50, 100]
    text: "{sensor.living_room_temperature.value}°C"
    data_source: sensor.living_room_temperature

    tap_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.living_room
        # Template: Set to current temp + 1
        temperature: "{{ states('sensor.living_room_temperature') | float + 1 }}"
```

### Multi-line Text with Actions
```yaml
overlays:
  - type: text
    id: system_status
    position: [50, 100]
    multiline: true
    text: |
      System Status
      CPU: 45%
      Memory: 67%
      Uptime: 2d 14h

    tap_action:
      action: navigate
      navigation_path: /lovelace/system

    hold_action:
      action: call-service
      service: homeassistant.restart
      confirmation:
        text: "Are you sure you want to restart Home Assistant?"
```

## Best Practices

### Action Design
- **Use intuitive actions**: Tap for primary, hold for secondary
- **Provide visual feedback**: Actions automatically add pointer cursor
- **Test thoroughly**: Verify actions work with your entities

### Performance
- **Minimize complex templates**: Keep action templates simple
- **Use entity references**: Prefer entity IDs over complex service calls
- **Test on mobile**: Ensure hold actions work well on touch devices

### User Experience
- **Clear labeling**: Make it obvious what actions do
- **Consistent patterns**: Use similar actions across similar text elements
- **Fallback content**: Ensure text is useful even without actions

## Action Types Reference

All standard Home Assistant action types are supported:

- `toggle` - Toggle entity state
- `more-info` - Show entity more-info dialog
- `call-service` - Call any Home Assistant service
- `navigate` - Navigate to dashboard path
- `url` - Open URL (internal or external)
- `fire-dom-event` - Fire custom DOM events

See the main [MSD Actions Documentation](./msd-actions.md) for complete action reference and troubleshooting.