import './testEnvBootstrap.js';
import { mergePacks } from '../../src/msd/packs/mergePacks.js';
import { installWindowStub, assert, pass, summarize } from './_testUtils.js';

installWindowStub();

const cfg = {
  remove: { overlays:['does_not_exist'] }
};

(async ()=>{
  await mergePacks(cfg);
  const warns = (global.__issues||[]).filter(i=>i.code==='pack.removal.unknown');
  assert(warns.length >= 1, `Expected pack.removal.unknown warning, got ${warns.length}`);
  pass('Global removal unknown id warning present');
  summarize('testGlobalRemovalUnknown');
})();
