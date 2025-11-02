# Animation System - Phase 1.5: on_leave Fix

**Status:** 🔧 Ready to Implement
**Priority:** HIGH
**Effort:** 1-2 days
**Dependencies:** Phase 1 Complete ✅

---

## Problem Statement

**Issue:** `on_hover` animations with `loop: true` continue running indefinitely after the pointer leaves the element.

**Expected Behavior:**
- Animation starts when pointer enters (mouseenter)
- Animation stops when pointer leaves (mouseleave)

**Current Behavior:**
- Animation starts on mouseenter ✅
- Animation continues forever ❌

---

## Root Cause

`ActionHelpers.js` (lines 176-189) implements hover trigger but only handles `mouseenter`:

```javascript
// Current implementation
if (isDesktop) {
  const hoverHandler = () => {
    cblcarsLog.debug(`[ActionHelpers] 🖱️ Hover triggered on ${overlayId}`);
    animationManager.triggerAnimations(overlayId, 'on_hover');
  };
  element.addEventListener('mouseenter', hoverHandler, { capture: false });
  // ❌ No mouseleave handler!
}
```

---

## Solution Design

### Two-Part Fix

1. **Auto-stop looping hover animations** on mouseleave
2. **Add `on_leave` trigger** for custom exit animations

### Why Both?

- **Auto-stop:** Solves the immediate problem without config changes
- **on_leave trigger:** Provides flexibility for custom exit animations

---

## Implementation

### Step 1: Add stopAnimations() Method

**File:** `src/msd/animation/AnimationManager.js`

**Location:** After `triggerAnimations()` method (~line 240)

```javascript
/**
 * Stop animations for specific overlay and trigger type
 * @param {string} overlayId - Overlay identifier
 * @param {string} [trigger] - Optional trigger type to stop (stops all if not specified)
 */
stopAnimations(overlayId, trigger = null) {
  const scope = this.scopes.get(overlayId);

  if (!scope || !scope.scope) {
    cblcarsLog.debug(`[AnimationManager] No scope found for ${overlayId}`);
    return;
  }

  // Get all active children in the scope
  const activeChildren = scope.scope.children || [];

  if (activeChildren.length === 0) {
    cblcarsLog.debug(`[AnimationManager] No active animations for ${overlayId}`);
    return;
  }

  let stopped = 0;

  // Stop animations matching the trigger type
  activeChildren.forEach(child => {
    // If trigger specified, only stop animations for that trigger
    if (trigger && child._trigger !== trigger) {
      return;
    }

    try {
      child.pause();
      stopped++;
      cblcarsLog.debug(
        `[AnimationManager] ⏸️ Stopped animation on ${overlayId}` +
        (trigger ? ` (trigger: ${trigger})` : '')
      );
    } catch (error) {
      cblcarsLog.warn(`[AnimationManager] Error stopping animation:`, error);
    }
  });

  if (stopped > 0) {
    cblcarsLog.debug(`[AnimationManager] Stopped ${stopped} animation(s) on ${overlayId}`);
  }
}
```

### Step 2: Track Trigger Type on Animations

**File:** `src/msd/animation/AnimationManager.js`

**Method:** `triggerAnimations()` (line ~203)

**Change:** Add trigger type to anime instance for later reference

```javascript
triggerAnimations(overlayId, triggerType, resolvedParams = {}) {
  // ... existing code ...

  animDefs.forEach(animDef => {
    // ... existing animation creation code ...

    // ✨ NEW: Store trigger type on the anime instance
    if (animation) {
      animation._trigger = triggerType;
      animation._overlayId = overlayId;
    }
  });
}
```

### Step 3: Add mouseleave Handler

**File:** `src/msd/renderer/ActionHelpers.js`

**Location:** After mouseenter handler (~line 186)

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

    // ✨ NEW: On leave - stop hover animations and trigger leave animations
    const leaveHandler = () => {
      cblcarsLog.debug(`[ActionHelpers] 🖱️ Leave triggered on ${overlayId}`);

      // Stop any looping hover animations
      animationManager.stopAnimations(overlayId, 'on_hover');

      // Trigger on_leave animations (if configured)
      animationManager.triggerAnimations(overlayId, 'on_leave');
    };
    element.addEventListener('mouseleave', leaveHandler, { capture: false });

    cblcarsLog.debug(`[ActionHelpers] ✅ Hover/leave handlers attached for ${overlayId}`);
  } else {
    cblcarsLog.debug(`[ActionHelpers] ⏭️ Skipping hover handlers for ${overlayId} (not desktop)`);
  }
}
```

### Step 4: Add on_leave to Valid Triggers

**File:** `src/msd/animation/AnimationConfigProcessor.js`

**Location:** VALID_TRIGGERS array (~line 218)

```javascript
const VALID_TRIGGERS = [
  'on_load',
  'on_tap',
  'on_double_tap',
  'on_hold',
  'on_hover',
  'on_leave',        // ✨ NEW
  'on_datasource_change'
];
```

### Step 5: Update TriggerManager (if needed)

**File:** `src/msd/animation/TriggerManager.js`

**Change:** Add on_leave to interactive triggers list (~line 72)

```javascript
const interactiveTriggers = [
  'on_tap',
  'on_hold',
  'on_hover',
  'on_leave',     // ✨ NEW
  'on_double_tap'
];
```

---

## YAML Configuration Examples

### Example 1: Auto-Stop Hover Animation

```yaml
overlays:
  - id: status_button
    type: button
    text: "Status"
    animations:
      # Glow on hover, stops on leave automatically
      - preset: glow
        trigger: on_hover
        loop: true
        color: var(--lcars-blue)
        duration: 1000
```

**Behavior:**
- Pointer enters → glow starts looping
- Pointer leaves → glow stops automatically

### Example 2: Custom Leave Animation

```yaml
overlays:
  - id: interactive_panel
    type: button
    text: "Panel"
    animations:
      # Hover animation
      - preset: pulse
        trigger: on_hover
        loop: true
        duration: 800

      # Custom leave animation
      - preset: fade
        trigger: on_leave
        opacity: 1.0
        duration: 200
```

**Behavior:**
- Pointer enters → pulse starts looping
- Pointer leaves → pulse stops, fade plays once

### Example 3: Hover with Scale + Leave with Shrink

```yaml
overlays:
  - id: button_scale
    type: button
    text: "Scale Me"
    animations:
      # Grow on hover
      - trigger: on_hover
        scale: 1.1
        duration: 300
        easing: easeOutElastic(1, .5)

      # Shrink on leave
      - trigger: on_leave
        scale: 1.0
        duration: 200
        easing: easeOutQuad
```

---

## Testing Checklist

### Manual Testing

- [ ] Hover over button with `loop: true` animation
  - ✅ Animation starts
- [ ] Move pointer away
  - ✅ Animation stops
- [ ] Hover again
  - ✅ Animation restarts
- [ ] Configure `on_leave` animation
  - ✅ Leave animation plays when pointer exits
- [ ] Test with multiple animations on same overlay
  - ✅ All hover animations stop on leave
  - ✅ Leave animations play correctly
- [ ] Test on desktop and mobile
  - ✅ Hover/leave only work on desktop (pointer: fine)

### Edge Cases

- [ ] Hover over overlay without animations
  - ✅ No errors
- [ ] Hover with only `on_leave` animation (no `on_hover`)
  - ✅ Leave animation plays on mouseleave
- [ ] Rapid hover/leave cycles
  - ✅ Animations start/stop correctly
  - ✅ No memory leaks
- [ ] Overlay destroyed while hover animation playing
  - ✅ No errors, cleanup works

---

## Documentation Updates

### User Guide: Animations

**File:** `doc/user-guide/guides/animations.md`

**Add section after "Interactive Triggers":**

```markdown
#### on_leave Trigger

Plays when the pointer leaves an overlay element (desktop only).

**Common Uses:**
- Fade out hover effects
- Return to default state
- Reset scales/transforms

**Example:**
```yaml
animations:
  # Hover effect
  - preset: glow
    trigger: on_hover
    loop: true
    color: var(--lcars-blue)

  # Clean exit
  - preset: fade
    trigger: on_leave
    opacity: 1.0
    duration: 200
```

**Note:** Hover animations with `loop: true` automatically stop when the pointer leaves, even without an explicit `on_leave` animation.
```

---

## Success Criteria

Phase 1.5 is complete when:

1. ✅ `stopAnimations()` method implemented and tested
2. ✅ `on_leave` trigger recognized by config processor
3. ✅ `mouseleave` handler attached in ActionHelpers
4. ✅ Hover animations with `loop: true` stop on leave
5. ✅ Custom `on_leave` animations work correctly
6. ✅ All manual tests pass
7. ✅ Documentation updated
8. ✅ No breaking changes to existing configs

---

## Files to Modify

1. `src/msd/animation/AnimationManager.js` - Add `stopAnimations()`, track trigger type
2. `src/msd/renderer/ActionHelpers.js` - Add `mouseleave` handler
3. `src/msd/animation/AnimationConfigProcessor.js` - Add `on_leave` to valid triggers
4. `src/msd/animation/TriggerManager.js` - Add `on_leave` to interactive triggers list
5. `doc/user-guide/guides/animations.md` - Document `on_leave` trigger

---

## Estimated Effort

| Task | Time |
|------|------|
| Add `stopAnimations()` method | 2 hours |
| Update `triggerAnimations()` to track trigger type | 1 hour |
| Add `mouseleave` handler | 1 hour |
| Update configuration validation | 1 hour |
| Manual testing | 2 hours |
| Documentation | 2 hours |
| **Total** | **9 hours (~1 day)** |

---

## Ready to Implement? ✅

This fix is:
- **Well-scoped** - Clear problem, clear solution
- **Low-risk** - Purely additive, no breaking changes
- **High-value** - Improves user experience immediately
- **Quick** - Can be done in 1 day

**Recommendation:** Implement Phase 1.5 before starting Phase 2.

---

*Phase 1.5 Implementation Guide*
*Created: November 2, 2025*
