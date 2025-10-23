# CB-LCARS Unified Architecture Plan
**Master Systems Display (MSD) Infrastructure Evolution**

**Document Version:** 1.0  
**Date:** 2025-10-23  
**Status:** Planning & Design  
**Author:** CB-LCARS Development Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Architecture Vision](#architecture-vision)
4. [Global Infrastructure Design](#global-infrastructure-design)
5. [Phase Plan](#phase-plan)
6. [Implementation Details by Phase](#implementation-details-by-phase)
7. [Migration Strategy](#migration-strategy)
8. [Success Criteria](#success-criteria)
9. [Appendices](#appendices)

---

## Executive Summary

### Purpose

This document outlines the architectural evolution of CB-LCARS from a collection of legacy button-card templates to a unified, modular system based on the principles proven in the MSD (Master Systems Display) implementation.

### Core Problems Being Solved

1. **Legacy Card Complexity:** Current cards (multimeter, buttons, etc.) use complicated button-card YAML templates with insane JavaScript for SVG manipulation
2. **Third-Party Dependencies:** Heavy reliance on unmaintained dependencies (e.g., my-slider-v2)
3. **Code Duplication:** Similar functionality reimplemented across multiple card types
4. **Inconsistent Architecture:** MSD uses modern modular patterns, legacy cards use template-based patterns
5. **State Management:** No unified approach to entity state evaluation and styling
6. **Inter-Card Communication:** No standardized way for cards to communicate

### Solution Overview

**Extract MSD infrastructure into shared core system** that all CB-LCARS cards leverage:

- **Shared Core:** SystemsManager, DataSourceManager, RulesEngine, StyleLibrary
- **Modular Components:** Reusable overlays and controls across all card types
- **Unified API:** Consistent interface for all cards (MSD and standalone)
- **Progressive Enhancement:** Simple cards stay simple, advanced features opt-in
- **Zero-Config Defaults:** Lightweight systems initialize automatically, heavy systems lazy-load

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Hybrid Initialization** | Lightweight systems (event bus, animation API) initialize on module load; heavy systems (core, data sources) lazy-load on first card |
| **Shared Components** | Overlays/controls work in both MSD and standalone cards |
| **Rules Engine Everywhere** | Replace button-card state blocks with unified rules system |
| **Native Slider** | Build CB-LCARS native slider using anime.js, remove my-slider-v2 dependency |
| **Optional Core Card** | Recommended but not required infrastructure card for explicit configuration |

---

## Current State Analysis

### Existing Card Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Legacy Cards (Button, Multimeter, Elbow, etc.)          │  │
│  │  ├─ Based on button-card templates                       │  │
│  │  ├─ Complex YAML with embedded JavaScript                │  │
│  │  ├─ State management via button-card state blocks        │  │
│  │  ├─ SVG manipulation via inline JS                       │  │
│  │  ├─ Dependencies: my-slider-v2, custom-button-card       │  │
│  │  └─ No code reuse between card types                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  MSD Card (Modern Architecture)                           │  │
│  │  ├─ Modular pipeline system                              │  │
│  │  ├─ Overlay system (lines, text, sparklines, etc.)       │  │
│  │  ├─ Controls layer (embedded HA cards)                   │  │
│  │  ├─ SystemsManager (entity tracking)                     │  │
│  │  ├─ DataSourceManager (REST, polling)                    │  │
│  │  ├─ Rules engine (state evaluation)                      │  │
│  │  └─ Composition engine (SVG layout)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ⚠️  PROBLEMS:                                                   │
│  • Two completely different architectures                        │
│  • No code sharing between legacy and MSD                        │
│  • MSD infrastructure locked inside MSD card                     │
│  • Legacy cards difficult to maintain/extend                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Legacy Card Issues

#### cb-lcars-multimeter-card

**Current Implementation:**
- 800+ lines of YAML template
- Complex state blocks for each entity state (on/off/heat/cool/zero/non-zero/unavailable)
- Requires my-slider-v2 card (unmaintained third-party dependency)
- Insane inline JavaScript for SVG gauge rendering
- No animation system integration
- Duplicated styling logic across state blocks

**Pain Points:**
- Hard to extend with new slider modes
- Third-party dependency risk
- Performance issues with complex gauge SVG
- Difficult to debug YAML template code

#### cb-lcars-button-card

**Current Implementation:**
- Multiple card type variants (lozenge, pill, rectangle)
- 500+ lines of YAML per variant
- State-based styling via button-card state blocks
- No animation support
- Duplicated code across all button variants

**Pain Points:**
- Adding new button style = copy/paste entire template
- State logic duplicated in every variant
- No consistent animation system
- Hard to maintain consistency across variants

### MSD Strengths to Leverage

The MSD implementation has proven several architectural patterns that should be extracted:

1. **Pipeline Pattern:** Clean separation of concerns (data → processing → rendering)
2. **Modular Overlays:** Reusable rendering components (lines, text, sparklines)
3. **SystemsManager:** Centralized entity state tracking with subscriptions
4. **DataSourceManager:** Unified data fetching (REST, polling, WebSockets)
5. **Rules Engine:** Declarative state evaluation and styling
6. **Controls Layer:** Embedded HA cards with proper HASS forwarding

---

## Architecture Vision

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    TARGET ARCHITECTURE                           │
│              (Unified CB-LCARS Infrastructure)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
            ▼                                   ▼
┌───────────────────────┐         ┌───────────────────────┐
│  IMMEDIATE INIT       │         │  LAZY INIT            │
│  (Module Load)        │         │  (First Card)         │
├───────────────────────┤         ├───────────────────────┤
│ • Event Bus (~5KB)    │         │ • Core System         │
│ • Animation API (~1KB)│         │ • SystemsManager      │
│ • SVG Helpers (~2KB)  │         │ • DataSourceManager   │
│ • Font Loader (<1KB)  │         │ • StyleLibrary        │
│ • Debug API (<1KB)    │         │ • AnimationPresets    │
│                       │         │ • ComponentRegistry   │
│ Total: ~9KB overhead  │         │ Total: ~150KB         │
└───────────────────────┘         └───────────────────────┘
            │                                   │
            │                                   │
            └─────────────────┬─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  CBLCARSCore    │
                    │  (Singleton)    │
                    └─────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
    ┌───────────┐     ┌───────────┐     ┌───────────┐
    │  Button   │     │Multimeter │     │    MSD    │
    │   Card    │     │   Card    │     │   Card    │
    └───────────┘     └───────────┘     └───────────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Shared Pipeline  │
                    │                   │
                    │ • RulesEngine     │
                    │ • Overlays        │
                    │ • Controls        │
                    │ • Styling         │
                    └───────────────────┘
```

### Layered Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                            │
│  (Card Implementations: Button, Multimeter, Elbow, MSD, etc.)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENT LAYER                               │
│  (Reusable Overlays & Controls)                                 │
│                                                                   │
│  ┌───────────────────────┐      ┌────────────────────────┐     │
│  │  Overlay Components   │      │  Control Components    │     │
│  │  ├─ LineOverlay       │      │  ├─ SliderControl      │     │
│  │  ├─ TextOverlay       │      │  ├─ ButtonControl      │     │
│  │  ├─ SparklineOverlay  │      │  ├─ TapControl         │     │
│  │  ├─ GaugeOverlay      │      │  ├─ HACardControl      │     │
│  │  ├─ ButtonOverlay     │      │  └─ CustomControl      │     │
│  │  └─ CustomOverlay     │      │                         │     │
│  └───────────────────────┘      └────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CORE LAYER                                    │
│  (Shared Infrastructure - CBLCARSCore Singleton)                │
│                                                                   │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │  SystemsManager    │  │ DataSourceManager  │                │
│  │  • Entity tracking │  │ • REST polling     │                │
│  │  • State cache     │  │ • WebSocket subs   │                │
│  │  • Subscriptions   │  │ • Data cache       │                │
│  └────────────────────┘  └────────────────────┘                │
│                                                                   │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │  RulesEngine       │  │  StyleLibrary      │                │
│  │  • State eval      │  │  • Style presets   │                │
│  │  • Condition match │  │  • Theme colors    │                │
│  │  • Style apply     │  │  • YAML configs    │                │
│  └────────────────────┘  └────────────────────┘                │
│                                                                   │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │ AnimationPresets   │  │ ComponentRegistry  │                │
│  │  • Preset library  │  │ • Component types  │                │
│  │  • YAML configs    │  │ • Factory methods  │                │
│  └────────────────────┘  └────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UTILITY LAYER                                 │
│  (Always Available - Module-Level Init)                         │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐         │
│  │  Event Bus  │  │ Animation API│  │  SVG Helpers  │         │
│  │  • Pub/Sub  │  │ • anime.js v4│  │  • Anchors    │         │
│  │  • History  │  │ • Scopes     │  │  • ViewBox    │         │
│  │  • Wildcard │  │ • Timelines  │  │  • Transforms │         │
│  └─────────────┘  └──────────────┘  └───────────────┘         │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐                             │
│  │ Font Loader │  │  Debug API   │                             │
│  │  • LCARS    │  │  • Logging   │                             │
│  │  • Antonio  │  │  • Inspection│                             │
│  └─────────────┘  └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                     DATA FLOW DIAGRAM                             │
└──────────────────────────────────────────────────────────────────┘

1. HOME ASSISTANT (HASS) UPDATE
   │
   ├─→ Card.setHass(hass)
   │   │
   │   └─→ Pipeline.ingestHass(hass)
   │       │
   │       ├─→ SystemsManager.updateHass(hass)
   │       │   │
   │       │   ├─→ Detect entity changes
   │       │   │
   │       │   └─→ Notify subscribers
   │       │       │
   │       │       └─→ Card._onEntityUpdate(entityId, state)
   │       │
   │       └─→ DataSourceManager.updateHass(hass)
   │           │
   │           └─→ Refresh data sources if needed
   │
   └─→ All cards receive HASS update simultaneously
       (SystemsManager ensures single processing per HASS update)

2. ENTITY STATE CHANGE
   │
   ├─→ SystemsManager detects change
   │   │
   │   └─→ Notify all subscribed cards
   │       │
   │       ├─→ Card 1: Pipeline.evaluateRules(entityId)
   │       │   │
   │       │   └─→ RulesEngine.evaluate(state, context)
   │       │       │
   │       │       ├─→ Match conditions
   │       │       │
   │       │       └─→ Return style/animation directives
   │       │           │
   │       │           └─→ Card.applyStyles(result)
   │       │
   │       ├─→ Card 2: (same process)
   │       │
   │       └─→ Card N: (same process)
   │
   └─→ Each card evaluates independently with own RulesEngine

3. DATA SOURCE UPDATE
   │
   ├─→ DataSourceManager polls/receives data
   │   │
   │   ├─→ Cache data
   │   │
   │   └─→ Notify subscribers
   │       │
   │       └─→ Card._onDataSourceUpdate(dsId, data)
   │           │
   │           └─→ Update overlays/controls
   │
   └─→ Multiple cards can subscribe to same data source

4. USER INTERACTION (Tap, Slider, etc.)
   │
   ├─→ Control.handleEvent(event)
   │   │
   │   ├─→ Call HA service (if applicable)
   │   │   │
   │   │   └─→ hass.callService(domain, service, data)
   │   │
   │   ├─→ Publish event bus event (if configured)
   │   │   │
   │   │   └─→ EventBus.publish('card.action', data)
   │   │       │
   │   │       └─→ Other cards receive event
   │   │
   │   └─→ Trigger local animations
   │       │
   │       └─→ AnimationScope.animate(options)
   │
   └─→ Updates flow back through normal HASS update cycle
```

---

## Global Infrastructure Design

### Module-Level Initialization

When `cb-lcars.js` is first loaded by Home Assistant, the following lightweight systems initialize immediately:

```javascript
// src/cb-lcars.js (module level)

/**
 * CB-LCARS Global Infrastructure
 * Initialized on module load (when Lovelace loads cb-lcars.js)
 */

// Ensure global namespace
window.cblcars = window.cblcars || {};

// ===================================================================
// IMMEDIATE INITIALIZATION (~9KB total overhead)
// ===================================================================

/**
 * 1. Event Bus (~5KB)
 * Purpose: Card-to-card communication, event history
 * Justification: Lightweight, enables powerful features, always useful
 */
import { CBLCARSEventBus } from './core/cb-lcars-event-bus.js';
window.cblcars.eventBus = new CBLCARSEventBus({
    debug: false,
    historyLimit: 100
});

/**
 * 2. Animation API (~1KB wrapper + anime.js already loaded)
 * Purpose: Unified anime.js v4 API, scopes, presets
 * Justification: anime.js already loaded, just exposing unified API
 */
window.cblcars.anim = {
    animejs: anime,                // Full anime.js module
    anime: anime.animate,          // Shortcut for animate
    utils: anime.utils,            // Utils for chaining
    scopes: new Map(),             // Track animation scopes
    animateElement: animHelpers.animateElement,
    animateWithRoot: animHelpers.animateWithRoot,
    waitForElement: animHelpers.waitForElement,
    presets: animPresets
};

/**
 * 3. SVG Helpers (~2KB)
 * Purpose: SVG manipulation, anchor finding, viewBox calculations
 * Justification: Pure functions, frequently used across all cards
 */
window.cblcars.svgHelpers = svgHelpers;
window.cblcars.anchorHelpers = anchorHelpers;

/**
 * 4. Font Loader (<1KB)
 * Purpose: Dynamic font loading (LCARS, Antonio, etc.)
 * Justification: Pure function, used by all cards
 */
window.cblcars.loadFont = loadFont;

/**
 * 5. Theme Helpers (<1KB)
 * Purpose: Alert condition colors, theme switching
 * Justification: Pure functions, core LCARS feature
 */
window.cblcars.setAlertCondition = setAlertCondition;
window.cblcars.getSVGFromCache = getSVGFromCache;

/**
 * 6. Debug API (<1KB)
 * Purpose: Logging, introspection, troubleshooting
 * Justification: Essential for development and user support
 */
window.cblcars.debug = {
    setLevel: cblcarsSetGlobalLogLevel,
    getLevel: cblcarsGetGlobalLogLevel,
    getInfo: () => ({
        version: CBLCARS.version,
        eventBusActive: !!window.cblcars.eventBus,
        coreInitialized: window.cblcars.core?._coreInitialized || false,
        cardsLoaded: window.cblcars.core?._cardInstances.size || 0,
        dataSourcesActive: window.cblcars.core?._initializedDataSources.size || 0
    }),
    eventBus: () => window.cblcars.eventBus?.getDebugInfo(),
    core: () => window.cblcars.core?.getDebugInfo()
};

// ===================================================================
// LAZY INITIALIZATION (on first card)
// ===================================================================

/**
 * Core System (~10KB container + heavy systems loaded on demand)
 * Purpose: Container for SystemsManager, DataSourceManager, etc.
 * Justification: Requires HASS, significant memory overhead
 * 
 * Initialization: When first card calls core.initialize(hass)
 */
import { CBLCARSCore } from './core/cb-lcars-core.js';
window.cblcars.core = new CBLCARSCore();  // Registered, not initialized

cblcarsLog.info('[CB-LCARS] 🎉 Global infrastructure ready');
```

### CBLCARSCore Singleton

The core system manages heavy infrastructure and card instances:

```javascript
// src/core/cb-lcars-core.js

/**
 * CB-LCARS Core System
 * Singleton managing shared infrastructure
 * 
 * SHARED GLOBALLY (One Instance):
 * - SystemsManager (entity tracking)
 * - DataSourceManager (REST/polling)
 * - StyleLibrary (style presets)
 * - AnimationPresets (animation configs)
 * - ComponentRegistry (overlay/control types)
 * 
 * PER-CARD INSTANCES:
 * - RulesEngine (state evaluation)
 * - Pipeline (wrapper to shared systems)
 * - Overlays/Controls (owned by card)
 */
class CBLCARSCore {
    constructor() {
        // === SHARED SYSTEMS (One per dashboard) ===
        this.systemsManager = null;      // ~50KB
        this.dataSourceManager = null;   // ~50KB
        this.styleLibrary = null;        // ~20KB
        this.animationPresets = null;    // ~20KB
        this.componentRegistry = null;   // ~10KB
        
        // === DATA SOURCE REGISTRY ===
        // Cards can declare data sources before core is initialized
        this._dataSourceDeclarations = new Map(); // Map<dsId, Declaration[]>
        this._initializedDataSources = new Set();
        this._failedDataSourceSubscriptions = new Map();
        
        // === CARD REGISTRY ===
        this._cardInstances = new Map(); // Map<cardId, CardContext>
        this._cardLoadOrder = [];        // Track initialization order
        
        // === INITIALIZATION STATE ===
        this._coreInitialized = false;
        this._coreInitPromise = null;
        this._pendingCards = [];         // Cards waiting for core init
    }

    /**
     * Initialize core systems
     * Safe to call multiple times - only initializes once
     * Returns promise that resolves when ready
     */
    async initialize(hass) { /* ... */ }

    /**
     * Register a card instance
     * Can be called before core is initialized (card will queue)
     */
    async registerCard(cardId, card, config) { /* ... */ }

    /**
     * Declare a data source
     * Multiple cards can declare same data source (configs merge)
     */
    declareDataSource(cardId, dataSourceConfig) { /* ... */ }

    /**
     * Create pipeline for a card
     * Returns lightweight pipeline for standalone cards
     * Returns full MSD pipeline for MSD cards
     */
    async createPipeline(card, config, fullMSD = false) { /* ... */ }

    /**
     * Unregister card when destroyed
     * Cleanup subscriptions, rules engine, etc.
     */
    unregisterCard(cardId) { /* ... */ }

    /**
     * Get debug information
     */
    getDebugInfo() { /* ... */ }
}
```

### Pipeline Architecture

Every card gets a pipeline providing access to shared systems:

```javascript
/**
 * Lightweight Pipeline (Standalone Cards)
 * 
 * Provides access to shared core systems while maintaining
 * per-card isolation for rules and state evaluation
 */
const lightPipeline = {
    cardId: 'button-abc123',
    
    // === SHARED SYSTEMS (References) ===
    systemsManager: core.systemsManager,      // SHARED
    dataSourceManager: core.dataSourceManager, // SHARED
    styleLibrary: core.styleLibrary,          // SHARED
    animationPresets: core.animationPresets,  // SHARED
    
    // === PER-CARD SYSTEMS ===
    rulesEngine: cardRulesEngine,             // PER-CARD
    
    // === CONVENIENCE METHODS ===
    getEntityState: (entityId) => { /* ... */ },
    evaluateRules: (entityId, context) => { /* ... */ },
    applyStyles: (element, result) => { /* ... */ },
    getDataSource: (dsId) => { /* ... */ },
    ingestHass: (hass) => { /* ... */ },
    destroy: () => { /* ... */ }
};

/**
 * Full MSD Pipeline
 * 
 * Extends light pipeline with MSD-specific systems
 */
const msdPipeline = {
    ...lightPipeline,  // All light pipeline features
    
    // === MSD-SPECIFIC ADDITIONS ===
    compositionEngine: new CompositionEngine(),
    layoutEngine: new LayoutEngine(),
    overlayRenderer: new OverlayRenderer(),
    controlsRenderer: new ControlsRenderer(),
    
    // Additional MSD methods
    composeOverlays: () => { /* ... */ },
    layoutControls: () => { /* ... */ }
};
```

### Component System

Overlays and controls are modular, reusable components:

```javascript
/**
 * Base Overlay Class
 * All overlays extend this base
 * 
 * Features:
 * - Automatic dependency waiting (entities, data sources)
 * - Loading state rendering
 * - Error handling
 * - Lifecycle hooks
 */
class BaseOverlay {
    constructor(config, pipeline) {
        this.config = config;
        this.pipeline = pipeline;
        this.element = null;
        
        this._state = 'initializing'; // initializing, pending, ready, error
        this._pendingResources = new Set();
    }

    /**
     * Initialize overlay
     * Handles data source dependencies and loading states
     */
    async initialize() {
        this._state = 'initializing';

        // Wait for dependencies
        if (this.config.data_source) {
            await this._waitForDataSource(this.config.data_source);
        }
        if (this.config.entity) {
            await this._waitForEntity(this.config.entity);
        }

        // Subclass initialization
        await this.onInitialize();

        this._state = 'ready';
        this._render();
    }

    /**
     * Render pending state with "LOADING..." indicator
     */
    _renderPending() { /* ... */ }

    /**
     * Render error state with red error message
     */
    _renderError() { /* ... */ }

    /**
     * Subclass hooks
     */
    async onInitialize() { /* Override in subclass */ }
    render() { /* Override in subclass */ }
    onUpdate(data) { /* Override in subclass */ }
    destroy() { /* Override in subclass */ }
}

/**
 * Example: Text Overlay
 */
class TextOverlay extends BaseOverlay {
    async onInitialize() {
        // Pre-load font if needed
        if (this.config.font_family) {
            await window.cblcars.loadFont(this.config.font_family);
        }
    }

    render() {
        // Create SVG text element
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', this.config.x);
        text.setAttribute('y', this.config.y);
        text.setAttribute('fill', this.config.color || 'var(--lcars-ui-secondary)');
        
        // Get data from data source or entity
        let content = this.config.text;
        if (this.config.data_source) {
            const data = this.pipeline.getDataSource(this.config.data_source);
            content = this._resolveDataPath(data, this.config.data_path);
        }
        
        text.textContent = content;
        this.element.appendChild(text);
    }

    onUpdate(data) {
        // Update text when data changes
        const text = this.element.querySelector('text');
        if (text && this.config.data_source) {
            const content = this._resolveDataPath(data, this.config.data_path);
            text.textContent = content;
        }
    }
}
```

---

## Phase Plan

### Overview

The migration is organized into 9 phases, grouped into 3 major milestones:

**Milestone 1: Foundation** (Phases 1-3)
- Extract and generalize core infrastructure
- Build reusable component library
- Establish unified API

**Milestone 2: Component Migration** (Phases 4-6)
- Migrate multimeter to native implementation
- Modernize button cards with overlays
- Build optional infrastructure card

**Milestone 3: Unification** (Phases 7-9)
- Deprecate legacy systems
- Complete documentation
- Performance optimization

```
┌─────────────────────────────────────────────────────────────────┐
│                        PHASE PLAN                                │
└─────────────────────────────────────────────────────────────────┘

MILESTONE 1: FOUNDATION
├─ Phase 1: Core System Extraction
│  ├─ Extract SystemsManager from MSD
│  ├─ Extract DataSourceManager from MSD
│  ├─ Extract RulesEngine from MSD
│  ├─ Create CBLCARSCore singleton
│  └─ Implement lazy initialization
│
├─ Phase 2: Base Infrastructure
│  ├─ Create BaseOverlay class with loading states
│  ├─ Create BaseControl class
│  ├─ Implement Event Bus
│  ├─ Setup module-level initialization
│  └─ Create debug API
│
└─ Phase 3: Component Library Foundation
   ├─ Extract overlay renderers from MSD
   ├─ Make overlays work with light pipeline
   ├─ Create ComponentRegistry
   ├─ Build StyleLibrary system
   └─ Build AnimationPresets system

MILESTONE 2: COMPONENT MIGRATION
├─ Phase 4: Native Slider Control
│  ├─ Design CB-LCARS native slider
│  ├─ Implement using anime.js v4
│  ├─ Support all entity types (light, fan, cover, etc.)
│  ├─ Implement slider modes (brightness, temp, volume)
│  └─ Add to ComponentRegistry
│
├─ Phase 5: Multimeter Modernization
│  ├─ Create GaugeOverlay component
│  ├─ Integrate native slider control
│  ├─ Rewrite multimeter using overlays + controls
│  ├─ Add migration helper for old configs
│  └─ Deprecate my-slider-v2 dependency
│
└─ Phase 6: Button Card Refactor
   ├─ Create ButtonOverlay component
   ├─ Migrate button shapes (lozenge, pill, rectangle)
   ├─ Replace state blocks with rules engine
   ├─ Add animation support
   └─ Maintain backward compatibility

MILESTONE 3: UNIFICATION
├─ Phase 7: Core Infrastructure Card
│  ├─ Create cb-lcars-core-card (invisible)
│  ├─ Support data source declarations
│  ├─ Support resource preloading
│  ├─ Support event bus configuration
│  └─ Add graphical editor
│
├─ Phase 8: Documentation & Examples
│  ├─ Architecture documentation
│  ├─ Component API documentation
│  ├─ Migration guides
│  ├─ Example configurations
│  └─ Video tutorials
│
└─ Phase 9: Optimization & Cleanup
   ├─ Remove legacy button-card templates
   ├─ Remove my-slider-v2 dependency
   ├─ Performance profiling
   ├─ Bundle size optimization
   └─ Final testing
```

---

## Implementation Details by Phase

### Phase 1: Core System Extraction

**Goal:** Extract MSD infrastructure into shared core that all cards can use

#### 1.1 Extract SystemsManager

**File:** `src/core/systems-manager/index.js`

**Responsibilities:**
- Track entity states across all cards
- Manage entity subscriptions (multiple cards can subscribe to same entity)
- Detect state changes and notify subscribers
- Optimize HASS updates (process once per update, not per card)

**Key Changes from MSD Version:**
- Remove MSD-specific dependencies
- Make it work without pipeline reference
- Add subscription management for multiple cards
- Add entity state caching

```javascript
/**
 * SystemsManager - Centralized Entity State Tracking
 * 
 * Manages entity state for all CB-LCARS cards on the dashboard.
 * Ensures entity changes are detected once and propagated to all
 * subscribed cards efficiently.
 */
export class SystemsManager {
    constructor(hass) {
        this._hass = hass;
        this._originalHass = null;
        
        // Map<entityId, Set<{cardId, callback}>>
        this._subscriptions = new Map();
        
        // Cache of last known states
        this._stateCache = new Map();
    }

    /**
     * Subscribe a card to entity updates
     * 
     * @param {string} entityId - Entity to watch
     * @param {string} cardId - Subscribing card ID
     * @param {Function} callback - Called when entity changes
     * @returns {Function} Unsubscribe function
     */
    subscribe(entityId, cardId, callback) {
        if (!this._subscriptions.has(entityId)) {
            this._subscriptions.set(entityId, new Set());
        }
        
        const subscription = { cardId, callback };
        this._subscriptions.get(entityId).add(subscription);
        
        cblcarsLog.debug(`[SystemsManager] ${cardId} subscribed to ${entityId}`);
        
        // Return unsubscribe function
        return () => this.unsubscribe(entityId, cardId, callback);
    }

    /**
     * Unsubscribe from entity updates
     */
    unsubscribe(entityId, cardId, callback) {
        const subscribers = this._subscriptions.get(entityId);
        if (!subscribers) return;
        
        for (const sub of subscribers) {
            if (sub.cardId === cardId && sub.callback === callback) {
                subscribers.delete(sub);
                cblcarsLog.debug(`[SystemsManager] ${cardId} unsubscribed from ${entityId}`);
                break;
            }
        }
        
        // Cleanup empty subscription sets
        if (subscribers.size === 0) {
            this._subscriptions.delete(entityId);
        }
    }

    /**
     * Update HASS reference
     * Detects entity changes and notifies subscribers
     */
    updateHass(hass) {
        this._originalHass = this._hass;
        this._hass = hass;
        
        // Detect changes in subscribed entities
        for (const [entityId, subscribers] of this._subscriptions.entries()) {
            const oldState = this._originalHass?.states?.[entityId];
            const newState = this._hass?.states?.[entityId];
            
            if (!newState) {
                cblcarsLog.warn(`[SystemsManager] Entity ${entityId} not found in HASS`);
                continue;
            }
            
            // Check if state changed
            const changed = this._hasStateChanged(oldState, newState);
            
            if (changed) {
                cblcarsLog.debug(`[SystemsManager] Entity ${entityId} changed`, {
                    oldState: oldState?.state,
                    newState: newState?.state
                });
                
                // Update cache
                this._stateCache.set(entityId, newState);
                
                // Notify all subscribers
                for (const { cardId, callback } of subscribers) {
                    try {
                        callback(newState, oldState);
                    } catch (error) {
                        cblcarsLog.error(`[SystemsManager] Error in subscriber ${cardId}:`, error);
                    }
                }
            }
        }
    }

    /**
     * Get current state of an entity
     */
    getState(entityId) {
        return this._hass?.states?.[entityId] || this._stateCache.get(entityId);
    }

    /**
     * Check if entity state has changed
     * @private
     */
    _hasStateChanged(oldState, newState) {
        if (!oldState) return true;
        if (oldState.state !== newState.state) return true;
        if (oldState.last_changed !== newState.last_changed) return true;
        if (oldState.last_updated !== newState.last_updated) return true;
        
        // Deep compare attributes if needed
        // (optimize: only compare if subscribers care about attributes)
        
        return false;
    }

    /**
     * Get debug info
     */
    getDebugInfo() {
        const subscriptionsByEntity = {};
        for (const [entityId, subscribers] of this._subscriptions.entries()) {
            subscriptionsByEntity[entityId] = Array.from(subscribers).map(s => s.cardId);
        }
        
        return {
            subscribedEntities: this._subscriptions.size,
            subscriptionsByEntity,
            cachedStates: this._stateCache.size
        };
    }
}
```

#### 1.2 Extract DataSourceManager

**File:** `src/core/data-sources/index.js`

**Responsibilities:**
- Manage REST API polling
- Handle WebSocket connections (future)
- Cache data source results
- Notify subscribers when data updates
- Support multiple cards subscribing to same data source

**Key Features:**
- Lazy initialization (only poll when subscribed)
- Automatic retry on failure
- Declaration merging (multiple cards can define same data source)
- Configurable refresh intervals

```javascript
/**
 * DataSourceManager - External Data Fetching & Caching
 * 
 * Manages data sources (REST APIs, WebSockets, etc.) for all cards.
 * Ensures data is fetched once and shared across subscribing cards.
 */
export class DataSourceManager {
    constructor(hass) {
        this._hass = hass;
        
        // Map<dsId, DataSourceInstance>
        this._sources = new Map();
        
        // Map<dsId, Set<{cardId, callback}>>
        this._subscriptions = new Map();
        
        // Map<dsId, cachedData>
        this._dataCache = new Map();
    }

    /**
     * Initialize a data source
     * Called by CBLCARSCore when data source is first referenced
     */
    initialize(config) {
        const dsId = config.id;
        
        if (this._sources.has(dsId)) {
            cblcarsLog.warn(`[DataSourceManager] Data source ${dsId} already initialized`);
            return;
        }
        
        cblcarsLog.info(`[DataSourceManager] Initializing data source: ${dsId}`);
        
        const source = this._createDataSource(config);
        this._sources.set(dsId, source);
        
        // Start polling if refresh interval specified
        if (config.refresh && config.refresh > 0) {
            source.startPolling();
        }
    }

    /**
     * Subscribe to data source updates
     */
    subscribe(dsId, cardId, callback) {
        if (!this._subscriptions.has(dsId)) {
            this._subscriptions.set(dsId, new Set());
        }
        
        const subscription = { cardId, callback };
        this._subscriptions.get(dsId).add(subscription);
        
        cblcarsLog.debug(`[DataSourceManager] ${cardId} subscribed to ${dsId}`);
        
        // Send cached data immediately if available
        if (this._dataCache.has(dsId)) {
            callback(this._dataCache.get(dsId));
        }
        
        // Return unsubscribe function
        return () => this.unsubscribe(dsId, cardId, callback);
    }

    /**
     * Unsubscribe from data source
     */
    unsubscribe(dsId, cardId, callback) {
        const subscribers = this._subscriptions.get(dsId);
        if (!subscribers) return;
        
        for (const sub of subscribers) {
            if (sub.cardId === cardId && sub.callback === callback) {
                subscribers.delete(sub);
                cblcarsLog.debug(`[DataSourceManager] ${cardId} unsubscribed from ${dsId}`);
                break;
            }
        }
        
        // Stop polling if no subscribers
        if (subscribers.size === 0) {
            const source = this._sources.get(dsId);
            if (source) {
                source.stopPolling();
            }
        }
    }

    /**
     * Get cached data for a data source
     */
    getData(dsId) {
        return this._dataCache.get(dsId);
    }

    /**
     * Create data source instance based on type
     * @private
     */
    _createDataSource(config) {
        switch (config.type) {
            case 'rest':
                return new RESTDataSource(config, this);
            case 'websocket':
                return new WebSocketDataSource(config, this);
            default:
                throw new Error(`Unknown data source type: ${config.type}`);
        }
    }

    /**
     * Called by data source when data is received
     * @internal
     */
    _onDataReceived(dsId, data) {
        // Cache data
        this._dataCache.set(dsId, data);
        
        // Notify subscribers
        const subscribers = this._subscriptions.get(dsId);
        if (!subscribers) return;
        
        cblcarsLog.debug(`[DataSourceManager] Data received for ${dsId}, notifying ${subscribers.size} subscribers`);
        
        for (const { cardId, callback } of subscribers) {
            try {
                callback(data);
            } catch (error) {
                cblcarsLog.error(`[DataSourceManager] Error in subscriber ${cardId}:`, error);
            }
        }
    }

    /**
     * Update HASS reference
     */
    updateHass(hass) {
        this._hass = hass;
        
        // Update all active data sources
        for (const source of this._sources.values()) {
            source.updateHass(hass);
        }
    }
}

/**
 * REST Data Source Implementation
 */
class RESTDataSource {
    constructor(config, manager) {
        this.config = config;
        this.manager = manager;
        this._pollTimer = null;
        this._isPolling = false;
    }

    startPolling() {
        if (this._isPolling) return;
        
        this._isPolling = true;
        cblcarsLog.debug(`[RESTDataSource] Starting polling for ${this.config.id} (${this.config.refresh}s)`);
        
        // Fetch immediately
        this._fetch();
        
        // Setup interval
        this._pollTimer = setInterval(
            () => this._fetch(),
            this.config.refresh * 1000
        );
    }

    stopPolling() {
        if (!this._isPolling) return;
        
        this._isPolling = false;
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
        
        cblcarsLog.debug(`[RESTDataSource] Stopped polling for ${this.config.id}`);
    }

    async _fetch() {
        try {
            cblcarsLog.debug(`[RESTDataSource] Fetching ${this.config.url}`);
            
            const response = await fetch(this.config.url, {
                method: this.config.method || 'GET',
                headers: this.config.headers || {},
                ...this.config.fetch_options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            let data = await response.json();
            
            // Apply transform if configured
            if (this.config.transform) {
                data = this._applyTransform(data, this.config.transform);
            }
            
            // Notify manager
            this.manager._onDataReceived(this.config.id, data);
            
        } catch (error) {
            cblcarsLog.error(`[RESTDataSource] Fetch failed for ${this.config.id}:`, error);
        }
    }

    _applyTransform(data, transform) {
        // Support string path or function
        if (typeof transform === 'string') {
            return transform.split('.').reduce((obj, key) => obj?.[key], data);
        } else if (typeof transform === 'function') {
            return transform(data);
        }
        return data;
    }

    updateHass(hass) {
        // Could use hass for authentication tokens, etc.
    }
}
```

#### 1.3 Extract RulesEngine

**File:** `src/core/rules-engine/index.js`

**Responsibilities:**
- Evaluate entity state against conditions
- Support multiple condition types (equals, from/to, in, regex, etc.)
- Return style/animation directives
- Reference shared StyleLibrary and AnimationPresets

**Key Features:**
- Replaces button-card state blocks
- Declarative condition matching
- Style preset resolution
- Per-card instances (each card has own rules)

```javascript
/**
 * RulesEngine - Declarative State Evaluation
 * 
 * Evaluates entity states against configured rules and returns
 * styling/animation directives.
 * 
 * Replaces legacy button-card state blocks with declarative rules.
 */
export class RulesEngine {
    constructor(rules, styleLibrary, animationPresets) {
        this.rules = rules || [];
        this.styleLibrary = styleLibrary;
        this.animationPresets = animationPresets;
    }

    /**
     * Evaluate rules for a given entity state
     * 
     * @param {Object} entityState - HA entity state object
     * @param {Object} context - Additional context (attribute overrides, etc.)
     * @returns {Object} Result with matched rule and directives
     */
    evaluate(entityState, context = {}) {
        if (!entityState) {
            return { matched: false };
        }

        // Try each rule in order
        for (const rule of this.rules) {
            if (this._matchesCondition(rule.condition, entityState, context)) {
                cblcarsLog.debug(`[RulesEngine] Rule matched:`, rule);
                
                const result = {
                    matched: true,
                    rule: rule,
                    ...this._processDirectives(rule.apply, context)
                };
                
                return result;
            }
        }

        // No match
        return { matched: false };
    }

    /**
     * Check if condition matches entity state
     * @private
     */
    _matchesCondition(condition, entityState, context) {
        if (!condition) return true; // No condition = always match

        // Get value to test (entity state or attribute)
        let value = entityState.state;
        if (condition.attribute) {
            value = entityState.attributes?.[condition.attribute];
        }

        // Handle brightness special case (convert 0-255 to 0-100)
        if (condition.attribute === 'brightness' && value !== undefined) {
            value = (parseFloat(value) / 256) * 100;
        }

        // Convert to number if possible
        let numericValue = value;
        if (typeof value === 'string' && !isNaN(Number(value))) {
            numericValue = Number(value);
        }

        // === CONDITION TYPES ===

        // 1. equals: strict match
        if ('equals' in condition) {
            return value == condition.equals;
        }

        // 2. not_equals: negation
        if ('not_equals' in condition) {
            return value != condition.not_equals;
        }

        // 3. from/to: numeric range
        if ('from' in condition || 'to' in condition) {
            if (typeof numericValue !== 'number') return false;
            
            const fromMatch = !('from' in condition) || numericValue >= condition.from;
            const toMatch = !('to' in condition) || numericValue <= condition.to;
            
            return fromMatch && toMatch;
        }

        // 4. in: value in array
        if ('in' in condition && Array.isArray(condition.in)) {
            return condition.in.includes(value);
        }

        // 5. not_in: value not in array
        if ('not_in' in condition && Array.isArray(condition.not_in)) {
            return !condition.not_in.includes(value);
        }

        // 6. regex: pattern match
        if ('regex' in condition) {
            try {
                const regex = new RegExp(condition.regex);
                return typeof value === 'string' && regex.test(value);
            } catch (e) {
                cblcarsLog.error(`[RulesEngine] Invalid regex: ${condition.regex}`, e);
                return false;
            }
        }

        // 7. state: shorthand for common states
        if ('state' in condition) {
            const states = Array.isArray(condition.state) ? condition.state : [condition.state];
            return states.includes(value);
        }

        return false;
    }

    /**
     * Process apply directives
     * @private
     */
    _processDirectives(apply, context) {
        const result = {};

        // Style preset reference
        if (apply.stylePreset || apply.style_preset) {
            const presetName = apply.stylePreset || apply.style_preset;
            result.stylePreset = presetName;
            result.styles = this.styleLibrary?.getPreset(presetName) || {};
        }

        // Inline styles
        if (apply.style || apply.styles) {
            result.inlineStyles = apply.style || apply.styles;
        }

        // Animation preset
        if (apply.animation) {
            result.animation = apply.animation;
            result.animationConfig = this.animationPresets?.getPreset(apply.animation) || {};
        }

        // Custom properties
        if (apply.properties) {
            result.properties = apply.properties;
        }

        return result;
    }

    /**
     * Add a rule dynamically
     */
    addRule(rule) {
        this.rules.push(rule);
    }

    /**
     * Remove all rules
     */
    clearRules() {
        this.rules = [];
    }

    /**
     * Cleanup
     */
    destroy() {
        this.rules = [];
        this.styleLibrary = null;
        this.animationPresets = null;
    }
}
```

#### 1.4 Create CBLCARSCore Singleton

**File:** `src/core/cb-lcars-core.js`

**Responsibilities:**
- Manage shared systems (SystemsManager, DataSourceManager, etc.)
- Handle card registration and lifecycle
- Manage data source declarations and initialization
- Create pipelines for cards
- Implement lazy initialization with retry logic

**Key Features:**
- Single initialization regardless of card load order
- Data source declaration hoisting
- Failed subscription retry when data source becomes available
- Per-card context tracking

**See detailed implementation in [Global Infrastructure Design](#global-infrastructure-design) section above.**

#### 1.5 Update CBLCARSBaseCard

**File:** `src/cb-lcars.js` (CBLCARSBaseCard class)

**Changes:**
- Initialize core on first card connection
- Create pipeline via core
- Forward HASS updates to pipeline
- Initialize overlays/controls if configured

```javascript
class CBLCARSBaseCard extends ButtonCard {
    constructor() {
        super();
        this._pipeline = null;
        this._overlays = [];
        this._controls = [];
    }

    async connectedCallback() {
        super.connectedCallback();

        // Initialize core if needed (first card on dashboard)
        if (this.hass && !window.cblcars.core._coreInitialized) {
            await window.cblcars.core.initialize(this.hass);
        }

        // Create animation scope for this card
        this._animationScopeId = `card-${this.id || this.cardType || Math.random().toString(36).slice(2)}`;
        this._animationScope = new CBLCARSAnimationScope(this._animationScopeId);
        window.cblcars.anim.scopes.set(this._animationScopeId, this._animationScope);
    }

    async setConfig(config) {
        // ... existing config setup ...

        // Ensure core is initialized
        if (this.hass) {
            await window.cblcars.core.initialize(this.hass);
        }

        // Create pipeline based on card type
        const isMSDCard = config.type === 'cb-lcars-msd-card';
        
        if (isMSDCard) {
            // Full MSD pipeline
            this._pipeline = await window.cblcars.core.createPipeline(this, this._config, true);
        } else {
            // Lightweight pipeline
            this._pipeline = await window.cblcars.core.createPipeline(this, this._config, false);
        }

        // Initialize overlays/controls if configured
        await this._initializeComponents();

        super.setConfig(this._config);
    }

    async _initializeComponents() {
        const overlaysCfg = this._config.variables?.overlays || [];
        const controlsCfg = this._config.variables?.controls || [];

        // Create overlay instances
        for (const cfg of overlaysCfg) {
            const overlay = await this._createOverlay(cfg);
            this._overlays.push(overlay);
            await overlay.initialize();
        }

        // Create control instances
        for (const cfg of controlsCfg) {
            const control = await this._createControl(cfg);
            this._controls.push(control);
            await control.initialize();
        }
    }

    async _createOverlay(config) {
        const OverlayClass = window.cblcars.core.componentRegistry.getOverlay(config.type);
        if (!OverlayClass) {
            throw new Error(`Unknown overlay type: ${config.type}`);
        }
        return new OverlayClass(config, this._pipeline);
    }

    async _createControl(config) {
        const ControlClass = window.cblcars.core.componentRegistry.getControl(config.type);
        if (!ControlClass) {
            throw new Error(`Unknown control type: ${config.type}`);
        }
        return new ControlClass(config, this._pipeline);
    }

    setHass(hass) {
        const oldHass = this.hass;
        this.hass = hass;

        // Initialize core on first hass if needed
        if (!window.cblcars.core._coreInitialized) {
            window.cblcars.core.initialize(hass).then(() => {
                this._pipeline?.ingestHass(hass);
            });
        } else {
            // Forward to pipeline
            this._pipeline?.ingestHass(hass);
        }

        // Update overlays/controls
        this._overlays.forEach(overlay => overlay.update?.(hass));
        this._controls.forEach(control => control.update?.(hass));

        // Trigger LitElement update
        this.requestUpdate('hass', oldHass);
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        // Cleanup pipeline
        this._pipeline?.destroy();

        // Cleanup overlays/controls
        this._overlays.forEach(overlay => overlay.destroy?.());
        this._controls.forEach(control => control.destroy?.());

        // Cleanup animation scope
        this._animationScope?.destroy();
        window.cblcars.anim.scopes.delete(this._animationScopeId);
    }
}
```

**Deliverables:**
- ✅ `src/core/systems-manager/index.js` - SystemsManager extracted
- ✅ `src/core/data-sources/index.js` - DataSourceManager extracted
- ✅ `src/core/rules-engine/index.js` - RulesEngine extracted
- ✅ `src/core/cb-lcars-core.js` - CBLCARSCore singleton
- ✅ Updated `src/cb-lcars.js` - CBLCARSBaseCard using core
- ✅ Unit tests for each core system

---

### Phase 2: Base Infrastructure

**Goal:** Create foundational systems that all cards rely on

#### 2.1 Event Bus Implementation

**File:** `src/core/cb-lcars-event-bus.js`

**Features:**
- Pub/sub pattern for card-to-card communication
- Event history with replay for late subscribers
- Wildcard subscriptions (`card.*` matches all card events)
- Debug mode with event logging
- Type-safe event registration

**See detailed implementation in [Option 3: Event Bus System](#option-3-event-bus-system) section above.**

#### 2.2 BaseOverlay Class with Loading States

**File:** `src/components/overlays/base-overlay.js`

**Features:**
- Automatic dependency waiting (entities, data sources)
- Pending state rendering ("LOADING..." with animated ellipsis)
- Error state rendering (red error message)
- Lifecycle hooks (onInitialize, render, onUpdate, destroy)
- State machine (initializing → pending → ready | error)

**See detailed implementation in [Component System](#component-system) section above.**

#### 2.3 BaseControl Class

**File:** `src/components/controls/base-control.js`

**Features:**
- Similar to BaseOverlay but for interactive elements
- Event handling integration
- HASS service call helpers
- Animation integration

```javascript
/**
 * Base Control Class
 * All interactive controls extend this
 */
export class BaseControl {
    constructor(config, pipeline) {
        this.config = config;
        this.pipeline = pipeline;
        this.element = null;
        this._eventListeners = [];
    }

    /**
     * Initialize control
     */
    async initialize() {
        // Wait for entity if specified
        if (this.config.entity) {
            await this._waitForEntity(this.config.entity);
        }

        // Subclass initialization
        await this.onInitialize();

        // Render control
        this.render();

        // Attach event listeners
        this._attachEventListeners();
    }

    /**
     * Call Home Assistant service
     */
    async callService(domain, service, data = {}) {
        if (!this.pipeline.systemsManager?.hass) {
            cblcarsLog.warn('[BaseControl] HASS not available');
            return;
        }

        const hass = this.pipeline.systemsManager.hass;
        
        try {
            await hass.callService(domain, service, data);
            cblcarsLog.debug(`[BaseControl] Called ${domain}.${service}`, data);
        } catch (error) {
            cblcarsLog.error(`[BaseControl] Service call failed:`, error);
        }
    }

    /**
     * Publish event bus event
     */
    publishEvent(eventType, data) {
        if (!window.cblcars.eventBus) return;

        window.cblcars.eventBus.publish(eventType, data, {
            sourceCard: this.pipeline.cardId,
            sourceControl: this.config.id
        });
    }

    /**
     * Add event listener (tracked for cleanup)
     */
    addEventListener(element, event, handler) {
        element.addEventListener(event, handler);
        this._eventListeners.push({ element, event, handler });
    }

    /**
     * Subclass hooks
     */
    async onInitialize() { /* Override */ }
    render() { /* Override */ }
    onUpdate(data) { /* Override */ }
    _attachEventListeners() { /* Override */ }

    /**
     * Cleanup
     */
    destroy() {
        // Remove event listeners
        this._eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this._eventListeners = [];

        // Remove element
        this.element?.remove();
    }
}
```

#### 2.4 Module-Level Initialization

**File:** `src/cb-lcars.js` (module level)

**Initialize lightweight systems immediately:**
- Event Bus (~5KB)
- Animation API (~1KB)
- SVG Helpers (~2KB)
- Font Loader (<1KB)
- Debug API (<1KB)

**See implementation in [Module-Level Initialization](#module-level-initialization) section above.**

#### 2.5 Debug API

**File:** `src/utils/cb-lcars-debug.js`

**Features:**
- Log level management
- System introspection
- Event bus inspection
- Core system inspection
- Performance profiling

```javascript
/**
 * CB-LCARS Debug API
 * Provides introspection and troubleshooting tools
 */
export const DebugAPI = {
    /**
     * Set global log level
     */
    setLevel(level) {
        cblcarsSetGlobalLogLevel