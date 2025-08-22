import { perfInc, perfTime } from '../perf/PerfCounters.js';
import { stableStringify } from '../util/stableStringify.js';
import { getAnimationPreset } from './presets.js';

let _anime = null;
try { _anime = typeof window !== 'undefined' ? (window.anime || (await import('animejs')).default || null) : null; } catch { /* ignore */ }

function hashObj(o) {
  const str = stableStringify(o);
  let h = 0, i = 0;
  while (i < str.length) h = (h * 31 + str.charCodeAt(i++)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

export class AnimationRegistry {
  constructor(starter) {
    this.animations = new Map();   // hash -> instance
    this.timelines = new Map();    // hash -> instance
    this._starter = starter || ((d, ctx) => defaultStarter(d, ctx));
  }

  diffApply(desiredAnimations) {
    return perfTime('animation.diff', () => {
      const desiredMap = new Map();
      const list = [];
      for (const d of desiredAnimations) {
        const keyObj = { preset: d.preset, params: d.params, targets: d.targets, key: d.key };
        d.hash = hashObj(keyObj);
        desiredMap.set(d.hash, d);
        list.push(d);
      }
      let started = 0, reused = 0, stopped = 0;
      // Start / reuse
      for (const d of list) {
        if (this.animations.has(d.hash)) {
          reused++;
          continue;
        }
        started++;
        const inst = this._starter(d, { type: 'animation' });
        this.animations.set(d.hash, inst);
      }
      // Stop orphans
      for (const [hash, inst] of Array.from(this.animations.entries())) {
        if (!desiredMap.has(hash)) {
          stopped++;
          stopInstance(inst);
          this.animations.delete(hash);
        }
      }
      perfInc('animation.instance.new', started);
      perfInc('animation.instance.reuse', reused);
      return { started, reused, stopped, active: list };
    });
  }

  diffApplyTimelines(desiredTimelines) {
    return perfTime('timeline.diff', () => {
      const desiredMap = new Map();
      const list = [];
      for (const d of desiredTimelines) {
        const keyObj = { id: d.id, globals: d.globals, steps: d.steps };
        d.hash = hashObj(keyObj);
        desiredMap.set(d.hash, d);
        list.push(d);
      }
      let started = 0, reused = 0, stopped = 0;
      for (const d of list) {
        if (this.timelines.has(d.hash)) {
          reused++;
          continue;
        }
        started++;
        const inst = this._starter(d, { type: 'timeline' });
        this.timelines.set(d.hash, inst);
      }
      for (const [hash, inst] of Array.from(this.timelines.entries())) {
        if (!desiredMap.has(hash)) {
          stopped++;
          stopInstance(inst);
          this.timelines.delete(hash);
        }
      }
      perfInc('timeline.instance.new', started);
      perfInc('timeline.instance.reuse', reused);
      return { started, reused, stopped, active: list };
    });
  }

  getActive() {
    return {
      animations: Array.from(this.animations.values()).map(minimalInst),
      timelines: Array.from(this.timelines.values()).map(minimalInst)
    };
  }
}

function defaultStarter(def, ctx) {
  // Non-browser / no anime fallback
  if (!_anime || !canAnimate()) {
    return {
      type: ctx.type,
      hash: def.hash,
      key: def.key,
      preset: def.preset,
      params: def.params,
      targets: def.targets,
      stop() {}
    };
  }

  if (ctx.type === 'timeline') {
    const tl = _anime.timeline(def.globals || {});
    (def.steps || []).forEach(step => {
      const presetBuilder = getAnimationPreset(step.preset);
      let animeCfg = step.params || {};
      if (presetBuilder) {
        const built = presetBuilder({ params: step.params || {}, preset: step.preset, targets: step.targets });
        animeCfg = { ...(built.anime || {}), ...(step.params || {}) };
      }
      animeCfg.targets = step.targets;
      if (step.offset != null) tl.add(animeCfg, step.offset);
      else tl.add(animeCfg);
    });
    return {
      type: 'timeline',
      hash: def.hash,
      key: def.id,
      preset: 'timeline',
      targets: [],
      instance: tl,
      stop() { try { tl.pause(); } catch {} }
    };
  }

  // Single animation
  const presetBuilder = getAnimationPreset(def.preset);
  let animeCfg = def.params || {};
  if (presetBuilder) {
    const built = presetBuilder(def);
    animeCfg = { ...(built.anime || {}), ...(def.params || {}) };
  }
  animeCfg.targets = def.targets;
  const instance = _anime(animeCfg);
  // Post init
  try {
    const built = presetBuilder && presetBuilder(def);
    if (built && built.postInit) built.postInit(instance, def);
  } catch {}
  return {
    type: 'animation',
    hash: def.hash,
    key: def.key,
    preset: def.preset,
    targets: def.targets,
    instance,
    stop() { try { instance.pause(); } catch {} }
  };
}

function stopInstance(inst) {
  try { inst.stop && inst.stop(); } catch {}
}

function minimalInst(inst) {
  return { hash: inst.hash, key: inst.key, preset: inst.preset, type: inst.type };
}

function canAnimate() {
  return typeof document !== 'undefined';
}
