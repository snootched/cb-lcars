# Rules Engine

> **Dynamic overlay styling and behavior based on entity states, time, and conditions**
> Control your card's appearance and behavior based on real-time data from Home Assistant.

---

## Table of Contents

1. [Overview](#overview)
2. [Basic Rules](#basic-rules)
3. [Rule Structure](#rule-structure)
4. [Conditions](#conditions)
5. [Actions](#actions)
6. [Overlay Styling](#overlay-styling)
7. [Logical Operators](#logical-operators)
8. [Time-Based Rules](#time-based-rules)
9. [Priority and Stop](#priority-and-stop)
10. [Complete Examples](#complete-examples)
11. [Best Practices](#best-practices)

---

## Overview

The **Rules Engine** evaluates conditions and dynamically applies changes to your card based on entity states, time ranges, DataSource values, and more.

### What Can Rules Do?

✅ **Change overlay styles** - Modify colors, sizes, visibility
✅ **Apply base SVG filters** - Dim, blur, or colorize the background
✅ **Activate profiles** - Switch between configuration presets
✅ **Trigger animations** - Start animations based on conditions
✅ **React to sensors** - Respond to temperature, motion, etc.
✅ **Time-based changes** - Different looks for day/night

### How Rules Work

The Rules Engine is **reactive** - rules evaluate when:
- Entity states change in Home Assistant
- DataSource values update
- Time entities trigger (e.g., `sensor.time`)

Rules **do not** continuously poll or run in the background.

---

## Basic Rules

### Simple Entity State Rule

Change overlay color when a light turns on:

```yaml
msd:
  version: 1
  base_svg:
    source: "builtin:ncc-1701-d"

  overlays:
    - id: status_light
      type: text
      text: "Status"
      position: [100, 100]
      style:
        color: var(--lcars-blue)

  rules:
    - id: light_on
      when:
        entity: light.living_room
        state: "on"
      apply:
        overlays:
          - id: status_light
            style:
              color: var(--lcars-green)
              text: "Light ON"
```

### Temperature Threshold Rule

Change color when temperature exceeds a threshold:

```yaml
rules:
  - id: temp_high
    when:
      entity: sensor.temperature
      above: 25
    apply:
      overlays:
        - id: temp_display
          style:
            color: var(--lcars-red)
```

---

## Rule Structure

Every rule has three main parts:

```yaml
rules:
  - id: unique_name           # Unique identifier
    when:                     # Condition(s) to evaluate
      # ... conditions
    apply:                    # Changes to make when conditions are true
      # ... style changes, actions, etc.
```

### Optional Properties

```yaml
rules:
  - id: example
    priority: 100             # Higher priority = evaluated first (default: 0)
    enabled: true             # Enable/disable rule (default: true)
    stop: false               # Stop evaluating other rules after this (default: false)
    when:
      # ...
    apply:
      # ...
```

---

## Conditions

### Entity State

Check if an entity has a specific state:

```yaml
when:
  entity: light.bedroom
  state: "on"
```

### Numeric Comparisons

Check if a numeric entity is above/below a threshold:

```yaml
# Above threshold
when:
  entity: sensor.temperature
  above: 25

# Below threshold
when:
  entity: sensor.humidity
  below: 30

# Between range
when:
  entity: sensor.temperature
  between: [20, 25]
```

### DataSource Conditions

Use DataSource values (raw, transformations, aggregations):

```yaml
data_sources:
  temp_sensor:
    type: entity
    entity: sensor.living_room_temp
    transformations:
      - type: celsius_to_fahrenheit
        id: fahrenheit

rules:
  - id: temp_fahrenheit_check
    when:
      source: temp_sensor.transformations.fahrenheit
      above: 77
    apply:
      # ...
```

### Time Conditions

Check time ranges or days of week:

```yaml
# Time range
when:
  time:
    after: "08:00"
    before: "22:00"

# Day of week
when:
  time:
    weekday: true  # Monday-Friday

# Specific days
when:
  time:
    day: ["sat", "sun"]  # Weekend only
```

**Important:** For time-based rules to work, you need an entity that updates regularly. See [Time-Based Rules](#time-based-rules).

---

## Base SVG Filters

Apply CSS filters to the base SVG background dynamically based on conditions. Filters are defined in `apply.base_svg`.

### Configuration

**Properties:**
- `filters`: Object with filter properties (optional)
- `filter_preset`: Named preset from theme (optional)
- `transition`: Transition duration in milliseconds (default: 1000)

**Filter Properties:**
- `opacity`: 0.0 to 1.0
- `brightness`: 0.0 to 2.0+ (1.0 = normal)
- `contrast`: 0.0 to 2.0+
- `grayscale`: 0.0 to 1.0
- `blur`: "Xpx" (e.g., "2px")
- `sepia`: 0.0 to 1.0
- `hue_rotate`: "Xdeg" (e.g., "90deg")
- `saturate`: 0.0 to 2.0+
- `invert`: 0.0 to 1.0

**Built-in Presets:**
- `none` - Clear all filters (remove filtering)
- `dimmed` - Low opacity and brightness
- `subtle` - Moderate dimming
- `backdrop` - Dim with blur
- `faded` - Low contrast and saturation
- `red-alert` - Dramatic red shift
- `monochrome` - Grayscale

### Example: Using Filter Preset

```yaml
rules:
  - id: night_mode
    when:
      time:
        after: "22:00"
    apply:
      base_svg:
        filter_preset: "dimmed"
        transition: 2000
```

### Example: Custom Filters

```yaml
rules:
  - id: away_mode
    when:
      entity: input_boolean.away_mode
      state: "on"
    apply:
      base_svg:
        filters:
          opacity: 0.3
          grayscale: 0.7
          blur: "1px"
        transition: 1500
```

### Example: Combining Preset and Custom

```yaml
rules:
  - id: sleep_mode
    when:
      entity: input_boolean.sleep_mode
      state: "on"
    apply:
      base_svg:
        filter_preset: "dimmed"      # Start with preset
        filters:
          blur: "2px"                # Add blur
        transition: 3000
```

### Example: Clearing Filters

Remove all filtering when returning to normal state:

```yaml
rules:
  # Apply filter when alert is on
  - id: alert_on
    priority: 100
    when:
      entity: binary_sensor.critical_alert
      state: "on"
    apply:
      base_svg:
        filter_preset: "red-alert"
        transition: 500

  # Clear filter when alert is off
  - id: alert_off
    priority: 90
    when:
      entity: binary_sensor.critical_alert
      state: "off"
    apply:
      base_svg:
        filter_preset: "none"  # Clear all filters
        transition: 1000

# Alternative: use empty filters object
rules:
  - id: normal_mode
    when:
      entity: input_boolean.normal_mode
      state: "on"
    apply:
      base_svg:
        filters: {}  # Clear all filters
        transition: 1000
```

---

## Overlay Styling

Apply style changes to specific overlays when conditions are met.

### Single Overlay

```yaml
rules:
  - id: temp_alert
    when:
      entity: sensor.temperature
      above: 30
    apply:
      overlays:
        - id: temp_display
          style:
            color: var(--lcars-red)
            font_size: 32
```

### Multiple Overlays

```yaml
rules:
  - id: alert_mode
    when:
      entity: binary_sensor.alert
      state: "on"
    apply:
      overlays:
        - id: status_text
          style:
            color: var(--lcars-red)
            text: "⚠️ ALERT"

        - id: indicator_light
          style:
            color: var(--lcars-red)
            visible: true

        - id: background_overlay
          style:
            opacity: 0.5
```

### Bulk Targeting with Tags

Target multiple overlays at once using tags:

```yaml
overlays:
  - id: sensor_1
    type: text
    tags: [sensor, temperature]
    # ...

  - id: sensor_2
    type: text
    tags: [sensor, temperature]
    # ...

rules:
  - id: highlight_sensors
    when:
      entity: input_boolean.highlight_mode
      state: "on"
    apply:
      overlays:
        - tag: temperature  # All overlays with this tag
          style:
            color: var(--lcars-yellow)
```

---

## Logical Operators

Combine multiple conditions using `all`, `any`, and `not`.

### All (AND)

All conditions must be true:

```yaml
when:
  all:
    - entity: sensor.temperature
      above: 25
    - entity: sensor.humidity
      above: 60
    - time:
        after: "10:00"
```

### Any (OR)

At least one condition must be true:

```yaml
when:
  any:
    - entity: sensor.temperature
      above: 30
    - entity: sensor.humidity
      above: 80
    - entity: binary_sensor.alert
      state: "on"
```

### Not (Negation)

Invert a condition:

```yaml
when:
  not:
    entity: light.bedroom
    state: "on"
```

### Nested Logic

Combine operators for complex conditions:

```yaml
when:
  all:
    - any:
        - entity: sensor.indoor_temp
          above: 25
        - entity: sensor.outdoor_temp
          above: 30

    - not:
        entity: climate.ac
        state: "on"

    - time:
        after: "10:00"
        before: "22:00"
```

---

## Time-Based Rules

The Rules Engine is **reactive** - it only evaluates when entity states change. For purely time-based rules, you need an entity that updates regularly.

### Using sensor.time

Home Assistant includes `sensor.time` which updates every minute. Use it to trigger time-based rules:

```yaml
rules:
  - id: night_mode
    when:
      all:
        - entity: sensor.time         # ← Triggers every minute
        - time:
            after: "22:00"
            before: "06:00"
    apply:
      base_svg:
        filter_preset: "dimmed"
```

### Setting Up sensor.time

Usually included by default. If not, add to Home Assistant's `configuration.yaml`:

```yaml
sensor:
  - platform: time_date
    display_options:
      - 'time'
```

### Performance

Using `sensor.time` is efficient:
- Only rules referencing `sensor.time` are evaluated
- Other rules remain idle (no overhead)
- Safe to have 5-10+ time-based rules
- Typical overhead: <5ms per minute

### Multiple Time Periods

```yaml
rules:
  # Morning
  - id: morning_mode
    priority: 100
    when:
      all:
        - entity: sensor.time
        - time:
            after: "06:00"
            before: "12:00"
    apply:
      base_svg:
        filters:
          brightness: 1.0
          opacity: 0.6

  # Afternoon
  - id: afternoon_mode
    priority: 90
    when:
      all:
        - entity: sensor.time
        - time:
            after: "12:00"
            before: "18:00"
    apply:
      base_svg:
        filters:
          brightness: 0.9
          opacity: 0.55

  # Evening
  - id: evening_mode
    priority: 80
    when:
      all:
        - entity: sensor.time
        - time:
            after: "18:00"
            before: "22:00"
    apply:
      base_svg:
        filters:
          brightness: 0.8
          opacity: 0.5

  # Night
  - id: night_mode
    priority: 70
    when:
      all:
        - entity: sensor.time
        - time:
            after: "22:00"
            before: "06:00"
    apply:
      base_svg:
        filter_preset: "dimmed"
```

---

## Priority and Stop

Control the order rules are evaluated and when to stop evaluation.

### Priority

Rules with higher priority are evaluated first:

```yaml
rules:
  # Evaluated first
  - id: critical_alert
    priority: 100
    when:
      entity: sensor.temperature
      above: 40
    apply:
      # ... critical styling

  # Evaluated second
  - id: warning_alert
    priority: 50
    when:
      entity: sensor.temperature
      above: 30
    apply:
      # ... warning styling

  # Evaluated last
  - id: normal_display
    priority: 10
    when:
      entity: sensor.temperature
      below: 30
    apply:
      # ... normal styling
```

**Default:** Priority = 0

### Stop After Match

Stop evaluating other rules when this rule matches:

```yaml
rules:
  - id: critical_temp
    priority: 100
    when:
      entity: sensor.temperature
      above: 40
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "red-alert"
    stop: true  # Stop here if matched

  # This rule won't be evaluated if critical_temp matches
  - id: normal_temp
    priority: 50
    when:
      entity: sensor.temperature
      below: 40
    apply:
      actions:
        - type: update_base_svg_filter
          filters:
            opacity: 0.6
```

**Use Case:** Prevent lower-priority rules from overriding critical alerts.

---

## Complete Examples

### Example 1: Temperature Monitoring

```yaml
msd:
  version: 1

  base_svg:
    source: "builtin:ncc-1701-d"

  data_sources:
    room_temp:
      type: entity
      entity: sensor.living_room_temperature

  overlays:
    - id: temp_display
      type: text
      text: "{{ room_temp }}°C"
      position: [100, 100]
      size: [200, 60]
      style:
        color: var(--lcars-blue)
        font_size: 24

  rules:
    # Critical temperature (red)
    - id: temp_critical
      priority: 100
      when:
        source: room_temp
        above: 30
      apply:
        actions:
          - type: update_base_svg_filter
            filter_preset: "red-alert"
            transition: 500
        overlays:
          - id: temp_display
            style:
              color: var(--lcars-red)
              font_size: 32
              text: "⚠️ {{ room_temp }}°C"
      stop: true

    # Warning temperature (yellow)
    - id: temp_warning
      priority: 50
      when:
        source: room_temp
        above: 25
      apply:
        actions:
          - type: update_base_svg_filter
            filters:
              hue_rotate: "30deg"
              opacity: 0.5
        overlays:
          - id: temp_display
            style:
              color: var(--lcars-yellow)
              font_size: 28

    # Normal temperature (blue)
    - id: temp_normal
      priority: 10
      when:
        source: room_temp
        below: 25
      apply:
        actions:
          - type: update_base_svg_filter
            filters:
              opacity: 0.6
              brightness: 0.9
        overlays:
          - id: temp_display
            style:
              color: var(--lcars-blue)
              font_size: 24
```

### Example 2: Day/Night Mode

```yaml
msd:
  version: 1

  base_svg:
    source: "builtin:ncc-1701-d"

  overlays:
    - id: mode_status
      type: text
      text: "Day Mode"
      position: [100, 50]
      style:
        color: var(--lcars-cyan)

  rules:
    # Night mode (10pm - 6am)
    - id: night_mode
      priority: 100
      when:
        all:
          - entity: sensor.time
          - time:
              after: "22:00"
              before: "06:00"
      apply:
        actions:
          - type: update_base_svg_filter
            filters:
              opacity: 0.2
              brightness: 0.5
              blur: "1px"
            transition: 2000
        overlays:
          - id: mode_status
            style:
              text: "Night Mode"
              color: var(--lcars-purple)

    # Day mode (6am - 10pm)
    - id: day_mode
      priority: 90
      when:
        all:
          - entity: sensor.time
          - time:
              after: "06:00"
              before: "22:00"
      apply:
        actions:
          - type: update_base_svg_filter
            filters:
              opacity: 0.6
              brightness: 0.9
            transition: 2000
        overlays:
          - id: mode_status
            style:
              text: "Day Mode"
              color: var(--lcars-cyan)
```

### Example 3: Multi-Sensor Alert System

```yaml
msd:
  version: 1

  base_svg:
    source: "builtin:ncc-1701-d"

  data_sources:
    temp:
      type: entity
      entity: sensor.temperature
    humidity:
      type: entity
      entity: sensor.humidity

  overlays:
    - id: status
      type: text
      text: "All Systems Normal"
      position: [100, 100]
      size: [400, 80]
      style:
        color: var(--lcars-green)
        font_size: 24

    - id: temp_reading
      type: text
      text: "Temp: {{ temp }}°C"
      position: [100, 200]

    - id: humidity_reading
      type: text
      text: "Humidity: {{ humidity }}%"
      position: [100, 250]

  rules:
    # Critical alert - high temp AND high humidity AND AC off
    - id: critical_climate
      priority: 100
      when:
        all:
          - source: temp
            above: 28
          - source: humidity
            above: 70
          - not:
              entity: climate.ac
              state: "on"
      apply:
        base_svg:
          filter_preset: "red-alert"
          transition: 500
        overlays:
          - id: status
            style:
              text: "⚠️ CRITICAL: Turn on AC!"
              color: var(--lcars-red)
              font_size: 28
          - tag: reading  # If overlays had this tag
            style:
              color: var(--lcars-red)
      stop: true

    # Warning - high temp OR high humidity
    - id: warning_climate
      priority: 50
      when:
        any:
          - source: temp
            above: 26
          - source: humidity
            above: 65
      apply:
        base_svg:
          filters:
            opacity: 0.5
            hue_rotate: "30deg"
        overlays:
          - id: status
            style:
              text: "⚠️ Climate Warning"
              color: var(--lcars-yellow)

    # Normal conditions
    - id: normal_climate
      priority: 10
      when:
        all:
          - source: temp
            below: 26
          - source: humidity
            below: 65
      apply:
        base_svg:
          filters:
            opacity: 0.6
            brightness: 0.9
        overlays:
          - id: status
            style:
              text: "All Systems Normal"
              color: var(--lcars-green)
```

---

## Best Practices

### 1. Use Priority for Fallback Rules

Set higher priority for specific conditions, lower for defaults:

```yaml
rules:
  - id: specific_case
    priority: 100
    when:
      entity: sensor.value
      above: 90
    apply:
      # ... specific styling

  - id: default_case
    priority: 1
    when:
      entity: sensor.value
      below: 90
    apply:
      # ... default styling
```

### 2. Use Stop for Critical Alerts

Prevent other rules from overriding critical states:

```yaml
rules:
  - id: critical_alert
    priority: 100
    when:
      entity: binary_sensor.emergency
      state: "on"
    apply:
      # ... emergency styling
    stop: true  # Don't evaluate other rules
```

### 3. Combine Actions and Overlay Styles

Use actions for global effects, overlay styles for specific elements:

```yaml
rules:
  - id: alert_mode
    when:
      entity: binary_sensor.alert
      state: "on"
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "red-alert"  # Global background effect
      overlays:
        - id: status_text
          style:
            color: var(--lcars-red)   # Specific overlay change
```

### 4. Use DataSource Aggregations for Stable Rules

Avoid flickering by using aggregated values:

```yaml
data_sources:
  temp:
    type: entity
    entity: sensor.temperature
    aggregations:
      - type: avg
        window_size: 300  # 5-minute average

rules:
  - id: stable_temp_check
    when:
      source: temp.aggregations.avg_300
      above: 25
    apply:
      # ... won't flicker on small temp changes
```

### 5. Test Rules Incrementally

Start with simple rules and add complexity:

```yaml
# Start simple
rules:
  - id: test_rule
    when:
      entity: light.test
      state: "on"
    apply:
      overlays:
        - id: test_overlay
          style:
            color: var(--lcars-green)

# Then add complexity
# - id: complex_rule
#   when:
#     all:
#       - entity: light.test
#         state: "on"
#       - time:
#           after: "08:00"
#   apply:
#     # ...
```

---

## Related Documentation

- **[Base SVG Filters](base-svg-filters.md)** - Detailed filter documentation
- **[Bulk Overlay Selectors](bulk-overlay-selectors.md)** - Targeting multiple overlays
- **[DataSources](datasources.md)** - Using data in rules
- **[Architecture: Rules Engine](../../architecture/subsystems/rules-engine.md)** - Technical details

---

**Last Updated:** November 1, 2025
**Version:** 2025.10.1-fuk.42-69
