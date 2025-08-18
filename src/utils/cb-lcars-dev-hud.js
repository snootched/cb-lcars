/**
 * CB-LCARS Developer HUD (Enhanced + Location / Drag / Flags / Scenarios / Channels)
 *
 * Features:
 *  - Single instance (never duplicates): moves between global (document.body) and active MSD card shadowRoot
 *  - High z-index & re-append ordering to remain interactive above overlays
 *  - Card vs Global location toggle (persisted)
 *  - Draggable header (position persisted per-tab via dev.persist)
 *  - Collapsible (persisted)
 *  - Adjustable auto-refresh interval (persisted)
 *  - Debug flag quick toggles (Overlay / Connectors / Perf / Geometry / Channels)
 *  - Active card selector dropdown (when multiple MSD cards)
 *  - Scenario results (color-coded, top 6 + summary)
 *  - Route summary: totals, detours, grid successes/fallbacks, channel miss
 *  - Perf counters subset
 *  - Channel occupancy (top 3) if channel system active
 *  - Helpers: status(), debug(), setInterval(ms), collapse/expand/toggle, recenter(), bringToFront(), setLocation(mode), clickThroughTest()
 *
 * Persistence schema (sessionStorage via dev.persist):
 *  dev.persistedState.hud = {
 *     enabled: boolean,
 *     position: [x,y] | null,
 *     collapsed: boolean,
 *     interval: number,
 *     location: 'card' | 'global',
 *     flags?: { overlay?:bool, connectors?:bool, perf?:bool, geometry?:bool, channels?:bool }
 *  }
 *
 * Loads only when:
 *  - URL contains ?lcarsDev=1  OR  window.CBLCARS_DEV_FORCE === true
 *  - NOT disabled by window.CBLCARS_DEV_DISABLE
 *
 * Assumes dev tools (cb-lcars-dev-tools.js) have attached (will retry until they do).
 */
(function initHud() {
  const qs       = new URLSearchParams(location.search);
  const force    = (window.CBLCARS_DEV_FORCE === true);
  const disabled = (window.CBLCARS_DEV_DISABLE === true);
  const active   = !disabled && (qs.has('lcarsDev') || force);
  if (!active) return;

  const RETRY_MS = 120;
  let attempts   = 0;

  function devReady() {
    return !!(window.cblcars && window.cblcars.dev && window.cblcars.dev._advanced);
  }

  function attemptAttach() {
    if (!devReady()) {
      if (attempts++ < 50) return setTimeout(attemptAttach, RETRY_MS);
      console.warn('[cblcars.dev.hud] Dev tools not ready; aborting HUD attach.');
      return;
    }
    attachHudApi();
  }

  function attachHudApi() {
    const dev = window.cblcars.dev;
    if (dev.hud && dev.hud._apiAttached) {
      console.info('[cblcars.dev.hud] HUD API already attached.');
      return;
    }

    const HUD_ID = 'cblcars-dev-hud-panel';
    const HUD_Z  = 2147480000; // very large z-index to beat almost all contexts

    /* ---------------- Persistence helpers ---------------- */
    function persistHudState(patch) {
      try {
        if (typeof dev._persistHudState === 'function') {
          dev._persistHudState(patch);
          return;
        }
        const cur = dev.persistedState?.hud || {};
        dev.persist({ hud: { ...cur, ...patch } });
      } catch (_) {}
    }
    function readHudState() {
      return (dev.persistedState && dev.persistedState.hud) || {};
    }

    /* ---------------- Internal state ---------------- */
    let refreshTimer = null;
    let dragPos      = null;
    let collapsed    = false;
    let hudInterval  = 3000;
    let locationPref = 'global'; // 'card' | 'global'
    let panelDraggableInitialized = false;

    const FLAG_KEYS = ['overlay','connectors','perf','geometry','channels'];

    (function initStateFromPersist() {
      const p = readHudState();
      if (Array.isArray(p.position) && p.position.length >= 2 && p.position.every(n => Number.isFinite(n))) {
        dragPos = [p.position[0], p.position[1]];
      }
      if (typeof p.collapsed === 'boolean') collapsed = p.collapsed;
      if (Number.isFinite(p.interval) && p.interval >= 1000) hudInterval = p.interval;
      if (p.location === 'global' || p.location === 'card') locationPref = p.location;
    })();

    /* ---------------- Active card root helpers ---------------- */
    function getActiveCardRoot() {
      const card = dev._activeCard;
      if (card && card.shadowRoot) return { card, root: card.shadowRoot };
      return { card: null, root: null };
    }

    /* ---------------- Ensure / mount logic (single instance) ---------------- */
    function ensure() {
      dev.hud._enabled = true;
      const { root } = getActiveCardRoot();
      if (locationPref === 'global' || !root) {
        mountGlobal();
      } else {
        mountIntoCard(root);
      }
      refresh(true);
      // After initial paint, verify we are actually topmost; if not, auto-elevate.
      setTimeout(()=>dev.hud.autoElevate && dev.hud.autoElevate(), 80);
    }

    function mountGlobal() {
      let panel = document.getElementById(HUD_ID);
      if (!panel) {
        panel = document.createElement('div');
        panel.id = HUD_ID;
      }
      styleAsGlobal(panel);
      // Always append last to assert top stacking
      if (panel.parentNode !== document.body) {
        document.body.appendChild(panel);
      } else {
        document.body.appendChild(panel); // re-append to end
      }
      if (!panel.querySelector('[data-body]')) {
        panel.innerHTML = panelMarkup();
        wireHud(panel);
      } else {
        syncCollapsedUi(panel);
        updateLocationButton(panel);
      }
      panel.dataset.location = 'global';
      restorePosition(panel);
    }

    function mountIntoCard(root) {
      const hostBox = root.querySelector('#cblcars-msd-wrapper') || root;
      let panelInCard = root.getElementById(HUD_ID);
      let fallbackPanel = document.getElementById(HUD_ID);

      // Already inside this card
      if (panelInCard) {
        styleAsCard(panelInCard);
        if (!panelInCard.querySelector('[data-body]')) {
          panelInCard.innerHTML = panelMarkup();
          wireHud(panelInCard);
        } else {
          syncCollapsedUi(panelInCard);
          updateLocationButton(panelInCard);
        }
        panelInCard.dataset.location = 'card';
        restorePosition(panelInCard);
        hostBox.appendChild(panelInCard); // ensure last for stacking order
        return;
      }

      // Reuse global fallback panel
      if (fallbackPanel && fallbackPanel.dataset.location === 'global') {
        styleAsCard(fallbackPanel);
        hostBox.appendChild(fallbackPanel); // move + last
        if (!fallbackPanel.querySelector('[data-body]')) {
          fallbackPanel.innerHTML = panelMarkup();
          wireHud(fallbackPanel);
        } else {
          syncCollapsedUi(fallbackPanel);
          updateLocationButton(fallbackPanel);
        }
        fallbackPanel.dataset.location = 'card';
        restorePosition(fallbackPanel);
        return;
      }

      // Create new
      const panel = document.createElement('div');
      panel.id = HUD_ID;
      styleAsCard(panel);
      panel.innerHTML = panelMarkup();
      hostBox.appendChild(panel);
      wireHud(panel);
      panel.dataset.location = 'card';
      restorePosition(panel);
    }

    function remove() {
      dev.hud._enabled = false;
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
      const panel = document.getElementById(HUD_ID) || (getActiveCardRoot().root?.getElementById(HUD_ID));
      if (panel) panel.remove();
    }

    /* ---------------- Styling ---------------- */
    function baseStyle(panel) {
      Object.assign(panel.style, {
        background: 'rgba(15,0,30,0.82)',
        color: '#ffd5ff',
        font: '12px/1.35 monospace',
        padding: '0',
        border: '1px solid #ff00ff',
        borderRadius: '6px',
        maxWidth: '340px',
        minWidth: '250px',
        zIndex: HUD_Z,
        pointerEvents: 'auto',
        backdropFilter: 'blur(2px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.55)',
        isolation: 'isolate'
      });
    }
    function styleAsGlobal(panel) {
      baseStyle(panel);
      panel.style.position = 'fixed';
      if (!dragPos) {
        panel.style.top = '12px';
        panel.style.right = '12px';
        panel.style.left = '';
      } else {
        panel.style.left = dragPos[0] + 'px';
        panel.style.top  = dragPos[1] + 'px';
        panel.style.right = '';
      }
    }
    function styleAsCard(panel) {
      baseStyle(panel);
      panel.style.position = 'absolute';
      if (!dragPos) {
        panel.style.top = '8px';
        panel.style.right = '8px';
        panel.style.left = '';
      } else {
        panel.style.left = dragPos[0] + 'px';
        panel.style.top  = dragPos[1] + 'px';
        panel.style.right = '';
      }
    }

    /* ---------------- Markup & wiring ---------------- */
    function panelMarkup() {
      const flags = window.cblcars._debugFlags || {};
      const flagBtns = FLAG_KEYS.map(k => {
        const on = !!flags[k];
        return `<button data-flag="${k}" data-on="${on?1:0}"
            style="font-size:10px;margin:2px;padding:2px 5px;border:1px solid #552266;
                   background:${on?'#ff00ff':'#333'};color:${on?'#120018':'#ffd5ff'};
                   border-radius:3px;cursor:pointer;">${k[0].toUpperCase()}</button>`;
      }).join('');
      return `
        <div data-hdr style="cursor:move;user-select:none;display:flex;align-items:center;
             gap:6px;padding:6px 8px;background:linear-gradient(90deg,#30003f,#120018);
             border-bottom:1px solid #ff00ff;">
          <strong style="font-size:12px;flex:1 1 auto;">LCARS Dev HUD</strong>
          <select data-card style="font-size:11px;max-width:130px;"></select>
          <button data-loc style="font-size:11px;padding:2px 5px;" title="Toggle global/card">${locationPref==='global'?'G':'C'}</button>
          <button data-collapse style="font-size:11px;padding:2px 6px;cursor:pointer;">
            ${collapsed ? '▢':'▣'}
          </button>
          <button data-remove style="font-size:11px;padding:2px 6px;cursor:pointer;">✕</button>
        </div>
        <div data-toolbar style="display:flex;flex-wrap:wrap;align-items:center;
             padding:4px 6px;border-bottom:1px solid #552266;">
          <span style="font-size:10px;opacity:.65;margin-right:4px;">Flags:</span>
          <span data-flags style="display:flex;flex-wrap:wrap;align-items:center;">${flagBtns}</span>
          <span style="margin-left:auto;font-size:10px;opacity:.7;">Interval</span>
          <input data-int type="number" min="1000" step="500"
                 value="${hudInterval}" style="width:70px;font-size:10px;margin-left:4px;">
          <button data-refresh style="font-size:10px;margin-left:4px;padding:2px 6px;cursor:pointer;">↻</button>
        </div>
        <div data-body style="padding:6px 8px;${collapsed?'display:none;':''}">Initializing...</div>
        <div data-footer style="padding:4px 8px;border-top:1px solid #552266;
             font-size:10px;${collapsed?'display:none;':''};opacity:.6;">
          Drag header. Switch card via dropdown. Toggle flags. ↻ refresh.
        </div>
      `;
    }

    function wireHud(panel) {
      // Refresh
      panel.querySelector('[data-refresh]')?.addEventListener('click', () => refresh(true));
      // Remove
      panel.querySelector('[data-remove]')?.addEventListener('click', () => {
        persistHudState({ enabled: false });
        remove();
      });
      // Collapse
      panel.querySelector('[data-collapse]')?.addEventListener('click', () => toggleCollapse());
      // Interval change
      panel.querySelector('[data-int]')?.addEventListener('change', e => {
        const v = parseInt(e.target.value, 10);
        if (Number.isFinite(v) && v >= 1000) setIntervalMs(v);
      });
      // Flags
      panel.querySelectorAll('[data-flag]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-flag');
          const currentFlags = window.cblcars._debugFlags || {};
          const nextVal = !currentFlags[key];
          dev.flags({ [key]: nextVal });
          styleFlagButton(btn, nextVal);
          persistHudState({
            flags: {
              ...(readHudState().flags || {}),
              [key]: nextVal
            }
          });
          // Force debug redraw
            try {
              const cards = dev.discoverMsdCards();
              cards.forEach(c => {
                const root = c.shadowRoot;
                if (!root) return;
                const vb = c._config?.variables?.msd?._viewBox || [0,0,100,100];
                window.cblcars.debug?.render?.(root, vb, { anchors: root.__cblcars_anchors });
                window.cblcars.routing?.channels?.ensureChannelDebug?.(root);
              });
            } catch(_) {}
        });
      });
      // Card selector
      panel.querySelector('[data-card]')?.addEventListener('change', e => {
        const idx = parseInt(e.target.value, 10);
        if (Number.isFinite(idx)) {
          dev.pick(idx);
          refresh(true);
        }
      });
      // Location toggle
      panel.querySelector('[data-loc]')?.addEventListener('click', () => {
        locationPref = locationPref === 'global' ? 'card' : 'global';
        persistHudState({ location: locationPref });
        ensure();
      });

      // Drag
      setupDrag(panel);
      // Populate card selector initially
      populateCardSelector(panel);
      // Reflect collapsed
      syncCollapsedUi(panel);
    }

    function styleFlagButton(btn, on) {
      btn.setAttribute('data-on', on ? '1':'0');
      btn.style.background = on ? '#ff00ff' : '#333';
      btn.style.color = on ? '#120018' : '#ffd5ff';
    }

    function updateLocationButton(panel) {
      const btn = panel.querySelector('[data-loc]');
      if (btn) btn.textContent = (locationPref === 'global' ? 'G' : 'C');
    }

    function syncCollapsedUi(panel) {
      const body = panel.querySelector('[data-body]');
      const footer = panel.querySelector('[data-footer]');
      const collapseBtn = panel.querySelector('[data-collapse]');
      if (body) body.style.display = collapsed ? 'none':'block';
      if (footer) footer.style.display = collapsed ? 'none':'block';
      if (collapseBtn) collapseBtn.textContent = collapsed ? '▢' : '▣';
    }

    /* ---------------- Dragging ---------------- */
    function setupDrag(panel) {
      if (panelDraggableInitialized) return;
      panelDraggableInitialized = true;
      const hdr = panel.querySelector('[data-hdr]');
      if (!hdr) return;
      let dragging = false;
      let startX = 0, startY = 0, origX = 0, origY = 0;
      hdr.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        origX = rect.left;
        origY = rect.top;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp, { once: true });
        e.preventDefault();
      });
      function onMove(e) {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const nx = origX + dx;
        const ny = origY + dy;
        panel.style.left = nx + 'px';
        panel.style.top  = ny + 'px';
        panel.style.right = '';
      }
      function onUp() {
        dragging = false;
        document.removeEventListener('mousemove', onMove);
        const rect = panel.getBoundingClientRect();
        dragPos = [rect.left, rect.top];
        persistHudState({ position: dragPos });
      }
    }

    function restorePosition(panel) {
      if (!dragPos) return;
      panel.style.left = dragPos[0] + 'px';
      panel.style.top  = dragPos[1] + 'px';
      panel.style.right = '';
    }

    /* ---------------- Collapse handling ---------------- */
    function toggleCollapse(force) {
      collapsed = (typeof force === 'boolean') ? force : !collapsed;
      const panel = document.getElementById(HUD_ID) || getActiveCardRoot().root?.getElementById(HUD_ID);
      if (panel) syncCollapsedUi(panel);
      persistHudState({ collapsed });
    }

    /* ---------------- Interval management ---------------- */
    function setIntervalMs(ms) {
      hudInterval = ms;
      persistHudState({ interval: hudInterval });
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(() => {
        if (!dev.hud._enabled) return;
        refresh();
      }, hudInterval);
      refresh(true);
    }

    /* ---------------- Card selector ---------------- */
    function populateCardSelector(panel) {
      const sel = panel.querySelector('[data-card]');
      if (!sel) return;
      const cards = dev.discoverMsdCards ? dev.discoverMsdCards() : [];
      const activeIdx = dev.persistedState?.activeCardIndex != null
        ? dev.persistedState.activeCardIndex
        : (cards.indexOf(dev._activeCard));
      const prevCount = sel.options.length;
      if (prevCount !== cards.length) {
        sel.innerHTML = '';
        cards.forEach((c, i) => {
          const opt = document.createElement('option');
          opt.value = String(i);
          opt.textContent = `${i}:${c.id || c.tagName.toLowerCase()}`;
          sel.appendChild(opt);
        });
      }
      if (activeIdx >= 0 && activeIdx < sel.options.length) {
        sel.selectedIndex = activeIdx;
      }
    }

    /* ---------------- Data summarizers ---------------- */
    function summarizeRoutes(routes) {
      let total=routes.length, detours=0, gridSucc=0, gridFallback=0, miss=0;
      routes.forEach(r => {
        if (r['data-cblcars-route-detour']==='true') detours++;
        const gs = r['data-cblcars-route-grid-status'];
        if (gs==='success') gridSucc++;
        else if (gs==='fallback') gridFallback++;
        if (r['data-cblcars-route-channels-miss']==='true') miss++;
      });
      return { total, detours, gridSucc, gridFallback, miss };
    }

    function filterPerf(dump) {
      const keysWanted = [
        'connectors.route.detour.used',
        'connectors.route.grid.success',
        'connectors.route.grid.fallback',
        'connectors.route.smart.hit',
        'connectors.route.smart.aggressive',
        'connectors.route.smart.skip',
        'connectors.layout.recomputed',
        'msd.render'
      ];
      const out = [];
      keysWanted.forEach(k => {
        const c = dump[k];
        if (c) out.push(`${k.split('.').slice(2).join('.')}: ${c.count}`);
      });
      return out;
    }

    /* ---------------- Refresh ---------------- */
    function refresh(forcePersist) {
      if (!dev.hud._enabled) return;

      const { root } = getActiveCardRoot();
      let panel = root?.getElementById(HUD_ID) || document.getElementById(HUD_ID);
      if (!panel) {
        // Attempt to re-create
        ensure();
        panel = root?.getElementById(HUD_ID) || document.getElementById(HUD_ID);
        if (!panel) return;
      }
      const body = panel.querySelector('[data-body]');
      if (!body) return;

      // Routes
      let routes = [];
      try { routes = dev.dumpRoutes(undefined, { silent: true }); } catch (_) {}
      const summary = summarizeRoutes(routes);

      // Perf subset
      let perfLines = [];
      try {
        const dump = window.cblcars.perfDump ? window.cblcars.perfDump() : (window.cblcars.perf?.dump?.() || {});
        perfLines = filterPerf(dump);
      } catch (_) {}

      // Scenarios
      const scenarioCache = dev._scenarioResults || [];
      const passCount = scenarioCache.filter(r => r && r.ok).length;
      const scenarioSummary = scenarioCache.length
        ? `${passCount}/${scenarioCache.length} passed`
        : 'No scenarios yet';
      const scenarioLines = scenarioCache.slice(0, 6).map(s =>
        `<div style="color:${s.ok ? '#53ff93':'#ff4d78'};">${s.scenario}: ${s.ok?'OK':'FAIL'}${s.details?` (${s.details})`:''}</div>`
      ).join('');

      // Card index
      const cardIdx = (() => {
        try {
          const list = dev.discoverMsdCards ? dev.discoverMsdCards() : [];
          const idx = list.indexOf(dev._activeCard);
          return idx >= 0 ? idx : '-';
        } catch { return '-'; }
      })();
      const persistedIdx = dev.persistedState?.activeCardIndex != null
        ? dev.persistedState.activeCardIndex
        : cardIdx;

      // Channel occupancy
      let occupancyHtml = '';
      try {
        const occ = window.cblcars?.routing?.channels?.getOccupancy?.();
        if (occ && Object.keys(occ).length) {
          const rows = Object.entries(occ).sort((a,b)=>b[1]-a[1]).slice(0,3);
          occupancyHtml = rows.map(([id,val]) =>
            `<div style="display:flex;justify-content:space-between;"><span>${id}</span><span>${val}</span></div>`
          ).join('');
        }
      } catch(_) {}

      body.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:4px;line-height:1.3;">
          <div style="flex:1 1 100%;">Card: <strong>${persistedIdx}</strong></div>
          <div style="flex:1 1 100%;">Routes: ${summary.total}
            <span style="opacity:.7;">(detour ${summary.detours} | grid ok ${summary.gridSucc} | fb ${summary.gridFallback})</span>
          </div>
          <div style="flex:1 1 100%;">Channel Miss: ${summary.miss}</div>
        </div>
        <hr style="border:none;border-top:1px solid #442255;margin:6px 0;">
        <div>
          <div style="font-weight:bold;margin-bottom:2px;">Perf</div>
          ${perfLines.length ? perfLines.map(l=>`<div>${l}</div>`).join('') : '<div style="opacity:.55;">(no perf counters)</div>'}
        </div>
        <hr style="border:none;border-top:1px solid #442255;margin:6px 0;">
        <div>
          <div style="font-weight:bold;margin-bottom:2px;">Scenarios <span style="opacity:.7;">${scenarioSummary}</span></div>
          ${scenarioLines || '<div style="opacity:.55;">(none)</div>'}
        </div>
        <hr style="border:none;border-top:1px solid #442255;margin:6px 0;">
        <div>
          <div style="font-weight:bold;margin-bottom:2px;">Channels</div>
          ${occupancyHtml || '<div style="opacity:.55;">(no occupancy)</div>'}
        </div>
      `;

      populateCardSelector(panel);
      updateLocationButton(panel);

      if (forcePersist) {
        persistHudState({
          interval: hudInterval,
          collapsed,
          position: dragPos,
          location: locationPref
        });
      }
    }

    /* ---------------- Public API exposure ---------------- */
    dev.hud.ensure = ensure;
    dev.hud.remove = remove;
    dev.hud.refresh = refresh;
    dev.hud.forceRefresh = ensure;
    dev.hud.setInterval = setIntervalMs;
    dev.hud.collapse = () => toggleCollapse(true);
    dev.hud.expand = () => toggleCollapse(false);
    dev.hud.toggle = () => toggleCollapse();
    dev.hud.recenter = () => {
      dragPos = null;
      persistHudState({ position: null });
      const panel = document.getElementById(HUD_ID);
      if (panel) {
        if (panel.dataset.location === 'card') {
          styleAsCard(panel);
        } else {
          styleAsGlobal(panel);
        }
      }
    };
    dev.hud.bringToFront = () => {
      const panel = document.getElementById(HUD_ID);
      if (!panel) return;
      panel.style.zIndex = HUD_Z;
      // Re-append for stacking
      if (panel.dataset.location === 'global') {
        document.body.appendChild(panel);
      } else {
        const { root } = getActiveCardRoot();
        const hostBox = root?.querySelector('#cblcars-hud-layer') || root?.querySelector('#cblcars-msd-wrapper') || root;
         if (hostBox) hostBox.appendChild(panel);
      }
    };
    dev.hud.setLocation = (mode) => {
      if (!['global','card'].includes(mode)) return;
      locationPref = mode;
      persistHudState({ location: locationPref });
      ensure();
    };
    dev.hud.clickThroughTest = () => {
      const panel = document.getElementById(HUD_ID);
      if (!panel) { console.warn('HUD panel not found'); return; }
      const rect = panel.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + 10; // near header
      const el = document.elementFromPoint(cx, cy);
      console.log('[HUD.clickThroughTest] elementFromPoint @header center:', el);
      return el;
    };

    // Attempt to detect if HUD is still underneath card overlays when in card mode.
    dev.hud.autoElevate = () => {
      try {
        if (!dev.hud._enabled) return;
        const st = dev.hud.status();
        if (st.panelLocation !== 'card') return; // only relevant in card mode
        const panel = document.getElementById(HUD_ID);
        if (!panel) return;
        const r = panel.getBoundingClientRect();
        const testX = r.left + Math.min(40, r.width/2);
        const testY = r.top + 8;
        const topEl = document.elementFromPoint(testX, testY);
        if (topEl && !panel.contains(topEl)) {
          // The HUD header is obscured; try moving to hud layer or fallback to global
            const { root } = getActiveCardRoot();
          const hudLayer = root?.querySelector('#cblcars-hud-layer');
          if (hudLayer && !hudLayer.contains(panel)) {
            hudLayer.appendChild(panel);
            panel.style.zIndex = HUD_Z;
            return;
          }
          // Fallback: switch to global
          locationPref = 'global';
          persistHud({ location: 'global' });
          ensure();
        }
      } catch(_) {}
    };

    dev.hud.status = () => {
      const { card, root } = getActiveCardRoot();
      const panel = document.getElementById(HUD_ID) || root?.getElementById(HUD_ID);
      return {
        enabled: !!dev.hud._enabled,
        hasActiveCard: !!card,
        isInCard: !!(root && root.getElementById && root.getElementById(HUD_ID)),
        hasGlobal: !!document.getElementById(HUD_ID),
        panelLocation: panel?.dataset?.location || 'none',
        collapsed,
        interval: hudInterval,
        position: dragPos,
        locationPref,
        persisted: readHudState()
      };
    };
    dev.hud.debug = () => console.log('[HUD.debug]', dev.hud.status());
    dev.hud._apiAttached = true;

    // Patch dev.pick / dev.setCard to re-ensure so panel moves
    const originalPick = dev.pick;
    dev.pick = function(idx) {
      const r = originalPick.call(dev, idx);
      if (dev.hud._enabled && locationPref === 'card') setTimeout(() => ensure(), 25);
      return r;
    };
    const originalSetCard = dev.setCard;
    dev.setCard = function(el) {
      const r = originalSetCard.call(dev, el);
      if (dev.hud._enabled && locationPref === 'card') setTimeout(() => ensure(), 25);
      return r;
    };

    // Initialize refresh loop
    setIntervalMs(hudInterval);

    // Auto-enable if persisted
    try {
      if (readHudState().enabled) {
        dev.hud._enabled = true;
        setTimeout(() => ensure(), 60);
      }
    } catch(_) {}

    console.info('[cblcars.dev.hud] HUD API attached');
  }

  attemptAttach();
})();