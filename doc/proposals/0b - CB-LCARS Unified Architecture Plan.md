# CB-LCARS Unified Architecture & Implementation Plan

**Project:** CB-LCARS Custom Cards for Home Assistant  
**Document Version:** 1.0  
**Date:** 2025-01-23  
**Author:** CB-LCARS Development Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Architectural Vision](#architectural-vision)
4. [Core Infrastructure Design](#core-infrastructure-design)
5. [Implementation Phases](#implementation-phases)
6. [Migration Strategy](#migration-strategy)
7. [API Reference](#api-reference)
8. [Testing & Validation](#testing--validation)
9. [Documentation Requirements](#documentation-requirements)

---

## Executive Summary

### Problem Statement

CB-LCARS currently has a **split architecture**:
- **Legacy cards** (button, multimeter, elbow, etc.) built on complex button-card YAML templates
- **MSD system** with modern modular architecture (overlays, controls, rules engine, styling system)
- **No shared infrastructure** - systems duplicate functionality
- **External dependency** - multimeter relies on unmaintained `my-slider-v2` card
- **Order-dependent initialization** - data sources must be defined before use

### Goals

1. **Unify architecture** - Extract MSD infrastructure as shared foundation for all cards
2. **Eliminate dependencies** - Build native slider control using anime.js v4
3. **Order-independent initialization** - Declarative data sources with retry logic
4. **Maintain backward compatibility** - Legacy cards continue working during migration
5. **Progressive enhancement** - Simple cards stay simple, advanced features available when needed

### Success Criteria

- ✅ All CB-LCARS cards use shared core infrastructure
- ✅ No external card dependencies (remove my-slider-v2)
- ✅ Cards work regardless of load order
- ✅ Event bus enables card-to-card communication
- ✅ Overlay/control system works in standalone cards
- ✅ Rules engine replaces button-card state system
- ✅ Loading states provide visual feedback
- ✅ <100KB overhead for simple dashboards
- ✅ Comprehensive migration path from legacy cards

---

## Current State Analysis

### Architectural Diagram: Current State

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Home Assistant Lovelace                           │
│                                                                       │
│  ┌──────────────────────┐         ┌──────────────────────┐         │
│  │   LEGACY CARDS       │         │     MSD CARD         │         │
│  │                      │         │                      │         │
│  │ • Button (YAML)      │         │ • Pipeline System    │         │
│  │ • Multimeter (YAML)  │         │ • Overlays           │         │
│  │ • Elbow (YAML)       │         │ • Controls           │         │
│  │ • Label (YAML)       │         │ • Rules Engine       │         │
│  │                      │         │ • Styling System     │         │
│  │ Dependency:          │         │ • SystemsManager     │         │
│  │ ❌ my-slider-v2      │         │ • DataSourceManager  │         │
│  │                      │         │                      │         │
│  └──────────┬───────────┘         └──────────┬───────────┘         │
│             │                                 │                      │
│             │  No Shared Infrastructure       │                      │
│             │  ❌ Duplicated Logic            │                      │
│             │  ❌ No Communication            │                      │
│             └─────────────────────────────────┘                      │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │         Custom Button Card Foundation (ButtonCard)             │ │
│  │  • Templating System (YAML)                                    │ │
│  │  • State Blocks (Duplicated across all cards)                  │ │
│  │  • Style System (CSS-in-JS, verbose)                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Pain Points

#### 1. Multimeter Card Dependencies
```yaml
# Current multimeter requires external card
custom_fields:
  slider: |
    [[[
      return `<my-slider-v2
        entity="${variables.entity}"
        ...
      </my-slider-v2>`;
    ]]]
```

**Problems:**
- ❌ `my-slider-v2` is unmaintained
- ❌ Requires users to install separate card
- ❌ Different configuration format
- ❌ Limited customization options
- ❌ No access to CB-LCARS styling/theming

#### 2. Button-Card State System (Duplicated Everywhere)
```yaml
# Every card has hundreds of lines of state blocks
state:
  - id: state_on
    operator: template
    value: |
      [[[
        return entity !== undefined && ['on', 'open', 'locked'].includes(states[entity.entity_id].state)
      ]]]
    styles:
      card:
        - background-color: '[[[ return variables.card.color.background.active ]]]'
        - border-top: |
            [[[
              return variables.__get_num_with_unit(variables.card.border.top.size) + 
                     " solid " + variables.card.color.active;
            ]]]
        # ... 50 more lines per state
  - id: state_off
    # ... another 50 lines
  - id: state_unavailable
    # ... another 50 lines
```

**Problems:**
- ❌ 200+ lines of YAML per card type
- ❌ Duplicated across all 7+ card types
- ❌ Hard to maintain consistency
- ❌ Difficult to add new states
- ❌ No reusable style presets

#### 3. No Shared Data Sources
```yaml
# MSD defines data source
- type: cb-lcars-msd-card
  msd:
    data_sources:
      - id: weather
        type: rest
        url: https://api.weather.com/...

# Button wants to use it - but can't!
- type: cb-lcars-button-card
  variables:
    label: "${data.weather.temp}"  # ❌ Not available
```

**Problems:**
- ❌ Data sources locked to defining card
- ❌ Must duplicate REST calls
- ❌ No centralized data management
- ❌ Order-dependent (MSD must load first)

#### 4. No Card Communication
```yaml
# Button changes alert condition
- type: cb-lcars-button-card
  tap_action:
    action: call-service
    service: script.set_alert_red

# MSD needs to update - but doesn't know!
- type: cb-lcars-msd-card
  # ❌ Must poll entity to detect changes
```

**Problems:**
- ❌ No event system
- ❌ Cards can't notify each other
- ❌ Must rely on entity state polling
- ❌ Complex cross-card interactions impossible

---

## Architectural Vision

### Target Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│                      Home Assistant Lovelace                               │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Button     │  │ Multimeter   │  │     MSD      │  │  Core Card   │ │
│  │   Card       │  │    Card      │  │    Card      │  │ (Optional)   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │                  │         │
│         └──────────────────┴──────────────────┴──────────────────┘         │
│                                    │                                        │
│                         ┌──────────▼──────────┐                           │
│                         │   CBLCARSCore       │  ← SINGLETON              │
│                         │  (window.cblcars    │                           │
│                         │        .core)       │                           │
│                         └──────────┬──────────┘                           │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐           │
│         │                          │                           │           │
│  ┌──────▼──────┐          ┌────────▼────────┐        ┌───────▼──────┐   │
│  │  Systems    │          │  Data Source    │        │    Style     │   │
│  │  Manager    │          │    Manager      │        │   Library    │   │
│  │             │          │                 │        │              │   │
│  │ SHARED      │          │    SHARED       │        │   SHARED     │   │
│  │ • Entity    │          │ • REST polls    │        │ • Presets    │   │
│  │   tracking  │          │ • WebSockets    │        │ • Themes     │   │
│  │ • State     │          │ • Caching       │        │ • Rules      │   │
│  │   updates   │          │ • Retry logic   │        │              │   │
│  └─────────────┘          └─────────────────┘        └──────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    SHARED COMPONENT LIBRARY                           │ │
│  │                                                                        │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │ │
│  │  │    Overlays     │  │    Controls     │  │  Rules Engine   │     │ │
│  │  │                 │  │                 │  │                 │     │ │
│  │  │ • LineOverlay   │  │ • SliderControl │  │ • State eval    │     │ │
│  │  │ • TextOverlay   │  │ • ButtonControl │  │ • Conditions    │     │ │
│  │  │ • SVGOverlay    │  │ • HACardControl │  │ • Style match   │     │ │
│  │  │ • Sparkline     │  │ • TapControl    │  │ • Presets       │     │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                 LIGHTWEIGHT INFRASTRUCTURE (Always Active)            │ │
│  │                                                                        │ │
│  │  ┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌─────────────┐ │ │
│  │  │  Event Bus │  │ Animation API│  │ SVG Helpers│  │  Debug API  │ │ │
│  │  │            │  │              │  │            │  │             │ │ │
│  │  │ • Pub/Sub  │  │ • anime.js v4│  │ • Anchors  │  │ • Inspect   │ │ │
│  │  │ • History  │  │ • Scopes     │  │ • ViewBox  │  │ • Log       │ │ │
│  │  │ • Wildcard │  │ • Timelines  │  │ • Compose  │  │ • Monitor   │ │ │
│  │  └────────────┘  └──────────────┘  └────────────┘  └─────────────┘ │ │
│  │                                                                        │ │
│  │  Initialized: Module load (~9KB overhead)                             │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                      CBLCARSBaseCard                                  │ │
│  │           (Extends Custom Button Card - ButtonCard)                  │ │
│  │                                                                        │ │
│  │  • Manages pipeline connection                                        │ │
│  │  • Handles HASS updates                                               │ │
│  │  • Coordinates overlays/controls                                      │ │
│  │  • Provides shadowRoot context                                        │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

#### 1. Progressive Initialization

```
Module Load (t=0ms)
├─ ✅ Event Bus (~5KB)
├─ ✅ Animation API (~1KB)  
├─ ✅ SVG Helpers (~2KB)
├─ ✅ Debug API (~1KB)
└─ ⏳ Core System (registered, not initialized)

First Card Load (t=variable)
└─ Core.initialize(hass)
   ├─ ✅ SystemsManager (~50KB)
   ├─ ⏳ DataSourceManager (lazy)
   ├─ ⏳ StyleLibrary (lazy)
   └─ ⏳ AnimationPresets (lazy)

First Data Source Reference
└─ DataSourceManager.initialize()
   └─ Start polling/fetching

First Style Preset Reference
└─ StyleLibrary.load()
   └─ Parse YAML presets
```

#### 2. Declarative Configuration

```yaml
# Cards DECLARE what they need, core PROVIDES it
# Order doesn't matter!

# Card loaded at t=0ms
- type: cb-lcars-button-card
  variables:
    label: "${data.weather.temp}"  # Declares need for 'weather'
    # ⏳ Waits for data source...

# Card loaded at t=500ms
- type: cb-lcars-msd-card
  msd:
    data_sources:
      - id: weather  # Defines 'weather'
        type: rest
        url: ...
    # ✅ Button card now gets data!
```

#### 3. Shared by Default, Isolated by Design

```javascript
// SHARED: One instance for all cards
window.cblcars.core.systemsManager  // Tracks ALL entities
window.cblcars.core.dataSourceManager  // Polls ALL data sources
window.cblcars.core.styleLibrary  // Loads ALL presets

// PER-CARD: Isolated instances
card1._pipeline.rulesEngine  // Card 1's rules
card2._pipeline.rulesEngine  // Card 2's rules
card1._overlays  // Card 1's overlays
card2._overlays  // Card 2's overlays
```

#### 4. Backward Compatible

```yaml
# Legacy config still works
- type: cb-lcars-button-card
  entity: light.desk
  template: cb-lcars-button-lozenge
  # ✅ Uses button-card templates (deprecated but functional)

# Modern config (recommended)
- type: cb-lcars-button-card
  entity: light.desk
  variables:
    overlays:
      - type: button
        shape: lozenge
    rules:
      - condition: { state: "on" }
        style: { preset: "active" }
  # ✅ Uses new overlay + rules system
```

---

## Core Infrastructure Design

### 1. CBLCARSCore (Singleton)

**Purpose:** Central coordinator for all CB-LCARS infrastructure

**Responsibilities:**
- Initialize and manage shared systems
- Register/unregister cards
- Coordinate data source declarations
- Provide pipelines to cards
- Handle retry logic for missing dependencies

**API Surface:**

```javascript
class CBLCARSCore {
    // Initialization
    async initialize(hass): Promise<void>
    
    // Card lifecycle
    async registerCard(cardId, card, config): Promise<CardContext>
    unregisterCard(cardId): void
    
    // Data sources
    declareDataSource(cardId, dataSourceConfig): void
    _initializeDataSource(dsId): void
    _mergeDataSourceConfigs(dsId, declarations): Object
    _subscribeToDataSource(dsId, cardId, callback): boolean
    _onDataSourceDeclared(dsId): void
    
    // Pipeline creation
    createPipeline(card, config, fullMSD): Promise<Pipeline>
    _createLightPipeline(context): Pipeline
    _createMSDPipeline(context): Promise<Pipeline>
    
    // Utilities
    getDebugInfo(): Object
    _collectEntities(config): string[]
    _extractDataSources(config): Object[]
    _extractDataSourceReferences(config): Object[]
}
```

**Initialization Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ CBLCARSCore Initialization Flow                             │
└─────────────────────────────────────────────────────────────┘

Module Load
│
├─ window.cblcars.core = new CBLCARSCore()
│  └─ State: { _coreInitialized: false }
│
First Card: connectedCallback()
│
├─ await core.initialize(hass)
│  │
│  ├─ Check: _coreInitialized? → No
│  ├─ Check: _coreInitPromise? → No
│  │
│  ├─ Start: _coreInitPromise = _doInitialize(hass)
│  │  │
│  │  ├─ Import: SystemsManager
│  │  ├─ Import: DataSourceManager
│  │  ├─ Import: StyleLibrary
│  │  ├─ Import: AnimationPresets
│  │  ├─ Import: ComponentRegistry
│  │  │
│  │  ├─ new SystemsManager(hass)
│  │  ├─ new DataSourceManager(hass)
│  │  ├─ new StyleLibrary()
│  │  ├─ new AnimationPresets()
│  │  ├─ new ComponentRegistry()
│  │  │
│  │  ├─ await styleLibrary.loadFromYAML(...)
│  │  ├─ await animationPresets.loadFromYAML(...)
│  │  ├─ componentRegistry.registerDefaults()
│  │  │
│  │  └─ _coreInitialized = true
│  │
│  └─ await _processPendingCards()
│     └─ Register any cards that were queued
│
Second Card: connectedCallback()
│
├─ await core.initialize(hass)
│  │
│  ├─ Check: _coreInitialized? → Yes!
│  └─ Return immediately
│
└─ Cards now share initialized infrastructure
```

### 2. Event Bus System

**Purpose:** Enable card-to-card communication via pub/sub

**Features:**
- Type-safe event registration
- Wildcard subscriptions (`card.*`, `data_source.*`)
- Event history with replay for late subscribers
- Once-only subscriptions
- Debug mode with event logging

**API Surface:**

```javascript
class CBLCARSEventBus {
    // Subscription
    subscribe(eventType, cardId, callback, options): Function  // returns unsubscribe
    unsubscribe(eventType, cardId, callback): void
    
    // Publishing
    publish(eventType, data, metadata): void
    
    // History
    getHistory(eventType): Array<Event>
    clearHistory(): void
    
    // Debug
    getDebugInfo(): Object
}
```

**Usage Example:**

```javascript
// Card 1: Subscribe to events
class MyCard extends CBLCARSBaseCard {
    connectedCallback() {
        super.connectedCallback();
        
        // Subscribe with replay (get recent events)
        this._unsubAlert = window.cblcars.eventBus.subscribe(
            'alert.condition_changed',
            this._pipeline.cardId,
            (data) => this._handleAlertChange(data),
            { replay: true }
        );
        
        // Wildcard subscription
        this._unsubAll = window.cblcars.eventBus.subscribe(
            'card.*',
            this._pipeline.cardId,
            (data) => console.log('Card event:', data)
        );
    }
    
    disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubAlert?.();
        this._unsubAll?.();
    }
}

// Card 2: Publish events
class AlertButton extends CBLCARSBaseCard {
    _handleTap() {
        window.cblcars.eventBus.publish(
            'alert.condition_changed',
            { condition: 'red', timestamp: Date.now() },
            { sourceCard: this._pipeline.cardId }
        );
    }
}
```

**Event Naming Convention:**

```
<namespace>.<event_type>[.<detail>]

Examples:
  alert.condition_changed
  card.button_tapped
  data_source.weather.updated
  overlay.animation_complete
  system.theme_changed
```

### 3. Data Source Manager

**Purpose:** Centralized data fetching/polling with sharing and retry

**Features:**
- REST API polling with configurable intervals
- WebSocket connections
- Response caching
- Automatic retry on failure
- Multiple subscribers per source
- Config merging from multiple declarations

**API Surface:**

```javascript
class DataSourceManager {
    constructor(hass)
    
    // Lifecycle
    initialize(dataSourceConfig): void
    destroy(dsId): void
    
    // Subscriptions
    subscribe(dsId, cardId, callback): void
    unsubscribe(dsId, cardId): void
    
    // Data access
    getData(dsId): any
    
    // Updates
    updateHass(hass): void
    
    // Internal
    _startPolling(dsId): void
    _stopPolling(dsId): void
    _fetchData(dsId): Promise<any>
    _notifySubscribers(dsId, data): void
}
```

**Data Source Configuration:**

```yaml
# In card config (any card can declare)
data_sources:
  - id: weather
    type: rest
    url: https://api.weather.com/forecast
    method: GET
    refresh: 60  # seconds
    headers:
      Authorization: "Bearer ${secrets.weather_api_key}"
    transform: |
      (data) => ({
        temperature: data.main.temp,
        condition: data.weather[0].main
      })
    
  - id: system_metrics
    type: rest
    url: /api/hassio/system/info
    refresh: 10
    
  - id: mqtt_sensor
    type: websocket  # Future enhancement
    topic: home/sensors/#
```

**Declarative Flow with Retry:**

```
Card 1 loads (t=0ms)
│
├─ References: data.weather.temp
├─ core.registerCard()
│  ├─ Extract reference: "weather"
│  └─ Subscribe to "weather"
│     ├─ Check: Is "weather" initialized?
│     ├─ No! Declaration not found
│     ├─ Add to failedSubscriptions["weather"]
│     └─ ⚠️ Log: "Waiting for data source 'weather'"
│
Card 2 loads (t=300ms)
│
├─ Declares: data_sources[{ id: "weather", ... }]
├─ core.registerCard()
│  ├─ Extract declaration: "weather" config
│  └─ declareDataSource("weather", config)
│     ├─ Store in _dataSourceDeclarations
│     ├─ Check: First declaration?
│     ├─ Yes! Call _onDataSourceDeclared("weather")
│     │  ├─ Initialize data source
│     │  ├─ Start polling
│     │  └─ Retry failed subscriptions
│     │     └─ Card 1 now gets data! ✅
│     └─ ✅ Log: "Data source 'weather' initialized"
```

### 4. Rules Engine (Per-Card)

**Purpose:** Replace button-card state system with declarative rules

**Features:**
- Multiple condition types (state, attribute, numeric range, regex)
- Logical operators (AND, OR, NOT)
- Style preset application
- Animation triggers
- Custom context variables

**API Surface:**

```javascript
class RulesEngine {
    constructor(rules, styleLibrary, animationPresets)
    
    // Evaluation
    evaluate(entityState, customContext): RuleResult
    
    // Internal
    _evaluateCondition(condition, entityState, context): boolean
    _applyRuleResult(result): void
    
    // Cleanup
    destroy(): void
}

// Rule Result
interface RuleResult {
    matched: boolean
    stylePreset?: string
    inlineStyles?: Object
    animation?: string
    customData?: any
}
```

**Rule Configuration:**

```yaml
variables:
  rules:
    # Simple state match
    - condition:
        entity: ${entity}
        state: "on"
      apply:
        style_preset: active
        animation: pulse
    
    # Attribute range
    - condition:
        entity: ${entity}
        attribute: brightness
        from: 0
        to: 50
      apply:
        style_preset: dim
        inline_styles:
          opacity: 0.5
    
    # Multiple conditions (AND)
    - condition:
        entity: ${entity}
        state: "on"
        attribute: brightness
        from: 200
        to: 255
      apply:
        style_preset: active_bright
    
    # Logical operators
    - condition:
        or:
          - { entity: ${entity}, state: "unavailable" }
          - { entity: ${entity}, state: "unknown" }
      apply:
        style_preset: error
    
    # Regex match
    - condition:
        entity: ${entity}
        state_regex: "^(on|open|unlocked)$"
      apply:
        style_preset: active
```

**Replacing Legacy State Blocks:**

```yaml
# BEFORE (Legacy - 200+ lines)
state:
  - id: state_on
    operator: template
    value: |
      [[[
        return entity !== undefined && ['on', 'open', 'locked'].includes(states[entity.entity_id].state)
      ]]]
    styles:
      card:
        - background-color: '[[[ return variables.card.color.background.active ]]]'
        - border-top: |
            [[[
              return variables.__get_num_with_unit(variables.card.border.top.size) + " solid " + variables.card.color.active;
            ]]]
        # ... 50 more lines
  - id: state_off
    # ... another 50 lines
  - id: state_unavailable
    # ... another 50 lines

# AFTER (Modern - 10 lines)
variables:
  rules:
    - condition: { state: [on, open, locked] }
      apply: { style_preset: active }
    - condition: { state: [off, closed, unlocked] }
      apply: { style_preset: inactive }
    - condition: { state: [unavailable, unknown] }
      apply: { style_preset: error }
```

### 5. Style Library (Shared)

**Purpose:** Centralized style definitions with preset system

**Features:**
- YAML-defined presets
- Theme variants (green_alert, red_alert, etc.)
- Cascading styles
- Runtime theme switching

**Style Definition Format:**

```yaml
# /local/cb-lcars/styles.yaml
presets:
  # Base presets
  active:
    color: var(--lcars-ui-secondary)
    border_color: var(--lcars-ui-secondary)
    background: transparent
    opacity: 1
    
  inactive:
    color: var(--lcars-ui-tertiary)
    border_color: var(--lcars-ui-tertiary)
    background: transparent
    opacity: 0.6
    
  error:
    color: var(--lcars-red)
    border_color: var(--lcars-red)
    background: transparent
    opacity: 1
    animation: pulse_error
  
  # Component-specific presets
  button_lozenge:
    extends: active  # Inherit from 'active'
    border_radius: 30px
    padding: 10px 20px
    
  gauge_active:
    extends: active
    stroke_width: 3
    fill: none

# Themes (alert conditions)
themes:
  green_alert:
    primary: var(--lcars-green)
    secondary: var(--lcars-blue)
    
  yellow_alert:
    primary: var(--lcars-orange)
    secondary: var(--lcars-red)
    
  red_alert:
    primary: var(--lcars-red)
    secondary: var(--lcars-orange)
```

**API Surface:**

```javascript
class StyleLibrary {
    // Loading
    async loadFromYAML(url): Promise<void>
    
    // Access
    getPreset(presetName): Object
    getTheme(themeName): Object
    
    // Runtime
    setActiveTheme(themeName): void
    
    // Utilities
    resolvePreset(presetName): Object  // Handles 'extends'
}
```

### 6. Component Registry

**Purpose:** Register and create overlay/control types

**Features:**
- Factory pattern for components
- Extensible (users can register custom types)
- Type validation
- Default implementations

**API Surface:**

```javascript
class ComponentRegistry {
    // Registration
    registerOverlay(type, OverlayClass): void
    registerControl(type, ControlClass): void
    
    // Defaults
    registerDefaults(): void
    
    // Factory
    createOverlay(config, pipeline): BaseOverlay
    createControl(config, pipeline): BaseControl
    
    // Introspection
    getRegisteredOverlays(): string[]
    getRegisteredControls(): string[]
}
```

**Built-in Types:**

```javascript
// Overlays
registry.registerOverlay('line', LineOverlay);
registry.registerOverlay('text', TextOverlay);
registry.registerOverlay('svg', SVGOverlay);
registry.registerOverlay('sparkline', SparklineOverlay);
registry.registerOverlay('button', ButtonOverlay);
registry.registerOverlay('gauge', GaugeOverlay);

// Controls
registry.registerControl('slider', SliderControl);
registry.registerControl('button', ButtonControl);
registry.registerControl('tap', TapControl);
registry.registerControl('ha_card', HACardControl);
```

### 7. Base Overlay Class (Enhanced)

**Purpose:** Foundation for all overlays with loading states

**States:** `initializing` → `pending` → `ready` | `error`

**Lifecycle:**

```
initialize()
├─ State: "initializing"
├─ Check dependencies
│  ├─ Data source? → _waitForDataSource()
│  ├─ Entity? → _waitForEntity()
│  └─ Resources? → _waitForResources()
├─ State: "pending" (show loading indicator)
├─ await onInitialize() (subclass hook)
├─ Dependencies ready?
│  ├─ Yes → State: "ready", call render()
│  └─ No → State: "error", call _renderError()
└─ Done
```

**API Surface:**

```javascript
class BaseOverlay {
    constructor(config, pipeline)
    
    // Lifecycle hooks (override in subclass)
    async onInitialize(): Promise<void>
    render(): void
    onUpdate(data): void
    destroy(): void
    
    // Dependency management (internal)
    async _waitForDataSource(dsId): Promise<void>
    async _waitForEntity(entityId): Promise<void>
    
    // State rendering (internal)
    _renderPending(): void
    _createPendingElement(): SVGElement
    _animatePendingIndicator(element): void
    _renderError(): void
    _render(): void
}
```

**Pending State Visual:**

```xml
<!-- Overlay waiting for data source -->
<g id="overlay_123" class="overlay-pending" data-state="pending">
  <text x="100" y="100" 
        fill="var(--lcars-ui-tertiary)"
        font-size="12"
        font-family="Antonio">
    LOADING...
    <!-- Animated with: LOADING → LOADING. → LOADING.. → LOADING... -->
  </text>
</g>
```

**Error State Visual:**

```xml
<!-- Overlay failed to initialize -->
<g id="overlay_123" class="overlay-error" data-state="error">
  <text x="100" y="100"
        fill="var(--lcars-red)"
        font-size="12"
        font-family="Antonio">
    ERROR: Data source 'weather' not available
  </text>
</g>
```

### 8. Native Slider Control

**Purpose:** Replace `my-slider-v2` with native implementation

**Features:**
- Horizontal and vertical orientation
- Touch/mouse drag support
- Snap to steps
- Multiple modes (brightness, temperature, volume, etc.)
- Entity-aware (auto-detects min/max from attributes)
- Anime.js v4 animations
- LCARS styling
- Accessible (keyboard support)

**Component Structure:**

```javascript
class SliderControl extends HTMLElement {
    // Web Component lifecycle
    constructor()
    connectedCallback()
    disconnectedCallback()
    attributeChangedCallback(name, oldValue, newValue)
    
    // Setup
    _setupAnimation(): void
    _render(): void
    _attachEventListeners(): void
    
    // Interaction
    _onDragStart(e): void
    _onDragMove(e): void
    _onTrackClick(e): void
    _onKeyDown(e): void
    
    // Visual updates
    _updateVisuals(): void
    _animateThumb(percentage): void
    
    // Home Assistant integration
    setHass(hass, entity): void
    async callService(hass, entity): Promise<void>
    
    // Value mapping
    _getEntityValue(entity, mode): number
    _mapValueToPercentage(value, min, max): number
    _mapPercentageToValue(percentage, min, max): number
}
```

**Usage in Config:**

```yaml
variables:
  controls:
    - id: brightness_slider
      type: slider
      entity: light.desk
      mode: brightness  # brightness, temperature, volume, generic
      orientation: vertical
      min: 0  # Optional override
      max: 100
      step: 1
      style:
        track_color: var(--lcars-card-button-off)
        fill_color: var(--lcars-card-button)
        thumb_color: white
        thumb_border: 3px solid black
        height: 12px
        width: 100%
```

---

## Implementation Phases

### Phase 1: Core Infrastructure Foundation

**Goal:** Extract and unify core systems from MSD

**Duration Estimate:** High priority, foundational work

#### Tasks

##### 1.1: Create Core Module Structure

**Files to Create:**
```
src/core/
├── cb-lcars-core.js              # Main CBLCARSCore class
├── cb-lcars-init.js              # Lightweight initialization
├── systems-manager/
│   ├── index.js                  # SystemsManager (extracted from MSD)
│   └── entity-tracker.js         # Entity subscription/notification
├── data-sources/
│   ├── index.js                  # DataSourceManager
│   ├── rest-source.js            # REST API polling
│   └── websocket-source.js       # WebSocket (future)
├── rules-engine/
│   ├── index.js                  # RulesEngine
│   ├── condition-evaluator.js   # Condition matching logic
│   └── rule-matcher.js           # Rule resolution
└── styling/
    ├── style-library.js          # StyleLibrary
    └── theme-manager.js          # Theme switching
```

**Code: Core Initialization (cb-lcars-init.js)**

```javascript
// src/core/cb-lcars-init.js
/**
 * CB-LCARS Lightweight Infrastructure Initialization
 * 
 * This module initializes zero-config systems when cb-lcars.js loads
 * Heavy systems (core, data sources) initialize lazily on first card
 * 
 * INITIALIZED IMMEDIATELY:
 * - Event Bus (~5KB)
 * - Animation API (~1KB)
 * - SVG Helpers (~2KB)
 * - Debug API (~1KB)
 * 
 * Total overhead: ~9KB
 */

import { CBLCARSEventBus } from './cb-lcars-event-bus.js';
import { cblcarsLog } from '../utils/cb-lcars-logging.js';

/**
 * Initialize lightweight systems
 * Called automatically when cb-lcars.js module loads
 */
export function initializeLightweightSystems() {
    cblcarsLog.info('[CB-LCARS] 🚀 Initializing lightweight infrastructure');

    // Ensure global namespace
    window.cblcars = window.cblcars || {};

    // ===== EVENT BUS =====
    // Always available for card-to-card communication
    if (!window.cblcars.eventBus) {
        window.cblcars.eventBus = new CBLCARSEventBus({
            debug: false,
            historyLimit: 100
        });
        cblcarsLog.info('[CB-LCARS] ✅ Event bus initialized (5KB overhead)');
    }

    // ===== ANIMATION API =====
    // Expose anime.js v4 with unified API
    if (!window.cblcars.anim) {
        // Import statements for anime and helpers should be at module level
        window.cblcars.anim = {
            animejs: window.anime,  // Full anime.js module
            anime: window.anime?.animate,  // Shortcut for animate
            utils: window.anime?.utils,  // Utilities
            scopes: new Map(),  // Scope tracking
            
            // Helper references (imported at module level)
            animateElement: null,  // Set by main module
            animateWithRoot: null,
            waitForElement: null,
            presets: null
        };
        cblcarsLog.info('[CB-LCARS] ✅ Animation API initialized');
    }

    // ===== SVG HELPERS =====
    // Pure functions for SVG manipulation
    if (!window.cblcars.svgHelpers) {
        window.cblcars.svgHelpers = null;  // Set by main module
        window.cblcars.anchorHelpers = null;
        cblcarsLog.info('[CB-LCARS] ✅ SVG helpers registered');
    }

    // ===== THEME/STYLING HELPERS =====
    if (!window.cblcars.loadFont) {
        window.cblcars.loadFont = null;  // Set by main module
        window.cblcars.setAlertCondition = null;
        window.cblcars.getSVGFromCache = null;
        cblcarsLog.info('[CB-LCARS] ✅ Theme helpers registered');
    }

    // ===== DEBUG API =====
    if (!window.cblcars.debug) {
        window.cblcars.debug = {
            setLevel: null,  // Set by main module
            getLevel: null,
            getInfo: () => ({
                version: window.CBLCARS?.version || 'unknown',
                eventBusActive: !!window.cblcars.eventBus,
                coreInitialized: window.cblcars.core?._coreInitialized || false,
                cardsLoaded: window.cblcars.core?._cardInstances.size || 0,
                dataSourcesActive: window.cblcars.core?._initializedDataSources.size || 0
            }),
            eventBus: () => window.cblcars.eventBus?.getDebugInfo(),
            core: () => window.cblcars.core?.getDebugInfo()
        };
        cblcarsLog.info('[CB-LCARS] ✅ Debug API initialized');
    }

    cblcarsLog.info('[CB-LCARS] 🎉 Lightweight infrastructure ready (~9KB overhead)');
}
```

**Code: CBLCARSCore (cb-lcars-core.js)**

```javascript
// src/core/cb-lcars-core.js
/**
 * CB-LCARS Core System
 * 
 * Central coordinator for all CB-LCARS infrastructure
 * Singleton pattern - one instance shared by all cards
 * 
 * RESPONSIBILITIES:
 * - Initialize shared systems (SystemsManager, DataSourceManager, etc.)
 * - Register/unregister cards
 * - Coordinate data source declarations and subscriptions
 * - Provide pipelines to cards
 * - Handle retry logic for missing dependencies
 * 
 * INITIALIZATION:
 * - Created at module load (constructor only)
 * - Initialized on first card load (initialize() method)
 * - Subsequent cards reuse existing instance
 */

import { cblcarsLog } from '../utils/cb-lcars-logging.js';

export class CBLCARSCore {
    constructor() {
        // ===== SHARED SYSTEMS (Lazy-initialized) =====
        this.systemsManager = null;      // Entity state tracking
        this.dataSourceManager = null;   // Data fetching/polling
        this.styleLibrary = null;        // Style presets
        this.animationPresets = null;    // Animation definitions
        this.componentRegistry = null;   // Overlay/control types

        // ===== DATA SOURCE REGISTRY =====
        this._dataSourceDeclarations = new Map();  // Map<dsId, Declaration[]>
        this._initializedDataSources = new Set();  // Set<dsId>
        this._failedDataSourceSubscriptions = new Map();  // Map<dsId, Set<{cardId, callback}>>

        // ===== CARD REGISTRY =====
        this._cardInstances = new Map();  // Map<cardId, CardContext>
        this._cardLoadOrder = [];  // Array<cardId> for debugging

        // ===== INITIALIZATION STATE =====
        this._coreInitialized = false;
        this._coreInitPromise = null;
        this._pendingCards = [];  // Cards waiting for core initialization
    }

    /**
     * Initialize core systems
     * Safe to call multiple times - only initializes once
     * 
     * @param {Object} hass - Home Assistant instance
     * @returns {Promise<void>}
     */
    async initialize(hass) {
        // Return existing promise if initialization in progress
        if (this._coreInitPromise) {
            cblcarsLog.debug('[CBLCARSCore] Core initialization already in progress, waiting...');
            return this._coreInitPromise;
        }

        // Already initialized
        if (this._coreInitialized) {
            cblcarsLog.debug('[CBLCARSCore] Core already initialized');
            return;
        }

        // Start initialization
        cblcarsLog.info('[CBLCARSCore] 🚀 Starting core initialization');
        this._coreInitPromise = this._doInitialize(hass);
        
        try {
            await this._coreInitPromise;
        } catch (error) {
            cblcarsLog.error('[CBLCARSCore] Core initialization failed:', error);
            this._coreInitPromise = null;
            throw error;
        }

        return this._coreInitPromise;
    }

    /**
     * Internal initialization implementation
     * @private
     */
    async _doInitialize(hass) {
        cblcarsLog.info('[CBLCARSCore] Loading core modules...');

        // Import and initialize shared systems
        const { SystemsManager } = await import('./systems-manager/index.js');
        const { DataSourceManager } = await import('./data-sources/index.js');
        const { StyleLibrary } = await import('./styling/style-library.js');
        const { AnimationPresets } = await import('./animation/presets.js');
        const { ComponentRegistry } = await import('../components/registry.js');

        this.systemsManager = new SystemsManager(hass);
        this.dataSourceManager = new DataSourceManager(hass);
        this.styleLibrary = new StyleLibrary();
        this.animationPresets = new AnimationPresets();
        this.componentRegistry = new ComponentRegistry();

        cblcarsLog.info('[CBLCARSCore] ✅ Core modules instantiated');

        // Load shared resources
        cblcarsLog.info('[CBLCARSCore] Loading shared resources...');
        await Promise.all([
            this.styleLibrary.loadFromYAML('/local/cb-lcars/styles.yaml'),
            this.animationPresets.loadFromYAML('/local/cb-lcars/animations.yaml')
        ]);

        this.componentRegistry.registerDefaults();

        this._coreInitialized = true;
        cblcarsLog.info('[CBLCARSCore] ✅ Core initialization complete');

        // Process any cards that were waiting
        await this._processPendingCards();
    }

    /**
     * Process cards that tried to register before core was ready
     * @private
     */
    async _processPendingCards() {
        if (this._pendingCards.length === 0) return;

        cblcarsLog.info(`[CBLCARSCore] Processing ${this._pendingCards.length} pending cards`);

        for (const { cardId, card, config, resolve } of this._pendingCards) {
            try {
                const context = await this._doRegisterCard(cardId, card, config);
                resolve(context);
            } catch (error) {
                cblcarsLog.error(`[CBLCARSCore] Failed to process pending card ${cardId}:`, error);
            }
        }

        this._pendingCards = [];
    }

    /**
     * Declare a data source from a card's config
     * Does NOT initialize the data source yet - just registers the declaration
     * 
     * @param {string} cardId - Card declaring the data source
     * @param {Object} dataSourceConfig - Data source configuration
     */
    declareDataSource(cardId, dataSourceConfig) {
        const dsId = dataSourceConfig.id;

        if (!dsId) {
            cblcarsLog.warn(`[CBLCARSCore] Card ${cardId} declared data source without id:`, dataSourceConfig);
            return;
        }

        // Track if this is the first declaration
        const isFirstDeclaration = !this._dataSourceDeclarations.has(dsId);

        // Get existing declarations for this data source ID
        let declarations = this._dataSourceDeclarations.get(dsId);
        if (!declarations) {
            declarations = [];
            this._dataSourceDeclarations.set(dsId, declarations);
        }

        // Add this declaration
        const declaration = {
            cardId,
            config: dataSourceConfig,
            declaredAt: Date.now()
        };

        declarations.push(declaration);

        cblcarsLog.debug(`[CBLCARSCore] Card ${cardId} declared data source '${dsId}' (${declarations.length} total declarations)`);

        // If this is first declaration AND we have failed subscriptions, retry them
        if (isFirstDeclaration) {
            this._onDataSourceDeclared(dsId);
        }

        // If core is already initialized, try to initialize this data source
        if (this._coreInitialized && !this._initializedDataSources.has(dsId)) {
            this._initializeDataSource(dsId);
        }
    }

    /**
     * Initialize a data source using merged configuration from all declarations
     * @private
     * @param {string} dsId - Data source ID
     */
    _initializeDataSource(dsId) {
        if (this._initializedDataSources.has(dsId)) {
            cblcarsLog.debug(`[CBLCARSCore] Data source '${dsId}' already initialized`);
            return;
        }

        const declarations = this._dataSourceDeclarations.get(dsId);
        if (!declarations || declarations.length === 0) {
            cblcarsLog.warn(`[CBLCARSCore] No declarations found for data source '${dsId}'`);
            return;
        }

        // Merge configurations from all declarations
        const mergedConfig = this._mergeDataSourceConfigs(dsId, declarations);

        cblcarsLog.info(`[CBLCARSCore] 🔌 Initializing data source '${dsId}' with merged config from ${declarations.length} card(s)`);

        try {
            // Initialize in DataSourceManager
            this.dataSourceManager.initialize(mergedConfig);
            this._initializedDataSources.add(dsId);

            cblcarsLog.info(`[CBLCARSCore] ✅ Data source '${dsId}' initialized successfully`);
        } catch (error) {
            cblcarsLog.error(`[CBLCARSCore] Failed to initialize data source '${dsId}':`, error);
        }
    }

    /**
     * Merge multiple data source configurations
     * Strategy: First declaration wins for most fields, but merge some arrays
     * 
     * @private
     * @param {string} dsId - Data source ID
     * @param {Array} declarations - Array of {cardId, config, declaredAt}
     * @returns {Object} Merged configuration
     */
    _mergeDataSourceConfigs(dsId, declarations) {
        if (declarations.length === 1) {
            return declarations[0].config;
        }

        // Sort by declaration time (earliest first)
        const sorted = [...declarations].sort((a, b) => a.declaredAt - b.declaredAt);

        const primary = sorted[0];
        const conflicts = sorted.slice(1);

        cblcarsLog.debug(`[CBLCARSCore] Merging data source '${dsId}' configs:`, {
            primary: primary.cardId,
            conflicts: conflicts.map(d => d.cardId)
        });

        // Start with primary config
        const merged = { ...primary.config };

        // Check for conflicts and warn
        for (const conflict of conflicts) {
            const conf = conflict.config;

            // Check for conflicting settings
            if (conf.type && conf.type !== merged.type) {
                cblcarsLog.warn(`[CBLCARSCore] Data source '${dsId}': Type conflict! ${primary.cardId} declares '${merged.type}', ${conflict.cardId} declares '${conf.type}'. Using '${merged.type}'`);
            }

            if (conf.url && conf.url !== merged.url) {
                cblcarsLog.warn(`[CBLCARSCore] Data source '${dsId}': URL conflict! Using URL from ${primary.cardId}`);
            }

            if (conf.refresh && conf.refresh !== merged.refresh) {
                // Use most frequent refresh (lowest interval)
                if (conf.refresh < merged.refresh) {
                    cblcarsLog.info(`[CBLCARSCore] Data source '${dsId}': Using faster refresh rate (${conf.refresh}s) from ${conflict.cardId}`);
                    merged.refresh = conf.refresh;
                }
            }

            // Merge transform functions (apply all in sequence)
            if (conf.transform) {
                if (!merged.transforms) {
                    merged.transforms = merged.transform ? [merged.transform] : [];
                }
                merged.transforms.push(conf.transform);
                cblcarsLog.debug(`[CBLCARSCore] Data source '${dsId}': Added transform from ${conflict.cardId}`);
            }
        }

        return merged;
    }

    /**
     * Called when a data source is declared for the first time
     * Retry any failed subscriptions
     * @private
     */
    _onDataSourceDeclared(dsId) {
        const failedSubs = this._failedDataSourceSubscriptions.get(dsId);
        if (!failedSubs || failedSubs.size === 0) return;
        
        cblcarsLog.info(`[CBLCARSCore] ✅ Data source '${dsId}' now declared, retrying ${failedSubs.size} failed subscriptions`);
        
        // Initialize the data source if core is ready
        if (this._coreInitialized) {
            this._initializeDataSource(dsId);
        }
        
        // Retry all failed subscriptions
        for (const { cardId, callback } of failedSubs) {
            if (this._coreInitialized && this._initializedDataSources.has(dsId)) {
                this.dataSourceManager.subscribe(dsId, cardId, callback);
                
                // Notify the card that data source is now available
                const context = this._cardInstances.get(cardId);
                if (context?.card?._onDataSourceReady) {
                    context.card._onDataSourceReady(dsId);
                }
            }
        }
        
        this._failedDataSourceSubscriptions.delete(dsId);
    }

    /**
     * Subscribe to data source with retry on failure
     * @private
     */
    _subscribeToDataSource(dsId, cardId, callback) {
        // Try to initialize if not already
        if (!this._initializedDataSources.has(dsId)) {
            const declarations = this._dataSourceDeclarations.get(dsId);
            
            if (!declarations || declarations.length === 0) {
                // No declaration yet - track for retry
                cblcarsLog.warn(`[CBLCARSCore] Card ${cardId} references undefined data source '${dsId}' - will retry when declared`);
                
                if (!this._failedDataSourceSubscriptions.has(dsId)) {
                    this._failedDataSourceSubscriptions.set(dsId, new Set());
                }
                this._failedDataSourceSubscriptions.get(dsId).add({ cardId, callback });
                
                return false; // Subscription failed
            }
            
            // Has declarations, initialize now
            this._initializeDataSource(dsId);
        }
        
        // Subscribe to data source manager
        this.dataSourceManager.subscribe(dsId, cardId, callback);
        return true; // Subscription succeeded
    }

    /**
     * Register a card instance
     * This can happen BEFORE core is initialized
     * 
     * @param {string} cardId - Unique card identifier
     * @param {Object} card - Card instance
     * @param {Object} config - Card configuration
     * @returns {Promise<Object>} Card context
     */
    async registerCard(cardId, card, config) {
        cblcarsLog.info(`[CBLCARSCore] Registering card: ${cardId} (order: ${this._cardLoadOrder.length + 1})`);
        this._cardLoadOrder.push(cardId);

        // Declare any data sources from this card's config
        const dataSources = this._extractDataSources(config);
        for (const ds of dataSources) {
            this.declareDataSource(cardId, ds);
        }

        // If core not initialized yet, queue this card
        if (!this._coreInitialized) {
            cblcarsLog.debug(`[CBLCARSCore] Core not ready, queuing card ${cardId}`);
            
            // Start core initialization if not already started
            if (!this._coreInitPromise) {
                // We need hass to initialize, try to get it from the card
                if (card.hass) {
                    this.initialize(card.hass);
                }
            }

            // Return a promise that will resolve when core is ready
            return new Promise((resolve) => {
                this._pendingCards.push({ cardId, card, config, resolve });
            });
        }

        // Core is ready, register immediately
        return this._doRegisterCard(cardId, card, config);
    }

    /**
     * Actually register the card (after core is initialized)
     * @private
     */
    async _doRegisterCard(cardId, card, config) {
        // Create per-card rules engine
        const { RulesEngine } = await import('./rules-engine/index.js');
        const rulesEngine = new RulesEngine(
            config.variables?.rules || [],
            this.styleLibrary,
            this.animationPresets
        );

        // Collect entities for this card
        const entities = this._collectEntities(config);

        // Subscribe to entities in SystemsManager
        for (const entityId of entities) {
            this.systemsManager.subscribe(entityId, cardId, (state) => {
                card._onEntityUpdate?.(entityId, state);
            });
        }

        // Subscribe to data sources
        const dataSourceRefs = this._extractDataSourceReferences(config);
        for (const dsRef of dataSourceRefs) {
            this._subscribeToDataSource(dsRef.id, cardId, (data) => {
                card._onDataSourceUpdate?.(dsRef.id, data);
            });
        }

        // Create card context
        const context = {
            cardId,
            card,
            config,
            rulesEngine,
            entities,
            dataSources: dataSourceRefs,
            createdAt: Date.now()
        };

        this._cardInstances.set(cardId, context);

        cblcarsLog.info(`[CBLCARSCore] ✅ Card ${cardId} registered successfully`);
        return context;
    }

    /**
     * Create pipeline for a card
     * @param {Object} card - Card instance
     * @param {Object} config - Card configuration
     * @param {boolean} fullMSD - Whether this is a full MSD card
     * @returns {Promise<Object>} Pipeline
     */
    async createPipeline(card, config, fullMSD = false) {
        const cardId = `${config.type}-${card.id || Math.random().toString(36).slice(2)}`;
        
        // Register the card (will wait for core if needed)
        const context = await this.registerCard(cardId, card, config);

        if (fullMSD) {
            return this._createMSDPipeline(context);
        } else {
            return this._createLightPipeline(context);
        }
    }

    /**
     * Create lightweight pipeline for standalone cards
     * @private
     */
    _createLightPipeline(context) {
        return {
            cardId: context.cardId,
            
            // Shared system references
            systemsManager: this.systemsManager,
            dataSourceManager: this.dataSourceManager,
            styleLibrary: this.styleLibrary,
            animationPresets: this.animationPresets,
            componentRegistry: this.componentRegistry,
            
            // Per-card rules engine
            rulesEngine: context.rulesEngine,
            
            /**
             * Get entity state
             */
            getEntityState: (entityId) => {
                return this.systemsManager.getState(entityId);
            },
            
            /**
             * Get data from data source
             */
            getDataSource: (dsId) => {
                return this.dataSourceManager.getData(dsId);
            },
            
            /**
             * Evaluate rules for current state
             */
            evaluateRules: (entityId, customContext = {}) => {
                const state = this.systemsManager.getState(entityId);
                return context.rulesEngine.evaluate(state, customContext);
            },
            
            /**
             * Apply styles from rule evaluation
             */
            applyStyles: (element, ruleResult) => {
                if (ruleResult.stylePreset) {
                    const styles = this.styleLibrary.getPreset(ruleResult.stylePreset);
                    Object.assign(element.style, styles);
                }
                if (ruleResult.inlineStyles) {
                    Object.assign(element.style, ruleResult.inlineStyles);
                }
            },
            
            /**
             * Update HASS reference
             */
            ingestHass: (hass) => {
                this.systemsManager.updateHass(hass);
                this.dataSourceManager.updateHass(hass);
            },
            
            /**
             * Cleanup
             */
            destroy: () => {
                this.unregisterCard(context.cardId);
            }
        };
    }

    /**
     * Create full MSD pipeline
     * @private
     */
    async _createMSDPipeline(context) {
        const { initMsdPipeline } = await import('../msd/index.js');
        
        return await initMsdPipeline(
            context.card,
            context.config,
            {
                systemsManager: this.systemsManager,
                dataSourceManager: this.dataSourceManager,
                styleLibrary: this.styleLibrary,
                animationPresets: this.animationPresets,
                componentRegistry: this.componentRegistry,
                rulesEngine: context.rulesEngine,
                core: this
            }
        );
    }

    /**
     * Unregister a card
     */
    unregisterCard(cardId) {
        const context = this._cardInstances.get(cardId);
        if (!context) return;

        cblcarsLog.info(`[CBLCARSCore] Unregistering card: ${cardId}`);

        // Unsubscribe from entities
        for (const entityId of context.entities) {
            this.systemsManager.unsubscribe(entityI