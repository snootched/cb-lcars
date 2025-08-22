import { computeChecksum, stableStringify } from './checksum.js';
import { loadExternalPack } from './externalPackLoader.js';
import { getBuiltinPack } from './builtinPacks.js';

const COLLECTIONS = ['animations','rules','profiles','overlays','timelines'];

function empty(){
  return { animations:[], rules:[], profiles:[], overlays:[], timelines:[], palettes:{}, anchors:{}, routing:{}, active_profiles:[] };
}

function clone(o){ return JSON.parse(JSON.stringify(o)); }

function keyedIndex(arr){ const m=new Map(); (arr||[]).forEach(it=>m.set(it.id,it)); return m; }

function layerKeyed(baseArr=[], addArr=[], origin) {
  const outIndex = keyedIndex(baseArr);
  (addArr||[]).forEach(item => {
    if (!item || !item.id) return;
    if (item.remove === true) {
      outIndex.delete(item.id);
      return;
    }
    const existing = outIndex.get(item.id);
    if (existing) {
      const prevChecksum = existing.checksum;
      const merged = deepMergeShallow(existing, item);
      markProvenance(merged, origin, existing, prevChecksum);
      outIndex.set(item.id, merged);
    } else {
      const fresh = clone(item);
      markProvenance(fresh, origin, null, null);
      outIndex.set(fresh.id, fresh);
    }
  });
  return Array.from(outIndex.values());
}

function markProvenance(obj, origin_pack, prev, prevChecksum) {
  obj.origin_pack = origin_pack;
  obj.origin_version = obj.origin_version || 'unknown';
  const coreStripped = clone(obj);
  delete coreStripped.overridden;
  obj.checksum = computeChecksum(coreStripped);
  if (prev) {
    if (obj.checksum !== prev.checksum) {
      obj.overridden = true;
      obj.override_layer = origin_pack;
      obj.diverged_from_checksum = prevChecksum;
    } else {
      obj.overridden = true;
      obj.override_layer = origin_pack;
      obj.redundant_override = true;
    }
  }
}

function deepMergeShallow(base, over) {
  const out = clone(base);
  Object.keys(over).forEach(k => {
    const v = over[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = { ...out[k], ...v };
    } else {
      out[k] = clone(v);
    }
  });
  return out;
}

function applyGlobalRemovals(collection, removalIds = []) {
  if (!removalIds.length) return collection;
  const set = new Set(removalIds);
  return collection.filter(it => !set.has(it.id));
}

function diffEqual(a,b){
  return stableStringify(a) === stableStringify(b);
}

function ensurePerf(){
  const W = window;
  W.__msdDebug = W.__msdDebug || {};
  if (!W.__msdDebug.__perfStore){
    const store = { counters:{}, timers:{} };
    W.__msdDebug.__perfStore = store;
    if (!W.__msdDebug.perf){
      W.__msdDebug.perf = ()=> {
        const snap = {};
        Object.entries(store.counters).forEach(([k,v])=> snap[k]=v);
        return snap;
      };
    }
  }
  return W.__msdDebug.__perfStore;
}

function perfAdd(key, val){
  const s = ensurePerf();
  if (typeof val === 'number'){
    s.counters[key] = val;
  } else {
    s.counters[key] = (s.counters[key]||0)+1;
  }
}

export async function mergePacks(userMsd){
  const t0 = performance.now();
  const dbg = window.__msdDebug || {};
  // Layer stubs (core + builtin/external not yet implemented → placeholders)
  const corePack = dbg.packs?.core || { animations:[], rules:[], profiles:[], overlays:[], timelines:[] };
  const builtinIds = (userMsd?.use_packs?.builtin) || ['core'];
  const externalUrls = (userMsd?.use_packs?.external) || [];
  const builtinLayers = builtinIds.filter(id=> id!=='core').map(id=>({ type:`builtin:${id}`, data: dbg.packs?.builtin?.[id] || {} }));
  const externalLayers = externalUrls.map(u=>({ type:`external:${u}`, data: dbg.packs?.external?.[u] || {} }));
  const userLayer = { type:'user', data: userMsd || {} };
  const layers = [
    { type:'builtin:core', data: corePack },
    ...builtinLayers,
    ...externalLayers,
    userLayer
  ];

  const acc = empty();
  const provenance = { animations:{}, rules:{}, profiles:{}, overlays:{}, timelines:{} };
  const baseline = {}; // first occurrence by id per collection

  function upsert(coll, item, origin){
    if (!item || !item.id) return;
    const list = acc[coll];
    const existingIdx = list.findIndex(x=>x.id===item.id);
    const cloned = shallowClone(item);
    delete cloned.remove;
    if (existingIdx === -1){
      list.push(cloned);
      baseline[coll] = baseline[coll] || {};
      baseline[coll][item.id] = shallowClone(cloned);
      provenance[coll][item.id] = { origin_pack: origin, origin_version:'unknown', overridden:false };
    } else {
      // override
      const prevProv = provenance[coll][item.id];
      const prevBaseline = baseline[coll][item.id];
      const prevEffective = list[existingIdx];
      list[existingIdx] = cloned;
      provenance[coll][item.id] = {
        origin_pack: prevProv.origin_pack,
        origin_version: prevProv.origin_version,
        overridden:true,
        override_layer: origin,
        diverged_from_checksum: prevProv.checksum || undefined
      };
      // Redundant override detection (exact structural match)
      if (diffEqual(prevEffective, cloned)){
        emitIssue({
          severity:'warn',
          code:'pack.override.redundant',
          msg:`Redundant override (${coll}:${item.id}) layer=${origin}`
        });
      } else if (diffEqual(prevBaseline, cloned)){
        emitIssue({
          severity:'warn',
          code:'pack.override.redundant',
          msg:`Override identical to baseline (${coll}:${item.id})`
        });
      }
    }
  }

  function emitIssue(issue){
    try {
      window.__msdDebug?.hud?.publishIssue && window.__msdDebug.hud.publishIssue(issue);
    } catch {}
  }

  // Inline removals
  function applyInlineRemoval(coll, id, origin){
    const list = acc[coll];
    const before = list.length;
    for (let i=list.length-1;i>=0;i--){
      if (list[i].id===id) list.splice(i,1);
    }
    if (before===list.length){
      emitIssue({ severity:'warn', code:'pack.removal.unknown', msg:`Inline remove ID not found (${coll}:${id}) origin=${origin}` });
    } else {
      provenance[coll][id] = {
        origin_pack: origin,
        origin_version:'unknown',
        overridden:false,
        removed:true
      };
    }
  }

  // Process layers
  for (const layer of layers){
    for (const coll of COLLECTIONS){
      const items = layer.data?.[coll] || [];
      items.forEach(it=>{
        if (it && it.remove===true){
          applyInlineRemoval(coll, it.id, layer.type);
        } else {
          upsert(coll, it, layer.type);
        }
      });
    }
    // Non-keyed merges (palettes, anchors, routing) – shallow / last wins
    if (layer.data?.palettes){
      acc.palettes = { ...(acc.palettes||{}), ...layer.data.palettes };
    }
    if (layer.data?.anchors){
      acc.anchors = { ...(acc.anchors||{}), ...layer.data.anchors };
    }
    if (layer.data?.routing){
      acc.routing = { ...(acc.routing||{}), ...layer.data.routing };
    }
    if (Array.isArray(layer.data?.active_profiles)){
      acc.active_profiles = layer.data.active_profiles.slice();
    }
  }

  // Global removal lists
  const globalRemove = userMsd?.remove || {};
  for (const coll of COLLECTIONS){
    const ids = globalRemove[coll] || [];
    if (ids.length){
      const list = acc[coll];
      ids.forEach(rmId=>{
        const idx = list.findIndex(x=>x.id===rmId);
        if (idx===-1){
          emitIssue({ severity:'warn', code:'pack.removal.unknown', msg:`Global remove ID not found (${coll}:${rmId})` });
        } else {
            list.splice(idx,1);
            provenance[coll][rmId] = {
              ...(provenance[coll][rmId]||{ origin_pack:'user', origin_version:'unknown' }),
              removed:true
            };
        }
      });
    }
  }

  // Checksums
  for (const coll of COLLECTIONS){
    for (const item of acc[coll]){
      const prov = provenance[coll][item.id];
      if (prov){
        // strip meta for checksum
        const pure = shallowClone(item);
        prov.checksum = await computeChecksum(pure);
      }
    }
  }

  // Perf metrics
  const ms = performance.now() - t0;
  perfAdd('packs.merge.ms', ms);
  perfAdd('packs.items.total', COLLECTIONS.reduce((a,c)=> a+acc[c].length,0));
  perfAdd('packs.items.overridden', COLLECTIONS.reduce((a,c)=> a+Object.values(provenance[c]).filter(p=>p.overridden).length,0));

  return { merged:acc, provenance };
}

export function exportCollapsed(userMsd){
  // Minimal: remove provenance, keep declared use_packs and remove lists
  const out = {};
  const keep = ['version','use_packs','anchors','overlays','animations','rules','profiles','timelines','palettes','routing','active_profiles','remove'];
  keep.forEach(k=> { if (userMsd && userMsd[k] !== undefined) out[k]=userMsd[k]; });
  return out;
}

// Auto-attach helpers once
(function attach(){
  try {
    const W = window;
    W.__msdDebug = W.__msdDebug || {};
    W.__msdDebug.packs = W.__msdDebug.packs || {};
    if (!W.__msdDebug.packs.mergePacks){
      W.__msdDebug.packs.mergePacks = mergePacks;
      W.__msdDebug.exportCollapsed = ()=> exportCollapsed(W.__msdDebug._hudUserMsdConfig||{});
    }
  } catch {}
})();

