I think you're absolutely right! Let's graduate to explicit-only data sources now. This aligns with the mature, production-ready direction of the MSD system.

## **First: Test Removal of Auto Data Sources**

Let's disable auto-creation and test:
```


Made changes.


```
Perfect! Now test this to ensure controls still work (they should use direct HASS) and no MSD overlays break due to missing data sources.

## **Home Assistant Data Sources & Enhancement Possibilities**

Regarding your question about HA's data capabilities:

### **What HA Provides:**
```javascript
// Raw historical data from HA
{
  "entity_id": "sensor.temperature",
  "state": "21.5",
  "attributes": {...},
  "last_changed": "2024-01-15T10:30:00Z",
  "last_updated": "2024-01-15T10:30:00Z"
}

// HA History API gives you arrays of state changes over time
[
  {"state": "20.1", "last_changed": "10:00:00"},
  {"state": "20.5", "last_changed": "10:15:00"},
  {"state": "21.5", "last_changed": "10:30:00"}
]
```

### **What We'd Need to Build:**
```javascript
// Enhanced DataSource with aggregations
class EntityDataSource {
  async getAggregation(type, window) {
    const history = await this.getHistory(window);
    switch(type) {
      case 'moving_average':
        return this._calculateMovingAverage(history, window);
      case 'daily_max':
        return Math.max(...history.map(h => parseFloat(h.state)));
      case 'state_duration':
        return this._calculateStateDuration(history);
    }
  }
}
```

**HA provides raw data; we'd implement the aggregation logic.**

## **Enhanced DataSources Proposal**

Based on our discussion, here's the architecture proposal:

### **Phase 1: Explicit-Only Foundation** ✅ (Current)
- Remove auto-creation
- Users must explicitly configure data sources
- Controls use direct HASS (working)

### **Phase 2: Enhanced DataSources** (Next)
```yaml
data_sources:
  desk_light:
    type: entity
    entity: light.desk
    # Basic entity monitoring (current capability)

  temperature_enhanced:
    type: entity
    entity: sensor.temperature
    # NEW: Aggregation capabilities
    aggregations:
      moving_average:
        window: "5m"
        samples: 10
      daily_stats:
        min: true
        max: true
        avg: true
      state_duration:
        states: ["on", "off"]
    # NEW: Data transformation
    transformations:
      - type: numeric_conversion
      - type: unit_conversion
        from: "°F"
        to: "°C"
    # NEW: Caching strategy
    cache:
      history_window: "24h"
      refresh_interval: "30s"
```

### **Phase 3: Advanced Features** (Future)
```yaml
data_sources:
  power_analysis:
    type: computed
    inputs: [sensor.power1, sensor.power2]
    formula: "inputs.power1 + inputs.power2"
    aggregations: [moving_average, peak_detection]

  weather_forecast:
    type: external
    url: "https://api.weather.com/..."
    refresh: "1h"
```

## **Benefits of This Approach:**

### **Immediate (Phase 1):**
- ✅ **Clean architecture** - No hidden magic
- ✅ **Explicit control** - Users know exactly what data sources exist
- ✅ **Performance** - No unnecessary subscriptions
- ✅ **Debugging** - Clear data flow

### **Future (Phase 2+):**
- 🚀 **Powerful aggregations** - Moving averages, min/max, state durations
- 🚀 **DRY principle** - Calculate once, consume many times
- 🚀 **Performance optimized** - Smart caching and refresh strategies
- 🚀 **Extensible** - Easy to add new aggregation types

## **Implementation Strategy:**

1. **Test explicit-only approach** (now)
2. **Document migration path** for existing auto-creation users
3. **Design enhanced DataSource API**
4. **Implement aggregation framework**
5. **Add caching and optimization**

This approach gives us a **solid foundation** for powerful data processing while maintaining **clarity and performance**. The explicit configuration requirement ensures users understand their data dependencies and can optimize accordingly.

**Test the auto-removal first, then we can design the enhanced DataSources framework!**