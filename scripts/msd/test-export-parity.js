/**
 * Test export/import parity
 * Ensure exported configs can be re-imported with same semantic result
 */

import { mergePacks, exportCollapsed } from '../../src/msd/packs/mergePacks.js';
import { semanticEquals } from '../../src/msd/util/checksum.js';

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
        value: 'Test Export',
        color: 'var(--lcars-orange)'
      }
    },
    {
      id: 'anchored_overlay',
      type: 'line',
      anchor: 'cpu',
      attach_to: [100, 100],
      style: {
        color: 'var(--lcars-yellow)',
        width: 3
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
  ],
  palettes: {
    custom: {
      primary: '#ff6600',
      secondary: '#ffcc00'
    }
  }
};

async function runExportParityTest() {
  console.log('📤 Running export parity test...');

  try {
    // Original merge
    const original = await mergePacks(JSON.parse(JSON.stringify(testConfig)));
    console.log(`   Original checksum: ${original.checksum}`);

    // Export collapsed
    const collapsed = exportCollapsed(testConfig);
    console.log('   ✓ Export collapsed completed');

    // Re-merge exported config
    const reimported = await mergePacks(collapsed);
    console.log(`   Reimported checksum: ${reimported.checksum}`);

    // Compare semantic content (excluding metadata)
    const semanticallyEqual = semanticEquals(original, reimported);

    if (semanticallyEqual) {
      console.log('✅ Export parity test PASSED');
      console.log('   Exported config produces identical semantic result');
      return {
        passed: true,
        originalChecksum: original.checksum,
        reimportedChecksum: reimported.checksum
      };
    } else {
      console.error('❌ Export parity test FAILED');
      console.error('   Semantic differences detected between original and reimported');

      // Detailed comparison for debugging
      const diffs = findSemanticDifferences(original, reimported);
      diffs.forEach(diff => console.error(`     ${diff}`));

      return {
        passed: false,
        error: 'Semantic differences found',
        diffs
      };
    }

  } catch (error) {
    console.error('❌ Export parity test ERROR:', error);
    return { passed: false, error: error.message };
  }
}

function findSemanticDifferences(obj1, obj2, path = '') {
  const differences = [];

  // Skip metadata fields
  const skipFields = ['__provenance', '__performance', 'checksum'];

  const keys = new Set([
    ...Object.keys(obj1 || {}),
    ...Object.keys(obj2 || {})
  ]);

  for (const key of keys) {
    if (skipFields.includes(key)) continue;

    const newPath = path ? `${path}.${key}` : key;

    if (!(key in obj1)) {
      differences.push(`Missing in original: ${newPath}`);
    } else if (!(key in obj2)) {
      differences.push(`Missing in reimported: ${newPath}`);
    } else if (typeof obj1[key] !== typeof obj2[key]) {
      differences.push(`Type mismatch at ${newPath}: ${typeof obj1[key]} vs ${typeof obj2[key]}`);
    } else if (typeof obj1[key] === 'object' && obj1[key] !== null) {
      differences.push(...findSemanticDifferences(obj1[key], obj2[key], newPath));
    } else if (obj1[key] !== obj2[key]) {
      differences.push(`Value mismatch at ${newPath}: ${obj1[key]} vs ${obj2[key]}`);
    }
  }

  return differences;
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExportParityTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runExportParityTest };
