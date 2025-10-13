# Button Overlay - Complete Documentation & Schema

This document provides comprehensive documentation for the MSD Button overlay system, including configuration options, styling features, DataSource integration, Defaults Manager integration, and interactive action capabilities.

<!-- See also: HA template reference -->
> See also: Home Assistant templates in CB-LCARS → [HA Template Syntax Reference](./home_assistant_templates.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Basic Configuration](#basic-configuration)
3. [MSD Defaults System Integration](#msd-defaults-system-integration)
4. [DataSource Integration](#datasource-integration)
5. [Styling & Appearance](#styling--appearance)
6. [Interactive Actions](#interactive-actions)
7. [Text Positioning & Layout](#text-positioning--layout)
8. [Animation & Effects](#animation--effects)
9. [LCARS Features](#lcars-features)
10. [Configuration Schema](#configuration-schema)
11. [Troubleshooting](#troubleshooting)
12. [Examples](#examples)

---

## Overview

The MSD Button overlay provides sophisticated interactive button capabilities with full CB-LCARS styling support:

- **Interactive actions** with full Home Assistant action support (toggle, call-service, navigate, etc.)
- **Real-time DataSource integration** with template string support for dynamic content
- **MSD Defaults Manager integration** for centralized configuration and responsive scaling
- **CB-LCARS preset styles** for recreating custom-button-card layouts
- **Advanced text positioning** with corner-aware padding and flexible layouts
- **LCARS visual features** including brackets, corners, status indicators, and effects
- **Responsive design** with viewbox scaling and HA theme integration
- **Performance optimized** with immediate action attachment and efficient rendering

---

## Basic Configuration

### Minimal Button
```yaml
overlays:
  - id: simple_button
    type: button
    position: [100, 50]
    size: [120, 40]
    label: "ENGAGE"
    tap_action:
      action: toggle
      entity: switch.warp_drive
```

### Complete Basic Configuration
```yaml
overlays:
  - id: detailed_button
    type: button
    position: [100, 50]            # [x, y] position
    size: [140, 60]                # [width, height] dimensions
    label: "PLASMA RELAY"          # Button label text
    content: "ONLINE"              # Button content/value text

    # Interactive Actions
    tap_action:                    # Action on tap/click
      action: toggle
      entity: switch.plasma_relay
    hold_action:                   # Action on hold/long press
      action: more-info
      entity: switch.plasma_relay
    double_tap_action:             # Action on double-tap
      action: call-service
      service: switch.turn_off
      service_data:
        entity_id: switch.plasma_relay

    style:
      # Appearance
      color: "var(--lcars-blue)"   # Button background color
      opacity: 1.0                 # Button opacity (0-1)
      border_radius: 8             # Corner radius
      border_color: "var(--lcars-gray)" # Border color
      border_width: 2              # Border thickness

      # Text styling
      label_color: "var(--lcars-white)" # Label text color
      value_color: "var(--lcars-cyan)"  # Content text color
      font_size: 16                # Font size
      font_family: "var(--lcars-font-family, Antonio)" # Font family
      font_weight: "bold"          # Font weight

      # Text positioning
      show_labels: true            # Show label text
      show_values: true            # Show content text
      label_position: "top-left"   # Label position
      value_position: "bottom-right" # Content position

      # LCARS features
      lcars_corners: true          # Enable LCARS-style cut corners
      bracket_style: true          # Enable LCARS brackets
      status_indicator: "var(--lcars-green)" # Status indicator color
```

---

## MSD Defaults System Integration

The Button overlay is fully integrated with the MSD Defaults Manager for centralized configuration management, responsive scaling, and consistent theming across all buttons.

### Centralized Configuration

All default values are managed through the defaults system with layer-based overrides:

```yaml
# Global defaults (lowest priority)
defaults:
  button:
    color: "var(--lcars-blue)"
    border_radius: 8
    font_size: 16
    label_font_size:
      value: 18
      scale: "viewbox"
      unit: "px"
    text_padding: 8

# Theme-level overrides
themes:
  - id: tactical
    defaults:
      button:
        color: "var(--lcars-red)"
        bracket_style: true
        lcars_corners: true

# User-level overrides (highest priority)
profiles:
  - id: my_setup
    defaults:
      button:
        hover_color: "var(--lcars-yellow)"
        hover_scale: 1.1
```

### Available Default Paths

#### Core Button Properties
- `button.color` - Button background color (default: 'var(--lcars-blue)')
- `button.opacity` - Button opacity (default: 1.0)
- `button.border_radius` - Corner radius (default: 8)
- `button.border_color` - Border color (default: 'var(--lcars-gray)')
- `button.border_width` - Border thickness (default: 2)

#### Text Styling (Supports Scaling)
- `button.font_size` - Base font size (default: 16, supports scaling)
- `button.label_font_size` - Label font size (default: 18, supports scaling)
- `button.value_font_size` - Content font size (default: 16, supports scaling)
- `button.font_family` - Font family (default: 'var(--lcars-font-family, Antonio)')
- `button.font_weight` - Font weight (default: 'normal')
- `button.label_color` - Label text color (default: 'var(--lcars-white)')
- `button.value_color` - Content text color (default: 'var(--lcars-white)')

#### Text Layout & Positioning
- `button.show_labels` - Show label text (default: true)
- `button.show_values` - Show content text (default: true)
- `button.label_position` - Label position (default: 'center-top')
- `button.value_position` - Content position (default: 'center-bottom')
- `button.text_padding` - Padding from button edges (default: 8)
- `button.text_margin` - Margin between text elements (default: 2)
- `button.text_layout` - Layout mode (default: 'stacked')

#### LCARS Features
- `button.lcars_corners` - LCARS-style corners (default: false)
- `button.bracket_style` - LCARS brackets (default: false)
- `button.bracket_color` - Bracket color (default: null)
- `button.bracket_width` - Bracket stroke width (default: 2)
- `button.bracket_gap` - Distance from button (default: 4)
- `button.bracket_extension` - Bracket arm length (default: 8)
- `button.status_indicator` - Status indicator (default: false)

#### Interaction
- `button.hover_enabled` - Enable hover effects (default: true)
- `button.hover_color` - Hover color (default: 'var(--lcars-yellow)')
- `button.hover_scale` - Hover scale factor (default: 1.05)

#### Animation
- `button.animatable` - Enable animations (default: true)
- `button.reveal_animation` - Initial reveal animation (default: false)
- `button.pulse_on_change` - Pulse on data change (default: false)

### Responsive Scaling with ViewBox

Buttons support responsive scaling for consistent appearance across different screen sizes:

```yaml
profiles:
  - id: responsive
    defaults:
      button:
        # Font sizes with viewbox scaling
        label_font_size:
          value: 18
          scale: "viewbox"
          unit: "px"
        value_font_size:
          value: 16
          scale: "viewbox"
          unit: "px"

        # Consistent padding that scales
        text_padding:
          value: 8
          scale: "viewbox"
          unit: "px"

overlays:
  - type: button
    id: responsive_button
    position: [50, 50]
    size: [150, 60]
    label: "SYSTEM"
    # Inherits all responsive scaling from profile
```

---

## DataSource Integration

### Basic DataSource Binding
```yaml
data_sources:
  reactor_status:
    type: entity
    entity: sensor.reactor_status

overlays:
  - id: reactor_button
    type: button
    position: [100, 50]
    size: [140, 60]
    source: reactor_status           # DataSource reference
    label: "REACTOR"
    content: "{reactor_status}"      # Template string with DataSource

    tap_action:
      action: toggle
      entity: switch.reactor_power
```

### Template Strings with Formatting
```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.reactor_temperature
    transformations:
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"

overlays:
  - id: temp_button
    type: button
    position: [100, 50]
    size: [140, 60]
    source: temperature
    label: "TEMP"
    content: "{temperature.transformations.celsius:.1f}°C"  # Formatted template

    # Dynamic actions based on data
    tap_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.reactor_cooling
        temperature: "{{ states('sensor.reactor_temperature') | float - 5 }}"
```

### Conditional Content
```yaml
overlays:
  - id: conditional_button
    type: button
    position: [100, 50]
    size: [140, 60]
    source: power_level
    label: "POWER"
    # Conditional content based on value
    content: "{power_level > 80 ? 'CRITICAL' : power_level > 50 ? 'HIGH' : 'NORMAL'}"

    # Conditional styling
    style:
      color: "{power_level > 80 ? 'var(--lcars-red)' : power_level > 50 ? 'var(--lcars-yellow)' : 'var(--lcars-green)'}"
```

---

## Interactive Actions

Button overlays provide comprehensive Home Assistant action support with immediate attachment for reliable interaction.

### Action Types

All standard Home Assistant actions are supported:

```yaml
overlays:
  - id: action_examples
    type: button
    position: [100, 50]
    size: [140, 60]
    label: "MULTI ACTION"

    # Primary action (tap/click)
    tap_action:
      action: toggle
      entity: switch.main_power

    # Secondary action (hold/long press)
    hold_action:
      action: more-info
      entity: switch.main_power

    # Tertiary action (double-tap)
    double_tap_action:
      action: call-service
      service: homeassistant.restart
      confirmation:
        text: "Are you sure you want to restart Home Assistant?"
```

### Supported Action Types

#### Toggle Actions
```yaml
tap_action:
  action: toggle
  entity: switch.warp_drive
```

#### Service Calls
```yaml
tap_action:
  action: call-service
  service: climate.set_temperature
  service_data:
    entity_id: climate.bridge
    temperature: 22
```

#### Navigation
```yaml
tap_action:
  action: navigate
  navigation_path: /lovelace/engineering
```

#### More Info Dialogs
```yaml
tap_action:
  action: more-info
  entity: sensor.reactor_status
```

#### URL Actions
```yaml
tap_action:
  action: url
  url_path: https://memory-alpha.fandom.com/wiki/Warp_drive
  new_tab: true
```

#### Custom Events
```yaml
tap_action:
  action: fire-dom-event
  event_type: button-pressed
  event_data:
    button_id: "{{ button.id }}"
    timestamp: "{{ now() }}"
```

### Action System Architecture

The button overlay uses an **immediate action attachment system**:

#### How Actions Work
1. **Immediate Attachment**: Actions are attached immediately after DOM insertion
2. **Full Element Coverage**: The entire button background and all text elements are interactive
3. **Bridge Pattern**: Uses custom-button-card's action system for full compatibility
4. **Template Support**: Actions support Home Assistant templates

#### Visual Feedback
- **Automatic cursor changes** to pointer when actions are present
- **Hover effects** (if enabled) provide visual feedback
- **Event coordination** prevents action conflicts

### Template Actions
Actions can use templates for dynamic behavior:

```yaml
overlays:
  - id: template_button
    type: button
    position: [100, 50]
    size: [140, 60]
    source: system_mode
    label: "MODE"
    content: "{system_mode}"

    tap_action:
      action: call-service
      service: input_select.select_option
      service_data:
        entity_id: input_select.system_mode
        # Template: cycle through modes
        option: >
          {% set modes = ['normal', 'alert', 'emergency'] %}
          {% set current = states('input_select.system_mode') %}
          {% set index = modes.index(current) %}
          {{ modes[(index + 1) % modes|length] }}
```

---

## Styling & Appearance

### Basic Styling
```yaml
style:
  # Background & borders
  color: "var(--lcars-blue)"       # Background color
  opacity: 0.9                    # Transparency
  border_radius: 12               # Corner radius
  border_color: "var(--lcars-gray)" # Border color
  border_width: 2                 # Border thickness

  # Text colors
  label_color: "var(--lcars-white)" # Label text color
  value_color: "var(--lcars-cyan)"  # Content text color
  font_size: 18                   # Global font size
  font_family: "monospace"        # Font family
  font_weight: "bold"             # Font weight
```

### Advanced Border Styling
```yaml
style:
  # Individual border sides
  border_top: 3
  border_right: 2
  border_bottom: 1
  border_left: 2

  # Individual corner radius
  border_radius_top_left: 0
  border_radius_top_right: 12
  border_radius_bottom_right: 12
  border_radius_bottom_left: 0
```

### Gradient Backgrounds
```yaml
style:
  gradient:
    type: "linear"
    direction: "vertical"
    stops:
      - { offset: "0%", color: "var(--lcars-blue)" }
      - { offset: "50%", color: "var(--lcars-cyan)" }
      - { offset: "100%", color: "var(--lcars-blue-dark)" }
```

### Visual Effects
```yaml
style:
  # Glow effect
  glow:
    color: "var(--lcars-blue)"
    blur: 4
    intensity: 0.8

  # Drop shadow
  shadow:
    offset_x: 2
    offset_y: 2
    blur: 4
    color: "rgba(0,0,0,0.5)"

  # Blur effect (for disabled states)
  blur:
    radius: 2
```

---

## Text Positioning & Layout

The Button overlay provides comprehensive text positioning capabilities to recreate CB-LCARS button card styles and create custom layouts.

### CB-LCARS Preset Styles

Recreate your CB-LCARS button card styles with preset configurations:

```yaml
style:
  # Lozenge style: label top-left, content bottom-right
  lcars_button_preset: "lozenge"

  # Bullet style: label left, content right (side by side)
  lcars_button_preset: "bullet"

  # Corner style: both text elements in corner, stacked
  lcars_button_preset: "corner"

  # Badge style: label top-center, content centered
  lcars_button_preset: "badge"
```

### Predefined Positions

Use predefined position names for consistent placement:

```yaml
style:
  # Standard positions
  label_position: "top-left"       # Label in top-left corner
  value_position: "bottom-right"   # Content in bottom-right corner

  # Available positions:
  # - center, center-top, center-bottom
  # - top-left, top-right, bottom-left, bottom-right
  # - left, right, top, bottom
  # - north-west, north-east, south-west, south-east
```

### Custom Position Objects

Define precise positioning with custom objects:

```yaml
style:
  label_position:
    x: "15%"                       # X position (percentage or pixels)
    y: "25%"                       # Y position (percentage or pixels)
    anchor: "start"                # SVG text-anchor
    baseline: "hanging"            # SVG dominant-baseline

  value_position:
    x: "85%"
    y: "75%"
    anchor: "end"
    baseline: "baseline"
```

### Layout Control

Control overall text arrangement within buttons:

```yaml
style:
  text_layout: "stacked"           # Default: label above, content below
  # text_layout: "side-by-side"    # Label left, content right
  # text_layout: "label-only"      # Only show labels
  # text_layout: "value-only"      # Only show content
  # text_layout: "custom"          # Use custom positioning

  text_alignment: "center"         # Vertical: top, center, bottom
  text_justify: "center"           # Horizontal: left, center, right
```

### Smart Padding System

The button overlay includes corner-aware padding that automatically adjusts for rounded corners:

```yaml
style:
  text_padding: 8                  # Base padding (auto-adjusted for corners)
  text_margin: 2                   # Space between label and content
  border_radius: 12                # Padding automatically increases for rounded corners
```

---

## Animation & Effects

### Hover Effects
```yaml
style:
  # Hover configuration
  hover_enabled: true              # Enable hover effects
  hover_color: "var(--lcars-yellow)" # Hover background color
  hover_scale: 1.1                 # Scale factor on hover
  hover_opacity: 0.8               # Hover opacity
```

### Animation Support
```yaml
style:
  # Animation configuration
  animatable: true                 # Enable anime.js targeting
  reveal_animation: true           # Initial reveal animation
  pulse_on_change: true            # Pulse when data changes

  # Animation data attributes are automatically added for anime.js
```

### Transition Effects
```yaml
style:
  # CSS transitions
  transition: "all 0.3s ease"      # CSS transition property

  # Transform effects
  transform: "rotate(45deg)"       # CSS transform
```

---

## LCARS Features

### LCARS Corners
```yaml
style:
  lcars_corners: true              # Enable LCARS-style cut corners
  lcars_corner_size: 8             # Corner cut size
```

### LCARS Brackets
```yaml
style:
  bracket_style: true              # Enable brackets around button
  bracket_color: "var(--lcars-orange)" # Bracket color
  bracket_width: 2                 # Bracket stroke width
  bracket_gap: 4                   # Distance from button
  bracket_extension: 12            # Bracket arm length
  bracket_opacity: 1               # Bracket transparency
  bracket_corners: "both"          # Which corners: both, top, bottom
  bracket_sides: "both"            # Which sides: both, left, right
```

### Status Indicators
```yaml
style:
  status_indicator: true           # Enable status indicator
  status_indicator_color: "var(--lcars-green)" # Indicator color
  status_indicator_size: 6         # Indicator size
  status_indicator_position: "top-right" # Indicator position
```

---

## Configuration Schema

### Button Overlay Schema
```yaml
overlays:
  - id: string                     # Required: Unique overlay identifier
    type: button                   # Required: Must be "button"
    position: [number, number]     # Required: [x, y] coordinates
    size: [number, number]         # Optional: [width, height] (default: [120, 40])

    # Content
    label: string                  # Optional: Button label text
    content: string                # Optional: Button content/value text
    source: string                 # Optional: DataSource reference

    # Interactive Actions
    tap_action: object             # Optional: Action on tap/click
    hold_action: object            # Optional: Action on hold/long press
    double_tap_action: object      # Optional: Action on double-tap

    style:                         # Optional: Styling configuration
      # Background & Borders
      color: string                # Background color (default: "var(--lcars-blue)")
      opacity: number              # Opacity (default: 1.0)
      border_radius: number        # Corner radius (default: 8)
      border_color: string         # Border color (default: "var(--lcars-gray)")
      border_width: number         # Border width (default: 2)

      # Individual border sides
      border_top: number           # Top border width
      border_right: number         # Right border width
      border_bottom: number        # Bottom border width
      border_left: number          # Left border width

      # Individual corner radius
      border_radius_top_left: number     # Top-left corner radius
      border_radius_top_right: number    # Top-right corner radius
      border_radius_bottom_right: number # Bottom-right corner radius
      border_radius_bottom_left: number  # Bottom-left corner radius

      # Text Styling
      show_labels: boolean         # Show label text (default: true)
      show_values: boolean         # Show content text (default: true)
      label_color: string          # Label color (default: "var(--lcars-white)")
      value_color: string          # Content color (default: "var(--lcars-white)")
      font_size: number            # Global font size (default: 16)
      font_family: string          # Font family (default: "var(--lcars-font-family, Antonio)")
      font_weight: string          # Font weight (default: "normal")

      # Enhanced Text Sizing
      label_font_size: number      # Label font size (default: font_size)
      value_font_size: number      # Content font size (default: font_size)

      # CB-LCARS Preset Styles
      lcars_button_preset: string  # Preset style: lozenge, bullet, corner, badge

      # Text Positioning
      label_position: string|object # Label position (default: "center-top")
      value_position: string|object # Content position (default: "center-bottom")
      text_layout: string          # Layout mode (default: "stacked")
      text_alignment: string       # Vertical alignment (default: "center")
      text_justify: string         # Horizontal justification (default: "center")

      # Spacing & Padding
      text_padding: number         # Padding from edges (default: 8)
      text_margin: number          # Margin between elements (default: 2)

      # Effects
      gradient: object             # Gradient definition
      glow: object                 # Glow effect
      shadow: object               # Shadow effect
      blur: object                 # Blur effect

      # LCARS Features
      lcars_corners: boolean       # LCARS corners (default: false)
      bracket_style: boolean       # LCARS brackets (default: false)
      bracket_color: string        # Bracket color
      bracket_width: number        # Bracket stroke width (default: 2)
      bracket_gap: number          # Distance from button (default: 4)
      bracket_extension: number    # Bracket arm length (default: 8)
      status_indicator: boolean|string # Status indicator

      # Interaction
      hover_enabled: boolean       # Enable hover effects (default: true)
      hover_color: string          # Hover color (default: "var(--lcars-yellow)")
      hover_scale: number          # Hover scale factor (default: 1.05)

      # Animation
      animatable: boolean          # Enable animations (default: true)
      reveal_animation: boolean    # Initial reveal (default: false)
      pulse_on_change: boolean     # Pulse on data change (default: false)
```

---

## Troubleshooting

### Common Issues

#### 1. Actions Not Working
**Symptoms**: Button doesn't respond to clicks
**Solutions**:
- Verify action syntax in YAML configuration
- Check browser console for action attachment logs
- Ensure card instance is available
- Test with simple toggle action first

```javascript
// Debug action attachment
const button = document.querySelector('[data-overlay-id="my_button"]');
console.log('Button action status:', {
  hasActions: button.getAttribute('data-has-actions'),
  actionsAttached: button.getAttribute('data-actions-attached'),
  pointerEvents: button.style.pointerEvents,
  cursor: button.style.cursor
});
```

#### 2. DataSource Not Updating
**Symptoms**: Button content doesn't change when data updates
**Solutions**:
- Verify DataSource configuration and status
- Check template string syntax
- Test DataSource access in console
- Ensure DataSource is started and has data

#### 3. Styling Issues
**Symptoms**: Button appearance doesn't match configuration
**Solutions**:
- Check CSS variable availability
- Verify color values and syntax
- Test with simple color values first
- Check for CSS conflicts

#### 4. Text Positioning Problems
**Symptoms**: Text appears in wrong position or is cut off
**Solutions**:
- Verify button size is adequate for text
- Check text_padding values for corner radius
- Test with predefined positions first
- Increase button dimensions if text is clipped

### Debug Commands

#### Basic Button Inspection
```javascript
// Get button overlays
const buttons = document.querySelectorAll('[data-overlay-type="button"]');
console.log('Found buttons:', buttons.length);

// Check specific button
const button = document.querySelector('[data-overlay-id="my_button"]');
console.log('Button details:', {
  size: [button.getAttribute('width'), button.getAttribute('height')],
  position: [button.getAttribute('x'), button.getAttribute('y')],
  hasActions: button.getAttribute('data-has-actions'),
  dataSource: button.getAttribute('data-source')
});
```

#### DataSource Testing
```javascript
// Test DataSource access
const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
const source = dsm.getSource('my_source');
console.log('DataSource data:', source.getCurrentData());
```

---

## Examples

### Example 1: Basic Control Button
```yaml
data_sources:
  warp_drive:
    type: entity
    entity: switch.warp_drive

overlays:
  - id: warp_button
    type: button
    position: [100, 50]
    size: [140, 60]
    source: warp_drive
    label: "WARP DRIVE"
    content: "{warp_drive}"

    tap_action:
      action: toggle
      entity: switch.warp_drive
    hold_action:
      action: more-info
      entity: switch.warp_drive

    style:
      color: "var(--lcars-blue)"
      lcars_corners: true
      bracket_style: true
      status_indicator: "var(--lcars-green)"
```

### Example 2: Temperature Control with Templates
```yaml
data_sources:
  bridge_temp:
    type: entity
    entity: climate.bridge_environmental

overlays:
  - id: temp_control
    type: button
    position: [100, 50]
    size: [160, 80]
    source: bridge_temp
    label: "BRIDGE TEMP"
    content: "{bridge_temp:.1f}°C"

    tap_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.bridge_environmental
        temperature: "{{ states('climate.bridge_environmental') | float + 1 }}"

    hold_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.bridge_environmental
        temperature: "{{ states('climate.bridge_environmental') | float - 1 }}"

    style:
      color: "var(--lcars-cyan)"
      lcars_button_preset: "lozenge"
      hover_enabled: true
      hover_color: "var(--lcars-yellow)"
```

### Example 3: Status Display with Conditional Styling
```yaml
data_sources:
  reactor_status:
    type: entity
    entity: sensor.reactor_status

overlays:
  - id: reactor_display
    type: button
    position: [100, 50]
    size: [180, 70]
    source: reactor_status
    label: "REACTOR STATUS"
    content: "{reactor_status}"

    tap_action:
      action: navigate
      navigation_path: /lovelace/engineering

    style:
      # Conditional color based on status
      color: "{reactor_status == 'online' ? 'var(--lcars-green)' : reactor_status == 'offline' ? 'var(--lcars-red)' : 'var(--lcars-yellow)'}"

      lcars_corners: true
      bracket_style: true
      bracket_color: "var(--lcars-orange)"

      # Enhanced text positioning
      lcars_button_preset: "corner"
      text_padding: 12

      # Visual effects
      glow:
        color: "var(--lcars-blue)"
        blur: 3
        intensity: 0.6
```

### Example 4: Navigation Button with Responsive Scaling
```yaml
profiles:
  - id: responsive_ui
    defaults:
      button:
        font_size:
          value: 18
          scale: "viewbox"
          unit: "px"
        text_padding:
          value: 10
          scale: "viewbox"
          unit: "px"

overlays:
  - id: nav_button
    type: button
    position: [50, 50]
    size: [200, 80]
    label: "MAIN ENGINEERING"
    content: "LEVEL 36"

    tap_action:
      action: navigate
      navigation_path: /lovelace/engineering
    hold_action:
      action: fire-dom-event
      event_type: deck-change
      event_data:
        deck: 36
        section: "engineering"

    style:
      color: "var(--lcars-blue)"
      gradient:
        type: "linear"
        direction: "vertical"
        stops:
          - { offset: "0%", color: "var(--lcars-blue)" }
          - { offset: "100%", color: "var(--lcars-blue-dark)" }

      lcars_corners: true
      bracket_style: true
      status_indicator: true

      # Uses responsive scaling from profile
```

### Example 5: Multi-Action System Button
```yaml
overlays:
  - id: system_control
    type: button
    position: [100, 50]
    size: [160, 80]
    label: "LIFE SUPPORT"
    content: "NOMINAL"

    # Primary: Toggle backup systems
    tap_action:
      action: toggle
      entity: switch.life_support_backup

    # Secondary: Show detailed info
    hold_action:
      action: more-info
      entity: sensor.life_support_status

    # Emergency: Activate emergency protocols
    double_tap_action:
      action: call-service
      service: script.emergency_life_support
      confirmation:
        text: "Activate emergency life support protocols?"

    style:
      color: "var(--lcars-green)"
      lcars_button_preset: "bullet"

      hover_enabled: true
      hover_color: "var(--lcars-yellow)"
      hover_scale: 1.05

      bracket_style: true
      bracket_color: "var(--lcars-cyan)"
      status_indicator: "var(--lcars-green)"

      shadow:
        offset_x: 2
        offset_y: 2
        blur: 4
        color: "rgba(0,0,0,0.3)"
```

### Example 6: Advanced Text Positioning
```yaml
overlays:
  - id: custom_layout_button
    type: button
    position: [100, 50]
    size: [200, 100]
    label: "CUSTOM LAYOUT"
    content: "DEMO"

    style:
      # Custom positioning with percentage coordinates
      label_position:
        x: "20%"
        y: "30%"
        anchor: "start"
        baseline: "hanging"

      value_position:
        x: "80%"
        y: "70%"
        anchor: "end"
        baseline: "baseline"

      # Different font sizes
      label_font_size: 14
      value_font_size: 20

      # Colors
      color: "var(--lcars-blue-dark)"
      label_color: "var(--lcars-cyan)"
      value_color: "var(--lcars-white)"

      border_radius: 20
      text_padding: 15
```

---

This completes the comprehensive Button overlay documentation covering all features, configuration options, DataSource integration, and interactive capabilities. The button overlay provides powerful single-element control interfaces with full CB-LCARS styling compatibility!
