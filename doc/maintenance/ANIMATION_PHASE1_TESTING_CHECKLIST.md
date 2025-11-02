# Animation System Phase 1 - Testing Checklist

Use this checklist to verify Phase 1 functionality after building.

---

## Pre-Testing Setup

- [ ] Build project: `npm run build`
- [ ] Copy test config to Home Assistant:
  ```bash
  cp test-animation-phase1.yaml ~/homeassistant/www/community/cb-lcars/
  ```
- [ ] Add test card to dashboard:
  ```yaml
  type: custom:cb-lcars-card
  config: test-animation-phase1.yaml
  ```
- [ ] Open browser console (F12)
- [ ] Clear browser cache if needed

---

## Visual Testing

### on_load Trigger (Auto-start animations)
- [ ] "AUTO-START" text pulses on load (built-in preset)
- [ ] "CUSTOM PRESET" text pulses on load (custom preset)
- [ ] Green box glows on load (multiple trigger test)

### on_tap Trigger (Click/tap interactions)
- [ ] Purple box glows when clicked (built-in preset)
- [ ] Blue box glows when clicked (custom preset)
- [ ] Green box pulses when clicked (multiple trigger test)

### on_hover Trigger (Desktop only - skip on mobile)
- [ ] Orange box glows when mouse enters
- [ ] Orange box stops glowing when mouse leaves
- [ ] Cursor changes to pointer on hover

### on_hold Trigger (Long press - 500ms)
- [ ] Red box pulses after holding 500ms (built-in preset)
- [ ] Green box pulses after holding 500ms (multiple trigger test)
- [ ] Animation doesn't trigger on quick tap

### Multiple Animations on Same Overlay
- [ ] Green box supports all triggers without conflicts:
  - Glows on load
  - Pulses on tap
  - Pulses on hold (custom preset)

---

## Runtime API Testing

Open browser console and test these commands:

### Basic Animation Trigger
```javascript
window.cblcars.msd.animate('test_tap_builtin', 'pulse');
```
- [ ] Animation triggers successfully
- [ ] Returns `{ success: true, ... }`

### Animation with Custom Parameters
```javascript
window.cblcars.msd.animate('test_tap_builtin', 'glow', {
  duration: 1500,
  color: 'var(--lcars-gold)'
});
```
- [ ] Animation uses custom parameters
- [ ] Color changes visible

### Stop Animation
```javascript
// Start long animation
window.cblcars.msd.animate('test_tap_builtin', 'pulse', { duration: 5000 });

// Stop it
window.cblcars.msd.stopAnimation('test_tap_builtin');
```
- [ ] Animation starts
- [ ] Animation stops immediately when called

### Pause/Resume Animation
```javascript
// Start animation
window.cblcars.msd.animate('test_tap_builtin', 'pulse', { duration: 5000 });

// Pause after 1 second
setTimeout(() => window.cblcars.msd.pauseAnimation('test_tap_builtin'), 1000);

// Resume after 3 seconds
setTimeout(() => window.cblcars.msd.resumeAnimation('test_tap_builtin'), 3000);
```
- [ ] Animation pauses mid-execution
- [ ] Animation resumes from paused position

### Error Handling
```javascript
// Invalid overlay
window.cblcars.msd.animate('nonexistent_overlay', 'pulse');
```
- [ ] Returns error object (not crash)
- [ ] Error message is clear

```javascript
// Invalid preset
window.cblcars.msd.animate('test_tap_builtin', 'invalid_preset');
```
- [ ] Returns error or fails gracefully
- [ ] Console shows helpful message

---

## Debug API Testing

### Get Active Animations
```javascript
// Start some animations
window.cblcars.msd.animate('test_tap_builtin', 'pulse', { duration: 5000 });
window.cblcars.msd.animate('test_tap_custom', 'glow', { duration: 5000 });

// Check active
const active = window.cblcars.debug.msd.animations.active();
console.table(active);
```
- [ ] Returns array of running animations
- [ ] Shows overlayId, state, progress
- [ ] Updates as animations complete

### Dump All Animations
```javascript
const dump = window.cblcars.debug.msd.animations.dump();
console.log('Custom presets:', Object.keys(dump.customPresets));
console.log('Overlay animations:', dump.overlayAnimations);
console.log('Timelines:', dump.timelines);
```
- [ ] Returns complete configuration
- [ ] Shows custom_pulse and custom_glow presets
- [ ] Shows all overlay animation definitions

### Registry Statistics
```javascript
const stats = window.cblcars.debug.msd.animations.registryStats();
console.log('Cache size:', stats.size);
console.log('Hit rate:', (stats.hitRate * 100).toFixed(1) + '%');
console.log('Avg compute time:', stats.avgComputeTime + 'ms');
```
- [ ] Returns cache statistics
- [ ] Hit rate increases with repeated animations
- [ ] Cache size grows as animations execute

### Inspect Overlay
```javascript
const state = window.cblcars.debug.msd.animations.inspect('test_multiple');
console.log('Element:', state.element);
console.log('Scope:', state.scope);
console.log('Triggers:', state.triggers);
console.log('Active animations:', state.activeAnimations);
```
- [ ] Returns detailed overlay state
- [ ] Shows all registered triggers
- [ ] Shows current active animations

### Manual Trigger (Testing)
```javascript
window.cblcars.debug.msd.animations.trigger('test_tap_builtin', 'shimmer', {
  duration: 800
});
```
- [ ] Animation triggers successfully
- [ ] Works even if no trigger defined in YAML
- [ ] Useful for testing presets

---

## Performance Testing

### Initial Load
- [ ] Page loads without delay
- [ ] on_load animations start immediately
- [ ] No console errors

### Animation Performance
- [ ] Animations are smooth (60fps)
- [ ] No lag during interactions
- [ ] Multiple simultaneous animations work well

### Memory Usage
Open browser DevTools → Performance → Memory:

```javascript
// Start many animations
for (let i = 0; i < 20; i++) {
  window.cblcars.msd.animate('test_tap_builtin', 'pulse');
}
```
- [ ] Memory usage stays stable
- [ ] No memory leaks over time

### Cache Performance
```javascript
// Trigger same animation multiple times
for (let i = 0; i < 10; i++) {
  window.cblcars.msd.animate('test_tap_builtin', 'pulse', { duration: 200 });
}

// Check cache
const stats = window.cblcars.debug.msd.animations.registryStats();
console.log('Hit rate:', (stats.hitRate * 100).toFixed(1) + '%');
```
- [ ] Hit rate approaches 100%
- [ ] Subsequent triggers are faster

---

## Edge Cases

### Rapid Triggers
```javascript
// Trigger multiple times rapidly
for (let i = 0; i < 5; i++) {
  window.cblcars.msd.animate('test_tap_builtin', 'pulse', { duration: 1000 });
}
```
- [ ] No crashes or errors
- [ ] Animations queue or restart cleanly

### Overlay Removal (if applicable)
- [ ] Animations stop when overlay removed
- [ ] No console errors after removal
- [ ] Event listeners cleaned up

### Invalid Parameters
```javascript
window.cblcars.msd.animate('test_tap_builtin', 'pulse', {
  duration: 'invalid',
  color: 12345
});
```
- [ ] Fails gracefully
- [ ] Returns error or uses defaults
- [ ] No console errors

### Missing AnimationManager
Test before MSD initializes (if possible):
```javascript
window.cblcars.msd.animate('test_tap_builtin', 'pulse');
```
- [ ] Returns `NO_ANIMATION_MANAGER` error
- [ ] Doesn't crash

---

## Browser Compatibility

Test on multiple browsers if possible:

### Chrome/Edge
- [ ] All animations work
- [ ] Hover trigger works
- [ ] Hold trigger works (mouse)
- [ ] Hold trigger works (touch)

### Firefox
- [ ] All animations work
- [ ] Hover trigger works
- [ ] Hold trigger works (mouse)
- [ ] Hold trigger works (touch)

### Safari (Desktop)
- [ ] All animations work
- [ ] Hover trigger works
- [ ] Hold trigger works

### Mobile (iOS/Android)
- [ ] Tap trigger works
- [ ] Hold trigger works (500ms)
- [ ] Hover trigger skipped (as expected)
- [ ] on_load animations work

---

## Console Warnings/Errors

Review browser console for any issues:

- [ ] No errors during initialization
- [ ] No errors during animation playback
- [ ] No warnings about missing presets
- [ ] Debug logs show proper initialization (if verbose logging enabled)

---

## SystemsManager Integration

```javascript
const instance = window.cblcars.debug.msd.pipeline.getInstance();
const systemsManager = instance?.systemsManager;

console.log('Has AnimationManager:', !!systemsManager?.animationManager);
console.log('Has AnimationRegistry:', !!systemsManager?.animRegistry);
```
- [ ] Both AnimationManager and AnimationRegistry present
- [ ] AnimationManager initialized in Phase 5
- [ ] No initialization errors

---

## Configuration Validation

### Test Invalid Config (create new test file)

```yaml
animation_presets:
  invalid_preset:
    type: nonexistent_type  # Should error

overlays:
  test:
    animations:
      - preset: nonexistent_preset  # Should error
        trigger: invalid_trigger      # Should error
```

- [ ] Config processor reports errors
- [ ] Errors shown in console
- [ ] Valid parts of config still work

---

## Final Checklist

### Core Functionality
- [ ] All trigger types work as expected
- [ ] Custom presets resolve correctly
- [ ] Built-in presets work unchanged
- [ ] Multiple animations per overlay work
- [ ] Runtime API methods all functional
- [ ] Debug API methods all functional

### Performance
- [ ] No performance degradation
- [ ] Cache hit rate >80%
- [ ] No memory leaks
- [ ] Animations smooth (60fps)

### Error Handling
- [ ] Graceful error responses
- [ ] Clear error messages
- [ ] No console crashes
- [ ] Invalid inputs handled

### Documentation
- [ ] API examples work as documented
- [ ] Quick reference accurate
- [ ] Test configuration works

### Integration
- [ ] SystemsManager Phase 5 integration works
- [ ] AnimationRegistry preserved and utilized
- [ ] No breaking changes to existing configs
- [ ] Backward compatible

---

## Issues Found

Document any issues discovered during testing:

1. Issue:
   - Expected:
   - Actual:
   - Severity:
   - Workaround:

2. Issue:
   - Expected:
   - Actual:
   - Severity:
   - Workaround:

---

## Sign-off

- [ ] All critical tests passed
- [ ] All major features functional
- [ ] Performance acceptable
- [ ] Ready for Phase 2

**Tester:**
**Date:**
**Browser:**
**Home Assistant Version:**

**Overall Status:** ⬜ PASS / ⬜ FAIL

**Notes:**


---

*Animation System Phase 1 - Testing Checklist*
