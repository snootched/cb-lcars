# Rules Engine - Complete Documentation & Schema

This document provides comprehensive documentation for the MSD Rules Engine system, including condition types, rule composition, dependency tracking, performance optimization, and integration patterns.

---

## Table of Contents

1. [Overview](#overview)
2. [Basic Rule Structure](#basic-rule-structure)
3. [Condition Types](#condition-types)
4. [Rule Composition](#rule-composition)
5. [DataSource Integration](#datasource-integration)
6. [Performance & Optimization](#performance--optimization)
7. [Dependency System](#dependency-system)
8. [Rule Tracing & Debugging](#rule-tracing--debugging)
9. [Configuration Schema](#configuration-schema)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)
12. [Examples](#examples)

---

## Overview

The MSD Rules Engine provides sophisticated conditional logic for dynamic overlay styling, profile management, and animation control:

- **High-performance evaluation** with dependency tracking and dirty state management
- **Comprehensive condition types** including entity states, time ranges, performance metrics, and more
- **DataSource integration** with dot notation access to transformed and aggregated data
- **Rule composition** with logical operators (all/any/not) and complex nested conditions
- **Stop semantics** for rule priority and execution control
- **Real-time tracing** for debugging and performance analysis
- **Memory-efficient** with compiled condition trees and optimized evaluation

---

## Basic Rule Structure

### Minimal Rule
```yaml
rules:
  - id: simple_alert
    when:
      entity: sensor.temperature
      above: 25
    apply:
      overlays:
        - id: temp_display
          style:
            color: "var(--lcars-red)"
```

### Complete Rule Structure
```yaml
rules:
  - id: complex_rule
    priority: 100               # Higher priority = evaluated first (default: 0)
    stop: true                  # Stop processing lower priority rules for same overlay
    when:
      all:                      # All conditions must be true
        - entity: sensor.temperature
          above: 25
        - any:                  # Any of these conditions
            - entity: sensor.humidity
              above: 80
            - time_between: "22:00-06:00"
    apply:
      overlays:                 # Style changes to apply
        - id: alert_panel
          style:
            color: "var(--lcars-red)"
            glow: true
      profiles_add:             # Profiles to activate
        - "night_mode"
      profiles_remove:          # Profiles to deactivate
        - "day_mode"
      animations:               # Animations to trigger
        - id: pulse_animation
          target: "alert_panel"
```

---

## Condition Types

### Entity State Conditions
Test Home Assistant entity states with various comparison operators.

```yaml
# Basic entity existence
- entity: sensor.temperature

# Numeric comparisons
- entity: sensor.temperature
  above: 25                    # Greater than
- entity: sensor.humidity
  below: 30                    # Less than

# Exact matching
- entity: switch.lights
  equals: "on"                 # String or numeric equality
- entity: sensor.status
  not_equals: "unavailable"    # Not equal

# List membership
- entity: sensor.weather
  in: ["sunny", "cloudy"]      # Value in list
- entity: sensor.mode
  not_in: ["off", "disabled"]  # Value not in list

# Regular expressions
- entity: sensor.device_name
  regex: "^bedroom_.*"         # Pattern matching
```

### Entity Attribute Conditions
Access specific entity attributes instead of state.

```yaml
# Check entity attributes
- entity: climate.thermostat
  attribute: "current_temperature"
  above: 22

- entity: media_player.living_room
  attribute: "volume_level"
  below: 0.5
```

### DataSource Integration
Access transformed and aggregated data from DataSources.

```yaml
# Raw datasource value
- entity: temperature_enhanced
  above: 25

# Transformed data
- entity: temperature_enhanced.transformations.celsius
  above: 30

# Aggregated data
- entity: temperature_enhanced.aggregations.avg_5m
  above: 28

# Complex aggregation access
- entity: power_meter.aggregations.trend.direction
  equals: "increasing"
```

### Time-based Conditions
Evaluate based on current time and date.

```yaml
# Time ranges (24-hour format)
- time_between: "22:00-06:00"  # 10 PM to 6 AM
- time_between: "09:00-17:00"  # 9 AM to 5 PM (business hours)

# Weekday filtering
- weekday_in: ["mon", "tue", "wed", "thu", "fri"]  # Weekdays only
- weekday_in: ["sat", "sun"]                       # Weekends only
```

### Environmental Conditions
Test environmental factors like sun elevation.

```yaml
# Sun elevation (astronomical calculations)
- sun_elevation:
    above: -6                  # Civil twilight
- sun_elevation:
    below: 0                   # After sunset
```

### Performance Metric Conditions
Monitor system performance and react to metrics.

```yaml
# Performance monitoring
- perf_metric:
    key: "fps"
    below: 30                  # Low framerate
- perf_metric:
    key: "memory_usage"
    above: 80                  # High memory usage
```

### Debug Flag Conditions
Control rules based on debug flags for testing.

```yaml
# Debug control
- flag:
    debugFlagName: "test_mode"
    is: true                   # Flag is enabled
- flag:
    debugFlagName: "production"
    is: false                  # Flag is disabled
```

### Random Conditions
Add probabilistic behavior to rules.

```yaml
# Random chance (0.0 to 1.0)
- random_chance: 0.1           # 10% chance of triggering
```

### Map Range Conditions
Apply transformations before evaluation.

```yaml
# Transform value then test
- map_range_cond:
    entity: sensor.brightness
    input: [0, 1000]           # Input range
    output: [0, 100]           # Output range (percentage)
    above: 75                  # Test transformed value
    clamp: true                # Clamp input to range
```

---

## Rule Composition

### Logical Operators
Combine conditions with logical operators for complex rules.

```yaml
# All conditions must be true (AND logic)
when:
  all:
    - entity: sensor.temperature
      above: 25
    - entity: sensor.humidity
      above: 70
    - time_between: "10:00-18:00"

# Any condition can be true (OR logic)
when:
  any:
    - entity: sensor.motion
      equals: "on"
    - entity: sensor.door
      equals: "open"
    - entity: sensor.window
      equals: "open"

# Negation (NOT logic)
when:
  not:
    entity: sensor.alarm
    equals: "armed"

# Complex nested logic
when:
  all:
    - entity: sensor.temperature
      above: 25
    - any:
        - entity: sensor.humidity
          above: 80
        - entity: sensor.weather
          equals: "rain"
    - not:
        entity: sensor.hvac
        equals: "cooling"
```

### Priority and Stop Semantics
Control rule execution order and termination.

```yaml
rules:
  # High priority emergency rule
  - id: emergency_alert
    priority: 1000
    stop: true                 # Stops lower priority rules for same overlays
    when:
      entity: sensor.smoke
      equals: "detected"
    apply:
      overlays:
        - id: alert_panel
          style:
            color: "var(--lcars-red)"
            animation: "pulse"

  # Medium priority warning (may be stopped by emergency)
  - id: temperature_warning
    priority: 500
    when:
      entity: sensor.temperature
      above: 30
    apply:
      overlays:
        - id: alert_panel
          style:
            color: "var(--lcars-orange)"

  # Low priority normal display (may be stopped by higher priority)
  - id: normal_display
    priority: 100
    when:
      entity: sensor.temperature
      above: 0
    apply:
      overlays:
        - id: alert_panel
          style:
            color: "var(--lcars-blue)"
```

---

## DataSource Integration

### Enhanced Entity References
The Rules Engine integrates seamlessly with the DataSource system.

```yaml
# Traditional entity references
- entity: sensor.temperature
  above: 25

# DataSource raw value
- entity: temperature_enhanced
  above: 25

# DataSource transformation access
- entity: temperature_enhanced.transformations.celsius
  above: 30
- entity: temperature_enhanced.transformations.smoothed
  above: 28

# DataSource aggregation access
- entity: temperature_enhanced.aggregations.avg_5m
  above: 27
- entity: temperature_enhanced.aggregations.daily.max
  above: 35

# Complex aggregation properties
- entity: power_meter.aggregations.trend.direction
  equals: "increasing"
- entity: power_meter.aggregations.session.count
  above: 100
```

### Dependency Tracking
The Rules Engine automatically tracks dependencies for optimal performance.

```yaml
# This rule will be marked dirty when ANY of these change:
# - sensor.temperature (direct entity)
# - temperature_enhanced (datasource)
# - temperature_enhanced.transformations.celsius (computed value)
rules:
  - id: multi_dependency_rule
    when:
      all:
        - entity: sensor.temperature
          above: 20
        - entity: temperature_enhanced.transformations.celsius
          above: 25
        - entity: temperature_enhanced.aggregations.avg_5m
          above: 23
```

---

## Performance & Optimization

### Dependency-based Evaluation
The Rules Engine only evaluates rules when their dependencies change.

```yaml
# Only evaluates when sensor.temperature changes
- id: temp_rule
  when:
    entity: sensor.temperature
    above: 25

# Only evaluates when time changes (checked periodically)
- id: time_rule
  when:
    time_between: "22:00-06:00"

# Evaluates when EITHER dependency changes
- id: combined_rule
  when:
    all:
      - entity: sensor.temperature
        above: 25
      - time_between: "10:00-18:00"
```

### Compiled Conditions
Conditions are pre-compiled for optimal runtime performance.

```javascript
// Compiled condition tree (internal representation)
{
  type: 'all',
  nodes: [
    { type: 'entity', c: { entity: 'sensor.temp', above: 25 } },
    { type: 'time_between', range: '22:00-06:00' }
  ]
}
```

### Performance Monitoring
Track rule engine performance and identify bottlenecks.

```javascript
// Access performance metrics
const rulesEngine = window.__msdDebug?.pipelineInstance?.systemsManager?.rulesEngine;
console.log('Performance stats:', rulesEngine.getTrace());

// Rule-specific performance
console.log('Temp rule history:', rulesEngine.getRuleTrace('temp_rule', 10));
```

---

## Dependency System

### Automatic Dependency Extraction
The Rules Engine automatically identifies entity dependencies.

```yaml
# Dependencies automatically extracted:
# - sensor.temperature
# - sensor.humidity
# - sensor.motion
rules:
  - id: comfort_rule
    when:
      all:
        - entity: sensor.temperature
          above: 20
        - entity: sensor.humidity
          below: 70
        - entity: sensor.motion
          equals: "detected"
```

### Manual Dependency Inspection
View and debug rule dependencies.

```javascript
// Get dependencies for specific rule
const rulesEngine = window.__msdDebug?.pipelineInstance?.systemsManager?.rulesEngine;
console.log('Rule dependencies:', rulesEngine.getRuleDependencies('comfort_rule'));

// Get rules that depend on specific entity
console.log('Entity dependents:', rulesEngine.getEntityDependents('sensor.temperature'));

// View complete dependency mapping
console.log('All dependencies:', window.__msdDebug?.rulesDeps);
```

### Optimized Dirty Marking
Only affected rules are marked for re-evaluation.

```javascript
// When sensor.temperature changes, only rules referencing it are marked dirty
rulesEngine.markEntitiesDirty(['sensor.temperature']);
// Returns: number of affected rules
```

---

## Rule Tracing & Debugging

### Real-time Tracing
Monitor rule evaluation in real-time for debugging.

```javascript
// Enable tracing (automatically enabled in debug builds)
const rulesEngine = window.__msdDebug?.pipelineInstance?.systemsManager?.rulesEngine;

// Get recent rule activity
console.log('Recent matches:', rulesEngine.getRecentMatches(60000)); // Last minute

// Export trace data
const traceData = rulesEngine.exportTrace({
  timeWindow: 300000,  // 5 minutes
  includeConditions: true,
  includePerformance: true
});
```

### Rule Evaluation History
Track individual rule performance and behavior.

```javascript
// Get evaluation history for specific rule
const history = rulesEngine.getRuleTrace('temperature_alert', 20);
console.log('Rule history:', history);

// Example output:
[
  {
    ruleId: 'temperature_alert',
    timestamp: 1625097600000,
    matched: true,
    evaluationTime: 0.23,
    conditions: { /* condition results */ },
    metadata: { priority: 100, conditionCount: 2 }
  }
]
```

### Performance Analysis
Identify performance bottlenecks and optimization opportunities.

```javascript
// Get comprehensive performance stats
const trace = rulesEngine.getTrace();
console.log('Evaluation counts:', trace.evalCounts);
console.log('Dependency stats:', trace.dependencyStats);
console.log('Trace buffer stats:', trace.traceStats);

// Clear trace buffer
rulesEngine.clearTrace();
```

---

## Configuration Schema

### Rule Schema
```yaml
rules:
  - id: string                  # Required: Unique rule identifier
    priority: number            # Optional: Execution priority (default: 0)
    stop: boolean              # Optional: Stop lower priority rules (default: false)

    when:                      # Required: Condition tree
      # Logical operators
      all: [condition, ...]    # All conditions must be true
      any: [condition, ...]    # Any condition must be true
      not: condition           # Condition must be false

      # Or direct condition
      entity: string           # Direct entity condition
      # ... condition properties

    apply:                     # Required: Actions to apply when rule matches
      overlays:                # Optional: Overlay style patches
        - id: string           # Overlay ID to modify
          style:               # Style properties to apply
            property: value    # CSS property: value pairs

      profiles_add: [string]   # Optional: Profiles to activate
      profiles_remove: [string] # Optional: Profiles to deactivate
      animations: [object]     # Optional: Animations to trigger
```

### Condition Schema
```yaml
# Entity State Condition
entity: string                 # Entity ID or DataSource reference
attribute: string              # Optional: specific attribute name
above: number                  # Optional: greater than comparison
below: number                  # Optional: less than comparison
equals: any                    # Optional: equality comparison
not_equals: any               # Optional: inequality comparison
in: [any, ...]                # Optional: list membership
not_in: [any, ...]            # Optional: list exclusion
regex: string                  # Optional: regular expression pattern

# Time Condition
time_between: string           # Format: "HH:MM-HH:MM"

# Weekday Condition
weekday_in: [string, ...]     # Days: mon, tue, wed, thu, fri, sat, sun

# Sun Elevation Condition
sun_elevation:
  above: number               # Degrees above horizon
  below: number               # Degrees below horizon

# Performance Metric Condition
perf_metric:
  key: string                 # Metric name
  above: number               # Optional: threshold comparisons
  below: number
  equals: number

# Debug Flag Condition
flag:
  debugFlagName: string       # Flag name
  is: boolean                 # Expected state

# Random Condition
random_chance: number         # Probability (0.0 to 1.0)

# Map Range Condition
map_range_cond:
  entity: string              # Source entity
  input: [number, number]     # Input range [min, max]
  output: [number, number]    # Output range [min, max]
  clamp: boolean              # Clamp input to range
  # Then any comparison operator (above, below, equals, etc.)
```

---

## Best Practices

### Rule Organization
1. **Use meaningful IDs**: Choose descriptive rule identifiers
2. **Group related rules**: Organize by function or area
3. **Set appropriate priorities**: Emergency > Warning > Normal > Cosmetic
4. **Use stop semantics carefully**: Only when lower priority rules should not apply

### Performance Optimization
1. **Minimize dependencies**: Fewer dependencies = better performance
2. **Use appropriate priorities**: Higher priority rules evaluate first
3. **Avoid expensive conditions**: Regex and complex expressions cost more
4. **Group related conditions**: Use `all`/`any` efficiently

### Condition Design
1. **Be specific**: Precise conditions reduce false triggers
2. **Use ranges wisely**: Consider tolerance for sensor noise
3. **Handle edge cases**: Account for unavailable/unknown states
4. **Test incrementally**: Start simple, add complexity gradually

### DataSource Integration
1. **Use aggregated data**: Smoothed/averaged values for stability
2. **Leverage transformations**: Convert units in DataSource, not rules
3. **Access efficiently**: Direct property access vs. nested conditions
4. **Monitor dependencies**: Understand what triggers rule evaluation

---

## Troubleshooting

### Common Issues

#### 1. Rules Not Triggering
**Symptoms**: Expected rules don't execute
**Solutions**:
- Check entity names and DataSource references
- Verify condition thresholds and operators
- Test individual conditions separately
- Check rule dependencies and dirty state

```javascript
// Debug rule dependencies
const rulesEngine = window.__msdDebug?.pipelineInstance?.systemsManager?.rulesEngine;
console.log('Rule deps:', rulesEngine.getRuleDependencies('my_rule'));
console.log('Is dirty:', rulesEngine.dirtyRules.has('my_rule'));
```

#### 2. Performance Issues
**Symptoms**: Slow rule evaluation, UI lag
**Solutions**:
- Review rule priorities and dependency counts
- Optimize complex conditions
- Check for infinite evaluation loops
- Monitor evaluation frequency

```javascript
// Check performance stats
const trace = rulesEngine.getTrace();
console.log('Eval counts:', trace.evalCounts);
console.log('Avg rules per entity:', trace.dependencyStats.avgRulesPerEntity);
```

#### 3. Stop Semantics Problems
**Symptoms**: Rules not applying as expected
**Solutions**:
- Review rule priorities and stop flags
- Check overlay ID targeting
- Test rule order manually
- Use rule tracing to see execution flow

```javascript
// Monitor rule execution
console.log('Recent matches:', rulesEngine.getRecentMatches(60000));
console.log('Rule trace:', rulesEngine.getRuleTrace('my_rule', 5));
```

#### 4. DataSource Integration Issues
**Symptoms**: DataSource references not working
**Solutions**:
- Verify DataSource names and configuration
- Check dot notation syntax
- Ensure DataSource is initialized
- Test getEntity function directly

```javascript
// Test DataSource access
const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;
console.log('Test entity access:', dsm.getEntity('temp_source.transformations.celsius'));
```

### Debug Commands

#### Basic Rule Inspection
```javascript
// Get Rules Engine
const rulesEngine = window.__msdDebug?.pipelineInstance?.systemsManager?.rulesEngine;

// Check rule status
console.log('Total rules:', rulesEngine.rules.length);
console.log('Dirty rules:', rulesEngine.dirtyRules.size);
console.log('Performance:', rulesEngine.getTrace());
```

#### Dependency Analysis
```javascript
// View all dependencies
console.log('Dependencies:', window.__msdDebug?.rulesDeps);

// Check specific rule
console.log('Rule deps:', rulesEngine.getRuleDependencies('temperature_alert'));

// Check entity impact
console.log('Entity deps:', rulesEngine.getEntityDependents('sensor.temperature'));
```

#### Real-time Monitoring
```javascript
// Watch rule evaluation
const originalEvaluate = rulesEngine.evaluateRule;
rulesEngine.evaluateRule = function(rule, getEntity) {
  const result = originalEvaluate.call(this, rule, getEntity);
  console.log(`Rule ${rule.id}: ${result.matched ? 'MATCHED' : 'no match'}`);
  return result;
};
```

#### Trace Analysis
```javascript
// Export detailed trace
const traceData = rulesEngine.exportTrace({
  timeWindow: 300000,      // 5 minutes
  includeConditions: true,
  includePerformance: true,
  format: 'detailed'
});

// Save trace to file
const blob = new Blob([JSON.stringify(traceData, null, 2)],
  { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'rules-trace.json';
a.click();
```

---

## Examples

### Example 1: Home Security System
```yaml
rules:
  # Emergency: Smoke detected
  - id: smoke_emergency
    priority: 1000
    stop: true
    when:
      entity: binary_sensor.smoke_detector
      equals: "on"
    apply:
      overlays:
        - id: alert_panel
          style:
            background: "var(--lcars-red)"
            color: "white"
            font_weight: "bold"
            animation: "pulse 1s infinite"
      profiles_add: ["emergency_mode"]

  # High priority: Intrusion detected
  - id: intrusion_alert
    priority: 800
    when:
      all:
        - entity: alarm_control_panel.house
          equals: "armed_away"
        - any:
            - entity: binary_sensor.front_door
              equals: "on"
            - entity: binary_sensor.motion_living_room
              equals: "on"
            - entity: binary_sensor.window_sensor
              equals: "on"
    apply:
      overlays:
        - id: security_status
          style:
            color: "var(--lcars-red)"
            glow: true
        - id: alert_panel
          style:
            background: "var(--lcars-orange)"
            animation: "flash 0.5s infinite"
      profiles_add: ["security_breach"]

  # Medium priority: Armed state indicator
  - id: armed_indicator
    priority: 400
    when:
      entity: alarm_control_panel.house
      in: ["armed_home", "armed_away"]
    apply:
      overlays:
        - id: security_status
          style:
            color: "var(--lcars-green)"
            border: "2px solid var(--lcars-green)"

  # Low priority: Disarmed state
  - id: disarmed_indicator
    priority: 200
    when:
      entity: alarm_control_panel.house
      equals: "disarmed"
    apply:
      overlays:
        - id: security_status
          style:
            color: "var(--lcars-gray)"
            border: "1px solid var(--lcars-gray)"
```

### Example 2: Environmental Control with DataSources
```yaml
rules:
  # Temperature management with enhanced data
  - id: temperature_control
    priority: 600
    when:
      all:
        # Use smoothed temperature to avoid fluctuations
        - entity: temperature_enhanced.transformations.smoothed
          above: 26
        # Trend is increasing
        - entity: temperature_enhanced.aggregations.trend.direction
          equals: "increasing"
        # During day hours
        - time_between: "08:00-20:00"
        # Not already cooling
        - entity: climate.hvac
          not_equals: "cool"
    apply:
      overlays:
        - id: climate_control
          style:
            color: "var(--lcars-blue)"
            glow: true
      profiles_add: ["cooling_mode"]

  # Humidity control
  - id: humidity_alert
    priority: 500
    when:
      all:
        # High humidity average over time
        - entity: humidity_sensor.aggregations.avg_30m
          above: 70
        # And current humidity is also high
        - entity: sensor.humidity
          above: 75
        # During humid seasons
        - entity: sensor.season
          in: ["summer", "spring"]
    apply:
      overlays:
        - id: humidity_display
          style:
            color: "var(--lcars-orange)"
            font_weight: "bold"

  # Energy efficiency mode
  - id: efficiency_mode
    priority: 300
    when:
      all:
        # Power usage trending up
        - entity: power_meter.aggregations.rate
          above: 50  # More than 50W/min increase
        # Total power is high
        - entity: power_meter.transformations.kilowatts
          above: 3.0
        # During peak hours
        - time_between: "16:00-20:00"
        # Weekdays only
        - weekday_in: ["mon", "tue", "wed", "thu", "fri"]
    apply:
      overlays:
        - id: power_display
          style:
            color: "var(--lcars-yellow)"
            border: "2px solid var(--lcars-yellow)"
      profiles_add: ["power_saving"]
```

### Example 3: Adaptive UI with Performance Monitoring
```yaml
rules:
  # Performance-based UI adaptation
  - id: performance_degradation
    priority: 900
    when:
      any:
        # Low framerate
        - perf_metric:
            key: "fps"
            below: 30
        # High memory usage
        - perf_metric:
            key: "memory_usage"
            above: 80
        # Slow rule evaluation
        - perf_metric:
            key: "rules.eval.avg_time"
            above: 5
    apply:
      overlays:
        - id: performance_warning
          style:
            color: "var(--lcars-red)"
            font_size: "0.9em"
      profiles_add: ["low_performance_mode"]

  # Time-based themes
  - id: night_theme
    priority: 400
    when:
      any:
        # After sunset
        - sun_elevation:
            below: -6
        # Or manual night mode
        - entity: input_boolean.night_mode
          equals: "on"
        # Or late hours
        - time_between: "22:00-06:00"
    apply:
      profiles_add: ["night_theme"]
      profiles_remove: ["day_theme"]

  - id: day_theme
    priority: 300
    when:
      all:
        # Sun is up
        - sun_elevation:
            above: 0
        # Not manual night mode
        - entity: input_boolean.night_mode
          equals: "off"
        # During day hours
        - time_between: "06:00-22:00"
    apply:
      profiles_add: ["day_theme"]
      profiles_remove: ["night_theme"]

  # Debug mode activation
  - id: debug_mode
    priority: 100
    when:
      all:
        # Debug flag enabled
        - flag:
            debugFlagName: "ui_debug"
            is: true
        # During development hours
        - time_between: "09:00-18:00"
        # Random chance for testing
        - random_chance: 0.8
    apply:
      overlays:
        - id: debug_panel
          style:
            display: "block"
            border: "1px dashed var(--lcars-yellow)"
      profiles_add: ["debug_mode"]
```

### Example 4: Complex Conditional Logic
```yaml
rules:
  # Nested conditional example
  - id: complex_home_automation
    priority: 700
    when:
      all:
        # Someone is home
        - entity: group.family
          equals: "home"

        # Weather and time conditions
        - any:
            # Daytime and sunny
            - all:
                - time_between: "08:00-18:00"
                - entity: weather.home
                  equals: "sunny"
                - entity: sensor.uv_index
                  above: 3

            # Evening and cool
            - all:
                - time_between: "18:00-22:00"
                - entity: sensor.outdoor_temperature
                  below: 20

            # Night and motion detected
            - all:
                - time_between: "22:00-06:00"
                - entity: binary_sensor.motion
                  equals: "on"

        # Not in vacation mode
        - not:
            entity: input_boolean.vacation_mode
            equals: "on"

        # Advanced DataSource conditions
        - entity: energy_usage.aggregations.trend.direction
          not_equals: "increasing"

    apply:
      overlays:
        - id: automation_status
          style:
            color: "var(--lcars-green)"
            glow: true
        - id: home_status
          style:
            background: "linear-gradient(45deg, var(--lcars-blue), var(--lcars-green))"
      profiles_add: ["active_automation"]
      animations:
        - id: welcome_pulse
          target: "main_display"
          duration: 2000
```

---

This completes the comprehensive Rules Engine documentation covering all condition types, composition patterns, performance optimization, and practical examples. The system provides powerful conditional logic capabilities while maintaining high performance and ease of debugging.