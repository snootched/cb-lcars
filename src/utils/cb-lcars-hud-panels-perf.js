/* Perf Panel v4 */
(function(){
  const hud=(window.cblcars=window.cblcars||{},window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'perf',
      title:'Performance',
      order:300,
      badge:snap=>Object.keys(snap.sections.perf.timers||{}).length||'',
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
            <button data-reset-timers style="font-size:10px;">Reset Timers</button>
            <button data-reset-counters style="font-size:10px;">Reset Counters</button>
            <button data-unpin style="font-size:10px;">Unpin All</button>
          </div>
          <details open><summary style="font-weight:bold;cursor:pointer;">Timers</summary><div data-timers></div></details>
          <details open style="margin-top:6px;"><summary style="font-weight:bold;cursor:pointer;">Counters</summary><div data-counters></div></details>
          <div style="margin-top:6px;font-size:10px;opacity:.7;" data-viol></div>`;
        const timersDiv=el.querySelector('[data-timers]');
        const countersDiv=el.querySelector('[data-counters]');
        const violDiv=el.querySelector('[data-viol]');

        el.querySelector('[data-reset-timers]').addEventListener('click',()=>{
          try{window.cblcars.debug?.perf?.reset();}catch{}
          hudApi.refreshRaw({allowWhilePaused:true});
        });
        el.querySelector('[data-reset-counters]').addEventListener('click',()=>{
          try{window.cblcars.perf.reset();}catch{}
          hudApi.refreshRaw({allowWhilePaused:true});
        });
        el.querySelector('[data-unpin]').addEventListener('click',()=>{
          hudApi.clearPinnedPerf();
          hudApi.refreshRaw({allowWhilePaused:true});
        });

        function makeRows(kind, data, thresholds){
          const pins=hudApi.status().pinnedPerf;
          const keys=Object.keys(data).sort();
          if(!keys.length) return '<div style="opacity:.6;">(none)</div>';
          return keys.map(k=>{
            const d=data[k];
            const pinned=pins.includes(k);
            const th=thresholds[k];
            let viol=false;
            if(th){
              if(th.avgMs!=null && d.avgMs>th.avgMs) viol=true;
              if(th.lastMs!=null && d.lastMs>th.lastMs) viol=true;
            }
            return `<div data-id="${k}" style="display:flex;align-items:center;gap:4px;">
              <button data-pin="${k}" style="font-size:9px;padding:0 4px;">${pinned?'★':'☆'}</button>
              <span style="flex:1;${viol?'color:#ff6688;':''}">
                ${k}: ${kind==='timers'
                  ? `last=${d.lastMs.toFixed(2)} avg=${d.avgMs.toFixed(2)} n=${d.count}`
                  : `c=${d.count}${d.avgMs!=null? ' avg='+d.avgMs.toFixed(2):''}`}
              </span>
              <button data-th="${k}" style="font-size:9px;padding:0 4px;">Th</button>
              <button data-r="${k}" style="font-size:9px;padding:0 4px;">✕</button>
            </div>`;
          }).join('');
        }

        function refresh(snapshot){
          const perf=snapshot.sections.perf;
          const thresholds=perf.thresholds||{};
          timersDiv.innerHTML=makeRows('timers',perf.timers||{},thresholds);
          countersDiv.innerHTML=makeRows('counters',perf.counters||{},thresholds);
          violDiv.textContent = perf.violations.length
            ? `${perf.violations.length} threshold violation(s)`
            : '';

          el.querySelectorAll('button[data-pin]').forEach(b=>{
            b.addEventListener('click',()=>{
              const id=b.getAttribute('data-pin');
              const pins=hudApi.status().pinnedPerf;
              if(pins.includes(id)) hudApi.unpinPerf(id); else hudApi.pinPerf(id);
              hudApi.refreshRaw({allowWhilePaused:true});
            });
          });
          el.querySelectorAll('button[data-th]').forEach(b=>{
            b.addEventListener('click',()=>{
              const id=b.getAttribute('data-th');
              const current=thresholds[id]||{};
              const val=prompt(`Set avgMs threshold for ${id} (blank to clear)`,current.avgMs!=null?current.avgMs:'');
              if(val===null) return;
              if(val.trim()===''){ hudApi.removePerfThreshold(id); }
              else {
                const num=parseFloat(val);
                if(Number.isFinite(num)) hudApi.setPerfThreshold(id,{avgMs:num});
              }
              hudApi.refreshRaw({allowWhilePaused:true});
            });
          });
          el.querySelectorAll('button[data-r]').forEach(b=>{
            b.addEventListener('click',()=>{
              const id=b.getAttribute('data-r');
              if(perf.timers[id]) try{window.cblcars.debug?.perf?.reset(id);}catch{}
              if(perf.counters[id]) try{window.cblcars.perf.reset(id);}catch{}
              hudApi.refreshRaw({allowWhilePaused:true});
            });
          });
        }
        return { rootEl:el, refresh };
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();