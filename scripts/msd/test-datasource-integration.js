import { setupDomPolyfill } from './test-utils/dom-polyfill.js';

// Test DataSourceManager integration with MSD v1 pipeline
export async function testDataSourceIntegration() {
  console.log('\n🔌 Testing DataSource Integration Pipeline...');
  setupDomPolyfill();

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: DataSourceManager instantiation with config
  try {
    const { DataSourceManager } = await import('../../src/msd/data/DataSourceManager.js');

    const mockHass = {
      connection: { subscribeMessage: () => Promise.resolve() }
    };

    const testConfig = {
      test_cpu_temp: {
        type: 'msd',
        entity: 'sensor.bathroom_dial_battery',
        buffer_size: 50,
        update_interval: 1000
      },
      test_memory: {
        type: 'msd',
        entity: 'sensor.bedroom_dial_battery',
        buffer_size: 30,
        update_interval: 2000
      }
    };

    const manager = new DataSourceManager(mockHass);
    const sourceCount = await manager.initializeFromConfig(testConfig);

    console.log('✅ DataSourceManager initialization:', sourceCount, 'sources created');
    results.tests.push({ name: 'DataSourceManager Creation', passed: true });
    results.passed++;
  } catch (error) {
    console.error('❌ DataSourceManager creation failed:', error.message);
    results.tests.push({ name: 'DataSourceManager Creation', passed: false, error: error.message });
    results.failed++;
  }

  // Test 2: Overlay subscription system
  try {
    const mockOverlay = {
      id: 'test_sparkline',
      type: 'sparkline',
      source: 'test_cpu_temp'
    };

    const { DataSourceManager } = await import('../../src/msd/data/DataSourceManager.js');
    const manager = new DataSourceManager({
      connection: { subscribeMessage: () => Promise.resolve() }
    });

    manager.subscribeOverlay(mockOverlay, (overlay, data) => {
      console.log('📊 Data callback triggered for', overlay.id, data);
    });

    console.log('✅ Overlay subscription system works');
    results.tests.push({ name: 'Overlay Subscription', passed: true });
    results.passed++;
  } catch (error) {
    console.error('❌ Overlay subscription failed:', error.message);
    results.tests.push({ name: 'Overlay Subscription', passed: false, error: error.message });
    results.failed++;
  }

  // Test 3: AdvancedRenderer updateOverlayData method exists
  try {
    const { AdvancedRenderer } = await import('../../src/msd/renderer/AdvancedRenderer.js');

    const renderer = new AdvancedRenderer();

    if (typeof renderer.updateOverlayData === 'function') {
      console.log('✅ AdvancedRenderer has updateOverlayData method');
      results.tests.push({ name: 'Renderer Update Method', passed: true });
      results.passed++;
    } else {
      throw new Error('updateOverlayData method not found');
    }
  } catch (error) {
    console.error('❌ AdvancedRenderer updateOverlayData check failed:', error.message);
    results.tests.push({ name: 'Renderer Update Method', passed: false, error: error.message });
    results.failed++;
  }

  const successRate = Math.round((results.passed / (results.passed + results.failed)) * 100);

  console.log(`\n🔌 DataSource Integration Test Results: ${results.passed}/${results.passed + results.failed} tests passed (${successRate}%)`);

  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.tests.filter(t => !t.passed).forEach(test => {
      console.log(`   - ${test.name}: ${test.error}`);
    });
  }

  return {
    passed: results.failed === 0,
    results,
    error: results.failed > 0 ? `${results.failed} integration tests failed` : null
  };
}

// Allow running directly
if (process.argv[1]?.endsWith('test-datasource-integration.js')) {
  testDataSourceIntegration().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}
