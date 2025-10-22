# 🚀 Aggressive Refactor - Execution Plan (No Fixed Timeline)

**Approved:**
- ✅ Aggressive refactor path
- ✅ Feature freeze until complete
- ✅ Sequential execution (move as fast as possible)
- ✅ Remove dead code immediately

---

## 📦 **Phase 0: Dead Code Removal (STARTING NOW)**

I'll create the first PR to remove all dead/unwanted code immediately.

### **Files to DELETE entirely:**

````bash
# Overlay renderers we don't use anymore
src/msd/overlays/SparklineOverlayRenderer.js
src/msd/overlays/HistoryBarOverlayRenderer.js

# Any related test files
test/msd/overlays/SparklineOverlayRenderer.test.js
test/msd/overlays/HistoryBarOverlayRenderer.test.js
````

### **Files to MODIFY (remove dead code):**

````javascript
export class ModelBuilder {
  // ... existing code ...

  _subscribeOverlaysToDataSources(baseOverlays) {
    // DELETE ENTIRE METHOD - sparkline/ribbon subscription logic
    // This method subscribed sparkline/historybar overlays
    // which we no longer support
  }

  // DELETE: _subscribeTextOverlaysToDataSources (replaced by instance-based)
  // DELETE: _subscribeTextOverlayToDataSource (replaced by instance-based)
  // DELETE: _extractDataSourceReferences (will move to TemplateProcessor)
}
````

````javascript
export class SystemsManager {
  // ... existing code ...

  // DELETE: _updateTextOverlaysForDataSourceChanges
  // This was deprecated/unused - replaced by BaseOverlayUpdater

  // DELETE: setupDirectHassSubscription
  // Will be replaced by clean HASS propagation in Phase 1
}
````

````javascript
export class AdvancedRenderer {
  // ... existing code ...

  _getOverlayRenderer(type) {
    const renderers = {
      text: TextOverlayRenderer,
      status_grid: StatusGridRenderer,
      apexchart: ApexChartsOverlayRenderer,
      line: LineOverlayRenderer,
      button: ButtonOverlayRenderer,
      control: ControlOverlayRenderer,
      // DELETE: sparkline: SparklineOverlayRenderer,
      // DELETE: historybar: HistoryBarOverlayRenderer,
    };
    // ... rest of method ...
  }

  // MARK AS DEPRECATED (will remove in Phase 5):
  // updateOverlayData() - replaced by instance-based updates
}
````

### **PR #1: Remove Dead Code**

**Branch:** `refactor/phase-0-remove-dead-code`

**Checklist:**
```markdown
- [ ] Delete SparklineOverlayRenderer.js
- [ ] Delete HistoryBarOverlayRenderer.js
- [ ] Remove sparkline/historybar from AdvancedRenderer registry
- [ ] Remove ModelBuilder._subscribeOverlaysToDataSources
- [ ] Remove SystemsManager._updateTextOverlaysForDataSourceChanges
- [ ] Remove SystemsManager.setupDirectHassSubscription
- [ ] Update any imports that referenced deleted files
- [ ] Run tests to ensure nothing broke
- [ ] Update CHANGELOG.md
```

**Commit Message:**
```
refactor: Phase 0 - Remove dead code (sparkline, historybar, deprecated methods)

BREAKING CHANGE: Removed sparkline and historybar overlay types
- Deleted SparklineOverlayRenderer and HistoryBarOverlayRenderer
- Removed unused subscription methods from ModelBuilder
- Removed deprecated HASS subscription setup from SystemsManager

Part of aggressive refactor plan - preparing for clean architecture.
```

---

## 🔥 **Phase 1: HASS Architecture Fix (NEXT)**

Once Phase 0 PR is merged, immediately start Phase 1.

### **PR #2: Single Source of Truth for HASS**

**Branch:** `refactor/phase-1-hass-single-source`

**Key Changes:**

````javascript
export class SystemsManager {
  constructor() {
    // REMOVE:
    // this._originalHass = null;
    // this._currentHass = null;
    // this._previousRuleStates = null;

    // ADD:
    this._hass = null; // Single source of truth
  }

  /**
   * Ingest fresh HASS and propagate to all systems
   * REPLACES: Complex entity change handler with delays
   */
  ingestHass(hass) {
    if (!hass || !hass.states) {
      cblcarsLog.warn('[SystemsManager] Invalid HASS provided');
      return;
    }

    this._hass = hass;
    this._propagateHassToSystems(hass);
  }

  /**
   * Propagate HASS to subsystems in correct order
   * @private
   */
  _propagateHassToSystems(hass) {
    // 1. DataSourceManager first (provides entity values)
    if (this.dataSourceManager) {
      this.dataSourceManager.ingestHass(hass);
    }

    // 2. RulesEngine second (evaluates conditions)
    if (this.rulesEngine) {
      this.rulesEngine.ingestHass(hass);
    }

    // 3. Controls third (direct HASS access)
    if (this.controlsRenderer) {
      this.controlsRenderer.setHass(hass);
    }

    // 4. Overlays update automatically via DataSource subscriptions
    // (No need for explicit overlay update here)
  }

  /**
   * Get current HASS (single source)
   */
  getHass() {
    return this._hass;
  }

  // DELETE ENTIRE METHOD:
  // _createEntityChangeHandler() - 250+ lines replaced by clean propagation

  // DELETE:
  // setOriginalHass()
  // getCurrentHass()
  // getOriginalHass()
}
````

````javascript
export class DataSourceManager {
  // ... existing code ...

  /**
   * Ingest HASS updates and notify affected DataSources
   * @param {Object} hass - Home Assistant state object
   */
  ingestHass(hass) {
    if (!hass || !hass.states) return;

    const changedEntityIds = new Set();

    // Find which entities changed
    Object.keys(hass.states).forEach(entityId => {
      const newState = hass.states[entityId];
      const oldState = this._lastHass?.states?.[entityId];

      if (!oldState || newState.state !== oldState.state) {
        changedEntityIds.add(entityId);
      }
    });

    this._lastHass = hass;

    // Notify DataSources that use changed entities
    if (changedEntityIds.size > 0) {
      this._notifyAffectedDataSources(Array.from(changedEntityIds));
    }
  }

  /**
   * Notify DataSources that subscribe to changed entities
   * @private
   */
  _notifyAffectedDataSources(changedEntityIds) {
    // Iterate all DataSources and check if they use changed entities
    this._dataSources.forEach((source, sourceId) => {
      if (source.usesEntities(changedEntityIds)) {
        source.refresh(); // Trigger DataSource to re-fetch/update
      }
    });
  }
}
````

````javascript
export class RulesEngine {
  constructor(rulesConfig, systemsManager) {
    this.rules = rulesConfig || [];
    this.systems = systemsManager;
    this._hass = null;
    this._dirtyRules = new Set(); // Track which rules need re-evaluation
  }

  /**
   * Ingest HASS and mark affected rules dirty
   * @param {Object} hass - Home Assistant state object
   */
  ingestHass(hass) {
    this._hass = hass;

    // Find rules that might be affected by this HASS update
    const affectedRules = this._findAffectedRules(hass);

    affectedRules.forEach(ruleId => this._dirtyRules.add(ruleId));

    // Evaluate dirty rules immediately (no delay)
    if (this._dirtyRules.size > 0) {
      this.evaluateRules();
    }
  }

  /**
   * Find rules that might be affected by HASS changes
   * @private
   */
  _findAffectedRules(hass) {
    // Simple approach: mark all rules dirty
    // Later optimization: parse rule conditions to find entity dependencies
    return this.rules.map(r => r.id);
  }

  evaluateRules() {
    // ... existing rule evaluation logic ...
    // Clear dirty rules after evaluation
    this._dirtyRules.clear();
  }
}
````

**Checklist:**
```markdown
- [ ] SystemsManager: Replace 3 HASS copies with single _hass
- [ ] SystemsManager: Add ingestHass() method
- [ ] SystemsManager: Add _propagateHassToSystems() method
- [ ] SystemsManager: Delete _createEntityChangeHandler (250 lines)
- [ ] SystemsManager: Delete setOriginalHass, getCurrentHass, getOriginalHass
- [ ] SystemsManager: Remove all setTimeout delays (10ms, 25ms)
- [ ] DataSourceManager: Add ingestHass() method
- [ ] DataSourceManager: Add _notifyAffectedDataSources() method
- [ ] RulesEngine: Add ingestHass() method
- [ ] RulesEngine: Add _findAffectedRules() method
- [ ] Update cb-lcars.js to call systemsManager.ingestHass(hass)
- [ ] Test HASS propagation order
- [ ] Test controls get fresh HASS
- [ ] Update CHANGELOG.md
```

---

## ⚡ **Phase 2: Template Processing Consolidation (NEXT)**

Once Phase 1 PR is merged, immediately start Phase 2.

### **PR #3: Create TemplateProcessor Utility**

**Branch:** `refactor/phase-2-template-processor`

**New File:**

````javascript
/**
 * Centralized template processing for MSD
 * Handles {datasource.path:format} syntax consistently across all overlays
 */

import { cblcarsLog } from '../../cblcars-logging.js';

export class TemplateProcessor {
  static TEMPLATE_REGEX = /\{([^}:]+)(?::([^}]+))?\}/g;

  /**
   * Extract DataSource references from template content
   * @param {string} content - Content with {datasource.path} templates
   * @returns {Array<string>} Array of unique DataSource IDs
   */
  static extractReferences(content) {
    if (!content || typeof content !== 'string') return [];

    const refs = new Set();
    const matches = content.matchAll(this.TEMPLATE_REGEX);

    for (const match of matches) {
      const path = match[1].trim();
      const sourceId = path.split('.')[0];
      refs.add(sourceId);
    }

    return Array.from(refs);
  }

  /**
   * Process template string with DataSource values
   * @param {string} content - Template content
   * @param {DataSourceManager} dsManager - DataSource manager instance
   * @returns {string} Processed content with values substituted
   */
  static processTemplate(content, dsManager) {
    if (!content || typeof content !== 'string') return content;
    if (!dsManager) {
      cblcarsLog.warn('[TemplateProcessor] No DataSourceManager provided');
      return content;
    }

    return content.replace(this.TEMPLATE_REGEX, (match, path, format) => {
      const [sourceId, ...pathParts] = path.trim().split('.');

      const source = dsManager.getDataSource(sourceId);
      if (!source) {
        cblcarsLog.debug(`[TemplateProcessor] DataSource not found: ${sourceId}`);
        return match; // Keep original template if source not found
      }

      const propertyPath = pathParts.join('.');
      let value = source.getValue(propertyPath);

      if (value === undefined || value === null) {
        return match; // Keep original if value not found
      }

      // Apply format if specified
      return format ? this.formatValue(value, format) : String(value);
    });
  }

  /**
   * Format value according to format specifier
   * @param {*} value - Value to format
   * @param {string} format - Format specifier (e.g., ".1f", "°C", "kW")
   * @returns {string} Formatted value
   */
  static formatValue(value, format) {
    // Decimal precision: ".2f" → 2 decimal places
    const precisionMatch = format.match(/^\.(\d+)f$/);
    if (precisionMatch) {
      const precision = parseInt(precisionMatch[1]);
      return Number(value).toFixed(precision);
    }

    // Unit suffix: "°C", "kW", "W", etc.
    if (format.startsWith('°') || /^[a-zA-Z]+$/.test(format)) {
      return `${value}${format}`;
    }

    // Unknown format - return as-is
    return String(value);
  }

  /**
   * Check if content contains template markers
   * @param {string} content - Content to check
   * @returns {boolean} True if content has templates
   */
  static hasTemplates(content) {
    if (!content || typeof content !== 'string') return false;
    return this.TEMPLATE_REGEX.test(content);
  }
}
````

**Replace Usage in Existing Files:**

````javascript
import { TemplateProcessor } from '../utils/TemplateProcessor.js';

export class AdvancedRenderer {
  // DELETE METHOD:
  // _processTextTemplate(template) { ... }

  // REPLACE usage with:
  _updateTextOverlayContent(overlayElement, overlay, sourceData) {
    const content = TemplateProcessor.processTemplate(
      overlay.content,
      this.systems.dataSourceManager
    );
    // ... rest of method ...
  }
}
````

````javascript
import { TemplateProcessor } from '../utils/TemplateProcessor.js';

export class BaseOverlayUpdater {
  // DELETE METHOD:
  // _contentReferencesChangedDataSources(content, changedIds) { ... }

  // REPLACE with:
  _overlayReferencesChangedDataSources(overlay, changedIds) {
    if (overlay.content) {
      const refs = TemplateProcessor.extractReferences(overlay.content);
      return refs.some(ref => changedIds.includes(ref));
    }
    return false;
  }

  // DELETE METHOD:
  // _hasTemplateContent(overlay) { ... }

  // REPLACE with:
  _hasTemplateContent(overlay) {
    return overlay.content && TemplateProcessor.hasTemplates(overlay.content);
  }
}
````

````javascript
import { TemplateProcessor } from '../utils/TemplateProcessor.js';

export class ModelBuilder {
  // DELETE METHOD:
  // _extractDataSourceReferences(content) { ... }

  // If needed anywhere, use:
  // TemplateProcessor.extractReferences(content)
}
````

**Checklist:**
```markdown
- [ ] Create src/msd/utils/TemplateProcessor.js
- [ ] Implement extractReferences() method
- [ ] Implement processTemplate() method
- [ ] Implement formatValue() method
- [ ] Implement hasTemplates() method
- [ ] Remove AdvancedRenderer._processTextTemplate
- [ ] Update AdvancedRenderer to use TemplateProcessor
- [ ] Remove BaseOverlayUpdater._contentReferencesChangedDataSources
- [ ] Update BaseOverlayUpdater to use TemplateProcessor
- [ ] Remove ModelBuilder._extractDataSourceReferences
- [ ] Create tests for TemplateProcessor
- [ ] Test template extraction
- [ ] Test template processing
- [ ] Test format specifiers (.1f, .2f, °C, kW)
- [ ] Update CHANGELOG.md
```

---

## 🎯 **Execution Strategy**

**Fast Sequential Execution:**

1. **Phase 0 PR** → Review & merge ASAP
2. **Phase 1 PR** → Start immediately after Phase 0 merges
3. **Phase 2 PR** → Start immediately after Phase 1 merges
4. **Phase 3-5** → Continue pattern (one phase at a time, fast iteration)

**No Timeline Commitments:**
- Work as fast as you can review/test
- Each PR should be atomic and testable
- Merge when confident, not when calendar says so

**Ready to Start?**

Shall I draft **PR #1 (Phase 0: Dead Code Removal)** now?