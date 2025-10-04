# Enhanced DataSource System - Configuration Examples

This document provides practical configuration examples for the enhanced DataSource system with transformations, aggregations, and computed sources.

## Basic Transformation Examples

### Temperature Enhancement with Multiple Transformations
```yaml
data_sources:
  temperature_enhanced:
    type: entity
    entity: sensor.outdoor_temperature
    transformations:
      # Convert Fahrenheit to Celsius
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"

      # Scale to percentage (for display)
      - type: scale
        input_range: [-10, 40]  # -10°C to 40°C
        output_range: [0, 100]  # 0% to 100%
        key: "percentage"

      # Apply smoothing to reduce noise
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"

    aggregations:
      # 5-minute moving average
      moving_average:
        window: "5m"
        key: "avg_5m"

      # Daily min/max tracking
      daily_stats:
        min: true
        max: true
        avg: true
        key: "daily"
```

### Power Monitoring with Rate Analysis
```yaml
data_sources:
  power_consumption:
    type: entity
    entity: sensor.power_meter
    transformations:
      # Convert to kilowatts
      - type: unit_conversion
        factor: 0.001
        key: "kilowatts"

      # Calculate efficiency rating
      - type: expression
        expression: "value < 1000 ? 'efficient' : value < 3000 ? 'moderate' : 'high'"
        key: "efficiency_rating"

    aggregations:
      # Track rate of change
      rate_of_change:
        unit: "per_minute"
        key: "rate"

      # Session statistics
      session_stats:
        key: "session"
```

## Rules Engine Integration

### Using Transformed and Aggregated Data in Rules
```yaml
rules:
  - id: temperature_alert
    priority: 100
    when:
      all:
        # Use 5-minute average to avoid false alerts
        - entity: temperature_enhanced.aggregations.avg_5m
          above: 35
        # Also check smoothed value for trend
        - entity: temperature_enhanced.transformations.smoothed
          above: 32
    apply:
      overlays:
        - id: temp_display
          style:
            color: "var(--lcars-red)"
            glow: true

  - id: power_efficiency_warning
    when:
      all:
        # Use transformed kilowatt value
        - entity: power_consumption.transformations.kilowatts
          above: 2.5
        # Check rate of increase
        - entity: power_consumption.aggregations.rate
          above: 0.1  # Rising more than 0.1 kW/min
    apply:
      overlays:
        - id: power_warning
          style:
            color: "var(--lcars-orange)"
```

## Overlay Configuration Examples

### Sparkline with Transformed Data
```yaml
overlays:
  - id: temperature_sparkline
    type: sparkline
    source: temperature_enhanced
    # Use the smoothed transformation for cleaner visualization
    data_key: "smoothed"
    style:
      color: "var(--lcars-blue)"
      smoothing_mode: "constrained"

  - id: temperature_text
    type: text
    content: "Temp: {temperature_enhanced.transformations.celsius:.1f}°C | Avg: {temperature_enhanced.aggregations.avg_5m:.1f}°C"
    style:
      color: "var(--lcars-white)"
```

### Power Dashboard with Multiple Data Sources
```yaml
overlays:
  - id: power_current
    type: text
    content: "Current: {power_consumption.transformations.kilowatts:.2f} kW"

  - id: power_rate
    type: text
    content: "Rate: {power_consumption.aggregations.rate:+.3f} kW/min"

  - id: power_efficiency
    type: text
    content: "Status: {power_consumption.transformations.efficiency_rating}"
```

## Advanced Configurations

### Multi-Sensor Computed Source (Future Enhancement)
```yaml
# Note: This will be implemented in Phase 3
data_sources:
  total_power:
    type: computed
    inputs:
      - sensor.power_living_room
      - sensor.power_kitchen
      - sensor.power_bedroom
    expression: "inputs[0] + inputs[1] + inputs[2]"
    aggregations:
      moving_average:
        window: "10m"
        key: "avg_10m"
```

### Complex Transformation Pipeline
```yaml
data_sources:
  sensor_analysis:
    type: entity
    entity: sensor.complex_data
    transformations:
      # Step 1: Unit conversion
      - type: unit_conversion
        factor: 0.01
        key: "normalized"

      # Step 2: Range scaling
      - type: scale
        input_range: [0, 10]
        output_range: [-1, 1]
        key: "scaled"

      # Step 3: Apply custom formula
      - type: expression
        expression: "Math.pow(value, 2) * 0.8"
        key: "processed"

      # Step 4: Smooth the result
      - type: smooth
        method: "moving_average"
        window_size: 3
        key: "final"

    aggregations:
      # Track trends on the final processed value
      recent_trend:
        samples: 10
        threshold: 0.05
        key: "trend"
```

## Performance Considerations

### Recommended Window Sizes
- **Short-term**: 5m - 1h (real-time dashboard)
- **Medium-term**: 1h - 6h (trend analysis)
- **Long-term**: 6h - 24h (daily summaries)

### Memory Usage Guidelines
- Limit aggregation windows to practical sizes
- Use session-based statistics for page lifecycle data
- Consider decimation for high-frequency sensors

### Configuration Tips
1. **Start simple**: Begin with basic transformations before adding complex pipelines
2. **Test incrementally**: Add one transformation/aggregation at a time
3. **Monitor performance**: Use browser dev tools to check memory usage
4. **Use appropriate keys**: Choose descriptive names for transformed/aggregated data

## Troubleshooting

### Common Issues
1. **Transformation errors**: Check browser console for processor errors
2. **Missing data**: Verify entity IDs and data source names
3. **Rules not triggering**: Ensure correct dot notation for transformed/aggregated references

### Debug Commands
```javascript
// Check data source status
window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager?.getStats()

// View transformation results
window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager?.getSource('temperature_enhanced')?.getCurrentData()

// Check rules engine dependencies
window.__msdDebug?.rulesDeps
```