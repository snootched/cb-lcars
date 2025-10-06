# MSD Configuration Layering & Defaults System

This document explains how configuration flows through the MSD system, from packs to final resolved values.

## 1. Configuration Sources & Priority

The MSD system uses a **layered configuration approach** with clear priority ordering:

```
┌─────────────────────────────────────────────────────────────┐
│                   FINAL RESOLVED VALUES                    │
│                    (what gets rendered)                    │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│ 5. STYLE RESOLUTION (in StatusGridRenderer._resolveStyles) │
│    • Uses DefaultsManager.resolve() for fallbacks          │
│    • Applies button presets via _applyButtonPreset()       │
│    • Smart calculations (font-relative spacing, etc.)      │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│ 4. USER STYLE CONFIGURATION (highest priority)             │
│    • Direct style properties in overlay.style              │
│    • User-specified values override everything             │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│ 3. DEFAULTS MANAGER LAYERS (mergePacks.js → DefaultsManager)│
│    ┌─ User Layer (priority 1000) ─────────────────────────┐ │
│    │   • User's direct defaults in config                │ │
│    ├─ Pack Layer (priority 100+) ──────────────────────--┤ │
│    │   • CB-LCARS pack: text_padding: 12, cell_radius: 8 │ │
│    │   • Other loaded packs                              │ │
│    ├─ Theme Layer (priority 50) ─────────────────────────┤ │
│    │   • Theme-specific defaults                         │ │
│    └─ Builtin Layer (priority 10) ──────────────────────┘ │
│        • Core MSD defaults: text_padding: 8, etc.        │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│ 2. PACK LOADING & MERGING (mergePacks.js)                  │
│    • Loads packs from use_packs: { builtin: [...] }        │
│    • Merges pack profiles into unified config              │
│    • Creates __provenance for tracking                     │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│ 1. RAW USER CONFIGURATION                                  │
│    • YAML config from user                                 │
│    • Specifies which packs to use                          │
└─────────────────────────────────────────────────────────────┘
```

## 2. Detailed Flow

### Step 1: Pack Loading (mergePacks.js)
```javascript
// User config specifies which packs to load
userConfig = {
  use_packs: {
    builtin: ['core', 'cb_lcars_buttons']
  },
  overlays: [...]
}

// mergePacks.js loads the specified packs
const builtinPacks = loadBuiltinPacks(['core', 'cb_lcars_buttons']);
// Result: [corePack, cbLcarsPack] with their profiles/defaults
```

### Step 2: Defaults Manager Population (SystemsManager.js)
```javascript
// SystemsManager extracts pack defaults and loads them
const packs = loadBuiltinPacks(packNames);
this.defaultsManager.loadFromPacks(packs);

// This processes pack.profiles[].defaults into layers:
// Pack Layer gets: status_grid.text_padding = 12 (from CB-LCARS pack)
// Builtin Layer has: status_grid.text_padding = 8 (from core defaults)
```

### Step 3: Style Resolution (StatusGridRenderer.js)
```javascript
_resolveStatusGridStyles(style, overlayId, overlay) {
  // 1. Use user's direct style values first
  const userTextPadding = style.text_padding || style.textPadding;

  // 2. Fall back to defaults manager (which checks layers in priority order)
  const defaultTextPadding = this._getDefault('status_grid.text_padding', 8);

  // 3. Final value uses user value OR defaults manager value
  const finalTextPadding = userTextPadding || defaultTextPadding;

  // 4. Apply button presets (which can override the above)
  if (gridStyle.lcars_button_preset) {
    this._applyButtonPreset(gridStyle, presetName); // May set text_padding: 10
  }
}
```

## 3. DefaultsManager Layer Resolution

The DefaultsManager resolves values using **priority-based layer checking**:

```javascript
// When StatusGridRenderer calls: this._getDefault('status_grid.text_padding', 8)
DefaultsManager.resolve('status_grid.text_padding') {
  // Check layers in priority order (high to low):

  // 1. User Layer (priority 1000) - user's explicit defaults
  if (userLayer.has('status_grid.text_padding')) return userLayer.get(...);

  // 2. Pack Layer (priority 100+) - CB-LCARS pack defaults
  if (packLayer.has('status_grid.text_padding')) return 12; // ← CB-LCARS value!

  // 3. Theme Layer (priority 50) - theme defaults
  if (themeLayer.has('status_grid.text_padding')) return themeLayer.get(...);

  // 4. Builtin Layer (priority 10) - core MSD defaults
  if (builtinLayer.has('status_grid.text_padding')) return 8; // ← Core fallback

  // 5. No default found
  return null;
}
```

## 4. Pack Structure & Profile Processing

### Pack Definition (loadBuiltinPacks.js)
```javascript
const CB_LCARS_BUTTONS_PACK = {
  id: 'cb_lcars_buttons',

  // PROFILES: Provide defaults to DefaultsManager (fallback values)
  profiles: [
    {
      id: 'cb_button_defaults',
      defaults: {
        status_grid: {
          text_padding: 12,     // ← This becomes pack layer value
          cell_radius: 8,       // ← This overrides builtin value of 2
          text_margin: 3        // ← Enhanced spacing
        }
      }
    }
  ],

  // STYLE PRESETS: Named style bundles for applying complete style sets
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
  },

  // PALETTES: Named color schemes
  palettes: {
    cb_lcars_buttons: {
      primary: 'var(--lcars-blue, #0088ff)',
      'picard-gold': '#d4af37'
    }
  }
}
```

### Profile Processing (MsdDefaultsManager.js)
```javascript
loadFromPacks(packs) {
  packs.forEach(pack => {
    pack.profiles?.forEach(profile => {
      if (profile.defaults) {
        // Flatten nested defaults: { status_grid: { text_padding: 12 } }
        // Becomes: "status_grid.text_padding" → 12
        const flattened = this.flattenDefaults(profile.defaults);

        // Store in pack layer
        this.layers.get('pack').set('status_grid.text_padding', 12);
      }
    });
  });
}
```

## 5. Style Presets System

Style presets work as **named style bundles** that can be applied to overlays:

```javascript
// In user config:
style: {
  lcars_button_preset: "lozenge",  // Loads preset from pack
  cell_color: "#ff6600"            // User override
}

// StatusGridRenderer loads preset from pack and applies:
// 1. All preset properties (text_layout, cell_radius, etc.)
// 2. Respects user overrides (cell_color wins over preset)
```

### How Presets Work

1. **Pack Definition**: Style presets defined in pack `style_presets` section
2. **Runtime Loading**: StatusGridRenderer loads preset by name from loaded packs
3. **Style Application**: All preset properties applied to overlay style
4. **User Override**: Explicit user properties always win over preset values

### Preset vs Defaults vs User Values

```yaml
# Pack defines preset:
style_presets:
  status_grid:
    lozenge:
      text_padding: 10      # Preset value
      cell_radius: 12       # Preset value

# User applies preset + override:
style:
  lcars_button_preset: "lozenge"  # Loads preset
  text_padding: 15                # USER WINS: final value is 15
  # cell_radius not specified     # PRESET WINS: uses 12
```

## 6. Priority Summary

From **highest to lowest priority**:

1. **User Style Properties** - Direct `style.text_padding` values (highest priority)
2. **Style Preset Values** - `lcars_button_preset: "lozenge"` properties
3. **User Defaults Layer** - User's explicit defaults
4. **Pack Defaults Layer** - CB-LCARS pack defaults ← **Fallback values**
5. **Theme Defaults Layer** - Theme-specific defaults
6. **Builtin Defaults Layer** - Core MSD defaults
7. **Hardcoded Fallbacks** - Last resort values in code (lowest priority)## 7. Debug Commands

```javascript
// Check what packs are loaded
window.__msdDebug?.pipelineInstance?.config?.__provenance?.merge_order

// Check defaults manager layers
const dm = window.cblcars.defaults;
console.log('Pack layer:', Array.from(dm.layers.get('pack').entries()));

// Check final resolved value
console.log('Final text_padding:', dm.resolve('status_grid.text_padding'));

// Check renderer connection
const renderer = new window.StatusGridRenderer();
console.log('Renderer gets:', renderer._getDefault('status_grid.text_padding', 'FALLBACK'));
```

This system provides **maximum flexibility** while maintaining **predictable behavior** - packs provide better defaults, users can override anything, and presets provide curated combinations.