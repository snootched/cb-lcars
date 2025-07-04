# CB-LCARS Animation: Data Cascade

A flexible animated text cascade background for CB-LCARS cards. This template provides animated rows and columns of numbers, floats, or characters as a dynamic background, with extensive options for grid size, text style, animation patterns (including custom timing and color keyframes), and color transitions.

![data-cascade](../images/screenshots/data_cascade.gif)

- All colors support CSS variables for theme integration.
- Grid size auto-calculates to fit the card unless overridden.
- Custom patterns and keyframes allow for advanced animation effects.
- Text in each cell is randomized (numbers, floats, or characters).

---

## Configuration

### Basic Usage

```yaml
type: custom:cb-lcars-elbow-card
template:
  - cb-lcars-animation-cascade
variables:
  animation:
    cascade:
      # ...your customizations here...
```

---

## Variables Reference

All variables are set under `variables.animation.cascade`.

| Variable                | Type      | Default         | Description                                                                                 |
|-------------------------|-----------|-----------------|---------------------------------------------------------------------------------------------|
| `pattern`               | string    | `default`       | Animation pattern: `default`, `niagara`, `frozen`, `custom`                                 |
| `custom_pattern`        | array/JSON|string/array      | Custom animation pattern (array of `{duration, delay}` objects or JSON string)              |
| `custom_keyframes`      | string    | (internal)      | Custom CSS keyframes for animation (optional, overrides default)                            |
| `align_items`           | string    | `center`        | CSS align-items for the grid wrapper                                                        |
| `justify_content`       | string    | `center`        | CSS justify-content for the grid wrapper                                                    |

---

### Grid Options (`grid`)

Variables under `variables.animation.cascade.grid`

| Variable             | Type    | Default | Description                                      |
|----------------------|---------|---------|--------------------------------------------------|
| `num_cols`           | number  | auto    | Number of columns (auto-calculated if not set)    |
| `num_rows`           | number  | auto    | Number of rows (auto-calculated if not set)       |
| `gap`                | number  | `8`     | Gap (px) between grid cells                       |
| `row_height`         | string/number | auto | Height of each row (defaults to font size)        |
| `column_width`       | string/number | auto | Width of each column (defaults to font size × 2.5)|

---

### Colour Options (`color`)

Variables under `variables.animation.cascade.color`

| Variable           | Type   | Default                    | Description                       |
|--------------------|--------|----------------------------|-----------------------------------|
| `text`             | string | `var(--picard-dark-blue)`  | Base color for text               |
| `animation_start`  | string | `var(--picard-blue)`       | Start color for animation         |
| `animation_end`    | string | `var(--picard-moonlight)`  | End color for animation           |

---

### Text Options (`text`)

Variables under `variables.animation.cascade.text`


| Variable     | Type   | Default | Description                                      |
|--------------|--------|---------|--------------------------------------------------|
| `font_size`  | number | `24`    | Font size (px)                                   |
| `font_weight`| number | `300`   | Font weight                                      |

---

TODO: custom animation

---

## Example Configurations

### Example 1: Animated Cascade (Default)

```yaml
type: custom:cb-lcars-elbow-card
template:
  - cb-lcars-animation-cascade
variables:
  animation:
    cascade:
      grid:
        gap: 10
      color:
        text: var(--picard-dark-blue)
        animation_start: var(--picard-blue)
        animation_end: var(--picard-moonlight)
      text:
        font_size: 28
        font_weight: 400
```

### Example 2: Niagara Pattern with Custom Colors

```yaml
type: custom:cb-lcars-elbow-card
template:
  - cb-lcars-animation-cascade
variables:
  animation:
    cascade:
      pattern: niagara
      grid:
        gap: 6
      color:
        text: "#222"
        animation_start: "#26f"
        animation_end: "#def"
      text:
        font_size: 20
        font_weight: 500
```

### Example 3: Custom Animation Pattern

```yaml
template:
  - cb-lcars-animation-cascade
variables:
  animation:
    cascade:
      pattern: custom
      custom_pattern: |
        [
          { "duration": 1, "delay": 0.1 },
          { "duration": 1.5, "delay": 0.2 },
          { "duration": 2, "delay": 0.3 },
          { "duration": 2.5, "delay": 0.4 },
          { "duration": 3, "delay": 0.5 },
          { "duration": 3.5, "delay": 0.6 },
          { "duration": 4, "delay": 0.7 },
          { "duration": 4.5, "delay": 0.8 }
        ]
      custom_keyframes: |
        @keyframes colorchange {
          0% {color: #ff0000}
          25% {color: #00ff00}
          50% {color: #0000ff}
          75% {color: #ffff00}
          80% {color: #ff00ff}
          90% {color: #00ffff}
          100% {color: #ffffff}
        }
```

---

## File Location

![`src/cb-lcars/cb-lcars-animation-cascade.yaml`](../src/cb-lcars/cb-lcars-animation-cascade.yaml)

---

## See Also

- CB-LCARS ![README](../README.md)
- Other Animation Templates

---

**Tip:** For more advanced usage, refer to the comments and code in the YAML file for further customization options.
