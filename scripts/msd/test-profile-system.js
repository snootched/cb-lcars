/**
 * Test profile system consolidation and value_map resolution
 * Verifies centralized style resolution with proper precedence
 */

import { ProfileResolver } from '../../src/msd/profile/ProfileResolver.js';
import { ValueMapResolver } from '../../src/msd/profile/ValueMapResolver.js';

// Test profiles for layering
const testProfiles = [
  {
    id: 'normal',
    defaults: {
      line: { color: 'var(--lcars-orange)', width: 2 },
      text: { color: 'var(--lcars-orange)', font_size: 14 }
    }
  },
  {
    id: 'red_alert',
    defaults: {
      line: { color: 'var(--lcars-red)', width: 3 },
      text: { color: 'var(--lcars-red)', font_size: 16 }
    },
    overlays: {
      'status_text': { color: 'yellow', blink: true }
    }
  },
  {
    id: 'night_mode',
    defaults: {
      line: { color: 'var(--lcars-cyan)', opacity: 0.7 },
      text: { color: 'var(--lcars-cyan)', opacity: 0.8 }
    }
  }
];

// Test overlays for resolution
const testOverlays = [
  {
    id: 'cpu_line',
    type: 'line',
    style: {
      color: 'blue', // Base color, should be overridden by profiles
      width: 1       // Base width, should be overridden
    }
  },
  {
    id: 'status_text',
    type: 'text',
    style: {
      color: 'green',
      font_size: 12
    }
  },
  {
    id: 'temp_display',
    type: 'text',
    style: {
      color: 'white',
      font_size: 10,
      width: {
        value_map: {
          entity: 'sensor.cpu_temp',
          input: [20, 90],
          output: [1, 6],
          clamp: true,
          round: 0
        }
      }
    }
  }
];

// Mock entity resolver
const mockEntities = {
  'sensor.cpu_temp': { state: '65', attributes: { unit: '°C' } },
  'sensor.memory_usage': { state: '75.5', attributes: { unit: '%' } }
};

function mockEntityResolver(entityId) {
  return mockEntities[entityId] || null;
}

async function runProfileSystemTest() {
  console.log('🎨 Running profile system consolidation test...');

  let passed = 0;
  let failed = 0;

  // Test 1: Profile loading and indexing
  try {
    const resolver = new ProfileResolver();
    resolver.loadProfiles(testProfiles);

    const availableProfiles = resolver.getAvailableProfiles();

    if (availableProfiles.length !== testProfiles.length) {
      console.error('❌ Profile loading: Incorrect number of profiles loaded');
      console.error(`   Expected: ${testProfiles.length}, Got: ${availableProfiles.length}`);
      failed++;
    } else if (!availableProfiles.includes('normal') || !availableProfiles.includes('red_alert')) {
      console.error('❌ Profile loading: Missing expected profile IDs');
      console.error(`   Available: ${availableProfiles}`);
      failed++;
    } else {
      console.log('✅ Profile loading: All profiles loaded and indexed correctly');
      passed++;
    }

  } catch (error) {
    console.error('❌ Profile loading test failed:', error.message);
    failed++;
  }

  // Test 2: Active profile precedence
  try {
    const resolver = new ProfileResolver();
    resolver.loadProfiles(testProfiles);
    resolver.setActiveProfiles(['normal', 'red_alert']); // red_alert should override normal

    const resolved = resolver.resolveOverlayStyles(testOverlays);
    const cpuLine = resolved.find(o => o.id === 'cpu_line');

    if (!cpuLine || !cpuLine.style) {
      console.error('❌ Profile precedence: CPU line overlay not found or missing style');
      failed++;
    } else if (cpuLine.style.color !== 'var(--lcars-red)') {
      console.error('❌ Profile precedence: red_alert profile should override normal profile');
      console.error(`   Expected: var(--lcars-red), Got: ${cpuLine.style.color}`);
      failed++;
    } else if (cpuLine.style.width !== 3) {
      console.error('❌ Profile precedence: red_alert width should override normal width');
      console.error(`   Expected: 3, Got: ${cpuLine.style.width}`);
      failed++;
    } else {
      console.log('✅ Profile precedence: Later profiles correctly override earlier ones');
      passed++;
    }

  } catch (error) {
    console.error('❌ Profile precedence test failed:', error.message);
    failed++;
  }

  // Test 3: Overlay-specific profile overrides
  try {
    const resolver = new ProfileResolver();
    resolver.loadProfiles(testProfiles);
    resolver.setActiveProfiles(['normal', 'red_alert']);

    const resolved = resolver.resolveOverlayStyles(testOverlays);
    const statusText = resolved.find(o => o.id === 'status_text');

    if (!statusText || !statusText.style) {
      console.error('❌ Overlay-specific overrides: Status text overlay not found');
      failed++;
    } else if (statusText.style.color !== 'yellow') {
      console.error('❌ Overlay-specific overrides: Overlay-specific style not applied');
      console.error(`   Expected: yellow, Got: ${statusText.style.color}`);
      failed++;
    } else if (!statusText.style.blink) {
      console.error('❌ Overlay-specific overrides: Overlay-specific properties missing');
      console.error(`   Expected blink: true, Got: ${statusText.style.blink}`);
      failed++;
    } else {
      console.log('✅ Overlay-specific overrides: Profile-specific overlay styles applied correctly');
      passed++;
    }

  } catch (error) {
    console.error('❌ Overlay-specific overrides test failed:', error.message);
    failed++;
  }

  // Test 4: Value_map resolution
  try {
    const valueMapResolver = new ValueMapResolver();

    const resolved = valueMapResolver.resolveOverlayValueMaps(testOverlays, mockEntityResolver);
    const tempDisplay = resolved.find(o => o.id === 'temp_display');

    if (!tempDisplay || !tempDisplay.style) {
      console.error('❌ Value_map resolution: Temp display overlay not found');
      failed++;
    } else {
      const resolvedWidth = tempDisplay.style.width;

      // CPU temp is 65, mapped from [20,90] to [1,6] should be approximately 3.86, rounded to 4
      const expectedWidth = 4;

      if (resolvedWidth !== expectedWidth) {
        console.error('❌ Value_map resolution: Incorrect value mapping result');
        console.error(`   Expected: ${expectedWidth}, Got: ${resolvedWidth}`);
        console.error(`   Entity value: ${mockEntities['sensor.cpu_temp'].state}`);
        failed++;
      } else {
        console.log('✅ Value_map resolution: Entity state correctly mapped to style value');
        console.log(`   CPU temp ${mockEntities['sensor.cpu_temp'].state} → width ${resolvedWidth}`);
        passed++;
      }
    }

  } catch (error) {
    console.error('❌ Value_map resolution test failed:', error.message);
    failed++;
  }

  // Test 5: Style caching performance
  try {
    const resolver = new ProfileResolver();
    resolver.loadProfiles(testProfiles);
    resolver.setActiveProfiles(['normal', 'red_alert']);

    // Resolve styles twice - second time should hit cache
    resolver.resolveOverlayStyles(testOverlays);
    resolver.resolveOverlayStyles(testOverlays);

    const stats = resolver.getStats();

    if (stats.cacheHits === 0) {
      console.error('❌ Style caching: No cache hits detected on repeated resolution');
      console.error(`   Stats: ${JSON.stringify(stats)}`);
      failed++;
    } else if (stats.hitRate < 0.5) {
      console.error('❌ Style caching: Cache hit rate too low');
      console.error(`   Hit rate: ${stats.hitRate}, Expected: >0.5`);
      failed++;
    } else {
      console.log('✅ Style caching: Style resolution results cached for performance');
      console.log(`   Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      passed++;
    }

  } catch (error) {
    console.error('❌ Style caching test failed:', error.message);
    failed++;
  }

  // Test 6: Cache invalidation on profile changes
  try {
    const resolver = new ProfileResolver();
    resolver.loadProfiles(testProfiles);
    resolver.setActiveProfiles(['normal']);

    // Resolve with normal profile
    const normalResult = resolver.resolveOverlayStyles(testOverlays);
    const normalCpuLine = normalResult.find(o => o.id === 'cpu_line');

    // Change active profiles
    resolver.setActiveProfiles(['red_alert']);

    // Resolve again - should invalidate cache and use red_alert
    const redAlertResult = resolver.resolveOverlayStyles(testOverlays);
    const redAlertCpuLine = redAlertResult.find(o => o.id === 'cpu_line');

    if (normalCpuLine.style.color === redAlertCpuLine.style.color) {
      console.error('❌ Cache invalidation: Profile change did not invalidate cache');
      console.error(`   Both results have color: ${normalCpuLine.style.color}`);
      failed++;
    } else {
      console.log('✅ Cache invalidation: Profile changes correctly invalidate style cache');
      console.log(`   Normal: ${normalCpuLine.style.color} → Red Alert: ${redAlertCpuLine.style.color}`);
      passed++;
    }

  } catch (error) {
    console.error('❌ Cache invalidation test failed:', error.message);
    failed++;
  }

  const total = passed + failed;
  console.log(`\n📊 Profile System Results: ${passed}/${total} passed`);

  if (failed === 0) {
    console.log('✅ Profile system consolidation test PASSED');
    console.log('   ✓ Profiles load and index correctly for fast lookup');
    console.log('   ✓ Active profile precedence works with later profiles overriding earlier ones');
    console.log('   ✓ Overlay-specific profile styles apply correctly');
    console.log('   ✓ Value_map resolution maps entity state to style values');
    console.log('   ✓ Style resolution results cached for performance optimization');
    console.log('   ✓ Cache invalidation works when active profiles change');
    return { passed: true };
  } else {
    console.error('❌ Profile system consolidation test FAILED');
    return { passed: false, error: `${failed}/${total} profile system checks failed` };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runProfileSystemTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runProfileSystemTest };
