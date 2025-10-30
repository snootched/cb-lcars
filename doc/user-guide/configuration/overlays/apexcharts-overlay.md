# ApexCharts Overlay Configuration Guide

> **Advanced charting with 15 chart types**
> Create powerful, interactive charts with real-time data using the ApexCharts library, fully integrated with MSD's DataSource system.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Core Configuration](#core-configuration)
4. [Chart Types](#chart-types)
5. [DataSource Integration](#datasource-integration)
6. [Multi-Series Charts](#multi-series-charts)
7. [Styling](#styling)
8. [Thresholds](#thresholds)
9. [Time Windows & Performance](#time-windows--performance)
10. [Animation](#animation)
11. [Interactivity](#interactivity)
12. [Complete Property Reference](#complete-property-reference)
13. [Real-World Examples](#real-world-examples)
14. [Migration Guide](#migration-guide)
15. [Troubleshooting](#troubleshooting)

---

## Overview

The **ApexCharts Overlay** provides powerful charting capabilities using the ApexCharts library, replacing the deprecated Sparkline and HistoryBar overlays with a superior charting solution.

✅ **15 chart types** - Line, area, bar, pie, radar, heatmap, and more
✅ **Real-time updates** - Live data via DataSource subscriptions
✅ **Multi-series support** - Multiple data sources on one chart
✅ **Transformation integration** - Direct access to transformed data
✅ **Interactive features** - Zoom, pan, tooltips, legends
✅ **Performance optimized** - Data decimation and time windowing
✅ **Threshold visualization** - Warning and critical markers
✅ **LCARS theming** - Automatic LCARS color scheme integration
✅ **Animation presets** - LCARS-appropriate motion profiles

### When to Use ApexCharts

- **Time series monitoring** - Sensor data, metrics over time
- **Comparisons** - Bar charts for comparing values
- **Distributions** - Pie/donut charts for proportions
- **Correlations** - Scatter plots for relationships
- **Statistical analysis** - Box plots for distributions
- **Financial data** - Candlestick charts for OHLC data
- **Gauges** - Radial bars for progress/completion
- **Schedules** - Range bars for timelines

### Replaced Overlays

ApexCharts **replaces** these deprecated overlay types:
- ❌ **Sparkline** - Simple line charts (now use `type: apexchart` with `chart_type: line`)
- ❌ **HistoryBar** - Historical bar charts (now use `type: apexchart` with `chart_type: bar`)

---

## Quick Start

### Minimal Configuration

The absolute minimum needed for a chart:

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.temperature

overlays:
  - id: temp_chart
    type: apexchart
    source: temperature
    position: [100, 100]
    size: [300, 150]
    style:
      chart_type: line
```

**Result:** A simple line chart showing temperature data.

### With Styling

Add colors and configuration:

```yaml
overlays:
  - id: temp_chart
    type: apexchart
    source: temperature
    position: [100, 100]
    size: [300, 150]
    style:
      chart_type: line
      color: var(--lcars-orange)
      stroke_width: 2
      time_window: "12h"
      show_grid: true
      show_tooltip: true
```

**Result:** Styled line chart with 12-hour time window.

### With Thresholds

Add warning and critical lines:

```yaml
overlays:
  - id: temp_chart
    type: apexchart
    source: temperature
    position: [100, 100]
    size: [300, 150]
    style:
      chart_type: line
      color: var(--lcars-blue)
      stroke_width: 3
      time_window: "24h"

      # Threshold markers
      thresholds:
        - value: 75
          color: var(--lcars-yellow)
          label: "Warning"
          dash: true

        - value: 90
          color: var(--lcars-red)
          label: "Critical"
          width: 3
```

**Result:** Chart with warning (75°) and critical (90°) threshold lines.

---

## Core Configuration

### Required Properties

Every ApexCharts overlay must have these properties:

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `id` | string | Unique identifier | `"temp_chart"` |
| `type` | string | Must be `"apexchart"` | `"apexchart"` |
| `source` | string\|array | DataSource reference(s) | `"temperature"` or `["temp1", "temp2"]` |
| `position` | array | [x, y] coordinates | `[100, 100]` |
| `size` | array | [width, height] in pixels | `[300, 150]` |

### Core Style Properties

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `chart_type` | string | Chart type | `"line"` |
| `color` | string | Primary color | `"var(--lcars-blue)"` |
| `stroke_width` | number | Line thickness | `2` |
| `time_window` | string | Time range to display | No limit |

### Basic Example

```yaml
overlays:
  - id: my_chart
    type: apexchart
    source: sensor_data
    position: [50, 100]
    size: [400, 200]

    style:
      chart_type: line
      color: var(--lcars-orange)
      stroke_width: 2
      time_window: "6h"
      show_grid: true
      show_tooltip: true
```

---

## Chart Types

ApexCharts supports 15 different chart types for various visualization needs.

### Available Chart Types

| Type | Description | Best For |
|------|-------------|----------|
| `line` | Line chart | Time series, trends |
| `area` | Filled area chart | Volume, magnitude over time |
| `bar` | Vertical bar chart | Comparisons, discrete values |
| `pie` | Pie chart | Proportions (< 7 categories) |
| `donut` | Donut chart | Proportions with center label |
| `radar` | Radar/spider chart | Multi-dimensional comparisons |
| `heatmap` | Heat map | Two-dimensional patterns |
| `radialBar` | Radial gauge | Progress, completion % |
| `rangeBar` | Horizontal timeline | Schedules, duty rosters |
| `polarArea` | Polar area chart | Directional data |
| `treemap` | Hierarchical treemap | Resource allocation |
| `rangeArea` | Range area chart | Confidence intervals |
| `scatter` | Scatter plot | Correlations, distributions |
| `candlestick` | Candlestick chart | Financial OHLC data |
| `boxPlot` | Box plot | Statistical distributions |

### Line Chart

Simple time series with connecting lines:

```yaml
style:
  chart_type: line
  color: var(--lcars-blue)
  stroke_width: 2
  smoothing_mode: smooth      # smooth, stepped, or none
  show_points: false          # Hide data point markers
```

**Use for:** Temperature trends, sensor readings over time, metric tracking.

### Area Chart

Filled area below the line:

```yaml
style:
  chart_type: area
  color: var(--lcars-orange)
  stroke_width: 2
  fill_opacity: 0.3           # Transparency of fill
  zero_line: true             # Show zero baseline
```

**Use for:** Power consumption, bandwidth usage, emphasizing volume.

### Bar Chart

Vertical bars for discrete values:

```yaml
style:
  chart_type: bar
  color: var(--lcars-green)
  show_values: true           # Show values on bars
  show_grid: false
```

**Use for:** Comparing values across categories, daily totals.

### Pie Chart

Circular chart showing proportions:

```yaml
style:
  chart_type: pie
  colors:
    - var(--lcars-blue)
    - var(--lcars-green)
    - var(--lcars-orange)
    - var(--lcars-red)
  show_labels: true
  show_legend: true
```

**Use for:** Resource allocation, category distribution (max 7 categories).

### Donut Chart

Pie chart with center hole:

```yaml
style:
  chart_type: donut
  colors:
    - var(--lcars-blue)
    - var(--lcars-green)
    - var(--lcars-orange)
  show_labels: true
  donut_size: "65%"           # Inner hole size
```

**Use for:** Similar to pie, but with center label option.

### Radar Chart

Spider/web chart for multi-dimensional data:

```yaml
style:
  chart_type: radar
  colors:
    - var(--lcars-blue)
    - var(--lcars-orange)
  stroke_width: 2
  fill_opacity: 0.2
  show_legend: true
```

**Use for:** Comparing multiple metrics, sensor arrays, multi-factor analysis.

### Heatmap

Color-coded grid for patterns:

```yaml
style:
  chart_type: heatmap
  colors:
    - var(--lcars-blue)
    - var(--lcars-green)
    - var(--lcars-yellow)
    - var(--lcars-red)
  show_labels: true
```

**Use for:** Activity schedules, correlation matrices, time-based patterns.

### RadialBar (Gauge)

Circular progress/gauge chart:

```yaml
style:
  chart_type: radialBar
  color: var(--lcars-blue)
  value_format: percent       # Show as percentage
  gauge_start_angle: -90      # Start position (degrees)
  gauge_end_angle: 90         # End position (degrees)
  show_labels: true
```

**Use for:** Shield strength, progress bars, completion percentage.

### RangeBar (Timeline)

Horizontal bars for time ranges:

```yaml
style:
  chart_type: rangeBar
  group_rows: true            # Group similar items
  show_labels: true
  show_legend: true
```

**Use for:** Maintenance schedules, duty rosters, Gantt charts.

### PolarArea

Circular chart with variable radius:

```yaml
style:
  chart_type: polarArea
  colors:
    - var(--lcars-blue)
    - var(--lcars-green)
    - var(--lcars-orange)
  show_labels: true
  legend_position: bottom
```

**Use for:** Directional sensors, coverage patterns, radial distributions.

### Treemap

Hierarchical rectangles:

```yaml
style:
  chart_type: treemap
  colors:
    - var(--lcars-blue)
    - var(--lcars-green)
    - var(--lcars-orange)
  show_labels: true
```

**Use for:** System resource allocation, hierarchical data, disk usage.

### RangeArea

Area chart with min/max ranges:

```yaml
style:
  chart_type: rangeArea
  color: var(--lcars-blue)
  fill_opacity: 0.2
  show_legend: true
```

**Use for:** Temperature ranges, confidence intervals, forecast ranges.

### Scatter Plot

Individual points for correlation:

```yaml
style:
  chart_type: scatter
  marker_size: 6              # Point size
  colors:
    - var(--lcars-blue)
    - var(--lcars-orange)
  show_grid: true
```

**Use for:** Correlation analysis, distribution patterns, outlier detection.

### Candlestick

OHLC financial chart:

```yaml
style:
  chart_type: candlestick
  colors:
    upward: var(--lcars-green)    # Positive change
    downward: var(--lcars-red)    # Negative change
```

**Use for:** Energy price fluctuations, financial data, OHLC analysis.

### BoxPlot

Statistical distribution chart:

```yaml
style:
  chart_type: boxPlot
  color: var(--lcars-blue)
  show_labels: true
```

**Use for:** Sensor data distributions, statistical analysis, outlier detection.

---

## DataSource Integration

Connect charts to live data with full transformation support.

### Basic DataSource Reference

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.temperature

overlays:
  - id: temp_chart
    type: apexchart
    source: temperature          # Simple reference
    position: [100, 100]
    size: [300, 150]
    style:
      chart_type: line
```

### Transformation Access

Use dot notation to access transformed data:

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.outdoor_temp
    transformations:
      - type: unit_conversion
        conversion: "fahrenheit_to_celsius"
        key: "celsius"

      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"

overlays:
  # Raw data
  - id: raw_chart
    type: apexchart
    source: temperature
    position: [50, 100]
    size: [300, 100]
    style:
      chart_type: line
      color: var(--lcars-gray)

  # Converted data
  - id: celsius_chart
    type: apexchart
    source: temperature.transformations.celsius
    position: [50, 220]
    size: [300, 100]
    style:
      chart_type: line
      color: var(--lcars-blue)

  # Smoothed data
  - id: smooth_chart
    type: apexchart
    source: temperature.transformations.smoothed
    position: [50, 340]
    size: [300, 100]
    style:
      chart_type: area
      color: var(--lcars-orange)
```

### Aggregation Access

Use aggregated values:

```yaml
data_sources:
  cpu_usage:
    type: entity
    entity: sensor.cpu_percent
    aggregations:
      - type: average
        window: 3600
        key: "avg_1h"

      - type: max
        window: 3600
        key: "max_1h"

overlays:
  - id: cpu_stats
    type: apexchart
    source:
      - cpu_usage.aggregations.avg_1h
      - cpu_usage.aggregations.max_1h
    position: [100, 100]
    size: [400, 200]
    style:
      chart_type: line
      show_legend: true
      series_names:
        cpu_usage.aggregations.avg_1h: "Average"
        cpu_usage.aggregations.max_1h: "Peak"
```

---

## Multi-Series Charts

Display multiple data sources on a single chart.

### Basic Multi-Series

Use an **array** for the `source` property:

```yaml
data_sources:
  temp_living:
    type: entity
    entity: sensor.living_room_temp

  temp_bedroom:
    type: entity
    entity: sensor.bedroom_temp

  temp_kitchen:
    type: entity
    entity: sensor.kitchen_temp

overlays:
  - id: multi_temp_chart
    type: apexchart
    source:
      - temp_living
      - temp_bedroom
      - temp_kitchen
    position: [100, 100]
    size: [400, 200]
    style:
      chart_type: line
      time_window: "12h"
      show_legend: true
```

**Result:** Three lines on one chart, one per room.

### Custom Series Names

Provide friendly names for each series:

```yaml
overlays:
  - id: named_chart
    type: apexchart
    source:
      - indoor_temp
      - outdoor_temp
    position: [100, 100]
    size: [400, 200]
    style:
      chart_type: line
      show_legend: true
      legend_position: top

      # Custom names
      series_names:
        indoor_temp: "Inside"
        outdoor_temp: "Outside"
```

### Per-Series Styling

Customize colors and styles for each series:

```yaml
overlays:
  - id: styled_multi
    type: apexchart
    source:
      - temp_living
      - temp_bedroom
      - temp_kitchen
    position: [100, 100]
    size: [400, 200]
    style:
      chart_type: line
      show_legend: true

      # Advanced ApexCharts options
      chart_options:
        colors:
          - var(--lcars-blue)
          - var(--lcars-orange)
          - var(--lcars-green)
        stroke:
          width: [2, 2, 3]        # Different widths
          dashArray: [0, 0, 4]    # Third line dashed
```

### Multi-Series with Transformations

Each series can use different transformations:

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.outdoor_temp
    transformations:
      - type: unit_conversion
        conversion: "fahrenheit_to_celsius"
        key: "celsius"

      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"

overlays:
  - id: comparison
    type: apexchart
    source:
      - temperature                           # Raw
      - temperature.transformations.celsius   # Converted
      - temperature.transformations.smoothed  # Smoothed
    position: [100, 100]
    size: [400, 200]
    style:
      chart_type: line
      show_legend: true
      series_names:
        temperature: "Raw °F"
        temperature.transformations.celsius: "Celsius"
        temperature.transformations.smoothed: "Smoothed"
```

### Performance Considerations

Multi-series charts can be data-intensive:

```yaml
style:
  time_window: "6h"            # Shorter window
  max_points: 300              # Fewer points per series
  animatable: false            # Disable animations
```

**Recommendations:**
- Limit to 3-5 series per chart
- Use shorter time windows
- Reduce `max_points` for performance
- Consider separate charts for very different data types

---

## Styling

Comprehensive styling options for all chart types.

### Line Styling

```yaml
style:
  color: var(--lcars-blue)     # Line color
  stroke_width: 3              # Line thickness
  smoothing_mode: smooth       # smooth, stepped, none
  line_cap: round              # round, square, butt
  dash_array: 0                # Dashed lines (e.g., 5)
```

**Smoothing modes:**
- `smooth` / `bezier` / `spline` - Smooth curves
- `stepped` - Step-line chart
- `none` / `linear` - Straight lines

### Fill Styling (Area Charts)

```yaml
style:
  chart_type: area
  fill: var(--lcars-blue)
  fill_opacity: 0.3

  # Gradient fill
  fill_gradient:
    type: vertical             # or horizontal
    stops:
      - offset: 0
        color: var(--lcars-blue)
        opacity: 0.8
      - offset: 100
        color: var(--lcars-blue)
        opacity: 0.1
```

### Data Points

```yaml
style:
  show_points: true
  point_size: 4
  point_color: var(--lcars-orange)
```

### Data Labels

```yaml
style:
  show_values: true
  value_format: "{value}°C"    # Custom format string
```

### Grid & Axes

```yaml
style:
  # Grid
  show_grid: true
  grid_vertical: true
  grid_horizontal: true
  grid_color: var(--lcars-gray)
  grid_opacity: 0.4

  # Axes
  show_axis: true
  show_labels: true
  label_color: var(--lcars-white)
  label_font_size: 10px
  axis_color: var(--lcars-gray)

  # Y-axis range
  min_value: 0                 # Force minimum
  max_value: 100               # Force maximum
```

### Tooltip

```yaml
style:
  show_tooltip: true
  tooltip_time_format: "HH:mm:ss"
```

### Legend

```yaml
style:
  show_legend: true
  legend_position: top         # top, bottom, left, right
  legend_font_size: 12px
  legend_color: var(--lcars-white)
```

### Colors

```yaml
style:
  # Single series
  color: var(--lcars-blue)

  # Multi-series
  colors:
    - var(--lcars-blue)
    - var(--lcars-orange)
    - var(--lcars-green)
    - var(--lcars-red)
```

**LCARS color variables:**
- `var(--lcars-blue)`, `var(--lcars-orange)`, `var(--lcars-red)`
- `var(--lcars-yellow)`, `var(--lcars-green)`, `var(--lcars-purple)`
- `var(--lcars-white)`, `var(--lcars-gray)`, `var(--lcars-black)`

---

## Thresholds

Add visual threshold markers for warnings and critical values.

### Basic Thresholds

```yaml
style:
  thresholds:
    - value: 70                # Y-axis value
      color: var(--lcars-yellow)
      label: "Warning"

    - value: 90
      color: var(--lcars-red)
      label: "Critical"
```

### Threshold Properties

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `value` | number | Y-axis value (required) | - |
| `color` | string | Line color | `"var(--lcars-red)"` |
| `width` | number | Line thickness | `2` |
| `dash` | boolean | Use dashed line | `false` |
| `label` | string | Text label | - |
| `opacity` | number | Line opacity | `0.7` |

### Complete Threshold Example

```yaml
overlays:
  - id: temp_with_thresholds
    type: apexchart
    source: temperature
    position: [100, 100]
    size: [400, 200]
    style:
      chart_type: line
      color: var(--lcars-blue)
      stroke_width: 2
      time_window: "24h"

      # Zero baseline
      zero_line: true
      zero_line_color: var(--lcars-gray)

      # Thresholds
      thresholds:
        - value: 60
          color: var(--lcars-blue)
          dash: true
          label: "Cool"
          opacity: 0.5

        - value: 75
          color: var(--lcars-yellow)
          dash: true
          width: 2
          label: "Warning"
          opacity: 0.7

        - value: 90
          color: var(--lcars-red)
          width: 3
          label: "Critical"
          opacity: 0.9
```

---

## Time Windows & Performance

Control data range and optimize performance.

### Time Window

Limit displayed data to a time range:

```yaml
style:
  time_window: "12h"           # Show last 12 hours
```

**Supported formats:**
- Seconds: `"30s"`, `"45s"`
- Minutes: `"5m"`, `"30m"`
- Hours: `"1h"`, `"6h"`, `"12h"`, `"24h"`
- Days: `"7d"`, `"30d"`

### Max Points

Limit number of data points for performance:

```yaml
style:
  max_points: 500              # Limit to 500 points
```

**Recommendations:**
- Single series: 500-1000 points
- Multi-series (2-3): 300-500 points per series
- Multi-series (4-5): 200-300 points per series

### Performance Example

```yaml
overlays:
  - id: optimized_chart
    type: apexchart
    source:
      - temp1
      - temp2
      - temp3
    position: [100, 100]
    size: [400, 200]
    style:
      chart_type: line

      # Performance optimizations
      time_window: "6h"        # Shorter window
      max_points: 300          # Fewer points
      animatable: false        # Disable animations

      show_tooltip: false      # Disable tooltip
      show_legend: true
```

---

## Animation

Control chart animations with presets or custom configuration.

### Animation Presets

Pre-configured LCARS-appropriate animation profiles:

```yaml
overlays:
  - id: animated_chart
    type: apexchart
    source: temperature
    position: [100, 100]
    size: [300, 150]
    animation_preset: lcars_standard
```

**Available presets:**

| Preset | Speed | Use Case |
|--------|-------|----------|
| `lcars_standard` | 800ms | Default - balanced |
| `lcars_dramatic` | 1200ms | Important displays |
| `lcars_minimal` | 400ms | Quick updates |
| `lcars_realtime` | Disabled | Live data feeds |
| `lcars_alert` | 600ms | Warnings/alerts |
| `none` | Disabled | Accessibility |

### Preset Examples

#### Standard (Default)
```yaml
animation_preset: lcars_standard  # 800ms, balanced
```

#### Dramatic (Important)
```yaml
animation_preset: lcars_dramatic  # 1200ms, cinematic
```

#### Realtime (Live Data)
```yaml
animation_preset: lcars_realtime  # No entrance, fast updates
```

### Custom Animation

```yaml
style:
  animatable: true
  animation_speed: 800         # Milliseconds

  # Advanced options
  chart_options:
    chart:
      animations:
        speed: 1000
        easing: easeinout
        dynamicAnimation:
          speed: 350
```

---

## Interactivity

Enable interactive features like zoom, pan, and selection.

### Basic Interactivity

```yaml
style:
  enable_zoom: true            # Enable zoom
  enable_pan: true             # Enable pan
  enable_selection: true       # Enable area selection
  show_toolbar: false          # Hide toolbar
```

### Interactive Example

```yaml
overlays:
  - id: interactive_chart
    type: apexchart
    source: temperature
    position: [100, 100]
    size: [400, 250]
    style:
      chart_type: line
      color: var(--lcars-blue)
      time_window: "24h"

      # Interactivity
      enable_zoom: true
      enable_pan: true
      enable_selection: true
      show_toolbar: true        # Show zoom/pan controls

      show_tooltip: true
      tooltip_time_format: "MMM DD, HH:mm"

      show_legend: true
      legend_position: top
```

---

## Complete Property Reference

### ApexCharts Overlay Schema

```yaml
overlays:
  - id: string                    # Required: Unique identifier
    type: apexchart               # Required: Must be "apexchart"
    source: string|array          # Required: DataSource reference(s)
    position: [number, number]    # Required: [x, y] coordinates
    size: [number, number]        # Required: [width, height]

    animation_preset: string      # Optional: Animation preset

    style:                        # Styling configuration
      # Chart Type
      chart_type: string          # Chart type (default: "line")

      # Line Styling
      color: string               # Primary color (default: "var(--lcars-blue)")
      stroke_width: number        # Line thickness (default: 2)
      smoothing_mode: string      # smooth, stepped, none (default: "smooth")
      line_cap: string            # round, square, butt (default: "round")
      dash_array: number          # Dashed lines (default: 0)

      # Fill Styling (Area Charts)
      fill: string                # Fill color
      fill_opacity: number        # Fill transparency (default: 0.3)
      fill_gradient: object       # Gradient fill definition

      # Data Points
      show_points: boolean        # Show data points (default: false)
      point_size: number          # Point size (default: 4)
      point_color: string         # Point color

      # Data Labels
      show_values: boolean        # Show values on points (default: false)
      value_format: string        # Value format string

      # Grid & Axes
      show_grid: boolean          # Show grid (default: true)
      grid_vertical: boolean      # Vertical grid lines (default: true)
      grid_horizontal: boolean    # Horizontal grid lines (default: true)
      grid_color: string          # Grid color (default: "var(--lcars-gray)")
      grid_opacity: number        # Grid opacity (default: 0.4)

      show_axis: boolean          # Show axes (default: true)
      show_labels: boolean        # Show axis labels (default: true)
      label_color: string         # Label color (default: "var(--lcars-white)")
      label_font_size: string     # Label font size (default: "10px")
      axis_color: string          # Axis color (default: "var(--lcars-gray)")

      min_value: number           # Y-axis minimum
      max_value: number           # Y-axis maximum

      # Tooltip
      show_tooltip: boolean       # Show tooltip (default: true)
      tooltip_time_format: string # Time format (default: "HH:mm:ss")

      # Legend
      show_legend: boolean        # Show legend (default: false)
      legend_position: string     # top, bottom, left, right (default: "top")
      legend_font_size: string    # Legend font size (default: "12px")
      legend_color: string        # Legend color (default: "var(--lcars-white)")

      # Colors
      colors: array               # Array of colors for multi-series

      # Thresholds
      zero_line: boolean          # Show zero baseline (default: false)
      zero_line_color: string     # Zero line color (default: "var(--lcars-gray)")

      thresholds: array           # Threshold definitions
        - value: number           # Y-axis value (required)
          color: string           # Line color (default: "var(--lcars-red)")
          width: number           # Line width (default: 2)
          dash: boolean           # Dashed line (default: false)
          label: string           # Text label
          opacity: number         # Line opacity (default: 0.7)

      # Time Window & Performance
      time_window: string         # Time range (e.g., "12h")
      max_points: number          # Maximum data points (default: 1000)

      # Animation
      animatable: boolean         # Enable animations (default: true)
      animation_speed: number     # Animation speed in ms (default: 800)

      # Interactivity
      enable_zoom: boolean        # Enable zoom (default: false)
      enable_pan: boolean         # Enable pan (default: false)
      enable_selection: boolean   # Enable selection (default: false)
      show_toolbar: boolean       # Show toolbar (default: false)

      # Multi-Series
      series_names: object        # Map of source to display name

      # Chart-Specific Options
      # RadialBar (Gauge)
      value_format: string        # percent or number (default: "number")
      gauge_start_angle: number   # Start angle (default: -90)
      gauge_end_angle: number     # End angle (default: 90)

      # RangeBar (Timeline)
      group_rows: boolean         # Group rows (default: true)

      # Scatter
      marker_size: number         # Point size (default: 6)

      # Donut
      donut_size: string          # Inner hole size (default: "65%")

      # Candlestick
      colors:
        upward: string            # Positive change color
        downward: string          # Negative change color

      # Advanced
      chart_options: object       # Direct ApexCharts options
```

---

## Real-World Examples

### Example 1: Temperature Monitoring

```yaml
data_sources:
  living_temp:
    type: entity
    entity: sensor.living_room_temperature

  bedroom_temp:
    type: entity
    entity: sensor.bedroom_temperature

  outdoor_temp:
    type: entity
    entity: sensor.outdoor_temperature

overlays:
  - id: temp_monitor
    type: apexchart
    source:
      - living_temp
      - bedroom_temp
      - outdoor_temp
    position: [50, 100]
    size: [450, 250]
    animation_preset: lcars_standard

    style:
      chart_type: line
      smoothing_mode: smooth
      stroke_width: 2

      # Time window
      time_window: "24h"
      max_points: 400

      # Grid & axes
      show_grid: true
      show_axis: true
      show_labels: true

      # Legend
      show_legend: true
      legend_position: top

      # Series names
      series_names:
        living_temp: "Living Room"
        bedroom_temp: "Bedroom"
        outdoor_temp: "Outside"

      # Colors
      colors:
        - var(--lcars-blue)
        - var(--lcars-orange)
        - var(--lcars-green)

      # Thresholds
      thresholds:
        - value: 65
          color: var(--lcars-blue)
          dash: true
          label: "Cool"

        - value: 78
          color: var(--lcars-yellow)
          dash: true
          label: "Warm"

        - value: 85
          color: var(--lcars-red)
          width: 3
          label: "Hot"

      # Interactivity
      show_tooltip: true
      enable_zoom: true
      enable_pan: true
```

### Example 2: Power Consumption Gauge

```yaml
data_sources:
  power_usage:
    type: entity
    entity: sensor.home_power_usage
    transformations:
      - type: expression
        expression: "(value / 5000) * 100"  # Convert to percentage of max
        key: "percent"

overlays:
  - id: power_gauge
    type: apexchart
    source: power_usage.transformations.percent
    position: [50, 100]
    size: [250, 250]
    animation_preset: lcars_alert

    style:
      chart_type: radialBar
      color: var(--lcars-blue)

      # Gauge configuration
      value_format: percent
      gauge_start_angle: -90
      gauge_end_angle: 90

      show_labels: true
      show_values: true
```

### Example 3: System Resource Dashboard

```yaml
data_sources:
  cpu_usage:
    type: entity
    entity: sensor.cpu_usage

  memory_usage:
    type: entity
    entity: sensor.memory_usage

  disk_usage:
    type: entity
    entity: sensor.disk_usage

overlays:
  # CPU Chart
  - id: cpu_chart
    type: apexchart
    source: cpu_usage
    position: [50, 100]
    size: [400, 150]
    animation_preset: lcars_minimal

    style:
      chart_type: area
      color: var(--lcars-blue)
      fill_opacity: 0.3
      stroke_width: 2

      time_window: "1h"
      max_points: 300

      show_grid: true
      zero_line: true

      thresholds:
        - value: 80
          color: var(--lcars-yellow)
          dash: true
        - value: 95
          color: var(--lcars-red)

  # Memory Chart
  - id: memory_chart
    type: apexchart
    source: memory_usage
    position: [50, 270]
    size: [400, 150]
    animation_preset: lcars_minimal

    style:
      chart_type: area
      color: var(--lcars-orange)
      fill_opacity: 0.3
      stroke_width: 2

      time_window: "1h"
      max_points: 300

      show_grid: true
      zero_line: true

      thresholds:
        - value: 85
          color: var(--lcars-yellow)
          dash: true
        - value: 95
          color: var(--lcars-red)

  # Disk Gauge
  - id: disk_gauge
    type: apexchart
    source: disk_usage
    position: [470, 185]
    size: [200, 200]
    animation_preset: lcars_standard

    style:
      chart_type: radialBar
      color: var(--lcars-green)
      value_format: percent
      show_labels: true
```

### Example 4: Network Traffic

```yaml
data_sources:
  network_in:
    type: entity
    entity: sensor.network_in
    transformations:
      - type: unit_conversion
        conversion: "bytes_to_mbps"
        key: "mbps"

  network_out:
    type: entity
    entity: sensor.network_out
    transformations:
      - type: unit_conversion
        conversion: "bytes_to_mbps"
        key: "mbps"

overlays:
  - id: network_chart
    type: apexchart
    source:
      - network_in.transformations.mbps
      - network_out.transformations.mbps
    position: [50, 100]
    size: [450, 200]
    animation_preset: lcars_realtime

    style:
      chart_type: area
      stroke_width: 2

      # Fast updates for realtime
      time_window: "5m"
      max_points: 150

      # Styling
      colors:
        - var(--lcars-blue)
        - var(--lcars-orange)
      fill_opacity: 0.2

      show_grid: true
      show_legend: true
      legend_position: top

      series_names:
        network_in.transformations.mbps: "Download"
        network_out.transformations.mbps: "Upload"

      show_tooltip: true
      tooltip_time_format: "HH:mm:ss"
```

---

## Migration Guide

Migrating from deprecated Sparkline and HistoryBar overlays.

### From Sparkline to ApexCharts

#### Old (Sparkline)
```yaml
- id: temp_sparkline
  type: sparkline
  source: temperature_sensor
  position: [50, 100]
  size: [300, 50]
  style:
    color: var(--lcars-blue)
    width: 2
```

#### New (ApexCharts)
```yaml
- id: temp_chart
  type: apexchart
  source: temperature_sensor
  position: [50, 100]
  size: [300, 50]
  style:
    chart_type: line
    color: var(--lcars-blue)
    stroke_width: 2

    # Sparkline-style appearance
    show_grid: false
    show_axis: false
    show_tooltip: false
    time_window: "1h"
```

### From HistoryBar to ApexCharts

#### Old (HistoryBar)
```yaml
- id: energy_history
  type: history_bar
  source: energy_daily
  position: [50, 100]
  size: [300, 150]
  style:
    color: var(--lcars-green)
```

#### New (ApexCharts)
```yaml
- id: energy_chart
  type: apexchart
  source: energy_daily
  position: [50, 100]
  size: [300, 150]
  style:
    chart_type: bar
    color: var(--lcars-green)
    show_values: true
    show_grid: false
```

### Migration Checklist

✅ Change `type: sparkline` → `type: apexchart`
✅ Add `chart_type: line` (or `bar` for history)
✅ Rename `width` → `stroke_width`
✅ Add `time_window` for sparkline appearance
✅ Disable grid/axis for minimal look
✅ Test with your data sources

---

## Troubleshooting

### Chart Not Showing

**Symptoms:** Chart doesn't appear on dashboard

**Solutions:**
1. ✅ Verify `type: apexchart` is correct
2. ✅ Check `source` DataSource exists
3. ✅ Ensure DataSource has data: `window.cblcars.debug.msd.pipelineInstance.systemsManager.dataSourceManager.getSource('name').getCurrentData()`
4. ✅ Check browser console for errors
5. ✅ Verify ApexCharts library is loaded

```javascript
// Debug chart existence
const chart = document.querySelector('[data-overlay-id="my_chart"]');
console.log('Chart element:', chart);
```

### No Data Showing

**Symptoms:** Chart appears but shows no data

**Solutions:**
1. ✅ Verify DataSource is started and has data
2. ✅ Check `time_window` isn't too restrictive
3. ✅ Ensure data format matches chart type
4. ✅ Test with simpler chart configuration

```javascript
// Check DataSource data
const dsm = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;
const source = dsm.getSource('temperature');
console.log('Source data:', source?.getCurrentData());
console.log('Buffer:', source?.buffer);
```

### Poor Performance

**Symptoms:** Chart is slow or laggy

**Solutions:**
1. ✅ Reduce `max_points` (try 300-500)
2. ✅ Shorten `time_window`
3. ✅ Disable animations: `animatable: false`
4. ✅ Reduce number of series (3-5 max)
5. ✅ Disable tooltip: `show_tooltip: false`

```yaml
# Optimized configuration
style:
  time_window: "6h"
  max_points: 300
  animatable: false
  show_tooltip: false
```

### Animation Not Working

**Symptoms:** Animation preset doesn't apply

**Solutions:**
1. ✅ Check preset name is correct (case-sensitive)
2. ✅ Ensure `animatable: false` isn't set
3. ✅ Verify preset is loaded (check console)
4. ✅ Try `animation_preset: lcars_standard`

```yaml
# Correct
animation_preset: lcars_standard

# Wrong
animation_preset: LCARS_Standard  # Wrong case
```

### Multi-Series Issues

**Symptoms:** Multiple series not showing correctly

**Solutions:**
1. ✅ Verify `source` is an array: `source: [...]`
2. ✅ Check all DataSources exist
3. ✅ Ensure series have data in time window
4. ✅ Use `show_legend: true` to see series names

```yaml
# Correct multi-series
source:
  - temp1
  - temp2
  - temp3
show_legend: true
```

### Threshold Not Showing

**Symptoms:** Threshold lines don't appear

**Solutions:**
1. ✅ Check `value` is within chart range
2. ✅ Verify `color` has sufficient opacity
3. ✅ Ensure threshold is visible (try `width: 3`)
4. ✅ Check if covered by data (reduce `fill_opacity`)

```yaml
thresholds:
  - value: 75
    color: var(--lcars-red)
    width: 3              # Make more visible
    opacity: 1.0          # Full opacity
```

### Debug Commands

```javascript
// Get all ApexCharts overlays
const charts = document.querySelectorAll('[data-overlay-type="apexchart"]');
console.log('Found charts:', charts.length);

// Check specific chart
const chart = document.querySelector('[data-overlay-id="my_chart"]');
console.log('Chart details:', {
  id: chart?.getAttribute('data-overlay-id'),
  source: chart?.getAttribute('data-source')
});

// Check DataSource
const dsm = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;
const source = dsm.getSource('temperature');
console.log('Source:', {
  hasData: !!source,
  currentData: source?.getCurrentData(),
  bufferSize: source?.buffer?.length
});
```

---

## 📚 Related Documentation

- **[DataSource System](../datasources.md)** - Configure data sources
- **[DataSource Transformations](../datasource-transformations.md)** - Transform chart data
- **[DataSource Aggregations](../datasource-aggregations.md)** - Aggregate time-series data
- **[Text Overlay](text-overlay.md)** - Add labels to charts
- **[Button Overlay](button-overlay.md)** - Add controls near charts
- **[Status Grid Overlay](status-grid-overlay.md)** - Multi-metric grids

---

**Last Updated:** October 26, 2025
**Version:** 2025.10.1-fuk.42-69
**Replaces:** Sparkline, HistoryBar overlays
