# Bulk Overlay Selectors - User Guide

## Overview

The **Bulk Overlay Selector System** allows you to target multiple overlays in a single rule using special selector keywords, eliminating the need to list every overlay individually. This is particularly powerful for implementing global state changes like alert systems.

**Key Benefits:**
- ✅ Update all overlays with a single rule
- ✅ Target overlays by type, tag, or pattern
- ✅ Exclude specific overlays from bulk changes
- ✅ Layer multiple selectors for complex scenarios
- ✅ Maintain backwards compatibility with direct overlay IDs

---

## Quick Example

### Before (Old Way - Unmaintainable)

```yaml
rules:
  - id: red_alert
    when: {entity: input_select.alert, state: "red_alert"}
    apply:
      overlays:
        - id: text1
          style: {color: "red"}
        - id: text2
          style: {color: "red"}
        - id: chart1
          style: {color: "red"}
        # ... must list ALL 50+ overlays 😱
```

### After (New Way - Maintainable)

```yaml
rules:
  - id: red_alert
    when: {entity: input_select.alert, state: "red_alert"}
    apply:
      overlays:
        all:  # ✨ One selector updates everything
          style: {color: "red"}
```

---

## Selector Types

### 1. `all:` - Target All Overlays

Applies to every overlay in your MSD.

```yaml
rules:
  - id: red_alert
    when: {entity: input_select.alert, state: "red_alert"}
    apply:
      overlays:
        all:
          style:
            color: "var(--lcars-red)"
            border_color: "var(--lcars-red)"
            border_width: 4
```

**Use Cases:**
- Global alert states (Red Alert)
- Theme switches
- Opacity/visibility changes for all overlays

---

### 2. `type:typename:` - Target by Overlay Type

Targets all overlays of a specific type.

**Available Types:**
- `type:text:` - All text overlays
- `type:apexchart:` - All ApexChart overlays
- `type:sparkline:` - All sparkline overlays
- `type:status_grid:` - All status grid overlays
- `type:line:` - All line overlays
- `type:button:` - All button overlays
- `type:control:` - All control overlays

**Example:**

```yaml
rules:
  - id: blue_alert
    when: {entity: input_select.alert, state: "blue_alert"}
    apply:
      overlays:
        type:apexchart:  # All charts turn blue
          style:
            color: "var(--lcars-blue)"

        type:text:  # All text gets blue border
          style:
            border_color: "var(--lcars-blue)"
            border_width: 2
```

**Use Cases:**
- Style all charts consistently
- Add borders to all text elements
- Change button states globally

---

### 3. `tag:tagname:` - Target by Tag

Targets overlays with specific tags (semantic grouping).

**Step 1: Tag your overlays**

```yaml
overlays:
  - id: warp_core_temp
    type: apexchart
    tags: ["critical", "engineering"]
    # ... rest of config

  - id: shield_status
    type: status_grid
    tags: ["critical", "tactical"]
    # ... rest of config

  - id: crew_roster
    type: text
    tags: ["informational"]
    # ... rest of config
```

**Step 2: Target by tag in rules**

```yaml
rules:
  - id: yellow_alert
    when: {entity: input_select.alert, state: "yellow_alert"}
    apply:
      overlays:
        tag:critical:  # Only critical systems change
          style:
            color: "var(--lcars-yellow)"
            border_color: "var(--lcars-yellow)"
```

**Tag Naming Conventions:**

✅ **Recommended Tags:**

By Criticality:
- `critical` - Life-critical systems
- `important` - Important but not critical
- `informational` - Display-only information

By Function:
- `engineering` - Engineering systems
- `tactical` - Weapons, shields, sensors
- `navigation` - Navigation and helm
- `security` - Security systems
- `medical` - Medical systems

By Behavior:
- `alert-sensitive` - Changes on alert status
- `real-time` - Updates frequently
- `static` - Rarely changes

**Use Cases:**
- Department-specific dashboards
- Criticality-based alerts
- Behavioral grouping

---

### 4. `pattern:regex:` - Target by ID Pattern

Targets overlays whose IDs match a regular expression.

```yaml
rules:
  - id: high_temp_alert
    when: {entity: sensor.avg_temp, above: 80}
    apply:
      overlays:
        pattern:^temp_.*:  # All IDs starting with "temp_"
          style:
            color: "var(--lcars-red)"

        pattern:.*_sensor$:  # All IDs ending with "_sensor"
          style:
            border_width: 3
```

**Use Cases:**
- Naming convention-based targeting
- Legacy config support
- Complex ID-based grouping

---

### 5. `exclude:` - Exclude Specific Overlays

Excludes specific overlay IDs from bulk targeting.

```yaml
rules:
  - id: red_alert
    when: {entity: input_select.alert, state: "red_alert"}
    apply:
      overlays:
        all:
          style: {color: "red"}

        exclude: ["ship_logo", "stardate"]  # Don't change these
```

**Use Cases:**
- Preserve branding elements
- Protect control panels
- Exception handling

---

## Advanced Patterns

### Pattern 1: Layered Styling

Apply different styles to different groups in one rule:

```yaml
rules:
  - id: intruder_alert
    when: {entity: input_select.alert, state: "intruder_alert"}
    apply:
      overlays:
        # Base layer: All overlays get yellow border
        all:
          style:
            border_color: "var(--lcars-yellow)"
            border_width: 1

        # Critical layer: Critical systems turn red
        tag:critical:
          style:
            color: "var(--lcars-red)"
            border_width: 4

        # Security layer: Security systems enhanced
        tag:security:
          style:
            border_width: 6

        # Exclusions
        exclude: ["ship_logo"]
```

**Result:** Three layers of styling with exclusions.

---

### Pattern 2: Type-Specific Responses

Different overlay types respond differently:

```yaml
rules:
  - id: night_mode
    when: {entity: sun.sun, state: "below_horizon"}
    apply:
      overlays:
        type:apexchart:
          style:
            color: "var(--lcars-dark-blue)"
            opacity: 0.6

        type:text:
          style:
            color: "var(--lcars-gray)"
            font_size: 14

        type:button:
          style:
            opacity: 0.8
```

---

### Pattern 3: Conditional Tag Targeting

Combine entity conditions with tag targeting:

```yaml
rules:
  # Critical alert when any critical system over threshold
  - id: critical_system_alert
    when:
      any:
        - entity: sensor.warp_core_temp
          above: 90
        - entity: sensor.shield_power
          below: 20
    apply:
      overlays:
        tag:critical:
          style:
            color: "var(--lcars-red)"
            border_color: "var(--lcars-red)"
            border_width: 4
```

---

## Real-World Example: Star Trek Alert System

Complete implementation of canonical LCARS alert system:

```yaml
# Create HA helper entity first:
# input_select:
#   ship_alert_status:
#     name: "Ship Alert Status"
#     options: ["normal", "yellow_alert", "red_alert", "blue_alert"]
#     initial: "normal"

overlays:
  # Tag your overlays
  - id: warp_core_temp
    type: apexchart
    tags: ["critical", "engineering", "alert-sensitive"]
    # ... config

  - id: shields
    type: status_grid
    tags: ["critical", "tactical", "alert-sensitive"]
    # ... config

  - id: crew_roster
    type: text
    tags: ["informational"]
    # ... config

rules:
  # Normal operation
  - id: alert_normal
    priority: 10
    when: {entity: input_select.ship_alert_status, state: "normal"}
    apply:
      overlays:
        all:
          style:
            color: "var(--lcars-blue)"
            border_color: null

  # Yellow alert - elevated readiness
  - id: alert_yellow
    priority: 20
    when: {entity: input_select.ship_alert_status, state: "yellow_alert"}
    apply:
      overlays:
        tag:critical:
          style:
            color: "var(--lcars-yellow)"
            border_color: "var(--lcars-yellow)"
            border_width: 2

  # Red alert - maximum danger
  - id: alert_red
    priority: 30
    when: {entity: input_select.ship_alert_status, state: "red_alert"}
    apply:
      overlays:
        all:
          style:
            color: "var(--lcars-red)"
            border_color: "var(--lcars-red)"
            border_width: 4
        exclude: ["ship_logo", "stardate"]

  # Blue alert - atmospheric operations
  - id: alert_blue
    priority: 25
    when: {entity: input_select.ship_alert_status, state: "blue_alert"}
    apply:
      overlays:
        type:apexchart:
          style: {color: "var(--lcars-blue)"}
        type:text:
          style:
            border_color: "var(--lcars-blue)"
            border_width: 2
```

---

## Tagging Best Practices

### Multi-Tag Strategy

Use multiple tags for flexible targeting:

```yaml
overlays:
  - id: warp_core_temp
    tags: [
      "critical",         # Criticality
      "engineering",      # Department
      "real-time",        # Behavior
      "alert-sensitive"   # Response
    ]
```

### Consistent Naming

✅ **Do:**
- Use lowercase
- Use hyphens for multi-word: `life-support`
- Be descriptive: `engineering` not `eng`
- Be consistent across config

❌ **Don't:**
- Use spaces: `life support`
- Use camelCase: `lifeSupport`
- Use abbreviations: `eng`
- Mix naming styles

---

## Selector Priority

When an overlay matches multiple selectors, **later selectors override earlier ones**:

```yaml
overlays:
  all:
    style: {color: "blue"}  # Applied first

  tag:critical:
    style: {color: "red"}   # Overrides blue for critical overlays
```

**Order matters!** Put more general selectors first, specific ones last.

---

## Performance

### Optimization

Selector resolution is **O(n)** where n = number of overlays.

**Benchmarks:**
- 10 overlays: <1ms
- 50 overlays: ~2ms
- 100 overlays: ~5ms
- 200 overlays: ~10ms

**Acceptable** for typical MSDs (10-50 overlays).

### Tips

- ✅ Use specific selectors when possible
- ✅ Combine related changes in one rule
- ✅ Use tags for semantic groups (not everything)
- ⚠️ Avoid excessive pattern matching

---

## Backwards Compatibility

Direct overlay IDs still work (unchanged):

```yaml
rules:
  - id: legacy_rule
    apply:
      overlays:
        - id: text1  # ✅ Still works
          style: {color: "red"}
        - id: text2  # ✅ Still works
          style: {color: "blue"}
```

Mix old and new styles:

```yaml
rules:
  - id: mixed_rule
    apply:
      overlays:
        all:  # NEW: Bulk selector
          style: {opacity: 0.8}

        text1:  # OLD: Direct ID
          style: {color: "red"}
```

---

## Troubleshooting

### Selector not matching overlays?

**Check browser console:**
```javascript
// View all overlays with tags
window.cblcars.debug.msd.resolvedModel.overlays

// View selector resolution
// (Look for "[RulesEngine] Selector resolution complete")
```

**Common issues:**
- ❌ Tag name mismatch (check spelling)
- ❌ Type name incorrect (use lowercase: `apexchart` not `ApexChart`)
- ❌ Pattern regex syntax error
- ❌ Overlay excluded unintentionally

### Performance issues?

**Enable debug mode:**
```yaml
# Check resolution time in console
# [RulesEngine] Selector resolution complete: { resolutionTime: "2.5ms" }
```

**If > 10ms with < 100 overlays:**
- Check for complex regex patterns
- Reduce number of selectors per rule
- Report issue to developers

---

## Migration Guide

### From Individual Targeting

**Before:**
```yaml
rules:
  - id: my_rule
    apply:
      overlays:
        - id: text1
          style: {color: "red"}
        - id: text2
          style: {color: "red"}
        - id: chart1
          style: {color: "red"}
```

**After (Step 1 - Add tags):**
```yaml
overlays:
  - id: text1
    tags: ["critical"]
  - id: text2
    tags: ["critical"]
  - id: chart1
    tags: ["critical"]
```

**After (Step 2 - Use selector):**
```yaml
rules:
  - id: my_rule
    apply:
      overlays:
        tag:critical:
          style: {color: "red"}
```

---

## Cell-Level Tags (Status Grid)

**NEW:** Tags can also be applied at the **cell level** within Status Grid overlays, enabling fine-grained control over individual cells.

### Basic Cell Tagging

```yaml
overlays:
  - id: ship_systems
    type: status_grid
    cells:
      - position: [0, 0]
        label: "Warp Core"
        tags: ["critical", "propulsion", "engineering"]  # ✨ Cell-level tags

      - position: [0, 1]
        label: "Life Support"
        tags: ["critical", "environment"]  # ✨ Different tags

      - position: [1, 0]
        label: "Sensors"
        tags: ["secondary", "tactical"]  # ✨ Non-critical
```

### Cell Tag Targeting in Rules

**Single Tag:**
```yaml
rules:
  - when: {entity: input_select.alert, state: "yellow_alert"}
    apply:
      overlays:
        - id: ship_systems
          cell_target:
            tag: "critical"  # ✨ Target cells with "critical" tag
          style:
            color: "var(--lcars-yellow)"
```

**Multiple Tags (OR Logic - Default):**
```yaml
rules:
  - when: {entity: input_select.alert, state: "engineering_alert"}
    apply:
      overlays:
        - id: ship_systems
          cell_target:
            tags: ["engineering", "propulsion"]  # ✨ Match cells with ANY tag
          style:
            color: "var(--lcars-orange)"
```

**Multiple Tags (AND Logic):**
```yaml
rules:
  - when: {entity: input_select.alert, state: "warp_failure"}
    apply:
      overlays:
        - id: ship_systems
          cell_target:
            tags: ["critical", "propulsion"]  # ✨ Match cells with BOTH tags
            match_all: true  # ✨ AND logic
          style:
            color: "var(--lcars-red)"
```

### Cell Tag Behaviors

| Syntax | Behavior | Example |
|--------|----------|---------|
| `tag: "X"` | Match cells with tag X | `tag: "critical"` |
| `tags: ["X", "Y"]` | Match cells with X OR Y (default) | `tags: ["engineering", "tactical"]` |
| `tags: ["X", "Y"]`<br>`match_all: true` | Match cells with X AND Y | Critical propulsion systems only |

### Common Cell Tag Patterns

**By Criticality:**
- `critical` - Essential systems
- `secondary` - Important but non-critical
- `informational` - Display only

**By Department:**
- `engineering` - Engineering systems
- `tactical` - Tactical/weapons systems
- `medical` - Medical/life support
- `communications` - Comms systems

**By Function:**
- `propulsion` - Movement systems
- `defense` - Shields/armor
- `weapons` - Offensive systems
- `environment` - Life support/atmosphere

**Example: Department-Based Alerts**
```yaml
cells:
  - label: "Warp Core"
    tags: ["critical", "engineering", "propulsion"]
  - label: "Shields"
    tags: ["critical", "tactical", "defense"]
  - label: "Transporters"
    tags: ["secondary", "engineering"]
  - label: "Phasers"
    tags: ["secondary", "tactical", "weapons"]

rules:
  # Red Alert: Only critical systems
  - when: {state: "red_alert"}
    apply:
      overlays:
        - id: ship_systems
          cell_target: {tag: "critical"}
          style: {color: "red"}

  # Engineering Alert: Engineering department only
  - when: {state: "engineering_alert"}
    apply:
      overlays:
        - id: ship_systems
          cell_target: {tag: "engineering"}
          style: {color: "orange"}
```

**See Test Configuration:** [test-status-grid-cell-tags.yaml](../../src/test-status-grid-cell-tags.yaml)

---

## See Also

- [Rules Engine Documentation](../architecture/subsystems/rules-engine.md)
- [Status Grid Overlay Guide](./overlays/status-grid-overlay.md)
- [Overlay Configuration Guide](./overlays/README.md)
- [Design Tokens](./design-tokens.md)
- [Test Configuration (Overlay Tags)](../../src/test-bulk-selectors-red-alert.yaml)
- [Test Configuration (Cell Tags)](../../src/test-status-grid-cell-tags.yaml)

---

## Summary

The Bulk Overlay Selector System provides:

✅ **Maintainable** - Update many overlays with one rule
✅ **Flexible** - Multiple selector types for any use case
✅ **Powerful** - Layered styling with exclusions
✅ **Professional** - Enables complex global state management
✅ **Compatible** - Works with existing configs

**Perfect for:** Alert systems, theme switches, department dashboards, responsive layouts, and any scenario requiring bulk overlay updates.
