/* Snapshot v4 Schema & Section Provider Registry
 * (Patched: provider perf instrumentation)
 *
 * Adds per-provider timing under window.cblcars.hud._providerPerf:
 *  {
 *    <id>: { lastMs, totalMs, avgMs, maxMs, count, error? }
 *  }
 */
(function(){
  if(!window.cblcars) window.cblcars = {};
  window.cblcars.hud = window.cblcars.hud || {};

  const REG = {
    providers: new Map(),
    order: []
  };

  function registerSectionProvider(id, buildFn, opts={}){
    if(!id || typeof buildFn!=='function') return;
    if(window.cblcars.hud.__providersFrozen){
      console.warn('[hud.schema] Provider registration after freeze ignored', id);
      return;
    }
    if(REG.providers.has(id)){
      console.warn('[hud.schema] Duplicate provider id ignored', id);
      return;
    }
    REG.providers.set(id,{id,buildFn,order:opts.order??1000});
    REG.order = [...REG.providers.values()].sort((a,b)=>a.order-b.order).map(p=>p.id);
  }

  window.cblcars.hud.registerSectionProvider = registerSectionProvider;
  window.cblcars.hud._listSectionProviders = ()=>REG.order.slice();

  function ensurePerfStore(){
    const hud = window.cblcars.hud;
    hud._providerPerf = hud._providerPerf || {};
    return hud._providerPerf;
  }

  function buildSnapshotV4(ctx){
    const { prevSnapshot } = ctx;
    const sections={};
    const perfStore = ensurePerfStore();

    for(const id of REG.order){
      const pRec = REG.providers.get(id);
      if(!pRec) continue;
      const t0 = performance.now();
      let error = false;
      let built;
      try{
        built = pRec.buildFn({
          prev: prevSnapshot?.sections?.[id],
          fullPrev: prevSnapshot,
            env: ctx.env,
          now: ctx.now
        }) || null;
      }catch(e){
        console.warn('[hud.schema] provider failed', id, e);
        built = { error:true, message:String(e) };
        error = true;
      }
      const dt = performance.now()-t0;
      const perfRow = perfStore[id] || (perfStore[id] = { lastMs:0,totalMs:0,avgMs:0,maxMs:0,count:0,error:false });
      perfRow.lastMs = dt;
      perfRow.totalMs += dt;
      perfRow.count += 1;
      perfRow.avgMs = perfRow.totalMs / perfRow.count;
      if(dt > perfRow.maxMs) perfRow.maxMs = dt;
      perfRow.error = error;
      sections[id] = built;
    }

    return {
      meta:{
        schema:4,
        timestamp:ctx.now,
        iso:new Date(ctx.now).toISOString(),
        buildMs:0,
        hudVersion:ctx.env.hudVersion,
        interval:ctx.env.interval,
        paused:ctx.env.paused,
        capabilities:Object.keys(sections)
      },
      sections
    };
  }

  window.cblcars.hud._buildSnapshotV4 = buildSnapshotV4;

  /* Flush any pending providers queued before schema loaded */
  if(window.cblcars.hud._pendingProviders){
    try{
      window.cblcars.hud._pendingProviders.forEach(fn=>{try{fn();}catch{}});
    }catch{}
    window.cblcars.hud._pendingProviders = [];
  }
})();