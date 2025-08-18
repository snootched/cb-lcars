/* Scenarios Panel (unchanged except rely on runScenario wrapper to update results) */
(function(){
  const hud=(window.cblcars=window.cblcars||{}, window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'scenarios',
      title:'Scenarios',
      order:350,
      badge:snap=>{
        const res=snap.scenarioResults||[];
        if(!res.length) return '';
        const pass=res.filter(r=>r.ok).length;
        return `${pass}/${res.length}`;
      },
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            <button data-run-all style="font-size:10px;">Run All</button>
            <button data-run-failed style="font-size:10px;">Run Failed</button>
            <button data-refresh-scen style="font-size:10px;">↻</button>
          </div>
          <div style="max-height:260px;overflow:auto;">
            <table style="border-collapse:collapse;width:100%;font-size:10px;">
              <thead><tr><th style="text-align:left;">Name</th><th>Status</th><th>ms</th><th>Details</th><th></th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div data-empty style="display:none;opacity:.6;margin-top:4px;">(no scenarios)</div>
          <div data-status style="margin-top:6px;font-size:10px;opacity:.7;"></div>`;
        const tbody=el.querySelector('tbody');
        const statusEl=el.querySelector('[data-status]');
        function setStatus(m){statusEl.textContent=m;}

        async function run(names){
          if(!names.length){setStatus('Nothing to run');return;}
          setStatus('Running…');
          for(const n of names){
            // eslint-disable-next-line no-await-in-loop
            await window.cblcars.dev.runScenario(n);
          }
          setStatus('Done.');
          hudApi.refreshRaw({allowWhilePaused:true});
        }

        el.querySelector('[data-run-all]').addEventListener('click',()=>{
          const list=window.cblcars.dev.listScenarios().map(s=>s.name);
          run(list);
        });
        el.querySelector('[data-run-failed]').addEventListener('click',()=>{
          const failed=(hudApi.currentSnapshot()?.scenarioResults||[]).filter(r=>!r.ok).map(r=>r.scenario);
          run(failed);
        });
        el.querySelector('[data-refresh-scen]').addEventListener('click',()=>hudApi.refreshRaw({allowWhilePaused:true}));
        el.addEventListener('click',e=>{
          const btn=e.target.closest('[data-run-one]');
          if(btn) run([btn.getAttribute('data-run-one')]);
        });

        function refresh(snapshot){
          const scenarios=window.cblcars.dev.listScenarios();
          const results=snapshot.scenarioResults||[];
          const byName={}; results.forEach(r=>byName[r.scenario]=r);
          if(!scenarios.length){
            tbody.innerHTML='';
            el.querySelector('[data-empty]').style.display='block';
            return;
          }
          el.querySelector('[data-empty]').style.display='none';
          tbody.innerHTML=scenarios.map(s=>{
            const r=byName[s.name];
            const status=r?(r.ok?'✓':'✕'):'?';
            const color=r?(r.ok?'#66ff99':'#ff6688'):'#ccc';
            const details=r?(r.details||r.error||''):'';
            const ms=r? r.ms : '';
            return `<tr>
              <td>${s.name}</td>
              <td style="color:${color};font-weight:bold;">${status}</td>
              <td>${ms}</td>
              <td title="${details.replace(/"/g,'&quot;')}">${details.length>40?details.slice(0,37)+'…':details}</td>
              <td><button data-run-one="${s.name}" style="font-size:9px;">▶</button></td>
            </tr>`;
          }).join('');
        }
        return {rootEl:el,refresh};
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();