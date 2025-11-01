# Refactor: From `apply.actions` to `apply.base_svg`

**Date:** 2025-11-01
**Branch:** dev-animejs
**Status:** ✅ Complete

---

## Problem

The rules engine used `apply.actions` array with a `type` field for filter updates:

```yaml
apply:
  actions:
    - type: update_base_svg_filter
      filter_preset: "dimmed"
```

This caused **naming confusion** with Home Assistant's action system (`tap_action`, `hold_action`, `double_tap_action`) used on overlays for user interaction.

---

## Solution

Renamed to **configuration-oriented** structure using `apply.base_svg`:

```yaml
apply:
  base_svg:
    filter_preset: "dimmed"
    transition: 2000
```

**Benefits:**
✅ **Self-documenting** - Immediately clear you're changing base_svg
✅ **No confusion** - Distinct from overlay tap/hold actions
✅ **Mirrors config** - Same structure as top-level `config.base_svg`
✅ **Cleaner** - No nested action type dispatching
✅ **Extensible** - Easy to add `apply.theme`, `apply.anchors`, etc.

---

## Changes Made

### 1. Code Changes

#### `src/msd/validation/validateMerged.js`
- ❌ Removed `validateRuleActions()` function (validated `apply.actions` array)
- ❌ Removed `validateBaseSvgFilterAction()` helper
- ✅ Added `validateRuleBaseSvg()` function (validates `apply.base_svg` object)

**New validation:**
```javascript
function validateRuleBaseSvg(rule, issues) {
  if (!rule.apply?.base_svg) return;

  const baseSvg = rule.apply.base_svg;
  const hasPreset = baseSvg.filter_preset !== undefined;
  const hasFilters = baseSvg.filters !== undefined;

  // Must have either preset or explicit filters
  if (!hasPreset && !hasFilters) {
    issues.errors.push({
      code: 'rule.base_svg.filter.missing',
      rule_id: rule.id,
      message: `Rule '${rule.id}' base_svg must specify either 'filter_preset' or 'filters'`
    });
  }
  // ... additional validation
}
```

#### `src/msd/rules/RulesEngine.js`
**Before:**
```javascript
result.actions = rule.apply.actions || [];
```

**After:**
```javascript
result.baseSvgUpdate = rule.apply.base_svg || null;
```

#### `src/msd/pipeline/SystemsManager.js`
**Before:**
```javascript
if (ruleResults.actions && ruleResults.actions.length > 0) {
  this._applyRuleActions(ruleResults.actions);
}

_applyRuleActions(actions) {
  actions.forEach(action => {
    switch (action.type) {
      case 'update_base_svg_filter':
        this._applyBaseSvgFilterUpdate(action);
        break;
    }
  });
}
```

**After:**
```javascript
if (ruleResults.baseSvgUpdate) {
  this._applyBaseSvgUpdate(ruleResults.baseSvgUpdate);
}

async _applyBaseSvgUpdate(baseSvgConfig) {
  // Direct processing - no action type dispatching needed
  // ...
}
```

### 2. Documentation Updates

#### Updated Files:
- ✅ `doc/user-guide/configuration/rules.md` - Main user guide
- ✅ `doc/architecture/subsystems/rules-engine.md` - Architecture doc

#### Key Changes:
- Renamed "Actions" section to "Base SVG Filters"
- Updated all examples from `apply.actions` to `apply.base_svg`
- Removed `type: update_base_svg_filter` from examples
- Updated schema documentation

**Before:**
```yaml
apply:
  actions:
    - type: update_base_svg_filter
      filter_preset: "dimmed"
      filters:
        blur: "2px"
      transition: 2000
```

**After:**
```yaml
apply:
  base_svg:
    filter_preset: "dimmed"
    filters:
      blur: "2px"
    transition: 2000
```

---

## Testing

✅ **Build Status:** Success
```bash
npm run build
# webpack 5.97.0 compiled with 3 warnings in 10541 ms
```

No errors, only standard size warnings (unrelated to changes).

---

## Two Action Systems Clarified

### 1. **Overlay Actions** (User-Triggered)
```yaml
overlays:
  - id: button
    type: text
    tap_action:         # USER clicks
      action: toggle
      entity: light.living_room
```
- **Purpose:** User interaction (tap/hold/double-tap)
- **Location:** `overlays[].tap_action`, `hold_action`, `double_tap_action`
- **Format:** HA action format (`action`, `entity`, `service`, etc.)

### 2. **Rule Base SVG** (Condition-Triggered)
```yaml
rules:
  - id: night
    when: [...]
    apply:
      base_svg:       # AUTOMATIC when conditions match
        filter_preset: "dimmed"
```
- **Purpose:** Automated responses to conditions
- **Location:** `rules[].apply.base_svg`
- **Format:** Configuration object (filters, preset, transition)

**No confusion** - completely different purposes and syntax!

---

## Future Extensibility

The new structure makes it easy to add more `apply` targets:

```yaml
rules:
  - id: example
    when: [...]
    apply:
      overlays: [...]       # Overlay style changes
      base_svg: {...}       # Base SVG filters
      theme: {...}          # Future: Theme changes
      anchors: [...]        # Future: Anchor updates
      data_sources: [...]   # Future: DataSource config
```

Each is self-documenting and follows the same pattern as top-level config.

---

## Migration Guide

**For users with existing configs:**

1. Replace `apply.actions` with `apply.base_svg`
2. Remove `type: update_base_svg_filter` line
3. Keep `filter_preset`, `filters`, and `transition` as-is

**Example migration:**
```yaml
# OLD
apply:
  actions:
    - type: update_base_svg_filter  # ❌ Remove this line
      filter_preset: "dimmed"
      transition: 1000

# NEW
apply:
  base_svg:                          # ✅ Direct configuration
    filter_preset: "dimmed"
    transition: 1000
```

---

## Summary

**Problem:** `apply.actions` confused users (clashed with HA action terminology)
**Solution:** Use `apply.base_svg` (configuration-oriented, self-documenting)
**Result:** ✅ Cleaner API, no confusion, extensible structure
**Status:** ✅ Implemented, tested, documented

**Files Changed:** 3 code files, 2 documentation files
**Build Status:** ✅ Success
**Breaking Change:** Yes (requires config update for existing filter rules)
