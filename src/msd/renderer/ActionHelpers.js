/**
 * ActionHelpers - Universal action system for MSD overlay elements
 * 🌉 Provides a bridge to button-card's proven action system for full compatibility
 *
 * Features:
 * - Works with any overlay type (status grids, sparklines, etc.)
 * - Button-card bridge pattern for full action support (toggle, call-service, navigate, etc.)
 * - Template evaluation, sounds, confirmations via button-card
 * - Non-reactive config injection to prevent MSD card re-renders
 * - Fallback to direct HASS calls when bridge unavailable
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ActionHelpers {

    /**
   * Attach simple actions (tap, hold, double-tap) to overlay element
   * Fixed version with unified event handling like cells but for overlays
   * @param {Element} element - The DOM element to attach actions to
   * @param {Object} simpleActions - Simple actions configuration
   * @param {Object} cardInstance - Card instance for action handling
   * @private
   * @static
   */
  static _attachSimpleActions(element, simpleActions, cardInstance) {
    cblcarsLog.debug(`[ActionHelpers] 🔗 Attaching overlay actions to element`, {
      elementType: element.tagName,
      overlayId: element.getAttribute('data-overlay-id'),
      actions: simpleActions
    });
    // Track action state to prevent conflicts (same as cell system)
    let isHolding = false;
    let holdTimer = null;
    let lastTap = 0;

    // Handle mouse/touch events with proper coordination
    const handlePointerDown = (event) => {
      // Check if we're clicking on a cell that has its own actions
      // This includes the cell rect AND any text elements belonging to the cell
      const targetCell = event.target.closest('[data-has-cell-actions="true"]') ||
                         (event.target.hasAttribute('data-cell-id') &&
                          event.target.getAttribute('data-has-cell-actions') === 'true');
      if (targetCell) {
        const cellId = targetCell.getAttribute('data-cell-id') || event.target.getAttribute('data-cell-id');
        cblcarsLog.debug(`[ActionHelpers] 🚫 Overlay ignoring event - clicked on cell with own actions:`, cellId);
        return; // Don't handle overlay actions on cells with their own actions
      }

      cblcarsLog.debug(`[ActionHelpers] 🔲 Overlay pointer down - starting hold timer`);
      event.preventDefault();
      event.stopImmediatePropagation();

      if (simpleActions.hold_action) {
        isHolding = false;
        cblcarsLog.debug(`[ActionHelpers] 🔲 Overlay setting hold timer for 500ms`);
        holdTimer = setTimeout(() => {
          isHolding = true;
          cblcarsLog.debug(`[ActionHelpers] 🎯 Overlay HOLD ACTION TRIGGERED after 500ms`);
          ActionHelpers.executeActionViaButtonCardBridge(simpleActions.hold_action, cardInstance, 'hold');
        }, 500);
      }
    };

    const handlePointerUp = (event) => {
      // Check if we're clicking on a cell that has its own actions
      const targetCell = event.target.closest('[data-has-cell-actions="true"]') ||
                         (event.target.hasAttribute('data-cell-id') &&
                          event.target.getAttribute('data-has-cell-actions') === 'true');
      if (targetCell) {
        const cellId = targetCell.getAttribute('data-cell-id') || event.target.getAttribute('data-cell-id');
        cblcarsLog.debug(`[ActionHelpers] 🚫 Overlay ignoring up event - clicked on cell with own actions:`, cellId);
        return; // Don't handle overlay actions on cells with their own actions
      }

      cblcarsLog.debug(`[ActionHelpers] 🔲 Overlay pointer up, wasHolding: ${isHolding}, hadTimer: ${!!holdTimer}`);
      event.preventDefault();
      event.stopImmediatePropagation();

      // Clear hold timer if it exists
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
        cblcarsLog.debug(`[ActionHelpers] 🔲 Overlay cleared hold timer`);
      }

      // Only process tap/double-tap if we weren't holding
      if (!isHolding) {
        const now = Date.now();

        // Check for double-tap first
        if (simpleActions.double_tap_action && (now - lastTap < 300) && lastTap > 0) {
          cblcarsLog.debug(`[ActionHelpers] 🎯 Overlay DOUBLE-TAP ACTION TRIGGERED`);
          ActionHelpers.executeActionViaButtonCardBridge(simpleActions.double_tap_action, cardInstance, 'double_tap');
          lastTap = 0; // Reset to prevent triple-tap and single-tap
          return; // CRITICAL: Exit early to prevent single-tap logic
        }

        if (simpleActions.tap_action) {
          lastTap = now;
          // Set up single tap with delay to allow for double-tap
          if (simpleActions.double_tap_action) {
            // Wait to see if double-tap comes
            const tapTimestamp = now;
            setTimeout(() => {
              if (lastTap === tapTimestamp) { // No double-tap happened (lastTap wasn't reset)
                cblcarsLog.debug(`[ActionHelpers] 🎯 Overlay SINGLE TAP ACTION TRIGGERED (delayed)`);
                ActionHelpers.executeActionViaButtonCardBridge(simpleActions.tap_action, cardInstance, 'tap');
              } else {
                cblcarsLog.debug(`[ActionHelpers] 🚫 Overlay single tap cancelled (double-tap occurred)`);
              }
            }, 300);
          } else {
            // No double-tap action, execute immediately
            cblcarsLog.debug(`[ActionHelpers] 🎯 Overlay SINGLE TAP ACTION TRIGGERED (immediate)`);
            ActionHelpers.executeActionViaButtonCardBridge(simpleActions.tap_action, cardInstance, 'tap');
          }
        }
      } else {
        cblcarsLog.debug(`[ActionHelpers] 🔲 Overlay hold was completed, skipping tap processing`);
      }

      // Reset hold state
      isHolding = false;
    };

    const handlePointerLeave = (event) => {
      // Always clear timers on leave, regardless of target
      cblcarsLog.debug(`[ActionHelpers] 🔲 Overlay pointer leave - clearing hold timer`);
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      isHolding = false;
    };

    // Attach unified pointer events for overlay with lower priority (normal phase, not capture)
    // This ensures cell events (capture phase) are handled first
    element.addEventListener('mousedown', handlePointerDown, { capture: false });
    element.addEventListener('mouseup', handlePointerUp, { capture: false });
    element.addEventListener('mouseleave', handlePointerLeave, { capture: false });
    element.addEventListener('touchstart', handlePointerDown, { capture: false });
    element.addEventListener('touchend', handlePointerUp, { capture: false });
    element.addEventListener('touchcancel', handlePointerLeave, { capture: false });
  }

  /**
   * Handle click events using action delegation
   * @private
   */
  static handleClickEvent(event, overlay, actionConfig, cardInstance) {
    const target = this.resolveActionTarget(event.target, overlay, actionConfig);

    if (target) {
      cblcarsLog.debug(`[ActionHelpers] Processing tap action for target:`, target);

      // Stop event propagation to prevent conflicts
      event.stopPropagation();

      // Execute the appropriate tap action
      this.executeAction(target.tap_action, target.context, cardInstance);
    }
  }

  /**
   * Handle hold/context menu events
   * @private
   */
  static handleHoldEvent(event, overlay, actionConfig, cardInstance) {
    const target = this.resolveActionTarget(event.target, overlay, actionConfig);

    if (target && target.hold_action) {
      cblcarsLog.debug(`[ActionHelpers] Processing hold action for target:`, target);

      // Execute the appropriate hold action
      this.executeAction(target.hold_action, target.context, cardInstance);
    }
  }

  /**
   * Resolve which action to execute based on the clicked element
   * @private
   * @param {Element} clickedElement - The actual DOM element that was clicked
   * @param {Object} overlay - Overlay configuration
   * @param {Object} actionConfig - Action configuration
   * @returns {Object|null} Resolved action target with action definitions and context
   */
  static resolveActionTarget(clickedElement, overlay, actionConfig) {
    // Tier 1: Simple overlay actions (tap_action, hold_action on overlay itself)
    if (actionConfig.simple) {
      return {
        tap_action: actionConfig.simple,
        hold_action: overlay.hold_action,
        context: {
          overlay_id: overlay.id,
          overlay_type: overlay.type
        }
      };
    }

    // Tier 2: Enhanced multi-target actions (for status_grid, etc.)
    if (actionConfig.enhanced) {
      return this.resolveEnhancedTarget(clickedElement, overlay, actionConfig.enhanced);
    }

    // Tier 3: Rules-based actions (handled by Rules Engine)
    if (actionConfig.rulesEngine) {
      return this.resolveRulesTarget(clickedElement, overlay, actionConfig.rulesEngine);
    }

    return null;
  }

  /**
   * Resolve enhanced action targets (Tier 2) - for multi-element overlays like status_grid
   * @private
   */
  static resolveEnhancedTarget(clickedElement, overlay, enhancedActions) {
    // Find the closest cell or target element
    const cellElement = clickedElement.closest('[data-cell-id]');

    if (cellElement) {
      const cellId = cellElement.getAttribute('data-cell-id');
      const cellRow = cellElement.getAttribute('data-cell-row');
      const cellCol = cellElement.getAttribute('data-cell-col');

      cblcarsLog.debug(`[ActionHelpers] Clicked on cell:`, { cellId, cellRow, cellCol });

      // Check for cell-specific overrides first
      if (enhancedActions.cell_overrides) {
        const override = enhancedActions.cell_overrides.find(override => {
          return (override.cell_id === cellId) ||
                 (override.position &&
                  override.position[0] == cellRow &&
                  override.position[1] == cellCol);
        });

        if (override) {
          return {
            tap_action: override.tap_action,
            hold_action: override.hold_action,
            context: {
              overlay_id: overlay.id,
              overlay_type: overlay.type,
              cell_id: cellId,
              cell_row: parseInt(cellRow),
              cell_col: parseInt(cellCol),
              cell_element: cellElement
            }
          };
        }
      }

      // Fall back to default actions with cell context
      return {
        tap_action: enhancedActions.default_tap,
        hold_action: enhancedActions.default_hold,
        context: {
          overlay_id: overlay.id,
          overlay_type: overlay.type,
          cell_id: cellId,
          cell_row: parseInt(cellRow),
          cell_col: parseInt(cellCol),
          cell_element: cellElement
        }
      };
    }

    // No specific target found, use default actions
    return {
      tap_action: enhancedActions.default_tap,
      hold_action: enhancedActions.default_hold,
      context: {
        overlay_id: overlay.id,
        overlay_type: overlay.type
      }
    };
  }

  /**
   * Resolve rules-based action targets (Tier 3) - placeholder for Rules Engine integration
   * @private
   */
  static resolveRulesTarget(clickedElement, overlay, rulesActions) {
    // TODO: Implement in Phase 4 when we integrate with Rules Engine
    cblcarsLog.debug(`[ActionHelpers] Rules-based actions not yet implemented`);
    return null;
  }

  /**
   * Execute a Home Assistant action using custom-button-card's infrastructure
   * @param {Object} actionDef - Action definition object
   * @param {Object} context - Action context (overlay info, cell info, etc.)
   * @param {Object} cardInstance - Reference to custom-button-card instance
   */
  static executeAction(actionDef, context, cardInstance) {
    if (!actionDef || !cardInstance) {
      cblcarsLog.debug(`[ActionHelpers] Skipping action execution - missing action or card instance`);
      return;
    }

    cblcarsLog.debug(`[ActionHelpers] Executing action:`, { actionDef, context });

    try {
      // Process templates in action definition using context
      const processedAction = this.processActionTemplates(actionDef, context, cardInstance);

      // Delegate to custom-button-card's action handling
      switch (processedAction.action) {
        case 'toggle':
          if (cardInstance._toggleEntity) {
            cardInstance._toggleEntity(processedAction.entity);
          }
          break;

        case 'call-service':
          if (cardInstance._callService) {
            const [domain, service] = processedAction.service.split('.');
            cardInstance._callService(domain, service, processedAction.service_data);
          }
          break;

        case 'navigate':
          if (cardInstance._navigate) {
            cardInstance._navigate(processedAction.navigation_path);
          }
          break;

        case 'more-info':
          if (cardInstance._moreInfo) {
            cardInstance._moreInfo(processedAction.entity);
          }
          break;

        case 'url':
          if (processedAction.url_path) {
            window.open(processedAction.url_path, '_blank');
          }
          break;

        case 'fire-dom-event':
          const event = new CustomEvent(processedAction.event_type || 'action', {
            detail: processedAction.event_data || context
          });
          cardInstance.dispatchEvent(event);
          break;

        case 'none':
          // Do nothing - explicit no-action
          break;

        default:
          // Fallback to custom-button-card's general handler if available
          if (cardInstance._handleAction) {
            cardInstance._handleAction(processedAction, processedAction.entity);
          } else {
            cblcarsLog.warn(`[ActionHelpers] Unknown action type: ${processedAction.action}`);
          }
      }

      cblcarsLog.debug(`[ActionHelpers] ✅ Action executed successfully`);

    } catch (error) {
      cblcarsLog.error(`[ActionHelpers] ❌ Error executing action:`, error);
    }
  }

  /**
   * Execute action via button-card bridge pattern
   * Uses button-card's proven action system for full compatibility
   * @param {Object} action - Action configuration
   * @param {Object} cardInstance - Button-card instance
   * @param {string} actionType - Type of action (tap, hold, double_tap)
   * @static
   */
  static executeActionViaButtonCardBridge(action, cardInstance, actionType = 'tap') {
    if (!action || !cardInstance) {
      cblcarsLog.debug(`[ActionHelpers] Missing action or card instance for bridge execution`);
      return false;
    }

    try {
      cblcarsLog.debug(`[ActionHelpers] 🌉 Executing ${actionType} action via button-card bridge:`, action);

      // Method 1: Try button-card's _handleAction with mock event
      if (typeof cardInstance._handleAction === 'function') {
        const mockEvent = {
          detail: {
            action: actionType
          }
        };

        // FIXED: Use non-reactive config injection to avoid triggering re-renders
        const originalConfig = cardInstance._config;
        const originalHass = cardInstance.hass;
        const actionKey = `${actionType}_action`;

        // Create temporary config object without triggering LitElement reactivity
        const tempConfig = {
          ...originalConfig,
          [actionKey]: action
        };

        // Ensure we have the freshest HASS object available
        const freshHass = ActionHelpers._getFreshestHass(cardInstance);

        // Directly assign to internal properties to avoid setter/getter reactivity
        const configDescriptor = Object.getOwnPropertyDescriptor(cardInstance, '_config');
        const hassDescriptor = Object.getOwnPropertyDescriptor(cardInstance, 'hass');

        Object.defineProperty(cardInstance, '_config', {
          value: tempConfig,
          writable: true,
          enumerable: true,
          configurable: true
        });

        // Temporarily inject fresh HASS to prevent stale state in more-info dialogs
        if (freshHass && freshHass !== originalHass) {
          Object.defineProperty(cardInstance, 'hass', {
            value: freshHass,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }        try {
          // Call button-card's action handler
          const result = cardInstance._handleAction(mockEvent);
          cblcarsLog.debug(`[ActionHelpers] ✅ Button-card bridge execution completed:`, result);
          return true;
        } finally {
          // Always restore original config and hass using the same non-reactive approach
          if (configDescriptor) {
            Object.defineProperty(cardInstance, '_config', configDescriptor);
          } else {
            Object.defineProperty(cardInstance, '_config', {
              value: originalConfig,
              writable: true,
              enumerable: true,
              configurable: true
            });
          }

          // Restore original HASS if we changed it
          if (freshHass && freshHass !== originalHass) {
            if (hassDescriptor) {
              Object.defineProperty(cardInstance, 'hass', hassDescriptor);
            } else {
              Object.defineProperty(cardInstance, 'hass', {
                value: originalHass,
                writable: true,
                enumerable: true,
                configurable: true
              });
            }
          }
        }
      }

      // Method 2: Fallback to direct HASS service call for basic actions
      cblcarsLog.debug(`[ActionHelpers] 🔄 Button-card bridge unavailable, falling back to direct HASS`);
      return ActionHelpers._executeActionDirectly(action, cardInstance);

    } catch (error) {
      cblcarsLog.error(`[ActionHelpers] ❌ Button-card bridge execution failed:`, error);

      // Final fallback to direct execution
      return ActionHelpers._executeActionDirectly(action, cardInstance);
    }
  }  /**
   * Direct action execution fallback (keeps existing functionality)
   * @param {Object} action - Action configuration
   * @param {Object} cardInstance - Button-card instance
   * @private
   * @static
   */
  static _executeActionDirectly(action, cardInstance) {
    try {
      // Get HASS object from card instance
      const hassObject = cardInstance.___hass || cardInstance._hass || cardInstance.hass || cardInstance.__hass;

      if (!hassObject || typeof hassObject.callService !== 'function') {
        cblcarsLog.warn(`[ActionHelpers] No HASS object with callService method available`);
        return false;
      }

      // Handle different action types
      switch (action.action) {
        case 'toggle':
          if (action.entity) {
            const domain = action.entity.split('.')[0];
            hassObject.callService(domain, 'toggle', { entity_id: action.entity });
            cblcarsLog.debug(`[ActionHelpers] ✅ Direct toggle executed for ${action.entity}`);
            return true;
          }
          break;

        case 'call-service':
          if (action.service) {
            const [domain, service] = action.service.split('.');
            const serviceData = action.service_data || action.data || {};
            hassObject.callService(domain, service, serviceData);
            cblcarsLog.debug(`[ActionHelpers] ✅ Direct service call executed: ${action.service}`);
            return true;
          }
          break;

        case 'more-info':
          if (action.entity && hassObject.showMoreInfoDialog) {
            hassObject.showMoreInfoDialog(action.entity);
            cblcarsLog.debug(`[ActionHelpers] ✅ Direct more-info executed for ${action.entity}`);
            return true;
          }
          break;

        case 'navigate':
          if (action.navigation_path && window.history) {
            window.history.pushState(null, '', action.navigation_path);
            cblcarsLog.debug(`[ActionHelpers] ✅ Direct navigation executed to ${action.navigation_path}`);
            return true;
          }
          break;

        case 'url':
          if (action.url_path) {
            window.open(action.url_path, action.new_tab ? '_blank' : '_self');
            cblcarsLog.debug(`[ActionHelpers] ✅ Direct URL action executed: ${action.url_path}`);
            return true;
          }
          break;

        default:
          cblcarsLog.warn(`[ActionHelpers] Unsupported direct action type: ${action.action}`);
          return false;
      }

      cblcarsLog.warn(`[ActionHelpers] Direct action execution failed - missing required parameters`);
      return false;

    } catch (error) {
      cblcarsLog.error(`[ActionHelpers] ❌ Direct action execution error:`, error);
      return false;
    }
  }

  /**
   * Process template strings in action definitions using context data
   * @private
   * @param {Object} actionDef - Action definition with potential templates
   * @param {Object} context - Context data for template processing
   * @param {Object} cardInstance - Card instance for accessing hass, etc.
   * @returns {Object} Processed action definition
   */
  static processActionTemplates(actionDef, context, cardInstance) {
    const processed = { ...actionDef };

    // Simple template processing for common patterns
    Object.keys(processed).forEach(key => {
      if (typeof processed[key] === 'string' && processed[key].includes('{{')) {
        processed[key] = this.resolveTemplate(processed[key], context, cardInstance);
      }
    });

    return processed;
  }

  /**
   * Resolve template strings using context and card data
   * @private
   * @param {string} template - Template string with {{variable}} patterns
   * @param {Object} context - Context data
   * @param {Object} cardInstance - Card instance
   * @returns {string} Resolved template
   */
  static resolveTemplate(template, context, cardInstance) {
    let resolved = template;

    // Replace context variables
    resolved = resolved.replace(/\{\{cell\.id\}\}/g, context.cell_id || '');
    resolved = resolved.replace(/\{\{cell\.row\}\}/g, context.cell_row || '');
    resolved = resolved.replace(/\{\{cell\.col\}\}/g, context.cell_col || '');
    resolved = resolved.replace(/\{\{overlay\.id\}\}/g, context.overlay_id || '');
    resolved = resolved.replace(/\{\{overlay\.type\}\}/g, context.overlay_type || '');

    // TODO: Add more sophisticated template processing later (DataSource references, etc.)

    cblcarsLog.debug(`[ActionHelpers] Template resolved: "${template}" → "${resolved}"`);
    return resolved;
  }

  /**
   * Remove action event listeners from an overlay element
   * @param {Element} overlayElement - The overlay DOM element
   */
  static detachActions(overlayElement) {
    if (!overlayElement) return;

    // Remove event listeners
    overlayElement.removeEventListener('click', this.handleClickEvent);
    overlayElement.removeEventListener('contextmenu', this.handleHoldEvent);

    // Remove action attributes
    overlayElement.removeAttribute('data-actions-enabled');
    overlayElement.style.cursor = '';

    cblcarsLog.debug(`[ActionHelpers] Actions detached from overlay element`);
  }

  /**
   * Process action configuration for any overlay type
   * Generic method that extracts actions from overlay configuration
   * @param {Object} overlay - Overlay configuration
   * @param {Object} style - Resolved overlay styling (may contain enhanced actions)
   * @param {Object} cardInstance - Card instance for action handling
   * @returns {Object|null} Action configuration ready for attachActions()
   * @static
   */
  static processOverlayActions(overlay, style = {}, cardInstance = null) {
    if (!cardInstance) {
      cblcarsLog.debug(`[ActionHelpers] No card instance available for ${overlay.type || 'overlay'} ${overlay.id}`);
      return null;
    }

    // Check for simple overlay actions (tap, hold, double_tap)
    const hasSimpleActions = overlay.tap_action || overlay.hold_action || overlay.double_tap_action;

    // Check for enhanced actions in style block
    const hasEnhancedActions = style.actions;

    if (!hasSimpleActions && !hasEnhancedActions) {
      return null;
    }

    // Build action configuration
    const actionConfig = {};

    // Simple actions (treat entire overlay as single clickable element)
    if (hasSimpleActions) {
      actionConfig.simple = {
        tap_action: overlay.tap_action,
        hold_action: overlay.hold_action,
        double_tap_action: overlay.double_tap_action
      };
    }

    // Enhanced actions (element-specific actions)
    if (hasEnhancedActions) {
      actionConfig.enhanced = style.actions;
    }

    return {
      config: actionConfig,
      overlay: overlay,
      cardInstance: cardInstance
    };
  }

  /**
   * INTEGRATION PATTERN: How other overlay renderers should integrate actions
   *
   * This universal action system works with any overlay type. Follow this pattern:
   *
   * ```javascript
   * // ===== IN YOUR OVERLAY RENDERER =====
   *
   * // 1. Import ActionHelpers
   * import { ActionHelpers } from './ActionHelpers.js';
   *
   * // 2. In your render method, process actions
   * renderMyOverlay(overlay, anchors, viewBox, cardInstance = null) {
   *   // ... your rendering logic ...
   *
   *   // Process actions using the universal method
   *   const actionInfo = ActionHelpers.processOverlayActions(overlay, resolvedStyle, cardInstance);
   *
   *   // Return markup with action metadata
   *   return {
   *     markup: overlayMarkup,
   *     actions: actionInfo,
   *     needsActionAttachment: !!actionInfo
   *   };
   * }
   *
   * // 3. In your main static render method, handle post-DOM processing
   * static render(overlay, anchors, viewBox, cardInstance = null) {
   *   const result = MyRenderer.renderWithActions(overlay, anchors, viewBox, cardInstance);
   *
   *   // Store action info for post-DOM-insertion processing
   *   if (result.needsActionAttachment) {
   *     MyRenderer._storeActionInfo(overlay.id, result.actions);
   *     setTimeout(() => MyRenderer._tryManualActionProcessing(overlay.id), 100);
   *   }
   *
   *   return result.markup; // Backwards compatible
   * }
   *
   * // 4. Create action attachment method (copy from StatusGridRenderer)
   * static attachMyOverlayActions(overlayElement, actionInfo) {
   *   if (!overlayElement || !actionInfo) return;
   *
   *   // Delegate to ActionHelpers - it handles everything!
   *   if (ActionHelpers && typeof ActionHelpers.attachActions === 'function') {
   *     ActionHelpers.attachActions(overlayElement, actionInfo.overlay, actionInfo.config, actionInfo.cardInstance);
   *   }
   * }
   *
   * // 5. Set up DOM observation (copy pattern from StatusGridRenderer)
   * static _setupActionProcessing() {
   *   // ... MutationObserver setup to detect your overlay type ...
   *   // Query for '[data-overlay-type="your_overlay_type"]'
   * }
   * ```
   *
   * ===== CONFIGURATION SUPPORT =====
   *
   * Your overlay configuration supports these action formats:
   *
   * Simple Actions (entire overlay clickable):
   * ```yaml
   * overlays:
   *   - type: my_overlay
   *     tap_action:
   *       action: toggle
   *       entity: light.example
   *     hold_action:
   *       action: more-info
   *       entity: light.example
   *     double_tap_action:
   *       action: call-service
   *       service: light.turn_on
   *       service_data:
   *         entity_id: light.example
   *         brightness: 255
   * ```
   *
   * Enhanced Actions (element-specific):
   * ```yaml
   Enhanced Actions (element-specific):
 * ```yaml
 * # For status grids - actions directly on cells (preferred):
 * overlays:
 *   - type: status_grid
 *     cells:
 *       - id: cell-1
 *         tap_action: { action: toggle, entity: light.example }
 *         hold_action: { action: more-info, entity: light.example }
 *
 * # Legacy format (still supported):
 * overlays:
 *   - type: status_grid
 *     style:
 *       actions:
 *         cells:
 *           - cell_id: cell-1
 *             tap_action: { action: toggle, entity: light.example }
 * ```
   * ```
   */  /**
   * Resolve card instance for action handling from global context
   * Utility method for overlay renderers
   * @returns {Object|null} Card instance or null if not found
   * @static
   */
  static resolveCardInstance() {
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

    cblcarsLog.debug(`[ActionHelpers] Could not resolve card instance from global context`);
    return null;
  }

  /**
   * Attach enhanced actions (element-specific) to overlay
   * @param {Element} overlayElement - The overlay DOM element
   * @param {Object} enhancedActions - Enhanced actions configuration
   * @param {Object} cardInstance - Card instance for action handling
   * @private
   * @static
   */
  static _attachEnhancedActions(overlayElement, enhancedActions, cardInstance) {
    cblcarsLog.debug(`[ActionHelpers] 🎯 Attaching enhanced actions:`, enhancedActions);

    // LEGACY: Handle old-style cell actions (style.actions.cells) for backward compatibility
    if (enhancedActions.cells && Array.isArray(enhancedActions.cells)) {
      cblcarsLog.debug(`[ActionHelpers] ⚠️ Using legacy cell action format - consider moving actions to cell configs`);

      enhancedActions.cells.forEach(cellAction => {
        const cellId = cellAction.cell_id;
        if (!cellId) {
          cblcarsLog.warn(`[ActionHelpers] Cell action missing cell_id:`, cellAction);
          return;
        }

        // Find the cell element within the overlay
        const cellElement = overlayElement.querySelector(`[data-cell-id="${cellId}"]`);
        if (!cellElement) {
          cblcarsLog.warn(`[ActionHelpers] Cell element not found for ${cellId}`);
          return;
        }

        ActionHelpers._attachCellActions(cellElement, cellAction, cardInstance, cellId);
      });
    }

    // Handle other element-specific actions (for future overlay types)
    if (enhancedActions.elements && Array.isArray(enhancedActions.elements)) {
      // TODO: Implement generic element-specific actions for other overlay types
      cblcarsLog.debug(`[ActionHelpers] � Generic element actions not yet implemented`);
    }
  }

  /**
   * Attach actions directly from cell configurations (preferred method)
   * @param {Element} overlayElement - The overlay DOM element
   * @param {Array} cells - Array of cell configurations with actions
   * @param {Object} cardInstance - Card instance for action handling
   * @static
   */
  static attachCellActionsFromConfigs(overlayElement, cells, cardInstance) {
    if (!cells || !Array.isArray(cells)) {
      cblcarsLog.debug(`[ActionHelpers] No cells provided for action attachment`);
      return;
    }

    cblcarsLog.debug(`[ActionHelpers] 🔍 Processing ${cells.length} cells for action attachment`);

    cells.forEach(cell => {


      if (!cell.actions || (!cell.actions.tap_action && !cell.actions.hold_action && !cell.actions.double_tap_action)) {
        cblcarsLog.debug(`[ActionHelpers] No actions on cell ${cell.id}`);
        return; // No actions on this cell
      }

      // Find the cell element within the overlay
      const cellElement = overlayElement.querySelector(`[data-cell-id="${cell.id}"]`);
      if (!cellElement) {
        const availableCells = Array.from(overlayElement.querySelectorAll('[data-cell-id]')).map(el => el.getAttribute('data-cell-id'));
        cblcarsLog.error(`[ActionHelpers] ❌ Cell element not found for "${cell.id}"`, {
          searchedFor: cell.id,
          availableCells: availableCells,
          overlayId: overlayElement.getAttribute('data-overlay-id'),
          totalCellsInDOM: availableCells.length,
          cellConfig: cell
        });
        return;
      }

      // CRITICAL: Attach actions to ALL elements that belong to this cell (rect, text elements, etc.)
      const cellParts = overlayElement.querySelectorAll(`[data-cell-id="${cell.id}"]`);
      cblcarsLog.debug(`[ActionHelpers] 🔍 Found ${cellParts.length} elements for cell ${cell.id}`);

      cellParts.forEach((element, index) => {
        const elementType = element.tagName.toLowerCase();
        const elementDesc = elementType === 'rect' ? 'cell-rect' :
                           elementType === 'text' ? 'cell-text' :
                           `cell-${elementType}`;
        cblcarsLog.debug(`[ActionHelpers] 🔲 Attaching actions to ${elementDesc} ${index + 1}/${cellParts.length} for ${cell.id}`);
        ActionHelpers._attachCellActions(element, cell.actions, cardInstance, `${cell.id}-${elementDesc}`);
      });
    });
  }

  /**
   * Helper method to attach actions to a specific cell element
   * @param {Element} cellElement - The cell DOM element
   * @param {Object} actions - Actions configuration
   * @param {Object} cardInstance - Card instance for action handling
   * @param {string} cellId - Cell ID for logging
   * @private
   * @static
   */
  static _attachCellActions(cellElement, actions, cardInstance, cellId) {
    cblcarsLog.debug(`[ActionHelpers] 🔲 Attaching cell actions to ${cellId}:`, actions);

    // Track action state to prevent conflicts
    let isHolding = false;
    let holdTimer = null;
    let lastTap = 0;

    // Handle mouse/touch events with proper coordination
    const handlePointerDown = (event) => {
      cblcarsLog.debug(`[ActionHelpers] 🔲 Cell ${cellId} pointer down - starting hold timer`);
      event.preventDefault();
      event.stopImmediatePropagation();

      if (actions.hold_action) {
        isHolding = false;
        cblcarsLog.debug(`[ActionHelpers] 🔲 Cell ${cellId} setting hold timer for 500ms`);
        holdTimer = setTimeout(() => {
          isHolding = true;
          cblcarsLog.debug(`[ActionHelpers] 🎯 Cell ${cellId} HOLD ACTION TRIGGERED after 500ms`);
          ActionHelpers.executeActionViaButtonCardBridge(actions.hold_action, cardInstance, 'hold');
        }, 500);
      }
    };

    const handlePointerUp = (event) => {
      cblcarsLog.debug(`[ActionHelpers] 🔲 Cell ${cellId} pointer up, wasHolding: ${isHolding}, hadTimer: ${!!holdTimer}`);
      event.preventDefault();
      event.stopImmediatePropagation();

      // Clear hold timer if it exists
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
        cblcarsLog.debug(`[ActionHelpers] 🔲 Cell ${cellId} cleared hold timer`);
      }

      // Only process tap/double-tap if we weren't holding
      if (!isHolding) {
        const now = Date.now();

        // Check for double-tap first
        if (actions.double_tap_action && (now - lastTap < 300) && lastTap > 0) {
          cblcarsLog.debug(`[ActionHelpers] 🎯 Cell ${cellId} DOUBLE-TAP ACTION TRIGGERED`);
          ActionHelpers.executeActionViaButtonCardBridge(actions.double_tap_action, cardInstance, 'double_tap');
          lastTap = 0; // Reset to prevent triple-tap and single-tap
          return; // CRITICAL: Exit early to prevent single-tap logic
        }

        if (actions.tap_action) {
          lastTap = now;
          // Set up single tap with delay to allow for double-tap
          if (actions.double_tap_action) {
            // Wait to see if double-tap comes
            const tapTimestamp = now;
            setTimeout(() => {
              if (lastTap === tapTimestamp) { // No double-tap happened (lastTap wasn't reset)
                cblcarsLog.debug(`[ActionHelpers] 🎯 Cell ${cellId} SINGLE TAP ACTION TRIGGERED (delayed)`);
                ActionHelpers.executeActionViaButtonCardBridge(actions.tap_action, cardInstance, 'tap');
              } else {
                cblcarsLog.debug(`[ActionHelpers] 🚫 Cell ${cellId} single tap cancelled (double-tap occurred)`);
              }
            }, 300);
          } else {
            // No double-tap action, execute immediately
            cblcarsLog.debug(`[ActionHelpers] 🎯 Cell ${cellId} SINGLE TAP ACTION TRIGGERED (immediate)`);
            ActionHelpers.executeActionViaButtonCardBridge(actions.tap_action, cardInstance, 'tap');
          }
        }
      } else {
        cblcarsLog.debug(`[ActionHelpers] 🔲 Cell ${cellId} hold was completed, skipping tap processing`);
      }

      // Reset hold state
      isHolding = false;
    };

    const handlePointerLeave = (event) => {
      cblcarsLog.debug(`[ActionHelpers] 🔲 Cell ${cellId} pointer leave - clearing hold timer`);
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      isHolding = false;
    };

    // Attach unified pointer events with proper event blocking
    cellElement.addEventListener('mousedown', handlePointerDown, { capture: true });
    cellElement.addEventListener('mouseup', handlePointerUp, { capture: true });
    cellElement.addEventListener('mouseleave', handlePointerLeave, { capture: true });
    cellElement.addEventListener('touchstart', handlePointerDown, { capture: true });
    cellElement.addEventListener('touchend', handlePointerUp, { capture: true });
    cellElement.addEventListener('touchcancel', handlePointerLeave, { capture: true });

    // CRITICAL: Block click events on this cell to prevent overlay actions
    // Note: We already block mousedown/mouseup/etc in our handlers above
    cellElement.addEventListener('click', (event) => {
      cblcarsLog.debug(`[ActionHelpers] 🚫 Blocking click event on cell ${cellId} to prevent overlay action`);
      event.preventDefault();
      event.stopImmediatePropagation();
      // Don't execute anything - this is just to block overlay events
    }, { capture: true });    // Attach hold action
    if (actions.hold_action) {
      let holdTimer;

      const startHold = () => {
        holdTimer = setTimeout(() => {
          ActionHelpers.executeActionViaButtonCardBridge(actions.hold_action, cardInstance, 'hold');
        }, 500);
      };

      const endHold = (event) => {
        if (event) event.stopImmediatePropagation();
        clearTimeout(holdTimer);
      };

      cellElement.addEventListener('mousedown', startHold, { capture: true });
      cellElement.addEventListener('mouseup', endHold, { capture: true });
      cellElement.addEventListener('mouseleave', endHold, { capture: true });
      cellElement.addEventListener('touchstart', startHold, { capture: true });
      cellElement.addEventListener('touchend', endHold, { capture: true });
      cellElement.addEventListener('touchcancel', endHold, { capture: true });
    }

    // Attach double tap action with higher priority
    if (actions.double_tap_action) {
      let lastTap = 0;
      cellElement.addEventListener('click', (event) => {
        const now = Date.now();
        if (now - lastTap < 300) {
          cblcarsLog.debug(`[ActionHelpers] 🎯 Cell ${cellId} double-tap action triggered`);
          event.preventDefault();
          event.stopImmediatePropagation(); // Stop ALL other listeners
          ActionHelpers.executeActionViaButtonCardBridge(actions.double_tap_action, cardInstance, 'double_tap');
          lastTap = 0;
        } else {
          lastTap = now;
        }
      }, { capture: true });
    }

    // Make sure cell is clickable if it has actions
    if (actions.tap_action || actions.hold_action || actions.double_tap_action) {
      cellElement.style.pointerEvents = 'visiblePainted';
      cellElement.style.cursor = 'pointer';
    }
  }  /**
   * Get the freshest HASS object available to prevent stale state in dialogs
   * @param {Object} cardInstance - Card instance
   * @returns {Object} Freshest HASS object available
   * @private
   * @static
   */
  static _getFreshestHass(cardInstance) {
    // Try to get the freshest HASS from various sources, in order of freshness

    // 1. From MSD SystemsManager (most up-to-date)
    if (window.__msdDebug?.systemsManager?._originalHass) {
      return window.__msdDebug.systemsManager._originalHass;
    }

    // 2. From card instance (might be stale)
    if (cardInstance.hass) {
      return cardInstance.hass;
    }

    // 3. From global MSD context
    if (window._msdCurrentHass) {
      return window._msdCurrentHass;
    }

    // 4. From Home Assistant's global hass
    if (window.hassConnection?.hass) {
      return window.hassConnection.hass;
    }

    cblcarsLog.debug(`[ActionHelpers] Using card instance HASS (no fresher source found)`);
    return cardInstance.hass;
  }

  /**
   * Attach actions to any overlay element using button-card bridge pattern
   * @param {Element} element - The DOM element to attach actions to
   * @param {Object} overlay - Overlay configuration
   * @param {Object} actionConfig - Action configuration
   * @param {Object} cardInstance - Card instance for action handling
   * @static
   */
  static attachActions(element, overlay, actionConfig, cardInstance) {
    if (!element || !actionConfig || !cardInstance) {
      cblcarsLog.debug(`[ActionHelpers] Missing required parameters for action attachment`);
      return;
    }

    cblcarsLog.debug(`[ActionHelpers] 🔗 Attaching actions to ${overlay.type || 'overlay'} ${overlay.id}`);

    // Attach simple actions (tap, hold, double_tap)
    if (actionConfig.simple) {
      ActionHelpers._attachSimpleActions(element, actionConfig.simple, cardInstance);
    }

    // Handle enhanced actions (element-specific or multi-target)
    if (actionConfig.enhanced) {
      ActionHelpers._attachEnhancedActions(element, actionConfig.enhanced, cardInstance);
    }

    cblcarsLog.debug(`[ActionHelpers] ✅ Actions attached to ${overlay.type || 'overlay'} ${overlay.id}`);
  }
}

// Expose ActionHelpers to window for console debugging
if (typeof window !== 'undefined') {
  window.ActionHelpers = ActionHelpers;
}