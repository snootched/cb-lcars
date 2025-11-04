# SVG Cache Namespace Fix

## Problem

SVG templates were stored at `window.cblcars.msd.svg_templates`, but this created a **namespace collision** with the MSD runtime system:

1. **On startup**: `preloadSVGs()` loads built-in SVGs into `window.cblcars.msd.svg_templates`
2. **Later**: `CBLCARSUnifiedAPI.attach()` executes `window.cblcars.msd = MsdRuntimeAPI.create()`
3. **Result**: SVG cache gets wiped out when MSD runtime initializes! 💥

## Solution

Moved SVG templates to **`window.cblcars.assets.svg_templates`**

This makes semantic sense:
- ✅ SVG templates are static assets shipped with CB-LCARS
- ✅ Separate from MSD runtime system (no collision)
- ✅ Clear namespace for static resources
- ✅ Consistent with other global utilities (`window.cblcars.svgHelpers`, etc.)

## Changes Made

### 1. Core Cache Module (`cb-lcars-fileutils.js`)

**Changed:**
```javascript
function ensureSVGCache() {
    window.cblcars = window.cblcars || {};
    window.cblcars.assets = window.cblcars.assets || {};
    window.cblcars.assets.svg_templates = window.cblcars.assets.svg_templates || {};
    return window.cblcars.assets.svg_templates;
}
```

**Was:**
```javascript
function ensureSVGCache() {
    window.cblcars = window.cblcars || {};
    window.cblcars.msd = window.cblcars.msd || {};
    window.cblcars.msd.svg_templates = window.cblcars.msd.svg_templates || {};
    return window.cblcars.msd.svg_templates;
}
```

### 2. MSD Instance Manager (`MsdInstanceManager.js`)

**Changed:**
```javascript
const svgTemplates = window?.cblcars?.assets?.svg_templates;
```

**Was:**
```javascript
const svgTemplates = window?.cblcars?.msd?.svg_templates;
```

### 3. Anchor Helpers (`cb-lcars-anchor-helpers.js`)

**Changed:**
```javascript
return svgKey && window.cblcars?.assets?.svg_templates?.[svgKey];
```

**Was:**
```javascript
return svgKey && window.cblcars?.msd?.svg_templates?.[svgKey];
```

### 4. YAML Configs

Updated both:
- `src/cb-lcars/cb-lcars-msd.yaml`
- `msd-testing-config.yaml`

**Changed:**
```javascript
const svgTemplates = window?.cblcars?.assets?.svg_templates;
```

**Was:**
```javascript
const svgTemplates = window?.cblcars?.msd?.svg_templates;
```

## API Surface

### Public API (unchanged)

Users still access SVGs the same way:
```javascript
// Load custom SVG
await window.cblcars.loadUserSVG('my-ship', '/local/my-ship.svg');

// Get cached SVG
const svg = window.cblcars.getSVGFromCache('ncc-1701-d');
```

### Internal Cache Location (changed)

Internal storage moved:
- **Old**: `window.cblcars.msd.svg_templates.['ncc-1701-d']`
- **New**: `window.cblcars.assets.svg_templates['ncc-1701-d']`

## Backward Compatibility

⚠️ **Breaking change for internal code only**

If any custom code directly accessed `window.cblcars.msd.svg_templates`, it needs to update to:
```javascript
window.cblcars.assets.svg_templates
```

Public API methods (`getSVGFromCache`, `loadUserSVG`) remain unchanged.

## Files Modified

1. ✅ `src/utils/cb-lcars-fileutils.js` - Cache initialization
2. ✅ `src/msd/pipeline/MsdInstanceManager.js` - SVG template access
3. ✅ `src/utils/cb-lcars-anchor-helpers.js` - SVG content retrieval
4. ✅ `src/cb-lcars/cb-lcars-msd.yaml` - Error message generation
5. ✅ `msd-testing-config.yaml` - Error message generation

## Build Status

✅ **Build successful** - No compilation errors

```bash
npm run build
# webpack 5.97.0 compiled with 3 warnings in 7379 ms
# Warnings are only about bundle size (expected)
```

## Testing

To verify SVG cache works after MSD initialization:

```javascript
// 1. Check SVGs loaded at startup
console.log('Built-in SVGs:', Object.keys(window.cblcars.assets.svg_templates));

// 2. Check MSD runtime initialized (shouldn't wipe SVG cache)
console.log('MSD runtime:', window.cblcars.msd);

// 3. Verify SVG still accessible
const svg = window.cblcars.getSVGFromCache('ncc-1701-d');
console.log('SVG loaded:', svg ? '✅' : '❌');
```

## Benefits

1. ✅ **No more namespace collision** - MSD runtime and SVG cache are separate
2. ✅ **Semantic clarity** - `assets` clearly indicates static resources
3. ✅ **Better organization** - Static assets grouped logically
4. ✅ **Future-proof** - Room for other asset types (`fonts`, `images`, etc.)

## Future Considerations

Could extend the `assets` namespace for other static resources:

```javascript
window.cblcars.assets = {
  svg_templates: {},    // ✅ Current
  fonts: {},           // 🔮 Future: Cached fonts
  images: {},          // 🔮 Future: Cached images
  sounds: {},          // 🔮 Future: LCARS sound effects
}
```

---

**Status:** ✅ Complete - SVG cache now at `window.cblcars.assets.svg_templates`
**Build:** ✅ Successful
**Breaking:** ⚠️ Only for internal code accessing cache directly
