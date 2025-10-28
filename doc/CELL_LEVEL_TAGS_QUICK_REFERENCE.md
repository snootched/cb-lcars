# Cell-Level Tags Quick Reference

## Syntax Summary

| Target Type | Syntax | Example |
|-------------|--------|---------|
| **Single Tag** | `tag: "tagname"` | `tag: "critical"` |
| **Multiple Tags (OR)** | `tags: ["tag1", "tag2"]` | `tags: ["engineering", "tactical"]` |
| **Multiple Tags (AND)** | `tags: ["tag1", "tag2"]`<br>`match_all: true` | `tags: ["critical", "propulsion"]`<br>`match_all: true` |

---

## Configuration Examples

### Tagging Cells

```yaml
overlays:
  - id: my_grid
    type: status_grid
    cells:
      - position: [0, 0]
        label: "Cell 1"
        tags: ["critical", "engineering"]  # ✨ Add tags
```

### Targeting Cells in Rules

```yaml
rules:
  # Single tag
  - apply:
      overlays:
        - id: my_grid
          cell_target:
            tag: "critical"
          style: {color: "red"}

  # Multiple tags (OR)
  - apply:
      overlays:
        - id: my_grid
          cell_target:
            tags: ["engineering", "tactical"]  # Match ANY
          style: {color: "orange"}

  # Multiple tags (AND)
  - apply:
      overlays:
        - id: my_grid
          cell_target:
            tags: ["critical", "propulsion"]  # Match BOTH
            match_all: true
          style: {color: "red"}
```

---

## Common Tag Patterns

### By Criticality
```yaml
tags: ["critical"]       # Essential systems
tags: ["secondary"]      # Important but non-critical
tags: ["informational"]  # Display only
```

### By Department
```yaml
tags: ["engineering"]    # Engineering systems
tags: ["tactical"]       # Tactical/security
tags: ["medical"]        # Medical/life support
tags: ["communications"] # Comms systems
```

### By Function
```yaml
tags: ["propulsion"]     # Movement (warp, impulse)
tags: ["defense"]        # Shields, armor
tags: ["weapons"]        # Phasers, torpedoes
tags: ["environment"]    # Life support
```

### Multi-Tag Examples
```yaml
# Warp Core: Critical propulsion system in engineering
tags: ["critical", "propulsion", "engineering"]

# Shields: Critical defense system for tactical
tags: ["critical", "defense", "tactical"]

# Transporters: Secondary engineering system
tags: ["secondary", "engineering"]
```

---

## Tag Matching Logic

### Single Tag
```yaml
cell_target:
  tag: "critical"
```
**Matches:** Any cell that has the `"critical"` tag

### OR Logic (Default)
```yaml
cell_target:
  tags: ["engineering", "tactical"]
```
**Matches:** Cells with `"engineering"` OR `"tactical"` (or both)

### AND Logic
```yaml
cell_target:
  tags: ["critical", "propulsion"]
  match_all: true
```
**Matches:** Cells that have BOTH `"critical"` AND `"propulsion"` tags

---

## Real-World Example

```yaml
overlays:
  - id: ship_systems
    type: status_grid
    cells:
      # Critical propulsion
      - position: [0, 0]
        label: "Warp Core"
        tags: ["critical", "propulsion", "engineering"]

      - position: [0, 1]
        label: "Impulse"
        tags: ["critical", "propulsion", "engineering"]

      # Critical non-propulsion
      - position: [0, 2]
        label: "Life Support"
        tags: ["critical", "environment"]

      # Secondary
      - position: [1, 0]
        label: "Sensors"
        tags: ["secondary", "tactical"]

rules:
  # Yellow Alert: Critical systems only
  - when: {state: "yellow_alert"}
    apply:
      overlays:
        - id: ship_systems
          cell_target: {tag: "critical"}
          style: {color: "yellow"}
  # Result: Warp, Impulse, Life Support → Yellow

  # Engineering Alert: Engineering dept only
  - when: {state: "engineering_alert"}
    apply:
      overlays:
        - id: ship_systems
          cell_target: {tag: "engineering"}
          style: {color: "orange"}
  # Result: Warp, Impulse → Orange

  # Warp Failure: Critical propulsion only
  - when: {state: "warp_failure"}
    apply:
      overlays:
        - id: ship_systems
          cell_target:
            tags: ["critical", "propulsion"]
            match_all: true
          style: {color: "red"}
  # Result: Warp, Impulse → Red (Life Support stays normal)
```

---

## Browser Console Debug

```javascript
// Check cell tags
const grid = document.querySelector('[data-overlay-id="my_grid"]');
const cells = grid.querySelectorAll('[data-feature="cell"]');
cells.forEach(cell => {
  const label = cell.querySelector('text')?.textContent;
  const tags = cell.getAttribute('data-cell-tags');
  console.log(`${label}: ${tags}`);
});

// Evaluate rules
window.cblcars.rulesEngine.evaluateRules();
```

---

## Key Differences from Position Targeting

| Method | Example | Use When |
|--------|---------|----------|
| **Position** | `position: [0, 0]` | Single specific cell |
| **Row/Col** | `row: 0` | Entire row/column |
| **Cell ID** | `cell_id: "warp_core"` | Known cell ID |
| **Tag** | `tag: "critical"` | Semantic group |
| **Tags (OR)** | `tags: ["eng", "tac"]` | Multiple groups |
| **Tags (AND)** | `tags: ["crit", "prop"]`<br>`match_all: true` | Complex filtering |

---

## See Full Documentation

- **User Guide:** [doc/user-guide/configuration/bulk-overlay-selectors.md](../user-guide/configuration/bulk-overlay-selectors.md)
- **Status Grid Guide:** [doc/user-guide/configuration/overlays/status-grid-overlay.md](../user-guide/configuration/overlays/status-grid-overlay.md)
- **Test Config:** [src/test-status-grid-cell-tags.yaml](../../src/test-status-grid-cell-tags.yaml)
- **Implementation Summary:** [doc/CELL_LEVEL_TAGS_IMPLEMENTATION_SUMMARY.md](./CELL_LEVEL_TAGS_IMPLEMENTATION_SUMMARY.md)

---

**Feature Status:** ✅ Production Ready
