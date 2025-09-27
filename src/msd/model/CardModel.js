import { perfTime } from '../perf/PerfCounters.js';

export async function buildCardModel(mergedConfig) {
  return perfTime('cardModel.build', () => {
    // Phase A: implement viewBox:auto + SVG anchor extraction + percent resolution.
    const viewBox = [0, 0, 400, 200];
    const anchors = {}; // merged + normalized numeric
    const overlaysBase = mergedConfig.overlays.map(o => ({ id: o.id, type: o.type, style: o.style || {}, raw: o }));

    return { viewBox, anchors, overlaysBase, __raw: mergedConfig };
  });
}
