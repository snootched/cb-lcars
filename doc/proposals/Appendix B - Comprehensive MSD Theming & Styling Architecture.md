# MSD ApexCharts Enhancement Proposal - Appendix B

**Version:** 1.0.0  
**Date:** 2025-01-16  
**Status:** Proposed - Appendix  
**Author:** CB-LCARS MSD Team

---

## Appendix B: Comprehensive MSD Theming & Styling Architecture

This appendix addresses the need for a unified, cohesive theming system across the entire MSD ecosystem, enabling pack-based styling for all overlay types and visual elements.

---

## B.1 Current State Analysis

### B.1.1 Existing Styling Mechanisms

**Current styling is fragmented across multiple systems:**

| System | Scope | Format | Location | Status |
|--------|-------|--------|----------|--------|
| **CSS Custom Properties** | Global colors | CSS vars | Root element | ✅ Active |
| **Pack Palettes** | Color tokens | JS objects | `packs/loadBuiltinPacks.js` | ⚠️ Defined but underutilized |
| **DefaultsManager** | Component defaults | Structured objects | `pipeline/MsdDefaultsManager.js` | ✅ Active |
| **StylePresetManager** | Component style bundles | JS objects | `presets/StylePresetManager.js` | ✅ Active (status grids) |
| **ApexCharts Themes** | Chart-specific | JS config + CSS | Proposed in Appendix A | 🚧 Proposed |
| **Inline Style Config** | Per-overlay | YAML properties | User configs | ✅ Active |

### B.1.2 Problems Identified

#### Problem 1: Inconsistent Color Application

**Observation:** Colors are defined in multiple places with no single source of truth.

```javascript
// Pack palette (defined but not consistently used)
palettes: {
  default: {
    accent1: 'var(--lcars-orange)',
    accent2: 'var(--lcars-yellow)',
    danger: 'var(--lcars-red)',
    info: 'var(--lcars-cyan)'
  }
}

// Meanwhile, overlays use direct CSS variables
style: {
  color: 'var(--lcars-orange)'  // Direct reference, bypasses palette
}

// And ApexCharts has its own color system
chartTheme: {
  colors: ['#FF9900', '#9999FF', ...]  // Hardcoded hex values
}
```

**Issue:** Changing the "primary accent" color requires updates in 3+ places.

#### Problem 2: No Typography System

**Observation:** Font sizes and families are scattered.

```javascript
// Text overlays
font_size: 14  // Numeric value

// Status grids
label_font_size: { value: 18, scale: 'none', unit: 'px' }  // Object format

// ApexCharts
legend: { fontSize: '12px' }  // String with unit

// Button overlays
// Uses inherited styles with no explicit control
```

**Issue:** No unified typography scale or font family management.

#### Problem 3: Spacing and Layout Inconsistency

**Observation:** Padding, margins, gaps use different measurement systems.

```javascript
// Some use viewBox-relative
padding: { value: 8, scale: 'viewbox', unit: 'px' }

// Some use direct pixels
cell_gap: 2  // Direct numeric

// Some use strings
margin: '10px'  // String with unit
```

**Issue:** Difficult to maintain consistent spacing across overlay types.

#### Problem 4: Pack Palettes Underutilized

**Observation:** Pack palettes exist but aren't referenced by components.

```javascript
// Palette is defined
palettes: {
  cb_lcars_buttons: {
    primary: 'var(--lcars-blue)',
    secondary: 'var(--lcars-orange)',
    // ...
  }
}

// But overlays don't reference it
style: {
  color: 'var(--lcars-orange)'  // Should use palette.secondary
}
```

**Issue:** Palettes are a dead abstraction layer.

#### Problem 5: No Theme Inheritance

**Observation:** Each overlay resolves its own styling independently.

```javascript
// Text overlay
TextOverlayRenderer.render(overlay, ...)  // Resolves color independently

// Status grid
StatusGridRenderer.render(overlay, ...)  // Resolves color independently

// ApexCharts
ApexChartsAdapter.generateOptions(...)  // Resolves color independently
```

**Issue:** No shared theme context flows through renderers.

### B.1.3 User Pain Points

**Current User Experience:**

```yaml
# User wants to change from orange to purple accent
# Must update in multiple places:

# 1. CSS variables (if they exist)
# 2. Every overlay that hardcodes color
# 3. Chart themes
# 4. Pack palettes (if used)
# 5. Style presets

overlays:
  - id: text1
    style:
      color: 'var(--lcars-orange)'  # Hard to find all instances
  
  - id: chart1
    style:
      color: 'var(--lcars-orange)'  # Repeated
  
  - id: grid1
    style:
      cell_color: 'var(--lcars-orange)'  # Different property name
```

**Desired User Experience:**

```yaml
# User changes accent color in ONE place (pack or theme)
# All overlays automatically reflect the change

pack: my-purple-theme  # That's it!

overlays:
  - id: text1
    # color automatically uses theme.accent
  
  - id: chart1
    # color automatically uses theme.accent
  
  - id: grid1
    # cell_color automatically uses theme.accent
```

---

## B.2 Proposed Architecture: Unified Theme System

### B.2.1 Design Principles

1. **Single Source of Truth**: One place to define each design token
2. **Semantic Naming**: Colors have meaning (accent, danger, info) not just names
3. **Cascade Hierarchy**: Theme → Pack → Overlay (with proper inheritance)
4. **Type Consistency**: All overlays use same token system
5. **Pack-First**: Themes are primarily distributed via packs

### B.2.2 Token-Based Design System

**Concept:** Replace fragmented styling with a unified token system.

#### Design Token Structure

```javascript
// Comprehensive design token system
const designTokens = {
  // ===== COLORS =====
  colors: {
    // Semantic colors (used by most components)
    accent: {
      primary: 'var(--lcars-orange)',
      secondary: 'var(--lcars-blue)',
      tertiary: 'var(--lcars-purple)'
    },
    
    // Status colors
    status: {
      info: 'var(--lcars-blue)',
      success: 'var(--lcars-green)',
      warning: 'var(--lcars-orange)',
      danger: 'var(--lcars-red)',
      unknown: 'var(--lcars-gray)'
    },
    
    // UI element colors
    ui: {
      background: 'var(--lcars-black)',
      foreground: 'var(--lcars-white)',
      border: 'var(--lcars-gray)',
      disabled: 'var(--lcars-dark-gray)'
    },
    
    // Chart-specific colors (multi-series)
    chart: {
      series: [
        'var(--lcars-orange)',
        'var(--lcars-blue)',
        'var(--lcars-yellow)',
        'var(--lcars-purple)',
        'var(--lcars-green)',
        'var(--lcars-red)'
      ],
      grid: 'var(--lcars-gray)',
      axis: 'var(--lcars-white)'
    }
  },
  
  // ===== TYPOGRAPHY =====
  typography: {
    // Font families
    fontFamily: {
      primary: 'Antonio, Helvetica Neue, sans-serif',
      monospace: 'Courier New, monospace'
    },
    
    // Font size scale (consistent sizing)
    fontSize: {
      xs: 10,
      sm: 12,
      base: 14,
      lg: 16,
      xl: 18,
      '2xl': 24,
      '3xl': 32
    },
    
    // Font weights
    fontWeight: {
      normal: 'normal',
      bold: 'bold'
    },
    
    // Line heights
    lineHeight: {
      tight: 1.0,
      normal: 1.2,
      relaxed: 1.5
    },
    
    // Letter spacing
    letterSpacing: {
      tight: '-0.05em',
      normal: '0',
      wide: '0.05em',
      wider: '0.1em'
    }
  },
  
  // ===== SPACING =====
  spacing: {
    // Spacing scale (viewBox-relative)
    scale: {
      '0': 0,
      '1': 2,
      '2': 4,
      '3': 6,
      '4': 8,
      '5': 10,
      '6': 12,
      '8': 16,
      '10': 20,
      '12': 24,
      '16': 32
    },
    
    // Gap sizes
    gap: {
      none: 0,
      xs: 1,
      sm: 2,
      base: 4,
      lg: 8,
      xl: 12
    }
  },
  
  // ===== BORDERS =====
  borders: {
    width: {
      none: 0,
      thin: 1,
      base: 2,
      thick: 3
    },
    
    radius: {
      none: 0,
      sm: 2,
      base: 4,
      lg: 8,
      xl: 12,
      full: 9999
    },
    
    style: {
      solid: 'solid',
      dashed: 'dashed',
      dotted: 'dotted'
    }
  },
  
  // ===== EFFECTS =====
  effects: {
    opacity: {
      disabled: 0.4,
      muted: 0.6,
      base: 1.0
    },
    
    shadow: {
      sm: '0 1px 2px rgba(0,0,0,0.2)',
      base: '0 2px 4px rgba(0,0,0,0.3)',
      lg: '0 4px 8px rgba(0,0,0,0.4)'
    },
    
    blur: {
      sm: 2,
      base: 4,
      lg: 8
    }
  },
  
  // ===== ANIMATIONS =====
  animations: {
    duration: {
      fast: 200,
      base: 350,
      slow: 500,
      slower: 800
    },
    
    easing: {
      linear: 'linear',
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out'
    }
  },
  
  // ===== COMPONENT-SPECIFIC =====
  components: {
    text: {
      defaultColor: 'colors.ui.foreground',
      defaultSize: 'typography.fontSize.base',
      defaultFamily: 'typography.fontFamily.primary'
    },
    
    statusGrid: {
      defaultCellColor: 'colors.accent.primary',
      defaultGap: 'spacing.gap.sm',
      defaultRadius: 'borders.radius.base'
    },
    
    button: {
      defaultColor: 'colors.accent.primary',
      defaultRadius: 'borders.radius.lg'
    },
    
    chart: {
      defaultColors: 'colors.chart.series',
      defaultStrokeWidth: 'borders.width.thick',
      gridColor: 'colors.chart.grid'
    },
    
    line: {
      defaultColor: 'colors.accent.secondary',
      defaultWidth: 'borders.width.base'
    }
  }
};
```

### B.2.3 Token Resolution System

**ThemeTokenResolver** - Central token resolution engine:

```javascript
// src/msd/themes/ThemeTokenResolver.js

/**
 * ThemeTokenResolver - Resolves design tokens with dot notation paths
 * Provides consistent token access across all MSD components
 */
export class ThemeTokenResolver {
  constructor(tokens) {
    this.tokens = tokens || {};
  }

  /**
   * Resolve a token path to its value
   * @param {string} path - Dot notation path (e.g., 'colors.accent.primary')
   * @param {*} fallback - Fallback value if token not found
   * @returns {*} Resolved token value
   */
  resolve(path, fallback = null) {
    if (!path) return fallback;

    // Handle direct values (not token references)
    if (!path.startsWith('colors.') && 
        !path.startsWith('typography.') && 
        !path.startsWith('spacing.') &&
        !path.startsWith('borders.') &&
        !path.startsWith('effects.') &&
        !path.startsWith('animations.') &&
        !path.startsWith('components.')) {
      return path;  // Direct value (e.g., '#FF0000' or 'var(--custom)')
    }

    // Navigate token tree
    const parts = path.split('.');
    let value = this.tokens;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return fallback;
      }
    }

    // If value is a token reference, resolve recursively
    if (typeof value === 'string' && this._isTokenReference(value)) {
      return this.resolve(value, fallback);
    }

    return value !== undefined ? value : fallback;
  }

  /**
   * Resolve multiple token paths
   * @param {Object} paths - Object with keys and token paths
   * @returns {Object} Resolved values
   */
  resolveMany(paths) {
    const resolved = {};
    for (const [key, path] of Object.entries(paths)) {
      resolved[key] = this.resolve(path);
    }
    return resolved;
  }

  /**
   * Check if string is a token reference
   * @private
   */
  _isTokenReference(value) {
    return typeof value === 'string' && (
      value.startsWith('colors.') ||
      value.startsWith('typography.') ||
      value.startsWith('spacing.') ||
      value.startsWith('borders.') ||
      value.startsWith('effects.') ||
      value.startsWith('animations.') ||
      value.startsWith('components.')
    );
  }

  /**
   * Get all tokens for a component type
   * @param {string} componentType - Component type (e.g., 'text', 'chart')
   * @returns {Object} Resolved component tokens
   */
  getComponentTokens(componentType) {
    const componentPath = `components.${componentType}`;
    const componentTokens = this.resolve(componentPath, {});

    // Resolve all nested token references
    const resolved = {};
    for (const [key, value] of Object.entries(componentTokens)) {
      resolved[key] = this.resolve(value);
    }

    return resolved;
  }

  /**
   * Create a scoped resolver for a component
   * @param {string} componentType - Component type
   * @returns {Function} Scoped resolve function
   */
  forComponent(componentType) {
    return (tokenPath, fallback = null) => {
      // Try component-specific token first
      const componentToken = this.resolve(`components.${componentType}.${tokenPath}`);
      if (componentToken !== null) {
        return componentToken;
      }

      // Fall back to global token
      return this.resolve(tokenPath, fallback);
    };
  }
}

// Singleton instance
export const themeTokenResolver = new ThemeTokenResolver();
```

### B.2.4 Enhanced Theme Object

**Complete theme definition with design tokens:**

```javascript
// Enhanced theme structure with full token system

const lcarsClassicTheme = {
  id: 'lcars-classic',
  name: 'LCARS Classic',
  description: 'Classic TNG-era LCARS styling',
  
  // Design tokens (complete system)
  tokens: {
    colors: {
      accent: {
        primary: '#FF9900',
        secondary: '#9999FF',
        tertiary: '#CC99CC'
      },
      status: {
        info: '#9999FF',
        success: '#99CC99',
        warning: '#FF9900',
        danger: '#CC6666',
        unknown: '#999999'
      },
      ui: {
        background: '#000000',
        foreground: '#FFFFFF',
        border: '#999999',
        disabled: '#666666'
      },
      chart: {
        series: ['#FF9900', '#9999FF', '#FFCC99', '#CC99CC', '#99CC99', '#CC6666'],
        grid: '#999999',
        axis: '#FFFFFF'
      }
    },
    
    typography: {
      fontFamily: {
        primary: 'Antonio, Helvetica Neue, sans-serif',
        monospace: 'Courier New, monospace'
      },
      fontSize: {
        xs: 10,
        sm: 12,
        base: 14,
        lg: 16,
        xl: 18,
        '2xl': 24,
        '3xl': 32
      },
      fontWeight: {
        normal: 'normal',
        bold: 'bold'
      },
      lineHeight: {
        tight: 1.0,
        normal: 1.2,
        relaxed: 1.5
      }
    },
    
    spacing: {
      scale: {
        '0': 0,
        '1': 2,
        '2': 4,
        '3': 6,
        '4': 8,
        '5': 10,
        '6': 12,
        '8': 16,
        '10': 20
      },
      gap: {
        none: 0,
        xs: 1,
        sm: 2,
        base: 4,
        lg: 8
      }
    },
    
    borders: {
      width: {
        none: 0,
        thin: 1,
        base: 2,
        thick: 3
      },
      radius: {
        none: 0,
        sm: 2,
        base: 4,
        lg: 8,
        xl: 12
      }
    },
    
    effects: {
      opacity: {
        disabled: 0.4,
        muted: 0.6,
        base: 1.0
      }
    },
    
    animations: {
      duration: {
        fast: 200,
        base: 350,
        slow: 500
      },
      easing: {
        easeInOut: 'ease-in-out'
      }
    },
    
    components: {
      text: {
        defaultColor: 'colors.ui.foreground',
        defaultSize: 'typography.fontSize.base',
        defaultFamily: 'typography.fontFamily.primary'
      },
      statusGrid: {
        defaultCellColor: 'colors.accent.primary',
        defaultGap: 'spacing.gap.sm',
        defaultRadius: 'borders.radius.base'
      },
      chart: {
        defaultColors: 'colors.chart.series',
        defaultStrokeWidth: 'borders.width.thick'
      }
    }
  },
  
  // Legacy palette (for backwards compatibility)
  palette: {
    colors: {
      'orange': '#FF9900',
      'blue': '#9999FF',
      // ... (maps to tokens.colors)
    }
  },
  
  // ApexCharts-specific theme (generated from tokens)
  chartTheme: {
    colors: '${tokens.colors.chart.series}',  // Token reference
    stroke: {
      width: '${tokens.borders.width.thick}',
      curve: 'smooth'
    },
    // ...
  },
  
  // CSS file for advanced styling
  cssFile: 'apexcharts-lcars-classic.css'
};
```

### B.2.5 Pack Structure with Tokens

**Enhanced pack structure:**

```javascript
// src/msd/packs/loadBuiltinPacks.js (enhanced)

const builtinPack = {
  id: 'builtin',
  version: '1.0.0',
  
  // Existing properties
  profiles: [ /* ... */ ],
  overlays: [ /* ... */ ],
  anchors: { /* ... */ },
  routing: { /* ... */ },
  
  // Chart templates (from Appendix A)
  chartTemplates: { /* ... */ },
  
  // Animation presets (from Appendix A)
  chartAnimationPresets: { /* ... */ },
  
  // NEW: Design token themes
  themes: {
    'lcars-classic': {
      id: 'lcars-classic',
      name: 'LCARS Classic',
      tokens: {
        colors: { /* ... */ },
        typography: { /* ... */ },
        spacing: { /* ... */ },
        borders: { /* ... */ },
        effects: { /* ... */ },
        animations: { /* ... */ },
        components: { /* ... */ }
      },
      cssFile: 'apexcharts-lcars-classic.css'
    },
    
    'lcars-ds9': {
      // DS9 theme tokens
    },
    
    'lcars-voyager': {
      // Voyager theme tokens
    },
    
    'lcars-high-contrast': {
      // High contrast theme tokens
    }
  },
  
  // NEW: Default theme
  defaultTheme: 'lcars-classic',
  
  // DEPRECATED: Old palette system (keep for backwards compatibility)
  palettes: {
    default: {
      accent1: 'var(--lcars-orange)',
      // ... (deprecated, use themes.tokens.colors instead)
    }
  }
};
```

---

## B.3 Component Token Integration

### B.3.1 Renderer Token Resolution

**Pattern:** Each renderer resolves tokens via ThemeTokenResolver.

#### Text Overlay Example

```javascript
// src/msd/renderer/TextOverlayRenderer.js (enhanced)

import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';

export class TextOverlayRenderer {
  static render(overlay, anchors, viewBox, container, cardInstance) {
    const style = overlay.finalStyle || overlay.style || {};
    
    // Create component-scoped resolver
    const resolveToken = themeTokenResolver.forComponent('text');
    
    // Resolve color with token support
    const color = resolveToken(
      style.color || 'defaultColor',
      'var(--lcars-white)'  // Final fallback
    );
    
    // Resolve font size with token support
    const fontSize = resolveToken(
      style.font_size || 'defaultSize',
      14  // Final fallback
    );
    
    // Resolve font family with token support
    const fontFamily = resolveToken(
      style.font_family || 'defaultFamily',
      'Antonio'  // Final fallback
    );
    
    // ... render with resolved tokens
    
    const markup = `
      <text 
        fill="${color}"
        font-size="${fontSize}"
        font-family="${fontFamily}"
        ...
      >
        ${content}
      </text>
    `;
    
    return { markup, actionInfo, overlayId };
  }
}
```

#### Status Grid Example

```javascript
// src/msd/renderer/StatusGridRenderer.js (enhanced)

import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';

export class StatusGridRenderer {
  static render(overlay, anchors, viewBox, container) {
    const style = overlay.finalStyle || overlay.style || {};
    
    // Create component-scoped resolver
    const resolveToken = themeTokenResolver.forComponent('statusGrid');
    
    // Resolve design tokens
    const cellColor = resolveToken(
      style.cell_color || 'defaultCellColor',
      'var(--lcars-blue)'
    );
    
    const cellGap = resolveToken(
      style.cell_gap || 'defaultGap',
      2
    );
    
    const cellRadius = resolveToken(
      style.cell_radius || 'defaultRadius',
      4
    );
    
    // Resolve status colors
    const statusColors = {
      on: resolveToken('colors.status.success', '#99CC99'),
      off: resolveToken('colors.status.unknown', '#999999'),
      unavailable: resolveToken('colors.status.danger', '#CC6666')
    };
    
    // ... render with resolved tokens
  }
}
```

#### ApexCharts Example

```javascript
// src/msd/charts/ApexChartsAdapter.js (enhanced)

import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';

export class ApexChartsAdapter {
  static generateOptions(style, size, context = {}) {
    // Create component-scoped resolver
    const resolveToken = themeTokenResolver.forComponent('chart');
    
    // Resolve chart colors
    const colors = resolveToken(
      style.colors || 'defaultColors',
      ['#FF9900', '#9999FF', '#FFCC99']
    );
    
    // Resolve stroke width
    const strokeWidth = resolveToken(
      style.stroke_width || 'defaultStrokeWidth',
      2
    );
    
    // Resolve grid color
    const gridColor = resolveToken(
      'gridColor',
      '#999999'
    );
    
    // Build options with resolved tokens
    const baseOptions = {
      colors: colors,
      stroke: {
        width: strokeWidth
      },
      grid: {
        borderColor: gridColor
      },
      // ...
    };
    
    return baseOptions;
  }
}
```

### B.3.2 User-Facing Token Usage

**Users can reference tokens directly in YAML:**

```yaml
overlays:
  # Use semantic token
  - id: status_text
    type: text
    content: "SHIELDS ONLINE"
    position: [50, 100]
    style:
      color: "colors.status.success"  # Token reference
      font_size: "typography.fontSize.lg"  # Token reference

  # Use component default (resolved from theme)
  - id: power_chart
    type: apexchart
    source: power
    position: [50, 150]
    size: [300, 150]
    # color automatically uses components.chart.defaultColors

  # Mix tokens with direct values
  - id: alert_grid
    type: status_grid
    position: [50, 320]
    size: [200, 100]
    style:
      cell_color: "colors.status.danger"  # Token
      cell_gap: 4  # Direct value
      cell_radius: "borders.radius.lg"  # Token

  # Override token with direct value
  - id: custom_text
    type: text
    content: "CUSTOM"
    position: [50, 450]
    style:
      color: "#FF00FF"  # Direct hex (bypasses tokens)
```

---

## B.4 Backwards Compatibility Strategy

### B.4.1 Migration Path

**Goal:** Support existing configs while introducing token system.

#### Phase 1: Token System Introduction (Non-Breaking)

```javascript
// ThemeTokenResolver handles both old and new formats

class ThemeTokenResolver {
  resolve(path, fallback = null) {
    // NEW: Token reference
    if (this._isTokenReference(path)) {
      return this._resolveToken(path, fallback);
    }
    
    // OLD: CSS variable reference
    if (path && path.startsWith('var(--')) {
      return path;  // Pass through CSS variables
    }
    
    // OLD: Direct color value
    if (path && (path.startsWith('#') || path.startsWith('rgb'))) {
      return path;  // Pass through direct colors
    }
    
    // OLD: Numeric value
    if (typeof path === 'number') {
      return path;  // Pass through numbers
    }
    
    return fallback;
  }
}
```

**Result:** Existing configs work unchanged, new configs can use tokens.

#### Phase 2: Deprecation Warnings (Educational)

```javascript
// Warn users about deprecated approaches

if (style.color && style.color.startsWith('var(--lcars-')) {
  cblcarsLog.info(
    `[${overlayType}] Consider using token reference instead of CSS variable: ` +
    `"colors.accent.primary" instead of "${style.color}"`
  );
}
```

#### Phase 3: Migration Helpers (Optional)

```javascript
// Automatic token suggestion tool

window.cblcars.theme.suggestToken = function(cssVar) {
  const mapping = {
    'var(--lcars-orange)': 'colors.accent.primary',
    'var(--lcars-blue)': 'colors.accent.secondary',
    'var(--lcars-red)': 'colors.status.danger',
    // ... complete mapping
  };
  
  return mapping[cssVar] || cssVar;
};
```

### B.4.2 Palette Migration

**Convert old palette system to new token system:**

```javascript
// src/msd/themes/PaletteMigrator.js

/**
 * Migrate old palette format to new token format
 */
export class PaletteMigrator {
  static migrateToTokens(oldPalette) {
    const tokens = {
      colors: {
        accent: {},
        status: {},
        ui: {}
      }
    };

    // Map old palette keys to new token paths
    const mapping = {
      'accent1': 'colors.accent.primary',
      'accent2': 'colors.accent.secondary',
      'danger': 'colors.status.danger',
      'info': 'colors.status.info',
      'success': 'colors.status.success',
      'warning': 'colors.status.warning',
      // ... complete mapping
    };

    for (const [oldKey, newPath] of Object.entries(mapping)) {
      if (oldPalette[oldKey]) {
        this._setTokenPath(tokens, newPath, oldPalette[oldKey]);
      }
    }

    return tokens;
  }

  static _setTokenPath(obj, path, value) {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;
  }
}
```

---

## B.5 Implementation Plan

### B.5.1 Phase 1: Foundation (Week 1)

**Deliverables:**
- [ ] Create `ThemeTokenResolver.js`
- [ ] Define complete token schema
- [ ] Create 4 built-in themes with full token definitions
- [ ] Update ThemeSystem to support tokens
- [ ] Write unit tests for token resolution

**Files:**
```
src/msd/themes/
├── ThemeTokenResolver.js (NEW)
├── ThemeSystem.js (ENHANCE)
├── tokens/ (NEW)
│   ├── defaultTokens.js
│   ├── lcarsClassicTokens.js
│   ├── lcarsDs9Tokens.js
│   └── lcarsVoyagerTokens.js
└── PaletteMigrator.js (NEW - for backwards compatibility)
```

### B.5.2 Phase 2: Renderer Integration (Week 2)

**Deliverables:**
- [ ] Integrate tokens into TextOverlayRenderer
- [ ] Integrate tokens into StatusGridRenderer
- [ ] Integrate tokens into ButtonOverlayRenderer
- [ ] Integrate tokens into LineOverlayRenderer
- [ ] Integrate tokens into SparklineOverlayRenderer
- [ ] Integrate tokens into HistoryBarRenderer
- [ ] Integrate tokens into ApexChartsAdapter

**Pattern for each renderer:**
```javascript
import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';

// Create scoped resolver
const resolveToken = themeTokenResolver.forComponent('componentType');

// Resolve tokens
const color = resolveToken(style.color || 'defaultColor', fallback);
```

### B.5.3 Phase 3: Pack Integration (Week 2-3)

**Deliverables:**
- [ ] Update `loadBuiltinPacks.js` with token-based themes
- [ ] Update `PackManager.js` to load themes with tokens
- [ ] Create example custom pack with tokens
- [ ] Test pack loading and theme application

### B.5.4 Phase 4: Documentation & Examples (Week 3-4)

**Deliverables:**
- [ ] Document token system architecture
- [ ] Document all available tokens
- [ ] Create token reference guide
- [ ] Provide migration guide from old system
- [ ] Create example configs using tokens

---

## B.6 Token Reference Documentation

### B.6.1 Complete Token Paths

**Colors:**
```
colors.accent.primary
colors.accent.secondary
colors.accent.tertiary

colors.status.info
colors.status.success
colors.status.warning
colors.status.danger
colors.status.unknown

colors.ui.background
colors.ui.foreground
colors.ui.border
colors.ui.disabled

colors.chart.series (array)
colors.chart.grid
colors.chart.axis
```

**Typography:**
```
typography.fontFamily.primary
typography.fontFamily.monospace

typography.fontSize.xs (10)
typography.fontSize.sm (12)
typography.fontSize.base (14)
typography.fontSize.lg (16)
typography.fontSize.xl (18)
typography.fontSize.2xl (24)
typography.fontSize.3xl (32)

typography.fontWeight.normal
typography.fontWeight.bold

typography.lineHeight.tight (1.0)
typography.lineHeight.normal (1.2)
typography.lineHeight.relaxed (1.5)
```

**Spacing:**
```
spacing.scale.0 (0)
spacing.scale.1 (2)
spacing.scale.2 (4)
spacing.scale.3 (6)
spacing.scale.4 (8)
spacing.scale.5 (10)
spacing.scale.6 (12)
spacing.scale.8 (16)
spacing.scale.10 (20)

spacing.gap.none (0)
spacing.gap.xs (1)
spacing.gap.sm (2)
spacing.gap.base (4)
spacing.gap.lg (8)
```

**Borders:**
```
borders.width.none (0)
borders.width.thin (1)
borders.width.base (2)
borders.width.thick (3)

borders.radius.none (0)
borders.radius.sm (2)
borders.radius.base (4)
borders.radius.lg (8)
borders.radius.xl (12)
```

**Component Defaults:**
```
components.text.defaultColor
components.text.defaultSize
components.text.defaultFamily

components.statusGrid.defaultCellColor
components.statusGrid.defaultGap
components.statusGrid.defaultRadius

components.chart.defaultColors
components.chart.defaultStrokeWidth

components.button.defaultColor
components.button.defaultRadius

components.line.defaultColor
components.line.defaultWidth
```

### B.6.2 User Documentation Example

````markdown
# Using Design Tokens in MSD

## Overview

MSD uses a design token system for consistent styling across all overlays.

## Token Reference

Instead of hardcoding colors or sizes, reference design tokens:

```yaml
overlays:
  - id: my_text
    type: text
    content: "STATUS"
    style:
      color: "colors.accent.primary"  # Orange in classic theme
      font_size: "typography.fontSize.lg"  # 16px
```

## Available Token Categories

- **colors.*** - Color palette
- **typography.*** - Fonts and sizes
- **spacing.*** - Padding, margins, gaps
- **borders.*** - Widths, radii, styles
- **components.*** - Component-specific defaults

## Benefits

1. **Theme Consistency**: All overlays automatically match your theme
2. **Easy Customization**: Change theme, all overlays update
3. **Semantic Naming**: Use meaning (accent, danger) not colors (orange, red)

## Examples

### Using Status Colors

```yaml
overlays:
  - id: success_indicator
    type: text
    content: "ONLINE"
    style:
      color: "colors.status.success"  # Green
  
  - id: danger_indicator
    type: text
    content: "OFFLINE"
    style:
      color: "colors.status.danger"  # Red
```

### Using Typography Scale

```yaml
overlays:
  - id: title
    type: text
    content: "ENGINEERING"
    style:
      font_size: "typography.fontSize.2xl"  # 24px
  
  - id: subtitle
    type: text
    content: "Warp Core Status"
    style:
      font_size: "typography.fontSize.base"  # 14px
```

### Using Spacing

```yaml
overlays:
  - id: my_grid
    type: status_grid
    style:
      cell_gap: "spacing.gap.base"  # 4px
      text_padding: "spacing.scale.4"  # 8px
```

## Custom Themes

Create custom themes with your own tokens:

```yaml
# my-custom-pack.yaml

themes:
  my_purple_theme:
    tokens:
      colors:
        accent:
          primary: "#9966CC"  # Purple
          secondary: "#66CCCC"  # Cyan
```
````

---

## B.7 Advanced Features

### B.7.1 Responsive Tokens

**Concept:** Tokens that change based on viewBox size.

```javascript
// Responsive token definition
const tokens = {
  typography: {
    fontSize: {
      base: {
        small: 12,   // viewBox width < 400
        medium: 14,  // viewBox width 400-800
        large: 16    // viewBox width > 800
      }
    }
  }
};

// Resolution with context
const fontSize = themeTokenResolver.resolve(
  'typography.fontSize.base',
  14,
  { viewBoxWidth: 600 }  // Context
);
// Returns 14 (medium)
```

### B.7.2 Computed Tokens

**Concept:** Tokens derived from other tokens.

```javascript
const tokens = {
  colors: {
    accent: {
      primary: '#FF9900',
      primaryDark: computed((tokens) => {
        return darken(tokens.colors.accent.primary, 0.2);
      }),
      primaryLight: computed((tokens) => {
        return lighten(tokens.colors.accent.primary, 0.2);
      })
    }
  }
};
```

### B.7.3 Theme Variants

**Concept:** Light/dark variants of same theme.

```javascript
const lcarsClassicTheme = {
  id: 'lcars-classic',
  
  variants: {
    default: {
      tokens: { /* default tokens */ }
    },
    
    light: {
      tokens: {
        colors: {
          ui: {
            background: '#FFFFFF',  // Light background
            foreground: '#000000'   // Dark text
          }
        }
      }
    },
    
    dark: {
      tokens: {
        colors: {
          ui: {
            background: '#000000',  // Dark background
            foreground: '#FFFFFF'   // Light text
          }
        }
      }
    }
  }
};
```

**Usage:**
```yaml
theme: lcars-classic:light  # Use light variant
```

---

## B.8 Benefits Summary

### B.8.1 For Users

✅ **Single Source of Styling**: Change theme, everything updates  
✅ **Semantic Naming**: Use meaning (`colors.status.danger`) not colors  
✅ **Pack-Based Themes**: Community can share themed packs  
✅ **Consistent Look**: All overlays automatically match  
✅ **Easy Customization**: Override specific tokens as needed

### B.8.2 For Developers

✅ **Unified API**: All renderers use same token resolution  
✅ **Maintainable**: Changes in one place propagate everywhere  
✅ **Testable**: Token resolution is isolated and testable  
✅ **Extensible**: Easy to add new tokens  
✅ **Backwards Compatible**: Existing configs continue to work

### B.8.3 For the Project

✅ **Professional Architecture**: Industry-standard design token system  
✅ **Community Enablement**: Users can create/share themed packs  
✅ **Scalable**: System grows with new overlay types  
✅ **Future-Proof**: Ready for advanced features (variants, responsive, computed)

---

## B.9 Example: Complete Themed Dashboard

**Before (fragmented styling):**

```yaml
overlays:
  - id: text1
    style:
      color: 'var(--lcars-orange)'
  - id: chart1
    style:
      color: '#FF9900'
  - id: grid1
    style:
      cell_color: 'var(--lcars-blue)'
  # Inconsistent color references!
```

**After (unified tokens):**

```yaml
pack: my-purple-theme  # All styling comes from theme

overlays:
  - id: text1
    # Uses theme.components.text.defaultColor automatically
  
  - id: chart1
    # Uses theme.components.chart.defaultColors automatically
  
  - id: grid1
    # Uses theme.components.statusGrid.defaultCellColor automatically

# Result: Consistent purple theme across all overlays!
```

---

## B.10 Implementation Roadmap

### Week 1: Foundation
- Create ThemeTokenResolver
- Define token schema
- Create 4 built-in themes with tokens
- Unit tests

### Week 2: Renderer Integration
- Integrate tokens into all renderers
- Test token resolution
- Ensure backwards compatibility

### Week 3: Pack Integration
- Update pack structure
- Create example themed packs
- Migration tools

### Week 4: Documentation
- Token reference guide
- Migration guide
- User examples
- Developer documentation

**Total Effort:** 4 weeks  
**Priority:** HIGH (foundational architecture)

---

## B.11 Recommendation

✅ **IMPLEMENT comprehensive token-based theming system**

**Rationale:**
1. Solves fragmented styling problem
2. Enables community pack creation
3. Professional architecture
4. Backwards compatible
5. Future-proof for growth

**This is a foundational architecture change that will benefit the entire MSD ecosystem.**

---

**End of Appendix B**