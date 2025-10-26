# Line Attachment and Font Stabilization Fix

**Date:** October 25, 2025
**Issue:** Lines attached to text overlays with status indicators were rendering at incorrect positions on initial page load.

---

## Problem Description

When a text overlay with a status indicator was rendered, lines attached to it would:
1. ✅ Initially render correctly with fallback font
2. ❌ Fail to update when the real font loaded and text expanded
3. ✅ Update correctly when triggered via RulesEngine

The line would be positioned 80-140 units too far left, attached to the text bbox instead of the expanded bbox that includes the status indicator.

---

## Root Causes

### 1. Missing Initial Attachment Points Population

**Problem:**
- Phase 1: Text overlays rendered and calculated expanded bbox (including status indicator)
- Expanded bbox stored as `data-expanded-bbox` DOM attribute
- **BUT** `overlayAttachmentPoints` map not populated
- Phase 2: Lines rendered, tried to read from empty `overlayAttachmentPoints` map
- Result: Lines used wrong/fallback attachment points

**Solution:**
Added `_populateInitialAttachmentPoints()` method that runs after Phase 1, before Phase 2:
- Reads all text overlays from cache
- Extracts `data-expanded-bbox` attributes
- Populates `overlayAttachmentPoints` map
- Now lines have correct expanded bbox data before they render

**Location:** `src/msd/renderer/AdvancedRenderer.js` line ~248

```javascript
this._cacheElementsFrom(overlayGroup);

// CRITICAL: Populate attachment points from Phase 1 overlays BEFORE Phase 2
this._populateInitialAttachmentPoints(overlays);

// Build dynamic anchors (overlay destinations)
this._dynamicAnchors = { ...anchors };
this._buildDynamicOverlayAnchors(overlays, this._dynamicAnchors);
```

### 2. Font Stabilization Not Detecting Changes

**Problem:**
- Font stabilization detected font loaded: `anyFontChanges = true`
- Updated status indicator position and attachment points
- **BUT** didn't add overlay to `changedTargets` Set
- Result: `_rerenderAllDependentOverlays()` called with empty `changedTargets`
- Lines not re-rendered

**Why:**
```javascript
if (group.getAttribute('data-font-stabilized') !== '1') {
    group.setAttribute('data-font-stabilized','1');
    anyFontChanges = true;  // Sets flag but doesn't add to changedTargets!
}
```

Only added to `changedTargets` if text dimensions changed (`diffW > 0 || diffH > 0`), but status indicator position changes even without dimension changes.

**Solution:**
After calling `_updateStatusIndicatorPosition()`, check if overlay has status indicator and add to `changedTargets`:

**Location:** `src/msd/renderer/AdvancedRenderer.js` line ~779

```javascript
this._updateStatusIndicatorPosition(group, bb);

// CRITICAL: If overlay has status indicator, add to changedTargets since attachment points changed
const hasStatusIndicator = group.querySelector('[data-decoration="status-indicator"]');
if (hasStatusIndicator) {
  changedTargets.add(ov.id);
}
```

### 3. Wrong Parameter to Re-render Method

**Problem:**
The most subtle bug - method was called with wrong parameter type:

```javascript
// WRONG - passing anchors object
this._rerenderAllDependentOverlays(overlays, this._dynamicAnchors, viewBox);

// Method signature expects Set of overlay IDs
_rerenderAllDependentOverlays(allOverlays, sourceOverlayIds, viewBox)
```

Method expected `sourceOverlayIds` (Set like `Set(['title_overlay'])`) but received `this._dynamicAnchors` (object like `{anchor1: [x,y], ...}`).

Result: Method iterated over wrong data structure, silently failed to find overlays to re-render.

**Solution:**
Pass `changedTargets` Set instead:

**Location:** `src/msd/renderer/AdvancedRenderer.js` line ~797

```javascript
// CORRECT - passing Set of changed overlay IDs
this._rerenderAllDependentOverlays(overlays, changedTargets, viewBox);
```

---

## How Font Stabilization Works (After Fix)

### Render Pipeline:

```
1. PHASE 1: Text Overlays Render
   ├─ TextRenderer calculates expanded bbox (text + status indicator)
   ├─ Stores as data-expanded-bbox attribute
   └─ _populateInitialAttachmentPoints() reads and populates overlayAttachmentPoints

2. PHASE 2: Line Overlays Render
   ├─ _buildDynamicOverlayAnchors() reads from overlayAttachmentPoints
   ├─ Lines get correct expanded bbox attachment points
   └─ Lines render at correct position (even with fallback font)

3. FONT LOADS (async)
   └─ Browser applies real font, text dimensions change

4. FONT STABILIZATION LOOP
   ├─ Measures new text bbox from DOM
   ├─ Calls _updateStatusIndicatorPosition() → expands bbox
   ├─ Adds overlay to changedTargets (if has status indicator)
   ├─ Calls _rerenderAllDependentOverlays(overlays, changedTargets, viewBox)
   │  ├─ Iterates changedTargets Set
   │  ├─ Finds dependent lines via _lineDeps map
   │  ├─ Removes old line elements
   │  └─ Appends new line elements with updated attachment points
   └─ Lines now at correct position for expanded text
```

### Key Flow:

1. **Initial Render:** Lines correct because `overlayAttachmentPoints` populated before Phase 2
2. **Font Changes:** Lines update because:
   - Status indicator overlays added to `changedTargets`
   - `_rerenderAllDependentOverlays()` called with correct parameter
   - Lines re-rendered via remove/append (not update())

---

## Code Changes Summary

### Files Modified:
- `src/msd/renderer/AdvancedRenderer.js`

### New Methods:
- `_populateInitialAttachmentPoints(overlays)` - Reads expanded bbox from Phase 1 DOM elements and populates attachment points map

### Modified Methods:
- Font stabilization loop (~line 755-800) - Added status indicator check to add overlays to changedTargets
- `_rerenderAllDependentOverlays()` call (~line 797) - Fixed parameter from `this._dynamicAnchors` to `changedTargets`

### Key Insights:

**Why RulesEngine worked but initial load didn't:**
- RulesEngine triggers selective re-render which properly populates `changedTargets`
- Initial font stabilization had empty `changedTargets` due to missing status indicator check

**Why logs showed "Updated attachment points" but lines didn't move:**
- `_updateStatusIndicatorPosition()` was calling `renderer.update()` (no-op on LineOverlay)
- Real re-render happens via `_rerenderAllDependentOverlays()` which was receiving wrong parameter

**Why it was hard to debug:**
- Each subsystem (bbox expansion, attachment points, font stabilization, line re-rendering) worked individually
- Bug was in the **coordination** between systems - wrong data types passed between them

---

## Testing Checklist

✅ Initial page load with fallback font - lines at correct position
✅ Real font loads and text expands - lines update automatically
✅ Status indicator on/off toggle - lines stay correct
✅ Multiple text overlays with status indicators - all work
✅ Lines with `attach_gap` - proper spacing maintained
✅ Status indicators at different positions (left/right/top/bottom) - all correct

---

## Related Documentation

- `TEXT_OVERLAY_BBOX_LINE_ATTACHMENT_FIX.md` - Initial bbox expansion implementation
- `INITIAL_RENDER_STATUS_INDICATOR_FIX.md` - Precomputation removal
- `LINE_OVERLAY_DOM_UPDATE_FIX.md` - Line re-rendering via remove/append

---

## Lessons Learned

1. **Type Safety Matters:** Passing wrong type (object vs Set) caused silent failure
2. **Integration Points Are Critical:** Each system worked individually but coordination was broken
3. **Don't Skip Change Detection:** Status indicator changes attachment points even without dimension changes
4. **Trust But Verify:** Logs showing "success" doesn't mean the right thing happened
5. **Render Pipeline Phases:** Phase 1 must populate data structures before Phase 2 reads them

---

## Future Improvements

Consider:
1. Add TypeScript or JSDoc type checking to catch parameter mismatches
2. Consolidate attachment point population into single authoritative method
3. Add integration tests for font stabilization → line re-rendering flow
4. Consider making `changedTargets` a class property instead of local variable
5. Add debug logging for `_rerenderAllDependentOverlays()` parameter types
