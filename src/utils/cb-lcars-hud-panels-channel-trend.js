/* Channel Trend Panel (sparkline-esque ascii bars) */
(function(){
  const hud=(window.cblcars=window.cblcars||{},window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'channel-trend',
      title:'Channel Trend',
      order:255, // after channels
      badge:snap=>{
        const hist = snap.sections?.channelTrend?.history||{};
        return Object.keys(hist).length||'';
      },
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;gap:6px;margin-bottom:4px;">
            <button data-refresh style="font-size:10px;">↻</button>
            <span style="opacity:.6;">Last samples</span>
          </div>
          <div data-body style="max-height:260px;overflow:auto;font-family:monospace;"></div>
          <div data-empty style="display:none;opacity:.6;margin-top:4px;">(no data)</div>`;
        const body=el.querySelector('[data-body]');
        el.querySelector('[data-refresh]').addEventListener('click',()=>hudApi.refreshRaw({allowWhilePaused:true}));

        function renderRow(id, series, maxLen){
          if(!series.length) return '';
            const maxVal = Math.max(...series,1);
          const cells = 60;
          const stride = Math.max(1, Math.floor(series.length / cells));
          let out='';
          for(let i=Math.max(0,series.length - stride*cells); i<series.length; i+=stride){
            const v = series[i];
            const ratio = v / maxVal;
            const level = Math.min(7, Math.floor(ratio * 7));
            const glyph = ' ▁▂▃▄▅▆▇█'[level]; // leading space for 0
            out+=glyph;
          }
          return `<div style="display:flex;align-items:center;gap:6px;">
            <span style="width:70px;display:inline-block;">${id}</span>
            <span style="flex:1;font-size:11px;white-space:pre;line-height:1;">${out}</span>
            <span style="width:40px;text-align:right;">${series[series.length-1]}</span>
          </div>`;
        }

        function refresh(snapshot){
          const trend = snapshot.sections?.channelTrend;
          if(!trend || !trend.order.length){
            el.querySelector('[data-empty]').style.display='block';
            body.innerHTML='';
            return;
          }
          el.querySelector('[data-empty]').style.display='none';
          body.innerHTML = trend.order.map(id=>renderRow(id, trend.history[id]||[], trend.maxLen)).join('');
        }
        return { rootEl:el, refresh };
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();