# Updated Test Configuration for HistoryBarRenderer

## Better Real-time History Bar Configuration

```yaml
overlays:
  # Real-time history bar with 30-minute buckets
  - id: test_history_bar_realtime
    type: history_bar
    position: [100, 100]
    size: [400, 120]
    source: test_cpu_temp
    style:
      orientation: horizontal
      time_window: 12h  # Shorter window for real-time testing
      bucket_size: 30m  # 30-minute buckets for better granularity
      aggregation_mode: latest  # Use latest value when multiple points in bucket
      bar_color: var(--lcars-blue)
      bar_gap: 2
      bar_radius: 3
      show_grid: true
      show_axis: true
      show_labels: true
      grid_color: var(--lcars-gray)
      axis_color: var(--lcars-white)
      label_color: var(--lcars-white)
      thresholds:
        - value: 20
          color: var(--lcars-blue)
          width: 2
        - value: 50
          color: var(--lcars-orange)
          width: 2
          dash: true
      color_ranges:
        - min: 0
          max: 25
          color: var(--lcars-blue)
        - min: 25
          max: 50
          color: var(--lcars-green)
        - min: 50
          max: 75
          color: var(--lcars-orange)
        - min: 75
          max: 100
          color: var(--lcars-red)
      bracket_style: true
      status_indicator: var(--lcars-green)

  # Original 24-hour view with hourly buckets
  - id: test_history_bar_daily
    type: history_bar
    position: [100, 250]
    size: [400, 120]
    source: test_cpu_temp
    style:
      orientation: horizontal
      time_window: 24h
      bucket_size: 1h  # Hourly buckets for daily view
      aggregation_mode: average  # Average is fine for longer periods
      bar_color: var(--lcars-blue)
      show_axis: true
      show_labels: true
```

## Key Changes for Real-time Updates:

1. **Shorter time window** (12h vs 24h) - shows more recent data
2. **Smaller buckets** (30m vs 1h) - better granularity for real-time changes
3. **Latest aggregation** - when multiple values in same bucket, use the most recent
4. **Better color ranges** - matches typical temperature ranges

This should eliminate the "averaging" issue where new values get mixed with old values in the same time bucket.