# MSD ApexCharts Enhancement Proposal - Appendix D (Final)

**Version:** 1.0.0  
**Date:** 2025-01-16  
**Status:** Proposed - Appendix (FINAL)  
**Author:** CB-LCARS MSD Team

---

## Appendix D: Advanced MSD Features - Layers, Reactive SVG, Audio & Responsiveness

This appendix explores advanced MSD capabilities that enhance visual richness, interactivity, and user experience through multi-layer rendering, reactive ship blueprints, audio feedback, and viewport adaptation.

---

## D.1 Overview

### D.1.1 Proposed Features

**Four Major Feature Areas:**

| Feature | Description | Impact | Priority |
|---------|-------------|--------|----------|
| **Reactive SVG Base Layer** | Rules-driven ship blueprint styling | 🔥🔥🔥 High | **HIGH** |
| **Multi-Layer System** | Background, decorative, and effects layers | 🔥🔥 Medium-High | **HIGH** |
| **Sound System** | LCARS audio feedback for interactions | 🔥 Medium | **LOW** |
| **Viewport Adaptation** | Responsive overlay positioning | 🔥🔥 Medium | **MEDIUM** |

### D.1.2 Architectural Vision

```
┌─────────────────────────────────────────────────────────────┐
│                    Enhanced MSD Stack                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 0: Background (NEW)                                   │
│    ├─ Static images (space, nebula)                         │
│    ├─ Animated backgrounds (parallax, drift)                │
│    └─ Configurable opacity/effects                          │
│                                                              │
│  Layer 1: Base SVG (ENHANCED)                                │
│    ├─ Ship blueprint (existing)                             │
│    ├─ ✨ Rules-driven element styling (NEW)                 │
│    ├─ ✨ Hull damage visualization (NEW)                    │
│    └─ ✨ System status indicators (NEW)                     │
│                                                              │
│  Layer 2: Decorative (NEW)                                   │
│    ├─ LCARS frames and elbows                               │
│    ├─ Panel borders                                         │
│    └─ Grid overlays                                         │
│                                                              │
│  Layer 3: Overlays (existing)                                │
│    ├─ Lines, text, charts                                   │
│    ├─ Status grids                                          │
│    └─ Sparklines                                            │
│                                                              │
│  Layer 4: Controls (existing)                                │
│    ├─ HA cards (custom-button-card)                         │
│    └─ Interactive elements                                  │
│                                                              │
│  Layer 5: Effects (NEW)                                      │
│    ├─ Scanlines                                             │
│    ├─ Vignette                                              │
│    └─ Screen effects                                        │
│                                                              │
│  Layer 6: Debug (existing)                                   │
│    └─ Debug overlays                                        │
│                                                              │
│  Audio System (NEW)                                          │
│    ├─ Interaction sounds (taps, beeps)                      │
│    ├─ Alert sounds (klaxons, warnings)                      │
│    └─ State change sounds (data updates)                    │
│                                                              │
│  Responsive System (NEW)                                     │
│    ├─ Viewport detection                                    │
│    ├─ Breakpoint-based positioning                          │
│    └─ Mobile/tablet/desktop layouts                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## D.2 Feature 1: Reactive SVG Base Layer

### D.2.1 Concept

**Goal:** Enable RulesEngine to dynamically style SVG elements in the ship blueprint based on system state.

**Current Limitation:**
- ❌ `base_svg` is static after injection
- ❌ No way to visualize hull damage
- ❌ Can't show system status on blueprint
- ❌ Missing canonical LCARS functionality

**Proposed Enhancement:**
- ✅ Target SVG elements by ID or class
- ✅ Apply RulesEngine patches to SVG attributes
- ✅ Visualize hull damage, shields, system status
- ✅ Full integration with token system

### D.2.2 Enhanced Base SVG with Targetable Elements

**Ship blueprint with semantic IDs and classes:**

```xml
<!-- /local/ships/galaxy-class.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600">
  <defs>
    <!-- Reusable styles -->
    <style>
      .hull-section { 
        fill: #666666; 
        stroke: #999999;
        stroke-width: 2;
        transition: fill 0.3s ease, opacity 0.3s ease;
      }
      .system-indicator {
        opacity: 0;
        transition: opacity 0.5s ease;
      }
    </style>
  </defs>
  
  <!-- Hull sections with semantic IDs -->
  <g id="saucer-section" class="hull-section critical-system">
    <circle cx="500" cy="200" r="120" class="hull-geometry"/>
    <text x="500" y="200" text-anchor="middle" fill="#FFFFFF" font-size="12">
      SAUCER
    </text>
  </g>
  
  <g id="engineering-section" class="hull-section critical-system">
    <rect x="450" y="320" width="100" height="200" class="hull-geometry"/>
    <text x="500" y="420" text-anchor="middle" fill="#FFFFFF" font-size="12">
      ENGINEERING
    </text>
  </g>
  
  <g id="warp-nacelle-left" class="hull-section nacelle critical-system">
    <ellipse cx="150" cy="200" rx="80" ry="30" class="hull-geometry"/>
    <text x="150" y="200" text-anchor="middle" fill="#FFFFFF" font-size="10">
      PORT NACELLE
    </text>
  </g>
  
  <g id="warp-nacelle-right" class="hull-section nacelle critical-system">
    <ellipse cx="850" cy="200" rx="80" ry="30" class="hull-geometry"/>
    <text x="850" y="200" text-anchor="middle" fill="#FFFFFF" font-size="10">
      STARBOARD NACELLE
    </text>
  </g>
  
  <!-- System indicators (initially hidden) -->
  <g id="shield-indicators" class="system-indicator">
    <circle cx="500" cy="140" r="8" fill="#0088FF" class="shield-emitter"/>
    <circle cx="500" cy="260" r="8" fill="#0088FF" class="shield-emitter"/>
    <circle cx="380" cy="200" r="8" fill="#0088FF" class="shield-emitter"/>
    <circle cx="620" cy="200" r="8" fill="#0088FF" class="shield-emitter"/>
  </g>
  
  <g id="warp-glow-left" class="system-indicator nacelle-glow">
    <ellipse cx="150" cy="200" rx="85" ry="35" 
             fill="#FF9900" opacity="0" 
             filter="url(#glow)"/>
  </g>
  
  <g id="warp-glow-right" class="system-indicator nacelle-glow">
    <ellipse cx="850" cy="200" rx="85" ry="35" 
             fill="#FF9900" opacity="0"
             filter="url(#glow)"/>
  </g>
  
  <!-- Damage overlays (initially hidden) -->
  <g id="damage-overlays" class="system-indicator">
    <rect id="damage-saucer" x="480" y="180" width="40" height="40" 
          fill="#CC0000" opacity="0" class="damage-indicator"/>
    <rect id="damage-engineering" x="480" y="400" width="40" height="40" 
          fill="#CC0000" opacity="0" class="damage-indicator"/>
    <rect id="damage-nacelle-left" x="130" y="185" width="40" height="30" 
          fill="#CC0000" opacity="0" class="damage-indicator"/>
    <rect id="damage-nacelle-right" x="830" y="185" width="40" height="30" 
          fill="#CC0000" opacity="0" class="damage-indicator"/>
  </g>
  
  <!-- Filters -->
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
</svg>
```

### D.2.3 RulesEngine Enhancement: SVG Element Targeting

**New `svg_elements` target in rules:**

```yaml
msd:
  base_svg: "/local/ships/galaxy-class.svg"
  
  overlays:
    # Regular overlays
    - id: hull_integrity_display
      type: text
      content: "HULL INTEGRITY: {hull_integrity}%"
      position: [50, 50]
  
  rules:
    # Normal operation - ship blueprint standard colors
    - id: normal_ship_status
      when:
        all:
          - entity: input_select.ship_alert_status
            state: "normal"
      then:
        svg_elements:
          class:hull-section:  # All hull sections
            fill: "#666666"
            opacity: 1.0
          
          id:shield-indicators:  # Shield indicators off
            opacity: 0
    
    # Red alert - ship turns red
    - id: red_alert_ship
      when:
        all:
          - entity: input_select.ship_alert_status
            state: "red_alert"
      then:
        overlays:
          all:
            style:
              color: "colors.alert.critical"
        
        svg_elements:
          class:hull-section:  # All hull sections red
            fill: "colors.alert.critical"
            stroke: "colors.alert.critical"
            stroke-width: 3
    
    # Hull damage - port side
    - id: hull_damage_port
      when:
        all:
          - entity: sensor.hull_integrity_port
            below: 50
      then:
        svg_elements:
          id:warp-nacelle-left:  # Port nacelle damaged
            fill: "colors.status.danger"
            opacity: {
              _computed: (tokens, context) => {
                const integrity = context.getEntity('sensor.hull_integrity_port')?.state || 100;
                return Math.max(0.3, parseInt(integrity) / 100);
              }
            }
          
          id:damage-nacelle-left:  # Show damage indicator
            opacity: {
              _computed: (tokens, context) => {
                const integrity = context.getEntity('sensor.hull_integrity_port')?.state || 100;
                return Math.max(0, (50 - parseInt(integrity)) / 50);
              }
            }
    
    # Shields active
    - id: shields_active
      when:
        all:
          - entity: switch.shields
            state: "on"
      then:
        svg_elements:
          id:shield-indicators:  # Show shield emitters
            opacity: 0.8
          
          class:shield-emitter:  # Blue glow
            fill: "colors.status.info"
    
    # Warp drive active
    - id: warp_drive_active
      when:
        all:
          - entity: sensor.warp_speed
            above: 0
      then:
        svg_elements:
          class:nacelle:  # Nacelles glow orange
            fill: "colors.accent.primaryLight"
          
          class:nacelle-glow:  # Show warp glow
            opacity: {
              _computed: (tokens, context) => {
                const warpSpeed = context.getEntity('sensor.warp_speed')?.state || 0;
                return Math.min(0.8, parseFloat(warpSpeed) / 9);
              }
            }
```

### D.2.4 Implementation: SvgElementController

```javascript
// src/msd/svg/SvgElementController.js

/**
 * @fileoverview SvgElementController - Controls SVG base layer elements via rules
 * 
 * Enables dynamic styling of ship blueprint based on system state.
 * Integrates with RulesEngine for reactive SVG manipulation.
 * 
 * @module msd/svg/SvgElementController
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';

/**
 * SvgElementController - Controls SVG base layer elements via rules
 * 
 * Provides reactive control over SVG elements in the base ship blueprint.
 * Supports targeting by ID, class, tag, and CSS selectors.
 */
export class SvgElementController {
  /**
   * Create an SvgElementController
   * 
   * @param {Element} svgContainer - SVG container element
   * @param {ShadowRoot} shadowRoot - Shadow root context
   */
  constructor(svgContainer, shadowRoot) {
    this.svgContainer = svgContainer;
    this.shadowRoot = shadowRoot;
    this.trackedElements = new Map();  // elementId -> element
    this.elementCache = new Map();     // selector -> Set(elements)
    this.initialized = false;
  }
  
  /**
   * Initialize and index SVG elements for fast lookup
   * 
   * Scans the base SVG and builds lookup maps for ID and class-based targeting.
   * Should be called after base_svg is injected.
   */
  indexSvgElements() {
    const svg = this.svgContainer.querySelector('svg');
    if (!svg) {
      cblcarsLog.warn('[SvgElementController] No SVG found to index');
      return;
    }
    
    // Clear existing indexes
    this.trackedElements.clear();
    this.elementCache.clear();
    
    // Index by ID
    const elementsWithId = svg.querySelectorAll('[id]');
    elementsWithId.forEach(el => {
      this.trackedElements.set(el.id, el);
      cblcarsLog.debug(`[SvgElementController] Indexed element by ID: ${el.id}`);
    });
    
    // Index by class
    const elementsWithClass = svg.querySelectorAll('[class]');
    elementsWithClass.forEach(el => {
      el.classList.forEach(className => {
        const cacheKey = `class:${className}`;
        if (!this.elementCache.has(cacheKey)) {
          this.elementCache.set(cacheKey, new Set());
        }
        this.elementCache.get(cacheKey).add(el);
      });
    });
    
    this.initialized = true;
    
    cblcarsLog.debug('[SvgElementController] Indexed SVG elements:', {
      byId: this.trackedElements.size,
      classKeys: this.elementCache.size,
      totalElements: elementsWithId.length + elementsWithClass.length
    });
  }
  
  /**
   * Resolve SVG element selector to actual elements
   * 
   * Supports multiple selector formats:
   * - id:element-id - Target by ID
   * - class:class-name - Target by class
   * - tag:tag-name - Target by tag name
   * - selector:css-selector - Target by CSS selector
   * 
   * @param {string} selector - Selector string
   * @returns {Array<Element>} Array of matching SVG elements
   */
  resolveSvgElements(selector) {
    if (!this.initialized) {
      cblcarsLog.warn('[SvgElementController] Not initialized, call indexSvgElements() first');
      return [];
    }
    
    const elements = new Set();
    const svg = this.svgContainer.querySelector('svg');
    if (!svg) return [];
    
    // By ID: id:element-id
    if (selector.startsWith('id:')) {
      const id = selector.substring(3);
      const el = this.trackedElements.get(id);
      if (el) {
        elements.add(el);
      } else {
        cblcarsLog.warn(`[SvgElementController] SVG element not found: ${id}`);
      }
    }
    
    // By class: class:class-name
    else if (selector.startsWith('class:')) {
      const className = selector.substring(6);
      const cached = this.elementCache.get(selector);
      if (cached) {
        cached.forEach(el => elements.add(el));
      } else {
        cblcarsLog.warn(`[SvgElementController] No elements with class: ${className}`);
      }
    }
    
    // By tag: tag:tag-name
    else if (selector.startsWith('tag:')) {
      const tagName = selector.substring(4);
      const matches = svg.querySelectorAll(tagName);
      matches.forEach(el => elements.add(el));
    }
    
    // By CSS selector: selector:css-selector
    else if (selector.startsWith('selector:')) {
      const cssSelector = selector.substring(9);
      try {
        const matches = svg.querySelectorAll(cssSelector);
        matches.forEach(el => elements.add(el));
      } catch (error) {
        cblcarsLog.error(`[SvgElementController] Invalid CSS selector: ${cssSelector}`, error);
      }
    }
    
    // Direct ID (legacy support)
    else {
      const el = this.trackedElements.get(selector);
      if (el) elements.add(el);
    }
    
    return Array.from(elements);
  }
  
  /**
   * Apply style patch to SVG elements
   * 
   * Applies attribute changes to matched SVG elements.
   * Supports token resolution and computed values.
   * 
   * @param {string} selector - Element selector
   * @param {Object} patch - Attribute patches to apply
   * @param {Object} [context={}] - Resolution context for computed values
   */
  applySvgPatch(selector, patch, context = {}) {
    const elements = this.resolveSvgElements(selector);
    
    if (elements.length === 0) {
      cblcarsLog.warn(`[SvgElementController] No elements matched selector: ${selector}`);
      return;
    }
    
    elements.forEach(el => {
      Object.entries(patch).forEach(([attr, value]) => {
        // Resolve tokens and computed values
        const resolvedValue = this._resolveValue(value, context);
        
        // Special handling for opacity (can be number or string)
        if (attr === 'opacity') {
          el.setAttribute('opacity', resolvedValue);
        }
        // Special handling for fill/stroke colors
        else if (attr === 'fill' || attr === 'stroke') {
          el.setAttribute(attr, resolvedValue);
        }
        // Other SVG attributes
        else {
          el.setAttribute(attr, resolvedValue);
        }
      });
    });
    
    cblcarsLog.debug('[SvgElementController] Applied patch:', {
      selector,
      elementCount: elements.length,
      attributes: Object.keys(patch)
    });
  }
  
  /**
   * Resolve token/computed value
   * 
   * Handles:
   * - Token references (colors.accent.primary)
   * - Computed functions ({ _computed: (tokens, context) => {...} })
   * - Direct values (strings, numbers)
   * 
   * @private
   * @param {*} value - Value to resolve
   * @param {Object} context - Resolution context
   * @returns {*} Resolved value
   */
  _resolveValue(value, context) {
    // Token reference
    if (typeof value === 'string' && value.startsWith('colors.')) {
      return themeTokenResolver.resolve(value, value, context);
    }
    
    // Computed value
    if (value && typeof value === 'object' && value._computed) {
      try {
        // Create enhanced context with entity access
        const enhancedContext = {
          ...context,
          getEntity: (entityId) => {
            // Access entity from context or dataSourceManager
            return context.dataSourceManager?.getEntity(entityId);
          }
        };
        
        return value._computed(themeTokenResolver.tokens, enhancedContext);
      } catch (error) {
        cblcarsLog.error('[SvgElementController] Computed value failed:', error);
        return null;
      }
    }
    
    // Direct value
    return value;
  }
  
  /**
   * Reset SVG elements to default state
   * 
   * Clears all dynamic styling applied by rules.
   * Useful for clearing alert states.
   */
  resetAll() {
    const svg = this.svgContainer.querySelector('svg');
    if (!svg) return;
    
    // Reset all tracked elements to their original state
    this.trackedElements.forEach((el, id) => {
      // Remove inline styles added by patches
      el.removeAttribute('style');
      
      // Could store original attributes and restore them here
      // For now, rely on CSS classes for defaults
    });
    
    cblcarsLog.debug('[SvgElementController] Reset all SVG elements');
  }
  
  /**
   * Get element by ID
   * 
   * @param {string} id - Element ID
   * @returns {Element|null} SVG element or null
   */
  getElementById(id) {
    return this.trackedElements.get(id) || null;
  }
  
  /**
   * Get elements by class
   * 
   * @param {string} className - Class name
   * @returns {Array<Element>} Array of SVG elements
   */
  getElementsByClass(className) {
    const cacheKey = `class:${className}`;
    const cached = this.elementCache.get(cacheKey);
    return cached ? Array.from(cached) : [];
  }
  
  /**
   * Check if element exists
   * 
   * @param {string} selector - Element selector
   * @returns {boolean} True if element(s) exist
   */
  hasElement(selector) {
    return this.resolveSvgElements(selector).length > 0;
  }
}
```

### D.2.5 RulesEngine Integration

**Enhance RulesEngine to support SVG element patches:**

```javascript
// src/msd/rules/RulesEngine.js (enhancement)

export class RulesEngine {
  constructor(rules, dataSourceManager, svgElementController = null) {
    this.rules = rules || [];
    this.dataSourceManager = dataSourceManager;
    this.svgElementController = svgElementController;  // NEW
    this.dirtyRules = new Set();
    // ... existing code
  }
  
  /**
   * Set SVG element controller
   * 
   * @param {SvgElementController} controller - SVG element controller
   */
  setSvgElementController(controller) {
    this.svgElementController = controller;
    cblcarsLog.debug('[RulesEngine] SVG element controller registered');
  }
  
  /**
   * Evaluate rules and apply patches (enhanced with SVG support)
   */
  evaluateDirty() {
    const results = {
      overlayPatches: [],
      svgElementPatches: [],  // NEW
      profilesAdd: [],
      profilesRemove: []
    };
    
    // Get all overlays from resolved model
    const allOverlays = this.getResolvedModel()?.overlays || [];
    
    // Evaluate each rule
    this.rules.forEach(rule => {
      if (this._evaluateRule(rule)) {
        // Apply overlay patches
        if (rule.then.overlays) {
          const patches = this._applyOverlayPatches(rule.then, allOverlays);
          results.overlayPatches.push(...patches);
        }
        
        // NEW: Apply SVG element patches
        if (rule.then.svg_elements && this.svgElementController) {
          const svgPatches = this._applySvgElementPatches(rule.then.svg_elements);
          results.svgElementPatches.push(...svgPatches);
        }
        
        // Handle profile changes
        if (rule.then.profiles) {
          // ... existing profile logic
        }
      }
    });
    
    return results;
  }
  
  /**
   * Apply SVG element patches from rule
   * 
   * @param {Object} svgElementConfig - SVG element patch configuration
   * @returns {Array<Object>} Array of SVG patches
   * @private
   */
  _applySvgElementPatches(svgElementConfig) {
    const patches = [];
    
    if (!this.svgElementController) {
      cblcarsLog.warn('[RulesEngine] No SVG element controller available');
      return patches;
    }
    
    // Create context for computed values
    const context = {
      dataSourceManager: this.dataSourceManager,
      viewBox: this.getResolvedModel()?.viewBox
    };
    
    // Process each selector
    for (const [selector, patch] of Object.entries(svgElementConfig)) {
      // Apply patch immediately
      this.svgElementController.applySvgPatch(selector, patch, context);
      
      // Store for tracking
      patches.push({
        selector,
        patch
      });
    }
    
    return patches;
  }
}
```

### D.2.6 SystemsManager Integration

**Initialize SvgElementController in pipeline:**

```javascript
// src/msd/pipeline/SystemsManager.js (enhancement)

import { SvgElementController } from '../svg/SvgElementController.js';

export class SystemsManager {
  constructor() {
    // ... existing properties
    this.svgElementController = null;  // NEW
  }
  
  async initializeSystemsWithPacksFirst(mergedConfig, mountEl, hass) {
    // ... existing initialization
    
    // NEW: Initialize SVG element controller after base_svg is loaded
    if (mergedConfig.base_svg) {
      cblcarsLog.debug('[SystemsManager] Initializing SVG element controller');
      this.svgElementController = new SvgElementController(
        mountEl,  // SVG container
        mountEl   // Shadow root
      );
    }
  }
  
  async completeSystems(mergedConfig, cardModel, mountEl, hass) {
    // ... existing code
    
    // NEW: Index SVG elements after injection
    if (this.svgElementController && mergedConfig.base_svg) {
      // Wait for SVG to be injected by renderer
      setTimeout(() => {
        this.svgElementController.indexSvgElements();
        
        // Connect to RulesEngine
        if (this.rulesEngine) {
          this.rulesEngine.setSvgElementController(this.svgElementController);
          cblcarsLog.debug('[SystemsManager] SVG controller connected to RulesEngine');
        }
      }, 100);
    }
  }
}
```

### D.2.7 Benefits

**LCARS Authenticity:**
- ✅ Hull damage visualization (canonical Star Trek)
- ✅ System status on blueprint
- ✅ Shield visualization
- ✅ Warp nacelle glow effects

**Technical:**
- ✅ Leverages existing RulesEngine
- ✅ Same selector patterns as overlays
- ✅ Token system integration
- ✅ Computed value support

**User Experience:**
- ✅ Real-time ship status visualization
- ✅ Dramatic alert effects on ship
- ✅ Intuitive damage displays
- ✅ Professional polish

---

## D.3 Feature 2: Multi-Layer System

### D.3.1 Concept

**Goal:** Organize MSD rendering into discrete visual layers with independent control.

**Current State:** Limited layering (base_svg + overlays + controls + debug)

**Proposed Enhancement:** Full layer stack with background, decorative, and effects layers.

### D.3.2 Enhanced Layer Architecture

```
Layer 0: Background
  ├─ Purpose: Atmospheric visuals
  ├─ Content: Space, nebula, starfield
  ├─ Properties: Static or animated, parallax
  └─ Z-Index: 0

Layer 1: Base SVG (Ship Blueprint)
  ├─ Purpose: Ship schematic
  ├─ Content: Reactive SVG (Feature 1)
  ├─ Properties: Rules-driven styling
  └─ Z-Index: 10

Layer 2: Decorative
  ├─ Purpose: LCARS UI elements
  ├─ Content: Frames, elbows, panels, grids
  ├─ Properties: SVG-based, token colors
  └─ Z-Index: 20

Layer 3: Overlays (Data Visualization)
  ├─ Purpose: Display data
  ├─ Content: Charts, text, lines, grids
  ├─ Properties: Existing overlay system
  └─ Z-Index: 30

Layer 4: Controls (Interaction)
  ├─ Purpose: User interaction
  ├─ Content: HA cards, buttons
  ├─ Properties: foreignObject, custom-button-card
  └─ Z-Index: 40

Layer 5: Effects
  ├─ Purpose: Screen effects
  ├─ Content: Scanlines, vignette, glitch
  ├─ Properties: SVG filters, CSS effects
  └─ Z-Index: 50

Layer 6: Debug
  ├─ Purpose: Development tools
  ├─ Content: Anchors, bounding boxes, routing
  ├─ Properties: Optional, debug mode only
  └─ Z-Index: 60
```

### D.3.3 YAML Configuration

```yaml
type: custom:cb-lcars-msd
pack: tng
theme: lcars-classic

msd:
  # Layer 0: Background
  background:
    enabled: true
    type: "animated"  # "static", "animated", "parallax"
    source: "/local/backgrounds/space-nebula.svg"
    animation:
      preset: "slow_drift"
      duration: 60000
      loop: true
    effects:
      blur: 2
      opacity: 0.3
  
  # Layer 1: Base SVG (existing, enhanced with reactive features)
  base_svg: "/local/ships/galaxy-class.svg"
  
  # Layer 2: Decorative LCARS elements
  decorative:
    enabled: true
    elements:
      # Top frame bar
      - id: top_frame
        type: "lcars-frame"
        preset: "tng-top"
        position: [0, 0]
        size: [1000, 40]
        color: "colors.accent.primary"
        
      # Left corner elbow
      - id: left_elbow
        type: "lcars-elbow"
        preset: "tng-rounded"
        position: [0, 40]
        size: [80, 120]
        corner: "top-left"
        color: "colors.accent.secondary"
        thickness: 20
        
      # Right corner elbow
      - id: right_elbow
        type: "lcars-elbow"
        preset: "tng-rounded"
        position: [920, 40]
        size: [80, 120]
        corner: "top-right"
        color: "colors.accent.secondary"
        thickness: 20
        
      # Bottom frame bar
      - id: bottom_frame
        type: "lcars-frame"
        preset: "tng-bottom"
        position: [0, 560]
        size: [1000, 40]
        color: "colors.accent.tertiary"
        
      # Grid overlay
      - id: grid_overlay
        type: "grid"
        enabled: true
        spacing: 20
        color: "colors.ui.border"
        opacity: 0.1
        style: "dots"  # "lines", "dots", "crosshairs"
  
  # Layer 3: Overlays (existing)
  overlays:
    - id: temp_chart
      type: apexchart
      source: temperature
      position: [100, 100]
      size: [300, 150]
    # ... more overlays
  
  # Layer 4: Controls (existing)
  # ... controls configuration
  
  # Layer 5: Effects
  effects:
    enabled: true
    elements:
      # Scanlines effect
      - id: scanlines
        type: "scanline"
        enabled: true
        intensity: 0.05
        speed: 2000
        direction: "vertical"  # "horizontal", "vertical"
        
      # Vignette effect
      - id: vignette
        type: "vignette"
        enabled: true
        intensity: 0.3
        color: "#000000"
        
      # Optional: Screen glitch (for alerts)
      - id: glitch
        type: "glitch"
        enabled: false  # Enable via rules
        intensity: 0.5
  
  # Layer 6: Debug (existing)
  debug:
    overlays:
      anchors: false
      bounding_boxes: false
```

### D.3.4 Implementation: LayerManager

```javascript
// src/msd/layers/LayerManager.js

/**
 * @fileoverview LayerManager - Manages MSD rendering layers
 * 
 * Coordinates multiple visual layers with proper z-indexing and rendering order.
 * Handles background, decorative, and effects layers.
 * 
 * @module msd/layers/LayerManager
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';

/**
 * LayerManager - Manages MSD rendering layers
 * 
 * Provides organized layer system for MSD visual elements.
 * Ensures proper z-ordering and independent layer control.
 */
export class LayerManager {
  /**
   * Create a LayerManager
   * 
   * @param {Element} mountElement - SVG mount element
   * @param {ShadowRoot} shadowRoot - Shadow root context
   */
  constructor(mountElement, shadowRoot) {
    this.mountElement = mountElement;
    this.shadowRoot = shadowRoot;
    this.layers = new Map();
    
    // Z-index mapping for layers
    this.zIndex = {
      background: 0,
      baseSvg: 10,
      decorative: 20,
      overlays: 30,
      controls: 40,
      effects: 50,
      debug: 60
    };
    
    this.initialized = false;
  }
  
  /**
   * Initialize all layers from configuration
   * 
   * @param {Object} config - MSD configuration
   */
  async initializeLayers(config) {
    cblcarsLog.debug('[LayerManager] Initializing layers');
    
    // Layer 0: Background
    if (config.background && config.background.enabled !== false) {
      await this._initBackgroundLayer(config.background);
    }
    
    // Layer 1: Base SVG handled by AdvancedRenderer
    // (reactive features handled by SvgElementController)
    
    // Layer 2: Decorative
    if (config.decorative && config.decorative.enabled !== false) {
      await this._initDecorativeLayer(config.decorative);
    }
    
    // Layer 3-4: Overlays and Controls handled by existing renderers
    
    // Layer 5: Effects
    if (config.effects && config.effects.enabled !== false) {
      await this._initEffectsLayer(config.effects);
    }
    
    // Layer 6: Debug handled by DebugRenderer
    
    this.initialized = true;
    cblcarsLog.debug('[LayerManager] Layers initialized:', {
      layers: Array.from(this.layers.keys())
    });
  }
  
  /**
   * Initialize background layer
   * 
   * @private
   * @param {Object} bgConfig - Background configuration
   */
  async _initBackgroundLayer(bgConfig) {
    const bgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    bgLayer.id = 'msd-background-layer';
    bgLayer.setAttribute('data-layer', 'background');
    bgLayer.style.zIndex = this.zIndex.background;
    
    if (bgConfig.type === 'static') {
      await this._createStaticBackground(bgLayer, bgConfig);
    } else if (bgConfig.type === 'animated') {
      await this._createAnimatedBackground(bgLayer, bgConfig);
    } else if (bgConfig.type === 'parallax') {
      await this._createParallaxBackground(bgLayer, bgConfig);
    }
    
    this.layers.set('background', bgLayer);
    this.mountElement.insertBefore(bgLayer, this.mountElement.firstChild);
    
    cblcarsLog.debug('[LayerManager] Background layer created:', bgConfig.type);
  }
  
  /**
   * Create static background
   * 
   * @private
   * @param {Element} container - Container element
   * @param {Object} config - Background configuration
   */
  async _createStaticBackground(container, config) {
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('href', config.source);
    image.setAttribute('width', '100%');
    image.setAttribute('height', '100%');
    image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    
    // Apply effects
    if (config.effects) {
      if (config.effects.opacity !== undefined) {
        image.style.opacity = config.effects.opacity;
      }
      if (config.effects.blur) {
        image.style.filter = `blur(${config.effects.blur}px)`;
      }
    }
    
    container.appendChild(image);
  }
  
  /**
   * Create animated background
   * 
   * @private
   * @param {Element} container - Container element
   * @param {Object} config - Background configuration
   */
  async _createAnimatedBackground(container, config) {
    try {
      // Load background SVG/image
      const response = await fetch(config.source);
      const content = await response.text();
      
      const parser = new DOMParser();
      const bgDoc = parser.parseFromString(content, 'image/svg+xml');
      const bgElement = bgDoc.documentElement;
      
      // Apply effects
      if (config.effects) {
        if (config.effects.opacity !== undefined) {
          bgElement.style.opacity = config.effects.opacity;
        }
        if (config.effects.blur) {
          bgElement.style.filter = `blur(${config.effects.blur}px)`;
        }
      }
      
      container.appendChild(bgElement);
      
      // Apply animation (future: use Anime.js)
      if (config.animation) {
        this._animateBackground(bgElement, config.animation);
      }
    } catch (error) {
      cblcarsLog.error('[LayerManager] Failed to load animated background:', error);
    }
  }
  
  /**
   * Animate background element
   * 
   * @private
   * @param {Element} element - Element to animate
   * @param {Object} animConfig - Animation configuration
   */
  _animateBackground(element, animConfig) {
    const preset = animConfig.preset;
    
    if (preset === 'slow_drift') {
      // Simple CSS animation for now
      // Future: Use Anime.js v4
      element.style.animation = `drift ${animConfig.duration || 60000}ms linear infinite`;
      
      // Add keyframes if not exists
      if (!this.shadowRoot.querySelector('#drift-keyframes')) {
        const style = document.createElement('style');
        style.id = 'drift-keyframes';
        style.textContent = `
          @keyframes drift {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(-100px, -50px); }
          }
        `;
        this.shadowRoot.appendChild(style);
      }
    }
    
    // TODO: Integrate with Anime.js v4 when animation system is ready
  }
  
  /**
   * Create parallax background (future enhancement)
   * 
   * @private
   * @param {Element} container - Container element
   * @param {Object} config - Background configuration
   */
  async _createParallaxBackground(container, config) {
    cblcarsLog.warn('[LayerManager] Parallax backgrounds not yet implemented');
    // Fallback to static
    await this._createStaticBackground(container, config);
  }
  
  /**
   * Initialize decorative layer
   * 
   * @private
   * @param {Object} decorConfig - Decorative configuration
   */
  async _initDecorativeLayer(decorConfig) {
    const decorLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    decorLayer.id = 'msd-decorative-layer';
    decorLayer.setAttribute('data-layer', 'decorative');
    decorLayer.style.zIndex = this.zIndex.decorative;
    
    const elements = decorConfig.elements || [];
    
    for (const elementConfig of elements) {
      try {
        const element = await this._createDecorativeElement(elementConfig);
        if (element) {
          decorLayer.appendChild(element);
        }
      } catch (error) {
        cblcarsLog.error('[LayerManager] Failed to create decorative element:', elementConfig.id, error);
      }
    }
    
    this.layers.set('decorative', decorLayer);
    
    // Insert before overlays layer (z-index 30)
    const overlaysLayer = this.mountElement.querySelector('[data-layer="overlays"]');
    if (overlaysLayer) {
      this.mountElement.insertBefore(decorLayer, overlaysLayer);
    } else {
      this.mountElement.appendChild(decorLayer);
    }
    
    cblcarsLog.debug('[LayerManager] Decorative layer created:', elements.length, 'elements');
  }
  
  /**
   * Create individual decorative element
   * 
   * @private
   * @param {Object} config - Element configuration
   * @returns {Promise<Element|null>} SVG element or null
   */
  async _createDecorativeElement(config) {
    switch (config.type) {
      case 'lcars-frame':
        return this._createLcarsFrame(config);
      case 'lcars-elbow':
        return this._createLcarsElbow(config);
      case 'grid':
        return this._createGridOverlay(config);
      default:
        cblcarsLog.warn('[LayerManager] Unknown decorative type:', config.type);
        return null;
    }
  }
  
  /**
   * Create LCARS frame element
   * 
   * @private
   * @param {Object} config - Frame configuration
   * @returns {Element} SVG group element
   */
  _createLcarsFrame(config) {
    const [x, y] = config.position;
    const [width, height] = config.size;
    const color = themeTokenResolver.resolve(config.color, '#FF9900');
    
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = config.id;
    group.setAttribute('class', 'lcars-frame');
    
    // TNG-style frame with rounded caps
    const frame = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    frame.setAttribute('x', x);
    frame.setAttribute('y', y);
    frame.setAttribute('width', width);
    frame.setAttribute('height', height);
    frame.setAttribute('fill', color);
    frame.setAttribute('rx', height / 2);  // Rounded ends (LCARS style)
    
    group.appendChild(frame);
    return group;
  }
  
  /**
   * Create LCARS elbow (rounded corner)
   * 
   * @private
   * @param {Object} config - Elbow configuration
   * @returns {Element} SVG group element
   */
  _createLcarsElbow(config) {
    const [x, y] = config.position;
    const [width, height] = config.size;
    const color = themeTokenResolver.resolve(config.color, '#9999FF');
    const thickness = config.thickness || 20;
    
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = config.id;
    group.setAttribute('class', 'lcars-elbow');
    
    // Generate elbow path based on corner type
    let path;
    const radius = 30;  // LCARS-style rounded corner
    
    switch (config.corner) {
      case 'top-left':
        path = `M ${x + width} ${y + thickness/2} 
                L ${x + radius + thickness/2} ${y + thickness/2} 
                Q ${x + thickness/2} ${y + thickness/2} ${x + thickness/2} ${y + radius + thickness/2} 
                L ${x + thickness/2} ${y + height}`;
        break;
      
      case 'top-right':
        path = `M ${x} ${y + thickness/2}
                L ${x + width - radius - thickness/2} ${y + thickness/2}
                Q ${x + width - thickness/2} ${y + thickness/2} ${x + width - thickness/2} ${y + radius + thickness/2}
                L ${x + width - thickness/2} ${y + height}`;
        break;
      
      case 'bottom-left':
        path = `M ${x + thickness/2} ${y}
                L ${x + thickness/2} ${y + height - radius - thickness/2}
                Q ${x + thickness/2} ${y + height - thickness/2} ${x + radius + thickness/2} ${y + height - thickness/2}
                L ${x + width} ${y + height - thickness/2}`;
        break;
      
      case 'bottom-right':
        path = `M ${x + width - thickness/2} ${y}
                L ${x + width - thickness/2} ${y + height - radius - thickness/2}
                Q ${x + width - thickness/2} ${y + height - thickness/2} ${x + width - radius - thickness/2} ${y + height - thickness/2}
                L ${x} ${y + height - thickness/2}`;
        break;
      
      default:
        cblcarsLog.warn('[LayerManager] Unknown elbow corner:', config.corner);
        return group;
    }
    
    const elbow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    elbow.setAttribute('d', path);
    elbow.setAttribute('stroke', color);
    elbow.setAttribute('stroke-width', thickness);
    elbow.setAttribute('fill', 'none');
    elbow.setAttribute('stroke-linecap', 'round');
    elbow.setAttribute('stroke-linejoin', 'round');
    
    group.appendChild(elbow);
    return group;
  }
  
  /**
   * Create grid overlay
   * 
   * @private
   * @param {Object} config - Grid configuration
   * @returns {Element} SVG group element
   */
  _createGridOverlay(config) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = config.id || 'grid-overlay';
    group.setAttribute('class', 'grid-overlay');
    
    const spacing = config.spacing || 20;
    const color = themeTokenResolver.resolve(config.color, '#999999');
    const opacity = config.opacity || 0.1;
    const style = config.style || 'lines';
    
    // Get viewBox dimensions from parent SVG
    const svg = this.mountElement.querySelector('svg');
    if (!svg || !svg.viewBox.baseVal) {
      cblcarsLog.warn('[LayerManager] No SVG viewBox found for grid');
      return group;
    }
    
    const viewBox = svg.viewBox.baseVal;
    const width = viewBox.width;
    const height = viewBox.height;
    
    if (style === 'lines' || style === 'crosshairs') {
      // Vertical lines
      for (let x = 0; x <= width; x += spacing) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x);
        line.setAttribute('y1', 0);
        line.setAttribute('x2', x);
        line.setAttribute('y2', height);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', 0.5);
        line.setAttribute('opacity', opacity);
        group.appendChild(line);
      }
      
      // Horizontal lines
      for (let y = 0; y <= height; y += spacing) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('y1', y);
        line.setAttribute('x2', width);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', 0.5);
        line.setAttribute('opacity', opacity);
        group.appendChild(line);
      }
    } else if (style === 'dots') {
      // Dot grid
      for (let x = 0; x <= width; x += spacing) {
        for (let y = 0; y <= height; y += spacing) {
          const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('cx', x);
          dot.setAttribute('cy', y);
          dot.setAttribute('r', 1);
          dot.setAttribute('fill', color);
          dot.setAttribute('opacity', opacity);
          group.appendChild(dot);
        }
      }
    }
    
    return group;
  }
  
  /**
   * Initialize effects layer
   * 
   * @private
   * @param {Object} effectsConfig - Effects configuration
   */
  async _initEffectsLayer(effectsConfig) {
    const effectsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    effectsLayer.id = 'msd-effects-layer';
    effectsLayer.setAttribute('data-layer', 'effects');
    effectsLayer.style.zIndex = this.zIndex.effects;
    effectsLayer.style.pointerEvents = 'none';  // Don't block interactions
    
    const elements = effectsConfig.elements || [];
    
    for (const effectConfig of elements) {
      if (effectConfig.enabled !== false) {
        try {
          const effect = await this._createEffect(effectConfig);
          if (effect) {
            effectsLayer.appendChild(effect);
          }
        } catch (error) {
          cblcarsLog.error('[LayerManager] Failed to create effect:', effectConfig.id, error);
        }
      }
    }
    
    this.layers.set('effects', effectsLayer);
    this.mountElement.appendChild(effectsLayer);
    
    cblcarsLog.debug('[LayerManager] Effects layer created:', elements.length, 'effects');
  }
  
  /**
   * Create visual effect
   * 
   * @private
   * @param {Object} config - Effect configuration
   * @returns {Promise<Element|null>} SVG element or null
   */
  async _createEffect(config) {
    switch (config.type) {
      case 'scanline':
        return this._createScanlineEffect(config);
      case 'vignette':
        return this._createVignetteEffect(config);
      case 'glitch':
        return this._createGlitchEffect(config);
      default:
        cblcarsLog.warn('[LayerManager] Unknown effect type:', config.type);
        return null;
    }
  }
  
  /**
   * Create scanline effect
   * 
   * @private
   * @param {Object} config - Scanline configuration
   * @returns {Element} SVG group element
   */
  _createScanlineEffect(config) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = config.id;
    group.setAttribute('class', 'scanline-effect');
    
    // Get viewBox dimensions
    const svg = this.mountElement.querySelector('svg');
    if (!svg || !svg.viewBox.baseVal) return group;
    
    const viewBox = svg.viewBox.baseVal;
    const width = viewBox.width;
    const height = viewBox.height;
    
    const intensity = config.intensity || 0.05;
    const spacing = config.direction === 'vertical' ? width / 100 : height / 100;
    
    if (config.direction === 'vertical') {
      // Vertical scanlines
      for (let x = 0; x < width; x += spacing) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x);
        line.setAttribute('y1', 0);
        line.setAttribute('x2', x);
        line.setAttribute('y2', height);
        line.setAttribute('stroke', '#000000');
        line.setAttribute('stroke-width', spacing / 2);
        line.setAttribute('opacity', intensity);
        group.appendChild(line);
      }
    } else {
      // Horizontal scanlines (default)
      for (let y = 0; y < height; y += spacing) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('y1', y);
        line.setAttribute('x2', width);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', '#000000');
        line.setAttribute('stroke-width', spacing / 2);
        line.setAttribute('opacity', intensity);
        group.appendChild(line);
      }
    }
    
    // TODO: Add animation with Anime.js v4
    
    return group;
  }
  
  /**
   * Create vignette effect
   * 
   * @private
   * @param {Object} config - Vignette configuration
   * @returns {Element} SVG radial gradient
   */
  _createVignetteEffect(config) {
    // Get viewBox dimensions
    const svg = this.mountElement.querySelector('svg');
    if (!svg || !svg.viewBox.baseVal) return null;
    
    const viewBox = svg.viewBox.baseVal;
    const width = viewBox.width;
    const height = viewBox.height;
    
    const intensity = config.intensity || 0.3;
    const color = config.color || '#000000';
    
    // Create gradient definition
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }
    
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    gradient.id = config.id || 'vignette-gradient';
    gradient.setAttribute('cx', '50%');
    gradient.setAttribute('cy', '50%');
    gradient.setAttribute('r', '70%');
    
    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', color);
    stop1.setAttribute('stop-opacity', '0');
    
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', color);
    stop2.setAttribute('stop-opacity', intensity);
    
    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    
    // Create vignette rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', 0);
    rect.setAttribute('y', 0);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('fill', `url(#${gradient.id})`);
    rect.style.pointerEvents = 'none';
    
    return rect;
  }
  
  /**
   * Create glitch effect (placeholder for future implementation)
   * 
   * @private
   * @param {Object} config - Glitch configuration
   * @returns {Element|null} SVG element or null
   */
  _createGlitchEffect(config) {
    cblcarsLog.warn('[LayerManager] Glitch effects not yet implemented');
    // TODO: Implement with SVG filters and Anime.js v4
    return null;
  }
  
  /**
   * Get layer by name
   * 
   * @param {string} layerName - Layer name
   * @returns {Element|null} Layer element or null
   */
  getLayer(layerName) {
    return this.layers.get(layerName) || null;
  }
  
  /**
   * Show/hide layer
   * 
   * @param {string} layerName - Layer name
   * @param {boolean} visible - Visibility state
   */
  setLayerVisibility(layerName, visible) {
    const layer = this.layers.get(layerName);
    if (layer) {
      layer.style.display = visible ? 'block' : 'none';
      cblcarsLog.debug(`[LayerManager] Layer ${layerName} visibility:`, visible);
    }
  }
  
  /**
   * Remove all layers
   */
  destroy() {
    this.layers.forEach((layer, name) => {
      if (layer.parentNode) {
        layer.parentNode.removeChild(layer);
      }
    });
    this.layers.clear();
    this.initialized = false;
    
    cblcarsLog.debug('[LayerManager] All layers destroyed');
  }
}
```

### D.3.5 Integration with MsdPipeline

```javascript
// src/msd/pipeline/MsdPipeline.js (enhancement)

import { LayerManager } from '../layers/LayerManager.js';

export class MsdPipeline {
  constructor() {
    // ... existing properties
    this.layerManager = null;  // NEW
  }
  
  async render(userConfig, hass, mountEl) {
    // ... existing code
    
    // NEW: Initialize LayerManager early
    this.layerManager = new LayerManager(mountEl, mountEl);
    
    // ... merge config, build model, etc.
    
    // NEW: Initialize layers after model is built
    await this.layerManager.initializeLayers(mergedConfig);
    
    // Continue with normal rendering...
  }
}
```

### D.3.6 Benefits

**Visual Richness:**
- ✅ Professional LCARS aesthetic with frames/elbows
- ✅ Atmospheric backgrounds
- ✅ Screen effects for polish

**Organization:**
- ✅ Clear separation of concerns
- ✅ Independent layer control
- ✅ Easy to enable/disable features

**Performance:**
- ✅ Layers can be optimized independently
- ✅ Effects are optional
- ✅ Background can be static or animated

---

## D.4 Feature 3: Sound System

### D.4.1 Concept

**Goal:** Authentic LCARS computer sounds for interactions and events.

**Current Limitation:**
- ❌ HA theme sounds only work on top-level elements
- ❌ Shadow DOM isolation prevents event bubbling
- ❌ No programmatic sound triggers
- ❌ No state change audio feedback

**Proposed Enhancement:**
- ✅ Web Audio API-based sound system
- ✅ Preloaded sounds (no latency)
- ✅ Interaction sounds (taps, beeps)
- ✅ Alert sounds (klaxons, warnings)
- ✅ Rule-triggered sounds

### D.4.2 YAML Configuration

```yaml
type: custom:cb-lcars-msd
pack: tng
theme: lcars-classic

msd:
  # Sound system configuration
  sounds:
    enabled: true
    volume: 0.5  # Global volume (0.0 - 1.0)
    
    # Sound library
    library:
      # Interaction sounds
      tap: "/local/sounds/lcars/tap.mp3"
      tap_deny: "/local/sounds/lcars/tap-deny.mp3"
      tap_confirm: "/local/sounds/lcars/tap-confirm.mp3"
      
      # Alert sounds
      alert_red: "/local/sounds/lcars/alert-red.mp3"
      alert_yellow: "/local/sounds/lcars/alert-yellow.mp3"
      