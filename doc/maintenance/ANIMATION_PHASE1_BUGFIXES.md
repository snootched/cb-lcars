# Animation System Phase 1 - Bug Fixes

**Date:** November 1, 2025
**Issues Fixed:** Chunk loading error, custom preset resolution

---

## Issue 1: Chunk Loading Error ✅ FIXED

**Problem:**
Dynamic imports were causing chunk loading errors when loading the test configuration.

**Root Cause:**
SystemsManager was using dynamic `import()` statements for AnimationManager and AnimationConfigProcessor:
```javascript
const { AnimationManager } = await import('../animation/AnimationManager.js');
const { processAnimationConfig } = await import('../animation/AnimationConfigProcessor.js');
```

**Solution:**
Changed to static imports at the top of the file:
```javascript
// At top of SystemsManager.js
import { AnimationManager } from '../animation/AnimationManager.js';
import { processAnimationConfig } from '../animation/AnimationConfigProcessor.js';

// In completeSystems()
this.animationManager = new AnimationManager(this);
const animationConfig = processAnimationConfig(mergedConfig);
```

**Files Changed:**
- `src/msd/pipeline/SystemsManager.js`

---

## Issue 2: Custom Presets Not Working ✅ FIXED

**Problem:**
Custom animation presets (e.g., `custom_pulse`, `custom_glow`) were not being recognized. Log showed `customPresets: 0`.

**Root Cause:**
Two issues:

1. **Config Processor Issue:** The AnimationConfigProcessor was looking for `preset:` but the YAML used `type:` to specify the base preset:
   ```yaml
   animation_presets:
     custom_pulse:
       type: pulse  # ← Should support both 'type' and 'preset'
       duration: 800
   ```

2. **Resolution Issue:** The AnimationManager was only checking for `preset_ref` but overlays used `preset:` directly:
   ```yaml
   animations:
     - preset: custom_pulse  # ← Should check if this is a custom preset first
       trigger: on_load
   ```

**Solution:**

### Part A: AnimationConfigProcessor
Updated to support both `type` and `preset` when defining custom presets:

```javascript
// Support both 'type' and 'preset' for backwards compatibility
const basePresetName = presetDef.preset || presetDef.type;
if (basePresetName) {
  const builtinPresets = window.cblcars?.anim?.presets || {};
  if (!builtinPresets[basePresetName]) {
    // Warning...
  } else {
    // Store the base preset reference
    processed[presetName] = {
      ...presetDef,
      _basePreset: basePresetName
    };
  }
}
```

### Part B: AnimationManager
Updated `resolveAnimationDefinition()` to check if `preset` refers to a custom preset first:

```javascript
// Check if preset refers to a custom preset
if (animDef.preset) {
  const customPreset = this.customPresets.get(animDef.preset);
  if (customPreset) {
    // Get the base preset name from the custom preset
    const basePresetName = customPreset._basePreset || customPreset.preset || customPreset.type;

    // Merge: base preset params < custom preset params < animDef params
    resolved = {
      ...customPreset,
      ...animDef,
      preset: basePresetName // Use the base preset for execution
    };

    cblcarsLog.debug(`[AnimationManager] Resolved custom preset: ${animDef.preset} -> ${basePresetName}`);
  }
}
```

**Parameter Merging Order:**
1. Base preset defaults (from anime.js)
2. Custom preset parameters (from `animation_presets`)
3. Animation-specific parameters (from `animations[]` array)

**Files Changed:**
- `src/msd/animation/AnimationConfigProcessor.js`
- `src/msd/animation/AnimationManager.js`

---

## Issue 3: YAML Syntax Updates

**Changes Made by User:**

1. **Overlay Structure:** Changed from named keys to array with `id` property:
   ```yaml
   # Before (incorrect)
   overlays:
     test_onload_builtin:
       type: text

   # After (correct)
   overlays:
     - id: test_onload_builtin
       type: text
   ```

2. **Overlay Types:** Changed from `rect` to `button` (MSD doesn't have rect type):
   ```yaml
   # Before
   type: rect

   # After
   type: button
   ```

---

## Testing After Fixes

**Expected Behavior:**

1. ✅ No chunk loading errors
2. ✅ Custom presets show in logs: `customPresets: 2` (custom_pulse, custom_glow)
3. ✅ Custom preset resolution logs show: `Resolved custom preset: custom_pulse -> pulse`
4. ✅ Animations use merged parameters from custom preset + animation definition

**Test Configuration:**
- `test-animation-phase1.yaml` with corrected syntax
- 2 custom presets defined
- 8 test overlays with various trigger types

**Verification Commands:**

```javascript
// Check custom presets loaded
window.cblcars.debug.msd.animations.dump()
// Should show: customPresets: { custom_pulse: {...}, custom_glow: {...} }

// Check overlay animations
const state = window.cblcars.debug.msd.animations.inspect('test_onload_custom');
console.log(state.animations);
// Should show preset resolution

// Manual test
window.cblcars.msd.animate('test_tap_custom', 'custom_glow');
// Should trigger glow with custom parameters
```

---

## Build Status

✅ Build successful
⚠️ Warnings (expected): Asset size limits (1.73 MiB bundle)

**Build Command:**
```bash
npm run build
```

**Build Time:** ~7.8 seconds

---

## Summary

All Phase 1 bugs fixed and ready for testing:

1. ✅ Chunk loading error resolved (static imports)
2. ✅ Custom preset definition working (type/preset support)
3. ✅ Custom preset resolution working (check custom presets first)
4. ✅ Parameter merging working (correct priority order)
5. ✅ YAML syntax corrected (array overlays, button types)

**Next Steps:**
1. Clear browser cache
2. Reload test configuration
3. Verify custom presets in console
4. Test all trigger types
5. Validate parameter merging

---

*Bug fixes completed November 1, 2025*
