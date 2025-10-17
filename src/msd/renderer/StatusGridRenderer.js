/**
 * [StatusGridRenderer] Grid of independent button cells - CB-LCARS button card recreation in grid format
 * 🔲 Each cell can have full CB-LCARS styling with inheritance from grid defaults
 */

import { OverlayUtils } from './OverlayUtils.js';
import { RendererUtils } from './RendererUtils.js';
import { DataSourceMixin } from './DataSourceMixin.js';
import { BracketRenderer } from './BracketRenderer.js';
import { ActionHelpers } from './ActionHelpers.js';
import { ButtonRenderer } from './core/ButtonRenderer.js'; // Add ButtonRenderer import
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';



export class StatusGridRenderer {
  constructor() {
    // Connect to defaults manager from global context
    this.defaultsManager = this._resolveDefaultsManager();
  }

  /**
   * Resolve defaults manager from various sources
   * @private
   * @returns {Object|null} Defaults manager instance
   */
  _resolveDefaultsManager() {
    // 1. Global CB-LCARS namespace (preferred)
    if (window.cblcars?.defaults) {
      return window.cblcars.defaults;
    }

    // 2. Pipeline instance
    const pipelineInstance = window.__msdDebug?.pipelineInstance;
    if (pipelineInstance?.systemsManager?.defaultsManager) {
      return pipelineInstance.systemsManager.defaultsManager;
    }

    // 3. Direct pipeline access
    if (pipelineInstance?.defaultsManager) {
      return pipelineInstance.defaultsManager;
    }

    // 4. Systems manager global reference
    const systemsManager = window.__msdDebug?.systemsManager;
    if (systemsManager?.defaultsManager) {
      return systemsManager.defaultsManager;
    }

    cblcarsLog.debug('[StatusGridRenderer] ⚠️ No defaults manager found');
    return null;
  }

  /**
   * Resolve style preset manager from various sources
   * @private
   * @returns {Object|null} Style preset manager instance
   */
  _resolveStylePresetManager() {
    // 1. Pipeline instance (preferred)
    const pipelineInstance = window.__msdDebug?.pipelineInstance;
    if (pipelineInstance?.systemsManager?.stylePresetManager) {
      cblcarsLog.debug('[StatusGridRenderer] ✅ Connected to style preset manager via pipeline systemsManager');
      return pipelineInstance.systemsManager.stylePresetManager;
    }

    // 2. Systems manager global reference
    const systemsManager = window.__msdDebug?.systemsManager;
    if (systemsManager?.stylePresetManager) {
      cblcarsLog.debug('[StatusGridRenderer] ✅ Connected to style preset manager via global systemsManager');
      return systemsManager.stylePresetManager;
    }

    cblcarsLog.debug('[StatusGridRenderer] ⚠️ No style preset manager found');
    return null;
  }

  /**
   * Get default value from defaults manager with fallback
   * @private
   * @param {string} path - Dot-notation path to the default
   * @param {any} fallback - Fallback value if default not found
   * @returns {any} Default value or fallback
   */
  _getDefault(path, fallback = null) {
    if (this.defaultsManager && typeof this.defaultsManager.resolve === 'function') {
      const resolved = this.defaultsManager.resolve(path);
      return resolved !== null ? resolved : fallback;
    }
    return fallback;
  }

  /**
   * Render a status grid overlay with comprehensive styling support
   * @param {Object} overlay - Status grid overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Object} cardInstance - Reference to custom-button-card instance for action handling
   * @returns {Object} Complete result object with markup, actionInfo, and overlayId
   */
  static render(overlay, anchors, viewBox, cardInstance = null) {
    // Return full result object for AdvancedRenderer to process actions
    return StatusGridRenderer.renderWithActions(overlay, anchors, viewBox, cardInstance);
  }

  /**
   * Render status grid with action metadata
   * @param {Object} overlay - Status grid overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Object} cardInstance - Reference to custom-button-card instance for action handling
   * @returns {Object} Object with markup, actionInfo, and overlayId
   * @static
   */
  static renderWithActions(overlay, anchors, viewBox, cardInstance = null) {
    // Create instance for non-static methods
    const instance = new StatusGridRenderer();
    const result = instance.renderStatusGrid(overlay, anchors, viewBox, cardInstance);

    // Return the result structure for AdvancedRenderer
    return result;
  }

  /**
   * Attach actions immediately using the same pattern as ButtonOverlay
   * @private
   * @static
   */
  static _attachActionsImmediately(overlayId, actionInfo) {
    // Try to find the grid element using the same search pattern as working overlays
    let gridElement = null;

    // Method 1: Use renderer mount element (same as ButtonOverlay)
    const renderer = window.__msdDebug?.pipelineInstance?.systemsManager?.renderer;
    if (renderer && renderer.mountEl) {
      const overlayGroup = renderer.mountEl.querySelector('#msd-overlay-container');
      if (overlayGroup) {
        gridElement = overlayGroup.querySelector(`[data-overlay-id="${overlayId}"]`);
      }
    }

    // Method 2: Card shadow DOM fallback
    if (!gridElement) {
      const card = window.cb_lcars_card_instance;
      if (card && card.shadowRoot) {
        gridElement = card.shadowRoot.querySelector(`[data-overlay-id="${overlayId}"]`);
      }
    }

    // Method 3: Document search (last resort)
    if (!gridElement) {
      gridElement = document.querySelector(`[data-overlay-id="${overlayId}"]`);
    }

    if (gridElement && actionInfo) {
      cblcarsLog.debug(`[StatusGridRenderer] 🎯 IMMEDIATE action attachment for ${overlayId}`);

      // CRITICAL: Use the proven ActionHelpers pattern
      if (actionInfo.cells && Array.isArray(actionInfo.cells)) {
        // Process each cell's actions individually using the same pattern as working buttons
        actionInfo.cells.forEach(cell => {
          if (cell.actions && (cell.actions.tap_action || cell.actions.hold_action || cell.actions.double_tap_action)) {
            // Find ALL elements for this cell (rect, text, etc.) - same as working pattern
            const cellElements = gridElement.querySelectorAll(`[data-cell-id="${cell.id}"]`);

            cellElements.forEach(cellElement => {
              // Use ActionHelpers individual cell attachment (proven to work)
              StatusGridRenderer._attachSingleCellActions(cellElement, cell.actions, actionInfo.cardInstance, cell.id);
            });
          }
        });
      }

      cblcarsLog.debug(`[StatusGridRenderer] ✅ Immediate action attachment completed for ${overlayId}`);
    } else {
      cblcarsLog.debug(`[StatusGridRenderer] ⚠️ Could not find grid element for immediate attachment: ${overlayId}`);
      // Store for later as fallback
      StatusGridRenderer._storeActionInfo(overlayId, actionInfo);
    }
  }

  /**
   * Attach actions to a single cell element using the proven ActionHelpers pattern
   * @private
   * @static
   */
  static _attachSingleCellActions(cellElement, actions, cardInstance, cellId) {
    if (!cellElement || !actions || !cardInstance) {
      cblcarsLog.warn(`[StatusGridRenderer] Missing parameters for single cell action attachment: ${cellId}`);
      return;
    }

    cblcarsLog.debug(`[StatusGridRenderer] 🔗 Attaching actions to single cell element ${cellId}:`, {
      elementType: cellElement.tagName,
      hasActions: !!actions,
      hasTapAction: !!actions.tap_action,
      hasCardInstance: !!cardInstance
    });

    // CRITICAL: Set pointer events and cursor (same as working buttons)
    cellElement.style.pointerEvents = 'visiblePainted';
    cellElement.style.cursor = 'pointer';

    // CRITICAL: Use the same event attachment pattern as working ActionHelpers
    if (actions.tap_action) {
      const actionHandler = (event) => {
        cblcarsLog.debug(`[StatusGridRenderer] 🎯 Cell tap action triggered for ${cellId}:`, actions.tap_action);

        // Prevent event bubbling
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Execute action via ActionHelpers bridge (same as working buttons)
        if (window.ActionHelpers && typeof window.ActionHelpers.executeActionViaButtonCardBridge === 'function') {
          window.ActionHelpers.executeActionViaButtonCardBridge(actions.tap_action, cardInstance, 'tap');
        } else {
          // Fallback to direct execution
          StatusGridRenderer._executeActionDirect(actions.tap_action, cardInstance);
        }

        return false;
      };

      // Add multiple event listeners for reliability (same as working pattern)
      cellElement.addEventListener('click', actionHandler, { capture: true, passive: false });
      cellElement.addEventListener('click', actionHandler, { capture: false, passive: false });
      cellElement.addEventListener('touchend', actionHandler, { capture: true, passive: false });
    }

    // Add hold action handler if present
    if (actions.hold_action) {
      StatusGridRenderer._attachHoldAction(cellElement, actions.hold_action, cardInstance);
    }

    // Add double-tap action handler if present
    if (actions.double_tap_action) {
      StatusGridRenderer._attachDoubleTapAction(cellElement, actions.double_tap_action, cardInstance);
    }

    // Mark as successfully attached
    cellElement.setAttribute('data-actions-attached', 'true');
    cellElement.setAttribute('data-action-attachment-time', Date.now().toString());

    cblcarsLog.debug(`[StatusGridRenderer] ✅ Single cell action attachment completed for ${cellId}`);
  }

  /**
   * Execute action directly as fallback
   * @private
   * @static
   */
  static _executeActionDirect(action, cardInstance) {
    try {
      if (cardInstance && typeof cardInstance._handleAction === 'function') {
        cardInstance._handleAction(action);
      } else if (cardInstance && typeof cardInstance.handleAction === 'function') {
        cardInstance.handleAction(action);
      } else {
        cblcarsLog.warn(`[StatusGridRenderer] No action handler available on card instance`);
      }
    } catch (error) {
      cblcarsLog.error(`[StatusGridRenderer] Error executing action directly:`, error);
    }
  }

  /**
   * Attach hold action using proven pattern
   * @private
   * @static
   */
  static _attachHoldAction(element, holdAction, cardInstance) {
    let holdTimer = null;
    let isHolding = false;

    const startHold = (event) => {
      isHolding = true;
      holdTimer = setTimeout(() => {
        if (isHolding) {
          event.preventDefault();
          event.stopPropagation();

          cblcarsLog.debug(`[StatusGridRenderer] ✋ Hold action triggered:`, holdAction);

          if (window.ActionHelpers && typeof window.ActionHelpers.executeActionViaButtonCardBridge === 'function') {
            window.ActionHelpers.executeActionViaButtonCardBridge(holdAction, cardInstance, 'hold');
          } else {
            StatusGridRenderer._executeActionDirect(holdAction, cardInstance);
          }
        }
      }, 500);
    };

    const endHold = () => {
      isHolding = false;
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    };

    element.addEventListener('mousedown', startHold);
    element.addEventListener('mouseup', endHold);
    element.addEventListener('mouseleave', endHold);
    element.addEventListener('touchstart', startHold);
    element.addEventListener('touchend', endHold);
    element.addEventListener('touchcancel', endHold);
  }

  /**
   * Attach double-tap action using proven pattern
   * @private
   * @static
   */
  static _attachDoubleTapAction(element, doubleTapAction, cardInstance) {
    let lastTap = 0;

    element.addEventListener('click', (event) => {
      const now = Date.now();
      const timeDiff = now - lastTap;

      if (timeDiff < 300 && lastTap > 0) {
        // Double-tap detected
        event.preventDefault();
        event.stopPropagation();

        cblcarsLog.debug(`[StatusGridRenderer] 🖱️🖱️ Double-tap action triggered:`, doubleTapAction);

        if (window.ActionHelpers && typeof window.ActionHelpers.executeActionViaButtonCardBridge === 'function') {
          window.ActionHelpers.executeActionViaButtonCardBridge(doubleTapAction, cardInstance, 'double_tap');
        } else {
          StatusGridRenderer._executeActionDirect(doubleTapAction, cardInstance);
        }

        lastTap = 0; // Reset to prevent triple-tap
      } else {
        lastTap = now;
      }
    });
  }

  /**
   * Instance method for comprehensive status grid rendering
   * @param {Object} overlay - Status grid overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Object} cardInstance - Reference to custom-button-card instance for action handling
   * @returns {Object} {markup, actionInfo, overlayId}
   */
  renderStatusGrid(overlay, anchors, viewBox, cardInstance = null) {
    const position = OverlayUtils.resolvePosition(overlay.position, anchors);
    if (!position) {
      cblcarsLog.warn('[StatusGridRenderer] ⚠️ Status grid overlay position could not be resolved:', overlay.id);
      return { markup: '', actionInfo: null, overlayId: overlay.id };
    }

    const [x, y] = position;
    const size = overlay.size || [200, 150];
    const [width, height] = size;

    try {
      // Simple style approach: use overlay.style directly
      const style = overlay.style || {};
      const gridStyle = this._resolveStatusGridStyles(style, overlay.id, overlay);
      const animationAttributes = this._prepareAnimationAttributes(overlay, style);

      // Get cell configurations
      const cells = this._resolveCellConfigurations(overlay, gridStyle);
      cblcarsLog.debug(`[StatusGridRenderer] 🔲 Rendering ${cells.length} cells for grid ${overlay.id}`);

      // Render status grid
      const gridMarkup = this._renderEnhancedStatusGrid(
        overlay, x, y, width, height, cells,
        gridStyle, animationAttributes
      );

      // CHANGED: Process actions using the new pattern
      const actionInfo = this._processStatusGridActions(overlay, cells, gridStyle, cardInstance);

      // Return new structure
      return {
        markup: gridMarkup,
        actionInfo: actionInfo,
        overlayId: overlay.id
      };

    } catch (error) {
      cblcarsLog.error(`[StatusGridRenderer] ❌ Rendering failed for status grid ${overlay.id}:`, error);
      return {
        markup: this._renderFallbackStatusGrid(overlay, x, y, width, height),
        actionInfo: null,
        overlayId: overlay.id
      };
    }
  }

  /**
   * Resolve comprehensive status grid styling from configuration
   * @private
   */
  _resolveStatusGridStyles(style, overlayId, overlay = null) {

    // ✅ Resolve tokens FIRST
    const resolvedStyle = this._resolveTokensInStyle(style, overlay);

    // ✅ ADDED: Debug logging to verify token resolution
    cblcarsLog.debug('[StatusGridRenderer] 🎨 Token resolution for', overlayId, ':', {
      inputCellColor: style.cell_color,
      resolvedCellColor: resolvedStyle.cell_color,
      isTokenReference: this._isTokenReference(style.cell_color),
      hasTokenResolver: !!themeTokenResolver
    });

    // Preserve the original overlay style for cascading to cells
    const originalOverlayStyle = overlay?.style || {};
    const overlayStyle = { ...resolvedStyle }; // Create a copy to avoid mutation

    // Parse all standard styles using unified system
    const standardStyles = RendererUtils.parseAllStandardStyles(resolvedStyle);

    const gridStyle = {
      // Grid layout - prioritize overlay direct properties, then overlay.style, then defaults
      rows: Number(overlay?.rows || overlayStyle?.rows || this._getDefault('status_grid.rows', 3)),
      columns: Number(overlay?.columns || overlayStyle?.columns || this._getDefault('status_grid.columns', 4)),
      cell_width: Number(overlayStyle.cell_width || 0), // 0 = auto
      cell_height: Number(overlayStyle.cell_height || 0), // 0 = auto
      cell_gap: Number(overlayStyle.cell_gap || this._getDefault('status_grid.cell_gap', 2)),

      // Proportional sizing configuration
      row_sizes: overlayStyle.row_sizes || null,
      column_sizes: overlayStyle.column_sizes || null,
      row_heights: overlayStyle.row_heights || null,
      column_widths: overlayStyle.column_widths || null,

      // Cell appearance (using standardized colors with defaults manager fallbacks)
      cell_color: resolvedStyle.cell_color || this._getDefault('status_grid.cell_color', 'var(--lcars-blue)'),
      cell_opacity: resolvedStyle.cell_opacity || standardStyles.layout.opacity || this._getDefault('status_grid.cell_opacity', 1.0),
      cell_radius: Number(resolvedStyle.cell_radius || standardStyles.layout.borderRadius || this._getDefault('status_grid.cell_radius', 2)),
      normalize_radius: overlayStyle.normalize_radius !== false, // Default true unless explicitly set to false
      match_ha_radius: overlayStyle.match_ha_radius !== false, // Default true unless explicitly set to false

      // Border (using standardized layout with defaults manager fallbacks)
      cell_border: overlayStyle.cell_border !== false,
      border_color: resolvedStyle.border_color || standardStyles.colors.borderColor || this._getDefault('status_grid.border_color', 'var(--lcars-gray)'),
      border_width: resolvedStyle.border_width || standardStyles.layout.borderWidth || this._getDefault('status_grid.border_width', 1),

      // Text (using standardized text styles with defaults manager fallbacks)
      show_labels: overlayStyle.show_labels !== false,
      show_values: overlayStyle.show_values || false, // Default to false per documentation
      label_color: standardStyles.text.labelColor || overlayStyle.label_color || this._getDefault('status_grid.label_color', 'var(--lcars-white)'),
      value_color: standardStyles.text.valueColor || overlayStyle.value_color || this._getDefault('status_grid.value_color', 'var(--lcars-white)'),
      font_size: Number(overlayStyle.font_size) || Math.max(standardStyles.text.fontSize || 12, this._getDefault('status_grid.font_size', 18)),
      font_family: standardStyles.text.fontFamily || overlayStyle.font_family || this._getDefault('status_grid.font_family', 'var(--lcars-font-family, Antonio)'),
      font_weight: standardStyles.text.fontWeight || overlayStyle.font_weight || this._getDefault('status_grid.font_weight', 'normal'),

      // Enhanced text sizing and positioning system (using defaults manager)
      label_font_size: Number(overlayStyle.label_font_size) || Number(overlayStyle.font_size) || this._getDefault('status_grid.label_font_size', 18),
      value_font_size: Number(overlayStyle.value_font_size) || (Number(overlayStyle.font_size) ? Number(overlayStyle.font_size) * 0.9 : this._getDefault('status_grid.value_font_size', 16)),

      // Enhanced positioning system - allows CB-LCARS button card recreation
      text_layout: overlayStyle.text_layout || 'stacked', // stacked, side-by-side, label-only, value-only, custom
      text_alignment: overlayStyle.text_alignment || 'center', // center, top, bottom, custom
      text_justify: overlayStyle.text_justify || 'center', // left, center, right

      // Flexible positioning - supports both predefined and custom positions
      label_position: overlayStyle.label_position || 'center-top', // Predefined or custom object
      value_position: overlayStyle.value_position || 'center-bottom', // Predefined or custom object

      // Legacy positioning (backward compatible but calculated intelligently)
      text_spacing: this._calculateSmartTextSpacing(overlayStyle), // Intelligent spacing calculation
      label_offset_y: this._calculateSmartLabelOffset(overlayStyle), // Smart label positioning
      value_offset_y: this._calculateSmartValueOffset(overlayStyle), // Smart value positioning

      // Advanced layout options (using defaults manager)
      text_padding: Number(overlayStyle.text_padding || this._getDefault('status_grid.text_padding', 8)),
      text_margin: Number(overlayStyle.text_margin || this._getDefault('status_grid.text_margin', 2)),
      text_wrap: overlayStyle.text_wrap || false, // Enable text wrapping
      max_text_width: overlayStyle.max_text_width || '90%', // Max width as percentage
      text_overflow: overlayStyle.text_overflow || 'ellipsis', // ellipsis, clip, none

      // CB-LCARS specific positioning presets
      lcars_text_preset: overlayStyle.lcars_text_preset || null, // lozenge, bullet, corner, etc.

      // CB-LCARS Button Presets - simple and direct
      lcars_button_preset: overlayStyle.lcars_button_preset || null, // lozenge, bullet, picard-filled, etc.

      // Status coloring
      status_mode: (overlayStyle.status_mode || 'auto').toLowerCase(),
      status_ranges: this._parseStatusRanges(overlayStyle.status_ranges),
      unknown_color: standardStyles.colors.disabledColor,

      // Grid features
      show_grid_lines: overlayStyle.show_grid_lines || false,
      grid_line_color: overlayStyle.grid_line_color || standardStyles.colors.borderColor,
      grid_line_opacity: Number(overlayStyle.grid_line_opacity || 0.3),
      grid_line_width: Number(overlayStyle.grid_line_width || 1), // Added missing grid line width control

      // Effects (using standardized effect parsing)
      gradient: standardStyles.gradient,
      pattern: standardStyles.pattern,
      glow: standardStyles.glow,
      shadow: standardStyles.shadow,
      blur: standardStyles.blur,

      // LCARS-specific features
      bracket_style: overlayStyle.bracket_style || false,
      bracket_color: overlayStyle.bracket_color || standardStyles.colors.primaryColor,
      bracket_width: Number(overlayStyle.bracket_width || 2),
      bracket_gap: Number(overlayStyle.bracket_gap || 4),
      bracket_extension: Number(overlayStyle.bracket_extension || 8),
      bracket_opacity: Number(overlayStyle.bracket_opacity || 1),
      bracket_corners: overlayStyle.bracket_corners || 'both',
      bracket_sides: overlayStyle.bracket_sides || 'both',
      // Enhanced bg-grid style bracket options
      bracket_physical_width: Number(overlayStyle.bracket_physical_width || overlayStyle.bracket_extension || 8),
      bracket_height: overlayStyle.bracket_height || '100%',
      bracket_radius: Number(overlayStyle.bracket_radius || 4),
      // LCARS container/border options
      border_top: Number(overlayStyle.border_top || 0),
      border_left: Number(overlayStyle.border_left || 0),
      border_right: Number(overlayStyle.border_right || 0),
      border_bottom: Number(overlayStyle.border_bottom || 0),
      border_color: overlayStyle.border_color || null,
      border_radius: Number(overlayStyle.border_radius || 8),
      inner_factor: Number(overlayStyle.inner_factor || 2),
      hybrid_mode: overlayStyle.hybrid_mode || false,
      status_indicator: overlayStyle.status_indicator || false,
      lcars_corners: overlayStyle.lcars_corners || false,

      // Interaction (using standardized interaction styles)
      hover_enabled: standardStyles.interaction.hoverEnabled,
      hover_color: standardStyles.colors.hoverColor,
      hover_scale: standardStyles.interaction.hoverScale,

      // Animation (using standardized animation styles)
      animatable: standardStyles.animation.animatable,
      cascade_speed: standardStyles.animation.cascadeSpeed,
      cascade_direction: standardStyles.animation.cascadeDirection,
      reveal_animation: standardStyles.animation.revealAnimation,
      pulse_on_change: standardStyles.animation.pulseOnChange,

      // Actions
      actions: overlayStyle.actions || null,

      // Performance options
      update_throttle: Number(overlayStyle.update_throttle || 100),

      // Track enabled features for optimization
      features: [],

      // Store parsed standard styles for reference
      standardStyles,

      // Store BOTH the raw overlay style for cascading AND processed overlay style
      rawOverlayStyle: originalOverlayStyle, // Raw style for pure cascading
      overlayStyle: overlayStyle // Processed style for grid-level decisions
    };

    // Apply CB-LCARS Button Preset if specified
    if (gridStyle.lcars_button_preset) {
      this._applyButtonPreset(gridStyle, gridStyle.lcars_button_preset, overlayStyle);
    }

    // Build feature list for conditional rendering
    if (gridStyle.gradient) gridStyle.features.push('gradient');
    if (gridStyle.pattern) gridStyle.features.push('pattern');
    if (gridStyle.status_ranges && gridStyle.status_ranges.length > 0) gridStyle.features.push('status-ranges');
    if (gridStyle.glow) gridStyle.features.push('glow');
    if (gridStyle.shadow) gridStyle.features.push('shadow');
    if (gridStyle.blur) gridStyle.features.push('blur');
    if (gridStyle.show_grid_lines) gridStyle.features.push('grid-lines');
    if (gridStyle.show_labels) gridStyle.features.push('labels');
    if (gridStyle.show_values) gridStyle.features.push('values');
    if (gridStyle.bracket_style) gridStyle.features.push('brackets');
    if (gridStyle.status_indicator) gridStyle.features.push('status');
    if (gridStyle.lcars_corners) gridStyle.features.push('lcars-corners');
    if (gridStyle.hover_enabled) gridStyle.features.push('hover');
    if (gridStyle.cascade_speed > 0) gridStyle.features.push('cascade');
    if (gridStyle.reveal_animation) gridStyle.features.push('reveal');
    if (gridStyle.pulse_on_change) gridStyle.features.push('pulse');
    if (gridStyle.actions) gridStyle.features.push('actions');
    if (gridStyle.lcars_button_preset) gridStyle.features.push('cb-button-preset');

    cblcarsLog.debug(`[StatusGridRenderer] 📊 Final gridStyle:`, {
      rows: gridStyle.rows,
      columns: gridStyle.columns,
      lcars_button_preset: gridStyle.lcars_button_preset,
      rawOverlayStyleKeys: Object.keys(gridStyle.rawOverlayStyle || {}),
      processedOverlayStyleKeys: Object.keys(gridStyle.overlayStyle || {}),
      // Additional grid debugging
      totalExpectedCells: gridStyle.rows * gridStyle.columns,
      gridDimensionsSource: {
        overlayRows: overlay?.rows,
        overlayColumns: overlay?.columns,
        styleRows: overlayStyle?.rows,
        styleColumns: overlayStyle?.columns,
        finalRows: gridStyle.rows,
        finalColumns: gridStyle.columns
      }
    });

    return gridStyle;
  }

  /**
   * Check if a value is a token reference
   * @private
   * @param {string} value - Value to check
   * @returns {boolean} True if value is a token reference
   */
  _isTokenReference(value) {
    if (typeof value !== 'string') return false;
    const tokenCategories = ['colors', 'typography', 'spacing', 'borders', 'effects', 'animations', 'components'];
    return tokenCategories.some(category => value.startsWith(`${category}.`));
  }

  /**
   * Resolve all token references in style object
   * This runs BEFORE _resolveStatusGridStyles to ensure tokens are resolved early
   * @private
   * @param {Object} style - Style configuration with potential token references
   * @param {Object} overlay - Overlay configuration for context
   * @returns {Object} Style with all tokens resolved to actual values
   */
  _resolveTokensInStyle(style, overlay) {
    // Create component-scoped token resolver
    const resolveToken = themeTokenResolver ? themeTokenResolver.forComponent('statusGrid') : null;

    if (!resolveToken) {
      return style; // No token system, return unchanged
    }

    // Helper to resolve a single property
    const resolveProperty = (value) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'string' && this._isTokenReference(value)) {
          const resolved = resolveToken(value, value, { viewBox: this.viewBox });
          return resolved;
        }
      }
      return value;
    };

    // Resolve all style properties
    return {
      ...style,
      cell_color: resolveProperty(style.cell_color),
      cell_gap: resolveProperty(style.cell_gap),
      cell_radius: resolveProperty(style.cell_radius),
      cell_opacity: resolveProperty(style.cell_opacity),
      border_color: resolveProperty(style.border_color),
      border_width: resolveProperty(style.border_width),
      status_on_color: resolveProperty(style.status_on_color),
      status_off_color: resolveProperty(style.status_off_color),
      status_unavailable_color: resolveProperty(style.status_unavailable_color),
      status_unknown_color: resolveProperty(style.status_unknown_color),
      font_family: resolveProperty(style.font_family),
      font_size: resolveProperty(style.font_size),
      label_font_size: resolveProperty(style.label_font_size),
      value_font_size: resolveProperty(style.value_font_size),
      label_color: resolveProperty(style.label_color),
      value_color: resolveProperty(style.value_color),
      text_padding: resolveProperty(style.text_padding),
      hover_color: resolveProperty(style.hover_color)
    };
  }


  /**
   * Apply CB-LCARS button preset using StylePresetManager
   * @private
   * @param {Object} gridStyle - Grid style object to modify
   * @param {string} presetName - Name of the button preset
   * @param {Object} originalStyle - Original user style for checking explicit values
   */
  _applyButtonPreset(gridStyle, presetName, originalStyle = {}) {
    cblcarsLog.debug(`[StatusGridRenderer] 🎨 Applying CB-LCARS button preset: ${presetName}`);
    cblcarsLog.debug(`[StatusGridRenderer] 🔍 Original style before preset:`, originalStyle);

    // Load preset from StylePresetManager
    const presetStyles = this._loadPresetFromStylePresetManager('status_grid', presetName);

    if (!presetStyles) {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Button preset '${presetName}' not found in StylePresetManager`);
      return;
    }

    cblcarsLog.debug(`[StatusGridRenderer] 📦 Loaded preset styles for '${presetName}':`, presetStyles);

    // Apply preset properties with user override protection
    this._applyPresetStyles(gridStyle, presetStyles, originalStyle);

    cblcarsLog.debug(`[StatusGridRenderer] ✅ Applied preset ${presetName} with ${Object.keys(presetStyles).length} properties`);
  }

  /**
   * Apply preset styles with user override protection
   * @private
   */
  _applyPresetStyles(gridStyle, presetStyles, originalStyle = {}) {
    Object.entries(presetStyles).forEach(([property, value]) => {
      // Only set value if user didn't explicitly provide it
      if (originalStyle[property] === undefined) {
        gridStyle[property] = value;
        cblcarsLog.debug(`[StatusGridRenderer] 📝 Preset set ${property}: ${value}`);
      } else {
        cblcarsLog.debug(`[StatusGridRenderer] 🚫 User explicit value for ${property}, skipping preset`);
      }
    });

    cblcarsLog.debug(`[StatusGridRenderer] ✅ Applied preset styles with user override protection`);
  }

  /**
   * Load preset from StylePresetManager
   * @private
   * @param {string} overlayType - Type of overlay (e.g., 'status_grid')
   * @param {string} presetName - Name of the preset
   * @returns {Object|null} Preset configuration or null if not found
   */
  _loadPresetFromStylePresetManager(overlayType, presetName) {
    const stylePresetManager = this._resolveStylePresetManager();

    if (stylePresetManager) {
      cblcarsLog.debug(`[StatusGridRenderer] 🔍 StylePresetManager found, checking for preset ${presetName}:`, {
        initialized: stylePresetManager.initialized,
        packCount: stylePresetManager.loadedPacks?.length,
        cacheSize: stylePresetManager.presetCache?.size
      });

      const preset = stylePresetManager.getPreset(overlayType, presetName);
      if (preset) {
        cblcarsLog.debug(`[StatusGridRenderer] ✅ Found preset ${presetName} via StylePresetManager`);
        return preset;
      } else {
        cblcarsLog.debug(`[StatusGridRenderer] ❌ StylePresetManager returned null for ${overlayType}.${presetName}`);
      }
    } else {
      cblcarsLog.debug(`[StatusGridRenderer] ❌ No StylePresetManager available`);
    }

    return null;
  }

  /**
   * Resolve individual cell styling with proper cascade hierarchy
   * Order: overlay.preset → overlay.specific → cell.preset → cell.specific
   * @private
   * @param {Object} cellConfig - Individual cell configuration
   * @param {Object} gridStyle - Grid-level default styles (already includes overlay.preset)
   * @param {number} cellWidth - Calculated cell width
   * @param {number} cellHeight - Calculated cell height
   * @returns {Object} Complete cell styling with proper inheritance
   */
  _resolveCellStyle(cellConfig, gridStyle, cellWidth, cellHeight) {
    const cellStyle = cellConfig.style || {};
    const overlayStyle = gridStyle.rawOverlayStyle || {}; // Use raw overlay style for proper cascading

    // STEP 1: Start with overlay.preset (already applied to gridStyle)
    const baseStyle = {
      // Visual properties from grid (includes overlay.preset)
      color: gridStyle.cell_color,
      border_color: gridStyle.border_color,
      border_width: gridStyle.border_width,
      border_radius: gridStyle.cell_radius,
      opacity: gridStyle.cell_opacity,

      // Text styling from grid (includes overlay.preset)
      label_color: gridStyle.label_color,
      value_color: gridStyle.value_color,
      font_size: gridStyle.font_size,
      font_family: gridStyle.font_family,
      font_weight: gridStyle.font_weight,
      label_font_size: gridStyle.label_font_size,
      value_font_size: gridStyle.value_font_size,

      // Positioning from grid (includes overlay.preset)
      label_position: gridStyle.label_position,
      value_position: gridStyle.value_position,
      text_padding: gridStyle.text_padding,
      text_margin: gridStyle.text_margin,

      // CB-LCARS features from grid (includes overlay.preset)
      lcars_button_preset: gridStyle.lcars_button_preset,
      lcars_text_preset: gridStyle.lcars_text_preset,
      bracket_style: gridStyle.bracket_style,
      bracket_color: gridStyle.bracket_color,

      // Control visibility from grid (includes overlay.preset)
      show_labels: gridStyle.show_labels,
      show_values: gridStyle.show_values
    };

    // STEP 2: Apply overlay.specific (overlay.style properties)
    const overlaySpecificStyle = this._applyOverlaySpecificStyles(baseStyle, overlayStyle);

    // STEP 3: Apply cell.preset if specified
    const cellPresetStyle = this._applyCellPresetStyles(overlaySpecificStyle, cellConfig);

    // STEP 4: Apply cell.specific (cell.style + cell direct properties)
    const finalCellStyle = this._applyCellSpecificStyles(cellPresetStyle, cellConfig, cellStyle);

    // Apply special cell radius resolution
    finalCellStyle.border_radius = this._resolveCellRadius(cellConfig, gridStyle, cellWidth, cellHeight);

    // Parse through RendererUtils for full CB-LCARS support on final merged style
    const mergedConfigForRendererUtils = {
      ...overlayStyle,
      ...cellStyle,
      ...cellConfig
    };
    const cellStandardStyles = RendererUtils.parseAllStandardStyles(mergedConfigForRendererUtils);

    // Override with any advanced features from RendererUtils
    finalCellStyle.gradient = cellStandardStyles.gradient;
    finalCellStyle.pattern = cellStandardStyles.pattern;
    finalCellStyle.glow = cellStandardStyles.glow;
    finalCellStyle.shadow = cellStandardStyles.shadow;
    finalCellStyle.blur = cellStandardStyles.blur;

    // Store for reference
    finalCellStyle.standardStyles = cellStandardStyles;
    finalCellStyle.mergedConfig = mergedConfigForRendererUtils;

    return finalCellStyle;
  }

  /**
   * Apply overlay.specific styles (step 2 of cascade)
   * @private
   */
  _applyOverlaySpecificStyles(baseStyle, overlayStyle) {
    const overlaySpecificStyle = { ...baseStyle };

    // Apply overlay.style properties that override overlay.preset
    Object.entries(overlayStyle).forEach(([property, value]) => {
      if (value !== undefined && value !== null) {
        // Map overlay properties to cell style properties
        switch (property) {
          case 'cell_color':
            overlaySpecificStyle.color = value;
            break;
          case 'cell_radius':
            overlaySpecificStyle.border_radius = value;
            break;
          case 'cell_opacity':
            overlaySpecificStyle.opacity = value;
            break;
          case 'border_color':
            overlaySpecificStyle.border_color = value;
            break;
          case 'border_width':
            overlaySpecificStyle.border_width = value;
            break;
          default:
            // Direct property mapping
            if (overlaySpecificStyle.hasOwnProperty(property)) {
              overlaySpecificStyle[property] = value;
            }
            break;
        }
      }
    });

    return overlaySpecificStyle;
  }

  /**
   * Apply cell.preset styles (step 3 of cascade)
   * @private
   */
  _applyCellPresetStyles(overlaySpecificStyle, cellConfig) {
    const cellPresetStyle = { ...overlaySpecificStyle };

    // Check if cell has its own preset
    const cellPresetName = cellConfig.lcars_button_preset || cellConfig.style?.lcars_button_preset;

    if (cellPresetName) {
      cblcarsLog.debug(`[StatusGridRenderer] 🎨 Applying cell preset "${cellPresetName}" to cell ${cellConfig.id || 'unknown'}`);

      const presetStyles = this._loadPresetFromStylePresetManager('status_grid', cellPresetName);

      if (presetStyles) {
        // Apply cell preset styles (overrides overlay.specific)
        Object.entries(presetStyles).forEach(([property, value]) => {
          if (value !== undefined && value !== null) {
            // Map preset properties to cell style properties
            switch (property) {
              case 'cell_color':
                cellPresetStyle.color = value;
                break;
              case 'cell_radius':
                cellPresetStyle.border_radius = value;
                break;
              case 'cell_opacity':
                cellPresetStyle.opacity = value;
                break;
              default:
                // Direct property mapping
                if (cellPresetStyle.hasOwnProperty(property)) {
                  cellPresetStyle[property] = value;
                }
                break;
            }
          }
        });

        cblcarsLog.debug(`[StatusGridRenderer] ✅ Applied cell preset ${cellPresetName} with ${Object.keys(presetStyles).length} properties`);
      }
    }

    return cellPresetStyle;
  }

  /**
   * Apply cell.specific styles (step 4 of cascade - highest priority)
   * @private
   */
  _applyCellSpecificStyles(cellPresetStyle, cellConfig, cellStyle) {
    const finalCellStyle = { ...cellPresetStyle };

    // Apply cell.style properties (override cell.preset)
    Object.entries(cellStyle).forEach(([property, value]) => {
      if (value !== undefined && value !== null) {
        // FIXED: Direct property mapping without transformation
        finalCellStyle[property] = value;
      }
    });

    // Apply cell direct properties (highest priority - override everything)
    Object.entries(cellConfig).forEach(([property, value]) => {
      if (value !== undefined && value !== null && property !== 'style' && property !== 'id') {
        // FIXED: Direct property mapping for all border properties
        finalCellStyle[property] = value;
      }
    });

    return finalCellStyle;
  }

  /**
   * Resolve cell border radius with inheritance and normalization
   * @private
   */
  _resolveCellRadius(cellConfig, gridStyle, cellWidth, cellHeight) {
    // Cell-specific radius takes precedence
    let radius = cellConfig.border_radius !== undefined ?
      Number(cellConfig.border_radius) : gridStyle.cell_radius;

    // Apply normalization if enabled at grid level
    if (gridStyle.normalize_radius && cellConfig.border_radius === undefined) {
      radius = this._calculateNormalizedRadius(cellWidth, cellHeight, radius, gridStyle.match_ha_radius);
    }

    return radius;
  }  /**
   * Calculate intelligent text spacing based on font sizes
   * @private
   * @param {Object} style - Style configuration
   * @returns {number} Calculated text spacing in pixels
   */
  _calculateSmartTextSpacing(style) {
    // If explicitly set, use that value
    if (style.text_spacing !== undefined) {
      return Number(style.text_spacing);
    }

    // Calculate based on font sizes
    const labelFontSize = Number(style.label_font_size || style.font_size || 18);
    const valueFontSize = Number(style.value_font_size || (labelFontSize * 0.9));

    // Use the larger font size as basis for spacing (prevents overlap)
    const maxFontSize = Math.max(labelFontSize, valueFontSize);

    // Intelligent spacing: 30% of the larger font size, minimum 4px
    return Math.max(4, Math.round(maxFontSize * 0.3));
  }

  /**
   * Calculate intelligent label positioning based on font size
   * @private
   * @param {Object} style - Style configuration
   * @returns {number} Calculated label offset in pixels
   */
  _calculateSmartLabelOffset(style) {
    // If explicitly set, use that value
    if (style.label_offset_y !== undefined) {
      return Number(style.label_offset_y);
    }

    const labelFontSize = Number(style.label_font_size || style.font_size || 18);
    const spacing = this._calculateSmartTextSpacing(style);

    // Position label above center by half spacing + 20% of font size
    return -(spacing * 0.5 + labelFontSize * 0.2);
  }

  /**
   * Calculate intelligent value positioning based on font size
   * @private
   * @param {Object} style - Style configuration
   * @returns {number} Calculated value offset in pixels
   */
  _calculateSmartValueOffset(style) {
    // If explicitly set, use that value
    if (style.value_offset_y !== undefined) {
      return Number(style.value_offset_y);
    }

    const valueFontSize = Number(style.value_font_size || (style.font_size || 18) * 0.9);
    const spacing = this._calculateSmartTextSpacing(style);

    // Position value below center by half spacing + 40% of font size
    return spacing * 0.5 + valueFontSize * 0.4;
  }

  /**
   * Parse status ranges configuration
   * @private
   */
  _parseStatusRanges(statusRanges) {
    if (!statusRanges || !Array.isArray(statusRanges)) return [];

    return statusRanges.map(range => ({
      min: Number(range.min ?? -Infinity),
      max: Number(range.max ?? Infinity),
      color: range.color || 'var(--lcars-blue)',
      label: range.label || null,
      // Support string matching too
      value: range.value || null,
      state: range.state || null
    }));
  }

  /**
   * Calculate text position based on enhanced positioning system
   * @private
   * @param {string|Object} position - Position specification ('center-top', 'bottom-left', or {x: '20%', y: '80%'})
   * @param {number} cellX - Cell X coordinate
   * @param {number} cellY - Cell Y coordinate
   * @param {number} cellWidth - Cell width
   * @param {number} cellHeight - Cell height
   * @param {Object} gridStyle - Grid styling configuration
   * @param {string} textType - 'label' or 'value' for context-aware positioning
   * @returns {Object} {x, y, anchor, baseline} positioning information
   */
  _calculateEnhancedTextPosition(position, cellX, cellY, cellWidth, cellHeight, gridStyle, textType = 'label') {
    const basePadding = gridStyle.text_padding || 8; // Increased default

    // Get effective cell radius and calculate smart padding
    const cornerRadius = this._getEffectiveCellRadius(gridStyle, cellWidth, cellHeight);
    const fontSize = textType === 'label' ? (gridStyle.label_font_size || 18) : (gridStyle.value_font_size || 16);
    const padding = this._calculateSmartPadding(basePadding, cornerRadius, fontSize);

    // Check if position is explicitly set (not from preset)
    const isExplicitPosition = position && (
      typeof position === 'object' ||
      (typeof position === 'string' && !['left', 'right', 'center'].includes(position))
    );

    // Handle LCARS presets ONLY if position is not explicitly set
    if (gridStyle.lcars_text_preset && !isExplicitPosition) {
      return this._calculateLCARSPresetPosition(gridStyle.lcars_text_preset, cellX, cellY, cellWidth, cellHeight, gridStyle, textType);
    }

    // Custom position object
    if (typeof position === 'object' && position !== null) {
      const x = this._parsePositionValue(position.x || '50%', cellWidth, cellX);
      const y = this._parsePositionValue(position.y || '50%', cellHeight, cellY);
      return {
        x: x + cellX,
        y: y + cellY,
        anchor: position.anchor || 'middle',
        baseline: position.baseline || 'middle'
      };
    }

    // Predefined position strings
    const positionMap = {
      // Center positions
      'center': { x: '50%', y: '50%', anchor: 'middle', baseline: 'middle' },
      'center-top': { x: '50%', y: padding + 'px', anchor: 'middle', baseline: 'hanging' },
      'center-bottom': { x: '50%', y: (cellHeight - padding) + 'px', anchor: 'middle', baseline: 'baseline' },

      // Corner positions (perfect for LCARS lozenge/bullet styles)
      'top-left': { x: padding + 'px', y: padding + 'px', anchor: 'start', baseline: 'hanging' },
      'top-right': { x: (cellWidth - padding) + 'px', y: padding + 'px', anchor: 'end', baseline: 'hanging' },
      'bottom-left': { x: padding + 'px', y: (cellHeight - padding) + 'px', anchor: 'start', baseline: 'baseline' },
      'bottom-right': { x: (cellWidth - padding) + 'px', y: (cellHeight - padding) + 'px', anchor: 'end', baseline: 'baseline' },

      // Edge centers
      'left': { x: padding + 'px', y: '50%', anchor: 'start', baseline: 'middle' },
      'right': { x: (cellWidth - padding) + 'px', y: '50%', anchor: 'end', baseline: 'middle' },
      'top': { x: '50%', y: padding + 'px', anchor: 'middle', baseline: 'hanging' },
      'bottom': { x: '50%', y: (cellHeight - padding) + 'px', anchor: 'middle', baseline: 'baseline' },

      // CB-LCARS specific positions for button card compatibility
      'south-east': { x: (cellWidth - padding) + 'px', y: (cellHeight - padding) + 'px', anchor: 'end', baseline: 'baseline' },
      'north-west': { x: padding + 'px', y: padding + 'px', anchor: 'start', baseline: 'hanging' },
      'south-west': { x: padding + 'px', y: (cellHeight - padding) + 'px', anchor: 'start', baseline: 'baseline' },
      'north-east': { x: (cellWidth - padding) + 'px', y: padding + 'px', anchor: 'end', baseline: 'hanging' },
    };

    const positionSpec = positionMap[position] || positionMap['center'];

    return {
      x: cellX + this._parsePositionValue(positionSpec.x, cellWidth, 0),
      y: cellY + this._parsePositionValue(positionSpec.y, cellHeight, 0),
      anchor: positionSpec.anchor,
      baseline: positionSpec.baseline
    };
  }

  /**
   * Get the effective corner radius that will be applied to a cell
   * @private
   * @param {Object} gridStyle - Grid styling configuration
   * @param {number} cellWidth - Cell width
   * @param {number} cellHeight - Cell height
   * @returns {number} Effective corner radius in pixels
   */
  _getEffectiveCellRadius(gridStyle, cellWidth, cellHeight) {
    let radius = gridStyle.cell_radius;

    // Apply radius normalization if enabled
    if (gridStyle.normalize_radius) {
      radius = this._calculateNormalizedRadius(cellWidth, cellHeight, radius, gridStyle.match_ha_radius);
    }

    return radius;
  }

  /**
   * Calculate intelligent padding that respects corner radius to prevent text cutoff
   * @private
   * @param {number} basePadding - Base padding value
   * @param {number} cornerRadius - Corner radius of the cell
   * @param {number} fontSize - Font size for text clearance
   * @returns {number} Adjusted padding value
   */
  _calculateSmartPadding(basePadding, cornerRadius, fontSize = 18) {
    // Ensure all inputs are valid numbers
    basePadding = Number(basePadding) || 8;
    cornerRadius = Number(cornerRadius) || 0;
    fontSize = Number(fontSize) || 18;

    // For rounded corners, we need extra padding to avoid text cutoff
    // The corner radius creates a "dead zone" where text shouldn't be placed

    // Calculate the "safe zone" distance from corner
    // This is roughly 70% of the radius (trigonometric approximation)
    const cornerClearance = cornerRadius * 0.7;

    // Add extra padding for font clearance (about 20% of font size)
    const fontClearance = fontSize * 0.2;

    // Use the larger of: base padding, corner clearance, or minimum for font
    const result = Math.max(basePadding, cornerClearance + fontClearance, fontSize * 0.3);

    // Ensure result is a valid number
    return isNaN(result) ? basePadding : result;
  }

  /**
   * Calculate LCARS preset positions (lozenge, bullet, etc.)
   * @private
   * @param {string} preset - LCARS preset name
   * @param {number} cellX - Cell X coordinate
   * @param {number} cellY - Cell Y coordinate
   * @param {number} cellWidth - Cell width
   * @param {number} cellHeight - Cell height
   * @param {Object} gridStyle - Grid styling configuration
   * @param {string} textType - 'label' or 'value'
   * @returns {Object} Position information
   */
  _calculateLCARSPresetPosition(preset, cellX, cellY, cellWidth, cellHeight, gridStyle, textType) {
    const basePadding = gridStyle.text_padding || 8; // Increased default to match main default
    const margin = gridStyle.text_margin || 2;

    // Get the actual corner radius that will be applied to this cell
    const cornerRadius = this._getEffectiveCellRadius(gridStyle, cellWidth, cellHeight);

    // Calculate smart padding that respects corner radius
    const fontSize = textType === 'label' ? (gridStyle.label_font_size || 18) : (gridStyle.value_font_size || 16);
    const smartPadding = this._calculateSmartPadding(basePadding, cornerRadius, fontSize);

    switch (preset) {
      case 'lozenge':
        // Lozenge style: label top-left, value bottom-right
        if (textType === 'label') {
          return {
            x: cellX + smartPadding,
            y: cellY + smartPadding + fontSize * 0.8,
            anchor: 'start',
            baseline: 'hanging'
          };
        } else {
          // Better responsive positioning for bottom-right value
          // Use proportional positioning instead of edge-based for better balance
          const proportionalY = cellY + cellHeight * 0.85; // 85% down from top, not edge-based
          return {
            x: cellX + cellWidth - smartPadding,
            y: proportionalY,
            anchor: 'end',
            baseline: 'baseline'
          };
        }

      case 'bullet':
        // Bullet style: label left, value right (side by side)
        if (textType === 'label') {
          return {
            x: cellX + smartPadding,
            y: cellY + cellHeight / 2,
            anchor: 'start',
            baseline: 'middle'
          };
        } else {
          return {
            x: cellX + cellWidth - smartPadding,
            y: cellY + cellHeight / 2,
            anchor: 'end',
            baseline: 'middle'
          };
        }

      case 'corner':
        // Corner style: both in south-east corner, stacked
        const cornerX = cellX + cellWidth - smartPadding;

        if (textType === 'label') {
          return {
            x: cornerX,
            y: cellY + cellHeight - smartPadding - fontSize - margin,
            anchor: 'end',
            baseline: 'baseline'
          };
        } else {
          return {
            x: cornerX,
            y: cellY + cellHeight - smartPadding,
            anchor: 'end',
            baseline: 'baseline'
          };
        }

      case 'badge':
        // Badge style: label top-center, value center
        if (textType === 'label') {
          return {
            x: cellX + cellWidth / 2,
            y: cellY + smartPadding + fontSize * 0.8,
            anchor: 'middle',
            baseline: 'hanging'
          };
        } else {
          return {
            x: cellX + cellWidth / 2,
            y: cellY + cellHeight / 2,
            anchor: 'middle',
            baseline: 'middle'
          };
        }

      default:
        // Fallback to center positioning
        return {
          x: cellX + cellWidth / 2,
          y: cellY + cellHeight / 2,
          anchor: 'middle',
          baseline: 'middle'
        };
    }
  }

  /**
   * Parse position value (percentage, pixel, or relative)
   * @private
   * @param {string|number} value - Position value ('50%', '10px', or number)
   * @param {number} dimension - Container dimension (width or height)
   * @param {number} offset - Base offset
   * @returns {number} Calculated position in pixels
   */
  _parsePositionValue(value, dimension, offset = 0) {
    // Ensure dimension is a valid number
    dimension = Number(dimension) || 100;

    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }

    const stringValue = String(value);

    if (stringValue.includes('%')) {
      const percentage = parseFloat(stringValue.replace('%', ''));
      const result = (dimension * percentage) / 100;
      return isNaN(result) ? 0 : result;
    }

    if (stringValue.includes('px')) {
      const result = parseFloat(stringValue.replace('px', ''));
      return isNaN(result) ? 0 : result;
    }

    // Try to parse as number
    const numValue = parseFloat(stringValue);
    return isNaN(numValue) ? 0 : numValue;
  }

  /**
   * Prepare animation attributes for anime.js integration
   * @private
   */
  _prepareAnimationAttributes(overlay, style) {
    const animationStyles = RendererUtils.parseStandardAnimationStyles(style);

    const animationAttributes = {
      gridAttributes: [],
      cellAttributes: [],
      hasAnimations: false
    };

    // Use standardized animation data attributes
    const animationDataAttrs = RendererUtils.createAnimationDataAttributes(animationStyles);
    if (animationDataAttrs) {
      animationAttributes.gridAttributes.push(animationDataAttrs);
      animationAttributes.hasAnimations = true;
    }

    return animationAttributes;
  }

  /**
   * Complete Status Grid rendering with all features
   * @private
   */
  _renderEnhancedStatusGrid(overlay, x, y, width, height, cells, gridStyle, animationAttributes) {
    // Calculate cell dimensions with proportional sizing support
    const { cellWidths, cellHeights } = this._calculateProportionalCellDimensions(width, height, gridStyle);
    const gap = gridStyle.cell_gap;

    // Check if overlay has actions (actions should now be preserved in main overlay by ModelBuilder)
    const hasActions = !!(overlay.tap_action || overlay.hold_action || overlay.double_tap_action || gridStyle.actions);

    // CRITICAL: Check if ANY cell has actions to determine grid container cursor
    const hasCellActions = cells.some(cell =>
      cell.actions && (cell.actions.tap_action || cell.actions.hold_action || cell.actions.double_tap_action)
    );

    // FIXED: Grid container should use 'visiblePainted' and 'pointer' cursor when cells have actions
    const gridPointerEvents = hasCellActions ? 'visiblePainted' : 'all';
    const gridCursor = hasCellActions ? 'pointer' : 'default';

    let gridMarkup = `<g data-overlay-id="${overlay.id}"
                data-overlay-type="status_grid"
                data-grid-rows="${gridStyle.rows}"
                data-grid-columns="${gridStyle.columns}"
                data-grid-features="${gridStyle.features.join(',')}"
                data-animation-ready="${!!animationAttributes.hasAnimations}"
                data-cascade-direction="${gridStyle.cascade_direction}"
                data-has-cell-actions="${hasCellActions}"
                style="pointer-events: ${gridPointerEvents}; cursor: ${gridCursor};"
                transform="translate(${x}, ${y})">`;

    cblcarsLog.debug(`[StatusGridRenderer] 🏗️ Building grid SVG with ${gridStyle.rows}x${gridStyle.columns} layout using ButtonRenderer`, {
      hasCellActions,
      gridPointerEvents,
      gridCursor
    });

    // Render grid background if enabled
    if (gridStyle.show_grid_lines) {
      gridMarkup += `<rect width="${width}" height="${height}"
                     fill="none" stroke="${gridStyle.grid_line_color}"
                     stroke-width="${gridStyle.grid_line_width}" opacity="${gridStyle.grid_line_opacity}"
                     style="pointer-events: none;"/>`;
    }

    // Render each cell using ButtonRenderer
    cells.forEach(cell => {
      // Calculate cell position using proportional sizing
      const cellX = this._calculateCellX(cell.col, cellWidths, gap);
      const cellY = this._calculateCellY(cell.row, cellHeights, gap);
      const cellWidth = cellWidths[cell.col];
      const cellHeight = cellHeights[cell.row];

      // Resolve complete cell styling with inheritance from grid defaults
      const cellStyle = this._resolveCellStyle(cell.config, gridStyle, cellWidth, cellHeight);

      // Debug: Check if this cell has specific actions
      const cellHasActions = !!(cell.actions && (cell.actions.tap_action || cell.actions.hold_action || cell.actions.double_tap_action));

      cblcarsLog.debug(`[StatusGridRenderer] 🔲 Rendering cell ${cell.id} using ButtonRenderer:`, {
        cellHasActions: cellHasActions,
        cellActions: cell.actions,
        position: [cellX, cellY],
        size: [cellWidth, cellHeight]
      });

      // Render cell using ButtonRenderer for consistency
      gridMarkup += this._renderGridCellWithButtonRenderer(
        cell, cellX, cellY, cellWidth, cellHeight, cellStyle, gridStyle, hasActions, cellHasActions
      );
    });

    gridMarkup += '</g>';

    // Add brackets around the entire grid if enabled
    if (gridStyle.bracket_style) {
      const bracketSvg = this._buildBrackets(width, height, gridStyle, overlay.id);
      if (bracketSvg) {
        gridMarkup = gridMarkup.slice(0, -4) + bracketSvg + '</g>'; // Insert before closing </g>
      }
    }

    return gridMarkup;
  }

  /**
   * Render grid cell using ButtonRenderer for consistency and enhanced features
   * @private
   */
  _renderGridCellWithButtonRenderer(cell, cellX, cellY, cellWidth, cellHeight, cellStyle, gridStyle, hasActions, cellHasActions) {
    // DEBUG: Log what we're actually passing to ButtonRenderer
    if (cell.id === 'bed_light_cell') {
      cblcarsLog.debug(`[StatusGridRenderer] 🔍 DEBUG bed_light_cell style cascade:`, {
        cellConfig: cell.config,
        resolvedCellStyle: cellStyle,
        hasIndividualBorders: !!(cellStyle.border_top || cellStyle.border_right || cellStyle.border_bottom || cellStyle.border_left),
        hasIndividualRadius: !!(cellStyle.border_radius_top_left !== undefined || cellStyle.border_radius_top_right !== undefined),
        borderTop: cellStyle.border_top,
        borderRadiusTopLeft: cellStyle.border_radius_top_left,
        cellHasActions: cellHasActions
      });
    }

    // CRITICAL: Ensure the cellStyle includes action information for ButtonRenderer
    if (cellHasActions) {
      cellStyle.actions = true; // Signal to ButtonRenderer that this button has actions
      if (!cellStyle.standardStyles) {
        cellStyle.standardStyles = {};
      }
      if (!cellStyle.standardStyles.interaction) {
        cellStyle.standardStyles.interaction = {};
      }
      cellStyle.standardStyles.interaction.hasActions = true;
    }

    // Prepare button configuration for ButtonRenderer
    const buttonConfig = {
      id: cell.id,
      row: cell.row,
      col: cell.col,
      label: cell.label,
      content: cell.content,
      tap_action: cell.actions?.tap_action || null,
      hold_action: cell.actions?.hold_action || null,
      double_tap_action: cell.actions?.double_tap_action || null,
      // Store raw content for updates
      _raw: cell._raw || cell.config,
      _originalContent: cell._originalContent
    };

    // CRITICAL: Log action configuration for debugging
    if (cellHasActions) {
      cblcarsLog.debug(`[StatusGridRenderer] 🎯 Cell ${cell.id} has actions:`, {
        tap_action: buttonConfig.tap_action,
        hold_action: buttonConfig.hold_action,
        double_tap_action: buttonConfig.double_tap_action,
        cellStyleHasActions: cellStyle.actions,
        interactionHasActions: cellStyle.standardStyles?.interaction?.hasActions
      });
    }

    // CRITICAL: Use the SAME action processing path as standalone buttons
    // Pass cardInstance to ButtonRenderer so it can use the same action processing
    const result = ButtonRenderer.render(
      buttonConfig,
      cellStyle,
      { width: cellWidth, height: cellHeight },
      { x: cellX, y: cellY },
      {
        cellId: cell.id,
        gridContext: true, // Important: this is a grid cell context
        cardInstance: this._resolveCardInstance(),
        hasActions: cellHasActions // Pass action flag to ButtonRenderer
      }
    );

    return result.markup;
  }

  /**
   * Resolve card instance for action handling
   * @private
   */
  _resolveCardInstance() {
    // Try various methods to get the card instance
    if (window.__msdDebug?.pipelineInstance?.cardInstance) {
      return window.__msdDebug.pipelineInstance.cardInstance;
    }

    if (window._msdCardInstance) {
      return window._msdCardInstance;
    }

    if (window.cb_lcars_card_instance) {
      return window.cb_lcars_card_instance;
    }

    return null;
  }

  /**
   * Resolve card instance for action handling from global context
   * @private
   * @static
   */
  static _resolveCardInstance() {
    // Try various methods to get the card instance

    // Method 1: From MSD pipeline if available
    if (window.__msdDebug?.pipelineInstance?.cardInstance) {
      return window.__msdDebug.pipelineInstance.cardInstance;
    }

    // Method 2: From global MSD context
    if (window._msdCardInstance) {
      return window._msdCardInstance;
    }

    // Method 3: From CB-LCARS global context
    if (window.cb_lcars_card_instance) {
      return window.cb_lcars_card_instance;
    }

    cblcarsLog.debug(`[StatusGridRenderer] Could not resolve card instance from global context`);
    return null;
  }

  /**
   * Set the global card instance for action handling
   * @param {Object} cardInstance - The custom-button-card instance
   * @static
   */
  static setCardInstance(cardInstance) {
    window._msdCardInstance = cardInstance;
    cblcarsLog.debug(`[StatusGridRenderer] Card instance set for action handling`);
  }

  // Cell configuration resolution with DataSource integration
  _resolveCellConfigurations(overlay, gridStyle) {
    const cells = [];

    // Check multiple sources for cells configuration
    const cellsConfig = overlay.cells || overlay._raw?.cells || overlay.raw?.cells;

    cblcarsLog.debug(`[StatusGridRenderer] 🔍 Resolving cells for ${gridStyle.rows}x${gridStyle.columns} grid:`, {
      gridDimensions: `${gridStyle.rows}x${gridStyle.columns}`,
      totalExpectedCells: gridStyle.rows * gridStyle.columns,
      explicitCellsProvided: cellsConfig ? cellsConfig.length : 0,
      cellsConfigSource: cellsConfig ? 'explicit' : 'generated'
    });

    // Use explicit cell definitions if provided
    if (cellsConfig && Array.isArray(cellsConfig)) {
      cblcarsLog.debug(`[StatusGridRenderer] 🔍 Processing ${cellsConfig.length} explicit cells for ${gridStyle.rows}x${gridStyle.columns} grid`);

      cellsConfig.forEach((cellConfig, index) => {
        // Calculate position based on grid dimensions, not array index
        const totalCells = gridStyle.rows * gridStyle.columns;

        // Get raw content and resolve it
        const rawCellContent = this._getCellContentFromSources(cellConfig);
        const cellContent = this._resolveCellContent(rawCellContent);

        // Debug: Log cell config parsing
        const cellActions = {
          tap_action: cellConfig.tap_action || null,
          hold_action: cellConfig.hold_action || null,
          double_tap_action: cellConfig.double_tap_action || null
        };

        // Calculate row/col position based on grid dimensions
        let row, col;
        if (cellConfig.position && Array.isArray(cellConfig.position) && cellConfig.position.length === 2) {
          // Explicit position provided
          row = cellConfig.position[0];
          col = cellConfig.position[1];
        } else {
          // Calculate position based on index and grid dimensions
          if (index < totalCells) {
            row = Math.floor(index / gridStyle.columns);
            col = index % gridStyle.columns;
          } else {
            // Cell index exceeds grid capacity - skip or wrap
            cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Cell ${index} exceeds ${gridStyle.rows}x${gridStyle.columns} grid capacity, skipping`);
            return; // Skip this cell
          }
        }

        cblcarsLog.debug(`[StatusGridRenderer] 🔍 Parsing cell ${cellConfig.id || `cell-${index}`}:`, {
          index,
          calculatedPosition: [row, col],
          explicitPosition: cellConfig.position,
          cellConfig: cellConfig,
          extractedActions: cellActions,
          hasTapAction: !!cellConfig.tap_action,
          hasHoldAction: !!cellConfig.hold_action
        });

        const cell = {
          id: cellConfig.id || `cell-${index}`,
          row: row,
          col: col,
          index,
          source: cellConfig.source || cellConfig.data_source,
          label: cellConfig.label || `Cell ${index + 1}`,
          content: cellContent, // Use unified content resolution
          data: {
            value: cellConfig.value || cellContent || null,
            state: cellConfig.state || 'unknown',
            timestamp: Date.now()
          },
          lastUpdate: Date.now(),
          animationDelay: index * (gridStyle.cascade_speed || 50),
          _raw: cellConfig._raw || cellConfig,
          // Store original content for updates
          _originalContent: rawCellContent !== cellContent ? rawCellContent : null,

          // Store full cell configuration for styling inheritance
          config: cellConfig,

          // Cell actions
          actions: cellActions
        };

        cells.push(cell);
      });
    } else {
      cblcarsLog.debug(`[StatusGridRenderer] No explicit cells found, generating ${gridStyle.rows}x${gridStyle.columns} grid`);

      // Generate grid cells based on rows/columns
      const totalCells = gridStyle.rows * gridStyle.columns;
      for (let i = 0; i < totalCells; i++) {
        const row = Math.floor(i / gridStyle.columns);
        const col = i % gridStyle.columns;

        cells.push({
          id: `cell-${row}-${col}`,
          row,
          col,
          index: i,
          source: null,
          label: `${String.fromCharCode(65 + row)}${col + 1}`,
          content: null,
          data: {
            value: Math.random() > 0.5 ? 'ONLINE' : 'OFFLINE',
            state: Math.random() > 0.5 ? 'good' : 'bad',
            timestamp: Date.now()
          },
          lastUpdate: Date.now(),
          animationDelay: i * (gridStyle.cascade_speed || 50)
        });
      }
    }

    return cells;
  }

  /**
   * Get raw cell content from various sources with consistent priority
   * @private
   * @param {Object} cell - Cell configuration object
   * @returns {string} Raw content (may contain templates/conditionals)
   */
  _getCellContentFromSources(cell) {
    // Unified content source priority:
    // 1. _originalContent (for updates)
    // 2. _raw.content (preferred source)
    // 3. _raw.label (fallback)
    // 4. content (direct)
    // 5. label (final fallback)
    return cell._originalContent ||
           cell._raw?.content ||
           cell._raw?.label ||
           cell.content ||
           cell.label ||
           '';
  }

  /**
   * Resolve cell content for both initial render and updates
   * Handles both standard DataSource templates and conditional expressions
   * @private
   * @param {string} cellContent - Raw cell content (may contain templates/conditionals)
   * @param {Object} [updateDataSourceData] - Fresh DataSource data (for updates)
   * @returns {string} Resolved content ready for rendering
   */
  _resolveCellContent(cellContent, updateDataSourceData = null) {
    if (!cellContent || typeof cellContent !== 'string') {
      return cellContent || '';
    }

    // Quick exit if no template markers at all
    const hasMSD = cellContent.includes('{');
    const hasHA = cellContent.includes('{{') && cellContent.includes('}}');
    if (!hasMSD && !hasHA) {
      return cellContent;
    }

    // MSD-style inline conditional support stays (only for { ... ? ... : ... } style)
    if (cellContent.includes('?') && cellContent.includes(':') && hasMSD) {
      return this._processConditionalWithDataSourceMixin(cellContent, updateDataSourceData);
    }

    // Unified processing (handles both HA {{}} and MSD {})
    return DataSourceMixin.processUnifiedTemplateStrings(cellContent, 'StatusGridRenderer');
  }

  /**
   * Process conditional expression by extracting DataSource references and using DataSourceMixin
   * @private
   * @param {string} conditionalTemplate - Template with conditional expression
   * @param {Object} [updateDataSourceData] - Updated DataSource data to use (for updates)
   * @returns {string} Resolved conditional or original template
   */
  _processConditionalWithDataSourceMixin(conditionalTemplate, updateDataSourceData = null) {
    try {
      // Extract the conditional expression from the template
      const templateMatch = conditionalTemplate.match(/\{([^}]+)\}/);
      if (!templateMatch) return conditionalTemplate;

      const expression = templateMatch[1];

      // Parse the conditional: "path operator value ? trueValue : falseValue"
      const conditionMatch = expression.match(/^(.+?)\s*([><=!]+)\s*(.+?)\s*\?\s*'(.+?)'\s*:\s*'(.+?)'$/);
      if (!conditionMatch) {
        cblcarsLog.warn(`[StatusGridRenderer] Could not parse conditional: ${expression}`);
        return conditionalTemplate;
      }

      const [, leftPath, operator, rightValue, trueValue, falseValue] = conditionMatch;

      // Create a simple template with just the DataSource reference
      const dataSourceTemplate = `{${leftPath.trim()}}`;

      let resolvedValue;

      // If we have update data, try to extract the value directly first
      if (updateDataSourceData) {
        resolvedValue = this._extractValueFromUpdateData(leftPath.trim(), updateDataSourceData);
      }

      // If we couldn't extract from update data, fall back to DataSourceMixin
      if (resolvedValue === null || resolvedValue === undefined) {
        resolvedValue = DataSourceMixin.processEnhancedTemplateStringsWithFallback(dataSourceTemplate, 'StatusGridRenderer');
      }

      // If DataSourceMixin couldn't resolve it, return original
      if (resolvedValue === dataSourceTemplate) {
        return conditionalTemplate;
      }

      // Parse the resolved value and apply conditional logic
      const leftVal = parseFloat(resolvedValue);
      const rightVal = parseFloat(rightValue.trim());

      if (isNaN(leftVal) || isNaN(rightVal)) {
        cblcarsLog.warn(`[StatusGridRenderer] Could not parse numeric values: left="${resolvedValue}" (${leftVal}), right="${rightValue.trim()}" (${rightVal})`);
        return conditionalTemplate;
      }

      // Evaluate condition
      let result = false;
      switch (operator.trim()) {
        case '>': result = leftVal > rightVal; break;
        case '<': result = leftVal < rightVal; break;
        case '>=': result = leftVal >= rightVal; break;
        case '<=': result = leftVal <= rightVal; break;
        case '==': result = leftVal == rightVal; break;
        case '!=': result = leftVal != rightVal; break;
        default:
          cblcarsLog.warn(`[StatusGridRenderer] Unknown operator: ${operator}`);
          return conditionalTemplate;
      }

      const finalValue = result ? trueValue : falseValue;
      cblcarsLog.debug(`[StatusGridRenderer] Conditional result: ${leftVal} ${operator} ${rightVal} = ${result} → "${finalValue}"`);
      return finalValue;

    } catch (error) {
      cblcarsLog.error(`[StatusGridRenderer] Error processing conditional with DataSourceMixin:`, error);
      return conditionalTemplate;
    }
  }

  /**
   * Extract value from update DataSource data based on path
   * @private
   * @param {string} path - DataSource path (e.g., "temperature_enhanced.transformations.celsius")
   * @param {Object} updateData - Updated DataSource data
   * @returns {*} Extracted value or null if not found
   */
  _extractValueFromUpdateData(path, updateData) {
    const pathParts = path.split('.');

    // For simple paths, use the raw value
    if (pathParts.length === 1) {
      return updateData?.v || updateData?.value || null;
    }

    // For complex paths like "temperature_enhanced.transformations.celsius"
    let value = updateData;

    // Skip the first part (source name) and navigate the rest
    for (let i = 1; i < pathParts.length; i++) {
      const part = pathParts[i];

      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        cblcarsLog.debug(`[StatusGridRenderer] Path "${part}" not found in update data, falling back to DataSourceMixin`);
        return null;
      }
    }

    return value;
  }

  _renderFallbackStatusGrid(overlay, x, y, width, height) {
    const style = overlay.finalStyle || overlay.style || {};
    const color = style.cell_color || style.color || 'var(--lcars-gray)';

    cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Using fallback rendering for status grid ${overlay.id}`);

    return `<g data-overlay-id="${overlay.id}" data-overlay-type="status_grid" data-fallback="true">
              <g transform="translate(${x}, ${y})">
                <rect width="${width}" height="${height}"
                      fill="none" stroke="${color}" stroke-width="2"/>
                <text x="${width / 2}" y="${height / 2}" text-anchor="middle"
                      fill="${color}" font-size="12" dominant-baseline="middle"
                      font-family="var(--lcars-font-family, Antonio)">
                  Status Grid Error
                </text>
              </g>
            </g>`;
  }

  /**
   * Compute attachment points for status grid overlay
   * @param {Object} overlay - Status grid overlay configuration
   * @param {Object} anchors - Available anchors
   * @param {Element} container - Container element for measurements
   * @returns {Object|null} Attachment points object
   * @static
   */
  static computeAttachmentPoints(overlay, anchors, container) {
    const attachmentPoints = OverlayUtils.computeAttachmentPoints(overlay, anchors);

    if (!attachmentPoints) {
      cblcarsLog.debug(`[StatusGridRenderer] Cannot compute attachment points for ${overlay.id}: missing position or size`);
      return null;
    }

    // TODO: Future enhancement - add individual grid cell attachment points
    // This would allow attaching lines to specific cells: grid.cell_0_0, grid.cell_1_2, etc.

    return attachmentPoints;
  }

  /**
   * Process all pending actions for status grids
   * @static
   */
  static processAllPendingActions() {
    if (!window._msdStatusGridActions) {
      cblcarsLog.debug(`[StatusGridRenderer] No pending actions to process`);
      return;
    }

    cblcarsLog.debug(`[StatusGridRenderer] Processing pending actions for status grids:`, Array.from(window._msdStatusGridActions.keys()));

    // Iterate over all pending actions
    window._msdStatusGridActions.forEach((actionInfo, overlayId) => {
      // Try to find the status grid element in card shadow DOM
      let gridElement = null;

      const card = window.cb_lcars_card_instance;
      if (card && card.shadowRoot) {
        gridElement = card.shadowRoot.querySelector(`[data-overlay-id="${overlayId}"]`);
      }

      // Fallback to document search
      if (!gridElement) {
        gridElement = document.querySelector(`[data-overlay-id="${overlayId}"]`);
      }

      if (gridElement) {
        cblcarsLog.debug(`[StatusGridRenderer] 🎯 Processing pending actions for ${overlayId}`);
        StatusGridRenderer.attachStatusGridActions(gridElement, actionInfo);
      } else {
        cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Could not find status grid element for pending action processing: ${overlayId}`);
      }
    });

    // Clear the action map after processing
    window._msdStatusGridActions.clear();
    cblcarsLog.debug(`[StatusGridRenderer] Cleared pending actions map`);
  }

  /**
   * Attach actions to a status grid overlay element
   * @param {Element} gridElement - The grid element to attach actions to
   * @param {Object} actionInfo - The action information object
   * @static
   */
  static attachStatusGridActions(gridElement, actionInfo) {
    if (!gridElement || !actionInfo) {
      cblcarsLog.warn(`[StatusGridRenderer] Invalid arguments for attachStatusGridActions`);
      return;
    }

    cblcarsLog.debug(`[StatusGridRenderer] 🎯 Attaching actions to grid ${gridElement.getAttribute('data-overlay-id')}:`, {
      hasActionInfo: !!actionInfo,
      hasCells: !!(actionInfo.cells),
      cellCount: actionInfo.cells?.length || 0,
      hasCardInstance: !!actionInfo.cardInstance
    });

    // Use proven ActionHelpers pattern
    if (actionInfo.cells && Array.isArray(actionInfo.cells)) {
      cblcarsLog.debug(`[StatusGridRenderer] Using ActionHelpers.attachCellActionsFromConfigs for ${actionInfo.cells.length} cells`);

      // Use the proven ActionHelpers method that works for other overlays
      window.ActionHelpers.attachCellActionsFromConfigs(gridElement, actionInfo.cells, actionInfo.cardInstance);

      cblcarsLog.debug(`[StatusGridRenderer] ✅ Completed ActionHelpers cell action attachment`);
    } else {
      cblcarsLog.warn(`[StatusGridRenderer] No cells array found in actionInfo for grid action attachment`);
    }

    // Handle overlay-level actions if present
    if (actionInfo.hasOverlayActions && actionInfo.overlay) {
      cblcarsLog.debug(`[StatusGridRenderer] Processing overlay-level actions`);

      const overlayActionConfig = window.ActionHelpers.processOverlayActions(
        actionInfo.overlay,
        actionInfo.gridStyle || {},
        actionInfo.cardInstance
      );

      if (overlayActionConfig) {
        window.ActionHelpers.attachActions(
          gridElement,
          actionInfo.overlay,
          overlayActionConfig.config,
          actionInfo.cardInstance
        );
        cblcarsLog.debug(`[StatusGridRenderer] ✅ Attached overlay-level actions`);
      }
    }

    cblcarsLog.debug(`[StatusGridRenderer] ✅ Completed action attachment for grid ${gridElement.getAttribute('data-overlay-id')}`);
  }

  /**
   * Store action info for later attachment after DOM insertion
   * @private
   * @static
   */
  static _storeActionInfo(overlayId, actionInfo) {
    if (!window._msdStatusGridActions) {
      window._msdStatusGridActions = new Map();
      cblcarsLog.debug(`[StatusGridRenderer] 📦 Initialized action storage map`);
    }

    if (!actionInfo) {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Attempted to store null action info for ${overlayId}`);
      return;
    }

    window._msdStatusGridActions.set(overlayId, actionInfo);
    cblcarsLog.debug(`[StatusGridRenderer] 📦 STORED action info for overlay ${overlayId}:`, {
      hasCells: !!(actionInfo?.cells),
      cellCount: actionInfo?.cells?.length || 0,
      hasCardInstance: !!actionInfo?.cardInstance,
      hasOverlayActions: actionInfo?.hasOverlayActions,
      hasCellActions: actionInfo?.hasCellActions,
      storageMapSize: window._msdStatusGridActions.size
    });
  }

  /**
   * Try manual action processing for a specific overlay
   * @private
   * @static
   */
  static _tryManualActionProcessing(overlayId) {
    if (!window._msdStatusGridActions?.has(overlayId)) {
      cblcarsLog.debug(`[StatusGridRenderer] No stored actions for ${overlayId}`);
      return;
    }

    const actionInfo = window._msdStatusGridActions.get(overlayId);

    // ENHANCED: Try renderer-based search first (more reliable)
    let gridElement = null;

    // Method 1: Use the known renderer mount element
    const renderer = window.__msdDebug?.pipelineInstance?.systemsManager?.renderer;
    if (renderer && renderer.mountEl) {
      const overlayGroup = renderer.mountEl.querySelector('#msd-overlay-container');
      if (overlayGroup) {
        gridElement = overlayGroup.querySelector(`[data-overlay-id="${overlayId}"]`);
        if (gridElement) {
          cblcarsLog.debug(`[StatusGridRenderer] 🎯 Found grid element via renderer mount for ${overlayId}`);
        }
      }
    }

    // Method 2: Card shadow DOM (fallback)
    if (!gridElement) {
      const card = window.cb_lcars_card_instance;
      if (card && card.shadowRoot) {
        gridElement = card.shadowRoot.querySelector(`[data-overlay-id="${overlayId}"]`);
        if (gridElement) {
          cblcarsLog.debug(`[StatusGridRenderer] 🎯 Found grid element in card shadow DOM for ${overlayId}`);
        }
      }
    }

    // Method 3: Document search (last resort)
    if (!gridElement) {
      gridElement = document.querySelector(`[data-overlay-id="${overlayId}"]`);
      if (gridElement) {
        cblcarsLog.debug(`[StatusGridRenderer] 🎯 Found grid element in document for ${overlayId}`);
      }
    }

    if (gridElement) {
      cblcarsLog.debug(`[StatusGridRenderer] 🎯 Found grid element for ${overlayId}, attaching actions`);

      // ENHANCED: Add debugging to track the attachment process
      const beforeAttachment = gridElement.querySelectorAll('[data-has-cell-actions="true"]').length;

      StatusGridRenderer.attachStatusGridActions(gridElement, actionInfo);

      const afterAttachment = gridElement.querySelectorAll('[data-actions-attached="true"]').length;

      cblcarsLog.debug(`[StatusGridRenderer] Action attachment summary for ${overlayId}:`, {
        cellsWithActionsMarkup: beforeAttachment,
        cellsWithActionsAttached: afterAttachment,
        success: afterAttachment > 0
      });

      // Remove from pending actions after successful attachment
      window._msdStatusGridActions.delete(overlayId);
    } else {
      cblcarsLog.debug(`[StatusGridRenderer] ⚠️ Grid element not found for ${overlayId}, will retry later`);
    }
  }

  /**
   * Fallback method to attach basic cell actions when ActionHelpers is not available
   * @private
   * @static
   */
  static _attachBasicCellActions(cellElement, actions, cardInstance) {
    cblcarsLog.warn(`[StatusGridRenderer] Using fallback action attachment - ActionHelpers should be available`);

    // FIXED: Use ActionHelpers if available, otherwise fallback
    if (window.ActionHelpers && typeof window.ActionHelpers.attachCellActions === 'function') {
      window.ActionHelpers.attachCellActions(cellElement, actions, cardInstance);
      return;
    }

    // Original fallback code only if ActionHelpers is not available
    if (!cellElement || !actions) return;

    // Add click handler for tap_action
    if (actions.tap_action) {
      cellElement.addEventListener('click', (event) => {
        event.stopPropagation();
        cblcarsLog.debug(`[StatusGridRenderer] 🖱️ Cell tap action triggered:`, actions.tap_action);

        if (cardInstance && typeof cardInstance._handleAction === 'function') {
          cardInstance._handleAction(actions.tap_action);
        } else {
          cblcarsLog.warn(`[StatusGridRenderer] No card instance available for action handling`);
        }
      });
    }

    // Add hold handler for hold_action
    if (actions.hold_action) {
      let holdTimer = null;

      cellElement.addEventListener('mousedown', (event) => {
        holdTimer = setTimeout(() => {
          event.stopPropagation();
          cblcarsLog.debug(`[StatusGridRenderer] ✋ Cell hold action triggered:`, actions.hold_action);

          if (cardInstance && typeof cardInstance._handleAction === 'function') {
            cardInstance._handleAction(actions.hold_action);
          }
        }, 500); // 500ms hold threshold
      });

      cellElement.addEventListener('mouseup', () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      });

      cellElement.addEventListener('mouseleave', () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      });
    }

    // Add double-click handler for double_tap_action
    if (actions.double_tap_action) {
      cellElement.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        cblcarsLog.debug(`[StatusGridRenderer] 🖱️🖱️ Cell double-tap action triggered:`, actions.double_tap_action);

        if (cardInstance && typeof cardInstance._handleAction === 'function') {
          cardInstance._handleAction(actions.double_tap_action);
        }
      });
    }

    cblcarsLog.debug(`[StatusGridRenderer] ✅ Attached basic fallback actions to cell`);
  }

  /**
   * Get debug information about the action system
   * @static
   */
  static getActionDebugInfo() {
    return {
      observerActive: !!window._msdStatusGridObserver,
      pendingActions: window._msdStatusGridActions ? Array.from(window._msdStatusGridActions.keys()) : [],
      cardInstanceAvailable: !!StatusGridRenderer._resolveCardInstance(),
      actionHelpersAvailable: !!window.ActionHelpers
    };
  }

  /**
   * Make text elements within cells clickable and part of their parent cell for actions
   * @param {string} gridMarkup - The grid markup to process
   * @param {Array} cells - Array of cell configurations
   * @returns {string} Updated markup with clickable text elements
   * @private
   * @static
   */
  static _makeTextElementsClickable(gridMarkup, cells) {
    // Replace pointer-events: none with pointer-events: visiblePainted for text elements
    // and add necessary data attributes
    return gridMarkup.replace(
      /(<text[^>]*data-cell-part="([^"]*)"[^>]*style="[^"]*pointer-events:\s*none[^"]*")([^>]*>)/g,
      (match, beforeStyle, cellId, afterStyle) => {
        // Find the cell configuration
        const cell = cells.find(c => c.id === cellId);
        const cellHasActions = !!(cell && cell.actions && (cell.actions.tap_action || cell.actions.hold_action || cell.actions.double_tap_action));

        // Replace the style and add data attributes
        const newStyle = beforeStyle.replace('pointer-events: none', 'pointer-events: visiblePainted; cursor: pointer');
        return `${newStyle} data-cell-id="${cellId}" data-has-cell-actions="${cellHasActions}"${afterStyle}`;
      }
    );
  }

  /**
   * Calculate proportional cell dimensions based on grid configuration
   * @private
   */
  _calculateProportionalCellDimensions(totalWidth, totalHeight, gridStyle) {
    const rows = gridStyle.rows;
    const columns = gridStyle.columns;
    const gap = gridStyle.cell_gap;

    cblcarsLog.debug(`[StatusGridRenderer] 📐 Grid dimensions: ${rows}x${columns}, total: ${totalWidth}x${totalHeight}, gap: ${gap}`);

    // Calculate available space after gaps (ensure non-negative)
    const gapWidth = gap * Math.max(0, columns - 1);
    const gapHeight = gap * Math.max(0, rows - 1);
    const availableWidth = Math.max(0, totalWidth - gapWidth);
    const availableHeight = Math.max(0, totalHeight - gapHeight);

    // Debug space calculations
    cblcarsLog.debug(`[StatusGridRenderer] Space calculation:`, {
      totalWidth,
      totalHeight,
      gap,
      gapWidth,
      gapHeight,
      availableWidth,
      availableHeight,
      rows,
      columns
    });

    // Get sizing configuration - prioritize specific keys over fallbacks
    const columnSizing = gridStyle.column_sizes || gridStyle.column_widths;
    const rowSizing = gridStyle.row_sizes || gridStyle.row_heights;

    // Calculate cell widths
    const cellWidths = this._calculateDimensions(availableWidth, columns, columnSizing);

    // Calculate cell heights
    const cellHeights = this._calculateDimensions(availableHeight, rows, rowSizing);

    // Debug logging for proportional sizing
    if (columnSizing) {
      cblcarsLog.debug(`[StatusGridRenderer] Using column sizing:`, columnSizing, '→ widths:', cellWidths);
    }
    if (rowSizing) {
      cblcarsLog.debug(`[StatusGridRenderer] Using row sizing:`, rowSizing, '→ heights:', cellHeights);
    }

    cblcarsLog.debug(`[StatusGridRenderer] ✅ Final cell dimensions: widths=${cellWidths}, heights=${cellHeights}`);

    // Validate calculated dimensions
    const hasNegativeWidths = cellWidths.some(w => w <= 0);
    const hasNegativeHeights = cellHeights.some(h => h <= 0);

    if (hasNegativeWidths || hasNegativeHeights) {
      cblcarsLog.error(`[StatusGridRenderer] ❌ Calculated negative dimensions:`, {
        cellWidths,
        cellHeights,
        availableWidth,
        availableHeight,
        gap,
        columnSizing,
        rowSizing
      });

      // Fallback to equal sizing
      const fallbackWidth = Math.max(1, availableWidth / columns);
      const fallbackHeight = Math.max(1, availableHeight / rows);

      return {
        cellWidths: Array(columns).fill(fallbackWidth),
        cellHeights: Array(rows).fill(fallbackHeight)
      };
    }

    return { cellWidths, cellHeights };
  }

  /**
   * Calculate dimensions for rows or columns based on sizing configuration
   * @private
   */
  _calculateDimensions(totalSpace, count, sizing) {
    cblcarsLog.debug(`[StatusGridRenderer] 📐 Calculating dimensions: totalSpace=${totalSpace}, count=${count}, sizing=`, sizing);

    if (!sizing || !Array.isArray(sizing)) {
      // Equal sizing - divide space equally
      const size = totalSpace / count;
      cblcarsLog.debug(`[StatusGridRenderer] ✅ Using equal sizing: ${size} per cell`);
      return Array(count).fill(size);
    }

    // Validate array length matches expected count
    if (sizing.length !== count) {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Sizing array length (${sizing.length}) doesn't match expected count (${count}). Using equal sizing.`);
      const size = totalSpace / count;
      return Array(count).fill(size);
    }

    // Check if sizing uses percentages
    if (sizing.some(s => typeof s === 'string' && s.includes('%'))) {
      const result = sizing.map((s, index) => {
        if (typeof s === 'string' && s.includes('%')) {
          const percentage = parseFloat(s.replace('%', ''));
          return (totalSpace * percentage) / 100;
        }
        // Handle mixed percentage/number arrays
        return parseFloat(s) || 0;
      });

      // Validate percentages don't exceed 100%
      const totalPercentage = sizing.reduce((sum, s) => {
        if (typeof s === 'string' && s.includes('%')) {
          return sum + parseFloat(s.replace('%', ''));
        }
        return sum;
      }, 0);

      if (totalPercentage > 100) {
        cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Total percentages (${totalPercentage}%) exceed 100%. Normalizing.`);
        return result.map(val => (val / totalPercentage) * totalSpace);
      }

      return result;
    }

    // Convert all values to numbers for proportional calculation
    const numericValues = sizing.map(s => parseFloat(s) || 0);
    const totalValue = numericValues.reduce((sum, val) => sum + val, 0);

    // Check if we should treat as pixels or ratios
    // If values sum to significantly more than available space, treat as pixels and scale down
    if (totalValue > totalSpace * 1.2) {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Total pixel values (${totalValue}px) exceed available space (${totalSpace}px). Scaling down.`);
      const scale = totalSpace / totalValue;
      return numericValues.map(val => val * scale);
    }

    // Otherwise treat as proportional ratios (most common case for [2, 1] etc.)
    if (totalValue === 0) {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ All ratio values are zero or invalid. Using equal sizing.`);
      const size = totalSpace / count;
      return Array(count).fill(size);
    }

    // Convert ratios to actual pixel dimensions
    const result = numericValues.map(ratio => {
      const normalizedRatio = ratio / totalValue;
      return totalSpace * normalizedRatio;
    });

    cblcarsLog.debug(`[StatusGridRenderer] Calculated proportional dimensions:`, {
      input: sizing,
      numericValues,
      totalValue,
      totalSpace,
      result
    });

    return result;
  }

  /**
   * Calculate cumulative X position for a column
   * @private
   */
  _calculateCellX(colIndex, cellWidths, gap) {
    let x = 0;
    for (let i = 0; i < colIndex; i++) {
      x += cellWidths[i] + gap;
    }
    return x;
  }

  /**
   * Calculate cumulative Y position for a row
   * @private
   */
  _calculateCellY(rowIndex, cellHeights, gap) {
    let y = 0;
    for (let i = 0; i < rowIndex; i++) {
      y += cellHeights[i] + gap;
    }
    return y;
  }

  /**
   * Calculate normalized radius for consistent visual appearance across different cell sizes
   * Uses HA theme variables as baseline and intelligent clamping for LCARS aesthetic
   * @private
   * @param {number} cellWidth - Width of the cell
   * @param {number} cellHeight - Height of the cell
   * @param {number} baseRadius - Base radius value from configuration
   * @param {boolean} matchHaRadius - Whether to clamp minimum radius to HA's card radius
   * @returns {number} Normalized radius value
   */
  _calculateNormalizedRadius(cellWidth, cellHeight, baseRadius, matchHaRadius = false) {
    // Use the smaller dimension to maintain proportional rounding
    const cellMinDimension = Math.min(cellWidth, cellHeight);

    // Get HA's card border radius as reference (typically 12px in most themes)
    // This ensures our cells look consistent with the overall HA card design
    const haCardRadius = this._getHACardRadius();

    // If matchHaRadius is true, use HA's card radius directly for all cells
    if (matchHaRadius) {
      // Use HA's card radius directly for perfect visual consistency
      const result = Math.round(haCardRadius);

      return result;
    }

    // Otherwise, use proportional scaling with intelligent clamping
    const intelligentMinRadius = Math.max(
      haCardRadius * 0.5,        // At least half of HA's card radius
      cellMinDimension * 0.08,   // Or 8% of cell dimension (less aggressive than 15%)
      4                          // But never less than 4px for visual consistency
    );

    // Define maximum to prevent over-rounding
    const maxRadius = Math.min(
      cellMinDimension * 0.20,   // Max 20% of cell dimension
      haCardRadius * 1.5         // Or 1.5x HA's card radius
    );

    // Calculate proportional radius based on cell size
    // Use a reference size that makes sense for typical card layouts
    const referenceSize = haCardRadius * 4; // ~48px for typical 12px card radius
    const scaleFactor = cellMinDimension / referenceSize;
    let normalizedRadius = baseRadius * scaleFactor;

    // Apply intelligent clamping
    normalizedRadius = Math.max(normalizedRadius, intelligentMinRadius);
    normalizedRadius = Math.min(normalizedRadius, maxRadius);

    const result = Math.round(normalizedRadius);

    return result;
  }

  /**
   * Get Home Assistant's card border radius from CSS variables
   * Falls back to sensible default if not available
   * @private
   * @returns {number} HA card border radius in pixels
   */
  _getHACardRadius() {
    // Try to get HA's card border radius from CSS variables
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const rootStyles = window.getComputedStyle(document.documentElement);

      // Try various HA CSS variables that might contain card radius
      const haVariables = [
        '--ha-card-border-radius',
        '--card-border-radius',
        '--border-radius',
        '--mdc-shape-small'
      ];

      for (const variable of haVariables) {
        const value = rootStyles.getPropertyValue(variable).trim();
        if (value && value.includes('px')) {
          const radius = parseFloat(value.replace('px', ''));
          if (!isNaN(radius) && radius > 0) {
            //cblcarsLog.debug(`[StatusGridRenderer] Using HA card radius: ${radius}px from ${variable}`);
            return radius;
          }
        }
      }
    }

    // Fallback to typical HA default
    const fallbackRadius = 12;
    cblcarsLog.debug(`[StatusGridRenderer] Using fallback card radius: ${fallbackRadius}px`);
    return fallbackRadius;
  }

  /**
   * Determine cell color based on status and configuration
   * @private
   */
  _determineCellColor(cell, gridStyle) {
    // Check status ranges first
    if (gridStyle.status_ranges && gridStyle.status_ranges.length > 0) {
      const value = typeof cell.data.value === 'number' ? cell.data.value : parseFloat(cell.data.value);

      if (!isNaN(value)) {
        for (const range of gridStyle.status_ranges) {
          if (value >= range.min && value <= range.max) {
            return range.color;
          }
        }
      }

      // Check string/state matching
      for (const range of gridStyle.status_ranges) {
        if (range.value && cell.data.value === range.value) {
          return range.color;
        }
        if (range.state && cell.data.state === range.state) {
          return range.color;
        }
      }
    }

    // Fallback to default cell color
    return gridStyle.cell_color;
  }

  /**
   * Update status grid overlay data when DataSource changes
   * @param {Element} gridElement - DOM element for the status grid
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - New DataSource data
   * @returns {boolean} True if content was updated
   * @static
   */
  static updateGridData(gridElement, overlay, sourceData) {
    try {
      cblcarsLog.debug(`[StatusGridRenderer] Updating status grid ${overlay.id} with DataSource data`);

      // Create instance for non-static methods
      const instance = new StatusGridRenderer();

      // Get updated cells with new data
      const style = overlay.finalStyle || overlay.style || {};
      const updatedCells = instance.updateCellsWithData(overlay, style, sourceData);

      if (updatedCells && updatedCells.length > 0) {
        // Update individual cell content in DOM using ButtonRenderer
        let hasUpdates = false;

        updatedCells.forEach(cell => {
          const cellElement = gridElement.querySelector(`[data-button-id="${cell.id}"]`);
          if (cellElement) {
            const buttonConfig = {
              id: cell.id,
              label: cell.label,
              content: cell.content,
              _raw: cell._raw || cell.config,
              _originalContent: cell._originalContent
            };

            const updated = ButtonRenderer.updateButtonData(cellElement, buttonConfig, sourceData);
            if (updated) {
              hasUpdates = true;
            }
          }
        });

        if (hasUpdates) {
          // Update grid timestamp
          const timestamp = new Date().toISOString();
          gridElement.setAttribute('data-last-update', timestamp);
          cblcarsLog.debug(`[StatusGridRenderer] ✅ Updated ${updatedCells.length} cells in grid ${overlay.id}`);
        }

        return hasUpdates;
      }

      return false;
    } catch (error) {
      cblcarsLog.error(`[StatusGridRenderer] Error updating grid data for ${overlay.id}:`, error);
      return false;
    }
  }

  /**
   * Resolve cell content with updated DataSource data (for dynamic updates)
   * @public - Used by BaseOverlayUpdater for real-time status grid updates
   * @param {Object} overlay - Overlay configuration
   * @param {Object} style - Style configuration
   * @param {Object} newDataSourceData - Updated DataSource data
   * @returns {Array} Updated cell configurations with new data
   */
  updateCellsWithData(overlay, style, newDataSourceData) {
    cblcarsLog.debug(`[StatusGridRenderer] Updating cells with new DataSource data for ${overlay.id}`);

    const gridStyle = this._resolveStatusGridStyles(style, overlay.id, overlay);
    const cells = this._resolveCellConfigurations(overlay, gridStyle);

    // Update cells that have template content
    const updatedCells = cells.map(cell => {
      // Get raw content using unified method
      const rawCellContent = this._getCellContentFromSources(cell);

      if (rawCellContent && typeof rawCellContent === 'string' && rawCellContent.includes('{')) {
        // Use single method for all template processing with fresh data
        const processedContent = this._resolveCellContent(rawCellContent, newDataSourceData);

        // Ensure we don't return [object Object]
        const safeContent = (typeof processedContent === 'object') ? JSON.stringify(processedContent) : String(processedContent);

        return {
          ...cell,
          label: processedContent === rawCellContent ? cell.label : safeContent, // Only update label if content changed
          content: safeContent,
          data: {
            ...cell.data,
            value: this._extractValueFromTemplate(safeContent, newDataSourceData),
            timestamp: Date.now()
          },
          lastUpdate: Date.now()
        };
      }
    // If the processed content is purely numeric, return it
      return cell;
    });

    return updatedCells;
  }

  /**
   * Extract numeric value from processed template for status calculations
   * @private
   */
  _extractValueFromTemplate(processedContent, dataSourceData) {
    // If the processed content is purely numeric, return it
    const numericValue = parseFloat(processedContent);
    if (!isNaN(numericValue)) {
      return numericValue;
    }

    // Otherwise try to extract the raw value from dataSourceData
    if (dataSourceData && typeof dataSourceData.v === 'number') {
      return dataSourceData.v;
    }

    // Fallback to processed content as string
    return processedContent;
  }

  /**
   * Process action configuration for status grid
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Array} cells - Array of cell configurations WITH actions already attached
   * @param {Object} gridStyle - Resolved grid styling
   * @param {Object} cardInstance - Card instance for action handling
   * @returns {Object|null} Action configuration for ActionHelpers
   */
  _processStatusGridActions(overlay, cells, gridStyle, cardInstance) {
    // Get card instance if not provided
    if (!cardInstance) {
      cardInstance = this._resolveCardInstance();
    }

    // CRITICAL: Filter cells that actually have actions defined
    const cellsWithActions = cells.filter(cell => {
      const hasActions = cell.actions && (
        cell.actions.tap_action ||
        cell.actions.hold_action ||
        cell.actions.double_tap_action
      );

      if (hasActions) {
        cblcarsLog.debug(`[StatusGridRenderer] ✅ Cell ${cell.id} has actions:`, {
          tap: !!cell.actions.tap_action,
          hold: !!cell.actions.hold_action,
          double_tap: !!cell.actions.double_tap_action,
          actions: cell.actions
        });
      }

      return hasActions;
    });

    // Check for overlay-level actions
    const hasOverlayActions = !!(overlay.tap_action || overlay.hold_action || overlay.double_tap_action);

    cblcarsLog.debug(`[StatusGridRenderer] 🔍 Processing status grid actions for ${overlay.id}:`, {
      totalCells: cells.length,
      cellsWithActions: cellsWithActions.length,
      hasOverlayActions,
      hasCardInstance: !!cardInstance,
      cellIds: cellsWithActions.map(c => c.id),
      sampleCell: cellsWithActions[0] ? {
        id: cellsWithActions[0].id,
        actions: cellsWithActions[0].actions
      } : null
    });

    // If no actions at all, return null
    if (cellsWithActions.length === 0 && !hasOverlayActions) {
      cblcarsLog.debug(`[StatusGridRenderer] No actions found for ${overlay.id}`);
      return null;
    }

    if (!cardInstance) {
      cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Status grid ${overlay.id} has actions but no cardInstance available`);
      return null;
    }

    // CRITICAL: Build enhanced action config with FULL cell objects
    // The cells array must contain complete cell data including actions
    const actionInfo = {
      config: {
        enhanced: {
          cells: cellsWithActions.map(cell => ({
            cell_id: cell.id,
            tap_action: cell.actions?.tap_action,
            hold_action: cell.actions?.hold_action,
            double_tap_action: cell.actions?.double_tap_action
          })),
          default_tap: overlay.tap_action,
          default_hold: overlay.hold_action,
          default_double_tap: overlay.double_tap_action
        }
      },
      overlay: overlay,
      cardInstance: cardInstance,
      // CRITICAL: Pass full cell objects with complete actions
      // This is what AdvancedRenderer will use for attachment
      cells: cellsWithActions
    };

    cblcarsLog.debug(`[StatusGridRenderer] 🎯 Created enhanced action info for ${overlay.id}:`, {
      cellActionCount: cellsWithActions.length,
      hasDefaultActions: hasOverlayActions,
      configCells: actionInfo.config.enhanced.cells.length,
      dataCells: actionInfo.cells.length,
      firstCellDetailed: actionInfo.cells[0] ? {
        id: actionInfo.cells[0].id,
        hasActionsObject: !!actionInfo.cells[0].actions,
        hasTapAction: !!actionInfo.cells[0].actions?.tap_action,
        tapActionValue: actionInfo.cells[0].actions?.tap_action
      } : null
    });

    return actionInfo;
  }

  /**
   * Build LCARS-style brackets using the generalized BracketRenderer
   * @private
   */
  _buildBrackets(width, height, gridStyle, overlayId) {
    if (!gridStyle.bracket_style) {
      return '';
    }

    // Convert grid style properties to BracketRenderer format
    const bracketConfig = {
      enabled: true,
      style: typeof gridStyle.bracket_style === 'string' ? gridStyle.bracket_style : 'lcars',
      color: gridStyle.bracket_color,
      width: gridStyle.bracket_width,
      gap: gridStyle.bracket_gap,
      extension: gridStyle.bracket_extension,
      opacity: gridStyle.bracket_opacity,
      corners: gridStyle.bracket_corners,
      sides: gridStyle.bracket_sides,
      // Enhanced bg-grid style options
      bracket_width: gridStyle.bracket_physical_width,
      bracket_height: gridStyle.bracket_height,
      bracket_radius: gridStyle.bracket_radius,
      // LCARS container options
      border_top: gridStyle.border_top,
      border_left: gridStyle.border_left,
      border_right: gridStyle.border_right,
      border_bottom: gridStyle.border_bottom,
      border_color: gridStyle.border_color || gridStyle.bracket_color,
      border_radius: gridStyle.border_radius,
      inner_factor: gridStyle.inner_factor,
      hybrid_mode: gridStyle.hybrid_mode
    };

    return BracketRenderer.render(width, height, bracketConfig, overlayId);
  }
}

// Expose StatusGridRenderer to window for console debugging
if (typeof window !== 'undefined') {
  window.StatusGridRenderer = StatusGridRenderer;

  // Add debug helpers for action system
  window._debugStatusGridActions = () => StatusGridRenderer.getActionDebugInfo();
  window._processStatusGridActions = () => StatusGridRenderer.processAllPendingActions();
}