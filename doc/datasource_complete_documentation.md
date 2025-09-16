# DataSource System - Complete Documentation & Schema

This document provides comprehensive documentation for the MSD DataSource system, including basic entity sources, enhanced transformations, aggregations, and computed sources.

---

## Table of Contents

1. [Overview](#overview)
2. [Basic DataSource Configuration](#basic-datasource-configuration)
3. [Enhanced Features](#enhanced-features)
4. [Transformation Processors](#transformation-processors)
5. [Aggregation Processors](#aggregation-processors)
6. [Rules Engine Integration](#rules-engine-integration)
7. [Overlay Integration](#overlay-integration)
8. [Performance & Best Practices](#performance--best-practices)
9. [Configuration Schema](#configuration-schema)
10. [Troubleshooting](#troubleshooting)
11. [Examples](#examples)

---

## Overview

The MSD DataSource system provides real-time data processing for Home Assistant entities with advanced features:

- **Real-time subscriptions** to Home Assistant state changes
- **Historical data preloading** with multiple fallback strategies
- **Transformation pipelines** for unit conversion, scaling, smoothing, and custom calculations
- **Aggregation engines** for moving averages, min/max tracking, rate analysis, and trend detection
- **Rules engine integration** with dot notation access to processed data
- **Memory-efficient** runtime-only processing (no persistent storage)
- **Performance optimized** with coalescing, throttling, and configurable windows

---

## Basic DataSource Configuration

### Minimal Entity Source
```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.outdoor_temperature
```

### Complete Basic Configuration
```yaml
data_sources:
  temperature_detailed:
    type: entity
    entity: sensor.outdoor_temperature
    attribute: null              # Use specific attribute instead of state

    # Buffer and timing configuration
    windowSeconds: 3600          # 1 hour buffer window (default: 60)
    minEmitMs: 100              # Minimum time between emissions (default: 100)
    coalesceMs: 50              # Coalescing window (default: calculated)
    maxDelayMs: 500             # Maximum delay before forced emit (default: calculated)
    emitOnSameValue: true       # Emit even if value unchanged (default: true)

    # History preloading
    history:
      enabled: true             # Enable history preload (default: true)
      hours: 6                  # Hours of history to load (default: 6, max: 168)
```

---

## Enhanced Features

### Transformation Pipeline
Apply multiple chained transformations to incoming data:

```yaml
data_sources:
  enhanced_sensor:
    type: entity
    entity: sensor.raw_data
    transformations:
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"
      - type: scale
        input_range: [-10, 40]
        output_range: [0, 100]
        key: "percentage"
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"
```

### Aggregation Engine
Calculate statistics and trends over time windows:

```yaml
data_sources:
  analyzed_sensor:
    type: entity
    entity: sensor.power_meter
    aggregations:
      moving_average:
        window: "5m"
        key: "avg_5m"
      rate_of_change:
        unit: "per_minute"
        key: "rate"
      session_stats:
        key: "session"
```

---

## Transformation Processors

### Unit Conversion Processor
Convert between different units of measurement.

```yaml
transformations:
  # Predefined conversions
  - type: unit_conversion
    from: "°F"                  # Source unit
    to: "°C"                    # Target unit
    key: "celsius"              # Result key

  # Factor-based conversion
  - type: unit_conversion
    factor: 0.001               # Multiply by factor
    offset: 0                   # Add offset (default: 0)
    key: "kilowatts"

  # Custom function conversion
  - type: unit_conversion
    customFunction: "value => (value - 32) * 5/9"
    key: "custom_celsius"
```

**Predefined Conversions:**
- Temperature: `°F ↔ °C`, `F ↔ C`
- Power: `W ↔ kW`
- Data: `KB → MB → GB`

### Scale/Range Processor
Map values from one range to another.

```yaml
transformations:
  - type: scale
    input_range: [0, 100]       # Source range [min, max]
    output_range: [0, 1]        # Target range [min, max]
    clamp: true                 # Clamp input to range (default: true)
    key: "normalized"
```

### Smoothing Processor
Apply smoothing algorithms to reduce noise.

```yaml
transformations:
  # Exponential smoothing
  - type: smooth
    method: "exponential"
    alpha: 0.3                  # Smoothing factor (0-1)
    key: "exp_smooth"

  # Moving average
  - type: smooth
    method: "moving_average"
    window_size: 5              # Number of samples
    key: "ma_smooth"

  # Median filter
  - type: smooth
    method: "median"
    window_size: 3              # Window size (odd numbers work best)
    key: "median_smooth"
```

**Smoothing Methods:**
- `exponential`: Exponential weighted moving average
- `moving_average`: Simple moving average
- `median`: Median filter (good for spike removal)

### Expression Processor
Evaluate custom JavaScript expressions.

```yaml
transformations:
  - type: expression
    expression: "value * 0.8 + 10"     # Simple math
    key: "adjusted"

  - type: expression
    expression: "Math.pow(value, 2)"   # Use Math functions
    key: "squared"

  - type: expression
    expression: "value < 50 ? 'low' : 'high'"  # Conditional logic
    key: "category"
```

**Available Context:**
- `value`: Current numeric value
- `timestamp`: Current timestamp (milliseconds)
- `buffer`: Historical data buffer (RollingBuffer instance)
- `Math`: JavaScript Math object

---

## Aggregation Processors

### Moving Average Aggregation
Calculate averages over time windows or sample counts.

```yaml
aggregations:
  moving_average:
    window: "5m"                # Time window (5 minutes)
    max_samples: 100            # Limit to N most recent samples
    key: "avg_5m"
```

**Time Window Formats:**
- `s`, `sec`: seconds
- `m`, `min`: minutes
- `h`, `hr`: hours
- `d`, `day`: days

### Min/Max Aggregation
Track minimum, maximum, and average values.

```yaml
aggregations:
  daily_stats:
    min: true                   # Track minimum
    max: true                   # Track maximum
    avg: true                   # Track average
    key: "daily"
    window: "24h"               # Optional time window
```

**Result Structure:**
```javascript
{
  min: 12.5,
  max: 28.7,
  avg: 20.1,
  count: 144
}
```

### Rate of Change Aggregation
Calculate the rate of change between values.

```yaml
aggregations:
  rate_of_change:
    unit: "per_second"          # per_second, per_minute, per_hour
    smoothing: false            # Apply smoothing (default: false)
    key: "rate"
```

### Session Statistics Aggregation
Track statistics since page load/reset.

```yaml
aggregations:
  session_stats:
    key: "session"
```

**Result Structure:**
```javascript
{
  count: 42,
  min: 10.2,
  max: 35.8,
  avg: 22.5,
  first: 15.3,
  last: 24.1,
  sessionDuration: 1205,      // seconds since page load
  dataSpan: 1180              // seconds between first and last data
}
```

### Recent Trend Aggregation
Analyze recent trend direction using linear regression.

```yaml
aggregations:
  recent_trend:
    samples: 10                 # Number of recent samples
    threshold: 0.01             # Minimum change to be significant
    key: "trend"
```

**Result Structure:**
```javascript
{
  direction: "increasing",     // increasing, decreasing, stable
  strength: 0.045,            // Magnitude of trend
  slope: 0.045                // Raw slope value
}
```

---

## Rules Engine Integration

### Dot Notation Access
Access transformed and aggregated data in rule conditions:

```yaml
rules:
  - id: temperature_alert
    when:
      all:
        # Access raw value
        - entity: temperature_enhanced
          above: 25

        # Access transformation
        - entity: temperature_enhanced.transformations.celsius
          above: 30

        # Access aggregation
        - entity: temperature_enhanced.aggregations.avg_5m
          above: 28
    apply:
      overlays:
        - id: temp_display
          style:
            color: "var(--lcars-red)"
```

### Advanced Rule Examples
```yaml
rules:
  - id: power_trend_alert
    when:
      all:
        # Check if power is increasing rapidly
        - entity: power_meter.aggregations.trend
          equals: "increasing"
        - entity: power_meter.aggregations.rate
          above: 100  # More than 100W/min increase
        # And current power is already high
        - entity: power_meter.transformations.kilowatts
          above: 3.0
    apply:
      overlays:
        - id: power_warning
          style:
            color: "var(--lcars-orange)"
            glow: true
```

---

## Overlay Integration

### Text Overlays with Processed Data
```yaml
overlays:
  - id: temperature_display
    type: text
    content: |
      Temp: {temperature_enhanced.transformations.celsius:.1f}°C
      Avg: {temperature_enhanced.aggregations.avg_5m:.1f}°C
      Trend: {temperature_enhanced.aggregations.trend.direction}
    style:
      color: "var(--lcars-white)"
```

### Sparkline with Transformed Data
```yaml
overlays:
  - id: power_sparkline
    type: sparkline
    source: power_meter
    data_key: "smoothed"        # Use specific transformation
    style:
      color: "var(--lcars-blue)"
      smoothing_mode: "constrained"
```

---

## Performance & Best Practices

### Memory Management
- **Window sizes**: Keep aggregation windows ≤ 24 hours
- **Buffer capacity**: Automatically sized (10 points/second × window)
- **Session-based**: All data resets on page reload (no persistence)

### Performance Optimization
- **Coalescing**: Automatic batching of rapid updates
- **Throttling**: Configurable minimum emit intervals
- **History preloading**: Multiple fallback strategies
- **Error handling**: Graceful degradation with fallback values

### Configuration Guidelines
1. **Start simple**: Begin with basic transformations
2. **Test incrementally**: Add one processor at a time
3. **Monitor performance**: Use browser dev tools
4. **Use descriptive keys**: Clear naming for transformed data
5. **Appropriate windows**: Match window size to use case

### Recommended Window Sizes
- **Real-time dashboards**: 5m - 1h
- **Trend analysis**: 1h - 6h
- **Daily summaries**: 6h - 24h

---

## Configuration Schema

### DataSource Schema
```yaml
data_sources:
  <source_name>:
    type: entity                    # Required: "entity" or "computed" (future)
    entity: string                  # Required: Home Assistant entity ID
    attribute: string               # Optional: specific attribute name

    # Buffer Configuration
    windowSeconds: number           # Buffer window (default: 60)
    minEmitMs: number              # Min emit interval (default: 100)
    coalesceMs: number             # Coalescing window (default: calculated)
    maxDelayMs: number             # Max delay (default: calculated)
    emitOnSameValue: boolean       # Emit on unchanged values (default: true)

    # History Configuration
    history:
      enabled: boolean             # Enable preload (default: true)
      hours: number                # Hours to preload (default: 6, max: 168)

    # Enhancement Configuration
    transformations:               # Optional: array of transformations
      - type: string               # Required: processor type
        key: string                # Optional: result key (default: auto)
        # ... processor-specific options

    aggregations:                  # Optional: object of aggregations
      <aggregation_type>:
        key: string                # Optional: result key (default: type)
        window: string             # Optional: time window
        # ... aggregation-specific options
```

### Transformation Schema
```yaml
transformations:
  # Unit Conversion
  - type: unit_conversion
    from: string                   # Source unit
    to: string                     # Target unit
    factor: number                 # Alternative: multiplication factor
    offset: number                 # Addition offset (default: 0)
    customFunction: string         # Alternative: JavaScript function
    key: string                    # Result key

  # Scale/Range
  - type: scale
    input_range: [number, number]  # [min, max] source range
    output_range: [number, number] # [min, max] target range
    clamp: boolean                 # Clamp input (default: true)
    key: string                    # Result key

  # Smoothing
  - type: smooth
    method: string                 # exponential, moving_average, median
    alpha: number                  # For exponential (0-1)
    window_size: number            # For moving_average/median
    key: string                    # Result key

  # Expression
  - type: expression
    expression: string             # JavaScript expression
    key: string                    # Result key
```

### Aggregation Schema
```yaml
aggregations:
  # Moving Average
  moving_average:
    window: string                 # Time window (e.g., "5m")
    max_samples: number            # Sample count limit
    key: string                    # Result key

  # Min/Max Stats
  min_max:
    min: boolean                   # Track minimum
    max: boolean                   # Track maximum
    avg: boolean                   # Track average
    window: string                 # Optional time window
    key: string                    # Result key

  # Rate of Change
  rate_of_change:
    unit: string                   # per_second, per_minute, per_hour
    smoothing: boolean             # Apply smoothing
    key: string                    # Result key

  # Session Statistics
  session_stats:
    key: string                    # Result key

  # Recent Trend
  recent_trend:
    samples: number                # Sample count (default: 5)
    threshold: number              # Significance threshold (default: 0.01)
    key: string                    # Result key
```

---

## Troubleshooting

### Common Issues

#### 1. Transformation Errors
**Symptoms**: Console errors, null values in transformed data
**Solutions**:
- Check unit conversion format (°F vs F)
- Verify expression syntax for custom expressions
- Ensure input ranges are valid for scaling

#### 2. Missing Aggregation Data
**Symptoms**: Empty aggregation objects, no trends
**Solutions**:
- Verify sufficient data points for aggregation
- Check time window format (5m, 1h, etc.)
- Ensure entity is producing numeric values

#### 3. Rules Not Triggering
**Symptoms**: Rules don't activate with enhanced data
**Solutions**:
- Verify dot notation syntax: `source.transformations.key`
- Check entity references in rules
- Confirm data source names match

#### 4. Performance Issues
**Symptoms**: Slow rendering, memory warnings
**Solutions**:
- Reduce aggregation window sizes
- Limit transformation complexity
- Monitor buffer sizes

### Debug Commands

#### Basic Inspection
```javascript
// Get DataSourceManager
const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

// Check all sources
dsm.getStats();

// Get specific source
const source = dsm.getSource('temperature_enhanced');
source.getCurrentData();
```

#### Enhanced Data Access
```javascript
// Access current data with transformations/aggregations
const currentData = source.getCurrentData();
console.log('Transformations:', currentData.transformations);
console.log('Aggregations:', currentData.aggregations);

// Specific values
console.log('Celsius:', currentData.transformations?.celsius);
console.log('5min avg:', currentData.aggregations?.avg_5m);
```

#### Processor Statistics
```javascript
// Transformation processor stats
source.transformations.forEach((processor, key) => {
  console.log(`Transform ${key}:`, processor.getStats());
});

// Aggregation processor stats
source.aggregations.forEach((processor, key) => {
  console.log(`Aggregation ${key}:`, processor.getStats());
});
```

#### Rules Engine Integration
```javascript
// Test enhanced getEntity
dsm.getEntity('temperature_enhanced.transformations.celsius');
dsm.getEntity('temperature_enhanced.aggregations.avg_5m');

// Check rules dependencies
console.log('Rules deps:', window.__msdDebug?.rulesDeps);
```

#### Real-time Monitoring
```javascript
// Subscribe to live updates
const unsubscribe = source.subscribe((data) => {
  console.log('Live update:', {
    raw: data.v,
    transformations: data.transformations,
    aggregations: data.aggregations,
    timestamp: new Date(data.t).toISOString()
  });
});

// Stop monitoring: unsubscribe();
```

---

## Examples

### Example 1: Temperature Monitoring System
```yaml
data_sources:
  outdoor_temperature:
    type: entity
    entity: sensor.outdoor_temp_f
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
      moving_average:
        window: "30m"
        key: "avg_30m"
      daily_stats:
        min: true
        max: true
        avg: true
        key: "daily"
      recent_trend:
        samples: 10
        key: "trend"

rules:
  - id: temperature_extreme
    when:
      any:
        - entity: outdoor_temperature.transformations.celsius
          above: 35
        - entity: outdoor_temperature.transformations.celsius
          below: -10
    apply:
      overlays:
        - id: temp_warning
          style:
            color: "var(--lcars-red)"

overlays:
  - id: temp_display
    type: text
    content: |
      Temperature: {outdoor_temperature.transformations.celsius:.1f}°C
      30min Avg: {outdoor_temperature.aggregations.avg_30m:.1f}°C
      Daily Range: {outdoor_temperature.aggregations.daily.min:.1f}°C to {outdoor_temperature.aggregations.daily.max:.1f}°C
      Trend: {outdoor_temperature.aggregations.trend.direction}
```

### Example 2: Power Monitoring Dashboard
```yaml
data_sources:
  house_power:
    type: entity
    entity: sensor.house_power_watts
    transformations:
      - type: unit_conversion
        factor: 0.001
        key: "kilowatts"
      - type: scale
        input_range: [0, 5000]
        output_range: [0, 100]
        key: "percentage"
    aggregations:
      moving_average:
        window: "15m"
        key: "avg_15m"
      rate_of_change:
        unit: "per_minute"
        key: "rate"
      session_stats:
        key: "session"

rules:
  - id: high_power_usage
    when:
      all:
        - entity: house_power.transformations.kilowatts
          above: 3.5
        - entity: house_power.aggregations.rate
          above: 50  # More than 50W/min increase
    apply:
      overlays:
        - id: power_alert
          style:
            color: "var(--lcars-orange)"

overlays:
  - id: power_dashboard
    type: text
    content: |
      Current: {house_power.transformations.kilowatts:.2f} kW ({house_power.transformations.percentage:.0f}%)
      15min Avg: {house_power.aggregations.avg_15m:.2f} kW
      Rate: {house_power.aggregations.rate:+.0f} W/min
      Session Peak: {house_power.aggregations.session.max:.2f} kW

  - id: power_sparkline
    type: sparkline
    source: house_power
    style:
      color: "var(--lcars-blue)"
      width: 2
```

### Example 3: Multi-Sensor Environmental Analysis
```yaml
data_sources:
  humidity_analysis:
    type: entity
    entity: sensor.humidity_percent
    transformations:
      - type: smooth
        method: "moving_average"
        window_size: 5
        key: "smoothed"
      - type: expression
        expression: "value > 60 ? 'high' : value < 30 ? 'low' : 'normal'"
        key: "comfort_level"
    aggregations:
      moving_average:
        window: "1h"
        key: "hourly_avg"
      recent_trend:
        samples: 15
        threshold: 0.5
        key: "trend"

  air_quality:
    type: entity
    entity: sensor.air_quality_index
    transformations:
      - type: scale
        input_range: [0, 500]
        output_range: [0, 100]
        key: "percentage"
      - type: expression
        expression: |
          value <= 50 ? 'good' :
          value <= 100 ? 'moderate' :
          value <= 150 ? 'unhealthy_sensitive' :
          value <= 200 ? 'unhealthy' :
          value <= 300 ? 'very_unhealthy' : 'hazardous'
        key: "aqi_category"
    aggregations:
      daily_stats:
        min: true
        max: true
        avg: true
        key: "daily"

rules:
  - id: environmental_comfort
    when:
      all:
        - entity: humidity_analysis.transformations.comfort_level
          equals: "normal"
        - entity: air_quality.transformations.aqi_category
          in: ["good", "moderate"]
    apply:
      overlays:
        - id: comfort_indicator
          style:
            color: "var(--lcars-green)"

overlays:
  - id: environmental_status
    type: text
    content: |
      Humidity: {humidity_analysis.v:.0f}% ({humidity_analysis.transformations.comfort_level})
      Hourly Avg: {humidity_analysis.aggregations.hourly_avg:.0f}%
      Trend: {humidity_analysis.aggregations.trend.direction}

      Air Quality: {air_quality.v:.0f} AQI ({air_quality.transformations.aqi_category})
      Daily Range: {air_quality.aggregations.daily.min:.0f} - {air_quality.aggregations.daily.max:.0f}
```

---

This completes the comprehensive DataSource documentation covering all features, configuration options, and practical examples. The system provides powerful real-time data processing capabilities while maintaining performance and simplicity of configuration.