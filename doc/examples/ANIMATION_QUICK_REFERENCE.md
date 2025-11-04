# Animation System Quick Reference

Quick reference for using the MSD Animation System in Phase 1.

---

## YAML Configuration

### Basic Animation

```yaml
overlays:
  my_overlay:
    type: rect
    animations:
      - preset: pulse
        trigger: on_tap
        duration: 500
```

### Animation Targeting (New!)

Target specific parts of composed overlays like buttons:

```yaml
overlays:
  my_button:
    type: button
    texts:
      - text: "POWER"
        type: label
      - text: "{{sensor.power}}"
        type: value
    animations:
      # Animate just the label
      - preset: pulse
        trigger: on_tap
        target: label

      # Animate just the value/content
      - preset: glow
        trigger: on_datasource
        target: content

      # Animate multiple elements
      - preset: fade
        trigger: on_hover
        targets: [label, content]

      # Animate by array index
      - preset: shimmer
        trigger: on_load
        target: texts[0]
```

**Supported Targets:**
- **Buttons:** `label`, `content`/`value`, `texts[0]`, `texts[1]`, etc., `overlay`/`self`
- **Text:** `text`, `overlay`/`self`
- **Other overlays:** Use default (entire overlay) or CSS selectors
- **Multiple:** Use `targets: [...]` for array of targets

**Smart Defaults:**
- Buttons animate entire button when no target specified
- Text overlays animate text element (not wrapper) by default

### Custom Presets

```yaml
animation_presets:
  my_custom:
    type: glow
    duration: 1000
    color: var(--lcars-orange)
    blur: 15px

overlays:
  my_overlay:
    animations:
      - preset: my_custom
        trigger: on_load
```

### Supported Triggers

- `on_load` - Plays when overlay renders
- `on_tap` - Click/tap event
- `on_hover` - Mouse hover (desktop only)
- `on_hold` - Long press (500ms)
- `on_datasource` - Phase 2 (not yet functional)

### Built-in Presets

Phase 1 supports all 13 existing presets:
- `pulse`, `glow`, `march`, `motionpath`, `draw`
- `fade`, `blink`, `shimmer`, `strobe`
- `cascade`, `ripple`, `flicker`, `set`

---

## Runtime API

### Trigger Animation

```javascript
// Simple
window.cblcars.msd.animate('overlay_id', 'pulse');

// With parameters
window.cblcars.msd.animate('overlay_id', 'pulse', {
  duration: 800,
  color: 'var(--lcars-red)',
  scale: 1.2
});
```

### Control Playback

```javascript
// Stop
window.cblcars.msd.stopAnimation('overlay_id');

// Pause
window.cblcars.msd.pauseAnimation('overlay_id');

// Resume
window.cblcars.msd.resumeAnimation('overlay_id');
```

---

## Debug API

### Inspect Active Animations

```javascript
const active = window.cblcars.debug.msd.animations.active();
console.table(active);
```

### Inspect Overlay

```javascript
const state = window.cblcars.debug.msd.animations.inspect('overlay_id');
console.log('Active:', state.activeAnimations);
console.log('Triggers:', state.triggers);
```

### Registry Stats

```javascript
const stats = window.cblcars.debug.msd.animations.registryStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
```

### Manual Trigger (Testing)

```javascript
window.cblcars.debug.msd.animations.trigger('overlay_id', 'pulse', {
  duration: 500
});
```

### Dump All Animations

```javascript
const dump = window.cblcars.debug.msd.animations.dump();
console.log('Custom presets:', Object.keys(dump.customPresets));
console.log('Overlay animations:', dump.overlayAnimations);
```

---

## Common Parameters

### Duration & Timing

```yaml
- preset: pulse
  duration: 1000        # milliseconds
  delay: 200            # start delay
  easing: easeInOutQuad # anime.js easing
```

### Color & Style

```yaml
- preset: glow
  color: var(--lcars-orange)  # CSS color
  blur: 20px                   # glow intensity
```

### Scale & Transform

```yaml
- preset: pulse
  scale: 1.2           # scale factor
  rotate: 45           # degrees
```

### Loop & Direction

```yaml
- preset: pulse
  loop: true           # infinite loop
  direction: alternate # forward/reverse/alternate
```

---

## Error Handling

All API methods return result objects:

```javascript
const result = window.cblcars.msd.animate('overlay_id', 'pulse');

if (result.success) {
  console.log('Animation started');
} else {
  console.error(result.error, result.message);
}
```

Common errors:
- `NO_INSTANCE` - MSD not initialized
- `NO_ANIMATION_MANAGER` - Animation system not ready
- `ANIMATION_FAILED` - Invalid overlay or preset
- `INVALID_ARGUMENTS` - Wrong method arguments

---

## Browser Console Shortcuts

```javascript
// Alias for convenience
const msd = window.cblcars.msd;
const dbg = window.cblcars.debug.msd;

// Quick test
msd.animate('my_overlay', 'pulse');

// Check active
dbg.animations.active();

// Inspect
dbg.animations.inspect('my_overlay');
```

---

## Performance Tips

1. **Use Custom Presets** for frequently used animations
2. **Check Registry Stats** to monitor cache performance
3. **Avoid Excessive on_load** animations (too many can slow render)
4. **Use Debug API** to identify bottlenecks

```javascript
// Monitor performance
const stats = window.cblcars.debug.msd.animations.registryStats();
if (stats.hitRate < 0.8) {
  console.warn('Low cache hit rate - consider optimizing presets');
}
```

---

## Testing Checklist

- [ ] on_load animations play on render
- [ ] on_tap animations respond to clicks
- [ ] on_hover animations work on desktop
- [ ] on_hold animations trigger after 500ms
- [ ] Custom presets resolve correctly
- [ ] Runtime API animate() works
- [ ] Debug API inspect() shows correct state
- [ ] Animations stop/pause/resume properly

---

## Phase 1 Limitations

**Not Yet Functional:**
- on_datasource triggers (Phase 2)
- Timeline playback (Phase 3)
- RulesEngine integration (Phase 2)
- Multi-instance cardId (Phase 0)

**Coming in Phase 2:**
- DataSource-triggered animations
- Entity state conditions
- Rules-based animation
- Template parameter resolution

---

*Phase 1 Quick Reference - Core Animation System*
