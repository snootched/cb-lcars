# Complete Pack System Consolidation - Implementation Plan 🚀

Perfect! Let's go with the KISS principle and do this right. No backward compatibility, no migration patterns - clean slate refactoring.

---

## **Implementation Order** 📋

### **Phase 1: Delete Deprecated Systems** 🗑️
1. Delete ProfileResolver
2. Delete DefaultsManager
3. Delete ValueMapResolver (if not needed)

### **Phase 2: Restructure Pack Schema** 📦
4. Remove `profiles` from pack structure
5. Flatten `style_presets` structure
6. Expand theme `components` tokens

### **Phase 3: Create Consolidated System** 🏗️
7. Create `ThemeManager` (replaces DefaultsManager)
8. Refactor `StylePresetManager` (simplified)
9. Create `PackContext` coordinator
10. Update `SystemsManager` integration

### **Phase 4: Update Consumers** 🔄
11. Update overlay renderers to use theme tokens
12. Update style preset references
13. Clean up imports across codebase

---

## **Phase 1: Delete Deprecated Systems** 🗑️

### **Step 1.1: Delete ProfileResolver**

**Files to delete:**
```bash
rm src/msd/profile/ProfileResolver.js
```

**Files to modify:**

#### **src/msd/pipeline/ModelBuilder.js**# Perfect! Let's Execute This Clean Refactor 🚀

I've drafted an issue to track this refactor. Perfect answers - this will dramatically simplify your codebase!

## **Refactor Plan: KISS Principles** 🎯

Since we don't need backward compatibility, we can do aggressive cleanup. Here's the execution order:

---

## **PHASE 1: DELETE Legacy Systems** 🗑️

### **Step 1.1: Remove Profiles Entirely**

**Files to DELETE:**
```bash
rm src/msd/profile/ProfileResolver.js
rm src/msd/profile/ValueMapResolver.js  # If unused elsewhere
```

**Files to MODIFY:**

#### **A. loadBuiltinPacks.js**
Remove all `profiles` arrays from pack definitions:

```javascript
// DELETE entire profiles arrays from:
// - CORE_PACK
// - LCARS_FX_PACK
// - CB_LCARS_BUTTONS_PACK

// Profiles will be replaced by theme tokens
```

#### **B. mergePacks.js**
Remove profile processing:

```javascript
// DELETE from processSinglePass():
profiles: [],  // DELETE this line

// DELETE from processLayer():
// Remove entire profiles collection processing block
```

#### **C. ModelBuilder.js**
Remove ProfileResolver usage:

```javascript
// DELETE import:
import { globalProfileResolver } from '../profile/ProfileResolver.js';

// DELETE from constructor:
globalProfileResolver.loadProfiles(mergedConfig.profiles || []);

// DELETE from _assembleBaseOverlays():
// Replace profile resolution with theme token resolution
```

#### **D. SystemsManager.js**
Remove profile references:

```javascript
// DELETE any active_profiles tracking
// DELETE profile-related initialization
```

---

### **Step 1.2: Remove DefaultsManager**

**Files to DELETE:**
```bash
rm src/msd/pipeline/MsdDefaultsManager.js
rm src/msd/pipeline/MsdDefaultsExample.js
```

**Files to MODIFY:**

#### **A. SystemsManager.js**
```javascript
// DELETE import:
import { MsdDefaultsManager } from './MsdDefaultsManager.js';
import './MsdDefaultsExample.js';

// DELETE from constructor:
this.defaultsManager = new MsdDefaultsManager();

// DELETE from initializeSystemsWithPacksFirst():
// Remove all defaultsManager.loadFromPacks() calls

// DELETE from completeSystems():
this.defaultsManager = null;
```

#### **B. mergePacks.js**
```javascript
// REMOVE defaultsManager parameter:
export async function mergePacks(userConfig) {  // Remove 2nd param
  // DELETE DefaultsManager loading logic
}
```

---

## **PHASE 2: Expand Theme System** 🎨

### **Step 2.1: Enhance Token Structure**

Update all token files to include **component defaults**:

#### **src/msd/themes/tokens/lcarsClassicTokens.js**

```javascript
export const lcarsClassicTokens = {
  // ... existing colors, typography, spacing, borders, effects ...

  // ✅ EXPANDED: Component-specific defaults (replaces profiles + DefaultsManager)
  components: {
    text: {
      defaultSize: 'typography.fontSize.base',
      defaultColor: 'colors.ui.foreground',
      defaultFamily: 'typography.fontFamily.primary',
      defaultLineHeight: 'typography.lineHeight.normal',

      // Text decoration defaults (from old core_defaults profile)
      statusIndicator: {
        sizeRatio: 0.3,
        padding: 8,
        color: 'colors.status.success'
      },

      highlight: {
        padding: 2,
        opacity: 0.3
      },

      bracket: {
        width: 'borders.width.base',
        gap: 'spacing.gap.base',
        extension: 8,
        opacity: 'effects.opacity.base',
        physicalWidth: 8,
        height: '70%',
        radius: 'borders.radius.base',
        borderRadius: 'borders.radius.lg',
        innerFactor: 2
      },

      effects: {
        glow: {
          blur: 'effects.blur.sm',
          intensity: 1
        },
        shadow: {
          offsetX: 2,
          offsetY: 2,
          blur: 'effects.blur.sm',
          color: 'rgba(0,0,0,0.5)'
        }
      }
    },

    statusGrid: {
      defaultCellColor: 'colors.accent.primary',
      defaultGap: 'spacing.gap.sm',
      defaultRadius: 'borders.radius.base',

      // From old core_defaults profile
      rows: 3,
      columns: 4,
      cellGap: 'spacing.gap.sm',
      cellOpacity: 'effects.opacity.base',
      borderColor: 'colors.ui.border',
      borderWidth: 'borders.width.thin',
      unknownColor: 'colors.status.unknown',

      fontSize: 'typography.fontSize.sm',
      labelFontSize: 'typography.fontSize.lg',
      valueFontSize: 'typography.fontSize.base',
      fontFamily: 'typography.fontFamily.primary',
      fontWeight: 'typography.fontWeight.normal',
      labelColor: 'colors.ui.foreground',
      valueColor: 'colors.ui.foreground',

      textLayout: 'stacked',
      textAlignment: 'center',
      textJustify: 'center',
      labelPosition: 'center-top',
      valuePosition: 'center-bottom',
      textPadding: 'spacing.scale.4',
      textMargin: 'spacing.scale.1',
      maxTextWidth: '90%',
      textOverflow: 'ellipsis',

      // Status colors
      statusOnColor: 'colors.status.success',
      statusOffColor: 'colors.status.unknown',
      statusUnavailableColor: 'colors.status.danger',

      // LCARS features
      bracketColor: null,
      bracketWidth: 'borders.width.base',
      bracketGap: 'spacing.gap.base',
      bracketExtension: 8,
      bracketOpacity: 'effects.opacity.base',

      // Interaction
      hoverColor: 'colors.accent.secondary',
      hoverScale: 1.05,

      // Animation
      cascadeSpeed: 0,
      cascadeDirection: 'row',
      revealAnimation: false,
      pulseOnChange: false,

      // Performance
      updateThrottle: 100
    },

    sparkline: {
      defaultColor: 'colors.accent.primary',
      defaultStrokeWidth: 'borders.width.base',

      // From old core_defaults profile
      size: {
        width: 200,
        height: 60
      },
      opacity: 'effects.opacity.base',
      lineCap: 'round',
      lineJoin: 'round',
      miterLimit: 4,
      pathPrecision: 2,
      fillOpacity: 0.2,
      pointSize: 3,
      decimationThreshold: 1000,

      grid: {
        color: 'colors.chart.grid',
        opacity: 0.4,
        strokeWidth: 'borders.width.thin',
        horizontalCount: 3,
        verticalCount: 5
      },

      threshold: {
        color: 'colors.status.warning',
        width: 'borders.width.thin',
        opacity: 0.7
      },

      zeroLine: {
        color: 'colors.chart.grid',
        width: 'borders.width.thin',
        opacity: 0.5
      },

      bracket: {
        width: 'borders.width.base',
        gap: 'spacing.gap.sm',
        extension: 8,
        opacity: 'effects.opacity.base',
        physicalWidth: 8,
        radius: 'borders.radius.base',
        borderRadius: 'borders.radius.lg',
        innerFactor: 2
      },

      statusIndicator: {
        size: 4,
        offset: 4,
        color: 'colors.status.success'
      },

      scanLine: {
        duration: 3,
        width: 'borders.width.thin',
        opacity: 0.8
      },

      smoothing: {
        chaikinIterations: 2,
        bezierControlFactor: 0.5,
        constrainedControlFactor: 0.25,
        splineSegments: 10
      },

      valueLabel: {
        offsetX: 4,
        fontSizeRatio: 0.1,
        maxFontSize: 'typography.fontSize.sm',
        fontFamily: 'typography.fontFamily.primary'
      },

      status: {
        noSource: { color: 'colors.status.danger' },
        loading: { color: 'colors.status.info' },
        notFound: { color: 'colors.status.warning' },
        error: { color: 'colors.status.danger' },
        fontSizeRatio: 0.125,
        minWidthForSource: 120,
        strokeWidth: 'borders.width.base',
        opacity: 0.6
      }
    },

    overlay: {
      defaultPadding: 'spacing.scale.4'
    },

    line: {
      defaultColor: 'colors.accent.secondary',
      defaultWidth: 'borders.width.base'
    },

    button: {
      defaultColor: 'colors.accent.primary',
      defaultRadius: 'borders.radius.lg'
    },

    chart: {
      defaultColors: 'colors.chart.series',
      defaultStrokeWidth: 'borders.width.thick',
      gridColor: 'colors.chart.gridMuted'
    }
  }
};
```

**Apply same structure to:**
- `lcarsDs9Tokens.js`
- `lcarsVoyagerTokens.js`
- `lcarsHighContrastTokens.js`

---

### **Step 2.2: Create ThemeManager**

Create new `src/msd/themes/ThemeManager.js`:

```javascript
/**
 * @fileoverview ThemeManager - Central theme system management
 *
 * Replaces DefaultsManager and ProfileResolver with unified theme-based defaults.
 * All component defaults come from active theme's component tokens.
 *
 * @module msd/themes/ThemeManager
 */

import { ThemeTokenResolver, initializeTokenResolver, getTokenResolver } from './ThemeTokenResolver.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ThemeManager {
  constructor() {
    this.themes = new Map();
    this.activeThemeId = null;
    this.activeTheme = null;
    this.resolver = null;
    this.initialized = false;
  }

  /**
   * Initialize theme system from packs
   * @param {Array} packs - Loaded pack objects
   * @param {string} requestedThemeId - Theme ID to activate
   * @param {Element} [rootElement=null] - Root element for CSS variables
   */
  async initialize(packs, requestedThemeId = 'lcars-classic', rootElement = null) {
    cblcarsLog.debug('[ThemeManager] 🎨 Initializing theme system');

    // Load all themes from packs
    this.themes.clear();
    packs.forEach(pack => {
      if (pack.themes && typeof pack.themes === 'object') {
        Object.entries(pack.themes).forEach(([themeId, theme]) => {
          this.themes.set(themeId, {
            ...theme,
            packId: pack.id
          });
          cblcarsLog.debug(`[ThemeManager] Loaded theme: ${themeId} from pack: ${pack.id}`);
        });
      }
    });

    // Find default theme
    const defaultTheme = packs.find(pack => pack.defaultTheme);
    const fallbackThemeId = defaultTheme?.defaultTheme || 'lcars-classic';

    // Activate requested theme (or fallback)
    await this.activateTheme(requestedThemeId || fallbackThemeId, rootElement);

    this.initialized = true;
    cblcarsLog.info('[ThemeManager] ✅ Theme system initialized:', {
      themeCount: this.themes.size,
      activeTheme: this.activeThemeId,
      availableThemes: Array.from(this.themes.keys())
    });
  }

  /**
   * Activate a specific theme
   * @param {string} themeId - Theme ID to activate
   * @param {Element} [rootElement=null] - Root element for CSS variables
   */
  async activateTheme(themeId, rootElement = null) {
    const theme = this.themes.get(themeId);

    if (!theme) {
      cblcarsLog.error('[ThemeManager] Theme not found:', themeId);
      throw new Error(`Theme not found: ${themeId}`);
    }

    if (!theme.tokens) {
      cblcarsLog.error('[ThemeManager] Theme has no tokens:', themeId);
      throw new Error(`Theme has no tokens: ${themeId}`);
    }

    // Initialize token resolver with theme tokens
    initializeTokenResolver(theme.tokens, rootElement);
    this.resolver = getTokenResolver();

    // Load theme CSS file if specified
    if (theme.cssFile) {
      this._loadThemeCss(theme.cssFile, themeId);
    }

    this.activeThemeId = themeId;
    this.activeTheme = theme;

    cblcarsLog.info('[ThemeManager] ✅ Theme activated:', {
      id: themeId,
      name: theme.name,
      description: theme.description,
      tokenCount: this._countTokens(theme.tokens)
    });
  }

  /**
   * Get default value for a component property
   * Replaces DefaultsManager.getDefault()
   *
   * @param {string} componentType - Component type (e.g., 'text', 'statusGrid')
   * @param {string} property - Property name (e.g., 'defaultSize')
   * @param {*} [fallback=null] - Fallback value if not found
   * @param {Object} [context={}] - Resolution context
   * @returns {*} Resolved value
   *
   * @example
   * themeManager.getDefault('text', 'defaultSize')
   * // Returns: 14 (from theme's components.text.defaultSize token)
   */
  getDefault(componentType, property, fallback = null, context = {}) {
    if (!this.resolver) {
      cblcarsLog.warn('[ThemeManager] No resolver available - theme not initialized');
      return fallback;
    }

    const tokenPath = `components.${componentType}.${property}`;
    return this.resolver.resolve(tokenPath, fallback, context);
  }

  /**
   * Get component-scoped resolver
   * @param {string} componentType - Component type
   * @returns {Function} Scoped resolver function
   */
  forComponent(componentType) {
    if (!this.resolver) {
      throw new Error('ThemeManager not initialized - call initialize() first');
    }

    return this.resolver.forComponent(componentType);
  }

  /**
   * Get token resolver for direct token path resolution
   * @returns {ThemeTokenResolver} Token resolver instance
   */
  getResolver() {
    return this.resolver;
  }

  /**
   * Get active theme info
   * @returns {Object|null} Active theme object
   */
  getActiveTheme() {
    return this.activeTheme ? {
      id: this.activeThemeId,
      name: this.activeTheme.name,
      description: this.activeTheme.description,
      packId: this.activeTheme.packId
    } : null;
  }

  /**
   * List all available theme IDs
   * @returns {Array<string>} Theme IDs
   */
  listThemes() {
    return Array.from(this.themes.keys());
  }

  /**
   * Get theme details
   * @param {string} themeId - Theme ID
   * @returns {Object|null} Theme details
   */
  getTheme(themeId) {
    const theme = this.themes.get(themeId);
    return theme ? {
      id: themeId,
      name: theme.name,
      description: theme.description,
      packId: theme.packId,
      hasCssFile: !!theme.cssFile
    } : null;
  }

  /**
   * Load theme CSS file
   * @private
   */
  _loadThemeCss(cssFile, themeId) {
    try {
      // Check if already loaded
      const existingLink = document.querySelector(`link[data-theme-id="${themeId}"]`);
      if (existingLink) {
        cblcarsLog.debug('[ThemeManager] Theme CSS already loaded:', themeId);
        return;
      }

      // Create link element
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `/local/cb-lcars/themes/${cssFile}`;
      link.setAttribute('data-theme-id', themeId);

      document.head.appendChild(link);

      cblcarsLog.debug('[ThemeManager] Loaded theme CSS:', cssFile);
    } catch (error) {
      cblcarsLog.warn('[ThemeManager] Failed to load theme CSS:', cssFile, error);
    }
  }

  /**
   * Count tokens in theme
   * @private
   */
  _countTokens(tokens) {
    let count = 0;
    function countRecursive(obj) {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          countRecursive(obj[key]);
        } else {
          count++;
        }
      }
    }
    countRecursive(tokens);
    return count;
  }

  /**
   * Get debug info
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      initialized: this.initialized,
      activeTheme: this.getActiveTheme(),
      availableThemes: this.listThemes().map(id => this.getTheme(id)),
      resolverCacheSize: this.resolver?.resolutionCache?.size || 0
    };
  }
}

// Make globally accessible for debugging
if (typeof window !== 'undefined') {
  window.ThemeManager = ThemeManager;
}
```

---

## **PHASE 3: Restructure Style Presets** 🎨

### **Step 3.1: Update Pack Structure**

Modify `loadBuiltinPacks.js` to use generic preset structure:

```javascript
// CB-LCARS Button Styles Pack
const CB_LCARS_BUTTONS_PACK = {
  id: 'cb_lcars_buttons',
  version: '1.0.0',
  description: 'CB-LCARS button style presets',

  // ✅ RESTRUCTURED: Generic presets, not nested by overlay type
  style_presets: {
    button: {  // Generic button presets
      lozenge: {
        textLayout: 'diagonal',
        labelPosition: 'top-left',
        valuePosition: 'bottom-right',
        lcarsTextPreset: 'lozenge',
        cellRadius: 34,
        cellColor: 'var(--lcars-card-button)',
        cellGap: 8,
        normalizeRadius: false,
        lcarsCorners: false,
        textPadding: 14,
        textMargin: 3,
        labelFontSize: 18,
        valueFontSize: 18,
        labelColor: 'black',
        valueColor: 'black',
        fontFamily: 'Antonio',
        fontWeight: 'bold',
        showLabels: true,
        showValues: true,
        borderWidth: 0,
        borderColor: 'var(--lcars-gray)',
        cellOpacity: 0.9
      },

      bullet: {
        textLayout: 'side-by-side',
        labelPosition: 'left',
        valuePosition: 'right',
        cellRadius: 38,
        textPadding: 8,
        normalizeRadius: true,
        showLabels: true,
        showValues: true,
        lcarsTextPreset: 'bullet'
      },

      'picard-filled': {
        textLayout: 'stacked',
        labelPosition: 'south-east',
        valuePosition: 'south-east',
        cellRadius: 0,
        textPadding: 12,
        lcarsCorners: true,
        normalizeRadius: false,
        showLabels: true,
        showValues: true,
        lcarsTextPreset: 'corner'
      },

      badge: {
        textLayout: 'stacked',
        labelPosition: 'center-top',
        valuePosition: 'center',
        cellRadius: 16,
        textPadding: 8,
        normalizeRadius: true,
        showLabels: true,
        showValues: true,
        lcarsTextPreset: 'badge'
      },

      compact: {
        textLayout: 'stacked',
        labelPosition: 'center-top',
        valuePosition: 'center-bottom',
        cellRadius: 4,
        textPadding: 6,
        textMargin: 1,
        cellGap: 1,
        labelFontSize: 14,
        valueFontSize: 12,
        showLabels: true,
        showValues: true
      }
    }

    // Future: Add more generic preset categories
    // text: { heading: {...}, caption: {...} },
    // chart: { sensor: {...}, power: {...} }
  },

  anchors: {},
  routing: {}
};
```

---

### **Step 3.2: Update StylePresetManager**

Modify `src/msd/presets/StylePresetManager.js`:

```javascript
/**
 * Get a style preset
 *
 * @param {string} presetPath - Preset path (e.g., 'button.lozenge' or 'text.heading')
 * @returns {Object|null} Preset configuration or null if not found
 *
 * @example
 * stylePresetManager.getPreset('button.lozenge')
 * // Returns: { cellRadius: 34, textLayout: 'diagonal', ... }
 */
getPreset(presetPath) {
  if (!this.initialized) {
    cblcarsLog.warn('[StylePresetManager] ⚠️ Not initialized - call initialize() first');
    return null;
  }

  // Parse preset path: 'category.presetName'
  const [category, presetName] = presetPath.split('.');

  if (!category || !presetName) {
    cblcarsLog.warn('[StylePresetManager] Invalid preset path:', presetPath);
    return null;
  }

  const cacheKey = presetPath;

  // Check cache
  if (this.presetCache.has(cacheKey)) {
    const cached = this.presetCache.get(cacheKey);
    cblcarsLog.debug(`[StylePresetManager] ✅ Found preset ${presetPath} (cached from pack: ${cached.packId})`);
    return cached.preset;
  }

  // Search through packs
  for (const pack of this.loadedPacks) {
    if (pack.style_presets?.[category]?.[presetName]) {
      const preset = pack.style_presets[category][presetName];

      // Cache the result
      this.presetCache.set(cacheKey, { preset, packId: pack.id });

      cblcarsLog.debug(`[StylePresetManager] ✅ Found preset ${presetPath} in pack ${pack.id}`);
      return preset;
    }
  }

  cblcarsLog.debug(`[StylePresetManager] ❌ Preset ${presetPath} not found`);
  return null;
}

/**
 * Get all available presets for a category
 * @param {string} category - Preset category (e.g., 'button', 'text')
 * @returns {Array} Array of preset names
 */
getAvailablePresets(category) {
  const presets = new Set();

  for (const pack of this.loadedPacks) {
    if (pack.style_presets?.[category]) {
      Object.keys(pack.style_presets[category]).forEach(name => presets.add(name));
    }
  }

  return Array.from(presets);
}

/**
 * Get all available preset categories
 * @returns {Array} Array of category names
 */
getAvailableCategories() {
  const categories = new Set();

  for (const pack of this.loadedPacks) {
    if (pack.style_presets) {
      Object.keys(pack.style_presets).forEach(cat => categories.add(cat));
    }
  }

  return Array.from(categories);
}
```

---

## **PHASE 4: Update SystemsManager** ⚙️

Replace DefaultsManager with ThemeManager:

```javascript
// src/msd/pipeline/SystemsManager.js

import { ThemeManager } from '../themes/ThemeManager.js';
// DELETE: import { MsdDefaultsManager } from './MsdDefaultsManager.js';

export class SystemsManager {
  constructor() {
    // REPLACE DefaultsManager with ThemeManager
    this.themeManager = new ThemeManager();
    // DELETE: this.defaultsManager = new MsdDefaultsManager();

    this.stylePresetManager = new StylePresetManager();
    // ... rest of systems
  }

  async initializeSystemsWithPacksFirst(mergedConfig, mountEl, hass) {
    this.mergedConfig = mergedConfig;
    this._currentHass = hass;

    // Load packs
    const { loadBuiltinPacks } = await import('../packs/loadBuiltinPacks.js');
    const packNames = this._extractPackNames(mergedConfig);
    const packs = loadBuiltinPacks(packNames);

    // ✅ NEW: Initialize theme system FIRST (provides all defaults)
    await this.themeManager.initialize(
      packs,
      mergedConfig.theme || 'lcars-classic',
      mountEl
    );

    cblcarsLog.debug('[SystemsManager] ✅ Theme system initialized');

    // Initialize other systems
    await this.stylePresetManager.initialize(packs);
    await this._initializeDataSources(hass, mergedConfig);

    cblcarsLog.debug('[SystemsManager] ✅ Critical systems ready');
  }

  // ... rest of methods
}
```

---

## **PHASE 5: Update Overlay Rendering** 🖼️

Update overlay renderers to use ThemeManager instead of DefaultsManager:

### **Example: TextOverlayRenderer**

```javascript
// Before:
const fontSize = this.defaultsManager.getDefault('text', 'font_size');

// After:
const fontSize = this.systemsManager.themeManager.getDefault('text', 'defaultSize');

// Or use component-scoped resolver:
const resolveToken = this.systemsManager.themeManager.forComponent('text');
const fontSize = resolveToken('defaultSize');
```

---

## **Summary of Changes** 📊

| System | Action | Replacement |
|--------|--------|-------------|
| **Profiles** | ❌ DELETE | Theme component tokens |
| **ProfileResolver** | ❌ DELETE | ThemeManager |
| **DefaultsManager** | ❌ DELETE | ThemeManager |
| **Themes** | ✅ EXPAND | Add components.* tokens |
| **Style Presets** | ✅ REFACTOR | Generic categories |
| **ChartTemplates** | ✅ KEEP | No changes |

---

Would you like me to provide the complete file patches for any specific phase? I can give you:

1. Complete updated token files with all component defaults
2. Complete ThemeManager implementation
3. All SystemsManager changes
4. Example overlay renderer updates

Let me know which files you'd like first and I'll provide the full implementations! 🚀

Copilot is powered by AI, so mistakes are possible. Leave a comment via the 👍 👎 to share your feedback and help improve the experience.

````yaml type="draft-issue"
type: draft-issue
tag: "refactor-msd-theme-simplification"
issueNumber: 0
repository: snootched/cb-lcars-copilot
state: draft
title: 'Refactor MSD pack/style system: Remove profiles and DefaultsManager, consolidate under themes and style presets'
description: |
    ## Overview
    Refactor the MSD (Master Systems Display) pack/style system to simplify configuration and reduce architectural complexity. Remove the legacy `profiles` and `DefaultsManager` systems entirely, and migrate all type-based defaults to theme tokens. Style presets should be restructured as generic configuration bundles (e.g., for buttons, text, etc.), not nested under overlay types. This change will:
    - Make themes the single source of truth for all component defaults and styling tokens.
    - Allow style presets to be referenced generically by overlays/components (not overlay-type-specific).
    - Remove all profile activation logic, merging logic, and related test code.
    - Remove all code for `DefaultsManager` and migrate any usages to theme token resolution.
    - Update documentation and schemas to reflect new, simplified architecture.

    ## Acceptance Criteria
    - [ ] Completely remove all code, config, and docs for `profiles` and `DefaultsManager`.
    - [ ] Migrate all style defaults to theme tokens under `themes.*.tokens.components.*`.
    - [ ] Refactor style presets to be accessed generically, not nested by overlay type.
    - [ ] Update overlay/component code to resolve defaults from the theme via `ThemeTokenResolver`.
    - [ ] Update documentation and schemas to reflect the new architecture.
    - [ ] Ensure all overlay types can access relevant style presets (e.g., button presets for status_grid overlays).
    - [ ] Remove any migration/backcompat code—this is for unreleased, in-dev code only.

    ## Notes
    - This will greatly simplify the codebase and improve maintainability
    - No need to preserve migration or backward compatibility
    - KISS principle: keep the system clean and non-redundant

    ---
    Labels: enhancement
labels:
    - enhancement
````