/**
 * Test export parity - ensure exported configs re-import to identical semantic results
 * Critical for configuration portability and backup/restore functionality
 */

import { mergePacks } from '../../src/msd/packs/mergePacks.js';
import { exportCollapsed, exportFullSnapshot, exportConfigDiff } from '../../src/msd/export/exportEnhanced.js';

const testConfigs = [
  {
    name: 'Basic Configuration',
    config: {
      version: 1,
      anchors: {
        cpu: [120, 80],
        mem: [180, 120]
      },
      palettes: {
        theme: {
          primary: '#orange',
          secondary: '#yellow'
        }
      },
      overlays: [
        {
          id: 'cpu_text',
          type: 'text',
          anchor: 'cpu',
          style: { value: 'CPU', color: 'theme.primary' }
        }
      ]
    }
  },

  {
    name: 'Complex Configuration with External Packs',
    config: {
      version: 1,
      use_packs: {
        builtin: ['core']
      },
      anchors: {
        custom_point: ['50%', '75%']
      },
      palettes: {
        default: {
          accent1: '#ff6600'  // Override core token
        },
        custom: {
          brand: '#blue',
          accent: '#green'
        }
      },
      overlays: [
        {
          id: 'title',
          type: 'text',
          position: [40, 40],
          style: { value: 'System Status', font_size: 18 }
        },
        {
          id: 'cpu_line',
          type: 'line',
          anchor: 'svg_bridge',
          attach_to: 'custom_point',
          style: { color: 'custom.brand', width: 2 }
        }
      ],
      rules: [
        {
          id: 'temp_check',
          when: { all: [{ entity: 'sensor.cpu_temp', above: 70 }] },
          apply: {
            overlays: [{ id: 'cpu_line', style: { color: '#red' } }]
          }
        }
      ]
    }
  }
];

async function runExportParityTest() {
  console.log('📦 Running export parity tests...');

  let passed = 0;
  let failed = 0;

  for (const testSpec of testConfigs) {
    console.log(`\n🔍 Testing: ${testSpec.name}`);

    try {
      // Test 1: Collapsed export/import parity
      let testPassed = await testCollapsedParity(testSpec);
      if (testPassed) {
        console.log('✅ Collapsed export parity: PASSED');
        passed++;
      } else {
        console.error('❌ Collapsed export parity: FAILED');
        failed++;
      }

      // Test 2: Full snapshot export completeness
      testPassed = await testFullSnapshotCompleteness(testSpec);
      if (testPassed) {
        console.log('✅ Full snapshot completeness: PASSED');
        passed++;
      } else {
        console.error('❌ Full snapshot completeness: FAILED');
        failed++;
      }

      // Test 3: Config diff accuracy
      testPassed = await testConfigDiffAccuracy(testSpec);
      if (testPassed) {
        console.log('✅ Config diff accuracy: PASSED');
        passed++;
      } else {
        console.error('❌ Config diff accuracy: FAILED');
        failed++;
      }

      // Test 4: Export determinism
      testPassed = await testExportDeterminism(testSpec);
      if (testPassed) {
        console.log('✅ Export determinism: PASSED');
        passed++;
      } else {
        console.error('❌ Export determinism: FAILED');
        failed++;
      }

    } catch (error) {
      console.error(`❌ ${testSpec.name}: Runtime error:`, error.message);
      failed += 4; // All 4 sub-tests failed
    }
  }

  const total = passed + failed;
  console.log(`\n📊 Export Parity Results: ${passed}/${total} passed`);

  if (failed === 0) {
    console.log('✅ Export parity test PASSED');
    console.log('   ✓ Collapsed configs re-import to identical semantic results');
    console.log('   ✓ Full snapshots preserve all requested metadata');
    console.log('   ✓ Config diffs accurately identify changes');
    console.log('   ✓ Export output is deterministic and canonical');
    return { passed: true };
  } else {
    console.error('❌ Export parity test FAILED');
    return { passed: false, error: `${failed}/${total} export checks failed` };
  }
}

async function testCollapsedParity(testSpec) {
  try {
    // Merge original config
    const originalMerged = await mergePacks(testSpec.config);

    // Export collapsed (user layer only)
    const exportedJson = exportCollapsed(testSpec.config, {
      stripMeta: true,
      canonicalize: true
    });
    const exportedConfig = JSON.parse(exportedJson);

    // Re-import and merge
    const reimportedMerged = await mergePacks(exportedConfig);

    // Compare semantic results (excluding metadata)
    const originalSemantic = extractSemanticContent(originalMerged);
    const reimportedSemantic = extractSemanticContent(reimportedMerged);

    const semanticMatch = JSON.stringify(originalSemantic) === JSON.stringify(reimportedSemantic);

    if (!semanticMatch) {
      console.error('   Semantic content mismatch after re-import');
      console.error('   Original keys:', Object.keys(originalSemantic));
      console.error('   Reimported keys:', Object.keys(reimportedSemantic));
    }

    return semanticMatch;

  } catch (error) {
    console.error('   Collapsed parity test error:', error.message);
    return false;
  }
}

async function testFullSnapshotCompleteness(testSpec) {
  try {
    const merged = await mergePacks(testSpec.config);

    // Test different snapshot options
    const options = [
      { includeProvenance: true, includePerformance: false, includeInternal: false },
      { includeProvenance: true, includePerformance: true, includeInternal: true },
      { includeProvenance: false, includePerformance: false, includeInternal: false }
    ];

    for (const option of options) {
      const snapshotJson = exportFullSnapshot(merged, option);
      const snapshot = JSON.parse(snapshotJson);

      // Verify structure
      if (!snapshot.timestamp || !snapshot.version || !snapshot.config) {
        console.error('   Missing required snapshot fields');
        return false;
      }

      // Verify options respected
      if (option.includeProvenance && !snapshot.provenance) {
        console.error('   Provenance requested but not included');
        return false;
      }

      if (!option.includeProvenance && snapshot.provenance) {
        console.error('   Provenance not requested but included');
        return false;
      }

      if (option.includePerformance && !snapshot.performance) {
        console.error('   Performance data requested but not included');
        return false;
      }
    }

    return true;

  } catch (error) {
    console.error('   Full snapshot test error:', error.message);
    return false;
  }
}

async function testConfigDiffAccuracy(testSpec) {
  try {
    const originalMerged = await mergePacks(testSpec.config);

    // Create modified config
    const modifiedConfig = structuredClone(testSpec.config);

    // Make some changes
    if (modifiedConfig.overlays && modifiedConfig.overlays.length > 0) {
      modifiedConfig.overlays[0].style.color = '#modified';
    }

    modifiedConfig.overlays = modifiedConfig.overlays || [];
    modifiedConfig.overlays.push({
      id: 'new_overlay',
      type: 'text',
      position: [100, 100],
      style: { value: 'New' }
    });

    const modifiedMerged = await mergePacks(modifiedConfig);

    // Generate diff
    const diffJson = exportConfigDiff(originalMerged, modifiedMerged);
    const diff = JSON.parse(diffJson);

    // Verify diff structure
    if (!diff.comparison || !diff.changes) {
      console.error('   Diff missing required structure');
      return false;
    }

    // Should not be identical
    if (diff.comparison.identical) {
      console.error('   Diff incorrectly reports configs as identical');
      return false;
    }

    // Should detect added overlay
    if (!diff.changes.collections?.overlays?.added?.some(o => o.id === 'new_overlay')) {
      console.error('   Diff failed to detect added overlay');
      return false;
    }

    return true;

  } catch (error) {
    console.error('   Config diff test error:', error.message);
    return false;
  }
}

async function testExportDeterminism(testSpec) {
  try {
    const merged = await mergePacks(testSpec.config);

    // Export same config multiple times
    const exports = [];
    for (let i = 0; i < 5; i++) {
      const exported = exportCollapsed(testSpec.config, {
        stripMeta: true,
        canonicalize: true
      });
      exports.push(exported);
    }

    // All exports should be identical
    const allIdentical = exports.every(exp => exp === exports[0]);

    if (!allIdentical) {
      console.error('   Export output not deterministic');
      console.error('   First:', exports[0].substring(0, 100));
      console.error('   Different:', exports.find(e => e !== exports[0])?.substring(0, 100));
    }

    return allIdentical;

  } catch (error) {
    console.error('   Export determinism test error:', error.message);
    return false;
  }
}

function extractSemanticContent(mergedConfig) {
  const semantic = {};
  const semanticFields = [
    'version', 'anchors', 'palettes', 'overlays',
    'rules', 'animations', 'profiles', 'active_profiles'
  ];

  semanticFields.forEach(field => {
    if (mergedConfig[field] !== undefined) {
      // Deep clone and sort for consistent comparison
      semantic[field] = canonicalizeForComparison(mergedConfig[field]);
    }
  });

  return semantic;
}

function canonicalizeForComparison(value) {
  if (!value || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(canonicalizeForComparison).sort((a, b) => {
      // Sort arrays by id if available, otherwise by stringified content
      const aKey = a.id || JSON.stringify(a);
      const bKey = b.id || JSON.stringify(b);
      return aKey.localeCompare(bKey);
    });
  }

  const canonical = {};
  Object.keys(value).sort().forEach(key => {
    canonical[key] = canonicalizeForComparison(value[key]);
  });

  return canonical;
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExportParityTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runExportParityTest };
