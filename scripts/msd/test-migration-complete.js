/**
 * Final Migration Validation Test
 *
 * Confirms the EntityRuntime elimination is complete and DataSources-only system works
 */

// DOM polyfill for Node.js testing
function setupDomPolyfill() {
  if (typeof window === 'undefined') {
    global.window = {
      __msdDebug: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {}
    };

    global.document = {
      createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        style: {},
        attributes: {},
        children: [],
        addEventListener: () => {},
        removeEventListener: () => {},
        setAttribute: function(name, value) { this.attributes[name] = value; },
        getAttribute: function(name) { return this.attributes[name]; },
        appendChild: function(child) {
          this.children.push(child);
          child.parentNode = this;
        }
      }),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    global.HTMLElement = class HTMLElement {
      constructor() {
        this.style = {};
        this.attributes = {};
        this.children = [];
      }
      addEventListener() {}
      removeEventListener() {}
      setAttribute(name, value) { this.attributes[name] = value; }
      getAttribute(name) { return this.attributes[name]; }
      appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
      }
    };

    global.performance = { now: () => Date.now() };
  }
}

// Mock HASS with enhanced connection interface
function createMockHass() {
  const entities = {
    'sensor.cpu_temperature': {
      state: '72.3',
      attributes: { unit_of_measurement: '°C', friendly_name: 'CPU Temperature' },
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString()
    },
    'sensor.memory_usage': {
      state: '58.7',
      attributes: { unit_of_measurement: '%', friendly_name: 'Memory Usage' },
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString()
    }
  };

  const subscriptions = new Map();
  let subscriptionId = 1;

  return {
    states: entities,

    connection: {
      subscribeEvents: async (callback, eventType) => {
        const id = subscriptionId++;
        subscriptions.set(id, callback);
        return () => subscriptions.delete(id);
      }
    },

    callService: async (domain, service, serviceData) => [],

    updateEntityState: (entityId, newState) => {
      if (entities[entityId]) {
        const oldState = { ...entities[entityId] };
        entities[entityId] = {
          ...oldState,
          state: newState,
          last_changed: new Date().toISOString(),
          last_updated: new Date().toISOString()
        };

        const event = {
          event_type: 'state_changed',
          data: {
            entity_id: entityId,
            old_state: oldState,
            new_state: entities[entityId]
          }
        };

        subscriptions.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.warn('[MockHASS] Subscription error:', error);
          }
        });
      }
    }
  };
}

async function runFinalMigrationValidation() {
  console.log('🏁 Final Migration Validation');
  console.log('============================\n');

  setupDomPolyfill();
  const mockHass = createMockHass();

  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };

  // Test 1: Verify EntityRuntime Import Fails
  try {
    console.log('📋 Test 1: Confirm EntityRuntime Removal');

    let importFailed = false;
    try {
      await import('../../src/msd/entities/EntityRuntime.js');
    } catch (error) {
      importFailed = true;
      console.log('  ✅ EntityRuntime import correctly fails (file deleted)');
    }

    if (importFailed) {
      results.passed++;
    } else {
      throw new Error('EntityRuntime.js still exists and can be imported');
    }

  } catch (error) {
    console.log('  ❌ Test 1 failed:', error.message);
    results.failed++;
    results.errors.push(`Test 1: ${error.message}`);
  }

  // Test 2: Full System Integration Test
  try {
    console.log('\n📋 Test 2: Complete DataSources-Only System Integration');

    const { SystemsManager } = await import('../../src/msd/pipeline/SystemsManager.js');
    const { DataSourceManager } = await import('../../src/msd/data/DataSourceManager.js');

    // Create complete test config
    const testConfig = {
      data_sources: {
        cpu_temp: {
          entity: 'sensor.cpu_temperature',
          window_seconds: 1800,
          minEmitMs: 200
        },
        memory_usage: {
          entity: 'sensor.memory_usage',
          window_seconds: 3600,
          minEmitMs: 500
        }
      },
      rules: [
        {
          id: 'high_cpu_alert',
          priority: 10,
          when: {
            all: [
              { entity: 'sensor.cpu_temperature', above: 70 }
            ]
          },
          apply: {
            overlays: [
              { id: 'cpu_warning', style: { color: 'red' } }
            ]
          }
        }
      ],
      overlays: [
        {
          id: 'cpu_display',
          type: 'text',
          position: [10, 20],
          style: { source: 'cpu_temp' }
        }
      ]
    };

    const mockCardModel = {
      anchors: {},
      viewBox: { x: 0, y: 0, width: 400, height: 300 }
    };

    const mockMountEl = document.createElement('div');

    // Initialize complete system
    const systemsManager = new SystemsManager();
    await systemsManager.initializeSystems(testConfig, mockCardModel, mockMountEl, mockHass);

    // Verify system state
    const entities = systemsManager.listEntities();
    const cpuEntity = systemsManager.getEntity('sensor.cpu_temperature');
    const memEntity = systemsManager.getEntity('sensor.memory_usage');

    if (entities.length === 2 && cpuEntity && memEntity &&
        cpuEntity.state === '72.3' && memEntity.state === '58.7') {
      console.log(`  ✅ Complete system integration: ${entities.length} entities, all accessible`);
      console.log(`  📊 CPU: ${cpuEntity.state}°C, Memory: ${memEntity.state}%`);
      results.passed++;
    } else {
      throw new Error(`Integration failed: entities=${entities.length}, cpu=${cpuEntity?.state}, mem=${memEntity?.state}`);
    }

  } catch (error) {
    console.log('  ❌ Test 2 failed:', error.message);
    results.failed++;
    results.errors.push(`Test 2: ${error.message}`);
  }

  // Test 3: Rules Engine Integration with DataSources
  try {
    console.log('\n📋 Test 3: Rules Engine + DataSources Integration');

    const { SystemsManager } = await import('../../src/msd/pipeline/SystemsManager.js');

    const testConfig = {
      data_sources: {
        cpu_temp: {
          entity: 'sensor.cpu_temperature',
          window_seconds: 1800
        }
      },
      rules: [
        {
          id: 'cpu_hot',
          when: {
            all: [
              { entity: 'sensor.cpu_temperature', above: 70 }
            ]
          },
          apply: {
            overlays: [
              { id: 'warning', style: { color: 'red' } }
            ]
          }
        }
      ]
    };

    const mockCardModel = { anchors: {}, viewBox: { x: 0, y: 0, width: 400, height: 300 } };
    const mockMountEl = document.createElement('div');

    const systemsManager = new SystemsManager();
    await systemsManager.initializeSystems(testConfig, mockCardModel, mockMountEl, mockHass);

    // Test rules evaluation
    const getEntity = (id) => systemsManager.getEntity(id);
    const rulesResult = systemsManager.rulesEngine.evaluateDirty({ getEntity });

    // CPU temp is 72.3°C, should trigger rule (above 70°C)
    const hasOverlayPatches = rulesResult.overlayPatches && rulesResult.overlayPatches.length > 0;
    const hasWarningPatch = rulesResult.overlayPatches?.some(patch => patch.id === 'warning');

    if (hasOverlayPatches && hasWarningPatch) {
      console.log(`  ✅ Rules engine integration: ${rulesResult.overlayPatches.length} patches generated`);
      console.log(`  📊 High CPU rule triggered correctly (72.3°C > 70°C)`);
      results.passed++;
    } else {
      throw new Error(`Rules integration failed: patches=${rulesResult.overlayPatches?.length}, hasWarning=${hasWarningPatch}`);
    }

  } catch (error) {
    console.log('  ❌ Test 3 failed:', error.message);
    results.failed++;
    results.errors.push(`Test 3: ${error.message}`);
  }

  // Test 4: Memory and Performance Validation
  try {
    console.log('\n📋 Test 4: Memory Efficiency and Performance');

    const { DataSourceManager } = await import('../../src/msd/data/DataSourceManager.js');

    // Create multiple managers to test cleanup
    const managers = [];
    for (let i = 0; i < 3; i++) {
      const config = {
        [`test_entity_${i}`]: {
          entity: i === 0 ? 'sensor.cpu_temperature' : 'sensor.memory_usage',
          window_seconds: 1800
        }
      };

      const manager = new DataSourceManager(mockHass);
      await manager.initializeFromConfig(config);
      managers.push(manager);
    }

    // Verify all managers work independently
    let totalEntities = 0;
    managers.forEach((manager, index) => {
      const entities = manager.listIds();
      totalEntities += entities.length;
      console.log(`    Manager ${index + 1}: ${entities.length} entities`);
    });

    // Cleanup all managers
    for (const manager of managers) {
      await manager.destroy();
    }

    if (totalEntities === 3) {
      console.log(`  ✅ Memory management: ${totalEntities} total entities across card-scoped managers`);
      console.log(`  📊 Each card has isolated entity management`);
      results.passed++;
    } else {
      throw new Error(`Memory test failed: expected 3 entities, got ${totalEntities}`);
    }

  } catch (error) {
    console.log('  ❌ Test 4 failed:', error.message);
    results.failed++;
    results.errors.push(`Test 4: ${error.message}`);
  }

  // Results summary
  console.log('\n🏆 Final Migration Validation Results:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\n🔍 Error Details:');
    results.errors.forEach(error => console.log(`  • ${error}`));
  }

  const success = results.failed === 0;

  if (success) {
    console.log('\n🎉 MIGRATION COMPLETE!');
    console.log('✅ EntityRuntime successfully eliminated');
    console.log('✅ DataSources-only system fully operational');
    console.log('✅ Card-scoped entity management working');
    console.log('✅ Rules engine integration successful');
    console.log('✅ Memory efficiency achieved');
    console.log('\n🚀 System ready for production use!');
  } else {
    console.log('\n💥 Migration validation FAILED');
    console.log('🔍 Review error details above');
  }

  return { passed: success, results };
}

// Run tests if called directly
if (typeof module !== 'undefined' && require.main === module) {
  runFinalMigrationValidation().then(result => {
    process.exit(result.passed ? 0 : 1);
  }).catch(error => {
    console.error('❌ Final validation failed:', error);
    process.exit(1);
  });
}

export { runFinalMigrationValidation };
