# Style Update Debugging Guide

## Quick Browser Console Tests

### 1. Check if rules engine is running
```javascript
// Check if rules engine exists
console.log('RulesEngine:', window.rulesEngine);

// Check if rules are loaded
console.log('Rules:', window.rulesEngine?.rules);

// Check if overlays are tracked
console.log('Overlays:', window.rulesEngine?.overlays);
```

### 2. Find your StatusGrid
```javascript
// Find all status grids in the page
const grids = document.querySelectorAll('[data-overlay-type="status-grid"]');
console.log('Found grids:', grids);

// Get the first one
const grid = grids[0];
console.log('Grid element:', grid);

// Get grid ID
const gridId = grid.getAttribute('data-overlay-id');
console.log('Grid ID:', gridId);
```

### 3. Check cell elements
```javascript
// Find cells in the grid
const cells = grid.querySelectorAll('[data-cell-id]');
console.log('Cells:', cells);

// Check first cell's structure
const cell = cells[0];
console.log('Cell ID:', cell.getAttribute('data-cell-id'));
console.log('Cell background:', cell.querySelector('rect') || cell.querySelector('path'));
console.log('Cell background fill:', (cell.querySelector('rect') || cell.querySelector('path'))?.getAttribute('fill'));
```

### 4. Check overlay configuration
```javascript
// Get overlay config from rules engine
const overlayConfig = window.rulesEngine?.overlays?.find(o => o.id === gridId);
console.log('Overlay config:', overlayConfig);

// Check cells configuration
console.log('Cells config:', overlayConfig?.cells);

// Check specific cell config
const cellId = 'bed_light_cell'; // Replace with your cell ID
const cellConfig = overlayConfig?.cells?.find(c => c.id === cellId);
console.log('Cell config:', cellConfig);
console.log('Cell style:', cellConfig?.style);
```

### 5. Check if rules are applied
```javascript
// Get the entity that triggers your rule
const entity = 'light.tv'; // Replace with your entity
console.log('Entity state:', window.hass?.states?.[entity]);

// Check if rules match current state
window.rulesEngine?.rules?.forEach(rule => {
  console.log('Rule:', rule);
  console.log('  Condition:', rule.when);
  console.log('  Matches:', rule.when.entity === entity);
  console.log('  Patches:', rule.apply);
});
```

### 6. Manually trigger an update
```javascript
// Get the overlay instance from OverlayRegistry
const registry = window.overlayRegistry;
console.log('Registry:', registry);

const overlayInstance = registry?.getOverlay(gridId);
console.log('Overlay instance:', overlayInstance);

// Check if update method exists
console.log('Update method:', overlayInstance?.update);

// Get fresh data
const sourceData = window.dataSourceManager?.getSourceData();
console.log('Source data:', sourceData);

// Manually trigger update
if (overlayInstance && grid) {
  const result = overlayInstance.update(grid, overlayConfig, sourceData);
  console.log('Update result:', result);
}
```

### 7. Check StatusGridRenderer directly
```javascript
// Try calling updateGridData directly
const StatusGridRenderer = window.StatusGridRenderer;
console.log('StatusGridRenderer:', StatusGridRenderer);

if (StatusGridRenderer && grid && overlayConfig && sourceData) {
  const result = StatusGridRenderer.updateGridData(grid, overlayConfig, sourceData);
  console.log('Direct update result:', result);
}
```

### 8. Check ButtonRenderer.updateButtonStyle
```javascript
// Test ButtonRenderer.updateButtonStyle directly on a cell
const ButtonRenderer = window.ButtonRenderer;
console.log('ButtonRenderer:', ButtonRenderer);

const testCell = cells[0];
const testStyle = {
  color: 'var(--lcars-yellow)',
  opacity: 0.8,
  bracket_color: 'var(--lcars-yellow)'
};

if (ButtonRenderer) {
  const result = ButtonRenderer.updateButtonStyle(testCell, testStyle, {width: 100, height: 50});
  console.log('Style update result:', result);

  // Check if fill changed
  const bg = testCell.querySelector('rect') || testCell.querySelector('path');
  console.log('New fill:', bg?.getAttribute('fill'));
}
```

### 9. Check console logs
```javascript
// Enable debug logging
localStorage.setItem('cblcars:logLevel', 'debug');

// Reload the page and watch console for:
// - [StatusGridRenderer] Updating status grid...
// - [StatusGridRenderer] ✅ Updated style for cell...
// - [ButtonRenderer] Updating style for button...
// - [ButtonRenderer] ✅ Style updated for button...
```

### 10. Check what's actually in the DOM
```javascript
// After a state change, check the actual DOM attributes
const cell = grid.querySelector('[data-cell-id="bed_light_cell"]');
const bg = cell?.querySelector('rect') || cell?.querySelector('path');

console.log('Current cell attributes:', {
  fill: bg?.getAttribute('fill'),
  opacity: bg?.getAttribute('opacity'),
  stroke: bg?.getAttribute('stroke'),
  'stroke-width': bg?.getAttribute('stroke-width')
});

// Check brackets
const brackets = cell?.querySelectorAll('[data-bracket]');
console.log('Bracket colors:', Array.from(brackets || []).map(b => b.getAttribute('stroke')));

// Check text colors
const texts = cell?.querySelectorAll('text');
console.log('Text colors:', Array.from(texts || []).map(t => t.getAttribute('fill')));
```

## Common Issues to Check

### Issue 1: Rules not applying
**Symptom**: Cell config doesn't have patched styles
**Check**:
```javascript
const cellConfig = overlayConfig?.cells?.find(c => c.id === 'bed_light_cell');
console.log('Cell color:', cellConfig?.style?.cell_color);
// Should be 'var(--lcars-yellow)' when light is on
```
**Fix**: Check rules engine is running and entity state matches

### Issue 2: Update not triggered
**Symptom**: No console logs about updates
**Check**:
```javascript
// Watch for DataSource updates
window.dataSourceManager?.on('update', (data) => {
  console.log('DataSource update:', data);
});
```
**Fix**: Ensure DataSource is subscribed to entity changes

### Issue 3: updateGridData not called
**Symptom**: Content updates but no style updates
**Check**:
```javascript
// Set breakpoint or log in StatusGridRenderer.updateGridData
// Should see: [StatusGridRenderer] Updating status grid...
```
**Fix**: Check that BaseOverlayUpdater calls updateGridData

### Issue 4: _updateCellStyle not called
**Symptom**: updateGridData runs but cells don't change
**Check**:
```javascript
// Add console.log in _updateCellStyle
// Should see: [StatusGridRenderer] ✅ Updated style for cell...
```
**Fix**: Check that _updateCellStyle is being called in forEach loop

### Issue 5: ButtonRenderer.updateButtonStyle returns false
**Symptom**: _updateCellStyle runs but returns false
**Check**:
```javascript
// Check if style actually changed
const cellConfig = overlayConfig?.cells?.find(c => c.id === 'bed_light_cell');
console.log('Resolved cell style:', cellConfig?.style);
```
**Fix**: Check style resolution includes rules patches

### Issue 6: DOM not updating
**Symptom**: updateButtonStyle returns true but DOM unchanged
**Check**:
```javascript
// Check if querySelector finds elements
const cell = grid.querySelector('[data-cell-id="bed_light_cell"]');
const bg = cell?.querySelector('rect') || cell?.querySelector('path');
console.log('Background element:', bg);
```
**Fix**: Check element selectors match actual DOM structure

## Full Diagnostic Script

Run this complete diagnostic:

```javascript
console.log('=== CB-LCARS Style Update Diagnostic ===\n');

// 1. Check environment
console.log('1. Environment Check');
console.log('   RulesEngine:', !!window.rulesEngine);
console.log('   OverlayRegistry:', !!window.overlayRegistry);
console.log('   DataSourceManager:', !!window.dataSourceManager);
console.log('   ButtonRenderer:', !!window.ButtonRenderer);
console.log('   StatusGridRenderer:', !!window.StatusGridRenderer);

// 2. Find grids
console.log('\n2. Finding Status Grids');
const grids = document.querySelectorAll('[data-overlay-type="status-grid"]');
console.log('   Found grids:', grids.length);

if (grids.length === 0) {
  console.error('   ❌ No status grids found!');
} else {
  const grid = grids[0];
  const gridId = grid.getAttribute('data-overlay-id');
  console.log('   Grid ID:', gridId);

  // 3. Check cells
  console.log('\n3. Checking Cells');
  const cells = grid.querySelectorAll('[data-cell-id]');
  console.log('   Found cells:', cells.length);

  cells.forEach((cell, i) => {
    const cellId = cell.getAttribute('data-cell-id');
    const bg = cell.querySelector('rect') || cell.querySelector('path');
    console.log(`   Cell ${i}: ${cellId}`);
    console.log(`     Fill: ${bg?.getAttribute('fill')}`);
    console.log(`     Opacity: ${bg?.getAttribute('opacity')}`);
  });

  // 4. Check overlay config
  console.log('\n4. Checking Overlay Config');
  const overlayConfig = window.rulesEngine?.overlays?.find(o => o.id === gridId);
  if (overlayConfig) {
    console.log('   ✅ Found overlay config');
    console.log('   Cells in config:', overlayConfig.cells?.length);

    overlayConfig.cells?.forEach(cell => {
      console.log(`   Cell ${cell.id}:`);
      console.log(`     cell_color: ${cell.style?.cell_color || cell.cell_color}`);
      console.log(`     bracket_color: ${cell.style?.bracket_color}`);
    });
  } else {
    console.error('   ❌ Overlay config not found!');
  }

  // 5. Check rules
  console.log('\n5. Checking Rules');
  const rules = window.rulesEngine?.rules || [];
  console.log('   Total rules:', rules.length);

  rules.forEach((rule, i) => {
    console.log(`   Rule ${i}:`);
    console.log(`     Entity: ${rule.when?.entity}`);
    console.log(`     State: ${rule.when?.state}`);
    console.log(`     Patches: ${rule.apply?.length}`);
  });

  // 6. Check entity states
  console.log('\n6. Checking Entity States');
  const entities = new Set();
  rules.forEach(rule => {
    if (rule.when?.entity) entities.add(rule.when.entity);
  });

  entities.forEach(entity => {
    const state = window.hass?.states?.[entity];
    console.log(`   ${entity}: ${state?.state || 'unknown'}`);
  });
}

console.log('\n=== End Diagnostic ===');
```

## Next Steps

1. **Run the full diagnostic script** above
2. **Check console output** for any ❌ errors
3. **Toggle your light** (or whatever entity triggers the rule)
4. **Watch console** for update logs
5. **Report back** with what you see!

## Expected Console Logs When Working

When you toggle the light, you should see:
```
[DataSource] Entity updated: light.tv
[RulesEngine] Evaluating rules for light.tv
[RulesEngine] Rule matched, applying patches
[StatusGridRenderer] Updating status grid bedroom_status_grid with DataSource data
[StatusGridRenderer] ✅ Updated style for cell bed_light_cell
[ButtonRenderer] Updating style for button bed_light_cell
[ButtonRenderer] ✅ Style updated for button bed_light_cell
```

If you don't see these logs, that tells us where the problem is!
