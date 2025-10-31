# CB-LCARS Logging Levels Guide

**Date**: October 31, 2025
**Purpose**: Define when to use each logging level to maintain clean, useful logs

## Logging Level Hierarchy

```
error  ← Critical failures that prevent functionality
warn   ← Potential issues, deprecated usage, missing optional data
info   ← User-visible operations, major state changes
debug  ← Troubleshooting user issues, data flow, business logic ← DEFAULT LEVEL
trace  ← Deep internals, verbose lifecycle, performance details
```

**Default Log Level**: `debug` (shows error, warn, info, debug - hides trace)

## How to Enable Trace Logging

In browser console:
```javascript
// Enable trace for maximum verbosity
cblcars.setGlobalLogLevel('trace')

// Or use shortcuts
cblcars.setGlobalLogLevel.trace()
cblcars.setGlobalLogLevel.debug()  // Back to normal
```

---

## When to Use Each Level

### ❌ `error` - Critical Failures

**Use for**: Operations that fail and prevent functionality from working

**Examples**:
```javascript
cblcarsLog.error('[MsdDataSource] Failed to fetch history data:', error);
cblcarsLog.error('[RulesEngine] Rule evaluation crashed:', error);
cblcarsLog.error('[ChartRenderer] ApexCharts initialization failed:', error);
```

**Criteria**:
- ✅ Exceptions/errors caught in try-catch
- ✅ Required resources not found
- ✅ Invalid data that prevents rendering
- ✅ API calls that fail
- ❌ Expected null/undefined checks
- ❌ Optional features not available

---

### ⚠️ `warn` - Potential Issues

**Use for**: Things that work but might cause problems or are deprecated

**Examples**:
```javascript
cblcarsLog.warn('[MsdConfig] Using deprecated config format, please update');
cblcarsLog.warn('[ControlOverlay] Entity not found, control will not function:', entityId);
cblcarsLog.warn('[RulesEngine] No rules defined, visibility logic will not run');
```

**Criteria**:
- ✅ Deprecated features still working
- ✅ Missing optional configuration
- ✅ Data quality issues (but not breaking)
- ✅ Performance concerns
- ❌ Normal validation failures
- ❌ Expected empty states

---

### ℹ️ `info` - User-Visible Operations

**Use for**: Major operations users might care about, summary messages

**Examples**:
```javascript
cblcarsLog.info('[CBLCARSMSDCard] MSD pipeline completed successfully');
cblcarsLog.info('[preloadSVGs] Preloaded 8 SVGs from /hacsfiles/cb-lcars/msd/');
cblcarsLog.info('[ChartTemplateRegistry] Registered 15 chart templates');
```

**Criteria**:
- ✅ Pipeline phase completions
- ✅ Resource loading summaries
- ✅ Feature initialization
- ✅ Major state changes
- ❌ Individual item processing
- ❌ Repeated operations

**Best Practice**: Use info for **summaries**, not details
```javascript
// ✅ GOOD - Summary
cblcarsLog.info(`[preloadSVGs] Loaded ${count} SVGs: ${names.join(', ')}`);

// ❌ BAD - Individual items (use trace instead)
svgs.forEach(svg => cblcarsLog.info(`[preloadSVGs] Loaded ${svg}`));
```

---

### 🐛 `debug` - Troubleshooting User Issues

**Use for**: Information needed to troubleshoot user problems with business logic

**Examples**:
```javascript
cblcarsLog.debug('[RulesEngine] Evaluated 5 rules, 2 matched:', matchedRules);
cblcarsLog.debug('[MsdDataSource] Entity state changed:', entityId, newState);
cblcarsLog.debug('[VisibilityEngine] Cell visibility changed:', cellId, isVisible);
cblcarsLog.debug('[ControlOverlay] Control value updated:', controlId, newValue);
```

**Criteria**:
- ✅ Business logic flow (rules, visibility, conditions)
- ✅ Data transformations results
- ✅ User-initiated actions
- ✅ State changes that affect rendering
- ✅ Configuration decisions
- ❌ Framework lifecycle (setConfig, requestUpdate)
- ❌ Individual loop iterations
- ❌ Internal method calls

**Think**: "Would this help a user debug why their card isn't working?"

---

### 🔬 `trace` - Deep Internals & Verbose Details

**Use for**: Low-level details, lifecycle, performance tracking, loop iterations

**Examples**:
```javascript
cblcarsLog.trace('[CBLCARSBaseCard.requestUpdate()] Called');
cblcarsLog.trace('[MsdTransforms] Processing cell:', cellIndex, cellData);
cblcarsLog.trace('[RulesEngine] Checking condition:', condition, value);
cblcarsLog.trace('[SVGController] Applying patch to element:', elementId);
cblcarsLog.trace('[CBLCARSBaseCard.constructor()] Resize observer fired');
```

**Criteria**:
- ✅ Framework lifecycle (constructor, setConfig, setHass, requestUpdate)
- ✅ Individual loop iterations
- ✅ Each item in a batch operation
- ✅ Performance timing details
- ✅ Internal method entry/exit
- ✅ Observer/callback firings
- ❌ High-level summaries
- ❌ User-actionable information

**Think**: "Would this be noise when debugging a user issue?"

---

## Migration Patterns

### Pattern 1: Lifecycle Methods → trace

**Before**:
```javascript
cblcarsLog.debug('[CBLCARSBaseCard.setConfig()] Called with config:', config);
cblcarsLog.debug('[CBLCARSBaseCard.requestUpdate()] Update requested');
cblcarsLog.debug('[CBLCARSBaseCard.constructor()] Resize observer fired');
```

**After**:
```javascript
cblcarsLog.trace('[CBLCARSBaseCard.setConfig()] Called with config:', config);
cblcarsLog.trace('[CBLCARSBaseCard.requestUpdate()] Update requested');
cblcarsLog.trace('[CBLCARSBaseCard.constructor()] Resize observer fired');
```

**Reason**: Framework lifecycle is too low-level for default debug

---

### Pattern 2: Loop Iterations → trace

**Before**:
```javascript
cells.forEach(cell => {
    cblcarsLog.debug('[MsdTransforms] Processing cell:', cell.id);
    // ... process cell ...
});
```

**After**:
```javascript
cblcarsLog.debug('[MsdTransforms] Processing ${cells.length} cells');
cells.forEach(cell => {
    cblcarsLog.trace('[MsdTransforms] Processing cell:', cell.id);
    // ... process cell ...
});
```

**Reason**: Summary at debug, details at trace

---

### Pattern 3: Detailed Operations → trace, Keep Summary → debug

**Before**:
```javascript
cblcarsLog.debug('[loadSVGToCache] Loaded SVG [key1] from [url1]');
cblcarsLog.debug('[loadSVGToCache] Loaded SVG [key2] from [url2]');
cblcarsLog.debug('[loadSVGToCache] Loaded SVG [key3] from [url3]');
```

**After**:
```javascript
cblcarsLog.trace('[loadSVGToCache] Loaded SVG [key1] from [url1]');
cblcarsLog.trace('[loadSVGToCache] Loaded SVG [key2] from [url2]');
cblcarsLog.trace('[loadSVGToCache] Loaded SVG [key3] from [url3]');
cblcarsLog.debug('[preloadSVGs] Loaded 3 SVGs: key1, key2, key3');
```

**Reason**: Users care about the summary, not each file

---

### Pattern 4: Keep Important Business Logic → debug

**Keep as debug**:
```javascript
cblcarsLog.debug('[RulesEngine] Rule matched:', rule.id, rule.conditions);
cblcarsLog.debug('[VisibilityEngine] Cell hidden by rule:', cellId, ruleName);
cblcarsLog.debug('[MsdDataSource] No history data available for:', entityId);
```

**Reason**: Users need this to troubleshoot why things are/aren't visible

---

### Pattern 5: Condition Checks → trace, Results → debug

**Before**:
```javascript
cblcarsLog.debug('[RulesEngine] Checking condition:', condition);
cblcarsLog.debug('[RulesEngine] Condition matched:', condition);
```

**After**:
```javascript
cblcarsLog.trace('[RulesEngine] Checking condition:', condition);
cblcarsLog.debug('[RulesEngine] Rule matched:', rule.id, matchedConditions);
```

**Reason**: Individual checks are noise, but match results are important

---

## Quick Decision Tree

When writing a log statement, ask:

1. **Is this an error/exception?** → `error`
2. **Is this a potential problem or deprecation?** → `warn`
3. **Is this a high-level operation summary?** → `info`
4. **Would a user need this to troubleshoot their config?** → `debug`
5. **Is this internal implementation detail?** → `trace`

**Default to `debug` if unsure** - we can always move it to trace later.

---

## Common Mistakes to Avoid

### ❌ Don't use info for details
```javascript
// BAD
entities.forEach(e => cblcarsLog.info('[Processing]', e));

// GOOD
cblcarsLog.info(`[Processing] Handling ${entities.length} entities`);
```

### ❌ Don't use debug for lifecycle
```javascript
// BAD
cblcarsLog.debug('[setHass] Called');
cblcarsLog.debug('[requestUpdate] Called');

// GOOD
cblcarsLog.trace('[setHass] Called');
cblcarsLog.trace('[requestUpdate] Called');
```

### ❌ Don't use trace for results
```javascript
// BAD
cblcarsLog.trace('[RulesEngine] Rule matched:', rule.id);

// GOOD
cblcarsLog.debug('[RulesEngine] Rule matched:', rule.id);
```

---

## Testing Your Logging

### Default (debug level)
Should see:
- ✅ Errors, warnings
- ✅ Pipeline completions
- ✅ Rule evaluation results
- ✅ Data flow changes
- ❌ requestUpdate calls
- ❌ Individual cell processing
- ❌ Loop iterations

### Trace level enabled
Should see:
- ✅ Everything from debug
- ✅ Every lifecycle method call
- ✅ Every loop iteration
- ✅ Every internal method
- ⚠️ Very verbose - only for deep debugging

---

## Summary

**Key Principle**: Default debug level should give you enough to troubleshoot user issues without drowning in framework noise.

**Trace is for**: "Why is this specific function being called 47 times?" not "Why isn't my rule working?"

**When in doubt**: Start at debug, move to trace if it's too noisy.
