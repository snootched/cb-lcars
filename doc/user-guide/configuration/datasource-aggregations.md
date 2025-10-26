# DataSource Aggregations Reference

> **Complete guide to aggregation processors**
> Analyze time-windowed data with moving averages, min/max tracking, rate calculations, statistical analysis, trend detection, and duration tracking.

---

## 🎯 Overview

Aggregations analyze data over time windows, providing statistical measures, trends, and insights from historical data. Unlike transformations that process individual values, aggregations operate on data buffers to derive meaningful patterns.

**Key Features:**
- ✅ Time-windowed analysis (5m, 1h, 24h, etc.)
- ✅ Moving averages with configurable windows
- ✅ Min/max/average statistical tracking
- ✅ Rate of change calculations
- ✅ Trend detection (increasing/decreasing/stable)
- ✅ Duration tracking for condition monitoring
- ✅ Session-based statistics
- ✅ Automatic buffer management

---

## 📋 Table of Contents

1. [Aggregation Basics](#aggregation-basics)
2. [Moving Average](#moving-average)
3. [Min/Max Statistics](#minmax-statistics)
4. [Rate of Change](#rate-of-change)
5. [Session Statistics](#session-statistics)
6. [Recent Trend](#recent-trend)
7. [Duration Tracking](#duration-tracking)
8. [Time Windows](#time-windows)
9. [Examples](#examples)

---

## 🔧 Aggregation Basics

### How Aggregations Work

```
Historical Buffer → Aggregation Processor → Statistical Result
[v1, v2, v3, ...]        (analyze)         {avg: X, min: Y, ...}
```

Aggregations:
- Operate on buffered historical data
- Update with each new data point
- Produce structured result objects
- Store results with unique keys
- Are accessible via dot notation

### Basic Syntax

```yaml
data_sources:
  sensor_name:
    type: entity
    entity: sensor.entity_id
    windowSeconds: 300          # 5 minute buffer
    aggregations:
      <aggregation_type>:
        # ... aggregation-specific properties
        key: <result_name>
```

### Accessing Results

```yaml
overlays:
  - content: "Raw: {sensor_name.value}"
  - content: "Avg: {sensor_name.aggregations.result_name.avg}"
  - content: "Min: {sensor_name.aggregations.result_name.min}"
```

### Buffer Requirements

Aggregations require sufficient historical data:
- **Minimum**: 2-3 data points for basic calculations
- **Recommended**: 10+ points for stable statistics
- **Window size**: Set `windowSeconds` ≥ aggregation window

---

## 📊 Moving Average

Calculate rolling averages over time windows.

### Basic Usage

```yaml
aggregations:
  moving_average:
    window: "5m"               # Time window
    key: "avg_5m"
```

### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `window` | string | ✅ | - | Time window (e.g., "5m", "1h") |
| `max_samples` | number | ❌ | unlimited | Maximum sample count |
| `key` | string | ❌ | `"moving_average"` | Result key name |

### Result Structure

```javascript
{
  value: 23.4,                  // Moving average value
  samples: 30,                  // Number of samples in window
  window: "5m",                 // Time window
  oldest: 1698345600000,        // Oldest sample timestamp
  newest: 1698345900000         // Newest sample timestamp
}
```

### Examples

**Simple 5-minute average:**
```yaml
aggregations:
  moving_average:
    window: "5m"
    key: "avg_5m"
```

**Multiple time windows:**
```yaml
aggregations:
  short_avg:
    window: "5m"
    key: "avg_5m"

  medium_avg:
    window: "30m"
    key: "avg_30m"

  long_avg:
    window: "6h"
    key: "avg_6h"
```

**Sample-limited average:**
```yaml
aggregations:
  moving_average:
    window: "1h"
    max_samples: 100           # Limit to 100 most recent samples
    key: "avg_1h"
```

### Use Cases

- **Smoothing noisy sensors**: Temperature, humidity, pressure
- **Power monitoring**: Average consumption over time
- **Network analysis**: Average bandwidth, latency
- **Comparing timeframes**: Short vs. long-term trends

---

## 📈 Min/Max Statistics

Track minimum, maximum, and average values over time windows.

### Basic Usage

```yaml
aggregations:
  min_max:
    min: true
    max: true
    avg: true
    window: "24h"              # Optional time window
    key: "daily_stats"
```

### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `min` | boolean | ❌ | `true` | Track minimum value |
| `max` | boolean | ❌ | `true` | Track maximum value |
| `avg` | boolean | ❌ | `true` | Track average value |
| `window` | string | ❌ | session | Time window (omit for session) |
| `key` | string | ❌ | `"min_max"` | Result key name |

### Result Structure

```javascript
{
  min: 15.2,                    // Minimum value in window
  max: 28.7,                    // Maximum value in window
  avg: 22.1,                    // Average value in window
  samples: 144,                 // Number of samples
  minTimestamp: 1698302400000,  // When minimum occurred
  maxTimestamp: 1698334800000,  // When maximum occurred
  window: "24h"                 // Time window (or "session")
}
```

### Examples

**Daily temperature range:**
```yaml
aggregations:
  min_max:
    min: true
    max: true
    avg: true
    window: "24h"
    key: "daily"
```

**Session-based statistics (no window):**
```yaml
aggregations:
  min_max:
    min: true
    max: true
    avg: true
    key: "session_stats"
```

**Track only max (for peak detection):**
```yaml
aggregations:
  min_max:
    min: false
    max: true
    avg: false
    window: "1h"
    key: "peak_1h"
```

### Use Cases

- **Daily summaries**: Temperature range, humidity extremes
- **Peak tracking**: Maximum power consumption, traffic spikes
- **Capacity planning**: Average load, peak usage
- **Performance monitoring**: Response time min/max/avg

---

## 📉 Rate of Change

Calculate how fast values are changing over time.

### Basic Usage

```yaml
aggregations:
  rate_of_change:
    unit: "per_minute"
    smoothing: true
    key: "rate"
```

### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `unit` | string | ✅ | - | Rate unit: `per_second`, `per_minute`, `per_hour` |
| `smoothing` | boolean | ❌ | `false` | Apply smoothing to rate |
| `key` | string | ❌ | `"rate_of_change"` | Result key name |

### Result Structure

```javascript
{
  rate: 1.2,                    // Rate of change value
  unit: "per_minute",           // Rate unit
  direction: "increasing",      // Direction: increasing, decreasing, stable
  absoluteRate: 1.2,            // Absolute value of rate
  previousValue: 45.3,          // Previous value
  currentValue: 46.5,           // Current value
  deltaTime: 60000              // Time difference (ms)
}
```

### Examples

**Power consumption rate:**
```yaml
data_sources:
  power_meter:
    type: entity
    entity: sensor.power_watts
    aggregations:
      rate_of_change:
        unit: "per_minute"
        smoothing: true
        key: "rate"
```

**Temperature change rate:**
```yaml
aggregations:
  rate_of_change:
    unit: "per_hour"
    smoothing: false           # Raw rate for fast detection
    key: "temp_rate"
```

**Multiple rate calculations:**
```yaml
aggregations:
  rate_per_sec:
    unit: "per_second"
    key: "rate_sec"

  rate_per_min:
    unit: "per_minute"
    key: "rate_min"

  rate_per_hour:
    unit: "per_hour"
    key: "rate_hour"
```

### Use Cases

- **Power monitoring**: Detecting rapid power increases
- **Temperature alerts**: Fast temperature changes
- **Battery monitoring**: Discharge/charge rate
- **Network analysis**: Bandwidth change rate
- **Predictive maintenance**: Abnormal rate changes

---

## 📋 Session Statistics

Track comprehensive statistics for the entire session (page load to now).

### Basic Usage

```yaml
aggregations:
  session_stats:
    key: "session"
```

### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `key` | string | ❌ | `"session_stats"` | Result key name |

### Result Structure

```javascript
{
  min: 18.2,                    // Minimum value in session
  max: 32.1,                    // Maximum value in session
  avg: 24.7,                    // Average value in session
  count: 1847,                  // Total sample count
  sum: 45623.9,                 // Sum of all values
  first: 22.3,                  // First value in session
  last: 24.8,                   // Last (current) value
  range: 13.9,                  // Range (max - min)
  startTime: 1698302400000,     // Session start timestamp
  lastUpdate: 1698345900000,    // Last update timestamp
  duration: 43500000            // Session duration (ms)
}
```

### Examples

**Simple session tracking:**
```yaml
aggregations:
  session_stats:
    key: "session"
```

**Multiple sensors with session stats:**
```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.temperature
    aggregations:
      session_stats:
        key: "temp_session"

  humidity:
    type: entity
    entity: sensor.humidity
    aggregations:
      session_stats:
        key: "humid_session"
```

### Use Cases

- **Session summaries**: Overall performance since page load
- **Comparison**: Current vs. session average
- **Dashboard metrics**: Total samples, duration, range
- **Performance tracking**: Session min/max/avg

---

## 📈 Recent Trend

Detect current trend direction (increasing, decreasing, stable) from recent samples.

### Basic Usage

```yaml
aggregations:
  recent_trend:
    samples: 5                 # Number of recent samples
    threshold: 0.01            # Significance threshold
    key: "trend"
```

### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `samples` | number | ❌ | `5` | Number of recent samples |
| `threshold` | number | ❌ | `0.01` | Minimum slope for trend |
| `key` | string | ❌ | `"recent_trend"` | Result key name |

### Result Structure

```javascript
{
  direction: "increasing",      // Direction: increasing, decreasing, stable
  strength: 0.045,              // Magnitude of trend (absolute)
  slope: 0.045,                 // Raw slope value (can be negative)
  samples: 5,                   // Number of samples analyzed
  confidence: 0.87              // Trend confidence (0-1)
}
```

### Direction Values

- **`"increasing"`**: Values trending upward (slope > threshold)
- **`"decreasing"`**: Values trending downward (slope < -threshold)
- **`"stable"`**: No significant trend (|slope| ≤ threshold)

### Examples

**Basic trend detection:**
```yaml
aggregations:
  recent_trend:
    samples: 5
    threshold: 0.01
    key: "trend"
```

**Sensitive trend detection:**
```yaml
aggregations:
  recent_trend:
    samples: 10                # More samples = smoother
    threshold: 0.001           # Lower threshold = more sensitive
    key: "sensitive_trend"
```

**Fast trend detection:**
```yaml
aggregations:
  recent_trend:
    samples: 3                 # Fewer samples = faster response
    threshold: 0.05            # Higher threshold = less sensitive
    key: "fast_trend"
```

**Temperature trend example:**
```yaml
data_sources:
  outdoor_temp:
    type: entity
    entity: sensor.temperature
    aggregations:
      recent_trend:
        samples: 10
        threshold: 0.05        # 0.05°C/sample
        key: "temp_trend"
```

### Use Cases

- **Alerts**: Trigger when value starts increasing/decreasing
- **Visual indicators**: Show trend arrows on dashboards
- **Predictive**: Early warning of changes
- **Automation**: Adjust based on trend direction

---

## ⏱️ Duration Tracking

Track how long values maintain specific conditions.

### Basic Usage

```yaml
aggregations:
  duration:
    condition: "above"
    threshold: 25
    units: "minutes"
    key: "high_duration"
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `condition` | string | ✅ | Condition type: `above`, `below`, `equals`, `range` |
| `threshold` | number | ❌* | Threshold value (for above/below/equals) |
| `range` | [number, number] | ❌* | Range [min, max] (for range condition) |
| `units` | string | ✅ | Time units: `seconds`, `minutes`, `hours` |
| `key` | string | ❌ | Result key name (default: `"duration"`) |

\* Either `threshold` (for above/below/equals) or `range` (for range) is required

### Result Structure

```javascript
{
  current: 12.5,                // Current streak duration
  total: 45.3,                  // Total duration in session
  longest: 23.1,                // Longest streak recorded
  count: 3,                     // Number of times condition met
  isActive: true,               // Whether condition currently met
  units: "minutes",             // Unit of measurement
  condition: "above",           // Condition being tracked
  threshold: 25                 // Threshold value (if applicable)
}
```

### Condition Types

**Above threshold:**
```yaml
aggregations:
  duration:
    condition: "above"
    threshold: 30
    units: "minutes"
    key: "high_temp_duration"
```

**Below threshold:**
```yaml
aggregations:
  duration:
    condition: "below"
    threshold: 20
    units: "hours"
    key: "low_battery_duration"
```

**Equals value:**
```yaml
aggregations:
  duration:
    condition: "equals"
    threshold: 0               # Track time at zero
    units: "seconds"
    key: "zero_duration"
```

**In range (comfort zone):**
```yaml
aggregations:
  duration:
    condition: "range"
    range: [20, 25]            # Between 20-25°C
    units: "hours"
    key: "comfort_duration"
```

### Examples

**High temperature tracking:**
```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.outdoor_temp
    aggregations:
      duration:
        condition: "above"
        threshold: 30
        units: "hours"
        key: "hot_duration"
```

**Comfort zone monitoring:**
```yaml
aggregations:
  comfort_duration:
    condition: "range"
    range: [20, 24]
    units: "hours"
    key: "comfort_time"

  too_cold_duration:
    condition: "below"
    threshold: 20
    units: "hours"
    key: "cold_time"

  too_hot_duration:
    condition: "above"
    threshold: 24
    units: "hours"
    key: "hot_time"
```

**Binary state tracking:**
```yaml
data_sources:
  motion_sensor:
    type: entity
    entity: binary_sensor.motion
    aggregations:
      duration:
        condition: "equals"
        threshold: 1           # 1 = on/detected
        units: "minutes"
        key: "motion_duration"
```

### Use Cases

- **Compliance monitoring**: Track time in acceptable range
- **Energy management**: Track high usage duration
- **Comfort tracking**: Time in comfort zone
- **Alert fatigue reduction**: Only alert after X duration
- **Usage statistics**: How long devices are on/off

---

## ⏰ Time Windows

Time window formats used across aggregation types.

### Window Format

```yaml
window: "<number><unit>"
```

**Supported units:**
- `s` - seconds
- `m` - minutes
- `h` - hours
- `d` - days

### Examples

```yaml
# 30 seconds
window: "30s"

# 5 minutes
window: "5m"

# 1 hour
window: "1h"

# 6 hours
window: "6h"

# 24 hours (1 day)
window: "24h"

# 7 days (1 week)
window: "168h"
```

### Buffer Configuration

Ensure your datasource buffer is large enough for your aggregation windows:

```yaml
data_sources:
  my_sensor:
    type: entity
    entity: sensor.entity_id
    windowSeconds: 3600        # 1 hour buffer
    aggregations:
      moving_average:
        window: "30m"          # ✅ Fits in 1 hour buffer
        key: "avg_30m"

      min_max:
        window: "1h"           # ✅ Fits in 1 hour buffer
        key: "hourly_stats"
```

### Recommended Window Sizes

**Real-time dashboards:**
```yaml
windowSeconds: 300             # 5 minutes
aggregations:
  moving_average:
    window: "1m"               # 1 minute average
  recent_trend:
    samples: 5                 # Last 5 samples
```

**Trend analysis:**
```yaml
windowSeconds: 3600            # 1 hour
aggregations:
  moving_average:
    window: "15m"              # 15 minute average
  min_max:
    window: "1h"               # Hourly stats
```

**Daily summaries:**
```yaml
windowSeconds: 86400           # 24 hours
aggregations:
  moving_average:
    window: "6h"               # 6 hour average
  min_max:
    window: "24h"              # Daily min/max
```

---

## 💡 Examples

### Complete Temperature Monitoring

```yaml
data_sources:
  outdoor_temperature:
    type: entity
    entity: sensor.outdoor_temp
    windowSeconds: 86400       # 24 hour buffer

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
      # Short-term average
      short_avg:
        window: "5m"
        key: "avg_5m"

      # Medium-term average
      medium_avg:
        window: "1h"
        key: "avg_1h"

      # Daily statistics
      daily_stats:
        min: true
        max: true
        avg: true
        window: "24h"
        key: "daily"

      # Trend detection
      recent_trend:
        samples: 10
        threshold: 0.05
        key: "trend"

      # Comfort zone tracking
      comfort_duration:
        condition: "range"
        range: [20, 25]
        units: "hours"
        key: "comfort_time"

      # Session statistics
      session_stats:
        key: "session"

overlays:
  - type: text
    content: |
      🌡️ Temperature Monitor

      Current: {outdoor_temperature.transformations.celsius:.1f}°C
      Smoothed: {outdoor_temperature.transformations.smoothed:.1f}°C

      Averages:
      - 5min: {outdoor_temperature.aggregations.avg_5m.value:.1f}°C
      - 1hour: {outdoor_temperature.aggregations.avg_1h.value:.1f}°C

      Daily Stats:
      - Min: {outdoor_temperature.aggregations.daily.min:.1f}°C
      - Max: {outdoor_temperature.aggregations.daily.max:.1f}°C
      - Avg: {outdoor_temperature.aggregations.daily.avg:.1f}°C

      Trend: {outdoor_temperature.aggregations.trend.direction}
      Comfort Time: {outdoor_temperature.aggregations.comfort_time.current:.1f}h
```

### Power Consumption Dashboard

```yaml
data_sources:
  house_power:
    type: entity
    entity: sensor.power_watts
    windowSeconds: 3600        # 1 hour buffer

    transformations:
      - type: unit_conversion
        conversion: "w_to_kw"
        key: "kilowatts"

    aggregations:
      # 15-minute average
      moving_average:
        window: "15m"
        key: "avg_15m"

      # Peak tracking
      min_max:
        min: false
        max: true
        avg: true
        window: "1h"
        key: "peak"

      # Rate of change
      rate_of_change:
        unit: "per_minute"
        smoothing: true
        key: "rate"

      # High usage duration
      duration:
        condition: "above"
        threshold: 3000          # 3kW
        units: "minutes"
        key: "high_usage"

      # Session statistics
      session_stats:
        key: "session"

rules:
  - id: high_power_alert
    when:
      all:
        - entity: house_power.transformations.kilowatts
          above: 3.5
        - entity: house_power.aggregations.rate.rate
          above: 50              # More than 50W/min increase
    apply:
      overlays:
        - id: power_warning
          style:
            color: "var(--lcars-red)"

overlays:
  - type: text
    content: |
      ⚡ Power Monitor

      Current: {house_power.transformations.kilowatts:.2f} kW
      15min Avg: {house_power.aggregations.avg_15m.value:.2f} kW

      Hourly Peak: {house_power.aggregations.peak.max:.2f} kW
      Rate: {house_power.aggregations.rate.rate:+.0f} W/min

      High Usage: {house_power.aggregations.high_usage.current:.1f} min
      Session Peak: {house_power.aggregations.session.max:.2f} kW
```

### Multi-Sensor Environmental Monitor

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.temperature
    windowSeconds: 3600
    aggregations:
      moving_average:
        window: "30m"
        key: "avg"
      recent_trend:
        samples: 10
        key: "trend"

  humidity:
    type: entity
    entity: sensor.humidity
    windowSeconds: 3600
    aggregations:
      moving_average:
        window: "30m"
        key: "avg"
      min_max:
        window: "1h"
        key: "range"

  pressure:
    type: entity
    entity: sensor.pressure
    windowSeconds: 3600
    aggregations:
      rate_of_change:
        unit: "per_hour"
        key: "rate"
      recent_trend:
        samples: 5
        key: "trend"

rules:
  - id: weather_change
    when:
      all:
        - entity: pressure.aggregations.rate.rate
          below: -2              # Dropping pressure
        - entity: humidity.aggregations.avg.value
          above: 70              # High humidity
    apply:
      overlays:
        - id: storm_warning
          style:
            color: "var(--lcars-orange)"

overlays:
  - type: text
    content: |
      🌤️ Environmental Monitor

      Temperature: {temperature.value:.1f}°C
      - Avg: {temperature.aggregations.avg.value:.1f}°C
      - Trend: {temperature.aggregations.trend.direction}

      Humidity: {humidity.value:.0f}%
      - Avg: {humidity.aggregations.avg.value:.0f}%
      - Range: {humidity.aggregations.range.min:.0f}%-{humidity.aggregations.range.max:.0f}%

      Pressure: {pressure.value:.0f} hPa
      - Rate: {pressure.aggregations.rate.rate:+.1f} hPa/h
      - Trend: {pressure.aggregations.trend.direction}
```

---

## 📚 Related Documentation

- [DataSources Configuration Guide](datasources.md)
- [Transformation Reference](datasource-transformations.md)
- [Computed Sources Guide](computed-sources.md)
- [DataSource Examples](../examples/datasource-examples.md)

---

**Last Updated:** October 26, 2025
**Version:** 2025.10.1-fuk.42-69
