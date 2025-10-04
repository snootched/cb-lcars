# Sparkline Overlay - Quick Reference

## 📚 Complete Documentation
For comprehensive sparkline overlay documentation including advanced features, DataSource integration, styling options, and configuration schema, see:

**👉 [Sparkline Overlay Complete Documentation](./sparkline_overlay_complete_documentation.md)**

## Quick Start

### Basic Sparkline
```yaml
overlays:
  - type: sparkline
    id: my_sparkline
    position: [100, 50]
    source: temperature_sensor
```

### Responsive Sparkline with MSD Defaults
```yaml
# Profile-based scaling (recommended)
profiles:
  - id: responsive
    defaults:
      sparkline:
        stroke_width:
          value: 2              # Base stroke width
          scale: "viewbox"      # Scales with SVG dimensions
          unit: "px"
        size:
          width: 250            # Default width
          height: 80            # Default height

overlays:
  - type: sparkline
    id: scaled_sparkline
    position: [100, 50]
    source: power_meter
    # Inherits scalable stroke_width and size from profile

  - type: sparkline
    id: fixed_sparkline
    position: [100, 150]
    source: temperature_sensor
    style:
      width: 3               # Simple number = no scaling
      color: "var(--lcars-red)"
```

## Essential DataSource Integration

Sparklines support enhanced DataSource references with dot notation for accessing transformations and aggregations:

### Basic Data Access
```yaml
overlays:
  - type: sparkline
    id: raw_data
    position: [50, 100]
    source: temperature_sensor    # Uses raw buffer data
    size: [200, 60]
```

### Enhanced Data Access
```yaml
data_sources:
  temperature_enhanced:
    type: entity
    entity: sensor.outdoor_temperature
    transformations:
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"
    aggregations:
      moving_average:
        window: "5m"
        key: "avg_5m"

overlays:
  # Raw temperature data
  - type: sparkline
    id: raw_temp
    position: [50, 50]
    source: temperature_enhanced

  # Smoothed temperature data
  - type: sparkline
    id: smooth_temp
    position: [50, 130]
    source: temperature_enhanced.transformations.smoothed

  # 5-minute average
  - type: sparkline
    id: avg_temp
    position: [50, 210]
    source: temperature_enhanced.aggregations.avg_5m
```

## Common Styling Options

### Basic Appearance
```yaml
overlays:
  - type: sparkline
    id: styled_sparkline
    position: [50, 100]
    source: power_meter
    size: [300, 80]
    style:
      color: "var(--lcars-blue)"
      width: 3                    # Line thickness
      opacity: 0.9                # Transparency
      smoothing_mode: "constrained" # Smooth curves
```

### LCARS Features
```yaml
overlays:
  - type: sparkline
    id: lcars_sparkline
    position: [50, 100]
    source: sensor_data
    style:
      color: "var(--lcars-yellow)"
      bracket_style: true         # LCARS brackets
      grid_lines: true           # Technical grid
      status_indicator: true     # Status dot
      show_last_value: true      # Value label
      value_format: "{value:.1f}°C"
```

### Advanced Visualization
```yaml
overlays:
  - type: sparkline
    id: advanced_sparkline
    position: [50, 100]
    source: power_data
    size: [350, 100]
    style:
      # Line styling
      color: "var(--lcars-green)"
      width: 2
      smoothing_mode: "bezier"

      # Area fill
      fill: "var(--lcars-green)"
      fill_opacity: 0.2

      # Data visualization
      show_points: true
      point_size: 3
      thresholds:
        - value: 75
          color: "var(--lcars-orange)"
          dash: true
        - value: 90
          color: "var(--lcars-red)"
          width: 2

      # Effects
      glow:
        color: "var(--lcars-green)"
        radius: 3
        intensity: 0.6
```

## Performance Optimization

### High-Frequency Data
```yaml
overlays:
  - type: sparkline
    id: optimized_sparkline
    position: [50, 100]
    source: fast_sensor
    style:
      # Performance settings
      decimation: 200           # Reduce to 200 points
      max_points: 500          # Hard limit
      path_precision: 1        # Reduce SVG precision

      # Minimal styling for speed
      animatable: false        # Disable animations
      show_points: false       # No data points
```

## Default Value Overrides

### Global Defaults
```yaml
# Override system defaults globally
defaults:
  sparkline:
    color: "var(--lcars-cyan)"
    size:
      width: 280
      height: 70
    grid:
      opacity: 0.6
    stroke_width:
      value: 2.5
      scale: "viewbox"
```

### Layer-Based Customization
```javascript
// Via JavaScript (runtime)
window.cblcars.defaults.set('user', 'sparkline.color', '#00ffff');
window.cblcars.defaults.set('user', 'sparkline.grid.opacity', 0.8);
window.cblcars.defaults.set('theme', 'sparkline.bracket.width', 3);

// Check current defaults
window.cblcars.defaults.debug();
```

## Available Default Paths

Key defaults you can override:

### Core Properties
- `sparkline.color` - Default line color
- `sparkline.size.width` - Default width (200)
- `sparkline.size.height` - Default height (60)
- `sparkline.stroke_width` - Line thickness (supports scaling)
- `sparkline.opacity` - Default opacity

### Grid & Visual Elements
- `sparkline.grid.color` - Grid line color
- `sparkline.grid.opacity` - Grid transparency
- `sparkline.grid.horizontal_count` - Horizontal grid lines
- `sparkline.grid.vertical_count` - Vertical grid lines

### LCARS Features
- `sparkline.bracket.width` - Bracket stroke width
- `sparkline.bracket.gap` - Distance from sparkline
- `sparkline.bracket.extension` - Bracket arm length
- `sparkline.status_indicator.color` - Status dot color

### Performance
- `sparkline.decimation_threshold` - Default max points (1000)
- `sparkline.path_precision` - SVG precision (2)

## Status Indicators

Sparklines automatically show status when data is unavailable:

- **LOADING** - DataSource initializing (animated)
- **NOT FOUND** - DataSource doesn't exist
- **NO DATA** - Empty buffer
- **INSUFFICIENT DATA** - Need 2+ points for sparkline
- **ERROR** - Rendering or data access error

## Best Practices

### Configuration
- **Use defaults for consistency**: Override at profile/theme level rather than per-overlay
- **Leverage enhanced DataSource**: Access transformations and aggregations with dot notation
- **Size appropriately**: Consider viewBox scaling for responsive designs

### Performance
- **Enable decimation**: For high-frequency data sources
- **Optimize styling**: Disable unnecessary features for performance-critical sparklines
- **Monitor data flow**: Use debug tools to verify DataSource connectivity

### Visual Design
- **Choose appropriate smoothing**: `constrained` for most cases, `none` for raw data
- **Use LCARS features**: Brackets and grids for authentic interface styling
- **Color consistently**: Leverage CSS variables for theme consistency

## Debug Commands

```javascript
// Check sparkline status
document.querySelectorAll('[data-overlay-type="sparkline"]').forEach(el => {
  console.log(`${el.getAttribute('data-overlay-id')}:`, {
    source: el.getAttribute('data-source'),
    status: el.getAttribute('data-status'),
    features: el.getAttribute('data-sparkline-features')
  });
});

// Test DataSource access
const result = SparklineRenderer.getHistoricalDataForSparkline('sensor.transformations.smoothed');
console.log('Data access result:', result);

// View current defaults
window.cblcars.defaults.debug();
```

## Troubleshooting

### Common Issues
- **No sparkline appears**: Check DataSource name and buffer status
- **Enhanced data not working**: Verify transformation/aggregation key names
- **Performance issues**: Enable decimation and reduce max_points
- **Styling not applied**: Check CSS variable availability and defaults resolution

For detailed troubleshooting, configuration schemas, and advanced examples, see the [Complete Documentation](./sparkline_overlay_complete_documentation.md).