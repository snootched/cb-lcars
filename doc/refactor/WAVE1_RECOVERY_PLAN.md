# Wave 1 Recovery Plan (Focused Checklist)

Purpose: Tactical re-alignment after branch revert. Finish foundational pack/provenance layer before advancing to Rules (Wave 2).

## Task List (Ordered)

| Order | Task | Output | Status |
|-------|------|--------|--------|
| 1 | init unwrap fix | Plain merged config to CardModel & validateMerged | ✅ |
| 2 | validateMerged unwrap guard | Accept wrapper or flat | ✅ *(transitional)* |
| 3 | Remove legacy merge helpers | Single code path | ✅ |
| 4 | Deep palette token merge | palettes merged deterministically | ✅ |
| 5 | Anchor provenance | provenance.anchors entries | ✅ |
| 6 | External pack integration | Deterministic layering (sorted URLs) | ✅ |
| 7 | Single checksum pass | All items have 10-hex checksum | ✅ |
| 8 | Validation expansion | Duplicate / unknown removal / anchor missing | ✅ *(anchor.missing added at Wave 2 kickoff)* |
| 9 | Perf counters upgrade | packs.merge.ms avg visible | ✅ |
|10 | Determinism test | merge twice => identical hash | ✅ |
|11 | Redundant override precision | Exactly one warning per redundant id | ✅ |
|12 | exportCollapsed canonical | Sorted keys, meta stripped | ☐ |
|13 | Parity test | Collapsed re-import matches checksums | ✅ |
|14 | Tag baseline | msd-wave1-refactor-complete | ☐ |

## Acceptance Gates

Gate A (Stability):
- No CardModel init exceptions.
- Validation sees injected duplicate ID.

Gate B (Determinism & Provenance):
- Checksums stable across 3 runs.
- Overridden & removed flags accurate on sample config.

Gate C (Export Parity):
- Collapsed export round-trips with identical per-item checksums.

After Gate C → Begin Wave 2 (RulesEngine skeleton).

## Notes

- Keep merge return shape stable (plain merged) to simplify pipeline; expose provenance via debug (window.__msdDebug._provenance).
- Retain wrapper compatibility only in transitional code with console.info once; remove after Gate B.

## Recommended Additional Headless Tests (Before Tag)
| ID | Purpose | Status |
|----|---------|--------|
| HX1 | anchor.missing error (overlay references absent anchor) | Pending (needs validateMerged update) |
| HX2 | global removal unknown emits single warn | Covered indirectly; add explicit fixture (optional) |
| HX3 | palette null token removal (value null deletes token) | Optional (add if feature retained) |
| HX4 | external failure (simulate fetch reject) → pack.external.load_failed | Optional |
| HX5 | provenance flags consistency (overridden vs removed) snapshot | Optional |
| HX6 | perf counter samples increment (≥2 merges) | Optional |

## Next Steps (Execution Order)
1. Implement anchor.missing in validateMerged + add HX1 test.
2. (Optional) Add HX2–HX6 if stricter regression safety desired.
3. Implement canonical exportCollapsed (stable ordered keys, omit empties) → mark Task 12.
4. Re-run suite (include new HX1) 3 consecutive passes → tag msd-wave1-refactor-complete (Task 14).
5. Start Wave 2 (rules dependency index + eval/match counters).

After HX1 + Task 12 complete you can safely proceed to Wave 2 if time-boxed; remaining optional tests can slip.

(End Plan)
