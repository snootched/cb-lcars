/* Overlays Panel v4 (editor-enabled) */
(function(){
  const hud=(window.cblcars=window.cblcars||{},window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'overlays',
      title:'Overlays',
      order:260,
      badge:snap=>snap.sections.overlays.summary.total||'',
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
            <input data-filter placeholder="filter id..." style="font-size:10px;padding:2px 4px;flex:1 1 140px;">
            <select data-type style="font-size:10px;">
              <option value="">(type)</option>
              <option value="line">line</option>
              <option value="ribbon">ribbon</option>
              <option value="sparkline">sparkline</option>
              <option value="text">text</option>
              <option value="free">free</option>
            </select>
            <label><input type="checkbox" data-errors>Errors</label>
            <label><input type="checkbox" data-warn>Warn</label>
            <button data-refresh style="font-size:10px;">↻</button>
          </div>
          <div style="max-height:250px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead><tr><th>ID</th><th>Type</th><th>E</th><th>W</th><th></th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div data-empty style="display:none;opacity:.6;margin-top:4px;">(no overlays)</div>
          <div style="margin-top:6px;font-size:9px;opacity:.55;">Click ID or Edit to open editor</div>`;
        const tbody=el.querySelector('tbody');
        const filt={id:'',type:'',err:false,warn:false};

        function openEditor(id){
          if(!window.cblcars.overlayEditor){
            console.warn('[overlays.panel] overlay editor not loaded');
            return;
          }
            window.cblcars.overlayEditor.open(id);
        }

        el.querySelector('[data-refresh]').addEventListener('click',()=>hudApi.refreshRaw({allowWhilePaused:true}));
        ['filter','type','errors','warn'].forEach(k=>{
          el.querySelector(`[data-${k}]`)?.addEventListener(k==='filter'?'input':'change',()=>{
            if(k==='filter') filt.id=el.querySelector('[data-filter]').value.trim();
            else if(k==='type') filt.type=el.querySelector('[data-type]').value;
            else if(k==='errors') filt.err=el.querySelector('[data-errors]').checked;
            else if(k==='warn') filt.warn=el.querySelector('[data-warn]').checked;
            hudApi.refreshRaw({allowWhilePaused:true});
          });
        });

        function refresh(snapshot){
          const list=snapshot.sections.overlays.list||[];
          const rows=list.filter(o=>{
            if(filt.id && !o.id.includes(filt.id)) return false;
            if(filt.type && o.type!==filt.type) return false;
            if(filt.err && !o.hasErrors) return false;
            if(filt.warn && !o.hasWarnings) return false;
            return true;
          });
          if(!rows.length){
            el.querySelector('[data-empty]').style.display='block';
            tbody.innerHTML='';
            return;
          }
          el.querySelector('[data-empty]').style.display='none';
          tbody.innerHTML=rows.map(o=>`<tr data-id="${o.id}">
            <td class="ov-edit" style="color:#ffccff;cursor:pointer;text-decoration:underline;">${o.id}</td>
            <td>${o.type}</td>
            <td style="text-align:center;">${o.hasErrors?'✔':''}</td>
            <td style="text-align:center;">${o.hasWarnings?'✔':''}</td>
            <td><button data-edit="${o.id}" style="font-size:9px;">Edit</button></td>
          </tr>`).join('');
          tbody.querySelectorAll('td.ov-edit').forEach(td=>{
            td.addEventListener('click',()=>openEditor(td.parentElement.getAttribute('data-id')));
          });
          tbody.querySelectorAll('button[data-edit]').forEach(b=>{
            b.addEventListener('click',()=>openEditor(b.getAttribute('data-edit')));
          });
        }
        return { rootEl:el, refresh };
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();