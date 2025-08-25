/* Scenarios Panel v4 (grouped + run group) */
(function(){
  const hud=(window.cblcars=window.cblcars||{},window.cblcars.hud=window.cblcars.hud||{});
  function groupScenarios(list){
    const map=new Map();
    list.forEach(s=>{
      if(!map.has(s.group)) map.set(s.group,[]);
      map.get(s.group).push(s);
    });
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  }
  function countGroupPass(results,group){
    const subset=results.filter(r=>r.scenario.startsWith(group+'_')||r.scenario.includes(group)); // naive fallback
    if(!subset.length) return '';
    const pass=subset.filter(r=>r.ok).length;
    return `${pass}/${subset.length}`;
  }
  function init(){
    hud.registerPanel({
      id:'scenarios',
      title:'Scenarios',
      order:350,
      badge:snap=>{
        const list=snap.sections.scenarios.results||[];
        if(!list.length) return '';
        const pass=list.filter(r=>r.ok).length;
        return `${pass}/${list.length}`;
      },
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
            <button data-run-all style="font-size:10px;">Run All</button>
            <button data-run-fail style="font-size:10px;">Run Failed</button>
            <button data-refresh style="font-size:10px;">↻</button>
          </div>
          <div data-groups style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow:auto;"></div>
          <div data-empty style="display:none;opacity:.6;margin-top:4px;">(none)</div>`;
        const groupsEl=el.querySelector('[data-groups]');

        el.querySelector('[data-run-all]').addEventListener('click',()=>{
          const names=window.cblcars.dev.api.scenarios.list().map(s=>s.name);
          (async()=>{ for(const n of names) await window.cblcars.dev.api.scenarios.run(n); hudApi.refreshRaw({allowWhilePaused:true}); })();
        });
        el.querySelector('[data-run-fail]').addEventListener('click',()=>{
          const snap=hudApi.currentSnapshot();
          const failed=(snap.sections.scenarios.results||[]).filter(r=>!r.ok).map(r=>r.scenario);
          (async()=>{ for(const n of failed) await window.cblcars.dev.api.scenarios.run(n); hudApi.refreshRaw({allowWhilePaused:true}); })();
        });
        el.querySelector('[data-refresh]').addEventListener('click',()=>hudApi.refreshRaw({allowWhilePaused:true}));

        function build(snapshot){
          const raw=window.cblcars.dev.api.scenarios.list();
          if(!raw.length){
            el.querySelector('[data-empty]').style.display='block';
            groupsEl.innerHTML='';
            return;
          }
          el.querySelector('[data-empty]').style.display='none';
          const resMap={}; (snapshot.sections.scenarios.results||[]).forEach(r=>resMap[r.scenario]=r);
          const grouped=groupScenarios(raw);
          groupsEl.innerHTML=grouped.map(([g,items])=>{
            const passCount=items.filter(s=>resMap[s.name]?.ok).length;
            const badge=`${passCount}/${items.length}`;
            return `<div data-group-wrap="${g}" style="border:1px solid #552266;border-radius:4px;">
              <div data-gh="${g}" style="display:flex;align-items:center;gap:6px;background:linear-gradient(90deg,#4c006e,#2a003c);padding:4px 6px;cursor:pointer;">
                <span data-c="▾"></span>
                <strong style="flex:1;">${g}</strong>
                <span style="font-size:10px;opacity:.8;">${badge}</span>
                <button data-run-group="${g}" style="font-size:9px;">Run Group</button>
              </div>
              <div data-gbody style="padding:4px 6px;">
                <table style="width:100%;border-collapse:collapse;font-size:10px;">
                  <tbody>
                    ${items.map(s=>{
                      const r=resMap[s.name];
                      const status=r?(r.ok?'✓':'✕'):'?';
                      const color=r?(r.ok?'#66ff99':'#ff6688'):'#ccc';
                      const ms=r?r.ms:'';
                      const details=(r?(r.details||r.error||''):'');
                      return `<tr>
                        <td style="padding:2px 4px;">${s.name}</td>
                        <td style="padding:2px 4px;color:${color};font-weight:bold;">${status}</td>
                        <td style="padding:2px 4px;">${ms}</td>
                        <td style="padding:2px 4px;" title="${details.replace(/"/g,'&quot;')}">${details.length>40?details.slice(0,37)+'…':details}</td>
                        <td style="padding:2px 4px;"><button data-one="${s.name}" style="font-size:9px;">▶</button></td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>`;
          }).join('');

          groupsEl.querySelectorAll('[data-gh]').forEach(hdr=>{
            hdr.addEventListener('click',e=>{
              if(e.target.closest('button')) return;
              const wrap=hdr.parentElement;
              const body=wrap.querySelector('[data-gbody]');
              const caret=hdr.querySelector('[data-c]');
              const isOpen=body.style.display!=='none';
              body.style.display=isOpen?'none':'block';
              caret.textContent=isOpen?'▸':'▾';
            });
          });
          groupsEl.querySelectorAll('button[data-run-group]').forEach(btn=>{
            btn.addEventListener('click',e=>{
              e.stopPropagation();
              const g=btn.getAttribute('data-run-group');
              const names=window.cblcars.dev.api.scenarios.list().filter(s=>s.group===g).map(s=>s.name);
              (async()=>{ for(const n of names) await window.cblcars.dev.api.scenarios.run(n); hudApi.refreshRaw({allowWhilePaused:true}); })();
            });
          });
          groupsEl.querySelectorAll('button[data-one]').forEach(btn=>{
            btn.addEventListener('click',()=>{
              const name=btn.getAttribute('data-one');
              (async()=>{ await window.cblcars.dev.api.scenarios.run(name); hudApi.refreshRaw({allowWhilePaused:true}); })();
            });
          });
        }

        function refresh(snapshot){
          build(snapshot);
        }
        return { rootEl:el, refresh };
      }
    });
  }
  if(!hud.registerPanel)(hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();