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

// CB-LCARS Button Styles Pack (Phase 2) - Complete button presets for status grids
const CB_LCARS_BUTTONS_PACK = {
  id: 'cb_lcars_buttons',
  version: '1.0.0',
  description: 'CB-LCARS button styles for status grids - recreates custom-button-card appearances',
  animations: [],
  timelines: [],
  rules: [],

  // PROFILES: Provide defaults to the DefaultsManager (fallback values)
  profiles: [
    {
      id: 'cb_button_defaults',
      defaults: {
        status_grid: {
          // Enhanced text positioning that fixes spacing issues
          text_padding: 12, // Increased from 8 to better match CB button cards
          text_margin: 3, // Slightly increased margin between text elements

          // Better font size defaults
          label_font_size: 16, // Reduced from 18 for better cell fitting
          value_font_size: 14, // Reduced from 16 for better proportions

          // Improved cell appearance
          cell_radius: 8, // Increased for more button-like appearance
          cell_gap: 4, // Increased gap for better separation
          normalize_radius: true, // Enable smart radius scaling
          match_ha_radius: false, // Don't constrain to HA card radius

          // Enhanced border
          border_width: 2, // Slightly thicker borders
          cell_opacity: 0.95 // Slight transparency for layered look
        }
      }
    }
  ],

  // OVERLAYS: Complete overlay definitions (not style templates)
  overlays: [],

  // STYLE PRESETS: Named style bundles that can be applied to any overlay type
  style_presets: {
    status_grid: {
      lozenge: {
        text_layout: 'diagonal',
        label_position: 'top-left',
        value_position: 'bottom-right',
        cell_radius: 12,
        text_padding: 10,
        text_margin: 3,
        normalize_radius: true,
        show_labels: true,
        show_values: true,
        lcars_text_preset: 'lozenge'
      },
      bullet: {
        text_layout: 'side-by-side',
        label_position: 'left',
        value_position: 'right',
        cell_radius: 8,
        text_padding: 8,
        normalize_radius: true,
        show_labels: true,
        show_values: true,
        lcars_text_preset: 'bullet'
      },
      'picard-filled': {
        text_layout: 'stacked',
        label_position: 'south-east',
        value_position: 'south-east',
        cell_radius: 0,
        text_padding: 12,
        lcars_corners: true,
        normalize_radius: false,
        show_labels: true,
        show_values: true,
        lcars_text_preset: 'corner'
      },
      badge: {
        text_layout: 'stacked',
        label_position: 'center-top',
        value_position: 'center',
        cell_radius: 16,
        text_padding: 8,
        normalize_radius: true,
        show_labels: true,
        show_values: true,
        lcars_text_preset: 'badge'
      },
      compact: {
        text_layout: 'stacked',
        label_position: 'center-top',
        value_position: 'center-bottom',
        cell_radius: 4,
        text_padding: 6,
        text_margin: 1,
        cell_gap: 1,
        label_font_size: 14,
        value_font_size: 12,
        show_labels: true,
        show_values: true
      }
    }
  },

  // PALETTES: Named color schemes
  palettes: {
    cb_lcars_buttons: {
      // CB-LCARS standard button colors
      primary: 'var(--lcars-blue, #0088ff)',
      secondary: 'var(--lcars-orange, #ff9900)',
      success: 'var(--lcars-green, #00ff00)',
      warning: 'var(--lcars-yellow, #ffcc00)',
      danger: 'var(--lcars-red, #ff0000)',
      info: 'var(--lcars-cyan, #00ffff)',

      // Button state colors
      normal: 'var(--lcars-blue, #0088ff)',
      active: 'var(--lcars-orange, #ff9900)',
      inactive: 'var(--lcars-gray, #666666)',
      disabled: 'var(--lcars-dark-gray, #333333)',

      // Special CB button colors
      'picard-gold': '#d4af37',
      'picard-red': '#cc0000',
      'enterprise-blue': '#0066cc'
    }
  },
  anchors: {},
  routing: {}
};

const BUILTIN_REGISTRY = {
  core: CORE_PACK,
  lcars_fx: LCARS_FX_PACK,
  cb_lcars_buttons: CB_LCARS_BUTTONS_PACK
};

export function loadBuiltinPacks(requested = ['core']) {
  return requested.map(id => BUILTIN_REGISTRY[id]).filter(Boolean);
}

// Make loadBuiltinPacks globally accessible for preset loading
if (typeof window !== 'undefined') {
  window.loadBuiltinPacksModule = { loadBuiltinPacks };
}
