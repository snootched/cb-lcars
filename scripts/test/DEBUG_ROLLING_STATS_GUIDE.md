# Rolling Statistics Array Output Debug Guide

## Issue: Values returned are singular instead of arrays

Your configuration looks mostly correct, but here are the steps to diagnose:

## Step 1: Check Your Config Syntax

Your config:
```yaml
temp_range:
  entity: sensor.toronto_feels_like_temperature
  aggregations:
    - type: rolling_statistics
      key: hourly_range
      window: 24h              # ⚠️ YAML might interpret this as a number!
      stats:
        - min
        - max
      output_format: array     # ✅ Correct
```

### Potential Issues:

1. **Window needs quotes in YAML:**
   ```yaml
   window: "24h"  # ✅ Explicit string
   # vs
   window: 24h    # ⚠️ YAML parser might fail
   ```

2. **Need windowSeconds for buffer:**
   ```yaml
   temp_range:
     entity: sensor.toronto_feels_like_temperature
     windowSeconds: 86400  # 24 hours - buffer must be >= aggregation window!
     aggregations:
       - type: rolling_statistics
         key: hourly_range
         window: "24h"
         ...
   ```

## Step 2: Use Debug Scripts

### Quick Debug (Paste in Browser Console):

```javascript
// Copy contents of debug-quick-rolling-stats.js
// It will automatically scan all datasources and show array outputs
```

### Detailed Debug (Paste in Browser Console):

```javascript
// First, load the debug function
// Copy contents of debug-rolling-stats.js

// Then run:
debugRollingStats('temp_range')
```

## Step 3: Check Console Logs

With `debug: true` on your datasource, you should see:

```
[RollingStatistics] Initialized "hourly_range": stats=[min, max], window=86400000ms, format=array
```

If you see `format=object` instead of `format=array`, there's a config issue.

## Step 4: Verify in Template

Try accessing the array in an overlay:

```yaml
overlays:
  - id: test_display
    type: text
    content: |
      Min: {temp_range.aggregates.hourly_range[0]}
      Max: {temp_range.aggregates.hourly_range[1]}
      Type: {temp_range.aggregates.hourly_range.__class__}
    position: [50, 50]
```

## Step 5: Common Fixes

### Fix 1: Add Quotes to Window
```yaml
window: "24h"  # Not: window: 24h
```

### Fix 2: Ensure Buffer is Large Enough
```yaml
temp_range:
  entity: sensor.toronto_feels_like_temperature
  windowSeconds: 86400  # Must be >= 24h (86400 seconds)
  aggregations:
    - type: rolling_statistics
      window: "24h"  # This must fit within windowSeconds
```

### Fix 3: Check output_format Spelling
```yaml
output_format: array  # Lowercase 'array', no quotes needed in YAML
# NOT: output_format: "array"
# NOT: outputFormat: array (wrong case)
```

### Fix 4: Verify Stats Array
```yaml
stats:
  - min
  - max
# OR (inline array):
stats: [min, max]
```

## Step 6: Expected Behavior

### Correct Array Output:
```javascript
temp_range.aggregates.hourly_range = [5.2, 23.8]  // [min, max]
```

### If You See Object Instead:
```javascript
temp_range.aggregates.hourly_range = {min: 5.2, max: 23.8}  // Wrong format!
```

This means `output_format` is not set to `array`.

## Complete Working Example

```yaml
type: custom:cb-lcars-msd
msd:
  data_sources:
    temp_range:
      entity: sensor.toronto_feels_like_temperature
      windowSeconds: 86400  # 24 hours
      debug: true  # See initialization logs

      aggregations:
        - type: rolling_statistics
          key: hourly_range
          window: "24h"  # Quoted!
          stats:
            - min
            - max
          output_format: array  # Lowercase, no quotes

  overlays:
    # Test display
    - id: temp_display
      type: text
      content: "Temp Range: {temp_range.aggregates.hourly_range[0]:.1f}°C - {temp_range.aggregates.hourly_range[1]:.1f}°C"
      position: [50, 50]

    # ApexChart (if using)
    - id: range_chart
      type: apexchart
      source: temp_range.aggregates.hourly_range
      position: [50, 100]
      size: [600, 300]
      style:
        chart_type: rangeArea
        name: "Temperature Range"
```

## Debug Output to Look For

When it's working correctly, `debugRollingStats('temp_range')` should show:

```
✅ Found datasource: temp_range
⚙️  AGGREGATION PROCESSORS:
[0] RollingStatisticsAggregation:
  Key: hourly_range
  Stats: [min, max]
  Output Format: array  ← Should say "array"!
  ✅ Manual compute result:
    Type: object
    Is array?: true  ← Should be true!
    Value: [5.2, 23.8]  ← Array with 2 values!
```

## Still Not Working?

1. Check browser console for errors
2. Verify sensor exists: `sensor.toronto_feels_like_temperature`
3. Check sensor has numeric values (not strings)
4. Make sure card has loaded fully before testing
5. Try rebuilding: `npm run build`
6. Clear browser cache and reload

## Quick Test Command

Paste this in browser console for instant feedback:

```javascript
// Use CB-LCARS proper API
(function() {
  const instance = window.cblcars?.debug?.msd?.MsdInstanceManager?.getCurrentInstance();
  if (!instance) {
    console.log('❌ MSD instance not found!');
    return;
  }

  const dsManager = instance.getDataSourceManager?.();
  if (!dsManager) {
    console.log('❌ DataSourceManager not available!');
    return;
  }

  const ds = dsManager.getDataSource('temp_range');
  if (ds) {
    const state = ds.getState();
    console.log('hourly_range:', state.aggregates?.hourly_range);
    console.log('Is Array?:', Array.isArray(state.aggregates?.hourly_range));
  } else {
    console.log('temp_range not found!');
    console.log('Available:', Object.keys(dsManager.getAllDataSources()));
  }
})();
```
