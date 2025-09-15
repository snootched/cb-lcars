/**
 * Test suite for EntityRuntime to DataSource migration
 * Validates that DataSourceManager can replace EntityRuntime functionality
 */

const path = require('path');
const fs = require('fs');

// Test configuration
const testConfig = {
  msd: {
    data_sources: {
      cpu_temp: {
        entity: "sensor.cpu_temperature",
        window_seconds: 3600,
        minEmitMs: 250,
        coalesceMs: 120,
        maxDelayMs: 800,
        emitOnSameValue: false,
        history: {
          preload: true,
          hours: 6
        }
      },
      memory_usage: {
        entity: "sensor.memory_use_percent",
        attribute: "value", 
        window_seconds: 1800,
        history: {
          preload: true,
          hours: 2
        }
      },
      battery_level: {
        entity: "sensor.phone_battery",
        window_seconds: 7200,
        minEmitMs: 1000,
        emitOnSameValue: true
      }
    },
    rules: [
      {
        id: "cpu_hot",
        priority: 20,
        when: {
          all: [
            {
              entity: "sensor.cpu_temperature",
              above: 75
            }
          ]
        },
        apply: {
          overlays: [
            {
              id: "cpu_sparkline",
              style: { color: "var(--lcars-red)", width: 4 }
            }
          ]
        }
      }
    ]
  }
};

// Mock HASS for testing
const mockHass = {
  states: {
    "sensor.cpu_temperature": {
      state: "72.5",
      attributes: { unit_of_measurement: "°C", friendly_name: "CPU Temperature" }
    },
    "sensor.memory_use_percent": {
      state: "68.2", 
      attributes: { value: 68.2, unit_of_measurement: "%" }
    },
    "sensor.phone_battery": {
      state: "85",
      attributes: { unit_of_measurement: "%" }
    }
  },
  connection: {
    subscribeMessage: (callback, message) => {
      // Mock subscription - return unsubscribe function
      return () => {};
    }
  }
};

function setupDomPolyfill() {
  if (typeof window === 'undefined') {
    global.window = {};
    global.document = {
      createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        style: {},
        setAttribute: function(name, value) { this[name] = value; },
        getAttribute: function(name) { return this[name]; },
        appendChild: function(child) { 
          this._children = this._children || [];
          this._children.push(child);
          child.parentNode = this;
        },
        querySelector: function(selector) {
          return this._children?.find(child => 
            selector.includes(child.tagName?.toLowerCase()) || 
            selector.includes(child.className) ||
            selector.includes(child.id)
          ) || null;
        }
      })
    };
  }
}

async function runMigrationTests() {
  setupDomPolyfill();
  
  console.log('🧪 Testing EntityRuntime to DataSource Migration');
  console.log('=' .repeat(60));
  
  let testResults = {
    passed: 0,
    failed: 0,
    errors: []
  };
  
  // Test 1: Verify DataSource system exists and is functional
  await runTest('DataSource System Availability', async () => {
    try {
      const MsdDataSource = require('../src/msd/data/MsdDataSource.js');
      const DataSourceManager = require('../src/msd/data/DataSourceManager.js');
      
      if (!MsdDataSource || !DataSourceManager) {
        throw new Error('DataSource classes not available');
      }
      
      console.log('  ✅ MsdDataSource and DataSourceManager classes available');
      return { passed: true };
    } catch (error) {
      return { passed: false, error: `DataSource system not available: ${error.message}` };
    }
  }, testResults);
  
  // Test 2: Create DataSourceManager and verify entity access methods
  await runTest('DataSourceManager Entity Access', async () => {
    try {
      const { DataSourceManager } = require('../src/msd/data/DataSourceManager.js');
      const manager = new DataSourceManager(mockHass);
      
      // Create data sources from config
      for (const [name, config] of Object.entries(testConfig.msd.data_sources)) {
        await manager.createDataSource(name, config);
      }
      
      // Test entity access methods
      const entities = manager.listIds();
      const cpuEntity = manager.getEntity('sensor.cpu_temperature');
      
      if (!entities.includes('sensor.cpu_temperature')) {
        throw new Error('Entity not found in listIds()');
      }
      
      if (!cpuEntity || !cpuEntity.state) {
        throw new Error('getEntity() not returning proper entity data');
      }
      
      console.log(`  ✅ DataSourceManager created with ${entities.length} entities`);
      console.log(`  ✅ Entity access methods working: getEntity(), listIds()`);
      
      return { passed: true, manager };
    } catch (error) {
      return { passed: false, error: `DataSourceManager entity access failed: ${error.message}` };
    }
  }, testResults);
  
  // Test 3: Verify Rules Engine integration capability
  await runTest('Rules Engine Integration', async () => {
    try {
      const { DataSourceManager } = require('../src/msd/data/DataSourceManager.js');
      const manager = new DataSourceManager(mockHass);
      
      // Create data source
      await manager.createDataSource('cpu_temp', testConfig.msd.data_sources.cpu_temp);
      
      // Test entity change listener
      let changeNotificationReceived = false;
      const unsubscribe = manager.addEntityChangeListener((changedEntityIds) => {
        if (changedEntityIds.includes('sensor.cpu_temperature')) {
          changeNotificationReceived = true;
        }
      });
      
      // Simulate entity change
      setTimeout(() => {
        // This would normally be triggered by HASS state change
        manager._notifyGlobalEntityChangeListeners(['sensor.cpu_temperature']);
      }, 10);
      
      // Wait for notification
      await new Promise(resolve => setTimeout(resolve, 50));
      
      unsubscribe();
      
      if (!changeNotificationReceived) {
        throw new Error('Entity change listener not triggered');
      }
      
      console.log('  ✅ Entity change listeners working for rules engine integration');
      return { passed: true };
    } catch (error) {
      return { passed: false, error: `Rules engine integration failed: ${error.message}` };
    }
  }, testResults);
  
  // Test 4: Verify EntityRuntime API compatibility 
  await runTest('EntityRuntime API Compatibility', async () => {
    try {
      const { DataSourceManager } = require('../src/msd/data/DataSourceManager.js');
      const manager = new DataSourceManager(mockHass);
      
      // Create data sources
      for (const [name, config] of Object.entries(testConfig.msd.data_sources)) {
        await manager.createDataSource(name, config);
      }
      
      // Test EntityRuntime-compatible methods
      const entities = manager.listIds(); // Should work like EntityRuntime.listIds()
      const entity = manager.getEntity('sensor.cpu_temperature'); // Should work like EntityRuntime.getEntity()
      
      if (!Array.isArray(entities)) {
        throw new Error('listIds() should return array');
      }
      
      if (!entity || typeof entity.state === 'undefined') {
        throw new Error('getEntity() should return entity with state property');
      }
      
      console.log('  ✅ EntityRuntime API compatibility maintained');
      console.log(`  ✅ Found ${entities.length} entities via compatibility API`);
      
      return { passed: true };
    } catch (error) {
      return { passed: false, error: `API compatibility failed: ${error.message}` };
    }
  }, testResults);
  
  // Test 5: Memory and lifecycle management
  await runTest('Memory and Lifecycle Management', async () => {
    try {
      const { DataSourceManager } = require('../src/msd/data/DataSourceManager.js');
      const manager = new DataSourceManager(mockHass);
      
      // Create data sources
      for (const [name, config] of Object.entries(testConfig.msd.data_sources)) {
        await manager.createDataSource(name, config);
      }
      
      const entitiesBeforeDestroy = manager.listIds().length;
      
      // Test cleanup
      await manager.destroy();
      
      const entitiesAfterDestroy = manager.listIds().length;
      
      if (entitiesAfterDestroy !== 0) {
        throw new Error('destroy() should clean up all data sources');
      }
      
      console.log(`  ✅ Lifecycle management: ${entitiesBeforeDestroy} → ${entitiesAfterDestroy} entities after destroy`);
      return { passed: true };
    } catch (error) {
      return { passed: false, error: `Lifecycle management failed: ${error.message}` };
    }
  }, testResults);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`🧪 Migration Test Results: ${testResults.passed}/${testResults.passed + testResults.failed} passed`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Failures:');
    testResults.errors.forEach(error => console.log(`   ${error}`));
    return false;
  } else {
    console.log('\n✅ All migration compatibility tests passed!');
    console.log('✅ DataSourceManager ready to replace EntityRuntime');
    return true;
  }
}

async function runTest(name, testFn, results) {
  try {
    console.log(`\n🔍 ${name}:`);
    const result = await testFn();
    if (result.passed) {
      results.passed++;
    } else {
      results.failed++;
      results.errors.push(`${name}: ${result.error}`);
      console.log(`   ❌ ${result.error}`);
    }
  } catch (error) {
    results.failed++;
    results.errors.push(`${name}: ${error.message}`);
    console.log(`   ❌ Error: ${error.message}`);
  }
}

if (require.main === module) {
  runMigrationTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigrationTests };
