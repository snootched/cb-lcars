# Animation System - Next Steps Summary

**Date:** November 2, 2025
**Status:** Phase 1 Complete ✅ | Phase 1.5 Ready 🔧 | Phase 2 Spec'd 📋

---

## Quick Status

### ✅ Phase 1 - COMPLETE
- Core AnimationManager & TriggerManager
- All interactive triggers working (tap, hold, hover, double_tap)
- on_load animations working
- Built-in presets (glow, pulse, fade, slide, rotate)
- Custom animations & custom presets
- Runtime API (animate, stop, pause, resume)
- Debug API (active, dump, inspect, registryStats, trigger, timeline)
- Pointer-events fix (animations work without dummy tap_action)
- Comprehensive documentation

### 🔧 Phase 1.5 - READY TO IMPLEMENT
**Priority:** HIGH (Quality-of-life fix)
**Effort:** 1 day
**Issue:** Hover animations with loop: true don't stop when pointer leaves

**Solution:**
1. Add `stopAnimations()` method to AnimationManager
2. Add `mouseleave` handler in ActionHelpers
3. Add `on_leave` trigger support
4. Auto-stop looping hover animations

**See:** `ANIMATION_PHASE1_5_ON_LEAVE_FIX.md` for complete implementation guide

### 📋 Phase 2 - SPEC'D & READY
**Effort:** 3-4 weeks (after Phase 1.5)
**Status:** Specification complete, design decisions finalized

**Features:**
1. ✅ on_datasource_change trigger (simple change detection)
2. ✅ Entity state conditions (when: above/below/equals/state)
3. ✅ RulesEngine integration (animations in apply.overlays)
4. ✅ Template resolution ({{entity:id}} in params)
5. ✅ Rate limiting (cooldown property)

**See:** `ANIMATION_SYSTEM_PHASE2_SPEC.md` for complete specification

---

## Your Feedback - Incorporated ✅

### Question: Tag-based targeting in rules?
**Answer:** ✅ Already supported! RulesEngine has `type:button`, `all:`, etc. Adding animations to overlay patches means tags work automatically.

**Example:**
```yaml
rules:
  - when:
      entity: binary_sensor.motion
      state: "on"
    apply:
      overlays:
        - type: button  # All buttons
          animations:
            - preset: pulse
```

### Question: Change direction detection?
**Decision:** ✅ Keep simple for Phase 2
- Trigger on any datasource change
- Use conditions to filter when animations play
- Can add `change_type: increase|decrease` in Phase 3 if needed

### Question: Multiple triggers per animation?
**Decision:** ✅ Not needed
- Users can define multiple animation objects
- Clearer semantics
- No compelling use case

### Question: Rate limiting?
**Decision:** ✅ Add optional `cooldown` property
- Per-animation control
- Prevents spam from rapid updates
- Optional - doesn't impact existing behavior

**Example:**
```yaml
animations:
  - preset: glow
    trigger: on_datasource_change
    datasource: cpu_temp
    cooldown: 500  # Min 500ms between plays
```

### Question: Template caching?
**Decision:** ✅ Resolve fresh on each play
- Templates reference dynamic values
- Minimal performance impact
- No complex invalidation logic needed

---

## Phase 1 Issue: on_leave Fix

### The Problem
```yaml
# This loops FOREVER once you hover (even after leaving)
animations:
  - preset: glow
    trigger: on_hover
    loop: true
```

### The Solution (Phase 1.5)
1. **Auto-stop** looping hover animations on mouseleave
2. **Add on_leave trigger** for custom exit animations

```yaml
# After Phase 1.5 - stops automatically
animations:
  - preset: glow
    trigger: on_hover
    loop: true  # Stops when you leave!

  # Optional custom leave animation
  - preset: fade
    trigger: on_leave
    duration: 200
```

---

## Recommended Action Plan

### Step 1: Phase 1.5 (1 day) 🔧
**Priority:** HIGH - Do this first

**Tasks:**
1. Add `stopAnimations()` to AnimationManager
2. Track trigger type on animations (`_trigger` property)
3. Add `mouseleave` handler in ActionHelpers
4. Add `on_leave` to valid triggers
5. Test hover/leave behavior
6. Update documentation

**Files to modify:**
- `src/msd/animation/AnimationManager.js`
- `src/msd/renderer/ActionHelpers.js`
- `src/msd/animation/AnimationConfigProcessor.js`
- `src/msd/animation/TriggerManager.js`
- `doc/user-guide/guides/animations.md`

**Implementation guide:** `ANIMATION_PHASE1_5_ON_LEAVE_FIX.md`

### Step 2: Phase 2 (3-4 weeks) 📋
**Start after Phase 1.5 complete**

**Week 1:**
- DataSource integration (`setupDatasourceListener()`)
- Condition evaluation (`_evaluateAnimationConditions()`)

**Week 2:**
- RulesEngine integration (animate on rule match)
- Template resolution (`_resolveTemplates()`)

**Week 3:**
- Rate limiting (cooldown enforcement)
- Comprehensive testing

**Week 4:**
- Documentation updates
- Example configurations
- Final polish

**Full spec:** `ANIMATION_SYSTEM_PHASE2_SPEC.md`

---

## Key Files

### Implementation Guides
- `ANIMATION_PHASE1_5_ON_LEAVE_FIX.md` - Quick fix for hover/leave
- `ANIMATION_SYSTEM_PHASE2_SPEC.md` - Complete Phase 2 specification

### Documentation
- `doc/user-guide/guides/animations.md` - User-facing guide
- `doc/architecture/ANIMATION_SYSTEM_STATUS.md` - Status tracking
- `ANIMATION_PHASE1_COMPLETE.md` - Phase 1 summary

### Source Code
- `src/msd/animation/AnimationManager.js` - Core orchestration
- `src/msd/animation/TriggerManager.js` - Reactive triggers
- `src/msd/renderer/ActionHelpers.js` - Interactive triggers
- `src/api/MsdRuntimeAPI.js` - Public API
- `src/api/MsdDebugAPI.js` - Debug tools

---

## Phase 2 Feature Highlights

### 1. DataSource-Driven Animations

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
        when:
          above: 80
        color: var(--lcars-red)
```

### 2. Conditional Animations

```yaml
animations:
  - preset: pulse
    trigger: on_datasource_change
    datasource: humidity
    when:
      between: [30, 70]  # Only when in range
```

### 3. Rules Integration

```yaml
rules:
  - id: critical_temp
    when:
      entity: sensor.temperature
      above: 25
    apply:
      overlays:
        - id: temp_display
          style:
            color: var(--lcars-red)
          animations:
            - preset: pulse
              duration: 300
```

### 4. Template Resolution

```yaml
animations:
  - preset: fade
    trigger: on_tap
    duration: "{{entity:input_number.animation_speed}}"
    opacity: "{{cpu_temp.transformations.normalized}}"
```

### 5. Rate Limiting

```yaml
animations:
  - preset: glow
    trigger: on_datasource_change
    datasource: cpu_temp
    cooldown: 500  # Prevent spam
```

---

## Timeline Summary

```
┌─────────────┬─────────────────────────────────────────────┐
│ Phase       │ Duration                                    │
├─────────────┼─────────────────────────────────────────────┤
│ Phase 1     │ ✅ COMPLETE                                 │
│ Phase 1.5   │ 🔧 1 day (on_leave fix)                    │
│ Phase 2     │ 📋 3-4 weeks (datasource, rules, etc.)     │
│ Phase 3     │ ⏳ TBD (timelines, advanced features)       │
└─────────────┴─────────────────────────────────────────────┘
```

---

## Questions Answered ✅

| Question | Answer |
|----------|--------|
| Tag-based targeting in rules? | ✅ Already works via RulesEngine selectors |
| Change direction detection? | ✅ Keep simple, add in Phase 3 if needed |
| Multiple triggers? | ✅ Not needed, use multiple animation objects |
| Rate limiting? | ✅ Add cooldown property (optional) |
| Template caching? | ✅ Resolve fresh, minimal performance impact |
| Hover animations not stopping? | ✅ Fixed in Phase 1.5 with on_leave trigger |

---

## Next Steps

1. **Review Phase 1.5 implementation guide** (`ANIMATION_PHASE1_5_ON_LEAVE_FIX.md`)
2. **Implement Phase 1.5** (1 day)
3. **Review Phase 2 spec** (`ANIMATION_SYSTEM_PHASE2_SPEC.md`)
4. **Start Phase 2 implementation** (3-4 weeks)

---

## Success! 🎉

Phase 1 delivered a robust, production-ready animation system. Phase 1.5 fixes a quality-of-life issue. Phase 2 will add reactive, data-driven capabilities. All design decisions have been made and documented.

**You're ready to move forward with confidence!**

---

*Animation System Progress Summary*
*Updated: November 2, 2025*
