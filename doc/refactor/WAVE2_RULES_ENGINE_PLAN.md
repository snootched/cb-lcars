# Wave 2 Plan – Rules Engine Visibility & Incremental Optimization

Status: INIT

## 1. Objectives
- Observable rule evaluation (eval + match counters).
- Dependency index (entityId → Set(ruleId)) groundwork for dirty evaluation.
- Anchor.missing validation (Wave 1 gap) integrated at pipeline init (DONE).
- Prepare for stop semantics & trace ring buffer.

## 2. In-Scope
1. Dependency index construction.
2. Counters: rules.eval.count, rules.match.count.
3. Wrapper instrumentation of evaluateDirty.
4. Trace ring buffer placeholder.
5. HUD perf exposure via existing perf store.
6. Tests (anchor missing hard assert, rules counters).

Out-of-Scope (later waves): selective dirty re-eval, complex condition types, stop semantics enforcement, full trace HUD panel.

## 3. Data Structures
```
depIndex: Map<entityId, Set<ruleId>>
perfStore.counters:
  rules.eval.count
  rules.match.count
traceRing: Array<{ id, ts, matched }>
```

## 4. Phases
| Phase | Task | Output |
|-------|------|--------|
| P1 | Instrument evaluateDirty wrapper | Counters populate |
| P2 | Build depIndex at init | depIndex accessible (debug) |
| P3 | Trace ring stub | dbg.rules.trace() returns recent entries |
| P4 | Test wave2 suite | Green run |
| P5 | HUD surfacing follow-up | Perf panel displays counts |

## 5. Tests
| Test | Purpose |
|------|---------|
| testAnchorMissingWave2 | anchor.missing errors emitted |
| testRulesCounters | rules.eval.count increments |

## 6. Acceptance (Wave 2)
- rules.eval.count >= rule count after first evaluation.
- rules.match.count present (≥0).
- anchor.missing emitted for invalid references.
- All Wave 1 suites remain deterministic.

## 7. Next (Wave 3 Bridge)
- Selective dirty re-eval using depIndex.
- value_map centralized resolution.
- stop semantics enforcement.

(End)
