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
- **Advanced transformation pipelines** with 50+ predefined unit conversions, non-linear scaling, statistical analysis, and multi-entity expressions
- **Comprehensive aggregation engines** for moving averages, min/max tracking, rate analysis, trend detection, and duration tracking
- **Rules engine integration** with dot notation access to processed data
- **Memory-efficient** runtime-only processing (no persistent storage)
- **Performance optimized** with coalescing, throttling, and configurable windows
- **Home Assistant optimized** with device-specific conversions (brightness, volume, signal strength, etc.)

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
Convert between different units of measurement with extensive predefined conversions.

```yaml
transformations:
  # Traditional from/to format
  - type: unit_conversion
    from: "°F"                  # Source unit
    to: "°C"                    # Target unit
    key: "celsius"              # Result key

  # NEW: Direct conversion format (shortcut)
  - type: unit_conversion
    conversion: "brightness_to_percent"  # Direct conversion name
    key: "brightness_pct"

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

**Comprehensive Predefined Conversions:**

**Temperature:**
- `°f_to_°c`, `f_to_c`: Fahrenheit to Celsius
- `°c_to_°f`, `c_to_f`: Celsius to Fahrenheit
- `k_to_c`, `c_to_k`: Kelvin conversions
- `k_to_f`, `f_to_k`: Kelvin to/from Fahrenheit

**Power & Energy:**
- `w_to_kw`, `kw_to_w`: Watts ↔ Kilowatts
- `kw_to_mw`, `mw_to_kw`: Kilowatts ↔ Megawatts
- `wh_to_kwh`, `kwh_to_wh`: Watt-hours ↔ Kilowatt-hours
- `j_to_kwh`, `kwh_to_j`: Joules ↔ Kilowatt-hours

**Data Size:**
- `b_to_kb`, `kb_to_mb`, `mb_to_gb`, `gb_to_tb`: Progressive size conversions
- `kb_to_b`, `mb_to_kb`, etc.: Reverse size conversions

**Distance & Speed:**
- `mm_to_cm`, `cm_to_m`, `m_to_km`: Metric distance
- `ft_to_m`, `m_to_ft`, `in_to_cm`, `cm_to_in`: Imperial conversions
- `ms_to_kmh`, `kmh_to_ms`: Meters/sec ↔ Kilometers/hour
- `mph_to_kmh`, `kmh_to_mph`: Miles/hour ↔ Kilometers/hour

**Pressure:**
- `hpa_to_mmhg`, `mmhg_to_hpa`: Pressure units
- `psi_to_hpa`, `hpa_to_psi`: PSI conversions
- `bar_to_hpa`, `hpa_to_bar`: Bar pressure

**Home Assistant Specific:**
- `brightness_to_percent`, `percent_to_brightness`: HA brightness (0-255) ↔ percent
- `brightness_255_to_percent`, `percent_to_brightness_255`: Explicit 255 range
- `rgb_to_percent`, `percent_to_rgb`: RGB color values
- `volume_to_percent`, `percent_to_volume`: Media volume (0-1) ↔ percent
- `dbm_to_percent`, `rssi_to_percent`: WiFi/signal strength
- `lux_to_percent`: Light sensor to percentage
- `humidity_to_comfort`: Returns 'dry', 'comfortable', 'humid'
- `percent_to_decimal`, `decimal_to_percent`: Percentage conversions
- `hvac_percent_to_decimal`, `hvac_decimal_to_percent`: HVAC controls

### Scale/Range Processor
Map values from one range to another with support for non-linear curves.

```yaml
transformations:
  - type: scale
    input_range: [0, 100]       # Source range [min, max]
    output_range: [0, 1]        # Target range [min, max]
    clamp: true                 # Clamp input to range (default: true)
    curve: "linear"             # Curve type (default: linear)
    key: "normalized"

  # Non-linear scaling examples
  - type: scale
    input_range: [0, 1000]
    output_range: [0, 100]
    curve: "logarithmic"        # Better for exponential data
    key: "log_scaled"

  - type: scale
    input_range: [0, 100]
    output_range: [0, 255]
    curve: "sqrt"               # Square root curve for perceptual scaling
    key: "perceptual"
```

**Supported Curves:**
- `linear`: Standard linear interpolation
- `logarithmic`: Logarithmic curve (good for exponential data)
- `exponential`: Exponential curve (inverse of logarithmic)
- `square`: Quadratic curve (accelerating)
- `sqrt`: Square root curve (decelerating, perceptually linear)

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
Evaluate custom JavaScript expressions with enhanced context.

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

  # NEW: Multi-entity expressions
  - type: expression
    expression: "value + getEntity('sensor.other_power')"
    inputs: ["sensor.other_power"]     # Optional: pre-defined inputs
    key: "total_power"
```

**Available Context:**
- `value`: Current numeric value
- `timestamp`: Current timestamp (milliseconds)
- `buffer`: Historical data buffer (RollingBuffer instance)
- `Math`: JavaScript Math object
- `inputs`: Array of pre-defined input values (if specified)
- `getEntity(entityId)`: Function to access other HA entity values

### Statistical Processor
Calculate rolling statistical measures for anomaly detection and analysis.

```yaml
transformations:
  # Standard deviation
  - type: statistical
    method: "std_dev"
    window_size: 20
    key: "std_deviation"

  # Percentile calculation
  - type: statistical
    method: "percentile"
    percentile: 95              # 95th percentile
    window_size: 50
    key: "p95"

  # Z-Score for anomaly detection
  - type: statistical
    method: "z_score"
    window_size: 30
    key: "anomaly_score"        # Values > 2 or < -2 are anomalies
```

**Statistical Methods:**
- `std_dev`: Rolling standard deviation
- `percentile`: Configurable percentile (e.g., 95th percentile)
- `z_score`: Z-score for anomaly detection (> ±2 indicates anomaly)

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

### Duration Aggregation
Track how long conditions are maintained (NEW).

```yaml
aggregations:
  duration:
    condition: "above"          # above, below, equals, range
    threshold: 25               # Value threshold
    units: "minutes"            # seconds, minutes, hours
    key: "high_temp_duration"

  # Range condition example
  comfort_zone_duration:
    condition: "range"
    range: [20, 25]             # Temperature comfort zone
    units: "hours"
    key: "comfort_duration"
```

**Result Structure:**
```javascript
{
  current: 12.5,              // Current streak duration
  total: 45.3,                // Total duration in session
  longest: 23.1,              // Longest streak recorded
  isActive: true,             // Whether condition is currently met
  units: "minutes"            // Unit of measurement
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
    conversion: string             # NEW: Direct conversion format (e.g., "cm_to_in")
    factor: number                 # Alternative: multiplication factor
    offset: number                 # Addition offset (default: 0)
    customFunction: string         # Alternative: JavaScript function
    key: string                    # Result key

  # Scale/Range
  - type: scale
    input_range: [number, number]  # [min, max] source range
    output_range: [number, number] # [min, max] target range
    clamp: boolean                 # Clamp input (default: true)
    curve: string                  # NEW: linear, logarithmic, exponential, square, sqrt
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
    inputs: [string]               # NEW: Optional pre-defined entity inputs
    key: string                    # Result key

  # Statistical (NEW)
  - type: statistical
    method: string                 # std_dev, percentile, z_score
    window_size: number            # Rolling window size
    percentile: number             # For percentile method (0-100)
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

  # Duration (NEW)
  duration:
    condition: string              # above, below, equals, range
    threshold: number              # Value threshold (for above/below/equals)
    range: [number, number]        # Value range (for range condition)
    units: string                  # seconds, minutes, hours
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

### Example 4: Smart Home Device Control & Monitoring
```yaml
data_sources:
  # Light brightness control with HA-specific conversions
  living_room_light:
    type: entity
    entity: light.living_room
    attribute: brightness
    transformations:
      # Direct conversion format for common HA values
      - type: unit_conversion
        conversion: "brightness_to_percent"
        key: "brightness_pct"

      # Non-linear scaling for perceptual brightness
      - type: scale
        input_range: [0, 100]
        output_range: [0, 255]
        curve: "sqrt"              # Perceptually linear
        key: "perceptual_brightness"

    aggregations:
      # Track how long lights are at full brightness
      duration:
        condition: "above"
        threshold: 90              # 90% brightness
        units: "hours"
        key: "high_brightness_time"

  # WiFi signal monitoring with anomaly detection
  wifi_signal:
    type: entity
    entity: sensor.wifi_signal_dbm
    transformations:
      - type: unit_conversion
        conversion: "dbm_to_percent"
        key: "signal_strength"

      # Detect signal anomalies
      - type: statistical
        method: "z_score"
        window_size: 50
        key: "anomaly_score"

    aggregations:
      session_stats:
        key: "connection_quality"

  # Smart thermostat with comfort zone tracking
  thermostat:
    type: entity
    entity: climate.main
    attribute: current_temperature
    transformations:
      - type: smooth
        method: "exponential"
        alpha: 0.1                 # Heavy smoothing for temperature
        key: "smoothed"

    aggregations:
      # Track time in comfort zone
      duration:
        condition: "range"
        range: [20, 24]            # Comfort zone 20-24°C
        units: "hours"
        key: "comfort_time"

      recent_trend:
        samples: 20
        threshold: 0.05            # 0.05°C/sample sensitivity
        key: "temp_trend"

rules:
  # Smart lighting rule
  - id: optimize_lighting
    when:
      all:
        - entity: living_room_light.aggregations.high_brightness_time.current
          above: 2                 # High brightness for > 2 hours
        - entity: living_room_light.transformations.brightness_pct
          above: 95
    apply:
      overlays:
        - id: energy_saving_tip
          style:
            color: "var(--lcars-yellow)"

  # Network quality alert
  - id: wifi_quality_alert
    when:
      any:
        - entity: wifi_signal.transformations.signal_strength
          below: 30                # Poor signal
        - entity: wifi_signal.transformations.anomaly_score
          above: 2                 # Signal anomaly detected
    apply:
      overlays:
        - id: network_warning
          style:
            color: "var(--lcars-red)"

  # Climate comfort optimization
  - id: climate_comfort
    when:
      all:
        - entity: thermostat.aggregations.comfort_time.current
          below: 0.5               # Less than 30min in comfort zone
        - entity: thermostat.aggregations.temp_trend.direction
          not_equals: "stable"
    apply:
      overlays:
        - id: climate_suggestion
          style:
            color: "var(--lcars-blue)"

overlays:
  - id: smart_home_dashboard
    type: text
    content: |
      🏠 Smart Home Status

      💡 Living Room Light: {living_room_light.transformations.brightness_pct:.0f}%
         High Brightness: {living_room_light.aggregations.high_brightness_time.current:.1f}h today

      📶 WiFi Signal: {wifi_signal.transformations.signal_strength:.0f}%
         Quality: {wifi_signal.aggregations.connection_quality.avg:.0f}% avg
         Anomaly Score: {wifi_signal.transformations.anomaly_score:.1f}

      🌡️ Temperature: {thermostat.transformations.smoothed:.1f}°C
         Comfort Time: {thermostat.aggregations.comfort_time.current:.1f}h
         Trend: {thermostat.aggregations.temp_trend.direction}

  # Advanced sparkline showing signal quality over time
  - id: wifi_quality_chart
    type: sparkline
    source: wifi_signal
    data_key: "signal_strength"
    style:
      color: "var(--lcars-green)"
      warning_threshold: 50
      critical_threshold: 30
```

### Example 5: Environmental Monitoring with Comprehensive Analysis
```yaml
data_sources:
  environmental_station:
    type: entity
    entity: sensor.bme680_temperature
    transformations:
      # Multi-entity expression combining sensors
      - type: expression
        expression: |
          const temp = value;
          const humidity = getEntity('sensor.bme680_humidity');
          const pressure = getEntity('sensor.bme680_pressure');

          // Calculate heat index
          if (temp < 26.7) return temp;
          const hi = -8.784 + 1.611*temp + 2.339*humidity - 0.146*temp*humidity;
          return hi;
        inputs: ["sensor.bme680_humidity", "sensor.bme680_pressure"]
        key: "heat_index"

      # Comfort level assessment
      - type: expression
        expression: |
          const hi = transformations.heat_index || value;
          if (hi < 27) return 'comfortable';
          if (hi < 32) return 'caution';
          if (hi < 40) return 'extreme_caution';
          return 'danger';
        key: "comfort_level"

    aggregations:
      # Daily temperature statistics
      daily_stats:
        min: true
        max: true
        avg: true
        window: "24h"
        key: "daily_temp"

      # Track extreme heat events
      duration:
        condition: "above"
        threshold: 35              # Heat wave threshold
        units: "hours"
        key: "heat_wave_duration"

      # Environmental trend analysis
      recent_trend:
        samples: 30
        threshold: 0.1
        key: "environmental_trend"

  air_quality_monitor:
    type: entity
    entity: sensor.air_quality_pm25
    transformations:
      # AQI calculation from PM2.5
      - type: expression
        expression: |
          // EPA AQI calculation for PM2.5
          if (value <= 12.0) return Math.round(value * 50 / 12.0);
          if (value <= 35.4) return Math.round(51 + (value - 12.1) * 49 / 23.3);
          if (value <= 55.4) return Math.round(101 + (value - 35.5) * 49 / 19.9);
          if (value <= 150.4) return Math.round(151 + (value - 55.5) * 49 / 94.9);
          return Math.min(500, Math.round(201 + (value - 150.5) * 99 / 99.9));
        key: "aqi"

      # Health impact classification
      - type: expression
        expression: |
          const aqi = transformations.aqi || 0;
          if (aqi <= 50) return 'good';
          if (aqi <= 100) return 'moderate';
          if (aqi <= 150) return 'unhealthy_sensitive';
          if (aqi <= 200) return 'unhealthy';
          if (aqi <= 300) return 'very_unhealthy';
          return 'hazardous';
        key: "health_impact"

    aggregations:
      moving_average:
        window: "2h"
        key: "avg_2h"

      session_stats:
        key: "air_quality_session"

rules:
  - id: environmental_health_alert
    when:
      any:
        # Heat-related health risk
        - entity: environmental_station.transformations.comfort_level
          in: ["extreme_caution", "danger"]

        # Air quality health risk
        - entity: air_quality_monitor.transformations.health_impact
          in: ["unhealthy", "very_unhealthy", "hazardous"]

        # Sustained poor conditions
        - entity: environmental_station.aggregations.heat_wave_duration.current
          above: 2                 # 2+ hours of extreme heat
    apply:
      overlays:
        - id: health_warning
          style:
            color: "var(--lcars-red)"
            pulse: true

overlays:
  - id: environmental_dashboard
    type: text
    content: |
      🌡️ Environmental Station
      Temperature: {environmental_station.v:.1f}°C (Heat Index: {environmental_station.transformations.heat_index:.1f}°C)
      Comfort: {environmental_station.transformations.comfort_level}
      Daily Range: {environmental_station.aggregations.daily_temp.min:.1f}°C - {environmental_station.aggregations.daily_temp.max:.1f}°C
      Trend: {environmental_station.aggregations.environmental_trend.direction}

      🌬️ Air Quality
      PM2.5: {air_quality_monitor.v:.1f} μg/m³ (AQI: {air_quality_monitor.transformations.aqi:.0f})
      Health Impact: {air_quality_monitor.transformations.health_impact}
      2hr Average: {air_quality_monitor.aggregations.avg_2h:.1f} μg/m³

      ⚠️ Alerts
      Heat Wave Duration: {environmental_station.aggregations.heat_wave_duration.current:.1f}h
```

---

This completes the comprehensive DataSource documentation covering all features, configuration options, and practical examples. The system provides powerful real-time data processing capabilities while maintaining performance and simplicity of configuration.