# Home Assistant Template Syntax in CB-LCARS

CB-LCARS supports Home Assistant template syntax inside overlay content, using the familiar {{ ... }} format. This runs alongside MSD DataSource templates { ... } and both can be mixed in one string.

Highlights
- Use HA functions: states(), state_attr(), is_state(), has_value()
- Pipe formatting: |float, |round(n), |upper, |lower, |title, |unit('X')
- Simple math and conditionals inside a single HA expression
- Unified processing with MSD templates; HA blocks are evaluated first and never altered by MSD parsing
- Safe initial render: HA evaluation is skipped when hass states aren’t ready (no warnings), content remains unchanged

Supported HA functions
- states('entity_id')
- state_attr('entity_id','attribute')
- is_state('entity_id','state')
- has_value('entity_id')
- Pipe formats: |float, |round(n), |upper, |lower, |title, |unit('X')

Math and conditionals
- Simple math: {{ states('sensor.a') | float + states('sensor.b') | float }}
- Simple conditional: {{ states('sensor.temp') | float > 25 and 'HOT' or 'OK' }}
- Direct comparisons: {{ state_attr('climate.house', 'hvac_action') == 'heating' and 'HEAT' or 'IDLE' }}

Examples

Text overlay
```yaml
overlays:
  - id: ha_text
    type: text
    position: [100, 50]
    content: "Temp: {{ states('sensor.living_room_temperature') | float | round(1) }}°C"
    style:
      color: "var(--lcars-white)"
```

Text overlay mixing HA {{}} and MSD {}
```yaml
overlays:
  - id: mixed_text
    type: text
    position: [100, 80]
    content: |
      Inside: {{ states('sensor.living_room_temperature') | float | round(1) }}°C
      Outside: {outdoor_temp_c:.1f}°C
```

Status grid cell with HA template
```yaml
overlays:
  - id: grid_ha
    type: status_grid
    position: [50, 50]
    size: [200, 120]
    cells:
      - position: [0, 0]
        label: "Inside"
        content: "{{ states('sensor.living_room_temperature') | float | round(1) }}°C"
      - position: [0, 1]
        label: "HVAC"
        content: "{{ state_attr('climate.house', 'hvac_action') | title }}"
    style:
      rows: 1
      columns: 2
      show_labels: true
      show_values: true
```

Attribute access
```yaml
content: "Battery: {{ state_attr('sensor.phone', 'battery_level') | float | round(0) }}%"
```

Math and conditional
```yaml
content: >
  {{ (states('sensor.solar_in') | float - states('sensor.load') | float) > 0
      and 'EXPORTING' or 'IMPORTING' }}
```

Behavior and processing
- Order: HA {{...}} evaluated first, then MSD {…}. Any remaining HA blocks are masked from MSD parsing and restored verbatim.
- Initial render: If hass states aren’t available, HA evaluation is skipped (no console warnings) and the original text is displayed.
- Updates: Entity dependencies are tracked; content re-evaluates as HA states change.

Formatting notes
- |float casts numeric strings; |round(n) controls precision.
- |unit('X') appends units to the result.
- Unknown/unavailable entities:
  - Unknown entity logs a warning and yields 'unavailable'
  - Consider guarding with conditionals or has_value()

Best practices
- Prefer state_attr() for attributes instead of parsing JSON/text.
- Cast with |float before math.
- Keep conditionals simple for readability.
- For complex dashboards, mix HA {{}} (entity states) with MSD {} (DataSource values) in one string.

Troubleshooting
- Literal {{...}} showing: verify braces are double and expression is valid; check browser console.
- No value on first load: hass may be initializing; content will update when states become available.
- Numbers not formatting: ensure |float precedes |round; attributes may be strings.
- Mixed templates mis-rendering: ensure HA blocks use {{ }}, DataSource blocks use { }.

See also
- Text Overlay docs: ./text_overlay_complete_documentation.md
- Status Grid docs: ./status_grid_overlay_complete_documentation.md
