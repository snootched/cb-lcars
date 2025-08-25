/**
 * Overlay Editor Modal (no animation integration)
 * - Open via window.cblcars.overlayEditor.open(id)
 * - Reads current overlay config from active card
 * - Simple diff + YAML for single overlay
 * - Snapshot baseline captured once per editing session (revert)
 */
(function(){
  if(!window.cblcars) window.cblcars={};
  const OE = window.cblcars.overlayEditor = window.cblcars.overlayEditor || {};

  const STYLE_ID='cblcars-overlay-editor-style';
  function ensureStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const st=document.createElement('style');
    st.id=STYLE_ID;
    st.textContent=`
      .cblcars-ov-edit-backdrop{position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;
        background:rgba(10,0,25,.72);z-index:2147490000;font-family:monospace;padding:40px 32px;overflow:auto;}
      .cblcars-ov-edit-modal{background:#180024;border:1px solid #ff00ff;border-radius:12px;max-width:1140px;width:100%;
        display:flex;flex-direction:column;color:#ffe6ff;box-shadow:0 0 0 2px rgba(255,0,255,.25),0 14px 42px -8px rgba(0,0,0,.7);}
      .cblcars-ov-edit-header{display:flex;align-items:center;gap:12px;padding:14px 18px;background:linear-gradient(90deg,#320046,#12001f);
        border-bottom:1px solid #ff00ff;font-size:14px;font-weight:600;}
      .cblcars-ov-edit-header button{margin-left:auto;background:#2d003d;color:#ffd5ff;border:1px solid #552266;
        padding:6px 14px;border-radius:8px;font-size:12px;cursor:pointer;}
      .cblcars-ov-edit-header button:hover{background:#ff00ff;color:#120018;}
      .cblcars-ov-edit-body{display:flex;flex-wrap:wrap;gap:20px;padding:16px 20px;}
      .cblcars-ov-edit-col{flex:1 1 360px;display:flex;flex-direction:column;gap:16px;min-width:320px;max-width:520px;}
      .cblcars-ov-edit-section-title{font-weight:600;font-size:12px;letter-spacing:.5px;border-bottom:1px solid #552266;
        padding-bottom:4px;color:#ffbfff;}
      .cblcars-ov-edit-field{display:flex;flex-direction:column;gap:4px;}
      .cblcars-ov-edit-field label{font-size:11px;opacity:.85;display:flex;gap:8px;align-items:center;}
      .cblcars-ov-edit-field input[type=text],
      .cblcars-ov-edit-field input[type=number],
      .cblcars-ov-edit-field textarea,
      .cblcars-ov-edit-field select{
        background:#230035;border:1px solid #552266;color:#ffdfff;padding:5px 7px;font-size:12px;
        border-radius:6px;font-family:monospace;resize:vertical;min-height:34px;
      }
      .cblcars-ov-edit-actions{display:flex;gap:10px;flex-wrap:wrap;}
      .cblcars-ov-edit-actions button{background:#2d003d;color:#ffd5ff;border:1px solid #552266;padding:6px 14px;font-size:12px;
        border-radius:6px;cursor:pointer;}
      .cblcars-ov-edit-actions button:hover{background:#ff00ff;color:#120018;}
      .cblcars-ov-diff-list{background:#15001d;border:1px solid #552266;border-radius:8px;font-size:11px;
        line-height:1.3;padding:8px 10px;max-height:220px;overflow:auto;}
      .cblcars-ov-diff-list .diff-add{color:#6fff9c;}
      .cblcars-ov-diff-list .diff-chg{color:#ffd75a;}
      .cblcars-ov-diff-list .diff-del{color:#ff6688;text-decoration:line-through;}
      .cblcars-ov-yaml{background:#15001d;border:1px solid #552266;border-radius:8px;margin:0;
        font-size:11px;line-height:1.25;padding:10px;max-height:320px;overflow:auto;white-space:pre;}
      .cblcars-ov-edit-footer{display:flex;justify-content:space-between;align-items:center;
        padding:10px 18px;border-top:1px solid #552266;font-size:11px;background:#21002c;color:#ffccff;}
      .cblcars-badge{background:#ff00ff;color:#120018;padding:0 8px;font-size:10px;border-radius:12px;}
    `;
    document.head.appendChild(st);
  }

  function readActiveOverlay(id){
    const dev=window.cblcars.dev;
    if(!dev||!dev.api) return null;
    const {card}=dev.api.internal.resolve();
    if(!card) return null;
    const ovs=card._config?.variables?.msd?.overlays||[];
    return ovs.find(o=>o.id===id)||null;
  }

  function getCardOverlays(){
    const dev=window.cblcars.dev;
    if(!dev||!dev.api) return [];
    const {card}=dev.api.internal.resolve();
    if(!card) return [];
    return card._config?.variables?.msd?.overlays||[];
  }

  function ensureSnapshot(){
    if(!OE.__baselineSnapshot){
      try{
        OE.__baselineSnapshot = window.cblcars.dev.api.overlays.snapshot('overlay_editor_baseline');
      }catch{}
    }
  }

  function buildField(def, ov){
    const val = ov[def.name];
    const name=def.name;
    if(def.type==='boolean'){
      return `<div class="cblcars-ov-edit-field" data-field="${name}">
          <label><input type="checkbox" data-kind="bool" ${val? 'checked':''}> ${name}</label>
        </div>`;
    }
    if(def.type==='enum'){
      return `<div class="cblcars-ov-edit-field" data-field="${name}">
          <label>${name}</label>
          <select data-kind="text">
            ${(def.enumValues||[]).map(v=>`<option value="${v}" ${v===val?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>`;
    }
    if(def.type==='number'){
      return `<div class="cblcars-ov-edit-field" data-field="${name}">
          <label>${name}</label>
          <input type="number" step="any" data-kind="number" value="${val!==undefined?val:''}" placeholder="${def.default!==undefined?def.default:''}">
        </div>`;
    }
    if(def.type==='array' || def.type==='object'){
      const disp = (val!=null)?JSON.stringify(val):'';
      return `<div class="cblcars-ov-edit-field" data-field="${name}">
          <label>${name} <span style="opacity:.55;">(${def.type})</span></label>
          <textarea rows="2" data-kind="json">${disp}</textarea>
        </div>`;
    }
    return `<div class="cblcars-ov-edit-field" data-field="${name}">
        <label>${name}</label>
        <input type="text" data-kind="text" value="${val!=null?String(val).replace(/"/g,'&quot;'):''}">
      </div>`;
  }

  function buildForm(schema, ov){
    return schema.map(def=>buildField(def, ov)).join('');
  }

  function diff(before, after){
    const out=[];
    const keys=new Set([...Object.keys(before||{}),...Object.keys(after||{})]);
    keys.forEach(k=>{
      if(before[k]===undefined && after[k]!==undefined) out.push({key:k,type:'add',value:after[k]});
      else if(before[k]!==undefined && after[k]===undefined) out.push({key:k,type:'del',value:before[k]});
      else if(JSON.stringify(before[k])!==JSON.stringify(after[k])) out.push({key:k,type:'chg',from:before[k],to:after[k]});
    });
    return out;
  }

  function readDraft(modal, schema, base){
    const out={...base};
    schema.forEach(f=>{
      const wrap=modal.querySelector(`[data-field="${f.name}"]`);
      if(!wrap) return;
      const input=wrap.querySelector('[data-kind]');
      if(!input) return;
      let val;
      switch(input.getAttribute('data-kind')){
        case'bool': val = input.checked; break;
        case'number':
          if(input.value.trim()===''){ val=undefined; break; }
          const n=parseFloat(input.value); if(Number.isFinite(n)) val=n;
          break;
        case'json':
          if(input.value.trim()===''){ val=undefined; break; }
          try{ val=JSON.parse(input.value); }catch{ val=undefined; }
          break;
        default:
          val = input.value.trim();
          if(val==='') val=undefined;
      }
      if(val===undefined) delete out[f.name];
      else out[f.name]=val;
    });
    return out;
  }

  function singleOverlayYaml(o){
    const schema = window.cblcars.overlaySchema.getSchema(o.type||'');
    const ordered = [...new Set([...schema.map(s=>s.name), ...Object.keys(o)])];
    const lines=['-'];
    ordered.forEach(k=>{
      if(o[k]===undefined) return;
      const v=o[k];
      let valStr;
      if(typeof v==='object') valStr=JSON.stringify(v);
      else valStr=String(v);
      lines.push(`  ${k}: ${valStr}`);
    });
    return lines.join('\n');
  }

  function applyOverlay(id, newData){
    try{
      if(window.cblcars.dev.api.overlays.mutate){
        window.cblcars.dev.api.overlays.mutate(id, newData);
      } else {
        window.cblcars.dev.api.overlays.add(newData);
      }
      window.cblcars.dev.api.layout.relayout('*');
      window.cblcars.hud?.api?.refreshRaw({allowWhilePaused:true});
    }catch(e){
      console.warn('[overlayEditor] apply failed', e);
    }
  }

  function revertOverlaySnapshot(){
    if(OE.__baselineSnapshot){
      window.cblcars.dev.api.overlays.restore(OE.__baselineSnapshot);
      window.cblcars.dev.api.layout.relayout('*');
      window.cblcars.hud?.api?.refreshRaw({allowWhilePaused:true});
    }
  }

  function open(id){
    ensureStyles();
    const before = readActiveOverlay(id);
    if(!before){ console.warn('[overlayEditor] overlay not found', id); return; }
    ensureSnapshot();
    const schema = window.cblcars.overlaySchema.getSchema(before.type||'');
    const baseline = JSON.parse(JSON.stringify(before));

    const backdrop=document.createElement('div');
    backdrop.className='cblcars-ov-edit-backdrop';
    backdrop.innerHTML=`
      <div class="cblcars-ov-edit-modal">
        <div class="cblcars-ov-edit-header">
          <span>Overlay Editor: <strong>${id}</strong></span>
          <span class="cblcars-badge">${before.type||'?'}</span>
          <button data-close>Close</button>
        </div>
        <div class="cblcars-ov-edit-body">
          <div class="cblcars-ov-edit-col">
            <div class="cblcars-ov-edit-section-title">Fields</div>
            <form data-form>${buildForm(schema, baseline)}</form>
            <div class="cblcars-ov-edit-actions">
              <button type="button" data-apply>Apply</button>
              <button type="button" data-revert>Revert Baseline</button>
              <button type="button" data-refresh>Refresh Diff</button>
            </div>
          </div>
          <div class="cblcars-ov-edit-col">
            <div class="cblcars-ov-edit-section-title">Diff</div>
            <div data-diff class="cblcars-ov-diff-list">(no changes)</div>
            <div class="cblcars-ov-edit-section-title">YAML (Single Overlay)</div>
            <pre data-yaml class="cblcars-ov-yaml"></pre>
          </div>
        </div>
        <div class="cblcars-ov-edit-footer">
          <div>Baseline: ${OE.__baselineSnapshot||'(none)'}</div>
          <div style="opacity:.7;">Foundation editor (no animation)</div>
        </div>
      </div>`;

    document.body.appendChild(backdrop);

    function update(){
      const draft=readDraft(backdrop, schema, baseline);
      const merged={...baseline, ...draft};
      window.cblcars.overlaySchema.applyDefaults(merged);
      const d = diff(baseline, merged);
      const diffEl=backdrop.querySelector('[data-diff]');
      diffEl.innerHTML = d.length
        ? d.map(row=>{
            if(row.type==='add') return `<div class="diff-add">+ ${row.key}: ${JSON.stringify(row.value)}</div>`;
            if(row.type==='del') return `<div class="diff-del">- ${row.key}: ${JSON.stringify(row.value)}</div>`;
            return `<div class="diff-chg">~ ${row.key}: ${JSON.stringify(row.from)} → ${JSON.stringify(row.to)}</div>`;
          }).join('')
        : '(no changes)';
      backdrop.querySelector('[data-yaml]').textContent=singleOverlayYaml(merged);
    }

    update();

    backdrop.addEventListener('click',e=>{
      if(e.target===backdrop) close();
    });
    backdrop.querySelector('[data-close]').addEventListener('click',close);
    backdrop.querySelector('[data-form]').addEventListener('input',()=>update());
    backdrop.querySelector('[data-refresh]').addEventListener('click',()=>update());
    backdrop.querySelector('[data-revert]').addEventListener('click',()=>{
      revertOverlaySnapshot();
      close();
    });
    backdrop.querySelector('[data-apply]').addEventListener('click',()=>{
      const draft=readDraft(backdrop, schema, baseline);
      applyOverlay(id,{...baseline,...draft});
      close();
    });

    function close(){
      backdrop.remove();
    }
  }

  OE.open = open;
})();