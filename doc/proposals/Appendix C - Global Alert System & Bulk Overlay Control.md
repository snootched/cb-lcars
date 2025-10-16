# MSD ApexCharts Enhancement Proposal - Appendix C (Final)

**Version:** 1.0.0  
**Date:** 2025-01-16  
**Status:** Proposed - Appendix (FINAL)  
**Author:** CB-LCARS MSD Team

---

## Appendix C: Global Alert System & Bulk Overlay Control

This appendix addresses system-wide alert states that affect multiple overlays simultaneously through enhanced RulesEngine capabilities for bulk overlay targeting.

---

## C.1 Use Case: Global Alert States

### C.1.1 LCARS Alert Conditions

**From Star Trek canon:**

| Alert Level | Visual State | Color Scheme | Behavior |
|-------------|--------------|--------------|----------|
| **Red Alert** | Maximum danger | All red, enhanced borders | Critical threat (battle, core breach) |
| **Yellow Alert** | Elevated caution | Yellow/orange highlights | Potential threat, heightened readiness |
| **Blue Alert** | Atmospheric landing | Blue highlights | Saucer separation, landing procedures |
| **Intruder Alert** | Security breach | Red borders on security systems | Unauthorized personnel detected |
| **Normal** | Standard operation | Standard LCARS colors | Day-to-day operations |

### C.1.2 Requirements

**Goal:** Single Home Assistant entity controls entire MSD visual state.

**Example Helper Entity:**
```yaml
# Home Assistant configuration.yaml
input_select:
  ship_alert_status:
    name: "Ship Alert Status"
    options:
      - "normal"
      - "yellow_alert"
      - "red_alert"
      - "blue_alert"
      - "intruder_alert"
    initial: "normal"
    icon: mdi:alert
```

**Desired Behavior:**
- Set `input_select.ship_alert_status` to `"red_alert"`
- ALL overlays immediately switch to danger styling
- ALL charts turn red
- Text overlays show critical colors
- Status grids highlight in red
- **Without listing every overlay individually**

---

## C.2 Current Limitation: Individual Overlay Targeting

### C.2.1 Problem Statement

**Current RulesEngine requires targeting each overlay by ID:**

```yaml
# Current approach (unmaintainable with 20+ overlays)
rules:
  - id: red_alert_all_overlays
    when:
      all:
        - entity: input_select.ship_alert_status
          state: "red_alert"
    then:
      overlays:
        text1: { style: { color: "colors.status.danger" } }
        text2: { style: { color: "colors.status.danger" } }
        text3: { style: { color: "colors.status.danger" } }
        chart1: { style: { color: "colors.status.danger" } }
        chart2: { style: { color: "colors.status.danger" } }
        grid1: { style: { color: "colors.status.danger" } }
        # ... must list EVERY overlay (50+?)
```

**Issues:**
- ❌ Unmaintainable with many overlays
- ❌ Error-prone (easy to miss overlays)
- ❌ Fragile (breaks when adding/removing overlays)
- ❌ Verbose configuration files

---

## C.3 Solution: Bulk Overlay Selectors

### C.3.1 Selector Keywords

**New overlay targeting system with special selectors:**

```yaml
rules:
  - id: red_alert_all_overlays
    when:
      all:
        - entity: input_select.ship_alert_status
          state: "red_alert"
    then:
      overlays:
        all:  # NEW: Target all overlays at once
          style:
            color: "colors.status.danger"
```

**Result:** One rule updates every overlay in the MSD.

### C.3.2 Supported Selectors

| Selector | Syntax | Description | Example |
|----------|--------|-------------|---------|
| **All overlays** | `all:` | Targets every overlay in MSD | `all: { style: { color: red } }` |
| **By type** | `type:typename:` | Targets overlays of specific type | `type:text:`, `type:apexchart:`, `type:status_grid:` |
| **By tag** | `tag:tagname:` | Targets overlays with specific tag | `tag:critical:`, `tag:engineering:` |
| **By ID pattern** | `pattern:regex:` | Targets overlays matching regex | `pattern:^temp_.*:` (all starting with "temp_") |
| **Exclude** | `exclude:[ids]` | All except listed IDs | `exclude:[control1, control2]` |

### C.3.3 Overlay Tagging System

**Add optional `tags` property to overlays:**

```yaml
overlays:
  # Tag overlays for flexible bulk control
  - id: warp_core_temp
    type: apexchart
    source: warp_core_temperature
    tags: ["critical", "engineering", "alert-sensitive"]
    position: [50, 100]
    size: [300, 150]
    
  - id: shield_status
    type: status_grid
    source: shield_power
    tags: ["critical", "tactical", "alert-sensitive"]
    position: [50, 270]
    size: [200, 100]
    
  - id: crew_roster
    type: text
    content: "CREW ROSTER"
    tags: ["informational"]  # Won't change on alerts
    position: [370, 100]
```

**Benefits:**
- ✅ Semantic grouping of overlays
- ✅ Multiple tags per overlay
- ✅ Flexible targeting in rules
- ✅ Self-documenting configuration

---

## C.4 Implementation: Enhanced RulesEngine

### C.4.1 Overlay Schema Update

**Add `tags` property to overlay schema:**

```javascript
// src/msd/config/overlaySchema.js (enhancement)

export const overlayBaseSchema = {
  id: { type: 'string', required: true },
  type: { type: 'string', required: true },
  
  // NEW: Optional tags for bulk targeting
  tags: {
    type: 'array',
    required: false,
    items: { type: 'string' },
    description: 'Tags for bulk rule targeting (e.g., ["critical", "engineering"])'
  },
  
  position: { type: 'array', required: true },
  size: { type: 'array', required: false },
  // ... existing properties
};
```

### C.4.2 RulesEngine Selector Resolution

**Add selector resolution to RulesEngine:**

```javascript
// src/msd/rules/RulesEngine.js (enhancement)

/**
 * @fileoverview RulesEngine - Enhanced with bulk overlay selectors
 * 
 * Supports targeting multiple overlays with special selectors:
 * - all: - All overlays
 * - type:typename: - Overlays of specific type
 * - tag:tagname: - Overlays with specific tag
 * - pattern:regex: - Overlays matching ID pattern
 * - exclude: - Exclude specific overlays
 */

export class RulesEngine {
  // ... existing code
  
  /**
   * Resolve overlay selectors to actual overlay IDs
   * 
   * Processes special selector keywords and returns expanded list of overlay IDs.
   * 
   * @param {Object} overlayTarget - Target specification from rule
   * @param {Array<Object>} allOverlays - All available overlays
   * @returns {Array<string>} Array of resolved overlay IDs
   * @private
   * 
   * @example
   * // Input: { all: { color: red } }
   * // Output: ['text1', 'text2', 'chart1', 'chart2', ...]
   * 
   * @example
   * // Input: { type:text: { color: blue } }
   * // Output: ['text1', 'text2', 'text3']
   * 
   * @example
   * // Input: { tag:critical: { color: red }, exclude: ['control1'] }
   * // Output: ['temp_sensor', 'warp_core'] (excluding control1)
   */
  _resolveOverlaySelectors(overlayTarget, allOverlays) {
    const resolvedIds = new Set();
    const excludeIds = new Set();
    
    // First pass: Handle exclude to build exclusion set
    if (overlayTarget.exclude) {
      const excludeList = Array.isArray(overlayTarget.exclude) 
        ? overlayTarget.exclude 
        : [overlayTarget.exclude];
      excludeList.forEach(id => excludeIds.add(id));
    }
    
    // Second pass: Process selectors
    for (const [key, value] of Object.entries(overlayTarget)) {
      // Skip exclude (already processed)
      if (key === 'exclude') continue;
      
      // Special selector: all
      if (key === 'all') {
        allOverlays.forEach(overlay => {
          if (!excludeIds.has(overlay.id)) {
            resolvedIds.add(overlay.id);
          }
        });
        continue;
      }
      
      // Special selector: type:typename
      if (key.startsWith('type:')) {
        const typeName = key.substring(5);  // Remove 'type:' prefix
        allOverlays
          .filter(overlay => overlay.type === typeName)
          .forEach(overlay => {
            if (!excludeIds.has(overlay.id)) {
              resolvedIds.add(overlay.id);
            }
          });
        continue;
      }
      
      // Special selector: tag:tagname
      if (key.startsWith('tag:')) {
        const tagName = key.substring(4);  // Remove 'tag:' prefix
        allOverlays
          .filter(overlay => {
            const tags = overlay.tags || [];
            return tags.includes(tagName);
          })
          .forEach(overlay => {
            if (!excludeIds.has(overlay.id)) {
              resolvedIds.add(overlay.id);
            }
          });
        continue;
      }
      
      // Special selector: pattern:regex
      if (key.startsWith('pattern:')) {
        const pattern = key.substring(8);  // Remove 'pattern:' prefix
        try {
          const regex = new RegExp(pattern);
          allOverlays
            .filter(overlay => regex.test(overlay.id))
            .forEach(overlay => {
              if (!excludeIds.has(overlay.id)) {
                resolvedIds.add(overlay.id);
              }
            });
        } catch (e) {
          cblcarsLog.warn(`[RulesEngine] Invalid regex pattern: ${pattern}`, e);
        }
        continue;
      }
      
      // Normal overlay ID (direct targeting)
      if (!excludeIds.has(key)) {
        resolvedIds.add(key);
      }
    }
    
    return Array.from(resolvedIds);
  }
  
  /**
   * Apply rule patches to overlays (enhanced with selectors)
   * 
   * @param {Object} ruleThen - Rule 'then' clause
   * @param {Array<Object>} allOverlays - All available overlays
   * @returns {Array<Object>} Overlay patches with overlayId and patch content
   * @private
   */
  _applyOverlayPatches(ruleThen, allOverlays) {
    const patches = [];
    
    if (!ruleThen.overlays) return patches;
    
    // Build map of selector -> patch content
    const selectorPatches = new Map();
    
    for (const [key, value] of Object.entries(ruleThen.overlays)) {
      if (key === 'exclude') continue;  // Skip exclude key
      selectorPatches.set(key, value);
    }
    
    // Process each selector
    for (const [selector, patchContent] of selectorPatches) {
      // Resolve this selector to overlay IDs
      const targetConfig = { [selector]: patchContent };
      
      // Add exclude if present in original config
      if (ruleThen.overlays.exclude) {
        targetConfig.exclude = ruleThen.overlays.exclude;
      }
      
      const targetIds = this._resolveOverlaySelectors(targetConfig, allOverlays);
      
      // Create patch for each resolved overlay
      targetIds.forEach(overlayId => {
        patches.push({
          overlayId: overlayId,
          patch: patchContent
        });
      });
    }
    
    return patches;
  }
  
  /**
   * Evaluate rules and apply overlay patches
   * (Enhanced to use selector resolution)
   */
  evaluateDirty() {
    const results = {
      overlayPatches: [],
      profilesAdd: [],
      profilesRemove: []
    };
    
    // Get all overlays from resolved model
    const allOverlays = this.getResolvedModel()?.overlays || [];
    
    // Evaluate each rule
    this.rules.forEach(rule => {
      if (this._evaluateRule(rule)) {
        // Rule matched - apply patches using enhanced selector system
        const patches = this._applyOverlayPatches(rule.then, allOverlays);
        results.overlayPatches.push(...patches);
        
        // Handle profile changes
        if (rule.then.profiles) {
          // ... existing profile logic
        }
      }
    });
    
    return results;
  }
}
```

### C.4.3 Logging and Debugging

**Add debug logging for selector resolution:**

```javascript
// In _resolveOverlaySelectors method

_resolveOverlaySelectors(overlayTarget, allOverlays) {
  const resolvedIds = new Set();
  const excludeIds = new Set();
  
  // ... selector processing
  
  // Debug logging
  if (window.cblcars?.debug?.rules) {
    const selectorSummary = {};
    
    for (const [key] of Object.entries(overlayTarget)) {
      if (key === 'exclude') continue;
      
      // Count matches for each selector
      const testConfig = { [key]: {} };
      const testIds = this._resolveOverlaySelectors(testConfig, allOverlays);
      selectorSummary[key] = testIds.length;
    }
    
    cblcarsLog.debug('[RulesEngine] Selector resolution:', {
      selectors: Object.keys(overlayTarget),
      matches: selectorSummary,
      excluded: Array.from(excludeIds),
      totalResolved: resolvedIds.size
    });
  }
  
  return Array.from(resolvedIds);
}
```

---

## C.5 Usage Examples

### C.5.1 Example 1: Red Alert (All Overlays)

**Scenario:** Critical emergency - everything turns red.

```yaml
msd:
  overlays:
    - id: warp_core_temp
      type: apexchart
      source: warp_core_temperature
      position: [50, 100]
      size: [300, 150]
      
    - id: shield_status
      type: status_grid
      source: shield_power
      position: [50, 270]
      size: [200, 100]
      
    - id: navigation
      type: text
      content: "NAVIGATION"
      position: [370, 100]
    
    # ... 20+ more overlays
  
  rules:
    # Normal operation
    - id: alert_normal
      when:
        all:
          - entity: input_select.ship_alert_status
            state: "normal"
      then:
        overlays:
          all:  # All overlays use standard colors
            style:
              color: "colors.accent.primary"
              border_color: null
              border_width: null
    
    # Red Alert - Maximum danger
    - id: alert_red
      when:
        all:
          - entity: input_select.ship_alert_status
            state: "red_alert"
      then:
        overlays:
          all:  # Every overlay turns red
            style:
              color: "colors.alert.critical"
              border_color: "colors.alert.critical"
              border_width: "borders.width.thick"
```

**Result:** Single rule updates 20+ overlays instantly.

### C.5.2 Example 2: Yellow Alert (Critical Systems Only)

**Scenario:** Elevated readiness - only critical systems change.

```yaml
msd:
  overlays:
    - id: warp_core_temp
      type: apexchart
      source: warp_core_temperature
      tags: ["critical", "engineering"]
      position: [50, 100]
      size: [300, 150]
      
    - id: shield_status
      type: status_grid
      source: shield_power
      tags: ["critical", "tactical"]
      position: [50, 270]
      size: [200, 100]
      
    - id: crew_roster
      type: text
      content: "CREW ROSTER"
      tags: ["informational"]  # Not critical
      position: [370, 100]
  
  rules:
    - id: alert_yellow
      when:
        all:
          - entity: input_select.ship_alert_status
            state: "yellow_alert"
      then:
        overlays:
          tag:critical:  # Only critical-tagged overlays
            style:
              color: "colors.status.warning"
              border_color: "colors.status.warning"
              border_width: "borders.width.base"
```

**Result:** Only "critical" tagged overlays turn yellow, informational overlays stay normal.

### C.5.3 Example 3: Intruder Alert (Security Systems)

**Scenario:** Security breach - security overlays flash red, others get border.

```yaml
msd:
  overlays:
    - id: door_status
      type: status_grid
      source: door_sensors
      tags: ["security", "access-control"]
      position: [50, 100]
      size: [200, 100]
      
    - id: camera_feeds
      type: control
      tags: ["security", "surveillance"]
      card:
        type: picture-elements
      position: [270, 100]
      size: [200, 150]
      
    - id: warp_core_temp
      type: apexchart
      source: warp_core_temperature
      tags: ["engineering"]
      position: [50, 270]
      size: [300, 150]
  
  rules:
    - id: alert_intruder
      when:
        all:
          - entity: input_select.ship_alert_status
            state: "intruder_alert"
      then:
        overlays:
          tag:security:  # Security systems turn red
            style:
              color: "colors.alert.critical"
              border_color: "colors.alert.critical"
              border_width: "borders.width.thick"
              
          tag:access-control:  # Access control enhanced
            style:
              border_width: "borders.width.thick"
              
          all:  # All other overlays get subtle border
            style:
              border_color: "colors.status.warning"
              border_width: "borders.width.thin"
          
          exclude: ["ship_logo", "stardate"]  # Exclude branding
```

**Result:** Layered alert with different styling for different overlay groups.

### C.5.4 Example 4: Type-Specific Alerts

**Scenario:** Different alert behavior per overlay type.

```yaml
msd:
  rules:
    - id: alert_blue_atmospheric
      when:
        all:
          - entity: input_select.ship_alert_status
            state: "blue_alert"
      then:
        overlays:
          type:apexchart:  # Charts turn blue
            style:
              color: "colors.status.info"
              
          type:text:  # Text gets blue border
            style:
              border_color: "colors.status.info"
              border_width: "borders.width.base"
              
          type:status_grid:  # Grids subtle blue highlight
            style:
              cell_color: "colors.accent.secondaryLight"  # Light blue
```

**Result:** Each overlay type responds differently to blue alert.

### C.5.5 Example 5: ID Pattern Matching

**Scenario:** Target all temperature-related overlays.

```yaml
msd:
  overlays:
    - id: temp_sensor_1
      type: apexchart
      source: temperature_1
      # ...
      
    - id: temp_sensor_2
      type: apexchart
      source: temperature_2
      # ...
      
    - id: temp_warning_text
      type: text
      content: "TEMP WARNING"
      # ...
      
    - id: power_monitor
      type: apexchart
      source: power
      # ...
  
  rules:
    - id: high_temp_alert
      when:
        all:
          - entity: sensor.average_temperature
            above: 30
      then:
        overlays:
          pattern:^temp_.*:  # All overlays starting with "temp_"
            style:
              color: "colors.status.danger"
```

**Result:** All temperature-related overlays turn red, power monitor stays normal.

---

## C.6 Home Assistant Integration

### C.6.1 Helper Entity Setup

**Create alert status selector in Home Assistant:**

```yaml
# configuration.yaml

input_select:
  ship_alert_status:
    name: "Ship Alert Status"
    options:
      - "normal"
      - "yellow_alert"
      - "red_alert"
      - "blue_alert"
      - "intruder_alert"
    initial: "normal"
    icon: mdi:alert
```

**Restart Home Assistant to load helper.**

### C.6.2 Manual Alert Control

**Control panel card for manual alerts:**

```yaml
# In Lovelace dashboard
type: entities
title: "Alert Control"
entities:
  - entity: input_select.ship_alert_status
    name: "Alert Status"
```

**Or use button cards:**

```yaml
type: horizontal-stack
cards:
  - type: button
    name: "Normal"
    icon: mdi:shield-check
    tap_action:
      action: call-service
      service: input_select.select_option
      service_data:
        entity_id: input_select.ship_alert_status
        option: "normal"
        
  - type: button
    name: "Yellow Alert"
    icon: mdi:alert
    tap_action:
      action: call-service
      service: input_select.select_option
      service_data:
        entity_id: input_select.ship_alert_status
        option: "yellow_alert"
        
  - type: button
    name: "Red Alert"
    icon: mdi:alert-octagon
    tap_action:
      action: call-service
      service: input_select.select_option
      service_data:
        entity_id: input_select.ship_alert_status
        option: "red_alert"
```

### C.6.3 Automated Alert Triggers

**Trigger alerts based on sensor values:**

```yaml
# automations.yaml

# Trigger red alert on critical temperature
- alias: "Auto Red Alert - Critical Temperature"
  trigger:
    - platform: numeric_state
      entity_id: sensor.warp_core_temperature
      above: 1500
  action:
    - service: input_select.select_option
      target:
        entity_id: input_select.ship_alert_status
      data:
        option: "red_alert"
    - service: notify.mobile_app
      data:
        message: "🚨 RED ALERT: Warp core temperature critical!"

# Clear alert when temperature normalizes
- alias: "Clear Alert - Temperature Normal"
  trigger:
    - platform: numeric_state
      entity_id: sensor.warp_core_temperature
      below: 1000
      for:
        minutes: 5  # Stable for 5 minutes
  condition:
    - condition: state
      entity_id: input_select.ship_alert_status
      state: "red_alert"
  action:
    - service: input_select.select_option
      target:
        entity_id: input_select.ship_alert_status
      data:
        option: "normal"

# Trigger intruder alert on door sensor
- alias: "Intruder Alert - Unauthorized Access"
  trigger:
    - platform: state
      entity_id: binary_sensor.door_unauthorized
      to: "on"
  action:
    - service: input_select.select_option
      target:
        entity_id: input_select.ship_alert_status
      data:
        option: "intruder_alert"
    - service: alarm_control_panel.alarm_trigger
      target:
        entity_id: alarm_control_panel.security
```

### C.6.4 Complex Alert Logic

**Multi-condition alert automation:**

```yaml
# Yellow alert if any critical system is elevated
- alias: "Yellow Alert - Elevated Systems"
  trigger:
    - platform: numeric_state
      entity_id: 
        - sensor.shield_power
        - sensor.warp_core_temperature
        - sensor.hull_integrity
      above: 75  # 75% of critical threshold
  condition:
    - condition: state
      entity_id: input_select.ship_alert_status
      state: "normal"
  action:
    - service: input_select.select_option
      target:
        entity_id: input_select.ship_alert_status
      data:
        option: "yellow_alert"

# Auto-escalate yellow to red if conditions worsen
- alias: "Escalate Alert - Yellow to Red"
  trigger:
    - platform: numeric_state
      entity_id:
        - sensor.shield_power
        - sensor.warp_core_temperature
      above: 90  # 90% of critical threshold
  condition:
    - condition: state
      entity_id: input_select.ship_alert_status
      state: "yellow_alert"
  action:
    - service: input_select.select_option
      target:
        entity_id: input_select.ship_alert_status
      data:
        option: "red_alert"
```

---

## C.7 Advanced Patterns

### C.7.1 Layered Alert Styling

**Combine multiple selectors for nuanced alerts:**

```yaml
rules:
  - id: alert_red_layered
    when:
      all:
        - entity: input_select.ship_alert_status
          state: "red_alert"
    then:
      overlays:
        # Base layer: All overlays get red border
        all:
          style:
            border_color: "colors.alert.critical"
            border_width: "borders.width.thin"
        
        # Critical layer: Critical systems fully red
        tag:critical:
          style:
            color: "colors.alert.critical"
            border_width: "borders.width.thick"
        
        # Engineering layer: Engineering gets enhanced
        tag:engineering:
          style:
            font_size: "typography.fontSize.xl"  # Bigger text
        
        # Exclusions: Keep ship logo normal
        exclude: ["ship_logo", "stardate"]
```

**Result:** Three layers of styling applied in order, with exclusions.

### C.7.2 Alert Transitions

**Smooth transitions between alert states:**

```yaml
rules:
  # Normal state (baseline)
  - id: alert_normal
    when:
      all:
        - entity: input_select.ship_alert_status
          state: "normal"
    then:
      overlays:
        all:
          style:
            color: "colors.accent.primary"
            border_color: null
            border_width: null
          animation:  # Future: animation system
            duration: 500
            easing: "easeInOut"
  
  # Yellow alert (transition)
  - id: alert_yellow
    when:
      all:
        - entity: input_select.ship_alert_status
          state: "yellow_alert"
    then:
      overlays:
        tag:critical:
          style:
            color: "colors.status.warning"
          animation:  # Future: smooth color transition
            duration: 800
            easing: "easeOut"
  
  # Red alert (urgent)
  - id: alert_red
    when:
      all:
        - entity: input_select.ship_alert_status
          state: "red_alert"
    then:
      overlays:
        all:
          style:
            color: "colors.alert.critical"
          animation:  # Future: rapid transition
            duration: 200
            easing: "easeIn"
```

**Note:** Animation system integration is future work (see main proposal).

### C.7.3 Tag Composition

**Use multiple tags for complex targeting:**

```yaml
msd:
  overlays:
    - id: warp_core_temp
      tags: ["critical", "engineering", "real-time", "alert-sensitive"]
      # ...
      
    - id: dilithium_monitor
      tags: ["critical", "engineering", "slow-update"]
      # ...
      
    - id: crew_roster
      tags: ["informational", "static"]
      # ...
  
  rules:
    # Update only real-time critical systems
    - id: realtime_critical_update
      when:
        all:
          - entity: sensor.update_trigger
            state: "on"
      then:
        overlays:
          tag:real-time:  # Real-time overlays
            style:
              color: "colors.accent.primaryLight"
```

**Best Practice:** Use meaningful tag combinations for flexible targeting.

---

## C.8 Performance Considerations

### C.8.1 Selector Resolution Performance

**Optimization:** Selector resolution is O(n) where n = number of overlays.

**Worst Case:**
- 100 overlays
- 10 rules with `all:` selector
- = 1000 overlay patches per rule evaluation

**Mitigation:**
- ✅ Selector resolution cached during evaluation
- ✅ Only dirty rules re-evaluated
- ✅ Batch overlay updates

**Benchmark Target:** < 16ms for 100 overlays (60 FPS)

### C.8.2 Tag Indexing (Future Optimization)

**Concept:** Pre-build tag index for O(1) lookup.

```javascript
// Future optimization (not in initial implementation)
class RulesEngine {
  constructor(rules, dataSourceManager) {
    // ... existing code
    
    // Build tag index
    this.tagIndex = new Map();  // tagName -> Set(overlayIds)
  }
  
  _buildTagIndex(overlays) {
    this.tagIndex.clear();
    
    overlays.forEach(overlay => {
      const tags = overlay.tags || [];
      tags.forEach(tag => {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag).add(overlay.id);
      });
    });
  }
  
  _resolveTagSelector(tagName) {
    // O(1) lookup instead of O(n) filter
    return Array.from(this.tagIndex.get(tagName) || []);
  }
}
```

**Priority:** LOW (optimize only if performance issues detected)

---

## C.9 Implementation Roadmap

### C.9.1 Phase 1: Foundation (Week 1)

**Deliverables:**
- [ ] Add `tags` property to overlay schema
- [ ] Update overlay validation to accept tags
- [ ] Add tags to example overlays in documentation

**Files:**
```
src/msd/config/overlaySchema.js (enhance)
doc/schemas/overlay-schema.md (update)
doc/examples/alert-system.md (new)
```

**Testing:**
- [ ] Verify tags stored in overlay objects
- [ ] Verify tags preserved through merge pipeline

### C.9.2 Phase 2: RulesEngine Enhancement (Week 1-2)

**Deliverables:**
- [ ] Implement `_resolveOverlaySelectors()` method
- [ ] Add support for `all:` selector
- [ ] Add support for `type:typename:` selector
- [ ] Add support for `tag:tagname:` selector
- [ ] Add support for `pattern:regex:` selector
- [ ] Add support for `exclude:` modifier
- [ ] Update `_applyOverlayPatches()` to use selectors
- [ ] Add debug logging for selector resolution

**Files:**
```
src/msd/rules/RulesEngine.js (enhance)
src/msd/rules/tests/RulesEngine.test.js (new tests)
```

**Testing:**
- [ ] Unit tests for each selector type
- [ ] Integration tests with sample MSD configs
- [ ] Performance tests with 100+ overlays
- [ ] Edge cases (empty selectors, invalid regex, etc.)

### C.9.3 Phase 3: Integration & Examples (Week 2)

**Deliverables:**
- [ ] Create example HA helper entity config
- [ ] Create example alert rule configurations
- [ ] Create example alert automation triggers
- [ ] Test with real HA instance

**Files:**
```
doc/examples/global-alerts/README.md (new)
doc/examples/global-alerts/helper-setup.yaml (new)
doc/examples/global-alerts/msd-config.yaml (new)
doc/examples/global-alerts/automations.yaml (new)
```

**Testing:**
- [ ] Manual testing with HA dashboard
- [ ] Verify alert state transitions
- [ ] Test automation triggers
- [ ] Performance testing with real data

### C.9.4 Phase 4: Documentation (Week 2-3)

**Deliverables:**
- [ ] User guide: Global alert system
- [ ] User guide: Overlay selectors reference
- [ ] User guide: Tagging best practices
- [ ] Developer docs: Selector implementation
- [ ] Video tutorial: Setting up alerts

**Files:**
```
doc/user-guide/global-alerts.md (new)
doc/user-guide/overlay-selectors.md (new)
doc/user-guide/tagging-system.md (new)
doc/developer-guide/rules-selectors.md (new)
```

**Testing:**
- [ ] Documentation review
- [ ] Code examples verified
- [ ] Screenshot/video accuracy

---

## C.10 User Documentation

### C.10.1 Quick Start Guide

````markdown
# Global Alert System - Quick Start

## 1. Create Helper Entity

```yaml
# configuration.yaml
input_select:
  ship_alert_status:
    name: "Ship Alert Status"
    options:
      - "normal"
      - "red_alert"
    initial: "normal"
```

Restart Home Assistant.

## 2. Tag Your Overlays

```yaml
# cb-lcars-msd.yaml
msd:
  overlays:
    - id: temp_sensor
      type: apexchart
      tags: ["critical"]  # Add tags
      # ... rest of config
```

## 3. Create Alert Rules

```yaml
# cb-lcars-msd.yaml
msd:
  rules:
    - id: red_alert
      when:
        all:
          - entity: input_select.ship_alert_status
            state: "red_alert"
      then:
        overlays:
          all:  # All overlays turn red
            style:
              color: "colors.alert.critical"
```

## 4. Trigger Alert

```yaml
# In HA UI or automation
service: input_select.select_option
target:
  entity_id: input_select.ship_alert_status
data:
  option: "red_alert"
```

Done! Your entire MSD is now red.
````

### C.10.2 Selector Reference

````markdown
# Overlay Selectors Reference

## Syntax

```yaml
overlays:
  selector: patch_content
```

## All Overlays

Target every overlay in MSD:

```yaml
overlays:
  all:
    style:
      color: "colors.status.danger"
```

## By Type

Target overlays of specific type:

```yaml
overlays:
  type:text:        # All text overlays
    style:
      color: red
      
  type:apexchart:   # All charts
    style:
      color: blue
```

**Available types:**
- `type:text:`
- `type:apexchart:`
- `type:sparkline:`
- `type:status_grid:`
- `type:line:`
- `type:control:`
- `type:button:`
- `type:history_bar:`

## By Tag

Target overlays with specific tag:

```yaml
overlays:
  tag:critical:     # Tagged "critical"
    style:
      color: red
      
  tag:engineering:  # Tagged "engineering"
    style:
      border_color: orange
```

Tags are defined on overlays:

```yaml
overlays:
  - id: my_overlay
    tags: ["critical", "engineering"]
    # ...
```

## By ID Pattern

Target overlays matching regex:

```yaml
overlays:
  pattern:^temp_.*:  # All IDs starting with "temp_"
    style:
      color: red
      
  pattern:.*_status$:  # All IDs ending with "_status"
    style:
      border_width: 2
```

## Exclude

Exclude specific overlays:

```yaml
overlays:
  all:
    style:
      color: red
  exclude: ["logo", "stardate"]  # Don't change these
```

## Combining Selectors

Use multiple selectors in one rule:

```yaml
overlays:
  tag:critical:      # Critical systems red
    style:
      color: red
      
  tag:informational: # Informational yellow
    style:
      color: yellow
      
  exclude: ["control1"]  # Except this one
```

## Selector Priority

When an overlay matches multiple selectors, **later selectors win**:

```yaml
overlays:
  all:
    color: blue      # All overlays blue
    
  tag:critical:
    color: red       # Critical overlays red (overrides blue)
```

Order matters!
````

### C.10.3 Tagging Best Practices

````markdown
# Overlay Tagging Best Practices

## Recommended Tags

### By Criticality

- `critical` - Life-critical systems
- `important` - Important but not critical
- `informational` - Display-only information

### By Function

- `engineering` - Engineering systems
- `tactical` - Weapons, shields, sensors
- `navigation` - Navigation and helm
- `security` - Security systems
- `life-support` - Life support systems
- `communications` - Comms systems

### By Behavior

- `alert-sensitive` - Changes on alert status
- `real-time` - Updates frequently
- `static` - Rarely changes
- `diagnostic` - Diagnostic/debug overlays

### By Department

- `bridge` - Bridge displays
- `sickbay` - Medical displays
- `cargo` - Cargo management
- `quarters` - Crew quarters

## Multi-Tag Example

```yaml
overlays:
  - id: warp_core_temp
    tags: [
      "critical",           # Criticality
      "engineering",        # Function
      "real-time",          # Behavior
      "alert-sensitive"     # Response
    ]
    # ...
    
  - id: crew_roster
    tags: [
      "informational",      # Criticality
      "static",             # Behavior
      "bridge"              # Department
    ]
    # ...
```

## Tag Naming Conventions

✅ **Do:**
- Use lowercase
- Use hyphens for multi-word tags (`life-support`)
- Be descriptive (`engineering` not `eng`)
- Be consistent across your config

❌ **Don't:**
- Use spaces (`life support`)
- Use camelCase (`lifeSupport`)
- Use abbreviations (`eng`)
- Mix naming styles

## Common Patterns

### Alert System

```yaml
tags: ["alert-sensitive", "critical"]
```

### Department Dashboards

```yaml
tags: ["engineering", "real-time"]
tags: ["tactical", "alert-sensitive"]
tags: ["medical", "informational"]
```

### Performance Optimization

```yaml
tags: ["real-time", "high-frequency"]  # Update often
tags: ["static", "low-frequency"]      # Update rarely
```
````

---

## C.11 Benefits Summary

### C.11.1 For Users

**Simplified Configuration:**
- ✅ Single rule updates all overlays
- ✅ No need to list every overlay ID
- ✅ Easy to add/remove overlays without breaking rules
- ✅ Self-documenting with tags

**Flexible Control:**
- ✅ Target by type, tag, or pattern
- ✅ Combine selectors for complex scenarios
- ✅ Exclude specific overlays easily
- ✅ Layered styling with multiple selectors

**LCARS Authenticity:**
- ✅ Canonical Star Trek alert system
- ✅ Red Alert, Yellow Alert, Blue Alert
- ✅ System-wide visual state changes
- ✅ Professional starship interface

### C.11.2 For Developers

**Clean Architecture:**
- ✅ Leverages existing RulesEngine
- ✅ No new complex systems
- ✅ Follows established patterns
- ✅ Well-defined selector syntax

**Maintainable Code:**
- ✅ Clear separation of concerns
- ✅ Easy to test (unit tests per selector)
- ✅ Performance-conscious design
- ✅ Debug-friendly logging

**Extensible System:**
- ✅ Easy to add new selector types
- ✅ Tag system supports any categorization
- ✅ Future-proof for animation integration
- ✅ Compatible with pack system

### C.11.3 For the Project

**Professional Feature:**
- ✅ Industry-standard bulk targeting
- ✅ Matches user expectations
- ✅ Competitive with other dashboard systems
- ✅ Unique LCARS implementation

**Community Enablement:**
- ✅ Packs can define tag conventions
- ✅ Shareable alert configurations
- ✅ Lower barrier to entry
- ✅ Encourages best practices

**Future-Ready:**
- ✅ Integrates with animation system (future)
- ✅ Works with theme system (Appendix B)
- ✅ Supports template system (main proposal)
- ✅ Foundation for advanced features

---

## C.12 Conclusion

The Global Alert System with bulk overlay selectors provides a **professional, maintainable solution** for system-wide visual state changes in MSD.

**Key Features:**
1. **Bulk Selectors** - Target multiple overlays with single rules
2. **Tagging System** - Semantic overlay categorization
3. **HA Integration** - Single helper entity controls MSD
4. **LCARS Authentic** - Canonical Star Trek alert conditions

**Implementation Priority:** **HIGH**

**Estimated Effort:** 2-3 weeks

**Dependencies:**
- Existing RulesEngine (complete)
- Token system (Appendix B)

**Recommendation:** ✅ **IMPLEMENT** as core MSD feature.

---

**End of Appendix C**