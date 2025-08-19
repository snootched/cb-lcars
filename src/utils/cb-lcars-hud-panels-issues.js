/* Issues Panel v4 */
(function(){
  const hud=(window.cblcars=window.cblcars||{},window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'issues',
      title:'Issues',
      order:150,
      badge:snap=>{
        const routes=snap.sections.routes.byId||{};
        const det=Object.values(routes).filter(r=>r.det).length;
        const fb=Object.values(routes).filter(r=>r.grid==='fallback').length;
        const miss=Object.values(routes).filter(r=>r.miss).length;
        const overlayErr=snap.sections.overlays.summary.withErrors;
        const valErr=snap.sections.overlays.validation.errors || 0;
        const valWarn=snap.sections.overlays.validation.warnings || 0;
        const perfViol=snap.sections.perf.violations.length;
        const scenFail=(snap.sections.scenarios.results||[]).filter(r=>!r.ok).length;
        return (det+fb+miss+overlayErr+valErr+valWarn+perfViol+scenFail)||'';
      },
      render(){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML='<div data-list style="max-height:220px;overflow:auto;"></div>';
        const list=el.querySelector('[data-list]');
        function refresh(snapshot){
          const items=[];
          const routes=snapshot.sections.routes.byId||{};
          Object.values(routes).filter(r=>r.det).forEach(r=>items.push({type:'Detour',id:r.id,detail:'detour'}));
          Object.values(routes).filter(r=>r.grid==='fallback').forEach(r=>items.push({type:'Fallback',id:r.id,detail:r.reason||''}));
          Object.values(routes).filter(r=>r.miss).forEach(r=>items.push({type:'ChannelMiss',id:r.id,detail:'pref miss'}));
          (snapshot.sections.overlays.list||[]).filter(o=>o.hasErrors).forEach(o=>items.push({type:'OverlayErr',id:o.id,detail:'validation errors'}));
          const val=snapshot.sections.overlays.validation;
          if(val.errors||val.warnings){
            items.push({type:'Validation',id:'counts',detail:`E:${val.errors||0} W:${val.warnings||0}`});
          }
          snapshot.sections.perf.violations.forEach(v=>items.push({type:'Perf',id:v.id,detail:`${v.metric} ${v.value.toFixed? v.value.toFixed(2):v.value} > ${v.limit}`}));
          (snapshot.sections.scenarios.results||[]).filter(r=>!r.ok).forEach(r=>items.push({type:'Scenario',id:r.scenario,detail:r.details||r.error||'fail'}));
          if(!items.length){ list.innerHTML='<div style="opacity:.6;">(no issues)</div>'; return; }
          list.innerHTML=`<table style="width:100%;border-collapse:collapse;">
            <thead><tr><th style="text-align:left;">Type</th><th style="text-align:left;">ID</th><th style="text-align:left;">Detail</th></tr></thead>
            <tbody>${items.map(i=>`<tr><td>${i.type}</td><td>${i.id}</td><td>${i.detail}</td></tr>`).join('')}</tbody>
          </table>`;
        }
        return { rootEl:el, refresh };
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();