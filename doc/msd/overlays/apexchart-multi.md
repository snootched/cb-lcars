// ...existing content up to "DataSource Integration" section...

## Multi-Series Charts

ApexCharts overlays support multiple data series on a single chart, allowing you to compare multiple sensors or data sources side-by-side.

### Basic Multi-Series Configuration

Use an **array** for the `source` property:

```yaml
overlays:
  - id: temp_humidity_chart
    type: apexchart
    source:
      - indoor_temperature
      - outdoor_temperature
      - humidity_sensor
    position: [50, 100]
    size: [400, 200]
    style:
      chart_type: "line"
      time_window: "12h"
      show_legend: true
```

### Custom Series Names

Provide custom names for each series:

```yaml
overlays:
  - id: multi_temp_chart
    type: apexchart
    source:
      - indoor_temperature
      - outdoor_temperature
    position: [50, 100]
    size: [400, 200]
    style:
      chart_type: "line"
      series_names:
        indoor_temperature: "Inside"
        outdoor_temperature: "Outside"
      show_legend: true
      legend_position: "top"
```

### Multi-Series with Transformations

Each series can reference different transformations:

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
  - id: temp_comparison
    type: apexchart
    source:
      - temperature                           # Raw data
      - temperature.transformations.celsius   # Converted
      - temperature.transformations.smoothed  # Smoothed
    position: [50, 100]
    size: [400, 200]
    style:
      chart_type: "line"
      series_names:
        temperature: "Raw °F"
        temperature.transformations.celsius: "Celsius"
        temperature.transformations.smoothed: "Smoothed"
      show_legend: true
```

### Multi-Series Styling

Customize colors for each series:

```yaml
overlays:
  - id: colorful_chart
    type: apexchart
    source:
      - temp_living_room
      - temp_bedroom
      - temp_kitchen
    position: [50, 100]
    size: [400, 200]
    style:
      chart_type: "line"
      show_legend: true

      # Direct ApexCharts options for per-series colors
      chart_options:
        colors:
          - "var(--lcars-blue)"
          - "var(--lcars-orange)"
          - "var(--lcars-red)"
        stroke:
          width: [2, 2, 3]        # Different widths
          dashArray: [0, 0, 4]    # Third line dashed
```

### Multiple Y-Axes Example

Compare data with different scales (temperature vs humidity):

```yaml
overlays:
  - id: dual_axis_chart
    type: apexchart
    source:
      - temperature_sensor
      - humidity_sensor
    position: [50, 100]
    size: [400, 250]
    style:
      chart_type: "line"
      show_legend: true

      # Use chart_options for advanced multi-axis configuration
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

### Performance Considerations

Multi-series charts can be data-intensive:

```yaml
style:
  time_window: "6h"      # Shorter window for multi-series
  max_points: 300        # Fewer points per series
  animatable: false      # Disable animations for better performance
```

**Recommendations:**
- Limit to 3-5 series per chart for readability
- Use shorter time windows for multi-series
- Reduce `max_points` to improve performance
- Consider separate charts for very different data types

### Real-World Example: Home Climate Monitoring

```yaml
data_sources:
  living_room_temp:
    entity: sensor.living_room_temperature
  bedroom_temp:
    entity: sensor.bedroom_temperature
  outdoor_temp:
    entity: sensor.outdoor_temperature

overlays:
  - id: climate_comparison
    type: apexchart
    source:
      - living_room_temp
      - bedroom_temp
      - outdoor_temp
    position: [50, 100]
    size: [450, 250]
    style:
      chart_type: "line"
      smoothing_mode: "smooth"
      stroke_width: 2

      time_window: "24h"
      max_points: 400

      show_grid: true
      show_legend: true
      legend_position: "top"

      series_names:
        living_room_temp: "Living Room"
        bedroom_temp: "Bedroom"
        outdoor_temp: "Outside"

      thresholds:
        - value: 20
          color: "var(--lcars-blue)"
          label: "Target"
        - value: 25
          color: "var(--lcars-orange)"
          label: "Warm"

      chart_options:
        colors:
          - "var(--lcars-blue)"
          - "var(--lcars-purple)"
          - "var(--lcars-orange)"
```

## See Also

- [Multi-Series Examples](../examples/apexchart-advanced.yaml) - More multi-series configurations
- [ApexCharts Multi-Series Docs](https://apexcharts.com/docs/series/) - Official ApexCharts documentation

// ...rest of existing documentation...
