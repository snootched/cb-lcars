# CB-LCARS Animation: GEO Array

GEO Array is a customizable animated background for CB-LCARS cards, supporting arrays of geometric shapes (squares, circles, triangles, etc.)  With advanced customization options, you can configure the type, count, color, size, and animation of the shapes, as well as advanced effects such as row/column animation, custom patterns, and color cycling (like with Data Cascade.)

![geo-array-example](../images/screenshots/cb-lcars-geo-array-samples-1.gif)

- All colors support CSS variables for theme integration.
- Grid size auto-calculates to fit the card unless overridden.
- Custom patterns and keyframes allow for advanced animation effects.
- Both row and column animation modes are supported.

---

## Configuration

### Basic Usage

```yaml
type: custom:cb-lcars-elbow-card
template:
  - cb-lcars-animation-geo-array
variables:
  animation:
    geo_array:
      # ...your customizations here...
```

---

## Variables Reference

All variables are set under `variables.animation.geo_array`.

| Variable                | Type      | Default         | Description                                                                                 |
|-------------------------|-----------|-----------------|---------------------------------------------------------------------------------------------|
| `animation_axis`        | string    | `row`           | Animation axis: `row` or `column` (controls if animation is per-row or per-column)          |
| `pattern`               | string    | `default`       | Animation pattern: `default`, `niagara`, `frozen`, `custom`                                 |
| `custom_pattern`        | array/JSON|string/array      | Custom animation pattern (array of `{duration, delay}` objects or JSON string)              |
| `custom_keyframes`      | string    | (internal)      | Custom CSS keyframes for animation (optional, overrides default)                            |
| `align_items`           | string    | `center`        | CSS align-items for the grid wrapper                                                        |
| `justify_content`       | string    | `center`        | CSS justify-content for the grid wrapper                                                    |

---

### Grid Options (`grid`)

Variables under `variables.animation.geo_array.grid`

| Variable             | Type    | Default | Description                                      |
|----------------------|---------|---------|--------------------------------------------------|
| `num_cols`           | number  | auto    | Number of columns (auto-calculated if not set)    |
| `num_rows`           | number  | auto    | Number of rows (auto-calculated if not set)       |
| `gap`                | number  | `8`     | Gap (px) between grid cells                       |
| `row_height`         | string/number | auto | Height of each row (defaults to shape size)       |
| `column_width`       | string/number | auto | Width of each column (defaults to shape size)     |

---

### Colour Options (`color`)

Variables under `variables.animation.geo_array.color`

| Variable           | Type   | Default                    | Description                       |
|--------------------|--------|----------------------------|-----------------------------------|
| `base`             | string | `var(--picard-dark-blue)`  | Base color for shapes             |
| `animation_start`  | string | `var(--picard-blue)`       | Start color for animation         |
| `animation_end`    | string | `transparent`              | End color for animation           |
| `animation_end2`   | string | `var(--picard-moonlight)`  | Optional second end color         |

---

### Shape Options (`shape`)

Variables under `variables.animation.geo_array.shape`

| Variable   | Type   | Default   | Description                                      |
|------------|--------|-----------|--------------------------------------------------|
| `type`     | string | `square`  | Shape type: `square`, `circle`, `triangle`, `diamond`, `star`, `pentagon`, `hexagon`, `octagon`, `ellipse`, `cross` |
| `size`     | number | `12`      | Size (px) of the shape (width/height or diameter) |

---

## Example Configurations

### Example 1: Animated Squares (Default)

```yaml
type: custom:cb-lcars-elbow-card
template:
  - cb-lcars-animation-geo-array
variables:
  animation:
    geo_array:
      animation_axis: row
      grid:
        gap: 10
      color:
        base: var(--picard-dark-blue)
        animation_start: var(--picard-blue)
        animation_end: transparent
      shape:
        type: square
        size: 14
```

### Example 2: Animated Circles with Niagara Pattern

```yaml
type: custom:cb-lcars-elbow-card
template:
  - cb-lcars-animation-geo-array
variables:
  animation:
    geo_array:
      animation_axis: column
      pattern: niagara
      grid:
        gap: 6
      color:
        base: "#222"
        animation_start: "#26f"
        animation_end: "#def"
      shape:
        type: circle
        size: 16
```

### Example 3: Custom Animation Pattern

```yaml
type: custom:cb-lcars-elbow-card
template:
  - cb-lcars-animation-geo-array
variables:
  animation:
    geo_array:
      pattern: custom
      custom_pattern: |
        [
          {"duration": 2, "delay": 0.1},
          {"duration": 3, "delay": 0.2},
          {"duration": 4, "delay": 0.3}
        ]
      color:
        base: "#333"
        animation_start: "#f80"
        animation_end: "#fff"
      shape:
        type: hexagon
        size: 18
```

---

## File Location

![`src/cb-lcars/cb-lcars-animation-geo-array.yaml`](../src/cb-lcars/cb-lcars-animation-geo-array:.yaml)

---

## See Also

- CB-LCARS ![README](../README.md)
- Other Animation Templates

---

**Tip:** For more advanced usage, refer to the comments and code in the YAML file for further customization options.
