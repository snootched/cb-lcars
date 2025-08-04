# LCARS MSD Timelines – Animation Orchestration

## Overview

Timelines allow you to sequence, coordinate, and layer multiple animations for advanced LCARS effects. Each timeline is defined in YAML, supports global params, and merges with element-level animation configs.

---

## Timeline Structure

```yaml
timelines:
  alert_sequence:
    loop: true
    direction: alternate
    steps:
      - targets: "#alert_indicator"
        type: strobe
        duration: 400
      - targets: "#alert_text"
        type: pulse
        duration: 800
        offset: '-=200'
```

- Each timeline is keyed and can have global params and steps.
- Steps merge: element animation block → timeline globals → step params.

---

## Advanced Example

```yaml
timelines:
  main_sequence:
    loop: true
    steps:
      - targets: "#warp_core_line"
        type: draw
        duration: 900
      - targets: "#warp_core_label"
        type: pulse
        duration: 1200
        offset: '-=400'
  indicator_sequence:
    loop: false
    steps:
      - targets: "#alert_indicator"
        type: strobe
        duration: 400
        colors: [var(--lcars-red), var(--lcars-yellow)]
```

---

## Best Practices

- Use explicit IDs for targets.
- Group related steps for clarity.
- Use timeline-wide globals for DRY configs.
- Overlapping effects: last animation wins.
- All missing targets or config issues are logged for debugging.

---

## Migration Notes

- Existing single timeline configs remain valid.
- Multiple timelines are additive.
- Element animation blocks and timeline steps continue to merge as before.

---

## See Also

- [Main MSD Documentation](./msd-main.md)
- [Animation Presets Reference](./msd-animation-presets.md)

---
