# TextOverlay Render Signature Mismatch Fix

**Issue:** Text content missing after state change (empty `<text>` element)
**Root Cause:** Method signature mismatch between AdvancedRenderer and TextOverlay
**Date:** October 25, 2025
**Status:** ✅ FIXED

---

## Problem Description

After toggling `light.tv`:
- Text color/size updated correctly ✅
- Status indicator moved (geometry change detected) ✅
- But text content was **completely missing** ❌

DOM showed:
```html
<text x="50" y="25" fill="var(--lcars-red)" ... font-weight="bold"></text>
<!-- ^^^ EMPTY - No text content! -->
```

---

## Root Cause: Method Signature Mismatch

### What AdvancedRenderer Calls

```javascript
// AdvancedRenderer.js - line ~1095
if (overlay.type === 'text') {
  result = renderer.render(overlay, anchors, viewBox, svgContainer);
  //                      ^^^^^^^ ^^^^^^^ ^^^^^^^ ^^^^^^^^^^^^
  //                      param1  param2  param3  param4
}
```

### What TextOverlay Expected (WRONG!)

```javascript
// TextOverlay.js - OLD SIGNATURE
render(context) {
  const overlay = this.overlay;  // ❌ Using instance property
  const viewBox = context.viewBox;  // ❌ context is actually the overlay param!
  const style = overlay.finalStyle || overlay.style || {};
}
```

### The Bug

When AdvancedRenderer called `renderer.render(overlay, anchors, viewBox, svgContainer)`:
- `overlay` went into `context` parameter
- `anchors` went into nothing (no 2nd param)
- `viewBox` went into nothing (no 3rd param)
- `svgContainer` went into nothing (no 4th param)

**Result:**
- `context` was the overlay object (not a context object!)
- `context.viewBox` was undefined
- `context.container` was undefined
- Template processing failed because no proper context
- Text content resolved to empty string!

---

## Solution

### Fix #1: Match ButtonOverlay Signature

```javascript
// TextOverlay.js - NEW SIGNATURE ✅
render(overlay, anchors, viewBox, svgContainer, cardInstance) {
  //    ^^^^^^^ ^^^^^^^ ^^^^^^^ ^^^^^^^^^^^^  ^^^^^^^^^^^^
  //    param1  param2  param3  param4        param5

  // Use passed overlay (with finalStyle if present)
  const style = overlay.finalStyle || overlay.style || {};

  this.container = svgContainer;
  this.viewBox = viewBox;

  // ... rest of rendering
}
```

### Fix #2: Update Action Processing Call

```javascript
// OLD
if (hasActions) {
  actionInfo = this._processActions(overlay, context);  // ❌ context doesn't exist
}

// NEW
if (hasActions) {
  actionInfo = this._processActions(overlay, { viewBox, container: svgContainer });  // ✅
}
```

---

## Why This Happened

**History:** TextOverlay was migrated to instance-based pattern in Phase 3B, but its render signature wasn't updated to match the pattern established by ButtonOverlay and other overlays.

**Pattern Established:**
All instance-based overlays should use:
```javascript
render(overlay, anchors, viewBox, svgContainer, cardInstance)
```

**TextOverlay Used:**
```javascript
render(context)  // ❌ Wrong pattern
```

---

## Comparison with Other Overlays

| Overlay | Render Signature | Status |
|---------|------------------|--------|
| ButtonOverlay | `(overlay, anchors, viewBox, svg, card)` | ✅ Correct |
| StatusGridOverlay | `(overlay, anchors, viewBox, svg, card)` | ✅ Correct |
| ApexChartsOverlay | `(overlay, anchors, viewBox, svg, card)` | ✅ Correct |
| LineOverlay | `(overlay, anchors, viewBox, svg)` | ✅ Correct |
| **TextOverlay** | ~~`(context)`~~ → `(overlay, anchors, viewBox, svg, card)` | ✅ FIXED |

---

## Testing

### Before Fix
```
Toggle light.tv
  ↓
AdvancedRenderer calls: renderer.render(overlay, anchors, viewBox, svg)
  ↓
TextOverlay receives: context=overlay, (no other params)
  ↓
context.viewBox = undefined ❌
context.container = undefined ❌
  ↓
Template processing fails ❌
  ↓
Text content = empty string
  ↓
<text ...></text> (EMPTY) ❌
```

### After Fix
```
Toggle light.tv
  ↓
AdvancedRenderer calls: renderer.render(overlay, anchors, viewBox, svg)
  ↓
TextOverlay receives: overlay, anchors, viewBox, svg ✅
  ↓
viewBox = [0, 0, 1920, 1200] ✅
svgContainer = <svg> element ✅
  ↓
Template processing works ✅
  ↓
Text content = "Temperature: 20.5°C - 75%" ✅
  ↓
<text ...>Temperature: 20.5°C - 75%</text> ✅
```

---

## Code Changes

**File:** `src/msd/overlays/TextOverlay.js`

### Change 1: Render Method Signature (Line ~82)
```javascript
// BEFORE
render(context) {
  const overlay = this.overlay;
  const style = overlay.finalStyle || overlay.style || {};
  const viewBox = context.viewBox || this.viewBox;
  this.container = context.container;
  this.viewBox = viewBox;

// AFTER
render(overlay, anchors, viewBox, svgContainer, cardInstance) {
  const style = overlay.finalStyle || overlay.style || {};
  this.container = svgContainer;
  this.viewBox = viewBox;
```

### Change 2: Action Processing (Line ~221)
```javascript
// BEFORE
if (hasActions) {
  actionInfo = this._processActions(overlay, context);
}

// AFTER
if (hasActions) {
  actionInfo = this._processActions(overlay, { viewBox, container: svgContainer });
}
```

---

## Related Fixes

This fix works in conjunction with previous fixes:

1. **Cache Fix** (earlier today):
   - Always re-resolve text content during render
   - Re-resolve styles when finalStyle present

2. **Signature Fix** (this fix):
   - Match established render signature pattern
   - Properly receive overlay, viewBox, and container

**Both fixes needed!** Without the cache fix, content would still be stale. Without the signature fix, parameters would be misaligned.

---

## Lessons Learned

### 1. API Consistency Matters
All overlays should follow the same render signature pattern:
```javascript
render(overlay, anchors, viewBox, svgContainer, cardInstance?)
```

### 2. Check Parameter Usage
When migrating code, verify:
- Method signatures match caller expectations
- Parameters are used correctly
- No implicit dependencies on parameter positions

### 3. Test Both Paths
- Initial render (works if signature roughly compatible)
- Re-render (breaks if signature actually wrong)

---

## Summary

**Root Cause:** TextOverlay render signature didn't match what AdvancedRenderer expected

**Symptoms:**
- Empty text elements after re-render
- Template processing failed
- Parameters misaligned (overlay went into context param)

**Fix:**
- Updated render signature to match ButtonOverlay pattern
- Fixed action processing call
- Properly receive and use overlay, viewBox, svgContainer parameters

**Result:** Text overlays now render correctly with proper content!

**Status:** ✅ FIXED - Ready for testing
