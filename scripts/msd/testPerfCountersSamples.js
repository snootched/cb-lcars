import './testEnvBootstrap.js';
import { mergePacks } from '../../src/msd/packs/mergePacks.js';
import { installWindowStub, assert, pass, summarize } from './_testUtils.js';

installWindowStub();

const cfg = { overlays:[ { id:'p1', type:'line', style:{ color:'#fff'} } ] };

(async ()=>{
  await mergePacks(cfg);
  await mergePacks(cfg);
  await mergePacks(cfg);
  const store = window.__msdDebug?.__perfStore;
  const timing = store?.timings?.['packs.merge.ms'];
  assert(timing && timing.samples >= 3, `Expected ≥3 samples, got ${(timing && timing.samples) || 0}`);
  pass('Perf counter samples accumulate');
  summarize('testPerfCountersSamples');
})();
