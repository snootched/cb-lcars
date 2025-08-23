import './testEnvBootstrap.js';
import { mergePacks } from '../../src/msd/packs/mergePacks.js';
import { exportCollapsed } from '../../src/msd/packs/mergePacks.js';
import { stableStringify } from '../../src/msd/packs/checksum.js';
import { installWindowStub, assert, pass, summarize, snapshot } from './_testUtils.js';

installWindowStub();

window.__msdDebug.packs = window.__msdDebug.packs || {};
window.__msdDebug.packs.core = {
  overlays:[ { id:'o1', type:'line', style:{ color:'#111', width:2 } } ],
  rules:[ { id:'r1', priority:5, when:{ all:[] }, apply:{} } ],
  palettes:{ default:{ a:'#1', b:'#2' } }
};

// Fixture (similar but with a redundant override scenario)
const userMsd = {
  use_packs: { builtin:['core'] },
  animations: [
    { id:'a1', preset:'pulse', params:{ duration:1200 } },
    { id:'a1', preset:'pulse', params:{ duration:1200 } } // redundant override
  ],
  overlays: [
    { id:'o1', type:'line', anchor:'p1', attach_to:'p2', style:{ color:'#0f0', width:4 } }
  ],
  anchors: { p1:[0,0], p2:[50,50] },
  remove: {}
};

(async ()=>{
  const first = await mergePacks(userMsd);
  const collapsed = exportCollapsed(userMsd);
  const second = await mergePacks(collapsed); // collapsed should represent user layer only
  const s1 = snapshot(first.merged, stableStringify);
  const s2 = snapshot(second.merged, stableStringify);
  assert(s1 === s2, 'Round-trip collapsed export parity snapshot mismatch');
  pass('Collapsed export parity');
  summarize('testExportParity');
})();
