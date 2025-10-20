# 📊 Complete DataSource Enhancement Proposal - Final Version

## Executive Summary

Enhance the MSD DataSource system to support all ApexCharts data formats while maintaining existing features (chains, transformations, aggregations, expressions). Key additions: dynamic attribute access, array-based aggregations syntax, rolling statistics for range/OHLC/boxplot charts, and comprehensive metadata system.

---

## 🎯 Goals

1. **Support All ApexCharts Types** - Enable rangeArea, candlestick, boxPlot, bubble, and other multi-value formats
2. **Enhanced Entity Access** - Dynamic attribute access in expressions, nested paths, multi-entity support
3. **Metadata Integration** - Auto-configure charts from data source metadata
4. **Maintain Existing Features** - Keep chains, transformations, aggregations, expressions
5. **Backward Compatibility** - Smooth migration path for existing configs

---

## 📋 Current State Analysis

### **✅ What We Have**

| Feature | Status | File |
|---------|--------|------|
| Transformation chains | ✅ Full | `MsdDataSource.js` |
| Aggregations | ✅ Full | `AggregationProcessor.js` |
| Expression calculations | ✅ Full | `ExpressionProcessor.js` |
| Rolling buffers | ✅ Full | `RollingBuffer.js` |
| History preload | ✅ Full | `MsdDataSource.js` |
| Static attribute access | ⚠️ Partial | `MsdDataSource.js` |
| unit_of_measurement | ✅ Full | `MsdDataSource.js` |

### **❌ What's Missing**

| Feature | Impact | Priority |
|---------|--------|----------|
| Dynamic attribute access | High - Server monitoring, HVAC | 🔴 Critical |
| Array-based aggregations | High - Consistency | 🔴 Critical |
| Rolling statistics | High - Range charts | 🔴 Critical |
| Enum mapping | Medium - State charts | 🟡 Medium |
| Nested attribute paths | Medium - Forecasts | 🟡 Medium |
| Multi-entity sources | Medium - Calculations | 🟢 Future |
| Comprehensive metadata | Medium - Auto-config | 🟡 Medium |

---

## 🚀 Enhancement Phases

### **Phase 1: Aggregation Syntax Standardization** ⚙️

**Goal:** Consistent array-based syntax matching transformations

#### Current (Object-based):
```yaml
aggregations:
  daily_stats:              # Key
    type: min_max           # Type
    window: "24h"
    min: true
    max: true
```

#### Proposed (Array-based):
```yaml
aggregations:
  - type: min_max           # Type first (like transformations)
    key: daily_stats        # Key as property
    window: "24h"
    min: true
    max: true
```

**Migration Strategy:**
- Support both formats during transition (6 months)
- Log deprecation warnings for object format
- Auto-convert in config loader
- Update all documentation

**Implementation:**
```javascript
// In MsdDataSource._initializeProcessors()

if (cfg.aggregations) {
  let aggregationsArray;

  if (Array.isArray(cfg.aggregations)) {
    // ✅ New format
    aggregationsArray = cfg.aggregations;
  } else if (typeof cfg.aggregations === 'object') {
    // ⚠️ Old format - convert + warn
    cblcarsLog.warn(
      `[MsdDataSource] Aggregations object format is deprecated for ${this.cfg.entity}.\n` +
      `  Use array format: aggregations: [{ type: "min_max", key: "daily_stats" }]`
    );

    aggregationsArray = Object.entries(cfg.aggregations).map(([key, config]) => ({
      ...config,
      key: config.key || key,
      type: config.type
    }));
  }

  aggregationsArray.forEach((config) => {
    if (!config.type) {
      cblcarsLog.error(`[MsdDataSource] Aggregation missing 'type' property`);
      return;
    }

    const processor = createAggregationProcessor(config.type, config);
    this.aggregations.set(config.key, processor);
  });
}
```

**Files to Update:**
- `src/msd/data/MsdDataSource.js` - `_initializeProcessors()` method
- `src/msd/data/aggregations/index.js` - Update factory
- `doc/user/data-sources.md` - Update examples
- Migration guide document

**Effort:** 2-3 hours

---

### **Phase 2A: Enhanced Entity Access** 🔧

**Goal:** Full entity attribute access in expressions

#### **2A.1: Dynamic Attribute Access**

**Current Limitation:**
```yaml
# ❌ Can't access attributes in expressions
transformations:
  - type: expression
    key: temp_diff
    expression: "v - 72"  # Can only use raw value
```

**Enhanced:**
```yaml
# ✅ Can access entity attributes
transformations:
  - type: expression
    key: temp_diff
    expression: "entity.attributes.current_temperature - entity.attributes.target_temperature"

  - type: expression
    key: load_index
    expression: |
      (entity.attributes.cpu_usage * 0.5) +
      (entity.attributes.memory_usage * 0.3) +
      (entity.attributes.disk_usage * 0.2)
```

**Implementation:**

File: `src/msd/data/transformations/ExpressionProcessor.js`

```javascript
// ENHANCED: Add entity context to expression evaluation

transform(value, timestamp, buffer) {
  // Build enhanced context with entity access
  const context = {
    // Current value aliases
    v: value,
    value: value,

    // Timestamp aliases
    t: timestamp,
    timestamp: timestamp,

    // Buffer access
    buffer: buffer,

    // ✅ NEW: Full entity state and attributes
    entity: {
      state: value,
      attributes: this.dataSource?._lastOriginalState?.attributes || {},
      entity_id: this.dataSource?.cfg?.entity || 'unknown',
      last_changed: this.dataSource?._lastOriginalState?.last_changed || timestamp,
      last_updated: this.dataSource?._lastOriginalState?.last_updated || timestamp
    },

    // Access to other transformed values (for chaining)
    ...this.transformedData,

    // Math helpers
    Math: Math,
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil
  };

  try {
    return this._evaluateExpression(this.expression, context);
  } catch (error) {
    if (this.config.debug) {
      cblcarsLog.warn(`[ExpressionProcessor] Expression failed: ${error.message}`);
    }
    return null;
  }
}
```

File: `src/msd/data/MsdDataSource.js`

```javascript
// ENHANCED: Store original entity state for attribute access

_handleStateChange(eventData) {
  if (!eventData?.new_state || this._destroyed) {
    return;
  }

  // ✅ CRITICAL: Store the original state object before any conversion
  this._lastOriginalState = eventData.new_state;

  // ✅ ENHANCED: Capture unit_of_measurement
  if (eventData.new_state.attributes?.unit_of_measurement) {
    this.cfg.unit_of_measurement = eventData.new_state.attributes.unit_of_measurement;
  }

  // Extract value and process as normal
  const timestamp = Date.now();
  const rawValue = this.cfg.attribute
    ? eventData.new_state.attributes?.[this.cfg.attribute]
    : eventData.new_state.state;

  const value = this._toNumber(rawValue);

  if (value !== null) {
    // Store in buffer
    this.buffer.push(timestamp, value);

    // ✅ NEW: Pass dataSource reference to transformation processors
    const transformedData = this._applyTransformations(timestamp, value);
    this._updateAggregations(timestamp, value, transformedData);

    // Emit to subscribers
    this._emit({ /* ... */ });
  }
}

// ✅ NEW: Provide dataSource reference to transformation processors
_applyTransformations(timestamp, value) {
  const results = {};
  const executionOrder = this._determineTransformationOrder();

  executionOrder.forEach((key) => {
    const processor = this.transformations.get(key);

    // ✅ NEW: Set dataSource reference for entity access
    processor.dataSource = this;

    // Determine input value
    const inputSource = processor.config.input_source;
    const inputValue = inputSource ? results[inputSource] : value;

    if (!Number.isFinite(inputValue)) {
      results[key] = null;
      return;
    }

    // For expression processors, provide all transform results
    if (processor.constructor.name === 'ExpressionProcessor') {
      processor.transformedData = { ...results };
    }

    // Execute transformation
    const transformedValue = processor.transform(inputValue, timestamp, this.buffer);
    results[key] = transformedValue;

    // Cache in transformed buffer
    if (transformedValue !== null && Number.isFinite(transformedValue)) {
      const buffer = this.transformedBuffers.get(key);
      if (buffer) {
        buffer.push(timestamp, transformedValue);
      }
    }
  });

  return results;
}
```

**Files to Update:**
- `src/msd/data/transformations/ExpressionProcessor.js` - Enhanced context
- `src/msd/data/MsdDataSource.js` - Store `_lastOriginalState`, pass dataSource reference

**Effort:** 2 hours

---

#### **2A.2: String Enum Mapping**

**Goal:** Convert string states to numeric for charting

```yaml
data_sources:
  hvac_state:
    entity: climate.home

    # ✅ NEW: Map string states to numbers
    enum_mapping:
      "off": 0
      "heating": 1
      "cooling": 2
      "fan_only": 3
      "dry": 4
      "idle": 0
```

**Implementation:**

File: `src/msd/data/MsdDataSource.js`

```javascript
// ENHANCED: Support enum_mapping in _toNumber()

_toNumber(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }

  // Handle numeric values
  if (typeof raw === 'number') {
    return isNaN(raw) ? null : raw;
  }

  // Handle string values
  if (typeof raw === 'string') {
    // ✅ NEW: Check enum_mapping first
    if (this.cfg.enum_mapping && this.cfg.enum_mapping[raw] !== undefined) {
      const mappedValue = this.cfg.enum_mapping[raw];
      cblcarsLog.debug(`[MsdDataSource] Enum mapping: "${raw}" → ${mappedValue}`);
      return mappedValue;
    }

    // Try direct numeric conversion
    const num = parseFloat(raw);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }

    // Handle boolean-like strings
    const lowerRaw = raw.toLowerCase().trim();
    if (lowerRaw === 'on' || lowerRaw === 'true' || lowerRaw === 'active' || lowerRaw === 'open') {
      return 1;
    }

    if (lowerRaw === 'off' || lowerRaw === 'false' || lowerRaw === 'inactive' || lowerRaw === 'closed') {
      return 0;
    }

    // Unavailable/unknown states
    if (lowerRaw === 'unavailable' || lowerRaw === 'unknown') {
      return null;
    }

    return null;
  }

  // Handle boolean values
  if (typeof raw === 'boolean') {
    return raw ? 1 : 0;
  }

  return null;
}
```

**Use Case:**
```yaml
overlays:
  - id: hvac-state-chart
    type: apexchart
    source: "hvac_state"
    chart_type: line
    # Chart shows: 0=off, 1=heating, 2=cooling, 3=fan_only
```

**Files to Update:**
- `src/msd/data/MsdDataSource.js` - `_toNumber()` method

**Effort:** 1 hour

---

#### **2A.3: Nested Attribute Path Extraction**

**Goal:** Access nested/array attributes

```yaml
data_sources:
  weather_forecast:
    entity: weather.home

    # ✅ NEW: Extract nested attribute
    attribute_path: "forecast.0.temperature"
    # Or: "forecast[0].temperature"
    # Or: "device_info.manufacturer"
```

**Implementation:**

File: `src/msd/data/MsdDataSource.js`

```javascript
// ✅ NEW: Extract nested attribute value

_handleStateChange(eventData) {
  if (!eventData?.new_state || this._destroyed) {
    return;
  }

  this._lastOriginalState = eventData.new_state;

  const timestamp = Date.now();
  let rawValue;

  // ✅ NEW: Support attribute_path for nested access
  if (this.cfg.attribute_path) {
    rawValue = this._extractNestedAttribute(
      eventData.new_state.attributes,
      this.cfg.attribute_path
    );
  } else if (this.cfg.attribute) {
    rawValue = eventData.new_state.attributes?.[this.cfg.attribute];
  } else {
    rawValue = eventData.new_state.state;
  }

  const value = this._toNumber(rawValue);

  // ... rest of processing
}

/**
 * ✅ NEW: Extract nested attribute using dot/bracket notation
 * @private
 * @param {Object} attributes - Entity attributes object
 * @param {string} path - Attribute path (e.g., "forecast.0.temperature" or "forecast[0].temperature")
 * @returns {*} Extracted value or null
 */
_extractNestedAttribute(attributes, path) {
  if (!attributes || !path) return null;

  try {
    // Normalize path: convert bracket to dot notation
    // "forecast[0].temperature" → "forecast.0.temperature"
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    const parts = normalizedPath.split('.');

    let current = attributes;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return null;
      }

      // Handle array index
      if (!isNaN(part)) {
        const index = parseInt(part, 10);
        if (Array.isArray(current) && index >= 0 && index < current.length) {
          current = current[index];
        } else {
          return null;
        }
      }
      // Handle object property
      else if (typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }

    return current;
  } catch (error) {
    cblcarsLog.warn(`[MsdDataSource] Failed to extract nested attribute "${path}":`, error);
    return null;
  }
}
```

**Use Cases:**
```yaml
# Weather forecast
data_sources:
  today_high:
    entity: weather.home
    attribute_path: "forecast.0.temperature"

  tomorrow_high:
    entity: weather.home
    attribute_path: "forecast[1].temperature"

# Device info
data_sources:
  device_manufacturer:
    entity: sensor.my_device
    attribute_path: "device_info.manufacturer"
```

**Files to Update:**
- `src/msd/data/MsdDataSource.js` - Add `_extractNestedAttribute()`, update `_handleStateChange()`

**Effort:** 2 hours

---

### **Phase 2B: Rolling Statistics Aggregation** 📊

**Goal:** Support ApexCharts multi-value formats (rangeArea, boxPlot, candlestick)

#### **New Aggregation Type: rolling_statistics**

```yaml
data_sources:
  temperature:
    entity: sensor.outside_temp

    transformations:
      - type: unit_conversion
        conversion: f_to_c
        key: celsius

    aggregations:
      # ✅ NEW: Rolling statistics for range charts
      - type: rolling_statistics
        key: hourly_range
        input_source: celsius      # Chain from transformation
        window: "1h"                # Time window
        window_size: 20             # Or sample count
        stats: [min, max]           # Output: [min, max] for rangeArea

        metadata:
          friendly_name: "Hourly Temperature Range"
          unit_of_measurement: "°C"
          chart_type: "rangeArea"
          chart_color: "#ff9900"
```

**Supported Statistics:**

| Stat | Description | Use Case |
|------|-------------|----------|
| `min` | Minimum value | rangeArea, boxPlot |
| `max` | Maximum value | rangeArea, boxPlot |
| `mean` | Average value | General |
| `median` | Middle value | boxPlot |
| `q1` | First quartile (25%) | boxPlot |
| `q3` | Third quartile (75%) | boxPlot |
| `std` | Standard deviation | Statistical analysis |
| `open` | First value in window | candlestick |
| `close` | Last value in window | candlestick |

**Output Formats:**

```javascript
// rangeArea: [min, max]
stats: [min, max]
// Output: [22.5, 28.3]

// boxPlot: [min, q1, median, q3, max]
stats: [min, q1, median, q3, max]
// Output: [20, 23, 25, 27, 30]

// candlestick: [open, high, low, close]
stats: [open, max, min, close]
// Output: [24, 28, 22, 26]
```

**Implementation:**

File: `src/msd/data/aggregations/RollingStatisticsAggregation.js` (NEW)

```javascript
/**
 * @fileoverview Rolling Statistics Aggregation - Statistical calculations over sliding windows
 *
 * Supports ApexCharts multi-value formats:
 * - rangeArea: [min, max]
 * - boxPlot: [min, q1, median, q3, max]
 * - candlestick: [open, high, low, close]
 *
 * @module msd/data/aggregations/RollingStatisticsAggregation
 */

import { AggregationProcessor } from './AggregationProcessor.js';
import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';

/**
 * Rolling Statistics Aggregation
 * Calculates multiple statistics over a sliding window for range/distribution/OHLC data
 */
export class RollingStatisticsAggregation extends AggregationProcessor {
  constructor(config) {
    super('rolling_statistics', config);

    // Statistics to calculate
    this.stats = config.stats || ['min', 'max'];
    this.windowSize = config.window_size || 20;  // Sample count fallback

    // Validate stats
    const validStats = ['min', 'max', 'mean', 'median', 'q1', 'q3', 'std', 'open', 'close'];
    this.stats = this.stats.filter(s => {
      if (!validStats.includes(s)) {
        cblcarsLog.warn(`[RollingStatistics] Unknown stat "${s}", valid: ${validStats.join(', ')}`);
        return false;
      }
      return true;
    });

    if (this.stats.length === 0) {
      cblcarsLog.warn(`[RollingStatistics] No valid stats specified, defaulting to [min, max]`);
      this.stats = ['min', 'max'];
    }

    cblcarsLog.debug(
      `[RollingStatistics] Initialized with stats: [${this.stats.join(', ')}], ` +
      `window: ${this.windowMs ? this.windowMs + 'ms' : this.windowSize + ' samples'}`
    );
  }

  _calculate() {
    if (this._values.length === 0) {
      this._result = null;
      return;
    }

    // Get window values (limited by windowSize if no time window)
    let windowValues = this._values.map(item => item.value);

    if (!this.windowMs && this.windowSize && windowValues.length > this.windowSize) {
      windowValues = windowValues.slice(-this.windowSize);
    }

    if (windowValues.length === 0) {
      this._result = null;
      return;
    }

    // Calculate requested statistics
    const results = [];

    this.stats.forEach(stat => {
      let value;

      switch (stat) {
        case 'min':
          value = Math.min(...windowValues);
          break;

        case 'max':
          value = Math.max(...windowValues);
          break;

        case 'mean':
          value = windowValues.reduce((a, b) => a + b, 0) / windowValues.length;
          break;

        case 'median':
          value = this._calculateMedian(windowValues);
          break;

        case 'q1':
          value = this._calculateQuartile(windowValues, 0.25);
          break;

        case 'q3':
          value = this._calculateQuartile(windowValues, 0.75);
          break;

        case 'std':
          value = this._calculateStdDev(windowValues);
          break;

        case 'open':
          value = windowValues[0];  // First value in window
          break;

        case 'close':
          value = windowValues[windowValues.length - 1];  // Last value
          break;

        default:
          value = null;
      }

      results.push(value);
    });

    // Return single value if only one stat, otherwise array
    this._result = results.length === 1 ? results[0] : results;
    this._stats.calculations++;

    // Debug logging
    if (this.config.debug && this._stats.calculations % 10 === 0) {
      cblcarsLog.log(
        `[RollingStatistics ${this.key}] Window: ${windowValues.length} values, ` +
        `Result: ${Array.isArray(this._result) ? '[' + this._result.map(v => v.toFixed(2)).join(', ') + ']' : this._result.toFixed(2)}`
      );
    }
  }

  /**
   * Calculate median value
   * @private
   */
  _calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate quartile value
   * @private
   * @param {number} quartile - Quartile position (0.25 for Q1, 0.75 for Q3)
   */
  _calculateQuartile(values, quartile) {
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * quartile;
    const base = Math.floor(pos);
    const rest = pos - base;

    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  }

  /**
   * Calculate standard deviation
   * @private
   */
  _calculateStdDev(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}

export default RollingStatisticsAggregation;
```

File: `src/msd/data/aggregations/index.js` (UPDATE)

```javascript
import { RollingStatisticsAggregation } from './RollingStatisticsAggregation.js';

export function createAggregationProcessor(type, config) {
  switch (type) {
    case 'moving_average':
      return new MovingAverageAggregation(config);

    case 'min_max':
    case 'daily_stats':
      return new MinMaxAggregation(config);

    case 'rate_of_change':
      return new RateOfChangeAggregation(config);

    case 'session_stats':
      return new SessionStatsAggregation(config);

    case 'duration':
      return new DurationAggregation(config);

    case 'recent_trend':
      return new RecentTrendAggregation(config);

    // ✅ NEW: Rolling statistics
    case 'rolling_statistics':
      return new RollingStatisticsAggregation(config);

    default:
      throw new Error(`Unknown aggregation type: ${type}`);
  }
}
```

**Files to Create/Update:**
- `src/msd/data/aggregations/RollingStatisticsAggregation.js` - NEW file
- `src/msd/data/aggregations/index.js` - Add to factory

**Effort:** 3-4 hours

---

### **Phase 2C: Metadata System** 📋

**Goal:** Auto-configure charts from data source metadata

#### **Multi-Level Metadata**

```yaml
data_sources:
  temperature:
    entity: sensor.outside_temp

    # ✅ NEW: DataSource-level metadata
    metadata:
      friendly_name: "Living Room Temperature"
      unit_of_measurement: "°F"
      chart_color: "#ff6600"
      chart_type: "line"
      icon: "mdi:thermometer"
      decimal_precision: 1

    transformations:
      - type: unit_conversion
        conversion: f_to_c
        key: celsius
        # ✅ NEW: Transformation-level metadata
        metadata:
          friendly_name: "Temperature (Celsius)"
          unit_of_measurement: "°C"
          chart_color: "#0066ff"

    aggregations:
      - type: rolling_statistics
        key: temp_range
        input_source: celsius
        window: "1h"
        stats: [min, max]
        # ✅ NEW: Aggregation-level metadata
        metadata:
          friendly_name: "Temperature Range (1h)"
          unit_of_measurement: "°C"
          chart_type: "rangeArea"
          chart_color: "#ff9900"
          fill_opacity: 0.3
```

**Metadata Propagation:**

```
DataSource metadata
    ↓ (inherited)
Transformation metadata (overrides)
    ↓ (inherited)
Aggregation metadata (overrides)
    ↓ (used by)
ApexChart overlay (auto-configured)
```

**Implementation:**

File: `src/msd/data/MsdDataSource.js`

```javascript
// ENHANCED: Store and propagate metadata

_initializeProcessors(cfg) {
  // Store data source metadata
  this.metadata = cfg.metadata || {};

  // Initialize transformations with metadata
  if (cfg.transformations && Array.isArray(cfg.transformations)) {
    cfg.transformations.forEach((transformConfig, index) => {
      // ... create processor ...

      // ✅ NEW: Store metadata on processor (inherits from data source)
      processor.metadata = {
        ...this.metadata,  // Inherit from data source
        ...transformConfig.metadata  // Override with specific metadata
      };

      this.transformations.set(key, processor);
    });
  }

  // Initialize aggregations with metadata
  if (cfg.aggregations) {
    // ... process aggregations ...

    aggregationsArray.forEach((config) => {
      const processor = createAggregationProcessor(config.type, config);

      // ✅ NEW: Store metadata on processor (inherits from transforms if chained)
      const inheritedMetadata = config.input_source
        ? this.transformations.get(config.input_source)?.metadata || {}
        : this.metadata;

      processor.metadata = {
        ...inheritedMetadata,  // Inherit
        ...config.metadata      // Override
      };

      this.aggregations.set(config.key, processor);
    });
  }
}

// ENHANCED: Include metadata in data emissions

getCurrentData() {
  const lastPoint = this.buffer.last();

  return {
    t: lastPoint?.t || null,
    v: lastPoint?.v || null,
    buffer: this.buffer,
    stats: { ...this._stats },
    transformations: this._getTransformationData(),
    aggregations: this._getAggregationData(),
    // ✅ NEW: Include metadata
    metadata: this.metadata,
    transformationMetadata: this._getTransformationMetadata(),
    aggregationMetadata: this._getAggregationMetadata(),
    entity: this.cfg.entity,
    unit_of_measurement: this.cfg.unit_of_measurement,
    historyReady: this._stats.historyLoaded > 0
  };
}

/**
 * ✅ NEW: Get transformation metadata
 * @private
 */
_getTransformationMetadata() {
  const metadata = {};
  this.transformations.forEach((processor, key) => {
    metadata[key] = {
      type: processor.constructor.name,
      ...processor.metadata
    };
  });
  return metadata;
}

/**
 * ✅ NEW: Get aggregation metadata
 * @private
 */
_getAggregationMetadata() {
  const metadata = {};
  this.aggregations.forEach((processor, key) => {
    metadata[key] = {
      type: processor.type,
      ...processor.metadata
    };
  });
  return metadata;
}
```

**Chart Integration:**

File: `src/msd/charts/ApexChartsAdapter.js`

```javascript
// ENHANCED: Auto-configure from metadata

createChartConfig(overlay, dataSourceData) {
  // ✅ NEW: Extract metadata from data source
  const metadata = this._extractMetadata(overlay, dataSourceData);

  // Apply metadata to chart configuration
  const config = {
    chart: {
      type: metadata.chart_type || overlay.chart_type || 'line',
      // ... other options ...
    },
    colors: [metadata.chart_color || overlay.style?.chart_color || '#ff6600'],
    series: [{
      name: metadata.friendly_name || overlay.id,
      data: this._formatSeriesData(dataSourceData)
    }],
    yaxis: {
      title: {
        text: metadata.unit_of_measurement || ''
      },
      decimalsInFloat: metadata.decimal_precision || 2
    },
    // ... rest of config ...
  };

  return config;
}

/**
 * ✅ NEW: Extract metadata from data source path
 * @private
 */
_extractMetadata(overlay, dataSourceData) {
  // Parse source path: "temperature.aggregations.temp_range"
  const sourcePath = overlay.source || overlay.data_source;
  const parts = sourcePath.split('.');

  let metadata = dataSourceData.metadata || {};

  // Check for transformation metadata
  if (parts[1] === 'transformations' && parts[2]) {
    const transformKey = parts[2];
    metadata = {
      ...metadata,
      ...(dataSourceData.transformationMetadata?.[transformKey] || {})
    };
  }

  // Check for aggregation metadata
  if (parts[1] === 'aggregations' && parts[2]) {
    const aggKey = parts[2];
    metadata = {
      ...metadata,
      ...(dataSourceData.aggregationMetadata?.[aggKey] || {})
    };
  }

  return metadata;
}
```

**Files to Update:**
- `src/msd/data/MsdDataSource.js` - Store/propagate metadata, add getter methods
- `src/msd/charts/ApexChartsAdapter.js` - Extract and apply metadata

**Effort:** 2-3 hours

---

## 📊 Complete Usage Examples

### **Example 1: Server Monitoring with Dynamic Attributes**

```yaml
data_sources:
  server_metrics:
    entity: sensor.my_server

    metadata:
      friendly_name: "Server Health"
      icon: "mdi:server"

    transformations:
      # Calculate load index from multiple attributes
      - type: expression
        key: load_index
        expression: |
          (entity.attributes.cpu_usage * 0.5) +
          (entity.attributes.memory_usage * 0.3) +
          (entity.attributes.disk_usage * 0.2)
        metadata:
          friendly_name: "Server Load Index"
          unit_of_measurement: "%"
          chart_color: "#ff6600"

      # Temperature efficiency
      - type: expression
        key: temp_efficiency
        expression: |
          entity.attributes.cpu_temperature /
          entity.attributes.cpu_usage
        metadata:
          friendly_name: "Thermal Efficiency"
          unit_of_measurement: "°C/%"

overlays:
  - id: server-load-chart
    type: apexchart
    source: "server_metrics.transformations.load_index"
    # Auto-configured: name="Server Load Index", color=#ff6600, unit="%"
```

### **Example 2: Temperature Range Chart**

```yaml
data_sources:
  temperature:
    entity: sensor.outside_temp

    transformations:
      - type: unit_conversion
        conversion: f_to_c
        key: celsius
        metadata:
          unit_of_measurement: "°C"

    aggregations:
      - type: rolling_statistics
        key: hourly_range
        input_source: celsius
        window: "1h"
        stats: [min, max]  # Output: [min, max] for rangeArea
        metadata:
          friendly_name: "Hourly Temperature Range"
          chart_type: "rangeArea"
          chart_color: "#ff9900"
          fill_opacity: 0.3

overlays:
  - id: temp-range
    type: apexchart
    source: "temperature.aggregations.hourly_range"
    # Auto-configured:
    # - chart_type: rangeArea
    # - series name: "Hourly Temperature Range"
    # - color: #ff9900
```

### **Example 3: HVAC State Tracking**

```yaml
data_sources:
  hvac:
    entity: climate.home

    # Map string states to numbers
    enum_mapping:
      "off": 0
      "heating": 1
      "cooling": 2
      "fan_only": 3
      "idle": 0

    metadata:
      friendly_name: "HVAC Mode"

    transformations:
      # Calculate efficiency from attributes
      - type: expression
        key: efficiency
        expression: |
          abs(entity.attributes.target_temperature -
              entity.attributes.current_temperature) / 10
        metadata:
          friendly_name: "HVAC Efficiency"
          unit_of_measurement: "efficiency"

overlays:
  - id: hvac-state
    type: apexchart
    source: "hvac"
    chart_type: line
    # Shows: 0=off, 1=heating, 2=cooling, 3=fan_only
```

### **Example 4: Stock Price Candlestick**

```yaml
data_sources:
  stock_price:
    entity: sensor.stock_aapl

    aggregations:
      - type: rolling_statistics
        key: price_candles
        window: "15min"
        stats: [open, max, min, close]  # OHLC format
        metadata:
          friendly_name: "AAPL 15min Candles"
          chart_type: "candlestick"
          unit_of_measurement: "USD"

overlays:
  - id: stock-chart
    type: apexchart
    source: "stock_price.aggregations.price_candles"
    # Auto-configured: chart_type=candlestick, data=[open,high,low,close]
```

### **Example 5: Weather Forecast (Nested Attributes)**

```yaml
data_sources:
  forecast_today:
    entity: weather.home
    attribute_path: "forecast.0.temperature"
    metadata:
      friendly_name: "Today's Forecast High"
      unit_of_measurement: "°F"

  forecast_tomorrow:
    entity: weather.home
    attribute_path: "forecast[1].temperature"
    metadata:
      friendly_name: "Tomorrow's Forecast High"
      unit_of_measurement: "°F"
```

### **Example 6: Distribution BoxPlot**

```yaml
data_sources:
  api_latency:
    entity: sensor.api_response_time

    aggregations:
      - type: rolling_statistics
        key: latency_distribution
        window_size: 100  # Last 100 samples
        stats: [min, q1, median, q3, max]  # BoxPlot format
        metadata:
          friendly_name: "API Latency Distribution"
          chart_type: "boxPlot"
          unit_of_measurement: "ms"

overlays:
  - id: latency-box
    type: apexchart
    source: "api_latency.aggregations.latency_distribution"
    # Auto-configured: chart_type=boxPlot, data=[min,q1,median,q3,max]
```

---

## 🗂️ File Changes Summary

| File | Type | Changes | Effort |
|------|------|---------|--------|
| **MsdDataSource.js** | UPDATE | Array aggregations, attribute access, enum mapping, nested paths, metadata | 4-5h |
| **ExpressionProcessor.js** | UPDATE | Enhanced context with entity attributes | 1h |
| **RollingStatisticsAggregation.js** | NEW | Rolling statistics for multi-value formats | 3h |
| **aggregations/index.js** | UPDATE | Add rolling_statistics to factory | 15min |
| **ApexChartsAdapter.js** | UPDATE | Metadata extraction and application | 2h |
| **ChartDataValidator.js** | UPDATE | Validate multi-value formats | 1h |
| **doc/user/data-sources.md** | UPDATE | All new features and examples | 2h |
| **Migration guide** | NEW | Migration path for aggregations syntax | 1h |

**Total Estimated Effort:** 14-16 hours

---

## 📅 Implementation Timeline

### **Sprint 1: Foundation** (Week 1)
- ✅ Aggregation syntax standardization (Phase 1)
- ✅ Dynamic attribute access (Phase 2A.1)
- ✅ Enum mapping (Phase 2A.2)
- **Deliverable:** Enhanced expressions with entity access

### **Sprint 2: Advanced Features** (Week 2)
- ✅ Nested attribute paths (Phase 2A.3)
- ✅ Rolling statistics aggregation (Phase 2B)
- **Deliverable:** Support for rangeArea, boxPlot, candlestick

### **Sprint 3: Polish & Integration** (Week 3)
- ✅ Metadata system (Phase 2C)
- ✅ ApexCharts integration
- ✅ Validation updates
- ✅ Documentation
- **Deliverable:** Complete feature set with docs

---

## 🧪 Testing Strategy

### **Unit Tests**
- `RollingStatisticsAggregation` - All stat calculations
- `_extractNestedAttribute()` - Various path formats
- `_toNumber()` with enum_mapping - All cases
- Metadata propagation - Inheritance chain

### **Integration Tests**
- Expression with entity attributes
- Chained transform → aggregation with metadata
- ApexCharts auto-configuration from metadata
- Historical data processing through rolling stats

### **Real-World Tests**
- Server monitoring dashboard
- Temperature range chart
- HVAC state tracking
- Stock candlestick chart
- Weather forecast display

---

## 📖 Documentation Updates

### **Files to Create/Update:**

1. **Migration Guide** (`doc/migrations/aggregations-v2.md`)
   - Old vs new syntax
   - Automatic conversion script
   - Timeline and deprecation notice

2. **Data Sources Guide** (`doc/user/data-sources.md`)
   - Enhanced entity access section
   - Enum mapping examples
   - Nested attributes guide
   - Rolling statistics reference

3. **ApexCharts Guide** (`doc/user/apexcharts.md`)
   - Multi-value chart types
   - Metadata system
   - Auto-configuration examples

4. **API Reference** (`doc/api/data-sources.md`)
   - New config options
   - Metadata schema
   - Expression context reference

---

## 🚀 Ready to Start Implementation

**Proposed Start: Sprint 1 - Foundation**

Shall I begin with:
1. **Phase 1:** Aggregation syntax standardization?
2. **Phase 2A.1:** Dynamic attribute access in expressions?

Both are foundational and can be developed in parallel. Let me know which you'd like to tackle first! 🎯