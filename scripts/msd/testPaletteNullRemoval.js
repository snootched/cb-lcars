import './testEnvBootstrap.js';
import { mergePacks } from '../../src/msd/packs/mergePacks.js';
import { installWindowStub, assert, pass, summarize } from './_testUtils.js';

installWindowStub();

// Seed core palette
window.__msdDebug.packs = window.__msdDebug.packs || {};
window.__msdDebug.packs.core = {
  palettes:{ default:{ keep:'#111', drop:'#222', override:'#333' } }
};

const userCfg = {
  use_packs:{ builtin:['core'] },
  palettes:{ default:{ drop: null, override:'#3a3a3a', add:'#444' } }
};

(async ()=>{
  const { merged } = await mergePacks(userCfg);
  const pal = merged.palettes.default;
  assert(pal.keep === '#111', 'keep token preserved');
  assert(!('drop' in pal), 'drop token removed via null');
  assert(pal.override === '#3a3a3a', 'override token replaced');
  assert(pal.add === '#444', 'added token present');
  pass('Palette null token removal & override');
  summarize('testPaletteNullRemoval');
})();
