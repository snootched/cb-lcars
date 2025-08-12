# LCARS MSD Overlay System – User Guide (Beginner Friendly)

This guide explains, step by step, how to build animated, data‑driven LCARS‑style overlays (MSD) for Home Assistant dashboards using CB‑LCARS. It covers how the MSD is structured, how the base SVG and anchors work, each overlay type, data sources, animations, and merging rules.

Note: All YAML below lives under your card’s variables.msd unless noted.

— Placeholder for hero image —
![MSD overview placeholder](PLACEHOLDER_MSD_OVERVIEW_IMG)

---------------------------------------------------------------------

## How MSD Works (ELI5)

- Think of MSD as a sandwich:
  - Bottom slice: your base SVG drawing (ship layout).
  - Middle filling: a transparent overlay layer where we “stamp” labels, lines, charts, and ribbons.
  - Top: optional animations that make those overlay elements move or glow.

- You place overlays by either:
  - typing exact coordinates like [x, y], or
  - pointing at named “anchors” in your SVG (special IDs we read), or
  - using percentages like [10%, 25%].

- If a chart needs data (e.g., a temperature sparkline), you tell MSD which Home Assistant entity to use. MSD fetches history (optional) and listens to live updates.

- Animations can be attached right on an overlay (e.g., make a line dash “march”), or orchestrated via timelines across multiple elements.

---------------------------------------------------------------------

## Fast “Hello World” Example

```yaml
type: custom:cb-lcars-msd-card
variables:
  msd:
    base_svg: builtin:ncc-1701-a-blue
    overlays:
      - type: text
        id: br_label
        position: [80%, 18%]
        value: "BRIDGE"
        color: var(--lcars-yellow)

      - type: line
        id: br_conn
        anchor: br
        attach_to: br_label
        width: 3
        color: var(--lcars-yellow)
        animation:
          type: march
          stroke_dasharray:
            - 18
            - 14
          duration: 1400
          loop: true
```

— Placeholder for quick-start gif —
![Quick start placeholder](PLACEHOLDER_QUICK_START_GIF)

---------------------------------------------------------------------

## The Full MSD Structure (Pseudo‑Config)

This is a bird’s‑eye view of what you can put inside variables.msd. You don’t need all of it—add only what you use.

```yaml
variables:
  msd:
    base_svg: builtin:ncc-1701-a-blue
    # OR: /local/path/to/your.svg

    # Optional: define or override anchors
    anchors:
      # anchor_name: [x, y]
      # engine_room: [320, 150]

    # Optional: data sources (used by sparkline/ribbon)
    data_sources:
      toronto_temp:
        entity: sensor.toronto_temperature
        windowSeconds: 48h
        sampleMs: 150
        history:
          hours: 48
          preload: true

    # Optional: reusable style/animation presets merged into overlays
    presets:
      default:
        text:
          font_size: 56
          font_family: Antonio
          color: var(--lcars-yellow)
        line:
          width: 4
          color: var(--lcars-orange)

    # Overlays to stamp on top of the base SVG
    overlays:
      - type: text
        id: wc_label
        position: [12%, 14%]
        value: "WARP CORE"
        color: var(--lcars-yellow)

      - type: line
        id: wc_connector
        anchor: wc
        attach_to: wc_label
        width: 6
        color: var(--lcars-orange)

      - type: sparkline
        id: temp_trend
        position: [10%, 10%]
        size: [80%, 24%]
        source: toronto_temp
        windowSeconds: 48h
        color: var(--lcars-yellow)
        width: 6
        x_mode: index
        extend_to_edges: true
        smooth: true
        smooth_method: monotone
        smooth_tension: 0.7
        grid:
          x: 8
          y: 4
          color: rgba(255,255,255,0.18)
          opacity: 0.6
          width: 1
        markers:
          r: 4
          fill: var(--lcars-blue)
          max: 200
        label_last:
          decimals: 1
          fill: var(--lcars-yellow)
          font_size: 56
          offset:
            - 8
            - -8
          format: "{v}°"

    # Optional: orchestrate animations across multiple elements
    timelines:
      my_sequence:
        loop: true
        easing: easeOutQuad
        steps:
          - targets: "#wc_connector"
            type: march
            stroke_dasharray:
              - 25
              - 25
            duration: 1800
          - targets: "#wc_label"
            type: pulse
            duration: 1200
            offset: "-=400"

    # Optional: standalone animations (rare)
    animations:
      - targets: "#wc_label"
        type: glow
        duration: 900
        glow:
          color: var(--lcars-blue)
          intensity: 0.6
```

---------------------------------------------------------------------

## Base SVG and Anchors (What, Why, How)

ELI5:
- The base SVG is the drawing your overlays sit on (your “map”). We do NOT modify it—we draw on top of it.
- Anchors are named dots or labels inside the SVG we can attach to. They are normal SVG elements with an id and coordinates.

Where base SVG comes from:
- `builtin:<key>` loads a bundled SVG in CB‑LCARS. See cb-lcars-vars.js `builtin_svg_keys`.
- `/local/...` loads your own SVG. Put the `.svg` file in Home Assistant’s `www` folder. Example: `/local/lcars/myship.svg`.

How MSD sizes the SVG:
- We force `width="100%" height="100%"` on your SVG and preserve its `viewBox` aspect ratio. Your overlays use the same coordinate space for precise placement.

Anchor Basics (what counts as an “anchor”):
- We scan your SVG for elements that have BOTH:
  1) a unique id (e.g., `id="br"`), and
  2) absolute coordinates.
- Supported anchor elements:
  - `<circle id="br" cx="240" cy="64" r="2" opacity="0" />`
  - `<text id="engine_room" x="320" y="150" opacity="0">ER</text>`
- Pro tips:
  - Keep anchors small and invisible (`opacity="0"`) so they don’t show.
  - Use predictable names like `wc` (warp core), `br` (bridge), etc.
  - Don’t reuse the same id twice.

Using anchors in overlays:
- `position: "br"` places an element at the anchor’s coordinates.
- `line` overlays can use `anchor` for the start and `attach_to` for the end (another anchor or another overlay’s id).

If an anchor doesn’t work, check:
- The `id` is unique.
- The element has `x/y` or `cx/cy`.
- The SVG actually loaded (path is correct).
- Your overlay id does not conflict with an anchor id.

— Placeholder for SVG and anchor diagram —
![Anchors basics placeholder](PLACEHOLDER_ANCHORS_IMG)

---------------------------------------------------------------------

## Data Sources (for sparkline and ribbon)

Define once under `variables.msd.data_sources`. These feed rolling data to any sparkline or ribbon using the source key you define.

| Key               | Type           | Default | Description |
|-------------------|----------------|---------|-------------|
| `entity`          | string         | —       | Home Assistant entity id. |
| `attribute`       | string         | —       | Optional attribute instead of `state`. |
| `windowSeconds`   | number|string  | 60 (s)  | Buffer window. Units: `ms`, `s`, `m`, `h`, `d` (e.g., `10m`, `24h`). |
| `sampleMs`        | number         | 100     | Min milliseconds between live updates to subscribers (throttle). |
| `history.hours`   | number         | 24      | How many hours to preload when `preload` is true. |
| `history.preload` | boolean        | false   | If true, fetches recent history first to avoid a flat first paint. |

Example (fully expanded YAML):

```yaml
msd:
  data_sources:
    toronto_temp:
      entity: sensor.toronto_temperature
      windowSeconds: 72h
      sampleMs: 150
      history:
        hours: 72
        preload: true
```

---------------------------------------------------------------------

## Overlay Types and Options

Every overlay supports an optional `animation` block. Keys are shown with back‑ticks. Where a value is an object, we also list the object’s keys in a separate table.

— Placeholder for overlay types image —
![Overlay types placeholder](PLACEHOLDER_OVERLAY_TYPES_IMG)

### 1) Text

| Key          | Type                | Default | Description |
|--------------|---------------------|---------|-------------|
| `id`         | string              | —       | Unique element id. |
| `type`       | string              | `text`  | Overlay type. |
| `position`   | [x,y] or string     | —       | Coordinates `[x,y]` (numbers or `%`) or anchor id. |
| `value`      | string              | —       | Text content; can use triple‑bracket JS templates. |
| `font_size`  | number or string    | `18`    | Font size (number or CSS string). |
| `font_family`| string              | `Antonio` | Font family. |
| `font_weight`| string              | `normal` | Font weight. |
| `align`      | string              | `start` | SVG text-anchor: `start`, `middle`, `end`. |
| `color`      | string              | theme   | Text fill color. |
| `animation`  | object              | —       | Use non path‑only presets, e.g., `pulse`, `glow`. |

Example:

```yaml
- type: text
  id: wc_label
  position: [12%, 14%]
  value: "WARP CORE"
  font_size: 56
  color: var(--lcars-yellow)
  animation:
    type: pulse
    duration: 900
    loop: true
    alternate: true
```

— Placeholder for text overlay image —
![Text overlay placeholder](PLACEHOLDER_TEXT_IMG)

### 2) Line (right‑angle by default, multi‑segment supported)

By default, lines are automatically drawn with a right‑angle “elbow” between the start and end:
- `anchor` is the start point (anchor name or `[x,y]`)
- `attach_to` is the end point (anchor or overlay id or `[x,y]`)
- We compute the elbow and style the corner using `corner_style` and `corner_radius`

You can also override the path and create multi‑segment lines by providing either `waypoints` or `steps`.

| Key                | Type             | Default   | Description |
|--------------------|------------------|-----------|-------------|
| `id`               | string           | —         | Unique element id. |
| `type`             | string           | `line`    | Overlay type. |
| `anchor`           | [x,y] or string  | —         | Start point: coordinates or anchor id. |
| `attach_to`        | [x,y] or string  | —         | End point: coordinates or anchor/overlay id. |
| `width`            | number           | `2`       | Stroke width. |
| `color`            | string           | theme     | Stroke color. |
| `stroke_dasharray` | [number, number] | —         | Dash pattern `[dash, gap]`. |
| `corner_style`     | string           | `round`   | One of `round`, `bevel`, `miter`, `sharp`, `square`. |
| `corner_radius`    | number           | `12`      | Corner radius (for round/bevel/miter). |
| `waypoints`        | array            | —         | Optional explicit path points. Accepts anchors and/or `[x,y]` pairs. |
| `steps`            | array            | —         | Optional directional steps (see below) to build elbows from `anchor`. |
| `animation`        | object           | —         | Path presets allowed: `draw`, `march`, `motionpath` (with tracer). |

steps (for multi‑segment routes using right‑angle moves):
| Step key    | Type    | Description |
|-------------|---------|-------------|
| `direction` | string  | `horizontal` or `vertical`. |
| `to_x`      | number  | X coordinate to move to (when `direction: horizontal`). |
| `to_y`      | number  | Y coordinate to move to (when `direction: vertical`). |

Examples

Default right‑angle line:

```yaml
- type: line
  id: wc_connector
  anchor: wc
  attach_to: wc_label
  width: 6
  color: var(--lcars-orange)
  corner_style: round
  corner_radius: 24
  animation:
    type: march
    stroke_dasharray:
      - 25
      - 25
    duration: 1800
    loop: true
```

Multi‑segment using waypoints (mix anchors and coordinates):

```yaml
- type: line
  id: wc_bus
  anchor: wc
  waypoints:
    - scr_ne
    - [600, 120]
    - [600, 220]
    - br
  width: 6
  color: var(--lcars-yellow)
  corner_style: bevel
  corner_radius: 16
```

Multi‑segment using steps from the start anchor:

```yaml
- type: line
  id: wc_steps
  anchor: wc
  steps:
    - direction: horizontal
      to_x: 600
    - direction: vertical
      to_y: 220
    - direction: horizontal
      to_x: 800
  width: 6
  color: var(--lcars-yellow)
  corner_style: round
  corner_radius: 20
```

— Placeholder for line overlay image —
![Line overlay placeholder](PLACEHOLDER_LINE_IMG)

### 3) Sparkline (data‑driven mini chart)

| Key                      | Type               | Default                 | Description |
|--------------------------|--------------------|-------------------------|-------------|
| `id`                     | string             | —                       | Unique element id. |
| `type`                   | string             | `sparkline`             | Overlay type. |
| `position`               | [x,y] or string    | —                       | Top‑left of chart. `%` allowed. |
| `size`                   | [w,h]              | —                       | Chart width/height. `%` allowed. |
| `source`                 | string             | —                       | Key from `msd.data_sources`. |
| `windowSeconds`          | number or string   | `3600` (s)              | Window width (supports `ms`,`s`,`m`,`h`,`d`). |
| `color`                  | string             | var(--lcars-yellow)     | Line color. |
| `width`                  | number             | `2`                     | Line stroke width. |
| `area_fill`              | string or null     | `null`                  | Optional fill under curve. |
| `x_mode`                 | string             | `time`                  | `time` (by timestamp) or `index` (even spacing). |
| `extend_to_edges`        | bool or string     | `false`                 | Extend Y to left/right edges: `true`/`both`/`left`/`right`. |
| `ignore_zero_for_scale`  | boolean            | `false`                 | Exclude zeros for auto‑scale. |
| `stair_step`             | boolean            | `false`                 | Step chart for discrete values. |
| `smooth`                 | boolean            | `false`                 | Smooth line. |
| `smooth_method`          | string             | `catmull`               | `catmull` or `monotone` (no overshoot). |
| `smooth_tension`         | number (0–1)       | `0.5`                   | Curviness (Catmull–Rom). |
| `y_range`                | [min,max]          | auto                    | Fixed Y bounds if set. |
| `grid`                   | object             | `null`                  | Grid lines (see grid.* below). |
| `markers`                | object             | `null`                  | Circles on last N points (see markers.*). |
| `label_last`             | object             | `null`                  | Last‑value label (see label_last.*). |
| `fade_tail`              | object             | `null`                  | Left→right stroke gradient (see fade_tail.*). |
| `tracer`                 | object             | `null`                  | Static last‑point circle (see tracer.*). |
| `animation`              | object             | `null`                  | Path animations (e.g., `march`) or `motionpath` (requires tracer under animation). |

grid:
| Key       | Type   | Default | Description |
|-----------|--------|---------|-------------|
| `x`       | number | `0`     | Number of vertical divisions (lines = x−1). |
| `y`       | number | `0`     | Number of horizontal divisions (lines = y−1). |
| `color`   | string | rgba(255,255,255,0.12) | Grid line color. |
| `opacity` | number | `0.5`   | Grid group opacity. |
| `width`   | number | `1`     | Grid line stroke width. |

markers:
| Key    | Type   | Default       | Description |
|--------|--------|---------------|-------------|
| `r`    | number | —             | Marker circle radius. |
| `fill` | string | line color    | Marker fill color. |
| `max`  | number | `200`         | Draw markers on last N points, up to max. |

label_last:
| Key         | Type    | Default               | Description |
|-------------|---------|-----------------------|-------------|
| `decimals`  | number  | `1`                   | Decimal places for value. |
| `fill`      | string  | line color            | Text color. |
| `font_size` | number  | `14`                  | Font size. |
| `offset`    | [dx,dy] | `[8, -8]`             | Pixel shift from last point. |
| `format`    | string  | none                  | Template like `"{v}°"`; `{v}` is replaced. |

fade_tail:
| Key             | Type   | Default | Description |
|-----------------|--------|---------|-------------|
| `start_opacity` | number | `0.15`  | Stroke opacity at left side. |
| `end_opacity`   | number | `1`     | Stroke opacity at right side. |

tracer (static last point):
| Key   | Type   | Default        | Description |
|-------|--------|----------------|-------------|
| `r`   | number | —              | Radius. |
| `fill`| string | line color     | Fill color. |
| `animation` | object | —        | Optional, e.g., `pulse` on the circle itself. |

Example (march path + label + grid, fully expanded):

```yaml
- type: sparkline
  id: tor_temp_trend
  position: [10%, 10%]
  size: [80%, 24%]
  source: toronto_temp
  windowSeconds: 48h
  color: var(--lcars-yellow)
  width: 6
  area_fill: rgba(255,255,0,0.2)
  x_mode: index
  extend_to_edges: true
  smooth: true
  smooth_method: monotone
  smooth_tension: 0.7
  grid:
    x: 8
    y: 4
    color: rgba(255,255,255,0.18)
    opacity: 0.6
    width: 1
  markers:
    r: 4
    fill: var(--lcars-blue)
    max: 200
  label_last:
    decimals: 1
    fill: var(--lcars-yellow)
    font_size: 56
    offset:
      - 8
      - -8
    format: "{v}°"
  animation:
    type: march
    stroke_dasharray:
      - 18
      - 14
    duration: 1800
    loop: true
```

Motionpath tracer that follows the sparkline path (requires tracer inside animation):

```yaml
- type: sparkline
  id: tor_temp_trend
  position: [10%, 10%]
  size: [80%, 24%]
  source: toronto_temp
  windowSeconds: 48h
  color: var(--lcars-yellow)
  width: 6
  x_mode: index
  smooth: true
  animation:
    type: motionpath
    duration: 4000
    easing: easeInOutSine
    loop: true
    tracer:
      r: 6
      fill: var(--lcars-orange)
    trail:
      stroke: var(--lcars-yellow)
      stroke-width: 6
      duration: 1200
      easing: linear
      loop: true
```

Notes:
- We preload history (if configured) and mark the sparkline path as “pending” until real data paints; motionpath hides its trail during pending and rebinds as the path updates.

— Placeholder for sparkline images —
![Sparkline trend placeholder](PLACEHOLDER_SPARKLINE_TREND_IMG)
![Sparkline motionpath placeholder](PLACEHOLDER_SPARKLINE_MOTIONPATH_GIF)

### 4) Ribbon (binary on/off lanes)

| Key             | Type            | Default                 | Description |
|-----------------|-----------------|-------------------------|-------------|
| `id`            | string          | —                       | Unique element id. |
| `type`          | string          | `ribbon`                | Overlay type. |
| `position`      | [x,y] or string | —                       | Top‑left of ribbon group. |
| `size`          | [w,h]           | —                       | Group width/height. |
| `source`        | string          | —                       | Single data source key. |
| `sources`       | string[]        | —                       | Multiple sources → stacked lanes. |
| `windowSeconds` | number|string   | `3600` (s)              | Window width. |
| `threshold`     | number          | `1`                     | >= threshold considered ON. |
| `on_color`      | string          | var(--lcars-yellow)     | Fill for ON segments. |
| `off_color`     | string or null  | `null`                  | Optional full‑width backdrop for OFF. |
| `opacity`       | number          | `1`                     | Group opacity. |
| `rx`            | number          | `0`                     | Corner radius x. |
| `ry`            | number          | `rx`                    | Corner radius y. |
| `lane_gap`      | number          | `2`                     | Gap between stacked lanes. |

Examples:

```yaml
- type: ribbon
  id: door_state_ribbon
  position: [10%, 70%]
  size: [80%, 6%]
  source: binary_sensor.front_door
  windowSeconds: 24h
  threshold: 0.5
  on_color: var(--lcars-yellow)
  off_color: rgba(255,255,255,0.08)
  rx: 6
```

```yaml
- type: ribbon
  id: env_ribbons
  position: [10%, 78%]
  size: [80%, 12%]
  sources:
    - binary_sensor.garage_open
    - binary_sensor.front_door
    - binary_sensor.kitchen_motion
  windowSeconds: 12h
  threshold: 0.5
  on_color: var(--lcars-yellow)
  off_color: rgba(255,255,255,0.06)
  lane_gap: 3
  rx: 4
```

— Placeholder for ribbon image —
![Ribbon overlay placeholder](PLACEHOLDER_RIBBON_IMG)

### 5) Free

Mutate existing SVG nodes by selector; no new SVG is stamped.

| Key         | Type                   | Default | Description |
|-------------|------------------------|---------|-------------|
| `id`        | string                 | —       | Logical id for reference. |
| `type`      | string                 | `free`  | Overlay type. |
| `targets`   | string or Element      | —       | CSS selector(s) or element(s) inside the SVG. |
| `animation` | object                 | —       | Use `set` or other compatible presets. |

Example:

```yaml
- type: free
  id: wc_core_fill
  targets: '#wc_core'
  animation:
    type: set
    fill: var(--lcars-yellow)
```

---------------------------------------------------------------------

## Where Can I Put Animations?

- On an overlay: add `animation` under that overlay. For a sparkline, this targets the line path.
- In a timeline: orchestrate multiple elements and steps. See msd-timelines.md.
- Standalone: under `msd.animations` (uncommon).

Rule of thumb:
- Path‑based effects (`draw`, `march`, `motionpath`) require an SVG `<path>`.
- Text and ribbons are not paths → use `pulse`, `blink`, `fade`, `glow`, `shimmer`, `strobe`, `ripple`, or `set`.

See the compatibility grid in msd-animation-presets.md.

---------------------------------------------------------------------

## Style Merging (Who wins if keys conflict?)

We merge in this order (later wins):
1) `presets.default` (your global defaults per overlay type)
2) named preset via `overlay.preset` (a preset key you created under `msd.presets`)
3) the overlay’s own keys (inline on the overlay)
4) `state_resolver` overrides (first match wins)

Notes:
- To “customize an existing preset”, create another named preset under `msd.presets` that overrides only the keys you care about, then reference that via `overlay.preset`. The merge is deep (nested keys are merged).
- There is no separate `custom_presets` section; everything lives under `msd.presets` for simplicity.

— Placeholder for merging diagram —
![Merging flow placeholder](PLACEHOLDER_MERGING_FLOW_IMG)

Example (fully expanded):

```yaml
presets:
  default:
    line:
      width: 4
      color: var(--lcars-orange)

  my_bold_line:
    line:
      width: 8                   # override only width
      color: var(--lcars-yellow) # and color

overlays:
  - type: line
    id: sb_connector
    anchor: sb
    attach_to: sb_label
    preset: my_bold_line         # 1) defaults + 2) named preset
    color: var(--lcars-blue)     # 3) overlay overrides
    state_resolver:              # 4) last layer (see dedicated page)
      entity: light.tv
      attribute: brightness
      states:
        - from: 0
          to: 29
          settings:
            line:
              color: var(--lcars-blue)
        - from: 30
          to: 79
          settings:
            line:
              color: var(--lcars-yellow)
        - from: 80
          to: 100
          settings:
            line:
              color: red
```

For full details on `state_resolver` (operators, `map_range`, examples), see msd-state-resolver.md.

---------------------------------------------------------------------

## Troubleshooting (Common Early Bumps)

| Symptom | Likely Cause | Fix |
|--------|---------------|-----|
| Overlay not where I expect | No anchor or wrong coordinates | Use percentages first to sanity‑check; verify your anchor id and x/y or cx/cy exist in the SVG. |
| Sparkline is flat at first | No history preload | Set `history.preload: true` in the data source. |
| Motionpath shows an extra flat line | Trail cloned before data | We hide the trail while the sparkline is pending and re‑sync on update (built in). |
| Markers/labels not visible | Wrong keys | Use `markers` and `label_last` exactly. |
| March doesn’t animate | Non‑path target | Only use `march` on a `<path>` (lines and sparkline path). |

---------------------------------------------------------------------

## What’s Next?

- Animation presets (full options tables + compatibility grid): see msd-animation-presets.md
- Timelines (sequence/overlap animations): see msd-timelines.md
- State resolver (operators, mapping, advanced use): see msd-state-resolver.md

— End of MSD Main Guide —