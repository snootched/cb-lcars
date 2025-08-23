/**
 * Test merge performance and memory usage
 * Validates performance targets from roadmap
 */

import { mergePacks } from '../../src/msd/packs/mergePacks.js';

// Performance test configurations
const testConfigs = {
  small: {
    version: 1,
    overlays: Array.from({length: 5}, (_, i) => ({
      id: `overlay_${i}`,
      type: 'text',
      position: [i * 50, i * 30],
      style: { value: `Test ${i}`, color: 'var(--lcars-orange)' }
    }))
  },

  medium: {
    version: 1,
    overlays: Array.from({length: 50}, (_, i) => ({
      id: `overlay_${i}`,
      type: 'text',
      position: [i * 10, i * 5],
      style: { value: `Test ${i}`, color: 'var(--lcars-orange)' }
    })),
    rules: Array.from({length: 20}, (_, i) => ({
      id: `rule_${i}`,
      when: { all: [{ entity: `sensor.test_${i}`, above: 50 }] },
      apply: { overlays: [{ id: `overlay_${i}`, style: { color: 'red' } }] }
    }))
  },

  large: {
    version: 1,
    overlays: Array.from({length: 100}, (_, i) => ({
      id: `overlay_${i}`,
      type: 'text',
      position: [i * 5, i * 3],
      style: { value: `Test ${i}`, color: 'var(--lcars-orange)' }
    })),
    rules: Array.from({length: 50}, (_, i) => ({
      id: `rule_${i}`,
      when: { all: [{ entity: `sensor.test_${i}`, above: 50 }] },
      apply: { overlays: [{ id: `overlay_${i}`, style: { color: 'red' } }] }
    })),
    animations: Array.from({length: 20}, (_, i) => ({
      id: `anim_${i}`,
      preset: 'pulse',
      params: { duration: 1000 + i * 100 }
    }))
  }
};

async function runPerformanceTest() {
  console.log('⚡ Running performance tests...');

  const results = {};

  for (const [size, config] of Object.entries(testConfigs)) {
    console.log(`\n📊 Testing ${size} configuration...`);

    // Warmup
    await mergePacks(JSON.parse(JSON.stringify(config)));

    // Performance measurement
    const times = [];
    const iterations = size === 'large' ? 5 : 10;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const result = await mergePacks(JSON.parse(JSON.stringify(config)));
      const duration = performance.now() - start;

      times.push(duration);

      // Verify merge completed successfully
      if (!result.checksum) {
        return { passed: false, error: `${size} config failed to produce checksum` };
      }
    }

    const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);

    results[size] = { avgTime, maxTime, minTime, iterations };

    console.log(`   Average: ${avgTime.toFixed(2)}ms`);
    console.log(`   Range: ${minTime.toFixed(2)}ms - ${maxTime.toFixed(2)}ms`);
  }

  // Validate performance targets from roadmap
  const targets = {
    small: 25,   // Should be very fast
    medium: 50,  // <50ms for typical config
    large: 100   // <100ms for large config
  };

  let passed = true;
  const failures = [];

  for (const [size, target] of Object.entries(targets)) {
    if (results[size].avgTime > target) {
      passed = false;
      failures.push(`${size}: ${results[size].avgTime.toFixed(2)}ms > ${target}ms target`);
    }
  }

  if (passed) {
    console.log('\n✅ Performance test PASSED');
    console.log('   All configurations within performance targets');
    return { passed: true, results };
  } else {
    console.error('\n❌ Performance test FAILED');
    console.error('   Performance targets exceeded:');
    failures.forEach(f => console.error(`     ${f}`));
    return { passed: false, error: 'Performance targets not met', failures };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runPerformanceTest };
