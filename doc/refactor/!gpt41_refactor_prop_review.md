Thank you for the clarifications! Here’s my detailed assessment and recommendations, grounded in your roadmap and current project status:

---

## 1. **Codebase Parity & Organization**

- **Current Parity:** You estimate 50-75% feature parity between the legacy (`src/utils`) and new (`src/msd`) code. Most tests and new logic run solely against the new code.
- **Legacy Usage:** Old code is only used for comparison, not user-facing runtime. This is ideal for a clean cutover.
- **Schema:** The migration tool is unnecessary since the new YAML schema is being adopted from the start for unreleased features.

**Assessment:**
- You’re on the right track by focusing all new development and integration on the `src/msd` path.
- However, the “divergence” between old and new code is causing instability and regressions due to partial migrations and possibly incomplete abstraction boundaries.

---

## 2. **Roadmap Alignment vs Code Reality**

### **Phase 1 (Wave 1 Stabilization & Foundation)**

- **Merge Logic:** Ensure _all_ legacy merge logic is deleted. Confirm only one deterministic merge algorithm exists in `src/msd`.
  - **Risk:** If any legacy helpers are still imported, regressions can occur. Do a search for any usage/import of `layerKeyed`, old `markProvenance`, or other prototype helpers.
- **Checksum Pipeline:** Implement the canonical checksum as described in the roadmap. All meta fields must be stripped before checksumming. Tests must run at least 100 iterations for determinism.
- **Validation:** All validation should run on clean merged configs. If any validation still runs on pre-merge objects, update to match the new pipeline.

**Action:**
- Run a semantic search for imports/usages of legacy merge helpers in the codebase. Remove them and ensure all merge logic is centralized in `src/msd`.

---

### **Phase 1.2 & 1.3 (Deep Merge, Provenance, Performance)**

- **Palette/Anchor Merge:** All merging must be token-level, with provenance attached. Palette tokens should never overwrite entire palettes.
- **Performance Counters:** Check for usage of new `PerformanceTracker` in key merge and rules engine flows.
- **Export Parity:** Export → re-import must produce the same semantic config, minus meta fields. Ensure `exportCollapsed` is implemented and tested.
- **Validation Expansion:** Duplicate ID and missing anchor validation must run every merge.

**Action:**
- Audit palette and anchor merging functions to confirm they match the roadmap.
- Confirm provenance structure is complete and attached at all override points.

---

### **Phase 2+ (Rules Engine, Animations, Profiles)**

- **Rules Engine:** Only changed entities should trigger rule re-evaluation (“dirty” evaluation). Dependency index must cover all references.
- **Animations:** All animation instantiation/caching must use anime.js v4 conventions, not v3. Hashing should exclude DOM references and runtime callbacks.
- **Profiles/Styles:** Profile layering should merge in order, with precedence for active profiles.

**Action:**
- Review all anime.js usage for v4 compliance. Ensure `targets` are passed as a separate param and not inside option objects.
- Audit animation registry for hash-based instance reuse logic.

---

## 3. **Primary Risks and Recommendations**

### **Key Risks**
- **Partial Migration:** Old helpers or merge logic leaking into new path.
- **Feature Divergence:** New features being implemented before parity is reached, causing inconsistent behavior.
- **Testing Gaps:** Not all roadmap success criteria are enforced in CI.

### **Recommendations**

**A. Lock Down Milestone Waves**
- **Do not implement new features or significant refactors until the current milestone’s code passes all associated tests and success criteria.**
  This prevents “too much at once” changes and regression risk.

**B. Strict Code Boundary Enforcement**
- Audit imports and usage across all files.
  Only allow dependency on `src/msd` for any runtime functionality.
  Legacy code should only be used in test comparisons, never in runtime.

**C. Roadmap Success Criteria as CI Gates**
- Translate every milestone’s “Success Criteria” into explicit CI test requirements.
  CI must fail if any are not met (e.g., determinism, validation, provenance completeness, animation reuse rates, etc.).

**D. Incremental Refactor & Test-Driven Development**
- For each wave, finish only the code, tests, and documentation needed for that wave.
  Run full regression tests before moving to the next wave.

**E. Documentation and Internal Change Logs**
- Document all breaking changes, especially schema and function signatures.
  Even with no external users, it helps future onboarding and migration.

---

## 4. **Immediate Action Items**

1. **Run code search for legacy merge helpers and imports.**
2. **Verify every test script in `scripts/` directory matches the deliverables/success criteria in the roadmap.**
3. **Lock the `src/msd` API boundary—no legacy code in runtime.**
4. **Ensure anime.js usage matches v4 (targets as param, no `direction`, etc.).**
5. **Complete parity for palette and anchor merge with provenance.**
6. **Enforce “only changed entities” evaluation in rules engine.**
7. **Update CI to fail if any milestone success criteria are not met.**

---

## 5. **Offer for Deeper Audit**

If you want, I can run semantic code searches for each critical function (“merge logic,” “palette merge,” “animation registry,” etc.) and provide a gap analysis for each roadmap deliverable, with pointers to code needing update.

---

**Summary:**
You have a solid roadmap and are executing well. The main risk is partial migration/divergence. By strictly enforcing milestone sequencing, locking code boundaries, and using your roadmap’s success criteria as CI gates, you’ll minimize regressions and build a robust foundation for future growth.

Let me know if you want a “code search gap analysis” for specific functions or modules!