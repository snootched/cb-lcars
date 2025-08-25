/* Summary Panel v4 */
(function(){
  const hud=(window.cblcars=window.cblcars||{},window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'summary',
      title:'Summary',
      order:100,
      badge:snap=>snap.sections?.routes?.summary?.total || '',
      render({hudApi,utils}){
        const el=document.createElement('div');
        el.style.fontSize='11px';
        el.innerHTML=`
          <div data-routes></div>
          <div data-overlays style="margin-top:6px;"></div>
            <div data-anchors style="margin-top:6px;"></div>
          <div data-scenarios style="margin-top:6px;"></div>
          <div data-channels style="margin-top:6px;"></div>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <button data-refresh style="font-size:10px;">↻</button>
            <button data-cmp style="font-size:10px;">Cmp</button>
            <span data-paused style="display:none;color:#ff99ff;font-weight:bold;font-size:10px;">PAUSED</span>
            <span data-perf></span>
            <span data-build style="font-size:10px;opacity:.6;"></span>
          </div>
          <div data-cmp-box style="margin-top:6px;font-size:10px;"></div>`;
        let cmpBaseline=null;
        el.querySelector('[data-refresh]').addEventListener('click',()=>hudApi.refreshRaw({allowWhilePaused:true}));
        el.querySelector('[data-cmp]').addEventListener('click',()=>{
          if(!hudApi.isPaused()){ alert('Pause first'); return; }
          if(!cmpBaseline){
            cmpBaseline=hudApi.currentSnapshot();
            el.querySelector('[data-cmp-box]').innerHTML='<div style="opacity:.7;">Baseline captured. Refresh & press again.</div>';
          } else {
            const cur=hudApi.currentSnapshot();
            const diffs=utils.diffRouteCosts(cmpBaseline,cur);
            el.querySelector('[data-cmp-box]').innerHTML = diffs.length
              ? `<table style="width:100%;border-collapse:collapse;font-size:10px;">
                  <thead><tr><th>Route</th><th style="text-align:right;">Prev</th><th style="text-align:right;">Cur</th><th style="text-align:right;">Δ%</th></tr></thead>
                  <tbody>${diffs.map(d=>`<tr>
                    <td>${d.id}</td>
                    <td style="text-align:right;">${utils.fmtNum(d.prev)}</td>
                    <td style="text-align:right;">${utils.fmtNum(d.cur)}</td>
                    <td style="text-align:right;color:${d.pct>0?'#ff6688':'#77ff90'};">${d.pct>0?'+':''}${d.pct.toFixed(2)}%</td>
                  </tr>`).join('')}</tbody></table>`
              : '<div style="opacity:.6;">No cost changes</div>';
            cmpBaseline=null;
          }
        });

        function link(label, key){
          return `<a href="#" data-f="${key}" style="color:#ffccff;text-decoration:none;">${label}</a>`;
        }
        function attachFilterLinks(root, summary){
          root.querySelectorAll('a[data-f]').forEach(a=>{
            a.addEventListener('click',e=>{
              e.preventDefault();
              const f=a.getAttribute('data-f');
              const base={detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:false,channel:null};
              if(f==='reset'){ hudApi.setRoutingFilters(base); }
              else { base[f]=true; hudApi.setRoutingFilters(base); }
              hudApi.refreshRaw({allowWhilePaused:true});
            },{once:true});
          });
        }
        function refresh(snapshot){
          const routesSec=snapshot.sections.routes;
          const perfSec=snapshot.sections.perf;
          const overlaysSec=snapshot.sections.overlays;
          const anchorsSec=snapshot.sections.anchors;
          const channelsSec=snapshot.sections.channels;
          const scenariosSec=snapshot.sections.scenarios;

          const rs=routesSec.summary;
          const routesDiv=el.querySelector('[data-routes]');
          routesDiv.innerHTML=`
            <div style="font-weight:bold;margin-bottom:2px;">Routes</div>
            <div>
              Total ${link(rs.total,'reset')} |
              Detours ${link(rs.detours,'detour')} |
              GridOK ${link(rs.gridSucc,'gridSuccess')} |
              FB ${link(rs.gridFb,'fallback')} |
              Miss ${link(rs.miss,'miss')}
            </div>`;
          attachFilterLinks(routesDiv, rs);

          const ovDiv=el.querySelector('[data-overlays]');
          const os=overlaysSec.summary;
          ovDiv.innerHTML=`<div style="font-weight:bold;margin-bottom:2px;">Overlays</div>
            <div>Total ${os.total} | Err ${os.withErrors} | Warn ${os.withWarnings}</div>`;

          el.querySelector('[data-anchors]').innerHTML=`<div style="font-weight:bold;margin-bottom:2px;">Anchors</div>
            <div>Count ${(anchorsSec.list||[]).length}</div>`;

          const scDiv=el.querySelector('[data-scenarios]');
          const res=scenariosSec.results||[];
          const pass=res.filter(r=>r.ok).length;
          scDiv.innerHTML=`<div style="font-weight:bold;margin-bottom:2px;">Scenarios</div>
            <div>${pass}/${res.length} passed</div>`;

          const chDiv=el.querySelector('[data-channels]');
          const cur=channelsSec.current||{};
          const top=Object.entries(cur).sort((a,b)=>b[1]-a[1]).slice(0,4);
          chDiv.innerHTML=top.length
            ? `<div style="font-weight:bold;margin-bottom:2px;">Channels</div>` +
              top.map(([id,v])=>`<div style="display:flex;justify-content:space-between;"><span>${id}</span><span>${v}</span></div>`).join('')
            : `<div style="font-weight:bold;margin-bottom:2px;">Channels</div><div style="opacity:.6;">(none)</div>`;

          // Perf badge
          const perfBadge=el.querySelector('[data-perf]');
          const viol=perfSec.violations||[];
          perfBadge.innerHTML=viol.length?`<span class="hud-badge-perf">PERF! ${viol.length}</span>`:'';

          el.querySelector('[data-build]').textContent='build '+snapshot.meta.buildMs.toFixed(1)+'ms';
          el.querySelector('[data-paused]').style.display=hudApi.isPaused()?'inline-block':'none';
        }
        return { rootEl:el, refresh };
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();