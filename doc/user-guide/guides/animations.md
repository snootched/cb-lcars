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
- **`on_datasource_change`** - Fires when a datasource value changes (requires `watch` property)

Example with datasource:
```yaml
datasources:
  - id: my_sensor
    source: sensor.temperature

overlays:
  - id: temp_display
    type: text
    content: "{{ my_sensor }}"
    animations:
      - preset: pulse
        trigger: on_datasource_change
        watch: my_sensor  # Watch this datasource
        duration: 500
```

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
animations:
  - preset: pulse
    trigger: on_datasource_change
    watch: my_datasource
    duration: 400
    scale: 1.1
```

## Troubleshooting

### Animation not triggering
- Check that the `trigger` is spelled correctly
- For interactive triggers, ensure the overlay is rendered (check browser DevTools)
- For `on_datasource_change`, verify the `watch` property matches a datasource ID

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
