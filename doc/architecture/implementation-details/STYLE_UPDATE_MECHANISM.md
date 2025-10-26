# Style Update Mechanism Implementation

## Problem
Rules engine patches were applying to button configurations but visual updates weren't happening. Cell content (labels) updated correctly, but style changes (colors, opacity, borders) did not reflect in the DOM.

## Root Cause
- `ButtonOverlay.update()` only checked for content changes and exited early if no content changed
- `StatusGridRenderer.updateGridData()` only called `ButtonRenderer.updateButtonData()` for content updates
- No mechanism existed to update DOM style attributes without full re-render

## Solution Architecture

### Three-Layer Implementation

#### 1. ButtonRenderer.updateButtonStyle() (Core)
**File**: `src/msd/renderer/core/ButtonRenderer.js`
**Lines**: 100-230

**Purpose**: Update button DOM attributes without full re-render

**Updates These Properties**:
- Fill color (`color` property → `fill` attribute)
- Opacity (`opacity` property → `opacity` attribute)
- Border color/width/radius (`border.*` → `stroke`, `stroke-width`, `rx` attributes)
- Bracket colors (`bracket_color` → bracket path `stroke` attributes)
- Text colors (`label_color`, `value_color` → text `fill` attributes)

**Key Features**:
- Non-destructive: Only updates changed attributes
- Efficient: No DOM manipulation beyond setAttribute
- Returns boolean indicating if updates occurred
- Handles both `rect` and `path` backgrounds

**Method Signature**:
```javascript
static updateButtonStyle(buttonElement, newStyle, size)
```

#### 2. ButtonOverlay Enhancement
**File**: `src/msd/overlays/ButtonOverlay.js`
**Lines**: 234-358

**Changes**:
- Completely rewrote `update()` method
- OLD: Only checked content changes, exited early otherwise
- NEW: Checks BOTH content AND style changes independently

**New Helper Method**: `_hasStyleChanged()`
- Compares cached vs new style for key properties
- Returns true if any style property differs
- Checks: `color`, `opacity`, `bracket_color`, `label_color`, `value_color`, `border.*`

**Update Flow**:
```javascript
update() {
  // Check content
  if (contentChanged) {
    ButtonRenderer.updateButtonData(...);
  }

  // Check style (NEW!)
  if (this._hasStyleChanged()) {
    ButtonRenderer.updateButtonStyle(...);
  }

  return updated; // true if either updated
}
```

#### 3. StatusGridRenderer Enhancement
**File**: `src/msd/renderer/StatusGridRenderer.js`
**Lines**: 3050-3120 (updateGridData), 3122-3170 (_updateCellStyle)

**Changes to updateGridData()**:
- Added section "2. Update style if cell style changed (NEW!)"
- Calls `_updateCellStyle()` for each cell after content update
- Tracks style updates separately from content updates

**New Method**: `_updateCellStyle(cellElement, cell, overlay)`
- Gets cell config from overlay (includes rules patches)
- Resolves cell button style using existing style cascade
- Calls `ButtonRenderer.updateButtonStyle()` with resolved style
- Returns boolean indicating if updates occurred

**Style Resolution**:
```javascript
_updateCellStyle(cellElement, cell, overlay) {
  const cellConfig = overlay.cells?.find(c => c.id === cell.id);
  const gridStyle = this._resolveStatusGridStyles(...);
  const cellStyle = this._resolveCellButtonStyle(cellConfig, gridStyle, ...);

  return ButtonRenderer.updateButtonStyle(cellElement, cellStyle, {...});
}
```

## How It Works

### ButtonOverlay + Rules
1. Rules engine patches `overlay.style.color` or similar
2. DataSource update triggers `ButtonOverlay.update()`
3. `_hasStyleChanged()` compares cached vs patched style
4. If different, calls `ButtonRenderer.updateButtonStyle()`
5. DOM attributes updated directly (fill, opacity, etc.)
6. No re-render, just attribute changes

### StatusGrid + Rules
1. Rules engine patches cell styles via `cell_target`
2. Entity state change triggers DataSource update
3. `StatusGridRenderer.updateGridData()` called
4. For each cell:
   - Content update via `updateButtonData()` (existing)
   - Style update via `_updateCellStyle()` (NEW!)
5. `_updateCellStyle()` resolves full cell style including patches
6. Calls `ButtonRenderer.updateButtonStyle()` per cell
7. Only changed attributes updated, no re-render

## Rules Configuration Example

```yaml
rules:
  - when:
      entity: light.tv
      state: "on"
    apply:
      - id: bedroom_status_grid
        cell_target:
          cell_id: bed_light_cell
        style:
          cell_color: var(--lcars-yellow)
          bracket_color: var(--lcars-yellow)

  - when:
      entity: light.tv
      state: "off"
    apply:
      - id: bedroom_status_grid
        cell_target:
          cell_id: bed_light_cell
        style:
          cell_color: var(--lcars-gray)
          bracket_color: var(--lcars-gray)
          cell_opacity: 0.6
```

**Expected Behavior**:
- When `light.tv` turns ON: Cell becomes yellow, brackets yellow
- When `light.tv` turns OFF: Cell becomes gray, brackets gray, opacity 0.6
- Label text updates (already worked)
- Style updates now work too!

## Testing

### Browser Console Tests
See `scripts/test-style-updates.js` for testing commands.

### Manual Testing
1. Load a card with StatusGrid + rules configuration
2. Toggle entity state (e.g., turn light on/off)
3. Observe:
   - Cell color changes immediately
   - Bracket color changes
   - Opacity changes
   - Label text updates (already worked)
   - No "Rendering" console logs (no full re-render)

### Success Criteria
- ✅ Cell color changes when entity state changes
- ✅ Bracket color changes
- ✅ Cell opacity changes
- ✅ Label text continues to update
- ✅ No full re-render
- ✅ Efficient (only changed attributes updated)
- ✅ Build passing
- ✅ No console errors

## Performance

### Before
- Style changes applied to config
- No visual update
- User confused why rules "don't work"

### After
- Style changes apply to config AND DOM
- Immediate visual update
- No re-render overhead
- Minimal DOM operations (only setAttribute on changed attributes)

### Efficiency
- Only changed attributes updated
- No SVG reconstruction
- No template re-processing
- No layout recalculation
- Just attribute updates

## Future Work

### ApexChart Color Updates
Similar issue reported: "ApexChart works once then color changes stop"
- May need different approach (ApexCharts library integration)
- Could reuse style update detection pattern
- Needs investigation of ApexCharts API

### Additional Style Properties
Currently updates:
- color, opacity
- border (color, width, radius)
- bracket_color
- label_color, value_color

Could add:
- Shadow properties
- Transform properties
- Animation properties
- Custom SVG attributes

### Performance Optimization
For grids with many cells:
- Batch attribute updates
- RequestAnimationFrame batching
- Intersection observer (only update visible cells)

## Files Changed

1. **src/msd/renderer/core/ButtonRenderer.js** (+130 lines)
   - Added `updateButtonStyle()` static method
   - Added `_updateButtonStyle()` implementation

2. **src/msd/overlays/ButtonOverlay.js** (~100 lines modified)
   - Rewrote `update()` method
   - Added `_hasStyleChanged()` helper

3. **src/msd/renderer/StatusGridRenderer.js** (+50 lines)
   - Enhanced `updateGridData()` to handle style updates
   - Added `_updateCellStyle()` method

4. **scripts/test-style-updates.js** (new file)
   - Documentation and testing guide
   - Browser console test commands

## Build Status
✅ Build passing (webpack 5.97.0)
✅ Bundle size: 1.6 MB (unchanged)
✅ MSD modules: 554 KiB (small increase for new methods)

## Conclusion

The style update mechanism is now fully implemented across the button rendering system. Rules engine style patches will trigger immediate visual updates without requiring full re-renders. This solves the "cell color won't change" issue for StatusGrid and applies to all button-based overlays.

**Ready for production testing!**
