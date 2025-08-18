/* Summary Panel (parity restored)
 * Adds:
 *  - Route filter quick links
 *  - Overlays / Anchors counts
 *  - Scenarios pass summary
 *  - Channels top usage
 *  - Compare tool (baseline vs current cost % change)
 *  - PERF! badge via perf violations
 *  - Pinned mini strip (timers/counters) – shows pinnedPerf IDs
 */
(function(){
  const rootNS=(window.cblcars=window.cblcars||{}, window.cblcars.hud=window.cblcars.hud||{});
  if(!rootNS.registerPanel){
    (rootNS._pendingPanels=rootNS._pendingPanels||[]).push(init);
  }else init();

  function init(){
    rootNS.registerPanel({
      id:'summary',
      title:'Summary',
      order:100,
      badge:snap=>snap.routesSummary.total||'',
      render({hudApi,utils}){
        const el=document.createElement('div');
        el.style.fontSize='11px';
        el.innerHTML=`
          <div data-mini-strip style="display:none;gap:4px;flex-wrap:wrap;margin:0 0 6px;"></div>
          <div data-routes-line></div>
          <div data-overlays-line style="margin-top:6px;"></div>
          <div data-anchors-line style="margin-top:6px;"></div>
          <div data-scenarios-line style="margin-top:6px;"></div>
          <div data-channels-line style="margin-top:6px;"></div>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <button data-legend-btn data-tip="Legend" data-tip-detail="Definitions & metrics">ℹ</button>
            <button data-refresh-now data-tip="Refresh Now">↻</button>
            <button data-compare-btn data-tip="Compare Tool" data-tip-detail="Capture baseline (paused) & diff.">Cmp</button>
            <span data-paused style="display:none;color:#ff99ff;font-weight:bold;font-size:10px;">PAUSED</span>
            <span data-perf-alert style="font-size:10px;"></span>
            <span data-build style="font-size:10px;opacity:.6;"></span>
          </div>
          <div data-compare-box style="margin-top:6px;font-size:10px;"></div>`;
        let compareBaseline=null;

        el.querySelector('[data-refresh-now]').addEventListener('click',()=>hudApi.refreshRaw({allowWhilePaused:true}));
        el.querySelector('[data-legend-btn]').addEventListener('click',()=>hudApi.emit('ui:toggleLegend'));
        el.querySelector('[data-compare-btn]').addEventListener('click',()=>{
          if(!hudApi.isPaused()){
            alert('Pause HUD first to compare.');
            return;
          }
            if(!compareBaseline){
            compareBaseline=hudApi.currentSnapshot();
            el.querySelector('[data-compare-box]').innerHTML='<div style="opacity:.7;">Baseline captured – refresh & press again to diff.</div>';
          } else {
            const cur=hudApi.currentSnapshot()||{};
            const diffs=utils.diffRouteCosts(compareBaseline,cur);
            if(!diffs.length){
              el.querySelector('[data-compare-box]').innerHTML='<div style="opacity:.6;">No route cost changes.</div>';
            } else {
              el.querySelector('[data-compare-box]').innerHTML=
                `<table style="width:100%;border-collapse:collapse;font-size:10px;">
                  <thead><tr><th style="text-align:left;">Route</th><th style="text-align:right;">Prev</th><th style="text-align:right;">Cur</th><th style="text-align:right;">Δ%</th></tr></thead>
                  <tbody>${diffs.map(d=>`<tr>
                    <td>${d.id}</td>
                    <td style="text-align:right;">${utils.fmtNum(d.prev)}</td>
                    <td style="text-align:right;">${utils.fmtNum(d.cur)}</td>
                    <td style="text-align:right;color:${d.pct>0?'#ff6688':'#77ff90'};">${d.pct>0?'+':''}${d.pct.toFixed(2)}%</td>
                  </tr>`).join('')}</tbody>
                </table>`;
            }
            compareBaseline=null;
          }
        });

        function routeFilterLink(label,key){
          return `<a href="#" data-filter="${key}" style="color:#ffccff;text-decoration:none;">${label}</a>`;
        }

        function updatePinnedStrip(snapshot){
          const div=el.querySelector('[data-mini-strip]');
          const status=hudApi.status();
          const pinned=status.pinnedPerf||[];
          if(!pinned.length){div.style.display='none';div.innerHTML='';return;}
          const timers=snapshot.perfTimers||{};
          const counters=snapshot.perfCounters||{};
          div.style.display='flex';
          div.innerHTML=pinned.map(id=>{
            if(timers[id]){
              const t=timers[id];
              return `<span style="background:rgba(100,0,120,0.35);border:1px solid #ff00ff;padding:2px 6px;border-radius:6px;font-size:10px;"
                data-tip="${id}" data-tip-detail="Timer last=${t.lastMs.toFixed(2)}ms avg=${t.avgMs.toFixed(2)}ms n=${t.count}">
                ${id}:${t.lastMs.toFixed(1)}ms
              </span>`;
            } else if(counters[id]){
              const c=counters[id];
              return `<span style="background:rgba(100,0,120,0.35);border:1px solid #ff00ff;padding:2px 6px;border-radius:6px;font-size:10px;"
                data-tip="${id}" data-tip-detail="Counter count=${c.count} avg=${c.avgMs?.toFixed?.(2)||'n/a'}ms">
                ${id}:${c.count}
              </span>`;
            }
            return `<span style="background:rgba(100,0,120,0.35);border:1px solid #ff00ff;padding:2px 6px;border-radius:6px;font-size:10px;">${id}:n/a</span>`;
          }).join('');
        }

        function refresh(snapshot){
          const rs=snapshot.routesSummary;
          const rl=el.querySelector('[data-routes-line]');
          rl.innerHTML=`<div style="font-weight:bold;margin-bottom:2px;">Routes</div>
            <div>
              Total ${routeFilterLink(rs.total,'reset')}
              | Detours ${routeFilterLink(rs.detours,'detour')}
              | GridOK ${routeFilterLink(rs.gridSucc,'gridSuccess')}
              | FB ${routeFilterLink(rs.gridFb,'fallback')}
              | Miss ${routeFilterLink(rs.miss,'miss')}
            </div>`;
          rl.querySelectorAll('a[data-filter]').forEach(a=>{
            a.addEventListener('click',evt=>{
              evt.preventDefault();
              const f=a.getAttribute('data-filter');
              if(f==='reset'){
                hudApi.setRoutingFilters({detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:false,channel:null});
              }else{
                const patch={detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:false,channel:null};
                patch[f]=true;
                hudApi.setRoutingFilters(patch);
              }
              hudApi.refreshRaw({allowWhilePaused:true});
            },{once:true});
          });

          const ovLine=el.querySelector('[data-overlays-line]');
          if(snapshot.overlaysSummary){
            const o=snapshot.overlaysSummary;
            ovLine.innerHTML=`<div style="font-weight:bold;margin-bottom:2px;">Overlays</div>
              <div>Total ${o.total} | Err ${o.withErrors} | Warn ${o.withWarnings}</div>`;
          } else ovLine.innerHTML='';

          const anLine=el.querySelector('[data-anchors-line]');
          if(snapshot.anchorsSummary){
            anLine.innerHTML=`<div style="font-weight:bold;margin-bottom:2px;">Anchors</div><div>Count ${snapshot.anchorsSummary.count}</div>`;
          } else anLine.innerHTML='';

          const sc=el.querySelector('[data-scenarios-line]');
          const res=snapshot.scenarioResults||[];
          if(res.length){
            const pass=res.filter(r=>r.ok).length;
            sc.innerHTML=`<div style="font-weight:bold;margin-bottom:2px;">Scenarios</div><div>${pass}/${res.length} passed</div>`;
          } else sc.innerHTML=`<div style="font-weight:bold;margin-bottom:2px;">Scenarios</div><div style="opacity:.6;">(none)</div>`;

          const chEl=el.querySelector('[data-channels-line]');
          const ch=snapshot.channels||{};
          const top=Object.entries(ch).sort((a,b)=>b[1]-a[1]).slice(0,4);
          chEl.innerHTML=top.length
            ? `<div style="font-weight:bold;margin-bottom:2px;">Channels</div>${top.map(([id,v])=>`<div style="display:flex;justify-content:space-between;"><span>${id}</span><span>${v}</span></div>`).join('')}`
            : `<div style="font-weight:bold;margin-bottom:2px;">Channels</div><div style="opacity:.6;">(none)</div>`;

          el.querySelector('[data-paused]').style.display=hudApi.isPaused()?'inline-block':'none';
          el.querySelector('[data-build]').textContent=`build ${snapshot.buildMs!=null?snapshot.buildMs.toFixed(1)+'ms':''}`;

          // PERF! badge
          try{
            const viols=hudApi._collectPerfViolations?hudApi._collectPerfViolations(snapshot):[];
            el.querySelector('[data-perf-alert]').innerHTML=viols.length
              ? `<span class="hud-badge-perf" data-tip="Perf Alerts" data-tip-detail="${viols.length} thresholds exceeded">PERF! ${viols.length}</span>`
              : '';
          }catch{}
          updatePinnedStrip(snapshot);
        }

        return {rootEl:el,refresh};
      }
    });
  }
})();