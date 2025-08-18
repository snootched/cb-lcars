/* Overlays Panel (light version: list + highlight + YAML export/import hooks)
 * Deep editing logic can be augmented later (future graphical editor).
 */
(function(){
  const hud=(window.cblcars=window.cblcars||{}, window.cblcars.hud=window.cblcars.hud||{});
  function init(){
    hud.registerPanel({
      id:'overlays',
      title:'Overlays',
      order:260,
      badge:snap=>snap.overlaysSummary?snap.overlaysSummary.total||'':'',
      render({hudApi,utils}){
        const el=document.createElement('div');
        el.style.fontSize='10px';
        el.innerHTML=`
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
            <input data-filter placeholder="filter id..." style="font-size:10px;padding:2px 4px;flex:1 1 120px;">
            <select data-type style="font-size:10px;">
              <option value="">(type)</option>
              <option value="line">line</option>
              <option value="ribbon">ribbon</option>
              <option value="sparkline">sparkline</option>
              <option value="text">text</option>
            </select>
            <label><input type="checkbox" data-errors>Errors</label>
            <label><input type="checkbox" data-warnings>Warnings</label>
            <button data-export style="font-size:10px;">Export YAML</button>
            <button data-import style="font-size:10px;">Import</button>
          </div>
          <div style="max-height:240px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead><tr>
                <th>ID</th><th>Type</th><th>Err</th><th>Warn</th><th>Actions</th>
              </tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div data-empty style="display:none;opacity:.6;margin-top:4px;">(no overlays)</div>
          <div data-status style="margin-top:6px;font-size:10px;opacity:.7;"></div>`;
        const tbody=el.querySelector('tbody');
        const status=el.querySelector('[data-status]');
        const filt={text:'',type:'',errors:false,warnings:false};

        function setStatus(m){status.textContent=m||'';}

        el.querySelector('[data-filter]').addEventListener('input',()=>{
          filt.text=el.querySelector('[data-filter]').value.trim();
          hudApi.refreshRaw({allowWhilePaused:true});
        });
        el.querySelector('[data-type]').addEventListener('change',()=>{
          filt.type=el.querySelector('[data-type]').value;
          hudApi.refreshRaw({allowWhilePaused:true});
        });
        el.querySelector('[data-errors]').addEventListener('change',()=>{
          filt.errors=el.querySelector('[data-errors]').checked;
          hudApi.refreshRaw({allowWhilePaused:true});
        });
        el.querySelector('[data-warnings]').addEventListener('change',()=>{
          filt.warnings=el.querySelector('[data-warnings]').checked;
          hudApi.refreshRaw({allowWhilePaused:true});
        });

        el.querySelector('[data-export]').addEventListener('click',()=>exportYaml());
        el.querySelector('[data-import]').addEventListener('click',()=>showImport());

        function applyFilter(list){
          return list.filter(o=>{
            if(filt.text && !o.id.includes(filt.text)) return false;
            if(filt.type && o.type!==filt.type) return false;
            if(filt.errors && !o.hasErrors) return false;
            if(filt.warnings && !o.hasWarnings) return false;
            return true;
          });
        }

        function refresh(snapshot){
          const list=applyFilter(snapshot.overlaysBasic||[]);
          if(!list.length){
            el.querySelector('[data-empty]').style.display='block';
            tbody.innerHTML='';
            return;
          }
          el.querySelector('[data-empty]').style.display='none';
          tbody.innerHTML=list.map(o=>`<tr data-id="${o.id}">
            <td>${o.id}</td>
            <td>${o.type}</td>
            <td style="text-align:center;">${o.hasErrors?'✔':''}</td>
            <td style="text-align:center;">${o.hasWarnings?'✔':''}</td>
            <td>
              <button data-act="hi" data-id="${o.id}" style="font-size:9px;">Hi</button>
              <button data-act="yml" data-id="${o.id}" style="font-size:9px;">Yml</button>
            </td>
          </tr>`).join('');
        }

        tbody.addEventListener('click',e=>{
          const btn=e.target.closest('button[data-act]');
          if(!btn) return;
          const id=btn.getAttribute('data-id');
          if(btn.getAttribute('data-act')==='hi'){
            try{ window.cblcars.msd.highlight(id,{duration:1400,root:window.cblcars.dev._activeCard?.shadowRoot}); }catch{}
          } else if(btn.getAttribute('data-act')==='yml'){
            exportYaml([id]);
          }
        });

        function buildYaml(overlays,anchors){
          const lines=['msd:','  anchors:'];
          const keys=Object.keys(anchors||{}).sort();
          if(!keys.length) lines.push('    {}');
          else keys.forEach(k=>lines.push(`    ${k}: [${anchors[k][0]}, ${anchors[k][1]}]`));
          lines.push('  overlays:');
          if(!overlays.length) lines.push('    []');
          else overlays.forEach(o=>{
            lines.push('    -');
            Object.keys(o).forEach(k=>{
              const v=o[k];
              if(v==null) return;
              if(Array.isArray(v)) lines.push(`      ${k}: [${v.map(x=>JSON.stringify(x)).join(', ')}]`);
              else if(typeof v==='object') lines.push(`      ${k}: ${JSON.stringify(v)}`);
              else if(typeof v==='string' && /[:#\[\]{}]/.test(v)) lines.push(`      ${k}: "${v.replace(/"/g,'\\"')}"`);
              else lines.push(`      ${k}: ${v}`);
            });
          });
          return lines.join('\n');
        }

        function collectFullConfigs(ids){
          const card=window.cblcars.dev._activeCard;
          const ovs=card?._config?.variables?.msd?.overlays||[];
          const sel=ids?ovs.filter(o=>ids.includes(o.id)):ovs.slice();
          return JSON.parse(JSON.stringify(sel));
        }
        function collectAnchors(){
          const card=window.cblcars.dev._activeCard;
          const msd=card?._config?.variables?.msd||{};
          return msd.anchors||msd._anchors||{};
        }

        function download(text,filename){
          const blob=new Blob([text],{type:'text/plain'});
          const url=URL.createObjectURL(blob);
          const a=document.createElement('a');
          a.href=url; a.download=filename;
          document.body.appendChild(a); a.click();
          setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},500);
        }

        function exportYaml(onlyIds){
          try{
            const full=collectFullConfigs(onlyIds);
            const a=collectAnchors();
            const yaml=buildYaml(full,a);
            download(yaml,`overlays-${Date.now()}.yaml`);
            setStatus('Exported '+full.length+' overlays');
          }catch(e){ setStatus('Export failed'); }
        }

        function showImport(){
          const modal=document.createElement('div');
          modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:999999999;display:flex;align-items:center;justify-content:center;';
          modal.innerHTML=`<div style="background:#14001e;padding:14px 16px;border:1px solid #ff00ff;max-width:700px;width:100%;border-radius:8px;font:12px monospace;display:flex;flex-direction:column;gap:8px;">
            <strong>Import Overlays YAML</strong>
            <textarea style="flex:1;min-height:220px;font:11px monospace;background:#1f0030;color:#ffe6ff;border:1px solid #ff00ff;border-radius:4px;padding:6px;" data-y></textarea>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button data-parse style="font-size:11px;">Parse</button>
              <button data-merge disabled style="font-size:11px;">Merge</button>
              <button data-replace disabled style="font-size:11px;">Replace</button>
              <button data-close style="font-size:11px;">Close</button>
            </div>
            <div data-msg style="font-size:10px;opacity:.75;"></div>
          </div>`;
          document.body.appendChild(modal);
          const ta=modal.querySelector('[data-y]');
          const msg=modal.querySelector('[data-msg]');
          let parsed=null;
          function parseYaml(text){
            // very lenient line parser (anchors + overlays id/type)
            const out={anchors:{},overlays:[]};
            let mode='';
            let cur=null;
            text.split(/\r?\n/).forEach(line=>{
              const l=line.replace(/\t/g,'  ').trim();
              if(!l || l.startsWith('#')) return;
              if(l==='msd:' ) return;
              if(/^anchors:|^_anchors:/.test(l)){mode='anchors';return;}
              if(/^overlays:/.test(l)){mode='overlays';return;}
              if(mode==='anchors'){
                const m=l.match(/^([A-Za-z0-9_\-]+):\s*\[(.*?)\]/);
                if(m){
                  const pts=m[2].split(',').map(s=>parseFloat(s.trim())).filter(n=>Number.isFinite(n));
                  if(pts.length>=2) out.anchors[m[1]]=[pts[0],pts[1]];
                }
              } else if(mode==='overlays'){
                if(/^-\s*$/.test(l)){
                  if(cur) out.overlays.push(cur);
                  cur={};
                } else {
                  const kv=l.match(/^([A-Za-z0-9_\-]+):\s*(.*)$/);
                  if(kv){
                    const k=kv[1], v=kv[2];
                    if(v.startsWith('[') && v.endsWith(']')){
                      cur[k]=v.slice(1,-1).split(',').map(s=>s.trim()).filter(Boolean);
                    } else if(/^".*"$/.test(v)||/^'.*'$/.test(v)){
                      cur[k]=v.slice(1,-1);
                    } else if(/^\d+(\.\d+)?$/.test(v)){
                      cur[k]=parseFloat(v);
                    } else if(v==='true'||v==='false'){
                      cur[k]= (v==='true');
                    } else if(v==='[]') cur[k]=[];
                    else if(v==='{}') cur[k]={};
                    else if(v) cur[k]=v;
                  }
                }
              }
            });
            if(cur) out.overlays.push(cur);
            out.overlays=out.overlays.filter(o=>o.id && o.type);
            return out;
          }
          modal.querySelector('[data-parse]').addEventListener('click',()=>{
            try{
              parsed=parseYaml(ta.value);
              msg.textContent=`Parsed ${parsed.overlays.length} overlays, ${Object.keys(parsed.anchors).length} anchors.`;
              modal.querySelector('[data-merge]').disabled=false;
              modal.querySelector('[data-replace]').disabled=false;
            }catch(e){
              msg.textContent='Parse error: '+(e.message||e);
            }
          });
          modal.querySelector('[data-merge]').addEventListener('click',()=>{
            applyImport(false);
          });
          modal.querySelector('[data-replace]').addEventListener('click',()=>{
            applyImport(true);
          });
          modal.querySelector('[data-close]').addEventListener('click',()=>modal.remove());

          function applyImport(replace){
            if(!parsed){msg.textContent='Parse first';return;}
            try{
              const card=window.cblcars.dev._activeCard;
              if(!card) throw new Error('No active card');
              const msd=card._config?.variables?.msd;
              if(!msd) throw new Error('No msd config');
              if(replace){
                msd.overlays=parsed.overlays.slice();
                msd.anchors={...parsed.anchors};
                msd._anchors={...parsed.anchors};
              } else {
                msd.anchors=msd.anchors||msd._anchors||{};
                Object.entries(parsed.anchors).forEach(([k,v])=>msd.anchors[k]=v);
                msd._anchors={...msd.anchors};
                msd.overlays=msd.overlays||[];
                const map=new Map(msd.overlays.map(o=>[o.id,o]));
                parsed.overlays.forEach(o=>{
                  if(map.has(o.id)) Object.assign(map.get(o.id),o);
                  else msd.overlays.push(o);
                });
              }
              card.setConfig({...card._config,variables:{...card._config.variables,msd:{...msd}}});
              setTimeout(()=>window.cblcars.dev.relayout('*'),60);
              msg.textContent='Applied.';
              hudApi.refreshRaw({allowWhilePaused:true});
              setTimeout(()=>modal.remove(),600);
            }catch(e){
              msg.textContent='Apply failed: '+(e.message||e);
            }
          }
        }

        return {rootEl:el,refresh};
      }
    });
  }
  if(!hud.registerPanel) (hud._pendingPanels=hud._pendingPanels||[]).push(init); else init();
})();