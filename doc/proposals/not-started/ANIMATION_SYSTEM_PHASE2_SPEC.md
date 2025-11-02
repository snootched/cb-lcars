# Animation System - Phase 2 Specification

**Status:** 📋 Planning
**Target:** Q1 2025
**Dependencies:** Phase 1 Complete ✅
**Estimated Effort:** 2-3 weeks

---

## Executive Summary

Phase 2 integrates the Animation System with DataSourceManager and RulesEngine, enabling **reactive animations** that respond to real-time data changes. This phase maintains consistency with existing CB-LCARS patterns for entity/datasource handling while adding powerful new animation capabilities.

### Key Goals

1. **DataSource-Driven Animations** - Animate based on sensor values, entity states, and datasource changes
2. **Conditional Animations** - Execute animations only when specific conditions are met
3. **Rules Integration** - Trigger animations from RulesEngine evaluation
4. **Template Resolution** - Support `{{entity_id}}` and datasource references in animation parameters
5. **Consistency** - Align with existing entity/datasource patterns throughout CB-LCARS

---

## Architecture Alignment

### Existing Patterns We'll Follow

CB-LCARS has **mature, consistent patterns** for entity and datasource handling:

#### 1. Entity References
```yaml
# Pattern used in Rules, Templates, DataSources
entity: sensor.temperature
entity: light.living_room
```

#### 2. DataSource Dot Notation
```yaml
# Pattern used everywhere
source: datasource_name
source: datasource_name.transformations.celsius
source: datasource_name.aggregations.daily_min
```

#### 3. Template Expressions
```yaml
# Pattern used in MsdTemplateEngine
text: "{{entity:sensor.temperature}} °F"
text: "{{datasource_name.transformations.celsius}}"
```

#### 4. Condition Evaluation
```yaml
# Pattern used in RulesEngine
when:
  entity: sensor.temperature
  above: 25
# or
when:
  source: temp_sensor.transformations.fahrenheit
  above: 77
```

### Phase 2 Compliance

**WE WILL NOT** create new patterns. **WE WILL** use existing patterns consistently.

---

## Feature 1: on_datasource_change Trigger

### Current State

Phase 1 includes infrastructure but trigger is **not yet functional**:
- `on_datasource_change` is accepted in YAML
- TriggerManager has placeholder code
- AnimationManager has placeholder method `setupDatasourceListener()`

### Implementation Strategy

#### Option A: Simple Change Detection (Recommended)

**Pros:**
- Consistent with existing patterns
- Simple to understand and configure
- Covers 90% of use cases

**Behavior:**
- Triggers whenever datasource emits new data
- No distinction between up/down/no-change
- Conditions can filter what animations execute

**YAML Pattern:**
```yaml
overlays:
  - id: cpu_status
    type: button
    text: "CPU"
    animations:
      - preset: pulse
        trigger: on_datasource_change
        datasource: cpu_temp
        # Animation plays on EVERY update to cpu_temp
        # Optional: Add conditions to filter when it plays
        when:
          above: 80
```

#### Option B: Change Direction Detection

**Pros:**
- More granular control
- Can animate differently for up vs down

**Cons:**
- More complex
- Requires storing previous value
- Might be overkill for Phase 2

**YAML Pattern (if we want this):**
```yaml
animations:
  - preset: glow
    trigger: on_datasource_change
    datasource: cpu_temp
    change_type: increase  # or: decrease, any (default)
    when:
      above: 80
```

### Recommendation: Start with Option A

**Rationale:**
1. Keep it simple for Phase 2
2. Existing condition system handles filtering
3. Can add `change_type` in Phase 3 if needed
4. Matches how RulesEngine works today (doesn't distinguish up/down)

### Technical Implementation

**In AnimationManager.js:**

```javascript
/**
 * Setup datasource change listener for overlay
 * @param {string} overlayId - Overlay identifier
 * @param {Array} animationDefs - Animation definitions with trigger: on_datasource_change
 */
setupDatasourceListener(overlayId, animationDefs) {
  const dataSourceManager = this.systemsManager.dataSourceManager;

  if (!dataSourceManager) {
    cblcarsLog.warn('[AnimationManager] DataSourceManager not available for datasource triggers');
    return;
  }

  // Group animations by datasource to avoid duplicate subscriptions
  const byDatasource = new Map();

  animationDefs.forEach(animDef => {
    if (!animDef.datasource) {
      cblcarsLog.warn(`[AnimationManager] on_datasource_change animation missing 'datasource' property:`, animDef);
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
      // Extract value based on path
      const value = pathParts.length > 0
        ? this._extractValueFromPath(data, pathParts)
        : data.v;

      // Evaluate each animation's conditions
      anims.forEach(animDef => {
        const shouldPlay = this._evaluateAnimationConditions(animDef, value, data);

        if (shouldPlay) {
          // Resolve any templates in animation parameters
          const resolvedParams = this._resolveTemplates(animDef, {
            datasource: datasourceName,
            value,
            data
          });

          this.triggerAnimations(overlayId, 'on_datasource_change', resolvedParams);
        }
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
```

**Cleanup on destroy:**

```javascript
destroy() {
  // Existing cleanup...

  // NEW: Unsubscribe from datasources
  if (this.datasourceUnsubscribers) {
    this.datasourceUnsubscribers.forEach((unsubscribers) => {
      unsubscribers.forEach(unsub => {
        try {
          unsub();
        } catch (error) {
          cblcarsLog.warn('[AnimationManager] Error unsubscribing from datasource:', error);
        }
      });
    });
    this.datasourceUnsubscribers.clear();
  }
}
```

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
    text: "CPU"
    animations:
      # Example 1: Simple datasource change
      - preset: pulse
        trigger: on_datasource_change
        datasource: cpu_temp
        duration: 300

      # Example 2: With condition
      - preset: glow
        trigger: on_datasource_change
        datasource: cpu_temp
        when:
          above: 80
        color: var(--lcars-red)

      # Example 3: Using transformation
      - preset: fade
        trigger: on_datasource_change
        datasource: cpu_temp.transformations.smoothed
        when:
          below: 40
```

---

## Feature 2: Entity State Conditions

### Current State

- RulesEngine has robust condition evaluation
- Supports entity states, numeric comparisons, time conditions
- Already handles both HA entities AND datasource references

### Implementation Strategy

**Reuse RulesEngine condition evaluation** - Don't duplicate logic!

#### Pattern Consistency

RulesEngine uses this pattern:
```yaml
rules:
  - when:
      entity: sensor.temperature
      above: 25
    apply:
      # ...
```

Animations should use the **same pattern**:
```yaml
animations:
  - preset: pulse
    trigger: on_datasource_change
    datasource: cpu_temp
    when:
      above: 80    # Same as rules!
```

### Supported Conditions

Leverage **existing RulesEngine condition types**:

#### 1. Numeric Comparisons
```yaml
when:
  above: 80      # Greater than
  below: 40      # Less than
  equals: 50     # Exact match (numeric or string)
```

#### 2. State Matching
```yaml
when:
  state: "on"    # Exact state match
  # Used for lights, switches, binary sensors
```

#### 3. Range Checking
```yaml
when:
  between: [20, 25]  # Value in range (inclusive)
```

#### 4. Entity Conditions
```yaml
when:
  entity: light.living_room
  state: "on"
  # Check ANOTHER entity's state
```

#### 5. Logical Operators (Future - Phase 3)
```yaml
when:
  all:  # AND
    - above: 70
    - entity: light.bedroom
      state: "on"
  any:  # OR
    - below: 40
    - entity: binary_sensor.motion
      state: "on"
```

### Technical Implementation

**In AnimationManager.js:**

```javascript
/**
 * Evaluate animation conditions using RulesEngine patterns
 * @param {Object} animDef - Animation definition with optional 'when' conditions
 * @param {*} value - Current value from datasource
 * @param {Object} data - Full datasource data object
 * @returns {boolean} True if conditions pass (or no conditions)
 */
_evaluateAnimationConditions(animDef, value, data) {
  // No conditions = always play
  if (!animDef.when) {
    return true;
  }

  const conditions = animDef.when;

  // Numeric comparisons (value from datasource)
  if (conditions.above !== undefined) {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= conditions.above) {
      return false;
    }
  }

  if (conditions.below !== undefined) {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue >= conditions.below) {
      return false;
    }
  }

  if (conditions.equals !== undefined) {
    if (value != conditions.equals) {
      return false;
    }
  }

  if (conditions.between !== undefined) {
    const [min, max] = conditions.between;
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < min || numValue > max) {
      return false;
    }
  }

  if (conditions.state !== undefined) {
    const stateValue = String(value);
    if (stateValue !== conditions.state) {
      return false;
    }
  }

  // Entity condition (check ANOTHER entity)
  if (conditions.entity) {
    const entityData = this._getEntityValue(conditions.entity);
    if (!entityData) {
      cblcarsLog.warn(`[AnimationManager] Condition entity not found: ${conditions.entity}`);
      return false;
    }

    // Recursively evaluate entity conditions
    // (Reuse same logic for nested entity conditions)
    return this._evaluateAnimationConditions(
      { when: conditions },
      entityData.state,
      entityData
    );
  }

  // All conditions passed
  return true;
}

/**
 * Get entity value (HA entity or datasource)
 * @private
 */
_getEntityValue(entityRef) {
  const dataSourceManager = this.systemsManager.dataSourceManager;

  if (!dataSourceManager) {
    // Fallback to HASS
    return this.systemsManager.hass?.states?.[entityRef] || null;
  }

  // Use DataSourceManager's getEntity (handles both HA and datasources)
  return dataSourceManager.getEntity(entityRef);
}
```

### YAML Examples

```yaml
# Example 1: Simple threshold
animations:
  - preset: glow
    trigger: on_datasource_change
    datasource: cpu_temp
    when:
      above: 80
    color: var(--lcars-red)

# Example 2: Range condition
animations:
  - preset: pulse
    trigger: on_datasource_change
    datasource: humidity
    when:
      between: [30, 70]
    duration: 500

# Example 3: State matching
animations:
  - preset: fade
    trigger: on_datasource_change
    datasource: motion_sensor
    when:
      state: "detected"
    duration: 300

# Example 4: Cross-entity condition
animations:
  - preset: glow
    trigger: on_datasource_change
    datasource: cpu_temp
    when:
      entity: light.office
      state: "on"
      # Only animate when office light is on
```

---

## Feature 3: RulesEngine Integration

### Current State

- RulesEngine has `apply.overlays[]` pattern
- Already supports `style`, `text`, `visibility` changes
- No animation support yet

### Implementation Strategy

Add `animations` array to overlay patches in rules.

#### YAML Pattern

```yaml
rules:
  - id: high_temp_alert
    priority: 100
    when:
      entity: sensor.temperature
      above: 25
    apply:
      overlays:
        - id: temp_display
          style:
            color: var(--lcars-red)  # Existing feature
          animations:                 # NEW in Phase 2
            - preset: pulse
              duration: 500
            - preset: glow
              color: var(--lcars-red)
              duration: 1000
```

### Technical Implementation

**In RulesEngine.js:**

```javascript
// In evaluateRule() method - EXISTING CODE at line ~420
if (matched && rule.apply) {
  result.overlayPatches = this._resolveOverlaySelectors(rule.apply);
  result.profilesAdd = rule.apply.profiles_add || [];
  result.profilesRemove = rule.apply.profiles_remove || [];
  result.animations = rule.apply.animations || [];
  result.baseSvgUpdate = rule.apply.base_svg || null;
  result.stopAfter = rule.stop === true;

  // NEW: Process overlay animations
  if (result.overlayPatches) {
    result.overlayPatches.forEach(patch => {
      if (patch.animations) {
        // Store animations for AnimationManager
        if (!result.overlayAnimations) {
          result.overlayAnimations = new Map();
        }
        result.overlayAnimations.set(patch.id, patch.animations);
      }
    });
  }
}
```

**In SystemsManager.js** (where rules are applied):

```javascript
// In _handleEntityChanges() - EXISTING CODE at line ~515
if (this.rulesEngine) {
  const getEntity = (entityId) => {
    // ... existing logic
  };

  const rulesResult = this.rulesEngine.evaluateDirty(getEntity);

  if (rulesResult.hasMatches) {
    // EXISTING: Apply style changes
    this._applyRuleResults(rulesResult);

    // NEW: Trigger rule-based animations
    if (this.animationManager && rulesResult.overlayAnimations) {
      rulesResult.overlayAnimations.forEach((animations, overlayId) => {
        animations.forEach(animDef => {
          this.animationManager.playAnimation(overlayId, {
            ...animDef,
            trigger_source: 'rules_engine'
          });
        });
      });
    }
  }
}
```

### YAML Examples

```yaml
# Example 1: Critical alert with multiple animations
rules:
  - id: critical_cpu
    when:
      entity: sensor.cpu_temperature
      above: 90
    apply:
      overlays:
        - id: cpu_status
          style:
            color: var(--lcars-red)
          animations:
            - preset: pulse
              duration: 300
            - preset: glow
              color: var(--lcars-red)
              duration: 1000

# Example 2: Multi-overlay animation
rules:
  - id: motion_detected
    when:
      entity: binary_sensor.motion
      state: "on"
    apply:
      overlays:
        - type: button
          animations:  # Animate ALL buttons
            - preset: fade
              opacity: 0.3
              duration: 200

# Example 3: Conditional animation based on time
rules:
  - id: night_mode
    when:
      time:
        after: "22:00"
        before: "06:00"
    apply:
      base_svg:
        filters:
          opacity: 0.3
      overlays:
        - type: text
          animations:
            - preset: pulse
              duration: 3000
```

---

## Feature 4: Template Resolution

### Current State

- MsdTemplateEngine handles `{{entity_id}}` and datasource references
- Used in text overlays, rules, datasources
- NOT yet integrated with animation parameters

### Implementation Strategy

Support template expressions in animation **parameter values**.

#### Supported Templates

```yaml
# Entity references
color: "{{entity:sensor.temperature_color}}"
duration: "{{entity:input_number.animation_speed}}"

# Datasource references
opacity: "{{cpu_temp.transformations.normalized}}"
scale: "{{humidity.aggregations.comfort_index}}"

# State attributes
hue: "{{entity:light.bedroom.attributes.hue}}"
```

### Technical Implementation

**In AnimationManager.js:**

```javascript
/**
 * Resolve template expressions in animation parameters
 * @param {Object} animDef - Animation definition
 * @param {Object} context - Context data (datasource value, entity, etc.)
 * @returns {Object} Resolved animation definition
 */
_resolveTemplates(animDef, context = {}) {
  const resolved = { ...animDef };

  // Get template engine
  const templateEngine = this.systemsManager.templateEngine;
  if (!templateEngine) {
    return resolved; // No template engine available
  }

  // Parameters that might contain templates
  const templateParams = [
    'color', 'duration', 'delay', 'opacity',
    'scale', 'rotate', 'translateX', 'translateY',
    'easing', 'loop', 'direction'
  ];

  templateParams.forEach(param => {
    if (resolved[param] && typeof resolved[param] === 'string') {
      // Check if it's a template
      if (resolved[param].includes('{{')) {
        try {
          // Prepare context for template engine
          const templateContext = {
            hass: this.systemsManager.hass,
            dataSourceManager: this.systemsManager.dataSourceManager,
            ...context
          };

          // Resolve template
          const resolvedValue = templateEngine.resolve(
            resolved[param],
            templateContext
          );

          // Convert to appropriate type
          if (param === 'duration' || param === 'delay' || param === 'loop') {
            resolved[param] = parseInt(resolvedValue, 10);
          } else if (param === 'opacity' || param === 'scale') {
            resolved[param] = parseFloat(resolvedValue);
          } else {
            resolved[param] = resolvedValue;
          }

          cblcarsLog.debug(
            `[AnimationManager] Resolved template ${param}: "${animDef[param]}" → "${resolved[param]}"`
          );
        } catch (error) {
          cblcarsLog.warn(
            `[AnimationManager] Failed to resolve template for ${param}:`,
            error
          );
        }
      }
    }
  });

  return resolved;
}
```

### YAML Examples

```yaml
data_sources:
  cpu_temp:
    type: entity
    entity: sensor.cpu_temperature
    transformations:
      - type: scale
        input_range: [30, 100]
        output_range: [0, 1]
        key: normalized

overlays:
  - id: cpu_indicator
    type: button
    text: "CPU"
    animations:
      # Example 1: Dynamic duration based on entity
      - preset: pulse
        trigger: on_tap
        duration: "{{entity:input_number.animation_speed}}"

      # Example 2: Dynamic color from entity attribute
      - preset: glow
        trigger: on_hover
        color: "{{entity:input_select.theme_color}}"

      # Example 3: Opacity based on datasource value
      - preset: fade
        trigger: on_datasource_change
        datasource: cpu_temp
        opacity: "{{cpu_temp.transformations.normalized}}"

      # Example 4: Complex expression
      - preset: pulse
        trigger: on_datasource_change
        datasource: cpu_temp
        duration: "{{ 1000 - (cpu_temp.transformations.normalized * 500) }}"
        # Higher temp = faster pulse
```

---

## Testing Strategy

### Unit Tests

1. **DataSource Subscription**
   - Subscribe to datasource updates
   - Verify callback execution
   - Test unsubscribe cleanup

2. **Condition Evaluation**
   - Numeric comparisons (above, below, equals, between)
   - State matching
   - Entity cross-references

3. **Template Resolution**
   - Entity templates
   - Datasource templates
   - Attribute access
   - Error handling

### Integration Tests

1. **End-to-End DataSource Animation**
   - Configure datasource
   - Add animation with trigger
   - Simulate datasource update
   - Verify animation plays

2. **Rules Integration**
   - Create rule with animations in apply block
   - Trigger rule condition
   - Verify animations execute

3. **Template Resolution**
   - Animation with template parameters
   - Update entity/datasource
   - Verify resolved values update

### Test Configuration

```yaml
# test-animation-phase2.yaml
msd:
  version: 1
  base_svg:
    source: "builtin:ncc-1701-d"

  data_sources:
    test_sensor:
      type: entity
      entity: sensor.test_temperature
      transformations:
        - type: scale
          input_range: [0, 100]
          output_range: [0, 1]
          key: normalized

  overlays:
    - id: test_button
      type: button
      text: "Test"
      position: [100, 100]
      animations:
        # Test 1: Simple datasource trigger
        - preset: pulse
          trigger: on_datasource_change
          datasource: test_sensor
          duration: 300

        # Test 2: With condition
        - preset: glow
          trigger: on_datasource_change
          datasource: test_sensor
          when:
            above: 50
          color: var(--lcars-red)

        # Test 3: Template resolution
        - preset: fade
          trigger: on_tap
          opacity: "{{test_sensor.transformations.normalized}}"

  rules:
    - id: test_rule
      when:
        entity: sensor.test_temperature
        above: 75
      apply:
        overlays:
          - id: test_button
            style:
              color: var(--lcars-red)
            animations:
              - preset: pulse
                duration: 500
```

---

## Documentation Updates

### User Guide: Animations

Add new sections:

#### DataSource-Driven Animations
- How to use on_datasource_change
- When to use conditions vs unconditional
- Examples with transformations and aggregations

#### Animation Conditions
- All supported condition types
- Entity cross-references
- Best practices

#### Template Expressions
- Syntax guide
- Supported parameters
- Examples

### API Documentation

Update Runtime API:
- No changes needed (already supports parameters)

Update Debug API:
- Add datasource subscription info to `inspect()`
- Show active datasource listeners

---

## Performance Considerations

### DataSource Subscriptions

**Concern:** Too many subscriptions could impact performance

**Mitigation:**
1. **Group by datasource** - One subscription per datasource, not per animation
2. **Efficient condition evaluation** - Early exit when conditions fail
3. **Debouncing** - Option to debounce rapid datasource updates
4. **Unsubscribe cleanup** - Proper cleanup when overlays destroyed

### Rule Evaluation

**Concern:** Rules trigger on every entity change

**Mitigation:**
1. **Dirty marking** - RulesEngine already does this efficiently
2. **Animation queueing** - Don't spam animations
3. **Cooldown period** - Optional cooldown for rule-triggered animations

### Template Resolution

**Concern:** Template resolution on every update

**Mitigation:**
1. **Cache resolved values** - When possible
2. **Lazy resolution** - Only resolve when animation plays
3. **Template engine optimization** - MsdTemplateEngine is already optimized

---

## Phase 1.5: Critical Fix - on_leave Trigger

### Issue Discovered

**Problem:** `on_hover` animations with `loop: true` continue running after pointer leaves the element.

**Current Behavior:**
```yaml
animations:
  - preset: glow
    trigger: on_hover
    loop: true  # Loops forever once triggered
```

**Expected Behavior:**
- Animation starts on `mouseenter`
- Animation stops on `mouseleave`

### Root Cause

`ActionHelpers.js` only handles `mouseenter` for hover animations, but does not handle `mouseleave` to stop them.

### Solution: Add on_leave Trigger

**Implementation in ActionHelpers.js:**

```javascript
// Add hover support for animations (desktop only)
if (animationManager && overlayId) {
  const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (isDesktop) {
    // On hover - start animations
    const hoverHandler = () => {
      cblcarsLog.debug(`[ActionHelpers] 🖱️ Hover triggered on ${overlayId}`);
      animationManager.triggerAnimations(overlayId, 'on_hover');
    };
    element.addEventListener('mouseenter', hoverHandler, { capture: false });

    // ✨ NEW: On leave - stop or trigger leave animations
    const leaveHandler = () => {
      cblcarsLog.debug(`[ActionHelpers] 🖱️ Leave triggered on ${overlayId}`);

      // Option A: Stop all hover animations
      animationManager.stopAnimations(overlayId, 'on_hover');

      // Option B: Trigger on_leave animations (if configured)
      animationManager.triggerAnimations(overlayId, 'on_leave');
    };
    element.addEventListener('mouseleave', leaveHandler, { capture: false });

    cblcarsLog.debug(`[ActionHelpers] ✅ Hover/leave handlers attached for ${overlayId}`);
  }
}
```

**Required AnimationManager Methods:**

```javascript
/**
 * Stop animations for a specific overlay and trigger type
 * @param {string} overlayId - Overlay identifier
 * @param {string} trigger - Trigger type to stop (e.g., 'on_hover')
 */
stopAnimations(overlayId, trigger) {
  const scope = this.scopes.get(overlayId);
  if (!scope) {
    return;
  }

  // Get animations for this trigger
  const triggerAnims = scope.animations?.filter(anim => anim.trigger === trigger);

  if (!triggerAnims || triggerAnims.length === 0) {
    return;
  }

  // Stop each animation
  triggerAnims.forEach(anim => {
    if (anim.animeInstance) {
      anim.animeInstance.pause();
      cblcarsLog.debug(`[AnimationManager] ⏸️ Stopped ${trigger} animation on ${overlayId}`);
    }
  });
}
```

### YAML Configuration

```yaml
overlays:
  - id: status_button
    type: button
    text: "Status"
    animations:
      # Hover animation - stops on leave automatically
      - preset: glow
        trigger: on_hover
        loop: true
        color: var(--lcars-blue)

      # Optional: Explicit leave animation
      - preset: fade
        trigger: on_leave
        opacity: 1.0
        duration: 200
```

### Behavior Options

**Option A: Automatic Stop (Recommended)**
- `on_hover` animations with `loop: true` auto-stop on `mouseleave`
- Simple, predictable behavior
- No config needed

**Option B: on_leave Trigger**
- Add `on_leave` as a new trigger type
- Allows custom animations when pointer leaves
- More flexibility but more complex

**Recommendation:** Implement **both**:
1. Auto-stop looping `on_hover` animations on `mouseleave`
2. Support `on_leave` trigger for custom exit animations

### Implementation Checklist

- [ ] Add `stopAnimations()` method to AnimationManager
- [ ] Add `mouseleave` handler in ActionHelpers
- [ ] Add `on_leave` to supported trigger types
- [ ] Update AnimationConfigProcessor to accept `on_leave`
- [ ] Test hover → leave behavior
- [ ] Update user documentation
- [ ] Add example configurations

### Priority

**HIGH** - This is a quality-of-life fix that should be done before Phase 2 starts.

**Effort:** 1-2 days

---

## Migration from Phase 1

### Breaking Changes

**NONE** - Phase 2 is purely additive.

### New Features

1. `on_datasource_change` trigger becomes functional
2. `when` conditions in animations (new property)
3. `animations` array in `rules[].apply.overlays[]` (new property)
4. Template expressions in animation parameters (new feature)

### Backward Compatibility

All Phase 1 configs continue to work unchanged.

---

## Implementation Checklist

### Phase 1.5 - Critical Fix
- [ ] Add `stopAnimations()` method to AnimationManager
- [ ] Add `mouseleave` handler in ActionHelpers for `on_leave`
- [ ] Add `on_leave` to AnimationConfigProcessor valid triggers
- [ ] Update TriggerManager to handle `on_leave` (if needed)
- [ ] Test hover/leave animation lifecycle
- [ ] Update animations.md user guide with on_leave examples
- [ ] Add on_leave to trigger reference documentation

### Phase 2 - Core Features
- [ ] `setupDatasourceListener()` implementation in AnimationManager
- [ ] `_evaluateAnimationConditions()` implementation
- [ ] `_resolveTemplates()` implementation
- [ ] `_extractValueFromPath()` helper for dot notation
- [ ] Datasource unsubscribe cleanup in `destroy()`
- [ ] Rate limiting - `cooldown` property support
- [ ] Track last play time per animation
- [ ] Enforce cooldown period before replaying

### RulesEngine Integration
- [ ] Process `animations` in overlay patches
- [ ] Trigger animations from SystemsManager rule handling
- [ ] Add `overlayAnimations` to rules result object

### Configuration Processing
- [ ] Validate `datasource` property in animation definitions
- [ ] Validate `when` conditions
- [ ] Support template strings in parameter values

### Testing
- [ ] Unit tests for datasource subscription
- [ ] Unit tests for condition evaluation
- [ ] Unit tests for template resolution
- [ ] Integration test for end-to-end datasource animation
- [ ] Integration test for rules animation
- [ ] Test configuration file

### Documentation
- [ ] Update animations.md user guide
- [ ] Add datasource-driven animations section
- [ ] Add conditions reference
- [ ] Add template expression guide
- [ ] Update API documentation
- [ ] Add Phase 2 examples

### Performance
- [ ] Benchmark datasource subscriptions
- [ ] Implement debouncing option
- [ ] Add cooldown period option
- [ ] Profile rule-triggered animations

---

## Design Decisions ✅

### 1. Change Direction Detection

**Decision:** ✅ **Keep simple** - trigger on any change (Phase 2)

**Rationale:**
- Consistent with existing patterns
- Conditions can filter when animations execute
- Can add `change_type: increase|decrease` in Phase 3 if users request it

### 2. Multiple Triggers per Animation

**Decision:** ✅ **Not needed** - users can define multiple animation objects

**Rationale:**
- Unclear semantics (simultaneous? sequential?)
- Current pattern is clear and explicit
- No compelling use case identified

**Example:**
```yaml
# Instead of: triggers: [on_tap, on_hover]
# Use separate definitions:
animations:
  - preset: pulse
    trigger: on_tap
    duration: 300
  - preset: pulse
    trigger: on_hover
    duration: 300
```

### 3. Animation Rate Limiting

**Decision:** ✅ **Add optional `cooldown` property** (milliseconds)

**Rationale:**
- Prevents spam from rapid datasource updates
- Optional - doesn't impact existing behavior
- Per-animation control

**Example:**
```yaml
animations:
  - preset: glow
    trigger: on_datasource_change
    datasource: cpu_temp
    cooldown: 500  # Min 500ms between plays
```

### 4. Template Caching

**Decision:** ✅ **Resolve fresh on each animation play**

**Rationale:**
- Templates reference dynamic values that change frequently
- Caching would require invalidation logic
- Performance impact is minimal (templates are already optimized)

### 5. Tag-Based Targeting in Rules

**Decision:** ✅ **Already supported** via RulesEngine selectors

**Rationale:**
- RulesEngine already supports `type:button`, `all:`, etc.
- Adding `animations[]` to overlay patches means tags work automatically
- No additional work needed

**Example:**
```yaml
rules:
  - id: animate_all_buttons
    when:
      entity: binary_sensor.motion
      state: "on"
    apply:
      overlays:
        - type: button  # Tag-based selector
          animations:
            - preset: pulse
              duration: 300
```

---

## Success Criteria

Phase 2 is complete when:

1. ✅ Animations respond to datasource changes
2. ✅ Condition evaluation works for all supported types
3. ✅ Rules can trigger animations via `apply.overlays[].animations`
4. ✅ Template expressions resolve in animation parameters
5. ✅ All tests pass
6. ✅ Documentation updated
7. ✅ No performance degradation
8. ✅ Zero breaking changes to Phase 1 configs

---

## Timeline Estimate

### Phase 1.5 (Critical Fix)
| Task | Effort |
|------|--------|
| Add stopAnimations() method | 0.5 days |
| Add on_leave handler in ActionHelpers | 0.5 days |
| Update trigger validation | 0.5 days |
| Testing and documentation | 0.5 days |
| **Phase 1.5 Total** | **2 days** |

### Phase 2 (Main Features)
| Task | Effort | Dependencies |
|------|--------|--------------|
| DataSource Integration | 3-4 days | - |
| Condition Evaluation | 2-3 days | - |
| RulesEngine Integration | 2 days | - |
| Template Resolution | 2-3 days | MsdTemplateEngine |
| Rate Limiting (cooldown) | 1 day | - |
| Testing | 2-3 days | All above |
| Documentation | 2 days | All above |
| **Phase 2 Total** | **14-18 days** | **~3-4 weeks** |

### Combined Timeline
**Phase 1.5 + Phase 2: ~3.5-4 weeks total**

---

## Related Documents

- [Animation System Phase 1](./ANIMATION_SYSTEM_PHASE1_COMPLETE.md)
- [Animation System Architecture](../architecture/ANIMATION_SYSTEM_ARCHITECTURE.md)
- [User Guide: Animations](../user-guide/guides/animations.md)
- [Rules Engine Documentation](../user-guide/configuration/rules.md)

---

*Phase 2 Specification - Draft v1.0*
*Created: November 2, 2025*
