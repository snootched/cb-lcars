const STYLE_ID = 'msd-hud-styles-v1';
const PANELS = ['packs','rules','overlays','issues','export','perf']; // added perf

export class HudController {
  constructor(pipeline, mountEl) {
    this.pipeline = pipeline;
    this.mountEl = mountEl;
    this._ensureStyles();
    this.root = document.createElement('div');
    this.root.className = 'msd-hud';
    this.tabBar = document.createElement('div');
    this.tabBar.className = 'msd-hud-tabs';
    this.panelContainer = document.createElement('div');
    this.panelContainer.className = 'msd-hud-panels';
    this.root.appendChild(this.tabBar);
    this.root.appendChild(this.panelContainer);
    mountEl.appendChild(this.root);
    this.activePanel = 'packs';
    this._buildTabs();
  }

  _ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .msd-hud { font: 12px/1.4 system-ui, sans-serif; background:#0e0f17ee; color:#eee; padding:6px; border:1px solid #444; border-radius:4px; max-width:900px; }
      .msd-hud-tabs { display:flex; gap:4px; margin-bottom:6px; flex-wrap:wrap; }
      .msd-hud-tabs button { background:#222; color:#ccc; border:1px solid #444; padding:4px 8px; cursor:pointer; border-radius:3px; font-size:11px; }
      .msd-hud-tabs button.active { background:#555; color:#fff; }
      .msd-hud-panels { max-height:320px; overflow:auto; }
      .msd-hud table { border-collapse:collapse; width:100%; font-size:11px; }
      .msd-hud th, .msd-hud td { border:1px solid #333; padding:2px 4px; vertical-align:top; }
      .msd-hud th { background:#1c1f28; position:sticky; top:0; }
      .msd-badge { display:inline-block; padding:0 4px; margin-right:4px; border-radius:2px; font-size:10px; background:#333; color:#ddd; }
      .b-core { background:#555; }
      .b-builtin { background:#663399; }
      .b-user { background:#996515; }
      .b-overridden { background:#8a6d00; }
      .b-removed { background:#702020; }
      .b-match { background:#2d5a2d; }
      .b-nomatch { background:#5a2d2d; }
      .msd-issues-err { color:#ff6464; }
      .msd-issues-warn { color:#e3b341; }
      .mono { font-family: ui-monospace, monospace; }
      .nowrap { white-space:nowrap; }
    `;
    document.head.appendChild(style);
  }

  _buildTabs() {
    this.tabBar.innerHTML = '';
    PANELS.forEach(p => {
      const btn = document.createElement('button');
      btn.textContent = p;
      if (p === this.activePanel) btn.classList.add('active');
      btn.onclick = () => { this.activePanel = p; this._buildTabs(); this.refresh(); };
      this.tabBar.appendChild(btn);
    });
  }

  refresh() {
    const { merged, cardModel } = this.pipeline;
    const resolved = this.pipeline.getResolvedModel();
    this.panelContainer.innerHTML = '';
    let panel;
    switch (this.activePanel) {
      case 'packs':
        panel = buildPacksPanel(merged);
        break;
      case 'rules':
        panel = buildRulesPanel(this.pipeline.rulesEngine);
        break;
      case 'overlays':
        panel = buildOverlaysPanel(resolved);
        break;
      case 'issues':
        panel = buildIssuesPanel(merged.__issues, cardModel.__issues);
        break;
      case 'export':
        panel = buildExportPanel(this.pipeline);
        break;
      case 'perf':
        panel = buildPerfPanel(this.pipeline);
        break;
      default:
        panel = document.createElement('div');
        panel.textContent = 'Unknown panel';
    }
    this.panelContainer.appendChild(panel);
  }
}

/* ---------- Packs Panel ---------- */
function buildPacksPanel(merged) {
  const wrap = div();
  const collections = ['animations','timelines','rules','profiles','overlays'];
  wrap.appendChild(h3('Collections'));
  const tbl = table(['Collection','Count','Items (id badges)']);
  collections.forEach(col => {
    const items = merged[col] || [];
    const cell = document.createElement('td');
    items.slice(0,60).forEach(it => {
      cell.appendChild(badge(originBadgeClass(it.__meta), it.id));
      if (it.__meta?.overridden) cell.appendChild(badge('b-overridden','mod'));
    });
    tbl.tbody.appendChild(tr([
      td(col),
      td(String(items.length)),
      cell
    ]));
  });
  wrap.appendChild(tbl);

  // Provenance example for first few of each
  wrap.appendChild(h3('Provenance Samples'));
  const provTbl = table(['ID','Collection','Chain (layer→checksum)']);
  collections.forEach(col => {
    const prov = merged.__provenance?.[col];
    if (!prov) return;
    let count = 0;
    for (const [id, chain] of Object.entries(prov)) {
      if (count++ > 4) break;
      const chainStr = chain.map(c => `${c.layer_id}${c.overridden?'*':''}:${c.checksum.slice(0,6)}`).join(' → ');
      provTbl.tbody.appendChild(tr([
        td(id),
        td(col),
        td(chainStr, 'mono')
      ]));
    }
  });
  wrap.appendChild(provTbl);
  return wrap;
}

function originBadgeClass(meta) {
  if (!meta) return 'b-user';
  if (meta.origin_pack === 'builtin:core') return 'b-core';
  if (meta.origin_pack?.startsWith('builtin:')) return 'b-builtin';
  if (meta.origin_pack?.startsWith('external:')) return 'b-external';
  return 'b-user';
}

/* ---------- Rules Panel ---------- */
function buildRulesPanel(rulesEngine) {
  const wrap = div();
  wrap.appendChild(h3('Rules Evaluation Trace'));
  const trace = rulesEngine.getTrace() || [];
  const tbl = table(['Rule','Priority','Matched','Notes']);
  trace.forEach(t => {
    tbl.tbody.appendChild(tr([
      td(t.id),
      td(String(t.priority)),
      td(badge(t.matched ? 'b-match':'b-nomatch', t.matched ? 'match':'no')),
      td('')
    ]));
  });
  wrap.appendChild(tbl);
  return wrap;
}

/* ---------- Overlays Panel ---------- */
function buildOverlaysPanel(resolved) {
  const wrap = div();
  wrap.appendChild(h3('Resolved Overlays'));
  const tbl = table(['ID','Type','Profiles/RPatches','Final Style']);
  (resolved.overlays || []).forEach(o => {
    const src = [];
    (o._styleSources || []).forEach(s => src.push(`${s.kind}:${s.id}`));
    (o._patches || []).forEach(p => src.push(`rule:${p.ruleId}`));
    const styleStr = shortJson(o.finalStyle);
    tbl.tbody.appendChild(tr([
      td(o.id),
      td(o.type || ''),
      td(src.join(', ')),
      td(styleStr, 'mono')
    ]));
  });
  wrap.appendChild(tbl);
  return wrap;
}

/* ---------- Issues Panel ---------- */
function buildIssuesPanel(mergeIssues, modelIssues) {
  const wrap = div();
  const allErrors = [...(mergeIssues?.errors||[]), ...(modelIssues?.errors||[])];
  const allWarns = [...(mergeIssues?.warnings||[]), ...(modelIssues?.warnings||[])];
  wrap.appendChild(h3('Errors ('+allErrors.length+')'));
  wrap.appendChild(issueList(allErrors, 'msd-issues-err'));
  wrap.appendChild(h3('Warnings ('+allWarns.length+')'));
  wrap.appendChild(issueList(allWarns, 'msd-issues-warn'));
  return wrap;
}

function issueList(list, cls) {
  const ul = document.createElement('ul');
  ul.style.margin = '4px 0 10px';
  ul.style.paddingLeft = '18px';
  list.forEach(i => {
    const li = document.createElement('li');
    li.className = cls;
    li.textContent = `[${i.code}] ${i.message || ''}`;
    ul.appendChild(li);
  });
  if (!list.length) {
    const li = document.createElement('li');
    li.textContent = 'None';
    ul.appendChild(li);
  }
  return ul;
}

/* ---------- Export Panel ---------- */
function buildExportPanel(pipeline) {
  const wrap = div();
  wrap.appendChild(h3('Export & Diff'));
  const btnRow = div();
  btnRow.style.display = 'flex';
  btnRow.style.gap = '6px';
  const taCollapsed = document.createElement('textarea');
  taCollapsed.style.width = '100%';
  taCollapsed.style.height = '120px';
  taCollapsed.readOnly = true;
  const taFull = document.createElement('textarea');
  taFull.style.width = '100%';
  taFull.style.height = '160px';
  taFull.readOnly = true;

  const btnCollapsed = document.createElement('button');
  btnCollapsed.textContent = 'Generate Collapsed JSON';
  btnCollapsed.onclick = () => {
    taCollapsed.value = pipeline.exportCollapsedJson(true);
  };
  const btnFull = document.createElement('button');
  btnFull.textContent = 'Full Snapshot (no meta)';
  btnFull.onclick = () => {
    taFull.value = pipeline.exportFullSnapshotJson({}, true);
  };
  const btnFullMeta = document.createElement('button');
  btnFullMeta.textContent = 'Full Snapshot (+meta)';
  btnFullMeta.onclick = () => {
    taFull.value = pipeline.exportFullSnapshotJson({ include_meta: true }, true);
  };
  btnRow.appendChild(btnCollapsed);
  btnRow.appendChild(btnFull);
  btnRow.appendChild(btnFullMeta);
  wrap.appendChild(btnRow);
  wrap.appendChild(taCollapsed);
  wrap.appendChild(taFull);

  wrap.appendChild(h3('Item Diff'));
  const diffControls = div();
  diffControls.style.display = 'flex';
  diffControls.style.gap = '4px';
  const selCol = document.createElement('select');
  ['animations','timelines','rules','profiles','overlays'].forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; selCol.appendChild(o);
  });
  const selId = document.createElement('input');
  selId.placeholder = 'item id';
  selId.style.flex = '1';
  const btnDiff = document.createElement('button');
  btnDiff.textContent = 'Diff';
  const preDiff = document.createElement('pre');
  preDiff.style.maxHeight = '180px';
  preDiff.style.overflow = 'auto';
  preDiff.style.fontSize = '11px';
  btnDiff.onclick = () => {
    const result = pipeline.diffItem(selCol.value, selId.value.trim());
    preDiff.textContent = JSON.stringify(result, null, 2);
  };
  diffControls.appendChild(selCol);
  diffControls.appendChild(selId);
  diffControls.appendChild(btnDiff);
  wrap.appendChild(diffControls);
  wrap.appendChild(preDiff);
  return wrap;
}

/* ---------- Perf Panel ---------- */
function buildPerfPanel(pipeline) {
  const wrap = div();
  wrap.appendChild(h3('Performance Counters'));
  const counters = pipeline.getPerf();
  const rows = Object.keys(counters).sort();
  const tbl = table(['Key','Value','Avg (ms)']);
  rows.forEach(k => {
    const v = counters[k];
    let avg = '';
    if (k.endsWith('.totalMs')) {
      const base = k.slice(0, -8); // remove '.totalMs'
      const samples = counters[base + '.samples'];
      if (samples) avg = (v / samples).toFixed(2);
    }
    tbl.tbody.appendChild(tr([
      td(k, 'mono'),
      td(String(v)),
      td(avg)
    ]));
  });
  wrap.appendChild(tbl.table);
  return wrap;
}

/* ---------- Utilities ---------- */
function div() { return document.createElement('div'); }
function h3(t) { const e = document.createElement('h3'); e.textContent = t; e.style.margin='6px 0 4px'; e.style.fontSize='12px'; return e; }
function table(headers) {
  const tbl = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; trh.appendChild(th); });
  thead.appendChild(trh);
  const tbody = document.createElement('tbody');
  tbl.appendChild(thead); tbl.appendChild(tbody);
  return { table: tbl, thead, tbody };
}
function tr(cells) {
  const tr = document.createElement('tr');
  cells.forEach(c => {
    if (c instanceof HTMLElement) tr.appendChild(c);
    else {
      const tdEl = document.createElement('td');
      tdEl.textContent = c;
      tr.appendChild(tdEl);
    }
  });
  return tr;
}
function td(txt, cls) {
  const tdEl = document.createElement('td');
  if (cls) tdEl.className = cls;
  tdEl.textContent = txt;
  return tdEl;
}
function badge(cls, text) {
  const span = document.createElement('span');
  span.className = 'msd-badge ' + (cls||'');
  span.textContent = text;
  return span;
}
function shortJson(obj) {
  try {
    const str = JSON.stringify(obj);
    return str.length > 120 ? str.slice(0,117)+'...' : str;
  } catch { return ''; }
}
