/* Routing Panel (parity restored)
 * Features:
 *  - Filter presets
 *  - Individual filters (detour/fallback/miss/smartHit/gridSuccess/channel)
 *  - Sorting
 *  - Cost delta (Δ% + previous value in parentheses)
 *  - Hover highlight toggle
 *  - Expansion rows with attempts, smart details, channel prefs, full attrs
 *  - Watch list (fixed history depth = 5)
 */
(function(){
  const hud=(window.cblcars=window.cblcars||{}, window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'routing',
      title:'Routing Detail',
      order:200,
      badge:snap=>snap.routesSummary.total||'',
      render({hudApi,definitions,utils}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;align-items:center;">
            <div data-presets style="display:flex;gap:4px;flex-wrap:wrap;">
              <button data-preset="all" class="hud-filter-preset-btn">All</button>
              <button data-preset="problems" class="hud-filter-preset-btn">Problems</button>
              <button data-preset="success" class="hud-filter-preset-btn">Success</button>
              <button data-preset="detours" class="hud-filter-preset-btn">Detours</button>
              <button data-preset="fallback" class="hud-filter-preset-btn">Fallback</button>
              <button data-preset="miss" class="hud-filter-preset-btn">Miss</button>
              <button data-preset="gridok" class="hud-filter-preset-btn">GridOK</button>
            </div>
            <label><input type="checkbox" data-f="detour">Detours</label>
            <label><input type="checkbox" data-f="fallback">Fallback</label>
            <label><input type="checkbox" data-f="miss">Miss</label>
            <label><input type="checkbox" data-f="smartHit">Smart Hit</label>
            <label><input type="checkbox" data-f="gridSuccess">GridOK</label>
            <select data-f="channel" style="font-size:10px;max-width:130px;"><option value="">(Channel)</option></select>
            <button data-clear style="font-size:10px;">Clear</button>
            <button data-refresh style="font-size:10px;">↻</button>
            <button data-highlight style="font-size:10px;">Hi✓</button>
          </div>
          <div style="overflow:auto;max-height:300px;">
            <table class="hud-table" style="border-collapse:collapse;width:100%;" data-table>
              <thead>
                <tr>
                  <th data-sort="id">ID</th>
                  <th data-sort="eff" data-tip="Eff" data-tip-detail="${definitions.eff.l}">Eff</th>
                  <th data-sort="grid" data-tip="Grid" data-tip-detail="${definitions.gridStatus.l}">Grid</th>
                  <th data-sort="reason" data-tip="Reason" data-tip-detail="${definitions.gridReason.l}">Reason</th>
                  <th data-sort="det" data-tip="Det" data-tip-detail="${definitions.detour.l}">Det</th>
                  <th data-sort="miss" data-tip="Miss" data-tip-detail="${definitions.miss.l}">Miss</th>
                  <th data-sort="channelsHit" data-tip="Ch" data-tip-detail="${definitions.channelsHit.l}">Ch</th>
                  <th data-sort="distCost" data-tip="Dist" data-tip-detail="${definitions.distanceCost.l}">Dist</th>
                  <th data-sort="bends" data-tip="Bends" data-tip-detail="${definitions.bends.l}">Bends</th>
                  <th data-sort="bendCost" data-tip="bCost" data-tip-detail="${definitions.bendCost.l}">bCost</th>
                  <th data-sort="totalCost" data-tip="Total" data-tip-detail="${definitions.totalCost.l}">Total (Δ)</th>
                  <th data-sort="resolution" data-tip="Res" data-tip-detail="${definitions.resolution.l}">Res</th>
                  <th data-sort="watch" data-tip="Watch" data-tip-detail="${definitions.watch.l}">👁</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
          <div data-empty style="display:none;opacity:.6;margin-top:4px;">(no routes)</div>
          <div data-watch style="margin-top:10px;"></div>`;
        const tbody=el.querySelector('tbody');

        const filters=hudApi.getRoutingFilters();
        const sortState={field:'id',dir:1};
        let rowMap=new Map(), expanded=new Set();
        let highlightEnabled=true;
        const watchHistory={}, WATCH_DEPTH=5; // fixed
        let hoverHiTO=null;

        function applyPreset(preset){
          switch(preset){
            case'all': Object.assign(filters,{detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:false,channel:null}); break;
            case'problems': Object.assign(filters,{detour:true,fallback:true,miss:true,smartHit:false,gridSuccess:false,channel:null}); break;
            case'success': Object.assign(filters,{detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:true,channel:null}); break;
            case'detours': Object.assign(filters,{detour:true,fallback:false,miss:false,smartHit:false,gridSuccess:false,channel:null}); break;
            case'fallback': Object.assign(filters,{detour:false,fallback:true,miss:false,smartHit:false,gridSuccess:false,channel:null}); break;
            case'miss': Object.assign(filters,{detour:false,fallback:false,miss:true,smartHit:false,gridSuccess:false,channel:null}); break;
            case'gridok': Object.assign(filters,{detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:true,channel:null}); break;
          }
          hudApi.setRoutingFilters(filters);
          hudApi.refreshRaw({allowWhilePaused:true});
        }

        el.querySelectorAll('[data-preset]').forEach(btn=>{
          btn.addEventListener('click',()=>applyPreset(btn.getAttribute('data-preset')));
        });

        el.querySelectorAll('input[data-f],select[data-f]').forEach(inp=>{
          const k=inp.getAttribute('data-f');
          if(inp.type==='checkbox') inp.checked=!!filters[k];
          else if(k==='channel') inp.value=filters.channel||'';
          inp.addEventListener('change',()=>{
            filters[k]=inp.type==='checkbox'?inp.checked:(inp.value||null);
            hudApi.setRoutingFilters(filters);
            hudApi.refreshRaw({allowWhilePaused:true});
          });
        });
        el.querySelector('[data-clear]').addEventListener('click',()=>{
          Object.assign(filters,{detour:false,fallback:false,miss:false,smartHit:false,gridSuccess:false,channel:null});
          el.querySelectorAll('input[data-f]').forEach(c=>c.checked=false);
          el.querySelector('select[data-f="channel"]').value='';
          hudApi.setRoutingFilters(filters);
          hudApi.refreshRaw({allowWhilePaused:true});
        });
        el.querySelector('[data-refresh]').addEventListener('click',()=>hudApi.refreshRaw({allowWhilePaused:true}));
        el.querySelector('[data-highlight]').addEventListener('click',e=>{
          highlightEnabled=!highlightEnabled;
          e.target.textContent=highlightEnabled?'Hi✓':'Hi✕';
        });

        el.querySelectorAll('th[data-sort]').forEach(th=>{
          th.addEventListener('click',()=>{
            const f=th.getAttribute('data-sort');
            if(sortState.field===f) sortState.dir*=-1; else {sortState.field=f;sortState.dir=1;}
            hudApi.refreshRaw({allowWhilePaused:true});
          });
        });

        function applyFilters(rows){
          return rows.filter(r=>{
            if(filters.detour && !r.det) return false;
            if(filters.fallback && r.grid!=='fallback') return false;
            if(filters.miss && !r.miss) return false;
            if(filters.smartHit && r.attrs['data-cblcars-smart-hit']!=='true') return false;
            if(filters.gridSuccess && r.grid!=='success') return false;
            if(filters.channel && !(r.channelsHit||'').split(',').includes(filters.channel)) return false;
            return true;
          });
        }
        function sortRows(rows){
          const f=sortState.field, dir=sortState.dir;
          return rows.sort((a,b)=>{
            const av=a[f], bv=b[f];
            if(av==null && bv!=null) return -1*dir;
            if(bv==null && av!=null) return 1*dir;
            if(av===bv) return 0;
            return (av>bv?1:-1)*dir;
          });
        }

        function updateRows(snapshot){
          const rows=sortRows(applyFilters(Object.values(snapshot.routesById||{})));
          const keep=new Set(rows.map(r=>r.id));
          for(const [id,tr] of rowMap.entries()){
            if(!keep.has(id)){
              tr.remove(); rowMap.delete(id); expanded.delete(id);
              const next=tr.nextElementSibling;
              if(next && next.getAttribute('data-expansion-for')===id) next.remove();
            }
          }
          rows.forEach(r=>{
            let tr=rowMap.get(r.id);
            if(!tr){
              tr=document.createElement('tr');
              tr.setAttribute('data-id',r.id);
              tr.innerHTML=`
                <td data-c="id"></td>
                <td data-c="eff"></td>
                <td data-c="grid"></td>
                <td data-c="reason"></td>
                <td data-c="det"></td>
                <td data-c="miss"></td>
                <td data-c="channelsHit" style="max-width:110px;overflow:hidden;text-overflow:ellipsis;"></td>
                <td data-c="distCost"></td>
                <td data-c="bends"></td>
                <td data-c="bendCost"></td>
                <td data-c="totalCost"></td>
                <td data-c="resolution"></td>
                <td data-c="watch" style="text-align:center;"></td>`;
              tr.addEventListener('click',e=>{
                if(e.target.closest('button')) return;
                toggleExpand(r.id,snapshot);
              });
              tr.addEventListener('mouseenter',()=>{
                if(!highlightEnabled) return;
                clearTimeout(hoverHiTO);
                if(window.cblcars?.msd?.highlight){
                  hoverHiTO=setTimeout(()=>{
                    try{window.cblcars.msd.highlight(r.id,{duration:900,root:dev._activeCard?.shadowRoot});}catch{}
                  },60);
                }
              });
              tr.addEventListener('mouseleave',()=>clearTimeout(hoverHiTO));
              tbody.appendChild(tr);
              rowMap.set(r.id,tr);
            }
            setCell(tr,'id',r.id);
            setCell(tr,'eff',r.eff);
            setCell(tr,'grid',r.grid);
            setCell(tr,'reason',r.reason);
            setCell(tr,'det',r.det?'Y':'');
            setCell(tr,'miss',r.miss?'Y':'');
            setCell(tr,'channelsHit',r.channelsHit);
            setCell(tr,'distCost',utils.fmtNum(r.distCost));
            setCell(tr,'bends',utils.fmtNum(r.bends));
            setCell(tr,'bendCost',utils.fmtNum(r.bendCost));
            setCostDeltaCell(tr,r,snapshot);
            setCell(tr,'resolution',r.resolution||'');
            const wCell=tr.querySelector('[data-c="watch"]');
            if(wCell && !wCell.querySelector('button')){
              const b=document.createElement('button');
              b.style.cssText='font-size:10px;padding:0 4px;';
              const status=hudApi.getWatchRoutes();
              b.textContent=status.includes(r.id)?'−':'+';
              b.addEventListener('click',e=>{
                e.stopPropagation();
                const cur=hudApi.getWatchRoutes();
                if(cur.includes(r.id)) hudApi.unwatchRoute(r.id); else hudApi.watchRoute(r.id);
                b.textContent=hudApi.getWatchRoutes().includes(r.id)?'−':'+';
                recordWatch(snapshot);
                renderWatch(snapshot);
              });
              wCell.appendChild(b);
            } else if(wCell){
              const b=wCell.querySelector('button');
              if(b) b.textContent=hudApi.getWatchRoutes().includes(r.id)?'−':'+';
            }
            ensureExpansion(r.id,r,snapshot);
          });
          el.querySelector('[data-empty]').style.display=rows.length?'none':'block';
          refreshChannelSelect(snapshot);
        }

        function setCell(tr,col,val){
          const td=tr.querySelector(`[data-c="${col}"]`);
          if(!td) return;
          const old=td.__v;
          td.textContent=val==null?'':val;
          td.__v=td.textContent;
          if(old!=null && old!==td.__v){
            td.classList.remove('hud-flash'); void td.offsetWidth; td.classList.add('hud-flash');
          }
        }

        function setCostDeltaCell(tr,r,snapshot){
          const td=tr.querySelector('[data-c="totalCost"]');
          if(!td) return;
          const prev=snapshot.previous?.routesById?.[r.id]?.totalCost;
          const cur=r.totalCost;
          let html=utils.fmtNum(cur);
          td.classList.remove('hud-delta-pos','hud-delta-neg');
          if(prev!=null && cur!=null && prev!==0){
            const pct=((cur-prev)/prev)*100;
            const pctStr=(pct>0?'+':'')+pct.toFixed(1)+'%';
            const prevStr=utils.fmtNum(prev);
            html+=` <span class="${pct>0?'hud-delta-neg':'hud-delta-pos'}">(${pctStr} prev:${prevStr})</span>`;
            if(pct>0) td.classList.add('hud-delta-neg'); else if(pct<0) td.classList.add('hud-delta-pos');
          }
          if(td.innerHTML!==html){
            td.innerHTML=html;
            td.classList.remove('hud-flash'); void td.offsetWidth; td.classList.add('hud-flash');
          }
        }

        function ensureExpansion(id,row,snapshot){
          const tr=rowMap.get(id); if(!tr) return;
          let next=tr.nextElementSibling;
          const exp=expanded.has(id);
          if(exp){
            if(!next || next.getAttribute('data-expansion-for')!==id){
              next=document.createElement('tr');
              next.setAttribute('data-expansion-for',id);
              const td=document.createElement('td');
              td.colSpan=13;
              td.style.cssText='background:rgba(70,0,90,0.35);font-size:10px;padding:4px 6px;';
              next.appendChild(td);
              tr.parentNode.insertBefore(next,tr.nextElementSibling);
            }
            next.firstElementChild.innerHTML=expansionHtml(row);
          } else if(next && next.getAttribute('data-expansion-for')===id){
            next.remove();
          }
        }
        function expansionHtml(r){
          const a=r.attrs||{};
          function line(k,v){
            return `<div style="display:flex;gap:6px;">
              <div style="width:110px;opacity:.65;">${k}</div>
              <div style="flex:1;">${v||'<span style="opacity:.4;">—</span>'}</div>
            </div>`;
          }
          const attempts=a['data-cblcars-route-grid-attempts']||'';
          let attemptsTable='';
          if(attempts){
            const rows=attempts.split(',').map(s=>s.trim()).filter(Boolean).map(pair=>{
              const [res,status]=pair.split(':'); return {res,status};
            });
            if(rows.length){
              attemptsTable=`<table style="border-collapse:collapse;font-size:9px;margin-top:4px;">
                <thead><tr><th style="text-align:left;padding:2px 4px;">Res</th><th style="text-align:left;padding:2px 4px;">Status</th></tr></thead>
                <tbody>${rows.map(rw=>`<tr><td style="padding:2px 4px;">${rw.res}</td><td style="padding:2px 4px;">${rw.status}</td></tr>`).join('')}</tbody>
              </table>`;
            }
          }
          return `
            <div style="margin-bottom:4px;font-weight:bold;">Route: ${r.id}</div>
            ${line('Attempts',attempts)}${attemptsTable}
            ${line('Smart Hit',a['data-cblcars-smart-hit']||'')}
            ${line('Smart Mode',a['data-cblcars-smart-hit-mode']||'')}
            ${line('Smart Skip',a['data-cblcars-smart-skip-reason']||'')}
            ${line('Channel Mode',a['data-cblcars-route-channel-mode']||'')}
            ${line('Channel Pref',a['data-cblcars-route-channels']||'')}
            ${line('Channels Hit',a['data-cblcars-route-channels-hit']||'')}
            ${line('Detour Cost',a['data-cblcars-route-detour-cost']||'')}
            <details style="margin-top:4px;"><summary style="cursor:pointer;">All Attributes</summary>
              <div style="max-height:140px;overflow:auto;margin-top:4px;font-family:monospace;white-space:pre-wrap;">
                ${Object.keys(a).sort().map(k=>`${k}=${a[k]}`).join('\n')}
              </div>
            </details>`;
        }
        function toggleExpand(id,snapshot){
          if(expanded.has(id)) expanded.delete(id); else expanded.add(id);
          const r=(snapshot.routesById||{})[id];
          if(r) ensureExpansion(id,r,snapshot);
        }

        function refreshChannelSelect(snapshot){
          const sel=el.querySelector('select[data-f="channel"]');
          const ch=snapshot.channels||{};
          const existing=new Set();
          for(let i=0;i<sel.options.length;i++){
            if(sel.options[i].value) existing.add(sel.options[i].value);
          }
          Object.keys(ch).forEach(id=>{
            if(!existing.has(id)){
              const o=document.createElement('option');
              o.value=id; o.textContent=id; sel.appendChild(o);
            }
          });
          for(let i=sel.options.length-1;i>=0;i--){
            const o=sel.options[i];
            if(o.value && !ch[o.value]) sel.remove(i);
          }
          sel.value=filters.channel||'';
        }

        function recordWatch(snapshot){
          const list=hudApi.getWatchRoutes();
          list.forEach(id=>{
            const r=snapshot.routesById[id];
            if(!r) return;
            if(!watchHistory[id]) watchHistory[id]=[];
            watchHistory[id].push({
              t:snapshot.timestamp,
              eff:r.eff,grid:r.grid,reason:r.reason,det:r.det,miss:r.miss,total:r.totalCost
            });
            if(watchHistory[id].length>WATCH_DEPTH) watchHistory[id].shift();
          });
        }

        function renderWatch(snapshot){
          recordWatch(snapshot);
          const wrap=el.querySelector('[data-watch]');
          const list=hudApi.getWatchRoutes();
          if(!list.length){wrap.innerHTML='';return;}
          wrap.innerHTML=`<div style="font-weight:bold;margin-bottom:4px;">Watched Routes</div>
            ${list.map(id=>{
              const hist=watchHistory[id]||[];
              if(!hist.length) return `<div style="font-size:10px;">${id}: (no data)</div>`;
              return `<div style="font-size:10px;margin-bottom:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <strong>${id}</strong><button data-unwatch="${id}" style="font-size:10px;">Remove</button>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:9px;">
                  <thead><tr><th>T</th><th>Eff</th><th>Grid</th><th>Reason</th><th>Det</th><th>Miss</th><th>Total</th></tr></thead>
                  <tbody>${hist.map(h=>`<tr>
                    <td>${new Date(h.t).toLocaleTimeString([],{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'})}</td>
                    <td>${h.eff}</td><td>${h.grid}</td><td>${h.reason}</td>
                    <td>${h.det?'Y':''}</td><td>${h.miss?'Y':''}</td><td>${utils.fmtNum(h.total)}</td>
                  </tr>`).join('')}</tbody>
                </table>
              </div>`;
            }).join('')}`;
          wrap.querySelectorAll('button[data-unwatch]').forEach(b=>{
            b.addEventListener('click',()=>{
              hudApi.unwatchRoute(b.getAttribute('data-unwatch'));
              renderWatch(snapshot);
            });
          });
        }

        return {
          rootEl:el,
          refresh(snapshot){
            updateRows(snapshot);
            renderWatch(snapshot);
          }
        };
      }
    });
  }
  if(!hud.registerPanel) (hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();