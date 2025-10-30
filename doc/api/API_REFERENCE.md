# CB-LCARS Debug API Reference

**Version:** 4.0 (Phase 4 Complete)
**Date:** October 30, 2025
**Status:** ✅ Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [API Access](#api-access)
3. [Core Utilities](#core-utilities)
4. [Debug Namespaces](#debug-namespaces)
5. [Backward Compatibility](#backward-compatibility)
6. [Future Enhancements](#future-enhancements)
7. [Migration Guide](#migration-guide)

---

## Overview

The CB-LCARS Debug API provides comprehensive runtime inspection and debugging capabilities for MSD (Master Systems Display) components. All functionality is accessible through the unified `window.cblcars.debug.msd` namespace.

**Current Status:**
- ✅ **71/71 API entries present** (0 missing)
- ✅ **11 debug namespaces** fully functional
- ✅ **16 deprecated methods** maintained for backward compatibility
- ✅ **7 placeholder methods** documented for future enhancement (Phase 5)

---

## API Access

### Primary Interface

```javascript
// Access the unified debug API
const msd = window.cblcars.debug.msd;

// Quick health check
msd.audit();  // Returns status of all API methods
```

### Testing API Availability

```javascript
// Audit all API methods
const audit = window.cblcars.debug.msd.audit();
console.log(`API Status: ${audit.present}/${audit.expected} present`);
console.log('Missing:', audit.missing);
console.log('Placeholders:', audit.placeholders);
console.log('Deprecated:', audit.deprecated);
```

---

## Core Utilities

### `version()`

Returns the MSD API version information.

```javascript
const v = msd.version();
console.log(`MSD API v${v.version} (${v.phase})`);
```

**Returns:**
```javascript
{
  version: "4.0",
  phase: "Phase 4 Complete",
  status: "production"
}
```

---

### `audit()`

Audits the completeness of the debug API.

```javascript
const audit = msd.audit();
```

**Returns:**
```javascript
{
  present: 71,          // All expected entries
  missing: [],          // Array of missing method paths
  unexpected: [],       // Array of unexpected entries
  deprecated: 16,       // Count of deprecated methods
  placeholders: 7,      // Count of Phase 5 placeholders
  errors: []           // Any errors encountered
}
```

**Example Output:**
```javascript
{
  present: 71,
  missing: [],
  unexpected: [],
  deprecated: 16,
  placeholders: 7,
  errors: [],
  details: {
    core: 7,           // Core utilities
    namespaces: 11,    // Debug namespaces
    deprecated: 16,    // Legacy methods
    placeholders: 7    // Phase 5 features
  }
}
```

---

### `help([topic])`

Displays help information.

```javascript
// General help
msd.help();

// Topic-specific help
msd.help('performance');
msd.help('routing');
```

---

### `usage([namespace])`

Shows usage examples for API methods.

```javascript
// All examples
msd.usage();

// Namespace-specific examples
msd.usage('perf');
msd.usage('routing');
```

---

### `hud`

Access to HUD panel debugging.

```javascript
// Get HUD panel information
const hudInfo = msd.hud.info();

// Get HUD panel state
const hudState = msd.hud.state();
```

---

### `controls`

Access to control debugging.

```javascript
// Get control information
const controlInfo = msd.controls.info();

// Get control state
const controlState = msd.controls.state();
```

---

## Debug Namespaces

### Performance (`perf`)

Performance monitoring and profiling tools.

#### `perf.getAll()`

Returns all performance metrics.

```javascript
const metrics = msd.perf.getAll();
console.log('Render time:', metrics.render);
console.log('Layout time:', metrics.layout);
```

#### `perf.stats()`

Returns performance statistics summary.

```javascript
const stats = msd.perf.stats();
console.log(`Average render: ${stats.render.avg}ms`);
console.log(`Peak render: ${stats.render.peak}ms`);
```

#### `perf.reset()`

Resets performance metrics.

```javascript
msd.perf.reset();
console.log('Performance metrics reset');
```

#### `perf.compare(baseline)` 🚧

**Status:** Phase 5 placeholder
**Planned:** A/B performance comparison between configurations.

```javascript
// Future usage
const comparison = msd.perf.compare('baseline-config');
```

---

### Routing (`routing`)

Data routing inspection and debugging.

#### `routing.inspect()`

Inspects current routing configuration.

```javascript
const routes = msd.routing.inspect();
console.log('Active routes:', routes.length);
routes.forEach(route => {
  console.log(`${route.source} → ${route.target}`);
});
```

#### `routing.stats()`

Returns routing statistics.

```javascript
const stats = msd.routing.stats();
console.log('Total routes:', stats.total);
console.log('Active routes:', stats.active);
console.log('Failed routes:', stats.failed);
```

#### `routing.visualize(overlayId)` 🚧

**Status:** Phase 5 placeholder
**Planned:** Visual overlay of routing paths on MSD SVG.

```javascript
// Future usage
msd.routing.visualize('route-overlay-1');
```

---

### Data (`data`)

Entity data access and inspection.

#### `data.entities()`

Returns all tracked entity data.

```javascript
const entities = msd.data.entities();
console.log('Tracked entities:', Object.keys(entities).length);
```

#### `data.state()`

Returns current data state snapshot.

```javascript
const state = msd.data.state();
console.log('Current state:', state);
```

#### `data.history(entityId, n)` 🚧

**Status:** Phase 5 placeholder
**Planned:** Entity state history tracking.

```javascript
// Future usage
const history = msd.data.history('sensor.temperature', 10);
```

**Note:** Home Assistant already provides this via History panel and Logbook.

---

### Styles (`styles`)

Style and theme debugging.

#### `styles.current()`

Returns currently applied styles.

```javascript
const styles = msd.styles.current();
console.log('Active theme:', styles.theme);
console.log('Custom styles:', styles.custom);
```

#### `styles.inspect(selector)`

Inspects computed styles for elements.

```javascript
const cellStyles = msd.styles.inspect('.msd-cell');
console.log('Cell styles:', cellStyles);
```

---

### Charts (`charts`)

Chart debugging and inspection.

#### `charts.list()`

Lists all charts in the MSD.

```javascript
const charts = msd.charts.list();
console.log('Charts:', charts);
```

#### `charts.inspect(chartId)`

Inspects specific chart configuration.

```javascript
const config = msd.charts.inspect('chart-1');
console.log('Chart config:', config);
```

#### `charts.listTypes()`

Lists supported chart types.

```javascript
const types = msd.charts.listTypes();
console.log('Supported types:', types);
// ['line', 'area', 'bar', 'scatter', 'heatmap', 'candlestick',
//  'boxplot', 'radar', 'radialBar', 'pie', 'donut', 'polarArea']
```

---

### Rules (`rules`)

Rules engine debugging.

#### `rules.trace()`

Returns rules execution trace.

```javascript
const trace = msd.rules.trace();
console.log('Rules evaluated:', trace.evaluated);
console.log('Rules fired:', trace.fired);
console.log('Actions taken:', trace.actions);
```

#### `rules.listActive([options])`

Lists active/enabled rules.

```javascript
// Get only enabled rules
const active = msd.rules.listActive();

// Get all rules including disabled
const all = msd.rules.listActive({ includeDisabled: true });

// Get detailed rule information
const detailed = msd.rules.listActive({ verbose: true });
```

**Returns (compact mode):**
```javascript
[
  {
    id: "rule_1",
    enabled: true,
    conditions: 2,
    actions: 1,
    description: "Alert rule for temperature"
  }
]
```

**Returns (verbose mode):**
```javascript
[
  {
    id: "rule_1",
    enabled: true,
    conditions: [
      { entity: "sensor.temp", operator: ">", value: 75 }
    ],
    actions: [
      { type: "notification", message: "High temp!" }
    ],
    description: "Alert rule for temperature"
  }
]
```

#### `rules.evaluate(ruleId)` 🚧

**Status:** Phase 5 placeholder
**Planned:** Test rule evaluation against current state.

```javascript
// Future usage
const result = msd.rules.evaluate('rule_1');
```

#### `rules.debugRule(ruleId, state)` 🚧

**Status:** Phase 5 placeholder
**Planned:** Step-through rule debugging with test state.

```javascript
// Future usage
const debug = msd.rules.debugRule('rule_1', mockState);
```

---

### Animations (`animations`)

Animation system debugging.

#### `animations.active()`

Returns currently active animations.

```javascript
const active = msd.animations.active();
console.log('Running animations:', active.length);
```

#### `animations.list()`

Lists all registered animations.

```javascript
const all = msd.animations.list();
console.log('Registered animations:', all.length);
```

#### `animations.trigger(animId)` 🚧

**Status:** Phase 5 placeholder
**Planned:** Manual animation triggering for testing.

```javascript
// Future usage
msd.animations.trigger('pulse-animation');
```

---

### Packs (`packs`)

Configuration pack debugging.

#### `packs.list()`

Lists all loaded configuration packs.

```javascript
const packs = msd.packs.list();
console.log('Loaded packs:', packs);
```

#### `packs.inspect(packId)`

Inspects specific pack configuration.

```javascript
const pack = msd.packs.inspect('classic');
console.log('Pack config:', pack);
```

#### `packs.order()` 🚧

**Status:** Phase 5 placeholder
**Planned:** Show pack loading order and configuration provenance.

```javascript
// Future usage
const order = msd.packs.order();
console.log('Pack merge order:', order);
```

---

### Visual (`visual`)

Visual debugging and inspection.

#### `visual.inspect()`

Inspects visual elements and rendering.

```javascript
const visual = msd.visual.inspect();
console.log('SVG elements:', visual.svgElements);
console.log('Render tree:', visual.renderTree);
```

#### `visual.stats()`

Returns visual rendering statistics.

```javascript
const stats = msd.visual.stats();
console.log('DOM nodes:', stats.domNodes);
console.log('SVG complexity:', stats.svgComplexity);
```

---

### Overlays (`overlays`)

Overlay system debugging.

#### `overlays.list()`

Lists all active overlays.

```javascript
const overlays = msd.overlays.list();
console.log('Active overlays:', overlays);
```

#### `overlays.inspect(overlayId)`

Inspects specific overlay.

```javascript
const overlay = msd.overlays.inspect('status-overlay');
console.log('Overlay config:', overlay);
```

---

### Pipeline (`pipeline`)

MSD processing pipeline debugging.

#### `pipeline.status()`

Returns pipeline status.

```javascript
const status = msd.pipeline.status();
console.log('Pipeline state:', status.state);
console.log('Processing time:', status.processingTime);
```

#### `pipeline.inspect()`

Inspects pipeline configuration and state.

```javascript
const pipeline = msd.pipeline.inspect();
console.log('Stages:', pipeline.stages);
console.log('Current stage:', pipeline.currentStage);
```

#### `pipeline.stats()`

Returns pipeline performance statistics.

```javascript
const stats = msd.pipeline.stats();
console.log('Total processed:', stats.totalProcessed);
console.log('Average time:', stats.averageTime);
```

---

## Backward Compatibility

CB-LCARS maintains 16 deprecated methods for backward compatibility. These methods still work but display deprecation warnings.

### Deprecated Methods (Use Modern Equivalents)

| Deprecated | Modern Equivalent | Status |
|------------|-------------------|--------|
| `perfGetAll()` | `perf.getAll()` | ⚠️ Deprecated |
| `perfStats()` | `perf.stats()` | ⚠️ Deprecated |
| `perfReset()` | `perf.reset()` | ⚠️ Deprecated |
| `routingInspect()` | `routing.inspect()` | ⚠️ Deprecated |
| `routingStats()` | `routing.stats()` | ⚠️ Deprecated |
| `dataEntities()` | `data.entities()` | ⚠️ Deprecated |
| `dataState()` | `data.state()` | ⚠️ Deprecated |
| `stylesCurrent()` | `styles.current()` | ⚠️ Deprecated |
| `stylesInspect()` | `styles.inspect()` | ⚠️ Deprecated |
| `chartsList()` | `charts.list()` | ⚠️ Deprecated |
| `chartsInspect()` | `charts.inspect()` | ⚠️ Deprecated |
| `rulesTrace()` | `rules.trace()` | ⚠️ Deprecated |
| `animationsActive()` | `animations.active()` | ⚠️ Deprecated |
| `animationsList()` | `animations.list()` | ⚠️ Deprecated |
| `packsList()` | `packs.list()` | ⚠️ Deprecated |
| `packsInspect()` | `packs.inspect()` | ⚠️ Deprecated |

**Example Deprecation Warning:**

```javascript
// Using deprecated method
msd.perfGetAll();
// ⚠️ Console warning: "[MSD API] perfGetAll() is deprecated - use perf.getAll() instead"
```

---

## Future Enhancements

The following features are planned for Phase 5 but not yet implemented. They return `NOT_IMPLEMENTED` responses with helpful messages.

### Phase 5 Placeholders (7 features)

| Method | Status | Description |
|--------|--------|-------------|
| `perf.compare()` | 🚧 Planned | A/B performance comparison |
| `routing.visualize()` | 🚧 Planned | Visual routing overlay on MSD |
| `data.history()` | 🚧 Planned | Entity state history tracking |
| `rules.evaluate()` | 🚧 Planned | Test rule evaluation |
| `rules.debugRule()` | 🚧 Planned | Step-through rule debugging |
| `animations.trigger()` | 🚧 Planned | Manual animation triggering |
| `packs.order()` | 🚧 Planned | Pack loading order display |

**See:** [PHASE_5_ANALYSIS.md](PHASE_5_ANALYSIS.md) for value vs effort analysis.

---

## Migration Guide

### Migrating from Legacy API

**Phase 1-3 → Phase 4 Migration:**

```javascript
// OLD (Phase 1-3)
window.__msdDebug.perfGetAll();
window.__msdDebug.routingInspect();

// NEW (Phase 4)
window.cblcars.debug.msd.perf.getAll();
window.cblcars.debug.msd.routing.inspect();
```

### Migration Steps

1. **Search and Replace:**
   ```bash
   # Find old API usage
   grep -r "__msdDebug\." src/

   # Replace with modern API
   # __msdDebug.perfGetAll() → window.cblcars.debug.msd.perf.getAll()
   ```

2. **Test Compatibility:**
   ```javascript
   // Run audit to verify
   const audit = window.cblcars.debug.msd.audit();
   console.assert(audit.missing.length === 0, 'All APIs present');
   ```

3. **Update Documentation:**
   - Replace old API references in code comments
   - Update README examples
   - Update user guides

**Note:** Legacy methods still work with deprecation warnings, providing a safe migration path.

---

## Quick Reference

### Common Workflows

**Performance Debugging:**
```javascript
// Get all performance metrics
const perf = msd.perf.getAll();

// Get statistics
const stats = msd.perf.stats();

// Reset metrics for new test
msd.perf.reset();
```

**Routing Debugging:**
```javascript
// Inspect routes
const routes = msd.routing.inspect();

// Get routing stats
const stats = msd.routing.stats();
```

**Rules Debugging:**
```javascript
// Get rules trace
const trace = msd.rules.trace();

// List active rules
const active = msd.rules.listActive();

// Get detailed rule info
const detailed = msd.rules.listActive({ verbose: true });
```

**System Health Check:**
```javascript
// Complete API audit
const audit = msd.audit();

// Check version
const version = msd.version();

// Get help
msd.help();
```

---

## Support

- **GitHub Issues:** [snootched/cb-lcars](https://github.com/snootched/cb-lcars/issues)
- **Documentation:** `/doc/api/` directory
- **Examples:** `/doc/examples/` directory

---

## Version History

- **v4.0** (Phase 4) - October 30, 2025
  - ✅ 71/71 API entries complete
  - ✅ Unified namespace structure
  - ✅ Backward compatibility maintained
  - ✅ Enhanced `rules.listActive()` with filtering
  - ✅ 7 Phase 5 placeholders documented

- **v3.0** (Phase 3) - October 29, 2025
  - Namespace migration
  - Internal property standardization

- **v2.0** (Phase 2) - October 29, 2025
  - API standardization
  - Deprecation warnings

- **v1.0** (Phase 1) - Legacy
  - Initial debug API

---

**Last Updated:** October 30, 2025
**Status:** ✅ Production Ready
**API Completeness:** 71/71 (100%)
