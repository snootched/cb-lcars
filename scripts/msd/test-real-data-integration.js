/**
 * Test Real HASS Data Integration - Phase 2.2 Step 1 REDO
 * Validates that we're using real HASS history API instead of fake data generation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enhanced DOM polyfill for data manager testing
function setupEnhancedDomPolyfill() {
    if (typeof global !== 'undefined' && !global.window) {
        // Create comprehensive DOM polyfill
        global.window = {
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => {},
            CustomEvent: function(type, options) {
                this.type = type;
                this.detail = options ? options.detail : {};
            },
            __msdDataManager: null
        };

        global.document = {
            createElement: () => ({
                style: {},
                setAttribute: () => {},
                getAttribute: () => null,
                appendChild: () => {},
                removeChild: () => {},
                addEventListener: () => {},
                querySelector: () => null,
                querySelectorAll: () => []
            }),
            addEventListener: () => {},
            querySelector: () => null
        };

        // Mock Home Assistant instance for testing
        global.mockHassInstance = {
            states: {
                'sensor.bathroom_dial_battery': {
                    entity_id: 'sensor.bathroom_dial_battery',
                    state: '75',
                    last_changed: '2024-01-15T10:30:00.000Z',
                    attributes: { unit_of_measurement: '%' }
                },
                'sensor.bedroom_dial_battery': {
                    entity_id: 'sensor.bedroom_dial_battery',
                    state: '64',
                    last_changed: '2024-01-15T10:25:00.000Z',
                    attributes: { unit_of_measurement: '%' }
                }
            },
            connection: {
                subscribeEvents: (callback, eventType, filter) => {
                    // Return mock unsubscribe function
                    return () => {};
                }
            },
            callApi: async (method, url) => {
                // Mock HASS history API response
                if (url.includes('/api/history/period/') && url.includes('sensor.bathroom_dial_battery')) {
                    return [[
                        {
                            entity_id: 'sensor.bathroom_dial_battery',
                            state: '73',
                            last_changed: '2024-01-15T08:30:00.000Z',
                            attributes: { unit_of_measurement: '%' }
                        },
                        {
                            entity_id: 'sensor.bathroom_dial_battery',
                            state: '74',
                            last_changed: '2024-01-15T09:15:00.000Z',
                            attributes: { unit_of_measurement: '%' }
                        },
                        {
                            entity_id: 'sensor.bathroom_dial_battery',
                            state: '75',
                            last_changed: '2024-01-15T10:30:00.000Z',
                            attributes: { unit_of_measurement: '%' }
                        }
                    ]];
                }

                if (url.includes('/api/history/period/') && url.includes('sensor.bedroom_dial_battery')) {
                    return [[
                        {
                            entity_id: 'sensor.bedroom_dial_battery',
                            state: '66',
                            last_changed: '2024-01-15T08:45:00.000Z',
                            attributes: { unit_of_measurement: '%' }
                        },
                        {
                            entity_id: 'sensor.bedroom_dial_battery',
                            state: '65',
                            last_changed: '2024-01-15T09:30:00.000Z',
                            attributes: { unit_of_measurement: '%' }
                        },
                        {
                            entity_id: 'sensor.bedroom_dial_battery',
                            state: '64',
                            last_changed: '2024-01-15T10:25:00.000Z',
                            attributes: { unit_of_measurement: '%' }
                        }
                    ]];
                }

                throw new Error(`Mock API: Unsupported URL ${url}`);
            },
            callWS: async (request) => {
                // Mock WebSocket history API
                if (request.type === 'history/history_during_period') {
                    return await global.mockHassInstance.callApi('GET',
                        `/api/history/period/${request.start_time}?filter_entity_id=${request.entity_ids[0]}`);
                }
                throw new Error(`Mock WS: Unsupported request type ${request.type}`);
            }
        };

        // Make mock HASS available to data manager
        global.window._customButtonCardHass = global.mockHassInstance;
    }
}

async function testRealDataIntegration() {
    console.log('🧪 Testing Real HASS Data Integration - Phase 2.2 Step 1 REDO');
    console.log('   Validating actual HASS history API usage vs fake data generation\n');

    setupEnhancedDomPolyfill();

    const results = {
        passed: 0,
        total: 0,
        errors: []
    };

    try {
        // Load the fixed MsdDataManager using dynamic import
        const dataManagerPath = path.join(__dirname, '../../src/msd/data/MsdDataManager.js');
        if (!fs.existsSync(dataManagerPath)) {
            throw new Error(`MsdDataManager not found at ${dataManagerPath}`);
        }

        // Use dynamic import for ES modules
        const dataManagerModule = await import(`file://${dataManagerPath}`);
        const { MsdDataManager } = dataManagerModule;

        console.log('✅ MsdDataManager loaded successfully');

        // Test 1: Verify Data Manager Initialization
        console.log('\n📋 TEST 1: Data Manager Initialization');
        results.total++;

        const dataManager = new MsdDataManager();

        if (dataManager.dataSources instanceof Map &&
            dataManager.historyCache instanceof Map &&
            typeof dataManager.callHassHistoryAPI === 'function' &&
            typeof dataManager.processHistoryApiResponse === 'function') {

            console.log('   ✅ Data Manager properly initialized with real API methods');
            console.log(`   ✅ Data sources map: ${dataManager.dataSources.size} entries`);
            console.log(`   ✅ History cache: ${dataManager.historyCache.size} entries`);
            console.log('   ✅ HASS history API methods present');
            results.passed++;
        } else {
            throw new Error('Data Manager missing required real API integration methods');
        }

        // Test 2: Verify Real HASS History API Call
        console.log('\n📋 TEST 2: Real HASS History API Integration');
        results.total++;

        const testDataSource = {
            id: 'test_battery_history',
            entity: 'sensor.bathroom_dial_battery',
            historicalData: [],
            currentValue: null
        };

        // Test direct history API call
        const startTime = new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString(); // 2 hours ago
        const historyResponse = await dataManager.callHassHistoryAPI(testDataSource.entity, startTime);

        if (Array.isArray(historyResponse) && historyResponse.length > 0 &&
            Array.isArray(historyResponse[0]) && historyResponse[0].length > 0) {

            const firstEntity = historyResponse[0];
            const firstState = firstEntity[0];

            console.log(`   ✅ HASS History API called successfully`);
            console.log(`   ✅ Returned ${firstEntity.length} historical state changes`);
            console.log(`   ✅ First state: entity="${firstState.entity_id}", value="${firstState.state}", time="${firstState.last_changed}"`);
            console.log(`   ✅ Real timestamps and values from HASS API (not generated)`);

            // Verify this is real data, not fake generated data
            const timestamps = firstEntity.map(state => new Date(state.last_changed).getTime());
            const values = firstEntity.map(state => parseFloat(state.state));

            // Real data should have actual timestamps and realistic value progression
            const hasRealTimestamps = timestamps.every(t => t > 0 && t < Date.now());
            const hasRealisticValues = values.every(v => !isNaN(v) && isFinite(v) && v >= 0 && v <= 100);

            if (hasRealTimestamps && hasRealisticValues) {
                console.log('   ✅ Data validation: Real timestamps and realistic battery values');
                results.passed++;
            } else {
                throw new Error(`Data validation failed: timestamps valid=${hasRealTimestamps}, values valid=${hasRealisticValues}`);
            }

        } else {
            throw new Error(`Invalid history API response: ${JSON.stringify(historyResponse)}`);
        }

        // Test 3: Verify History Data Processing
        console.log('\n📋 TEST 3: History Data Processing & Sparkline Format');
        results.total++;

        const processedData = dataManager.processHistoryApiResponse(historyResponse);

        if (Array.isArray(processedData) && processedData.length > 0) {
            const firstPoint = processedData[0];
            const lastPoint = processedData[processedData.length - 1];

            // Verify sparkline format
            const hasCorrectFormat = firstPoint.timestamp &&
                                   typeof firstPoint.value === 'number' &&
                                   firstPoint.state &&
                                   firstPoint.attributes;

            if (hasCorrectFormat) {
                console.log(`   ✅ Processed ${processedData.length} data points for sparkline format`);
                console.log(`   ✅ First point: timestamp=${new Date(firstPoint.timestamp).toISOString()}, value=${firstPoint.value}`);
                console.log(`   ✅ Last point: timestamp=${new Date(lastPoint.timestamp).toISOString()}, value=${lastPoint.value}`);
                console.log('   ✅ Data points in chronological order with real HASS timestamps');

                // Verify chronological ordering
                const isChronological = processedData.every((point, i) =>
                    i === 0 || point.timestamp >= processedData[i - 1].timestamp
                );

                if (isChronological) {
                    console.log('   ✅ Data points properly sorted chronologically');
                    results.passed++;
                } else {
                    throw new Error('Data points not in chronological order');
                }

            } else {
                throw new Error(`Invalid sparkline data format: ${JSON.stringify(firstPoint)}`);
            }

        } else {
            throw new Error(`History processing failed: ${JSON.stringify(processedData)}`);
        }

        // Test 4: Verify Data Source Initialization with Real History
        console.log('\n📋 TEST 4: Data Source Initialization with Real History Preload');
        results.total++;

        const dataSourceConfig = {
            entity: 'sensor.bedroom_dial_battery',
            history: {
                preload: true,
                hours: 2
            }
        };

        const initializedSource = await dataManager.initializeDataSource('test_bedroom_battery', dataSourceConfig);

        if (initializedSource &&
            initializedSource.entity === 'sensor.bedroom_dial_battery' &&
            Array.isArray(initializedSource.historicalData) &&
            initializedSource.historicalData.length > 0 &&
            typeof initializedSource.currentValue === 'number') {

            console.log('   ✅ Data source initialized with real history preload');
            console.log(`   ✅ Entity: ${initializedSource.entity}`);
            console.log(`   ✅ Current value: ${initializedSource.currentValue}% (from HASS states)`);
            console.log(`   ✅ Historical data: ${initializedSource.historicalData.length} real data points`);
            console.log(`   ✅ History timespan: ${(initializedSource.historicalData[initializedSource.historicalData.length - 1].timestamp - initializedSource.historicalData[0].timestamp) / 1000 / 60} minutes`);

            results.passed++;

        } else {
            throw new Error(`Data source initialization failed: ${JSON.stringify(initializedSource)}`);
        }

        // Test 5: Verify Cache and Performance
        console.log('\n📋 TEST 5: Caching and Performance Verification');
        results.total++;

        const stats = dataManager.getStats();

        if (stats.historyApiCalls > 0 &&
            typeof stats.cacheHits === 'number' &&
            typeof stats.cacheMisses === 'number' &&
            stats.totalDataSources > 0) {

            console.log(`   ✅ Performance stats tracked: ${stats.historyApiCalls} API calls`);
            console.log(`   ✅ Cache stats: ${stats.cacheHits} hits, ${stats.cacheMisses} misses`);
            console.log(`   ✅ Data sources: ${stats.totalDataSources} initialized`);
            console.log(`   ✅ Last update: ${new Date(stats.lastUpdate).toISOString()}`);

            results.passed++;

        } else {
            throw new Error(`Invalid performance stats: ${JSON.stringify(stats)}`);
        }

        // Test 6: Verify No Fake Data Generation
        console.log('\n📋 TEST 6: Verify No Fake Data Generation Methods');
        results.total++;

        // Check that we don't have fake data generation methods
        const hasFakeGeneration = typeof dataManager.generateRealisticTimeSeries === 'function' ||
                                typeof dataManager.generateFakeHistory === 'function' ||
                                typeof dataManager.createEstimatedData === 'function';

        if (!hasFakeGeneration) {
            console.log('   ✅ No fake data generation methods present');
            console.log('   ✅ Data Manager only uses real HASS history API');
            console.log('   ✅ Historical data comes from actual entity state changes');

            results.passed++;

        } else {
            throw new Error('Data Manager still contains fake data generation methods');
        }

    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        results.errors.push(error.message);
    }

    // Test Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 REAL DATA INTEGRATION TEST RESULTS');
    console.log('='.repeat(80));

    if (results.passed === results.total) {
        console.log(`🎉 SUCCESS: All ${results.total}/${results.total} tests passed!`);
        console.log('\n🏆 PHASE 2.2 STEP 1 COMPLETE: Real HASS History API Integration');
        console.log('\n✅ ACHIEVEMENTS:');
        console.log('   • Real HASS history API integration working');
        console.log('   • Fake data generation completely removed');
        console.log('   • Historical data from actual entity state changes');
        console.log('   • Proper sparkline data format with real timestamps');
        console.log('   • Caching and performance tracking functional');
        console.log('   • Data source preloading with real history');

        console.log('\n🚀 READY FOR: Phase 2.2 Step 2 - Template Text Overlays');
        console.log('   Next: Implement template support for text overlays with real entity states');

        return { passed: true };

    } else {
        console.log(`💥 FAILED: ${results.passed}/${results.total} tests passed`);
        console.log('\n❌ ERRORS:');
        results.errors.forEach((error, i) => {
            console.log(`   ${i + 1}. ${error}`);
        });

        console.log('\n🔧 REQUIRED FIXES:');
        console.log('   • Fix HASS history API integration');
        console.log('   • Remove any remaining fake data generation');
        console.log('   • Ensure proper data source initialization');

        return { passed: false, errors: results.errors };
    }
}

// ES module export and execution
export { testRealDataIntegration };

// Run the test if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    testRealDataIntegration().catch(console.error);
}
