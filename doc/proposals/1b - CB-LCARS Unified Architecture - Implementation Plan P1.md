# CB-LCARS Unified Architecture - Implementation Plan

**Project:** CB-LCARS Custom Cards for Home Assistant  
**Document Version:** 1.0 (Implementation Phases)  
**Date:** 2025-01-23  
**Author:** CB-LCARS Development Team

---

## Table of Contents

1. [Implementation Phases](#implementation-phases)
2. [Migration Strategy](#migration-strategy)
3. [API Reference](#api-reference)
4. [Testing & Validation](#testing--validation)
5. [Documentation Requirements](#documentation-requirements)
6. [Appendix](#appendix)

---

## Implementation Phases

### Overview of Phased Approach

```
Phase 1: Core Infrastructure Foundation
├─ Extract core systems from MSD
├─ Create unified initialization
├─ Build event bus and helpers
└─ Duration: Foundational work (High Priority)

Phase 2: Overlay & Control System Refactor
├─ Extract overlays from MSD
├─ Create BaseOverlay with loading states
├─ Build native slider control
└─ Duration: Component library (High Priority)

Phase 3: Rules Engine & Style Library
├─ Extract rules engine from MSD
├─ Build style library system
├─ Create YAML preset format
└─ Duration: Styling foundation (Medium Priority)

Phase 4: Modernize Multimeter Card
├─ Replace my-slider-v2 dependency
├─ Use native slider control
├─ Apply overlay/rules system
└─ Duration: First legacy card migration (Medium Priority)

Phase 5: Core Card & Advanced Features
├─ Build cb-lcars-core-card
├─ Enhanced data source management
├─ Event bus advanced features
└─ Duration: Optional enhancements (Low Priority)

Phase 6: Legacy Card Migration
├─ Migrate button cards
├─ Migrate elbow/label cards
├─ Deprecate button-card templates
└─ Duration: Complete modernization (Ongoing)

Phase 7: Documentation & Testing
├─ Comprehensive user documentation
├─ API reference documentation
├─ Migration guides
└─ Duration: Continuous (All Phases)
```

---

## Phase 1: Core Infrastructure Foundation

**Goal:** Extract and unify core systems from MSD as shared foundation

**Priority:** High - Foundational work required for all subsequent phases

### Tasks Overview

```
Phase 1 Tasks
├─ 1.1: Create Core Module Structure
├─ 1.2: Extract SystemsManager from MSD
├─ 1.3: Build DataSourceManager
├─ 1.4: Implement Event Bus
├─ 1.5: Update CBLCARSBaseCard
└─ 1.6: Integration Testing
```

### 1.1: Create Core Module Structure

**Files to Create:**

```
src/core/
├── cb-lcars-core.js              # Main CBLCARSCore class
├── cb-lcars-init.js              # Lightweight initialization
├── cb-lcars-event-bus.js         # Event bus implementation
├── systems-manager/
│   ├── index.js                  # SystemsManager (extracted from MSD)
│   └── entity-tracker.js         # Entity subscription/notification
├── data-sources/
│   ├── index.js                  # DataSourceManager
│   ├── rest-source.js            # REST API polling
│   └── base-source.js            # Base data source class
├── rules-engine/
│   ├── index.js                  # RulesEngine (Phase 3)
│   ├── condition-evaluator.js   # Condition matching logic (Phase 3)
│   └── rule-matcher.js           # Rule resolution (Phase 3)
└── styling/
    ├── style-library.js          # StyleLibrary (Phase 3)
    └── theme-manager.js          # Theme switching (Phase 3)
```

**Acceptance Criteria:**
- ✅ Core module structure created
- ✅ Basic imports working
- ✅ No breaking changes to existing cards

### 1.2: Extract SystemsManager from MSD

**Current Location:** `src/msd/systems-manager/index.js`

**Target Location:** `src/core/systems-manager/index.js`

**Changes Required:**

1. **Remove MSD-specific dependencies**
2. **Generalize entity tracking for all cards**
3. **Add subscription/notification system**

**Code: SystemsManager (src/core/systems-manager/index.js)**

```javascript
/**
 * SystemsManager - Centralized Entity State Tracking
 * 
 * Manages entity state subscriptions for ALL CB-LCARS cards
 * Provides efficient update notifications when entities change
 * 
 * RESPONSIBILITIES:
 * - Track entity states from HASS
 * - Manage card subscriptions to entities
 * - Notify cards when subscribed entities change
 * - Detect entity changes efficiently
 * - Provide entity state queries
 * 
 * USAGE:
 * - One instance shared by all cards (via CBLCARSCore)
 * - Cards subscribe to entities they care about
 * - SystemsManager notifies cards on state changes
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class SystemsManager {
    constructor(hass) {
        this.hass = hass;
        
        // Entity tracking
        this._entityStates = new Map();  // Map<entityId, state>
        this._previousStates = new Map();  // Map<entityId, previousState>
        
        // Subscription tracking
        this._subscribers = new Map();  // Map<entityId, Set<{cardId, callback}>>
        
        // Change detection
        this._lastHassUpdate = Date.now();
        
        // Analysis tracking (for debugging control-triggered changes)
        this._lastEntityAnalysis = null;
        
        cblcarsLog.info('[SystemsManager] Initialized');
    }

    /**
     * Subscribe to entity state changes
     * 
     * @param {string} entityId - Entity to subscribe to
     * @param {string} cardId - Card making the subscription
     * @param {Function} callback - Called when entity changes (state) => void
     */
    subscribe(entityId, cardId, callback) {
        if (!entityId || !cardId || !callback) {
            cblcarsLog.warn('[SystemsManager] Invalid subscription parameters');
            return;
        }

        // Get or create subscriber set for this entity
        if (!this._subscribers.has(entityId)) {
            this._subscribers.set(entityId, new Set());
        }

        const subscription = { cardId, callback };
        this._subscribers.get(entityId).add(subscription);

        cblcarsLog.debug(`[SystemsManager] Card ${cardId} subscribed to ${entityId}`);

        // If entity already has state, send initial notification
        const currentState = this.hass?.states?.[entityId];
        if (currentState) {
            this._entityStates.set(entityId, currentState);
            
            // Send initial state to new subscriber
            try {
                callback(currentState);
            } catch (error) {
                cblcarsLog.error(`[SystemsManager] Error in initial callback for ${cardId}:`, error);
            }
        }
    }

    /**
     * Unsubscribe from entity state changes
     * 
     * @param {string} entityId - Entity to unsubscribe from
     * @param {string} cardId - Card unsubscribing
     */
    unsubscribe(entityId, cardId) {
        const subscribers = this._subscribers.get(entityId);
        if (!subscribers) return;

        // Remove all subscriptions from this card for this entity
        for (const sub of subscribers) {
            if (sub.cardId === cardId) {
                subscribers.delete(sub);
            }
        }

        // Clean up empty subscriber sets
        if (subscribers.size === 0) {
            this._subscribers.delete(entityId);
        }

        cblcarsLog.debug(`[SystemsManager] Card ${cardId} unsubscribed from ${entityId}`);
    }

    /**
     * Get current state of an entity
     * 
     * @param {string} entityId - Entity ID
     * @returns {Object|null} Entity state object or null
     */
    getState(entityId) {
        return this.hass?.states?.[entityId] || null;
    }

    /**
     * Update HASS reference and detect changes
     * 
     * @param {Object} hass - New HASS instance
     */
    updateHass(hass) {
        const oldHass = this.hass;
        this.hass = hass;
        this._lastHassUpdate = Date.now();

        // Detect entity changes for subscribed entities
        this._detectEntityChanges(oldHass, hass);
    }

    /**
     * Detect which subscribed entities have changed
     * @private
     * 
     * @param {Object} oldHass - Previous HASS instance
     * @param {Object} newHass - New HASS instance
     */
    _detectEntityChanges(oldHass, newHass) {
        if (!oldHass || !newHass) return;

        const changedEntities = [];

        // Check each subscribed entity for changes
        for (const entityId of this._subscribers.keys()) {
            const oldState = oldHass.states?.[entityId];
            const newState = newHass.states?.[entityId];

            if (!oldState || !newState) continue;

            // Check if state changed
            const stateChanged = oldState.state !== newState.state;
            
            // Check if attributes changed
            const attributesChanged = JSON.stringify(oldState.attributes) !== 
                                     JSON.stringify(newState.attributes);

            if (stateChanged || attributesChanged) {
                changedEntities.push({
                    entityId,
                    oldState,
                    newState,
                    stateChanged,
                    attributesChanged
                });

                // Store previous state
                this._previousStates.set(entityId, oldState);
                this._entityStates.set(entityId, newState);

                // Notify subscribers
                this._notifySubscribers(entityId, newState, oldState);
            }
        }

        if (changedEntities.length > 0) {
            cblcarsLog.debug(`[SystemsManager] Detected ${changedEntities.length} entity changes`);
        }
    }

    /**
     * Notify subscribers of entity change
     * @private
     * 
     * @param {string} entityId - Changed entity
     * @param {Object} newState - New state
     * @param {Object} oldState - Old state
     */
    _notifySubscribers(entityId, newState, oldState) {
        const subscribers = this._subscribers.get(entityId);
        if (!subscribers || subscribers.size === 0) return;

        cblcarsLog.debug(`[SystemsManager] Notifying ${subscribers.size} subscribers of ${entityId} change`);

        for (const { cardId, callback } of subscribers) {
            try {
                callback(newState, oldState);
            } catch (error) {
                cblcarsLog.error(`[SystemsManager] Error in subscriber ${cardId} callback:`, error);
            }
        }
    }

    /**
     * Get debug information
     * 
     * @returns {Object} Debug info
     */
    getDebugInfo() {
        const subscriberInfo = {};
        for (const [entityId, subscribers] of this._subscribers.entries()) {
            subscriberInfo[entityId] = Array.from(subscribers).map(s => s.cardId);
        }

        return {
            trackedEntities: this._subscribers.size,
            subscriberInfo,
            lastUpdate: this._lastHassUpdate,
            totalSubscriptions: Array.from(this._subscribers.values())
                .reduce((sum, subs) => sum + subs.size, 0)
        };
    }

    /**
     * Cleanup all subscriptions
     */
    destroy() {
        this._subscribers.clear();
        this._entityStates.clear();
        this._previousStates.clear();
        cblcarsLog.info('[SystemsManager] Destroyed');
    }
}
```

**Migration Steps:**

1. Copy `src/msd/systems-manager/index.js` to `src/core/systems-manager/index.js`
2. Remove MSD-specific code (overlay references, etc.)
3. Generalize for use by all cards
4. Update MSD to import from new location
5. Test that MSD still works with refactored SystemsManager

**Acceptance Criteria:**
- ✅ SystemsManager extracted to core
- ✅ MSD imports from new location
- ✅ No functionality lost
- ✅ All existing tests pass

### 1.3: Build DataSourceManager

**Purpose:** Centralized data fetching/polling with retry logic

**Code: DataSourceManager (src/core/data-sources/index.js)**

```javascript
/**
 * DataSourceManager - Centralized External Data Management
 * 
 * Manages REST API polling, WebSocket connections, and data caching
 * Supports multiple subscribers per data source
 * Handles retry logic and error recovery
 * 
 * RESPONSIBILITIES:
 * - Initialize data sources from config
 * - Poll REST APIs at configured intervals
 * - Cache responses
 * - Notify subscribers on data updates
 * - Handle errors and retry failures
 * 
 * USAGE:
 * - One instance shared by all cards (via CBLCARSCore)
 * - Cards declare data sources in config
 * - Cards subscribe to data source updates
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { RestSource } from './rest-source.js';

export class DataSourceManager {
    constructor(hass) {
        this.hass = hass;
        
        // Data source instances
        this._sources = new Map();  // Map<dsId, DataSource>
        
        // Cached data
        this._cache = new Map();  // Map<dsId, data>
        
        // Subscribers
        this._subscribers = new Map();  // Map<dsId, Set<{cardId, callback}>>
        
        // Polling intervals
        this._intervals = new Map();  // Map<dsId, intervalId>
        
        cblcarsLog.info('[DataSourceManager] Initialized');
    }

    /**
     * Initialize a data source
     * 
     * @param {Object} config - Data source configuration
     * @param {string} config.id - Unique identifier
     * @param {string} config.type - Type (rest, websocket, etc.)
     * @param {string} config.url - URL to fetch from
     * @param {number} config.refresh - Refresh interval in seconds
     * @param {Object} config.headers - HTTP headers (for REST)
     * @param {Function} config.transform - Transform function
     */
    initialize(config) {
        const { id, type } = config;

        if (!id || !type) {
            cblcarsLog.error('[DataSourceManager] Data source config missing id or type');
            return;
        }

        if (this._sources.has(id)) {
            cblcarsLog.warn(`[DataSourceManager] Data source ${id} already initialized`);
            return;
        }

        cblcarsLog.info(`[DataSourceManager] Initializing data source: ${id} (${type})`);

        // Create data source instance based on type
        let source;
        switch (type) {
            case 'rest':
                source = new RestSource(config, this.hass);
                break;
            
            case 'websocket':
                // Future enhancement
                cblcarsLog.warn(`[DataSourceManager] WebSocket data sources not yet implemented`);
                return;
            
            default:
                cblcarsLog.error(`[DataSourceManager] Unknown data source type: ${type}`);
                return;
        }

        this._sources.set(id, source);

        // Start polling if configured
        if (config.refresh && config.refresh > 0) {
            this._startPolling(id);
        }

        // Fetch initial data
        this._fetchData(id);
    }

    /**
     * Subscribe to data source updates
     * 
     * @param {string} dsId - Data source ID
     * @param {string} cardId - Card making subscription
     * @param {Function} callback - Called on data update (data) => void
     */
    subscribe(dsId, cardId, callback) {
        if (!dsId || !cardId || !callback) {
            cblcarsLog.warn('[DataSourceManager] Invalid subscription parameters');
            return;
        }

        // Get or create subscriber set
        if (!this._subscribers.has(dsId)) {
            this._subscribers.set(dsId, new Set());
        }

        const subscription = { cardId, callback };
        this._subscribers.get(dsId).add(subscription);

        cblcarsLog.debug(`[DataSourceManager] Card ${cardId} subscribed to data source ${dsId}`);

        // Send cached data if available
        const cachedData = this._cache.get(dsId);
        if (cachedData) {
            try {
                callback(cachedData);
            } catch (error) {
                cblcarsLog.error(`[DataSourceManager] Error in initial callback for ${cardId}:`, error);
            }
        }
    }

    /**
     * Unsubscribe from data source
     * 
     * @param {string} dsId - Data source ID
     * @param {string} cardId - Card unsubscribing
     */
    unsubscribe(dsId, cardId) {
        const subscribers = this._subscribers.get(dsId);
        if (!subscribers) return;

        for (const sub of subscribers) {
            if (sub.cardId === cardId) {
                subscribers.delete(sub);
            }
        }

        // If no more subscribers, stop polling
        if (subscribers.size === 0) {
            this._stopPolling(dsId);
            this._subscribers.delete(dsId);
        }

        cblcarsLog.debug(`[DataSourceManager] Card ${cardId} unsubscribed from ${dsId}`);
    }

    /**
     * Get cached data for a data source
     * 
     * @param {string} dsId - Data source ID
     * @returns {any} Cached data or null
     */
    getData(dsId) {
        return this._cache.get(dsId) || null;
    }

    /**
     * Update HASS reference
     * 
     * @param {Object} hass - New HASS instance
     */
    updateHass(hass) {
        this.hass = hass;
        
        // Update HASS in all sources
        for (const source of this._sources.values()) {
            if (source.updateHass) {
                source.updateHass(hass);
            }
        }
    }

    /**
     * Start polling a data source
     * @private
     * 
     * @param {string} dsId - Data source ID
     */
    _startPolling(dsId) {
        const source = this._sources.get(dsId);
        if (!source) return;

        const refreshSeconds = source.config.refresh;
        if (!refreshSeconds || refreshSeconds <= 0) return;

        // Clear existing interval
        this._stopPolling(dsId);

        cblcarsLog.info(`[DataSourceManager] Starting polling for ${dsId} (${refreshSeconds}s interval)`);

        // Set up polling interval
        const intervalId = setInterval(() => {
            this._fetchData(dsId);
        }, refreshSeconds * 1000);

        this._intervals.set(dsId, intervalId);
    }

    /**
     * Stop polling a data source
     * @private
     * 
     * @param {string} dsId - Data source ID
     */
    _stopPolling(dsId) {
        const intervalId = this._intervals.get(dsId);
        if (intervalId) {
            clearInterval(intervalId);
            this._intervals.delete(dsId);
            cblcarsLog.debug(`[DataSourceManager] Stopped polling for ${dsId}`);
        }
    }

    /**
     * Fetch data from a source
     * @private
     * 
     * @param {string} dsId - Data source ID
     */
    async _fetchData(dsId) {
        const source = this._sources.get(dsId);
        if (!source) {
            cblcarsLog.warn(`[DataSourceManager] Cannot fetch - source ${dsId} not found`);
            return;
        }

        try {
            cblcarsLog.debug(`[DataSourceManager] Fetching data from ${dsId}`);
            
            const data = await source.fetch();
            
            // Cache the data
            this._cache.set(dsId, data);
            
            // Notify subscribers
            this._notifySubscribers(dsId, data);
            
            cblcarsLog.debug(`[DataSourceManager] Data fetched successfully from ${dsId}`);
            
        } catch (error) {
            cblcarsLog.error(`[DataSourceManager] Error fetching data from ${dsId}:`, error);
            
            // Notify subscribers of error
            this._notifySubscribers(dsId, null, error);
        }
    }

    /**
     * Notify subscribers of data update
     * @private
     * 
     * @param {string} dsId - Data source ID
     * @param {any} data - New data
     * @param {Error} error - Error if fetch failed
     */
    _notifySubscribers(dsId, data, error = null) {
        const subscribers = this._subscribers.get(dsId);
        if (!subscribers || subscribers.size === 0) return;

        cblcarsLog.debug(`[DataSourceManager] Notifying ${subscribers.size} subscribers of ${dsId} update`);

        for (const { cardId, callback } of subscribers) {
            try {
                if (error) {
                    callback(null, error);
                } else {
                    callback(data);
                }
            } catch (callbackError) {
                cblcarsLog.error(`[DataSourceManager] Error in subscriber ${cardId} callback:`, callbackError);
            }
        }
    }

    /**
     * Destroy a data source
     * 
     * @param {string} dsId - Data source ID
     */
    destroy(dsId) {
        // Stop polling
        this._stopPolling(dsId);
        
        // Remove source
        const source = this._sources.get(dsId);
        if (source?.destroy) {
            source.destroy();
        }
        this._sources.delete(dsId);
        
        // Clear cache
        this._cache.delete(dsId);
        
        // Clear subscribers
        this._subscribers.delete(dsId);
        
        cblcarsLog.info(`[DataSourceManager] Destroyed data source: ${dsId}`);
    }

    /**
     * Get debug information
     * 
     * @returns {Object} Debug info
     */
    getDebugInfo() {
        const sourceInfo = {};
        for (const [dsId, source] of this._sources.entries()) {
            const subscribers = this._subscribers.get(dsId) || new Set();
            sourceInfo[dsId] = {
                type: source.config.type,
                url: source.config.url,
                refresh: source.config.refresh,
                subscribers: Array.from(subscribers).map(s => s.cardId),
                hasCache: this._cache.has(dsId),
                polling: this._intervals.has(dsId)
            };
        }

        return {
            sourceCount: this._sources.size,
            sources: sourceInfo
        };
    }

    /**
     * Cleanup all data sources
     */
    destroyAll() {
        for (const dsId of this._sources.keys()) {
            this.destroy(dsId);
        }
        cblcarsLog.info('[DataSourceManager] Destroyed all data sources');
    }
}
```

**Code: RestSource (src/core/data-sources/rest-source.js)**

```javascript
/**
 * RestSource - REST API Data Source
 * 
 * Fetches data from REST APIs with configurable options
 * Supports authentication, custom headers, and transforms
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { BaseSource } from './base-source.js';

export class RestSource extends BaseSource {
    constructor(config, hass) {
        super(config, hass);
        
        this.url = config.url;
        this.method = config.method || 'GET';
        this.headers = config.headers || {};
        this.body = config.body;
        
        // Transform function (optional)
        this.transform = config.transform;
        
        // Retry configuration
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 1000;  // ms
        this._retryCount = 0;
    }

    /**
     * Fetch data from REST API
     * 
     * @returns {Promise<any>} Fetched and transformed data
     */
    async fetch() {
        try {
            // Resolve URL (may contain template variables)
            const resolvedUrl = this._resolveUrl(this.url);
            
            // Build fetch options
            const options = {
                method: this.method,
                headers: this._resolveHeaders(this.headers)
            };
            
            if (this.body && this.method !== 'GET') {
                options.body = JSON.stringify(this.body);
                options.headers['Content-Type'] = 'application/json';
            }
            
            cblcarsLog.debug(`[RestSource] Fetching from ${resolvedUrl}`);
            
            // Fetch data
            const response = await fetch(resolvedUrl, options);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Parse response
            let data;
            const contentType = response.headers.get('content-type');
            
            if (contentType?.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }
            
            // Apply transform if provided
            if (this.transform && typeof this.transform === 'function') {
                try {
                    data = this.transform(data);
                } catch (error) {
                    cblcarsLog.error('[RestSource] Error in transform function:', error);
                }
            }
            
            // Reset retry count on success
            this._retryCount = 0;
            
            return data;
            
        } catch (error) {
            cblcarsLog.error('[RestSource] Fetch error:', error);
            
            // Retry logic
            if (this._retryCount < this.maxRetries) {
                this._retryCount++;
                cblcarsLog.warn(`[RestSource] Retrying (${this._retryCount}/${this.maxRetries})...`);
                
                await this._delay(this.retryDelay);
                return this.fetch();
            }
            
            // Max retries exceeded
            this._retryCount = 0;
            throw error;
        }
    }

    /**
     * Resolve URL with template variables
     * @private
     * 
     * @param {string} url - URL template
     * @returns {string} Resolved URL
     */
    _resolveUrl(url) {
        if (!url) return '';
        
        // Replace ${variable} patterns
        return url.replace(/\$\{([^}]+)\}/g, (match, key) => {
            // Try to resolve from hass secrets, config, etc.
            if (key.startsWith('secrets.')) {
                const secretKey = key.replace('secrets.', '');
                return this.hass?.user?.credentials?.[secretKey] || match;
            }
            
            // Could add more resolution logic here
            return match;
        });
    }

    /**
     * Resolve headers with template variables
     * @private
     * 
     * @param {Object} headers - Header templates
     * @returns {Object} Resolved headers
     */
    _resolveHeaders(headers) {
        const resolved = {};
        
        for (const [key, value] of Object.entries(headers)) {
            resolved[key] = this._resolveUrl(value);
        }
        
        return resolved;
    }

    /**
     * Delay helper for retry logic
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

**Code: BaseSource (src/core/data-sources/base-source.js)**

```javascript
/**
 * BaseSource - Base class for data sources
 * 
 * Provides common functionality for all data source types
 */

export class BaseSource {
    constructor(config, hass) {
        this.config = config;
        this.hass = hass;
    }

    /**
     * Fetch data from source
     * Must be implemented by subclasses
     * 
     * @returns {Promise<any>}
     */
    async fetch() {
        throw new Error('fetch() must be implemented by subclass');
    }

    /**
     * Update HASS reference
     * 
     * @param {Object} hass - New HASS instance
     */
    updateHass(hass) {
        this.hass = hass;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Override in subclasses if needed
    }
}
```

**Acceptance Criteria:**
- ✅ DataSourceManager implemented
- ✅ REST data sources working
- ✅ Polling and caching functional
- ✅ Subscriber notifications working
- ✅ Retry logic tested

### 1.4: Implement Event Bus

**Code: Event Bus (src/core/cb-lcars-event-bus.js)**

```javascript
/**
 * CB-LCARS Event Bus
 * 
 * Centralized pub/sub system for card-to-card communication
 * 
 * FEATURES:
 * - Type-safe event registration
 * - Wildcard subscriptions (card.*, data_source.*)
 * - Event history with replay for late subscribers
 * - Once-only subscriptions
 * - Debug mode with event logging
 * 
 * USAGE:
 * - Always available at window.cblcars.eventBus
 * - Cards subscribe to events they care about
 * - Cards publish events to notify others
 * - Supports cross-card coordination
 */

import { cblcarsLog } from '../utils/cb-lcars-logging.js';

export class CBLCARSEventBus {
    constructor(config = {}) {
        this.config = config;
        
        // Subscribers
        this._subscribers = new Map();  // Map<eventType, Set<{cardId, callback, options}>>
        
        // Event history
        this._eventHistory = [];
        this._historyLimit = config.historyLimit || 100;
        
        // Debug mode
        this._debugMode = config.debug || false;
        
        cblcarsLog.info('[EventBus] Initialized');
    }

    /**
     * Subscribe to an event
     * 
     * @param {string} eventType - Event type (supports wildcards: 'card.*', 'data_source.weather')
     * @param {string} cardId - Subscribing card ID
     * @param {Function} callback - Event handler (data, metadata) => void
     * @param {Object} options - Subscription options
     * @param {boolean} options.replay - Replay recent matching events
     * @param {boolean} options.once - Unsubscribe after first event
     * @returns {Function} Unsubscribe function
     */
    subscribe(eventType, cardId, callback, options = {}) {
        if (!eventType || !cardId || !callback) {
            cblcarsLog.warn('[EventBus] Invalid subscription parameters');
            return () => {};
        }

        // Get or create subscriber set
        if (!this._subscribers.has(eventType)) {
            this._subscribers.set(eventType, new Set());
        }

        const subscription = {
            cardId,
            callback,
            options,
            subscribedAt: Date.now()
        };

        this._subscribers.get(eventType).add(subscription);

        if (this._debugMode) {
            cblcarsLog.debug(`[EventBus] ${cardId} subscribed to '${eventType}'`);
        }

        // Replay recent events if requested
        if (options.replay) {
            this._replayEvents(eventType, subscription);
        }

        // Return unsubscribe function
        return () => this.unsubscribe(eventType, cardId, callback);
    }

    /**
     * Unsubscribe from an event
     * 
     * @param {string} eventType - Event type
     * @param {string} cardId - Card unsubscribing
     * @param {Function} callback - Callback to remove
     */
    unsubscribe(eventType, cardId, callback) {
        const subscribers = this._subscribers.get(eventType);
        if (!subscribers) return;

        for (const sub of subscribers) {
            if (sub.cardId === cardId && sub.callback === callback) {
                subscribers.delete(sub);
                
                if (this._debugMode) {
                    cblcarsLog.debug(`[EventBus] ${cardId} unsubscribed from '${eventType}'`);
                }
                break;
            }
        }

        // Clean up empty subscriber sets
        if (subscribers.size === 0) {
            this._subscribers.delete(eventType);
        }
    }

    /**
     * Publish an event
     * 
     * @param {string} eventType - Event type
     * @param {any} data - Event payload
     * @param {Object} metadata - Event metadata
     * @param {string} metadata.sourceCard - Card publishing the event
     */
    publish(eventType, data, metadata = {}) {
        const event = {
            type: eventType,
            data,
            metadata: {
                ...metadata,
                timestamp: Date.now()
            }
        };

        // Store in history
        this._eventHistory.push(event);
        if (this._eventHistory.length > this._historyLimit) {
            this._eventHistory.shift();
        }

        if (this._debugMode) {
            cblcarsLog.debug(`[EventBus] Event published: ${eventType}`, event);
        }

        // Notify subscribers
        this._notifySubscribers(eventType, event);
    }

    /**
     * Notify subscribers of an event
     * @private
     * 
     * @param {string} eventType - Event type
     * @param {Object} event - Event object
     */
    _notifySubscribers(eventType, event) {
        // Direct subscribers
        const directSubs = this._subscribers.get(eventType) || new Set();
        
        // Wildcard subscribers (e.g., 'card.*' matches 'card.action')
        const wildcardSubs = this._getWildcardSubscribers(eventType);

        const allSubs = new Set([...directSubs, ...wildcardSubs]);

        for (const sub of allSubs) {
            try {
                sub.callback(event.data, event.metadata);

                // Unsubscribe if 'once' option was set
                if (sub.options.once) {
                    this.unsubscribe(eventType, sub.cardId, sub.callback);
                }
            } catch (error) {
                cblcarsLog.error(`[EventBus] Error in subscriber ${sub.cardId}:`, error);
            }
        }
    }

    /**
     * Get subscribers with wildcard patterns matching this event type
     * @private
     * 
     * @param {string} eventType - Event type to match
     * @returns {Set} Matching subscribers
     */
    _getWildcardSubscribers(eventType) {
        const matching = new Set();

        for (const [pattern, subscribers] of this._subscribers.entries()) {
            if (pattern.includes('*')) {
                const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                if (regex.test(eventType)) {
                    subscribers.forEach(sub => matching.add(sub));
                }
            }
        }

        return matching;
    }

    /**
     * Replay recent events matching a pattern
     * @private
     * 
     * @param {string} eventType - Event type pattern
     * @param {Object} subscription - Subscription object
     */
    _replayEvents(eventType, subscription) {
        const matchingEvents = this._eventHistory.filter(event => {
            if (eventType.includes('*')) {
                const regex = new RegExp('^' + eventType.replace(/\*/g, '.*') + '$');
                return regex.test(event.type);
            }
            return event.type === eventType;
        });

        if (this._debugMode && matchingEvents.length > 0) {
            cblcarsLog.debug(`[EventBus] Replaying ${matchingEvents.length} events for ${subscription.cardId}`);
        }

        for (const event of matchingEvents) {
            try {
                subscription.callback(event.data, event.metadata);
            } catch (error) {
                cblcarsLog.error(`[EventBus] Error replaying event for ${subscription.cardId}:`, error);
            }
        }
    }

    /**
     * Get event history
     * 
     * @param {string} eventType - Optional filter by type
     * @returns {Array} Event history
     */
    getHistory(eventType = null) {
        if (!eventType) {
            return [...this._eventHistory];
        }

        return this._eventHistory.filter(event => {
            if (eventType.includes('*')) {
                const regex = new RegExp('^' + eventType.replace(/\*/g, '.*') + '$');
                return regex.test(event.type);
            }
            return event.type === eventType;
        });
    }

    /**
     * Clear event history
     */
    clearHistory() {
        this._eventHistory = [];
        if (this._debugMode) {
            cblcarsLog.debug('[EventBus] Event history cleared');
        }
    }

    /**
     * Get debug info
     * 
     * @returns {Object} Debug information
     */
    getDebugInfo() {
        const subscribersByType = {};
        for (const [type, subs] of this._subscribers.entries()) {
            subscribersByType[type] = Array.from(subs).map(s => ({
                cardId: s.cardId,
                subscribedAt: s.subscribedAt,
                once: s.options.once || false
            }));
        }

        return {
            subscriberCount: this._subscribers.size,
            subscribersByType,
            eventHistorySize: this._eventHistory.length,
            recentEvents: this._eventHistory.slice(-10).map(e => ({
                type: e.type,
                timestamp: e.metadata.timestamp,
                sourceCard: e.metadata.sourceCard
            }))
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        this._subscribers.clear();
        this._eventHistory = [];
        cblcarsLog.info('[EventBus] Destroyed');
    }
}
```

**Acceptance Criteria:**
- ✅ Event bus implemented
- ✅ Subscribe/publish working
- ✅ Wildcard subscriptions functional
- ✅ Event history and replay working
- ✅ Debug mode operational

### 1.5: Update CBLCARSBaseCard

**Changes to CBLCARSBaseCard:**

1. Initialize core on first card
2. Create pipeline via core
3. Handle entity/data source updates
4. Connect to event bus (optional)

**Code: Updated CBLCARSBaseCard (src/cb-lcars.js - excerpt)**

```javascript
class CBLCARSBaseCard extends ButtonCard {
    constructor() {
        super();
        this._pipeline = null;
        this._overlays = [];
        this._controls = [];
        this._eventUnsubscribers = [];
        
        // Resize observer setup (existing code)
        this._resizeObserverTolerance = window.cblcars.resizeObserverTolerance || 16;
        this._debounceWait = window.cblcars.debounceWait || 100;
        this._resizeObserver = new ResizeObserver(() => {
            this._debouncedResizeHandler();
        });
        this._debouncedResizeHandler = this._debounce(() => this._updateCardSize(), this._debounceWait);
    }

    async setConfig(config) {
        if (!config) {
            throw new Error("The 'cblcars_card_config' section is required in the configuration.");
        }

        // Merge default templates
        const defaultTemplates = ['cb-lcars-base'];
        const userTemplates = (config.template) ? [...config.template] : [];
        const mergedTemplates = [...defaultTemplates, ...userTemplates];

        // Determine if this is an MSD card
        const isMSDCard = config.type === 'cb-lcars-msd-card' ||
                        this.constructor.cardType === 'cb-lcars-msd-card' ||
                        mergedTemplates.includes('cb-lcars-msd');

        // Store config
        this._config = {
            ...config,
            template: mergedTemplates,
            triggers_update: isMSDCard ? [] : this._collectTriggersUpdate(config)
        };

        // Load fonts
        loadAllFontsFromConfig(this._config);

        // Initialize core if we have HASS
        if (this.hass) {
            await this._ensureCoreInitialized();
        }

        // Create pipeline
        await this._createPipeline(isMSDCard);

        // Initialize components
        await this._initializeComponents();

        // Setup resize observer if enabled
        this._isResizeObserverEnabled = (config.enable_resize_observer || 
                                        (config.variables && config.variables.enable_resize_observer)) || 
                                        mergedTemplates.some(t => t.includes('animation') || t.includes('symbiont'));
        if (this._isResizeObserverEnabled) {
            this.enableResizeObserver();
        }

        // Call parent setConfig
        super.setConfig(this._config);
    }

    /**
     * Ensure core is initialized
     * @private
     */
    async _ensureCoreInitialized() {
        if (!window.cblcars.core._coreInitialized) {
            cblcarsLog.info('[CBLCARSBaseCard] Initializing core on first card');
            await window.cblcars.core.initialize(this.hass);
        }
    }

    /**
     * Create pipeline for this card
     * @private
     */
    async _createPipeline(isMSDCard) {
        this._pipeline = await window.cblcars.core.createPipeline(
            this,
            this._config,
            isMSDCard
        );
        
        cblcarsLog.debug(`[CBLCARSBaseCard] Pipeline created: ${this._pipeline.cardId}`);
    }

    /**
     * Initialize overlays and controls
     * @private
     */
    async _initializeComponents() {
        const overlaysCfg = this._config.variables?.overlays || [];
        const controlsCfg = this._config.variables?.controls || [];

        // Import renderers
        const { OverlayRenderer } = await import('./components/overlays/overlay-renderer.js');
        const { ControlRenderer } = await import('./components/controls/control-renderer.js');

        // Create overlays
        for (const cfg of overlaysCfg) {
            try {
                const overlay = OverlayRenderer.create(cfg, this._pipeline);
                await overlay.initialize();
                this._overlays.push(overlay);
            } catch (error) {
                cblcarsLog.error('[CBLCARSBaseCard] Error creating overlay:', error);
            }
        }

        // Create controls
        for (const cfg of controlsCfg) {
            try {
                const control = ControlRenderer.create(cfg, this._pipeline);
                await control.initialize();
                this._controls.push(control);
            } catch (error) {
                cblcarsLog.error('[CBLCARSBaseCard] Error creating control:', error);
            }
        }
    }

    /**
     * Collect triggers_update entities
     * @private
     */
    _collectTriggersUpdate(config) {
        const entities = new Set();
        
        // Main entity
        if (config.entity) entities.add(config.entity);
        
        // Entities from overlays
        const overlays = config.variables?.overlays || [];
        overlays.forEach(o => {
            if (o.entity) entities.add(o.entity);
            if (o.state_entity) entities.add(o.state_entity);
        });
        
        // Entities from controls
        const controls = config.variables?.controls || [];
        controls.forEach(c => {
            if (c.entity) entities.add(c.entity);
        });
        
        return Array.from(entities);
    }

    /**
     * Entity update callback from SystemsManager
     * @private
     */
    _onEntityUpdate(entityId, state, oldState) {
        cblcarsLog.debug(`[CBLCARSBaseCard] Entity updated: ${entityId}`);
        
        // Update overlays
        this._overlays.forEach(overlay => {
            if (overlay.config.entity === entityId || overlay.config.state_entity === entityId) {
                overlay.update(state);
            }
        });
        
        // Update controls
        this._controls.forEach(control => {
            if (control.config.entity === entityId) {
                control.update(state);
            }
        });
    }

    /**
     * Data source update callback from DataSourceManager
     * @private
     */
    _onDataSourceUpdate(dsId, data, error) {
        if (error) {
            cblcarsLog.error(`[CBLCARSBaseCard] Data source ${dsId} error:`, error);
            return;
        }
        
        cblcarsLog.debug(`[CBLCARSBaseCard] Data source updated: ${dsId}`);
        
        // Update overlays
        this._overlays.forEach(overlay => {
            if (overlay.config.data_source === dsId) {
                overlay.update(data);
            }
        });
        
        // Update controls
        this._controls.forEach(control => {
            if (control.config.data_source === dsId) {
                control.update(data);
            }
        });
    }

    /**
     * Data source ready callback (after retry)
     * @private
     */
    _onDataSourceReady(dsId) {
        cblcarsLog.info(`[CBLCARSBaseCard] Data source ${dsId} is now ready`);
        
        // Trigger re-initialization of waiting overlays
        this._overlays.forEach(overlay => {
            if (overlay.config.data_source === dsId && overlay._state === 'pending') {
                overlay.initialize();
            }
        });
    }

    setHass(hass) {
        const oldHass = this.hass;
        this.hass = hass;

        // Initialize core if not already
        if (!window.cblcars.core._coreInitialized) {
            window.cblcars.core.initialize(hass).then(() => {
                this._pipeline?.ingestHass(hass);
            });
        } else {
            // Forward to pipeline
            this._pipeline?.ingestHass(hass);
        }

        // Update overlays/controls
        this._overlays.forEach(overlay => overlay.setHass && overlay.setHass(hass));
        this._controls.forEach(control => control.setHass && control.setHass(hass));

        // Trigger LitElement update
        this.requestUpdate('hass', oldHass);
    }

    connectedCallback() {
        super.connectedCallback();
        
        // Create animation scope
        this._animationScopeId = `card-${this.id || this.constructor.cardType || Math.random().toString(36).slice(2)}`;
        this._animationScope = new CBLCARSAnimationScope(this._animationScopeId);
        window.cblcars.anim.scopes.set(this._animationScopeId, this._animationScope);
        
        // Setup event bus subscriptions (if configured)
        this._setupEventBusSubscriptions();
        
        // Enable resize observer if needed
        if (this._isResizeObserverEnabled && !this.parentElement?.classList.contains('preview')) {
            this.enableResizeObserver();
            window.addEventListener('resize', this._debouncedResizeHandler);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        
        // Cleanup animation scope
        const animationScope = window.cblcars.anim.scopes.get(this._animationScopeId);
        if (animationScope) {
            animationScope.destroy();
            window.cblcars.anim.scopes.delete(this._animationScopeId);
        }
        
        // Cleanup event bus subscriptions
        this._eventUnsubscribers?.forEach(unsub => unsub());
        this._eventUnsubscribers = [];
        
        // Cleanup pipeline
        this._pipeline?.destroy();
        
        // Cleanup overlays/controls
        this._overlays.forEach(o => o.destroy && o.destroy());
        this._controls.forEach(c => c.destroy && c.destroy());
        
        // Disable resize observer
        this.disableResizeObserver();
        window.removeEventListener('resize', this._debouncedResizeHandler);
    }

    /**
     * Setup event bus subscriptions from config
     * @private
     */
    _setupEventBusSubscriptions() {
        const eventSubs = this._config.variables?.event_subscriptions || [];
        
        for (const sub of eventSubs) {
            if (!sub.event_type || !sub.callback) continue;
            
            const unsubscribe = window.cblcars.eventBus.subscribe(
                sub.event_type,
                this._pipeline?.cardId || 'unknown',
                (data, metadata) => {
                    try {
                        // Execute callback (could be function name or inline function)
                        if (typeof sub.callback === 'function') {
                            sub.callback.call(this, data, metadata);
                        } else if (typeof this[sub.callback] === 'function') {
                            this[sub.callback](data, metadata);
                        }
                    } catch (error) {
                        cblcarsLog.error(`[CBLCARSBaseCard] Error in event callback:`, error);
                    }
                },
                sub.options || {}
            );
            
            this._eventUnsubscribers.push(unsubscribe);
        }
    }

    // ... rest of existing CBLCARSBaseCard methods ...
}
```

**Acceptance Criteria:**
- ✅ CBLCARSBaseCard initializes core
- ✅ Pipeline created via core
- ✅ Entity updates forwarded to overlays/controls
- ✅ Data source updates forwarded
- ✅ Event bus integration working
- ✅ Existing cards still functional

### 1.6: Integration Testing

**Test Scenarios:**

1. **Single Button Card**
   - Loads and initializes core
   - Subscribes to entity
   - Receives state updates
   - No errors in console

2. **Multiple Cards**
   - All cards share same core instance
   - Entity subscriptions independent
   - No duplicate core initialization

3. **Data Source Declaration**
   - Card declares data source
   - Data source initializes
   - Polling starts
   - Subscribers receive data

4. **Data Source Reference Before Declaration**
   - Card references data source
   - Subscription fails (expected)
   - Second card declares data source
   - First card retry succeeds
   - First card receives data

5. **Event Bus Communication**
   - Card A publishes event
   - Card B receives event
   - Wildcard subscriptions work
   - Event history populated

**Testing Checklist:**
- ✅ Core initialization works
- ✅ SystemsManager tracks entities
- ✅ DataSourceManager polls and caches
- ✅ Event bus pub/sub functional
- ✅ Cards receive updates
- ✅ No memory leaks
- ✅ Performance acceptable

---
