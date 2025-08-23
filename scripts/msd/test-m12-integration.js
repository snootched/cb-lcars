/**
 * Comprehensive M1.2 Integration Test
 * Verifies token-level palette merge, anchor provenance, and external packs work together
 */

import { mergePacks } from '../../src/msd/packs/mergePacks.js';

const complexIntegrationConfig = {
  version: 1,
  use_packs: {
    builtin: ['core'],
    external: ['https://example.com/packs/success'] // Will be mocked
  },
  anchors: {
    svg_bridge: [180, 140],  // Override SVG anchor from core pack
    user_anchor: [300, 250]  // New user anchor
  },
  palettes: {
    default: {
      accent1: '#ff6600',      // Override core token
      user_token: '#purple'    // New user token
    },
    custom: {
      primary: '#blue',
      secondary: '#green'
    }
  },
  overlays: [
    {
      id: 'integration_overlay',
      type: 'text',
      anchor: 'user_anchor',
      style: {
        value: 'Integration Test',
        color: 'palette:default.accent1'
      }
    }
  ]
};

// Fixed mock external pack response
const mockExternalPack = {
  version: 1,
  anchors: {
    external_anchor: [400, 300]
  },
  palettes: {
    default: {
      accent2: '#external_yellow',  // Override core token from external
      external_token: '#cyan'       // New external token
    }
  },
  overlays: [
    {
      id: 'external_overlay',
      type: 'line',
      position: [100, 100],
      style: { color: '#external' }
    }
  ]
};

// Setup mock fetch for integration test - Enhanced for new external pack system
const originalFetch = global.fetch;

function createIntegrationMockFetch() {
  return async (url) => {
    if (url.includes('success')) {
      // Return proper Response-like object that matches our fetchWithValidation expectations
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (header) => {
            if (header.toLowerCase() === 'content-type') {
              return 'application/json';
            }
            return null;
          }
        },
        text: () => Promise.resolve(JSON.stringify(mockExternalPack))
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
}

async function runM12IntegrationTest() {
  console.log('🔧 Running M1.2 comprehensive integration test...');

  let passed = 0;
  let failed = 0;

  try {
    // Setup mock fetch
    global.fetch = createIntegrationMockFetch();

    // Clear external pack cache completely to ensure fresh load
    const debugNamespace = (typeof window !== 'undefined') ? window : global;
    if (debugNamespace.__msdDebug) {
      debugNamespace.__msdDebug._lastExternalPackPerf = null;
    }

    // Access the cache directly from the module to clear it
    const { externalPackCache } = await import('../../src/msd/packs/mergePacks.js');
    if (externalPackCache && externalPackCache.clear) {
      externalPackCache.clear();
    }

    const result = await mergePacks(complexIntegrationConfig);

    console.log('📊 Integration test analyzing merged result...');

    // Debug: Log what we actually got
    console.log('Debug - External pack results:');
    console.log('- Anchors:', Object.keys(result.anchors));
    console.log('- Palettes:', JSON.stringify(result.palettes, null, 2));
    console.log('- Overlays:', result.overlays.map(o => o.id));

    // Debug performance data
    const perfData = debugNamespace.__msdDebug?._lastExternalPackPerf;
    console.log('- Performance data:', perfData);

    // Debug: Show merge order
    console.log('- Merge order:', result.__provenance?.merge_order);

    // Test 1: Token-level palette merge preservation
    let testPass = true;

    // Expected tokens based on layer priority: builtin(100) -> external(200) -> user(1000)
    const expectedTokens = {
      'default.accent1': '#ff6600',              // User override (highest priority)
      'default.accent2': '#external_yellow',     // External override of core (middle priority)
      'default.danger': 'var(--lcars-red)',     // Core preserved (lowest priority)
      'default.info': 'var(--lcars-cyan)',      // Core preserved
      'default.user_token': '#purple',           // User addition
      'default.external_token': '#cyan',         // External addition
      'custom.primary': '#blue',                 // User palette
      'custom.secondary': '#green'               // User palette
    };

    for (const [tokenPath, expectedValue] of Object.entries(expectedTokens)) {
      const [paletteName, tokenName] = tokenPath.split('.');
      const actualValue = result.palettes[paletteName]?.[tokenName];

      if (actualValue !== expectedValue) {
        console.error(`❌ Token merge: ${tokenPath} expected '${expectedValue}', got '${actualValue}'`);
        console.error(`   Palette: ${JSON.stringify(result.palettes[paletteName])}`);
        testPass = false;
      }
    }

    if (testPass) {
      console.log('✅ Token-level palette merge: All tokens correctly preserved/overridden');
      passed++;
    } else {
      failed++;
    }

    // Test 2: Anchor provenance tracking
    testPass = true;

    const expectedAnchors = {
      svg_bridge: {
        origin_type: 'svg',
        origin_pack: 'core',
        overridden: true,
        override_source: 'user_config',
        coordinates: [180, 140]
      },
      svg_warp: {
        origin_type: 'svg',
        origin_pack: 'core',
        overridden: false,
        coordinates: [350, 200]
      },
      user_anchor: {
        origin_type: 'user',
        origin_pack: 'user_config',
        overridden: false,
        coordinates: [300, 250]
      },
      external_anchor: {
        origin_type: 'pack',
        origin_pack: 'https://example.com/packs/success',
        overridden: false,
        coordinates: [400, 300]
      }
    };

    for (const [anchorId, expectedProv] of Object.entries(expectedAnchors)) {
      const actualProv = result.__provenance.anchors[anchorId];
      const actualCoords = result.anchors[anchorId];

      if (!actualProv) {
        console.error(`❌ Anchor provenance: Missing provenance for '${anchorId}'`);
        testPass = false;
        continue;
      }

      if (JSON.stringify(actualCoords) !== JSON.stringify(expectedProv.coordinates)) {
        console.error(`❌ Anchor coordinates: ${anchorId} expected ${JSON.stringify(expectedProv.coordinates)}, got ${JSON.stringify(actualCoords)}`);
        testPass = false;
      }

      for (const [prop, expectedValue] of Object.entries(expectedProv)) {
        if (prop === 'coordinates') continue; // Already checked
        if (actualProv[prop] !== expectedValue) {
          console.error(`❌ Anchor provenance: ${anchorId}.${prop} expected '${expectedValue}', got '${actualProv[prop]}'`);
          testPass = false;
        }
      }
    }

    if (testPass) {
      console.log('✅ Anchor provenance: All origins and overrides correctly tracked');
      passed++;
    } else {
      failed++;
    }

    // Test 3: External pack integration
    testPass = true;

    // Should have external overlay
    const hasExternalOverlay = result.overlays.some(o => o.id === 'external_overlay');
    if (!hasExternalOverlay) {
      console.error('❌ External pack integration: External overlay not found');
      console.error('Available overlays:', result.overlays.map(o => o.id));
      testPass = false;
    }

    // Should have external anchor
    if (!result.anchors.external_anchor) {
      console.error('❌ External pack integration: External anchor not found');
      console.error('Available anchors:', Object.keys(result.anchors));
      testPass = false;
    }

    // Check for performance tracking - Node.js compatible
    await new Promise(resolve => setTimeout(resolve, 10));
    const perfTrackingData = debugNamespace.__msdDebug?._lastExternalPackPerf;

    if (!perfTrackingData) {
      console.error('❌ External pack integration: No performance tracking data found');
      testPass = false;
    } else if (perfTrackingData.successful < 1) {
      console.error('❌ External pack integration: Performance tracking shows no successful loads:', perfTrackingData);
      testPass = false;
    }

    if (testPass) {
      console.log('✅ External pack integration: Pack loaded with performance tracking');
      passed++;
    } else {
      console.log('ℹ️  Debug - Performance data:', perfTrackingData);
      failed++;
    }

    // Test 4: Cross-feature interaction
    testPass = true;

    // User overlay should reference user anchor
    const userOverlay = result.overlays.find(o => o.id === 'integration_overlay');
    if (!userOverlay) {
      console.error('❌ Cross-feature: User overlay not found');
      testPass = false;
    } else if (userOverlay.anchor !== 'user_anchor') {
      console.error('❌ Cross-feature: User overlay anchor reference incorrect');
      testPass = false;
    }

    // Palette token reference should work (this would be resolved at render time)
    if (!userOverlay.style.color.includes('palette:default.accent1')) {
      console.error('❌ Cross-feature: Palette token reference not preserved');
      testPass = false;
    }

    if (testPass) {
      console.log('✅ Cross-feature interaction: All features work together correctly');
      passed++;
    } else {
      failed++;
    }

    // Test 5: Performance and determinism
    testPass = true;

    // Should have reasonable performance
    const mergeTime = result.__performance?.merge_time_ms || 0;
    if (mergeTime > 100) {
      console.error(`❌ Performance: Merge time ${mergeTime}ms exceeds 100ms threshold`);
      testPass = false;
    }

    // Should have deterministic checksum
    if (!result.checksum || result.checksum.length !== 10) {
      console.error('❌ Determinism: Invalid or missing checksum');
      testPass = false;
    }

    // Should have provenance merge order
    const mergeOrder = result.__provenance.merge_order;
    if (!Array.isArray(mergeOrder) || mergeOrder.length !== 3) { // core + external + user
      console.error('❌ Provenance: Merge order not properly tracked');
      console.error('   Expected 3 layers (core, external, user), got:', mergeOrder?.length);
      console.error('   Merge order:', mergeOrder);
      testPass = false;
    }

    if (testPass) {
      console.log(`✅ Performance & determinism: Merge time ${mergeTime.toFixed(2)}ms, checksum ${result.checksum}`);
      passed++;
    } else {
      failed++;
    }

  } catch (error) {
    console.error('❌ Integration test ERROR:', error);
    console.error('Stack:', error.stack);
    failed++;
  } finally {
    // Restore original fetch
    global.fetch = originalFetch;
  }

  const total = passed + failed;
  console.log(`\n📊 M1.2 Integration Results: ${passed}/${total} passed`);

  if (failed === 0) {
    console.log('✅ M1.2 INTEGRATION TEST PASSED');
    console.log('   ✓ Token-level palette merge working');
    console.log('   ✓ Enhanced anchor provenance complete');
    console.log('   ✓ External pack integration robust');
    console.log('   ✓ Cross-feature interactions stable');
    console.log('   ✓ Performance and determinism maintained');
    return { passed: true };
  } else {
    console.error('❌ M1.2 INTEGRATION TEST FAILED');
    return { passed: false, error: `${failed}/${total} integration checks failed` };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runM12IntegrationTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runM12IntegrationTest };
