# Incremental Update System - Quick Reference

**Version:** v2025.10.1-fuk.27-69
**Last Updated:** 2025-10-25

---

## 🚀 Quick Start

### For Users: Enabling Incremental Updates

Incremental updates work automatically! Just create rules that patch overlay styles:

```yaml
type: custom:cb-lcars
msd:
  overlays:
    - id: my_chart
      type: apexchart
      style:
        color: var(--picard-blue)
      # ... other config

  rules:
    - when:
        - entity: sensor.temperature
          above: 25
      patch:
        - overlay: my_chart
          style:
            color: var(--critical-red)
```

**Result:** Chart color changes smoothly when temperature > 25, no full re-render!

---

## 👨‍💻 For Developers: Adding Incremental Support

### Step 1: Declare Capability

```javascript
// In your overlay renderer
static supportsIncrementalUpdate() {
  return true;
}
```

### Step 2: Implement Update Method

```javascript
static updateIncremental(overlay, overlayElement, context) {
  console.log(`[MyRenderer] 🎨 INCREMENTAL UPDATE: ${overlay.id}`);

  // Get updated style (already patched by SystemsManager)
  const style = overlay.finalStyle || overlay.style || {};

  // Update DOM without full rebuild
  if (style.color) {
    overlayElement.style.color = style.color;
  }

  console.log(`[MyRenderer] ✅ INCREMENTAL UPDATE SUCCESS`);
  return true;
}
```

### Step 3: Register in SystemsManager

```javascript
// SystemsManager.js constructor
this._overlayRenderers = new Map([
  // ... existing entries
  ['my_overlay_type', MyOverlayRenderer],
]);
```

### Step 4: Test

```javascript
// Toggle entity state and check console
[SystemsManager] 🎨 Rules produced 1 patches
[MyRenderer] 🎨 INCREMENTAL UPDATE: my_overlay
[MyRenderer] ✅ INCREMENTAL UPDATE SUCCESS
```

---

## 📊 Current Support Status

| Overlay Type | Status | Features |
|--------------|--------|----------|
| StatusGrid | ✅ Complete | Cell/grid-level updates |
| ApexCharts | ✅ Complete | Full color API, CSS vars |
| Button | ⏳ Phase 3 | Planned |
| Line | ⏳ Phase 4 | Planned |
| Text | ⏳ Phase 5 | Planned |

---

## 🐛 Troubleshooting

### Updates Not Working?

**Check 1: Renderer Registered?**
```javascript
// In SystemsManager constructor
this._overlayRenderers.get('my_type')  // Should not be undefined
```

**Check 2: Capability Declared?**
```javascript
MyRenderer.supportsIncrementalUpdate()  // Should return true
```

**Check 3: Element Found?**
```javascript
// Check console for:
[SystemsManager] ⚠️ Overlay element not found in DOM
```

**Check 4: Look for Success Message**
```javascript
// Should see:
[SystemsManager] ✅ All updates completed incrementally
```

### Colors Not Changing?

**This was a known bug - FIXED!**

**Solution:** SystemsManager now merges patches into `overlay.finalStyle` automatically

**Verify fix is working:**
```javascript
// Check console for:
[SystemsManager] 🎨 Merging patch style into finalStyle for <overlay-id>
[SystemsManager] ✅ Merged finalStyle: {color: '...'}
```

---

## 📚 Complete Documentation

- **Full Architecture:** [`doc/architecture/INCREMENTAL_UPDATE_SYSTEM.md`](./architecture/INCREMENTAL_UPDATE_SYSTEM.md)
- **Implementation Guide:** [`doc/architecture/overlay-implementation-guide.md`](./architecture/overlay-implementation-guide.md)
- **Implementation Summary:** [`doc/INCREMENTAL_UPDATE_IMPLEMENTATION_SUMMARY.md`](./INCREMENTAL_UPDATE_IMPLEMENTATION_SUMMARY.md)
- **Architecture Index:** [`doc/architecture/README.md`](./architecture/README.md)

---

## 💡 Key Concepts

### What is an "Incremental Update"?

**Traditional (Full Re-render):**
```
Entity changes → Re-render entire card → 150-300ms → Flicker
```

**Incremental (Targeted Update):**
```
Entity changes → Update only changed overlay → 5-15ms → Smooth
```

### What is `finalStyle`?

The **resolved style** for an overlay after:
1. Base styles applied
2. Theme tokens resolved
3. Style inheritance applied
4. **Rule patches merged** ← Critical fix!

### What is a "Patch"?

A **style change** from the rules engine:
```javascript
{
  id: 'my_overlay',
  style: {
    color: 'var(--critical-red)'
  }
}
```

---

## 🎯 Performance Benefits

| Metric | Full Re-render | Incremental Update |
|--------|----------------|-------------------|
| **Time** | 150-300ms | 5-15ms |
| **Speed** | 1x | **10-20x faster** |
| **Visual** | Flicker | Smooth |
| **Animations** | Interrupted | Preserved |

---

## ✅ Checklist for New Renderer

- [ ] Create renderer class
- [ ] Add `supportsIncrementalUpdate()` → return true
- [ ] Add `updateIncremental(overlay, element, context)` method
- [ ] Use `overlay.finalStyle` for updated styles
- [ ] Return true on success, false on failure
- [ ] Add to SystemsManager `_overlayRenderers` Map
- [ ] Test with rules that patch overlay styles
- [ ] Verify console shows "✅ INCREMENTAL UPDATE SUCCESS"
- [ ] Verify no full re-render triggered

---

## 🚨 Common Mistakes

### ❌ Don't: Use overlay.style directly
```javascript
const style = overlay.style;  // Wrong! May have old values
```

### ✅ Do: Use overlay.finalStyle
```javascript
const style = overlay.finalStyle || overlay.style;  // Correct!
```

### ❌ Don't: Forget to register renderer
```javascript
// Will silently fallback to selective re-render
```

### ✅ Do: Register in SystemsManager
```javascript
this._overlayRenderers.set('my_type', MyRenderer);
```

### ❌ Don't: Throw exceptions without catching
```javascript
// Will break entire update system
```

### ✅ Do: Wrap in try-catch
```javascript
try {
  // ... update logic
  return true;
} catch (error) {
  console.error('[MyRenderer] Error:', error);
  return false;
}
```

---

## 📞 Need Help?

1. **Check console logs** - Every step is logged
2. **Read full docs** - See links above
3. **Review working examples** - StatusGridRenderer, ApexChartsOverlayRenderer
4. **Look for similar patterns** - Most renderers follow same structure

---

**Quick Reference Version:** 1.0
**For Full Details:** See [`INCREMENTAL_UPDATE_SYSTEM.md`](./architecture/INCREMENTAL_UPDATE_SYSTEM.md)
