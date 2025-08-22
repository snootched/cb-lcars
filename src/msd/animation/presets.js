import { deepMerge } from '../util/deepMerge.js';

const _presets = new Map();

// Register built-in presets (minimal baseline; can be replaced by legacy richer implementations)
registerAnimationPreset('pulse', (def) => {
  const p = def.params || {};
  const duration = p.duration || 1600;
  return {
    anime: {
      duration,
      loop: p.loop !== false,
      direction: p.alternate ? 'alternate' : 'normal',
      easing: p.easing || 'easeInOutSine',
      scale: [1, p.max_scale || 1.1],
      opacity: p.min_opacity != null ? [{ value: p.min_opacity }, { value: 1 }] : undefined
    }
  };
});

registerAnimationPreset('fade', (def) => {
  const p = def.params || {};
  return {
    anime: {
      duration: p.duration || 600,
      easing: p.easing || 'linear',
      opacity: p.to != null ? p.to : [0, 1],
      loop: p.loop || false
    }
  };
});

registerAnimationPreset('draw', (def) => {
  // Works on SVG path targets. Computes strokeDashoffset if available later (init hook).
  const p = def.params || {};
  return {
    anime: {
      duration: p.duration || 1200,
      easing: p.easing || 'easeInOutSine',
      strokeDashoffset: [anime => anime.setDashoffset, 0],
      loop: p.loop || false,
      direction: p.alternate ? 'alternate' : 'normal'
    }
  };
});

registerAnimationPreset('motionpath', (def) => {
  // Basic placeholder: rely on path_selector param; real path tracing can enhance later.
  const p = def.params || {};
  return {
    anime: {
      duration: p.duration || 4000,
      loop: p.loop !== false,
      easing: p.easing || 'linear',
      update: p.update
    },
    postInit(instance, ctx) {
      // Future: attach tracer element along path if p.tracer defined.
      void instance; void ctx;
    }
  };
});

export function registerAnimationPreset(name, builder) {
  _presets.set(name, builder);
}

export function getAnimationPreset(name) {
  return _presets.get(name);
}

export function listAnimationPresets() {
  return Array.from(_presets.keys());
}

// Merge helper (params layering already done upstream; exposed for external use)
export function mergeAnimationParams(base, override) {
  return deepMerge({ ...(base || {}) }, override || {});
}
