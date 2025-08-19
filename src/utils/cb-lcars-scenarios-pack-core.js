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
})();