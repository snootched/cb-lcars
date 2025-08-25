/* PHASE 2.5-dx1: LCARS Developer HUD (Diagnostics Sprint 2)
 *
 * Includes Phase 2.4-dx1 features PLUS Sprint 2 (2.5-dx) items:
 *
 * New / Updated (since 2.4-dx1):
 *  - Version bump HUD_VERSION = 2.5-dx1
 *  - Scenario run (single ▶) now updates results table (wrapper around dev.runScenario)
 *  - Routing Filter Presets (All / Problems / Success / Detours / Fallback / Miss / GridOK)
 *  - Channel Occupancy Δ (delta vs prior snapshot, colored +/−)
 *  - Performance Threshold Alerts (configure per timer/counter; header PERF! badge & Issues panel entries)
 *  - Multi-Card Dropdown (header) to switch active MSD card
 *  - Issues Panel (aggregates warnings: failed scenarios, detours, fallbacks, channel misses, validation counts, perf threshold violations)
 *  - Validation counts surfaced in snapshot (snapshot.validation.counts & perId)
 *  - Previous channel occupancy stored for delta calculations
 *  - Paused Compare Tool (capture baseline & diff vs new snapshot while paused)
 *
 * Persisted Additions:
 *  - perfThresholds: { timerOrCounterId: { avgMs?:number, lastMs?:number } }
 *
 * Existing 2.4-dx1 features retained:
 *  - Silent Mode
 *  - Snapshot build & age badges
 *  - Panel age stamps
 *  - Scenario minimal panel
 *  - Perf controls (Sample Now / Reset / Pin Top 3)
 *  - Routing cost delta flashes
 *  - Watch history depth control
 *  - Highlight toggle
 *  - Export snapshot enrichment
 *
 * Drop-in replacement for previous cb-lcars-dev-hud.js
 */

(function initHudPhase25dx1(){
  const qs = new URLSearchParams(location.search);
  const force    = (window.CBLCARS_DEV_FORCE === true);
  const disabled = (window.CBLCARS_DEV_DISABLE === true);
  const active   = !disabled && (qs.has('lcarsDev') || force);
  if (!active) return;

  /* Duplicate Instance Guard */
  try {
    if (window.__cblcarsHudInstance && !window.CBLCARS_HUD_ALLOW_MULTI) {
      console.warn('[cblcars.dev.hud] Existing HUD instance detected – skipping second attach.');
      return;
    }
    window.__cblcarsHudInstance = Date.now() + ':' + Math.random().toString(36).slice(2);
  } catch(_) {}

  const RETRY_MS = 120;
  let attempts = 0;
  function devReady(){ return !!(window.cblcars?.dev?._advanced); }
  (function retry(){
    if(!devReady()){
      if(attempts++<80) return setTimeout(retry,RETRY_MS);
      console.warn('[cblcars.dev.hud] Dev tools not ready; abort HUD attach (Phase 2.5-dx1).');
      return;
    }
    attachHud();
  })();

  function attachHud(){
    const dev = window.cblcars.dev;
    if(!dev.hud) dev.hud={_enabled:false};
    if(dev.hud._phase25dx1Attached){
      console.info('[cblcars.dev.hud] Phase 2.5-dx1 HUD already attached.');
      return;
    }

    /* Constants */
    const HUD_ID='cblcars-dev-hud-panel';
    const HUD_VERSION='2.5-dx1';
    const HUD_Z=2147480000;
    const STARTUP_WARMUP_INTERVAL_MS=300;
    const STARTUP_WARMUP_MAX_MS=20000;
    const STARTUP_DOM_OBSERVER_MAX_MS=25000;
    const ACTIVE_CARD_WAIT_MAX_MS=8000;
    const TOOLTIP_DEFAULT_DELAY=280;
    const SNAPSHOT_SCHEMA_VERSION=2;

    /* Definitions (trimmed / reused) */
    const DEFINITIONS={
      eff:{s:'Effective routing mode',l:'manhattan | grid | smart | detour'},
      gridStatus:{s:'Grid status',l:'success | fallback | skipped | manhattan | geom_pending'},
      gridReason:{s:'Reason',l:'ok / fail / clear_path / no_obstacles / no_attempt / detour / geom_pending'},
      detour:{s:'Detour used',l:'Two-elbow fallback path'},
      miss:{s:'Preferred channel miss',l:'Preferred/allow channel not hit'},
      totalCost:{s:'Total route cost',l:'distance + bends (+ future penalties)'},
      channelsHit:{s:'Channels traversed',l:'Comma-separated list of channels'},
      watch:{s:'Watch history',l:'Last N samples for route'},
      perfThreshold:{s:'Perf threshold',l:'User-set alert when exceeded'}
    };

    /* Persistence Helpers */
    function readHudState(){ return (dev.persistedState && dev.persistedState.hud)||{}; }
    function persistHudState(patch){
      try{
        if(typeof dev._persistHudState==='function') return dev._persistHudState(patch);
        const cur=readHudState();
        dev.persist({ hud:{...cur,...patch} });
      }catch(_){}
    }

    /* State Initialization */
    const persisted=readHudState();
    let dragPos = Array.isArray(persisted.position)&&persisted.position.length===2?persisted.position.slice():null;
    let collapsed=!!persisted.collapsed;
    let hudInterval=Number.isFinite(persisted.interval)&&persisted.interval>=250?persisted.interval:3000;
    let verboseFlags=!!persisted.verboseFlags;
    let selectedProfile=persisted.selectedProfile||'Custom';
    let tooltipTimeout=Number.isFinite(persisted.tooltipTimeout)?persisted.tooltipTimeout:2500;
    let paused=!!persisted.paused;
    let tooltipDelay=Number.isFinite(persisted.tooltipDelay)?Math.max(0,persisted.tooltipDelay):TOOLTIP_DEFAULT_DELAY;
    let silentMode=!!persisted.silentMode;
    let highlightEnabled=persisted.highlightEnabled!==false;
    let watchHistoryDepth=Number.isFinite(persisted.watchHistoryDepth)?Math.max(1,Math.min(30,persisted.watchHistoryDepth)):5;
    let perfThresholds = (persisted.perfThresholds && typeof persisted.perfThresholds==='object') ? {...persisted.perfThresholds}: {};

    let sectionsCollapsed={...(persisted.sectionsCollapsed||{})};
    let routingFilters={detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:false,channel:null,...(persisted.routingFilters||{})};
    let routingSort={field:'id',dir:1,...(persisted.routingSort||{})};
    let watchRoutes=Array.isArray(persisted.watchRoutes)?persisted.watchRoutes.slice():[];
    let pinnedPerf=Array.isArray(persisted.pinnedPerf)?pinnedPerfSanitize(persisted.pinnedPerf):[];

    /* Compare Tool (paused) */
    let compareBase=null;

    const panelRegistry=new Map();
    const eventHandlers=new Map();
    let lastSnapshot=null;
    let lastSnapshotBuiltAt=0;
    let lastSnapshotBuildMs=0;

    let warmupTimer=null;
    let warmupStart=0;
    let domObserver=null;
    let activeCardWaitTimer=null;
    let refreshTimer=null;
    let panelDraggable=false;
    let flashCssInjected=false;

    /* Tooltip internal */
    let tooltipEl=null,tooltipTarget=null,tooltipHideTO=null,tooltipHovering=false;
    let hudHover=false,showStartTime=0,remainingTimeout=0,tooltipShowTO=null,pendingTooltipTarget=null;

    /* Logging (silent) */
    function hudInfo(...a){ if(!silentMode) try{console.info('[hud]',...a);}catch{} }
    function hudWarn(...a){ if(!silentMode) try{console.warn('[hud]',...a);}catch{} }

    /* Utilities */
    function pinnedPerfSanitize(arr){return arr.filter(id=>typeof id==='string'&&id).slice(0,40);}
    function emit(ev,payload){const set=eventHandlers.get(ev);if(!set)return;for(const fn of set){try{fn(payload);}catch(e){hudWarn('event',ev,e);}}}
    function on(ev,fn){if(!eventHandlers.has(ev))eventHandlers.set(ev,new Set());eventHandlers.get(ev).add(fn);}
    function off(ev,fn){eventHandlers.get(ev)?.delete(fn);}

    function ensureFlashCss(){
      if(flashCssInjected)return;
      flashCssInjected=true;
      const style=document.createElement('style');
      style.textContent=`
        @keyframes hudFlash{0%{background:rgba(255,0,255,0.27);}100%{background:transparent;}}
        .hud-flash{animation:hudFlash .55s ease-out;}
        .hud-delta-pos{color:#77ff90;}
        .hud-delta-neg{color:#ff7788;}
        .hud-panel-age{font-size:9px;opacity:.55;margin-left:4px;}
        .hud-mini-strip{display:flex;gap:4px;flex-wrap:wrap;margin:4px 0 6px;}
        .hud-mini-strip-item{background:rgba(100,0,120,0.35);border:1px solid #ff00ff;padding:2px 5px;font-size:10px;border-radius:6px;}
        .hud-perf-alert{color:#ff004d;font-weight:bold;}
        .hud-issues-badge{background:#ff004d;color:#fff;padding:0 6px;border-radius:10px;font-size:10px;margin-left:4px;}
        .hud-paused-badge{background:repeating-linear-gradient(45deg,rgba(255,0,255,0.12),rgba(255,0,255,0.12) 6px,rgba(120,0,90,0.18) 6px,rgba(120,0,90,0.18) 12px);}
        .hud-table th{text-align:left;padding:2px 4px;cursor:pointer;}
        .hud-table td{padding:2px 4px;line-height:1.15;}
        .hud-route-watch{font-size:10px;background:rgba(255,0,255,0.06);border:1px solid #552266;border-radius:4px;padding:4px 6px;margin-top:6px;}
        .hud-header-metrics{font-size:10px;opacity:.8;margin-right:6px;display:flex;align-items:center;gap:6px;}
        .hud-badge-perf{background:#ff004d;color:#fff;padding:0 4px;border-radius:8px;}
        .hud-filter-preset-btn{font-size:10px;padding:2px 6px;border:1px solid #552266;border-radius:3px;background:#333;cursor:pointer;}
        .hud-filter-preset-btn[data-active="true"]{background:#ff00ff;color:#120018;}
        .hud-compare-box{background:rgba(80,0,110,0.6);border:1px solid #ff00ff;padding:6px 8px;border-radius:6px;margin-top:8px;font-size:10px;max-height:180px;overflow:auto;}
      `;
      document.head.appendChild(style);
    }

    function savePersistence(){
      persistHudState({
        position:dragPos,collapsed,interval:hudInterval,verboseFlags,selectedProfile,
        tooltipTimeout,paused,sectionsCollapsed,routingFilters,routingSort,
        watchRoutes,pinnedPerf,tooltipDelay,silentMode,highlightEnabled,
        watchHistoryDepth,perfThresholds
      });
    }

    /* Snapshot Construction */
    function safeGetRoutes(){try{return dev.dumpRoutes(undefined,{silent:true})||[];}catch{return[];}}
    function buildRoutesById(routesRaw){
      const map={};
      routesRaw.forEach(r=>{
        const id=r.id; if(!id)return;
        map[id]={
          id,
          eff:r['data-cblcars-route-effective']||'',
          grid:r['data-cblcars-route-grid-status']||'',
          reason:r['data-cblcars-route-grid-reason']||'',
          det:r['data-cblcars-route-detour']==='true',
          miss:r['data-cblcars-route-channels-miss']==='true',
          channelsHit:r['data-cblcars-route-channels-hit']||'',
          distCost:numOrNull(r['data-cblcars-route-cost-distance']),
          bendCost:numOrNull(r['data-cblcars-route-cost-bends']),
          totalCost:numOrNull(r['data-cblcars-route-cost-total']),
          bends:numOrNull(r['data-cblcars-route-cost-bends'])!=null
            ? numOrNull(r['data-cblcars-route-cost-bends']) / ((window.cblcars.routing?.inspect(id)?.cost?.bendWeight)||12)
            : undefined,
          resolution: parseResolution(r['data-cblcars-route-grid-attempts']),
          attrs:r
        };
      });
      return map;
    }
    function numOrNull(v){ if(v==null)return null; const n=parseFloat(v); return Number.isFinite(n)?n:null; }
    function parseResolution(attempts){ if(!attempts)return''; const first=attempts.split(',')[0]; return first.split(':')[0]; }
    function summarizeRoutes(routes){
      let total=0,det=0,gSucc=0,gFb=0,miss=0;
      for(const r of routes){
        total++;
        if(r['data-cblcars-route-detour']==='true') det++;
        const gs=r['data-cblcars-route-grid-status'];
        if(gs==='success') gSucc++;
        else if(gs==='fallback') gFb++;
        if(r['data-cblcars-route-channels-miss']==='true') miss++;
      }
      return {total,detours:det,gridSucc:gSucc,gridFb:gFb,miss};
    }
    function getPerfTimers(){try{return window.cblcars.debug?.perf?.get()||{};}catch{return{};}}
    function getPerfCounters(){try{return window.cblcars.perfDump?window.cblcars.perfDump(): (window.cblcars.perf?.dump?.()||{});}catch{return{};}}
    function safeGetChannels(){try{return window.cblcars?.routing?.channels?.getOccupancy?.()||{};}catch{return{};}}
    function captureValidation(){
      try{
        const root=dev._activeCard?.shadowRoot;
        if(!root) return null;
        return {
          counts: root.__cblcars_validationCounts || null,
          byId: root.__cblcars_validationById || null
        };
      }catch{ return null; }
    }
    function ensureActiveCardSync(){
      try{
        if(!dev._activeCard){
          const cards=dev.discoverMsdCards?dev.discoverMsdCards(true):[];
            if(cards.length===1) dev._activeCard=cards[0];
          else if(dev.persistedState?.activeCardIndex!=null && cards[dev.persistedState.activeCardIndex]){
            dev._activeCard=cards[dev.persistedState.activeCardIndex];
          }
        }
      }catch(_){}
    }
    function buildCoreSnapshot(){
      const t0=performance.now();
      ensureActiveCardSync();
      const routesRaw=safeGetRoutes();
      const routesById=buildRoutesById(routesRaw);
      const channels=safeGetChannels();
      const validation=captureValidation();
      const snap={
        schemaVersion:SNAPSHOT_SCHEMA_VERSION,
        timestamp:Date.now(),
        timestampIso:new Date().toISOString(),
        buildMs:0,
        routesRaw,
        routesById,
        routesSummary:summarizeRoutes(routesRaw),
        perfTimers:getPerfTimers(),
        perfCounters:getPerfCounters(),
        scenarioResults:dev._scenarioResults||[],
        channels,
        validation,
        flags:window.cblcars._debugFlags||{},
        previous:lastSnapshot?{
          routesById:lastSnapshot.routesById,
          perfTimers:lastSnapshot.perfTimers,
          perfCounters:lastSnapshot.perfCounters,
          channels:lastSnapshot.channels
        }:null
      };
      snap.buildMs=performance.now()-t0;
      lastSnapshotBuildMs=snap.buildMs;
      lastSnapshotBuiltAt=snap.timestamp;
      return snap;
    }

    /* Panel Registry */
    const INTERNAL_ORDERS={summary:100,issues:150,routing:200,channels:250,perf:300,flags:400,scenarios:450,actions:500};
    function registerPanel(meta){ if(!meta||!meta.id||panelRegistry.has(meta.id))return; panelRegistry.set(meta.id,{meta,instance:null}); }
    function findPanelWrapper(pid){
      const panel=document.getElementById(HUD_ID);
      return panel?.querySelector(`[data-panel="${pid}"]`);
    }
    function toggleSectionCollapse(pid,explicit){
      const cur=!!sectionsCollapsed[pid];
      const next=typeof explicit==='boolean'?explicit:!cur;
      sectionsCollapsed[pid]=next; savePersistence();
      const w=findPanelWrapper(pid);
      if(!w)return;
      const body=w.querySelector('[data-panel-body]');
      const caret=w.querySelector('[data-panel-caret]');
      if(body) body.style.display=next?'none':'block';
      if(caret) caret.textContent=next?'▸':'▾';
      emit('panel:toggle',{id:pid,collapsed:next});
    }
    function renderPanelsShell(){
      const panel=document.getElementById(HUD_ID);
      const container=panel?.querySelector('[data-panels]');
      if(!container)return;
      const entries=[...panelRegistry.values()].sort((a,b)=>(a.meta.order||99999)-(b.meta.order||99999));
      const activeIds=new Set(entries.map(e=>e.meta.id));
      for(const entry of entries){
        const id=entry.meta.id;
        let wrapper=container.querySelector(`[data-panel="${id}"]`);
        if(!wrapper){
          wrapper=document.createElement('div');
          wrapper.setAttribute('data-panel',id);
          wrapper.style.cssText='border:1px solid #552266;border-radius:4px;background:rgba(40,0,60,0.45);display:flex;flex-direction:column;position:relative;';
          wrapper.innerHTML=`
            <div data-panel-hdr style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:linear-gradient(90deg,#440066,#220022);cursor:pointer;font-size:11px;">
              <span data-panel-caret style="opacity:.8;">▾</span>
              <span data-panel-title style="flex:1 1 auto;"></span>
              <span data-panel-badge style="font-size:10px;opacity:.85;"></span>
              <span data-panel-age class="hud-panel-age"></span>
            </div>
            <div data-panel-body style="padding:6px 8px;display:block;"></div>`;
          container.appendChild(wrapper);
          wrapper.querySelector('[data-panel-hdr]').addEventListener('click',()=>toggleSectionCollapse(id));
        }
        wrapper.querySelector('[data-panel-title]').textContent=entry.meta.title||id;
        const coll=!!sectionsCollapsed[id];
        const body=wrapper.querySelector('[data-panel-body]');
        const caret=wrapper.querySelector('[data-panel-caret]');
        if(body) body.style.display=coll?'none':'block';
        if(caret) caret.textContent=coll?'▸':'▾';
        if(!entry.instance && !(entry.meta.lazy && coll)) instantiatePanel(entry,wrapper);
      }
      container.querySelectorAll('[data-panel]').forEach(w=>{
        if(!activeIds.has(w.getAttribute('data-panel'))) w.remove();
      });
    }
    function instantiatePanel(entry,wrapper){
      const body=wrapper.querySelector('[data-panel-body]');
      if(!body)return;
      try{
        const ctx={dev,hudApi:buildHudApi(),getCoreState:buildCoreSnapshot,persistHudState:savePersistence,flags:window.cblcars._debugFlags||{},definitions:DEFINITIONS};
        const ret=entry.meta.render(ctx);
        entry.instance={
          rootEl:ret?.rootEl||body,
          cleanup:ret?.cleanup||(()=>{}),
          refresh:ret?.refresh||(()=>{}),
          bodyRef:body,
          meta:entry.meta
        };
        if(ret?.rootEl && ret.rootEl!==body){body.innerHTML='';body.appendChild(ret.rootEl);}
        if(lastSnapshot){try{entry.instance.refresh(lastSnapshot,lastSnapshot);}catch{}}
      }catch(e){
        body.innerHTML=`<div style="color:#ff4d78;">Panel init error: ${e?.message||e}</div>`;
      }
    }
    function refreshPanels(snapshot){
      const now=Date.now();
      for(const entry of panelRegistry.values()){
        const coll=!!sectionsCollapsed[entry.meta.id];
        if(!entry.instance){
          if(!entry.meta.lazy || !coll){
            const w=findPanelWrapper(entry.meta.id);
            if(w) instantiatePanel(entry,w);
          }
        }
        if(entry.instance && !coll){
          try{entry.instance.refresh(snapshot,lastSnapshot);}catch(e){
            if(entry.instance.bodyRef && !entry.instance.bodyRef.querySelector('.hud-panel-error')){
              const err=document.createElement('div');
              err.className='hud-panel-error';
              err.style.cssText='color:#ff4d78;font-size:10px;margin-top:4px;cursor:pointer;';
              err.textContent='Panel refresh error (click to retry)';
              err.addEventListener('click',()=>{try{entry.instance.refresh(snapshot,lastSnapshot);err.remove();}catch{}});
              entry.instance.bodyRef.appendChild(err);
            }
          }finally{
            const w=findPanelWrapper(entry.meta.id);
            if(w){
              w.setAttribute('data-last-refresh-ts',String(now));
              const ageSpan=w.querySelector('[data-panel-age]');
              if(ageSpan) ageSpan.textContent='t+0.0s';
            }
          }
        }
      }
      updatePanelBadges(snapshot);
    }
    function updatePanelBadges(snapshot){
      for(const entry of panelRegistry.values()){
        const wrap=findPanelWrapper(entry.meta.id);
        if(!wrap)continue;
        const badge=wrap.querySelector('[data-panel-badge]');
        if(!badge)continue;
        let val='';
        if(typeof entry.meta.badge==='function'){
          try{val=entry.meta.badge(snapshot)??'';}catch{}
        }
        badge.textContent=val;
      }
    }
    function updatePanelAges(){
      const panel=document.getElementById(HUD_ID);
      if(!panel)return;
      const now=Date.now();
      panel.querySelectorAll('[data-panel]').forEach(w=>{
        const ts=parseInt(w.getAttribute('data-last-refresh-ts')||'0',10);
        if(ts){
          const age=((now-ts)/1000).toFixed(1)+'s';
          const ageSpan=w.querySelector('[data-panel-age]');
          if(ageSpan) ageSpan.textContent='t+'+age;
        }
      });
    }

    /* Tooltip (pinless) */
    function initTooltipEngine(panel){
      tooltipEl=panel.querySelector('#cblcars-hud-tooltip');
      if(!tooltipEl) return;
      const root=panel;
      function esc(s){return String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));}
      function positionTip(target){
        const r=target.getBoundingClientRect();
        const tw=tooltipEl.offsetWidth, th=tooltipEl.offsetHeight;
        let x=r.left+(r.width/2)-(tw/2);
        let y=r.top-th-8;
        if(x<6)x=6;
        if(y<6)y=r.bottom+8;
        if(x+tw>window.innerWidth-6)x=window.innerWidth-tw-6;
        tooltipEl.style.left=x+'px';
        tooltipEl.style.top=y+'px';
      }
      function scheduleHide(ms){
        clearTimeout(tooltipHideTO);
        if(ms<=0){ hideTip();return;}
        tooltipHideTO=setTimeout(()=>{ if(!tooltipHovering) hideTip(); },ms);
      }
      function doShow(target){
        clearTimeout(tooltipHideTO);
        tooltipTarget=target;
        const short=target.getAttribute('data-tip');
        const detail=target.getAttribute('data-tip-detail');
        if(!short && !detail) return;
        let html=`<div style="font-weight:bold;margin-bottom:2px;">${esc(short||'Info')}</div>`;
        if(detail) html+=`<div style="font-size:11px;opacity:.85;">${esc(detail)}</div>`;
        tooltipEl.innerHTML=html;
        tooltipEl.style.display='block';
        positionTip(target);
        showStartTime=performance.now();
        remainingTimeout=tooltipTimeout;
        if(tooltipTimeout>0) scheduleHide(tooltipTimeout);
      }
      function showTip(target){
        clearTimeout(tooltipShowTO);
        pendingTooltipTarget=target;
        tooltipShowTO=setTimeout(()=>{
          if(pendingTooltipTarget===target) doShow(target);
        },tooltipDelay);
      }
      function hideTip(){
        clearTimeout(tooltipShowTO);
        tooltipEl.style.display='none';
        tooltipTarget=null;
        pendingTooltipTarget=null;
      }
      function pointerLeftContext(){
        if(tooltipTimeout===0){ hideTip(); return; }
        scheduleHide(Math.max(120,remainingTimeout));
      }
      root.addEventListener('pointerenter',e=>{ if(root.contains(e.target)) hudHover=true; });
      root.addEventListener('pointerleave',()=>{ hudHover=false; if(!tooltipHovering) pointerLeftContext(); });
      root.addEventListener('pointerover',e=>{
        const t=e.target.closest('[data-tip]');
        if(!t)return;
        tooltipHovering=false;
        showTip(t);
      });
      root.addEventListener('pointerout',e=>{
        if(e.target===pendingTooltipTarget){
          clearTimeout(tooltipShowTO); pendingTooltipTarget=null;
        }
        if(!hudHover && !tooltipHovering) pointerLeftContext();
      });
      tooltipEl.addEventListener('pointerenter',()=>{
        tooltipHovering=true;
        if(tooltipTimeout>0){
          const elapsed=performance.now()-showStartTime;
          remainingTimeout=Math.max(50,tooltipTimeout-elapsed);
          clearTimeout(tooltipHideTO);
        }
      });
      tooltipEl.addEventListener('pointerleave',()=>{
        tooltipHovering=false;
        pointerLeftContext();
      });
      document.addEventListener('pointerdown',e=>{
        if(tooltipEl.style.display==='none')return;
        if(!root.contains(e.target) && !tooltipEl.contains(e.target)) hideTip();
      });
      window.addEventListener('keydown',e=>{
        if(e.key==='Escape') hideTip();
      },true);
      window.addEventListener('scroll',()=>{
        if(tooltipEl.style.display==='block'){
          if(tooltipTarget) positionTip(tooltipTarget);
          else if(!tooltipHovering) hideTip();
        }
      },true);
    }

    /* Quick Flags / Profiles */
    const QUICK_FLAG_KEYS=['overlay','connectors','perf','geometry','channels'];
    const FLAG_PROFILES={
      'Minimal':{overlay:false,connectors:false,perf:false,geometry:false,channels:false},
      'Routing':{overlay:true,connectors:true,perf:false,geometry:false,channels:true},
      'Perf':{overlay:false,connectors:false,perf:true,geometry:false,channels:false},
      'Full':{overlay:true,connectors:true,perf:true,geometry:true,channels:true}
    };
    function renderQuickFlags(panel,force){
      const c=panel.querySelector('[data-quick-flags]');
      if(!c)return;
      if(force)c.innerHTML='';
      const current=window.cblcars._debugFlags||{};
      QUICK_FLAG_KEYS.forEach(k=>{
        let btn=c.querySelector(`[data-flag-btn="${k}"]`);
            if(!btn){
          btn=document.createElement('button');
          btn.setAttribute('data-flag-btn',k);
          btn.setAttribute('data-tip',k);
          btn.setAttribute('data-tip-detail',DEFINITIONS[k]?.l||`Toggle ${k}`);
          btn.style.cssText='font-size:10px;padding:2px 6px;cursor:pointer;border:1px solid #552266;border-radius:3px;';
          btn.addEventListener('click',()=>{
            const nf=!(window.cblcars._debugFlags||{})[k];
            dev.flags({[k]:nf});
            persistHudState({flags:window.cblcars._debugFlags});
            styleFlagBtn(btn,k,nf);
            emit('flags:changed',window.cblcars._debugFlags);
          });
          c.appendChild(btn);
        }
        styleFlagBtn(btn,k,current[k]);
      });
    }
    function styleFlagBtn(btn,key,on){
      btn.textContent=verboseFlags?key:key[0].toUpperCase();
      btn.style.background=on?'#ff00ff':'#333';
      btn.style.color=on?'#120018':'#ffd5ff';
    }
    function showProfilesMenu(panel){
      let existing=panel.querySelector('#hud-profiles-menu');
      if(existing){existing.remove();return;}
      const menu=document.createElement('div');
      menu.id='hud-profiles-menu';
      Object.assign(menu.style,{
        position:'absolute',right:'6px',top:'42px',background:'rgba(50,0,70,0.95)',
        border:'1px solid #ff00ff',padding:'6px 8px',borderRadius:'6px',
        zIndex:HUD_Z+2,font:'11px/1.35 monospace',minWidth:'160px'
      });
      menu.innerHTML=`<div style="font-weight:bold;margin-bottom:4px;">Flag Profiles</div>
        ${Object.keys(FLAG_PROFILES).map(p=>`<div data-prof="${p}" style="padding:2px 4px;cursor:pointer;${p===selectedProfile?'background:#ff00ff;color:#120018;':''}">${p}</div>`).join('')}
        <div data-prof="Custom" style="padding:2px 4px;cursor:pointer;${selectedProfile==='Custom'?'background:#ff00ff;color:#120018;':''}">Custom</div>
        <div style="margin-top:6px;font-size:10px;opacity:.65;">Click to apply (Custom = current state)</div>`;
      panel.appendChild(menu);
      menu.addEventListener('click',e=>{
        const p=e.target.getAttribute('data-prof');
        if(!p)return;
        if(p!=='Custom'){
          dev.flags(FLAG_PROFILES[p]);
          selectedProfile=p;
          persistHudState({selectedProfile:p,flags:window.cblcars._debugFlags});
          emit('flags:changed',window.cblcars._debugFlags);
        }else selectedProfile='Custom';
        persistHudState({selectedProfile});
        menu.remove();
        renderQuickFlags(panel,true);
      });
      document.addEventListener('pointerdown',function once(ev){
        if(!menu.contains(ev.target)){try{menu.remove();}catch{}document.removeEventListener('pointerdown',once,true);}
      },true);
    }

    /* SUMMARY PANEL */
    registerPanel({
      id:'summary',
      title:'Summary',
      order:INTERNAL_ORDERS.summary,
      badge:snap=>snap.routesSummary.total||'',
      render(){
        const root=document.createElement('div');
        root.style.fontSize='11px';
        root.innerHTML=`
          <div data-summary-top>
            <div data-mini-strip class="hud-mini-strip" style="display:none;"></div>
            <div data-routes-line></div>
            <div data-scenarios-line style="margin-top:6px;"></div>
            <div data-channels-line style="margin-top:6px;"></div>
            <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
              <button data-legend-btn class="hud-btn-icon" data-tip="Legend" data-tip-detail="Definitions & metric explanations.">ℹ</button>
              <button data-refresh-now class="hud-btn-icon" data-tip="Refresh Now">↻</button>
              <button data-compare-btn class="hud-btn-icon" data-tip="Compare Tool" data-tip-detail="Capture baseline snapshot while paused and diff against new snapshot.">Cmp</button>
              <span data-paused-badge style="display:none;color:#ff99ff;font-weight:bold;font-size:10px;">PAUSED</span>
              <span data-build-meta style="font-size:10px;opacity:.65;"></span>
              <span data-perf-alert style="font-size:10px;"></span>
            </div>
            <div data-compare-box style="display:none;"></div>
          </div>`;
        root.querySelector('[data-legend-btn]').addEventListener('click',()=>toggleLegendOverlay());
        root.querySelector('[data-refresh-now]').addEventListener('click',()=>refresh(true,true));
        root.querySelector('[data-compare-btn]').addEventListener('click',()=>handleCompareClick());

        function toggleLegendOverlay(){
          const panel=document.getElementById(HUD_ID); if(!panel)return;
          let ex=panel.querySelector('#hud-legend-overlay');
          if(ex){ex.remove();return;}
          const overlay=document.createElement('div');
          overlay.id='hud-legend-overlay';
          Object.assign(overlay.style,{
            position:'absolute',left:'6px',top:'36px',right:'6px',maxHeight:'52vh',
            overflowY:'auto',background:'rgba(35,0,55,0.95)',border:'1px solid #ff00ff',
            borderRadius:'6px',padding:'10px 12px',fontSize:'11px',zIndex:HUD_Z+3
          });
          overlay.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;">
            <strong>HUD Legend / Definitions</strong>
            <button style="font-size:11px;" data-close>✕</button>
          </div>
          <div style="margin-top:6px;">
            ${Object.entries(DEFINITIONS).map(([k,v])=>`<div style="margin-bottom:8px;">
              <div style="font-weight:bold;">${k}</div>
              <div style="opacity:.8;">${v.l}</div>
            </div>`).join('')}
          </div>`;
          overlay.querySelector('[data-close]').addEventListener('click',()=>overlay.remove());
          panel.appendChild(overlay);
        }

        function handleCompareClick(){
          if(!paused){
            alert('Pause HUD first to use compare tool.');
            return;
          }
          if(!compareBase){
            compareBase=lastSnapshot;
            if(!compareBase){
              alert('No snapshot to capture.');
              return;
            }
            const box=root.querySelector('[data-compare-box]');
            box.style.display='block';
            box.innerHTML='<div class="hud-compare-box">Baseline captured. Make changes, refresh (↻), then click Cmp again to diff.</div>';
          } else {
            const cur=buildCoreSnapshot();
            const diffHtml=diffSnapshots(compareBase,cur);
            const box=root.querySelector('[data-compare-box]');
            box.style.display='block';
            box.innerHTML=diffHtml;
            compareBase=null;
          }
        }

        function diffSnapshots(a,b){
          if(!a||!b) return '<div class="hud-compare-box">(no diff)</div>';
          const changed=[];
            const aRoutes=a.routesById||{}, bRoutes=b.routesById||{};
          const seen=new Set([...Object.keys(aRoutes),...Object.keys(bRoutes)]);
          for(const id of seen){
            const ar=aRoutes[id], br=bRoutes[id];
            if(!ar||!br) continue;
            if(ar.totalCost!=br.totalCost){
              const prev=ar.totalCost, cur=br.totalCost;
              if(prev!=null && cur!=null && prev!==0){
                const pct=((cur-prev)/prev)*100;
                changed.push({id,prev,cur,pct});
              }
            }
          }
          if(!changed.length) return '<div class="hud-compare-box">No route cost changes.</div>';
          changed.sort((x,y)=>Math.abs(y.pct)-Math.abs(x.pct));
          return `<div class="hud-compare-box">
            <div style="font-weight:bold;margin-bottom:4px;">Route Cost Changes</div>
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead><tr><th>ID</th><th>Prev</th><th>Cur</th><th>Δ%</th></tr></thead>
              <tbody>${changed.map(c=>`<tr>
                <td>${c.id}</td><td>${fmtNum(c.prev)}</td><td>${fmtNum(c.cur)}</td>
                <td style="color:${c.pct>0?'#ff6688':'#77ff90'};">${c.pct>0?'+':''}${c.pct.toFixed(2)}%</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>`;
        }

        function updatePinned(stripSnap){
          const strip=root.querySelector('[data-mini-strip]');
          if(!pinnedPerf.length){strip.style.display='none';strip.innerHTML='';return;}
          strip.style.display='flex';
          const t=stripSnap.perfTimers||{}, c=stripSnap.perfCounters||{};
          strip.innerHTML=pinnedPerf.map(id=>{
            if(t[id]){
              const last=t[id].lastMs.toFixed(2);
              return `<div class="hud-mini-strip-item" data-tip="${id}" data-tip-detail="Timer: last=${last}ms avg=${t[id].avgMs.toFixed(2)}ms max=${t[id].maxMs.toFixed(1)} count=${t[id].count}">${id}:${last}ms</div>`;
            }
            if(c[id]){
              return `<div class="hud-mini-strip-item" data-tip="${id}" data-tip-detail="Counter: count=${c[id].count} avg=${c[id].avgMs?.toFixed?.(2)||'n/a'}ms">${id}:${c[id].count}</div>`;
            }
            return `<div class="hud-mini-strip-item">${id}:n/a</div>`;
          }).join('');
        }

        return {
          rootEl:root,
          refresh(snapshot){
            const rs=snapshot.routesSummary;
            const rl=root.querySelector('[data-routes-line]');
            rl.innerHTML=`<div style="font-weight:bold;margin-bottom:2px;">Routes</div>
              <div>
                Total <a href="#" data-filter="reset">${rs.total}</a> |
                Detours <a href="#" data-filter="detour">${rs.detours}</a> |
                Grid OK <a href="#" data-filter="gridSuccess">${rs.gridSucc}</a> |
                FB <a href="#" data-filter="fallback">${rs.gridFb}</a> |
                Miss <a href="#" data-filter="miss">${rs.miss}</a>
              </div>`;
            rl.querySelectorAll('a[data-filter]').forEach(a=>{
              a.style.color='#ffccff';a.style.textDecoration='none';
              a.addEventListener('click',e=>{
                e.preventDefault();
                const f=a.getAttribute('data-filter');
                if(f==='reset'){
                  routingFilters={detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:false,channel:null};
                }else routingFilters[f]=true;
                savePersistence(); emit('routing:filtersChanged',routingFilters);
                refresh(true,true);
              },{once:true});
            });

            const sc=root.querySelector('[data-scenarios-line]');
            const res=snapshot.scenarioResults||[];
            if(res.length){
              const pass=res.filter(r=>r.ok).length;
              sc.innerHTML=`<div style="font-weight:bold;margin-bottom:2px;">Scenarios</div><div>${pass}/${res.length} passed</div>`;
            }else{
              sc.innerHTML=`<div style="font-weight:bold;margin-bottom:2px;">Scenarios</div><div style="opacity:.6;">(none)</div>`;
            }

            const chEl=root.querySelector('[data-channels-line]');
            const ch=snapshot.channels||{};
            const top=Object.entries(ch).sort((a,b)=>b[1]-a[1]).slice(0,4);
            chEl.innerHTML= top.length
              ? `<div style="font-weight:bold;margin-bottom:2px;">Channels</div>
                 ${top.map(([id,v])=>`<div style="display:flex;justify-content:space-between;"><span>${id}</span><span>${v}</span></div>`).join('')}`
              : `<div style="font-weight:bold;margin-bottom:2px;">Channels</div><div style="opacity:.6;">(none)</div>`;

            updatePinned(snapshot);

            const pb=root.querySelector('[data-paused-badge]');
            pb.style.display=paused?'inline-block':'none';
            const bm=root.querySelector('[data-build-meta]');
            if(bm) bm.textContent=`build ${snapshot.buildMs.toFixed(1)}ms`;
            const perfAlert=root.querySelector('[data-perf-alert]');
            const violCount=countPerfViolations(snapshot);
            perfAlert.innerHTML=violCount?`<span class="hud-badge-perf" data-tip="Perf Alerts" data-tip-detail="${violCount} thresholds exceeded">PERF! ${violCount}</span>`:'';
          }
        };
      }
    });

    /* ISSUES PANEL */
    registerPanel({
      id:'issues',
      title:'Issues',
      order:INTERNAL_ORDERS.issues,
      badge:snap=>{
        const viol=countPerfViolations(snap);
        const scenFails=(snap.scenarioResults||[]).filter(r=>!r.ok).length;
        const gridFallback=Object.values(snap.routesById||{}).filter(r=>r.grid==='fallback').length;
        const detours=Object.values(snap.routesById||{}).filter(r=>r.det).length;
        const misses=Object.values(snap.routesById||{}).filter(r=>r.miss).length;
        const sum=viol+scenFails+gridFallback+detours+misses;
        return sum?String(sum):'';
      },
      render(){
        const root=document.createElement('div');
        root.style.fontSize='10px';
        root.innerHTML=`<div data-issues-wrap style="max-height:220px;overflow:auto;"></div>`;
        const wrap=root.querySelector('[data-issues-wrap]');
        function refresh(snapshot){
          const list=[];
          const routes=Object.values(snapshot.routesById||{});
          const scen=(snapshot.scenarioResults||[]).filter(r=>!r.ok);
          scen.forEach(r=>list.push({type:'Scenario',id:r.scenario,detail:r.details||r.error||'fail'}));
          routes.filter(r=>r.det).forEach(r=>list.push({type:'Detour',id:r.id,detail:'detour used'}));
          routes.filter(r=>r.grid==='fallback').forEach(r=>list.push({type:'Fallback',id:r.id,detail:r.reason||''}));
          routes.filter(r=>r.miss).forEach(r=>list.push({type:'ChannelMiss',id:r.id,detail:'preferred miss'}));
          const viols=collectPerfViolations(snapshot);
          viols.forEach(v=>list.push({type:'Perf',id:v.id,detail:v.detail}));
          const validationCounts=snapshot.validation?.counts;
          if(validationCounts && (validationCounts.errors||validationCounts.warnings)){
            list.push({type:'Validation',id:'counts',detail:`E:${validationCounts.errors||0} W:${validationCounts.warnings||0}`});
          }
          if(!list.length){
            wrap.innerHTML='<div style="opacity:.6;">(no issues)</div>';
            return;
          }
          wrap.innerHTML=`<table style="width:100%;border-collapse:collapse;">
            <thead><tr><th style="text-align:left;">Type</th><th style="text-align:left;">ID</th><th style="text-align:left;">Detail</th></tr></thead>
            <tbody>${list.map(i=>`<tr>
              <td>${i.type}</td><td>${i.id}</td><td>${i.detail}</td>
            </tr>`).join('')}</tbody>
          </table>`;
        }
        return {rootEl:root,refresh};
      }
    });

    /* ROUTING PANEL */
    registerPanel({
      id:'routing',
      title:'Routing Detail',
      order:INTERNAL_ORDERS.routing,
      badge:snap=>snap.routesSummary.total||'',
      render(){
        const root=document.createElement('div');
        root.style.fontSize='10px';
        root.innerHTML=`
          <div data-routing-toolbar style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;align-items:center;">
            <div data-filter-presets style="display:flex;gap:4px;flex-wrap:wrap;">
              <button class="hud-filter-preset-btn" data-preset="all">All</button>
              <button class="hud-filter-preset-btn" data-preset="problems">Problems</button>
              <button class="hud-filter-preset-btn" data-preset="success">Success</button>
              <button class="hud-filter-preset-btn" data-preset="detours">Detours</button>
              <button class="hud-filter-preset-btn" data-preset="fallback">Fallback</button>
              <button class="hud-filter-preset-btn" data-preset="miss">Miss</button>
              <button class="hud-filter-preset-btn" data-preset="gridok">GridOK</button>
            </div>
            <label><input type="checkbox" data-filter-det>Detours</label>
            <label><input type="checkbox" data-filter-fb>Fallback</label>
            <label><input type="checkbox" data-filter-miss>Miss</label>
            <label><input type="checkbox" data-filter-smart>Smart Hit</label>
            <label><input type="checkbox" data-filter-gridok>Grid Success</label>
            <select data-filter-channel style="font-size:10px;max-width:130px;">
              <option value="">(Channel)</option>
            </select>
            <label style="margin-left:4px;">History
              <input data-watch-depth type="number" min="1" max="30" value="${watchHistoryDepth}" style="width:46px;font-size:10px;">
            </label>
            <button data-clear-filters style="font-size:10px;">Clear</button>
            <button data-refresh style="font-size:10px;">↻</button>
            <button data-toggle-highlight style="font-size:10px;" data-tip="Toggle Hover Highlight">${highlightEnabled?'Hi✓':'Hi✕'}</button>
          </div>
          <div style="overflow:auto;max-height:300px;">
            <table data-routing-table class="hud-table" style="border-collapse:collapse;width:100%;">
              <thead>
                <tr>
                  <th data-sort="id" data-tip="ID">ID</th>
                  <th data-sort="eff" data-tip="Eff" data-tip-detail="${DEFINITIONS.eff.l}">Eff</th>
                  <th data-sort="grid" data-tip="Grid" data-tip-detail="${DEFINITIONS.gridStatus.l}">Grid</th>
                  <th data-sort="reason" data-tip="Reason" data-tip-detail="${DEFINITIONS.gridReason.l}">Reason</th>
                  <th data-sort="det" data-tip="Det" data-tip-detail="${DEFINITIONS.detour.l}">Det</th>
                  <th data-sort="miss" data-tip="Miss" data-tip-detail="${DEFINITIONS.miss.l}">Miss</th>
                  <th data-sort="channelsHit" data-tip="Ch" data-tip-detail="${DEFINITIONS.channelsHit.l}">Ch</th>
                  <th data-sort="distCost" data-tip="Dist" data-tip-detail="Distance cost">Dist</th>
                  <th data-sort="bends" data-tip="Bends" data-tip-detail="Bends">Bends</th>
                  <th data-sort="bendCost" data-tip="bCost" data-tip-detail="Bend cost">bCost</th>
                  <th data-sort="totalCost" data-tip="Total" data-tip-detail="${DEFINITIONS.totalCost.l}">Total (Δ)</th>
                  <th data-sort="resolution" data-tip="Res" data-tip-detail="Winning resolution">Res</th>
                  <th data-sort="watch" data-tip="Watch" data-tip-detail="${DEFINITIONS.watch.l}">👁</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
          <div data-routing-empty style="display:none;opacity:.6;margin-top:4px;">(no routes)</div>
          <div data-watch-panel style="margin-top:10px;"></div>`;
        const tbody=root.querySelector('tbody');
        const watchPanel=root.querySelector('[data-watch-panel]');
        let rowNodes=new Map();
        let expandedRows=new Set();
        const watchHistory={};
        const highlightRootProvider=()=>dev._activeCard?.shadowRoot||null;
        let hoverHiTO=null;

        root.querySelector('[data-watch-depth]').addEventListener('change',e=>{
          const v=parseInt(e.target.value,10);
          if(Number.isFinite(v)&&v>0){
            watchHistoryDepth=Math.min(30,Math.max(1,v));
            savePersistence();
            Object.keys(watchHistory).forEach(id=>{
              if(watchHistory[id].length>watchHistoryDepth){
                watchHistory[id].splice(0,watchHistory[id].length-watchHistoryDepth);
              }
            });
            renderWatchPanel(lastSnapshot||buildCoreSnapshot());
          }
        });
        root.querySelector('[data-toggle-highlight]').addEventListener('click',e=>{
          highlightEnabled=!highlightEnabled;
          e.target.textContent=highlightEnabled?'Hi✓':'Hi✕';
          savePersistence();
        });

        /* Presets */
        root.querySelectorAll('[data-preset]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const preset=btn.getAttribute('data-preset');
            applyPreset(preset);
            root.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('data-active','false'));
            btn.setAttribute('data-active','true');
            refresh(buildCoreSnapshot());
          });
        });
        function applyPreset(p){
          switch(p){
            case 'all':
              routingFilters={detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:false,channel:null};
              break;
            case 'problems':
              routingFilters={detour:true,fallback:true,miss:true,smartHit:false,gridSuccess:false,channel:null};
              break;
            case 'success':
              routingFilters={detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:true,channel:null};
              break;
            case 'detours':
              routingFilters={detour:true,fallback:false,miss:false,smartHit:false,gridSuccess:false,channel:null};
              break;
            case 'fallback':
              routingFilters={detour:false,fallback:true,miss:false,smartHit:false,gridSuccess:false,channel:null};
              break;
            case 'miss':
              routingFilters={detour:false,fallback:false,miss:true,smartHit:false,gridSuccess:false,channel:null};
              break;
            case 'gridok':
              routingFilters={detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:true,channel:null};
              break;
            default:break;
          }
          savePersistence();
        }

        function refresh(snapshot){
          refreshChannelFilter(snapshot);
          syncFiltersFromState(root);
          const rows=filterAndSort(Object.values(snapshot.routesById||{}));
          patchTable(rows,snapshot);
          updateEmpty(rows);
          renderWatchPanel(snapshot);
          if(tbody) tbody.setAttribute('data-snapshot-ts', String(snapshot.timestamp));
        }
        function filterAndSort(rows){
          return rows.filter(r=>{
            if(routingFilters.detour && !r.det) return false;
            if(routingFilters.fallback && r.grid!=='fallback') return false;
            if(routingFilters.miss && !r.miss) return false;
            if(routingFilters.smartHit && r.attrs['data-cblcars-smart-hit']!=='true') return false;
            if(routingFilters.gridSuccess && r.grid!=='success') return false;
            if(routingFilters.channel){
              if(!(r.channelsHit||'').split(',').includes(routingFilters.channel)) return false;
            }
            return true;
          }).sort((a,b)=>{
            const f=routingSort.field, dir=routingSort.dir;
            const av=a[f], bv=b[f];
            if(av==null && bv!=null) return -1*dir;
            if(bv==null && av!=null) return 1*dir;
            if(av===bv) return 0;
            return (av>bv?1:-1)*dir;
          });
        }
        function patchTable(rows,snapshot){
          const keep=new Set(rows.map(r=>r.id));
          for(const [id,tr] of rowNodes.entries()){
            if(!keep.has(id)){
              tr.remove(); rowNodes.delete(id); expandedRows.delete(id);
            }
          }
          rows.forEach(r=>{
            let tr=rowNodes.get(r.id);
            if(!tr){
              tr=document.createElement('tr');
              tr.setAttribute('data-id',r.id);
              tr.innerHTML=`
                <td data-col="id"></td>
                <td data-col="eff"></td>
                <td data-col="grid"></td>
                <td data-col="reason"></td>
                <td data-col="det"></td>
                <td data-col="miss"></td>
                <td data-col="channelsHit" style="max-width:110px;overflow:hidden;text-overflow:ellipsis;"></td>
                <td data-col="distCost"></td>
                <td data-col="bends"></td>
                <td data-col="bendCost"></td>
                <td data-col="totalCost"></td>
                <td data-col="resolution"></td>
                <td data-col="watch" style="text-align:center;"></td>`;
              tr.addEventListener('click',e=>{
                if(e.target.closest('button'))return;
                toggleExpand(r.id,snapshot);
              });
              tr.addEventListener('mouseenter',()=>{
                if(!highlightEnabled)return;
                clearTimeout(hoverHiTO);
                if(window.cblcars?.msd?.highlight){
                  hoverHiTO=setTimeout(()=>{
                    try{window.cblcars.msd.highlight(r.id,{duration:900,root:highlightRootProvider()});}catch{}
                  },60);
                }
              });
              tr.addEventListener('mouseleave',()=>{clearTimeout(hoverHiTO);});
              tbody.appendChild(tr);
              rowNodes.set(r.id,tr);
            }
            updateCell(tr,'id',r.id);
            updateCell(tr,'eff',r.eff,'eff');
            updateCell(tr,'grid',r.grid,'gridStatus');
            updateCell(tr,'reason',r.reason,'gridReason');
            updateCell(tr,'det',r.det?'Y':'','detour');
            updateCell(tr,'miss',r.miss?'Y':'','miss');
            updateCell(tr,'channelsHit',r.channelsHit,'channelsHit');
            updateCell(tr,'distCost',fmtNum(r.distCost));
            updateCell(tr,'bends',fmtNum(r.bends));
            updateCell(tr,'bendCost',fmtNum(r.bendCost));
            updateCostCellWithDelta(tr,r,snapshot);
            updateCell(tr,'resolution',r.resolution||'');
            const wCell=tr.querySelector('[data-col="watch"]');
            if(wCell && !wCell.querySelector('button')){
              const btn=document.createElement('button');
              btn.style.cssText='font-size:10px;padding:0 4px;';
              btn.textContent=watchRoutes.includes(r.id)?'−':'+';
              btn.setAttribute('data-tip','Watch');
              btn.setAttribute('data-tip-detail','Add/remove watch list.');
              btn.addEventListener('click',e=>{
                e.stopPropagation();
                if(watchRoutes.includes(r.id)) watchRoutes=watchRoutes.filter(x=>x!==r.id);
                else watchRoutes.push(r.id);
                savePersistence();
                emit('routing:watchChanged',watchRoutes.slice());
                btn.textContent=watchRoutes.includes(r.id)?'−':'+';
                renderWatchPanel(snapshot);
              });
              wCell.appendChild(btn);
            } else if(wCell){
              const btn=wCell.querySelector('button');
              if(btn) btn.textContent=watchRoutes.includes(r.id)?'−':'+';
            }
            ensureExpansionRow(r.id,r,snapshot);
          });
        }
        function updateCell(tr,col,val,defKey){
          const td=tr.querySelector(`[data-col="${col}"]`);
          if(!td)return;
          const old=td.__v;
          const display=val==null?'':val;
          td.textContent=display;
          td.__v=display;
          td.setAttribute('data-tip',col);
          td.setAttribute('data-tip-detail',DEFINITIONS[defKey]?.l||display);
          if(old!==undefined && old!==display){
            td.classList.remove('hud-flash'); void td.offsetWidth; td.classList.add('hud-flash');
          }
        }
        function updateCostCellWithDelta(tr,r,snapshot){
          const td=tr.querySelector('[data-col="totalCost"]');
          if(!td)return;
          const prev=snapshot.previous?.routesById?.[r.id]?.totalCost;
          let content=fmtNum(r.totalCost);
          td.setAttribute('data-tip','totalCost');
          td.setAttribute('data-tip-detail',DEFINITIONS.totalCost.l);
          td.classList.remove('hud-delta-pos','hud-delta-neg');
          if(prev!=null && r.totalCost!=null && prev!==0){
            const deltaPct=((r.totalCost-prev)/prev)*100;
            const pctStr=(deltaPct>0?'+':'')+deltaPct.toFixed(1)+'%';
            content+= ` ${deltaPct>0?'<span class="hud-delta-neg">('+pctStr+')</span>':'<span class="hud-delta-pos">('+pctStr+')</span>'}`;
            if(deltaPct>0) td.classList.add('hud-delta-neg'); else if(deltaPct<0) td.classList.add('hud-delta-pos');
          }
          const oldHtml=td.innerHTML;
          td.innerHTML=content;
          if(oldHtml && oldHtml!==content){
            td.classList.remove('hud-flash'); void td.offsetWidth; td.classList.add('hud-flash');
          }
        }
        function ensureExpansionRow(id,rowData,snapshot){
          const tr=rowNodes.get(id); if(!tr)return;
          let next=tr.nextElementSibling;
          const expanded=expandedRows.has(id);
          if(expanded){
            if(!next||next.getAttribute('data-expansion-for')!==id){
              next=document.createElement('tr');
              next.setAttribute('data-expansion-for',id);
              const td=document.createElement('td');
              td.colSpan=13;
              td.style.cssText='background:rgba(70,0,90,0.35);font-size:10px;padding:4px 6px;';
              next.appendChild(td);
              tr.parentNode.insertBefore(next,tr.nextElementSibling);
            }
            next.firstElementChild.innerHTML=buildExpansionHtml(rowData);
          }else if(next && next.getAttribute('data-expansion-for')===id){
            next.remove();
          }
        }
        function buildExpansionHtml(r){
          const a=r.attrs||{};
          function line(label,v){return `<div style="display:flex;gap:6px;"><div style="width:110px;opacity:.7;">${label}</div><div style="flex:1;">${v||'<span style="opacity:.4;">—</span>'}</div></div>`;}
          const attemptsRaw = a['data-cblcars-route-grid-attempts']||'';
          let attemptsTable='';
          if(attemptsRaw){
            const rows=attemptsRaw.split(',').map(s=>s.trim()).filter(Boolean).map(pair=>{
              const [res,status]=pair.split(':'); return {res,status};
            });
            if(rows.length){
              attemptsTable=`<table style="border-collapse:collapse;font-size:9px;margin-top:4px;">
                <thead><tr><th style="text-align:left;padding:2px 4px;">Res</th><th style="text-align:left;padding:2px 4px;">Status</th></tr></thead>
                <tbody>${rows.map(rw=>`<tr><td style="padding:2px 4px;">${rw.res}</td><td style="padding:2px 4px;">${rw.status}</td></tr>`).join('')}</tbody>
              </table>`;
            }
          }
          return `
            <div style="margin-bottom:4px;font-weight:bold;">Route: ${r.id}</div>
            ${line('Attempts',a['data-cblcars-route-grid-attempts']||'')}
            ${attemptsTable}
            ${line('Smart Hit',a['data-cblcars-smart-hit']||'')}
            ${line('Smart Mode',a['data-cblcars-smart-hit-mode']||'')}
            ${line('Smart Skip',a['data-cblcars-smart-skip-reason']||'')}
            ${line('Channel Mode',a['data-cblcars-route-channel-mode']||'')}
            ${line('Channel Pref',a['data-cblcars-route-channels']||'')}
            ${line('Channels Hit',a['data-cblcars-route-channels-hit']||'')}
            ${line('Detour Cost',a['data-cblcars-route-detour-cost']||'')}
            <div style="margin-top:4px;">
              <details><summary style="cursor:pointer;">All Attributes</summary>
                <div style="max-height:140px;overflow:auto;margin-top:4px;font-family:monospace;white-space:pre-wrap;">
                  ${Object.keys(a).sort().map(k=>`${k}=${a[k]}`).join('\n')}
                </div>
              </details>
            </div>`;
        }
        function toggleExpand(id,snapshot){
          if(expandedRows.has(id)) expandedRows.delete(id);
          else expandedRows.add(id);
          const data=(snapshot.routesById||{})[id];
          if(data) ensureExpansionRow(id,data,snapshot);
        }
        function updateEmpty(rows){
          root.querySelector('[data-routing-empty]').style.display=rows.length?'none':'block';
        }
        function recordWatch(snapshot){
          watchRoutes.forEach(id=>{
            const r=snapshot.routesById[id];
            if(!r)return;
            if(!watchHistory[id]) watchHistory[id]=[];
            const entry={
              t:snapshot.timestamp,eff:r.eff,grid:r.grid,reason:r.reason,
              det:r.det,miss:r.miss,totalCost:r.totalCost,distCost:r.distCost,bendCost:r.bendCost
            };
            watchHistory[id].push(entry);
            if(watchHistory[id].length>watchHistoryDepth) watchHistory[id].shift();
          });
        }
        function renderWatchPanel(snapshot){
          recordWatch(snapshot);
          if(!watchRoutes.length){watchPanel.innerHTML='';return;}
          watchPanel.innerHTML=`<div style="font-weight:bold;margin-bottom:4px;">Watched Routes</div>
            ${watchRoutes.map(id=>renderOneWatch(id)).join('')}`;
        }
        function renderOneWatch(id){
          const hist=watchHistory[id]||[];
          if(!hist.length)return `<div class="hud-route-watch">${id}: (no data)</div>`;
          const rows=hist.map(h=>`<tr>
              <td>${fmtTime(h.t)}</td><td>${h.eff}</td><td>${h.grid}</td>
              <td>${h.reason}</td><td>${h.det?'Y':''}</td><td>${h.miss?'Y':''}</td>
              <td>${fmtNum(h.totalCost)}</td>
            </tr>`).join('');
          return `<div class="hud-route-watch" data-watch-id="${id}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <strong>${id}</strong><button data-unwatch style="font-size:10px;">Remove</button>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:9px;">
              <thead><tr><th>Time</th><th>Eff</th><th>Grid</th><th>Reason</th><th>Det</th><th>Miss</th><th>Total</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
        }
        function refreshChannelFilter(snapshot){
          const sel=root.querySelector('[data-filter-channel]');
          if(!sel)return;
          const ch=snapshot.channels||{};
          const existing=new Set();
          for(let i=0;i<sel.options.length;i++){ if(sel.options[i].value) existing.add(sel.options[i].value); }
          Object.keys(ch).forEach(id=>{
            if(!existing.has(id)){
              const opt=document.createElement('option');
              opt.value=id; opt.textContent=`# ${id}`; sel.appendChild(opt);
            }
          });
          for(let i=sel.options.length-1;i>=0;i--){
            const o=sel.options[i];
            if(o.value && !ch[o.value]) sel.remove(i);
          }
          sel.value=routingFilters.channel||'';
        }
        function syncFiltersFromState(rt){
          rt.querySelector('[data-filter-det]').checked=routingFilters.detour;
          rt.querySelector('[data-filter-fb]').checked=routingFilters.fallback;
          rt.querySelector('[data-filter-miss]').checked=routingFilters.miss;
          rt.querySelector('[data-filter-smart]').checked=routingFilters.smartHit;
          rt.querySelector('[data-filter-gridok]').checked=routingFilters.gridSuccess;
          const cs=rt.querySelector('[data-filter-channel]'); if(cs) cs.value=routingFilters.channel||'';
        }
        function wireFilters(rt){
          rt.querySelector('[data-filter-det]').addEventListener('change',e=>{
            routingFilters.detour=e.target.checked; savePersistence(); emit('routing:filtersChanged',routingFilters); refresh(buildCoreSnapshot());
          });
          rt.querySelector('[data-filter-fb]').addEventListener('change',e=>{
            routingFilters.fallback=e.target.checked; savePersistence(); emit('routing:filtersChanged',routingFilters); refresh(buildCoreSnapshot());
          });
          rt.querySelector('[data-filter-miss]').addEventListener('change',e=>{
            routingFilters.miss=e.target.checked; savePersistence(); emit('routing:filtersChanged',routingFilters); refresh(buildCoreSnapshot());
          });
          rt.querySelector('[data-filter-smart]').addEventListener('change',e=>{
            routingFilters.smartHit=e.target.checked; savePersistence(); emit('routing:filtersChanged',routingFilters); refresh(buildCoreSnapshot());
          });
          rt.querySelector('[data-filter-gridok]').addEventListener('change',e=>{
            routingFilters.gridSuccess=e.target.checked; savePersistence(); emit('routing:filtersChanged',routingFilters); refresh(buildCoreSnapshot());
          });
          rt.querySelector('[data-filter-channel]').addEventListener('change',e=>{
            routingFilters.channel=e.target.value||null; savePersistence(); emit('routing:filtersChanged',routingFilters); refresh(buildCoreSnapshot());
          });
          rt.querySelector('[data-clear-filters]').addEventListener('click',()=>{
            routingFilters={detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:false,channel:null};
            savePersistence(); emit('routing:filtersChanged',routingFilters); refresh(buildCoreSnapshot());
          });
          rt.querySelector('[data-refresh]').addEventListener('click',()=>refresh(buildCoreSnapshot()));
        }
        function wireSort(rt){
          rt.querySelectorAll('th[data-sort]').forEach(th=>{
            th.addEventListener('click',()=>{
              const f=th.getAttribute('data-sort');
              if(routingSort.field===f) routingSort.dir*=-1;
              else routingSort={field:f,dir:1};
              savePersistence();
              refresh(buildCoreSnapshot());
            });
          });
        }
        function fmtNum(n){ if(n==null)return''; if(Math.abs(n)>=1000)return n.toFixed(0); if(Math.abs(n)>=10)return n.toFixed(1); return n.toFixed(2); }
        function fmtTime(ts){ const d=new Date(ts); return d.toLocaleTimeString([],{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}); }

        root.addEventListener('click',e=>{
          const btn=e.target.closest('[data-unwatch]');
          if(btn){
            const wrap=btn.closest('[data-watch-id]');
            if(wrap){
              const id=wrap.getAttribute('data-watch-id');
              watchRoutes=watchRoutes.filter(x=>x!==id);
              savePersistence(); emit('routing:watchChanged',watchRoutes.slice());
              refresh(buildCoreSnapshot());
            }
          }
        });

        wireFilters(root);
        wireSort(root);
        return {rootEl:root,refresh};
      }
    });

    /* CHANNELS PANEL (with deltas) */
    registerPanel({
      id:'channels',
      title:'Channels',
      order:INTERNAL_ORDERS.channels,
      badge:snap=>Object.keys(snap.channels||{}).length||'',
      render(){
        const root=document.createElement('div');
        root.style.fontSize='10px';
        root.innerHTML=`
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            <button data-clear-channel-filter style="font-size:10px;">Clear Channel Filter</button>
          </div>
          <div data-channel-table-wrap style="max-height:240px;overflow:auto;">
            <table data-channel-table style="border-collapse:collapse;width:100%;font-size:10px;">
              <thead>
                <tr>
                  <th data-sort="id">Channel</th>
                  <th data-sort="occ">Occ</th>
                  <th data-sort="delta">Δ</th>
                  <th data-sort="pct">%</th>
                  <th data-sort="weight">W</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
          <div data-channel-empty style="display:none;opacity:.6;margin-top:4px;">(no channels)</div>`;
        let sort={field:'occ',dir:-1};
        root.querySelector('[data-clear-channel-filter]').addEventListener('click',()=>{
          routingFilters.channel=null; savePersistence(); emit('routing:filtersChanged',routingFilters); refresh(buildCoreSnapshot());
        });
        root.querySelectorAll('th[data-sort]').forEach(th=>{
          th.addEventListener('click',()=>{
            const f=th.getAttribute('data-sort');
            if(sort.field===f) sort.dir*=-1;
            else sort={field:f,dir:(f==='id'?1:-1)};
            refresh(buildCoreSnapshot());
          });
        });
        function refresh(snapshot){
          const ch=snapshot.channels||{};
          const prev=snapshot.previous?.channels||{};
          const ids=Object.keys(ch);
          const tbody=root.querySelector('tbody');
          const empty=root.querySelector('[data-channel-empty]');
          if(!ids.length){tbody.innerHTML='';empty.style.display='block';return;}
          empty.style.display='none';
          const total=ids.reduce((s,id)=>s+ch[id],0)||1;
          const rows=ids.map(id=>{
            const occ=ch[id];
            const prevOcc=prev[id]||0;
            const delta=occ-prevOcc;
            return {
              id,occ,delta,
              pct:(occ/total)*100,
              weight:channelWeight(id)
            };
          }).sort((a,b)=>{
            const f=sort.field; if(a[f]===b[f]) return 0; return (a[f]>b[f]?1:-1)*sort.dir;
          });
          tbody.innerHTML=rows.map(r=>{
            const w=Math.min(100,r.pct).toFixed(1);
            return `<tr data-channel-id="${r.id}" style="cursor:pointer;">
              <td>${r.id}</td>
              <td>${r.occ}</td>
              <td style="color:${r.delta>0?'#77ff90':(r.delta<0?'#ff6688':'#ccc')}">${r.delta>0?'+':''}${r.delta}</td>
              <td>${r.pct.toFixed(1)}</td>
              <td>${r.weight}</td>
            </tr>
            <tr><td colspan="5">
              <div style="background:rgba(255,0,255,0.1);height:6px;border-radius:3px;overflow:hidden;">
                <div style="height:6px;width:${w}%;background:linear-gradient(90deg,#ff00ff,#ff77ff);"></div>
              </div>
            </td></tr>`;
          }).join('');
          tbody.querySelectorAll('tr[data-channel-id]').forEach(tr=>{
            tr.addEventListener('click',()=>{
              const id=tr.getAttribute('data-channel-id');
              routingFilters.channel=routingFilters.channel===id?null:id;
              savePersistence(); emit('routing:filtersChanged',routingFilters);
              refresh(buildCoreSnapshot());
            });
          });
        }
        function channelWeight(id){
          try{
            const parsed=window.cblcars?.routing?._parsedChannels||[];
            const f=parsed.find(c=>c.id===id); return f?(f.weight||1):'';
          }catch{return'';}
        }
        return {rootEl:root,refresh};
      }
    });

    /* PERF PANEL */
    registerPanel({
      id:'perf',
      title:'Perf & Timers',
      order:INTERNAL_ORDERS.perf,
      badge:snap=>Object.keys(snap.perfTimers||{}).length||'',
      render(){
        const root=document.createElement('div');
        root.style.fontSize='10px';
        root.innerHTML=`
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
            <button data-perf-sample style="font-size:10px;">Sample Now</button>
            <button data-perf-reset style="font-size:10px;">Reset Perf</button>
            <button data-perf-reset-timers style="font-size:10px;">Reset Timers</button>
            <button data-perf-unpin style="font-size:10px;">Unpin All</button>
            <button data-perf-pin-top style="font-size:10px;">Pin Top 3</button>
            <label style="display:flex;align-items:center;gap:2px;">min count <input data-min-count type="number" value="0" style="width:50px;font-size:10px;"></label>
            <label style="display:flex;align-items:center;gap:2px;">min avg(ms) <input data-min-avg type="number" value="0" style="width:50px;font-size:10px;"></label>
          </div>
          <details open data-sec-timers><summary style="cursor:pointer;font-weight:bold;">Timers</summary><div data-perf-timers></div></details>
          <details open data-sec-counters style="margin-top:6px;"><summary style="cursor:pointer;font-weight:bold;">Counters</summary><div data-perf-counters></div></details>`;
        const timersDiv=root.querySelector('[data-perf-timers]');
        const countersDiv=root.querySelector('[data-perf-counters]');
        let lastTimers={}, lastCounters={};
        root.querySelector('[data-perf-sample]')?.addEventListener('click',()=>refresh(true,true));
        root.querySelector('[data-perf-reset]')?.addEventListener('click',()=>{try{window.cblcars.perf.reset();}catch{} refresh(true,true);});
        root.querySelector('[data-perf-reset-timers]')?.addEventListener('click',()=>{try{window.cblcars.debug?.perf?.reset();}catch{} refresh(true,true);});
        root.querySelector('[data-perf-unpin]')?.addEventListener('click',()=>{
          pinnedPerf=[]; savePersistence(); emit('perf:pinnedChanged',pinnedPerf.slice()); refresh(buildCoreSnapshot());
        });
        root.querySelector('[data-perf-pin-top]').addEventListener('click',()=>{
          const snap=lastSnapshot||buildCoreSnapshot();
          const timers=snap.perfTimers||{};
          const sorted=Object.entries(timers).sort((a,b)=>b[1].lastMs - a[1].lastMs).slice(0,3).map(e=>e[0]);
          pinnedPerf=sorted; savePersistence(); emit('perf:pinnedChanged',pinnedPerf.slice()); refresh(buildCoreSnapshot());
        });

        function refresh(snapshot){
          const minCount=parseInt(root.querySelector('[data-min-count]').value,10)||0;
          const minAvg=parseFloat(root.querySelector('[data-min-avg]').value)||0;
          const timers=snapshot.perfTimers||{};
          const counters=snapshot.perfCounters||{};
          const tKeys=Object.keys(timers);
          timersDiv.innerHTML=!tKeys.length?'<div style="opacity:.6;">(none)</div>':
            tKeys.map(k=>{
              const t=timers[k];
              if(t.count<minCount || t.avgMs<minAvg) return '';
              const changed=lastTimers[k] && (lastTimers[k].lastMs!==t.lastMs || lastTimers[k].count!==t.count);
              const pin=pinnedPerf.includes(k);
              const viol=isPerfViolation('timer',k,t);
              return `<div data-timer="${k}" class="${changed?'hud-flash':''}" style="display:flex;gap:4px;align-items:center;">
                <button data-pin style="font-size:9px;padding:0 4px;">${pin?'★':'☆'}</button>
                <span style="flex:1;" data-tip="${k}" data-tip-detail="Timer: last=${t.lastMs.toFixed(2)}ms avg=${t.avgMs.toFixed(2)}ms max=${t.maxMs.toFixed(1)} n=${t.count}">
                  ${viol?'<span style="color:#ff004d;">⚠</span> ':''}${k}: last=${t.lastMs.toFixed(2)}ms avg=${t.avgMs.toFixed(2)}ms n=${t.count}
                </span>
                <button data-th-set="${k}" style="font-size:9px;padding:0 4px;" title="Set threshold">Th</button>
                <button data-reset="${k}" style="font-size:9px;padding:0 4px;" title="Reset timer">✕</button>
              </div>`;
            }).join('');
          const cKeys=Object.keys(counters);
          countersDiv.innerHTML=!cKeys.length?'<div style="opacity:.6;">(none)</div>':
            cKeys.sort().map(k=>{
              const c=counters[k];
              if(c.count<minCount || (c.avgMs && c.avgMs<minAvg)) return '';
              const changed=lastCounters[k] && (lastCounters[k].count!==c.count || lastCounters[k].lastMs!==c.lastMs);
              const pin=pinnedPerf.includes(k);
              const viol=isPerfViolation('counter',k,c);
              const avgPart=c.avgMs!=null?` avg=${c.avgMs.toFixed(1)}ms`:'';
              return `<div data-counter="${k}" class="${changed?'hud-flash':''}" style="display:flex;gap:4px;align-items:center;">
                <button data-pin style="font-size:9px;padding:0 4px;">${pin?'★':'☆'}</button>
                <span style="flex:1;" data-tip="${k}" data-tip-detail="Counter: count=${c.count}${avgPart}">
                  ${viol?'<span style="color:#ff004d;">⚠</span> ':''}${k}: c=${c.count}${avgPart}
                </span>
                <button data-th-set="${k}" style="font-size:9px;padding:0 4px;" title="Set threshold">Th</button>
                <button data-reset-counter="${k}" style="font-size:9px;padding:0 4px;" title="Reset counter">✕</button>
              </div>`;
            }).join('');

          timersDiv.querySelectorAll('[data-timer] [data-pin]').forEach(btn=>{
            btn.addEventListener('click',()=>{
              const k=btn.closest('[data-timer]').getAttribute('data-timer');
              togglePin(k,btn);
            });
          });
          timersDiv.querySelectorAll('[data-timer] [data-th-set]').forEach(btn=>{
            btn.addEventListener('click',()=>{
              const id=btn.getAttribute('data-th-set');
              const cur=perfThresholds[id]?.avgMs||'';
              const val=prompt(`Set avgMs threshold for ${id} (blank to clear)`,cur);
              if(val===null) return;
              if(val.trim()===''){ delete perfThresholds[id]; }
              else{
                const num=parseFloat(val);
                if(Number.isFinite(num)) perfThresholds[id]={...(perfThresholds[id]||{}),avgMs:num};
              }
              savePersistence();
              refresh(buildCoreSnapshot());
            });
          });
          timersDiv.querySelectorAll('[data-timer] [data-reset]').forEach(btn=>{
            btn.addEventListener('click',()=>{
              const k=btn.closest('[data-timer]').getAttribute('data-timer');
              try{window.cblcars.debug?.perf?.reset(k);}catch{}
              refresh(buildCoreSnapshot());
            });
          });

          countersDiv.querySelectorAll('[data-counter] [data-pin]').forEach(btn=>{
            btn.addEventListener('click',()=>{
              const k=btn.closest('[data-counter]').getAttribute('data-counter');
              togglePin(k,btn);
            });
          });
          countersDiv.querySelectorAll('[data-counter] [data-th-set]').forEach(btn=>{
            btn.addEventListener('click',()=>{
              const id=btn.getAttribute('data-th-set');
              const cur=perfThresholds[id]?.avgMs||'';
              const val=prompt(`Set avgMs threshold for ${id} (blank to clear)`,cur);
              if(val===null) return;
              if(val.trim()===''){ delete perfThresholds[id]; }
              else{
                const num=parseFloat(val);
                if(Number.isFinite(num)) perfThresholds[id]={...(perfThresholds[id]||{}),avgMs:num};
              }
              savePersistence();
              refresh(buildCoreSnapshot());
            });
          });
          countersDiv.querySelectorAll('[data-counter] [data-reset-counter]').forEach(btn=>{
            btn.addEventListener('click',()=>{
              const k=btn.closest('[data-counter]').getAttribute('data-counter');
              try{window.cblcars.perf.reset(k);}catch{}
              refresh(buildCoreSnapshot());
            });
          });

          lastTimers=JSON.parse(JSON.stringify(timers));
          lastCounters=JSON.parse(JSON.stringify(counters));
        }
        function togglePin(id,btn){
          if(pinnedPerf.includes(id)) pinnedPerf=pinnedPerf.filter(x=>x!==id);
          else pinnedPerf.push(id);
          pinnedPerf=pinnedPerfSanitize(pinnedPerf);
          savePersistence();
          emit('perf:pinnedChanged',pinnedPerf.slice());
          if(btn) btn.textContent=pinnedPerf.includes(id)?'★':'☆';
          refresh(buildCoreSnapshot());
        }
        return {rootEl:root,refresh};
      }
    });

    /* SCENARIOS PANEL */
    registerPanel({
      id:'scenarios',
      title:'Scenarios',
      order:INTERNAL_ORDERS.scenarios,
      badge:snap=>{
        const res=snap.scenarioResults||[];
        if(!res.length) return '';
        const pass=res.filter(r=>r.ok).length;
        return `${pass}/${res.length}`;
      },
      render(){
        const root=document.createElement('div');
        root.style.fontSize='10px';
        root.innerHTML=`
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            <button data-run-all style="font-size:10px;">Run All</button>
            <button data-run-failed style="font-size:10px;">Rerun Failed</button>
            <button data-refresh-scen style="font-size:10px;">↻</button>
          </div>
          <div style="max-height:260px;overflow:auto;">
            <table style="border-collapse:collapse;width:100%;font-size:10px;">
              <thead>
                <tr><th style="text-align:left;">Name</th><th style="text-align:left;">Status</th><th style="text-align:left;">ms</th><th style="text-align:left;">Details</th><th></th></tr>
              </thead>
              <tbody data-scen-tbody></tbody>
            </table>
          </div>
          <div data-scen-empty style="display:none;opacity:.6;margin-top:4px;">(no scenarios)</div>
          <div data-scen-status style="margin-top:6px;font-size:10px;opacity:.75;"></div>`;
        const tbody=root.querySelector('[data-scen-tbody]');
        const statusEl=root.querySelector('[data-scen-status]');
        function setStatus(msg){statusEl.textContent=msg||'';}
        async function runAll(filterFailed){
          setStatus('Running scenarios...');
          const list=dev.listScenarios().map(s=>s.name);
          const prev=dev._scenarioResults||[];
          const failedSet=new Set(prev.filter(r=>!r.ok).map(r=>r.scenario));
          const toRun=list.filter(n=>!filterFailed || failedSet.has(n));
          if(!toRun.length){setStatus('Nothing to run.');return;}
          for(const name of toRun){
            // eslint-disable-next-line no-await-in-loop
            await dev.runScenario(name);
          }
          setStatus('Done.');
          refresh(buildCoreSnapshot());
        }
        root.querySelector('[data-run-all]').addEventListener('click',()=>runAll(false));
        root.querySelector('[data-run-failed]').addEventListener('click',()=>runAll(true));
        root.querySelector('[data-refresh-scen]').addEventListener('click',()=>refresh(buildCoreSnapshot()));
        root.addEventListener('click',e=>{
          const btn=e.target.closest('[data-run-one]');
          if(btn){
            const name=btn.getAttribute('data-run-one');
            (async()=>{
              setStatus(`Running ${name}...`);
              await dev.runScenario(name);
              setStatus('Done.');
              refresh(buildCoreSnapshot());
            })();
          }
        });
        function refresh(snapshot){
          const list=dev.listScenarios();
          const results=snapshot.scenarioResults||[];
          const byName={}; results.forEach(r=>{byName[r.scenario]=r;});
          if(!list.length){
            tbody.innerHTML='';
            root.querySelector('[data-scen-empty]').style.display='block';
            return;
          }
          root.querySelector('[data-scen-empty]').style.display='none';
          tbody.innerHTML=list.map(s=>{
            const res=byName[s.name];
            const status=res ? (res.ok?'✓':'✕') : '?';
            const color=res?(res.ok?'#66ff99':'#ff6688'):'#cccccc';
            const ms=res?res.ms:'';
            const details=res?(res.details||res.error||''):'';
            const shortDetails=details.length>50?details.slice(0,47)+'...':details;
            return `<tr>
              <td>${s.name}</td>
              <td style="color:${color};font-weight:bold;">${status}</td>
              <td>${ms}</td>
              <td title="${details.replace(/"/g,'&quot;')}">${shortDetails||''}</td>
              <td><button data-run-one="${s.name}" style="font-size:9px;">▶</button></td>
            </tr>`;
          }).join('');
        }
        return {rootEl:root,refresh};
      }
    });

    /* FLAGS PANEL */
    registerPanel({
      id:'flags',
      title:'Flags & Profiles',
      order:INTERNAL_ORDERS.flags,
      render(){
        const root=document.createElement('div');
        root.style.fontSize='10px';
        root.innerHTML=`
          <div data-flags-grid style="display:flex;gap:4px;flex-wrap:wrap;"></div>
          <div data-current-prof style="margin-top:4px;opacity:.75;"></div>
          <div style="margin-top:6px;">
            <button data-apply-prof="Minimal" style="font-size:10px;">Minimal</button>
            <button data-apply-prof="Routing" style="font-size:10px;">Routing</button>
            <button data-apply-prof="Perf" style="font-size:10px;">Perf</button>
            <button data-apply-prof="Full" style="font-size:10px;">Full</button>
          </div>
          <div style="margin-top:6px;font-size:10px;opacity:.6;">Profiles override existing flags.</div>`;
        function rebuild(){
          const grid=root.querySelector('[data-flags-grid]');
          const flagsObj=window.cblcars._debugFlags||{};
          const keys=[...new Set([...Object.keys(flagsObj),...QUICK_FLAG_KEYS,'validation','smart','counters','svg_perf_overlay'])].sort();
          grid.innerHTML=keys.map(k=>{
            const on=!!flagsObj[k];
            return `<button data-flag-detail="${k}"
              style="font-size:10px;padding:2px 6px;margin:2px;cursor:pointer;border:1px solid #552266;border-radius:3px;
              background:${on?'#ff00ff':'#333'};color:${on?'#120018':'#ffd5ff'};"
              data-tip="${k}" data-tip-detail="${DEFINITIONS[k]?.l||'Toggle debug flag'}">${k}</button>`;
          }).join('');
          grid.querySelectorAll('[data-flag-detail]').forEach(btn=>{
            btn.addEventListener('click',()=>{
              const fk=btn.getAttribute('data-flag-detail');
              const nf=!(window.cblcars._debugFlags||{})[fk];
              dev.flags({[fk]:nf});
              persistHudState({flags:window.cblcars._debugFlags});
              emit('flags:changed',window.cblcars._debugFlags);
              rebuild(); renderQuickFlags(document.getElementById(HUD_ID),true);
            });
          });
          root.querySelector('[data-current-prof]').textContent=`Profile: ${selectedProfile}`;
        }
        root.querySelectorAll('[data-apply-prof]').forEach(b=>{
          b.addEventListener('click',()=>{
            const prof=b.getAttribute('data-apply-prof');
            if(!FLAG_PROFILES[prof])return;
            dev.flags(FLAG_PROFILES[prof]);
            selectedProfile=prof;
            persistHudState({selectedProfile:prof,flags:window.cblcars._debugFlags});
            emit('flags:changed',window.cblcars._debugFlags);
            rebuild(); renderQuickFlags(document.getElementById(HUD_ID),true);
          });
        });
        rebuild();
        return {rootEl:root,refresh(){}};
      }
    });

    /* ACTIONS PANEL */
    registerPanel({
      id:'actions',
      title:'Actions',
      order:INTERNAL_ORDERS.actions,
      render(){
        const root=document.createElement('div');
        root.style.fontSize='10px';
        root.innerHTML=`
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            <button data-act="list-cards" style="font-size:10px;">List Cards</button>
            <button data-act="relayout" style="font-size:10px;">Relayout</button>
            <button data-act="reset-perf" style="font-size:10px;">Reset Perf</button>
            <button data-act="toggle-aggressive" style="font-size:10px;">Smart Agg</button>
            <button data-act="toggle-detour" style="font-size:10px;">Detour</button>
            <button data-act="pause" style="font-size:10px;">Pause</button>
            <button data-act="watch-route" style="font-size:10px;">Watch Route…</button>
            <button data-act="clear-watches" style="font-size:10px;">Clear Watches</button>
            <button data-act="bootstrap-scan" style="font-size:10px;">Scan</button>
            <button data-act="export-snapshot" style="font-size:10px;">Export</button>
          </div>
          <div data-actions-status style="margin-top:6px;opacity:.75;font-size:10px;"></div>`;
        function setStatus(msg){root.querySelector('[data-actions-status]').textContent=msg;}
        root.querySelectorAll('[data-act]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const act=btn.getAttribute('data-act');
            try{
              switch(act){
                case'list-cards':dev.listCards();setStatus('Listed cards.');break;
                case'relayout':dev.relayout('*');setStatus('Relayout requested.');break;
                case'reset-perf':window.cblcars.perf.reset();setStatus('Perf counters reset.');break;
                case'toggle-aggressive':{
                  const rt=dev.getRuntime(); const cur=!!rt.smart_aggressive;
                  dev.setRuntime({smart_aggressive:!cur}); setStatus(`smart_aggressive=${!cur}`); break;
                }
                case'toggle-detour':{
                  const rt=dev.getRuntime(); const cur=!!(rt.fallback?.enable_two_elbow);
                  dev.setRuntime({fallback:{enable_two_elbow:!cur}}); setStatus(`detour=${!cur}`); break;
                }
                case'pause':
                  paused=!paused; savePersistence();
                  btn.textContent=paused?'Resume':'Pause';
                  setStatus(paused?'Paused':'Resumed');
                  if(!paused){refresh(true,true); resetIntervalTimer(); maybeRestartWarmups(); compareBase=null;}
                  styleGlobal(document.getElementById(HUD_ID));
                  emit(paused?'refresh:paused':'refresh:resumed',{paused});
                  break;
                case'watch-route':{
                  const id=prompt('Enter route (connector) id to watch:');
                  if(id && !watchRoutes.includes(id)){
                    watchRoutes.push(id); savePersistence();
                    setStatus(`Watching ${id}`);
                  }
                  break;
                }
                case'clear-watches':
                  watchRoutes=[]; savePersistence(); setStatus('Cleared watches.'); break;
                case'bootstrap-scan':
                  forceBootstrapScan();
                  setStatus('Bootstrap scan triggered.');
                  break;
                case'export-snapshot':
                  try{ exportSnapshotFile(); setStatus('Snapshot exported.'); }
                  catch(e){ setStatus('Export failed'); }
                  break;
                default:break;
              }
            }catch(e){setStatus('Error: '+(e?.message||e));}
          });
        });
        return {rootEl:root,refresh(){}};
      }
    });

    /* Frame / Skeleton */
    function ensure(){
      dev.hud._enabled=true;
      mountGlobal();
      renderFrameSkeleton();
      refresh(true,true);
      startActiveCardWait();
      warmupInit();
      startDomObserver();
      bootstrapPollingLoop();
    }
    function mountGlobal(){
      let el=document.getElementById(HUD_ID);
      if(!el){el=document.createElement('div'); el.id=HUD_ID;}
      styleGlobal(el); document.body.appendChild(el);
    }
    function styleGlobal(panel){
      if(!panel)return;
      Object.assign(panel.style,{
        background:'rgba(20,0,30,0.92)',color:'#ffd5ff',font:'12px/1.35 monospace',
        border:'1px solid #ff00ff',borderRadius:'6px',maxWidth:'820px',minWidth:'360px',
        zIndex:HUD_Z,padding:'0',boxShadow:'0 3px 16px rgba(0,0,0,0.70)',isolation:'isolate',position:'fixed'
      });
      if(!dragPos){panel.style.top='14px';panel.style.right='14px';panel.style.left='';}
      else {panel.style.left=dragPos[0]+'px';panel.style.top=dragPos[1]+'px';panel.style.right='';}
      if(paused) panel.classList.add('hud-paused-badge'); else panel.classList.remove('hud-paused-badge');
    }
    function removeHud(){
      dev.hud._enabled=false;
      if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}
      stopWarmup();
      stopDomObserver();
      const el=document.getElementById(HUD_ID); if(el) el.remove();
    }
    function renderFrameSkeleton(){
      ensureFlashCss();
      const panel=document.getElementById(HUD_ID);
      if(!panel)return;
      const cardOptions=dev.discoverMsdCards?dev.discoverMsdCards(true):[];
      const activeIndex=cardOptions.indexOf(dev._activeCard);
      panel.innerHTML=`
        <div data-hdr style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;cursor:move;background:linear-gradient(90deg,#330046,#110014);padding:6px 8px;border-bottom:1px solid #ff00ff;position:relative;">
          <strong style="flex:1;font-size:12px;">LCARS Dev HUD ${HUD_VERSION}</strong>
          <span class="hud-header-metrics">
            <span data-snapshot-build style="opacity:.85;"></span>
            <span data-snapshot-age style="opacity:.65;"></span>
          </span>
          <select data-card-pick style="font-size:10px;max-width:150px;">
            ${cardOptions.map((c,i)=>`<option value="${i}" ${i===activeIndex?'selected':''}>Card ${i}${c===dev._activeCard?' *':''}</option>`).join('')}
          </select>
          <button data-silent-toggle style="font-size:11px;padding:2px 6px;" data-tip="Silent Mode">${silentMode?'Silent✓':'Silent'}</button>
          <button data-profile-btn style="font-size:11px;padding:2px 6px;" data-tip="Profiles">Prof</button>
          <button data-legend-toggle style="font-size:11px;padding:2px 6px;" data-tip="Legend Mode" data-tip-detail="Toggle quick flag label verbosity.">${verboseFlags?'ABC':'A'}</button>
          <button data-collapse style="font-size:11px;padding:2px 6px;" data-tip="Collapse HUD">${collapsed?'▢':'▣'}</button>
          <button data-remove style="font-size:11px;padding:2px 6px;" data-tip="Disable HUD">✕</button>
        </div>
        <div data-toolbar style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:4px 8px;border-bottom:1px solid #552266;background:rgba(30,0,50,0.50);">
          <span style="font-size:10px;opacity:.65;">Flags:</span>
          <div data-quick-flags style="display:flex;flex-wrap:wrap;gap:2px;"></div>
          <span style="margin-left:auto;font-size:10px;opacity:.65;">Interval</span>
          <input data-int type="number" min="250" step="250" value="${hudInterval}" data-tip="Refresh Interval" style="width:70px;font-size:10px;">
          <span style="margin-left:6px;font-size:10px;opacity:.65;">Tooltip ms</span>
          <input data-tooltip-timeout type="number" min="0" step="250" value="${tooltipTimeout}" data-tip="Tooltip Timeout" style="width:70px;font-size:10px;">
          <span style="margin-left:6px;font-size:10px;opacity:.65;">Delay</span>
          <input data-tooltip-delay type="number" min="0" step="50" value="${tooltipDelay}" data-tip="Tooltip Show Delay" style="width:60px;font-size:10px;">
          <button data-refresh data-tip="Immediate Refresh" style="font-size:10px;padding:2px 6px;">↻</button>
          <button data-pause-toggle style="font-size:10px;padding:2px 6px;" data-tip="Pause/Resume">${paused?'Resume':'Pause'}</button>
        </div>
        <div data-body style="${collapsed?'display:none;':''};max-height:70vh;overflow-y:auto;padding:6px 8px;position:relative;"></div>
        <div data-footer style="padding:4px 8px;font-size:10px;opacity:.55;${collapsed?'display:none;':''}">
          Drag header. Prof=profiles. A=flag legend. Silent suppresses HUD logs. Cmp compare tool (paused). ↻ refresh.
        </div>
        <div id="cblcars-hud-tooltip" style="position:fixed;left:0;top:0;pointer-events:auto;z-index:${HUD_Z+1};
             background:rgba(60,0,80,0.95);color:#ffe6ff;font:11px/1.35 monospace;padding:8px 10px;
             border:1px solid #ff00ff;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.6);display:none;
             max-width:340px;white-space:normal;"></div>`;
      wireFrame(panel);
      const body=panel.querySelector('[data-body]');
      const container=document.createElement('div');
      container.setAttribute('data-panels','');
      container.style.cssText='display:flex;flex-direction:column;gap:8px;';
      body.appendChild(container);
      renderQuickFlags(panel);
      renderPanelsShell();
      initTooltipEngine(panel);
      updatePinnedCount();
    }
    function wireFrame(panel){
      if(!panelDraggable){
        const hdr=panel.querySelector('[data-hdr]');
        if(hdr){
          panelDraggable=true;
          let dragging=false,startX=0,startY=0,origX=0,origY=0;
          hdr.addEventListener('mousedown',e=>{
            if(e.button!==0)return;
            dragging=true; startX=e.clientX; startY=e.clientY;
            const r=panel.getBoundingClientRect(); origX=r.left; origY=r.top;
            document.addEventListener('mousemove',onMove);
            document.addEventListener('mouseup',onUp,{once:true});
            e.preventDefault();
          });
          function onMove(e){
            if(!dragging)return;
            panel.style.left=(origX+(e.clientX-startX))+'px';
            panel.style.top=(origY+(e.clientY-startY))+'px';
            panel.style.right='';
          }
          function onUp(){
            dragging=false;
            document.removeEventListener('mousemove',onMove);
            const r=panel.getBoundingClientRect();
            dragPos=[r.left,r.top]; savePersistence();
          }
        }
      }
      panel.querySelector('[data-card-pick]').addEventListener('change',e=>{
        const idx=parseInt(e.target.value,10);
        dev.pick(idx);
      });
      panel.querySelector('[data-remove]').addEventListener('click',()=>{
        persistHudState({enabled:false}); removeHud();
      });
      panel.querySelector('[data-collapse]').addEventListener('click',()=>{
        collapsed=!collapsed; savePersistence();
        const body=panel.querySelector('[data-body]');
        const foot=panel.querySelector('[data-footer]');
        const btn=panel.querySelector('[data-collapse]');
        if(body) body.style.display=collapsed?'none':'block';
        if(foot) foot.style.display=collapsed?'none':'block';
        if(btn) btn.textContent=collapsed?'▢':'▣';
      });
      panel.querySelector('[data-refresh]').addEventListener('click',()=>refresh(true,true));
      panel.querySelector('[data-int]').addEventListener('change',e=>{
        const v=parseInt(e.target.value,10);
        if(Number.isFinite(v)&&v>=250){hudInterval=v; savePersistence(); resetIntervalTimer();}
      });
      panel.querySelector('[data-tooltip-timeout]').addEventListener('change',e=>{
        const v=parseInt(e.target.value,10);
        tooltipTimeout=Number.isFinite(v)?Math.max(0,v):2500; savePersistence();
      });
      panel.querySelector('[data-tooltip-delay]').addEventListener('change',e=>{
        const v=parseInt(e.target.value,10);
        tooltipDelay=Number.isFinite(v)?Math.max(0,v):TOOLTIP_DEFAULT_DELAY;
        savePersistence();
      });
      panel.querySelector('[data-profile-btn]').addEventListener('click',()=>showProfilesMenu(panel));
      panel.querySelector('[data-legend-toggle]').addEventListener('click',()=>{
        verboseFlags=!verboseFlags; savePersistence(); renderQuickFlags(panel,true);
      });
      panel.querySelector('[data-pause-toggle]').addEventListener('click',e=>{
        paused=!paused; savePersistence();
        e.target.textContent=paused?'Resume':'Pause';
        if(!paused){refresh(true,true); resetIntervalTimer(); maybeRestartWarmups(); compareBase=null;}
        styleGlobal(panel);
      });
      panel.querySelector('[data-silent-toggle]').addEventListener('click',e=>{
        silentMode=!silentMode; savePersistence();
        e.target.textContent=silentMode?'Silent✓':'Silent';
        hudInfo('Silent mode',silentMode);
      });
    }
    function updatePinnedCount(){
      const panel=document.getElementById(HUD_ID);
      if(!panel)return;
      const span=panel.querySelector('[data-pinned-count]');
      if(span) span.textContent=pinnedPerf.length?`Pinned:${pinnedPerf.length}`:'';
    }
    function updateHeaderSnapshotMeta(){
      const panel=document.getElementById(HUD_ID);
      if(!panel || !lastSnapshot)return;
      const buildSpan=panel.querySelector('[data-snapshot-build]');
      const ageSpan=panel.querySelector('[data-snapshot-age]');
      if(buildSpan) buildSpan.textContent=`snap ${lastSnapshotBuildMs.toFixed(1)}ms`;
      if(ageSpan){
        const ageSec=((Date.now()-lastSnapshotBuiltAt)/1000).toFixed(1);
        ageSpan.textContent=`age ${ageSec}s`;
      }
    }

    /* Perf Threshold Helpers */
    function isPerfViolation(kind,id,stat){
      const th=perfThresholds[id];
      if(!th) return false;
      if(th.avgMs!=null && stat.avgMs>th.avgMs) return true;
      if(th.lastMs!=null && stat.lastMs>th.lastMs) return true;
      return false;
    }
    function collectPerfViolations(snapshot){
      const out=[];
      const timers=snapshot.perfTimers||{};
      const counters=snapshot.perfCounters||{};
      Object.entries(timers).forEach(([k,v])=>{
        if(isPerfViolation('timer',k,v)) out.push({id:k,detail:`avg ${v.avgMs.toFixed(2)}ms > ${perfThresholds[k].avgMs}`});
      });
      Object.entries(counters).forEach(([k,v])=>{
        if(isPerfViolation('counter',k,v)) out.push({id:k,detail:`avg ${v.avgMs?.toFixed?.(2)||'?'}ms > ${perfThresholds[k].avgMs}`});
      });
      return out;
    }
    function countPerfViolations(snapshot){
      return collectPerfViolations(snapshot).length;
    }

    /* Refresh Loop */
    function resetIntervalTimer(){
      if(refreshTimer) clearInterval(refreshTimer);
      if(!paused) refreshTimer=setInterval(()=>refresh(),hudInterval);
    }
    function refresh(forcePersist=false,allowWhilePaused=false){
      if(!dev.hud._enabled) return;
      if(paused && !allowWhilePaused){
        if(!lastSnapshot){
          const snap=buildCoreSnapshot();
          emit('refresh:snapshot',snap);
          renderPanelsShell();
          refreshPanels(snap);
          updatePinnedCount();
          lastSnapshot=snap;
          if(forcePersist) savePersistence();
        }
        updateHeaderSnapshotMeta();
        return;
      }
      const snapshot=buildCoreSnapshot();
      emit('refresh:snapshot',snapshot);
      renderPanelsShell();
      refreshPanels(snapshot);
      updatePinnedCount();
      lastSnapshot=snapshot;
      if(forcePersist) savePersistence();
      if(snapshot.routesSummary.total>0){
        stopWarmup(); stopDomObserver();
      }
      repaintSafeguard(snapshot);
      updateHeaderSnapshotMeta();
    }
    function repaintSafeguard(snapshot){
      try{
        if(snapshot.routesSummary.total>0){
          const tbody=getRoutingTbody();
          if(!tbody || tbody.childElementCount===0){
            hudInfo('Routing panel empty after snapshot; forcing full repaint.');
            forceFullRepaint(snapshot);
          }else{
            const prevTs=parseInt(tbody.getAttribute('data-snapshot-ts')||'0',10);
            tbody.setAttribute('data-snapshot-ts',String(snapshot.timestamp));
            if(prevTs && prevTs===snapshot.timestamp){}
          }
        }
      }catch(e){
        hudWarn('repaint safeguard error',e);
      }
    }

    /* Warmup / Bootstrap */
    function warmupInit(){
      warmupStart=performance.now();
      stopWarmup();
      warmupTimer=setTimeout(warmupTick,STARTUP_WARMUP_INTERVAL_MS);
    }
    function warmupTick(){
      if(!dev.hud._enabled){ stopWarmup(); return; }
      const elapsed=performance.now()-warmupStart;
      if(lastSnapshot && lastSnapshot.routesSummary.total>0){
        stopWarmup(); return;
      }
      refresh(false,true);
      if(elapsed<STARTUP_WARMUP_MAX_MS){
        warmupTimer=setTimeout(warmupTick,STARTUP_WARMUP_INTERVAL_MS);
      }else{
        stopWarmup();
      }
    }
    function stopWarmup(){ if(warmupTimer){clearTimeout(warmupTimer);warmupTimer=null;} }
    function maybeRestartWarmups(){
      if(!paused && (!lastSnapshot || lastSnapshot.routesSummary.total===0)){
        warmupInit();
        startDomObserver();
        bootstrapPollingLoop();
      }
    }

    /* Repaint Helpers */
    function getRoutingTbody(){
      const panel=document.getElementById(HUD_ID);
      if(!panel) return null;
      return panel.querySelector('[data-panel="routing"] tbody');
    }
    function forceFullRepaint(snapshotOverride){
      const panel=document.getElementById(HUD_ID);
      if(!panel) return;
      const container=panel.querySelector('[data-panels]');
      if(container) container.innerHTML='';
      for(const entry of panelRegistry.values()){
        entry.instance=null;
      }
      renderPanelsShell();
      const snap=snapshotOverride||lastSnapshot||buildCoreSnapshot();
      if(snap){
        try{
          refreshPanels(snap);
          updatePinnedCount();
        }catch(e){
          hudWarn('forceFullRepaint failed',e);
        }
      }
    }

    /* DOM Observer */
    function startDomObserver(){
      if(domObserver) return;
      domObserver={started:performance.now(),handles:[],stopped:false};
      const ATTR_FILTER=['data-cblcars-route-effective','data-cblcars-route-grid-status','data-cblcars-route-grid-reason'];
      const MIN_GAP_MS=120;
      let lastTrigger=0;
      const shouldStop=()=>{
        if(!dev.hud._enabled) return true;
        if(lastSnapshot && lastSnapshot.routesSummary && lastSnapshot.routesSummary.total>0) return true;
        if(performance.now()-domObserver.started>STARTUP_DOM_OBSERVER_MAX_MS) return true;
        return false;
      };
      const triggerRefresh=()=>{
        const now=performance.now();
        if(now-lastTrigger<MIN_GAP_MS) return;
        lastTrigger=now;
        refresh(false,true);
        if(lastSnapshot && lastSnapshot.routesSummary.total>0){
          stopDomObserver();
        }
      };
      function collectRoots(){
        const roots=new Set();
        roots.add(document.documentElement);
        try{
          const cards=dev.discoverMsdCards?dev.discoverMsdCards(true):[];
          cards.forEach(c=>c.shadowRoot && roots.add(c.shadowRoot));
        }catch(_){}
        return Array.from(roots);
      }
      function attachObserverTo(root){
        if(!root)return;
        try{
          const mo=new MutationObserver(muts=>{
            if(shouldStop()){stopDomObserver();return;}
            let any=false;
            for(const m of muts){
              if(m.type==='childList'){
                for(const n of m.addedNodes){
                  if(n && n.nodeType===1){
                    if(n.matches && n.matches('path[data-cblcars-attach-to]')){any=true;continue;}
                    if(n.querySelector && n.querySelector('path[data-cblcars-attach-to]')) any=true;
                  }
                }
              }else if(m.type==='attributes'){
                const t=m.target;
                if(t && t.nodeType===1 && t.tagName && t.tagName.toLowerCase()==='path' &&
                   t.hasAttribute('data-cblcars-attach-to') && ATTR_FILTER.includes(m.attributeName)){
                  any=true;
                }
              }
              if(any) break;
            }
            if(any) triggerRefresh();
          });
          mo.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:ATTR_FILTER});
          domObserver.handles.push(mo);
        }catch(_){}
      }
      collectRoots().forEach(r=>attachObserverTo(r));
      const RESCAN_INTERVAL=600;
      (function rescanLoop(){
        if(shouldStop()){stopDomObserver();return;}
        collectRoots().forEach(r=>{
          if(!r.__cblcarsHudObserved){
            attachObserverTo(r);
            r.__cblcarsHudObserved=true;
          }
        });
        if(!shouldStop()) setTimeout(rescanLoop,RESCAN_INTERVAL);
      })();
    }
    function stopDomObserver(){
      if(!domObserver) return;
      if(Array.isArray(domObserver.handles)){
        domObserver.handles.forEach(mo=>{try{mo.disconnect();}catch(_){}} );
      }
      domObserver=null;
    }
    function bootstrapPollingLoop(){
      const start=performance.now();
      (function loop(){
        if(!dev.hud._enabled) return;
        if(lastSnapshot && lastSnapshot.routesSummary.total>0) return;
        const anyPath=document.querySelector('path[data-cblcars-route-effective], path[data-cblcars-attach-to]');
        if(anyPath){refresh(false,true);}
        if((!lastSnapshot || lastSnapshot.routesSummary.total===0) && performance.now()-start<STARTUP_WARMUP_MAX_MS){
          setTimeout(loop,350);
        }
      })();
    }
    function startActiveCardWait(){
      if(activeCardWaitTimer) return;
      const start=performance.now();
      (function waitLoop(){
        if(dev._activeCard || performance.now()-start>ACTIVE_CARD_WAIT_MAX_MS){
          activeCardWaitTimer=null;
          if(!lastSnapshot || lastSnapshot.routesSummary.total===0) refresh(false,true);
          return;
        }
        refresh(false,true);
        activeCardWaitTimer=setTimeout(waitLoop,300);
      })();
    }
    function forceBootstrapScan(){
      warmupInit(); startDomObserver(); bootstrapPollingLoop(); startActiveCardWait(); refresh(false,true);
    }

    /* HUD API */
    function buildHudApi(){
      return {
        bringToFront,
        setInterval(ms){hudInterval=Math.max(250,ms); savePersistence(); resetIntervalTimer();},
        applyProfile(name){
          if(!FLAG_PROFILES[name])return;
          dev.flags(FLAG_PROFILES[name]);
          selectedProfile=name; savePersistence();
          renderQuickFlags(document.getElementById(HUD_ID),true);
          emit('flags:changed',window.cblcars._debugFlags);
        },
        on,off,
        watchRoute(id){if(!watchRoutes.includes(id)){watchRoutes.push(id);savePersistence();}},
        unwatchRoute(id){watchRoutes=watchRoutes.filter(x=>x!==id);savePersistence();},
        clearWatches(){watchRoutes=[];savePersistence();},
        getWatchRoutes(){return watchRoutes.slice();},
        setRoutingFilters(patch){Object.assign(routingFilters,patch||{}); savePersistence(); refresh(true,true);},
        getRoutingFilters(){return {...routingFilters};},
        pause(){if(!paused){paused=true;savePersistence();styleGlobal(document.getElementById(HUD_ID));}},
        resume(){if(paused){paused=false;savePersistence();resetIntervalTimer();refresh(true,true); maybeRestartWarmups();}},
        isPaused(){return paused;},
        pinPerf(id){if(!pinnedPerf.includes(id)) pinnedPerf.push(id); pinnedPerf=pinnedPerfSanitize(pinnedPerf); savePersistence();updatePinnedCount();emit('perf:pinnedChanged',pinnedPerf.slice());refresh(true,true);},
        unpinPerf(id){pinnedPerf=pinnedPerf.filter(x=>x!==id);savePersistence();updatePinnedCount();emit('perf:pinnedChanged',pinnedPerf.slice());refresh(true,true);},
        clearPinnedPerf(){pinnedPerf=[];savePersistence();updatePinnedCount();emit('perf:pinnedChanged',pinnedPerf.slice());refresh(true,true);},
        setTooltipTimeout(ms){tooltipTimeout=Math.max(0,ms|0);savePersistence();},
        setTooltipDelay(ms){tooltipDelay=Math.max(0,ms|0);savePersistence();},
        getTooltipDelay(){return tooltipDelay;},
        setSilent(on){silentMode=!!on;savePersistence();},
        isSilent(){return silentMode;},
        setHighlight(on){highlightEnabled=!!on;savePersistence();},
        refreshOncePaused(){refresh(true,true);},
        refreshRaw(opts={}){refresh(!!opts.persist,!!opts.allowWhilePaused);},
        forceBootstrapScan,
        exportSnapshot: ()=>exportSnapshotFile(),
        help(){
          console.group('[HUD API]');
          console.log('Methods: bringToFront,setInterval,applyProfile,on/off,watchRoute/unwatchRoute/clearWatches,getWatchRoutes,setRoutingFilters,getRoutingFilters,pause,resume,isPaused,pinPerf/unpinPerf/clearPinnedPerf,setTooltipTimeout,setTooltipDelay,getTooltipDelay,setSilent,isSilent,setHighlight,refreshOncePaused,refreshRaw,forceBootstrapScan,exportSnapshot,help');
          console.log('Events: refresh:snapshot,flags:changed,routing:filtersChanged,routing:watchChanged,perf:pinnedChanged,panel:toggle');
          console.log('State:',dev.hud.status());
          console.groupEnd();
        }
      };
    }
    function bringToFront(){
      const panel=document.getElementById(HUD_ID);
      if(!panel)return;
      document.body.appendChild(panel);
      panel.style.zIndex=HUD_Z;
    }

    Object.assign(dev.hud, buildHudApi(), {
      ensure,remove:removeHud,
      refresh:()=>refresh(true,true),
      setInterval:(ms)=>dev.hud.setInterval(ms),
      collapse:()=>{collapsed=true;savePersistence();refresh(true,true);},
      expand:()=>{collapsed=false;savePersistence();refresh(true,true);},
      toggle:()=>{collapsed=!collapsed;savePersistence();refresh(true,true);},
      recenter:()=>{dragPos=null;savePersistence();styleGlobal(document.getElementById(HUD_ID));},
      forceRepaint:()=>forceFullRepaint(),
      status(){
        return {
          enabled:dev.hud._enabled,
          collapsed,
          interval:hudInterval,
          verboseFlags,
          selectedProfile,
          tooltipTimeout,
          tooltipDelay,
          paused,
          silentMode,
          highlightEnabled,
          watchHistoryDepth,
          pinnedPerf:pinnedPerf.slice(),
          watchRoutes:watchRoutes.slice(),
          routingFilters:{...routingFilters},
          routingSort:{...routingSort},
          perfThresholds:{...perfThresholds},
          panelCount:panelRegistry.size,
          lastSnapshotRoutes:lastSnapshot?.routesSummary?.total||0,
          lastSnapshotBuildMs,
          version:HUD_VERSION
        };
      }
    });

    dev.hud.debug={
      snapshot:()=>lastSnapshot,
      forceRepaint:()=>forceFullRepaint()
    };

    /* Wrap dev.runScenario so single ▶ updates HUD results */
    if(!dev._hudRunScenarioWrapped && typeof dev.runScenario==='function'){
      const orig=dev.runScenario;
      dev.runScenario=async function(name){
        const res=await orig(name);
        try{
          if(res && res.scenario){
            if(!Array.isArray(dev._scenarioResults)) dev._scenarioResults=[];
            const idx=dev._scenarioResults.findIndex(r=>r.scenario===res.scenario);
            if(idx>=0) dev._scenarioResults[idx]=res;
            else dev._scenarioResults.push(res);
          }
        }catch{}
        if(dev.hud?._enabled) setTimeout(()=>dev.hud.refresh && dev.hud.refresh(),60);
        return res;
      };
      dev._hudRunScenarioWrapped=true;
    }

    /* Hook pick/setCard to refresh */
    const origPick=dev.pick;
    dev.pick=function(i){const r=origPick.call(dev,i); if(dev.hud._enabled) setTimeout(()=>refresh(true,true),40); return r;};
    const origSetCard=dev.setCard;
    dev.setCard=function(el){const r=origSetCard.call(dev,el); if(dev.hud._enabled) setTimeout(()=>refresh(true,true),40); return r;};

    /* Export Snapshot */
    function exportSnapshotFile(){
      try{
        const snap=lastSnapshot||buildCoreSnapshot();
        const cardIndex=dev.persistedState?.activeCardIndex ?? null;
        const enriched={
          schema_version:SNAPSHOT_SCHEMA_VERSION,
          hud_version:HUD_VERSION,
          build_ms:snap.buildMs,
          refresh_interval:hudInterval,
          paused,
          silentMode,
          highlightEnabled,
          cardIndex,
          cardId:dev._activeCard? dev._activeCard.id || dev._activeCard.tagName || null : null,
          perfThresholds,
          snapshot:snap
        };
        const blob=new Blob([JSON.stringify(enriched,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;
        a.download=`lcars-hud-snapshot-${snap.timestamp||Date.now()}.json`;
        document.body.appendChild(a); a.click();
        setTimeout(()=>{try{document.body.removeChild(a);}catch{} URL.revokeObjectURL(url);},1200);
      }catch(e){
        hudWarn('export snapshot failed',e);
        throw e;
      }
    }

    /* Intervals & Kickoff */
    resetIntervalTimer();
    if(persisted.enabled){dev.hud._enabled=true; setTimeout(()=>ensure(),70);}
    dev.hud._phase25dx1Attached=true;
    hudInfo(`Phase 2.5-dx1 HUD attached (${HUD_VERSION})`);
    setInterval(()=>{ if(dev.hud._enabled){ updatePanelAges(); updateHeaderSnapshotMeta(); } },500);

    /* Helper functions reused above */
    function countPerfViolations(snapshot){ return collectPerfViolations(snapshot).length; }

  }
})();