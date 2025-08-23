import { spawn } from 'child_process';
const tests = [
  'testStableStringify.js',
  'testMergeDeterminism.js',
  'testPaletteMerge.js',
  'testExternalDeterminism.js',
  'testValidation.js',
  'testRedundantOverride.js',
  'testExportParity.js',
  // NEW HX (headless extended) tests
  'testAnchorMissing.js',
  'testGlobalRemovalUnknown.js',
  'testPaletteNullRemoval.js',
  'testExternalFailure.js',
  'testProvenanceFlags.js',
  'testPerfCountersSamples.js'
];

let idx = 0;
let failed = false;

function runNext(){
  if (idx >= tests.length){
    if (failed) {
      console.error('[wave1] Suite FAILED');
      process.exitCode = 1;
    } else {
      console.log('[wave1] Suite PASSED');
    }
    return;
  }
  const file = tests[idx++];
  console.log(`\n[wave1] Running ${file} ...`);
  const child = spawn(process.execPath, ['scripts/msd/'+file], { stdio:'inherit' });
  child.on('exit', code=>{
    if (code) failed = true;
    runNext();
  });
}

runNext();
