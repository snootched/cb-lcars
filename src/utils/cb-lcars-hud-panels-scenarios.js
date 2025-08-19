/* Scenarios Panel v4 (unchanged logic; reads sections.scenarios) */
(function(){
  const hud=(window.cblcars=window.cblcars||{},window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'scenarios',
      title:'Scenarios',
      order:350,
      badge:snap=>{
        const list=snap.sections.scenarios.results||[];
        if(!list.length) return '';
        const pass=list.filter(r=>r.ok).length;
        return `${pass}/${list.length}`;
      },
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;gap:6px;margin-bottom:6px;">
            <button data-run-all style="font-size:10px;">Run All</button>
            <button data-run-fail style="font-size:10px;">Run Failed</button>
            <button data-refresh style="font-size:10px;">↻</button>
          </div>
          <div style="max-height:260px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead><tr><th>Name</th><th>Status</th><th>ms</th><th>Details</th><th></th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div data-empty style="display:none;opacity:.6;margin-top:4px;">(none)</div>`;
        const tbody=el.querySelector('tbody');
        el.querySelector('[data-run-all]').addEventListener('click',()=>{
          const names=window.cblcars.dev.api.scenarios.list().map(s=>s.name);
          (async()=>{ for(const n of names) await window.cblcars.dev.api.scenarios.run(n); hudApi.refreshRaw({allowWhilePaused:true}); })();
        });
        el.querySelector('[data-run-fail]').addEventListener('click',()=>{
          const snap=hudApi.currentSnapshot();
          const failed=(snap.sections.scenarios.results||[]).filter(r=>!r.ok).map(r=>r.scenario);
          (async()=>{ for(const n of failed) await window.cblcars.dev.api.scenarios.run(n); hudApi.refreshRaw({allowWhilePaused:true}); })();
        });
        el.querySelector('[data-refresh]').addEventListener('click',()=>hudApi.refreshRaw({allowWhilePaused:true}));
        tbody.addEventListener('click',e=>{
          const btn=e.target.closest('button[data-one]');
          if(btn){
            const name=btn.getAttribute('data-one');
            (async()=>{ await window.cblcars.dev.api.scenarios.run(name); hudApi.refreshRaw({allowWhilePaused:true}); })();
          }
        });
        function refresh(snapshot){
          const list=window.cblcars.dev.api.scenarios.list();
          const resMap={}; (snapshot.sections.scenarios.results||[]).forEach(r=>resMap[r.scenario]=r);
          if(!list.length){
            el.querySelector('[data-empty]').style.display='block';
            tbody.innerHTML='';
            return;
          }
          el.querySelector('[data-empty]').style.display='none';
          tbody.innerHTML=list.map(s=>{
            const r=resMap[s.name];
            const status=r?(r.ok?'✓':'✕'):'?';
            const color=r?(r.ok?'#66ff99':'#ff6688'):'#ccc';
            const ms=r?r.ms:'';
            const details=(r?(r.details||r.error||''):'');
            return `<tr>
              <td>${s.name}</td>
              <td style="color:${color};font-weight:bold;">${status}</td>
              <td>${ms}</td>
              <td title="${details.replace(/"/g,'&quot;')}">${details.length>40?details.slice(0,37)+'…':details}</td>
              <td><button data-one="${s.name}" style="font-size:9px;">▶</button></td>
            </tr>`;
          }).join('');
        }
        return { rootEl:el, refresh };
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();