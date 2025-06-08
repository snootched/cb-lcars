# CB-LCARS Animation Pulsewave

A flexible animated pulsewave background template for CB-LCARS cards, supporting animated lines with customizable heights, colors, angles, and animation patterns.

---

## Overview

This template enables animated pulsewave lines as a background for your CB-LCARS cards. You can configure the number of lines, line heights, colors, angles, and animation pattern. The pulsewave can animate in various waveforms, including custom timing and keyframes.

---

## Configuration

### Basic Usage

```yaml
type: custom:button-card
template:
  - cb-lcars-animation-pulsewave
variables:
  animation:
    pulsewave:
      # ...your customizations here...
```

---

## Variables Reference

All variables are set under `variables.animation.pulsewave`.

### Top-Level Options

| Variable                | Type      | Default         | Description                                                                                 |
|-------------------------|-----------|-----------------|---------------------------------------------------------------------------------------------|
| `pattern`               | string    | `default`       | Animation pattern: `default`, `niagara`, `sine`, `square`, `triangle`, `sawtooth`, `random`, `custom` |
| `custom_pattern`        | array/JSON|string/array      | Custom animation pattern (array of CSS animation strings or JSON string)                    |
| `custom_keyframes`      | string    | (internal)      | Custom CSS keyframes for animation (optional, overrides default)                            |
| `num_lines`             | number    | auto            | Number of lines (auto-calculated if not set)                                                |
| `scale_line_heights`    | bool      | `true`          | Scale line heights to card height                                                           |
| `align_items`           | string    | `center`        | CSS align-items for the wrapper                                                             |
| `justify_content`       | string    | `center`        | CSS justify-content for the wrapper                                                         |

---

### Line Options

| Variable           | Type   | Default                    | Description                       |
|--------------------|--------|----------------------------|-----------------------------------|
| `line_height`      | number | `20`                       | Default line height (px)          |
| `line_heights`     | array  | `[180,120,230,60,30]`      | Array of original line heights    |
| `line_width`       | number | `3`                        | Width of odd lines (px)           |
| `line_width_even`  | number | `4`                        | Width of even lines (px)          |
| `line_angle`       | number | `15`                       | Angle (degrees) for line rotation |
| `line_transform`   | string | `rotate(line_angle deg)`   | CSS transform for lines           |

---

### Colour Options (`color`)

| Variable           | Type   | Default                        | Description                       |
|--------------------|--------|--------------------------------|-----------------------------------|
| `line_color`       | string | `black`                        | Base color for lines              |
| `start_color`      | string | `var(--lcars-ui-tertiary)`     | Start color for gradient/animation|
| `end_color`        | string | `black`                        | End color for gradient/animation  |
| `animation_start`  | string | `var(--picard-blue)`           | (Fallback) Start color for animation |
| `animation_end`    | string | `#000`                         | (Fallback) End color for animation   |

---

## Example Configurations

### Example 1: Default Pulsewave

```yaml
type: custom:button-card
template:
  - cb-lcars-animation-pulsewave
variables:
  animation:
    pulsewave:
      pattern: default
      color:
        line_color: var(--lcars-orange)
        start_color: var(--lcars-yellow)
        end_color: var(--lcars-orange)
      line_height: 24
      line_width: 4
      line_width_even: 6
      line_angle: 12
```

### Example 2: Sine Wave Pattern with Custom Heights

```yaml
type: custom:button-card
template:
  - cb-lcars-animation-pulsewave
variables:
  animation:
    pulsewave:
      pattern: sine
      line_heights: [120, 180, 90, 60, 150]
      scale_line_heights: true
      color:
        line_color: "#222"
        start_color: "#26f"
        end_color: "#def"
      line_width: 3
      line_width_even: 5
      line_angle: 20
```

### Example 3: Custom Animation Pattern

```yaml
template:
  - cb-lcars-animation-pulsewave
variables:
  animation:
    pulsewave:
      line_angle: 15
      scale_line_heights: true
      pattern: custom
      custom_pattern: |
        [
          "animateLine3 13s 0.2s infinite",
          "animateLine2 13s 0.3s infinite",
          "animateLine3 13s 0.4s infinite",
          "animateLine3 13s 0.5s infinite",
          "animateLine2 13s 0.6s infinite",
          "animateLine2 13s 0.7s infinite",
          "animateLine2 13s 0.8s infinite",
          "animateLine1 13s 0.9s infinite",
          "animateLine1 1s 1s infinite",
          "animateLine2 1s 0.8s infinite",
          "animateLine2 1s 0.7s infinite",
          "animateLine2 1s 0.6s infinite",
          "animateLine3 1s 0.5s infinite",
          "animateLine3 1s 0.4s infinite",
          "animateLine2 1s 0.3s infinite",
          "animateLine2 1s 0.2s infinite"
        ]
      custom_keyframes: |
        @keyframes animateLine1 {
          0% { height: 50px; }
          50% { height: 25px; }
          100% { height: 50px; }
        }
        @keyframes animateLine2 {
          0% { height: 100px; }
          50% { height: 50px; }
          100% { height: 100px; }
        }
        @keyframes animateLine3 {
          0% { height: 75px; }
          50% { height: 37.5px; }
          100% { height: 75px; }
        }
```

---

## Animation Patterns

- **default**: Standard pulsewave animation.
- **niagara**: Faster, uniform animation.
- **sine**: Sine wave animation.
- **square**: Square wave animation.
- **triangle**: Triangle wave animation.
- **sawtooth**: Sawtooth wave animation.
- **random**: Randomized animation.
- **custom**: User-defined pattern via `custom_pattern`.

---

## Advanced

- All colors support CSS variables for theme integration.
- Number of lines auto-calculates to fit the card unless overridden.
- Custom patterns and keyframes allow for advanced animation effects.
- Line heights can be scaled to fit the card.

---

## File Location

![`src/cb-lcars/cb-lcars-animation-pulsewave.yaml`](../src/cb-lcars/cb-lcars-animation-pulsewave.yaml)

---

## See Also

- CB-LCARS ![README](../README.md)
- Other Animation Templates

---

**Tip:** For more advanced usage, refer to the comments and code in the YAML file for further customization options.
