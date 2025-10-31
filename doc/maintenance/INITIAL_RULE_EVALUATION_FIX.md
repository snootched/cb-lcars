# Initial Rule Evaluation Fix - Status Grid Cells

## Problem Summary

**Issue**: Rules that modify overlay styles (e.g., status grid cells) were not applying on initial page load. The overlays would use their default styles until Home Assistant entity states changed, then rules would apply correctly on subsequent updates.

**Symptom**:
- Default blue cell colors shown on first load
- Rules correctly apply gray (light off) or yellow (light on) only AFTER toggling the light
- Subsequent toggles work perfectly

## Root Cause

The issue was a **timing/ordering problem** in the `ModelBuilder.computeResolvedModel()` method:

### Original Flow (BROKEN):

```javascript
computeResolvedModel() {
  1. const baseOverlays = this._assembleBaseOverlays();
  2. const ruleResult = this._applyRules();         // Calls rulesEngine.evaluateDirty()
  3. // ... more processing ...
  4. this._resolvedModelRef = resolved;            // Set at END
  5. return resolved;
}
```

### The Problem:

When `_applyRules()` called `rulesEngine.evaluateDirty()`, the rules engine tried to resolve overlay selectors by calling:

```javascript
// In RulesEngine._resolveOverlaySelectors()
const allOverlays = this.systemsManager?.modelBuilder?.getResolvedModel?.()?.overlays || [];
```

But `getResolvedModel()` returns `this._resolvedModelRef`, which is **`null`** on first load because it's only set at the **end** of `computeResolvedModel()`!

### Result:
- **First load**: No overlays available → selectors return empty array → 0 patches generated → default styles used
- **Subsequent updates**: `_resolvedModelRef` exists from previous render → selectors work → patches applied correctly

## Solution

**Pass overlays directly to the rules engine during evaluation**, bypassing the need for `getResolvedModel()`.

### Changes Made:

**1. ModelBuilder.js - Pass baseOverlays to _applyRules()**

```javascript
// OLD:
const ruleResult = this._applyRules();

// NEW:
const ruleResult = this._applyRules(baseOverlays);
```

```javascript
// OLD:
_applyRules() {
  const ruleResult = this.systems.rulesEngine.evaluateDirty({ getEntity });

// NEW:
_applyRules(baseOverlays) {
  const ruleResult = this.systems.rulesEngine.evaluateDirty({
    getEntity,
    overlays: baseOverlays  // 👈 Pass overlays directly
  });
```

**2. RulesEngine.js - Accept and use overlays from context**

```javascript
// OLD:
evaluateDirty(context = {}) {
  let { getEntity } = context;

// NEW:
evaluateDirty(context = {}) {
  let { getEntity, overlays } = context;

  // Store overlays for selector resolution if provided
  if (overlays) {
    this._currentOverlays = overlays;
  }
```

**3. RulesEngine.js - Use context overlays in _resolveOverlaySelectors()**

```javascript
// OLD:
const allOverlays = this.systemsManager?.modelBuilder?.getResolvedModel?.()?.overlays || [];

// NEW:
const allOverlays = this._currentOverlays ||
                    this.systemsManager?.modelBuilder?.getResolvedModel?.()?.overlays ||
                    [];
```

**4. RulesEngine.js - Clear context after evaluation**

```javascript
// At end of evaluateDirty():
this._currentOverlays = null;  // Prevent stale data
return this.aggregateResults(results);
```

## How It Works Now

### Fixed Flow:

```
ModelBuilder.computeResolvedModel()
├─ 1. assembleBaseOverlays() → baseOverlays[]
├─ 2. _applyRules(baseOverlays)
│  └─ rulesEngine.evaluateDirty({ getEntity, overlays: baseOverlays })
│     ├─ Store: this._currentOverlays = baseOverlays
│     ├─ evaluateRule() for each dirty rule
│     │  └─ _resolveOverlaySelectors()
│     │     └─ Use: this._currentOverlays (available!)
│     └─ Clear: this._currentOverlays = null
├─ 3. _applyOverlayPatches(baseOverlays, ruleResult)
├─ 4. ... more processing ...
└─ 5. this._resolvedModelRef = resolved
```

### Key Benefits:

✅ **First Load**: Rules can access overlays immediately via `_currentOverlays`
✅ **Subsequent Updates**: Falls back to `getResolvedModel()` if no context overlays provided
✅ **No Breaking Changes**: SystemsManager can still call `evaluateDirty()` without overlays parameter
✅ **Clean State**: `_currentOverlays` cleared after each evaluation to prevent stale data

## Testing

**Expected Behavior After Fix:**

1. **Initial Page Load**:
   - Status grid cells immediately show correct colors based on entity states
   - Light OFF → Gray cell
   - Light ON → Yellow cell

2. **Entity State Changes**:
   - Toggle light OFF → Cell updates to gray
   - Toggle light ON → Cell updates to yellow
   - No delay, no "flash" of default colors

3. **Console Logs** (debug mode):
   ```
   [RulesEngine] Resolving selectors with 19 overlays (source: context)  ← First load
   [RulesEngine] Resolving selectors with 19 overlays (source: modelBuilder)  ← Subsequent
   ```

## Impact Analysis

**Files Modified:**
- `/src/msd/pipeline/ModelBuilder.js` - Pass overlays to rules engine
- `/src/msd/rules/RulesEngine.js` - Accept and use context overlays

**Affected Systems:**
- ✅ Status Grids - **PRIMARY FIX** (initial cell styling now works)
- ✅ All Overlays - Rules apply correctly on first load
- ✅ Bulk Selectors - Pattern/type/tag selectors work on initial render
- ✅ Conditional Visibility - Visibility rules apply immediately on load

**Backward Compatibility:**
- ✅ `overlays` parameter is optional in `evaluateDirty()` context
- ✅ SystemsManager can still call without overlays (falls back to `getResolvedModel()`)
- ✅ No changes to rule configuration format
- ✅ No changes to public APIs

## Related Systems

This fix complements the recent implementations:

- **Conditional Visibility** (2025-10-27): Visibility rules now apply on first load
- **Bulk Overlay Selectors** (earlier): Pattern/type/tag selectors work immediately
- **Cell-Level Tags** (earlier): Tag-based selectors resolve correctly on initial render

## Technical Notes

**Why Not Always Use getResolvedModel()?**

The `_resolvedModelRef` pattern exists for good reasons:
- Provides stable reference for routing system
- Caches resolved model for performance
- Allows external systems to access last computed state

The fix maintains this pattern while adding a **temporary context overlay** mechanism for the critical evaluation-during-build phase.

**Alternative Approaches Considered:**

1. ❌ **Set `_resolvedModelRef` earlier** - Would require partial model, breaks assumptions
2. ❌ **Two-pass evaluation** - Performance overhead, complexity
3. ✅ **Context-based overlay injection** - Clean, performant, backward compatible

## Version Information

- **Fixed In**: v2025.10.1-fuk.05-70 (or next version after this fix)
- **Related Issues**: Initial status grid cell styling
- **Priority**: High (affects user experience on every page load)
- **Breaking Changes**: None

---

*This fix ensures rules apply consistently on initial page load and subsequent updates, providing a seamless user experience for dynamically styled overlays.*
