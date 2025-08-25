/**
 * Core HUD Providers (Pass 4b patch)
 * - Enhanced channels provider: fallback occupancy derivation from path attributes
 */
(function(){
  if(!window.cblcars) window.cblcars={};
  window.cblcars.hud = window.cblcars.hud || {};
  const hud = window.cblcars.hud;

  function reg(id,fn,order){ hud.registerSectionProvider(id,fn,{order}); }

  /* ROUTES (unchanged from earlier hardened version) */
  reg('routes', ({prev})=>{
    const dev=window.cblcars.dev;
    const {root}=dev?.api?.internal?.resolve? dev.api.internal.resolve():{root:null};
    const byId={}; let total=0,detours=0,gridSucc=0,gridFb=0,miss=0;
    if(root){
      root.querySelectorAll('path[data-cblcars-attach-to]').forEach(p=>{
        const id=p.id||`(r${++total})`;
        const eff=p.getAttribute('data-cblcars-route-effective')||'manhattan';
        const gridStatus=p.getAttribute('data-cblcars-route-grid-status')||'';
        const gridReason=p.getAttribute('data-cblcars-route-grid-reason')||'';
        const det=p.getAttribute('data-cblcars-route-detour')==='true';
        const missCh=p.getAttribute('data-cblcars-route-channels-miss')==='true';
        const chHit=p.getAttribute('data-cblcars-route-channels-hit')||'';
        const distCost=parseFloat(p.getAttribute('data-cblcars-route-cost-distance'));
        const bendCost=parseFloat(p.getAttribute('data-cblcars-route-cost-bends'));
        const totalCost=parseFloat(p.getAttribute('data-cblcars-route-cost-total'));
        byId[id]={id,eff,grid:gridStatus,reason:gridReason,det,miss:missCh,channelsHit:chHit,
          distCost:Number.isFinite(distCost)?distCost:undefined,
          bendCost:Number.isFinite(bendCost)?bendCost:undefined,
          totalCost:Number.isFinite(totalCost)?totalCost:undefined};
        total++;
        if(det) detours++;
        if(gridStatus==='success') gridSucc++;
        if(gridStatus==='fallback') gridFb++;
        if(missCh) miss++;
      });
    }
    const previous={};
    if(prev?.byId) Object.keys(prev.byId).forEach(id=>{
      previous[id]={ totalCost: prev.byId[id].totalCost };
    });
    return { summary:{total,detours,gridSucc,gridFb,miss}, byId, previous };
  },100);

  /* OVERLAYS */
  reg('overlays', ()=>{
    const dev=window.cblcars.dev;
    const {card,root}=dev?.api?.internal?.resolve? dev.api.internal.resolve():{card:null,root:null};
    let list=[], summary={ total:0, withErrors:0, withWarnings:0 }, validation={ errors:0, warnings:0 };
    if(card){
      const msd = card._config?.variables?.msd;
      const ovs = Array.isArray(msd?.overlays)?msd.overlays:[];
      const counts=root?.__cblcars_validationCounts||{errors:0,warnings:0};
      const detail=root?.__cblcars_validationById||{};
      validation=counts;
      list=ovs.map(o=>{
        const d=detail[o.id]||{};
        return {
          id:o.id,type:o.type,
          hasErrors:!!(d.errors&&d.errors.length),
          hasWarnings:!!(d.warnings&&d.warnings.length),
          errorCount:d.errors?d.errors.length:0,
          warningCount:d.warnings?d.warnings.length:0
        };
      });
      summary.total=list.length;
      summary.withErrors=list.filter(x=>x.hasErrors).length;
      summary.withWarnings=list.filter(x=>x.hasWarnings).length;
    }
    return { list, summary, validation };
  },110);

  /* ANCHORS */
  reg('anchors', ()=>{
    const dev=window.cblcars.dev;
    const {root}=dev?.api?.internal?.resolve? dev.api.internal.resolve():{root:null};
    const map=root?.__cblcars_anchors||{};
    return { list:Object.entries(map).map(([id,pt])=>({id,x:pt[0],y:pt[1]})) };
  },120);

  /* CHANNELS (enhanced fallback) */
  reg('channels', ({prev})=>{
    // Primary occupancy if provided by routing.channels
    let current = window.cblcars?.routing?.channels?._occupancy || {};
    // Fallback: derive from path attributes
    if(!current || Object.keys(current).length===0){
      try{
        const dev=window.cblcars.dev;
        const {root}=dev?.api?.internal?.resolve? dev.api.internal.resolve():{root:null};
        if(root){
          const occ={};
          root.querySelectorAll('path[data-cblcars-route-channels-hit]').forEach(p=>{
            const hit=p.getAttribute('data-cblcars-route-channels-hit');
            if(!hit) return;
            hit.split(',').map(s=>s.trim()).filter(Boolean).forEach(ch=>{
              occ[ch]=(occ[ch]||0)+1;
            });
          });
          current=occ;
        }
      }catch{}
    }
    const previous = prev?.current || {};
    return { current, previous };
  },130);

  /* PERF */
  reg('perf', ({env})=>{
    const timers=(function(){
      try{
        const dbg=window.cblcars?.debug?.perf;
        if(!dbg) return {};
        const raw=dbg.get();
        const out={}; Object.keys(raw).forEach(k=>{
          const r=raw[k]; out[k]={lastMs:r.lastMs,avgMs:r.avgMs,count:r.count};
        });
        return out;
      }catch{return {};}
    })();
    const counters=(function(){
      try{
        const dump=window.cblcars?.perf?.dump?.()||{};
        const out={}; Object.keys(dump).forEach(k=>{
          const c=dump[k]; out[k]={count:c.count,avgMs:c.avgMs,lastMs:c.lastMs};
        }); return out;
      }catch{return {};}
    })();
    const thresholds=env.perfThresholds||{};
    const violations=[];
    Object.keys(thresholds).forEach(id=>{
      const th=thresholds[id];
      const t=timers[id]||counters[id];
      if(!t) return;
      if(th.avgMs!=null && t.avgMs>th.avgMs){
        violations.push({id,metric:'avgMs',value:t.avgMs,limit:th.avgMs});
      } else if(th.lastMs!=null && t.lastMs>th.lastMs){
        violations.push({id,metric:'lastMs',value:t.lastMs,limit:th.lastMs});
      }
    });
    return { timers, counters, thresholds, violations };
  },140);

  /* SCENARIOS */
  reg('scenarios', ()=>{
    const res=window.cblcars?.dev?._scenarioResults||[];
    return { results: res.slice() };
  },150);

  /* CONFIG */
  reg('config', ({env})=>{
    return {
      flags: window.cblcars._debugFlags||{},
      pinnedPerf: env.pinnedPerf||[],
      watchRoutes: env.watchRoutes||[],
      routingFilters: env.routingFilters||{},
      selectedProfile: env.selectedProfile||'Custom'
    };
  },160);

  /* DIFF */
  reg('diff', ({prev})=>{
    return { routes:{ cost: prev?.routes?.cost || [] } };
  },900);

})();