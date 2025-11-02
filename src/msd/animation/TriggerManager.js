/**
 * TriggerManager - Handles animation triggers for a single overlay
 *
 * Responsibilities:
 * - Register animations with specific triggers
 * - Handle non-interactive triggers (on_load, on_datasource_change, etc.)
 * - Coordinate with AnimationManager for animation execution
 * - Cleanup resources on destroy
 *
 * NOTE: Interactive triggers (on_tap, on_hold, on_hover, on_double_tap) are now
 * handled by ActionHelpers.js to leverage its proven event handling and button-card
 * bridge pattern. TriggerManager only handles reactive/automatic triggers.
 *
 * Supported Triggers:
 * - on_load: Execute when overlay is first rendered (Phase 1) ✅
 * - on_datasource_change: Execute when datasource value changes (Phase 2) 🔮
 * - on_state_change: Execute when HA entity state changes (Phase 2) 🔮
 * - on_redraw: Execute when overlay re-renders (Future) 🔮
 * - on_exit: Execute when overlay is removed (Future) 🔮
 *
 * Interactive triggers handled by ActionHelpers:
 * - on_tap, on_hold, on_hover, on_double_tap ➡️ See ActionHelpers.js
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class TriggerManager {
  constructor(overlayId, element, animationManager) {
    this.overlayId = overlayId;
    this.element = element;
    this.animationManager = animationManager;

    // Maps trigger type to animation definitions
    this.registrations = new Map(); // trigger -> animDef[]

    // Maps trigger type to cleanup function
    this.listeners = new Map(); // trigger -> cleanup function

    cblcarsLog.debug(`[TriggerManager] Created for overlay: ${overlayId}`);
  }

  /**
   * Register an animation with a specific trigger
   *
   * @param {string} trigger - Trigger type (on_load, on_tap, etc.)
   * @param {Object} animDef - Animation definition
   */
  register(trigger, animDef) {
    // Initialize registration array for this trigger if needed
    if (!this.registrations.has(trigger)) {
      this.registrations.set(trigger, []);

      // Setup trigger listener (except for on_load which is handled immediately)
      if (trigger !== 'on_load') {
        this.setupTriggerListener(trigger);
      }
    }

    // Add animation definition to this trigger
    this.registrations.get(trigger).push(animDef);

    cblcarsLog.debug(`[TriggerManager] Registered animation for ${this.overlayId} on trigger: ${trigger}`);
  }

  /**
   * Setup event listener for a specific trigger type
   *
   * @param {string} trigger - Trigger type
   */
  setupTriggerListener(trigger) {
    // Interactive triggers (tap, hold, hover, leave, double_tap) are handled by ActionHelpers
    const interactiveTriggers = ['on_tap', 'on_hold', 'on_hover', 'on_leave', 'on_double_tap'];
    if (interactiveTriggers.includes(trigger)) {
      cblcarsLog.debug(`[TriggerManager] ${trigger} handled by ActionHelpers (skipping)`);
      return;
    }

    switch(trigger) {
      case 'on_datasource_change':
        // Handled by AnimationManager via DataSourceManager subscriptions
        cblcarsLog.debug(`[TriggerManager] on_datasource_change will be handled by AnimationManager`);
        break;

      case 'on_state_change':
                // Phase 2: Will be handled by AnimationManager via HA state subscriptions
        cblcarsLog.debug(`[TriggerManager] on_state_change will be handled by AnimationManager (Phase 2)`);
        break;

      default:
        cblcarsLog.warn(`[TriggerManager] Unknown trigger type: ${trigger}`);
    }
  }

  /**
   * Get all registered triggers for this overlay
   *
   * @returns {Array<string>} Array of trigger names
   */

  /**
   * Setup tap/click trigger
   */
  setupTapTrigger() {
    const tapHandler = (event) => {
      cblcarsLog.debug(`[TriggerManager] 👆 Tap triggered on ${this.overlayId}`);

      // Get all animations registered for this trigger
      const animations = this.registrations.get('on_tap') || [];

      // Execute each animation
      animations.forEach(animDef => {
        this.animationManager.playAnimation(this.overlayId, animDef);
      });

      // Prevent event from bubbling to parent overlays
      event.stopPropagation();
    };

    // Add event listener
    this.element.addEventListener('click', tapHandler);

    // Store cleanup function
    this.listeners.set('on_tap', () => {
      this.element.removeEventListener('click', tapHandler);
    });

    // Make element visually interactive (cursor pointer)
    this.element.style.cursor = 'pointer';

    cblcarsLog.debug(`[TriggerManager] ✅ Tap trigger setup for ${this.overlayId}`);
  }

  /**
   * Setup hover trigger (desktop only)
   */
  setupHoverTrigger() {
    // Check if device supports hover (desktop)
    const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (!isDesktop) {
      cblcarsLog.debug(`[TriggerManager] Skipping hover trigger on mobile device for ${this.overlayId}`);
      return;
    }

    const hoverHandler = (event) => {
      cblcarsLog.debug(`[TriggerManager] 🖱️ Hover triggered on ${this.overlayId}`);

      const animations = this.registrations.get('on_hover') || [];

      animations.forEach(animDef => {
        this.animationManager.playAnimation(this.overlayId, animDef);
      });
    };

    this.element.addEventListener('mouseenter', hoverHandler);

    this.listeners.set('on_hover', () => {
      this.element.removeEventListener('mouseenter', hoverHandler);
    });

    // Ensure element can receive pointer events
    this.element.style.pointerEvents = 'all';
    this.element.style.cursor = 'pointer';

    cblcarsLog.debug(`[TriggerManager] ✅ Hover trigger setup for ${this.overlayId}`);
  }

  /**
   * Setup hold trigger (long press)
   */
  setupHoldTrigger() {
    let holdTimer = null;
    const HOLD_DURATION = 500; // ms

    const startHold = (event) => {
      holdTimer = setTimeout(() => {
        cblcarsLog.debug(`[TriggerManager] ✊ Hold triggered on ${this.overlayId}`);

        const animations = this.registrations.get('on_hold') || [];

        animations.forEach(animDef => {
          this.animationManager.playAnimation(this.overlayId, animDef);
        });
      }, HOLD_DURATION);
    };

    const cancelHold = () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    };

    // Touch events
    this.element.addEventListener('touchstart', startHold);
    this.element.addEventListener('touchend', cancelHold);
    this.element.addEventListener('touchcancel', cancelHold);
    this.element.addEventListener('touchmove', cancelHold);

    // Mouse events
    this.element.addEventListener('mousedown', startHold);
    this.element.addEventListener('mouseup', cancelHold);
    this.element.addEventListener('mouseleave', cancelHold);

    this.listeners.set('on_hold', () => {
      this.element.removeEventListener('touchstart', startHold);
      this.element.removeEventListener('touchend', cancelHold);
      this.element.removeEventListener('touchcancel', cancelHold);
      this.element.removeEventListener('touchmove', cancelHold);
      this.element.removeEventListener('mousedown', startHold);
      this.element.removeEventListener('mouseup', cancelHold);
      this.element.removeEventListener('mouseleave', cancelHold);

      if (holdTimer) {
        clearTimeout(holdTimer);
      }
    });

    // Ensure element can receive pointer events
    this.element.style.pointerEvents = 'all';
    this.element.style.cursor = 'pointer';

    cblcarsLog.debug(`[TriggerManager] ✅ Hold trigger setup for ${this.overlayId}`);
  }

  /**
   * Get all registered triggers for this overlay
   *
   * @returns {Array<string>} Array of trigger names
   */
  getRegisteredTriggers() {
    return Array.from(this.registrations.keys());
  }

  /**
   * Get animation count for a specific trigger
   *
   * @param {string} trigger - Trigger type
   * @returns {number} Number of animations registered
   */
  getAnimationCount(trigger) {
    return (this.registrations.get(trigger) || []).length;
  }

  /**
   * Check if a specific trigger is registered
   *
   * @param {string} trigger - Trigger type
   * @returns {boolean}
   */
  hasTrigger(trigger) {
    return this.registrations.has(trigger);
  }

  /**
   * Cleanup all event listeners and resources
   */
  destroy() {
    cblcarsLog.debug(`[TriggerManager] 🗑️ Destroying trigger manager for ${this.overlayId}`);

    // Execute all cleanup functions
    this.listeners.forEach((cleanup, trigger) => {
      try {
        cleanup();
        cblcarsLog.debug(`[TriggerManager] Cleaned up listener for trigger: ${trigger}`);
      } catch (error) {
        cblcarsLog.error(`[TriggerManager] Failed to cleanup listener for ${trigger}:`, error);
      }
    });

    // Clear all maps
    this.listeners.clear();
    this.registrations.clear();

    // Remove cursor pointer if it was added
    if (this.element && this.element.style) {
      this.element.style.cursor = '';
    }

    cblcarsLog.debug(`[TriggerManager] ✅ Trigger manager destroyed for ${this.overlayId}`);
  }
}
