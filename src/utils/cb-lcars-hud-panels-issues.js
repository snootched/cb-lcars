/* Issues Panel v4 (hardened editor opener + overlay fallback)
 *  - Click rows -> overlay editor / route focus / scenario run / perf quick action
 *  - Robust lazy loader for overlay editor
 *  - If a row is classified as 'route' but an overlay with same id exists, open the overlay editor
 *    (prioritizes overlay editing even when connector path id == overlay id)
 *  - Stores last snapshot so click handler can re-check overlay existence
 */
(function(){
  const hud = (window.cblcars=window.cblcars||{}, window.cblcars.hud=window.cblcars.hud||{});

  async function ensureOverlayEditor() {
    if (window.cblcars.overlayEditor?.open) return true;
    if (ensureOverlayEditor._loading) {
      await ensureOverlayEditor._loading;
      return !!window.cblcars.overlayEditor?.open;
    }
    ensureOverlayEditor._loading = (async () => {
      // Dynamic import attempt
      try {
        await import(/* webpackIgnore: true */ './cb-lcars-overlay-editor.js');
        if (window.cblcars.overlayEditor?.open) return true;
      } catch (_) {}
      // Fallback script injection (idempotent)
      if (!window.cblcars.overlayEditor?.open && !document.querySelector('script[data-ov-editor-loader="true"]')) {
        await new Promise(res=>{
          const s=document.createElement('script');
          s.type='module';
          s.dataset.ovEditorLoader='true';
          try {
            s.src = new URL('./cb-lcars-overlay-editor.js', (import.meta && import.meta.url) || location.href).href;
          } catch {
            s.src = './cb-lcars-overlay-editor.js';
          }
          s.onload=()=>res();
          s.onerror=()=>res();
          document.head.appendChild(s);
        });
      }
      return !!window.cblcars.overlayEditor?.open;
    })();
    await ensureOverlayEditor._loading;
    return !!window.cblcars.overlayEditor?.open;
  }

  function flashOverlaysPanel(){
    try{
      const panel=document.querySelector('#cblcars-dev-hud-panel [data-panel="overlays"]');
      if(panel){
        panel.classList.add('hud-flash');
        setTimeout(()=>panel.classList.remove('hud-flash'),600);
      }
    }catch{}
  }

  function init(){
    hud.registerPanel({
      id:'issues',
      title:'Issues',
      order:150,
      badge:snap=>{
        const routes=snap.sections.routes?.byId||{};
        const det=Object.values(routes).filter(r=>r.det).length;
        const fb=Object.values(routes).filter(r=>r.grid==='fallback').length;
        const miss=Object.values(routes).filter(r=>r.miss).length;
        const overlayErr=snap.sections.overlays?.summary?.withErrors||0;
        const valErr=snap.sections.overlays?.validation?.errors||0;
        const valWarn=snap.sections.overlays?.validation?.warnings||0;
        const perfViol=(snap.sections.perf?.violations||[]).length;
        const scenFail=(snap.sections.scenarios?.results||[]).filter(r=>!r.ok).length;
        return (det+fb+miss+overlayErr+valErr+valWarn+perfViol+scenFail)||'';
      },
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML='<div data-list style="max-height:220px;overflow:auto;"></div><div style="margin-top:6px;font-size:9px;opacity:.6;">Click: Overlay->Editor | Route->Focus | Scenario->Run | Perf->Threshold</div>';
        const list=el.querySelector('[data-list]');
        let lastSnapshot=null; // retain to disambiguate overlay vs route later

        list.addEventListener('click', async e=>{
          const row=e.target.closest('tr[data-kind]');
          if(!row) return;
          const kind=row.getAttribute('data-kind');
          const id=row.getAttribute('data-id');
          console.debug('[issues.panel] row click', { kind, id });

          // Helper: does overlay with this id exist?
          const overlayExists = !!(lastSnapshot?.sections?.overlays?.list||[]).find(o=>o.id===id);

          // If it is a route row but overlay also exists (id collision), treat as overlay.
          const effectiveKind = (kind==='route' && overlayExists) ? 'overlay' : kind;

          if(effectiveKind==='overlay'){
            if(!id) return;
            if(!(await ensureOverlayEditor())){
              console.warn('[issues.panel] overlay editor not available after load attempt');
              return;
            }
            window.cblcars.overlayEditor.open(id);
            flashOverlaysPanel();
            return;
          }

          if(effectiveKind==='validation'){
            if(id && id!=='counts' && await ensureOverlayEditor()){
              window.cblcars.overlayEditor.open(id);
              flashOverlaysPanel();
            }
            return;
          }

          if(effectiveKind==='route'){
            hudApi.emit('routing:focus',{id});
            return;
          }

          if(effectiveKind==='scenario'){
            window.cblcars.dev?.api?.scenarios?.run(id);
            return;
          }

          if(effectiveKind==='perf'){
            // Example perf quick action
            hudApi.setPerfThreshold(id,{avgMs:0});
            hudApi.refreshRaw({allowWhilePaused:true});
          }
        });

        function refresh(snapshot){
          lastSnapshot=snapshot;
          const items=[];
          const routes=snapshot.sections.routes?.byId||{};
          Object.values(routes).filter(r=>r.det).forEach(r=>items.push({type:'Detour',kind:'route',id:r.id,detail:'detour'}));
          Object.values(routes).filter(r=>r.grid==='fallback').forEach(r=>items.push({type:'Fallback',kind:'route',id:r.id,detail:r.reason||''}));
          Object.values(routes).filter(r=>r.miss).forEach(r=>items.push({type:'ChannelMiss',kind:'route',id:r.id,detail:'pref miss'}));

          (snapshot.sections.overlays?.list||[]).filter(o=>o.hasErrors)
            .forEach(o=>items.push({type:'OverlayErr',kind:'overlay',id:o.id,detail:'validation errors'}));

          const val=snapshot.sections.overlays?.validation;
          if(val?.errors||val?.warnings){
            items.push({type:'Validation',kind:'validation',id:'counts',detail:`E:${val.errors||0} W:${val.warnings||0}`});
          }

          (snapshot.sections.perf?.violations||[])
            .forEach(v=>items.push({
              type:'Perf',kind:'perf',id:v.id,detail:`${v.metric} ${v.value.toFixed ? v.value.toFixed(2):v.value} > ${v.limit}`
            }));

          (snapshot.sections.scenarios?.results||[]).filter(r=>!r.ok)
            .forEach(r=>items.push({type:'Scenario',kind:'scenario',id:r.scenario,detail:r.details||r.error||'fail'}));

          if(!items.length){
            list.innerHTML='<div style="opacity:.6;">(no issues)</div>';
            return;
          }

          list.innerHTML = `<table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="text-align:left;">Type</th>
                <th style="text-align:left;">ID</th>
                <th style="text-align:left;">Detail</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(i=>`
                <tr data-kind="${i.kind}" data-id="${i.id}" style="cursor:pointer;">
                  <td>${i.type}</td>
                  <td>${i.id}</td>
                  <td>${i.detail}</td>
                </tr>`).join('')}
            </tbody>
          </table>`;
        }

        return { rootEl:el, refresh };
      }
    });
  }

  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();