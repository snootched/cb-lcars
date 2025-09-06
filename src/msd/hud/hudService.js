(function initHudService(){
  if (typeof window === 'undefined') return;
  const W = window;

  const __MSD_HEADLESS = (typeof document === 'undefined');

  // --- ADDED HEADLESS EARLY RETURN (prevents document.* access in tests) ---
  if (__MSD_HEADLESS) {
    W.__msdDebug = W.__msdDebug || {};
    // Provide minimal no-op HUD surface so tests can call perf / issue publishers safely
    if (!W.__msdDebug.hud) {
      const noop = ()=>{};
      W.__msdDebug.hud = {
        show: noop, hide: noop, toggle: noop, registerPanel: noop,
        publishIssue: noop, publishRouting: noop, publishRules: noop,
        publishPacks: noop, publishPacksProvenance: noop, publishPerf: noop,
        refresh: noop, getState: () => ({ headless:true })
      };
    }
    // Avoid running the rest of the DOM-dependent initialization
    return;
  }

  // REPLACED legacy selector trap (was emitting warnings each access)
  // Provide quiet, idempotent helpers instead.
  if (typeof W.w !== 'function') {
    W.w = function(sel, root){
      if (typeof sel !== 'string') return null;
      try { return (root || document).querySelector(sel); } catch { return null; }
    };
  }
  if (typeof W.$ !== 'function') {
    W.$ = W.w; // alias
  }
  // Optional one-time note (commented out to stay silent)
  // if(!W.__msdDebug?._hudSelectorShimNoted){ (W.__msdDebug= W.__msdDebug||{}).__hudSelectorShimNoted=true; console.info('[MSD HUD] selector helpers (w/$) installed'); }

  W.__msdDebug = W.__msdDebug || {};

  if (W.__msdDebug.hudService) return; // idempotent

  const PREF_KEY = 'msdHudPanelsV1';
  const PANELS = new Map();
  const state = {
    visible: false,
    panelsOrder: [],
    issues: [],
    packs: { summary: null, provenance: null }, // CHANGED: add provenance store
    rules: { last: [] },
    routing: { recent: [] },
    perf: { snapshot: {} },
    config: {
      routingRecentLimit: 40,
      perfSampleMs: 1000
    },
    panelVisibility: {},
    _ts: {
      rulesLast: 0,
      routingLast: 0
    }
  };

  // Basic pub/sub (internal)
  const listeners = {};
  function on(ev, fn){ (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev, payload){ (listeners[ev]||[]).forEach(f=>{ try{f(payload);}catch(e){console.warn('[HUD emit err]',ev,e);} }); }

  // Register default panels (render functions return HTML string)
  function registerPanel(name, renderer, priority=0){
    PANELS.set(name, { name, renderer, priority });
    state.panelsOrder = [...PANELS.values()].sort((a,b)=>b.priority-a.priority).map(p=>p.name);
    if (!(name in state.panelVisibility)) state.panelVisibility[name] = true;
  }

  function addIssue(issue){
    state.issues.push(issue);
    if (state.issues.length > 500) state.issues.splice(0, state.issues.length-500);
    emit('issues.update', issue);
    scheduleRender();
  }

  function addRoutingMeta(meta){
    state.routing.recent.push(meta);
    if (state.routing.recent.length > state.config.routingRecentLimit) state.routing.recent.shift();
    emit('routing.update', meta);
    scheduleRender();
  }

  function setPacksSummary(summary){
    state.packs.summary = summary;
    emit('packs.update', summary);
    scheduleRender();
  }
  // NEW helper
  function setPacksProvenance(prov){
    state.packs.provenance = prov;
    scheduleRender();
  }

  function setRulesActivity(list){
    state.rules.last = list;
    emit('rules.update', list);
    scheduleRender();
  }

  function setPerfSnapshot(snap){
    state.perf.snapshot = snap;
    emit('perf.update', snap);
    scheduleRender();
  }

  // DOM mount - now requires explicit mount element
  function getMount(){
    // Remove automatic document searching - require explicit mount
    if (!W.__msdDebug?.mountElement) {
      console.warn('[HUD] No mount element available - call setMountElement() first');
      return null;
    }

    const mountElement = W.__msdDebug.mountElement;

    // Try existing layer within mount element
    let layer = mountElement.querySelector('#cblcars-hud-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'cblcars-hud-layer';
      layer.style.cssText = 'position:relative;width:100%;height:100%;pointer-events:none;z-index:1000;';
      mountElement.appendChild(layer);
    }

    if (layer.style.pointerEvents === 'none') {
      layer.style.pointerEvents = 'none';
    }

    let root = layer.querySelector('#msd-hud-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'msd-hud-root';
      root.style.cssText = 'position:absolute;top:6px;right:6px;font:11px/1.25 monospace;z-index:2000;color:#eee;pointer-events:auto;max-width:420px;';
      layer.appendChild(root);
    }
    return root;
  }

  let renderPending = false;
  function scheduleRender(){
    if (!state.visible) return;
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(()=>{ renderPending=false; render(); });
  }

  function render(){
    const mount = getMount();
    if (!mount) return;
    const order = state.panelsOrder;
    const htmlPanels = order.map(name=>{
      const entry = PANELS.get(name);
      if (!entry) return '';
      let body = '';
      try { body = entry.renderer(state); } catch(e){ body = `<div style="color:#f66">Panel error: ${e}</div>`; }
      // Hide inline if visibility false to avoid flash on first apply
      const hideStyle = state.panelVisibility[name] === false ? 'display:none;' : '';
      return `<div class="msd-hud-panel" data-panel="${name}" style="background:rgba(0,0,0,0.68);margin:4px 0;padding:6px 8px;border:1px solid #444;border-radius:4px;${hideStyle}">
        <div style="font-weight:bold;letter-spacing:0.5px;margin-bottom:4px;">${name}</div>${body}</div>`;
    }).join('');
    mount.innerHTML = toolbarHtml() + htmlPanels + footerHtml();
    // Ensure visibility applied after (in case)
    applyPanelVisibility();
  }

  function toolbarHtml(){
    const toggles = state.panelsOrder.map(n=>{
      const checked = state.panelVisibility[n] !== false ? 'checked' : '';
      return `<label style="margin-right:6px;cursor:pointer;"><input data-hud-toggle type="checkbox" data-panel="${n}" ${checked} />${n}</label>`;
    }).join('');
    return `<div style="background:rgba(30,30,50,0.8);padding:6px 8px;border:1px solid #555;border-radius:4px;margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:bold;">MSD HUD</span>
        <button data-hud-hide style="background:#333;color:#ddd;border:1px solid #555;font-size:10px;padding:2px 6px;border-radius:3px;cursor:pointer;">hide</button>
      </div>
      <div style="margin-top:4px;font-size:10px;">${toggles}</div>
    </div>`;
  }

  function footerHtml(){
    return `<div style="text-align:right;font-size:9px;opacity:0.55;margin-top:4px;">Wave 6 HUD alpha</div>`;
  }

  // Panel renderers
  registerPanel('issues', (st)=>{
    if (!st.issues.length) return '<em>no issues</em>';
    const last = st.issues.slice(-8).reverse().map(i=>`<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
      <span style="color:${i.severity==='error'?'#ff6666':i.severity==='warn'?'#ffcc66':'#66cfff'};">${i.severity||'info'}</span>
      <span>${i.code||i.id||''}</span> - ${i.msg||i.message||''}</div>`).join('');
    return last + (st.issues.length>8?`<div style="font-size:9px;opacity:0.6;">… ${st.issues.length-8} more</div>`:'');
  }, 100);

  registerPanel('routing', (st)=>{
    if (!st.routing.recent.length) return '<em>no routes</em>';
    const rows = st.routing.recent.slice(-6).reverse().map(r=>{
      const flags = [
        r.meta?.channel?'ch':'',
        r.meta?.arc?'arc':'',
        r.meta?.smooth?'sm':''
      ].filter(Boolean).join(',');
      return `<div style="display:flex;justify-content:space-between;">
        <span style="white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;">${r.id}</span>
        <span style="opacity:0.7;">${r.meta?.strategy||''}</span>
        <span style="opacity:0.7;">c:${r.meta?.cost}</span>
        <span style="opacity:0.7;">${r.meta?.cache_hit?'hit':'miss'}</span>
        <span style="opacity:0.6;">${flags}</span>
      </div>`;
    }).join('');
    return rows;
  }, 70);

  registerPanel('rules', (st)=>{
    if (!st.rules.last.length) return '<em>no rules</em>';
    return st.rules.last.slice(0,8).map(r=>`<div style="display:flex;justify-content:space-between;">
      <span style="white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;">${r.id}</span>
      <span style="opacity:0.7;">p:${r.priority||0}</span>
      <span style="color:${r.lastMatch?'#6f6':'#ccc'};">${r.lastMatch?'match':'-'}</span>
      <span style="opacity:0.6;">${r.matchCount||0}</span>
    </div>`).join('');
  }, 60);

  registerPanel('packs', (st)=>{
    const s = st.packs.summary;
    const prov = st.packs.provenance;
    if (prov && Object.keys(prov).some(k=>Object.keys(prov[k]||{}).length)){
      // Flatten a few collections for display (top 8)
      const rows = [];
      ['animations','rules','profiles','overlays','timelines'].forEach(coll=>{
        const map = prov[coll]||{};
        Object.entries(map).forEach(([id,p])=>{
          rows.push({ coll, id, p });
        });
      });
      rows.sort((a,b)=> a.coll===b.coll ? a.id.localeCompare(b.id) : a.coll.localeCompare(b.coll));
      const slice = rows.slice(0,8).map(r=>{
        const badges = [
          r.p.origin_pack,
          r.p.overridden ? 'mod' : '',
          r.p.removed ? 'rm' : ''
        ].filter(Boolean).map(b=>`<span style="background:#222;padding:0 4px;border:1px solid #444;border-radius:3px;margin-left:4px;">${b}</span>`).join('');
        return `<div style="display:flex;justify-content:space-between;white-space:nowrap;">
          <span style="max-width:130px;overflow:hidden;text-overflow:ellipsis;">${r.coll}:${r.id}</span>
          <span style="opacity:0.7;">${badges}</span>
        </div>`;
      }).join('');
      return slice + (rows.length>8?`<div style="font-size:9px;opacity:0.6;">… ${rows.length-8} more</div>`:'');
    }
    if (!s) return '<em>no pack data</em>';
    return `<div style="display:flex;flex-wrap:wrap;gap:4px;font-size:10px;">
      ${['animations','rules','profiles','overlays','timelines'].map(k=>`<span style="background:#222;padding:2px 4px;border:1px solid #444;border-radius:3px;">${k}:${s[k]||0}</span>`).join('')}
    </div>`;
  }, 50);

  registerPanel('perf', (st)=>{
    const keys = Object.keys(st.perf.snapshot).slice(0,12);
    if (!keys.length) return '<em>no perf</em>';
    return keys.map(k=>`<div style="display:flex;justify-content:space-between;">
      <span>${k}</span><span style="opacity:0.7;">${st.perf.snapshot[k]}</span>
    </div>`).join('');
  }, 40);

  // Minimal interaction handlers
  document.addEventListener('click', e=>{
    const t = e.target;
    if (t && t.getAttribute('data-hud-hide')) {
      hud.hide();
    }
    // CHANGED: use hasAttribute so empty string value still detected
    if (t && t.hasAttribute('data-hud-toggle')) {
      const panel = t.getAttribute('data-panel');
      const checked = t.checked;
      state.panelVisibility[panel] = checked;
      savePanelPrefs();
      const el = document.querySelector(`.msd-hud-panel[data-panel="${panel}"]`);
      if (el) el.style.display = checked ? '' : 'none';
    }
  }, true);

  // Perf sampling
  let perfTimer = null;
  function startPerfSampling(){
    if (perfTimer) return;
    perfTimer = setInterval(()=>{
      try {
        const snap = (W.__msdDebug.perf && W.__msdDebug.perf()) || {};
        setPerfSnapshot(snap);
      } catch {}
    }, state.config.perfSampleMs);
  }

  // --- NEW: pipeline snapshot helpers (graceful if APIs absent) ---
  function snapshotFromPipeline(){
    patchInitPipeline();              // NEW: ensure wrapper installed
    const dbg = W.__msdDebug || {};
    const p = dbg.pipelineInstance;
    if (!p || !p.enabled) {
      passiveRuleScan();
      return;
    }
    let rm = null;
    try { rm = p.getResolvedModel ? p.getResolvedModel() : null; } catch {}
    // Packs / collections summary (derive from resolved model if available)
    try {
      if (rm) {
        const summary = {
          animations: (rm.animations || []).length,
          rules: (p.rulesEngine?.rules?.length) ||
                 (p.rulesEngine?._rules?.length) ||
                 (rm.rules?.length) || 0,
          profiles: (rm.profiles || []).length,
          overlays: (rm.overlays || []).length,
          timelines: (rm.timelines || []).length
        };
        setPacksSummary(summary);
      }
    } catch {}

    try {
      const engine = p.rulesEngine || p._rulesEngine;
      if (engine) patchRulesEngine(engine);
    } catch {}

    // If still empty after patch attempt, fallback from model
    if (!state.rules.last.length) fallbackRulesFromResolvedModel(rm);

    try {
      patchRouter(dbg);
      // Fallback: if no routing entries yet, attempt a passive cache scan (broad property guesses)
      if (!state.routing.recent.length && dbg.routing) {
        const caches = [dbg.routing._cache, dbg.routing.cache];
        for (const c of caches) {
          if (c && typeof c === 'object') {
            const keys = Object.keys(c).slice(-3);
            keys.forEach(k=>{
              const v = c[k];
              if (v && v.meta) addRoutingMeta({ id: v.meta?.id || v.meta?.overlay || 'route', meta: v.meta });
            });
            if (state.routing.recent.length) break;
          }
        }
      }
    } catch {}

    passiveRuleScan(); // ensure final attempt
    passiveRoutingScan();
    if (!state.rules.last.length) deepHarvestRules(); // NEW
  }

  // Lightweight polling fallback (if no explicit hooks fire)
  let pollTimer = null;
  function startPolling(){
    if (pollTimer) return;
    pollTimer = setInterval(()=>{
      if (!state.visible) return;
      snapshotFromPipeline();
    }, 3000);
    // Add a quicker initial warm-up (first few seconds)
    setTimeout(()=>snapshotFromPipeline(), 500);
    setTimeout(()=>snapshotFromPipeline(), 1500);
  }

  // Patch attachPipelineHooks to call snapshot once after attach
  function attachPipelineHooks(){
    const dbg = W.__msdDebug;
    if (dbg.pipelineInstance?.errors) {
      dbg.pipelineInstance.errors.forEach(err=> addIssue({ severity:'error', msg:err.message||String(err), code:err.code||'pipeline' }));
    }
    dbg.hudPushIssue = addIssue;
    // Existing simple router patch kept (will be augmented by patchRouter)
    try {
      const router = dbg.routing;
      if (router && !router.__hudPatched && router.compute) {
        const orig = router.compute;
        router.compute = function(){
          const res = orig.apply(this, arguments);
          try { if (res && res.meta) addRoutingMeta({ id: arguments[0]?.id || res.meta?.id || 'route', meta: res.meta }); } catch {}
          return res;
        };
        router.__hudPatched = true;
      }
    } catch {}
    dbg.hudUpdateRules = function(list){
      if (Array.isArray(list) && list.length) setRulesActivity(list);
    };
    dbg.hudUpdatePacks = function(summary){
      if (summary) setPacksSummary(summary);
    };
    // NEW: immediate patch attempts
    snapshotFromPipeline();
  }

  // Retry mount helper (added to fix ReferenceError)
  let mountRetry = 0;
  function ensureMountedAndRender() {
    const mount = getMount();
    if (!mount) {
      if (mountRetry < 30) {
        mountRetry++;
        requestAnimationFrame(ensureMountedAndRender);
      }
      return;
    }
    mountRetry = 0;
    render();
  }

  function loadPanelPrefs(){
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') state.panelVisibility = parsed;
      }
    } catch {}
  }
  function savePanelPrefs(){
    try { localStorage.setItem(PREF_KEY, JSON.stringify(state.panelVisibility)); } catch {}
  }

  function applyPanelVisibility(){
    const root = document.getElementById('msd-hud-root');
    if (!root) return;
    state.panelsOrder.forEach(n=>{
      const el = root.querySelector(`.msd-hud-panel[data-panel="${n}"]`);
      if (el) el.style.display = state.panelVisibility[n] === false ? 'none' : '';
    });
    // Sync checkbox states (in case of external changes)
    root.querySelectorAll('input[data-hud-toggle]').forEach(inp=>{
      const pn = inp.getAttribute('data-panel');
      if (pn) inp.checked = state.panelVisibility[pn] !== false;
    });
  }

  /* --- MISSING HELPERS (added) -------------------------------------------------
     snapshotFromPipeline() references patchRulesEngine() and fallbackRulesFromResolvedModel()
     which were never defined after revert. We add guarded implementations here.
  ------------------------------------------------------------------------------*/
  if (typeof fallbackRulesFromResolvedModel !== 'function') {
    function fallbackRulesFromResolvedModel(rm){
      try {
        if (!rm || !Array.isArray(rm.rules) || !rm.rules.length) return;
        if (state.rules.last.length) return;
        const list = rm.rules.map(r=>({
          id: r.id || '(rule)',
          priority: r.priority || 0,
          lastMatch: !!(r._lastMatch || r.lastMatch),
          matchCount: r._matchCount || r.matchCount || 0
        })).sort((a,b)=>(b.priority-a.priority)||a.id.localeCompare(b.id));
        if (list.length) {
          setRulesActivity(list);
          state._ts.rulesLast = Date.now();
        }
      } catch(_) {}
    }
  }

  if (typeof patchRulesEngine !== 'function') {
    function patchRulesEngine(engine){
      if (!engine || engine.__hudPatched) return;
      const candidates = [
        'evaluate','evaluateAll','evaluateDirty','run','cycle','tick',
        'process','update','_evaluate','_cycle','exec','execute'
      ];
      for (const m of candidates) {
        if (typeof engine[m] === 'function') {
          const orig = engine[m];
            engine[m] = function(){
              const res = orig.apply(this, arguments);
              try {
                const act = extractRuleActivity(engine);
                if (act.length) {
                  setRulesActivity(act);
                  state._ts.rulesLast = Date.now();
                }
              } catch {}
              return res;
            };
          break;
        }
      }
      // Event-style emit hook if supported
      ['on','addListener','addEventListener'].forEach(fn=>{
        if (typeof engine[fn] === 'function') {
          try {
            engine[fn]('ruleMatch', ()=>{
              try {
                const act = extractRuleActivity(engine);
                if (act.length) {
                  setRulesActivity(act);
                  state._ts.rulesLast = Date.now();
                }
              } catch {}
            });
          } catch {}
        }
      });
      // Immediate first snapshot
      try {
        const act = extractRuleActivity(engine);
        if (act.length) {
          setRulesActivity(act);
          state._ts.rulesLast = Date.now();
        }
      } catch {}
      engine.__hudPatched = true;
    }
  }
  /* --- END ADDED HELPERS ------------------------------------------------------*/

  // --- NEW: generic rule activity extraction helpers ---
  function extractRuleActivity(engine){
    if (!engine) return [];
    // Gather any plausible rule arrays
    const pools = [
      engine.rules,
      engine._rules,
      engine.compiledRules,
      engine.list,
      engine._compiled,
      engine.ruleList,
      engine._ruleList
    ].filter(a => Array.isArray(a));
    if (!pools.length) return [];
    const seen = new Set();
    const out = [];
    for (const arr of pools) {
      for (const r of arr) {
        if (!r || !r.id) continue;
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push({
          id: r.id,
          priority: r.priority || 0,
          lastMatch: !!(r._lastMatch || r.lastMatch || r.matched),
          matchCount: r._matchCount || r.matchCount || 0
        });
      }
    }
    // Sort by priority desc then id
    out.sort((a,b)=> (b.priority - a.priority) || a.id.localeCompare(b.id));
    return out;
  }

  // REPLACE extractRulesFromPipelineInstance with nested rulesEngine support
  function extractRulesFromPipelineInstance(p){
    if (!p) return [];
    const re = p.rulesEngine || p._rulesEngine || {};
    const byId = new Map();
    const traceMap = {};

    // Collect trace if engine (prefer engine trace, else pipeline trace)
    const traces = [
      re._trace,
      p._trace
    ].filter(Array.isArray);
    traces.forEach(arr=>{
      arr.forEach(t=>{ if (t && t.id) traceMap[t.id] = !!t.matched; });
    });

    // Helper to ingest arrays of rule or compiled rule objects
    function ingest(arr, compiled=false){
      if (!Array.isArray(arr)) return;
      arr.forEach(r0=>{
        if (!r0) return;
        const r = compiled ? (r0.rule || r0) : r0;
        if (!r || !r.id) return;
        const pr = r.priority || r0.priority || 0;
        const existing = byId.get(r.id);
        if (!existing || pr > existing.priority){
          byId.set(r.id, {
            id: r.id,
            priority: pr,
            lastMatch: traceMap[r.id] || false,
            matchCount: (r._matchCount || r.matchCount || 0)
          });
        } else if (traceMap[r.id]) {
          existing.lastMatch = traceMap[r.id];
        }
      });
    }

    // Engine-level sources
    ingest(re.rawRules);
    ingest(re.rules);
    ingest(re._rules);
    ingest(re.compiled, true);
    ingest(re._compiled, true);

    // Pipeline top-level fallbacks (legacy)
    ingest(p.rawRules);
    ingest(p.rules);
    ingest(p._rules);
    ingest(p.compiled, true);

    const list = [...byId.values()].sort((a,b)=> (b.priority - a.priority) || a.id.localeCompare(b.id));
    return list;
  }

  // Update quickHarvest & _hudCollectRules to rely solely on updated extractor
  function quickHarvest(p){
    if (!p) return false;
    const list = extractRulesFromPipelineInstance(p);
    if (list.length){
      setRulesActivity(list);
      state._ts.rulesLast = Date.now();
      return true;
    }
    return false;
  }

  function _hudCollectRules(){
    try {
      if (state.rules.last.length) return;
      const dbg = W.__msdDebug || {};
      const p = dbg.pipelineInstance;
      const buckets = [];
      const pushArr = a => { if (Array.isArray(a) && a.length) buckets.push(a); };
      if (p) {
        pushArr(p.rawRules);
        pushArr(p.rules);
        pushArr(p._rules);
        pushArr(p.compiled && p.compiled.map(c=>c.rule||c));
      }
      const userCfg = dbg._hudUserMsdConfig || dbg.lastUserConfig || dbg.rawConfig;
      if (userCfg) {
        pushArr(userCfg.rules);
        if (userCfg.msd) pushArr(userCfg.msd.rules);
      }
      const seen = new Set();
      const out = [];
      buckets.forEach(arr=>{
        arr.forEach(r=>{
          if (!r || !r.id || seen.has(r.id)) return;
          seen.add(r.id);
          out.push({
            id: r.id,
            priority: r.priority || 0,
            lastMatch: !!(r._lastMatch || r.lastMatch || r.matched),
            matchCount: r._matchCount || r.matchCount || 0
          });
        });
      });
      if (out.length) {
        out.sort((a,b)=>(b.priority-a.priority)||a.id.localeCompare(b.id));
        setRulesActivity(out);
        state._ts.rulesLast = Date.now();
      }
    } catch(e) {
      // swallow for safety
    }
  }

  // Ensure deepHarvestRules uses new extractor first
  function deepHarvestRules(){
    if (state.rules.last.length) return;
    const dbg = W.__msdDebug || {};
    const p = dbg.pipelineInstance;
    if (p && quickHarvest(p)) return;
    // ...existing code (rest of deepHarvestRules)...
  }

  // Passive scans call quickHarvest automatically
  function passiveRuleScan(){
    const dbg = W.__msdDebug;
    const p = dbg?.pipelineInstance;
    const engine = p?.rulesEngine || p?._rulesEngine || dbg?.rulesEngine; // FIX: removed stray partial line
    if (engine) {
      if (!engine.__hudPatched) patchRulesEngine(engine);
      if (Date.now() - state._ts.rulesLast > 3000) {
        try {
          const act = extractRuleActivity(engine);
          if (act.length) {
            setRulesActivity(act);
            state._ts.rulesLast = Date.now();
          }
        } catch {}
      }
    }
  }

  // --- NEW: routing hook extension (cover core RouterCore if exposed) ---
  function patchRouter(dbg){
    const rt = dbg.routing;
    if (!rt) return;
    // patch high-level compute
    if (rt && !rt.__hudPatched && rt.compute) {
      const orig = rt.compute;
      rt.compute = function(){
        const res = orig.apply(this, arguments);
        try {
          if (res && res.meta) {
            addRoutingMeta({ id: arguments[0]?.id || res.meta?.id || 'route', meta: res.meta });
            state._ts.routingLast = Date.now();
          }
        } catch {}
        return res;
      };
      rt.__hudPatched = true;
    }
    // patch underlying core (computePath or route)
    const core = rt.core || rt.router || rt._core || rt._router;
    if (core && !core.__hudPatched) {
      const candidateFns = ['computePath','route','compute'];
      for (const fn of candidateFns) {
        if (typeof core[fn] === 'function') {
          const origCP = core[fn];
          core[fn] = function(req){
            const r = origCP.apply(this, arguments);
            try {
              if (r && r.meta) {
                addRoutingMeta({ id: req?.id || r.meta?.id || 'route', meta: r.meta });
                state._ts.routingLast = Date.now();
              }
            } catch {}
            return r;
          };
          core.__hudPatched = true;
          break;
        }
      }
    }
  }

  // --- NEW: passive routing scan (query inspect() for existing line overlays) ---
  function passiveRoutingScan(){
    const dbg = W.__msdDebug;
    if (!dbg || !dbg.routing || !dbg.pipelineInstance) return;
    const p = dbg.pipelineInstance;
    const rm = p.getResolvedModel ? p.getResolvedModel() : null;
    if (!rm || !Array.isArray(rm.overlays)) return;
    const lineIds = rm.overlays.filter(o=>o.type==='line').slice(0, 12).map(o=>o.id);
    if (!lineIds.length || !dbg.routing.inspect) return;
    lineIds.forEach(id=>{
      try {
        const meta = dbg.routing.inspect(id);
        if (meta && meta.meta && meta.meta.strategy) {
          // Prevent duplicate spam: store last cost/strategy signature per id
          const sig = `${meta.meta.strategy}:${meta.meta.cost}`;
          if (!state.routing._sig) state.routing._sig = {};
            if (state.routing._sig[id] !== sig) {
              state.routing._sig[id] = sig;
              addRoutingMeta({ id, meta: meta.meta });
              state._ts.routingLast = Date.now();
            }
        }
      } catch {}
    });
  }

  // --- NEW: fallback rule polling if engine patch not firing ---
  function passiveRuleScan(){
    const dbg = W.__msdDebug;
    const p = dbg?.pipelineInstance;
    const engine = p?._rulesEngine || p?.rulesEngine || dbg?.rulesEngine;
    if (engine) {
      if (!engine.__hudPatched) patchRulesEngine(engine);
      if (Date.now() - state._ts.rulesLast > 3000) {
        try {
          const act = extractRuleActivity(engine);
          if (act.length) {
            setRulesActivity(act);
            state._ts.rulesLast = Date.now();
          }
        } catch {}
      }
    }
  }

  // --- NEW: Deep harvest (last‑chance) scans multiple objects for rule-like arrays ---
  function deepHarvestRules() {
    if (state.rules.last.length) return;
    const dbg = W.__msdDebug || {};
    const buckets = [];
    const seenIds = new Set();

    function consider(arr, label){
      if (!Array.isArray(arr) || !arr.length) return;
      // Heuristic: array of objects each with id & (when/apply | priority)
      const good = arr.every(o => o && typeof o === 'object' && o.id);
      if (!good) return;
      buckets.push({ arr, label });
    }

    // Candidate sources
    try {
      const p = dbg.pipelineInstance;
      if (p) {
        consider(p.rules, 'pipeline.rules');
        consider(p._rules, 'pipeline._rules');
        consider(p.ruleList, 'pipeline.ruleList');
        // Scan enumerable props
        Object.keys(p).forEach(k=>{
          if (/rule/i.test(k)) consider(p[k], `pipeline.${k}`);
        });
        // Raw / user configs
        consider(p.rawConfig?.rules, 'rawConfig.rules');
        consider(p.userConfig?.rules, 'userConfig.rules');
        consider(p.config?.rules, 'config.rules');
      }
      consider(dbg._hudUserMsdConfig?.rules, '_hudUserMsdConfig.rules');
      consider(dbg.rawConfig?.rules, 'dbg.rawConfig.rules');
      consider(dbg.lastUserConfig?.rules, 'dbg.lastUserConfig.rules');
    } catch {}

    // Flatten unique
    const collected = [];
    buckets.forEach(({arr})=>{
      arr.forEach(r=>{
        if (!r || !r.id || seenIds.has(r.id)) return;
        seenIds.add(r.id);
        collected.push({
          id: r.id,
          priority: r.priority || 0,
          lastMatch: !!(r._lastMatch || r.lastMatch || r.matched),
          matchCount: r._matchCount || r.matchCount || 0
        });
      });
    });

    if (!collected.length) {
      // One-time console hint
      if (!dbg.__hudRuleWarned) {
        dbg.__hudRuleWarned = true;
        console.info('[MSD HUD][rules] Deep harvest found no rule arrays. If rules engine not initialized yet, call window.__msdDebug.hud.harvestRulesNow() later.');
      }
      return;
    }

    collected.sort((a,b)=> (b.priority - a.priority) || a.id.localeCompare(b.id));
    setRulesActivity(collected);
    state._ts.rulesLast = Date.now();
    console.info('[MSD HUD][rules] Deep harvest populated', collected.length, 'rules');
  }

  // --- NEW: compact rule harvesting utility (runs after show + on demand) ---
  function _hudCollectRules() {
    try {
      if (state.rules.last.length) return;
      const dbg = W.__msdDebug || {};
      const p = dbg.pipelineInstance;
      const buckets = [];
      const pushArr = a => { if (Array.isArray(a) && a.length) buckets.push(a); };
      if (p) {
        pushArr(p.rawRules);
        pushArr(p.rules);
        pushArr(p._rules);
        pushArr(p.compiled && p.compiled.map(c=>c.rule||c));
      }
      const userCfg = dbg._hudUserMsdConfig || dbg.lastUserConfig || dbg.rawConfig;
      if (userCfg) {
        pushArr(userCfg.rules);
        if (userCfg.msd) pushArr(userCfg.msd.rules);
      }
      const seen = new Set();
      const out = [];
      buckets.forEach(arr=>{
        arr.forEach(r=>{
          if (!r || !r.id || seen.has(r.id)) return;
          seen.add(r.id);
          out.push({
            id: r.id,
            priority: r.priority || 0,
            lastMatch: !!(r._lastMatch || r.lastMatch || r.matched),
            matchCount: r._matchCount || r.matchCount || 0
          });
        });
      });
      if (out.length) {
        out.sort((a,b)=>(b.priority-a.priority)||a.id.localeCompare(b.id));
        setRulesActivity(out);
        state._ts.rulesLast = Date.now();
      }
    } catch(e) {
      // swallow for safety
    }
  }

  // Expose manual trigger for debugging
  W.__msdDebug = W.__msdDebug || {};
  W.__msdDebug.hudHarvestRules = _hudCollectRules;

  // --- ADD: attempt to capture original user config (rules etc.) ---
  function captureUserConfigFromPipeline(p){
    if (!p || !window.__msdDebug) return;
    const dbg = window.__msdDebug;
    if (dbg._hudUserMsdConfig && dbg._hudUserMsdConfig.__captured) return; // already set by init
    const candidates = [
      p.userConfig,
      p.rawConfig,
      p.originalConfig,
      p.config,
      (p.options && p.options.userConfig),
      (p.source && p.source.config)
    ].filter(Boolean);

    let found = null;
    for (const c of candidates){
      if (c && (c.msd || c.rules || c.overlays)) { found = c.msd ? c.msd : c; break; }
    }
    if (!found) return;

    // Normalize to msd-like root (so `.rules` lives directly if present)
    const normalized = found.msd ? found.msd : found;
    normalized.__captured = true;
    dbg._hudUserMsdConfig = normalized;

    // If HUD rules still empty, seed from this config (non-eval meta only)
    if (!state.rules.last.length && Array.isArray(normalized.rules) && normalized.rules.length){
      const basic = normalized.rules.map(r=>({
        id: r.id || '(rule)',
        priority: r.priority || 0,
        lastMatch: false,
        matchCount: 0
      })).sort((a,b)=>(b.priority-a.priority)||a.id.localeCompare(b.id));
      setRulesActivity(basic);
      state._ts.rulesLast = Date.now();
    }
  }

  // MODIFY: trapPipelineInstance to capture config
  (function trapPipelineInstance(){
    const dbg = W.__msdDebug;
    if (!dbg || dbg.__hudPipelineTrap) return;

    let _pi = dbg.pipelineInstance;

    // Only create trap if pipelineInstance doesn't already have a setter
    const descriptor = Object.getOwnPropertyDescriptor(dbg, 'pipelineInstance');
    if (!descriptor || !descriptor.set) {
      Object.defineProperty(dbg, 'pipelineInstance', {
        get(){ return _pi; },
        set(v){
          _pi = v;
          try {
            captureUserConfigFromPipeline(v);
            quickHarvest(v);
            snapshotFromPipeline();
            scheduleRender();
          } catch(e){
            console.warn('[HUD] Pipeline instance update failed:', e);
          }
        },
        configurable: true
      });
    }

    // If pre-existing instance already there at load time, capture it
    if (_pi) {
      try { captureUserConfigFromPipeline(_pi); } catch {}
    }
    dbg.__hudPipelineTrap = true;
  })();

  // Public API
  let hudRulesDebug = false;
  function dlog(...a){ if (hudRulesDebug) console.info('[HUD.rules]', ...a); }
  const hud = {
    // Add mount element management
    setMountElement(mountEl) {
      if (!mountEl) {
        console.warn('[HUD] Invalid mount element provided');
        return false;
      }
      W.__msdDebug = W.__msdDebug || {};
      W.__msdDebug.mountElement = mountEl;
      return true;
    },

    show(){
      if (!W.__msdDebug?.mountElement) {
        console.warn('[HUD] Cannot show - no mount element set. Call setMountElement() first.');
        return;
      }
      state.visible = true;
      loadPanelPrefs();
      const mount = getMount(); if (mount) mount.style.display = '';
      ensureMountedAndRender();
      startPerfSampling();
      attachPipelineHooks();
      startPolling();
      _hudCollectRules();              // NEW: immediate rule harvest attempt
      setTimeout(_hudCollectRules, 400); // NEW: delayed harvest (pipeline may finish async)
    },
    hide(){
      state.visible = false;
      const mount = getMount();
      if (mount) mount.style.display = 'none';
    },
    toggle(){ state.visible ? this.hide() : this.show(); },
    registerPanel,
    getState(){ return JSON.parse(JSON.stringify(state)); },
    publishIssue: addIssue,
    publishRouting: addRoutingMeta,
    publishRules: setRulesActivity,
    publishPacks: setPacksSummary,
    publishPacksProvenance: setPacksProvenance, // NEW
    publishPerf: setPerfSnapshot,
    refresh(){
      snapshotFromPipeline();
      scheduleRender();
    },
    forceRules(list){
      if (Array.isArray(list) && list.length){
        setRulesActivity(list);
        state._ts.rulesLast = Date.now();
      }
    },
    hudRulesDebug(enable){
      hudRulesDebug = !!enable;
      dlog('debug logging', hudRulesDebug ? 'ENABLED' : 'DISABLED');
      return hudRulesDebug;
    },
    forceRulesFromConfig(){ fallbackRulesFromUserConfig(); scheduleRender(); } // NEW helper
    ,harvestRulesNow(){
      _hudCollectRules();              // unified harvest
      scheduleRender();
    },
    debugUserConfig(){
      return window.__msdDebug?._hudUserMsdConfig || null;
    },
  };

  // Ensure the updated hud object (with debugUserConfig) is exported
  W.__msdDebug.hudService = hud;
  W.__msdDebug.hud = hud;

  // Auto-show if debug flag present
  try {
    if (W.cblcars?._debugFlags?.hud_auto || W.location.search.includes('hud=1')) hud.show();
  } catch {}

  // Provide global convenience function (idempotent)
  try {
    window.__msdDebug.hudRulesDebug = function(enable){
      if (window.__msdDebug?.hud?.hudRulesDebug) return window.__msdDebug.hud.hudRulesDebug(enable);
      console.warn('[HUD.rules] hud not initialized yet');
      return false;
    };
  } catch {}

  // --- INSERT: ensure patchInitPipeline is defined before any use ---
  function patchInitPipeline(){
    const dbg = window.__msdDebug;
    if (!dbg || dbg.__hudInitPatched || typeof dbg.initMsdPipeline !== 'function') return;
    const orig = dbg.initMsdPipeline;
    dbg.initMsdPipeline = function(msdConfig, mount){
      try {
        // Capture user config early for rule fallback
        window.__msdDebug._hudUserMsdConfig = msdConfig;
        if (typeof fallbackRulesFromUserConfig === 'function') fallbackRulesFromUserConfig();
      } catch(_) {}
      const ret = orig.apply(this, arguments);
      // Handle promise or direct
      if (ret && typeof ret.then === 'function') {
        return ret.then(p=>{
          try {
            if (typeof fallbackRulesFromUserConfig === 'function') fallbackRulesFromUserConfig();
            if (typeof quickHarvest === 'function') quickHarvest(p);
            if (typeof snapshotFromPipeline === 'function') snapshotFromPipeline();
          } catch(_) {}
          return p;
        });
      } else {
        try {
          if (typeof fallbackRulesFromUserConfig === 'function') fallbackRulesFromUserConfig();
          if (typeof snapshotFromPipeline === 'function') snapshotFromPipeline();
        } catch(_) {}
        return ret;
      }
    };
    dbg.__hudInitPatched = true;
  }
  // --- END INSERT ---

  // (If snapshotFromPipeline defined earlier without guard, add the guard)
  // Locate existing snapshotFromPipeline definition and add the patchInitPipeline guard at its start:
  // Replace the existing first line inside snapshotFromPipeline with the guarded call.

  // Example patched portion (showing only changed lines):
  // function snapshotFromPipeline(){
  //   if (typeof patchInitPipeline === 'function') patchInitPipeline();
  //   ...existing code...
  // }

  // If snapshotFromPipeline already exists below, modify it:
  const originalSnapshotFn = typeof snapshotFromPipeline === 'function' ? snapshotFromPipeline : null;
  if (originalSnapshotFn && !originalSnapshotFn.__hudPatchedForInit) {
    window.snapshotFromPipeline = function(){
      if (typeof patchInitPipeline === 'function') patchInitPipeline();
      return originalSnapshotFn.apply(this, arguments);
    };
    window.snapshotFromPipeline.__hudPatchedForInit = true;
  }

  // ...existing code continues...
})();


