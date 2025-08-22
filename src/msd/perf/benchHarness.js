/* Micro benchmark harness (Phase H)
   Run with: node src/msd/perf/benchHarness.js
   (Feature flag not required; directly exercises modules)
*/
import { mergePacks } from '../packs/mergePacks.js';
import { buildCardModel } from '../model/CardModel.js';
import { RulesEngine } from '../rules/RulesEngine.js';
import { resolveValueMaps } from '../valueMap/resolveValueMaps.js';
import { AnimationRegistry } from '../animation/AnimationRegistry.js';
import { resolveDesiredAnimations } from '../animation/resolveAnimations.js';
import { perfGetAll, perfTime } from './PerfCounters.js';

function makeConfig({ overlays = 200, rules = 50, animations = 10 }) {
  return {
    overlays: Array.from({ length: overlays }, (_, i) => ({
      id: 'ov_' + i,
      type: i % 5 === 0 ? 'line' : 'text',
      position: [ (i*7)%800, (i*11)%400 ],
      style: { value: 'OV'+i, color: 'var(--lcars-orange)', width: (i%5)+1 }
    })),
    rules: Array.from({ length: rules }, (_, i) => ({
      id: 'r_' + i,
      priority: (i % 10),
      when: { any: [
        { entity: 'sensor.cpu_temp', above: 40 + (i%30) },
        { entity: 'sensor.cpu_temp', below: 60 - (i%20) }
      ]},
      apply: {
        overlays: [
          { id: 'ov_' + (i % overlays), style: { color: 'var(--lcars-red)', width: 4 } }
        ]
      }
    })),
    animations: Array.from({ length: animations }, (_, i) => ({
      id: 'anim_' + i,
      preset: 'pulse',
      params: { duration: 1000 + i*50, loop: true }
    })),
    profiles: [],
    palettes: {}
  };
}

async function run() {
  const user = makeConfig({ overlays: 500, rules: 50, animations: 12 });
  const merged = mergePacks(user);
  const cardModel = await buildCardModel(merged);
  const rulesEngine = new RulesEngine(merged.rules);
  rulesEngine.markAllDirty();
  const animationIndex = new Map((merged.animations||[]).map(a => [a.id, a]));
  const animRegistry = new AnimationRegistry();

  const entities = { 'sensor.cpu_temp': { state: 55, attributes: {} } };

  function getEntity(id) { return entities[id]; }

  const overlaysBase = cardModel.overlaysBase.map(o => ({
    id: o.id, type: o.type, style: o.style, finalStyle: { ...o.style }, _raw: o.raw
  }));

  const ruleResult = rulesEngine.evaluateDirty({ getEntity });
  const patchesApplied = overlaysBase.map(o => ({ ...o }));
  // simple patch application
  ruleResult.overlayPatches.forEach(p => {
    const target = patchesApplied.find(x => x.id === p.overlayId);
    if (target) Object.assign(target.finalStyle, p.style);
  });

  resolveValueMaps(patchesApplied, { getEntity });

  const desiredAnimations = resolveDesiredAnimations(patchesApplied, animationIndex, ruleResult.animations);
  animRegistry.diffApply(desiredAnimations);

  const perf = perfGetAll();
  console.log('--- MSD Bench Results ---');
  Object.keys(perf).sort().forEach(k => console.log(k, perf[k]));
}

perfTime('bench.total', () => run());
