/* LCARS Dev HUD Core (Phase 2.6-dx1 parity restore)
 * Restores Phase 2.5/monolithic features:
 *  - Perf thresholds + violations badge
 *  - Channel deltas (previous.channels)
 *  - Quick flags + profiles + pause/silent/profile header buttons + multi-card pick
 *  - Pinned perf mini strip (exposed to Summary panel)
 *  - Watch routes + API
 *  - Persistence of thresholds, flags, pinnedPerf, watchRoutes, routingFilters
 *  - Scenario single run refresh handled via dev tools wrapper (outside core)
 */
(function initHudCore(){
  const qs=new URLSearchParams(location.search);
  const active=!window.CBLCARS_DEV_DISABLE && (window.CBLCARS_DEV_FORCE===true || qs.has('lcarsDev'));
  if(!active) return;
  if(window.cblcars?.hud?.__coreAttached && !window.CBLCARS_HUD_ALLOW_MULTI){
    console.warn('[cblcars.hud.core] Already attached.');
    return;
  }

  let attempts=0; const MAX_ATTEMPTS=80;
  (function waitDev(){
    if(window.cblcars?.dev?._advanced) return attach();
    if(attempts++<MAX_ATTEMPTS) return setTimeout(waitDev,120);
    console.warn('[cblcars.hud.core] Dev tools not detected – HUD aborted.');
  })();

  function attach(){
    if(!window.cblcars) window.cblcars={};
    const dev=window.cblcars.dev;
    const hudNS=window.cblcars.hud=window.cblcars.hud||{};
    hudNS.__coreAttached=true;

    /* ---------- Constants ---------- */
    const HUD_ID='cblcars-dev-hud-panel';
    const HUD_VERSION='2.6-dx1-parity';
    const HUD_Z=2147480000;
    const DEFAULT_INTERVAL=3000;
    const TOOLTIP_DEFAULT_DELAY=280;
    const SNAPSHOT_SCHEMA_VERSION=3;
    const WATCH_HISTORY_DEPTH=5; // fixed depth per parity decision

    const FLAG_PROFILES={
      Minimal:{overlay:false,connectors:false,perf:false,geometry:false,channels:false},
      Routing:{overlay:true,connectors:true,perf:false,geometry:false,channels:true},
      Perf:{overlay:false,connectors:false,perf:true,geometry:false,channels:false},
      Full:{overlay:true,connectors:true,perf:true,geometry:true,channels:true}
    };
    const QUICK_FLAG_KEYS=['overlay','connectors','perf','geometry','channels'];

    const DEFINITIONS={
      eff:{l:'Effective routing mode (smart/grid/manhattan)'},
      gridStatus:{l:'Grid status: success | fallback | skipped | manhattan'},
      gridReason:{l:'Reason for grid result or skip code'},
      detour:{l:'Two-elbow detour used (pre-grid heuristic)'},
      miss:{l:'Preferred/required channel miss indicator'},
      channelsHit:{l:'Comma list of channels path passes through (grid)'},
      distanceCost:{l:'Distance cost component (grid path scoring)'},
      bends:{l:'Number of bends (turns) normalised (cost/bendWeight)'},
      bendCost:{l:'Cost contribution from bends'},
      totalCost:{l:'Total path cost (distance + bends + extras)'},
      resolution:{l:'Grid resolution of first successful attempt'},
      watch:{l:'Add/remove this route from watch list'}
    };

    /* ---------- Persistence ---------- */
    function readHudState(){return (dev.persistedState && dev.persistedState.hud)||{};}
    function persistHud(patch){
      try{
        if(typeof dev._persistHudState==='function') dev._persistHudState(patch);
        else {
          const cur=readHudState();
          dev.persist({ hud:{...cur,...patch} });
        }
      }catch{}
    }
    const persisted=readHudState();

    /* ---------- State ---------- */
    let dragPos=Array.isArray(persisted.position)?persisted.position.slice():null;
    let collapsed=!!persisted.collapsed;
    let hudInterval=Number.isFinite(persisted.interval)?Math.max(250,persisted.interval):DEFAULT_INTERVAL;
    let tooltipTimeout=Number.isFinite(persisted.tooltipTimeout)?persisted.tooltipTimeout:2500;
    let tooltipDelay=Number.isFinite(persisted.tooltipDelay)?Math.max(0,persisted.tooltipDelay):TOOLTIP_DEFAULT_DELAY;
    let paused=!!persisted.paused;
    let sectionsCollapsed={...(persisted.sectionsCollapsed||{})};
    let routingFilters={detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:false,channel:null,...(persisted.routingFilters||{})};
    let pinnedPerf=Array.isArray(persisted.pinnedPerf)?pinnedPerf.slice():[];
    let watchRoutes=Array.isArray(persisted.watchRoutes)?persisted.watchRoutes.slice():[];
    let verboseFlags=!!persisted.verboseFlags;
    let silentMode=!!persisted.silentMode;
    let selectedProfile=persisted.selectedProfile||'Custom';
    let perfThresholds=(persisted.perfThresholds && typeof persisted.perfThresholds==='object')?{...persisted.perfThresholds}:{};

    /* ---------- Event Bus ---------- */
    const handlers=new Map();
    function on(ev,fn){if(!handlers.has(ev)) handlers.set(ev,new Set()); handlers.get(ev).add(fn);}
    function off(ev,fn){handlers.get(ev)?.delete(fn);}
    function emit(ev,payload){const set=handlers.get(ev); if(set) for(const fn of set){try{fn(payload);}catch(e){console.warn('[hud.emit]',ev,e);}}}

    /* ---------- Utils ---------- */
    function hudInfo(...a){ if(!silentMode) console.info('[hud]',...a); }
    function savePersistence(){
      persistHud({
        position:dragPos,collapsed,interval:hudInterval,tooltipTimeout,
        tooltipDelay,paused,sectionsCollapsed,routingFilters,pinnedPerf,
        watchRoutes,verboseFlags,silentMode,selectedProfile,perfThresholds
      });
    }
    function fmtNum(n){
      if(n==null||!Number.isFinite(n)) return '';
      if(Math.abs(n)>=1000) return n.toFixed(0);
      if(Math.abs(n)>=10) return n.toFixed(1);
      return n.toFixed(2);
    }

    /* ---------- Snapshot ---------- */
    let lastSnapshot=null;
    function safeRoutes(){try{return dev.dumpRoutes(undefined,{silent:true})||[];}catch{return[];}}
    function buildRoutesById(routesRaw){
      const m={};
      routesRaw.forEach(r=>{
        const id=r.id; if(!id) return;
        m[id]={
          id,
            eff:r['data-cblcars-route-effective']||'',
          grid:r['data-cblcars-route-grid-status']||'',
          reason:r['data-cblcars-route-grid-reason']||'',
          det:r['data-cblcars-route-detour']==='true',
          miss:r['data-cblcars-route-channels-miss']==='true',
          channelsHit:r['data-cblcars-route-channels-hit']||'',
          distCost:+r['data-cblcars-route-cost-distance']||null,
          bendCost:+r['data-cblcars-route-cost-bends']||null,
          totalCost:+r['data-cblcars-route-cost-total']||null,
          bends:(r['data-cblcars-route-cost-bends']!=null?
            (+r['data-cblcars-route-cost-bends'])/
            ((window.cblcars.routing?.inspect(id)?.cost?.bendWeight)||12):null),
          resolution:parseFirstRes(r['data-cblcars-route-grid-attempts']),
          attrs:r
        };
      });
      return m;
    }
    function parseFirstRes(attempts){
      if(!attempts) return '';
      const first=attempts.split(',')[0];
      return first.split(':')[0];
    }
    function summarizeRoutes(list){
      let total=0,det=0,fb=0,gSucc=0,miss=0;
      list.forEach(r=>{
        total++;
        if(r['data-cblcars-route-detour']==='true') det++;
        const gs=r['data-cblcars-route-grid-status'];
        if(gs==='fallback') fb++;
        else if(gs==='success') gSucc++;
        if(r['data-cblcars-route-channels-miss']==='true') miss++;
      });
      return {total,detours:det,gridFb:fb,gridSucc:gSucc,miss};
    }
    function collectAnchors(){
      try{
        const card=dev._activeCard;
        const msd=card?._config?.variables?.msd||{};
        const map=msd.anchors||msd._anchors||{};
        return Object.entries(map).map(([id,pt])=>({id,x:pt[0],y:pt[1]}));
      }catch{return[];}
    }
    function collectOverlaysBasic(){
      try{
        const card=dev._activeCard; if(!card) return [];
        const root=card.shadowRoot;
        const cfg=(card._config?.variables?.msd?.overlays)||[];
        const val=root?.__cblcars_validationById||{};
        const out=[];
        cfg.forEach(o=>{
          if(!o||!o.id) return;
          const meta=val[o.id]||{errors:[],warnings:[]};
          out.push({
            id:o.id,type:o.type||'',
            hasErrors:meta.errors?.length>0,
            hasWarnings:meta.warnings?.length>0
          });
        });
        return out;
      }catch{return[];}
    }
    function overlaysSummary(list){
      const types={}; let e=0,w=0;
      list.forEach(o=>{
        types[o.type]=(types[o.type]||0)+1;
        if(o.hasErrors) e++;
        if(o.hasWarnings) w++;
      });
      return {total:list.length,types,withErrors:e,withWarnings:w};
    }
    function anchorsSummary(list){return {count:list.length};}
    function ensureActiveCard(){
      try{
        if(dev._activeCard && dev._activeCard.isConnected) return;
        const cards=dev.discoverMsdCards(true);
        if(cards.length===1) dev._activeCard=cards[0];
        else if(dev.persistedState?.activeCardIndex!=null && cards[dev.persistedState.activeCardIndex])
          dev._activeCard=cards[dev.persistedState.activeCardIndex];
      }catch{}
    }
    function perfTimers(){try{return window.cblcars.debug?.perf?.get()||{};}catch{return{};}}
    function perfCounters(){try{return window.cblcars.perfDump?window.cblcars.perfDump():window.cblcars.perf?.dump?.()||{};}catch{return{};}}
    function channelsOcc(){try{return window.cblcars.routing?.channels?.getOccupancy?.()||{};}catch{return{};}}
    function buildSnapshot(){
      if(!customElements.get('cb-lcars-msd-card')){
        const ts=Date.now();
        const empty={
          schemaVersion:SNAPSHOT_SCHEMA_VERSION,
          timestamp:ts,
          timestampIso:new Date(ts).toISOString(),
          routesRaw:[],
          routesById:{},
          routesSummary:{total:0,detours:0,gridFb:0,gridSucc:0,miss:0},
          perfTimers:perfTimers(),
          perfCounters:perfCounters(),
          scenarioResults:dev._scenarioResults||[],
          channels:{},
          overlaysBasic:[],
          overlaysSummary:{total:0,types:{},withErrors:0,withWarnings:0},
          anchors:[],
          anchorsSummary:{count:0},
          validation:{counts:null},
          flags:window.cblcars._debugFlags||{},
          previous:null,
          capabilities:['routes','overlays','anchors','perf','scenarios'],
          overlaysRaw:[],
          buildMs:0
        };
        lastSnapshot=empty;
        return empty;
      }
      ensureActiveCard();
      const t0=performance.now();
      const routesRaw=safeRoutes();
      const snapshot={
        schemaVersion:SNAPSHOT_SCHEMA_VERSION,
        timestamp:Date.now(),
        timestampIso:new Date().toISOString(),
        routesRaw,
        routesById:buildRoutesById(routesRaw),
        routesSummary:summarizeRoutes(routesRaw),
        perfTimers:perfTimers(),
        perfCounters:perfCounters(),
        scenarioResults:dev._scenarioResults||[],
        channels:channelsOcc(),
        overlaysBasic:collectOverlaysBasic(),
        overlaysSummary:null,
        anchors:collectAnchors(),
        anchorsSummary:null,
        validation:(()=>{
          try{
            const root=dev._activeCard?.shadowRoot;
            return {counts:root?.__cblcars_validationCounts||null};
          }catch{return null;}
        })(),
        flags:window.cblcars._debugFlags||{},
        previous:lastSnapshot?{
          routesById:lastSnapshot.routesById,
          perfTimers:lastSnapshot.perfTimers,
          perfCounters:lastSnapshot.perfCounters,
          channels:lastSnapshot.channels
        }:null,
        capabilities:['routes','overlays','anchors','perf','scenarios'],
        overlaysRaw:null,
        buildMs:0
      };
      snapshot.overlaysSummary=overlaysSummary(snapshot.overlaysBasic);
      snapshot.anchorsSummary=anchorsSummary(snapshot.anchors);
      snapshot.overlaysRaw=snapshot.overlaysBasic;
      snapshot.buildMs=performance.now()-t0;
      lastSnapshot=snapshot;
      return snapshot;
    }

    /* ---------- Perf Thresholds ---------- */
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

    /* ---------- Panels Registry ---------- */
    const panels=new Map();
    function registerPanel(meta){
      if(!meta||!meta.id||panels.has(meta.id)) return;
      panels.set(meta.id,{meta,instance:null});
      if(frameReady) renderPanelsShell();
    }
    hudNS.registerPanel=registerPanel;
    (hudNS._pendingPanels||[]).forEach(fn=>{try{fn();}catch(e){console.warn('[hud.panel.init]',e);}});
    hudNS._pendingPanels=[];

    /* ---------- Frame ---------- */
    let frameReady=false;
    function ensureFrame(){
      let panel=document.getElementById(HUD_ID);
      if(!panel){
        panel=document.createElement('div');
        panel.id=HUD_ID;
        document.body.appendChild(panel);
      }
      styleFrame(panel);
      panel.innerHTML=buildFrameHtml();
      wireFrame(panel);
      ensureCss();
      frameReady=true;
      renderPanelsShell();
      initTooltip(panel);
    }
    function styleFrame(panel){
      Object.assign(panel.style,{
        position:'fixed',
        top:dragPos?dragPos[1]+'px':'14px',
        left:dragPos?dragPos[0]+'px':'',
        right:dragPos?'':'14px',
        zIndex:HUD_Z,
        boxShadow:'0 3px 16px rgba(0,0,0,0.70)',
        font:'12px/1.35 monospace',
        color:'#ffd5ff',
        background:'transparent',
        maxWidth:'840px',
        minWidth:'360px',
        isolation:'isolate'
      });
    }
    function buildFrameHtml(){
      const cards=dev.discoverMsdCards(true);
      const activeIndex=cards.indexOf(dev._activeCard);
      return `
        <div data-hdr style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;cursor:move;
          background:linear-gradient(90deg,#330046,#110014);padding:6px 8px;
          border:1px solid #ff00ff;border-radius:6px 6px 0 0;border-bottom:none;">
          <strong style="flex:1;font-size:12px;">LCARS Dev HUD ${HUD_VERSION}</strong>
          <select data-card-pick style="font-size:10px;max-width:160px;">
            ${cards.map((c,i)=>`<option value="${i}" ${i===activeIndex?'selected':''}>Card ${i}${c===dev._activeCard?' *':''}</option>`).join('')}
          </select>
          <div data-quick-flags style="display:flex;gap:3px;"></div>
          <button data-profile style="font-size:11px;" data-tip="Profiles">${selectedProfile}</button>
          <button data-silent style="font-size:11px;" data-tip="Silent Mode">${silentMode?'Silent✓':'Silent'}</button>
          <button data-pause style="font-size:11px;" data-tip="Pause/Resume">${paused?'Resume':'Pause'}</button>
          <button data-collapse style="font-size:11px;" data-tip="Collapse HUD">${collapsed?'▢':'▣'}</button>
          <button data-close style="font-size:11px;" data-tip="Disable HUD">✕</button>
        </div>
        <div data-toolbar style="${collapsed?'display:none;':''};background:rgba(30,0,50,0.50);
          border:1px solid #ff00ff;border-top:none;border-bottom:1px solid #552266;
          padding:4px 8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
          <span style="font-size:10px;opacity:.65;">Interval</span>
          <input data-int type="number" min="250" step="250" value="${hudInterval}" style="width:70px;font-size:10px;">
          <span style="font-size:10px;opacity:.65;">TT(ms)</span>
          <input data-tt-to type="number" min="0" step="250" value="${tooltipTimeout}" style="width:70px;font-size:10px;">
          <span style="font-size:10px;opacity:.65;">Delay</span>
          <input data-tt-delay type="number" min="0" step="50" value="${tooltipDelay}" style="width:60px;font-size:10px;">
          <button data-refresh style="font-size:10px;">↻</button>
        </div>
        <div data-body style="${collapsed?'display:none;':''};background:rgba(20,0,30,0.90);
          border:1px solid #ff00ff;border-top:none;border-radius:0 0 6px 6px;
          max-height:70vh;overflow:auto;padding:6px 8px;">
          <div data-panels style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>
        <div id="cblcars-hud-tooltip"></div>`;
    }
    function renderQuickFlags(){
      const c=document.getElementById(HUD_ID)?.querySelector('[data-quick-flags]');
      if(!c) return;
      c.innerHTML='';
      const flags=window.cblcars._debugFlags||{};
      QUICK_FLAG_KEYS.forEach(k=>{
        const btn=document.createElement('button');
        btn.style.cssText='font-size:10px;padding:2px 5px;border:1px solid #552266;border-radius:4px;cursor:pointer;';
        btn.textContent=verboseFlags?k:k[0].toUpperCase();
        btn.setAttribute('data-tip',k);
        btn.style.background=flags[k]?'#ff00ff':'#2d003d';
        btn.style.color=flags[k]?'#120018':'#ffd5ff';
        btn.addEventListener('click',()=>{
          const next=!flags[k];
          dev.flags({[k]:next});
          if(selectedProfile!=='Custom'){
            selectedProfile='Custom';
            persistHud({selectedProfile});
          }
          savePersistence();
          renderQuickFlags();
          emit('flags:changed',window.cblcars._debugFlags);
        });
        c.appendChild(btn);
      });
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
          persistHud({selectedProfile:p,flags:window.cblcars._debugFlags});
          emit('flags:changed',window.cblcars._debugFlags);
        }else selectedProfile='Custom';
        persistHud({selectedProfile});
        menu.remove();
        renderQuickFlags();
      });
      document.addEventListener('pointerdown',function once(ev){
        if(!menu.contains(ev.target)){try{menu.remove();}catch{} document.removeEventListener('pointerdown',once,true);}
      },true);
    }
    function wireFrame(panel){
      const hdr=panel.querySelector('[data-hdr]');
      let dragging=false,startX=0,startY=0,origX=0,origY=0;
      hdr.addEventListener('mousedown',e=>{
        if(e.button!==0) return;
        dragging=true; startX=e.clientX; startY=e.clientY;
        const r=panel.getBoundingClientRect(); origX=r.left; origY=r.top;
        document.addEventListener('mousemove',onMove);
        document.addEventListener('mouseup',onUp,{once:true});
        e.preventDefault();
      });
      function onMove(e){
        if(!dragging) return;
        panel.style.left=(origX+(e.clientX-startX))+'px';
        panel.style.top=(origY+(e.clientY-startY))+'px';
        panel.style.right='';
      }
      function onUp(){
        dragging=false;
        document.removeEventListener('mousemove',onMove);
        const r=panel.getBoundingClientRect();
        dragPos=[r.left,r.top];
        savePersistence();
      }
      panel.querySelector('[data-close]').addEventListener('click',()=>{
        persistHud({enabled:false});
        removeHud();
      });
      panel.querySelector('[data-collapse]').addEventListener('click',()=>{
        collapsed=!collapsed; savePersistence();
        panel.querySelector('[data-collapse]').textContent=collapsed?'▢':'▣';
        panel.querySelector('[data-body]').style.display=collapsed?'none':'block';
        panel.querySelector('[data-toolbar]').style.display=collapsed?'none':'flex';
      });
      panel.querySelector('[data-refresh]').addEventListener('click',()=>refresh(true,true));
      panel.querySelector('[data-int]').addEventListener('change',e=>{
        const v=parseInt(e.target.value,10);
        if(Number.isFinite(v)&&v>=250){hudInterval=v; savePersistence(); resetInterval();}
      });
      panel.querySelector('[data-tt-to]').addEventListener('change',e=>{
        const v=parseInt(e.target.value,10);
        tooltipTimeout=Math.max(0,v||0); savePersistence();
        tooltipApi.updateConfig({timeout:tooltipTimeout});
      });
      panel.querySelector('[data-tt-delay]').addEventListener('change',e=>{
        const v=parseInt(e.target.value,10);
        tooltipDelay=Math.max(0,v||0); savePersistence();
        tooltipApi.updateConfig({delay:tooltipDelay});
      });
      panel.querySelector('[data-pause]').addEventListener('click',e=>{
        paused=!paused; savePersistence();
        e.target.textContent=paused?'Resume':'Pause';
        if(!paused){refresh(true,true); resetInterval(); bootstrapWarmup();}
      });
      panel.querySelector('[data-silent]').addEventListener('click',e=>{
        silentMode=!silentMode; savePersistence();
        e.target.textContent=silentMode?'Silent✓':'Silent';
      });
      panel.querySelector('[data-profile]').addEventListener('click',()=>showProfilesMenu(panel));
      panel.querySelector('[data-card-pick]').addEventListener('change',e=>{
        const idx=parseInt(e.target.value,10);
        dev.pick(idx);
        setTimeout(()=>refresh(true,true),40);
      });
      renderQuickFlags();
    }
    function ensureCss(){
      if(!document.getElementById('cblcars-dev-hud-extra-css')){
        const style=document.createElement('style');
        style.id='cblcars-dev-hud-extra-css';
        style.textContent=`
          .hud-delta-pos{color:#77ff90;}
          .hud-delta-neg{color:#ff6688;}
          .hud-badge-perf{background:#ff004d;color:#fff;padding:0 6px;border-radius:10px;font-size:10px;margin-left:4px;}
        `;
        document.head.appendChild(style);
      }
      if(document.getElementById('cblcars-dev-hud-css')) return;
      if(!window.cblcars.hud._externalCssLoaded){
        const link=document.createElement('link');
        link.id='cblcars-dev-hud-css'; link.rel='stylesheet';
        link.href='/hacsfiles/cblcars/cb-lcars-dev-hud.css';
        link.addEventListener('error',()=>inlineFallback());
        link.addEventListener('load',()=>{window.cblcars.hud._externalCssLoaded=true;});
        document.head.appendChild(link);
        setTimeout(()=>{
          if(!window.cblcars.hud._externalCssLoaded) inlineFallback();
        },1200);
      }
      function inlineFallback(){
        if(document.getElementById('cblcars-dev-hud-inline-css')) return;
        const style=document.createElement('style');
        style.id='cblcars-dev-hud-inline-css';
        style.textContent=`.hud-flash{animation:hudFlash .55s ease-out;}
@keyframes hudFlash{0%{background:rgba(255,0,255,0.3);}100%{background:transparent;}}
[data-panel] table td,[data-panel] table th{padding:2px 4px;}
`;
        document.head.appendChild(style);
      }
    }

    /* ---------- Panels Shell ---------- */
    function renderPanelsShell(){
      const container=document.getElementById(HUD_ID)?.querySelector('[data-panels]');
      if(!container) return;
      const existing=new Set();
      [...panels.values()]
        .sort((a,b)=>(a.meta.order||99999)-(b.meta.order||99999))
        .forEach(entry=>{
          existing.add(entry.meta.id);
          let wrapper=container.querySelector(`[data-panel="${entry.meta.id}"]`);
          if(!wrapper){
            wrapper=document.createElement('div');
            wrapper.setAttribute('data-panel',entry.meta.id);
            wrapper.style.cssText='border:1px solid #552266;border-radius:4px;background:rgba(40,0,60,0.45);display:flex;flex-direction:column;';
            wrapper.innerHTML=`
              <div data-h style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:linear-gradient(90deg,#440066,#220022);cursor:pointer;font-size:11px;">
                <span data-c style="opacity:.8;">▾</span>
                <span data-t style="flex:1;">${entry.meta.title||entry.meta.id}</span>
                <span data-b style="font-size:10px;opacity:.75;"></span>
              </div>
              <div data-body style="padding:6px 8px;display:${sectionsCollapsed[entry.meta.id]?'none':'block'};"></div>`;
            container.appendChild(wrapper);
            wrapper.querySelector('[data-h]').addEventListener('click',()=>{
              sectionsCollapsed[entry.meta.id]=!sectionsCollapsed[entry.meta.id];
              savePersistence();
              wrapper.querySelector('[data-body]').style.display=sectionsCollapsed[entry.meta.id]?'none':'block';
              wrapper.querySelector('[data-c]').textContent=sectionsCollapsed[entry.meta.id]?'▸':'▾';
            });
          }
          if(!entry.instance && !sectionsCollapsed[entry.meta.id]){
            try{
              const ctx={hudApi,dev,definitions:DEFINITIONS,utils:window.cblcars.hud.utils};
              const ret=entry.meta.render(ctx);
              entry.instance={refresh:ret.refresh||(()=>{}),el:ret.rootEl||wrapper.querySelector('[data-body]')};
              if(ret.rootEl && ret.rootEl!==wrapper.querySelector('[data-body]')){
                const bd=wrapper.querySelector('[data-body]');
                bd.innerHTML=''; bd.appendChild(ret.rootEl);
              }
            }catch(e){
              wrapper.querySelector('[data-body]').innerHTML=`<div style="color:#ff4d78;">Panel error: ${e.message||e}</div>`;
            }
          }
        });
      container.querySelectorAll('[data-panel]').forEach(p=>{
        const id=p.getAttribute('data-panel');
        if(!existing.has(id)) p.remove();
      });
    }
    function updatePanelBadges(snapshot){
      const container=document.getElementById(HUD_ID)?.querySelector('[data-panels]');
      if(!container) return;
      panels.forEach(entry=>{
        const wrap=container.querySelector(`[data-panel="${entry.meta.id}"]`);
        if(!wrap) return;
        const badge=wrap.querySelector('[data-b]');
        if(!badge) return;
        try{badge.textContent=entry.meta.badge?(entry.meta.badge(snapshot)||''):'';}catch{badge.textContent='';}
      });
    }

    /* ---------- Refresh Loop ---------- */
    let refreshTimer=null;
    function resetInterval(){
      if(refreshTimer) clearInterval(refreshTimer);
      if(!paused) refreshTimer=setInterval(()=>refresh(),hudInterval);
    }
    function refresh(forcePersist=false,allowWhilePaused=false){
      if(paused && !allowWhilePaused){
        if(!lastSnapshot){
          const snap=buildSnapshot();
          renderPanelsShell();
          panels.forEach(p=>{try{p.instance?.refresh(snap);}catch{}});
        }
        return;
      }
      const snapshot=buildSnapshot();
      renderPanelsShell();
      panels.forEach(p=>{
        if(sectionsCollapsed[p.meta.id]) return;
        try{p.instance?.refresh(snapshot);}catch(e){console.warn('[hud.panel.refresh]',p.meta.id,e);}
      });
      updatePanelBadges(snapshot);
      if(forcePersist) savePersistence();
      emit('refresh:snapshot',snapshot);
    }

    /* ---------- Tooltip ---------- */
    let tooltipApi={updateConfig:()=>{}};
    function initTooltip(panel){
      tooltipApi=window.cblcars.hud.tooltip.init(panel,{delay:tooltipDelay,timeout:tooltipTimeout});
    }

    /* ---------- Warmup ---------- */
    function bootstrapWarmup(){
      if(lastSnapshot && lastSnapshot.routesSummary.total>0) return;
      let warmStart=performance.now();
      (function loop(){
        if(paused) return;
        if(lastSnapshot && lastSnapshot.routesSummary.total>0) return;
        refresh(false,true);
        if(performance.now()-warmStart<20000) setTimeout(loop,500);
      })();
    }

    /* ---------- DOM Observer ---------- */
    function startDomObserver(){
      const mo=new MutationObserver(()=>{
        if(paused) return;
        if(!lastSnapshot || lastSnapshot.routesSummary.total===0) refresh(false,true);
      });
      mo.observe(document.documentElement,{childList:true,subtree:true});
      setTimeout(()=>mo.disconnect(),15000);
    }

    /* ---------- HUD API ---------- */
    function currentSnapshot(){return lastSnapshot;}
    const hudApi={
      on,off,emit,
      status(){
        return {
          version:HUD_VERSION,paused,interval:hudInterval,
          pinnedPerf:pinnedPerf.slice(),watchRoutes:watchRoutes.slice(),
          routingFilters:{...routingFilters},verboseFlags,perfThresholds:{...perfThresholds}
        };
      },
      pause(){if(!paused){paused=true;savePersistence();}},
      resume(){if(paused){paused=false;savePersistence();resetInterval();refresh(true,true);bootstrapWarmup();}},
      isPaused:()=>paused,
      refreshRaw:(opts={})=>refresh(!!opts.persist,!!opts.allowWhilePaused),
      setRoutingFilters(patch){Object.assign(routingFilters,patch||{}); savePersistence();},
      getRoutingFilters:()=>({...routingFilters}),
      pinPerf(id){if(!pinnedPerf.includes(id)){pinnedPerf.push(id); savePersistence();}},
      unpinPerf(id){pinnedPerf=pinnedPerf.filter(x=>x!==id); savePersistence();},
      clearPinnedPerf(){pinnedPerf=[]; savePersistence();},
      watchRoute(id){if(!watchRoutes.includes(id)){watchRoutes.push(id); savePersistence();}},
      unwatchRoute(id){watchRoutes=watchRoutes.filter(x=>x!==id); savePersistence();},
      clearWatchRoutes(){watchRoutes=[]; savePersistence();},
      getWatchRoutes:()=>watchRoutes.slice(),
      setPerfThreshold(id,vals){
        if(!id) return;
        if(!vals || (vals.avgMs==null && vals.lastMs==null)) delete perfThresholds[id];
        else {
          const cur=perfThresholds[id]||{};
          perfThresholds[id]={...cur,...vals};
        }
        savePersistence();
      },
      removePerfThreshold(id){ delete perfThresholds[id]; savePersistence(); },
      getPerfThresholds:()=>({...perfThresholds}),
      exportSnapshot(){
        try{
          const snap=currentSnapshot()||buildSnapshot();
          const enriched={
            schema_version:SNAPSHOT_SCHEMA_VERSION,
            hud_version:HUD_VERSION,
            build_ms:snap.buildMs,
            refresh_interval:hudInterval,
            paused,
            pinnedPerf,
            perfThresholds,
            snapshot:snap
          };
          const blob=new Blob([JSON.stringify(enriched,null,2)],{type:'application/json'});
          const url=URL.createObjectURL(blob);
          const a=document.createElement('a');
          a.href=url; a.download='lcars-hud-snapshot-'+(snap.timestamp||Date.now())+'.json';
          document.body.appendChild(a); a.click();
          setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},400);
        }catch(e){console.warn('[hud.exportSnapshot]',e);}
      },
      currentSnapshot,
      setVerboseFlags(v){verboseFlags=!!v;savePersistence();renderQuickFlags();},
      toggleFlagLabelVerbosity(){verboseFlags=!verboseFlags;savePersistence();renderQuickFlags();},
      applyProfile(name){
        if(!FLAG_PROFILES[name]) return;
        dev.flags(FLAG_PROFILES[name]);
        selectedProfile=name; savePersistence();
        renderQuickFlags(); emit('flags:changed',window.cblcars._debugFlags);
      },
      currentBuildVersion:()=>HUD_VERSION,
      _collectPerfViolations:collectPerfViolations
    };
    hudNS.api=hudApi;

    /* ---------- Startup ---------- */
    ensureFrame();
    if(persisted.enabled!==false){
      refresh(true,true);
      resetInterval();
      bootstrapWarmup();
      startDomObserver();
    }
    hudInfo('[hud.core] attached',HUD_VERSION);
  }
})();