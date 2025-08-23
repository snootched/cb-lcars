/**
 * Test complete export system with full snapshots and health reporting
 * Verifies comprehensive metadata extraction and system health analysis
 */

import { ExportCompletion } from '../../src/msd/export/ExportCompletion.js';

// Mock pipeline for testing
const createMockPipeline = () => ({
  startTime: Date.now() - 60000, // 1 minute ago

  getResolvedModel: () => ({
    version: 1,
    checksum: 'test123',
    view_box: [0, 0, 800, 600],
    anchors: {
      cpu: [100, 100],
      mem: [200, 200],
      gpu: [300, 300]
    },
    overlays: [
      {
        id: 'cpu_text',
        type: 'text',
        style: { value: 'CPU', color: '#orange' },
        animation_ref: 'pulse'
      },
      {
        id: 'mem_line',
        type: 'line',
        style: { color: '#blue', width: 2 }
      },
      {
        id: 'gpu_circle',
        type: 'circle',
        style: { fill: '#green', r: 10 }
      }
    ],
    rules: [
      { id: 'cpu_hot', priority: 10, when: { all: [{ entity: 'sensor.cpu', above: 75 }] } },
      { id: 'mem_full', priority: 5, when: { all: [{ entity: 'sensor.memory', above: 90 }] } }
    ],
    animations: [
      { id: 'pulse', preset: 'pulse', duration: 1000 }
    ],
    palettes: {
      default: { primary: '#orange', secondary: '#blue' }
    },
    __provenance: {
      anchors: {
        cpu: { origin_pack: 'user', origin_type: 'user', overridden: false },
        mem: { origin_pack: 'core', origin_type: 'svg', overridden: true, override_pack: 'user' }
      },
      overlays: {
        cpu_text: { origin_pack: 'user', overridden: false }
      },
      merge_order: [
        { type: 'builtin', pack: 'core', priority: 100 },
        { type: 'user', pack: 'user_config', priority: 1000 }
      ]
    }
  }),

  getRulesEngine: () => ({
    getTrace: () => ({
      totalRules: 2,
      evalCounts: { total: 150, matched: 25, skipped: 5 },
      dependencyStats: { entitiesTracked: 3, avgRulesPerEntity: 1.5 }
    }),
    exportTrace: () => JSON.stringify([
      { ruleId: 'cpu_hot', matched: true, evaluationTime: 2.5 },
      { ruleId: 'mem_full', matched: false, evaluationTime: 1.8 }
    ])
  }),

  getRenderer: () => ({
    getStats: () => ({
      renders: 45,
      avgRenderTime: 8.5,
      overlayCount: 3,
      lastRenderTime: 12.3
    })
  })
});

async function runExportCompletionTest() {
  console.log('📤 Running export completion system test...');

  let passed = 0;
  let failed = 0;

  // Test 1: Full snapshot export with all metadata
  try {
    const exporter = new ExportCompletion();
    const pipeline = createMockPipeline();

    const snapshot = await exporter.exportFullSnapshot(pipeline, {
      includeProvenance: true,
      includePerformance: true,
      includeRuleTraces: true,
      includeAnimationStats: false
    });

    const parsed = JSON.parse(snapshot);

    // Verify structure
    if (!parsed.meta || !parsed.config || !parsed.provenance) {
      console.error('❌ Full snapshot: Missing required sections');
      console.error('   Sections:', Object.keys(parsed));
      failed++;
    } else if (!parsed.meta.timestamp || !parsed.meta.version) {
      console.error('❌ Full snapshot: Missing metadata fields');
      failed++;
    } else if (parsed.config.overlays.length !== 3) {
      console.error('❌ Full snapshot: Incorrect overlay count in config');
      console.error(`   Expected: 3, Got: ${parsed.config.overlays.length}`);
      failed++;
    } else if (!parsed.provenance.merge_order || parsed.provenance.merge_order.length !== 2) {
      console.error('❌ Full snapshot: Provenance data incomplete');
      failed++;
    } else {
      console.log('✅ Full snapshot: All metadata sections exported correctly');
      console.log(`   Config sections: ${Object.keys(parsed.config).length}`);
      console.log(`   Provenance items: ${parsed.provenance.overrides} overrides`);
      passed++;
    }

  } catch (error) {
    console.error('❌ Full snapshot test failed:', error.message);
    failed++;
  }

  // Test 2: Configuration diff computation
  try {
    const exporter = new ExportCompletion();

    const configA = {
      checksum: 'abc123',
      overlays: [
        { id: 'test1', type: 'text', style: { color: '#red' } },
        { id: 'test2', type: 'line', style: { width: 2 } }
      ],
      anchors: { point1: [100, 100] }
    };

    const configB = {
      checksum: 'def456',
      overlays: [
        { id: 'test1', type: 'text', style: { color: '#blue' } }, // Modified
        { id: 'test3', type: 'circle', style: { r: 10 } }         // Added
        // test2 removed
      ],
      anchors: { point1: [100, 100], point2: [200, 200] } // Added point2
    };

    const diffJson = exporter.exportConfigDiff(configA, configB);
    const diff = JSON.parse(diffJson);

    if (!diff.meta || !diff.changes) {
      console.error('❌ Config diff: Missing required structure');
      failed++;
    } else if (diff.meta.comparison.identical) {
      console.error('❌ Config diff: Should detect differences but reported identical');
      failed++;
    } else if (diff.changes.summary.total_changes === 0) {
      console.error('❌ Config diff: Should detect changes in summary');
      failed++;
    } else if (!diff.changes.sections.overlays || !diff.changes.sections.anchors) {
      console.error('❌ Config diff: Missing changed sections');
      console.error('   Sections:', Object.keys(diff.changes.sections));
      failed++;
    } else {
      console.log('✅ Config diff: Changes detected and categorized correctly');
      console.log(`   Total changes: ${diff.changes.summary.total_changes}`);
      console.log(`   Modifications: ${diff.changes.summary.modifications}`);
      passed++;
    }

  } catch (error) {
    console.error('❌ Config diff test failed:', error.message);
    failed++;
  }

  // Test 3: System health report
  try {
    const exporter = new ExportCompletion();
    const pipeline = createMockPipeline();

    const healthReport = exporter.exportHealthReport(pipeline);
    const health = typeof healthReport === 'string' ? JSON.parse(healthReport) : healthReport;

    if (!health.meta || !health.health || !health.performance) {
      console.error('❌ Health report: Missing required sections');
      console.error('   Sections:', Object.keys(health));
      failed++;
    } else if (!['healthy', 'warning', 'critical'].includes(health.health.overall)) {
      console.error('❌ Health report: Invalid overall health status');
      console.error(`   Status: ${health.health.overall}`);
      failed++;
    } else if (!health.rules || typeof health.rules.rules_count !== 'number') {
      console.error('❌ Health report: Rules analysis incomplete');
      failed++;
    } else {
      console.log('✅ Health report: System health analyzed correctly');
      console.log(`   Overall health: ${health.health.overall}`);
      console.log(`   Rules count: ${health.rules.rules_count}`);
      console.log(`   Performance status: ${health.performance.status}`);
      passed++;
    }

  } catch (error) {
    console.error('❌ Health report test failed:', error.message);
    failed++;
  }

  // Test 4: Data extraction accuracy
  try {
    const exporter = new ExportCompletion();
    const pipeline = createMockPipeline();

    // Test anchor data extraction
    const anchorData = exporter.extractAnchorData(pipeline);

    if (anchorData.total !== 3) {
      console.error('❌ Data extraction: Incorrect anchor count');
      console.error(`   Expected: 3, Got: ${anchorData.total}`);
      failed++;
    } else if (!anchorData.coordinates.cpu || !anchorData.coordinates.mem) {
      console.error('❌ Data extraction: Missing anchor coordinates');
      failed++;
    } else {
      console.log('✅ Data extraction: Anchor data extracted correctly');
      passed++;
    }

    // Test overlay data extraction
    const overlayData = exporter.extractOverlayData(pipeline);

    if (overlayData.total !== 3) {
      console.error('❌ Data extraction: Incorrect overlay count');
      console.error(`   Expected: 3, Got: ${overlayData.total}`);
      failed++;
    } else if (overlayData.by_type.text !== 1 || overlayData.by_type.line !== 1) {
      console.error('❌ Data extraction: Incorrect overlay type counts');
      console.error('   By type:', overlayData.by_type);
      failed++;
    } else if (overlayData.with_animations !== 1) {
      console.error('❌ Data extraction: Animation count incorrect');
      console.error(`   Expected: 1, Got: ${overlayData.with_animations}`);
      failed++;
    } else {
      console.log('✅ Data extraction: Overlay data extracted correctly');
      passed++;
    }

  } catch (error) {
    console.error('❌ Data extraction test failed:', error.message);
    failed += 2; // This test covers 2 extraction methods
  }

  // Test 5: Export history tracking
  try {
    const exporter = new ExportCompletion();
    const pipeline = createMockPipeline();

    // Initial history should be empty
    let history = exporter.getExportHistory();
    if (history.length !== 0) {
      console.error('❌ Export history: Should start empty');
      failed++;
    }

    // Export multiple times
    await exporter.exportFullSnapshot(pipeline, { format: 'json' });
    await exporter.exportFullSnapshot(pipeline, { format: 'yaml' });

    history = exporter.getExportHistory();

    if (history.length !== 2) {
      console.error('❌ Export history: Should track all exports');
      console.error(`   Expected: 2, Got: ${history.length}`);
      failed++;
    } else if (!history[0].timestamp || !history[1].timestamp) {
      console.error('❌ Export history: Missing timestamps');
      failed++;
    } else if (history[0].format !== 'yaml' || history[1].format !== 'json') {
      console.error('❌ Export history: Incorrect format tracking');
      console.error('   Formats:', history.map(h => h.format));
      failed++;
    } else {
      console.log('✅ Export history: Export history tracked correctly');
      console.log(`   History entries: ${history.length}`);
      passed++;
    }

  } catch (error) {
    console.error('❌ Export history test failed:', error.message);
    failed++;
  }

  // Test 6: Metadata stripping
  try {
    const exporter = new ExportCompletion();

    const withMeta = {
      id: 'test',
      style: { color: '#red' },
      __provenance: { origin: 'user' },
      checksum: 'abc123',
      _styleSources: ['profile1']
    };

    const stripped = exporter.stripMetadata(withMeta);

    if (stripped.__provenance || stripped.checksum || stripped._styleSources) {
      console.error('❌ Metadata stripping: Metadata fields not removed');
      console.error('   Stripped keys:', Object.keys(stripped));
      failed++;
    } else if (!stripped.id || !stripped.style) {
      console.error('❌ Metadata stripping: Essential fields removed');
      failed++;
    } else {
      console.log('✅ Metadata stripping: Metadata correctly removed while preserving data');
      passed++;
    }

  } catch (error) {
    console.error('❌ Metadata stripping test failed:', error.message);
    failed++;
  }

  const total = passed + failed;
  console.log(`\n📊 Export Completion Results: ${passed}/${total} passed`);

  if (failed === 0) {
    console.log('✅ Export completion system test PASSED');
    console.log('   ✓ Full snapshots export all requested metadata sections');
    console.log('   ✓ Configuration diffs accurately identify and categorize changes');
    console.log('   ✓ System health reports provide comprehensive system analysis');
    console.log('   ✓ Data extraction methods accurately parse pipeline state');
    console.log('   ✓ Export history tracking maintains accurate record of exports');
    console.log('   ✓ Metadata stripping removes internal fields while preserving data');
    return { passed: true };
  } else {
    console.error('❌ Export completion system test FAILED');
    return { passed: false, error: `${failed}/${total} export completion checks failed` };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExportCompletionTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runExportCompletionTest };
