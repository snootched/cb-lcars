/* Routing Panel v4 (Pass 4 patch: emit routing:focus for log filtering) */
(function(){
  const hud=(window.cblcars=window.cblcars||{},window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'routing',
      title:'Routing Detail',
      order:200,
      badge:snap=>snap.sections?.routes?.summary?.total||'',
      render({hudApi,utils}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">
            <button data-p="all" style="font-size:10px;">All</button>
            <button data-p="problems" style="font-size:10px;">Problems</button>
            <button data-p="success" style="font-size:10px;">Success</button>
            <button data-p="detours" style="font-size:10px;">Detours</button>
            <button data-p="fallback" style="font-size:10px;">Fallback</button>
            <button data-p="miss" style="font-size:10px;">Miss</button>
            <button data-p="gridok" style="font-size:10px;">GridOK</button>
            <label><input type="checkbox" data-f="detour">Detour</label>
            <label><input type="checkbox" data-f="fallback">FB</label>
            <label><input type="checkbox" data-f="miss">Miss</label>
            <label><input type="checkbox" data-f="gridSuccess">GridOK</label>
            <select data-f="channel" style="font-size:10px;max-width:130px;"><option value="">(Channel)</option></select>
            <button data-clear style="font-size:10px;">Clear</button>
            <button data-refresh style="font-size:10px;">↻</button>
          </div>
          <div style="max-height:300px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead><tr>
                <th data-sort="id">ID</th>
                <th data-sort="eff">Eff</th>
                <th data-sort="grid">Grid</th>
                <th data-sort="reason">Reason</th>
                <th data-sort="det">Det</th>
                <th data-sort="miss">Miss</th>
                <th data-sort="channelsHit">Ch</th>
                <th data-sort="distCost">Dist</th>
                <th data-sort="bendCost">bCost</th>
                <th data-sort="totalCost">Total (Δ)</th>
                <th data-sort="resolution">Res</th>
              </tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div data-empty style="display:none;opacity:.6;margin-top:4px;">(no routes)</div>`;
        const tbody=el.querySelector('tbody');
        const filters=hudApi.getRoutingFilters();
        const sortState={field:'id',dir:1};

        function setFilterUI(){
          el.querySelectorAll('input[data-f]').forEach(i=>{
            const key=i.getAttribute('data-f');
            i.checked=!!filters[key];
          });
          el.querySelector('select[data-f="channel"]').value=filters.channel||'';
        }
        setFilterUI();

        el.querySelectorAll('button[data-p]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const p=btn.getAttribute('data-p');
            switch(p){
              case'all': Object.assign(filters,{detour:false,fallback:false,miss:false,gridSuccess:false,channel:null}); break;
              case'problems': Object.assign(filters,{detour:true,fallback:true,miss:true,gridSuccess:false,channel:null}); break;
              case'success': Object.assign(filters,{detour:false,fallback:false,miss:false,gridSuccess:true,channel:null}); break;
              case'detours': Object.assign(filters,{detour:true,fallback:false,miss:false,gridSuccess:false,channel:null}); break;
              case'fallback': Object.assign(filters,{detour:false,fallback:true,miss:false,gridSuccess:false,channel:null}); break;
              case'miss': Object.assign(filters,{detour:false,fallback:false,miss:true,gridSuccess:false,channel:null}); break;
              case'gridok': Object.assign(filters,{detour:false,fallback:false,miss:false,gridSuccess:true,channel:null}); break;
            }
            hudApi.setRoutingFilters(filters); hudApi.refreshRaw({allowWhilePaused:true});
          });
        });
        el.querySelectorAll('input[data-f],select[data-f]').forEach(inp=>{
          inp.addEventListener('change',()=>{
            const k=inp.getAttribute('data-f');
            filters[k]=inp.type==='checkbox'?inp.checked:(inp.value||null);
            hudApi.setRoutingFilters(filters);
            hudApi.refreshRaw({allowWhilePaused:true});
          });
        });
        el.querySelector('[data-clear]').addEventListener('click',()=>{
          Object.assign(filters,{detour:false,fallback:false,miss:false,gridSuccess:false,channel:null});
          setFilterUI(); hudApi.setRoutingFilters(filters); hudApi.refreshRaw({allowWhilePaused:true});
        });
        el.querySelector('[data-refresh]').addEventListener('click',()=>hudApi.refreshRaw({allowWhilePaused:true}));

        el.querySelectorAll('th[data-sort]').forEach(th=>{
          th.addEventListener('click',()=>{
            const f=th.getAttribute('data-sort');
            if(sortState.field===f) sortState.dir*=-1; else {sortState.field=f;sortState.dir=1;}
            hudApi.refreshRaw({allowWhilePaused:true});
          });
        });

        function passesFilter(r){
          if(filters.detour && !r.det) return false;
          if(filters.fallback && r.grid!=='fallback') return false;
          if(filters.miss && !r.miss) return false;
          if(filters.gridSuccess && r.grid!=='success') return false;
          if(filters.channel && !(r.channelsHit||'').split(',').includes(filters.channel)) return false;
          return true;
        }

        function refresh(snapshot){
          const byId=(snapshot.sections.routes.byId)||{};
          const rows=Object.values(byId).filter(passesFilter);
          if(!rows.length){
            el.querySelector('[data-empty]').style.display='block';
            tbody.innerHTML='';
            return;
          }
          el.querySelector('[data-empty]').style.display='none';
          rows.sort((a,b)=>{
            const f=sortState.field;
            const av=a[f], bv=b[f];
            if(av===bv) return 0;
            return (av>bv?1:-1)*sortState.dir;
          });
          tbody.innerHTML=rows.map(r=>{
            const prevTotal = snapshot.sections.routes.previous?.[r.id]?.totalCost;
            const curTotal = r.totalCost;
            let deltaHtml='';
            if(prevTotal!=null && curTotal!=null && prevTotal!==0){
              const pct=((curTotal-prevTotal)/prevTotal)*100;
              deltaHtml=` <span class="${pct>0?'hud-delta-neg':'hud-delta-pos'}">(${pct>0?'+':''}${pct.toFixed(1)}%)</span>`;
            }
            return `<tr data-route="${r.id}" style="cursor:pointer;">
              <td>${r.id}</td>
              <td>${r.eff}</td>
              <td>${r.grid}</td>
              <td>${r.reason||''}</td>
              <td>${r.det?'Y':''}</td>
              <td>${r.miss?'Y':''}</td>
              <td>${r.channelsHit}</td>
              <td>${utils.fmtNum(r.distCost)}</td>
              <td>${utils.fmtNum(r.bendCost)}</td>
              <td>${utils.fmtNum(r.totalCost)}${deltaHtml}</td>
              <td>${r.resolution}</td>
            </tr>`;
          }).join('');
          // Channel select update
          const sel=el.querySelector('select[data-f="channel"]');
          const curCh=snapshot.sections.channels.current||{};
          const existing=new Set();
          for(let i=0;i<sel.options.length;i++) if(sel.options[i].value) existing.add(sel.options[i].value);
          Object.keys(curCh).forEach(id=>{
            if(!existing.has(id)){
              const opt=document.createElement('option');
              opt.value=id; opt.textContent=id; sel.appendChild(opt);
            }
          });
          for(let i=sel.options.length-1;i>=0;i--){
            const o=sel.options[i];
            if(o.value && !curCh[o.value]) sel.remove(i);
          }
          // Row click => focus route in routing log
          tbody.querySelectorAll('tr[data-route]').forEach(tr=>{
            tr.addEventListener('click',()=>{
              const rid=tr.getAttribute('data-route');
              hudApi.emit('routing:focus', { id: rid });
            });
          });
        }
        return {rootEl:el,refresh};
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();