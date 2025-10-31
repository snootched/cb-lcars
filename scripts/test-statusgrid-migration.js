/**
 * Test script for StatusGridOverlay migration
 * Verifies that StatusGridOverlay properly wraps StatusGridRenderer
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing StatusGridOverlay Migration\n');

// Test 1: Verify StatusGridOverlay.js exists and has correct structure
console.log('Test 1: StatusGridOverlay.js structure...');
const statusGridOverlayPath = path.join(__dirname, '../src/msd/overlays/StatusGridOverlay.js');
const statusGridOverlayCode = fs.readFileSync(statusGridOverlayPath, 'utf8');

const checks = [
  { pattern: /export class StatusGridOverlay extends OverlayBase/, desc: 'extends OverlayBase' },
  { pattern: /constructor\(overlay, systemsManager\)/, desc: 'has correct constructor' },
  { pattern: /async initialize\(mountEl\)/, desc: 'has initialize method' },
  { pattern: /render\(overlay, anchors, viewBox, svgContainer, cardInstance\)/, desc: 'has render method' },
  { pattern: /update\(overlayElement, overlay, sourceData\)/, desc: 'has update method' },
  { pattern: /destroy\(\)/, desc: 'has destroy method' },
  { pattern: /StatusGridRenderer\.render/, desc: 'delegates to StatusGridRenderer.render' },
  { pattern: /StatusGridRenderer\.updateGridData/, desc: 'delegates to StatusGridRenderer.updateGridData' },
  { pattern: /_resolveCardInstance/, desc: 'has _resolveCardInstance helper' },
  { pattern: /_getRendererProvenance/, desc: 'has _getRendererProvenance helper' }
];

let passed = 0;
checks.forEach(check => {
  if (check.pattern.test(statusGridOverlayCode)) {
    console.log(`  ✅ ${check.desc}`);
    passed++;
  } else {
    console.log(`  ❌ ${check.desc}`);
  }
});

console.log(`\nTest 1 Result: ${passed}/${checks.length} checks passed\n`);

// Test 2: Verify AdvancedRenderer.js integration
console.log('Test 2: AdvancedRenderer.js integration...');
const advancedRendererPath = path.join(__dirname, '../src/msd/renderer/AdvancedRenderer.js');
const advancedRendererCode = fs.readFileSync(advancedRendererPath, 'utf8');

const integrationChecks = [
  { pattern: /import.*StatusGridOverlay.*from.*overlays\/StatusGridOverlay\.js/, desc: 'imports StatusGridOverlay' },
  { pattern: /if \(overlay\.type === 'status_grid'\)/, desc: 'has status_grid type check' },
  { pattern: /new StatusGridOverlay\(overlay, this\.systemsManager\)/, desc: 'creates StatusGridOverlay instance' },
  { pattern: /this\.overlayRenderers\.set\(overlay\.id, statusGridOverlay\)/, desc: 'caches StatusGridOverlay instance' }
];

let integrationPassed = 0;
integrationChecks.forEach(check => {
  if (check.pattern.test(advancedRendererCode)) {
    console.log(`  ✅ ${check.desc}`);
    integrationPassed++;
  } else {
    console.log(`  ❌ ${check.desc}`);
  }
});

console.log(`\nTest 2 Result: ${integrationPassed}/${integrationChecks.length} checks passed\n`);

// Test 3: Verify status_grid is removed from OverlayAdapter fallback
console.log('Test 3: Verify status_grid removed from adapter fallback...');
const hasStatusGridInSwitch = /case 'status_grid':[\s\S]*?staticRenderer = StatusGridRenderer/.test(advancedRendererCode);

if (!hasStatusGridInSwitch) {
  console.log('  ✅ status_grid case removed from adapter fallback');
} else {
  console.log('  ❌ status_grid case still in adapter fallback switch');
}

console.log(`\nTest 3 Result: ${hasStatusGridInSwitch ? 'FAIL' : 'PASS'}\n`);

// Test 4: Verify StatusGridRenderer.js still exists (wrapper pattern)
console.log('Test 4: StatusGridRenderer.js preservation (wrapper pattern)...');
const statusGridRendererPath = path.join(__dirname, '../src/msd/renderer/StatusGridRenderer.js');
const statusGridRendererExists = fs.existsSync(statusGridRendererPath);

if (statusGridRendererExists) {
  console.log('  ✅ StatusGridRenderer.js still exists (wrapper pattern)');
  const statusGridRendererCode = fs.readFileSync(statusGridRendererPath, 'utf8');
  const hasStaticRender = /static render\(/.test(statusGridRendererCode);
  const hasUpdateGridData = /static updateGridData\(/.test(statusGridRendererCode);

  if (hasStaticRender) {
    console.log('  ✅ StatusGridRenderer has static render method');
  } else {
    console.log('  ❌ StatusGridRenderer missing static render method');
  }

  if (hasUpdateGridData) {
    console.log('  ✅ StatusGridRenderer has static updateGridData method');
  } else {
    console.log('  ❌ StatusGridRenderer missing static updateGridData method');
  }
} else {
  console.log('  ❌ StatusGridRenderer.js does not exist');
}

console.log(`\nTest 4 Result: ${statusGridRendererExists ? 'PASS' : 'FAIL'}\n`);

// Test 5: Verify all overlay types migrated
console.log('Test 5: All overlay types migrated check...');
const migratedTypes = ['text', 'button', 'line', 'apexchart', 'status_grid'];
const allMigrated = migratedTypes.every(type => {
  const pattern = new RegExp(`if \\(overlay\\.type === '${type}'\\)`);
  return pattern.test(advancedRendererCode);
});

if (allMigrated) {
  console.log(`  ✅ All overlay types migrated: ${migratedTypes.join(', ')}`);
} else {
  console.log(`  ❌ Not all overlay types migrated`);
}

console.log(`\nTest 5 Result: ${allMigrated ? 'PASS' : 'FAIL'}\n`);

// Final summary
console.log('═'.repeat(60));
console.log('📊 FINAL SUMMARY');
console.log('═'.repeat(60));

const totalTests = 5;
let totalPassed = 0;

if (passed === checks.length) totalPassed++;
if (integrationPassed === integrationChecks.length) totalPassed++;
if (!hasStatusGridInSwitch) totalPassed++;
if (statusGridRendererExists) totalPassed++;
if (allMigrated) totalPassed++;

console.log(`\nTests Passed: ${totalPassed}/${totalTests}`);
console.log(`Overall Status: ${totalPassed === totalTests ? '✅ PASS' : '❌ FAIL'}`);

if (totalPassed === totalTests) {
  console.log('\n🎉 StatusGridOverlay migration successful!');
  console.log('   ✅ Wrapper pattern implemented');
  console.log('   ✅ AdvancedRenderer integration complete');
  console.log('   ✅ All overlay types now instance-based');
  console.log('   ✅ Ready for Phase 3C cleanup');
} else {
  console.log('\n⚠️  Some tests failed - review issues above');
  process.exit(1);
}
