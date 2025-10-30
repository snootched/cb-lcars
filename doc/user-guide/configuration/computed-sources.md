# Computed DataSources Guide

> **Complete guide to computed sources**
> Calculate derived values from multiple entity sources using JavaScript expressions with full math library and multi-entity access.

---

## 🎯 Overview

Computed sources create virtual data sources by evaluating JavaScript expressions against one or more Home Assistant entities. They're ideal for calculations that require data from multiple sources, complex formulas, or custom logic.

**Key Features:**
- ✅ JavaScript expressions with full Math library
- ✅ Multi-entity calculations
- ✅ Access to Home Assistant state attributes
- ✅ Support for transformations and aggregations
- ✅ Real-time updates when any input changes
- ✅ Automatic dependency tracking
- ✅ Buffer historical calculated values

---

## 📋 Table of Contents

1. [Computed Source Basics](#computed-source-basics)
2. [Simple Calculations](#simple-calculations)
3. [Multi-Entity Expressions](#multi-entity-expressions)
4. [Complex Formulas](#complex-formulas)
5. [Available Context](#available-context)
6. [With Transformations](#with-transformations)
7. [With Aggregations](#with-aggregations)
8. [Real-World Examples](#real-world-examples)

---

## 🔧 Computed Source Basics

### Basic Syntax

```yaml
data_sources:
  computed_name:
    type: computed
    inputs:
      - entity.id_1
      - entity.id_2
      - entity.id_3
    expression: "inputs[0] + inputs[1] - inputs[2]"
```

### How Computed Sources Work

```
Input Entities → Subscribe → Expression → Computed Value
[sensor.a]         ↓         Evaluate     {value, timestamp}
[sensor.b]         ↓         JavaScript
[sensor.c]         ↓         Formula
```

1. **Subscribe** to all input entities
2. **Evaluate** expression when any input changes
3. **Emit** computed value to subscribers
4. **Store** in historical buffer

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | ✅ | Always `"computed"` |
| `inputs` | array | ✅ | Array of entity IDs |
| `expression` | string | ✅ | JavaScript expression |
| `windowSeconds` | number | ❌ | Buffer window (default: 60) |
| `transformations` | array | ❌ | Apply transformations |
| `aggregations` | object | ❌ | Apply aggregations |

---

## 🧮 Simple Calculations

### Addition

```yaml
data_sources:
  total_power:
    type: computed
    inputs:
      - sensor.living_room_power
      - sensor.kitchen_power
      - sensor.bedroom_power
    expression: "inputs[0] + inputs[1] + inputs[2]"
```

### Subtraction (Net Values)

```yaml
data_sources:
  net_energy:
    type: computed
    inputs:
      - sensor.solar_production
      - sensor.house_consumption
    expression: "inputs[0] - inputs[1]"
```

### Multiplication

```yaml
data_sources:
  daily_cost:
    type: computed
    inputs:
      - sensor.daily_kwh
      - input_number.electricity_rate
    expression: "inputs[0] * inputs[1]"
```

### Division (Ratios)

```yaml
data_sources:
  efficiency:
    type: computed
    inputs:
      - sensor.output_power
      - sensor.input_power
    expression: "inputs[0] / inputs[1]"
```

### Percentage

```yaml
data_sources:
  battery_percentage:
    type: computed
    inputs:
      - sensor.battery_current
      - sensor.battery_capacity
    expression: "(inputs[0] / inputs[1]) * 100"
```

---

## 👥 Multi-Entity Expressions

### Array Methods

**Sum all inputs:**
```yaml
data_sources:
  total_temperature:
    type: computed
    inputs:
      - sensor.bedroom_temp
      - sensor.living_room_temp
      - sensor.kitchen_temp
    expression: "inputs.reduce((sum, val) => sum + val, 0)"
```

**Average:**
```yaml
data_sources:
  avg_temperature:
    type: computed
    inputs:
      - sensor.bedroom_temp
      - sensor.living_room_temp
      - sensor.kitchen_temp
    expression: "inputs.reduce((sum, val) => sum + val, 0) / inputs.length"
```

**Maximum:**
```yaml
data_sources:
  max_temperature:
    type: computed
    inputs:
      - sensor.bedroom_temp
      - sensor.living_room_temp
      - sensor.kitchen_temp
    expression: "Math.max(...inputs)"
```

**Minimum:**
```yaml
data_sources:
  min_temperature:
    type: computed
    inputs:
      - sensor.bedroom_temp
      - sensor.living_room_temp
      - sensor.kitchen_temp
    expression: "Math.min(...inputs)"
```

### Conditional Logic

**Binary decision:**
```yaml
data_sources:
  heating_needed:
    type: computed
    inputs:
      - sensor.indoor_temp
      - input_number.target_temp
    expression: "inputs[0] < inputs[1] ? 1 : 0"
```

**Multi-level conditions:**
```yaml
data_sources:
  comfort_status:
    type: computed
    inputs:
      - sensor.temperature
    expression: >
      inputs[0] < 18 ? 0 :
      inputs[0] < 22 ? 1 :
      inputs[0] < 26 ? 2 : 3
```

**Status text:**
```yaml
data_sources:
  system_status:
    type: computed
    inputs:
      - sensor.error_count
      - sensor.warning_count
    expression: >
      inputs[0] > 0 ? 'ERROR' :
      inputs[1] > 0 ? 'WARNING' : 'OK'
```

---

## 🔬 Complex Formulas

### Heat Index

Calculate apparent temperature from temperature and humidity:

```yaml
data_sources:
  heat_index:
    type: computed
    inputs:
      - sensor.temperature_f
      - sensor.humidity
    expression: >
      0.5 * (inputs[0] + 61.0 +
      ((inputs[0] - 68.0) * 1.2) +
      (inputs[1] * 0.094))
```

### Wind Chill

Calculate wind chill from temperature and wind speed:

```yaml
data_sources:
  wind_chill:
    type: computed
    inputs:
      - sensor.temperature_f
      - sensor.wind_speed_mph
    expression: >
      35.74 + 0.6215 * inputs[0] -
      35.75 * Math.pow(inputs[1], 0.16) +
      0.4275 * inputs[0] * Math.pow(inputs[1], 0.16)
```

### Dew Point

Calculate dew point from temperature and humidity:

```yaml
data_sources:
  dew_point:
    type: computed
    inputs:
      - sensor.temperature_c
      - sensor.humidity
    expression: >
      inputs[0] -
      ((100 - inputs[1]) / 5.0)
```

### Distance Calculation

Calculate distance between two GPS coordinates:

```yaml
data_sources:
  distance_to_home:
    type: computed
    inputs:
      - sensor.phone_latitude
      - sensor.phone_longitude
      - input_number.home_latitude
      - input_number.home_longitude
    expression: >
      Math.acos(
        Math.sin(inputs[0] * Math.PI / 180) *
        Math.sin(inputs[2] * Math.PI / 180) +
        Math.cos(inputs[0] * Math.PI / 180) *
        Math.cos(inputs[2] * Math.PI / 180) *
        Math.cos((inputs[1] - inputs[3]) * Math.PI / 180)
      ) * 6371
```

### Power Factor

Calculate power factor from real and apparent power:

```yaml
data_sources:
  power_factor:
    type: computed
    inputs:
      - sensor.real_power_watts
      - sensor.apparent_power_va
    expression: "inputs[0] / inputs[1]"
```

---

## 📐 Available Context

### Variables

| Variable | Type | Description |
|----------|------|-------------|
| `inputs` | array | Array of input entity values |
| `Math` | object | JavaScript Math object |
| `value` | number | First input value (inputs[0]) |
| `timestamp` | number | Current timestamp (milliseconds) |

### Math Functions

**Basic:**
- `Math.abs(x)` - Absolute value
- `Math.ceil(x)` - Round up
- `Math.floor(x)` - Round down
- `Math.round(x)` - Round to nearest
- `Math.trunc(x)` - Integer part

**Power & Root:**
- `Math.pow(base, exp)` - Power
- `Math.sqrt(x)` - Square root
- `Math.cbrt(x)` - Cube root
- `Math.exp(x)` - e^x
- `Math.log(x)` - Natural logarithm
- `Math.log10(x)` - Base-10 logarithm
- `Math.log2(x)` - Base-2 logarithm

**Trigonometry:**
- `Math.sin(x)` - Sine (radians)
- `Math.cos(x)` - Cosine (radians)
- `Math.tan(x)` - Tangent (radians)
- `Math.asin(x)` - Arcsine
- `Math.acos(x)` - Arccosine
- `Math.atan(x)` - Arctangent
- `Math.atan2(y, x)` - Angle from coordinates

**Min/Max:**
- `Math.min(...values)` - Minimum value
- `Math.max(...values)` - Maximum value
- `Math.clamp(x, min, max)` - Clamp to range

**Constants:**
- `Math.PI` - Pi (3.14159...)
- `Math.E` - Euler's number (2.71828...)

---

## 🔄 With Transformations

Computed sources can have transformations applied to their calculated values:

```yaml
data_sources:
  total_power_kw:
    type: computed
    inputs:
      - sensor.living_room_power
      - sensor.kitchen_power
      - sensor.bedroom_power
    expression: "inputs[0] + inputs[1] + inputs[2]"
    transformations:
      # Convert watts to kilowatts
      - type: unit_conversion
        conversion: "w_to_kw"
        key: "kilowatts"

      # Smooth the result
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"
```

### Usage in Overlays

```yaml
overlays:
  - type: text
    content: "Total: {total_power_kw.transformations.kilowatts:.2f} kW"

  - type: text
    content: "Smoothed: {total_power_kw.transformations.smoothed:.2f} kW"
```

---

## 📊 With Aggregations

Computed sources support aggregations for statistical analysis:

```yaml
data_sources:
  efficiency_ratio:
    type: computed
    inputs:
      - sensor.solar_output
      - sensor.solar_capacity
    expression: "(inputs[0] / inputs[1]) * 100"
    aggregations:
      # Track average efficiency
      moving_average:
        window: "1h"
        key: "avg_1h"

      # Track daily stats
      min_max:
        min: true
        max: true
        avg: true
        window: "24h"
        key: "daily"

      # Detect trends
      recent_trend:
        samples: 10
        key: "trend"
```

### Usage in Rules

```yaml
rules:
  - id: low_efficiency_alert
    when:
      all:
        - entity: efficiency_ratio.aggregations.avg_1h
          below: 75
        - entity: efficiency_ratio.aggregations.trend.direction
          equals: "decreasing"
    apply:
      overlays:
        - id: efficiency_warning
          style:
            color: "var(--lcars-orange)"
```

---

## 💡 Real-World Examples

### Home Energy Dashboard

```yaml
data_sources:
  # Total house consumption
  total_consumption:
    type: computed
    inputs:
      - sensor.main_power
      - sensor.hvac_power
      - sensor.water_heater_power
    expression: "inputs[0] + inputs[1] + inputs[2]"
    transformations:
      - type: unit_conversion
        conversion: "w_to_kw"
        key: "kw"
    aggregations:
      moving_average:
        window: "15m"
        key: "avg_15m"

  # Net energy (solar - consumption)
  net_energy:
    type: computed
    inputs:
      - sensor.solar_production
      - sensor.total_consumption
    expression: "inputs[0] - inputs[1]"
    transformations:
      - type: unit_conversion
        conversion: "w_to_kw"
        key: "kw"

  # Cost per hour
  hourly_cost:
    type: computed
    inputs:
      - sensor.total_consumption
      - input_number.electricity_rate
    expression: "(inputs[0] / 1000) * inputs[1]"
    aggregations:
      session_stats:
        key: "session"

overlays:
  - type: text
    content: |
      ⚡ Energy Monitor

      Consumption: {total_consumption.transformations.kw:.2f} kW
      15min Avg: {total_consumption.aggregations.avg_15m.value:.2f} kW

      Net Energy: {net_energy.transformations.kw:+.2f} kW
      Hourly Cost: ${hourly_cost.value:.2f}
      Today's Cost: ${hourly_cost.aggregations.session.sum:.2f}
```

### Climate Comfort Calculator

```yaml
data_sources:
  # Heat index
  heat_index:
    type: computed
    inputs:
      - sensor.outdoor_temp_f
      - sensor.outdoor_humidity
    expression: >
      0.5 * (inputs[0] + 61.0 +
      ((inputs[0] - 68.0) * 1.2) +
      (inputs[1] * 0.094))

  # Comfort score (0-100)
  comfort_score:
    type: computed
    inputs:
      - sensor.indoor_temp
      - sensor.indoor_humidity
    expression: >
      100 - Math.abs(22 - inputs[0]) * 5 -
      Math.abs(50 - inputs[1]) * 0.5
    aggregations:
      moving_average:
        window: "30m"
        key: "avg"

  # HVAC efficiency
  hvac_efficiency:
    type: computed
    inputs:
      - sensor.indoor_temp
      - sensor.outdoor_temp
      - sensor.hvac_power
    expression: >
      Math.abs(inputs[0] - inputs[1]) /
      (inputs[2] / 1000)

overlays:
  - type: text
    content: |
      🌡️ Climate Status

      Heat Index: {heat_index.value:.1f}°F
      Comfort Score: {comfort_score.value:.0f}/100
      30min Avg: {comfort_score.aggregations.avg.value:.0f}/100

      HVAC Efficiency: {hvac_efficiency.value:.2f}°/kW
```

### Multi-Room Temperature Monitoring

```yaml
data_sources:
  # Average house temperature
  avg_house_temp:
    type: computed
    inputs:
      - sensor.living_room_temp
      - sensor.bedroom_temp
      - sensor.kitchen_temp
      - sensor.bathroom_temp
    expression: >
      inputs.reduce((sum, val) => sum + val, 0) / inputs.length
    transformations:
      - type: smooth
        method: "exponential"
        alpha: 0.2
        key: "smoothed"
    aggregations:
      min_max:
        window: "24h"
        key: "daily"

  # Temperature variance
  temp_variance:
    type: computed
    inputs:
      - sensor.living_room_temp
      - sensor.bedroom_temp
      - sensor.kitchen_temp
      - sensor.bathroom_temp
    expression: >
      Math.max(...inputs) - Math.min(...inputs)

  # Coldest room
  coldest_room_temp:
    type: computed
    inputs:
      - sensor.living_room_temp
      - sensor.bedroom_temp
      - sensor.kitchen_temp
      - sensor.bathroom_temp
    expression: "Math.min(...inputs)"

  # Warmest room
  warmest_room_temp:
    type: computed
    inputs:
      - sensor.living_room_temp
      - sensor.bedroom_temp
      - sensor.kitchen_temp
      - sensor.bathroom_temp
    expression: "Math.max(...inputs)"

overlays:
  - type: text
    content: |
      🏠 House Temperature

      Average: {avg_house_temp.transformations.smoothed:.1f}°C
      Range: {temp_variance.value:.1f}°C

      Coldest: {coldest_room_temp.value:.1f}°C
      Warmest: {warmest_room_temp.value:.1f}°C

      Today: {avg_house_temp.aggregations.daily.min:.1f} - {avg_house_temp.aggregations.daily.max:.1f}°C
```

### Solar Production Analysis

```yaml
data_sources:
  # Production efficiency
  solar_efficiency:
    type: computed
    inputs:
      - sensor.solar_production
      - sensor.solar_panel_capacity
    expression: "(inputs[0] / inputs[1]) * 100"
    aggregations:
      moving_average:
        window: "1h"
        key: "avg_1h"
      min_max:
        window: "24h"
        key: "daily"

  # Self-consumption rate
  self_consumption:
    type: computed
    inputs:
      - sensor.solar_production
      - sensor.house_consumption
      - sensor.grid_export
    expression: >
      ((inputs[0] - inputs[2]) / inputs[0]) * 100

  # Savings per hour
  hourly_savings:
    type: computed
    inputs:
      - sensor.solar_production
      - input_number.grid_rate
    expression: "(inputs[0] / 1000) * inputs[1]"
    aggregations:
      session_stats:
        key: "session"

overlays:
  - type: text
    content: |
      ☀️ Solar Performance

      Efficiency: {solar_efficiency.value:.1f}%
      Hourly Avg: {solar_efficiency.aggregations.avg_1h.value:.1f}%
      Today Peak: {solar_efficiency.aggregations.daily.max:.1f}%

      Self-Consumption: {self_consumption.value:.0f}%
      Hourly Savings: ${hourly_savings.value:.2f}
      Today Savings: ${hourly_savings.aggregations.session.sum:.2f}
```

---

## 🐛 Troubleshooting

### Common Issues

**NaN Results:**
```javascript
// Problem: Division by zero or invalid inputs
expression: "inputs[0] / inputs[1]"

// Solution: Add guard
expression: "inputs[1] !== 0 ? inputs[0] / inputs[1] : 0"
```

**Missing Dependencies:**
```javascript
// Problem: Input entity not available
inputs: ["sensor.not_exist"]

// Check entity exists in Home Assistant
// Verify entity ID spelling
```

**Expression Errors:**
```javascript
// Problem: Syntax error in expression
expression: "inputs[0] +"  // Incomplete

// Solution: Complete the expression
expression: "inputs[0] + inputs[1]"
```

**Type Issues:**
```javascript
// Problem: Non-numeric values
expression: "inputs[0] + inputs[1]"  // One is string

// Solution: Ensure numeric conversion
expression: "Number(inputs[0]) + Number(inputs[1])"
```

### Debug Commands

```javascript
// Access DataSourceManager
const dsm = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;

// Get computed source
const source = dsm.getSource('my_computed_source');

// Check current value
console.log('Current value:', source.getCurrentData());

// Check input values
console.log('Input values:', source.inputs?.map(id =>
  dsm.getEntity(id)?.state
));

// Test expression manually
const inputs = [10, 20, 30];
console.log('Test result:', eval("inputs[0] + inputs[1] + inputs[2]"));
```

---

## 📚 Related Documentation

- [DataSources Configuration Guide](datasources.md)
- [Transformation Reference](datasource-transformations.md)
- [Aggregation Reference](datasource-aggregations.md)
- [DataSource Examples](../examples/datasource-examples.md)

---

**Last Updated:** October 26, 2025
**Version:** 2025.10.1-fuk.42-69
