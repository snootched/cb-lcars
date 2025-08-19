/**
 * Routing Decision Log Provider + Panel (Pass 4 patch: focus route filtering via routing:focus event)
 */
(function(){
  if(!window.cblcars) window.cblcars={};
  window.cblcars.routing = window.cblcars.routing || {};
  const store = window.cblcars.routing._decisionLog = window.cblcars.routing._decisionLog || [];

  let focusedRouteId=null;

  function registerProvider(){
    if(!window.cblcars.hud?.registerSectionProvider){
      window.cblcars.hud = window.cblcars.hud || {};
      window.cblcars.hud._pendingProviders = window.cblcars.hud._pendingProviders || [];
      window.cblcars.hud._pendingProviders.push(registerProvider);
      return;
    }
    window.cblcars.hud.registerSectionProvider('routingLog', ()=>{
      const max=300;
      if(store.length>max) store.splice(0,store.length-max);
      return { entries: store.slice(-max), focus:focusedRouteId };
    },{order:500});
  }
  registerProvider();

  function initPanel(){
    const hud=window.cblcars.hud;
    if(!hud.registerPanel){
      (hud._pendingPanels=hud._pendingPanels||[]).push(initPanel);
      return;
    }
    hud.registerPanel({
      id:'routing-log',
      title:'Routing Log',
      order:210,
      badge:snap=>{
        const list=snap.sections?.routingLog?.entries||[];
        return list.length?list.length:'';
      },
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            <button data-refresh style="font-size:10px;">↻</button>
            <select data-filter style="font-size:10px;">
              <option value="">(all)</option>
              <option value="grid">grid</option>
              <option value="smart">smart</option>
              <option value="detour">detour</option>
              <option value="fallback">fallback</option>
              <option value="skipped">skipped</option>
            </select>
            <input data-route placeholder="route id filter" style="font-size:10px;padding:2px 4px;flex:1 1 120px;">
          </div>
          <div style="max-height:260px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead><tr><th>t</th><th>ID</th><th>mode</th><th>status</th><th>reason</th><th>info</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div data-empty style="display:none;opacity:.6;margin-top:4px;">(empty)</div>`;
        const tbody=el.querySelector('tbody');
        const filterSel=el.querySelector('[data-filter]');
        const routeInp=el.querySelector('[data-route]');
        el.querySelector('[data-refresh]').addEventListener('click',()=>hudApi.refreshRaw({allowWhilePaused:true}));
        filterSel.addEventListener('change',()=>hudApi.refreshRaw({allowWhilePaused:true}));
        routeInp.addEventListener('input',()=>hudApi.refreshRaw({allowWhilePaused:true}));

        hudApi.on('routing:focus',ev=>{
          if(ev && ev.id){
            routeInp.value=ev.id;
            hudApi.refreshRaw({allowWhilePaused:true});
          }
        });

        function refresh(snapshot){
          const all=snapshot.sections?.routingLog?.entries||[];
          const f=filterSel.value;
          const routeFilter = routeInp.value.trim();
          let view = f ? all.filter(e=>e.mode===f || e.status===f) : all;
          if(routeFilter) view = view.filter(e=>e.id && e.id.includes(routeFilter));
          if(!view.length){
            el.querySelector('[data-empty]').style.display='block';
            tbody.innerHTML='';
            return;
          }
          el.querySelector('[data-empty]').style.display='none';
          tbody.innerHTML=view.slice(-500).reverse().map(e=>{
            const ts=new Date(e.ts||Date.now()).toLocaleTimeString();
            return `<tr>
              <td>${ts}</td>
              <td>${e.id||''}</td>
              <td>${e.mode||''}</td>
              <td>${e.status||''}</td>
              <td>${e.reason||''}</td>
              <td title="${(e.detail||'').replace(/"/g,'&quot;')}">${(e.detail||'').slice(0,30)}</td>
            </tr>`;
          }).join('');
        }
        return {rootEl:el,refresh};
      }
    });
  }
  initPanel();
})();