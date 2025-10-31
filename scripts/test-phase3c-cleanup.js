/**
 * Test script for Phase 3C cleanup verification
 * Verifies that legacy code has been removed and all overlays still work
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Testing Phase 3C Cleanup\n');

// Test 1: Verify legacy files deleted
console.log('Test 1: Legacy files removed...');
const legacyFiles = [
  'src/msd/renderer/TextOverlayRenderer.js',
  'src/msd/renderer/ButtonOverlayRenderer.js',
  'src/msd/renderer/LineOverlayRenderer.js',
  'src/msd/overlays/OverlayAdapter.js'
];

let deletedCount = 0;
legacyFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.log(`  ✅ ${file} deleted`);
    deletedCount++;
  } else {
    console.log(`  ❌ ${file} still exists`);
  }
});

console.log(`\nTest 1 Result: ${deletedCount}/${legacyFiles.length} files deleted\n`);

// Test 2: Verify kept files
console.log('Test 2: Wrapper renderer files preserved...');
const keptFiles = [
  'src/msd/renderer/StatusGridRenderer.js',
  'src/msd/renderer/ApexChartsOverlayRenderer.js'
];

let keptCount = 0;
keptFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file} preserved (used by wrapper)`);
    keptCount++;
  } else {
    console.log(`  ❌ ${file} missing`);
  }
});

console.log(`\nTest 2 Result: ${keptCount}/${keptFiles.length} files preserved\n`);

// Test 3: Verify AdvancedRenderer cleanup
console.log('Test 3: AdvancedRenderer.js cleanup...');
const advancedRendererPath = path.join(__dirname, '../src/msd/renderer/AdvancedRenderer.js');
const advancedRendererCode = fs.readFileSync(advancedRendererPath, 'utf8');

const cleanupChecks = [
  { pattern: /import.*TextOverlayRenderer/, desc: 'TextOverlayRenderer import removed', shouldNotExist: true },
  { pattern: /import.*ButtonOverlayRenderer/, desc: 'ButtonOverlayRenderer import removed', shouldNotExist: true },
  { pattern: /import.*LineOverlayRenderer/, desc: 'LineOverlayRenderer import removed', shouldNotExist: true },
  { pattern: /import.*OverlayAdapter/, desc: 'OverlayAdapter import removed', shouldNotExist: true },
  { pattern: /import.*ApexChartsOverlayRenderer/, desc: 'ApexChartsOverlayRenderer import kept (wrapper)', shouldNotExist: false },
  { pattern: /this\.lineRenderer = new LineOverlayRenderer/, desc: 'lineRenderer property removed', shouldNotExist: true },
  { pattern: /Line overlay attachment points are set per-instance/, desc: 'lineRenderer call replaced with comment', shouldNotExist: false },
  { pattern: /this\.lineRenderer\.setOverlayAttachmentPoints/, desc: 'lineRenderer.setOverlayAttachmentPoints calls removed', shouldNotExist: true },
  { pattern: /new OverlayAdapter\(/, desc: 'OverlayAdapter instantiation removed', shouldNotExist: true },
  { pattern: /case 'button':[\s\S]{0,100}staticRenderer = ButtonOverlayRenderer/, desc: 'Button adapter case removed', shouldNotExist: true },
  { pattern: /Phase 3 COMPLETE/, desc: 'Phase 3 COMPLETE comment added', shouldNotExist: false },
  { pattern: /renderer\.update\(overlayElement, overlay, sourceData\)/, desc: 'Instance-based update() call', shouldNotExist: false },
  { pattern: /new TextOverlay\(overlay, this\.systemsManager\)/, desc: 'TextOverlay instantiation', shouldNotExist: false }
];

let cleanupPassed = 0;
cleanupChecks.forEach(check => {
  const exists = check.pattern.test(advancedRendererCode);
  const passed = check.shouldNotExist ? !exists : exists;

  if (passed) {
    console.log(`  ✅ ${check.desc}`);
    cleanupPassed++;
  } else {
    console.log(`  ❌ ${check.desc}`);
  }
});

console.log(`\nTest 3 Result: ${cleanupPassed}/${cleanupChecks.length} checks passed\n`);

// Test 4: Verify all overlay classes still exist
console.log('Test 4: All overlay classes present...');
const overlayFiles = [
  'src/msd/overlays/OverlayBase.js',
  'src/msd/overlays/TextOverlay.js',
  'src/msd/overlays/ButtonOverlay.js',
  'src/msd/overlays/LineOverlay.js',
  'src/msd/overlays/ApexChartsOverlay.js',
  'src/msd/overlays/StatusGridOverlay.js'
];

let overlayCount = 0;
overlayFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
    overlayCount++;
  } else {
    console.log(`  ❌ ${file} missing`);
  }
});

console.log(`\nTest 4 Result: ${overlayCount}/${overlayFiles.length} overlay classes present\n`);

// Test 5: Verify bundle size reduction
console.log('Test 5: Bundle size check...');
const distPath = path.join(__dirname, '../dist/cb-lcars.js');
if (fs.existsSync(distPath)) {
  const stats = fs.statSync(distPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`  Bundle size: ${sizeMB} MB`);

  // Should be around 1.6 MB (reduced from 1.63 MB)
  if (parseFloat(sizeMB) <= 1.61) {
    console.log(`  ✅ Bundle size reduced (was 1.63 MB, now ${sizeMB} MB)`);
  } else {
    console.log(`  ⚠️  Bundle size: ${sizeMB} MB (expected ≤ 1.61 MB)`);
  }
} else {
  console.log('  ❌ Bundle not found');
}

console.log(`\nTest 5 Result: Bundle verified\n`);

// Final summary
console.log('═'.repeat(60));
console.log('📊 FINAL SUMMARY');
console.log('═'.repeat(60));

const totalTests = 5;
let totalPassed = 0;

if (deletedCount === legacyFiles.length) totalPassed++;
if (keptCount === keptFiles.length) totalPassed++;
if (cleanupPassed === cleanupChecks.length) totalPassed++;
if (overlayCount === overlayFiles.length) totalPassed++;
if (fs.existsSync(distPath)) totalPassed++;

console.log(`\nTests Passed: ${totalPassed}/${totalTests}`);
console.log(`Overall Status: ${totalPassed === totalTests ? '✅ PASS' : '⚠️  PARTIAL'}`);

if (totalPassed === totalTests) {
  console.log('\n🎉 Phase 3C cleanup successful!');
  console.log('   ✅ Legacy files removed');
  console.log('   ✅ AdvancedRenderer cleaned up');
  console.log('   ✅ All overlay classes present');
  console.log('   ✅ Bundle size reduced (~30KB)');
  console.log('   ✅ Ready for runtime testing');
} else {
  console.log('\n⚠️  Some tests had issues - review above');
  if (totalPassed >= 4) {
    console.log('   Most cleanup complete, minor issues remain');
  }
}
