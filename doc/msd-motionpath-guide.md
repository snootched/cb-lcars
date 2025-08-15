# Motionpath Deep Dive (Robust Sparkline Integration)

This guide explains the internal lifecycle of the hardened `motionpath` preset and how it interacts with sparklines.

## 1. Lifecycle Overview

1. Sparkline stamped → baseline path inserted:
   - `d="M x0,yBase L x1,yBase"`
   - `data-cblcars-pending="true"`, path (and related label/markers) hidden via inline `visibility:hidden`.
2. Motionpath preset initializes immediately:
   - Sees valid `d`, builds (optional) trail + tracer.
   - Trail hidden if pending (`visibility:hidden`).
   - Anime instance stored: `tracerNode.__cblcars_motion`.
3. Data arrives:
   - Sparkline refresh sets new smooth or polyline `d`.
   - Removes pending attribute → unhides path + area + markers + label + trail.
   - Motionpath MutationObserver sees `d` change → rebinds transforms.
4. Re-render / path replacement:
   - Poller detects a new `<path id="...">` instance.
   - Cleans artifacts; repeats init.

## 2. Artifact Ownership

Each created element is tagged:
```
data-cblcars-owned="motionpath"
```
This allows safe cleanup (preventing accidental removal of user-stamped or static tracers).

## 3. ID Collision Handling

Default motionpath tracer id: `<pathId>_tracer`.

Collision scenario:
- Static tracer with id `tor_temp_trend_tracer` exists (owned by `sparkline`).
- Motionpath attempts same id → detects foreign owner → renames to `tor_temp_trend_tracer_mptrc`.

Explicit override:
```yaml
animation:
  type: motionpath
  tracer:
    id: tor_temp_trend_pathtracer
    r: 8
    fill: var(--lcars-orange)
```

## 4. Dual Tracers (Static + Moving)

Supported by:
- Relaxing guard OR adding `force: true` to static tracer config.
- Distinct ids recommended for clarity.

Example:
```yaml
tracer:
  r: 30
  fill: var(--lcars-blue)
  force: true
animation:
  type: motionpath
  tracer:
    id: tor_temp_trend_pathtracer
    r: 10
    fill: var(--lcars-orange)
```

## 5. Pending State Logic

| State | Path d | visibility | Trail | Tracer |
|-------|--------|------------|-------|--------|
| Baseline (pending) | `M..L..` baseline | hidden | hidden | visible (moving baseline) |
| Live data | smoothed or poly path | visible | visible | visible, bound to curve |

Why hide baseline trail? Prevents a “draw” effect over a meaningless flat line.

## 6. Rebinding Triggers

- Attribute `d` mutation
- Attribute `data-cblcars-pending` mutation
- Path element replacement (detected via 2s poll)
All cause `rebindAll('reason')`.

## 7. Performance Notes

- Baseline stamping eliminates wasted wait frames.
- Motionpath transformation functions (`createMotionPath`) are re-run only on rebind; inexpensive vs. full DOM diffing.
- Poll interval (2000 ms) is intentionally coarse to minimize overhead while catching re-renders.

## 8. Cleanup Hook

Call manually if you need to destroy artifacts without a full card teardown:
```js
const path = root.querySelector('#tor_temp_trend');
path?.__cblcars_motionpath_cleanup?.();
```

## 9. Troubleshooting Matrix

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Timeout warning still appears | Baseline block missing or JS error before baseline sets | Verify renderer patch; check console earlier errors |
| Tracer present but not moving | Path `d` never updates beyond baseline | Verify data source registered; inspect `window.cblcars.data.getSource('key')` |
| Two tracers with same color | Guard removed + no explicit id | Add id to motionpath tracer OR keep guard |
| Trail never appears | Path stuck pending | Ensure pending flag removed when data arrives (refresh logic) |

## 10. Extending Behavior

You can safely:
- Add easing variants (e.g., map entity state -> duration).
- Chain additional non-path presets on the tracer via timelines (e.g., tracer glow).
- Swap trail mode `"single"` to hide base stroke visually.

```yaml
animation:
  type: motionpath
  duration: 5000
  loop: true
  tracer:
    r: 7
    fill: var(--lcars-orange)
  trail:
    mode: single
    stroke: var(--lcars-yellow)
    stroke-width: 8
    duration: 1400
    easing: linear
    loop: true
```

## 11. API Surface (Internal)

| Hook / Prop | Purpose |
|-------------|---------|
| `tracerNode.__cblcars_motion` | Anime.js animation instance |
| `element.__cblcars_motionpath_cleanup()` | Manual teardown |
| `data-cblcars-owned="motionpath"` | Ownership tag |
| `_mptrc` suffix | Collision-avoidance id variant |

---

Use this deep dive to extend behavior confidently or debug advanced cases. Contributions welcome—keep logic tracer/overlay-agnostic where possible.