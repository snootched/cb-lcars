# Overlay-to-Overlay Line Attachment & Phase 4 Cleanup

**Date:** October 25, 2025
**Status:** ✅ COMPLETE

---

## Overview

After completing Phase 1-3 of attachment point consolidation, we discovered overlay-to-overlay line attachment was broken. This document covers:
1. Debugging and fixing line attachment issues
2. Completing Phase 4 cleanup (removing all deprecated dual-write code)

---

## Part 1: Overlay-to-Overlay Line Attachment Fixes

### Problem Discovery

**User Request:** Add test line `line_o2o` that attaches to `emergency_button.right`

**Initial Error:**
```
TypeError: r is not iterable at RouterCore.buildRouteRequest
```

### Root Causes & Fixes

#### Issue 1: Wrong Virtual Anchor ID for RouterCore ✅

**Problem:**
RouterCore registration used `targetId` instead of `${targetId}.${attachSide}`

**Fix:** `src/msd/renderer/overlays/LineOverlay.js` lines 275-277
```javascript
const virtualAnchorId = attachSide === 'center' ? targetId : `${targetId}.${attachSide}`;
```

#### Issue 2: Phase 2 Render Timing ✅

**Problem:**
Lines render before buttons exist, so virtual anchors don't exist yet

**Fix:** Split Phase 2 into Phase 2a (buttons) and Phase 2b (lines)
```javascript
// Phase 2a: Render buttons, status_grids, etc.
// Populate attachment points + rebuild virtual anchors
// Phase 2b: Render lines (all targets now exist)
```

#### Issue 3: Incorrect Bbox Calculation ✅

**Problem:**
Used `svgEl.getBBox()` (local coords) instead of overlay configuration (absolute coords)

**Fix:** `src/msd/renderer/AdvancedRenderer.js` lines 1920-1945
```javascript
const position = OverlayUtils.resolvePosition(overlay.position, anchors);
const [x, y] = position;
const [width, height] = overlay.size;
const bbox = { left: x, right: x + width, top: y, bottom: y + height, ... };
```

#### Issue 4: Action Queue Structure ✅

**Problem:**
Phase 2a and 2b pushed different structures to action queue

**Fix:** Standardized to `{ overlayId, actionInfo, overlay, cardInstance }`

### Result

✅ Line now correctly attaches to `emergency_button.right`
✅ All overlay-to-overlay line features working

---

## Part 2: Phase 4 Cleanup - Removing Deprecated Code

After fixing line attachment, we completed the final consolidation phase.

### What Was Removed

1. **Constructor Declarations:**
   ```javascript
   // REMOVED:
   this.overlayAttachmentPoints = new Map();
   this.textAttachmentPoints = new Map();
   this._dynamicAnchors = {};
   ```

2. **Dual-Write Code (20+ locations):**
   - `_populateInitialAttachmentPoints()` - 2 locations
   - `_updateStatusIndicatorPosition()`
   - `_updateTextAttachmentPointsAfterStabilization()`
   - `renderOverlay()` text caching
   - `_updateTextAttachmentPointsFromDom()`

3. **Method Parameters:**
   - `_buildDynamicOverlayAnchors(overlays, anchorMap)` → `(overlays)`
   - `_buildVirtualAnchorsFromAllOverlays(overlays, anchorMap)` → `(overlays)`
   - Updated 5+ call sites

4. **Replaced `_dynamicAnchors` with `_staticAnchors`:**
   - Static anchors = initial anchor object from config
   - Virtual anchors read from attachmentManager as needed
   - No more global dynamic anchor accumulation

5. **Removed Vestigial Code:**
   - `setOverlayAttachmentPoints()` calls (Phase 3 artifact)
   - `.clear()` calls for deleted maps
   - All DEPRECATED comments

### Verification

```bash
# Zero matches for deprecated code
grep -r "DEPRECATED" src/msd/renderer/AdvancedRenderer.js
grep -r "overlayAttachmentPoints" src/msd/renderer/AdvancedRenderer.js
grep -r "textAttachmentPoints" src/msd/renderer/AdvancedRenderer.js
grep -r "_dynamicAnchors" src/msd/renderer/AdvancedRenderer.js

# Build successful
npm run build
# ✅ Build complete with 0 errors
```

### Impact

**Lines Removed:** ~30 dual-write lines + 3 map declarations + cleanup
**Single Source of Truth:** All attachment data now flows through AttachmentPointManager only
**Behavioral Change:** NONE - All features work identically

---

## Final Render Pipeline

```
Phase 1: Text Overlays
  ├─ Render to DOM
  ├─ Populate attachment points (expanded bbox from DOM)
  └─ Build virtual anchors (text only)

Phase 2a: Buttons, Status Grids, etc.
  ├─ Render to DOM
  ├─ Populate attachment points (overlay.position + overlay.size)
  └─ Rebuild virtual anchors (ALL overlays: text + buttons + grids)

Phase 2b: Lines
  └─ Render with complete anchor set (static + virtual from ALL overlays)
```

**Key Insight:** Virtual anchors must be rebuilt after Phase 2a so lines in Phase 2b have access to button/grid attachment points.

---

## Test Configuration

**File:** `test-button-incremental.yaml`

```yaml
overlays:
  - id: emergency_button
    type: button
    position: [200, 20]
    size: [100, 30]
    text: "EMERGENCY"

  - id: line_o2o
    type: line
    attach_to: emergency_button
    attach_side: right
    attach_gap: 20
    anchor: corner_bl
```

---

## Consolidation Status: COMPLETE ✅

All 4 phases finished:
- ✅ Phase 1: Dual-Write Mode
- ✅ Phase 2: Read Migration
- ✅ Phase 3: Validation
- ✅ Phase 4: Cleanup

The attachment point consolidation is now 100% complete.

---

## Files Modified

1. **src/msd/renderer/overlays/LineOverlay.js**
   - Fixed virtual anchor ID construction

2. **src/msd/renderer/AdvancedRenderer.js**
   - Split Phase 2 into 2a and 2b
   - Fixed bbox calculation
   - Standardized action queue
   - **Phase 4:** Removed all deprecated code
   - **Phase 4:** Cleaned up method signatures

3. **doc/ATTACHMENT_POINT_CONSOLIDATION.md**
   - Updated to reflect Phase 4 completion

---

## Related Documents

- `doc/ATTACHMENT_POINT_CONSOLIDATION.md` - Full consolidation details
- `doc/INCREMENTAL_UPDATE_IMPLEMENTATION.md` - Original incremental update work
