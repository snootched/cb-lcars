# 📋 DataSource Enhancement: Phase 2 Completion Plan

**Project:** CB-LCARS MSD DataSource System
**Version:** Phase 2 Completion (Final 3 Features + Charts)
**Status:** Implementation Ready
**Estimated Time:** 12-17 hours
**Created:** 2025-10-21
**Author:** Copilot Assistant for @snootched

---

## 🎯 Executive Summary

This document outlines the completion of Phase 2 DataSource enhancements for the CB-LCARS MSD system. The plan includes four critical features that will provide production-ready DataSource capabilities with full ApexCharts support.

### **What's Already Complete:**
- ✅ Phase 1: Aggregation Syntax Standardization
- ✅ Phase 2A.1: Dynamic Attribute Access
- ✅ Phase 2A.2: String Enum Mapping
- ✅ Phase 2A.2b: Periodic Updates & Text Overlay Subscriptions

### **This Plan Covers:**
1. **Phase 2B:** Rolling Statistics Aggregation (3-4 hours)
2. **Phase 2C:** Metadata System (2-3 hours)
3. **Phase 2A.3:** Nested Attribute Paths (2 hours)
4. **Phase 3A:** ApexCharts Deep Integration (5-8 hours)

**Total Implementation Time:** 12-17 hours

---

## 📊 Implementation Priority Order

Execute in this order for maximum value and minimal rework:

1. **Phase 2B** - Rolling Statistics (foundation for charts)
2. **Phase 2C** - Metadata System (enhances all features)
3. **Phase 2A.3** - Nested Attribute Paths (weather data)
4. **Phase 3A** - ApexCharts Integration (uses all above features)

---

## 🎯 Phase 2B: Rolling Statistics Aggregation

**Priority:** 🔴 Critical
**Estimated Time:** 3-4 hours
**Complexity:** Medium-High

### **Objective**

Create a new aggregation type that outputs arrays of values for multi-value chart types (rangeArea, boxPlot, candlestick, bubble).

### **What It Enables**

```yaml
data_sources:
  temperature:
    entity: sensor.outdoor_temp

    aggregations:
      # Multi-value output for rangeArea charts
      - type: rolling_statistics
        key: temp_range
        window: "1h"
        stats: [min, max]
        # Output: [22.5, 28.3]

      # Full statistical distribution for boxPlot
      - type: rolling_statistics
        key: temp_distribution
        window: "24h"
        stats: [min, q1, median, q3, max]
        # Output: [15.2, 18.7, 22.1, 25.8, 30.4]

      # OHLC for candlestick charts
      - type: rolling_statistics
        key: temp_ohlc
        window: "1h"
        stats: [open, high, low, close]
        # Output: [20.5, 25.3, 18.2, 23.1]

overlays:
  - type: apexchart
    source: "temperature.aggregations.temp_range"
    chart_type: rangeArea  # ✅ Now fully supported
```

### **Implementation Tasks**

#### **Task 1: Create RollingStatisticsAggregation Class**

**File:** `src/msd/data/aggregations/RollingStatisticsAggregation.js` (NEW)

**Implementation:**

```javascript
import { AggregationProcessor } from './AggregationProcessor.js';
import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';

/**
 * Rolling Statistics Aggregation
 *
 * Calculates multiple statistics over a rolling time window and outputs
 * them as arrays for multi-value chart types (rangeArea, boxPlot, candlestick).
 *
 * Supported statistics:
 * - min, max: Range values
 * - mean, median: Central tendency
 * - q1, q3: Quartiles for box plots
 * - std_dev, variance: Spread measures
 * - open, close: First/last values for candlestick
 * - high, low: Extremes (aliases for min/max)
 *
 * @extends AggregationProcessor
 */
export class RollingStatisticsAggregation extends AggregationProcessor {
  constructor(config) {
    super(config);

    this.type = 'rolling_statistics';
    this.window = this._parseTimeWindow(config.window || '1h');
    this.stats = config.stats || ['min', 'max']; // Default to range

    // Validate stats array
    if (!Array.isArray(this.stats) || this.stats.length === 0) {
      throw new Error('rolling_statistics requires "stats" array with at least one statistic');
    }

    // Validate stat names
    const validStats = ['min', 'max', 'mean', 'median', 'q1', 'q3',
                        'std_dev', 'variance', 'open', 'close', 'high', 'low'];
    const invalidStats = this.stats.filter(s => !validStats.includes(s));
    if (invalidStats.length > 0) {
      throw new Error(`Invalid statistics: ${invalidStats.join(', ')}. Valid: ${validStats.join(', ')}`);
    }

    // Output format: 'array' (default) or 'object'
    this.outputFormat = config.output_format || config.outputFormat || 'array';

    // Rolling window of values
    this._values = [];

    // Result (array or object)
    this._result = null;
  }

  /**
   * Update aggregation with new value
   * @param {number} timestamp - Current timestamp
   * @param {number} value - New value
   * @param {Object} transformedData - Transformed values (for input_source support)
   */
  update(timestamp, value, transformedData = {}) {
    if (!this.enabled || !Number.isFinite(value)) return;

    // Handle input_source (chaining from transformations)
    let inputValue = value;
    if (this.config.input_source && transformedData[this.config.input_source] !== undefined) {
      inputValue = transformedData[this.config.input_source];
      if (!Number.isFinite(inputValue)) return;
    }

    // Add to rolling window
    this._values.push({
      timestamp,
      value: inputValue
    });

    // Remove old values outside window
    const cutoff = timestamp - this.window;
    this._values = this._values.filter(v => v.timestamp >= cutoff);

    // Recalculate statistics
    this._calculate();
  }

  /**
   * Calculate statistics from current window
   * @private
   */
  _calculate() {
    if (this._values.length === 0) {
      this._result = this.outputFormat === 'array'
        ? new Array(this.stats.length).fill(null)
        : this._createEmptyObject();
      return;
    }

    // Extract numeric values sorted for percentile calculations
    const values = this._values.map(v => v.value).sort((a, b) => a - b);
    const n = values.length;

    // Calculate each requested statistic
    const results = {};

    this.stats.forEach(stat => {
      switch (stat) {
        case 'min':
        case 'low':
          results[stat] = values[0];
          break;

        case 'max':
        case 'high':
          results[stat] = values[n - 1];
          break;

        case 'mean':
          results[stat] = this._calculateMean(values);
          break;

        case 'median':
          results[stat] = this._calculatePercentile(values, 0.5);
          break;

        case 'q1':
          results[stat] = this._calculatePercentile(values, 0.25);
          break;

        case 'q3':
          results[stat] = this._calculatePercentile(values, 0.75);
          break;

        case 'std_dev':
          results[stat] = this._calculateStdDev(values);
          break;

        case 'variance':
          results[stat] = this._calculateVariance(values);
          break;

        case 'open':
          // First value in window (chronologically)
          results[stat] = this._values[0].value;
          break;

        case 'close':
          // Last value in window (chronologically)
          results[stat] = this._values[this._values.length - 1].value;
          break;

        default:
          results[stat] = null;
      }
    });

    // Format output
    if (this.outputFormat === 'array') {
      this._result = this.stats.map(stat => results[stat]);
    } else {
      this._result = results;
    }

    this._stats.calculations++;
  }

  /**
   * Get current aggregation result
   * @returns {Array|Object|null} Array of statistics or object with named values
   */
  getValue() {
    return this._result;
  }

  /**
   * Calculate mean of values
   * @private
   */
  _calculateMean(values) {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate percentile using linear interpolation
   * @private
   */
  _calculatePercentile(sortedValues, percentile) {
    const index = (sortedValues.length - 1) * percentile;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Calculate variance
   * @private
   */
  _calculateVariance(values) {
    const mean = this._calculateMean(values);
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  /**
   * Calculate standard deviation
   * @private
   */
  _calculateStdDev(values) {
    return Math.sqrt(this._calculateVariance(values));
  }

  /**
   * Create empty result object with null values
   * @private
   */
  _createEmptyObject() {
    const obj = {};
    this.stats.forEach(stat => {
      obj[stat] = null;
    });
    return obj;
  }

  /**
   * Parse time window string to milliseconds
   * @private
   */
  _parseTimeWindow(windowStr) {
    if (typeof windowStr === 'number') return windowStr;

    const match = windowStr.match(/^(\d+(?:\.\d+)?)\s*(s|sec|m|min|h|hr|d|day)s?$/i);
    if (!match) {
      throw new Error(`Invalid time window format: ${windowStr}`);
    }

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 's':
      case 'sec':
        return value * 1000;
      case 'm':
      case 'min':
        return value * 60 * 1000;
      case 'h':
      case 'hr':
        return value * 60 * 60 * 1000;
      case 'd':
      case 'day':
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Unknown time unit: ${unit}`);
    }
  }

  /**
   * Get statistics about aggregation
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this._stats,
      type: this.type,
      window: this.window,
      stats: this.stats,
      outputFormat: this.outputFormat,
      currentSamples: this._values.length
    };
  }
}
```

#### **Task 2: Register New Aggregation Type**

**File:** `src/msd/data/aggregations/index.js`

**Add to imports:**

```javascript
import { RollingStatisticsAggregation } from './RollingStatisticsAggregation.js';
```

**Add to factory function:**

```javascript
export function createAggregationProcessor(type, config) {
  if (!config || typeof config !== 'object') {
    throw new Error(`Invalid aggregation config: must be an object`);
  }

  if (!config.key) {
    throw new Error(`Aggregation config missing required "key" property`);
  }

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
    case 'rolling_stats':
      return new RollingStatisticsAggregation(config);

    default:
      throw new Error(
        `Unknown aggregation type: ${type}\n` +
        `  Valid types: moving_average, min_max, rate_of_change, session_stats, duration, recent_trend, rolling_statistics`
      );
  }
}
```

#### **Task 3: Add Export**

**File:** `src/msd/data/aggregations/index.js`

**Add to exports:**

```javascript
export {
  AggregationProcessor,
  MovingAverageAggregation,
  MinMaxAggregation,
  RateOfChangeAggregation,
  SessionStatsAggregation,
  DurationAggregation,
  RecentTrendAggregation,
  RollingStatisticsAggregation,  // ✅ NEW
  createAggregationProcessor
};
```

### **Testing Configuration**

```yaml
data_sources:
  # Test 1: Basic range (min/max)
  temp_range:
    entity: sensor.outdoor_temp
    aggregations:
      - type: rolling_statistics
        key: hourly_range
        window: "1h"
        stats: [min, max]
        output_format: array  # Output: [22.5, 28.3]

  # Test 2: Box plot distribution
  temp_distribution:
    entity: sensor.outdoor_temp
    aggregations:
      - type: rolling_statistics
        key: daily_distribution
        window: "24h"
        stats: [min, q1, median, q3, max]
        output_format: array  # Output: [15.2, 18.7, 22.1, 25.8, 30.4]

  # Test 3: Candlestick OHLC
  power_ohlc:
    entity: sensor.power_meter
    aggregations:
      - type: rolling_statistics
        key: hourly_ohlc
        window: "1h"
        stats: [open, high, low, close]
        output_format: array  # Output: [1250, 1580, 1120, 1450]

  # Test 4: Object format with names
  temp_stats:
    entity: sensor.outdoor_temp
    aggregations:
      - type: rolling_statistics
        key: stats_named
        window: "1h"
        stats: [min, max, mean, std_dev]
        output_format: object
        # Output: {min: 22.5, max: 28.3, mean: 25.1, std_dev: 1.8}

overlays:
  # Use with ApexCharts rangeArea
  - type: apexchart
    id: temp-range-chart
    source: "temp_range.aggregations.hourly_range"
    chart_type: rangeArea
    position: [100, 100]
    size: [600, 300]
```

### **Browser Console Testing**

```javascript
// Test rolling statistics
const ds = __msdDebug.pipelineInstance.systemsManager.dataSourceManager.getSource('temp_range');
const data = ds.getCurrentData();

console.log('Rolling stats result:', data.aggregations.hourly_range);
// Expected: [22.5, 28.3] (array of [min, max])

// Check aggregation processor
const agg = ds.aggregations.get('hourly_range');
console.log('Aggregation type:', agg.type);
console.log('Stats calculated:', agg.stats);
console.log('Window size:', agg.window);
console.log('Current samples:', agg._values.length);
console.log('Stats:', agg.getStats());
```

### **Validation Checklist**

- [ ] `RollingStatisticsAggregation.js` created with all methods
- [ ] Aggregation registered in factory function
- [ ] Export added to index.js
- [ ] Array output format works: `[min, max]`
- [ ] Object output format works: `{min: 22.5, max: 28.3}`
- [ ] All stat types calculate correctly (min, max, mean, median, q1, q3, std_dev, variance, open, close)
- [ ] Time window parsing works ("1h", "24h", "7d")
- [ ] Old values are removed from rolling window
- [ ] `input_source` support works (chaining from transformations)
- [ ] Multiple rolling stats can run simultaneously
- [ ] Error handling for invalid stats names
- [ ] Error handling for invalid window formats

---

## 📊 Phase 2C: Metadata System

**Priority:** 🟡 High
**Estimated Time:** 2-3 hours
**Complexity:** Medium

### **Objective**

Auto-capture entity metadata from Home Assistant (unit of measurement, device info, area, etc.) and make it available to overlays for smart formatting and display.

### **What It Enables**

```yaml
data_sources:
  temperature:
    entity: sensor.outdoor_temp
    # Automatically captures:
    # - unit_of_measurement: "°F"
    # - device_class: "temperature"
    # - friendly_name: "Outdoor Temperature"
    # - area: "Garden"
    # - device_info: {...}

overlays:
  - type: text
    text: "{temperature.v:.1f}"
    # Auto-formats to: "72.5°F" (includes unit)

  - type: apexchart
    source: "temperature"
    # Auto-labels axis with unit
    # Auto-sets appropriate decimal places
```

### **Implementation Tasks**

#### **Task 1: Enhance MsdDataSource to Capture Metadata**

**File:** `src/msd/data/MsdDataSource.js`

**Add to constructor (around line 30):**

```javascript
constructor(cfg, hass) {
  this.cfg = { ...cfg };
  this.hass = hass;

  // ... existing constructor code ...

  // ✅ NEW: Entity metadata storage
  this.metadata = {
    unit_of_measurement: null,
    device_class: null,
    friendly_name: null,
    area: null,
    device_id: null,
    entity_id: this.cfg.entity,
    state_class: null,
    icon: null,
    // Additional metadata
    last_changed: null,
    last_updated: null
  };
}
```

**Add method to extract metadata (after constructor):**

```javascript
/**
 * Extract and store entity metadata from Home Assistant state
 * @private
 * @param {Object} entityState - Home Assistant entity state object
 */
_extractMetadata(entityState) {
  if (!entityState) return;

  const attributes = entityState.attributes || {};

  // Core metadata
  this.metadata.unit_of_measurement = attributes.unit_of_measurement || null;
  this.metadata.device_class = attributes.device_class || null;
  this.metadata.friendly_name = attributes.friendly_name || entityState.entity_id;
  this.metadata.state_class = attributes.state_class || null;
  this.metadata.icon = attributes.icon || null;

  // Timestamps
  this.metadata.last_changed = entityState.last_changed;
  this.metadata.last_updated = entityState.last_updated;

  // Device and area information (if available)
  if (attributes.device_id) {
    this.metadata.device_id = attributes.device_id;
  }

  // Try to get area from device registry (if available)
  if (this.hass?.entities?.[this.cfg.entity]) {
    const entityInfo = this.hass.entities[this.cfg.entity];
    this.metadata.area = entityInfo.area_id || null;
  }

  // Log captured metadata
  if (this.cfg.debug) {
    cblcarsLog.debug(`[MsdDataSource] 📊 Captured metadata for ${this.cfg.entity}:`, {
      unit: this.metadata.unit_of_measurement,
      device_class: this.metadata.device_class,
      friendly_name: this.metadata.friendly_name
    });
  }
}
```

**Update `start()` method to capture metadata:**

```javascript
async start() {
  if (this._started || this._destroyed) return;

  try {
    cblcarsLog.debug(`[MsdDataSource] 🚀 Starting initialization for ${this.cfg.entity}`);

    // STEP 1: Preload historical data FIRST
    if (this.hass?.callService) {
      await this._preloadHistory();
    }

    // STEP 2: Initialize with current HASS state if available
    if (this.hass.states && this.hass.states[this.cfg.entity]) {
      const currentState = this.hass.states[this.cfg.entity];

      // ✅ NEW: Extract metadata from initial state
      this._extractMetadata(currentState);

      cblcarsLog.debug(`[MsdDataSource] 🔄 Loading initial state for ${this.cfg.entity}:`, currentState.state);

      // ... rest of initialization ...
    }

    // ... rest of start method ...
  } catch (error) {
    cblcarsLog.error(`[MsdDataSource] ❌ Failed to initialize ${this.cfg.entity}:`, error);
    throw error;
  }
}
```

**Update `_handleStateChange()` to refresh metadata:**

```javascript
_handleStateChange(eventData) {
  if (!eventData?.new_state || this._destroyed) {
    return;
  }

  // ... existing safety checks ...

  // ✅ NEW: Update metadata on state changes
  this._extractMetadata(eventData.new_state);

  // Store the original state object before any conversion
  this._lastOriginalState = eventData.new_state;

  // ... rest of method ...
}
```

**Update `getCurrentData()` to include metadata:**

```javascript
getCurrentData() {
  const lastPoint = this.buffer.last();
  if (!lastPoint) {
    return {
      t: null,
      v: null,
      buffer: this.buffer,
      stats: { ...this._stats },
      transformations: this._getTransformationData(),
      aggregations: this._getAggregationData(),
      entity: this.cfg.entity,
      metadata: { ...this.metadata },  // ✅ NEW: Include metadata
      historyReady: this._stats.historyLoaded > 0,
      bufferSize: 0,
      started: this._started
    };
  }

  return {
    t: lastPoint.t,
    v: lastPoint.v,
    buffer: this.buffer,
    stats: { ...this._stats },
    transformations: this._getTransformationData(),
    aggregations: this._getAggregationData(),
    entity: this.cfg.entity,
    metadata: { ...this.metadata },  // ✅ NEW: Include metadata
    historyReady: this._stats.historyLoaded > 0,
    bufferSize: this.buffer.size(),
    started: this._started
  };
}
```

#### **Task 2: Update Template Processing to Use Metadata**

**File:** `src/msd/renderer/DataSourceMixin.js`

**Update `applyNumberFormat` method to use metadata:**

```javascript
/**
 * Apply number formatting with optional unit from metadata
 * @param {number} value - Value to format
 * @param {string} formatSpec - Format specification
 * @param {Object} metadata - DataSource metadata (optional)
 * @returns {string} Formatted value with unit if available
 */
static applyNumberFormat(value, formatSpec, metadata = null) {
  if (typeof value !== 'number') return String(value);

  let formattedValue;

  // Parse format specifications like ".1f", ".2%", "d", etc.
  if (formatSpec.endsWith('%')) {
    const precision = parseInt(formatSpec.slice(1, -1)) || 0;

    // Check if metadata indicates already a percentage
    if (metadata?.unit_of_measurement === '%') {
      formattedValue = value.toFixed(precision);
    } else {
      formattedValue = (value * 100).toFixed(precision);
    }
    return `${formattedValue}%`;
  }

  if (formatSpec.endsWith('f')) {
    const precision = parseInt(formatSpec.slice(1, -1)) || 1;
    formattedValue = value.toFixed(precision);
  } else if (formatSpec === 'd') {
    formattedValue = Math.round(value).toString();
  } else {
    formattedValue = String(value);
  }

  // ✅ NEW: Append unit from metadata if available
  if (metadata?.unit_of_measurement) {
    return `${formattedValue}${metadata.unit_of_measurement}`;
  }

  return formattedValue;
}
```

**Update template processing to pass metadata:**

```javascript
static processEnhancedTemplateStringsWithFallback(content, rendererName = 'Renderer', fallbackToOriginal = true) {
  try {
    const dataSourceManager = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.dataSourceManager;
    if (!dataSourceManager) {
      return fallbackToOriginal ? content : null;
    }

    let hasUnresolvedTemplates = false;
    const processedContent = content.replace(/\{([^}]+)\}/g, (match, reference) => {
      try {
        const [dataSourceRef, formatSpec] = reference.split(':');
        const cleanRef = dataSourceRef.trim();

        const { sourceName, dataKey, isTransformation, isAggregation } = this.parseDataSourceReference(cleanRef);
        const dataSource = dataSourceManager.getSource(sourceName);

        if (!dataSource) {
          cblcarsLog.warn(`[${rendererName}] 🔗 DataSource '${sourceName}' not found`);
          hasUnresolvedTemplates = true;
          return fallbackToOriginal ? match : `[Source: ${sourceName} not found]`;
        }

        const currentData = dataSource.getCurrentData();
        let value = currentData?.v;

        // ... existing value resolution logic ...

        if (value === null || value === undefined) {
          hasUnresolvedTemplates = true;
          return fallbackToOriginal ? match : `[No data: ${reference}]`;
        }

        // ✅ ENHANCED: Apply formatting with metadata
        if (formatSpec) {
          return this.applyNumberFormat(
            value,
            formatSpec.trim(),
            currentData?.metadata  // ✅ NEW: Pass metadata
          );
        }

        return String(value);

      } catch (error) {
        cblcarsLog.error(`[${rendererName}] ❌ Template processing error for '${reference}':`, error);
        hasUnresolvedTemplates = true;
        return fallbackToOriginal ? match : `[Error: ${reference}]`;
      }
    });

    return processedContent;

  } catch (error) {
    cblcarsLog.error(`[${rendererName}] ❌ Enhanced template processing failed:`, error);
    return fallbackToOriginal ? content : null;
  }
}
```

#### **Task 3: Add Metadata Helper Methods**

**File:** `src/msd/data/MsdDataSource.js`

**Add helper methods after `getCurrentData()`:**

```javascript
/**
 * Get entity metadata
 * @returns {Object} Entity metadata object
 */
getMetadata() {
  return { ...this.metadata };
}

/**
 * Get formatted value with unit
 * @param {number} value - Value to format
 * @param {number} precision - Decimal places
 * @returns {string} Formatted value with unit
 */
getFormattedValue(value, precision = 1) {
  if (!Number.isFinite(value)) return 'N/A';

  const formatted = value.toFixed(precision);
  return this.metadata.unit_of_measurement
    ? `${formatted}${this.metadata.unit_of_measurement}`
    : formatted;
}

/**
 * Get display name (friendly_name or entity_id)
 * @returns {string} Display name
 */
getDisplayName() {
  return this.metadata.friendly_name || this.cfg.entity;
}
```

### **Testing Configuration**

```yaml
data_sources:
  # Test 1: Temperature with auto-unit
  temperature:
    entity: sensor.outdoor_temp
    # Captures: unit_of_measurement: "°F"

  # Test 2: Power with auto-unit
  power:
    entity: sensor.power_meter
    # Captures: unit_of_measurement: "W"

    transformations:
      - type: unit_conversion
        conversion: w_to_kw
        key: kilowatts

overlays:
  # Auto-formatted text with unit
  - type: text
    text: "Temp: {temperature.v:.1f}"
    # Renders: "Temp: 72.5°F"

  - type: text
    text: "Power: {power.transformations.kilowatts:.2f}"
    # Renders: "Power: 1.25W" (still shows original unit, needs manual override)
```

### **Browser Console Testing**

```javascript
// Test metadata capture
const ds = __msdDebug.pipelineInstance.systemsManager.dataSourceManager.getSource('temperature');

console.log('Metadata:', ds.getMetadata());
// Expected: {unit_of_measurement: "°F", device_class: "temperature", ...}

console.log('Display name:', ds.getDisplayName());
// Expected: "Outdoor Temperature"

console.log('Formatted value:', ds.getFormattedValue(72.5, 1));
// Expected: "72.5°F"

const data = ds.getCurrentData();
console.log('Metadata in data:', data.metadata);
```

### **Validation Checklist**

- [ ] `metadata` object initialized in constructor
- [ ] `_extractMetadata()` method captures all fields
- [ ] Metadata extracted on data source start
- [ ] Metadata updated on state changes
- [ ] `getCurrentData()` includes metadata
- [ ] `getMetadata()` helper method works
- [ ] `getFormattedValue()` appends units correctly
- [ ] `getDisplayName()` returns friendly name
- [ ] Template processing uses metadata for formatting
- [ ] `applyNumberFormat()` appends units automatically
- [ ] Text overlays show formatted values with units
- [ ] Metadata persists across updates

---

## 🔍 Phase 2A.3: Nested Attribute Paths

**Priority:** 🟡 Medium
**Estimated Time:** 2 hours
**Complexity:** Low-Medium

### **Objective**

Enable access to nested entity attributes using dot notation and array indices, enabling weather forecasts, complex device data, and nested JSON structures.

### **What It Enables**

```yaml
data_sources:
  # Weather forecast (array access)
  today_high:
    entity: weather.home
    attribute_path: "forecast.0.temperature"

  tomorrow_high:
    entity: weather.home
    attribute_path: "forecast[1].temperature"

  # Device info (nested objects)
  device_manufacturer:
    entity: sensor.smart_device
    attribute_path: "device_info.manufacturer"

  # Complex nesting
  wifi_signal:
    entity: sensor.network_monitor
    attribute_path: "wifi.networks[0].signal_strength"

overlays:
  - type: text
    text: "Today: {today_high.v:.0f}°F | Tomorrow: {tomorrow_high.v:.0f}°F"
```

### **Implementation Tasks**

#### **Task 1: Add Nested Attribute Extraction Method**

**File:** `src/msd/data/MsdDataSource.js`

**Add method after `_toNumber()`:**

```javascript
/**
 * Extract nested attribute value using dot notation and array indices
 *
 * Supports:
 * - Dot notation: "forecast.temperature"
 * - Array indices: "forecast.0.temperature" or "forecast[0].temperature"
 * - Mixed: "device.config[0].settings.enabled"
 *
 * @private
 * @param {Object} attributes - Entity attributes object
 * @param {string} path - Attribute path (e.g., "forecast.0.temperature")
 * @returns {*} Extracted value or null if not found
 */
_extractNestedAttribute(attributes, path) {
  if (!attributes || !path) {
    return null;
  }

  try {
    // Normalize path: convert brackets to dots
    // "forecast[0].temperature" → "forecast.0.temperature"
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');

    // Split into path segments
    const segments = normalizedPath.split('.');

    // Traverse the object
    let current = attributes;

    for (const segment of segments) {
      if (current === null || current === undefined) {
        if (this.cfg.debug) {
          cblcarsLog.debug(
            `[MsdDataSource] ${this.cfg.entity}: Nested path traversal stopped at null/undefined for segment: ${segment}`
          );
        }
        return null;
      }

      // Check if segment is an array index
      const arrayIndex = parseInt(segment);
      if (!isNaN(arrayIndex)) {
        // Array access
        if (!Array.isArray(current)) {
          if (this.cfg.debug) {
            cblcarsLog.debug(
              `[MsdDataSource] ${this.cfg.entity}: Expected array at segment ${segment}, got ${typeof current}`
            );
          }
          return null;
        }

        if (arrayIndex < 0 || arrayIndex >= current.length) {
          if (this.cfg.debug) {
            cblcarsLog.debug(
              `[MsdDataSource] ${this.cfg.entity}: Array index ${arrayIndex} out of bounds (length: ${current.length})`
            );
          }
          return null;
        }

        current = current[arrayIndex];
      } else {
        // Object property access
        if (typeof current !== 'object') {
          if (this.cfg.debug) {
            cblcarsLog.debug(
              `[MsdDataSource] ${this.cfg.entity}: Expected object at segment ${segment}, got ${typeof current}`
            );
          }
          return null;
        }

        if (!(segment in current)) {
          if (this.cfg.debug) {
            cblcarsLog.debug(
              `[MsdDataSource] ${this.cfg.entity}: Property "${segment}" not found in object. Available: ${Object.keys(current).join(', ')}`
            );
          }
          return null;
        }

        current = current[segment];
      }
    }

    if (this.cfg.debug) {
      cblcarsLog.debug(
        `[MsdDataSource] ${this.cfg.entity}: Successfully extracted nested attribute "${path}": ${current}`
      );
    }

    return current;

  } catch (error) {
    cblcarsLog.warn(
      `[MsdDataSource] ${this.cfg.entity}: Error extracting nested attribute "${path}":`,
      error.message
    );
    return null;
  }
}
```

#### **Task 2: Update _handleStateChange to Use Nested Paths**

**File:** `src/msd/data/MsdDataSource.js`

**Update `_handleStateChange()` method (around line 400):**

```javascript
_handleStateChange(eventData) {
  if (!eventData?.new_state || this._destroyed) {
    return;
  }

  // ... existing safety checks and metadata extraction ...

  const timestamp = Date.now();

  // ✅ ENHANCED: Support nested attribute paths
  let rawValue;

  if (this.cfg.attribute_path) {
    // New nested path syntax
    rawValue = this._extractNestedAttribute(
      eventData.new_state.attributes,
      this.cfg.attribute_path
    );

    if (rawValue === null && this.cfg.debug) {
      cblcarsLog.debug(
        `[MsdDataSource] ${this.cfg.entity}: Nested attribute path "${this.cfg.attribute_path}" returned null`
      );
    }
  } else if (this.cfg.attribute) {
    // Legacy single attribute access
    rawValue = eventData.new_state.attributes?.[this.cfg.attribute];
  } else {
    // Entity state
    rawValue = eventData.new_state.state;
  }

  const value = this._toNumber(rawValue);

  // ... rest of method ...
}
```

#### **Task 3: Update History Loading**

**File:** `src/msd/data/MsdDataSource.js`

**Update history processing methods to support nested paths:**

Find `_preloadWithHistoryService` method and update:

```javascript
async _preloadWithHistoryService(startTime, endTime) {
  const response = await this.hass.callService('history', 'get_history', {
    entity_ids: [this.cfg.entity],
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString()
  });

  if (response && response[0]) {
    const states = response[0];
    cblcarsLog.debug(`[MsdDataSource] History service returned ${states.length} states for ${this.cfg.entity}`);

    for (const state of states) {
      const timestamp = new Date(state.last_changed || state.last_updated).getTime();

      // ✅ ENHANCED: Support nested attribute paths
      let rawValue;
      if (this.cfg.attribute_path) {
        rawValue = this._extractNestedAttribute(state.attributes, this.cfg.attribute_path);
      } else if (this.cfg.attribute) {
        rawValue = state.attributes?.[this.cfg.attribute];
      } else {
        rawValue = state.state;
      }

      const value = this._toNumber(rawValue);

      if (value !== null) {
        this.buffer.push(timestamp, value);
        this._stats.historyLoaded++;
      }
    }
  }
}
```

Apply the same pattern to `_preloadStateHistoryWS` and `_preloadHistoryREST` methods.

### **Testing Configuration**

```yaml
data_sources:
  # Test 1: Array index with dot notation
  today_forecast:
    entity: weather.home
    attribute_path: "forecast.0.temperature"
    debug: true

  # Test 2: Array index with brackets
  tomorrow_forecast:
    entity: weather.home
    attribute_path: "forecast[1].temperature"
    debug: true

  # Test 3: Nested object
  device_manufacturer:
    entity: sensor.smart_device
    attribute_path: "device_info.manufacturer"
    debug: true

  # Test 4: Complex mixed path
  wifi_strength:
    entity: sensor.network
    attribute_path: "wifi.networks[0].signal_strength"
    debug: true

  # Test 5: Multiple levels
  deep_nested:
    entity: sensor.complex_device
    attribute_path: "config.system.modules[2].settings.enabled"
    debug: true

overlays:
  - type: text
    text: "Today: {today_forecast.v:.0f}° | Tomorrow: {tomorrow_forecast.v:.0f}°"
    position: [100, 100]

  - type: text
    text: "Device: {device_manufacturer.v}"
    position: [100, 130]

  - type: text
    text: "WiFi: {wifi_strength.v} dBm"
    position: [100, 160]
```

### **Browser Console Testing**

```javascript
// Test nested attribute extraction
const ds = __msdDebug.pipelineInstance.systemsManager.dataSourceManager.getSource('today_forecast');

// Check if value is extracted
const data = ds.getCurrentData();
console.log('Current value:', data.v);
console.log('Entity:', data.entity);
console.log('Attribute path:', ds.cfg.attribute_path);

// Test extraction method directly
const testEntity = {
  attributes: {
    forecast: [
      { temperature: 75, condition: 'sunny' },
      { temperature: 72, condition: 'cloudy' }
    ]
  }
};

console.log('Test extraction:', ds._extractNestedAttribute(testEntity.attributes, 'forecast.0.temperature'));
// Expected: 75

console.log('Test extraction (brackets):', ds._extractNestedAttribute(testEntity.attributes, 'forecast[1].temperature'));
// Expected: 72
```

### **Validation Checklist**

- [ ] `_extractNestedAttribute()` method created
- [ ] Dot notation works: `forecast.0.temperature`
- [ ] Bracket notation works: `forecast[0].temperature`
- [ ] Mixed notation works: `device.config[0].settings.enabled`
- [ ] Array index validation works (out of bounds returns null)
- [ ] Object property validation works (missing property returns null)
- [ ] Null safety throughout traversal
- [ ] Debug logging shows path traversal
- [ ] `_handleStateChange` uses nested paths
- [ ] History loading uses nested paths
- [ ] Multiple DataSources with different paths work
- [ ] Text overlays display nested values correctly
- [ ] Legacy `attribute` config still works

---

## 📊 Phase 3A: ApexCharts Deep Integration

**Priority:** 🔴 Critical
**Estimated Time:** 5-8 hours
**Complexity:** High

### **Objective**

Enable full ApexCharts support for multi-value series (rangeArea, boxPlot, candlestick) using rolling statistics aggregations, with real-time updates and proper data formatting.

### **What It Enables**

```yaml
overlays:
  - type: apexchart
    id: temp-range-chart
    position: [100, 100]
    size: [600, 300]

    # Multi-value source (from rolling_statistics)
    source: "temperature.aggregations.temp_range"
    chart_type: rangeArea

    # Multiple series
    series:
      - name: "Temperature Range"
        source: "temperature.aggregations.hourly_range"
        type: rangeArea

      - name: "Average"
        source: "temperature.v"
        type: line

    # Auto-formatting from metadata
    # Auto-labels, units, decimals
```

### **Implementation Tasks**

#### **Task 1: Enhance ApexChartsOverlayRenderer**

**File:** `src/msd/renderer/ApexChartsOverlayRenderer.js`

**Update `_prepareSeriesData` method to handle arrays:**

```javascript
/**
 * Prepare series data from DataSource
 * ENHANCED: Now supports multi-value arrays from rolling_statistics
 *
 * @private
 * @param {Object} dataSource - DataSource instance
 * @param {Object} seriesConfig - Series configuration
 * @returns {Array} Array of data points [{x, y}] or [{x, y: [min, max]}]
 */
_prepareSeriesData(dataSource, seriesConfig = {}) {
  if (!dataSource) {
    return [];
  }

  try {
    const currentData = dataSource.getCurrentData();

    // Determine if we're using aggregation or transformation
    const sourceRef = seriesConfig.source || '';
    const isAggregation = sourceRef.includes('.aggregations.');
    const isTransformation = sourceRef.includes('.transformations.');

    let sourceData = null;
    let isMultiValue = false;

    if (isAggregation) {
      // Extract aggregation key from reference
      const aggKey = this._extractAggregationKey(sourceRef);
      sourceData = currentData.aggregations?.[aggKey];

      // ✅ NEW: Check if aggregation returns array (multi-value)
      if (Array.isArray(sourceData)) {
        isMultiValue = true;
      }
    } else if (isTransformation) {
      // Extract transformation key
      const transformKey = this._extractTransformationKey(sourceRef);
      sourceData = currentData.transformations?.[transformKey];
    } else {
      // Direct value
      sourceData = currentData.v;
    }

    // Get historical data from buffer
    const historicalData = dataSource.buffer?.getRecent?.(100) || [];

    if (isMultiValue) {
      // ✅ NEW: Handle multi-value data (rangeArea, boxPlot, etc.)
      return this._prepareMultiValueSeriesData(historicalData, sourceData, seriesConfig);
    } else {
      // Single value series (line, area, column, etc.)
      return this._prepareSingleValueSeriesData(historicalData, sourceData, seriesConfig);
    }

  } catch (error) {
    cblcarsLog.error('[ApexChartsOverlayRenderer] Error preparing series data:', error);
    return [];
  }
}

/**
 * Prepare multi-value series data (rangeArea, boxPlot, candlestick)
 * @private
 * @param {Array} historicalData - Historical data points
 * @param {Array} currentValue - Current multi-value array
 * @param {Object} seriesConfig - Series configuration
 * @returns {Array} Formatted data points
 */
_prepareMultiValueSeriesData(historicalData, currentValue, seriesConfig) {
  const data = [];

  // Process historical data if available
  if (historicalData && historicalData.length > 0) {
    historicalData.forEach(point => {
      // For now, we'll use the historical buffer's single values
      // In the future, we should store aggregation history
      const timestamp = point.t || point.timestamp;

      data.push({
        x: timestamp,
        y: currentValue // Use current aggregation for all points (temporary)
      });
    });
  }

  // Add current value
  if (currentValue) {
    data.push({
      x: Date.now(),
      y: currentValue
    });
  }

  return data;
}

/**
 * Prepare single-value series data (line, area, column)
 * @private
 * @param {Array} historicalData - Historical data points
 * @param {number} currentValue - Current value
 * @param {Object} seriesConfig - Series configuration
 * @returns {Array} Formatted data points
 */
_prepareSingleValueSeriesData(historicalData, currentValue, seriesConfig) {
  const data = [];

  // Process historical data
  if (historicalData && historicalData.length > 0) {
    historicalData.forEach(point => {
      const timestamp = point.t || point.timestamp;
      const value = point.v || point.value;

      if (Number.isFinite(value)) {
        data.push({
          x: timestamp,
          y: value
        });
      }
    });
  }

  // Add current value if not already in historical data
  if (Number.isFinite(currentValue)) {
    const lastTimestamp = data.length > 0 ? data[data.length - 1].x : 0;
    const now = Date.now();

    if (now > lastTimestamp) {
      data.push({
        x: now,
        y: currentValue
      });
    }
  }

  return data;
}

/**
 * Extract aggregation key from source reference
 * @private
 * @param {string} sourceRef - Source reference string
 * @returns {string} Aggregation key
 */
_extractAggregationKey(sourceRef) {
  const parts = sourceRef.split('.aggregations.');
  if (parts.length > 1) {
    return parts[1].split('.')[0]; // Get first part after .aggregations.
  }
  return '';
}

/**
 * Extract transformation key from source reference
 * @private
 * @param {string} sourceRef - Source reference string
 * @returns {string} Transformation key
 */
_extractTransformationKey(sourceRef) {
  const parts = sourceRef.split('.transformations.');
  if (parts.length > 1) {
    return parts[1].split('.')[0]; // Get first part after .transformations.
  }
  return '';
}
```

#### **Task 2: Add Chart Type Detection**

**Add method to detect chart type from series data:**

```javascript
/**
 * Detect appropriate chart type based on data structure
 * @private
 * @param {Array} seriesData - Series data array
 * @returns {string} Chart type (line, rangeArea, boxPlot, candlestick)
 */
_detectChartType(seriesData) {
  if (!seriesData || seriesData.length === 0) {
    return 'line';
  }

  // Check first data point structure
  const firstPoint = seriesData[0];

  if (!firstPoint || !firstPoint.y) {
    return 'line';
  }

  // Check if y is an array
  if (Array.isArray(firstPoint.y)) {
    const yLength = firstPoint.y.length;

    switch (yLength) {
      case 2:
        return 'rangeArea'; // [min, max]
      case 4:
        return 'candlestick'; // [open, high, low, close]
      case 5:
        return 'boxPlot'; // [min, q1, median, q3, max]
      default:
        cblcarsLog.warn('[ApexChartsOverlayRenderer] Unknown multi-value format, defaulting to line');
        return 'line';
    }
  }

  // Single value
  return 'line';
}
```

#### **Task 3: Update Chart Options Generation**

**Enhance `_generateChartOptions` to use metadata:**

```javascript
/**
 * Generate ApexCharts options
 * ENHANCED: Now uses DataSource metadata for auto-formatting
 *
 * @private
 * @param {Object} overlay - Overlay configuration
 * @param {Object} dataSource - DataSource instance
 * @returns {Object} ApexCharts options
 */
_generateChartOptions(overlay, dataSource) {
  const chartType = overlay.chart_type || this._detectChartType(overlay.series?.[0]?.data);
  const metadata = dataSource?.getMetadata?.() || {};

  // Base options
  const options = {
    chart: {
      type: chartType,
      height: overlay.size?.[1] || 300,
      width: overlay.size?.[0] || 600,
      animations: {
        enabled: true,
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      },
      toolbar: {
        show: false
      }
    },

    // ✅ NEW: Auto-configure based on chart type
    stroke: this._getStrokeConfig(chartType),
    fill: this._getFillConfig(chartType),

    // ✅ NEW: Auto-format axes with metadata
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
        format: 'HH:mm'
      }
    },

    yaxis: {
      // ✅ NEW: Auto-label with unit from metadata
      title: {
        text: metadata.unit_of_measurement || overlay.y_axis_label || ''
      },
      labels: {
        formatter: (value) => {
          if (!Number.isFinite(value)) return 'N/A';

          // ✅ NEW: Auto-determine precision based on device_class
          let precision = 1;
          if (metadata.device_class === 'temperature') {
            precision = 1;
          } else if (metadata.device_class === 'energy') {
            precision = 2;
          } else if (metadata.device_class === 'power') {
            precision = 0;
          }

          const formatted = value.toFixed(precision);
          return metadata.unit_of_measurement ?
            `${formatted}${metadata.unit_of_measurement}` :
            formatted;
        }
      }
    },

    // ✅ NEW: Auto-configure tooltip
    tooltip: {
      enabled: true,
      x: {
        format: 'MMM dd HH:mm'
      },
      y: {
        formatter: (value) => {
          if (Array.isArray(value)) {
            // Multi-value (rangeArea, boxPlot, etc.)
            return value.map(v =>
              Number.isFinite(v) ?
                `${v.toFixed(1)}${metadata.unit_of_measurement || ''}` :
                'N/A'
            ).join(' - ');
          }

          // Single value
          return Number.isFinite(value) ?
            `${value.toFixed(1)}${metadata.unit_of_measurement || ''}` :
            'N/A';
        }
      }
    },

    // Merge user-provided options
    ...(overlay.chart_options || {})
  };

  return options;
}

/**
 * Get stroke configuration for chart type
 * @private
 */
_getStrokeConfig(chartType) {
  switch (chartType) {
    case 'line':
      return {
        curve: 'smooth',
        width: 2
      };
    case 'rangeArea':
      return {
        curve: 'smooth',
        width: [0, 2]
      };
    case 'area':
      return {
        curve: 'smooth',
        width: 2
      };
    default:
      return {
        width: 2
      };
  }
}

/**
 * Get fill configuration for chart type
 * @private
 */
_getFillConfig(chartType) {
  switch (chartType) {
    case 'rangeArea':
      return {
        type: 'solid',
        opacity: [0.24, 0.05]
      };
    case 'area':
      return {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.3
        }
      };
    default:
      return {};
  }
}
```

#### **Task 4: Add Real-Time Update Support**

**Enhance chart update mechanism:**

```javascript
/**
 * Update chart with new DataSource data
 * ENHANCED: Now handles multi-value series updates
 *
 * @param {Object} chartInstance - ApexCharts instance
 * @param {Object} dataSource - DataSource instance
 * @param {Object} overlay - Overlay configuration
 */
updateChartData(chartInstance, dataSource, overlay) {
  if (!chartInstance || !dataSource) {
    return;
  }

  try {
    const currentData = dataSource.getCurrentData();

    // Prepare updated series data
    const updatedSeries = [];

    if (overlay.series && Array.isArray(overlay.series)) {
      // Multiple series
      overlay.series.forEach(seriesConfig => {
        const seriesData = this._prepareSeriesData(dataSource, seriesConfig);
        updatedSeries.push({
          name: seriesConfig.name,
          data: seriesData
        });
      });
    } else {
      // Single series
      const seriesData = this._prepareSeriesData(dataSource, { source: overlay.source });
      updatedSeries.push({
        name: overlay.series_name || 'Data',
        data: seriesData
      });
    }

    // Update chart
    chartInstance.updateSeries(updatedSeries, true);

    cblcarsLog.debug('[ApexChartsOverlayRenderer] Updated chart data', {
      seriesCount: updatedSeries.length,
      firstSeriesLength: updatedSeries[0]?.data?.length
    });

  } catch (error) {
    cblcarsLog.error('[ApexChartsOverlayRenderer] Error updating chart:', error);
  }
}
```

### **Testing Configuration**

```yaml
data_sources:
  temperature:
    entity: sensor.outdoor_temp

    aggregations:
      # Range for rangeArea chart
      - type: rolling_statistics
        key: hourly_range
        window: "1h"
        stats: [min, max]

      # Distribution for boxPlot
      - type: rolling_statistics
        key: daily_distribution
        window: "24h"
        stats: [min, q1, median, q3, max]

overlays:
  # Test 1: RangeArea chart
  - type: apexchart
    id: temp-range-chart
    position: [100, 100]
    size: [600, 300]
    source: "temperature.aggregations.hourly_range"
    chart_type: rangeArea

    chart_options:
      colors: ['#ff9800']
      title:
        text: "Temperature Range (Last Hour)"

  # Test 2: Multiple series
  - type: apexchart
    id: temp-multi-chart
    position: [100, 450]
    size: [600, 300]

    series:
      - name: "Temperature Range"
        source: "temperature.aggregations.hourly_range"
        type: rangeArea

      - name: "Current"
        source: "temperature.v"
        type: line

    chart_options:
      title:
        text: "Temperature with Range"

  # Test 3: Box plot
  - type: apexchart
    id: temp-boxplot
    position: [750, 100]
    size: [400, 300]
    source: "temperature.aggregations.daily_distribution"
    chart_type: boxPlot

    chart_options:
      title:
        text: "Daily Temperature Distribution"
```

### **Browser Console Testing**

```javascript
// Test ApexCharts with rolling statistics
const renderer = __msdDebug.pipelineInstance.systemsManager.renderer;
const overlay = __msdDebug.pipelineInstance.getResolvedModel().overlays.find(o => o.id === 'temp-range-chart');

// Check chart instance
const chartId = `apexchart-${overlay.id}`;
const chartElement = document.getElementById(chartId);
console.log('Chart element:', chartElement);

// Check data source
const ds = __msdDebug.pipelineInstance.systemsManager.dataSourceManager.getSource('temperature');
const data = ds.getCurrentData();

console.log('Rolling stats:', data.aggregations.hourly_range);
// Expected: [22.5, 28.3] (array)

// Check chart data preparation
const seriesData = renderer._prepareSeriesData(ds, { source: 'temperature.aggregations.hourly_range' });
console.log('Prepared series data:', seriesData);
// Expected: [{x: timestamp, y: [22.5, 28.3]}, ...]
```

### **Validation Checklist**

- [ ] `_prepareSeriesData` handles array values
- [ ] `_prepareMultiValueSeriesData` formats correctly
- [ ] `_prepareSingleValueSeriesData` works for line charts
- [ ] `_detectChartType` identifies rangeArea, boxPlot, candlestick
- [ ] `_extractAggregationKey` parses source references
- [ ] `_generateChartOptions` uses metadata
- [ ] Auto-formatting includes units in axis labels
- [ ] Auto-formatting includes units in tooltips
- [ ] Precision auto-adjusts based on device_class
- [ ] `_getStrokeConfig` returns correct stroke settings
- [ ] `_getFillConfig` returns correct fill settings
- [ ] `updateChartData` handles multi-value updates
- [ ] RangeArea charts display correctly
- [ ] Multiple series charts work
- [ ] Real-time updates refresh charts
- [ ] Chart options merge with user config

---

## 🧪 Complete Testing Suite

### **End-to-End Test Configuration**

```yaml
data_sources:
  # Complete test: Temperature with all features
  temperature_complete:
    entity: sensor.outdoor_temp
    # ✅ Metadata captured automatically

    transformations:
      # ✅ Dynamic attributes
      - type: expression
        key: celsius
        expression: "(v - 32) * 5/9"

    aggregations:
      # ✅ Rolling statistics
      - type: rolling_statistics
        key: hourly_range
        window: "1h"
        stats: [min, max]

      - type: rolling_statistics
        key: daily_stats
        window: "24h"
        stats: [min, q1, median, q3, max]
        output_format: object

  # Nested attributes test
  weather_forecast:
    entity: weather.home

















Perfect! Let's document what we've completed and create a clear backlog for the ApexCharts enhancement.

## ✅ Phase 2B & 2C: COMPLETE

### [package.json](file:///home/jweyermars/code/cb-lcars/package.json)

```json
{
  "name": "cb-lcars",
  "version": "2025.10.1-phase2bc-complete",
  "description": "Home Assistant LCARS libary built on custom-button-card",
  "main": "index.js",
  "author": "Jason Weyermars",
  "license": "MIT",
  "homepage": "https://cb-lcars.unimatrix01.ca"
}
```

---

## 📋 Implementation Status Summary

### **✅ COMPLETED - Phase 2 Foundation**

| Feature | Status | Files Modified | Time |
|---------|--------|----------------|------|
| **Phase 1** | ✅ Complete | aggregations/index.js | 2-3h |
| Array-based aggregations | ✅ | MsdDataSource.js | |
| **Phase 2A.1** | ✅ Complete | ExpressionProcessor.js | 2h |
| Dynamic attribute access | ✅ | MsdDataSource.js | |
| **Phase 2A.2** | ✅ Complete | MsdDataSource.js | 1h |
| String enum mapping | ✅ | | |
| **Phase 2A.2b** | ✅ Complete | MsdDataSource.js | 1h |
| Periodic updates | ✅ | | |
| **Phase 2B** | ✅ Complete | RollingStatisticsAggregation.js (NEW) | 3-4h |
| Rolling statistics | ✅ | aggregations/index.js | |
| **Phase 2A.3** | ✅ Complete | MsdDataSource.js | 2h |
| Nested attribute paths | ✅ | | |
| **Phase 2C** | ✅ Complete | MsdDataSource.js | 2-3h |
| Metadata system | ✅ | DataSourceMixin.js | |

**Total Implementation Time:** ~13-16 hours ✅

---

### **🔲 BACKLOG - Phase 3A: ApexCharts Deep Integration**

**Priority:** 🟡 Medium (Future Enhancement)
**Estimated Time:** 5-8 hours
**Status:** Deferred

#### **Scope:**
- Multi-value series support (rangeArea, boxPlot, candlestick)
- Automatic chart type detection from data structure
- Metadata-driven chart configuration
- Real-time multi-value updates
- Advanced tooltip formatting

#### **Files to Modify:**
- `src/msd/renderer/ApexChartsOverlayRenderer.js` - Series data preparation
- `src/msd/charts/ChartDataValidator.js` - Multi-value validation
- Documentation updates

#### **Reasoning for Backlog:**
Current ApexCharts implementation supports:
- ✅ Single-value series (line, area, column, bar)
- ✅ Real-time updates
- ✅ Basic metadata integration
- ✅ Multiple series

**What's missing (and can wait):**
- Multi-value array handling for complex chart types
- Auto-detection of chart types from data structure
- Deep metadata integration for auto-formatting

**Current Workaround:**
Users can still create rangeArea/boxPlot charts by:
1. Using rolling_statistics aggregations ✅
2. Manually configuring chart options
3. Processing data in transformation expressions

---

## 🎉 What We Achieved

### **Production-Ready DataSource Features:**

1. **Rolling Statistics Aggregation**
   - ✅ Multi-value output: `[min, max]`, `[min, q1, median, q3, max]`, `[open, high, low, close]`
   - ✅ Configurable time windows
   - ✅ Input source chaining
   - ✅ Array and object output formats

2. **Comprehensive Metadata System**
   - ✅ Auto-capture: unit_of_measurement, device_class, friendly_name, area, device_id
   - ✅ Metadata propagation to templates
   - ✅ Auto-formatting with units
   - ✅ Helper methods: `getMetadata()`, `getFormattedValue()`, `getDisplayName()`

3. **Nested Attribute Access**
   - ✅ Dot notation: `forecast.temperature`
   - ✅ Array indices: `forecast.0.temperature` or `forecast[0].temperature`
   - ✅ Mixed paths: `device.config[0].settings.enabled`
   - ✅ Full history loading support

---

## 🧪 Quick Validation Test

```yaml
data_sources:
  temperature:
    entity: sensor.outdoor_temp

    aggregations:
      - type: rolling_statistics
        key: hourly_range
        window: "1h"
        stats: [min, max]

  weather_forecast:
    entity: weather.home
    attribute_path: "forecast.0.temperature"

overlays:
  - type: text
    text: "Temp Range: {temperature.aggregations.hourly_range}"
    position: [100, 100]

  - type: text
    text: "Today's High: {weather_forecast.v:.0f}"
    position: [100, 130]
```

### **Browser Console Check:**

```javascript
// Test rolling statistics
const ds = __msdDebug.pipelineInstance.systemsManager.dataSourceManager.getSource('temperature');
console.log('Rolling stats:', ds.getCurrentData().aggregations.hourly_range);
// Expected: [22.5, 28.3]

// Test metadata
console.log('Metadata:', ds.getMetadata());
// Expected: {unit_of_measurement: "°F", device_class: "temperature", ...}

// Test nested attributes
const weather = __msdDebug.pipelineInstance.systemsManager.dataSourceManager.getSource('weather_forecast');
console.log('Forecast temp:', weather.getCurrentData().v);
// Expected: 75 (from forecast.0.temperature)
```

---

## 📝 Next Steps

**When ready to tackle ApexCharts enhancement:**

1. Review backlog specifications in "DataSource Enhancement in-progress.md"
2. Focus on `_prepareSeriesData()` multi-value support
3. Implement chart type detection
4. Add real-time multi-value updates
5. Update documentation with rangeArea/boxPlot examples

**For now, Phase 2 is complete and production-ready!** 🚀

**Shall we move on to a different feature, or would you like to test what we've built?**

Made changes.