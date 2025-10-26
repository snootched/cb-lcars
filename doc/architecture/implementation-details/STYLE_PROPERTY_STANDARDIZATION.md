# CB-LCARS Style Property Standardization

**Status:** 🚧 IN PROGRESS
**Created:** 2025-10-25
**Phase:** 3 (ButtonOverlay Incremental Updates)
**Trigger:** Border property format inconsistency discovered during incremental update implementation

---

## Problem Statement

We have multiple inconsistent naming/structure conventions across the codebase:

1. **snake_case vs camelCase**: `border_color` vs `borderColor`
2. **Flat vs Nested**: `border_color` vs `border.color`
3. **Different conventions in different layers**:
   - User config (YAML): Mixed `snake_case` and `camelCase`
   - Schema validation: Mostly `snake_case`
   - Internal objects: Mostly `camelCase`
   - Renderer expectations: Mixed and inconsistent

This causes:
- ❌ Transform code in every overlay incremental update
- ❌ Confusion about which format to use
- ❌ Bugs when formats don't match (e.g., ButtonRenderer expecting `border.color` but receiving `border_color`)
- ❌ Maintenance burden

---

## Standardization Decision

### **User-Facing (YAML Config):** `snake_case` with nested objects

**Rationale:**
- ✅ Consistent with Home Assistant conventions (`tap_action`, `entity_id`, etc.)
- ✅ Better YAML readability
- ✅ Hierarchical structure is intuitive
- ✅ Matches CSS property concepts

**Border Structure:**
```yaml
border:
  color: var(--lcars-blue)    # Applies to all sides
  width: 2                     # Applies to all sides
  radius: 8                    # Applies to all corners
  top:
    color: var(--lcars-red)    # Overrides top only
    width: 4
  bottom:
    color: var(--lcars-yellow)
    width: 3
  left:
    width: 1
  right:
    width: 1
  radius_top_left: 16          # Individual corner override
  radius_top_right: 16
  radius_bottom_left: 0
  radius_bottom_right: 0
```

### **Internal JavaScript:** `camelCase` (normalized by RendererUtils)

**Rationale:**
- ✅ JavaScript object property convention
- ✅ RendererUtils already does this transformation
- ✅ Cleaner dot notation access

**After normalization:**
```javascript
{
  border: {
    color: 'var(--lcars-blue)',
    width: 2,
    radius: 8,
    top: { color: 'var(--lcars-red)', width: 4 },
    bottom: { color: 'var(--lcars-yellow)', width: 3 },
    radiusTopLeft: 16,
    radiusTopRight: 16
  }
}
```

---

## Standardized Property Structure

### **Core Style Properties (All Overlays)**

**Based on existing cb-lcars legacy template structure:**

```yaml
# Colors (snake_case at user level)
color: var(--lcars-blue)              # Primary/fill color
background_color: transparent
opacity: 1.0

# Border (nested object - aligns with legacy templates)
border:
  color: var(--lcars-gray)            # Default for all sides
  width: 1                             # Default for all sides (was 'size' in legacy)
  radius: 8                            # Default for all corners
  style: solid                         # solid, dashed, dotted

  # Individual sides (override defaults - matches legacy)
  top:
    color: var(--lcars-red)
    width: 2
  right:
    color: var(--lcars-blue)
    width: 1
  bottom:
    color: var(--lcars-yellow)
    width: 3
  left:
    width: 1

  # Individual corners (top level - simplified from legacy)
  radius_top_left: 16                 # was border.top.left_radius in legacy
  radius_top_right: 16                # was border.top.right_radius in legacy
  radius_bottom_right: 0              # was border.bottom.right_radius in legacy
  radius_bottom_left: 0               # was border.bottom.left_radius in legacy

# Text properties (nested under 'text' - matches legacy)
text:
  label:
    font_size: 20
    font_family: Antonio
    font_weight: bold
    text_align: center
    text_transform: uppercase
    line_height: 1.2
    letter_spacing: 0
    color: var(--lcars-white)         # Can also use color states (see below)
    padding:
      top: 5
      right: 10
      bottom: 5
      left: 10

  value:
    font_size: 18
    font_weight: normal
    color: var(--lcars-cyan)
    padding:
      top: 5
      right: 10
      bottom: 5
      left: 10

  # Support for text arrays (multiple text elements)
  texts:
    - font_size: 16
      color: var(--lcars-white)
      padding: { top: 2, right: 5, bottom: 2, left: 5 }
    - font_size: 14
      color: var(--lcars-gray)

# Color states (matches legacy pattern)
color:
  default: var(--lcars-blue)
  active: var(--lcars-yellow)
  inactive: var(--lcars-gray)
  unavailable: var(--lcars-darkgray)

# Layout/spacing (nested - matches legacy)
padding:
  top: 8
  right: 12
  bottom: 8
  left: 12

margin:
  top: 0
  right: 0
  bottom: 0
  left: 0
```

### **Legacy Template Migration Notes**

**Changes from legacy cb-lcars templates:**

1. **`border.top.size` → `border.top.width`**
   - More consistent with CSS terminology
   - `size` is ambiguous (could be area, not just width)

2. **`border.top.left_radius` → `border.radius_top_left`**
   - Corners moved to top level of border object
   - Matches CSS property naming (border-radius-top-left)
   - Simplifies structure (was nested under each side)

3. **Add defaults at border top level:**
   - `border.color` - applies to all sides
   - `border.width` - applies to all sides
   - `border.radius` - applies to all corners
   - Individual side/corner settings override these

**Backward Compatibility:**

RendererUtils will support BOTH old and new formats:
```yaml
# ✅ OLD (legacy templates - still works)
border:
  top:
    size: 2
    left_radius: 16

# ✅ NEW (standardized - preferred)
border:
  width: 2
  radius_top_left: 16
```

### **Button-Specific Properties**

```yaml
# Button behavior
show_labels: true
show_values: true
label_position: center-top
value_position: center-bottom
text_padding: 8

# LCARS presets
lcars_button_preset: bullet
lcars_text_preset: bullet

# Bracket styling (LCARS feature)
bracket_style: false
bracket_color: var(--lcars-blue)
bracket_width: 2
bracket_gap: 4
bracket_extension: 8
bracket_opacity: 1.0
```

### **Status Grid Cell Properties**

```yaml
# Grid cell styling
cell_padding: 8
cell_spacing: 4
cell_radius: 8
normalize_radius: true

# Text layout
text_layout: stacked                   # stacked, side-by-side
```

### **ApexCharts Properties**

ApexCharts is an **exception** - it mirrors the ApexCharts library API which uses camelCase:

```yaml
# ApexCharts uses camelCase (library convention)
chartType: line
strokeWidth: 2
markerSize: 4
axisBorderColor: var(--lcars-gray)
gridColor: var(--lcars-darkgray)
```

---

## Implementation Plan

### Phase 1: Schema Updates ✅

**Files to Update:**
- `src/msd/validation/schemas/common.js` - Add nested border structure
- `src/msd/validation/schemas/buttonOverlay.js` - Update to nested structure
- `src/msd/validation/schemas/statusGridOverlay.js` - Update to nested structure
- `src/msd/validation/schemas/textOverlay.js` - Update to nested structure

**Schema Definition:**
```javascript
border: {
  type: 'object',
  optional: true,
  properties: {
    color: { type: 'string', format: 'color', optional: true },
    width: { type: 'number', min: 0, max: 20, optional: true },
    radius: { type: 'number', min: 0, optional: true },
    style: { type: 'string', enum: ['solid', 'dashed', 'dotted'], optional: true },

    // Individual sides
    top: { type: 'object', optional: true, properties: { /* same as border */ } },
    right: { type: 'object', optional: true, properties: { /* same as border */ } },
    bottom: { type: 'object', optional: true, properties: { /* same as border */ } },
    left: { type: 'object', optional: true, properties: { /* same as border */ } },

    // Individual corners
    radius_top_left: { type: 'number', min: 0, optional: true },
    radius_top_right: { type: 'number', min: 0, optional: true },
    radius_bottom_right: { type: 'number', min: 0, optional: true },
    radius_bottom_left: { type: 'number', min: 0, optional: true }
  }
}
```

### Phase 2: RendererUtils Normalization ✅

**File:** `src/msd/renderer/RendererUtils.js`

**Update `parseStandardColorStyles()` and add `parseStandardBorderStyles()`:**

```javascript
/**
 * Parse and normalize border properties
 * Accepts both legacy flat format and new nested format
 * Always returns normalized nested structure
 */
static parseStandardBorderStyles(style) {
  // Handle legacy flat format (border_color, border_width, etc.)
  const legacyBorder = {
    color: style.border_color || style.borderColor,
    width: style.border_width || style.borderWidth,
    radius: style.border_radius || style.borderRadius,
    style: style.border_style || style.borderStyle
  };

  // Handle new nested format
  const nestedBorder = style.border || {};

  // Merge (nested takes precedence)
  const border = {
    color: nestedBorder.color || legacyBorder.color || 'var(--lcars-gray)',
    width: nestedBorder.width ?? legacyBorder.width ?? 1,
    radius: nestedBorder.radius ?? legacyBorder.radius ?? 0,
    style: nestedBorder.style || legacyBorder.style || 'solid',

    // Individual sides
    top: this._parseBorderSide(nestedBorder.top, style.border_top),
    right: this._parseBorderSide(nestedBorder.right, style.border_right),
    bottom: this._parseBorderSide(nestedBorder.bottom, style.border_bottom),
    left: this._parseBorderSide(nestedBorder.left, style.border_left),

    // Individual corners (convert snake_case to camelCase)
    radiusTopLeft: nestedBorder.radius_top_left ?? style.border_radius_top_left,
    radiusTopRight: nestedBorder.radius_top_right ?? style.border_radius_top_right,
    radiusBottomRight: nestedBorder.radius_bottom_right ?? style.border_radius_bottom_right,
    radiusBottomLeft: nestedBorder.radius_bottom_left ?? style.border_radius_bottom_left
  };

  return border;
}

static _parseBorderSide(nested, legacy) {
  if (!nested && !legacy) return null;

  return {
    color: nested?.color || legacy?.color,
    width: nested?.width ?? legacy?.width,
    style: nested?.style || legacy?.style
  };
}
```

### Phase 3: Overlay Style Resolution Updates 🚧

**Update all overlay `_resolve*Styles()` methods to use normalized format:**

**Files:**
- `src/msd/overlays/ButtonOverlay.js`
- `src/msd/overlays/TextOverlay.js`
- `src/msd/overlays/StatusGridOverlay.js` (via StatusGridRenderer)
- `src/msd/overlays/LineOverlay.js`

**Pattern:**
```javascript
_resolveButtonOverlayStyles(style, overlayId, overlay = null) {
  // Parse normalized styles
  const standardStyles = RendererUtils.parseAllStandardStyles(style);
  const border = standardStyles.border; // Already normalized

  const buttonStyle = {
    color: this._resolveStyleProperty(style.color, ...),
    opacity: this._resolveStyleProperty(style.opacity, ...),

    // Use normalized border object directly
    border: border,

    // Text colors remain flat (single level)
    label_color: this._resolveStyleProperty(style.label_color, ...),
    value_color: this._resolveStyleProperty(style.value_color, ...),
    // ...
  };

  return buttonStyle;
}
```

### Phase 4: Renderer Updates 🚧

**Update all renderers to expect normalized format:**

**Files:**
- `src/msd/renderer/core/ButtonRenderer.js` ✅ Already expects `border.color`, `border.width`, `border.radius`
- `src/msd/renderer/core/TextRenderer.js` - Update to use nested border
- `src/msd/renderer/core/LineRenderer.js` - Update to use nested border
- `src/msd/renderer/specialized/StatusGridRenderer.js` - Update to use nested border

**Example (ButtonRenderer already correct):**
```javascript
// Update border/stroke color
if (newStyle.border?.color !== undefined) {
  backgroundElement.setAttribute('stroke', newStyle.border.color);
}

// Update border width
if (newStyle.border?.width !== undefined) {
  backgroundElement.setAttribute('stroke-width', newStyle.border.width);
}

// Update border radius
if (newStyle.border?.radius !== undefined) {
  rectElement.setAttribute('rx', newStyle.border.radius);
  rectElement.setAttribute('ry', newStyle.border.radius);
}

// Individual sides (if provided)
if (newStyle.border?.top?.color !== undefined) {
  // Apply top border color (may need special rendering)
}
```

### Phase 5: Remove Transform Code 🚧

**Remove all temporary transform code added during incremental updates:**

- ❌ Remove transform in `ButtonOverlay.updateIncremental()`
- ❌ Remove any other overlay-specific transforms
- ✅ All overlays use RendererUtils normalization

### Phase 6: Test Configuration Updates 🚧

**Update all test/example configurations:**

**Files:**
- `test-button-incremental.yaml`
- `msd-testing-config.yaml`
- All example configs in `src/cb-lcars/`
- Documentation examples

**Pattern:**
```yaml
# OLD (flat, snake_case)
border_width: 2
border_color: var(--lcars-blue)
border_radius: 8

# NEW (nested, snake_case)
border:
  width: 2
  color: var(--lcars-blue)
  radius: 8
```

### Phase 7: Theme Token Updates ✅

**Verify theme tokens align with new structure:**

**File:** `src/msd/themes/tokens/lcarsClassicTokens.js`

Already uses camelCase internally (correct):
```javascript
{
  borders: {
    width: {
      base: 1,
      thick: 2,
      thin: 0.5
    },
    radius: {
      sm: 4,
      md: 8,
      lg: 16,
      full: 9999
    }
  },
  colors: {
    ui: {
      border: 'var(--lcars-gray)'
    }
  }
}
```

### Phase 8: Documentation 📝

**Create/update documentation:**
- ✅ This standardization document
- 🚧 Update `INCREMENTAL_UPDATE_QUICK_REFERENCE.md`
- 🚧 Create `STYLE_PROPERTY_REFERENCE.md` (comprehensive property guide)
- 🚧 Update architecture docs

---

## Migration Strategy

### Backward Compatibility

**RendererUtils will accept BOTH formats during migration:**

```javascript
// ✅ OLD FORMAT (still works)
{
  border_color: 'var(--lcars-blue)',
  border_width: 2,
  border_radius: 8
}

// ✅ NEW FORMAT (preferred)
{
  border: {
    color: 'var(--lcars-blue)',
    width: 2,
    radius: 8
  }
}

// ✅ MIXED (works, nested takes precedence)
{
  border_color: 'var(--lcars-gray)',  // Fallback
  border: {
    color: 'var(--lcars-blue)'        // Wins
  }
}
```

### Deprecation Timeline

1. **Phase 1-2 (Week 1)**: Add support for new format, keep old format working
2. **Phase 3-5 (Week 2)**: Update all internal code to use new format
3. **Phase 6 (Week 3)**: Update all configs and tests
4. **Phase 7 (Week 4)**: Add deprecation warnings for old format
5. **Phase 8 (Future)**: Remove old format support (major version bump)

---

## Reference Examples

### Complete Button Example (New Standard Format)

**Matches legacy cb-lcars template structure:**

```yaml
- id: my_button
  type: button
  position: [100, 100]
  size: [200, 60]
  label: "Power"

  style:
    # Colors (with state support - matches legacy)
    color:
      default: var(--lcars-blue)
      active: var(--lcars-yellow)
      inactive: var(--lcars-gray)
      unavailable: var(--lcars-darkgray)

    opacity: 0.9

    # Border (nested structure - standardized from legacy)
    border:
      color: var(--lcars-gray)        # Default
      width: 2                         # Default (was 'size' in legacy)
      radius: 12                       # Default
      bottom:
        color: var(--lcars-orange)
        width: 6
      radius_bottom_left: 0           # Was border.bottom.left_radius
      radius_bottom_right: 0

    # Text (nested - matches legacy exactly)
    text:
      label:
        font_size: 20
        font_weight: bold
        text_transform: uppercase
        color:
          default: var(--lcars-white)
          active: var(--lcars-black)
        padding:
          top: 5
          right: 24
          bottom: 5
          left: 24

      value:
        font_size: 16
        color:
          default: var(--lcars-cyan)
          active: var(--lcars-red)
        padding:
          top: 5
          right: 24
          bottom: 5
          left: 24

    # LCARS presets
    lcars_button_preset: bullet

  tap_action:
    action: toggle
    entity: light.living_room
```

### Rules Engine Patches (New Standard Format)

```yaml
rules:
  - conditions:
      - entity: light.living_room
        state: "on"
    patches:
      - overlay_id: my_button
        style:
          color:
            default: var(--lcars-green)
          border:
            color: var(--lcars-green)
            width: 3
            radius: 0
          text:
            label:
              color:
                default: var(--lcars-red)
```

### Text Array Example (Multiple Text Elements)

```yaml
- id: multi_text_button
  type: button
  position: [100, 100]
  size: [200, 80]

  style:
    text:
      texts:
        - content: "POWER"
          font_size: 24
          font_weight: bold
          color: var(--lcars-white)
          padding: { top: 5, left: 10, bottom: 2, right: 10 }

        - content: "{{states('sensor.power_usage')}} W"
          font_size: 16
          color: var(--lcars-cyan)
          padding: { top: 2, left: 10, bottom: 5, right: 10 }
```

---

## Benefits After Standardization

✅ **Consistency**: One clear standard across entire codebase
✅ **Readability**: Hierarchical structure is intuitive
✅ **Maintainability**: No more transform code in overlays
✅ **Extensibility**: Easy to add new border properties
✅ **Type Safety**: Clear structure for TypeScript (future)
✅ **Documentation**: Easy to document and understand
✅ **Performance**: No runtime transforms in overlays

---

## Next Actions

1. ✅ Create this standardization document
2. 🔄 Review and approve structure (YOU ARE HERE)
3. 🚧 Update schemas (Phase 1)
4. 🚧 Update RendererUtils (Phase 2)
5. 🚧 Update overlays (Phase 3)
6. 🚧 Update renderers (Phase 4)
7. 🚧 Remove transforms (Phase 5)
8. 🚧 Update configs (Phase 6)
9. 🚧 Update docs (Phase 8)

---

**Decisions Made:**

1. ✅ Nested `border` object structure? **APPROVED**
2. ✅ `snake_case` for user config? **APPROVED**
3. ✅ `camelCase` for internal JS? **APPROVED**
4. ✅ `padding`/`margin` nested objects? **YES - matches legacy templates**
5. ✅ Text properties nested under `text: {}`? **YES - matches legacy templates**
6. ✅ ApexCharts exception for camelCase? **YES - library convention**
7. ✅ Border property names: `size` → `width`, corners at top level
8. ✅ Align with existing cb-lcars legacy template structure

