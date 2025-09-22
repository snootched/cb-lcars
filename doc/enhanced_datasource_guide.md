# Enhanced DataSource System - Complete Implementation Guide

## 🎉 Status: FULLY IMPLEMENTED AND OPERATIONAL

The enhanced DataSource system is now live and provides powerful data transformation and aggregation capabilities with zero breaking changes to existing configurations.

## ✅ What's New

### **Unified Dot Notation Access**
Access transformed and aggregated data through intuitive paths:
- `source.transformations.celsius` - Unit converted temperature
- `source.transformations.smoothed` - Smoothed values
- `source.aggregations.avg_5m` - 5-minute moving average
- `source.aggregations.trend` - Trend analysis

### **Real-Time Transformations**
50+ built-in transformations including:
- **Unit conversions**: `f_to_c`, `c_to_f`, `w_to_kw`, `mph_to_kmh`, etc.
- **Scaling**: Linear, logarithmic, exponential curves
- **Smoothing**: Exponential averaging, median filtering
- **Statistical**: Standard deviation, percentiles, z-score analysis
- **Home Assistant specific**: Brightness, volume, signal strength

### **Live Aggregations**
Real-time statistical analysis:
- **Moving averages**: Time-window or sample-based
- **Min/Max tracking**: Daily stats, session statistics
- **Rate of change**: Velocity and acceleration analysis
- **Trend detection**: Direction and strength analysis
- **Duration tracking**: How long conditions are maintained

### **Historical Data Integration**
- **Automatic transform history caching** for sparklines
- **Historical data populated** on startup from Home Assistant
- **Real-time subscription support** for all dot notation paths

## 🚀 Usage Examples

### **Basic Enhanced Configuration**
```yaml
data_sources:
  temperature_enhanced:
    type: entity
    entity: sensor.temperature
    transformations:
      - type: unit_conversion
        conversion: "f_to_c"
        key: "celsius"
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"
    aggregations:
      moving_average:
        window: "5m"
        key: "avg_5m"
      recent_trend:
        samples: 10
        key: "trend"
```

### **Overlay Integration**
```yaml
overlays:
  # Raw temperature sparkline
  - type: sparkline
    source: temperature_enhanced

  # Celsius temperature sparkline
  - type: sparkline
    source: temperature_enhanced.transformations.celsius

  # Real-time text with multiple values
  - type: text
    content: |
      Temperature: {temperature_enhanced.transformations.celsius:.1f}°C
      Smoothed: {temperature_enhanced.transformations.smoothed:.1f}°C
      5min Avg: {temperature_enhanced.aggregations.avg_5m:.1f}°C
      Trend: {temperature_enhanced.aggregations.trend.direction}
```

### **Rules Engine Integration**
```yaml
rules:
  - id: temperature_alert
    when:
      any:
        - entity: temperature_enhanced.transformations.celsius
          above: 25  # 25°C
        - entity: temperature_enhanced.aggregations.avg_5m
          above: 23  # 23°C average
        - entity: temperature_enhanced.aggregations.trend.direction
          equals: "rising"
    apply:
      overlays:
        - id: temp_warning
          style:
            color: "var(--lcars-red)"
```

## 🔧 Available Transformations

### **Unit Conversions**
```yaml
transformations:
  # Temperature
  - type: unit_conversion
    conversion: "f_to_c"  # Fahrenheit to Celsius
    key: "celsius"

  - type: unit_conversion
    conversion: "c_to_f"  # Celsius to Fahrenheit
    key: "fahrenheit"

  # Power
  - type: unit_conversion
    conversion: "w_to_kw"  # Watts to Kilowatts
    key: "kilowatts"

  # Speed
  - type: unit_conversion
    conversion: "mph_to_kmh"  # Miles per hour to Kilometers per hour
    key: "kmh"
```

### **Scaling Transformations**
```yaml
transformations:
  # Linear scaling
  - type: scale
    method: "linear"
    input_range: [0, 100]
    output_range: [0, 1]
    key: "normalized"

  # Logarithmic scaling
  - type: scale
    method: "logarithmic"
    base: 10
    key: "log_scale"

  # Custom curve
  - type: scale
    method: "curve"
    curve_type: "exponential"
    exponent: 2
    key: "squared"
```

### **Smoothing Transformations**
```yaml
transformations:
  # Exponential smoothing
  - type: smooth
    method: "exponential"
    alpha: 0.3  # Smoothing factor (0-1)
    key: "smoothed"

  # Moving average
  - type: smooth
    method: "moving_average"
    window: 5  # Number of samples
    key: "avg_smoothed"

  # Median filter
  - type: smooth
    method: "median"
    window: 3
    key: "median_filtered"
```

### **Statistical Analysis**
```yaml
transformations:
  # Standard deviation
  - type: stats
    method: "std_dev"
    window: 20
    key: "variability"

  # Z-score (outlier detection)
  - type: stats
    method: "z_score"
    window: 50
    key: "anomaly_score"

  # Percentile ranking
  - type: stats
    method: "percentile"
    window: 100
    percentile: 95
    key: "p95"
```

## 📊 Available Aggregations

### **Moving Averages**
```yaml
aggregations:
  moving_average:
    window: "5m"  # Time window
    key: "avg_5m"

  sample_average:
    samples: 10  # Sample count
    key: "avg_10samples"
```

### **Statistical Tracking**
```yaml
aggregations:
  min_max:
    window: "1h"
    key: "hourly_stats"  # Returns {min, max, range}

  session_stats:
    reset_on_restart: true
    key: "session"  # Returns {min, max, avg, count}
```

### **Trend Analysis**
```yaml
aggregations:
  recent_trend:
    samples: 10
    key: "trend"  # Returns {direction, strength}

  rate_of_change:
    window: "2m"
    key: "velocity"  # Rate per second
```

### **Duration Tracking**
```yaml
aggregations:
  duration:
    condition: "above"
    threshold: 25
    key: "time_above_25"  # Time in seconds
```

## 🔍 Debug Commands

Access the enhanced system for debugging:

```javascript
// Access the enhanced DataSourceManager
const dsm = window.__msdDebug?.pipelineInstance?.systemsManager?.dataSourceManager;

// Get system status
console.log('Enhanced DataSource Status:', {
  totalSources: dsm.sources.size,
  enhancedSources: Array.from(dsm.sources.values()).filter(s =>
    s.transformations?.size > 0 || s.aggregations?.size > 0).length,
  totalTransformations: Array.from(dsm.sources.values()).reduce((sum, s) =>
    sum + (s.transformations?.size || 0), 0),
  totalAggregations: Array.from(dsm.sources.values()).reduce((sum, s) =>
    sum + (s.aggregations?.size || 0), 0)
});

// Test dot notation access
const celsiusEntity = dsm.getEntity('temperature_enhanced.transformations.celsius');
console.log('Celsius entity:', celsiusEntity?.state);

// Get historical data for sparklines
const celsiusHistory = celsiusEntity?.getHistoricalData?.(10);
console.log('Celsius history:', celsiusHistory?.length, 'points');

// Inspect source transformations
const source = dsm.getSource('temperature_enhanced');
console.log('Source debug:', source?.getDebugInfo());
```

## 🎊 Benefits

### **For Users**
- **Cleaner configurations** with intuitive dot notation
- **Rich data transformations** without external preprocessing
- **Real-time statistical analysis** built-in
- **Enhanced sparkline visualizations** with transformed data

### **For Developers**
- **Zero breaking changes** to existing code
- **Extensible transformation system** for custom processors
- **Consistent API** across all data access patterns
- **Automatic subscription management** for real-time updates

### **For System Performance**
- **Efficient caching** of transformed historical data
- **Optimized aggregation processing** with rolling calculations
- **Memory-efficient** rolling buffers for all data streams
- **Real-time updates** without polling overhead

## 🚀 Migration Guide

**Existing configurations work unchanged!** To add enhanced features:

1. **Add transformations** to your data source configurations
2. **Update overlay sources** to use dot notation paths
3. **Enhance rules** with aggregation-based conditions
4. **Test with debug commands** to verify functionality

The enhanced system maintains full backward compatibility while providing powerful new capabilities for advanced users.

---

*Enhanced DataSource System v1.0 - Fully implemented and operational*