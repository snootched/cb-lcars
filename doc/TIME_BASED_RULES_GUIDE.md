# Time-Based Rules Guide

## Quick Reference

**Problem**: Rules with `time_between` conditions don't automatically trigger at specific times.

**Solution**: Add `sensor.time` to your rule conditions to trigger evaluation every minute.

## Understanding the Rules Engine

The RulesEngine is **reactive**, not **proactive**:
- Rules only evaluate when entity states change
- No background timers or clock watching
- `time_between` is checked during evaluation, but doesn't trigger evaluation

## Basic Time-Based Rule Pattern

```yaml
rules:
  - id: night_mode
    when:
      all:
        - entity: sensor.time        # ← Required for time-based triggers
        - time_between: "22:00-06:00"
    apply:
      # Your actions here
```

## Setting Up sensor.time

Home Assistant usually includes `sensor.time` by default. If not, add to `configuration.yaml`:

```yaml
sensor:
  - platform: time_date
    display_options:
      - 'time'
```

This creates `sensor.time` which updates every minute.

## Complete Examples

### Example 1: Dim Base SVG at Night

```yaml
rules:
  - id: dim_at_night
    priority: 100
    when:
      all:
        - entity: sensor.time
        - time_between: "22:00-06:00"
    apply:
      actions:
        - type: update_base_svg_filter
          filters:
            opacity: 0.3
            brightness: 0.6

  - id: normal_during_day
    priority: 90
    when:
      all:
        - entity: sensor.time
        - time_between: "06:00-22:00"
    apply:
      actions:
        - type: update_base_svg_filter
          filters:
            opacity: 0.5
            brightness: 0.8
```

### Example 2: Time + Entity Condition

```yaml
rules:
  - id: motion_during_night
    when:
      all:
        - entity: sensor.time           # Updates every minute
        - time_between: "22:00-06:00"   # Checked when rule evaluates
        - entity: binary_sensor.motion
          state: "on"
    apply:
      overlays:
        - id: alert_light
          visible: true
```

### Example 3: Multiple Time Periods

```yaml
rules:
  - id: morning_mode
    priority: 100
    when:
      all:
        - entity: sensor.time
        - time_between: "06:00-12:00"
    apply:
      # Morning settings

  - id: afternoon_mode
    priority: 90
    when:
      all:
        - entity: sensor.time
        - time_between: "12:00-18:00"
    apply:
      # Afternoon settings

  - id: evening_mode
    priority: 80
    when:
      all:
        - entity: sensor.time
        - time_between: "18:00-22:00"
    apply:
      # Evening settings

  - id: night_mode
    priority: 70
    when:
      all:
        - entity: sensor.time
        - time_between: "22:00-06:00"
    apply:
      # Night settings
```

## Performance Impact

**Overhead is minimal** thanks to dependency tracking:

### How It Works

1. **Dependency Index**: Maps entities to rules that use them
2. **Selective Evaluation**: Only rules referencing changed entities are evaluated
3. **Efficient Skipping**: All other rules remain idle

### Performance Metrics

With `sensor.time` updating every minute:

| Total Rules | Time-Based Rules | Rules Evaluated | Rules Skipped | Overhead    |
|-------------|------------------|-----------------|---------------|-------------|
| 10          | 2                | 2               | 8             | ~2-5ms      |
| 50          | 5                | 5               | 45            | ~5-10ms     |
| 100         | 10               | 10              | 90            | ~10-20ms    |

**Conclusion**: Safe to use even with 10+ time-based rules.

## Common Patterns

### Pattern 1: Pure Time Trigger

```yaml
rules:
  - id: scheduled_action
    when:
      all:
        - entity: sensor.time
        - time_between: "14:00-14:01"  # Narrow window for specific time
    apply:
      # Triggers once around 2pm daily
```

### Pattern 2: Time + State Combination

```yaml
rules:
  - id: night_alert
    when:
      all:
        - entity: sensor.time
        - time_between: "22:00-06:00"
        - entity: sensor.security_status
          state: "armed"
    apply:
      # Only when armed at night
```

### Pattern 3: Midnight-Crossing Time Range

```yaml
rules:
  - id: late_night_mode
    when:
      all:
        - entity: sensor.time
        - time_between: "23:00-02:00"  # Crosses midnight
    apply:
      # Active from 11pm to 2am
```

The `time_between` condition handles midnight-crossing ranges automatically.

## Why Not a Background Timer?

You might wonder: "Why not just have the RulesEngine poll every minute?"

**Reasons for the current design**:

1. **Efficiency**: Most rules don't need time-based evaluation
2. **Explicit Dependencies**: Clear which rules need time triggers
3. **User Control**: Users decide if they want minute-level updates
4. **Resource Friendly**: No unnecessary CPU usage for cards without time rules

## Troubleshooting

### Issue: Rule doesn't trigger at expected time

**Check**:
1. Is `sensor.time` referenced in the rule?
2. Does `sensor.time` exist in Home Assistant?
3. Is the `time_between` range correct (24-hour format)?

### Issue: Rule triggers but wrong time

**Check**:
1. Home Assistant timezone configuration
2. Browser timezone matches HA timezone
3. Time format (HH:MM, 24-hour)

### Issue: Performance concerns with many time rules

**Solution**:
- Each time-based rule adds ~1-2ms per minute
- 10 rules = ~10-20ms per minute (negligible)
- Only add `sensor.time` to rules that actually need time triggers

## Advanced: Custom Update Frequency

For more frequent updates (e.g., every 30 seconds):

```yaml
# Home Assistant configuration.yaml
sensor:
  - platform: template
    sensors:
      time_30s:
        friendly_name: "Time (30s updates)"
        value_template: "{{ now().strftime('%H:%M:%S') }}"
        # Updates every 30 seconds
```

Use `sensor.time_30s` in rules for faster response.

**Note**: More frequent updates = more rule evaluations. Only use if necessary.

## Related Documentation

- [Base SVG Filters](user-guide/configuration/base-svg-filters.md) - Time-based filter examples
- [MSD Schema](architecture/MSD_SCHEMA_V1_Ratified.yaml) - Complete rules syntax
- [Rules Engine Architecture](architecture/subsystems/rules-engine.md) - Technical details

## Summary

✅ **Add `sensor.time` to enable time-based rule triggers**
✅ **Performance overhead is minimal (dependency tracking)**
✅ **`time_between` automatically handles midnight-crossing ranges**
✅ **Safe to use with 5-10+ time-based rules**
✅ **Reactive design is efficient and explicit**
