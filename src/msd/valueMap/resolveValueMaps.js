import { perfInc, perfTime } from '../perf/PerfCounters.js';
import { linearMap } from '../util/linearMap.js';

export function resolveValueMaps(resolvedOverlays, ctx) {
  return perfTime('value_map.resolve', () => {
    let success = 0;
    let fail = 0;

    for (const ov of resolvedOverlays) {
      if (!ov.finalStyle) continue;
      ov.finalStyle = walk(ov.finalStyle);
    }

    perfInc('value_map.resolve.count', success);
    perfInc('value_map.fail.count', fail);

    function walk(node) {
      if (!node || typeof node !== 'object') return node;
      // value_map descriptor: exact shape { value_map: {...} } OR object with only that key
      if (node.value_map && Object.keys(node).length === 1) {
        const val = computeValueMap(node.value_map);
        return val;
      }
      // Recurse
      if (Array.isArray(node)) return node.map(walk);
      const out = {};
      for (const k of Object.keys(node)) {
        out[k] = walk(node[k]);
      }
      return out;
    }

    function computeValueMap(desc) {
      try {
        const entityId = desc.entity;
        if (!entityId) { fail++; return fallback(desc); }
        const ent = ctx?.getEntity ? ctx.getEntity(entityId) : null;
        if (!ent) { fail++; return fallback(desc); }
        let raw = ent.state;
        if (desc.attribute && ent.attributes) raw = ent.attributes[desc.attribute];
        let num = Number(raw);
        if (!Number.isFinite(num)) { fail++; return fallback(desc); }
        const [inA, inB] = desc.input || [];
        const [outA, outB] = desc.output || [];
        if (![inA,inB,outA,outB].every(Number.isFinite)) { fail++; return fallback(desc); }
        let mapped = linearMap(num, inA, inB, outA, outB, !!desc.clamp);
        if (Number.isFinite(desc.round)) {
          const pow = Math.pow(10, desc.round);
          mapped = Math.round(mapped * pow) / pow;
        }
        success++;
        return mapped;
      } catch {
        fail++;
        return fallback(desc);
      }
    }
    function fallback(desc) {
      if (desc && Number.isFinite(desc.default)) return desc.default;
      if (Array.isArray(desc?.output) && Number.isFinite(desc.output[0])) return desc.output[0];
      return 1; // minimal visible default
    }
  });
}
