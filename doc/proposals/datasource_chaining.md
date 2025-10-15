# DataSource Transformation Chaining Enhancement

**Status:** Proposed
**Priority:** Medium
**Complexity:** Low
**Estimated Effort:** 4-6 hours

---

## Executive Summary

Enable true sequential chaining of data transformations, allowing each transformation in the pipeline to operate on the output of previous transformations rather than only the raw source value. This enhancement adds significant flexibility for complex data processing scenarios while maintaining backward compatibility with existing parallel transformation configurations.

---

## Current Behavior

### Parallel Processing Model

Currently, all transformations operate **independently** on the raw source value:

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.outside_temp
    transformations:
      - type: unit_conversion
        conversion: "f_to_c"
        key: "celsius"           # Operates on raw °F

      - type: scale
        input_range: [0, 100]
        output_range: [0, 1]
        key: "normalized"        # ALSO operates on raw °F (not celsius!)

      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"          # ALSO operates on raw °F
```

**Data Flow:**
```
              ┌──────────────┐
              │  Raw Value   │
              │     72°F     │
              └──────┬───────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
         ▼           ▼           ▼
    ┌────────┐  ┌─────────┐  ┌─────────┐
    │celsius │  │normalized│ │smoothed │
    │ 22.2°C │  │   0.72   │  │  68.4°F │
    └────────┘  └─────────┘  └─────────┘
```

### Limitations

1. **Cannot build pipelines** - Each transform must handle raw data format
2. **Redundant conversions** - Must convert units in every transform that needs them
3. **Complex expressions** - Multi-step logic must be written as single expression
4. **No intermediate results** - Cannot reuse transform outputs in subsequent steps

---

## Proposed Enhancement

### Sequential Chaining Model

Add optional `input_source` parameter to transformation configs, enabling sequential processing:

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.outside_temp
    transformations:
      # Step 1: Convert to Celsius (operates on raw)
      - type: unit_conversion
        conversion: "f_to_c"
        key: "celsius"

      # Step 2: Scale the Celsius value (chains from step 1)
      - type: scale
        input_source: "celsius"      # NEW: Reference previous transform
        input_range: [-10, 40]
        output_range: [0, 100]
        key: "celsius_percent"

      # Step 3: Smooth the percentage (chains from step 2)
      - type: smooth
        input_source: "celsius_percent"  # NEW: Chain from step 2
        method: "exponential"
        alpha: 0.3
        key: "final"
```

**Data Flow:**
```
┌──────────────┐
│  Raw Value   │
│     72°F     │
└──────┬───────┘
       │
       ▼
   ┌────────┐
   │celsius │  input_source: (raw)
   │ 22.2°C │
   └────┬───┘
        │
        ▼
   ┌──────────────┐
   │celsius_percent│  input_source: "celsius"
   │      64%      │
   └──────┬────────┘
          │
          ▼
      ┌───────┐
      │ final │  input_source: "celsius_percent"
      │  62%  │
      └───────┘
```

---

## Technical Implementation

### 1. Core Changes to `MsdDataSource.js`

#### Modified `_applyTransformations()` Method

```javascript
/**
 * Apply all configured transformations to a value
 * Supports both parallel (default) and sequential (chained) processing
 * @private
 * @param {number} timestamp - Current timestamp
 * @param {number} value - Raw value to transform
 * @returns {Object} Map of transformation keys to results
 */
_applyTransformations(timestamp, value) {
  const results = {};

  // Track execution order for chained transforms
  const executionOrder = this._determineTransformationOrder();

  executionOrder.forEach((key) => {
    const processor = this.transformations.get(key);

    try {
      // Determine input value: chained source or raw value
      const inputSource = processor.config.input_source;
      const inputValue = inputSource
        ? results[inputSource]   // Chain from previous transform
        : value;                 // Use raw value (default)

      // Validate chained input exists
      if (inputSource && results[inputSource] === undefined) {
        cblcarsLog.warn(
          `[MsdDataSource] ⚠️ Transform '${key}' references undefined source '${inputSource}'. ` +
          `Available sources: ${Object.keys(results).join(', ') || 'none'}`
        );
        results[key] = null;
        return;
      }

      // Validate input is numeric
      if (!Number.isFinite(inputValue)) {
        cblcarsLog.warn(
          `[MsdDataSource] ⚠️ Transform '${key}' received non-numeric input: ${inputValue}`
        );
        results[key] = null;
        return;
      }

      // Execute transformation
      const transformedValue = processor.transform(inputValue, timestamp, this.buffer);
      results[key] = transformedValue;

      // Cache transformed historical data if valid
      if (transformedValue !== null && Number.isFinite(transformedValue)) {
        const buffer = this.transformedBuffers.get(key);
        if (buffer) {
          buffer.push(timestamp, transformedValue);
        }
      }

    } catch (error) {
      cblcarsLog.warn(`[MsdDataSource] ⚠️ Transformation ${key} failed:`, error);
      results[key] = null;
    }
  });

  return results;
}
```

#### New Helper Method: `_determineTransformationOrder()`

```javascript
/**
 * Determine execution order for transformations based on dependencies
 * Uses topological sort to handle chained transformations
 * @private
 * @returns {Array<string>} Ordered array of transformation keys
 */
_determineTransformationOrder() {
  const keys = Array.from(this.transformations.keys());
  const graph = new Map();
  const inDegree = new Map();

  // Build dependency graph
  keys.forEach(key => {
    graph.set(key, []);
    inDegree.set(key, 0);
  });

  keys.forEach(key => {
    const processor = this.transformations.get(key);
    const inputSource = processor.config.input_source;

    if (inputSource) {
      // Validate input source exists
      if (!this.transformations.has(inputSource)) {
        cblcarsLog.error(
          `[MsdDataSource] ❌ Transform '${key}' references non-existent source '${inputSource}'`
        );
        return;
      }

      // Add edge: inputSource -> key
      graph.get(inputSource).push(key);
      inDegree.set(key, inDegree.get(key) + 1);
    }
  });

  // Topological sort using Kahn's algorithm
  const queue = [];
  const result = [];

  // Start with nodes that have no dependencies
  inDegree.forEach((degree, key) => {
    if (degree === 0) {
      queue.push(key);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift();
    result.push(current);

    // Reduce in-degree for dependent nodes
    graph.get(current).forEach(dependent => {
      inDegree.set(dependent, inDegree.get(dependent) - 1);
      if (inDegree.get(dependent) === 0) {
        queue.push(dependent);
      }
    });
  }

  // Detect cycles
  if (result.length !== keys.length) {
    const remaining = keys.filter(k => !result.includes(k));
    cblcarsLog.error(
      `[MsdDataSource] ❌ Circular dependency detected in transformations: ${remaining.join(', ')}`
    );

    // Return original order as fallback
    return keys;
  }

  return result;
}
```

#### Updated `_processHistoricalTransformations()` Method

```javascript
/**
 * Process historical data through transformations to populate transform buffers
 * Respects transformation execution order for chained transforms
 * @private
 */
_processHistoricalTransformations() {
  if (this.transformations.size === 0) {
    return;
  }

  cblcarsLog.debug(
    `[MsdDataSource] 🔄 Processing historical data through ${this.transformations.size} transformations...`
  );

  try {
    const historicalPoints = this.buffer.getRecent(this.buffer.size());

    if (historicalPoints.length === 0) {
      cblcarsLog.log(`[MsdDataSource] No historical data to process for transformations`);
      return;
    }

    // Get correct execution order for chained transforms
    const executionOrder = this._determineTransformationOrder();

    // Process each historical point in chronological order
    historicalPoints.reverse().forEach((point) => {
      const transformResults = {};

      // Execute transforms in dependency order
      executionOrder.forEach((key) => {
        const processor = this.transformations.get(key);

        try {
          // Determine input: chained source or raw value
          const inputSource = processor.config.input_source;
          const inputValue = inputSource
            ? transformResults[inputSource]
            : point.value;

          if (inputValue === null || !Number.isFinite(inputValue)) {
            transformResults[key] = null;
            return;
          }

          const transformedValue = processor.transform(
            inputValue,
            point.timestamp,
            this.buffer
          );

          transformResults[key] = transformedValue;

          // Store in buffer
          if (transformedValue !== null && Number.isFinite(transformedValue)) {
            const buffer = this.transformedBuffers.get(key);
            if (buffer) {
              buffer.push(point.timestamp, transformedValue);
            }
          }
        } catch (error) {
          cblcarsLog.warn(
            `[MsdDataSource] Failed to process historical point through transformation ${key}:`,
            error
          );
          transformResults[key] = null;
        }
      });
    });

    // Log results
    this.transformedBuffers.forEach((buffer, key) => {
      cblcarsLog.debug(
        `[MsdDataSource] ✅ Populated ${key} buffer with ${buffer.size()} historical points`
      );
    });

  } catch (error) {
    cblcarsLog.error(`[MsdDataSource] Error processing historical transformations:`, error);
  }
}
```

### 2. Update Transformation Processor Base Class

Add `input_source` to the base configuration in `TransformationProcessor.js`:

```javascript
export class TransformationProcessor {
  constructor(config) {
    this.config = { ...config };  // Store full config for later reference
    this.key = config.key || this.constructor.name.toLowerCase();
    this.enabled = config.enabled !== false;
    this.inputSource = config.input_source || null;  // NEW: Track chaining

    // Performance tracking
    this._stats = {
      transformations: 0,
      errors: 0,
      totalTime: 0
    };
  }

  // ... rest of class unchanged
}
```

### 3. Update DataSource Schema Documentation

Add to `doc/user/datasource_complete_documentation.md`:

```yaml
### Transformation Schema (Updated)
```yaml
transformations:
  # All transformation types now support optional chaining
  - type: <any_type>
    input_source: string           # NEW: Optional - key of previous transform to chain from
    key: string                    # Required: Result key
    # ... type-specific options
```

**Chaining Examples:**

```yaml
# Sequential pipeline
transformations:
  - type: unit_conversion
    conversion: "f_to_c"
    key: "celsius"                 # Step 1: Raw → Celsius

  - type: scale
    input_source: "celsius"        # Step 2: Celsius → Percentage
    input_range: [-10, 40]
    output_range: [0, 100]
    key: "percent"

  - type: smooth
    input_source: "percent"        # Step 3: Percentage → Smoothed
    method: "exponential"
    alpha: 0.3
    key: "final"

# Mixed parallel and chained
transformations:
  - type: unit_conversion
    conversion: "f_to_c"
    key: "celsius"                 # Parallel: Raw → Celsius

  - type: smooth
    method: "exponential"
    alpha: 0.3
    key: "smoothed_raw"            # Parallel: Raw → Smoothed °F

  - type: scale
    input_source: "celsius"        # Chained: Celsius → Percent
    input_range: [-10, 40]
    output_range: [0, 100]
    key: "celsius_percent"
```
```

---

## Use Cases

### 1. Temperature Comfort Index Pipeline

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.outdoor_temp
    transformations:
      # Step 1: Convert to Celsius
      - type: unit_conversion
        conversion: "f_to_c"
        key: "celsius"

      # Step 2: Scale to comfort range
      - type: scale
        input_source: "celsius"
        input_range: [-10, 35]
        output_range: [0, 100]
        curve: "sqrt"              # Perceptual scaling
        key: "comfort_raw"

      # Step 3: Smooth comfort index
      - type: smooth
        input_source: "comfort_raw"
        method: "moving_average"
        window_size: 5
        key: "comfort_index"

      # Parallel: Also keep raw smoothed temp for sparkline
      - type: smooth
        method: "exponential"
        alpha: 0.2
        key: "smoothed_celsius"

overlays:
  - type: text
    text: "Comfort: ${temperature.transformations.comfort_index.toFixed(0)}%"

  - type: sparkline
    source: temperature
    transform_key: "smoothed_celsius"
```

### 2. Power Consumption Analysis Pipeline

```yaml
data_sources:
  power:
    type: entity
    entity: sensor.whole_home_power
    transformations:
      # Step 1: Convert to kilowatts
      - type: unit_conversion
        conversion: "w_to_kw"
        key: "kw"

      # Step 2: Remove noise from kW readings
      - type: smooth
        input_source: "kw"
        method: "median"
        window_size: 5
        key: "kw_clean"

      # Step 3: Calculate deviation from baseline
      - type: expression
        input_source: "kw_clean"
        expression: "value - 2.5"    # 2.5kW baseline
        key: "deviation"

      # Step 4: Scale deviation to percentage of max
      - type: scale
        input_source: "deviation"
        input_range: [-2.5, 7.5]     # -2.5 to +7.5kW deviation
        output_range: [0, 100]
        clamp: true
        key: "load_percent"

      # Step 5: Calculate anomaly score
      - type: statistical
        input_source: "kw_clean"
        method: "z_score"
        window_size: 100
        key: "anomaly"

overlays:
  - type: text
    text: "Load: ${power.transformations.load_percent.toFixed(0)}%"
    rules:
      - condition: "Math.abs(power.transformations.anomaly) > 2"
        style:
          color: "#FF0000"
```

### 3. Multi-Stage Signal Processing

```yaml
data_sources:
  sensor:
    type: entity
    entity: sensor.noisy_signal
    transformations:
      # Stage 1: Outlier removal
      - type: smooth
        method: "median"
        window_size: 3
        key: "outliers_removed"

      # Stage 2: Noise reduction
      - type: smooth
        input_source: "outliers_removed"
        method: "moving_average"
        window_size: 5
        key: "noise_reduced"

      # Stage 3: Trend extraction
      - type: smooth
        input_source: "noise_reduced"
        method: "exponential"
        alpha: 0.1                   # Very slow change = trend
        key: "trend"

      # Stage 4: Calculate residual (noise_reduced - trend)
      - type: expression
        input_source: "noise_reduced"
        expression: |
          const trend = getTransform('trend');
          return value - trend;
        key: "residual"

      # Parallel: Keep raw for comparison
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed_raw"
```

### 4. Battery Runtime Estimation Pipeline

```yaml
data_sources:
  battery:
    type: entity
    entity: sensor.battery_soc
    transformations:
      # Step 1: Smooth battery percentage
      - type: smooth
        method: "exponential"
        alpha: 0.1
        key: "soc_smooth"

      # Step 2: Convert to energy (13.5kWh Powerwall)
      - type: expression
        input_source: "soc_smooth"
        expression: "value * 13.5 / 100"
        key: "energy_kwh"

      # Step 3: Calculate runtime
      - type: expression
        input_source: "energy_kwh"
        expression: |
          const load = getEntity('sensor.home_power') / 1000;
          if (load <= 0) return 999;
          return value / load;
        inputs: ['sensor.home_power']
        key: "runtime_hours"

      # Step 4: Convert to minutes for display
      - type: expression
        input_source: "runtime_hours"
        expression: "value * 60"
        key: "runtime_minutes"
```

---

## Backward Compatibility

### Guaranteed Compatibility

✅ **Existing configurations continue to work unchanged**
- Transformations without `input_source` operate on raw values (current behavior)
- Parallel processing remains the default
- No breaking changes to API or data structure

### Migration Path

Users can gradually adopt chaining:

```yaml
# Before (parallel only)
transformations:
  - type: unit_conversion
    conversion: "f_to_c"
    key: "celsius"

  - type: scale
    input_range: [0, 100]    # Operates on raw °F
    output_range: [0, 1]
    key: "normalized"

# After (with chaining)
transformations:
  - type: unit_conversion
    conversion: "f_to_c"
    key: "celsius"

  - type: scale
    input_source: "celsius"  # Now operates on Celsius!
    input_range: [-10, 40]   # Celsius range
    output_range: [0, 1]
    key: "normalized"
```

---

## Error Handling

### Validation Checks

1. **Missing Input Source**
   ```javascript
   // Transform references non-existent key
   if (inputSource && !results[inputSource]) {
     cblcarsLog.warn(`Transform '${key}' references undefined source '${inputSource}'`);
     results[key] = null;
   }
   ```

2. **Circular Dependencies**
   ```javascript
   // Topological sort detects cycles
   if (result.length !== keys.length) {
     cblcarsLog.error(`Circular dependency detected in transformations`);
   }
   ```

3. **Non-Numeric Input**
   ```javascript
   if (!Number.isFinite(inputValue)) {
     cblcarsLog.warn(`Transform '${key}' received non-numeric input`);
     results[key] = null;
   }
   ```

### Error Recovery

- Failed transforms return `null`
- Subsequent chained transforms skip execution if input is `null`
- Logs provide clear diagnostic information
- Other parallel transforms continue executing

---

## Performance Considerations

### Complexity Analysis

**Current (Parallel):**
- Time: O(n) where n = number of transforms
- Space: O(n) for results storage

**Proposed (With Chaining):**
- Time: O(n + e) where e = number of dependencies (edges)
  - Topological sort: O(n + e)
  - Transform execution: O(n)
  - **Total: O(n) in typical cases** (e << n)
- Space: O(n) for results storage + O(n) for dependency graph

### Performance Impact

**Overhead per transformation update:**
- Topological sort: ~0.01-0.05ms for typical configs (3-10 transforms)
- Dependency validation: ~0.001ms per transform
- **Total added overhead: <0.1ms** (negligible)

**Optimization opportunities:**
- Cache execution order (only recompute on config change)
- Skip topological sort if no `input_source` configs exist

### Caching Optimization

```javascript
// In MsdDataSource constructor
this._transformationOrderCache = null;
this._transformationOrderCacheValid = false;

// In _determineTransformationOrder()
_determineTransformationOrder() {
  // Return cached order if valid
  if (this._transformationOrderCacheValid && this._transformationOrderCache) {
    return this._transformationOrderCache;
  }

  // Compute order (existing logic)
  const order = this._computeOrder();

  // Cache result
  this._transformationOrderCache = order;
  this._transformationOrderCacheValid = true;

  return order;
}

// Invalidate cache on config changes
setConfig(cfg) {
  // ... existing code ...
  this._transformationOrderCacheValid = false;
}
```

---

## Testing Strategy

### Unit Tests

```javascript
// test/msd/data/transformation-chaining.test.js

describe('Transformation Chaining', () => {
  test('should execute transforms in dependency order', () => {
    // Given: Chained transforms A → B → C
    // When: Value is processed
    // Then: Execution order is [A, B, C]
  });

  test('should handle parallel and chained mix', () => {
    // Given: A → B, C (parallel), D → C
    // When: Value is processed
    // Then: A, C execute first, then B and D
  });

  test('should detect circular dependencies', () => {
    // Given: A → B → C → A (circular)
    // When: Order is determined
    // Then: Error is logged, fallback order used
  });

  test('should handle missing input source', () => {
    // Given: Transform references non-existent source
    // When: Transform is executed
    // Then: Warning logged, result is null
  });

  test('should propagate null through chain', () => {
    // Given: A → B → C, where A returns null
    // When: Chain is executed
    // Then: B and C are skipped, all return null
  });

  test('should maintain backward compatibility', () => {
    // Given: Transforms without input_source
    // When: Processed
    // Then: All operate on raw value (current behavior)
  });
});
```

### Integration Tests

```javascript
describe('MSD DataSource Chaining Integration', () => {
  test('should process historical data through chains', () => {
    // Given: Historical buffer + chained transforms
    // When: _processHistoricalTransformations() runs
    // Then: All transform buffers populated in order
  });

  test('should update chains on state change', () => {
    // Given: Active datasource with chained transforms
    // When: New state arrives
    // Then: All chained values update correctly
  });

  test('should provide chained data to overlays', () => {
    // Given: Overlay referencing chained transform
    // When: Overlay renders
    // Then: Correct chained value is used
  });
});
```

### Manual Testing Scenarios

1. **Simple Chain** - Temperature F → C → Percent → Smoothed
2. **Complex Pipeline** - Power with 5-stage processing
3. **Mixed Parallel/Chain** - Some transforms parallel, some chained
4. **Error Cases** - Missing sources, circular deps, null propagation
5. **Performance** - 20 datasources with 5 transforms each

---

## Documentation Updates

### Files to Update

1. **`doc/user/datasource_complete_documentation.md`**
   - Add `input_source` parameter to transformation schema
   - Add "Transformation Chaining" section with examples
   - Update all transformation type examples to show chaining option

2. **`doc/user/enhanced_datasource_guide.md`**
   - Add "Building Transformation Pipelines" section
   - Include real-world chaining examples
   - Add troubleshooting guide for common chaining issues

3. **`doc/user/enhanced_datasource_examples.md`**
   - Add 5-7 complete chaining examples
   - Show before/after for common scenarios
   - Include performance considerations

4. **`doc/architecture/msd_data_flow.md`** (if exists)
   - Update data flow diagrams to show chaining
   - Document execution order algorithm
   - Add dependency resolution details

5. **`README.md`** (project root)
   - Update features list to mention chaining
   - Add one-line example in quick start

### Example Documentation Snippet

```markdown
## Transformation Chaining

### Overview

Transformations can be chained together to create sequential processing pipelines. Each transform in a chain operates on the output of the previous transform, enabling complex multi-stage data processing.

### Configuration

Add `input_source` to any transformation to chain from a previous transform:

```yaml
transformations:
  - type: unit_conversion
    conversion: "f_to_c"
    key: "celsius"              # Step 1

  - type: scale
    input_source: "celsius"     # Chain from step 1
    input_range: [-10, 40]
    output_range: [0, 100]
    key: "percent"              # Step 2

  - type: smooth
    input_source: "percent"     # Chain from step 2
    method: "exponential"
    alpha: 0.3
    key: "final"                # Step 3
```

### Best Practices

1. **Name your keys clearly** - Helps track data flow
2. **Keep chains short** - 3-5 steps is typical
3. **Mix parallel and chained** - Not everything needs to chain
4. **Validate early** - Put unit conversions first
5. **Smooth last** - Smoothing usually goes at the end

### Common Patterns

**Unit → Scale → Smooth**
```yaml
- type: unit_conversion
  key: "converted"
- type: scale
  input_source: "converted"
  key: "scaled"
- type: smooth
  input_source: "scaled"
  key: "final"
```

**Parallel branches**
```yaml
- type: unit_conversion
  key: "celsius"              # Base conversion
- type: smooth
  input_source: "celsius"
  key: "smoothed"             # Branch 1
- type: scale
  input_source: "celsius"
  key: "percent"              # Branch 2
```
```
```

---

## Implementation Checklist

### Phase 1: Core Implementation (2-3 hours)

- [ ] Update `TransformationProcessor` base class to store `input_source`
- [ ] Implement `_determineTransformationOrder()` with topological sort
- [ ] Update `_applyTransformations()` to use execution order
- [ ] Add input validation and error handling
- [ ] Update `_processHistoricalTransformations()` for chaining
- [ ] Add execution order caching optimization

### Phase 2: Testing (1-2 hours)

- [ ] Write unit tests for topological sort
- [ ] Write unit tests for error cases (circular deps, missing sources)
- [ ] Write integration tests for historical processing
- [ ] Write integration tests for state change handling
- [ ] Manual testing with example configs
- [ ] Performance testing with large configs

### Phase 3: Documentation (1-2 hours)

- [ ] Update schema documentation
- [ ] Add chaining guide to user docs
- [ ] Create 5+ example configurations
- [ ] Update architecture diagrams
- [ ] Add troubleshooting section
- [ ] Update CHANGELOG.md

### Phase 4: Polish (0.5-1 hour)

- [ ] Add debug logging for execution order
- [ ] Improve error messages with suggestions
- [ ] Add config validation at initialization
- [ ] Create migration guide for existing users
- [ ] Update type definitions (if using TypeScript)

---

## Success Criteria

✅ **Functional**
- Chained transforms execute in correct order
- Circular dependencies detected and handled
- Missing sources validated with clear errors
- Backward compatibility maintained 100%

✅ **Performance**
- <0.1ms overhead per transformation update
- No memory leaks in long-running instances
- Historical processing completes in <100ms for typical configs

✅ **Usability**
- Clear documentation with examples
- Intuitive error messages
- Works with existing overlay/rule syntax
- Easy to debug with logging

✅ **Quality**
- 90%+ test coverage
- All edge cases handled
- JSDoc on all new methods
- Code review approved

---

## Future Enhancements

### Phase 2 (Future)

1. **Visual Config Builder**
   - Drag-and-drop transformation pipeline editor
   - Visual dependency graph
   - Live preview of transform results

2. **Advanced Chaining Features**
   - Multiple inputs: `input_sources: ["a", "b"]`
   - Conditional chaining: `input_source_condition: "value > 0"`
   - Dynamic source selection: `input_source: "${some_variable}"`

3. **Performance Optimizations**
   - WebWorker-based processing for heavy chains
   - Incremental computation (only recompute changed branches)
   - Memoization of expensive transforms

4. **Debug Tools**
   - Transformation pipeline visualizer
   - Live performance profiler
   - Historical replay/debugging

---

## Questions for Review

1. **Naming:** Is `input_source` the right parameter name? Alternatives:
   - `chain_from`
   - `depends_on`
   - `input_key`
   - `source_transform`

2. **Scope:** Should aggregations also support chaining from transforms?
   ```yaml
   aggregations:
     trend:
       type: recent_trend
       input_source: "smoothed"  # Track trend of smoothed value
   ```

3. **Validation:** Should we validate chains at config load time or runtime?
   - Config load: Fail fast, but more complex setup
   - Runtime: More flexible, better error recovery

4. **Expression Transforms:** Should expressions have a helper to access other transforms?
   ```javascript
   expression: "value + getTransform('other_key')"
   ```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing configs | Low | High | Thorough testing, default to parallel mode |
| Circular dependency bugs | Medium | Medium | Comprehensive validation, clear error messages |
| Performance regression | Low | Medium | Caching, benchmarking, profiling |
| User confusion | Medium | Low | Clear docs, good examples, helpful errors |
| Complex debugging | Medium | Medium | Enhanced logging, debug visualizations |

---

## Approval & Sign-off

**Proposed by:** Copilot AI Assistant
**Date:** 2025-10-14

**Review Checklist:**
- [ ] Technical approach validated
- [ ] Performance impact acceptable
- [ ] Documentation plan approved
- [ ] Testing strategy sufficient
- [ ] Breaking changes identified (none expected)
- [ ] Timeline realistic (4-6 hours)

**Approved by:** _______________
**Date:** _______________

---

## References

- Current implementation: `src/msd/data/MsdDataSource.js`
- Transformation processors: `src/msd/data/transformations/TransformationProcessor.js`
- User documentation: `doc/user/datasource_complete_documentation.md`
- Topological sort algorithm: [Kahn's Algorithm](https://en.wikipedia.org/wiki/Topological_sorting#Kahn's_algorithm)