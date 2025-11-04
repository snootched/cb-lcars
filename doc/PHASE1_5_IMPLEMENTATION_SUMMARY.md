# Phase 1.5 Implementation Summary - on_leave Trigger

**Date:** November 2, 2025
**Status:** ✅ Complete and Tested
**Feature:** Stop looping hover animations and trigger leave animations

---

## Problem Statement

Hover animations with `loop: true` would continue forever after the pointer left the element. There was no way to:
1. Stop looping hover animations when the pointer leaves
2. Trigger animations when the pointer leaves (complementary to hover)

---

## Solution Overview

Implemented `on_leave` trigger support with automatic hover animation cleanup:
- **on_hover animations stop automatically** when pointer leaves (using `instance.revert()`)
- **on_leave animations trigger** when pointer leaves
- **Leave-only animations** work without requiring hover animations

---

## Technical Implementation

### 1. Modified `animateElement` Helper
**File:** `src/utils/cb-lcars-anim-helpers.js`

Added optional callback parameter to track anime instances:

```javascript
export async function animateElement(scope, options, hass = null, onInstanceCreated = null) {
  // ... existing code ...

  const animeInstance = window.cblcars.anim.anime(targetElement, animeParams);

  // Call callback with the created instance (for tracking)
  if (onInstanceCreated && typeof onInstanceCreated === 'function') {
    onInstanceCreated(animeInstance);
  }
}
```

**Why:** Enables reliable tracking of anime instances as they're created asynchronously within scope callbacks.

---

### 2. Instance Tracking in AnimationManager
**File:** `src/msd/animation/AnimationManager.js`

#### Added tracking structure:
```javascript
this.scopes.set(overlayId, {
  scope: scope,
  overlay: overlayConfig,
  element: element,
  activeAnimations: new Set(),
  triggerManager: triggerManager,
  runningInstances: new Map() // trigger -> Array<animeInstance>
});
```

#### Track instances when animations play:
```javascript
// Prepare array to collect anime instances created by animateElement
if (!scopeData.runningInstances.has(animDef.trigger)) {
  scopeData.runningInstances.set(animDef.trigger, []);
}
const instancesArray = scopeData.runningInstances.get(animDef.trigger);

// Callback to track instances as they're created
const onInstanceCreated = (instance) => {
  if (instance) {
    instancesArray.push(instance);
    cblcarsLog.debug(`[AnimationManager] 📌 Tracked anime instance for trigger: ${animDef.trigger}`);
  }
};

// Execute animation with callback
await animateElement(scopeData, animOptions, hass, onInstanceCreated);
```

---

### 3. stopAnimations() Method
**File:** `src/msd/animation/AnimationManager.js`

Stops animations by trigger type and reverts to original visual state:

```javascript
stopAnimations(overlayId, trigger = null) {
  const scopeData = this.scopes.get(overlayId);

  if (trigger) {
    const instances = scopeData.runningInstances.get(trigger) || [];

    instances.forEach(instance => {
      if (instance && !instance.completed) {
        // Revert animation - removes all transformations and returns to original state
        // This is better than seek(0) which goes to first animation frame
        if (instance.revert) {
          instance.revert();
          stopped++;
        }
      }
    });

    scopeData.runningInstances.delete(trigger);
  }
}
```

**Key Decision:** Use `instance.revert()` instead of `seek(0) + pause()`:
- ✅ Returns element to original CSS state (not first animation frame)
- ✅ Removes all anime.js transformations cleanly
- ✅ No "dark glow" issue (frame 0 problem)
- ✅ Efficient - just removes inline styles

---

### 4. Mouse Leave Handler
**File:** `src/msd/renderer/ActionHelpers.js`

Added `mouseleave` event listener:

```javascript
// On leave - stop hover animations and trigger leave animations
const leaveHandler = () => {
  cblcarsLog.debug(`[ActionHelpers] 🖱️ Leave triggered on ${overlayId}`);

  // Stop any looping hover animations
  animationManager.stopAnimations(overlayId, 'on_hover');

  // Trigger on_leave animations (if configured)
  animationManager.triggerAnimations(overlayId, 'on_leave');
};
element.addEventListener('mouseleave', leaveHandler, { capture: false });
```

---

### 5. Validation Updates

#### AnimationConfigProcessor
**File:** `src/msd/animation/AnimationConfigProcessor.js`

Added `on_leave` to valid triggers:
```javascript
const validTriggers = [
  'on_tap', 'on_hold', 'on_hover', 'on_leave', // Phase 1.5
  'on_double_tap', // Phase 1
  'on_load', 'on_datasource_change' // Phase 2
];
```

#### TriggerManager
**File:** `src/msd/animation/TriggerManager.js`

Added to interactive triggers:
```javascript
const interactiveTriggers = ['on_tap', 'on_hold', 'on_hover', 'on_leave', 'on_double_tap'];
```

#### AnimationManager.overlayNeedsActionHelpers()
**File:** `src/msd/animation/AnimationManager.js`

Ensures ActionHelpers attaches for leave-only overlays:
```javascript
overlayNeedsActionHelpers(animations, overlayConfig) {
  const interactiveTriggers = ['on_tap', 'on_hold', 'on_hover', 'on_leave', 'on_double_tap'];
  const hasInteractiveTrigger = animations.some(anim =>
    interactiveTriggers.includes(anim.trigger)
  );
  return hasInteractiveTrigger;
}
```

**Critical:** Without this, overlays with only `on_leave` wouldn't get mouse handlers attached!

---

## Usage Examples

### Example 1: Auto-Stop Looping Hover
```yaml
overlays:
  - id: my_button
    type: button
    animations:
      - preset: glow
        trigger: on_hover
        loop: true  # Stops automatically on leave!
        color: var(--lcars-blue)
```

**Behavior:** Glow starts on hover, stops and reverts to original state on leave.

---

### Example 2: Hover + Custom Leave Animation
```yaml
overlays:
  - id: my_button
    type: button
    animations:
      - preset: pulse
        trigger: on_hover
        loop: true
      - preset: fade
        trigger: on_leave
        opacity: 1.0
        duration: 200
```

**Behavior:** Pulse on hover, fade back to normal on leave.

---

### Example 3: Scale Up/Down
```yaml
overlays:
  - id: my_button
    type: button
    animations:
      - trigger: on_hover
        scale: 1.1
        duration: 300
        easing: easeOutElastic(1, .5)
      - trigger: on_leave
        scale: 1.0
        duration: 200
        easing: easeOutQuad
```

**Behavior:** Grows on hover, shrinks back on leave.

---

### Example 4: Leave-Only Animation
```yaml
overlays:
  - id: my_button
    type: button
    animations:
      - preset: fade
        trigger: on_leave
        opacity: 0.5
        duration: 300
```

**Behavior:** Fades when pointer leaves (no hover animation).

---

## Testing Results

All 7 test cases passed:

1. ✅ **Hover Loop Test** - Glow starts on hover, stops and reverts on leave
2. ✅ **Hover + Leave** - Pulse on hover, fade on leave, both work
3. ✅ **Scale Test** - Scale up on hover, scale down on leave
4. ✅ **Multiple Hover** - Both glow and pulse stop together on leave
5. ✅ **Leave Only** - Fade works even without hover animation
6. ✅ **Tap + Hover** - Both triggers work, hover stops on leave
7. ✅ **Rapid Cycles** - No memory leaks, stable performance

**Edge Cases Tested:**
- Rapid hover/leave cycles: ✅ Stable
- Mobile (no hover support): ✅ Correctly skipped
- Multiple simultaneous animations: ✅ All stop together
- Leave-only without hover: ✅ Works correctly

---

## Technical Challenges & Solutions

### Challenge 1: Tracking Anime Instances
**Problem:** `animateElement` creates instances inside `scope.add(async () => {})`, no return value.

**Solution:** Added `onInstanceCreated` callback parameter to `animateElement`. Callback is invoked immediately when instance is created, giving us reliable tracking.

---

### Challenge 2: anime.js Scope Methods
**Problem:** Initially tried `scope.revert()` but got error: `TypeError: t[i] is not a function`

**Root Cause:** The scope's `revert()` expects properly registered callbacks, but our async wrapper breaks this.

**Solution:** Stopped trying to use scope methods. Instead, track individual instances and call `instance.revert()` directly.

---

### Challenge 3: Visual State Reset
**Problem 1:** Using `pause()` froze animation at current frame (text stuck at large size).

**Problem 2:** Using `seek(0) + pause()` went to first animation frame, causing "dark glow" issue.

**Solution:** Use `instance.revert()` to remove all transformations and return to original CSS state.

---

### Challenge 4: Leave-Only Overlays
**Problem:** Overlays with only `on_leave` animations didn't trigger because ActionHelpers wasn't attached.

**Root Cause:** `overlayNeedsActionHelpers()` didn't include `on_leave` in interactive triggers list.

**Solution:** Added `on_leave` to interactive triggers check, ensuring mouse handlers are attached.

---

## Files Modified

1. ✅ `src/utils/cb-lcars-anim-helpers.js` - Added callback to animateElement
2. ✅ `src/msd/animation/AnimationManager.js` - Instance tracking + stopAnimations()
3. ✅ `src/msd/renderer/ActionHelpers.js` - Added mouseleave handler
4. ✅ `src/msd/animation/AnimationConfigProcessor.js` - Added on_leave to valid triggers
5. ✅ `src/msd/animation/TriggerManager.js` - Added on_leave to interactive triggers

---

## Performance Impact

- **Memory:** Minimal - stores array of instance references per trigger
- **CPU:** Negligible - `revert()` just removes inline styles
- **Compatibility:** Desktop only (hover requires `(hover: hover) and (pointer: fine)`)

---

## Backward Compatibility

✅ **Zero Breaking Changes:**
- All Phase 1 animations continue working
- Hover animations without loops are unaffected
- No configuration changes required
- `on_leave` is optional

---

## Known Limitations

1. **Desktop Only:** Hover/leave requires proper hover capability (not touch devices)
2. **Scope-Wide Stop:** `stopAnimations(overlayId, trigger)` stops ALL animations for that trigger
   - If `on_tap` and `on_hover` run simultaneously, stopping hover affects both
   - Acceptable for Phase 1.5 use case
   - Can be refined in Phase 2 with per-instance tracking

---

## Next Steps

- [ ] Update user documentation (animations.md)
- [ ] Add on_leave examples to user guide
- [ ] Update ANIMATION_QUICK_REF.md
- [ ] Consider Phase 2 implementation (conditions, datasource triggers, rate limiting)

---

## Conclusion

Phase 1.5 successfully implements `on_leave` trigger support with automatic hover animation cleanup. The implementation is clean, performant, and maintains full backward compatibility while solving the critical "animations never stop" issue.

**Key Innovation:** Using callback-based instance tracking instead of trying to work around anime.js scope limitations.

**Result:** Smooth, reliable hover/leave animations that behave exactly as users expect.

---

*Implementation completed: November 2, 2025*
