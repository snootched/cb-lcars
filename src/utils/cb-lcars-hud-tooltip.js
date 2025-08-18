/* LCARS Dev HUD Tooltip Engine (pinless)
 *  - Isolated so future graphical editor (card designer) can reuse as generic hover helper
 */
(function(){
  if(!window.cblcars) window.cblcars={};
  window.cblcars.hud = window.cblcars.hud || {};
  if(window.cblcars.hud.tooltip) return;

  function initTooltip(hostEl, { delay=280, timeout=2500 }={}){
    let tooltipEl = hostEl.querySelector('#cblcars-hud-tooltip');
    if(!tooltipEl){
      tooltipEl=document.createElement('div');
      tooltipEl.id='cblcars-hud-tooltip';
      tooltipEl.style.cssText=`
        position:fixed;left:0;top:0;z-index:999999999;
        background:rgba(60,0,80,0.95);color:#ffe6ff;font:11px/1.35 monospace;
        padding:8px 10px;border:1px solid #ff00ff;border-radius:6px;
        box-shadow:0 2px 10px rgba(0,0,0,.6);display:none;max-width:340px;
        pointer-events:auto;white-space:normal;`;
      hostEl.appendChild(tooltipEl);
    }
    let tooltipTarget=null, tooltipHideTO=null, showTO=null;
    let remaining=timeout, showStart=0, hover=false, panelHover=false;

    function esc(s){return String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));}
    function pos(target){
      const r=target.getBoundingClientRect();
      const tw=tooltipEl.offsetWidth, th=tooltipEl.offsetHeight;
      let x=r.left+(r.width/2)-(tw/2), y=r.top-th-8;
      if(x<6)x=6;
      if(y<6) y=r.bottom+8;
      if(x+tw>window.innerWidth-6) x=window.innerWidth-tw-6;
      tooltipEl.style.left=x+'px';
      tooltipEl.style.top=y+'px';
    }
    function scheduleHide(ms){
      clearTimeout(tooltipHideTO);
      if(ms<=0){ hide(); return; }
      tooltipHideTO=setTimeout(()=>{ if(!hover) hide(); },ms);
    }
    function show(t){
      tooltipTarget=t;
      const short=t.getAttribute('data-tip');
      const detail=t.getAttribute('data-tip-detail');
      if(!short && !detail) return;
      tooltipEl.innerHTML=`<div style="font-weight:bold;margin-bottom:2px;">${esc(short||'Info')}</div>${detail?`<div style="opacity:.85;">${esc(detail)}</div>`:''}`;
      tooltipEl.style.display='block';
      pos(t);
      showStart=performance.now();
      remaining=timeout;
      if(timeout>0) scheduleHide(timeout);
    }
    function hide(){
      clearTimeout(showTO);
      tooltipEl.style.display='none';
      tooltipTarget=null;
    }
    function pointerLeft(){
      if(timeout===0){ hide(); return; }
      scheduleHide(Math.max(120,remaining));
    }

    hostEl.addEventListener('pointerover',e=>{
      const t=e.target.closest('[data-tip]');
      if(!t) return;
      clearTimeout(showTO);
      showTO=setTimeout(()=>show(t), delay);
    });
    hostEl.addEventListener('pointerout',e=>{
      if(e.relatedTarget && tooltipEl.contains(e.relatedTarget)) return;
      clearTimeout(showTO);
      if(!panelHover && !hover) pointerLeft();
    });
    hostEl.addEventListener('pointerenter',e=>{
      if(hostEl.contains(e.target)) panelHover=true;
    });
    hostEl.addEventListener('pointerleave',()=>{
      panelHover=false;
      if(!hover) pointerLeft();
    });
    tooltipEl.addEventListener('pointerenter',()=>{
      hover=true;
      if(timeout>0){
        const elapsed=performance.now()-showStart;
        remaining=Math.max(50,timeout-elapsed);
        clearTimeout(tooltipHideTO);
      }
    });
    tooltipEl.addEventListener('pointerleave',()=>{
      hover=false;
      pointerLeft();
    });
    window.addEventListener('scroll',()=>{
      if(tooltipEl.style.display==='block' && tooltipTarget) pos(tooltipTarget);
    },true);
    return {
      updateConfig({delay:nd,timeout:nt}){
        if(nd!=null) delay=Math.max(0,nd|0);
        if(nt!=null){ timeout=Math.max(0,nt|0); remaining=timeout; }
      },
      hide
    };
  }

  window.cblcars.hud.tooltip={ init:initTooltip };
})();