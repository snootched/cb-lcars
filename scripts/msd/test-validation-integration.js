/**
 * Test validation pipeline integration
 * Verify known bad configs produce expected errors
 */

import { processMsdConfig } from '../../src/msd/index.js';

const testCases = [
  {
    name: 'Missing anchor reference',
    config: {
      version: 1,
      overlays: [
        {
          id: 'test_overlay',
          type: 'text',
          anchor: 'missing_anchor', // This anchor doesn't exist
          style: { value: 'Test' }
        }
      ]
    },
    expectedError: 'anchor.missing'
  },

  {
    name: 'Duplicate overlay IDs',
    config: {
      version: 1,
      overlays: [
        { id: 'duplicate', type: 'text', position: [0, 0], style: { value: 'First' } },
        { id: 'duplicate', type: 'line', position: [10, 10], style: { color: 'red' } } // Duplicate ID
      ]
    },
    expectedError: 'duplicate.id'
  },

  {
    name: 'Valid configuration',
    config: {
      version: 1,
      anchors: {
        test_anchor: [100, 100]
      },
      overlays: [
        {
          id: 'valid_overlay',
          type: 'text',
          anchor: 'test_anchor',
          style: { value: 'Test' }
        }
      ]
    },
    expectedError: null // Should pass validation
  }
];

async function runValidationIntegrationTest() {
  console.log('🔧 Testing validation integration...');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = await processMsdConfig(testCase.config);
      const hasErrors = result.validation.errors.length > 0;
      const errorCodes = result.validation.errors.map(e => e.code);

      if (testCase.expectedError === null) {
        // Should pass validation
        if (!hasErrors) {
          console.log(`✅ ${testCase.name}: Passed validation as expected`);
          passed++;
        } else {
          console.error(`❌ ${testCase.name}: Unexpected validation errors:`, errorCodes);
          console.error('   Full errors:', result.validation.errors);
          failed++;
        }
      } else {
        // Should fail validation with specific error
        if (hasErrors && errorCodes.includes(testCase.expectedError)) {
          console.log(`✅ ${testCase.name}: Caught expected error ${testCase.expectedError}`);
          passed++;
        } else {
          console.error(`❌ ${testCase.name}: Expected error ${testCase.expectedError}, got:`, errorCodes);
          console.error('   Full errors:', result.validation.errors);
          console.error('   Config overlays:', testCase.config.overlays);
          failed++;
        }
      }

    } catch (error) {
      console.error(`❌ ${testCase.name}: Runtime error:`, error.message);
      failed++;
    }
  }

  const total = passed + failed;
  console.log(`\n📊 Validation Integration Results: ${passed}/${total} passed`);

  if (failed === 0) {
    console.log('✅ Validation integration test PASSED');
    return { passed: true };
  } else {
    console.error('❌ Validation integration test FAILED');
    return { passed: false, error: `${failed}/${total} test cases failed` };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidationIntegrationTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runValidationIntegrationTest };
