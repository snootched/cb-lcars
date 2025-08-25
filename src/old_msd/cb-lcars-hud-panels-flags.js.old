/* Flags & Profiles Panel (patched to use dev.api.flags.set directly; removes deprecation warning) */
(function(){
  const hud=(window.cblcars=window.cblcars||{}, window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'flags',
      title:'Flags & Profiles',
      order:400,
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        const PROFILE_MAP={
          Minimal:{overlay:false,connectors:false,perf:false,geometry:false,channels:false},
          Routing:{overlay:true,connectors:true,perf:false,geometry:false,channels:true},
          Perf:{overlay:false,connectors:false,perf:true,geometry:false,channels:false},
          Full:{overlay:true,connectors:true,perf:true,geometry:true,channels:true}
        };
        el.innerHTML=`
          <div data-grid style="display:flex;gap:4px;flex-wrap:wrap;"></div>
          <div style="margin-top:6px;">
            ${Object.keys(PROFILE_MAP).map(p=>`<button data-prof="${p}" style="font-size:10px;">${p}</button>`).join(' ')}
          </div>
          <div style="margin-top:6px;font-size:10px;opacity:.65;">Profiles override current flags.</div>`;
        const grid=el.querySelector('[data-grid]');
        function rebuild(){
          const flags=window.cblcars._debugFlags||{};
          const keys=[...new Set([...Object.keys(flags),
            'overlay','connectors','perf','geometry','channels','validation','smart','counters'])].sort();
          grid.innerHTML=keys.map(k=>{
            const on=!!flags[k];
            return `<button data-flag="${k}" style="font-size:10px;padding:2px 6px;margin:2px;border:1px solid #552266;border-radius:3px;cursor:pointer;
              background:${on?'#ff00ff':'#333'};color:${on?'#120018':'#ffd5ff'};">${k}</button>`;
          }).join('');
          grid.querySelectorAll('[data-flag]').forEach(b=>{
            b.addEventListener('click',()=>{
              const k=b.getAttribute('data-flag');
              const cur=window.cblcars._debugFlags||{};
              window.cblcars.dev.api.flags.set({[k]:!cur[k]});
              rebuild();
              hudApi.emit('flags:changed',window.cblcars._debugFlags);
            });
          });
        }
        el.querySelectorAll('[data-prof]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const name=btn.getAttribute('data-prof');
            const prof=PROFILE_MAP[name];
            window.cblcars.dev.api.flags.set(prof);
            rebuild();
            hudApi.emit('flags:changed',window.cblcars._debugFlags);
          });
        });
        rebuild();
        return {rootEl:el,refresh(){}};
      }
    });
  }
  if(!hud.registerPanel) (hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();