/* Diff Panel v4 – shallow & deep diff toggle */
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
          <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
            <button data-refresh style="font-size:10px;">↻</button>
            <label style="font-size:10px;"><input type="radio" name="diffMode" value="shallow" checked> Shallow</label>
            <label style="font-size:10px;"><input type="radio" name="diffMode" value="deep"> Deep</label>
            <span style="opacity:.7;">Route Cost Changes (shallow)</span>
          </div>
          <div data-shallow style="max-height:160px;overflow:auto;margin-bottom:8px;">
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead><tr><th>ID</th><th>Prev</th><th>Cur</th><th>Δ%</th></tr></thead>
              <tbody></tbody>
            </table>
            <div data-empty style="display:none;opacity:.6;margin-top:4px;">(no deltas)</div>
          </div>
          <div data-deep style="display:none;">
            <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px;">
              <label style="font-size:10px;">Limit <input data-limit type="number" value="200" min="10" max="2000" style="width:70px;font-size:10px;"></label>
              <button data-run-deep style="font-size:10px;">Run Deep Diff</button>
              <span data-info style="font-size:10px;opacity:.65;"></span>
            </div>
            <div data-deep-body style="max-height:200px;overflow:auto;font-size:10px;border:1px solid #552266;padding:4px;border-radius:4px;"></div>
          </div>`;
        const tbody=el.querySelector('tbody');
        const empty=el.querySelector('[data-empty]');
        let mode='shallow';

        el.querySelector('[data-refresh]').addEventListener('click',()=>hudApi.refreshRaw({allowWhilePaused:true}));
        el.querySelectorAll('input[name="diffMode"]').forEach(r=>{
          r.addEventListener('change',()=>{
            if(r.checked){
              mode=r.value;
              el.querySelector('[data-shallow]').style.display=(mode==='shallow')?'block':'none';
              el.querySelector('[data-deep]').style.display=(mode==='deep')?'block':'none';
            }
          });
        });

        el.querySelector('[data-run-deep]').addEventListener('click',()=>{
          runDeep();
        });

        function refreshShallow(snapshot){
          const rows=snapshot.sections?.diff?.routes?.cost||[];
          if(!rows.length){
            empty.style.display='block';
            tbody.innerHTML='';
            return;
          }
          empty.style.display='none';
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

        function runDeep(){
          const limit=parseInt(el.querySelector('[data-limit]').value,10)||200;
          const info=el.querySelector('[data-info]');
          const body=el.querySelector('[data-deep-body]');
          body.innerHTML='<div style="opacity:.6;">Computing…</div>';
          try{
            const res=window.cblcars.dev.api.snapshots.diffDeepLatest({limit});
            if(res.error){ body.innerHTML='<div style="color:#ff6688;">'+res.error+'</div>'; return; }
            const changes=res.changes||[];
            info.textContent=`${changes.length}${res.limitReached?' (limit reached)':''}`;
            if(!changes.length){
              body.innerHTML='<div style="opacity:.6;">(no deep changes)</div>';
              return;
            }
            body.innerHTML=changes.slice(0,limit).map(ch=>{
              let vA=JSON.stringify(ch.valueA);
              let vB=JSON.stringify(ch.valueB);
              if(vA&&vA.length>80) vA=vA.slice(0,77)+'…';
              if(vB&&vB.length>80) vB=vB.slice(0,77)+'…';
              return `<div style="margin-bottom:2px;">
                <span style="color:#ffbfff;">${ch.path}</span>
                <span style="color:#888;"> :: </span>
                <span style="color:#ff6688;">${vA}</span>
                <span style="color:#888;"> -> </span>
                <span style="color:#77ff90;">${vB}</span>
              </div>`;
            }).join('');
          }catch(e){
            body.innerHTML='<div style="color:#ff6688;">Deep diff error: '+(e.message||e)+'</div>';
          }
        }

        function refresh(snapshot){
          if(mode==='shallow') refreshShallow(snapshot);
        }
        return {rootEl:el,refresh};
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();