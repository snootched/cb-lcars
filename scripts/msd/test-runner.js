/**
 * MSD Test Suite Runner
 * Runs all MSD-related tests in sequence
 */

import { runDeterminismTest } from './test-determinism.js';
import { runLegacyRemovalTest } from './test-legacy-removal.js';
import { runValidationIntegrationTest } from './test-validation-integration.js';
import { runAnchorValidationTest } from './test-anchor-validation.js';
import { runPaletteDeepMergeTest } from './test-palette-deep-merge.js';
import { runAnchorProvenanceTest } from './test-anchor-provenance.js';
import { runExternalPacksTest } from './test-external-packs.js';
import { runM12IntegrationTest } from './test-m12-integration.js';
import { runPerformanceTest } from './test-performance.js';
import { runExportParityTest } from './test-export-parity.js';

const MSD_TESTS = [
  // Milestone 1.1 - Critical Infrastructure
  { name: 'Determinism', runner: runDeterminismTest, critical: true, milestone: '1.1' },
  { name: 'Legacy Removal', runner: runLegacyRemovalTest, critical: true, milestone: '1.1' },
  { name: 'Validation Integration', runner: runValidationIntegrationTest, critical: false, milestone: '1.1' },
  { name: 'Anchor Validation', runner: runAnchorValidationTest, critical: false, milestone: '1.1' },

  // Milestone 1.2 - Deep Merge & Provenance
  { name: 'Palette Deep Merge', runner: runPaletteDeepMergeTest, critical: true, milestone: '1.2' },
  { name: 'Anchor Provenance', runner: runAnchorProvenanceTest, critical: true, milestone: '1.2' },
  { name: 'External Packs', runner: runExternalPacksTest, critical: true, milestone: '1.2' },
  { name: 'M1.2 Integration', runner: runM12IntegrationTest, critical: true, milestone: '1.2' },

  // Milestone 1.3 - Performance & Export Foundation
  { name: 'Performance', runner: runPerformanceTest, critical: true, milestone: '1.3' },
  { name: 'Export Parity', runner: runExportParityTest, critical: true, milestone: '1.3' },

  // Future Milestone Tests (not yet implemented)
  // { name: 'Rules Engine', runner: runRulesEngineTest, critical: false, milestone: '2.1' }
];

async function runMsdTests(options = {}) {
  console.log('🚀 Running MSD Test Suite...\n');

  // Filter tests by milestone if specified
  let testsToRun = MSD_TESTS;
  if (options.milestone) {
    testsToRun = MSD_TESTS.filter(t => t.milestone === options.milestone);
    console.log(`🎯 Running tests for Milestone ${options.milestone} only\n`);
  }

  const results = [];
  let criticalFailed = false;

  for (const test of testsToRun) {
    console.log(`⏱️  Starting: ${test.name} (M${test.milestone})`);

    try {
      const startTime = Date.now();
      const result = await test.runner();
      const duration = Date.now() - startTime;

      results.push({
        name: test.name,
        milestone: test.milestone,
        passed: result.passed,
        error: result.error,
        duration,
        critical: test.critical
      });

      if (result.passed) {
        console.log(`✅ ${test.name} - PASSED (${duration}ms)\n`);
      } else {
        console.error(`❌ ${test.name} - FAILED (${duration}ms)`);
        console.error(`   Error: ${result.error}\n`);

        if (test.critical) {
          criticalFailed = true;
          if (options.failFast) {
            break;
          }
        }
      }

    } catch (error) {
      console.error(`💥 ${test.name} - CRASHED: ${error.message}\n`);
      results.push({
        name: test.name,
        milestone: test.milestone,
        passed: false,
        error: error.message,
        duration: 0,
        critical: test.critical
      });

      if (test.critical) {
        criticalFailed = true;
        if (options.failFast) {
          break;
        }
      }
    }
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log('📊 MSD Test Suite Results:');
  console.log(`   Passed: ${passed}/${results.length}`);
  console.log(`   Failed: ${failed}/${results.length}`);
  console.log(`   Total time: ${totalTime}ms`);

  if (criticalFailed) {
    console.log('   ⚠️  Critical tests failed - build should not proceed');
  }

  // Milestone breakdown
  const milestones = [...new Set(results.map(r => r.milestone))].sort();
  milestones.forEach(milestone => {
    const milestoneResults = results.filter(r => r.milestone === milestone);
    const milestonePassed = milestoneResults.filter(r => r.passed).length;
    console.log(`   M${milestone}: ${milestonePassed}/${milestoneResults.length} passed`);
  });

  const success = failed === 0;
  console.log(`\n${success ? '🎉 All tests PASSED' : '💥 Some tests FAILED'}`);

  return {
    passed: success,
    critical_failed: criticalFailed,
    results,
    summary: { passed, failed, totalTime }
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = {
    failFast: process.argv.includes('--fail-fast'),
    milestone: process.argv.find(arg => arg.startsWith('--milestone='))?.split('=')[1]
  };

  runMsdTests(options).then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runMsdTests };
