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
- **Current value integration**: Always includes the latest DataSource value in real-time
- **Smart time bucketing**: Automatically adjusts time windows to include current data

### Real-time Update Behavior
The history bar renderer includes special handling for real-time data updates:

**Current Value Integration**: When DataSource values change, the history bar automatically:
1. Extracts the current value and timestamp from the DataSource
2. Updates existing data points with the same timestamp or adds new ones
3. Ensures the current value is always included in the visualization
4. Recalculates scaling and bucket aggregation with the latest data

**Time Bucket Handling**: To prevent current data from being lost:
- Time windows are automatically adjusted to include the latest data timestamp
- When multiple values exist in the same time bucket, intelligent aggregation prevents averaging artifacts
- The "latest" aggregation mode ensures real-time changes are immediately visible

**Example Real-time Behavior**:
```
Initial State: Sensor value = 25°C
History Bar: Shows bar at 25°C height

Value Changes: Sensor value = 85°C
History Bar: Immediately shows bar at 85°C height (not averaged with previous values)
```

---

## ✅ **Enhanced Axis & Grid Features**

Both **grid lines** and **axis lines** are now fully configurable with independent styling options:

### **🎛️ Complete Grid & Axis Control:**

```yaml
style:
  # Grid Configuration
  show_grid: true                   # Enable background grid
  grid_color: "var(--lcars-gray)"   # Grid line color
  grid_opacity: 0.6                 # Grid transparency (0-1)
  grid_width: 1                     # Grid line thickness

  # Axis Configuration
  show_axis: true                   # Enable axis lines
  axis_color: "var(--lcars-blue)"   # Axis line color
  axis_width: 2                     # Axis line thickness

  # Orientation affects which axes are drawn
  orientation: "horizontal"         # horizontal: bottom + left axes
                                   # vertical: left + bottom axes
```

### **🔍 Axis Behavior by Orientation:**

**Horizontal Bars** (`orientation: "horizontal"`):
- **Bottom Axis**: Time reference line
- **Left Axis**: Value reference line

**Vertical Bars** (`orientation: "vertical"`):
- **Left Axis**: Time reference line
- **Bottom Axis**: Value reference line

### **📊 Visual Hierarchy Strategies:**

**Subtle Background Grid with Prominent Axes:**
```yaml
style:
  show_grid: true
  grid_opacity: 0.3                 # Faint grid
  grid_width: 0.5

  show_axis: true
  axis_color: "var(--lcars-orange)"
  axis_width: 3                     # Strong axes
```

**Technical Grid with Minimal Axes:**
```yaml
style:
  show_grid: true
  grid_color: "var(--lcars-blue)"
  grid_opacity: 0.7                 # Prominent grid
  grid_width: 1

  show_axis: true
  axis_color: "var(--lcars-gray)"
  axis_width: 1                     # Subtle axes
```

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
  grid_opacity: 0.6               # Grid transparency (0-1, default: 0.6)
  grid_width: 1                   # Grid line thickness in pixels (default: 1)

  show_axis: true                 # Show axis lines
  axis_color: "var(--lcars-gray)" # Axis color
  axis_width: 2                   # Axis line thickness in pixels (default: 2)
```

### 💡 Recommended Label Configurations:

**Basic Time Labels:**
```yaml
style:
  show_labels: true
  label_color: "var(--lcars-white)"
  label_font_size: 10
```

**Enhanced Time Labels:**
```yaml
style:
  show_labels: true
  label_color: "var(--lcars-blue)"
  label_font_size: 12
  label_font_weight: "bold"
  label_opacity: 0.9
```

**Value Labels on Bars:**
```yaml
style:
  show_values: true
  value_color: "var(--lcars-yellow)"
  value_font_size: 8
  value_font_weight: "bold"
  value_format: "{value:.1f}"     # One decimal place
```

**Both Labels with Different Styling:**
```yaml
style:
  # Time labels
  show_labels: true
  label_color: "var(--lcars-gray)"
  label_font_size: 9
  label_font_weight: "normal"

  # Value labels
  show_values: true
  value_color: "var(--lcars-orange)"
  value_font_size: 10
  value_font_weight: "bold"
  value_format: "{value:k}"       # Kilos format (1000 -> 1.0k)
```

**Custom Typography:**
```yaml
style:
  show_labels: true
  show_values: true

  # Custom fonts
  label_font_family: "Arial, sans-serif"
  value_font_family: "Courier New, monospace"

  # Custom colors
  label_color: "#00FFFF"
  value_color: "#FFAA00"
```

### 🎯 **Value Format Options:**

**Template Formats:**
```yaml
value_format: "{value}"          # Raw value: 1234.56
value_format: "{value:.1f}"      # 1 decimal: 1234.6
value_format: "{value:.0f}"      # No decimals: 1235
value_format: "{value:%}"        # Percentage: 1234.56%
value_format: "{value:k}"        # Kilos: 1.2k
value_format: "{value:M}"        # Millions: 1.2M
```

**Preset Formats:**
```yaml
value_format: "int"              # Integer: 1235
value_format: "float"            # Float: 1234.56
value_format: "percent"          # Percentage: 1234.56%
value_format: "currency"         # Currency: $1234.56
```

### 💡 Recommended Axis Configurations:

**Subtle Axes:**
```yaml
style:
  show_axis: true
  axis_color: "var(--lcars-gray)"
  axis_width: 1
```

**Prominent Axes:**
```yaml
style:
  show_axis: true
  axis_color: "var(--lcars-blue)"
  axis_width: 3
```

**Combined with Grid (Different Weights):**
```yaml
style:
  show_grid: true
  show_axis: true
  grid_color: "var(--lcars-gray)"
  grid_width: 1                     # Thin grid lines
  axis_color: "var(--lcars-blue)"
  axis_width: 2                     # Thicker axis lines
```

**Strong LCARS Look:**
```yaml
style:
  show_axis: true
  axis_color: "var(--lcars-orange)"
  axis_width: 4
```

### 💡 Recommended Grid Configurations:

**Subtle Grid:**
```yaml
style:
  show_grid: true
  grid_color: "var(--lcars-gray)"
  grid_opacity: 0.4
  grid_width: 0.5
```

**Prominent Grid:**
```yaml
style:
  show_grid: true
  grid_color: "var(--lcars-blue)"
  grid_opacity: 0.8
  grid_width: 1.5
```

**LCARS Technical Look:**
```yaml
style:
  show_grid: true
  grid_color: "var(--lcars-orange)"
  grid_opacity: 0.6
  grid_width: 1
```

#### 💡 Recommended Bracket Configurations:

**Basic LCARS Brackets:**
```yaml
style:
  bracket_style: true             # Enable with default LCARS style
  bracket_color: "var(--lcars-orange)"
```

**Custom LCARS Style:**
```yaml
style:
  bracket_style: "lcars"
  bracket_color: "var(--lcars-blue)"
  bracket_width: 3
  bracket_gap: 6
  bracket_extension: 12
```

**Square Technical Brackets:**
```yaml
style:
  bracket_style: "square"
  bracket_color: "var(--lcars-gray)"
  bracket_width: 2
  bracket_opacity: 0.8
```

**Rounded Modern Brackets:**
```yaml
style:
  bracket_style: "rounded"
  bracket_color: "var(--lcars-green)"
  bracket_gap: 8
```

**Extended Professional Brackets:**
```yaml
style:
  bracket_style: "extended"
  bracket_color: "var(--lcars-yellow)"
  bracket_width: 2
  bracket_extension: 16
```

**Minimal Corner Brackets:**
```yaml
style:
  bracket_style: "minimal"
  bracket_corners: "both"         # Show all corners
  bracket_sides: "both"           # Both left and right
```

**Asymmetric Brackets:**
```yaml
style:
  bracket_style: "lcars"
  bracket_sides: "left"           # Only left bracket
  bracket_corners: "top"          # Only top corners
```

**With Status Indicator:**
```yaml
style:
  bracket_style: "lcars"
  bracket_color: "var(--lcars-blue)"
  status_indicator: "var(--lcars-green)"  # Colored status dot
```

### 🎯 **Bracket Style Options:**

| Style | Description | Best For |
|-------|-------------|----------|
| `lcars` | Classic Star Trek LCARS style | Authentic LCARS look |
| `square` | Clean rectangular brackets | Technical interfaces |
| `rounded` | Smooth curved brackets | Modern designs |
| `extended` | Long brackets with details | Professional dashboards |
| `minimal` | Corner-only brackets | Subtle accents |
| `bg-grid` | Sophisticated rounded brackets | High-end interfaces |
| `lcars-container` | Full LCARS borders with elbows | Complete interface containers |
| `lcars-header` | Header-style with top and left borders | Section headers |
| `lcars-elbow` | Single corner elbow element | Accent corners |

> **Note**: These bracket styles are available across **all overlay types** that support brackets: History Bar, Sparkline, Status Grid, and Text overlays all use the same unified bracket system.

### 🏗️ **LCARS Container Styling:**

For authentic Star Trek interface containers, use the new container styles:

```yaml
style:
  bracket_style: "lcars-container"
  border_top: 20           # Thick top border
  border_left: 90          # Prominent left elbow
  border_color: "var(--lcars-orange)"
  border_radius: 8         # Corner rounding
  inner_factor: 2          # Inner border depth effect
  hybrid_mode: false       # true = add bracket arms too
```

**Container Style Examples:**
- **lcars-container**: Full borders (top, left, right, bottom as configured)
- **lcars-header**: Header styling (top + left borders, like cb-lcars-header template)
- **lcars-elbow**: Single corner accent (position via `corners: "top-left"`)

### 💡 **Hybrid Mode:**
Set `hybrid_mode: true` to combine full borders with traditional bracket arms for maximum visual impact!

**BG-Grid Style Brackets (Sophisticated):**
```yaml
style:
  bracket_style: "bg-grid"
  bracket_color: "var(--lcars-yellow)"
  bracket_physical_width: 16      # Width of bracket arms
  bracket_height: "80%"           # 80% of chart height
  bracket_radius: 8               # Rounded corners
  bracket_gap: 6                  # Distance from chart
```

**BG-Grid with Custom Dimensions:**
```yaml
style:
  bracket_style: "bg-grid"
  bracket_physical_width: 20      # Thick bracket arms
  bracket_height: 60              # Fixed 60px height
  bracket_radius: 12              # Large rounded corners
  bracket_color: "var(--lcars-orange)"
  bracket_width: 3                # Stroke thickness
```

**Classic vs Modern Comparison:**
```yaml
# Classic LCARS style
style:
  bracket_style: "lcars"
  bracket_extension: 12
  bracket_color: "var(--lcars-blue)"

# Modern BG-Grid style
style:
  bracket_style: "bg-grid"
  bracket_physical_width: 16
  bracket_height: "75%"
  bracket_radius: 6
  bracket_color: "var(--lcars-blue)"
```

**Asymmetric BG-Grid Brackets:**
```yaml
style:
  bracket_style: "bg-grid"
  bracket_sides: "left"           # Only left bracket
  bracket_physical_width: 24
  bracket_height: "90%"
  bracket_radius: 10
```

### 🎯 **BG-Grid Bracket Options:**

| Option | Type | Description | Example |
|--------|------|-------------|---------|
| `bracket_physical_width` | number | Width of bracket arms in pixels | `16` |
| `bracket_height` | string/number | Height as percentage or pixels | `"80%"` or `60` |
| `bracket_radius` | number | Corner radius for rounded ends | `8` |

### 🎛️ **Advanced Bracket Controls:**

**Bracket Positioning:**
```yaml
bracket_gap: 4        # Distance from content (pixels)
bracket_extension: 8  # Length of bracket arms (pixels)
bracket_width: 2      # Line thickness (pixels)
```

**Selective Display:**
```yaml
bracket_corners: "top"    # "both", "top", "bottom", "none"
bracket_sides: "left"     # "both", "left", "right", "none"
```

**Visual Properties:**
```yaml
bracket_opacity: 0.8      # Transparency (0-1)
bracket_color: null       # null = inherit from bar_color
```

## Advanced Effects
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
  # - "average": Mean value (default, with smart real-time handling)
  # - "latest": Most recent value in bucket (best for real-time)
  # - "sum": Total value
  # - "max": Maximum value
  # - "min": Minimum value
  # - "count": Number of data points
```

### Real-time Aggregation Behavior
The history bar renderer includes intelligent aggregation for real-time updates:

- **Smart Average Mode**: When multiple values exist in the same time bucket, uses the most recent value instead of averaging to prevent dilution of current data
- **Latest Mode**: Always uses the most recent timestamp value in each bucket
- **Traditional Modes**: Sum, max, min, and count work as expected for historical analysis

```yaml
style:
  # For real-time monitoring (recommended)
  aggregation_mode: "latest"      # Always show current values
  bucket_size: "30m"              # Smaller buckets for better granularity
  time_window: "12h"              # Shorter window for recent focus

  # For historical analysis
  aggregation_mode: "average"     # Traditional averaging
  bucket_size: "1h"               # Larger buckets for trends
  time_window: "24h"              # Longer window for patterns
```

### Bucket Size Options
```yaml
style:
  bucket_size: "auto"             # Auto-determine optimal bucket size
  bucket_size: "30m"              # 30-minute buckets (recommended for real-time)
  bucket_size: "1h"               # 1-hour buckets
  bucket_size: "4h"               # 4-hour buckets
  bucket_size: "1d"               # Daily buckets
```

**Note**: The default bucket size has been changed from `"auto"` to `"30m"` to provide better real-time granularity and prevent averaging artifacts when values change rapidly within the same hour.

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
      bucket_size: string         # Bucket size (default: "30m")
      aggregation_mode: string    # average|latest|sum|max|min|count (default: "average")

      # Bar Appearance
      bar_color: string           # Bar color (default: "var(--lcars-blue)")
      bar_opacity: number         # Bar opacity (default: 1.0)
      bar_gap: number             # Gap between bars (default: 1)
      bar_radius: number          # Corner radius (default: 0)

      # Color Coding
      color_ranges: array         # Value-based color ranges
      use_gradient: boolean       # Use gradient fills (default: false)

      # Labels & Values
      show_labels: boolean        # Show time labels (default: true)
      show_values: boolean        # Show value labels on bars (default: false)

      # Time Label Styling
      label_color: string         # Time label color (default: "var(--lcars-white)")
      label_font_size: number     # Time label font size (default: 10)
      label_font_family: string   # Time label font family (default: "var(--lcars-font-family, monospace)")
      label_font_weight: string   # Time label font weight (default: "normal")
      label_opacity: number       # Time label opacity (default: 1)

      # Value Label Styling
      value_color: string         # Value label color (default: same as label_color)
      value_font_size: number     # Value label font size (default: 8)
      value_font_family: string   # Value label font family (default: same as label_font_family)
      value_font_weight: string   # Value label font weight (default: "bold")
      value_opacity: number       # Value label opacity (default: 0.8)
      value_format: string        # Value formatting template (default: "{value}")

      # Axis and Grid
      show_axis: boolean          # Show axis lines (default: true)
      show_grid: boolean          # Show grid lines (default: false)

      axis_color: string          # Axis color (default: "var(--lcars-gray)")
      axis_width: number          # Axis line thickness (default: 2)
      grid_color: string          # Grid color (default: "var(--lcars-gray)")
      grid_opacity: number        # Grid opacity (default: 0.6)
      grid_width: number          # Grid line thickness (default: 1)

      # Labels & Values
      show_labels: boolean        # Show time labels (default: true)
      show_values: boolean        # Show value labels on bars (default: false)

      # Time Label Styling
      label_color: string         # Time label color (default: "var(--lcars-white)")
      label_font_size: number     # Time label font size (default: 10)
      label_font_family: string   # Time label font family (default: "var(--lcars-font-family, monospace)")
      label_font_weight: string   # Time label font weight (default: "normal")
      label_opacity: number       # Time label opacity (default: 1)

      # Value Label Styling
      value_color: string         # Value label color (default: same as label_color)
      value_font_size: number     # Value label font size (default: 8)
      value_font_family: string   # Value label font family (default: same as label_font_family)
      value_font_weight: string   # Value label font weight (default: "bold")
      value_opacity: number       # Value label opacity (default: 0.8)
      value_format: string        # Value formatting template (default: "{value}")

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

## Best Practices

### Real-time Monitoring Configuration
For sensors and data that change frequently, use these recommended settings:

```yaml
style:
  time_window: "12h"              # Shorter window focuses on recent data
  bucket_size: "30m"              # 30-minute buckets prevent averaging artifacts
  aggregation_mode: "latest"      # Always show most recent value in bucket

  # Enhanced visual feedback
  color_ranges: [...]             # Use to show state changes clearly
  glow: { ... }                   # Add glow effects for better visibility
```

### Historical Analysis Configuration
For long-term trends and analysis, use these settings:

```yaml
style:
  time_window: "7d"               # Longer window for patterns
  bucket_size: "1h"               # Larger buckets for trends
  aggregation_mode: "average"     # Smooth out short-term fluctuations

  # Data analysis features
  thresholds: [...]               # Mark important levels
  show_grid: true                 # Grid for easier reading
  show_labels: true               # Time labels for context
```

### Performance Optimization
For large datasets or slower devices:

```yaml
style:
  max_bars: 50                    # Limit number of bars
  bucket_size: "4h"               # Larger buckets reduce complexity
  time_window: "24h"              # Reasonable time window

  # Disable expensive effects if needed
  glow: false
  shadow: false
  gradient: false
```

### Color Coding Strategy
Use color ranges effectively to convey information:

```yaml
style:
  color_ranges:
    # Use semantic colors
    - { min: 0, max: 25, color: "var(--lcars-green)", label: "Good" }
    - { min: 25, max: 75, color: "var(--lcars-blue)", label: "Normal" }
    - { min: 75, max: 90, color: "var(--lcars-orange)", label: "Warning" }
    - { min: 90, max: 100, color: "var(--lcars-red)", label: "Critical" }

  # Complement with thresholds
  thresholds:
    - value: 80
      color: var(--lcars-orange)
      dash: true
      label: "Action Required"
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

#### 5. Real-time Update Issues
**Symptoms**: Values appear averaged or don't immediately reflect current changes
**Solutions**:
- Use `aggregation_mode: latest` for real-time monitoring
- Set smaller `bucket_size` (e.g., "30m" instead of "1h")
- Use shorter `time_window` (e.g., "12h" instead of "24h")
- Check that current value is being added to historical data

#### 6. Averaging Artifacts
**Symptoms**: Current value gets mixed with old values in same time bucket
**Solutions**:
- Switch to `aggregation_mode: latest`
- Use smaller bucket sizes to separate data points
- Verify time bucketing is working correctly

```javascript
// Check bucket contents for debugging
const buckets = renderer._createTimeBuckets(data, timeWindow, bucketSize);
buckets.forEach((bucket, i) => {
  if (bucket.data.length > 1) {
    console.log(`Bucket ${i}: ${bucket.data.length} points`, bucket.data.map(p => p.value));
  }
});
```

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

### Example 6: Real-time System Monitoring (Recommended Configuration)
```yaml
data_sources:
  system_cpu:
    type: entity
    entity: sensor.cpu_usage_percent
    transformations:
      - type: smooth
        method: "exponential"
        alpha: 0.2
        key: "smoothed"

overlays:
  # Real-time CPU monitoring with 30-minute buckets
  - id: cpu_realtime_monitor
    type: history_bar
    source: system_cpu
    position: [100, 100]
    size: [400, 120]
    style:
      orientation: horizontal
      time_window: 12h              # Shorter window for real-time focus
      bucket_size: 30m              # 30-minute buckets for better granularity
      aggregation_mode: latest      # Use latest value when multiple points in bucket

      # Enhanced color coding for CPU usage
      color_ranges:
        - { min: 0, max: 25, color: "var(--lcars-green)", label: "Idle" }
        - { min: 25, max: 50, color: "var(--lcars-blue)", label: "Normal" }
        - { min: 50, max: 75, color: "var(--lcars-yellow)", label: "Busy" }
        - { min: 75, max: 90, color: "var(--lcars-orange)", label: "High" }
        - { min: 90, max: 100, color: "var(--lcars-red)", label: "Critical" }

      # Multiple alert thresholds
      thresholds:
        - value: 80
          color: var(--lcars-orange)
          width: 2
          dash: true
          label: "High Usage"
        - value: 95
          color: var(--lcars-red)
          width: 3
          label: "Critical"

      # Full LCARS styling
      bracket_style: true
      status_indicator: var(--lcars-green)
      show_grid: true
      show_axis: true
      show_labels: true

      glow:
        color: var(--lcars-blue)
        blur: 4
        intensity: 0.6
```

### Example 7: Temperature History with Enhanced DataSource
```yaml
data_sources:
  temperature_enhanced:
    type: entity
    entity: sensor.outdoor_temperature
    transformations:
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"
      - type: smooth
        method: "moving_average"
        window_size: 5
        key: "smoothed"

overlays:
  # Temperature in Celsius with smart bucketing
  - id: temp_celsius_history
    type: history_bar
    source: temperature_enhanced.transformations.celsius
    position: [100, 250]
    size: [300, 80]
    style:
      time_window: 24h
      bucket_size: 1h               # Hourly for daily temperature patterns
      aggregation_mode: average     # Average is good for temperature trends

      bar_color: var(--lcars-blue)
      show_axis: true
      show_labels: true

      # Temperature-specific color ranges
      color_ranges:
        - { min: -20, max: 0, color: "#004080", label: "Freezing" }
        - { min: 0, max: 15, color: "var(--lcars-blue)", label: "Cold" }
        - { min: 15, max: 25, color: "var(--lcars-green)", label: "Comfortable" }
        - { min: 25, max: 35, color: "var(--lcars-orange)", label: "Warm" }
        - { min: 35, max: 50, color: "var(--lcars-red)", label: "Hot" }

      bracket_style: true
      status_indicator: var(--lcars-green)
```

### Example 8: Network Traffic with Latest Aggregation
```yaml
data_sources:
  network_speed:
    type: entity
    entity: sensor.speedtest_download
    transformations:
      - type: expression
        expression: "value / 8"  # Convert bits to bytes
        key: "mbytes_per_second"

overlays:
  # Network speed with real-time updates
  - id: network_speed_monitor
    type: history_bar
    source: network_speed.transformations.mbytes_per_second
    position: [50, 350]
    size: [450, 100]
    style:
      orientation: horizontal
      time_window: 6h               # 6-hour window for network monitoring
      bucket_size: 15m              # 15-minute buckets for network granularity
      aggregation_mode: latest      # Always show most recent speed

      # Network speed color coding
      color_ranges:
        - { min: 0, max: 10, color: "var(--lcars-red)", label: "Slow" }
        - { min: 10, max: 50, color: "var(--lcars-orange)", label: "Fair" }
        - { min: 50, max: 100, color: "var(--lcars-blue)", label: "Good" }
        - { min: 100, max: 500, color: "var(--lcars-green)", label: "Fast" }
        - { min: 500, max: 1000, color: "var(--lcars-cyan)", label: "Very Fast" }

      # Performance thresholds
      thresholds:
        - value: 25
          color: var(--lcars-orange)
          dash: true
          label: "Minimum Usable"
        - value: 100
          color: var(--lcars-green)
          label: "Good Performance"

      show_grid: true
      show_labels: true
      bracket_style: true

      # Animated glow effect
      glow:
        color: var(--lcars-cyan)
        blur: 5
        intensity: 0.8
```

### Example 9: Power Consumption with Sum Aggregation
```yaml
data_sources:
  power_meter:
    type: entity
    entity: sensor.power_consumption_watts
    transformations:
      - type: expression
        expression: "value / 1000"  # Convert to kilowatts
        key: "kilowatts"

overlays:
  # Daily power consumption totals
  - id: daily_power_consumption
    type: history_bar
    source: power_meter.transformations.kilowatts
    position: [100, 450]
    size: [500, 120]
    style:
      orientation: horizontal
      time_window: 30d              # Monthly view
      bucket_size: 1d               # Daily buckets
      aggregation_mode: sum         # Sum daily consumption

      # Power consumption color coding
      color_ranges:
        - { min: 0, max: 5, color: "var(--lcars-green)", label: "Low" }
        - { min: 5, max: 15, color: "var(--lcars-blue)", label: "Normal" }
        - { min: 15, max: 25, color: "var(--lcars-yellow)", label: "High" }
        - { min: 25, max: 40, color: "var(--lcars-orange)", label: "Very High" }
        - { min: 40, max: 100, color: "var(--lcars-red)", label: "Excessive" }

      # Budget thresholds
      thresholds:
        - value: 20
          color: var(--lcars-yellow)
          width: 2
          dash: true
          label: "Budget Alert"
        - value: 30
          color: var(--lcars-red)
          width: 3
          label: "Budget Exceeded"

      show_grid: true
      show_labels: true
      show_values: true
      bracket_style: true
      status_indicator: var(--lcars-green)

      # Enhanced visual effects
      gradient:
        type: linear
        direction: vertical
        stops:
          - { offset: "0%", color: "var(--lcars-blue)" }
          - { offset: "100%", color: "var(--lcars-cyan)" }

      shadow:
        offset_x: 2
        offset_y: 2
        blur: 4
        color: "rgba(0,0,0,0.3)"
```

### Example 10: Vertical Multi-Sensor Display
```yaml
data_sources:
  environmental_sensor:
    type: entity
    entity: sensor.bme280_data
    transformations:
      - type: expression
        expression: "value.temperature"
        key: "temperature"
      - type: expression
        expression: "value.pressure"
        key: "pressure"
      - type: expression
        expression: "value.humidity"
        key: "humidity"

overlays:
  # Vertical temperature display
  - id: temp_vertical_compact
    type: history_bar
    source: environmental_sensor.transformations.temperature
    position: [50, 50]
    size: [60, 250]
    style:
      orientation: vertical
      time_window: 4h
      bucket_size: 10m
      aggregation_mode: latest

      color_ranges:
        - { min: 15, max: 22, color: "var(--lcars-blue)" }
        - { min: 22, max: 26, color: "var(--lcars-green)" }
        - { min: 26, max: 30, color: "var(--lcars-orange)" }

      bracket_style: true
      show_labels: false

  # Vertical pressure display
  - id: pressure_vertical_compact
    type: history_bar
    source: environmental_sensor.transformations.pressure
    position: [130, 50]
    size: [60, 250]
    style:
      orientation: vertical
      time_window: 4h
      bucket_size: 10m
      aggregation_mode: average

      color_ranges:
        - { min: 980, max: 1000, color: "var(--lcars-red)" }
        - { min: 1000, max: 1020, color: "var(--lcars-green)" }
        - { min: 1020, max: 1040, color: "var(--lcars-blue)" }

      bracket_style: true
      show_labels: false

  # Vertical humidity display
  - id: humidity_vertical_compact
    type: history_bar
    source: environmental_sensor.transformations.humidity
    position: [210, 50]
    size: [60, 250]
    style:
      orientation: vertical
      time_window: 4h
      bucket_size: 10m
      aggregation_mode: latest

      color_ranges:
        - { min: 30, max: 50, color: "var(--lcars-orange)" }
        - { min: 50, max: 70, color: "var(--lcars-green)" }
        - { min: 70, max: 90, color: "var(--lcars-blue)" }

      bracket_style: true
      show_labels: false
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