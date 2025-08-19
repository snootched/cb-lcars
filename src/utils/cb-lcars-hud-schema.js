/* Snapshot v4 Schema & Section Provider Registry (Pass 4 patched: provider timing + change detection) */
(function(){
  if(!window.cblcars) window.cblcars = {};
  window.cblcars.hud = window.cblcars.hud || {};

  const REG = {
    providers: new Map(),
    order: []
  };
  // Provider stats: id -> { lastMs, totalMs, builds, maxMs, lastError, lastChanged }
  window.cblcars.hud._providerStats = window.cblcars.hud._providerStats || {};

  function shallowEqual(a,b){
    if(a===b) return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object') return false;
    const ka=Object.keys(a), kb=Object.keys(b);
    if(ka.length!==kb.length) return false;
    for(const k of ka) if(a[k]!==b[k]) return false;
    return true;
  }

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

    // Wrap build function for timing + change detection
    const wrapped = (ctx)=>{
      const stats = window.cblcars.hud._providerStats;
      stats[id] = stats[id] || { lastMs:0,totalMs:0,builds:0,maxMs:0,lastError:null,lastChanged:false };
      const st = stats[id];
      const t0 = performance.now();
      let res;
      try{
        res = buildFn(ctx);
        st.lastError=null;
      }catch(e){
        st.lastError=String(e);
        res = { error:true, message:String(e) };
      }
      const dt = performance.now()-t0;
      st.lastMs=dt;
      st.totalMs+=dt;
      st.maxMs=Math.max(st.maxMs,dt);
      st.builds+=1;

      // Change detection vs ctx.prev (shallow)
      try{
        const prevVal = ctx.prev;
        st.lastChanged = !shallowEqual(prevVal,res);
      }catch{ st.lastChanged = true; }
      return res;
    };

    REG.providers.set(id,{id,buildFn:wrapped,order:opts.order??1000});
    REG.order = [...REG.providers.values()].sort((a,b)=>a.order-b.order).map(p=>p.id);
  }

  window.cblcars.hud.registerSectionProvider = registerSectionProvider;
  window.cblcars.hud._listSectionProviders = ()=>REG.order.slice();

  function buildSnapshotV4(ctx){
    const { prevSnapshot } = ctx;
    const sections={};
    for(const id of REG.order){
      try{
        const p = REG.providers.get(id);
        if(!p) continue;
        sections[id] = p.buildFn({
          prev: prevSnapshot?.sections?.[id],
          fullPrev: prevSnapshot,
          env: ctx.env,
          now: ctx.now
        }) || null;
      }catch(e){
        console.warn('[hud.schema] provider failed', id, e);
        sections[id]={ error:true, message:String(e) };
        const stats=window.cblcars.hud._providerStats;
        stats[id]=stats[id]||{};
        stats[id].lastError=String(e);
      }
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

  if(window.cblcars.hud._pendingProviders){
    try{
      window.cblcars.hud._pendingProviders.forEach(fn=>{try{fn();}catch{}});
    }catch{}
    window.cblcars.hud._pendingProviders = [];
  }
})();