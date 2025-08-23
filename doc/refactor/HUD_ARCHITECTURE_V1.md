# MSD HUD Architecture (Wave 6)

Status: DRAFT (implementation skeleton committed)

## 1. Goals
Provide a lightweight, modular, read‑only diagnostic HUD for:
- Validation issues
- Packs merge summary
- Rules evaluation activity
- Routing results (recent paths)
- Performance counters

Phase scope: display only (no mutating actions).

## 2. Mount & Lifecycle
- Mounted inside existing `msd_hud_layer` custom_field.
- Root element: `#msd-hud-root`.
- HUD created once; idempotent initialization in `hudService.js`.
- Show/hide controlled by `window.__msdDebug.hud.show()` / `.hide()` / `.toggle()`.

## 3. Service API
Exposed at `window.__msdDebug.hudService` (alias `window.__msdDebug.hud`):
```
show(), hide(), toggle()
registerPanel(name, rendererFn, priority=0)
getState() -> deep copy
publishIssue(issueObj)
publishRouting(routeMeta)
publishRules(rulesList)
publishPacks(packsSummary)
publishPerf(perfSnapshot)
```

## 4. Internal State
```
state = {
  visible,
  panelsOrder,
  issues: Issue[],
  packs: { summary },
  rules: { last: RuleActivity[] },
  routing: { recent: RouteMeta[] },
  perf: { snapshot },
  config: {
    routingRecentLimit,
    perfSampleMs
  }
}
```

## 5. Panels
Registered via `registerPanel` returning HTML strings (no framework):
| Panel | Data Source | Notes |
|-------|-------------|-------|
| issues | validation aggregator | last 8 shown + overflow count |
| routing | router compute patch | flags: channel / arc / smooth |
| rules | rules engine activity hook | id, priority, lastMatch, count |
| packs | packs merge summary hook | counts per collection |
| perf | perf sampler (interval) | first N counters |

Panels can be toggled (checkboxes in toolbar). Hidden panels keep data but not rendered.

## 6. Event Hooks
HUD attaches non-invasive hooks:
- Routing: monkey-patch `routing.compute` if available to capture meta.
- Rules & Packs: pipeline invokes `hudUpdateRules(list)` / `hudUpdatePacks(summary)`.
- Issues: pipeline can push via `hudPushIssue(issue)` or auto‑seed existing validation errors.
- Perf: sampled every `perfSampleMs` (default 1000 ms) using `__msdDebug.perf()` snapshot.

## 7. Issue Object Format
```
{
  severity: 'error' | 'warn' | 'info',
  code: string?,
  msg: string
}
```
Arbitrary additional keys are preserved.

## 8. Routing Meta Stored
Subset only (for compactness):
```
{
  id,
  meta: {
    strategy, cost, cache_hit,
    channel?, arc?, smooth?
  }
}
```
Later extension: inline mini SVG preview (deferred).

## 9. Performance Sampling
- Counter snapshot expected from `window.__msdDebug.perf()`.
- HUD truncates to first ~12 keys (ordering deterministic if provider sorts).
- Future: user selection & delta views.

## 10. Extensibility
Planned future additions (Wave 6+):
- Anchors panel (list + origin badge)
- Overlay highlight (click HUD row → outline overlay)
- Packs diff viewer (popup)
- Export actions (collapsed/full) UI
- Profile toggles (Wave 7)
- Rule enable/disable toggle

## 11. Non-Goals (Wave 6)
- Editing configuration
- Real-time streaming diff beyond periodic perf sampling
- Heavy virtualization (dataset sizes currently small)

## 12. Performance Considerations
- Single rAF batched render; state changes set a flag.
- Hard caps: issues (500), routing recent (40 default) to avoid DOM bloat.
- Render builds simple HTML strings (no reconciliation overhead).

## 13. Security / Safety
- No `innerHTML` from untrusted external text outside of escaped simple strings (current data is internal).
- No network operations.
- No mutation of pipeline state.

## 14. Minimal Integration Steps for Pipeline
Pipeline / subsystems call:
```
window.__msdDebug.hud.publishIssue({severity:'warn', msg:'...' });
window.__msdDebug.hud.publishPacks({ animations, rules, profiles, overlays, timelines });
window.__msdDebug.hud.publishRules(ruleActivityArray);
window.__msdDebug.hud.publishRouting({ id, meta });
```

## 15. CSS / Styling
Inline styles only (avoid external CSS collision):
- Dark translucent panels
- Monospace 11px
- Compact spacing
- Panel border and subtle radius

Future: central theme & CSS class tokens.

## 16. Versioning
`Wave 6 HUD alpha` footer tag for quick visual confirmation.
Future updates bump footer label.

## 17. Acceptance (Wave 6 HUD)
- show()/hide() works idempotently.
- Panels render with live data when pipeline active.
- Adding >8 issues displays overflow indicator.
- Routing panel updates on new route computations (cache hits included).
- No console errors during normal operation.

(End)
