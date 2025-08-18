/**
 * CB-LCARS Developer Tools (Advanced Edition + Card Discovery + Persistence + HUD hooks)
 * Flags: ?lcarsDev=1 OR window.CBLCARS_DEV_FORCE === true; disable with window.CBLCARS_DEV_DISABLE === true
 * (All legacy CBL_CARS_* typos removed.)
 */

(function initDevTools(){
  const DEV_PARAM = 'lcarsDev';
  const enabled = !window.CBLCARS_DEV_DISABLE && (
    window.CBLCARS_DEV_FORCE === true ||
    new URLSearchParams(location.search).has(DEV_PARAM)
  );

  if (!enabled) return;
  if (!window.cblcars) window.cblcars = {};
  if (window.cblcars.dev && window.cblcars.dev._advanced) {
    console.info('[cblcars.dev] Advanced dev tools already attached.');
    return;
  }

  /* ---------------- Persistence (sessionStorage) ---------------- */
  const STORAGE_KEY = 'cblcarsDevState';
  function loadPersisted() {
    try { const raw = sessionStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw)||{} : {}; } catch(_) { return {}; }
  }
  function savePersisted(state){ try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(_) {} }
  const _persisted = loadPersisted();
  function persistPatch(p){ Object.assign(_persisted,p); savePersisted(_persisted); }
  function clearPersist(){ try{sessionStorage.removeItem(STORAGE_KEY);}catch(_){} Object.keys(_persisted).forEach(k=>delete _persisted[k]); console.info('[cblcars.dev] Persisted state cleared.'); }

  /* ---------------- Internal helpers ---------------- */
  const dev = (window.cblcars.dev = window.cblcars.dev || {});
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
      dev._cardCache = dev._cardCache.filter(c=>c.isConnected);
      return dev._cardCache;
    }
    const found=[]; const seen=new Set();
    function walk(node){
      if(!node || seen.has(node)) return;
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
    dev._cardCache = found;
    return found;
  }
  function resolveCardRoot(cardOrRoot){
    if(cardOrRoot && cardOrRoot.host) return { card:cardOrRoot.host, root:cardOrRoot };
    if(cardOrRoot && cardOrRoot.shadowRoot) return { card:cardOrRoot, root:cardOrRoot.shadowRoot };
    if(cardOrRoot instanceof Element){
      const asc=ascendToMsdCard(cardOrRoot);
      if(asc) return { card:asc, root:asc.shadowRoot };
    }
    if(dev._activeCard && dev._activeCard.isConnected) return { card:dev._activeCard, root:dev._activeCard.shadowRoot };
    const all=discoverMsdCards();
    if(all.length===1){ dev._activeCard=all[0]; return { card:all[0], root:all[0].shadowRoot }; }
    return { card:null, root:null };
  }
  function _msdConfig(card){ return card?._config?.variables?.msd || null; }
  function _restamp(card){
    const msd=_msdConfig(card); if(!msd) return;
    msd._restampNonce=(msd._restampNonce||0)+1;
    card.setConfig({ ...card._config, variables:{ ...card._config.variables, msd:{ ...msd } } });
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
  function _getOverlayConfig(card,id){
    const arr=_msdConfig(card)?.overlays||[];
    return arr.find(o=>o&&o.id===id)||null;
  }
  function show(id,rootLike){
    const {root,card}=resolveCardRoot(rootLike);
    if(!root){ console.warn('[dev.show] no root'); return null; }
    const el=root.getElementById(id);
    if(!el){ console.warn('[dev.show] element not found',id); return null; }
    const cfg=_getOverlayConfig(card,id);
    const bbox=window.cblcars.msd?.getOverlayBBox?.(id,root);
    const registry=window.cblcars.routing?.inspect?.(id);
    const attrs={}; for(const a of el.attributes){ if(a.name.startsWith('data-cblcars-')) attrs[a.name]=a.value; }
    console.group(`[dev.show] ${id}`); console.table(attrs);
    console.log('config:',cfg); console.log('bbox:',bbox); console.log('registry:',registry); console.groupEnd();
    return { attrs, config:cfg, bbox, registry };
  }
  function listLines(rootLike){
    const {root,card}=resolveCardRoot(rootLike);
    const cfgLines=(_msdConfig(card)?.overlays||[]).filter(o=>o?.type==='line').map(o=>o.id);
    const domLines=Array.from(root?.querySelectorAll?.('path[data-cblcars-attach-to]')||[]).map(p=>p.id);
    console.table([{cfgLines:cfgLines.join(','),domLines:domLines.join(',')}]);
    return { cfgLines, domLines };
  }
  function toggleDetour(on=true){ setRuntime({ fallback:{ enable_two_elbow:!!on } }); }

  /* ---------------- Runtime & Flags ---------------- */
  function setRuntime(cfg){
    try{
      window.cblcars.connectorRouting.setRoutingRuntimeConfig(cfg);
      persistPatch({ runtime: window.cblcars.connectorRouting.getRoutingRuntimeConfig() });
      console.info('[dev.setRuntime] applied',cfg);
    }catch(e){ console.warn('[dev.setRuntime] failed',e); }
  }
  function getRuntime(){ try{return window.cblcars.connectorRouting.getRoutingRuntimeConfig();}catch{return{};} }
  function flags(patch){
    if(!patch) return window.cblcars._debugFlags||{};
    const merged={ ...(window.cblcars._debugFlags||{}), ...patch };
    window.cblcars.debug?.setFlags?.(merged);
    persistPatch({ flags: merged });
    return merged;
  }
  function toggleFlags(patch){
    const current=flags(); const next={};
    for(const k of Object.keys(patch)) next[k]=!current[k];
    return flags(next);
  }

  /* ---------------- Snapshots & Overlays ---------------- */
  const _snapshots=new Map();
  function snapshotConfig(name){
    const {card}=resolveCardRoot();
    if(!card){ console.warn('[dev.snapshotConfig] no card'); return null; }
    const id=name||`snap_${Date.now().toString(36)}`;
    const clone=JSON.parse(JSON.stringify(card._config));
    _snapshots.set(id,clone);
    console.info('[dev.snapshotConfig] stored',id);
    return id;
  }
  function listSnapshots(){ return Array.from(_snapshots.keys()); }
  function restoreConfig(id){
    const snap=_snapshots.get(id); if(!snap){ console.warn('[dev.restoreConfig] snapshot not found',id); return false; }
    const {card}=resolveCardRoot(); if(!card) return false;
    card.setConfig(JSON.parse(JSON.stringify(snap)));
    console.info('[dev.restoreConfig] restored',id);
    return true;
  }
  function exportOverlays(filterFn){
    const {card}=resolveCardRoot(); if(!card) return [];
    const ovs=_msdConfig(card)?.overlays||[];
    const out=filterFn?ovs.filter(filterFn):ovs.slice();
    return JSON.parse(JSON.stringify(out));
  }
  function importOverlays(data,{replace=false}={}){
    const {card}=resolveCardRoot(); if(!card) return;
    const msd=_msdConfig(card); if(!msd) return;
    const incoming=Array.isArray(data)?data:[];
    msd.overlays=replace?incoming:[...(msd.overlays||[]),...incoming];
    _restamp(card); setTimeout(()=>relayout('*'),120);
  }
  function addOverlay(ov){
    const {card}=resolveCardRoot(); if(!card) return;
    const msd=_msdConfig(card);
    msd.overlays=(msd.overlays||[]).filter(o=>o?.id!==ov.id); msd.overlays.push(ov);
    _restamp(card);
  }
  function removeOverlay(id){
    const {card}=resolveCardRoot(); if(!card) return;
    const msd=_msdConfig(card);
    msd.overlays=(msd.overlays||[]).filter(o=>o?.id!==id);
    _restamp(card);
  }
  function mutateLine(id,patch){
    const {card}=resolveCardRoot(); if(!card) return;
    const ov=_getOverlayConfig(card,id); if(!ov){ console.warn('[dev.mutateLine] not found',id); return; }
    Object.assign(ov,patch); _restamp(card);
  }
  function findLine(id){ const {card}=resolveCardRoot(); return _getOverlayConfig(card,id); }

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
    const msd=_msdConfig(card); const cur=msd._anchors?.[id]; if(!cur){ console.warn('[dev.moveAnchor] no anchor',id); return; }
    setAnchor(id,cur[0]+dx,cur[1]+dy);
  }

  /* ---------------- Obstacle Simulation ---------------- */
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

  /* ---------------- Perf & Diagnostics ---------------- */
  function perfDump(){
    try{
      const dump=window.cblcars.perfDump?window.cblcars.perfDump():window.cblcars.perf?.dump?.()||{};
      console.table(Object.entries(dump).map(([k,v])=>({
        key:k,count:v.count,lastMs:v.lastMs?.toFixed?.(2),avgMs:v.avgMs?.toFixed?.(2),maxMs:v.maxMs?.toFixed?.(1)
      })));
      return dump;
    }catch(e){ console.warn('[dev.perfDump] failed',e); return {}; }
  }
  function resetPerf(key){
    try{ key?window.cblcars.perf.reset(key):window.cblcars.perf.reset(); }catch(e){ console.warn('[dev.resetPerf] failed',e); }
  }
  function capturePerf(regex){
    const r=(regex instanceof RegExp)?regex:new RegExp(regex||'.*');
    const snap={}; const dump=perfDump();
    Object.entries(dump).forEach(([k,v])=>{ if(r.test(k)) snap[k]=v; });
    console.info('[dev.capturePerf]',snap); return snap;
  }
  function benchLayout(iter=5){
    const {root,card}=resolveCardRoot(); if(!root||!card){ console.warn('[dev.benchLayout] no card'); return; }
    const vb=_msdConfig(card)?._viewBox; const times=[];
    for(let i=0;i<iter;i++){ const t0=performance.now(); window.cblcars.overlayHelpers.layoutPendingConnectors(root,vb); times.push(performance.now()-t0); }
    const avg=times.reduce((a,b)=>a+b,0)/times.length;
    console.table(times.map((t,i)=>({run:i+1,ms:t.toFixed(2)}))); console.info('[dev.benchLayout] avg',avg.toFixed(2),'ms');
    return { times, avg };
  }
  function inspect(id){ return show(id); }
  function watchRoute(id,intervalMs=600,durationMs=4000){
    const start=performance.now(); const logs=[]; (function tick(){
      const row=show(id); if(row) logs.push(row);
      if(performance.now()-start<durationMs) setTimeout(tick,intervalMs);
      else console.info('[dev.watchRoute] finished',id,logs.length,'samples');
    })();
    return logs;
  }
  function watchAttributes(id,pattern='^data-cblcars-route',durationMs=4000,cb){
    const {root}=resolveCardRoot(); const el=root?.getElementById(id);
    if(!el){ console.warn('[dev.watchAttributes] not found',id); return null; }
    const regex=new RegExp(pattern); const records=[];
    const mo=new MutationObserver(muts=>{
      muts.forEach(m=>{
        if(m.type==='attributes'&&regex.test(m.attributeName||'')){
          const val=el.getAttribute(m.attributeName); records.push({attr:m.attributeName,value:val,t:performance.now()});
          if(cb) try{cb({attr:m.attributeName,value:val});}catch{}
        }
      });
    });
    mo.observe(el,{attributes:true,subtree:false});
    setTimeout(()=>{ try{mo.disconnect();}catch{} console.info('[dev.watchAttributes] done',id,records); },durationMs);
    return records;
  }
  function geometrySelfTest(rootLike){
    const {root}=resolveCardRoot(rootLike);
    return window.cblcars.geometry?.selfTest?.(root);
  }

  /* ---------------- Visual & Docs ---------------- */
  function hi(ids,duration=1400){ try{window.cblcars.msd.highlight(ids,{duration});}catch(e){console.warn('[dev.hi] failed',e);} }
  function openDoc(){
    console.group('[cblcars.dev] Helpers');
    console.log(Object.keys(window.cblcars.dev).filter(k=>!k.startsWith('_')));
    console.groupEnd();
  }

  /* ---------------- Scenario Runner ---------------- */
  const _scenarios=new Map();
  function addScenario(def){ if(!def||!def.name){ console.warn('[dev.addScenario] invalid'); return; } _scenarios.set(def.name,def); }
  function listScenarios(){
    const list=Array.from(_scenarios.values()).map(s=>({name:s.name,tags:(s.tags||[]).join(','),desc:s.description||''}));
    console.table(list); return list;
  }
  function _scenarioContext(){
    const {card,root}=resolveCardRoot();
    return { card,root, msd:_msdConfig(card), relayout,setRuntime, mutateLine,show,snapshotConfig,restoreConfig,
      simulateObstacle,clearSimulatedObstacles,toggleDetour,dumpRoutes,hi };
  }
  async function runScenario(name){
    const sc=_scenarios.get(name); if(!sc){ console.warn('[dev.runScenario] unknown',name); return null; }
    const ctx=_scenarioContext(); const snap=snapshotConfig(`auto_${name}`);
    let ok=false, details='', error=null; const t0=performance.now();
    try{
      if(sc.setup) await sc.setup(ctx);
      await new Promise(r=>setTimeout(r,sc.settleMs||250));
      const result=sc.expect?await sc.expect(ctx):true;
      if(result && typeof result==='object' && 'ok'in result){ ok=!!result.ok; details=result.details||''; }
      else ok=!!result;
    }catch(e){ error=e; ok=false; }
    finally{ try{ if(sc.teardown) await sc.teardown(ctx);}catch{} }
    const ms=performance.now()-t0;
    if(sc.restore!==false){ restoreConfig(snap); setTimeout(()=>relayout('*'),120); }
    const summary={scenario:name,ok,details,ms:ms.toFixed(1),error:error?.message};
    console[ok?'info':'warn']('[dev.runScenario]',summary);
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

  /* Default scenarios (same as previous) */
  addScenario({
    name:'detour_basic',description:'Validate 2-elbow detour triggers.',tags:['detour','routing'],settleMs:300,
    setup:(ctx)=>{
      const msd=ctx.msd;
      if(!msd.overlays.find(o=>o.id==='line_detour_auto')){
        msd.overlays.push({
          type:'line',id:'line_detour_auto',anchor:'detour_anchor',attach_to:'target_box',
          route:'auto',route_mode_full:'grid',avoid:['obstacle_detour_band'],stroke:'var(--lcars-teal)',width:12
        });
      } else {
        const ov=msd.overlays.find(o=>o.id==='line_detour_auto'); ov.avoid=['obstacle_detour_band']; ov.route_mode_full='grid';
      }
      ctx.toggleDetour(true); ctx.relayout('line_detour_auto');
    },
    expect:(ctx)=>{
      const attrs=ctx.show('line_detour_auto')?.attrs||{};
      const detour=attrs['data-cblcars-route-detour']==='true';
      return { ok:detour, details:detour?'detour attribute present':'missing detour attr' };
    }
  });
  addScenario({
    name:'channel_prefer_hit',description:'Preferred channel is hit.',tags:['channels','routing'],
    setup:(ctx)=>{
      if(!ctx.msd.overlays.find(o=>o.id==='line_channel_prefer_hit')){
        ctx.msd.overlays.push({
          type:'line',id:'line_channel_prefer_hit',anchor:'detour_high_anchor',attach_to:'target_box',
          route:'auto',route_mode_full:'grid',route_channels:['main_bus'],route_channel_mode:'prefer',
          stroke:'var(--lcars-orange)',width:12
        });
      }
      ctx.relayout('line_channel_prefer_hit');
    },
    expect:(ctx)=>{
      const attrs=ctx.show('line_channel_prefer_hit')?.attrs||{};
      const hit=(attrs['data-cblcars-route-channels-hit']||'').includes('main_bus');
      return { ok:hit, details:hit?'main_bus hit':'main_bus NOT hit' };
    }
  });
  addScenario({
    name:'channel_prefer_miss',description:'Prefer miss sets miss flag.',tags:['channels','routing'],
    setup:(ctx)=>{
      const id='line_channel_prefer_miss';
      if(!ctx.msd.overlays.find(o=>o.id===id)){
        ctx.msd.overlays.push({
          type:'line',id,anchor:'detour_low_anchor',attach_to:'target_box',
          route:'auto',route_mode_full:'grid',route_channels:['main_bus'],route_channel_mode:'prefer',
          stroke:'var(--lcars-purple)',width:12
        });
      }
      ctx.relayout(id);
    },
    expect:(ctx)=>{
      const attrs=ctx.show('line_channel_prefer_miss')?.attrs||{};
      const miss=attrs['data-cblcars-route-channels-miss']==='true';
      return { ok:miss, details: miss?'channels-miss set':'channels-miss NOT set' };
    }
  });
  addScenario({
    name:'channel_require_fail',description:'Require fails when channel not hit.',tags:['channels','routing'],
    setup:(ctx)=>{
      let ov=ctx.msd.overlays.find(o=>o.id==='line_channel_require');
      if(!ov){
        ctx.msd.overlays.push({
          type:'line',id:'line_channel_require',anchor:'detour_low_anchor',attach_to:'target_box',
          route:'auto',route_mode_full:'grid',route_channels:['main_bus'],route_channel_mode:'require',
          stroke:'var(--lcars-pink)',width:12
        });
        ov=ctx.msd.overlays.find(o=>o.id==='line_channel_require');
      } else ov.route_channel_mode='require';
      ctx.relayout('line_channel_require');
    },
    expect:(ctx)=>{
      const attrs=ctx.show('line_channel_require')?.attrs||{};
      const hit=(attrs['data-cblcars-route-channels-hit']||'').includes('main_bus');
      const status=attrs['data-cblcars-route-grid-status'];
      const ok=!hit && (status==='fallback'||status==='manhattan'||status==='fallback');
      return { ok, details:`hit=${hit} status=${status}` };
    }
  });
  addScenario({
    name:'smart_aggressive_toggle',description:'Aggressive toggling changes attempt-grid flag.',tags:['smart','routing'],
    setup:(ctx)=>{
      const id='line_smart_blocked';
      if(!ctx.msd.overlays.find(o=>o.id===id)){
        ctx.msd.overlays.push({
          type:'line',id,anchor:'smart_blocked_anchor',attach_to:'target_box',
          route:'auto',route_mode_full:'smart',avoid:['obstacle_mid_block'],
          stroke:'var(--lcars-blue)',width:12
        });
      }
    },
    expect:async (ctx)=>{
      ctx.setRuntime({ smart_aggressive:false }); ctx.relayout('line_smart_blocked'); await new Promise(r=>setTimeout(r,150));
      const nonAgg=ctx.show('line_smart_blocked')?.attrs||{};
      ctx.setRuntime({ smart_aggressive:true }); ctx.relayout('line_smart_blocked'); await new Promise(r=>setTimeout(r,150));
      const agg=ctx.show('line_smart_blocked')?.attrs||{};
      const before=nonAgg['data-cblcars-smart-attempt-grid']; const after=agg['data-cblcars-smart-attempt-grid'];
      return { ok:before!==after, details:`before=${before} after=${after}` };
    }
  });

  /* ---------------- HUD hooks ---------------- */
  function hudEnable(){
    persistPatch({ hud:{ ...( _persisted.hud||{}), enabled:true } });
    dev.hud._enabled = true;
    // Ensure we restore prior HUD UI state (position / collapsed / interval) after attach
    const attempt=()=>{
      if(dev.hud.ensure){ dev.hud.ensure(); return true; }
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
    persistPatch({ hud:{ ...( _persisted.hud||{}), enabled:false } });
    dev.hud._enabled = false;
    dev.hud.remove && dev.hud.remove();
  }

  // Helper used by HUD to persist its UI state (position/collapsed/interval/flags snapshot)
  dev._persistHudState = function(statePatch){
    const cur = dev.persistedState?.hud || {};
    persistPatch({ hud: { ...cur, ...statePatch } });
  };

  /* ---------------- Card discovery exposure ---------------- */
  function listCards(){
    const cards=discoverMsdCards();
    const rows=cards.map((c,i)=>({
      idx:i,overlays:c._config?.variables?.msd?.overlays?.length??0,
      selected:dev._activeCard===c
    }));
    if(!rows.length) console.warn('[cblcars.dev] No MSD cards discovered.');
    else console.table(rows);
    return rows;
  }
  function pick(index=0){
    const cards=discoverMsdCards();
    if(!cards.length){ console.warn('[dev.pick] No MSD cards'); return null; }
    const card=cards[index];
    if(!card){ console.warn('[dev.pick] Index OOB'); return null; }
    dev._activeCard=card; persistPatch({ activeCardIndex:index });
    console.info('[dev.pick] Active card =',index);
    if(dev.hud._enabled) setTimeout(()=>dev.hud.ensure&&dev.hud.ensure(),10);
    return card;
  }
  function setCard(el){
    if(!el){ console.warn('[dev.setCard] No element'); return null; }
    const card=ascendToMsdCard(el);
    if(!card){ console.warn('[dev.setCard] Could not ascend from element'); return null; }
    const all=discoverMsdCards(true);
    const idx=all.indexOf(card);
    if(idx>=0) persistPatch({ activeCardIndex:idx });
    dev._activeCard=card;
    console.info('[dev.setCard] Active MSD card set.');
    if(dev.hud._enabled) setTimeout(()=>dev.hud.ensure&&dev.hud.ensure(),10);
    return card;
  }
  function refreshCards(){ discoverMsdCards(true); listCards(); }

  /* ---------------- Export namespace ---------------- */
  Object.assign(dev,{
    _advanced:true,_activeCard:null,_cardCache:[],
    // discovery
    discoverMsdCards:(...a)=>discoverMsdCards(...a),ascendToMsdCard,listCards,pick,setCard,refreshCards,
    // persistence
    persist:persistPatch,clearPersist,persistedState:_persisted,
    // layout & routing
    relayout,dumpRoutes,show,listLines,toggleDetour,
    // runtime & flags
    setRuntime,getRuntime,flags,toggleFlags,
    // overlays
    snapshotConfig,listSnapshots,restoreConfig,exportOverlays,importOverlays,addOverlay,removeOverlay,mutateLine,findLine,
    // anchors
    listAnchors,setAnchor,moveAnchor,
    // obstacles
    simulateObstacle,clearSimulatedObstacles,
    // perf
    perfDump,resetPerf,capturePerf,benchLayout,inspect,watchRoute,watchAttributes,geometrySelfTest,
    // visual
    hi,openDoc,
    // scenarios
    addScenario,listScenarios,runScenario,runAllScenarios,
    // HUD skeleton (full API added by hud script)
    hud:{ enable:hudEnable, disable:hudDisable, _enabled:false }
  });

  console.info('[cblcars.dev] Advanced dev tools attached (?lcarsDev=1)');

  /* ---------------- Auto-restore & autoselect ---------------- */
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
    if(_persisted.flags && Object.keys(_persisted.flags).length) try{ flags(_persisted.flags); }catch{}
    if(_persisted.runtime && Object.keys(_persisted.runtime).length) try{ setRuntime(_persisted.runtime); }catch{}
    if(_persisted.hud?.enabled){ dev.hud.enable(); }
  },0);

})();