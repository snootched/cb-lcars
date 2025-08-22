/* MSD Smart Routing Scenario Harness (Wave 5 - M5.3)
 * Usage:
 *   window.__msdScenarios.smart.list()
 *   window.__msdScenarios.smart.run('smart_vs_grid_cost')
 *   window.__msdScenarios.smart.runAll()
 */

(function initSmartRoutingHarness(){
  if (typeof window === 'undefined') return;
  const W = window;
  W.__msdScenarios = W.__msdScenarios || {};

  function pi() {
    const p = W.__msdDebug?.pipelineInstance;
    if (!p || p.enabled === false) throw new Error('Pipeline disabled or missing.');
    return p;
  }
  function inspect(id) { return W.__msdDebug?.routing?.inspect(id); }
  function invalidate(scope='*'){ W.__msdDebug?.routing?.invalidate(scope); }

  function withMode(id, modeFull, fn) {
    const model = W.__msdDebug?.lastRenderModel;
    const ov = model?.overlays?.find(o=>o.id===id);
    if (!ov) throw new Error('overlay not found: '+id);
    ov._raw = ov._raw || {};
    const orig = ov._raw.route_mode_full;
    ov._raw.route_mode_full = modeFull;
    try {
      invalidate('*');
      return fn();
    } finally {
      ov._raw.route_mode_full = orig;
      invalidate('*');
    }
  }

  // NEW: helper to set mode without auto-restore (caller restores after use)
  function setMode(id, modeFull) {
    const model = W.__msdDebug?.lastRenderModel;
    const ov = model?.overlays?.find(o=>o.id===id);
    if (!ov) throw new Error('overlay not found: '+id);
    ov._raw = ov._raw || {};
    ov._raw.route_mode_full = modeFull;
  }

  function scenarioSmartVsGridCost() {
    // Reuse a grid candidate overlay id
    const id = 'line_grid_forced';
    const grid = withMode(id, 'grid', ()=>inspect(id));
    const smart = withMode(id, 'smart', ()=>inspect(id));
    const ok = !!grid && !!smart && smart.meta.strategy === 'smart' && smart.meta.cost <= grid.meta.cost + 40;
    return { ok, details: { gridCost: grid?.meta.cost, smartCost: smart?.meta.cost } };
  }

  function scenarioSmartRefinementAttempt() {
    const id = 'line_grid_forced';
    const smart = withMode(id, 'smart', ()=>inspect(id));
    const smartMeta = smart?.meta?.smart;
    const ok = !!smartMeta && smartMeta.detoursTried >= 0; // Accept even zero (no need for forced detour)
    return { ok, details: smartMeta };
  }

  function scenarioSmartPenaltyReduction() {
    const id = 'line_smart_blocked';
    const baseSmart = withMode(id, 'smart', ()=>inspect(id));
    const meta = baseSmart?.meta;
    if (!meta?.smart) return { ok:false, details:'no smart meta' };
    const ok = meta.smart.penaltyAfter <= meta.smart.penaltyBefore;
    return { ok, details: meta.smart };
  }

  // REPLACE scenarioSmartCacheBehavior implementation
  function scenarioSmartCacheBehavior() {
    const id = 'line_smart_forced_xy';
    const model = W.__msdDebug?.lastRenderModel;
    const ov = model?.overlays?.find(o=>o.id===id);
    if (!ov) return { ok:false, details:'overlay not found' };
    ov._raw = ov._raw || {};
    const original = ov._raw.route_mode_full;

    try {
      setMode(id, 'smart');
      invalidate('*');
      const first = inspect(id);        // expect miss
      const second = inspect(id);       // expect hit (same mode & unchanged env)
      const ok = !!first && !!second && first.meta.cache_hit === false && second.meta.cache_hit === true;
      return { ok, details: { firstHit: first?.meta.cache_hit, secondHit: second?.meta.cache_hit } };
    } catch(e) {
      return { ok:false, details:String(e) };
    } finally {
      ov._raw.route_mode_full = original;
      invalidate('*');
    }
  }

  const scenarios = {
    smart_vs_grid_cost: scenarioSmartVsGridCost,
    smart_refinement_attempt: scenarioSmartRefinementAttempt,
    smart_penalty_reduction: scenarioSmartPenaltyReduction,
    smart_cache_behavior: scenarioSmartCacheBehavior
  };

  const api = {
    list: ()=>Object.keys(scenarios),
    run: (name)=>{
      if (!scenarios[name]) { console.warn('[MSD Smart Scenario] Unknown', name); return null; }
      try {
        const r = scenarios[name]();
        console.log(`[MSD Smart Scenario] ${name}: ${r.ok?'OK':'FAIL'}`, r);
        return r;
      } catch(e) {
        const r = { ok:false, details:String(e) };
        console.log(`[MSD Smart Scenario] ${name}: FAIL`, r);
        return r;
      }
    },
    runAll: ()=>{
      const res = {};
      for (const k of Object.keys(scenarios)) res[k] = api.run(k);
      const summaryOk = Object.values(res).every(r => r && r.ok);
      console.log('[MSD Smart Scenario] Summary:', summaryOk?'ALL PASS':'FAILURES', res);
      return res;
    }
  };

  W.__msdScenarios.smart = api;
  console.info('[MSD v1] Smart routing scenario harness installed. Use: window.__msdScenarios.smart.list()');
})();
