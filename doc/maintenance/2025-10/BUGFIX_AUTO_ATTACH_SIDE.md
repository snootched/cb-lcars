# Bugfix: Auto-Attach Side Determination & Write-Back

**Date:** October 25-26, 2025
**Status:** ✅ COMPLETE (including write-back fix)

---

## Part 1: Initial Auto-Determination Implementation (Oct 25)

### Issue
After Phase 4 cleanup (sed replacement of `_dynamicAnchors` with `_staticAnchors`), lines without an explicit `attach_side` property were defaulting to attaching at overlay centers instead of automatically determining the best edge to attach to.

### Root Cause
The `_resolveOverlayAttachmentPoint()` method was falling through to the `default` case when `side` was an empty string, which always returned `points.center`. There was no auto-determination logic for cases where `attach_side` was not specified in the configuration.

## Solution
Enhanced `_resolveOverlayAttachmentPoint()` to automatically determine the best attachment side based on geometric analysis:

### Algorithm
When `attach_side` is not specified (empty string):
1. Calculate the vector from the overlay center to the line anchor
2. Compare horizontal vs vertical distance (dx vs dy)
3. Choose the primary direction based on which distance is larger:
   - If `|dx| > |dy|`: Horizontal attachment (left or right based on sign of dx)
   - If `|dy| >= |dx|`: Vertical attachment (top or bottom based on sign of dy)

### Changes Made

#### 1. `_resolveOverlayAttachmentPoint(points, side, lineAnchor = null)`
**Location**: `src/msd/renderer/AdvancedRenderer.js`, lines ~802-850

**Enhancement**: Added optional `lineAnchor` parameter and auto-determination logic:
```javascript
// Auto-determine side if not specified
if (!side || side === '' || side === 'center') {
  if (lineAnchor && points.center) {
    const [lineX, lineY] = lineAnchor;
    const [centerX, centerY] = points.center;

    const dx = lineX - centerX;
    const dy = lineY - centerY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Determine primary direction
    if (absDx > absDy) {
      side = dx < 0 ? 'left' : 'right';
    } else {
      side = dy < 0 ? 'top' : 'bottom';
    }
  } else {
    return points.center; // Fallback if no line anchor provided
  }
}
```

#### 2. `_buildDynamicOverlayAnchors(overlays)`
**Location**: `src/msd/renderer/AdvancedRenderer.js`, lines ~690-730

**Enhancement**: Retrieve line anchor and pass to `_resolveOverlayAttachmentPoint`:
```javascript
// Get line anchor for auto-side determination
const lineAnchor = this.attachmentManager.getAnchor(raw.anchor) ||
                  this._staticAnchors[raw.anchor] ||
                  null;

const side = (raw.attach_side || raw.attachSide || '').toLowerCase();
const basePt = this._resolveOverlayAttachmentPoint(attachmentPointData.points, side, lineAnchor);
```

#### 3. `_updateDynamicAnchorsForOverlays(changedIds, overlays, anchorMap)`
**Location**: `src/msd/renderer/AdvancedRenderer.js`, lines ~733-770

**Enhancement**: Same approach as above for incremental updates:
```javascript
// Get line anchor for auto-side determination
const lineAnchor = anchorMap[raw.anchor] ||
                  this.attachmentManager.getAnchor(raw.anchor) ||
                  this.routerCore?.anchors[raw.anchor] ||
                  null;

const side = (raw.attach_side || raw.attachSide || '').toLowerCase();
const basePt = this._resolveOverlayAttachmentPoint(tap.points, side, lineAnchor);
```

## Behavior

### Before Fix
```yaml
- id: test_line
  type: line
  anchor: left_anchor
  attach_to: my_overlay
  # No attach_side specified
```
**Result**: Line always attached to center of `my_overlay`

### After Fix
```yaml
- id: test_line
  type: line
  anchor: left_anchor
  attach_to: my_overlay
  # No attach_side specified
```
**Result**: Line automatically attaches to the appropriate edge:
- If `left_anchor` is to the left of `my_overlay` → attaches to LEFT edge
- If `left_anchor` is to the right → attaches to RIGHT edge
- If `left_anchor` is above → attaches to TOP edge
- If `left_anchor` is below → attaches to BOTTOM edge

### Explicit Side Still Respected
```yaml
- id: test_line
  type: line
  anchor: left_anchor
  attach_to: my_overlay
  attach_side: right  # Explicitly specified
```
**Result**: Line always attaches to RIGHT edge regardless of geometry

## Testing
1. Build successful with no errors
2. Lines without `attach_side` now auto-determine attachment edge
3. Lines with explicit `attach_side` work as before (no regression)
4. Incremental updates (when overlays move) recalculate auto-sides correctly

## Debug Logging
Added debug logging to aid troubleshooting:
```javascript
cblcarsLog.debug('[AdvancedRenderer] Auto-determined attach_side:', side, {
  lineAnchor,
  center: points.center,
  dx,
  dy
});
```

Check browser console for "Auto-determined attach_side" messages when testing.

---

## Part 2: Write-Back Fix (Oct 26)

### Problem Discovery
After implementing auto-determination, the system was correctly **calculating** the nearest edges but lines were still rendering **center-to-center**.

**Symptoms:**
- Logs showed correct auto-determination: `source="left"`, `dest="top"` ✅
- Logs showed virtual anchors created: `test_grid.left`, `emergency_button.top` ✅
- BUT lines rendered center-to-center instead of edge-to-edge ❌

### Root Cause: Data Handoff Failure

**The disconnect between AdvancedRenderer and LineOverlay:**

1. `AdvancedRenderer._buildDynamicOverlayAnchors()` auto-determined sides correctly
2. Wrote results to `line._raw.anchor_side` and `line._raw.attach_side`
3. BUT `LineOverlay.render()` received `overlay.anchor_side` (top-level property)
4. Since top-level properties were `undefined`, LineOverlay constructed wrong IDs:
   - Looked for: `test_grid` (center)
   - Should look for: `test_grid.left` (edge)

### Debug Trail
```javascript
// AdvancedRenderer logs:
"Wrote back anchor_side to overlay config: {overlayId: 'line_o2o', anchor_side: 'left'}"

// LineOverlay logs:
"_resolveAnchor for line_o2o: {anchor: 'test_grid', anchor_side: undefined, ...}"
```

### Solution: Dual Write-Back

Write auto-determined sides to **both** internal `_raw` object AND top-level overlay object:

**Location 1:** Source side write-back (lines 745-752)
```javascript
if (sourcePt && sourceEffectiveSide && sourceEffectiveSide !== 'center') {
  // ... create virtual anchor ...

  // CRITICAL: Write to both locations
  raw.anchor_side = sourceEffectiveSide;      // Internal tracking
  line.anchor_side = sourceEffectiveSide;     // For LineOverlay ✅
}
```

**Location 2:** Destination side write-back (lines 798-806)
```javascript
if (effectiveSide && effectiveSide !== 'center' && !configSide) {
  raw.attach_side = effectiveSide;        // Internal tracking
  line.attach_side = effectiveSide;       // For LineOverlay ✅
}
```

### Why This Works
1. `line` object IS the same object passed to `renderer.render(overlay, ...)`
2. Writing to `line.anchor_side` makes it available as `overlay.anchor_side` in LineOverlay
3. LineOverlay now constructs correct virtual anchor IDs
4. Lines correctly attach edge-to-edge! 🎉

---

## Final Status

✅ **Auto/auto scenario fully functional**
- Lines automatically choose optimal edge-to-edge connections
- No manual `anchor_side` or `attach_side` specification needed
- Geometry-based algorithm selects nearest edges

✅ **All attachment modes working:**
- Auto/auto (both sides auto-determined)
- Auto/explicit (one side auto, one side specified)
- Explicit/explicit (both sides specified)

## Related Files
- `src/msd/renderer/AdvancedRenderer.js` (auto-determination + write-back)
- `src/msd/overlays/LineOverlay.js` (virtual anchor lookup + debug logging)
- `src/msd/renderer/AttachmentPointManager.js` (anchor storage)

## Phase Context
This completes Phase 4 cleanup and the auto-attach implementation:
- Phase 4: Attachment point consolidation ✅
- Auto-determination: Geometric edge selection ✅
- Write-back: Data handoff to LineOverlay ✅

## Build
```bash
npm run build
```
Build successful: 1.65 MiB, 3 warnings (normal)
