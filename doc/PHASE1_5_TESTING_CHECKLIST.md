# Phase 1.5 Testing Checklist

**Date:** November 2, 2025
**Feature:** on_leave Trigger Support
**Test Config:** `test-phase1_5-hover-leave.yaml`

---

## Code Changes Summary

✅ **AnimationManager.js** - Added `stopAnimations()` method (lines ~255-300)
✅ **AnimationManager.js** - Track `_trigger` on animations (lines ~567-575)
✅ **ActionHelpers.js** - Added `mouseleave` handler (lines ~189-200)
✅ **AnimationConfigProcessor.js** - Added `on_leave` to valid triggers (line ~220)
✅ **TriggerManager.js** - Added `on_leave` to interactive triggers (line ~72)
✅ **Build** - Compiled successfully with webpack

---

## Testing Environment

### Setup Steps

1. Copy `dist/cb-lcars.js` to your Home Assistant installation
2. Create a test card using `test-phase1_5-hover-leave.yaml`
3. Open Home Assistant in a desktop browser (hover requires desktop)
4. Open browser DevTools console to see debug logs

### Browser Requirements

- **Desktop browser** with mouse (hover detection uses `hover: hover` media query)
- Chrome, Firefox, or Edge recommended
- Enable "Preserve log" in DevTools console

---

## Test Cases

### Test 1: Basic Hover Loop - Auto Stop ⚡ CRITICAL

**Button:** "Hover Loop Test" (blue)

**Expected Behavior:**
1. Hover over button → Blue glow animation starts and loops
2. Move pointer away → Glow animation stops immediately
3. Hover again → Glow restarts

**Console Output to Check:**
```
[ActionHelpers] 🖱️ Hover triggered on test_hover_loop
[AnimationManager] 🎬 Triggering animation(s) for test_hover_loop on on_hover
[ActionHelpers] 🖱️ Leave triggered on test_hover_loop
[AnimationManager] ⏸️ Stopped animation on test_hover_loop (trigger: on_hover)
```

**Pass Criteria:**
- [ ] Animation starts on hover
- [ ] Animation stops completely on leave
- [ ] No animation continues after pointer is gone
- [ ] Can repeat hover/leave multiple times

---

### Test 2: Hover + Custom Leave Animation

**Button:** "Hover + Leave" (orange)

**Expected Behavior:**
1. Hover → Pulse animation starts looping
2. Leave → Pulse stops AND fade animation plays once
3. Fade returns opacity to 1.0

**Console Output:**
```
[ActionHelpers] 🖱️ Hover triggered on test_hover_leave
[AnimationManager] 🎬 Triggering animation(s) for test_hover_leave on on_hover
[ActionHelpers] 🖱️ Leave triggered on test_hover_leave
[AnimationManager] ⏸️ Stopped animation on test_hover_leave (trigger: on_hover)
[AnimationManager] 🎬 Triggering animation(s) for test_hover_leave on on_leave
```

**Pass Criteria:**
- [ ] Pulse animation loops on hover
- [ ] Pulse stops on leave
- [ ] Fade animation plays on leave
- [ ] Button returns to normal state

---

### Test 3: Scale Hover/Leave

**Button:** "Scale Test" (green)

**Expected Behavior:**
1. Hover → Button scales up to 1.1x with elastic easing
2. Leave → Button scales back to 1.0x with smooth easing

**Pass Criteria:**
- [ ] Button grows smoothly on hover
- [ ] Button shrinks smoothly on leave
- [ ] No jerky animation
- [ ] Final size matches original

---

### Test 4: Multiple Hover Animations ⚡ CRITICAL

**Button:** "Multiple Hover" (red)

**Expected Behavior:**
1. Hover → Both glow AND pulse animations start looping
2. Leave → BOTH animations stop

**Console Output:**
```
[AnimationManager] 🎬 Triggering 2 animation(s) for test_multiple_hover on on_hover
[ActionHelpers] 🖱️ Leave triggered on test_multiple_hover
[AnimationManager] Stopped 2 animation(s) on test_multiple_hover
```

**Pass Criteria:**
- [ ] Both animations play simultaneously on hover
- [ ] Both animations stop on leave
- [ ] No lingering animations

---

### Test 5: Leave Only (No Hover)

**Button:** "Leave Only" (purple)

**Expected Behavior:**
1. Hover → Nothing happens
2. Leave → Fade animation plays

**Pass Criteria:**
- [ ] No animation on mouseenter
- [ ] Fade plays on mouseleave
- [ ] Works consistently

---

### Test 6: Tap + Hover Combined

**Button:** "Tap + Hover" (yellow)

**Expected Behavior:**
1. Click → Pulse animation plays once
2. Hover → Glow animation starts looping
3. Leave → Glow stops, fade plays
4. Click again while hovering → Pulse plays, glow continues

**Pass Criteria:**
- [ ] Tap animations work independently
- [ ] Hover animations work independently
- [ ] Both can work simultaneously
- [ ] Leave correctly stops only hover animations

---

### Test 7: Rapid Hover Cycles 🔥 STRESS TEST

**Any Button**

**Expected Behavior:**
1. Rapidly hover and leave 10-20 times
2. Animations start/stop correctly each time
3. No memory leaks
4. No errors in console

**Pass Criteria:**
- [ ] Animations keep working after many cycles
- [ ] No stacking/accumulation of animations
- [ ] Console remains clean (no errors)
- [ ] Performance stays smooth

---

## Edge Cases

### Edge Case 1: Hover While Animation Playing

**Test:** Hover over button, leave immediately, hover again before leave animation finishes

**Expected:** Leave animation interrupted, hover animation starts fresh

**Pass Criteria:**
- [ ] No flickering
- [ ] Clean transition
- [ ] No stuck animations

---

### Edge Case 2: Destroy Overlay While Hovering

**Test:** (If possible) Remove overlay from DOM while hover animation is playing

**Expected:** No errors, proper cleanup

**Pass Criteria:**
- [ ] No console errors
- [ ] No memory leaks

---

### Edge Case 3: Mobile Device

**Test:** Load page on mobile/tablet (no hover support)

**Expected:** No hover/leave handlers attached, no errors

**Console Output:**
```
[ActionHelpers] ⏭️ Skipping hover handlers for ... (not desktop)
```

**Pass Criteria:**
- [ ] No hover handlers on mobile
- [ ] Other animations still work
- [ ] No errors

---

## Performance Checks

### Memory Leak Test

1. Open Chrome DevTools → Memory tab
2. Take heap snapshot
3. Perform 50 hover/leave cycles
4. Take another heap snapshot
5. Compare memory usage

**Pass Criteria:**
- [ ] Memory increase < 5MB
- [ ] No detached DOM nodes
- [ ] Animation scopes properly cleaned up

### CPU Usage

**Pass Criteria:**
- [ ] CPU usage returns to idle after animations stop
- [ ] No background processing after leave
- [ ] Browser remains responsive

---

## Console Output Verification

### Expected Log Sequence

**On Hover:**
```
[ActionHelpers] 🖱️ Hover triggered on <overlayId>
[AnimationManager] 🎬 Triggering X animation(s) for <overlayId> on on_hover
[AnimationManager] 🏷️ Tagged animation with trigger: on_hover
[AnimationManager] ▶️ Playing animation on <overlayId>
```

**On Leave:**
```
[ActionHelpers] 🖱️ Leave triggered on <overlayId>
[AnimationManager] ⏸️ Stopped animation on <overlayId> (trigger: on_hover)
[AnimationManager] Stopped X animation(s) on <overlayId>
[AnimationManager] 🎬 Triggering Y animation(s) for <overlayId> on on_leave
```

---

## Known Limitations

✅ **Desktop Only:** Hover/leave requires `(hover: hover) and (pointer: fine)`
✅ **Safari Compatibility:** May have different hover behavior
✅ **Touch Devices:** No hover support (by design)

---

## Regression Tests

Ensure Phase 1 features still work:

- [ ] `on_tap` animations work
- [ ] `on_hold` animations work (500ms)
- [ ] `on_double_tap` animations work
- [ ] `on_load` animations work
- [ ] All presets work (glow, pulse, fade, slide, rotate)
- [ ] Animation-only overlays work (no tap_action needed)

---

## Success Criteria

Phase 1.5 is considered **COMPLETE** when:

1. ✅ All 7 test cases pass
2. ✅ All 3 edge cases handled
3. ✅ No performance issues
4. ✅ No memory leaks
5. ✅ Console output matches expected
6. ✅ All regression tests pass
7. ✅ Works across Chrome, Firefox, Edge
8. ✅ Mobile/tablet handled gracefully

---

## Issue Reporting Template

If you find issues, document them as:

```
**Issue:** [Brief description]
**Test Case:** [Which test case]
**Expected:** [What should happen]
**Actual:** [What actually happens]
**Console Output:** [Any errors or unexpected logs]
**Browser:** [Chrome/Firefox/etc + version]
**Reproducible:** [Always/Sometimes/Once]
```

---

## Next Steps After Testing

1. ✅ If all tests pass → Update documentation
2. ❌ If tests fail → Debug and fix issues
3. 📝 Document any discovered limitations
4. 🚀 Proceed to Phase 2 planning

---

## Quick Test Script

For rapid testing, use browser console:

```javascript
// Get animation manager
const animMgr = window.__msdDebug?.pipelineInstance?.systemsManager?.animationManager;

// Check active animations
console.log('Active:', animMgr.getActiveAnimations());

// Inspect specific overlay
console.log('Hover test:', animMgr.inspectOverlay('test_hover_loop'));

// Check scope children (should be empty after leave)
const scope = animMgr.scopes.get('test_hover_loop');
console.log('Scope children:', scope?.scope?.children?.length || 0);
```

---

*Phase 1.5 Testing Checklist - v1.0*
*Created: November 2, 2025*
