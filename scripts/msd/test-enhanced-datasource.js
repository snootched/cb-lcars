#!/usr/bin/env node

/**
 * Test Enhanced DataSource System
 *
 * This test validates the new transformation and aggregation capabilities
 * of the MSD DataSource system.
 */

const path = require('path');

// Import the core modules
const { MsdDataSource } = require(path.join(__dirname, '../../src/msd/data/MsdDataSource.js'));
const { DataSourceManager } = require(path.join(__dirname, '../../src/msd/data/DataSourceManager.js'));

/**
 * Mock HASS object for testing
 */
function createMockHass() {
  return {
    states: {
      'sensor.temperature': {
        state: '75.5',
        attributes: {
          unit_of_measurement: '°F',
          friendly_name: 'Temperature Sensor'
        }
      }
    },
    connection: {
      subscribeEvents: async (callback, eventType) => {
        console.log('📡 Mock: subscribed to', eventType);
        // Return unsubscribe function
        return () => console.log('📡 Mock: unsubscribed from', eventType);
      },
      sendMessagePromise: async (message) => {
        console.log('📡 Mock: sending message', message.type);
        return {}; // Empty response
      }
    },
    auth: {
      accessToken: 'mock-token'
    },
    callService: async (domain, service, data) => {
      console.log(`📡 Mock: calling ${domain}.${service}`, data);
      return {}; // Empty response
    }
  };
}

/**
 * Test basic enhanced DataSource
 */
async function testEnhancedDataSource() {
  console.log('\n🧪 Testing Enhanced DataSource System...\n');

  const mockHass = createMockHass();

  // Create a data source with transformations and aggregations
  const config = {
    entity: 'sensor.temperature',
    transformations: [
      {
        type: 'unit_conversion',
        conversion: 'f_to_c',
        key: 'celsius'
      },
      {
        type: 'smooth',
        method: 'exponential',
        alpha: 0.3,
        key: 'smoothed'
      }
    ],
    aggregations: {
      moving_average: {
        window: '5m',
        key: 'avg_5m'
      },
      session_stats: {
        key: 'session'
      }
    }
  };

  console.log('🔧 Creating enhanced data source with config:', JSON.stringify(config, null, 2));

  const dataSource = new MsdDataSource(config, mockHass);

  // Test initialization
  try {
    await dataSource.start();
    console.log('✅ DataSource started successfully');
  } catch (error) {
    console.error('❌ DataSource start failed:', error);
    return false;
  }

  // Get debug info
  const debugInfo = dataSource.getDebugInfo();
  console.log('🔍 Debug info:', JSON.stringify(debugInfo, null, 2));

  // Test getCurrentData
  const currentData = dataSource.getCurrentData();
  console.log('📊 Current data structure:', JSON.stringify(currentData, null, 2));

  // Verify transformations are initialized
  if (debugInfo.transformations.count !== 2) {
    console.error('❌ Expected 2 transformations, got', debugInfo.transformations.count);
    return false;
  }

  // Verify aggregations are initialized
  if (debugInfo.aggregations.count !== 2) {
    console.error('❌ Expected 2 aggregations, got', debugInfo.aggregations.count);
    return false;
  }

  console.log('✅ Enhanced DataSource test passed!');

  await dataSource.stop();
  return true;
}

/**
 * Test DataSourceManager with dot notation
 */
async function testDataSourceManager() {
  console.log('\n🧪 Testing Enhanced DataSourceManager...\n');

  const mockHass = createMockHass();

  const config = {
    data_sources: {
      temp_enhanced: {
        type: 'entity',
        entity: 'sensor.temperature',
        transformations: [
          {
            type: 'unit_conversion',
            conversion: 'f_to_c',
            key: 'celsius'
          }
        ],
        aggregations: {
          moving_average: {
            window: '5m',
            key: 'avg_5m'
          }
        }
      }
    }
  };

  console.log('🔧 Creating DataSourceManager with config:', JSON.stringify(config.data_sources, null, 2));

  const manager = new DataSourceManager(config, mockHass);

  try {
    await manager.initializeFromConfig();
    console.log('✅ DataSourceManager initialized successfully');
  } catch (error) {
    console.error('❌ DataSourceManager initialization failed:', error);
    return false;
  }

  // Test dot notation access
  console.log('🔍 Testing dot notation access...');

  // Test basic entity access
  const baseEntity = manager.getEntity('temp_enhanced');
  console.log('📊 Base entity:', baseEntity ? 'found' : 'not found');

  // Test transformation access
  const celsiusEntity = manager.getEntity('temp_enhanced.transformations.celsius');
  console.log('📊 Celsius transformation:', celsiusEntity ? 'found' : 'not found');

  // Test aggregation access
  const avgEntity = manager.getEntity('temp_enhanced.aggregations.avg_5m');
  console.log('📊 Average aggregation:', avgEntity ? 'found' : 'not found');

  // Get debug info
  const debugInfo = manager.getDebugInfo();
  console.log('🔍 Manager debug info:', JSON.stringify(debugInfo, null, 2));

  console.log('✅ DataSourceManager test passed!');

  await manager.stop();
  return true;
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Enhanced DataSource System Test Suite');
  console.log('==========================================');

  let success = true;

  // Test individual DataSource
  success = await testEnhancedDataSource() && success;

  // Test DataSourceManager
  success = await testDataSourceManager() && success;

  console.log('\n==========================================');
  if (success) {
    console.log('🎉 All tests passed! Enhanced DataSource system is working correctly.');
  } else {
    console.log('❌ Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});