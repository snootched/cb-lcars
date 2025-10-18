# MSD ApexCharts Enhancement Proposal - Appendix B (Revised v1.1)

**Version:** 1.1.0  
**Date:** 2025-01-16  
**Status:** Proposed - Appendix (REVISED)  
**Author:** CB-LCARS MSD Team

---

## Appendix B: Comprehensive MSD Theming & Styling Architecture

This appendix addresses the need for a unified, cohesive theming system across the entire MSD ecosystem, enabling pack-based styling for all overlay types and visual elements.

**REVISION NOTES (v1.1.0):**
- ✅ Tokens now reference CSS variables and internal JS variables
- ✅ Integration with HA-LCARS theme variables
- ✅ Legacy CB-LCARS color system integration
- ❌ Palettes marked for complete removal
- ✅ Enhanced Responsive Tokens with viewBox scaling integration
- ✅ **REVISED: Computed Tokens limited to color manipulation only**
- ✅ **NEW: Clear RulesEngine integration patterns**
- ✅ Color manipulation utilities (darken, lighten, alpha, saturate, desaturate, mix)

---

## B.1 Current State Analysis

### B.1.1 Existing Styling Mechanisms

**Current styling is fragmented across multiple systems:**

| System | Scope | Format | Location | Status |
|--------|-------|--------|----------|--------|
| **CSS Custom Properties** | Global colors | CSS vars | Root element | ✅ Active |
| **HA-LCARS Theme Variables** | HA theme colors | CSS vars | `--lcars-*` | ✅ Active (external) |
| **Legacy CB-LCARS Colors** | Card colors | CSS vars | Loaded at runtime | ✅ Active (legacy) |
| **Pack Palettes** | Color tokens | JS objects | `packs/loadBuiltinPacks.js` | ❌ **REMOVE** (unused) |
| **DefaultsManager** | Component defaults | Structured objects | `pipeline/MsdDefaultsManager.js` | ✅ Active |
| **StylePresetManager** | Component style bundles | JS objects | `presets/StylePresetManager.js` | ✅ Active (status grids) |
| **RulesEngine** | Dynamic styling | Conditional logic | `rules/RulesEngine.js` | ✅ Active (dynamic behavior) |
| **ApexCharts Themes** | Chart-specific | JS config + CSS | Proposed in Appendix A | 🚧 Proposed |
| **Inline Style Config** | Per-overlay | YAML properties | User configs | ✅ Active |

### B.1.2 CSS Variable Ecosystem

**Existing CSS Variables (from HA-LCARS Theme):**

```css
/* HA-LCARS Theme provides */
--lcars-orange: #FF9900;
--lcars-blue: #9999FF;
--lcars-purple: #CC99CC;
--lcars-yellow: #FFCC99;
--lcars-red: #CC6666;
--lcars-green: #99CC99;
--lcars-gray: #999999;
--lcars-white: #FFFFFF;
--lcars-black: #000000;

/* Plus many more HA theme variables */
--primary-color: ...;
--accent-color: ...;
--text-primary-color: ...;
/* etc. */
```

**Legacy CB-LCARS Color Loading:**

```javascript
// Existing code loads CB-LCARS colors as CSS variables
// if they don't already exist from HA-LCARS theme
const cbLcarsColors = {
  'cb-orange': '#FF9900',
  'cb-blue': '#9999FF',
  // ... etc.
};

// Load into CSS if not defined
Object.entries(cbLcarsColors).forEach(([name, value]) => {
  if (!getComputedStyle(document.documentElement).getPropertyValue(`--${name}`)) {
    document.documentElement.style.setProperty(`--${name}`, value);
  }
});
```

### B.1.3 Problems Identified

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

#### Problem 6: RulesEngine vs Token System Overlap

**Observation:** Unclear where dynamic styling logic should live.

```javascript
// Option 1: Dynamic logic in tokens (confusing)
colors: {
  dynamic: {
    entityState: computed((tokens, context) => {
      if (context.state === 'on') return green;  // Logic in token system?
    })
  }
}

// Option 2: Dynamic logic in RulesEngine (clear)
rules: [
  {
    when: { entity: 'light.desk', state: 'on' },
    then: { overlays: { text1: { style: { color: 'green' } } } }
  }
]
```

**Issue:** Overlap between computed tokens and RulesEngine capabilities.

### B.1.4 User Pain Points

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

## B.2 Proposed Architecture: Unified Token System

### B.2.1 Design Principles

1. **CSS Variable First**: Tokens reference CSS variables whenever possible
2. **HA-LCARS Compatible**: Integrate with existing HA-LCARS theme
3. **Legacy Support**: Support legacy CB-LCARS color system
4. **Semantic Naming**: Colors have meaning (accent, danger, info) not just names
5. **Cascade Hierarchy**: Theme → Pack → Overlay (with proper inheritance)
6. **Type Consistency**: All overlays use same token system
7. **Pack-First**: Themes are primarily distributed via packs
8. **Clear Separation**: Tokens for colors, RulesEngine for logic

### B.2.2 Token-Based Design System with CSS Variables

**Enhanced Token Structure (using CSS variables):**

```javascript
// src/msd/themes/tokens/defaultTokens.js

/**
 * Default MSD Design Tokens
 * 
 * Token values can be:
 * - CSS variable reference: 'var(--lcars-orange, #FF9900)'
 * - Direct color value: '#FF9900' (fallback only)
 * - JS variable reference: '${colors.primary}' (resolved at load time)
 * - Computed function: computed((tokens) => { ... }) - COLOR MANIPULATION ONLY
 * 
 * IMPORTANT: Computed tokens should ONLY handle color manipulation.
 * All conditional logic (entity states, thresholds, time-based) should use RulesEngine.
 */
export const defaultTokens = {
  // ===== COLORS =====
  colors: {
    // Semantic colors (reference HA-LCARS theme variables)
    accent: {
      primary: 'var(--lcars-orange, #FF9900)',      // HA-LCARS primary
      secondary: 'var(--lcars-blue, #9999FF)',      // HA-LCARS secondary
      tertiary: 'var(--lcars-purple, #CC99CC)'      // HA-LCARS tertiary
    },
    
    // Status colors (HA-LCARS compatible)
    status: {
      info: 'var(--lcars-blue, #9999FF)',
      success: 'var(--lcars-green, #99CC99)',
      warning: 'var(--lcars-orange, #FF9900)',
      danger: 'var(--lcars-red, #CC6666)',
      unknown: 'var(--lcars-gray, #999999)'
    },
    
    // UI element colors (use HA theme or LCARS fallback)
    ui: {
      background: 'var(--lcars-black, var(--primary-background-color, #000000))',
      foreground: 'var(--lcars-white, var(--primary-text-color, #FFFFFF))',
      border: 'var(--lcars-gray, var(--divider-color, #999999))',
      disabled: 'var(--disabled-text-color, #666666)'
    },
    
    // Chart-specific colors (multi-series)
    chart: {
      series: [
        'var(--lcars-orange, #FF9900)',
        'var(--lcars-blue, #9999FF)',
        'var(--lcars-yellow, #FFCC99)',
        'var(--lcars-purple, #CC99CC)',
        'var(--lcars-green, #99CC99)',
        'var(--lcars-red, #CC6666)'
      ],
      grid: 'var(--lcars-gray, #999999)',
      axis: 'var(--lcars-white, #FFFFFF)'
    }
  },
  
  // ===== TYPOGRAPHY =====
  typography: {
    // Font families (HA theme compatible)
    fontFamily: {
      primary: 'var(--lcars-font-family, var(--primary-font-family, Antonio, Helvetica Neue, sans-serif))',
      monospace: 'var(--code-font-family, Courier New, monospace)'
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
    // Spacing scale (viewBox-relative by default)
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

### B.2.3 Legacy CB-LCARS Color Integration

**Automatic CSS Variable Loading:**

```javascript
// src/msd/themes/ColorVariableLoader.js

/**
 * @fileoverview ColorVariableLoader - Ensures CB-LCARS color variables exist
 * 
 * Loads legacy CB-LCARS colors as CSS variables if not already defined by HA-LCARS theme.
 * This ensures backwards compatibility while preferring HA-LCARS theme colors when available.
 * 
 * @module msd/themes/ColorVariableLoader
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * ColorVariableLoader - Ensures CB-LCARS color variables exist
 * Loads legacy CB-LCARS colors as CSS variables if not already defined by HA-LCARS theme
 */
export class ColorVariableLoader {
  /**
   * Legacy CB-LCARS color definitions
   * Used as fallbacks if HA-LCARS theme doesn't provide them
   * 
   * @type {Object<string, string>}
   * @static
   */
  static legacyColors = {
    // Primary LCARS colors
    'lcars-orange': '#FF9900',
    'lcars-blue': '#9999FF',
    'lcars-purple': '#CC99CC',
    'lcars-yellow': '#FFCC99',
    'lcars-red': '#CC6666',
    'lcars-green': '#99CC99',
    'lcars-gray': '#999999',
    'lcars-white': '#FFFFFF',
    'lcars-black': '#000000',
    
    // Extended CB-LCARS colors
    'lcars-dark-gray': '#666666',
    'lcars-light-gray': '#CCCCCC',
    'lcars-cyan': '#99CCCC',
    'lcars-gold': '#FFCC66',
    'lcars-pink': '#CC99CC',
    
    // CB-LCARS font family
    'lcars-font-family': 'Antonio, Helvetica Neue, sans-serif'
  };

  /**
   * Load CB-LCARS colors as CSS variables if not already defined
   * 
   * @param {Element} [rootElement=document.documentElement] - Root element to apply variables to
   * @returns {number} Number of variables loaded
   */
  static loadColorVariables(rootElement = document.documentElement) {
    const computedStyle = getComputedStyle(rootElement);
    let loadedCount = 0;

    Object.entries(this.legacyColors).forEach(([name, value]) => {
      const varName = `--${name}`;
      
      // Check if variable already exists (from HA-LCARS theme)
      const existingValue = computedStyle.getPropertyValue(varName).trim();
      
      if (!existingValue) {
        // Variable doesn't exist, load CB-LCARS fallback
        rootElement.style.setProperty(varName, value);
        loadedCount++;
      }
    });

    if (loadedCount > 0) {
      cblcarsLog.debug(`[ColorVariableLoader] Loaded ${loadedCount} CB-LCARS color variables as fallbacks`);
    } else {
      cblcarsLog.debug('[ColorVariableLoader] HA-LCARS theme provides all color variables, no fallbacks needed');
    }

    return loadedCount;
  }

  /**
   * Get color value (with CSS variable resolution)
   * 
   * @param {string} colorName - Color name (with or without '--' prefix)
   * @param {Element} [rootElement=document.documentElement] - Root element to resolve from
   * @returns {string} Resolved color value
   */
  static getColor(colorName, rootElement = document.documentElement) {
    const varName = colorName.startsWith('--') ? colorName : `--${colorName}`;
    const computedStyle = getComputedStyle(rootElement);
    const value = computedStyle.getPropertyValue(varName).trim();
    
    return value || this.legacyColors[colorName.replace('--', '')] || colorName;
  }

  /**
   * Check if a color variable is defined
   * 
   * @param {string} colorName - Color name
   * @param {Element} [rootElement=document.documentElement] - Root element to check
   * @returns {boolean} True if variable exists
   */
  static hasColor(colorName, rootElement = document.documentElement) {
    const varName = colorName.startsWith('--') ? colorName : `--${colorName}`;
    const computedStyle = getComputedStyle(rootElement);
    return !!computedStyle.getPropertyValue(varName).trim();
  }

  /**
   * List all available color variables
   * 
   * @param {Element} [rootElement=document.documentElement] - Root element to check
   * @returns {Object<string, string>} Map of color names to values
   */
  static listColors(rootElement = document.documentElement) {
    const colors = {};
    const computedStyle = getComputedStyle(rootElement);

    Object.keys(this.legacyColors).forEach(name => {
      const varName = `--${name}`;
      const value = computedStyle.getPropertyValue(varName).trim();
      colors[name] = value || this.legacyColors[name];
    });

    return colors;
  }
}
```

**Integration with MSD Initialization:**

```javascript
// src/msd/pipeline/MsdPipeline.js (enhancement)

import { ColorVariableLoader } from '../themes/ColorVariableLoader.js';

export class MsdPipeline {
  /**
   * Initialize MSD pipeline
   * 
   * @param {Object} config - MSD configuration
   * @param {Object} hass - Home Assistant object
   * @param {Element} mountEl - Mount element (shadow root or container)
   */
  async initialize(config, hass, mountEl) {
    // ADDED: Load CB-LCARS color variables early
    ColorVariableLoader.loadColorVariables(mountEl);
    
    cblcarsLog.debug('[MsdPipeline] CB-LCARS color variables loaded');
    
    // ... existing initialization
  }
}
```

### B.2.4 Enhanced Token Resolution with CSS Variables

**ThemeTokenResolver** - Enhanced to resolve CSS variables:

```javascript
// src/msd/themes/ThemeTokenResolver.js

/**
 * @fileoverview ThemeTokenResolver - Resolves design tokens with CSS variable support
 * 
 * Provides consistent token access across all MSD components with support for:
 * - CSS variable references (var(--name, fallback))
 * - Token path references (colors.accent.primary)
 * - Computed tokens (color manipulation only)
 * - Responsive tokens (viewBox-aware)
 * 
 * @module msd/themes/ThemeTokenResolver
 */

import { ColorVariableLoader } from './ColorVariableLoader.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * ThemeTokenResolver - Resolves design tokens with CSS variable support
 * Provides consistent token access across all MSD components
 */
export class ThemeTokenResolver {
  /**
   * Create a ThemeTokenResolver instance
   * 
   * @param {Object} tokens - Design tokens object
   * @param {Element} [rootElement=null] - Root element for CSS variable resolution
   */
  constructor(tokens, rootElement = null) {
    this.tokens = tokens || {};
    this.rootElement = rootElement || document.documentElement;
  }

  /**
   * Resolve a token path to its value (with CSS variable resolution)
   * 
   * @param {string} path - Dot notation path (e.g., 'colors.accent.primary')
   * @param {*} [fallback=null] - Fallback value if token not found
   * @param {Object} [context={}] - Resolution context (viewBox, etc.)
   * @returns {*} Resolved token value
   */
  resolve(path, fallback = null, context = {}) {
    if (!path) return fallback;

    // Handle direct values (not token references)
    if (!this._isTokenReference(path)) {
      return this._resolveDirectValue(path, context);
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
      return this.resolve(value, fallback, context);
    }

    // If value is a computed function, execute it
    if (value && typeof value === 'object' && value._computed) {
      return value._computed(this.tokens, context);
    }

    // Resolve the final value (may be CSS variable)
    return this._resolveDirectValue(value, context);
  }

  /**
   * Resolve direct value (CSS variable, hex, computed)
   * 
   * @private
   * @param {*} value - Value to resolve
   * @param {Object} context - Resolution context
   * @returns {*} Resolved value
   */
  _resolveDirectValue(value, context = {}) {
    if (!value) return value;

    // Handle CSS variables
    if (typeof value === 'string' && value.startsWith('var(')) {
      return this._resolveCssVariable(value);
    }

    // Handle computed values (color manipulation only)
    if (value && typeof value === 'object' && value._computed) {
      return value._computed(this.tokens, context);
    }

    // Handle responsive values (viewBox-aware)
    if (value && typeof value === 'object' && value.responsive) {
      return this._resolveResponsiveValue(value, context);
    }

    // Return as-is (direct color, number, etc.)
    return value;
  }

  /**
   * Resolve CSS variable to computed value
   * 
   * @private
   * @param {string} cssVar - CSS variable (e.g., 'var(--lcars-orange, #FF9900)')
   * @returns {string} Resolved CSS variable value
   */
  _resolveCssVariable(cssVar) {
    try {
      // Parse var(--name, fallback) syntax
      const match = cssVar.match(/var\(([^,)]+)(?:,\s*([^)]+))?\)/);
      if (!match) return cssVar;

      const [, varName, fallback] = match;
      
      // Get computed value from CSS
      const computedStyle = getComputedStyle(this.rootElement);
      const resolved = computedStyle.getPropertyValue(varName).trim();

      if (resolved) {
        return resolved;
      }

      // Try fallback if provided
      if (fallback) {
        // Fallback might itself be a CSS variable
        if (fallback.trim().startsWith('var(')) {
          return this._resolveCssVariable(fallback.trim());
        }
        return fallback.trim();
      }

      // No value found, return original
      return cssVar;
    } catch (e) {
      cblcarsLog.warn('[ThemeTokenResolver] Failed to resolve CSS variable:', cssVar, e);
      return cssVar;
    }
  }

  /**
   * Resolve responsive value based on context
   * 
   * @private
   * @param {Object} value - Responsive value object
   * @param {Object} context - Resolution context with viewBox
   * @returns {*} Resolved value for current context
   */
  _resolveResponsiveValue(value, context) {
    const { viewBox } = context;
    
    if (!viewBox || !Array.isArray(viewBox) || viewBox.length < 3) {
      // No viewBox context, use default
      return value.responsive.default || value.responsive.medium || value.responsive.base;
    }

    const viewBoxWidth = viewBox[2];

    // Match viewBox width to breakpoints
    if (viewBoxWidth < 400 && value.responsive.small) {
      return value.responsive.small;
    } else if (viewBoxWidth >= 400 && viewBoxWidth < 800 && value.responsive.medium) {
      return value.responsive.medium;
    } else if (viewBoxWidth >= 800 && value.responsive.large) {
      return value.responsive.large;
    }

    // Fallback to default
    return value.responsive.default || value.responsive.medium || value.responsive.base;
  }

  /**
   * Resolve multiple token paths
   * 
   * @param {Object<string, string>} paths - Object with keys and token paths
   * @param {Object} [context={}] - Resolution context
   * @returns {Object} Resolved values
   */
  resolveMany(paths, context = {}) {
    const resolved = {};
    for (const [key, path] of Object.entries(paths)) {
      resolved[key] = this.resolve(path, null, context);
    }
    return resolved;
  }

  /**
   * Check if string is a token reference
   * 
   * @private
   * @param {*} value - Value to check
   * @returns {boolean} True if value is a token reference
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
   * Get all tokens for a component type (with CSS variable resolution)
   * 
   * @param {string} componentType - Component type (e.g., 'text', 'chart')
   * @param {Object} [context={}] - Resolution context
   * @returns {Object} Resolved component tokens
   */
  getComponentTokens(componentType, context = {}) {
    const componentPath = `components.${componentType}`;
    const componentTokens = this.resolve(componentPath, {});

    // Resolve all nested token references
    const resolved = {};
    for (const [key, value] of Object.entries(componentTokens)) {
      resolved[key] = this.resolve(value, null, context);
    }

    return resolved;
  }

  /**
   * Create a scoped resolver for a component
   * 
   * @param {string} componentType - Component type
   * @returns {Function} Scoped resolve function
   */
  forComponent(componentType) {
    return (tokenPath, fallback = null, context = {}) => {
      // Try component-specific token first
      const componentToken = this.resolve(`components.${componentType}.${tokenPath}`, null, context);
      if (componentToken !== null) {
        return componentToken;
      }

      // Fall back to global token
      return this.resolve(tokenPath, fallback, context);
    };
  }
}

// Singleton instance
export const themeTokenResolver = new ThemeTokenResolver();
```

---

## B.3 Palette System Removal

### B.3.1 Deprecation Notice

**DECISION:** Remove palette system completely.

**Rationale:**
1. ❌ Palettes are defined but not used by any components
2. ❌ Redundant with new token system
3. ❌ Adds unnecessary abstraction layer
4. ✅ CSS variables provide better solution
5. ✅ Token system provides semantic naming

### B.3.2 Removal Plan

**Files to Modify:**

```javascript
// src/msd/packs/loadBuiltinPacks.js (remove palettes)

const builtinPack = {
  id: 'builtin',
  version: '1.0.0',
  
  // Existing properties
  profiles: [ /* ... */ ],
  overlays: [ /* ... */ ],
  
  // REMOVED: palettes property
  // palettes: { ... },  // DELETE THIS
  
  // NEW: Use themes with tokens instead
  themes: {
    'lcars-classic': {
      tokens: { /* ... */ }
    }
  }
};
```

**Search and Replace:**

```bash
# Find all palette references
grep -r "\.palettes\[" src/msd/
grep -r "pack\.palettes" src/msd/

# Expected result: Only in pack definitions, not in rendering code
```

**Migration Path:**

```javascript
// For any code that referenced palettes:

// OLD (palettes - REMOVE)
const color = pack.palettes.default.accent1;

// NEW (tokens)
const color = themeTokenResolver.resolve('colors.accent.primary');
```

### B.3.3 Backwards Compatibility

**No compatibility needed** - palettes were never actually used in rendering code.

**Action:** Safe to remove completely from:
- Pack definitions (`loadBuiltinPacks.js`)
- Pack structure documentation
- Any references in comments or docs

---

## B.4 Advanced Features (Enhanced)

### B.4.1 Responsive Tokens with ViewBox Integration

**Concept:** Tokens that adapt to viewBox dimensions, integrating with existing scaling system.

#### Responsive Token Definition

```javascript
// Responsive token using viewBox breakpoints
const tokens = {
  typography: {
    fontSize: {
      // Responsive font size that scales with viewBox
      base: {
        responsive: {
          small: 12,   // viewBox width < 400
          medium: 14,  // viewBox width 400-800
          large: 16,   // viewBox width > 800
          default: 14  // Fallback
        }
      },
      
      // Static value (non-responsive)
      xs: 10
    }
  },
  
  spacing: {
    // Responsive spacing that scales with viewBox
    gap: {
      base: {
        responsive: {
          small: 2,
          medium: 4,
          large: 6,
          default: 4
        }
      }
    }
  }
};
```

#### Integration with ViewBox Scaling

**Use Case:** Text overlay font size that adapts to MSD size.

```javascript
// src/msd/renderer/TextOverlayRenderer.js (using responsive tokens)

import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';

export class TextOverlayRenderer {
  static render(overlay, anchors, viewBox, container, cardInstance) {
    const style = overlay.finalStyle || overlay.style || {};
    const resolveToken = themeTokenResolver.forComponent('text');
    
    // Resolve font size with viewBox context
    const fontSize = resolveToken(
      style.font_size || 'defaultSize',
      14,
      { viewBox }  // Pass viewBox for responsive resolution
    );
    
    // fontSize now adapts to viewBox size:
    // - Small MSD (300px wide): fontSize = 12
    // - Medium MSD (600px wide): fontSize = 14
    // - Large MSD (900px wide): fontSize = 16
    
    // ... render with responsive fontSize
  }
}
```

#### Advanced: ViewBox-Relative Scaling

**Concept:** Combine responsive breakpoints with viewBox-relative scaling.

```javascript
const tokens = {
  spacing: {
    padding: {
      // Scales relative to viewBox size
      viewBoxRelative: {
        _computed: (tokens, context) => {
          if (!context.viewBox) return 8;
          
          const [, , width, height] = context.viewBox;
          const referenceSize = Math.min(width, height);
          
          // Scale padding based on viewBox size
          // 1% of reference size
          return referenceSize * 0.01;
        }
      }
    }
  }
};
```

**Integration with DefaultsManager:**

```javascript
// DefaultsManager already does viewBox scaling
// Tokens can reference these calculations

const tokens = {
  spacing: {
    // Use existing DefaultsManager scaling logic
    viewBoxScaled: {
      _computed: (tokens, context) => {
        const { viewBox, defaultsManager } = context;
        
        if (defaultsManager) {
          // Use DefaultsManager's scaling
          return defaultsManager.resolve('text.status_indicator.padding', {
            viewBox,
            scaleMode: 'viewbox'
          });
        }
        
        return 8; // Fallback
      }
    }
  }
};
```

**User-Facing YAML:**

```yaml
overlays:
  - id: adaptive_text
    type: text
    content: "SHIELDS"
    position: [50, 100]
    style:
      # Font size automatically adapts to viewBox
      font_size: "typography.fontSize.base"  # Responsive token
      
      # Padding scales with viewBox
      padding: "spacing.padding.viewBoxRelative"  # Computed token
```

### B.4.2 Computed Tokens (Color Manipulation Only)

**IMPORTANT:** Computed tokens should **ONLY** handle **static color manipulation**, not dynamic logic.

**Purpose:** Derive color variations from base colors without duplicating hex codes.

**Scope:** 
- ✅ Color manipulation (darken, lighten, alpha, saturate, mix)
- ❌ Entity state checks (use RulesEngine)
- ❌ Threshold detection (use RulesEngine)
- ❌ Time-based logic (use RulesEngine)
- ❌ Any conditional behavior (use RulesEngine)

#### Color Manipulation Utilities

```javascript
// src/msd/themes/ColorUtils.js

/**
 * @fileoverview ColorUtils - Utilities for color manipulation
 * 
 * Provides color transformation functions for use in computed tokens.
 * Supports hex, rgb, rgba, hsl, and CSS variable color formats.
 * 
 * @module msd/themes/ColorUtils
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * ColorUtils - Utilities for color manipulation
 * Supports hex, rgb, rgba, hsl, and CSS variables
 */
export class ColorUtils {
  /**
   * Darken a color by percentage
   * 
   * @param {string} color - Color value (hex, rgb, or CSS variable)
   * @param {number} [percent=0.2] - Percentage to darken (0-1)
   * @returns {string} Darkened color
   * 
   * @example
   * ColorUtils.darken('#FF9900', 0.2) // Returns 'rgb(204, 122, 0)'
   * ColorUtils.darken('var(--lcars-orange)', 0.3) // Returns darkened orange
   */
  static darken(color, percent = 0.2) {
    const rgb = this._parseColor(color);
    if (!rgb) return color;

    const darkened = rgb.map(val => Math.max(0, Math.floor(val * (1 - percent))));
    return `rgb(${darkened.join(', ')})`;
  }

  /**
   * Lighten a color by percentage
   * 
   * @param {string} color - Color value
   * @param {number} [percent=0.2] - Percentage to lighten (0-1)
   * @returns {string} Lightened color
   * 
   * @example
   * ColorUtils.lighten('#FF9900', 0.2) // Returns 'rgb(255, 173, 51)'
   */
  static lighten(color, percent = 0.2) {
    const rgb = this._parseColor(color);
    if (!rgb) return color;

    const lightened = rgb.map(val => Math.min(255, Math.floor(val + (255 - val) * percent)));
    return `rgb(${lightened.join(', ')})`;
  }

  /**
   * Adjust alpha/opacity of a color
   * 
   * @param {string} color - Color value
   * @param {number} [alpha=1.0] - Alpha value (0-1)
   * @returns {string} Color with alpha
   * 
   * @example
   * ColorUtils.alpha('#FF9900', 0.5) // Returns 'rgba(255, 153, 0, 0.5)'
   */
  static alpha(color, alpha = 1.0) {
    const rgb = this._parseColor(color);
    if (!rgb) return color;

    return `rgba(${rgb.join(', ')}, ${alpha})`;
  }

  /**
   * Saturate a color (increase saturation)
   * 
   * @param {string} color - Color value
   * @param {number} [percent=0.2] - Saturation increase (0-1)
   * @returns {string} Saturated color
   * 
   * @example
   * ColorUtils.saturate('#FF9900', 0.3) // Returns more vibrant orange
   */
  static saturate(color, percent = 0.2) {
    const hsl = this._rgbToHsl(this._parseColor(color));
    if (!hsl) return color;

    hsl[1] = Math.min(100, hsl[1] + (percent * 100));
    return this._hslToRgb(hsl);
  }

  /**
   * Desaturate a color (move toward grayscale)
   * 
   * @param {string} color - Color value
   * @param {number} [percent=0.2] - Desaturation amount (0-1)
   * @returns {string} Desaturated color
   * 
   * @example
   * ColorUtils.desaturate('#FF9900', 0.5) // Returns muted orange
   */
  static desaturate(color, percent = 0.2) {
    const hsl = this._rgbToHsl(this._parseColor(color));
    if (!hsl) return color;

    hsl[1] = Math.max(0, hsl[1] - (percent * 100));
    return this._hslToRgb(hsl);
  }

  /**
   * Mix two colors
   * 
   * @param {string} color1 - First color
   * @param {string} color2 - Second color
   * @param {number} [weight=0.5] - Weight of first color (0-1)
   * @returns {string} Mixed color
   * 
   * @example
   * ColorUtils.mix('#FF9900', '#9999FF', 0.5) // Returns color halfway between
   */
  static mix(color1, color2, weight = 0.5) {
    const rgb1 = this._parseColor(color1);
    const rgb2 = this._parseColor(color2);
    if (!rgb1 || !rgb2) return color1;

    const mixed = rgb1.map((val, i) => 
      Math.floor(val * weight + rgb2[i] * (1 - weight))
    );
    return `rgb(${mixed.join(', ')})`;
  }

  /**
   * Parse color to RGB array
   * 
   * @private
   * @param {string} color - Color value
   * @returns {Array<number>|null} [r, g, b] or null
   */
  static _parseColor(color) {
    if (!color) return null;

    // Resolve CSS variable first
    if (color.startsWith('var(')) {
      const resolved = this._resolveCssVariable(color);
      color = resolved;
    }

    // Hex color
    if (color.startsWith('#')) {
      return this._hexToRgb(color);
    }

    // RGB/RGBA color
    if (color.startsWith('rgb')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
      }
    }

    return null;
  }

  /**
   * Convert hex to RGB
   * 
   * @private
   * @param {string} hex - Hex color
   * @returns {Array<number>|null} [r, g, b]
   */
  static _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : null;
  }

  /**
   * Convert RGB to HSL
   * 
   * @private
   * @param {Array<number>} rgb - [r, g, b]
   * @returns {Array<number>} [h, s, l]
   */
  static _rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return [h * 360, s * 100, l * 100];
  }

  /**
   * Convert HSL to RGB
   * 
   * @private
   * @param {Array<number>} hsl - [h, s, l]
   * @returns {string} RGB color string
   */
  static _hslToRgb([h, s, l]) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  }

  /**
   * Resolve CSS variable
   * 
   * @private
   * @param {string} cssVar - CSS variable string
   * @returns {string} Resolved color
   */
  static _resolveCssVariable(cssVar) {
    try {
      const match = cssVar.match(/var\(([^,)]+)(?:,\s*([^)]+))?\)/);
      if (!match) return cssVar;

      const [, varName, fallback] = match;
      const computedStyle = getComputedStyle(document.documentElement);
      const resolved = computedStyle.getPropertyValue(varName).trim();

      return resolved || fallback || cssVar;
    } catch (e) {
      return cssVar;
    }
  }
}
```

#### Computed Token Definitions (Color Manipulation Only)

```javascript
// src/msd/themes/tokens/lcarsClassicTokens.js (excerpt)

import { ColorUtils } from '../ColorUtils.js';

export const lcarsClassicTokens = {
  colors: {
    accent: {
      primary: 'var(--lcars-orange, #FF9900)',
      
      // ✅ GOOD: Static color manipulation
      primaryDark: {
        _computed: (tokens) => {
          // Always 20% darker, no conditions
          return ColorUtils.darken(tokens.colors.accent.primary, 0.2);
        }
      },
      
      primaryLight: {
        _computed: (tokens) => {
          // Always 20% lighter, no conditions
          return ColorUtils.lighten(tokens.colors.accent.primary, 0.2);
        }
      },
      
      primaryAlpha: {
        _computed: (tokens) => {
          // Always 30% opacity, no conditions
          return ColorUtils.alpha(tokens.colors.accent.primary, 0.3);
        }
      }
    },
    
    alert: {
      base: 'var(--lcars-red, #CC6666)',
      
      // ✅ GOOD: Consistent color derivations
      critical: {
        _computed: (tokens) => {
          // Always brighter/saturated, no conditions
          return ColorUtils.saturate(
            ColorUtils.lighten(tokens.colors.alert.base, 0.1),
            0.3
          );
        }
      },
      
      warning: {
        _computed: (tokens) => {
          // Always orange mix, no conditions
          return ColorUtils.mix(
            tokens.colors.alert.base,
            tokens.colors.status.warning,
            0.6
          );
        }
      },
      
      caution: {
        _computed: (tokens) => {
          // Always muted, no conditions
          return ColorUtils.desaturate(
            ColorUtils.darken(tokens.colors.alert.base, 0.1),
            0.2
          );
        }
      }
    },
    
    // ❌ BAD: Don't do this - use RulesEngine
    // dynamic: {
    //   entityState: {
    //     _computed: (tokens, context) => {
    //       // DON'T: Conditional logic belongs in RulesEngine
    //       if (context.entityState === 'on') return green;
    //       if (context.entityState === 'off') return gray;
    //     }
    //   }
    // }
  }
};
```

---

## B.5 Integration with RulesEngine

### B.5.1 Clear Separation of Concerns

**Design Principle:** Tokens provide colors, RulesEngine provides logic.

| Concern | Owner | Example |
|---------|-------|---------|
| **Color definitions** | Tokens | Base colors from CSS variables |
| **Color manipulation** | Computed Tokens | Darker/lighter/mixed variants |
| **Dynamic logic** | RulesEngine | If temp > 30, use red |
| **User control** | YAML Config | Define rules and reference tokens |

### B.5.2 Pattern: Tokens + RulesEngine

**✅ Recommended Pattern:**

1. Define base colors in tokens (from CSS variables)
2. Define color variants in computed tokens (static manipulation)
3. Apply colors conditionally using RulesEngine

### B.5.3 Example: Entity State Colors

**❌ Don't use computed tokens for entity state logic:**

```javascript
// DON'T DO THIS
const tokens = {
  colors: {
    dynamic: {
      entityState: {
        _computed: (tokens, context) => {
          // BAD: Logic in token system
          if (context.entityState === 'on') return green;
          if (context.entityState === 'off') return gray;
        }
      }
    }
  }
};
```

**✅ Use RulesEngine:**

```yaml
# Define overlay with default color
overlays:
  - id: status_text
    content: "SYSTEM STATUS"
    style:
      color: "colors.status.info"  # Default blue

# Use RulesEngine for conditional logic
rules:
  - id: status_color_on
    when:
      all:
        - entity: light.desk
          state: "on"
    then:
      overlays:
        status_text:
          style:
            color: "colors.status.success"  # Green when on

  - id: status_color_off
    when:
      all:
        - entity: light.desk
          state: "off"
    then:
      overlays:
        status_text:
          style:
            color: "colors.status.unknown"  # Gray when off

  - id: status_color_unavailable
    when:
      all:
        - entity: light.desk
          state: "unavailable"
    then:
      overlays:
        status_text:
          style:
            color: "colors.status.danger"  # Red when unavailable
```

### B.5.4 Example: Temperature Thresholds

**❌ Don't use computed tokens for threshold logic:**

```javascript
// DON'T DO THIS
const tokens = {
  colors: {
    temperature: {
      gradient: {
        _computed: (tokens, context) => {
          // BAD: Threshold logic in tokens
          if (context.temperature < 15) return blue;
          if (context.temperature < 25) return green;
          if (context.temperature < 35) return orange;
          return red;
        }
      }
    }
  }
};
```

**✅ Use RulesEngine:**

```yaml
# Define overlay with default color
overlays:
  - id: temp_display
    source: temperature
    content: "{temperature}°C"
    style:
      color: "colors.status.info"  # Default blue

# Use RulesEngine for threshold logic
rules:
  - id: temp_cold
    when:
      all:
        - entity: temperature
          below: 15
    then:
      overlays:
        temp_display:
          style:
            color: "colors.accent.primaryLight"  # Light blue (computed)

  - id: temp_comfortable
    when:
      all:
        - entity: temperature
          above: 15
        - entity: temperature
          below: 25
    then:
      overlays:
        temp_display:
          style:
            color: "colors.status.success"  # Green

  - id: temp_warm
    when:
      all:
        - entity: temperature
          above: 25
        - entity: temperature
          below: 35
    then:
      overlays:
        temp_display:
          style:
            color: "colors.status.warning"  # Orange

  - id: temp_hot
    when:
      all:
        - entity: temperature
          above: 35
    then:
      overlays:
        temp_display:
          style:
            color: "colors.alert.critical"  # Bright red (computed)
```

### B.5.5 Example: Alert Levels (Combined Pattern)

**✅ Good pattern - RulesEngine for logic, computed tokens for color variants:**

```yaml
# Define overlay
overlays:
  - id: warp_core_status
    content: "WARP CORE"
    style:
      color: "colors.status.success"  # Default green
      font_size: "typography.fontSize.lg"

# Use RulesEngine for conditional styling
rules:
  - id: warp_core_normal
    when:
      all:
        - entity: sensor.warp_core_temp
          below: 1000
    then:
      overlays:
        warp_core_status:
          style:
            color: "colors.status.success"  # Green
            font_size: "typography.fontSize.lg"

  - id: warp_core_warning
    when:
      all:
        - entity: sensor.warp_core_temp
          above: 1000
        - entity: sensor.warp_core_temp
          below: 1500
    then:
      overlays:
        warp_core_status:
          style:
            color: "colors.alert.warning"  # Orange (computed mix)
            font_size: "typography.fontSize.xl"

  - id: warp_core_critical
    when:
      all:
        - entity: sensor.warp_core_temp
          above: 1500
    then:
      overlays:
        warp_core_status:
          style:
            color: "colors.alert.critical"  # Bright red (computed)
            font_size: "typography.fontSize.2xl"
```

**Why This Works:**

1. **Tokens** provide the color palette (CSS variables)
2. **Computed Tokens** derive consistent variations (brighter, mixed)
3. **RulesEngine** applies them conditionally based on entity state
4. **User** controls all logic in declarative YAML

### B.5.6 Benefits of This Approach

#### ✅ No Logic Duplication

- Computed tokens: **Static** color math
- RulesEngine: **Dynamic** conditional logic
- No overlap, complementary systems

#### ✅ User Empowerment

Users can:
1. Use tokens for consistent colors
2. Use computed tokens for automatic variants
3. Use RulesEngine for all conditional behavior
4. Combine them flexibly

#### ✅ Maintainability

- Tokens: Simple, predictable color derivations
- RulesEngine: All business logic in one place
- No confusion about where to put logic

#### ✅ Clear Documentation

Easy to document and understand:
- "Want different colors based on state? Use RulesEngine."
- "Want lighter shade of accent? Use computed token."

---

## B.6 Component Token Integration

### B.6.1 Renderer Token Resolution

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
    
    // Resolve font size with token support (responsive)
    const fontSize = resolveToken(
      style.font_size || 'defaultSize',
      14,  // Final fallback
      { viewBox }  // Pass viewBox for responsive resolution
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
    
    // Note: Status-specific colors handled by RulesEngine, not computed tokens
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
    