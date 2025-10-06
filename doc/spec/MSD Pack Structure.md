# MSD Pack Structure & Style Presets

This document explains the complete structure of MSD packs and how style presets work.

## Pack Structure Overview

MSD packs contain several sections, each serving a specific purpose:

```javascript
const PACK = {
  id: 'pack_name',
  version: '1.0.0',
  description: 'Pack description',

  // Core pack sections:
  profiles: [],        // Defaults for DefaultsManager
  style_presets: {},   // Named style bundles
  overlays: [],        // Complete overlay definitions
  palettes: {},        // Named color schemes
  animations: [],      // Animation definitions
  rules: [],          // Rule definitions
  anchors: {},        // Anchor definitions
  routing: {}         // Routing configurations
};
```

## Pack Sections Explained

### 1. Profiles (Defaults)
**Purpose**: Provide fallback values to the DefaultsManager system
**Usage**: Applied when no other value is specified

```javascript
profiles: [
  {
    id: 'profile_name',
    defaults: {
      status_grid: {
        text_padding: 12,    // Fallback if nothing else specified
        cell_radius: 8,      // Better default than builtin
        text_margin: 3       // Pack-specific spacing
      }
    }
  }
]
```

### 2. Style Presets (Named Style Bundles)
**Purpose**: Provide complete, named style configurations that can be applied
**Usage**: Applied when `lcars_button_preset: "preset_name"` is specified

```javascript
style_presets: {
  status_grid: {
    lozenge: {
      text_layout: 'diagonal',
      label_position: 'top-left',
      value_position: 'bottom-right',
      cell_radius: 12,
      text_padding: 10,
      text_margin: 3,
      normalize_radius: true,
      show_labels: true,
      show_values: true,
      // ANY style property can be included
      cell_color: '#0088ff',
      font_size: 18,
      custom_property: 'custom_value'
    }
  }
}
```

### 3. Overlays (Complete Definitions)
**Purpose**: Provide complete, ready-to-use overlay configurations
**Usage**: Merged into user config as actual overlays

```javascript
overlays: [
  {
    id: 'power_status_grid',
    type: 'status_grid',
    position: [100, 100],
    size: [200, 150],
    style: {
      lcars_button_preset: 'lozenge'
    },
    cells: [
      { id: 'power', label: 'PWR', content: '{power.state}' }
    ]
  }
]
```

### 4. Palettes (Color Schemes)
**Purpose**: Provide named color collections
**Usage**: Referenced in styles via palette system

```javascript
palettes: {
  cb_lcars_buttons: {
    primary: 'var(--lcars-blue, #0088ff)',
    secondary: 'var(--lcars-orange, #ff9900)',
    success: 'var(--lcars-green, #00ff00)',
    'picard-gold': '#d4af37'
  }
}
```

## How Style Presets Work

### 1. Pack Definition
Style presets are defined in the pack's `style_presets` section:

```javascript
style_presets: {
  status_grid: {        // Overlay type
    preset_name: {      // Preset name
      property: value,  // Any style property
      // ...
    }
  }
}
```

### 2. User Application
Users apply presets by specifying the preset name:

```yaml
- id: my_grid
  type: status_grid
  style:
    lcars_button_preset: "preset_name"  # Loads from pack
    custom_override: "value"            # User override
```

### 3. Runtime Resolution
StatusGridRenderer loads and applies the preset:

```javascript
// 1. Load preset from pack
const preset = pack.style_presets.status_grid.preset_name;

// 2. Apply with user override protection
Object.entries(preset).forEach(([property, value]) => {
  if (!userStyle[property]) {           // User didn't specify
    gridStyle[property] = value;        // Apply preset value
  }
  // User value preserved if specified
});
```

## Priority Order

When resolving style values, the system uses this priority order:

1. **User Explicit Values** (highest) - Direct style properties
2. **Style Preset Values** (medium) - Applied from pack presets
3. **Pack Defaults** (lower) - From pack profiles
4. **Builtin Defaults** (lowest) - Core MSD defaults

## Example: Complete Flow

### Pack Definition
```javascript
// CB-LCARS pack defines:
profiles: [{
  defaults: {
    status_grid: { text_padding: 12 }    // Pack default
  }
}],
style_presets: {
  status_grid: {
    lozenge: {
      text_padding: 10,                  // Preset value
      text_layout: 'diagonal'            // Preset layout
    }
  }
}
```

### User Configuration
```yaml
style:
  lcars_button_preset: "lozenge"         # Apply preset
  font_size: 20                          # User override
  # text_padding not specified           # Will use preset
  # cell_radius not specified            # Will use pack default
```

### Final Resolution
```javascript
// Final style object:
{
  font_size: 20,                         // USER (highest priority)
  text_padding: 10,                      // PRESET (medium priority)
  text_layout: 'diagonal',               // PRESET (medium priority)
  cell_radius: 8,                        // PACK DEFAULT (lower priority)
  border_width: 1                        // BUILTIN DEFAULT (lowest priority)
}
```

## Benefits

- **Modularity**: Packs can be mixed and matched
- **Consistency**: Presets ensure consistent styling
- **Flexibility**: Users can override any preset property
- **Extensibility**: Packs can define any style properties
- **Maintainability**: Centralized style definitions in packs