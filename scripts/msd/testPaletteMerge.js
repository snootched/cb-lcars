import './testEnvBootstrap.js';
import { mergePacks } from '../../src/msd/packs/mergePacks.js';
import { installWindowStub, assert, pass, summarize } from './_testUtils.js';

installWindowStub();

// Simulate builtin core providing palette default tokens
window.__msdDebug.packs = window.__msdDebug.packs || {};
window.__msdDebug.packs.core = {
  palettes:{ default:{ a:'#111', b:'#222', c:'#333' } }
};

const userMsd = {
  use_packs:{ builtin:['core'] },
  palettes:{ default:{ b:'#2b2b2b', d:'#444' } }
};

(async ()=>{
  const { merged } = await mergePacks(userMsd);
  const pal = merged.palettes.default;
  assert(pal.a === '#111', 'Token a preserved');
  assert(pal.b === '#2b2b2b', 'Token b overridden');
  assert(pal.c === '#333', 'Token c preserved');
  assert(pal.d === '#444', 'Token d added');
  pass('Deep palette token merge works');
  summarize('testPaletteMerge');
})();

