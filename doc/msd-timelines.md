# LCARS MSD Timelines – Orchestrating Animations

Timelines let you sequence, overlap, and coordinate multiple animations across elements, using anime.js v4 timelines behind the scenes.

— Placeholder for timelines overview image —
![Timelines overview placeholder](PLACEHOLDER_TIMELINES_OVERVIEW_IMG)

---------------------------------------------------------------------

## Timeline Schema

Top‑level under `variables.msd.timelines`:

```yaml
msd:
  timelines:
    my_sequence:
      loop: true
      easing: easeOutQuad
      autoplay: true
      steps:
        - targets: "#warp_line"
          type: draw
          duration: 900
        - targets: "#warp_label"
          type: pulse
          duration: 1200
          offset: "-=400"
```

### Timeline Globals

| Key         | Type    | Default | Description |
|-------------|---------|---------|-------------|
| `loop`      | boolean | —       | Loop the whole timeline. |
| `easing`    | string  | —       | Global easing for steps (can be overridden). |
| `autoplay`  | boolean | `true`  | Start immediately. |
| `delay`     | number  | —       | Global delay in ms. |
| `offset`    | number or string | — | Base offset for the first step (rare). |

### Step Options

| Key         | Type                       | Default | Description |
|-------------|----------------------------|---------|-------------|
| `targets`   | string/Element/string[]    | —       | Selector(s) resolved inside the card’s shadowRoot. |
| `type`      | string                     | —       | Preset name (`draw`, `march`, `pulse`, `motionpath`, `set`, …). |
| `duration`  | number                     | preset  | Step duration in ms. |
| `offset`    | number or string           | auto    | When to start relative to previous step; `"-=400"` starts 400ms earlier. |
| `easing`    | string                     | preset  | Step easing. |
| `loop`      | boolean                    | preset  | Step loop. |
| `alternate` | boolean                    | preset  | Alternate direction each loop (if supported). |
| `state_resolver` | object                | —       | Optional resolver to override or select presets per step. |
| `entity`    | string                     | —       | Entity for `state_resolver` within this step. |
| `attribute` | string                     | —       | Attribute for `state_resolver` within this step. |
| `…preset keys…` | varies                 | —       | Any preset’s own keys (see presets ref). |

Merging for a step (later wins):
1) element’s overlay‑level `animation`
2) timeline globals
3) step options

---------------------------------------------------------------------

## Examples

Sequence incompatible path effects (draw → motionpath):

```yaml
msd:
  overlays:
    - type: line
      id: warp_line
      anchor: [100, 100]
      attach_to: [300, 100]
      width: 6
      color: var(--lcars-yellow)

  timelines:
    warp_line_seq:
      steps:
        - targets: "#warp_line"
          type: draw
          duration: 900
        - targets: "#warp_line"
          type: motionpath
          duration: 2000
          loop: true
          tracer:
            r: 8
            fill: var(--lcars-orange)
          trail:
            stroke: var(--lcars-yellow)
            stroke-width: 6
            duration: 1200
            easing: linear
            loop: true
```

— Placeholder —
![draw then motionpath placeholder](PLACEHOLDER_LINE_SEQ_GIF)

Coordinate sparkline path and its label:

```yaml
msd:
  overlays:
    - type: sparkline
      id: temp_trend
      position: [10%, 10%]
      size: [80%, 24%]
      source: toronto_temp
      windowSeconds: 48h
      color: var(--lcars-yellow)
      width: 6
      label_last:
        decimals: 1
        fill: var(--lcars-yellow)
        font_size: 56
        offset:
          - 8
          - -8
        format: "{v}°"

  timelines:
    trend_live:
      steps:
        - targets: "#temp_trend"
          type: glow
          duration: 900
          glow:
            color: var(--lcars-blue)
            intensity: 0.6
          loop: true
          alternate: true
        - targets: "#temp_trend_label"
          type: pulse
          duration: 1200
          offset: "-=450"
```

Stagger a group (cascade):

```yaml
msd:
  timelines:
    bridge_indicators:
      steps:
        - targets: "#br_label, #br_conn, #wc_label"
          type: cascade
          stagger: 120
          duration: 800
```

Tips:
- `targets` supports comma‑separated selectors.
- We resolve all selectors inside the card’s Shadow DOM automatically.
- Steps can include their own `state_resolver` to vary animation based on live state (see msd-state-resolver.md).

---------------------------------------------------------------------

## Best Practices

- Overlay‑level `animation` for simple single‑element effects.
- Timelines for:
  - Chaining conflicting effects (`draw` → `motionpath`)
  - Aligning multiple overlays
  - Staggering groups
- Keep ids stable; timelines and resolvers reference `#id`.
- For sparkline `motionpath`, put the tracer under the animation block for that overlay or timeline step (no need for a separate static tracer unless you want both).

---------------------------------------------------------------------

## Troubleshooting

| Issue | Cause | Resolution |
|------|-------|------------|
| “Target not found” | DOM not ready or wrong selector | The card delays timeline creation until after SVG stamp; verify `#id`. |
| “motionpath tracer is required” | Missing tracer in step | Add a `tracer` block to the step’s options. |
| Sparkline tracer/trail short or duplicate | Initialized before data | Current preset waits for valid path, hides trail while pending, and rebinds on update. |

— Placeholder for troubleshooting image —
![timeline troubleshooting placeholder](PLACEHOLDER_TIMELINE_TROUBLE_IMG)

— End of Timelines —