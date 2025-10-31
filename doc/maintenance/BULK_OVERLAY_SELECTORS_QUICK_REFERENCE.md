# Bulk Overlay Selectors - Quick Reference

## Selector Syntax

| Selector | Syntax | Example | Description |
|----------|--------|---------|-------------|
| **All** | `all:` | `all: {style: {...}}` | Target all overlays |
| **Type** | `type:typename:` | `type:apexchart: {style: {...}}` | Target by overlay type |
| **Tag** | `tag:tagname:` | `tag:critical: {style: {...}}` | Target by tag |
| **Pattern** | `pattern:regex:` | `pattern:^temp_.*: {style: {...}}` | Target by ID pattern (regex) |
| **Direct** | `overlay_id:` | `text1: {style: {...}}` | Direct ID (backwards compatible) |
| **Exclude** | `exclude: [...]` | `exclude: ["logo", "header"]` | Exclude specific IDs |

---

## Common Patterns

### Pattern 1: Red Alert (All Overlays)
```yaml
rules:
  - when: {entity: input_select.alert, state: "red_alert"}
    apply:
      overlays:
        all:
          style:
            color: "var(--lcars-red)"
            border_color: "var(--lcars-red)"
            border_width: 4
        exclude: ["ship_logo", "stardate"]
```

### Pattern 2: Critical Systems Only
```yaml
overlays:
  - id: warp_temp
    tags: ["critical"]
  - id: shields
    tags: ["critical"]

rules:
  - when: {entity: sensor.alert_level, above: 5}
    apply:
      overlays:
        tag:critical:
          style: {color: "var(--lcars-yellow)"}
```

### Pattern 3: Type-Specific Styling
```yaml
rules:
  - when: {entity: input_boolean.compact_mode, state: "on"}
    apply:
      overlays:
        type:apexchart:
          size: [250, 120]
        type:text:
          style: {font_size: 12}
```

### Pattern 4: Layered Styling
```yaml
rules:
  - when: {entity: input_select.alert, state: "intruder_alert"}
    apply:
      overlays:
        all:
          style: {border_color: "yellow", border_width: 1}
        tag:security:
          style: {color: "red", border_width: 4}
        tag:access-control:
          style: {border_width: 6}
        exclude: ["ship_logo"]
```

### Pattern 5: Pattern Matching
```yaml
rules:
  - when: {entity: sensor.avg_temp, above: 80}
    apply:
      overlays:
        pattern:^temp_.*:  # All IDs starting with "temp_"
          style: {color: "var(--lcars-red)"}
```

---

## Recommended Tags

### By Criticality
- `critical` - Life-critical systems
- `important` - Important but not critical
- `informational` - Display-only

### By Function
- `engineering` - Engineering systems
- `tactical` - Weapons/shields/sensors
- `navigation` - Navigation/helm
- `security` - Security systems
- `medical` - Medical systems

### By Behavior
- `alert-sensitive` - Changes on alerts
- `real-time` - Updates frequently
- `static` - Rarely changes

---

## Debugging

### Check Overlays with Tags
```javascript
window.cblcars.debug.msd.resolvedModel.overlays
```

### Check Selector Resolution
```javascript
// Look for this in console:
// [RulesEngine] Selector resolution complete: {
//   selectors: 3,
//   patchesGenerated: 8,
//   resolutionTime: "2.5ms"
// }
```

### Enable Debug Mode
```javascript
window.cblcars = {
  debug: {
    rules: true  // Verbose selector logging
  }
};
```

---

## Performance

**Typical Performance:**
- 10 overlays: <1ms
- 50 overlays: ~2ms
- 100 overlays: ~5ms

**Acceptable** for standard use (10-50 overlays).

---

## Migration

### Step 1: Add Tags
```yaml
overlays:
  - id: text1
    tags: ["critical"]
```

### Step 2: Use Selectors
```yaml
rules:
  - apply:
      overlays:
        tag:critical:
          style: {color: "red"}
```

### Backwards Compatible
```yaml
# Old syntax still works:
rules:
  - apply:
      overlays:
        - id: text1
          style: {color: "red"}
```

---

## Full Documentation

- **User Guide:** `/doc/user-guide/configuration/bulk-overlay-selectors.md`
- **Architecture:** `/doc/architecture/subsystems/bulk-overlay-selectors.md`
- **Test Config:** `/src/test-bulk-selectors-red-alert.yaml`
- **Implementation:** `/doc/BULK_OVERLAY_SELECTORS_IMPLEMENTATION_SUMMARY.md`
