/**
 * Routing Decision Log Provider + Panel (Pass 4 close-out: channel deltas summary when focused)
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
    window.cblcars.hud.registerSectionProvider('routingLog', ({fullPrev,prev})=>{
      const max=300;
      if(store.length>max) store.splice(0,store.length-max);
      // compute channel delta
      const channels=fullPrev?.sections?.channels?.current||{};
      const prevCh=fullPrev?.sections?.channels?.previous||{};
      const deltas=[];
      Object.keys(channels).forEach(k=>{
        const d=channels[k]-(prevCh[k]||0);
        if(d!==0) deltas.push({id:k,delta:d});
      });
      deltas.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
      return { entries: store.slice(-max), focus:focusedRouteId, channelDeltas:deltas.slice(0,8) };
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
          <div data-deltas style="font-size:9px;margin-bottom:4px;opacity:.75;"></div>
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
        const deltaBox=el.querySelector('[data-deltas]');
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
          }else{
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
          // Channel deltas summary
          if(routeFilter){
            const deltas=snapshot.sections.routingLog.channelDeltas||[];
            if(!deltas.length){
              deltaBox.innerHTML='';
            }else{
              deltaBox.innerHTML='Channel Δ (curr-prev): ' + deltas.map(d=>
                `<span style="margin-right:6px;color:${d.delta>0?'#77ff90':'#ff6688'};">${d.id}:${d.delta>0?'+':''}${d.delta}</span>`
              ).join('');
            }
          }else{
            deltaBox.innerHTML='';
          }
        }
        return {rootEl:el,refresh};
      }
    });
  }
  initPanel();
})();