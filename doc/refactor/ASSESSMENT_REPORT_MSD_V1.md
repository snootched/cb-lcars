# LCARS MSD v1 – Assessment Report (Current Code vs Consolidated Roadmap)

---

## Wave 1 Closure Status & Next Steps (2025-08-24)

**Current Position:**
- All major merge, provenance, palette, and external pack features are implemented.
- Perf counters and HUD panels are functional.
- Headless test support is robust.

**Wave 1 Remaining Steps:**
1. Validation expansion (anchor.missing, duplicate id detection).
2. Determinism & parity test harness (merge twice, compare checksums).
3. Canonical exportCollapsed (stable key ordering, meta strip, parity assertion).
4. HUD provenance badge surfacing (packs panel badges for origin, overridden, removed, redundant).
5. Baseline tag (msd-wave1-refactor-complete).

**Next:**
- Complete above closure tasks, tag baseline, and proceed to Wave 2 (rules engine enhancements).

---

## A. Document Set Review

| Item | Observation | Action |
|------|-------------|--------|
| ROADMAP_CONSOLIDATED.md | Authoritative, wave framing clear, realistic | Keep; append small clarifications (checksums, palette merge semantics) |
| ROADMAP_AND_ARCHITECTURE_Version2 (1).md | Superseded; redundant content; risk of drift | Archive or delete; add “ARCHIVED” banner if retained |
| Routing & smoothing accomplishments | Consolidated roadmap lists milestones as complete; good historical ledger | Ensure code-level perf counters match doc claims |
| Export & provenance sections | High-level plan solid, implementation lag in repo | Flag as Wave 1/7 dependency |

---

## B. Alignment Snapshot (Claim vs Implementation)

| Feature (Docs) | Status in Repo | Alignment |
|----------------|----------------|-----------|
| Pack merge engine | mergePacks.js present (single-pass layered) | Partial (see dual logic remnants) |
| Provenance meta | origin_pack / overridden / diverged fields present | Inconsistent; duplication & recomputation |
| Redundant override detection | Implemented (diffEqual) | Needs meta stripping & baseline clarity |
| External pack loading integration | externalPackLoader.js exists | Not wired into mergePacks processing path |
| Global + inline removal | Implemented | Provenance for global removal minimal |
| Palette deep merge | Planned (implied) | Currently shallow; overwrites entire palette |
| Anchor provenance | Planned | Not implemented |
| Validation post-merge | validateMerged.js exists | Not invoked in mergePacks flow |
| Rules engine (expanded) | Planned Wave 2 | Not implemented yet |
| Dependency index | Planned Wave 2 | Not implemented |
| Profiles + value_map central pass | Planned Wave 3 | Legacy style path still active |
| Animation registry reuse | Planned Wave 4 | Not implemented; using legacy scope logic |
| Renderer consuming ResolvedModel | Wave 5 objective | Not refactored yet |
| HUD panels (packs, rules, overlays, perf) | Partial skeleton | Overlays/animations inspection incomplete |
| Export modes (collapsed/full) | Planned Wave 7 | Only basic exportCollapsed(user copy) |
| Perf harness / counters completeness | Planned Wave 8 | Basic counters only |

---

## C. Code Audit (mergePacks & Related)

Key Findings:
1. **Dual Merge Patterns**: Unused earlier pattern (layerKeyed / markProvenance) remains alongside effective upsert logic—creates maintenance ambiguity.
2. **Checksum Redundancy**: markProvenance computes checksum; final loop recomputes. Need single authoritative calculation after baseline stripping meta.
3. **Redundant Override Detection**: diffEqual runs against objects that may include fields not canonically normalized (arrays ordering, potential meta leakage).
4. **Palette Merge**: Shallow spread overwrites entire nested palettes; contradicts expected token-level deep merge.
5. **Anchor & Palette Provenance**: No origin metadata added—HUD cannot differentiate user vs pack vs svg sources.
6. **Global Removal Provenance**: removal_source not distinguished (inline vs global).
7. **Provenance Fields Divergence**: diverged_from_checksum derived from prevProv.checksum pre-recalc—risk of carrying stale checksums when override order changes.
8. **External Packs**: Loader provided but not invoked in merge path; currently dependent on debug namespace fallback.
9. **Validation**: validateMerged.js duplicate ID detection not chained into mergePacks; potential silent anomalies.
10. **Performance Counters**: packs.merge.ms stored as single value; no totalMs/samples for later averaging analysis.
11. **exportCollapsed Semantics**: Present behavior matches “user layer extraction,” but docs expect clarified semantics (canonical ordering & explicit exclusion of meta).
12. **Deep Param Merge**: Current shallow object merge may inadvertently merge nested structures where full replace or deep merge semantics are required (e.g., animations.params vs rules).
13. **Async vs Sync Hashing**: computeChecksum awaited in final loop; if function becomes sync, async overhead unnecessary. Decide and standardize.
14. **Dead Helpers**: layerKeyed, markProvenance (first version) appear to be developmental prototypes—should be removed or documented.

---

## D. Gaps vs Roadmap (Wave-Specific)

| Wave | Promised Deliverable | Current Gap |
|------|----------------------|-------------|
| 1 | Anchor provenance tags | Not implemented |
| 1 | Deterministic pack merge (deep palettes) | Shallow palette merge |
| 1 | External pack integration | Loader not integrated |
| 1 | Post-merge validation & issue generation | Not linked |
| 2 | Rules dependency index + counters | Missing |
| 3 | value_map centralized pass | Not extracted from style helpers |
| 4 | Animation reuse hashing & counters | Absent |
| 5 | Renderer ResolvedModel adoption | Not started |
| 6 | Overlays/animation HUD inspection (provenance) | Partial; provenance incomplete |
| 7 | exportFullSnapshot + checksum parity test | Not implemented |
| 8 | Bench harness & normalized counters | Not implemented |

---

## E. Risks & Failure Modes

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Retained dual merge logic causes regressions | Override bugs | Medium | Remove unused code; single algorithm |
| Inconsistent checksum usage | False “overridden/diverged” states | Medium | Single post-merge checksum generation |
| Palette shallow overwrite | User confusion; lost design tokens | High | Implement deep token merge |
| Missing anchor provenance | Hard to debug anchor overrides | Medium | Attach origin metadata |
| Lack of rules engine progress | Timeline slip for v1 acceptance | High | Prioritize Wave 2 tasks immediately after Wave1 completion |
| Re-merge cost escalation with large packs | Perf drift | Medium | Introduce signature caching after deterministic implementation |
| Animation restart jitter (no reuse hash) | Visual instability | Medium | Early adoption of registry hashing |

---

## F. Remediation Priorities

Priority 1 (Complete Wave 1 properly):
1. Unify merge algorithm; drop legacy prototype functions.
2. Single canonical checksum pipeline (strip meta → stableStringify → computeChecksum).
3. Deep palette merge & anchor provenance.
4. Integrate externalPackLoader with async resolution before finalize.
5. Invoke validateMerged() and publish issues.
6. Extend performance counter structure (store last, sum, samples).

Priority 2 (Foundation for Waves 2–3):
7. RulesEngine skeleton + compile/evaluate; entity dependency index.
8. Central valueMapResolver (pre-render layer).
9. Enhanced provenance for removals (removal_source).
10. Comprehensive issue codes catalog (pack.override.redundant, pack.removal.unknown, pack.anchor.missing).

Priority 3 (Animation + HUD):
11. Animation registry hashing + reuse counters.
12. HUD overlays panel consuming ResolvedModel snapshot.
13. Export full snapshot generator (meta toggle, canonical ordering).
14. Collapsed export parity re-import test harness.

---

## G. Sprint Task Planning (Example 2-Sprint Outline)

Sprint 1 (Wave 1 closure):
- T1: Refactor mergePacks (remove layerKeyed/markProvenance older path).
- T2: Implement deepMergePalettes(palettesAcc, newPalettes).
- T3: Integrate externalPackLoader & await all external pack promises (parallel).
- T4: Add anchor provenance: { id, origin_pack, overridden }.
- T5: Post-merge validation + issue publishing hook.
- T6: perfStore upgrade (counters: { last, totalMs, samples }).
- T7: Checksum parity test (two successive merges identical config).

Sprint 2 (Wave 2 kick-off + partial Wave 3):
- T8: RulesEngine.compile (normalize conditions, build deps map).
- T9: RulesEngine.evaluate(dirtyEntities) returning patch set.
- T10: Counters rules.eval.count / rules.match.count.
- T11: valueMapResolver (gathers & assigns numeric results).
- T12: animation registry design doc stub & hashing function prototype.

Stretch:
- exportFullSnapshot (foundation)
- HUD packs panel provenance badges (core/builtin/external/user/removed/redundant)

---

## H. Documentation Adjustments

| Doc Section | Adjustment |
|-------------|-----------|
| ROADMAP_CONSOLIDATED.md Wave 1 Gaps | Add explicit: “External pack loader integration & palette deep merge pending.” |
| Provenance Schema | Add removal_source (inline|global), anchor_provenance (svg|user|pack) |
| Export Semantics | Clarify collapsed export = raw user layer (no provenance, no merged expansions) |
| Palette Merge | Document deep merge algorithm (token-level; user overrides token value only) |
| Checksum Section | Add algorithm: stableStringify (sorted keys, no meta, remove `removed` flag) → SHA-256 → first 10 hex |

---

## I. Revised Acceptance Criteria (Clarifications)

Original Criterion | Updated Clarification
------------------ | ---------------------
Deterministic merged snapshot checksum stable | Include: “No checksum change on repeated merge when config unchanged; adding then removing an override returns to baseline checksum”
Collapsed export equals original user YAML | “Semantically identical ignoring key ordering & optional canonical sort; no pack-derived items included”
Provenance badges displayed | “Includes badges: core, builtin, external, user, removed, redundant”
Animation reuse ratio ≥ 60% | “Measured after registry hashing integration & counters present (animation.instance.*)”

---

## J. Additional Technical Suggestions

1. **stableStringify Caching**: During one merge, maintain WeakMap<object,string> to avoid recomputing for diffEqual when identical references appear (especially nested style objects).
2. **Namespace Issue Codes**: Use prefix `pack.*`, `rule.*`, `routing.*`, `anim.*` to enable simple HUD filtering.
3. **Palette Merge Granularity**: Implement function:
   ```js
   function mergePalettes(base, incoming){
     for (const [palName, tokens] of Object.entries(incoming)){
       base[palName] = base[palName] || {};
       for (const [token, value] of Object.entries(tokens)){
         base[palName][token] = value;
       }
     }
     return base;
   }
   ```
4. **Performance Counter Abstraction**: Provide addTiming(key, ms) => store { last, total, samples } early; reuse for rules, packs, animations.
5. **RulesEngine Future-proofing**: Store normalized conditions with a `type` field to allow easy extension (e.g., entity, entity_attr, map_range_cond, perf_metric).
6. **Animation Hash Stability**: Exclude volatile targets runtime references (DOM nodes) from hashing—hash only semantic config (preset name, param object, animation_ref id).
7. **Anchor Provenance**: When merging anchors, store origin precedence chain; HUD may offer anchor detail modal with origin + coordinates + overrides list.

---

## K. Summary
(Update) Wave 1 iteration 1 merged: unified merge engine, deep palette merge, anchor & item provenance, external pack deterministic layering, validation + issues, perf counters (packs.*).

Remaining high-priority Wave 1 items: anchor provenance HUD surfacing detail, exportFull snapshot, parity & determinism test harness scripts.

- Architectural trajectory remains sound; primary immediate focus should be unifying and finishing Wave 1 to establish a trustworthy baseline (packs & provenance).
- The largest structural gap is absence of the new RulesEngine; deferring it further risks compounded refactor cost.
- mergePacks currently works but includes legacy prototypes and shallow merges that will lead to subtle bugs. Tighten now.
- Documentation nearly matches ambition; add small clarifications to preempt confusion (export semantics, palette merge, checksum process).
- No hard blockers identified; remediation is tactical, not strategic.

---

## L. 10‑Day Focused Execution Plan (Wave 1 Closure + Wave 2 Kickoff Seed)

Day | Goal | Definition of Done | Key Scenarios (ref Test Matrix IDs)
----|------|--------------------|------------------------------------
D1 | Hash & Stringify Canonicalization | checksum utility in packs + unit tests pass | T01, T02
D2 | Unified merge algorithm (legacy code isolated behind flag) | mergePacks_v1 produces identical snapshot twice | T03, T04
D3 | Deep palette merge + anchor provenance | Palette tokens preserved, anchors carry origin_pack | T05, T06
D4 | External pack loader integration (async) | Merge awaits externals; timeout warning path | T07
D5 | Post-merge validation wired + issue codes | Issues panel shows injected synthetic test errors | T08
D6 | Redundant override detection hardened (meta stripped) | False positives = 0 on baseline sample set | T09
D7 | Perf counters { last,totalMs,samples } for packs | HUD shows avg differing from last when run >1x | T10
D8 | exportCollapsed deterministic + parity check script | Re-import yields same checksums | T11
D9 | RulesEngine skeleton (compile+eval no-ops) + counters | counters increment (eval>0) on entity tick | T12
D10 | Hard merge determinism audit & cleanup (remove legacy prototypes) | Feature flag off ⇒ no checksum change | T13

Guardrails:
- Feature flag: msd.packs.v1_enabled (default true; legacy fallback path retained until D10).
- Each day ends with: yarn test:msd:fast (subset) + yarn test:msd:merge (determinism) green.

## M. Fast-Lane Risk Triage (Blocking vs Non-Blocking)

Blocking (must resolve before Wave 1 exit):
1. Dual merge code path (determinism risk)
2. Palette shallow overwrite
3. Missing validation invocation
4. Inconsistent checksum derivation

Non-Blocking (can slip ≤ 1 wave):
- Enhanced removal provenance
- Diverged checksum nuance (order-change) — store baseline chain later
- Animation reuse hashing (Wave 4 anchor)

## N. Scenario Catalog Link (See Roadmap Test Matrix Section 13)

ID | Purpose | Current Status
---|---------|---------------
T01 | stableStringify ordering | Not implemented
T03 | Basic multi-layer merge (core→builtin→user) | Partial
T05 | Palette deep merge tokens retained | Failing (by design until D3)
T11 | Collapsed export parity | Not implemented
T13 | Legacy path removal regression guard | Not implemented
# (Full details maintained in ROADMAP_CONSOLIDATED.md Section 13)

## O. Ready-to-Implement Daily Standup Checklist

Daily Items:
- [ ] Determinism (rerun T03 twice → equal checksums)
- [ ] New warnings/errors enumerated & documented
- [ ] Perf counters updated (diff vs prior day)
- [ ] Scenario regression run: yarn test:scenario <IDs>
- [ ] Update Deviation Log (Roadmap) if scope shifts

Exit Wave 1 (All True):
- [ ] Core/builtin/external/user layered snapshot stable
- [ ] All palette tokens survive merges unless intentionally overridden
- [ ] Unknown removal emits single pack.removal.unknown warning
- [ ] Redundant override warns only once per id
- [ ] Collapsed export round-trip parity (excluding meta)
- [ ] packs.merge.ms avg < target provisional (≤20ms mid config)

## P. Command Snippets (Proposed Scripts)

Script | Purpose
-------|--------
yarn test:msd:fast | T01,T02 core hash + merge smoke
yarn test:msd:merge | Determinism (T03,T04) + palette (T05)
yarn test:msd:export | Collapsed parity (T11)
yarn test:msd:rules | Rules skeleton counters (T12)

(Implementation pending; referenced for planning.)

## Q. Metrics Acceptance (Interim Targets)

Metric | Interim Target (Wave 1 Exit)
-------|------------------------------
packs.merge.ms (mid config) | ≤ 18ms cold / ≤ 5ms warm
packs.items.overridden / total | Reported (no numeric target yet)
packs.items.redundant | 0 (after first correction pass)
rules.eval.count (Wave1 exit) | ≥ 1 (dummy rule executed)
export.parity.failures | 0

## R. Removal of Legacy Code (Staged)

Stage | Action | Trigger
------|--------|--------
S1 | Mark legacy functions with @deprecated tag | D2 complete
S2 | Wrap legacy path behind flag (default off in dev) | D7
S3 | Delete legacy code after 3 consecutive deterministic passes | Post D10 + green CI

## S. Open Questions (To Resolve Early)

Question | Owner | Needed By
---------|-------|----------
External pack timeout value? | Eng | D4
Checksum hash size (10 vs 12 hex)? | Eng | D1 (keep 10 unless collision seen)
Anchor provenance for SVG-generated anchors? | Eng | D3
RulesEngine compile shape (extensibility) | Eng | D9

## T. Communication Cadence

Channel | Frequency | Content
--------|----------|--------
Deviation Log (Roadmap) | Daily end | Scope changes
HUD Perf Snapshot Capture | Each merge perf test | Store JSON diff
Wave 1 Retro Note | D10 end | Lessons + next wave adjustments

---

## Quick Reference To-Do (Condensed)

| Category | Action |
|----------|--------|
| Merge | Remove duplicate logic; single pass; refactor provenance |
| External | Integrate loader; async aggregate |
| Palette | Implement deep token merge |
| Anchors | Add provenance metadata |
| Validation | Invoke validateMerged; emit structured issues |
| Rules | Implement compile/evaluate skeleton next sprint |
| Value Map | Central pass (pre-render) |
| Animation | Registry hash & reuse counters |
| HUD | Packs badges + overlays panel foundation |
| Export | Add exportFullSnapshot + parity test harness |

---

## Appendix: Issue Code Namespace (Proposed)

| Code | Severity | Description |
|------|----------|-------------|
| pack.removal.unknown | warn | Removal ID not found |
| pack.override.redundant | warn | Override identical (effective or baseline) |
| pack.item.duplicate | error | Post-merge duplicate ID |
| pack.palette.merge.error | error | Invalid palette object structure |
| anchor.missing | error | Referenced anchor absent after merge |
| anchor.override.redundant | warn | User anchor identical to svg/base |
| rules.compile.error | error | Invalid rule schema |
| rules.condition.unknown | warn | Unknown condition key |
| anim.hash.missing | warn | Animation entry lacked hashable content |
| export.snapshot.mismatch | error | Re-imported snapshot diverges |

(Adopt incrementally.)

---

End of Report.

## M+. Progress Delta (Post Refactor Update)
Completed since initial assessment:
- Single-pass merge with deterministic layering.
- Deep palette token merge.
- Anchor provenance injection (basic origin_pack/overridden).
- External pack async fetch + sorted order.
- Single checksum post-finalization.
- Perf counter averaging (packs.merge.ms).

Still outstanding for Wave 1 closure:
- Validation: anchor.missing detection; duplicate id assert via validateMerged.
- Determinism & parity test scripts (T03/T11).
- Canonical exportCollapsed (stable key ordering + meta strip).
- Redundant override precision test harness.
- Baseline tag after green tests.

Immediate Action List (Same Ordering):
1. Anchor reference validation.
2. Determinism test script (merge twice compare stable hash).
3. Canonical collapsed export + parity script.
4. HUD provenance badge surfacing.
5. Baseline tag → proceed Wave 2 (rules deps + counters).

(End Progress Delta)