# Base SVG Enhancements - Quick Reference

## Features Approved ✅

### 1. Base SVG "None" Support
Allow cards without base SVG layer:
```yaml
base_svg:
  source: "none"
view_box: [0, 0, 800, 600]  # Required
```

### 2. Filter Effects
Static filters via config:
```yaml
base_svg:
  source: "builtin:ncc-1701-d"
  filters:
    opacity: 0.4
    blur: "2px"
    brightness: 0.7
```

Or use presets:
```yaml
base_svg:
  source: "builtin:ncc-1701-d"
  filter_preset: "dimmed"
```

### 3. Rules Engine Integration
Dynamic filter updates:
```yaml
rules:
  - id: night_dim
    when:
      time:
        after: "22:00:00"
        before: "06:00:00"
    apply:
      actions:
        - type: update_base_svg_filter
          filters:
            opacity: 0.2
            brightness: 0.5
          transition: 1000  # Smooth 1s fade
```

### 4. Theme System Integration

**Built-in presets** are available by default (see table below).

**Custom theme presets** override built-ins:
```yaml
# In pack's theme definition
themes:
  my-theme:
    filter_presets:
      dimmed:
        opacity: 0.3  # Override built-in 0.5
        brightness: 0.6

      custom-preset:  # Add new preset
        opacity: 0.7
        blur: "2px"
```

**Note**: Theme presets take precedence over built-in presets with the same name.

Token-based values (optional):
```yaml
base_svg:
  filters:
    opacity: "{{ tokens.filters.base_opacity }}"
```

---

## Built-in Presets

| Preset | Effect | Use Case |
|--------|--------|----------|
| `dimmed` | opacity: 0.5, brightness: 0.8 | Subtle backdrop |
| `subtle` | opacity: 0.6, blur: 1px, grayscale: 0.2 | Gentle de-emphasis |
| `backdrop` | opacity: 0.3, blur: 3px, brightness: 0.6 | Heavy dimming for prominent overlays |
| `faded` | opacity: 0.4, grayscale: 0.5, contrast: 0.7 | Washed-out look |
| `red-alert` | opacity: 1.0, brightness: 1.2, hue_rotate: 10 | Alert mode (bright + red tint) |
| `monochrome` | opacity: 0.6, grayscale: 1.0, contrast: 0.8 | Full grayscale |

---

## Filter Properties

| Property | Type | Range | Example | Description |
|----------|------|-------|---------|-------------|
| `opacity` | number | 0-1 | `0.5` | Transparency (0=invisible, 1=opaque) |
| `blur` | string | - | `"2px"` | Gaussian blur (px, rem, em) |
| `brightness` | number | 0-2 | `0.7` | Brightness (0=black, 1=normal, 2=bright) |
| `contrast` | number | 0-2 | `0.8` | Contrast (0=gray, 1=normal, 2=high) |
| `grayscale` | number | 0-1 | `0.5` | Desaturation (0=color, 1=grayscale) |
| `sepia` | number | 0-1 | `0.3` | Sepia tone (0=none, 1=full sepia) |
| `hue_rotate` | number | -360 to 360 | `10` | Hue rotation in degrees |
| `saturate` | number | 0-2 | `1.3` | Saturation (0=gray, 1=normal, 2=vivid) |
| `invert` | number | 0-1 | `0.2` | Color inversion (0=normal, 1=inverted) |

---

## Architecture

```
Theme System
  ├── Filter Presets (dimmed, backdrop, etc.)
  └── Filter Tokens (tokens.filters.*)
      ↓
CardModel
  └── baseSvg.filters (resolved filters)
      ↓
Renderer
  └── Apply CSS filters to base SVG
      ↓
RulesEngine
  └── Update filters dynamically
      ↓
SystemsManager
  └── Apply with smooth transitions
```

---

## Use Cases

### Time-Based Dimming
```yaml
base_svg:
  source: "builtin:ncc-1701-d"
  filters:
    opacity: 0.6

rules:
  - when: { time: { after: "22:00", before: "06:00" } }
    apply:
      actions:
        - type: update_base_svg_filter
          filters: { opacity: 0.2, brightness: 0.5 }
```

### Alert Mode
```yaml
rules:
  - when: { entity: binary_sensor.alert, state: "on" }
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "red-alert"
```

### Performance-Based
```yaml
rules:
  - when: { datasource: metrics, property: fps, below: 30 }
    apply:
      actions:
        - type: update_base_svg_filter
          filters: { blur: "4px" }  # Reduce detail
```

### Overlay-Only Card
```yaml
base_svg:
  source: "none"
view_box: [0, 0, 1200, 800]

overlays:
  - type: apexchart
    # Full-screen chart, no background
```

---

## Implementation Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1: Core Filters** | Week 1-2 | Validation, presets, CardModel, renderer |
| **Phase 2: Rules Integration** | Week 2-3 | Action type, SystemsManager, transitions |
| **Phase 3: Token System** | Week 3 | Token resolution, theme integration |
| **Phase 4: "None" Support** | Week 1 | Validation, minimal SVG generation |
| **Phase 5: Testing & Docs** | Week 4 | Comprehensive testing, user guide |

**Total**: ~4 weeks

---

## Documentation

- **Proposal**: `BASE_SVG_ENHANCEMENTS.md`
- **Implementation Plan**: `BASE_SVG_FILTERS_IMPLEMENTATION.md`
- **This Quick Reference**: `BASE_SVG_QUICK_REFERENCE.md`

---

## Benefits

✅ **Visual Hierarchy** - Overlays pop against dimmed backgrounds
✅ **Dynamic Behavior** - Filters change based on state/time/performance
✅ **Standardized** - Presets ensure consistency across cards
✅ **Flexible** - Static, dynamic, token-based, or preset-based
✅ **Performant** - GPU-accelerated CSS filters
✅ **LCARS Appropriate** - Red-alert mode, dimming for night, etc.
✅ **No Breaking Changes** - Purely additive features

---

## Next Steps

1. ✅ Review implementation plan
2. ⏳ Start Phase 1 (core filters)
3. ⏳ Create test configs
4. ⏳ Implement rules integration
5. ⏳ Document for users
