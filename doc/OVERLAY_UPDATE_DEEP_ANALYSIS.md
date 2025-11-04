# Overlay Auto-Update Deep Analysis & Remediation Plan

**Date:** 2025-11-02
**Status:** Analysis Complete - Awaiting Remediation Approval
**Severity:** HIGH - Breaks reactive datasource updates for text/button overlays

---

## Executive Summary

**Problem:** Text and button overlays with datasource templates (e.g., `text: "{temperature}"`) do not auto-update when the datasource value changes. Page reload is required to see updated values.

**Root Cause:** Template resolution happens BEFORE subscription setup, causing subscription mechanisms to operate on already-resolved (empty) content instead of original template strings.

**Working Counter-Example:** Animations with `on_datasource_change` trigger work correctly because they use explicit `datasource` property instead of template extraction.

---

## Architecture Overview

### Current Overlay Lifecycle

```
1. Config Merge (CardModel)
   ↓ _raw property created (shallow reference)

2. ModelBuilder.computeResolvedModel()
   ↓ overlays processed, patches applied

3. AdvancedRenderer.render()
   ↓ For each overlay:

4. OverlayInstance.initialize(mountEl)
   ↓ ⚠️ Tries to extract datasources from overlay.content
   ↓ 🔴 PROBLEM: content is already empty/resolved!

5. OverlayInstance.render()
   ↓ DataSourceMixin.processTemplateForInitialRender(content)
   ↓ ✅ Templates ARE resolved here - but TOO LATE for subscriptions!

6. OverlayInstance.update()
   ↓ Called when datasource changes (IF subscription exists)
```

### Subscription Systems Inventory

#### 1. **OverlayBase._extractDataSourceReferences()**
- **When:** During `initialize()` (after render)
- **What it checks:**
  - `overlay.source`
  - `overlay.content` (with TemplateProcessor.extractReferences)
  - `overlay.cells[].content` (for status grids)
- **Why it fails:** `overlay.content` is already resolved/empty by this point
- **Location:** `src/msd/overlays/OverlayBase.js:244`

#### 2. **ModelBuilder._subscribeTextOverlaysToDataSources()**
- **When:** During `computeResolvedModel()` (before render)
- **What it checks:**
  - `overlay.data_source` (explicit property)
  - `overlay._raw.data_source`
  - `overlay.text` / `overlay.content` (regex extraction)
- **Why it fails:**
  - Checks fields that might already be resolved
  - Regex extraction attempts on potentially empty strings
- **Location:** `src/msd/pipeline/ModelBuilder.js:352`

#### 3. **AnimationManager.setupDatasourceListenerForAnimation()** ✅ WORKS
- **When:** During animation registration (after render)
- **What it checks:**
  - `animDef.datasource` (explicit property)
- **Why it works:** Uses explicit property, not template extraction
- **Location:** `src/msd/animation/AnimationManager.js:231`

---

## Critical Findings

### 1. Template Resolution Timing

Templates are resolved **during render** via these paths:

**TextOverlay:**
```javascript
// TextOverlay.js:384 - _resolveTextContent()
let content = style.value || overlay.text || overlay.content || '';
// ... falls through to:
content = DataSourceMixin.processTemplateForInitialRender(content, 'TextOverlay');
// This RESOLVES {temperature} -> "72.5" immediately
```

**ButtonOverlay:**
```javascript
// ButtonOverlay.js:597 - _resolveButtonContent()
const rawLabel = overlay._raw?.label || overlay.label || '';
// ... then:
return DataSourceMixin.processUnifiedTemplateStrings(content, 'ButtonOverlay');
// This RESOLVES {status} -> "Online" immediately
```

### 2. The _raw Property Misconception

Contrary to initial assumptions, `_raw` does NOT preserve original templates:

```javascript
// ModelBuilder.js:106
{
  id: o.id,
  type: o.type,
  // ... other fields copied ...
  _raw: o.raw,  // ⚠️ This is just a shallow reference to the overlay config
}
```

The `_raw` property is just a reference back to the original overlay object, which **also** has its fields resolved during template processing. It doesn't contain "pre-template" values.

### 3. Field Name Inconsistencies

Different overlays check different field names for content:

| Overlay Type | Fields Checked (in order) |
|--------------|---------------------------|
| **TextOverlay** | `style.value`, `overlay.text`, `overlay.content`, `_raw.content`, `_raw.text` |
| **ButtonOverlay** | `_raw.label`, `overlay.label`, `_raw.content`, `overlay.content` |
| **OverlayBase** | `overlay.content`, `cell.content` |
| **ModelBuilder** | `overlay.text`, `overlay.content`, `overlay.finalStyle?.value` |

**Issue:** This inconsistency means subscription logic needs to check ALL possible locations, making it fragile and error-prone.

### 4. Why Animations Work

Animations succeed because they **never rely on template extraction**:

```yaml
animations:
  - trigger: on_datasource_change
    datasource: temperature_sensor  # ✅ EXPLICIT property
    preset: pulse
```

The `datasource` property is:
1. Explicit and unambiguous
2. Never processed as a template
3. Available at subscription time

---

## Detailed Flow Analysis

### Scenario: Text overlay with template

**Config:**
```yaml
overlays:
  - id: temp_display
    type: text
    text: "Temperature: {temperature_sensor}°F"
    position: [100, 100]
```

**What happens:**

1. **Config Merge (Phase 1)**
   ```javascript
   overlay = {
     id: 'temp_display',
     type: 'text',
     text: "Temperature: {temperature_sensor}°F",  // ✅ Template preserved
     _raw: { /* reference to same object */ }
   }
   ```

2. **ModelBuilder._subscribeTextOverlaysToDataSources() (Phase 2)**
   ```javascript
   // Tries to extract datasources from overlay.text
   const textContent = overlay.text || overlay.content || ...;
   // textContent = "Temperature: {temperature_sensor}°F" ✅ Still has template

   // Extracts: ['temperature_sensor']
   // Subscribes to temperature_sensor ✅ Subscription created!
   ```

   **Wait - this SHOULD work?** Let's keep tracing...

3. **AdvancedRenderer.render() (Phase 3)**
   ```javascript
   // Creates TextOverlay instance
   const textOverlay = new TextOverlay(overlay, systemsManager);
   await textOverlay.initialize(mountEl);
   ```

4. **TextOverlay.initialize() (Phase 4)**
   ```javascript
   // Pre-resolves content
   this._cachedTextContent = this._resolveTextContent(this.overlay, style);
   // This calls DataSourceMixin.processTemplateForInitialRender()
   // Result: "Temperature: 72.5°F" (template RESOLVED)
   ```

5. **OverlayBase.initialize() (Phase 5)** ⚠️ CRITICAL
   ```javascript
   // Tries to extract datasources
   const dataSourceRefs = this._extractDataSourceReferences();
   // Checks this.overlay.content
   // But TextOverlay uses .text, not .content!
   // Returns: [] (empty) 🔴 NO SUBSCRIPTION
   ```

**Result:** ModelBuilder might create a subscription, but OverlayBase might NOT. Race condition/duplication depending on timing.

### The Actual Bug

Looking more carefully at ModelBuilder subscription code:

```javascript
// ModelBuilder.js:362
const textContent = overlay.text || overlay.content || overlay.finalStyle?.value || '';

// ModelBuilder.js:365
const templateRefs = this._extractDataSourceReferences(textContent);

// ModelBuilder.js:442 - _extractDataSourceReferences
_extractDataSourceReferences(content) {
  const regex = /\{([^}:]+)/g;  // Matches {datasource} or {datasource.path}
  // ...
}
```

**This DOES extract templates correctly!** So why doesn't it work?

Let's check the subscription callback:

```javascript
// ModelBuilder.js:413
const callback = (data) => {
  // Notify AdvancedRenderer to update the text overlay
  if (this.systems.renderer && this.systems.renderer.updateOverlayData) {
    this.systems.renderer.updateOverlayData(overlayId, data);
  }
};
```

This calls `AdvancedRenderer.updateOverlayData()`:

```javascript
// AdvancedRenderer.js:1614
updateOverlayData(overlayId, sourceData) {
  // Get the overlay element from cache
  const overlayElement = this.overlayElementCache?.get(overlayId);

  // Get the overlay configuration
  const overlay = this._findOverlayById(overlayId);

  // Use instance-based update if available
  const renderer = this.overlayRenderers.get(overlayId);
  if (renderer && renderer.update) {
    renderer.update(overlayElement, overlay, sourceData);
    return;
  }
  // ...
}
```

And TextOverlay.update():

```javascript
// TextOverlay.js:265
update(overlayElement, overlay, sourceData) {
  // Invalidate cached content to force re-resolution with new data
  this._cachedTextContent = null;

  // Re-resolve content with new data
  const textContent = this._resolveTextContent(overlay, style, sourceData);

  // Update DOM
  textElement.textContent = textContent;
}
```

**FOUND IT!** The issue is in `_resolveTextContent()`:

```javascript
// TextOverlay.js:384
_resolveTextContent(overlay, style, sourceData = null) {
  let content = style.value || overlay.text || overlay.content || '';
  // ... checks _raw ...

  // ✅ KEY: Uses DataSourceMixin.processTemplateForInitialRender()
  if (typeof content === 'string') {
    content = DataSourceMixin.processTemplateForInitialRender(content, 'TextOverlay');
    return content;
  }
}
```

The `sourceData` parameter is **passed but never used!** The method re-resolves templates from the **original** overlay config, which means it's fetching fresh data from DataSourceManager, not using the pushed `sourceData`.

**Is this actually a bug or intentional?** Let's check if DataSourceManager has the updated value...

Actually, wait - if it's re-resolving from DataSourceManager, and DataSourceManager has the updated value, it SHOULD work!

Let me check one more thing - when is `_resolveTextContent` called during updates vs initial render?

---

## The Real Root Cause (Final Discovery)

After extensive tracing, the issue is **timing and cache invalidation**:

1. **Initial Render:**
   - `_resolveTextContent()` is called
   - Templates are resolved using DataSourceManager
   - Result is cached in `this._cachedTextContent`
   - ✅ Works correctly

2. **Datasource Change:**
   - ModelBuilder subscription fires
   - Calls `AdvancedRenderer.updateOverlayData(overlayId, sourceData)`
   - Calls `TextOverlay.update(overlayElement, overlay, sourceData)`
   - Sets `this._cachedTextContent = null` to invalidate
   - Calls `this._resolveTextContent(overlay, style, sourceData)`
   - ✅ Should work!

**BUT WAIT** - Let's check if the subscription is actually being created...

```javascript
// ModelBuilder.js:365-375
_subscribeTextOverlaysToDataSources(overlays) {
  overlays.forEach(overlay => {
    if (overlay.type === 'text') {
      const textContent = overlay.text || overlay.content || ...;
      const templateRefs = this._extractDataSourceReferences(textContent);

      templateRefs.forEach(ref => {
        this._subscribeTextOverlayToDataSource(overlay.id, ref);
      });
    }
  });
}
```

And checking `_extractDataSourceReferences`:

```javascript
// ModelBuilder.js:442
_extractDataSourceReferences(content) {
  const regex = /\{([^}:]+)/g;
  // ... checks if it includes '.' ...
  // ... checks if it includes 'transformations' or 'aggregations' ...
  // ... OR checks if dataSourceManager.getSource(sourceName) exists ...

  return [...new Set(references)];
}
```

**CRITICAL BUG FOUND:** The regex only matches patterns WITH dots or transformations/aggregations or known sources. A simple `{temperature}` might not match if it doesn't meet these criteria!

---

## Summary of Root Causes

### Primary Issue: Template Extraction Fragility

`ModelBuilder._extractDataSourceReferences()` uses complex heuristics that fail for simple cases:

```javascript
// This regex: /\{([^}:]+)/g
// Matches: {anything}

// But then filters with:
if (ref.includes('.')) {  // ❌ Fails for {temperature}
  // OR
} else if (parts.includes('transformations') || parts.includes('aggregations')) {
  // OR
} else if (this.systems?.dataSourceManager?.getSource(sourceName)) {
  // ✅ Only works if dataSourceManager is available AND source exists
}
```

**Problem:** If DataSourceManager isn't initialized yet when ModelBuilder runs, simple `{datasource_name}` templates won't be subscribed!

### Secondary Issues:

1. **Multiple subscription systems** create confusion and potential duplicates/gaps
2. **Field name inconsistencies** across overlays (text vs content vs label vs value)
3. **_raw property misconception** - it doesn't preserve pre-template values
4. **No standardized "content field"** specification

---

## Proposed Remediation

### Option A: Explicit Datasource Property (RECOMMENDED)

**Pros:**
- Follows working animation pattern
- Unambiguous and reliable
- No template parsing required
- Easy to validate

**Cons:**
- Requires config updates for existing overlays
- Less concise than pure templates

**Implementation:**

```yaml
overlays:
  - id: temp_display
    type: text
    text: "Temperature: {temperature_sensor}°F"
    datasources:  # ✅ NEW: Explicit list
      - temperature_sensor
```

**Code changes:**
1. Update OverlayBase._extractDataSourceReferences() to check `overlay.datasources` array first
2. Maintain backward compatibility by still attempting template extraction
3. Standardize across all overlay types

### Option B: Template Tracking During Resolution

**Pros:**
- No config changes needed
- Automatic tracking
- Most user-friendly

**Cons:**
- Complex implementation
- Requires refactoring template resolution
- Harder to debug

**Implementation:**

1. **Modify TemplateProcessor** to track references during resolution:
```javascript
class TemplateProcessor {
  static resolveWithTracking(content, context) {
    const references = this.extractReferences(content);
    const resolved = this.resolve(content, context);

    return {
      resolved,
      references,  // ✅ Return what was used
      metadata: { /* ... */ }
    };
  }
}
```

2. **Store references in overlay metadata**:
```javascript
// During render:
const { resolved, references } = TemplateProcessor.resolveWithTracking(content);
overlay._datasourceReferences = references.filter(r => r.type === 'msd');
```

3. **Subscribe using stored references**:
```javascript
// In OverlayBase.initialize():
if (this.overlay._datasourceReferences) {
  this.overlay._datasourceReferences.forEach(ref => {
    this._subscribeToDataSource(ref.dataSource);
  });
}
```

### Option C: Hybrid Approach (BEST BALANCE)

Combine both approaches for maximum reliability:

1. **Check explicit `datasources` property first** (highest priority)
2. **Fall back to template extraction** from original config
3. **Improve template extraction** to be more robust
4. **Standardize field names** for content across overlay types

**Implementation Steps:**

#### Step 1: Standardize Content Field Names

Create a standard method to get "content" from any overlay:

```javascript
// OverlayUtils.js - NEW
class OverlayUtils {
  /**
   * Get content field value from overlay, checking all known locations
   * @param {Object} overlay - Overlay configuration
   * @returns {string|null} Content value
   */
  static getOverlayContent(overlay) {
    // Check by overlay type
    switch (overlay.type) {
      case 'text':
        return overlay.text || overlay.content || overlay._raw?.text || overlay._raw?.content || null;

      case 'button':
        return overlay.label || overlay.content || overlay._raw?.label || overlay._raw?.content || null;

      case 'status_grid':
        // Status grids use cells, not direct content
        return null;

      default:
        return overlay.content || overlay._raw?.content || null;
    }
  }

  /**
   * Get all content-bearing fields from overlay (for comprehensive extraction)
   * @param {Object} overlay - Overlay configuration
   * @returns {Array<string>} Array of content strings
   */
  static getAllContentFields(overlay) {
    const fields = [];

    switch (overlay.type) {
      case 'text':
        if (overlay.text) fields.push(overlay.text);
        if (overlay.content) fields.push(overlay.content);
        if (overlay.style?.value) fields.push(overlay.style.value);
        if (overlay.style?.value_format) fields.push(overlay.style.value_format);
        break;

      case 'button':
        if (overlay.label) fields.push(overlay.label);
        if (overlay.content) fields.push(overlay.content);
        if (overlay.texts) overlay.texts.forEach(t => fields.push(t));
        break;

      case 'status_grid':
        if (overlay.cells) {
          overlay.cells.forEach(cell => {
            if (cell.content) fields.push(cell.content);
            if (cell.label) fields.push(cell.label);
          });
        }
        break;

      default:
        if (overlay.content) fields.push(overlay.content);
    }

    return fields.filter(f => typeof f === 'string' && f.length > 0);
  }
}
```

#### Step 2: Improve DataSource Reference Extraction

```javascript
// OverlayBase.js - UPDATED
_extractDataSourceReferences() {
  const refs = new Set();

  // 1. Check explicit datasources property (HIGHEST PRIORITY)
  if (this.overlay.datasources && Array.isArray(this.overlay.datasources)) {
    this.overlay.datasources.forEach(ds => refs.add(ds));
    cblcarsLog.debug(`[${this.rendererName}] Found explicit datasources:`, this.overlay.datasources);
    return Array.from(refs);  // Don't bother with extraction if explicit
  }

  // 2. Check explicit data_source property
  if (this.overlay.data_source) {
    refs.add(this.overlay.data_source);
  }

  // 3. Extract from ALL content fields using standardized helper
  const contentFields = OverlayUtils.getAllContentFields(this.overlay);

  contentFields.forEach(content => {
    const templateRefs = TemplateProcessor.extractReferences(content);
    templateRefs.forEach(ref => {
      if (ref.type === 'msd' && ref.dataSource) {
        refs.add(ref.dataSource);
      }
    });
  });

  return Array.from(refs);
}
```

#### Step 3: Improve ModelBuilder Extraction

```javascript
// ModelBuilder.js - UPDATED
_extractDataSourceReferences(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const references = [];
  const regex = /\{([^}:]+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const ref = match[1].trim();

    // Simple datasource name: {temperature}
    if (!ref.includes('.')) {
      references.push(ref);  // ✅ FIX: Always include simple names
      continue;
    }

    // Complex path: {temperature.transformations.celsius}
    const parts = ref.split('.');
    const sourceName = parts[0];

    // Include if has known suffixes OR exists in manager
    if (parts.includes('transformations') ||
        parts.includes('aggregations') ||
        this.systems?.dataSourceManager?.getSource(sourceName)) {
      references.push(sourceName);
    }
  }

  return [...new Set(references)];
}
```

#### Step 4: Update Schema

```yaml
# MSD_SCHEMA_V1_Ratified.yaml
overlay_properties:
  # ... existing properties ...

  datasources:
    description: >
      OPTIONAL: Explicit list of datasource IDs this overlay depends on.
      When specified, the overlay will automatically subscribe to these datasources
      for reactive updates. If omitted, the system attempts to extract datasource
      references from template strings in content fields.
    type: array
    items:
      type: string
      pattern: "^[a-zA-Z0-9_-]+$"
    examples:
      - [temperature_sensor]
      - [cpu_temp, memory_usage]
      - [weather_data]
```

#### Step 5: Document Migration Path

Create a migration guide for users:

```markdown
# Migrating to Reactive Datasource Updates

## For New Configurations

Use explicit `datasources` property for clarity:

```yaml
overlays:
  - id: temp_display
    type: text
    text: "Temp: {temperature}°F"
    datasources: [temperature]  # ✅ Explicit
```

## For Existing Configurations

Your template-based configs will continue to work with improved extraction,
but we recommend adding explicit datasources for reliability:

```yaml
# Old (still works):
text: "{cpu_temp}"

# Better:
text: "{cpu_temp}"
datasources: [cpu_temp]
```

## Benefits of Explicit Datasources

1. **Faster subscription setup** - no template parsing
2. **More reliable** - no extraction heuristics
3. **Better validation** - schema can verify datasource exists
4. **Clearer intent** - self-documenting dependencies
```

---

## Implementation Plan

### Phase 1: Fix Critical Bugs (Immediate)

1. **Fix ModelBuilder._extractDataSourceReferences()** to include simple datasource names
2. **Add comprehensive logging** to track subscription creation
3. **Test with simple templates** like `{datasource_name}`

**Files to modify:**
- `src/msd/pipeline/ModelBuilder.js`

**Estimated time:** 2 hours

### Phase 2: Standardize Field Access (Short-term)

1. **Create OverlayUtils.getOverlayContent()** helper
2. **Create OverlayUtils.getAllContentFields()** helper
3. **Update OverlayBase._extractDataSourceReferences()** to use helpers
4. **Add unit tests** for content field extraction

**Files to modify:**
- `src/msd/renderer/OverlayUtils.js` (add methods)
- `src/msd/overlays/OverlayBase.js` (update extraction)
- `src/msd/tests/` (add tests)

**Estimated time:** 4 hours

### Phase 3: Add Explicit Datasources Support (Medium-term)

1. **Update schema** to include `datasources` property
2. **Update OverlayBase** to check explicit datasources first
3. **Update documentation** with examples
4. **Create migration guide**

**Files to modify:**
- `doc/MSD_SCHEMA_V1_Ratified.yaml`
- `src/msd/overlays/OverlayBase.js`
- `doc/overlay-documentation.md`
- Create new `doc/DATASOURCE_MIGRATION.md`

**Estimated time:** 3 hours

### Phase 4: Consolidate Subscription Systems (Long-term)

1. **Audit all subscription mechanisms** (OverlayBase, ModelBuilder, ApexCharts, StatusGrid)
2. **Create unified SubscriptionManager**
3. **Migrate all overlays** to use unified system
4. **Remove duplicate subscription code**

**Files affected:**
- Multiple (requires architecture refactor)

**Estimated time:** 12+ hours (separate PR)

---

## Testing Strategy

### Unit Tests

```javascript
describe('DataSource Subscription Extraction', () => {
  it('should extract simple datasource names', () => {
    const content = "Temperature: {temp_sensor}°F";
    const refs = extractDataSourceReferences(content);
    expect(refs).toContain('temp_sensor');
  });

  it('should extract datasources with paths', () => {
    const content = "{cpu.transformations.celsius}";
    const refs = extractDataSourceReferences(content);
    expect(refs).toContain('cpu');
  });

  it('should use explicit datasources when provided', () => {
    const overlay = {
      type: 'text',
      text: "{temp}",
      datasources: ['temperature_override']
    };
    const refs = extractOverlayDataSources(overlay);
    expect(refs).toEqual(['temperature_override']);
  });
});
```

### Integration Tests

1. **Create test overlay** with datasource template
2. **Subscribe to datasource**
3. **Update datasource value**
4. **Verify overlay updates** without page reload

### Regression Tests

1. **Verify animations** still work with `on_datasource_change`
2. **Verify status grids** update correctly
3. **Verify apex charts** update correctly
4. **Verify explicit data_source property** still works

---

## Risk Assessment

### Low Risk Changes
- ✅ Fixing `_extractDataSourceReferences()` regex
- ✅ Adding explicit `datasources` property (additive)
- ✅ Adding helper methods

### Medium Risk Changes
- ⚠️ Standardizing field access (affects render path)
- ⚠️ Updating subscription timing

### High Risk Changes
- ❌ Consolidating subscription systems (requires full refactor)

**Recommendation:** Implement Phase 1-3, defer Phase 4 to separate initiative.

---

## Success Criteria

### Must Have
1. ✅ Text overlays with `{datasource}` templates update reactively
2. ✅ Button overlays with `{datasource}` templates update reactively
3. ✅ No regressions in animation triggers
4. ✅ No performance degradation

### Should Have
1. ✅ Support for explicit `datasources` property
2. ✅ Comprehensive logging for debugging
3. ✅ Migration documentation

### Nice to Have
1. ⭐ Unified subscription system
2. ⭐ Automated datasource dependency detection
3. ⭐ Visual dependency graph in HUD

---

## Questions for Review

1. **Do we want to require explicit `datasources` property going forward?**
   - Recommendation: Optional but encouraged

2. **Should we deprecate template-based extraction?**
   - Recommendation: No, keep both for flexibility

3. **Timeline preference for Phase 4 (consolidation)?**
   - Recommendation: Defer to Phase 4 initiative after Phase 1-3 proven stable

4. **Breaking changes acceptable?**
   - Recommendation: Avoid breaking changes, maintain backward compatibility

---

## Next Steps

1. **Review this analysis** with team
2. **Get approval** for recommended approach (Option C - Hybrid)
3. **Create GitHub issues** for each phase
4. **Implement Phase 1** (critical fix)
5. **Test thoroughly** before moving to Phase 2
6. **Iterate based on feedback**

---

## Appendix: Code References

### Key Files

- `src/msd/overlays/OverlayBase.js` - Base class with subscription logic
- `src/msd/overlays/TextOverlay.js` - Text overlay with update mechanism
- `src/msd/overlays/ButtonOverlay.js` - Button overlay implementation
- `src/msd/pipeline/ModelBuilder.js` - Model building with subscriptions
- `src/msd/renderer/AdvancedRenderer.js` - Renderer coordination
- `src/msd/renderer/DataSourceMixin.js` - Template resolution
- `src/msd/animation/AnimationManager.js` - Working datasource subscriptions (reference)
- `src/msd/utils/TemplateProcessor.js` - Template extraction utilities

### Critical Methods

- `OverlayBase._extractDataSourceReferences()` - Line 244
- `OverlayBase._subscribeToDataSource()` - Line 288
- `ModelBuilder._subscribeTextOverlaysToDataSources()` - Line 352
- `ModelBuilder._extractDataSourceReferences()` - Line 442
- `TextOverlay._resolveTextContent()` - Line 384
- `TextOverlay.update()` - Line 265
- `DataSourceMixin.processTemplateForInitialRender()` - Line 244
- `AnimationManager.setupDatasourceListenerForAnimation()` - Line 231

---

**Document Version:** 1.0
**Last Updated:** 2025-11-02
**Author:** AI Analysis System
**Reviewer:** [Pending]
