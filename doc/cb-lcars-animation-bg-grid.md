# CB-LCARS Animation Background Grid

A highly customizable animated background grid for CB-LCARS cards, supporting multiple grid types, animated starfields, nebula effects, and advanced animation controls.

---

## Overview

This template provides a flexible, animated grid background for your CB-LCARS cards. It supports rectangular, hexagonal, diagonal, and bracket grid patterns, with optional animated backgrounds such as starfields and nebulae. Both the grid and the background can be independently animated with scroll or zoom effects.

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
| `speed`                 | number    | `30`            | Default animation speed (seconds) for scroll/zoom                                           |
| `background_pattern`    | string    | `none`          | Background pattern: `none`, `stars`, `nebula`, `fill`                                       |
| `background_effect`     | string    | `auto`          | Animation effect for background: `auto`, `scroll`, `zoom`, `none`                           |
| `background_speed`      | number    | `null`          | Speed for background animation (overrides global `speed`)                                   |
| `background_zoom`       | object    | `{}`            | Zoom animation config for background (see below)                                            |
| `grid_effect`           | string    | `auto`          | Animation effect for grid: `auto`, `scroll`, `zoom`, `none`                                 |
| `grid_speed`            | number    | `null`          | Speed for grid animation (overrides global `speed`)                                         |
| `grid_zoom`             | object    | `{}`            | Zoom animation config for grid (see below)                                                  |

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
| `preset`             | string  | `rect`  | Grid pattern: `rect`, `hex`, `diagonal`, `bracket`|
| `hex_radius`         | number  | auto    | (Hex grid) Radius of hexagons                    |
| `bracket_width`      | number  | `5`     | (Bracket grid) Width of bracket lines            |
| `bracket_radius`     | number  | `7`     | (Bracket grid) Corner radius                     |
| `bracket_color`      | string  | `var(--lcars-yellow)` | (Bracket grid) Bracket line color      |
| `bracket_gap`        | number  | `35`    | (Bracket grid) Gap from edge (px)                |
| `bracket_fill`       | string  | `rgba(128,128,128,0.08)` | (Bracket grid) Fill color between brackets |
| `bracket_height`     | number  | `20`    | (Bracket grid) Height of brackets (px)           |

---

### Colour Options (`color`)

| Variable   | Type   | Default                    | Description                       |
|------------|--------|----------------------------|-----------------------------------|
| `line`     | string | `var(--picard-dark-gray)`  | Colour for grid lines             |
| `fill`     | string | `transparent` or user-set  | Fill colour for grid cells        |

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
| `color`          | string/array | `#fff` | Colour(s) for stars (hex, rgb, CSS var)      |

---

### Nebula Options (`nebula`)

| Variable             | Type    | Default   | Description                                                      |
|----------------------|---------|-----------|------------------------------------------------------------------|
| `preset`             | string  | `default` | Name of nebula preset (see `nebula_presets`)                     |
| `nebula_effect`      | bool    | `true`    | Enable SVG turbulence/displacement effect                        |
| `base_frequency`     | number  | `1`       | Turbulence base frequency                                        |
| `num_octaves`        | number  | `3`       | Turbulence octaves                                               |
| `scale`              | number  | `40`      | Displacement scale                                               |
| `seed`               | number  | `2`       | Turbulence seed                                                  |
| `blur`               | bool    | `true`    | Apply Gaussian blur                                              |
| `blur_level`         | number  | `8`       | Blur strength (stdDeviation for blur)                            |
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
- Presets included: `orion`, `crab`, `cosmic_embers`, `iridescent_drift`, `emerald_void`, `ethereal_drift`, `aurora_nexus`.

---

### Zoom Animation Options (`background_zoom`, `grid_zoom`)

| Variable           | Type    | Default | Description                                      |
|--------------------|---------|---------|--------------------------------------------------|
| `layers`           | number  | `3`     | Number of zoom layers                            |
| `scale_from`         | number  | `1`     | Initial scale factor for zoom                      |
| `scale_to`         | number  | `2`     | Final scale factor for zoom                      |
| `speed`            | number  | `speed` | Animation duration (seconds)<br>Defaults to global `speed`                  |
| `opacity_fade_in`  | number  | `10`    | % of animation for fade-in                       |
| `opacity_fade_out` | number  | `80`    | % of animation for fade-out                      |

---

## Example Configurations

### Example 1: Animated Nebula with Zoom

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
        speed: 30
      grid_effect: scroll
      grid_speed: 15
      grid:
        num_major_rows: 4
        num_minor_rows: 2
        num_major_cols: 4
        num_minor_cols: 2
        line_width_major: 3
        line_width_minor: 1
        border_lines: true
        preset: hex
        hex_radius: 18
      color:
        line: var(--picard-yellow)
        fill: var(--picard-dark-gray)
      nebula:
        preset: orion
        nebula_effect: true
        base_frequency: 0.8
        num_octaves: 4
        scale: 50
        seed: 5
        blur: true
        blur_level: 8
        animate: true
        animation_duration: 25
```

### Example 2: Animated Starfield with Bracket Grid

```yaml
type: custom:button-card
template:
  - cb-lcars-animation-bg-grid
variables:
  animation:
    bg_grid:
      direction: left
      speed: 25
      background_pattern: stars
      background_effect: scroll
      grid_effect: scroll
      grid:
        preset: bracket
        bracket_width: 8
        bracket_radius: 16
        bracket_color: var(--lcars-orange)
        bracket_gap: 40
        bracket_fill: rgba(255,179,0,0.15)
        bracket_height: 60
      color:
        line: var(--picard-dark-gray)
        fill: var(--picard-black)
      stars:
        count: 200
        seed: 42
        min_radius: 0.3
        max_radius: 1.2
        color: [#fff, #ffd700, #add8e6]
```

---

## Grid Presets

- **rect** (default): Standard grid with major/minor lines.
- **hex**: Honeycomb pattern, with major/minor hexes.
- **diagonal**: Hatched/diagonal lines.
- **bracket**: LCARS-style brackets at left/right edges.

---

## Background Patterns

- **none**: No background, just grid.
- **stars**: Animated starfield (customizable).
- **nebula**: Animated nebula clouds (customizable, supports presets and custom layers).
- **fill**: Solid fill colour.

---

## Animation Effects

- **scroll**: Infinite scrolling effect (directional).
- **zoom**: Infinite zoom effect (multiple layers).
- **none**: Static background/grid.

---

## Advanced

- Both grid and background can be animated independently.
- All colours support CSS variables for theme integration.
- Nebula and starfield backgrounds are fully customizable and tile seamlessly.
- Bracket grid supports custom color, fill, and sizing.

---

## Presets

Several nebula presets are included (`orion`, `crab`, `cosmic_embers`, `iridescent_drift`, `emerald_void`, `ethereal_drift`, `aurora_nexus`). You can also define your own custom nebula layers.

---

## File Location

![`src/cb-lcars/cb-lcars-animation-bg-grid.yaml`](../src/cb-lcars/cb-lcars-animation-bg-grid.yaml)

---

## See Also

- CB-LCARS ![README](../README.md)
- Other Animation Templates

---

**Tip:** For more advanced usage, refer to the comments and code in the YAML file for further customization options.