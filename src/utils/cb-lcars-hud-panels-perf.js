/* Perf Panel (parity)
 * Adds threshold (Th) buttons, pin/unpin, unpin all, reset timers/counters.
 */
(function(){
  const hud=(window.cblcars=window.cblcars||{}, window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'perf',
      title:'Perf & Timers',
      order:300,
      badge:snap=>Object.keys(snap.perfTimers||{}).length||'',
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
            <button data-reset-perf style="font-size:10px;">Reset Counters</button>
            <button data-reset-timers style="font-size:10px;">Reset Timers</button>
            <button data-unpin style="font-size:10px;">Unpin All</button>
            <button data-pin-top style="font-size:10px;">Pin Top3</button>
            <label style="display:flex;align-items:center;gap:2px;">min n<input data-min-count type="number" value="0" style="width:46px;font-size:10px;"></label>
            <label style="display:flex;align-items:center;gap:2px;">min avg<input data-min-avg type="number" value="0" style="width:46px;font-size:10px;"></label>
          </div>
          <details open><summary style="font-weight:bold;cursor:pointer;">Timers</summary><div data-timers></div></details>
          <details open style="margin-top:6px;"><summary style="font-weight:bold;cursor:pointer;">Counters</summary><div data-counters></div></details>`;
        const timersDiv=el.querySelector('[data-timers]');
        const countersDiv=el.querySelector('[data-counters]');
        let lastTimers={}, lastCounters={};

        el.querySelector('[data-reset-perf]').addEventListener('click',()=>{
          try{window.cblcars.perf.reset();}catch{}
          hudApi.refreshRaw({allowWhilePaused:true});
        });
        el.querySelector('[data-reset-timers]').addEventListener('click',()=>{
          try{window.cblcars.debug?.perf?.reset();}catch{}
          hudApi.refreshRaw({allowWhilePaused:true});
        });
        el.querySelector('[data-unpin]').addEventListener('click',()=>{
          hudApi.clearPinnedPerf(); hudApi.refreshRaw({allowWhilePaused:true});
        });
        el.querySelector('[data-pin-top]').addEventListener('click',()=>{
          const snap=hudApi.currentSnapshot()||{};
          const timers=snap.perfTimers||{};
          const top=Object.entries(timers).sort((a,b)=>b[1].lastMs - a[1].lastMs).slice(0,3).map(e=>e[0]);
          top.forEach(id=>hudApi.pinPerf(id));
          hudApi.refreshRaw({allowWhilePaused:true});
        });

        function renderList(kind,container,data,last){
          const minCount=parseInt(el.querySelector('[data-min-count]').value,10)||0;
          const minAvg=parseFloat(el.querySelector('[data-min-avg]').value)||0;
          const keys=Object.keys(data);
          if(!keys.length){container.innerHTML='<div style="opacity:.6;">(none)</div>'; return;}
          const pins=hudApi.status().pinnedPerf;
          const thresholds=hudApi.status().perfThresholds;
          container.innerHTML=keys.sort().map(k=>{
            const d=data[k];
            if(d.count<minCount) return '';
            if(d.avgMs && d.avgMs<minAvg) return '';
            const changed=last[k] && (last[k].lastMs!==d.lastMs || last[k].count!==d.count);
            const pinned=pins.includes(k);
            const th=thresholds[k];
            const viol = th && ((th.avgMs!=null && d.avgMs>th.avgMs) || (th.lastMs!=null && d.lastMs>th.lastMs));
            const label = kind==='timers'
              ? `${k}: last=${d.lastMs.toFixed(2)}ms avg=${d.avgMs.toFixed(2)}ms n=${d.count}`
              : `${k}: c=${d.count}${d.avgMs!=null? ' avg='+d.avgMs.toFixed(1)+'ms':''}`;
            return `<div data-id="${k}" style="display:flex;gap:4px;align-items:center;" class="${changed?'hud-flash':''}">
              <button data-pin style="font-size:9px;padding:0 4px;">${pinned?'★':'☆'}</button>
              <span style="flex:1;" data-tip="${k}" data-tip-detail="${label}">
                ${viol?'<span style="color:#ff004d;">⚠</span> ':''}${label}
              </span>
              <button data-th style="font-size:9px;padding:0 4px;">Th</button>
              <button data-reset-one style="font-size:9px;padding:0 4px;">✕</button>
            </div>`;
          }).join('');
          container.querySelectorAll('[data-id]').forEach(row=>{
            const id=row.getAttribute('data-id');
            row.querySelector('[data-pin]').addEventListener('click',()=>{
              const pins=hudApi.status().pinnedPerf;
              if(pins.includes(id)) hudApi.unpinPerf(id); else hudApi.pinPerf(id);
              hudApi.refreshRaw({allowWhilePaused:true});
            });
            row.querySelector('[data-th]').addEventListener('click',()=>{
              const cur=hudApi.status().perfThresholds[id]||{};
              const avg=prompt(`Set avgMs threshold for ${id} (blank to clear)`,cur.avgMs!=null?cur.avgMs:'');
              if(avg===null) return;
              if(avg.trim()===''){
                hudApi.removePerfThreshold(id);
              } else {
                const num=parseFloat(avg);
                if(Number.isFinite(num)) hudApi.setPerfThreshold(id,{avgMs:num});
              }
              hudApi.refreshRaw({allowWhilePaused:true});
            });
            row.querySelector('[data-reset-one]').addEventListener('click',()=>{
              if(kind==='timers'){ try{window.cblcars.debug?.perf?.reset(id);}catch{} }
              else { try{window.cblcars.perf.reset(id);}catch{} }
              hudApi.refreshRaw({allowWhilePaused:true});
            });
          });
        }

        return {
          rootEl:el,
          refresh(snapshot){
            renderList('timers',timersDiv,snapshot.perfTimers||{},lastTimers);
            renderList('counters',countersDiv,snapshot.perfCounters||{},lastCounters);
            lastTimers=JSON.parse(JSON.stringify(snapshot.perfTimers||{}));
            lastCounters=JSON.parse(JSON.stringify(snapshot.perfCounters||{}));
          }
        };
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();