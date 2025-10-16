# DataSource Transformation Chaining Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Basic Concepts](#basic-concepts)
3. [Configuration](#configuration)
4. [Common Patterns](#common-patterns)
5. [Transformation Profiles](#transformation-profiles)
6. [Advanced Techniques](#advanced-techniques)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Introduction

Transformation chaining allows you to build sequential data processing pipelines where each transformation operates on the output of previous transformations. This enables complex multi-stage processing while keeping individual transforms simple and reusable.

### When to Use Chaining

**✅ Use chaining when:**
- You need multi-step data processing
- Each step is conceptually distinct
- You want to reuse intermediate results
- You need to debug pipeline stages

**❌ Don't use chaining when:**
- A single expression can do the job
- All transforms are truly independent
- You're just converting units once

---

## Basic Concepts

### Parallel vs. Sequential Processing

**Parallel (Default):**
```yaml
transformations:
  - type: unit_conversion
    key: "celsius"          # Operates on raw value
  - type: scale
    key: "percent"          # ALSO operates on raw value
```

```
Raw Value (72°F)
     ├──> celsius (22.2°C)
     └──> percent (0.72)
```

**Sequential (Chained):**
```yaml
transformations:
  - type: unit_conversion
    key: "celsius"          # Operates on raw value
  - type: scale
    input_source: "celsius" # Chains from celsius
    key: "percent"
```

```
Raw Value (72°F)
     └──> celsius (22.2°C)
          └──> percent (0.64)
```

### The `input_source` Parameter

Add `input_source` to any transformation to chain from a previous transform:

```yaml
- type: <any_type>
  input_source: "key_of_previous_transform"
  key: "my_result"
  # ... other options
```

**Rules:**
1. `input_source` must reference a transform with a valid `key`
2. Referenced transform must appear before the current one
3. If `input_source` is omitted, raw value is used
4. Cannot create circular dependencies

---

## Configuration

### Basic Chain

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.outside_temp
    transformations:
      # Stage 1: Convert units
      - type: unit_conversion
        conversion: "f_to_c"
        key: "celsius"

      # Stage 2: Scale to percentage
      - type: scale
        input_source: "celsius"
        input_range: [-10, 40]
        output_range: [0, 100]
        key: "comfort"

      # Stage 3: Smooth result
      - type: smooth
        input_source: "comfort"
        method: "exponential"
        alpha: 0.3
        key: "final"

overlays:
  - type: text
    text: "Comfort: ${temperature.transformations.final}%"
```

### Mixed Parallel and Chained

```yaml
transformations:
  # Parallel branch 1: Raw → Smoothed
  - type: smooth
    method: "exponential"
    alpha: 0.2
    key: "smoothed_raw"

  # Parallel branch 2: Raw → Celsius → Percent → Smoothed
  - type: unit_conversion
    conversion: "f_to_c"
    key: "celsius"

  - type: scale
    input_source: "celsius"
    input_range: [-10, 40]
    output_range: [0, 100]
    key: "percent"

  - type: smooth
    input_source: "percent"
    method: "moving_average"
    window_size: 5
    key: "smoothed_percent"
```

```
Raw Value
    ├──> smoothed_raw
    └──> celsius
         └──> percent
              └──> smoothed_percent
```

---

## Common Patterns

### Pattern 1: Unit → Scale → Smooth

Convert units, scale to a range, then smooth the result.

```yaml
transformations:
  - type: unit_conversion
    conversion: "f_to_c"
    key: "celsius"

  - type: scale
    input_source: "celsius"
    input_range: [-10, 35]
    output_range: [0, 100]
    key: "comfort_raw"

  - type: smooth
    input_source: "comfort_raw"
    method: "moving_average"
    window_size: 5
    key: "comfort"
```

**Use for:** Temperature comfort, battery level, any sensor with units

### Pattern 2: Denoise → Baseline → Deviation

Remove noise, establish baseline, calculate deviation.

```yaml
transformations:
  - type: smooth
    method: "median"
    window_size: 3
    key: "denoised"

  - type: smooth
    input_source: "denoised"
    method: "exponential"
    alpha: 0.05
    key: "baseline"

  - type: expression
    expression: "value - transforms.baseline"
    key: "deviation"
```

**Use for:** Power monitoring, network traffic, any signal analysis

### Pattern 3: Multi-Source Calculation

Combine multiple transforms in an expression.

```yaml
transformations:
  # Calculate power from voltage and current
  - type: expression
    expression: "value * getEntity('sensor.current')"
    key: "power"

  # Convert to kW
  - type: unit_conversion
    input_source: "power"
    conversion: "w_to_kw"
    key: "power_kw"

  # Smooth
  - type: smooth
    input_source: "power_kw"
    method: "exponential"
    alpha: 0.2
    key: "power_smooth"
```

**Use for:** Calculated values, multi-sensor fusion

### Pattern 4: Trend and Residual

Extract trend and calculate residual.

```yaml
transformations:
  # Smooth to get trend
  - type: smooth
    method: "exponential"
    alpha: 0.1
    key: "trend"

  # Calculate residual (value - trend)
  - type: expression
    expression: "value - transforms.trend"
    key: "residual"

  # Statistical analysis of residual
  - type: statistical
    input_source: "residual"
    method: "std_dev"
    window_size: 50
    key: "noise_level"
```

**Use for:** Time series analysis, anomaly detection

---

## Transformation Profiles

Profiles are reusable transformation pipelines that can be applied to multiple data sources.

### Built-in Profiles

#### `temperature_comfort`
Converts temperature to comfort percentage.

```yaml
data_sources:
  outdoor:
    entity: sensor.outdoor_temp
    transformations:
      - profile: "temperature_comfort"
```

**Equivalent to:**
```yaml
transformations:
  - type: unit_conversion
    conversion: "f_to_c"
    key: "celsius"
  - type: scale
    input_source: "celsius"
    input_range: [-10, 35]
    output_range: [0, 100]
    key: "comfort"
```

#### `power_analysis`
Power monitoring with anomaly detection.

```yaml
data_sources:
  power:
    entity: sensor.home_power
    transformations:
      - profile: "power_analysis"
```

**Equivalent to:**
```yaml
transformations:
  - type: unit_conversion
    conversion: "w_to_kw"
    key: "kw"
  - type: smooth
    input_source: "kw"
    method: "median"
    window_size: 5
    key: "kw_clean"
  - type: statistical
    input_source: "kw_clean"
    method: "z_score"
    window_size: 100
    key: "anomaly"
```

#### `signal_processing`
Multi-stage noise reduction.

```yaml
data_sources:
  sensor:
    entity: sensor.noisy_data
    transformations:
      - profile: "signal_processing"
```

**Equivalent to:**
```yaml
transformations:
  - type: smooth
    method: "median"
    window_size: 3
    key: "outliers_removed"
  - type: smooth
    input_source: "outliers_removed"
    method: "moving_average"
    window_size: 5
    key: "noise_reduced"
  - type: smooth
    input_source: "noise_reduced"
    method: "exponential"
    alpha: 0.1
    key: "trend"
```

### Custom Profiles

Define your own reusable profiles:

```yaml
data_sources:
  sensor:
    entity: sensor.my_sensor

    # Define custom profiles
    transformation_profiles:
      battery_runtime:
        - type: smooth
          method: "exponential"
          alpha: 0.1
          key: "soc_smooth"
        - type: expression
          input_source: "soc_smooth"
          expression: "value * 13.5 / 100"
          key: "energy_kwh"
        - type: expression
          input_source: "energy_kwh"
          expression: |
            const load = getEntity('sensor.home_power') / 1000;
            return load > 0 ? value / load : 999;
          key: "runtime_hours"

    # Use the profile
    transformations:
      - profile: "battery_runtime"
```

---

## Advanced Techniques

### Expression Access to Transforms

Expressions can access all previous transforms in the pipeline:

```yaml
transformations:
  - type: smooth
    method: "exponential"
    alpha: 0.1
    key: "slow"

  - type: smooth
    method: "exponential"
    alpha: 0.5
    key: "fast"

  - type: expression
    expression: |
      const slow = transforms.slow || 0;
      const fast = transforms.fast || value;
      return fast - slow;  // Calculate difference
    key: "signal"
```

**Tips:**
- Always provide fallback values: `transforms.key || fallbackValue`
- Transforms must appear BEFORE the expression
- Use descriptive transform keys

### Aggregation Chaining

Aggregate transformed values instead of raw values:

```yaml
transformations:
  - type: smooth
    method: "exponential"
    alpha: 0.2
    key: "smoothed"

aggregations:
  trend:
    type: recent_trend
    input_source: "smoothed"  # Analyze smoothed data
    samples: 10

  stats:
    type: min_max
    input_source: "smoothed"  # Track smoothed min/max
    window: "1h"
```

### Conditional Processing

Use expressions for conditional logic:

```yaml
transformations:
  - type: expression
    expression: "value > 0 ? value : 0"
    key: "positive_only"

  - type: scale
    input_source: "positive_only"
    input_range: [0, 100]
    output_range: [0, 1]
    key: "normalized"
```

### Debug Mode

Enable debug logging for specific transforms:

```yaml
transformations:
  - type: unit_conversion
    conversion: "f_to_c"
    key: "celsius"
    debug: true  # Logs: "Transform 'celsius': 72.00 → 22.22"

  - type: scale
    input_source: "celsius"
    input_range: [-10, 40]
    output_range: [0, 100]
    key: "percent"
    debug: true  # Logs: "Transform 'percent': 22.22 → 64.44"
```

---

## Troubleshooting

### Error: "Transform references undefined source"

**Problem:**
```yaml
transformations:
  - type: scale
    input_source: "celsius"  # Error: celsius doesn't exist
    key: "percent"
```

**Solution:** Add the referenced transform first:
```yaml
transformations:
  - type: unit_conversion
    conversion: "f_to_c"
    key: "celsius"  # Define this FIRST

  - type: scale
    input_source: "celsius"
    key: "percent"
```

### Error: "Circular dependency detected"

**Problem:**
```yaml
transformations:
  - type: expression
    input_source: "b"
    key: "a"

  - type: expression
    input_source: "a"
    key: "b"  # Error: a → b → a
```

**Solution:** Restructure to avoid cycles:
```yaml
transformations:
  - type: expression
    key: "base"

  - type: expression
    input_source: "base"
    key: "derived_a"

  - type: expression
    input_source: "base"
    key: "derived_b"
```

### Warning: "Transform received non-numeric input"

**Problem:** Previous transform returned null or invalid value.

**Solution:** Add validation in expressions:
```yaml
transformations:
  - type: expression
    expression: |
      const prev = transforms.previous || 0;
      return Number.isFinite(prev) ? prev * 2 : 0;
    key: "doubled"
```

### Chain Not Working

**Checklist:**
1. ✅ Is `input_source` spelled correctly?
2. ✅ Does the referenced transform have a `key`?
3. ✅ Is the referenced transform defined BEFORE this one?
4. ✅ Are both transforms enabled?
5. ✅ Check browser console for warnings

**Debug technique:**
```yaml
transformations:
  - type: unit_conversion
    key: "celsius"
    debug: true  # Enable logging

  - type: scale
    input_source: "celsius"
    key: "percent"
    debug: true  # Enable logging
```

---

## Best Practices

### 1. Name Keys Clearly

✅ **Good:**
```yaml
- key: "celsius"
- key: "comfort_percent"
- key: "smoothed_watts"
```

❌ **Bad:**
```yaml
- key: "temp1"
- key: "t2"
- key: "x"
```

### 2. Keep Chains Short

✅ **Good:** 3-5 steps is typical
```yaml
raw → convert → scale → smooth → final
```

❌ **Bad:** Too many steps
```yaml
raw → a → b → c → d → e → f → g → h → final
```

**If you need many steps, consider:**
- Breaking into multiple data sources
- Combining some steps into expressions
- Using transformation profiles

### 3. Convert Units Early

✅ **Good:**
```yaml
- type: unit_conversion  # First
- type: scale            # Then scale
- type: smooth           # Then smooth
```

❌ **Bad:**
```yaml
- type: smooth           # Smoothing °F?
- type: unit_conversion  # Then converting?
- type: scale            # Confusing!
```

### 4. Smooth Last

✅ **Good:**
```yaml
- type: scale            # Calculate value
- type: smooth           # Smooth at the end
```

❌ **Bad:**
```yaml
- type: smooth           # Smooth first
- type: scale            # Then scale smooth data (why?)
```

### 5. Use Profiles for Common Patterns

✅ **Good:**
```yaml
data_sources:
  temp1:
    entity: sensor.temp1
    transformations:
      - profile: "temperature_comfort"

  temp2:
    entity: sensor.temp2
    transformations:
      - profile: "temperature_comfort"
```

❌ **Bad:** Repeating the same transformations
```yaml
data_sources:
  temp1:
    transformations:
      - type: unit_conversion...
      - type: scale...
  temp2:
    transformations:
      - type: unit_conversion...  # Duplicated!
      - type: scale...            # Duplicated!
```

### 6. Mix Parallel and Chained

✅ **Good:** Some parallel, some chained
```yaml
transformations:
  - type: smooth           # Parallel: raw → smoothed
    key: "smoothed"

  - type: unit_conversion  # Chain: raw → celsius → percent
    key: "celsius"
  - type: scale
    input_source: "celsius"
    key: "percent"
```

### 7. Validate Inputs in Expressions

✅ **Good:**
```yaml
expression: |
  const temp = transforms.temperature || 0;
  if (!Number.isFinite(temp)) return 0;
  return temp * 1.8 + 32;
```

❌ **Bad:**
```yaml
expression: "transforms.temperature * 1.8 + 32"  # Might fail!
```

---

## Performance Considerations

### Execution Order Caching

Transform execution order is calculated once and cached:

```javascript
// First update: ~0.05ms to calculate order
// Subsequent updates: ~0.001ms (cached)
```

**No need to worry about performance!**

### Historical Processing

When loading history, all transforms process all historical points:

```
1000 historical points × 5 transforms = 5000 operations
Typical time: 10-30ms (acceptable)
```

**Performance warning triggers at >100ms:**
```
⚠️ Historical chain processing took 150ms (1000 points × 10 transforms)
```

**If you see this:**
1. Reduce number of transforms
2. Reduce history window
3. Simplify complex expressions

### When to Optimize

Only optimize if you see:
- Console warnings about slow processing
- UI lag when switching views
- High CPU usage in browser

**Then:**
1. Use `debug: true` to find slow transforms
2. Simplify complex expressions
3. Reduce smoothing window sizes
4. Consider sampling fewer historical points

---

## Examples Library

### Example 1: Home Comfort Index

```yaml
data_sources:
  comfort:
    type: entity
    entity: sensor.outdoor_temp
    transformations:
      - type: unit_conversion
        conversion: "f_to_c"
        key: "celsius"

      - type: scale
        input_source: "celsius"
        input_range: [-10, 35]
        output_range: [0, 100]
        curve: "sqrt"  # Perceptual scaling
        key: "comfort"

      - type: smooth
        input_source: "comfort"
        method: "moving_average"
        window_size: 5
        key: "comfort_smooth"

overlays:
  - type: gauge
    source: comfort
    transform_key: "comfort_smooth"
    label: "Comfort"
    unit: "%"
```

### Example 2: Solar Production Analysis

```yaml
data_sources:
  solar:
    type: entity
    entity: sensor.solar_power
    transformations:
      # Convert to kW
      - type: unit_conversion
        conversion: "w_to_kw"
        key: "kw"

      # Remove sensor glitches
      - type: smooth
        input_source: "kw"
        method: "median"
        window_size: 3
        key: "kw_clean"

      # Smooth for display
      - type: smooth
        input_source: "kw_clean"
        method: "exponential"
        alpha: 0.3
        key: "kw_smooth"

      # Calculate efficiency (need panel area)
      - type: expression
        input_source: "kw_clean"
        expression: "(value / 6.4) * 100"  # 6.4kW system
        key: "efficiency_percent"

    aggregations:
      daily_peak:
        type: min_max
        input_source: "kw_clean"
        max: true
        window: "24h"

      production_trend:
        type: recent_trend
        input_source: "kw_smooth"
        samples: 20
```

### Example 3: Network Traffic Monitor

```yaml
data_sources:
  network:
    type: entity
    entity: sensor.wan_download
    transformations:
      # Convert to Mbps
      - type: unit_conversion
        conversion: "kb_to_mb"
        key: "mbps"

      # Remove spikes
      - type: smooth
        input_source: "mbps"
        method: "median"
        window_size: 5
        key: "mbps_filtered"

      # Calculate baseline (5min average)
      - type: smooth
        input_source: "mbps_filtered"
        method: "exponential"
        alpha: 0.05
        key: "baseline"

      # Calculate deviation from baseline
      - type: expression
        expression: |
          const baseline = transforms.baseline || 0;
          const current = transforms.mbps_filtered || 0;
          return current - baseline;
        key: "deviation"

      # Scale deviation to percentage
      - type: scale
        input_source: "deviation"
        input_range: [-50, 50]
        output_range: [-100, 100]
        clamp: false
        key: "deviation_percent"

overlays:
  - type: sparkline
    source: network
    transform_key: "mbps_filtered"

  - type: text
    text: |
      ${network.transformations.mbps_filtered.toFixed(1)} Mbps
      ${network.transformations.deviation_percent > 0 ? '↑' : '↓'}
      ${Math.abs(network.transformations.deviation_percent).toFixed(0)}%
    rules:
      - condition: "Math.abs(network.transformations.deviation_percent) > 50"
        style:
          color: "#FF0000"
```

---

## Quick Reference

### Transformation Types That Support Chaining

| Type | Supports `input_source` | Notes |
|------|------------------------|-------|
| `unit_conversion` | ✅ | Convert chained values |
| `scale` | ✅ | Scale chained values |
| `smooth` | ✅ | Smooth chained values |
| `expression` | ✅ | Access transforms via `transforms.*` |
| `statistical` | ✅ | Analyze chained values |

### Aggregation Types That Support Chaining

| Type | Supports `input_source` | Notes |
|------|------------------------|-------|
| `moving_average` | ✅ | Average of transformed values |
| `min_max` | ✅ | Min/max of transformed values |
| `rate_of_change` | ✅ | Rate of transformed values |
| `session_stats` | ✅ | Stats on transformed values |
| `duration` | ✅ | Duration of transformed condition |
| `recent_trend` | ✅ | Trend of transformed values |

### Common Mistakes

| Mistake | Fix |
|---------|-----|
| `input_source: "Celsius"` | Keys are case-sensitive: `input_source: "celsius"` |
| No `key` defined | Always add `key: "my_key"` |
| Circular dependency | Check your chain doesn't loop |
| Referencing future transform | Source must appear BEFORE current |
| Null propagation | Add null checks in expressions |

---

## Additional Resources

- **API Reference:** `/doc/user/datasource_complete_documentation.md`
- **Examples:** `/doc/user/enhanced_datasource_examples.md`
- **Proposal:** `/doc/proposals/datasource_chaining.md`
- **Architecture:** `/doc/architecture/msd_data_flow.md` (if exists)

---

**Questions?** Check the troubleshooting section or enable `debug: true` on your transforms!
