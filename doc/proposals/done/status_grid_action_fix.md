Looking at the code, I can see the issue. The status grid is using ButtonRenderer to create button markup, but the action attachment system isn't properly connecting the cell-level actions to the ActionHelpers system. Let me analyze the flow and propose a solution.

## Problem Analysis

1. **Status Grid Action Flow**: Status grid creates button markup via ButtonRenderer, stores action info, then tries to attach actions later via ActionHelpers
2. **Button Overlay Action Flow**: Button overlay creates markup and uses ActionHelpers directly during render
3. **Missing Link**: The status grid's cell actions aren't being properly processed by ActionHelpers because the action attachment is happening too late or the DOM elements aren't being found correctly

## Root Cause

The issue is in the action attachment timing and the way ActionHelpers processes status grid cells. Here's what's happening:

1. StatusGridRenderer creates button markup with `data-has-cell-actions="true"`
2. It stores action info for later processing
3. ActionHelpers.attachCellActionsFromConfigs is called but the cells might not have the right structure for ActionHelpers to find them

## Solution

We need to align the status grid action system with the working button overlay pattern. Here's the fix:

### 1. Update StatusGridRenderer to use the same action attachment pattern as ButtonOverlay

```javascript
// In StatusGridRenderer.renderWithActions method, after creating gridMarkup:

/**
 * Render status grid with action metadata
 * @param {Object} overlay - Status grid overlay configuration with resolved styles
 * @param {Object} anchors - Anchor positions
 * @param {Array} viewBox - SVG viewBox dimensions
 * @param {Object} cardInstance - Reference to custom-button-card instance for action handling
 * @returns {Object} Object with markup, actions, and metadata
 * @static
 */
static renderWithActions(overlay, anchors, viewBox, cardInstance = null) {
  // Create instance for non-static methods
  const instance = new StatusGridRenderer();
  const result = instance.renderStatusGrid(overlay, anchors, viewBox, cardInstance);

  // FIXED: Use immediate action attachment like ButtonOverlay instead of deferred
  if (result.needsActionAttachment && result.actions) {
    // Schedule immediate action attachment using the same pattern as ButtonOverlay
    setTimeout(() => {
      StatusGridRenderer._attachActionsImmediately(overlay.id, result.actions);
    }, 0);

    // Add multiple fallback attempts with the working timing
    setTimeout(() => {
      StatusGridRenderer._attachActionsImmediately(overlay.id, result.actions);
    }, 10);

    setTimeout(() => {
      StatusGridRenderer._attachActionsImmediately(overlay.id, result.actions);
    }, 100);
  }

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
  const renderer = window.cblcars.debug.msd?.pipelineInstance?.systemsManager?.renderer;
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
```

### 2. Update the ButtonRenderer to ensure consistent markup

The ButtonRenderer should ensure that all button elements have the correct data attributes for action attachment:

```javascript
// In ButtonRenderer.renderButton method, update the button markup generation:

/**
 * Instance method for comprehensive button rendering
 * @param {Object} config - Button configuration
 * @param {Object} style - Resolved button styling
 * @param {Object} size - Button dimensions {width, height}
 * @param {Object} position - Button position {x, y}
 * @param {Object} options - Additional options
 * @returns {Object} {markup, actions, metadata}
 */
renderButton(config, style, size, position, options = {}) {
  const { width, height } = size;
  const { x, y } = position;
  const cellId = options.cellId || config.id || 'button';

  try {
    // Resolve complete button styling with enhanced border support
    const buttonStyle = this.resolveButtonStyle(config, style, width, height);

    // Process actions if available
    const actionInfo = this._processButtonActions(config, buttonStyle, options.cardInstance);

    // Check if button has actions
    const hasActions = !!(config.tap_action || config.hold_action || config.double_tap_action || buttonStyle.actions);

    // CRITICAL: Use 'all' for elements with actions (proven pattern)
    const pointerEvents = hasActions ? 'all' : 'none';
    const cursor = hasActions ? 'pointer' : 'default';

    // Start building the button SVG with ALL necessary data attributes
    let buttonMarkup = `<g data-button-id="${cellId}"`;

    if (options.gridContext) {
      buttonMarkup += ` data-cell-id="${cellId}"
                       data-cell-row="${config.row || 0}"
                       data-cell-col="${config.col || 0}"
                       data-has-cell-actions="${hasActions}"`;
    }

    // CRITICAL: Add action debugging attributes for troubleshooting
    if (hasActions) {
      buttonMarkup += ` data-action-ready="true"
                       data-has-tap-action="${!!config.tap_action}"
                       data-has-hold-action="${!!config.hold_action}"
                       data-has-double-tap-action="${!!config.double_tap_action}"`;
    }

    buttonMarkup += ` style="pointer-events: ${pointerEvents}; cursor: ${cursor};">`;

    // Render button background with enhanced border support
    buttonMarkup += this.renderButtonBackground(x, y, width, height, buttonStyle, config);

    // Render button text content with proper data attributes
    buttonMarkup += this.renderButtonText(config, x, y, width, height, buttonStyle, hasActions, cellId);

    buttonMarkup += '</g>';

    return {
      markup: buttonMarkup,
      actions: actionInfo,
      needsActionAttachment: !!actionInfo
    };

  } catch (error) {
    cblcarsLog.error(`[ButtonRenderer] ❌ Rendering failed for button ${cellId}:`, error);
    return {
      markup: this._renderFallbackButton(config, x, y, width, height),
      actions: null,
      needsActionAttachment: false
    };
  }
}
```

### 3. Update the text rendering to include proper data attributes

```javascript
// In ButtonRenderer.renderButtonText method:

/**
 * Render button text content with positioning and styling
 * @param {Object} config - Button configuration
 * @param {number} x - Button X coordinate
 * @param {number} y - Button Y coordinate
 * @param {number} width - Button width
 * @param {number} height - Button height
 * @param {Object} buttonStyle - Resolved button styling
 * @param {boolean} hasActions - Whether button has actions
 * @param {string} cellId - Cell ID for data attributes
 * @returns {string} SVG markup for button text
 */
renderButtonText(config, x, y, width, height, buttonStyle, hasActions = false, cellId = null) {
  let textMarkup = '';

  // CRITICAL: Text elements should use 'all' and include cell data for action attachment
  const textPointerEvents = hasActions ? 'all' : 'none';
  const textCursor = hasActions ? 'inherit' : 'default';

  // Render button label if enabled
  if (buttonStyle.show_labels && config.label) {
    const labelPos = this._calculateEnhancedTextPosition(
      buttonStyle.label_position, x, y, width, height, buttonStyle, 'label'
    );

    textMarkup += `<text x="${labelPos.x}" y="${labelPos.y}"
                   text-anchor="${labelPos.anchor}" dominant-baseline="${labelPos.baseline}"
                   fill="${buttonStyle.label_color}"
                   font-size="${buttonStyle.label_font_size}"
                   font-family="${buttonStyle.font_family}"
                   font-weight="${buttonStyle.font_weight}"
                   style="pointer-events: ${textPointerEvents}; user-select: none; cursor: ${textCursor};"
                   data-button-label="${config.id}"`;

    // CRITICAL: Add cell data attributes for action attachment
    if (cellId && hasActions) {
      textMarkup += ` data-cell-id="${cellId}"
                     data-has-cell-actions="${hasActions}"
                     data-cell-part="label"`;
    }

    textMarkup += `>
                   ${this._escapeXml(config.label)}
                 </text>`;
  }

  // Render button content/value if enabled
  if (buttonStyle.show_values && config.content) {
    const valuePos = this._calculateEnhancedTextPosition(
      buttonStyle.value_position, x, y, width, height, buttonStyle, 'value'
    );

    textMarkup += `<text x="${valuePos.x}" y="${valuePos.y}"
                   text-anchor="${valuePos.anchor}" dominant-baseline="${valuePos.baseline}"
                   fill="${buttonStyle.value_color}"
                   font-size="${buttonStyle.value_font_size}"
                   font-family="${buttonStyle.font_family}"
                   font-weight="${buttonStyle.font_weight}"
                   style="pointer-events: ${textPointerEvents}; user-select: none; cursor: ${textCursor};"
                   data-button-content="${config.id}"`;

    // CRITICAL: Add cell data attributes for action attachment
    if (cellId && hasActions) {
      textMarkup += ` data-cell-id="${cellId}"
                     data-has-cell-actions="${hasActions}"
                     data-cell-part="content"`;
    }

    textMarkup += `>
                   ${this._escapeXml(config.content)}
                 </text>`;
  }

  return textMarkup;
}
```

### 4. Update the background rendering to include proper data attributes

```javascript
// In ButtonRenderer._renderSimpleButtonBackground method:

/**
 * Render simple button background using rect element
 * @private
 */
_renderSimpleButtonBackground(x, y, width, height, buttonStyle, fill, buttonId) {
  // CRITICAL: For buttons with actions, use 'all' on the background rect
  const hasActions = buttonStyle.actions || buttonStyle.standardStyles?.interaction?.hasActions;
  const rectPointerEvents = hasActions ? 'all' : 'inherit';

  let markup = `<rect x="${x}" y="${y}"
                 width="${width}" height="${height}"
                 fill="${fill}"
                 stroke="${buttonStyle.border.color}"
                 stroke-width="${buttonStyle.border.width}"
                 rx="${buttonStyle.border.radius}"
                 opacity="${buttonStyle.opacity}"
                 style="pointer-events: ${rectPointerEvents};"`;

  // CRITICAL: Add cell data attributes if this is a grid cell
  if (hasActions && buttonId) {
    markup += ` data-cell-id="${buttonId}"
               data-has-cell-actions="${hasActions}"
               data-cell-part="background"`;
  }

  // Add filter effects
  const filters = this._buildFilterEffects(buttonStyle, buttonId);
  if (filters.length > 0) {
    markup += ` filter="${filters.join(' ')}"`;
  }

  markup += ` />`;

  return markup;
}
```

## Summary

The key changes are:

1. **Immediate Action Attachment**: Use the same immediate attachment pattern as ButtonOverlay instead of deferred attachment
2. **Consistent Element Marking**: Ensure all button elements (rect, text) have the correct `data-cell-id` and `data-has-cell-actions` attributes
3. **Proven Event Handling**: Use the same event attachment pattern that works for other overlays
4. **Direct ActionHelpers Integration**: Use ActionHelpers.executeActionViaButtonCardBridge directly instead of relying on the complex deferred system

This should make status grid cell actions work exactly like standalone button overlay actions since they'll be using the same proven code paths.