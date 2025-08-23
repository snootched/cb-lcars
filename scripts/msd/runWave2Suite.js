import { spawn } from 'child_process';

const tests = [
  'testAnchorMissingWave2.js',
  'testRulesCounters.js'
];

let i = 0;
let failed = false;

function runNext(){
  if (i >= tests.length){
    console.log(failed ? '[wave2] Suite FAILED' : '[wave2] Suite PASSED');
    process.exitCode = failed ? 1 : 0;
    return;
  }
  const file = tests[i++];
  console.log(`\n[wave2] Running ${file} ...`);
  const child = spawn(process.execPath, ['scripts/msd/' + file], { stdio:'inherit' });
  child.on('exit', code => {
    if (code) failed = true;
    runNext();
  });
}

runNext();
