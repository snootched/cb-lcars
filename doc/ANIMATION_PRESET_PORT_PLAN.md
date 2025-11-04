# Animation Preset Port & Modernization Plan

## Overview
Port legacy animation presets from `cb-lcars-anim-presets.js` to the new MSD system in `src/msd/animation/presets.js`, with modernizations for better overlay targeting and composability.

## Key Improvements

### 1. Target Selection System

**Syntax:**
```yaml
animations:
  # Single target (string)
  - preset: pulse
    target: 'label'           # Animate just the label

  # Multiple targets (array)
  - preset: pulse
    targets: ['label', 'content']  # Animate both label and content

  # Default (no target specified)
  - preset: pulse              # Overlay provides smart default
```

**Target Resolution Priority:**
1. Explicit `target` or `targets` parameter
2. Overlay's `getDefaultAnimationTarget()` method
3. Fallback to overlay element itself

**Supported Target Specs:**
- `'overlay'` or `'self'` - The overlay wrapper element
- `'label'` - Button label text (ButtonOverlay)
- `'content'` - Button content text (ButtonOverlay)
- `'texts[n]'` - Specific text by index (ButtonOverlay)
- `'text'` - The text element (TextOverlay)
- Any CSS selector - Queried within overlay element

### 2. Overlay Smart Defaults

Each overlay type implements:

```javascript
class ButtonOverlay {
  getDefaultAnimationTarget() {
    // Buttons default to animating the entire group
    return this.element;
  }

  getAnimationTarget(targetSpec) {
    if (!targetSpec || targetSpec === 'overlay' || targetSpec === 'self') {
      return this.element;
    }
    if (targetSpec === 'label') {
      return this.element.querySelector('[data-button-text-type="label"]');
    }
    if (targetSpec === 'content') {
      return this.element.querySelector('[data-button-text-type="value"]');
    }
    // Array syntax: texts[0], texts[1]
    const arrayMatch = targetSpec.match(/^texts\[(\d+)\]$/);
    if (arrayMatch) {
      const idx = parseInt(arrayMatch[1]);
      return this.element.querySelector(`[data-button-text-index="${idx}"]`);
    }
    // CSS selector fallback
    return this.element.querySelector(targetSpec);
  }
}

class TextOverlay {
  getDefaultAnimationTarget() {
    // Text overlays default to animating the text element, not wrapper
    return this.element.querySelector('text') || this.element;
  }

  getAnimationTarget(targetSpec) {
    if (!targetSpec || targetSpec === 'text') {
      return this.element.querySelector('text') || this.element;
    }
    if (targetSpec === 'overlay' || targetSpec === 'self') {
      return this.element;
    }
    return this.element.querySelector(targetSpec);
  }
}
```

### 3. AnimationManager Integration

Update `AnimationManager.playAnimation()` to:
1. Get overlay instance from renderer cache
2. Resolve target(s) using overlay methods
3. Pass resolved targets to preset

```javascript
// In AnimationManager.js
const overlayInstance = this.systemsManager.advancedRenderer?.overlayRenderers?.get(overlayId);

let targetElements = [];
if (animDef.targets) {
  // Multiple targets specified
  for (const spec of animDef.targets) {
    const el = overlayInstance?.getAnimationTarget?.(spec) || overlayElement.querySelector(spec);
    if (el) targetElements.push(el);
  }
} else if (animDef.target) {
  // Single target specified
  const el = overlayInstance?.getAnimationTarget?.(animDef.target) || overlayElement.querySelector(animDef.target);
  if (el) targetElements.push(el);
} else {
  // Use overlay's smart default
  const el = overlayInstance?.getDefaultAnimationTarget?.() || overlayElement;
  targetElements.push(el);
}
```

## Presets to Port

### High Priority (Core animations)
- ✅ **pulse** - Breathing effect (text scale + opacity, line stroke-width + opacity)
- ✅ **fade** - Opacity transition
- ✅ **glow** - Drop-shadow animation
- ✅ **draw** - SVG path drawing (anime.js v4 createDrawable)
- ✅ **march** - CSS-based marching dashed lines

### Medium Priority (Visual effects)
- ✅ **blink** - Rapid opacity toggle
- ✅ **shimmer** - Fill + opacity shimmer
- ✅ **strobe** - Fast opacity strobe
- ✅ **flicker** - Randomized opacity

### Low Priority (Advanced)
- ⚠️ **motionpath** - Complex path following with tracer/trail
- ✅ **cascade** - Staggered animation
- ✅ **ripple** - Scale + opacity ripple
- ✅ **set** - Immediate property setting

## Modernizations

### 1. Remove Direct DOM Manipulation in Presets
**Old approach:**
```javascript
pulse: (params, element, options) => {
  element.style.transformOrigin = 'center';  // Direct DOM mutation
  params.targets = textElement;              // Override targets
}
```

**New approach:**
```javascript
pulse: (def) => {
  return {
    anime: {
      scale: [1, maxScale],
      opacity: [minOpacity, 1]
    },
    styles: {
      transformOrigin: 'center',
      transformBox: 'fill-box'
    }
  };
}
```

### 2. Use Anime.js v4 APIs
- `createDrawable()` for draw animations
- `createMotionPath()` for motionpath
- Native stagger support

### 3. Separate CSS Animations
Keep `march` as CSS-based (smoother, better performance)

## Implementation Steps

### Phase 1: Core Infrastructure
1. ✅ Add `getDefaultAnimationTarget()` and `getAnimationTarget()` to OverlayBase
2. ✅ Implement in ButtonOverlay and TextOverlay
3. ✅ Update AnimationManager to use new targeting system
4. ✅ Update `animateElement` helper to respect target resolution

### Phase 2: Port Core Presets
1. ✅ pulse (with smart text/line detection)
2. ✅ fade
3. ✅ glow
4. ✅ draw (anime.js v4 style)
5. ✅ march (CSS-based)

### Phase 3: Port Visual Effects
1. ✅ blink
2. ✅ shimmer
3. ✅ strobe
4. ✅ flicker
5. ✅ cascade
6. ✅ ripple

### Phase 4: Advanced Features
1. ⚠️ motionpath (needs careful port - complex)
2. ✅ set preset (immediate application)

### Phase 5: Testing & Documentation
1. Test each preset with different overlay types
2. Test multi-target animations
3. Document targeting syntax in user docs
4. Add examples for each preset

## Example Configs

### Button with Multi-Target Animation
```yaml
overlays:
  - id: my_button
    type: button
    label: "Label Text"
    content: "Content Text"
    animations:
      # Pulse the entire button on hover
      - preset: pulse
        trigger: on_hover
        duration: 300

      # Glow just the label on datasource change
      - preset: glow
        trigger: on_datasource_change
        target: 'label'
        color: var(--lcars-blue)

      # Pulse both texts (but not button shape)
      - preset: pulse
        trigger: on_tap
        targets: ['label', 'content']
        max_scale: 1.5
```

### Text Overlay (Smart Default)
```yaml
overlays:
  - id: my_text
    type: text
    text: "Status: {sensor.value}"
    animations:
      # No target specified = text overlay uses text element (smart default)
      - preset: pulse
        trigger: on_datasource_change
```

## Migration Path

1. Keep legacy `cb-lcars-anim-presets.js` functional during transition
2. New MSD presets take precedence if registered
3. Add deprecation warnings for direct legacy usage
4. Phase out legacy system in future release

## Benefits

- ✅ **Flexibility:** Animate any part of composed overlays
- ✅ **Smart Defaults:** Overlays know their best animation targets
- ✅ **Backward Compatible:** No target = use overlay default
- ✅ **Multi-Target:** Animate multiple elements with one config
- ✅ **Type Safety:** Overlays control what targets are valid
- ✅ **Performance:** CSS animations where appropriate
- ✅ **Modern:** Uses Anime.js v4 APIs
