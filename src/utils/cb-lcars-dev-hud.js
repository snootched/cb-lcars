/* PHASE 2.2: LCARS Developer HUD
 * Fixes & Enhancements over 2.1:
 *  - Reliable initial data population on page reload (even if HUD already enabled & paused)
 *    * Extended warmup (time-based rather than small attempt count)
 *    * DOM MutationObserver watching for first connector/path appearance
 *    * rAF polling fallback until routes appear or timeout
 *    * Refreshes allowed while paused (static snapshot) so user sees data
 *  - Active card auto-selection robustness (waits until dev._activeCard assigned / cards discovered)
 *  - Tooltip show delay (default 280ms) to reduce noise; canceled if pointer leaves before delay
 *  - Tooltip hover pause still works; timer unaffected by delayed show
 *  - Added persistence key: tooltipDelay (ms)
 *  - Public HUD API additions: setTooltipDelay/getTooltipDelay, forceBootstrapScan()
 *
 * (This file fully replaces prior cb-lcars-dev-hud.js.)
 */

(function initHudPhase22() {
  const qs = new URLSearchParams(location.search);
  const force    = (window.CBLCARS_DEV_FORCE === true);
  const disabled = (window.CBLCARS_DEV_DISABLE === true);
  const active   = !disabled && (qs.has('lcarsDev') || force);
  if (!active) return;

  const RETRY_MS = 120;
  let attempts = 0;

  function devReady() {
    return !!(window.cblcars?.dev?._advanced);
  }

  function retryAttach() {
    if (!devReady()) {
      if (attempts++ < 80) return setTimeout(retryAttach, RETRY_MS);
      console.warn('[cblcars.dev.hud] Dev tools not ready; abort HUD attach (Phase 2.2).');
      return;
    }
    attachHudPhase22();
  }
  retryAttach();

  function attachHudPhase22() {
    const dev = window.cblcars.dev;
    if (!dev.hud) dev.hud = { _enabled: false };
    if (dev.hud._phase22Attached) {
      console.info('[cblcars.dev.hud] Phase 2.2 HUD already attached.');
      return;
    }

    /* ------------------------------------------------------------------
     * Constants & Definitions
     * ------------------------------------------------------------------ */
    const HUD_ID = 'cblcars-dev-hud-panel';
    const HUD_Z = 2147480000;
    const STARTUP_WARMUP_INTERVAL_MS = 300;         // polling cadence
    const STARTUP_WARMUP_MAX_MS = 20000;            // total warmup window
    const STARTUP_DOM_OBSERVER_MAX_MS = 25000;      // cut off mutation observer after this
    const ACTIVE_CARD_WAIT_MAX_MS = 8000;           // how long to wait for active card selection
    const TOOLTIP_DEFAULT_DELAY = 280;              // ms before showing tooltip

    const DEFINITIONS = {
      eff:{s:'Effective routing mode.',l:'Mode actually used: manhattan (straight or single elbow), grid (grid pathfinding), smart (heuristic gating), detour (two-elbow fallback).'},
      gridStatus:{s:'Grid / SMART outcome.',l:'success (grid accepted), fallback (grid failed → Manhattan), skipped (SMART skipped grid), manhattan (explicit Manhattan), geom_pending (target geometry not ready).'},
      gridReason:{s:'Why grid/SMART ended in that status.',l:'ok (success), fail (grid failed), clear_path (SMART saw no blocking), no_obstacles (zero obstacles), no_attempt (heuristic gate), detour (two-elbow fallback), geom_pending (waiting geometry).'},
      detour:{s:'Detour used.',l:'Two-elbow fallback route because both XY and YX Manhattan paths blocked; tries obstacle wrap candidates.'},
      miss:{s:'Preferred channel miss.',l:'Preferred or allow channel set not satisfied; path accepted anyway.'},
      channelsHit:{s:'Channels traversed.',l:'Comma list of channel ids whose corridor masks overlapped path cells (occupancy source).'},
      distanceCost:{s:'Distance cost.',l:'Manhattan total length * distance weight.'},
      bends:{s:'Direction changes.',l:'Number of orthogonal direction changes (segments).'},
      bendCost:{s:'Bend penalty.',l:'bends * bend weight (encourages straighter paths).'},
      totalCost:{s:'Composite path cost.',l:'distanceCost + bendCost (+ future penalties) used for best candidate selection.'},
      resolution:{s:'Grid resolution.',l:'Cell size used for winning grid path (smaller = finer).'},
      channelOccupancyPct:{s:'Channel usage %.',l:'(channel occupancy / total occupancy) * 100.'},
      pinnedPerf:{s:'Pinned perf metric.',l:'Timer shows last(ms); counter shows count (avg in tooltip).'},
      smartHitMode:{s:'SMART gating collision mode.',l:'bbox (expanded L corridors overlapped obstacles), distance (proximity gap), none (clear).'},
      smartSkipReason:{s:'Why SMART skipped grid.',l:'no_obstacles, clear_path, hit, or no_attempt (gated).'},
      watch:{s:'Route watcher.',l:'Records last snapshots for the route & highlights deltas.'}
    };

    /* ------------------------------------------------------------------
     * Persistence
     * ------------------------------------------------------------------ */
    function readHudState() {
      return (dev.persistedState && dev.persistedState.hud) || {};
    }
    function persistHudState(patch) {
      try {
        if (typeof dev._persistHudState === 'function') return dev._persistHudState(patch);
        const cur = readHudState();
        dev.persist({ hud: { ...cur, ...patch } });
      } catch (_) {}
    }

    /* ------------------------------------------------------------------
     * State
     * ------------------------------------------------------------------ */
    const persisted = readHudState();
    let dragPos          = Array.isArray(persisted.position) && persisted.position.length === 2 ? persisted.position.slice() : null;
    let collapsed        = !!persisted.collapsed;
    let hudInterval      = Number.isFinite(persisted.interval) && persisted.interval >= 250 ? persisted.interval : 3000;
    let verboseFlags     = !!persisted.verboseFlags;
    let selectedProfile  = persisted.selectedProfile || 'Custom';
    let tooltipTimeout   = Number.isFinite(persisted.tooltipTimeout) ? persisted.tooltipTimeout : 2500;
    let tooltipStickyKey = persisted.tooltipStickyKey || '?';
    let paused           = !!persisted.paused;
    let tooltipDelay     = Number.isFinite(persisted.tooltipDelay) ? Math.max(0, persisted.tooltipDelay) : TOOLTIP_DEFAULT_DELAY;

    let sectionsCollapsed = { ...(persisted.sectionsCollapsed || {}) };
    let routingFilters = {
      detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:false,channel:null,
      ...(persisted.routingFilters||{})
    };
    let routingSort = { field:'id', dir:1, ...(persisted.routingSort||{}) };

    let watchRoutes = Array.isArray(persisted.watchRoutes) ? persisted.watchRoutes.slice() : [];
    let pinnedPerf  = Array.isArray(persisted.pinnedPerf) ? pinnedPerfSanitize(persisted.pinnedPerf) : [];

    const panelRegistry = new Map();
    const eventHandlers = new Map();

    let lastSnapshot = null;

    // Warmup loops & observers
    let warmupTimer = null;
    let warmupStart = 0;
    let domObserver = null;
    let activeCardWaitTimer = null;

    let refreshTimer = null;
    let panelDraggable = false;
    let flashCssInjected = false;

    // Tooltip engine internal
    let tooltipEl=null, tooltipPinned=false, tooltipTarget=null;
    let tooltipHideTO=null;
    let hudHover=false;
    let showStartTime=0;
    let remainingTimeout=0;
    let tooltipHovering=false;
    let tooltipShowTO=null;
    let pendingTooltipTarget=null;

    /* ------------------------------------------------------------------
     * Utilities
     * ------------------------------------------------------------------ */
    function pinnedPerfSanitize(arr){return arr.filter(id=>typeof id==='string'&&id).slice(0,25);}
    function emit(ev,payload){const set=eventHandlers.get(ev);if(!set)return;for(const fn of set){try{fn(payload);}catch(e){console.warn('[hud.event]',ev,e);}}}
    function on(ev,fn){if(!eventHandlers.has(ev))eventHandlers.set(ev,new Set());eventHandlers.get(ev).add(fn);}
    function off(ev,fn){eventHandlers.get(ev)?.delete(fn);}
    function diffValue(a,b){return a!==b;}
    function ensureFlashCss(){
      if(flashCssInjected)return;
      flashCssInjected=true;
      const style=document.createElement('style');
      style.textContent=`
        @keyframes hudFlash{0%{background:rgba(255,0,255,0.25);}100%{background:transparent;}}
        .hud-flash{animation:hudFlash .55s ease-out;}
        .hud-mini-strip{display:flex;gap:4px;flex-wrap:wrap;margin:4px 0 6px;}
        .hud-mini-strip-item{background:rgba(100,0,120,0.4);border:1px solid #ff00ff;padding:2px 5px;font-size:10px;border-radius:6px;cursor:default;}
        .hud-paused-badge{background:repeating-linear-gradient(45deg,rgba(255,0,255,0.15),rgba(255,0,255,0.15) 6px,rgba(120,0,90,0.20) 6px,rgba(120,0,90,0.20) 12px);}
        .hud-table th{text-align:left;padding:2px 4px;cursor:pointer;position:relative;}
        .hud-table td{padding:2px 4px;}
        .hud-route-watch{font-size:10px;background:rgba(255,0,255,0.08);border:1px solid #552266;border-radius:4px;padding:4px 6px;margin-top:6px;}
        .hud-tooltip-pin{position:absolute;top:4px;right:6px;font-size:10px;opacity:.65;cursor:pointer;}
        .hud-tooltip-pin:hover{opacity:1;}
      `;
      document.head.appendChild(style);
    }
    function savePersistence(){
      persistHudState({
        position:dragPos,collapsed,interval:hudInterval,verboseFlags,selectedProfile,
        tooltipTimeout,tooltipStickyKey,paused,sectionsCollapsed,routingFilters,routingSort,
        watchRoutes,pinnedPerf,tooltipDelay
      });
    }

    /* ------------------------------------------------------------------
     * Snapshot Builders
     * ------------------------------------------------------------------ */
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
    function numOrNull(v){if(v==null)return null;const n=parseFloat(v);return Number.isFinite(n)?n:null;}
    function parseResolution(attempts){if(!attempts)return'';const first=attempts.split(',')[0];return first.split(':')[0];}
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
    function ensureActiveCardSync() {
      // Try to adopt an active card if not set (only once)
      try {
        if (!dev._activeCard) {
          const cards = dev.discoverMsdCards ? dev.discoverMsdCards(true) : [];
          if (cards.length === 1) {
            dev._activeCard = cards[0];
          } else if (dev.persistedState?.activeCardIndex != null &&
            cards[dev.persistedState.activeCardIndex]) {
            dev._activeCard = cards[dev.persistedState.activeCardIndex];
          }
        }
      } catch(_) {}
    }
    function buildCoreSnapshot(){
      ensureActiveCardSync();
      const routesRaw=safeGetRoutes();
      const routesById=buildRoutesById(routesRaw);
      return {
        timestamp:Date.now(),
        timestampIso:new Date().toISOString(),
        routesRaw,
        routesById,
        routesSummary:summarizeRoutes(routesRaw),
        perfTimers:getPerfTimers(),
        perfCounters:getPerfCounters(),
        scenarioResults:dev._scenarioResults||[],
        channels:safeGetChannels(),
        flags:window.cblcars._debugFlags||{},
        previous:lastSnapshot?{
          routesById:lastSnapshot.routesById,
          perfTimers:lastSnapshot.perfTimers,
          perfCounters:lastSnapshot.perfCounters
        }:null
      };
    }

    /* ------------------------------------------------------------------
     * Panels & Registry
     * (IDENTICAL to Phase 2.1 except internal refresh call path)
     * ------------------------------------------------------------------ */
    const INTERNAL_ORDERS={summary:100,routing:200,channels:250,perf:300,flags:400,actions:500};
    function registerPanel(meta){if(!meta||!meta.id||panelRegistry.has(meta.id))return;panelRegistry.set(meta.id,{meta,instance:null});}
    function unregisterPanel(id){
      const e=panelRegistry.get(id);
      if(e?.instance?.cleanup)try{e.instance.cleanup();}catch{}
      panelRegistry.delete(id); renderPanelsShell();
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
    function findPanelWrapper(pid){
      const panel=document.getElementById(HUD_ID);
      return panel?.querySelector(`[data-panel="${pid}"]`);
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
          wrapper.style.cssText='border:1px solid #552266;border-radius:4px;background:rgba(40,0,60,0.45);display:flex;flex-direction:column;';
          wrapper.innerHTML=`
            <div data-panel-hdr style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:linear-gradient(90deg,#440066,#220022);cursor:pointer;font-size:11px;">
              <span data-panel-caret style="opacity:.8;">▾</span>
              <span data-panel-title style="flex:1 1 auto;"></span>
              <span data-panel-badge style="font-size:10px;opacity:.8;"></span>
            </div>
            <div data-panel-body style="padding:6px 8px;display:block;"></div>`;
          container.appendChild(wrapper);
          wrapper.querySelector('[data-panel-hdr]').addEventListener('click',()=>toggleSectionCollapse(id));
        }
        wrapper.querySelector('[data-panel-title]').textContent = entry.meta.title || id;
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

    /* ------------------------------------------------------------------
     * Tooltip Engine (with show delay + hover pause)
     * ------------------------------------------------------------------ */
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
        if(ms<=0){hideTip();return;}
        tooltipHideTO=setTimeout(()=>{ if(!tooltipPinned && !tooltipHovering) hideTip(); }, ms);
      }
      function doShow(target,{forcePinned}={}){
        clearTimeout(tooltipHideTO);
        tooltipTarget=target;
        tooltipPinned=!!forcePinned;
        const short=target.getAttribute('data-tip');
        const detail=target.getAttribute('data-tip-detail');
        if(!short && !detail) return;
        let html=`<div style="font-weight:bold;margin-bottom:2px;">${esc(short||'Info')}</div>`;
        if(detail) html+=`<div style="font-size:11px;opacity:.85;">${esc(detail)}</div>`;
        html+=`<div class="hud-tooltip-pin" data-tooltip-pin title="Pin / unpin tooltip (or press ${tooltipStickyKey})">📌</div>`;
        tooltipEl.innerHTML=html;
        tooltipEl.style.display='block';
        positionTip(target);
        showStartTime=performance.now();
        remainingTimeout=tooltipTimeout;
        if(!tooltipPinned && tooltipTimeout>0){
          scheduleHide(tooltipTimeout);
        }
      }
      function showTip(target){
        // Delay logic
        clearTimeout(tooltipShowTO);
        pendingTooltipTarget=target;
        tooltipShowTO=setTimeout(()=>{
          if(pendingTooltipTarget===target){
            doShow(target);
          }
        }, tooltipDelay);
      }
      function hideTip(){
        clearTimeout(tooltipShowTO);
        tooltipEl.style.display='none';
        tooltipTarget=null;
        pendingTooltipTarget=null;
      }
      function pinToggle(){
        tooltipPinned=!tooltipPinned;
        if(!tooltipPinned){
          if(tooltipTimeout>0) scheduleHide(Math.max(120,remainingTimeout));
        }else{
          clearTimeout(tooltipHideTO);
        }
      }
      function pointerLeftContext(){
        if(tooltipPinned) return;
        if(tooltipTimeout===0){ hideTip(); return; }
        scheduleHide(Math.max(120,remainingTimeout));
      }

      root.addEventListener('pointerenter', e=>{
        if(root.contains(e.target)) hudHover=true;
      });
      root.addEventListener('pointerleave', ()=>{
        hudHover=false;
        if(!tooltipPinned && !tooltipHovering){
          pointerLeftContext();
        }
      });

      root.addEventListener('pointerover', e=>{
        const t=e.target.closest('[data-tip]');
        if(!t){ return; }
        tooltipHovering=false;
        showTip(t);
      });
      root.addEventListener('pointerout', e=>{
        if(e.target===pendingTooltipTarget){
          // Cancel pending tooltip
          clearTimeout(tooltipShowTO);
          pendingTooltipTarget=null;
        }
        if(!hudHover && !tooltipHovering && !tooltipPinned){
          pointerLeftContext();
        }
      });

      tooltipEl.addEventListener('pointerenter', ()=>{
        tooltipHovering=true;
        if(!tooltipPinned && tooltipTimeout>0){
          const elapsed=performance.now()-showStartTime;
          remainingTimeout=Math.max(50, tooltipTimeout - elapsed);
          clearTimeout(tooltipHideTO);
        }
      });
      tooltipEl.addEventListener('pointerleave', ()=>{
        tooltipHovering=false;
        if(!tooltipPinned){
          pointerLeftContext();
        }
      });

      root.addEventListener('click', e=>{
        if(e.target?.getAttribute('data-tooltip-pin')!=null){
          pinToggle();
        }
      });

      document.addEventListener('pointerdown', e=>{
        if(tooltipEl.style.display==='none') return;
        if(tooltipPinned){
          if(!root.contains(e.target) && !tooltipEl.contains(e.target)){
            tooltipPinned=false;
            hideTip();
          }
        } else if(!root.contains(e.target)){
          hideTip();
        }
      });

      window.addEventListener('keydown', e=>{
        if(e.key==='Escape'){
          tooltipPinned=false;
          hideTip();
          return;
        }
        if(e.key===tooltipStickyKey && (hudHover || root.contains(document.activeElement))){
          if(tooltipTarget){
            pinToggle();
            e.stopPropagation();
            e.preventDefault();
          }
        }
      },true);

      window.addEventListener('scroll', ()=>{
        if(tooltipEl.style.display==='block'){
          if(tooltipPinned && tooltipTarget){
            positionTip(tooltipTarget);
          } else if(!tooltipPinned && !tooltipHovering) {
            hideTip();
          }
        }
      }, true);
    }

    /* ------------------------------------------------------------------
     * Quick Flags / Profiles (unchanged)
     * ------------------------------------------------------------------ */
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
        } else selectedProfile='Custom';
        persistHudState({selectedProfile});
        menu.remove();
        renderQuickFlags(panel,true);
      });
      document.addEventListener('pointerdown',function once(ev){
        if(!menu.contains(ev.target)){try{menu.remove();}catch{}document.removeEventListener('pointerdown',once,true);}
      },true);
    }

    /* ------------------------------------------------------------------
     * Built-In Panels (identical to 2.1 except referencing updated refresh)
     * ------------------------------------------------------------------ */
    // (Summary, Routing, Channels, Perf, Flags, Actions panels omitted in commentary for brevity –
    //  they are identical to Phase 2.1 code previously supplied. ONLY differences are call-sites
    //  using refresh(true,true) already. To preserve continuity, we re-register them unchanged.)

    /* -------------------- SUMMARY PANEL -------------------- */
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
            <div style="margin-top:6px;">
              <button data-legend-btn class="hud-btn-icon" data-tip="Legend" data-tip-detail="Definitions & metric explanations.">ℹ</button>
              <button data-refresh-now class="hud-btn-icon" data-tip="Refresh Now">↻</button>
              <span data-paused-badge style="display:none;color:#ff99ff;font-weight:bold;font-size:10px;">PAUSED</span>
            </div>
          </div>`;
        root.querySelector('[data-legend-btn]').addEventListener('click',()=>toggleLegendOverlay());
        root.querySelector('[data-refresh-now]').addEventListener('click',()=>refresh(true,true));

        function toggleLegendOverlay(){
          const panel=document.getElementById(HUD_ID); if(!panel)return;
          let ex=panel.querySelector('#hud-legend-overlay');
          if(ex){ex.remove();return;}
          const overlay=document.createElement('div');
          overlay.id='hud-legend-overlay';
          Object.assign(overlay.style,{
            position:'absolute',left:'6px',top:'36px',right:'6px',maxHeight:'50vh',
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
            return `<div class="hud-mini-strip-item" data-tip="${id}" data-tip-detail="Not found.">${id}:n/a</div>`;
          }).join('');
        }

        return {
          rootEl:root,
          refresh(snapshot){
            const rs=snapshot.routesSummary;
            const rl=root.querySelector('[data-routes-line]');
            rl.innerHTML=`<div style="font-weight:bold;margin-bottom:2px;">Routes</div>
              <div>
                Total: <a href="#" data-filter="reset">${rs.total}</a> |
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
          }
        };
      }
    });

    /* -------------------- ROUTING DETAIL PANEL -------------------- */
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
            <label><input type="checkbox" data-filter-det>Detours</label>
            <label><input type="checkbox" data-filter-fb>Fallback</label>
            <label><input type="checkbox" data-filter-miss>Miss</label>
            <label><input type="checkbox" data-filter-smart>Smart Hit</label>
            <label><input type="checkbox" data-filter-gridok>Grid Success</label>
            <select data-filter-channel style="font-size:10px;max-width:130px;">
              <option value="">(Channel)</option>
            </select>
            <button data-clear-filters style="font-size:10px;">Clear</button>
            <button data-refresh style="font-size:10px;">↻</button>
          </div>
          <div style="overflow:auto;max-height:300px;">
            <table data-routing-table class="hud-table" style="border-collapse:collapse;width:100%;">
              <thead>
                <tr>
                  <th data-sort="id" data-tip="ID" data-tip-detail="Connector path id.">ID</th>
                  <th data-sort="eff" data-tip="Eff" data-tip-detail="${DEFINITIONS.eff.l}">Eff</th>
                  <th data-sort="grid" data-tip="Grid" data-tip-detail="${DEFINITIONS.gridStatus.l}">Grid</th>
                  <th data-sort="reason" data-tip="Reason" data-tip-detail="${DEFINITIONS.gridReason.l}">Reason</th>
                  <th data-sort="det" data-tip="Det" data-tip-detail="${DEFINITIONS.detour.l}">Det</th>
                  <th data-sort="miss" data-tip="Miss" data-tip-detail="${DEFINITIONS.miss.l}">Miss</th>
                  <th data-sort="channelsHit" data-tip="Ch" data-tip-detail="${DEFINITIONS.channelsHit.l}">Ch</th>
                  <th data-sort="distCost" data-tip="Dist" data-tip-detail="${DEFINITIONS.distanceCost.l}">Dist</th>
                  <th data-sort="bends" data-tip="Bends" data-tip-detail="${DEFINITIONS.bends.l}">Bends</th>
                  <th data-sort="bendCost" data-tip="bCost" data-tip-detail="${DEFINITIONS.bendCost.l}">bCost</th>
                  <th data-sort="totalCost" data-tip="Total" data-tip-detail="${DEFINITIONS.totalCost.l}">Total</th>
                  <th data-sort="resolution" data-tip="Res" data-tip-detail="${DEFINITIONS.resolution.l}">Res</th>
                  <th data-sort="watch" data-tip="Watch" data-tip-detail="${DEFINITIONS.watch.l}">👁</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
          <div data-routing-empty style="display:none;opacity:.6;margin-top:4px;">(no routes)</div>
          <div data-watch-panel style="margin-top:10px;"></div>`;
        applyFilterUiDefaults(root);
        wireFilters(root);
        wireSort(root);
        const tbody=root.querySelector('tbody');
        const watchPanel=root.querySelector('[data-watch-panel]');
        let rowNodes=new Map();
        let expandedRows=new Set();
        const WATCH_MAX=5;
        const watchHistory={};

        function refresh(snapshot){
          refreshChannelFilter(snapshot);
          syncFiltersFromState(root);
          const rows=filterAndSort(Object.values(snapshot.routesById||{}));
          patchTable(rows,snapshot);
          updateEmpty(rows);
          renderWatchPanel(snapshot);
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
              tbody.appendChild(tr);
              rowNodes.set(r.id,tr);
            }
            updateCell(tr,'id',r.id); updateCell(tr,'eff',r.eff,'eff');
            updateCell(tr,'grid',r.grid,'gridStatus');
            updateCell(tr,'reason',r.reason,'gridReason');
            updateCell(tr,'det',r.det?'Y':'','detour');
            updateCell(tr,'miss',r.miss?'Y':'','miss');
            updateCell(tr,'channelsHit',r.channelsHit,'channelsHit');
            updateCell(tr,'distCost',fmtNum(r.distCost),'distanceCost');
            updateCell(tr,'bends',fmtNum(r.bends),'bends');
            updateCell(tr,'bendCost',fmtNum(r.bendCost),'bendCost');
            updateCell(tr,'totalCost',fmtNum(r.totalCost),'totalCost');
            updateCell(tr,'resolution',r.resolution||'','resolution');
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
          td.setAttribute('data-tip-detail',DEFINITIONS[defKey]?.l || display);
          if(old!==undefined && diffValue(old,display)){
            td.classList.remove('hud-flash'); void td.offsetWidth; td.classList.add('hud-flash');
          }
        }
        function ensureExpansionRow(id,rowData,snapshot){
          const tr=rowNodes.get(id); if(!tr)return;
          let next=tr.nextElementSibling;
          const expanded=expandedRows.has(id);
          if(expanded){
            if(!next || next.getAttribute('data-expansion-for')!==id){
              next=document.createElement('tr');
              next.setAttribute('data-expansion-for',id);
              const td=document.createElement('td');
              td.colSpan=13;
              td.style.cssText='background:rgba(70,0,90,0.35);font-size:10px;padding:4px 6px;';
              next.appendChild(td);
              tr.parentNode.insertBefore(next,tr.nextElementSibling);
            }
            next.firstElementChild.innerHTML=buildExpansionHtml(rowData);
          } else if(next && next.getAttribute('data-expansion-for')===id){
            next.remove();
          }
        }
        function buildExpansionHtml(r){
          const a=r.attrs||{};
          function line(label,v){return `<div style="display:flex;gap:6px;"><div style="width:110px;opacity:.7;">${label}</div><div style="flex:1;">${v||'<span style="opacity:.4;">—</span>'}</div></div>`;}
          return `
            <div style="margin-bottom:4px;font-weight:bold;">Route: ${r.id}</div>
            ${line('Attempts',a['data-cblcars-route-grid-attempts']||'')}
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
          if(expandedRows.has(id)) expandedRows.delete(id); else expandedRows.add(id);
          const data=(snapshot.routesById||{})[id];
          if(data) ensureExpansionRow(id,data,snapshot);
        }
        function updateEmpty(rows){const e=root.querySelector('[data-routing-empty]'); e.style.display=rows.length?'none':'block';}

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
            if(watchHistory[id].length>WATCH_MAX) watchHistory[id].shift();
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
            savePersistence(); emit('routing:filtersChanged',routingFilters); applyFilterUiDefaults(rt); refresh(buildCoreSnapshot());
          });
          rt.querySelector('[data-refresh]').addEventListener('click',()=>refresh(buildCoreSnapshot()));
        }
        function wireSort(rt){
          rt.querySelectorAll('th[data-sort]').forEach(th=>{
            th.addEventListener('click',()=>{
              const f=th.getAttribute('data-sort');
              if(routingSort.field===f) routingSort.dir*=-1; else routingSort={field:f,dir:1};
              savePersistence();
              refresh(buildCoreSnapshot());
            });
          });
        }
        function refreshChannelFilter(snapshot){
          const sel=root.querySelector('[data-filter-channel]');
          if(!sel)return;
          const ch=snapshot.channels||{};
          const existing=new Set();
          for(let i=0;i<sel.options.length;i++){if(sel.options[i].value) existing.add(sel.options[i].value);}
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
        function applyFilterUiDefaults(rt){syncFiltersFromState(rt);}
        function fmtNum(n){if(n==null)return''; if(Math.abs(n)>=1000)return n.toFixed(0); if(Math.abs(n)>=10)return n.toFixed(1); return n.toFixed(2);}
        function fmtTime(ts){const d=new Date(ts);return d.toLocaleTimeString([],{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});}

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

        return {rootEl:root,refresh};
      }
    });

    /* -------------------- CHANNELS PANEL -------------------- */
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
            if(sort.field===f) sort.dir*=-1; else sort={field:f,dir:(f==='id'?1:-1)};
            refresh(buildCoreSnapshot());
          });
        });
        function refresh(snapshot){
          const ch=snapshot.channels||{};
          const ids=Object.keys(ch);
          const tbody=root.querySelector('tbody');
          const empty=root.querySelector('[data-channel-empty]');
          if(!ids.length){tbody.innerHTML='';empty.style.display='block';return;}
          empty.style.display='none';
          const total=ids.reduce((s,id)=>s+ch[id],0)||1;
          const rows=ids.map(id=>{
            return {id,occ:ch[id],pct:(ch[id]/total)*100,weight:channelWeight(id)};
          }).sort((a,b)=>{
            const f=sort.field; if(a[f]===b[f])return 0; return (a[f]>b[f]?1:-1)*sort.dir;
          });
          tbody.innerHTML=rows.map(r=>{
            const w=Math.min(100,r.pct).toFixed(1);
            return `<tr data-channel-id="${r.id}" style="cursor:pointer;">
              <td>${r.id}</td><td>${r.occ}</td><td>${r.pct.toFixed(1)}</td><td>${r.weight}</td>
            </tr>
            <tr><td colspan="4">
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

    /* -------------------- PERF PANEL -------------------- */
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
            <button data-perf-reset style="font-size:10px;">Reset Perf</button>
            <button data-perf-reset-timers style="font-size:10px;">Reset Timers</button>
            <button data-perf-unpin style="font-size:10px;">Unpin All</button>
            <label style="display:flex;align-items:center;gap:2px;">min count <input data-min-count type="number" value="0" style="width:50px;font-size:10px;"></label>
            <label style="display:flex;align-items:center;gap:2px;">min avg(ms) <input data-min-avg type="number" value="0" style="width:50px;font-size:10px;"></label>
          </div>
          <details open data-sec-timers><summary style="cursor:pointer;font-weight:bold;">Timers</summary><div data-perf-timers></div></details>
          <details open data-sec-counters style="margin-top:6px;"><summary style="cursor:pointer;font-weight:bold;">Counters</summary><div data-perf-counters></div></details>`;
        const timersDiv=root.querySelector('[data-perf-timers]');
        const countersDiv=root.querySelector('[data-perf-counters]');
        let lastTimers={}, lastCounters={};
        root.querySelector('[data-perf-reset]')?.addEventListener('click',()=>{try{window.cblcars.perf.reset();}catch{}});
        root.querySelector('[data-perf-reset-timers]')?.addEventListener('click',()=>{try{window.cblcars.debug?.perf?.reset();}catch{}});
        root.querySelector('[data-perf-unpin]')?.addEventListener('click',()=>{
          pinnedPerf=[]; savePersistence(); emit('perf:pinnedChanged',pinnedPerf.slice()); refresh(buildCoreSnapshot());
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
              return `<div data-timer="${k}" class="${changed?'hud-flash':''}" style="display:flex;gap:4px;align-items:center;">
                <button data-pin style="font-size:9px;padding:0 4px;">${pin?'★':'☆'}</button>
                <span style="flex:1;" data-tip="${k}" data-tip-detail="Timer: last=${t.lastMs.toFixed(2)}ms avg=${t.avgMs.toFixed(2)}ms max=${t.maxMs.toFixed(1)} n=${t.count}">
                  ${k}: last=${t.lastMs.toFixed(2)}ms avg=${t.avgMs.toFixed(2)}ms n=${t.count}
                </span>
              </div>`;
            }).join('');
          const cKeys=Object.keys(counters);
          countersDiv.innerHTML=!cKeys.length?'<div style="opacity:.6;">(none)</div>':
            cKeys.sort().map(k=>{
              const c=counters[k];
              if(c.count<minCount || (c.avgMs && c.avgMs<minAvg)) return '';
              const changed=lastCounters[k] && (lastCounters[k].count!==c.count || lastCounters[k].lastMs!==c.lastMs);
              const pin=pinnedPerf.includes(k);
              const avgPart=c.avgMs!=null?` avg=${c.avgMs.toFixed(1)}ms`:'';
              return `<div data-counter="${k}" class="${changed?'hud-flash':''}" style="display:flex;gap:4px;align-items:center;">
                <button data-pin style="font-size:9px;padding:0 4px;">${pin?'★':'☆'}</button>
                <span style="flex:1;" data-tip="${k}" data-tip-detail="Counter: count=${c.count}${avgPart}">
                  ${k}: c=${c.count}${avgPart}
                </span>
              </div>`;
            }).join('');
          timersDiv.querySelectorAll('[data-timer] [data-pin]').forEach(btn=>{
            btn.addEventListener('click',()=>{
              const k=btn.closest('[data-timer]').getAttribute('data-timer');
              togglePin(k,btn);
            });
          });
          countersDiv.querySelectorAll('[data-counter] [data-pin]').forEach(btn=>{
            btn.addEventListener('click',()=>{
              const k=btn.closest('[data-counter]').getAttribute('data-counter');
              togglePin(k,btn);
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

    /* -------------------- FLAGS PANEL -------------------- */
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
          <div style="margin-top:6px;font-size:10px;opacity:.6;">Profiles override existing flags (Custom = mixed state).</div>`;
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

    /* -------------------- ACTIONS PANEL -------------------- */
    registerPanel({
      id:'actions',
      title:'Actions',
      order:INTERNAL_ORDERS.actions,
      render(){
        const root=document.createElement('div');
        root.style.fontSize='10px';
        root.innerHTML=`
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            <button data-act="list-cards"  style="font-size:10px;" data-tip="List Cards">List Cards</button>
            <button data-act="relayout"    style="font-size:10px;" data-tip="Relayout">Relayout</button>
            <button data-act="reset-perf"  style="font-size:10px;" data-tip="Reset Perf">Reset Perf</button>
            <button data-act="toggle-aggressive" style="font-size:10px;" data-tip="Toggle aggressive">Smart Agg</button>
            <button data-act="toggle-detour" style="font-size:10px;" data-tip="Toggle detour">Detour</button>
            <button data-act="pause"       style="font-size:10px;" data-tip="Pause/Resume Auto Refresh">Pause</button>
            <button data-act="watch-route" style="font-size:10px;" data-tip="Watch Route">Watch Route…</button>
            <button data-act="clear-watches" style="font-size:10px;" data-tip="Clear Watches">Clear Watches</button>
            <button data-act="bootstrap-scan" style="font-size:10px;" data-tip="Force Bootstrap Scan" data-tip-detail="Force a bootstrap re-scan for routes (even if paused).">Scan</button>
          </div>
          <div data-actions-status style="margin-top:6px;opacity:.75;font-size:10px;"></div>`;
        function setStatus(msg){const el=root.querySelector('[data-actions-status]'); el.textContent=msg;}
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
                  if(!paused){refresh(true,true); resetIntervalTimer(); maybeRestartWarmups();}
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
                default:break;
              }
            }catch(e){setStatus('Error: '+(e?.message||e));}
          });
        });
        return {rootEl:root,refresh(){}};
      }
    });

    /* ------------------------------------------------------------------
     * HUD Frame
     * ------------------------------------------------------------------ */
    function ensure(){
      dev.hud._enabled=true;
      mountGlobal();
      renderFrameSkeleton();
      refresh(true,true); // initial snapshot (even if paused)
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
        background:'rgba(20,0,30,0.90)',color:'#ffd5ff',font:'12px/1.35 monospace',
        border:'1px solid #ff00ff',borderRadius:'6px',maxWidth:'760px',minWidth:'340px',
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
      panel.innerHTML=`
        <div data-hdr style="display:flex;align-items:center;gap:6px;cursor:move;background:linear-gradient(90deg,#330046,#110014);padding:6px 8px;border-bottom:1px solid #ff00ff;position:relative;">
          <strong style="flex:1;font-size:12px;">LCARS Dev HUD</strong>
          <span data-pinned-count style="font-size:10px;opacity:.7;"></span>
          <button data-profile-btn style="font-size:11px;padding:2px 6px;" data-tip="Profiles">Prof</button>
          <button data-legend-toggle style="font-size:11px;padding:2px 6px;" data-tip="Legend Mode" data-tip-detail="Toggle quick flag label verbosity.">${verboseFlags?'ABC':'A'}</button>
          <button data-collapse style="font-size:11px;padding:2px 6px;" data-tip="Collapse HUD">${collapsed?'▢':'▣'}</button>
          <button data-remove style="font-size:11px;padding:2px 6px;" data-tip="Disable HUD">✕</button>
        </div>
        <div data-toolbar style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:4px 8px;border-bottom:1px solid #552266;background:rgba(30,0,50,0.50);">
          <span style="font-size:10px;opacity:.65;">Flags:</span>
          <div data-quick-flags style="display:flex;flex-wrap:wrap;gap:2px;"></div>
          <span style="margin-left:auto;font-size:10px;opacity:.65;">Interval</span>
          <input data-int type="number" min="250" step="250" value="${hudInterval}" data-tip="Refresh Interval" data-tip-detail="Auto refresh interval (ms)." style="width:70px;font-size:10px;">
          <span style="margin-left:6px;font-size:10px;opacity:.65;">Tooltip ms</span>
          <input data-tooltip-timeout type="number" min="0" step="250" value="${tooltipTimeout}" data-tip="Tooltip Timeout" data-tip-detail="Hide delay; 0 = manual only." style="width:70px;font-size:10px;">
          <span style="margin-left:6px;font-size:10px;opacity:.65;">Delay</span>
          <input data-tooltip-delay type="number" min="0" step="50" value="${tooltipDelay}" data-tip="Tooltip Show Delay" data-tip-detail="Delay before a tooltip appears (ms)." style="width:60px;font-size:10px;">
          <button data-refresh data-tip="Immediate Refresh" style="font-size:10px;padding:2px 6px;">↻</button>
          <button data-pause-toggle style="font-size:10px;padding:2px 6px;" data-tip="Pause/Resume">${paused?'Resume':'Pause'}</button>
        </div>
        <div data-body style="${collapsed?'display:none;':''};max-height:70vh;overflow-y:auto;padding:6px 8px;position:relative;"></div>
        <div data-footer style="padding:4px 8px;font-size:10px;opacity:.55;${collapsed?'display:none;':''}">
          Drag header. Hover tooltips (delayed). Prof=profiles. A=flag legend. ↻ refresh. Pause leaves static snapshot.
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
        if(!paused){refresh(true,true); resetIntervalTimer(); maybeRestartWarmups();}
        styleGlobal(panel);
      });
    }
    function updatePinnedCount(){
      const panel=document.getElementById(HUD_ID);
      if(!panel)return;
      const span=panel.querySelector('[data-pinned-count]');
      if(span) span.textContent=pinnedPerf.length?`Pinned:${pinnedPerf.length}`:'';
    }

    /* ------------------------------------------------------------------
     * Refresh Loop
     * ------------------------------------------------------------------ */
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
        return;
      }
      const snapshot=buildCoreSnapshot();
      emit('refresh:snapshot',snapshot);
      renderPanelsShell();
      refreshPanels(snapshot);
      updatePinnedCount();
      if(forcePersist) savePersistence();
      lastSnapshot=snapshot;
      if (snapshot.routesSummary.total > 0) {
        stopWarmup();
        stopDomObserver();
      }

      // SAFEGUARD: If we have route data but the routing panel tbody is missing or empty, force a full repaint once.
      try {
        if (snapshot.routesSummary.total > 0) {
          const tbody = getRoutingTbody();
          if (!tbody || tbody.childElementCount === 0) {
            console.info('[cblcars.dev.hud] Routing panel empty after snapshot; forcing full repaint.');
            forceFullRepaint(snapshot);
          }
        }
      } catch(e) {
        console.warn('[cblcars.dev.hud] repaint safeguard error', e);
      }
    }

    /* ------------------------------------------------------------------
     * Warmup / Bootstrap Detection
     * ------------------------------------------------------------------ */
    function warmupInit(){
      warmupStart=performance.now();
      stopWarmup();
      warmupTimer=setTimeout(warmupTick, STARTUP_WARMUP_INTERVAL_MS);
    }
    function warmupTick(){
      if(!dev.hud._enabled){ stopWarmup(); return; }
      const elapsed=performance.now()-warmupStart;
      if(lastSnapshot && lastSnapshot.routesSummary.total>0){
        stopWarmup(); return;
      }
      refresh(false,true);
      if(elapsed < STARTUP_WARMUP_MAX_MS){
        warmupTimer=setTimeout(warmupTick, STARTUP_WARMUP_INTERVAL_MS);
      } else {
        stopWarmup();
      }
    }
    function stopWarmup(){
      if(warmupTimer){clearTimeout(warmupTimer);warmupTimer=null;}
    }
    function maybeRestartWarmups(){
      if(!paused && (!lastSnapshot || lastSnapshot.routesSummary.total===0)){
        warmupInit();
        startDomObserver();
        bootstrapPollingLoop();
      }
    }


    /* ------------------------------------------------------------------
     * Repaint / Debug Helpers
     * ------------------------------------------------------------------ */
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
      // Reset panel instances so they re-instantiate.
      for(const entry of panelRegistry.values()){
        entry.instance=null;
      }
      renderPanelsShell();
      const snap = snapshotOverride || lastSnapshot || buildCoreSnapshot();
      if(snap){
        try{
          refreshPanels(snap);
          updatePinnedCount();
        }catch(e){
          console.warn('[cblcars.dev.hud] forceFullRepaint failed', e);
        }
      }
    }

    // --- REPLACED startDomObserver / stopDomObserver (ShadowRoot-aware) ---
    function startDomObserver(){
      // Avoid duplicate setup
      if (domObserver) return;

      // We'll store an object with observers + bookkeeping instead of a single MutationObserver
      domObserver = {
        started: performance.now(),
        handles: [],
        stopped: false
      };

      const ATTR_FILTER = [
        'data-cblcars-route-effective',
        'data-cblcars-route-grid-status',
        'data-cblcars-route-grid-reason'
      ];
      const MIN_GAP_MS = 120;
      let lastTrigger = 0;

      const shouldStop = () => {
        if (!dev.hud._enabled) return true;
        if (lastSnapshot && lastSnapshot.routesSummary && lastSnapshot.routesSummary.total > 0) return true;
        if (performance.now() - domObserver.started > STARTUP_DOM_OBSERVER_MAX_MS) return true;
        return false;
      };

      const triggerRefresh = (why) => {
        const now = performance.now();
        if (now - lastTrigger < MIN_GAP_MS) return;
        lastTrigger = now;
        refresh(false, true); // allowWhilePaused
        if (lastSnapshot && lastSnapshot.routesSummary.total > 0) {
          stopDomObserver();
        }
      };

      // Build list of roots to observe: document + each MSD card shadowRoot
      function collectRoots(){
        const roots = new Set();
        roots.add(document.documentElement);
        try {
          const cards = dev.discoverMsdCards ? dev.discoverMsdCards(true) : [];
          cards.forEach(c => c.shadowRoot && roots.add(c.shadowRoot));
        } catch(_) {}
        return Array.from(roots);
      }

      function attachObserverTo(root){
        if (!root) return;
        try {
          const mo = new MutationObserver(muts=>{
            if (shouldStop()) {
              stopDomObserver();
              return;
            }
            let any = false;
            for (const m of muts){
              if (m.type === 'childList') {
                // Look for new connector paths
                for (const n of m.addedNodes) {
                  if (n && n.nodeType === 1) {
                    if (n.matches && n.matches('path[data-cblcars-attach-to]')) {
                      any = true;
                      continue;
                    }
                    if (n.querySelector && n.querySelector('path[data-cblcars-attach-to]')) {
                      any = true;
                    }
                  }
                }
              } else if (m.type === 'attributes') {
                const t = m.target;
                if (t &&
                    t.nodeType === 1 &&
                    t.tagName &&
                    t.tagName.toLowerCase() === 'path' &&
                    t.hasAttribute('data-cblcars-attach-to') &&
                    ATTR_FILTER.includes(m.attributeName)) {
                  any = true;
                }
              }
              if (any) break;
            }
            if (any) triggerRefresh('mutation');
          });
          mo.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ATTR_FILTER
          });
          domObserver.handles.push(mo);

          // One-time scan for pre-existing routed paths inside this root
          try {
            if (!lastSnapshot || (lastSnapshot.routesSummary && lastSnapshot.routesSummary.total === 0)) {
              const pre = root.querySelector && root.querySelector(
                'path[data-cblcars-attach-to][data-cblcars-route-effective],' +
                'path[data-cblcars-attach-to][data-cblcars-route-grid-status]'
              );
              if (pre) triggerRefresh('pre-scan');
            }
          } catch(_) {}
        } catch(_) {}
      }

      // Attach initial observers
      collectRoots().forEach(r => attachObserverTo(r));

      // Re-scan for new MSD cards for a short window (some dashboards lazy-load)
      const RESCAN_INTERVAL = 600;
      (function rescanLoop(){
        if (shouldStop()) {
          stopDomObserver();
          return;
        }
        const existingRoots = new Set(domObserver.handles.map(h => h.rootRef).filter(Boolean));
        const rootsNow = collectRoots();
        rootsNow.forEach(r => {
          // naive check: if we haven't attached an observer whose root contains this root's firstElementChild
          // simpler: just check a marker property
          if (!r.__cblcarsHudObserved) {
            attachObserverTo(r);
            r.__cblcarsHudObserved = true;
          }
        });
        if (!shouldStop()) setTimeout(rescanLoop, RESCAN_INTERVAL);
      })();
    }

    function stopDomObserver(){
      if (!domObserver) return;
      if (Array.isArray(domObserver.handles)) {
        domObserver.handles.forEach(mo => {
          try { mo.disconnect(); } catch(_) {}
        });
      }
      domObserver = null;
    }

    function bootstrapPollingLoop(){
      const start=performance.now();
      (function loop(){
        if(!dev.hud._enabled) return;
        if(lastSnapshot && lastSnapshot.routesSummary.total>0) return;
        const anyPath=document.querySelector('path[data-cblcars-route-effective], path[data-cblcars-attach-to]');
        if(anyPath){
          refresh(false,true);
        }
        if((!lastSnapshot || lastSnapshot.routesSummary.total===0) && performance.now()-start < STARTUP_WARMUP_MAX_MS){
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
      warmupInit();
      startDomObserver();
      bootstrapPollingLoop();
      startActiveCardWait();
      refresh(false,true);
    }

    /* ------------------------------------------------------------------
     * HUD API
     * ------------------------------------------------------------------ */
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
        setTooltipStickyKey(key){tooltipStickyKey=key||'?';savePersistence();},
        setTooltipDelay(ms){tooltipDelay=Math.max(0,ms|0);savePersistence();},
        getTooltipDelay(){return tooltipDelay;},
        refreshOncePaused(){refresh(true,true);},
        refreshRaw(opts={}){refresh(!!opts.persist,!!opts.allowWhilePaused);},
        forceBootstrapScan,
        help(){
          console.group('[HUD API]');
          console.log('Methods:',[
            'bringToFront','setInterval','applyProfile','on/off',
            'watchRoute','unwatchRoute','clearWatches','getWatchRoutes',
            'setRoutingFilters','getRoutingFilters',
            'pause','resume','isPaused',
            'pinPerf','unpinPerf','clearPinnedPerf',
            'setTooltipTimeout','setTooltipStickyKey',
            'setTooltipDelay','getTooltipDelay',
            'refreshOncePaused','refreshRaw','forceBootstrapScan','help'
          ]);
          console.log('Events:',[
            'refresh:snapshot','flags:changed','routing:filtersChanged',
            'routing:watchChanged','perf:pinnedChanged','panel:toggle'
          ]);
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

    // Attach API
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
          pinnedPerf:pinnedPerf.slice(),
          watchRoutes:watchRoutes.slice(),
          routingFilters:{...routingFilters},
          routingSort:{...routingSort},
          panelCount:panelRegistry.size,
          lastSnapshotRoutes:lastSnapshot?.routesSummary?.total||0
        };
      }
    });

    // Simple debug alias
    dev.hud.debug = {
      snapshot: () => lastSnapshot,
      forceRepaint: () => forceFullRepaint()
    };

    // Hook pick/setCard to refresh static snapshot (allowWhilePaused)
    const origPick=dev.pick;
    dev.pick=function(i){const r=origPick.call(dev,i); if(dev.hud._enabled) setTimeout(()=>refresh(true,true),40); return r;};
    const origSetCard=dev.setCard;
    dev.setCard=function(el){const r=origSetCard.call(dev,el); if(dev.hud._enabled) setTimeout(()=>refresh(true,true),40); return r;};

    // Start interval & auto-enable
    resetIntervalTimer();
    if(persisted.enabled){dev.hud._enabled=true; setTimeout(()=>ensure(),70);}
    dev.hud._phase22Attached=true;
    console.info('[cblcars.dev.hud] Phase 2.2 HUD attached');
  }
})();