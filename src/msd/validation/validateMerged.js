export function validateMerged(merged) {
  const errors = [];
  const warnings = [];

  const coll = (name) => merged[name] || [];

  // NEW: Detect duplicates inside raw user config lists (they get collapsed during merge)
  const raw = merged.__raw_user || {};
  ['overlays','animations','rules','profiles','timelines'].forEach(name => {
    const arr = Array.isArray(raw[name]) ? raw[name] : [];
    const seen = new Set();
    const dups = new Set();
    arr.forEach(it => {
      if (!it || !it.id) return;
      if (seen.has(it.id)) dups.add(it.id);
      else seen.add(it.id);
    });
    dups.forEach(id => {
      errors.push({ type: name.slice(0,-1), id, msg: `duplicate id in user ${name}: '${id}'` });
    });
  });

  // NEW: Detect duplicates that somehow persist across merged collections (cross-layer anomaly)
  function detectMergedDuplicates(name) {
    const arr = coll(name);
    const seen = new Set();
    arr.forEach(it => {
      if (!it || !it.id) return;
      if (seen.has(it.id)) {
        errors.push({ type: name.slice(0,-1), id: it.id, msg: `post-merge duplicate id in ${name}: '${it.id}'` });
      } else {
        seen.add(it.id);
      }
    });
  }
  ['overlays','animations','rules','profiles','timelines'].forEach(detectMergedDuplicates);

  coll('overlays').forEach(o => {
    if (!o.id) errors.push({ type:'overlay', id:o.id, msg:'overlay missing id' });
    if (!o.type) errors.push({ type:'overlay', id:o.id, msg:'overlay missing type' });
    if (o.type === 'line' && !o.anchor) warnings.push({ type:'overlay', id:o.id, msg:'line without anchor (may still work if using position)' });
  });

  coll('animations').forEach(a => {
    if (!a.id) errors.push({ type:'animation', id:a.id, msg:'animation missing id' });
    if (!a.preset) warnings.push({ type:'animation', id:a.id, msg:'animation missing preset' });
  });

  coll('rules').forEach(r => {
    if (!r.id) errors.push({ type:'rule', id:r.id, msg:'rule missing id' });
    if (!r.when) warnings.push({ type:'rule', id:r.id, msg:'rule missing when block' });
  });

  coll('timelines').forEach(t => {
    if (!t.id) errors.push({ type:'timeline', id:t.id, msg:'timeline missing id' });
    (t.steps||[]).forEach((s,i)=>{
      if (!s.targets) warnings.push({ type:'timeline', id:t.id, msg:`step[${i}] missing targets` });
    });
  });

  Object.entries(merged.anchors || {}).forEach(([id,pt])=>{
    if (!Array.isArray(pt) || pt.length!==2 || pt.some(v=>!Number.isFinite(v))) {
      warnings.push({ type:'anchor', id, msg:'anchor not numeric pair (may be unresolved placeholder)' });
    }
  });

  const anchorSet = new Set(Object.keys(merged.anchors || {}));
  coll('overlays').forEach(o=>{
    if (o.anchor && !anchorSet.has(o.anchor)) warnings.push({ type:'overlay', id:o.id, msg:`anchor ref '${o.anchor}' not found` });
    if (o.attach_to && typeof o.attach_to === 'string' && !anchorSet.has(o.attach_to)) {
      const hasOverlay = coll('overlays').some(x=>x.id===o.attach_to);
      if (!hasOverlay) warnings.push({ type:'overlay', id:o.id, msg:`attach_to ref '${o.attach_to}' not found (anchor or overlay)` });
    }
  });

  return { errors, warnings };
}
