# CB-LCARS Developer Tools (Console Helpers)

Load by appending `?lcarsDev=1` to your dashboard URL (or set `window.CBLCARS_DEV_FORCE = true` before the bundle loads).
Helpers attach to `window.cblcars.dev`.

## Quick Start

Open browser console:
- `cblcars.dev.dumpRoutes()`
- `cblcars.dev.runAllScenarios()`
- `cblcars.dev.toggleDetour(false)`
- `cblcars.dev.snapshotConfig('baseline')`

## Namespaces

| Area | Helpers |
|------|---------|
| Layout & Routing | relayout, dumpRoutes, show, listLines, toggleDetour |
| Runtime / Flags | setRuntime, getRuntime, flags, toggleFlags |
| Config Mgmt | snapshotConfig, listSnapshots, restoreConfig |
| Overlays | exportOverlays, importOverlays, addOverlay, removeOverlay, mutateLine, findLine |
| Anchors | listAnchors, setAnchor, moveAnchor |
| Obstacles (Sim) | simulateObstacle, clearSimulatedObstacles |
| Perf | perfDump, resetPerf, capturePerf, benchLayout |
| Diagnostics | inspect, watchRoute, watchAttributes, geometrySelfTest |
| Visual Aid | hi, openDoc |
| Scenarios | addScenario, listScenarios, runScenario, runAllScenarios |

---

## Function Reference

### relayout(id='*')
Force re-layout of connectors.
`cblcars.dev.relayout('line_detour_auto')`

### dumpRoutes()
Tabular routing telemetry for all connectors.

### show(id)
Display all `data-cblcars-*` attrs + config + bbox + routing registry.
Returns `{ attrs, config, bbox, registry }`.

### listLines()
Lists connector IDs in config vs DOM.

### toggleDetour(on=true)
Enable/disable two-elbow detour heuristic at runtime.

### setRuntime(cfg) / getRuntime()
Merge or read runtime routing overrides.
`cblcars.dev.setRuntime({ smart_aggressive:true })`

### flags(patch?)
Get or merge global debug flags.
`cblcars.dev.flags({ connectors:true })`
`cblcars.dev.toggleFlags({ connectors:true, perf:true })`

### snapshotConfig(name?)
Deep clone current card config to in-memory snapshot.
Returns snapshot ID.

### listSnapshots()
List snapshot IDs.

### restoreConfig(id)
Restore a previously saved snapshot.

### exportOverlays(filterFn?)
Return deep-cloned overlays array (optionally filtered).

### importOverlays(data, { replace=false })
Merge or replace overlays; restamps card.

### addOverlay(overlay)
Inject single overlay (dedup by id) and restamp.

### removeOverlay(id)
Remove overlay and restamp.

### mutateLine(id, patch)
Patch overlay object fields quickly.
`cblcars.dev.mutateLine('line_detour_auto', { width:14 })`

### findLine(id)
Return overlay config (line) or null.

### listAnchors()
List current anchor coordinates.

### setAnchor(id,x,y)
Create or update anchor; triggers restamp.

### moveAnchor(id,dx,dy)
Relative move.

### simulateObstacle(id, {x,y,w,h})
Adds an ephemeral ribbon overlay (id prefixed with `__sim_ob_` if not already) to test routing.

### clearSimulatedObstacles()
Remove all simulated obstacles.

### perfDump()
Table of perf counters (count/avg/last/max).

### resetPerf(key?)
Reset all or single counter.

### capturePerf(regex)
Return snapshot filtered by regex of counter keys.

### benchLayout(iter=5)
Runs layout N times and reports timings.

### inspect(id)
Alias to show().

### watchRoute(id, intervalMs=600, durationMs=4000)
Repeatedly sample show(id) over duration.

### watchAttributes(id, pattern='^data-cblcars-route', durationMs=4000, cb?)
MutationObserver for attribute changes; calls optional callback.

### geometrySelfTest()
Run geometry round-trip CTM accuracy test (if geometry utils expose selfTest).

### hi(ids, duration=1400)
Temporary highlight one or more overlay IDs.

### openDoc()
Console quick list of helper names.

---

## Scenario Runner

### listScenarios()
Table of pre-registered scenarios.

### runScenario(name)
Executes one scenario:
- setup()
- wait settleMs (default 250)
- expect()
- teardown()
- restore snapshot (unless scenario.restore === false)

Returns summary: `{scenario, ok, details, ms, error}`

### runAllScenarios(filterTag?)
Sequentially run all (or those with `tag`).
Aggregated pass/fail summary.

### addScenario(def)
Register custom scenario. Example:

```js
cblcars.dev.addScenario({
  name: 'my_custom',
  description: 'Check grid attempts escalate',
  tags: ['grid'],
  settleMs: 300,
  setup: (ctx) => {
    ctx.mutateLine('line_grid_forced', { avoid: ['obstacle_vertical_wall','obstacle_mid_block'] });
    ctx.relayout('line_grid_forced');
  },
  expect: (ctx) => {
    const attrs = ctx.show('line_grid_forced').attrs;
    const attempts = (attrs['data-cblcars-route-grid-attempts']||'').split(',');
    return {
      ok: attempts.length > 0,
      details: attempts.join(' ')
    };
  }
});
cblcars.dev.runScenario('my_custom');
```

### Default Scenarios

| Name | Purpose |
|------|---------|
| detour_basic | Validate 2-elbow detour triggers |
| channel_prefer_hit | Preferred channel is hit |
| channel_prefer_miss | Miss flag set under prefer mode |
| channel_require_fail | Require mode rejects path w/out channel hit |
| smart_aggressive_toggle | Aggressive mode changes grid attempt gating |

---

## Typical Workflow

1. Enable dev tools: add `?lcarsDev=1` to URL and reload.
2. Run baseline snapshot: `cblcars.dev.snapshotConfig('base')`.
3. Run all scenarios: `cblcars.dev.runAllScenarios()`.
4. Inspect failing scenario details via `show(lineId)` or `dumpRoutes()`.
5. Adjust anchors/obstacles with `moveAnchor` / `simulateObstacle`.
6. Re-run scenario or `runAllScenarios()` until pass.
7. Restore baseline: `cblcars.dev.restoreConfig('base')`.

---

## Safety / Notes

- Snapshots are in-memory only (lost on page reload).
- importOverlays / mutateLine trigger restamp; big configs may cause noticeable re-render.
- Scenario runner’s restore step reverts card config; post-analysis changes may be overwritten if you run scenarios afterward.
- Simulated obstacles use id prefix `__sim_ob_` for easy cleanup.

---

## Roadmap (Potential Future Enhancements)

- Diff viewer between snapshots
- Export/import snapshots to localStorage
- Visual overlay of detour candidate paths
- Channel heatmap overlay of occupancy
- Scenario assertion DSL (e.g. expectAttr, expectNotAttr)
- Integration with a small inline HUD (panel of scenario results)

---

Enjoy faster iteration with fewer manual edits. Engage warp speed debugging!