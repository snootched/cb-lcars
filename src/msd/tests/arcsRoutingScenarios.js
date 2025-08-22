/* MSD Corner Arc Scenario Harness (Wave 5 - M5.5)
 * Usage:
 *   window.__msdScenarios.arcs.list()
 *   window.__msdScenarios.arcs.runAll()
 */
(function initArcScenarios(){
  if (typeof window === 'undefined') return;
  const W = window;
  W.__msdScenarios = W.__msdScenarios || {};

  function pi(){ const p=W.__msdDebug?.pipelineInstance; if(!p||!p.enabled) throw new Error('pipeline disabled'); return p; }
  function inspect(id){ return W.__msdDebug?.routing?.inspect(id); }
  function invalidate(scope='*'){ W.__msdDebug?.routing?.invalidate(scope); }

  const targetLine = 'line_grid_forced'; // has corner_style: round with >1 bend after obstacles

  function ensureRound(lineId){
    const model = pi().getResolvedModel();
    const ov = model.overlays.find(o=>o.id===lineId);
    if (!ov) throw new Error('overlay not found');
    ov._raw = ov._raw || {};
    ov._raw.corner_style = 'round';
    ov._raw.corner_radius = ov._raw.corner_radius || 40;
  }

  function scenarioArcPresence() {
    ensureRound(targetLine);
    invalidate('*');
    const res = inspect(targetLine);
    const ok = !!res && /A\d+/.test(res.d) && res.meta.arc && res.meta.arc.count > 0;
    return { ok, details: { dSample: res?.d?.slice(0,120)+'...', arc: res?.meta?.arc } };
  }

  function scenarioRadiusClamp() {
    ensureRound(targetLine);
    const model = pi().getResolvedModel();
    const ov = model.overlays.find(o=>o.id===targetLine);
    const original = ov._raw.corner_radius;
    ov._raw.corner_radius = 1000; // absurdly large to trigger clamping
    invalidate('*');
    const res = inspect(targetLine);
    ov._raw.corner_radius = original;
    invalidate('*');
    const ok = !!res && res.meta.arc && res.meta.arc.count > 0;
    return { ok, details: { trimPx: res?.meta?.arc?.trimPx, count: res?.meta?.arc?.count } };
  }

  function scenarioArcCacheReuse() {
    ensureRound(targetLine);
    invalidate('*');
    const first = inspect(targetLine);
    const second = inspect(targetLine);
    const ok = !!first && !!second && first.meta.cache_hit === false && second.meta.cache_hit === true && second.meta.arc?.count >= 0;
    return { ok, details: { firstHit: first?.meta.cache_hit, secondHit: second?.meta.cache_hit, arcCount: second?.meta?.arc?.count } };
  }

  function scenarioMiterFallback() {
    // Temporarily set corner_style:miter expect no arc meta
    const model = pi().getResolvedModel();
    const ov = model.overlays.find(o=>o.id===targetLine);
    if (!ov) return { ok:false, details:'overlay missing'};
    ov._raw = ov._raw || {};
    const origStyle = ov._raw.corner_style;
    ov._raw.corner_style = 'miter';
    invalidate('*');
    const res = inspect(targetLine);
    ov._raw.corner_style = origStyle;
    invalidate('*');
    const ok = !!res && !res.meta.arc;
    return { ok, details: { hasArcMeta: !!res.meta.arc } };
  }

  const scenarios = {
    arc_presence: scenarioArcPresence,
    radius_clamp: scenarioRadiusClamp,
    arc_cache_reuse: scenarioArcCacheReuse,
    miter_fallback: scenarioMiterFallback
  };

  const api = {
    list: ()=>Object.keys(scenarios),
    run: (n)=>{
      if(!scenarios[n]) { console.warn('[MSD Arc Scenario] Unknown', n); return null; }
      try {
        const r = scenarios[n]();
        console.log(`[MSD Arc Scenario] ${n}: ${r.ok?'OK':'FAIL'}`, r);
        return r;
      } catch(e){
        const r = { ok:false, details:String(e) };
        console.log(`[MSD Arc Scenario] ${n}: FAIL`, r);
        return r;
      }
    },
    runAll: ()=>{
      const res={};
      for (const k of Object.keys(scenarios)) res[k]=api.run(k);
      const allOk = Object.values(res).every(r=>r&&r.ok);
      console.log('[MSD Arc Scenario] Summary:', allOk?'ALL PASS':'FAILURES', res);
      return res;
    }
  };

  W.__msdScenarios.arcs = api;
  console.info('[MSD v1] Arc routing scenario harness installed. Use: window.__msdScenarios.arcs.list()');
})();
