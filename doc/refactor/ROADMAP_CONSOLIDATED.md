# LCARS MSD v1 – Consolidated Roadmap & Status (Authoritative)

---

## Wave 1 Remaining Steps & Next Actions (2025-08-24)

**Current Status:**
- Unified merge engine, deep palette merge, anchor provenance, external pack layering, perf counters, and basic HUD panels are implemented.
- Headless test support is robust.
- Documentation and assessment report are up to date.

**Wave 1 Closure Tasks (Delta):**
1. **Validation expansion:**
   - Ensure anchor.missing detection and duplicate id assertion are robust and always invoked.
2. **Determinism & parity test harness:**
   - Scripts to merge the same config twice and compare checksums (T03, T11).
3. **Canonical exportCollapsed:**
   - Stable key ordering, meta strip, round-trip parity assertion.
4. **HUD provenance badge surfacing:**
   - Packs panel shows badges for origin, overridden, removed, redundant.
5. **Baseline tag:**
   - Tag msd-wave1-refactor-complete after all above are green.

**Immediate Next Steps:**
- Harden validation: ensure all error/warning codes are emitted and surfaced in HUD.
- Implement and run determinism test scripts (merge twice, compare hashes).
- Finalize canonical exportCollapsed and parity check.
- Polish HUD packs panel to show all provenance badges.
- Tag baseline and update docs for Wave 1 closure.
- Begin Wave 2: RulesEngine dependency index, counters, and HUD integration.

---

## 1. Executive Summary

The clean‑slate MSD pipeline is mid‑journey: rules visibility, routing strategies, and a functional HUD (issues/routing/rules/packs/perf) are live. Remaining v1 scope centers on: deterministic pack merge + provenance, overlay/animation inspection, profile/value_map consolidation, animation diff/reuse instrumentation, export toolchain, and performance counters with benchmark validation.

Target outcome: A deterministic, instrumented, HUD‑observable pipeline producing stable ResolvedModels, enabling removal of legacy state_resolver / inline animation code paths with confidence.

---

## 2. Legacy Mapping (Reference Only)

| Legacy Term | Canonical Wave |
|-------------|----------------|
| Phase A | Wave 1 |
| Phase B | Wave 2 |
| Phase C | Wave 3 |
| Phase D | Wave 4 |
| Phase E | Wave 5 |
| Phase F | Wave 6 |
| Phase G | Wave 7 |
| Phase H | Wave 8 |

---

## 3. Wave Status Snapshot

| Wave | Scope (Condensed) | Status | Gaps / Remaining |
|------|-------------------|--------|------------------|
| 1 | Pack merge engine, CardModel (viewBox/anchors) | PARTIAL | Deterministic merge + provenance + removal enforcement not finalized (external loader integration + palette deep merge pending) |
| 2 | Rules engine core (conditions, priority) | PARTIAL | Dirty dependency index, eval & match counters, stop semantics overlay-scope enforcement |
| 3 | Profiles + value_map assembly | PARTIAL | Profile layered merge & active_profiles mutation integration; value_map numeric resolution pass centralization |
| 4 | Animation registry + refs + reuse diff | PARTIAL | Hash/diff reuse metrics, instance reuse counters, timeline diffing formalization |
| 5 | Renderer refactor + advanced routing (smart/grid/channels/smoothing) | NEAR | Cache invalidation strategy docs, cost metric auditing, provenance pass through renderer |
| 6 | HUD panels (packs, rules, overlays, perf, issues) | ACTIVE | Overlays & animation inspection panel, provenance badges, diff viewer, highlight/select, export triggers |
| 7 | Export (collapsed/full), diff, provenance badges | NOT STARTED | Full snapshot composer; checksum + redundant override detection in export path |
| 8 | Perf tuning & benchmarks | NOT STARTED | Counter normalization, rolling averages, bench suite expansion |

---

## 4. Detailed Remaining Work by Wave

### Wave 1 (Packs & CardModel)
- Implement mergePacks(userMsd) with strict layer ordering & inline removal.
- Inject provenance meta (origin_pack, checksum, overridden, diverged).
- Redundant override detection (warning).
- Anchors provenance tags (svg vs user vs pack).

### Wave 2 (Rules Engine Enhancements)
- Dependency index: entity → rule id set.
- Dirty evaluation cycle (only rules whose deps changed).
- Counters: rules.eval.count, rules.match.count (HUD perf).
- Overlay‑scoped stop semantics (“stop after this overlay’s modifications”).
- Rule trace ring buffer (last N matches).

### Wave 3 (Profiles & value_map)
- Profile application ordering (active_profiles first → per overlay base style).
- Hot profile add/remove (rule apply.profiles_add/remove).
- Consolidated value_map resolver pass before animation/style finalization.
- Validation for inverted input ranges, non-finite output.

### Wave 4 (Animation Registry)
- Instance hash (preset + params + targets) & reuse map.
- animation.instance.{new,reuse,stop} counters.
- Timeline diff detection (structural vs param change).
- Motionpath dependency (path d change → restart logic).

### Wave 5 (Renderer / Routing Finalization)
- Routing cache key doc + invalidation triggers (anchors moved, obstacles, channels change).
- Cache counters: routing.cache.hit/miss, routing.invalidate.events.
- Cost component breakdown (distance, bend, proximity, channel) aggregated for HUD.
- Corner round arcs meta (already captured) unify naming.
- Fallback line logging (cost multiple breach).

### Wave 6 (HUD Completion)
- Overlays panel: id, type, final style subset, animation_ref, provenance badges.
- Animation panel (optional separate) or merged overlay row expansion.
- Click → highlight overlay (pulse stroke / glow).
- Packs panel: show overridden + removed items (strike or “removed” badge).
- Export buttons (collapsed/full) wiring (Wave 7 hand-off).
- Perf panel: rolling averages & last sample.

### Wave 7 (Export & Diff)
- exportCollapsed(userMsd) (strip provenance, packs).
- exportFullSnapshot(merged, { include_meta }).
- Diff generator (baseline pack item vs effective user override).
- Redundant override suggestion tool.

### Wave 8 (Performance & Bench)
- Micro benchmark harness scenarios: merge, rules (dirty vs full), routing (cache vs recompute).
- Rolling average instrumentation (EWMA) for stage timings.
- Perf budget assertions in CI (optional).
- Memory safeguards (animation / routing caches purge policy).

---

## 5. Immediate Next Sprint (Recommended 2–3 Weeks)

Priority (ordered):
1. Pack Merge & Provenance (Wave 1 finalization)
2. Rules dependency indexing + counters (Wave 2 completion path)
3. Overlays HUD panel + provenance badges (Wave 6 enabler)
4. Animation registry hashing + counters (Wave 4 synergy)
5. Export collapsed snapshot skeleton (Wave 7 groundwork)

Stretch:
- Overlay highlight interaction.
- Routing cache counters surfacing.

Deliverable Definition of Done per item:
- Pack merge: Deterministic snapshot stable across runs (hash unchanged).
- Rules counters visible in HUD perf.
- Overlays panel lists >90% of resolved entries, no perf regression.
- animation.instance.* counters increment under repeated HUD refresh.

---

## 6. Data & Metrics Plan

| Metric | Source Hook | Display |
|--------|-------------|---------|
| packs.merge.ms | mergePacks end | Perf panel (avg) |
| rules.eval.count | rules engine loop | Perf panel (increment) |
| rules.match.count | on match commit | Perf & Rules panel badges |
| routing.cache.hit/miss | router.compute pre-return | Perf panel |
| routing.strategy.* | per strategy path resolution | Perf panel grouped |
| animation.instance.new/reuse/stop | registry diff cycle | Perf panel |
| render.overlays.updated | overlay diff loop | Perf panel |
| value_map.resolve.count | value_map pass | Hidden (debug export) |

Rolling Average Strategy: Keep totalMs + samples; compute avg on HUD render.

---

## 7. Provenance Schema (Internal Meta Fields)

Injected (never exported in collapsed):
```
{
  id,
  origin_pack: 'builtin:core' | 'builtin:<id>' | 'external:<url>' | 'user',
  origin_version: 'unknown' | semver,
  checksum: '<10hex>',
  overridden: boolean,
  override_layer?: 'user' | 'external:<url>',
  diverged_from_checksum?: '<10hex>'
}
```
(Clarification Added) Checksums are derived post meta-strip + stable sort. See Section 17.

---

## 8. Validation Pass (Post-Merge)

Severity Rules:
- Error: Missing required fields, invalid view_box, unresolved anchor reference.
- Warning: Redundant override, removal id not found, invalid smoothing_mode, inverted value_map range.

HUD:
- Issues panel groups by severity; clicking an issue optionally highlights affected overlay (future).

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Merge nondeterminism (object key order) | Hash churn | Stable sort collections before checksum |
| Rules engine full re-eval on each tick | Perf waste | Dirty dependency index |
| Animation restarts on minor param jitter | Visual jitter | Param diff narrowing + reuse hash |
| Routing cache stale after anchor update | Visual misroute | Anchor rev counter in cache key |
| HUD perf overhead | User latency | Throttle updates (rAF + change detection) |

---

## 10. Backlog (Curated from Addenda & Prior Docs)

| Category | Item | Wave Target |
|----------|------|-------------|
| Profiles | Profile toggle HUD | 6/7 |
| Packs | Diff modal + override stub generator | 7 |
| Routing | Advanced smoothing modes (catmull, bspline) | 11 (Deferred) |
| Animations | Transition hooks on rule enter/exit | 12 |
| Security | External pack allow‑list & signatures | 12 |
| Entities | Derived datasource expressions | 10 |
| Export | Diff patch export | 7/8 |
| Perf | Lazy routing recompute (endpoint delta only) | 8/9 |

---

## 11. API Additions (Planned)

| Function | Purpose |
|----------|---------|
| window.__msdDebug.exportCollapsed() | Returns user YAML (no meta) |
| window.__msdDebug.exportFull({ include_meta }) | Returns full merged snapshot |
| window.__msdDebug.packs.reloadExternal(url) | Force refetch external pack |
| window.__msdDebug.rules.trace() | Returns recent match trace |
| window.__msdDebug.animations.inspect(id) | Current instance + params hash |
| window.__msdDebug.overlays.highlight(id) | Flash overlay in UI |

---

## 12. Acceptance Criteria (v1 Stable Declaration)

All must be true:
1. Deterministic merged snapshot checksum stable across reload with unchanged inputs.
2. HUD shows rules with non-zero eval & match counters under live entity changes.
3. Overlays panel: ≥ 95% of overlays listed with correct final style & animation_ref.
4. animation.instance.reuse ratio ≥ 60% in a controlled test (looping animations).
5. Routing cache hit rate > 70% after warm run of static anchors.
6. Collapsed export imports to reproduce identical merged checksum (modulo checksum field).
7. No console errors in default HUD-visible operation.
8. All validation errors reflected in Issues panel within 1s of detection.
9. Legacy state_resolver & inline animation paths not invoked (instrumented guard).
10. Bench harness: pack merge < 15ms (cold, mid-size config), < 4ms warm.
(Additions)
11. Palette deep merge preserves untouched tokens across all layers.
12. External pack integration does not introduce nondeterminism (same snapshot when external unchanged).
13. Redundant overrides produce exactly one warning per id per merge session.

---

## 13. Implementation Checklist (Working Copy)

- [x] mergePacks deterministic
- [x] provenance injection
- [x] redundant override detection
- [ ] rules dependency index
- [ ] rules eval/match counters
- [ ] stop semantics enforcement
- [ ] value_map centralized pass
- [ ] animation registry hash & reuse counters
- [ ] overlays HUD panel
- [ ] exportCollapsed / exportFull *(collapsed basic; canonical + full pending)*
- [ ] routing cache counters surfaced
- [ ] perf rolling averages *(packs.* base done; others pending)*
- [ ] acceptance test harness scripts *(determinism / parity not added yet)*
- [ ] collapsed export parity test
- [ ] docs update (remove outdated roadmap refs)

Remaining Wave 1 Closure (delta):
1. Validation expansion (anchor.missing / duplicate detection assurance)
2. Determinism + parity test harness
3. Canonical exportCollapsed + parity assertion
4. HUD provenance badge surfacing
5. Baseline tag (msd-wave1-refactor-complete)

---

## 14. Near-Term Action Plan (Concrete Tasks)

1. Implement mergePacks() (stable ordering, checksum, provenance)
2. Inject provenance meta & adapt HUD packs panel (badges: core, builtin, external, user, overridden)
3. Add rules dependency map (entityId → Set ruleIds)
4. Add eval loop instrumentation (increment counters)
5. Create overlays HUD renderer (simple table, toggleable panel)
6. Build animation hash function & reuse detection logic
7. Expose perf counters in state.perf.snapshot
8. Add exportCollapsed() stub (user msd subset)
9. Add highlight overlay utility (apply temporary stroke + fade via CSS animation)
10. Update HUD to include perf new counters

---

## 15. Deviation Log (Keep Updated)

| Date | Change | Rationale |
|------|--------|-----------|
| (init) | Consolidated multiple docs | Reduce drift |
| 2025-08-22 | Added early init sanitizer (sanitizeInit.js) | Prevent CardModel .map errors on missing arrays |
| 2025-08-22 | CardModel merged-envelope unwrapping fix | buildCardModel received { merged:{...} } envelope |
| 2025-08-23 | Recovery plan appended (Section 27) | Post-revert realignment |
| 2025-08-23 | mergePacks single-pass refactor; wrapper no longer passed beyond init | Deterministic baseline, reduced ambiguity |
| 2025-08-23 | Wave 1 tasks 1–7 complete; added remaining closure list | Progress checkpoint |
| 2025-08-24 | Wave 2 kickoff: anchor.missing validation + rules counters scaffold | Close Wave 1 gap; begin Wave 2 |
| (next) | — | — |

---

## 16. NEXT STEP IMPLEMENTATION PLAN (Wave 1 Completion Focus)

Goal: Finish Wave 1 (deterministic pack merge + provenance) to unlock accurate HUD provenance, diff tooling, and stable downstream hashes before investing further in Waves 2–6 enhancements.

### 16.1 Scope (This Iteration Only)
1. Core merge engine (core → builtin → external → user) – deterministic ordering.
2. Inline & global removal handling.
3. Provenance metadata injection (no HUD UI polish yet).
4. Redundant override detection (warning emission).
5. Stable checksum generation (sorted keys, meta excluded).
6. Minimal HUD packs panel badge placeholder (origin + overridden).
7. Export skeleton: exportCollapsed() (user layer only) – stub implementation.
8. Perf metric: packs.merge.ms + packs.items.count.
9. Issues emission for: unknown removal id, redundant override.

Out of scope (defer to later waves): diff modal, external fetch caching strategy tune, signature/integrity, override stub generator UI.

### 16.2 Task Breakdown (Ordered)
| # | Task | Output | Est. |
|---|------|--------|------|
| 1 | Implement computeChecksum(obj) | Deterministic 10‑hex string | S |
| 2 | Build normalizeItem(obj, collectionName) | Strips meta, stable key order | S |
| 3 | mergeLayer(current, layerDef, originTag) | Returns partial + provenance list | M |
| 4 | Apply inline removals (remove:true) early | Filtered working set | S |
| 5 | After all layers: apply global msd.remove.* | Final filtered collections | S |
| 6 | Inject provenance (origin_pack, origin_version, checksum) | Items carry meta | S |
| 7 | Mark overridden + override_layer + diverged_from_checksum | Accurate flags | M |
| 8 | Redundant override detection (no diff) → warning | Issues entry | S |
| 9 | Aggregate perf timing (packs.merge.ms) | HUD perf snapshot key | S |
|10 | Implement exportCollapsed() | window.__msdDebug.exportCollapsed() | S |
|11 | HUD packs panel augment to show origin + overridden flag (no color design) | Visual validation | S |
|12 | Add unit / bench harness scenario “merge_wave1_smoke” | Log metrics | S |

### 16.3 Data Structures
Provenance (internal only):
```
{
  id,
  origin_pack,           // builtin:core | builtin:<id> | external:<url> | user
  origin_version,        // 'unknown' or semver
  checksum,              // 10 hex
  overridden: boolean,
  override_layer?: 'user' | 'external:<url>',
  diverged_from_checksum?: string
}
```

### 16.4 Pseudocode (High-Level)
```js
function mergePacks(userMsd){
  const t0 = performance.now();
  const layers = [
    { type:'core', data: builtinCore },
    ...builtinSelected.map(id=>({ type:`builtin:${id}`, data: builtinPacks[id] })),
    ...externalSelected.map(url=>({ type:`external:${url}`, data: externalCache[url] })),
    { type:'user', data: userMsd }
  ];
  const accum = initEmpty();
  const provenance = { animations: {}, rules:{}, profiles:{}, overlays:{}, timelines:{} };

  for (const layer of layers){
    for (const coll of COLLECTIONS){
      for (const item of (layer.data[coll]||[])){
        if (item.remove === true){ markRemoval(accum, coll, item.id, layer.type); continue; }
        upsertWithProvenance(accum, provenance, coll, item, layer.type);
      }
    }
  }
  applyGlobalRemovals(accum, userMsd.remove, provenance);
  finalizeProvenance(accum, provenance); // compute checksum, overridden flags, redundant override warn
  const ms = performance.now() - t0;
  perfCounters('packs.merge.ms', ms);
  return { merged:accum, provenance };
}
```

### 16.5 Acceptance Criteria
- Same input config merged twice → identical sorted JSON & checksums.
- Redundant user override logs single warning (issue severity=warn).
- Collapsed export re-import → identical merged output (checksum set matches).
- HUD packs panel shows each item with (origin: user|builtin|core|external) and overridden status correct.
- packs.merge.ms present in perf snapshot (non-zero).

### 16.6 Instrumentation Keys (Add)
| Key | Type | Notes |
|-----|------|-------|
| packs.merge.ms | timing | Last merge duration |
| packs.items.total | count | Sum of all collections |
| packs.items.overridden | count | Items with overridden=true |
| packs.items.redundant | count | Redundant overrides detected (session) |

### 16.7 Issues Emitted
| Code | Severity | Trigger |
|------|----------|---------|
| pack.removal.unknown | warn | Removal id not found |
| pack.override.redundant | warn | Override identical to baseline |
| pack.item.duplicate | error | Duplicate ID collision diff types (should abort pipeline) |

### 16.8 Risks & Mitigation
| Risk | Mitigation |
|------|------------|
| Non-deterministic key order | Stable sort keys before checksum |
| Overhead on frequent merges | Cache last layer signatures; skip full merge if unchanged (future) |
| Large external pack latency | Fetch async; merge after arrival; interim HUD notice (defer) |

### 16.9 Rollback Plan
If merge engine causes regression (pipeline disabled):
- Feature flag `packs_v1_enable=false` falls back to user-only layer (no packs).
- HUD issues show pack.* errors; rules & overlays still render.

### 16.10 Next Wave Prereq Outputs
Deliverables from this step enable:
- Wave 6 provenance badges (needs origin_pack & overridden).
- Wave 7 diff (needs checksums & baseline capture).
- Perf tuning (baseline packs.merge.ms numbers).

### 16.11 Immediate Implementation Order (Execution Script)
1. Add checksum utility + stable JSON serializer.
2. Implement mergePacks + provenance injection.
3. Wire mergePacks into pipeline bootstrap (replace placeholder).
4. Add perf + issues emissions.
5. Extend HUD packs panel (simple badge).
6. Implement exportCollapsed().
7. Smoke test with: core only, core+user override, removal, redundant override.
8. Commit & tag (baseline for Wave 2 enhancements).

### 16.12 Hash / Checksum Utility Consolidation (Clarification)
We will NOT maintain multiple ad hoc implementations of:
- stableStringify (sorted-key JSON for deterministic hashing)
- computeChecksum (SHA-256 → first 10 hex chars)

Action:
1. Search repo for existing implementations:
   grep -R "stableStringify" src
   grep -R "computeChecksum" src
   grep -R "checksum(" src
2. If an existing generic util (e.g. src/utils/hash.js or similar) already exports equivalent logic:
   - Re-export in msd packs layer (src/msd/packs/hashUtil.js) OR import directly.
3. If none exist, the packs module provides a single implementation (checksum.js) and other subsystems (rules diff, animation reuse hashing) import from it.
4. Guard against duplicate bundling by:
   - Avoid redefining globals; do not attach to window unless debugging.
   - In any new module needing hashing:
     import { computeChecksum, stableStringify } from '../packs/checksum.js';
5. Fallback pattern (if uncertainty about existing code during transition):
   const { computeChecksum, stableStringify } = existingHashUtil || localHashUtil;
   where existingHashUtil is conditionally imported (try/catch) or feature-detected via window.__msdDebug?.utils.

Rationale:
- Deterministic merge & diff flows depend on identical hashing across layers.
- Divergent implementations (even whitespace differences) cause provenance checksum mismatch and false “diverged” flags.

Future:
- If performance profiling shows SHA-256 cost hotspots on very large configs, introduce optional fast non-crypto hash (Murmur32) ONLY for non-integrity tasks (animation reuse) while keeping SHA-256 for provenance.

(End Section 16.12)

---

## 17. Checksum Algorithm (Authoritative)

Purpose: Stable provenance & diff detection.

Steps:
1. Deep clone item excluding internal meta fields (origin_pack, overridden, checksum, diverged_from_checksum, override_layer, removal_source, removed).
2. stableStringify(obj):
   - Deterministically sort object keys (recursive).
   - Serialize arrays in given order (assumed order-significant).
   - Omit properties with value undefined.
3. Hash: SHA-256 over UTF-8 bytes → hex → first 10 chars (lowercase).
4. Store at item.checksum AFTER merge finalization (single pass).
5. Divergence: diverged_from_checksum set only if a prior layer checksum differs from final and item id existed previously.

Collision Handling:
- On detecting duplicate checksum with different stableStringify output (rare), emit issue pack.checksum.collision (future; not Wave 1 blocking).

---

## 18. Palette Merge Semantics (Authoritative)

Goal: Token-level override; avoid wiping sibling tokens.

Algorithm (per palette name):
for each incoming paletteName:
  base[paletteName] = base[paletteName] || {}
  for each token,value in incoming[paletteName]:
    if value === null && allow_null_removal?: delete base[paletteName][token]
    else base[paletteName][token] = value

Constraints:
- No deep objects inside token values in Wave 1 (treat as leaf scalar or simple string).
- Invalid (non-object) palette map ⇒ issue pack.palette.merge.error (error).

Determinism:
- Iterate palette names sorted ascending.
- Iterate token keys sorted ascending for checksum derivation only (runtime merge order flexible).

---

## 19. External Pack Loader Integration (Wave 1 Completion Requirement)

Flow:
1. Collect external pack descriptors (urls) from config.
2. Fetch in parallel (Promise.allSettled).
3. On rejection: emit issue pack.external.load_failed (error) & skip layer.
4. Sort successful external layers by url (lexicographic) before merge to ensure deterministic order independent of fetch completion timing.
5. Include origin_pack = external:<url>.

Timeout Guidance:
- Default 5000ms (configurable msd.external.timeout).
- On timeout: treat as rejection.

---

## 20. Performance Counters (Unified Schema)

Store per counter:
{
  last: number,
  totalMs: number,
  samples: number,
  avg: number (computed lazily / on snapshot)
}

Initial Keys (Wave 1):
- packs.merge.ms
- packs.items.total
- packs.items.overridden
- packs.items.redundant

Wave 2 Additions:
- rules.eval.count
- rules.match.count

---

## 21. Feature Flags (Transition Safety)

Flag | Default | Description
-----|---------|------------
msd.packs.v1_enabled | true | Enables new unified merge
msd.external.enabled | true | Allows external pack fetch + layering
msd.rules.v2_enabled | false | Activates new RulesEngine skeleton
msd.export.full_enabled | false | Enables exportFull snapshot API

Usage: Wrap critical branches; CI matrix includes flag off case for regression detection.

---

## 22. Test Matrix (Living – Scenario IDs)

ID | Title | Purpose | Wave | Status
----|-------|---------|------|-------
T01 | stableStringify basic | Key ordering deterministic | 1 | Planned
T02 | stableStringify nested | Nested object sorting | 1 | Planned
T03 | Multi-layer merge baseline | core→builtin→user layering | 1 | Partial
T04 | Duplicate id override | overridden flag accuracy | 1 | Planned
T05 | Palette deep merge tokens | Preserve untouched tokens | 1 | Planned
T06 | Anchor provenance | origin_pack on anchors | 1 | Planned
T07 | External fetch determinism | Order independent of timing | 1 | Planned
T08 | Validation invocation | Issues emitted (duplicate id) | 1 | Planned
T09 | Redundant override detect | Warn only when identical | 1 | Planned
T10 | Perf counter accumulation | samples & avg computation | 1 | Planned
T11 | Collapsed export parity | Round-trip equality | 1 | Planned
T12 | Rules counters skeleton | Non-zero eval/match | 2 | Planned
T13 | Legacy path regression guard | Flag off parity | 1 | Planned

Execution Scripts (to be implemented):
- yarn test:scenario T01 T02
- yarn test:merge (T03,T04,T05)
- yarn test:perf (T10)
- yarn test:export (T11)

---

## 23. Daily Execution Timeline (Compact Reference)

Day | Focus | Scenarios
----|-------|----------
D1 | Hash utilities | T01,T02
D2 | Unified merge path | T03,T04
D3 | Palette + anchors provenance | T05,T06
D4 | External deterministic layering | T07
D5 | Validation wiring | T08
D6 | Redundant override hardening | T09
D7 | Perf counters expansion | T10
D8 | Collapsed export parity | T11
D9 | Rules skeleton counters | T12
D10 | Legacy removal flag off audit | T13

---

## 24. Issue Codes (Extended Updates)

Code | Severity | Description
-----|----------|------------
pack.external.load_failed | error | External pack fetch failed/timeout
pack.checksum.collision | warn | Two items diff bodies same checksum (rare)
# (Existing codes remain; see Assessment Appendix)

---

## 25. CI / Automation Hooks (Planned)

Hook | Trigger | Action
-----|--------|-------
ci:merge-determinism | After build | Runs T03 twice compare checksum
ci:export-parity | After build | Runs T11
ci:flags-matrix | Nightly | Tests with msd.packs.v1_enabled=false
ci:perf-sample | Nightly | Records packs.merge.ms (median of 5) trend

---

## 26. Deviation Log
# ...existing code...
(Add note: Palette deep merge & external loader integration explicitly tracked as Wave 1 completion items.)

## 27. Wave 1 Recovery Plan (Post-Revert Alignment)

Ordered Tasks (D0–D6):
1. D0 Fix wrapper misuse:
   - initMsdPipeline: destructure { merged, provenance }.
   - validateMerged: unwrap if input.merged present.
   - CardModel: (temporary) tolerate envelope; log once if unwrapping performed.
2. D1 Merge engine consolidation:
   - Remove / flag legacy merge helpers.
   - Single pass layering (core→builtin→external→user).
3. D2 Deep palette + anchor provenance:
   - Token-level palette merge.
   - provenance.anchors[id] = { origin_pack, overridden, override_layer? }.
4. D3 External packs:
   - Parallel fetch (Promise.allSettled), deterministic sort by URL.
   - Issue pack.external.load_failed on error/timeout.
5. D4 Checksum & validation:
   - One post-finalization checksum pass (strip meta).
   - Validation emits pack.item.duplicate, pack.removal.unknown, anchor.missing.
6. D5 Instrumentation & tests:
   - Perf counters { last,totalMs,samples,avg }.
   - Determinism test (merge twice → identical stableStringify hash).
   - Redundant override test (exactly one warning).
7. D6 Export & parity:
   - exportCollapsed canonical.
   - Parity test (collapsed→merge→checksums identical).
   - Tag msd-wave1-refactor-complete.

Exit Criteria Wave 1 Recovery:
- No runtime TypeError on CardModel init.
- Validation detects intentional duplicate & unknown removal in test fixture.
- Deterministic checksum stable across 3 runs (no external change).
- packs.merge.ms avg available (≥2 samples) in HUD/perf API.
- Palette deep merge preserves untouched tokens (test passes).

Progress Update:
- Completed: unwrap, single-pass merge, deep palette, anchor provenance, external layering, checksum, perf avg.
- Pending: validation expansion, determinism & parity tests, canonical export, baseline tag.

(End Section 27)
