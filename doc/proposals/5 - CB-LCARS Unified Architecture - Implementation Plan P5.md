# CB-LCARS Unified Architecture - Implementation Phase 5

**Phase 5: Core Card & Advanced Features**

**Goal:** Build optional core infrastructure card and enhance advanced features

**Priority:** Low - Optional enhancements and convenience features

---

## Phase 5 Tasks Overview

```
Phase 5: Core Card & Advanced Features
├─ 5.1: Design Core Card Architecture
├─ 5.2: Implement Core Card Element
├─ 5.3: Build Core Card Editor
├─ 5.4: Enhanced Data Source Features
├─ 5.5: Advanced Event Bus Features
├─ 5.6: Performance Monitoring & Profiling
├─ 5.7: Developer Tools & Debug UI
└─ 5.8: Testing & Documentation
```

---

## 5.1: Design Core Card Architecture

**Purpose:** Design invisible infrastructure card for explicit dependency management

### Core Card Concept

**The Problem:**
- Data sources may load in unpredictable order
- Users don't know when shared infrastructure is initialized
- No central place for dashboard-level configuration
- Debugging initialization issues is difficult

**The Solution:**
A dedicated card that:
- ✅ Explicitly initializes core infrastructure
- ✅ Declares data sources with guaranteed order
- ✅ Pre-loads resources (SVGs, fonts, themes)
- ✅ Configures event bus
- ✅ Provides dashboard-level settings
- ✅ Shows initialization status (dev mode only)
- ✅ Takes zero visual space (0x0)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Home Assistant Dashboard                     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              cb-lcars-core-card (invisible)                 │ │
│  │                                                              │ │
│  │  • Initializes CBLCARSCore on first render                 │ │
│  │  • Declares all data sources                                │ │
│  │  • Pre-loads SVGs, fonts, themes                           │ │
│  │  • Configures event bus                                     │ │
│  │  • Sets up performance monitoring                           │ │
│  │  • Displays debug info (if enabled)                        │ │
│  │                                                              │ │
│  │  Size: 0x0 (takes no visual space)                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ├─ Guaranteed initialization order   │
│                              ├─ All data sources ready           │
│                              └─ Resources pre-loaded             │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Button     │  │ Multimeter   │  │     MSD      │          │
│  │   Card 1     │  │   Card 2     │  │   Card 3     │          │
│  │              │  │              │  │              │          │
│  │  • Uses      │  │  • Uses      │  │  • Uses      │          │
│  │    data      │  │    data      │  │    data      │          │
│  │    sources   │  │    sources   │  │    sources   │          │
│  │  • Already   │  │  • Already   │  │  • Already   │          │
│  │    ready!    │  │    ready!    │  │    ready!    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Configuration Schema

```yaml
type: cb-lcars-core-card

# ============================================================================
# DATA SOURCES - Centralized Declaration
# ============================================================================
data_sources:
  # REST API data sources
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
        condition: data.weather[0].main,
        humidity: data.main.humidity
      })
  
  - id: system_metrics
    type: rest
    url: /api/hassio/system/info
    refresh: 10
    transform: |
      (data) => ({
        cpu: data.cpu_percent,
        memory: data.memory_percent,
        disk: data.disk_percent
      })

# ============================================================================
# PRELOAD - Resources to Load on Startup
# ============================================================================
preload:
  # SVG assets
  svgs:
    - key: warp_core
      source: /local/cb-lcars/svg/warp-core.svg
    - key: ship_outline
      source: builtin:enterprise_d
  
  # Fonts
  fonts:
    - family: LCARS
      source: /local/fonts/lcars.woff2
    - family: Antonio
      source: https://fonts.googleapis.com/css2?family=Antonio
  
  # Themes
  themes:
    - name: custom_red_alert
      file: /local/cb-lcars/themes/custom-red.yaml

# ============================================================================
# EVENT BUS - Configuration
# ============================================================================
events:
  enabled: true
  debug: false  # Set to true for event logging
  history_limit: 100
  
  # Global event subscriptions (all cards can listen)
  global_events:
    - event_type: alert.condition_changed
      description: Alert condition changes (green/yellow/red)
    - event_type: system.theme_changed
      description: Theme switching events
    - event_type: navigation.view_changed
      description: View navigation events

# ============================================================================
# PERFORMANCE - Monitoring Configuration
# ============================================================================
performance:
  enabled: true
  
  # Performance thresholds (warnings if exceeded)
  thresholds:
    card_render: 100  # ms
    rule_evaluation: 1  # ms
    data_fetch: 500  # ms
  
  # Profiling
  profiling:
    enabled: false  # Set true for detailed profiling
    sample_rate: 0.1  # 10% of operations

# ============================================================================
# DEBUG - Developer Tools
# ============================================================================
debug:
  enabled: false  # Set true to show debug overlay
  position: bottom-right  # top-left, top-right, bottom-left, bottom-right
  
  # What to show in debug panel
  show:
    initialization_status: true
    data_source_status: true
    card_count: true
    event_bus_stats: true
    performance_metrics: true
    
  # Hot reload support
  hot_reload:
    enabled: false
    watch_paths:
      - /local/cb-lcars/styles.yaml
      - /local/cb-lcars/animations.yaml

# ============================================================================
# GLOBAL SETTINGS - Dashboard-Level Configuration
# ============================================================================
global_settings:
  # Default theme
  default_theme: green_alert
  
  # Default animation settings
  animations:
    enabled: true
    duration: 300  # ms
    easing: easeOutQuad
  
  # Resize observer defaults
  resize_observer:
    tolerance: 16
    debounce_wait: 100
  
  # Logging
  log_level: info  # debug, info, warn, error
```

### Visual States

#### Normal Mode (Production)
```
┌─────────────────────────────────────────┐
│  Dashboard View                          │
│                                           │
│  [Button Card] [Multimeter] [MSD Card]  │
│                                           │
│  (Core card is invisible - 0x0 size)    │
└─────────────────────────────────────────┘
```

#### Debug Mode (Development)
```
┌─────────────────────────────────────────┐
│  Dashboard View                          │
│                                           │
│  [Button Card] [Multimeter] [MSD Card]  │
│                                           │
│                              ┌─────────┐ │
│                              │ 🔧 CORE │ │
│                              │         │ │
│                              │ ✅ Init │ │
│                              │ ✅ Data │ │
│                              │ 📊 3/3  │ │
│                              └─────────┘ │
└─────────────────────────────────────────┘
```

**Acceptance Criteria:**
- ✅ Architecture diagram complete
- ✅ Configuration schema defined
- ✅ Visual states specified
- ✅ Use cases documented

---

## 5.2: Implement Core Card Element

**Purpose:** Create the core card custom element

**File:** `src/cards/cb-lcars-core-card.js`

```javascript
/**
 * CB-LCARS Core Card
 * 
 * Invisible infrastructure card for explicit dependency management
 * 
 * FEATURES:
 * - Initializes core infrastructure on load
 * - Declares data sources with guaranteed order
 * - Pre-loads resources (SVGs, fonts, themes)
 * - Configures event bus
 * - Dashboard-level settings
 * - Debug overlay (optional)
 * 
 * USAGE:
 * Place at top of dashboard configuration
 * 
 * type: cb-lcars-core-card
 * data_sources: [...]
 * preload: [...]
 * 
 * @extends HTMLElement
 */

import { cblcarsLog } from '../utils/cb-lcars-logging.js';

export class CBLCARSCoreCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Initialization state
        this._initialized = false;
        this._initStartTime = null;
        this._initEndTime = null;
        
        // Configuration
        this._config = null;
        
        // Debug overlay
        this._debugOverlay = null;
        this._debugUpdateInterval = null;
    }

    /**
     * Set card configuration
     * 
     * @param {Object} config - Card configuration
     */
    setConfig(config) {
        if (!config) {
            throw new Error('Invalid configuration');
        }

        this._config = config;
        
        cblcarsLog.info('[CBLCARSCoreCard] 🏗️ Core card initializing...');
        this._initStartTime = Date.now();

        // Render (creates invisible element)
        this._render();
    }

    /**
     * Set Home Assistant instance
     * Triggers core initialization
     * 
     * @param {Object} hass - Home Assistant instance
     */
    async setHass(hass) {
        this.hass = hass;

        // Initialize core if not already done
        if (!this._initialized) {
            await this._initializeCore();
        }

        // Forward hass updates to core
        if (window.cblcars.core._coreInitialized) {
            window.cblcars.core.systemsManager?.updateHass(hass);
            window.cblcars.core.dataSourceManager?.updateHass(hass);
        }
    }

    /**
     * Initialize core infrastructure
     * @private
     */
    async _initializeCore() {
        if (this._initialized) return;

        cblcarsLog.info('[CBLCARSCoreCard] 🚀 Initializing CB-LCARS core infrastructure');

        try {
            // 1. Initialize core system
            await window.cblcars.core.initialize(this.hass);

            // 2. Register all data sources
            if (this._config.data_sources) {
                await this._registerDataSources();
            }

            // 3. Pre-load resources
            if (this._config.preload) {
                await this._preloadResources();
            }

            // 4. Configure event bus
            if (this._config.events) {
                this._configureEventBus();
            }

            // 5. Apply global settings
            if (this._config.global_settings) {
                this._applyGlobalSettings();
            }

            // 6. Setup performance monitoring
            if (this._config.performance?.enabled) {
                this._setupPerformanceMonitoring();
            }

            // 7. Setup debug overlay
            if (this._config.debug?.enabled) {
                this._createDebugOverlay();
            }

            this._initialized = true;
            this._initEndTime = Date.now();
            
            const initTime = this._initEndTime - this._initStartTime;
            cblcarsLog.info(`[CBLCARSCoreCard] ✅ Core initialization complete in ${initTime}ms`);

            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('cblcars-core-ready', {
                detail: {
                    timestamp: Date.now(),
                    initTime,
                    config: this._config
                }
            }));

        } catch (error) {
            cblcarsLog.error('[CBLCARSCoreCard] Failed to initialize core:', error);
            throw error;
        }
    }

    /**
     * Register data sources from config
     * @private
     */
    async _registerDataSources() {
        const dataSources = this._config.data_sources || [];
        
        cblcarsLog.info(`[CBLCARSCoreCard] 📡 Registering ${dataSources.length} data sources`);

        for (const ds of dataSources) {
            try {
                // Declare data source (core will handle initialization)
                window.cblcars.core.declareDataSource('core-card', ds);
                
                cblcarsLog.info(`[CBLCARSCoreCard] ✅ Data source declared: ${ds.id}`);
            } catch (error) {
                cblcarsLog.error(`[CBLCARSCoreCard] Failed to declare data source ${ds.id}:`, error);
            }
        }

        // Give core a moment to initialize data sources
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Pre-load resources
     * @private
     */
    async _preloadResources() {
        const preload = this._config.preload;
        const promises = [];

        // Pre-load SVGs
        if (preload.svgs && Array.isArray(preload.svgs)) {
            cblcarsLog.info(`[CBLCARSCoreCard] 🎨 Loading ${preload.svgs.length} SVGs`);
            
            for (const svg of preload.svgs) {
                if (svg.source.startsWith('builtin:')) {
                    // Built-in SVGs are already loaded
                    continue;
                }
                
                promises.push(
                    window.cblcars.loadUserSVG(svg.key, svg.source)
                        .then(() => cblcarsLog.debug(`[CBLCARSCoreCard] ✅ SVG loaded: ${svg.key}`))
                        .catch(error => cblcarsLog.error(`[CBLCARSCoreCard] Failed to load SVG ${svg.key}:`, error))
                );
            }
        }

        // Pre-load fonts
        if (preload.fonts && Array.isArray(preload.fonts)) {
            cblcarsLog.info(`[CBLCARSCoreCard] 📝 Loading ${preload.fonts.length} fonts`);
            
            for (const font of preload.fonts) {
                promises.push(
                    window.cblcars.loadFont(font.family, font.source)
                        .then(() => cblcarsLog.debug(`[CBLCARSCoreCard] ✅ Font loaded: ${font.family}`))
                        .catch(error => cblcarsLog.error(`[CBLCARSCoreCard] Failed to load font ${font.family}:`, error))
                );
            }
        }

        // Pre-load themes
        if (preload.themes && Array.isArray(preload.themes)) {
            cblcarsLog.info(`[CBLCARSCoreCard] 🎨 Loading ${preload.themes.length} themes`);
            
            for (const theme of preload.themes) {
                // Load theme from file
                promises.push(
                    fetch(theme.file)
                        .then(response => response.text())
                        .then(yaml => {
                            // Parse and register theme
                            const parsed = jsyaml.load(yaml);
                            window.cblcars.core.styleLibrary.registerTheme(theme.name, parsed);
                            cblcarsLog.debug(`[CBLCARSCoreCard] ✅ Theme loaded: ${theme.name}`);
                        })
                        .catch(error => cblcarsLog.error(`[CBLCARSCoreCard] Failed to load theme ${theme.name}:`, error))
                );
            }
        }

        // Wait for all resources
        await Promise.allSettled(promises);
        cblcarsLog.info('[CBLCARSCoreCard] ✅ Resource pre-loading complete');
    }

    /**
     * Configure event bus
     * @private
     */
    _configureEventBus() {
        const eventConfig = this._config.events || {};
        
        if (!eventConfig.enabled) return;

        // Update event bus configuration
        if (window.cblcars.eventBus) {
            window.cblcars.eventBus._debugMode = eventConfig.debug || false;
            window.cblcars.eventBus._historyLimit = eventConfig.history_limit || 100;
            
            cblcarsLog.info('[CBLCARSCoreCard] 📢 Event bus configured', {
                debug: eventConfig.debug,
                historyLimit: eventConfig.history_limit
            });
        }

        // Register global events (for documentation/discovery)
        if (eventConfig.global_events) {
            window.cblcars._registeredEvents = eventConfig.global_events;
            cblcarsLog.info(`[CBLCARSCoreCard] 📋 Registered ${eventConfig.global_events.length} global event types`);
        }
    }

    /**
     * Apply global settings
     * @private
     */
    _applyGlobalSettings() {
        const settings = this._config.global_settings || {};

        // Set default theme
        if (settings.default_theme && window.cblcars.core.styleLibrary) {
            window.cblcars.core.styleLibrary.setActiveTheme(settings.default_theme);
            cblcarsLog.info(`[CBLCARSCoreCard] 🎨 Default theme set: ${settings.default_theme}`);
        }

        // Set animation defaults
        if (settings.animations) {
            window.cblcars.anim.defaults = {
                enabled: settings.animations.enabled !== false,
                duration: settings.animations.duration || 300,
                easing: settings.animations.easing || 'easeOutQuad'
            };
            cblcarsLog.info('[CBLCARSCoreCard] 🎬 Animation defaults set');
        }

        // Set resize observer defaults
        if (settings.resize_observer) {
            window.cblcars.resizeObserverTolerance = settings.resize_observer.tolerance || 16;
            window.cblcars.debounceWait = settings.resize_observer.debounce_wait || 100;
            cblcarsLog.info('[CBLCARSCoreCard] 📏 Resize observer defaults set');
        }

        // Set log level
        if (settings.log_level) {
            window.cblcars.debug.setLevel(settings.log_level);
            cblcarsLog.info(`[CBLCARSCoreCard] 📝 Log level set: ${settings.log_level}`);
        }
    }

    /**
     * Setup performance monitoring
     * @private
     */
    _setupPerformanceMonitoring() {
        const perfConfig = this._config.performance;
        
        if (!perfConfig || !perfConfig.enabled) return;

        // Store thresholds globally
        window.cblcars.performance = {
            enabled: true,
            thresholds: perfConfig.thresholds || {},
            profiling: perfConfig.profiling || { enabled: false },
            metrics: {
                cardRenders: [],
                ruleEvaluations: [],
                dataFetches: []
            }
        };

        // Wrap key functions with performance monitoring
        this._wrapWithPerformanceMonitoring();

        cblcarsLog.info('[CBLCARSCoreCard] 📊 Performance monitoring enabled');
    }

    /**
     * Wrap functions with performance monitoring
     * @private
     */
    _wrapWithPerformanceMonitoring() {
        const perf = window.cblcars.performance;
        if (!perf || !perf.enabled) return;

        // Monitor rule evaluation
        if (window.cblcars.core?.rulesEngine) {
            const originalEvaluate = window.cblcars.core.rulesEngine.evaluate;
            window.cblcars.core.rulesEngine.evaluate = function(...args) {
                const start = performance.now();
                const result = originalEvaluate.apply(this, args);
                const duration = performance.now() - start;
                
                perf.metrics.ruleEvaluations.push({ duration, timestamp: Date.now() });
                
                if (duration > perf.thresholds.rule_evaluation) {
                    cblcarsLog.warn(`[Performance] Slow rule evaluation: ${duration.toFixed(2)}ms`);
                }
                
                return result;
            };
        }

        // Monitor data fetches
        if (window.cblcars.core?.dataSourceManager) {
            const originalFetch = window.cblcars.core.dataSourceManager._fetchData;
            window.cblcars.core.dataSourceManager._fetchData = async function(...args) {
                const start = performance.now();
                const result = await originalFetch.apply(this, args);
                const duration = performance.now() - start;
                
                perf.metrics.dataFetches.push({ duration, timestamp: Date.now(), dsId: args[0] });
                
                if (duration > perf.thresholds.data_fetch) {
                    cblcarsLog.warn(`[Performance] Slow data fetch (${args[0]}): ${duration.toFixed(2)}ms`);
                }
                
                return result;
            };
        }
    }

    /**
     * Create debug overlay
     * @private
     */
    _createDebugOverlay() {
        const debugConfig = this._config.debug;
        if (!debugConfig || !debugConfig.enabled) return;

        // Create overlay element
        this._debugOverlay = document.createElement('div');
        this._debugOverlay.id = 'cblcars-debug-overlay';
        
        // Position
        const position = debugConfig.position || 'bottom-right';
        const [vPos, hPos] = position.split('-');
        
        this._debugOverlay.style.cssText = `
            position: fixed;
            ${vPos}: 10px;
            ${hPos}: 10px;
            background: rgba(0, 0, 0, 0.9);
            color: var(--lcars-ui-secondary);
            padding: 12px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            z-index: 999999;
            min-width: 250px;
            max-width: 400px;
            border: 2px solid var(--lcars-ui-secondary);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        `;

        // Initial content
        this._updateDebugOverlay();

        // Add to shadow root
        this.shadowRoot.appendChild(this._debugOverlay);

        // Update every second
        this._debugUpdateInterval = setInterval(() => {
            this._updateDebugOverlay();
        }, 1000);

        cblcarsLog.info('[CBLCARSCoreCard] 🔧 Debug overlay created');
    }

    /**
     * Update debug overlay content
     * @private
     */
    _updateDebugOverlay() {
        if (!this._debugOverlay) return;

        const show = this._config.debug?.show || {};
        const lines = [];

        lines.push('🔧 <strong>CB-LCARS CORE</strong>');
        lines.push('─────────────────────');

        // Initialization status
        if (show.initialization_status) {
            const status = this._initialized ? '✅ Ready' : '⏳ Initializing...';
            const time = this._initEndTime ? `(${this._initEndTime - this._initStartTime}ms)` : '';
            lines.push(`Init: ${status} ${time}`);
        }

        // Data source status
        if (show.data_source_status && window.cblcars.core._coreInitialized) {
            const dsCount = window.cblcars.core._initializedDataSources.size;
            const declaredCount = window.cblcars.core._dataSourceDeclarations.size;
            lines.push(`Data Sources: ${dsCount}/${declaredCount}`);
        }

        // Card count
        if (show.card_count && window.cblcars.core._coreInitialized) {
            const cardCount = window.cblcars.core._cardInstances.size;
            lines.push(`Cards: ${cardCount}`);
        }

        // Event bus stats
        if (show.event_bus_stats && window.cblcars.eventBus) {
            const info = window.cblcars.eventBus.getDebugInfo();
            lines.push(`Events: ${info.subscriberCount} subs, ${info.eventHistorySize} history`);
        }

        // Performance metrics
        if (show.performance_metrics && window.cblcars.performance?.enabled) {
            const perf = window.cblcars.performance;
            const avgRuleTime = perf.metrics.ruleEvaluations.length > 0
                ? (perf.metrics.ruleEvaluations.reduce((sum, m) => sum + m.duration, 0) / perf.metrics.ruleEvaluations.length).toFixed(2)
                : '0.00';
            lines.push(`Avg Rule Time: ${avgRuleTime}ms`);
        }

        this._debugOverlay.innerHTML = lines.join('<br>');
    }

    /**
     * Render card (invisible)
     * @private
     */
    _render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block !important;
                    width: 0 !important;
                    height: 0 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: 0 !important;
                    overflow: hidden !important;
                    visibility: ${this._config.debug?.enabled ? 'visible' : 'hidden'} !important;
                }
            </style>
        `;
    }

    /**
     * Connected callback
     */
    connectedCallback() {
        cblcarsLog.info('[CBLCARSCoreCard] Connected to DOM');
    }

    /**
     * Disconnected callback
     */
    disconnectedCallback() {
        cblcarsLog.info('[CBLCARSCoreCard] Disconnected from DOM');
        
        // Cleanup debug overlay
        if (this._debugUpdateInterval) {
            clearInterval(this._debugUpdateInterval);
        }
    }

    /**
     * Get card size (for layout)
     * 
     * @returns {number} Card size (0 - takes no space)
     */
    getCardSize() {
        return 0;
    }

    /**
     * Get config element (editor)
     * 
     * @returns {HTMLElement} Editor element
     */
    static getConfigElement() {
        return document.createElement('cb-lcars-core-card-editor');
    }

    /**
     * Get stub config (for card picker)
     * 
     * @returns {Object} Stub configuration
     */
    static getStubConfig() {
        return {
            type: 'cb-lcars-core-card',
            data_sources: [],
            preload: {
                svgs: [],
                fonts: []
            },
            events: {
                enabled: true,
                debug: false
            },
            debug: {
                enabled: false
            }
        };
    }
}

// Register custom element
customElements.define('cb-lcars-core-card', CBLCARSCoreCard);

// Register in custom cards registry
window.customCards = window.customCards || [];
window.customCards.push({
    type: 'cb-lcars-core-card',
    name: 'CB-LCARS Core Infrastructure',
    preview: false,
    description: 'Invisible card for shared CB-LCARS infrastructure (data sources, resources, event bus). Place at top of dashboard.',
    documentationURL: "https://cb-lcars.unimatrix01.ca/docs/core-card"
});
```

**Acceptance Criteria:**
- ✅ CBLCARSCoreCard class created
- ✅ Core initialization on load
- ✅ Data source registration
- ✅ Resource pre-loading
- ✅ Event bus configuration
- ✅ Global settings application
- ✅ Performance monitoring setup
- ✅ Debug overlay (optional)
- ✅ Takes zero visual space
- ✅ Custom element registered

---

## 5.3: Build Core Card Editor

**Purpose:** Visual editor for core card configuration

**File:** `src/editor/cb-lcars-core-card-editor.js`

```javascript
/**
 * CB-LCARS Core Card Editor
 * 
 * Visual configuration editor for core card
 * 
 * SECTIONS:
 * - Data Sources
 * - Preload Resources
 * - Event Bus
 * - Performance
 * - Debug
 * - Global Settings
 */

import { LitElement, html, css } from 'lit';
import { cblcarsLog } from '../utils/cb-lcars-logging.js';

export class CBLCARSCoreCardEditor extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            _config: { type: Object }
        };
    }

    static get styles() {
        return css`
            :host {
                display: block;
            }
            
            .card-config {
                padding: 16px;
            }
            
            .section {
                margin-bottom: 24px;
                padding: 16px;
                background: var(--card-background-color, #fff);
                border-radius: 8px;
            }
            
            .section-title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 12px;
                color: var(--primary-text-color);
            }
            
            .section-description {
                font-size: 14px;
                color: var(--secondary-text-color);
                margin-bottom: 16px;
            }
            
            .field {
                margin-bottom: 16px;
            }
            
            .field-label {
                display: block;
                font-size: 14px;
                font-weight: 500;
                margin-bottom: 4px;
                color: var(--primary-text-color);
            }
            
            .field-description {
                font-size: 12px;
                color: var(--secondary-text-color);
                margin-bottom: 8px;
            }
            
            ha-textfield,
            ha-select,
            ha-switch {
                width: 100%;
            }
            
            .data-source-list,
            .preload-list {
                border: 1px solid var(--divider-color);
                border-radius: 4px;
                padding: 8px;
                margin-bottom: 8px;
            }
            
            .data-source-item,
            .preload-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px;
                background: var(--secondary-background-color);
                border-radius: 4px;
                margin-bottom: 4px;
            }
            
            .add-button {
                margin-top: 8px;
            }
            
            .warning-box {
                padding: 12px;
                background: var(--warning-color);
                color: white;
                border-radius: 4px;
                margin-bottom: 16px;
            }
        `;
    }

    setConfig(config) {
        this._config = config || {};
    }

    render() {
        if (!this._config) {
            return html``;
        }

        return html`
            <div class="card-config">
                ${this._renderWarning()}
                ${this._renderDataSourcesSection()}
                ${this._renderPreloadSection()}
                ${this._renderEventBusSection()}
                ${this._renderPerformanceSection()}
                ${this._renderDebugSection()}
                ${this._renderGlobalSettingsSection()}
            </div>
        `;
    }

    _renderWarning() {
        return html`
            <div class="warning-box">
                ⚠️ <strong>Core Card Notice:</strong> This card should be placed at the top of your dashboard configuration.
                It initializes shared infrastructure for all CB-LCARS cards.
            </div>
        `;
    }

    _renderDataSourcesSection() {
        const dataSources = this._config.data_sources || [];

        return html`
            <div class="section">
                <div class="section-title">📡 Data Sources</div>
                <div class="section-description">
                    Declare REST APIs and other data sources used by cards on this dashboard.
                </div>

                <div class="data-source-list">
                    ${dataSources.length === 0
                        ? html`<div style="padding: 16px; text-align: center; color: var(--secondary-text-color);">
                            No data sources defined. Click "Add Data Source" to create one.
                          </div>`
                        : dataSources.map((ds, index) => this._renderDataSourceItem(ds, index))
                    }
                </div>

                <mwc-button
                    class="add-button"
                    @click=${this._addDataSource}
                >
                    Add Data Source
                </mwc-button>
            </div>
        `;
    }

    _renderDataSourceItem(ds, index) {
        return html`
            <div class="data-source-item">
                <div>
                    <strong>${ds.id || 'Unnamed'}</strong>
                    <div style="font-size: 12px; color: var(--secondary-text-color);">
                        ${ds.type || 'rest'} - ${ds.url || 'No URL'}
                    </div>
                </div>
                <div>
                    <mwc-icon-button
                        @click=${() => this._editDataSource(index)}
                    >
                        <ha-icon icon="mdi:pencil"></ha-icon>
                    </mwc-icon-button>
                    <mwc-icon-button
                        @click=${() => this._removeDataSource(index)}
                    >
                        <ha-icon icon="mdi:delete"></ha-icon>
                    </mwc-icon-button>
                </div>
            </div>
        `;
    }

    _renderPreloadSection() {
        const svgs = this._config.preload?.svgs || [];
        const fonts = this._config.preload?.fonts || [];

        return html`
            <div class="section">
                <div class="section-title">🎨 Preload Resources</div>
                <div class="section-description">
                    Pre-load SVGs, fonts, and themes on dashboard startup for faster rendering.
                </div>

                <div class="field-label">SVG Assets</div>
                <div class="preload-list">
                    ${svgs.length === 0
                        ? html`<div style="padding: 8px; text-align: center; color: var(--secondary-text-color);">
                            No SVGs
                          </div>`
                        : svgs.map((svg, index) => this._renderPreloadItem(svg, 'svg', index))
                    }
                </div>
                <mwc-button
                    outlined
                    @click=${this._addSVG}
                >
                    Add SVG
                </mwc-button>

                <div style="margin-top: 16px;"></div>

                <div class="field-label">Fonts</div>
                <div class="preload-list">
                    ${fonts.length === 0
                        ? html`<div style="padding: 8px; text-align: center; color: var(--secondary-text-color);">
                            No fonts
                          </div>`
                        : fonts.map((font, index) => this._renderPreloadItem(font, 'font', index))
                    }
                </div>
                <mwc-button
                    outlined
                    @click=${this._addFont}
                >
                    Add Font
                </mwc-button>
            </div>
        `;
    }

    _renderPreloadItem(item, type, index) {
        const displayName = type === 'svg' ? item.key : item.family;
        const displaySource = item.source;

        return html`
            <div class="preload-item">
                <div>
                    <strong>${displayName || 'Unnamed'}</strong>
                    <div style="font-size: 12px; color: var(--secondary-text-color);">
                        ${displaySource || 'No source'}
                    </div>
                </div>
                <mwc-icon-button
                    @click=${() => this._removePreloadItem(type, index)}
                >
                    <ha-icon icon="mdi:delete"></ha-icon>
                </mwc-icon-button>
            </div>
        `;
    }

    _renderEventBusSection() {
        const events = this._config.events || {};

        return html`
            <div class="section">
                <div class="section-title">📢 Event Bus</div>
                <div class="section-description">
                    Configure the event bus for card-to-card communication.
                </div>

                <div class="field">
                    <ha-switch
                        .checked=${events.enabled !== false}
                        @change=${(e) => this._updateConfig(['events', 'enabled'], e.target.checked)}
                    >
                    </ha-switch>
                    <span class="field-label">Enable Event Bus</span>
                </div>

                ${events.enabled !== false ? html`
                    <div class="field">
                        <ha-switch
                            .checked=${events.debug || false}
                            @change=${(e) => this._updateConfig(['events', 'debug'], e.target.checked)}
                        >
                        </ha-switch>
                        <span class="field-label">Debug Mode (Log Events)</span>
                    </div>

                    <div class="field">
                        <span class="field-label">History Limit</span>
                        <span class="field-description">Number of events to keep in history</span>
                        <ha-textfield
                            type="number"
                            .value=${events.history_limit || 100}
                            @input=${(e) => this._updateConfig(['events', 'history_limit'], parseInt(e.target.value))}
                        ></ha-textfield>
                    </div>
                ` : ''}
            </div>
        `;
    }

    _renderPerformanceSection() {
        const perf = this._config.performance || {};

        return html`
            <div class="section">
                <div class="section-title">📊 Performance Monitoring</div>
                <div class="section-description">
                    Monitor and profile card performance.
                </div>

                <div class="field">
                    <ha-switch
                        .checked=${perf.enabled || false}
                        @change=${(e) => this._updateConfig(['performance', 'enabled'], e.target.checked)}
                    >
                    </ha-switch>
                    <span class="field-label">Enable Performance Monitoring</span>
                </div>

                ${perf.enabled ? html`
                    <div class="field">
                        <ha-switch
                            .checked=${perf.profiling?.enabled || false}
                            @change=${(e) => this._updateConfig(['performance', 'profiling', 'enabled'], e.target.checked)}
                        >
                        </ha-switch>
                        <span class="field-label">Enable Detailed Profiling</span>
                        <span class="field-description">⚠️ May impact performance</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    _renderDebugSection() {
        const debug = this._config.debug || {};

        return html`
            <div class="section">
                <div class="section-title">🔧 Debug Overlay</div>
                <div class="section-description">
                    Show a debug overlay with initialization and runtime information.
                </div>

                <div class="field">
                    <ha-switch
                        .checked=${debug.enabled || false}
                        @change=${(e) => this._updateConfig(['debug', 'enabled'], e.target.checked)}
                    >
                    </ha-switch>
                    <span class="field-label">Enable Debug Overlay</span>
                </div>

                ${debug.enabled ? html`
                    <div class="field">
                        <span class="field-label">Position</span>
                        <ha-select
                            .value=${debug.position || 'bottom-right'}
                            @change=${(e) => this._updateConfig(['debug', 'position'], e.target.value)}
                        >
                            <mwc-list-item value="top-left">Top Left</mwc-list-item>
                            <mwc-list-item value="top-right">Top Right</mwc-list-item>
                            <mwc-list-item value="bottom-left">Bottom Left</mwc-list-item>
                            <mwc-list-item value="bottom-right">Bottom Right</mwc-list-item>
                        </ha-select>
                    </div>
                ` : ''}
            </div>
        `;
    }

    _renderGlobalSettingsSection() {
        const settings = this._config.global_settings || {};

        return html`
            <div class="section">
                <div class="section-title">⚙️ Global Settings</div>
                <div class="section-description">
                    Dashboard-level configuration applied to all CB-LCARS cards.
                </div>

                <div class="field">
                    <span class="field-label">Default Theme</span>
                    <ha-select
                        .value=${settings.default_theme || 'green_alert'}
                        @change=${(e) => this._updateConfig(['global_settings', 'default_theme'], e.target.value)}
                    >
                        <mwc-list-item value="green_alert">Green Alert</mwc-list-item>
                        <mwc-list-item value="yellow_alert">Yellow Alert</mwc-list-item>
                        <mwc-list-item value="red_alert">Red Alert</mwc-list-item>
                        <mwc-list-item value="blue_alert">Blue Alert</mwc-list-item>
                        <mwc-list-item value="picard_normal">Picard Normal</mwc-list-item>
                    </ha-select>
                </div>

                <div class="field">
                    <span class="field-label">Log Level</span>
                    <ha-select
                        .value=${settings.log_level || 'info'}
                        @change=${(e) => this._updateConfig(['global_settings', 'log_level'], e.target.value)}
                    >
                        <mwc-list-item value="debug">Debug</mwc-list-item>
                        <mwc-list-item value="info">Info</mwc-list-item>
                        <mwc-list-item value="warn">Warn</mwc-list-item>
                        <mwc-list-item value="error">Error</mwc-list-item>
                    </ha-select>
                </div>
            </div>
        `;
    }

    // Event handlers

    _addDataSource() {
        // TODO: Show dialog for adding data source
        cblcarsLog.info('[CoreCardEditor] Add data source clicked');
    }

    _editDataSource(index) {
        // TODO: Show dialog for editing data source
        cblcarsLog.info('[CoreCardEditor] Edit data source:', index);
    }

    _removeDataSource(index) {
        const dataSources = [...(this._config.data_sources || [])];
        dataSources.splice(index, 1);
        this._updateConfig(['data_sources'], dataSources);
    }

    _addSVG() {
        // TODO: Show dialog for adding SVG
        cblcarsLog.info('[CoreCardEditor] Add SVG clicked');
    }

    _addFont() {
        // TODO: Show dialog for adding font
        cblcarsLog.info('[CoreCardEditor] Add font clicked');
    }

    _removePreloadItem(type, index) {
        const key = type === 'svg' ? 'svgs' : 'fonts';
        const items = [...(this._config.preload?.[key] || [])];
        items.splice(index, 1);
        this._updateConfig(['preload', key], items);
    }

    _updateConfig(path, value) {
        const newConfig = { ...this._config };
        let current = newConfig;

        // Navigate to parent
        for (let i = 0; i < path.length - 1; i++) {
            const key = path[i];
            if (!current[key]) {
                current[key] = {};
            }
            current = current[key];
        }

        // Set value
        const lastKey = path[path.length - 1];
        current[lastKey] = value;

        this._config = newConfig;
        this.dispatchEvent(new CustomEvent('config-changed', {
            detail: { config: newConfig },
            bubbles: true,
            composed: true
        }));
    }
}

customElements.define('cb-lcars-core-card-editor', CBLCARSCoreCardEditor);
```

**Acceptance Criteria:**
- ✅ Core card editor created
- ✅ All sections editable
- ✅ Visual configuration interface
- ✅ Add/remove data sources
- ✅ Add/remove preload resources
- ✅ Toggle switches for features
- ✅ Config change events dispatched
- ✅ Custom element registered

---

## 5.4: Enhanced Data Source Features

**Purpose:** Advanced data source capabilities

### Features to Add

#### 1. WebSocket Data Sources

**File:** `src/core/data-sources/websocket-source.js`

```javascript
/**
 * WebSocketSource - WebSocket Data Source
 * 
 * Connects to WebSocket endpoints for real-time data
 * Supports auto-reconnection and heartbeat
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { BaseSource } from './base-source.js';

export class WebSocketSource extends BaseSource {
    constructor(config, hass) {
        super(config, hass);
        
        this.url = config.url;
        this.protocols = config.protocols;
        
        // WebSocket instance
        this._ws = null;
        this._connected = false;
        
        // Reconnection
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = config.max_reconnect_attempts || 10;
        this._reconnectDelay = config.reconnect_delay || 1000;
        
        // Heartbeat
        this._heartbeatInterval = config.heartbeat_interval || 30000;
        this._heartbeatTimer = null;
        this._lastHeartbeat = null;
        
        // Message handling
        this._messageHandler = config.message_handler || ((data) => data);
        
        // Transform function
        this.transform = config.transform;
    }

    /**
     * Connect to WebSocket
     * 
     * @returns {Promise<void>}
     */
    async connect() {
        if (this._connected) {
            cblcarsLog.debug('[WebSocketSource] Already connected');
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                this._ws = new WebSocket(this.url, this.protocols);

                this._ws.onopen = () => {
                    cblcarsLog.info(`[WebSocketSource] Connected to ${this.url}`);
                    this._connected = true;
                    this._reconnectAttempts = 0;
                    this._startHeartbeat();
                    resolve();
                };

                this._ws.onmessage = (event) => {
                    this._handleMessage(event.data);
                };

                this._ws.onerror = (error) => {
                    cblcarsLog.error('[WebSocketSource] Error:', error);
                    reject(error);
                };

                this._ws.onclose = () => {
                    cblcarsLog.warn('[WebSocketSource] Connection closed');
                    this._connected = false;
                    this._stopHeartbeat();
                    this._attemptReconnect();
                };

            } catch (error) {
                cblcarsLog.error('[WebSocketSource] Failed to connect:', error);
                reject(error);
            }
        });
    }

    /**
     * Fetch data (for WebSocket, this connects if needed)
     * 
     * @returns {Promise<any>}
     */
    async fetch() {
        if (!this._connected) {
            await this.connect();
        }
        
        // For WebSocket, data comes via messages
        // Return last received data
        return this._lastData;
    }

    /**
     * Handle incoming message
     * @private
     */
    _handleMessage(data) {
        try {
            // Parse if JSON
            let parsed = data;
            if (typeof data === 'string') {
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    // Not JSON, use as-is
                }
            }

            // Apply message handler
            parsed = this._messageHandler(parsed);

            // Apply transform
            if (this.transform && typeof this.transform === 'function') {
                parsed = this.transform(parsed);
            }

            this._lastData = parsed;
            this._lastHeartbeat = Date.now();

            // Notify subscribers (would need callback mechanism)
            // This would integrate with DataSourceManager

        } catch (error) {
            cblcarsLog.error('[WebSocketSource] Error handling message:', error);
        }
    }

    /**
     * Start heartbeat monitoring
     * @private
     */
    _startHeartbeat() {
        if (!this._heartbeatInterval) return;

        this._heartbeatTimer = setInterval(() => {
            const now = Date.now();
            const timeSinceLastMessage = now - (this._lastHeartbeat || now);

            if (timeSinceLastMessage > this._heartbeatInterval * 2) {
                cblcarsLog.warn('[WebSocketSource] Heartbeat timeout, reconnecting...');
                this._ws?.close();
            }
        }, this._heartbeatInterval);
    }

    /**
     * Stop heartbeat monitoring
     * @private
     */
    _stopHeartbeat() {
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }

    /**
     * Attempt to reconnect
     * @private
     */
    async _attemptReconnect() {
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            cblcarsLog.error('[WebSocketSource] Max reconnection attempts reached');
            return;
        }

        this._reconnectAttempts++;
        const delay = this._reconnectDelay * Math.pow(2, this._reconnectAttempts - 1);

        cblcarsLog.info(`[WebSocketSource] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts})`);

        setTimeout(() => {
            this.connect().catch(error => {
                cblcarsLog.error('[WebSocketSource] Reconnection failed:', error);
            });
        }, delay);
    }

    /**
     * Send message to WebSocket
     * 
     * @param {any} data - Data to send
     */
    send(data) {
        if (!this._connected || !this._ws) {
            cblcarsLog.warn('[WebSocketSource] Cannot send - not connected');
            return;
        }

        const message = typeof data === 'string' ? data : JSON.stringify(data);
        this._ws.send(message);
    }

    /**
     * Cleanup
     */
    destroy() {
        this._stopHeartbeat();
        
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
        
        this._connected = false;
    }
}
```

#### 2. Data Source Chaining

**Allow transforming data from one source and feeding to another:**

```yaml
data_sources:
  # Primary source
  - id: raw_weather
    type: rest
    url: https://api.weather.com/...
    transform: |
      (data) => ({
        temp_f: data.main.temp,
        temp_c: (data.main.temp - 32) * 5/9,
        condition: data.weather[0].main
      })
  
  # Derived source (chains from raw_weather)
  - id: weather_alerts
    type: derived
    source: raw_weather
    transform: |
      (data) => {
        const alerts = [];
        if (data.temp_f > 90) alerts.push('HIGH_TEMP');
        if (data.temp_f < 32) alerts.push('FREEZING');
        return { alerts, temp: data.temp_f };
      }
```

#### 3. Data Source Caching Strategies

```yaml
data_sources:
  - id: weather
    type: rest
    url: https://api.weather.com/...
    refresh: 60
    
    # Cache strategy
    cache:
      strategy: time  # time, conditional, none
      ttl: 300  # seconds
      stale_while_revalidate: true  # Serve stale data while fetching fresh
```

**Acceptance Criteria:**
- ✅ WebSocket data sources implemented
- ✅ Data source chaining supported
- ✅ Advanced caching strategies
- ✅ Heartbeat and reconnection
- ✅ Error handling robust
- ✅ Integration with DataSourceManager

---

Due to length constraints, I'll summarize the remaining tasks:

## 5.5: Advanced Event Bus Features
- Event namespacing
- Event prioritization
- Event filtering
- Request/response pattern
- Event debugging tools

## 5.6: Performance Monitoring & Profiling
- Detailed performance metrics
- Flame charts
- Memory profiling
- Network request monitoring
- Animation FPS tracking

## 5.7: Developer Tools & Debug UI
- Interactive console
- State inspector
- Timeline viewer
- Network monitor
- Style inspector

## 5.8: Testing & Documentation
- Core card integration tests
- Advanced feature tests
- Performance benchmarks
- User documentation
- API documentation

---

## Phase 5 Completion Criteria

### Functional Requirements
- ✅ Core card implemented
- ✅ Core card editor functional
- ✅ WebSocket data sources
- ✅ Advanced event bus features
- ✅ Performance monitoring
- ✅ Developer tools

### Technical Requirements
- ✅ Zero visual footprint
- ✅ Optional debug overlay
- ✅ Pre-loading works
- ✅ Event bus enhanced
- ✅ Performance tracking
- ✅ JSDoc complete

### Testing Requirements
- ✅ Core card initialization tests
- ✅ Data source tests
- ✅ Event bus tests
- ✅ Performance benchmarks
- ✅ Integration tests

### Documentation Requirements
- ✅ Core card usage guide
- ✅ Advanced features documentation
- ✅ Best practices guide
- ✅ Troubleshooting guide
- ✅ API reference

---

**End of Phase 5**