# LCARS MSD Animation Presets Reference

## Overview

Animation presets provide reusable, stackable effects for MSD overlays. You can apply one or more presets to any line or text, and orchestrate them via timelines for advanced LCARS visuals.

---

## How to Use

- Specify `animation.type` as a string or array of preset names.
- Each preset can have its own config nested under its name.
- All options can be templated or resolved from entity state.
- **Note:** Not all presets can be safely chained together. Some presets (such as `draw` + `motionpath`, or `morph` + `glow`) may conflict if applied in a single animation instance. For these, use timelines to orchestrate them as separate steps or layers.

#### Example: Stacking Compatible Presets

```yaml
line:
  animation:
    type: [draw, glow]         # Compatible: draw and glow can be stacked
    duration: 900
    glow:
      color: var(--lcars-blue-light)
      intensity: 0.8
```

#### Example: Orchestrating Incompatible Presets with Timelines

```yaml
timelines:
  my_sequence:
    steps:
      - targets: "#my_line"
        type: draw
        duration: 900
      - targets: "#my_line"
        type: motionpath
        duration: 1200
        offset: '-=400'
```

---

## Preset Reference

Below, each preset is described with a table of options and a complete YAML example with inline comments.
**For each example, see the corresponding animated GIF below for a visual reference.**

---

### draw

Animates SVG path drawing.

| Option      | Type           | Default      | Description                                   |
|-------------|----------------|-------------|-----------------------------------------------|
| duration    | number         | 1200        | Animation duration in ms                      |
| easing      | string         | easeInOutSine| Easing function for the animation             |
| loop        | bool           | false       | Repeat animation                              |
| alternate   | bool           | false       | Alternate direction each loop                 |
| draw        | array/object   | ['0 0','0 1']| Custom draw values (advanced)                 |

#### Example

```yaml
line:
  animation:
    type: draw                # Animate the line being drawn
    duration: 1200            # Animation lasts 1.2 seconds
    easing: easeInOutSine     # Smooth in/out
    loop: false               # Do not repeat
    alternate: false          # Do not alternate direction
    draw: ['0 0', '0 1']      # Custom draw values (advanced, usually not needed)
```
> ![draw preset animation](PLACEHOLDER_DRAW_GIF)

---

### pulse

Pulses scale and opacity (text), or stroke-width and opacity (lines).

| Option      | Type           | Default      | Description                                   |
|-------------|----------------|-------------|-----------------------------------------------|
| duration    | number         | 1200        | Animation duration in ms                      |
| easing      | string         | easeInOutSine| Easing function                               |
| loop        | bool           | true        | Repeat animation                              |
| alternate   | bool           | true        | Alternate direction each loop                 |
| max_scale   | number         | 1.1 (text)  | Maximum scale factor (text)                   |
| min_opacity | number         | 0.7         | Minimum opacity during pulse                  |

#### Example

```yaml
text:
  animation:
    type: pulse               # Pulse effect for text
    duration: 1000            # 1 second per pulse
    easing: easeInOutSine     # Smooth pulse
    loop: true                # Repeat indefinitely
    alternate: true           # Alternate pulse direction
    pulse:
      max_scale: 1.2          # Scale up to 1.2x
      min_opacity: 0.6        # Fade to 60% opacity at pulse minimum
```
> ![pulse preset animation](PLACEHOLDER_PULSE_GIF)

---

### blink

Blinks opacity between two values.

| Option      | Type           | Default      | Description                                   |
|-------------|----------------|-------------|-----------------------------------------------|
| duration    | number         | 1200        | Animation duration in ms                      |
| min_opacity | number         | 0.3         | Minimum opacity                               |
| max_opacity | number         | 1           | Maximum opacity                               |
| easing      | string         | linear      | Easing function                               |
| loop        | bool           | true        | Repeat animation                              |
| alternate   | bool           | true        | Alternate direction each loop                 |

#### Example

```yaml
text:
  animation:
    type: blink               # Blink effect for text
    duration: 1200            # 1.2 seconds per blink cycle
    min_opacity: 0.3          # Fade to 30% opacity
    max_opacity: 1            # Fade up to 100% opacity
    easing: linear            # Linear fade
    loop: true                # Repeat indefinitely
    alternate: true           # Alternate fade direction
```
> ![blink preset animation](PLACEHOLDER_BLINK_GIF)

---

### fade

Simple fade-in or fade-out.

| Option      | Type           | Default      | Description                                   |
|-------------|----------------|-------------|-----------------------------------------------|
| duration    | number         | 1000        | Animation duration in ms                      |
| direction   | string         | normal      | 'normal' for fade-in, 'reverse' for fade-out  |
| delay       | number         | 0           | Delay before animation starts (ms)            |
| easing      | string         | easeInOutSine| Easing function                               |

#### Example

```yaml
text:
  animation:
    type: fade                # Fade effect for text
    duration: 1000            # 1 second fade
    direction: reverse        # Fade out instead of in
    delay: 500                # Wait 0.5 seconds before starting
    easing: easeInOutSine     # Smooth fade
```
> ![fade preset animation](PLACEHOLDER_FADE_GIF)

---

### glow

Animates stroke color and drop-shadow for a glowing effect.

| Option        | Type     | Default                | Description                                   |
|---------------|----------|------------------------|-----------------------------------------------|
| color         | string   | var(--picard-light-blue)| Glow color                                   |
| intensity     | number   | 0.8                    | Glow strength (opacity)                       |
| blur_min      | number   | 0                      | Minimum blur radius                           |
| blur_max      | number   | 12                     | Maximum blur radius                           |
| opacity_min   | number   | 0.4                    | Minimum opacity                               |
| opacity_max   | number   | intensity              | Maximum opacity                               |
| duration      | number   | 900                    | Animation duration in ms                      |
| easing        | string   | easeInOutSine          | Easing function                               |
| loop          | bool     | true                   | Repeat animation                              |
| alternate     | bool     | true                   | Alternate direction each loop                 |

#### Example

```yaml
line:
  animation:
    type: glow                # Glow effect for line
    duration: 900             # 0.9 seconds per glow cycle
    glow:
      color: var(--picard-light-blue) # Glow color
      intensity: 0.8                  # Glow strength
      blur_min: 0                     # Start with no blur
      blur_max: 12                    # Blur up to 12px
      opacity_min: 0.4                # Fade to 40% opacity
      opacity_max: 0.8                # Fade up to 80% opacity
    easing: easeInOutSine             # Smooth glow
    loop: true                        # Repeat indefinitely
    alternate: true                   # Alternate glow direction
```
> ![glow preset animation](PLACEHOLDER_GLOW_GIF)

---

### shimmer

Animates fill and opacity for a shimmering effect.

| Option      | Type           | Default      | Description                                   |
|-------------|----------------|-------------|-----------------------------------------------|
| color       | string         | var(--lcars-yellow)| Shimmer color                          |
| duration    | number         | 1200        | Animation duration in ms                      |
| easing      | string         | easeInOutSine| Easing function                               |
| loop        | bool           | true        | Repeat animation                              |
| alternate   | bool           | true        | Alternate direction each loop                 |

#### Example

```yaml
text:
  animation:
    type: shimmer             # Shimmer effect for text
    duration: 1200            # 1.2 seconds per shimmer cycle
    shimmer:
      color: var(--lcars-yellow) # Shimmer color
    easing: easeInOutSine         # Smooth shimmer
    loop: true                    # Repeat indefinitely
    alternate: true               # Alternate shimmer direction
```
> ![shimmer preset animation](PLACEHOLDER_SHIMMER_GIF)

---

### strobe

Rapidly toggles opacity for a strobe effect.

| Option      | Type           | Default      | Description                                   |
|-------------|----------------|-------------|-----------------------------------------------|
| duration    | number         | 400         | Animation duration in ms                      |
| easing      | string         | steps(2, end)| Step easing for sharp transitions             |
| loop        | bool           | true        | Repeat animation                              |
| alternate   | bool           | true        | Alternate direction each loop                 |

#### Example

```yaml
line:
  animation:
    type: strobe               # Strobe effect for line
    duration: 400              # 0.4 seconds per strobe cycle
    easing: steps(2, end)      # Sharp step transitions
    loop: true                 # Repeat indefinitely
    alternate: true            # Alternate strobe direction
```
> ![strobe preset animation](PLACEHOLDER_STROBE_GIF)

---

### cascade

Staggers opacity animation for multiple elements.

| Option      | Type           | Default      | Description                                   |
|-------------|----------------|-------------|-----------------------------------------------|
| stagger     | number         | 100         | Delay between each element in ms              |
| duration    | number         | 800         | Animation duration in ms                      |
| easing      | string         | easeOutQuad | Easing function                               |
| loop        | bool           | false       | Repeat animation                              |

#### Example

```yaml
line:
  animation:
    type: cascade              # Cascade effect for multiple lines
    duration: 800              # 0.8 seconds per cascade
    cascade:
      stagger: 100             # 0.1 second delay between each element
    easing: easeOutQuad        # Ease out for smooth finish
    loop: false                # Do not repeat
```
> ![cascade preset animation](PLACEHOLDER_CASCADE_GIF)

---

### ripple

Animates scale and opacity for a ripple effect.

| Option      | Type           | Default      | Description                                   |
|-------------|----------------|-------------|-----------------------------------------------|
| max_scale   | number         | 2           | Maximum scale factor                          |
| duration    | number         | 1200        | Animation duration in ms                      |
| easing      | string         | easeInOutSine| Easing function                               |
| loop        | bool           | true        | Repeat animation                              |
| alternate   | bool           | true        | Alternate direction each loop                 |

#### Example

```yaml
line:
  animation:
    type: ripple               # Ripple effect for line
    duration: 1200             # 1.2 seconds per ripple
    ripple:
      max_scale: 2             # Scale up to 2x
    easing: easeInOutSine      # Smooth ripple
    loop: true                 # Repeat indefinitely
    alternate: true            # Alternate ripple direction
```
> ![ripple preset animation](PLACEHOLDER_RIPPLE_GIF)

---

### flicker

Randomizes opacity for a flicker effect.

| Option      | Type           | Default      | Description                                   |
|-------------|----------------|-------------|-----------------------------------------------|
| duration    | number         | 600         | Animation duration in ms                      |
| easing      | string         | steps(4, end)| Step easing for random flicker                |
| loop        | bool           | true        | Repeat animation                              |
| alternate   | bool           | false       | Do not alternate direction                    |

#### Example

```yaml
text:
  animation:
    type: flicker              # Flicker effect for text
    duration: 600              # 0.6 seconds per flicker cycle
    easing: steps(4, end)      # Step easing for random flicker
    loop: true                 # Repeat indefinitely
    alternate: false           # Do not alternate direction
```
> ![flicker preset animation](PLACEHOLDER_FLICKER_GIF)

---

### march

CSS-based marching dashed line animation.

| Option          | Type     | Default      | Description                                   |
|-----------------|----------|-------------|-----------------------------------------------|
| stroke_dasharray| array    | [25, 15]    | Dash/gap pattern for line                     |
| duration        | number   | 2000        | Animation duration in ms                      |
| loop            | bool/num | true        | Repeat animation (true/infinite, false/1, or number of loops) |
| reversed        | bool     | false       | Reverse direction of marching effect          |
| playbackRate    | number   | 1           | Speed multiplier for animation                |

#### Example

```yaml
line:
  stroke_dasharray: [25, 15]   # 25px dash, 15px gap
  animation:
    type: march                # Marching ants effect
    duration: 2000             # 2 seconds per cycle
    loop: true                 # Repeat indefinitely
    reversed: false            # March forward
    playbackRate: 1            # Normal speed
```
> ![march preset animation](PLACEHOLDER_MARCH_GIF)

---

### motionpath

Animates an element along a path, with optional tracer and trail.

| Option         | Type     | Default      | Description                                   |
|----------------|----------|-------------|-----------------------------------------------|
| path_selector  | string   | (required)  | CSS selector for path to follow               |
| tracer         | object   | (optional)  | Tracer element config (see below)             |
| trail          | object   | (optional)  | Trail effect config (see below)               |
| duration       | number   | 1000        | Animation duration in ms                      |
| loop           | bool     | false       | Repeat animation                              |
| direction      | string   | normal      | Animation direction                           |

#### Tracer Options

| Option   | Type   | Default      | Description                                   |
|----------|--------|-------------|-----------------------------------------------|
| shape    | string | circle      | Shape of tracer ('circle' or 'rect')          |
| r        | number | 4           | Radius for circle tracer                      |
| width    | number | 8           | Width for rect tracer                         |
| height   | number | 8           | Height for rect tracer                        |
| fill     | string | var(--lcars-orange)| Fill color for tracer                   |
| style    | object | {}          | Additional CSS styles                         |
| id       | string | auto        | Custom tracer element ID                      |

#### Trail Options

| Option   | Type   | Default      | Description                                   |
|----------|--------|-------------|-----------------------------------------------|
| color    | string | var(--lcars-yellow)| Trail color                             |
| duration | number | 500         | Trail animation duration in ms                |
| mode     | string | overlay     | 'overlay' or 'single' (hide base line)        |
| stroke-width | number | 4       | Trail line width                              |
| opacity  | number | 1           | Trail opacity                                 |

#### Example

```yaml
line:
  animation:
    type: motionpath           # Animate tracer along line path
    path_selector: "#warp_core_path" # CSS selector for path to follow
    duration: 2000             # 2 seconds per cycle
    loop: true                 # Repeat indefinitely
    direction: normal          # Move forward
    tracer:
      shape: circle            # Use a circle tracer
      r: 15                    # Radius 15px
      fill: var(--lcars-blue)  # Blue tracer
      style:
        stroke: var(--lcars-yellow) # Yellow outline
        stroke-width: 2             # 2px outline
    trail:
      color: var(--lcars-light-blue) # Light blue trail
      duration: 500                  # 0.5 seconds per trail animation
      mode: overlay                  # Overlay trail on base line
      stroke-width: 6                # 6px wide trail
      opacity: 0.7                   # 70% opacity
```
> ![motionpath preset animation](PLACEHOLDER_MOTIONPATH_GIF)

---

## Stacking/Chaining Presets

You can stack multiple compatible presets by specifying `type` as an array. Each preset mutates/augments the animation parameters.

#### Example

```yaml
line:
  animation:
    type: [draw, glow, flicker]      # Stack compatible effects
    duration: 1000
    glow:
      color: var(--lcars-blue-light)
      intensity: 0.8
    flicker:
      duration: 500
```
> ![stacking presets animation](PLACEHOLDER_STACKING_GIF)

**Important:**
Some presets are **not compatible** when stacked directly (e.g. `draw` + `motionpath`, `morph` + `glow`).
For these, use a timeline to sequence or layer the effects:

```yaml
timelines:
  advanced_effects:
    steps:
      - targets: "#my_line"
        type: draw
        duration: 900
      - targets: "#my_line"
        type: morph
        duration: 1200
        offset: '-=400'
```
> ![timeline sequencing animation](PLACEHOLDER_TIMELINE_GIF)

---

## Per-Preset Config

Each preset can have its own config nested under its name.

#### Example

```yaml
line:
  animation:
    type: [draw, glow]
    duration: 900
    glow:
      color: var(--lcars-blue-light)
      intensity: 0.8
```
> ![per-preset config animation](PLACEHOLDER_PERPRESET_GIF)

---

## Full Preset Option Reference

| Preset    | Options (all optional unless noted) |
|-----------|-------------------------------------|
| draw      | duration, easing, loop, alternate, draw |
| pulse     | duration, easing, loop, alternate, max_scale, min_opacity |
| blink     | duration, min_opacity, max_opacity, easing, loop, alternate |
| fade      | duration, direction, delay, easing |
| glow      | color, intensity, blur_min, blur_max, opacity_min, opacity_max, duration, easing, loop, alternate |
| shimmer   | color, duration, easing, loop, alternate |
| strobe    | duration, easing, loop, alternate |
| cascade   | stagger, duration, easing, loop |
| ripple    | max_scale, duration, easing, loop, alternate |
| flicker   | duration, easing, loop, alternate |
| march     | stroke_dasharray, duration, loop, reversed, playbackRate |
| motionpath| path_selector, tracer, trail, duration, loop, direction |

---

## Notes

- All config values can be templated or resolved from state/context.
- Stacking presets: configs for each preset are nested under their name.
- **Not all presets are compatible for stacking; use timelines for advanced or conflicting combinations.**
- All durations are in milliseconds.
- All colors can use CSS variables.

---

## Tips

- Use stacking for simple, compatible layered effects (e.g., draw + glow).
- Use timelines for advanced sequencing, incompatible, or split effects.
- For advanced trail/tracer effects, see motionpath options.

---

## See Also

- [Main MSD Documentation](./msd-main.md)
- [Timeline Documentation](./msd-timelines.md) (if present)

---
