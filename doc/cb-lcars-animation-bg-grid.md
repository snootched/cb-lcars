# CB-LCARS Animation Background Grid

A highly customizable animated background grid for CB-LCARS cards, supporting multiple grid types, animated starfields, nebula effects, and advanced animation controls.

---

## Overview

This template provides a flexible, animated grid background for your CB-LCARS cards. It supports rectangular, hexagonal, and diagonal grid patterns, with optional animated backgrounds such as starfields and nebulae. Both the grid and the background can be independently animated with scroll or zoom effects.

---

## Configuration

### Basic Usage

```yaml
type: custom:button-card
template:
  - cb-lcars-animation-bg-grid
variables:
  animation:
    bg_grid:
      # ...your customizations here...
```

---

## Variables Reference

All variables are set under `variables.animation.bg_grid`.

### Top-Level Options

| Variable                | Type      | Default         | Description                                                                                 |
|-------------------------|-----------|-----------------|---------------------------------------------------------------------------------------------|
| `direction`             | string    | `left`          | Animation direction: `left`, `right`, `up`, `down`                                          |
| `speed`                 | number    | `30`            | Default animation speed (seconds) for scroll/zoom                                            |
| `background_pattern`    | string    | `none`          | Background pattern: `none`, `stars`, `nebula`, `fill`                                       |
| `background_effect`     | string    | `auto`          | Animation effect for background: `auto`, `scroll`, `zoom`, `none`                           |
| `background_speed`      | number    | `null`          | Speed for background animation (overrides global `speed`)                                   |
| `background_zoom`       | object    | `{}`            | Zoom animation config for background (see below)                                            |
| `grid_effect`           | string    | `auto`          | Animation effect for grid: `auto`, `scroll`, `zoom`, `none`                                 |
| `grid_speed`            | number    | `null`          | Speed for grid animation (overrides global `speed`)                                         |
| `grid_animation`        | string    | `auto`          | (Alias for `grid_effect`)                                                                   |
| `grid_zoom`             | object    | `{}`            | Zoom animation config for grid (see below)                                                  |
| `grid_pattern`          | string    | `rect`          | Grid pattern: `rect`, `hex`, `diagonal`                                                     |

---

### Grid Options (`grid`)

| Variable             | Type    | Default | Description                                      |
|----------------------|---------|---------|--------------------------------------------------|
| `num_major_rows`     | number  | `3`     | Number of major rows                             |
| `num_minor_rows`     | number  | `3`     | Minor rows between major rows                    |
| `num_major_cols`     | number  | `3`     | Number of major columns                          |
| `num_minor_cols`     | number  | `3`     | Minor columns between major columns              |
| `line_width_major`   | number  | `4`     | Stroke width for major grid lines                |
| `line_width_minor`   | number  | `1`     | Stroke width for minor grid lines                |
| `border_lines`       | bool    | `true`  | Show border lines                                |
| `hex_radius`         | number  | auto    | (Hex grid) Radius of hexagons                    |

---

### Color Options (`color`)

| Variable   | Type   | Default                    | Description                       |
|------------|--------|----------------------------|-----------------------------------|
| `line`     | string | `var(--picard-dark-gray)`  | Color for grid lines              |
| `fill`     | string | `transparent` or user-set  | Fill color for grid cells         |

---

### Starfield Options (`stars`)

| Variable         | Type    | Default | Description                                 |
|------------------|---------|---------|---------------------------------------------|
| `count`          | number  | `150`   | Number of stars                             |
| `seed`           | number  | `1`     | Seed for random star placement              |
| `min_radius`     | number  | `0.2`   | Minimum star radius                         |
| `max_radius`     | number  | `0.9`   | Maximum star radius                         |
| `min_brightness` | number  | `0.2`   | Minimum star brightness (opacity)           |
| `max_brightness` | number  | `1.0`   | Maximum star brightness (opacity)           |
| `pattern_width`  | number  | `200`   | Width of star pattern tile                  |
| `pattern_height` | number  | `200`   | Height of star pattern tile                 |
| `color`          | string/array | `#fff` | Color(s) for stars (hex, rgb, CSS var)      |

---

### Nebula Options (`nebula`)

| Variable             | Type    | Default   | Description                                                      |
|----------------------|---------|-----------|------------------------------------------------------------------|
| `preset`             | string  | `default` | Name of nebula preset (see `nebula_presets`)                     |
| `nebula_effect`      | bool    | `true`    | Enable SVG turbulence/displacement effect                        |
| `baseFrequency`      | number  | `1`       | Turbulence base frequency                                        |
| `numOctaves`         | number  | `3`       | Turbulence octaves                                               |
| `scale`              | number  | `40`      | Displacement scale                                               |
| `seed`               | number  | `2`       | Turbulence seed                                                  |
| `blur`               | bool    | `true`    | Apply Gaussian blur                                              |
| `animate`            | bool    | `true`    | Animate turbulence                                               |
| `animation_duration` | number  | `20`      | Animation duration (seconds)                                     |

#### Nebula Layers (`nebula_layers`)
- Array of custom nebula layer objects (used if `preset: custom`):
  - `color`: string (hex/rgb/CSS var)
  - `cx`: number (center x, 0-100)
  - `cy`: number (center y, 0-100)
  - `rx`: number (x radius)
  - `ry`: number (y radius)
  - `opacity_stops`: array (e.g. `[1, 0.3, 0]`)

#### Nebula Presets (`nebula_presets`)
- Object mapping preset names to arrays of nebula layer objects (see above for structure).
- Presets included: `orion`, `crab`, `cosmic_embers`, `iridescent_drift`, `emerald_void`, `ethereal_drift`.

---

### Zoom Animation Options (`background_zoom`, `grid_zoom`)

| Variable           | Type    | Default | Description                                      |
|--------------------|---------|---------|--------------------------------------------------|
| `layers`           | number  | `3`     | Number of zoom layers                            |
| `scale_to`         | number  | `2`     | Final scale factor for zoom                      |
| `duration`         | number  | `speed` | Animation duration (seconds)                     |
| `opacity_fade_in`  | number  | `10`    | % of animation for fade-in                       |
| `opacity_fade_out` | number  | `80`    | % of animation for fade-out                      |

---

## Example Configuration

```yaml
type: custom:button-card
template:
  - cb-lcars-animation-bg-grid
variables:
  animation:
    bg_grid:
      direction: right
      speed: 20
      background_pattern: nebula
      background_effect: zoom
      background_zoom:
        layers: 4
        scale_to: 2.5
        duration: 30
      grid_effect: scroll
      grid_speed: 15
      grid_pattern: hex
      grid:
        num_major_rows: 4
        num_minor_rows: 2
        num_major_cols: 4
        num_minor_cols: 2
        line_width_major: 3
        line_width_minor: 1
        border_lines: true
        hex_radius: 18
      color:
        line: var(--picard-yellow)
        fill: var(--picard-dark-gray)
      nebula:
        preset: orion
        nebula_effect: true
        baseFrequency: 0.8
        numOctaves: 4
        scale: 50
        seed: 5
        blur: true
        animate: true
        animation_duration: 25
```

---

## Grid Patterns

- **Rectangular** (default): Standard grid with major/minor lines.
- **Hexagonal**: Honeycomb pattern, with major/minor hexes.
- **Diagonal**: Hatched/diagonal lines.

---

## Background Patterns

- **none**: No background, just grid.
- **stars**: Animated starfield (customizable).
- **nebula**: Animated nebula clouds (customizable, supports presets and custom layers).
- **fill**: Solid fill color.

---

## Animation Effects

- **scroll**: Infinite scrolling effect (directional).
- **zoom**: Infinite zoom effect (multiple layers).
- **none**: Static background/grid.

---

## Advanced

- Both grid and background can be animated independently.
- All colors support CSS variables for theme integration.
- Nebula and starfield backgrounds are fully customizable and tile seamlessly.

---

## Presets

Several nebula presets are included (`orion`, `crab`, `cosmic_embers`, `iridescent_drift`, `emerald_void`, `ethereal_drift`). You can also define your own custom nebula layers.

---

## File Location

`src/cb-lcars/cb-lcars-animation-bg-grid.yaml`

---

## See Also

- CB-LCARS README
- Other Animation Templates

---

**Tip:** For more advanced usage, refer to the comments and code in the YAML file for further customization options.