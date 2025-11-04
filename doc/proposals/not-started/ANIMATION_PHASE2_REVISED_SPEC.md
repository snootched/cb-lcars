# Animation System - Phase 2 Specification (Revised)

**Status:** 📋 Planning
**Target:** Q1 2025
**Dependencies:** Phase 1.5 Complete ✅
**Estimated Effort:** 2 weeks

---

## Executive Summary

Phase 2 adds **reactive animations** that respond to real-time data changes while maintaining a clean separation of concerns:

- **Interactive triggers** (hover, tap, leave) → Defined at **overlay level**
- **Reactive/conditional triggers** → Defined in **RulesEngine**
- **Simple data change animations** → `on_datasource_change` at overlay level

This approach centralizes complex logic in RulesEngine while keeping simple cases straightforward.

### Key Changes from Original Spec

**✅ KEEPING:**
- `on_datasource_change` trigger (simple, no conditions)
- Rules integration (`animations` in `apply.overlays[]`)
- Tag-based multi-overlay targeting (already works!)

**❌ REMOVING:**
- `when` conditions on animations (use rules instead)
- Template expressions in parameters (Phase 3)
- Change direction detection (Phase 3)

**Result:** Simpler implementation, cleaner architecture, faster delivery (~2 weeks vs 4 weeks)

---

## Architecture: Separation of Concerns

### Interactive Triggers → Overlay Level

**Why:** These are **DOM element-specific** - events fire on specific elements.

```yaml
overlays:
  - id: my_button
    type: button
    animations:
      # Interactive triggers MUST be at overlay level
      - preset: glow
        trigger: on_hover
      - preset: pulse
        trigger: on_tap
      - preset: fade
        trigger: on_leave
```

**Supported Interactive Triggers:**
- `on_hover` - mouseenter (desktop only)
- `on_leave` - mouseleave (desktop only)
- `on_tap` - click/tap
- `on_hold` - long press (500ms)
- `on_double_tap` - double click/tap
- `on_load` - overlay rendered

---

### Reactive Triggers → Two Levels

#### Level 1: Simple Data Change (Overlay Level)

**Use when:** "Always animate when this data changes" (no conditions)

```yaml
overlays:
  - id: cpu_display
    type: button
    text: "CPU: {{cpu_temp}}°C"
    animations:
      - preset: pulse
        trigger: on_datasource_change
        datasource: cpu_temp    # Pulse on EVERY update
        duration: 300
```

**Behavior:**
- Triggers on ANY change to datasource value
- No filtering, no conditions
- Self-contained at overlay level
- Perfect for "draw attention on update" use case

---

#### Level 2: Conditional/Complex (RulesEngine)

**Use when:** Conditions, multi-overlay coordination, complex logic

```yaml
rules:
  - id: high_temp_alert
    when:
      source: cpu_temp
      above: 85
    apply:
      overlays:
        # Target by tag - animate multiple overlays!
        - tag: temperature_displays
          animations:
            - preset: glow
              color: var(--lcars-red)
              duration: 1000
              loop: true

        # Or target by ID
        - id: specific_button
          animations:
            - preset: pulse
              duration: 500
```

**Benefits:**
- ✅ Centralized logic (all conditions in rules)
- ✅ Tag-based multi-overlay targeting
- ✅ Reuses existing RulesEngine condition system
- ✅ No duplicate evaluation logic needed

---

## Feature 1: on_datasource_change Trigger

### Current State

Phase 1 includes validation for `on_datasource_change` but **implementation is a stub**.

### Implementation

**In AnimationManager.js:**

```javascript
/**
 * Setup datasource change listener for overlay
 * Called during overlay initialization
 *
 * @param {string} overlayId - Overlay identifier
 * @param {Array} animationDefs - Animations with trigger: on_datasource_change
 */
setupDatasourceListener(overlayId, animationDefs) {
  const dataSourceManager = this.systemsManager.dataSourceManager;

  if (!dataSourceManager) {
    cblcarsLog.warn('[AnimationManager] DataSourceManager not available');
    return;
  }

  // Group animations by datasource to avoid duplicate subscriptions
  const byDatasource = new Map();

  animationDefs.forEach(animDef => {
    if (!animDef.datasource) {
      cblcarsLog.warn(`[AnimationManager] on_datasource_change missing 'datasource' property:`, animDef);
      return;
    }

    if (!byDatasource.has(animDef.datasource)) {
      byDatasource.set(animDef.datasource, []);
    }
    byDatasource.get(animDef.datasource).push(animDef);
  });

  // Setup subscription for each unique datasource
  byDatasource.forEach((anims, datasourceName) => {
    // Handle dot notation (datasource_name.transformations.celsius)
    const [sourceName, ...pathParts] = datasourceName.split('.');
    const source = dataSourceManager.getSource(sourceName);

    if (!source) {
      cblcarsLog.warn(`[AnimationManager] Datasource not found: ${sourceName}`);
      return;
    }

    // Subscribe to datasource updates
    const unsubscribe = source.subscribe((data) => {
      cblcarsLog.debug(`[AnimationManager] Datasource change: ${datasourceName}`, data);

      // Extract value based on path if needed
      let value = data.v;
      if (pathParts.length > 0) {
        value = this._extractValueFromPath(data, pathParts);
      }

      // Trigger ALL animations for this datasource (no filtering)
      anims.forEach(animDef => {
        cblcarsLog.debug(`[AnimationManager] Triggering animation for ${overlayId} on datasource change`);
        this.playAnimation(overlayId, animDef);
      });
    });

    // Store unsubscribe function for cleanup
    if (!this.datasourceUnsubscribers) {
      this.datasourceUnsubscribers = new Map();
    }
    if (!this.datasourceUnsubscribers.has(overlayId)) {
      this.datasourceUnsubscribers.set(overlayId, []);
    }
    this.datasourceUnsubscribers.get(overlayId).push(unsubscribe);
  });
}

/**
 * Extract value from datasource using dot notation path
 * @param {Object} data - Datasource data object
 * @param {Array<string>} pathParts - Path parts (e.g., ['transformations', 'celsius'])
 * @returns {*} Extracted value
 */
_extractValueFromPath(data, pathParts) {
  let value = data;

  for (const part of pathParts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      cblcarsLog.warn(`[AnimationManager] Path not found in datasource: ${pathParts.join('.')}`);
      return undefined;
    }
  }

  return value;
}
```

**Cleanup on destroy:**

```javascript
/**
 * Cleanup method - unsubscribe from datasources
 * Called when overlay is removed or card is destroyed
 */
destroy() {
  // Existing cleanup...

  // NEW: Unsubscribe from datasources
  if (this.datasourceUnsubscribers) {
    this.datasourceUnsubscribers.forEach((unsubscribers, overlayId) => {
      unsubscribers.forEach(unsub => {
        try {
          unsub();
          cblcarsLog.debug(`[AnimationManager] Unsubscribed datasource listener for ${overlayId}`);
        } catch (error) {
          cblcarsLog.warn('[AnimationManager] Error unsubscribing from datasource:', error);
        }
      });
    });
    this.datasourceUnsubscribers.clear();
  }
}
```

**Integration in setupAnimations():**

```javascript
setupAnimations(overlayId, animations) {
  // Existing setup...

  // Setup datasource listeners
  const datasourceAnims = animations.filter(a => a.trigger === 'on_datasource_change');
  if (datasourceAnims.length > 0) {
    this.setupDatasourceListener(overlayId, datasourceAnims);
  }
}
```

---

### YAML Configuration

```yaml
data_sources:
  cpu_temp:
    type: entity
    entity: sensor.cpu_temperature
    transformations:
      - type: smooth
        method: moving_average
        window_size: 5
        key: smoothed

overlays:
  - id: cpu_indicator
    type: button
    text: "CPU: {{cpu_temp}}°C"
    animations:
      # Example 1: Simple datasource change
      - preset: pulse
        trigger: on_datasource_change
        datasource: cpu_temp
        duration: 300

      # Example 2: Using transformation path
      - preset: fade
        trigger: on_datasource_change
        datasource: cpu_temp.transformations.smoothed
        from: 0.8
        to: 1.0
        duration: 200

      # Example 3: Multiple animations on same datasource
      - preset: glow
        trigger: on_datasource_change
        datasource: cpu_temp
        color: var(--lcars-blue)
        duration: 500
```

---

## Feature 2: RulesEngine Integration

### Current State

RulesEngine can already apply changes to overlays via `apply.overlays[]`:
- `style` changes
- `text` changes
- `show`/`hide` changes

### Implementation

**Add `animations` as a new property that rules can apply.**

**In SystemsManager.js (or wherever rules are processed):**

```javascript
/**
 * Process rule application to overlays
 * @param {Object} rule - Rule definition
 * @param {Array} overlayPatches - Overlay patches from rule.apply.overlays
 */
_applyRulePatchesToOverlays(rule, overlayPatches) {
  overlayPatches.forEach(patch => {
    // Existing processing for style, text, show, hide...

    // NEW: Process animations
    if (patch.animations && Array.isArray(patch.animations)) {
      const targets = this._resolveOverlayTargets(patch); // Handles tag/id/type

      targets.forEach(overlayId => {
        // Trigger each animation
        patch.animations.forEach(animDef => {
          cblcarsLog.debug(`[Rules] Triggering animation for ${overlayId} from rule ${rule.id}`);

          // Pass to AnimationManager
          if (this.animationManager) {
            this.animationManager.playAnimation(overlayId, animDef);
          }
        });
      });
    }
  });
}
```

**Tag Resolution (already exists in RulesEngine):**

```javascript
/**
 * Resolve overlay targets from patch definition
 * @param {Object} patch - Overlay patch with id, tag, or type
 * @returns {Array<string>} Array of overlay IDs
 */
_resolveOverlayTargets(patch) {
  let targets = [];

  // By ID
  if (patch.id) {
    targets.push(patch.id);
  }

  // By tag
  if (patch.tag) {
    targets = targets.concat(this._getOverlaysByTag(patch.tag));
  }

  // By type
  if (patch.type) {
    targets = targets.concat(this._getOverlaysByType(patch.type));
  }

  return [...new Set(targets)]; // Deduplicate
}
```

---

### YAML Configuration

```yaml
overlays:
  - id: cpu_button
    type: button
    text: "CPU"
    tags: [system_monitors, temperature_displays]

  - id: gpu_button
    type: button
    text: "GPU"
    tags: [system_monitors, temperature_displays]

  - id: disk_button
    type: button
    text: "Disk"
    tags: [system_monitors]

rules:
  # Example 1: Target by tag - animate multiple overlays
  - id: high_temp_alert
    when:
      source: cpu_temp
      above: 85
    apply:
      overlays:
        - tag: temperature_displays   # Targets cpu_button & gpu_button
          animations:
            - preset: glow
              color: var(--lcars-red)
              duration: 1000
              loop: true
          style:
            background: var(--lcars-red-dark)

  # Example 2: Target by ID - single overlay
  - id: disk_full
    when:
      source: disk_usage
      above: 90
    apply:
      overlays:
        - id: disk_button
          animations:
            - preset: pulse
              scale: 1.1
              duration: 500

  # Example 3: Target by type - all buttons
  - id: motion_detected
    when:
      entity: binary_sensor.motion
      state: "on"
    apply:
      overlays:
        - type: button   # Targets ALL button overlays
          animations:
            - preset: fade
              opacity: 0.5
              duration: 200

  # Example 4: Complex condition with multiple targets
  - id: critical_system_state
    when:
      any:
        - source: cpu_temp
          above: 95
        - source: memory_usage
          above: 90
    apply:
      overlays:
        - tag: system_monitors   # All system monitors
          animations:
            - preset: pulse
              scale: 1.2
              duration: 400
            - preset: glow
              color: var(--lcars-red)
              intensity: 1.0
```

---

## Complete Example: System Monitor Dashboard

```yaml
data_sources:
  cpu_temp:
    type: entity
    entity: sensor.cpu_temperature

  cpu_usage:
    type: entity
    entity: sensor.cpu_usage

  memory_usage:
    type: entity
    entity: sensor.memory_usage

  disk_usage:
    type: entity
    entity: sensor.disk_usage

overlays:
  # CPU Monitor
  - id: cpu_monitor
    type: button
    position: [50, 100]
    size: [200, 60]
    text: "CPU: {{cpu_temp}}°C"
    tags: [system_monitors, critical_monitors, temperature_displays]
    animations:
      # Always pulse on data update (simple)
      - preset: pulse
        trigger: on_datasource_change
        datasource: cpu_temp
        duration: 200
        scale: 1.02

      # Hover interaction
      - preset: glow
        trigger: on_hover
        duration: 200
        color: var(--lcars-blue)

  # Memory Monitor
  - id: memory_monitor
    type: button
    position: [50, 180]
    size: [200, 60]
    text: "RAM: {{memory_usage}}%"
    tags: [system_monitors, critical_monitors]
    animations:
      - preset: pulse
        trigger: on_datasource_change
        datasource: memory_usage
        duration: 200

      - preset: glow
        trigger: on_hover
        duration: 200
        color: var(--lcars-blue)

  # Disk Monitor
  - id: disk_monitor
    type: button
    position: [50, 260]
    size: [200, 60]
    text: "Disk: {{disk_usage}}%"
    tags: [system_monitors]
    animations:
      - preset: pulse
        trigger: on_datasource_change
        datasource: disk_usage
        duration: 200

      - preset: glow
        trigger: on_hover
        duration: 200
        color: var(--lcars-blue)

rules:
  # Rule 1: High CPU temperature (only temperature displays)
  - id: high_cpu_temp
    when:
      source: cpu_temp
      above: 80
    apply:
      overlays:
        - tag: temperature_displays
          animations:
            - preset: glow
              color: var(--lcars-orange)
              duration: 800
              loop: true
          style:
            color: var(--lcars-orange)

  # Rule 2: Critical CPU temperature (only temperature displays)
  - id: critical_cpu_temp
    when:
      source: cpu_temp
      above: 90
    apply:
      overlays:
        - tag: temperature_displays
          animations:
            - preset: pulse
              scale: 1.15
              duration: 400
            - preset: glow
              color: var(--lcars-red)
              intensity: 1.0
              duration: 500
              loop: true
          style:
            color: var(--lcars-red)
            background: var(--lcars-red-dark)

  # Rule 3: High memory usage (specific overlay)
  - id: high_memory
    when:
      source: memory_usage
      above: 80
    apply:
      overlays:
        - id: memory_monitor
          animations:
            - preset: glow
              color: var(--lcars-orange)
              duration: 1000
              loop: true

  # Rule 4: Critical system state (any critical condition)
  - id: critical_system
    when:
      any:
        - source: cpu_temp
          above: 95
        - source: cpu_usage
          above: 95
        - source: memory_usage
          above: 95
    apply:
      overlays:
        - tag: critical_monitors   # Only critical monitors
          animations:
            - preset: pulse
              scale: 1.3
              duration: 300
            - preset: glow
              color: var(--lcars-red)
              intensity: 1.0
              duration: 400
              loop: true

  # Rule 5: Disk almost full (specific overlay)
  - id: disk_warning
    when:
      source: disk_usage
      above: 85
    apply:
      overlays:
        - id: disk_monitor
          animations:
            - preset: glow
              color: var(--lcars-red)
              duration: 1200
              loop: true
          style:
            color: var(--lcars-red)
```

---

## Configuration Validation

**In AnimationConfigProcessor.js:**

```javascript
// Validate datasource property for on_datasource_change
if (animDef.trigger === 'on_datasource_change') {
  if (!animDef.datasource) {
    issues.push({
      severity: 'error',
      message: `Animation ${index} for overlay "${overlayId}" uses on_datasource_change but missing 'datasource' property`
    });
  } else {
    // Check if datasource exists (optional - might not be available at validation time)
    // Could add datasource name format validation
  }
}

// Warn if using reserved properties that are removed in Phase 2
if (animDef.when) {
  issues.push({
    severity: 'warning',
    message: `Animation ${index} for overlay "${overlayId}" uses 'when' property - conditions should be defined in rules instead`
  });
}
```

---

## Implementation Checklist

### Core Features
- [ ] Implement `setupDatasourceListener()` in AnimationManager
- [ ] Implement `_extractValueFromPath()` helper for dot notation
- [ ] Add datasource unsubscribe cleanup in `destroy()`
- [ ] Call `setupDatasourceListener()` from `setupAnimations()`
- [ ] Add `animations` processing in rules `apply.overlays[]`
- [ ] Integrate with existing tag/ID/type resolution in RulesEngine

### Validation
- [ ] Validate `datasource` property for `on_datasource_change` trigger
- [ ] Warn if `when` property is used (deprecated - use rules)
- [ ] Add helpful error messages for missing datasources

### Testing
- [ ] Unit test: datasource subscription
- [ ] Unit test: dot notation path extraction
- [ ] Unit test: datasource unsubscribe on destroy
- [ ] Integration test: on_datasource_change triggers animation
- [ ] Integration test: rules trigger animations by ID
- [ ] Integration test: rules trigger animations by tag
- [ ] Integration test: rules trigger animations by type
- [ ] Test configuration file with complete examples

### Documentation
- [ ] Update animations.md user guide
- [ ] Add "Reactive Animations" section
- [ ] Add "on_datasource_change" examples
- [ ] Add "Rules Integration" section with tag examples
- [ ] Update architecture diagrams
- [ ] Add Phase 2 complete examples
- [ ] Update ANIMATION_QUICK_REF.md

### Performance
- [ ] Ensure no duplicate subscriptions for same datasource
- [ ] Test with high-frequency datasource updates
- [ ] Verify proper cleanup prevents memory leaks
- [ ] Profile rules-triggered animations with multiple targets

---

## Timeline Estimate

| Task | Effort |
|------|--------|
| DataSource Integration | 3 days |
| RulesEngine Integration | 2 days |
| Configuration Validation | 1 day |
| Testing | 2 days |
| Documentation | 2 days |
| **Phase 2 Total** | **10 days (~2 weeks)** |

**Reduced from 4 weeks to 2 weeks** by removing:
- Condition evaluation logic (3 days saved)
- Template resolution (2-3 days saved)
- Change direction detection (1 day saved)

---

## Benefits of This Approach

### 1. **Clear Mental Model**
- Interactive triggers → Overlay level (DOM-specific)
- Reactive triggers → Two levels (simple: overlay, complex: rules)

### 2. **Centralized Logic**
- All conditions in one place (RulesEngine)
- No duplicate evaluation code
- Consistent with CB-LCARS patterns

### 3. **Powerful Tag System**
- Animate groups of overlays together
- Theme-wide visual responses
- One rule → many overlays

### 4. **Simple for Common Cases**
- "Pulse on update" = 3 lines of YAML at overlay level
- No rule needed for simple cases

### 5. **Backward Compatible**
- Phase 1 configs work unchanged
- New features are opt-in
- No breaking changes

### 6. **Faster Implementation**
- 50% time reduction (2 weeks vs 4 weeks)
- Less code to maintain
- Fewer edge cases

---

## What Phase 3 Could Add (Future)

If users request these features later:

1. **Templates in animation parameters**
   ```yaml
   animations:
     - preset: glow
       color: "{{entity:sensor.temperature_color}}"
       duration: "{{datasource:anim_speed}}"
   ```

2. **Change direction detection**
   ```yaml
   animations:
     - preset: glow
       trigger: on_datasource_change
       datasource: temperature
       change_type: increase  # or: decrease, any
       color: var(--lcars-red)
   ```

3. **`when` conditions at overlay level** (if really needed)
   ```yaml
   animations:
     - preset: pulse
       trigger: on_datasource_change
       datasource: cpu_temp
       when:
         above: 80
   ```

4. **Animation sequences**
   ```yaml
   animations:
     - sequence:
         - preset: pulse
           duration: 200
         - preset: glow
           duration: 400
   ```

But for Phase 2: **Keep it simple!**

---

## Success Criteria

Phase 2 is complete when:

1. ✅ `on_datasource_change` triggers animations on datasource updates
2. ✅ Rules can trigger animations via `apply.overlays[].animations`
3. ✅ Tag-based targeting works (animate multiple overlays)
4. ✅ ID-based targeting works (animate specific overlay)
5. ✅ Type-based targeting works (animate all overlays of type)
6. ✅ Dot notation works for datasource paths
7. ✅ All tests pass
8. ✅ Documentation updated
9. ✅ Zero breaking changes to Phase 1 configs
10. ✅ No performance degradation

---

## Related Documents

- [Animation System Phase 1](./ANIMATION_SYSTEM_PHASE1_COMPLETE.md)
- [Animation System Phase 1.5](../../PHASE1_5_COMPLETE.md)
- [Animation System Architecture](../architecture/ANIMATION_SYSTEM_ARCHITECTURE.md)
- [User Guide: Animations](../user-guide/guides/animations.md)
- [Rules Engine Documentation](../user-guide/configuration/rules.md)

---

*Phase 2 Specification - Revised v2.0*
*Created: November 2, 2025*
*Revised to focus on pragmatic, maintainable implementation*
