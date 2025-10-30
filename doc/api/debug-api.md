# CB-LCARS Debug API Documentation

**Version:** 2025.10.1-msd.17-69
**Phase:** 1 - Core Debug Functionality COMPLETE
**Namespace:** `window.cblcars.debug.msd`

## Overview

The Debug API provides comprehensive introspection and debugging tools for CB-LCARS MSD developers. It exposes internal state, performance metrics, routing details, data sources, styles, charts, rules, animations, and configuration packs.

All Debug API methods delegate to existing, battle-tested DebugInterface methods, ensuring reliability and consistency.

---

## Table of Contents

1. [Performance Introspection](#performance-introspection)
2. [Routing Introspection](#routing-introspection)
3. [Data Source Introspection](#data-source-introspection)
4. [Style Introspection](#style-introspection)
5. [Chart Validation](#chart-validation)
6. [Rules Engine](#rules-engine)
7. [Animations](#animations)
8. [Configuration Packs](#configuration-packs)

---

## Performance Introspection

**Namespace:** `window.cblcars.debug.msd.perf`

Monitor render performance, identify bottlenecks, and analyze overlay rendering times.

### Methods

#### `perf.summary()`
Get comprehensive performance summary from last render.

**Returns:** `Object|null` - Performance summary with stage breakdowns

**Example:**
```javascript
const perf = window.cblcars.debug.msd.perf.summary();
console.log('Total render time:', perf.total_render_time_ms, 'ms');
console.log('Overlays:', perf.overlay_count);
console.log('Slowest:', perf.slowest_overlays);
```

**Return Structure:**
```javascript
{
  total_render_time_ms: 45.2,
  overlay_count: 23,
  stages: {
    preparation: { duration_ms: 5.1, percentage: 11.3 },
    overlay_rendering: { duration_ms: 35.6, percentage: 78.8 },
    dom_injection: { duration_ms: 3.2, percentage: 7.1 },
    action_attachment: { duration_ms: 1.3, percentage: 2.9 }
  },
  slowest_overlays: [
    { overlay_id: 'status_grid_1', duration_ms: 12.4, percentage: 27.4 },
    // ...
  ]
}
```

---

#### `perf.slowestOverlays(n)`
Get N slowest rendering overlays.

**Parameters:**
- `n` (number, default: 5) - Number of slowest overlays to return

**Returns:** `Array|null` - Slowest overlay performance data

**Example:**
```javascript
const slowest = window.cblcars.debug.msd.perf.slowestOverlays(10);
slowest.forEach(ov => {
  console.log(`${ov.overlay_id}: ${ov.duration_ms}ms (${ov.percentage}%)`);
});
```

---

#### `perf.byRenderer()`
Get performance breakdown by overlay type/renderer.

**Returns:** `Object|null` - Performance data grouped by renderer type

**Example:**
```javascript
const byType = window.cblcars.debug.msd.perf.byRenderer();
console.log('Status grids:', byType.status_grid);
console.log('Text overlays:', byType.text);
```

**Return Structure:**
```javascript
{
  status_grid: { count: 5, total_ms: 18.5, avg_ms: 3.7 },
  text: { count: 12, total_ms: 8.2, avg_ms: 0.68 },
  button: { count: 6, total_ms: 4.1, avg_ms: 0.68 },
  // ...
}
```

---

#### `perf.byOverlay(overlayId)`
Get performance data for a specific overlay.

**Parameters:**
- `overlayId` (string) - Overlay ID to inspect

**Returns:** `Object|null` - Performance data for the overlay

**Example:**
```javascript
const perf = window.cblcars.debug.msd.perf.byOverlay('title_overlay');
console.log('Duration:', perf.duration_ms, 'ms');
console.log('Percentage:', perf.percentage_of_total, '%');
```

---

#### `perf.warnings()`
Get performance warnings for slow overlays.

**Returns:** `Object|null` - Performance warnings with details

**Example:**
```javascript
const warnings = window.cblcars.debug.msd.perf.warnings();
if (warnings.has_warnings) {
  console.log('Warnings:', warnings.count);
  warnings.warnings.forEach(w => console.warn(w.message, w.overlay_id));
}
```

---

#### `perf.timeline()`
Get render timeline with stage-by-stage breakdown.

**Returns:** `Object|null` - Timeline of render stages

**Example:**
```javascript
const timeline = window.cblcars.debug.msd.perf.timeline();
console.log('Stages:', timeline.stages);
timeline.stages.forEach(stage => {
  console.log(`${stage.name}: ${stage.duration_ms}ms`);
});
```

---

## Routing Introspection

**Namespace:** `window.cblcars.debug.msd.routing`

Inspect data routing paths, cache performance, and entity-to-overlay bindings.

### Methods

#### `routing.inspect(overlayId)`
Inspect routing resolution for an overlay.

**Parameters:**
- `overlayId` (string) - Overlay ID to inspect

**Returns:** `Object|null` - Routing inspection data

**Example:**
```javascript
const routing = window.cblcars.debug.msd.routing.inspect('button_1');
console.log('Route mode:', routing.route_mode);
console.log('Paths:', routing.paths);
console.log('Entities:', routing.entities);
```

---

#### `routing.stats()`
Get routing statistics.

**Returns:** `Object|null` - Routing statistics

**Example:**
```javascript
const stats = window.cblcars.debug.msd.routing.stats();
console.log('Cache hits:', stats.cacheHits);
console.log('Paths computed:', stats.pathsComputed);
console.log('Invalidations:', stats.invalidations);
```

---

#### `routing.invalidate(id)`
Invalidate routing cache.

**Parameters:**
- `id` (string, default: '*') - Overlay ID or '*' for all

**Returns:** `boolean` - Success status

**Example:**
```javascript
// Invalidate all routing
window.cblcars.debug.msd.routing.invalidate();

// Invalidate specific overlay
window.cblcars.debug.msd.routing.invalidate('button_1');
```

---

#### `routing.inspectAs(overlayId, mode)`
Inspect overlay routing with different mode.

**Parameters:**
- `overlayId` (string) - Overlay ID to inspect
- `mode` (string, default: 'smart') - Route mode ('smart', 'full', 'minimal')

**Returns:** `Object|null` - Routing inspection with tested mode

**Example:**
```javascript
const routing = window.cblcars.debug.msd.routing.inspectAs('button_1', 'full');
console.log('Full mode routing:', routing);
```

---

## Data Source Introspection

**Namespace:** `window.cblcars.debug.msd.data`

Inspect data sources, entities, and data flow through the system.

### Methods

#### `data.stats()`
Get data source statistics.

**Returns:** `Object|null` - Data source statistics

**Example:**
```javascript
const stats = window.cblcars.debug.msd.data.stats();
console.log('Sources:', stats.sources);
console.log('Total entities:', stats.totalEntities);
```

---

#### `data.list()`
List all data source names.

**Returns:** `Array<string>` - Array of data source names

**Example:**
```javascript
const sources = window.cblcars.debug.msd.data.list();
console.log('Available sources:', sources); // ['hass', 'manual', 'computed']
```

---

#### `data.get(sourceName)`
Get data source details by name.

**Parameters:**
- `sourceName` (string) - Data source name

**Returns:** `Object|null` - Data source details

**Example:**
```javascript
const hass = window.cblcars.debug.msd.data.get('hass');
console.log('HASS entities:', hass.entityCount);
console.log('Cache hits:', hass.cacheHits);
```

---

#### `data.dump()`
Dump all data source information.

**Returns:** `Object|null` - Complete data source dump

**Example:**
```javascript
const dump = window.cblcars.debug.msd.data.dump();
console.log('Full data dump:', dump);
```

---

#### `data.trace(entityId)`
Trace entity usage across overlays.

**Parameters:**
- `entityId` (string) - Entity ID to trace

**Returns:** `Object|null` - Entity trace data

**Example:**
```javascript
const trace = window.cblcars.debug.msd.data.trace('sensor.temperature');
console.log('Entity found:', trace.found);
console.log('Used by overlays:', trace.usedByOverlays);
trace.usedByOverlays.forEach(ov => {
  console.log(`  ${ov.id} (${ov.type})`);
});
```

---

## Style Introspection

**Namespace:** `window.cblcars.debug.msd.styles`

Inspect style resolution, theme tokens, and CSS provenance.

### Methods

#### `styles.resolutions(overlayId)`
Get style resolution details for an overlay.

**Parameters:**
- `overlayId` (string) - Overlay ID

**Returns:** `Object|null` - Style resolution data

**Example:**
```javascript
const styles = window.cblcars.debug.msd.styles.resolutions('button_1');
console.log('Total properties:', styles.total);
console.log('By source:', styles.by_source);
console.table(styles.properties);
```

**Return Structure:**
```javascript
{
  total: 15,
  by_source: {
    theme: 8,
    overlay: 5,
    defaults: 2
  },
  properties: [
    { property: 'fill', source: 'theme', token: 'colors.primary', value: '#ff9c00' },
    { property: 'font-size', source: 'overlay', value: '14px' },
    // ...
  ]
}
```

---

#### `styles.findByToken(tokenPath)`
Find overlays using a specific theme token.

**Parameters:**
- `tokenPath` (string) - Token path (e.g., 'colors.primary')

**Returns:** `Array|null` - Overlays using this token

**Example:**
```javascript
const overlays = window.cblcars.debug.msd.styles.findByToken('colors.primary');
overlays.forEach(ov => {
  console.log(`${ov.overlayId} uses token in:`, ov.properties);
});
```

---

#### `styles.provenance()`
Get global style resolution summary.

**Returns:** `Object|null` - Global style summary

**Example:**
```javascript
const summary = window.cblcars.debug.msd.styles.provenance();
console.log('Total overlays:', summary.total_overlays);
console.log('Total resolutions:', summary.total_resolutions);
console.log('By source:', summary.by_source);
console.table(summary.by_renderer);
```

---

#### `styles.listTokens()`
List all theme tokens.

**Returns:** `Array|null` - Theme tokens with paths and values

**Example:**
```javascript
const tokens = window.cblcars.debug.msd.styles.listTokens();
tokens.forEach(token => {
  console.log(`${token.path}: ${token.value}`);
});
```

---

#### `styles.getTokenValue(tokenPath)`
Get resolved value for a theme token.

**Parameters:**
- `tokenPath` (string) - Token path (e.g., 'colors.primary')

**Returns:** `*` - Token value

**Example:**
```javascript
const color = window.cblcars.debug.msd.styles.getTokenValue('colors.primary');
console.log('Primary color:', color); // '#ff9c00'
```

---

## Chart Validation

**Namespace:** `window.cblcars.debug.msd.charts`

Validate ApexChart data formats and configurations.

### Methods

#### `charts.validate(overlayId)`
Validate a specific chart overlay.

**Parameters:**
- `overlayId` (string) - Chart overlay ID

**Returns:** `Object|null` - Validation result with errors/warnings

**Example:**
```javascript
const result = window.cblcars.debug.msd.charts.validate('chart_1');
console.log('Valid:', result.valid);
if (!result.valid) {
  result.errors.forEach(err => {
    console.error(err.message);
    console.log('  Fix:', err.suggestion);
    console.log('  Example:', err.example);
  });
}
```

---

#### `charts.validateAll()`
Validate all chart overlays.

**Returns:** `Object|null` - Validation summary

**Example:**
```javascript
const summary = window.cblcars.debug.msd.charts.validateAll();
console.log(`Valid: ${summary.validCount}, Invalid: ${summary.invalidCount}`);
summary.results.forEach(result => {
  console.log(`${result.overlayId}: ${result.valid ? '✅' : '❌'}`);
});
```

---

#### `charts.getFormatSpec(chartType)`
Get format specification for chart type.

**Parameters:**
- `chartType` (string) - Chart type (e.g., 'line', 'area', 'bar')

**Returns:** `Object|null` - Format specification

**Example:**
```javascript
const spec = window.cblcars.debug.msd.charts.getFormatSpec('line');
console.log('Required format:', spec.format);
console.log('Example:', spec.example);
```

---

#### `charts.listTypes()`
List supported chart types.

**Returns:** `Array<string>` - Chart types

**Example:**
```javascript
const types = window.cblcars.debug.msd.charts.listTypes();
console.log('Supported types:', types);
// ['line', 'area', 'bar', 'scatter', 'heatmap', ...]
```

---

## Rules Engine

**Namespace:** `window.cblcars.debug.msd.rules`

Debug rules evaluation and execution.

### Methods

#### `rules.trace()`
Get rules execution trace.

**Returns:** `Object|null` - Rules trace data

**Example:**
```javascript
const trace = window.cblcars.debug.msd.rules.trace();
console.log('Rules evaluated:', trace.evaluated);
console.log('Rules fired:', trace.fired);
trace.fired.forEach(rule => {
  console.log(`Rule ${rule.id}: ${rule.action}`);
});
```

---

#### `rules.listActive()`
List active rules.

**Returns:** `Array` - Active rules

**Example:**
```javascript
const active = window.cblcars.debug.msd.rules.listActive();
console.log('Active rules:', active.length);
active.forEach(rule => {
  console.log(`${rule.id}: ${rule.condition}`);
});
```

---

## Animations

**Namespace:** `window.cblcars.debug.msd.animations`

Debug animation system and timelines.

### Methods

#### `animations.active()`
Get active animations.

**Returns:** `Array|null` - Active animations

**Example:**
```javascript
const active = window.cblcars.debug.msd.animations.active();
active.forEach(anim => {
  console.log(`${anim.id}: ${anim.state} (${anim.progress}%)`);
});
```

---

#### `animations.dump()`
Dump animation registry.

**Returns:** `Object|null` - Animation registry dump

**Example:**
```javascript
const dump = window.cblcars.debug.msd.animations.dump();
console.log('Registered animations:', dump);
```

---

#### `animations.timeline(timelineId)`
Get timeline details.

**Parameters:**
- `timelineId` (string) - Timeline ID

**Returns:** `Object|null` - Timeline details

**Example:**
```javascript
const timeline = window.cblcars.debug.msd.animations.timeline('tl_1');
console.log('Timeline:', timeline.id);
console.log('Animations:', timeline.animations);
```

---

## Configuration Packs

**Namespace:** `window.cblcars.debug.msd.packs`

Inspect configuration packs (animations, overlays, rules, profiles, timelines).

### Methods

#### `packs.list(type)`
List packs by type or get counts.

**Parameters:**
- `type` (string, optional) - Pack type or omit for counts

**Returns:** `Object|Array` - Pack counts or specific pack list

**Example:**
```javascript
// Get counts
const counts = window.cblcars.debug.msd.packs.list();
console.log('Overlays:', counts.overlays);
console.log('Rules:', counts.rules);
console.log('Animations:', counts.animations);

// Get specific type
const overlays = window.cblcars.debug.msd.packs.list('overlays');
overlays.forEach(ov => console.log(ov.id, ov.type));
```

---

#### `packs.get(type, id)`
Get specific pack item.

**Parameters:**
- `type` (string) - Pack type (e.g., 'overlays', 'rules')
- `id` (string) - Item ID

**Returns:** `Object|null` - Pack item

**Example:**
```javascript
const overlay = window.cblcars.debug.msd.packs.get('overlays', 'button_1');
console.log('Overlay config:', overlay);
```

---

#### `packs.issues()`
Get configuration issues.

**Returns:** `Array|null` - Configuration issues

**Example:**
```javascript
const issues = window.cblcars.debug.msd.packs.issues();
if (issues && issues.length > 0) {
  console.error('Configuration issues found:');
  issues.forEach(issue => console.error(issue.message));
}
```

---

## Common Patterns

### Error Handling
All methods return `null` when unavailable or on error. Check return values:

```javascript
const perf = window.cblcars.debug.msd.perf.summary();
if (!perf) {
  console.warn('Performance data not available (MSD not rendered yet?)');
  return;
}
```

### Chaining Analysis
Combine methods for comprehensive debugging:

```javascript
// Performance bottleneck analysis
const slowest = window.cblcars.debug.msd.perf.slowestOverlays(5);
slowest.forEach(ov => {
  const routing = window.cblcars.debug.msd.routing.inspect(ov.overlay_id);
  const styles = window.cblcars.debug.msd.styles.resolutions(ov.overlay_id);

  console.log(`\n${ov.overlay_id} (${ov.duration_ms}ms)`);
  console.log('  Entities:', routing.entities.length);
  console.log('  Styles:', styles.total);
});
```

### Data Flow Tracing
Trace entity from source to overlay:

```javascript
const entityId = 'sensor.temperature';
const trace = window.cblcars.debug.msd.data.trace(entityId);

if (trace.found) {
  console.log(`Entity ${entityId} used by:`);
  trace.usedByOverlays.forEach(ov => {
    const routing = window.cblcars.debug.msd.routing.inspect(ov.id);
    const perf = window.cblcars.debug.msd.perf.byOverlay(ov.id);

    console.log(`  ${ov.id}: ${perf.duration_ms}ms, ${routing.paths.length} paths`);
  });
}
```

---

## Architecture Notes

### Delegation Pattern
All Debug API methods delegate to existing `window.cblcars.debug.msd` methods:

```javascript
summary() {
  const dbg = window.cblcars.debug.msd;
  if (!dbg?.getPerformanceSummary) return null;
  return dbg.getPerformanceSummary();
}
```

This ensures:
- **Reliability:** Battle-tested existing code
- **Consistency:** Same behavior as legacy debug interface
- **Maintainability:** Single source of truth for debug logic

### Availability
Debug API availability depends on:
1. MSD instance rendered (creates `window.cblcars.debug.msd`)
2. Specific subsystems initialized (performance, routing, data, etc.)
3. Feature enabled (some features require debug mode)

### Performance
Debug operations are read-only and lightweight. Performance introspection queries cached provenance data, not live metrics.

---

## Next Steps (Phase 2+)

Future enhancements planned:
- Visual debug controls (enable/disable features)
- CLI features (history, autocomplete, interactive mode)
- Overlay introspection enhancements
- Pipeline introspection
- Real-time performance monitoring
- Animation triggering/control
- Rule evaluation testing

---

**Status:** Phase 1 Complete ✅
**Build:** v2025.10.1-msd.17-69
**Documentation:** Complete and comprehensive
