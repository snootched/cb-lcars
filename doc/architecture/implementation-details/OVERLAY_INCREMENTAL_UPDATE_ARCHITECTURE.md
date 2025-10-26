# Overlay Incremental Update Architecture

**Date:** 2025-10-24
**Version:** v2025.10.1-fuk.10-69
**Purpose:** Define consistent architecture for incremental overlay updates across all types

---

## 🏗️ Architecture Overview

### Design Principles

1. **Capability-Based, Not Inheritance** - Overlays declare capabilities via static methods
2. **Unified Router** - SystemsManager routes updates through single decision point
3. **Clear Logging** - Every overlay logs which path it took (incremental vs full)
4. **Graceful Degradation** - Falls back to full re-render if incremental not available
5. **Future-Proof** - New overlay types automatically supported with minimal code

---

## 🎯 Capability Pattern

Each overlay renderer declares these **static capabilities**:

```javascript
class SomeOverlayRenderer {
  /**
   * Check if this renderer supports incremental updates
   * @static
   * @returns {boolean}
   */
  static supportsIncrementalUpdate() {
    return true; // or false
  }

  /**
   * Perform incremental update on existing overlay
   * @static
   * @param {Object} overlay - Overlay configuration with rule patches
   * @param {SVGElement|HTMLElement} overlayElement - Existing DOM element
   * @param {Object} context - Update context (dataSourceManager, etc.)
   * @returns {boolean} True if update succeeded
   */
  static updateIncremental(overlay, overlayElement, context) {
    // Implementation specific to overlay type
    // Return false to trigger fallback to full re-render
  }
}
```

---

## 🔄 Update Flow

### SystemsManager Decision Tree

```
Entity Change Detected
  ↓
Rules Evaluated
  ↓
Rule Patches Generated?
  ├─ NO → Use BaseOverlayUpdater (content-only)
  └─ YES → Route to Incremental Update System
      ↓
      For Each Affected Overlay:
        ↓
        Get Renderer for overlay.type
        ↓
        Check: supportsIncrementalUpdate()?
          ├─ NO → _scheduleFullReRender()
          └─ YES → Try incremental update
              ↓
              Find overlay DOM element
                ├─ NOT FOUND → _scheduleFullReRender()
                └─ FOUND → Call updateIncremental()
                    ↓
                    Success?
                      ├─ NO → _scheduleFullReRender()
                      └─ YES → Log success, continue
```

---

## 📋 Renderer Registry

### Centralized Overlay Type Mapping

**Location:** `SystemsManager.js`

```javascript
constructor() {
  // ... existing code ...

  // Overlay renderer registry
  this._overlayRenderers = new Map([
    ['statusgrid', StatusGridRenderer],
    ['status_grid', StatusGridRenderer],
    ['apexchart', ApexChartsOverlayRenderer],
    ['text', TextOverlayRenderer],
    ['button', ButtonOverlayRenderer],
    ['history_bar', HistoryBarRenderer],
    // Add more as needed
  ]);
}

_getRendererForType(type) {
  return this._overlayRenderers.get(type) || null;
}
```

---

## 🎨 Implementation by Overlay Type

### StatusGrid (Phase 1 - Immediate)

**Status:** ✅ Has incremental update method (`updateGridData`)

**Capability:**
```javascript
// StatusGridRenderer.js
static supportsIncrementalUpdate() {
  return true;
}

static updateIncremental(overlay, gridElement, context) {
  cblcarsLog.info(`[StatusGridRenderer] 🎨 Incremental update: ${overlay.id}`);

  const updated = this.updateGridData(
    overlay,
    gridElement,
    context.dataSourceManager
  );

  if (updated) {
    cblcarsLog.info(`[StatusGridRenderer] ✅ Incremental update SUCCESS: ${overlay.id}`);
  } else {
    cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Incremental update no-op: ${overlay.id}`);
  }

  return updated;
}
```

---

### ApexCharts (Phase 2 - Future)

**Status:** ⏳ Needs incremental update method

**Capability:**
```javascript
// ApexChartsOverlayRenderer.js (future)
static supportsIncrementalUpdate() {
  return true; // Once implemented
}

static updateIncremental(overlay, chartContainer, context) {
  cblcarsLog.info(`[ApexChartsOverlayRenderer] 🎨 Incremental update: ${overlay.id}`);

  const chart = this._getChartInstance(overlay.id);
  if (!chart) return false;

  // Apply rule patches to chart options
  const updatedOptions = this._applyRulePatches(
    overlay._rulePatch,
    chart.opts
  );

  // Use ApexCharts' native update (smooth, no rebuild)
  chart.updateOptions(updatedOptions, false, true);

  cblcarsLog.info(`[ApexChartsOverlayRenderer] ✅ Incremental update SUCCESS: ${overlay.id}`);
  return true;
}
```

---

### Text/Button/Other (Phase 3 - Future)

**Status:** ⏳ May not need incremental (use BaseOverlayUpdater)

**Capability:**
```javascript
// TextOverlayRenderer.js
static supportsIncrementalUpdate() {
  return false; // Content updates handled by BaseOverlayUpdater
}

// No updateIncremental method needed
// Falls back to full re-render for rule-based style changes
```

---

## 🚦 SystemsManager Integration

### New Method: _applyIncrementalUpdates

**Location:** `SystemsManager.js` (new method)

```javascript
/**
 * Apply incremental updates to overlays when rules produce patches
 * Falls back to full re-render if incremental not supported/available
 * @private
 * @param {Array} overlayPatches - Rule patches from rulesEngine.evaluateDirty()
 * @returns {boolean} True if all updates succeeded incrementally
 */
_applyIncrementalUpdates(overlayPatches) {
  cblcarsLog.info(`[SystemsManager] 🎨 Attempting incremental updates for ${overlayPatches.length} overlays`);

  let allSucceeded = true;
  const failedOverlays = [];

  overlayPatches.forEach(patch => {
    // Find overlay config (should already have _rulePatch applied)
    const overlay = this._findOverlayById(patch.id);
    if (!overlay) {
      cblcarsLog.warn(`[SystemsManager] ⚠️ Overlay not found: ${patch.id}`);
      failedOverlays.push(patch.id);
      allSucceeded = false;
      return;
    }

    // Get renderer for this overlay type
    const RendererClass = this._getRendererForType(overlay.type);
    if (!RendererClass) {
      cblcarsLog.warn(`[SystemsManager] ⚠️ No renderer for type: ${overlay.type}`);
      failedOverlays.push(patch.id);
      allSucceeded = false;
      return;
    }

    // Check if renderer supports incremental updates
    if (!RendererClass.supportsIncrementalUpdate || !RendererClass.supportsIncrementalUpdate()) {
      cblcarsLog.info(`[SystemsManager] ℹ️ ${overlay.type} renderer does not support incremental - will full re-render: ${overlay.id}`);
      failedOverlays.push(patch.id);
      allSucceeded = false;
      return;
    }

    // Find existing overlay DOM element
    const overlayElement = this._findOverlayElement(overlay);
    if (!overlayElement) {
      cblcarsLog.warn(`[SystemsManager] ⚠️ Overlay element not found in DOM: ${overlay.id} - will full re-render`);
      failedOverlays.push(patch.id);
      allSucceeded = false;
      return;
    }

    // Attempt incremental update
    try {
      const context = {
        dataSourceManager: this.dataSourceManager,
        systemsManager: this,
        hass: this._hass
      };

      const succeeded = RendererClass.updateIncremental(overlay, overlayElement, context);

      if (!succeeded) {
        cblcarsLog.warn(`[SystemsManager] ⚠️ Incremental update returned false: ${overlay.id} - will full re-render`);
        failedOverlays.push(patch.id);
        allSucceeded = false;
      } else {
        cblcarsLog.info(`[SystemsManager] ✅ Incremental update SUCCESS: ${overlay.type} ${overlay.id}`);
      }
    } catch (error) {
      cblcarsLog.error(`[SystemsManager] ❌ Incremental update ERROR: ${overlay.id}`, error);
      failedOverlays.push(patch.id);
      allSucceeded = false;
    }
  });

  // Log summary
  if (allSucceeded) {
    cblcarsLog.info(`[SystemsManager] ✅ All ${overlayPatches.length} overlays updated incrementally`);
  } else {
    cblcarsLog.warn(`[SystemsManager] ⚠️ ${failedOverlays.length}/${overlayPatches.length} overlays failed incremental update:`, failedOverlays);
    cblcarsLog.info(`[SystemsManager] 🔄 Falling back to FULL RE-RENDER for failed overlays`);
  }

  return allSucceeded;
}

/**
 * Find overlay element in DOM
 * @private
 * @param {Object} overlay - Overlay configuration
 * @returns {Element|null} DOM element or null
 */
_findOverlayElement(overlay) {
  if (!this.elements) return null;

  // Different overlay types use different selectors
  const selectors = [
    `[data-overlay-id="${overlay.id}"]`,
    `#overlay-${overlay.id}`,
    `.overlay-${overlay.type}[data-id="${overlay.id}"]`
  ];

  for (const selector of selectors) {
    const element = this.elements.querySelector(selector);
    if (element) return element;
  }

  return null;
}

/**
 * Find overlay config by ID
 * @private
 * @param {string} overlayId - Overlay ID
 * @returns {Object|null} Overlay config or null
 */
_findOverlayById(overlayId) {
  const resolvedModel = this.modelBuilder?.getResolvedModel?.();
  if (!resolvedModel?.overlays) return null;

  return resolvedModel.overlays.find(o => o.id === overlayId) || null;
}
```

---

### Modified: Entity Change Listener

**Location:** `SystemsManager.js` lines ~430-480

**Change:**
```javascript
if (ruleResults.overlayPatches && ruleResults.overlayPatches.length > 0) {
  cblcarsLog.info(`[SystemsManager] 🎨 Rules produced ${ruleResults.overlayPatches.length} patches`);

  // TRY: Incremental updates first
  const allSucceeded = this._applyIncrementalUpdates(ruleResults.overlayPatches);

  // FALLBACK: Full re-render if any failed
  if (!allSucceeded) {
    cblcarsLog.info('[SystemsManager] 🔄 Triggering FULL RE-RENDER (incremental updates incomplete)');
    this._scheduleFullReRender();
  } else {
    cblcarsLog.info('[SystemsManager] ✅ All updates completed incrementally - NO full re-render needed');
  }
} else {
  cblcarsLog.debug('[SystemsManager] ℹ️ No rule patches needed');
}
```

---

## 📊 Logging Strategy

### Clear Path Indicators

Each overlay update logs:
1. **Entry:** Which update path attempted (incremental vs full)
2. **Process:** Steps taken during update
3. **Result:** Success/failure with reason
4. **Fallback:** If full re-render triggered

### Example Log Sequence (Success)

```
[SystemsManager] 🎨 Rules produced 2 patches
[SystemsManager] 🎨 Attempting incremental updates for 2 overlays
[StatusGridRenderer] 🎨 Incremental update: grid-1
[StatusGridRenderer] ✅ Incremental update SUCCESS: grid-1
[ApexChartsOverlayRenderer] 🎨 Incremental update: chart-1
[ApexChartsOverlayRenderer] ✅ Incremental update SUCCESS: chart-1
[SystemsManager] ✅ All 2 overlays updated incrementally
[SystemsManager] ✅ All updates completed incrementally - NO full re-render needed
```

### Example Log Sequence (Fallback)

```
[SystemsManager] 🎨 Rules produced 3 patches
[SystemsManager] 🎨 Attempting incremental updates for 3 overlays
[StatusGridRenderer] 🎨 Incremental update: grid-1
[StatusGridRenderer] ✅ Incremental update SUCCESS: grid-1
[TextOverlayRenderer] ℹ️ text renderer does not support incremental - will full re-render: text-1
[ApexChartsOverlayRenderer] 🎨 Incremental update: chart-1
[ApexChartsOverlayRenderer] ⚠️ Chart instance not found: chart-1 - will full re-render
[SystemsManager] ⚠️ 2/3 overlays failed incremental update: ["text-1", "chart-1"]
[SystemsManager] 🔄 Falling back to FULL RE-RENDER for failed overlays
[SystemsManager] 🔄 Triggering FULL RE-RENDER (incremental updates incomplete)
```

---

## 📝 Overlay Authoring Guide

### For New Overlay Types

**Step 1:** Decide if incremental update makes sense
- ✅ YES: Overlay has existing DOM that can be updated in place
- ❌ NO: Overlay is cheap to rebuild OR has complex state

**Step 2:** Implement capability (if YES)
```javascript
class MyNewOverlayRenderer {
  static supportsIncrementalUpdate() {
    return true;
  }

  static updateIncremental(overlay, element, context) {
    cblcarsLog.info(`[MyNewOverlayRenderer] 🎨 Incremental update: ${overlay.id}`);

    // 1. Apply rule patches from overlay._rulePatch
    // 2. Update DOM in place (no rebuild!)
    // 3. Use smooth CSS transitions

    cblcarsLog.info(`[MyNewOverlayRenderer] ✅ Incremental update SUCCESS: ${overlay.id}`);
    return true;
  }
}
```

**Step 3:** Register in SystemsManager._overlayRenderers

**Step 4:** Test both paths:
- Incremental: Entity changes → rule fires → smooth update
- Full: Remove DOM element → should fallback gracefully

---

## 🎯 Migration Plan

### Phase 1: StatusGrid (Immediate)
- ✅ Implement capability methods
- ✅ Update SystemsManager routing
- ✅ Test incremental vs full paths
- ✅ Verify animations preserved

### Phase 2: ApexCharts (Next)
- ⏳ Implement incremental update method
- ⏳ Add rule patch reading
- ⏳ Use chart.updateOptions()
- ⏳ Test with theme changes

### Phase 3: Other Overlays (Future)
- ⏳ Evaluate each overlay type
- ⏳ Implement where beneficial
- ⏳ Document in authoring guide

---

## 🔒 Safety Mechanisms

1. **Graceful Degradation:** Missing renderer → full re-render (safe)
2. **Fallback on Failure:** Incremental fails → full re-render (safe)
3. **Missing DOM Element:** Can't find element → full re-render (safe)
4. **Exception Handling:** Error during incremental → full re-render (safe)
5. **Clear Logging:** Always log which path taken (debuggable)

---

**END OF ARCHITECTURE DOCUMENT**
