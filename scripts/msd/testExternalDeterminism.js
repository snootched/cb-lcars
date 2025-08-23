import './testEnvBootstrap.js';
import { mergePacks } from '../../src/msd/packs/mergePacks.js';
import { installWindowStub, pass, summarize } from './_testUtils.js';

installWindowStub();

// Enable external flag
window.__msdDebug.featureFlags.msd_external_enabled = true;

// Stub fetch with randomized latency
const originalFetch = global.fetch;
function fakeFetchFactory(latencySeed){
  return (url)=>{
    const yamlA = `animations:\n  - id: a_ext\n    preset: pulse\n    params: { duration: 500 }\n`;
    const yamlB = `rules:\n  - id: r_ext\n    when: { all: [] }\n    apply: { overlays: [] }\n`;
    const map = {
      'https://example.com/packA.yaml': yamlA,
      'https://example.com/packB.yaml': yamlB
    };
    if(!map[url]) return Promise.resolve(new Response('',{ status:404 }));
    const min=10,max=60;
    const jitter = (latencySeed * url.length) % (max-min) + min;
    return new Promise(res=>{
      setTimeout(()=>{
        res(new Response(map[url], { status:200 }));
      }, jitter);
    });
  };
}

async function runOnce(seed){
  global.fetch = fakeFetchFactory(seed);
  const user = {
    use_packs:{
      external:[
        'https://example.com/packA.yaml',
        'https://example.com/packB.yaml'
      ]
    }
  };
  const { provenance } = await mergePacks(user);
  const animCsum = provenance.animations.a_ext?.checksum;
  const ruleCsum = provenance.rules.r_ext?.checksum;
  return { animCsum, ruleCsum };
}

async function run(){
  const r1 = await runOnce(7);
  const r2 = await runOnce(123);
  global.fetch = originalFetch;

  const pass = r1.animCsum === r2.animCsum && r1.ruleCsum === r2.ruleCsum;
  console.log('[test:external] run1', r1, 'run2', r2);
  if(!pass){
    console.error('[test:external] FAIL deterministic ordering / checksum');
    process.exitCode = 1;
  } else {
    console.log('[test:external] PASS deterministic');
  }
}

// TODO: Implement async fetch order scramble + sorted layering assertion.
console.log('[INFO] testExternalDeterminism skipped (pending external fetch harness)');
pass('External determinism (placeholder)');
summarize('testExternalDeterminism');

run();
