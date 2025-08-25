/**
 * MSD Data Manager - Real HASS History Integration
 * Fixed to use actual Home Assistant history API instead of fake data
 */

class MsdDataManager {
    constructor() {
        this.dataSources = new Map();
        this.subscriptions = new Map();
        this.entityCache = new Map();
        this.historyCache = new Map();

        // Performance tracking
        this.stats = {
            historyApiCalls: 0,
            cacheHits: 0,
            cacheMisses: 0,
            lastUpdate: Date.now()
        };

        // Expose debug interface
        if (typeof window !== 'undefined') {
            window.__msdDataManager = this;
        }
    }

    /**
     * Initialize data source with real HASS history preload
     * @param {string} sourceId - Data source identifier
     * @param {object} config - Data source configuration from YAML
     */
    async initializeDataSource(sourceId, config) {
        const dataSource = {
            id: sourceId,
            entity: config.entity,
            history: config.history || {},
            currentValue: null,
            historicalData: [],
            lastUpdate: null,
            subscribed: false
        };

        this.dataSources.set(sourceId, dataSource);

        // Get current entity state
        await this.updateCurrentEntityState(dataSource);

        // Preload historical data if configured
        if (config.history && config.history.preload) {
            await this.loadEntityHistory(dataSource, config.history.hours || 24);
        }

        // Subscribe to real-time updates
        this.subscribeToEntityUpdates(dataSource);

        return dataSource;
    }

    /**
     * Load real HASS entity history from Home Assistant history API
     * @param {object} dataSource - Data source object
     * @param {number} hours - Hours of history to load
     */
    async loadEntityHistory(dataSource, hours = 24) {
        const cacheKey = `${dataSource.entity}_${hours}h`;

        // Check cache first
        if (this.historyCache.has(cacheKey)) {
            const cached = this.historyCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minute cache
                dataSource.historicalData = cached.data;
                this.stats.cacheHits++;
                return cached.data;
            }
        }

        this.stats.cacheMisses++;

        try {
            // Calculate start time for history query
            const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
            const startTimeISO = startTime.toISOString();

            // Call Home Assistant history API
            const historyData = await this.callHassHistoryAPI(dataSource.entity, startTimeISO);

            // Process and clean the historical data
            const processedData = this.processHistoryApiResponse(historyData);

            // Cache the results
            this.historyCache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });

            dataSource.historicalData = processedData;
            dataSource.lastUpdate = Date.now();

            this.stats.historyApiCalls++;
            this.stats.lastUpdate = Date.now();

            return processedData;

        } catch (error) {
            console.warn(`MSD: Failed to load history for ${dataSource.entity}:`, error);
            // Fallback to empty history rather than fake data
            dataSource.historicalData = [];
            return [];
        }
    }

    /**
     * Call Home Assistant history API
     * @param {string} entityId - Entity ID to get history for
     * @param {string} startTime - ISO timestamp to start history from
     */
    async callHassHistoryAPI(entityId, startTime) {
        // Use the same HASS connection that other parts of the system use
        const hass = this.getHassInstance();
        if (!hass) {
            throw new Error('Home Assistant instance not available');
        }

        // Use HASS connection to call history API
        const historyUrl = `/api/history/period/${startTime}?filter_entity_id=${entityId}`;

        try {
            const response = await hass.callApi('GET', historyUrl);
            return response;
        } catch (error) {
            // Try alternative approach - use callWS for WebSocket API
            try {
                return await hass.callWS({
                    type: 'history/history_during_period',
                    start_time: startTime,
                    entity_ids: [entityId]
                });
            } catch (wsError) {
                throw new Error(`Both REST and WebSocket history API failed: ${error.message}, ${wsError.message}`);
            }
        }
    }

    /**
     * Process raw HASS history API response into sparkline format
     * @param {array} historyResponse - Raw HASS history API response
     */
    processHistoryApiResponse(historyResponse) {
        if (!historyResponse || !Array.isArray(historyResponse) || historyResponse.length === 0) {
            return [];
        }

        // HASS history API returns array of entities, each with state changes
        const entityHistory = historyResponse[0]; // First (and usually only) entity
        if (!entityHistory || !Array.isArray(entityHistory)) {
            return [];
        }

        // Convert HASS state changes to sparkline data points
        return entityHistory
            .map(stateChange => {
                const timestamp = new Date(stateChange.last_changed).getTime();
                const value = parseFloat(stateChange.state);

                // Skip invalid values
                if (isNaN(value) || !isFinite(value)) {
                    return null;
                }

                return {
                    timestamp,
                    value,
                    state: stateChange.state,
                    attributes: stateChange.attributes || {}
                };
            })
            .filter(point => point !== null)
            .sort((a, b) => a.timestamp - b.timestamp); // Ensure chronological order
    }

    /**
     * Get current entity state from HASS
     * @param {object} dataSource - Data source object
     */
    async updateCurrentEntityState(dataSource) {
        const hass = this.getHassInstance();
        if (!hass || !hass.states) {
            return;
        }

        const entityState = hass.states[dataSource.entity];
        if (entityState) {
            const value = parseFloat(entityState.state);
            if (!isNaN(value) && isFinite(value)) {
                dataSource.currentValue = value;

                // Add current state as latest data point if we have history
                if (dataSource.historicalData.length > 0) {
                    const timestamp = new Date(entityState.last_changed).getTime();
                    const lastPoint = dataSource.historicalData[dataSource.historicalData.length - 1];

                    // Only add if it's actually newer
                    if (timestamp > lastPoint.timestamp) {
                        dataSource.historicalData.push({
                            timestamp,
                            value,
                            state: entityState.state,
                            attributes: entityState.attributes || {}
                        });
                    }
                }
            }
        }
    }

    /**
     * Subscribe to real-time entity updates
     * @param {object} dataSource - Data source object
     */
    subscribeToEntityUpdates(dataSource) {
        if (dataSource.subscribed) return;

        const hass = this.getHassInstance();
        if (!hass) return;

        // Subscribe to entity state changes
        const unsubscribe = hass.connection.subscribeEvents(
            (event) => this.handleEntityStateChange(dataSource, event),
            'state_changed',
            { entity_id: dataSource.entity }
        );

        this.subscriptions.set(dataSource.id, unsubscribe);
        dataSource.subscribed = true;
    }

    /**
     * Handle real-time entity state changes
     * @param {object} dataSource - Data source object
     * @param {object} event - HASS state change event
     */
    handleEntityStateChange(dataSource, event) {
        if (event.data.entity_id !== dataSource.entity) return;

        const newState = event.data.new_state;
        if (!newState) return;

        const value = parseFloat(newState.state);
        if (isNaN(value) || !isFinite(value)) return;

        // Update current value
        dataSource.currentValue = value;

        // Add to historical data
        const timestamp = new Date(newState.last_changed).getTime();
        const newDataPoint = {
            timestamp,
            value,
            state: newState.state,
            attributes: newState.attributes || {}
        };

        dataSource.historicalData.push(newDataPoint);

        // Trim old data points (keep last 24 hours by default)
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
        dataSource.historicalData = dataSource.historicalData.filter(
            point => point.timestamp > cutoffTime
        );

        dataSource.lastUpdate = Date.now();
        this.stats.lastUpdate = Date.now();

        // Notify any listeners
        this.notifyDataSourceUpdate(dataSource);
    }

    /**
     * Get HASS instance from global scope or Home Assistant connection
     */
    getHassInstance() {
        // Try multiple ways to get HASS instance
        if (typeof window !== 'undefined') {
            // Custom button card context
            if (window._customButtonCardHass) {
                return window._customButtonCardHass;
            }

            // HA frontend context
            if (window.hassConnection) {
                return window.hassConnection;
            }

            // Direct HASS object
            if (window.hass) {
                return window.hass;
            }
        }

        // Try to get from card context if we're in a card
        if (this.cardContext && this.cardContext.hass) {
            return this.cardContext.hass;
        }

        return null;
    }

    /**
     * Set card context for HASS access
     * @param {object} cardContext - Card context with HASS instance
     */
    setCardContext(cardContext) {
        this.cardContext = cardContext;
    }

    /**
     * Notify listeners of data source updates
     * @param {object} dataSource - Updated data source
     */
    notifyDataSourceUpdate(dataSource) {
        // Emit custom event for sparkline updates
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('msd-data-update', {
                detail: {
                    sourceId: dataSource.id,
                    entity: dataSource.entity,
                    currentValue: dataSource.currentValue,
                    historicalData: dataSource.historicalData,
                    lastUpdate: dataSource.lastUpdate
                }
            });
            window.dispatchEvent(event);
        }
    }

    /**
     * Get data source by ID
     * @param {string} sourceId - Data source identifier
     */
    getDataSource(sourceId) {
        return this.dataSources.get(sourceId);
    }

    /**
     * Get all data sources
     */
    getAllDataSources() {
        return Array.from(this.dataSources.values());
    }

    /**
     * Get performance statistics
     */
    getStats() {
        return {
            ...this.stats,
            totalDataSources: this.dataSources.size,
            cachedHistoryEntries: this.historyCache.size,
            activeSubscriptions: this.subscriptions.size
        };
    }

    /**
     * Cleanup subscriptions and cache
     */
    destroy() {
        // Unsubscribe from all entity updates
        for (const [sourceId, unsubscribe] of this.subscriptions) {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        }

        this.subscriptions.clear();
        this.dataSources.clear();
        this.historyCache.clear();
        this.entityCache.clear();
    }
}

// Dual export system for CommonJS and ES modules compatibility
if (typeof module !== 'undefined' && module.exports) {
    // CommonJS export
    module.exports = { MsdDataManager };
} else if (typeof window !== 'undefined') {
    // Browser global
    window.MsdDataManager = MsdDataManager;
}

// ES module export
export { MsdDataManager };
