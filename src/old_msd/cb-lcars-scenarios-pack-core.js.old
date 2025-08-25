/**
 * Core Scenario Pack (routing / overlays / perf / anchors / validation)
 * Safe to load multiple times (idempotent).
 */
(function(){
  if(!window.cblcars) window.cblcars = {};
  const dev = window.cblcars.dev;
  if(!dev || !dev.api || !dev.api.scenarios){ return; }

  if(dev.__defaultScenarioPackLoaded) return;
  dev.__defaultScenarioPackLoaded = true;

  const { add: addScenario } = dev.api.scenarios;

  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  /* ---------------- Basic sanity ---------------- */
  addScenario({
    name:'baseline_ok',
    group:'core',
    stability:'core',
    description:'Baseline pass scenario',
    expect:()=>true
  });

  addScenario({
    name:'baseline_fail_demo',
    group:'core',
    stability:'demo',
    description:'Intentional fail to exercise Issues panel & counts',
    expect:()=>({ok:false,details:'demo expected fail'})
  });

  /* ---------------- Routing scenarios ---------------- */
  addScenario({
    name:'routing_any_detour',
    group:'routing',
    stability:'exp',
    description:'Detect at least one detour route (data-cblcars-route-detour=true)',
    async expect(){
      const rs=dev.api.layout.dumpRoutes(undefined,{silent:true});
      return rs.some(r=>r['data-cblcars-route-detour']==='true')
        ? {ok:true,details:'detour present'}
        : {ok:false,details:'no detour'};
    }
  });

  addScenario({
    name:'routing_any_fallback',
    group:'routing',
    stability:'core',
    description:'Detect any grid fallback (data-cblcars-route-grid-status=fallback)',
    async expect(){
      const rs=dev.api.layout.dumpRoutes(undefined,{silent:true});
      return rs.some(r=>r['data-cblcars-route-grid-status']==='fallback')
        ? {ok:true,details:'fallback route'}
        : {ok:false,details:'none'};
    }
  });

  addScenario({
    name:'routing_channel_hit_or_miss',
    group:'routing',
    stability:'core',
    description:'Check at least one channel hit OR miss attribute exists',
    async expect(){
      const rs=dev.api.layout.dumpRoutes(undefined,{silent:true});
      const hit=rs.some(r=>r['data-cblcars-route-channels-hit']);
      const miss=rs.some(r=>r['data-cblcars-route-channels-miss']==='true');
      return (hit||miss)
        ? {ok:true,details:`hit:${hit} miss:${miss}`}
        : {ok:false,details:'no channel telemetry'};
    }
  });

  /* --- Routing matrix diagnostics (helps explain missing categories) --- */
  addScenario({
    name:'routing_matrix_diagnostics',
    group:'routing',
    stability:'exp',
    description:'Diagnose presence / absence of routing matrix categories with hints & applicability',
    async expect(){
      const rs = dev.api.layout.dumpRoutes(undefined,{silent:true}) || [];

      // Predicate definitions
      const preds = {
        grid_success: r => r['data-cblcars-route-grid-status']==='success',
        grid_fallback: r => r['data-cblcars-route-grid-status']==='fallback',
        smart_clear: r => r['data-cblcars-route-effective']==='smart' &&
                          r['data-cblcars-smart-hit']==='false' &&
                          (r['data-cblcars-smart-skip-reason']==='clear_path' ||
                           r['data-cblcars-route-grid-status']==='skipped'),
        smart_hit: r => r['data-cblcars-route-effective']==='smart' &&
                        r['data-cblcars-smart-hit']==='true',
        detour: r => r['data-cblcars-route-detour']==='true',
        channel_hit: r => !!r['data-cblcars-route-channels-hit'],
        channel_miss: r => r['data-cblcars-route-channels-miss']==='true',
        manhattan: r => r['data-cblcars-route-grid-status']==='manhattan'
      };

      // Applicability heuristics (if no candidate connectors exist, category = not_applicable)
      const applicability = {
        grid_success: () => rs.some(r => (r['data-cblcars-route-effective']==='grid' || r['data-cblcars-route-effective']==='smart')),
        grid_fallback: () => rs.some(r => (r['data-cblcars-route-effective']==='grid' || r['data-cblcars-route-effective']==='smart')),
        smart_clear: () => rs.some(r => r['data-cblcars-route-effective']==='smart'),
        smart_hit: () => rs.some(r => r['data-cblcars-route-effective']==='smart'),
        detour: () => rs.some(r => (r['data-cblcars-route-effective']==='grid' || r['data-cblcars-route-effective']==='smart')),
        channel_hit: () => rs.some(r => !!r['data-cblcars-route-channels'] || r['data-cblcars-route-channels-hit']),
        channel_miss: () => rs.some(r => !!r['data-cblcars-route-channels']),
        manhattan: () => rs.length>0
      };

      const hints = {
        grid_fallback: 'Need a grid (or smart→grid) route that fails all grid attempts (e.g. require missing channel or impossible path).',
        smart_clear: 'Add route_mode_full="smart" connector with no nearby obstacles so smart-hit=false and skip or clear path.',
        smart_hit: 'Add route_mode_full="smart" with avoid obstacle + smart_proximity to trigger smart-hit=true.',
        detour: 'Ensure fallback.enable_two_elbow is true and both Manhattan orders are blocked while a 2-elbow wrap is open.',
        channel_miss: 'Provide route_channels (allow/prefer) where no segment crosses any channel rect.',
        channel_hit: 'Provide route_channels with at least one path segment through a channel.',
      };

      const rows = Object.keys(preds).map(cat => {
        const applicable = !!applicability[cat]();
        const hit = applicable && rs.some(preds[cat]);
        let status, note;
        if (hit){
          status='hit'; note='observed';
        } else if (!applicable){
          status='not_applicable'; note='no candidate connector';
        } else {
          status='missing_expected';
          note = hints[cat] || 'not observed';
        }
        return { category:cat, status, note };
      });

      const failing = rows.filter(r=>r.status==='missing_expected');
      const missingList = failing.map(r=>r.category);

      console.group('[routing_matrix_diagnostics]');
      console.table(rs.map(r => ({
        id: r.id || '?',
        eff: r['data-cblcars-route-effective'],
        grid_status: r['data-cblcars-route-grid-status'],
        smart_hit: r['data-cblcars-smart-hit'],
        smart_skip: r['data-cblcars-smart-skip-reason'],
        detour: r['data-cblcars-route-detour'],
        ch_hit: r['data-cblcars-route-channels-hit'],
        ch_miss: r['data-cblcars-route-channels-miss']
      })));
      console.table(rows);
      if (failing.length){
        console.warn('[routing_matrix_diagnostics] Missing (expected) categories:', missingList.join(', '));
      } else {
        console.info('[routing_matrix_diagnostics] All applicable categories satisfied.');
      }
      console.groupEnd();

      const summary = rows.map(r=>`${r.category}:${r.status}`).join('|');
      return failing.length
        ? { ok:false, details:`FAIL missing_expected: ${missingList.join(', ')} | ${summary}` }
        : { ok:true, details:`OK (${summary})` };
    }
  });

  // Expose quick helper
  if (!dev.api.scenarios.printRoutingMatrixDiag){
    dev.api.scenarios.printRoutingMatrixDiag = () => dev.api.scenarios.run('routing_matrix_diagnostics');
  }

  /* ---------------- Overlays / validation ---------------- */
  addScenario({
    name:'overlays_validation_error_injection',
    group:'overlays',
    stability:'exp',
    description:'Inject malformed overlay & detect validation errors then cleanup',
    async setup(ctx){
      dev.api.overlays.add({id:'__scn_invalid_line',type:'line'}); // missing anchor/attach_to
      await sleep(60);
      dev.api.layout.relayout('*');
    },
    async expect(){
      await sleep(150);
      const root=dev.api.internal.resolve().root;
      const counts=root?.__cblcars_validationCounts;
      return counts?.errors>0
        ? {ok:true,details:`errors=${counts.errors}`}
        : {ok:false,details:'no errors detected'};
    },
    async teardown(){
      dev.api.overlays.remove('__scn_invalid_line');
      await sleep(60);
      dev.api.layout.relayout('*');
    }
  });

  /* ---------------- Anchors / layout ---------------- */
  addScenario({
    name:'anchors_move_changes_path',
    group:'anchors',
    stability:'exp',
    description:'Move first anchor & detect a path d change',
    async setup(ctx){
      const root=dev.api.internal.resolve().root;
      const path=root?.querySelector('path[data-cblcars-start-x]');
      if(!path) throw new Error('No connectors present');
      ctx.pathId=path.id;
      ctx.before=path.getAttribute('d');
      const list=dev.api.anchors.list();
      if(!list.length){
        dev.api.anchors.set('__scn_anchor',10,10);
        await sleep(40);
      }
      const tgt=dev.api.anchors.list()[0];
      ctx.anchorId=tgt.id;
      ctx.old=[tgt.x,tgt.y];
      dev.api.anchors.set(tgt.id,tgt.x+8,tgt.y+8);
      await sleep(120);
      dev.api.layout.relayout('*');
    },
    async expect(ctx){
      const root=dev.api.internal.resolve().root;
      const path=root.getElementById(ctx.pathId);
      if(!path) return {ok:false,details:'missing path'};
      const after=path.getAttribute('d');
      return after!==ctx.before
        ? {ok:true,details:'d changed'}
        : {ok:false,details:'no change'};
    },
    async teardown(ctx){
      if(ctx.anchorId && ctx.old) dev.api.anchors.set(ctx.anchorId,ctx.old[0],ctx.old[1]);
      await sleep(60);
      dev.api.layout.relayout('*');
    }
  });

  /* ---------------- Perf ---------------- */
  addScenario({
    name:'perf_timer_growth',
    group:'perf',
    stability:'core',
    description:'Create timer & expect count >=5',
    async setup(){
      if(!window.cblcars.debug?.perf) throw new Error('no perf debug');
      window.cblcars.debug.perf.reset('scn_tmp');
      for(let i=0;i<5;i++){
        window.cblcars.debug.perf.start('scn_tmp');
        for(let x=0;x<1500;x++){}
        window.cblcars.debug.perf.end('scn_tmp');
      }
    },
    async expect(){
      const t=window.cblcars.debug.perf.get('scn_tmp');
      return t && t.count>=5
        ? {ok:true,details:`count=${t.count}`}
        : {ok:false,details:'count low'};
    }
  });

  addScenario({
    name:'perf_threshold_violation_demo',
    group:'perf',
    stability:'exp',
    description:'Artificial threshold violation demonstration',
    async setup(){
      if(!window.cblcars.debug?.perf) throw new Error('no perf debug');
      window.cblcars.debug.perf.reset('scn_slow');
      for(let i=0;i<4;i++){
        window.cblcars.debug.perf.start('scn_slow');
        await sleep(6);
        window.cblcars.debug.perf.end('scn_slow');
      }
      const t=window.cblcars.debug.perf.get('scn_slow');
      window.cblcars.hud?.api?.setPerfThreshold('scn_slow',{avgMs:Math.max(0,(t?.avgMs||0)-0.1)});
      window.cblcars.hud?.api?.refreshRaw({allowWhilePaused:true});
    },
    async expect(){
      const snap=window.cblcars.hud?.api?.currentSnapshot?.();
      const v=(snap?.sections?.perf?.violations||[]).find(x=>x.id==='scn_slow');
      return v
        ? {ok:true,details:`violation avg>${v.limit}`}
        : {ok:false,details:'no violation'};
    },
    async teardown(){
      window.cblcars.hud?.api?.removePerfThreshold('scn_slow');
      window.cblcars.debug?.perf?.reset('scn_slow');
    }
  });

  console.info('[scenarios] Core scenario pack loaded:',
    dev.api.scenarios.list().length,'scenarios');

  /* FORCE-INCLUDE: routing stress scenario (side-effect module)
     Static import preferred (webpack marks sideEffects), fallback to require for CJS environments. */
  try {
    // eslint-disable-next-line import/no-unassigned-import
    import('./cb-lcars-scenarios-routing-stress.js');
  } catch(_) {
    try { require('./cb-lcars-scenarios-routing-stress.js'); } catch(__) {}
  }

  /* FORCE-INCLUDE: elbow orientation scenario */
  try {
    // eslint-disable-next-line import/no-unassigned-import
    import('./cb-lcars-scenarios-elbow-orient.js');
  } catch(_) {
    try { require('./cb-lcars-scenarios-elbow-orient.js'); } catch(__) {}
  }

  /* ------------------------------------------------------------------
   * Scenario Console Runner
   * Usage:
   *   await window.cblcars.dev.api.scenarios.runAllToConsole()
   *   await window.cblcars.dev.api.scenarios.runAllToConsole('routing')
   *
   * Auto-run (once) if URL has ?cblcarsRunScenarios[=group]
   *   ?cblcarsRunScenarios
   *   ?cblcarsRunScenarios=routing
   * ------------------------------------------------------------------ */
  const scnApi = dev.api.scenarios;

  if (!scnApi.runAllToConsole) {
    scnApi.runAllToConsole = async function runAllToConsole(group){
      const list = scnApi.list().filter(s => !group || s.group === group);
      if (!list.length){
        console.warn('[scenarios] no scenarios to run (group:', group || '*', ')');
        return { passes:0, fails:0, total:0 };
      }
      console.group(`[scenarios] runAll${group?(' group='+group):''}`);
      let passes=0, fails=0;
      for (const s of list){
        let result;
        const label = `${s.name} (${s.group || 'nogroup'})`;
        try {
          if (typeof scnApi.run === 'function'){
            result = await scnApi.run(s.name);
          } else {
            // Fallback manual orchestration
            const ctx = {};
            if (typeof s.setup === 'function'){
              try { await s.setup(ctx); } catch (e) { console.error('setup error', label, e); }
            }
            if (typeof s.expect === 'function'){
              result = await s.expect(ctx);
            } else {
              result = true;
            }
            if (typeof s.teardown === 'function'){
              try { await s.teardown(ctx); } catch (e) { console.error('teardown error', label, e); }
            }
          }
          const ok = (result && typeof result === 'object')
            ? (result.ok !== false)
            : (result !== false);
          const details = (result && result.details) || (ok ? 'ok' : 'fail');
          if (ok){
            passes++;
            console.log('%c✔ %s','color:#4ade80', label, '-', details);
          } else {
            fails++;
            console.warn('%c✖ %s','color:#f87171', label, '-', details);
          }
        } catch (err){
          fails++;
            console.error('%c✖ %s threw','color:#f87171', label, err);
        }
      }
      console.groupEnd();
      const summary = { passes, fails, total: list.length };
      console.info('[scenarios] summary', summary);
      return summary;
    };

    // Optional auto-run via URL param
    try {
      const qs = new URLSearchParams(window.location.search);
      const auto = [...qs.keys()].find(k => k.toLowerCase() === 'cblcarsrunscenarios');
      if (auto) {
        const group = qs.get(auto) || null;
        // Delay a tick to allow late scenario registrations (e.g., stress scenario)
        setTimeout(() => {
          scnApi.runAllToConsole(group);
        }, 200);
      }
    } catch(_) {}
  }

  /* INFO:
     - routing_stress_matrix: self-contained creator of test connectors (works on an otherwise blank card).
       It should (in isolation) satisfy all matrix categories.
       External overlays/anchors may alter results (e.g. detour impossible, fallback avoided).
       To inspect generated connectors after the run:
         window.cblcars.dev.flags = window.cblcars.dev.flags || {};
         window.cblcars.dev.flags.keepStressScenario = true;
         await cblcars.dev.api.scenarios.run('routing_stress_matrix');
     - routing_matrix_diagnostics: read-only; it NEVER creates connectors. On a blank or minimal card
       most categories will be not_applicable or missing_expected (this is normal).
  */
})();