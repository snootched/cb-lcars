/**
 * Test enhanced anchor provenance functionality
 * Verifies origin type detection and comprehensive override tracking
 */

import { mergePacks } from '../../src/msd/packs/mergePacks.js';

const testCases = [
  {
    name: 'SVG anchor detection from builtin pack',
    userConfig: {
      version: 1,
      use_packs: {
        builtin: ['core']  // Core pack has simulated SVG anchors
      }
    },
    expectations: {
      'svg_bridge': {
        origin_type: 'svg',
        origin_pack: 'core',
        overridden: false,
        coordinates: [200, 150]
      },
      'svg_warp': {
        origin_type: 'svg',
        origin_pack: 'core',
        overridden: false,
        coordinates: [350, 200]
      }
    }
  },

  {
    name: 'User anchor override of SVG anchor',
    userConfig: {
      version: 1,
      use_packs: {
        builtin: ['core']
      },
      anchors: {
        svg_bridge: [180, 140]  // Override SVG anchor
      }
    },
    expectations: {
      'svg_bridge': {
        origin_type: 'svg',        // Original was SVG
        origin_pack: 'core',       // Originally from core
        overridden: true,          // Now overridden
        override_source: 'user_config',
        override_type: 'user',
        coordinates: [180, 140],   // New coordinates
        previous_coordinates: [200, 150]  // Original coordinates
      }
    }
  },

  {
    name: 'New user-defined anchor',
    userConfig: {
      version: 1,
      use_packs: {
        builtin: ['core']
      },
      anchors: {
        user_cpu: [120, 80],     // New user anchor
        user_mem: ['60%', '40%'] // New user anchor with percentages
      }
    },
    expectations: {
      'user_cpu': {
        origin_type: 'user',
        origin_pack: 'user_config',
        overridden: false,
        coordinates: [120, 80]
      },
      'user_mem': {
        origin_type: 'user',
        origin_pack: 'user_config',
        overridden: false,
        coordinates: ['60%', '40%']
      }
    }
  },

  {
    name: 'Override history tracking',
    userConfig: {
      version: 1,
      use_packs: {
        builtin: ['core']
      },
      anchors: {
        svg_bridge: [180, 140]  // Override SVG anchor
      }
    },
    checkOverrideHistory: true
  }
];

async function runAnchorProvenanceTest() {
  console.log('⚓ Running anchor provenance test...');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = await mergePacks(testCase.userConfig);

      if (testCase.expectations) {
        // Test anchor provenance
        let casePass = true;

        for (const [anchorId, expectedProvenance] of Object.entries(testCase.expectations)) {
          const actualProvenance = result.__provenance.anchors[anchorId];

          if (!actualProvenance) {
            console.error(`❌ ${testCase.name}: Missing provenance for anchor '${anchorId}'`);
            casePass = false;
            continue;
          }

          // Check each expected property
          for (const [prop, expectedValue] of Object.entries(expectedProvenance)) {
            const actualValue = actualProvenance[prop];

            if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
              console.error(`❌ ${testCase.name}: ${anchorId}.${prop} expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
              casePass = false;
            }
          }

          // Verify coordinates are also set in the actual anchors
          const actualCoordinates = result.anchors[anchorId];
          const expectedCoordinates = expectedProvenance.coordinates;
          if (JSON.stringify(actualCoordinates) !== JSON.stringify(expectedCoordinates)) {
            console.error(`❌ ${testCase.name}: ${anchorId} coordinates expected ${JSON.stringify(expectedCoordinates)}, got ${JSON.stringify(actualCoordinates)}`);
            casePass = false;
          }
        }

        if (casePass) {
          console.log(`✅ ${testCase.name}: Anchor provenance correctly tracked`);
          passed++;
        } else {
          failed++;
        }
      }

      if (testCase.checkOverrideHistory) {
        // Test override history tracking
        const bridgeProvenance = result.__provenance.anchors.svg_bridge;

        if (bridgeProvenance.override_history &&
            bridgeProvenance.override_history.length > 0 &&
            bridgeProvenance.override_history[0].pack === 'user_config' &&
            bridgeProvenance.override_history[0].type === 'user') {
          console.log(`✅ ${testCase.name}: Override history correctly tracked`);
          passed++;
        } else {
          console.error(`❌ ${testCase.name}: Override history missing or incorrect`, bridgeProvenance.override_history);
          failed++;
        }
      }

    } catch (error) {
      console.error(`❌ ${testCase.name}: Runtime error:`, error.message);
      failed++;
    }
  }

  const total = passed + failed;
  console.log(`\n📊 Anchor Provenance Results: ${passed}/${total} passed`);

  if (failed === 0) {
    console.log('✅ Anchor provenance test PASSED');
    console.log('   ✓ SVG anchor origin type correctly detected');
    console.log('   ✓ User anchor overrides tracked with history');
    console.log('   ✓ Origin pack and coordinates preserved');
    console.log('   ✓ Override chain maintains complete history');
    return { passed: true };
  } else {
    console.error('❌ Anchor provenance test FAILED');
    return { passed: false, error: `${failed}/${total} test cases failed` };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAnchorProvenanceTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runAnchorProvenanceTest };
