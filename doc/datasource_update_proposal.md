# Proposal: Enhanced DataSource System for MSD (Master Systems Display)

## Overview
This proposal consolidates requirements, architectural direction, and implementation patterns for upgrading the DataSource architecture for the LCARS MSD system in Home Assistant. The aim is to provide overlays and the rules engine with advanced, pre-processed data—going beyond raw Home Assistant entity values to support aggregations, chained transformations, and computed sources.

All design decisions, examples, and technical details discussed in this conversation are included to ensure a coding agent can implement the plan with minimal ambiguity.

---

## 1. Motivation & Goals
- **Enable overlays to consume pre-calculated data**: Averages, min/max, durations, trends, etc., calculated once and reused.
- **Support transformation pipelines**: Unit conversion, scaling, smoothing, custom JS calculations—configurable and stackable per source.
- **Allow computed sources**: Dynamic calculations on-the-fly, without needing new HA template entities. E.g., sum, difference, efficiency.
- **Integrate with overlays and the rules engine**: Aggregation/transformation access compatible with existing context and getEntity functions.
- **Maintain explicit configuration, clarity, and performance.**

---

## 2. Phase Breakdown & Features

### Phase 1: Aggregation Foundation
- Implement aggregation processors:
  - Moving averages (windowed)
  - Min/Max tracking
  - State duration (e.g., "on" time)
  - Rate-of-change/trend detection
- All aggregation results are accessible for overlays and rules engine via DataSourceManager.getEntity.
- Results are kept in memory/runtime only (no persistent DB writes).

### Phase 2: Transformation Pipeline
- Enable multiple chained transformations, e.g.:
  - Unit conversion (°F→°C, W→kW)
  - Range scaling
  - Smoothing (exponential, moving average)
  - Custom JavaScript expressions
- Each transformation is available for consumption by overlays/rules engine.

### Phase 3: Computed DataSources
- Support sources defined as JavaScript expressions or formulas combining multiple entities.
- Syntax matches rules engine (no Jinja; client-side JS only)
- Usable in overlays/rules without extra HA template helpers.

---

## 3. YAML Configuration Examples

```yaml
data_sources:
  temp_enhanced:
    type: entity
    entity: sensor.temp
    transformations:
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"
    aggregations:
      moving_average:
        window: "5m"
        key: "avg_5m"
      daily_stats:
        min: true
        max: true
        avg: true
        key: "stats"

  total_power:
    type: computed
    inputs:
      - sensor.power_living
      - sensor.power_kitchen
    expression: "inputs[0] + inputs[1]"
    aggregations:
      moving_average:
        window: "10m"
        key: "avg_10m"
```

---

## 4. Pseudocode: Core Implementation Patterns

### DataSourceManager.js
```js
class DataSourceManager {
  // ...existing...
  getEntity(entityId) {
    // Support dot notation for aggregation/transformation paths
    if (entityId.includes('.')) {
      const [sourceId, path] = entityId.split('.', 2);
      const source = this.sources.get(sourceId);
      if (source) {
        const currentData = source.getCurrentData();
        // Aggregation path
        if (path.startsWith('aggregations')) return resolvePath(currentData.aggregations, path);
        if (path.startsWith('transformations')) return resolvePath(currentData.transformations, path);
        // Default
        return { state: currentData.v?.toString(), attributes: { ...currentData.stats } };
      }
    }
    // ...fallback to HA entity lookup...
  }
}
```

### MsdDataSource.js
```js
class MsdDataSource {
  constructor(cfg, hass) {
    // ...existing...
    this.transformations = new Map();
    this.aggregations = new Map();
    this._initializeProcessors(cfg);
  }

  _initializeProcessors(cfg) {
    // Setup transformations
    (cfg.transformations || []).forEach((t, i) => {
      this.transformations.set(t.key || `transform${i}`, createTransformProcessor(t));
    });
    // Setup aggregations
    Object.entries(cfg.aggregations || {}).forEach(([type, config]) => {
      this.aggregations.set(config.key || type, createAggregationProcessor(type, config));
    });
  }
}
```

---

## 5. Rules Engine Integration
- Enhanced getEntity supports `source.aggregations.key` and `source.transformations.key` for conditions.
- All processors compatible with existing rules engine context and evaluation logic.
- Example:
```yaml
rules:
  - id: temp_alert
    when:
      all:
        - entity: temp_enhanced.aggregations.avg_5m
          above: 30
        - entity: temp_enhanced.transformations.celsius
          above: 25
    apply:
      overlays: [...]
```

---

## 6. Scope, Performance & Practicality
- All aggregation/computed results are memory/runtime only; no persistent DB writes.
- Aggregation windows should be kept to practical sizes (<=24h) to avoid excessive history loads.

---

## 7. Compatibility & Extensibility
- Fully backward compatible with current explicit-only data sources.
- Overlays and rules can consume raw, transformed, or aggregated values.
- Easy to add new aggregation/transformation types for future needs.

---

## 8. Next Steps
1. Implement aggregation processor classes in `src/msd/aggregations/`
2. Enhance `MsdDataSource` and `DataSourceManager` per pseudocode above
3. Update overlays (SparklineRenderer, etc.) and rules engine to consume enhanced data
4. Document configuration and API with clear examples

---

## 9. References & Context
- Attachment: Full conversation (see chat)
- Reference files: DataSourceManager.js, MsdDataSource.js, RulesEngine.js, compileConditions.js, SparklineRenderer.js, RollingBuffer.js
- Explicit design choices: JavaScript expressions only (no Jinja); all code modular and documented with JSDoc

---

## 10. Coding Agent Instructions
- Use only JavaScript (no Jinja)
- Implement all pseudocode and configuration patterns provided
- Preserve modular MSD architecture
- Ensure all new config keys are documented and parsed
- Favor extensibility, performance, and clarity
- Document all new functions with JSDoc
- Use anime.js v4 only for all animation logic

---


Great questions! Let me address each one and show how we can build on your existing rules engine infrastructure.Great questions! Looking at your existing rules engine code, I can see you've already built a solid evaluation framework. Let me address your key points and show how we can align with your existing architecture.

## Template Engine: JavaScript vs Jinja

You're absolutely right - Jinja templates are server-side HA processing. For client-side MSD datasources, we should use **JavaScript expressions** that align with your existing rules engine pattern:

```javascript
// Current rules engine pattern (from your compileConditions.js)
data_sources:
  total_power:
    type: computed
    inputs:
      - sensor.power_living_room
      - sensor.power_kitchen
    # JavaScript expression (similar to your rules engine)
    expression: "inputs[0] + inputs[1]"
    # OR more complex with context
    expression: |
      const livingRoom = inputs[0] || 0;
      const kitchen = inputs[1] || 0;
      return livingRoom + kitchen;
```

This aligns perfectly with your existing `evalCompiled` function pattern and gives us the flexibility we need!

## Enhanced Transformation Pipeline

Let's make transformations stackable and consumable by overlays:

```javascript
data_sources:
  temperature_enhanced:
    type: entity
    entity: sensor.temperature

    # Multiple transformations applied in order
    transformations:
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"  # Available as sourceData.transformations.celsius
      - type: scale
        input_range: [-10, 40]
        output_range: [0, 100]
        key: "percentage" # Available as sourceData.transformations.percentage
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"

    # Simple aggregations (runtime memory only)
    aggregations:
      moving_average:
        window: "5m"
        key: "avg_5m"  # Available as sourceData.aggregations.avg_5m
      daily_extremes:
        min: true
        max: true
        since_midnight: true  # Reset daily
        key: "daily_stats"
```

Then overlays can choose which data to consume:

```yaml
overlays:
  - type: sparkline
    source: temperature_enhanced
    data_key: "smoothed"  # Use the smoothed transformation

  - type: text
    source: temperature_enhanced
    content: "Current: {value:.1f}°C | Avg: {aggregations.avg_5m:.1f}°C"
```

## Aggregation Scope: Keep It Simple & Memory-Based

You're spot-on about keeping aggregations simple due to reload constraints. Let's focus on **runtime-only** aggregations:

```javascript
// Practical aggregation types for MSD
const PRACTICAL_AGGREGATIONS = {
  // Short-term (since page load)
  moving_average: { maxWindow: '1h' },
  min_max: { maxWindow: '1h' },
  rate_of_change: { maxWindow: '30m' },

  // Session-based (reset on reload)
  session_stats: {
    count: true,
    average: true,
    extremes: true
  },

  // Very short-term real-time
  recent_trend: {
    window: '5m',
    samples: 20
  }
};
```

## Integration with Your Rules Engine

Let's enhance your existing `getEntity` pattern to support datasource aggregations:

```javascript
// Enhanced DataSourceManager integration with RulesEngine
export class DataSourceManager {
  // ... existing code ...

  // NEW: Enhanced getEntity for rules engine compatibility
  getEntity(entityId) {
    // Check if it's a datasource reference first
    if (entityId.includes('.')) {
      const [sourceId, path] = entityId.split('.', 2);
      const source = this.sources.get(sourceId);

      if (source) {
        const currentData = source.getCurrentData();

        // Support dot notation: "temp_source.aggregations.avg_5m"
        if (path === 'aggregations' || path.startsWith('aggregations.')) {
          return this._resolveDataPath(currentData.aggregations, path);
        }

        if (path === 'transformations' || path.startsWith('transformations.')) {
          return this._resolveDataPath(currentData.transformations, path);
        }

        // Default to current value
        return {
          state: currentData.v?.toString() || 'unavailable',
          attributes: {
            timestamp: currentData.t,
            source_type: 'datasource',
            ...currentData.stats
          }
        };
      }
    }

    // Fallback to existing HA entity lookup
    const source = this.entityIndex.get(entityId);
    if (source) {
      const currentData = source.getCurrentData();
      return {
        state: currentData.v?.toString() || 'unavailable',
        attributes: {}
      };
    }

    // Final fallback to HASS states
    if (this.hass.states && this.hass.states[entityId]) {
      return this.hass.states[entityId];
    }

    return null;
  }

  _resolveDataPath(data, path) {
    const pathParts = path.split('.');
    let current = data;

    for (let i = 1; i < pathParts.length; i++) { // Skip first part (already resolved)
      if (current && typeof current === 'object') {
        current = current[pathParts[i]];
      } else {
        return null;
      }
    }

    return current ? {
      state: current.toString(),
      attributes: { data_path: path }
    } : null;
  }
}
```

## Enhanced MsdDataSource with Transformations

```javascript
export class MsdDataSource {
  constructor(cfg, hass) {
    // ... existing code ...

    // NEW: Transformation and aggregation processors
    this.transformations = new Map();
    this.aggregations = new Map();
    this._initializeProcessors(cfg);
  }

  _initializeProcessors(cfg) {
    // Initialize transformations
    if (cfg.transformations) {
      cfg.transformations.forEach((transform, index) => {
        const key = transform.key || `transform_${index}`;
        this.transformations.set(key, this._createTransformProcessor(transform));
      });
    }

    // Initialize aggregations
    if (cfg.aggregations) {
      Object.entries(cfg.aggregations).forEach(([type, config]) => {
        const key = config.key || type;
        this.aggregations.set(key, this._createAggregationProcessor(type, config));
      });
    }
  }

  _handleStateChange(eventData) {
    // ... existing buffer logic ...

    // NEW: Apply transformations
    const transformedData = this._applyTransformations(timestamp, value);

    // NEW: Update aggregations
    this._updateAggregations(timestamp, value, transformedData);

    // Enhanced emit data with transformations and aggregations
    const emitData = {
      t: timestamp,
      v: value,
      buffer: this.buffer,
      stats: { ...this._stats },
      transformations: this._getTransformationData(), // NEW
      aggregations: this._getAggregationData(),       // NEW
      entity: this.cfg.entity,
      historyReady: this._stats.historyLoaded > 0
    };

    this.subscribers.forEach(callback => callback(emitData));
  }

  _applyTransformations(timestamp, value) {
    const results = { original: value };

    this.transformations.forEach((processor, key) => {
      try {
        results[key] = processor.transform(value, timestamp, this.buffer);
      } catch (error) {
        console.warn(`[MsdDataSource] Transformation ${key} failed:`, error);
        results[key] = null;
      }
    });

    return results;
  }

  _createTransformProcessor(config) {
    switch (config.type) {
      case 'unit_conversion':
        return new UnitConversionProcessor(config);
      case 'scale':
        return new ScaleProcessor(config);
      case 'smooth':
        return new SmoothingProcessor(config);
      case 'expression':
        return new ExpressionProcessor(config); // JavaScript evaluation
      default:
        throw new Error(`Unknown transformation type: ${config.type}`);
    }
  }
}
```

## Rules Engine Enhancement for Datasource Support

Extend your existing rules engine to work with enhanced datasources:

```javascript
// Enhancement to your existing RulesEngine.js
export class RulesEngine {
  constructor(rules = [], dataSourceManager = null) {
    // ... existing code ...
    this.dataSourceManager = dataSourceManager;
  }

  // Enhanced entity extraction for datasource references
  extractEntityReferences(rule) {
    const entities = new Set();

    // ... existing entity extraction ...

    // NEW: Extract datasource references
    const conditions = [
      ...(rule.when.all || []),
      ...(rule.when.any || [])
    ];

    conditions.forEach(condition => {
      // Datasource aggregation reference: "temp_source.aggregations.avg_5m"
      if (condition.entity && condition.entity.includes('.') &&
          this.dataSourceManager?.getSource(condition.entity.split('.')[0])) {
        const sourceId = condition.entity.split('.')[0];
        entities.add(sourceId);
      }
    });

    return Array.from(entities);
  }

  // Enhanced evaluation context
  createEvaluationContext() {
    return {
      getEntity: (entityId) => {
        // Use enhanced datasource-aware getEntity
        if (this.dataSourceManager) {
          return this.dataSourceManager.getEntity(entityId);
        }

        // Fallback to HASS
        return this.hass?.states?.[entityId] || null;
      },
      // ... other context methods
    };
  }
}
```

## Example Usage in MSD Configuration

```yaml
data_sources:
  power_analysis:
    type: entity
    entity: sensor.power_meter
    transformations:
      - type: scale
        input_range: [0, 5000]
        output_range: [0, 100]
        key: "percentage"
      - type: unit_conversion
        factor: 0.001
        key: "kilowatts"
    aggregations:
      moving_average:
        window: "10m"
        key: "avg_10m"
      efficiency:
        type: expression
        expression: "value < 1000 ? 'efficient' : 'high'"
        key: "rating"

rules:
  - id: high_power_alert
    when:
      all:
        - entity: power_analysis.aggregations.avg_10m
          above: 80  # 80% of scaled range
        - entity: power_analysis.transformations.kilowatts
          above: 3.0
    apply:
      overlays:
        - id: power_display
          style:
            color: "var(--lcars-red)"
```

This approach:
- ✅ **Aligns with your rules engine** pattern
- ✅ **JavaScript expressions** instead of Jinja
- ✅ **Multiple transformations** available to overlays
- ✅ **Simple runtime aggregations** (no database)
- ✅ **Backward compatible** with existing entity references
- ✅ **Extensible** for future enhancement

What do you think about this approach? Should we start implementing the transformation processors first, or would you prefer to begin with the aggregation framework?