/* Channels Panel v4 */
(function(){
  const hud=(window.cblcars=window.cblcars||{},window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'channels',
      title:'Channels',
      order:250,
      badge:snap=>Object.keys(snap.sections.channels.current||{}).length||'',
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;gap:6px;margin-bottom:6px;">
            <button data-clear style="font-size:10px;">Clear Filter</button>
          </div>
          <div style="max-height:240px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead><tr>
                <th data-sort="id">Channel</th>
                <th data-sort="occ">Occ</th>
                <th data-sort="delta">Δ</th>
                <th data-sort="pct">%</th>
              </tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div data-empty style="display:none;opacity:.6;margin-top:4px;">(no channels)</div>`;
        const tbody=el.querySelector('tbody');
        let sort={field:'occ',dir:-1};
        el.querySelector('[data-clear]').addEventListener('click',()=>{
          hudApi.setRoutingFilters({channel:null});
          hudApi.refreshRaw({allowWhilePaused:true});
        });
        el.querySelectorAll('th[data-sort]').forEach(th=>{
          th.addEventListener('click',()=>{
            const f=th.getAttribute('data-sort');
            if(sort.field===f) sort.dir*=-1; else sort={field:f,dir:(f==='id'?1:-1)};
            hudApi.refreshRaw({allowWhilePaused:true});
          });
        });

        function refresh(snapshot){
          const cur=snapshot.sections.channels.current||{};
          const prev=snapshot.sections.channels.previous||{};
          const ids=Object.keys(cur);
          if(!ids.length){
            el.querySelector('[data-empty]').style.display='block';
            tbody.innerHTML='';
            return;
          }
          el.querySelector('[data-empty]').style.display='none';
          const total=ids.reduce((s,i)=>s+cur[i],0)||1;
          const rows=ids.map(id=>{
            const occ=cur[id];
            const delta=occ-(prev[id]||0);
            return { id, occ, delta, pct:(occ/total)*100 };
          }).sort((a,b)=>{
            const f=sort.field;
            if(a[f]===b[f]) return 0;
            return (a[f]>b[f]?1:-1)*sort.dir;
          });
          tbody.innerHTML=rows.map(r=>`
            <tr data-id="${r.id}" style="cursor:pointer;">
              <td>${r.id}</td>
              <td>${r.occ}</td>
              <td style="color:${r.delta>0?'#77ff90':(r.delta<0?'#ff6688':'#ccc')}">${r.delta>0?'+':''}${r.delta}</td>
              <td>${r.pct.toFixed(1)}</td>
            </tr>
            <tr><td colspan="4">
              <div style="background:rgba(255,0,255,0.1);height:6px;border-radius:3px;overflow:hidden;">
                <div style="height:6px;width:${r.pct.toFixed(1)}%;background:linear-gradient(90deg,#ff00ff,#ff77ff);"></div>
              </div>
            </td></tr>`).join('');
          tbody.querySelectorAll('tr[data-id]').forEach(tr=>{
            tr.addEventListener('click',()=>{
              const id=tr.getAttribute('data-id');
              const curFilt=hudApi.getRoutingFilters();
              hudApi.setRoutingFilters({channel:curFilt.channel===id?null:id});
              hudApi.refreshRaw({allowWhilePaused:true});
            });
          });
        }
        return { rootEl:el, refresh };
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();