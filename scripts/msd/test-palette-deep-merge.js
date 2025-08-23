/**
 * Test token-level palette merge functionality
 * Verifies individual tokens merge without losing others
 */

import { mergePacks } from '../../src/msd/packs/mergePacks.js';

const testCases = [
  {
    name: 'Basic token preservation',
    userConfig: {
      version: 1,
      use_packs: {
        builtin: ['core']  // Core pack has default palette
      },
      palettes: {
        default: {
          accent1: '#ff6600'  // Override only accent1
        }
      }
    },
    expectations: {
      'default.accent1': '#ff6600',      // Overridden
      'default.accent2': 'var(--lcars-yellow)',  // Preserved from core
      'default.danger': 'var(--lcars-red)',      // Preserved from core
      'default.info': 'var(--lcars-cyan)'        // Preserved from core
    }
  },

  {
    name: 'Multiple token override',
    userConfig: {
      version: 1,
      use_packs: {
        builtin: ['core']
      },
      palettes: {
        default: {
          accent1: '#ff6600',
          danger: '#cc0000'   // Override two tokens
        }
      }
    },
    expectations: {
      'default.accent1': '#ff6600',      // Overridden
      'default.accent2': 'var(--lcars-yellow)',  // Preserved
      'default.danger': '#cc0000',        // Overridden
      'default.info': 'var(--lcars-cyan)'        // Preserved
    }
  },

  {
    name: 'New palette creation',
    userConfig: {
      version: 1,
      use_packs: {
        builtin: ['core']
      },
      palettes: {
        custom: {
          primary: '#blue',
          secondary: '#green'
        }
      }
    },
    expectations: {
      'default.accent1': 'var(--lcars-orange)',  // Core preserved
      'custom.primary': '#blue',                 // New palette
      'custom.secondary': '#green'               // New palette
    }
  },

  {
    name: 'Provenance tracking accuracy',
    userConfig: {
      version: 1,
      use_packs: {
        builtin: ['core']
      },
      palettes: {
        default: {
          accent1: '#ff6600'
        }
      }
    },
    checkProvenance: true
  }
];

async function runPaletteDeepMergeTest() {
  console.log('🎨 Running palette deep merge test...');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = await mergePacks(testCase.userConfig);

      if (testCase.expectations) {
        // Test token values
        let casePass = true;

        for (const [tokenPath, expectedValue] of Object.entries(testCase.expectations)) {
          const [paletteName, tokenName] = tokenPath.split('.');
          const actualValue = result.palettes[paletteName]?.[tokenName];

          if (actualValue !== expectedValue) {
            console.error(`❌ ${testCase.name}: ${tokenPath} expected '${expectedValue}', got '${actualValue}'`);
            casePass = false;
          }
        }

        if (casePass) {
          console.log(`✅ ${testCase.name}: All tokens correctly preserved/overridden`);
          passed++;
        } else {
          failed++;
        }
      }

      if (testCase.checkProvenance) {
        // Test provenance tracking
        const provenance = result.__provenance.palettes.default;
        const tokenProv = provenance.tokens.accent1;

        if (tokenProv.overridden && tokenProv.override_pack === 'user_config') {
          console.log(`✅ ${testCase.name}: Provenance correctly tracked`);
          passed++;
        } else {
          console.error(`❌ ${testCase.name}: Provenance tracking failed`, tokenProv);
          failed++;
        }
      }

    } catch (error) {
      console.error(`❌ ${testCase.name}: Runtime error:`, error.message);
      failed++;
    }
  }

  const total = passed + failed;
  console.log(`\n📊 Palette Deep Merge Results: ${passed}/${total} passed`);

  if (failed === 0) {
    console.log('✅ Palette deep merge test PASSED');
    console.log('   ✓ Individual tokens preserved across layers');
    console.log('   ✓ Token-level provenance tracked accurately');
    console.log('   ✓ Multiple palettes supported');
    return { passed: true };
  } else {
    console.error('❌ Palette deep merge test FAILED');
    return { passed: false, error: `${failed}/${total} test cases failed` };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPaletteDeepMergeTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runPaletteDeepMergeTest };
