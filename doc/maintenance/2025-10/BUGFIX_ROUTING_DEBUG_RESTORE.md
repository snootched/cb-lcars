# Bug Fix: Restore Routing Debug Visualization

**Date:** October 26, 2025
**Status:** ✅ FIXED

---

## Problem

The routing debug overlay (magenta waypoint markers showing line paths) was not rendering, even when `debug.overlays.routing: true` was enabled in the config.

### Symptoms
- Debug console showed "Routing system not available for debug rendering"
- No magenta waypoint markers visible on lines
- Other debug features (anchors, bounding boxes) working fine

---

## Root Cause

**Missing router parameter in debug options**

In `SystemsManager.renderDebugAndControls()`, the `debugOptions` object passed to `debugRenderer.render()` was missing the `router` property:

```javascript
// BEFORE (broken):
const debugOptions = {
  anchors: resolvedModel.anchors || {},
  overlays: resolvedModel.overlays || {},
  // ❌ router: missing!
  showRouting: this.debugManager.canRenderRouting(),
  ...
};
```

**Why it broke:**

`MsdDebugRenderer.renderRoutingGuides()` looks for the router in two places:
```javascript
const routing = opts.router || window.cblcars.debug.msd?.routing;
```

Without `opts.router`, it fell back to `window.cblcars.debug.msd?.routing`, which may not always be set or may reference an outdated instance.

---

## Solution

Pass `this.router` in the debug options:

### Code Change

**File:** `src/msd/pipeline/SystemsManager.js`
**Location:** Lines ~696-708 (in `renderDebugAndControls()`)

```javascript
const debugOptions = {
  anchors: resolvedModel.anchors || {},
  overlays: resolvedModel.overlays || [],
  router: this.router,  // ✅ FIXED: Pass router for routing debug visualization
  showAnchors: debugState.anchors,
  showBoundingBoxes: debugState.bounding_boxes,
  showRouting: this.debugManager.canRenderRouting(),
  showPerformance: debugState.performance,
  scale: debugState.scale
};
```

---

## Verification

### To Test:
1. Enable routing debug:
   ```yaml
   msd:
     debug:
       enabled: true
       overlays:
         routing: true
   ```

2. Or use console:
   ```javascript
   __msdDebug.debug.enable('routing')
   ```

3. **Expected behavior:**
   - Magenta circles appear at line waypoints
   - Waypoint indices labeled (0, 1, 2, ...)
   - Strategy + cost shown at start point (e.g., "smart (42)")

### Debug Output:
- ✅ Console: `[MsdDebugRenderer] Rendered N routing guides`
- ✅ Visual: Magenta markers on all line overlays
- ✅ Info: Routing strategy and cost labels

---

## Impact

✅ **Routing debug visualization restored**
- Developers can now visualize line paths during debugging
- Waypoints visible for all routing strategies (direct, smart, arc, channel)
- Helps diagnose routing issues and path optimization

✅ **No side effects**
- Only affects debug rendering when `routing: true`
- Production rendering unchanged
- No performance impact when debug disabled

---

## Related Features

### Other Debug Features (working):
- `debug.overlays.anchors` - Show anchor markers ✅
- `debug.overlays.bounding_boxes` - Show overlay bounds ✅
- `debug.overlays.performance` - Show performance metrics ✅

### Routing Debug API:
- `__msdDebug.routing.inspect('overlay_id')` - Get route info
- `__msdDebug.routing.stats()` - Routing statistics
- `__msdDebug.routing.invalidate()` - Clear cache

---

## Files Modified

1. `src/msd/pipeline/SystemsManager.js`
   - Line 698: Added `router: this.router` to debugOptions

---

## Context

This fix was discovered while implementing auto-attach for overlay-to-overlay lines. The routing debug visualization helps verify that:
- Auto-determined attachment points are correct
- Routing strategies work as expected
- Path costs are reasonable
- Waypoints follow expected trajectories

**Status:** ✅ Ready for production
