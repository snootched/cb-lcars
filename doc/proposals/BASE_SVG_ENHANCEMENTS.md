# Proposal: Base SVG Enhancements - "None" Option & Filter Effects

## Overview

Two complementary enhancements to the `base_svg` system:

1. **"None" Option**: Allow cards without a base SVG layer
2. **Filter Effects**: Apply dimming/blur/opacity filters to base SVG to make overlays "pop"

## Current State

### How base_svg Works Now

```yaml
base_svg:
  source: "builtin:ncc-1701-a-blue"  # REQUIRED
```

**Current behavior:**
- `base_svg.source` is **required** (validation warning if missing)
- Without it, user sees error message in card
- Base SVG defines:
  - ViewBox dimensions (extracted automatically)
  - Anchor points (circles with IDs)
  - Background artwork
  - Visual context for overlays

### Current Issues

1. **Can't create overlay-only cards** - Always need base SVG even for pure data displays
2. **Overlays can blend in** - No way to dim/fade base artwork to emphasize overlays
3. **Template overhead** - Need to create blank SVG file just to avoid error

## Proposal 1: Support base_svg: "none"

### Concept

Allow users to omit base SVG entirely, useful for:
- Pure data display cards (no artwork needed)
- Custom overlay-only compositions
- Simplified testing/prototyping
- Mobile-optimized minimal layouts

### Configuration Syntax

**Option A: String value "none"** (Recommended)
```yaml
base_svg:
  source: "none"  # No base layer
  view_box: [0, 0, 800, 600]  # Must specify viewBox explicitly
```

**Option B: Omit entirely**
```yaml
# No base_svg defined
view_box: [0, 0, 800, 600]  # Required when no base_svg
overlays:
  - type: text
    content: "Temperature: 72°F"
    x: 400
    y: 300
```

**Recommendation**: Use Option A (`source: "none"`) for explicitness.

### Implementation Details

#### 1. Validation Updates

**File**: `src/msd/validation/validateMerged.js`

```javascript
function validateStructure(config, issues) {
  // Base SVG validation
  if (config.base_svg !== undefined) {
    if (typeof config.base_svg === 'string') {
      // Allow "none" as special value
      if (config.base_svg === 'none') {
        // When base_svg is "none", view_box becomes REQUIRED
        if (!config.view_box || config.view_box === 'auto') {
          issues.errors.push({
            code: 'view_box.required_without_base_svg',
            message: 'view_box must be explicitly defined when base_svg is "none"'
          });
        }
      } else if (!config.base_svg.startsWith('builtin:') &&
                 !config.base_svg.startsWith('/local/')) {
        issues.warnings.push({
          code: 'base_svg.format.unknown',
          message: 'base_svg should be "none", "builtin:", or "/local/" format'
        });
      }
    } else if (typeof config.base_svg === 'object') {
      if (!config.base_svg.source) {
        issues.errors.push({
          code: 'base_svg.source.missing',
          message: 'base_svg object must have a source property'
        });
      } else if (config.base_svg.source === 'none') {
        // Object format with "none"
        if (!config.view_box || config.view_box === 'auto') {
          issues.errors.push({
            code: 'view_box.required_without_base_svg',
            message: 'view_box must be explicitly defined when base_svg is "none"'
          });
        }
      }
    }
  }
}
```

#### 2. Card Model Updates

**File**: `src/msd/model/CardModel.js`

```javascript
export async function buildCardModel(mergedConfig) {
  let viewBox = [0, 0, 400, 200]; // fallback only
  let baseSvgSource = null;

  // Handle base_svg formats including "none"
  if (typeof mergedConfig.base_svg === 'string') {
    baseSvgSource = mergedConfig.base_svg;
  } else if (mergedConfig.base_svg?.source) {
    baseSvgSource = mergedConfig.base_svg.source;
  }

  // Check for "none" option
  if (baseSvgSource === 'none') {
    cblcarsLog.debug('[CardModel] base_svg set to "none" - no base layer');

    // ViewBox MUST be explicitly defined
    if (mergedConfig.view_box && Array.isArray(mergedConfig.view_box)) {
      viewBox = mergedConfig.view_box;
    } else {
      cblcarsLog.error('[CardModel] view_box required when base_svg is "none"');
      // Use fallback but log warning
    }

    // No anchors, no SVG content
    baseSvgSource = null;
  } else if (baseSvgSource) {
    // Existing SVG extraction logic...
    const svgContent = getSvgContent(baseSvgSource);
    if (svgContent) {
      viewBox = getSvgViewBox(svgContent);
    }
  }

  // Rest of model building...
}
```

#### 3. Renderer Updates

**File**: `src/cb-lcars/cb-lcars-msd.yaml`

```javascript
// In msd_svg template
if (!msdConfig?.base_svg?.source || msdConfig.base_svg.source === 'none') {
  // Create minimal SVG with just viewBox
  const viewBox = msdConfig.view_box || [0, 0, 400, 200];
  const aspect = viewBox[2] / viewBox[3];

  svgContent = `<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="${viewBox.join(' ')}"
    width="100%"
    height="100%"
    style="background: transparent;">
  </svg>`;

  cblcarsLog.debug('[MSD] Using "none" base_svg - overlay-only mode');
}
```

### Usage Examples

#### Example 1: Pure Data Display
```yaml
base_svg:
  source: "none"
view_box: [0, 0, 600, 400]

overlays:
  - type: text
    id: title
    x: 300
    y: 50
    content: "System Status"
    style:
      font_size: 24px
      text_anchor: middle

  - type: status_grid
    id: metrics
    x: 50
    y: 100
    # ... grid config
```

#### Example 2: Custom ApexCharts Canvas
```yaml
base_svg:
  source: "none"
view_box: [0, 0, 1200, 800]

overlays:
  - type: apexchart
    id: main_chart
    x: 0
    y: 0
    width: 1200
    height: 800
    # Full-screen chart, no background
```

### Benefits

✅ **Simpler configs** - No need for dummy SVG files
✅ **Cleaner UX** - Data-focused cards without artwork clutter
✅ **Performance** - Skip SVG parsing when not needed
✅ **Flexibility** - Pure overlay compositions

### Considerations

⚠️ **ViewBox becomes required** - Can't auto-extract from SVG
⚠️ **No anchors** - All overlays must use absolute positioning
⚠️ **Explicit dimensions** - User responsible for coordinate system

---

## Proposal 2: Base SVG Filter Effects

### Concept

Apply CSS/SVG filters to the base SVG layer to make overlays more prominent:
- **Dimming** - Reduce opacity/brightness
- **Blur** - Soften focus on background
- **Grayscale** - Desaturate colors
- **Contrast** - Adjust visual weight

### Configuration Syntax

```yaml
base_svg:
  source: "builtin:ncc-1701-a-blue"

  # NEW: Filter effects
  filters:
    opacity: 0.4           # Dim to 40%
    blur: 2px              # Slight blur
    brightness: 0.7        # Reduce brightness
    contrast: 0.8          # Lower contrast
    grayscale: 0.3         # 30% desaturation
    sepia: 0.1             # Slight warmth (optional)
```

**Or shorthand presets:**

```yaml
base_svg:
  source: "builtin:ncc-1701-a-blue"
  filter_preset: "dimmed"  # or "subtle", "backdrop", "faded"
```

### Preset Definitions

```javascript
const FILTER_PRESETS = {
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
  }
};
```

### Implementation Details

#### 1. Configuration Schema

**Add to base_svg validation:**

```javascript
function validateBaseSvgFilters(filters, issues) {
  if (!filters) return;

  const validProps = [
    'opacity', 'blur', 'brightness', 'contrast',
    'grayscale', 'sepia', 'hue_rotate', 'saturate'
  ];

  for (const key of Object.keys(filters)) {
    if (!validProps.includes(key)) {
      issues.warnings.push({
        code: 'base_svg.filter.unknown',
        message: `Unknown filter property: ${key}`
      });
    }

    // Validate ranges
    if (key === 'opacity' && (filters[key] < 0 || filters[key] > 1)) {
      issues.errors.push({
        code: 'base_svg.filter.opacity.range',
        message: 'opacity must be between 0 and 1'
      });
    }

    if (key === 'blur' && typeof filters[key] === 'string') {
      if (!filters[key].match(/^\d+(\.\d+)?(px|rem|em)$/)) {
        issues.errors.push({
          code: 'base_svg.filter.blur.format',
          message: 'blur must be in format "2px", "1rem", etc.'
        });
      }
    }
  }
}
```

#### 2. CSS Filter Application

**Two approaches:**

**Approach A: CSS filter property** (Simpler, better performance)

```javascript
// In CardModel or renderer
function applyBaseSvgFilters(svgElement, filterConfig) {
  const filters = [];

  if (filterConfig.opacity !== undefined) {
    svgElement.style.opacity = filterConfig.opacity;
  }

  if (filterConfig.blur) {
    filters.push(`blur(${filterConfig.blur})`);
  }

  if (filterConfig.brightness !== undefined) {
    filters.push(`brightness(${filterConfig.brightness})`);
  }

  if (filterConfig.contrast !== undefined) {
    filters.push(`contrast(${filterConfig.contrast})`);
  }

  if (filterConfig.grayscale !== undefined) {
    filters.push(`grayscale(${filterConfig.grayscale})`);
  }

  if (filterConfig.sepia !== undefined) {
    filters.push(`sepia(${filterConfig.sepia})`);
  }

  if (filterConfig.hue_rotate !== undefined) {
    filters.push(`hue-rotate(${filterConfig.hue_rotate}deg)`);
  }

  if (filterConfig.saturate !== undefined) {
    filters.push(`saturate(${filterConfig.saturate})`);
  }

  if (filters.length > 0) {
    svgElement.style.filter = filters.join(' ');
  }
}
```

**Approach B: SVG filter definitions** (More complex, SVG-native)

```javascript
function createSvgFilterDef(filterId, filterConfig) {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  filter.setAttribute('id', filterId);

  // Gaussian blur
  if (filterConfig.blur) {
    const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    blur.setAttribute('in', 'SourceGraphic');
    blur.setAttribute('stdDeviation', parseFloat(filterConfig.blur));
    filter.appendChild(blur);
  }

  // Color matrix for brightness/contrast/saturation
  if (filterConfig.brightness || filterConfig.contrast || filterConfig.grayscale) {
    const matrix = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
    // Complex matrix calculations...
    filter.appendChild(matrix);
  }

  defs.appendChild(filter);
  return defs;
}
```

**Recommendation**: Use **Approach A (CSS filter)** for simplicity and performance.

#### 3. Renderer Integration

**File**: `src/cb-lcars/cb-lcars-msd.yaml` or `CardModel.js`

```javascript
// After SVG content is inserted
if (msdConfig.base_svg?.filters || msdConfig.base_svg?.filter_preset) {
  const svg = container.querySelector('svg');
  if (svg) {
    let filterConfig = msdConfig.base_svg.filters || {};

    // Apply preset if specified
    if (msdConfig.base_svg.filter_preset) {
      const preset = FILTER_PRESETS[msdConfig.base_svg.filter_preset];
      if (preset) {
        filterConfig = { ...preset, ...filterConfig }; // User overrides preset
      }
    }

    applyBaseSvgFilters(svg, filterConfig);
    cblcarsLog.debug('[MSD] Applied base_svg filters:', filterConfig);
  }
}
```

### Usage Examples

#### Example 1: Dim Starship Background
```yaml
base_svg:
  source: "builtin:ncc-1701-d"
  filters:
    opacity: 0.4          # Make ship semi-transparent
    brightness: 0.7       # Darken it
    contrast: 0.8         # Reduce contrast

overlays:
  - type: text
    content: "{sensor.warp_core_temp}"
    style:
      fill: "#ffcc00"     # Bright yellow - pops against dimmed ship!
```

#### Example 2: Subtle Backdrop
```yaml
base_svg:
  source: "builtin:nx-01"
  filter_preset: "backdrop"  # opacity: 0.3, blur: 3px, brightness: 0.6

overlays:
  - type: status_grid
    # Grid stands out clearly against blurred ship
```

#### Example 3: Grayscale with Color Overlays
```yaml
base_svg:
  source: "builtin:ncc-1701-a-blue"
  filters:
    grayscale: 1.0        # Full grayscale
    opacity: 0.5

overlays:
  - type: text
    style:
      fill: "#ff0000"     # Red text POPS on gray background
```

#### Example 4: Dynamic Filters via Rules
```yaml
base_svg:
  source: "builtin:ncc-1701-d"
  filters:
    opacity: 0.6

rules:
  - condition: "sensor.red_alert == 'on'"
    actions:
      - type: update_base_svg_filter
        filters:
          opacity: 1.0           # Full opacity during alert
          brightness: 1.2        # Brighter
          hue_rotate: 10         # Slight red tint
```

### Visual Examples

```
┌─────────────────────────────────────┐
│ NO FILTER (Current)                 │
│                                     │
│  [████████████ SHIP ARTWORK]       │
│  Text: "72°F" (blends in)          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ WITH DIMMING FILTER                 │
│                                     │
│  [▓▓▓▓▓▓▓▓▓▓▓▓ SHIP ARTWORK]       │
│  Text: "72°F" (stands out!)        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ WITH BLUR + DIM                     │
│                                     │
│  [░░░░░░░░░░░░ SHIP ARTWORK]       │
│  Text: "72°F" (very prominent!)    │
└─────────────────────────────────────┘
```

### Benefits

✅ **Better hierarchy** - Overlays pop visually
✅ **Customizable** - Fine-tune effect strength
✅ **No artwork changes** - Use existing SVGs
✅ **Dynamic** - Can change via rules
✅ **Performance** - CSS filters are GPU-accelerated

### Considerations

⚠️ **Browser compatibility** - CSS filters work in modern browsers (IE11+)
⚠️ **Performance on blur** - Large blur values can impact rendering
⚠️ **SVG vs CSS** - CSS approach simpler but less flexible

---

## Combined Usage

Both features work together beautifully:

```yaml
# No base SVG, just pure overlays
base_svg:
  source: "none"
view_box: [0, 0, 800, 600]
```

```yaml
# Base SVG with dimming for overlay emphasis
base_svg:
  source: "builtin:ncc-1701-d"
  filter_preset: "backdrop"
```

---

## Implementation Checklist

### Phase 1: "None" Support
- [ ] Update `validateMerged.js` - allow "none", require view_box
- [ ] Update `CardModel.js` - handle "none" case, skip SVG loading
- [ ] Update `cb-lcars-msd.yaml` - create minimal SVG for "none"
- [ ] Add documentation with examples
- [ ] Test overlay-only cards

### Phase 2: Filter Effects
- [ ] Define `FILTER_PRESETS` constant
- [ ] Create `applyBaseSvgFilters()` utility
- [ ] Update validation for filter properties
- [ ] Integrate into renderer/CardModel
- [ ] Add preset selection to UI (future)
- [ ] Add documentation with visual examples
- [ ] Test performance with various filters

### Phase 3: Advanced Features (Future)
- [ ] Animated filter transitions
- [ ] Rule-based filter updates
- [ ] Layer-specific filters
- [ ] Custom filter definitions
- [ ] Filter editor in UI

---

## Alternatives Considered

### Alternative 1: Blank Built-in SVG
**Instead of "none" support, ship a blank SVG template**

```yaml
base_svg:
  source: "builtin:blank"  # Pre-loaded empty SVG
```

**Pros**:
- No validation changes needed
- Consistent with existing pattern

**Cons**:
- Wasteful (loading empty SVG)
- Still need to specify viewBox in SVG
- Not as explicit as "none"

**Verdict**: "none" is clearer and more efficient

### Alternative 2: SVG-Native Filters Only
**Use only SVG `<filter>` elements instead of CSS**

**Pros**:
- More SVG-native
- Potentially more effects available

**Cons**:
- Much more complex implementation
- Harder to debug
- Performance can be worse
- Browser compatibility issues

**Verdict**: CSS filters are simpler and perform better

### Alternative 3: Overlay-Level Filters
**Apply filters to overlays instead of base SVG**

```yaml
overlays:
  - type: text
    glow: true         # Add glow to make it pop
    shadow: 2px
```

**Pros**:
- More granular control

**Cons**:
- Opposite of what we want (dim background, not brighten foreground)
- More configuration overhead

**Verdict**: Base SVG filtering is the right approach

---

## User Impact

### Breaking Changes
**None** - Both features are additive

### Migration Path
Not needed - existing configs work unchanged

### Documentation Updates Needed
1. **User Guide**: Add section on "none" option
2. **Examples**: Show overlay-only cards
3. **Filter Guide**: Document all filter properties and presets
4. **Visual Gallery**: Show before/after filter examples

---

## Technical Notes

### Performance

**CSS Filters**:
- GPU-accelerated in modern browsers
- Minimal CPU overhead
- Blur has highest cost (especially large values)

**Recommendations**:
- Keep blur values ≤ 5px for good performance
- Test on mobile devices
- Use presets to standardize performance characteristics

### Browser Support

**CSS Filter Property**:
- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support
- ✅ Safari: Full support (since iOS 6+)
- ⚠️ IE11: Partial support (no blur, limited effects)

**Fallback**: Graceful degradation - if filters not supported, base SVG shows normally

### Z-Index Considerations

Filters are applied to base SVG container:
```
z-index layers:
1. Base SVG (with filters applied)
2. Overlay container (clean, unfiltered)
3. Individual overlays
```

This ensures filters only affect background, not overlays.

---

## Success Criteria

1. ✅ Users can create overlay-only cards with `source: "none"`
2. ✅ ViewBox validation enforces explicit dimensions for "none"
3. ✅ Base SVG can be dimmed/blurred to emphasize overlays
4. ✅ Filter presets work out-of-box
5. ✅ Performance impact < 5ms for typical filter combinations
6. ✅ Documentation includes visual examples
7. ✅ No breaking changes to existing configs

---

## Questions for User

### DECISIONS MADE ✅

1. **Both features approved**:
   - ✅ `base_svg: "none"` support
   - ✅ Filter effects (both explicit and presets)

2. **Rules integration approved**:
   - ✅ Filters will be updatable via rules engine
   - ✅ Time-based dimming use case confirmed
   - ✅ Alert-based brightness changes confirmed

3. **Theme/token system integration**:
   - ✅ Add filter presets to ThemeManager
   - ✅ Use existing StyleResolverService for token resolution
   - ✅ Follow established patterns (rules actions, style resolver, etc.)
   - ✅ Standardize on theme system for consistency

4. **Filter types**:
   - ✅ Standard CSS filters sufficient for LCARS displays
   - ✅ Built-in presets: dimmed, subtle, backdrop, faded, red-alert, monochrome
   - ⏳ Future: Consider animatable filters (via AnimationEngine)

### Implementation Status

See **BASE_SVG_FILTERS_IMPLEMENTATION.md** for detailed implementation plan.

**Architecture Summary**:
- Filter presets in ThemeManager (centralized)
- Token values for dynamic filter values
- Rules engine action type: `update_base_svg_filter`
- StyleResolverService for token resolution
- SystemsManager applies filter updates
- Smooth transitions between filter states

---## Next Steps

1. **Get feedback** on both proposals
2. **Prioritize**: Which feature first?
   - "None" option is simpler, could ship quickly
   - Filters are more impactful visually

3. **Create implementation branch**
4. **Build MVP**
5. **Test with real configs**
6. **Document and ship**

What do you think? Which feature excites you more? Any changes to the proposed syntax?
