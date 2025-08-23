/**
 * Test rules engine dependency tracking and dirty evaluation
 * Verifies that only rules with changed dependencies are processed
 */

import { RulesEngine } from '../../src/msd/rules/RulesEngine.js';

const testRules = [
  {
    id: 'temp_high',
    priority: 10,
    when: {
      all: [
        { entity: 'sensor.cpu_temp', above: 70 }
      ]
    },
    apply: {
      overlays: [
        { id: 'cpu_status', style: { color: 'red' } }
      ]
    }
  },
  {
    id: 'temp_and_time',
    priority: 5,
    when: {
      all: [
        { entity: 'sensor.cpu_temp', below: 50 },
        { time_between: '22:00-06:00' }
      ]
    },
    apply: {
      profiles_add: ['night_mode']
    }
  },
  {
    id: 'multi_sensor',
    when: {
      any: [
        { entity: 'sensor.cpu_temp', above: 80 },
        { entity: 'sensor.memory_usage', above: 90 }
      ]
    },
    apply: {
      overlays: [
        { id: 'alert', style: { color: 'red', blink: true } }
      ]
    }
  },
  {
    id: 'map_range_test',
    when: {
      all: [
        {
          map_range_cond: {
            entity: 'sensor.cpu_temp',
            input: [20, 100],
            output: [0, 1],
            above: 0.7
          }
        }
      ]
    },
    apply: {
      animations: [
        { ref: 'warning_pulse' }
      ]
    }
  }
];

// Mock entity data
const mockEntities = {
  'sensor.cpu_temp': { state: '65', attributes: {} },
  'sensor.memory_usage': { state: '45', attributes: {} },
  'binary_sensor.motion': { state: 'on', attributes: {} }
};

function mockGetEntity(entityId) {
  return mockEntities[entityId] || null;
}

async function runRuleDependenciesTest() {
  console.log('🔗 Running rules dependency tracking test...');

  let passed = 0;
  let failed = 0;

  // Test 1: Dependency index construction
  try {
    const engine = new RulesEngine(testRules);

    // Verify dependency mappings
    const deps = engine.dependencyIndex;

    // sensor.cpu_temp should map to temp_high, temp_and_time, multi_sensor, map_range_test
    const cpuTempRules = deps.entityToRules.get('sensor.cpu_temp');
    const expectedCpuRules = new Set(['temp_high', 'temp_and_time', 'multi_sensor', 'map_range_test']);

    if (!cpuTempRules || cpuTempRules.size !== expectedCpuRules.size ||
        !Array.from(expectedCpuRules).every(id => cpuTempRules.has(id))) {
      console.error('❌ CPU temp dependency mapping incorrect');
      console.error('   Expected:', expectedCpuRules);
      console.error('   Got:', cpuTempRules);
      failed++;
    } else {
      console.log('✅ Dependency index construction: CPU temp mapping correct');
      passed++;
    }

    // sensor.memory_usage should map to multi_sensor only
    const memoryRules = deps.entityToRules.get('sensor.memory_usage');
    if (!memoryRules || memoryRules.size !== 1 || !memoryRules.has('multi_sensor')) {
      console.error('❌ Memory usage dependency mapping incorrect');
      console.error('   Expected: [multi_sensor]');
      console.error('   Got:', memoryRules);
      failed++;
    } else {
      console.log('✅ Dependency index construction: Memory mapping correct');
      passed++;
    }

  } catch (error) {
    console.error('❌ Dependency index construction failed:', error.message);
    failed++;
  }

  // Test 2: Dirty evaluation - only affected rules process
  try {
    const engine = new RulesEngine(testRules);

    // Initially all rules are dirty
    const initialDirty = engine.dirtyRules.size;
    if (initialDirty !== testRules.length) {
      console.error('❌ Initial dirty state incorrect');
      console.error(`   Expected: ${testRules.length}, Got: ${initialDirty}`);
      failed++;
    } else {
      console.log('✅ Initial state: All rules marked dirty');
      passed++;
    }

    // Clear dirty state
    engine.dirtyRules.clear();

    // Change only cpu_temp entity
    const affectedCount = engine.markEntitiesDirty(['sensor.cpu_temp']);

    // Should affect 4 rules (temp_high, temp_and_time, multi_sensor, map_range_test)
    if (affectedCount !== 4 || engine.dirtyRules.size !== 4) {
      console.error('❌ Dirty marking incorrect for cpu_temp change');
      console.error(`   Expected 4 affected rules, got ${affectedCount}`);
      console.error(`   Dirty rules: ${engine.dirtyRules.size}`);
      failed++;
    } else {
      console.log('✅ Dirty evaluation: Correct rules marked dirty for cpu_temp');
      passed++;
    }

  } catch (error) {
    console.error('❌ Dirty evaluation test failed:', error.message);
    failed++;
  }

  // Test 3: Rule evaluation with conditions
  try {
    const engine = new RulesEngine(testRules);

    // Set cpu temp to 75 (should trigger temp_high rule)
    mockEntities['sensor.cpu_temp'].state = '75';

    const result = engine.evaluateDirty({ getEntity: mockGetEntity });

    // Should have overlay patches from temp_high rule
    if (!result.overlayPatches || result.overlayPatches.length === 0) {
      console.error('❌ Rule evaluation: No overlay patches generated');
      console.error('   Result:', JSON.stringify(result, null, 2));
      failed++;
    } else {
      const tempHighPatch = result.overlayPatches.find(p => p.id === 'cpu_status');
      if (!tempHighPatch || tempHighPatch.style.color !== 'red') {
        console.error('❌ Rule evaluation: Incorrect overlay patch');
        console.error('   Expected: {id: "cpu_status", style: {color: "red"}}');
        console.error('   Got:', tempHighPatch);
        failed++;
      } else {
        console.log('✅ Rule evaluation: Correct overlay patch generated');
        passed++;
      }
    }

  } catch (error) {
    console.error('❌ Rule evaluation test failed:', error.message);
    failed++;
  }

  // Test 4: Performance tracking
  try {
    const engine = new RulesEngine(testRules);

    // Evaluate rules and check performance counters
    engine.evaluateDirty({ getEntity: mockGetEntity });

    const trace = engine.getTrace();

    if (trace.evalCounts.total === 0) {
      console.error('❌ Performance tracking: No evaluations recorded');
      failed++;
    } else if (trace.dependencyStats.entitiesTracked === 0) {
      console.error('❌ Performance tracking: No entities tracked');
      failed++;
    } else {
      console.log('✅ Performance tracking: Counters working correctly');
      console.log(`   Entities tracked: ${trace.dependencyStats.entitiesTracked}`);
      console.log(`   Rules evaluated: ${trace.evalCounts.total}`);
      passed++;
    }

  } catch (error) {
    console.error('❌ Performance tracking test failed:', error.message);
    failed++;
  }

  const total = passed + failed;
  console.log(`\n📊 Rule Dependencies Results: ${passed}/${total} passed`);

  if (failed === 0) {
    console.log('✅ Rules dependency tracking test PASSED');
    console.log('   ✓ Dependency index correctly maps entity references to rules');
    console.log('   ✓ Only rules with changed dependencies are marked dirty');
    console.log('   ✓ Rule conditions evaluate correctly with mock entities');
    console.log('   ✓ Performance tracking captures evaluation metrics');
    return { passed: true };
  } else {
    console.error('❌ Rules dependency tracking test FAILED');
    return { passed: false, error: `${failed}/${total} dependency checks failed` };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRuleDependenciesTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runRuleDependenciesTest };
