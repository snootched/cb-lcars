# MSD v1 Reconciliation Report (Post-Revert Baseline)

Date: 2025-08-23
Repo Ref (sampled): Commit 2aa513d (mergePacks.js / index.js state)
Documents Compared:
- ROADMAP_CONSOLIDATED.md (Status: ACTIVE)
- ASSESSMENT_REPORT_MSD_V1.md (Earlier forward-looking assessment)

Purpose: Reconcile current reverted code tree with roadmap & prior assessment; establish a clean “Starting Point” snapshot and enumerate minimal corrective actions to realign Wave 1 efforts.

---

## 1. Executive Snapshot

Current code has regressed to an earlier intermediary state:
- mergePacks.js returns a WRAPPER `{ merged: <collections>, provenance }`.
- initMsdPipeline (src/msd/index.js) treats the WRAPPER itself as the merged collections (bug).
- validateMerged() expects top-level collections but receives wrapper; so validation silently inspects empty arrays → false sense of “no errors”.
- External pack loading and palette deep merge not integrated (placeholders & shallow merges).
- Dual / legacy helper logic (layerKeyed + upsert pattern + markProvenance) still co-exist.
- Provenance partially tracked for keyed collections; anchors/palettes have no provenance semantics.
- Performance counters minimal; no rolling averages or sample counts.

This baseline is *earlier* than the state assumed in ASSESSMENT_REPORT_MSD_V1, so some recommendations there assume progress not yet present here.

---

## 2. Shape Divergence Overview

Aspect | Expected (Roadmap Wave 1) | Current Code | Impact
-------|--------------------------|--------------|-------
Return shape of mergePacks | Plain merged collections object (with separate provenance) | Wrapper `{ merged, provenance }` | Causes misuse downstream; CardModel & validation break
Validation Input | Top-level `overlays`, `rules`, etc. | Receives wrapper; collections hidden under `.merged` | Validation inert
Palette Merge | Token-level deep merge | Shallow overwrite | Risk of token loss
External Packs | Deterministic load & layering | Debug stub only (`window.__msdDebug.packs`) | Not actually loading external YAML
Checksum Timing | Single final pass post-merge | Mixed: markProvenance does early sync compute (maybe pre-final shape) + final async recompute | Non-determinism risk
Redundant Override Detection | Compare baseline vs effective (meta stripped) | Performed but baseline meta not guaranteed stripped | Potential false positives/negatives
Anchor Provenance | Origin tagged (core/builtin/external/user) | Not present | HUD provenance gap
Export Collapsed | Canonical user-layer extraction | Basic key copy; no canonical ordering / disclaimers | Usable but under-documented
Perf Counters | last + sum + samples | Only ‘last’ style counters | Cannot compute averages

---

## 3. Current Code Trace (Key Locations)

File | Line Range (approx) | Issue
-----|---------------------|------
src/msd/index.js | 30–52 | `const merged = await mergePacks(userMsdConfig); merged.__raw_msd = ...` (treats wrapper as merged config)
src/msd/packs/mergePacks.js | 1–272 | Mixed old/new merge logic; wrapper return; deep palette merge absent
mergePacks.js | ~38–55 | markProvenance duplicates later checksum pass
mergePacks.js | ~107–118 | “Layer stubs” referencing debug object rather than actual pack loading
mergePacks.js | ~206–228 | Shallow merges for palettes, anchors, routing
validation/validateMerged.js | 2–35 | Expects collections at top level; due to wrapper misuse, duplicate detection never sees true data

---

## 4. Minimal “Repair” vs “Refactor” Paths

Priority | Path | Pros | Cons
---------|------|------|-----
1 | Repair: Adjust initMsdPipeline to destructure `{ merged, provenance }` & pass merged to validation | Fast (minutes) | Leaves structural debt (wrapper object ambiguity)
2 | Repair + Guard: Keep wrapper but teach validateMerged & CardModel to auto-unwrap | Slightly more robust transitional | Encourages continued ambiguity
3 | Refactor: Change mergePacks to return only merged collections; separate provenance via side channel (or second return) | Clean alignment to Roadmap | Slightly broader patch set; update call sites
4 | Full Wave 1 Refactor: unify merge algorithm, deep palette merge, external pack integration, provenance finalization single pass | Future-proof & deterministic | Higher immediate time cost

Recommendation: Execute Option 1 immediately (fix breakage), then schedule Option 4 for Wave 1 closure sprint.

---

## 5. Starting Point Feature Matrix (Baseline Truth)

Feature Category | Current State | Confidence
-----------------|--------------|-----------
Layer Ordering | User-defined layering stub; actual builtin/external fetch absent | Low (not validated)
Inline Removal | Implemented (applies splice deletes) | Medium
Global Removal | Implemented (per collection) | Medium
Redundant Override Warnings | Implemented (diffEqual of effective vs baseline) | Low (meta risk)
Checksums | Async final loop (but early markProvenance path also exists) | Low
Palettes Merge | Shallow object spread | High (observed)
Anchors Merge | Shallow override; no provenance | High
Validation | Runs but on wrapper (ineffective) | High
Perf Metrics | `packs.merge.ms`, item counts only | High
Export Collapsed | Basic key filtering | High
Rules Engine | Not present (legacy only) | High
Value Map Pass | Not centralized | High
Animation Registry | Not implemented | High

---

## 6. Immediate Corrective Actions (Day 0–1)

Action | Rationale | Effort
-------|-----------|-------
Destructure mergePacks result in initMsdPipeline | Fix runtime & validation | XS
Add unwrap guard in validateMerged | Defensive | XS
Add console.warn if wrapper passed where plain config expected | Visibility | XS
Document temporary wrapper shape in CODE_COMMENT | Avoid confusion | XS

---

## 7. Near-Term Wave 1 Rebuild Goals (Re-Established)

Goal | Description | Done? | New ETA
-----|-------------|-------|--------
Deterministic Merge | Single algorithm; remove layerKeyed + markProvenance dead path | No | +2 days
Deep Palette Merge | Token-level merges; deterministic key ordering for checksum | No | +1 day
External Pack Integration | loadExternalPack with deterministic ordering by URL | No | +1–2 days
Provenance Unification | Compute checksum once post-finalization | No | +1 day
Validation Hook | Post-merge call with real data; issue codes | Partially (bug) | +0 day (after fix)
Collapsed Export Clarification | Add ordering & disclaimers | No | +0.5 day

---

## 8. Updated Risk Register (Post-Revert)

Risk | Status | Mitigation
-----|--------|-----------
False sense of correctness (validation inert) | Active | Fix wrapper misuse now
Checksum nondeterminism | Active | Single-pass finalize
Token loss on palette overrides | Active | Deep merge implementation
External pack regressions hidden | Active | Add deterministic fetch ordering test
Override detection noise | Active | Normalize before diff (strip meta fields)

---

## 9. Proposed Patch Sketches (High-Level)

### 9.1 initMsdPipeline Destructure (Fix)

```javascript
// BEFORE
const merged = await mergePacks(userMsdConfig);
merged.__raw_msd = userMsdConfig;
const issues = validateMerged(merged);

// AFTER
const { merged: mergedConfig, provenance } = await mergePacks(userMsdConfig);
mergedConfig.__raw_msd = userMsdConfig;
mergedConfig.__provenance = provenance;
const issues = validateMerged(mergedConfig);
```

### 9.2 validateMerged Unwrap (Defensive)

```javascript
export function validateMerged(input) {
  const merged = input && input.merged ? input.merged : input;
  // proceed with merged
}
```

(Once call site fixed, you may remove unwrap later.)

---

## 10. Delta vs Previous Assessment (What No Longer Applies)

Earlier Recommendation | Status Now | Adjustment
-----------------------|------------|-----------
Anchor provenance already partially done | Not actually present | Reintroduce as plan
External loader integrated soon | Not integrated | Re-schedule Wave 1
Rolling averages planned foundations present | Not present | Rebuild perf store plan
CardModel wrapper fix previously suggested | Still needed (not implemented) | Apply immediately

---

## 11. Clean Baseline Definition (Post-Fixes)

After applying immediate fixes (Section 6) the “Baseline v1 Alpha” should be:
- mergePacks wrapper accepted but **not** leaked past pipeline boundary.
- validateMerged operates on plain merged object.
- Overlays render without runtime TypeErrors.
- Issues panel reflects genuine validation results (detect duplicates if they exist).
- packs.merge.ms recorded for each merge.

This becomes the *new* starting point for the roadmap.

---

## 12. Short-Term Task Timeline (Rebooted)

Day | Task | Artifact
----|------|---------
D0 | Destructure + unwrap fix, validation realigned | index.js, validateMerged.js
D1 | Remove dead merge helpers OR isolate behind flag | mergePacks.js
D2 | Deep palette merge + anchor provenance tagging | mergePacks.js
D3 | External pack ordering (Promise.all + sorted layering) | mergePacks.js + externalPackLoader.js
D4 | Single checksum pass refactor | mergePacks.js + checksum util
D5 | Determinism test harness (run merge twice diff) | scripts/tests
D6 | Docs update (Roadmap Wave 1 status refreshed) | ROADMAP_CONSOLIDATED.md

---

## 13. Suggested Acceptance Re-Baselining (Wave 1 Only)

Criterion | Minimal Pass Definition
----------|------------------------
Deterministic Merge | Two sequential merges → identical JSON stableStringify
Palette Preservation | Adding new token does not remove unrelated tokens
External Pack Determinism | Adding an external pack produces same snapshot across reloads (no fetch race difference)
Validation Efficacy | Introduce deliberate duplicate overlay id → error appears once
Redundant Override Accuracy | Introduce override identical to baseline → exactly one warning

---

## 14. Updated Issue Code Priorities

Immediate (Wave 1):
- pack.removal.unknown
- pack.override.redundant
- pack.item.duplicate
- pack.palette.merge.error
- pack.external.load_failed

Deferred:
- anchor.missing
- rules.* (until rules engine arrives)
- anim.* (until registry introduced)

---

## 15. Summary / Recommended Path

You have effectively rolled back to a pre-integration checkpoint. Treat this as a stabilization sprint:

1. Fix wrapper misuse to restore end-to-end validity.
2. Strip out prototype merge traces & consolidate provenance + checksum logic.
3. Implement deep palette & anchor provenance to complete Wave 1 functional scope.
4. Only then move forward to rules/value_map/animations to avoid building on unstable foundations.

This resets the working assumption so that future documentation and code snapshots align again.

---

## 16. Quick To-Do Checklist (Actionable)

[ ] Fix initMsdPipeline destructure
[ ] Add defensive unwrap in validateMerged (remove later)
[ ] Remove or flag obsolete merge helpers (layerKeyed, markProvenance double-pass)
[ ] Implement deep palette merge
[ ] Add anchor provenance map (provenance.anchors)
[ ] Integrate external pack actual fetching & deterministic order
[ ] Single checksum computation after all merges (strip meta first)
[ ] Determinism test script (merge → hash → merge again → compare)
[ ] Update ROADMAP_CONSOLIDATED Wave 1 status & Deviation Log
[ ] Commit baseline tag: msd-wave1-baseline-realigned

---

## 17. Request for Confirmation

After you apply the immediate fixes, let me know if you’d like:
- Patch-ready full file replacements
- Determinism test harness skeleton
- Deep palette merge utility implementation
- Anchor provenance design snippet

I can generate any of those next.

---

## 18. Next Steps Approved (Action Sequence)

1. Destructure mergePacks wrapper at pipeline init; pass merged root downstream.
2. Add defensive unwrap in validateMerged (temporary; remove after callers fixed).
3. Refactor mergePacks: single algorithm, deep palette merge, anchor provenance.
4. Integrate external pack loader (deterministic order).
5. Single checksum pass (post-final shape).
6. Implement perf counters with averaging.
7. Add deterministic merge + parity test scripts.
8. Implement exportCollapsed canonical + parity assertion.
9. Tag baseline msd-wave1-refactor-complete; proceed to RulesEngine skeleton (Wave 2).

Tracking Keys:
- Feature Flags: msd.packs.v1_enabled, msd.external.enabled (ensure true for tests).
- Perf Counters (initial): packs.merge.ms, packs.items.total, packs.items.overridden, packs.items.redundant.

Removal Plan:
- Delete legacy merge helpers after 3 green determinism runs.

(End Next Steps)