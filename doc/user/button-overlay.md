# Button Overlay - Quick Reference

## 📚 Complete Documentation
For comprehensive button documentation including advanced features, DataSource integration, interactive actions, and configuration schema, see:

**👉 [Button Overlay Complete Documentation](./button_overlay_complete_documentation.md)**
**👉 [HA Template Syntax Reference](./home_assistant_templates.md)**

## Quick Start

### Basic Interactive Button
```yaml
overlays:
  - type: button
    id: my_button
    position: [100, 50]
    size: [140, 60]
    label: "ENGAGE"
    tap_action:
      action: toggle
      entity: switch.warp_drive
```

### Button with Texts Array (NEW)
```yaml
overlays:
  - type: button
    id: multi_text_button
    position: [100, 50]
    size: [180, 100]

    # NEW: texts array for precise control
    texts:
      - content: "REACTOR"
        position: "top-left"
        font_size: 14
      - content: "ONLINE"
        position: "center"
        font_size: 24
        font_weight: "bold"
      - content: "100%"
        position: "bottom-right"
        font_size: 16
        color: "var(--lcars-green)"

    tap_action:
      action: toggle
      entity: switch.reactor
```

### Button with Custom Positioning
```yaml
overlays:
  - type: button
    id: custom_position_button
    position: [100, 50]
    size: [200, 120]

    texts:
      - content: "TEMP"
        position: { x: "20%", y: "30%" }
        text_anchor: "start"
        font_size: 12
      - content: "23.4°C"
        position: { x: "50%", y: "50%" }
        text_anchor: "middle"
        font_size: 32
```

### Button with DataSource
```yaml
data_sources:
  reactor_status:
    type: entity
    entity: sensor.reactor_status

overlays:
  - type: button
    id: reactor_button
    position: [100, 50]
    size: [160, 80]
    source: reactor_status
    label: "REACTOR"
    content: "{reactor_status}"

    tap_action:
      action: toggle
      entity: switch.reactor_power
    hold_action:
      action: more-info
      entity: sensor.reactor_status
```

### Responsive Button with MSD Defaults
```yaml
# Profile-based scaling (recommended)
profiles:
  - id: responsive
    defaults:
      button:
        font_size:
          value: 18              # Base font size
          scale: "viewbox"       # Scales with SVG dimensions
          unit: "px"
        text_padding:
          value: 8               # Corner-aware padding
          scale: "viewbox"       # Scales with dimensions
          unit: "px"
        color: "var(--lcars-blue)"
        hover_color: "var(--lcars-yellow)"

overlays:
  - type: button
    id: scaled_button
    position: [100, 50]
    size: [150, 60]
    label: "SYSTEM"
    # Inherits scalable fonts and styling from profile

  - type: button
    id: custom_button
    position: [100, 150]
    size: [150, 60]
    label: "CUSTOM"
    style:
      color: "var(--lcars-red)"  # Override specific properties
      font_size: 20             # Simple number = no scaling
```

### CB-LCARS Presets
```yaml
overlays:
  # Lozenge style - classic LCARS look
  - type: button
    id: lozenge_button
    position: [100, 50]
    size: [140, 60]
    lcars_button_preset: lozenge
    label: "WARP"
    content: "ONLINE"

  # Bullet style - side-by-side text
  - type: button
    id: bullet_button
    position: [100, 150]
    size: [140, 60]
    lcars_button_preset: bullet
    label: "TEMP"
    content: "23°C"

  # Corner style - both text in corner
  - type: button
    id: corner_button
    position: [100, 250]
    size: [140, 60]
    lcars_button_preset: corner
    label: "STATUS"
    content: "OK"
```

### LCARS Styling
```yaml
overlays:
  - type: button
    id: lcars_button
    position: [100, 50]
    size: [160, 80]
    label: "PLASMA RELAY"
    content: "ACTIVE"

    style:
      color: "var(--lcars-blue)"
      # LCARS features
      lcars_corners: true
      bracket_style: true
      bracket_color: "var(--lcars-orange)"
      status_indicator: "var(--lcars-green)"
      # Hover effects
      hover_enabled: true
      hover_color: "var(--lcars-yellow)"
      hover_scale: 1.1
```

## Key Features Reference

### Action Types
- **tap_action** - Click/tap action
- **hold_action** - Long press action
- **double_tap_action** - Double-tap action

### Supported Actions
- **toggle** - Toggle entity state
- **call-service** - Call Home Assistant service
- **navigate** - Navigate to dashboard
- **more-info** - Show entity details
- **url** - Open URL
- **fire-dom-event** - Custom events

### DataSource Integration
- **source** - DataSource reference
- **Template strings** - `content: "{source:.1f}°C"`
- **Conditional content** - `content: "{value > 50 ? 'HIGH' : 'LOW'}"`

### CB-LCARS Presets
- **lozenge** - Label top-left, content bottom-right
- **bullet** - Label left, content right (side-by-side)
- **corner** - Both text elements in corner, stacked
- **badge** - Label top-center, content centered

### LCARS Features
- **lcars_corners** - LCARS-style cut corners
- **bracket_style** - LCARS brackets around button
- **status_indicator** - Status indicator dot
- **Text positioning** - Smart corner-aware padding

### Text Configuration Formats

**Legacy Format (Still Supported)**
```yaml
label: "WARP DRIVE"
content: "ENGAGED"
```

**New Texts Array Format (Recommended)**
```yaml
texts:
  - content: "Text 1"
    position: "top-left"
    font_size: 14
  - content: "Text 2"
    position: "bottom-right"
    font_size: 18
```

### Position Options

**Predefined Positions**
- `center`, `center-top`, `center-bottom`
- `top-left`, `top-right`, `bottom-left`, `bottom-right`
- `left`, `right`, `top`, `bottom`

**Custom Position Objects**
```yaml
position:
  x: "20%"     # Percentage or pixels
  y: "30%"     # Percentage or pixels
  text_anchor: "start"  # start, middle, end
  dominant_baseline: "hanging"  # hanging, middle, baseline
```

**Array Format (Percentage)**
```yaml
position: [25, 75]  # [x%, y%]
```

### Text Properties

Each text in the array supports:
- `content` - Text content (string, template, or DataSource)
- `position` - Position (string, object, or array)
- `font_size` - Font size (number)
- `font_family` - Font family (string)
- `font_weight` - Font weight (normal, bold, etc.)
- `color` - Text color (CSS color or template)
- `text_anchor` - SVG text-anchor (start, middle, end)
- `dominant_baseline` - SVG baseline (hanging, middle, baseline)
- `opacity` - Text opacity (0-1)

## Common Patterns

### Control Button
```yaml
tap_action:
  action: toggle
  entity: switch.device
hold_action:
  action: more-info
  entity: switch.device
```

### Navigation Button
```yaml
tap_action:
  action: navigate
  navigation_path: /lovelace/engineering
```

### Service Call Button
```yaml
tap_action:
  action: call-service
  service: script.red_alert
  service_data:
    duration: 60
```

### Template Action
```yaml
tap_action:
  action: call-service
  service: climate.set_temperature
  service_data:
    entity_id: climate.bridge
    temperature: "{{ states('climate.bridge') | float + 1 }}"
```

## Default Value Overrides

### Global Defaults
```yaml
# Override system defaults globally
defaults:
  button:
    color: "var(--lcars-cyan)"
    border_radius: 12
    font_size:
      value: 18
      scale: "viewbox"
    text_padding: 10
    hover_enabled: true
```

### Layer-Based Customization
```javascript
// Via JavaScript (runtime)
window.cblcars.defaults.set('user', 'button.color', '#00ffff');
window.cblcars.defaults.set('user', 'button.hover_scale', 1.2);
window.cblcars.defaults.set('theme', 'button.bracket_style', true);

// Check current defaults
window.cblcars.defaults.debug();
```

## Available Default Paths

Key defaults you can override:

### Core Properties
- `button.color` - Background color
- `button.border_radius` - Corner radius (8)
- `button.border_color` - Border color
- `button.border_width` - Border thickness (2)

### Text Styling (Supports Scaling)
- `button.font_size` - Base font size (16, supports scaling)
- `button.label_font_size` - Label font size (18, supports scaling)
- `button.value_font_size` - Content font size (16, supports scaling)
- `button.font_family` - Font family
- `button.label_color` - Label text color
- `button.value_color` - Content text color
- `button.text_padding` - Padding from edges (8)

### LCARS Features
- `button.bracket_color` - Bracket color
- `button.bracket_width` - Bracket stroke width (2)
- `button.bracket_gap` - Distance from button (4)
- `button.bracket_extension` - Bracket arm length (8)
- `button.status_indicator` - Status indicator (false)

### Interaction
- `button.hover_enabled` - Enable hover effects (true)
- `button.hover_color` - Hover color
- `button.hover_scale` - Hover scale factor (1.05)

### Animation
- `button.animatable` - Enable animations (true)
- `button.reveal_animation` - Initial reveal (false)
- `button.pulse_on_change` - Pulse on data change (false)

For complete documentation including all configuration options, advanced examples, and troubleshooting, see the [complete documentation](./button_overlay_complete_documentation.md).
