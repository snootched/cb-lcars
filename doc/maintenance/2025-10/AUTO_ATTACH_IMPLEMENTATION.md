# Auto-Attach Implementation - Overlay-to-Overlay Lines

**Date:** October 26, 2025
**Status:** ✅ COMPLETE

---

## Overview

Implemented automatic side determination for overlay-to-overlay line connections. Both the source (`anchor`) and destination (`attach_to`) sides can now be automatically determined based on geometry, or explicitly specified.

---

## Features

### 1. Auto-Determination for Destination Side (`attach_side`)

**When NOT specified:**
```yaml
- id: my_line
  type: line
  anchor: overlay_a
  attach_to: overlay_b
  # No attach_side - will auto-determine
```

**Behavior:**
- Calculates vector from destination overlay center to source anchor position
- Compares `|dx|` vs `|dy|` to determine primary direction
- Selects nearest edge:
  - Horizontal (`|dx| > |dy|`): `left` or `right` based on sign
  - Vertical (`|dy| >= |dx|`): `top` or `bottom` based on sign
- Falls back to `center` if source anchor not available

**Algorithm:**
```javascript
const dx = sourceX - destCenterX;
const dy = sourceY - destCenterY;

if (Math.abs(dx) > Math.abs(dy)) {
  side = dx < 0 ? 'left' : 'right';  // Source is to the left/right
} else {
  side = dy < 0 ? 'top' : 'bottom';  // Source is above/below
}
```

### 2. Auto-Determination for Source Side (`anchor_side`)

**When NOT specified:**
```yaml
- id: my_line
  type: line
  anchor: overlay_a
  # No anchor_side - will auto-determine
  attach_to: overlay_b
```

**Behavior:**
- Uses destination overlay center as reference point
- Applies same geometry-based algorithm to select source edge
- Creates virtual anchor ID like `overlay_a.right`
- Applies `anchor_gap` offset if specified

### 3. Explicit Side Specification

**Both sides can be explicitly specified:**
```yaml
- id: my_line
  type: line
  anchor: overlay_a
  anchor_side: right      # Explicit source side
  attach_to: overlay_b
  attach_side: top        # Explicit destination side
```

---

## Configuration Options

### Line Configuration Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `anchor` | string | required | Source anchor or overlay ID |
| `anchor_side` | string | auto | Source side: `left`, `right`, `top`, `bottom`, `center`, or empty for auto |
| `anchor_gap` | number | 0 | Gap offset from source edge (positive = outward) |
| `attach_to` | string | required | Destination overlay ID |
| `attach_side` | string | auto | Destination side: same options as `anchor_side` |
| `attach_gap` | number | 0 | Gap offset from destination edge (positive = outward) |

### Valid Side Values

- `left` - Left edge
- `right` - Right edge
- `top` - Top edge
- `bottom` - Bottom edge
- `center` - Center point
- `top-left`, `top-right`, `bottom-left`, `bottom-right` - Corners
- `''` or omitted - Auto-determine based on geometry

---

## Examples

### Example 1: Full Auto (Both Sides)
```yaml
- id: auto_line
  type: line
  anchor: button_a
  attach_to: button_b
  # Both sides auto-determined
```
**Result:** Line connects the nearest edges of both overlays automatically.

### Example 2: Explicit Destination, Auto Source
```yaml
- id: mixed_line
  type: line
  anchor: panel_left
  attach_to: panel_right
  attach_side: left  # Explicit: attach to left edge of destination
  # anchor_side auto-determined
```
**Result:** Destination always uses left edge, source side determined automatically.

### Example 3: Both Sides Explicit with Gaps
```yaml
- id: precise_line
  type: line
  anchor: status_grid
  anchor_side: right
  anchor_gap: 10
  attach_to: title_overlay
  attach_side: left
  attach_gap: 15
```
**Result:** Right edge of status_grid (+10px) to left edge of title_overlay (+15px).

---

## Implementation Details

### Virtual Anchor Creation

When a line references overlays, virtual anchors are created with composite IDs:

```
Source:      "overlay_a.right"  → [x, y] with anchor_gap applied
Destination: "overlay_b.top"    → [x, y] with attach_gap applied
```

These virtual anchors are stored in:
1. `AttachmentPointManager` (centralized storage)
2. `RouterCore.anchors` (for routing engine)

### Processing Flow

1. **Initial Render** (`_buildDynamicOverlayAnchors`):
   - Check if `anchor` is an overlay (has attachment points)
   - If yes, resolve source side (explicit or auto)
   - Create source virtual anchor if not center
   - Resolve destination side using source position
   - Create destination virtual anchor
   - Store both in AttachmentPointManager

2. **Line Rendering** (`LineOverlay.render`):
   - Resolve anchor → looks up virtual anchor ID (`overlay.side`)
   - Resolve attach_to → looks up virtual anchor ID (`overlay.side`)
   - Pass both points to RouterCore for path computation

3. **Updates** (`_updateDynamicAnchorsForOverlays`):
   - When overlay positions change (e.g., font stabilization)
   - Recalculate attachment points
   - Update virtual anchors
   - Invalidate affected lines in RouterCore

---

## Code Locations

### AdvancedRenderer.js

**`_buildDynamicOverlayAnchors()` (lines ~690-760)**
- Checks if anchor is an overlay
- Resolves source side (explicit or auto)
- Creates source virtual anchor
- Resolves destination side
- Creates destination virtual anchor

**`_resolveOverlayAttachmentPoint()` (lines ~847-905)**
- Auto-determines side based on geometry
- Falls back to center if no reference point
- Returns `{ point, side }`

**`_applyAttachGap()` (lines ~817-845)**
- Applies gap offset based on side direction
- Ensures gap extends outward from overlay

### LineOverlay.js

**`_resolveAnchor()` (lines ~416-445)**
- Constructs virtual anchor ID for source
- Looks up in anchors map
- Falls back to standard resolution

**`_resolveAttachTo()` (lines ~450-478)**
- Constructs virtual anchor ID for destination
- Looks up in anchors map
- Falls back to standard resolution

---

## Testing Scenarios

### ✅ Test Cases

1. **Auto/Auto:**
   - Remove both `anchor_side` and `attach_side`
   - Verify line connects nearest edges of both overlays

2. **Explicit/Auto:**
   - Set `attach_side: top`
   - Verify destination uses top edge
   - Verify source side auto-determined

3. **Auto/Explicit:**
   - Set `anchor_side: right`
   - Verify source uses right edge
   - Verify destination side auto-determined

4. **Explicit/Explicit:**
   - Set both `anchor_side: right` and `attach_side: left`
   - Verify line connects specified edges

5. **With Gaps:**
   - Set `anchor_gap: 10` and `attach_gap: 15`
   - Verify gap offsets applied correctly

6. **Static Anchor to Overlay:**
   - `anchor` is static anchor (not overlay)
   - `attach_to` is overlay
   - Verify destination side auto-determined based on static anchor position

7. **Overlay to Static Anchor:**
   - `anchor` is overlay
   - `attach_to` is static anchor
   - Verify source side auto-determined

---

## Bug Fixes (October 26, 2025)

### Issue 1: Auto-determination falling back to center
**Problem:** When `attach_side` not specified, auto-determination defaulted to center instead of calculating nearest edge.

**Root Cause:** `_buildDynamicOverlayAnchors()` didn't check if `anchor` was an overlay - only looked up static anchors. Result: `lineAnchor = null`, fell back to center.

**Fix:** Added overlay check for source anchor:
```javascript
const sourceAttachmentPoints = this.attachmentManager.getAttachmentPoints(raw.anchor);
if (sourceAttachmentPoints?.points) {
  // Resolve source side with auto-determination
}
```

### Issue 2: `anchor_side` not working
**Problem:** Setting `anchor_side` on source overlay had no effect - always used center.

**Root Cause:** Same as Issue 1 - source overlay attachment points weren't being resolved.

**Fix:** Same as Issue 1 - now resolves source side properly and creates virtual anchor.

### Issue 3: LineOverlay not using virtual anchors
**Problem:** Even after creating virtual anchors, LineOverlay wasn't finding them.

**Root Cause:** `LineOverlay._resolveAnchor()` and `_resolveAttachTo()` only used old `overlayAttachmentPoints` Map (never populated) or base overlay ID.

**Fix:** Updated both methods to construct virtual anchor IDs (`overlay.side`) matching AdvancedRenderer's format:
```javascript
const virtualAnchorId = side && side !== 'center'
  ? `${overlayId}.${side}`
  : overlayId;
const virtualAnchor = OverlayUtils.resolvePosition(virtualAnchorId, anchors);
```

---

## Benefits

1. **Smart Defaults:** Lines automatically choose optimal edges without manual specification
2. **Flexibility:** Can still explicitly control either or both sides when needed
3. **Cleaner Config:** Less YAML boilerplate for common cases
4. **Better Routing:** RouterCore gets better hints for path optimization
5. **Consistent Behavior:** Same logic for source and destination sides

---

## Future Enhancements

1. **Diagonal Preference:** For 45° angles, prefer corners (`top-right`, etc.)
2. **Obstacle Awareness:** Factor in other overlays when choosing sides
3. **Visual Feedback:** Show attachment points in debug mode
4. **Animation:** Smoothly transition when auto-determined side changes

---

## Notes

- Virtual anchors are ephemeral (recreated each render)
- Auto-determination runs during initial render and updates
- Center is still the fallback if geometry can't be determined
- Gap offsets are applied AFTER side determination
