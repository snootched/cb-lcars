/* MSD Routing Scenario Harness (Wave 5)
 * Paste/import this once after the pipeline loads (e.g. include in bundle or run in console).
 * Provides reproducible, code-driven tests without editing YAML.
 *
 * Usage (in browser console after card rendered):
 *   window.__msdScenarios.routing.list()
 *   window.__msdScenarios.routing.run('cache')
 *   window.__msdScenarios.routing.runAll()
 *
 * Each scenario returns { ok:boolean, details, warnings:[] } and logs a concise summary.
 */

(function initRoutingHarness(){
  if (typeof window === 'undefined') return;
  const W = window;
  W.__msdScenarios = W.__msdScenarios || {};

  function requirePipeline() {
    const pi = W.__msdDebug?.pipelineInstance;
    if (!pi || pi.enabled === false) throw new Error('Pipeline disabled or missing.');
    return pi;
  }

  function getModel() {
    // Prefer live lastRenderModel if provided by renderer hook
    return W.__msdDebug?.lastRenderModel || requirePipeline().getResolvedModel?.() || null;
  }

  function listOverlays() {
    const m = getModel();
    return m?.overlays || [];
  }

  function findOverlay(id) {
    return listOverlays().find(o => o.id === id);
  }

  function inspect(id) {
    return W.__msdDebug?.routing?.inspect(id);
  }

  function invalidate(scope='*') {
    W.__msdDebug?.routing?.invalidate(scope);
  }

  function anchorClone() {
    const model = getModel();
    return model?.anchors ? { ...model.anchors } : {};
  }

  function log(name, result) {
    const color = result.ok ? 'color:#4caf50' : 'color:#f44336';
    console.log(`%c[MSD Scenario] ${name}: ${result.ok?'OK':'FAIL'}`, color, result);
  }

  // --- Scenarios ---

  function scenarioCache() {
    const lineId = 'line_grid_forced';
    invalidate('*');
    const first = inspect(lineId);
    const second = inspect(lineId);
    const ok = !!first && !!second && first.meta.cache_hit === false && second.meta.cache_hit === true;
    return { ok, details: { firstHit: first?.meta.cache_hit, secondHit: second?.meta.cache_hit } };
  }

  function scenarioGridVsManhattan() {
    const grid = inspect('line_grid_forced');
    const man = inspect('line_manhattan_baseline');
    const ok = !!grid && !!man && grid.meta.strategy.startsWith('grid') && man.meta.strategy.startsWith('manhattan');
    return { ok, details: { gridStrategy: grid?.meta.strategy, manStrategy: man?.meta.strategy } };
  }

  function scenarioAvoidCreatesBend() {
    const targetId = 'line_smart_clear';
    const ov = findOverlay(targetId);
    if (!ov) return { ok:false, details:'overlay not found' };
    const before = inspect(targetId);
    // monkey patch avoid list
    ov._raw = ov._raw || {};
    const originalAvoid = Array.isArray(ov._raw.avoid) ? ov._raw.avoid.slice() : undefined;
    if (!ov._raw.avoid) ov._raw.avoid = [];
    if (!ov._raw.avoid.includes('obstacle_vertical')) ov._raw.avoid.push('obstacle_vertical');
    invalidate('*');
    const after = inspect(targetId);
    // restore
    if (originalAvoid === undefined) delete ov._raw.avoid; else ov._raw.avoid = originalAvoid;
    invalidate('*');
    const ok = !!before && !!after && after.meta.bends >= before.meta.bends;
    return { ok, details: { bendsBefore: before?.meta.bends, bendsAfter: after?.meta.bends } };
  }

  function scenarioModeHintYX() {
    const id = 'line_grid_forced';
    const ov = findOverlay(id);
    if (!ov) return { ok:false, details:'overlay not found'};
    ov._raw = ov._raw || {};
    // Baseline (xy / default)
    ov._raw.route_mode = 'xy';
    invalidate('*');
    const base = inspect(id);
    // yx
    ov._raw.route_mode = 'yx';
    invalidate('*');
    const yx = inspect(id);
    // restore
    delete ov._raw.route_mode;
    invalidate('*');
    const basePts = base?.pts || [];
    const yxPts = yx?.pts || [];
    // Expect both have an elbow (>=3 points). In xy, second point shares y1 (horizontal first). In yx, second shares x1 (vertical first).
    const baseHorizontalFirst = basePts.length>=3 && basePts[1][1] === basePts[0][1];
    const yxVerticalFirst = yxPts.length>=3 && yxPts[1][0] === yxPts[0][0];
    const ok = baseHorizontalFirst && yxVerticalFirst;
    return { ok, details: { basePts, yxPts, baseHorizontalFirst, yxVerticalFirst } };
  }

  function scenarioClearanceShift() {
    const id = 'line_grid_forced';
    const router = requirePipeline().router;
    if (!router) return { ok:false, details:'router missing' };
    invalidate('*');
    const base = inspect(id);
    const orig = router.config.clearance;
    router.config.clearance = (orig || 8) + 24;
    invalidate('*');
    const raised = inspect(id);
    router.config.clearance = orig;
    invalidate('*');
    const ok = !!base && !!raised && raised.meta.cost >= base.meta.cost;
    return { ok, details: { baseCost: base?.meta.cost, raisedCost: raised?.meta.cost } };
  }

  function scenarioAnchorMove() {
    const anchorId = 'smart_far_anchor';
    const pi = requirePipeline();
    const model = getModel();
    if (!model?.anchors || !model.anchors[anchorId]) return { ok:false, details:'anchor not present' };
    const lineId = 'line_smart_far_avoid';
    invalidate('*');
    const before = inspect(lineId);
    const orig = model.anchors[anchorId].slice();
    // Use pipeline API (updates cardModel + resolvedModel + rerender)
    const moved = pi.setAnchor(anchorId, [orig[0] + 40, orig[1]]);
    invalidate('*');
    const after = inspect(lineId);
    // revert
    pi.setAnchor(anchorId, orig);
    invalidate('*');
    const ok = moved && !!before && !!after && before.pts[0][0] !== after.pts[0][0];
    return { ok, details: { from: before?.pts[0], to: after?.pts[0], moved } };
  }

  function scenarioFallbackOnImpossibleGrid() {
    const router = requirePipeline().router;
    if (!router) return { ok:false, details:'router missing'};
    const originalComputeGrid = router._computeGrid;
    // Force failure for this call only by returning null
    router._computeGrid = function(req){ if (req.id === 'line_grid_forced') return null; return originalComputeGrid.call(this, req); };
    invalidate('*');
    const res = inspect('line_grid_forced');
    // restore
    router._computeGrid = originalComputeGrid;
    invalidate('*');
    const ok = !!res && /manhattan|fallback/.test(res.meta.strategy);
    return { ok, details: { strategy: res?.meta.strategy } };
  }

  const scenarios = {
    cache: scenarioCache,
    grid_vs_manhattan: scenarioGridVsManhattan,
    avoid_creates_bend: scenarioAvoidCreatesBend,
    mode_hint_yx: scenarioModeHintYX,
    clearance_shift: scenarioClearanceShift,
    anchor_move: scenarioAnchorMove,
    fallback_impossible_grid: scenarioFallbackOnImpossibleGrid
  };

  const api = {
    list: () => Object.keys(scenarios),
    run: (name) => {
      if (!scenarios[name]) { console.warn('[MSD Scenario] Unknown', name); return null; }
      try {
        const r = scenarios[name]();
        log(name, r);
        return r;
      } catch(e) {
        const r = { ok:false, details:String(e) };
        log(name, r);
        return r;
      }
    },
    runAll: () => {
      const results = {};
      for (const k of Object.keys(scenarios)) results[k] = api.run(k);
      const summaryOk = Object.values(results).every(r => r && r.ok);
      console.log('[MSD Scenario] Summary:', summaryOk?'ALL PASS':'FAILURES', results);
      return results;
    }
  };

  W.__msdScenarios.routing = api;
  console.info('[MSD v1] Routing scenario harness installed. Use: window.__msdScenarios.routing.list()');
})();
