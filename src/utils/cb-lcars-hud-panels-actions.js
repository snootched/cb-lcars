/* Actions Panel */
(function(){
  const hud=(window.cblcars=window.cblcars||{}, window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'actions',
      title:'Actions',
      order:500,
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            <button data-act="list-cards" style="font-size:10px;">List Cards</button>
            <button data-act="relayout" style="font-size:10px;">Relayout</button>
            <button data-act="reset-perf" style="font-size:10px;">Reset Perf</button>
            <button data-act="toggle-aggressive" style="font-size:10px;">Smart Agg</button>
            <button data-act="toggle-detour" style="font-size:10px;">Detour</button>
            <button data-act="pause" style="font-size:10px;">Pause</button>
            <button data-act="export" style="font-size:10px;">Export Snapshot</button>
          </div>
          <div data-status style="margin-top:6px;font-size:10px;opacity:.7;"></div>`;
        const status=el.querySelector('[data-status]');
        function setStatus(s){status.textContent=s;}
        el.addEventListener('click',e=>{
          const btn=e.target.closest('[data-act]');
          if(!btn) return;
          const act=btn.getAttribute('data-act');
          try{
            switch(act){
              case 'list-cards': window.cblcars.dev.api.cards.list(); setStatus('Listed cards'); break;
              case 'relayout': window.cblcars.dev.relayout('*'); setStatus('Relayout triggered'); break;
              case 'reset-perf': window.cblcars.perf.reset(); setStatus('Perf reset'); break;
              case 'toggle-aggressive':{
                const rt=window.cblcars.dev.getRuntime();
                const cur=!!rt.smart_aggressive;
                window.cblcars.dev.setRuntime({smart_aggressive:!cur});
                setStatus('smart_aggressive='+(!cur));
                break;
              }
              case 'toggle-detour':{
                const rt=window.cblcars.dev.getRuntime();
                const cur=!!(rt.fallback?.enable_two_elbow);
                window.cblcars.dev.setRuntime({fallback:{enable_two_elbow:!cur}});
                setStatus('detour='+(!cur));
                break;
              }
              case 'pause':
                if(hudApi.isPaused()){ hudApi.resume(); btn.textContent='Pause'; setStatus('Resumed'); }
                else { hudApi.pause(); btn.textContent='Resume'; setStatus('Paused'); }
                break;
              case 'export':
                hudApi.exportSnapshot();
                setStatus('Snapshot exported');
                break;
            }
          }catch(err){ setStatus('Error: '+(err?.message||err)); }
        });
        return {rootEl:el,refresh(){}};
      }
    });
  }
  if(!hud.registerPanel) (hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();