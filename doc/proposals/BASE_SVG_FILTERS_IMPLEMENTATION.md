# Implementation Plan: Base SVG Filters with Rules Engine Integration

## Executive Summary

Implementing **both** features from BASE_SVG_ENHANCEMENTS.md:
1. ✅ `base_svg: "none"` support
2. ✅ Base SVG filter effects with rules engine integration
3. ✅ Theme/token system integration for filter values

This plan integrates filters into the existing MSD architecture:
- **StyleResolverService** for token resolution
- **RulesEngine** for dynamic updates
- **ThemeManager** for centralized filter presets
- **MsdModel** for configuration storage

---

## Architecture Overview

### Filter System Integration Points

```
┌─────────────────────────────────────────────────────────┐
│                    User YAML Config                      │
│  base_svg:                                              │
│    source: "builtin:ncc-1701-d"                        │
│    filters:                                            │
│      opacity: 0.4                                      │
│      blur: "2px"                                       │
│    # OR                                                │
│    filter_preset: "dimmed"                            │
└───────────────┬─────────────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────────────────────────┐
│              MSD Config Merging (mergePacks)            │
│  - Merges base_svg.filters from layers                 │
│  - Resolves filter_preset from ThemeManager             │
└───────────────┬─────────────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────────────────────────┐
│           CardModel (buildCardModel)                    │
│  - Stores filters in model.baseSvg.filters              │
│  - Pre-resolves filter_preset to filters object        │
└───────────────┬─────────────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────────────────────────┐
│         StyleResolverService                            │
│  - Resolves filter token values                        │
│  - Validates filter properties                         │
│  - Applies filter presets from theme                   │
└───────────────┬─────────────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────────────────────────┐
│          Renderer (applyBaseSvgFilters)                 │
│  - Applies CSS filter property to base SVG              │
│  - Sets opacity separately                              │
└───────────────┬─────────────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────────────────────────┐
│             RulesEngine Integration                     │
│  - Monitors rules with base_svg_filter actions          │
│  - Updates model.baseSvg.filters dynamically            │
│  - Triggers filter re-application                       │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core Filter Support

### 1.1 Configuration Schema

**File**: `src/msd/validation/validateMerged.js`

Add validation for `base_svg.filters` and `base_svg.filter_preset`:

```javascript
function validateBaseSvg(baseSvg, issues) {
  if (!baseSvg) return;

  // Existing source validation...

  // Filter preset validation
  if (baseSvg.filter_preset !== undefined) {
    if (typeof baseSvg.filter_preset !== 'string') {
      issues.errors.push({
        code: 'base_svg.filter_preset.invalid',
        message: 'filter_preset must be a string'
      });
    }
  }

  // Filters object validation
  if (baseSvg.filters !== undefined) {
    if (typeof baseSvg.filters !== 'object' || Array.isArray(baseSvg.filters)) {
      issues.errors.push({
        code: 'base_svg.filters.invalid',
        message: 'filters must be an object'
      });
      return;
    }

    validateFilterProperties(baseSvg.filters, issues);
  }

  // Can't have both preset and explicit filters (preset takes priority)
  if (baseSvg.filter_preset && baseSvg.filters) {
    issues.warnings.push({
      code: 'base_svg.filter_conflict',
      message: 'Both filter_preset and filters defined - filters will override preset values'
    });
  }
}

function validateFilterProperties(filters, issues) {
  const VALID_PROPERTIES = {
    opacity: { type: 'number', min: 0, max: 1 },
    blur: { type: 'string', pattern: /^\d+(\.\d+)?(px|rem|em)$/ },
    brightness: { type: 'number', min: 0, max: 2 },
    contrast: { type: 'number', min: 0, max: 2 },
    grayscale: { type: 'number', min: 0, max: 1 },
    sepia: { type: 'number', min: 0, max: 1 },
    hue_rotate: { type: 'number', min: -360, max: 360 },
    saturate: { type: 'number', min: 0, max: 2 },
    invert: { type: 'number', min: 0, max: 1 }
  };

  for (const [key, value] of Object.entries(filters)) {
    const spec = VALID_PROPERTIES[key];

    if (!spec) {
      issues.warnings.push({
        code: 'base_svg.filter.unknown',
        message: `Unknown filter property: ${key}. Valid properties: ${Object.keys(VALID_PROPERTIES).join(', ')}`
      });
      continue;
    }

    // Type validation
    if (spec.type === 'number' && typeof value !== 'number') {
      issues.errors.push({
        code: `base_svg.filter.${key}.type`,
        message: `${key} must be a number`
      });
      continue;
    }

    if (spec.type === 'string' && typeof value !== 'string') {
      issues.errors.push({
        code: `base_svg.filter.${key}.type`,
        message: `${key} must be a string`
      });
      continue;
    }

    // Range validation
    if (spec.type === 'number') {
      if (value < spec.min || value > spec.max) {
        issues.errors.push({
          code: `base_svg.filter.${key}.range`,
          message: `${key} must be between ${spec.min} and ${spec.max}`
        });
      }
    }

    // Pattern validation
    if (spec.pattern && !spec.pattern.test(value)) {
      issues.errors.push({
        code: `base_svg.filter.${key}.format`,
        message: `${key} must match format: ${spec.pattern}`
      });
    }
  }
}
```

### 1.2 Theme Integration - Filter Presets

**File**: `src/msd/themes/ThemeManager.js` or `cb-lcars-theme.yaml`

Add built-in filter presets to theme:

```javascript
// In ThemeManager initialization or theme config
const BUILTIN_FILTER_PRESETS = {
  dimmed: {
    opacity: 0.5,
    brightness: 0.8
  },
  subtle: {
    opacity: 0.6,
    blur: '1px',
    grayscale: 0.2
  },
  backdrop: {
    opacity: 0.3,
    blur: '3px',
    brightness: 0.6
  },
  faded: {
    opacity: 0.4,
    grayscale: 0.5,
    contrast: 0.7
  },
  'red-alert': {
    opacity: 1.0,
    brightness: 1.2,
    hue_rotate: 10,
    saturate: 1.3
  },
  monochrome: {
    opacity: 0.6,
    grayscale: 1.0,
    contrast: 0.8
  }
};

// In ThemeManager class
getFilterPreset(presetName) {
  return BUILTIN_FILTER_PRESETS[presetName] || null;
}
```

**Alternative: YAML Theme Config**

```yaml
# themes/lcars-theme.yaml
filter_presets:
  dimmed:
    opacity: 0.5
    brightness: 0.8

  subtle:
    opacity: 0.6
    blur: "1px"
    grayscale: 0.2

  backdrop:
    opacity: 0.3
    blur: "3px"
    brightness: 0.6

  faded:
    opacity: 0.4
    grayscale: 0.5
    contrast: 0.7

  red-alert:
    opacity: 1.0
    brightness: 1.2
    hue_rotate: 10
    saturate: 1.3

  monochrome:
    opacity: 0.6
    grayscale: 1.0
    contrast: 0.8
```

### 1.3 CardModel Integration

**File**: `src/msd/model/CardModel.js`

Store resolved filters in the card model:

```javascript
export async function buildCardModel(mergedConfig) {
  // ... existing code ...

  // Handle base_svg filters
  let baseSvgFilters = null;
  if (baseSvgSource && baseSvgSource !== 'none') {
    // Start with preset if specified
    if (mergedConfig.base_svg?.filter_preset) {
      const preset = themeManager.getFilterPreset(mergedConfig.base_svg.filter_preset);
      if (preset) {
        baseSvgFilters = { ...preset };
        cblcarsLog.debug('[CardModel] Applied filter preset:', mergedConfig.base_svg.filter_preset);
      } else {
        cblcarsLog.warn('[CardModel] Unknown filter preset:', mergedConfig.base_svg.filter_preset);
      }
    }

    // Merge explicit filters (override preset)
    if (mergedConfig.base_svg?.filters) {
      baseSvgFilters = {
        ...baseSvgFilters,
        ...mergedConfig.base_svg.filters
      };
      cblcarsLog.debug('[CardModel] Applied explicit filters');
    }
  }

  return {
    // ... existing model properties ...
    baseSvg: {
      source: baseSvgSource,
      content: svgContent,
      filters: baseSvgFilters  // ← NEW
    },
    // ... rest of model ...
  };
}
```

### 1.4 Filter Application Utility

**File**: `src/msd/renderer/utils/BaseSvgFilters.js` (NEW)

```javascript
import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';

/**
 * Apply CSS filters to base SVG element
 *
 * @param {SVGElement} svgElement - The base SVG element
 * @param {Object} filters - Filter configuration
 * @returns {void}
 */
export function applyBaseSvgFilters(svgElement, filters) {
  if (!svgElement || !filters) {
    return;
  }

  const cssFilters = [];

  // Handle opacity separately (not a filter function)
  if (filters.opacity !== undefined) {
    svgElement.style.opacity = filters.opacity;
  }

  // Build CSS filter string
  if (filters.blur !== undefined) {
    cssFilters.push(`blur(${filters.blur})`);
  }

  if (filters.brightness !== undefined) {
    cssFilters.push(`brightness(${filters.brightness})`);
  }

  if (filters.contrast !== undefined) {
    cssFilters.push(`contrast(${filters.contrast})`);
  }

  if (filters.grayscale !== undefined) {
    cssFilters.push(`grayscale(${filters.grayscale})`);
  }

  if (filters.sepia !== undefined) {
    cssFilters.push(`sepia(${filters.sepia})`);
  }

  if (filters.hue_rotate !== undefined) {
    cssFilters.push(`hue-rotate(${filters.hue_rotate}deg)`);
  }

  if (filters.saturate !== undefined) {
    cssFilters.push(`saturate(${filters.saturate})`);
  }

  if (filters.invert !== undefined) {
    cssFilters.push(`invert(${filters.invert})`);
  }

  // Apply combined filter
  if (cssFilters.length > 0) {
    svgElement.style.filter = cssFilters.join(' ');
    cblcarsLog.debug('[BaseSvgFilters] Applied filters:', cssFilters.join(' '));
  } else {
    svgElement.style.filter = '';
  }
}

/**
 * Remove all filters from SVG element
 *
 * @param {SVGElement} svgElement - The base SVG element
 */
export function clearBaseSvgFilters(svgElement) {
  if (!svgElement) return;

  svgElement.style.filter = '';
  svgElement.style.opacity = '';

  cblcarsLog.debug('[BaseSvgFilters] Cleared all filters');
}

/**
 * Transition filters smoothly
 *
 * @param {SVGElement} svgElement - The base SVG element
 * @param {Object} newFilters - New filter configuration
 * @param {number} duration - Transition duration in ms (default: 300)
 */
export function transitionBaseSvgFilters(svgElement, newFilters, duration = 300) {
  if (!svgElement) return;

  // Add transition property
  svgElement.style.transition = `filter ${duration}ms ease-in-out, opacity ${duration}ms ease-in-out`;

  // Apply new filters
  applyBaseSvgFilters(svgElement, newFilters);

  // Remove transition after completion
  setTimeout(() => {
    svgElement.style.transition = '';
  }, duration);
}
```

### 1.5 Renderer Integration

**File**: `src/cb-lcars/cb-lcars-msd.yaml` or `MsdInstanceManager.js`

Apply filters during initial render:

```javascript
// After SVG is inserted into DOM
const svg = container.querySelector('svg');
if (svg && model.baseSvg?.filters) {
  const { applyBaseSvgFilters } = await import('./renderer/utils/BaseSvgFilters.js');
  applyBaseSvgFilters(svg, model.baseSvg.filters);

  cblcarsLog.debug('[MSD] Applied base SVG filters:', model.baseSvg.filters);
}
```

---

## Phase 2: Rules Engine Integration

### 2.1 New Rule Action Type: `update_base_svg_filter`

**File**: `src/msd/rules/RulesEngine.js`

Add support for filter update actions:

```javascript
class RulesEngine {
  // ... existing code ...

  _applyAction(action, context) {
    switch (action.type) {
      // Existing action types...
      case 'update_style':
        return this._applyStyleUpdate(action, context);

      // NEW: Base SVG filter updates
      case 'update_base_svg_filter':
        return this._applyBaseSvgFilterUpdate(action, context);

      default:
        cblcarsLog.warn('[RulesEngine] Unknown action type:', action.type);
        return null;
    }
  }

  /**
   * Apply base SVG filter update action
   * @private
   */
  _applyBaseSvgFilterUpdate(action, context) {
    if (!action.filters && !action.filter_preset) {
      cblcarsLog.warn('[RulesEngine] update_base_svg_filter action missing filters or filter_preset');
      return null;
    }

    let newFilters = {};

    // Apply preset if specified
    if (action.filter_preset) {
      const preset = this.themeManager?.getFilterPreset(action.filter_preset);
      if (preset) {
        newFilters = { ...preset };
      } else {
        cblcarsLog.warn('[RulesEngine] Unknown filter preset:', action.filter_preset);
      }
    }

    // Merge explicit filters
    if (action.filters) {
      newFilters = {
        ...newFilters,
        ...action.filters
      };
    }

    return {
      type: 'base_svg_filter',
      filters: newFilters,
      transition: action.transition || 300  // ms
    };
  }
}
```

### 2.2 SystemsManager - Apply Filter Updates

**File**: `src/msd/pipeline/SystemsManager.js`

Handle filter update results from rules engine:

```javascript
class SystemsManager {
  // ... existing code ...

  async _applyRuleResults(results) {
    for (const result of results) {
      if (result.type === 'base_svg_filter') {
        await this._applyBaseSvgFilterUpdate(result);
      }
      // ... handle other result types ...
    }
  }

  /**
   * Apply base SVG filter update from rules
   * @private
   */
  async _applyBaseSvgFilterUpdate(result) {
    // Get base SVG element
    const svg = this.containerElement?.querySelector('svg');
    if (!svg) {
      cblcarsLog.warn('[SystemsManager] Cannot apply filter update - no base SVG found');
      return;
    }

    // Update model
    if (this.model?.baseSvg) {
      this.model.baseSvg.filters = {
        ...this.model.baseSvg.filters,
        ...result.filters
      };
    }

    // Apply filters with transition
    const { transitionBaseSvgFilters } = await import('../renderer/utils/BaseSvgFilters.js');
    transitionBaseSvgFilters(svg, result.filters, result.transition);

    cblcarsLog.debug('[SystemsManager] ✅ Applied base SVG filter update:', result.filters);
  }
}
```

### 2.3 User Configuration Example

```yaml
base_svg:
  source: "builtin:ncc-1701-d"
  filter_preset: "dimmed"  # Default: dimmed at startup

rules:
  # Dim further at night
  - id: night_mode_dim
    when:
      time:
        after: "22:00:00"
        before: "06:00:00"
    apply:
      actions:
        - type: update_base_svg_filter
          filters:
            opacity: 0.2
            brightness: 0.5
          transition: 1000  # 1 second fade

  # Brighten during alert
  - id: alert_mode_bright
    when:
      entity: binary_sensor.alert
      state: "on"
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "red-alert"  # Use preset
          transition: 500

  # Restore default when alert clears
  - id: alert_mode_normal
    when:
      entity: binary_sensor.alert
      state: "off"
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "dimmed"
          transition: 1000
```

---

## Phase 3: Token System Integration

### 3.1 Filter Values as Tokens

Allow filter values to reference theme tokens:

```yaml
base_svg:
  source: "builtin:ncc-1701-d"
  filters:
    opacity: "{{ tokens.filters.base_opacity }}"  # From theme
    blur: "{{ tokens.filters.base_blur }}"
    brightness: "{{ tokens.filters.base_brightness }}"
```

**Theme Configuration:**

```yaml
# In theme config
tokens:
  filters:
    base_opacity: 0.4
    base_blur: "2px"
    base_brightness: 0.7

    night_opacity: 0.2
    night_blur: "4px"

    alert_opacity: 1.0
    alert_brightness: 1.2
```

### 3.2 StyleResolverService Integration

**File**: `src/msd/styles/StyleResolverService.js`

Add filter resolution method:

```javascript
class StyleResolverService {
  // ... existing code ...

  /**
   * Resolve filter configuration with token resolution
   *
   * @param {Object} filters - Raw filter configuration
   * @param {Object} context - Resolution context
   * @returns {Object} Resolved filters
   */
  resolveFilters(filters, context = {}) {
    if (!filters) return null;

    const resolved = {};

    for (const [key, value] of Object.entries(filters)) {
      // Resolve token if value is template string
      if (typeof value === 'string' && value.includes('{{')) {
        resolved[key] = this.tokenResolver.resolve(value, context);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }
}
```

### 3.3 Dynamic Token-Based Rules

```yaml
rules:
  - id: time_based_dimming
    when:
      time:
        after: "{{ tokens.night_start_time }}"
        before: "{{ tokens.night_end_time }}"
    apply:
      actions:
        - type: update_base_svg_filter
          filters:
            opacity: "{{ tokens.filters.night_opacity }}"
            blur: "{{ tokens.filters.night_blur }}"
```

---

## Phase 4: "None" Support

### 4.1 Validation Updates

Already covered in BASE_SVG_ENHANCEMENTS.md - add "none" support to validation.

### 4.2 CardModel Updates

```javascript
// In buildCardModel
if (baseSvgSource === 'none') {
  cblcarsLog.debug('[CardModel] base_svg set to "none" - no base layer');

  // ViewBox MUST be explicitly defined
  if (mergedConfig.view_box && Array.isArray(mergedConfig.view_box)) {
    viewBox = mergedConfig.view_box;
  } else {
    cblcarsLog.error('[CardModel] view_box required when base_svg is "none"');
  }

  baseSvgSource = null;
  baseSvgFilters = null;  // No filters for "none"
}
```

### 4.3 Renderer Updates

```javascript
// In renderer
if (!baseSvgSource || baseSvgSource === 'none') {
  const viewBox = model.viewBox || [0, 0, 400, 200];
  const aspect = viewBox[2] / viewBox[3];

  svgContent = `<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="${viewBox.join(' ')}"
    width="100%"
    height="100%"
    style="background: transparent;">
  </svg>`;

  // No filters for "none" mode
}
```

---

## Implementation Checklist

### ✅ Phase 1: Core Filters (Week 1-2)
- [ ] Add filter validation to `validateMerged.js`
- [ ] Create `BUILTIN_FILTER_PRESETS` in ThemeManager
- [ ] Update `CardModel.js` to store filters
- [ ] Create `BaseSvgFilters.js` utility
- [ ] Integrate filter application in renderer
- [ ] Test basic filter application
- [ ] Document filter properties

### ✅ Phase 2: Rules Integration (Week 2-3)
- [ ] Add `update_base_svg_filter` action type to RulesEngine
- [ ] Implement `_applyBaseSvgFilterUpdate` in SystemsManager
- [ ] Add transition support
- [ ] Test dynamic filter updates via rules
- [ ] Test preset application via rules
- [ ] Document rules integration

### ✅ Phase 3: Token System (Week 3)
- [ ] Add filter token resolution to StyleResolverService
- [ ] Define filter tokens in theme config
- [ ] Test token-based filter values
- [ ] Document token usage for filters

### ✅ Phase 4: "None" Support (Week 1)
- [ ] Update validation for "none" value
- [ ] Update CardModel for "none" handling
- [ ] Update renderer for minimal SVG generation
- [ ] Test overlay-only cards
- [ ] Document "none" usage

### ✅ Phase 5: Testing & Documentation (Week 4)
- [ ] Create comprehensive test configs
- [ ] Performance testing (filter impact)
- [ ] Browser compatibility testing
- [ ] Write user guide
- [ ] Create visual examples
- [ ] Update API documentation

---

## Configuration Examples

### Example 1: Static Filters
```yaml
base_svg:
  source: "builtin:ncc-1701-d"
  filters:
    opacity: 0.4
    blur: "2px"
    brightness: 0.7
```

### Example 2: Filter Preset
```yaml
base_svg:
  source: "builtin:nx-01"
  filter_preset: "backdrop"
```

### Example 3: Time-Based Dimming
```yaml
base_svg:
  source: "builtin:ncc-1701-a-blue"
  filter_preset: "dimmed"

rules:
  - id: night_dim
    when:
      time:
        after: "22:00:00"
        before: "06:00:00"
    apply:
      actions:
        - type: update_base_svg_filter
          filters:
            opacity: 0.2
            brightness: 0.5
```

### Example 4: Alert-Based Filters
```yaml
base_svg:
  source: "builtin:ncc-1701-d"
  filters:
    opacity: 0.5

rules:
  - id: red_alert
    when:
      entity: binary_sensor.security_alert
      state: "on"
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "red-alert"
          transition: 300
```

### Example 5: Token-Based Configuration
```yaml
base_svg:
  source: "builtin:nx-01"
  filters:
    opacity: "{{ tokens.filters.base_opacity }}"
    blur: "{{ tokens.filters.base_blur }}"

rules:
  - id: performance_dim
    when:
      datasource: performance_metrics
      property: fps
      below: 30
    apply:
      actions:
        - type: update_base_svg_filter
          filters:
            opacity: "{{ tokens.filters.low_perf_opacity }}"
            blur: "{{ tokens.filters.low_perf_blur }}"
```

---

## Benefits of This Architecture

### ✅ Consistency
- Filters integrated with existing style resolution system
- Uses same token/theme infrastructure as overlays
- Follows established patterns (rules actions, style resolver, etc.)

### ✅ Flexibility
- Static filters via config
- Dynamic filters via rules
- Preset-based for common patterns
- Token-based for theme integration

### ✅ Performance
- CSS filters are GPU-accelerated
- Transition animations smooth
- No DOM manipulation overhead

### ✅ Debuggability
- Filter values visible in model
- Rules engine traces filter updates
- Theme system provides preset visibility

### ✅ User Experience
- Simple for basic use (`filter_preset: "dimmed"`)
- Powerful for advanced use (rules + tokens)
- Visual feedback via transitions
- LCARS-appropriate presets (red-alert, etc.)

---

## Open Questions

1. **Should filters be animatable via AnimationPresets?**
   - Could create filter animation sequences
   - E.g., "pulse" effect by animating opacity/brightness
   - Would require AnimationEngine integration

2. **Should we support per-overlay filters?**
   - Could apply filters to individual overlays
   - Would need z-index management
   - Might be overkill for MSD use case

3. **Should filter updates trigger re-evaluation?**
   - Currently: Rules trigger filter updates
   - Alternative: Filter changes could trigger rule re-evaluation
   - Probably not needed (rules are source of truth)

4. **Should we cache filter CSS strings?**
   - Could cache computed filter strings for performance
   - Probably not needed (filter generation is fast)

---

## Answer to Your Question

> "for the rules integration, I'm not sure how we do this - should we be adding this into the themes/token system as well then? and standardize on this?"

**Yes! Here's how:**

1. **Filter Presets in Theme** - Define common patterns centrally
   ```yaml
   filter_presets:
     dimmed: { opacity: 0.5, brightness: 0.8 }
     backdrop: { opacity: 0.3, blur: "3px" }
   ```

2. **Token Values for Filters** - Allow theme-based filter values
   ```yaml
   tokens:
     filters:
       base_opacity: 0.4
       night_opacity: 0.2
   ```

3. **Rules Apply Filters** - Rules reference presets OR tokens
   ```yaml
   rules:
     - when: { time: night }
       apply:
         actions:
           - type: update_base_svg_filter
             filter_preset: "backdrop"  # OR
             filters:
               opacity: "{{ tokens.filters.night_opacity }}"
   ```

This gives you:
- **Standardization** - Presets ensure consistency
- **Flexibility** - Can still use explicit values
- **Theming** - Filters respect theme system
- **Reusability** - Same preset used across cards

The architecture follows your existing patterns:
- ThemeManager owns presets (like style presets)
- StyleResolverService resolves tokens (like overlay styles)
- RulesEngine triggers updates (like style updates)
- Model stores current state (like overlay finalStyle)

**No reinventing the wheel - just extending what works!** 🎉
