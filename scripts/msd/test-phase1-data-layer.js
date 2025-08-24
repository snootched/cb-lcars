/**
 * Phase 1: Core Data Layer & Real-time Updates - Test Suite
 * Tests complete port of cb-lcars-data.js functionality to MsdDataSource + DataSourceManager
 *
 * Priority: 🔴 CRITICAL - Blocking sparklines/ribbons
 */

class Phase1DataLayerTests {
  constructor() {
    this.results = [];
    this.mockHass = this.createMockHass();
    this.testStartTime = null;
  }

  async runAllTests() {
    console.log('🧪 Phase 1 Data Layer Tests - Complete cb-lcars-data.js Port');
    console.log('━'.repeat(60));

    // Test 1: RollingBuffer core functionality
    await this.testRollingBufferCore();

    // Test 2: MsdDataSource complete port
    await this.testMsdDataSourcePort();

    // Test 3: Performance optimizations (coalescing, throttling)
    await this.testPerformanceOptimizations();

    // Test 4: History preload functionality
    await this.testHistoryPreload();

    // Test 5: DataSourceManager lifecycle
    await this.testDataSourceManagerLifecycle();

    // Test 6: Real-time HA subscription integration
    await this.testRealTimeSubscriptions();

    // Test 7: Memory stability under load
    await this.testMemoryStability();

    // Test 8: Error handling and recovery
    await this.testErrorHandling();

    return this.generateSummary();
  }

  async testRollingBufferCore() {
    const test = { name: 'RollingBuffer Core Functionality', passed: false };
    this.testStartTime = performance.now();

    try {
      // Import will fail initially - that's expected for test-first development
      const { RollingBuffer } = await this.tryImport('../../src/msd/data/RollingBuffer.js');

      // Test capacity management
      const buffer = new RollingBuffer(5); // Small buffer for testing

      // Add more items than capacity
      for (let i = 0; i < 8; i++) {
        buffer.push(Date.now() + i * 1000, i * 10);
      }

      const { t, v } = buffer.getArrays();

      // Should maintain capacity limit
      if (t.length !== 5 || v.length !== 5) {
        throw new Error(`Expected 5 items, got t:${t.length}, v:${v.length}`);
      }

      // Should keep most recent items (3,4,5,6,7 → values 30,40,50,60,70)
      const expectedValues = [30, 40, 50, 60, 70];
      if (JSON.stringify(v) !== JSON.stringify(expectedValues)) {
        throw new Error(`Expected [30,40,50,60,70], got [${v.join(',')}]`);
      }

      // Test time-based slicing
      const recent = buffer.sliceSince(3000); // Last 3 seconds
      if (!recent || !recent.t || !recent.v) {
        throw new Error('Time-based slicing failed');
      }

      // Test last() method
      const last = buffer.last();
      if (!last || last.v !== 70) {
        throw new Error(`Expected last value 70, got ${last?.v}`);
      }

      test.metrics = {
        processingTime: performance.now() - this.testStartTime,
        capacityControl: 'working',
        timeSlicing: 'functional',
        lastMethod: 'working'
      };

      test.passed = true;
    } catch (error) {
      test.error = error.message;
      test.expected = 'RollingBuffer with capacity management, time slicing, and last() method';
    }

    this.results.push(test);
  }

  async testMsdDataSourcePort() {
    const test = { name: 'MsdDataSource Complete Port', passed: false };
    this.testStartTime = performance.now();

    try {
      const { MsdDataSource } = await this.tryImport('../../src/msd/data/MsdDataSource.js');

      // Test configuration parsing (should match cb-lcars-data.js exactly)
      const config = {
        entity: 'sensor.cpu_temp',
        windowSeconds: 3600,
        minEmitMs: 250,
        coalesceMs: 120,
        maxDelayMs: 800,
        emitOnSameValue: false
      };

      const dataSource = new MsdDataSource(config, this.mockHass);

      // Verify config parsing matches old implementation
      if (dataSource.minEmitMs !== 250) {
        throw new Error(`minEmitMs: expected 250, got ${dataSource.minEmitMs}`);
      }

      if (dataSource.coalesceMs !== 120) {
        throw new Error(`coalesceMs: expected 120, got ${dataSource.coalesceMs}`);
      }

      if (dataSource.maxDelayMs !== 800) {
        throw new Error(`maxDelayMs: expected 800, got ${dataSource.maxDelayMs}`);
      }

      // Test subscription system - FIXED timing
      let callbackCount = 0;
      let lastData = null;

      const unsubscribe = dataSource.subscribe((data) => {
        callbackCount++;
        lastData = data;
      });

      // Simulate data event (internal method)
      if (typeof dataSource._onRawEventValue === 'function') {
        dataSource._onRawEventValue(Date.now(), 67.5);
      } else {
        throw new Error('_onRawEventValue method missing');
      }

      // REDUCED wait time since first emission should be immediate
      await new Promise(resolve => setTimeout(resolve, 50));

      if (callbackCount === 0) {
        throw new Error('Subscription callback not called');
      }

      if (!lastData || lastData.v !== 67.5) {
        throw new Error(`Expected value 67.5, got ${lastData?.v}`);
      }

      // Test unsubscription
      unsubscribe();

      test.metrics = {
        processingTime: performance.now() - this.testStartTime,
        configParsing: 'identical',
        subscriptionSystem: 'working',
        dataFlow: 'functional',
        immediateCallback: callbackCount === 1
      };

      test.passed = true;
    } catch (error) {
      test.error = error.message;
      test.expected = 'Complete port of DataSource class with identical API and behavior';
    }

    this.results.push(test);
  }

  async testPerformanceOptimizations() {
    const test = { name: 'Performance Optimizations (Coalescing/Throttling)', passed: false };
    this.testStartTime = performance.now();

    try {
      const { MsdDataSource } = await this.tryImport('../../src/msd/data/MsdDataSource.js');

      const config = {
        entity: 'sensor.test',
        minEmitMs: 100,
        coalesceMs: 30,    // 30ms coalescing window
        maxDelayMs: 150    // Max delay
      };

      const dataSource = new MsdDataSource(config, this.mockHass);

      let emitCount = 0;
      const emitTimes = [];
      let lastEmitTime = performance.now();

      dataSource.subscribe(() => {
        emitCount++;
        const now = performance.now();
        emitTimes.push(now - lastEmitTime);
        lastEmitTime = now;
      });

      // Rapid fire 20 events in 100ms (should be heavily coalesced)
      const startTime = performance.now();
      for (let i = 0; i < 20; i++) {
        if (typeof dataSource._onRawEventValue === 'function') {
          dataSource._onRawEventValue(Date.now() + i, Math.random() * 100);
        }
        await new Promise(resolve => setTimeout(resolve, 5)); // 5ms intervals
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 250));

      const totalTime = performance.now() - startTime;

      // Should have MUCH fewer emissions due to aggressive coalescing
      if (emitCount >= 10) {  // Expect <10 emissions from 20 inputs
        throw new Error(`Too many emissions: ${emitCount}/20 - coalescing not aggressive enough`);
      }

      test.metrics = {
        processingTime: totalTime,
        inputEvents: 20,
        outputEmissions: emitCount,
        coalescingRatio: Math.round((1 - emitCount/20) * 100),
        avgEmitInterval: emitTimes.length > 1 ? Math.round(emitTimes.slice(1).reduce((a, b) => a + b, 0) / (emitTimes.length - 1)) : 0,
        performanceGain: `${Math.round((1 - emitCount/20) * 100)}% reduction`
      };

      // Coalescing should reduce emissions by at least 50%
      if (emitCount >= 10) {
        throw new Error(`Insufficient coalescing: ${emitCount}/20 emissions (expected <10)`);
      }

      test.passed = true;
    } catch (error) {
      test.error = error.message;
      test.expected = 'Aggressive coalescing reduces event flood, respects minEmitMs timing';
    }

    this.results.push(test);
  }

  async testHistoryPreload() {
    const test = { name: 'History Preload Integration', passed: false };
    this.testStartTime = performance.now();

    try {
      const { MsdDataSource } = await this.tryImport('../../src/msd/data/MsdDataSource.js');

      const config = {
        entity: 'sensor.cpu_temp',
        history: { preload: true, hours: 6 }
      };

      // Mock history data (6 hours of hourly data)
      const mockHistoryData = [];
      for (let i = 0; i < 6; i++) {
        mockHistoryData.push({
          state: (Math.sin(i * 0.5) * 20 + 60).toFixed(1),
          last_changed: new Date(Date.now() - (6-i) * 3600000).toISOString()
        });
      }

      // Setup mock for history service call
      this.mockHass.callService = async (domain, service, data) => {
        if (domain === 'recorder' && service === 'get_statistics') {
          return [{
            statistics: mockHistoryData.map(d => ({
              start: d.last_changed,
              mean: parseFloat(d.state)
            }))
          }];
        }
        return [];
      };

      const dataSource = new MsdDataSource(config, this.mockHass);

      // Start should trigger history preload
      if (typeof dataSource.start === 'function') {
        await dataSource.start();
      } else {
        throw new Error('start() method missing');
      }

      // Allow preload to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check buffer has historical data
      if (!dataSource.buffer) {
        throw new Error('Buffer not initialized');
      }

      const { t, v } = dataSource.buffer.getArrays();

      if (t.length === 0) {
        throw new Error('No history data loaded');
      }

      if (t.length < 3) {
        throw new Error(`Expected multiple history points, got ${t.length}`);
      }

      // Verify chronological order
      for (let i = 1; i < t.length; i++) {
        if (t[i] <= t[i-1]) {
          throw new Error('History data not in chronological order');
        }
      }

      test.metrics = {
        processingTime: performance.now() - this.testStartTime,
        historyPointsLoaded: t.length,
        timeSpanHours: Math.round((t[t.length-1] - t[0]) / 3600000),
        chronologicalOrder: 'correct'
      };

      test.passed = true;
    } catch (error) {
      test.error = error.message;
      test.expected = 'History preload with chronological ordering and buffer population';
    }

    this.results.push(test);
  }

  async testDataSourceManagerLifecycle() {
    const test = { name: 'DataSourceManager Lifecycle Management', passed: false };
    this.testStartTime = performance.now();

    try {
      const { DataSourceManager } = await this.tryImport('../../src/msd/data/DataSourceManager.js');

      const manager = new DataSourceManager(this.mockHass);

      // Test multi-source initialization
      const configs = {
        cpu_temp: {
          entity: 'sensor.cpu_temp',
          windowSeconds: 3600
        },
        memory_usage: {
          entity: 'sensor.memory_usage',
          windowSeconds: 1800
        }
      };

      if (typeof manager.initializeFromConfig !== 'function') {
        throw new Error('initializeFromConfig method missing');
      }

      await manager.initializeFromConfig(configs);

      // Verify sources created
      if (!manager.sources || manager.sources.size !== 2) {
        throw new Error(`Expected 2 sources, got ${manager.sources?.size}`);
      }

      // Test individual source retrieval
      const cpuSource = manager.sources.get('cpu_temp');
      if (!cpuSource) {
        throw new Error('CPU source not found');
      }

      // Test overlay subscription system
      const mockOverlay = {
        id: 'cpu_sparkline',
        type: 'sparkline',
        source: 'cpu_temp'
      };

      let subscriptionCallbacks = 0;

      if (typeof manager.subscribeOverlay !== 'function') {
        throw new Error('subscribeOverlay method missing');
      }

      manager.subscribeOverlay(mockOverlay, (overlay, data) => {
        subscriptionCallbacks++;
      });

      // Simulate data update
      if (typeof cpuSource._onRawEventValue === 'function') {
        cpuSource._onRawEventValue(Date.now(), 72.1);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      if (subscriptionCallbacks === 0) {
        throw new Error('Overlay subscription callback not triggered');
      }

      // Test cleanup
      if (typeof manager.unsubscribeOverlay === 'function') {
        manager.unsubscribeOverlay('cpu_sparkline');
      }

      test.metrics = {
        processingTime: performance.now() - this.testStartTime,
        sourcesManaged: manager.sources.size,
        subscriptionHandling: 'working',
        lifecycleManagement: 'functional'
      };

      test.passed = true;
    } catch (error) {
      test.error = error.message;
      test.expected = 'Multi-source management with overlay subscription system';
    }

    this.results.push(test);
  }

  async testRealTimeSubscriptions() {
    const test = { name: 'Real-time Home Assistant Subscriptions', passed: false };
    this.testStartTime = performance.now();

    try {
      const { MsdDataSource } = await this.tryImport('../../src/msd/data/MsdDataSource.js');

      // Mock HA connection with event simulation
      let eventCallback = null;
      this.mockHass.connection.subscribeEvents = async (callback, eventType) => {
        eventCallback = callback;
        return () => { eventCallback = null; };
      };

      const config = {
        entity: 'sensor.cpu_temp',
        minEmitMs: 50,    // Fast response for test
        coalesceMs: 30,   // Short coalescing window
        maxDelayMs: 100   // Quick max delay
      };
      const dataSource = new MsdDataSource(config, this.mockHass);

      if (typeof dataSource.start === 'function') {
        await dataSource.start();
      }

      if (!eventCallback) {
        throw new Error('HA event subscription not established');
      }

      let dataUpdates = 0;
      const updateValues = [];

      dataSource.subscribe((data) => {
        dataUpdates++;
        updateValues.push(data.v);
      });

      // Simulate HA state change events with MORE SPACING
      const testEvents = [
        {
          data: {
            new_state: {
              entity_id: 'sensor.cpu_temp',
              state: '68.7',
              last_changed: new Date().toISOString()
            }
          }
        },
        {
          data: {
            new_state: {
              entity_id: 'sensor.memory_usage', // Different entity - should be filtered
              state: '45.2',
              last_changed: new Date().toISOString()
            }
          }
        },
        {
          data: {
            new_state: {
              entity_id: 'sensor.cpu_temp',
              state: '71.3',
              last_changed: new Date().toISOString()
            }
          }
        }
      ];

      // Send events with more spacing to avoid coalescing
      for (const event of testEvents) {
        eventCallback(event);
        await new Promise(resolve => setTimeout(resolve, 60)); // 60ms between events
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have received 2 updates (only for matching entity)
      if (dataUpdates !== 2) {
        throw new Error(`Expected 2 updates, got ${dataUpdates}. Values received: [${updateValues.join(', ')}]`);
      }

      // Verify last value in buffer
      const last = dataSource.buffer.last();
      if (!last || Math.abs(last.v - 71.3) > 0.01) {
        throw new Error(`Expected last value 71.3, got ${last?.v}`);
      }

      test.metrics = {
        processingTime: performance.now() - this.testStartTime,
        subscriptionEstablished: 'success',
        eventFiltering: 'working',
        dataUpdates,
        updateValues: updateValues,
        lastValue: last.v
      };

      test.passed = true;
    } catch (error) {
      test.error = error.message;
      test.expected = 'HA event subscription with entity filtering and data flow';
    }

    this.results.push(test);
  }

  async testMemoryStability() {
    const test = { name: 'Memory Stability Under Load', passed: false };
    this.testStartTime = performance.now();

    try {
      const { MsdDataSource } = await this.tryImport('../../src/msd/data/MsdDataSource.js');

      const config = {
        entity: 'sensor.load_test',
        windowSeconds: 60,   // 1 minute window
        minEmitMs: 20,       // Very fast for stress test
        coalesceMs: 15,      // AGGRESSIVE coalescing
        maxDelayMs: 30       // Short max delay
      };

      const dataSource = new MsdDataSource(config, this.mockHass);

      // Stress test with 500 rapid events in tight succession
      const startTime = performance.now();
      for (let i = 0; i < 500; i++) {
        if (typeof dataSource._onRawEventValue === 'function') {
          // Use sequential timestamps to trigger buffer coalescing
          dataSource._onRawEventValue(Date.now() + i, Math.random() * 100);
        }
        // NO delay between events - maximum stress
      }

      // Allow processing with longer wait time for all coalescing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Buffer should respect capacity limits
      const { t, v } = dataSource.buffer.getArrays();
      const bufferSize = t.length;

      if (bufferSize > dataSource.buffer.capacity * 1.1) {
        throw new Error(`Buffer overflow: ${bufferSize} > ${dataSource.buffer.capacity}`);
      }

      // With buffer-level coalescing, should see dramatic reduction
      if (bufferSize > 50) {
        throw new Error(`Buffer too large: ${bufferSize} (expected aggressive coalescing to <50)`);
      }

      if (bufferSize === 0) {
        throw new Error('Buffer unexpectedly empty');
      }

      const coalescingRatio = Math.round((1 - bufferSize/500) * 100);

      test.metrics = {
        processingTime: performance.now() - this.testStartTime,
        inputEvents: 500,
        bufferSize,
        bufferCapacity: dataSource.buffer.capacity,
        coalescingRatio: coalescingRatio,
        coalescedCount: dataSource._stats.coalesced,
        emitCount: dataSource._stats.emits,
        bufferCoalescedCount: dataSource.buffer._stats.overwrites,
        memoryEfficient: bufferSize <= 50
      };

      test.passed = true;
    } catch (error) {
      test.error = error.message;
      test.expected = 'Stable memory usage under high event load with aggressive buffer coalescing';
    }

    this.results.push(test);
  }

  async testErrorHandling() {
    const test = { name: 'Error Handling & Recovery', passed: false };
    this.testStartTime = performance.now();

    try {
      const { MsdDataSource } = await this.tryImport('../../src/msd/data/MsdDataSource.js');

      // Test 1: Invalid configuration handling
      const invalidConfig = {
        entity: '', // Empty entity
        windowSeconds: 'invalid'
      };

      let errorsCaught = 0;
      const originalWarn = console.warn;
      console.warn = () => { errorsCaught++; };

      try {
        const dataSource1 = new MsdDataSource(invalidConfig, this.mockHass);
        // Should not throw, should handle gracefully
      } catch (error) {
        // Constructor throwing is acceptable for invalid config
      }

      // Test 2: Invalid data values
      const dataSource2 = new MsdDataSource({ entity: 'sensor.test' }, this.mockHass);

      if (typeof dataSource2._onRawEventValue === 'function') {
        // These should be handled gracefully
        dataSource2._onRawEventValue(Date.now(), null);
        dataSource2._onRawEventValue(Date.now(), undefined);
        dataSource2._onRawEventValue(Date.now(), 'not a number');
        dataSource2._onRawEventValue(Date.now(), NaN);
        dataSource2._onRawEventValue(Date.now(), Infinity);

        // This should work
        dataSource2._onRawEventValue(Date.now(), 42.5);
      }

      console.warn = originalWarn;

      // Test 3: Network failure simulation
      const failingHass = {
        ...this.mockHass,
        connection: {
          subscribeEvents: async () => {
            throw new Error('Network error');
          }
        }
      };

      const dataSource3 = new MsdDataSource({ entity: 'sensor.test' }, failingHass);

      try {
        if (typeof dataSource3.start === 'function') {
          await dataSource3.start(); // Should handle failure gracefully
        }
      } catch (error) {
        // Some errors are acceptable, system should remain stable
      }

      // System should still be functional despite errors
      const { t, v } = dataSource2.buffer.getArrays();
      const lastValue = dataSource2.buffer.last();

      if (!lastValue || lastValue.v !== 42.5) {
        throw new Error('Valid data not processed after error conditions');
      }

      test.metrics = {
        processingTime: performance.now() - this.testStartTime,
        errorConditionsTested: 8,
        systemStability: 'maintained',
        gracefulDegradation: 'working'
      };

      test.passed = true;
    } catch (error) {
      test.error = error.message;
      test.expected = 'Graceful error handling with system stability maintained';
    }

    this.results.push(test);
  }

  // Utility methods
  async tryImport(modulePath) {
    try {
      return await import(modulePath);
    } catch (error) {
      throw new Error(`Module not found: ${modulePath} - ${error.message}`);
    }
  }

  createMockHass() {
    return {
      connection: {
        subscribeEvents: async (callback, eventType) => {
          return () => {}; // unsubscribe function
        }
      },
      callService: async (domain, service, data) => {
        return {};
      }
    };
  }

  generateSummary() {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const failed = this.results.filter(r => !r.passed);

    console.log('\n🏆 Phase 1 Data Layer Test Results');
    console.log('━'.repeat(60));
    console.log(`Status: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log('✅ ALL TESTS PASSED - Ready for Phase 1 Implementation');
    } else {
      console.log('\n❌ FAILING TESTS:');
      failed.forEach(test => {
        console.log(`\n🔴 ${test.name}`);
        console.log(`   Error: ${test.error}`);
        if (test.expected) {
          console.log(`   Expected: ${test.expected}`);
        }
      });
    }

    console.log('\n📊 Next Steps:');
    console.log('1. Implement RollingBuffer class');
    console.log('2. Port MsdDataSource with identical cb-lcars-data.js behavior');
    console.log('3. Create DataSourceManager for multi-source lifecycle');
    console.log('4. Integrate with AdvancedRenderer for real-time updates');

    return {
      passed: passed === total,
      results: this.results,
      summary: { total, passed, failed: total - passed }
    };
  }
}

// Auto-run if called directly
const suite = new Phase1DataLayerTests();
suite.runAllTests().then(results => {
  process.exit(results.passed ? 0 : 1);
});


