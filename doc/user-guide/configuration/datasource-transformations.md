# DataSource Transformations Reference

> **Complete guide to transformation processors**
> Transform raw sensor data with 50+ predefined unit conversions, scaling, smoothing, expressions, and statistical analysis.

---

## 🎯 Overview

Transformations process data as it flows through a datasource. They can be chained to create complex processing pipelines, with each transformation's output available for use in templates and rules.

**Key Features:**
- ✅ 50+ predefined unit conversions
- ✅ Linear and non-linear scaling
- ✅ Multiple smoothing algorithms
- ✅ JavaScript expressions with full Math library
- ✅ Statistical analysis (std dev, percentiles, z-scores)
- ✅ Multi-entity expressions
- ✅ Chainable transformations

---

## 📋 Table of Contents

1. [Transformation Basics](#transformation-basics)
2. [Unit Conversion](#unit-conversion)
3. [Scale/Range](#scalerange)
4. [Smoothing](#smoothing)
5. [Expressions](#expressions)
6. [Statistical](#statistical)
7. [Chaining Transformations](#chaining-transformations)
8. [Examples](#examples)

---

## 🔧 Transformation Basics

### How Transformations Work

```
Raw Value → Transform 1 → Transform 2 → Transform 3 → Final Value
              ↓              ↓              ↓
            key: step1    key: step2    key: step3
```

Each transformation:
- Receives input value
- Processes it according to configuration
- Stores result with unique `key`
- Passes result to next transformation

### Basic Syntax

```yaml
data_sources:
  sensor_name:
    type: entity
    entity: sensor.entity_id
    transformations:
      - type: <transformation_type>
        key: <result_name>
        # ... transformation-specific properties
```

### Accessing Results

```yaml
overlays:
  - content: "Raw: {sensor_name.value}"
  - content: "Transformed: {sensor_name.transformations.result_name}"
```

---

## 🌡️ Unit Conversion

Convert between different units of measurement with 50+ predefined conversions.

### Basic Usage

```yaml
transformations:
  # Traditional from/to format
  - type: unit_conversion
    from: "°F"
    to: "°C"
    key: "celsius"

  # Direct conversion name (shortcut)
  - type: unit_conversion
    conversion: "brightness_to_percent"
    key: "brightness_pct"

  # Factor-based conversion
  - type: unit_conversion
    factor: 0.001
    offset: 0
    key: "kilowatts"

  # Custom function
  - type: unit_conversion
    customFunction: "value => (value - 32) * 5/9"
    key: "custom"
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | ✅ | Always `unit_conversion` |
| `from` | string | ❌ | Source unit (use with `to`) |
| `to` | string | ❌ | Target unit (use with `from`) |
| `conversion` | string | ❌ | Direct conversion name |
| `factor` | number | ❌ | Multiplication factor |
| `offset` | number | ❌ | Addition offset |
| `customFunction` | string | ❌ | JavaScript function string |
| `key` | string | ✅ | Result key name |

---

### Temperature Conversions

**Fahrenheit ↔ Celsius:**
```yaml
- type: unit_conversion
  from: "°F"
  to: "°C"
  key: "celsius"
```

**Available conversions:**
- `°f_to_°c`, `f_to_c` - Fahrenheit to Celsius
- `°c_to_°f`, `c_to_f` - Celsius to Fahrenheit
- `k_to_c`, `c_to_k` - Kelvin ↔ Celsius
- `k_to_f`, `f_to_k` - Kelvin ↔ Fahrenheit

**Example:**
```yaml
data_sources:
  outdoor_temp:
    type: entity
    entity: sensor.temperature_f
    transformations:
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"
      - type: unit_conversion
        from: "°C"
        to: "K"
        key: "kelvin"
```

---

### Power & Energy Conversions

**Power:**
- `w_to_kw` - Watts to Kilowatts
- `kw_to_w` - Kilowatts to Watts
- `kw_to_mw` - Kilowatts to Megawatts
- `mw_to_kw` - Megawatts to Kilowatts
- `mw_to_gw` - Megawatts to Gigawatts
- `gw_to_mw` - Gigawatts to Megawatts

**Energy:**
- `wh_to_kwh` - Watt-hours to Kilowatt-hours
- `kwh_to_wh` - Kilowatt-hours to Watt-hours
- `j_to_kwh` - Joules to Kilowatt-hours
- `kwh_to_j` - Kilowatt-hours to Joules
- `cal_to_j` - Calories to Joules
- `j_to_cal` - Joules to Calories

**Example:**
```yaml
data_sources:
  power_monitor:
    type: entity
    entity: sensor.power_watts
    transformations:
      - type: unit_conversion
        from: "W"
        to: "kW"
        key: "kilowatts"

      - type: unit_conversion
        conversion: "w_to_kw"  # Alternative syntax
        key: "kw_alt"
```

---

### Data Size Conversions

**Progressive conversions:**
- `b_to_kb` - Bytes to Kilobytes
- `kb_to_mb` - Kilobytes to Megabytes
- `mb_to_gb` - Megabytes to Gigabytes
- `gb_to_tb` - Gigabytes to Terabytes

**Reverse conversions:**
- `kb_to_b` - Kilobytes to Bytes
- `mb_to_kb` - Megabytes to Kilobytes
- `gb_to_mb` - Gigabytes to Megabytes
- `tb_to_gb` - Terabytes to Gigabytes

**Example:**
```yaml
data_sources:
  network_speed:
    type: entity
    entity: sensor.download_speed_kb
    transformations:
      - type: unit_conversion
        conversion: "kb_to_mb"
        key: "megabytes_per_sec"
```

---

### Distance & Speed Conversions

**Distance - Metric:**
- `mm_to_cm` - Millimeters to Centimeters
- `cm_to_m` - Centimeters to Meters
- `m_to_km` - Meters to Kilometers
- `km_to_m` - Kilometers to Meters
- `m_to_cm` - Meters to Centimeters
- `cm_to_mm` - Centimeters to Millimeters

**Distance - Imperial:**
- `ft_to_m` - Feet to Meters
- `m_to_ft` - Meters to Feet
- `in_to_cm` - Inches to Centimeters
- `cm_to_in` - Centimeters to Inches
- `mi_to_km` - Miles to Kilometers
- `km_to_mi` - Kilometers to Miles

**Speed:**
- `ms_to_kmh` - Meters/second to Kilometers/hour
- `kmh_to_ms` - Kilometers/hour to Meters/second
- `mph_to_kmh` - Miles/hour to Kilometers/hour
- `kmh_to_mph` - Kilometers/hour to Miles/hour
- `mph_to_ms` - Miles/hour to Meters/second
- `ms_to_mph` - Meters/second to Miles/hour

**Example:**
```yaml
data_sources:
  car_speed:
    type: entity
    entity: sensor.vehicle_speed_kmh
    transformations:
      - type: unit_conversion
        conversion: "kmh_to_mph"
        key: "mph"
      - type: unit_conversion
        conversion: "kmh_to_ms"
        key: "meters_per_sec"
```

---

### Volume & Mass Conversions

**Volume:**
- `l_to_ml` - Liters to Milliliters
- `ml_to_l` - Milliliters to Liters
- `gal_to_l` - Gallons to Liters
- `l_to_gal` - Liters to Gallons
- `oz_to_ml` - Fluid ounces to Milliliters
- `ml_to_oz` - Milliliters to Fluid ounces

**Mass:**
- `g_to_kg` - Grams to Kilograms
- `kg_to_g` - Kilograms to Grams
- `lb_to_kg` - Pounds to Kilograms
- `kg_to_lb` - Kilograms to Pounds
- `oz_to_g` - Ounces to Grams
- `g_to_oz` - Grams to Ounces

---

### Pressure Conversions

**Atmospheric Pressure:**
- `hpa_to_mmhg` - Hectopascals to mmHg
- `mmhg_to_hpa` - mmHg to Hectopascals
- `psi_to_hpa` - PSI to Hectopascals
- `hpa_to_psi` - Hectopascals to PSI
- `bar_to_hpa` - Bar to Hectopascals
- `hpa_to_bar` - Hectopascals to Bar
- `inhg_to_hpa` - Inches Hg to Hectopascals
- `hpa_to_inhg` - Hectopascals to Inches Hg

**Example:**
```yaml
data_sources:
  barometer:
    type: entity
    entity: sensor.atmospheric_pressure
    transformations:
      - type: unit_conversion
        conversion: "hpa_to_inhg"
        key: "inches_mercury"
      - type: unit_conversion
        conversion: "hpa_to_mmhg"
        key: "mm_mercury"
```

---

### Home Assistant Specific Conversions

**Brightness (0-255 ↔ 0-100%):**
```yaml
- type: unit_conversion
  conversion: "brightness_to_percent"
  key: "brightness_pct"

- type: unit_conversion
  conversion: "percent_to_brightness"
  key: "brightness_255"
```

**Volume (0-1 ↔ 0-100%):**
```yaml
- type: unit_conversion
  conversion: "volume_to_percent"
  key: "volume_pct"

- type: unit_conversion
  conversion: "percent_to_volume"
  key: "volume_decimal"
```

**Signal Strength:**
```yaml
- type: unit_conversion
  conversion: "dbm_to_percent"
  key: "wifi_strength"

- type: unit_conversion
  conversion: "rssi_to_percent"
  key: "signal_strength"
```

**Light Sensor:**
```yaml
- type: unit_conversion
  conversion: "lux_to_percent"
  key: "light_level"
```

**Humidity Comfort:**
```yaml
- type: unit_conversion
  conversion: "humidity_to_comfort"
  key: "comfort_level"
  # Returns: 'dry', 'comfortable', or 'humid'
```

**RGB Colors:**
```yaml
- type: unit_conversion
  conversion: "rgb_to_percent"
  key: "color_pct"

- type: unit_conversion
  conversion: "percent_to_rgb"
  key: "color_255"
```

**HVAC Controls:**
```yaml
- type: unit_conversion
  conversion: "hvac_percent_to_decimal"
  key: "hvac_decimal"

- type: unit_conversion
  conversion: "hvac_decimal_to_percent"
  key: "hvac_percent"
```

**Percentage Conversions:**
```yaml
- type: unit_conversion
  conversion: "percent_to_decimal"
  key: "decimal"

- type: unit_conversion
  conversion: "decimal_to_percent"
  key: "percent"
```

---

## 📏 Scale/Range

Map values from one range to another with support for non-linear curves.

### Basic Usage

```yaml
transformations:
  - type: scale
    input_range: [0, 100]      # [min, max]
    output_range: [0, 1]       # [min, max]
    clamp: true                # Clamp to range
    curve: "linear"            # Curve type
    key: "normalized"
```

### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `type` | string | ✅ | - | Always `scale` |
| `input_range` | [number, number] | ✅ | - | Source range [min, max] |
| `output_range` | [number, number] | ✅ | - | Target range [min, max] |
| `clamp` | boolean | ❌ | `true` | Clamp input to range |
| `curve` | string | ❌ | `linear` | Scaling curve type |
| `key` | string | ✅ | - | Result key name |

### Curve Types

**Linear (default):**
```yaml
- type: scale
  input_range: [0, 100]
  output_range: [0, 255]
  curve: "linear"
  key: "rgb_value"
```

**Logarithmic (for exponential data):**
```yaml
- type: scale
  input_range: [1, 1000]
  output_range: [0, 100]
  curve: "logarithmic"
  key: "log_scaled"
```

**Exponential (inverse of logarithmic):**
```yaml
- type: scale
  input_range: [0, 100]
  output_range: [1, 1000]
  curve: "exponential"
  key: "exp_scaled"
```

**Square (quadratic, accelerating):**
```yaml
- type: scale
  input_range: [0, 100]
  output_range: [0, 255]
  curve: "square"
  key: "squared"
```

**Square Root (decelerating, perceptually linear):**
```yaml
- type: scale
  input_range: [0, 255]
  output_range: [0, 100]
  curve: "sqrt"
  key: "perceptual"
```

### Use Cases

**Normalize to 0-1:**
```yaml
- type: scale
  input_range: [-10, 40]
  output_range: [0, 1]
  key: "normalized"
```

**Map temperature to comfort percentage:**
```yaml
- type: scale
  input_range: [15, 30]       # 15°C cold, 30°C hot
  output_range: [0, 100]      # 0% uncomfortable, 100% comfortable
  clamp: true
  key: "comfort"
```

**Audio level (logarithmic perception):**
```yaml
- type: scale
  input_range: [0, 100]
  output_range: [0, 255]
  curve: "logarithmic"
  key: "perceived_volume"
```

---

## 🌊 Smoothing

Apply smoothing algorithms to reduce noise and fluctuations.

### Basic Usage

```yaml
transformations:
  - type: smooth
    method: "exponential"
    alpha: 0.3
    key: "smoothed"
```

### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `type` | string | ✅ | - | Always `smooth` |
| `method` | string | ✅ | - | Smoothing algorithm |
| `alpha` | number | ❌ | `0.3` | Smoothing factor (exponential) |
| `window_size` | number | ❌ | `5` | Window size (moving_average, median) |
| `key` | string | ✅ | - | Result key name |

### Smoothing Methods

**Exponential (EMA):**
```yaml
- type: smooth
  method: "exponential"
  alpha: 0.3                   # 0 = no smoothing, 1 = no memory
  key: "exp_smooth"
```

Best for: Real-time data, responsive to changes but smooth
- Lower alpha = more smoothing, slower response
- Higher alpha = less smoothing, faster response

**Moving Average (SMA):**
```yaml
- type: smooth
  method: "moving_average"
  window_size: 5               # Number of samples to average
  key: "ma_smooth"
```

Best for: Steady data, uniform smoothing

**Median Filter:**
```yaml
- type: smooth
  method: "median"
  window_size: 3               # Odd numbers work best
  key: "median_smooth"
```

Best for: Spike removal, outlier rejection

### Examples

**Smooth noisy sensor:**
```yaml
data_sources:
  noisy_sensor:
    type: entity
    entity: sensor.temperature
    transformations:
      - type: smooth
        method: "exponential"
        alpha: 0.2              # Heavy smoothing
        key: "smooth"
```

**Remove spikes:**
```yaml
data_sources:
  spike_sensor:
    type: entity
    entity: sensor.pressure
    transformations:
      - type: smooth
        method: "median"
        window_size: 5
        key: "despike"
```

---

## 📐 Expressions

Evaluate custom JavaScript expressions with full Math library access.

### Basic Usage

```yaml
transformations:
  - type: expression
    expression: "value * 1.1 + 5"
    key: "adjusted"
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | ✅ | Always `expression` |
| `expression` | string | ✅ | JavaScript expression |
| `inputs` | array | ❌ | Pre-defined entity inputs |
| `key` | string | ✅ | Result key name |

### Available Context

**Variables:**
- `value` - Current numeric value
- `timestamp` - Current timestamp (milliseconds)
- `buffer` - Historical data buffer
- `Math` - JavaScript Math object
- `inputs` - Array of input values (if specified)

**Functions:**
- `getEntity(entityId)` - Get other entity state

### Simple Math

```yaml
transformations:
  # Add offset
  - type: expression
    expression: "value + 10"
    key: "offset"

  # Percentage
  - type: expression
    expression: "value * 100"
    key: "percent"

  # Power
  - type: expression
    expression: "Math.pow(value, 2)"
    key: "squared"
```

### Math Functions

```yaml
transformations:
  # Rounding
  - type: expression
    expression: "Math.round(value * 10) / 10"
    key: "rounded_1dp"

  # Absolute value
  - type: expression
    expression: "Math.abs(value)"
    key: "absolute"

  # Min/Max
  - type: expression
    expression: "Math.max(0, Math.min(100, value))"
    key: "clamped"

  # Trigonometry
  - type: expression
    expression: "Math.sin(value * Math.PI / 180)"
    key: "sine"
```

### Conditional Logic

```yaml
transformations:
  # Ternary operator
  - type: expression
    expression: "value > 50 ? 'high' : 'low'"
    key: "category"

  # Multi-level conditions
  - type: expression
    expression: >
      value < 20 ? 'cold' :
      value < 25 ? 'comfortable' :
      'hot'
    key: "comfort"

  # Boolean conversion
  - type: expression
    expression: "value > 0 ? 1 : 0"
    key: "binary"
```

### Multi-Entity Expressions

```yaml
transformations:
  # Access other entities
  - type: expression
    expression: "value + getEntity('sensor.other_sensor')"
    key: "combined"

  # Pre-defined inputs (more efficient)
  - type: expression
    expression: "value + inputs[0] - inputs[1]"
    inputs:
      - "sensor.production"
      - "sensor.consumption"
    key: "net"
```

### Complex Formulas

**Heat Index:**
```yaml
- type: expression
  expression: >
    0.5 * (value + 61.0 +
    ((value - 68.0) * 1.2) +
    (humidity * 0.094))
  inputs: ["sensor.humidity"]
  key: "heat_index"
```

**Wind Chill:**
```yaml
- type: expression
  expression: >
    35.74 + 0.6215 * value -
    35.75 * Math.pow(wind, 0.16) +
    0.4275 * value * Math.pow(wind, 0.16)
  inputs: ["sensor.wind_speed"]
  key: "wind_chill"
```

---

## 📊 Statistical

Calculate rolling statistical measures for anomaly detection and analysis.

### Basic Usage

```yaml
transformations:
  - type: statistical
    method: "std_dev"
    window_size: 20
    key: "deviation"
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | ✅ | Always `statistical` |
| `method` | string | ✅ | Statistical method |
| `window_size` | number | ✅ | Number of samples |
| `percentile` | number | ❌ | Percentile value (0-100) |
| `key` | string | ✅ | Result key name |

### Statistical Methods

**Standard Deviation:**
```yaml
- type: statistical
  method: "std_dev"
  window_size: 20
  key: "std_deviation"
```

**Percentile:**
```yaml
- type: statistical
  method: "percentile"
  percentile: 95              # 95th percentile
  window_size: 50
  key: "p95"
```

**Z-Score (Anomaly Detection):**
```yaml
- type: statistical
  method: "z_score"
  window_size: 30
  key: "anomaly_score"
```

Interpretation:
- Z-score > 2 or < -2: Likely anomaly
- Z-score > 3 or < -3: Definite anomaly

### Anomaly Detection Example

```yaml
data_sources:
  sensor_monitor:
    type: entity
    entity: sensor.critical_metric
    transformations:
      - type: statistical
        method: "z_score"
        window_size: 50
        key: "z_score"

overlays:
  - id: anomaly_warning
    type: text
    content: "ANOMALY DETECTED!"
    rules:
      - conditions:
          - datasource: sensor_monitor.transformations.z_score
            operator: ">"
            value: 2
        properties:
          style:
            fill: var(--lcars-red)
```

---

## 🔗 Chaining Transformations

Transformations can be chained, with each step's output available to the next.

### Sequential Processing

```yaml
data_sources:
  complex_processing:
    type: entity
    entity: sensor.raw_data
    transformations:
      # Step 1: Convert units
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"

      # Step 2: Scale to percentage
      - type: scale
        input_range: [-10, 40]
        output_range: [0, 100]
        key: "percent"

      # Step 3: Smooth the result
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smooth"

      # Step 4: Calculate z-score
      - type: statistical
        method: "z_score"
        window_size: 20
        key: "anomaly"
```

### Accessing Chain Results

```yaml
overlays:
  - content: "Raw: {complex_processing.value}°F"
  - content: "Celsius: {complex_processing.transformations.celsius}°C"
  - content: "Percent: {complex_processing.transformations.percent}%"
  - content: "Smooth: {complex_processing.transformations.smooth}%"
  - content: "Anomaly: {complex_processing.transformations.anomaly}"
```

---

## 💡 Examples

### Temperature Processing

```yaml
data_sources:
  outdoor_temp:
    type: entity
    entity: sensor.outdoor_temperature_f
    transformations:
      # Convert to Celsius
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"

      # Smooth to reduce sensor noise
      - type: smooth
        method: "exponential"
        alpha: 0.2
        key: "smooth"

      # Map to comfort scale
      - type: scale
        input_range: [15, 30]
        output_range: [0, 100]
        clamp: true
        key: "comfort"
```

### Power Monitoring

```yaml
data_sources:
  power_usage:
    type: entity
    entity: sensor.power_watts
    transformations:
      # Convert to kilowatts
      - type: unit_conversion
        conversion: "w_to_kw"
        key: "kilowatts"

      # Smooth rapid fluctuations
      - type: smooth
        method: "moving_average"
        window_size: 5
        key: "smooth"

      # Detect anomalies
      - type: statistical
        method: "z_score"
        window_size: 30
        key: "anomaly"
```

### Multi-Step Processing

```yaml
data_sources:
  brightness_control:
    type: entity
    entity: light.bedroom_brightness
    transformations:
      # Convert from HA brightness to percent
      - type: unit_conversion
        conversion: "brightness_to_percent"
        key: "percent"

      # Apply non-linear perceptual scaling
      - type: scale
        input_range: [0, 100]
        output_range: [0, 255]
        curve: "sqrt"
        key: "perceptual"

      # Round to integer
      - type: expression
        expression: "Math.round(value)"
        key: "rounded"
```

---

## 📚 Related Documentation

- [DataSources Configuration Guide](datasources.md)
- [Aggregation Reference](datasource-aggregations.md)
- [Computed Sources Guide](computed-sources.md)
- [DataSource Examples](../examples/datasource-examples.md)

---

**Last Updated:** October 26, 2025
**Version:** 2025.10.1-fuk.42-69
