/* Anchors Panel v4 (read-only minimal – CRUD can be re-added later) */
(function(){
  const hud=(window.cblcars=window.cblcars||{},window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'anchors',
      title:'Anchors',
      order:270,
      badge:snap=> (snap.sections.anchors.list||[]).length || '',
      render(){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML='<div style="max-height:240px;overflow:auto;"><table style="width:100%;border-collapse:collapse;font-size:10px;"><thead><tr><th>ID</th><th>X</th><th>Y</th></tr></thead><tbody></tbody></table></div><div data-empty style="display:none;opacity:.6;margin-top:4px;">(none)</div>';
        const tbody=el.querySelector('tbody');
        function refresh(snapshot){
          const list=snapshot.sections.anchors.list||[];
          if(!list.length){
            el.querySelector('[data-empty]').style.display='block';
            tbody.innerHTML='';
            return;
          }
            el.querySelector('[data-empty]').style.display='none';
          tbody.innerHTML=list.map(a=>`<tr><td>${a.id}</td><td>${a.x}</td><td>${a.y}</td></tr>`).join('');
        }
        return { rootEl:el, refresh };
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();