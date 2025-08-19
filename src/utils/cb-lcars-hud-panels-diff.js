/* Diff Panel v4 – route cost percentage changes */
(function(){
  const hud=(window.cblcars=window.cblcars||{},window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'diff',
      title:'Diff',
      order:180,
      badge:snap=>{
        const list=snap.sections?.diff?.routes?.cost||[];
        return list.length?list.length:'';
      },
      render({hudApi,utils}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;gap:6px;margin-bottom:6px;">
            <button data-refresh style="font-size:10px;">↻</button>
            <span style="opacity:.7;">Route Cost Changes</span>
          </div>
          <div style="max-height:240px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead><tr><th>ID</th><th>Prev</th><th>Cur</th><th>Δ%</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div data-empty style="display:none;opacity:.6;margin-top:4px;">(no deltas)</div>`;
        const tbody=el.querySelector('tbody');
        el.querySelector('[data-refresh]').addEventListener('click',()=>hudApi.refreshRaw({allowWhilePaused:true}));
        function refresh(snapshot){
          const rows=snapshot.sections?.diff?.routes?.cost||[];
          if(!rows.length){
            el.querySelector('[data-empty]').style.display='block';
            tbody.innerHTML='';
            return;
          }
          el.querySelector('[data-empty]').style.display='none';
          tbody.innerHTML=rows.map(r=>{
            const pct=r.pct;
            const color=pct>0?'#ff6688':'#77ff90';
            return `<tr>
              <td>${r.id}</td>
              <td>${utils.fmtNum(r.prev)}</td>
              <td>${utils.fmtNum(r.cur)}</td>
              <td style="color:${color};font-weight:bold;">${pct>0?'+':''}${pct.toFixed(2)}%</td>
            </tr>`;
          }).join('');
        }
        return {rootEl:el,refresh};
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();