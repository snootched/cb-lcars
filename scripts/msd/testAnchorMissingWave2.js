import './testEnvBootstrap.js';
import { mergePacks } from '../../src/msd/packs/mergePacks.js';
import { initMsdPipeline } from '../../src/msd/index.js';
import { installWindowStub, assert, pass, summarize } from './_testUtils.js';

installWindowStub();

const cfg = {
  overlays:[
    { id:'o_bad1', type:'line', anchor:'no_anchor_a', attach_to:'no_anchor_b' },
    { id:'o_bad2', type:'line', anchor:'no_anchor_a', attach_to:'still_missing' },
    { id:'o_ok', type:'line', anchor:[10,10], attach_to:[20,20] }
  ],
  rules:[]
};

(async ()=>{
  const { merged } = await mergePacks(cfg);
  const pipe = await initMsdPipeline(merged, undefined);
  const errs = window.__msdDebug?.validation?.issues()?.errors || [];
  const missing = errs.filter(e=>e.code==='anchor.missing');
  assert(missing.length >= 2, `Expected >=2 anchor.missing errors, got ${missing.length}`);
  pass('anchor.missing validation emits errors');
  summarize('testAnchorMissingWave2');
})();
