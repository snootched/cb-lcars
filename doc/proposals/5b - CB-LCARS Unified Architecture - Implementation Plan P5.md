# CB-LCARS Unified Architecture - Implementation Phase 5

**Phase 5: Core Card & Advanced Features**

**Goal:** Build optional core card for explicit infrastructure management and add advanced features

**Priority:** Low - Optional enhancements, not required for basic functionality

---

## Phase 5 Tasks Overview

```
Phase 5: Core Card & Advanced Features
├─ 5.1: Design Core Card Architecture
├─ 5.2: Implement CBLCARSCoreCard
├─ 5.3: Build Visual Status Indicators
├─ 5.4: Add Global Configuration Management
├─ 5.5: Implement Advanced Data Source Features
├─ 5.6: Create Event Bus Debugging Tools
├─ 5.7: Build Performance Monitoring
└─ 5.8: Documentation & Examples
```

---

## 5.1: Design Core Card Architecture

**Purpose:** Define structure and responsibilities of optional core card

### Core Card Responsibilities

```
┌─────────────────────────────────────────────────────────────────┐
│                     CBLCARSCoreCard                              │
│                  (Invisible Infrastructure Card)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ├─ Initialize CB-LCARS Core
                              ├─ Declare Data Sources
                              ├─ Configure Event Bus
                              ├─ Pre-load Resources (SVGs, Fonts)
                              ├─ Set Global Configuration
                              ├─ Display Status (Optional)
                              └─ Debug/Monitor (Optional)
```

### Design Principles

1. **Optional but Recommended**
   - System works without it (auto-initialization)
   - Provides explicit control and better performance
   - Enables advanced features

2. **Zero Visual Impact (Default)**
   - 0x0 size by default
   - No layout interference
   - Can show status indicator (opt-in)

3. **Configuration Hub**
   - Central place for dashboard-wide settings
   - Data source definitions
   - Global presets
   - Event bus configuration

4. **Resource Management**
   - Pre-load SVGs before other cards
   - Pre-load fonts
   - Initialize heavy systems early

5. **Developer Tools**
   - Status monitoring
   - Debug information
   - Performance metrics

### Configuration Structure

```yaml
type: cb-lcars-core-card

# Core infrastructure
config:
  # Data sources (available to all cards)
  data_sources:
    - id: weather
      type: rest
      url: https://api.weather.com/forecast
      refresh: 60
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
  
  # Event bus configuration
  event_bus:
    enabled: true
    debug: false
    history_limit: 100
  
  # Pre-load resources
  preload:
    svgs:
      - warp_core
      - enterprise_d
      - defiant
      - voyager
    fonts:
      - LCARS
      - Antonio
      - Orbitron
  
  # Global settings
  global:
    alert_condition: green_alert  # Default theme
    animation_speed: 1.0
    debug_mode: false
    log_level: info
  
  # Performance monitoring
  monitoring:
    enabled: false  # Enable performance tracking
    report_interval: 60  # Report every 60 seconds

# Visual display (optional)
display:
  enabled: false  # Show status indicator
  position: top-right  # top-right, top-left, bottom-right, bottom-left
  style: minimal  # minimal, detailed, debug

# Make card invisible
card_mod:
  style: |
    ha-card {
      display: none !important;
    }
```

**Acceptance Criteria:**
- ✅ Core card responsibilities defined
- ✅ Design principles established
- ✅ Configuration structure designed
- ✅ Visual/invisible modes planned
- ✅ Developer tools considered

---

## 5.2: Implement CBLCARSCoreCard

**Purpose:** Create the core card class

**File:** `src/cards/cb-lcars-core-card.js`

```javascript
/**
 * CBLCARSCoreCard - Optional Infrastructure Management Card
 * 
 * Provides explicit control over CB-LCARS infrastructure initialization
 * Enables dashboard-wide configuration and resource management
 * 
 * FEATURES:
 * - Declares data sources for all cards
 * - Pre-loads SVGs and fonts
 * - Configures event bus
 * - Sets global configuration
 * - Displays status (optional)
 * - Provides debug tools (optional)
 * 
 * USAGE:
 * Place at top of dashboard view configuration
 * Will initialize before other CB-LCARS cards
 * 
 * @example
 * views:
 *   - cards:
 *     - type: cb-lcars-core-card
 *       config:
 *         data_sources: [...]
 *         preload: { svgs: [...], fonts: [...] }
 *     
 *     # Other CB-LCARS cards follow
 *     - type: cb-lcars-button-card
 *       ...
 */

import { cblcarsLog } from '../utils/cb-lcars-logging.js';

export class CBLCARSCoreCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        this._config = null;
        this._initialized = false;
        this._statusInterval = null;
        
        cblcarsLog.info('[CBLCARSCoreCard] Constructor called');
    }

    /**
     * Set card configuration
     * 
     * @param {Object} config - Card configuration
     */
    setConfig(config) {
        if (!config) {
            throw new Error('Invalid core card configuration');
        }

        this._config = config;
        
        cblcarsLog.info('[CBLCARSCoreCard] 🏗️ Initializing CB-LCARS infrastructure');

        // Render immediately (even before hass)
        this._render();
    }

    /**
     * Set Home Assistant instance
     * 
     * @param {Object} hass - Home Assistant instance
     */
    async setHass(hass) {
        this.hass = hass;

        // Initialize core infrastructure
        if (!this._initialized) {
            await this._initializeCore();
        }

        // Update status display
        if (this._config.display?.enabled) {
            this._updateStatusDisplay();
        }

        // Forward hass updates to core
        if (window.cblcars.core?._coreInitialized) {
            window.cblcars.core.systemsManager?.updateHass(hass);
            window.cblcars.core.dataSourceManager?.updateHass(hass);
        }
    }

    /**
     * Initialize CB-LCARS core infrastructure
     * @private
     */
    async _initializeCore() {
        if (this._initialized) {
            cblcarsLog.debug('[CBLCARSCoreCard] Already initialized');
            return;
        }

        const startTime = performance.now();

        try {
            // Ensure core exists
            if (!window.cblcars.core) {
                cblcarsLog.error('[CBLCARSCoreCard] CB-LCARS core not found!');
                throw new Error('CB-LCARS core not available');
            }

            // Initialize core systems
            cblcarsLog.info('[CBLCARSCoreCard] Initializing core systems...');
            await window.cblcars.core.initialize(this.hass);

            // Pre-load resources
            if (this._config.config?.preload) {
                await this._preloadResources();
            }

            // Register data sources
            if (this._config.config?.data_sources) {
                this._registerDataSources();
            }

            // Configure event bus
            if (this._config.config?.event_bus) {
                this._configureEventBus();
            }

            // Apply global settings
            if (this._config.config?.global) {
                this._applyGlobalSettings();
            }

            // Setup monitoring
            if (this._config.config?.monitoring?.enabled) {
                this._setupMonitoring();
            }

            const duration = performance.now() - startTime;
            cblcarsLog.info(`[CBLCARSCoreCard] ✅ Infrastructure initialized in ${duration.toFixed(2)}ms`);

            this._initialized = true;

            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('cblcars-core-ready', {
                detail: {
                    timestamp: Date.now(),
                    duration: duration
                }
            }));

            // Publish to event bus
            window.cblcars.eventBus?.publish('core.initialized', {
                duration: duration,
                dataSources: this._config.config?.data_sources?.length || 0,
                preloadedResources: this._countPreloadedResources()
            });

        } catch (error) {
            cblcarsLog.error('[CBLCARSCoreCard] Initialization failed:', error);
            this._showError(error.message);
        }
    }

    /**
     * Pre-load resources (SVGs, fonts)
     * @private
     */
    async _preloadResources() {
        const preload = this._config.config.preload;
        const tasks = [];

        cblcarsLog.info('[CBLCARSCoreCard] Pre-loading resources...');

        // Pre-load SVGs
        if (preload.svgs && Array.isArray(preload.svgs)) {
            cblcarsLog.info(`[CBLCARSCoreCard] Pre-loading ${preload.svgs.length} SVGs...`);
            
            for (const svgKey of preload.svgs) {
                // Check if builtin or custom
                if (svgKey.startsWith('/local/')) {
                    const key = svgKey.split('/').pop().replace('.svg', '');
                    tasks.push(window.cblcars.loadUserSVG(key, svgKey));
                } else {
                    // Builtin - should already be in cache, but verify
                    const cached = window.cblcars.getSVGFromCache(svgKey);
                    if (!cached) {
                        cblcarsLog.warn(`[CBLCARSCoreCard] Built-in SVG '${svgKey}' not in cache`);
                    }
                }
            }
        }

        // Pre-load fonts
        if (preload.fonts && Array.isArray(preload.fonts)) {
            cblcarsLog.info(`[CBLCARSCoreCard] Pre-loading ${preload.fonts.length} fonts...`);
            
            for (const font of preload.fonts) {
                tasks.push(window.cblcars.loadFont(font));
            }
        }

        // Wait for all resources to load
        await Promise.all(tasks);
        
        cblcarsLog.info('[CBLCARSCoreCard] ✅ Resources pre-loaded');
    }

    /**
     * Register data sources with core
     * @private
     */
    _registerDataSources() {
        const dataSources = this._config.config.data_sources;
        
        cblcarsLog.info(`[CBLCARSCoreCard] Registering ${dataSources.length} data sources...`);

        for (const ds of dataSources) {
            try {
                window.cblcars.core.declareDataSource('core-card', ds);
                cblcarsLog.info(`[CBLCARSCoreCard] 📡 Declared data source: ${ds.id}`);
            } catch (error) {
                cblcarsLog.error(`[CBLCARSCoreCard] Failed to declare data source '${ds.id}':`, error);
            }
        }
    }

    /**
     * Configure event bus
     * @private
     */
    _configureEventBus() {
        const ebConfig = this._config.config.event_bus;
        
        if (!window.cblcars.eventBus) {
            cblcarsLog.warn('[CBLCARSCoreCard] Event bus not available');
            return;
        }

        // Update event bus configuration
        if (ebConfig.debug !== undefined) {
            window.cblcars.eventBus._debugMode = ebConfig.debug;
        }

        if (ebConfig.history_limit !== undefined) {
            window.cblcars.eventBus._historyLimit = ebConfig.history_limit;
        }

        cblcarsLog.info('[CBLCARSCoreCard] 📢 Event bus configured:', ebConfig);
    }

    /**
     * Apply global settings
     * @private
     */
    _applyGlobalSettings() {
        const global = this._config.config.global;

        // Set alert condition (theme)
        if (global.alert_condition) {
            if (window.cblcars.setAlertCondition) {
                window.cblcars.setAlertCondition(global.alert_condition);
                cblcarsLog.info(`[CBLCARSCoreCard] Alert condition set to: ${global.alert_condition}`);
            }
        }

        // Set global animation speed
        if (global.animation_speed !== undefined) {
            window.cblcars.animationSpeed = global.animation_speed;
            cblcarsLog.info(`[CBLCARSCoreCard] Animation speed set to: ${global.animation_speed}x`);
        }

        // Set debug mode
        if (global.debug_mode !== undefined) {
            window.cblcars.debugMode = global.debug_mode;
            cblcarsLog.info(`[CBLCARSCoreCard] Debug mode: ${global.debug_mode}`);
        }

        // Set log level
        if (global.log_level) {
            const { cblcarsSetGlobalLogLevel } = require('../utils/cb-lcars-logging.js');
            cblcarsSetGlobalLogLevel(global.log_level);
            cblcarsLog.info(`[CBLCARSCoreCard] Log level set to: ${global.log_level}`);
        }

        // Store global config for access by other cards
        window.cblcars.globalConfig = global;
    }

    /**
     * Setup performance monitoring
     * @private
     */
    _setupMonitoring() {
        const monitoring = this._config.config.monitoring;
        const reportInterval = monitoring.report_interval || 60;

        cblcarsLog.info(`[CBLCARSCoreCard] Performance monitoring enabled (${reportInterval}s interval)`);

        // Create performance monitor
        window.cblcars.performanceMonitor = {
            metrics: {
                cardCount: 0,
                entityCount: 0,
                dataSourceCount: 0,
                eventBusMessages: 0,
                renderTime: 0,
                memoryUsage: 0
            },
            
            collect: () => {
                const core = window.cblcars.core;
                
                return {
                    timestamp: Date.now(),
                    cardCount: core._cardInstances?.size || 0,
                    entityCount: core.systemsManager?._subscribers?.size || 0,
                    dataSourceCount: core._initializedDataSources?.size || 0,
                    eventBusMessages: window.cblcars.eventBus?._eventHistory?.length || 0,
                    memoryUsage: performance.memory?.usedJSHeapSize || 0
                };
            },
            
            report: () => {
                const metrics = window.cblcars.performanceMonitor.collect();
                cblcarsLog.info('[PerformanceMonitor] Metrics:', metrics);
                
                // Publish to event bus
                window.cblcars.eventBus?.publish('core.performance_report', metrics);
                
                return metrics;
            }
        };

        // Setup periodic reporting
        this._statusInterval = setInterval(() => {
            window.cblcars.performanceMonitor.report();
        }, reportInterval * 1000);
    }

    /**
     * Count pre-loaded resources
     * @private
     * 
     * @returns {number} Resource count
     */
    _countPreloadedResources() {
        const preload = this._config.config?.preload;
        if (!preload) return 0;
        
        let count = 0;
        if (preload.svgs) count += preload.svgs.length;
        if (preload.fonts) count += preload.fonts.length;
        
        return count;
    }

    /**
     * Render card
     * @private
     */
    _render() {
        const display = this._config.display || {};
        const enabled = display.enabled || false;

        if (!enabled) {
            // Invisible mode (default)
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
                        visibility: hidden !important;
                    }
                </style>
            `;
        } else {
            // Status display mode
            const style = display.style || 'minimal';
            const position = display.position || 'top-right';
            
            this.shadowRoot.innerHTML = `
                <style>
                    :host {
                        display: block;
                        position: fixed;
                        ${this._getPositionStyles(position)}
                        z-index: 9999;
                        pointer-events: none;
                    }
                    
                    .status-container {
                        background: rgba(0, 0, 0, 0.8);
                        border: 2px solid var(--lcars-ui-secondary);
                        border-radius: 5px;
                        padding: 10px;
                        font-family: Antonio, sans-serif;
                        font-size: 12px;
                        color: var(--lcars-ui-secondary);
                        pointer-events: auto;
                        min-width: 200px;
                    }
                    
                    .status-title {
                        font-weight: bold;
                        font-size: 14px;
                        margin-bottom: 5px;
                        text-transform: uppercase;
                    }
                    
                    .status-item {
                        display: flex;
                        justify-content: space-between;
                        margin: 3px 0;
                    }
                    
                    .status-label {
                        opacity: 0.7;
                    }
                    
                    .status-value {
                        font-weight: bold;
                    }
                    
                    .status-value.ok {
                        color: var(--lcars-green);
                    }
                    
                    .status-value.warning {
                        color: var(--lcars-orange);
                    }
                    
                    .status-value.error {
                        color: var(--lcars-red);
                    }
                    
                    .close-button {
                        position: absolute;
                        top: 5px;
                        right: 5px;
                        cursor: pointer;
                        opacity: 0.5;
                        transition: opacity 0.2s;
                    }
                    
                    .close-button:hover {
                        opacity: 1;
                    }
                </style>
                
                <div class="status-container">
                    <div class="close-button" id="close">✕</div>
                    <div class="status-title">CB-LCARS Core</div>
                    <div id="status-content">
                        <div class="status-item">
                            <span class="status-label">Status:</span>
                            <span class="status-value" id="status">Initializing...</span>
                        </div>
                    </div>
                </div>
            `;

            // Add close button handler
            this.shadowRoot.getElementById('close').addEventListener('click', () => {
                this.style.display = 'none';
            });
        }
    }

    /**
     * Get CSS position styles
     * @private
     * 
     * @param {string} position - Position (top-right, etc.)
     * @returns {string} CSS styles
     */
    _getPositionStyles(position) {
        const offset = '10px';
        
        switch (position) {
            case 'top-left':
                return `top: ${offset}; left: ${offset};`;
            case 'top-right':
                return `top: ${offset}; right: ${offset};`;
            case 'bottom-left':
                return `bottom: ${offset}; left: ${offset};`;
            case 'bottom-right':
                return `bottom: ${offset}; right: ${offset};`;
            default:
                return `top: ${offset}; right: ${offset};`;
        }
    }

    /**
     * Update status display
     * @private
     */
    _updateStatusDisplay() {
        if (!this._config.display?.enabled) return;

        const statusContent = this.shadowRoot.getElementById('status-content');
        if (!statusContent) return;

        const core = window.cblcars.core;
        const style = this._config.display.style || 'minimal';

        // Collect status info
        const status = {
            initialized: core._coreInitialized,
            cards: core._cardInstances?.size || 0,
            entities: core.systemsManager?._subscribers?.size || 0,
            dataSources: core._initializedDataSources?.size || 0,
            eventBusActive: !!window.cblcars.eventBus
        };

        // Build status HTML
        let html = `
            <div class="status-item">
                <span class="status-label">Status:</span>
                <span class="status-value ${status.initialized ? 'ok' : 'warning'}" id="status">
                    ${status.initialized ? 'Ready' : 'Initializing...'}
                </span>
            </div>
        `;

        if (style === 'detailed' || style === 'debug') {
            html += `
                <div class="status-item">
                    <span class="status-label">Cards:</span>
                    <span class="status-value">${status.cards}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Entities:</span>
                    <span class="status-value">${status.entities}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Data Sources:</span>
                    <span class="status-value">${status.dataSources}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Event Bus:</span>
                    <span class="status-value ${status.eventBusActive ? 'ok' : 'error'}">
                        ${status.eventBusActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            `;
        }

        if (style === 'debug') {
            const perf = window.cblcars.performanceMonitor?.collect();
            if (perf) {
                html += `
                    <div class="status-item">
                        <span class="status-label">Memory:</span>
                        <span class="status-value">${(perf.memoryUsage / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Events:</span>
                        <span class="status-value">${perf.eventBusMessages}</span>
                    </div>
                `;
            }
        }

        statusContent.innerHTML = html;
    }

    /**
     * Show error message
     * @private
     * 
     * @param {string} message - Error message
     */
    _showError(message) {
        if (!this._config.display?.enabled) return;

        const statusContent = this.shadowRoot.getElementById('status-content');
        if (statusContent) {
            statusContent.innerHTML = `
                <div class="status-item">
                    <span class="status-label">Status:</span>
                    <span class="status-value error">Error</span>
                </div>
                <div class="status-item">
                    <span class="status-label" style="opacity: 1; color: var(--lcars-red);">
                        ${message}
                    </span>
                </div>
            `;
        }
    }

    /**
     * Connected callback
     */
    connectedCallback() {
        cblcarsLog.debug('[CBLCARSCoreCard] Connected to DOM');
    }

    /**
     * Disconnected callback
     */
    disconnectedCallback() {
        cblcarsLog.debug('[CBLCARSCoreCard] Disconnected from DOM');

        // Cleanup monitoring interval
        if (this._statusInterval) {
            clearInterval(this._statusInterval);
            this._statusInterval = null;
        }
    }

    /**
     * Get card size (for layout)
     * 
     * @returns {number} Card size
     */
    getCardSize() {
        return 0;  // Takes no space in layout
    }

    /**
     * Get stub config for card picker
     * 
     * @returns {Object} Stub config
     */
    static getStubConfig() {
        return {
            type: 'cb-lcars-core-card',
            config: {
                data_sources: [],
                preload: {
                    svgs: [],
                    fonts: []
                },
                event_bus: {
                    enabled: true,
                    debug: false
                },
                global: {
                    alert_condition: 'green_alert'
                }
            },
            display: {
                enabled: false
            }
        };
    }

    /**
     * Get config element (editor)
     * 
     * @returns {HTMLElement} Config element
     */
    static getConfigElement() {
        return document.createElement('cb-lcars-core-card-editor');
    }
}

// Register custom element
customElements.define('cb-lcars-core-card', CBLCARSCoreCard);
```

**Register in cb-lcars.js:**

```javascript
// In initializeCustomCard().then() block
defineCustomElement('cb-lcars-core-card', CBLCARSCoreCard, 'cb-lcars-core-card-editor', CBLCARSCardEditor);

// Add to window.customCards registry
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
- ✅ Invisible by default (0x0 size)
- ✅ Optional status display
- ✅ Initializes core before other cards
- ✅ Registers data sources
- ✅ Pre-loads resources
- ✅ Configures event bus
- ✅ Applies global settings
- ✅ Registered in custom cards

---

## 5.3: Build Visual Status Indicators

**Purpose:** Provide visual feedback for core card status

### Status Display Modes

#### 1. Minimal Mode

Shows only basic status:
- Ready / Initializing
- Card count

#### 2. Detailed Mode

Shows comprehensive stats:
- Initialization status
- Card count
- Entity count
- Data source count
- Event bus status

#### 3. Debug Mode

Shows everything including:
- All detailed mode items
- Memory usage
- Event count
- Performance metrics
- Recent errors/warnings

### Interactive Status Display

**Enhancement to _render() method:**

```javascript
// Add to shadowRoot.innerHTML in status display mode

<style>
    /* ... existing styles ... */
    
    .status-container.collapsed {
        width: 40px;
        height: 40px;
        min-width: unset;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .status-container.collapsed:hover {
        transform: scale(1.1);
    }
    
    .status-icon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--lcars-green);
        animation: pulse 2s infinite;
    }
    
    .status-icon.warning {
        background: var(--lcars-orange);
    }
    
    .status-icon.error {
        background: var(--lcars-red);
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    
    .expand-button {
        cursor: pointer;
        margin-top: 10px;
        text-align: center;
        opacity: 0.7;
        transition: opacity 0.2s;
        user-select: none;
    }
    
    .expand-button:hover {
        opacity: 1;
    }
</style>

<div class="status-container ${collapsed ? 'collapsed' : ''}" id="container">
    ${collapsed ? `
        <div class="status-icon ${statusClass}"></div>
    ` : `
        <div class="close-button" id="close">✕</div>
        <div class="status-title">CB-LCARS Core</div>
        <div id="status-content">
            <!-- Status content here -->
        </div>
        <div class="expand-button" id="collapse">▼ Collapse</div>
    `}
</div>
```

**Add toggle functionality:**

```javascript
/**
 * Setup status display interactions
 * @private
 */
_setupStatusInteractions() {
    const container = this.shadowRoot.getElementById('container');
    const closeBtn = this.shadowRoot.getElementById('close');
    const collapseBtn = this.shadowRoot.getElementById('collapse');
    
    if (container) {
        container.addEventListener('click', (e) => {
            if (container.classList.contains('collapsed')) {
                this._expandStatus();
            }
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._hideStatus();
        });
    }
    
    if (collapseBtn) {
        collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._collapseStatus();
        });
    }
}

/**
 * Expand status display
 * @private
 */
_expandStatus() {
    this._statusCollapsed = false;
    this._render();
    this._updateStatusDisplay();
}

/**
 * Collapse status display
 * @private
 */
_collapseStatus() {
    this._statusCollapsed = true;
    this._render();
}

/**
 * Hide status display
 * @private
 */
_hideStatus() {
    this.style.display = 'none';
    
    // Store preference
    localStorage.setItem('cblcars_core_status_hidden', 'true');
}
```

**Acceptance Criteria:**
- ✅ Minimal status mode implemented
- ✅ Detailed status mode implemented
- ✅ Debug status mode implemented
- ✅ Collapsible/expandable status
- ✅ Status icon with color coding
- ✅ Smooth animations
- ✅ User preference stored

---

## 5.4: Add Global Configuration Management

**Purpose:** Centralize dashboard-wide configuration

### Global Configuration API

**Add to window.cblcars:**

```javascript
/**
 * Global Configuration Manager
 * 
 * Provides centralized access to dashboard-wide settings
 * Settings can be defined in core card or programmatically
 */
window.cblcars.config = {
    /**
     * Current global configuration
     */
    _current: {
        alert_condition: 'green_alert',
        animation_speed: 1.0,
        debug_mode: false,
        log_level: 'info',
        theme: 'green_alert',
        locale: 'en-US',
        time_format: '24h',
        temperature_unit: 'celsius'
    },
    
    /**
     * Get configuration value
     * 
     * @param {string} key - Configuration key (dot-notation supported)
     * @param {any} defaultValue - Default value if not found
     * @returns {any} Configuration value
     */
    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this._current;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    },
    
    /**
     * Set configuration value
     * 
     * @param {string} key - Configuration key (dot-notation supported)
     * @param {any} value - Value to set
     * @param {boolean} persist - Whether to persist to localStorage
     */
    set(key, value, persist = false) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        let obj = this._current;
        
        // Navigate to parent object
        for (const k of keys) {
            if (!(k in obj)) {
                obj[k] = {};
            }
            obj = obj[k];
        }
        
        // Set value
        const oldValue = obj[lastKey];
        obj[lastKey] = value;
        
        cblcarsLog.info(`[Config] Set ${key} = ${value}`);
        
        // Persist if requested
        if (persist) {
            try {
                localStorage.setItem(`cblcars_config_${key}`, JSON.stringify(value));
            } catch (e) {
                cblcarsLog.warn('[Config] Failed to persist config:', e);
            }
        }
        
        // Publish change event
        window.cblcars.eventBus?.publish('config.changed', {
            key,
            value,
            oldValue,
            persist
        });
        
        // Apply special handling for certain keys
        this._handleConfigChange(key, value);
    },
    
    /**
     * Load persisted configuration
     */
    loadPersisted() {
        const keys = Object.keys(this._current);
        
        for (const key of keys) {
            try {
                const stored = localStorage.getItem(`cblcars_config_${key}`);
                if (stored) {
                    this._current[key] = JSON.parse(stored);
                    cblcarsLog.debug(`[Config] Loaded persisted ${key}`);
                }
            } catch (e) {
                cblcarsLog.warn(`[Config] Failed to load persisted ${key}:`, e);
            }
        }
    },
    
    /**
     * Handle configuration changes with side effects
     * @private
     */
    _handleConfigChange(key, value) {
        switch (key) {
            case 'alert_condition':
            case 'theme':
                if (window.cblcars.setAlertCondition) {
                    window.cblcars.setAlertCondition(value);
                }
                break;
            
            case 'log_level':
                if (window.cblcars.debug?.setLevel) {
                    window.cblcars.debug.setLevel(value);
                }
                break;
            
            case 'animation_speed':
                // Store globally for animation helpers to reference
                window.cblcars.animationSpeed = value;
                break;
        }
    },
    
    /**
     * Get all configuration
     * 
     * @returns {Object} Complete configuration object
     */
    getAll() {
        return { ...this._current };
    },
    
    /**
     * Reset configuration to defaults
     */
    reset() {
        this._current = {
            alert_condition: 'green_alert',
            animation_speed: 1.0,
            debug_mode: false,
            log_level: 'info',
            theme: 'green_alert',
            locale: 'en-US',
            time_format: '24h',
            temperature_unit: 'celsius'
        };
        
        // Clear persisted config
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            if (key.startsWith('cblcars_config_')) {
                localStorage.removeItem(key);
            }
        }
        
        cblcarsLog.info('[Config] Reset to defaults');
        
        window.cblcars.eventBus?.publish('config.reset', {});
    }
};

// Load persisted config on initialization
window.cblcars.config.loadPersisted();
```

### Usage Examples

```yaml
# In core card config
type: cb-lcars-core-card
config:
  global:
    alert_condition: red_alert
    animation_speed: 1.5
    debug_mode: true
    locale: en-US
    time_format: 24h
    temperature_unit: fahrenheit
```

```javascript
// In card JavaScript
const animSpeed = window.cblcars.config.get('animation_speed', 1.0);
const theme = window.cblcars.config.get('alert_condition');

// Set config programmatically
window.cblcars.config.set('theme', 'blue_alert', true);  // persist=true

// Listen for config changes
window.cblcars.eventBus.subscribe('config.changed', 'my-card', (data) => {
    console.log(`Config ${data.key} changed:`, data.oldValue, '→', data.value);
});
```

**Acceptance Criteria:**
- ✅ Global config manager created
- ✅ Get/set with dot-notation
- ✅ Persist to localStorage option
- ✅ Event bus integration
- ✅ Special handling for theme changes
- ✅ Load persisted config on init

---

## 5.5: Implement Advanced Data Source Features

**Purpose:** Enhance data source system with advanced capabilities

### Feature 1: Data Source Transformations

**Enhancement to DataSourceManager:**

```javascript
// In DataSourceManager._fetchData()

/**
 * Apply transformation pipeline to fetched data
 * @private
 * 
 * @param {string} dsId - Data source ID
 * @param {any} rawData - Raw fetched data
 * @returns {any} Transformed data
 */
_applyTransformations(dsId, rawData) {
    const source = this._sources.get(dsId);
    if (!source || !source.config.transforms) {
        return rawData;
    }
    
    let data = rawData;
    const transforms = Array.isArray(source.config.transforms) 
        ? source.config.transforms 
        : [source.config.transforms];
    
    for (let i = 0; i < transforms.length; i++) {
        const transform = transforms[i];
        
        if (typeof transform === 'function') {
            try {
                data = transform(data);
                cblcarsLog.debug(`[DataSourceManager] Applied transform ${i+1}/${transforms.length} to ${dsId}`);
            } catch (error) {
                cblcarsLog.error(`[DataSourceManager] Transform ${i+1} failed for ${dsId}:`, error);
                // Continue with un-transformed data
            }
        }
    }
    
    return data;
}

// Update _fetchData() to use transformations
async _fetchData(dsId) {
    // ... existing fetch logic ...
    
    const rawData = await source.fetch();
    
    // Apply transformations
    const data = this._applyTransformations(dsId, rawData);
    
    // Cache and notify
    this._cache.set(dsId, data);
    this._notifySubscribers(dsId, data);
    
    // ... rest of logic ...
}
```

### Feature 2: Data Source Dependencies

**Configuration:**

```yaml
data_sources:
  # Base data source
  - id: weather_raw
    type: rest
    url: https://api.weather.com/forecast
    refresh: 60
  
  # Derived data source (depends on weather_raw)
  - id: weather_processed
    type: computed
    depends_on: [weather_raw]
    compute: |
      (data) => ({
        temp_f: data.weather_raw.temperature,
        temp_c: (data.weather_raw.temperature - 32) * 5/9,
        condition: data.weather_raw.condition.toLowerCase(),
        is_hot: data.weather_raw.temperature > 85
      })
```

**Implementation:**

```javascript
// Add computed data source type

/**
 * ComputedSource - Computed Data Source
 * 
 * Derives data from other data sources
 */
export class ComputedSource extends BaseSource {
    constructor(config, hass, dataSourceManager) {
        super(config, hass);
        
        this.dataSourceManager = dataSourceManager;
        this.dependencies = config.depends_on || [];
        this.computeFn = config.compute;
        
        if (typeof this.computeFn === 'string') {
            // Parse string as function
            try {
                this.computeFn = eval(`(${this.computeFn})`);
            } catch (e) {
                cblcarsLog.error('[ComputedSource] Failed to parse compute function:', e);
                this.computeFn = null;
            }
        }
    }
    
    /**
     * Fetch (compute) data
     */
    async fetch() {
        if (!this.computeFn) {
            throw new Error('No compute function defined');
        }
        
        // Gather dependency data
        const depData = {};
        for (const depId of this.dependencies) {
            const data = this.dataSourceManager.getData(depId);
            if (data === null) {
                throw new Error(`Dependency '${depId}' not available`);
            }
            depData[depId] = data;
        }
        
        // Compute result
        try {
            const result = this.computeFn(depData);
            return result;
        } catch (error) {
            cblcarsLog.error('[ComputedSource] Compute function failed:', error);
            throw error;
        }
    }
}

// Register computed source type in DataSourceManager.initialize()
case 'computed':
    source = new ComputedSource(config, this.hass, this);
    break;
```

### Feature 3: Data Source Caching Strategies

**Add caching options:**

```yaml
data_sources:
  - id: weather
    type: rest
    url: https://api.weather.com/forecast
    refresh: 60
    cache:
      strategy: time  # time, manual, none
      ttl: 300  # Time to live in seconds (5 minutes)
      invalidate_on: [weather.condition_changed]  # Event-based invalidation
```

**Implementation:**

```javascript
// In DataSourceManager

/**
 * Check if cached data is still valid
 * @private
 * 
 * @param {string} dsId - Data source ID
 * @returns {boolean} True if cache valid
 */
_isCacheValid(dsId) {
    const source = this._sources.get(dsId);
    const cacheConfig = source?.config?.cache;
    
    if (!cacheConfig || cacheConfig.strategy === 'none') {
        return false;  // No caching
    }
    
    if (cacheConfig.strategy === 'manual') {
        // Cache never expires automatically
        return this._cache.has(dsId);
    }
    
    if (cacheConfig.strategy === 'time') {
        const cached = this._cacheTimestamps.get(dsId);
        if (!cached) return false;
        
        const ttl = (cacheConfig.ttl || 300) * 1000;  // Convert to ms
        const age = Date.now() - cached;
        
        return age < ttl;
    }
    
    return false;
}

/**
 * Invalidate cache for a data source
 * 
 * @param {string} dsId - Data source ID
 */
invalidateCache(dsId) {
    this._cache.delete(dsId);
    this._cacheTimestamps.delete(dsId);
    cblcarsLog.info(`[DataSourceManager] Cache invalidated for ${dsId}`);
    
    // Trigger immediate fetch
    this._fetchData(dsId);
}

// Update getData() to check cache validity
getData(dsId) {
    if (this._isCacheValid(dsId)) {
        return this._cache.get(dsId) || null;
    }
    
    // Cache invalid, trigger fetch
    this._fetchData(dsId);
    
    // Return stale data if available
    return this._cache.get(dsId) || null;
}

// Setup event-based cache invalidation
_setupCacheInvalidation(dsId) {
    const source = this._sources.get(dsId);
    const invalidateOn = source?.config?.cache?.invalidate_on;
    
    if (!invalidateOn || !Array.isArray(invalidateOn)) return;
    
    for (const eventType of invalidateOn) {
        window.cblcars.eventBus?.subscribe(
            eventType,
            `datasource-${dsId}`,
            () => {
                cblcarsLog.debug(`[DataSourceManager] Cache invalidation triggered by event: ${eventType}`);
                this.invalidateCache(dsId);
            }
        );
    }
}
```

**Acceptance Criteria:**
- ✅ Transformation pipeline implemented
- ✅ Computed data sources supported
- ✅ Cache strategies implemented
- ✅ Event-based cache invalidation
- ✅ Manual cache invalidation API

---

## 5.6: Create Event Bus Debugging Tools

**Purpose:** Provide tools for debugging event bus communication

### Event Bus Inspector

**Add to window.cblcars.eventBus:**

```javascript
/**
 * Event Bus Inspector
 * 
 * Provides debugging and monitoring tools for event bus
 */
window.cblcars.eventBus.inspector = {
    /**
     * Enable event logging
     */
    enableLogging() {
        window.cblcars.eventBus._debugMode = true;
        cblcarsLog.info('[EventBus Inspector] Logging enabled');
    },
    
    /**
     * Disable event logging
     */
    disableLogging() {
        window.cblcars.eventBus._debugMode = false;
        cblcarsLog.info('[EventBus Inspector] Logging disabled');
    },
    
    /**
     * Get all subscribers
     * 
     * @returns {Object} Subscribers by event type
     */
    getSubscribers() {
        const subscribers = {};
        
        for (const [eventType, subs] of window.cblcars.eventBus._subscribers.entries()) {
            subscribers[eventType] = Array.from(subs).map(s => ({
                cardId: s.cardId,
                subscribedAt: new Date(s.subscribedAt).toISOString(),
                once: s.options.once || false
            }));
        }
        
        return subscribers;
    },
    
    /**
     * Get event history
     * 
     * @param {string} filter - Event type filter (supports wildcards)
     * @param {number} limit - Maximum events to return
     * @returns {Array} Filtered event history
     */
    getHistory(filter = null, limit = 100) {
        let history = window.cblcars.eventBus.getHistory(filter);
        
        if (limit) {
            history = history.slice(-limit);
        }
        
        return history.map(e => ({
            type: e.type,
            timestamp: new Date(e.metadata.timestamp).toISOString(),
            source: e.metadata.sourceCard || 'unknown',
            data: e.data
        }));
    },
    
    /**
     * Monitor events matching pattern
     * 
     * @param {string} pattern - Event type pattern (supports wildcards)
     * @param {Function} callback - Callback function (event) => void
     * @returns {Function} Unsubscribe function
     */
    monitor(pattern, callback) {
        return window.cblcars.eventBus.subscribe(
            pattern,
            'inspector',
            (data, metadata) => {
                callback({
                    type: pattern,
                    data,
                    metadata,
                    timestamp: new Date().toISOString()
                });
            }
        );
    },
    
    /**
     * Publish test event
     * 
     * @param {string} eventType - Event type
     * @param {any} data - Event data
     */
    publishTest(eventType, data) {
        window.cblcars.eventBus.publish(eventType, data, {
            sourceCard: 'inspector',
            test: true
        });
        
        cblcarsLog.info(`[EventBus Inspector] Published test event: ${eventType}`, data);
    },
    
    /**
     * Clear event history
     */
    clearHistory() {
        window.cblcars.eventBus.clearHistory();
        cblcarsLog.info('[EventBus Inspector] History cleared');
    },
    
    /**
     * Get statistics
     * 
     * @returns {Object} Event bus statistics
     */
    getStats() {
        const debugInfo = window.cblcars.eventBus.getDebugInfo();
        
        return {
            subscriberCount: debugInfo.subscriberCount,
            eventTypes: Object.keys(debugInfo.subscribersByType).length,
            eventHistorySize: debugInfo.eventHistorySize,
            mostActiveType: this._getMostActiveEventType(debugInfo.recentEvents),
            recentActivity: debugInfo.recentEvents
        };
    },
    
    /**
     * Get most active event type
     * @private
     */
    _getMostActiveEventType(recentEvents) {
        if (!recentEvents || recentEvents.length === 0) return null;
        
        const counts = {};
        for (const event of recentEvents) {
            counts[event.type] = (counts[event.type] || 0) + 1;
        }
        
        let maxType = null;
        let maxCount = 0;
        for (const [type, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                maxType = type;
            }
        }
        
        return { type: maxType, count: maxCount };
    }
};
```

### Browser Console Commands

**Add convenience functions to window:**

```javascript
/**
 * CB-LCARS Console Commands
 * 
 * Convenience functions for debugging in browser console
 */
window.cblcars.console = {
    /**
     * Get CB-LCARS status
     */
    status() {
        const debug = window.cblcars.debug.getInfo();
        const core = window.cblcars.core?.getDebugInfo();
        const eventBus = window.cblcars.eventBus?.inspector.getStats();
        
        console.table({
            'Core Initialized': debug.coreInitialized,
            'Cards Loaded': debug.cardsLoaded,
            'Event Bus': debug.eventBusActive ? 'Active' : 'Inactive',
            'Data Sources': core?.sourceCount || 0,
            'Event Types': eventBus?.eventTypes || 0,
            'Subscribers': eventBus?.subscriberCount || 0
        });
        
        return { debug, core, eventBus };
    },
    
    /**
     * List all cards
     */
    cards() {
        const core = window.cblcars.core;
        if (!core) return [];
        
        const cards = [];
        for (const [cardId, context] of core._cardInstances.entries()) {
            cards.push({
                id: cardId,
                type: context.config.type,
                entities: context.entities.length,
                dataSources: context.dataSources.length,
                createdAt: new Date(context.createdAt).toISOString()
            });
        }
        
        console.table(cards);
        return cards;
    },
    
    /**
     * List all data sources
     */
    dataSources() {
        const core = window.cblcars.core;
        if (!core || !core.dataSourceManager) return [];
        
        const info = core.dataSourceManager.getDebugInfo();
        console.table(info.sources);
        return info.sources;
    },
    
    /**
     * Monitor events
     * 
     * @param {string} pattern - Event pattern (supports wildcards)
     */
    monitorEvents(pattern = '*') {
        console.log(`Monitoring events matching: ${pattern}`);
        console.log('Call stop() to stop monitoring');
        
        const unsub = window.cblcars.eventBus.inspector.monitor(pattern, (event) => {
            console.log(`[${event.timestamp}] ${event.type}:`, event.data);
        });
        
        // Return stop function
        return {
            stop: () => {
                unsub();
                console.log('Stopped monitoring events');
            }
        };
    },
    
    /**
     * Get event history
     * 
     * @param {string} filter - Event type filter
     * @param {number} limit - Max events
     */
    events(filter = null, limit = 20) {
        const history = window.cblcars.eventBus.inspector.getHistory(filter, limit);
        console.table(history);
        return history;
    },
    
    /**
     * Publish test event
     * 
     * @param {string} type - Event type
     * @param {any} data - Event data
     */
    emit(type, data) {
        window.cblcars.eventBus.inspector.publishTest(type, data);
        console.log(`Published test event: ${type}`);
    },
    
    /**
     * Set alert condition
     * 
     * @param {string} condition - Alert condition (green_alert, red_alert, etc.)
     */
    setAlert(condition) {
        window.cblcars.config.set('alert_condition', condition);
        console.log(`Alert condition set to: ${condition}`);
    },
    
    /**
     * Show help
     */
    help() {
        console.log(`
CB-LCARS Console Commands:
-------------------------
cblcars.console.status()                  - Show system status
cblcars.console.cards()                   - List all cards
cblcars.console.dataSources()             - List data sources
cblcars.console.monitorEvents(pattern)    - Monitor events (wildcards supported)
cblcars.console.events(filter, limit)     - Show event history
cblcars.console.emit(type, data)          - Publish test event
cblcars.console.setAlert(condition)       - Change alert condition
cblcars.console.help()                    - Show this help

Examples:
--------
cblcars.console.status()
cblcars.console.monitorEvents('card.*')
cblcars.console.events('theme.*', 10)
cblcars.console.emit('test.event', { hello: 'world' })
cblcars.console.setAlert('red_alert')
        `);
    }
};

// Show welcome message
console.log('%c CB-LCARS Console Commands Available ', 'background: #9966CC; color: white; font-weight: bold; padding: 4px 8px;');
console.log('Type cblcars.console.help() for command list');
```

**Acceptance Criteria:**
- ✅ Event bus inspector implemented
- ✅ Subscriber introspection
- ✅ Event history querying
- ✅ Event monitoring
- ✅ Test event publishing
- ✅ Console commands created
- ✅ Help documentation

---

## 5.7: Build Performance Monitoring

**Purpose:** Track and report system performance

### Performance Metrics Collection

**Already started in CBLCARSCoreCard, enhance with:**

```javascript
/**
 * Advanced Performance Monitor
 * 
 * Tracks detailed performance metrics
 */
window.cblcars.performanceMonitor = {
    // ... existing metrics code ...
    
    /**
     * Track card render time
     * 
     * @param {string} cardId - Card ID
     * @param {number} duration - Render duration in ms
     */
    trackRender(cardId, duration) {
        if (!this._renderTimes) {
            this._renderTimes = new Map();
        }
        
        if (!this._renderTimes.has(cardId)) {
            this._renderTimes.set(cardId, []);
        }
        
        const times = this._renderTimes.get(cardId);
        times.push({ timestamp: Date.now(), duration });
        
        // Keep last 100 renders
        if (times.length > 100) {
            times.shift();
        }
    },
    
    /**
     * Get render statistics
     * 
     * @returns {Object} Render stats
     */
    getRenderStats() {
        if (!this._renderTimes) return null;
        
        const stats = {};
        
        for (const [cardId, times] of this._renderTimes.entries()) {
            const durations = times.map(t => t.duration);
            const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
            const max = Math.max(...durations);
            const min = Math.min(...durations);
            
            stats[cardId] = {
                count: durations.length,
                avg: avg.toFixed(2),
                min: min.toFixed(2),
                max: max.toFixed(2)
            };
        }
        
        return stats;
    },
    
    /**
     * Track animation frame rate
     */
    trackFrameRate() {
        if (this._frameRateTracking) return;
        
        this._frameRateTracking = true;
        this._frames = [];
        let lastTime = performance.now();
        
        const measureFrame = () => {
            if (!this._frameRateTracking) return;
            
            const now = performance.now();
            const delta = now - lastTime;
            this._frames.push(delta);
            
            // Keep last 60 frames
            if (this._frames.length > 60) {
                this._frames.shift();
            }
            
            lastTime = now;
            requestAnimationFrame(measureFrame);
        };
        
        requestAnimationFrame(measureFrame);
    },
    
    /**
     * Get frame rate statistics
     * 
     * @returns {Object} Frame rate stats
     */
    getFrameRateStats() {
        if (!this._frames || this._frames.length === 0) {
            return null;
        }
        
        const avgDelta = this._frames.reduce((a, b) => a + b, 0) / this._frames.length;
        const fps = 1000 / avgDelta;
        
        return {
            fps: fps.toFixed(2),
            avgFrameTime: avgDelta.toFixed(2),
            minFps: (1000 / Math.max(...this._frames)).toFixed(2),
            maxFps: (1000 / Math.min(...this._frames)).toFixed(2)
        };
    },
    
    /**
     * Stop frame rate tracking
     */
    stopFrameRateTracking() {
        this._frameRateTracking = false;
    },
    
    /**
     * Generate performance report
     * 
     * @returns {Object} Complete performance report
     */
    generateReport() {
        const metrics = this.collect();
        const renderStats = this.getRenderStats();
        const frameRateStats = this.getFrameRateStats();
        
        const report = {
            timestamp: new Date().toISOString(),
            system: metrics,
            rendering: renderStats,
            animation: frameRateStats,
            recommendations: this._generateRecommendations(metrics, renderStats, frameRateStats)
        };
        
        cblcarsLog.info('[PerformanceMonitor] Performance Report:', report);
        
        return report;
    },
    
    /**
     * Generate performance recommendations
     * @private
     */
    _generateRecommendations(metrics, renderStats, frameRateStats) {
        const recommendations = [];
        
        // Check card count
        if (metrics.cardCount > 50) {
            recommendations.push({
                severity: 'warning',
                message: `High card count (${metrics.cardCount}). Consider splitting into multiple views.`
            });
        }
        
        // Check render times
        if (renderStats) {
            for (const [cardId, stats] of Object.entries(renderStats)) {
                if (parseFloat(stats.avg) > 100) {
                    recommendations.push({
                        severity: 'warning',
                        message: `Slow render for ${cardId}: ${stats.avg}ms average. Consider optimization.`
                    });
                }
            }
        }
        
        // Check frame rate
        if (frameRateStats && parseFloat(frameRateStats.fps) < 30) {
            recommendations.push({
                severity: 'error',
                message: `Low frame rate (${frameRateStats.fps} FPS). Animations may appear choppy.`
            });
        }
        
        // Check memory
        if (metrics.memoryUsage > 100 * 1024 * 1024