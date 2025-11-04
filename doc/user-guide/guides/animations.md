# Animation System Guide

## Overview

The CB-LCARS Animation System allows you to add dynamic animations to your overlays using anime.js v4. Animations can be triggered by user interactions (tap, hold, hover), data changes, or automatically on load.

## Basic Syntax

Add animations to any overlay using the `animations` array:

```yaml
overlays:
  - id: my_button
    type: button
    position: [100, 100]
    size: [200, 40]
    animations:
      - preset: glow
        trigger: on_hover
        duration: 300
        color: var(--picard-lightest-blue)
```

## Animation Triggers

### Interactive Triggers

These triggers respond to user interactions:

- **`on_tap`** - Fires when the overlay is tapped/clicked
- **`on_hold`** - Fires when the overlay is held for 500ms
- **`on_hover`** - Fires when the mouse enters the overlay (desktop only)
- **`on_leave`** - Fires when the mouse leaves the overlay (desktop only)
- **`on_double_tap`** - Fires on double-tap/double-click

**Note:** Interactive triggers work automatically - **you don't need to define `tap_action`** or other actions for animations to work! The system will automatically enable pointer events for overlays with interactive animation triggers.

**Hover/Leave Behavior:**
- Hover animations with `loop: true` **automatically stop** when the pointer leaves
- The element returns to its original visual state (no frozen frames)
- `on_leave` animations can run when the pointer leaves
- Leave animations work even without hover animations

Example:
```yaml
overlays:
  - id: hover_button
    type: button
    position: [50, 250]
    size: [200, 40]
    animations:
      - preset: glow
        trigger: on_hover  # No tap_action needed!
        loop: true         # Stops automatically on leave
        duration: 300
```

### Reactive Triggers

These triggers respond to data or lifecycle changes:

- **`on_load`** - Fires once when the overlay is rendered
- **`on_datasource_change`** - Fires when a datasource value changes (requires `datasource` property)

**Simple Datasource Animation:**

Use `on_datasource_change` for animations that should play on **every** data update:

```yaml
data_sources:
  cpu_temp:
    type: entity
    entity: sensor.cpu_temperature

overlays:
  - id: cpu_display
    type: button
    label: "CPU"
    content: "{cpu_temp}"
    animations:
      - preset: pulse
        trigger: on_datasource_change
        datasource: cpu_temp  # Pulse on every update
        duration: 300
```

**Conditional Animations via Rules:**

For animations that should only play when conditions are met, use rules:

```yaml
rules:
  - id: high_temp_alert
    when:
      entity: cpu_temp  # Use entity: for datasources
      above: 80
    apply:
      overlays:
        cpu_display:  # Overlay ID as key (not array!)
          animations:
            - preset: glow
              color: var(--lcars-red)
              duration: 1000
              loop: true
          style:
            color: var(--lcars-red)
```

**Important:** Rules use object syntax for overlays (overlay ID as key), not array syntax.

## Built-in Animation Presets

### glow
Creates a glowing effect using drop-shadow filters.

```yaml
animations:
  - preset: glow
    trigger: on_hover
    duration: 300
    color: var(--picard-lightest-blue)
    intensity: 0.8  # 0-1, default 0.6
```

Parameters:
- `color`: Glow color (CSS color value)
- `intensity`: Glow strength (0-1, default 0.6)
- `duration`: Animation duration in ms

### pulse
Scales an element up and down in a pulsing motion.

```yaml
animations:
  - preset: pulse
    trigger: on_load
    duration: 1000
    scale: 1.1  # Maximum scale factor
    iterations: infinite  # Or a number
```

Parameters:
- `scale`: Maximum scale (default 1.1)
- `iterations`: Number of pulses (default `infinite`)
- `easing`: Easing function (default `easeInOutSine`)

### fade
Fades opacity in or out.

```yaml
animations:
  - preset: fade
    trigger: on_load
    duration: 500
    from: 0      # Starting opacity
    to: 1        # Ending opacity
```

Parameters:
- `from`: Starting opacity (0-1, default 0)
- `to`: Ending opacity (0-1, default 1)

### slide
Slides an element from one position to another.

```yaml
animations:
  - preset: slide
    trigger: on_load
    duration: 600
    from: [0, -50]  # Relative offset [x, y]
    to: [0, 0]
```

Parameters:
- `from`: Starting offset `[x, y]` (default `[0, 0]`)
- `to`: Ending offset `[x, y]` (default `[0, 0]`)

### rotate
Rotates an element.

```yaml
animations:
  - preset: rotate
    trigger: on_tap
    duration: 400
    angle: 360  # Degrees to rotate
```

Parameters:
- `angle`: Rotation angle in degrees (default 360)

## Custom Animations

Define custom animations using anime.js properties:

```yaml
overlays:
  - id: custom_button
    type: button
    animations:
      - trigger: on_tap
        duration: 400
        easing: easeOutElastic(1, .5)
        targets: .  # '.' targets the overlay itself
        properties:
          scale: [1, 1.2, 1]
          rotate: [0, 10, -10, 0]
```

### Animation Properties

- `trigger`: When to play (required)
- `duration`: Length in milliseconds
- `easing`: Anime.js easing function
- `delay`: Delay before start (ms)
- `iterations`: Number of times to repeat (or `infinite`)
- `direction`: `normal`, `reverse`, `alternate`
- `targets`: CSS selector or `.` for self
- `properties`: Object with anime.js animation properties

## Multiple Animations

You can add multiple animations to a single overlay:

```yaml
overlays:
  - id: multi_anim_button
    type: button
    animations:
      - preset: glow
        trigger: on_load
        duration: 1000
        color: var(--picard-light-blue)

      - preset: pulse
        trigger: on_tap
        duration: 300
        scale: 1.05

      - preset: glow
        trigger: on_hover
        duration: 200
        color: var(--picard-lightest-blue)
```

## Custom Presets

Define reusable animation presets at the root level:

```yaml
animation_presets:
  custom_pulse:
    duration: 800
    easing: easeInOutQuad
    properties:
      scale: [1, 1.15, 1]
      opacity: [1, 0.8, 1]

overlays:
  - id: my_button
    type: button
    animations:
      - preset_ref: custom_pulse
        trigger: on_tap
```

## Performance Tips

1. **Use built-in presets** when possible - they're optimized for performance
2. **Avoid animating too many overlays** simultaneously
3. **Keep durations reasonable** (200-600ms for most interactions)
4. **Use hardware-accelerated properties**: `transform`, `opacity`, `filter`
5. **Avoid**: `left`, `top`, `width`, `height` (these trigger layout)

## Desktop vs Mobile

- `on_hover` and `on_leave` only work on desktop (devices with mouse pointers)
- Touch devices support `on_tap`, `on_hold`, and `on_double_tap`
- The system automatically detects device capabilities
- Hover animations with `loop: true` automatically stop when the pointer leaves

## Reactive Animations

Reactive animations respond to data changes in your Home Assistant system. They're perfect for visual feedback when sensors change, thresholds are exceeded, or system states transition.

### Basic Datasource Animation

The simplest reactive animation uses `on_datasource_change` to trigger whenever a datasource updates:

```yaml
overlays:
  - id: cpu_indicator
    type: elbow
    datasource: cpu_temp
    animations:
      - preset: pulse
        trigger: on_datasource_change
        datasource: cpu_temp
        duration: 500
        color: var(--lcars-gold)
```

**Key Points:**
- The `datasource` property is **required** for `on_datasource_change` trigger
- Animation plays every time the datasource value changes
- No conditions - it triggers on ANY change
- Great for simple "data updated" indicators

### Conditional Animations with Rules

For animations that should only play under certain conditions, use the Rules system:

```yaml
datasources:
  - name: cpu_temp
    entity: sensor.processor_temperature

overlays:
  - id: cpu_display
    type: elbow
    text: "CPU: {cpu_temp}°C"

rules:
  - when:
      entity: cpu_temp
      above: 80
    apply:
      overlays:
        cpu_display:         # Overlay ID as key (NOT array syntax!)
          style:
            fill: var(--lcars-red)
          animations:
            - preset: glow
              color: var(--lcars-red)
              duration: 1000
              loop: true
```

**Critical Syntax:**
- Rules use `overlays:` as an **object with overlay IDs as keys**
- ❌ WRONG: `overlays: [{ id: cpu_display, ... }]` (array syntax)
- ✅ CORRECT: `overlays: { cpu_display: { ... } }` (object syntax)
- Use `entity:` in conditions to reference datasources (not `source:`)

### Multiple Conditions

Combine multiple rules for different visual states:

```yaml
rules:
  - when:
      entity: cpu_temp
      above: 90
    apply:
      overlays:
        cpu_display:
          style:
            fill: var(--lcars-red)
          animations:
            - preset: glow
              color: var(--lcars-red)
              duration: 500
              loop: true

  - when:
      entity: cpu_temp
      above: 75
      below: 90
    apply:
      overlays:
        cpu_display:
          style:
            fill: var(--lcars-orange)
          animations:
            - preset: pulse
              color: var(--lcars-orange)
              duration: 800
```

### Tag-Based Targeting

Animate multiple overlays at once using tags:

```yaml
overlays:
  - id: sensor_1
    type: elbow
    tags: [temperature_sensor]
    datasource: room_temp

  - id: sensor_2
    type: elbow
    tags: [temperature_sensor]
    datasource: outdoor_temp

rules:
  - when:
      entity: alarm_state
      equals: triggered
    apply:
      tags:
        temperature_sensor:    # Applies to ALL tagged overlays
          animations:
            - preset: glow
              color: var(--lcars-red)
              loop: true
```

### Type-Based Targeting

Apply animations to all overlays of a certain type:

```yaml
rules:
  - when:
      entity: system_alert
      equals: critical
    apply:
      types:
        button:              # All button overlays
          animations:
            - preset: pulse
              color: var(--lcars-red)
              duration: 1000
              loop: true
```

### Combining Interactive and Reactive

Overlays can have both interactive (hover/tap) and reactive (datasource/rules) animations:

```yaml
overlays:
  - id: warning_button
    type: button
    datasource: warning_level
    animations:
      # Interactive
      - preset: glow
        trigger: on_hover
        duration: 200

      # Reactive (simple)
      - preset: flash
        trigger: on_datasource_change
        datasource: warning_level
        duration: 300

rules:
  # Reactive (conditional)
  - when:
      entity: warning_level
      above: 8
    apply:
      overlays:
        warning_button:
          animations:
            - preset: glow
              color: var(--lcars-red)
              loop: true
```

### Template Syntax in Text

When displaying datasource values in text, use **single braces** for datasources:

```yaml
overlays:
  - id: cpu_display
    type: text
    text: "CPU: {cpu_temp}°C"     # ✅ Datasource: single braces

  - id: sensor_display
    type: text
    text: "Temp: {{entity:sensor.temperature}} °C"  # ✅ HA Entity: double braces
```

**Important:** Text content does NOT auto-update when datasources change. To update text, you must use rules:

```yaml
rules:
  - when:
      entity: cpu_temp
      above: 0  # Always true - forces update on any change
    apply:
      overlays:
        cpu_display:
          text: "CPU: {cpu_temp}°C"  # Text re-evaluated with new value
```

### Common Gotchas

1. **Array vs Object Syntax in Rules:**
   - Rules always use object syntax: `overlays: { id: { patch } }`
   - NOT array syntax: `overlays: [{ id: id, patch }]`

2. **Template Braces:**
   - Datasources: `{datasource_name}` (single braces)
   - HA Entities: `{{entity:sensor.name}}` (double braces)

3. **Text Updates:**
   - Text content doesn't auto-update on datasource changes
   - Must use rules to force re-evaluation of text templates

4. **Datasource Property:**
   - `on_datasource_change` requires `datasource:` property
   - Configuration validator will error if missing

5. **Rules Conditions:**
   - Use `entity:` to reference datasources (not `source:`)
   - RulesEngine resolves datasources automatically

## Common Patterns

### Button hover feedback
```yaml
animations:
  - preset: glow
    trigger: on_hover
    duration: 200
    color: var(--lcars-ui-03)
```

### Hover with auto-stop
```yaml
animations:
  - preset: glow
    trigger: on_hover
    loop: true         # Loops while hovering
    duration: 1000     # Stops automatically on leave
    color: var(--lcars-blue)
```

### Hover + leave animations
```yaml
animations:
  - preset: pulse
    trigger: on_hover
    loop: true
    duration: 800
  - preset: fade       # Plays when pointer leaves
    trigger: on_leave
    opacity: 1.0
    duration: 200
```

### Scale on hover, reset on leave
```yaml
animations:
  - trigger: on_hover
    scale: 1.1
    duration: 300
    easing: easeOutElastic(1, .5)
  - trigger: on_leave
    scale: 1.0
    duration: 200
    easing: easeOutQuad
```

### Leave-only animation
```yaml
animations:
  - preset: fade       # No hover animation needed
    trigger: on_leave
    opacity: 0.5
    duration: 300
```

### Attention-grabbing pulse
```yaml
animations:
  - preset: pulse
    trigger: on_load
    duration: 1500
    scale: 1.08
    iterations: infinite
```

### Smooth fade-in on load
```yaml
animations:
  - preset: fade
    trigger: on_load
    duration: 600
    from: 0
    to: 1
```

### Data change indicator
```yaml
overlays:
  - id: sensor_indicator
    type: elbow
    datasource: my_sensor
    animations:
      - preset: pulse
        trigger: on_datasource_change
        datasource: my_sensor  # Required for on_datasource_change
        duration: 400
        scale: 1.1
```

### Threshold warning with animation
```yaml
datasources:
  - name: temperature
    entity: sensor.temperature

overlays:
  - id: temp_display
    type: text
    text: "Temp: {temperature}°C"

rules:
  - when:
      entity: temperature
      above: 30
    apply:
      overlays:
        temp_display:
          style:
            fill: var(--lcars-red)
          animations:
            - preset: glow
              color: var(--lcars-red)
              duration: 1000
              loop: true
```

### Multi-state visual feedback
```yaml
rules:
  - when:
      entity: system_status
      equals: normal
    apply:
      overlays:
        status_indicator:
          style:
            fill: var(--lcars-green)

  - when:
      entity: system_status
      equals: warning
    apply:
      overlays:
        status_indicator:
          style:
            fill: var(--lcars-orange)
          animations:
            - preset: pulse
              duration: 1000

  - when:
      entity: system_status
      equals: critical
    apply:
      overlays:
        status_indicator:
          style:
            fill: var(--lcars-red)
          animations:
            - preset: glow
              color: var(--lcars-red)
              loop: true
```

### Coordinated tag-based alerts
```yaml
overlays:
  - id: door_1
    type: elbow
    tags: [security]
  - id: door_2
    type: elbow
    tags: [security]
  - id: window_1
    type: elbow
    tags: [security]

rules:
  - when:
      entity: alarm_state
      equals: triggered
    apply:
      tags:
        security:
          animations:
            - preset: flash
              duration: 500
              iterations: infinite
```

## Troubleshooting

### Animation not triggering
- Check that the `trigger` is spelled correctly
- For interactive triggers, ensure the overlay is rendered (check browser DevTools)
- For `on_datasource_change`, verify the `datasource` property is set and matches a datasource name
- For rules-based animations, check that rule conditions are being met (enable debug logging)

### Rules not applying animations
- **Most common issue:** Using array syntax instead of object syntax
  - ❌ WRONG: `overlays: [{ id: my_overlay, animations: [...] }]`
  - ✅ CORRECT: `overlays: { my_overlay: { animations: [...] } }`
- Verify overlay IDs match exactly (case-sensitive)
- Check that conditions are being met (test with simpler conditions)
- Ensure `entity:` is used in conditions (not `source:`)

### Text not updating with datasource changes
- Text content does NOT auto-update when datasources change
- You must use rules to force text re-evaluation:
  ```yaml
  rules:
    - when:
        entity: my_datasource
        above: 0  # Always true - updates on any change
      apply:
        overlays:
          my_text:
            text: "Value: {my_datasource}"
  ```

### Hover not working
- Verify you're on a desktop device (hover doesn't work on touch devices)
- Check browser console for errors
- Ensure the overlay doesn't have `pointer-events: none` in custom styles

### Hover animation won't stop
- This should no longer happen! Looping hover animations automatically stop on `mouseleave`
- If issues persist, check that you're using the latest version
- Verify the animation has a proper `trigger: on_hover` setting

### Animation jumps or glitches
- Reduce `duration` or simplify the animation
- Check for conflicting CSS styles
- Try using a different `easing` function

## Examples

See the [examples directory](../examples/) for complete working examples of:
- Button interactions with animations
- Data-driven animations
- Complex multi-animation sequences
- Custom animation presets
