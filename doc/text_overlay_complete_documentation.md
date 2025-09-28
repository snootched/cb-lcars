# Text Overlay - Complete Documentation & Schema

This document provides comprehensive documentation for the MSD Text overlay system, including configuration options, styling features, DataSource integration, and advanced text rendering capabilities.

---

## Table of Contents

1. [Overview](#overview)
2. [Basic Configuration](#basic-configuration)
3. [DataSource Integration](#datasource-integration)
4. [Styling & Typography](#styling--typography)
5. [Advanced Features](#advanced-features)
6. [Effects & Decorations](#effects--decorations)
7. [Configuration Schema](#configuration-schema)
8. [Troubleshooting](#troubleshooting)
9. [Examples](#examples)

---

## Overview

The MSD Text overlay provides sophisticated text rendering capabilities for dynamic, styled text display:

- **Dynamic content** from DataSource integration with template string interpolation
- **Rich typography** with comprehensive font styling and text layout options
- **Advanced effects** including gradients, patterns, glow, shadow, and blur
- **LCARS-themed decorations** with brackets, status indicators, and highlights
- **Multi-line support** with proper line spacing and text wrapping
- **Real-time updates** with automatic content refresh from DataSource changes

---

## Basic Configuration

### Minimal Text Overlay
```yaml
overlays:
  - id: simple_text
    type: text
    position: [100, 50]
    content: "Hello World"
```

### Interactive Text Overlay with Actions
```yaml
overlays:
  - id: interactive_text
    type: text
    position: [100, 50]
    content: "Temperature: 23°C"

    # Actions make text interactive
    tap_action:
      action: more-info
      entity: sensor.temperature
    hold_action:
      action: toggle
      entity: switch.fan
    double_tap_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.living_room
        temperature: 22
```

### Complete Basic Configuration
```yaml
overlays:
  - id: styled_text
    type: text
    position: [100, 50]              # [x, y] position
    content: "Temperature Status"    # Static text content

    style:
      # Core text properties
      color: "var(--lcars-orange)"   # Text color
      font_size: 16                  # Font size in pixels
      font_family: "monospace"       # Font family
      font_weight: "normal"          # normal, bold, lighter, bolder, 100-900
      font_style: "normal"           # normal, italic, oblique

      # Text alignment
      text_anchor: "start"           # start, middle, end
      dominant_baseline: "auto"      # auto, middle, hanging, central, etc.

      # Basic styling
      opacity: 1.0                   # Overall opacity (0-1)
      letter_spacing: "normal"       # Letter spacing
      word_spacing: "normal"         # Word spacing
```

---

## DataSource Integration

### Direct DataSource Content
Use DataSource values directly as text content (currently supported through `_raw` configuration fallback):

```yaml
overlays:
  # Direct DataSource value (Note: content from _raw.data_source)
  - id: temperature_value
    type: text
    position: [100, 50]
    data_source: temperature_sensor  # Referenced via _raw configuration
    style:
      value_format: "{value:.1f}°C"  # Format the value

  # Enhanced DataSource references (Note: content from _raw.data_source)
  - id: celsius_display
    type: text
    position: [100, 80]
    data_source: temperature_sensor.transformations.celsius
    style:
      value_format: "Temperature: {value:.1f}°C"

  # Aggregation data display (Note: content from _raw.data_source)
  - id: average_display
    type: text
    position: [100, 110]
    data_source: temperature_sensor.aggregations.avg_5m
    style:
      value_format: "5min Avg: {value:.1f}°C"
```

### Template String Interpolation
Use template strings to combine multiple DataSource values (current primary method):

```yaml
overlays:
  - id: multi_sensor_display
    type: text
    position: [100, 50]
    content: |
      Temperature: {temperature_sensor.transformations.celsius:.1f}°C
      Humidity: {humidity_sensor:.0f}%
      Trend: {temperature_sensor.aggregations.trend.direction}
      Last Update: {temperature_sensor.aggregations.session.count} readings
    style:
      color: "var(--lcars-white)"
      multiline: true
      line_height: 1.4
```

### Advanced DataSource Formatting
Support for complex formatting and nested object access:

```yaml
overlays:
  - id: complex_display
    type: text
    position: [100, 50]
    content: |
      Power: {power_meter.transformations.kilowatts:.2f} kW
      Rate: {power_meter.aggregations.rate:+.1f} W/min
      Status: {power_meter.aggregations.trend.direction}
      Daily Peak: {power_meter.aggregations.daily.max:.1f} kW
      Efficiency: {power_meter.transformations.percentage:.0f}%
    style:
      multiline: true
      value_format: "Custom formatting available"
```

### Formatting Specifications
Support for various number formatting patterns:

```yaml
style:
  value_format: "{value:.2f}"      # 2 decimal places
  value_format: "{value:.0%}"      # Percentage with no decimals
  value_format: "{value:d}"        # Integer formatting
  value_format: "Value: {value:.1f} units"  # Custom text with formatting
```

---

## Styling & Typography

### Font Properties
```yaml
style:
  # Font configuration
  font_family: "Orbitron, monospace"  # Font stack
  font_size: 18                       # Size in pixels
  font_weight: "bold"                 # Weight: normal, bold, 100-900
  font_style: "italic"                # Style: normal, italic, oblique

  # Advanced typography
  letter_spacing: "0.1em"             # Letter spacing
  word_spacing: "0.2em"               # Word spacing
  text_decoration: "underline"        # none, underline, overline, line-through
```

### Text Alignment & Positioning
```yaml
style:
  # Horizontal alignment
  text_anchor: "middle"               # start, middle, end

  # Vertical alignment
  dominant_baseline: "middle"         # auto, middle, hanging, central, mathematical
  alignment_baseline: "central"       # auto, baseline, before-edge, after-edge
```

### Colors & Fills
```yaml
style:
  # Solid colors
  color: "var(--lcars-blue)"          # CSS color value
  opacity: 0.8                        # Overall opacity

  # Gradient fills
  gradient:
    type: "linear"                    # linear or radial
    direction: "horizontal"           # horizontal, vertical, diagonal
    stops:
      - { offset: "0%", color: "var(--lcars-orange)" }
      - { offset: "100%", color: "var(--lcars-red)" }

  # Pattern fills
  pattern:
    type: "dots"                      # dots, lines, custom
    size: 4                           # Pattern size
    color: "var(--lcars-yellow)"      # Pattern color
```

### Text Stroke & Outline
```yaml
style:
  # Stroke properties
  stroke: "var(--lcars-blue)"         # Stroke color
  stroke_width: 1                     # Stroke width
  stroke_opacity: 0.8                 # Stroke opacity
  stroke_linecap: "round"             # round, square, butt
  stroke_linejoin: "round"            # round, miter, bevel
  stroke_dasharray: "4,2"             # Dash pattern
```

---

## Interactive Actions

Text overlays support full Home Assistant actions for creating interactive labels and controls, making your text elements clickable and functional.

### Simple Actions
```yaml
overlays:
  - type: text
    id: temperature_display
    position: [50, 100]
    text: "Living Room: 23°C"

    # Tap to show more info
    tap_action:
      action: more-info
      entity: sensor.living_room_temperature

    # Hold to toggle fan
    hold_action:
      action: toggle
      entity: switch.living_room_fan

    # Double-tap to adjust temperature
    double_tap_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.living_room
        temperature: 22
```

### Navigation and URL Actions
```yaml
overlays:
  - type: text
    id: room_label
    position: [50, 100]
    text: "Living Room"

    tap_action:
      action: navigate
      navigation_path: /lovelace/living-room

    hold_action:
      action: url
      url_path: https://home-assistant.io
      new_tab: true
```

### Data Source Integration with Actions

Combine dynamic data with interactive actions:

```yaml
overlays:
  - type: text
    id: climate_control
    position: [50, 100]
    data_source: sensor.thermostat_temperature
    style:
      value_format: "Current: {value}°C"

    # Action references same entity as data source
    tap_action:
      action: more-info
      entity: climate.thermostat

    hold_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.thermostat
        temperature: 21
```

### Template Actions
```yaml
overlays:
  - type: text
    id: dynamic_control
    position: [50, 100]
    content: "{sensor.living_room_temperature.value}°C"
    data_source: sensor.living_room_temperature

    tap_action:
      action: call-service
      service: climate.set_temperature
      service_data:
        entity_id: climate.living_room
        # Template: Set to current temp + 1
        temperature: "{{ states('sensor.living_room_temperature') | float + 1 }}"
```

### Action Types Reference

All standard Home Assistant action types are supported:

- **`toggle`** - Toggle entity state
- **`more-info`** - Show entity more-info dialog
- **`call-service`** - Call any Home Assistant service
- **`navigate`** - Navigate to dashboard path
- **`url`** - Open URL (internal or external)
- **`fire-dom-event`** - Fire custom DOM events

### Action Best Practices

#### Action Design
- **Use intuitive actions**: Tap for primary, hold for secondary
- **Provide visual feedback**: Actions automatically add pointer cursor
- **Test thoroughly**: Verify actions work with your entities

#### Performance
- **Minimize complex templates**: Keep action templates simple
- **Use entity references**: Prefer entity IDs over complex service calls
- **Test on mobile**: Ensure hold actions work well on touch devices

#### User Experience
- **Clear labeling**: Make it obvious what actions do
- **Consistent patterns**: Use similar actions across similar text elements
- **Fallback content**: Ensure text is useful even without actions

---

## Advanced Features

### Multi-line Text
```yaml
style:
  multiline: true                     # Enable multi-line support
  line_height: 1.4                    # Line height multiplier
  max_width: 300                      # Maximum width for wrapping
  text_wrapping: "word"               # none, word, char (future)
```

Example multi-line content:
```yaml
content: |
  System Status: Online
  Temperature: 22.5°C
  Humidity: 45%
  Last Update: 2 minutes ago
```

### Text Wrapping & Layout
```yaml
style:
  # Layout control
  max_width: 250                      # Maximum text width
  text_wrapping: "word"               # Wrap at word boundaries
  text_align: "center"                # Text alignment within width

  # Advanced layout (future)
  text_overflow: "ellipsis"           # Handle overflow
  white_space: "pre-wrap"             # Whitespace handling
```

---

## Effects & Decorations

### Visual Effects
```yaml
style:
  # Glow effect
  glow:
    color: "var(--lcars-yellow)"      # Glow color
    blur: 4                           # Glow radius
    intensity: 0.8                    # Glow intensity (0-1)

  # Drop shadow
  shadow:
    offset_x: 2                       # Horizontal offset
    offset_y: 2                       # Vertical offset
    blur: 3                           # Shadow blur radius
    color: "rgba(0,0,0,0.5)"          # Shadow color

  # Blur effect
  blur: 1.5                           # Blur radius
```

### LCARS-Style Decorations
```yaml
style:
  # LCARS brackets
  bracket_style: true                 # Enable bracket decoration
  bracket_color: "var(--lcars-orange)" # Custom bracket color

  # Status indicator
  status_indicator: "var(--lcars-green)" # Status dot color
  status_indicator_position: "left-center" # Positioning

  # Highlight background
  highlight: "var(--lcars-blue-light)" # Highlight color
  highlight_opacity: 0.3              # Highlight opacity
```

### Status Indicator Positions
```yaml
style:
  status_indicator_position: "left-center"   # Default
  # Available positions:
  # - top-left, top, top-right
  # - left-center, center, right-center
  # - bottom-left, bottom, bottom-right
```

---

## Configuration Schema

### Text Overlay Schema
```yaml
overlays:
  - id: string                        # Required: Unique overlay identifier
    type: text                        # Required: Must be "text"
    position: [number, number]        # Required: [x, y] coordinates

    # Content Sources (choose one)
    content: string                   # Static text content
    text: string                      # Alternative to content
    data_source: string               # DataSource reference for dynamic content

    # Interactive Actions (optional)
    tap_action: object                # Action on tap/click
    hold_action: object               # Action on hold/long press
    double_tap_action: object         # Action on double-tap

    style:                            # Optional: Styling configuration
      # Content & Value Processing
      value: string                   # Text content (alternative to content)
      value_format: string            # Formatting template for DataSource values
      format: string                  # Alternative to value_format

      # Core Typography
      color: string                   # Text color (default: "var(--lcars-orange)")
      font_size: number               # Font size in pixels (default: 16)
      font_family: string             # Font family (default: "inherit")
      font_weight: string|number      # Font weight (default: "normal")
      font_style: string              # Font style (default: "normal")

      # Text Layout
      text_anchor: string             # start|middle|end (default: "start")
      dominant_baseline: string       # Vertical alignment (default: "auto")
      alignment_baseline: string      # Alternative baseline (default: "auto")
      letter_spacing: string|number   # Letter spacing (default: "normal")
      word_spacing: string|number     # Word spacing (default: "normal")
      text_decoration: string         # Text decoration (default: "none")

      # Multi-line Support
      multiline: boolean              # Enable multi-line (default: false)
      line_height: number             # Line height multiplier (default: 1.2)
      max_width: number               # Maximum width (default: 0)
      text_wrapping: string           # Wrapping mode (default: "none")

      # Appearance
      opacity: number                 # Overall opacity (default: 1.0)
      visibility: string              # Visibility (default: "visible")

      # Advanced Fills
      gradient: object                # Gradient definition
      pattern: object|string          # Pattern definition

      # Stroke Properties
      stroke: string                  # Stroke color
      stroke_width: number            # Stroke width (default: 0)
      stroke_opacity: number          # Stroke opacity (default: 1.0)
      stroke_linecap: string          # Stroke line cap (default: "butt")
      stroke_linejoin: string         # Stroke line join (default: "miter")
      stroke_dasharray: string        # Stroke dash pattern
      stroke_dashoffset: number       # Stroke dash offset (default: 0)

      # Effects
      glow: object|string             # Glow effect definition
      shadow: object|string           # Shadow effect definition
      blur: number|object             # Blur effect definition

      # LCARS Decorations
      bracket_style: boolean|string   # Enable brackets (default: false)
      bracket_color: string           # Bracket color
      status_indicator: boolean|string # Status indicator (default: null)
      status_indicator_position: string # Status position (default: "left-center")
      highlight: boolean|string       # Highlight background (default: false)
      highlight_opacity: number       # Highlight opacity (default: 0.3)

      # Animation (Future)
      animatable: boolean             # Animation support (default: true)
      pulse_speed: number             # Pulse animation speed (default: 0)
      fade_speed: number              # Fade animation speed (default: 0)
      typewriter_speed: number        # Typewriter effect speed (default: 0)
```

### Effect Definitions
```yaml
# Gradient Definition
gradient:
  type: "linear"                      # linear|radial
  direction: string                   # horizontal|vertical|diagonal (linear)
  x1: string                          # Start x coordinate (linear)
  y1: string                          # Start y coordinate (linear)
  x2: string                          # End x coordinate (linear)
  y2: string                          # End y coordinate (linear)
  cx: string                          # Center x (radial)
  cy: string                          # Center y (radial)
  r: string                           # Radius (radial)
  stops:
    - offset: string                  # Stop position (0% to 100%)
      color: string                   # Stop color

# Glow Effect
glow:
  color: string                       # Glow color
  blur: number                        # Glow radius
  intensity: number                   # Glow intensity (0-1)

# Shadow Effect
shadow:
  offset_x: number                    # Horizontal offset
  offset_y: number                    # Vertical offset
  blur: number                        # Blur radius
  color: string                       # Shadow color

# Pattern Definition
pattern:
  type: string                        # dots|lines|custom
  width: number                       # Pattern width
  height: number                      # Pattern height
  content: string                     # SVG pattern content
```

---

## Troubleshooting

### Common Issues

#### 1. DataSource Template Not Working
**Symptoms**: Template strings showing as literal text
**Solutions**:
- Verify DataSource name and configuration
- Check template syntax: `{source_name.transformations.key:.1f}`
- Ensure DataSource is initialized and has data
- Test DataSource access in console
- **Note**: Content may need to be in `_raw.content` due to overlay processing pipeline

```javascript
// Debug DataSource template
const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
console.log('Source data:', dsm.getSource('temperature_sensor').getCurrentData());
```

#### 2. Formatting Not Applied
**Symptoms**: Numbers not formatted as expected
**Solutions**:
- Check format specification syntax: `{value:.2f}`
- Verify DataSource returns numeric values
- Test format specifications individually
- Check for template processing errors in console

#### 3. Multi-line Text Issues
**Symptoms**: Multi-line text not displaying correctly
**Solutions**:
- Enable `multiline: true` in style
- Use pipe notation `|` for multi-line content in YAML
- Adjust `line_height` for proper spacing
- Check for text overflow issues

#### 4. Effects Not Visible
**Symptoms**: Glow, shadow, or other effects not appearing
**Solutions**:
- Verify effect configuration syntax
- Check CSS variable availability
- Test with static colors first
- Ensure proper SVG filter support

#### 5. LCARS Decorations Positioning
**Symptoms**: Brackets or status indicators in wrong position
**Solutions**:
- Check text measurement and coordinate transformation
- Verify container and SVG scaling
- Test with different text anchor settings
- Debug with browser developer tools

#### 6. Actions Not Working
**Symptoms**: Text clicks/taps don't trigger actions
**Solutions**:
- Check console logs for action attachment messages
- Verify card instance is available for action processing
- Ensure proper YAML syntax in action definitions
- Test with simple actions first (like `toggle` or `more-info`)
- Confirm entities exist in Home Assistant

### Debug Commands

#### Basic Text Inspection
```javascript
// Get text overlays
const textOverlays = document.querySelectorAll('[data-overlay-type="text"]');
console.log('Found text overlays:', textOverlays.length);

// Check text features
textOverlays.forEach(el => {
  console.log(`Text ${el.getAttribute('data-overlay-id')}:`, {
    features: el.getAttribute('data-text-features'),
    width: el.getAttribute('data-text-width'),
    height: el.getAttribute('data-text-height'),
    fontFamily: el.getAttribute('data-font-family'),
    fontSize: el.getAttribute('data-font-size')
  });
});
```

#### DataSource Template Testing
```javascript
// Test template processing manually
const textRenderer = new window.TextOverlayRenderer?.();
if (textRenderer) {
  const testContent = "Temp: {temperature_sensor.transformations.celsius:.1f}°C";
  const processed = textRenderer._processEnhancedTemplateStrings(testContent);
  console.log('Template processing:', { original: testContent, processed });
}
```

#### Font and Measurement Testing
```javascript
// Test text measurement
const RendererUtils = window.RendererUtils;
if (RendererUtils) {
  const testText = "Sample Text";
  const font = "16px monospace";
  const measurement = RendererUtils.measureText(testText, font);
  console.log('Text measurement:', measurement);
}
```

---

## Examples

### Example 1: Simple Status Display
```yaml
data_sources:
  system_status:
    type: entity
    entity: sensor.system_temperature

overlays:
  - id: status_text
    type: text
    position: [50, 50]
    data_source: system_status
    style:
      color: "var(--lcars-green)"
      font_size: 18
      font_weight: "bold"
      value_format: "System: {value:.1f}°C"
      status_indicator: "var(--lcars-green)"
      bracket_style: true
```

### Example 2: Multi-Sensor Dashboard
```yaml
data_sources:
  temperature_enhanced:
    type: entity
    entity: sensor.temperature
    transformations:
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"
    aggregations:
      moving_average:
        window: "5m"
        key: "avg_5m"
      recent_trend:
        samples: 10
        key: "trend"

  humidity_sensor:
    type: entity
    entity: sensor.humidity

overlays:
  - id: environmental_display
    type: text
    position: [100, 100]
    content: |
      ENVIRONMENTAL STATUS

      Temperature: {temperature_enhanced.transformations.celsius:.1f}°C
      5min Average: {temperature_enhanced.aggregations.avg_5m:.1f}°C
      Trend: {temperature_enhanced.aggregations.trend.direction}

      Humidity: {humidity_sensor:.0f}%

      Last Update: {temperature_enhanced.aggregations.session.count} readings
    style:
      color: "var(--lcars-white)"
      font_family: "Orbitron, monospace"
      font_size: 14
      multiline: true
      line_height: 1.3
      bracket_style: true
      highlight: "var(--lcars-blue-dark)"
      highlight_opacity: 0.2
```

### Example 3: Styled Information Panel
```yaml
data_sources:
  power_meter:
    type: entity
    entity: sensor.house_power
    transformations:
      - type: unit_conversion
        factor: 0.001
        key: "kilowatts"
      - type: scale
        input_range: [0, 5000]
        output_range: [0, 100]
        key: "percentage"
    aggregations:
      rate_of_change:
        unit: "per_minute"
        key: "rate"
      session_stats:
        key: "session"

overlays:
  - id: power_panel_title
    type: text
    position: [50, 50]
    content: "POWER MONITORING"
    style:
      color: "var(--lcars-orange)"
      font_size: 20
      font_weight: "bold"
      text_anchor: "start"
      glow:
        color: "var(--lcars-orange)"
        blur: 3
        intensity: 0.6

  - id: power_panel_data
    type: text
    position: [50, 85]
    content: |
      Current Load: {power_meter.transformations.kilowatts:.2f} kW
      Utilization: {power_meter.transformations.percentage:.0f}%
      Rate of Change: {power_meter.aggregations.rate:+.0f} W/min
      Session Peak: {power_meter.aggregations.session.max:.1f} kW
      Total Readings: {power_meter.aggregations.session.count}
    style:
      color: "var(--lcars-blue)"
      font_family: "monospace"
      font_size: 12
      multiline: true
      line_height: 1.4
      status_indicator: "var(--lcars-green)"
      status_indicator_position: "left-center"

  - id: power_panel_gradient_text
    type: text
    position: [50, 200]
    content: "EFFICIENCY OPTIMAL"
    style:
      font_size: 16
      font_weight: "bold"
      gradient:
        type: "linear"
        direction: "horizontal"
        stops:
          - { offset: "0%", color: "var(--lcars-green)" }
          - { offset: "50%", color: "var(--lcars-yellow)" }
          - { offset: "100%", color: "var(--lcars-green)" }
      stroke: "var(--lcars-blue)"
      stroke_width: 1
      bracket_style: true
```

### Example 4: Advanced Effects Showcase
```yaml
data_sources:
  status_sensor:
    type: entity
    entity: sensor.system_status
    transformations:
      - type: expression
        expression: "value === 'online' ? 'OPERATIONAL' : 'OFFLINE'"
        key: "status_text"

overlays:
  # Glowing title
  - id: system_title
    type: text
    position: [100, 50]
    content: "SYSTEM DIAGNOSTICS"
    style:
      color: "var(--lcars-orange)"
      font_size: 24
      font_weight: "bold"
      text_anchor: "middle"
      glow:
        color: "var(--lcars-orange)"
        blur: 5
        intensity: 1.0
      shadow:
        offset_x: 2
        offset_y: 2
        blur: 4
        color: "rgba(0,0,0,0.7)"

  # Pattern text
  - id: pattern_text
    type: text
    position: [100, 100]
    data_source: status_sensor.transformations.status_text
    style:
      font_size: 18
      text_anchor: "middle"
      pattern:
        type: "dots"
        size: 3
        color: "var(--lcars-red)"
      stroke: "var(--lcars-blue)"
      stroke_width: 1

  # Multi-effect text
  - id: complex_text
    type: text
    position: [100, 150]
    content: "PRIORITY ALERT"
    style:
      color: "var(--lcars-red)"
      font_size: 16
      font_weight: "bold"
      text_anchor: "middle"
      text_decoration: "underline"
      glow:
        color: "var(--lcars-red)"
        blur: 4
        intensity: 0.8
      highlight: "var(--lcars-red)"
      highlight_opacity: 0.2
      bracket_style: true
      status_indicator: "var(--lcars-red)"
      status_indicator_position: "top"
```

### Example 5: Interactive Text with Multi-line Actions
```yaml
overlays:
  - type: text
    id: system_status_interactive
    position: [50, 100]
    multiline: true
    content: |
      System Status
      CPU: 45%
      Memory: 67%
      Uptime: 2d 14h

    tap_action:
      action: navigate
      navigation_path: /lovelace/system

    hold_action:
      action: call-service
      service: homeassistant.restart
      confirmation:
        text: "Are you sure you want to restart Home Assistant?"

    style:
      color: "var(--lcars-white)"
      font_family: "monospace"
      font_size: 12
      multiline: true
      line_height: 1.3
      bracket_style: true
      highlight: "var(--lcars-blue-dark)"
      highlight_opacity: 0.2
```

### Example 6: Real-time Data Formatting
```yaml
data_sources:
  sensor_array:
    type: entity
    entity: sensor.multi_sensor
    transformations:
      - type: expression
        expression: "Math.round(value * 100) / 100"
        key: "rounded"
    aggregations:
      session_stats:
        key: "session"

overlays:
  - id: formatted_data
    type: text
    position: [50, 50]
    content: |
      Sensor Reading: {sensor_array:.3f}
      Rounded Value: {sensor_array.transformations.rounded:.2f}
      As Percentage: {sensor_array:.1%}
      As Integer: {sensor_array:d}
      Session Min: {sensor_array.aggregations.session.min:.2f}
      Session Max: {sensor_array.aggregations.session.max:.2f}
      Reading Count: {sensor_array.aggregations.session.count}
    style:
      color: "var(--lcars-white)"
      font_family: "monospace"
      font_size: 12
      multiline: true
      line_height: 1.3
      value_format: "Custom format: {value:.2f} units"
```

### Additional Action Documentation

For complete action system documentation including troubleshooting, advanced examples, and integration with other overlay types, see the main [MSD Actions Documentation](./msd-actions.md).

---

This completes the comprehensive Text overlay documentation covering all features, DataSource integration, styling options, interactive actions, and practical examples. The system provides powerful text rendering capabilities with dynamic content support, rich visual styling options, and full Home Assistant action integration.