# CB-LCARS Button Preset Examples

This document provides copy-paste examples for using CB-LCARS button presets in status grids.

## Prerequisites

Make sure you have the CB-LCARS buttons p## Priority Order

1. **User explicit values** (highest priority) - Direct style properties
2. **Style preset values** (medium priority) - Applied from pack presets
3. **Pack defaults** (lower priority) - CB-LCARS pack defaults
4. **Builtin defaults** (lowest priority) - Core MSD defaults

Example:
```yaml
style:
  lcars_button_preset: "lozenge"  # Loads preset with text_padding: 10
  text_padding: 15                # USER WINS: final value is 15
  # cell_radius not specified     # PRESET WINS: uses preset value (12)
  # text_margin not specified     # PACK DEFAULT: uses pack default (3)
```

## Available Presets

The following presets are available in the CB-LCARS pack:

- **`lozenge`** - Diagonal layout, enhanced spacing, rounded corners
- **`bullet`** - Side-by-side layout, compact spacing
- **`picard-filled`** - Sharp corners, corner text, LCARS cutting
- **`badge`** - High radius, centered text, badge-like appearance
- **`compact`** - Minimal spacing, smaller fonts, dense layouts

Each preset defines a complete style configuration that can be applied and customized.your MSD configuration:

```yaml
use_packs:
  builtin: ['core', 'cb_lcars_buttons']
```

## Available Presets

### 1. Lozenge Preset
**Diagonal layout with label top-left, value bottom-right**

```yaml
- id: my_lozenge_grid
  type: status_grid
  position: [100, 100]
  size: [200, 150]
  style:
    lcars_button_preset: "lozenge"
    # Optional customizations:
    # cell_color: "#ff6600"
    # font_size: 20
  cells:
    - id: cell1
      label: "TEMP"
      content: "72°F"
    - id: cell2
      label: "HUMID"
      content: "45%"
```

### 2. Bullet Preset
**Side-by-side layout with label left, value right**

```yaml
- id: my_bullet_grid
  type: status_grid
  position: [300, 100]
  size: [200, 150]
  style:
    lcars_button_preset: "bullet"
    # Optional customizations:
    # text_padding: 12
    # cell_radius: 10
  cells:
    - id: cell1
      label: "CPU"
      content: "15%"
    - id: cell2
      label: "MEM"
      content: "8.2GB"
```

### 3. Picard-Filled Preset
**Sharp corners with corner text positioning**

```yaml
- id: my_picard_grid
  type: status_grid
  position: [500, 100]
  size: [200, 150]
  style:
    lcars_button_preset: "picard-filled"
    # This preset sets cell_radius: 0 and lcars_corners: true
    # Optional customizations:
    # cell_color: "#d4af37"  # Picard gold
  cells:
    - id: cell1
      label: "WARP"
      content: "9.2"
    - id: cell2
      label: "SHLD"
      content: "100%"
```

### 4. Badge Preset
**High radius with centered text**

```yaml
- id: my_badge_grid
  type: status_grid
  position: [100, 300]
  size: [200, 150]
  style:
    lcars_button_preset: "badge"
    # This preset sets cell_radius: 16 for rounded appearance
    # Optional customizations:
    # normalize_radius: false  # Keep exact radius
  cells:
    - id: cell1
      label: "STATUS"
      content: "ONLINE"
    - id: cell2
      label: "CONN"
      content: "SECURE"
```

### 5. Compact Preset
**Minimal spacing for dense layouts**

```yaml
- id: my_compact_grid
  type: status_grid
  position: [300, 300]
  size: [150, 100]
  style:
    lcars_button_preset: "compact"
    # This preset uses smaller fonts and padding
    # Optional customizations:
    # rows: 4
    # columns: 6
  cells:
    - id: cell1
      label: "01"
      content: "OK"
    - id: cell2
      label: "02"
      content: "OK"
    # ... more compact cells
```

## Customization Examples

### Preset + Custom Colors
```yaml
style:
  lcars_button_preset: "lozenge"
  cell_color: "#ff6600"          # Override default blue
  label_color: "#ffffff"         # Keep white labels
  border_width: 3                # Thicker borders
```

### Preset + Custom Fonts
```yaml
style:
  lcars_button_preset: "bullet"
  font_size: 24                  # Override preset font
  label_font_size: 20            # Specific label size
  value_font_size: 28            # Larger values
```

### Preset + Layout Tweaks
```yaml
style:
  lcars_button_preset: "badge"
  text_padding: 15               # More padding than preset
  cell_gap: 8                    # Bigger gaps
  # Layout properties from preset (text_layout, etc.) remain
```

## Key Features

- **Pack-Based**: Presets are defined in the CB-LCARS pack and loaded dynamically
- **Any Property Supported**: Style presets can contain any style property (no restrictions)
- **User Override**: Any explicit style property overrides the preset value
- **Layout Control**: Presets always set text_layout, label_position, value_position
- **Intelligent Defaults**: Uses CB-LCARS pack defaults for consistent spacing

## How It Works

1. **Pack Definition**: Style presets are defined in `style_presets` section of packs
2. **Runtime Loading**: StatusGridRenderer loads preset by name from loaded packs
3. **Style Application**: All preset properties are applied to the overlay
4. **Override Protection**: User's explicit values always win over preset values

## Pack Structure

```javascript
// In CB-LCARS pack:
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
```

## Priority Order

1. **User explicit values** (highest priority)
2. **Preset values** (medium priority)
3. **Pack defaults** (CB-LCARS pack)
4. **Builtin defaults** (lowest priority)

Example:
```yaml
style:
  lcars_button_preset: "lozenge"  # Sets text_padding: 10
  text_padding: 15                # USER WINS: final value is 15
  # cell_radius not specified     # PRESET WINS: uses preset value
```