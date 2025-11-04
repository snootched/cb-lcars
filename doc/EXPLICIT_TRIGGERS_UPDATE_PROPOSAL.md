# Explicit `triggers_update` Approach - Proposal

**Date:** 2025-11-02
**Status:** PROPOSAL - Awaiting Approval
**Related:** OVERLAY_UPDATE_DEEP_ANALYSIS.md

---

## Executive Summary

**Proposal:** Replace fragile template extraction with explicit `triggers_update` array (inspired by button-card), supporting both HA entities and MSD datasources.

**Benefits:**
- ✅ Eliminates ~120 lines of complex extraction code
- ✅ More reliable and predictable
- ✅ Easier to validate and debug
- ✅ Follows established pattern (button-card)
- ✅ Self-documenting configuration
- ✅ Enables future optimization opportunities

**Trade-offs:**
- ⚠️ Requires explicit configuration (less "magical")
- ⚠️ Breaking change for existing configs using templates
- ⚠️ Need migration tool/documentation

---

## Code Elimination Analysis

### What Gets **DELETED** 🗑️

#### 1. ModelBuilder Template Extraction (~73 lines)

**BEFORE:**
```javascript
// ModelBuilder.js:352-473 (121 lines, but ~73 are extraction logic)

_subscribeTextOverlaysToDataSources(overlays) {
  overlays.forEach(overlay => {
    if (overlay.type === 'text') {
      const textContent = overlay.text || overlay.content || overlay.finalStyle?.value || '';
      const dataSourceRef = overlay.data_source || overlay._raw?.data_source || overlay.finalStyle?.data_source;

      // ❌ DELETE: Complex template extraction
      const templateRefs = this._extractDataSourceReferences(textContent);

      // Subscribe to direct DataSource references
      if (dataSourceRef) {
        this._subscribeTextOverlayToDataSource(overlay.id, dataSourceRef);
      }

      // Subscribe to template string DataSource references
      templateRefs.forEach(ref => {
        this._subscribeTextOverlayToDataSource(overlay.id, ref);
      });
    }
  });
}

// ❌ DELETE: Entire method (47 lines)
_extractDataSourceReferences(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const references = [];
  const regex = /\{([^}:]+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const ref = match[1].trim();

    // Complex heuristics that fail
    if (ref.includes('.')) {
      const parts = ref.split('.');
      const sourceName = parts[0];

      if (parts.includes('transformations') ||
          parts.includes('aggregations') ||
          this.systems?.dataSourceManager?.getSource(sourceName)) {
        references.push(sourceName);
      }
    }
  }

  return [...new Set(references)];
}
```

**AFTER:**
```javascript
// ModelBuilder.js - SIMPLIFIED

_subscribeOverlaysToUpdates(overlays) {
  overlays.forEach(overlay => {
    // ✅ SIMPLE: Just check explicit property
    if (overlay.triggers_update && Array.isArray(overlay.triggers_update)) {
      overlay.triggers_update.forEach(ref => {
        this._subscribeOverlayToUpdate(overlay.id, ref);
      });
    }
  });
}

// Note: _subscribeOverlayToUpdate stays mostly the same, just renamed
// No complex extraction needed!
```

**Lines saved:** ~73 lines + simplification

#### 2. OverlayBase Template Extraction (~46 lines)

**BEFORE:**
```javascript
// OverlayBase.js:244-290 (46 lines)

_extractDataSourceReferences() {
  const refs = new Set();

  // ❌ DELETE: Multiple field checks
  if (this.overlay.source) {
    refs.add(this.overlay.source);
  }

  // ❌ DELETE: Template extraction from content
  if (this.overlay.content && typeof this.overlay.content === 'string') {
    const templateRefs = TemplateProcessor.extractReferences(this.overlay.content);
    templateRefs.forEach(ref => {
      if (ref.type === 'msd' && ref.dataSource) {
        refs.add(ref.dataSource);
      }
    });
  }

  // ❌ DELETE: Cell iteration and extraction
  if (this.overlay.cells && Array.isArray(this.overlay.cells)) {
    this.overlay.cells.forEach(cell => {
      if (cell.source) {
        refs.add(cell.source);
      }
      if (cell.content && typeof cell.content === 'string') {
        const cellRefs = TemplateProcessor.extractReferences(cell.content);
        cellRefs.forEach(ref => {
          if (ref.type === 'msd' && ref.dataSource) {
            refs.add(ref.dataSource);
          }
        });
      }
    });
  }

  return Array.from(refs);
}
```

**AFTER:**
```javascript
// OverlayBase.js - SIMPLIFIED

_getUpdateTriggers() {
  // ✅ SIMPLE: Just return the explicit array
  return this.overlay.triggers_update || [];
}
```

**Lines saved:** ~46 lines reduced to ~3 lines

#### 3. Field Name Checking Complexity (Multiple files)

**BEFORE:** Each overlay checks different field names:
- TextOverlay: `style.value`, `overlay.text`, `overlay.content`, `_raw.content`, `_raw.text`
- ButtonOverlay: `_raw.label`, `overlay.label`, `_raw.content`, `overlay.content`
- OverlayBase: `overlay.content`, `cell.content`

**AFTER:** None of this needed - templates still work for display, just don't need extraction!

---

## Total Code Reduction

| Component | Lines Removed | Lines Added | Net Savings |
|-----------|---------------|-------------|-------------|
| ModelBuilder extraction | 73 | 0 | -73 |
| OverlayBase extraction | 46 | 3 | -43 |
| Field name complexity | ~20 | 0 | -20 |
| **TOTAL** | **~139** | **3** | **~136 lines** |

**Plus:** Reduced cognitive complexity, fewer edge cases, easier debugging

---

## Proposed `triggers_update` Schema

### Inspired by button-card

Button-card uses this pattern:
```yaml
triggers_update:
  - sensor.temperature
  - binary_sensor.motion
```

### Our Enhanced Version

Support both **HA entities** AND **MSD datasources**:

```yaml
overlays:
  - id: my_overlay
    type: text
    text: "Temp: {temperature}°F"
    triggers_update:
      - temperature                    # MSD datasource (simple)
      - cpu_temp.transformations.celsius  # MSD datasource (path)
      - sensor.outside_temp            # HA entity
      - binary_sensor.door_open        # HA entity
```

### Schema Definition

```yaml
# MSD_SCHEMA_V1_Ratified.yaml

overlay_properties:
  triggers_update:
    description: >
      OPTIONAL: List of entities or datasources that trigger reactive updates
      for this overlay. When any listed entity/datasource changes, the overlay
      will re-render with new data.

      Supports:
      - MSD datasources (simple name or dot-notation path)
      - Home Assistant entities (must contain a dot: domain.entity_id)

      If omitted, the overlay will not auto-update and requires manual refresh.
    type: array
    items:
      type: string
      oneOf:
        - pattern: "^[a-zA-Z][a-zA-Z0-9_]*$"  # MSD datasource (no dots)
          description: "MSD datasource name"
        - pattern: "^[a-zA-Z][a-zA-Z0-9_]*\\..*"  # Entity or datasource path
          description: "HA entity or MSD datasource path"
    examples:
      - ["temperature"]
      - ["cpu_temp", "memory_usage"]
      - ["sensor.temperature", "binary_sensor.motion"]
      - ["weather_data.transformations.fahrenheit"]
      - ["sensor.temp", "cpu.transformations.celsius"]
    default: []
```

---

## Implementation Comparison

### Hybrid Approach (NOT CHOSEN)
```javascript
// Check explicit first, fall back to extraction
const refs = overlay.triggers_update ||
             this._extractDataSourceReferences(overlay);
```
**Complexity:** HIGH (2 code paths)

### Explicit-Only Approach (PROPOSED)
```javascript
// Just use explicit
const refs = overlay.triggers_update || [];
```
**Complexity:** LOW (1 code path)

---

## Detailed Implementation Plan

### Phase 1: Core Implementation (4 hours)

#### Step 1.1: Update Schema

**File:** `doc/MSD_SCHEMA_V1_Ratified.yaml`

```yaml
# Add to overlay_properties section
triggers_update:
  description: |
    List of entities or datasources that trigger reactive updates.
    Replaces automatic template extraction for reliability.

    Format:
    - MSD datasource: "datasource_name" or "datasource.path.to.value"
    - HA entity: "domain.entity_id" (must contain dot)
  type: array
  items:
    type: string
  default: []
  examples:
    - triggers_update: [temperature]
    - triggers_update: [sensor.temp, cpu_temp.transformations.celsius]
```

#### Step 1.2: Simplify OverlayBase

**File:** `src/msd/overlays/OverlayBase.js`

```javascript
/**
 * Get update triggers from overlay configuration
 * @protected
 * @returns {Array<string>} Array of entity/datasource IDs to subscribe to
 */
_getUpdateTriggers() {
  if (!this.overlay.triggers_update || !Array.isArray(this.overlay.triggers_update)) {
    return [];
  }

  return this.overlay.triggers_update;
}

/**
 * Initialize overlay instance
 * Called once when overlay is first created
 */
async initialize(mountEl) {
  if (this._initialized) {
    cblcarsLog.warn(`[${this.rendererName}] Already initialized:`, this.overlay.id);
    return;
  }

  this.mountEl = mountEl;

  cblcarsLog.debug(`[${this.rendererName}] Initializing overlay:`, this.overlay.id);

  try {
    // ✅ SIMPLIFIED: Get explicit triggers
    const updateTriggers = this._getUpdateTriggers();

    if (updateTriggers.length > 0) {
      cblcarsLog.debug(`[${this.rendererName}] Subscribing to triggers:`, updateTriggers);

      for (const triggerRef of updateTriggers) {
        // Determine if it's an HA entity or MSD datasource
        if (this._isHAEntity(triggerRef)) {
          this._subscribeToEntity(triggerRef);
        } else {
          this._subscribeToDataSource(triggerRef);
        }
      }
    }

    // Create animation scope if overlay has animations
    if (this.overlay.animations || this.overlay.animate) {
      this._createAnimationScope();
    }

    this._initialized = true;
    cblcarsLog.debug(`[${this.rendererName}] Initialization complete:`, this.overlay.id);

  } catch (error) {
    cblcarsLog.error(`[${this.rendererName}] Initialization failed:`, error);
    throw error;
  }
}

/**
 * Check if a trigger reference is an HA entity (contains dot)
 * @private
 * @param {string} ref - Trigger reference
 * @returns {boolean} True if HA entity
 */
_isHAEntity(ref) {
  // HA entities always have format: domain.entity_id
  // MSD datasources either have no dots (simple) or dots in paths
  // Heuristic: if it looks like "sensor.something" or "binary_sensor.xyz", it's HA
  const parts = ref.split('.');

  if (parts.length < 2) {
    // No dots = simple MSD datasource
    return false;
  }

  // Check if first part is a known HA domain
  const knownHADomains = [
    'sensor', 'binary_sensor', 'switch', 'light', 'climate',
    'cover', 'fan', 'lock', 'media_player', 'person', 'device_tracker',
    'weather', 'sun', 'zone', 'input_boolean', 'input_number',
    'input_select', 'input_text', 'input_datetime', 'timer', 'counter'
  ];

  if (knownHADomains.includes(parts[0])) {
    return true;
  }

  // Otherwise assume MSD datasource path
  return false;
}

/**
 * Subscribe to Home Assistant entity updates
 * @protected
 * @param {string} entityId - Entity ID (e.g., 'sensor.temperature')
 */
_subscribeToEntity(entityId) {
  // TODO: Implement HA entity subscription
  // This would integrate with MsdTemplateEngine or Home Assistant connection
  cblcarsLog.debug(`[${this.rendererName}] HA entity subscription:`, entityId);

  // For now, just log - full HA integration is separate work
  cblcarsLog.warn(`[${this.rendererName}] HA entity subscriptions not yet implemented`);
}

// Keep _subscribeToDataSource method as-is (already works)
```

**Delete these methods:**
- `_extractDataSourceReferences()` (46 lines) → DELETE
- Related complexity in checking multiple fields → DELETE

#### Step 1.3: Simplify ModelBuilder

**File:** `src/msd/pipeline/ModelBuilder.js`

```javascript
/**
 * Set up subscriptions for overlays with triggers_update
 * @param {Array} overlays - Array of overlay configurations
 * @private
 */
_subscribeOverlaysToUpdates(overlays) {
  overlays.forEach(overlay => {
    // ✅ SIMPLE: Just check explicit property
    if (!overlay.triggers_update || !Array.isArray(overlay.triggers_update)) {
      return;
    }

    cblcarsLog.debug(`[ModelBuilder] Setting up subscriptions for ${overlay.id}:`, overlay.triggers_update);

    overlay.triggers_update.forEach(ref => {
      // For now, assume all are datasources
      // (HA entity subscriptions handled elsewhere or TODO)
      this._subscribeOverlayToDataSource(overlay.id, ref);
    });
  });
}

/**
 * Subscribe an overlay to a specific DataSource
 * @param {string} overlayId - ID of the overlay
 * @param {string} dataSourceRef - DataSource reference (e.g., 'temperature' or 'cpu.transformations.celsius')
 * @private
 */
_subscribeOverlayToDataSource(overlayId, dataSourceRef) {
  // ✅ KEEP: This method stays mostly the same, just renamed
  try {
    const dataSourceManager = this.systems?.dataSourceManager;
    if (!dataSourceManager) {
      cblcarsLog.warn(`[ModelBuilder] DataSourceManager not available for overlay subscription: ${overlayId}`);
      return;
    }

    // Parse DataSource reference to get source name
    const sourceName = dataSourceRef.split('.')[0];
    const dataSource = dataSourceManager.getSource(sourceName);

    if (!dataSource) {
      cblcarsLog.warn(`[ModelBuilder] DataSource '${sourceName}' not found for overlay: ${overlayId}`);
      return;
    }

    // Check if already subscribed
    if (!this._overlayUnsubscribers) {
      this._overlayUnsubscribers = new Map();
    }

    if (!this._overlayUnsubscribers.has(overlayId)) {
      this._overlayUnsubscribers.set(overlayId, []);
    }

    // Create subscription callback
    const callback = (data) => {
      cblcarsLog.debug(`[ModelBuilder] 📊 Overlay ${overlayId} received update from ${sourceName}`);

      // Notify AdvancedRenderer to update the overlay
      if (this.systems.renderer && this.systems.renderer.updateOverlayData) {
        this.systems.renderer.updateOverlayData(overlayId, data);
      }
    };

    // Subscribe to the DataSource
    const unsubscribe = dataSource.subscribe(callback);
    this._overlayUnsubscribers.get(overlayId).push(unsubscribe);

    cblcarsLog.debug(`[ModelBuilder] ✅ Subscribed overlay ${overlayId} to DataSource ${sourceName}`);

  } catch (error) {
    cblcarsLog.error(`[ModelBuilder] Failed to subscribe overlay ${overlayId} to DataSource ${dataSourceRef}:`, error);
  }
}
```

**Changes in computeResolvedModel():**
```javascript
computeResolvedModel() {
  // ... existing code ...

  // BEFORE:
  // this._subscribeTextOverlaysToDataSources(baseOverlays);

  // AFTER:
  this._subscribeOverlaysToUpdates(baseOverlays);

  // ... rest of existing code ...
}
```

**Delete these methods:**
- `_subscribeTextOverlaysToDataSources()` → DELETE
- `_subscribeTextOverlayToDataSource()` → RENAME to `_subscribeOverlayToDataSource()`
- `_extractDataSourceReferences()` → DELETE

---

### Phase 2: Migration Support (3 hours)

#### Step 2.1: Create Migration Script

**File:** `scripts/migrate_to_triggers_update.js`

```javascript
#!/usr/bin/env node

/**
 * Migration script to convert template-based subscriptions to triggers_update
 *
 * Usage:
 *   node scripts/migrate_to_triggers_update.js path/to/config.yaml
 */

const fs = require('fs');
const yaml = require('js-yaml');

// Simple template extraction (matches {datasource_name})
function extractTemplateReferences(text) {
  if (!text || typeof text !== 'string') return [];

  const refs = new Set();
  const regex = /\{([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_.]*)?)\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const ref = match[1].trim();
    const baseName = ref.split('.')[0];
    refs.add(baseName);
  }

  return Array.from(refs);
}

function migrateOverlay(overlay) {
  // Skip if already has triggers_update
  if (overlay.triggers_update) {
    console.log(`  ℹ️  ${overlay.id} already has triggers_update - skipping`);
    return overlay;
  }

  const triggers = new Set();

  // Check various content fields
  const contentFields = [
    overlay.text,
    overlay.content,
    overlay.label,
    overlay.style?.value,
    overlay.style?.value_format
  ];

  contentFields.forEach(field => {
    const refs = extractTemplateReferences(field);
    refs.forEach(ref => triggers.add(ref));
  });

  // Check texts array (for buttons)
  if (overlay.texts && Array.isArray(overlay.texts)) {
    overlay.texts.forEach(text => {
      const refs = extractTemplateReferences(text);
      refs.forEach(ref => triggers.add(ref));
    });
  }

  // Check explicit data_source
  if (overlay.data_source) {
    triggers.add(overlay.data_source.split('.')[0]);
  }

  if (triggers.size > 0) {
    overlay.triggers_update = Array.from(triggers);
    console.log(`  ✅ ${overlay.id}: Added triggers_update: [${Array.from(triggers).join(', ')}]`);
  } else {
    console.log(`  ⚪ ${overlay.id}: No datasources detected`);
  }

  return overlay;
}

function migrateConfig(config) {
  if (!config.overlays) {
    console.log('No overlays found in config');
    return config;
  }

  console.log(`\nMigrating ${config.overlays.length} overlays...\n`);

  config.overlays = config.overlays.map(overlay => migrateOverlay(overlay));

  return config;
}

// Main
const configPath = process.argv[2];

if (!configPath) {
  console.error('Usage: node migrate_to_triggers_update.js <config.yaml>');
  process.exit(1);
}

try {
  console.log(`Reading config from: ${configPath}`);
  const configText = fs.readFileSync(configPath, 'utf8');
  const config = yaml.load(configText);

  const migrated = migrateConfig(config);

  const outputPath = configPath.replace('.yaml', '.migrated.yaml');
  fs.writeFileSync(outputPath, yaml.dump(migrated, { lineWidth: 120 }));

  console.log(`\n✅ Migration complete! Saved to: ${outputPath}`);
  console.log('\nReview the changes and replace your original config when ready.');

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
```

#### Step 2.2: Create Migration Documentation

**File:** `doc/MIGRATION_TRIGGERS_UPDATE.md`

```markdown
# Migrating to `triggers_update`

## Overview

Version 2.0 replaces automatic template extraction with explicit `triggers_update` arrays for improved reliability.

## What Changed

**BEFORE (Automatic):**
```yaml
overlays:
  - id: temp_display
    type: text
    text: "Temperature: {temperature_sensor}°F"
    # Subscriptions created automatically (unreliable)
```

**AFTER (Explicit):**
```yaml
overlays:
  - id: temp_display
    type: text
    text: "Temperature: {temperature_sensor}°F"
    triggers_update: [temperature_sensor]  # ✅ Explicit
```

## Migration Options

### Option 1: Automated Migration Script

```bash
node scripts/migrate_to_triggers_update.js your-config.yaml
```

This creates `your-config.migrated.yaml` with `triggers_update` added.

### Option 2: Manual Migration

For each overlay with datasource templates:

1. **Find template references** in: `text`, `content`, `label`, `value_format`, `texts[]`
2. **Extract datasource names** (the part before any dots)
3. **Add `triggers_update` array** with those names

### Examples

#### Text Overlay with Simple Datasource
```yaml
# Before
- id: cpu_temp
  type: text
  text: "{cpu_temperature}°C"

# After
- id: cpu_temp
  type: text
  text: "{cpu_temperature}°C"
  triggers_update: [cpu_temperature]
```

#### Text Overlay with Transformation Path
```yaml
# Before
- id: weather
  type: text
  text: "{weather_data.transformations.fahrenheit}°F"

# After
- id: weather
  type: text
  text: "{weather_data.transformations.fahrenheit}°F"
  triggers_update: [weather_data]  # Just the base name
```

#### Button with Multiple Datasources
```yaml
# Before
- id: status_btn
  type: button
  label: "{system_status}"
  texts:
    - "CPU: {cpu_usage}%"
    - "Mem: {memory_usage}%"

# After
- id: status_btn
  type: button
  label: "{system_status}"
  texts:
    - "CPU: {cpu_usage}%"
    - "Mem: {memory_usage}%"
  triggers_update: [system_status, cpu_usage, memory_usage]
```

#### Mixed HA Entities and Datasources
```yaml
# Before
- id: multi_source
  type: text
  text: "{sensor.outside_temp} / {inside_temp}"

# After
- id: multi_source
  type: text
  text: "{sensor.outside_temp} / {inside_temp}"
  triggers_update:
    - sensor.outside_temp  # HA entity
    - inside_temp          # MSD datasource
```

## Breaking Changes

1. **Overlays without `triggers_update` will NOT auto-update**
   - You must add `triggers_update` explicitly
   - Templates still work for display, just not subscriptions

2. **Removed properties:**
   - `data_source` (single) → Use `triggers_update` array instead

## Benefits

✅ **Reliable** - No fragile template parsing
✅ **Predictable** - Clear subscription dependencies
✅ **Debuggable** - Easy to see what triggers updates
✅ **Validatable** - Schema can check references exist
✅ **Flexible** - Mix HA entities and datasources

## Validation

After migration, validate your config:

```bash
# Check for overlays with templates but no triggers
grep -A 5 "text.*{" your-config.yaml | grep -B 5 -L "triggers_update"
```

## Troubleshooting

**Overlay not updating?**
1. Check `triggers_update` is present
2. Verify datasource names match exactly
3. Check browser console for subscription errors

**Migration script errors?**
1. Ensure YAML is valid
2. Check for complex template expressions
3. Review generated config before using
```

---

### Phase 3: Update Examples & Tests (2 hours)

#### Step 3.1: Update Example Configs

**File:** `test-*.yaml` (all test configs)

Add `triggers_update` to all overlays using datasources.

#### Step 3.2: Update Tests

**File:** `src/msd/tests/overlay-subscriptions.test.js` (NEW)

```javascript
import { OverlayBase } from '../overlays/OverlayBase.js';

describe('Overlay Subscription with triggers_update', () => {
  it('should use explicit triggers_update', () => {
    const overlay = {
      id: 'test',
      type: 'text',
      text: "{temp}°F",
      triggers_update: ['temp']
    };

    const instance = new OverlayBase(overlay, mockSystems);
    const triggers = instance._getUpdateTriggers();

    expect(triggers).toEqual(['temp']);
  });

  it('should return empty array when no triggers_update', () => {
    const overlay = {
      id: 'test',
      type: 'text',
      text: "Static text"
    };

    const instance = new OverlayBase(overlay, mockSystems);
    const triggers = instance._getUpdateTriggers();

    expect(triggers).toEqual([]);
  });

  it('should distinguish HA entities from datasources', () => {
    const overlay = {
      id: 'test',
      triggers_update: ['sensor.temp', 'cpu_data']
    };

    const instance = new OverlayBase(overlay, mockSystems);

    expect(instance._isHAEntity('sensor.temp')).toBe(true);
    expect(instance._isHAEntity('cpu_data')).toBe(false);
    expect(instance._isHAEntity('cpu_data.transformations.celsius')).toBe(false);
  });
});
```

---

### Phase 4: Deprecation & Cleanup (1 hour)

#### Step 4.1: Remove Old Code

**Files to modify:**
- ✅ Delete `ModelBuilder._extractDataSourceReferences()`
- ✅ Delete `ModelBuilder._subscribeTextOverlaysToDataSources()`
- ✅ Delete `OverlayBase._extractDataSourceReferences()`
- ✅ Simplify field checking in TextOverlay, ButtonOverlay

#### Step 4.2: Update CHANGELOG

```markdown
## [2.0.0] - 2025-11-XX

### BREAKING CHANGES

- **Overlays now require explicit `triggers_update` for reactive updates**
  - Automatic template extraction has been removed
  - Use migration script: `node scripts/migrate_to_triggers_update.js config.yaml`
  - See MIGRATION_TRIGGERS_UPDATE.md for details

### Added

- `triggers_update` property for overlays (replaces auto-detection)
- Support for both HA entities and MSD datasources in `triggers_update`
- Migration script for automatic config conversion
- Improved subscription reliability

### Removed

- Automatic datasource extraction from templates
- `data_source` property (use `triggers_update` array instead)
- Complex heuristics for detecting datasource references

### Fixed

- Unreliable subscriptions with simple datasource names
- Race conditions in subscription setup
- Field name inconsistencies across overlay types
```

---

## Migration Path for Existing Users

### Step 1: Deprecation Warning (Optional Pre-release)

Add warning when templates detected without `triggers_update`:

```javascript
// In OverlayBase.initialize()
const triggers = this._getUpdateTriggers();

if (triggers.length === 0) {
  // Check if overlay has templates (rough check)
  const content = this.overlay.text || this.overlay.content || '';
  if (content.includes('{') && content.includes('}')) {
    cblcarsLog.warn(
      `[${this.rendererName}] ⚠️ DEPRECATION: Overlay ${this.overlay.id} uses templates but has no 'triggers_update'. ` +
      `Auto-updates will not work. Add 'triggers_update' array. See MIGRATION_TRIGGERS_UPDATE.md`
    );
  }
}
```

### Step 2: Documentation Blitz

1. Update README with migration notice
2. Post migration guide in discussions
3. Update examples repository
4. Add notice to release notes

### Step 3: Version Strategy

- **v1.9.x:** Add deprecation warnings (optional)
- **v2.0.0:** Remove auto-extraction, require `triggers_update`

---

## Benefits Summary

### Code Quality
- **-136 lines** of complex extraction logic
- **1 code path** instead of 2 (explicit only)
- **Easier testing** - simple array check
- **Clearer intent** - self-documenting config

### Reliability
- **No regex parsing** required
- **No heuristics** that can fail
- **Predictable behavior** - explicit is always clear
- **Validation-friendly** - schema can verify references exist

### User Experience
- **Clearer errors** - "missing triggers_update" vs "failed to extract"
- **Better documentation** - dependencies visible in config
- **IDE support** - autocomplete possible for known datasources
- **Migration tooling** - automated conversion available

### Performance
- **Faster initialization** - no extraction needed
- **Less CPU** - no regex matching on every overlay
- **Simpler debugging** - fewer code paths to trace

---

## Comparison with Hybrid

| Aspect | Explicit-Only | Hybrid |
|--------|---------------|--------|
| **Code Lines** | -136 | -70 |
| **Code Paths** | 1 | 2 |
| **Reliability** | High | Medium |
| **User Effort** | Explicit config | Automatic |
| **Debugging** | Easy | Medium |
| **Migration** | Required | Optional |
| **Maintenance** | Low | Medium |

**Recommendation:** **Explicit-Only** for long-term maintainability

---

## Risk Assessment

### Technical Risks

| Risk | Mitigation |
|------|-----------|
| Breaking change | Migration script + documentation |
| User confusion | Clear error messages + examples |
| Missed templates | Deprecation warnings in v1.9 |
| HA entity integration | Stub implementation, document TODO |

### Adoption Risks

| Risk | Mitigation |
|------|-----------|
| User pushback | Communicate benefits clearly |
| Migration effort | Provide automated script |
| Documentation needs | Comprehensive migration guide |

**Overall Risk:** MEDIUM (manageable with good migration support)

---

## Open Questions

1. **HA Entity Subscriptions:** Should we implement full HA entity subscription in OverlayBase now, or document as TODO?
   - **Recommendation:** Document as TODO, focus on datasources first

2. **Backward Compatibility Window:** Should we have a deprecation period?
   - **Recommendation:** Optional - add warnings in v1.9, break in v2.0

3. **Mixed References:** How to handle `{sensor.temp}` (HA) vs `{temp.transformations.celsius}` (datasource)?
   - **Recommendation:** Use heuristic (domain names for HA) + allow override with prefix syntax if needed later

4. **Animation Consistency:** Should animations also use `triggers_update` instead of `datasource`?
   - **Recommendation:** Defer - animations are working, different context (trigger config vs data dependency)

---

## Recommendation

**✅ PROCEED with Explicit-Only (`triggers_update`) approach**

**Reasoning:**
1. Eliminates 136 lines of fragile code
2. More reliable and maintainable
3. Follows established pattern (button-card)
4. Migration path is clear with tooling
5. Long-term benefits outweigh short-term migration effort

**Next Steps:**
1. Get approval for breaking change in v2.0
2. Implement Phase 1 (core changes)
3. Test thoroughly with migration script
4. Release v1.9 with deprecation warnings (optional)
5. Release v2.0 with breaking change + migration guide

---

## Timeline Estimate

- **Phase 1 (Core):** 4 hours
- **Phase 2 (Migration):** 3 hours
- **Phase 3 (Examples/Tests):** 2 hours
- **Phase 4 (Cleanup):** 1 hour
- **Total:** ~10 hours (1.5 days)

**Plus:** Testing, documentation review, user communication

---

**Proposal Status:** AWAITING APPROVAL
**Proposed By:** AI Analysis
**Date:** 2025-11-02
