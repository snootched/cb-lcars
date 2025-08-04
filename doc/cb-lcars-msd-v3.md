# LCARS MSD Overlay System – v3 Documentation

## Introduction

The LCARS MSD overlay system lets you create dynamic, animated schematic overlays in Home Assistant, inspired by Star Trek's LCARS interface. Overlays are driven by YAML config, support reusable style/animation presets, and leverage a powerful state_resolver for dynamic, context-aware behavior.

---

## MSD Schema Overview

Each MSD overlay is defined in YAML, typically under `variables.msd` in your card config.

### Top-Level Structure

| Key         | Type   | Description                                  |
|-------------|--------|----------------------------------------------|
| base_svg    | string | Path or built-in key for the base SVG        |
| presets     | object | Built-in style/animation presets             |
| custom_presets | object | User-defined/overriding presets           |
| slots       | object | Named overlays, each with a `callout`        |
| callouts    | array  | List of overlays by coordinates              |
| state_resolver | object | Global state-based style resolver         |
| timelines   | object | Animation timelines for orchestration        |

---

## SVG Anchors

Define anchor points in your SVG using `<circle>` or `<text>` elements with unique `id` attributes. These are used for overlay attachment.

```xml
<circle id="warp_core" cx="90" cy="90" r="4" opacity="0"/>
<text id="life_support_label" x="320" y="85" font-size="14" opacity="0">LSA</text>
```

---

## Callouts: Anatomy & Customization

Each callout is a customizable overlay, defined in `slots` (named) or `callouts` (array).

### Callout Structure

| Key          | Type    | Description                                                       |
|--------------|---------|-------------------------------------------------------------------|
| entity       | string  | Home Assistant entity_id                                          |
| preset       | string  | Name of preset to use (optional)                                  |
| text         | object  | Label text and styling                                            |
| anchor       | [x, y] or string | Where the line terminates (coordinates or anchor id)      |
| line         | object  | Line geometry and style                                           |
| visible      | bool/string/template | Show/hide callout (JS template allowed)               |
| state_resolver | object | Per-callout state-based style resolver                           |

#### Example Callout

```yaml
callout:
  entity: sensor.hull_integrity
  preset: warning
  text:
    value: |
      [[[ return `Hull: ${entity.state}%`; ]]]
    position: [88%, 12%]
    font_size: 16px
    color: blue
  anchor: [90%, 15%]
  line:
    points: [[88%, 12%], [90%, 15%]]
    width: 2
    color: blue
    animation:
      type: march
      duration: 2s
  visible: true
```

---

## Text & Line Options

### Text

| Key         | Type      | Description                          |
|-------------|-----------|--------------------------------------|
| value       | string    | Label text (JS template supported)   |
| position    | [x, y] or string | Text coordinates or anchor id  |
| font_size   | string    | Font size (e.g., `16px`)             |
| color       | string    | Text color                           |
| align       | string    | `left`, `right`, `center`, etc.      |
| animation   | object    | Animation for text label             |

### Line

| Key              | Type    | Description                                   |
|------------------|---------|-----------------------------------------------|
| points           | array   | Array of [x, y] points for the callout path   |
| width            | number  | Line width (px)                               |
| color            | string  | Line color                                    |
| stroke_dasharray | array   | Dash/gap pattern (e.g. `[5,5]` for dashed)    |
| animation        | object  | Animation for the line                        |

---

## Animation

Animations bring overlays to life. See [Animation Presets Reference](./msd-animation-presets.md) for full details.

#### Example: Animated Dotted Line

```yaml
line:
  width: 3
  stroke_dasharray: [1, 6]
  color: orange
  animation:
    type: march
    duration: 2s
```

---

## Presets & Merging

Presets are reusable style/animation definitions. Merging order:

1. `default` preset
2. Named preset (if specified)
3. Callout's own properties
4. State-based overrides (`state_resolver`)

#### Example: Using Presets

```yaml
presets:
  default:
    text:
      font_size: 16
      color: var(--primary-text-color)
    line:
      width: 2
      color: var(--lcars-orange)
  warning:
    text:
      color: orange
    line:
      color: orange

callout:
  preset: warning
  text:
    value: "Warning!"
    position: [50%, 50%]
```

---

## State Resolver: Dynamic Styling

The `state_resolver` system enables dynamic, context-aware overlays. It matches entity states/attributes and applies presets or style overrides.

#### Example: State-Based Styling

```yaml
state_resolver:
  enabled: true
  states:
    - entity: light.tv
      attribute: brightness
      from: 0
      to: 50
      preset: default
    - entity: light.tv
      attribute: brightness
      from: 51
      to: 100
      preset: warning
    - entity: sensor.alarm
      attribute: alarm_state
      regex: "^armed_.*$"
      settings:
        line:
          color: var(--lcars-orange)
```

- First matching rule is applied.
- You can override any style property or switch presets.

#### Example: Per-Callout State Resolver

```yaml
callout:
  entity: sensor.warp_core_temp
  state_resolver:
    enabled: true
    states:
      - from: 0
        to: 300
        preset: default
      - from: 301
        to: 1000
        preset: warning
```

---

## Timelines: Animation Orchestration

Timelines allow you to sequence and coordinate multiple animations, stacking effects or orchestrating complex transitions.

#### Example Timeline

```yaml
timelines:
  alert_sequence:
    loop: true
    direction: alternate
    steps:
      - targets: "#alert_indicator"
        type: strobe
        duration: 400
      - targets: "#alert_text"
        type: pulse
        duration: 800
        offset: '-=200'
```

- Each timeline is keyed and can have global params and steps.
- Steps merge: element animation block → timeline globals → step params.

#### When to Use Timelines

- For multi-step, multi-element, or layered effects.
- When you want precise sequencing or overlapping of animations.
- For advanced LCARS visuals (e.g., draw + glow + pulse).

---

## Advanced YAML Example

```yaml
type: custom:cb-lcars-msd-card
variables:
  msd:
    base_svg: /local/lcars/defiant.svg
    presets:
      default:
        text:
          font_size: 16
          color: var(--primary-text-color)
        line:
          width: 2
          color: var(--lcars-orange)
      warning:
        text:
          color: orange
        line:
          color: orange
    slots:
      warp_core:
        callout:
          entity: sensor.warp_core_temp
          preset: default
          text:
            value: |
              [[[ return `Core Temp: ${entity.state}°C`; ]]]
            position: warp_core_label
            color: var(--primary-text-color)
          anchor: warp_core
          line:
            width: 3
            color: green
            animation:
              type: march
              duration: 2s
          state_resolver:
            enabled: true
            states:
              - from: 0
                to: 300
                preset: default
              - from: 301
                to: 1000
                preset: warning
    timelines:
      main_sequence:
        loop: true
        steps:
          - targets: "#warp_core_line"
            type: draw
            duration: 900
          - targets: "#warp_core_label"
            type: pulse
            duration: 1200
            offset: '-=400'
```

---

## Tips & Best Practices

- Use SVG anchors for precise overlay placement.
- Use presets for DRY, consistent styling.
- Use `state_resolver` for dynamic overlays.
- Prefer timelines for advanced animation orchestration.

---

## Migration Notes

- `state_resolver` replaces all simple state matching logic.
- All dynamic styling should use `state_resolver`.
- Timelines are recommended for advanced effects.

---

## Animation Presets Reference

See [Animation Presets Reference](./msd-animation-presets.md) for all available animation types and options.

---

## Timeline Documentation

See [Timeline Documentation](./msd-timelines.md) for advanced orchestration.

---

# End of LCARS MSD Overlay System v3 Documentation
