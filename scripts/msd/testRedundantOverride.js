import './testEnvBootstrap.js';
import { mergePacks } from '../../src/msd/packs/mergePacks.js';
import { installWindowStub, assert, pass, summarize } from './_testUtils.js';

installWindowStub();

// Simulate core overlay
window.__msdDebug.packs = window.__msdDebug.packs || {};
window.__msdDebug.packs.core = {
  overlays:[ { id:'o1', type:'line', style:{ color:'#123', width:2 } } ]
};

// User overrides with identical body (redundant)
const userMsd = {
  use_packs:{ builtin:['core'] },
  overlays:[ { id:'o1', type:'line', style:{ color:'#123', width:2 } } ]
};

async function run(){
  await mergePacks(userMsd);
  const warnings = (global.__issues||[]).filter(i=>i.code==='pack.override.redundant');
  assert(warnings.length === 1, `Expected exactly 1 redundant override warning, got ${warnings.length}`);
  pass('Redundant override emits single warning');
  summarize('testRedundantOverride');
}
run();
