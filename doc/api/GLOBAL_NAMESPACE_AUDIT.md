# Global Namespace Pollution Audit

**Date:** October 30, 2025
**Status:** 🚧 Needs Cleanup
**Scope:** Phase 4.5 - Global Namespace Consolidation

---

## Executive Summary

CB-LCARS is currently exposing **14 global variables** under `window.__*` and `window._*` prefixes. These should be migrated to the unified `window.cblcars.*` namespace structure to:

1. **Reduce namespace pollution**
2. **Improve API discoverability**
3. **Maintain consistency with Phase 4 API standardization**
4. **Enable better deprecation management**

---

## Current Global Exports

### Category 1: HUD/Debug Functions (Should be in API)

| Global Variable | File | Purpose | Proposed Location |
|----------------|------|---------|-------------------|
| `window.__msdHudBus` | MsdHudManager.js:36 | HUD event bus trigger | `cblcars.debug.msd.hud.emit()` |
| `window.__msdHudPanelControls` | MsdHudManager.js:124 | Panel control API | `cblcars.debug.msd.hud.panels.*` |
| `window.__msdAnalyzeRoute` | RoutingPanel.js:30 | Analyze specific route | `cblcars.debug.msd.routing.analyze()` |
| `window.__msdInspectDataEntity` | DataSourcePanel.js:19 | Inspect entity | `cblcars.debug.msd.data.inspectEntity()` |
| `window.__msdInspectDataSubscription` | DataSourcePanel.js:51 | Inspect subscription | `cblcars.debug.msd.data.inspectSubscription()` |
| `window.__msdRefreshDataSources` | DataSourcePanel.js:85 | Refresh data | `cblcars.debug.msd.data.refresh()` |

### Category 2: Instance Management (Should be in API)

| Global Variable | File | Purpose | Proposed Location |
|----------------|------|---------|-------------------|
| `window.__msdForceReplace` | MsdInstanceManager.js:1098 | Force instance replacement | `cblcars.debug.msd.pipeline.forceReplace()` |
| `window.__msdStatus` | MsdInstanceManager.js:1116 | Get instance status | `cblcars.debug.msd.pipeline.status()` ✅ Already exists! |
| `window.__msdInspectGuid` | MsdInstanceManager.js:1135 | Inspect instance GUID | `cblcars.debug.msd.pipeline.inspectGuid()` |

### Category 3: Internal Implementation (Keep Private)

| Global Variable | File | Purpose | Action |
|----------------|------|---------|--------|
| `window.__msdTemplateEngine` | MsdTemplateEngine.js:23 | Template engine instance | Move to `cblcars._internal.templateEngine` |
| `window.__msdTemplateEngine` | DataSourceMixin.js:441 | (duplicate) | Same as above |
| `window.__templateProcessor` | TemplateProcessor.js:367 | Template processor class | Move to `cblcars._internal.templateProcessor` |
| `window._msdControlsRenderer` | MsdControlsRenderer.js:18 | Controls renderer instance | Move to `cblcars._internal.controlsRenderer` |
| `window._msdCardInstance` | StatusGridRenderer.js:2112 | Card instance ref | Move to `cblcars._internal.cardInstance` |
| `window._msdStatusGridActions` | StatusGridRenderer.js:2586 | Action registry | Move to `cblcars._internal.statusGridActions` |

---

## Duplication Issues

### 🚨 `pipeline.status()` Already Exists!

**Problem:** We have both:
- ✅ `window.cblcars.debug.msd.pipeline.status()` (Phase 4 API)
- ❌ `window.__msdStatus()` (Legacy global)

**Solution:** Deprecate `window.__msdStatus` and point users to the modern API.

---

## Migration Plan - Phase 4.5

### Step 1: Add Missing Methods to Debug API

**New methods to add:**

```javascript
// HUD namespace extensions
cblcars.debug.msd.hud.emit(event, payload)  // from __msdHudBus
cblcars.debug.msd.hud.panels.list()         // from __msdHudPanelControls
cblcars.debug.msd.hud.panels.toggle(id)     // from __msdHudPanelControls.togglePanel

// Routing namespace extensions
cblcars.debug.msd.routing.analyze(routeId)  // from __msdAnalyzeRoute

// Data namespace extensions
cblcars.debug.msd.data.inspectEntity(entityId)           // from __msdInspectDataEntity
cblcars.debug.msd.data.inspectSubscription(sourceName)  // from __msdInspectDataSubscription
cblcars.debug.msd.data.refresh()                         // from __msdRefreshDataSources

// Pipeline namespace extensions
cblcars.debug.msd.pipeline.forceReplace()   // from __msdForceReplace
cblcars.debug.msd.pipeline.inspectGuid()    // from __msdInspectGuid
// pipeline.status() already exists ✅
```

### Step 2: Move Internal Exports

**Create `cblcars._internal` namespace:**

```javascript
cblcars._internal = {
  templateEngine: null,      // from __msdTemplateEngine
  templateProcessor: null,   // from __templateProcessor
  controlsRenderer: null,    // from _msdControlsRenderer
  cardInstance: null,        // from _msdCardInstance
  statusGridActions: null    // from _msdStatusGridActions
};
```

### Step 3: Add Deprecation Wrappers

Keep old globals working with deprecation warnings:

```javascript
// In DebugInterface.js or similar
Object.defineProperty(window, '__msdStatus', {
  get() {
    console.warn('[CB-LCARS] window.__msdStatus is deprecated - use window.cblcars.debug.msd.pipeline.status() instead');
    return window.cblcars.debug.msd.pipeline.status;
  }
});

Object.defineProperty(window, '__msdHudBus', {
  get() {
    console.warn('[CB-LCARS] window.__msdHudBus is deprecated - use window.cblcars.debug.msd.hud.emit() instead');
    return window.cblcars.debug.msd.hud.emit;
  }
});

// ... etc for all 14 globals
```

### Step 4: Update Source Files

Update each source file to export to the new namespace and set up the deprecation wrapper.

---

## Implementation Priority

### 🟢 Priority 1: User-Facing Debug Functions (High Value)

Should be in the debug API - users actively use these:

1. ✅ `__msdStatus` → `pipeline.status()` *(already exists!)*
2. `__msdForceReplace` → `pipeline.forceReplace()`
3. `__msdInspectGuid` → `pipeline.inspectGuid()`
4. `__msdAnalyzeRoute` → `routing.analyze()`
5. `__msdRefreshDataSources` → `data.refresh()`

**Effort:** ~2-3 hours
**Value:** High - These are actively used debug tools

### 🟡 Priority 2: HUD Panel Functions (Medium Value)

Less commonly used but should be standardized:

6. `__msdHudBus` → `hud.emit()`
7. `__msdHudPanelControls` → `hud.panels.*`
8. `__msdInspectDataEntity` → `data.inspectEntity()`
9. `__msdInspectDataSubscription` → `data.inspectSubscription()`

**Effort:** ~2 hours
**Value:** Medium - Used occasionally for debugging

### 🔴 Priority 3: Internal References (Low Priority)

Keep these private but move to `_internal`:

10. `__msdTemplateEngine` → `_internal.templateEngine`
11. `__templateProcessor` → `_internal.templateProcessor`
12. `_msdControlsRenderer` → `_internal.controlsRenderer`
13. `_msdCardInstance` → `_internal.cardInstance`
14. `_msdStatusGridActions` → `_internal.statusGridActions`

**Effort:** ~1 hour
**Value:** Low - Internal only, rarely accessed

---

## Estimated Effort

| Phase | Tasks | Effort | Risk |
|-------|-------|--------|------|
| **Phase 4.5a** | Priority 1 methods (5 methods) | 2-3 hrs | Low |
| **Phase 4.5b** | Priority 2 methods (4 methods) | 2 hrs | Low |
| **Phase 4.5c** | Priority 3 internal refs (5 refs) | 1 hr | Very Low |
| **Testing** | Verify all methods, test deprecations | 1 hr | Low |
| **Documentation** | Update API reference | 30 min | Low |
| **TOTAL** | | **6-7 hours** | |

---

## Benefits

### Before (Current State)

```javascript
// Inconsistent, hard to discover
window.__msdStatus();
window.__msdForceReplace();
window.__msdAnalyzeRoute('route-1');
window.__msdRefreshDataSources();
window.__msdInspectGuid();

// vs

window.cblcars.debug.msd.perf.stats();
window.cblcars.debug.msd.routing.inspect();
```

### After (Proposed State)

```javascript
// Consistent, discoverable, organized
const msd = window.cblcars.debug.msd;

msd.pipeline.status();
msd.pipeline.forceReplace();
msd.pipeline.inspectGuid();

msd.routing.analyze('route-1');
msd.routing.inspect();

msd.data.refresh();
msd.data.inspectEntity('sensor.temp');
```

---

## Risks & Mitigation

### Risk 1: Breaking Existing User Scripts

**Mitigation:**
- Keep old globals working with deprecation warnings
- Document migration path clearly
- Provide 6-12 month deprecation period

### Risk 2: Increased API Surface Area

**Mitigation:**
- Only expose genuinely useful debug methods
- Keep internal tools in `_internal` namespace
- Document each method with examples

### Risk 3: Testing Burden

**Mitigation:**
- Reuse existing functionality (just re-export)
- Add to existing `audit()` checks
- Minimal new code = minimal new bugs

---

## Recommendation

### Option A: Do Phase 4.5a Now (Recommended)

**Implement Priority 1 methods (2-3 hours)**

Add the 5 most useful methods to the debug API:
- `pipeline.forceReplace()`
- `pipeline.inspectGuid()`
- `routing.analyze()`
- `data.refresh()`
- Deprecate `__msdStatus` (already have `pipeline.status()`)

**Why:**
- These are actively used debug tools
- Low effort, high value
- Completes the most important parts of Phase 4
- Users get immediate benefit

### Option B: Do All of Phase 4.5 (6-7 hours)

Complete namespace consolidation with all 14 globals migrated.

**Why:**
- Fully consistent namespace
- Zero pollution
- Complete API

### Option C: Skip Phase 4.5 for Now

Keep current globals as-is, revisit later.

**Why:**
- Focus on other features
- Globals work fine as-is
- Not critical for functionality

---

## My Recommendation: **Option A** ✅

**Do Phase 4.5a now (2-3 hours):**
- Add 5 Priority 1 methods
- Set up deprecation warnings
- Update documentation
- Ship it!

**Benefits:**
- Completes the "must have" debug API
- Clean up most visible namespace pollution
- Minimal effort for good ROI
- Can do Priority 2-3 later if needed

---

## Next Steps

If you want to proceed with Phase 4.5a:

1. **Create Phase 4.5a task list**
2. **Add 5 new methods to MsdDebugAPI.js**
3. **Set up deprecation wrappers**
4. **Update API_REFERENCE.md**
5. **Build & test**
6. **Ship! 🚀**

---

**Decision needed:** Should we do Phase 4.5a now, or defer this cleanup?
