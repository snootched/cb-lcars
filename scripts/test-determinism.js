/**
 * Test deterministic merge behavior
 * Same input should always produce same checksum
 */

import { mergePacks } from '../src/msd/mergePacks.js';

const testConfig = {
  version: 1,
  anchors: {
    cpu: [120, 80],
    mem: ["60%", "40%"]
  },
  overlays: [
    {
      id: 'test_overlay',
      type: 'text',
      position: [40, 40],
      style: {
        value: 'Test',
        color: 'var(--lcars-orange)'
      }
    }
  ],
  rules: [
    {
      id: 'test_rule',
      when: {
        all: [{ entity: 'sensor.test', above: 50 }]
      },
      apply: {
        overlays: [{ id: 'test_overlay', style: { color: 'red' } }]
      }
    }
  ]
};

async function runDeterminismTest() {
  console.log('🔄 Running determinism test...');

  const results = [];
  const iterations = 10;

  try {
    // Merge same config multiple times
    for (let i = 0; i < iterations; i++) {
      const result = await mergePacks(JSON.parse(JSON.stringify(testConfig)));
      results.push({
        iteration: i + 1,
        checksum: result.checksum,
        mergeTime: result.__performance?.merge_time_ms || 0
      });
    }

    // Verify all checksums are identical
    const firstChecksum = results[0].checksum;
    const allMatch = results.every(r => r.checksum === firstChecksum);

    if (allMatch) {
      console.log('✅ Determinism test PASSED');
      console.log(`   Checksum: ${firstChecksum}`);
      console.log(`   Iterations: ${iterations}`);

      const avgTime = results.reduce((sum, r) => sum + r.mergeTime, 0) / iterations;
      console.log(`   Average merge time: ${avgTime.toFixed(2)}ms`);

      return { passed: true, checksum: firstChecksum, avgTime };
    } else {
      console.error('❌ Determinism test FAILED');
      console.error('   Different checksums found:');
      results.forEach(r => {
        console.error(`   Iteration ${r.iteration}: ${r.checksum}`);
      });
      return { passed: false, error: 'Inconsistent checksums' };
    }

  } catch (error) {
    console.error('❌ Determinism test ERROR:', error);
    return { passed: false, error: error.message };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDeterminismTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runDeterminismTest };
