import { computeChecksum, stableStringify } from './checksum.js';
import { loadExternalPack } from './externalPackLoader.js';
import { getBuiltinPack } from './builtinPacks.js';

const COLLECTIONS = ['animations','rules','profiles','overlays','timelines'];

function empty(){
  return { animations:[], rules:[], profiles:[], overlays:[], timelines:[], palettes:{}, anchors:{}, routing:{}, active_profiles:[] };
}
function shallowClone(o){ return o && typeof o==='object' ? JSON.parse(JSON.stringify(o)) : o; }

function ensurePerfStore(){
  const W = window;
  W.__msdDebug = W.__msdDebug || {};
  const store = W.__msdDebug.__perfStore = W.__msdDebug.__perfStore || { timers:{}, counters:{}, timings:{} };
  if (!W.__msdDebug.perf){
    W.__msdDebug.perf = ()=> {
      const snap = {};
      Object.entries(store.counters).forEach(([k,v])=> snap[k]=v);
      Object.entries(store.timings).forEach(([k,v])=> snap[k]=v);
      return snap;
    };
  }
  return store;
}
function perfTiming(key, ms){
  const s = ensurePerfStore();
  const t = s.timings[key] = s.timings[key] || { last:0,totalMs:0,samples:0,avg:0 };
  t.last = ms;
  t.totalMs += ms;
  t.samples += 1;
  t.avg = +(t.totalMs / t.samples).toFixed(2);
}
function perfCount(key, inc=1){
  const s = ensurePerfStore();
  s.counters[key] = (s.counters[key]||0)+inc;
}
function emitIssue(issue){
  try {
    window.__msdDebug?.hud?.publishIssue && window.__msdDebug.hud.publishIssue(issue);
  } catch {}
}

function deepMergePalettes(base, incoming){
  if (!incoming || typeof incoming !== 'object') return base;
  Object.keys(incoming).forEach(palName=>{
    const tokens = incoming[palName];
    if (tokens && typeof tokens === 'object' && !Array.isArray(tokens)){
      base[palName] = base[palName] || {};
      Object.keys(tokens).forEach(tok=>{
        const v = tokens[tok];
        if (v === null){
          delete base[palName][tok];
        } else {
          base[palName][tok] = v;
        }
      });
    } else {
      emitIssue({ severity:'error', code:'pack.palette.merge.error', msg:`Invalid palette map for ${palName}` });
    }
  });
  return base;
}

function diffEqual(a,b){ return stableStringify(a) === stableStringify(b); }

function normalizedString(obj){
  // Recursively sort keys for a quick structural equality check (independent of stableStringify impl details)
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(v=>normalizedString(v)).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k=>JSON.stringify(k)+':'+normalizedString(obj[k])).join(',') + '}';
}
// NEW: canonical item normalization (strip meta-ish fields, recurse & sort keys)
function canonicalItem(obj){
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalItem);
  const skip = new Set(['origin_pack','origin_version','checksum','overridden','override_layer','diverged_from_checksum','removed','removal_source']);
  const out = {};
  Object.keys(obj).sort().forEach(k=>{
    if (skip.has(k)) return;
    out[k] = canonicalItem(obj[k]);
  });
  return out;
}
function canonicalKey(obj){
  return normalizedString(canonicalItem(obj));
}

// NEW: strict deep equality helper (order-insensitive for object keys)
function deepEqual(a,b){
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (!a || !b) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i=0;i<a.length;i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === 'object') {
    const ak = Object.keys(a).sort();
    const bk = Object.keys(b).sort();
    if (ak.length !== bk.length) return false;
    for (let i=0;i<ak.length;i++) if (ak[i] !== bk[i]) return false;
    for (const k of ak) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  return false;
}

export async function mergePacks(userMsd){
  const t0 = performance.now();
  userMsd = userMsd || {};
  const dbg = window.__msdDebug = window.__msdDebug || {};
  const provenance = { animations:{}, rules:{}, profiles:{}, overlays:{}, timelines:{}, anchors:{}, palettes:{} };
  const issuesLocal = [];

  function pushIssue(i){
    issuesLocal.push(i);
    // Fallback sinks for test / headless environments
    try {
      const dbg = window.__msdDebug = window.__msdDebug || {};
      dbg.__issues = dbg.__issues || [];
      dbg.__issues.push(i);
      (globalThis.__issues = globalThis.__issues || []).push(i);
    } catch {}
    emitIssue(i);
  }

  // --- Layer collection ------------------------------------------------------
  const builtinIds = (userMsd.use_packs?.builtin && Array.isArray(userMsd.use_packs.builtin) ? userMsd.use_packs.builtin : ['core'])
    .filter(Boolean);
  if (!builtinIds.includes('core')) builtinIds.unshift('core');
  const builtinLayers = builtinIds
    .filter((v,i,a)=>a.indexOf(v)===i)
    .map(id=>{
      let data = getBuiltinPack(id) || {};
      const dbgPacks = window.__msdDebug?.packs;
      // NEW: supplement builtin data with debug stub content (not just fallback when empty)
      const dbgSource =
        id === 'core'
          ? dbgPacks?.core
          : (dbgPacks?.builtin && dbgPacks.builtin[id]) || null;

      if (dbgSource && typeof dbgSource === 'object') {
        // For keyed array collections, append items not already present
        for (const coll of COLLECTIONS) {
          const srcArr = Array.isArray(dbgSource[coll]) ? dbgSource[coll] : null;
            if (srcArr && srcArr.length){
              const targetArr = Array.isArray(data[coll]) ? data[coll] : (data[coll] = []);
              const existingIds = new Set(targetArr.map(it=>it && it.id));
              srcArr.forEach(it=>{
                if (it && it.id && !existingIds.has(it.id)) targetArr.push(shallowClone(it));
              });
            }
        }
        // Palettes: deep token merge (only add missing tokens; do NOT overwrite existing builtin tokens)
        if (dbgSource.palettes){
          data.palettes = data.palettes || {};
          Object.entries(dbgSource.palettes).forEach(([palName, tokens])=>{
            if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) return;
            data.palettes[palName] = data.palettes[palName] || {};
            Object.entries(tokens).forEach(([tok,val])=>{
              if (!(tok in data.palettes[palName])) data.palettes[palName][tok] = val;
            });
          });
        }
      }

      // Previous fallback (retain in case data still empty)
      if (!data || (typeof data === 'object' && !Object.keys(data).length)){
        if (dbgSource) data = shallowClone(dbgSource);
      }
      return { type: id==='core'?'builtin:core':`builtin:${id}`, id, data: data || {} };
    });

  const externalUrls = (userMsd.use_packs?.external && Array.isArray(userMsd.use_packs.external) ? userMsd.use_packs.external : []);
  const externalFetchResults = await Promise.allSettled(
    externalUrls.map(url=> loadExternalPack(url).then(data=>({ url, data })).catch(e=>({ url, error:e })))
  );
  const externalLayers = [];
  externalFetchResults.forEach(r=>{
    if (r.status === 'fulfilled' && r.value && !r.value.error){
      externalLayers.push({ type:`external:${r.value.url}`, url:r.value.url, data:r.value.data || {} });
    } else {
      pushIssue({ severity:'error', code:'pack.external.load_failed', msg:`Failed external pack ${r.value?.url || r.reason}` });
    }
  });
  // deterministic ordering
  externalLayers.sort((a,b)=> a.url.localeCompare(b.url));

  const userLayer = { type:'user', data: userMsd };

  const layers = [
    ...builtinLayers,
    ...externalLayers,
    userLayer
  ];

  // --- Accumulators ----------------------------------------------------------
  const acc = empty();
  const baseline = {};                // baseline[coll][id]
  const lastEffective = {};           // lastEffective[coll][id] for redundant detection (prior layer)
  const seenInCurrentLayer = {};      // duplicate detection per layer
  const redundantLogged = {};          // ADDED: guard map for redundant warnings

  // --- Helpers ---------------------------------------------------------------
  function startLayer(layerType){
    seenInCurrentLayer[layerType] = {};
  }
  function finishLayer(layerType){
    delete seenInCurrentLayer[layerType];
  }

  function recordAnchor(origin_pack, id, overridden){
    provenance.anchors[id] = provenance.anchors[id] || { origin_pack, overridden:false };
    if (overridden) provenance.anchors[id].overridden = true;
  }

  function markRedundant(coll, id, origin_pack){
    redundantLogged[coll] = redundantLogged[coll] || {};
    if (redundantLogged[coll][id]) return;
    redundantLogged[coll][id] = true;
    pushIssue({ severity:'warn', code:'pack.override.redundant', msg:`Redundant override ${coll}:${id} layer=${origin_pack}` });
    perfCount('packs.items.redundant');
  }

  function upsertItem(coll, item, origin_pack){
    if (!item || !item.id){
      pushIssue({ severity:'error', code:'pack.item.missing_id', msg:`Missing id in ${coll} origin=${origin_pack}` });
      return;
    }
    const layerSeen = seenInCurrentLayer[origin_pack];
    if (layerSeen){
      if (layerSeen[item.id]){
        pushIssue({ severity:'error', code:'pack.item.duplicate', msg:`Duplicate id in same layer ${coll}:${item.id} layer=${origin_pack}` });
      } else {
        layerSeen[item.id] = true;
      }
    }
    const list = acc[coll];
    const idx = list.findIndex(x=>x.id===item.id);
    const cloned = shallowClone(item);
    delete cloned.remove;

    if (!baseline[coll]) baseline[coll]={};
    if (!lastEffective[coll]) lastEffective[coll]={};

    if (idx === -1){
      list.push(cloned);
      if (!baseline[coll][item.id]) baseline[coll][item.id] = shallowClone(cloned);
      provenance[coll][item.id] = { origin_pack, origin_version:'unknown', overridden:false };
      lastEffective[coll][item.id] = shallowClone(cloned);
    } else {
      const prevEffective = lastEffective[coll][item.id] || list[idx];
      const baseObj = baseline[coll][item.id] || prevEffective;
      list[idx] = cloned;
      const provPrev = provenance[coll][item.id];
      provenance[coll][item.id] = {
        origin_pack: provPrev.origin_pack,
        origin_version: provPrev.origin_version,
        overridden:true,
        override_layer: origin_pack
      };
      // --- CHANGED: robust redundant detection (canonical comparison) ---
      const prevEffEqual = deepEqual(prevEffective, cloned) ||
                           diffEqual(prevEffective, cloned) ||
                           (normalizedString(prevEffective) === normalizedString(cloned)) ||
                           (canonicalKey(prevEffective) === canonicalKey(cloned));
      const baseEqual    = deepEqual(baseObj, cloned) ||
                           diffEqual(baseObj, cloned) ||
                           (normalizedString(baseObj) === normalizedString(cloned)) ||
                           (canonicalKey(baseObj) === canonicalKey(cloned));
      if (prevEffEqual || baseEqual){
        markRedundant(coll, item.id, origin_pack);
      }
      // --- END CHANGED ---
      lastEffective[coll][item.id] = shallowClone(cloned);
    }
  }

  function applyInlineRemoval(coll, id, origin_pack){
    const list = acc[coll];
    const before = list.length;
    for (let i=list.length-1;i>=0;i--){
      if (list[i].id === id){
        list.splice(i,1);
        provenance[coll][id] = {
          ...(provenance[coll][id]||{ origin_pack:'user', origin_version:'unknown' }),
          removed:true
        };
      }
    }
    if (before === list.length){
      pushIssue({ severity:'warn', code:'pack.removal.unknown', msg:`Inline remove unknown (${coll}:${id}) layer=${origin_pack}` });
    }
  }

  // --- Layer processing ------------------------------------------------------
  for (const layer of layers){
    startLayer(layer.type);
    for (const coll of COLLECTIONS){
      const items = Array.isArray(layer.data?.[coll]) ? layer.data[coll] : [];
      items.forEach(it=>{
        if (it?.remove === true){
          applyInlineRemoval(coll, it.id, layer.type);
        } else {
          upsertItem(coll, it, layer.type);
        }
      });
    }
    // Palettes deep merge
    if (layer.data?.palettes){
      acc.palettes = acc.palettes || {};
      deepMergePalettes(acc.palettes, layer.data.palettes);
      Object.keys(layer.data.palettes || {}).forEach(pn=>{
        provenance.palettes[pn] = provenance.palettes[pn] || { origin_pack: layer.type, overridden:false };
        // mark overridden if existed already
        if (provenance.palettes[pn].origin_pack !== layer.type) provenance.palettes[pn].overridden = true;
      });
    }
    // Anchors shallow + provenance
    if (layer.data?.anchors){
      Object.entries(layer.data.anchors).forEach(([id,pt])=>{
        const existed = Object.prototype.hasOwnProperty.call(acc.anchors, id);
        acc.anchors[id] = pt;
        recordAnchor(layer.type, id, existed);
      });
    }
    // Routing shallow (last-wins)
    if (layer.data?.routing){
      acc.routing = { ...(acc.routing||{}), ...layer.data.routing };
    }
    if (Array.isArray(layer.data?.active_profiles)){
      acc.active_profiles = layer.data.active_profiles.slice();
    }
    finishLayer(layer.type);
  }

  // --- POST-LAYER REDUNDANCY SWEEP (ensures warning even if inline detection missed) ---
  for (const coll of COLLECTIONS){
    const items = acc[coll];
    if (!items || !items.length) continue;
    for (const item of items){
      const prov = provenance[coll][item.id];
      if (!prov || !prov.overridden) continue;
      // baseline object (first occurrence) if available
      const baseObj = (baseline[coll] && baseline[coll][item.id]) || null;
      if (!baseObj) continue;
      const effKey = canonicalKey(item);
      const baseKey = canonicalKey(baseObj);
      if (effKey === baseKey){
        // ensure we only emit once
        if (!redundantLogged[coll]) redundantLogged[coll]={};
        if (!redundantLogged[coll][item.id]){
          markRedundant(coll, item.id, prov.override_layer || prov.origin_pack || 'user'); // reuse existing helper
        }
      }
    }
  }

  // --- Global removals (user layer only) -------------------------------------
  const globalRemove = userMsd.remove || {};
  for (const coll of COLLECTIONS){
    const ids = Array.isArray(globalRemove[coll]) ? globalRemove[coll] : [];
    if (!ids.length) continue;
    const list = acc[coll];
    ids.forEach(rmId=>{
      const idx = list.findIndex(x=>x.id===rmId);
      if (idx === -1){
        pushIssue({ severity:'warn', code:'pack.removal.unknown', msg:`Global remove unknown (${coll}:${rmId})` });
      } else {
        list.splice(idx,1);
        provenance[coll][rmId] = {
          ...(provenance[coll][rmId]||{ origin_pack:'user', origin_version:'unknown' }),
          removed:true,
          removal_source:'global'
        };
      }
    });
  }

  // --- Final checksum pass ---------------------------------------------------
  for (const coll of COLLECTIONS){
    for (const item of acc[coll]){
      const id = item.id;
      const prov = provenance[coll][id];
      if (!prov){
        // Should not happen, create minimal provenance
        provenance[coll][id] = { origin_pack:'user', origin_version:'unknown', overridden:false };
      }
      const pure = shallowClone(item); // meta kept separate
      provenance[coll][id].checksum = await computeChecksum(pure);
    }
  }

  // Anchor checksum (optional lightweight)
  for (const [id,pt] of Object.entries(acc.anchors)){
    const prov = provenance.anchors[id] || (provenance.anchors[id]={ origin_pack:'user', overridden:false });
    try {
      prov.checksum = await computeChecksum(pt);
    } catch {}
  }

  const ms = performance.now() - t0;
  perfTiming('packs.merge.ms', ms);
  perfCount('packs.items.total', COLLECTIONS.reduce((a,c)=> a+acc[c].length,0));
  perfCount('packs.items.overridden', COLLECTIONS.reduce((a,c)=> a+Object.values(provenance[c]).filter(p=>p.overridden).length,0));

  // Expose for debug (do not rely on wrapper shape downstream)
  try {
    dbg._lastPackProvenance = provenance;
  } catch {}

  return { merged: acc, provenance };
}

// Collapsed export unchanged (user subset)
export function exportCollapsed(userMsd){
  const out = {};
  const keep = ['version','use_packs','anchors','overlays','animations','rules','profiles','timelines','palettes','routing','active_profiles','remove'];
  keep.forEach(k=> { if (userMsd && userMsd[k] !== undefined) out[k]=userMsd[k]; });
  return out;
}

// Attach for console/debug
(function attach(){
  try {
    const W = window;
    W.__msdDebug = W.__msdDebug || {};
    W.__msdDebug.packs = W.__msdDebug.packs || {};
    W.__msdDebug.packs.mergePacks = mergePacks;
    W.__msdDebug.exportCollapsed = ()=> exportCollapsed(W.__msdDebug._hudUserMsdConfig||{});
  } catch {}
})();

