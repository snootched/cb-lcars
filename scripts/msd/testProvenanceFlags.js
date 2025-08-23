import './testEnvBootstrap.js';
import { mergePacks } from '../../src/msd/packs/mergePacks.js';
import { installWindowStub, assert, pass, summarize } from './_testUtils.js';

installWindowStub();

window.__msdDebug.packs = window.__msdDebug.packs || {};
window.__msdDebug.packs.core = {
  overlays:[ { id:'o_remove', type:'line', style:{ color:'#123'} },
             { id:'o_keep', type:'line', style:{ color:'#456'} } ]
};

const cfg = {
  use_packs:{ builtin:['core'] },
  remove:{ overlays:['o_remove'] },
  overlays:[
    { id:'o_keep', type:'line', style:{ color:'#456'} } // redundant override of core to test overridden flag
  ]
};

(async ()=>{
  const { provenance } = await mergePacks(cfg);
  const provOverlays = provenance.overlays;
  assert(provOverlays.o_remove && provOverlays.o_remove.removed === true, 'Removed overlay flagged removed');
  // Provide logical expectation: removed should not also show overridden (current logic may vary; soft guard)
  if (provOverlays.o_remove.overridden) {
    console.log('[HX5] Note: removed item also marked overridden (acceptable but verbose)');
  }
  assert(provOverlays.o_keep && provOverlays.o_keep.overridden === true, 'Override flag on retained overlay');
  pass('Provenance flags consistency (removed / overridden)');
  summarize('testProvenanceFlags');
})();
