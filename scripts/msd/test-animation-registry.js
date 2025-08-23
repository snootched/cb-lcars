/**
 * Test animation registry caching and reuse
 * Verifies semantic hashing and performance optimization
 */

import { AnimationRegistry } from '../../src/msd/animation/AnimationRegistry.js';
import { computeObjectHash } from '../../src/msd/util/hashing.js';

// Mock animation definitions for testing
const testAnimations = {
  simpleFade: {
    preset: 'fade',
    duration: 1000,
    easing: 'ease-in-out'
  },

  complexPulse: {
    preset: 'pulse',
    params: {
      duration: 1200,
      loop: true,
      alternate: true,
      max_scale: 1.15,
      min_opacity: 0.65
    }
  },

  motionPath: {
    preset: 'motionpath',
    params: {
      path_selector: '#line_cpu',
      tracer: { r: 4, fill: 'var(--lcars-orange)' },
      duration: 4000,
      loop: true
    }
  }
};

async function runAnimationRegistryTest() {
  console.log('🎬 Running animation registry test...');

  let passed = 0;
  let failed = 0;

  // Test 1: Hash determinism - same definition produces same hash
  try {
    const registry = new AnimationRegistry();

    const hash1 = registry.computeInstanceHash(testAnimations.simpleFade);
    const hash2 = registry.computeInstanceHash(testAnimations.simpleFade);

    if (hash1 !== hash2) {
      console.error('❌ Hash determinism: Same definition produced different hashes');
      console.error(`   Hash 1: ${hash1}`);
      console.error(`   Hash 2: ${hash2}`);
      failed++;
    } else {
      console.log('✅ Hash determinism: Same definition produces same hash');
      passed++;
    }

    // Verify different definitions produce different hashes
    const hash3 = registry.computeInstanceHash(testAnimations.complexPulse);

    if (hash1 === hash3) {
      console.error('❌ Hash uniqueness: Different definitions produced same hash');
      failed++;
    } else {
      console.log('✅ Hash uniqueness: Different definitions produce different hashes');
      passed++;
    }

  } catch (error) {
    console.error('❌ Hash determinism test failed:', error.message);
    failed++;
  }

  // Test 2: Parameter normalization reduces precision churn
  try {
    const registry = new AnimationRegistry();

    const def1 = { preset: 'fade', duration: 1000.0001 };
    const def2 = { preset: 'fade', duration: 1000.0002 };

    const hash1 = registry.computeInstanceHash(def1);
    const hash2 = registry.computeInstanceHash(def2);

    if (hash1 !== hash2) {
      console.error('❌ Parameter normalization: Minor precision differences caused hash churn');
      console.error(`   Duration 1: ${def1.duration}, Hash: ${hash1}`);
      console.error(`   Duration 2: ${def2.duration}, Hash: ${hash2}`);
      console.error('   Normalized 1:', registry.normalizeNumber(def1.duration));
      console.error('   Normalized 2:', registry.normalizeNumber(def2.duration));
      failed++;
    } else {
      console.log('✅ Parameter normalization: Minor precision differences normalized');
      passed++;
    }

  } catch (error) {
    console.error('❌ Parameter normalization test failed:', error.message);
    failed++;
  }

  // Test 3: Animation instance reuse
  try {
    const registry = new AnimationRegistry();

    // Mock targets
    const targets1 = ['#overlay1', '#overlay2'];
    const targets2 = ['#overlay1', '#overlay2']; // Same selectors
    const targets3 = ['#overlay3', '#overlay4']; // Different selectors

    const instance1 = registry.getOrCreateInstance(testAnimations.simpleFade, targets1);
    const instance2 = registry.getOrCreateInstance(testAnimations.simpleFade, targets2);
    const instance3 = registry.getOrCreateInstance(testAnimations.simpleFade, targets3);

    // instance2 should be reused from instance1 (same targets)
    if (!instance1 || !instance2) {
      console.error('❌ Animation reuse: Failed to create instances');
      failed++;
    } else {
      // Check performance stats
      const stats = registry.getStats();

      if (stats.instancesReused === 0) {
        console.error('❌ Animation reuse: No reuse detected for compatible targets');
        console.error(`   Stats: ${JSON.stringify(stats)}`);
        failed++;
      } else {
        console.log('✅ Animation reuse: Compatible targets reuse instances');
        console.log(`   Cache hits: ${stats.cacheHits}, Reused: ${stats.instancesReused}`);
        passed++;
      }
    }

  } catch (error) {
    console.error('❌ Animation reuse test failed:', error.message);
    failed++;
  }

  // Test 4: Cache performance and cleanup
  try {
    const registry = new AnimationRegistry();
    registry.maxCacheSize = 5; // Small cache for testing
    registry.cleanupThreshold = 8; // Set threshold higher than maxCacheSize for proper testing

    // Create many different animations to trigger cleanup
    const definitions = [];
    for (let i = 0; i < 10; i++) {
      definitions.push({
        preset: 'fade',
        duration: 1000 + i * 100, // Different durations = different hashes
        easing: 'ease'
      });
    }

    // Create instances for all definitions
    definitions.forEach((def, index) => {
      registry.getOrCreateInstance(def, [`#target${index}`]);
    });

    const stats = registry.getStats();

    if (stats.cacheSize > registry.maxCacheSize) {
      console.error('❌ Cache cleanup: Cache size exceeded maximum after cleanup');
      console.error(`   Cache size: ${stats.cacheSize}, Max: ${registry.maxCacheSize}`);
      console.error(`   Cleanup runs: ${stats.cleanupRuns}`);
      failed++;
    } else {
      console.log('✅ Cache cleanup: Cache size maintained within limits');
      console.log(`   Cache size: ${stats.cacheSize}, Cleanups: ${stats.cleanupRuns}`);
      passed++;
    }

  } catch (error) {
    console.error('❌ Cache performance test failed:', error.message);
    failed++;
  }

  // Test 5: Complex animation with overrides
  try {
    const registry = new AnimationRegistry();

    const baseAnimation = {
      animation_ref: 'pulse_fast'
    };

    const overriddenAnimation = {
      animation_ref: 'pulse_fast',
      override: {
        params: {
          duration: 900,
          max_scale: 1.2
        }
      }
    };

    const hash1 = registry.computeInstanceHash(baseAnimation);
    const hash2 = registry.computeInstanceHash(overriddenAnimation);

    if (hash1 === hash2) {
      console.error('❌ Override handling: Overridden animation has same hash as base');
      failed++;
    } else {
      console.log('✅ Override handling: Overridden animations have different hashes');
      passed++;
    }

  } catch (error) {
    console.error('❌ Override handling test failed:', error.message);
    failed++;
  }

  // Test 6: Performance statistics accuracy
  try {
    const registry = new AnimationRegistry();

    // Create some instances
    registry.getOrCreateInstance(testAnimations.simpleFade, ['#target1']);
    registry.getOrCreateInstance(testAnimations.simpleFade, ['#target1']); // Should reuse
    registry.getOrCreateInstance(testAnimations.complexPulse, ['#target2']); // New

    const stats = registry.getStats();

    if (stats.instancesCreated !== 2) {
      console.error('❌ Performance stats: Incorrect instancesCreated count');
      console.error(`   Expected: 2, Got: ${stats.instancesCreated}`);
      failed++;
    } else if (stats.instancesReused !== 1) {
      console.error('❌ Performance stats: Incorrect instancesReused count');
      console.error(`   Expected: 1, Got: ${stats.instancesReused}`);
      failed++;
    } else if (stats.hitRate < 0.3 || stats.hitRate > 0.4) {
      console.error('❌ Performance stats: Incorrect hit rate calculation');
      console.error(`   Expected: ~0.33, Got: ${stats.hitRate}`);
      failed++;
    } else {
      console.log('✅ Performance stats: All metrics calculated correctly');
      console.log(`   Hit rate: ${(stats.hitRate * 100).toFixed(1)}%, Reuse rate: ${(stats.reuseRate * 100).toFixed(1)}%`);
      passed++;
    }

  } catch (error) {
    console.error('❌ Performance statistics test failed:', error.message);
    failed++;
  }

  const total = passed + failed;
  console.log(`\n📊 Animation Registry Results: ${passed}/${total} passed`);

  if (failed === 0) {
    console.log('✅ Animation registry test PASSED');
    console.log('   ✓ Semantic hashing provides deterministic animation identification');
    console.log('   ✓ Parameter normalization prevents precision-based hash churn');
    console.log('   ✓ Compatible animations reuse instances for performance optimization');
    console.log('   ✓ Cache cleanup maintains memory efficiency');
    console.log('   ✓ Override handling correctly differentiates animation variants');
    console.log('   ✓ Performance statistics provide accurate reuse metrics');
    return { passed: true };
  } else {
    console.error('❌ Animation registry test FAILED');
    return { passed: false, error: `${failed}/${total} animation registry checks failed` };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAnimationRegistryTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runAnimationRegistryTest };
