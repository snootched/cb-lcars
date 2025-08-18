/**
 * CB-LCARS Developer HUD (Phase 1 Modular) - Fixed & Global-Only
 *
 * Fixes / Adjustments:
 *  - Added buildBuiltinPanelsOnce() so initial enable no longer throws ReferenceError.
 *  - Removed card/global toggle (card mode caused interaction issues). HUD always global.
 *  - Panels register before first refresh; no need to trigger test panel to see them.
 *  - setLocation() retained but only logs (non-breaking).
 *
 * Phase 1 Features (unchanged otherwise):
 *  - Draggable, collapsible, positioned & interval persisted
 *  - Modular panel registry + plugin API skeleton
 *  - Tooltips (data-tip / data-tip-detail)
 *  - Quick flags + profiles + verbose (legend) toggle
 *  - Perf & Timers panel (replaces SVG perf HUD)
 *  - Routes panel (sortable basic table)
 *  - Actions panel (subset)
 *  - Summary (routes/scenarios/channels) panel
 *
 * Persistence keys (sessionStorage via dev._persistHudState):
 *   hud: {
 *     enabled, position, collapsed, interval,
 *     verboseFlags, selectedProfile,
 *     flags (snapshot), (location ignored now)
 *   }
 */

(function initHudPhase1() {
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
      if (attempts++ < 60) return setTimeout(retryAttach, RETRY_MS);
      console.warn('[cblcars.dev.hud] Dev tools not ready; abort HUD attach.');
      return;
    }
    attachHud();
  }
  retryAttach();

  function attachHud() {
    const dev = window.cblcars.dev;
    if (!dev.hud) dev.hud = { _enabled: false };
    if (dev.hud._phase1Attached) {
      console.info('[cblcars.dev.hud] HUD Phase1 already attached.');
      return;
    }

    const HUD_ID = 'cblcars-dev-hud-panel';
    const HUD_Z  = 2147480000;

    /* ---------------- Persistence helpers ---------------- */
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

    /* ---------------- Internal state ---------------- */
    let dragPos         = null;
    let collapsed       = false;
    let hudInterval     = 3000;
    let verboseFlags    = false;
    let selectedProfile = 'Custom';
    let refreshTimer    = null;
    let panelDraggable  = false;
    // Always global now (kept for status record)
    const locationPref  = 'global';

    // Panel registry: id -> { meta, instance }
    const panelRegistry = new Map();
    let builtInsRegistered = false;

    const INTERNAL_ORDERS = {
      summary:  100,
      flags:    200,
      perf:     300,
      routes:   400,
      actions:  500,
    };

    const QUICK_FLAG_KEYS = ['overlay','connectors','perf','geometry','channels'];

    const FLAG_PROFILES = {
      'Minimal':  { overlay:false, connectors:false, perf:false, geometry:false, channels:false },
      'Routing':  { overlay:true,  connectors:true,  perf:false, geometry:false, channels:true  },
      'Perf':     { overlay:false, connectors:false, perf:true,  geometry:false, channels:false },
      'Full':     { overlay:true,  connectors:true,  perf:true,  geometry:true,  channels:true  }
    };

    /* Load persisted */
    (function loadPersist() {
      const st = readHudState();
      if (Array.isArray(st.position) && st.position.length === 2 && st.position.every(Number.isFinite)) {
        dragPos = [st.position[0], st.position[1]];
      }
      if (typeof st.collapsed === 'boolean') collapsed = st.collapsed;
      if (Number.isFinite(st.interval) && st.interval >= 500) hudInterval = st.interval;
      if (typeof st.verboseFlags === 'boolean') verboseFlags = st.verboseFlags;
      if (st.selectedProfile && FLAG_PROFILES[st.selectedProfile]) selectedProfile = st.selectedProfile;
    })();

    /* Snapshot builders */
    function buildCoreSnapshot() {
      const routesRaw = safeGetRoutes();
      return {
        routesRaw,
        routesSummary: summarizeRoutes(routesRaw),
        perfTimers: getPerfTimers(),
        perfCounters: getPerfCounters(),
        scenarioResults: dev._scenarioResults || [],
        channels: safeGetChannels(),
        flags: window.cblcars._debugFlags || {},
        timestamp: Date.now()
      };
    }
    function safeGetRoutes() { try { return dev.dumpRoutes(undefined, { silent: true }) || []; } catch { return []; } }
    function summarizeRoutes(routes) {
      let total=0, detours=0, gridSucc=0, gridFb=0, miss=0;
      for (const r of routes) {
        total++;
        if (r['data-cblcars-route-detour']==='true') detours++;
        const gs = r['data-cblcars-route-grid-status'];
        if (gs==='success') gridSucc++;
        else if (gs==='fallback') gridFb++;
        if (r['data-cblcars-route-channels-miss']==='true') miss++;
      }
      return { total, detours, gridSucc, gridFb, miss };
    }
    function getPerfTimers()    { try { return window.cblcars.debug?.perf?.get() || {}; } catch { return {}; } }
    function getPerfCounters()  { try { return window.cblcars.perfDump ? window.cblcars.perfDump() : (window.cblcars.perf?.dump?.() || {}); } catch { return {}; } }
    function safeGetChannels()  { try { return window.cblcars?.routing?.channels?.getOccupancy?.() || {}; } catch { return {}; } }

    /* Mount (global only) */
    function ensure() {
      dev.hud._enabled = true;
      mountGlobal();
      renderFrameSkeleton();
      refresh(true);
    }

    function mountGlobal() {
      let el = document.getElementById(HUD_ID);
      if (!el) {
        el = document.createElement('div');
        el.id = HUD_ID;
      }
      styleGlobal(el);
      document.body.appendChild(el);
    }

    function styleBase(panel) {
      Object.assign(panel.style, {
        background: 'rgba(20,0,30,0.86)',
        color: '#ffd5ff',
        font: '12px/1.35 monospace',
        border: '1px solid #ff00ff',
        borderRadius: '6px',
        maxWidth: '520px',
        minWidth: '300px',
        zIndex: HUD_Z,
        padding: '0',
        boxShadow: '0 3px 16px rgba(0,0,0,0.65)',
        isolation: 'isolate'
      });
    }
    function styleGlobal(panel) {
      styleBase(panel);
      panel.style.position = 'fixed';
      if (!dragPos) {
        panel.style.top = '14px';
        panel.style.right = '14px';
        panel.style.left = '';
      } else {
        panel.style.left = dragPos[0] + 'px';
        panel.style.top  = dragPos[1] + 'px';
        panel.style.right = '';
      }
      panel.dataset.location = 'global';
    }

    function removeHud() {
      dev.hud._enabled = false;
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
      const el = document.getElementById(HUD_ID);
      if (el) el.remove();
    }

    /* Frame Skeleton */
    function renderFrameSkeleton() {
      const panel = document.getElementById(HUD_ID);
      if (!panel) return;
      if (!panel.querySelector('[data-hud-root]')) {
        panel.innerHTML = `
          <div data-hud-root></div>
          <div data-hdr style="display:flex;align-items:center;gap:6px;cursor:move;
               background:linear-gradient(90deg,#330046,#110014);padding:6px 8px;
               border-bottom:1px solid #ff00ff;">
            <strong style="flex:1;font-size:12px;">LCARS Dev HUD</strong>
            <select data-card style="font-size:11px;max-width:140px;"></select>
            <button data-profile-tip data-tip="Profiles" data-tip-detail="Apply a preset combination of debug flags."
              data-profiles style="font-size:11px;padding:2px 6px;">Prof</button>
            <button data-legend data-tip="Toggle flag labels"
              data-tip-detail="Switch between compact single-letter and full flag names."
              style="font-size:11px;padding:2px 6px;">${verboseFlags?'ABC':'A'}</button>
            <button data-collapse data-tip="Collapse" data-tip-detail="Collapse or expand the entire HUD body."
              style="font-size:11px;padding:2px 6px;">${collapsed?'▢':'▣'}</button>
            <button data-remove data-tip="Disable HUD" data-tip-detail="Disable and remove the HUD (persisted)."
              style="font-size:11px;padding:2px 6px;">✕</button>
          </div>
          <div data-toolbar style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:4px 8px;
               border-bottom:1px solid #552266;background:rgba(30,0,50,0.45);">
            <span style="font-size:10px;opacity:.65;">Flags:</span>
            <div data-quick-flags style="display:flex;flex-wrap:wrap;gap:2px;"></div>
            <span style="margin-left:auto;font-size:10px;opacity:.65;">Interval</span>
            <input data-int type="number" min="500" step="500" value="${hudInterval}"
                   data-tip="Refresh Interval" data-tip-detail="HUD auto-refresh interval in milliseconds."
                   style="width:70px;font-size:10px;">
            <button data-refresh data-tip="Immediate Refresh" style="font-size:10px;padding:2px 6px;">↻</button>
          </div>
          <div data-body style="${collapsed?'display:none;':''};max-height:70vh;overflow-y:auto;padding:6px 8px;"></div>
          <div data-footer style="padding:4px 8px;font-size:10px;opacity:.55;${collapsed?'display:none;':''}">
            Drag header. Hover for tooltips. Prof=flag profiles. A=legend mode. (Global only)
          </div>
          <div id="cblcars-hud-tooltip" style="position:fixed;left:0;top:0;pointer-events:none;z-index:${HUD_Z+1};
               background:rgba(60,0,80,0.92);color:#ffe6ff;font:11px/1.3 monospace;padding:6px 8px;
               border:1px solid #ff00ff;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.5);display:none;
               max-width:280px;white-space:normal;"></div>
        `;
        wireFrame(panel);
      }
      const body = panel.querySelector('[data-body]');
      if (body && !body.querySelector('[data-panels]')) {
        const container = document.createElement('div');
        container.setAttribute('data-panels','');
        container.style.display='flex';
        container.style.flexDirection='column';
        container.style.gap='8px';
        body.appendChild(container);
      }
      renderQuickFlags(panel);
      buildBuiltinPanelsOnce();          // <-- register built-ins here
      renderPanelsShell();               // create shells
      refreshPanels(buildCoreSnapshot()); // initial population
    }

    /* Frame wiring */
    function wireFrame(panel) {
      if (!panelDraggable) {
        const hdr = panel.querySelector('[data-hdr]');
        if (hdr) {
          panelDraggable = true;
          let dragging=false,startX=0,startY=0,origX=0,origY=0;
          hdr.addEventListener('mousedown',e=>{
            if(e.button!==0)return;
            dragging=true;startX=e.clientX;startY=e.clientY;
            const r=panel.getBoundingClientRect();origX=r.left;origY=r.top;
            document.addEventListener('mousemove',onMove);
            document.addEventListener('mouseup',onUp,{once:true});
            e.preventDefault();
          });
          function onMove(e) {
            if(!dragging) return;
            const dx=e.clientX-startX, dy=e.clientY-startY;
            panel.style.left=(origX+dx)+'px';
            panel.style.top=(origY+dy)+'px';
            panel.style.right='';
          }
          function onUp() {
            dragging=false;
            document.removeEventListener('mousemove',onMove);
            const r=panel.getBoundingClientRect();
            dragPos=[r.left,r.top];
            persistHudState({ position:dragPos });
          }
        }
      }

      panel.querySelector('[data-card]')?.addEventListener('change',e=>{
        const idx=parseInt(e.target.value,10);
        if(Number.isFinite(idx)) { dev.pick(idx); refresh(true); }
      });

      panel.querySelector('[data-collapse]')?.addEventListener('click',()=>{
        collapsed=!collapsed;
        persistHudState({ collapsed });
        const body=panel.querySelector('[data-body]');
        const foot=panel.querySelector('[data-footer]');
        const btn = panel.querySelector('[data-collapse]');
        if(body) body.style.display=collapsed?'none':'block';
        if(foot) foot.style.display=collapsed?'none':'block';
        if(btn) btn.textContent=collapsed?'▢':'▣';
      });

      panel.querySelector('[data-remove]')?.addEventListener('click',()=>{
        persistHudState({ enabled:false });
        removeHud();
      });

      panel.querySelector('[data-legend]')?.addEventListener('click',()=>{
        verboseFlags=!verboseFlags;
        persistHudState({ verboseFlags });
        renderQuickFlags(panel,true);
      });

      panel.querySelector('[data-profiles]')?.addEventListener('click',()=>showProfilesMenu(panel));

      panel.querySelector('[data-int]')?.addEventListener('change',e=>{
        const val=parseInt(e.target.value,10);
        if(Number.isFinite(val) && val>=500) setIntervalMs(val);
      });

      panel.querySelector('[data-refresh]')?.addEventListener('click',()=>refresh(true));

      initTooltipEngine(panel);
    }

    /* Tooltip Engine */
    let tooltipEl=null, tooltipHideTO=null;
    function initTooltipEngine(panel) {
      tooltipEl = panel.querySelector('#cblcars-hud-tooltip');
      if (!tooltipEl) return;
      const root = panel;
      function showTip(target) {
        const short = target.getAttribute('data-tip');
        const detail = target.getAttribute('data-tip-detail');
        if (!short && !detail) return;
        let html = '';
        if (short)  html += `<div style="font-weight:bold;margin-bottom:2px;">${esc(short)}</div>`;
        if (detail) html += `<div style="font-size:11px;opacity:.85;">${esc(detail)}</div>`;
        tooltipEl.innerHTML = html;
        tooltipEl.style.display='block';
        positionTip(target);
      }
      function hideTip(){ tooltipEl.style.display='none'; }
      function esc(s){ return String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }
      function positionTip(target){
        const r=target.getBoundingClientRect(); const tw=tooltipEl.offsetWidth, th=tooltipEl.offsetHeight;
        let x=r.left+(r.width/2)-(tw/2), y=r.top-th-8;
        if(x<6)x=6; if(y<6)y=r.bottom+8;
        if(x+tw>window.innerWidth-6)x=window.innerWidth-tw-6;
        tooltipEl.style.left=x+'px'; tooltipEl.style.top=y+'px';
      }
      root.addEventListener('pointerover',e=>{
        const t=e.target.closest('[data-tip]');
        clearTimeout(tooltipHideTO);
        if(t) showTip(t);
      });
      root.addEventListener('pointerout',()=>{
        clearTimeout(tooltipHideTO);
        tooltipHideTO=setTimeout(hideTip,180);
      });
      root.addEventListener('focusin',e=>{
        const t=e.target.closest('[data-tip]');
        if(t) showTip(t);
      });
      root.addEventListener('focusout',()=>hideTip());
      window.addEventListener('scroll',()=>{ if(tooltipEl?.style.display==='block') hideTip(); }, true);
    }

    /* Quick Flags */
    function renderQuickFlags(panel, force) {
      const container = panel.querySelector('[data-quick-flags]');
      if (!container) return;
      if (force) container.innerHTML = '';
      const currentFlags = window.cblcars._debugFlags || {};
      QUICK_FLAG_KEYS.forEach(k=>{
        let btn = container.querySelector(`[data-flag-btn="${k}"]`);
        if(!btn){
          btn = document.createElement('button');
          btn.setAttribute('data-flag-btn', k);
          btn.setAttribute('data-tip', k);
          btn.setAttribute('data-tip-detail', `Toggle debug flag "${k}".`);
          btn.style.cssText='font-size:10px;padding:2px 6px;cursor:pointer;border:1px solid #552266;border-radius:3px;';
          btn.addEventListener('click',()=>{
            const nf = !(window.cblcars._debugFlags||{})[k];
            dev.flags({ [k]: nf });
            persistHudState({ flags: window.cblcars._debugFlags });
            styleQuickFlagBtn(btn,k,nf);
          });
          container.appendChild(btn);
        }
        styleQuickFlagBtn(btn,k,currentFlags[k]);
      });
    }
    function styleQuickFlagBtn(btn,key,on){
      const label = verboseFlags ? key : key[0].toUpperCase();
      btn.textContent = label;
      btn.style.background = on ? '#ff00ff':'#333';
      btn.style.color = on ? '#120018':'#ffd5ff';
    }

    /* Profiles Menu */
    function showProfilesMenu(panel) {
      let existing = panel.querySelector('#hud-profiles-menu');
      if (existing) { existing.remove(); return; }
      const menu = document.createElement('div');
      menu.id='hud-profiles-menu';
      Object.assign(menu.style,{
        position:'absolute',right:'6px',top:'42px',background:'rgba(50,0,70,0.95)',
        border:'1px solid #ff00ff',padding:'6px 8px',borderRadius:'6px',
        zIndex:HUD_Z+2,font:'11px/1.35 monospace',minWidth:'160px'
      });
      menu.innerHTML = `<div style="font-weight:bold;margin-bottom:4px;">Flag Profiles</div>
        ${Object.keys(FLAG_PROFILES).map(p =>
          `<div data-prof="${p}" style="padding:2px 4px;cursor:pointer;${p===selectedProfile?'background:#ff00ff;color:#120018;':''}">${p}</div>`
        ).join('')}
        <div data-prof="Custom" style="padding:2px 4px;cursor:pointer;${selectedProfile==='Custom'?'background:#ff00ff;color:#120018;':''}">Custom</div>
        <div style="margin-top:6px;font-size:10px;opacity:.65;">Click to apply (Custom = current state)</div>
      `;
      panel.appendChild(menu);
      menu.addEventListener('click', e => {
        const p = e.target.getAttribute('data-prof');
        if (!p) return;
        if (p !== 'Custom') {
          dev.flags(FLAG_PROFILES[p]);
          persistHudState({ flags: window.cblcars._debugFlags });
          selectedProfile = p;
        } else {
          selectedProfile = 'Custom';
        }
        persistHudState({ selectedProfile });
        menu.remove();
        renderQuickFlags(panel,true);
      });
      document.addEventListener('pointerdown', function once(ev){
        if (!menu.contains(ev.target)) {
          try { menu.remove(); } catch(_){}
          document.removeEventListener('pointerdown', once, true);
        }
      }, true);
    }

    /* Panel registry */
    function registerPanel(meta) {
      if (!meta || !meta.id) return;
      if (panelRegistry.has(meta.id)) return;
      panelRegistry.set(meta.id, { meta, instance:null });
    }

    function unregisterPanel(id) {
      const existing = panelRegistry.get(id);
      if (existing?.instance?.cleanup) {
        try { existing.instance.cleanup(); } catch(_) {}
      }
      panelRegistry.delete(id);
      renderPanelsShell();
    }

    function renderPanelsShell() {
      const panel = document.getElementById(HUD_ID);
      const container = panel?.querySelector('[data-panels]');
      if (!container) return;

      const entries = Array.from(panelRegistry.values())
        .sort((a,b)=> (a.meta.order||9999) - (b.meta.order||9999));

      const existingIds = new Set();
      entries.forEach(entry=>{
        existingIds.add(entry.meta.id);
        let wrapper = container.querySelector(`[data-panel="${entry.meta.id}"]`);
        if (!wrapper) {
          wrapper = document.createElement('div');
            wrapper.setAttribute('data-panel',entry.meta.id);
          wrapper.style.border='1px solid #552266';
          wrapper.style.borderRadius='4px';
          wrapper.style.background='rgba(40,0,60,0.45)';
          wrapper.style.display='flex';
          wrapper.style.flexDirection='column';
          wrapper.innerHTML = `
            <div data-panel-hdr style="display:flex;align-items:center;gap:6px;
                padding:4px 8px;background:linear-gradient(90deg,#440066,#220022);
                cursor:pointer;font-size:11px;">
              <span data-panel-caret style="opacity:.8;">▾</span>
              <span data-panel-title style="flex:1 1 auto;"></span>
              <span data-panel-badge style="font-size:10px;opacity:.8;"></span>
            </div>
            <div data-panel-body style="padding:6px 8px;display:block;"></div>
          `;
          container.appendChild(wrapper);

          const hdr = wrapper.querySelector('[data-panel-hdr]');
          hdr.addEventListener('click',()=>{
            const body = wrapper.querySelector('[data-panel-body]');
            const caret = wrapper.querySelector('[data-panel-caret]');
            const c = body.style.display==='none';
            body.style.display = c?'block':'none';
            caret.textContent = c?'▾':'▸';
          });
        }
        wrapper.querySelector('[data-panel-title]').textContent = entry.meta.title || entry.meta.id;
      });

      container.querySelectorAll('[data-panel]').forEach(w=>{
        if (!existingIds.has(w.getAttribute('data-panel'))) w.remove();
      });

      const snapshot = buildCoreSnapshot();
      for (const entry of panelRegistry.values()) {
        if (!entry.instance) {
          const wrapper = container.querySelector(`[data-panel="${entry.meta.id}"]`);
          if (!wrapper) continue;
          const body = wrapper.querySelector('[data-panel-body]');
          try {
            const ctx = {
              dev,
              hudApi: buildHudApi(),
              getCoreState: buildCoreSnapshot,
              persistHudState,
              flags: window.cblcars._debugFlags || {}
            };
            const ret = entry.meta.render(ctx);
            entry.instance = {
              rootEl: ret?.rootEl || body,
              cleanup: ret?.cleanup || (()=>{}),
              refresh: ret?.refresh || (()=>{}),
              bodyRef: body
            };
            if (ret?.rootEl && ret.rootEl !== body) {
              body.innerHTML = '';
              body.appendChild(ret.rootEl);
            }
            entry.instance.refresh(snapshot);
          } catch (e) {
            body.innerHTML = `<div style="color:#ff4d78;">Panel init error: ${e?.message||e}</div>`;
          }
        }
      }
      updatePanelBadges(snapshot);
    }

    function updatePanelBadges(snapshot) {
      const panel = document.getElementById(HUD_ID);
      const container = panel?.querySelector('[data-panels]');
      if (!container) return;
      for (const entry of panelRegistry.values()) {
        const w = container.querySelector(`[data-panel="${entry.meta.id}"]`);
        if (!w) continue;
        const badgeEl = w.querySelector('[data-panel-badge]');
        let val = '';
        if (typeof entry.meta.badge === 'function') {
          try { val = entry.meta.badge(snapshot) ?? ''; } catch(_) {}
        }
        badgeEl.textContent = val;
      }
    }

    function refreshPanels(snapshot) {
      for (const entry of panelRegistry.values()) {
        if (entry.instance?.refresh) {
          try { entry.instance.refresh(snapshot); } catch(_) {}
        }
      }
      updatePanelBadges(snapshot);
    }

    function buildHudApi() {
      return {
        bringToFront,
        setInterval(ms){ setIntervalMs(ms); },
        applyProfile(name){
          if (!FLAG_PROFILES[name]) return;
          dev.flags(FLAG_PROFILES[name]);
          selectedProfile = name;
          persistHudState({ selectedProfile:name, flags: window.cblcars._debugFlags });
          const panel = document.getElementById(HUD_ID);
          if (panel) renderQuickFlags(panel,true);
        },
        // setLocation is now a no-op (global only)
        setLocation(mode){
          console.info('[cblcars.dev.hud] setLocation ignored; HUD is global-only now.', mode);
        }
      };
    }

    /* Built-In Panels Registration (once) */
    function buildBuiltinPanelsOnce() {
      if (builtInsRegistered) return;
      builtInsRegistered = true;

      // Summary Panel
      registerPanel({
        id:'summary',
        title:'Summary',
        order: INTERNAL_ORDERS.summary,
        badge: snap => snap.routesSummary.total || '',
        render(){
          const root = document.createElement('div');
          root.style.fontSize='11px';
          root.innerHTML = `<div data-sum-routes></div>
            <div data-sum-scenarios style="margin-top:6px;"></div>
            <div data-sum-channels style="margin-top:6px;"></div>`;
          return {
            rootEl: root,
            refresh(snapshot){
              const rs = snapshot.routesSummary;
              root.querySelector('[data-sum-routes]').innerHTML =
                `<div style="font-weight:bold;margin-bottom:2px;">Routes</div>
                 <div>Total: ${rs.total} | Detours ${rs.detours} | Grid OK ${rs.gridSucc} | FB ${rs.gridFb} | Miss ${rs.miss}</div>`;
              const scDiv = root.querySelector('[data-sum-scenarios]');
              const results = snapshot.scenarioResults;
              if (results.length) {
                const pass = results.filter(r=>r.ok).length;
                const lines = results.slice(0,3).map(r =>
                  `<div style="color:${r.ok?'#53ff93':'#ff4d78'};">${r.scenario}: ${r.ok?'OK':'FAIL'}</div>`
                ).join('');
                scDiv.innerHTML = `<div style="font-weight:bold;margin-bottom:2px;">Scenarios</div>
                  <div>${pass}/${results.length} passed</div>${lines}`;
              } else {
                scDiv.innerHTML = `<div style="font-weight:bold;margin-bottom:2px;">Scenarios</div>
                  <div style="opacity:.6;">(none)</div>`;
              }
              const chDiv = root.querySelector('[data-sum-channels]');
              const ch = snapshot.channels;
              if (ch && Object.keys(ch).length) {
                const top = Object.entries(ch).sort((a,b)=>b[1]-a[1]).slice(0,3)
                  .map(([id,v])=>`<div style="display:flex;justify-content:space-between;"><span>${id}</span><span>${v}</span></div>`).join('');
                chDiv.innerHTML = `<div style="font-weight:bold;margin-bottom:2px;">Channels</div>${top}`;
              } else {
                chDiv.innerHTML = `<div style="font-weight:bold;margin-bottom:2px;">Channels</div><div style="opacity:.6;">(none)</div>`;
              }
            }
          };
        }
      });

      // Flags & Profiles
      registerPanel({
        id:'flags',
        title:'Flags & Profiles',
        order: INTERNAL_ORDERS.flags,
        render(){
          const root = document.createElement('div');
          root.style.fontSize='11px';
          root.innerHTML = `
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;" data-flags-grid></div>
            <div data-current-prof style="margin-top:4px;opacity:.75;"></div>
            <div style="margin-top:6px;">
              <button data-apply-prof="Minimal" style="font-size:10px;">Minimal</button>
              <button data-apply-prof="Routing" style="font-size:10px;">Routing</button>
              <button data-apply-prof="Perf" style="font-size:10px;">Perf</button>
              <button data-apply-prof="Full" style="font-size:10px;">Full</button>
            </div>
            <div style="margin-top:6px;font-size:10px;opacity:.6;">Profiles override existing flags (Custom = mixed state).</div>
          `;
          function rebuild() {
            const grid = root.querySelector('[data-flags-grid]');
            const flagsObj = window.cblcars._debugFlags || {};
            const allKeys = Array.from(new Set([
              ...Object.keys(flagsObj),
              ...QUICK_FLAG_KEYS,
              'validation','smart','counters','svg_perf_overlay'
            ])).sort();
            grid.innerHTML = allKeys.map(k=>{
              const on = !!flagsObj[k];
              return `<button data-flag-detail="${k}"
                style="font-size:10px;padding:2px 6px;margin:2px;cursor:pointer;
                border:1px solid #552266;border-radius:3px;
                background:${on?'#ff00ff':'#333'};color:${on?'#120018':'#ffd5ff'};"
                data-tip="${k}" data-tip-detail="Toggle debug flag '${k}'.">${k}</button>`;
            }).join('');
            grid.querySelectorAll('[data-flag-detail]').forEach(btn=>{
              btn.addEventListener('click',()=>{
                const fk = btn.getAttribute('data-flag-detail');
                const nf = !(window.cblcars._debugFlags||{})[fk];
                dev.flags({ [fk]: nf });
                persistHudState({ flags: window.cblcars._debugFlags });
                rebuild();
              });
            });
            root.querySelector('[data-current-prof]').textContent = `Profile: ${selectedProfile}`;
          }
          root.querySelectorAll('[data-apply-prof]').forEach(b=>{
            b.addEventListener('click',()=>{
              const prof = b.getAttribute('data-apply-prof');
              if (!FLAG_PROFILES[prof]) return;
              dev.flags(FLAG_PROFILES[prof]);
              selectedProfile = prof;
              persistHudState({ selectedProfile: prof, flags: window.cblcars._debugFlags });
              rebuild();
              const panel = document.getElementById(HUD_ID);
              if (panel) renderQuickFlags(panel,true);
            });
          });
          rebuild();
          return { rootEl: root, refresh(){} };
        }
      });

      // Perf & Timers
      registerPanel({
        id:'perf',
        title:'Perf & Timers',
        order: INTERNAL_ORDERS.perf,
        badge: snap => Object.keys(snap.perfTimers||{}).length || '',
        render(){
          const root = document.createElement('div');
          root.style.fontSize='11px';
          root.innerHTML = `
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
              <button data-perf-reset style="font-size:10px;">Reset Perf</button>
              <button data-perf-reset-timers style="font-size:10px;">Reset Timers</button>
            </div>
            <div data-perf-timers></div>
            <hr style="border:none;border-top:1px solid #442255;margin:8px 0;">
            <div data-perf-counters></div>
          `;
          root.querySelector('[data-perf-reset]')?.addEventListener('click',()=>{ try{ window.cblcars.perf.reset(); }catch(_){ } });
          root.querySelector('[data-perf-reset-timers]')?.addEventListener('click',()=>{ try{ window.cblcars.debug?.perf?.reset(); }catch(_){ } });
          return {
            rootEl: root,
            refresh(snapshot){
              const timersDiv = root.querySelector('[data-perf-timers]');
              const countersDiv = root.querySelector('[data-perf-counters]');
              const timers = snapshot.perfTimers;
              const tKeys = Object.keys(timers);
              if (!tKeys.length) {
                timersDiv.innerHTML = `<div style="font-weight:bold;margin-bottom:2px;">Timers</div><div style="opacity:.6;">(none yet)</div>`;
              } else {
                let html = `<div style="font-weight:bold;margin-bottom:2px;">Timers</div>`;
                tKeys.forEach(k=>{
                  const t = timers[k];
                  html += `<div>${k}: last=${t.lastMs.toFixed(2)}ms avg=${t.avgMs.toFixed(2)}ms max=${t.maxMs.toFixed(1)} n=${t.count}</div>`;
                });
                timersDiv.innerHTML = html;
              }
              const counters = snapshot.perfCounters || {};
              const cKeys = Object.keys(counters);
              if (!cKeys.length) {
                countersDiv.innerHTML = `<div style="font-weight:bold;margin-bottom:2px;">Counters</div><div style="opacity:.6;">(none yet)</div>`;
              } else {
                let html = `<div style="font-weight:bold;margin-bottom:2px;">Counters</div>`;
                cKeys.sort().slice(0,60).forEach(k=>{
                  const c = counters[k];
                  const avgMs = c.avgMs!=null ? ` avg=${c.avgMs.toFixed(1)}ms` : '';
                  html += `<div>${k}: c=${c.count}${avgMs}</div>`;
                });
                if (cKeys.length > 60) html += `<div style="opacity:.6;">(+${cKeys.length-60} more)</div>`;
                countersDiv.innerHTML = html;
              }
            }
          };
        }
      });

      // Routes
      registerPanel({
        id:'routes',
        title:'Routes',
        order: INTERNAL_ORDERS.routes,
        badge: snap => snap.routesSummary.total || '',
        render(){
          const root = document.createElement('div');
          root.style.fontSize='11px';
          root.innerHTML = `
            <div style="margin-bottom:4px;display:flex;gap:4px;flex-wrap:wrap;">
              <button data-routes-refresh style="font-size:10px;">Refresh Now</button>
              <button data-routes-filter="detour" style="font-size:10px;">Detours</button>
              <button data-routes-filter="miss" style="font-size:10px;">Channel Miss</button>
              <button data-routes-filter="reset" style="font-size:10px;">Reset Filter</button>
            </div>
            <table data-routes-table style="border-collapse:collapse;width:100%;font-size:10px;">
              <thead>
                <tr>
                  <th data-sort="id">ID</th>
                  <th data-sort="eff">Mode</th>
                  <th data-sort="grid">Grid</th>
                  <th data-sort="detour">Det</th>
                  <th data-sort="miss">Miss</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
            <div data-routes-empty style="display:none;opacity:.6;margin-top:4px;">(no routes)</div>
          `;
          let currentSort = { field:'id', dir:1 };
          let filterMode = null;
          root.querySelectorAll('th[data-sort]').forEach(th=>{
            th.style.cursor='pointer';
            th.addEventListener('click',()=>{
              const field=th.getAttribute('data-sort');
              if(currentSort.field===field) currentSort.dir*=-1;
              else currentSort={field,dir:1};
              renderRows(lastSnapshot);
            });
          });
          root.querySelectorAll('[data-routes-filter]').forEach(btn=>{
            btn.addEventListener('click',()=>{
              const mode=btn.getAttribute('data-routes-filter');
              filterMode = mode==='reset' ? null : mode;
              renderRows(lastSnapshot);
            });
          });
          root.querySelector('[data-routes-refresh]').addEventListener('click',()=>renderRows(buildCoreSnapshot()));
          let lastSnapshot=null;
          function renderRows(snapshot){
            lastSnapshot=snapshot;
            const tbody=root.querySelector('tbody');
            const empty=root.querySelector('[data-routes-empty]');
            const all=(snapshot?.routesRaw)||[];
            let rows=all.map(r=>({
              id:r.id,
              eff:r['data-cblcars-route-effective']||'',
              grid:r['data-cblcars-route-grid-status']||'',
              detour:r['data-cblcars-route-detour']==='true',
              miss:r['data-cblcars-route-channels-miss']==='true'
            }));
            if(filterMode==='detour') rows=rows.filter(r=>r.detour);
            else if(filterMode==='miss') rows=rows.filter(r=>r.miss);
            rows.sort((a,b)=>{
              const f=currentSort.field;
              const av=a[f], bv=b[f];
              if(av===bv) return 0;
              return (av>bv?1:-1)*currentSort.dir;
            });
            tbody.innerHTML=rows.slice(0,120).map(r=>`
              <tr>
                <td>${r.id||''}</td>
                <td>${r.eff}</td>
                <td>${r.grid}</td>
                <td style="color:${r.detour?'#ffcc00':'#888'};">${r.detour?'Y':''}</td>
                <td style="color:${r.miss?'#ff4d78':'#888'};">${r.miss?'Y':''}</td>
              </tr>`).join('');
            empty.style.display=rows.length?'none':'block';
          }
          return { rootEl:root, refresh(snapshot){ renderRows(snapshot); } };
        }
      });

      // Actions
      registerPanel({
        id:'actions',
        title:'Actions',
        order: INTERNAL_ORDERS.actions,
        render(){
          const root=document.createElement('div');
          root.style.fontSize='11px';
          root.innerHTML=`
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              <button data-act="list-cards" data-tip="List Cards" data-tip-detail="Console: cblcars.dev.listCards()" style="font-size:10px;">List Cards</button>
              <button data-act="relayout" data-tip="Relayout" data-tip-detail="Relayout all connectors now." style="font-size:10px;">Relayout</button>
              <button data-act="reset-perf" data-tip="Reset Perf" data-tip-detail="Reset internal perf counters." style="font-size:10px;">Reset Perf</button>
              <button data-act="toggle-aggressive" data-tip="Toggle Smart Aggressive" data-tip-detail="Toggle runtime smart_aggressive mode." style="font-size:10px;">Smart Agg</button>
              <button data-act="toggle-detour" data-tip="Toggle Detour" data-tip-detail="Enable/disable two-elbow detour fallback." style="font-size:10px;">Detour</button>
            </div>
            <div data-actions-status style="margin-top:6px;opacity:.75;font-size:10px;"></div>
          `;
          function setStatus(msg){ const el=root.querySelector('[data-actions-status]'); el.textContent=msg; }
          root.querySelectorAll('[data-act]').forEach(btn=>{
            btn.addEventListener('click',()=>{
              const act=btn.getAttribute('data-act');
              try {
                switch(act){
                  case 'list-cards':
                    dev.listCards();
                    setStatus('Listed cards in console.');
                    break;
                  case 'relayout':
                    dev.relayout('*');
                    setStatus('Relayout requested.');
                    break;
                  case 'reset-perf':
                    window.cblcars.perf.reset();
                    setStatus('Perf counters reset.');
                    break;
                  case 'toggle-aggressive': {
                    const rt=dev.getRuntime(); const cur=!!rt.smart_aggressive;
                    dev.setRuntime({ smart_aggressive: !cur });
                    setStatus(`smart_aggressive=${!cur}`);
                    break;
                  }
                  case 'toggle-detour': {
                    const rt=dev.getRuntime(); const cur=!!(rt.fallback?.enable_two_elbow);
                    dev.setRuntime({ fallback:{ enable_two_elbow: !cur } });
                    setStatus(`detour=${!cur}`);
                    break;
                  }
                  default: break;
                }
              } catch(e) {
                setStatus('Error: '+(e?.message||e));
              }
            });
          });
          return { rootEl:root, refresh(){} };
        }
      });
    } // buildBuiltinPanelsOnce end

    /* Interval & Refresh */
    function setIntervalMs(ms) {
      hudInterval = ms;
      persistHudState({ interval: hudInterval });
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(()=>refresh(), hudInterval);
    }

    function refresh(forcePersist) {
      if (!dev.hud._enabled) return;
      const panel = document.getElementById(HUD_ID);
      if (!panel) { ensure(); return; }
      populateCardSelector(panel);
      const snapshot = buildCoreSnapshot();
      refreshPanels(snapshot);
      if (forcePersist) {
        persistHudState({
          position: dragPos,
          collapsed,
          interval: hudInterval,
          verboseFlags,
          selectedProfile
        });
      }
    }

    function populateCardSelector(panel) {
      const sel = panel.querySelector('[data-card]');
      if (!sel) return;
      const cards = dev.discoverMsdCards ? dev.discoverMsdCards() : [];
      const actIdx = dev.persistedState?.activeCardIndex != null
        ? dev.persistedState.activeCardIndex
        : cards.indexOf(dev._activeCard);
      if (sel.options.length !== cards.length) {
        sel.innerHTML='';
        cards.forEach((c,i)=>{
          const opt=document.createElement('option');
          opt.value=String(i);
          opt.textContent=`${i}:${c.id||c.tagName.toLowerCase()}`;
          sel.appendChild(opt);
        });
      }
      if (actIdx>=0 && actIdx<sel.options.length) sel.selectedIndex=actIdx;
    }

    function bringToFront() {
      const panel = document.getElementById(HUD_ID);
      if (!panel) return;
      document.body.appendChild(panel);
      panel.style.zIndex = HUD_Z;
    }

    /* Public API */
    Object.assign(dev.hud, {
      ensure,
      remove: removeHud,
      refresh: () => refresh(true),
      setInterval: setIntervalMs,
      collapse: () => { collapsed=true; persistHudState({collapsed}); refresh(true); },
      expand: () => { collapsed=false; persistHudState({collapsed}); refresh(true); },
      toggle: () => { collapsed=!collapsed; persistHudState({collapsed}); refresh(true); },
      recenter: () => {
        dragPos=null;
        persistHudState({ position:null });
        const p=document.getElementById(HUD_ID);
        if (p) styleGlobal(p);
      },
      bringToFront,
      setLocation(mode){
        console.info('[cblcars.dev.hud] setLocation ignored; HUD is global-only.', mode);
      },
      registerPanel: meta => { registerPanel(meta); renderPanelsShell(); refreshPanels(buildCoreSnapshot()); },
      unregisterPanel: id => { unregisterPanel(id); },
      status() {
        return {
          enabled: dev.hud._enabled,
          locationPref: 'global',
          collapsed,
          interval: hudInterval,
          verboseFlags,
          selectedProfile,
          panelCount: panelRegistry.size
        };
      }
    });

    // Patch pick/setCard just to refresh (even though we are global)
    const origPick = dev.pick;
    dev.pick = function(i){ const r=origPick.call(dev,i); if(dev.hud._enabled) setTimeout(()=>refresh(),40); return r; };
    const origSetCard = dev.setCard;
    dev.setCard = function(el){ const r=origSetCard.call(dev,el); if(dev.hud._enabled) setTimeout(()=>refresh(),40); return r; };

    // Start
    setIntervalMs(hudInterval);
    if (readHudState().enabled) {
      dev.hud._enabled = true;
      setTimeout(()=>ensure(), 60);
    }

    dev.hud._phase1Attached = true;
    console.info('[cblcars.dev.hud] Phase 1 HUD (global-only) attached');
  }

})();