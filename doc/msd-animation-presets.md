# LCARS MSD Animation Presets

Animation presets are reusable effects for MSD overlays. Apply them directly to overlays or via timelines. All animations use anime.js v4 through the CB‑LCARS helpers.

— Placeholder for presets overview image —
![Presets overview placeholder](PLACEHOLDER_PRESETS_OVERVIEW_IMG)

Notes:
- Path‑based presets (`draw`, `march`, `motionpath`) require an SVG `<path>`.
- `motionpath` requires a `tracer` (defined inside its animation block).
- For sparkline paths, `motionpath` waits for real data, hides its trail while pending, and rebinds when the path updates.

---------------------------------------------------------------------

## Using Presets (Overlay‑level)

```yaml
- type: line
  id: br_conn
  animation:
    type: march
    stroke_dasharray:
      - 18
      - 14
    duration: 1400
    loop: true
```

Via a timeline step (see msd-timelines.md):

```yaml
timelines:
  sequence:
    steps:
      - targets: "#br_conn"
        type: march
        duration: 1400
```

Stacking: you may specify `type` as an array for compatible presets (e.g., `[draw, glow]`). For incompatible pairs (e.g., `draw` + `motionpath`), use timelines to sequence them.

---------------------------------------------------------------------

## Preset Reference (Options Tables)

Each table lists option `keys` (as in YAML), type, default, and description. Examples avoid inline objects.

### draw

| Key         | Type    | Default         | Description |
|-------------|---------|-----------------|-------------|
| `duration`  | number  | `1200`          | Duration in ms. |
| `easing`    | string  | `easeInOutSine` | Easing. |
| `loop`      | boolean | `false`         | Repeat. |
| `alternate` | boolean | `false`         | Alternate each loop. |
| `draw`      | array/object | `['0 0','0 1']` | Custom draw ranges (advanced). |

Example:

```yaml
animation:
  type: draw
  duration: 900
  easing: easeInOutSine
  loop: false
  alternate: false
```

— Placeholder —
![draw preset animation](PLACEHOLDER_DRAW_GIF)

### march

| Key                | Type             | Default     | Description |
|--------------------|------------------|-------------|-------------|
| `stroke_dasharray` | [number, number] | `[25, 15]`  | Dash pattern `[dash, gap]`. |
| `duration`         | number           | `2000`      | Cycle duration in ms. |
| `loop`             | boolean or number| `true`      | `true`=infinite; number=iterations; `false`=1. |
| `reversed`         | boolean          | `false`     | Reverse marching direction. |
| `playbackRate`     | number           | `1`         | Speed multiplier. |

Example:

```yaml
animation:
  type: march
  stroke_dasharray:
    - 18
    - 14
  duration: 1800
  loop: true
```

— Placeholder —
![march preset animation](PLACEHOLDER_MARCH_GIF)

### motionpath

Move a tracer along a path (path must be an SVG `<path>`). The tracer is required.

| Key             | Type    | Default         | Description |
|-----------------|---------|-----------------|-------------|
| `duration`      | number  | `1000`          | Duration in ms. |
| `easing`        | string  | `easeInOutSine` | Easing. |
| `loop`          | boolean | `false`         | Repeat. |
| `path_selector` | string  | target element  | Optional CSS selector for the path; default is the animated element itself. |
| `tracer`        | object  | required        | See tracer.* below. |
| `trail`         | object  | —               | See trail.* below. |

tracer.*:

| Key      | Type    | Default                 | Description |
|----------|---------|-------------------------|-------------|
| `shape`  | string  | `circle`                | `circle` or `rect`. |
| `r`      | number  | `4`                     | Radius for circle. |
| `width`  | number  | `8`                     | Rect width (if shape=rect). |
| `height` | number  | `8`                     | Rect height (if shape=rect). |
| `fill`   | string  | var(--lcars-orange)     | Tracer color. |
| `style`  | object  | `{}`                    | Inline styles. |
| `id`     | string  | auto                    | Custom tracer id (optional). |

trail.*:

| Key            | Type    | Default                 | Description |
|----------------|---------|-------------------------|-------------|
| `stroke`       | string  | var(--lcars-yellow)     | Trail stroke color. |
| `stroke-width` | number  | `4`                     | Trail stroke width. |
| `opacity`      | number  | `1`                     | Trail opacity. |
| `duration`     | number  | `1000`                  | Draw duration in ms. |
| `easing`       | string  | `linear`                | Easing. |
| `loop`         | boolean | `true`                  | Repeat. |
| `mode`         | string  | `overlay`               | `overlay` or `single` (hide base line). |

Sparkline example:

```yaml
animation:
  type: motionpath
  duration: 4000
  easing: easeInOutSine
  loop: true
  tracer:
    shape: circle
    r: 6
    fill: var(--lcars-orange)
  trail:
    stroke: var(--lcars-yellow)
    stroke-width: 6
    duration: 1200
    easing: linear
    loop: true
```

— Placeholder —
![motionpath placeholder](PLACEHOLDER_MOTIONPATH_GIF)

Notes:
- For sparklines, we wait for a valid line path and rebind when it changes; the trail hides while the sparkline is in a “pending baseline” state.

### pulse

| Key                   | Type    | Default           | Description |
|-----------------------|---------|-------------------|-------------|
| `duration`            | number  | `1200`            | Duration in ms. |
| `easing`              | string  | `easeInOutSine`   | Easing. |
| `loop`                | boolean | `true`            | Repeat. |
| `alternate`           | boolean | `true`            | Alternate each loop. |
| `pulse.max_scale`     | number  | `1.1`/`1.5`       | Text: scale; Line: stroke‑width factor. |
| `pulse.min_opacity`   | number  | `0.7`             | Minimum opacity. |

Example:

```yaml
animation:
  type: pulse
  duration: 1000
  pulse:
    max_scale: 1.2
    min_opacity: 0.6
```

### glow

| Key                 | Type    | Default                   | Description |
|---------------------|---------|---------------------------|-------------|
| `glow.color`        | string  | var(--picard-light-blue)  | Glow color. |
| `glow.intensity`    | number  | `0.8`                     | Max glow opacity. |
| `glow.blur_min`     | number  | `0`                       | Min blur px. |
| `glow.blur_max`     | number  | `12`                      | Max blur px. |
| `glow.opacity_min`  | number  | `0.4`                     | Min opacity. |
| `glow.opacity_max`  | number  | `intensity`               | Max opacity. |
| `duration`          | number  | `900`                     | Duration. |
| `easing`            | string  | `easeInOutSine`           | Easing. |
| `loop`              | boolean | `true`                    | Repeat. |
| `alternate`         | boolean | `true`                    | Alternate. |

Other presets follow similar tables: `blink`, `fade`, `shimmer`, `strobe`, `cascade`, `ripple`, `flicker`, `set`.

---------------------------------------------------------------------

## Compatibility Grid

✔ = recommended, ○ = usable (limited), ✖ = not applicable

| Preset       | text | line | sparkline (path) | ribbon (rects) | free (any) |
|--------------|:----:|:----:|:----------------:|:--------------:|:----------:|
| `draw`       | ✖    | ✔    | ✔                | ✖              | ○ (path only) |
| `march`      | ✖    | ✔    | ✔                | ✖              | ○ (path only) |
| `motionpath` | ✖    | ✔    | ✔                | ✖              | ○ (path + tracer) |
| `pulse`      | ✔    | ✔    | ✔                | ✔              | ✔          |
| `blink`      | ✔    | ✔    | ✔                | ✔              | ✔          |
| `fade`       | ✔    | ✔    | ✔                | ✔              | ✔          |
| `glow`       | ✔    | ✔    | ✔                | ✔              | ✔          |
| `shimmer`    | ✔    | ○    | ○                | ✔              | ✔          |
| `strobe`     | ✔    | ✔    | ✔                | ✔              | ✔          |
| `cascade`    | ✔    | ✔    | ✔                | ✔              | ✔ (via timeline multi‑targets) |
| `ripple`     | ✔    | ✔    | ✔                | ✔              | ✔          |
| `set`        | ✔    | ✔    | ✔                | ✔              | ✔          |

— Placeholder for compatibility matrix image —
![compatibility grid placeholder](PLACEHOLDER_COMPAT_GRID_IMG)

---------------------------------------------------------------------

## Tips

- Stack compatible effects (e.g., `draw` + `glow`); sequence conflicting ones with timelines.
- For sparkline `motionpath`, define the tracer inside the animation block; no need for a static overlay tracer unless you want both.
- Use expanded YAML blocks (no inline `{ ... }`) to keep the Home Assistant editor happy.

— End of Animation Presets —


# LCARS MSD Animation Presets (Updated – Motionpath & Sparkline Enhancements)

(Only sections that changed are highlighted; unchanged preset tables retained for completeness.)

## Key Updates (Summary)

- Sparkline + motionpath is now baseline-first: a flat path is stamped immediately so motionpath never times out.
- Trail hides while the sparkline is pending (`data-cblcars-pending="true"`).
- Static sparkline tracer suppressed automatically when an `animation.tracer` exists (guard).
- Collision-safe tracer creation: if an existing non-motionpath element already uses `<pathId>_tracer`, the motionpath tracer re-ids to `<pathId>_tracer_mptrc`.
- Path replacement (re-render) automatically re-initializes tracer + trail.
- Dual tracer mode supported with small guard tweak (see Motionpath notes).

---

## Motionpath (Updated)

Move a tracer along a path (path must be an SVG `<path>`). The tracer is required.

| Key             | Type    | Default         | Description |
|-----------------|---------|-----------------|-------------|
| `duration`      | number  | `1000`          | Total time per loop. |
| `easing`        | string  | `easeInOutSine` | Easing function. |
| `loop`          | boolean | `false`         | Repeat indefinitely if `true`. |
| `path_selector` | string  | target element  | Optional alternative path selector. |
| `tracer`        | object  | required        | Circle/rect marker that moves along path. |
| `trail`         | object  | —               | Secondary path clone to animate drawing. |

Tracer options (unchanged + id collision logic):

| Key    | Type    | Default                  | Description |
|--------|---------|--------------------------|-------------|
| `id`   | string  | `<pathId>_tracer`        | Auto; may be renamed to `<id>_mptrc` if collision detected. |
| `shape`| string  | `circle`                 | `circle` or `rect`. |
| `r`    | number  | `4`                      | Circle radius. |
| `width`| number  | `8`                      | Rect width. |
| `height`| number | `8`                      | Rect height. |
| `fill` | string  | var(--lcars-orange)      | Tracer fill color. |
| `style`| object  | `{}`                     | Inline styles. |

Trail options:

| Key            | Type    | Default              | Description |
|----------------|---------|----------------------|-------------|
| `stroke`       | string  | var(--lcars-yellow)  | Trail stroke color. |
| `stroke-width` | number  | `4`                  | Trail stroke width. |
| `opacity`      | number  | `1`                  | Trail opacity. |
| `duration`     | number  | `1000`               | Draw cycle duration. |
| `easing`       | string  | `linear`             | Draw easing. |
| `loop`         | boolean | `true`               | Repeat draw animation. |
| `mode`         | string  | `overlay`            | `overlay` or `single` (hide base path stroke). |

### New Behavior Notes

1. Baseline-first sparkline: motionpath initializes immediately (no spinner / timeout).
2. Pending State: While `data-cblcars-pending="true"`, trail is `visibility:hidden`; tracer moves along baseline.
3. Rebind triggers: changes to `d`, changes to `data-cblcars-pending`, path node replacement.
4. Collision Avoidance: If a static tracer exists (id `<pathId>_tracer`), motionpath tracer becomes `<pathId>_tracer_mptrc`.
5. Cleanup: Each run removes prior motionpath-owned artifacts (trails, tracers) before creating new ones.

### Dual Tracer Strategy

Default guard prevents static + motionpath tracer duplication. To intentionally show both:
- Give motionpath tracer an explicit `id`.
- Relax or adjust guard in sparkline renderer (`!motionpathHasTracer` check) or introduce a `force: true` flag on static tracer.

### Sparkline Motionpath Example (Single Moving Tracer)

```yaml
- type: sparkline
  id: tor_temp_trend
  position: [10%, 10%]
  size: [80%, 25%]
  source: toronto_temp
  windowSeconds: 48h
  color: var(--lcars-yellow)
  width: 8
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

### Dual Tracer Example (Static + Moving)

```yaml
- type: sparkline
  id: tor_temp_trend
  position: [10%, 10%]
  size: [80%, 25%]
  source: toronto_temp
  windowSeconds: 48h
  color: var(--lcars-yellow)
  width: 8
  tracer:
    r: 40
    fill: var(--lcars-blue)
    force: true        # Requires code guard tweak to honor force
  animation:
    type: motionpath
    duration: 4000
    loop: true
    tracer:
      id: tor_temp_trend_pathtracer
      r: 10
      fill: var(--lcars-orange)
    trail:
      stroke: var(--lcars-yellow)
      stroke-width: 6
      duration: 1200
      easing: linear
      loop: true
```

### Troubleshooting (Updated)

| Issue | Cause | Solution |
|-------|-------|----------|
| Timeout warning | Baseline block missing | Ensure renderer patch applied. |
| Tracer missing | Guard suppressed static tracer but motionpath tracer failed to create | Check console for motionpath errors; ensure animation enqueued. |
| Tracer not moving | Path never advanced past baseline | Verify data source; open `window.cblcars.data.getSource('name')`. |
| Duplicate tracer | Guard disabled + no id differentiation | Provide explicit `id` or re-enable guard. |
| Trail invisible | Still pending | Confirm pending removed after first real data refresh. |

(Other preset tables—draw, march, pulse, glow, etc.—remain as previously documented.)