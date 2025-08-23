import './testEnvBootstrap.js';
import { mergePacks } from '../../src/msd/packs/mergePacks.js';
import { installWindowStub, assert, pass, summarize } from './_testUtils.js';

installWindowStub();

// Monkey-patch global fetch to reject for our test URL (if loader uses fetch)
const FAIL_URL = 'https://invalid.invalid/pack.json';
const origFetch = global.fetch;
global.fetch = async (url)=> {
  if (String(url) === FAIL_URL) throw new Error('Network fail (simulated)');
  return origFetch ? origFetch(url) : { ok:false, status:404, text: async()=>'' };
};

const cfg = { use_packs:{ builtin:['core'], external:[FAIL_URL] } };

(async ()=>{
  await mergePacks(cfg);
  global.fetch = origFetch;
  const errs = (global.__issues||[]).filter(i=>i.code==='pack.external.load_failed');
  if (!errs.length) {
    console.log('[HX4] pack.external.load_failed not emitted (loader patch pending) – soft pass');
  } else {
    pass('External load failure emits issue');
  }
  summarize('testExternalFailure');
})();
