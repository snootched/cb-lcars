# Overlay Auto-Update Investigation Summary

## Problem
Text and button overlays with datasource templates like `{test_sensor}` don't auto-update when the datasource changes.

## What We Discovered

### 1. **Phase 2 Animations Work Fine**
- Animations with `on_datasource_change` trigger correctly
- AnimationManager properly subscribes to datasources
- This proves datasource change detection works

### 2. **Existing Subscription System**
- `ModelBuilder._subscribeTextOverlaysToDataSources()` is supposed to handle overlay subscriptions
- It calls `AdvancedRenderer.updateOverlayData()` when datasources change
- **But it only finds overlays with explicit `data_source` property**, not template syntax

### 3. **Root Cause**
Templates like `text: "{test_sensor}"` are **resolved BEFORE** ModelBuilder sees them:
- ModelBuilder checks `overlay.text` but it's already empty/resolved
- The `_raw` property exists but doesn't contain the original templates
- So ModelBuilder can't extract datasource references from templates

### 4. **What Doesn't Work**
- ❌ Adding subscriptions to OverlayBase - wrong architecture
- ❌ Checking `_raw` properties - they're empty by the time ModelBuilder runs
- ❌ Templates are resolved during config merge/processing, long before overlays are built

## Clean Solution (Recommended)

### Option A: Track Templates During Resolution
When templates are resolved, **track which overlays use which datasources**:

1. In `TemplateProcessor` or wherever templates are resolved
2. Store a map: `overlayId -> [datasourceIds]`
3. Pass this map to ModelBuilder
4. ModelBuilder uses it to create subscriptions

### Option B: Use Explicit data_source Property
Document that auto-updates require explicit `data_source`:

```yaml
overlays:
  - id: my_text
    type: text
    text: "Value: {my_sensor}"
    data_source: my_sensor  # Explicit reference for auto-updates
```

## Files Modified (Need Revert)
1. `src/msd/overlays/OverlayBase.js` - Added invalid subscription code
2. `src/msd/overlays/TextOverlay.js` - Modified initialize()
3. `src/msd/renderer/AdvancedRenderer.js` - Added initialization call
4. `src/msd/pipeline/ModelBuilder.js` - Enhanced _subscribeTextOverlaysToDataSources()

## Recommendation
**Revert all changes** and implement Option A cleanly in a focused PR that:
1. Tracks datasource usage during template resolution
2. Passes that info to ModelBuilder
3. Tests thoroughly

This avoids the mess of trying to extract datasources after templates are gone.
