import './testEnvBootstrap.js';
import { initMsdPipeline } from '../../src/msd/index.js';
import { installWindowStub, assert, pass, summarize } from './_testUtils.js';

installWindowStub();

const cfg = {
  overlays:[ { id:'ov1', type:'line', anchor:[0,0], attach_to:[10,10] } ],
  rules:[
    { id:'r1', priority:5, when:{ all:[{ entity:'sensor.demo', above:5 }] }, apply:{} },
    { id:'r2', priority:1, when:{ all:[{ entity:'sensor.demo', below:100 }] }, apply:{} }
  ]
};

(async ()=>{
  await initMsdPipeline(cfg, undefined);
  const counters = window.__msdDebug?.__perfStore?.counters || {};
  const evalCount = counters['rules.eval.count'] || 0;
  assert(evalCount >= 2, `rules.eval.count should be >=2 (got ${evalCount})`);
  pass('rules.eval.count counter increments');
  summarize('testRulesCounters');
})();
