import { perfTime, perfInc } from '../perf/PerfCounters.js';
import { compileRule, evalCompiled } from './compileConditions.js';
import { deepMerge } from '../util/deepMerge.js';

export class RulesEngine {
  constructor(rules = []) {
    this.rawRules = rules || [];
    this.compiled = [];
    this.depIndex = {
      entities: new Map(), // entityId -> Set(ruleIdx)
      perf: new Map(),
      flags: new Map()
    };
    this.dirty = new Set();
    this._trace = [];
    this.compile();
  }

  compile() {
    this.compiled = [];
    this.depIndex.entities.clear();
    this.depIndex.perf.clear();
    this.depIndex.flags.clear();
    this.rawRules.forEach((r, idx) => {
      const cr = { rule: r, idx, priority: r.priority || 0 };
      cr.when = compileRule(r, null);
      this.compiled.push(cr);
      // deps
      cr.when.deps.entities.forEach(e => addDep(this.depIndex.entities, e, idx));
      cr.when.deps.perf.forEach(k => addDep(this.depIndex.perf, k, idx));
      cr.when.deps.flags.forEach(f => addDep(this.depIndex.flags, f, idx));
    });
    // Sort by priority DESC then original order
    this.compiled.sort((a, b) => b.priority - a.priority || a.idx - b.idx);
    this.markAllDirty();
  }

  markAllDirty() {
    this.compiled.forEach(c => this.dirty.add(c.idx));
  }
  markEntitiesDirty(entityIds) {
    (entityIds || []).forEach(id => {
      const set = this.depIndex.entities.get(id);
      if (set) set.forEach(i => this.dirty.add(i));
    });
  }
  markPerfDirty(keys) {
    (keys || []).forEach(k => {
      const set = this.depIndex.perf.get(k);
      if (set) set.forEach(i => this.dirty.add(i));
    });
  }
  markFlagsDirty(flags) {
    (flags || []).forEach(f => {
      const set = this.depIndex.flags.get(f);
      if (set) set.forEach(i => this.dirty.add(i));
    });
  }

  evaluateDirty(context = {}) {
    return perfTime('rules.eval', () => {
      perfInc('rules.eval.count', 1);
      const overlayPatches = [];
      const profilesAdd = new Set();
      const profilesRemove = new Set();
      const animations = [];
      const stoppedOverlays = new Set();
      const trace = [];
      // Evaluate in sorted order but skip if not dirty
      for (const cr of this.compiled) {
        if (!this.dirty.has(cr.idx)) continue;
        const matched = evalCompiled(cr.when.tree, context);
        trace.push({ id: cr.rule.id, matched, priority: cr.priority });
        if (matched) {
          perfInc('rules.match.count', 1);
          const apply = cr.rule.apply || {};
            // Profiles
          (apply.profiles_add || []).forEach(p => profilesAdd.add(p));
          (apply.profiles_remove || []).forEach(p => profilesRemove.add(p));
          // Overlays patches
          (apply.overlays || []).forEach(o => {
            if (!o.id) return;
            if (stoppedOverlays.has(o.id)) return;
            if (o.style) {
              overlayPatches.push({
                overlayId: o.id,
                style: o.style,
                ruleId: cr.rule.id,
                priority: cr.priority
              });
            }
          });
          // Animations
          (apply.animations || []).forEach(a => {
            if (a?.ref) animations.push({ ref: a.ref, override: a.override || null, ruleId: cr.rule.id, priority: cr.priority });
          });
          if (apply.stop) {
            (apply.overlays || []).forEach(o => { if (o.id) stoppedOverlays.add(o.id); });
          }
        }
      }
      this._trace = trace;
      this.dirty.clear();
      return {
        overlayPatches,
        profilesAdd: Array.from(profilesAdd),
        profilesRemove: Array.from(profilesRemove),
        animations
      };
    });
  }

  getTrace() {
    return this._trace;
  }
}

function addDep(map, key, idx) {
  let set = map.get(key);
  if (!set) map.set(key, set = new Set());
  set.add(idx);
}

// Helper used by pipeline (Phase B integration)
export function applyOverlayPatches(baseOverlays, patches) {
  const byId = new Map();
  baseOverlays.forEach(o => {
    // Preserve existing finalStyle if present (Phase C adjustment)
    const existing = o.finalStyle ? { ...o.finalStyle } : { ...(o.style || {}) };
    byId.set(o.id, { ...o, finalStyle: existing, _patches: [] });
  });
  patches.forEach(p => {
    const target = byId.get(p.overlayId);
    if (!target) return;
    target.finalStyle = deepMerge(target.finalStyle, p.style);
    target._patches.push({ ruleId: p.ruleId, priority: p.priority, style: p.style });
  });
  return Array.from(byId.values());
}
