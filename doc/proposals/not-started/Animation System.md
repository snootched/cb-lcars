# MSD Animation System - Complete Implementation Proposal

**Date:** 2025-11-01
**Author:** @copilot
**For:** @snootched
**Target:** Coding Agent Implementation

---

## Executive Summary

This proposal outlines a comprehensive animation system for the CB-LCARS MSD (Master Systems Display) using Anime.js v4. The system will be fully integrated with the existing MSD architecture, supporting YAML-driven configuration, datasource integration, RulesEngine triggering, and multi-layered API access.

**Key Design Principles:**
- ✅ Anime.js v4 syntax only (Scopes, Timelines, Utils)
- ✅ ShadowRoot/mountEl-aware (no document root access)
- ✅ Datasource-driven parameters for dynamic animations
- ✅ DRY YAML configuration with custom presets
- ✅ Performance-optimized with intelligent caching
- ✅ RulesEngine integration via dedicated key (avoiding "actions" ambiguity)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Structure](#2-module-structure)
3. [Animation Triggers](#3-animation-triggers)
4. [Scope Management Strategy](#4-scope-management-strategy)
5. [AnimationRegistry Design](#5-animationregistry-design)
6. [Animation Presets Library](#6-animation-presets-library)
7. [RulesEngine Integration](#7-rulesengine-integration)
8. [Datasource-Driven Parameters](#8-datasource-driven-parameters)
9. [YAML Configuration Structure](#9-yaml-configuration-structure)
10. [API Surface](#10-api-surface)
11. [Timeline Orchestration](#11-timeline-orchestration)
12. [ApexCharts Integration](#12-apexcharts-integration)
13. [Implementation Phases](#13-implementation-phases)
14. [Detailed Code Specifications](#14-detailed-code-specifications)
15. [Testing Strategy](#15-testing-strategy)

---

## 1. Architecture Overview

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER YAML CONFIG                         │
│  animation_presets:                                             │
│    critical_alert: { preset: pulse, duration: 300 }            │
│  overlays:                                                      │
│    - id: cpu_status                                            │
│      animations:                                               │
│        - preset_ref: critical_alert                           │
│          trigger: on_state_change                             │
│          datasource: sensor.cpu_temp                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   PIPELINE (Merge & Resolve)                    │
│  - Merge animation_presets + overlays.animations               │
│  - Resolve datasource references                               │
│  - Build resolvedModel with animation definitions              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      SYSTEMS MANAGER                            │
│  - Initialize AnimationManager                                 │
│  - Pass resolvedModel, mountEl, hass, datasources             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ANIMATION MANAGER                            │
│  - Create Scope per overlay                                    │
│  - Register animations with triggers                           │
│  - Setup trigger listeners (load, tap, datasource change)     │
│  - Coordinate with AnimationRegistry for caching              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  TRIGGER EVENT OCCURS                           │
│  (on_load, on_tap, datasource update, RulesEngine)            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              ANIMATION MANAGER EXECUTES                         │
│  1. Resolve animation definition (preset/inline)               │
│  2. Resolve datasource-driven parameters                       │
│  3. Get/create animation instance from Registry                │
│  4. Apply preset transformations (via cb-lcars-anim-presets)  │
│  5. Execute anime.js animation in overlay's Scope              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ANIME.JS V4 ENGINE                           │
│  - Uses overlay's Scope for lifecycle management               │
│  - Animates within mountEl/shadowRoot context                  │
│  - Emits events (begin, update, complete)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   API LAYERS (Observe/Control)                  │
│  Runtime: window.cblcars.msd.animate()                         │
│  Debug: window.cblcars.debug.msd.animations.active()          │
│  Dev: window.cblcars.dev.anim.*                                │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **AnimationManager** | Orchestration, trigger handling, API exposure, lifecycle management |
| **AnimationRegistry** | Performance caching via semantic hashing, instance reuse |
| **Presets Library** | Animation templates (pulse, glow, march, etc.) |
| **RulesEngine** | Trigger animations via `animate_overlays` key |
| **DatasourceManager** | Provide reactive data for animation parameters |
| **Unified API** | External access to animation control and introspection |

---

## 2. Module Structure

### File Organization

```
src/msd/
├── systems/
│   ├── AnimationManager.js       ← NEW: Main orchestrator
│   ├── AnimationRegistry.js      ← NEW: Performance cache
│   ├── RulesEngine.js            ← UPDATED: Add animate_overlays support
│   ├── SystemsManager.js         ← UPDATED: Initialize animation systems
│   └── ... (existing systems)
│
├── animation/                     ← NEW DIRECTORY
│   ├── presets/
│   │   ├── index.js              ← Export all presets
│   │   ├── pulse.js              ← Refactored from POC
│   │   ├── glow.js               ← Refactored from POC
│   │   ├── march.js              ← Refactored from POC (CSS-based)
│   │   ├── motionpath.js         ← Refactored from POC (tracer animation)
│   │   ├── draw.js               ← SVG path drawing
│   │   ├── fade.js               ← Simple opacity
│   │   └── ... (future presets)
│   │
│   ├── triggers/
│   │   ├── TriggerManager.js     ← Handles trigger registration/dispatch
│   │   ├── LoadTrigger.js        ← on_load implementation
│   │   ├── TapTrigger.js         ← on_tap implementation
│   │   ├── DatasourceTrigger.js  ← on_datasource_change implementation
│   │   └── ... (future triggers)
│   │
│   └── utils/
│       ├── scopeHelpers.js       ← Scope creation/management utilities
│       ├── paramResolvers.js     ← Datasource parameter resolution
│       └── animationHelpers.js   ← General animation utilities
│
├── utils/
│   ├── cb-lcars-anim-helpers.js  ← REFACTORED: v4 compatible helpers
│   └── ... (existing utils)
│
└── ... (existing MSD structure)

src/api/
├── RuntimeAPI.js                  ← UPDATED: Add animation methods
├── DebugAPI.js                    ← UPDATED: Add animation introspection
└── DevAPI.js                      ← UPDATED: Expose anime.js directly
```

---

## 3. Animation Triggers

### Trigger Types

Animations can be triggered via multiple mechanisms:

#### **3.1 Lifecycle Triggers**

```yaml
overlays:
  - id: status_text
    animations:
      - preset: fade
        trigger: on_load        # When overlay first renders

      - preset: pulse
        trigger: on_redraw      # When overlay re-renders (future)

      - preset: fade
        trigger: on_exit        # When overlay is removed (future)
        reversed: true
```

#### **3.2 Interaction Triggers**

```yaml
overlays:
  - id: button_text
    animations:
      - preset: glow
        trigger: on_tap         # User taps/clicks overlay

      - preset: pulse
        trigger: on_hold        # User holds tap (future)

      - preset: shimmer
        trigger: on_hover       # Mouse hover (future, non-mobile)
```

#### **3.3 Datasource Triggers**

```yaml
overlays:
  - id: cpu_indicator
    animations:
      - preset: pulse
        trigger: on_datasource_change
        datasource: sensor.cpu_temp
        conditions:              # Optional condition filtering
          - above: 80
```

#### **3.4 RulesEngine Triggers**

```yaml
rules:
  - conditions:
      - datasource: sensor.cpu_temp
        above: 80
    animate_overlays:            # NEW KEY (replaces "actions")
      - overlay_id: cpu_status
        preset: pulse
        duration: 300
        color: var(--lcars-red)
```

#### **3.5 Manual/API Triggers**

```javascript
// Via Runtime API
window.cblcars.msd.animate(null, 'cpu_status', 'pulse', {
  duration: 500,
  color: 'var(--lcars-orange)'
});

// Via Debug API (testing)
window.cblcars.debug.msd.animations.trigger(null, 'cpu_status', {
  preset: 'glow',
  duration: 1000
});
```

### Trigger Priority & Conflicts

When multiple animations target the same overlay:

1. **Sequential** (default): Queue animations, play one after another
2. **Interrupt**: New animation cancels current animation
3. **Merge**: Blend animations (if properties don't conflict)

```yaml
overlays:
  - id: status
    animations:
      - preset: pulse
        trigger: on_load
        conflict_strategy: sequential  # Default

      - preset: glow
        trigger: on_tap
        conflict_strategy: interrupt   # Cancel pulse if playing
```

---

## 4. Scope Management Strategy

### One Scope Per Overlay

Each overlay receives its own Anime.js Scope for granular control:

```javascript
// AnimationManager.js
class AnimationManager {
  initializeOverlayScopes(overlays) {
    overlays.forEach(overlay => {
      const scope = window.cblcars.animejs.createScope();

      this.scopes.set(overlay.id, {
        scope: scope,
        overlay: overlay,
        activeAnimations: new Set(),
        timeline: null  // Reserved for future timeline coordination
      });

      cblcarsLog.debug(`[AnimationManager] Created scope for overlay: ${overlay.id}`);
    });
  }
}
```

### Benefits

- **Isolation**: Animations don't interfere across overlays
- **Lifecycle**: Easy cleanup when overlay is removed
- **Control**: Pause/play/seek individual overlays
- **Timeline Coordination**: Scopes can be orchestrated via Timeline

### Scope Operations

```javascript
// Pause all animations on an overlay
animationManager.pauseOverlay('cpu_status');

// Resume overlay animations
animationManager.resumeOverlay('cpu_status');

// Seek to specific point in overlay's animations
animationManager.seekOverlay('cpu_status', 500); // 500ms

// Destroy overlay scope (cleanup)
animationManager.destroyOverlayScope('cpu_status');
```

---

## 5. AnimationRegistry Design

### Purpose

The AnimationRegistry provides **intelligent caching** of animation instances to improve performance by:
- Avoiding redundant anime.js instance creation
- Reusing identical animation configurations
- Semantic hashing to identify equivalent animations

### Smart Caching Strategy

```javascript
class AnimationRegistry {
  /**
   * Determines if an animation should be cached
   * @param {Object} animationDef - Animation definition
   * @returns {boolean}
   */
  shouldCache(animationDef) {
    // Cache preset-based animations (reusable patterns)
    if (animationDef.preset || animationDef.preset_ref) return true;

    // Cache looping animations (continuous effects)
    if (animationDef.loop === true || animationDef.loop > 1) return true;

    // Cache animations without datasource params (static)
    if (!animationDef.datasource && !this.hasDynamicParams(animationDef)) {
      return true;
    }

    // Don't cache one-shot, dynamic animations
    if (animationDef.oneshot || this.hasDynamicParams(animationDef)) {
      return false;
    }

    return false; // Conservative default
  }

  /**
   * Checks if animation has datasource-driven parameters
   * @param {Object} animationDef
   * @returns {boolean}
   */
  hasDynamicParams(animationDef) {
    const paramString = JSON.stringify(animationDef);
    // Check for template syntax or datasource references
    return /\{\{.*\}\}/.test(paramString) ||
           !!animationDef.datasource ||
           !!animationDef.params?.datasource;
  }
}
```

### Semantic Hashing

```javascript
/**
 * Generates a semantic hash for an animation definition
 * Excludes instance-specific data (targets, callbacks)
 * @param {Object} animationDef
 * @returns {string} Hash key
 */
generateHash(animationDef) {
  // Clone and remove instance-specific keys
  const cleanDef = { ...animationDef };
  delete cleanDef.targets;
  delete cleanDef.onBegin;
  delete cleanDef.onUpdate;
  delete cleanDef.onComplete;
  delete cleanDef.trigger; // Trigger doesn't affect animation behavior

  // Sort keys for consistent hashing
  const sorted = {};
  Object.keys(cleanDef).sort().forEach(key => {
    sorted[key] = cleanDef[key];
  });

  // Generate hash
  const hashString = JSON.stringify(sorted);
  return this.simpleHash(hashString);
}

/**
 * Simple hash function (FNV-1a)
 */
simpleHash(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}
```

### Registry Interface

```javascript
class AnimationRegistry {
  constructor() {
    this.cache = new Map(); // hash -> { def, factory }
    this.stats = {
      hits: 0,
      misses: 0,
      total: 0
    };
  }

  /**
   * Get or create animation instance
   * @param {Object} animationDef - Animation definition
   * @param {Element|Array<Element>} targets - Animation targets
   * @param {Object} scope - Anime.js scope
   * @returns {Object} Animation instance
   */
  getOrCreateInstance(animationDef, targets, scope) {
    this.stats.total++;

    if (!this.shouldCache(animationDef)) {
      this.stats.misses++;
      return this.createFreshInstance(animationDef, targets, scope);
    }

    const hash = this.generateHash(animationDef);

    if (this.cache.has(hash)) {
      this.stats.hits++;
      const cached = this.cache.get(hash);
      // Clone the cached definition and apply to new targets
      return this.createFromCached(cached, targets, scope);
    }

    this.stats.misses++;
    const instance = this.createFreshInstance(animationDef, targets, scope);

    // Store factory for future reuse
    this.cache.set(hash, {
      def: animationDef,
      factory: () => this.createFromCached({ def: animationDef }, targets, scope)
    });

    return instance;
  }

  /**
   * Get registry statistics
   */
  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.total > 0
        ? (this.stats.hits / this.stats.total * 100).toFixed(2) + '%'
        : '0%',
      cacheSize: this.cache.size
    };
  }

  /**
   * Clear registry cache
   */
  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, total: 0 };
  }
}
```

---

## 6. Animation Presets Library

### Core Presets (Phase 1)

#### **6.1 Pulse Preset**

Breathing scale/opacity effect for text and stroke-width for lines.

```javascript
// src/msd/animation/presets/pulse.js

/**
 * Pulse animation preset
 * Animates scale+opacity for text, stroke-width+opacity for lines
 *
 * @param {Object} params - Merged animation parameters
 * @param {Element} element - Target DOM element
 * @param {Object} options - Additional options
 * @returns {Object} Anime.js compatible params
 */
export function pulse(params, element, options = {}) {
  const pulseCfg = params.pulse || options.pulse || {};

  // Determine if text or line
  const isText = element.tagName.toLowerCase() === 'text';

  const maxScale = pulseCfg.max_scale ?? (isText ? 1.1 : 1.5);
  const minOpacity = pulseCfg.min_opacity ?? 0.7;
  const duration = params.duration ?? 1200;
  const easing = params.easing ?? 'inOut(2)'; // v4 easing
  const loop = params.loop ?? true;
  const alternate = params.alternate ?? true;

  if (isText) {
    // Text: animate scale and opacity
    element.style.transformOrigin = 'center';
    element.style.transformBox = 'fill-box';

    return {
      scale: [1, maxScale],
      opacity: [1, minOpacity],
      duration,
      easing,
      loop,
      alternate
    };
  } else {
    // Line: animate stroke-width and opacity
    const width = parseFloat(element.getAttribute('stroke-width')) || 4;

    return {
      'stroke-width': [width, width * maxScale],
      opacity: [1, minOpacity],
      duration,
      easing,
      loop,
      alternate
    };
  }
}
```

**YAML Usage:**
```yaml
overlays:
  - id: status_text
    type: text
    animations:
      - preset: pulse
        duration: 1000
        pulse:
          max_scale: 1.2
          min_opacity: 0.6
```

#### **6.2 Glow Preset**

Drop-shadow intensity animation for glowing effects.

```javascript
// src/msd/animation/presets/glow.js

/**
 * Glow animation preset
 * Animates drop-shadow filter for glowing effect
 *
 * @param {Object} params - Merged animation parameters
 * @param {Element} element - Target DOM element
 * @param {Object} options - Additional options
 * @returns {Object} Anime.js compatible params
 */
export function glow(params, element, options = {}) {
  const glowCfg = params.glow || options.glow || {};

  const color = glowCfg.color ?? params.color ?? 'var(--lcars-orange)';
  const blurMin = glowCfg.blur_min ?? 0;
  const blurMax = glowCfg.blur_max ?? 12;
  const opacityMin = glowCfg.opacity_min ?? 0.4;
  const opacityMax = glowCfg.opacity_max ?? 1;
  const duration = params.duration ?? 900;
  const easing = params.easing ?? 'inOut(2)';
  const loop = params.loop ?? true;
  const alternate = params.alternate ?? true;

  // Create state object for animation
  const glowState = {
    blur: blurMin,
    opacity: opacityMin
  };

  // Setup transform origin for text
  const isText = element.tagName.toLowerCase() === 'text';
  if (isText) {
    element.style.transformOrigin = 'center';
    element.style.transformBox = 'fill-box';
  }

  return {
    targets: glowState,
    blur: [blurMin, blurMax],
    opacity: [opacityMin, opacityMax],
    duration,
    easing,
    loop,
    alternate,
    onUpdate: () => {
      if (isText) {
        element.style.filter = `drop-shadow(0 0 ${glowState.blur}px ${color}) opacity(${glowState.opacity})`;
      } else {
        element.style.filter = `drop-shadow(0 0 ${glowState.blur}px ${color})`;
      }
    }
  };
}
```

**YAML Usage:**
```yaml
overlays:
  - id: alert_line
    type: line
    animations:
      - preset: glow
        trigger: on_datasource_change
        datasource: sensor.alert_status
        glow:
          color: var(--lcars-red)
          blur_max: 20
```

#### **6.3 March Preset**

CSS-based marching ants effect for lines (high performance).

```javascript
// src/msd/animation/presets/march.js

/**
 * March animation preset (CSS-based for performance)
 * Creates marching ants effect on dashed lines
 *
 * @param {Object} params - Merged animation parameters
 * @param {Element} element - Target SVG path/line element
 * @param {Object} options - Additional options
 * @returns {Object} Special marker to skip anime.js scheduling
 */
export function march(params, element, options = {}) {
  // Get dash pattern
  let dashArray = params.stroke_dasharray ?? options.stroke_dasharray ?? [25, 15];
  if (!Array.isArray(dashArray) || dashArray.length < 2) {
    dashArray = [25, 15];
  }

  const [dashLength, gapLength] = dashArray;
  const cycleLength = dashLength + gapLength;

  // Apply dash pattern
  element.style.strokeDasharray = `${dashLength} ${gapLength}`;
  element.style.strokeDashoffset = 0;

  // Line cap
  const linecap = params.stroke_linecap ?? options.stroke_linecap;
  if (linecap) {
    element.style.strokeLinecap = linecap;
  }

  // Animation duration
  const duration = params.duration ?? options.duration ?? 2000;
  const durationSec = duration / 1000;

  // Direction
  const reversed = params.reversed ?? options.reversed ?? false;
  const offsetTarget = reversed ? cycleLength : -cycleLength;

  // Loop handling
  let loopValue = params.loop ?? options.loop ?? true;
  const iterationCount = loopValue === true ? 'infinite' :
                        (loopValue === false || loopValue === 0) ? '1' :
                        typeof loopValue === 'number' ? Math.max(1, loopValue) : 'infinite';

  // Create unique animation name
  const animId = element.id || `march_${Math.random().toString(36).substring(2, 9)}`;
  const animationName = `march_${animId}`;

  // Build keyframes
  const keyframesStr = `@keyframes ${animationName} {
    to { stroke-dashoffset: ${offsetTarget}px; }
  }`;

  // Inject styles into shadowRoot
  const targetDoc = element.getRootNode();
  const isInShadowDOM = targetDoc !== document;

  if (isInShadowDOM && targetDoc.adoptedStyleSheets) {
    // Modern Shadow DOM with Constructable Stylesheets
    try {
      let styleSheet = Array.from(targetDoc.adoptedStyleSheets)
        .find(sheet => sheet.marchAnimations);

      if (!styleSheet) {
        styleSheet = new CSSStyleSheet();
        styleSheet.marchAnimations = true;
        targetDoc.adoptedStyleSheets = [...targetDoc.adoptedStyleSheets, styleSheet];
      }

      styleSheet.insertRule(keyframesStr, styleSheet.cssRules.length);
    } catch (e) {
      cblcarsLog.error('[march] Failed to add CSS animation to Shadow DOM:', e);
      fallbackStyleInjection(targetDoc, isInShadowDOM, keyframesStr);
    }
  } else {
    // Fallback: <style> element
    fallbackStyleInjection(targetDoc, isInShadowDOM, keyframesStr);
  }

  // Apply animation
  element.style.animation = `${animationName} ${durationSec}s linear ${iterationCount}`;

  // Return flag to skip anime.js scheduling
  return {
    _cssAnimation: true,
    targets: null
  };
}

function fallbackStyleInjection(targetDoc, isInShadowDOM, keyframesStr) {
  const styleId = 'march-animations';
  let styleEl = targetDoc.getElementById ? targetDoc.getElementById(styleId) : null;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    const target = isInShadowDOM ? targetDoc : document.head;
    target.appendChild(styleEl);
  }

  if (!styleEl.textContent.includes(keyframesStr.match(/@keyframes\s+(\S+)/)[1])) {
    styleEl.textContent += keyframesStr;
  }
}
```

**YAML Usage:**
```yaml
overlays:
  - id: data_flow_line
    type: line
    stroke_dasharray: [20, 10]
    animations:
      - preset: march
        duration: 3000
        reversed: false
        loop: true
```

#### **6.4 Motionpath Preset**

Animates a tracer element along an SVG path (data flow visualization).

```javascript
// src/msd/animation/presets/motionpath.js

/**
 * Motionpath animation preset
 * Creates and animates a tracer element along an SVG path
 *
 * @param {Object} params - Merged animation parameters
 * @param {Element} element - Target SVG path element
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Anime.js compatible params (async due to path waiting)
 */
export async function motionpath(params, element, options = {}) {
  const tracerCfg = params.tracer || options.tracer;

  if (!tracerCfg) {
    cblcarsLog.warn('[motionpath] tracer configuration required', { element });
    return { targets: null };
  }

  const root = options.root ?? element.getRootNode();
  const pathSelector = params.path_selector || options.path_selector;

  // Resolve path element
  let pathEl = pathSelector
    ? await window.cblcars.anim.waitForElement(pathSelector, root).catch(() => null)
    : element;

  if (!pathEl || pathEl.tagName.toLowerCase() !== 'path') {
    cblcarsLog.error('[motionpath] Target is not a valid SVG path', { pathEl });
    return { targets: null };
  }

  // Wait for usable path geometry
  const hasUsablePathD = (p) => {
    const d = p.getAttribute('d');
    return d && /[LCHQAVZlchqavz]/.test(d);
  };

  const waitForReady = async () => {
    const maxWait = params.wait_max_ms ?? 5000;
    const startTime = performance.now();

    while (!hasUsablePathD(pathEl)) {
      if (performance.now() - startTime > maxWait) {
        throw new Error('Timeout waiting for valid path geometry');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  try {
    await waitForReady();
  } catch (e) {
    cblcarsLog.error('[motionpath] Failed to get valid path:', e);
    return { targets: null };
  }

  // Create tracer element
  const tracerId = tracerCfg.id || `${pathEl.id || 'path'}_tracer`;
  const svgRoot = pathEl.ownerSVGElement || pathEl.closest('svg');

  let tracerNode;
  const shape = tracerCfg.shape || 'circle';

  if (shape === 'circle') {
    tracerNode = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    tracerNode.setAttribute('r', tracerCfg.r || 4);
    tracerNode.setAttribute('fill', tracerCfg.fill || 'var(--lcars-orange)');
  } else if (shape === 'rect') {
    tracerNode = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    tracerNode.setAttribute('width', tracerCfg.width || 8);
    tracerNode.setAttribute('height', tracerCfg.height || 8);
    tracerNode.setAttribute('fill', tracerCfg.fill || 'var(--lcars-orange)');
    // Center the rect
    tracerNode.setAttribute('x', -(tracerCfg.width || 8) / 2);
    tracerNode.setAttribute('y', -(tracerCfg.height || 8) / 2);
  }

  tracerNode.id = tracerId;
  tracerNode.setAttribute('data-cblcars-owned', 'motionpath');

  svgRoot.appendChild(tracerNode);

  // Create motion path
  const { translateX, translateY, rotate } = window.cblcars.animejs.svg.createMotionPath(pathEl);

  // Build animation params
  const duration = params.duration ?? 2000;
  const easing = params.easing ?? 'linear';
  const loop = params.loop ?? true;

  return {
    targets: tracerNode,
    translateX,
    translateY,
    rotate,
    duration,
    easing,
    loop
  };
}
```

**YAML Usage:**
```yaml
overlays:
  - id: network_path
    type: line
    animations:
      - preset: motionpath
        trigger: on_load
        tracer:
          shape: circle
          r: 5
          fill: var(--lcars-blue)
        duration: 4000
        loop: true
```

#### **6.5 Draw Preset**

SVG path drawing animation.

```javascript
// src/msd/animation/presets/draw.js

/**
 * Draw animation preset
 * Animates SVG path drawing using anime.js createDrawable
 *
 * @param {Object} params - Merged animation parameters
 * @param {Element} element - Target SVG path element
 * @param {Object} options - Additional options
 * @returns {Object} Anime.js compatible params
 */
export function draw(params, element, options = {}) {
  if (element.tagName.toLowerCase() !== 'path') {
    cblcarsLog.warn('[draw] Target is not an SVG path', { element });
    return { targets: null };
  }

  // Create drawable
  const [drawable] = window.cblcars.animejs.svg.createDrawable(element);

  const duration = params.duration ?? 1200;
  const easing = params.easing ?? 'inOut(2)';
  const loop = params.loop ?? false;
  const alternate = params.alternate ?? false;

  // Draw config
  const drawCfg = params.draw || options.draw || {};
  let drawValues;

  if (Array.isArray(drawCfg)) {
    drawValues = drawCfg;
  } else if (drawCfg && Array.isArray(drawCfg.values)) {
    drawValues = drawCfg.values;
  } else {
    drawValues = ['0 0', '0 1']; // Default: draw from start to end
  }

  return {
    targets: drawable,
    draw: drawValues,
    duration,
    easing,
    loop,
    alternate
  };
}
```

**YAML Usage:**
```yaml
overlays:
  - id: connection_line
    type: line
    animations:
      - preset: draw
        trigger: on_load
        duration: 1500
        draw:
          values: ['0 0', '0 1']
```

#### **6.6 Fade Preset**

Simple opacity transition.

```javascript
// src/msd/animation/presets/fade.js

/**
 * Fade animation preset
 * Simple opacity transition
 *
 * @param {Object} params - Merged animation parameters
 * @param {Element} element - Target element
 * @param {Object} options - Additional options
 * @returns {Object} Anime.js compatible params
 */
export function fade(params, element, options = {}) {
  const from = params.from ?? 0;
  const to = params.to ?? 1;
  const duration = params.duration ?? 1000;
  const easing = params.easing ?? 'linear';
  const loop = params.loop ?? false;
  const alternate = params.alternate ?? false;

  return {
    opacity: [from, to],
    duration,
    easing,
    loop,
    alternate
  };
}
```

### Preset Export Structure

```javascript
// src/msd/animation/presets/index.js

import { pulse } from './pulse.js';
import { glow } from './glow.js';
import { march } from './march.js';
import { motionpath } from './motionpath.js';
import { draw } from './draw.js';
import { fade } from './fade.js';

export const animationPresets = {
  pulse,
  glow,
  march,
  motionpath,
  draw,
  fade
};

// Make available globally
if (typeof window !== 'undefined') {
  window.cblcars = window.cblcars || {};
  window.cblcars.anim = window.cblcars.anim || {};
  window.cblcars.anim.presets = animationPresets;
}
```

---

## 7. RulesEngine Integration

### Problem: "actions" Key Ambiguity

The current RulesEngine uses `actions` key, which conflicts with user interaction actions (tap, hold, etc.). This creates confusion.

### Solution: Dedicated `animate_overlays` Key

Introduce a dedicated key for animation instructions in rules:

```yaml
rules:
  - name: critical_cpu_temp
    conditions:
      - datasource: sensor.cpu_temp
        above: 80
    animate_overlays:           # NEW: Dedicated animation key
      - overlay_id: cpu_status
        preset: pulse
        duration: 300
        color: var(--lcars-red)

      - overlay_id: cpu_gauge
        preset: glow
        glow:
          blur_max: 20
```

### RulesEngine Implementation

```javascript
// src/msd/systems/RulesEngine.js (UPDATED)

class RulesEngine {
  /**
   * Execute rule actions when conditions are met
   * @param {Object} rule - Rule definition
   * @param {Object} context - Evaluation context
   */
  executeRule(rule, context) {
    cblcarsLog.debug(`[RulesEngine] Executing rule: ${rule.name || 'unnamed'}`);

    // Handle animate_overlays (NEW)
    if (rule.animate_overlays && Array.isArray(rule.animate_overlays)) {
      this.executeAnimations(rule.animate_overlays, context);
    }

    // Handle existing action types (style_overlays, etc.)
    if (rule.style_overlays && Array.isArray(rule.style_overlays)) {
      this.executeStyleActions(rule.style_overlays, context);
    }

    // Future: other action types...
  }

  /**
   * Execute animation actions
   * @param {Array} animateActions - Array of animation definitions
   * @param {Object} context - Evaluation context
   */
  executeAnimations(animateActions, context) {
    const animationManager = this.systemsManager.animationManager;

    if (!animationManager) {
      cblcarsLog.warn('[RulesEngine] AnimationManager not available');
      return;
    }

    animateActions.forEach(animDef => {
      const overlayId = animDef.overlay_id;

      if (!overlayId) {
        cblcarsLog.warn('[RulesEngine] animate_overlays missing overlay_id', animDef);
        return;
      }

      // Resolve datasource-driven parameters
      const resolvedParams = this.resolveDatasourceParams(animDef, context);

      // Trigger animation via AnimationManager
      animationManager.playAnimation(overlayId, {
        ...animDef,
        ...resolvedParams,
        trigger_source: 'rules_engine',
        rule_name: context.ruleName
      });

      cblcarsLog.debug(`[RulesEngine] Triggered animation on overlay: ${overlayId}`, {
        preset: animDef.preset,
        params: resolvedParams
      });
    });
  }

  /**
   * Resolve datasource-driven animation parameters
   * @param {Object} animDef - Animation definition
   * @param {Object} context - Evaluation context with datasource values
   * @returns {Object} Resolved parameters
   */
  resolveDatasourceParams(animDef, context) {
    const resolved = {};

    // Example: duration based on datasource value
    // duration: "{{ datasource.sensor_cpu_temp * 10 }}"
    Object.entries(animDef).forEach(([key, value]) => {
      if (typeof value === 'string' && value.includes('{{')) {
        // Use existing template resolution from pipeline
        resolved[key] = this.systemsManager.pipelineInstance.resolveTemplate(
          value,
          context
        );
      }
    });

    return resolved;
  }
}
```

### Benefits

- ✅ **Clear intent**: `animate_overlays` is unambiguous
- ✅ **Consistent naming**: Follows pattern of `style_overlays`
- ✅ **Extensible**: Easy to add future action types (`control_overlays`, `data_overlays`, etc.)
- ✅ **No breaking changes**: Existing `style_overlays` continues to work

---

## 8. Datasource-Driven Parameters

### Concept

Animation parameters can be dynamically driven by datasource values, making the MSD feel "alive" and reactive to Home Assistant state changes.

### Implementation Strategy

#### **8.1 Template Syntax in YAML**

Use Home Assistant template syntax for dynamic values:

```yaml
overlays:
  - id: cpu_gauge
    animations:
      - preset: pulse
        trigger: on_datasource_change
        datasource: sensor.cpu_temp
        duration: "{{ 2000 - (states('sensor.cpu_temp') | int * 10) }}"  # Faster as temp rises
        color: >
          {% if states('sensor.cpu_temp') | int > 80 %}
            var(--lcars-red)
          {% elif states('sensor.cpu_temp') | int > 60 %}
            var(--lcars-orange)
          {% else %}
            var(--lcars-blue)
          {% endif %}
        pulse:
          max_scale: "{{ 1.1 + (states('sensor.cpu_temp') | int / 200) }}"  # Scale based on temp
```

#### **8.2 Datasource Resolution in AnimationManager**

```javascript
// src/msd/systems/AnimationManager.js

class AnimationManager {
  /**
   * Resolve datasource-driven parameters
   * @param {Object} animDef - Animation definition with templates
   * @param {Object} datasources - Available datasources
   * @returns {Object} Resolved animation definition
   */
  resolveDatasourceParams(animDef, datasources) {
    const resolved = { ...animDef };

    // Get datasource value if specified
    let datasourceValue = null;
    if (animDef.datasource) {
      const ds = datasources.get(animDef.datasource);
      datasourceValue = ds?.state;
    }

    // Resolve each parameter
    Object.entries(resolved).forEach(([key, value]) => {
      if (typeof value === 'string' && this.isTemplate(value)) {
        // Build context for template resolution
        const context = {
          states: (entityId) => {
            const ds = datasources.get(entityId);
            return ds?.state;
          },
          datasource: {
            state: datasourceValue,
            attributes: datasources.get(animDef.datasource)?.attributes || {}
          }
        };

        // Use pipeline's template resolver
        resolved[key] = this.systemsManager.pipelineInstance.resolveTemplate(
          value,
          context
        );
      }
    });

    return resolved;
  }

  /**
   * Check if string contains template syntax
   * @param {string} str
   * @returns {boolean}
   */
  isTemplate(str) {
    return /\{\{.*\}\}|\{%.*%\}/.test(str);
  }
}
```

#### **8.3 Datasource Change Listeners**

```javascript
// src/msd/systems/AnimationManager.js

class AnimationManager {
  /**
   * Setup datasource change listeners for animations
   * @param {Array} animations - Animation definitions with datasource triggers
   */
  setupDatasourceListeners(animations) {
    animations.forEach(animDef => {
      if (animDef.trigger === 'on_datasource_change' && animDef.datasource) {
        // Subscribe to datasource updates
        this.systemsManager.datasourceManager.subscribe(
          animDef.datasource,
          (newValue, oldValue) => {
            // Check conditions if specified
            if (animDef.conditions) {
              const conditionsMet = this.evaluateConditions(
                animDef.conditions,
                newValue
              );
              if (!conditionsMet) return;
            }

            // Resolve parameters with new datasource value
            const resolvedAnimDef = this.resolveDatasourceParams(
              animDef,
              this.systemsManager.datasourceManager.getDatasources()
            );

            // Play animation
            this.playAnimation(animDef.overlay_id, resolvedAnimDef);
          }
        );
      }
    });
  }

  /**
   * Evaluate animation conditions
   * @param {Array} conditions - Condition definitions
   * @param {*} value - Current datasource value
   * @returns {boolean}
   */
  evaluateConditions(conditions, value) {
    return conditions.every(condition => {
      if (condition.above !== undefined) {
        return Number(value) > condition.above;
      }
      if (condition.below !== undefined) {
        return Number(value) < condition.below;
      }
      if (condition.equals !== undefined) {
        return value == condition.equals;
      }
      if (condition.not_equals !== undefined) {
        return value != condition.not_equals;
      }
      return true;
    });
  }
}
```

### Example Use Cases

#### **Speed based on entity state**
```yaml
animations:
  - preset: march
    datasource: sensor.network_speed
    duration: "{{ 5000 / (states('sensor.network_speed') | int + 1) }}"  # Faster with higher speed
```

#### **Color based on status**
```yaml
animations:
  - preset: glow
    datasource: binary_sensor.alert
    color: >
      {{ 'var(--lcars-red)' if is_state('binary_sensor.alert', 'on') else 'var(--lcars-blue)' }}
```

#### **Conditional animation**
```yaml
animations:
  - preset: pulse
    trigger: on_datasource_change
    datasource: sensor.cpu_temp
    conditions:
      - above: 80
    duration: 300
    color: var(--lcars-red)
```

---

## 9. YAML Configuration Structure

### Complete Configuration Schema

```yaml
type: custom:cb-lcars-msd

# Global animation presets (DRY principle)
animation_presets:
  # User-defined preset
  critical_alert:
    preset: pulse                    # Base preset to extend
    duration: 300
    color: var(--lcars-red)
    pulse:
      max_scale: 1.3
      min_opacity: 0.5
    loop: true
    alternate: true

  # Another custom preset
  data_flow:
    preset: motionpath
    tracer:
      shape: circle
      r: 4
      fill: var(--lcars-blue)
    duration: 2000
    loop: true

  # Override built-in preset
  pulse:                             # Overrides default pulse preset
    duration: 800
    pulse:
      max_scale: 1.15

# Overlays with animations
overlays:
  # Text overlay with multiple animations
  - id: cpu_status
    type: text
    content: "CPU"
    position: [100, 100]
    animations:
      # Reference custom preset
      - preset_ref: critical_alert
        trigger: on_datasource_change
        datasource: sensor.cpu_temp
        conditions:
          - above: 80

      # Inline animation definition
      - preset: glow
        trigger: on_tap
        duration: 500
        glow:
          color: var(--lcars-orange)
          blur_max: 15

  # Line overlay with march animation
  - id: data_line
    type: line
    endpoints: [[50, 50], [200, 50]]
    stroke_dasharray: [20, 10]
    animations:
      - preset: march
        trigger: on_load
        duration: 3000
        loop: true

      - preset_ref: data_flow
        trigger: on_load

  # ApexChart overlay (Phase 3)
  - id: cpu_chart
    type: apexchart
    animations:
      - preset: fade
        trigger: on_load
        duration: 1000

# Rules with animate_overlays
rules:
  - name: high_cpu_alert
    conditions:
      - datasource: sensor.cpu_temp
        above: 80
    animate_overlays:
      - overlay_id: cpu_status
        preset: pulse
        duration: 200
        color: var(--lcars-red)

      - overlay_id: data_line
        preset: glow
        glow:
          blur_max: 25

  - name: network_activity
    conditions:
      - datasource: sensor.network_tx
        above: 100
    animate_overlays:
      - overlay_id: data_line
        preset: march
        duration: "{{ 5000 / states('sensor.network_tx') | int }}"
        reversed: false

# Timelines (Phase 2)
timelines:
  startup_sequence:
    autoplay: true
    loop: false
    steps:
      - overlay_id: title
        preset: fade
        duration: 500
        offset: 0

      - overlay_id: status_line
        preset: draw
        duration: 1000
        offset: 300

      - overlay_id: cpu_gauge
        preset_ref: critical_alert
        offset: 1000
```

### Configuration Resolution Order

1. **Parse `animation_presets`** → Store in registry
2. **Parse `overlays.animations`** → Resolve `preset_ref` or `preset`
3. **Parse `rules.animate_overlays`** → Resolve presets
4. **Parse `timelines`** → Resolve presets for steps
5. **Merge with overlay-level `animation` config** (if exists)

### Preset Resolution Logic

```javascript
/**
 * Resolve animation definition from preset reference or inline
 * @param {Object} animDef - Animation definition from YAML
 * @param {Object} customPresets - User-defined animation_presets
 * @returns {Object} Resolved animation definition
 */
resolveAnimationDefinition(animDef, customPresets) {
  let resolved = { ...animDef };

  // 1. Check for preset_ref (custom preset)
  if (animDef.preset_ref) {
    const customPreset = customPresets[animDef.preset_ref];
    if (customPreset) {
      resolved = { ...customPreset, ...animDef };
      delete resolved.preset_ref;
    } else {
      cblcarsLog.warn(`[AnimationManager] preset_ref not found: ${animDef.preset_ref}`);
    }
  }

  // 2. Check for preset (built-in)
  if (resolved.preset) {
    const builtinPreset = window.cblcars.anim.presets[resolved.preset];
    if (!builtinPreset) {
      cblcarsLog.warn(`[AnimationManager] Unknown preset: ${resolved.preset}`);
    }
  }

  // 3. Inline definition (use as-is)
  return resolved;
}
```

---

## 10. API Surface

### Runtime API (User-Facing)

```javascript
// src/api/RuntimeAPI.js (ADDITIONS)

class RuntimeAPI {
  /**
   * Play a named animation on an overlay
   * @param {string|null} cardId - Card identifier (null for current)
   * @param {string} overlayId - Overlay identifier
   * @param {string} presetName - Animation preset name
   * @param {Object} params - Additional animation parameters
   * @returns {Object|null} Animation instance
   *
   * @example
   * window.cblcars.msd.animate(null, 'cpu_status', 'pulse', {
   *   duration: 500,
   *   color: 'var(--lcars-red)'
   * });
   */
  animate(cardId = null, overlayId, presetName, params = {}) {
    const instance = this._resolveInstance(cardId);
    if (!instance) {
      cblcarsLog.warn('[RuntimeAPI] MSD instance not found', { cardId });
      return null;
    }

    const animManager = instance.systemsManager?.animationManager;
    if (!animManager) {
      cblcarsLog.warn('[RuntimeAPI] AnimationManager not available');
      return null;
    }

    return animManager.playAnimation(overlayId, {
      preset: presetName,
      ...params,
      trigger_source: 'api'
    });
  }

  /**
   * Stop all animations on an overlay
   * @param {string|null} cardId - Card identifier
   * @param {string} overlayId - Overlay identifier
   *
   * @example
   * window.cblcars.msd.stopAnimation(null, 'cpu_status');
   */
  stopAnimation(cardId = null, overlayId) {
    const instance = this._resolveInstance(cardId);
    if (!instance) return;

    const animManager = instance.systemsManager?.animationManager;
    animManager?.stopAnimation(overlayId);
  }

  /**
   * Pause animations on an overlay
   * @param {string|null} cardId - Card identifier
   * @param {string} overlayId - Overlay identifier
   */
  pauseAnimation(cardId = null, overlayId) {
    const instance = this._resolveInstance(cardId);
    if (!instance) return;

    const animManager = instance.systemsManager?.animationManager;
    animManager?.pauseOverlay(overlayId);
  }

  /**
   * Resume animations on an overlay
   * @param {string|null} cardId - Card identifier
   * @param {string} overlayId - Overlay identifier
   */
  resumeAnimation(cardId = null, overlayId) {
    const instance = this._resolveInstance(cardId);
    if (!instance) return;

    const animManager = instance.systemsManager?.animationManager;
    animManager?.resumeOverlay(overlayId);
  }

  /**
   * Subscribe to animation events
   * @param {string|null} cardId - Card identifier
   * @param {string} overlayId - Overlay identifier
   * @param {string} eventType - Event type ('begin', 'update', 'complete')
   * @param {Function} callback - Event callback
   * @returns {Function} Unsubscribe function
   *
   * @example
   * const unsub = window.cblcars.msd.onAnimation(null, 'cpu_status', 'complete', (evt) => {
   *   console.log('Animation completed!', evt);
   * });
   * // Later: unsub();
   */
  onAnimation(cardId = null, overlayId, eventType, callback) {
    const instance = this._resolveInstance(cardId);
    if (!instance) return () => {};

    const animManager = instance.systemsManager?.animationManager;
    return animManager?.on(overlayId, eventType, callback) || (() => {});
  }

  /**
   * Play a timeline
   * @param {string|null} cardId - Card identifier
   * @param {string} timelineId - Timeline identifier
   *
   * @example
   * window.cblcars.msd.playTimeline(null, 'startup_sequence');
   */
  playTimeline(cardId = null, timelineId) {
    const instance = this._resolveInstance(cardId);
    if (!instance) return;

    const animManager = instance.systemsManager?.animationManager;
    animManager?.playTimeline(timelineId);
  }
}
```

### Debug API (Developer Introspection)

```javascript
// src/api/DebugAPI.js (ADDITIONS)

class DebugAPI {
  /**
   * Get all active animations
   * @param {string|null} cardId - Card identifier
   * @returns {Object} Active animations by overlay
   *
   * @example
   * window.cblcars.debug.msd.animations.active();
   * // => { cpu_status: [{ id: 'anim_123', progress: 0.5, paused: false }], ... }
   */
  active(cardId = null) {
    const instance = this._resolveInstance(cardId);
    if (!instance) return {};

    const animManager = instance.systemsManager?.animationManager;
    return animManager?.getActiveAnimations() || {};
  }

  /**
   * Dump all registered animations
   * @param {string|null} cardId - Card identifier
   * @returns {Array<Object>} Animation definitions
   *
   * @example
   * window.cblcars.debug.msd.animations.dump();
   */
  dump(cardId = null) {
    const instance = this._resolveInstance(cardId);
    if (!instance) return [];

    const animManager = instance.systemsManager?.animationManager;
    return animManager?.getAllAnimationDefinitions() || [];
  }

  /**
   * Get animation registry statistics
   * @param {string|null} cardId - Card identifier
   * @returns {Object} Registry stats
   *
   * @example
   * window.cblcars.debug.msd.animations.registryStats();
   * // => { hits: 45, misses: 12, total: 57, hitRate: '78.95%', cacheSize: 8 }
   */
  registryStats(cardId = null) {
    const instance = this._resolveInstance(cardId);
    if (!instance) return {};

    const animManager = instance.systemsManager?.animationManager;
    const registry = animManager?.registry;
    return registry?.getStats() || {};
  }

  /**
   * Manually trigger an animation (test/debug)
   * @param {string|null} cardId - Card identifier
   * @param {string} overlayId - Overlay identifier
   * @param {Object} animDef - Animation definition
   * @returns {Object|null} Animation instance
   *
   * @example
   * window.cblcars.debug.msd.animations.trigger(null, 'cpu_status', {
   *   preset: 'pulse',
   *   duration: 1000
   * });
   */
  trigger(cardId = null, overlayId, animDef) {
    const instance = this._resolveInstance(cardId);
    if (!instance) return null;

    const animManager = instance.systemsManager?.animationManager;
    return animManager?.playAnimation(overlayId, {
      ...animDef,
      trigger_source: 'debug_api'
    });
  }

  /**
   * Inspect a specific overlay's animation state
   * @param {string|null} cardId - Card identifier
   * @param {string} overlayId - Overlay identifier
   * @returns {Object|null} Overlay animation state
   *
   * @example
   * window.cblcars.debug.msd.animations.inspect(null, 'cpu_status');
   * // => {
   * //   scope: {...},
   * //   activeAnimations: [...],
   * //   registeredAnimations: [...],
   * //   timeline: null
   * // }
   */
  inspect(cardId = null, overlayId) {
    const instance = this._resolveInstance(cardId);
    if (!instance) return null;

    const animManager = instance.systemsManager?.animationManager;
    return animManager?.inspectOverlay(overlayId);
  }

  /**
   * List all available animation presets
   * @returns {Array<string>} Preset names
   *
   * @example
   * window.cblcars.debug.msd.animations.presets();
   * // => ['pulse', 'glow', 'march', 'motionpath', 'draw', 'fade', ...]
   */
  presets() {
    const builtIn = Object.keys(window.cblcars?.anim?.presets || {});
    const custom = Object.keys(window.cblcars?.anim?.customPresets || {});
    return {
      builtin: builtIn,
      custom: custom
    };
  }
}
```

### Dev API (Advanced/Unstable)

```javascript
// src/api/DevAPI.js (ADDITIONS)

class DevAPI {
  /**
   * Direct access to anime.js
   * @returns {Object} anime.js v4 instance
   */
  get animejs() {
    return window.cblcars?.animejs;
  }

  /**
   * Create a custom animation scope
   * @returns {Object} anime.js Scope
   */
  createScope() {
    return window.cblcars?.animejs?.createScope();
  }

  /**
   * Create a custom timeline
   * @param {Object} options - Timeline options
   * @returns {Object} anime.js Timeline
   */
  createTimeline(options = {}) {
    return window.cblcars?.animejs?.createTimeline(options);
  }

  /**
   * Access anime.js utilities
   * @returns {Object} anime.js Utils
   */
  get utils() {
    return window.cblcars?.animejs?.utils;
  }

  /**
   * Register a custom animation preset
   * @param {string} name - Preset name
   * @param {Function} presetFn - Preset function
   *
   * @example
   * window.cblcars.dev.anim.registerPreset('custom_wobble', (params, element, options) => {
   *   return {
   *     rotate: [0, 10, -10, 0],
   *     duration: params.duration ?? 800,
   *     easing: 'inOut(2)',
   *     loop: true
   *   };
   * });
   */
  registerPreset(name, presetFn) {
    if (typeof presetFn !== 'function') {
      cblcarsLog.error('[DevAPI] Preset must be a function');
      return;
    }

    window.cblcars.anim = window.c