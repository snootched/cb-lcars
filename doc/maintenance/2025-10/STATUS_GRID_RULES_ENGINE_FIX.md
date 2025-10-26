# StatusGrid Rules Engine Fix - Documentation

## Problem Summary
StatusGrid cells were not updating their colors when rules changed based on entity state changes.

## Root Causes Identified

### 1. Missing `RulesEngine.ingestHass()` Method
**Location**: `src/msd/rules/RulesEngine.js`

**Issue**: There were TWO `ingestHass()` methods:
- Line 346: Correct class method that marks all rules dirty and triggers callback
- Line 1248: OLD prototype assignment that only checked for entity ID additions/removals (not state changes)

The prototype method overwrote the class method, so when entities changed state (not added/removed), no rules were marked dirty.

**Fix**: Removed the old prototype method (lines 1240-1295).

### 2. DataSourceManager Not Updating HASS Object
**Location**: `src/msd/data/DataSourceManager.js`

**Issue**: When entity state changes occurred:
1. MsdDataSource received websocket events and emitted to subscribers
2. DataSourceManager was notified but didn't update its `this.hass.states` object
3. SystemsManager synced from stale `dataSourceManager.hass`
4. RulesEngine evaluated with stale entity states

**Fix**: Modified DataSource subscription callback (lines 80-92) to update `this.hass.states[entityId]` with fresh state from `source._lastOriginalState`.

## Architecture Understanding

### Update Flow for Rule-Based Style Changes

#### Initial Render
1. User loads page
2. PipelineCore initializes with HASS
3. RulesEngine evaluates all rules
4. ModelBuilder applies rule patches to overlay configs
5. StatusGridRenderer renders cells with patched styles

#### Entity State Change
1. User toggles entity (e.g., light switch)
2. **WebSocket Event**: HA sends `state_changed` event
3. **MsdDataSource**: Receives event, updates internal state, emits to subscribers
4. **DataSourceManager**:
   - Subscription callback receives emit
   - Updates `this.hass.states[entityId]` (NEW FIX)
   - Notifies entity change listeners
5. **SystemsManager**:
   - Detects entity change via DataSource
   - Syncs `this._hass` from `dataSourceManager.hass`
   - Marks affected rules dirty in RulesEngine
   - Evaluates dirty rules with fresh HASS
   - Schedules full re-render
6. **Re-render Flow**:
   - ModelBuilder re-applies rules (with fresh evaluation)
   - Rule patches updated on overlay.cells
   - StatusGridRenderer renders cells with NEW patched styles
7. **Result**: Cell colors update to match new entity state

### Why Full Re-render (Not Incremental Update)

The system uses **full re-renders** for rule changes because:
- Rules can affect ANY property (color, opacity, text, visibility, etc.)
- Multiple cells may be affected by one entity change
- Multiple rules may apply to one cell
- Clean slate ensures consistency

**Incremental updates** are used for:
- DataSource content changes (cell text/values)
- No rule evaluation changes

## Style Resolution Architecture

### 5-Layer Priority System
StatusGridRenderer uses a unified 5-layer style resolution:

1. **Theme Defaults** (lowest priority)
   - From ThemeManager
   - All properties marked as 'computed'

2. **Overlay Preset**
   - `overlay.style.lcars_button_preset`
   - Loaded from StylePresetManager
   - Token resolution applied
   - Properties marked as 'computed'

3. **Overlay Styles**
   - `overlay.style` properties
   - Token resolution applied
   - Properties marked as 'explicit'

4. **Cell Preset**
   - `cell.lcars_button_preset`
   - Loaded from StylePresetManager
   - Token resolution applied
   - Properties marked as 'computed'

5. **Cell Styles** (highest priority)
   - **Rule Patches**: `cell._rulePatch` (HIGHEST - NEW)
   - `cell.style` properties
   - Direct `cell` properties
   - Token resolution applied
   - Properties marked as 'explicit' or 'rule_patch'

### Rule Patch Processing
**Location**: `src/msd/renderer/StatusGridRenderer.js:536-553`

Rule patches are applied in `_resolveCellStyleLayer()`:
```javascript
if (cellConfig._rulePatch) {
  Object.entries(cellConfig._rulePatch).forEach(([property, value]) => {
    // Resolve tokens
    const resolvedValue = this._resolveTokenValue(value, property);

    // Rule patches override everything
    mergedStyle[property] = resolvedValue;
    priorityTracker.explicit.set(property, 'rule_patch');
  });
}
```

**Properties Processed**: ALL properties in `_rulePatch` are applied with token resolution.

### Cell Style Mapping
**Location**: `src/msd/renderer/StatusGridRenderer.js:1321-1365`

Resolved styles are mapped to ButtonRenderer format:
- `cell_color` → `color`
- `cell_radius` → `border_radius`
- `cell_opacity` → `opacity`
- `bracket_color` → `bracket_color`
- Plus: font properties, positioning, CB-LCARS features

**Advanced Features** from RendererUtils:
- Gradients
- Patterns
- Glow effects
- Shadows
- Blur effects

## Code Cleanup Needed

### Debug Logging to Remove

1. **StatusGridRenderer.js**:
   - Lines 1297-1306: Excessive debug in `_resolveCellStyle` entry
   - Lines 1387-1395: Excessive debug in `_resolveCellStyle` exit
   - Lines 531-534: Debug in `_resolveCellStyleLayer` entry
   - Lines 546-550: Per-property debug in rule patch loop
   - Lines 564-568: Per-property debug in cell.style loop
   - Lines 586-590: Per-property debug in cell direct loop

2. **SystemsManager.js**:
   - Lines 437-443: Enhanced HASS sync logging (keep oldLightState check, simplify)

3. **RulesEngine.js**:
   - Lines 352-356: Enhanced ingestHass logging (simplify)
   - Lines 362-370: Callback execution logging (simplify)

### Potential Dead Code

1. **StatusGridRenderer.js: `_updateCellStyle()` method** (lines 3139-3177)
   - Calls non-existent `_resolveCellButtonStyle()` (line 3150)
   - Used for incremental style updates
   - BUT: Full re-renders handle rule changes
   - **Analysis Needed**: Is this path ever reached?

2. **StatusGridRenderer.js: Duplicate/Legacy Methods**
   - Check for old style resolution methods
   - Check for unused helper methods

### Missing Implementation

**`_resolveCellButtonStyle()` method** - Called but doesn't exist!
- Line 3150 calls it
- Should probably just call `_resolveCellStyle()` instead
- Or remove if the incremental path is truly unused

## Testing Performed

### Test Scenario
- Light entity: `light.tv`
- StatusGrid cell: `bed_light_cell`
- Rule 1: When light ON → cell_color: yellow, opacity: 0.9
- Rule 2: When light OFF → cell_color: gray, opacity: 0.6

### Test Results
✅ Initial render with light OFF → Cell renders gray
✅ Toggle light ON → Cell updates to yellow
✅ Toggle light OFF → Cell updates to gray
✅ Cell content (text) updates correctly
✅ No console errors
✅ Full re-render triggered on entity change

## Next Steps

1. **Remove excess debug logging** (see list above)
2. **Fix or remove `_updateCellStyle()` method**
   - Either implement `_resolveCellButtonStyle()`
   - Or remove the incremental style update (if truly unused)
3. **Search for duplicate/legacy code** in StatusGridRenderer
4. **Apply similar fixes to ApexCharts overlay**
5. **Performance optimization**:
   - Profile full re-render cost
   - Consider targeted updates for single-cell changes
   - Cache style resolution results?

## Questions for Review

1. **Are ALL StatusGrid style properties being processed?**
   - Current mapping looks comprehensive (lines 1321-1365)
   - Includes visual, text, positioning, CB-LCARS features, and RendererUtils effects
   - ✅ Appears complete

2. **Is the incremental update path (`_updateCellStyle`) actually used?**
   - Called from `updateGridData()` for DataSource updates
   - But full re-renders handle rule changes
   - Need to verify if this path works or can be removed

3. **Are there similar issues in ApexCharts?**
   - Need to check if ApexChartsOverlayRenderer has similar stale HASS issues
   - Check if it properly reads rule patches
   - Check if it has dead code paths

4. **Performance implications?**
   - Full re-renders on every entity change
   - Is this acceptable for large grids?
   - Should we optimize for single-cell updates?
