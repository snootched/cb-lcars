import './testEnvBootstrap.js';
import { mergePacks } from '../../src/msd/packs/mergePacks.js';
import { stableStringify } from '../../src/msd/packs/checksum.js';
import { installWindowStub, assert, pass, summarize, snapshot } from './_testUtils.js';

installWindowStub();

// Simple fixture (no external packs needed)
const userMsd = {
  version:1,
  use_packs: { builtin:['core'] },
  palettes: { default: { a:'#111', b:'#222' } },
  overlays: [
    { id:'o1', type:'line', style:{ color:'#f00', width:2 } },
    { id:'o2', type:'line', style:{ color:'#0f0', width:2 } }
  ],
  rules: [
    { id:'r1', priority:5, when:{ all:[{ entity:'sensor.x', above:10 }] }, apply:{ overlays:[{ id:'o1', style:{ color:'#ff0' } }] } }
  ]
};

async function run(){
  const r1 = await mergePacks(userMsd);
  const r2 = await mergePacks(userMsd);
  const snapMerged1 = snapshot(r1.merged, stableStringify);
  const snapMerged2 = snapshot(r2.merged, stableStringify);
  console.log('[mergeDeterminism] snapshot1=', snapMerged1, 'snapshot2=', snapMerged2); // ADDED
  assert(snapMerged1 === snapMerged2, 'Merged snapshot hashes must match across identical merges');

  // Compare per-item checksums for overlays & rules
  const prov1 = r1.provenance;
  const prov2 = r2.provenance;
  for (const coll of ['overlays','rules']){
    const ids = Object.keys(prov1[coll]);
    ids.forEach(id=>{
      assert(prov1[coll][id].checksum === prov2[coll][id].checksum, `Checksum mismatch ${coll}:${id}`);
    });
  }

  pass('Deterministic merge stable across runs');
  summarize('testMergeDeterminism');
}
run();
