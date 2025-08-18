/**
 * CB-LCARS Developer Tools (Advanced) – Parity + Scenario Pack
 *
 * Key Features:
 *  - MSD card discovery / selection / persistence
 *  - Overlay CRUD (add/remove/import/export/mutate)
 *  - Anchors CRUD & nudge helpers
 *  - Routing helpers (relayout, dumpRoutes, simulate obstacles)
 *  - Runtime config + flag profiles
 *  - Scenario framework (addScenario, runScenario, runAllScenarios)
 *  - Performance helpers (perfDump, benchLayout, capturePerf)
 *  - Config snapshots (snapshotConfig / restoreConfig)
 *  - HUD integration bridge (_persistHudState, hud.enable/disable)
 *  - Scenario wrapper keeps HUD in sync on single runs
 *
 * Additions vs earlier modular split:
 *  - Restored / expanded Scenario Pack (routing, smart, overlays, anchors, perf)
 *  - Duplicate scenario name guard
 *  - runScenario wrapper integrated (live HUD refresh)
 *  - Minor defensive checks & logging
 */

(function initDevTools(){
  const DEV_PARAM = 'lcarsDev';
  const enabled = !window.CBLCARS_DEV_DISABLE &&
    (window.CBLCARS_DEV_FORCE === true ||
     new URLSearchParams(location.search).has(DEV_PARAM));

  if(!enabled) return;
  if(!window.cblcars) window.cblcars={};
  if(window.cblcars.dev && window.cblcars.dev._advanced){
    console.info('[cblcars.dev] Advanced dev tools already attached.');
    return;
  }

  /* ---------------- Persistence (sessionStorage) ---------------- */
  const STORAGE_KEY='cblcarsDevState';
  function loadPersist(){try{const raw=sessionStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw)||{}:{};}catch{return {};}}
  function savePersist(st){try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(st));}catch{}}
  const _persisted=loadPersist();
  function persistPatch(p){Object.assign(_persisted,p);savePersist(_persisted);}
  function clearPersist(){
    try{sessionStorage.removeItem(STORAGE_KEY);}catch{}
    for(const k of Object.keys(_persisted)) delete _persisted[k];
    console.info('[cblcars.dev] Persisted state cleared.');
  }

  /* ---------------- Core Object ---------------- */
  const dev = (window.cblcars.dev = window.cblcars.dev || {});
  dev._advanced=true;

  /* ---------------- Discovery Helpers ---------------- */
  function ascendToMsdCard(el){
    let cur=el;
    while(cur){
      if(cur.tagName && cur.tagName.toLowerCase()==='cb-lcars-msd-card') return cur;
      if(cur instanceof ShadowRoot) cur=cur.host;
      else if(cur.parentNode) cur=cur.parentNode;
      else if(cur.ownerDocument) cur=cur.ownerDocument.host||null;
      else cur=null;
    }
    return null;
  }
  function discoverMsdCards(force=false){
    if(!force && Array.isArray(dev._cardCache) && dev._cardCache.length){
      dev._cardCache=dev._cardCache.filter(c=>c.isConnected);
      return dev._cardCache;
    }
    const found=[]; const seen=new Set();
    function walk(node){
      if(!node||seen.has(node)) return;
      seen.add(node);
      if(node.nodeType===1){
        if(node.tagName && node.tagName.toLowerCase()==='cb-lcars-msd-card') found.push(node);
        const kids=node.children||[];
        for(let i=0;i<kids.length;i++) walk(kids[i]);
        if(node.shadowRoot) walk(node.shadowRoot);
      } else if(node instanceof ShadowRoot){
        const kids=node.children||[];
        for(let i=0;i<kids.length;i++) walk(kids[i]);
      }
    }
    walk(document.documentElement);
    dev._cardCache=found;
    return found;
  }
  function resolveCardRoot(cardOrRoot){
    if(cardOrRoot && cardOrRoot.host) return {card:cardOrRoot.host,root:cardOrRoot};
    if(cardOrRoot && cardOrRoot.shadowRoot) return {card:cardOrRoot,root:cardOrRoot.shadowRoot};
    if(cardOrRoot instanceof Element){
      const asc=ascendToMsdCard(cardOrRoot);
      if(asc) return {card:asc,root:asc.shadowRoot};
    }
    if(dev._activeCard && dev._activeCard.isConnected) return {card:dev._activeCard,root:dev._activeCard.shadowRoot};
    const all=discoverMsdCards();
    if(all.length===1){dev._activeCard=all[0]; return {card:all[0],root:all[0].shadowRoot};}
    return {card:null,root:null};
  }
  function _msdConfig(card){return card?._config?.variables?.msd||null;}
  function _restamp(card){
    const msd=_msdConfig(card); if(!msd) return;
    msd._restampNonce=(msd._restampNonce||0)+1;
    card.setConfig({...card._config,variables:{...card._config.variables,msd:{...msd}}});
  }

  /* ---------------- Layout & Routing ---------------- */
  function relayout(id='*',rootLike){
    const {root,card}=resolveCardRoot(rootLike);
    if(!root||!card){ console.warn('[dev.relayout] No MSD card'); return; }
    try{
      window.cblcars.connectors.invalidate(id==='*'?undefined:id);
      window.cblcars.overlayHelpers.layoutPendingConnectors(root,_msdConfig(card)?._viewBox);
      const vb=_msdConfig(card)?._viewBox||[0,0,100,100];
      window.cblcars.debug?.render?.(root,vb,{anchors:root.__cblcars_anchors});
    }catch(e){ console.warn('[dev.relayout] error',e); }
  }
  function dumpRoutes(rootLike,opts={}){
    const silent=!!opts.silent;
    const {root}=resolveCardRoot(rootLike);
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
        attempts:r['data-cblcars-route-grid-attempts']||'',
        chMode:r['data-cblcars-route-channel-mode']||'',
        chHit:r['data-cblcars-route-channels-hit']||'',
        chMiss:r['data-cblcars-route-channels-miss']||'',
        detourCost:r['data-cblcars-route-detour-cost']||''
      })));
    }
    return out;
  }

  /* ---------------- Runtime & Flags ---------------- */
  function setRuntime(cfg){
    try{
      window.cblcars.connectorRouting.setRoutingRuntimeConfig(cfg);
      persistPatch({runtime:window.cblcars.connectorRouting.getRoutingRuntimeConfig()});
      console.info('[dev.setRuntime] applied',cfg);
    }catch(e){console.warn('[dev.setRuntime] failed',e);}
  }
  function getRuntime(){try{return window.cblcars.connectorRouting.getRoutingRuntimeConfig();}catch{return{};}}
  function flags(patch){
    if(!patch) return window.cblcars._debugFlags||{};
    const merged={...(window.cblcars._debugFlags||{}),...patch};
    window.cblcars.debug?.setFlags?.(merged);
    persistPatch({flags:merged});
    return merged;
  }
  function applyFlagProfile(name){
    const profiles={
      Minimal:{overlay:false,connectors:false,perf:false,geometry:false,channels:false},
      Routing:{overlay:true,connectors:true,perf:false,geometry:false,channels:true},
      Perf:{overlay:false,connectors:false,perf:true,geometry:false,channels:false},
      Full:{overlay:true,connectors:true,perf:true,geometry:true,channels:true}
    };
    if(!profiles[name]){console.warn('[dev.applyFlagProfile] Unknown profile',name);return;}
    flags(profiles[name]);
    console.info('[dev.applyFlagProfile] applied',name);
  }

  /* ---------------- Overlays ---------------- */
  function snapshotConfig(name){
    const {card}=resolveCardRoot();
    if(!card){console.warn('[dev.snapshotConfig] no card'); return null;}
    const id=name||`snap_${Date.now().toString(36)}`;
    const clone=JSON.parse(JSON.stringify(card._config));
    dev._snapshots=dev._snapshots||new Map();
    dev._snapshots.set(id,clone);
    console.info('[dev.snapshotConfig] stored',id);
    return id;
  }
  function listSnapshots(){return Array.from((dev._snapshots||new Map()).keys());}
  function restoreConfig(id){
    if(!dev._snapshots){console.warn('[dev.restoreConfig] no snapshots map');return false;}
    const snap=dev._snapshots.get(id); if(!snap){console.warn('[dev.restoreConfig] not found',id);return false;}
    const {card}=resolveCardRoot(); if(!card) return false;
    card.setConfig(JSON.parse(JSON.stringify(snap)));
    console.info('[dev.restoreConfig] restored',id);
    return true;
  }
  function exportOverlays(filterFn){
    const {card}=resolveCardRoot(); if(!card) return [];
    const ovs=_msdConfig(card)?.overlays||[];
    return JSON.parse(JSON.stringify(filterFn?ovs.filter(filterFn):ovs));
  }
  function importOverlays(data,{replace=false}={}){
    const {card}=resolveCardRoot(); if(!card) return;
    const msd=_msdConfig(card); if(!msd) return;
    const incoming=Array.isArray(data)?data:[];
    if(replace) msd.overlays=incoming.slice();
    else {
      msd.overlays=msd.overlays||[];
      const map=new Map(msd.overlays.map(o=>[o.id,o]));
      incoming.forEach(o=>{
        if(!o||!o.id) return;
        if(map.has(o.id)) Object.assign(map.get(o.id),o);
        else msd.overlays.push(o);
      });
    }
    _restamp(card); setTimeout(()=>relayout('*'),120);
  }
  function addOverlay(ov){
    const {card}=resolveCardRoot(); if(!card) return;
    const msd=_msdConfig(card); msd.overlays=(msd.overlays||[]).filter(o=>o?.id!==ov.id); msd.overlays.push(ov);
    _restamp(card);
  }
  function removeOverlay(id){
    const {card}=resolveCardRoot(); if(!card) return;
    const msd=_msdConfig(card); msd.overlays=(msd.overlays||[]).filter(o=>o?.id!==id);
    _restamp(card);
  }
  function mutateLine(id,patch){
    const {card}=resolveCardRoot(); if(!card) return;
    const arr=_msdConfig(card)?.overlays||[];
    const ov=arr.find(o=>o&&o.id===id); if(!ov){console.warn('[dev.mutateLine] not found',id);return;}
    Object.assign(ov,patch); _restamp(card);
  }
  function findLine(id){
    const {card}=resolveCardRoot(); if(!card) return null;
    return (_msdConfig(card)?.overlays||[]).find(o=>o&&o.id===id)||null;
  }

  /* ---------------- Anchors ---------------- */
  function listAnchors(rootLike){
    const {root,card}=resolveCardRoot(rootLike);
    const anchors=_msdConfig(card)?._anchors||root.__cblcars_anchors||{};
    const list=Object.entries(anchors).map(([k,v])=>({id:k,x:v[0],y:v[1]}));
    console.table(list); return list;
  }
  function setAnchor(id,x,y){
    const {card,root}=resolveCardRoot(); if(!card) return;
    const msd=_msdConfig(card); msd._anchors=msd._anchors||{}; msd._anchors[id]=[x,y];
    root.__cblcars_anchors=msd._anchors; snapshotConfig(`before_anchor_${id}`); _restamp(card);
  }
  function moveAnchor(id,dx,dy){
    const {card}=resolveCardRoot(); if(!card) return;
    const msd=_msdConfig(card); const cur=msd._anchors?.[id]; if(!cur){console.warn('[dev.moveAnchor] no anchor',id);return;}
    setAnchor(id,cur[0]+dx,cur[1]+dy);
  }

  /* ---------------- Obstacles Simulation ---------------- */
  const SIM_PREFIX='__sim_ob_';
  function simulateObstacle(id,rect){
    const {card}=resolveCardRoot(); if(!card) return;
    const msd=_msdConfig(card);
    const rid=id.startsWith(SIM_PREFIX)?id:SIM_PREFIX+id;
    msd.overlays=msd.overlays||[];
    msd.overlays=msd.overlays.filter(o=>o.id!==rid);
    msd.overlays.push({
      type:'ribbon', id:rid, position:[rect.x,rect.y], size:[rect.w,rect.h],
      source:'binary_sensor.any_motion', threshold:0.5,
      off_color:'rgba(255,0,0,0.08)', on_color:'rgba(255,0,0,0.20)', rx:6
    });
    _restamp(card); setTimeout(()=>relayout('*'),100);
  }
  function clearSimulatedObstacles(){
    const {card}=resolveCardRoot(); if(!card) return;
    const msd=_msdConfig(card);
    msd.overlays=(msd.overlays||[]).filter(o=>!o.id.startsWith(SIM_PREFIX));
    _restamp(card); setTimeout(()=>relayout('*'),100);
  }

  /* ---------------- Perf Helpers ---------------- */
  function perfDump(){
    try{
      const dump=window.cblcars.perfDump?window.cblcars.perfDump():window.cblcars.perf?.dump?.()||{};
      console.table(Object.entries(dump).map(([k,v])=>({
        key:k,count:v.count,lastMs:v.lastMs?.toFixed?.(2),avgMs:v.avgMs?.toFixed?.(2),maxMs:v.maxMs?.toFixed?.(1)
      })));
      return dump;
    }catch(e){console.warn('[dev.perfDump] failed',e);return{};}
  }
  function resetPerf(key){
    try{key?window.cblcars.perf.reset(key):window.cblcars.perf.reset();}catch(e){console.warn('[dev.resetPerf] failed',e);}
  }
  function capturePerf(regex){
    const r=(regex instanceof RegExp)?regex:new RegExp(regex||'.*');
    const snap={}; const dump=perfDump();
    Object.entries(dump).forEach(([k,v])=>{if(r.test(k)) snap[k]=v;});
    console.info('[dev.capturePerf]',snap); return snap;
  }
  function benchLayout(iter=5){
    const {root,card}=resolveCardRoot(); if(!root||!card){console.warn('[dev.benchLayout] no card');return;}
    const vb=_msdConfig(card)?._viewBox; const times=[];
    for(let i=0;i<iter;i++){const t0=performance.now(); window.cblcars.overlayHelpers.layoutPendingConnectors(root,vb); times.push(performance.now()-t0);}
    const avg=times.reduce((a,b)=>a+b,0)/times.length;
    console.table(times.map((t,i)=>({run:i+1,ms:t.toFixed(2)}))); console.info('[dev.benchLayout] avg',avg.toFixed(2),'ms');
    return {times,avg};
  }
  function inspect(id){return show(id);}

  /* ---------------- Visual Small Helpers ---------------- */
  function hi(ids,duration=1400){try{window.cblcars.msd.highlight(ids,{duration});}catch(e){console.warn('[dev.hi] failed',e);}}
  function show(id,rootLike){
    const {root,card}=resolveCardRoot(rootLike);
    if(!root){console.warn('[dev.show] no root');return null;}
    const el=root.getElementById(id);
    if(!el){console.warn('[dev.show] element not found',id);return null;}
    const cfg=_msdConfig(card)?.overlays?.find(o=>o.id===id);
    const bbox=window.cblcars.msd?.getOverlayBBox?.(id,root);
    const registry=window.cblcars.routing?.inspect?.(id);
    const attrs={}; for(const a of el.attributes){if(a.name.startsWith('data-cblcars-')) attrs[a.name]=a.value;}
    console.group(`[dev.show] ${id}`); console.table(attrs);
    console.log('config:',cfg); console.log('bbox:',bbox); console.log('registry:',registry); console.groupEnd();
    return {attrs,config:cfg,bbox,registry};
  }

  /* ---------------- Scenarios Framework ---------------- */
  const _scenarios=new Map();
  function addScenario(def){
    if(!def || !def.name){console.warn('[dev.addScenario] invalid'); return;}
    if(_scenarios.has(def.name)){
      console.warn('[dev.addScenario] duplicate name ignored', def.name);
      return;
    }
    _scenarios.set(def.name,def);
  }
  let _lastScenarioLogTs=0;
  function listScenarios(opts){
    let logRequested=false;
    if(typeof opts==='boolean') logRequested=opts;
    else if(opts && typeof opts==='object') logRequested=!!opts.log;
    if(window.CBLCARS_DEV_ALWAYS_LOG_SCENARIOS===true) logRequested=true;
    const list=Array.from(_scenarios.values()).map(s=>({
      name:s.name,
      tags:(s.tags||[]).join(','),
      desc:s.description||''
    }));
    if(logRequested){
      const now=performance.now();
      if(now-_lastScenarioLogTs>3000){
        console.table(list);
        _lastScenarioLogTs=now;
      }
    }
    return list;
  }
  function printScenarios(){return listScenarios({log:true});}
  function _scenarioContext(){
    const {card,root}=resolveCardRoot();
    return {
      card,root,msd:_msdConfig(card),relayout,setRuntime,mutateLine,show,snapshotConfig,restoreConfig,
      simulateObstacle,clearSimulatedObstacles,hi
    };
  }
  async function runScenario(name){
    const sc=_scenarios.get(name); if(!sc){console.warn('[dev.runScenario] unknown',name);return null;}
    const ctx=_scenarioContext(); const snap=snapshotConfig(`auto_${name}`);
    let ok=false, details='', error=null; const t0=performance.now();
    try{
      if(sc.setup) await sc.setup(ctx);
      await new Promise(r=>setTimeout(r,sc.settleMs||250));
      const result=sc.expect?await sc.expect(ctx):true;
      if(result && typeof result==='object' && 'ok' in result){ ok=!!result.ok; details=result.details||''; }
      else ok=!!result;
    }catch(e){error=e; ok=false; details=details||e.message;}
    finally{ try{ if(sc.teardown) await sc.teardown(ctx);}catch{} }
    const ms=performance.now()-t0;
    if(sc.restore!==false){ restoreConfig(snap); setTimeout(()=>relayout('*'),120); }
    const summary={scenario:name,ok,details,ms:ms.toFixed(1),error:error?.message};
    console[ok?'info':'warn']('[dev.runScenario]',summary);
    dev._scenarioResults=dev._scenarioResults||[];
    const idx=dev._scenarioResults.findIndex(r=>r.scenario===name);
    if(idx>=0) dev._scenarioResults[idx]=summary; else dev._scenarioResults.push(summary);
    return summary;
  }
  async function runAllScenarios(filterTag=null){
    const results=[];
    for(const name of _scenarios.keys()){
      const sc=_scenarios.get(name);
      if(filterTag && !(sc.tags||[]).includes(filterTag)) continue;
      // eslint-disable-next-line no-await-in-loop
      const res=await runScenario(name); results.push(res);
    }
    const passes=results.filter(r=>r?.ok).length;
    console.info('[dev.runAllScenarios] done',passes,'/',results.length,'passed');
    dev._scenarioResults=results;
    if(dev.hud?._enabled) setTimeout(()=>dev.hud.refresh && dev.hud.refresh(),100);
    return results;
  }

  /* --- Baseline sample scenarios (kept) --- */
  addScenario({
    name:'example_ok',
    description:'Simple pass scenario',
    tags:['sample'],
    expect:()=>true
  });
  addScenario({
    name:'example_fail',
    description:'Simple fail scenario (expected fail for validation of panel)',
    tags:['sample'],
    expect:()=>({ok:false,details:'Expected fail'})
  });

  /* ---------- Expanded Scenario Pack (Parity) ---------- */
  async function _sleep(ms){return new Promise(r=>setTimeout(r,ms));}
  function _requireActiveCard(){
    if(!dev._activeCard) throw new Error('No active MSD card selected.');
  }

  addScenario({
    name:'routing_detour',
    tags:['routing','detour'],
    description:'Force two-elbow detour via obstacle and detect detour attribute.',
    async setup(ctx){
      _requireActiveCard();
      const vb=ctx.msd._viewBox||[0,0,200,120];
      const boxId='__scn_detour_block';
      dev.addOverlay({
        id:boxId,type:'ribbon',
        position:[vb[2]/2-10,vb[3]/2-10],size:[20,20],
        source:'binary_sensor.any_motion',threshold:0.5,
        off_color:'rgba(255,0,0,0.10)',on_color:'rgba(255,0,0,0.22)',rx:4
      });
      ctx.__boxId=boxId;
      await _sleep(80);
      dev.relayout('*');
    },
    async expect(){
      await _sleep(250);
      const routes=dev.dumpRoutes(undefined,{silent:true});
      const det=routes.find(r=>r['data-cblcars-route-detour']==='true');
      return det?{ok:true,details:`Detour used on ${det.id}`}:{ok:false,details:'No detour route found'};
    },
    async teardown(ctx){
      if(ctx.__boxId) dev.removeOverlay(ctx.__boxId);
      await _sleep(60);
      dev.relayout('*');
    }
  });

  addScenario({
    name:'routing_fallback',
    tags:['routing','grid','fallback'],
    description:'Force grid fallback by shrinking resolution aggressively.',
    async setup(ctx){
      _requireActiveCard();
      ctx.__origRuntime=dev.getRuntime();
      dev.setRuntime({grid_resolution:4,smart_aggressive:false});
      await _sleep(40);
      dev.relayout('*');
    },
    async expect(){
      await _sleep(300);
      const routes=dev.dumpRoutes(undefined,{silent:true});
      const fb=routes.find(r=>r['data-cblcars-route-grid-status']==='fallback');
      return fb?{ok:true,details:`Fallback route ${fb.id}`}:{ok:false,details:'No fallback detected'};
    },
    async teardown(ctx){
      if(ctx.__origRuntime) dev.setRuntime(ctx.__origRuntime);
      await _sleep(40);
      dev.relayout('*');
    }
  });

  addScenario({
    name:'routing_channel_prefer',
    tags:['routing','channels'],
    description:'Detect a prefer channel route with channels-hit present.',
    async setup(){
      dev.setRuntime({smart_aggressive:true});
      await _sleep(40);
    },
    async expect(){
      const routes=dev.dumpRoutes(undefined,{silent:true});
      const prefer=routes.filter(r=>r['data-cblcars-route-channel-mode']==='prefer');
      if(!prefer.length) return {ok:false,details:'No prefer-mode routes to test'};
      const hit=prefer.find(r=>r['data-cblcars-route-channels-hit']);
      return hit?{ok:true,details:`Prefer hit on ${hit.id}`}:{ok:false,details:'No prefer route reported channels-hit'};
    }
  });

  addScenario({
    name:'routing_channel_miss',
    tags:['routing','channels'],
    description:'Check for channel preference miss attribute.',
    async expect(){
      const routes=dev.dumpRoutes(undefined,{silent:true});
      const miss=routes.find(r=>r['data-cblcars-route-channels-miss']==='true');
      return miss?{ok:true,details:`Channel miss on ${miss.id}`}:{ok:false,details:'No channel miss found'};
    }
  });

  addScenario({
    name:'smart_clear_path_skip',
    tags:['smart','grid'],
    description:'Smart skip (clear_path) detection.',
    async expect(){
      const routes=dev.dumpRoutes(undefined,{silent:true});
      const skipped=routes.find(r=>r['data-cblcars-route-grid-status']==='skipped' &&
        r['data-cblcars-route-grid-reason']==='clear_path');
      return skipped?{ok:true,details:`Skip clear_path ${skipped.id}`}:{ok:false,details:'No clear_path skip found'};
    }
  });

  addScenario({
    name:'smart_hit_attempt',
    tags:['smart','grid'],
    description:'Smart hit triggers grid attempt (success or fallback).',
    async expect(){
      const routes=dev.dumpRoutes(undefined,{silent:true});
      const attempted=routes.find(r=>{
        return r['data-cblcars-smart-hit']==='true' &&
          (r['data-cblcars-route-grid-status']==='success' || r['data-cblcars-route-grid-status']==='fallback');
      });
      return attempted?{ok:true,details:`Smart hit route ${attempted.id}`}:{ok:false,details:'No smart hit grid attempt'};
    }
  });

  addScenario({
    name:'overlays_validation_error',
    tags:['overlays','validation'],
    description:'Inject malformed overlay expecting validation error > 0.',
    async setup(ctx){
      _requireActiveCard();
      const badId='__scn_bad_overlay';
      dev.addOverlay({id:badId,type:'line'}); // missing required fields
      ctx.__badId=badId;
      await _sleep(80);
      dev.relayout('*');
    },
    async expect(){
      await _sleep(200);
      const root=dev._activeCard?.shadowRoot;
      const counts=root?.__cblcars_validationCounts;
      if(!counts) return {ok:false,details:'No validation counts'};
      return counts.errors>0?{ok:true,details:`Errors=${counts.errors}`}:{ok:false,details:'No validation errors'};
    },
    async teardown(ctx){
      if(ctx.__badId) dev.removeOverlay(ctx.__badId);
      await _sleep(60);
      dev.relayout('*');
    }
  });

  addScenario({
    name:'overlays_mutation_roundtrip',
    tags:['overlays','mutation'],
    description:'Mutate overlay color then restore snapshot.',
    async setup(ctx){
      _requireActiveCard();
      const card=dev._activeCard;
      const ovs=card?._config?.variables?.msd?.overlays||[];
      const line=ovs.find(o=>o.type==='line');
      if(!line) throw new Error('No line overlay found.');
      ctx.__lineId=line.id;
      ctx.__snap=snapshotConfig(`line_before_${line.id}`);
      dev.mutateLine(line.id,{color:'#ff00ff'});
      await _sleep(60);
      dev.relayout('*');
    },
    async expect(ctx){
      const info=dev.findLine(ctx.__lineId);
      return info && info.color==='#ff00ff'
        ? {ok:true,details:'Color mutated'}
        : {ok:false,details:'Mutation failed'};
    },
    async teardown(ctx){
      if(ctx.__snap) restoreConfig(ctx.__snap);
      await _sleep(60);
      dev.relayout('*');
    }
  });

  addScenario({
    name:'anchors_move_restore',
    tags:['anchors','layout'],
    description:'Move anchor and verify connector path changed; then restore.',
    async setup(ctx){
      _requireActiveCard();
      const root=dev._activeCard.shadowRoot;
      const paths=[...root.querySelectorAll('path[data-cblcars-start-x]')];
      if(!paths.length) throw new Error('No connectors present.');
      ctx.__pathId=paths[0].id;
      ctx.__beforeD=paths[0].getAttribute('d');
      const msd=ctx.msd;
      const anchors=msd.anchors||msd._anchors||{};
      let target=Object.keys(anchors)[0];
      if(!target){
        target='__scn_anchor';
        dev.setAnchor(target,10,10);
        await _sleep(30);
      }
      ctx.__target=target;
      ctx.__old=anchors[target].slice();
      dev.setAnchor(target,anchors[target][0]+8,anchors[target][1]+8);
      await _sleep(100);
      dev.relayout('*');
    },
    async expect(ctx){
      const root=dev._activeCard.shadowRoot;
      const path=root.getElementById(ctx.__pathId);
      if(!path) return {ok:false,details:'Original connector missing'};
      const after=path.getAttribute('d');
      return after!==ctx.__beforeD
        ? {ok:true,details:'Connector path changed'}
        : {ok:false,details:'Path did not change'};
    },
    async teardown(ctx){
      if(ctx.__target && ctx.__old){
        dev.setAnchor(ctx.__target,ctx.__old[0],ctx.__old[1]);
        await _sleep(80);
        dev.relayout('*');
      }
    }
  });

  addScenario({
    name:'perf_timer_growth',
    tags:['perf'],
    description:'Create a timer and ensure count increments.',
    async setup(){
      if(!window.cblcars.debug?.perf) throw new Error('Perf timers unavailable.');
      window.cblcars.debug.perf.reset('scn_timer');
      for(let i=0;i<10;i++){
        window.cblcars.debug.perf.start('scn_timer');
        for(let x=0;x<4000;x++){} // small workload
        window.cblcars.debug.perf.end('scn_timer');
      }
    },
    async expect(){
      const t=window.cblcars.debug.perf.get('scn_timer');
      if(!t) return {ok:false,details:'Timer missing'};
      return t.count>=10
        ? {ok:true,details:`n=${t.count} avg=${t.avgMs.toFixed(2)}ms`}
        : {ok:false,details:'Timer count too low'};
    }
  });

  addScenario({
    name:'perf_threshold_violation',
    tags:['perf','threshold'],
    description:'Set threshold below avg to trigger violation, then clear.',
    async setup(ctx){
      if(!window.cblcars.hud?.api) throw new Error('HUD not active.');
      window.cblcars.debug.perf.reset('scn_slow');
      for(let i=0;i<5;i++){
        window.cblcars.debug.perf.start('scn_slow');
        await _sleep(5);
        window.cblcars.debug.perf.end('scn_slow');
      }
      const stat=window.cblcars.debug.perf.get('scn_slow');
      if(!stat) throw new Error('Failed to build scn_slow timer.');
      ctx.__avg=stat.avgMs;
      window.cblcars.hud.api.setPerfThreshold('scn_slow',{avgMs:Math.max(0,stat.avgMs-0.1)});
      window.cblcars.hud.api.refreshRaw({allowWhilePaused:true});
      await _sleep(100);
    },
    async expect(){
      const snap=window.cblcars.hud.api.currentSnapshot();
      const t=snap?.perfTimers?.scn_slow;
      if(!t) return {ok:false,details:'Timer not present'};
      const th=window.cblcars.hud.api.getPerfThresholds().scn_slow;
      if(!th) return {ok:false,details:'Threshold missing'};
      return t.avgMs>th.avgMs
        ? {ok:true,details:`avg=${t.avgMs.toFixed(2)} th=${th.avgMs}`}
        : {ok:false,details:`avg=${t.avgMs.toFixed(2)} <= th=${th.avgMs}`};
    },
    async teardown(){
      if(window.cblcars.hud?.api){
        window.cblcars.hud.api.removePerfThreshold('scn_slow');
        window.cblcars.hud.api.refreshRaw({allowWhilePaused:true});
      }
    }
  });

  /* ---------------- HUD Enable / Disable ---------------- */
  function hudEnable(){
    persistPatch({hud:{...(_persisted.hud||{}),enabled:true}});
    dev.hud._enabled=true;
    const attempt=()=>{
      if(dev.hud.ensure){dev.hud.ensure(); return true;}
      return false;
    };
    if(!attempt()){
      let tries=0;
      const iv=setInterval(()=>{
        if(attempt()||tries++>25) clearInterval(iv);
      },120);
    }
  }
  function hudDisable(){
    persistPatch({hud:{...(_persisted.hud||{}),enabled:false}});
    dev.hud._enabled=false;
    dev.hud.remove && dev.hud.remove();
  }
  dev._persistHudState=function(statePatch){
    const cur=dev.persistedState?.hud||{};
    persistPatch({hud:{...cur,...statePatch}});
  };

  /* ---------------- Card Selection ---------------- */
  function listCards(){
    const cards=discoverMsdCards();
    const rows=cards.map((c,i)=>({
      idx:i,
      overlays:c._config?.variables?.msd?.overlays?.length??0,
      selected:dev._activeCard===c
    }));
    if(!rows.length) console.warn('[cblcars.dev] No MSD cards discovered.');
    else console.table(rows);
    return rows;
  }
  function pick(index=0){
    const cards=discoverMsdCards();
    if(!cards.length){console.warn('[dev.pick] No MSD cards'); return null;}
    const card=cards[index];
    if(!card){console.warn('[dev.pick] Index OOB'); return null;}
    dev._activeCard=card; persistPatch({activeCardIndex:index});
    console.info('[dev.pick] Active card =',index);
    if(dev.hud._enabled) setTimeout(()=>dev.hud.ensure&&dev.hud.ensure(),10);
    return card;
  }
  function setCard(el){
    if(!el){console.warn('[dev.setCard] No element'); return null;}
    const card=ascendToMsdCard(el);
    if(!card){console.warn('[dev.setCard] Could not ascend from element'); return null;}
    const all=discoverMsdCards(true);
    const idx=all.indexOf(card);
    if(idx>=0) persistPatch({activeCardIndex:idx});
    dev._activeCard=card;
    console.info('[dev.setCard] Active MSD card set.');
    if(dev.hud._enabled) setTimeout(()=>dev.hud.ensure&&dev.hud.ensure(),10);
    return card;
  }
  function refreshCards(){discoverMsdCards(true); listCards();}

  /* ---------------- Export Namespace ---------------- */
  Object.assign(dev,{
    // discovery
    discoverMsdCards,ascendToMsdCard,listCards,pick,setCard,refreshCards,
    // persistence
    persist:persistPatch,clearPersist,persistedState:_persisted,
    // layout & routing
    relayout,dumpRoutes,show,
    // runtime & flags
    setRuntime,getRuntime,flags,applyFlagProfile,
    // overlays
    snapshotConfig,listSnapshots,restoreConfig,exportOverlays,importOverlays,addOverlay,removeOverlay,mutateLine,findLine,
    // anchors
    listAnchors,setAnchor,moveAnchor,
    // obstacles
    simulateObstacle,clearSimulatedObstacles,
    // perf
    perfDump,resetPerf,capturePerf,benchLayout,inspect,
    // visuals
    hi,
    // scenarios
    addScenario,listScenarios,printScenarios,runScenario,runAllScenarios,
    // HUD shell
    hud:{ enable:hudEnable, disable:hudDisable, _enabled:false }
  });

  console.info('[cblcars.dev] Advanced dev tools attached (?lcarsDev=1)');

  /* ---------------- Auto-Restore ---------------- */
  setTimeout(()=>{
    const cards=discoverMsdCards(true);
    if(_persisted.activeCardIndex!=null && cards[_persisted.activeCardIndex]){
      dev._activeCard=cards[_persisted.activeCardIndex];
      console.info('[cblcars.dev] Restored active card index',_persisted.activeCardIndex);
    } else if(!dev._activeCard && cards.length===1){
      dev._activeCard=cards[0];
      console.info('[cblcars.dev] Single MSD card auto-selected.');
    } else if(cards.length>1){
      console.info('[cblcars.dev] Multiple MSD cards. Use cblcars.dev.listCards() then pick(idx).');
    }
    if(_persisted.flags && Object.keys(_persisted.flags).length) try{flags(_persisted.flags);}catch{}
    if(_persisted.runtime && Object.keys(_persisted.runtime).length) try{setRuntime(_persisted.runtime);}catch{}
    if(_persisted.hud?.enabled){ hudEnable(); }
  },0);

  /* ---------------- Scenario Wrapper (HUD Sync) ---------------- */
  if(!dev._hudScenarioWrapped && typeof dev.runScenario==='function'){
    const orig=dev.runScenario;
    dev.runScenario=async function(name){
      const res=await orig(name);
      try{
        if(res && res.scenario){
          if(!Array.isArray(dev._scenarioResults)) dev._scenarioResults=[];
          const idx=dev._scenarioResults.findIndex(r=>r.scenario===res.scenario);
          if(idx>=0) dev._scenarioResults[idx]=res; else dev._scenarioResults.push(res);
        }
      }catch{}
      if(window.cblcars.hud?.api){
        setTimeout(()=>window.cblcars.hud.api.refreshRaw({allowWhilePaused:true}),50);
      }
      return res;
    };
    dev._hudScenarioWrapped=true;
  }

})();