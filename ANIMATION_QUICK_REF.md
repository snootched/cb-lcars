# Animation System - Developer Quick Reference

# CB-LCARS Animation System - Quick Reference

**Status:** Phase 1: ✅ Complete | Phase 1.5: ✅ Complete | Phase 2: 📋 Spec'd

---

## Current State (Phase 1)

### Supported Triggers
```yaml
on_load         # ✅ On overlay render
on_tap          # ✅ Click/tap
on_double_tap   # ✅ Double click/tap
on_hold         # ✅ Long press (500ms)
on_hover        # ✅ Mouse enter (desktop only)
on_datasource_change  # 🔮 Phase 2
on_leave        # 🔧 Phase 1.5
```

### Built-in Presets
```yaml
glow      # Glowing halo effect
pulse     # Scale pulse
fade      # Opacity fade in/out
slide     # Translate movement
rotate    # Rotation animation
```

### Basic Usage
```yaml
overlays:
  - id: my_button
    type: button
    animations:
      - preset: glow
        trigger: on_tap
        duration: 500
        color: var(--lcars-blue)
```

---

## Known Issues

### ⚠️ Hover animations don't stop on leave
**Status:** 🔧 Fix ready in Phase 1.5

**Problem:**
```yaml
animations:
  - preset: glow
    trigger: on_hover
    loop: true  # ❌ Loops forever even after leaving
```

**Solution:** ✅ Fixed in Phase 1.5 - hover animations now auto-stop on leave!

---

## Phase 1.5 Features (✅ Implemented)

### New: on_leave Trigger
```yaml
animations:
  # Hover animation - auto-stops on leave!
  - preset: glow
    trigger: on_hover
    loop: true  # ✅ Stops automatically when pointer leaves

  # Optional custom leave animation
  - preset: fade
    trigger: on_leave
    duration: 200
```

**Key Features:**
- ✅ Hover animations with `loop: true` stop automatically when pointer leaves
- ✅ Uses `instance.revert()` to return to original visual state
- ✅ No frozen frames or dark first-frame issues
- ✅ Leave-only animations work without requiring hover
- ✅ Desktop only (requires mouse pointer)

### New: AnimationManager.stopAnimations()
```javascript
// Stop all animations on overlay
animationManager.stopAnimations('button_id');

// Stop specific trigger type (e.g., stop hover animations on leave)
animationManager.stopAnimations('button_id', 'on_hover');
```

**Examples:**

Hover with auto-stop:
```yaml
animations:
  - preset: glow
    trigger: on_hover
    loop: true
    color: var(--lcars-blue)
# Stops automatically - no on_leave needed!
```

Hover + custom leave:
```yaml
animations:
  - preset: pulse
    trigger: on_hover
    loop: true
  - trigger: on_leave
    scale: 1.0
    duration: 200
```

Leave-only:
```yaml
animations:
  - preset: fade
    trigger: on_leave
    opacity: 0.5
# Works without on_hover!
```

---

## Phase 2 Changes (Spec'd)

### 1. DataSource Trigger (Functional)
```yaml
data_sources:
  cpu_temp:
    type: entity
    entity: sensor.cpu_temperature

overlays:
  - id: cpu_status
    animations:
      - preset: glow
        trigger: on_datasource_change
        datasource: cpu_temp
```

### 2. Animation Conditions
```yaml
animations:
  - preset: pulse
    trigger: on_datasource_change
    datasource: cpu_temp
    when:
      above: 80  # Only when > 80
```

### 3. Rules Integration
```yaml
rules:
  - when:
      entity: sensor.temperature
      above: 25
    apply:
      overlays:
        - id: temp_display
          animations:
            - preset: glow
```

### 4. Template Resolution
```yaml
animations:
  - preset: fade
    trigger: on_tap
    duration: "{{entity:input_number.speed}}"
```

### 5. Rate Limiting
```yaml
animations:
  - preset: glow
    trigger: on_datasource_change
    datasource: cpu_temp
    cooldown: 500  # Min 500ms between plays
```

---

## API Reference

### Runtime API
```javascript
// Trigger animation
window.cblcars.msd.animate('overlay_id', 'pulse', {
  duration: 800,
  color: 'var(--lcars-red)'
});

// Stop animation
window.cblcars.msd.stopAnimation('overlay_id');

// Pause/resume
window.cblcars.msd.pauseAnimation('overlay_id');
window.cblcars.msd.resumeAnimation('overlay_id');
```

### Debug API
```javascript
// Check active animations
const active = window.cblcars.debug.msd.animations.active();

// Inspect overlay
const state = window.cblcars.debug.msd.animations.inspect('overlay_id');

// Registry stats
const stats = window.cblcars.debug.msd.animations.registryStats();

// Manual trigger
window.cblcars.debug.msd.animations.trigger('overlay_id', 'glow', {
  duration: 500
});
```

---

## Implementation Checklist

### Phase 1.5 (1 day)
- [ ] Add `stopAnimations()` to AnimationManager.js
- [ ] Track `_trigger` on animations in triggerAnimations()
- [ ] Add `mouseleave` handler in ActionHelpers.js
- [ ] Add `on_leave` to AnimationConfigProcessor.js
- [ ] Test hover/leave behavior
- [ ] Update docs

### Phase 2 (3-4 weeks)
- [ ] `setupDatasourceListener()` in AnimationManager
- [ ] `_evaluateAnimationConditions()` for when clauses
- [ ] `_resolveTemplates()` for {{template}} support
- [ ] RulesEngine animation patches
- [ ] Cooldown/rate limiting
- [ ] Testing & docs

---

## File Map

### Core
```
src/msd/animation/
  ├── AnimationManager.js      # Orchestration, scopes, API
  ├── TriggerManager.js         # Reactive triggers (load, datasource)
  └── AnimationConfigProcessor.js  # YAML validation

src/msd/renderer/
  └── ActionHelpers.js          # Interactive triggers (tap, hover, hold)
```

### API
```
src/api/
  ├── MsdRuntimeAPI.js          # Public API (animate, stop, etc.)
  └── MsdDebugAPI.js            # Debug tools (inspect, dump, etc.)
```

### Docs
```
doc/
  ├── user-guide/guides/animations.md
  ├── architecture/ANIMATION_SYSTEM_STATUS.md
  └── proposals/not-started/
      ├── ANIMATION_PHASE1_5_ON_LEAVE_FIX.md
      └── ANIMATION_SYSTEM_PHASE2_SPEC.md
```

---

## Testing Quick Reference

### Manual Test Checklist
```bash
# Phase 1
✅ on_tap animations work
✅ on_hold animations work (500ms)
✅ on_hover animations work (desktop only)
✅ on_double_tap animations work
✅ on_load animations work
✅ All presets work (glow, pulse, fade, slide, rotate)
✅ Custom animations work (anime.js properties)
✅ No tap_action needed for animations

# Phase 1.5
⏳ on_hover stops on mouseleave
⏳ on_leave animations play
⏳ Rapid hover/leave cycles work

# Phase 2
⏳ on_datasource_change triggers
⏳ when conditions filter correctly
⏳ Rules trigger animations
⏳ Templates resolve
⏳ Cooldown prevents spam
```

---

## Common Patterns

### Hover Glow
```yaml
animations:
  - preset: glow
    trigger: on_hover
    color: var(--lcars-blue)
    duration: 300
```

### Tap Feedback
```yaml
animations:
  - preset: pulse
    trigger: on_tap
    scale: 1.1
    duration: 200
```

### Data-Reactive (Phase 2)
```yaml
animations:
  - preset: glow
    trigger: on_datasource_change
    datasource: cpu_temp
    when:
      above: 80
    color: var(--lcars-red)
```

### Smooth Hover/Leave (Phase 1.5)
```yaml
animations:
  - preset: fade
    trigger: on_hover
    opacity: 0.7
    duration: 200
  - preset: fade
    trigger: on_leave
    opacity: 1.0
    duration: 200
```

---

## Performance Notes

### Phase 1
- One anime.js scope per overlay
- AnimationRegistry caches up to 50 animations
- Desktop detection for hover (`hover: hover` media query)
- Duplicate attachment prevention

### Phase 2
- DataSource subscriptions grouped by source
- Condition evaluation short-circuits on fail
- Template resolution cached per animation play
- Optional cooldown prevents spam

---

## Breaking Changes

### Phase 1 → Phase 1.5
**NONE** - Purely additive

### Phase 1.5 → Phase 2
**NONE** - Purely additive

---

## Links

- **Phase 1 Status:** `ANIMATION_PHASE1_COMPLETE.md`
- **Phase 1.5 Guide:** `doc/proposals/not-started/ANIMATION_PHASE1_5_ON_LEAVE_FIX.md`
- **Phase 2 Spec:** `doc/proposals/not-started/ANIMATION_SYSTEM_PHASE2_SPEC.md`
- **User Guide:** `doc/user-guide/guides/animations.md`
- **Next Steps:** `ANIMATION_NEXT_STEPS.md`

---

*Quick Reference - v1.0*
*Updated: November 2, 2025*
