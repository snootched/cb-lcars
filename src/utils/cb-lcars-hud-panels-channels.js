/* Channels Panel (parity)
 * Adds Δ (delta vs previous snapshot) + weight column.
 */
(function(){
  const hud=(window.cblcars=window.cblcars||{}, window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'channels',
      title:'Channels',
      order:250,
      badge:snap=>Object.keys(snap.channels||{}).length||'',
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            <button data-clear style="font-size:10px;">Clear Filter</button>
          </div>
          <div style="max-height:240px;overflow:auto;">
            <table style="border-collapse:collapse;width:100%;font-size:10px;">
              <thead>
                <tr>
                  <th data-sort="id">Channel</th>
                  <th data-sort="occ">Occ</th>
                  <th data-sort="delta">Δ</th>
                  <th data-sort="pct">%</th>
                  <th data-sort="weight">W</th>
                </tr>
              </thead>
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

        function channelWeight(id){
          try{
            const parsed=window.cblcars?.routing?._parsedChannels||[];
            const f=parsed.find(c=>c.id===id);
            return f?(f.weight||1):'';
          }catch{return'';}
        }

        return {
          rootEl:el,
          refresh(snapshot){
            const ch=snapshot.channels||{};
            const prev=snapshot.previous?.channels||{};
            const ids=Object.keys(ch);
            if(!ids.length){
              el.querySelector('[data-empty]').style.display='block';
              tbody.innerHTML='';
              return;
            }
            el.querySelector('[data-empty]').style.display='none';
            const total=ids.reduce((s,i)=>s+ch[i],0)||1;
            const rows=ids.map(id=>{
              const occ=ch[id];
              const prevOcc=prev[id]||0;
              const delta=occ-prevOcc;
              return {
                id,occ,delta,pct:(occ/total)*100,
                weight:channelWeight(id)
              };
            }).sort((a,b)=>{
              const f=sort.field; if(a[f]===b[f]) return 0; return (a[f]>b[f]?1:-1)*sort.dir;
            });
            tbody.innerHTML=rows.map(r=>{
              const pct=r.pct.toFixed(1);
              return `<tr data-id="${r.id}" style="cursor:pointer;">
                <td>${r.id}</td>
                <td>${r.occ}</td>
                <td style="color:${r.delta>0?'#77ff90':(r.delta<0?'#ff6688':'#ccc')}">${r.delta>0?'+':''}${r.delta}</td>
                <td>${pct}</td>
                <td>${r.weight}</td>
              </tr>
              <tr><td colspan="5">
                <div style="background:rgba(255,0,255,0.1);height:6px;border-radius:3px;overflow:hidden;">
                  <div style="height:6px;width:${pct}%;background:linear-gradient(90deg,#ff00ff,#ff77ff);"></div>
                </div>
              </td></tr>`;
            }).join('');
            tbody.querySelectorAll('tr[data-id]').forEach(tr=>{
              tr.addEventListener('click',()=>{
                const id=tr.getAttribute('data-id');
                const cur=hudApi.getRoutingFilters();
                hudApi.setRoutingFilters({channel:cur.channel===id?null:id});
                hudApi.refreshRaw({allowWhilePaused:true});
              });
            });
          }
        };
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();