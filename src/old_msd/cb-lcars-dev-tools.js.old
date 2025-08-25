/**
 * cb-lcars-dev-tools.js
 * Dev Tools v4 → Pass 5 Baseline (Authoritative Re‑Emit)
 *
 * Consolidated features:
 *  - Scenario framework + dynamic / fallback core pack loader
 *  - Snapshot store (capture / shallow diff / deep diff / latest deep diff)
 *  - Runtime routing config API (get/set/merge) for Smart Agg / Detour toggles (v2.2 connector routing compatible)
 *  - Overlay helpers (add / mutate / remove / deterministic export / YAML export + diff)
 *  - Anchor helpers
 *  - Layout helpers (relayout connectors + route dump)
 *  - Perf dump utility (hud/perf friendly)
 *  - Flags API (dev.api.flags.set) + legacy dev.flags (NO deprecation warning to avoid log noise)
 *  - Assertions (routes)
 *  - HUD integration: listens to snapshot:refresh to maintain rolling previous snapshot for deep diff latest
 *  - Deep diff (recursive with limit + ignore list)
 *
 * Notes:
 *  - This file supersedes earlier shortened “scenario reload” variant (adds back deep diff + runtime).
 *  - Designed to be stable foundation for Pass 5 overlay workbench (bulk ops / undo will hook onto dev.api.overlays.* later).
 *  - No provider threshold logic here (lives in HUD core + providers panel). Safe no-ops if thresholds absent.
 *
 * Safe re-import: idempotent augmentation (will not duplicate scenarios).
 */
(function initDevTools(){
  const DEV_PARAM='lcarsDev';
  const enabled = !window.CBLCARS_DEV_DISABLE &&
    (window.CBLCARS_DEV_FORCE === true || new URLSearchParams(location.search).has(DEV_PARAM));
  if(!enabled) return;
  if(!window.cblcars) window.cblcars = {};

  const firstAttach = !(window.cblcars.dev && window.cblcars.dev._advancedV5Base);

  /* ------------------------------------------------------------------ */
  /* Persistence                                                         */
  /* ------------------------------------------------------------------ */
  const STORAGE_KEY='cblcarsDevState';
  function loadPersist(){try{return JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'{}');}catch{return {};}}
  function savePersist(state){try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}}
  const _persisted = loadPersist();
  function patchPersist(p){Object.assign(_persisted,p); savePersist(_persisted);}

  /* ------------------------------------------------------------------ */
  /* Dev root                                                            */
  /* ------------------------------------------------------------------ */
  const dev = window.cblcars.dev = window.cblcars.dev || {};
  dev._advancedV5Base = true;
  dev._advanced = true;
  dev.persistedState = _persisted;

  dev.clearPersist = function(){
    try{sessionStorage.removeItem(STORAGE_KEY);}catch{}
    for(const k of Object.keys(_persisted)) delete _persisted[k];
    console.info('[dev] persisted state cleared');
  };

  /* ------------------------------------------------------------------ */
  /* Discovery / card resolution                                         */
  /* ------------------------------------------------------------------ */
  function ascend(el){
    let c=el;
    while(c){
      if(c.tagName && c.tagName.toLowerCase()==='cb-lcars-msd-card') return c;
      if(c instanceof ShadowRoot) c=c.host;
      else if(c.parentNode) c=c.parentNode;
      else if(c.ownerDocument) c=c.ownerDocument.host||null;
      else c=null;
    }
    return null;
  }
  function discover(force=false){
    if(!force && Array.isArray(dev._cardCache) && dev._cardCache.length){
      dev._cardCache=dev._cardCache.filter(c=>c.isConnected);
      return dev._cardCache;
    }
    const found=[]; const seen=new Set();
    (function walk(node){
      if(!node||seen.has(node)) return; seen.add(node);
      if(node.nodeType===1){
        if(node.tagName && node.tagName.toLowerCase()==='cb-lcars-msd-card') found.push(node);
        if(node.shadowRoot) walk(node.shadowRoot);
        const kids=node.children||[];
        for(let i=0;i<kids.length;i++) walk(kids[i]);
      } else if(node instanceof ShadowRoot){
        const kids=node.children||[];
        for(let i=0;i<kids.length;i++) walk(kids[i]);
      }
    })(document.documentElement);
    dev._cardCache=found;
    return found;
  }
  function resolve(rootLike){
    if(rootLike && rootLike.host) return {card:rootLike.host,root:rootLike};
    if(rootLike && rootLike.shadowRoot) return {card:rootLike,root:rootLike.shadowRoot};
    if(rootLike instanceof Element){
      const asc=ascend(rootLike);
      if(asc) return {card:asc,root:asc.shadowRoot};
    }
    if(dev._activeCard && dev._activeCard.isConnected)
      return {card:dev._activeCard,root:dev._activeCard.shadowRoot};
    const cards=discover();
    if(cards.length===1){ dev._activeCard=cards[0]; return {card:cards[0],root:cards[0].shadowRoot}; }
    return {card:null,root:null};
  }
  function msdConfig(card){ return card?._config?.variables?.msd || null; }
  function restamp(card){
    const msd=msdConfig(card); if(!msd) return;
    msd._restampNonce=(msd._restampNonce||0)+1;
    try{
      card.setConfig({...card._config,variables:{...card._config.variables,msd:{...msd}}});
    }catch(e){ console.warn('[dev.restamp] failed', e); }
  }

  /* ------------------------------------------------------------------ */
  /* Layout helpers                                                      */
  /* ------------------------------------------------------------------ */
  function relayout(id='*',rootLike){
    const {root,card}=resolve(rootLike);
    if(!root||!card) return;
    try{
      window.cblcars.connectors.invalidate(id==='*'?undefined:id);
      window.cblcars.overlayHelpers.layoutPendingConnectors(root, msdConfig(card)?._viewBox);
      const vb=msdConfig(card)?._viewBox||[0,0,100,100];
      window.cblcars.debug?.render?.(root,vb,{anchors:root.__cblcars_anchors});
    }catch(e){ console.warn('[dev.relayout] error',e); }
  }
  function dumpRoutes(rootLike,{silent=false}={}){
    const {root}=resolve(rootLike);
    if(!root){ if(!silent) console.warn('[dev.dumpRoutes] no root'); return []; }
    const out=[];
    root.querySelectorAll('path[data-cblcars-attach-to]').forEach(p=>{
      const row={id:p.id||'(anon)'};
      for(const a of p.attributes){
        if(a.name.startsWith('data-cblcars-route')||a.name.startsWith('data-cblcars-smart')) row[a.name]=a.value;
      }
      out.push(row);
    });
    if(!silent){
      console.table(out.map(r=>({
        id:r.id,
        eff:r['data-cblcars-route-effective'],
        detour:r['data-cblcars-route-detour']||'',
        gridStat:r['data-cblcars-route-grid-status']||'',
        gridReason:r['data-cblcars-route-grid-reason']||'',
        attempts:r['data-cblcars-route-grid-attempts']||''
      })));
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Flags API (non-deprecating)                                         */
  /* ------------------------------------------------------------------ */
  function setFlags(patch){
    if(!patch) return window.cblcars._debugFlags||{};
    const merged={...(window.cblcars._debugFlags||{}),...patch};
    window.cblcars.debug?.setFlags?.(merged);
    patchPersist({flags:merged});
    return merged;
  }
  // Legacy compatibility (no warning)
  dev.flags = setFlags;

  /* ------------------------------------------------------------------ */
  /* Overlay helpers                                                     */
  /* ------------------------------------------------------------------ */
  function snapshotConfig(name){
    const {card}=resolve();
    if(!card) return null;
    const id=name||`snap_${Date.now().toString(36)}`;
    const clone=JSON.parse(JSON.stringify(card._config));
    dev._snapshots=dev._snapshots||new Map();
    dev._snapshots.set(id,clone);
    return id;
  }
  function restoreConfig(id){
    const snap=dev._snapshots?.get(id);
    const {card}=resolve();
    if(!snap||!card) return false;
    card.setConfig(JSON.parse(JSON.stringify(snap)));
    return true;
  }
  function listSnapshots(){ return Array.from(dev._snapshots?.keys()||[]); }

  function addOverlay(ov){
    const {card}=resolve(); if(!card) return;
    const msd=msdConfig(card);
    msd.overlays=(msd.overlays||[]).filter(o=>o.id!==ov.id);
    msd.overlays.push(ov);
    restamp(card);
  }
  function removeOverlay(id){
    const {card}=resolve(); if(!card) return;
    const msd=msdConfig(card);
    msd.overlays=(msd.overlays||[]).filter(o=>o.id!==id);
    restamp(card);
  }
  function mutateOverlay(id,patch){
    const {card}=resolve(); if(!card) return false;
    const msd=msdConfig(card);
    if(!msd||!Array.isArray(msd.overlays)) return false;
    const ov=msd.overlays.find(o=>o.id===id); if(!ov) return false;
    Object.assign(ov,patch||{});
    restamp(card);
    return true;
  }

  /* Deterministic overlay export */
  const OVERLAY_KEY_ORDER=[
    'id','type','anchor','attach_to','attach_side','attach_align','attach_gap',
    'route','route_mode','route_mode_full','route_channels','route_channel_mode','avoid',
    'points','steps','position','size','rx','ry','corner_style','corner_radius',
    'color','width','on_color','off_color','threshold','sources','source','windowSeconds',
    'smart_proximity','animation','label_last','markers','tracer','grid','y_range',
    'smooth','smooth_method','smooth_tension','stair_step','extend_to_edges',
    'ignore_zero_for_scale','min_change','min_change_pct','min_interval_ms','value',
    'visible','preset','entity','tap_action','hold_action','double_tap_action'
  ];
  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function canonicalizeOverlay(o){
    const c={}; OVERLAY_KEY_ORDER.forEach(k=>{ if(o[k]!==undefined) c[k]=o[k]; });
    Object.keys(o).sort().forEach(k=>{ if(c[k]===undefined) c[k]=o[k]; });
    return c;
  }
  function exportDeterministic(){
    const {card}=resolve(); if(!card) return [];
    const ovs=(msdConfig(card)?.overlays||[]).map(clone);
    ovs.sort((a,b)=>(a.id||'').localeCompare(b.id||''));
    return ovs.map(canonicalizeOverlay);
  }
  function toYaml(obj,indent=0){
    const pad=' '.repeat(indent);
    if(obj==null) return 'null';
    if(typeof obj!=='object') return JSON.stringify(obj);
    if(Array.isArray(obj)){
      if(!obj.length) return '[]';
      return obj.map(v=>`${pad}- ${toYaml(v,indent+2).replace(/^\s+/,'')}`).join('\n');
    }
    const keys=Object.keys(obj);
    if(!keys.length) return '{}';
    return keys.map(k=>{
      const v=obj[k];
      if(v && typeof v==='object') return `${pad}${k}:\n${toYaml(v,indent+2)}`;
      return `${pad}${k}: ${toYaml(v,0)}`;
    }).join('\n');
  }
  function exportYaml(){
    const arr=exportDeterministic();
    return [
      '# Overlays Export (deterministic)',
      'overlays:',
      ...arr.map(o=>'  - '+toYaml(o,4).replace(/^ {4}- /,''))
    ].join('\n');
  }
  function diffYaml(oldYaml,newYaml){
    const parse=(y)=>{
      const lines=y.split(/\r?\n/);
      const blocks=[]; let current=[]; let started=false;
      for(const ln of lines){
        if(/^\s*-\s*id:/.test(ln)){ if(current.length) blocks.push(current.join('\n')); current=[ln]; started=true; }
        else if(started){
          if(/^\s*-\s*\w/.test(ln)){ blocks.push(current.join('\n')); current=[ln]; }
          else current.push(ln);
        }
      }
      if(current.length) blocks.push(current.join('\n'));
      const map=new Map();
      blocks.forEach(b=>{
        const m=b.match(/id:\s*([A-Za-z0-9_\-]+)/);
        if(m) map.set(m[1], b);
      });
      return map;
    };
    const A=parse(oldYaml||''), B=parse(newYaml||'');
    const added=[], removed=[], changed=[];
    const ids=new Set([...A.keys(),...B.keys()]);
    for(const id of ids){
      if(!A.has(id) && B.has(id)) added.push(id);
      else if(A.has(id) && !B.has(id)) removed.push(id);
      else if(A.get(id)!==B.get(id)) changed.push(id);
    }
    return { added, removed, changed };
  }

  /* ------------------------------------------------------------------ */
  /* Anchors                                                            */
  /* ------------------------------------------------------------------ */
  function listAnchors(){
    const {root,card}=resolve();
    const map=msdConfig(card)?._anchors||root?.__cblcars_anchors||{};
    return Object.entries(map).map(([id,pt])=>({id,x:pt[0],y:pt[1]}));
  }
  function setAnchor(id,x,y){
    const {card,root}=resolve(); if(!card) return;
    const msd=msdConfig(card); msd._anchors=msd._anchors||{}; msd._anchors[id]=[x,y];
    if(root) root.__cblcars_anchors=msd._anchors;
    restamp(card);
  }

  /* ------------------------------------------------------------------ */
  /* Perf                                                               */
  /* ------------------------------------------------------------------ */
  function perfDump(){
    try{
      const dump=window.cblcars.perfDump?window.cblcars.perfDump():window.cblcars.perf?.dump?.()||{};
      console.table(Object.entries(dump).map(([k,v])=>({
        key:k,
        count:v.count,
        last:v.lastMs?.toFixed?.(2),
        avg:v.avgMs?.toFixed?.(2)
      })));
      return dump;
    }catch{return {};}
  }

  /* ------------------------------------------------------------------ */
  /* Scenario framework                                                  */
  /* ------------------------------------------------------------------ */
  dev.__scenarioRegistry = dev.__scenarioRegistry || new Map();
  dev._scenarioResults   = dev._scenarioResults || [];
  dev.__defaultScenarioPackLoaded = dev.__defaultScenarioPackLoaded || false;

  function addScenario(def){
    if(!def||!def.name) return;
    if(dev.__scenarioRegistry.has(def.name)) return;
    def.group = def.group || (Array.isArray(def.tags)&&def.tags.length?def.tags[0]:'default');
    def.stability = def.stability || 'core';
    dev.__scenarioRegistry.set(def.name, def);
  }
  function listScenarios(){
    return Array.from(dev.__scenarioRegistry.values()).map(s=>({
      name:s.name,
      group:s.group,
      stability:s.stability,
      desc:s.description||'',
      tags:(s.tags||[]).join(',')
    }));
  }
  async function runScenario(name){
    const sc=dev.__scenarioRegistry.get(name); if(!sc){console.warn('unknown scenario',name);return null;}
    const snapBefore=snapshotConfig(`auto_${name}`);
    let ok=false, details=''; let err=null;
    const t0=performance.now();
    try{
      const ctx={ msd: msdConfig(resolve().card), dev };
      if(sc.setup) await sc.setup(ctx);
      await new Promise(r=>setTimeout(r,sc.settleMs||250));
      const r=sc.expect?await sc.expect(ctx):true;
      if(r && typeof r==='object' && 'ok' in r){ ok=!!r.ok; details=r.details||''; }
      else ok=!!r;
      if(sc.teardown) await sc.teardown(ctx);
    }catch(e){err=e; ok=false; details=details||e.message;}
    if(sc.restore!==false) restoreConfig(snapBefore);
    const ms=(performance.now()-t0).toFixed(1);
    const summary={scenario:name,ok,details,ms,error:err?.message};
    const arr=dev._scenarioResults;
    const i=arr.findIndex(r=>r.scenario===name);
    if(i>=0) arr[i]=summary; else arr.push(summary);
    window.cblcars.hud?.api?.refreshRaw({allowWhilePaused:true});
    return summary;
  }
  async function runGroup(groupName){
    const names=listScenarios().filter(s=>s.group===groupName).map(s=>s.name);
    const out=[]; for(const n of names) out.push(await runScenario(n)); return out;
  }
  function registerScenarioPack(fn){
    if(typeof fn==='function'){
      fn({ addScenario, relayout, dumpRoutes, msdConfig:()=>msdConfig(resolve().card) });
    }
  }
  function inlineCoreScenarioPack(){
    if(dev.__corePackInlineApplied) return;
    dev.__corePackInlineApplied = true;
    registerScenarioPack(({addScenario})=>{
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      addScenario({ name:'baseline_ok', group:'core', description:'Baseline pass', expect:()=>true });
      addScenario({ name:'baseline_fail_demo', group:'core', description:'Intentional fail', expect:()=>({ok:false,details:'demo fail'}) });
      addScenario({
        name:'routing_any_detour', group:'routing', description:'At least one detour',
        async expect(){return dumpRoutes(undefined,{silent:true}).some(r=>r['data-cblcars-route-detour']==='true')
          ?{ok:true,details:'detour'}:{ok:false,details:'none'};}
      });
      addScenario({
        name:'routing_any_fallback', group:'routing', description:'At least one grid fallback',
        async expect(){return dumpRoutes(undefined,{silent:true}).some(r=>r['data-cblcars-route-grid-status']==='fallback')
          ?{ok:true,details:'fallback'}:{ok:false,details:'none'};}
      });
      addScenario({
        name:'perf_threshold_violation_demo', group:'perf', description:'Perf violation test',
        async setup(){
          window.cblcars.debug?.perf?.reset('inline_slow');
          for(let i=0;i<4;i++){
            window.cblcars.debug?.perf?.start('inline_slow');
            await sleep(5);
            window.cblcars.debug?.perf?.end('inline_slow');
          }
          const t=window.cblcars.debug?.perf?.get('inline_slow');
          if(t) window.cblcars.hud?.api?.setPerfThreshold('inline_slow',{avgMs:(t.avgMs||0)-0.1});
        },
        async expect(){
          const snap=window.cblcars.hud?.api?.currentSnapshot?.();
            const v=(snap?.sections?.perf?.violations||[]).find(x=>x.id==='inline_slow');
          return v?{ok:true,details:'violation'}:{ok:false,details:'no violation'};
        },
        async teardown(){window.cblcars.hud?.api?.removePerfThreshold('inline_slow');}
      });
    });
    console.info('[scenarios] inline core pack applied');
    window.cblcars.hud?.api?.refreshRaw({allowWhilePaused:true});
  }
  if(firstAttach && dev.__scenarioRegistry.size===0){
    addScenario({ name:'group_demo_ok', group:'demo', description:'Demo OK', expect:()=>true });
    addScenario({ name:'group_demo_fail', group:'demo', description:'Demo fail', expect:()=>({ok:false,details:'expected fail'}) });
  }
  function loadDefaultPack(){
    if(dev.__defaultScenarioPackLoaded) return Promise.resolve('already');
    return import('./cb-lcars-scenarios-pack-core.js')
      .then(()=>{
        dev.__defaultScenarioPackLoaded=true;
        console.info('[scenarios] core pack loaded');
        window.cblcars.hud?.api?.refreshRaw({allowWhilePaused:true});
        return 'loaded';
      })
      .catch(e=>{
        console.warn('[scenarios] dynamic core pack import failed – fallback inline', e);
        inlineCoreScenarioPack();
        return 'fallback';
      });
  }
  function forceReload(){
    dev.__defaultScenarioPackLoaded=false;
    loadDefaultPack();
  }
  if(firstAttach) loadDefaultPack().then(()=>{
    setTimeout(()=>{
      if(dev.__scenarioRegistry.size<=2){
        console.warn('[scenarios] watchdog: only demo scenarios – applying inline fallback');
        inlineCoreScenarioPack();
      }
    },1000);
  });

  /* ------------------------------------------------------------------ */
  /* Snapshot helpers (shallow diff)                                    */
  /* ------------------------------------------------------------------ */
  const SNAP_STORE = dev.__hudSnapStore = dev.__hudSnapStore || new Map();
  function snapClone(s){return JSON.parse(JSON.stringify(s));}
  function captureSnapshot(label){
    const snap=window.cblcars.hud?.api?.currentSnapshot?.();
    if(!snap){console.warn('[dev.snapshots] no current snapshot'); return null;}
    const id=label||('snap_'+Date.now().toString(36));
    SNAP_STORE.set(id,snapClone(snap));
    return id;
  }
  function getSnapshot(id){return SNAP_STORE.get(id)||null;}
  function diffSnapshots(aId,bId,{sections}={}){
    const A=getSnapshot(aId), B=getSnapshot(bId);
    if(!A||!B) return {error:'missing snapshot(s)'};
    const secList=sections&&sections.length?sections:
      Array.from(new Set([...Object.keys(A.sections),...Object.keys(B.sections)]));
    const result={sections:{}};
    secList.forEach(sec=>{
      const aSec=A.sections[sec], bSec=B.sections[sec];
      if(aSec==null && bSec==null) return;
      if(aSec==null){result.sections[sec]={added:true};return;}
      if(bSec==null){result.sections[sec]={removed:true};return;}
      const aKeys=Object.keys(aSec), bKeys=Object.keys(bSec);
      const added=aKeys.filter(k=>!bKeys.includes(k));
      const removed=bKeys.filter(k=>!aKeys.includes(k));
      const changed=[];
      aKeys.forEach(k=>{
        if(bSec.hasOwnProperty(k) && JSON.stringify(aSec[k])!==JSON.stringify(bSec[k])) changed.push(k);
      });
      if(added.length||removed.length||changed.length) result.sections[sec]={added,removed,changed};
    });
    return result;
  }

  /* ------------------------------------------------------------------ */
  /* Deep diff                                                          */
  /* ------------------------------------------------------------------ */
  function diffDeepObjects(a,b,{path='',out,limit,ignoreKeysSet,seen}){
    if(out.length>=limit) return;
    if(a===b) return;
    if(a==null || b==null){
      out.push({path,valueA:a,valueB:b});
      return;
    }
    const atype=typeof a, btype=typeof b;
    if(atype!==btype){
      out.push({path,valueA:a,valueB:b});
      return;
    }
    if(atype!=='object'){
      if(a!==b) out.push({path,valueA:a,valueB:b});
      return;
    }
    if(seen.has(a) || seen.has(b)) return;
    seen.add(a); seen.add(b);

    if(Array.isArray(a)||Array.isArray(b)){
      if(!Array.isArray(a)||!Array.isArray(b)){
        out.push({path,valueA:a,valueB:b}); return;
      }
      const len=Math.max(a.length,b.length);
      for(let i=0;i<len;i++){
        if(out.length>=limit) break;
        const subPath=path+'['+i+']';
        if(a[i]===undefined && b[i]!==undefined){ out.push({path:subPath,valueA:undefined,valueB:b[i]}); continue; }
        if(b[i]===undefined && a[i]!==undefined){ out.push({path:subPath,valueA:a[i],valueB:undefined}); continue; }
        if(a[i]!==b[i]) diffDeepObjects(a[i],b[i],{path:subPath,out,limit,ignoreKeysSet,seen});
      }
      return;
    }

    const keys=new Set([...Object.keys(a),...Object.keys(b)]);
    for(const k of keys){
      if(out.length>=limit) break;
      if(ignoreKeysSet.has(k)) continue;
      const sub=path?(path+'.'+k):k;
      if(!(k in a)){ out.push({path:sub,valueA:undefined,valueB:b[k]}); continue; }
      if(!(k in b)){ out.push({path:sub,valueA:a[k],valueB:undefined}); continue; }
      if(a[k]===b[k]) continue;
      diffDeepObjects(a[k],b[k],{path:sub,out,limit,ignoreKeysSet,seen});
    }
  }
  function diffDeep(aId,bId,{ignore=['meta.timestamp','meta.iso'],limit=500,sections}={}){
    const A=getSnapshot(aId), B=getSnapshot(bId);
    if(!A||!B) return {error:'missing snapshot(s)'};
    const ignoreKeysSet=new Set(['__proto__']);
    ignore.forEach(k=>{
      if(k.includes('.')) ignoreKeysSet.add(k.split('.').slice(-1)[0]);
      else ignoreKeysSet.add(k);
    });
    const out=[];
    const secList=sections&&sections.length?sections:Object.keys(A.sections);
    secList.forEach(sec=>{
      if(!B.sections[sec]){
        out.push({path:`sections.${sec}`,valueA:A.sections[sec],valueB:undefined}); return;
      }
      diffDeepObjects(A.sections[sec],B.sections[sec],{
        path:`sections.${sec}`,
        out,
        limit,
        ignoreKeysSet,
        seen:new WeakSet()
      });
    });
    return {changes:out,limitReached:out.length>=limit};
  }

  // Rolling latest snapshots for diffDeepLatest
  let __lastHudSnapshot=null;
  let __prevHudSnapshot=null;

  function diffDeepLatest({limit=500,ignoreSections}={}){
    if(!__lastHudSnapshot || !__prevHudSnapshot)
      return {error:'insufficient snapshot history'};
    const tmpA='__deep_prev', tmpB='__deep_cur';
    SNAP_STORE.set(tmpA,snapClone(__prevHudSnapshot));
    SNAP_STORE.set(tmpB,snapClone(__lastHudSnapshot));
    const secs = ignoreSections
      ? Object.keys(__lastHudSnapshot.sections).filter(s=>!ignoreSections.includes(s))
      : null;
    return diffDeep(tmpA,tmpB,{limit,sections:secs});
  }

  // Hook into HUD events (if available) to maintain rolling snapshots
  function hookHudEvents(){
    const hudApi = window.cblcars.hud?.api;
    if(!hudApi || hookHudEvents._hooked) return;
    hookHudEvents._hooked=true;
    hudApi.on?.('snapshot:refresh',snap=>{
      __prevHudSnapshot = __lastHudSnapshot;
      __lastHudSnapshot = snapClone(snap);
    });
    // If already have a current snapshot, seed now
    try{
      const cur = hudApi.currentSnapshot?.();
      if(cur){
        __lastHudSnapshot = snapClone(cur);
      }
    }catch{}
  }
  // Attempt immediately & schedule retries until hooked
  hookHudEvents();
  let hookTries=0;
  (function retryHook(){
    if(hookHudEvents._hooked || hookTries>40) return;
    hookTries++; hookHudEvents();
    if(!hookHudEvents._hooked) setTimeout(retryHook,150);
  })();

  /* ------------------------------------------------------------------ */
  /* Assertions                                                         */
  /* ------------------------------------------------------------------ */
  function assertRoutes(desc,predicate){
    const snap=window.cblcars.hud?.api?.currentSnapshot?.();
    if(!snap) return {ok:false,details:'no snapshot'};
    const list=Object.values(snap.sections?.routes?.byId||{});
    let pass=false;
    try{pass=!!predicate(list);}catch(e){return {ok:false,details:'predicate threw: '+e.message};}
    const details=`${desc||'assert'} => ${pass?'PASS':'FAIL'} (routes=${list.length})`;
    console[pass?'info':'warn']('[assert.routes]',details);
    return {ok:pass,details};
  }

  /* ------------------------------------------------------------------ */
  /* Runtime Routing Config API (v2.2 compat)                           */
  /* ------------------------------------------------------------------ */
  function deepMerge(target, src){
    if(!src || typeof src!=='object') return target;
    Object.keys(src).forEach(k=>{
      const v=src[k];
      if(v && typeof v==='object' && !Array.isArray(v)){
        if(!target[k] || typeof target[k]!=='object' || Array.isArray(target[k])) target[k]={};
        deepMerge(target[k], v);
      } else {
        target[k]=v;
      }
    });
    return target;
  }
  function getRoutingConfig(){
    try{
      return window.cblcars?.routing?.getGlobalConfig
        ? JSON.parse(JSON.stringify(window.cblcars.routing.getGlobalConfig()))
        : {};
    }catch{return {};}
  }
  function setRoutingConfig(patch){
    if(!patch || typeof patch!=='object') return getRoutingConfig();
    if(window.cblcars?.routing?.setGlobalConfig){
      window.cblcars.routing.setGlobalConfig(patch);
      console.info('[dev.runtime] set', patch);
      return getRoutingConfig();
    }
    console.warn('[dev.runtime] setGlobalConfig missing');
    return {};
  }
  function mergeRoutingConfig(patch){
    const cur=getRoutingConfig();
    const merged=deepMerge(cur, JSON.parse(JSON.stringify(patch||{})));
    return setRoutingConfig(merged);
  }

  /* ------------------------------------------------------------------ */
  /* Attach dev.api                                                      */
  /* ------------------------------------------------------------------ */
  dev.api = dev.api || {};

  // Cards
  dev.api.cards = dev.api.cards || {
    discover,
    list(){ return discover().map((c,i)=>({index:i,selected:dev._activeCard===c})); },
    pick(i=0){
      const cs=discover();
      if(!cs[i]) return null;
      dev._activeCard=cs[i];
      patchPersist({activeCardIndex:i});
      return cs[i];
    },
    setFrom(el){
      const card=ascend(el);
      if(card){
        dev._activeCard=card;
        const idx=discover().indexOf(card);
        if(idx>=0) patchPersist({activeCardIndex:idx});
      }
    }
  };

  // Overlays
  dev.api.overlays = dev.api.overlays || {};
  Object.assign(dev.api.overlays,{
    add:addOverlay,
    remove:removeOverlay,
    mutate:mutateOverlay,
    snapshot:snapshotConfig,
    restore:restoreConfig,
    listSnapshots,
    exportDeterministic,
    exportYaml,
    diffYaml
  });

  // Anchors
  dev.api.anchors = dev.api.anchors || {};
  Object.assign(dev.api.anchors,{ list:listAnchors, set:setAnchor });

  // Layout
  dev.api.layout = dev.api.layout || {};
  Object.assign(dev.api.layout,{ relayout, dumpRoutes });

  // Perf
  dev.api.perf = dev.api.perf || {};
  Object.assign(dev.api.perf,{ dump:perfDump });

  // Flags
  dev.api.flags = dev.api.flags || {};
  Object.assign(dev.api.flags,{ set:setFlags });

  // Scenarios
  dev.api.scenarios = dev.api.scenarios || {};
  Object.assign(dev.api.scenarios,{
    add:addScenario,
    list:listScenarios,
    run:runScenario,
    runGroup:runGroup,
    registerPack:registerScenarioPack,
    loadDefaultPack,
    forceReload
  });

  // Internal
  dev.api.internal = dev.api.internal || {};
  Object.assign(dev.api.internal,{ ascend, resolve });

  // Persist
  dev.api.persist = dev.api.persist || {};
  Object.assign(dev.api.persist,{ clear:dev.clearPersist });

  // Snapshots
  dev.api.snapshots = dev.api.snapshots || {};
  Object.assign(dev.api.snapshots,{
    capture:captureSnapshot,
    get:getSnapshot,
    diff:diffSnapshots,
    diffDeep,
    diffDeepLatest
  });

  // Runtime
  dev.api.runtime = dev.api.runtime || {
    get:getRoutingConfig,
    set:setRoutingConfig,
    merge:mergeRoutingConfig
  };
  // Legacy direct (no warning)
  dev.getRuntime = getRoutingConfig;
  dev.setRuntime = setRoutingConfig;

  // Assertions
  dev.api.assert = dev.api.assert || {};
  Object.assign(dev.api.assert,{ routes:assertRoutes });

  /* ------------------------------------------------------------------ */
  /* Deprecation aliases (EXCEPT flags)                                  */
  /* ------------------------------------------------------------------ */
  const deprecations = dev.__deprecationWarned || new Set();
  dev.__deprecationWarned = deprecations;
  function alias(name,fn,path){
    if(Object.getOwnPropertyDescriptor(dev,name)) return;
    Object.defineProperty(dev,name,{
      get(){
        if(name!=='flags' && !deprecations.has(name)){
          console.warn(`[dev] ${name} is deprecated. Use dev.api.${path}`);
          deprecations.add(name);
        }
        return fn;
      }
    });
  }
  alias('relayout',dev.api.layout.relayout,'layout.relayout');
  alias('dumpRoutes',dev.api.layout.dumpRoutes,'layout.dumpRoutes');
  alias('addOverlay',dev.api.overlays.add,'overlays.add');
  alias('removeOverlay',dev.api.overlays.remove,'overlays.remove');
  alias('snapshotConfig',dev.api.overlays.snapshot,'overlays.snapshot');
  alias('restoreConfig',dev.api.overlays.restore,'overlays.restore');
  alias('listSnapshots',dev.api.overlays.listSnapshots,'overlays.listSnapshots');
  alias('listAnchors',dev.api.anchors.list,'anchors.list');
  alias('setAnchor',dev.api.anchors.set,'anchors.set');
  alias('discoverMsdCards',dev.api.cards.discover,'cards.discover');
  alias('pick',dev.api.cards.pick,'cards.pick');
  alias('runScenario',dev.api.scenarios.run,'scenarios.run');
  alias('listScenarios',dev.api.scenarios.list,'scenarios.list');
  alias('addScenario',dev.api.scenarios.add,'scenarios.add');
  alias('perfDump',dev.api.perf.dump,'perf.dump');
  alias('clearPersist',dev.clearPersist,'persist.clear');
  // dev.flags already direct (no alias to avoid warning)

  /* ------------------------------------------------------------------ */
  /* Active card restore (first attach)                                  */
  /* ------------------------------------------------------------------ */
  if(firstAttach){
    setTimeout(()=>{
      const cards=discover(true);
      if(_persisted.activeCardIndex!=null && cards[_persisted.activeCardIndex]){
        dev._activeCard=cards[_persisted.activeCardIndex];
      } else if(!dev._activeCard && cards.length===1){
        dev._activeCard=cards[0];
      }
    },0);
  }

  /* ------------------------------------------------------------------ */
  /* HUD enable/disable convenience                                      */
  /* ------------------------------------------------------------------ */
  if(!dev.hud){
    dev.hud={
      enable(){
        patchPersist({hud:{...(dev.persistedState.hud||{}),enabled:true}});
        if(window.cblcars?.hud?.api){ window.cblcars.hud.api.resume(); return true; }
        try{ import('./cb-lcars-hud-loader.js').catch(()=>{}); }catch{}
        return false;
      },
      disable(){
        patchPersist({hud:{...(dev.persistedState.hud||{}),enabled:false}});
        if(window.cblcars?.hud?.api){
          window.cblcars.hud.api.pause();
          document.getElementById('cblcars-dev-hud-panel')?.remove();
        }
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Logging                                                             */
  /* ------------------------------------------------------------------ */
  if(firstAttach) console.info('[dev.v4->5] tools attached (Pass 5 baseline)');
  else console.info('[dev.v4->5] tools reloaded (augmented)');
  console.info('[dev.scenarios] registered', listScenarios().length);

})();