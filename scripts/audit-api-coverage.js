#!/usr/bin/env node

/**
 * CB-LCARS API Coverage Audit
 *
 * Checks the current state of window.cblcars.debug.msd API to verify:
 * 1. All expected namespaces are present
 * 2. All expected methods exist (even as placeholders)
 * 3. No unexpected/legacy properties remain
 * 4. Deprecation warnings are properly set up
 */

console.log('🔍 CB-LCARS API Coverage Audit\n');
console.log('=' .repeat(60));

// Expected API structure (Phase 4 complete state)
const EXPECTED_API = {
  // Core utilities (7)
  core: [
    'MsdInstanceManager',
    'mergePacks',
    'buildCardModel',
    'initMsdPipeline',
    'pipelineInstance',
    'getThemeProvenance',
    'dataSourceManager'
  ],

  // Debug API namespaces (11)
  namespaces: {
    perf: ['summary', 'slowestOverlays', 'byRenderer', 'byOverlay', 'warnings', 'timeline', 'compare'],
    routing: ['inspect', 'stats', 'invalidate', 'inspectAs', 'visualize'],
    data: ['stats', 'list', 'get', 'dump', 'trace', 'history'],
    styles: ['resolutions', 'findByToken', 'provenance', 'listTokens', 'getTokenValue'],
    charts: ['validate', 'validateAll', 'getFormatSpec', 'listTypes'],
    rules: ['trace', 'evaluate', 'listActive', 'debugRule'],
    animations: ['active', 'dump', 'timeline', 'trigger'],
    packs: ['list', 'get', 'issues', 'order'],
    visual: ['enable', 'disable', 'toggle', 'status', 'getActive', 'refresh'],
    overlays: ['inspect', 'getBBox', 'getTransform', 'getState', 'findByType', 'findByEntity', 'tree', 'list'],
    pipeline: ['stages', 'timing', 'config', 'errors', 'rerun', 'getInstance']
  },

  // System components (used by HUD/internal)
  system: [
    'hud',
    'controls'
  ],

  // User helpers
  helpers: [
    'help',
    'usage'
  ],

  // Deprecated but kept for backward compatibility (Phase 4)
  deprecated: [
    'debugManager',           // Use pipelineInstance._internal.debugManager
    'chartTemplateRegistry',  // Use pipelineInstance._internal.chartTemplateRegistry
    'ValidationService',      // Use pipelineInstance._internal.ValidationService
    'mountElement',           // Use pipelineInstance._internal.mountElement
    'apexCharts',             // Use pipelineInstance._internal.apexCharts
    'getPerf',                // Use perf.summary()
    'getPerformanceSummary',  // Use perf.summary()
    'getSlowestOverlays',     // Use perf.slowestOverlays()
    'getRendererPerformance', // Use perf.byRenderer()
    'getOverlayPerformance',  // Use perf.byOverlay()
    'getPerformanceWarnings', // Use perf.warnings()
    'getRenderTimeline',      // Use perf.timeline()
    'compareRendererPerformance', // Use perf.compare()
    'getStyleResolutions',    // Use styles.resolutions()
    'findOverlaysByToken',    // Use styles.findByToken()
    'getGlobalStyleSummary',  // Use styles.provenance()
    'templates'               // Helper object, OK to keep
  ],

  // Should be removed in Phase 5+
  toRemove: [
    '_originalUserConfig',
    '_validationMs',
    '_provenance',
    'themeProvenance',
    'exportCollapsed',
    'dataSources',
    'entities',
    'cardInstance',
    'debug',
    'renderAdvanced',
    'introspection',
    'validation',
    'lines',
    'getPackInfo',
    'getStyleProvenance',
    'getRendererInfo',
    'getOverlayProvenance',
    'listTrackedOverlays',
    'getDebugStatusSilent'
  ]
};

// Test results
const results = {
  present: [],
  missing: [],
  unexpected: [],
  deprecated: [],
  placeholders: [],
  errors: []
};

function testAPI() {
  if (typeof window === 'undefined') {
    console.log('❌ Error: This script must be run in a browser environment');
    console.log('   Load your MSD card, then paste this script in the browser console\n');
    return false;
  }

  const api = window.cblcars?.debug?.msd;

  if (!api) {
    console.log('❌ Error: window.cblcars.debug.msd not found');
    console.log('   Make sure the MSD card is loaded\n');
    return false;
  }

  // Test core utilities
  console.log('\n📦 Core Utilities (7 expected)');
  console.log('-'.repeat(60));
  EXPECTED_API.core.forEach(prop => {
    if (prop in api) {
      console.log(`  ✅ ${prop}`);
      results.present.push(prop);
    } else {
      console.log(`  ❌ ${prop} - MISSING`);
      results.missing.push(prop);
    }
  });

  // Test namespaces
  console.log('\n📚 Debug API Namespaces (11 expected)');
  console.log('-'.repeat(60));
  Object.entries(EXPECTED_API.namespaces).forEach(([ns, methods]) => {
    if (ns in api && typeof api[ns] === 'object') {
      console.log(`  ✅ ${ns}/`);
      methods.forEach(method => {
        if (method in api[ns]) {
          const fn = api[ns][method];
          if (typeof fn === 'function') {
            // Check if it's a placeholder
            try {
              const result = fn.toString().includes('NOT_IMPLEMENTED') ||
                           fn.toString().includes('not yet implemented');
              if (result) {
                console.log(`    📦 ${method}() - placeholder`);
                results.placeholders.push(`${ns}.${method}`);
              } else {
                console.log(`    ✅ ${method}()`);
              }
            } catch (e) {
              console.log(`    ✅ ${method}()`);
            }
          } else {
            console.log(`    ⚠️  ${method} - not a function`);
          }
          results.present.push(`${ns}.${method}`);
        } else {
          console.log(`    ❌ ${method}() - MISSING`);
          results.missing.push(`${ns}.${method}`);
        }
      });
    } else {
      console.log(`  ❌ ${ns}/ - MISSING NAMESPACE`);
      results.missing.push(ns);
    }
  });

  // Test system components
  console.log('\n🔧 System Components (2 expected)');
  console.log('-'.repeat(60));
  EXPECTED_API.system.forEach(prop => {
    if (prop in api) {
      console.log(`  ✅ ${prop}`);
      results.present.push(prop);
    } else {
      console.log(`  ❌ ${prop} - MISSING`);
      results.missing.push(prop);
    }
  });

  // Test helpers
  console.log('\n📖 User Helpers (2 expected)');
  console.log('-'.repeat(60));
  EXPECTED_API.helpers.forEach(prop => {
    if (prop in api) {
      console.log(`  ✅ ${prop}`);
      results.present.push(prop);
    } else {
      console.log(`  ❌ ${prop} - MISSING`);
      results.missing.push(prop);
    }
  });

  // Check for deprecated properties
  console.log('\n⚠️  Deprecated Properties (17 expected for backward compatibility)');
  console.log('-'.repeat(60));
  EXPECTED_API.deprecated.forEach(prop => {
    if (prop in api) {
      console.log(`  ⚠️  ${prop} - present (OK for Phase 4)`);
      results.deprecated.push(prop);
    }
  });

  // Check for properties that should be removed
  console.log('\n🗑️  Legacy Properties (to be removed in Phase 5)');
  console.log('-'.repeat(60));
  const foundLegacy = [];
  EXPECTED_API.toRemove.forEach(prop => {
    if (prop in api) {
      console.log(`  🗑️  ${prop} - still present`);
      foundLegacy.push(prop);
    }
  });
  if (foundLegacy.length === 0) {
    console.log('  ✅ No legacy properties found');
  }

  // Check for unexpected properties
  console.log('\n🔍 Unexpected Properties');
  console.log('-'.repeat(60));
  const allExpected = new Set([
    ...EXPECTED_API.core,
    ...Object.keys(EXPECTED_API.namespaces),
    ...EXPECTED_API.system,
    ...EXPECTED_API.helpers,
    ...EXPECTED_API.deprecated,
    ...EXPECTED_API.toRemove
  ]);

  Object.keys(api).forEach(key => {
    if (!allExpected.has(key)) {
      console.log(`  ❓ ${key} - unexpected property`);
      results.unexpected.push(key);
    }
  });

  if (results.unexpected.length === 0) {
    console.log('  ✅ No unexpected properties');
  }

  // Test pipelineInstance._internal
  console.log('\n🔒 Internal Namespace (pipelineInstance._internal)');
  console.log('-'.repeat(60));
  const internal = api.pipelineInstance?._internal;
  if (internal) {
    const expectedInternal = ['debugManager', 'router', 'chartTemplateRegistry', 'ValidationService', 'mountElement', 'apexCharts'];
    expectedInternal.forEach(prop => {
      if (prop in internal) {
        console.log(`  ✅ _internal.${prop}`);
      } else {
        console.log(`  ⚠️  _internal.${prop} - not found`);
      }
    });
  } else {
    console.log('  ❌ pipelineInstance._internal not found');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`✅ Present:     ${results.present.length}`);
  console.log(`❌ Missing:     ${results.missing.length}`);
  console.log(`📦 Placeholders: ${results.placeholders.length}`);
  console.log(`⚠️  Deprecated:  ${results.deprecated.length} (OK for Phase 4)`);
  console.log(`❓ Unexpected:  ${results.unexpected.length}`);

  if (results.missing.length > 0) {
    console.log('\n⚠️  Missing items:');
    results.missing.forEach(item => console.log(`   - ${item}`));
  }

  if (results.placeholders.length > 0) {
    console.log('\n📦 Placeholder methods (to be implemented in Phase 5):');
    results.placeholders.forEach(item => console.log(`   - ${item}`));
  }

  console.log('\n✅ API audit complete!\n');

  return results;
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.auditAPI = testAPI;
  console.log('💡 Run: auditAPI() or window.auditAPI() to test the API\n');
} else {
  console.log('\n💡 To use this audit:\n');
  console.log('1. Load your MSD card in Home Assistant');
  console.log('2. Open browser developer console (F12)');
  console.log('3. Copy and paste this entire script');
  console.log('4. Run: auditAPI()\n');
}

// Node.js export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testAPI, EXPECTED_API };
}
