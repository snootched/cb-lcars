# Warning Cleanup - Noise Reduction

**Date:** October 30, 2025
**Status:** ✅ Complete

---

## Overview

Demoted noisy warnings to debug level to improve console clarity. These warnings were cluttering logs with expected/normal behaviors rather than actual issues.

## Changes Made

### 1. TextOverlay - Status Indicator Check
**File:** `src/msd/overlays/TextOverlay.js:97`

**Before:**
```javascript
cblcarsLog.warn(`[TextOverlay] ⚠️ No status_indicator in style for ${overlay.id}`);
```

**After:**
```javascript
// Not an issue - status indicators are optional decorations
cblcarsLog.debug(`[TextOverlay] 📍 No status_indicator configured for ${overlay.id}`);
```

**Rationale:** Status indicators are optional decorative elements. Most text overlays don't use them, so warning about their absence is noise.

---

### 2. RendererUtils - Transform Info
**File:** `src/msd/renderer/RendererUtils.js:132`

**Before:**
```javascript
cblcarsLog.warn('[RendererUtils] ⚠️ No transform info available, using pixel metrics');
```

**After:**
```javascript
// Fallback to pixel metrics is acceptable - not all contexts have transform info
cblcarsLog.debug('[RendererUtils] No transform info available, using pixel metrics');
```

**Rationale:** Falling back to pixel metrics is normal behavior in certain contexts. The renderer continues working correctly, so this is informational, not a warning.

---

### 3. AdvancedRenderer - Attachment Points
**File:** `src/msd/renderer/AdvancedRenderer.js:707`

**Before:**
```javascript
cblcarsLog.warn(`[AdvancedRenderer] ⚠️ No attachment points found for ${dest}`);
```

**After:**
```javascript
// Some overlays don't need attachment points (e.g., anchors, controls)
cblcarsLog.debug(`[AdvancedRenderer] No attachment points found for ${dest}`);
```

**Rationale:** Not all overlay types support attachment points (e.g., anchors, controls). This is expected behavior, not a problem.

---

### 4. DataSourceMixin - DataSource Not Found (2 locations)
**File:** `src/msd/renderer/DataSourceMixin.js:82, 275`

**Before:**
```javascript
cblcarsLog.warn(`[${rendererName}] 🔗 DataSource '${sourceName}' not found`);
```

**After:**
```javascript
// Not necessarily an error - data sources may be optional or not initialized yet
cblcarsLog.debug(`[${rendererName}] DataSource '${sourceName}' not found`);
```

**Rationale:** Data sources may not exist yet during initialization, or they may be optional references. The system handles this gracefully by showing fallback text, so warning level is too aggressive.

---

## Impact

### Before Cleanup (from `debug_button.log`)
Console was filled with warnings like:
```
⚠️ No status_indicator in style for hvac-status
⚠️ No status_indicator in style for heating-duration
⚠️ No status_indicator in style for hvac-state-text
⚠️ No status_indicator in style for test_text
🔗 DataSource 'test_cpu_temp' not found
⚠️ No attachment points found for emergency_button
⚠️ No attachment points found for debug_anchor_2
⚠️ No attachment points found for debug_anchor_3
⚠️ No attachment points found for debug_anchor_4
⚠️ No transform info available, using pixel metrics
```

### After Cleanup
These expected behaviors are now logged at debug level:
- ✅ Only visible when debugging is enabled
- ✅ Doesn't clutter production console
- ✅ Still available for troubleshooting

### Still at Warning Level (as they should be)
```
⚠️ Overlay validation found issues: {total: 19, invalid: 5}
⚠️ No renderer instance for overlay control1
⚠️ Config applied but no triggers_update found
⚠️ StyleResolverService initialization failed
```

These are **actual issues** that need attention.

---

## Pattern Recognition

### What Makes a Good Warning?
- **Actionable**: User/developer can fix it
- **Unexpected**: Represents something wrong with configuration or code
- **Impactful**: Causes or may cause functional issues

### What Should Be Debug Level?
- **Expected Behavior**: Normal operational states
- **Optional Features**: Missing optional elements is fine
- **Fallback Logic**: System gracefully handling missing data
- **Informational**: Useful for debugging but not problems

---

## Developer Guidelines

When adding new log messages, ask:

1. **Is this unexpected?** → `warn/error`
2. **Does it indicate a problem?** → `warn/error`
3. **Can the user fix it?** → `warn/error`
4. **Is it just informational?** → `debug/info`
5. **Does the system handle it?** → `debug/info`

---

## Testing

### Build Status
```bash
npm run build
# ✅ Success (0 errors, 3 warnings - webpack size only)
# ✅ Size: 1.69 MiB
```

### Console Impact
- **Before:** ~15-20 noise warnings per render
- **After:** Only real issues shown as warnings
- **Debug Mode:** All messages still available for troubleshooting

---

## Files Modified

1. `src/msd/overlays/TextOverlay.js` (1 change)
2. `src/msd/renderer/RendererUtils.js` (1 change)
3. `src/msd/renderer/AdvancedRenderer.js` (1 change)
4. `src/msd/renderer/DataSourceMixin.js` (2 changes)

**Total:** 5 warning→debug demotions across 4 files

---

## Future Cleanup Candidates

Other potential noise warnings to review (not done in this pass):

- `[MsdDataSource] No history data returned` - May be expected during initialization
- `[RulesEngine] Using fallback getEntity` - Fallback working correctly
- `[MsdControls] Config applied but no triggers_update` - May be intentional
- Debug API "not available" warnings - Expected when debug interface not initialized

**Recommendation:** Monitor these and demote if they prove to be noise.

---

**Status:** ✅ Complete - Console logs now show actual issues, not expected behaviors
