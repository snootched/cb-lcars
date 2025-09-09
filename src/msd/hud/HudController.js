const STYLE_ID = 'msd-hud-styles-v1';
const PANELS = ['packs','rules','overlays','issues','export','perf']; // added perf

// LEGACY: This class is now superseded by MsdHudManager
// Keeping for reference during transition

console.warn('[HudController] This class is deprecated - use MsdHudManager instead');

// COMPATIBILITY: Provide basic wrapper if anything still tries to use this
export class HudController {
  constructor(pipeline, mountEl) {
    console.warn('[HudController] Redirecting to MsdHudManager');

    // Try to get the unified manager
    const hudManager = window.__msdDebug?.hud?.manager;
    if (hudManager) {
      this.manager = hudManager;
    } else {
      console.error('[HudController] MsdHudManager not available');
    }
  }

  refresh() {
    if (this.manager) {
      this.manager.refresh();
    }
  }

  // Minimal compatibility methods
  _buildTabs() { /* no-op */ }
  _ensureStyles() { /* no-op */ }
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
  taCollapsed.id = 'msd-export-collapsed';
  taCollapsed.name = 'export-collapsed';
  taCollapsed.style.width = '100%';
  taCollapsed.style.height = '120px';
  taCollapsed.readOnly = true;
  const taFull = document.createElement('textarea');
  taFull.id = 'msd-export-full';
  taFull.name = 'export-full';
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
  selCol.id = 'msd-diff-collection';
  selCol.name = 'diff-collection';
  ['animations','timelines','rules','profiles','overlays'].forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; selCol.appendChild(o);
  });
  const selId = document.createElement('input');
  selId.id = 'msd-diff-item-id';
  selId.name = 'diff-item-id';
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
