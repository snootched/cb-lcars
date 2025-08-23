/**
 * Comprehensive anchor validation testing
 * Covers missing anchors, coordinate validation, percentage resolution
 * Converted from legacy testAnchorMissingWave2.js
 */

import { processMsdConfig } from '../../src/msd/index.js';

const testCases = [
  {
    name: 'Missing anchor reference in overlay',
    config: {
      version: 1,
      overlays: [
        {
          id: 'test_overlay',
          type: 'text',
          anchor: 'nonexistent_anchor',
          style: { value: 'Test' }
        }
      ]
    },
    expectedError: 'anchor.missing'
  },

  {
    name: 'Missing anchor in attach_to',
    config: {
      version: 1,
      overlays: [
        {
          id: 'line_overlay',
          type: 'line',
          position: [0, 0],
          attach_to: 'missing_anchor',
          style: { color: 'red' }
        }
      ]
    },
    expectedError: 'anchor.missing'
  },

  {
    name: 'Invalid anchor coordinates - single value',
    config: {
      version: 1,
      anchors: {
        invalid_anchor: [100] // Should be [x, y]
      }
    },
    expectedError: 'anchor.coordinates.invalid'
  },

  {
    name: 'Invalid anchor coordinates - wrong type',
    config: {
      version: 1,
      anchors: {
        invalid_anchor: "not_an_array"
      }
    },
    expectedError: 'anchor.coordinates.invalid'
  },

  {
    name: 'Valid percentage anchors',
    config: {
      version: 1,
      anchors: {
        percent_anchor: ['50%', '75%']
      },
      overlays: [
        {
          id: 'anchored_overlay',
          type: 'text',
          anchor: 'percent_anchor',
          style: { value: 'Test' }
        }
      ]
    },
    expectedError: null
  },

  {
    name: 'Valid mixed coordinate types',
    config: {
      version: 1,
      anchors: {
        mixed_anchor: [100, '50%']
      },
      overlays: [
        {
          id: 'mixed_overlay',
          type: 'text',
          anchor: 'mixed_anchor',
          style: { value: 'Test' }
        }
      ]
    },
    expectedError: null
  }
];

async function runAnchorValidationTest() {
  console.log('⚓ Running anchor validation test...');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = await processMsdConfig(testCase.config);
      const hasErrors = result.validation.errors.length > 0;
      const errorCodes = result.validation.errors.map(e => e.code);

      if (testCase.expectedError === null) {
        if (!hasErrors) {
          console.log(`✅ ${testCase.name}: Passed as expected`);
          passed++;
        } else {
          console.error(`❌ ${testCase.name}: Unexpected errors:`, errorCodes);
          failed++;
        }
      } else {
        if (hasErrors && errorCodes.includes(testCase.expectedError)) {
          console.log(`✅ ${testCase.name}: Caught expected error ${testCase.expectedError}`);
          passed++;
        } else {
          console.error(`❌ ${testCase.name}: Expected ${testCase.expectedError}, got:`, errorCodes);
          failed++;
        }
      }

    } catch (error) {
      console.error(`❌ ${testCase.name}: Runtime error:`, error.message);
      failed++;
    }
  }

  const total = passed + failed;
  console.log(`\n📊 Anchor Validation Results: ${passed}/${total} passed`);

  return {
    passed: failed === 0,
    error: failed > 0 ? `${failed}/${total} test cases failed` : null
  };
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAnchorValidationTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runAnchorValidationTest };
