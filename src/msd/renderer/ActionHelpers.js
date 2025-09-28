/**
 * ActionHelpers -    cblcarsLog.debug(`[ActionHelpers] Attaching actions via button-card bridge to overlay ${overlay.id}:`, actionConfig);

    // Handle simple actions (tap, hold, double_tap) using button-card bridge
    if (actionConfig.simple) {
      // Tap action
      if (actionConfig.simple.tap_action) {
        element.addEventListener('click', (event) => {tion System Abstraction Layer
 * Provides unified action handling across all interactive overlays
 * Leverages custom-button-card's existing action infrastructure
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class ActionHelpers {

  /**
   * Attach actions to an overlay element using button-card bridge pattern
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

    cblcarsLog.debug(`[ActionHelpers] Attaching actions via button-card bridge to overlay ${overlay.id}:`, actionConfig);

    // Handle simple actions (tap, hold, double_tap) using button-card bridge
    if (actionConfig.simple) {
      // Tap action
      if (actionConfig.simple.tap_action) {
        element.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          ActionHelpers.executeActionViaButtonCardBridge(actionConfig.simple.tap_action, cardInstance, 'tap');
        });
      }

      // Hold action (long press)
      if (actionConfig.simple.hold_action) {
        let holdTimer;
        let isHolding = false;

        const startHold = () => {
          holdTimer = setTimeout(() => {
            isHolding = true;
            ActionHelpers.executeActionViaButtonCardBridge(actionConfig.simple.hold_action, cardInstance, 'hold');
          }, 500); // 500ms hold time
        };

        const endHold = () => {
          clearTimeout(holdTimer);
          isHolding = false;
        };

        // Mouse events
        element.addEventListener('mousedown', startHold);
        element.addEventListener('mouseup', endHold);
        element.addEventListener('mouseleave', endHold);

        // Touch events
        element.addEventListener('touchstart', startHold);
        element.addEventListener('touchend', endHold);
        element.addEventListener('touchcancel', endHold);
      }

      // Double tap action
      if (actionConfig.simple.double_tap_action) {
        let lastTap = 0;
        element.addEventListener('click', (event) => {
          const now = Date.now();
          if (now - lastTap < 300) { // 300ms double tap window
            event.preventDefault();
            event.stopPropagation();
            ActionHelpers.executeActionViaButtonCardBridge(actionConfig.simple.double_tap_action, cardInstance, 'double_tap');
            lastTap = 0;
          } else {
            lastTap = now;
          }
        });
      }
    }

    // Handle enhanced actions (cell-level or multi-target)
    if (actionConfig.enhanced) {
      // TODO: Implement enhanced action handling
      // This would handle cell-specific actions in status grids
      cblcarsLog.debug(`[ActionHelpers] Enhanced actions not yet implemented:`, actionConfig.enhanced);
    }

    cblcarsLog.debug(`[ActionHelpers] ✅ Actions attached successfully to overlay ${overlay.id}`);
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
        const actionKey = `${actionType}_action`;

        // Create temporary config object without triggering LitElement reactivity
        const tempConfig = {
          ...originalConfig,
          [actionKey]: action
        };

        // Directly assign to internal property to avoid setter/getter reactivity
        const configDescriptor = Object.getOwnPropertyDescriptor(cardInstance, '_config');
        Object.defineProperty(cardInstance, '_config', {
          value: tempConfig,
          writable: true,
          enumerable: true,
          configurable: true
        });

        try {
          // Call button-card's action handler
          const result = cardInstance._handleAction(mockEvent);
          cblcarsLog.debug(`[ActionHelpers] ✅ Button-card bridge execution completed:`, result);
          return true;
        } finally {
          // Always restore original config using the same non-reactive approach
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
}

// Expose ActionHelpers to window for console debugging
if (typeof window !== 'undefined') {
  window.ActionHelpers = ActionHelpers;
}