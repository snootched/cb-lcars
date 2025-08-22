// Core builtin pack (minimal). Extend with real defaults in Phase A.
const CORE_PACK = {
  id: 'core',
  version: '1.0.0',
  animations: [],
  timelines: [],
  rules: [],
  profiles: [],
  overlays: [],
  palettes: {},
  anchors: {},
  routing: {}
};

// New sample builtin pack (Phase A) – expand later with real defaults.
const LCARS_FX_PACK = {
  id: 'lcars_fx',
  version: '1.0.0',
  animations: [
    {
      id: 'pulse_soft',
      preset: 'pulse',
      params: { duration: 1800, loop: true, alternate: true, max_scale: 1.07 }
    }
  ],
  timelines: [],
  rules: [],
  profiles: [
    {
      id: 'lcars_line_defaults',
      defaults: {
        line: { corner_style: 'round', corner_radius: 10, width: 2 }
      }
    }
  ],
  overlays: [],
  palettes: {
    default: {
      fx_soft: 'var(--lcars-orange)'
    }
  },
  anchors: {},
  routing: {}
};

const BUILTIN_REGISTRY = {
  core: CORE_PACK,
  lcars_fx: LCARS_FX_PACK
};

export function loadBuiltinPacks(requested = ['core']) {
  return requested.map(id => BUILTIN_REGISTRY[id]).filter(Boolean);
}
