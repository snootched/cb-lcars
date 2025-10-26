# MSD Pack Structure & Style Presets

This document explains the complete structure of MSD packs and how themes, style presets, and other pack features work.

## Pack Structure Overview

MSD packs contain several sections, each serving a specific purpose:

```javascript
const PACK = {
  id: 'pack_name',
  version: '1.0.0',
  description: 'Pack description',

  // Core pack sections:
  themes: {},          // Theme definitions with tokens (for builtin_themes pack)
  style_presets: {},   // Named style bundles
  overlays: [],        // Complete overlay definitions
  palettes: {},        // Named color schemes (legacy, use themes instead)
  animations: [],      // Animation definitions
  rules: [],          // Rule definitions
  anchors: {},        // Anchor definitions
  routing: {},        // Routing configurations
  chartTemplates: {},  // ApexCharts templates (for builtin_themes pack)
  chartAnimationPresets: {} // Chart animation configs (for builtin_themes pack)
};
```

### Pack Architecture

```mermaid
graph TB
    subgraph Pack["MSD Pack"]
        Themes[Themes<br/>Token-based defaults]
        SP[Style Presets<br/>Named style bundles]
        Overlays[Overlays<br/>Complete definitions]
        Palettes[Palettes<br/>Legacy colors]
        Anims[Animations]
        Rules[Rules]
        Anchors[Anchors]
        Routing[Routing Config]
        CT[Chart Templates]
        CAP[Chart Animation Presets]
    end

    subgraph Systems["CB-LCARS Systems"]
        TM[ThemeManager]
        SPM[StylePresetManager]
        AR[AdvancedRenderer]
        SRS[StyleResolverService]
    end

    subgraph UserConfig["User Configuration"]
        UC[User Config<br/>theme: 'lcars-classic'<br/>lcars_button_preset: 'lozenge']
    end

    Themes --> TM
    SP --> SPM
    Overlays --> UC
    Palettes --> SRS
    CT --> AR

    UC --> TM
    UC --> SPM
    UC --> AR

    TM --> SRS
    SPM --> AR

    style Pack fill:#f0f0f0,stroke:#666,stroke-width:2px
    style Themes fill:#ff9900,stroke:#cc7700,stroke-width:2px
    style SP fill:#4d94ff,stroke:#0066cc,stroke-width:2px
    style TM fill:#ff9900,stroke:#cc7700,stroke-width:2px
    style SPM fill:#4d94ff,stroke:#0066cc,stroke-width:2px
```

### Pack Loading Flow

```mermaid
sequenceDiagram
    participant Config as User Config
    participant PC as PipelineCore
    participant PM as PackManager
    participant Pack as MSD Pack
    participant TM as ThemeManager
    participant SPM as StylePresetManager
    participant AR as AdvancedRenderer

    Config->>PC: Initialize with theme & packs
    PC->>PM: Load packs

    PM->>Pack: Load builtin_themes
    Pack-->>PM: themes, style_presets, chartTemplates

    PM->>Pack: Load user packs
    Pack-->>PM: overlays, animations, rules

    PM->>TM: Register themes
    TM->>TM: Store theme tokens

    PM->>SPM: Register style presets
    SPM->>SPM: Store presets by overlay type

    PM->>PC: Pack loading complete

    PC->>AR: Render overlays

    alt User specified theme
        AR->>TM: Get theme defaults
        TM-->>AR: Token-based defaults
    end

    alt Overlay uses preset
        AR->>SPM: Get preset
        SPM-->>AR: Preset style bundle
    end

    AR->>AR: Merge: theme defaults + preset + user style
    AR->>AR: Render with merged style
```

## Pack Sections Explained

### 1. Themes (builtin_themes pack only)
**Purpose**: Provide complete theme definitions with token-based defaults
**Usage**: Selected via `theme: "theme-name"` in user config

```javascript
themes: {
  'lcars-classic': {
    id: 'lcars-classic',
    name: 'LCARS Classic',
    description: 'Classic TNG-era LCARS styling',
    tokens: lcarsClassicTokens,  // Token object with all theme values
    cssFile: 'apexcharts-lcars-classic.css'  // Optional ApexCharts CSS
  }
}
```

**Theme Token Structure:**
```javascript
lcarsClassicTokens = {
  // Base design tokens
  colors: {
    accent: { primary: 'var(--lcars-orange)' },
    status: { success: 'var(--lcars-green)' }
  },
  typography: {
    fontSize: { base: 16 },
    fontFamily: { primary: 'Antonio' }
  },
  spacing: {
    scale: { '4': 8 },
    gap: { base: 4 }
  },
  borders: {
    width: { base: 2 },
    radius: { base: 4 }
  },

  // Component-specific defaults
  components: {
    text: {
      defaultSize: 'typography.fontSize.base',   // Token reference
      defaultColor: 'colors.ui.foreground',       // Token reference
      bracket: {
        width: 'borders.width.base',              // Token reference
        gap: 'spacing.gap.base',                  // Token reference
        extension: 8                               // Direct value
      }
    },
    statusGrid: {
      rows: 3,
      columns: 4,
      cellGap: 'spacing.gap.sm',
      textPadding: 'spacing.scale.4',
      statusOnColor: 'colors.status.success'
    },
    sparkline: {
      defaultColor: 'colors.accent.primary',
      strokeWidth: 'borders.width.base'
    }
  }
}
```

### 2. Style Presets (Named Style Bundles)
**Purpose**: Provide complete, named style configurations that can be applied
**Usage**: Applied when `lcars_button_preset: "preset_name"` is specified

```javascript
style_presets: {
  status_grid: {
    lozenge: {
      text_layout: 'diagonal',
      label_position: 'top-left',
      value_position: 'bottom-right',
      cell_radius: 34,
      text_padding: 14,
      text_margin: 3,
      normalize_radius: false,
      show_labels: true,
      show_values: true,
      lcars_text_preset: 'lozenge',
      // ANY style property can be included
      cell_color: '#0088ff',
      font_size: 18,
      font_weight: 'bold'
    },
    bullet: {
      text_layout: 'side-by-side',
      label_position: 'left',
      value_position: 'right',
      cell_radius: 38,
      text_padding: 8,
      normalize_radius: true,
      lcars_text_preset: 'bullet'
    }
  }
}
```

### 3. Overlays (Complete Definitions)
**Purpose**: Provide complete, ready-to-use overlay configurations
**Usage**: Merged into user config as actual overlays

```javascript
overlays: [
  {
    id: 'power_status_grid',
    type: 'status_grid',
    position: [100, 100],
    size: [200, 150],
    style: {
      lcars_button_preset: 'lozenge'
    },
    cells: [
      { id: 'power', label: 'PWR', content: '{power.state}' }
    ]
  }
]
```

### 4. Palettes (Color Schemes) - Legacy
**Purpose**: Provide named color collections
**Usage**: Referenced in styles via palette system
**Note**: Prefer using theme tokens instead for new implementations

```javascript
palettes: {
  cb_lcars_buttons: {
    primary: 'var(--lcars-blue, #0088ff)',
    secondary: 'var(--lcars-orange, #ff9900)',
    success: 'var(--lcars-green, #00ff00)',
    'picard-gold': '#d4af37'
  }
}
```

### 5. Chart Templates (builtin_themes pack only)
**Purpose**: Provide reusable ApexCharts configurations
**Usage**: Referenced in chart overlays via template system

```javascript
chartTemplates: {
  sensor_monitor: {
    style: {
      chart_type: 'line',
      stroke_width: 3,
      smoothing_mode: 'smooth',
      show_grid: true,
      chart_options: {
        stroke: {
          curve: 'smooth',
          colors: ['colors.accent.primary']  // Token reference
        }
      }
    }
  }
}
```

## How Style Presets Work

### 1. Pack Definition
Style presets are defined in the pack's `style_presets` section:

```javascript
style_presets: {
  status_grid: {        // Overlay type
    preset_name: {      // Preset name
      property: value,  // Any style property
      // ...
    }
  }
}
```

### 2. User Application
Users apply presets by specifying the preset name:

```yaml
- id: my_grid
  type: status_grid
  style:
    lcars_button_preset: "preset_name"  # Loads from pack
    custom_override: "value"            # User override
```

### 3. Runtime Resolution
StatusGridRenderer loads and applies the preset:

```javascript
// 1. Load preset from StylePresetManager
const preset = stylePresetManager.getPreset('status_grid', 'preset_name');

// 2. Apply with user override protection
Object.entries(preset).forEach(([property, value]) => {
  if (!userStyle[property]) {           // User didn't specify
    gridStyle[property] = value;        // Apply preset value
  }
  // User value preserved if specified
});
```

## Theme System Integration

### How Themes Provide Defaults

Themes replace the old profile/defaults system:

**Old System (Deprecated):**
```javascript
// Packs had profiles with defaults
profiles: [{
  id: 'cb_button_defaults',
  defaults: {
    status_grid: { text_padding: 12 }
  }
}]
```

**New System (Current):**
```javascript
// Themes have component defaults in tokens
themes: {
  'lcars-classic': {
    tokens: {
      components: {
        statusGrid: {
          textPadding: 'spacing.scale.4'  // Token reference → 8
        }
      }
    }
  }
}
```

### Theme Token Resolution

Themes support **token references** for consistency:

```javascript
// Theme tokens
{
  spacing: {
    scale: { '4': 8 }
  },
  components: {
    statusGrid: {
      textPadding: 'spacing.scale.4'  // References spacing token
    }
  }
}

// Resolution at runtime
ThemeManager.getDefault('statusGrid', 'textPadding', 8)
// → Looks up 'components.statusGrid.textPadding'
// → Finds 'spacing.scale.4'
// → Resolves to spacing.scale.4 = 8
// → Returns 8
```

## Priority Order

When resolving style values, the system uses this priority order:

1. **User Explicit Values** (highest) - Direct style properties
2. **Style Preset Values** (medium) - Applied from pack presets
3. **Theme Component Defaults** (lower) - From active theme tokens
4. **Hardcoded Fallbacks** (lowest) - Last resort values in code

## Example: Complete Flow

### Pack Definition
```javascript
// builtin_themes pack provides theme
themes: {
  'lcars-classic': {
    tokens: {
      spacing: { scale: { '4': 8 } },
      components: {
        statusGrid: { textPadding: 'spacing.scale.4' }  // → 8
      }
    }
  }
}

// cb_lcars_buttons pack provides preset
style_presets: {
  status_grid: {
    lozenge: {
      text_padding: 14,      // Preset overrides theme default
      text_layout: 'diagonal'
    }
  }
}
```

### User Configuration
```yaml
msd:
  theme: "lcars-classic"                # Select theme
  use_packs:
    builtin: ['cb_lcars_buttons']      # Load presets

  overlays:
    - id: my_grid
      type: status_grid
      style:
        lcars_button_preset: "lozenge"  # Apply preset
        font_size: 20                    # User override
        # text_padding not specified    # Will use preset value (14)
        # cell_radius not specified     # Will use theme default
```

### Final Resolution
```javascript
// Final style object:
{
  font_size: 20,          // USER (highest priority)
  text_padding: 14,       // PRESET (medium priority)
  text_layout: 'diagonal', // PRESET (medium priority)
  cell_radius: 4,         // THEME (lower priority, from theme tokens)
  border_width: 1         // HARDCODED FALLBACK (lowest priority)
}
```

## Pack Types

### 1. Theme Pack (builtin_themes)
**Always loaded automatically**
- Provides all available themes
- Contains default theme (`lcars-classic`)
- Includes chart templates and animation presets

### 2. Style Pack (cb_lcars_buttons)
**Loaded on demand**
- Provides style presets (lozenge, bullet, etc.)
- No themes (uses active theme for defaults)
- Focused on specific overlay styling

### 3. Feature Pack (core)
**Core functionality**
- Minimal configuration
- System-level defaults
- Basic anchors and routing

### 4. Custom Packs (user-created)
**External packs**
- Can include any pack sections
- Loaded via URL in `use_packs.external`
- Can provide custom themes, presets, overlays

## Creating Custom Packs

### Example: Custom Theme Pack
```json
{
  "id": "my_themes",
  "version": "1.0.0",
  "themes": {
    "my-dark-theme": {
      "id": "my-dark-theme",
      "name": "My Dark Theme",
      "tokens": {
        "colors": {
          "accent": { "primary": "#00ff00" },
          "ui": { "background": "#000000" }
        },
        "components": {
          "statusGrid": {
            "cellGap": 4,
            "textPadding": 12
          }
        }
      }
    }
  }
}
```

### Example: Custom Style Pack
```json
{
  "id": "my_styles",
  "version": "1.0.0",
  "style_presets": {
    "status_grid": {
      "my-custom-preset": {
        "cell_radius": 20,
        "text_padding": 16,
        "font_weight": "bold",
        "cell_color": "#ff6600"
      }
    }
  }
}
```

## Benefits

- **Modularity**: Packs can be mixed and matched
- **Consistency**: Themes ensure consistent theming across all components
- **Flexibility**: Users can override any value
- **Extensibility**: Packs can define custom themes and presets
- **Maintainability**: Centralized configurations in packs
- **Simplicity**: Clear separation between themes (defaults) and presets (styles)

## Migration from Old System

**Old:** Profiles in packs provided defaults
**New:** Themes in builtin_themes pack provide defaults via tokens

**Old:** Multiple layers (user, pack, theme, builtin)
**New:** Simplified layers (user > preset > theme > fallback)

**Benefit:** Simpler, more powerful, easier to maintain