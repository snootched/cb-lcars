/* MSD Smoothing Scenario Harness (Wave 5 - M5.6)
 * Usage:
 *   window.__msdScenarios.smoothing.list()
 *   window.__msdScenarios.smoothing.runAll()
 */
(function initSmoothingScenarios(){
  if (typeof window === 'undefined') return;
  const W = window;
  W.__msdScenarios = W.__msdScenarios || {};

  function pi(){ const p=W.__msdDebug?.pipelineInstance; if(!p||!p.enabled) throw new Error('pipeline disabled'); return p; }
  function inspect(id){ return W.__msdDebug?.routing?.inspect(id); }
  function invalidate(){ W.__msdDebug?.routing?.invalidate('*'); }

  const target = 'line_grid_forced';

  function ensureBaseline(){
    const model = pi().getResolvedModel();
    const ov = model.overlays.find(o=>o.id===target);
    if (!ov) throw new Error('overlay not found');
    ov._raw = ov._raw || {};
    return ov;
  }

  function scenarioSmoothingIncreasesPoints(){
    const ov = ensureBaseline();
    ov._raw.smoothing_mode = 'none';
    ov._raw.smoothing_iterations = 0;
    invalidate();
    const base = inspect(target);
    ov._raw.smoothing_mode = 'chaikin';
    ov._raw.smoothing_iterations = 2;
    invalidate();
    const sm = inspect(target);
    // restore
    delete ov._raw.smoothing_mode;
    delete ov._raw.smoothing_iterations;
    invalidate();
    const ok = !!base && !!sm && sm.pts.length > base.pts.length && sm.meta.smooth;
    return { ok, details: { basePts: base?.pts.length, smoothPts: sm?.pts.length, meta: sm?.meta?.smooth } };
  }

  function scenarioCacheHit(){
    const ov = ensureBaseline();
    ov._raw.smoothing_mode = 'chaikin';
    ov._raw.smoothing_iterations = 1;
    invalidate();
    const first = inspect(target);
    const second = inspect(target);
    // restore
    delete ov._raw.smoothing_mode;
    delete ov._raw.smoothing_iterations;
    invalidate();
    const ok = !!first && !!second && first.meta.cache_hit === false && second.meta.cache_hit === true;
    return { ok, details: { firstHit: first?.meta.cache_hit, secondHit: second?.meta.cache_hit } };
  }

  function scenarioDisableNoSmoothMeta(){
    const ov = ensureBaseline();
    ov._raw.smoothing_mode = 'none';
    ov._raw.smoothing_iterations = 0;
    invalidate();
    const res = inspect(target);
    delete ov._raw.smoothing_mode;
    delete ov._raw.smoothing_iterations;
    invalidate();
    const ok = !!res && !res.meta.smooth;
    return { ok, details: { hasSmoothMeta: !!res.meta.smooth } };
  }

  function scenarioInvalidModeFallback() {
    const ov = ensureBaseline();
    ov._raw.smoothing_mode = 'bogus_mode';
    ov._raw.smoothing_iterations = 2;
    invalidate();
    const res = inspect(target);
    delete ov._raw.smoothing_mode;
    delete ov._raw.smoothing_iterations;
    invalidate();
    // Expect no meta.smooth because mode invalid → coerced to none
    const ok = !!res && !res.meta.smooth;
    return { ok, details: { hasSmoothMeta: !!res.meta.smooth } };
  }

  const scenarios = {
    smoothing_increases_points: scenarioSmoothingIncreasesPoints,
    smoothing_cache_hit: scenarioCacheHit,
    smoothing_disabled_no_meta: scenarioDisableNoSmoothMeta,
    smoothing_invalid_mode_fallback: scenarioInvalidModeFallback   // NEW
  };

  const api = {
    list: ()=>Object.keys(scenarios),
    run: (n)=>{
      if(!scenarios[n]) { console.warn('[MSD Smooth Scenario] Unknown', n); return null; }
      try {
        const r = scenarios[n]();
        console.log(`[MSD Smooth Scenario] ${n}: ${r.ok?'OK':'FAIL'}`, r);
        return r;
      } catch(e){
        const r = { ok:false, details:String(e) };
        console.log(`[MSD Smooth Scenario] ${n}: FAIL`, r);
        return r;
      }
    },
    runAll: ()=>{
      const res={};
      for(const k of Object.keys(scenarios)) res[k]=api.run(k);
      const ok = Object.values(res).every(r=>r && r.ok);
      console.log('[MSD Smooth Scenario] Summary:', ok?'ALL PASS':'FAILURES', res);
      return res;
    }
  };

  W.__msdScenarios.smoothing = api;
  console.info('[MSD v1] Smoothing scenario harness installed. Use: window.__msdScenarios.smoothing.list()');
})();
