/* Health Provider (patched: uses instrumentation, excludes self) */
(function(){
  if(!window.cblcars) window.cblcars={};
  const hud=window.cblcars.hud=window.cblcars.hud||{};
  function init(){
    if(!hud.registerSectionProvider){
      (hud._pendingProviders=hud._pendingProviders||[]).push(init);
      return;
    }
    hud.registerSectionProvider('health', ({prev,env})=>{
      const order = hud._listSectionProviders ? hud._listSectionProviders() : [];
      const perf = hud._providerPerf || {};
      const prevMap = {};
      if(prev?.providers){
        prev.providers.forEach(p=>{ prevMap[p.id]=p; });
      }
      const providers=[];
      for(const id of order){
        if(id==='health') continue; // exclude self
        const meta = perf[id] || { lastMs:0,totalMs:0,avgMs:0,maxMs:0,count:0,error:false };
        const prevRow = prevMap[id];
        providers.push({
          id,
          lastMs: meta.lastMs,
          avgMs: meta.avgMs,
          maxMs: meta.maxMs,
          builds: meta.count,
          changed: prevRow ? prevRow.lastMs !== meta.lastMs : false,
          error: !!meta.error
        });
      }
      // Sort stable by id first build (callers can re-sort)
      return { providers, thresholds: env.providerThresholds || {} };
    },55);
  }
  init();
})();