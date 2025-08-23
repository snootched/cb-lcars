/**
 * Test merge performance and memory usage
 * Validates performance targets from roadmap
 */

import { mergePacks } from '../../src/msd/packs/mergePacks.js';
import { perfGetAll, perfReset } from '../../src/msd/util/performance.js';

// Performance test configurations of varying complexity
const testConfigs = {
  small: {
    name: 'Small Configuration',
    config: {
      version: 1,
      anchors: {
        cpu: [120, 80],
        mem: [180, 120]
      },
      overlays: Array.from({length: 5}, (_, i) => ({
        id: `overlay_${i}`,
        type: 'text',
        position: [i * 50, i * 30],
        style: { value: `Test ${i}`, color: 'var(--lcars-orange)' }
      })),
      palettes: {
        theme: {
          primary: '#orange',
          secondary: '#yellow'
        }
      }
    },
    target: 25 // ms
  },

  medium: {
    name: 'Medium Configuration',
    config: {
      version: 1,
      use_packs: { builtin: ['core'] },
      anchors: Object.fromEntries(
        Array.from({length: 10}, (_, i) => [`anchor_${i}`, [i * 40, i * 25]])
      ),
      overlays: Array.from({length: 50}, (_, i) => ({
        id: `overlay_${i}`,
        type: i % 2 === 0 ? 'text' : 'line',
        position: [i * 10, i * 5],
        style: {
          value: `Test ${i}`,
          color: `hsl(${i * 7}, 70%, 50%)`,
          ...(i % 2 === 1 ? { width: 2 } : {})
        }
      })),
      rules: Array.from({length: 20}, (_, i) => ({
        id: `rule_${i}`,
        when: { all: [{ entity: `sensor.test_${i}`, above: 50 }] },
        apply: {
          overlays: [{ id: `overlay_${i}`, style: { color: 'red' } }]
        }
      })),
      palettes: {
        theme: Object.fromEntries(
          Array.from({length: 15}, (_, i) => [`color_${i}`, `hsl(${i * 24}, 70%, 50%)`])
        ),
        secondary: Object.fromEntries(
          Array.from({length: 10}, (_, i) => [`shade_${i}`, `hsl(200, 50%, ${30 + i * 5}%)`])
        )
      }
    },
    target: 50 // ms
  },

  large: {
    name: 'Large Configuration',
    config: {
      version: 1,
      use_packs: { builtin: ['core'] },
      anchors: Object.fromEntries(
        Array.from({length: 25}, (_, i) => [`anchor_${i}`, [`${i * 2}%`, `${i * 3}%`]])
      ),
      overlays: Array.from({length: 100}, (_, i) => ({
        id: `overlay_${i}`,
        type: ['text', 'line', 'sparkline'][i % 3],
        position: [i * 5, i * 3],
        style: {
          value: `Complex Test ${i}`,
          color: `hsl(${i * 3.6}, 70%, 50%)`,
          width: Math.floor(i / 10) + 1
        }
      })),
      rules: Array.from({length: 50}, (_, i) => ({
        id: `rule_${i}`,
        priority: i,
        when: {
          all: [
            { entity: `sensor.test_${i}`, above: 50 },
            { time_between: `${String(i % 24).padStart(2, '0')}:00-${String((i + 1) % 24).padStart(2, '0')}:00` }
          ]
        },
        apply: {
          overlays: [{
            id: `overlay_${i}`,
            style: { color: 'red', width: i % 5 + 1 }
          }]
        }
      })),
      animations: Array.from({length: 20}, (_, i) => ({
        id: `anim_${i}`,
        preset: 'pulse',
        params: { duration: 1000 + i * 100, alternate: true }
      })),
      palettes: {
        primary: Object.fromEntries(
          Array.from({length: 30}, (_, i) => [`color_${i}`, `hsl(${i * 12}, 70%, 50%)`])
        ),
        secondary: Object.fromEntries(
          Array.from({length: 20}, (_, i) => [`shade_${i}`, `hsl(200, 50%, ${20 + i * 3}%)`])
        ),
        gradients: Object.fromEntries(
          Array.from({length: 15}, (_, i) => [`grad_${i}`, `linear-gradient(${i * 24}deg, hsl(${i * 24}, 70%, 40%), hsl(${i * 24 + 60}, 70%, 60%))`])
        )
      }
    },
    target: 100 // ms
  }
};

async function runPerformanceTest() {
  console.log('⚡ Running performance tests...');

  const results = {};
  let allPassed = true;

  for (const [size, testSpec] of Object.entries(testConfigs)) {
    console.log(`\n📊 Testing ${testSpec.name}...`);

    // Reset performance tracking
    perfReset();

    // Warmup run
    await mergePacks(JSON.parse(JSON.stringify(testSpec.config)));
    perfReset();

    // Performance measurement
    const times = [];
    const iterations = size === 'large' ? 5 : 10;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const result = await mergePacks(JSON.parse(JSON.stringify(testSpec.config)));
      const duration = performance.now() - start;

      times.push(duration);

      // Verify merge completed successfully
      if (!result.checksum) {
        console.error(`❌ ${testSpec.name} failed to produce checksum`);
        allPassed = false;
        break;
      }
    }

    if (allPassed) {
      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const stdDev = Math.sqrt(times.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / times.length);

      results[size] = {
        avgTime: Math.round(avgTime * 100) / 100,
        maxTime: Math.round(maxTime * 100) / 100,
        minTime: Math.round(minTime * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        iterations,
        target: testSpec.target
      };

      console.log(`   Average: ${results[size].avgTime}ms (target: ${testSpec.target}ms)`);
      console.log(`   Range: ${results[size].minTime}ms - ${results[size].maxTime}ms`);
      console.log(`   Std Dev: ${results[size].stdDev}ms`);

      // Performance counters summary
      const perfData = perfGetAll();
      if (perfData.summary.timings['merge.total']) {
        console.log(`   Merge breakdown:`);
        Object.entries(perfData.timings)
          .filter(([key]) => key.startsWith('merge.'))
          .forEach(([key, timing]) => {
            console.log(`     ${key}: ${timing.avg.toFixed(2)}ms avg`);
          });
      }

      // Check against target
      if (results[size].avgTime > testSpec.target) {
        console.error(`❌ ${testSpec.name}: Average ${results[size].avgTime}ms exceeds ${testSpec.target}ms target`);
        allPassed = false;
      } else {
        console.log(`✅ ${testSpec.name}: Performance target met`);
      }
    }
  }

  console.log(`\n📊 Performance Test Results:`);
  Object.entries(results).forEach(([size, data]) => {
    const status = data.avgTime <= data.target ? '✅' : '❌';
    console.log(`   ${status} ${size}: ${data.avgTime}ms avg (target: ${data.target}ms)`);
  });

  if (allPassed) {
    console.log('\n✅ Performance test PASSED');
    console.log('   All configurations within performance targets');
    return { passed: true, results };
  } else {
    console.error('\n❌ Performance test FAILED');
    console.error('   One or more configurations exceeded performance targets');
    return { passed: false, error: 'Performance targets not met', results };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runPerformanceTest };
