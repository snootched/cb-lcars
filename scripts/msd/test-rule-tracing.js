/**
 * Test rules engine tracing and stop semantics
 * Verifies debugging capabilities and overlay-scoped rule stopping
 */

import { RulesEngine } from '../../src/msd/rules/RulesEngine.js';
import { RuleTraceBuffer } from '../../src/msd/rules/RuleTraceBuffer.js';

const testRules = [
  {
    id: 'high_priority_stop',
    priority: 10,
    when: {
      all: [
        { entity: 'sensor.cpu_temp', above: 70 }
      ]
    },
    apply: {
      overlays: [
        { id: 'cpu_status', style: { color: 'red' } }
      ]
    },
    stop: true // This should prevent lower priority rules from affecting cpu_status
  },
  {
    id: 'medium_priority',
    priority: 5,
    when: {
      all: [
        { entity: 'sensor.cpu_temp', above: 60 }
      ]
    },
    apply: {
      overlays: [
        { id: 'cpu_status', style: { color: 'yellow' } }
      ]
    }
  },
  {
    id: 'low_priority',
    priority: 1,
    when: {
      all: [
        { entity: 'sensor.cpu_temp', above: 50 }
      ]
    },
    apply: {
      overlays: [
        { id: 'cpu_status', style: { color: 'green' } },
        { id: 'other_overlay', style: { color: 'blue' } } // Should still apply
      ]
    }
  },
  {
    id: 'different_overlay',
    priority: 8,
    when: {
      all: [
        { entity: 'sensor.memory_usage', above: 80 }
      ]
    },
    apply: {
      overlays: [
        { id: 'memory_status', style: { color: 'red' } }
      ]
    }
  }
];

// Mock entity data
const mockEntities = {
  'sensor.cpu_temp': { state: '75', attributes: {} }, // Triggers all CPU temp rules
  'sensor.memory_usage': { state: '85', attributes: {} } // Triggers memory rule
};

function mockGetEntity(entityId) {
  return mockEntities[entityId] || null;
}

async function runRuleTracingTest() {
  console.log('📊 Running rules tracing and stop semantics test...');

  let passed = 0;
  let failed = 0;

  // Test 1: Rule trace buffer functionality
  try {
    const traceBuffer = new RuleTraceBuffer(10); // Small buffer for testing

    // Add some traces
    traceBuffer.addTrace('rule1', true, { all: [] }, 5.2, { priority: 10 });
    traceBuffer.addTrace('rule2', false, { all: [] }, 3.1, { priority: 5 });
    traceBuffer.addTrace('rule1', true, { all: [] }, 4.8, { priority: 10 });

    const recent = traceBuffer.getRecentTraces(3);

    if (recent.length !== 3) {
      console.error('❌ Trace buffer: Wrong number of traces returned');
      console.error(`   Expected: 3, Got: ${recent.length}`);
      failed++;
    } else if (recent[2].ruleId !== 'rule1' || recent[2].evaluationTime !== 4.8) {
      console.error('❌ Trace buffer: Most recent trace incorrect');
      console.error(`   Expected: rule1/4.8ms, Got: ${recent[2].ruleId}/${recent[2].evaluationTime}ms`);
      failed++;
    } else {
      console.log('✅ Trace buffer: Correctly stores and retrieves traces');
      passed++;
    }

    // Test rule history filtering
    const rule1History = traceBuffer.getRuleHistory('rule1');
    if (rule1History.length !== 2) {
      console.error('❌ Trace buffer: Rule history filtering incorrect');
      console.error(`   Expected: 2 rule1 traces, Got: ${rule1History.length}`);
      failed++;
    } else {
      console.log('✅ Trace buffer: Rule history filtering works');
      passed++;
    }

  } catch (error) {
    console.error('❌ Trace buffer test failed:', error.message);
    failed++;
  }

  // Test 2: Stop semantics - high priority rule stops lower priority rules
  try {
    const engine = new RulesEngine(testRules);

    // Clear trace buffer for clean test
    engine.clearTrace();

    const result = engine.evaluateDirty({ getEntity: mockGetEntity });

    // Check overlay patches - cpu_status should only have the high priority rule's color
    const cpuPatches = result.overlayPatches.filter(p => p.id === 'cpu_status');

    if (cpuPatches.length !== 1) {
      console.error('❌ Stop semantics: Wrong number of cpu_status patches');
      console.error(`   Expected: 1 (high priority only), Got: ${cpuPatches.length}`);
      console.error('   Patches:', cpuPatches);
      failed++;
    } else if (cpuPatches[0].style.color !== 'red') {
      console.error('❌ Stop semantics: Wrong color applied');
      console.error(`   Expected: red (high priority), Got: ${cpuPatches[0].style.color}`);
      failed++;
    } else {
      console.log('✅ Stop semantics: High priority rule stops lower priority rules on same overlay');
      passed++;
    }

    // Check that other overlays are not affected by stop
    const otherPatches = result.overlayPatches.filter(p => p.id === 'other_overlay');
    const memoryPatches = result.overlayPatches.filter(p => p.id === 'memory_status');

    if (otherPatches.length !== 1 || memoryPatches.length !== 1) {
      console.error('❌ Stop semantics: Other overlays affected by stop');
      console.error(`   other_overlay patches: ${otherPatches.length}, memory_status: ${memoryPatches.length}`);
      failed++;
    } else {
      console.log('✅ Stop semantics: Other overlays unaffected by overlay-specific stop');
      passed++;
    }

  } catch (error) {
    console.error('❌ Stop semantics test failed:', error.message);
    failed++;
  }

  // Test 3: Trace integration with engine
  try {
    const engine = new RulesEngine(testRules);
    engine.clearTrace();

    // Run evaluation
    engine.evaluateDirty({ getEntity: mockGetEntity });

    // Check that traces were recorded
    const trace = engine.getTrace();

    if (!trace.traceStats || trace.traceStats.totalTraces === 0) {
      console.error('❌ Trace integration: No traces recorded during evaluation');
      console.error('   Trace stats:', trace.traceStats);
      failed++;
    } else if (trace.traceStats.recentMatched === 0) {
      console.error('❌ Trace integration: No matched rules recorded');
      console.error('   Expected matched rules but got 0');
      failed++;
    } else {
      console.log('✅ Trace integration: Engine records traces during evaluation');
      console.log(`   Total traces: ${trace.traceStats.totalTraces}, Matched: ${trace.traceStats.recentMatched}`);
      passed++;
    }

    // Test rule-specific trace history
    const highPriorityTrace = engine.getRuleTrace('high_priority_stop');

    if (highPriorityTrace.length === 0) {
      console.error('❌ Trace integration: No trace history for specific rule');
      failed++;
    } else if (!highPriorityTrace[0].matched) {
      console.error('❌ Trace integration: Rule should have matched but trace shows false');
      failed++;
    } else {
      console.log('✅ Trace integration: Rule-specific trace history available');
      passed++;
    }

  } catch (error) {
    console.error('❌ Trace integration test failed:', error.message);
    failed++;
  }

  // Test 4: Export functionality
  try {
    const engine = new RulesEngine(testRules);
    engine.clearTrace();

    // Generate some traces
    engine.evaluateDirty({ getEntity: mockGetEntity });

    // Test JSON export
    const jsonExport = engine.exportTrace({ format: 'json', limit: 10 });
    const traces = JSON.parse(jsonExport);

    if (!Array.isArray(traces) || traces.length === 0) {
      console.error('❌ Export functionality: JSON export failed');
      console.error('   Export result:', typeof jsonExport);
      failed++;
    } else if (!traces[0].ruleId || !traces[0].hasOwnProperty('matched')) {
      console.error('❌ Export functionality: Exported traces missing required fields');
      console.error('   First trace:', traces[0]);
      failed++;
    } else {
      console.log('✅ Export functionality: JSON export works correctly');
      passed++;
    }

    // Test CSV export
    const csvExport = engine.exportTrace({ format: 'csv', limit: 5 });

    if (!csvExport.includes('ruleId,matched,evaluationTime,timestamp')) {
      console.error('❌ Export functionality: CSV export missing headers');
      console.error('   CSV start:', csvExport.substring(0, 100));
      failed++;
    } else {
      console.log('✅ Export functionality: CSV export works correctly');
      passed++;
    }

  } catch (error) {
    console.error('❌ Export functionality test failed:', error.message);
    failed++;
  }

  const total = passed + failed;
  console.log(`\n📊 Rule Tracing Results: ${passed}/${total} passed`);

  if (failed === 0) {
    console.log('✅ Rules tracing and stop semantics test PASSED');
    console.log('   ✓ Trace buffer correctly stores and filters rule evaluations');
    console.log('   ✓ Stop semantics prevent lower priority rules on same overlay');
    console.log('   ✓ Other overlays unaffected by overlay-specific stops');
    console.log('   ✓ Engine integrates with trace buffer automatically');
    console.log('   ✓ Export functionality provides JSON and CSV formats');
    return { passed: true };
  } else {
    console.error('❌ Rules tracing and stop semantics test FAILED');
    return { passed: false, error: `${failed}/${total} tracing checks failed` };
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRuleTracingTest().then(result => {
    process.exit(result.passed ? 0 : 1);
  });
}

export { runRuleTracingTest };
