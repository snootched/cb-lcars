Perfect! Let's create a comprehensive implementation plan that maintains consistency with your existing architecture.Perfect! Now I understand the overlay integration system. Let me create a comprehensive plan based on the MSD architecture patterns.

## Comprehensive Implementation Plan

Based on the search results, I can see the exact integration pattern required. Here's the detailed plan:

### Phase 1: Extract ButtonRenderer Module

**File**: `src/msd/renderer/ButtonRenderer.js`

```javascript
/**
 * [ButtonRenderer] Individual button rendering with full LCARS styling support
 * 🔲 Provides comprehensive button rendering for both status grids and standalone buttons
 */

import { OverlayUtils } from './OverlayUtils.js';
import { RendererUtils } from './RendererUtils.js';
import { DataSourceMixin } from './DataSourceMixin.js';
import { BracketRenderer } from './BracketRenderer.js';
import { ActionHelpers } from './ActionHelpers.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ButtonRenderer {
  constructor() {
    // Connect to defaults manager from global context
    this.defaultsManager = this._resolveDefaultsManager();
    this.stylePresetManager = this._resolveStylePresetManager();
  }

  /**
   * Render a single button with full LCARS styling support
   * @param {Object} config - Button configuration
   * @param {Object} style - Resolved button styling
   * @param {Object} size - Button dimensions {width, height}
   * @param {Object} position - Button position {x, y}
   * @param {Object} options - Additional options {cellId, gridContext, etc}
   * @returns {Object} {markup, actions, metadata}
   */
  static render(config, style, size, position, options = {}) {
    const instance = new ButtonRenderer();
    return instance.renderButton(config, style, size, position, options);
  }

  /**
   * Update button content dynamically
   * @param {Element} buttonElement - DOM element for the button
   * @param {Object} config - Button configuration
   * @param {Object} sourceData - New DataSource data
   * @returns {boolean} True if updated
   */
  static updateButtonData(buttonElement, config, sourceData) {
    const instance = new ButtonRenderer();
    return instance.updateButton(buttonElement, config, sourceData);
  }

  // Implementation methods here...
}
```

**Key extracted methods from StatusGridRenderer**:
- `_resolveCellStyle()` → `resolveButtonStyle()`
- `_renderCellBackground()` → `renderButtonBackground()`
- `_renderCellText()` → `renderButtonText()`
- `_processStatusGridActions()` → `processButtonActions()`

### Phase 2: Add Individual Border & Radius Support

**Enhanced border/radius API** (following your cascade pattern):
```javascript
// In ButtonRenderer.resolveButtonStyle()
const borderStyle = {
  // Global fallbacks
  width: style.border_width || 2,
  color: style.border_color || 'var(--lcars-gray)',
  radius: style.border_radius || 8,

  // Individual overrides (merge over globals)
  top: {
    width: style.border_top?.width || style.border_width || 2,
    color: style.border_top?.color || style.border_color || 'var(--lcars-gray)',
    style: style.border_top?.style || 'solid'
  },
  right: {
    width: style.border_right?.width || style.border_width || 2,
    color: style.border_right?.color || style.border_color || 'var(--lcars-gray)',
    style: style.border_right?.style || 'solid'
  },
  // ... bottom, left

  // Individual corner radius
  topLeft: style.border_radius_top_left || style.border_radius || 8,
  topRight: style.border_radius_top_right || style.border_radius || 8,
  bottomRight: style.border_radius_bottom_right || style.border_radius || 8,
  bottomLeft: style.border_radius_bottom_left || style.border_radius || 8
};
```

**SVG path generation strategy**:
```javascript
// In ButtonRenderer
_generateButtonPath(width, height, borderStyle) {
  // Check if we can use simple rect (all borders/radii same)
  if (this._canUseSimpleRect(borderStyle)) {
    return null; // Use <rect> with rx/ry
  }

  // Generate complex SVG path for individual borders/radii
  return this._buildComplexBorderPath(width, height, borderStyle);
}

_buildComplexBorderPath(width, height, borderStyle) {
  // Similar to BracketRenderer approach - build path with individual curves
  const { topLeft, topRight, bottomRight, bottomLeft } = borderStyle;

  let path = `M ${topLeft} 0`;
  path += ` L ${width - topRight} 0`;
  path += ` Q ${width} 0 ${width} ${topRight}`;
  path += ` L ${width} ${height - bottomRight}`;
  path += ` Q ${width} ${height} ${width - bottomRight} ${height}`;
  path += ` L ${bottomLeft} ${height}`;
  path += ` Q 0 ${height} 0 ${height - bottomLeft}`;
  path += ` L 0 ${topLeft}`;
  path += ` Q 0 0 ${topLeft} 0`;
  path += ` Z`;

  return path;
}
```

### Phase 3: Create Button Overlay Type

**File**: `src/msd/renderer/ButtonOverlayRenderer.js`

Following the exact overlay integration pattern:

```javascript
/**
 * [ButtonOverlayRenderer] Individual LCARS button overlay
 * 🔲 Standalone button with full preset and styling support
 */

import { ButtonRenderer } from './ButtonRenderer.js';
import { OverlayUtils } from './OverlayUtils.js';
import { RendererUtils } from './RendererUtils.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ButtonOverlayRenderer {
  constructor() {
    // Reserved for future use
  }

  /**
   * Render a button overlay with full styling support
   * @param {Object} overlay - Button overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Element} svgContainer - Container element for measurements
   * @returns {string} Complete SVG markup for the styled button
   */
  static render(overlay, anchors, viewBox, svgContainer) {
    const instance = new ButtonOverlayRenderer();
    instance.container = svgContainer;
    instance.viewBox = viewBox;

    // CRITICAL: Pass systemsManager if available for DataSource access
    instance.systemsManager = svgContainer?.systemsManager || window.__msdSystemsManager;

    return instance.renderButton(overlay, anchors, viewBox);
  }

  /**
   * Update button overlay data when DataSource changes
   * @param {Element} overlayElement - Cached DOM element for the overlay
   * @param {Object} overlay - Overlay configuration object
   * @param {Object} sourceData - New DataSource data
   * @returns {boolean} True if content was updated
   */
  static updateButtonData(overlayElement, overlay, sourceData) {
    try {
      // Delegate to ButtonRenderer for actual update
      return ButtonRenderer.updateButtonData(overlayElement, overlay, sourceData);
    } catch (error) {
      cblcarsLog.error(`[ButtonOverlayRenderer] Error updating button overlay ${overlay.id}:`, error);
      return false;
    }
  }

  // Instance methods...
}
```

### Phase 4: Integration Registration

**AdvancedRenderer.js** additions:
```javascript
// Import
import { ButtonOverlayRenderer } from './ButtonOverlayRenderer.js';

// In renderOverlay() method:
case 'button':
  return ButtonOverlayRenderer.render(overlay, anchors, viewBox, svgContainer);

// In updateOverlayData() method:
case 'button':
  cblcarsLog.debug(`[AdvancedRenderer] Updating button overlay: ${overlayId}`);
  const updated = ButtonOverlayRenderer.updateButtonData(overlayElement, overlay, sourceData);
  if (updated) {
    // Handle any post-update logic
  }
  break;
```

**BaseOverlayUpdater.js** additions:
```javascript
// In _registerUpdaters():
this.overlayUpdaters.set('button', {
  needsUpdate: (overlay, sourceData) => this._hasTemplateContent(overlay),
  update: (overlayId, overlay, sourceData) => this._updateButtonOverlay(overlayId, overlay, sourceData),
  hasTemplates: (overlay) => this._hasTemplateContent(overlay)
});

// Add update method:
_updateButtonOverlay(overlayId, overlay, sourceData) {
  if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
    this.systemsManager.renderer.updateOverlayData(overlayId, sourceData);
  } else {
    cblcarsLog.warn(`[BaseOverlayUpdater] No renderer method available for button overlay ${overlayId}`);
  }
}
```

### Phase 5: StatusGridRenderer Integration

**Modified StatusGridRenderer.js**:
```javascript
// Import ButtonRenderer
import { ButtonRenderer } from './ButtonRenderer.js';

// Replace _renderCellBackground and _renderCellText with:
_renderGridCell(cell, cellX, cellY, cellWidth, cellHeight, cellStyle, gridStyle) {
  // Prepare config for ButtonRenderer
  const buttonConfig = {
    id: cell.id,
    content: cell.content,
    label: cell.label,
    actions: cell.actions,
    // ... other cell properties
  };

  const buttonSize = { width: cellWidth, height: cellHeight };
  const buttonPosition = { x: cellX, y: cellY };

  // Delegate to ButtonRenderer
  const result = ButtonRenderer.render(
    buttonConfig,
    cellStyle,
    buttonSize,
    buttonPosition,
    { cellId: cell.id, gridContext: true }
  );

  return result.markup;
}
```

### Phase 6: Enhanced Preset System

**Updated CB_LCARS_BUTTONS_PACK** in `loadBuiltinPacks.js`:
```javascript
style_presets: {
  status_grid: {
    lozenge: {
      // Enhanced with individual borders
      border_top: { width: 3, color: 'var(--lcars-orange)' },
      border_right: { width: 1, color: 'var(--lcars-gray)' },
      border_bottom: { width: 2, color: 'var(--lcars-blue)' },
      border_left: { width: 1, color: 'var(--lcars-gray)' },

      // Individual corner radius
      border_radius_top_left: 12,
      border_radius_top_right: 4,
      border_radius_bottom_right: 12,
      border_radius_bottom_left: 4,

      // Existing preset properties
      lcars_text_preset: 'lozenge',
      cell_color: 'var(--lcars-red)',
      // ...
    },

    capped: {
      // CB-LCARS "capped" style - left rounded, right square
      border_radius_top_left: 'var(--ha-card-border-radius)',
      border_radius_bottom_left: 'var(--ha-card-border-radius)',
      border_radius_top_right: 0,
      border_radius_bottom_right: 0,
      cell_color: 'var(--lcars-card-button)',
      // ...
    }
  },

  // Button overlay presets (same structure)
  button: {
    lozenge: { /* same as status_grid.lozenge */ },
    capped: { /* same as status_grid.capped */ }
  }
}
```

## Implementation Checklist

1. **✅ Extract ButtonRenderer** - Clean separation of button logic
2. **✅ Add individual border/radius** - CSS-like control with SVG paths
3. **✅ Create ButtonOverlayRenderer** - Following exact MSD integration pattern
4. **✅ Register in AdvancedRenderer** - render() and updateOverlayData() methods
5. **✅ Register in BaseOverlayUpdater** - Template detection and update delegation
6. **✅ Update StatusGridRenderer** - Use ButtonRenderer for cells
7. **✅ Enhance preset system** - Individual border syntax in builtin packs
8. **✅ Maintain compatibility** - No breaking changes to existing APIs

This plan maintains full consistency with your MSD architecture while providing the CSS-like controls you need for proper button presets. The modular approach enables both individual buttons and optimized grid rendering.

Would you like me to start with any specific phase, or would you prefer the complete ButtonRenderer implementation first?