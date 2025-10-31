/**
 * Quick API Test Script
 *
 * Paste this in browser console after loading your MSD card to verify
 * the API is properly initialized.
 */

console.log('🧪 CB-LCARS API Quick Test\n');

const api = window.cblcars?.debug?.msd;

if (!api) {
  console.error('❌ API not found! Make sure MSD card is loaded.');
} else {
  console.log('✅ API found\n');

  // Test 1: Core utilities
  console.log('📦 Core Utilities:');
  ['MsdInstanceManager', 'mergePacks', 'pipelineInstance'].forEach(prop => {
    console.log(`  ${prop in api ? '✅' : '❌'} ${prop}`);
  });

  // Test 2: Critical namespaces
  console.log('\n📚 Critical Namespaces:');
  ['perf', 'routing', 'data', 'styles', 'overlays', 'pipeline'].forEach(ns => {
    const exists = ns in api && typeof api[ns] === 'object';
    console.log(`  ${exists ? '✅' : '❌'} ${ns}`);
    if (exists && ns === 'perf') {
      // Test perf methods
      console.log(`    ${typeof api.perf.summary === 'function' ? '✅' : '❌'} perf.summary()`);
      console.log(`    ${typeof api.perf.slowestOverlays === 'function' ? '✅' : '❌'} perf.slowestOverlays()`);
    }
  });

  // Test 3: Internal namespace
  console.log('\n🔒 Internal Namespace:');
  const internal = api.pipelineInstance?._internal;
  if (internal) {
    console.log('  ✅ pipelineInstance._internal exists');
    ['debugManager', 'router', 'chartTemplateRegistry'].forEach(prop => {
      console.log(`    ${prop in internal ? '✅' : '❌'} ${prop}`);
    });
  } else {
    console.log('  ❌ pipelineInstance._internal NOT FOUND');
  }

  // Test 4: Deprecated properties (should exist but trigger warnings)
  console.log('\n⚠️  Deprecated Properties (should exist):');
  ['getPerf', 'debugManager', 'chartTemplateRegistry'].forEach(prop => {
    console.log(`  ${prop in api ? '✅' : '❌'} ${prop}`);
  });

  console.log('\n✅ Quick test complete!');
  console.log('\n💡 For full audit, run: auditAPI()');
}
