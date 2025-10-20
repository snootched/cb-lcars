## Aggregations

Aggregations calculate statistics over time windows. They are defined as an array of aggregation configurations.

### Configuration Format

```yaml
data_sources:
  temperature:
    entity: sensor.outside_temp

    aggregations:
      - type: min_max              # Aggregation type
        key: daily_stats           # Unique identifier
        window: "24h"              # Time window
        min: true                  # Track minimum
        max: true                  # Track maximum
        avg: true                  # Track average

      - type: moving_average
        key: temp_avg
        window_size: 10
```

### Available Aggregation Types

#### 1. **moving_average**

Calculates rolling average over a time window or sample count.

```yaml
aggregations:
  - type: moving_average
    key: temp_avg
    window: "1h"           # Time window (optional)
    window_size: 20        # Or sample count (optional)
```

#### 2. **min_max**

Tracks minimum, maximum, and average values over a window.

```yaml
aggregations:
  - type: min_max
    key: daily_stats
    window: "24h"
    min: true              # Track minimum
    max: true              # Track maximum
    avg: true              # Track average (optional)
```

#### 3. **rate_of_change**

Calculates rate of change between values.

```yaml
aggregations:
  - type: rate_of_change
    key: temp_rate
    unit: "per_hour"       # per_second, per_minute, per_hour
    smoothing: true        # Optional smoothing
```

#### 4. **session_stats**

Tracks statistics since page load/reset.

```yaml
aggregations:
  - type: session_stats
    key: session_info
    # No additional config needed
```

#### 5. **duration**

Tracks how long a condition has been true.

```yaml
aggregations:
  - type: duration
    key: high_temp_duration
    condition: "above"     # above, below, equals, range
    threshold: 80
    units: "hours"         # seconds, minutes, hours
```

#### 6. **recent_trend**

Analyzes trend direction using linear regression.

```yaml
aggregations:
  - type: recent_trend
    key: temp_trend
    samples: 10            # Number of recent samples
    threshold: 0.01        # Minimum change for significance
```

### Chaining Aggregations from Transformations

Aggregations can chain from transformation outputs using `input_source`:

```yaml
data_sources:
  temperature:
    entity: sensor.outside_temp

    transformations:
      - type: unit_conversion
        conversion: f_to_c
        key: celsius

    aggregations:
      - type: min_max
        key: celsius_stats
        input_source: celsius    # ✅ Chain from transformation
        window: "24h"
        min: true
        max: true
```

### Using Aggregation Data

Access aggregation data via dot notation:

```yaml
overlays:
  - id: temp-max-text
    type: text
    text: "{{ temperature.aggregations.daily_stats.max }}°F"
    position: [100, 100]
```

Or in ApexCharts:

```yaml
overlays:
  - id: temp-avg-chart
    type: apexchart
    source: "temperature.aggregations.temp_avg"
    chart_type: line
```

### Complete Example

```yaml
data_sources:
  power_meter:
    entity: sensor.power_usage
    windowSeconds: 3600

    transformations:
      - type: unit_conversion
        conversion: w_to_kw
        key: kw

      - type: smooth
        input_source: kw
        method: "moving_average"
        window_size: 5
        key: kw_smooth

    aggregations:
      - type: min_max
        key: hourly_stats
        input_source: kw_smooth
        window: "1h"
        min: true
        max: true
        avg: true

      - type: rate_of_change
        key: power_rate
        input_source: kw_smooth
        unit: "per_minute"

      - type: recent_trend
        key: power_trend
        input_source: kw_smooth
        samples: 20
```