# ApexCharts Overlay

The `apexchart` overlay type provides powerful, interactive charts using the [ApexCharts](https://apexcharts.com/) library, fully integrated with MSD's DataSource system.

## Overview

ApexCharts overlays offer:
- **Real-time updates** via DataSource subscriptions
- **15 chart types**: line, area, bar, pie, donut, radar, heatmap, radialBar, rangeBar, polarArea, treemap, rangeArea, scatter, candlestick, boxPlot
- **Interactive features**: zoom, pan, tooltips, legends
- **Transformation support**: Direct integration with DataSource transformations
- **Threshold visualization**: Visual markers for warning/critical values
- **Performance optimized**: Data decimation and time window filtering

## Basic Configuration

```yaml
overlays:
  - id: temperature_chart
    type: apexchart
    source: temperature_sensor
    position: [50, 100]
    size: [300, 150]
    style:
      chart_type: "line"
      color: "var(--lcars-orange)"
      stroke_width: 2
      time_window: "12h"
      show_tooltip: true
```

## Required Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique identifier for the overlay |
| `type` | string | Must be `"apexchart"` |
| `source` | string | DataSource reference (supports dot notation) |
| `position` | array | `[x, y]` coordinates in viewBox space |
| `size` | array | `[width, height]` dimensions in viewBox units |

## Style Properties

### Chart Type

```yaml
style:
  chart_type: "line"  # Options: line, area, bar, pie, donut, radar, heatmap, radialBar, rangeBar, polarArea, treemap, rangeArea, scatter, candlestick, boxPlot
```

**Available Chart Types:**
- `line` - Line chart (default)
- `area` - Filled area chart
- `bar` - Vertical bar chart
- `pie` - Pie chart
- `donut` - Donut chart
- `radar` - Radar/spider chart
- `heatmap` - Heat map visualization
- `radialBar` - Radial gauge chart
- `rangeBar` - Horizontal timeline chart
- `polarArea` - Polar area chart
- `treemap` - Hierarchical treemap
- `rangeArea` - Range area chart
- `scatter` - Scatter plot
- `candlestick` - Financial candlestick chart
- `boxPlot` - Box plot chart

### Line Styling

```yaml
style:
  color: "var(--lcars-blue)"
  stroke_width: 3
  smoothing_mode: "smooth"  # Options: none, smooth, stepped
  line_cap: "round"         # Options: round, square, butt
  dash_array: 0             # For dashed lines (e.g., 5)
```

**Smoothing Modes:**
- `none` / `linear` - Straight lines between points
- `smooth` / `bezier` / `spline` - Smooth curves
- `stepped` - Step-line chart

### Fill Styling (Area Charts)

```yaml
style:
  chart_type: "area"
  fill: "var(--lcars-blue)"
  fill_opacity: 0.3
  fill_gradient:
    type: "vertical"
    stops:
      - offset: 0
        color: "var(--lcars-blue)"
        opacity: 0.8
      - offset: 100
        color: "var(--lcars-blue)"
        opacity: 0.1
```

### Data Points

```yaml
style:
  show_points: true
  point_size: 4
  point_color: "var(--lcars-orange)"
```

### Data Labels

```yaml
style:
  show_values: true
  value_format: "{value}°C"  # Custom format string
```

### Time Window & Performance

```yaml
style:
  time_window: "24h"    # Show last 24 hours of data
  max_points: 500       # Limit data points for performance
```

**Time Window Formats:**
- Seconds: `"30s"`, `"45s"`
- Minutes: `"5m"`, `"30m"`
- Hours: `"1h"`, `"6h"`, `"12h"`, `"24h"`
- Days: `"7d"`, `"30d"`

### Grid & Axes

```yaml
style:
  show_grid: true
  grid_vertical: true
  grid_horizontal: true
  grid_color: "var(--lcars-gray)"
  grid_opacity: 0.4

  show_axis: true
  show_labels: true
  label_color: "var(--lcars-white)"
  label_font_size: "10px"
  axis_color: "var(--lcars-gray)"

  min_value: 0           # Y-axis minimum
  max_value: 100         # Y-axis maximum
```

### Tooltip

```yaml
style:
  show_tooltip: true
  tooltip_time_format: "HH:mm:ss"
```

### Thresholds

```yaml
style:
  zero_line: true
  zero_line_color: "var(--lcars-gray)"

  thresholds:
    - value: 70
      color: "var(--lcars-orange)"
      dash: true
      width: 2
      label: "Warning"
      opacity: 0.7
    - value: 90
      color: "var(--lcars-red)"
      label: "Critical"
```

**Threshold Properties:**
- `value` (required) - Y-axis value for the line
- `color` - Line color (default: red)
- `width` - Line width (default: 2)
- `dash` - Use dashed line (default: false)
- `label` - Text label for the threshold
- `opacity` - Line opacity (default: 0.7)

### Interactivity

```yaml
style:
  enable_zoom: true
  enable_pan: true
  enable_selection: true
  show_toolbar: false
```

### Legend

```yaml
style:
  show_legend: true
  legend_position: "top"        # Options: top, bottom, left, right
  legend_font_size: "12px"
  legend_color: "var(--lcars-white)"
```

### Animation

```yaml
style:
  animatable: true
  animation_speed: 800          # Milliseconds
```

## Animation Presets

ApexCharts supports **pre-configured animation profiles** that control how charts appear and update. Animation presets provide consistent, LCARS-appropriate motion without manual configuration.

### Available Animation Presets

| Preset | Speed | Gradual Delay | Update Speed | Best For |
|--------|-------|---------------|--------------|----------|
| `lcars_standard` | 800ms | 150ms | 350ms | Default - balanced performance |
| `lcars_dramatic` | 1200ms | 200ms | 500ms | Important displays, status changes |
| `lcars_minimal` | 400ms | None | 200ms | Secondary displays, quick updates |
| `lcars_realtime` | Disabled | None | 100ms | Live sensor feeds, high-frequency data |
| `lcars_alert` | 600ms | 100ms | 250ms | Attention-grabbing, warnings |
| `none` | Disabled | None | Disabled | Accessibility, performance-critical |

### Using Animation Presets

Add the `animation_preset` property to your overlay configuration:

```yaml
overlays:
  - id: my_chart
    type: apexchart
    template: "sensor_monitor"
    animation_preset: "lcars_standard"  # ✨ Apply preset
    source: temperature
    position: [50, 100]
    size: [300, 150]
```

### Animation Preset Examples

#### Example 1: Dramatic Entrance (Important Displays)

Use `lcars_dramatic` for critical system displays that need emphasis.

```yaml
overlays:
  - id: warp_core_status
    type: apexchart
    template: "power_monitor"
    animation_preset: "lcars_dramatic"  # 1200ms cinematic entrance
    source: warp_core_power
    position: [50, 100]
    size: [400, 200]
```

**Effect:** Chart smoothly animates in over 1.2 seconds with gradual delay between series.

---

#### Example 2: Realtime Data (Live Feeds)

Use `lcars_realtime` for high-frequency updating data.

```yaml
overlays:
  - id: network_traffic
    type: apexchart
    template: "sensor_monitor"
    animation_preset: "lcars_realtime"  # No entrance, fast updates
    source: live_network_data
    position: [50, 100]
    size: [300, 150]
```

**Effect:** No initial animation, data points update instantly (100ms transitions).

---

#### Example 3: Alert Display (Attention-Grabbing)

Use `lcars_alert` for warning or critical status displays.

```yaml
overlays:
  - id: shield_warning
    type: apexchart
    template: "gauge_radial"
    animation_preset: "lcars_alert"  # Quick, attention-grabbing
    source: shield_status
    position: [50, 100]
    size: [200, 200]
```

**Effect:** Fast 600ms entrance with quick updates, draws attention without being jarring.

---

#### Example 4: Minimal Animation (Performance)

Use `lcars_minimal` for secondary displays or performance-constrained environments.

```yaml
overlays:
  - id: secondary_temp
    type: apexchart
    template: "sensor_monitor"
    animation_preset: "lcars_minimal"  # Quick, subtle
    source: secondary_temperature
    position: [370, 100]
    size: [300, 150]
```

**Effect:** Brief 400ms entrance, faster updates (200ms).

---

#### Example 5: No Animation (Accessibility)

Use `none` for accessibility needs or when animations cause issues.

```yaml
overlays:
  - id: static_chart
    type: apexchart
    template: "comparison_bar"
    animation_preset: "none"  # Completely disabled
    source: resource_data
    position: [50, 100]
    size: [300, 150]
```

**Effect:** Chart appears instantly, no transitions on updates.

---

### Combining Presets with Templates

Animation presets work seamlessly with chart templates:

```yaml
overlays:
  # Template provides chart configuration
  # Preset provides animation behavior
  - id: sensor_display
    type: apexchart
    template: "sensor_monitor"          # Chart appearance
    animation_preset: "lcars_standard"  # Animation behavior
    source: temperature
    position: [50, 100]
    size: [300, 150]
```

**Benefit:** Separate concerns - templates define *what* the chart looks like, presets define *how* it animates.

---

### Overriding Animation Presets

You can override preset values using `chart_options`:

```yaml
overlays:
  - id: custom_animation
    type: apexchart
    template: "sensor_monitor"
    animation_preset: "lcars_standard"  # Base: 800ms
    source: temperature
    position: [50, 100]
    size: [300, 150]
    style:
      chart_options:
        chart:
          animations:
            speed: 1500  # Override: 800ms → 1500ms
            easing: "easeout"  # Override easing
```

**Precedence:** `chart_options` > `animation_preset` > defaults

---

### Animation Preset Behavior Details

#### LCARS Standard (Default)

```yaml
animation_preset: "lcars_standard"
```

**Characteristics:**
- Entrance: 800ms smooth animation
- Gradual delay: 150ms between series
- Update speed: 350ms for data changes
- Easing: `easeinout` (smooth acceleration/deceleration)

**Use when:** You want balanced, professional animation for most displays.

---

#### LCARS Dramatic (Cinematic)

```yaml
animation_preset: "lcars_dramatic"
```

**Characteristics:**
- Entrance: 1200ms slow, cinematic animation
- Gradual delay: 200ms between series
- Update speed: 500ms for data changes
- Easing: `easeout` (starts fast, slows down)

**Use when:** Chart represents critical data or important status changes.

---

#### LCARS Minimal (Quick)

```yaml
animation_preset: "lcars_minimal"
```

**Characteristics:**
- Entrance: 400ms fast animation
- Gradual delay: Disabled
- Update speed: 200ms for data changes
- Easing: `easein` (starts slow, speeds up)

**Use when:** Chart is secondary or you need quick responsiveness.

---

#### LCARS Realtime (Live Data)

```yaml
animation_preset: "lcars_realtime"
```

**Characteristics:**
- Entrance: **Disabled** (appears instantly)
- Gradual delay: Disabled
- Update speed: 100ms for data changes
- Easing: `linear`

**Use when:** Displaying live sensor feeds, network traffic, or high-frequency data.

---

#### LCARS Alert (Attention)

```yaml
animation_preset: "lcars_alert"
```

**Characteristics:**
- Entrance: 600ms attention-grabbing animation
- Gradual delay: 100ms between series
- Update speed: 250ms for data changes
- Easing: `easeout`

**Use when:** Displaying warnings, alerts, or status that requires attention.

---

#### None (Disabled)

```yaml
animation_preset: "none"
```

**Characteristics:**
- Entrance: **Disabled**
- Gradual delay: Disabled
- Update speed: **Disabled** (instant)
- Easing: `linear`

**Use when:**
- Accessibility needs (motion sensitivity)
- Performance-critical environments
- Testing/debugging
- Static displays that don't need animation

---

### Animation Preset Best Practices

#### 1. Match Preset to Data Frequency

```yaml
# High-frequency data (updates every second)
- animation_preset: "lcars_realtime"

# Medium-frequency data (updates every 5-10 seconds)
- animation_preset: "lcars_standard"

# Low-frequency data (updates every minute+)
- animation_preset: "lcars_dramatic"
```

#### 2. Consider Display Hierarchy

```yaml
# Primary display (user's focus)
- animation_preset: "lcars_dramatic"

# Secondary displays (context)
- animation_preset: "lcars_standard"

# Tertiary displays (background info)
- animation_preset: "lcars_minimal"
```

#### 3. Respect User Preferences

```yaml
# For users with motion sensitivity
- animation_preset: "none"

# Or use minimal animation
- animation_preset: "lcars_minimal"
```

#### 4. Performance Considerations

```yaml
# Many charts on one page
- animation_preset: "lcars_minimal"  # or "none"

# Complex charts (many data points)
- animation_preset: "lcars_realtime"  # Fast updates

# Simple charts (few data points)
- animation_preset: "lcars_standard"  # Full animation
```

---

### Testing Animation Presets

Try all presets to find the right feel for your display:

```yaml
overlays:
  # Test: Standard (800ms)
  - id: test_standard
    type: apexchart
    template: "sensor_monitor"
    animation_preset: "lcars_standard"
    source: test_data
    position: [50, 50]
    size: [300, 150]

  # Test: Dramatic (1200ms)
  - id: test_dramatic
    type: apexchart
    template: "sensor_monitor"
    animation_preset: "lcars_dramatic"
    source: test_data
    position: [50, 220]
    size: [300, 150]

  # Test: Minimal (400ms)
  - id: test_minimal
    type: apexchart
    template: "sensor_monitor"
    animation_preset: "lcars_minimal"
    source: test_data
    position: [50, 390]
    size: [300, 150]

  # Test: Realtime (no entrance)
  - id: test_realtime
    type: apexchart
    template: "sensor_monitor"
    animation_preset: "lcars_realtime"
    source: test_data
    position: [50, 560]
    size: [300, 150]
```

**Tip:** Reload the page to see entrance animations, then watch data updates to see update animations.

---

### Troubleshooting Animation Presets

#### Animation Not Working

**Symptom:** Chart appears instantly despite preset

**Solutions:**
1. Check preset name is correct (case-sensitive)
2. Ensure `animatable: false` is not set in style
3. Verify pack with presets is loaded (`builtin_themes`)
4. Check browser console for preset loading errors

```yaml
# ❌ Wrong
animation_preset: "LCARS_Standard"  # Wrong case

# ✅ Correct
animation_preset: "lcars_standard"
```

---

#### Animation Too Slow/Fast

**Solution:** Override with `chart_options`

```yaml
style:
  animation_preset: "lcars_standard"
  chart_options:
    chart:
      animations:
        speed: 500  # Adjust speed
```

---

#### Animation Causing Performance Issues

**Solution:** Use lighter preset or disable

```yaml
# Option 1: Lighter preset
animation_preset: "lcars_minimal"

# Option 2: Realtime (fast updates only)
animation_preset: "lcars_realtime"

# Option 3: Completely disable
animation_preset: "none"
```

---

## Complete Example

```yaml
data_sources:
  temperature_enhanced:
    entity: sensor.outdoor_temperature
    windowSeconds: 3600
    transformations:
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"

overlays:
  - id: temperature_chart
    type: apexchart
    source: temperature_enhanced.transformations.celsius
    position: [50, 100]
    size: [300, 150]
    style:
      chart_type: "line"
      color: "var(--lcars-blue)"
      stroke_width: 3
      smoothing_mode: "smooth"

      # Time window
      time_window: "12h"
      max_points: 500

      # Display
      show_grid: true
      show_axis: true
      show_labels: true
      show_tooltip: true

      # Thresholds
      thresholds:
        - value: 25
          color: "var(--lcars-orange)"
          label: "Warning"
          dash: true
        - value: 35
          color: "var(--lcars-red)"
          width: 3
          label: "Critical"

      # Interactivity
      enable_zoom: true
      enable_pan: true
```

## DataSource Integration

### Basic DataSource Reference

```yaml
overlays:
  - id: my_chart
    type: apexchart
    source: temperature_sensor  # Simple reference
```

### Transformation Access (Dot Notation)

```yaml
overlays:
  - id: my_chart
    type: apexchart
    source: temperature_sensor.transformations.celsius  # Access transformed data
```

### Multiple Transformations

```yaml
data_sources:
  temperature:
    entity: sensor.outdoor_temperature
    transformations:
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"

overlays:
  # Raw data chart
  - id: raw_chart
    type: apexchart
    source: temperature
    position: [50, 100]
    size: [300, 100]
    style:
      chart_type: "line"
      color: "var(--lcars-gray)"

  # Converted data chart
  - id: celsius_chart
    type: apexchart
    source: temperature.transformations.celsius
    position: [50, 220]
    size: [300, 100]
    style:
      chart_type: "line"
      color: "var(--lcars-blue)"

  # Smoothed data chart
  - id: smoothed_chart
    type: apexchart
    source: temperature.transformations.smoothed
    position: [50, 340]
    size: [300, 100]
    style:
      chart_type: "area"
      color: "var(--lcars-orange)"
```

## Chart Type Examples

### Line Chart

```yaml
overlays:
  - id: line_chart
    type: apexchart
    source: temperature_sensor
    position: [50, 100]
    size: [300, 150]
    style:
      chart_type: "line"
      color: "var(--lcars-blue)"
      stroke_width: 2
      smoothing_mode: "smooth"
      show_points: false
```

### Area Chart

```yaml
overlays:
  - id: area_chart
    type: apexchart
    source: power_meter
    position: [50, 270]
    size: [300, 150]
    style:
      chart_type: "area"
      color: "var(--lcars-yellow)"
      fill_opacity: 0.3
      stroke_width: 2
      zero_line: true
```

### Bar Chart

```yaml
overlays:
  - id: bar_chart
    type: apexchart
    source: energy_daily
    position: [50, 440]
    size: [300, 150]
    style:
      chart_type: "bar"
      color: "var(--lcars-green)"
      show_values: true
      show_grid: false
```

### Pie Chart

```yaml
overlays:
  - id: pie_chart
    type: apexchart
    source: resource_allocation
    position: [50, 610]
    size: [300, 150]
    style:
      chart_type: "pie"
      colors:
        - "var(--lcars-blue)"
        - "var(--lcars-green)"
        - "var(--lcars-orange)"
        - "var(--lcars-red)"
      show_labels: true
```

### Donut Chart

```yaml
overlays:
  - id: donut_chart
    type: apexchart
    source: resource_allocation
    position: [50, 780]
    size: [300, 150]
    style:
      chart_type: "donut"
      colors:
        - "var(--lcars-blue)"
        - "var(--lcars-green)"
        - "var(--lcars-orange)"
        - "var(--lcars-red)"
      show_labels: true
```

### Radar Chart

```yaml
overlays:
  - id: radar_chart
    type: apexchart
    source: multi_sensor_data
    position: [400, 100]
    size: [300, 150]
    style:
      chart_type: "radar"
      colors:
        - "var(--lcars-blue)"
        - "var(--lcars-green)"
        - "var(--lcars-orange)"
        - "var(--lcars-red)"
      show_labels: true
```

### Heatmap Chart

```yaml
overlays:
  - id: heatmap_chart
    type: apexchart
    source: activity_schedule
    position: [400, 270]
    size: [300, 150]
    style:
      chart_type: "heatmap"
      colors:
        - "var(--lcars-blue)"
        - "var(--lcars-green)"
        - "var(--lcars-yellow)"
        - "var(--lcars-orange)"
        - "var(--lcars-red)"
      show_labels: true
```

### RadialBar (Gauge) Chart

Perfect for gauges, progress indicators, and completion percentages.

```yaml
overlays:
  - id: shield_gauge
    type: apexchart
    source: shield_strength
    position: [50, 100]
    size: [200, 200]
    style:
      chart_type: "radialBar"
      color: "var(--lcars-blue)"
      value_format: "percent"     # Show as percentage
      gauge_start_angle: -90      # Gauge start angle (degrees)
      gauge_end_angle: 90         # Gauge end angle (degrees)
      show_labels: true
```

**RadialBar-Specific Options:**
- `value_format`: `"percent"` or `"number"` (default: number)
- `gauge_start_angle`: Start angle in degrees (default: -90)
- `gauge_end_angle`: End angle in degrees (default: 90)

### RangeBar (Timeline) Chart

Ideal for schedules, duty rosters, and timelines.

```yaml
overlays:
  - id: maintenance_schedule
    type: apexchart
    source: maintenance_events
    position: [50, 100]
    size: [400, 200]
    style:
      chart_type: "rangeBar"
      group_rows: true            # Group similar items
      show_labels: true           # Show event labels
      show_legend: true
```

**RangeBar-Specific Options:**
- `group_rows`: Group rows by category (default: true)
- `show_labels`: Display labels on bars (default: true)

**Data Format for RangeBar:**
```yaml
# DataSource should provide data in format:
# [
#   {
#     x: "Task 1",
#     y: [startTimestamp, endTimestamp]
#   },
#   {
#     x: "Task 2",
#     y: [startTimestamp, endTimestamp]
#   }
# ]
```

### PolarArea Chart

Great for directional data and sensor arrays.

```yaml
overlays:
  - id: sensor_coverage
    type: apexchart
    source: sensor_array
    position: [50, 100]
    size: [250, 250]
    style:
      chart_type: "polarArea"
      colors:
        - "var(--lcars-blue)"
        - "var(--lcars-green)"
        - "var(--lcars-orange)"
        - "var(--lcars-red)"
      legend_position: "bottom"
```

### Treemap Chart

Perfect for hierarchical data and resource allocation.

```yaml
overlays:
  - id: system_resources
    type: apexchart
    source: resource_allocation
    position: [50, 100]
    size: [400, 300]
    style:
      chart_type: "treemap"
      colors:
        - "var(--lcars-blue)"
        - "var(--lcars-green)"
        - "var(--lcars-orange)"
        - "var(--lcars-red)"
      show_labels: true
```

**Data Format for Treemap:**
```yaml
# DataSource should provide data in format:
# [
#   { x: "Category A", y: 100 },
#   { x: "Category B", y: 200 },
#   { x: "Category C", y: 150 }
# ]
```

### RangeArea Chart

Ideal for confidence intervals and acceptable parameter ranges.

```yaml
overlays:
  - id: temperature_range
    type: apexchart
    source: temperature_forecast
    position: [50, 100]
    size: [400, 200]
    style:
      chart_type: "rangeArea"
      color: "var(--lcars-blue)"
      fill_opacity: 0.2
      show_legend: true
      legend_position: "top"
```

**Data Format for RangeArea:**
```yaml
# DataSource should provide data in format:
# [
#   {
#     x: timestamp,
#     y: [minValue, maxValue]
#   }
# ]
```

### Scatter Plot

Perfect for correlation analysis and multi-dimensional data.

```yaml
overlays:
  - id: sensor_correlation
    type: apexchart
    source: sensor_data
    position: [50, 100]
    size: [400, 300]
    style:
      chart_type: "scatter"
      marker_size: 6              # Point size
      show_grid: true             # Show background grid
      colors:
        - "var(--lcars-blue)"
        - "var(--lcars-orange)"
```

**Scatter-Specific Options:**
- `marker_size`: Size of data point markers (default: 6)
- `show_grid`: Display background grid (default: true)

**Data Format for Scatter:**
```yaml
# DataSource should provide data in format:
# [
#   { x: value1, y: value2 },
#   { x: value3, y: value4 }
# ]
```

### Candlestick Chart

For financial data or energy fluctuation analysis.

```yaml
overlays:
  - id: energy_fluctuations
    type: apexchart
    source: energy_prices
    position: [50, 100]
    size: [400, 250]
    style:
      chart_type: "candlestick"
      colors:
        upward: "var(--lcars-green)"      # Positive change color
        downward: "var(--lcars-red)"      # Negative change color
```

**Data Format for Candlestick:**
```yaml
# DataSource should provide OHLC data:
# [
#   {
#     x: timestamp,
#     y: [open, high, low, close]
#   }
# ]
```

### BoxPlot Chart

For statistical distributions and sensor data analysis.

```yaml
overlays:
  - id: sensor_distribution
    type: apexchart
    source: sensor_stats
    position: [50, 100]
    size: [400, 250]
    style:
      chart_type: "boxPlot"
      color: "var(--lcars-blue)"
```

**Data Format for BoxPlot:**
```yaml
# DataSource should provide statistical data:
# [
#   {
#     x: "Sensor 1",
#     y: [min, q1, median, q3, max]
#   }
# ]
```

## Chart Type Quick Reference

### When to Use Each Type

**Time Series & Trends:**
- `line` - Simple time series
- `area` - Time series with emphasis on volume/magnitude
- `rangeArea` - Time series with uncertainty/ranges

**Comparisons:**
- `bar` - Compare discrete categories
- `rangeBar` - Compare time periods/schedules

**Part-to-Whole:**
- `pie` - Simple proportions (< 7 categories)
- `donut` - Proportions with center label
- `treemap` - Hierarchical proportions

**Gauges & Progress:**
- `radialBar` - Circular gauges, completion %

**Multi-Dimensional:**
- `radar` - Compare multiple metrics
- `polarArea` - Directional data with magnitude

**Statistical:**
- `scatter` - Correlations, distributions
- `boxPlot` - Statistical distributions
- `heatmap` - Two-dimensional patterns

**Financial/Fluctuation:**
- `candlestick` - OHLC data with trends

## Migration from Sparkline

If you're migrating from the deprecated `sparkline` overlay type:

### Old (Sparkline)

```yaml
- id: temp_sparkline
  type: sparkline
  source: temperature_sensor
  position: [50, 100]
  size: [300, 50]
  style:
    color: "var(--lcars-blue)"
    width: 2
```

### New (ApexCharts)

```yaml
- id: temp_chart
  type: apexchart
  source: temperature_sensor
  position: [50, 100]
  size: [300, 50]
  style:
    chart_type: "line"
    color: "var(--lcars-blue)"
    stroke_width: 2
    show_grid: false
    show_axis: false
    show_tooltip: false
    time_window: "1h"
```

## Migration from History Bar

If you're migrating from the deprecated `history_bar` overlay type:

### Old (History Bar)

```yaml
- id: power_history
  type: history_bar
  source: power_meter
  position: [50, 270]
  size: [300, 100]
```

### New (ApexCharts)

```yaml
- id: power_chart
  type: apexchart
  source: power_meter
  position: [50, 270]
  size: [300, 100]
  style:
    chart_type: "area"
    color: "var(--lcars-yellow)"
    fill_opacity: 0.3
    time_window: "24h"
    show_grid: true
    zero_line: true
```

## Performance Tips

1. **Limit Data Points**: Use `max_points` to prevent rendering thousands of points
   ```yaml
   style:
     max_points: 500
   ```

2. **Use Time Windows**: Only show recent data
   ```yaml
   style:
     time_window: "12h"
   ```

3. **Disable Animations**: For better performance on slow devices
   ```yaml
   style:
     animatable: false
   ```

4. **Hide Unnecessary UI**: Disable features you don't need
   ```yaml
   style:
     show_grid: false
     show_axis: false
     show_labels: false
     show_tooltip: false
   ```

## Troubleshooting

### Chart Not Rendering

1. **Check DataSource**: Verify your DataSource has data
   ```yaml
   # Look in Home Assistant Developer Tools > States
   # Or check MSD debug panel
   ```

2. **Verify Positioning**: Ensure position and size are within viewBox
   ```yaml
   position: [50, 100]  # Within viewBox bounds
   size: [300, 150]     # Reasonable size
   ```

3. **Check Console**: Look for errors in browser console

### Chart Not Updating

1. **Verify DataSource Subscription**: Charts automatically subscribe to DataSource updates
2. **Check HASS Connection**: Ensure Home Assistant connection is active
3. **Check Time Window**: Ensure time_window includes recent data

### Poor Performance

1. **Reduce Data Points**:
   ```yaml
   style:
     max_points: 200  # Lower limit
   ```

2. **Narrow Time Window**:
   ```yaml
   style:
     time_window: "6h"  # Shorter window
   ```

3. **Disable Animations**:
   ```yaml
   style:
     animatable: false
   ```

## Related Documentation

- [DataSource System](../data-sources.md) - Understanding data sources
- [Transformations](../transformations.md) - Data transformation options
- [Overlay Basics](./README.md) - General overlay documentation
- [Text Overlays](./text.md) - For labels and annotations
- [Line Overlays](./line.md) - For connecting charts to labels

## Advanced Examples

### Multi-Threshold Temperature Chart

```yaml
overlays:
  - id: advanced_temp_chart
    type: apexchart
    source: temperature.transformations.celsius
    position: [50, 100]
    size: [400, 200]
    style:
      chart_type: "area"
      color: "var(--lcars-blue)"
      fill_opacity: 0.2
      stroke_width: 3
      smoothing_mode: "smooth"

      time_window: "24h"
      max_points: 500

      show_grid: true
      show_axis: true
      show_labels: true
      show_tooltip: true

      zero_line: false
      thresholds:
        - value: 15
          color: "var(--lcars-blue)"
          label: "Cold"
          opacity: 0.5
        - value: 20
          color: "var(--lcars-green)"
          label: "Comfortable"
        - value: 25
          color: "var(--lcars-orange)"
          label: "Warm"
          dash: true
        - value: 30
          color: "var(--lcars-red)"
          width: 3
          label: "Hot"

      enable_zoom: true
      enable_pan: true
      show_legend: true
```

### Power Usage Area Chart

```yaml
overlays:
  - id: power_usage_chart
    type: apexchart
    source: power_meter.transformations.kilowatts
    position: [50, 320]
    size: [400, 150]
    style:
      chart_type: "area"
      color: "var(--lcars-yellow)"
      fill_gradient:
        type: "vertical"
        stops:
          - offset: 0
            color: "var(--lcars-yellow)"
            opacity: 0.8
          - offset: 100
            color: "var(--lcars-yellow)"
            opacity: 0.1
      stroke_width: 2

      time_window: "7d"
      max_points: 600

      show_grid: true
      zero_line: true
      min_value: 0

      show_tooltip: true
      tooltip_time_format: "MMM dd, HH:mm"
      value_format: "{value} kW"
```

## Advanced ApexCharts Options

For advanced users who need direct access to the full ApexCharts API, you can use the `chart_options` property to pass any ApexCharts configuration options directly.

### Using `chart_options`

The `chart_options` property allows you to:
- Override any MSD-style setting with native ApexCharts configuration
- Access advanced ApexCharts features not exposed via MSD style properties
- Use experimental ApexCharts features

**Important**: Options in `chart_options` will override equivalent MSD-style settings.

### Basic Example

```yaml
overlays:
  - id: advanced_chart
    type: apexchart
    source: temperature_sensor
    position: [50, 100]
    size: [400, 200]
    style:
      # MSD-style options (convenient and validated)
      chart_type: "line"
      color: "var(--lcars-blue)"
      time_window: "12h"

      # Direct ApexCharts options (full API access)
      chart_options:
        plotOptions:
          line:
            isSlopeChart: false
        noData:
          text: "No data available"
          align: "center"
          verticalAlign: "middle"
          style:
            color: "var(--lcars-red)"
            fontSize: "16px"
```

### Advanced Features Examples

#### 1. Custom Plot Options

```yaml
style:
  chart_type: "bar"
  color: "var(--lcars-orange)"

  chart_options:
    plotOptions:
      bar:
        horizontal: true
        borderRadius: 4
        columnWidth: "70%"
        barHeight: "70%"
        distributed: false
        rangeBarOverlap: true
        dataLabels:
          position: "top"
```

#### 2. Advanced Responsive Configuration

```yaml
style:
  chart_type: "line"

  chart_options:
    responsive:
      - breakpoint: 1024
        options:
          chart:
            height: 300
          legend:
            position: "bottom"
      - breakpoint: 768
        options:
          chart:
            height: 200
          xaxis:
            labels:
              show: false
```

#### 3. Custom States (Hover/Active)

```yaml
style:
  chart_type: "line"

  chart_options:
    states:
      normal:
        filter:
          type: "none"
      hover:
        filter:
          type: "lighten"
          value: 0.15
      active:
        filter:
          type: "darken"
          value: 0.35
```

#### 4. Advanced Annotations

```yaml
style:
  chart_type: "area"

  chart_options:
    annotations:
      xaxis:
        - x: 1640995200000  # Specific timestamp
          borderColor: "var(--lcars-red)"
          label:
            text: "Critical Event"
            style:
              color: "#fff"
              background: "var(--lcars-red)"
      points:
        - x: 1640995200000
          y: 100
          marker:
            size: 8
            fillColor: "var(--lcars-yellow)"
            strokeColor: "#fff"
            strokeWidth: 2
          label:
            text: "Peak Value"
```

#### 5. Data Forecasting

```yaml
style:
  chart_type: "line"

  chart_options:
    forecastDataPoints:
      count: 7
      fillOpacity: 0.5
      strokeWidth: 2
      dashArray: 4
```

#### 6. Advanced Tooltip Customization

```yaml
style:
  chart_type: "line"

  chart_options:
    tooltip:
      custom: |
        function({ series, seriesIndex, dataPointIndex, w }) {
          const value = series[seriesIndex][dataPointIndex];
          const timestamp = w.globals.seriesX[seriesIndex][dataPointIndex];
          const date = new Date(timestamp);

          return '<div class="custom-tooltip">' +
            '<span>Time: ' + date.toLocaleTimeString() + '</span><br/>' +
            '<span>Value: ' + value.toFixed(2) + '°C</span>' +
            '</div>';
        }
      cssClass: "apexcharts-custom-tooltip"
```

#### 7. Advanced Chart Subtitle

```yaml
style:
  chart_type: "line"

  chart_options:
    subtitle:
      text: "Last 24 Hours"
      align: "left"
      margin: 10
      offsetX: 0
      offsetY: 0
      floating: false
      style:
        fontSize: "12px"
        fontWeight: "normal"
        color: "var(--lcars-gray)"
```

#### 8. Multiple Y-Axes

```yaml
style:
  chart_type: "line"

  chart_options:
    yaxis:
      - title:
          text: "Temperature (°C)"
        labels:
          style:
            colors: "var(--lcars-blue)"
      - opposite: true
        title:
          text: "Humidity (%)"
        labels:
          style:
            colors: "var(--lcars-green)"
```

#### 9. Custom Brush Chart (Synchronized Zoom)

```yaml
overlays:
  # Main chart
  - id: main_chart
    type: apexchart
    source: temperature_sensor
    position: [50, 100]
    size: [400, 200]
    style:
      chart_type: "line"
      chart_options:
        chart:
          id: "main-chart"
          group: "temp-group"
          brush:
            target: "brush-chart"
            enabled: true

  # Brush chart (mini chart for zoom selection)
  - id: brush_chart
    type: apexchart
    source: temperature_sensor
    position: [50, 320]
    size: [400, 80]
    style:
      chart_type: "line"
      chart_options:
        chart:
          id: "brush-chart"
          brush:
            enabled: true
        xaxis:
          labels:
            show: false
```

#### 10. Advanced Gradient Fills

```yaml
style:
  chart_type: "area"

  chart_options:
    fill:
      type: "gradient"
      gradient:
        shade: "dark"
        type: "vertical"
        shadeIntensity: 0.5
        gradientToColors: ["var(--lcars-blue)", "var(--lcars-purple)"]
        inverseColors: false
        opacityFrom: 0.9
        opacityTo: 0.1
        stops: [0, 50, 100]
        colorStops:
          - offset: 0
            color: "var(--lcars-blue)"
            opacity: 0.9
          - offset: 50
            color: "var(--lcars-purple)"
            opacity: 0.5
          - offset: 100
            color: "var(--lcars-red)"
            opacity: 0.1
```

### Combining MSD Style with chart_options

You can use both MSD-style configuration and `chart_options` together. MSD-style options provide convenience and validation, while `chart_options` gives you full control.

```yaml
overlays:
  - id: hybrid_chart
    type: apexchart
    source: power_meter
    position: [50, 100]
    size: [400, 200]
    style:
      # MSD-style options (convenient defaults)
      chart_type: "area"
      color: "var(--lcars-yellow)"
      time_window: "24h"
      show_grid: true
      show_tooltip: true

      # Direct ApexCharts options (advanced features)
      chart_options:
        # Override or extend specific options
        chart:
          dropShadow:
            enabled: true
            top: 0
            left: 0
            blur: 3
            opacity: 0.5

        # Add features not in MSD-style config
        plotOptions:
          area:
            fillTo: "end"

        # Custom data labels
        dataLabels:
          enabled: true
          formatter: |
            function(val) {
              return val.toFixed(1) + ' kW';
            }
```

### Precedence Rules

When using both MSD-style config and `chart_options`:

1. **MSD-style options** are processed first to generate base configuration
2. **chart_options** are deep-merged into the base configuration
3. **Conflicts**: `chart_options` values take precedence over MSD-style values

**Example:**
```yaml
style:
  color: "var(--lcars-blue)"    # MSD-style sets stroke color
  chart_options:
    stroke:
      colors: ["var(--lcars-red)"]  # chart_options overrides to red
  # Result: Chart will use red color
```

### Available ApexCharts Options

For a complete list of available ApexCharts options, see the [official ApexCharts documentation](https://apexcharts.com/docs/options/).

**Popular advanced options:**
- `plotOptions` - Chart-specific rendering options
- `responsive` - Responsive breakpoints
- `states` - Hover/active/normal states
- `forecastDataPoints` - Data forecasting
- `subtitle` - Chart subtitle
- `noData` - Custom no-data message
- `brush` - Synchronized chart zooming
- Multiple `yaxis` - Multiple Y-axes for multi-series
- Custom `tooltip.custom` - Fully custom tooltips
- `chart.events` - Chart event handlers (onDatasetHover, etc.)

### Important Notes

⚠️ **JavaScript Functions**: Some ApexCharts options accept JavaScript functions (e.g., `tooltip.custom`, `dataLabels.formatter`). These must be provided as strings in YAML and will be evaluated.

⚠️ **Validation**: Options passed via `chart_options` bypass MSD validation. Ensure values are correct to avoid rendering errors.

⚠️ **Version Compatibility**: Advanced features depend on the ApexCharts version. Check [ApexCharts changelog](https://github.com/apexcharts/apexcharts.js/releases) for feature availability.

## See Also

- [ApexCharts Official Documentation](https://apexcharts.com/docs/) - Full ApexCharts API reference
- [ApexCharts Examples](https://apexcharts.com/javascript-chart-demos/) - Interactive examples
- [ApexCharts GitHub](https://github.com/apexcharts/apexcharts.js) - Source code and issues
