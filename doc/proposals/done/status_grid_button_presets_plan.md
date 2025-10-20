# CB-LCARS Status Grid Button Presets Implementation Plan

## Overview
This plan outlines how to implement CB-LCARS button card presets within the existing Status Grid system, providing users with one-line configuration to achieve familiar button card styling.

## Current State Analysis

### Existing StatusGridRenderer Capabilities
✅ **Already Implemented:**
- LCARS text presets: `lozenge`, `bullet`, `corner`, `badge`
- Smart padding calculation (corner-radius aware)
- Comprehensive positioning system
- Status-based color ranges
- Action system integration
- Font-relative sizing

✅ **Existing Configuration Structure:**
```javascript
// In _resolveStatusGridStyles()
lcars_text_preset: style.lcars_text_preset || style.lcarsTextPreset || null,
cell_color: standardStyles.colors.primaryColor || this._getDefault('status_grid.cell_color', 'var(--lcars-blue)'),
status_ranges: this._parseStatusRanges(style.status_ranges || style.statusRanges),
```

## Implementation Strategy

### Phase 1: Add CB-LCARS Button Preset System

#### 1.1 Add Preset Configuration Support
**File:** `src/msd/renderer/StatusGridRenderer.js`

**Location:** In `_resolveStatusGridStyles()` method, after existing `lcars_text_preset` line (~line 222)

```javascript
// CB-LCARS specific positioning presets
lcars_text_preset: style.lcars_text_preset || style.lcarsTextPreset || null, // lozenge, bullet, corner, etc.

// NEW: CB-LCARS Button Presets System
lcars_button_preset: style.lcars_button_preset || style.lcarsButtonPreset || null, // lozenge, bullet, picard-filled, etc.
```

#### 1.2 Create Preset Processing Method
**File:** `src/msd/renderer/StatusGridRenderer.js`

**Location:** Add new method after `_calculateLCARSPresetPosition()` (~line 615)

```javascript
/**
 * Apply CB-LCARS button preset styling configuration
 * @private
 * @param {Object} gridStyle - Current grid style configuration
 * @returns {Object} Enhanced grid style with preset applied
 */
_applyLCARSButtonPreset(gridStyle) {
  const preset = gridStyle.lcars_button_preset;

  if (!preset) return gridStyle;

  // Define preset configurations based on popular CB-LCARS button templates
  const presetConfigs = {
    'lozenge': {
      lcars_text_preset: 'lozenge',
      cell_radius: 'var(--ha-card-border-radius)',
      cell_color: 'var(--lcars-card-button)',
      normalize_radius: true,
      match_ha_radius: false,
      text_padding: 8,
      font_family: "'Antonio', Arial, sans-serif",
      font_weight: 'normal',
      label_position: 'top-left',
      value_position: 'bottom-right',
      status_ranges: [
        { state: ['on', 'open', 'locked'], color: 'var(--lcars-card-button)' },
        { state: ['off', 'closed', 'unlocked'], color: 'var(--lcars-card-button-off)' },
        { equals: 0, color: 'var(--lcars-green)' },
        { not_equals: 0, color: 'var(--lcars-blue)' },
        { state: ['unavailable'], color: 'var(--lcars-card-button-unavailable)' }
      ]
    },

    'bullet': {
      lcars_text_preset: 'bullet',
      cell_radius: 'var(--ha-card-border-radius)',
      cell_color: 'var(--lcars-card-button)',
      normalize_radius: true,
      match_ha_radius: false,
      text_padding: 6,
      font_family: "'Antonio', Arial, sans-serif",
      font_weight: 'normal',
      label_position: 'left',
      value_position: 'right',
      status_ranges: [
        { state: ['on', 'open', 'locked'], color: 'var(--lcars-card-button)' },
        { state: ['off', 'closed', 'unlocked'], color: 'var(--lcars-card-button-off)' },
        { equals: 0, color: 'var(--lcars-green)' },
        { not_equals: 0, color: 'var(--lcars-blue)' },
        { state: ['unavailable'], color: 'var(--lcars-card-button-unavailable)' }
      ]
    },

    'picard-filled': {
      lcars_text_preset: 'badge',
      cell_radius: 4,
      cell_color: 'var(--lcars-card-button)',
      normalize_radius: false,
      match_ha_radius: false,
      text_padding: 6,
      font_family: "'Antonio', Arial, sans-serif",
      font_weight: 'normal',
      font_size: 22,
      label_position: 'center-top',
      value_position: 'center',
      status_ranges: [
        { state: ['on', 'open', 'locked'], color: 'var(--lcars-card-button)' },
        { state: ['off', 'closed', 'unlocked'], color: 'var(--lcars-card-button-off)' },
        { equals: 0, color: 'var(--lcars-green)' },
        { not_equals: 0, color: 'var(--lcars-blue)' },
        { state: ['unavailable'], color: 'var(--lcars-card-button-unavailable)' }
      ]
    },

    'picard': {
      lcars_text_preset: 'badge',
      cell_radius: 4,
      cell_color: 'transparent',
      cell_border: true,
      border_width: 4,
      border_color: 'var(--lcars-card-button)',
      normalize_radius: false,
      match_ha_radius: false,
      text_padding: 8,
      font_family: "'Antonio', Arial, sans-serif",
      font_weight: 'normal',
      font_size: 22,
      label_color: 'var(--lcars-card-button)',
      value_color: 'var(--lcars-card-button)',
      label_position: 'center-top',
      value_position: 'center',
      status_ranges: [
        { state: ['on', 'open', 'locked'], color: 'var(--lcars-card-button)', border_color: 'var(--lcars-card-button)' },
        { state: ['off', 'closed', 'unlocked'], color: 'var(--lcars-card-button-off)', border_color: 'var(--lcars-card-button-off)' },
        { state: ['unavailable'], color: 'var(--lcars-card-button-unavailable)', border_color: 'var(--lcars-card-button-unavailable)' }
      ]
    },

    'capped': {
      lcars_text_preset: 'lozenge',
      cell_radius: 'var(--ha-card-border-radius)',
      // Specific border radius for capped style (left rounded, right square)
      cell_border_radius_override: {
        top_left: 'var(--ha-card-border-radius)',
        top_right: 0,
        bottom_left: 'var(--ha-card-border-radius)',
        bottom_right: 0
      },
      cell_color: 'var(--lcars-card-button)',
      normalize_radius: false,
      text_padding: 8,
      font_family: "'Antonio', Arial, sans-serif",
      status_ranges: [
        { state: ['on', 'open', 'locked'], color: 'var(--lcars-card-button)' },
        { state: ['off', 'closed', 'unlocked'], color: 'var(--lcars-card-button-off)' },
        { state: ['unavailable'], color: 'var(--lcars-card-button-unavailable)' }
      ]
    }
  };

  const presetConfig = presetConfigs[preset];
  if (!presetConfig) {
    cblcarsLog.warn(`[StatusGridRenderer] Unknown CB-LCARS button preset: ${preset}`);
    return gridStyle;
  }

  // Apply preset configuration (preset values override defaults, but user values override preset)
  const enhancedStyle = { ...gridStyle };

  Object.entries(presetConfig).forEach(([key, value]) => {
    // Only apply preset value if user hasn't explicitly set this property
    if (enhancedStyle[key] === null || enhancedStyle[key] === undefined ||
        enhancedStyle[key] === this._getDefault(`status_grid.${key}`, null)) {
      enhancedStyle[key] = value;
    }
  });

  cblcarsLog.debug(`[StatusGridRenderer] Applied CB-LCARS button preset: ${preset}`);
  return enhancedStyle;
}
```

#### 1.3 Integrate Preset Processing
**File:** `src/msd/renderer/StatusGridRenderer.js`

**Location:** In `_resolveStatusGridStyles()` method, before the final `return gridStyle;` (~line 295)

```javascript
// Build feature list for conditional rendering
if (gridStyle.gradient) gridStyle.features.push('gradient');
// ... existing feature detection ...

// NEW: Apply CB-LCARS button preset if specified
if (gridStyle.lcars_button_preset) {
  const enhancedGridStyle = this._applyLCARSButtonPreset(gridStyle);
  return enhancedGridStyle;
}

return gridStyle;
```

### Phase 2: Enhanced Border Radius Support

#### 2.1 Add Individual Corner Radius Support
**File:** `src/msd/renderer/StatusGridRenderer.js`

**Location:** In `_renderEnhancedStatusGrid()` method, cell rendering section (~line 740)

```javascript
// Determine cell corner radius (cell override, LCARS corners, or regular)
let cellCornerRadius = cell.cellOverrides?.radius !== null ? cell.cellOverrides?.radius : gridStyle.cell_radius;

// NEW: Handle individual corner radius for presets like 'capped'
let borderRadiusAttr = '';
if (gridStyle.cell_border_radius_override) {
  const override = gridStyle.cell_border_radius_override;
  const topLeft = override.top_left || cellCornerRadius;
  const topRight = override.top_right || cellCornerRadius;
  const bottomLeft = override.bottom_left || cellCornerRadius;
  const bottomRight = override.bottom_right || cellCornerRadius;

  // Use CSS-style border radius if individual corners differ
  if (topLeft !== topRight || topLeft !== bottomLeft || topLeft !== bottomRight) {
    borderRadiusAttr = `style="border-radius: ${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px;"`;
    cellCornerRadius = 0; // Don't use rx attribute when using CSS
  }
}

// Apply radius normalization for consistent visual appearance across different cell sizes
if (gridStyle.normalize_radius && cell.cellOverrides?.radius === null && !gridStyle.cell_border_radius_override) {
  cellCornerRadius = this._calculateNormalizedRadius(cellWidth, cellHeight, gridStyle.cell_radius, gridStyle.match_ha_radius);
}
```

#### 2.2 Update Cell Rendering
**File:** `src/msd/renderer/StatusGridRenderer.js`

**Location:** In cell rectangle rendering section (~line 760)

```javascript
// Render cell rectangle (simplified - group handles the actions)
gridMarkup += `<rect x="${cellX}" y="${cellY}"
               width="${cellWidth}" height="${cellHeight}"
               fill="${cellColor}"
               stroke="${gridStyle.border_color}"
               stroke-width="${gridStyle.border_width}"
               rx="${cellCornerRadius}"
               ${borderRadiusAttr}
               data-lcars-corner="${gridStyle.lcars_corners && (cell.row === 0 || cell.row === gridStyle.rows - 1) && (cell.col === 0 || cell.col === gridStyle.columns - 1)}"
               style="pointer-events: inherit;"
               />`;
```

### Phase 3: Documentation Updates

#### 3.1 Add to Status Grid Documentation
**File:** `doc/user/status_grid_overlay_complete_documentation.md`

**Location:** Add new section after "CB-LCARS Preset Styles" (~line 702)

```markdown
### CB-LCARS Button Presets

Instantly recreate popular CB-LCARS button card styles with single-line configuration:

#### Simple Preset Usage
```yaml
overlays:
  - id: lcars_button_grid
    type: status_grid
    position: [100, 200]
    size: [400, 300]
    style:
      lcars_button_preset: "lozenge"  # One line = full button styling!
      rows: 2
      columns: 3
    cells:
      - entity: light.desk
        label: "DESK"
      - entity: fan.bedroom
        label: "FAN"
```

#### Available Presets

**Lozenge Style** (`lcars_button_preset: "lozenge"`)
- Label: top-left, Value: bottom-right
- Rounded corners matching HA theme
- Classic CB-LCARS button appearance

**Bullet Style** (`lcars_button_preset: "bullet"`)
- Label: left, Value: right (side-by-side)
- Rounded corners
- Compact horizontal layout

**Picard Filled** (`lcars_button_preset: "picard-filled"`)
- Label: top-center, Value: center
- Small corner radius (4px)
- Filled background styling

**Picard Outline** (`lcars_button_preset: "picard"`)
- Label: top-center, Value: center
- Border-only styling (transparent background)
- 4px border width

**Capped Style** (`lcars_button_preset: "capped"`)
- Label: top-left, Value: bottom-right
- Left corners rounded, right corners square
- Distinctive LCARS aesthetic

#### Preset Customization
```yaml
style:
  lcars_button_preset: "lozenge"    # Start with preset
  # Override specific aspects
  cell_color: "var(--lcars-red)"    # Custom color
  font_size: 16                     # Custom font size
  text_padding: 12                  # Custom padding
```

#### Full Status Colors
All presets include comprehensive status color ranges:
- `on/open/locked` → Primary button color
- `off/closed/unlocked` → Off button color
- `0` → Green (zero state)
- `non-zero` → Blue (active state)
- `unavailable` → Gray (unavailable state)
```

#### 3.2 Add Configuration Schema
**File:** `doc/user/status_grid_overlay_complete_documentation.md`

**Location:** In Configuration Schema section (~line 1320)

```markdown
      # CB-LCARS Button Presets (one-line styling)
      lcars_button_preset: string    # Preset style: lozenge, bullet, picard-filled, picard, capped (default: null)

      # LCARS Preset Styles (text positioning only)
      lcars_text_preset: string      # Text preset: lozenge, bullet, corner, badge (default: null)
```

### Phase 4: Usage Examples

#### 4.1 Create Example Configurations
**File:** `doc/user/status_grid_overlay_complete_documentation.md`

**Location:** Add new example section

```markdown
### Example 8: CB-LCARS Button Presets Showcase

```yaml
# Complete CB-LCARS button grid with multiple presets
overlays:
  # Lozenge style buttons
  - id: lozenge_buttons
    type: status_grid
    position: [50, 50]
    size: [300, 200]
    style:
      lcars_button_preset: "lozenge"
      rows: 2
      columns: 2
    cells:
      - entity: light.living_room
        label: "LIVING"
      - entity: light.kitchen
        label: "KITCHEN"
      - entity: light.bedroom
        label: "BEDROOM"
      - entity: light.bathroom
        label: "BATHROOM"

  # Picard filled style with custom colors
  - id: picard_status
    type: status_grid
    position: [400, 50]
    size: [250, 150]
    style:
      lcars_button_preset: "picard-filled"
      cell_color: "var(--lcars-orange)"
      rows: 1
      columns: 3
    cells:
      - entity: sensor.cpu_temperature
        label: "CPU"
        content: "72°C"
      - entity: sensor.memory_usage
        label: "RAM"
        content: "45%"
      - entity: sensor.disk_usage
        label: "DISK"
        content: "23%"

  # Mixed preset grid with overrides
  - id: mixed_controls
    type: status_grid
    position: [50, 300]
    size: [600, 100]
    style:
      lcars_button_preset: "bullet"
      # Override preset defaults
      font_size: 14
      text_padding: 10
      rows: 1
      columns: 4
    cells:
      - entity: switch.security_system
        label: "SECURITY"
      - entity: climate.main_thermostat
        label: "CLIMATE"
      - entity: cover.garage_door
        label: "GARAGE"
      - entity: lock.front_door
        label: "LOCK"
```

### Phase 5: Testing & Validation

#### 5.1 Test Cases to Validate
1. **Basic preset application** - Each preset renders correctly
2. **Status color changes** - Presets respond to entity state changes
3. **User overrides** - Custom values override preset defaults
4. **Backward compatibility** - Existing configs continue working
5. **Complex radius handling** - Capped style renders proper corner differences
6. **Action system** - Button presets maintain full interactivity

#### 5.2 Integration Testing
1. **MSD Pipeline** - Presets work within full MSD context
2. **Animation compatibility** - Presets work with anime.js integration
3. **Responsive scaling** - Presets adapt to different viewport sizes
4. **Theme compatibility** - Presets respect CSS variable changes

## Benefits of This Implementation

### User Experience
- ✅ **One-line configuration** - `lcars_button_preset: "lozenge"`
- ✅ **Familiar styling** - Matches beloved CB-LCARS button cards
- ✅ **Full customization** - Users can override any preset aspect
- ✅ **No breaking changes** - Existing status grids continue working

### Technical Benefits
- ✅ **Minimal code impact** - Leverages existing StatusGrid infrastructure
- ✅ **Maintainable** - Presets defined in simple configuration objects
- ✅ **Extensible** - Easy to add new presets in the future
- ✅ **Performance** - No additional rendering overhead

### Migration Path
- ✅ **Gradual adoption** - Users can try presets alongside existing cards
- ✅ **Learning curve** - Familiar preset names from existing templates
- ✅ **Fallback options** - Full legacy cards still available via control overlays

This implementation provides the 80/20 solution you identified - maximum visual impact with minimal complexity, while preserving the advanced capabilities of your existing systems.












Excellent question! After looking at your MSD defaults manager architecture, I can see there's a very thoughtful layered system already in place. Let me analyze the best approach for CB-LCARS button presets:

## Current MSD Defaults Manager Architecture

Looking at your code, you have a sophisticated 4-layer system:
- **builtin** → **theme** → **pack** → **user** (priority order)
- Each layer can override lower layers
- Support for scalable values with viewBox awareness
- Already handles status_grid defaults

## Design Options Analysis

### Option 1: Pack Layer (📦 **RECOMMENDED**)
Put CB-LCARS button presets in the **pack** layer as a dedicated "CB-LCARS Button Styles Pack":

```javascript
// In a new file: src/msd/packs/cblcarsButtonStylesPack.js
export const CB_LCARS_BUTTON_STYLES_PACK = {
  id: 'cb_lcars_button_styles',
  version: '1.0.0',
  description: 'CB-LCARS Button Card Visual Presets for Status Grid',

  // Pack-level defaults for button presets
  defaults: {
    // Lozenge preset defaults
    'status_grid.preset.lozenge.lcars_text_preset': 'lozenge',
    'status_grid.preset.lozenge.cell_radius': 'var(--ha-card-border-radius)',
    'status_grid.preset.lozenge.cell_color': 'var(--lcars-card-button)',
    'status_grid.preset.lozenge.text_padding': 8,
    'status_grid.preset.lozenge.font_family': "'Antonio', Arial, sans-serif",
    'status_grid.preset.lozenge.status_ranges': [
      { state: ['on', 'open', 'locked'], color: 'var(--lcars-card-button)' },
      { state: ['off', 'closed', 'unlocked'], color: 'var(--lcars-card-button-off)' },
      { equals: 0, color: 'var(--lcars-green)' },
      { not_equals: 0, color: 'var(--lcars-blue)' },
      { state: ['unavailable'], color: 'var(--lcars-card-button-unavailable)' }
    ],

    // Bullet preset defaults
    'status_grid.preset.bullet.lcars_text_preset': 'bullet',
    'status_grid.preset.bullet.cell_radius': 'var(--ha-card-border-radius)',
    'status_grid.preset.bullet.cell_color': 'var(--lcars-card-button)',
    'status_grid.preset.bullet.text_padding': 6,
    'status_grid.preset.bullet.label_position': 'left',
    'status_grid.preset.bullet.value_position': 'right',
    // ... other bullet defaults

    // Picard presets...
    // Capped presets...
  },

  // Could also include related overlays, animations, etc.
  overlays: [],
  animations: [],
  profiles: []
};
```

### Option 2: Defaults Manager Only
Keep presets as hardcoded objects but register key defaults:

```javascript
// In StatusGridRenderer._applyLCARSButtonPreset()
_applyLCARSButtonPreset(gridStyle) {
  const preset = gridStyle.lcars_button_preset;
  if (!preset) return gridStyle;

  // Use defaults manager for individual values
  const cell_color = this.defaults?.resolve(`status_grid.preset.${preset}.cell_color`) || 'var(--lcars-card-button)';
  const text_padding = this.defaults?.resolve(`status_grid.preset.${preset}.text_padding`) || 8;
  // etc.
}
```

### Option 3: Inline Hardcoded (Original Plan)
Keep presets as static objects in StatusGridRenderer.

## Recommendation: **Pack Layer Approach**

I recommend **Option 1 (Pack Layer)** for these reasons:

### ✅ **Architectural Benefits**
- **Fits your existing system** - leverages the pack layer you already built
- **User customizable** - users could override specific preset aspects via user layer
- **Extensible** - easy to add new button style packs later
- **Debuggable** - shows up in `window.cblcars.defaults.debug()`

### ✅ **User Benefits**
- **Consistent** - same configuration patterns as other MSD features
- **Override friendly** - users can tweak individual preset aspects
- **Discoverable** - shows up in defaults introspection

### ✅ **Developer Benefits**
- **Maintainable** - presets are data, not code
- **Testable** - can be validated like any other pack
- **Reusable** - could be shared across projects

## Implementation Plan

### Step 1: Create CB-LCARS Button Styles Pack
**File:** `src/msd/packs/cblcarsButtonStylesPack.js`

```javascript
/**
 * CB-LCARS Button Styles Pack
 * Provides visual presets for Status Grid to recreate CB-LCARS button card styling
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export const CB_LCARS_BUTTON_STYLES_PACK = {
  id: 'cb_lcars_button_styles',
  version: '1.0.0',
  description: 'CB-LCARS Button Card Visual Presets for Status Grid',
  author: 'CB-LCARS Team',

  defaults: {
    // Base button styling
    'status_grid.preset.base.font_family': "'Antonio', Arial, sans-serif",
    'status_grid.preset.base.font_weight': 'normal',
    'status_grid.preset.base.show_labels': true,
    'status_grid.preset.base.show_values': false,

    // Lozenge preset
    'status_grid.preset.lozenge.lcars_text_preset': 'lozenge',
    'status_grid.preset.lozenge.cell_radius': 'var(--ha-card-border-radius)',
    'status_grid.preset.lozenge.cell_color': 'var(--lcars-card-button)',
    'status_grid.preset.lozenge.text_padding': { value: 8, scale: 'viewbox', unit: 'px' },
    'status_grid.preset.lozenge.label_position': 'top-left',
    'status_grid.preset.lozenge.value_position': 'bottom-right',
    'status_grid.preset.lozenge.normalize_radius': true,

    // Bullet preset
    'status_grid.preset.bullet.lcars_text_preset': 'bullet',
    'status_grid.preset.bullet.cell_radius': 'var(--ha-card-border-radius)',
    'status_grid.preset.bullet.cell_color': 'var(--lcars-card-button)',
    'status_grid.preset.bullet.text_padding': { value: 6, scale: 'viewbox', unit: 'px' },
    'status_grid.preset.bullet.label_position': 'left',
    'status_grid.preset.bullet.value_position': 'right',

    // Picard filled preset
    'status_grid.preset.picard-filled.lcars_text_preset': 'badge',
    'status_grid.preset.picard-filled.cell_radius': 4,
    'status_grid.preset.picard-filled.cell_color': 'var(--lcars-card-button)',
    'status_grid.preset.picard-filled.text_padding': { value: 6, scale: 'viewbox', unit: 'px' },
    'status_grid.preset.picard-filled.font_size': 22,
    'status_grid.preset.picard-filled.label_position': 'center-top',
    'status_grid.preset.picard-filled.value_position': 'center',

    // Status color ranges (shared across presets)
    'status_grid.preset.status_ranges.standard': [
      { state: ['on', 'open', 'locked'], color: 'var(--lcars-card-button)' },
      { state: ['off', 'closed', 'unlocked'], color: 'var(--lcars-card-button-off)' },
      { equals: 0, color: 'var(--lcars-green)' },
      { not_equals: 0, color: 'var(--lcars-blue)' },
      { state: ['unavailable'], color: 'var(--lcars-card-button-unavailable)' }
    ]
  }
};

/**
 * Register CB-LCARS button styles pack with the defaults manager
 * @param {MsdDefaultsManager} defaultsManager - The defaults manager instance
 */
export function registerCBLCARSButtonStylesPack(defaultsManager) {
  if (!defaultsManager) {
    cblcarsLog.warn('[CBLCARSButtonStylesPack] No defaults manager provided');
    return;
  }

  // Register all pack defaults
  Object.entries(CB_LCARS_BUTTON_STYLES_PACK.defaults).forEach(([path, value]) => {
    defaultsManager.set('pack', path, value);
  });

  cblcarsLog.debug('[CBLCARSButtonStylesPack] Registered CB-LCARS button styles pack');
}
```

### Step 2: Auto-Register Pack in SystemsManager
**File:** `src/msd/pipeline/SystemsManager.js`

**Location:** In `initializeSystems()` method, after defaults manager creation (~line 85)

```javascript
// ADDED: Store in global CB-LCARS namespace for easy access
if (typeof window !== 'undefined') {
  window.cblcars = window.cblcars || {};
  window.cblcars.defaults = this.defaultsManager;
  cblcarsLog.debug('[SystemsManager] 🔧 MSD Defaults Manager initialized');
}

// NEW: Auto-register CB-LCARS button styles pack
import { registerCBLCARSButtonStylesPack } from '../packs/cblcarsButtonStylesPack.js';
registerCBLCARSButtonStylesPack(this.defaultsManager);
```

### Step 3: Update StatusGridRenderer to Use Pack Defaults
**File:** `src/msd/renderer/StatusGridRenderer.js`

**Location:** Replace the hardcoded preset objects with defaults manager lookups

```javascript
/**
 * Apply CB-LCARS button preset styling using defaults manager
 * @private
 * @param {Object} gridStyle - Current grid style configuration
 * @returns {Object} Enhanced grid style with preset applied
 */
_applyLCARSButtonPreset(gridStyle) {
  const preset = gridStyle.lcars_button_preset;
  if (!preset) return gridStyle;

  // Check if preset is supported
  const supportedPresets = ['lozenge', 'bullet', 'picard-filled', 'picard', 'capped'];
  if (!supportedPresets.includes(preset)) {
    cblcarsLog.warn(`[StatusGridRenderer] Unknown CB-LCARS button preset: ${preset}`);
    return gridStyle;
  }

  const enhancedStyle = { ...gridStyle };

  // Apply base preset defaults first
  const baseDefaults = this._getPresetDefaults('base');
  Object.assign(enhancedStyle, baseDefaults);

  // Apply specific preset defaults
  const presetDefaults = this._getPresetDefaults(preset);
  Object.assign(enhancedStyle, presetDefaults);

  // Apply standard status ranges
  if (!enhancedStyle.status_ranges) {
    enhancedStyle.status_ranges = this._getDefault('status_grid.preset.status_ranges.standard') || [];
  }

  cblcarsLog.debug(`[StatusGridRenderer] Applied CB-LCARS button preset: ${preset}`);
  return enhancedStyle;
}

/**
 * Get preset defaults from defaults manager
 * @private
 * @param {string} presetName - Name of the preset
 * @returns {Object} Preset configuration object
 */
_getPresetDefaults(presetName) {
  const defaults = {};
  const basePath = `status_grid.preset.${presetName}`;

  // List of properties to look up
  const properties = [
    'lcars_text_preset', 'cell_radius', 'cell_color', 'text_padding',
    'font_family', 'font_weight', 'font_size', 'label_position',
    'value_position', 'normalize_radius', 'show_labels', 'show_values'
  ];

  properties.forEach(prop => {
    const value = this._getDefault(`${basePath}.${prop}`);
    if (value !== null) {
      defaults[prop] = value;
    }
  });

  return defaults;
}
```

## Benefits of This Approach

### **For Users:**
- ✅ **Customizable** - `window.cblcars.defaults.set('user', 'status_grid.preset.lozenge.cell_color', 'red')`
- ✅ **Discoverable** - `window.cblcars.defaults.debug()` shows all preset options
- ✅ **Consistent** - same patterns as other MSD features

### **For Developers:**
- ✅ **Maintainable** - presets are configuration data, not code
- ✅ **Extensible** - easy to add new presets or create theme packs
- ✅ **Debuggable** - full introspection via defaults manager

### **For Architecture:**
- ✅ **Consistent** - leverages your existing pack/defaults infrastructure
- ✅ **Future-proof** - easy to add advanced features (scaling, themes, etc.)
- ✅ **Separation of concerns** - styling separated from rendering logic

This approach gives you the best of both worlds: simple one-line configuration for users, but with the full power and flexibility of your MSD defaults system backing it up.
