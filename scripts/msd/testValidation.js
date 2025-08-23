import './testEnvBootstrap.js';
import { mergePacks } from '../../src/msd/packs/mergePacks.js';
import { validateMerged } from '../../src/msd/validation/validateMerged.js';
import { installWindowStub, assert, pass, summarize } from './_testUtils.js';

installWindowStub();

const cfg = {
  overlays:[ { id:'o1', type:'line', anchor:'nonexistent_anchor', attach_to:'o1' } ],
  rules:[]
};

(async ()=>{
  const { merged } = await mergePacks(cfg);
  const issues = validateMerged(merged);
  // NOTE: anchor.missing not yet implemented; ensure no crash
  assert(issues && issues.errors !== undefined, 'validateMerged returns issues object');
  console.log('[INFO] anchor.missing check pending (will assert once implemented)');
  pass('Validation basic invocation');
  summarize('testValidation');
})();
