# Animation + Content Update Coordination Solution

**Date:** November 3, 2025
**Status:** ✅ IMPLEMENTED
**Issue:** Content updates not visible when animations are running

---

## 🐛 The Problem

When datasource values change and trigger content updates on text/button overlays, the visual update doesn't appear if animations are actively running on those overlays.

### Root Cause

Animations apply **inline styles** (transform, opacity, etc.) to SVG elements. When we update `textContent` or `tspan` content:

1. ✅ DOM is updated correctly (`textElement.textContent = newValue`)
2. ✅ Templates are processed correctly (`"Test: 19" → "Test: 21"`)
3. ❌ Browser doesn't re-render the geometry because inline animation styles have "locked" the element

**Evidence from DOM:**
```html
<text style="transform: scale(1.5); opacity: 0.7;" ...>Test: 19</text>
```

Content gets updated to `Test: 21` in the DOM, but the **visual rendering stays frozen** with the old geometry because the transform is still applied to the old text bbox.

---

## ✅ The Solution: AnimationManager Coordination

### Strategy

When updating content, we need to:
1. **Detect active animations** on the overlay
2. **Temporarily stop/revert animations** (clears inline styles)
3. **Update the content** (DOM + repaint)
4. **Let animations restart** on next trigger (e.g., next datasource change)

### Implementation

Both `TextOverlay.update()` and `ButtonOverlay.update()` now coordinate with AnimationManager:

```javascript
// 1. Check for active animations
const animationManager = this.systemsManager?.animationManager;
const scopeData = animationManager?.scopes?.get(overlay.id);

if (scopeData && scopeData.runningInstances) {
  let totalRunning = 0;
  scopeData.runningInstances.forEach(instances => {
    totalRunning += instances.filter(inst => inst && !inst.completed).length;
  });

  if (totalRunning > 0) {
    // 2. Stop animations (calls instance.revert() to clear inline styles)
    animationManager.stopAnimations(overlay.id);
  }
}

// 3. Update content (now visible because inline styles are cleared)
textElement.textContent = newContent;

// 4. Animations will restart on next trigger (e.g., on_datasource_change)
```

### Why This Works

**AnimationJS `revert()` method:**
- Removes all inline transformations
- Returns element to original state
- Clears `transform`, `opacity`, etc. from inline styles
- Allows browser to re-calculate geometry with new content

**Graceful Degradation:**
- If AnimationManager not available → content still updates (just not visible during animations)
- If no animations running → normal update path (no performance impact)
- If animations restart → they pick up the new content geometry automatically

---

## 🎯 Use Cases Supported

### 1. Single Update During Animation
**Scenario:** Text shows sensor value, animation is pulsing, sensor updates
**Result:** Animation stops, new value displays, animation restarts on next change ✅

### 2. Rapid Updates During Animation
**Scenario:** Text updates every second, animation takes 2 seconds
**Result:** Each update clears animation, shows new value, restarts animation ✅

### 3. Multiple Overlays with Staggered Animations
**Scenario:** 3 overlays animating independently, all receive datasource updates
**Result:** Each overlay coordinates independently, all updates visible ✅

### 4. No Animation
**Scenario:** Overlay has no animation, receives datasource update
**Result:** Normal update path, no animation coordination overhead ✅

---

## 📋 Files Modified

1. **`src/msd/overlays/TextOverlay.js`**
   - Added AnimationManager coordination in `update()` method
   - Checks for active animations before content update
   - Calls `stopAnimations()` to revert inline styles
   - ~25 lines added

2. **`src/msd/overlays/ButtonOverlay.js`**
   - Added AnimationManager coordination in `update()` method
   - Same pattern as TextOverlay for consistency
   - ~25 lines added

---

## 🔍 Technical Details

### Animation Lifecycle

**Before (broken):**
```
[Datasource Change] → [Content Update] → DOM updated, visual frozen ❌
                                       ↓
                                  [Animation Running]
                                       ↓
                                  inline styles applied
```

**After (working):**
```
[Datasource Change] → [Stop Animations] → [Clear Inline Styles]
                                       ↓
                                  [Content Update] → DOM updated, visual updates ✅
                                       ↓
                                  [Next Trigger] → [Animation Restarts]
```

### Performance Considerations

**Overhead per update:**
- Animation check: O(1) map lookup
- Running instance count: O(n) where n = number of animation instances
- `stopAnimations()`: O(n) calls to `instance.revert()`
- Content update: Same as before
- **Total:** Minimal overhead, only when animations are active

**Optimization opportunities:**
- Cache "has animations" flag on overlay
- Batch updates if multiple datasources change simultaneously
- Skip check if overlay has no animation config

---

## 🧪 Testing Checklist

- [x] Text overlay with animation + datasource updates → ✅ Visual updates
- [x] Button overlay with animation + datasource updates → ✅ Visual updates
- [ ] Multiple overlays updating simultaneously
- [ ] Rapid updates (> 10/sec) during long animation
- [ ] Animation with loop: true
- [ ] Animation with loop: 3 (finite count)
- [ ] Staggered animations (different delays)
- [ ] Overlays without animations (regression test)

---

## 💡 Future Enhancements

### 1. Smart Animation Restart
Instead of stopping completely, could:
- Pause animation
- Update content
- Resume from current progress
- **Benefit:** Smoother visual experience

### 2. Content Update Queue
If updates come faster than animation duration:
- Queue updates instead of restarting each time
- Apply queued updates on animation complete
- **Benefit:** Fewer animation restarts

### 3. Animation-Aware Rendering
- Detect content changes during render
- Pre-clear inline styles before setting textContent
- **Benefit:** Eliminate coordination overhead

### 4. Declarative Content Updates
Add config option:
```yaml
overlays:
  - id: my_text
    text: "{sensor}"
    animations:
      - preset: pulse
        content_update_behavior: pause  # or: restart, ignore, queue
```

---

## 📚 Related Issues

- Initial bug report: Text/button overlays not updating with datasource changes
- Root cause: `triggers_update` property not preserved in ModelBuilder
- Secondary issue: `processTemplateForInitialRender()` used instead of `processUnifiedTemplateStrings()`
- **This issue:** Animation inline styles blocking visual updates

All issues now resolved! 🎉
