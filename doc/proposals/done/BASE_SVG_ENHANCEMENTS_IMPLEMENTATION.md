# Base SVG Enhancements - Implementation Complete

**Status**: ✅ IMPLEMENTED
**Date**: October 31, 2025
**Version**: v2025.10.1-msd.13.69

## Overview

Successfully implemented both base SVG enhancement proposals:
1. ✅ **"None" Option** - Cards without base SVG layer (overlay-only mode)
2. ✅ **Filter Effects** - CSS filters with filter isolation for base SVG

This document describes the complete implementation including the critical filter isolation fix.

---

## Implementation Summary

### Feature 1: Base SVG "None" Option

Allows overlay-only displays without requiring a base SVG template.

#### Configuration
```yaml
base_svg:
  source: "none"
view_box: [0, 0, 1920, 1200]  # REQUIRED when source is "none"

overlays:
  - type: status_grid
    id: main_grid
    # ... overlay config
```

#### Implementation Details

**Validation** (`validateMerged.js`):
- `source: "none"` requires explicit `view_box` (must be array of 4 numbers)
- Error code: `view_box.required_with_none_source`

**Template Generation** (`msd-testing-config.yaml`):
- Detects `source === 'none'`
- Creates blank SVG container with explicit viewBox
- No anchor extraction for "none" mode

**Benefits**:
- Pure data display cards
- Custom overlay compositions
- Simplified testing/prototyping
- No dummy SVG files needed

---

### Feature 2: CSS Filter Effects

Apply visual filters to base SVG layer to emphasize overlays.

#### Configuration

**Individual Filters**:
```yaml
base_svg:
  source: builtin:ncc-1701-a-blue
  filters:
    opacity: 0.5
    blur: "3px"
    brightness: 0.7
    contrast: 0.8
    grayscale: 0.3
    sepia: 0.1
    hue_rotate: 45        # degrees
    saturate: 0.6
    invert: 0.2
```

**Filter Presets**:
```yaml
base_svg:
  source: builtin:ncc-1701-a-blue
  filter_preset: dimmed   # or: subtle, backdrop, faded, red-alert, monochrome
```

**Preset + Override**:
```yaml
base_svg:
  source: builtin:ncc-1701-a-blue
  filter_preset: dimmed
  filters:
    opacity: 0.3  # Override preset's 0.5
```

#### Built-in Presets

Defined in `ThemeManager.js`:

```javascript
BUILTIN_FILTER_PRESETS = {
  'dimmed': {
    opacity: 0.5,
    brightness: 0.8
  },
  'subtle': {
    opacity: 0.6,
    blur: '1px',
    grayscale: 0.2
  },
  'backdrop': {
    opacity: 0.3,
    blur: '3px',
    brightness: 0.6
  },
  'faded': {
    opacity: 0.4,
    grayscale: 0.5,
    contrast: 0.7
  },
  'red-alert': {
    opacity: 0.7,
    brightness: 1.2,
    hue_rotate: -30,
    saturate: 1.5
  },
  'monochrome': {
    grayscale: 1.0,
    contrast: 1.2,
    brightness: 0.9
  }
};
```

Themes can override presets via `theme.msd.filter_presets` in theme YAML.

---

## Critical Fix: Filter Isolation

### Problem Discovered

Initial implementation applied CSS `filter` to the root `<svg>` element, which caused filters to cascade to **all child elements** including overlays:

```html
<svg style="filter: blur(3px)">  <!-- ❌ Everything gets blurred! -->
  <!-- Base SVG content -->
  <g id="msd-overlay-container">
    <!-- Overlays also blurred! -->
  </g>
</svg>
```

**Result**: Overlays, status grids, buttons, and text all became blurred/dimmed (unintended).

### Solution: Content Group Isolation

Wrap base SVG content in a dedicated `<g>` element and apply filters only to that group:

```html
<svg viewBox="0 0 1920 1200">
  <g id="__msd-base-content" style="filter: blur(3px)">
    <!-- ✅ Base SVG ship template - FILTERED -->
  </g>
  <g id="msd-overlay-container">
    <!-- ✅ Overlays - NOT filtered, remain crisp -->
  </g>
</svg>
```

### Implementation Components

#### 1. SVG Content Wrapping (`msd-testing-config.yaml`)

```javascript
// Parse loaded SVG and wrap contents
const tempDiv = document.createElement('div');
tempDiv.innerHTML = svgContent;
const svgEl = tempDiv.querySelector('svg');

if (svgEl) {
  // Get all child nodes
  const children = Array.from(svgEl.childNodes);

  // Create wrapper group with reserved ID
  const wrapperGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  wrapperGroup.setAttribute('id', '__msd-base-content');

  // Move all children into wrapper
  children.forEach(child => wrapperGroup.appendChild(child));

  // Replace SVG contents with wrapped version
  svgEl.innerHTML = '';
  svgEl.appendChild(wrapperGroup);

  svgContent = tempDiv.innerHTML;
}
```

#### 2. Filter Application (`PipelineCore.js`)

```javascript
// Target the base content group, not the root SVG
const baseContentGroup = mountEl?.querySelector('#__msd-base-content');

if (baseContentGroup && cardModel.baseSvg?.filters) {
  applyBaseSvgFilters(baseContentGroup, cardModel.baseSvg.filters);
}
```

#### 3. Filter Utilities (`BaseSvgFilters.js`)

```javascript
export function generateFilterString(filters) {
  const parts = [];

  if (filters.opacity !== undefined) parts.push(`opacity(${filters.opacity})`);
  if (filters.blur !== undefined) parts.push(`blur(${filters.blur})`);
  if (filters.brightness !== undefined) parts.push(`brightness(${filters.brightness})`);
  if (filters.contrast !== undefined) parts.push(`contrast(${filters.contrast})`);
  if (filters.saturate !== undefined) parts.push(`saturate(${filters.saturate})`);
  if (filters.hue_rotate !== undefined) parts.push(`hue-rotate(${filters.hue_rotate}deg)`);
  if (filters.grayscale !== undefined) parts.push(`grayscale(${filters.grayscale})`);
  if (filters.sepia !== undefined) parts.push(`sepia(${filters.sepia})`);
  if (filters.invert !== undefined) parts.push(`invert(${filters.invert})`);

  return parts.join(' ');
}

export function applyBaseSvgFilters(svgElement, filters, transition) {
  const filterString = generateFilterString(filters);

  if (transition && transition > 0) {
    svgElement.style.transition = `filter ${transition}ms ease-in-out`;
    setTimeout(() => { svgElement.style.transition = ''; }, transition);
  }

  svgElement.style.filter = filterString;
}
```

---

## Reserved ID Convention

### Problem: Anchor Extraction Collision

The wrapper `<g id="__msd-base-content">` was being picked up by anchor extraction logic, which treats all `<g>` elements with IDs as potential anchor points.

### Solution: Reserved ID Prefix Convention

**Convention**: IDs starting with `__` (double underscore) or `msd-internal-` are **internal/reserved** and invisible to anchor extraction.

**Example Reserved IDs**:
- `__msd-base-content` - Base SVG content wrapper (for filter isolation)
- `__msd-temp-group` - Temporary grouping element
- `msd-internal-calculations` - Internal computation element

### Implementation in Anchor Extraction

#### 1. Phase A: `loadSvg.js`

```javascript
export function extractAnchors(raw) {
  const anchors = {};

  // Circle extraction
  raw.replace(/<circle\b[^>]*id="([^"]+)"[^>]*>/gim, (_m, id) => {
    // Skip internal/reserved IDs
    if (id.startsWith('__') || id.startsWith('msd-internal-')) return '';
    // ... extract coordinates
  });

  // Text extraction
  raw.replace(/<text\b[^>]*id="([^"]+)"[^>]*>/gim, (_m, id) => {
    if (id.startsWith('__') || id.startsWith('msd-internal-')) return '';
    // ... extract coordinates
  });

  // Group placeholders
  raw.replace(/<g\b[^>]*id="([^"]+)"[^>]*>/gim, (_m, id) => {
    if (id.startsWith('__') || id.startsWith('msd-internal-')) return '';
    // ... register placeholder
  });

  return anchors;
}
```

#### 2. Runtime: `cb-lcars-anchor-helpers.js`

```javascript
export function findSvgAnchors(svgContent) {
  const anchors = {};

  // Circle extraction
  const circleRegex = /<circle[^>]*id="([^"]+)"[^>]*>/g;
  let m;
  while ((m = circleRegex.exec(svgContent)) !== null) {
    const id = m[1];
    if (id.startsWith('__') || id.startsWith('msd-internal-')) continue;
    // ... extract coordinates
  }

  // Text extraction
  const textRegex = /<text[^>]*id="([^"]+)"[^>]*>/g;
  while ((m = textRegex.exec(svgContent)) !== null) {
    const id = m[1];
    if (id.startsWith('__') || id.startsWith('msd-internal-')) continue;
    // ... extract coordinates
  }

  // Group placeholders
  const groupRegex = /<g[^>]*id="([^"]+)"[^>]*>/g;
  while ((m = groupRegex.exec(svgContent)) !== null) {
    const id = m[1];
    if (id.startsWith('__') || id.startsWith('msd-internal-')) continue;
    // ... register placeholder
  }

  return anchors;
}
```

#### 3. Validation: `validateMerged.js`

```javascript
function validateAnchors(config, issues) {
  if (!config.anchors) return;

  Object.entries(config.anchors).forEach(([anchorId, coordinates]) => {
    // Skip internal/reserved IDs (safeguard)
    if (anchorId.startsWith('__') || anchorId.startsWith('msd-internal-')) {
      return;
    }

    // ... validate coordinates
  });
}
```

### Reserved ID Guidelines

**For Developers**:
- Use `__` prefix for all internal MSD wrapper/helper elements
- Use `msd-internal-` prefix for temporary/computed elements
- Document reserved IDs in code comments
- Never expose reserved IDs to user configuration

**User Anchors**:
- Can use any ID except those starting with `__` or `msd-internal-`
- Recommended: Use semantic names like `bridge`, `engineering`, `cpu_core`
- Avoid prefixes that might conflict with future internal conventions

---

## Files Modified

### Core Implementation
1. **`src/msd/model/CardModel.js`**
   - Filter preset resolution via ThemeManager
   - Merges preset filters with explicit filters
   - Stores in `cardModel.baseSvg.filters`

2. **`src/msd/pipeline/PipelineCore.js`**
   - Applies filters after initial render
   - Targets `#__msd-base-content` for isolation
   - Static import (not dynamic) to avoid chunk files

3. **`src/msd/utils/BaseSvgFilters.js`** (NEW)
   - `generateFilterString(filters)` - Converts to CSS
   - `applyBaseSvgFilters(element, filters, transition)` - Applies filters
   - `transitionBaseSvgFilters(...)` - Animated transitions

4. **`src/msd/managers/ThemeManager.js`**
   - `BUILTIN_FILTER_PRESETS` - 6 built-in presets
   - `getFilterPreset(name)` - Theme override support

### Filter Isolation
5. **`msd-testing-config.yaml`**
   - Wraps base SVG content in `<g id="__msd-base-content">`
   - Handles `source: "none"` with blank SVG container
   - Validates `view_box` for "none" mode

### Reserved ID Implementation
6. **`src/msd/svg/loadSvg.js`**
   - `extractAnchors()` skips `__` and `msd-internal-` prefixes

7. **`src/utils/cb-lcars-anchor-helpers.js`**
   - `findSvgAnchors()` skips reserved ID prefixes in all element types

8. **`src/msd/validation/validateMerged.js`**
   - `validateAnchors()` skips reserved IDs (safeguard)
   - Enhanced `view_box` validation for "none" mode

---

## Usage Examples

### Example 1: Dimmed Base with Sharp Overlays

```yaml
base_svg:
  source: builtin:ncc-1701-a-blue
  filter_preset: dimmed

overlays:
  - type: status_grid
    id: systems
    x: 100
    y: 100
    # Grid remains sharp and clear
```

### Example 2: Overlay-Only Display

```yaml
base_svg:
  source: "none"
view_box: [0, 0, 1920, 1200]

overlays:
  - type: apexchart
    id: main_chart
    # Full-screen chart, no background
```

### Example 3: Custom Filter Mix

```yaml
base_svg:
  source: builtin:enterprise-d-shuttlecraft15-anomaly
  filters:
    opacity: 0.3
    blur: "5px"
    grayscale: 0.8
    brightness: 0.5

overlays:
  - type: text
    content: "RED ALERT"
    # Text remains crisp and readable
```

### Example 4: Theme Override

**Theme YAML**:
```yaml
lcars-custom:
  msd:
    filter_presets:
      dimmed:
        opacity: 0.3  # Override built-in 0.5
        blur: "2px"   # Add blur
```

**Card Config**:
```yaml
theme: lcars-custom
base_svg:
  source: builtin:ncc-1701-a-blue
  filter_preset: dimmed  # Uses theme override
```

---

## Testing & Validation

### Test Cases Verified

✅ **Filter Application**:
- Individual filters apply correctly
- Multiple filters combine properly
- Presets load from ThemeManager
- Explicit filters override preset values
- Filters apply only to base content (not overlays)

✅ **Filter Isolation**:
- Overlays remain unaffected by base filters
- Status grids render sharp and clear
- Buttons maintain crisp edges
- Text overlays remain readable
- ApexCharts render at full quality

✅ **Reserved ID System**:
- `__msd-base-content` excluded from anchor extraction
- Validation skips reserved IDs
- User anchors work normally
- No false anchor errors

✅ **Source "None" Mode**:
- Blank SVG container created correctly
- Explicit `view_box` validated and applied
- Overlays mount properly
- No anchor extraction attempts

✅ **Performance**:
- CSS filters are GPU-accelerated
- No chunk loading errors (static imports)
- Single bundle compilation
- Smooth transitions (optional)

---

## Architecture Notes

### Filter Application Flow

```
1. Config Parsing (CardModel.js)
   ├─ Resolve filter_preset via ThemeManager
   ├─ Merge preset with explicit filters
   └─ Store in cardModel.baseSvg.filters

2. SVG Wrapping (msd-testing-config.yaml)
   ├─ Load base SVG content
   ├─ Parse and wrap in <g id="__msd-base-content">
   └─ Serialize back to string

3. Initial Render (PipelineCore.js)
   ├─ Complete overlay rendering
   ├─ Query for #__msd-base-content
   └─ Apply filters to group element

4. Filter Application (BaseSvgFilters.js)
   ├─ Generate CSS filter string
   ├─ Apply to element.style.filter
   └─ Optional transition animation
```

### SVG Structure

```html
<div id="msd-v1-comprehensive-wrapper">
  <div style="z-index: 0">
    <svg viewBox="0 0 1920 1200">

      <!-- BASE CONTENT (filtered) -->
      <g id="__msd-base-content" style="filter: opacity(0.5) blur(3px)">
        <!-- Ship template paths, shapes, etc. -->
        <path d="M..." />
        <circle id="bridge" cx="400" cy="200" r="5" />
      </g>

      <!-- OVERLAY CONTAINER (not filtered) -->
      <g id="msd-overlay-container" style="pointer-events: all">
        <!-- Status grids, buttons, text, etc. -->
        <g id="status_grid_1">...</g>
        <text id="label_1">...</text>
      </g>

    </svg>
  </div>
</div>
```

---

## Future Enhancements

### Potential Extensions

**Dynamic Filter Transitions**:
```yaml
base_svg:
  filters:
    opacity: 0.5
  transitions:
    opacity:
      duration: 1000ms
      easing: ease-in-out
```

**State-Based Filters**:
```yaml
base_svg:
  filters:
    default:
      opacity: 0.5
    alert:
      opacity: 0.9
      hue_rotate: -30
  filter_state: "[[state.sensor.alert_level]]"
```

**SVG Filter Defs** (native SVG filters):
```yaml
base_svg:
  svg_filters:
    - type: gaussian_blur
      std_deviation: 3
    - type: color_matrix
      values: "grayscale"
```

---

## Breaking Changes

**None** - This is a pure enhancement:
- Existing configs without filters work unchanged
- `source: "none"` is opt-in
- Reserved ID convention doesn't affect user anchors
- No migration required

---

## Performance Considerations

**GPU Acceleration**:
- CSS filters use hardware acceleration
- Apply to single group (not entire SVG tree)
- No JavaScript animation loops needed

**Bundle Size**:
- BaseSvgFilters.js: ~5KB (uncompressed)
- No external dependencies
- Single static import (no code splitting)

**Runtime**:
- Filters applied once after initial render
- No ongoing performance impact
- Transitions are optional and CSS-based

---

## References

**Related Documents**:
- [BASE_SVG_ENHANCEMENTS.md](../BASE_SVG_ENHANCEMENTS.md) - Original proposal
- [MSD_SCHEMA_V1_Ratified.yaml](../../architecture/MSD_SCHEMA_V1_Ratified.yaml) - Schema definitions
- [theme_creation_tutorial.md](../../user-guide/advanced/theme_creation_tutorial.md) - Theme filter presets

**Implementation Files**:
- `src/msd/utils/BaseSvgFilters.js` - Filter utilities
- `src/msd/managers/ThemeManager.js` - Preset definitions
- `src/msd/model/CardModel.js` - Filter resolution
- `src/msd/pipeline/PipelineCore.js` - Filter application
- `msd-testing-config.yaml` - SVG wrapping logic

**Test Configuration**:
- `msd-testing-config.yaml` - Live test environment

---

## Conclusion

Both base SVG enhancements are **fully implemented and production-ready**:

✅ **"None" Option**: Enables overlay-only displays without base SVG
✅ **Filter Effects**: CSS filters with proper overlay isolation
✅ **Reserved ID System**: Internal elements invisible to anchor extraction
✅ **Theme Integration**: Filter presets with theme override support

The critical filter isolation fix ensures filters apply **only to base content**, leaving overlays crisp and clear. The reserved ID convention (`__` prefix) provides a robust mechanism for internal MSD elements that won't interfere with user configuration.
