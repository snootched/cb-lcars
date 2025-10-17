import { lcarsClassicTokens } from '../themes/tokens/lcarsClassicTokens.js';
import { lcarsDs9Tokens } from '../themes/tokens/lcarsDs9Tokens.js';
import { lcarsVoyagerTokens } from '../themes/tokens/lcarsVoyagerTokens.js';
import { lcarsHighContrastTokens } from '../themes/tokens/lcarsHighContrastTokens.js';

// Core builtin pack - Contains all system defaults
const CORE_PACK = {
  id: 'core',
  version: '1.0.0',
  animations: [],
  timelines: [],
  rules: [],
  profiles: [
    {
      id: 'core_defaults',
      description: 'Standard system defaults for all MSD components',
      defaults: {
        // Text defaults - using simple values for better compatibility
        text: {
          font_size: 14, // Simple numeric value, no auto-scaling
          font_family: 'var(--lcars-font-family, Antonio)',
          line_height: 1.2,
          color: 'var(--lcars-white, #ffffff)',
          fallback_font_size: 16, // Fallback when font size cannot be determined

          // Text decoration defaults
          status_indicator: {
            size_ratio: 0.3, // Ratio of font size for status indicator
            padding: 8, // Pixels between text edge and indicator edge
            color: 'var(--lcars-green, #00ff00)' // Default status indicator color
          },

          highlight: {
            padding: 2, // Pixels of padding around text for highlight
            opacity: 0.3 // Default highlight opacity
          },

          // Text bracket defaults
          bracket: {
            width: 2, // Default bracket stroke width
            gap: 4, // Default gap between text and bracket
            extension: 8, // Default bracket extension beyond text
            opacity: 1, // Default bracket opacity
            physical_width: 8, // Default physical bracket width
            height: '70%', // Default bracket height as percentage
            radius: 4, // Default bracket corner radius
            border_radius: 8, // Default border radius for containers
            inner_factor: 2 // Default inner factor for hybrid mode
          },

          // Text effect defaults
          effects: {
            glow: {
              blur: 3, // Default glow blur radius
              intensity: 1 // Default glow intensity
            },
            shadow: {
              offset_x: 2, // Default shadow X offset
              offset_y: 2, // Default shadow Y offset
              blur: 2, // Default shadow blur
              color: 'rgba(0,0,0,0.5)' // Default shadow color
            }
          },

          // Text pattern defaults
          pattern: {
            dots: { size: 8 }, // Default dots pattern size
            lines: { size: 4 }, // Default lines pattern size
            default: {
              width: 10, // Default pattern width
              height: 10 // Default pattern height
            }
          },

          // Attachment point calculation defaults
          attachment: {
            status_size_ratio: 0.3 // Status indicator size ratio for attachment calculations
          }
        },

        // Overlay defaults - keep scalable objects for padding that needs viewBox scaling
        overlay: {
          padding: {
            value: 8,
            scale: 'viewbox',
            unit: 'px'
          }
        },

        // Sparkline defaults
        sparkline: {
          stroke_width: {
            value: 2,
            scale: 'viewbox',
            unit: 'px'
          },
          color: 'var(--lcars-yellow, #ffcc00)',
          size: {
            width: 200, // Default sparkline width
            height: 60 // Default sparkline height
          },
          opacity: 1, // Default sparkline opacity
          line_cap: 'round', // Default line cap style
          line_join: 'round', // Default line join style
          miter_limit: 4, // Default miter limit
          path_precision: 2, // Default path precision for coordinates
          fill_opacity: 0.2, // Default area fill opacity
          point_size: 3, // Default data point marker size
          decimation_threshold: 1000, // Default max points before decimation

          // Grid defaults for sparklines
          grid: {
            color: 'var(--lcars-gray, #666666)',
            opacity: 0.4,
            stroke_width: 1,
            horizontal_count: 3,
            vertical_count: 5
          },

          // Threshold line defaults
          threshold: {
            color: 'var(--lcars-orange, #ff9900)',
            width: 1,
            opacity: 0.7
          },

          // Zero line defaults
          zero_line: {
            color: 'var(--lcars-gray, #666666)',
            width: 1,
            opacity: 0.5
          },

          // Bracket defaults for sparklines
          bracket: {
            width: 2,
            gap: 6,
            extension: 8,
            opacity: 1,
            physical_width: 8,
            radius: 4,
            border_radius: 8,
            inner_factor: 2
          },

          // Status indicator defaults
          status_indicator: {
            size: 4,
            offset: 4,
            color: 'var(--lcars-green, #00ff00)'
          },

          // Animation defaults
          scan_line: {
            duration: 3, // Scan line animation duration in seconds
            width: 1,
            opacity: 0.8
          },

          // Chaikin smoothing defaults
          smoothing: {
            chaikin_iterations: 2,
            bezier_control_factor: 0.5,
            constrained_control_factor: 0.25,
            spline_segments: 10 // Segments between spline points
          },

          // Value label defaults
          value_label: {
            offset_x: 4,
            font_size_ratio: 0.1, // Ratio of width for font size
            max_font_size: 12,
            font_family: 'var(--lcars-font-family, Antonio)'
          },

          // Enhanced status colors for different states
          status: {
            no_source: { color: 'var(--lcars-red, #ff0000)' },
            loading: { color: 'var(--lcars-blue, #0088ff)' },
            not_found: { color: 'var(--lcars-orange, #ff9900)' },
            error: { color: 'var(--lcars-red, #ff0000)' },
            font_size_ratio: 0.125, // Font size ratio for status text
            min_width_for_source: 120, // Minimum width to show source name
            stroke_width: 2,
            opacity: 0.6
          }
        },

        // Status Grid defaults
        status_grid: {
          // Core Grid Properties
          rows: 3, // Number of rows
          columns: 4, // Number of columns
          cell_gap: 2, // Gap between cells
          cell_color: 'var(--lcars-blue, #0088ff)', // Default cell color
          cell_opacity: 1.0, // Cell opacity
          cell_radius: 2, // Corner radius

          // Border & Layout
          border_color: 'var(--lcars-gray, #666666)', // Border color
          border_width: 1, // Border width
          unknown_color: 'var(--lcars-gray, #666666)', // Color for unknown states

          // Text Styling (Supports Scaling)
          font_size: 12, // Base font size
          label_font_size: {
            value: 18,
            scale: 'none', // Default to no scaling unless explicitly set
            unit: 'px'
          }, // Label font size - supports scaling
          value_font_size: {
            value: 16,
            scale: 'none', // Default to no scaling unless explicitly set
            unit: 'px'
          }, // Value font size - supports scaling
          font_family: 'var(--lcars-font-family, Antonio)', // Font family
          font_weight: 'normal', // Font weight
          label_color: 'var(--lcars-white, #ffffff)', // Label text color
          value_color: 'var(--lcars-white, #ffffff)', // Value text color

          // Text Layout & Positioning
          text_layout: 'stacked', // Layout mode
          text_alignment: 'center', // Vertical alignment
          text_justify: 'center', // Horizontal justification
          label_position: 'center-top', // Label position
          value_position: 'center-bottom', // Value position
          text_padding: {
            value: 8,
            scale: 'none', // Default to no scaling unless explicitly set
            unit: 'px'
          }, // Padding from cell edges - supports scaling
          text_margin: 2, // Margin between text elements
          max_text_width: '90%', // Maximum text width
          text_overflow: 'ellipsis', // Overflow handling

          // Status Detection
          status_mode: 'auto', // Status detection mode

          // Grid Features
          grid_line_color: 'var(--lcars-gray, #666666)', // Grid line color
          grid_line_opacity: 0.3, // Grid line opacity
          grid_line_width: 1, // Grid line width

          // LCARS Features
          bracket_color: null, // Bracket color (null = use primary color)
          bracket_width: 2, // Bracket stroke width
          bracket_gap: 4, // Distance from grid
          bracket_extension: 8, // Bracket arm length
          bracket_opacity: 1, // Bracket opacity
          bracket_corners: 'both', // Which corners
          bracket_sides: 'both', // Which sides
          bracket_physical_width: 8, // Physical bracket width
          bracket_height: '100%', // Bracket height
          bracket_radius: 4, // Bracket corner radius
          border_radius: 8, // Container border radius
          inner_factor: 2, // Inner spacing factor

          // Interaction
          hover_color: 'var(--lcars-yellow, #ffcc00)', // Hover color
          hover_scale: 1.05, // Hover scale factor

          // Animation
          cascade_speed: 0, // Cascade animation speed
          cascade_direction: 'row', // Cascade direction
          reveal_animation: false, // Initial reveal animation
          pulse_on_change: false, // Pulse on data change

          // Performance
          update_throttle: 100 // Update throttling in ms
        }
      }
    },
    {
      id: 'minimal',
      description: 'Minimal defaults for lightweight configurations',
      defaults: {
        text: {
          font_size: 12,
          font_family: 'var(--lcars-font-family, Antonio)',
          line_height: 1.1,
          color: 'var(--lcars-white, #ffffff)'
        },
        status_grid: {
          rows: 2,
          columns: 3,
          cell_gap: 1,
          text_padding: { value: 4, scale: 'none', unit: 'px' },
          font_size: 10,
          label_font_size: { value: 12, scale: 'none', unit: 'px' },
          value_font_size: { value: 10, scale: 'none', unit: 'px' }
        }
      }
    },
    {
      id: 'performance',
      description: 'Performance-optimized defaults with minimal visual effects',
      defaults: {
        text: {
          font_size: 14,
          font_family: 'var(--lcars-font-family, Antonio)',
          line_height: 1.0
        },
        status_grid: {
          cell_radius: 0, // No rounded corners for performance
          border_width: 1,
          text_padding: { value: 6, scale: 'none', unit: 'px' },
          update_throttle: 200, // Slower updates
          cascade_speed: 0, // No animations
          reveal_animation: false,
          pulse_on_change: false
        },
        sparkline: {
          opacity: 0.8, // Reduced opacity for performance
          decimation_threshold: 500, // More aggressive decimation
          path_precision: 1 // Lower precision
        }
      }
    }
  ],
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
        // Layout & Positioning (lcars_text_preset takes precedence)
        text_layout: 'diagonal',           // ⚠️ Parsed but not used yet
        label_position: 'top-left',        // ✅ Works (fallback if no lcars_text_preset)
        value_position: 'bottom-right',    // ✅ Works (fallback if no lcars_text_preset)
        lcars_text_preset: 'lozenge',      // ✅ Works (overrides positions above)

        // Cell Appearance
        cell_radius: 34,                   // ✅ Works
        cell_color: 'var(--lcars-card-button)',    // ✅ Works
        cell_gap: 8,                       // ✅ Works
        normalize_radius: false,            // ✅ Works
        lcars_corners: false,              // ✅ Works

        // Text Styling
        text_padding: 14,                  // ✅ Works (smart padding)
        text_margin: 3,                    // ✅ Works
        label_font_size: 18,               // ✅ Works
        value_font_size: 18,               // ✅ Works
        label_color: 'black',              // ✅ Works
        value_color: 'black',              // ✅ Works
        font_family: 'Antonio',            // ✅ Works
        font_weight: 'bold',               // ✅ Works

        // Visibility
        show_labels: true,                 // ✅ Works
        show_values: true,                 // ✅ Works

        // Border & Effects
        border_width: 0,                   // ✅ Works
        border_color: 'var(--lcars-gray)', // ✅ Works
        cell_opacity: 0.9                 // ✅ Works
      },
      bullet: {
        text_layout: 'side-by-side',
        label_position: 'left',
        value_position: 'right',
        cell_radius: 38,
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

  anchors: {},
  routing: {}
};

// ✅ ADD: Builtin pack with themes (this is what was missing!)
const BUILTIN_THEMES_PACK = {
  id: 'builtin_themes',
  version: '1.0.0',

  // Token-based themes
  themes: {
    'lcars-classic': {
      id: 'lcars-classic',
      name: 'LCARS Classic',
      description: 'Classic TNG-era LCARS styling',
      tokens: lcarsClassicTokens,
      cssFile: 'apexcharts-lcars-classic.css'
    },

    'lcars-ds9': {
      id: 'lcars-ds9',
      name: 'LCARS DS9',
      description: 'Deep Space Nine LCARS variant',
      tokens: lcarsDs9Tokens,
      cssFile: 'apexcharts-lcars-ds9.css'
    },

    'lcars-voyager': {
      id: 'lcars-voyager',
      name: 'LCARS Voyager',
      description: 'Voyager LCARS styling',
      tokens: lcarsVoyagerTokens,
      cssFile: 'apexcharts-lcars-voyager.css'
    },

    'lcars-high-contrast': {
      id: 'lcars-high-contrast',
      name: 'LCARS High Contrast',
      description: 'Accessibility-focused high contrast theme',
      tokens: lcarsHighContrastTokens,
      cssFile: 'apexcharts-lcars-high-contrast.css'
    }
  },

  // Default theme
  defaultTheme: 'lcars-classic',

  // Chart templates with token references
  chartTemplates: {
    temperature_monitor: {
      style: {
        chart_type: 'line',
        color: 'colors.accent.primary',
        stroke_width: 'borders.width.thick',
        smoothing_mode: 'smooth',
        time_window: '12h',
        max_points: 500,
        show_grid: true,
        show_axis: true
      }
    },

    power_monitor: {
      style: {
        chart_type: 'area',
        color: 'colors.status.warning',
        fill_opacity: 0.3,
        stroke_width: 'borders.width.base',
        time_window: '24h',
        zero_line: true,
        min_value: 0
      }
    }
  },

  // Chart animation presets
  chartAnimationPresets: {
    lcars_standard: {
      enabled: true,
      easing: 'easeinout',
      speed: 800,
      animateGradually: {
        enabled: true,
        delay: 150
      },
      dynamicAnimation: {
        enabled: true,
        speed: 350
      }
    },

    lcars_dramatic: {
      enabled: true,
      easing: 'easeout',
      speed: 1200,
      animateGradually: {
        enabled: true,
        delay: 200
      },
      dynamicAnimation: {
        enabled: true,
        speed: 500
      }
    }
  }
};

const BUILTIN_REGISTRY = {
  core: CORE_PACK,
  lcars_fx: LCARS_FX_PACK,
  cb_lcars_buttons: CB_LCARS_BUTTONS_PACK,
  builtin_themes: BUILTIN_THEMES_PACK  // ✅ ADD: Register the themes pack
};

// Remove getBuiltinPack() function entirely - it's not needed anymore
// All packs are now in BUILTIN_REGISTRY

export function loadBuiltinPacks(requested = ['core', 'cb_lcars_buttons']) {
  // ✅ CRITICAL FIX: Always load builtin_themes pack for theme system
  const packsToLoad = [...new Set([...requested, 'builtin_themes'])];

  return packsToLoad.map(id => BUILTIN_REGISTRY[id]).filter(Boolean);
}

// Make loadBuiltinPacks globally accessible for preset loading
if (typeof window !== 'undefined') {
  window.loadBuiltinPacksModule = { loadBuiltinPacks };
}
