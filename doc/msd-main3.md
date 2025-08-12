# LCARS MSD Overlay System – User Guide (Beginner Friendly)
(Updated: Added Controls layer, Smart connector attachment to controls/overlays, trunk+tail routing pattern)

This guide explains, step by step, how to build animated, data‑driven LCARS‑style overlays (MSD) for Home Assistant dashboards using CB‑LCARS. It covers how the MSD is structured, how the base SVG and anchors work, each overlay type (now including control), data sources, animations, smart line connectors, and merging rules.

— Placeholder for hero image —
![MSD overview placeholder](PLACEHOLDER_MSD_OVERVIEW_IMG)

---------------------------------------------------------------------

## What’s New (Recent Additions)

- Control overlays: Place real Lovelace cards (e.g., button, slider) in a top “controls” layer aligned 1:1 with the SVG viewBox.
- Smart line attachment: `line` overlays can now attach to the bounding box of another overlay (including a `control`) using `attach_side`, `attach_align`, and `attach_gap`.
- CTM‑based coordinate mapping: Control overlay positions and smart connectors use the SVG’s current transformation matrix for pixel‑perfect alignment (even with letterboxing / aspect ratios).
- Gap units: `attach_gap` accepts either a number (viewBox units) or a string with px (`"12px"`). Pixel gaps are automatically converted to viewBox units through the CTM so visual spacing stays consistent at all sizes.
- Trunk + tail pattern: Recommended way to combine custom multi‑segment path routing with a dynamic final “smart” attachment to a moving target (e.g., a control card).
- Multi‑segment routing tips: Documented strategies for stable elbows and adaptive final segments.

---------------------------------------------------------------------

## How MSD Works (ELI5)

- Think of MSD as a sandwich:
  - Bottom slice: base SVG drawing (ship layout), aspect locked via its viewBox.
  - Middle filling: transparent SVG overlay layer where we stamp text, lines, charts, ribbons, etc.
  - Top slice: controls layer (optional) with HTML/Lovelace cards (buttons, sliders) placed using the SAME coordinate system.
  - Animations: run across any stamped SVG elements (and some controls indirectly, if you animate their overlay connectors).

- All coordinates share the SVG viewBox space (e.g. 0..1920 x 0..1200). Points, sizes, and percentages map consistently across layers.

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

      - type: control              # NEW
        id: br_button
        position: [72%, 10%]
        size: [18%, 12%]
        card:
          type: button
          entity: light.tv
          name: Bridge
          tap_action:
            action: toggle

      - type: line
        id: br_conn
        anchor: br
        attach_to: br_button      # smart attach to control box (auto side)
        width: 6
        color: var(--lcars-yellow)
        attach_gap: 10
        animation:
          type: march
          stroke_dasharray: [18, 14]
          duration: 1400
          loop: true
```

— Placeholder for quick-start gif —
![Quick start placeholder](PLACEHOLDER_QUICK_START_GIF)

---------------------------------------------------------------------

## The Full MSD Structure (Pseudo‑Config)

(unchanged except for new `control` type and connector options)

```yaml
variables:
  msd:
    base_svg: builtin:ncc-1701-a-blue

    anchors:
      # anchor_name: [x, y]

    data_sources:
      toronto_temp:
        entity: sensor.toronto_temperature
        windowSeconds: 48h
        sampleMs: 150
        history:
          hours: 48
          preload: true

    presets:
      default:
        text:
          font_size: 56
          font_family: Antonio
          color: var(--lcars-yellow)
        line:
          width: 4
          color: var(--lcars-orange)

    overlays:
      # TEXT
      - type: text
        id: wc_label
        position: [12%, 14%]
        value: "WARP CORE"

      # CONTROL (NEW)
      - type: control
        id: wc_button
        position: [70%, 10%]
        size: [18%, 12%]
        card:
          type: button
          entity: light.tv
          name: Warp Core

      # SMART CONNECTOR LINE (anchor → control)
      - type: line
        id: wc_line
        anchor: wc
        attach_to: wc_button
        width: 6
        color: var(--lcars-yellow)
        attach_side: auto
        attach_gap: 12

      # SPARKLINE
      - type: sparkline
        id: temp_trend
        position: [10%, 10%]
        size: [80%, 24%]
        source: toronto_temp
        windowSeconds: 48h
        color: var(--lcars-yellow)

    timelines:
      # ...

    animations:
      # ...
```

---------------------------------------------------------------------

## Base SVG and Anchors (What, Why, How)

(Section unchanged; anchors still work identically.)

Addendum (Controls Impact):
- Because controls are rendered in an absolutely positioned host sized via the base SVG’s CTM, anchor coordinates and percentages align with both SVG and HTML layers.
- No extra scaling math is required in user config.

---------------------------------------------------------------------

## CONTROL Overlay Type (NEW)

Purpose: Render an actual Lovelace card (e.g., button, slider, gauge) in the coordinated MSD space so lines and other overlays can reference it.

| Key       | Type                | Required | Description |
|-----------|---------------------|----------|-------------|
| `id`      | string              | Yes      | Unique overlay id. |
| `type`    | string              | Yes      | Must be `control`. |
| `position`| [x,y] / % / anchor  | Yes      | Top-left of control container in viewBox units. |
| `size`    | [w,h] / %           | Yes      | Width & height in viewBox units. |
| `card`    | object              | Yes      | Standard Lovelace card config (e.g., `type: button`). |
| `z_index` | number              | No       | Optional stacking override (defaults above overlays). |

Example:

```yaml
- type: control
  id: reactor_toggle
  position: [75%, 8%]
  size: [18%, 12%]
  card:
    type: button
    entity: switch.reactor
    name: Reactor
    tap_action:
      action: toggle
```

Notes:
- The control’s container id (here `reactor_toggle`) is what lines attach to using `attach_to`.
- The inner card may have its own padding; the connector attaches to the container box, not the internal icon/text.

---------------------------------------------------------------------

## Smart Line Connectors (Expanded)

### Standard (existing)
Lines previously connected `anchor` → `attach_to`, where both sides were coordinates or anchors; we auto-built a single right-angle elbow.

### New Attachment Targets
`attach_to` can now be:
1. An anchor name.
2. A coordinate `[x,y]` (numbers or percentages).
3. Another overlay’s id (text, line, sparkline path, etc.) – we use its SVG bounding box.
4. A `control` overlay id – we convert its pixel bounds to viewBox units via the SVG’s CTM.

### Additional Keys (when `attach_to` is an overlay/control id)

| Key            | Type                 | Default | Description |
|----------------|----------------------|---------|-------------|
| `attach_side`  | auto \| left \| right \| top \| bottom | auto | Side of the target box to land on. Auto chooses the dominant axis from anchor → target center. |
| `attach_align` | center (future: more) | center | Alignment along the chosen side (currently only center). |
| `attach_gap`   | number or "Npx"      | 12      | Space (offset) from the target edge. Number = viewBox units; `"12px"` converts using CTM scale (consistent visual spacing). |
| `corner_style` | round \| bevel \| miter \| sharp \| square | round | Corner style for elbow between legs. |
| `corner_radius`| number               | 12      | Radius (if style supports rounding). |

### How It Works Internally

1. During initial SVG stamp we emit a placeholder path with data attributes (no final `d` yet) if `attach_to` is an element id.
2. After controls (and all overlays) are laid out, a `layoutPendingConnectors` routine:
   - Finds each placeholder path.
   - Locates the target overlay/control element.
   - Computes its true box in viewBox units using the SVG’s inverse screen CTM (pixel-perfect, letterbox safe).
   - Picks the side (if auto), applies the gap and alignment, builds a right-angle path with a corner.
   - Updates the path’s `d`. Animations (e.g., `march`) automatically adapt.

### Example: Smart Attach to Control (Left Side, 16px Gap)

```yaml
- type: line
  id: reactor_line
  anchor: reactor_core
  attach_to: reactor_toggle
  width: 8
  color: var(--lcars-orange)
  attach_side: left
  attach_gap: "16px"       # pixel gap -> scaled to viewBox units
  corner_style: round
  corner_radius: 24
  animation:
    type: march
    stroke_dasharray: [20, 16]
    duration: 1600
    loop: true
```

### Troubleshooting Smart Connectors

| Symptom | Cause | Fix |
|---------|-------|-----|
| Line ends short of control | Non-CTM gap conversion or gap larger than expected | Set `attach_gap: 0` to test, then increase gradually. |
| Wrong side chosen | Auto heuristic picks other axis | Set explicit `attach_side`. |
| Line not updating on resize | Layout not re-triggered | Ensure you’re on updated MSD version; the controls resize observer calls connector layout. |
| Gap looks huge/small at different sizes | Using viewBox gap when you wanted pixel fidelity | Use `"12px"` form for resolution-independent spacing. |

---------------------------------------------------------------------

## Multi‑Segment Lines (Manual vs Smart Hybrid)

### Manual (Waypoints / Steps)
You can define a path with multiple elbows manually using:
- `points` (array of anchors and/or `[x,y]` pairs), OR
- `steps` (relative directional moves: horizontal / vertical).

Example (two elbows, pure manual):

```yaml
- type: line
  id: reactor_bus
  points:
    - reactor_core
    - [1400, 620]
    - [1400, 360]
    - [1500, 360]
  width: 8
  color: var(--lcars-blue)
  corner_style: round
  corner_radius: 24
```

### Trunk + Tail Pattern (Recommended)

When the target (e.g., a control card) might move or resize, keep a flexible final segment:

1. Trunk: manually routed multi‑segment path ending at a “staging point”.
2. Tail: smart connector from that staging point to the dynamic target.

```yaml
# Trunk – stable manual routing
- type: line
  id: reactor_trunk
  points:
    - reactor_core
    - [1400, 620]
    - [1400, 360]
    - [1470, 360]     # staging point before control
  width: 8
  color: var(--lcars-orange)
  corner_style: round
  corner_radius: 24

# Tail – dynamic smart attachment
- type: line
  id: reactor_tail
  anchor: [1470, 360]     # staging point
  attach_to: reactor_toggle
  attach_side: left
  attach_gap: 12
  width: 8
  color: var(--lcars-orange)
  corner_style: round
  corner_radius: 16
```

Advantages:
- You control global routing shape.
- Final leg auto-adjusts if the control moves.

---------------------------------------------------------------------

## Overlay Types and Options (Updated List)

1. Text
2. Line
3. Sparkline
4. Ribbon
5. Free
6. Control (NEW)

Sections below recap each (only new/differing details shown for modified types).

### 1) Text
(unchanged; see original table)

### 2) Line (Updated)

Additional keys (smart attachment):
- `attach_side`, `attach_align`, `attach_gap` (see Smart Line Connectors section)

If both `points` and `anchor`/`attach_to` are present:
- `points` takes precedence (fully manual path).
- Use either manual OR smart mode for clarity.

### 3) Sparkline
(unchanged)

### 4) Ribbon
(unchanged)

### 5) Free
(unchanged)

### 6) Control (NEW)
(see Control Overlay Type section above)

---------------------------------------------------------------------

## Data Sources
(unchanged)

---------------------------------------------------------------------

## Animations
(unchanged core; smart connectors are still standard `<path>` elements, so any path presets (`march`, `draw`, `motionpath` with tracer) can apply.)

Note:
- For smart connectors, animations apply after `d` is set. The system updates `d` live; ongoing CSS/JS path animations continue seamlessly (e.g., `march`).

---------------------------------------------------------------------

## Style Merging
(unchanged)

---------------------------------------------------------------------

## Tips (Expanded)

| Tip | Why |
|-----|-----|
| Prefer trunk+tail for dynamic targets | Maintains stable routing while allowing responsive endpoint. |
| Use `"12px"` gaps for visual consistency | Pixel gap scaling matches different device sizes better than raw viewBox units. |
| Force side with `attach_side` when auto picks undesired | Auto chooses axis dominance; manual override gives predictable layout. |
| Keep control ids simple (`br_button`) | Cleaner references in connectors and timelines. |
| Test with `attach_gap: 0` first | Ensures connection point is correct before introducing spacing. |
| Use percentages for initial control sizing | Rapid iteration; switch to exact numbers after finalizing layout. |

---------------------------------------------------------------------

## Troubleshooting (Updated)

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Control not aligned with SVG coordinates | Older code / missing CTM mapping | Update to latest controls helper (CTM‑based). |
| Smart line stops short | Gap > 0 (expected) or mixed gap units | Set `attach_gap: 0` to verify baseline, then restore desired spacing. |
| Line attaches to unexpected side | Auto side heuristic | Explicitly set `attach_side`. |
| No path drawn when using `attach_to` id | Layout pass not executed yet | Wait a frame; ensure `layoutPendingConnectors` is included (latest version). |
| Path flickers on resize | Frequent re-layout + animation restart | Usually harmless; reduce resize activity or disable complex animation during layout debug. |

---------------------------------------------------------------------

## What’s Next?

- Extended alignment options for `attach_align` (e.g., proportional offsets, “toward-anchor”).
- Auto multi‑elbow router (H-first / V-first / Manhattan with obstacle avoidance).
- Additional control overlay utilities (hover tooltips, focus halos, etc.).

— End of MSD Main Guide —