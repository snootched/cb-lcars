# Testing Guide: Rolling Statistics Multi-Value Charts

This guide will help you test the newly implemented ApexCharts multi-value array support with rolling_statistics aggregations.

---

## Quick Start

### Prerequisites
1. CB-LCARS card installed in Home Assistant
2. Latest build deployed (`npm run build` completed successfully)
3. Access to Home Assistant sensors for testing

### Test Entities Needed

You'll need at least one numeric sensor in Home Assistant. Good candidates:
- Temperature sensor: `sensor.outdoor_temperature` or `sensor.indoor_temperature`
- Power sensor: `sensor.power_meter` or `sensor.home_energy_usage`
- CPU usage: `sensor.processor_use`
- Memory: `sensor.memory_use_percent`
- Any custom numeric sensor

---

## Test 1: RangeArea Chart (Simplest)

**Purpose**: Verify rolling_statistics outputs arrays correctly for min/max range visualization.

**Config File**: `/test/test-rolling-stats-rangearea.yaml`

### Steps:

1. **Edit the test configuration**:
   - Open `/test/test-rolling-stats-rangearea.yaml`
   - Change `entity: sensor.outdoor_temperature` to your actual sensor
   - Adjust `window: "5m"` if needed (try 1m for faster testing)

2. **Load in Home Assistant**:
   - Copy the entire YAML content
   - Go to Home Assistant → Settings → Dashboards
   - Edit a dashboard → Add Card → Manual Card
   - Paste the YAML

3. **What to look for**:
   - ✅ Chart renders without errors
   - ✅ Shaded area appears between min and max values
   - ✅ X-axis shows time correctly
   - ✅ Y-axis shows temperature values
   - ✅ Chart updates in real-time as sensor changes
   - ✅ Tooltip shows min and max values when hovering

4. **Debugging**:
   - Open browser console (F12)
   - Look for `[ApexChartsAdapter]` messages
   - Should see: "Processing multi-value data" with valuesPerPoint: 2
   - Should NOT see: "invalid multi-value point" errors

---

## Test 2: Candlestick Chart (Medium)

**Purpose**: Verify OHLC (Open-High-Low-Close) array format for financial-style candles.

**Config File**: `/test/test-rolling-stats-candlestick.yaml`

### Steps:

1. **Edit the test configuration**:
   - Open `/test/test-rolling-stats-candlestick.yaml`
   - Change `entity: sensor.power_usage` to your power/energy sensor
   - Or use any numeric sensor that fluctuates
   - Adjust `window: "15m"` (try 5m for faster testing)

2. **Load in Home Assistant** (same as Test 1)

3. **What to look for**:
   - ✅ Candlestick bars appear
   - ✅ Green candles when close > open (value increased)
   - ✅ Red candles when close < open (value decreased)
   - ✅ Wicks show high/low range
   - ✅ Body shows open/close range
   - ✅ Chart updates with new candles as time passes

4. **Understanding the candles**:
   - **Open**: First value in the time window
   - **High**: Maximum value in the window
   - **Low**: Minimum value in the window
   - **Close**: Last value in the window

---

## Test 3: BoxPlot Chart (Advanced)

**Purpose**: Verify 5-number summary (min, q1, median, q3, max) for distribution visualization.

**Config File**: `/test/test-rolling-stats-boxplot.yaml`

### Steps:

1. **Edit the test configuration**:
   - Open `/test/test-rolling-stats-boxplot.yaml`
   - Change `entity: sensor.api_response_time` to any numeric sensor
   - Good candidates: CPU, memory, temperature sensors with variation
   - Adjust `window: "5m"` as needed

2. **Load in Home Assistant** (same as Test 1)

3. **What to look for**:
   - ✅ Box-and-whisker plots appear
   - ✅ Box shows middle 50% of data (Q1 to Q3)
   - ✅ Line in box shows median
   - ✅ Whiskers extend to min and max values
   - ✅ Chart shows distribution over time

4. **Understanding the boxplot**:
   ```
   Maximum ─────┐
                │  Upper whisker
   Q3 (75%) ────┤
                │  Box (IQR)
   Median ──────┼  Line
                │  Box (IQR)
   Q1 (25%) ────┤
                │  Lower whisker
   Minimum ─────┘
   ```

---

## Test 4: All Three Charts (Comprehensive)

**Purpose**: Verify all three chart types work together and don't interfere with each other.

**Config File**: `/test/test-rolling-stats-all-charts.yaml`

### Steps:

1. **Edit the test configuration**:
   - Open `/test/test-rolling-stats-all-charts.yaml`
   - Change all three entity names:
     - `sensor.outdoor_temperature` → your temp sensor
     - `sensor.power_usage` → your power sensor
     - `sensor.api_response_time` → any numeric sensor
   - Adjust time windows if needed

2. **Load in Home Assistant**

3. **What to look for**:
   - ✅ All three charts render without errors
   - ✅ Each chart type displays correctly
   - ✅ Charts don't overlap or interfere
   - ✅ Info box on right explains the data flow
   - ✅ All charts update independently

---

## Expected Console Output

When charts are working correctly, you should see in browser console:

```
[ApexChartsAdapter] Processing multi-value data for Temp Range: {
  points: 12,
  valuesPerPoint: 2,
  sample: [18.5, 22.3]
}

[ApexChartsAdapter] Processing multi-value data for Power: {
  points: 6,
  valuesPerPoint: 4,
  sample: [1200, 1450, 1100, 1380]
}

[ApexChartsAdapter] Processing multi-value data for Response Time: {
  points: 12,
  valuesPerPoint: 5,
  sample: [45, 67, 89, 123, 201]
}

[ApexChartsOverlayRenderer] 🔄 Updated chart temp_range_chart
[ApexChartsOverlayRenderer] 🔄 Updated chart power_candlestick
[ApexChartsOverlayRenderer] 🔄 Updated chart response_boxplot
```

---

## Troubleshooting

### Problem: Chart doesn't render

**Check**:
1. Entity name is correct (matches your Home Assistant sensor)
2. Sensor is numeric (not string state like "on"/"off")
3. Sensor has history data (check windowSeconds)
4. No JavaScript errors in console

**Solution**:
- Verify entity: `http://homeassistant.local:8123/developer-tools/state`
- Check sensor type: Should show numeric values
- Wait a few minutes for data to accumulate

### Problem: "No valid multi-value data points" warning

**Check**:
1. Aggregation is configured correctly with `type: rolling_statistics`
2. Stats array matches chart type:
   - rangeArea: `[min, max]`
   - candlestick: `[open, high, low, close]`
   - boxPlot: `[min, q1, median, q3, max]`
3. `output_format: array` is set

**Solution**:
```yaml
aggregations:
  - key: my_stats
    type: rolling_statistics  # Must be exactly this
    window: "5m"
    stats: [min, max]         # Must match chart type
    output_format: array      # Must be 'array' not 'object'
```

### Problem: Chart shows but data looks wrong

**Check**:
1. Time window is appropriate for your sensor's update frequency
2. Window (e.g., "5m") gives enough data points
3. Sensor updates frequently enough

**Solution**:
- Fast-updating sensor (every 10s): Use `window: "1m"`
- Slow sensor (every 5 min): Use `window: "30m"`
- Match `windowSeconds` to your testing period

### Problem: Chart doesn't update in real-time

**Check**:
1. Sensor is actually changing values
2. Browser console shows update messages
3. No subscription errors

**Solution**:
- Trigger a sensor update manually
- Check: `[ApexChartsOverlayRenderer] 🔄 Updated chart ...`
- If missing, check DataSource subscription is working

---

## Validation Checklist

After testing, verify:

- [ ] **RangeArea chart**:
  - [ ] Renders without errors
  - [ ] Shows shaded area
  - [ ] Updates in real-time
  - [ ] Tooltip shows min/max values

- [ ] **Candlestick chart**:
  - [ ] Renders without errors
  - [ ] Shows OHLC candles
  - [ ] Green/red color coding works
  - [ ] Updates with new candles
  - [ ] Tooltip shows OHLC values

- [ ] **BoxPlot chart**:
  - [ ] Renders without errors
  - [ ] Shows box-and-whisker plots
  - [ ] Box shows Q1-Q3 range
  - [ ] Whiskers show min/max
  - [ ] Updates in real-time

- [ ] **All charts**:
  - [ ] No JavaScript errors
  - [ ] Console shows "Processing multi-value data"
  - [ ] No "invalid" warnings
  - [ ] Real-time updates working

---

## Next Steps After Testing

Once you've verified the charts work:

1. **Take screenshots** for documentation
2. **Document any issues** found (create GitHub issues)
3. **Share working configs** with the community
4. **Update user guide** with tested examples
5. **Celebrate!** 🎉 You've completed Phase 3A!

---

## Getting Help

If you encounter issues:

1. **Check console** for error messages
2. **Enable debug logging**:
   ```yaml
   msd:
     data_sources:
       temperature:
         debug: true  # Add this for detailed logs
   ```
3. **Share console output** with error messages
4. **Provide test configuration** you're using

---

## Success Criteria

✅ **Phase 3A is verified complete when**:
- All three chart types render correctly
- Multi-value arrays (min/max, OHLC, quartiles) display properly
- Real-time updates work for all chart types
- No console errors related to array data handling
- Charts show correct values in tooltips

**If all checkboxes above are ✅, Phase 3A verification is complete!**
