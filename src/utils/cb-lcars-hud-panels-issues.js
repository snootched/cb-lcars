/* Issues Panel (parity) – adds perf violations + validation counts */
(function(){
  const ns=(window.cblcars=window.cblcars||{}, window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    ns.registerPanel({
      id:'issues',
      title:'Issues',
      order:150,
      badge:snap=>{
        const scenFails=(snap.scenarioResults||[]).filter(r=>!r.ok).length;
        const det=Object.values(snap.routesById||{}).filter(r=>r.det).length;
        const fb=Object.values(snap.routesById||{}).filter(r=>r.grid==='fallback').length;
        const miss=Object.values(snap.routesById||{}).filter(r=>r.miss).length;
        const ovErr=snap.overlaysSummary?snap.overlaysSummary.withErrors:0;
        const validations=(snap.validation?.counts?.errors||0)+(snap.validation?.counts?.warnings||0);
        const perfViol=(window.cblcars.hud.api?._collectPerfViolations?window.cblcars.hud.api._collectPerfViolations(snap):[]).length;
        return (scenFails+det+fb+miss+ovErr+validations+perfViol)||'';
      },
      render(){
        const root=document.createElement('div');
        root.style.fontSize='10px';
        root.innerHTML='<div data-list style="max-height:220px;overflow:auto;"></div>';
        const listEl=root.querySelector('[data-list]');
        return {
          rootEl:root,
          refresh(snap){
            const items=[];
            const routes=Object.values(snap.routesById||{});
            routes.filter(r=>r.det).forEach(r=>items.push({type:'Detour',id:r.id,detail:'detour used'}));
            routes.filter(r=>r.grid==='fallback').forEach(r=>items.push({type:'Fallback',id:r.id,detail:r.reason||''}));
            routes.filter(r=>r.miss).forEach(r=>items.push({type:'ChannelMiss',id:r.id,detail:'preferred miss'}));
            (snap.overlaysBasic||[]).filter(o=>o.hasErrors).forEach(o=>items.push({type:'OverlayErr',id:o.id,detail:'validation errors'}));
            (snap.scenarioResults||[]).filter(r=>!r.ok).forEach(r=>items.push({type:'Scenario',id:r.scenario,detail:r.details||r.error||'fail'}));
            const validationCounts=snap.validation?.counts;
            if(validationCounts && (validationCounts.errors||validationCounts.warnings)){
              items.push({type:'Validation',id:'counts',detail:`E:${validationCounts.errors||0} W:${validationCounts.warnings||0}`});
            }
            const perfViol=window.cblcars.hud.api?._collectPerfViolations?window.cblcars.hud.api._collectPerfViolations(snap):[];
            perfViol.forEach(v=>items.push({type:'Perf',id:v.id,detail:v.detail}));
            if(!items.length){
              listEl.innerHTML='<div style="opacity:.6;">(no issues)</div>';
              return;
            }
            listEl.innerHTML=`<table style="width:100%;border-collapse:collapse;">
              <thead><tr><th style="text-align:left;">Type</th><th style="text-align:left;">ID</th><th style="text-align:left;">Detail</th></tr></thead>
              <tbody>${items.map(i=>`<tr><td>${i.type}</td><td>${i.id}</td><td>${i.detail}</td></tr>`).join('')}</tbody>
            </table>`;
          }
        };
      }
    });
  }
  if(!ns.registerPanel)(ns._pendingPanels=ns._pendingPanels||[]).push(init); else init();
})();