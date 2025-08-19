/* Providers Panel (panel only – no provider registration) */
(function(){
  const hud=(window.cblcars=window.cblcars||{}, window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'providers',
      title:'Providers',
      order:165,
      badge:snap=>{
        const list=snap.sections?.health?.providers||[];
        const errs=list.filter(p=>p.error).length;
        return errs? '!': (list.length||'');
      },
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            <button data-refresh style="font-size:10px;">↻</button>
            <label><input name="provSort" type="radio" data-sort="lastMs" checked> last</label>
            <label><input name="provSort" type="radio" data-sort="avgMs"> avg</label>
            <label><input name="provSort" type="radio" data-sort="maxMs"> max</label>
            <label><input name="provSort" type="radio" data-sort="id"> id</label>
          </div>
          <div style="max-height:260px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead><tr><th>ID</th><th>last</th><th>avg</th><th>max</th><th>builds</th><th>chg</th><th>err</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div data-empty style="display:none;opacity:.6;margin-top:4px;">(no data)</div>`;
        const tbody=el.querySelector('tbody');
        let sortField='lastMs';
        el.querySelector('[data-refresh]').addEventListener('click',()=>hudApi.refreshRaw({allowWhilePaused:true}));
        el.querySelectorAll('input[data-sort]').forEach(r=>{
          r.addEventListener('change',()=>{
            if(r.checked){ sortField=r.getAttribute('data-sort'); hudApi.refreshRaw({allowWhilePaused:true}); }
          });
        });
        function fmt(n){
          if(!Number.isFinite(n)) return '';
          if(n>=100) return n.toFixed(0);
          if(n>=10) return n.toFixed(1);
          return n.toFixed(2);
        }
        function refresh(snapshot){
          const list=snapshot.sections?.health?.providers||[];
            if(!list.length){ el.querySelector('[data-empty]').style.display='block'; tbody.innerHTML=''; return; }
          el.querySelector('[data-empty]').style.display='none';
          const rows=list.slice().sort((a,b)=>{
            if(sortField==='id') return a.id.localeCompare(b.id);
            return b[sortField]-a[sortField];
          });
          tbody.innerHTML=rows.map(p=>{
            const errColor=p.error?'#ff6688':(p.lastMs>25?'#ffd85f':'');
            return `<tr>
              <td style="color:${p.error?'#ff4477':'#ffccff'}">${p.id}</td>
              <td style="color:${errColor}">${fmt(p.lastMs)}</td>
              <td>${fmt(p.avgMs)}</td>
              <td>${fmt(p.maxMs)}</td>
              <td>${p.builds}</td>
              <td style="color:${p.changed?'#77ff90':'#777'}">${p.changed?'✓':''}</td>
              <td style="color:${p.error?'#ff6688':'#555'}">${p.error?'!':''}</td>
            </tr>`;
          }).join('');
        }
        return { rootEl:el, refresh };
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();