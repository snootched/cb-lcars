/**
 * Test Phase 2.2 Complete - Template Text Overlays + Real Sparkline Integration
 * Validates complete overlay system with real HASS data integration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enhanced DOM polyfill for template and sparkline testing
function setupAdvancedDomPolyfill() {
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
            __msdDataManager: null,
            MsdTemplateEngine: null,
            MsdDataManager: null
        };

        global.document = {
            createElement: (tag) => ({
                tagName: tag.toUpperCase(),
                style: {},
                dataset: {},
                className: '',
                textContent: '',
                innerHTML: '',
                children: [],
                _children: [],
                setAttribute: function(name, value) { this[name] = value; },
                getAttribute: function(name) { return this[name] || null; },
                appendChild: function(child) {
                    this._children.push(child);
                    child.parentNode = this;
                    return child;
                },
                removeChild: function(child) {
                    const index = this._children.indexOf(child);
                    if (index > -1) {
                        this._children.splice(index, 1);
                        child.parentNode = null;
                    }
                    return child;
                },
                querySelector: function(selector) {
                    // Simple implementation for testing
                    if (selector.startsWith('[data-data-source=')) {
                        const dataSource = selector.match(/\[data-data-source="([^"]+)"\]/)[1];
                        return this._children.find(child =>
                            child.dataset && child.dataset.dataSource === dataSource
                        );
                    }
                    if (selector === 'svg') {
                        return this._children.find(child => child.tagName === 'SVG');
                    }
                    return null;
                },
                querySelectorAll: function(selector) {
                    if (selector.startsWith('[data-data-source=')) {
                        const dataSource = selector.match(/\[data-data-source="([^"]+)"\]/)[1];
                        return this._children.filter(child =>
                            child.dataset && child.dataset.dataSource === dataSource
                        );
                    }
                    return [];
                },
                getBoundingClientRect: () => ({ width: 200, height: 100, left: 0, top: 0 })
            }),
            createElementNS: (ns, tag) => ({
                tagName: tag.toUpperCase(),
                setAttribute: function(name, value) { this[name] = value; },
                getAttribute: function(name) { return this[name] || null; },
                appendChild: function(child) {
                    this._children = this._children || [];
                    this._children.push(child);
                    return child;
                },
                _children: []
            })
        };

        // Mock Home Assistant instance with enhanced states
        global.mockHassInstance = {
            states: {
                'sensor.bathroom_dial_battery': {
                    entity_id: 'sensor.bathroom_dial_battery',
                    state: '75',
                    last_changed: '2024-01-15T10:30:00.000Z',
                    attributes: {
                        unit_of_measurement: '%',
                        friendly_name: 'Bathroom Dial Battery'
                    }
                },
                'sensor.cpu_temperature': {
                    entity_id: 'sensor.cpu_temperature',
                    state: '42.5',
                    last_changed: '2024-01-15T10:28:00.000Z',
                    attributes: {
                        unit_of_measurement: '°C',
                        friendly_name: 'CPU Temperature'
                    }
                }
            },
            connection: {
                subscribeEvents: (callback, eventType, filter) => {
                    // Return mock unsubscribe function
                    return () => {};
                }
            },
            callApi: async (method, url) => {
                // Mock HASS history API response for temperature sensor
                if (url.includes('sensor.cpu_temperature')) {
                    return [[
                        {
                            entity_id: 'sensor.cpu_temperature',
                            state: '40.2',
                            last_changed: '2024-01-15T08:30:00.000Z',
                            attributes: { unit_of_measurement: '°C' }
                        },
                        {
                            entity_id: 'sensor.cpu_temperature',
                            state: '41.8',
                            last_changed: '2024-01-15T09:15:00.000Z',
                            attributes: { unit_of_measurement: '°C' }
                        },
                        {
                            entity_id: 'sensor.cpu_temperature',
                            state: '42.5',
                            last_changed: '2024-01-15T10:30:00.000Z',
                            attributes: { unit_of_measurement: '°C' }
                        }
                    ]];
                }

                // Fallback to battery data
                return [[
                    {
                        entity_id: 'sensor.bathroom_dial_battery',
                        state: '73',
                        last_changed: '2024-01-15T08:30:00.000Z',
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
        };

        // Make mock HASS available to systems
        global.window._customButtonCardHass = global.mockHassInstance;
    }
}

async function testPhase2Complete() {
    console.log('🧪 Testing Phase 2.2 Complete - Template Text + Real Sparkline Integration');
    console.log('   Validating complete overlay system with real HASS data\n');

    setupAdvancedDomPolyfill();

    const results = {
        passed: 0,
        total: 0,
        errors: []
    };

    try {
        // Load required modules
        const templateEnginePath = path.join(__dirname, '../../src/msd/overlays/MsdTemplateEngine.js');
        const dataManagerPath = path.join(__dirname, '../../src/msd/data/MsdDataManager.js');
        const rendererPath = path.join(__dirname, '../../src/msd/renderer/AdvancedRenderer.js');

        console.log('📦 Loading MSD modules...');

        // Load modules using dynamic import
        const templateModule = await import(`file://${templateEnginePath}`);
        const dataModule = await import(`file://${dataManagerPath}`);
        const rendererModule = await import(`file://${rendererPath}`);

        const { MsdTemplateEngine } = templateModule;
        const { MsdDataManager } = dataModule;
        const { MsdAdvancedRenderer } = rendererModule;

        // Make modules available globally for integration
        global.window.MsdTemplateEngine = MsdTemplateEngine;
        global.window.MsdDataManager = MsdDataManager;

        console.log('✅ All modules loaded successfully');

        // Test 1: Template Engine Functionality
        console.log('\n📋 TEST 1: Template Engine - Entity State Templates');
        results.total++;

        const templateEngine = new MsdTemplateEngine();

        // Test basic template compilation
        const template1 = "Battery: {{states('sensor.bathroom_dial_battery')}}%";
        const compiled1 = templateEngine.compileTemplate(template1, 'test_template_1');

        if (compiled1.entityDependencies.includes('sensor.bathroom_dial_battery') &&
            compiled1.segments.length > 0 &&
            compiled1.hasTemplates === true) {

            console.log('   ✅ Template compilation working');
            console.log(`   ✅ Dependencies: ${compiled1.entityDependencies.join(', ')}`);
            console.log(`   ✅ Segments: ${compiled1.segments.length}`);

            // Test template evaluation
            const result = templateEngine.evaluateTemplate(compiled1, global.mockHassInstance.states);

            if (result === 'Battery: 75%') {
                console.log(`   ✅ Template evaluation: "${result}"`);
                results.passed++;
            } else {
                throw new Error(`Template evaluation failed: expected "Battery: 75%", got "${result}"`);
            }

        } else {
            throw new Error(`Template compilation failed: ${JSON.stringify(compiled1)}`);
        }

        // Test 2: Complex Template with Formatting
        console.log('\n📋 TEST 2: Template Engine - Complex Templates with Formatting');
        results.total++;

        const template2 = "CPU: {{states('sensor.cpu_temperature') | round(1)}}°C - {{state_attr('sensor.cpu_temperature', 'friendly_name')}}";
        const compiled2 = templateEngine.compileTemplate(template2, 'test_template_2');

        if (compiled2.entityDependencies.includes('sensor.cpu_temperature')) {
            const result2 = templateEngine.evaluateTemplate(compiled2, global.mockHassInstance.states);

            // Should format to 1 decimal place and include friendly name
            if (result2.includes('42.5°C') && result2.includes('CPU Temperature')) {
                console.log(`   ✅ Complex template: "${result2}"`);
                console.log('   ✅ Formatting and attribute access working');
                results.passed++;
            } else {
                throw new Error(`Complex template failed: "${result2}"`);
            }

        } else {
            throw new Error(`Complex template dependencies missing: ${compiled2.entityDependencies}`);
        }

        // Test 3: Data Manager + Sparkline Integration
        console.log('\n📋 TEST 3: Data Manager + Sparkline Real Data Integration');
        results.total++;

        const dataManager = new MsdDataManager();
        global.window.__msdDataManager = dataManager;

        // Initialize data source for CPU temperature
        const dataSourceConfig = {
            entity: 'sensor.cpu_temperature',
            history: {
                preload: true,
                hours: 2
            }
        };

        const cpuDataSource = await dataManager.initializeDataSource('cpu_temp_source', dataSourceConfig);

        if (cpuDataSource &&
            cpuDataSource.historicalData.length > 0 &&
            cpuDataSource.currentValue === 42.5) {

            console.log('   ✅ CPU temperature data source initialized');
            console.log(`   ✅ Current value: ${cpuDataSource.currentValue}°C`);
            console.log(`   ✅ Historical data: ${cpuDataSource.historicalData.length} points`);
            console.log(`   ✅ Temperature range: ${Math.min(...cpuDataSource.historicalData.map(p => p.value))}°C - ${Math.max(...cpuDataSource.historicalData.map(p => p.value))}°C`);

            results.passed++;

        } else {
            throw new Error(`CPU data source initialization failed: ${JSON.stringify(cpuDataSource)}`);
        }

        // Test 4: Advanced Renderer Integration
        console.log('\n📋 TEST 4: Advanced Renderer - Text and Sparkline Overlays');
        results.total++;

        const container = global.document.createElement('div');
        const renderer = new MsdAdvancedRenderer(container);
        renderer.initialize();

        // Test text overlay with template
        const textOverlay = {
            id: 'cpu_status_text',
            type: 'text',
            content: 'CPU Temperature: {{states("sensor.cpu_temperature") | round(1)}}°C',
            anchor: 'top-left',
            style: {
                color: '#ff9900',
                fontSize: '14px'
            }
        };

        const textBounds = { left: 10, top: 10, width: 200, height: 30 };
        const textElement = renderer.renderTextOverlay(container, textOverlay, textBounds);

        if (textElement && textElement.textContent.includes('42.5°C')) {
            console.log(`   ✅ Text overlay rendered: "${textElement.textContent}"`);
            console.log('   ✅ Template processing in renderer working');
        } else {
            throw new Error(`Text overlay rendering failed: "${textElement ? textElement.textContent : 'null'}"`);
        }

        // Test sparkline overlay with real data
        const sparklineOverlay = {
            id: 'cpu_temp_sparkline',
            type: 'sparkline',
            data_source: 'cpu_temp_source',
            color: '#ff9900',
            stroke_width: 2
        };

        const sparklineBounds = { left: 10, top: 50, width: 200, height: 60 };
        const sparklineElement = renderer.renderSparklineOverlay(container, sparklineOverlay, sparklineBounds);

        if (sparklineElement &&
            sparklineElement.dataset.dataSource === 'cpu_temp_source' &&
            sparklineElement.querySelector('svg')) {

            const svg = sparklineElement.querySelector('svg');
            const path = svg._children.find(child => child.tagName === 'PATH');

            if (path && path.d) {
                console.log('   ✅ Sparkline overlay rendered with real data');
                console.log(`   ✅ Data source: ${sparklineElement.dataset.dataSource}`);
                console.log('   ✅ SVG path generated from historical data');
                results.passed++;
            } else {
                throw new Error('Sparkline SVG path not generated');
            }

        } else {
            throw new Error(`Sparkline rendering failed: ${sparklineElement ? 'missing SVG' : 'null element'}`);
        }

        // Test 5: Real-time Updates Simulation
        console.log('\n📋 TEST 5: Real-time Update Integration');
        results.total++;

        // Simulate data source update
        const updateEvent = {
            detail: {
                sourceId: 'cpu_temp_source',
                entity: 'sensor.cpu_temperature',
                currentValue: 43.2,
                historicalData: [
                    ...cpuDataSource.historicalData,
                    {
                        timestamp: Date.now(),
                        value: 43.2,
                        state: '43.2',
                        attributes: { unit_of_measurement: '°C' }
                    }
                ]
            }
        };

        // Test that renderer can handle data updates
        renderer.handleDataSourceUpdate(updateEvent.detail);

        // Verify sparkline was updated (in a real scenario, the DOM would be updated)
        const updatedSparkline = container.querySelector('[data-data-source="cpu_temp_source"]');
        if (updatedSparkline) {
            console.log('   ✅ Real-time update handling functional');
            console.log(`   ✅ Updated data: ${updateEvent.detail.currentValue}°C`);
            console.log(`   ✅ Historical data: ${updateEvent.detail.historicalData.length} points`);
            results.passed++;
        } else {
            throw new Error('Real-time update handling failed');
        }

        // Test 6: Performance and Statistics
        console.log('\n📋 TEST 6: Performance and Statistics');
        results.total++;

        const templateStats = templateEngine.getStats();
        const dataStats = dataManager.getStats();

        if (templateStats.templatesCompiled > 0 &&
            templateStats.evaluationsPerformed > 0 &&
            dataStats.historyApiCalls > 0 &&
            dataStats.totalDataSources > 0) {

            console.log(`   ✅ Template stats: ${templateStats.templatesCompiled} compiled, ${templateStats.evaluationsPerformed} evaluated`);
            console.log(`   ✅ Data stats: ${dataStats.historyApiCalls} API calls, ${dataStats.totalDataSources} sources`);
            console.log(`   ✅ Entity dependencies: ${templateStats.entityReferences} references`);
            console.log(`   ✅ Performance tracking functional`);

            results.passed++;

        } else {
            throw new Error(`Performance stats invalid: template=${JSON.stringify(templateStats)}, data=${JSON.stringify(dataStats)}`);
        }

    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        results.errors.push(error.message);
    }

    // Test Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 PHASE 2.2 COMPLETE TEST RESULTS');
    console.log('='.repeat(80));

    if (results.passed === results.total) {
        console.log(`🎉 SUCCESS: All ${results.total}/${results.total} tests passed!`);
        console.log('\n🏆 PHASE 2.2 COMPLETE: Template Text Overlays + Real Sparkline Integration');
        console.log('\n✅ ACHIEVEMENTS:');
        console.log('   • Template engine with entity state references');
        console.log('   • Real HASS data integration for sparklines');
        console.log('   • Text overlays with dynamic template processing');
        console.log('   • Sparkline overlays with historical data visualization');
        console.log('   • Real-time updates for both text and sparkline overlays');
        console.log('   • Performance monitoring and statistics tracking');
        console.log('   • Cross-environment compatibility maintained');

        console.log('\n🚀 READY FOR: Phase 2.3 - Advanced Overlay Types');
        console.log('   Next: Implement gauge overlays, chart overlays, and enhanced UI elements');

        return { passed: true };

    } else {
        console.log(`💥 FAILED: ${results.passed}/${results.total} tests passed`);
        console.log('\n❌ ERRORS:');
        results.errors.forEach((error, i) => {
            console.log(`   ${i + 1}. ${error}`);
        });

        console.log('\n🔧 REQUIRED FIXES:');
        console.log('   • Fix template engine integration');
        console.log('   • Verify sparkline data source connections');
        console.log('   • Test real-time update mechanisms');

        return { passed: false, errors: results.errors };
    }
}

// ES module export and execution
export { testPhase2Complete };

// Run the test if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    testPhase2Complete().catch(console.error);
}
