# Conditional Overlay Visibility Proposal

**Status:** ✅ **IMPLEMENTED** (December 2024)
**Implementation Summary:** `/doc/CONDITIONAL_VISIBILITY_IMPLEMENTATION_SUMMARY.md`
**Quick Reference:** `/doc/CONDITIONAL_VISIBILITY_QUICK_REFERENCE.md`
**Test Config:** `/test/test-conditional-visibility.yaml`

---

**⚠️ NOTE:** This proposal has been fully implemented. The content below represents the original proposal. See the implementation summary for actual implementation details.

---

Looking at your codebase, I can see that you've already laid excellent groundwork for conditional visibility through the Rules Engine. Let me analyze what's already implemented and provide suggestions for a comprehensive conditional visibility system.Let me search for visibility-related code in the MSD system to understand the current implementation.Based on my review of the code and the attached documentation, I can see that we have partial implementation of visibility handling in various parts of the system. Let me provide a comprehensive suggestion for implementing conditional visibility through the Rules Engine.

## Current State Analysis

Looking at the codebase, I can see:

1. **Partial visibility support exists** in some renderers (e.g., `TextOverlayRenderer` has `visibility` attribute support)
2. **Rules Engine** already supports overlay patches and style modifications
3. **Status Grid** has cell-level visibility control (`visible: boolean`)
4. **No unified visibility system** across all overlay types or routing consideration

## Comprehensive Visibility Solution

Here's my suggested implementation:

### 1. Enhanced Rules Engine Visibility Support

First, let's extend the Rules Engine to handle visibility as a first-class style property:

```javascript name=src/msd/rules/RulesEngine.js
// Add to the applyOverlayPatches function
export function applyOverlayPatches(overlays, patches) {
  if (!patches || patches.length === 0) {
    return overlays;
  }

  cblcarsLog.debug('[RulesEngine] 🎨 Applying overlay patches (including visibility):', {
    overlayCount: overlays.length,
    patchCount: patches.length,
    patches: patches.map(p => ({
      id: p.id,
      styleKeys: Object.keys(p.style || {}),
      cellTarget: p.cell_target || p.cellTarget || null,
      visible: p.visible,
      style: p.style
    }))
  });

  const patchMap = new Map(patches.map(patch => [patch.id, patch]));

  return overlays.map(overlay => {
    const patch = patchMap.get(overlay.id);
    if (!patch) {
      return overlay;
    }

    cblcarsLog.debug('[RulesEngine] 🎯 Applying patch to overlay (visibility check):', {
      id: overlay.id,
      type: overlay.type,
      currentVisible: overlay.visible,
      patchVisible: patch.visible,
      cellTarget: patch.cell_target || patch.cellTarget,
      originalStyle: overlay.style,
      patch: patch.style
    });

    // Handle cell-specific patches for status_grid overlays
    if (overlay.type === 'status_grid' && (patch.cell_target || patch.cellTarget)) {
      return applyStatusGridCellPatch(overlay, patch);
    }

    // Standard overlay-level patches with visibility support
    const patchedOverlay = {
      ...overlay,
      style: {
        ...overlay.style,
        ...patch.style
      },
      finalStyle: {
        ...(overlay.finalStyle || overlay.style || {}),
        ...patch.style
      }
    };

    // Apply visibility at overlay level (takes precedence over style.visibility)
    if (patch.visible !== undefined) {
      patchedOverlay.visible = patch.visible;
      // Also apply to style for renderer compatibility
      patchedOverlay.style.visible = patch.visible;
      patchedOverlay.finalStyle.visible = patch.visible;
    }

    // Support both boolean and string visibility values
    if (patch.style?.visibility !== undefined) {
      patchedOverlay.visible = patch.style.visibility === 'visible' || patch.style.visibility === true;
    }

    cblcarsLog.debug('[RulesEngine] ✅ Patched overlay result:', {
      id: patchedOverlay.id,
      visible: patchedOverlay.visible,
      newStyle: patchedOverlay.style,
      newFinalStyle: patchedOverlay.finalStyle
    });

    return patchedOverlay;
  });
}
```

### 2. Unified Visibility Utility

Create a centralized visibility utility:

```javascript name=src/msd/renderer/VisibilityUtils.js
/**
 * Unified visibility handling utilities for all overlay types
 * Provides consistent visibility behavior across the MSD system
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class VisibilityUtils {
  /**
   * Determine if an overlay should be visible based on various sources
   * Priority: overlay.visible > style.visible > style.visibility > default true
   * @param {Object} overlay - Overlay configuration
   * @returns {boolean} True if overlay should be visible
   */
  static isOverlayVisible(overlay) {
    // Direct visible property (highest priority)
    if (overlay.visible !== undefined) {
      return Boolean(overlay.visible);
    }

    // Style visible property (boolean)
    if (overlay.style?.visible !== undefined) {
      return Boolean(overlay.style.visible);
    }

    if (overlay.finalStyle?.visible !== undefined) {
      return Boolean(overlay.finalStyle.visible);
    }

    // Style visibility property (CSS-style)
    if (overlay.style?.visibility !== undefined) {
      return overlay.style.visibility === 'visible';
    }

    if (overlay.finalStyle?.visibility !== undefined) {
      return overlay.finalStyle.visibility === 'visible';
    }

    // Default to visible
    return true;
  }

  /**
   * Get SVG visibility attributes based on overlay visibility
   * @param {Object} overlay - Overlay configuration
   * @returns {string} SVG attributes for visibility
   */
  static getSvgVisibilityAttributes(overlay) {
    const isVisible = this.isOverlayVisible(overlay);

    if (!isVisible) {
      return 'visibility="hidden" opacity="0"';
    }

    // Apply opacity if specified
    const opacity = overlay.style?.opacity ?? overlay.finalStyle?.opacity;
    if (opacity !== undefined && opacity !== 1) {
      return `opacity="${opacity}"`;
    }

    return '';
  }

  /**
   * Filter overlays to only include visible ones
   * @param {Array} overlays - Array of overlay configurations
   * @returns {Array} Filtered array of visible overlays
   */
  static filterVisibleOverlays(overlays) {
    return overlays.filter(overlay => this.isOverlayVisible(overlay));
  }

  /**
   * Get list of overlay IDs that have become hidden
   * @param {Array} previousOverlays - Previous overlay state
   * @param {Array} currentOverlays - Current overlay state
   * @returns {Array} Array of overlay IDs that became hidden
   */
  static getHiddenOverlayIds(previousOverlays, currentOverlays) {
    const prevVisible = new Set(
      this.filterVisibleOverlays(previousOverlays).map(o => o.id)
    );
    const currentVisible = new Set(
      this.filterVisibleOverlays(currentOverlays).map(o => o.id)
    );

    return Array.from(prevVisible).filter(id => !currentVisible.has(id));
  }

  /**
   * Get list of overlay IDs that have become visible
   * @param {Array} previousOverlays - Previous overlay state
   * @param {Array} currentOverlays - Current overlay state
   * @returns {Array} Array of overlay IDs that became visible
   */
  static getShownOverlayIds(previousOverlays, currentOverlays) {
    const prevVisible = new Set(
      this.filterVisibleOverlays(previousOverlays).map(o => o.id)
    );
    const currentVisible = new Set(
      this.filterVisibleOverlays(currentOverlays).map(o => o.id)
    );

    return Array.from(currentVisible).filter(id => !prevVisible.has(id));
  }

  /**
   * Log visibility changes for debugging
   * @param {Array} previousOverlays - Previous overlay state
   * @param {Array} currentOverlays - Current overlay state
   */
  static logVisibilityChanges(previousOverlays, currentOverlays) {
    const hidden = this.getHiddenOverlayIds(previousOverlays, currentOverlays);
    const shown = this.getShownOverlayIds(previousOverlays, currentOverlays);

    if (hidden.length > 0) {
      cblcarsLog.debug('[VisibilityUtils] 👁️ Overlays hidden:', hidden);
    }

    if (shown.length > 0) {
      cblcarsLog.debug('[VisibilityUtils] 👁️ Overlays shown:', shown);
    }
  }
}
```

### 3. Router Enhancement for Visibility

Enhance the Router to handle visibility in path computation:

```javascript name=src/msd/routing/Router.js
import { perfInc } from '../perf/PerfCounters.js';
import { stableStringify } from '../util/stableStringify.js';
import { VisibilityUtils } from '../renderer/VisibilityUtils.js';

/**
 * Router adapter with visibility-aware routing:
 * - Skips routes to/from hidden overlays
 * - Caches per overlay id + endpoints + mode + visibility signature
 * - Invalidates routes when overlay visibility changes
 */
export class Router {
  constructor(routingConfig, anchors, viewBox) {
    this.routingConfig = routingConfig || {};
    this.anchors = anchors || {};
    this.viewBox = viewBox || [0,0,400,200];
    this.cache = new Map(); // overlayId -> { key, d, meta }
    this.visibilityCache = new Map(); // Track overlay visibility for cache invalidation
  }

  updateEnv({ routingConfig, anchors, viewBox, overlays }) {
    if (routingConfig) this.routingConfig = routingConfig;
    if (anchors) this.anchors = anchors;
    if (viewBox) this.viewBox = viewBox;

    // Check for visibility changes and invalidate affected routes
    if (overlays) {
      this._handleVisibilityChanges(overlays);
    }
  }

  /**
   * Check for overlay visibility changes and invalidate affected routes
   * @private
   */
  _handleVisibilityChanges(currentOverlays) {
    const newVisibility = new Map();

    // Build current visibility map
    currentOverlays.forEach(overlay => {
      if (overlay.id) {
        newVisibility.set(overlay.id, VisibilityUtils.isOverlayVisible(overlay));
      }
    });

    // Check for changes
    const changedOverlays = [];
    for (const [overlayId, visible] of newVisibility) {
      const previousVisible = this.visibilityCache.get(overlayId);
      if (previousVisible !== undefined && previousVisible !== visible) {
        changedOverlays.push(overlayId);
      }
    }

    // Invalidate cache for changed overlays
    if (changedOverlays.length > 0) {
      cblcarsLog.debug('[Router] 👁️ Visibility changes detected, invalidating routes:', changedOverlays);
      changedOverlays.forEach(overlayId => {
        this.invalidate(overlayId);
      });
    }

    // Update visibility cache
    this.visibilityCache = newVisibility;
  }

  computePath(overlay, a1, a2, sourceOverlay, targetOverlay) {
    // Check visibility of source and target overlays
    if (sourceOverlay && !VisibilityUtils.isOverlayVisible(sourceOverlay)) {
      cblcarsLog.debug('[Router] ⚫ Skipping route - source overlay hidden:', sourceOverlay.id);
      return { d: '', meta: { strategy: 'hidden-source', visible: false } };
    }

    if (targetOverlay && !VisibilityUtils.isOverlayVisible(targetOverlay)) {
      cblcarsLog.debug('[Router] ⚫ Skipping route - target overlay hidden:', targetOverlay.id);
      return { d: '', meta: { strategy: 'hidden-target', visible: false } };
    }

    const raw = overlay._raw || overlay.raw || {};
    const modeFull = raw.route_mode_full || raw.route_mode || raw.route || 'auto';
    const avoid = raw.avoid || [];
    const channels = raw.route_channels || [];
    const channelMode = raw.route_channel_mode || raw.channel_mode;
    const attachSide = raw.attach_side;

    // Include visibility state in cache key
    const sourceVisible = sourceOverlay ? VisibilityUtils.isOverlayVisible(sourceOverlay) : true;
    const targetVisible = targetOverlay ? VisibilityUtils.isOverlayVisible(targetOverlay) : true;

    const keyObj = {
      a1, a2,
      modeFull,
      avoid: avoid.slice().sort(),
      channels: channels.slice().sort(),
      channelMode,
      attachSide,
      width: overlay.finalStyle?.width,
      corner: overlay.finalStyle?.corner_radius,
      sourceVisible,
      targetVisible
    };

    const key = stableStringify(keyObj);
    const cached = this.cache.get(overlay.id);
    if (cached && cached.key === key) {
      perfInc('connectors.route.cache.hit', 1);
      return cached;
    }
    perfInc('connectors.route.cache.miss', 1);

    // Try legacy advanced routing if available
    let d = `M${a1[0]},${a1[1]} L${a2[0]},${a2[1]}`;
    let meta = { strategy: 'fallback-line', visible: true };

    try {
      const legacy = typeof window !== 'undefined' ? (window.cblcars?.connectors) : null;
      const api = legacy && (legacy.computeOverlayRoute || legacy.computeRoute || legacy.route);
      if (api) {
        const res = api({
          id: overlay.id,
          a1,
          a2,
          overlay,
          sourceOverlay,
          targetOverlay,
          anchors: this.anchors,
          viewBox: this.viewBox,
          routing: this.routingConfig,
          raw
        });
        if (res && typeof res === 'object') {
          if (res.d) {
            d = res.d;
            meta = { strategy: res.strategy || 'legacy', bends: res.bends, cost: res.cost, visible: true };
          } else if (res.path) {
            d = res.path;
            meta = { strategy: res.strategy || 'legacy', visible: true };
          }
        } else if (typeof res === 'string') {
          d = res;
          meta = { strategy: 'legacy-string', visible: true };
        }
      } else {
        const manhattan = legacy?.manhattanRoute;
        if (manhattan) {
          const m = manhattan(a1, a2, raw, this.routingConfig);
          if (m && m.d) {
            d = m.d;
            meta = { strategy: 'legacy-manhattan', visible: true };
          }
        }
      }
      if (meta.strategy.startsWith('fallback')) perfInc('connectors.route.fallback', 1);
    } catch {
      perfInc('connectors.route.fallback', 1);
      d = `M${a1[0]},${a1[1]} L${a2[0]},${a2[1]}`;
      meta = { strategy: 'error-fallback', visible: true };
    }

    const record = { key, d, meta };
    this.cache.set(overlay.id, record);
    return record;
  }

  invalidate(id) {
    if (id === '*') {
      this.cache.clear();
      this.visibilityCache.clear();
    } else {
      this.cache.delete(id);
      this.visibilityCache.delete(id);
    }
  }

  stats() {
    return {
      cacheSize: this.cache.size,
      routingMode: this.routingConfig?.default_mode,
      visibilityCacheSize: this.visibilityCache.size,
      hiddenOverlays: Array.from(this.visibilityCache.entries())
        .filter(([id, visible]) => !visible)
        .map(([id]) => id)
    };
  }
}
```

### 4. Enhanced AdvancedRenderer Integration

Update the AdvancedRenderer to handle visibility throughout the rendering pipeline:

```javascript name=src/msd/renderer/AdvancedRenderer.js
// Add to the render method
render(resolvedModel) {
  return perfTime('advanced.render', () => {
    if (!resolvedModel?.overlays) {
      cblcarsLog.warn('[AdvancedRenderer] ⚠️ No overlays in resolved model');
      return this.svg;
    }

    const { overlays, anchors = {}, viewBox = [0, 0, 400, 200] } = resolvedModel;

    // ENHANCED: Track visibility changes for routing updates
    const previousOverlays = this._lastRenderedOverlays || [];
    this._lastRenderedOverlays = [...overlays];

    // Log visibility changes
    if (previousOverlays.length > 0) {
      VisibilityUtils.logVisibilityChanges(previousOverlays, overlays);
    }

    // Filter to only visible overlays early in the process
    const visibleOverlays = VisibilityUtils.filterVisibleOverlays(overlays);
    const hiddenOverlayIds = overlays
      .filter(o => !VisibilityUtils.isOverlayVisible(o))
      .map(o => o.id);

    cblcarsLog.debug('[AdvancedRenderer] 👁️ Visibility filtering:', {
      totalOverlays: overlays.length,
      visibleOverlays: visibleOverlays.length,
      hiddenOverlays: hiddenOverlayIds.length,
      hiddenIds: hiddenOverlayIds
    });

    // Remove hidden overlays from DOM
    this._removeHiddenOverlays(hiddenOverlayIds);

    // Update router with current overlay visibility state
    if (this.routerCore) {
      this.routerCore.updateEnv({
        routingConfig: resolvedModel.routing,
        anchors,
        viewBox,
        overlays // Pass all overlays so router can track visibility
      });
    }

    // Continue with visible overlays only
    // ... rest of render method using visibleOverlays instead of overlays
  });
}

/**
 * Remove hidden overlays from DOM
 * @private
 */
_removeHiddenOverlays(hiddenOverlayIds) {
  if (!hiddenOverlayIds.length) return;

  const overlayGroup = this._ensureOverlayGroup(this.svg);

  hiddenOverlayIds.forEach(overlayId => {
    const existingGroup = overlayGroup.querySelector(`[data-overlay-id="${overlayId}"]`);
    if (existingGroup) {
      cblcarsLog.debug('[AdvancedRenderer] 🗑️ Removing hidden overlay from DOM:', overlayId);
      existingGroup.remove();
    }
  });
}

// Also update the renderOverlay method to respect visibility
renderOverlay(overlay, anchors, viewBox) {
  // Early return if overlay is not visible
  if (!VisibilityUtils.isOverlayVisible(overlay)) {
    cblcarsLog.debug('[AdvancedRenderer] ⚫ Skipping hidden overlay:', overlay.id);
    return '';
  }

  // Continue with normal rendering...
  // ... rest of the method
}
```

### 5. YAML Configuration Schema Extension

Extend the documentation to show how visibility works in rules:

```yaml
# Example: Conditional visibility rules
rules:
  # Hide temperature display when sensor is unavailable
  - id: hide_temp_when_unavailable
    priority: 1000
    when:
      entity: sensor.temperature
      equals: "unavailable"
    apply:
      overlays:
        - id: temp_display
          visible: false
          # Alternative syntax:
          # style:
          #   visibility: "hidden"

  # Show emergency alert overlay when smoke detected
  - id: show_smoke_alert
    priority: 900
    when:
      entity: binary_sensor.smoke_detector
      equals: "on"
    apply:
      overlays:
        - id: emergency_alert
          visible: true
          style:
            color: "var(--lcars-red)"
            animation: "pulse 1s infinite"

  # Hide maintenance panels during normal operation
  - id: hide_maintenance_panels
    priority: 500
    when:
      entity: input_boolean.maintenance_mode
      equals: "off"
    apply:
      overlays:
        - id: maintenance_panel_1
          visible: false
        - id: maintenance_panel_2
          visible: false
        - id: diagnostic_overlay
          visible: false

  # Show/hide lines based on system status
  - id: hide_offline_connections
    priority: 400
    when:
      entity: sensor.system_online
      equals: "false"
    apply:
      overlays:
        - id: connection_line_1
          visible: false
        - id: connection_line_2
          visible: false
        - id: data_flow_line
          visible: false

  # Conditional cell visibility in status grids
  - id: hide_offline_systems
    priority: 300
    when:
      entity: group.critical_systems
      equals: "unavailable"
    apply:
      overlays:
        - id: systems_grid
          cell_target:
            row: 2  # Hide entire systems row
          visible: false
```

### 6. Integration with Existing Renderers

Update all overlay renderers to support visibility. Here's an example for TextOverlayRenderer:

```javascript name=src/msd/renderer/TextOverlayRenderer.js
// Add to the render method
static render(overlay, anchors, viewBox) {
  // Early visibility check
  if (!VisibilityUtils.isOverlayVisible(overlay)) {
    cblcarsLog.debug('[TextOverlayRenderer] ⚫ Skipping hidden text overlay:', overlay.id);
    return '';
  }

  // ... rest of render method

  // In _applyTextAttributes method:
  _applyTextAttributes(attributes, textStyle, overlayId) {
    // ... existing attributes

    // Enhanced visibility handling
    const visibilityAttrs = VisibilityUtils.getSvgVisibilityAttributes({
      style: textStyle,
      finalStyle: textStyle
    });
    if (visibilityAttrs) {
      attributes.push(visibilityAttrs);
    }

    // ... rest of method
  }
}
```

## Benefits of This Implementation

1. **Unified System**: Single source of truth for visibility across all overlay types
2. **Performance**: Hidden overlays are filtered early and removed from DOM
3. **Smart Routing**: Lines to/from hidden overlays are automatically skipped
4. **Cache Efficiency**: Routing cache is invalidated only when visibility changes
5. **Flexible Rules**: Support both boolean and CSS-style visibility values
6. **Debug-Friendly**: Comprehensive logging of visibility changes
7. **Backward Compatible**: Existing overlays continue to work without changes

## Implementation Priority

1. **Phase 1**: Implement `VisibilityUtils` and basic Rules Engine support
2. **Phase 2**: Enhance Router to handle visibility-aware routing
3. **Phase 3**: Update AdvancedRenderer to filter and track visibility
4. **Phase 4**: Update all individual overlay renderers
5. **Phase 5**: Add comprehensive testing and documentation

This solution provides a robust, performant, and flexible visibility system that integrates seamlessly with your existing Rules Engine and rendering pipeline! 🎯👁️