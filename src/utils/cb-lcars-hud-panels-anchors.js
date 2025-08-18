/* Anchors Panel (CRUD + nudge) – hardened for missing active card / config
 * Prevents runtime crashes when HUD loads before any MSD card is active.
 */
(function(){
  const hud=(window.cblcars=window.cblcars||{}, window.cblcars.hud=window.cblcars.hud||{});

  function safeActiveCard(){
    try { return window.cblcars?.dev?._activeCard || null; } catch { return null; }
  }
  function safeMsd(card){
    return card?._config?.variables?.msd || null;
  }
  function getAnchorsMap(card){
    const msd = safeMsd(card);
    if(!msd) return {};
    return msd.anchors || msd._anchors || {};
  }

  function init(){
    hud.registerPanel({
      id:'anchors',
      title:'Anchors',
      order:270,
      badge:snap=>snap.anchorsSummary ? (snap.anchorsSummary.count || '') : '',
      render({hudApi}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
            <input data-id placeholder="id" style="font-size:10px;width:90px;">
            <input data-x placeholder="x" style="font-size:10px;width:70px;">
            <input data-y placeholder="y" style="font-size:10px;width:70px;">
            <button data-set style="font-size:10px;">Add/Set</button>
            <label>Nudge <input data-step type="number" value="4" style="width:50px;font-size:10px;"></label>
          </div>
          <div style="max-height:240px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead><tr><th>ID</th><th>X</th><th>Y</th><th>Use</th><th>Actions</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div data-empty style="display:none;opacity:.6;margin-top:4px;">(no anchors)</div>
          <div data-status style="margin-top:6px;font-size:10px;opacity:.75;"></div>`;
        const tbody=el.querySelector('tbody');
        const status=el.querySelector('[data-status]');

        function writeStatus(msg,opts={}){
          status.textContent=msg||'';
          if(opts.flash){
            status.style.transition='none';
            status.style.background='rgba(255,0,255,0.25)';
            requestAnimationFrame(()=>{requestAnimationFrame(()=>{
              status.style.transition='background .6s ease-out';
              status.style.background='transparent';
            });});
          }
        }

        let step=4;
        el.querySelector('[data-step]').addEventListener('change',e=>{
          const v=parseFloat(e.target.value);
          if(Number.isFinite(v)&&v>0) step=v;
        });

        el.querySelector('[data-set]').addEventListener('click',()=>{
          const id=el.querySelector('[data-id]').value.trim();
            const x=parseFloat(el.querySelector('[data-x]').value);
          const y=parseFloat(el.querySelector('[data-y]').value);
          if(!id || !Number.isFinite(x) || !Number.isFinite(y)){
            writeStatus('Need id,x,y',{flash:true}); return;
          }
          if(!ensureMsdWritable()){ writeStatus('No active card / msd',{flash:true}); return; }
          try{
            setAnchor(id,x,y);
            writeStatus('Set '+id,{flash:true});
            hudApi.refreshRaw({allowWhilePaused:true});
          }catch(e){
            writeStatus('Failed: '+(e.message||e),{flash:true});
          }
        });

        function ensureMsdWritable(){
          const card=safeActiveCard();
          const msd=safeMsd(card);
          if(!card || !msd){
            return false;
          }
          if(!msd.anchors && msd._anchors){
            msd.anchors={...msd._anchors};
          } else if(!msd.anchors){
            msd.anchors={};
          }
          msd._anchors={...msd.anchors};
          return true;
        }

        function commitConfig(){
          const card=safeActiveCard();
          if(!card) return;
          try{
            card.setConfig({...card._config});
            setTimeout(()=>window.cblcars.dev?.relayout('*'),60);
          }catch(e){
            writeStatus('Commit failed: '+(e.message||e));
          }
        }

        function setAnchor(id,x,y){
          const card=safeActiveCard(); const msd=safeMsd(card);
          if(!card||!msd) return;
          msd.anchors=msd.anchors||msd._anchors||{};
          msd.anchors[id]=[x,y];
          msd._anchors={...msd.anchors};
          commitConfig();
        }
        function delAnchor(id){
          const card=safeActiveCard(); const msd=safeMsd(card);
          if(!card||!msd) return;
          msd.anchors=msd.anchors||msd._anchors||{};
          delete msd.anchors[id];
          msd._anchors={...msd.anchors};
          commitConfig();
        }
        function nudge(id,dx,dy){
          const card=safeActiveCard(); const msd=safeMsd(card);
          if(!card||!msd) return;
          msd.anchors=msd.anchors||msd._anchors||{};
          const cur=msd.anchors[id];
          if(!cur) return;
          msd.anchors[id]=[cur[0]+dx,cur[1]+dy];
          msd._anchors={...msd.anchors};
          commitConfig();
        }
        function usage(id){
          try{
            const card=safeActiveCard();
            const list=card?._config?.variables?.msd?.overlays||[];
            return list.filter(o=>o.anchor===id).length;
          }catch{return 0;}
        }

        tbody.addEventListener('click',e=>{
          const btn=e.target.closest('button[data-act]');
          if(!btn) return;
          const id=btn.getAttribute('data-id');
          const act=btn.getAttribute('data-act');
          if(!ensureMsdWritable()){
            writeStatus('No active card / msd',{flash:true});
            return;
          }
          switch(act){
            case 'del':
              if(confirm('Delete '+id+'?')){ delAnchor(id); writeStatus('Deleted '+id,{flash:true}); hudApi.refreshRaw({allowWhilePaused:true}); }
              break;
            case 'hi':
              try{ window.cblcars.msd.highlight(id,{duration:1400,root:safeActiveCard()?.shadowRoot}); }catch{}
              break;
            case 'up': nudge(id,0,-step); hudApi.refreshRaw({allowWhilePaused:true}); break;
            case 'down': nudge(id,0,step); hudApi.refreshRaw({allowWhilePaused:true}); break;
            case 'left': nudge(id,-step,0); hudApi.refreshRaw({allowWhilePaused:true}); break;
            case 'right': nudge(id,step,0); hudApi.refreshRaw({allowWhilePaused:true}); break;
          }
        });

        return {
          rootEl:el,
          refresh(snapshot){
            const card=safeActiveCard();
            const msd=safeMsd(card);

            if(!card){
              el.querySelector('[data-empty]').style.display='block';
              tbody.innerHTML='<tr><td colspan="5" style="opacity:.6;">(no active MSD card yet)</td></tr>';
              writeStatus('Waiting for MSD card…');
              return;
            }
            if(!msd){
              el.querySelector('[data-empty]').style.display='block';
              tbody.innerHTML='<tr><td colspan="5" style="opacity:.6;">(msd config missing)</td></tr>';
              writeStatus('MSD config not found');
              return;
            }

            const map=getAnchorsMap(card);
            const entries=Object.entries(map);
            if(!entries.length){
              el.querySelector('[data-empty]').style.display='block';
              tbody.innerHTML='';
              writeStatus('No anchors defined');
              return;
            }
            el.querySelector('[data-empty]').style.display='none';
            writeStatus('');
            tbody.innerHTML=entries.map(([id,[x,y]])=>`<tr>
              <td>${id}</td>
              <td>${x}</td>
              <td>${y}</td>
              <td style="text-align:center;">${usage(id)}</td>
              <td style="white-space:nowrap;">
                <button data-act="up" data-id="${id}" style="font-size:9px;">↑</button>
                <button data-act="down" data-id="${id}" style="font-size:9px;">↓</button>
                <button data-act="left" data-id="${id}" style="font-size:9px;">←</button>
                <button data-act="right" data-id="${id}" style="font-size:9px;">→</button>
                <button data-act="hi" data-id="${id}" style="font-size:9px;">Hi</button>
                <button data-act="del" data-id="${id}" style="font-size:9px;">✕</button>
              </td>
            </tr>`).join('');
          }
        };
      }
    });
  }
  if(!hud.registerPanel) (hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();