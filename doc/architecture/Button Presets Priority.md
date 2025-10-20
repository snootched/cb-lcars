# Style Presets vs Explicit Styles - Priority & Override Behavior

This document explains exactly how style presets interact with explicit user styles in the MSD system.

## The Key Question
**If we set `lcars_button_preset: "lozenge"` but also set `font_size: 20` explicitly, which wins?**

## Answer: **Explicit Styles Always Win** ✅

Here's the **exact order of operations** in `StatusGridRenderer._resolveStatusGridStyles()`:

## Step-by-Step Resolution Process

### Step 1: Parse Standard Styles
```javascript
const standardStyles = RendererUtils.parseAllStandardStyles(style);
```

### Step 2: Build Base Grid Style (with explicit values first)
```javascript
const gridStyle = {
  // USER EXPLICIT VALUES get priority in the initial object
  font_size: Number(style.font_size || style.fontSize) || /* fallback logic */,
  text_padding: Number(style.text_padding || style.textPadding || this._getDefault('status_grid.text_padding', 8)),
  cell_radius: Number(style.cell_radius || style.cellRadius || this._getDefault('status_grid.cell_radius', 2)),

  // Preset specification (doesn't apply yet)
  lcars_button_preset: style.lcars_button_preset || style.lcarsButtonPreset || null,

  // ... all other properties
};
```

### Step 3: Apply Style Preset (AFTER base values are set)
```javascript
// PHASE 2: Apply CB-LCARS Button Preset if specified
if (gridStyle.lcars_button_preset) {
  this._applyButtonPreset(gridStyle, gridStyle.lcars_button_preset, style);
}
```

### Step 4: What `_applyButtonPreset()` Does
```javascript
_applyButtonPreset(gridStyle, presetName, originalStyle) {
  // Load preset from pack
  const presetStyles = this._loadPresetFromPacks('status_grid', presetName);

  // Apply with user override protection
  Object.entries(presetStyles).forEach(([property, value]) => {
    const userProvided = originalStyle[property] !== undefined;

    if (!userProvided) {
      gridStyle[property] = value;  // Only set if user didn't specify
    }
    // User value is preserved if they provided one
  });
}
```

## ✅ CURRENT BEHAVIOR (Correct)

```javascript
// Current (CORRECT) behavior:
const gridStyle = {
  font_size: 20,                    // ← User explicitly set this
  lcars_button_preset: 'lozenge'
};

// After _applyButtonPreset():
gridStyle.font_size = 20;           // ← User value preserved! GOOD!
gridStyle.text_padding = 10;        // ← Preset value (user didn't specify)
```

## How Style Presets Work

Style presets are loaded from pack data:

```javascript
// Pack defines presets:
style_presets: {
  status_grid: {
    lozenge: {
      text_layout: 'diagonal',
      label_position: 'top-left',
      value_position: 'bottom-right',
      cell_radius: 12,
      text_padding: 10,
      // Any style property can be included
    }
  }
}

// Runtime loading:
const preset = pack.style_presets.status_grid.lozenge;
// Applies all preset properties with user override protection
```## Desired Priority Order (Fixed)

```
1. USER EXPLICIT VALUES (highest) - style.font_size: 20
2. BUTTON PRESET VALUES (medium) - preset sets text_padding: 10
3. PACK DEFAULTS (lower) - CB-LCARS pack: text_padding: 12
4. BUILTIN DEFAULTS (lowest) - Core: text_padding: 8
```

## Example Scenarios (After Fix)

### Scenario 1: User Sets Font Size + Lozenge Preset
```yaml
style:
  lcars_button_preset: "lozenge"
  font_size: 20                    # User explicit value
```

**Result:**
- `font_size: 20` ← User value wins
- `text_padding: 10` ← Preset value (user didn't specify)
- `cell_radius: 12` ← Preset value (user didn't specify)
- `text_layout: 'diagonal'` ← Preset layout (always applied)

### Scenario 2: User Sets Text Padding + Lozenge Preset
```yaml
style:
  lcars_button_preset: "lozenge"
  text_padding: 15                 # User explicit value
```

**Result:**
- `text_padding: 15` ← User value wins
- `cell_radius: 12` ← Preset value (user didn't specify)
- `font_size: 18` ← Default value (neither preset nor user specified)
- `text_layout: 'diagonal'` ← Preset layout (always applied)

### Scenario 3: Pure Preset (No User Overrides)
```yaml
style:
  lcars_button_preset: "lozenge"
```

**Result:**
- `text_padding: 10` ← Preset value
- `cell_radius: 12` ← Preset value
- `font_size: 18` ← Default value
- `text_layout: 'diagonal'` ← Preset layout

## Categories of Preset Properties

**Always Applied (Preset Wins):**
- Layout properties: `text_layout`, `label_position`, `value_position`
- Preset-specific flags: `lcars_corners`, `normalize_radius`

**User Can Override:**
- Sizing: `font_size`, `text_padding`, `cell_radius`
- Colors: `cell_color`, `label_color`, `value_color`
- Spacing: `text_margin`, `cell_gap`

## Implementation Status

- ❌ **Current**: Presets override explicit user values (wrong)
- ✅ **Needed**: Explicit user values override preset defaults (correct)

This needs to be fixed to provide the expected behavior where user explicit values always win over preset defaults.