# Sparkline Overlay - Complete Documentation & Schema

This document provides comprehensive documentation for the MSD Sparkline overlay system, including configuration options, styling features, DataSource integration, and advanced visualization capabilities.

---

## Table of Contents

1. [Overview](#overview)
2. [Basic Configuration](#basic-configuration)
3. [DataSource Integration](#datasource-integration)
4. [Styling & Appearance](#styling--appearance)
5. [Advanced Features](#advanced-features)
6. [Performance Optimization](#performance-optimization)
7. [Configuration Schema](#configuration-schema)
8. [Troubleshooting](#troubleshooting)
9. [Examples](#examples)

---

## Overview

The MSD Sparkline overlay provides sophisticated data visualization capabilities for time-series data:

- **Real-time data rendering** from DataSource buffers with automatic updates
- **Enhanced DataSource support** with dot notation access to transformations and aggregations
- **Advanced path smoothing** with multiple algorithms (linear, bezier, spline, constrained)
- **Rich styling options** including gradients, patterns, effects, and LCARS-themed features
- **Performance optimized** with data decimation, viewport optimization, and efficient rendering
- **Multiple visualization modes** including area fills, data points, thresholds, and status indicators

---

## Basic Configuration

### Minimal Sparkline
```yaml
overlays:
  - id: temperature_sparkline
    type: sparkline
    source: temperature_sensor
    position: [100, 50]
    size: [200, 60]
```

### Complete Basic Configuration
```yaml
overlays:
  - id: detailed_sparkline
    type: sparkline
    source: power_meter               # DataSource name
    position: [100, 50]               # [x, y] position
    size: [300, 80]                   # [width, height] dimensions

    style:
      # Core appearance
      color: "var(--lcars-blue)"      # Primary line color
      width: 2                        # Line stroke width
      opacity: 1.0                    # Overall opacity (0-1)

      # Basic line styling
      line_cap: "round"               # round, square, butt
      line_join: "round"              # round, miter, bevel
      dash_array: null                # Dash pattern (e.g., "4,2")

      # Path generation
      smoothing_mode: "none"          # none, constrained, chaikin, bezier, spline, stepped
      interpolation: "linear"         # linear (future: cubic, cardinal)
```

---

## DataSource Integration

### Enhanced DataSource References
The Sparkline overlay supports advanced DataSource references with dot notation access:

```yaml
overlays:
  # Raw DataSource data
  - id: raw_temperature
    type: sparkline
    source: temperature_enhanced      # Uses raw buffer data

  # Transformation data
  - id: celsius_temperature
    type: sparkline
    source: temperature_enhanced.transformations.celsius

  # Aggregation data
  - id: smoothed_temperature
    type: sparkline
    source: temperature_enhanced.transformations.smoothed

  # Complex aggregation access
  - id: temperature_trend
    type: sparkline
    source: temperature_enhanced.aggregations.trend.slope

  # Moving average visualization
  - id: power_average
    type: sparkline
    source: power_meter.aggregations.avg_5m
```

### DataSource Status Handling
Sparklines automatically handle various DataSource states:

- **Loading states**: Animated indicators during initialization
- **No data**: Clear status messages with source identification
- **Insufficient data**: Informative warnings for single data points
- **Error states**: Fallback rendering with error details
- **Real-time updates**: Automatic re-rendering when data changes

---

## Styling & Appearance

### Line Styling
```yaml
style:
  # Basic line properties
  color: "var(--lcars-yellow)"       # CSS color value
  width: 3                           # Stroke width in pixels
  opacity: 0.8                       # Line opacity (0-1)

  # Advanced stroke styling
  line_cap: "round"                  # round, square, butt
  line_join: "round"                 # round, miter, bevel
  miter_limit: 4                     # Miter join limit

  # Dash patterns
  dash_array: "8,4"                  # Dash pattern (length,gap)
  dash_offset: 0                     # Dash pattern offset
```

### Gradients and Patterns
```yaml
style:
  # Linear gradients
  gradient:
    type: "linear"
    direction: "horizontal"          # horizontal, vertical, diagonal
    stops:
      - { offset: 0, color: "var(--lcars-blue)" }
      - { offset: 1, color: "var(--lcars-green)" }

  # Radial gradients
  gradient:
    type: "radial"
    center: [0.5, 0.5]              # Center point (0-1)
    radius: 0.7                     # Radius (0-1)
    stops:
      - { offset: 0, color: "#ff0000" }
      - { offset: 1, color: "#0000ff" }

  # Pattern fills
  pattern:
    type: "dots"                    # dots, lines, grid
    size: 4                         # Pattern size
    color: "var(--lcars-orange)"    # Pattern color
    spacing: 8                      # Pattern spacing
```

### Area Fills
```yaml
style:
  # Solid area fill
  fill: "var(--lcars-blue)"          # Area fill color
  fill_opacity: 0.3                  # Area opacity (0-1)

  # Gradient area fill
  fill_gradient:
    type: "linear"
    direction: "vertical"
    stops:
      - { offset: 0, color: "rgba(255,255,0,0.8)" }
      - { offset: 1, color: "rgba(255,255,0,0.1)" }
```

### Effects
```yaml
style:
  # Glow effect
  glow:
    color: "var(--lcars-yellow)"     # Glow color
    radius: 4                       # Glow radius
    intensity: 0.8                  # Glow intensity (0-1)

  # Drop shadow
  shadow:
    offset_x: 2                     # Horizontal offset
    offset_y: 2                     # Vertical offset
    blur: 4                         # Blur radius
    color: "rgba(0,0,0,0.5)"        # Shadow color

  # Blur effect
  blur:
    radius: 1                       # Blur radius
```

---

## Advanced Features

### Path Smoothing Algorithms
```yaml
style:
  # No smoothing (default)
  smoothing_mode: "none"

  # Constrained smoothing (recommended)
  smoothing_mode: "constrained"     # Smooth curves through all data points

  # Chaikin subdivision
  smoothing_mode: "chaikin"         # Iterative corner cutting

  # Bezier curves
  smoothing_mode: "bezier"          # Quadratic bezier curves

  # Catmull-Rom splines
  smoothing_mode: "spline"          # Smooth spline interpolation

  # Stepped visualization
  smoothing_mode: "stepped"         # Step-wise transitions
```

### Data Visualization Features
```yaml
style:
  # Data point markers
  show_points: true                 # Show individual data points
  point_size: 3                     # Point radius
  point_color: "var(--lcars-red)"   # Point color (defaults to line color)

  # Value labels
  show_last_value: true             # Show latest value as text
  value_format: "{value:.1f}°C"     # Value formatting string

  # Threshold lines
  thresholds:
    - value: 25                     # Threshold value
      color: "var(--lcars-orange)"  # Line color
      width: 1                      # Line width
      opacity: 0.7                  # Line opacity
      dash: true                    # Dashed line
      label: "Warning"              # Optional label
    - value: 35
      color: "var(--lcars-red)"
      width: 2
      label: "Critical"

  # Zero reference line
  zero_line: true                   # Show zero baseline
  zero_line_color: "var(--lcars-gray)" # Zero line color
```

### LCARS-Themed Features
```yaml
style:
  # LCARS-style brackets
  bracket_style: true               # Enable bracket borders
  bracket_width: 2                  # Bracket stroke width
  bracket_color: "var(--lcars-yellow)" # Bracket color (defaults to line color)
  bracket_gap: 6                    # Distance from sparkline
  bracket_corner_radius: 0          # Corner radius for rounded brackets
  bracket_style_mode: "square"      # square, rounded, lcars

  # Status indicator
  status_indicator: true            # Show status dot
  # OR
  status_indicator: "var(--lcars-green)" # Custom status color

  # Grid lines
  grid_lines: true                  # Show technical grid
  grid_color: "var(--lcars-gray)"   # Grid color
  grid_opacity: 0.4                 # Grid opacity
  grid_stroke_width: 1              # Grid line width
  grid_horizontal_count: 3          # Number of horizontal lines
  grid_vertical_count: 5            # Number of vertical lines

  # Scan line animation
  scan_line: true                   # Animated scan line
```

### Value Range Control
```yaml
style:
  # Automatic scaling (default)
  auto_scale: true                  # Auto-fit data to sparkline height

  # Manual range control
  min_value: 0                      # Force minimum value
  max_value: 100                    # Force maximum value
  auto_scale: false                 # Disable auto-scaling
```

---

## Performance Optimization

### Data Processing
```yaml
style:
  # Data decimation
  decimation: 100                   # Reduce to N points for performance
  max_points: 500                   # Maximum points to render

  # Path precision
  path_precision: 2                 # Decimal places for SVG paths
```

### Rendering Optimization
```yaml
style:
  # Feature control
  animatable: true                  # Enable animation support
  tracer_speed: 0                   # Tracer animation speed (0=disabled)
  pulse_speed: 0                    # Pulse animation speed (0=disabled)
```

---

## Configuration Schema

### Sparkline Overlay Schema
```yaml
overlays:
  - id: string                      # Required: Unique overlay identifier
    type: sparkline                 # Required: Must be "sparkline"
    source: string                  # Required: DataSource reference
    position: [number, number]      # Required: [x, y] coordinates
    size: [number, number]          # Optional: [width, height] (default: [200, 60])

    style:                          # Optional: Styling configuration
      # Core Properties
      color: string                 # Line color (default: "var(--lcars-yellow)")
      width: number                 # Line width (default: 2)
      opacity: number               # Opacity 0-1 (default: 1.0)

      # Line Styling
      line_cap: string              # round|square|butt (default: "round")
      line_join: string             # round|miter|bevel (default: "round")
      miter_limit: number           # Miter limit (default: 4)
      dash_array: string            # Dash pattern (default: null)
      dash_offset: number           # Dash offset (default: 0)

      # Path Generation
      smoothing_mode: string        # none|constrained|chaikin|bezier|spline|stepped
      interpolation: string         # linear (future: cubic|cardinal)
      path_precision: number        # SVG path precision (default: 2)

      # Area Fill
      fill: string                  # Fill color (default: "none")
      fill_opacity: number          # Fill opacity (default: 0.2)
      fill_gradient: object         # Gradient definition

      # Advanced Styling
      gradient: object              # Line gradient definition
      pattern: object               # Pattern definition

      # Data Visualization
      show_points: boolean          # Show data points (default: false)
      point_size: number            # Point radius (default: 3)
      point_color: string           # Point color
      show_last_value: boolean      # Show value label (default: false)
      value_format: string          # Value format string

      # Reference Lines
      thresholds: array             # Threshold line definitions
      zero_line: boolean            # Show zero line (default: false)
      zero_line_color: string       # Zero line color

      # Range Control
      min_value: number             # Force minimum value
      max_value: number             # Force maximum value
      auto_scale: boolean           # Auto-scale data (default: true)

      # Effects
      glow: object                  # Glow effect definition
      shadow: object                # Shadow effect definition
      blur: object                  # Blur effect definition

      # LCARS Features
      bracket_style: boolean        # Enable brackets (default: false)
      bracket_width: number         # Bracket width (default: 2)
      bracket_color: string         # Bracket color
      bracket_gap: number           # Bracket distance (default: 6)
      bracket_corner_radius: number # Corner radius (default: 0)
      bracket_style_mode: string    # square|rounded|lcars (default: "square")

      status_indicator: boolean|string # Status indicator
      scan_line: boolean            # Scan line animation (default: false)

      grid_lines: boolean           # Grid lines (default: false)
      grid_color: string            # Grid color
      grid_opacity: number          # Grid opacity (default: 0.4)
      grid_stroke_width: number     # Grid width (default: 1)
      grid_horizontal_count: number # Horizontal lines (default: 3)
      grid_vertical_count: number   # Vertical lines (default: 5)

      # Performance
      decimation: number            # Data decimation (default: 0)
      max_points: number            # Max points (default: 1000)
      animatable: boolean           # Animation support (default: true)
      tracer_speed: number          # Tracer speed (default: 0)
      pulse_speed: number           # Pulse speed (default: 0)
```

### Effect Definitions
```yaml
# Gradient Definition
gradient:
  type: "linear"                    # linear|radial
  direction: string                 # horizontal|vertical|diagonal (linear only)
  center: [number, number]          # Center point (radial only)
  radius: number                    # Radius (radial only)
  stops:
    - offset: number                # Stop position (0-1)
      color: string                 # Stop color

# Glow Effect
glow:
  color: string                     # Glow color
  radius: number                    # Glow radius
  intensity: number                 # Glow intensity (0-1)

# Shadow Effect
shadow:
  offset_x: number                  # Horizontal offset
  offset_y: number                  # Vertical offset
  blur: number                      # Blur radius
  color: string                     # Shadow color

# Threshold Definition
thresholds:
  - value: number                   # Threshold value
    color: string                   # Line color
    width: number                   # Line width
    opacity: number                 # Line opacity
    dash: boolean                   # Dashed line
    label: string                   # Optional label
```

---

## Troubleshooting

### Common Issues

#### 1. No Data Displayed
**Symptoms**: Empty or status indicator sparkline
**Solutions**:
- Verify DataSource name and configuration
- Check DataSource buffer has sufficient data (need 2+ points)
- Ensure DataSource is started and receiving updates
- Test DataSource access in console

```javascript
// Debug DataSource
const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
console.log('Available sources:', Array.from(dsm.sources.keys()));
console.log('Source data:', dsm.getSource('your_source').getCurrentData());
```

#### 2. Enhanced Data References Not Working
**Symptoms**: "ENHANCED_DATA_NOT_FOUND" status
**Solutions**:
- Verify dot notation syntax: `source.transformations.key`
- Check transformation/aggregation key names
- Ensure DataSource has the requested transformation/aggregation
- Verify key spelling and case sensitivity

```javascript
// Check available enhanced data
const currentData = dsm.getSource('temperature_enhanced').getCurrentData();
console.log('Transformations:', Object.keys(currentData.transformations || {}));
console.log('Aggregations:', Object.keys(currentData.aggregations || {}));
```

#### 3. Styling Not Applied
**Symptoms**: Default styling instead of configured appearance
**Solutions**:
- Check CSS variable availability
- Verify color format and values
- Test with static colors first
- Check browser console for CSS errors

#### 4. Performance Issues
**Symptoms**: Slow rendering, browser lag
**Solutions**:
- Enable data decimation: `decimation: 100`
- Limit max points: `max_points: 500`
- Reduce smoothing complexity
- Disable expensive effects temporarily

#### 5. Smoothing Issues
**Symptoms**: Jagged lines, unexpected curves
**Solutions**:
- Try different smoothing modes
- Adjust path precision
- Check data point density
- Use `constrained` mode for reliable results

### Debug Commands

#### Basic Sparkline Inspection
```javascript
// Get sparkline elements
const sparklines = document.querySelectorAll('[data-overlay-type="sparkline"]');
console.log('Found sparklines:', sparklines.length);

// Check sparkline status
sparklines.forEach(el => {
  console.log(`Sparkline ${el.getAttribute('data-overlay-id')}:`, {
    source: el.getAttribute('data-source'),
    status: el.getAttribute('data-status'),
    features: el.getAttribute('data-sparkline-features'),
    lastUpdate: el.getAttribute('data-last-update')
  });
});
```

#### DataSource Integration Testing
```javascript
// Test enhanced data access
const result = window.SparklineRenderer.getHistoricalDataForSparkline('temp.transformations.celsius');
console.log('Enhanced data result:', result);

// Parse data source reference
const parsed = window.SparklineRenderer.parseDataSourceReference('power.aggregations.avg_5m');
console.log('Parsed reference:', parsed);
```

#### Performance Analysis
```javascript
// Check sparkline rendering performance
const sparklineEl = document.querySelector('[data-overlay-id="my_sparkline"]');
const observer = new PerformanceObserver(list => {
  list.getEntries().forEach(entry => {
    if (entry.name.includes('sparkline')) {
      console.log('Sparkline performance:', entry);
    }
  });
});
observer.observe({ entryTypes: ['measure'] });
```

---

## Examples

### Example 1: Basic Temperature Sparkline
```yaml
data_sources:
  temperature_sensor:
    type: entity
    entity: sensor.outdoor_temperature
    transformations:
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"

overlays:
  - id: temperature_sparkline
    type: sparkline
    source: temperature_sensor.transformations.smoothed
    position: [50, 100]
    size: [250, 70]
    style:
      color: "var(--lcars-blue)"
      width: 3
      smoothing_mode: "constrained"
      show_last_value: true
      value_format: "{value:.1f}°C"
      bracket_style: true
```

### Example 2: Power Monitoring with Thresholds
```yaml
data_sources:
  power_meter:
    type: entity
    entity: sensor.house_power
    transformations:
      - type: unit_conversion
        factor: 0.001
        key: "kilowatts"
    aggregations:
      moving_average:
        window: "5m"
        key: "avg_5m"

overlays:
  - id: power_sparkline
    type: sparkline
    source: power_meter.aggregations.avg_5m
    position: [100, 200]
    size: [300, 80]
    style:
      color: "var(--lcars-yellow)"
      width: 2
      smoothing_mode: "constrained"

      # Area fill
      fill: "var(--lcars-yellow)"
      fill_opacity: 0.2

      # Threshold lines
      thresholds:
        - value: 2.5
          color: "var(--lcars-orange)"
          dash: true
          label: "High Usage"
        - value: 4.0
          color: "var(--lcars-red)"
          width: 2
          label: "Critical"

      # LCARS styling
      bracket_style: true
      grid_lines: true
      status_indicator: true
      show_last_value: true
      value_format: "{value:.2f} kW"
```

### Example 3: Advanced Multi-Sensor Dashboard
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
      - type: smooth
        method: "exponential"
        alpha: 0.2
        key: "smoothed"
    aggregations:
      recent_trend:
        samples: 10
        key: "trend"
      moving_average:
        window: "30m"
        key: "avg_30m"

  humidity_sensor:
    type: entity
    entity: sensor.humidity
    transformations:
      - type: smooth
        method: "moving_average"
        window_size: 5
        key: "smoothed"

overlays:
  # Temperature sparkline with gradient
  - id: temp_sparkline
    type: sparkline
    source: temperature_enhanced.transformations.smoothed
    position: [50, 50]
    size: [280, 60]
    style:
      gradient:
        type: "linear"
        direction: "horizontal"
        stops:
          - { offset: 0, color: "var(--lcars-blue)" }
          - { offset: 0.5, color: "var(--lcars-yellow)" }
          - { offset: 1, color: "var(--lcars-red)" }
      width: 3
      smoothing_mode: "constrained"
      glow:
        color: "var(--lcars-blue)"
        radius: 3
        intensity: 0.6
      bracket_style: true
      bracket_style_mode: "lcars"
      show_last_value: true

  # Humidity sparkline with area fill
  - id: humidity_sparkline
    type: sparkline
    source: humidity_sensor.transformations.smoothed
    position: [50, 150]
    size: [280, 60]
    style:
      color: "var(--lcars-green)"
      width: 2
      smoothing_mode: "bezier"
      fill_gradient:
        type: "linear"
        direction: "vertical"
        stops:
          - { offset: 0, color: "rgba(0,255,0,0.4)" }
          - { offset: 1, color: "rgba(0,255,0,0.1)" }
      thresholds:
        - value: 60
          color: "var(--lcars-orange)"
          dash: true
      bracket_style: true
      grid_lines: true

  # Trend visualization
  - id: trend_sparkline
    type: sparkline
    source: temperature_enhanced.aggregations.trend.slope
    position: [50, 250]
    size: [280, 40]
    style:
      color: "var(--lcars-purple)"
      width: 1
      smoothing_mode: "stepped"
      zero_line: true
      zero_line_color: "var(--lcars-gray)"
      show_points: true
      point_size: 2
      bracket_style: true
      scan_line: true
```

### Example 4: Performance-Optimized High-Frequency Data
```yaml
data_sources:
  high_freq_sensor:
    type: entity
    entity: sensor.fast_updating_sensor
    minEmitMs: 50               # High frequency updates
    transformations:
      - type: smooth
        method: "median"
        window_size: 3
        key: "filtered"

overlays:
  - id: optimized_sparkline
    type: sparkline
    source: high_freq_sensor.transformations.filtered
    position: [100, 100]
    size: [400, 100]
    style:
      color: "var(--lcars-cyan)"
      width: 1
      smoothing_mode: "constrained"

      # Performance optimizations
      decimation: 200             # Reduce to 200 points max
      max_points: 500             # Hard limit
      path_precision: 1           # Reduce SVG precision

      # Minimal styling for performance
      animatable: false           # Disable animations
      show_points: false          # No data points
      glow: null                  # No effects

      # Simple bracket styling
      bracket_style: true
      bracket_width: 1
      status_indicator: "var(--lcars-green)"
```

---

This completes the comprehensive Sparkline overlay documentation covering all features, configuration options, DataSource integration, and practical examples. The system provides powerful data visualization capabilities while maintaining performance and ease of configuration.