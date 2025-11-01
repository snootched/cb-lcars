# Filter Clearing Support - Implementation Summary

## Overview

Added support for **clearing/removing filters** in the Rules Engine actions system. Users can now easily remove all filtering and return to the unfiltered base SVG state.

## Changes Made

### 1. Code Changes

#### `SystemsManager.js` - Filter Clearing Logic
```javascript
// Check if this is a clear/remove operation
const isClearOperation = action.filter_preset === 'none' ||
                         (filters && Object.keys(filters).length === 0);

if (isClearOperation || !filters) {
  // Clear filters (remove all filtering)
  const { clearBaseSvgFilters } = await import('../utils/BaseSvgFilters.js');
  clearBaseSvgFilters(baseSvgElement, transition);
  cblcarsLog.debug(`[SystemsManager] ✅ Cleared base SVG filters`);
  return;
}
```

**What Changed:**
- Added detection for `filter_preset: "none"` or empty `filters: {}`
- Calls `clearBaseSvgFilters()` with transition support
- Maintains smooth transitions when clearing filters

#### `ThemeManager.js` - "none" Preset
```javascript
export const BUILTIN_FILTER_PRESETS = {
  // No filters - clear/remove all filtering
  none: {},

  // ... other presets
};
```

**What Changed:**
- Added `none` preset to built-in presets
- Empty object `{}` signals filter clearing
- Works like any other preset

### 2. Usage Patterns

#### Pattern 1: Using "none" Preset
```yaml
rules:
  - id: alert_on
    when:
      entity: binary_sensor.alert
      state: "on"
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "red-alert"
          transition: 500

  - id: alert_off
    when:
      entity: binary_sensor.alert
      state: "off"
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "none"  # ← Clear all filters
          transition: 1000
```

#### Pattern 2: Using Empty Filters Object
```yaml
rules:
  - id: normal_mode
    when:
      entity: input_boolean.normal_mode
      state: "on"
    apply:
      actions:
        - type: update_base_svg_filter
          filters: {}  # ← Clear all filters
          transition: 1000
```

#### Pattern 3: Time-Based Filter Toggle
```yaml
rules:
  # Apply filter at night
  - id: night_mode
    priority: 100
    when:
      all:
        - entity: sensor.time
        - time: { after: "22:00", before: "06:00" }
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "dimmed"
          transition: 2000

  # Clear filter during day
  - id: day_mode
    priority: 90
    when:
      all:
        - entity: sensor.time
        - time: { after: "06:00", before: "22:00" }
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "none"  # ← Return to normal
          transition: 2000
```

### 3. Documentation Updates

#### Updated Files:
1. **`doc/architecture/subsystems/rules-engine.md`**
   - Added `none` preset to built-in presets list
   - Added "Clearing filters" example section

2. **`doc/user-guide/configuration/rules.md`**
   - Added `none` preset to built-in presets list
   - Added "Example: Clearing Filters" section with both methods

3. **`doc/user-guide/configuration/base-svg-filters.md`**
   - Added `none` preset documentation
   - Added "Clearing Filters with Rules" section with examples

## Technical Details

### How It Works

1. **Detection**: Checks if `filter_preset === 'none'` or `filters` is empty object
2. **Clearing**: Calls `clearBaseSvgFilters(element, transition)`
3. **Transition**: Supports smooth transitions when clearing (default: 1000ms)
4. **CSS**: Sets `element.style.filter = ''` with optional CSS transition

### Transition Support

```javascript
// With transition
clearBaseSvgFilters(svgElement, 2000);  // 2-second fade out

// Instant (no transition)
clearBaseSgFilters(svgElement, 0);
```

The transition is applied using CSS:
```javascript
element.style.transition = `filter ${transition}ms ease-in-out`;
element.style.filter = '';  // Clear filters
```

### Edge Cases Handled

✅ **Empty filters object**: `filters: {}`
✅ **"none" preset**: `filter_preset: "none"`
✅ **No filters at all**: No `filters` or `filter_preset` specified
✅ **Transition duration**: Defaults to 1000ms, customizable
✅ **Null/undefined**: Handled gracefully

## Benefits

### For Users
- **Clear API**: Two intuitive ways to clear filters (`none` preset or `{}`)
- **Smooth Transitions**: Filters fade out gracefully
- **Toggle Patterns**: Easy on/off filter patterns for alerts, modes, etc.
- **Consistent**: Works like applying filters, just removes them

### For Developers
- **Reuses Existing Code**: Uses `clearBaseSvgFilters()` from `BaseSvgFilters.js`
- **No Breaking Changes**: Existing code continues to work
- **Consistent Architecture**: Follows same pattern as other actions
- **Well Documented**: Complete examples and explanations

## Complete Example

### Alert System with Filter Toggle

```yaml
msd:
  version: 1

  base_svg:
    source: builtin:ncc-1701-d

  overlays:
    - id: alert_status
      type: text
      text: "Normal"
      position: [100, 100]

  rules:
    # Critical alert - apply dramatic filter
    - id: critical_alert
      priority: 100
      when:
        entity: binary_sensor.critical_alert
        state: "on"
      apply:
        actions:
          - type: update_base_svg_filter
            filter_preset: "red-alert"
            transition: 500  # Fast transition
        overlays:
          - id: alert_status
            style:
              text: "⚠️ CRITICAL ALERT"
              color: var(--lcars-red)
      stop: true

    # Warning - apply moderate filter
    - id: warning_alert
      priority: 50
      when:
        entity: binary_sensor.warning_alert
        state: "on"
      apply:
        actions:
          - type: update_base_svg_filter
            filters:
              opacity: 0.5
              hue_rotate: "30deg"
            transition: 1000
        overlays:
          - id: alert_status
            style:
              text: "⚠️ Warning"
              color: var(--lcars-yellow)

    # Normal - clear all filters
    - id: normal_state
      priority: 10
      when:
        all:
          - entity: binary_sensor.critical_alert
            state: "off"
          - entity: binary_sensor.warning_alert
            state: "off"
      apply:
        actions:
          - type: update_base_svg_filter
            filter_preset: "none"  # ← Clear filters
            transition: 1500  # Slow fade back to normal
        overlays:
          - id: alert_status
            style:
              text: "Normal"
              color: var(--lcars-green)
```

## Testing

### Test Cases
1. ✅ Apply filter → Clear with `none` preset
2. ✅ Apply filter → Clear with empty `filters: {}`
3. ✅ Multiple filter changes with transitions
4. ✅ Time-based filter clearing
5. ✅ Alert on/off toggle pattern
6. ✅ Priority-based filter rules with clearing

### Verified Behavior
- Smooth transitions when clearing
- No console errors
- Proper CSS filter property clearing
- Compatible with all existing filters
- Works with all built-in presets

## Migration

**No migration needed** - this is a new feature that doesn't affect existing configurations.

### Before (worked, but no clear option):
```yaml
rules:
  - id: dim_mode
    when: { ... }
    apply:
      actions:
        - type: update_base_svg_filter
          filters: { opacity: 0.3 }
```

### After (new clearing capability):
```yaml
rules:
  - id: dim_mode
    when: { ... }
    apply:
      actions:
        - type: update_base_svg_filter
          filters: { opacity: 0.3 }

  - id: normal_mode
    when: { ... }
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "none"  # ← NEW: Clear filters
```

## Future Enhancements

Potential future additions:
- `clear_filters` action type (explicit action)
- Animation curves for transitions
- Filter interpolation (gradual changes)
- Scheduled filter clearing

---

**Implementation Date:** November 1, 2025
**Feature Version:** 2025.10.1-fuk.42-69
**Files Modified:** 5
**New Preset:** `none`
**Documentation Updated:** Complete
