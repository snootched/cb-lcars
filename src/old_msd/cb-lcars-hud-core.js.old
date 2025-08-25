/* HUD Core v4 Foundation (Pass 4 Close-Out: strict mode proxy + previousSnapshot exposure + provider thresholds) */
(function(){
  const qs=new URLSearchParams(location.search);
  const active = !window.CBLCARS_DEV_DISABLE && (window.CBLCARS_DEV_FORCE===true || qs.has('lcarsDev'));
  if(!active) return;
  if(window.cblcars?.hud?.__coreAttachedV4) return;

  let attempts=0; const MAX=80;
  (function waitDev(){
    if(window.cblcars?.dev?._advanced || window.cblcars?.dev?._advancedV4) return attach();
    if(attempts++<MAX) return setTimeout(waitDev,120);
    console.warn('[hud.core.v4] Dev tools not detected – abort');
  })();

  function attach(){
    const dev=window.cblcars.dev;
    const hudNS = window.cblcars.hud = window.cblcars.hud || {};
    hudNS.__coreAttachedV4=true;
    hudNS.__coreAttached=true;

    const HUD_VERSION='4.0.0-foundation+closeout';
    const HUD_ID='cblcars-dev-hud-panel';
    const HUD_Z=2147481100;
    const DEFAULT_INTERVAL=3000;
    const TOOLTIP_DEFAULT_DELAY=280;

    const persisted=(dev.persistedState && dev.persistedState.hud)||{};
    let dragPos=Array.isArray(persisted.position)?persisted.position.slice():null;
    let collapsed=!!persisted.collapsed;
    let intervalMs=Number.isFinite(persisted.interval)?Math.max(250,persisted.interval):DEFAULT_INTERVAL;
    let tooltipTimeout=Number.isFinite(persisted.tooltipTimeout)?persisted.tooltipTimeout:2500;
    let tooltipDelay=Number.isFinite(persisted.tooltipDelay)?Math.max(0,persisted.tooltipDelay):TOOLTIP_DEFAULT_DELAY;
    let paused=!!persisted.paused;
    let sectionsCollapsed={...(persisted.sectionsCollapsed||{})};
    let routingFilters={ detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:false,channel:null, ...(persisted.routingFilters||{}) };
    let pinnedPerf=Array.isArray(persisted.pinnedPerf)?persisted.pinnedPerf.slice():[];
    let watchRoutes=Array.isArray(persisted.watchRoutes)?watchRoutes=persisted.watchRoutes.slice():[];
    let verboseFlags=!!persisted.verboseFlags;
    let silentMode=!!persisted.silentMode;
    let selectedProfile=persisted.selectedProfile||'Custom';
    let perfThresholds=(persisted.perfThresholds && typeof persisted.perfThresholds==='object')?{...persisted.perfThresholds}:{};
    let providerThresholds=(persisted.providerThresholds && typeof persisted.providerThresholds==='object')?{...persisted.providerThresholds}:{};
    let strictV4Enabled=!!persisted.strictV4Enabled;

    const FLAG_PROFILES={
      Minimal:{overlay:false,connectors:false,perf:false,geometry:false,channels:false},
      Routing:{overlay:true,connectors:true,perf:false,geometry:false,channels:true},
      Perf:{overlay:false,connectors:false,perf:true,geometry:false,channels:false},
      Full:{overlay:true,connectors:true,perf:true,geometry:true,channels:true}
    };
    const QUICK_FLAG_KEYS=['overlay','connectors','perf','geometry','channels'];

    const handlers=new Map();
    function on(ev,fn){ if(!handlers.has(ev)) handlers.set(ev,new Set()); handlers.get(ev).add(fn); }
    function off(ev,fn){ handlers.get(ev)?.delete(fn); }
    function emit(ev,p){ handlers.get(ev)?.forEach(fn=>{ try{fn(p);}catch(e){console.warn('[hud.emit]',ev,e);} }); }

    function persistHud(patch){
      try{
        if(typeof dev._persistHudState==='function') dev._persistHudState(patch);
        else dev.persist({ hud:{...((dev.persistedState&&dev.persistedState.hud)||{}), ...patch} });
      }catch{}
    }
    function save(){
      persistHud({
        position:dragPos,collapsed,interval:intervalMs,tooltipTimeout,tooltipDelay,paused,
        sectionsCollapsed,routingFilters,pinnedPerf,watchRoutes,verboseFlags,silentMode,
        selectedProfile,perfThresholds,providerThresholds,strictV4Enabled
      });
    }
    function log(...a){ if(!silentMode) console.info('[hud]',...a); }

    function setProfileButtonLabel(text){
      const root=document.getElementById(HUD_ID);
      if(!root) return;
      const btn=root.querySelector('[data-prof]');
      if(btn) btn.textContent=text;
    }

    let lastSnapshot=null;
    let previousSnapshotRef=null;

    function buildEnv(){
      return {
        hudVersion:HUD_VERSION,
        interval:intervalMs,
        paused,
        hudFlags:window.cblcars._debugFlags||{},
        perfThresholds,
        pinnedPerf,
        watchRoutes,
        routingFilters,
        selectedProfile,
        providerThresholds
      };
    }
    function buildSnapshot(){
      const t0=performance.now();
      const env=buildEnv();
      const base=window.cblcars.hud._buildSnapshotV4({
        now:Date.now(),
        prevSnapshot:lastSnapshot,
        env
      });
      if(base.sections.perf){
        base.sections.perf.thresholds=perfThresholds;
        base.sections.perf.pinned=pinnedPerf.slice();
      }
      base.meta.buildMs=performance.now()-t0;
      applyShim(base);
      previousSnapshotRef=lastSnapshot;
      lastSnapshot=base;
      if(strictV4Enabled) stripShim(base);
      return strictV4Enabled ? proxifySnapshot(base) : base;
    }
    function applyShim(snap){
      const s=snap.sections;
      snap.routesSummary=s.routes?.summary||{total:0};
      snap.routesById=s.routes?.byId||{};
      snap.perfTimers=s.perf?.timers||{};
      snap.perfCounters=s.perf?.counters||{};
      snap.overlaysBasic=(s.overlays?.list||[]).map(o=>({id:o.id,type:o.type,hasErrors:!!o.hasErrors,hasWarnings:!!o.hasWarnings}));
      snap.overlaysSummary=s.overlays?.summary;
      snap.anchors=s.anchors?.list||[];
      snap.anchorsSummary={count:(s.anchors?.list||[]).length};
      snap.channels=s.channels?.current||{};
      snap.previous=snap.previous||{};
      snap.previous.channels=s.channels?.previous||{};
      snap.scenarioResults=s.scenarios?.results||[];
      snap.flags=s.config?.flags||{};
    }
    function stripShim(snap){
      ['routesSummary','routesById','perfTimers','perfCounters','overlaysBasic','overlaysSummary','anchors','anchorsSummary','channels','scenarioResults','flags'].forEach(k=>{ delete snap[k]; });
      if(snap.previous) delete snap.previous.channels;
    }
    function proxifySnapshot(snap){
      if(snap.__proxiedV4) return snap;
      const legacyKeys=['routesSummary','routesById','perfTimers','perfCounters','overlaysBasic','overlaysSummary','anchors','anchorsSummary','channels','scenarioResults','flags'];
      return new Proxy(Object.assign({},snap,{__proxiedV4:true}),{
        get(target,prop){
          if(legacyKeys.includes(prop)){
            console.warn('[hud.strict] Access to legacy snapshot field "'+String(prop)+'" is blocked under strictV4.');
            return undefined;
          }
          return target[prop];
        }
      });
    }

    function ensureCss(){
      if(!document.getElementById('cblcars-hud-core-v4-css')){
        const st=document.createElement('style');
        st.id='cblcars-hud-core-v4-css';
        st.textContent=`
          #${HUD_ID} button{background:#2d003d;color:#ffd5ff;border:1px solid #552266;padding:2px 6px;border-radius:4px;cursor:pointer;font:11px monospace;}
          #${HUD_ID} button:hover{background:#ff00ff;color:#120018;}
          #${HUD_ID} .hud-delta-pos{color:#77ff90;}
          #${HUD_ID} .hud-delta-neg{color:#ff6688;}
          #${HUD_ID} .hud-badge-perf{background:#ff004d;color:#fff;padding:0 6px;border-radius:10px;font-size:10px;margin-left:4px;}
          #${HUD_ID} .hud-badge-warn{background:#ffd85f;color:#120018;padding:0 6px;border-radius:10px;font-size:10px;margin-left:4px;}
        `;
        document.head.appendChild(st);
      }
    }
    function frameHtml(){
      const cards=dev.discoverMsdCards?dev.discoverMsdCards(true):[];
      const idx=cards.indexOf(dev._activeCard);
      return `
        <div data-hdr style="display:flex;align-items:center;gap:6px;background:linear-gradient(90deg,#310046,#16002a);padding:6px 8px;
          border:1px solid #ff00ff;border-radius:6px 6px 0 0;cursor:move;">
          <strong style="flex:1;">HUD v${HUD_VERSION}</strong>
          <select data-card style="font-size:10px;max-width:140px;">
            ${cards.map((c,i)=>`<option value="${i}" ${i===idx?'selected':''}>Card ${i}${c===dev._activeCard?' *':''}</option>`).join('')}
          </select>
          <div data-qf style="display:flex;gap:3px;"></div>
          <button data-prof>${selectedProfile}</button>
          <button data-strict style="background:${strictV4Enabled?'#ff00ff':'#2d003d'};color:${strictV4Enabled?'#120018':'#ffd5ff'};">Strict</button>
          <button data-silent>${silentMode?'Silent✓':'Silent'}</button>
          <button data-pause>${paused?'Resume':'Pause'}</button>
          <button data-collapse>${collapsed?'▢':'▣'}</button>
          <button data-close>✕</button>
        </div>
        <div data-toolbar style="${collapsed?'display:none;':''};padding:4px 8px;background:#1e0034;border:1px solid #ff00ff;border-top:none;display:flex;flex-wrap:wrap;gap:6px;">
          <label style="font-size:10px;">Int <input data-int type="number" min="250" step="250" value="${intervalMs}" style="width:70px;font-size:10px;"></label>
          <label style="font-size:10px;">TT <input data-tt-to type="number" min="0" step="250" value="${tooltipTimeout}" style="width:70px;font-size:10px;"></label>
          <label style="font-size:10px;">Delay <input data-tt-delay type="number" min="0" step="50" value="${tooltipDelay}" style="width:60px;font-size:10px;"></label>
          <button data-refresh>↻</button>
        </div>
        <div data-body style="${collapsed?'display:none;':''};background:#160024;border:1px solid #ff00ff;border-top:none;border-radius:0 0 6px 6px;
            max-height:70vh;overflow:auto;padding:6px 8px;">
          <div data-panels style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>
        <div id="cblcars-hud-tooltip"></div>`;
    }

    function drawQuickFlags(){
      const root=document.getElementById(HUD_ID);
      if(!root) return;
      const wrap=root.querySelector('[data-qf]');
      if(!wrap) return;
      wrap.innerHTML='';
      const flags=window.cblcars._debugFlags||{};
      QUICK_FLAG_KEYS.forEach(k=>{
        const b=document.createElement('button');
        b.textContent=verboseFlags?k:k[0].toUpperCase();
        b.style.fontSize='10px';
        b.style.background=flags[k]?'#ff00ff':'#2d003d';
        b.style.color=flags[k]?'#120018':'#ffd5ff';
        b.addEventListener('click',()=>{
          dev.flags({[k]:!flags[k]});
          if(selectedProfile!=='Custom'){selectedProfile='Custom'; setProfileButtonLabel(selectedProfile); }
          save(); drawQuickFlags(); emit('flags:changed',window.cblcars._debugFlags);
        });
        wrap.appendChild(b);
      });
    }

    let tooltipApi={updateConfig:()=>{}};

    function buildFrame(){
      ensureCss();
      let panel=document.getElementById(HUD_ID);
      if(!panel){
        panel=document.createElement('div');
        panel.id=HUD_ID;
        document.body.appendChild(panel);
      }
      Object.assign(panel.style,{
        position:'fixed',
        top:dragPos?dragPos[1]+'px':'16px',
        left:dragPos?dragPos[0]+'px':'',
        right:dragPos?'':'16px',
        zIndex:HUD_Z,
        font:'12px/1.35 monospace',
        color:'#ffd5ff',
        maxWidth:'900px',
        minWidth:'380px',
        isolation:'isolate'
      });
      panel.innerHTML=frameHtml();
      wireFrame(panel);
      drawQuickFlags();
      if(window.cblcars.hud.tooltip){
        tooltipApi=window.cblcars.hud.tooltip.init(panel,{delay:tooltipDelay,timeout:tooltipTimeout});
      }
      renderPanelsShell();
    }

    const panels=new Map();
    function registerPanel(meta){
      if(!meta||!meta.id||panels.has(meta.id)) return;
      panels.set(meta.id,{meta,instance:null});
      renderPanelsShell();
    }
    window.cblcars.hud.registerPanel = registerPanel;
    (window.cblcars.hud._pendingPanels||[]).forEach(fn=>{try{fn();}catch(e){console.warn('[hud.panel.init]',e);} });
    window.cblcars.hud._pendingPanels=[];

    function renderPanelsShell(){
      const container=document.getElementById(HUD_ID)?.querySelector('[data-panels]');
      if(!container) return;
      const ordered=[...panels.values()].sort((a,b)=>(a.meta.order||99999)-(b.meta.order||99999));
      const existing=new Set();
      ordered.forEach(entry=>{
        existing.add(entry.meta.id);
        let outer=container.querySelector(`[data-panel="${entry.meta.id}"]`);
        if(!outer){
          outer=document.createElement('div');
          outer.setAttribute('data-panel',entry.meta.id);
          outer.style.cssText='border:1px solid #552266;border-radius:4px;background:rgba(40,0,60,0.45);display:flex;flex-direction:column;';
          outer.innerHTML=`
            <div data-h style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:linear-gradient(90deg,#440066,#220022);cursor:pointer;font-size:11px;">
              <span data-c>${sectionsCollapsed[entry.meta.id]?'▸':'▾'}</span>
              <span data-t style="flex:1;">${entry.meta.title||entry.meta.id}</span>
              <span data-b style="font-size:10px;opacity:.75;"></span>
            </div>
            <div data-body style="padding:6px 8px;display:${sectionsCollapsed[entry.meta.id]?'none':'block'};"></div>`;
          container.appendChild(outer);
          outer.querySelector('[data-h]').addEventListener('click',()=>{
            sectionsCollapsed[entry.meta.id]=!sectionsCollapsed[entry.meta.id];
            save();
            outer.querySelector('[data-c]').textContent=sectionsCollapsed[entry.meta.id]?'▸':'▾';
            outer.querySelector('[data-body]').style.display=sectionsCollapsed[entry.meta.id]?'none':'block';
          });
        }
        if(!entry.instance && !sectionsCollapsed[entry.meta.id]){
          try{
            const ctx={hudApi:hudApi,dev,utils:window.cblcars.hud.utils};
            const ret=entry.meta.render(ctx);
            entry.instance={refresh:ret.refresh||(()=>{}),el:ret.rootEl||outer.querySelector('[data-body]')};
            if(ret.rootEl && ret.rootEl!==outer.querySelector('[data-body]')){
              const body=outer.querySelector('[data-body]');
              body.innerHTML='';
              body.appendChild(ret.rootEl);
            }
          }catch(e){
            outer.querySelector('[data-body]').innerHTML=`<div style="color:#ff4d78;">Panel init error: ${e.message||e}</div>`;
          }
        }
      });
      [...container.querySelectorAll('[data-panel]')].forEach(p=>{
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
        try{ badge.textContent=entry.meta.badge?(entry.meta.badge(snapshot)||''):''; }catch{ badge.textContent=''; }
      });
    }

    let refreshTimer=null;
    function resetInterval(){
      if(refreshTimer) clearInterval(refreshTimer);
      if(!paused) refreshTimer=setInterval(()=>refresh(), intervalMs);
    }

    function computeDiffsInPlace(snapshot){
      try{
        const prev=previousSnapshotRef;
        if(!prev) return;
        const curRoutes=snapshot.sections.routes?.byId||{};
        const prevRoutes=prev.sections?.routes?.byId||{};
        const costDiff=[];
        Object.keys(curRoutes).forEach(id=>{
          const c=curRoutes[id]?.totalCost;
          const p=prevRoutes[id]?.totalCost;
          if(p!=null && c!=null && p!==c){
            const pct=((c-p)/p)*100;
            costDiff.push({id,prev:p,cur:c,pct});
          }
        });
        costDiff.sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct));
        if(snapshot.sections.diff) snapshot.sections.diff.routes.cost=costDiff;
      }catch{}
    }

    function refresh(forceSave=false, allowWhilePaused=false){
      if(paused && !allowWhilePaused){
        if(!lastSnapshot){
          const snap=buildSnapshot();
          renderPanelsShell();
          panels.forEach(p=>{ try{p.instance?.refresh(snap);}catch{} });
        }
        return;
      }
      const snapshot=buildSnapshot();
      computeDiffsInPlace(snapshot);
      renderPanelsShell();
      panels.forEach(p=>{
        if(sectionsCollapsed[p.meta.id]) return;
        try{p.instance?.refresh(snapshot);}catch(e){console.warn('[hud.panel.refresh]',p.meta.id,e);}
      });
      updatePanelBadges(snapshot);
      if(forceSave) save();
      emit('snapshot:refresh',snapshot);
    }

    function wireFrame(panel){
      const hdr=panel.querySelector('[data-hdr]');
      let dragging=false,sx=0,sy=0,ox=0,oy=0;
      hdr.addEventListener('mousedown',e=>{
        if(e.button!==0) return;
        dragging=true; sx=e.clientX; sy=e.clientY;
        const r=panel.getBoundingClientRect(); ox=r.left; oy=r.top;
        document.addEventListener('mousemove',onMove);
        document.addEventListener('mouseup',onUp,{once:true});
        e.preventDefault();
      });
      function onMove(e){
        if(!dragging) return;
        panel.style.left=(ox+(e.clientX-sx))+'px';
        panel.style.top=(oy+(e.clientY-sy))+'px';
        panel.style.right='';
      }
      function onUp(){
        dragging=false;
        document.removeEventListener('mousemove',onMove);
        const r=panel.getBoundingClientRect();
        dragPos=[r.left,r.top]; save();
      }

      panel.querySelector('[data-close]').addEventListener('click',()=>{
        persistHud({enabled:false});
        panel.remove();
      });
      panel.querySelector('[data-collapse]').addEventListener('click',()=>{
        collapsed=!collapsed; save();
        panel.querySelector('[data-collapse]').textContent=collapsed?'▢':'▣';
        panel.querySelector('[data-body]').style.display=collapsed?'none':'block';
        panel.querySelector('[data-toolbar]').style.display=collapsed?'none':'flex';
      });
      panel.querySelector('[data-refresh]').addEventListener('click',()=>refresh(true,true));
      panel.querySelector('[data-int]').addEventListener('change',e=>{
        const v=parseInt(e.target.value,10);
        if(Number.isFinite(v)&&v>=250){ intervalMs=v; save(); resetInterval(); }
      });
      panel.querySelector('[data-tt-to]').addEventListener('change',e=>{
        tooltipTimeout=Math.max(0,parseInt(e.target.value,10)||0);
        save(); tooltipApi.updateConfig({timeout:tooltipTimeout});
      });
      panel.querySelector('[data-tt-delay]').addEventListener('change',e=>{
        tooltipDelay=Math.max(0,parseInt(e.target.value,10)||0);
        save(); tooltipApi.updateConfig({delay:tooltipDelay});
      });
      panel.querySelector('[data-pause]').addEventListener('click',e=>{
        paused=!paused; save();
        e.target.textContent=paused?'Resume':'Pause';
        if(!paused){ refresh(true,true); resetInterval(); }
      });
      panel.querySelector('[data-silent]').addEventListener('click',e=>{
        silentMode=!silentMode; save();
        e.target.textContent=silentMode?'Silent✓':'Silent';
      });
      panel.querySelector('[data-prof]').addEventListener('click',()=>showProfilesMenu(panel));
      panel.querySelector('[data-card]').addEventListener('change',e=>{
        const idx=parseInt(e.target.value,10);
        dev.pick(idx);
        setTimeout(()=>refresh(true,true),60);
      });
      panel.querySelector('[data-strict]').addEventListener('click',()=>{
        enableStrictV4();
      });
    }

    function showProfilesMenu(panel){
      const old=panel.querySelector('#hud-prof-menu');
      if(old){old.remove();return;}
      const m=document.createElement('div');
      m.id='hud-prof-menu';
      Object.assign(m.style,{
        position:'absolute',right:'6px',top:'46px',background:'#230036',border:'1px solid #ff00ff',
        borderRadius:'6px',padding:'6px 8px',zIndex:HUD_Z+2,font:'11px monospace',minWidth:'160px'
      });
      m.innerHTML=`<div style="font-weight:bold;margin-bottom:4px;">Profiles</div>
        ${Object.keys(FLAG_PROFILES).map(p=>`<div data-prof="${p}" style="padding:2px 4px;cursor:pointer;${p===selectedProfile?'background:#ff00ff;color:#120018;':''}">${p}</div>`).join('')}
        <div data-prof="Custom" style="padding:2px 4px;cursor:pointer;${selectedProfile==='Custom'?'background:#ff00ff;color:#120018;':''}">Custom</div>`;
      panel.appendChild(m);
      m.addEventListener('click',e=>{
        const p=e.target.getAttribute('data-prof'); if(!p) return;
        if(p!=='Custom'){
          dev.flags(FLAG_PROFILES[p]);
          selectedProfile=p;
          save(); drawQuickFlags(); emit('flags:changed',window.cblcars._debugFlags);
          setProfileButtonLabel(p);
        } else {
          selectedProfile='Custom'; save(); setProfileButtonLabel('Custom');
        }
        m.remove();
      });
      document.addEventListener('pointerdown',function once(ev){
        if(!m.contains(ev.target)){ m.remove(); document.removeEventListener('pointerdown',once,true); }
      },true);
    }

    buildFrame();
    refresh(true,true);
    resetInterval();

    function enableStrictV4(){
      if(strictV4Enabled){
        console.info('[hud.strict] Already enabled.');
        return;
      }
      strictV4Enabled=true;
      save();
      console.warn('[hud.strict] Enabling strict V4 snapshot (legacy flattened fields removed and proxy warnings active).');
      refresh(true,true);
      const btn=document.querySelector(`#${HUD_ID} [data-strict]`);
      if(btn){ btn.style.background='#ff00ff'; btn.style.color='#120018'; }
    }

    // Provider thresholds API utilities (health panel consumes via env)
    function setProviderThreshold(id,vals){
      if(!id) return;
      if(!vals||(vals.lastMs==null && vals.avgMs==null && vals.maxMs==null)){
        delete providerThresholds[id];
      }else{
        providerThresholds[id]={...(providerThresholds[id]||{}),...vals};
      }
      save(); refresh(false,true);
    }
    function removeProviderThreshold(id){
      delete providerThresholds[id]; save(); refresh(false,true);
    }

    const hudApi={
      on,off,emit,
      currentSnapshot:()=>lastSnapshot,
      previousSnapshot:()=>previousSnapshotRef,
      refreshRaw:(opts={})=>refresh(!!opts.persist,!!opts.allowWhilePaused),
      pause(){ if(!paused){ paused=true; save(); } },
      resume(){ if(paused){ paused=false; save(); resetInterval(); refresh(true,true);} },
      isPaused:()=>paused,
      status(){
        return {
          version:HUD_VERSION,
          paused,
          interval:intervalMs,
          pinnedPerf:pinnedPerf.slice(),
          watchRoutes:watchRoutes.slice(),
          routingFilters:{...routingFilters},
            verboseFlags,
          perfThresholds:{...perfThresholds},
          providerThresholds:{...providerThresholds},
          strictV4Enabled,
          selectedProfile
        };
      },
      setRoutingFilters(patch){ Object.assign(routingFilters,patch||{}); save(); },
      getRoutingFilters:()=>({...routingFilters}),
      pinPerf(id){ if(!pinnedPerf.includes(id)){ pinnedPerf.push(id); save(); } },
      unpinPerf(id){ pinnedPerf=pinnedPerf.filter(x=>x!==id); save(); },
      clearPinnedPerf(){ pinnedPerf=[]; save(); },
      watchRoute(id){ if(!watchRoutes.includes(id)){ watchRoutes.push(id); save(); } },
      unwatchRoute(id){ watchRoutes=watchRoutes.filter(x=>x!==id); save(); },
      clearWatchRoutes(){ watchRoutes=[]; save(); },
      setPerfThreshold(id,vals){
        if(!id) return;
        if(!vals||(vals.avgMs==null && vals.lastMs==null)) delete perfThresholds[id];
        else perfThresholds[id]={...(perfThresholds[id]||{}),...vals};
        save();
      },
      removePerfThreshold(id){ delete perfThresholds[id]; save(); },
      getPerfThresholds:()=>({...perfThresholds}),
      setProviderThreshold,
      removeProviderThreshold,
      getProviderThresholds:()=>({...providerThresholds}),
      exportSnapshot(){
        try{
          const snap=lastSnapshot||buildSnapshot();
          const blob=new Blob([JSON.stringify(snap,null,2)],{type:'application/json'});
          const url=URL.createObjectURL(blob);
          const a=document.createElement('a');
          a.href=url; a.download='hud-snapshot-v4-'+(snap.meta.timestamp||Date.now())+'.json';
          document.body.appendChild(a); a.click();
          setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},400);
        }catch(e){console.warn('[hud.exportSnapshot]',e);}
      },
      applyProfile(name){
        if(!FLAG_PROFILES[name]) return;
        dev.flags(FLAG_PROFILES[name]);
        selectedProfile=name; save(); drawQuickFlags(); emit('flags:changed',window.cblcars._debugFlags);
        setProfileButtonLabel(name);
      },
      toggleFlagLabelVerbosity(){ verboseFlags=!verboseFlags; save(); drawQuickFlags(); },
      setVerboseFlags(v){ verboseFlags=!!v; save(); drawQuickFlags(); },
      currentBuildVersion:()=>HUD_VERSION,
      enableStrictV4
    };
    hudNS.api=hudApi;

    log('[hud.core.v4] attached',HUD_VERSION);
  }
})();