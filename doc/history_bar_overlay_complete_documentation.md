# History Bar Overlay - Complete Documentation & Schema

This document provides comprehensive documentation for the MSD History Bar overlay system, including configuration options, styling features, DataSource integration, and temporal data visualization capabilities.

---

## Table of Contents

1. [Overview](#overview)
2. [Basic Configuration](#basic-configuration)
3. [DataSource Integration](#datasource-integration)
4. [Styling & Appearance](#styling--appearance)
5. [Time Windows & Aggregation](#time-windows--aggregation)
6. [Color Coding & Thresholds](#color-coding--thresholds)
7. [Effects & Decorations](#effects--decorations)
8. [Configuration Schema](#configuration-schema)
9. [Troubleshooting](#troubleshooting)
10. [Examples](#examples)

---

## Overview

The MSD History Bar overlay provides sophisticated temporal data visualization capabilities for historical DataSource data:

- **Time-series bar charts** with horizontal and vertical orientations
- **Flexible time windows** from hours to months with auto-bucketing
- **Value-based color coding** with configurable ranges and thresholds
- **Multiple aggregation modes** including average, sum, min, max, and count
- **LCARS-themed styling** with brackets, status indicators, and grid lines
- **Real-time updates** with automatic data refresh and smart upgrades
- **Performance optimized** with data bucketing and efficient rendering

---

## Basic Configuration

### Minimal History Bar
```yaml
overlays:
  - id: temperature_history
    type: history_bar
    source: temperature_sensor
    position: [100, 50]
    size: [400, 80]
```

### Complete Basic Configuration
```yaml
overlays:
  - id: detailed_history_bar
    type: history_bar
    source: power_meter
    position: [100, 50]            # [x, y] position
    size: [400, 80]                # [width, height] dimensions

    style:
      # Core properties
      orientation: "horizontal"     # horizontal, vertical
      time_window: "24h"           # Time window to display
      bucket_size: "1h"            # Data aggregation buckets

      # Bar appearance
      bar_color: "var(--lcars-blue)"  # Default bar color
      bar_opacity: 1.0             # Bar opacity (0-1)
      bar_gap: 1                   # Gap between bars (pixels)
      bar_radius: 0                # Corner radius for bars

      # Aggregation
      aggregation_mode: "average"  # average, sum, max, min, count
      max_bars: 100                # Maximum bars to render

      # Axis and labels
      show_axis: true              # Show axis lines
      show_labels: true            # Show time labels
      show_values: false           # Show value labels on bars
      axis_color: "var(--lcars-gray)"
      label_color: "var(--lcars-white)"
      label_font_size: 10
```

---

## DataSource Integration

### Enhanced DataSource References
History bars support the same enhanced DataSource access as other overlays:

```yaml
overlays:
  # Raw DataSource data
  - id: raw_temperature_history
    type: history_bar
    source: temperature_enhanced     # Uses raw buffer data

  # Transformation data
  - id: celsius_temperature_history
    type: history_bar
    source: temperature_enhanced.transformations.celsius

  # Aggregation data (will create synthetic history)
  - id: smoothed_temperature_history
    type: history_bar
    source: temperature_enhanced.transformations.smoothed

  # Moving average visualization
  - id: power_average_history
    type: history_bar
    source: power_meter.aggregations.avg_5m
```

### Real-time Data Updates
History bars automatically update when DataSource data changes:

- **Smart upgrades**: Status indicators upgrade to full history bars when data arrives
- **Incremental updates**: New data points are added to existing bars
- **Buffer synchronization**: Utilizes DataSource buffer for historical data
- **Synthetic data generation**: Creates meaningful history for enhanced DataSource values

---

## Styling & Appearance

### Orientation & Layout
```yaml
style:
  # Bar orientation
  orientation: "horizontal"        # horizontal (default), vertical

  # Bar spacing and sizing
  bar_gap: 2                      # Gap between bars in pixels
  bar_radius: 3                   # Corner radius for rounded bars
  max_bars: 50                    # Limit bars for performance
```

### Basic Styling
```yaml
style:
  # Core appearance
  bar_color: "var(--lcars-blue)"   # Default bar color
  bar_opacity: 0.8                # Bar transparency

  # Grid and axis
  show_grid: true                 # Show background grid
  grid_color: "var(--lcars-gray)" # Grid line color
  grid_opacity: 0.3               # Grid transparency

  show_axis: true                 # Show axis lines
  axis_color: "var(--lcars-gray)" # Axis color
```

### Advanced Effects
```yaml
style:
  # Visual effects
  glow:
    color: "var(--lcars-blue)"     # Glow color
    blur: 3                        # Glow radius
    intensity: 0.8                 # Glow intensity

  shadow:
    offset_x: 2                    # Shadow horizontal offset
    offset_y: 2                    # Shadow vertical offset
    blur: 4                        # Shadow blur radius
    color: "rgba(0,0,0,0.5)"       # Shadow color

  # Gradients
  gradient:
    type: "linear"
    direction: "vertical"
    stops:
      - { offset: "0%", color: "var(--lcars-blue)" }
      - { offset: "100%", color: "var(--lcars-cyan)" }
```

---

## Time Windows & Aggregation

### Time Window Configuration
```yaml
style:
  time_window: "24h"              # Display window
  bucket_size: "1h"               # Aggregation bucket size

  # Supported time formats:
  # - "1h", "6h", "12h", "24h"   (hours)
  # - "1d", "7d", "30d"          (days)
  # - "auto"                     (automatic based on data)
```

### Aggregation Modes
```yaml
style:
  aggregation_mode: "average"     # How to aggregate data within buckets

  # Available modes:
  # - "average": Mean value (default)
  # - "sum": Total value
  # - "max": Maximum value
  # - "min": Minimum value
  # - "count": Number of data points
```

### Bucket Size Options
```yaml
style:
  bucket_size: "auto"             # Auto-determine optimal bucket size
  bucket_size: "30m"              # 30-minute buckets
  bucket_size: "1h"               # 1-hour buckets
  bucket_size: "4h"               # 4-hour buckets
  bucket_size: "1d"               # Daily buckets
```

---

## Color Coding & Thresholds

### Value-Based Color Ranges
```yaml
style:
  color_ranges:
    - { min: 0, max: 20, color: "var(--lcars-blue)", label: "Low" }
    - { min: 20, max: 40, color: "var(--lcars-green)", label: "Normal" }
    - { min: 40, max: 60, color: "var(--lcars-yellow)", label: "High" }
    - { min: 60, max: 100, color: "var(--lcars-red)", label: "Critical" }
```

### Threshold Reference Lines
```yaml
style:
  thresholds:
    - value: 25                   # Threshold value
      color: "var(--lcars-orange)" # Line color
      width: 2                    # Line width
      opacity: 0.7               # Line opacity
      dash: true                  # Dashed line
      label: "Warning Level"      # Optional label

    - value: 50
      color: "var(--lcars-red)"
      width: 3
      label: "Critical Level"

  zero_line: true                 # Show zero reference line
```

### Dynamic Color Calculation
History bars automatically choose colors based on:
1. **Color ranges** (if configured) - primary method
2. **Default bar color** - fallback
3. **Threshold proximity** - visual hints for approaching thresholds

---

## Effects & Decorations

### LCARS-Style Features
```yaml
style:
  # LCARS brackets
  bracket_style: true             # Enable bracket decoration
  bracket_color: "var(--lcars-orange)" # Custom bracket color

  # Status indicator
  status_indicator: "var(--lcars-green)" # Status dot color

  # Grid lines
  show_grid: true                 # Technical grid overlay
  grid_color: "var(--lcars-gray)" # Grid color
  grid_opacity: 0.4               # Grid transparency
```

### Labels & Values
```yaml
style:
  # Time labels
  show_labels: true               # Show time labels on axis
  label_color: "var(--lcars-white)" # Label color
  label_font_size: 10             # Label font size

  # Value labels
  show_values: true               # Show values on bars
  value_format: "{value:.1f}"     # Value formatting
```

### Hover Interactions
```yaml
style:
  hover_enabled: true             # Enable hover effects
  hover_color: "var(--lcars-yellow)" # Hover highlight color
```

---

## Configuration Schema

### History Bar Overlay Schema
```yaml
overlays:
  - id: string                    # Required: Unique overlay identifier
    type: history_bar             # Required: Must be "history_bar"
    source: string                # Required: DataSource reference
    position: [number, number]    # Required: [x, y] coordinates
    size: [number, number]        # Optional: [width, height] (default: [300, 80])

    style:                        # Optional: Styling configuration
      # Core Properties
      orientation: string         # horizontal|vertical (default: "horizontal")
      time_window: string         # Time window (default: "24h")
      bucket_size: string         # Bucket size (default: "auto")
      aggregation_mode: string    # average|sum|max|min|count (default: "average")

      # Bar Appearance
      bar_color: string           # Bar color (default: "var(--lcars-blue)")
      bar_opacity: number         # Bar opacity (default: 1.0)
      bar_gap: number             # Gap between bars (default: 1)
      bar_radius: number          # Corner radius (default: 0)

      # Color Coding
      color_ranges: array         # Value-based color ranges
      use_gradient: boolean       # Use gradient fills (default: false)

      # Axis and Grid
      show_axis: boolean          # Show axis lines (default: true)
      show_grid: boolean          # Show grid lines (default: false)
      show_labels: boolean        # Show time labels (default: true)
      show_values: boolean        # Show value labels (default: false)

      axis_color: string          # Axis color (default: "var(--lcars-gray)")
      grid_color: string          # Grid color (default: "var(--lcars-gray)")
      grid_opacity: number        # Grid opacity (default: 0.3)
      label_color: string         # Label color (default: "var(--lcars-white)")
      label_font_size: number     # Label font size (default: 10)

      # Thresholds
      thresholds: array           # Threshold line definitions
      zero_line: boolean          # Show zero line (default: false)

      # Effects
      gradient: object            # Gradient definition
      pattern: object             # Pattern definition
      glow: object                # Glow effect
      shadow: object              # Shadow effect
      blur: object                # Blur effect

      # LCARS Features
      bracket_style: boolean      # Enable brackets (default: false)
      bracket_color: string       # Bracket color
      status_indicator: boolean|string # Status indicator

      # Interaction
      hover_enabled: boolean      # Enable hover (default: true)
      hover_color: string         # Hover color (default: "var(--lcars-yellow)")

      # Performance
      max_bars: number            # Maximum bars (default: 100)

      # Animation (Future)
      animatable: boolean         # Animation support (default: true)
      cascade_speed: number       # Cascade animation speed (default: 0)
      reveal_animation: boolean   # Reveal animation (default: false)
```

### Color Range Definition
```yaml
color_ranges:
  - min: number                   # Minimum value for range
    max: number                   # Maximum value for range
    color: string                 # Color for this range
    label: string                 # Optional label for range
```

### Threshold Definition
```yaml
thresholds:
  - value: number                 # Threshold value
    color: string                 # Line color
    width: number                 # Line width (default: 1)
    opacity: number               # Line opacity (default: 0.7)
    dash: boolean                 # Dashed line (default: false)
    label: string                 # Optional label
```

---

## Troubleshooting

### Common Issues

#### 1. No Bars Displayed
**Symptoms**: Empty history bar or status indicator only
**Solutions**:
- Verify DataSource has historical data in buffer
- Check time window settings (data may be outside window)
- Ensure DataSource is started and collecting data
- Test with broader time window (e.g., "7d" instead of "1h")

```javascript
// Debug DataSource buffer
const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
const source = dsm.getSource('your_source');
console.log('Buffer data:', source.getCurrentData().buffer?.getAll());
```

#### 2. Wrong Bar Colors
**Symptoms**: Bars showing default color instead of configured colors
**Solutions**:
- Check color_ranges configuration and value ranges
- Verify data values fall within configured ranges
- Test with simplified color range first
- Check CSS variable availability

#### 3. Performance Issues
**Symptoms**: Slow rendering or browser lag
**Solutions**:
- Reduce max_bars setting: `max_bars: 50`
- Use larger bucket_size: `bucket_size: "4h"`
- Reduce time_window: `time_window: "12h"`
- Disable expensive effects temporarily

#### 4. Time Labels Wrong
**Symptoms**: Incorrect or missing time labels
**Solutions**:
- Check bucket_size and time_window alignment
- Verify time zone considerations
- Test with different label_font_size
- Enable show_labels if disabled

#### 5. Enhanced DataSource Not Working
**Symptoms**: "ENHANCED_DATA_NOT_FOUND" status
**Solutions**:
- Verify dot notation syntax: `source.transformations.key`
- Check transformation/aggregation key names
- Ensure DataSource has the requested enhancement
- Use synthetic data generation for single values

### Debug Commands

#### Basic History Bar Inspection
```javascript
// Get history bar overlays
const historyBars = document.querySelectorAll('[data-overlay-type="history_bar"]');
console.log('Found history bars:', historyBars.length);

// Check history bar status
historyBars.forEach(el => {
  console.log(`History Bar ${el.getAttribute('data-overlay-id')}:`, {
    source: el.getAttribute('data-source'),
    status: el.getAttribute('data-status'),
    features: el.getAttribute('data-history-bar-features'),
    lastUpdate: el.getAttribute('data-last-update')
  });
});
```

#### DataSource Integration Testing
```javascript
// Test enhanced data access
const result = window.HistoryBarRenderer.getHistoricalDataForHistoryBar('temp.transformations.celsius');
console.log('Enhanced data result:', result);

// Manual update test
const historyBarEl = document.querySelector('[data-overlay-id="my_history_bar"]');
const source = dsm.getSource('temperature_sensor');
window.HistoryBarRenderer.updateHistoryBarData(historyBarEl, overlay, source.getCurrentData());
```

#### Time Window Analysis
```javascript
// Test time window parsing
const renderer = new window.HistoryBarRenderer();
console.log('24h in ms:', renderer._parseTimeWindow('24h'));
console.log('7d in ms:', renderer._parseTimeWindow('7d'));

// Check bucket creation
const data = source.getCurrentData().buffer.getAll().map(p => ({timestamp: p.t, value: p.v}));
const buckets = renderer._createTimeBuckets(data, 86400000, 'auto');
console.log('Created buckets:', buckets.length, buckets);
```

---

## Examples

### Example 1: Basic Temperature History
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
  - id: temperature_history_24h
    type: history_bar
    source: temperature_sensor.transformations.smoothed
    position: [50, 100]
    size: [400, 80]
    style:
      orientation: "horizontal"
      time_window: "24h"
      bucket_size: "1h"
      bar_color: "var(--lcars-blue)"
      show_grid: true
      bracket_style: true
      color_ranges:
        - { min: -10, max: 10, color: "var(--lcars-blue)" }
        - { min: 10, max: 25, color: "var(--lcars-green)" }
        - { min: 25, max: 35, color: "var(--lcars-orange)" }
        - { min: 35, max: 50, color: "var(--lcars-red)" }
```

### Example 2: Power Usage Analysis
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
        window: "15m"
        key: "avg_15m"

overlays:
  - id: power_usage_history
    type: history_bar
    source: power_meter.transformations.kilowatts
    position: [100, 200]
    size: [500, 100]
    style:
      orientation: "horizontal"
      time_window: "7d"
      bucket_size: "6h"
      aggregation_mode: "average"

      # Color coding by usage level
      color_ranges:
        - { min: 0, max: 1, color: "var(--lcars-green)", label: "Low" }
        - { min: 1, max: 2.5, color: "var(--lcars-blue)", label: "Normal" }
        - { min: 2.5, max: 4, color: "var(--lcars-yellow)", label: "High" }
        - { min: 4, max: 10, color: "var(--lcars-red)", label: "Peak" }

      # Warning thresholds
      thresholds:
        - value: 3.5
          color: "var(--lcars-orange)"
          dash: true
          label: "High Usage Alert"

      # LCARS styling
      bracket_style: true
      status_indicator: "var(--lcars-green)"
      show_grid: true
      show_labels: true
      glow:
        color: "var(--lcars-blue)"
        blur: 2
        intensity: 0.5
```

### Example 3: Vertical Network Traffic
```yaml
data_sources:
  network_traffic:
    type: entity
    entity: sensor.network_throughput_mbps
    transformations:
      - type: smooth
        method: "moving_average"
        window_size: 3
        key: "smoothed"

overlays:
  - id: network_traffic_vertical
    type: history_bar
    source: network_traffic.transformations.smoothed
    position: [50, 50]
    size: [80, 300]
    style:
      orientation: "vertical"
      time_window: "1h"
      bucket_size: "2m"
      aggregation_mode: "max"

      bar_color: "var(--lcars-cyan)"
      bar_gap: 2
      bar_radius: 2

      # Gradient fill
      gradient:
        type: "linear"
        direction: "horizontal"
        stops:
          - { offset: "0%", color: "var(--lcars-cyan)" }
          - { offset: "100%", color: "var(--lcars-blue)" }

      # Grid and labels
      show_grid: true
      show_labels: true
      show_values: false

      # Effects
      glow:
        color: "var(--lcars-cyan)"
        blur: 3
        intensity: 0.6

      bracket_style: true
      status_indicator: true
```

### Example 4: Multi-Range System Monitoring
```yaml
data_sources:
  cpu_usage:
    type: entity
    entity: sensor.cpu_percent
    aggregations:
      session_stats:
        key: "session"

overlays:
  - id: cpu_usage_detailed
    type: history_bar
    source: cpu_usage
    position: [200, 150]
    size: [350, 60]
    style:
      orientation: "horizontal"
      time_window: "6h"
      bucket_size: "10m"
      aggregation_mode: "average"

      # Multi-level color coding
      color_ranges:
        - { min: 0, max: 30, color: "var(--lcars-green)", label: "Optimal" }
        - { min: 30, max: 60, color: "var(--lcars-blue)", label: "Normal" }
        - { min: 60, max: 80, color: "var(--lcars-yellow)", label: "Busy" }
        - { min: 80, max: 90, color: "var(--lcars-orange)", label: "High" }
        - { min: 90, max: 100, color: "var(--lcars-red)", label: "Critical" }

      # Multiple thresholds
      thresholds:
        - value: 70
          color: "var(--lcars-yellow)"
          width: 1
          dash: true
          label: "Watch"
        - value: 85
          color: "var(--lcars-orange)"
          width: 2
          label: "Alert"
        - value: 95
          color: "var(--lcars-red)"
          width: 3
          label: "Critical"

      # Full LCARS styling
      bracket_style: true
      bracket_color: "var(--lcars-orange)"
      status_indicator: "var(--lcars-green)"
      show_grid: true
      show_labels: true
      show_values: true

      # Effects
      shadow:
        offset_x: 2
        offset_y: 2
        blur: 4
        color: "rgba(0,0,0,0.3)"

      # Performance settings
      max_bars: 72  # 6 hours / 5 minutes = 72 bars max
```

### Example 5: Environmental Trends
```yaml
data_sources:
  multi_sensor:
    type: entity
    entity: sensor.environmental_data
    transformations:
      - type: expression
        expression: "value.temperature"
        key: "temperature"
      - type: expression
        expression: "value.humidity"
        key: "humidity"

overlays:
  # Temperature trends
  - id: temp_trend_history
    type: history_bar
    source: multi_sensor.transformations.temperature
    position: [50, 50]
    size: [600, 50]
    style:
      time_window: "30d"
      bucket_size: "1d"
      aggregation_mode: "average"

      color_ranges:
        - { min: -20, max: 0, color: "#0066CC" }
        - { min: 0, max: 20, color: "var(--lcars-blue)" }
        - { min: 20, max: 30, color: "var(--lcars-green)" }
        - { min: 30, max: 40, color: "var(--lcars-orange)" }
        - { min: 40, max: 50, color: "var(--lcars-red)" }

      bracket_style: true
      show_grid: true
      show_labels: true

  # Humidity trends
  - id: humidity_trend_history
    type: history_bar
    source: multi_sensor.transformations.humidity
    position: [50, 120]
    size: [600, 50]
    style:
      time_window: "30d"
      bucket_size: "1d"
      aggregation_mode: "average"

      color_ranges:
        - { min: 0, max: 30, color: "var(--lcars-orange)" }
        - { min: 30, max: 70, color: "var(--lcars-green)" }
        - { min: 70, max: 100, color: "var(--lcars-blue)" }

      bracket_style: true
      show_grid: true
      show_labels: true
```

---

This completes the comprehensive History Bar overlay documentation covering all features, configuration options, DataSource integration, and practical examples. The system provides powerful temporal data visualization capabilities with flexible time windows, color coding, and LCARS-themed styling perfect for anime.js cascade animations!