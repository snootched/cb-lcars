/**
 * Channel Trend Provider (Pass 4b)
 * - Skips adding empty samples until data appears
 */
(function(){
  if(!window.cblcars) window.cblcars={};
  const hud=window.cblcars.hud=window.cblcars.hud||{};
  const ROLLING_MAX=40, TOP_N=6;
  const STATE={history:{},order:[]};

  function register(){
    if(!hud.registerSectionProvider){
      (hud._pendingProviders=hud._pendingProviders||[]).push(register);
      return;
    }
    hud.registerSectionProvider('channelTrend', ({fullPrev})=>{
      const cur=fullPrev?.sections?.channels?.current||{};
      const hasData=Object.keys(cur).length>0;
      if(!hasData){
        // Do not append empty placeholders – preserve prior history
        return { history:STATE.history, order:STATE.order, maxLen:ROLLING_MAX };
      }
      const top=Object.entries(cur).sort((a,b)=>b[1]-a[1]).slice(0,TOP_N);
      const topSet=new Set(top.map(([id])=>id));
      topSet.forEach(id=>{
        if(!STATE.history[id]) STATE.history[id]=[];
        STATE.history[id].push(cur[id]);
        if(STATE.history[id].length>ROLLING_MAX) STATE.history[id].shift();
      });
      STATE.order=[...top.map(([id])=>id), ...Object.keys(STATE.history).filter(id=>!topSet.has(id)).sort()];
      return { history:STATE.history, order:STATE.order, maxLen:ROLLING_MAX };
    },155);
  }
  register();
})();